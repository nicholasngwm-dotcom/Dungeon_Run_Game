// A dungeon run: three stages, each a generated FloorMap. Walking into a
// combat / defend / survival / boss room locks its doors until the
// room's objective is done. Shops, special, puzzle and secret rooms are places
// to find but don't do anything yet (items, upgrades and coins aren't in).
//
//   mode 'set':    one theme for all three stages
//   mode 'random': a theme rolled per stage (repeats are very unlikely)

// minimap colour + what each room is for (the lobby's map legend reads this too)
const ROOM_INFO = {
  start: { name: 'Entrance', color: '#d8c8a0', desc: 'Where each stage begins. Safe: no enemies.' },
  combat: { name: 'Combat', color: '#e84a4a', desc: 'Doors lock. Defeat every wave of enemies to leave. Watch for spike traps.' },
  defend: { name: 'Defend', color: '#6ad8ff', desc: 'Doors lock. Keep the lantern alive until the timer runs out. If it breaks, the defense starts over.' },
  survival: { name: 'Survival', color: '#ff8a1e', desc: 'Doors lock. Enemies keep coming: stay alive until the timer runs out.' },
  puzzle: { name: 'Puzzle', color: '#b67aff', desc: 'Puzzles are coming soon.' },
  shop: { name: 'Shop', color: '#ffd34a', desc: 'A shop and a restaurant. Coming soon.' },
  special: { name: 'Special', color: '#c08aff', desc: 'Something unusual: a blacksmith, wishing well, trader, treasure... Coming soon.' },
  secret: { name: 'Secret', color: '#fff6c8', desc: 'Not connected to anything. Look for a glowing hole in a combat room floor and jump in.' },
  boss: { name: 'Boss', color: '#ff3b30', desc: 'The theme\'s boss. Beat it to open the portal to the next stage.' },
};

// 8x8 minimap icon per room type: X = the room's colour, w = highlight, k = dark
const ROOM_ICONS = {
  start: ['.X......', '.XXXXX..', '.XXXwX..', '.XXXXX..', '.X......', '.X......', '.X......', 'XXX.....'],      // flag
  combat: ['X......X', 'wX....Xw', '.wX..Xw.', '..wXXw..', '..XwwX..', '.kX..Xk.', 'kk....kk', 'k......k'],    // crossed swords
  defend: ['...kk...', '..kXXk..', '.kXwwXk.', '.kXwwXk.', '.kXwXXk.', '.kXXXXk.', '..kkkk..', '.kkkkkk.'],    // lantern
  survival: ['XXXXXXXX', '.Xk..kX.', '..XwwX..', '...XX...', '...XX...', '..X..X..', '.XwwwwX.', 'XXXXXXXX'], // hourglass
  puzzle: ['..XXXX..', '.XX..XX.', '.....XX.', '....XX..', '...XX...', '...XX...', '........', '...XX...'],   // question mark
  shop: ['...kk...', '..XXXX..', '...XX...', '..XXXX..', '.XXwXXX.', 'XXXwwXXX', 'XXXwXXXX', '.XXXXXX.'],     // coin bag
  special: ['...XX...', '...XX...', 'XXXwwXXX', '.XXwwXX.', '..XXXX..', '.XX..XX.', 'XX....XX', '........'],  // star
  secret: ['.XXX....', 'X.w.X...', 'X...X...', '.XXXXXXX', '.....X.X', '.....X.X', '........', '........'],   // key
  boss: ['.XXXXXX.', 'XXXXXXXX', 'XkkXXkkX', 'XkkXXkkX', 'XXXXXXXX', '.XXkkXX.', '.XXXXXX.', '.X.XX.X.'],     // red skull
};

/** Draws a room's icon with its top-left at (x, y), each icon pixel s screen pixels. */
function drawRoomIcon(ctx, type, x, y, s = 1) {
  const icon = ROOM_ICONS[type];
  const colors = { X: ROOM_INFO[type].color, w: '#ffffff', k: OUTLINE };
  icon.forEach((row, j) => {
    for (let i = 0; i < 8; i++) {
      const c = colors[row[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + i * s, y + j * s, s, s);
    }
  });
}

/** A minimap room (box + icon) as an image, for the legend. state: 'cleared' | 'unseen' | 'active'; here = outlined. */
function roomIconImage(type, state = 'cleared', here = false) {
  const c = document.createElement('canvas');
  c.width = 28;
  c.height = 20;
  const ctx = c.getContext('2d');
  ctx.fillStyle = { cleared: '#4a4058', unseen: '#2a2438', active: '#6a2a3a' }[state];
  ctx.fillRect(0, 0, 28, 20);
  if (type) drawRoomIcon(ctx, type, 6, 2, 2);
  if (here) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 26, 18);
  }
  return c.toDataURL();
}

// special rooms: label + colour (placeholders until items / upgrades exist)
const SPECIAL_INFO = {
  blacksmith: { name: 'BLACKSMITH', color: '#adb2c0' },
  wishingWell: { name: 'WISHING WELL', color: '#6ad8ff' },
  heroStatue: { name: 'HERO STATUE', color: '#ffe680' },
  restaurant5: { name: '5 STAR RESTAURANT', color: '#ffd34a' },
  mountTrader: { name: 'MOUNT TRADER', color: '#c89a5a' },
  darkTrader: { name: 'DARK TRADER', color: '#b45aff' },
  friendlyTrader: { name: 'FRIENDLY TRADER', color: '#6cff7a' },
  treasure: { name: 'TREASURE ROOM', color: '#ffd34a' },
  helper: { name: 'HELPER ROOM', color: '#8cff9a' },
};

// puzzle rooms exist as places but don't lock (puzzles aren't designed yet)
const LOCKING_ROOMS = ['combat', 'defend', 'survival', 'boss'];

class DungeonRun {
  /** opts: { mode: 'set' | 'random', theme } */
  constructor(world, opts) {
    this.world = world;
    this.mode = opts.mode;
    this.stage = 1;
    this.themes = [];
    for (let s = 0; s < 3; s++) this.themes.push(opts.mode === 'set' ? opts.theme : this.rollTheme());
    this.time = 0;
    this.coins = 0;              // kept for the whole run (all three stages)
    this.coinFlash = 0;
    this.upgradeLevels = {};     // shop upgrade id -> times bought
    this.buildStage();
  }

  /** Random mode: a theme for the next stage, strongly avoiding ones already used. */
  rollTheme() {
    const ids = Object.keys(CONFIG.themes);
    const weights = ids.map((id) => (this.themes.includes(id) ? CONFIG.run.repeatThemeWeight : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) if ((r -= weights[i]) < 0) return ids[i];
    return ids[0];
  }

  get themeId() { return this.themes[this.stage - 1]; }
  get theme() { return CONFIG.themes[this.themeId]; }
  get scale() { return CONFIG.run.stages[this.stage - 1]; }
  get summonPool() { return this.theme.summons; }
  get floor() { return this.world.dungeon; }
  /** Per-stage value from a [stage1, stage2, stage3] list. */
  byStage(list) { return list[this.stage - 1]; }

  // ---------- stages ----------

  buildStage() {
    const w = this.world;
    w.dungeon = new FloorMap(this.stage, this.themeId);
    this.active = null;
    this.portal = null;
    this.totem = null;
    this.props = [];
    this.spikes = [];
    this.hole = null;            // the glowing hole down to the secret room
    const f = w.dungeon;
    for (const r of f.rooms) {
      if (r.type === 'combat') this.addSpikes(r);
      this.addProps(r);
    }
    this.addSecretHole(f);
    this.decor = new FloorDecor(f, this);
    const s = f.startRoom;
    s.state = 'cleared';
    this.visit(s);
  }

  /** Called once the hero exists: places them and announces the stage. */
  start() {
    const w = this.world;
    const p = this.floor.playerStart;
    w.player.x = p.x;
    w.player.y = p.y;
    w.camera.follow(p.x, p.y, 0, this.floor.width, this.floor.height, true);
    w.banner(`${this.theme.name.toUpperCase()} - STAGE ${this.stage}`, this.stage === 1 ? 'Clear the rooms and find the boss' : 'The dead grow stronger', 3);
  }

  nextStage() {
    const w = this.world;
    this.stage++;
    w.enemies = [];
    w.enemyProjectiles = [];
    w.playerProjectiles = [];
    w.pickups = [];
    w.hazards = [];
    w.clones = [];
    w.barriers = [];
    w.boss = null;
    w.timers = w.timers.filter((t) => !t.spawn);
    w.pendingSpawns = 0;
    this.buildStage();
    this.start();
    Music.play('battle');
  }

  victory() {
    const w = this.world;
    if (w.finished) return;
    w.finished = true;
    w.defeatText = `The ${this.theme.name.toLowerCase()} has been conquered.`;
    Music.stop();
    w.after(2, () => {
      Sound.play('victory');
      w.events.onVictory(w.stats);
    });
  }

  // ---------- per frame ----------

  update(dt) {
    const w = this.world;
    const p = w.player;
    this.time += dt;
    if (!p.dead) {
      const here = this.floor.roomAt(p.x, p.y);
      if (here) this.visit(here);
      // only lock once the hero is clear of the doorway
      const inside = this.floor.roomAt(p.x, p.y, 1);
      if (inside && inside.state === 'idle' && !this.active) this.enter(inside);
    }
    if (this.active) this.updateRoom(dt);
    this.updateSpikes(dt);
    this.updateProps(dt);
    this.decor.update(dt, w);
    this.coinFlash -= dt;
    // the portal only works once the hero has stepped away from it (so it can't grab them the moment it opens)
    if (this.portal && !p.dead) {
      const d = dist(p.x, p.y, this.portal.x, this.portal.y);
      if (d > 50) this.portal.armed = true;
      if (this.portal.armed && d < 26) {
        this.portal = null;
        if (this.stage < 3) this.nextStage();
        else this.victory();
      }
    }
  }

  /** Marks a room visited, and its neighbours as seen on the minimap (secret rooms stay hidden). */
  visit(r) {
    if (r.visited) return;
    r.visited = true;
    r.seen = true;
    for (const id of r.links) {
      const n = this.floor.rooms[id];
      if (n.type !== 'secret') n.seen = true;
    }
    if (!LOCKING_ROOMS.includes(r.type)) r.state = 'cleared';
    // only announced once the hero is actually inside (they get here by the hole)
    if (r.type === 'secret') this.world.banner('SECRET ROOM', 'You found a hidden room', 2);
  }

  /** Locks the doors and starts the room's objective. */
  enter(r) {
    if (!LOCKING_ROOMS.includes(r.type)) return;
    const w = this.world;
    const f = this.floor;
    this.active = r;
    r.state = 'active';
    f.activeRoom = r;
    for (const d of r.doors) if (!d.secret) f.lock(d.tiles);
    Sound.play('stomp');
    w.shake(4, 0.25);
    const s = this.stage - 1;
    const R = CONFIG.run;
    switch (r.type) {
      case 'combat':
        r.wave = 0;
        r.waves = R.combat.waves[s];
        this.spawnWave(r);
        break;
      case 'defend':
        this.startDefend(r);
        break;
      case 'survival':
        r.timeLeft = R.survival.duration[s];
        r.spawnTimer = 0.5;
        w.banner('SURVIVE', `Hold out for ${r.timeLeft} seconds`, 1.8);
        break;
      case 'boss':
        this.startBoss(r);
        break;
    }
  }

  finish(r) {
    const w = this.world;
    r.state = 'cleared';
    this.active = null;
    this.floor.activeRoom = null;
    for (const d of r.doors) if (!d.secret) this.floor.unlock(d.tiles);
    this.totem = null;
    Sound.play('waveStart');
    if (r.type !== 'boss') w.banner('ROOM CLEARED', 'A chest appeared', 1.6);
    w.maybeDropHeart(r.cx, r.cy, 0.35);
    // reward chest (in the boss room it sits below the portal)
    const T = this.floor.T;
    const y = r.type === 'boss' ? r.cy + 3 * T : r.cy + 0.5 * T;
    this.props.push({ kind: 'rewardChest', room: r, x: r.cx, y, label: 'OPEN CHEST', color: '#ffd34a', opened: false, t: 0 });
    w.effects.burst(r.cx, y - 10, { count: 24, colors: ['#ffd34a', '#fff2a0', '#ffffff'], speed: [40, 140], life: [0.3, 0.7], up: 40 });
  }

  // ---------- coins ----------

  addCoins(n) {
    this.coins += n;
    this.coinFlash = 0.25;
  }

  /** Coins burst out of a point: fives for big amounts, ones for the rest. */
  spawnCoins(x, y, n) {
    const w = this.world;
    const fives = n >= 10 ? Math.floor(n / 5) - 1 : 0;
    for (let i = 0; i < fives; i++) w.pickups.push(new CoinPickup(x, y, 5));
    for (let i = 0; i < n - fives * 5; i++) w.pickups.push(new CoinPickup(x, y, 1));
  }

  /**
   * Coins for a kill: tougher enemies (more base hp) drop more. Things that
   * were summoned (tombstones, necromancers, sorcerers) rarely drop any, so
   * spawners can't be farmed. Self-destructs (bombs, skulls) drop nothing.
   */
  onEnemyKilled(e) {
    const c = CONFIG.run.coins;
    if (e.exploded || e.cfg.coins === 0) return;
    let n;
    if (e.owner) n = Math.random() < c.summonedChance ? 1 : 0;
    else {
      const base = (e.maxHp / this.scale.hp) / c.hpPerCoin;
      n = Math.max(1, randInt(Math.floor(base * 0.7), Math.ceil(base * 1.3)));
    }
    if (n > 0) this.spawnCoins(e.x, e.y - 4, n);
  }

  // ---------- defend rooms: who enemies go after ----------

  /**
   * Enemies chase the hero once they spot them (close enough and visible);
   * otherwise they go for the lantern. If the hero outruns them they lose
   * interest and turn back to the lantern.
   */
  defendTarget(enemy) {
    const c = CONFIG.run.defendAI;
    const w = this.world;
    let hero = null;
    let best = Infinity;
    for (const a of w.allies) {
      if (a === this.totem) continue;
      const d = dist(enemy.x, enemy.y, a.x, a.y);
      if (a.invisible && d > (a.detectRange ?? CONFIG.player.invisibleDetectRange)) continue;
      if (d < best) { best = d; hero = a; }
    }
    if (enemy.defendFocus === 'hero') {
      if (!hero || best > c.loseRange) enemy.defendFocus = 'lantern';
    } else if (hero && best <= c.spotRange) {
      enemy.defendFocus = 'hero';
    }
    return enemy.defendFocus === 'hero' ? hero : this.totem;
  }

  updateRoom(dt) {
    const r = this.active;
    const w = this.world;
    const allDead = w.enemies.length === 0 && w.pendingSpawns === 0;
    switch (r.type) {
      case 'combat':
        if (!allDead) return;
        if (r.wave < r.waves) this.spawnWave(r);
        else this.finish(r);
        break;
      case 'defend': this.updateDefend(r, dt); break;
      case 'survival': {
        const c = CONFIG.run.survival;
        r.timeLeft -= dt;
        r.spawnTimer -= dt;
        if (r.spawnTimer <= 0) {
          r.spawnTimer = this.byStage(c.spawnEvery);
          const counts = {};
          for (let i = 0; i < c.perSpawn; i++) {
            if (w.enemies.length + w.pendingSpawns < this.byStage(c.maxAlive)) this.spawnIn(r, this.pickEnemy(counts));
          }
        }
        if (r.timeLeft <= 0) {
          this.banishEnemies();
          this.finish(r);
        }
        break;
      }
      case 'boss':
        if (r.bossDown && !w.boss) {
          this.finish(r);
          this.portal = { x: r.cx, y: r.cy, armed: false };
          w.banner(`${r.bossName} DEFEATED`, this.stage < 3 ? 'Step into the portal to go deeper' : 'Step into the portal to escape', 3);
        }
        break;
    }
  }

  // ---------- spawning ----------

  /** Weighted pick from the theme's stage list, respecting per-wave caps on heavy enemies. */
  pickEnemy(counts) {
    const heavy = this.theme.heavy || {};
    const list = this.theme.enemies[this.stage].filter(([t]) => !(heavy[t] && (counts[t] || 0) >= heavy[t]));
    let r = Math.random() * list.reduce((s, [, wt]) => s + wt, 0);
    for (const [t, wt] of list) if ((r -= wt) < 0) { counts[t] = (counts[t] || 0) + 1; return t; }
    return list[0][0];
  }

  /** Spawns an enemy somewhere in the room, away from the hero. */
  spawnIn(r, type) {
    const w = this.world;
    const p = w.player;
    let pt = this.floor.randomPointIn(r, 2);
    for (let i = 0; i < 20 && dist(pt.x, pt.y, p.x, p.y) < 170; i++) pt = this.floor.randomPointIn(r, 2);
    w.spawnEnemy(type, pt.x, pt.y);
  }

  spawnWave(r) {
    const c = CONFIG.run.combat;
    r.wave++;
    const n = this.byStage(c.perWave) + randInt(0, c.perWaveRandom);
    const counts = {};
    for (let i = 0; i < n; i++) this.spawnIn(r, this.pickEnemy(counts));
    this.world.banner(`WAVE ${r.wave}/${r.waves}`, '', 1.2);
  }

  /** Clears the remaining enemies without a fight (timers ran out). */
  banishEnemies() {
    const w = this.world;
    for (const e of w.enemies) {
      w.effects.burst(e.hx, e.hy, { count: 12, colors: ['#b45aff', '#e0c0ff'], speed: [30, 100], life: [0.3, 0.6], up: 40 });
    }
    w.enemies = [];
    w.timers = w.timers.filter((t) => !t.spawn);
    w.pendingSpawns = 0;
    w.enemyProjectiles = [];
  }

  // ---------- defend ----------

  startDefend(r, again = false) {
    const c = CONFIG.run.defend;
    r.timeLeft = this.byStage(c.duration);
    r.waveTimer = 1;
    this.totem = new DefendTotem(r.cx, r.cy + 16, Math.round(this.byStage(c.totemHp)));
    this.world.banner(again ? 'TRY AGAIN' : 'DEFEND THE LANTERN', `Keep it alive for ${r.timeLeft} seconds`, 2);
  }

  updateDefend(r, dt) {
    const c = CONFIG.run.defend;
    const w = this.world;
    if (r.retry > 0) {
      r.retry -= dt;
      if (r.retry <= 0) this.startDefend(r, true);
      return;
    }
    if (this.totem.dead) {
      // lost: the room resets after a moment
      this.banishEnemies();
      this.totem = null;
      r.retry = 2.5;
      w.banner('THE LANTERN FELL', 'The defense starts over', 2.2);
      Sound.play('defeat');
      return;
    }
    r.timeLeft -= dt;
    r.waveTimer -= dt;
    if (r.waveTimer <= 0) {
      r.waveTimer = c.waveEvery;
      const counts = {};
      for (let i = 0; i < this.byStage(c.perWave); i++) this.spawnIn(r, this.pickEnemy(counts));
    }
    if (r.timeLeft <= 0) {
      this.banishEnemies();
      this.finish(r);
    }
  }

  // ---------- boss ----------

  startBoss(r) {
    const w = this.world;
    const type = this.theme.boss;
    w.boss = Game.createBoss(type, { x: r.cx, y: r.cy - 20 });
    const s = this.scale;
    const b = w.boss;
    b.maxHp = Math.round(b.maxHp * s.hp);
    b.hp = b.maxHp;
    b.cfg = scaleBossDamage(b.cfg, s.damage);
    r.bossName = b.name;
    r.bossDown = false;
    Music.play('boss');
    w.banner(b.name, `${b.title} - Stage ${this.stage}`, 3);
    Sound.play('bossRoar');
  }

  onBossDefeated() {
    const r = this.active;
    if (r && r.type === 'boss') {
      r.bossDown = true;
      const [lo, hi] = CONFIG.run.coins.boss;
      this.spawnCoins(r.cx, r.cy, randInt(lo, hi));
    }
    Music.play('battle');
  }

  // ---------- spike traps (combat rooms) ----------

  addSpikes(r) {
    const c = CONFIG.run.spikes;
    const n = randInt(c.perRoom[0], c.perRoom[1]);
    const T = this.floor.T;
    for (let i = 0; i < n; i++) {
      const tx = randInt(r.x0 + 1, r.x1 - 1);
      const ty = randInt(r.y0 + 1, r.y1 - 1);
      if (this.spikes.some((s) => s.tx === tx && s.ty === ty)) continue;
      if (Math.abs(tx * T - r.cx) < 2 * T && Math.abs(ty * T - r.cy) < 2 * T) continue;   // keep the middle clear
      this.spikes.push({ tx, ty, x: tx * T, y: ty * T, offset: rand(0, c.period), hit: false });
    }
  }

  /** 0 = down, 'warn' = peeking out, 1 = up (hurts). */
  spikeState(s) {
    const c = CONFIG.run.spikes;
    const t = (this.time + s.offset) % c.period;
    if (t > c.period - c.up) return 1;
    if (t > c.period - c.up - c.warn) return 'warn';
    return 0;
  }

  updateSpikes() {
    const T = this.floor.T;
    for (const s of this.spikes) {
      const up = this.spikeState(s) === 1;
      if (!up) { s.hit = false; continue; }
      if (s.hit) continue;
      for (const a of this.world.allies) {
        if (a.x > s.x && a.x < s.x + T && a.y > s.y && a.y < s.y + T && a.hurt(CONFIG.run.spikes.damage, this.world, a.x, a.y + 10)) s.hit = true;
      }
    }
  }

  // ---------- shops, specials, secret rooms (placeholders) ----------

  addProps(r) {
    const T = this.floor.T;
    const add = (kind, dx, dy, label, color) => this.props.push({ kind, room: r, x: r.cx + dx * T, y: r.cy + dy * T, label, color });
    if (r.type === 'shop') {
      add('shopkeeper', -3, -1, 'SHOP', '#ffd34a');
      add('chef', 3, -1, 'RESTAURANT', '#ff8a6a');
    } else if (r.type === 'special') {
      const info = SPECIAL_INFO[r.special];
      if (r.special === 'treasure') for (const dx of [-3, 0, 3]) add('chest', dx, 0, 'TREASURE CHEST', info.color);
      else add(r.special, 0, -0.5, info.name, info.color);
    } else if (r.type === 'puzzle') {
      add('puzzle', 0, -0.5, 'PUZZLE ROOM', ROOM_INFO.puzzle.color);
    } else if (r.type === 'secret') {
      add('chest', -3.5, 0.5, 'SECRET CHEST', '#fff6c8');
      add('chest', 3.5, 0.5, 'SECRET CHEST', '#fff6c8');
      add('holeExit', 0, -1.5, 'CLIMB UP', '#fff6c8');   // the way back up to the hole
    }
  }

  /**
   * The secret room's entrance: a glowing hole in the floor of one combat
   * room, clear of the middle, the doors and the spike traps.
   */
  addSecretHole(f) {
    if (!f.rooms.some((r) => r.type === 'secret')) return;
    const T = f.T;
    const hosts = f.rooms.filter((r) => r.type === 'combat');
    for (let i = 0; i < 60; i++) {
      const r = choose(hosts);
      const pt = f.randomPointIn(r, 2);
      if (Math.abs(pt.x - r.cx) < 3 * T && Math.abs(pt.y - r.cy) < 2 * T) continue;
      if (this.spikes.some((s) => Math.abs(s.x + 16 - pt.x) < 48 && Math.abs(s.y + 16 - pt.y) < 48)) continue;
      const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ x: (t % f.cols + 0.5) * T, y: (Math.floor(t / f.cols) + 0.5) * T }));
      if (doors.some((d) => dist(d.x, d.y, pt.x, pt.y) < 3 * T)) continue;
      this.hole = { kind: 'hole', room: r, x: pt.x, y: pt.y, label: 'JUMP IN', color: '#fff6c8' };
      this.props.push(this.hole);
      return;
    }
  }

  /** Down the hole into the secret room / back up beside the hole. */
  descend() {
    const secret = this.floor.rooms.find((r) => r.type === 'secret');
    this.travel(secret.cx, secret.cy + this.floor.T);
    Sound.play('phantomVanish');
  }

  ascend() {
    this.travel(this.hole.x, this.hole.y + 40);
    Sound.play('phantomAppear');
  }

  travel(x, y) {
    const w = this.world;
    const p = w.player;
    w.effects.burst(p.hx, p.hy, { count: 24, colors: ['#fff6c8', '#ffd34a', '#b67aff'], speed: [40, 140], life: [0.3, 0.6], up: 40 });
    p.x = x;
    p.y = y;
    p.iframes = Math.max(p.iframes, 0.6);
    w.clones = [];
    w.playerProjectiles = [];
    w.camera.follow(p.x, p.y - 16, 0, this.floor.width, this.floor.height, true);
    w.effects.burst(p.hx, p.hy, { count: 24, colors: ['#fff6c8', '#ffd34a', '#b67aff'], speed: [40, 140], life: [0.3, 0.6], up: 40 });
    w.shake(4, 0.2);
  }

  /**
   * Runs before the hero updates, so pressing E at something here is used up
   * by the interaction and never also fires the hero's E ability.
   * Reward chests open, the shopkeeper and chef talk, the hole takes you down;
   * the rest (special rooms, secret chests...) aren't in yet.
   */
  preUpdate() {
    const w = this.world;
    const p = w.player;
    this.nearProp = null;
    if (this.active || p.dead) return;
    for (const pr of this.props) {
      if (pr.opened) continue;
      const reach = pr.kind === 'hole' || pr.kind === 'holeExit' ? dist(p.x, p.y, pr.x, pr.y) < 40 : dist(p.x, p.y, pr.x, pr.y + 10) < 44;
      if (reach) { this.nearProp = pr; break; }
    }
    const pr = this.nearProp;
    if (!pr || !Input.pressed('interact')) return;
    Input.consume('interact');
    if (pr.kind === 'rewardChest') return this.openChest(pr);
    if (pr.kind === 'hole') return this.descend();
    if (pr.kind === 'holeExit') return this.ascend();
    if (pr.kind === 'shopkeeper' || pr.kind === 'chef') return w.events.onNpc?.(pr.kind, this);
    w.events.onToast?.(`${pr.label}: COMING SOON`);
    Sound.play('uiClick');
  }

  /** Opened chests animate their lid. */
  updateProps(dt = 0) {
    for (const pr of this.props) if (pr.opened) pr.t += dt;
  }

  openChest(pr) {
    const w = this.world;
    pr.opened = true;
    pr.t = 0;
    this.spawnCoins(pr.x, pr.y - 12, CONFIG.run.coins.roomChest);
    w.effects.burst(pr.x, pr.y - 14, { count: 30, colors: ['#ffd34a', '#fff2a0', '#ffffff'], speed: [60, 180], life: [0.3, 0.7], up: 60 });
    w.effects.text(pr.x, pr.y - 40, `+${CONFIG.run.coins.roomChest} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
    Sound.play('chestOpen');
  }

  // ---------- world hooks ----------

  /** Extra things hero attacks can hit (none right now). */
  targets() { return []; }

  /** Extra things enemies attack (the defend totem). */
  allies() { return this.totem && !this.totem.dead ? [this.totem] : []; }

  getDrawables() {
    // holes are flat on the floor, so they always sort under the characters
    const items = this.props.map((pr) => ({ y: pr.kind === 'hole' || pr.kind === 'holeExit' ? pr.y - 1000 : pr.y, draw: (ctx) => this.drawProp(ctx, pr) }));
    if (this.totem) items.push({ y: this.totem.y, draw: (ctx) => this.totem.draw(ctx) });
    items.push(...this.decor.getDrawables(this.world.camera));
    return items;
  }

  // ---------- drawing ----------

  drawGround(ctx) {
    const T = this.floor.T;
    this.decor.drawGround(ctx, this.world.camera);
    // spikes
    for (const s of this.spikes) {
      const st = this.spikeState(s);
      ctx.fillStyle = 'rgba(20, 16, 24, 0.75)';
      ctx.fillRect(s.x + 3, s.y + 3, T - 6, T - 6);
      ctx.fillStyle = '#4a4058';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(s.x + 7 + i * 8, s.y + 7 + j * 8, 3, 3);
      if (st === 0) continue;
      const h = st === 1 ? 10 : 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const x = s.x + 8 + i * 8;
          const y = s.y + 10 + j * 8;
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x - 2, y - h - 1, 5, h + 1);
          ctx.fillStyle = st === 1 ? '#c9d3dd' : '#80869a';
          ctx.fillRect(x - 1, y - h, 3, h);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y - h, 1, 1);
        }
      }
    }
    // locked doors: iron bars
    if (this.active) {
      for (const d of this.active.doors) {
        if (d.secret) continue;
        for (const t of d.tiles) {
          const x = (t % this.floor.cols) * T;
          const y = Math.floor(t / this.floor.cols) * T;
          ctx.fillStyle = 'rgba(10, 6, 18, 0.6)';
          ctx.fillRect(x, y, T, T);
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x, y + 2, T, 4);
          ctx.fillRect(x, y + T - 6, T, 4);
          for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 8, y, 4, T);
          ctx.fillStyle = '#80869a';
          ctx.fillRect(x, y + 3, T, 2);
          for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 8, y, 2, T);
        }
      }
    }

    if (this.portal) this.drawPortal(ctx);
  }

  drawPortal(ctx) {
    const { x, y } = this.portal;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const r = ((this.time * 30 + i * 12) % 48);
      ctx.strokeStyle = `rgba(180, 90, 255, ${0.8 * (1 - r / 48)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
    g.addColorStop(0, 'rgba(230, 190, 255, 0.7)');
    g.addColorStop(1, 'rgba(120, 40, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
    ctx.restore();
    HUD.text(ctx, this.stage < 3 ? 'NEXT STAGE' : 'EXIT', x, y - 46, { size: 7, align: 'center', color: '#e0c0ff' });
  }

  /** Placeholder props: a simple stand per kind, with a label. */
  drawProp(ctx, pr) {
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    if (pr.kind === 'hole' || pr.kind === 'holeExit') return this.drawHole(ctx, pr);
    drawShadow(ctx, x, y + 4, 22, 6);
    const box = (w, h, top, side, dy = 0) => {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - w / 2 - 1, y - h - 1 + dy, w + 2, h + 2);
      ctx.fillStyle = side;
      ctx.fillRect(x - w / 2, y - h + dy, w, h);
      ctx.fillStyle = top;
      ctx.fillRect(x - w / 2, y - h + dy, w, 4);
    };
    switch (pr.kind) {
      case 'shopkeeper':
      case 'chef': {
        // the NPC stands behind a counter under a striped awning
        const frames = Sprites.npcs[pr.kind].idle;
        drawSprite(ctx, frames[Math.floor((this.time + x * 0.01) * 2.5) % frames.length].img, x, y - 8, HERO_ANCHOR.x, HERO_ANCHOR.y, pr.kind === 'chef', 1);
        box(52, 18, '#9c6c3e', '#5b3922');
        ctx.fillStyle = '#5b3922';
        ctx.fillRect(x - 25, y - 64, 3, 48);
        ctx.fillRect(x + 22, y - 64, 3, 48);
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? '#f4ead7' : pr.color;
          ctx.fillRect(x - 28 + i * 7, y - 70, 7, 9);
        }
        if (pr.kind === 'shopkeeper') {
          // wares on the counter: potions and a coin pile
          for (const [dx, c] of [[-18, '#e84a4a'], [-11, '#4a8aff'], [-4, '#6cff7a']]) {
            ctx.fillStyle = OUTLINE; ctx.fillRect(x + dx - 1, y - 27, 6, 10);
            ctx.fillStyle = c; ctx.fillRect(x + dx, y - 25, 4, 7);
          }
          ctx.fillStyle = '#ffd34a'; ctx.fillRect(x + 8, y - 21, 10, 3); ctx.fillRect(x + 10, y - 24, 6, 3);
        } else {
          // a steaming pot
          ctx.fillStyle = OUTLINE; ctx.fillRect(x - 10, y - 30, 20, 13);
          ctx.fillStyle = '#383b48'; ctx.fillRect(x - 9, y - 29, 18, 11);
          for (let i = 0; i < 3; i++) {
            const s = (this.time * 0.8 + i * 0.33) % 1;
            ctx.fillStyle = `rgba(240, 240, 240, ${0.5 * (1 - s)})`;
            ctx.fillRect(x - 6 + i * 5 + Math.round(Math.sin(s * 6 + i) * 2), y - 32 - s * 18, 3, 3);
          }
        }
        break;
      }
      case 'rewardChest': {
        const lift = pr.opened ? Math.min(1, pr.t * 6) : 0;
        if (pr.opened && pr.t < 1.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 40);
          g.addColorStop(0, `rgba(255, 220, 120, ${0.6 * (1 - pr.t / 1.5)})`);
          g.addColorStop(1, 'rgba(255, 220, 120, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, y - 54, 80, 80);
          ctx.restore();
        }
        box(28, 14, '#7d532f', '#5b3922');
        ctx.fillStyle = '#dcb44c';
        ctx.fillRect(x - 14, y - 9, 28, 2);
        // the lid tips back when opened
        const ly = y - 14 - lift * 8;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 15, ly - 10 + lift * 4, 30, 11 - lift * 4);
        ctx.fillStyle = '#9c6c3e';
        ctx.fillRect(x - 14, ly - 9 + lift * 4, 28, 9 - lift * 4);
        ctx.fillStyle = '#dcb44c';
        ctx.fillRect(x - 14, ly - 2, 28, 2);
        if (!pr.opened) ctx.fillRect(x - 2, y - 17, 4, 6);
        break;
      }
      case 'chest':
        box(26, 18, '#c89a5a', '#7d532f');
        ctx.fillStyle = '#dcb44c';
        ctx.fillRect(x - 13, y - 11, 26, 2);
        ctx.fillRect(x - 2, y - 13, 4, 6);
        break;
      case 'wishingWell':
        box(34, 16, '#80869a', '#585d6c');
        ctx.fillStyle = '#2a5ad0';
        ctx.fillRect(x - 13, y - 14, 26, 4);
        ctx.fillStyle = '#5b3922';
        ctx.fillRect(x - 15, y - 40, 3, 26);
        ctx.fillRect(x + 12, y - 40, 3, 26);
        ctx.fillRect(x - 17, y - 42, 34, 4);
        break;
      case 'heroStatue': {
        box(30, 12, '#77699a', '#46415b');
        const ids = Object.keys(CONFIG.classes);
        const id = ids[(pr.room.id + this.stage) % ids.length];
        drawSprite(ctx, Sprites.heroes[id].idle[0].img, x, y - 10, HERO_ANCHOR.x, HERO_ANCHOR.y, false, 0.55);
        break;
      }
      case 'puzzle':
        // a rune-carved stone tablet
        box(26, 34, '#77699a', '#46415b');
        ctx.fillStyle = '#b67aff';
        for (let i = 0; i < 3; i++) ctx.fillRect(x - 7 + i * 6, y - 26 + (i % 2) * 6, 3, 8);
        break;
      case 'darkTrader':
        drawSprite(ctx, Sprites.enemies.reaper.idle[0].img, x, y, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, true, 1);
        box(30, 10, '#463a5c', '#1e1628', 4);
        break;
      default: {
        // a stall: counter + striped awning in the prop's colour
        box(40, 16, '#9c6c3e', '#5b3922');
        ctx.fillStyle = '#5b3922';
        ctx.fillRect(x - 19, y - 44, 3, 28);
        ctx.fillRect(x + 16, y - 44, 3, 28);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#f4ead7' : pr.color;
          ctx.fillRect(x - 21 + i * 7, y - 50, 7, 8);
        }
        ctx.fillStyle = pr.color;
        ctx.fillRect(x - 10, y - 20, 5, 4);
        ctx.fillRect(x + 2, y - 21, 4, 5);
        break;
      }
    }
    if (pr.opened) return;
    const near = this.nearProp === pr;
    const labelY = pr.kind === 'shopkeeper' || pr.kind === 'chef' ? y - 82 : pr.kind === 'rewardChest' ? y - 36 : y - 62;
    const label = near && pr.kind === 'shopkeeper' ? 'TALK' : near && pr.kind === 'chef' ? 'TALK' : pr.label;
    if (pr.kind === 'rewardChest' && !near) return;
    HUD.text(ctx, near ? `[${Settings.label('interact')}] ${label}` : label, x, labelY, { size: near ? 7 : 6, align: 'center', color: near ? '#ffe680' : pr.color });
  }

  /**
   * The secret hole: a dark pit in the floor with a pulsing golden rim and
   * sparks drifting up out of it. In the secret room, a shaft of light
   * (with a rope) is the way back up.
   */
  drawHole(ctx, pr) {
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    const t = this.time;
    const pulse = 0.5 + Math.sin(t * 3) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 60);
    g.addColorStop(0, `rgba(255, 220, 140, ${0.25 * pulse + 0.1})`);
    g.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, y - 60, 120, 120);
    ctx.restore();
    if (pr.kind === 'hole') {
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.ellipse(x, y, 24, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#05020a';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 21, 10, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255, 214, 110, ${0.55 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 23, 11, 0, 0, TAU); ctx.stroke();
      // crumbling stones round the rim
      ctx.fillStyle = '#5c5676';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.3;
        ctx.fillRect(Math.round(x + Math.cos(a) * 26) - 2, Math.round(y + Math.sin(a) * 13) - 1, 4, 3);
      }
    } else {
      // shaft of light from above, and a rope to climb
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createLinearGradient(0, y - 140, 0, y);
      sg.addColorStop(0, 'rgba(255, 240, 190, 0)');
      sg.addColorStop(1, `rgba(255, 240, 190, ${0.25 + pulse * 0.15})`);
      ctx.fillStyle = sg;
      ctx.fillRect(x - 20, y - 140, 40, 140);
      ctx.restore();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, y - 140, 4, 136);
      ctx.fillStyle = '#c89a5a';
      ctx.fillRect(x - 1, y - 140, 2, 136);
      for (let ry = y - 136; ry < y - 6; ry += 8) { ctx.fillStyle = '#7d532f'; ctx.fillRect(x - 1, ry, 2, 2); }
      ctx.strokeStyle = `rgba(255, 214, 110, ${0.4 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 18, 8, 0, 0, TAU); ctx.stroke();
    }
    // sparks drifting up
    for (let i = 0; i < 5; i++) {
      const s = (t * 0.5 + i * 0.2) % 1;
      ctx.fillStyle = `rgba(255, 230, 150, ${1 - s})`;
      ctx.fillRect(Math.round(x + Math.sin(i * 2.3 + t) * 12), Math.round(y - s * 50), 2, 2);
    }
    const near = this.nearProp === pr;
    if (near) HUD.text(ctx, `[${Settings.label('interact')}] ${pr.label}`, x, y - 40, { size: 7, align: 'center', color: '#ffe680' });
  }

  /** Top-right: theme + stage, the room objective, and the minimap. */
  drawHud(ctx) {
    HUD.text(ctx, `${this.theme.name.toUpperCase()}  STAGE ${this.stage}/3`, 946, 14, { size: 9, align: 'right', color: '#f2a541' });
    const goal = this.objectiveText();
    if (goal) HUD.text(ctx, goal, 946, 30, { size: 7, align: 'right' });
    this.drawMinimap(ctx, 946, 46);
  }

  objectiveText() {
    const r = this.active;
    const w = this.world;
    if (this.portal) return 'STEP INTO THE PORTAL';
    if (!r) return '';
    switch (r.type) {
      case 'combat': return `DEFEAT ALL ENEMIES  WAVE ${r.wave}/${r.waves}`;
      case 'defend': return r.retry > 0 ? 'THE DEFENSE STARTS OVER...' : `DEFEND THE LANTERN  ${Math.ceil(r.timeLeft)}s`;
      case 'survival': return `SURVIVE  ${Math.ceil(r.timeLeft)}s`;
      case 'boss': return `DEFEAT ${r.bossName}`;
    }
    return '';
  }

  drawMinimap(ctx, right, top) {
    const f = this.floor;
    const g = CONFIG.run.grid;
    const cw = 20;
    const ch = 15;
    const left = right - g.cols * cw;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(left - 4, top - 4, g.cols * cw + 8, g.rows * ch + 8);
    const pos = (r) => ({ x: left + r.gx * cw + cw / 2, y: top + r.gy * ch + ch / 2 });
    ctx.fillStyle = '#5a4d78';
    for (const l of f.links) {
      const a = f.rooms[l.a];
      const b = f.rooms[l.b];
      if (!(a.seen && b.seen)) continue;
      const pa = pos(a);
      const pb = pos(b);
      ctx.fillRect(Math.min(pa.x, pb.x) - 1, Math.min(pa.y, pb.y) - 1, Math.abs(pa.x - pb.x) + 2, Math.abs(pa.y - pb.y) + 2);
    }
    const here = f.roomAt(this.world.player.x, this.world.player.y);
    for (const r of f.rooms) {
      if (!r.seen) continue;
      const { x, y } = pos(r);
      ctx.fillStyle = r.visited ? (r.state === 'cleared' ? '#4a4058' : '#6a2a3a') : '#2a2438';
      ctx.fillRect(x - 8, y - 6, 16, 12);
      drawRoomIcon(ctx, r.type, x - 4, y - 4);
      if (r === here) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 8.5, y - 6.5, 17, 13);
      }
    }
  }
}

/** The boss's attack damage numbers multiplied (it reads them from its cfg). */
function scaleBossDamage(cfg, mult) {
  const out = JSON.parse(JSON.stringify(cfg));
  const walk = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v);
      else if (typeof v === 'number' && /damage/i.test(k)) o[k] = Math.round(v * mult);
    }
  };
  walk(out);
  return out;
}

/**
 * Defend rooms: the lantern enemies try to smash. It's an ally (enemies
 * target it like the hero), doesn't move and has a big health bar.
 */
class DefendTotem {
  constructor(x, y, hp) {
    this.x = x;
    this.y = y;
    this.maxHp = hp;
    this.hp = hp;
    this.radius = 16;
    this.hw = 12;
    this.hh = 8;
    this.dead = false;
    this.invulnerable = 0;
    this.flashTime = 0;
    this.time = 0;
  }

  get hx() { return this.x; }
  get hy() { return this.y - 18; }
  get invisible() { return false; }

  knockback() {}

  hurt(amount, world) {
    if (this.dead || this.invulnerable > 0) return false;
    this.hp -= amount;
    this.invulnerable = 0.15;
    this.flashTime = 0.1;
    world.effects.text(this.hx, this.hy - 20, `-${Math.round(amount)}`, { color: '#6ad8ff', size: 8 });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#6ad8ff', '#ffffff', '#585d6c'], speed: [80, 220], life: [0.4, 0.8] });
      world.shake(6, 0.3);
      Sound.play('partBreak');
    }
    return true;
  }

  draw(ctx) {
    this.time += 1 / 60;
    this.invulnerable -= 1 / 60;
    this.flashTime -= 1 / 60;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawShadow(ctx, x, y + 2, 18, 5);
    // stone plinth
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 13, y - 12, 26, 14);
    ctx.fillStyle = '#585d6c';
    ctx.fillRect(x - 12, y - 11, 24, 12);
    ctx.fillStyle = '#80869a';
    ctx.fillRect(x - 12, y - 11, 24, 2);
    // iron lantern
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 8, y - 36, 16, 25);
    ctx.fillStyle = this.flashTime > 0 ? '#ffffff' : '#383b48';
    ctx.fillRect(x - 7, y - 35, 14, 23);
    const flick = Math.sin(this.time * 12) * 1.5;
    ctx.fillStyle = '#6ad8ff';
    ctx.fillRect(x - 4, y - 30 + flick, 8, 14 - flick);
    ctx.fillStyle = '#e6f6ff';
    ctx.fillRect(x - 2, y - 24, 4, 7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 24, 2, x, y - 24, 46);
    g.addColorStop(0, 'rgba(106, 216, 255, 0.35)');
    g.addColorStop(1, 'rgba(106, 216, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 46, y - 70, 92, 92);
    ctx.restore();
    // health bar
    const w = 44;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - w / 2 - 1, y - 47, w + 2, 6);
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(x - w / 2, y - 46, w, 4);
    ctx.fillStyle = '#6ad8ff';
    ctx.fillRect(x - w / 2, y - 46, Math.round(w * this.hp / this.maxHp), 4);
  }
}

