// Entry point: builds sprites, wires up screens and runs the main loop.
//
// Dev shortcuts (add to the URL):
//   ?class=mage          skip menus and start as a class
//   ?class=rogue&wave=3  start at a given wave
//   ?class=warrior&boss  start at a random boss (&boss=golem or &boss=phantom to pick)
//   ?class=mage&practice start in the practice range
//   ?lobby               start in the lobby (&class=... to pick the hero; &panel=hero:mage or &panel=workshop opens a station)
//   ?run=graveyard       start a set-dungeon run (?run=random for random mode; &stage=2 or 3 to skip ahead)
//   ?run=graveyard&visit=special&special=blacksmith   start inside a room type (shop, special, boss...),
//                        optionally forcing which special room it is

const App = {
  state: 'menu',     // menu | playing (lobby or run) | panel (lobby station open) | paused | ended
  game: null,
  classId: 'warrior',   // hero used in the lobby and runs (picked at a lobby statue)
  lastTime: 0,
  menuTime: 0,
  practiceMode: false,
  lastRun: null,        // the dungeon run picked at the gate (null = test dungeon)
  mp: null,             // the multiplayer Session while in an online game
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
    buildPropSprites();
    buildPotionSprites();
    buildIconSprites();

    Input.init(this.canvas);
    Menus.init(this);
    this.menuDungeon = new Dungeon();

    Display.init(this.stage);

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      Sound.init();
      if (!Music.track) Music.play(this.game ? (this.game.lobby ? 'lobby' : 'battle') : 'menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // the browser eats the Esc that releases a pointer lock, so treat losing the lock as "pause"
    document.addEventListener('pointerlockchange', () => {
      if (!Input.locked && !Input.freeMouse && this.state === 'playing') this.pause();
    });

    this.applyDevShortcuts();
    requestAnimationFrame((t) => this.loop(t));
  },

  applyDevShortcuts() {
    const params = new URLSearchParams(location.search);
    const classId = params.get('class');
    if (classId && CONFIG.classes[classId]) this.classId = classId;
    if (params.has('lobby')) {
      this.enterLobby(true);
      // &panel=hero:mage (or workshop) opens that lobby station's panel
      const [panel, arg] = (params.get('panel') || '').split(':');
      if (panel === 'hero') { this.openPanel(); Menus.showHero(CONFIG.classes[arg] ? arg : this.classId, this.classId); }
      else if (panel) this.openPanel(panel);
      return;
    }
    // ?run=graveyard (set dungeon) or ?run=random, optionally &stage=2 / 3
    const run = params.get('run');
    if (run) {
      // &special=blacksmith makes every special room that kind
      const special = params.get('special');
      if (special && SPECIAL_INFO[special]) CONFIG.run.specials = [special];
      this.startDungeonRun(run === 'random' ? { mode: 'random' } : { mode: 'set', theme: CONFIG.themes[run] ? run : 'graveyard' });
      const stage = parseInt(params.get('stage'), 10);
      for (let s = 1; s < Math.min(3, stage || 1); s++) this.game.run.nextStage();
      // &visit=shop (or special, boss...) puts the hero just inside that room
      const visit = params.get('visit');
      const room = visit && this.game.run.floor.rooms.find((r) => r.type === visit);
      if (room) {
        const p = this.game.localPlayer;
        p.x = room.cx;
        p.y = room.cy + 3 * this.game.run.floor.T;
        this.game.camera.follow(p.x, p.y - 16, 0, this.game.run.floor.width, this.game.run.floor.height, true);
      }
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
      onInteract: (station, hero) => this.interact(station, hero),
      onToast: (text) => Menus.toast(text, '#ffe680'),
      onNpc: (kind, run, hero) => this.talkTo(kind, run, hero),
      onPurchase: (hero, what, ok) => Shop.onPurchase(hero, what, ok),
    };
  },

  /**
   * A gameplay command from this screen's player (hero pick, purchase, ready up...).
   * Single player applies it now; multiplayer sends it through the host so every
   * machine applies it on the same tick.
   */
  command(cmd) {
    if (this.mp) this.mp.command(cmd);
    else if (this.game) this.game.applyCommand(cmd, this.game.localId);
  },

  // ---------- lobby ----------

  /** The hub between runs: walk around as the chosen hero and use the stations. */
  enterLobby(welcome = false) {
    if (this.mp) {
      if (this.mp.isHost) this.mp.returnToLobby();
      return;
    }
    Sound.init();
    this.practiceMode = false;
    this.game = new Game(this.classId, this.events, { lobby: true, welcome });
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
    Music.stop();
    Music.play('lobby');
  },

  /** A lobby station was used (E). Menus only open on the screen of the hero who used it. */
  interact(station, hero) {
    if (hero && hero !== this.game.localPlayer) return;
    switch (station.kind) {
      case 'hero': this.openPanel(); Menus.showHero(station.id, this.game.localPlayer.classId); break;
      case 'workshop': this.openPanel('workshop'); break;
      case 'practice':
        if (this.mp) Menus.toast('THE PRACTICE RANGE IS SINGLE PLAYER ONLY', '#ffe680');
        else this.startPractice();
        break;
      case 'gate': this.useGate(); break;
      case 'legend': this.openPanel(); Menus.showLegend(); break;
      case 'bestiary': this.openPanel(); Bestiary.open(); break;
    }
  },

  /**
   * The dungeon gate. Single player: pick a dungeon. Multiplayer: only the host
   * can use it - the first time it starts a ready check for everyone, and once
   * everyone is ready the host picks the dungeon.
   */
  useGate() {
    if (!this.mp) { this.openGatePicker(); return; }
    if (!this.mp.isHost) { Menus.toast('ONLY THE HOST CAN CHOOSE THE DUNGEON', '#ffe680'); return; }
    if (!this.game.readyCheck) { this.command({ type: 'readyCheck' }); return; }
    if (this.game.allReady) this.openGatePicker();
    else Menus.toast('WAITING FOR EVERYONE TO READY UP', '#ffe680');
  },

  openGatePicker() {
    this.openPanel();
    Menus.showDungeonView('modes');
  },

  /** Talking to a dungeon NPC: a dialogue first, which can lead on to the shop. */
  talkTo(kind, run, hero) {
    if (hero && hero !== this.game.localPlayer) return;
    this.openPanel();
    if (kind === 'shopkeeper') {
      Dialog.open({
        name: 'MIRA', frames: Sprites.npcs.shopkeeper,
        text: this.game.localPlayer.coins > 0
          ? choose(["Oh! A customer! Welcome to Mira's Potions, traveller. Something to drink?", 'Back again? I brewed a fresh batch. What will it be?'])
          : "Welcome, welcome! Hmm... your purse looks a little light. Still, have a look at my potions!",
        options: [
          { label: 'Show me your potions', fn: () => Shop.open(run, 'potions') },
          { label: 'Just looking', fn: () => Dialog.close() },
        ],
      });
    } else if (kind === 'enchanter') {
      const st = run.shopState(this.game.localPlayer);
      Dialog.open({
        name: 'BRAM', frames: Sprites.npcs.enchanter,
        text: st.bought
          ? 'You have chosen your enchantment, adventurer. Survive this stage, and I will have new ones for you.'
          : 'Ah, a seeker of power. I have three enchantments for you - choose one. Do not like them? A few coins and I will show you others.',
        options: [
          { label: 'Show me the enchantments', fn: () => Shop.open(run, 'upgrades') },
          { label: 'Not now', fn: () => Dialog.close() },
        ],
      });
    } else {
      Dialog.open({
        name: 'CHEF BRUNO', frames: Sprites.npcs.chef,
        text: "Welcome to my restaurant, adventurer! The kitchen isn't quite ready yet... come back soon and I'll cook you something special!",
        options: [{ label: "Can't wait!", fn: () => Dialog.close() }],
      });
    }
  },

  /** Panels freeze the world in single player; in multiplayer the world keeps going. */
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
    this.command({ type: 'hero', classId });
    this.classId = classId;
    this.closePanel();
  },

  // ---------- multiplayer ----------

  openMultiplayer() {
    Menus.showMultiplayer(Settings.data.name || '');
  },

  /** Name from the multiplayer screen (saved for next time). */
  mpName() {
    const typed = (document.getElementById('mp-name').value || '').trim().slice(0, 14);
    const name = typed || `Hero${Math.floor(nativeRandom() * 900 + 100)}`;
    Settings.data.name = name;
    Settings.save();
    return name;
  },

  get mpEvents() {
    return {
      onScene: (game, kind) => {
        this.game = game;
        this.state = 'playing';
        Input.reset();
        Menus.show(null);
        Music.stop();
        Music.play(kind === 'lobby' ? 'lobby' : 'battle');
      },
      onRejected: (reason) => this.leaveMultiplayer(reason),
      onDesync: () => Sound.play('uiClick'),   // the notice itself stays on screen (drawNetStatus)
    };
  },

  hostMultiplayer() {
    Sound.init();
    const name = this.mpName();
    Menus.mpStatus('Opening a lobby...');
    const s = new Session({ isHost: true, name, classId: this.classId, transport: Net.transport(), events: this.mpEvents, gameEvents: this.events });
    Net.host({
      onOpen: (code) => {
        this.mp = s;
        s.hostStart(code);
      },
      onData: (peer, msg) => s.onMessage(peer, msg),
      onLeave: (peer) => {
        const who = s.roster.find((r) => r.id === s.peers.get(peer));
        s.onPeerLeft(peer);
        if (who) Menus.toast(`${who.name.toUpperCase()} LEFT`, '#ffe680');
      },
      onError: (text) => { Menus.mpStatus(text); Net.close(); this.mp = null; },
    });
  },

  joinMultiplayer() {
    Sound.init();
    const name = this.mpName();
    const code = (document.getElementById('mp-code').value || '').trim().toUpperCase();
    if (code.length !== CONFIG.multiplayer.codeLength) {
      Menus.mpStatus(`Enter the ${CONFIG.multiplayer.codeLength}-letter room code.`);
      return;
    }
    Menus.mpStatus(`Connecting to ${code}...`);
    const s = new Session({ isHost: false, name, classId: this.classId, transport: Net.transport(), events: this.mpEvents, gameEvents: this.events });
    this.mp = s;
    Net.join(code, {
      onOpen: () => { Menus.mpStatus('Connected! Joining the lobby...'); s.hello(); },
      onData: (peer, msg) => s.onMessage(peer, msg),
      onClose: () => { if (this.mp === s) this.leaveMultiplayer('The host closed the lobby.'); },
      onError: (text) => {
        if (this.mp !== s) return;
        this.mp = null;
        Net.close();
        Menus.mpStatus(text);
      },
    });
  },

  /** Leaves (or closes, for the host) the multiplayer game and goes back to the multiplayer screen. */
  leaveMultiplayer(reason = '') {
    const s = this.mp;
    this.mp = null;
    if (s) s.close();
    Net.close();
    this.state = 'menu';
    this.game = null;
    Music.stop();
    Music.play('menu');
    this.openMultiplayer();
    Menus.mpStatus(reason);
  },

  // ---------- runs ----------

  /** The test dungeon: the original wave arena. */
  startRun() {
    if (this.mp) { if (this.mp.isHost) this.mp.startRun(null); return; }
    this.lastRun = null;
    this.practiceMode = false;
    this.startGame(this.classId);
  },

  /** A dungeon run: { mode: 'set', theme } or { mode: 'random' }. */
  startDungeonRun(run) {
    if (this.mp) { if (this.mp.isHost) this.mp.startRun(run); return; }
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
    Menus.showEnd(won, stats, this.mp ? (this.mp.isHost ? 'host' : 'client') : null);
  },

  /** Single player pauses; in multiplayer the menu opens but the world keeps going. */
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Menus.showPause(!!this.game.lobby, !!this.mp, !!(this.mp && this.mp.isHost));
  },

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
  },

  quitToMenu(screen = 'menu') {
    if (this.mp) return this.leaveMultiplayer('You left the game.');
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

    // the cursor key swaps the crosshair for the normal mouse pointer (and back)
    if (this.state === 'playing' && Input.pressed('cursor')) {
      const free = Input.toggleFreeMouse();
      Menus.toast(free ? 'MOUSE: POINTER' : 'MOUSE: CROSSHAIR', '#ffe680');
    }
    this.canvas.classList.toggle('free-cursor', Input.freeMouse);

    // lock the pointer while playing (aim uses Settings sensitivity); free it for menus
    if (this.state === 'playing') {
      if (!Input.freeMouse && !Input.locked && (Input.mouse.leftPressed || Input.mouse.rightPressed)) Input.lockPointer();
    } else Input.unlockPointer();

    if (this.mp) {
      // multiplayer: the session steps the shared world whatever menu is open here;
      // this screen's hero only gets input while nothing is open
      const active = this.state === 'playing';
      this.mp.pollLocal(active);
      this.mp.update(dt, active);
      if (this.mp && this.mp.game) this.game = this.mp.game;
    } else if (this.state === 'playing') {
      this.game.update(dt);
    }
    Shop.refresh();
    Menus.updateReadyPanel(this);

    if (this.game) {
      this.game.render(this.ctx);
      if (this.mp) this.drawNetStatus(this.ctx);
      if (this.state === 'playing' && !Input.freeMouse) HUD.drawCrosshair(this.ctx, Input.mouse.x, Input.mouse.y);
    } else {
      this.renderMenuBackground(dt);
    }
    Menus.drawPreviews(now / 1000);
    this.practicePanel.classList.toggle('hidden', !(this.state === 'playing' && this.game && this.game.practice));

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  /**
   * Multiplayer trouble, spelled out so it's clear what's wrong: an out-of-sync
   * notice (a game problem: the simulations drifted apart) in red, and
   * connection warnings (a network problem: messages arriving late) in yellow.
   */
  drawNetStatus(ctx) {
    const s = this.mp;
    const lines = [];
    if (s.desync) {
      lines.push({ text: s.isHost ? `OUT OF SYNC WITH ${s.desync.who.toUpperCase()}` : 'YOUR GAME IS OUT OF SYNC WITH THE HOST', color: '#ff6a6a', size: 8 });
      lines.push({ text: 'The games drifted apart - a game problem, not your connection.', color: '#f4ead7', size: 6 });
      lines.push({ text: s.isHost ? 'Fix: Esc > Return to Lobby to resync everyone.' : 'Fix: ask the host to return to the lobby to resync.', color: '#ffe680', size: 6 });
    }
    for (const w of s.netWarnings()) lines.push({ text: w, color: '#ffd34a', size: 7 });
    if (!lines.length) return;
    const y0 = 96;
    const h = lines.length * 13 + 8;
    ctx.fillStyle = 'rgba(14, 8, 22, 0.82)';
    ctx.fillRect(CONFIG.screen.width / 2 - 250, y0 - 10, 500, h);
    ctx.strokeStyle = s.desync ? '#ff6a6a' : '#ffd34a';
    ctx.strokeRect(CONFIG.screen.width / 2 - 250 + 0.5, y0 - 9.5, 499, h - 1);
    lines.forEach((l, i) => HUD.text(ctx, l.text, CONFIG.screen.width / 2, y0 + i * 13, { size: l.size, align: 'center', color: l.color }));
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
