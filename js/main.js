// Entry point: builds sprites, wires up screens and runs the main loop.
//
// Dev shortcuts (add to the URL):
//   ?class=mage          skip menus and start as a class
//   ?class=rogue&wave=3  start at a given wave
//   ?class=warrior&boss  start at a random boss (&boss=golem or &boss=phantom to pick)
//   ?class=mage&practice start in the practice range
//   ?touch               use the phone / tablet touch controls on this computer
//   ?lobby               start in the lobby (&class=... to pick the hero; &panel=hero:mage or &panel=workshop opens a station)
//   ?run=graveyard       start a set-dungeon run (?run=castle, or ?run=random for random mode; &stage=2 or 3 to skip ahead)
//   ?run=graveyard&visit=special&special=blacksmith   start inside a room type (shop, special, boss...),
//                        optionally forcing which special room it is
//
// In game, ` opens the cheat console (gems, coins, revive, kill, upgrades): see js/game/cheats.js

const App = {
  state: 'menu',     // menu | playing (lobby or run) | panel (lobby station open) | paused | ended | cheats (the cheat console is open)
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
    this.stage = document.getElementById('stage');
    this.practicePanel = document.getElementById('practice-panel');
    // fit the stage to the window before anything else, so it's never shown small in a corner
    Display.init(this.stage, this.canvas);

    // the sprites take a moment to draw: one batch per frame, so the loader's fire keeps burning
    const steps = [
      ['Forging the heroes...', buildHeroSprites],
      ['Raising the dead...', () => { buildEnemySprites(); buildBossSprites(); buildPhantomSprites(); buildDeathbringerSprites(); buildManorSprites(); buildVaultSprites(); }],
      ['Sharpening the blades...', () => { buildItemSprites(); buildGraveyardSprites(); }],   // graveyard after the items: it adds to Sprites.projectiles
      ['Crowning the court...', () => { buildCastleSprites(); buildQueenSprites(); buildKingSprites(); buildRoyalSetPieces(); buildCastleDecor(); buildRuinsSprites(); buildGuardianSprites(); }],
      ['Furnishing the keep...', () => { buildNpcSprites(); buildPropSprites(); buildPetSprites(); buildObstacleSprites(); buildBarrelSprites(); }],   // obstacles after the cover (they add to Sprites.cover)
      ['Brewing potions...', () => { buildPotionSprites(); buildIconSprites(); buildRocketeerSprites(); buildBakerSprites(); buildUpgradeSprites(); buildForgeSprites(); }],   // the rocketeer's and baker's gear add to the weapons, items and icons
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
    this.showLogo();
    await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - started))));

    Input.init(this.canvas);
    Touch.init(this, this.canvas);
    Menus.init(this);
    Cheats.init(this);
    Chat.init(this);

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

  /**
   * The logo (built now the Alagard font is in, it's lettered with it): it takes the main menu's
   * title, its torches flickering through Sprites.logoFrames, and its icon goes on the browser tab.
   * The title's text stays as the canvas's accessible label.
   */
  showLogo() {
    buildLogo();
    const h1 = document.querySelector('#screen-menu .title');
    const cv = document.createElement('canvas');
    cv.width = Sprites.logo.width;
    cv.height = Sprites.logo.height;
    cv.className = 'logo';
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Dungeon Run');
    const ctx = cv.getContext('2d');
    let f = 0;
    const tick = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(Sprites.logoFrames[f], 0, 0);
      f = (f + 1) % Sprites.logoFrames.length;
      // a little uneven, the way fire is
      if (cv.isConnected) setTimeout(tick, 90 + Math.random() * 70);
    };
    h1.replaceChildren(cv);
    tick();
    const link = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
    link.href = Sprites.logoIcon.toDataURL();
  },

  /** Startup progress: the loader's label and bar (0-1). */
  loading(text, k) {
    document.getElementById('loader-text').textContent = text;
    document.getElementById('loader-fill').style.width = `${Math.round(k * 100)}%`;
  },

  applyDevShortcuts() {
    const params = new URLSearchParams(location.search);
    // ?touch: the phone controls on this computer (not saved)
    if (params.has('touch')) {
      Settings.data.controls = 'touch';
      document.body.classList.add('touch');
    }
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
      // the revive cheat undid a party wipe: back into the game from the end screen
      onRevived: () => {
        if (this.state !== 'ended') return;
        this.state = Cheats.isOpen ? 'cheats' : 'playing';
        Menus.show(null);
      },
      onVictory: (stats) => this.endGame(true, stats),
      onInteract: (station, hero) => this.interact(station, hero),
      onToast: (text) => Menus.toast(text, '#ffe680'),
      onGems: (n) => Profiles.addGems(n),   // banked on this machine's profile (in multiplayer every machine gets the event)
      onNpc: (kind, run, hero, prop) => this.talkTo(kind, run, hero, prop),
      onPurchase: (hero, what, ok) => Shop.onPurchase(hero, what, ok),
      onSpecial: (hero, what, ok, info) => this.onSpecial(hero, what, ok, info),
      onStageStart: (run) => this.saveRun(run),
      // (in multiplayer every machine gets these; only the host moves the party)
      onBossArena: (boss) => (this.mp ? this.mp.startBossPractice(boss) : this.startBossPractice(boss)),
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

  /** Host, mid-run: rebuild the stage for everyone (back in sync), keeping the run's progress. */
  resyncRun() {
    if (!this.mp?.resyncRun()) return;
    Menus.toast('RESYNCING - PROGRESS KEPT', '#8cff9a');
    this.resume();
  },

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
      case 'pets': this.openPanel('pets'); Menus.showPets(); break;
      case 'practice':
        // multiplayer: the host takes the whole party there
        if (this.mp && !this.mp.isHost) Menus.toast('ONLY THE HOST CAN OPEN THE PRACTICE RANGE', '#ffe680');
        else this.startPractice();
        break;
      case 'gate': this.useGate(); break;
      case 'legend': this.openPanel(); Menus.showLegend(); break;
      case 'bestiary': this.openPanel(); Bestiary.open(); break;
      case 'potions': this.openPanel(); PotionGuide.open(); break;
      case 'tome': this.openPanel(); UpgradeGuide.open(); break;
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
  talkTo(kind, run, hero, stand = null) {
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
    } else if (kind === 'pawn') {
      Dialog.open({
        name: 'TOBIN', frames: Sprites.npcs.trader,
        text: choose([
          "Got more than you can carry? I'll take it off your hands. Can't pay what Mira and Bram charge, mind - a trader has to eat.",
          'Upgrades you regret, potions you won\'t drink... everything has a price at my stall. A small one, but a price!',
        ]),
        options: [
          { label: 'I have things to sell', fn: () => Shop.open(run, 'sell') },
          { label: 'Not today', fn: () => Dialog.close() },
        ],
      });
    } else if (kind === 'blacksmith') {
      const p = this.game.localPlayer;
      const item = FORGE_ITEMS[Forge.itemFor(p.classId)];
      Dialog.open({
        name: 'BORIN', frames: Sprites.npcs.blacksmith,
        text: p.forged
          ? `Back for another go? That ${Forge.title(p.forged)} isn't bad... but the anvil might give you better. The old one comes off and you can pick it up again if you like.`
          : `A ${CONFIG.classes[p.classId].name}, eh? I can forge a ${item.name} for that weapon of yours. What comes out of the fire is up to the anvil - I'll fit it on for you.`,
        options: [
          { label: 'Show me the forge', fn: () => Shop.open(run, 'forge') },
          { label: 'Not now', fn: () => Dialog.close() },
        ],
      });
    } else if (kind === 'darkTrader') {
      const p = this.game.localPlayer;
      const c = CONFIG.run.darkTrader;
      const can = p.hp > c.hp;
      Dialog.open({
        name: 'THE DARK TRADER', frames: Sprites.npcs.darkTrader,
        text: can
          ? `Mmm... so much life in you. Give me ${c.hp} of it, and I will give you something... interesting. A bottle, a power - perhaps one no one else dares to sell.`
          : `Too little life left in you for my tastes. Come back when you have more than ${c.hp} to spare.`,
        options: [
          can && { label: `Offer ${c.hp} HP`, fn: () => { Dialog.close(); this.command({ type: 'darkTrade' }); } },
          { label: 'Leave', fn: () => Dialog.close() },
        ].filter(Boolean),
      });
    } else if (kind === 'friendlyTrader') {
      Dialog.open({
        name: 'WREN', frames: Sprites.npcs.trader,
        text: "Welcome, friend! See my wares on the stands? Walk up to one you fancy, and give me one of your upgrades for it - you choose which. Fair's fair!",
        options: [{ label: "I'll have a look", fn: () => Dialog.close() }],
      });
    } else if (kind === 'tradeStand') {
      // one of Wren's stands: what's on it, and the hero's upgrades to choose from
      const p = this.game.localPlayer;
      const slot = stand && Specials.stall(run, stand.keeper, p)[stand.i];
      const why = !slot?.id ? 'NOTHING ON THIS STAND' : slot.traded ? 'ALREADY TRADED HERE'
        : p.upgradeLevels[slot.id] ? 'YOU ALREADY HAVE THAT ONE' : !Specials.tradeable(p).length ? 'YOU HAVE NO UPGRADES TO TRADE' : null;
      if (why) {
        Menus.toast(why, '#ffe680');
        Sound.play('denied');
        this.closePanel();
        return;
      }
      Shop.open(run, 'trade', stand.i);
    } else if (kind === 'mountTrader') {
      const p = this.game.localPlayer;
      const c = CONFIG.run.mount;
      const price = Specials.price(run, p, c.price);
      const key = Settings.prompt('mount');
      Dialog.open({
        name: 'DUSTY', frames: Sprites.npcs.mountTrader,
        text: p.horse
          ? `How's that horse treating you? Press [${key}] to hop on or off. Don't forget: no fancy ultimates in the saddle, and once you're off in a fight, you stay off till it's done.`
          : `Need a faster ride? ${price} coins and she's yours. She runs quicker than you, takes the hits for you (${c.hp} HP of 'em), and gets a bit of rest back every new stage. Press [${key}] to hop on and off - but no ultimates in the saddle, and in a fight you can hop off, not back on.`,
        options: [
          !p.horse && { label: `Buy a horse (${price} coins)`, fn: () => { Dialog.close(); this.command({ type: 'buyHorse' }); } },
          { label: p.horse ? 'Thanks, Dusty' : 'Not today', fn: () => Dialog.close() },
        ].filter(Boolean),
      });
    } else if (kind === 'helper') {
      const p = this.game.localPlayer;
      const pr = Specials.propHere(run, p, 'helper');
      const hire = pr?.hire || 'knight';
      const c = CONFIG.run.helpers[hire];
      const price = Specials.price(run, p, c.price);
      const hired = !!pr?.hired?.[p.netId || 'solo'];
      const who = {
        knight: 'a knight with a sword and shield. Blocks what comes at him and hits back hard.',
        archer: 'an archer. Keeps back and shoots whatever is coming for you.',
        priest: `a priest, with two acolytes. He heals you every ${c.healEvery} seconds, and they shoot beams of light at your enemies - mind, the acolytes are frail.`,
      }[hire];
      Dialog.open({
        name: 'PIP', frames: Sprites.npcs.helper,
        text: hired ? "They're with you now! They'll follow you all the way down - till they fall, anyway. Look after them!"
          : `Hello! Need a hand down there? For ${price} coins I'll send ${who} They'll follow you from stage to stage until they fall.`,
        options: [
          !hired && { label: `Hire the ${hire} (${price} coins)`, fn: () => { Dialog.close(); this.command({ type: 'hire' }); } },
          { label: hired ? 'Thanks, Pip!' : 'No thanks', fn: () => Dialog.close() },
        ].filter(Boolean),
      });
    } else {
      Dialog.open({
        name: 'CHEF BRUNO', frames: Sprites.npcs.chef,
        text: "Welcome to my restaurant, adventurer! The kitchen isn't quite ready yet... come back soon and I'll cook you something special!",
        options: [{ label: "Can't wait!", fn: () => Dialog.close() }],
      });
    }
  },

  /** A special room's trade went through (or didn't): told on the trader's screen only. */
  onSpecial(hero, what, ok, info) {
    if (!this.game || hero !== this.game.localPlayer) return;
    if (ok) {
      if (what === 'stand') {
        Menus.toast(`TRADED ${info.gave.name.toUpperCase()} FOR ${info.got.name.toUpperCase()}`, '#6cff7a');
        if (Shop.isOpen && Shop.mode === 'trade') this.closePanel();
      }
      return;
    }
    Sound.play('denied');
    const why = {
      dark: 'NOT ENOUGH HP TO TRADE',
      stand: 'THAT TRADE IS OFF',
      horse: hero.horse ? 'YOU ALREADY HAVE A HORSE' : 'NOT ENOUGH COINS',
      hire: 'NOT ENOUGH COINS',
    }[what];
    if (why) Menus.toast(why, '#e04545');
  },

  // ---------- saved runs (solo) ----------

  /** A solo dungeon run saves at the start of every stage (DungeonRun.start), on this profile. */
  saveRun(run) {
    const g = run.world;
    if (this.mp || g.multiplayer || !Profiles.current || run.practiceBoss || run.testBoss || !this.lastRun || this.lastRun.practiceBoss) return;
    RunSave.put({
      run: { mode: this.lastRun.mode, theme: this.lastRun.theme || null },
      classId: g.localPlayer.classId,
      snapshot: { ...run.snapshot(), saved: true },
      time: g.time, kills: g.kills, stats: { ...Game.statsOf(g.localPlayer) },
      savedAt: Date.now(),
    });
  },

  /** Main menu / the gate's Continue: the saved run picks up at the start of the stage it was saved on. */
  continueRun() {
    const save = RunSave.get();
    if (!save || this.mp) return;
    this.lastRun = { mode: save.run.mode, theme: save.run.theme || undefined };
    this.resumeSave = save;
    this.practiceMode = false;
    this.startGame(save.classId);
  },

  /** Starting a new run while one is saved gives the saved one up: it pays what a wipe at its stage would. */
  abandonSavedRun() {
    const save = RunSave.get();
    if (!save) return;
    RunSave.clear();
    const n = RunSave.gems(save);
    if (n > 0) {
      Profiles.addGems(n);
      Menus.toast(`YOUR SAVED RUN ENDED: +${n} GEMS`, '#8ac8ff');
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

  /**
   * Hero panel: buys hero `classId`'s next gem enhancement with this profile's gems. Every
   * machine is told (a command), so whoever is that hero right now takes it on straight away.
   */
  buyEnhancement(classId) {
    const t = Profiles.buyEnhancement(classId);
    if (!t) {
      Menus.toast('NOT ENOUGH GEMS', '#e04545');
      return;
    }
    Sound.play('pickup');
    Menus.toast(`${CONFIG.classes[classId].name.toUpperCase()}: ${t.name.toUpperCase()}`, '#8ac8ff');
    this.command({ type: 'enhance', classId, count: Profiles.enhancementCount(classId) });
    Menus.showEnhanced(classId);   // the stats it raised, before and after
  },

  /** Pet room: buys pet `kind` with this profile's gems; it comes along straight away (every machine is told). */
  buyPet(kind) {
    if (!Profiles.buyPet(kind)) {
      Menus.toast(Profiles.current ? 'NOT ENOUGH GEMS' : 'PICK A PROFILE FIRST', '#e04545');
      return;
    }
    Sound.play('pickup');
    Menus.toast(`NEW FRIEND: ${CONFIG.pets[kind].name.toUpperCase()}!`, CONFIG.pets[kind].color);
    this.command({ type: 'pet', kind });
    Menus.showPets();
  },

  /** Pet room: brings owned pet `kind` along (null leaves every pet at home). */
  choosePet(kind) {
    if (!Profiles.choosePet(kind)) return;
    Sound.play('pickup');
    this.command({ type: 'pet', kind });
    Menus.showPets();
  },

  // ---------- multiplayer ----------

  openMultiplayer() {
    Menus.showMultiplayer(Profiles.current?.name || Settings.data.name || '');
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
        Chat.hint();
      },
      onRejected: (reason) => this.leaveMultiplayer(reason),
      onDesync: () => Sound.play('uiClick'),   // the notice itself stays on screen (drawNetStatus)
      onChat: (msg) => Chat.receive(msg),
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
    Chat.reset();
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

  /** The old wave arena (only the ?class= dev shortcuts still use it; the gate's Test Dungeon is startTestDungeon). */
  startRun() {
    if (this.mp) { if (this.mp.isHost) this.mp.startRun(null); return; }
    this.lastRun = null;
    this.practiceMode = false;
    this.startGame(this.classId);
  },

  /** A dungeon run: { mode: 'set', theme } or { mode: 'random' }. */
  startDungeonRun(run) {
    if (this.mp) { if (this.mp.isHost) this.mp.startRun(run); return; }
    if (run.mode !== 'test') this.abandonSavedRun();   // (the test dungeon leaves a saved run alone)
    this.lastRun = run;
    this.practiceMode = false;
    this.startGame(this.classId);
  },

  /**
   * The gate's Test Dungeon: one floor with every kind of room (DungeonRun mode 'test'), the chosen boss
   * in its theme at the stage it's normally met, 9999 coins and the practice cheat panel; no gems, no save.
   */
  startTestDungeon(boss) {
    if (!Game.practiceBosses.includes(boss)) return;
    this.startDungeonRun({ mode: 'test', theme: DungeonRun.bossTheme(boss), testBoss: boss });
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

  /** The practice range. Multiplayer: the host takes everyone there (and only the host can). */
  startPractice(classId = this.classId) {
    if (this.mp) { this.mp.startPractice(this.practiceOptions); return; }
    this.classId = classId;
    this.practiceMode = true;
    this.startGame(classId);
  },

  startGame(classId) {
    Sound.init();
    this.classId = classId;
    const save = this.resumeSave;   // a saved run being continued (continueRun)
    this.resumeSave = null;
    this.game = new Game(classId, this.events, {
      practice: this.practiceMode ? this.practiceOptions : null,
      // the practice cheats also work in a boss arena opened from the range
      cheats: this.practiceMode || this.lastRun?.practiceBoss || this.lastRun?.mode === 'test' ? this.practiceOptions : null,
      run: this.practiceMode ? null : save ? { ...this.lastRun, resume: save.snapshot } : this.lastRun,
    });
    if (save) {
      // the clock, kills and scoreboard carry on from where they were
      this.game.time = Number(save.time) || 0;
      this.game.kills = Number(save.kills) || 0;
      if (save.stats) Object.assign(Game.statsOf(this.game.localPlayer), save.stats);
      this.saveRun(this.game.run);   // (it saved as the stage began, before these were put back)
    }
    Menus.refreshPractice(this.practiceOptions);
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
    Music.stop();
    Music.play('battle');
  },

  endGame(won, stats) {
    this.state = 'ended';
    // a finished solo run (won or wiped) has nothing left to continue
    if (!this.mp && this.game?.run && !this.game.run.practiceBoss && !this.game.run.testBoss) RunSave.clear();
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

  /**
   * One frame, always followed by the next: an error in a frame is reported (console, and a
   * notice on screen now and then) instead of stopping the loop and freezing the game for good.
   */
  loop(now) {
    // a graphics preset with a frame cap skips frames that come too soon (input waits for the next one)
    const cap = Settings.gfx.fps;
    if (cap && now - this.lastTime < 1000 / cap - 4) {
      requestAnimationFrame((t) => this.loop(t));
      return;
    }
    try {
      this.frame(now);
    } catch (e) {
      console.error('Frame error:', e);
      Input.endFrame();
      if (!(this.errorShownAt > now - 8000)) {
        this.errorShownAt = now;
        Menus.toast('SOMETHING WENT WRONG - THE GAME KEPT GOING (DETAILS IN THE CONSOLE)', '#ff6a6a');
      }
      requestAnimationFrame((t) => this.loop(t));
    }
  },

  frame(now) {
    const dt = Math.min((now - this.lastTime) / 1000 || 0, Settings.gfx.fps ? 1.25 / Settings.gfx.fps : 1 / 30);   // (a capped frame may run a little long)
    // (resizing the canvas resets its state, so both are set every frame)
    this.ctx.setTransform(Display.renderScale, 0, 0, Display.renderScale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.lastTime = now;

    if (Input.wasPressed('Escape')) {
      if (Touch.editing) Touch.closeEditor();
      else if (Menus.settingsOpen) {
        if (Menus.confirmOpen) Menus.hideConfirm();
        else Menus.requestCloseSettings();
      }
      else if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'panel') this.closePanel();
    }
    if (Input.pressed('music')) Menus.handleAction('toggleMusic', this);
    // the interact key finishes a dialogue line that's still typing, then picks the highlighted choice (PC: W / S, 1-9 too)
    if (this.state === 'panel' && Dialog.isOpen) Dialog.keys();
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
    this.canvas.classList.toggle('free-cursor', Input.freeMouse || Touch.editing);

    // the touch controls: this frame's moving, aiming and buttons (they stand in for the mouse and keys)
    Touch.update(this, dt);

    // lock the pointer while playing (aim uses Settings sensitivity); free it for menus
    if (this.state === 'playing' && !Touch.enabled) {
      if (!Input.freeMouse && !Input.locked && (Input.mouse.leftPressed || Input.mouse.rightPressed)) Input.lockPointer();
    } else Input.unlockPointer();

    // crosshair lock: keep the crosshair its set distance from this screen's hero
    const me = this.state === 'playing' && !Input.freeMouse && !Touch.enabled && this.game?.localPlayer;
    const at = me && this.game.camera.worldToScreen(me.pivotX, me.pivotY);
    if (me) Input.updateCrosshairLock(at.x, at.y);
    else Input.updateCrosshairLock(null, null);

    // the bag takes mouse clicks on its slots before the hero sees them
    HUD.handleBagMouse(this.state === 'playing' && this.game ? this.game.localPlayer : null);
    // and the weapon's attachment slot (drag it out to drop it)
    HUD.handleForgeMouse(this.state === 'playing' && this.game ? this.game.localPlayer : null);
    // and in the lobby, the teleport button and its map of the keep
    HUD.handleTeleportMouse(this.state === 'playing' && this.game ? this.game : null);

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
      if (this.state === 'playing' && Touch.enabled) Touch.draw(this.ctx, this.game);
      else if (this.state === 'playing' && !Input.freeMouse) HUD.drawCrosshair(this.ctx, Input.mouse.x, Input.mouse.y);
    } else {
      MenuShowcase.update(dt);
      MenuShowcase.render(this.ctx);
    }
    Menus.drawPreviews(now / 1000);
    if (Touch.editing) Touch.drawEditor(this.ctx);
    const g = this.state === 'playing' && this.game;
    this.practicePanel.classList.toggle('hidden', !(g && g.cheats));
    this.practicePanel.classList.toggle('arena', !!(g && g.cheats && !g.practice));
    // in a dungeon (boss practice, the test dungeon) it sits under the minimap instead of over it
    const top = g && g.cheats && g.run ? `${g.run.minimapBottom + 10}px` : '';
    if (this.practicePanel.style.top !== top) this.practicePanel.style.top = top;
    if (g && g.cheats) Menus.refreshPractice(g.cheats);   // (in multiplayer a teammate may have toggled one)

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
      const inRun = s.scene === 'run';
      lines.push({
        text: s.isHost
          ? (inRun ? 'Fix: Esc > Resync (keeps everyone\'s progress).' : 'Fix: Esc > Restart Lobby to resync everyone.')
          : (inRun ? 'Fix: ask the host to Resync (Esc menu) - progress is kept.' : 'Fix: ask the host to restart the lobby to resync.'),
        color: '#ffe680', size: 6,
      });
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
