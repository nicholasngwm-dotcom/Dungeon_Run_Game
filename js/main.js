// Entry point: builds sprites, wires up screens and runs the main loop.
//
// Dev shortcuts (add to the URL):
//   ?class=mage          skip menus and start as a class
//   ?class=rogue&wave=3  start at a given wave
//   ?class=warrior&boss  start at a random boss (&boss=golem or &boss=phantom to pick)
//   ?class=mage&practice start in the practice range
//   ?lobby               start in the lobby (&class=... to pick the hero)
//   ?run=graveyard       start a set-dungeon run (?run=random for random mode; &stage=2 or 3 to skip ahead)

const App = {
  state: 'menu',     // menu | playing (lobby or run) | panel (lobby station open) | paused | ended
  game: null,
  classId: 'warrior',   // hero used in the lobby and runs (picked at a lobby statue)
  lastTime: 0,
  menuTime: 0,
  practiceMode: false,
  lastRun: null,        // the dungeon run picked at the gate (null = test dungeon)
  // practice-range cheats, kept when switching hero
  practiceOptions: { god: false, infiniteMana: false, infiniteEnergy: false },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.stage = document.getElementById('stage');
    this.practicePanel = document.getElementById('practice-panel');

    buildHeroSprites();
    buildEnemySprites();
    buildBossSprites();
    buildPhantomSprites();
    buildItemSprites();
    buildGraveyardSprites();   // after the items: it adds to Sprites.projectiles
    buildNpcSprites();
    buildIconSprites();

    Input.init(this.canvas);
    Menus.init(this);
    this.menuDungeon = new Dungeon();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      Sound.init();
      if (!Music.track) Music.play(this.game ? (this.game.lobby ? 'lobby' : 'battle') : 'menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // the browser eats the Esc that releases a pointer lock, so treat losing the lock as "pause"
    document.addEventListener('pointerlockchange', () => {
      if (!Input.locked && this.state === 'playing') this.pause();
    });

    this.applyDevShortcuts();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const s = Math.min(window.innerWidth / CONFIG.screen.width, window.innerHeight / CONFIG.screen.height);
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  },

  applyDevShortcuts() {
    const params = new URLSearchParams(location.search);
    const classId = params.get('class');
    if (classId && CONFIG.classes[classId]) this.classId = classId;
    if (params.has('lobby')) return this.enterLobby(true);
    // ?run=graveyard (set dungeon) or ?run=random, optionally &stage=2 / 3
    const run = params.get('run');
    if (run) {
      this.startDungeonRun(run === 'random' ? { mode: 'random' } : { mode: 'set', theme: CONFIG.themes[run] ? run : 'graveyard' });
      const stage = parseInt(params.get('stage'), 10);
      for (let s = 1; s < Math.min(3, stage || 1); s++) this.game.run.nextStage();
      return;
    }
    if (!classId || !CONFIG.classes[classId]) return;
    if (params.has('practice')) return this.startPractice(classId);
    this.startRun();
    if (params.has('boss')) this.game.director.skipTo(CONFIG.waves.length + 1, params.get('boss'));
    else if (params.get('wave')) this.game.director.skipTo(parseInt(params.get('wave'), 10));
  },

  get events() {
    return {
      onGameOver: (stats) => this.endGame(false, stats),
      onVictory: (stats) => this.endGame(true, stats),
      onInteract: (station) => this.interact(station),
      onToast: (text) => Menus.toast(text, '#ffe680'),
      onNpc: (kind, run) => this.talkTo(kind, run),
    };
  },

  // ---------- lobby ----------

  /** The hub between runs: walk around as the chosen hero and use the stations. */
  enterLobby(welcome = false) {
    Sound.init();
    this.practiceMode = false;
    this.game = new Game(this.classId, this.events, { lobby: true, welcome });
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
    Music.stop();
    Music.play('lobby');
  },

  /** A lobby station was used (E). */
  interact(station) {
    switch (station.kind) {
      case 'hero': this.openPanel(); Menus.showHero(station.id, this.game.player.classId); break;
      case 'workshop': this.openPanel('workshop'); break;
      case 'practice': this.startPractice(); break;
      case 'gate': this.openPanel(); Menus.showDungeonView('modes'); break;
      case 'legend': this.openPanel(); Menus.showLegend(); break;
      case 'bestiary': this.openPanel(); Bestiary.open(); break;
    }
  },

  /** Talking to a dungeon NPC: a dialogue first, which can lead on to the shop. */
  talkTo(kind, run) {
    this.openPanel();
    if (kind === 'shopkeeper') {
      Dialog.open({
        name: 'MIRA', frames: Sprites.npcs.shopkeeper,
        text: run.coins > 0
          ? choose(["Oh! A customer! Welcome to Mira's Curios, traveller. What would you like?", 'Back again? I saved the good stuff for you. What will it be?'])
          : "Welcome, welcome! Hmm... your purse looks a little light. Still, have a look. What would you like?",
        options: [
          { label: 'Show me your wares', fn: () => Shop.open(run) },
          { label: 'Just looking', fn: () => Dialog.close() },
        ],
      });
    } else {
      Dialog.open({
        name: 'CHEF BRUNO', frames: Sprites.npcs.chef,
        text: "Ah, an adventurer! The kitchen isn't quite ready yet... come back soon and I'll cook you something special!",
        options: [{ label: "Can't wait!", fn: () => Dialog.close() }],
      });
    }
  },

  /** Lobby panels freeze the lobby until closed (Back button or Esc). */
  openPanel(name = null) {
    this.state = 'panel';
    if (name) Menus.show(name);
  },

  closePanel() {
    if (this.state !== 'panel') return;
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
  },

  pickHero(classId) {
    if (this.game && this.game.lobby && this.game.player.classId !== classId) this.game.swapHero(classId);
    this.classId = classId;
    this.closePanel();
  },

  // ---------- runs ----------

  /** The test dungeon: the original wave arena. */
  startRun() {
    this.lastRun = null;
    this.practiceMode = false;
    this.startGame(this.classId);
  },

  /** A dungeon run: { mode: 'set', theme } or { mode: 'random' }. */
  startDungeonRun(run) {
    this.lastRun = run;
    this.practiceMode = false;
    this.startGame(this.classId);
  },

  /** End screen "Try Again": the same kind of run again. */
  retry() {
    if (this.lastRun) this.startDungeonRun(this.lastRun);
    else this.startRun();
  },

  startPractice(classId = this.classId) {
    this.classId = classId;
    this.practiceMode = true;
    this.startGame(classId);
  },

  startGame(classId) {
    Sound.init();
    this.classId = classId;
    this.game = new Game(classId, this.events, {
      practice: this.practiceMode ? this.practiceOptions : null,
      run: this.practiceMode ? null : this.lastRun,
    });
    Menus.refreshPractice(this.practiceOptions);
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
    Music.stop();
    Music.play('battle');
  },

  endGame(won, stats) {
    this.state = 'ended';
    Menus.showEnd(won, stats);
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Menus.showPause(!!this.game.lobby);
  },

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
  },

  quitToMenu(screen = 'menu') {
    this.state = 'menu';
    this.game = null;
    Menus.show(screen);
    Music.stop();
    Music.play('menu');
  },

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000 || 0, 1 / 30);
    this.lastTime = now;

    if (Input.wasPressed('Escape')) {
      if (Menus.settingsOpen) {
        if (Menus.confirmOpen) Menus.hideConfirm();
        else Menus.requestCloseSettings();
      }
      else if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'panel') this.closePanel();
    }
    if (Input.pressed('music')) Menus.handleAction('toggleMusic', this);
    // the interact key finishes a dialogue line that's still typing
    if (this.state === 'panel' && Dialog.isOpen && Input.pressed('interact')) Dialog.finish();
    // bestiary pages: arrows, A / D, or the movement keys
    if (this.state === 'panel' && Bestiary.isOpen) {
      if (Input.wasPressed('ArrowLeft') || Input.pressed('left')) Bestiary.flip(-1);
      if (Input.wasPressed('ArrowRight') || Input.pressed('right')) Bestiary.flip(1);
    }

    // lock the pointer while playing (aim uses Settings sensitivity); free it for menus
    if (this.state === 'playing') {
      if (!Input.locked && (Input.mouse.leftPressed || Input.mouse.rightPressed)) Input.lockPointer();
    } else Input.unlockPointer();

    if (this.state === 'playing') this.game.update(dt);

    if (this.game) {
      this.game.render(this.ctx);
      if (this.state === 'playing') HUD.drawCrosshair(this.ctx, Input.mouse.x, Input.mouse.y);
    } else {
      this.renderMenuBackground(dt);
    }
    Menus.drawPreviews(now / 1000);
    this.practicePanel.classList.toggle('hidden', !(this.state === 'playing' && this.game && this.game.practice));

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  /** Slow pan across the dungeon behind the menus. */
  renderMenuBackground(dt) {
    this.menuTime += dt;
    const d = this.menuDungeon;
    const ctx = this.ctx;
    const x = (Math.sin(this.menuTime * 0.08) * 0.5 + 0.5) * (d.width - CONFIG.screen.width);
    ctx.save();
    ctx.translate(-Math.round(x), -40);
    d.draw(ctx);
    d.drawTorches(ctx, this.menuTime);
    ctx.restore();
  },
};

window.addEventListener('load', () => App.init());
