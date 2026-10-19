// Multiplayer session: deterministic lockstep with the host as the hub.
//
// Every machine runs the exact same simulation. Only inputs travel:
//   - each client sends its input (held keys, presses, aim point, mouse) to the host
//   - the host, 60 times a second, bundles the latest input of every player plus any
//     commands (hero picks, purchases, ready ups, starting a dungeon...) into a numbered
//     bundle, sends it to everyone, and steps its own game with it
//   - clients step their game with each bundle, in order
// While a game steps, Math.random is a generator seeded by the host, so random
// choices come out the same everywhere, and Math's trig / exp / pow are swapped
// for DetMath so different browsers can't round differently. Clients must run
// the same build as the host (checked on joining). Every few seconds clients
// send a checksum of their game so the host can spot a desync; everyone is told,
// and the network status (a lagging link) is shown separately, so the two
// kinds of trouble can't be confused.
//
// Scenes (the lobby, a dungeon run, the test dungeon) start through bundle
// commands too, so everyone builds the new world on the same tick from the same seed.

const HELD_ACTIONS = ['up', 'down', 'left', 'right'];
const PRESS_ACTIONS = ['e', 'f', 'ult', 'dodge', 'potion', 'interact', 'item1', 'item2', 'item3', 'item4', 'item5'];

class Session {
  /** An input that does nothing (players with no input yet, or with a menu open). */
  static idleInput = { h: 0, p: [], mx: 0, my: 0, ml: 0, mr: 0, lp: 0, rp: 0 };

  /** Network input -> what Input.override expects while that hero updates. */
  static toOverride(inp) {
    const held = new Set();
    HELD_ACTIONS.forEach((a, i) => { if (inp.h & (1 << i)) held.add(a); });
    return {
      held,
      pressed: new Set(inp.p),
      mouse: { x: 0, y: 0, left: !!inp.ml, right: !!inp.mr, leftPressed: !!inp.lp, rightPressed: !!inp.rp },
    };
  }

  /**
   * transport: { send(to, msg), broadcast(msg), close() }
   * events: { onScene(game), onRoster(roster), onRejected(reason), onDesync(name), onEnded(reason) }
   * gameEvents: the Game events object (game over, menus...) passed to every scene.
   */
  constructor({ isHost, name, classId, transport, events = {}, gameEvents = {} }) {
    this.isHost = isHost;
    this.name = name;
    this.classId = classId;
    this.transport = transport;
    this.events = events;
    this.gameEvents = gameEvents;
    this.game = null;
    this.scene = null;           // 'lobby' | 'run' | 'test'
    this.tick = 0;
    this.acc = 0;
    this.id = isHost ? 'p1' : null;
    this.roster = [];
    this.code = null;            // room code (shown in the lobby)
    // local input gathered between steps (presses must not be lost or doubled)
    this.pending = { p: new Set(), lp: false, rp: false };
    this.sendAcc = 0;
    // host only
    this.nextId = 2;
    this.peers = new Map();      // transport peer -> player id
    this.clientInputs = {};      // player id -> merged input since the last bundle
    this.queue = [];             // commands waiting for the next bundle: { from, cmd }
    this.hashes = new Map();     // tick -> own checksum
    // client only
    this.bundles = new Map();    // bundle number -> bundle, waiting to be applied
    this.nextK = null;           // the next bundle number to apply
    this.captureLocal = null;    // tests can replace input capture
  }

  get dt() { return 1 / CONFIG.multiplayer.tickRate; }
  get playerCount() { return this.roster.length; }

  // ---------- local input ----------

  /** Called once per frame (before Input.endFrame): remembers this frame's presses. */
  pollLocal(active) {
    if (!active) return;
    for (const a of PRESS_ACTIONS) if (Input.pressed(a)) this.pending.p.add(a);
    if (Input._mouse.leftPressed) this.pending.lp = true;
    if (Input._mouse.rightPressed) this.pending.rp = true;
  }

  /** This screen's input right now, as sent over the network (presses since the last sample). */
  sampleLocal(active) {
    if (this.captureLocal) return this.captureLocal();
    const game = this.game;
    const m = game ? game.camera.screenToWorld(Input._mouse.x, Input._mouse.y) : { x: 0, y: 0 };
    const inp = { h: 0, p: [], mx: m.x, my: m.y, ml: 0, mr: 0, lp: 0, rp: 0 };
    if (active) {
      HELD_ACTIONS.forEach((a, i) => { if (Input.down(a)) inp.h |= 1 << i; });
      inp.p = [...this.pending.p];
      inp.ml = Input._mouse.left ? 1 : 0;
      inp.mr = Input._mouse.right ? 1 : 0;
      inp.lp = this.pending.lp ? 1 : 0;
      inp.rp = this.pending.rp ? 1 : 0;
    }
    this.pending = { p: new Set(), lp: false, rp: false };
    return inp;
  }

  // ---------- frame update ----------

  /** active: whether this screen's player is in control (no menu open). */
  update(frameDt, active = true) {
    if (this.isHost) this.updateHost(frameDt, active);
    else this.updateClient(frameDt, active);
  }

  updateHost(frameDt, active) {
    this.acc = Math.min(this.acc + frameDt, this.dt * 5);
    while (this.acc >= this.dt) {
      this.acc -= this.dt;
      const inputs = { [this.id]: this.sampleLocal(active) };
      for (const r of this.roster) {
        if (r.id === this.id) continue;
        const ci = this.clientInputs[r.id];
        if (!ci) continue;
        inputs[r.id] = { h: ci.h, p: [...ci.p], mx: ci.mx, my: ci.my, ml: ci.ml, mr: ci.mr, lp: ci.lp, rp: ci.rp };
        ci.p = new Set();
        ci.lp = 0;
        ci.rp = 0;
      }
      const bundle = { t: 'b', k: this.tick, i: inputs, c: this.queue.splice(0) };
      if (this.peers.size) this.transport.broadcast(bundle);
      this.apply(bundle);
    }
  }

  updateClient(frameDt, active) {
    // send input at the simulation rate
    this.sendAcc += frameDt;
    if (this.sendAcc >= this.dt && this.id) {
      this.sendAcc = 0;
      this.transport.send('host', { t: 'in', i: this.sampleLocal(active) });
    }
    // step through received bundles strictly in order, at a steady pace, catching up if they pile up
    this.acc = Math.min(this.acc + frameDt, this.dt * 5);
    let steps = 0;
    while (this.bundles.has(this.nextK) && (this.acc >= this.dt || this.bundles.size > 3) && steps < 8) {
      this.acc = Math.max(0, this.acc - this.dt);
      const b = this.bundles.get(this.nextK);
      this.bundles.delete(this.nextK);
      this.nextK++;
      this.apply(b);
      steps++;
    }
  }

  // ---------- applying a bundle (both sides) ----------

  apply(bundle) {
    for (const { from, cmd } of bundle.c) {
      if (cmd.scene) this.startScene(cmd);
      else if (this.game) this.withRng(() => this.game.applyCommand(cmd, from));
    }
    if (!this.game) return;
    this.withRng(() => this.game.update(this.dt, bundle.i));
    this.tick = bundle.k + 1;
    if (this.tick % CONFIG.multiplayer.checksumEvery === 0) {
      const h = this.checksum();
      if (this.isHost) this.hashes.set(this.tick, h);
      else this.transport.send('host', { t: 'sum', k: this.tick, h });
    }
  }

  /**
   * Runs fn as shared simulation: Math.random = the shared seeded generator,
   * and the trig / exp / pow functions = DetMath, so every browser and device
   * computes exactly the same numbers.
   */
  withRng(fn) {
    Math.random = this.rng;
    Object.assign(Math, DetMath);
    try { fn(); } finally {
      Math.random = nativeRandom;
      Object.assign(Math, NativeMath);
    }
  }

  startScene(cmd) {
    // the lobby restarts whenever someone joins: welcome banner the first time, then announce the newcomer
    const before = this.game ? this.game.players.map((p) => p.netId) : [];
    const firstLobby = cmd.scene === 'lobby' && !this.welcomed;
    if (cmd.scene === 'lobby') this.welcomed = true;
    this.scene = cmd.scene;
    this.roster = cmd.roster;
    this.rng = seededRng(cmd.seed);
    this.desync = null;   // a new scene is built fresh from the seed, so everyone is back in step
    const opts = { roster: cmd.roster, localId: this.id, lobby: cmd.scene === 'lobby', run: cmd.run || null, welcome: firstLobby };
    this.withRng(() => { this.game = new Game(null, this.gameEvents, opts); });
    this.game.code = this.code;
    const newcomer = !firstLobby && cmd.scene === 'lobby' && cmd.roster.find((r) => !before.includes(r.id) && r.id !== this.id);
    if (newcomer) this.game.banner(`${newcomer.name.toUpperCase()} JOINED`, `${cmd.roster.length}/${CONFIG.multiplayer.maxPlayers} players`, 2);
    this.events.onScene?.(this.game, cmd.scene);
    this.events.onRoster?.(this.roster);
  }

  /** Fingerprint of the simulation: if two machines differ, they've desynced. */
  checksum() {
    const g = this.game;
    let s = `${g.time.toFixed(4)}|${g.enemies.length}|`;
    for (const p of g.players) s += `${p.netId}:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.hp.toFixed(2)};`;
    for (const e of g.enemies) s += `${e.x.toFixed(1)},${e.hp.toFixed(1)};`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }

  // ---------- host: players coming and going, scenes, commands ----------

  /** Host only: the room is open; start the lobby with just the host. */
  hostStart(code) {
    this.code = code;
    this.roster = [{ id: this.id, name: this.name, classId: this.classId }];
    this.queueScene('lobby');
  }

  /** The roster with everyone's current hero (heroes may have been swapped in the lobby). */
  currentRoster() {
    return this.roster.map((r) => {
      const hero = this.game && this.game.heroById(r.id);
      return { ...r, classId: hero ? hero.classId : r.classId };
    });
  }

  /** Queues a new scene for everyone. kind: 'lobby' | 'run' | 'test'; run: dungeon run options. */
  queueScene(kind, run = null) {
    const roster = this.currentRoster();
    this.queue.push({ from: this.id, cmd: { scene: kind, seed: Math.floor(nativeRandom() * 2 ** 31), roster, run } });
  }

  startRun(run) { if (this.isHost) this.queueScene(run ? 'run' : 'test', run); }
  returnToLobby() { if (this.isHost) this.queueScene('lobby'); }

  /** A gameplay command from this screen's player. */
  command(cmd) {
    if (this.isHost) this.queue.push({ from: this.id, cmd });
    else this.transport.send('host', { t: 'cmd', c: cmd });
  }

  /** A hero class for a newcomer: their pick if it isn't already taken twice, otherwise the first that isn't. */
  freeClass(want) {
    const roster = this.currentRoster();
    const count = (id) => roster.filter((r) => r.classId === id).length;
    if (CONFIG.classes[want] && count(want) < CONFIG.multiplayer.maxDuplicates) return want;
    return Object.keys(CONFIG.classes).find((id) => count(id) < CONFIG.multiplayer.maxDuplicates);
  }

  /** Host: a message from a client (peer = transport id). */
  onMessage(peer, msg) {
    if (this.isHost) return this.onHostMessage(peer, msg);
    return this.onClientMessage(msg);
  }

  onHostMessage(peer, msg) {
    const id = this.peers.get(peer);
    switch (msg.t) {
      case 'hello': {
        if (msg.build !== BUILD) {
          return this.transport.send(peer, { t: 'reject', reason: `Different game versions: the host has version ${BUILD}, you have ${msg.build || 'an older one'}. Everyone must run the same version - refresh the page (Ctrl+F5 on a computer, pull down to reload on a phone) and join again.` });
        }
        if (this.roster.length >= CONFIG.multiplayer.maxPlayers) return this.transport.send(peer, { t: 'reject', reason: 'The lobby is full (8 players).' });
        if (this.scene !== 'lobby') return this.transport.send(peer, { t: 'reject', reason: 'That game is already in a dungeon. Try again when they are back in the lobby.' });
        const newId = `p${this.nextId++}`;
        this.peers.set(peer, newId);
        this.roster.push({ id: newId, name: String(msg.name || 'Hero').slice(0, 14), classId: this.freeClass(msg.classId) });
        this.clientInputs[newId] = { h: 0, p: new Set(), mx: 0, my: 0, ml: 0, mr: 0, lp: 0, rp: 0 };
        this.transport.send(peer, { t: 'welcome', id: newId, code: this.code });
        // everyone (re)starts the lobby together with the new roster
        this.queueScene('lobby');
        return;
      }
      case 'in': {
        const ci = id && this.clientInputs[id];
        if (!ci) return;
        ci.at = performance.now();
        const i = msg.i;
        ci.h = i.h; ci.mx = i.mx; ci.my = i.my; ci.ml = i.ml; ci.mr = i.mr;
        for (const a of i.p) ci.p.add(a);
        if (i.lp) ci.lp = 1;
        if (i.rp) ci.rp = 1;
        return;
      }
      case 'cmd':
        if (id && !msg.c.scene) this.queue.push({ from: id, cmd: msg.c });
        return;
      case 'sum': {
        const mine = this.hashes.get(msg.k);
        if (mine && mine !== msg.h && !this.desync) {
          // tell everyone (once per scene), so every screen shows what's wrong
          const who = this.roster.find((r) => r.id === id);
          const name = who ? who.name : id;
          this.desync = { who: name, tick: msg.k };
          this.transport.broadcast({ t: 'desync', who: name, k: msg.k });
          this.events.onDesync?.(name);
        }
        for (const k of this.hashes.keys()) if (k < msg.k - 600) this.hashes.delete(k);
        return;
      }
    }
  }

  /** Host: a client's connection closed. */
  onPeerLeft(peer) {
    const id = this.peers.get(peer);
    if (!id) return;
    this.peers.delete(peer);
    delete this.clientInputs[id];
    this.roster = this.roster.filter((r) => r.id !== id);
    this.queue.push({ from: this.id, cmd: { type: 'leave', id } });
    this.events.onRoster?.(this.roster);
  }

  // ---------- client ----------

  /** Client: connected to the host - introduce ourselves. */
  hello() {
    this.transport.send('host', { t: 'hello', name: this.name, classId: this.classId, build: BUILD });
  }

  onClientMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        this.id = msg.id;
        this.code = msg.code;
        return;
      case 'reject':
        this.events.onRejected?.(msg.reason);
        return;
      case 'b':
        this.lastBundleAt = performance.now();
        // we start from the first bundle that begins a scene (anything before is from
        // before we joined); after that bundles are applied strictly in order
        if (this.nextK === null) {
          if (!msg.c.some((c) => c.cmd.scene)) return;
          this.nextK = msg.k;
        }
        if (msg.k >= this.nextK) this.bundles.set(msg.k, msg);
        return;
      case 'desync':
        if (!this.desync) {
          this.desync = { who: msg.who, tick: msg.k };
          this.events.onDesync?.(msg.who);
        }
        return;
    }
  }

  /**
   * Connection health for this screen, separate from desyncs: a list of
   * warnings like "WAITING FOR THE HOST 2.4s". Empty when all is well.
   */
  netWarnings() {
    const now = performance.now();
    const out = [];
    if (this.isHost) {
      for (const r of this.roster) {
        const ci = this.clientInputs[r.id];
        if (!ci || !ci.at) continue;
        const gap = (now - ci.at) / 1000;
        if (gap > 1.5) out.push(`${r.name.toUpperCase()}'S CONNECTION IS LAGGING (${gap.toFixed(1)}s)`);
      }
    } else if (this.game && this.lastBundleAt) {
      const gap = (now - this.lastBundleAt) / 1000;
      if (gap > 1) out.push(`WAITING FOR THE HOST... ${gap.toFixed(1)}s (slow connection)`);
      else if (this.bundles.size > 20) out.push('CATCHING UP WITH THE HOST (connection hiccup)');
    }
    return out;
  }

  close() {
    this.transport.close?.();
  }
}
