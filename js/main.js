// Entry point: builds sprites, wires up screens and runs the main loop.
//
// Dev shortcuts (add to the URL):
//   ?class=mage          skip menus and start as a class
//   ?class=rogue&wave=3  start at a given wave
//   ?class=warrior&boss  start at a random boss (&boss=golem or &boss=phantom to pick)
//   ?class=mage&practice start in the practice range
//   ?lobby               start in the lobby (&class=... to pick the hero; &panel=hero:mage or &panel=workshop opens a station)
//   ?run=graveyard       start a set-dungeon run (?run=castle, or ?run=random for random mode; &stage=2 or 3 to skip ahead)
//   ?run=graveyard&visit=special&special=blacksmith   start inside a room type (shop, special, boss...),
//                        optionally forcing which special room it is

const App = {
  state: 'menu',     // menu | playing (lobby or run) | panel (lobby station open) | paused | ended
  game: null,
  classId: 'warrior',   // hero used in the lobby and runs (picked at a lobby statue)
  lastTime: 0,
  practiceMode: false,
  lastRun: null,        // the dungeon run picked at the gate (null = test dungeon)
  mp: null,             // the multiplayer Session while in an online game
  // practice-range cheats, kept when switching hero
  practiceOptions: { god: false, infiniteMana: false, infiniteEnergy: false, noCooldowns: false },

  async init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.stage = document.getElementById('stage');
    this.practicePanel = document.getElementById('practice-panel');
    // fit the stage to the window before anything else, so it's never shown small in a corner
    Display.init(this.stage);

    // the sprites take a moment to draw: one batch per frame, so the loader's fire keeps burning
    const steps = [
      ['Forging the heroes...', buildHeroSprites],
      ['Raising the dead...', () => { buildEnemySprites(); buildBossSprites(); buildPhantomSprites(); }],
      ['Sharpening the blades...', () => { buildItemSprites(); buildGraveyardSprites(); }],   // graveyard after the items: it adds to Sprites.projectiles
      ['Crowning the court...', () => { buildCastleSprites(); buildQueenSprites(); buildKingSprites(); buildRoyalSetPieces(); buildCastleDecor(); }],
      ['Furnishing the keep...', () => { buildNpcSprites(); buildPropSprites(); buildObstacleSprites(); }],   // obstacles after the cover (they add to Sprites.cover)
      ['Brewing potions...', () => { buildPotionSprites(); buildIconSprites(); buildRocketeerSprites(); buildBakerSprites(); buildUpgradeSprites(); }],   // the rocketeer's and baker's gear add to the weapons, items and icons
      ['Rehearsing the battles...', () => MenuShowcase.start(0)],
    ];
    const started = performance.now();
    for (let i = 0; i < steps.length; i++) {
      this.loading(steps[i][0], i / steps.length);
      await new Promise((r) => setTimeout(r, 30));   // a timer, not a frame: keeps loading in a background tab
      steps[i][1]();
    }
    this.loading('Ready!', 1);
    await document.fonts?.ready;
    await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - started))));

    Input.init(this.canvas);
    Menus.init(this);

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
    // an online game keeps going while this tab is in the background (see backgroundTicks)
    document.addEventListener('visibilitychange', () => this.backgroundTicks(document.hidden));

    this.applyDevShortcuts();
    requestAnimationFrame((t) => this.loop(t));
    const loader = document.getElementById('loader');
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 700);
  },

  /** Startup progress: the loader's label and bar (0-1). */
  loading(text, k) {
    document.getElementById('loader-text').textContent = text;
    document.getElementById('loader-fill').style.width = `${Math.round(k * 100)}%`;
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
      onBossArena: (boss) => this.startBossPractice(boss),
      onPracticeReturn: () => this.startPractice(),
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
      case 'potions': this.openPanel(); PotionGuide.open(); break;
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
      const n = Object.keys(this.game.localPlayer.upgradeLevels).length;
      Dialog.open({
        name: 'BRAM', frames: Sprites.npcs.enchanter,
        text: n > 1
          ? 'Back for more power? Every enchantment I bind to you costs a little more than the last... but oh, is it worth it.'
          : 'Ah, a seeker of power. I keep three enchantments on my table - buy as many as your purse allows. Do not like them? A few coins and I will show you others.',
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
    if (this.state !== 'panel' || Shop.locked) return;   // (the stage's free upgrade has to be chosen first)
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
      onError: (text) => {
        // once the game is under way, end it properly (never leave a world running with no session)
        if (this.mp === s && s.game) return this.leaveMultiplayer(text);
        Menus.mpStatus(text);
        Net.close();
        if (this.mp === s) this.mp = null;
      },
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
    // already connecting: a second click mustn't start a second connection (it joined twice)
    if (this.mp && !this.mp.isHost && !this.mp.game) { Menus.mpStatus(`Still connecting to ${code}...`); return; }
    Menus.mpStatus(`Connecting to ${code}...`);
    const s = new Session({ isHost: false, name, classId: this.classId, transport: Net.transport(), events: this.mpEvents, gameEvents: this.events });
    this.mp = s;
    Net.join(code, {
      onOpen: () => { Menus.mpStatus('Connected! Joining the lobby...'); s.hello(); },
      onData: (peer, msg) => s.onMessage(peer, msg),
      onClose: () => { if (this.mp === s) this.leaveMultiplayer('The host closed the lobby.'); },
      onError: (text) => {
        if (this.mp !== s) return;
        if (s.game) return this.leaveMultiplayer(text);
        this.mp = null;
        Net.close();
        Menus.mpStatus(text);
      },
    });
  },

  /**
   * Browsers stop animation frames in a background tab, and the game loop runs on them, so
   * when a player (above all the host, who steps everyone's game) alt-tabs, the online game
   * would stall for everybody. While the tab is hidden a tiny worker ticks ~60 times a second
   * (workers' timers aren't paused) and keeps the session stepping, sending and receiving;
   * nothing is drawn. The animation loop takes over again when the tab comes back.
   */
  backgroundTicks(hidden) {
    if (!hidden || !this.mp) {
      if (this.bgTicker) { this.bgTicker.stop(); this.bgTicker = null; }
      return;
    }
    if (this.bgTicker) return;
    let last = performance.now();
    const tick = () => {
      if (!this.mp || !document.hidden) return this.backgroundTicks(false);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.mp.update(dt, false);   // no input from this screen while it's hidden
      if (this.mp && this.mp.game) this.game = this.mp.game;
    };
    try {
      const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 1000 / 60);'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = tick;
      this.bgTicker = { stop: () => { worker.terminate(); URL.revokeObjectURL(url); } };
    } catch (e) {
      // no workers here: a plain timer (browsers slow it down in the background, but it still ticks)
      const id = setInterval(tick, 1000 / 60);
      this.bgTicker = { stop: () => clearInterval(id) };
    }
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

  /**
   * Boss practice (from the practice range's portal): a small entrance room leading to
   * that boss's own room, at the stage it's normally met. Its portal (or "Try again")
   * brings you back.
   */
  startBossPractice(boss) {
    this.lastRun = { mode: 'set', theme: DungeonRun.bossTheme(boss), practiceBoss: boss };
    this.practiceMode = false;
    this.startGame(this.classId);
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
      // the practice cheats also work in a boss arena opened from the range
      cheats: this.practiceMode || this.lastRun?.practiceBoss ? this.practiceOptions : null,
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
    Menus.showPause(!!this.game.lobby, !!this.mp, !!(this.mp && this.mp.isHost), this.game.localPlayer);
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
    this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
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

    // the bag takes mouse clicks on its slots before the hero sees them
    HUD.handleBagMouse(this.state === 'playing' && this.game ? this.game.localPlayer : null);

    if (this.mp) {
      // multiplayer: the session steps the shared world whatever menu is open here;
      // this screen's hero only gets input while nothing is open
      const active = this.state === 'playing';
      this.mp.pollLocal(active);
      this.mp.update(dt, active);
      if (this.mp && this.mp.game) this.game = this.mp.game;
    } else if (this.state === 'playing') {
      // an online game whose session is gone would read this keyboard for every hero: end it instead
      if (this.game.multiplayer) this.leaveMultiplayer('Lost the connection to the game.');
      else this.game.update(dt);
    }
    // entering a stage: this screen's hero gets to choose a free upgrade (once the stage's banner has had a moment)
    const run = this.game?.run;
    if (this.state === 'playing' && run && run.stageTime > 0.8 && !this.game.localPlayer.dead && run.needsPick(this.game.localPlayer)) {
      this.openPanel();
      Shop.open(run, 'pick');
    }
    Shop.refresh();
    Menus.updateReadyPanel(this);

    if (this.game) {
      this.game.render(this.ctx);
      if (this.mp) this.drawNetStatus(this.ctx);
      if (this.state === 'playing' && !Input.freeMouse) HUD.drawCrosshair(this.ctx, Input.mouse.x, Input.mouse.y);
    } else {
      MenuShowcase.update(dt);
      MenuShowcase.render(this.ctx);
    }
    Menus.drawPreviews(now / 1000);
    const g = this.state === 'playing' && this.game;
    this.practicePanel.classList.toggle('hidden', !(g && g.cheats));
    this.practicePanel.classList.toggle('arena', !!(g && g.cheats && !g.practice));

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
};

window.addEventListener('load', () => App.init());
