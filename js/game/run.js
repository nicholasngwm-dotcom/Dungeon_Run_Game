// A dungeon run: three stages, each a generated FloorMap. Walking into a
// combat / defend / survival / boss room locks its doors until the
// room's objective is done. Shops, special, puzzle and secret rooms don't lock:
// the puzzle room's Simon stone is played whenever the heroes like.
//
//   mode 'set':    one theme for all three stages
//   mode 'random': a theme rolled per stage (repeats are very unlikely)

// minimap colour + what each room is for (the lobby's map legend reads this too)
const ROOM_INFO = {
  start: { name: 'Entrance', color: '#d8c8a0', desc: 'Where each stage begins. Safe: no enemies.' },
  combat: { name: 'Combat', color: '#e84a4a', desc: 'Doors lock. Defeat every wave of enemies to leave. Watch for spike traps.' },
  defend: { name: 'Defend', color: '#6ad8ff', desc: 'Doors lock. Keep the lantern alive until the timer runs out. The souls of slain enemies mend it. If it breaks, the defense starts over.' },
  survival: { name: 'Survival', color: '#ff8a1e', desc: 'Doors lock. Enemies keep coming: stay alive until the timer runs out.' },
  puzzle: { name: 'Puzzle', color: '#b67aff', desc: 'Touch the rune stone and it lights a pattern of colours: step on the matching floor plates in the same order. Get it right three times and every hero gets a free upgrade. Three mistakes and the stone blinks red, then blows up the whole room and sets it ablaze. Run!' },
  shop: { name: 'Shop', color: '#ffd34a', desc: 'Three stalls: buy upgrades (or reroll) from Bram, potions from Mira, and sell them back to Tobin.' },
  special: { name: 'Special', color: '#c08aff', desc: 'Something unusual: a blacksmith, restaurant, wishing well, trader, treasure... The wishing well grants a wish for coins; the rest are coming soon.' },
  secret: { name: 'Secret', color: '#fff6c8', desc: 'Not connected to anything. Look for a glowing hole in a combat room floor and jump in. Three chests, open two: one is a mimic.' },
  boss: { name: 'Boss', color: '#ff3b30', desc: 'The theme\'s boss. Beat it to open the portal to the next stage.' },
  vault: { name: 'Gem Vault', color: '#7ac8ff', desc: 'Beat the last boss of a run and its blue portal leads here. Open the chest for your gems, then leave the dungeon.' },
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
  vault: ['........', '..XXXX..', '.XwwXXX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '........'],   // gem
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
  restaurant5: { name: 'RESTAURANT', color: '#ffd34a' },
  mountTrader: { name: 'MOUNT TRADER', color: '#c89a5a' },
  darkTrader: { name: 'DARK TRADER', color: '#b45aff' },
  friendlyTrader: { name: 'FRIENDLY TRADER', color: '#6cff7a' },
  treasure: { name: 'TREASURE ROOM', color: '#ffd34a' },
  helper: { name: 'HELPER ROOM', color: '#8cff9a' },
};

// seconds a chest rattles before its lid bursts open (and the loot flies out)
const CHEST_POP = 0.14;

// the rooms that lock their doors until their objective is done
const LOCKING_ROOMS = ['combat', 'defend', 'survival', 'boss'];

// the puzzle room's Simon stone: its four colours, in the order its runes and floor plates sit (left to right)
const SIMON_COLORS = [
  { color: '#ff5a4a', dark: '#8a2420', rgb: '255, 90, 74' },     // red
  { color: '#5aa8ff', dark: '#1e4a8a', rgb: '90, 168, 255' },    // blue
  { color: '#6ce07a', dark: '#24703a', rgb: '108, 224, 122' },   // green
  { color: '#ffd34a', dark: '#8a6a14', rgb: '255, 211, 74' },    // yellow
];
const SIMON_PLATE = 56;   // a floor plate's width (px)

// Fight-room obstacle patterns (DungeonRun.addLayout), drawn for a 24x16 room: each piece is
// [unit, cdx, cdy, w, h], its corner nearest the middle cdx tiles left of and cdy tiles above
// the room's middle; it's mirrored into all four quarters. Units are the theme's pieces
// (CONFIG.themes[id].layout): small (a stack of headstones or crates), pillar, long (a tomb or
// statue, 2x1), wallH (3x1), wallV (1x3) and block (2x2).
const ROOM_LAYOUTS = [
  [['block', 3, 2, 2, 2], ['small', 8, 4, 1, 1]],                                                     // four blocks
  [['pillar', 3, 2, 1, 1], ['pillar', 7, 2, 1, 1], ['pillar', 3, 5, 1, 1], ['pillar', 7, 5, 1, 1]],   // a grid of pillars
  [['wallH', 3, 3, 3, 1], ['wallV', 8, 1, 1, 3]],                                                     // walls round the middle
  [['small', 4, 2, 2, 2], ['small', 9, 4, 2, 1]],                                                     // stacks in the corners
  [['long', 3, 2, 2, 1], ['long', 3, 5, 2, 1], ['long', 8, 3, 2, 1]],                                 // rows of tombs
  [['block', 3, 2, 2, 2], ['wallH', 7, 5, 3, 1]],                                                     // blocks and long walls
];

class DungeonRun {
  /**
   * opts: { mode: 'set' | 'random', theme }. opts.practiceBoss: boss practice from the
   * practice range: a floor of just an entrance room and that boss's room, at the stage
   * the boss is normally met (its strength), whose portal leads back to the range.
   */
  constructor(world, opts) {
    this.world = world;
    this.mode = opts.mode;
    this.practiceBoss = opts.practiceBoss || null;
    this.stage = this.practiceBoss ? DungeonRun.bossStage(this.practiceBoss) : 1;
    this.themes = [];
    for (let s = 0; s < 3; s++) this.themes.push(opts.mode === 'set' ? opts.theme : this.rollTheme());
    this.time = 0;
    this.startPicks = {};          // each stage's free upgrade: 'stage|hero key' -> the id chosen
    // a multiplayer resync carries the run on where it was (see snapshot / Session.resyncRun)
    const R = opts.resume;
    if (R) {
      this.stage = R.stage;
      this.themes = [...R.themes];
      this.metLateBoss = R.metLateBoss;
      this.startPicks = { ...R.startPicks };
    }
    this.buildStage();
  }

  /**
   * Everything a resync carries over to the rebuilt stage: the stage and its themes, and each
   * hero's upgrades, coins, items, health (a share of max; the downed come back at half) and ult.
   * Plain data, sent to every machine with the new scene.
   */
  snapshot() {
    const heroes = {};
    for (const p of this.world.players) {
      heroes[p.netId] = {
        upgrades: Object.keys(p.upgradeLevels),
        coins: p.coins,
        bought: p.upgradesBought || 0,
        inventory: p.inventory.map((s) => s && { ...s }),
        hp: p.dead ? 0.5 : p.hp / p.maxHp,
        ult: p.ult,
      };
    }
    return { stage: this.stage, themes: [...this.themes], metLateBoss: !!this.metLateBoss, startPicks: { ...this.startPicks }, heroes };
  }

  /** The heroes of a resynced run take back what they had (their upgrades re-applied, without the fanfare). */
  restoreHeroes(R) {
    for (const p of this.world.players) {
      const h = R.heroes[p.netId];
      if (!h) continue;
      for (const id of h.upgrades) {
        const u = UPGRADE_BY_ID[id];
        if (!u || p.upgradeLevels[id]) continue;
        p.upgradeLevels[id] = 1;
        u.apply?.(p);
      }
      p.coins = h.coins;
      p.upgradesBought = h.bought;
      p.inventory = h.inventory.map((s) => s && { ...s });
      p.hp = Math.max(1, Math.round(p.maxHp * h.hp));
      p.ult = h.ult;
    }
  }

  /**
   * The theme's deeper boss (the graveyard's Deathbringer), met once a run: at the first of its
   * stages lateChance of the time, otherwise at the last. null when it isn't this stage's.
   */
  lateBoss() {
    const L = this.theme.lateBoss;
    if (!L || this.metLateBoss || !L.stages.includes(this.stage)) return null;
    if (this.stage !== L.stages[L.stages.length - 1] && Math.random() >= L.lateChance) return null;
    this.metLateBoss = true;
    return L.type;
  }

  /** The stage a boss is normally met at (the castle's Queen and King come later, the Deathbringer deep in the graveyard). */
  static bossStage(type) {
    return { queen: 2, king: 3, deathbringer: 2 }[type] || 1;
  }

  /** The dungeon theme whose boss room a boss fights in (the castle's royals, or the graveyard). */
  static bossTheme(type) {
    if (type === 'golem' || type === 'guardian') return 'ruins';
    return ['queen', 'king', 'prince', 'princess'].includes(type) ? 'castle' : 'graveyard';
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
    // the stage boss: the theme's own, or (the castle) its stage's: the Prince or the Princess, the Queen, the King
    const options = this.theme.stageBosses?.[this.stage] || this.theme.bosses || [this.theme.boss];
    const fresh = options.filter((b) => b !== this.bossType);
    this.bossType = this.practiceBoss || this.lateBoss() || choose(fresh.length ? fresh : options);
    w.dungeon = new FloorMap(this.stage, this.themeId, undefined, { boss: this.bossType, practice: !!this.practiceBoss, vault: this.stage === 3 });
    this.active = null;
    this.portal = null;
    this.totem = null;
    this.props = [];
    this.spikes = [];            // every spiked tile ({ tx, ty, x, y, offset, pad })
    this.spikePads = [];         // the square pads they belong to (fire together)
    this.cover = [];             // every obstacle in the rooms: themed cover, walls and solid decor ({ kind, tx, ty, w, h, x, y, seed, item?, fixed? })
    this.rubble = [];            // what's left of obstacles a big blast knocked down ({ x, y, material, seed })
    this.extraLights = [];       // short-lived lights (burning ground, ice), until world time `until`
    this.sleepers = [];          // combat rooms' first waves, already standing about in them (see populate)
    this.hole = null;            // the glowing hole down to the secret room
    // this stage's shop: the potion shelf (shared) and each hero's upgrade store state
    this.shopSeed = Math.floor(Math.random() * 2 ** 31);
    this.stageTime = 0;          // seconds since this stage began (the free pick waits a moment)
    this.potionStock = [];
    this.shopStates = {};
    const f = w.dungeon;
    for (const r of f.rooms) {
      if (CONFIG.run.cover.rooms.includes(r.type)) this.addLayout(r);
      if (r.type === 'boss' && this.bossType === 'king') this.solidThrone(r);
      if (r.type === 'boss' && this.bossType === 'princess') this.studyCover(r);
      if (r.type === 'boss' && this.bossType === 'phantom') this.manorStairs(r);
      if (r.type === 'boss' && this.bossType === 'deathbringer') this.cryptTombs(r);
      if (r.type === 'boss' && this.bossType === 'golem') this.guardianCover(r);
      if (r.type === 'boss' && this.bossType === 'guardian') this.crystalCover(r);
      if (r.type === 'boss' && this.bossType === 'king') this.throneHallPillars(r);
      if (r.type === 'combat') this.addSpikes(r);
      this.addProps(r);
    }
    this.addSecretHole(f);
    // swinging doors at both ends of every hallway (each room door knows its pair of leaves)
    const leaves = [];
    for (const r of f.rooms) for (const d of r.doors) { d.swing = leaves.length; leaves.push({ ...d.leaf, tiles: d.tiles }); }
    // the graveyard's are creaking wrought-iron gates, the ruins' stone pillars the magic raises and sinks
    // (the castle keeps heavy oak doors)
    const iron = this.themeId === 'graveyard';
    const stone = this.themeId === 'ruins';
    this.doors = new SwingDoors(leaves, iron
      ? { reach: 72, height: 70, edge: 8, style: 'iron', sounds: { open: 'gateCreak', shut: 'gateShut', slam: 'gateClang' } }
      : stone
        ? { reach: 72, height: 78, style: 'stone', sounds: { open: 'graveRumble', shut: 'stomp', slam: 'stomp' } }
        : { reach: 72, height: 64, edge: 10 });
    this.decor = new FloorDecor(f, this);
    this.barrels = Barrels.place(this);   // explosive, poison and frost barrels in the fight rooms (after the decor, clear of it)
    this.fog = this.theme.night && this.theme.fog !== false ? this.placeFog(f) : [];
    const s = f.startRoom;
    s.state = 'cleared';
    this.visit(s);
  }

  /** Called once the heroes exist: groups them at the entrance and announces the stage. */
  start() {
    const w = this.world;
    const s = this.floor.playerStart;
    w.players.forEach((p, i) => {
      const off = Game.spawnOffset(i);
      p.x = s.x + off.x;
      p.y = s.y + off.y;
    });
    w.camera.follow(s.x, s.y, 0, this.floor.width, this.floor.height, true);
    this.populate();
    if (this.practiceBoss) {
      w.banner('BOSS PRACTICE', 'Its room lies through the door', 3);
      return;
    }
    const lines = this.theme.stageLines || ['Clear the rooms and find the boss', 'The enemies grow stronger', 'The enemies grow stronger'];
    w.banner(`${this.theme.name.toUpperCase()} - STAGE ${this.stage}`, this.byStage(lines), 3);
  }

  nextStage() {
    const w = this.world;
    this.stage++;
    // fallen teammates get back up for the new stage, at half health
    for (const p of w.players) if (p.dead) p.revive(0.5);
    for (const p of w.players) Upgrades.state(p).resurrected = false;   // the Priestess's Resurrect is back
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
    w.pendingSummons = 0;
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
    this.time += dt;
    this.stageTime += dt;
    for (const p of w.heroes) {
      const here = this.floor.roomAt(p.x, p.y);
      if (here) this.visit(here);
      // only lock once the hero is clear of the doorway
      const inside = this.floor.roomAt(p.x, p.y, 1);
      if (inside && inside.state === 'idle' && !this.active) this.enter(inside, p);
    }
    if (this.active) this.updateRoom(dt);
    if (this.active) this.containRoom(dt);
    this.updateSleepers(dt);
    this.updateSpikes(dt);
    this.updateProps(dt);
    for (const pr of this.props) if (pr.kind === 'puzzle') this.updateStone(pr, dt);
    Barrels.update(this, dt);
    this.decor.update(dt, w);
    this.doors.update(dt, w);
    if (this.totem) this.totem.update(dt, w);
    for (const p of w.players) p.coinFlash -= dt;
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

  /**
   * Locks the doors and starts the room's objective. Teammates who aren't in
   * the room yet are pulled in next to whoever walked in, so nobody is left
   * outside the locked doors.
   */
  enter(r, by = null) {
    if (!LOCKING_ROOMS.includes(r.type)) return;
    const w = this.world;
    const f = this.floor;
    this.active = r;
    r.state = 'active';
    f.activeRoom = r;
    for (const d of r.doors) {
      f.lock(d.tiles);
      this.doors.doors[d.swing].locked = true;   // the doors slam shut
    }
    for (const e of [...w.players, ...w.clones, ...w.enemies]) e.strayTime = 0;
    if (by) {
      let i = 0;
      for (const p of w.heroes) {
        if (f.roomAt(p.x, p.y, 1) === r) continue;
        const a = (i++ / 4) * TAU;
        const pt = f.freePoint(by.x + Math.cos(a) * 34, by.y + Math.sin(a) * 24, p.hw, p.hh);
        w.effects.burst(p.hx, p.hy, { count: 14, colors: ['#b45aff', '#e0c0ff'], speed: [30, 100], life: [0.2, 0.5] });
        p.x = pt.x;
        p.y = pt.y;
        w.effects.burst(p.hx, p.hy, { count: 14, colors: ['#b45aff', '#e0c0ff'], speed: [30, 100], life: [0.2, 0.5] });
      }
    }
    Sound.play('stomp');
    w.shake(4, 0.25);
    const s = this.stage - 1;
    const R = CONFIG.run;
    switch (r.type) {
      case 'combat':
        r.wave = 0;
        r.waves = R.combat.waves[s];
        if (!this.wakeRoom(r)) this.spawnWave(r);
        break;
      case 'defend':
        this.startDefend(r);
        break;
      case 'survival':
        r.timeLeft = R.survival.duration[s];
        r.timeTotal = r.timeLeft;
        r.spawnTimer = 0.5;
        w.banner('SURVIVE', `Hold out for ${r.timeLeft} seconds`, 1.8);
        break;
      case 'boss':
        this.startBoss(r);
        break;
    }
  }

  /**
   * While a room is locked, anyone who ends up outside it (heroes, downed
   * bodies, clones or enemies: knocked through a doorway, dashed out, spawned
   * on the wrong side) is warped back in after CONFIG.run.strayReturn seconds.
   * An enemy wedged inside a wall (a door shut on it, a hedge grown under it) is
   * freed almost at once: nudged to the nearest open floor in the room.
   */
  containRoom(dt) {
    const w = this.world;
    const f = this.floor;
    const r = this.active;
    const delay = CONFIG.run.strayReturn;
    for (const e of [...w.players, ...w.clones, ...w.enemies]) {
      if (e.dead && !w.players.includes(e)) continue;
      const inside = f.roomAt(e.x, e.y) === r;
      const stuck = w.enemies.includes(e) && f.boxHitsWall(e.x, e.y, e.hw || 9, e.hh || 6);
      if (inside && !stuck) { e.strayTime = 0; e.stuckTime = 0; continue; }
      if (inside && stuck) {
        e.stuckTime = (e.stuckTime || 0) + dt;
        if (e.stuckTime < 0.3) continue;
        e.stuckTime = 0;
        const pt = f.freePoint(e.x, e.y, e.hw || 9, e.hh || 6);
        const q = f.randomPointIn(r, 2);
        const near = f.roomAt(pt.x, pt.y) === r ? pt : f.freePoint(q.x, q.y, e.hw || 9, e.hh || 6);
        e.x = near.x;
        e.y = near.y;
        e.kbx = 0;
        e.kby = 0;
        continue;
      }
      e.strayTime = (e.strayTime || 0) + dt;
      if (e.strayTime < delay) continue;
      e.strayTime = 0;
      const p = f.randomPointIn(r, 2);
      const pt = f.freePoint(p.x, p.y, e.hw || 9, e.hh || 6);
      w.effects.burst(e.x, e.y - 14, { count: 14, colors: ['#b45aff', '#e0c0ff'], speed: [30, 100], life: [0.2, 0.5] });
      e.x = pt.x;
      e.y = pt.y;
      e.kbx = 0;   // drop any knockback that would carry them straight back out
      e.kby = 0;
      w.effects.burst(e.x, e.y - 14, { count: 14, colors: ['#b45aff', '#e0c0ff'], speed: [30, 100], life: [0.2, 0.5], up: 30 });
      if (e === w.localPlayer) w.camera.follow(e.x, e.y - 16, 0, w.dungeon.width, w.dungeon.height, true);
    }
  }

  finish(r) {
    const w = this.world;
    r.state = 'cleared';
    this.active = null;
    this.floor.activeRoom = null;
    for (const d of r.doors) {
      this.floor.unlock(d.tiles);
      this.doors.doors[d.swing].locked = false;
    }
    this.totem = null;
    Sound.play('waveStart');
    if (r.type !== 'boss') w.banner('ROOM CLEARED', 'A chest appeared', 1.6);
    for (const p of w.players) p.roomCleared(w);   // super buffs count down by rooms
    w.maybeDropHeart(r.cx, r.cy, 0.35);
    // reward chest (in the boss room it sits below the portal)
    const T = this.floor.T;
    const y = r.type === 'boss' ? this.portalSpot(r).y + 3 * T : r.cy + 0.5 * T;
    this.props.push({ kind: 'rewardChest', room: r, x: r.cx, y, label: 'OPEN CHEST', color: '#ffd34a', opened: false, t: 0 });
    w.effects.burst(r.cx, y - 10, { count: 24, colors: ['#ffd34a', '#fff2a0', '#ffffff'], speed: [40, 140], life: [0.3, 0.7], up: 40 });
  }

  // ---------- coins ----------

  /** Coins go into one hero's purse (each hero keeps their own for the whole run). */
  addCoins(n, hero) {
    hero.coins += n;
    hero.coinFlash = 0.25;
  }

  /** A hero's upgrade-store state at this stage's shop: { rerolls, boughtHere (ids bought since the last reroll) }. */
  shopState(hero) {
    const key = hero.netId || 'solo';
    return this.shopStates[key] || (this.shopStates[key] = { rerolls: 0, boughtHere: [] });
  }

  /** Key of a hero's free pick at this stage. */
  pickKey(hero) { return `${this.stage}|${hero.netId || 'solo'}`; }

  /** True while a hero still has this stage's free upgrade to choose (not in boss practice, and while there's any left to give). */
  needsPick(hero) {
    return !!hero && !this.practiceBoss && !this.startPicks[this.pickKey(hero)] && pickOffers(this, hero).length > 0;
  }

  /** A stage's free upgrade: one of the hero's three gift offers. */
  pickUpgrade(hero, id) {
    const u = this.needsPick(hero) && pickOffers(this, hero).find((x) => x.id === id);
    if (u) {
      this.startPicks[this.pickKey(hero)] = id;
      this.grantUpgrade(hero, u);
    }
    this.world.events.onPurchase?.(hero, 'pick', !!u);
  }

  /** The hero owns the upgrade from now on: it takes effect, with the enchantment's flourish. */
  grantUpgrade(hero, u) {
    hero.upgradeLevels[u.id] = 1;
    u.apply?.(hero);
    this.enchantFx(hero, u);
  }

  // Shop actions are commands, so every machine applies them on the same tick.

  /** Upgrade store: buy one of the hero's three offers (as many as they can pay for; each costs more). */
  buyUpgrade(hero, id) {
    const st = this.shopState(hero);
    const u = upgradeOffers(this, hero).find((x) => x && x.id === id);
    const price = upgradePrice(hero);
    const ok = !!u && !hero.upgradeLevels[id] && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      hero.upgradesBought = (hero.upgradesBought || 0) + 1;
      st.boughtHere.push(id);
      this.grantUpgrade(hero, u);
    }
    this.world.events.onPurchase?.(hero, 'upgrade', ok);
  }

  /**
   * The enchantment binding to a hero: a spinning rune circle on the floor,
   * a pillar of light in the upgrade's colour and sparks rising around them.
   */
  enchantFx(hero, u) {
    const w = this.world;
    const rgb = hexToRgb(u.color).join(', ');
    w.effects.add(1.6, (ctx, t) => {
      const x = hero.x;
      const y = hero.y;
      const grow = Math.min(1, t * 4);
      const fade = t < 0.75 ? 1 : (1 - t) * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.scale(1, 0.5);
      ctx.rotate(t * 3);
      ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
      ctx.lineWidth = 2;
      for (const r of [44 * grow, 32 * grow]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      // runes round the ring
      ctx.fillStyle = `rgba(${rgb}, 1)`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.fillRect(Math.cos(a) * 38 * grow - 2, Math.sin(a) * 38 * grow - 3, 4, 6);
      }
      ctx.restore();
    }, true);
    w.effects.add(1.2, (ctx, t) => {
      const x = hero.x;
      const y = hero.y;
      const wdt = 26 * (1 - t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 180, 0, y);
      g.addColorStop(0, `rgba(${rgb}, 0)`);
      g.addColorStop(1, `rgba(${rgb}, ${0.55 * (1 - t)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - wdt / 2, y - 180, wdt, 180);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - t)})`;
      ctx.fillRect(x - wdt / 6, y - 180, wdt / 3, 180);
      ctx.restore();
    });
    w.effects.burst(hero.hx, hero.hy, { count: 40, colors: [u.color, '#ffffff', '#fff6c8'], speed: [30, 120], life: [0.6, 1.2], up: 90, size: [1, 3] });
    w.effects.text(hero.hx, hero.hy - 50, u.name.toUpperCase(), { color: u.color, size: 10, life: 1.8, rise: 30 });
  }

  /** Every potion price in this stage's shop is multiplied by this (shops cost more deeper in). */
  get priceScale() { return this.byStage(CONFIG.run.shop.stagePrice); }

  /** Upgrade store: pay to swap the three offers for three new ones. */
  rerollUpgrades(hero) {
    const st = this.shopState(hero);
    const price = rerollPrice(st.rerolls, hero);
    const ok = hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      st.rerolls++;
      st.boughtHere = [];
    }
    this.world.events.onPurchase?.(hero, 'reroll', ok);
  }

  /** Potion store: buy one potion off the shared shelf into the hero's bag. */
  buyPotion(hero, id) {
    const s = this.potionStock.find((x) => x.id === id);
    const pot = POTIONS[id];
    const price = pot ? potionPrice(this, id, hero) : Infinity;
    const ok = !!s && !!pot && s.left > 0 && hero.coins >= price && hero.canCarry(id);
    if (ok) {
      hero.coins -= price;
      s.left--;
      hero.addItem(id);
    }
    this.world.events.onPurchase?.(hero, 'potion', ok);
  }

  /** Sell stall: what the stall pays for one of this potion (a share of its base price). */
  potionSellPrice(id) {
    return Math.max(1, Math.floor(POTIONS[id].price * CONFIG.run.shop.sell.potion));
  }

  /** Sell stall: hand back an upgrade for a few coins; its effect comes off. */
  sellUpgrade(hero, id) {
    const u = UPGRADE_BY_ID[id];
    const ok = !!u && !!hero.upgradeLevels[id] && (!u.canSell || u.canSell(hero));
    if (ok) {
      delete hero.upgradeLevels[id];
      u.remove?.(hero);
      hero.coins += CONFIG.run.shop.sell.upgrade;
    }
    this.world.events.onPurchase?.(hero, 'sellUpgrade', ok);
  }

  /** Sell stall: sell one potion out of a bag slot. */
  sellPotion(hero, slot) {
    const s = hero.inventory[slot];
    const ok = !!s && !!POTIONS[s.id];
    if (ok) {
      hero.coins += this.potionSellPrice(s.id);
      if (--s.count <= 0) hero.inventory[slot] = null;
    }
    this.world.events.onPurchase?.(hero, 'sellPotion', ok);
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
    this.releaseSoul(e);
    Upgrades.onKill(this, e);
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

  /** Defend rooms: a slain enemy's soul flies into the lantern and mends it (tougher enemies mend more). */
  releaseSoul(e) {
    const t = this.totem;
    if (!t || t.dead || e.exploded) return;
    const c = CONFIG.run.defendSouls;
    const tough = clamp((e.cfg.hp || e.maxHp) / c.soulRefHp, c.soulScale[0], c.soulScale[1]);
    t.addSoul(e.hx, e.hy, t.maxHp * c.soulHeal * tough * (e.owner ? c.summonedSoul : 1));
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
      if (a === this.totem || a.prop) continue;
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
    // a secret-room mimic (walled off, no doors) doesn't hold up a room fight elsewhere
    const allDead = !w.enemies.some((e) => !e.secret) && w.pendingSpawns === 0;
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
            if (w.enemies.length + w.pendingSpawns < Math.round(this.byStage(c.maxAlive) * w.playerScale.count)) this.spawnIn(r, this.pickEnemy(counts));
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
          const spot = this.portalSpot(r);
          // after the run's last boss a blue portal opens to the gem vault
          const vault = !this.practiceBoss && !!this.floor.vaultRoom;
          const label = this.practiceBoss ? 'RETURN TO RANGE' : vault ? 'ENTER THE GEM VAULT' : this.stage < 3 ? 'ENTER PORTAL' : 'ESCAPE';
          this.portal = { kind: 'portal', x: spot.x, y: spot.y, label, vault };
          w.banner(`${r.bossName} DEFEATED`, this.practiceBoss ? 'Enter the portal to go back to the practice range' : vault ? 'A blue portal opens to the gem vault' : this.stage < 3 ? 'Enter the portal to go deeper' : 'Enter the portal to escape', 3);
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
    // somewhere in the room, away from every hero
    const tooClose = (pt) => w.heroes.some((p) => dist(pt.x, pt.y, p.x, p.y) < 170);
    let pt = this.floor.randomPointIn(r, 2);
    for (let i = 0; i < 20 && tooClose(pt); i++) pt = this.floor.randomPointIn(r, 2);
    pt = this.floor.freePoint(pt.x, pt.y, 10, 8);   // never inside cover
    w.spawnEnemy(type, pt.x, pt.y);
  }

  spawnWave(r) {
    const c = CONFIG.run.combat;
    r.wave++;
    const n = Math.round((this.byStage(c.perWave) + randInt(0, c.perWaveRandom)) * this.world.playerScale.count);
    const counts = {};
    for (let i = 0; i < n; i++) this.spawnIn(r, this.pickEnemy(counts));
    this.world.banner(`WAVE ${r.wave}/${r.waves}`, '', 1.2);
  }

  // ---------- the first waves, waiting in their rooms ----------

  /**
   * Every combat room's first wave is already there when the stage begins, idling and
   * milling about where you can see them through the doorways. They take no notice
   * (and can't be hurt) until someone walks in and the doors slam: then they attack,
   * and the later waves spawn in as usual.
   */
  populate() {
    const f = this.floor;
    const T = f.T;
    const c = CONFIG.run.combat;
    for (const r of f.rooms) {
      if (r.type !== 'combat' || r.state !== 'idle') continue;
      const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ x: (t % f.cols + 0.5) * T, y: (Math.floor(t / f.cols) + 0.5) * T }));
      const n = Math.round((this.byStage(c.perWave) + randInt(0, c.perWaveRandom)) * this.world.playerScale.count);
      const counts = {};
      for (let i = 0; i < n; i++) {
        let pt = f.randomPointIn(r, 2);
        for (let k = 0; k < 20 && (doors.some((d) => dist(d.x, d.y, pt.x, pt.y) < 5 * T) || (this.hole && this.hole.room === r && dist(this.hole.x, this.hole.y, pt.x, pt.y) < 60)); k++) pt = f.randomPointIn(r, 2);
        pt = f.freePoint(pt.x, pt.y, 10, 8);
        const e = createEnemy(this.pickEnemy(counts), pt.x, pt.y);
        this.world.scaleEnemy(e);
        const wait = (s) => {
          s.age = 5;
          s.room = r;
          s.home = { x: s.x, y: s.y };
          s.goal = null;
          s.idle = rand(0.5, 4);
          s.facing = Math.random() < 0.5 ? 1 : -1;
          this.sleepers.push(s);
        };
        wait(e);
        this.world.addCompanions(e, wait);   // the clay slimes' other two, the ancient light's totem
      }
    }
  }

  /** The waiting enemies idle, now and then wandering a few steps from where they stand. */
  updateSleepers(dt) {
    const w = this.world;
    for (const e of this.sleepers) {
      e.animTime += dt;
      e.moving = false;
      if (e.idle > 0 || !(e.speed > 0)) { e.idle -= dt; continue; }
      if (!e.goal) e.goal = { x: e.home.x + rand(-60, 60), y: e.home.y + rand(-40, 40) };
      const x0 = e.x;
      const y0 = e.y;
      e.moveAngle(w, angleTo(e.x, e.y, e.goal.x, e.goal.y), e.speed * 0.3, dt);
      if (dist(e.x, e.y, e.goal.x, e.goal.y) < 4 || dist(x0, y0, e.x, e.y) < e.speed * 0.3 * dt * 0.3) {
        e.goal = null;
        e.idle = rand(1.5, 4.5);
      }
    }
  }

  /** Someone walked into r: its waiting enemies notice ("!") and the fight is on. False if it had none. */
  wakeRoom(r) {
    const w = this.world;
    const list = this.sleepers.filter((e) => e.room === r);
    if (!list.length) return false;
    this.sleepers = this.sleepers.filter((e) => e.room !== r);
    for (const e of list) {
      e.moving = false;
      e.attackCooldown = rand(0.6, 1.3);
      e.setState('chase');
      w.enemies.push(e);
      w.effects.text(e.x, e.y - e.barOffset - 6, '!', { color: '#ff5a4a', size: 12, life: 0.8, rise: 18 });
    }
    r.wave = 1;
    w.banner(`WAVE 1/${r.waves}`, '', 1.2);
    return true;
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
    w.pendingSummons = 0;
    w.enemyProjectiles = [];
  }

  // ---------- defend ----------

  startDefend(r, again = false) {
    const c = CONFIG.run.defend;
    r.timeLeft = this.byStage(c.duration);
    r.timeTotal = r.timeLeft;
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
      for (let i = 0; i < Math.round(this.byStage(c.perWave) * w.playerScale.count); i++) this.spawnIn(r, this.pickEnemy(counts));
    }
    if (r.timeLeft <= 0) {
      this.banishEnemies();
      this.finish(r);
    }
  }

  // ---------- boss ----------

  startBoss(r) {
    const w = this.world;
    const type = this.bossType;
    const T = this.floor.T;
    // the Queen stands before her bell; the King sits on his throne at the top of the room; the Princess
    // sits at her desk by the top wall; the Prince's horse pulls up in the middle of the yard
    const at = {
      queen: { x: r.cx, y: r.cy + 3.5 * T },
      king: { x: r.cx, y: (r.y0 + 5) * T - 30 },
      princess: { x: r.cx, y: (r.y0 + 4) * T - 6 },
      prince: { x: r.cx, y: r.cy },
    }[type] || { x: r.cx, y: r.cy - 20 };
    w.boss = Game.createBoss(type, at);
    const s = this.scale;
    const b = w.boss;
    // stage x party size, and in the later stages a little extra on top for bosses (the heroes have upgrades by then)
    const hp = s.hp * (s.bossHp || 1) * w.playerScale.hp;
    if (b.scaleHealth) b.scaleHealth(hp);   // the golem's health is in its parts
    else {
      b.maxHp = Math.round(b.maxHp * hp);
      b.hp = b.maxHp;
    }
    b.cfg = scaleBossDamage(b.cfg, s.damage * (s.bossDamage || 1) * w.playerScale.damage * CONFIG.enemyDamage);
    r.bossName = b.name;
    r.bossDown = false;
    Music.play('boss');
    // its entrance plays as a cutscene that ends on its title card, then the fight starts
    w.beginBossIntro(`${b.title} - Stage ${this.stage}`);
  }

  onBossDefeated() {
    const r = this.active;
    if (r && r.type === 'boss') {
      r.bossDown = true;
      const [lo, hi] = CONFIG.run.coins.boss;
      this.spawnCoins(r.cx, r.cy, randInt(lo, hi));
      // a ring of hearts around where the portal will open, to patch up before going deeper
      const n = CONFIG.run.bossHearts;
      const spot = this.portalSpot(r);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * TAU;
        const pt = this.floor.freePoint(spot.x + Math.cos(a) * 70, spot.y + Math.sin(a) * 50, 6, 6);
        this.world.pickups.push(new HeartPickup(pt.x, pt.y));
      }
      this.world.effects.burst(r.cx, r.cy - 10, { count: 24, colors: ['#ff5a6a', '#ffb0b8', '#ffffff'], speed: [60, 160], life: [0.3, 0.7], up: 40 });
    }
    Music.play('battle');
  }

  /** Where a beaten boss room's portal opens (in the garden: on the lawn before the bell, not under it). */
  portalSpot(r) {
    return this.bossType === 'queen' ? { x: r.cx, y: r.cy + 3.4 * this.floor.T } : { x: r.cx, y: r.cy };
  }

  /** Someone used the portal: the whole party goes on to the next stage (or out, after the last). */
  enterPortal() {
    const portal = this.portal;
    this.portal = null;
    if (this.practiceBoss) this.world.events.onPracticeReturn?.();   // boss practice: back to the range
    else if (portal.vault) this.enterVault();
    else if (portal.exit || this.stage >= 3) this.victory();
    else this.nextStage();
  }

  // ---------- gems ----------

  /** The last boss's blue portal: the whole party (bodies too) goes through to the gem vault. */
  enterVault() {
    const w = this.world;
    const r = this.floor.vaultRoom;
    const T = this.floor.T;
    this.visit(r);
    w.players.forEach((p, i) => {
      const off = Game.spawnOffset(i);
      this.travel(p, r.cx + off.x, r.cy + 3 * T + off.y);
    });
    w.banner('THE GEM VAULT', 'Open the chest to claim your gems', 3);
    Sound.play('phantomAppear');
  }

  /**
   * The vault's chest: it bursts open in blue light and a fountain of gems pours out to every
   * hero; every player gets CONFIG.gems.win on their profile (events.onGems, on each machine
   * for its own player). Then the portal out of the dungeon opens.
   */
  openGemChest(pr) {
    const w = this.world;
    const n = CONFIG.gems.win;
    this.chestPop(pr, () => {
      w.gemsEarned = n;
      w.events.onGems?.(n);
      this.gemFountain(pr.x, pr.y - 16, 36);
      w.effects.text(pr.x, pr.y - 52, `+${n} GEMS`, { color: '#8ac8ff', size: 12, life: 2.4 });
      w.banner('GEMS CLAIMED', 'Step into the portal to leave the dungeon', 3);
      w.after(1.2, () => {
        const r = pr.room;
        this.portal = { kind: 'portal', x: r.cx, y: r.cy + 2.6 * this.floor.T, label: 'LEAVE THE DUNGEON', exit: true };
        Sound.play('phantomAppear');
      });
    }, ['#3a8aff', '#8ac8ff', '#ffffff']);
  }

  /** Gems spray up out of (x, y), tumble, then each streams into one of the heroes (visual only). */
  gemFountain(x, y, count) {
    const w = this.world;
    const heroes = w.players;
    for (let i = 0; i < count; i++) {
      const img = Sprites.vault.gems[i % Sprites.vault.gems.length];
      const hero = heroes[i % heroes.length];
      const a = -Math.PI / 2 + vrand(-1.1, 1.1);
      const v = vrand(90, 190);
      const delay = i * 0.03;
      const life = 1.4 + delay;
      w.effects.add(life, (ctx, t) => {
        const s = t * life - delay;
        if (s < 0) return;
        // flung out under gravity for 0.6s, then pulled into the hero
        const fx = x + Math.cos(a) * v * Math.min(s, 0.6);
        const fy = y + Math.sin(a) * v * Math.min(s, 0.6) + 260 * Math.min(s, 0.6) ** 2;
        const k = clamp((s - 0.6) / 0.6, 0, 1) ** 2;
        const gx = lerp(fx, hero.x, k);
        const gy = lerp(fy, hero.y - 20, k);
        if (k >= 1) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, gx, gy, 10, '120, 190, 255', 0.5);
        ctx.restore();
        ctx.drawImage(img, Math.round(gx - img.width / 2), Math.round(gy - img.height / 2));
      });
    }
    for (let i = 0; i < 8; i++) w.after(0.9 + i * 0.08, () => Sound.play('coin', 0.3));
  }

  /**
   * Gems for a run that ended in a wipe: deathShare of a win's gems, times how much of the run
   * was done (each stage a third: its fight rooms roomShare of that, its boss the rest).
   * Nothing for boss practice.
   */
  gemsForProgress() {
    if (this.practiceBoss) return 0;
    const G = CONFIG.gems;
    const rooms = this.floor.rooms.filter((r) => LOCKING_ROOMS.includes(r.type) && r.type !== 'boss');
    const cleared = rooms.filter((r) => r.state === 'cleared').length;
    const bossDown = this.floor.bossRoom?.bossDown ? 1 : 0;
    const stage = (rooms.length ? cleared / rooms.length : 1) * G.roomShare + bossDown * (1 - G.roomShare);
    const done = clamp((this.stage - 1 + stage) / 3, 0, 1);
    return Math.floor(G.win * G.deathShare * done);
  }

  // ---------- room layouts ----------

  /**
   * Lays out a fight room's obstacles in a pattern, Soul Knight style: one of ROOM_LAYOUTS,
   * mirrored into all four quarters of the room round its middle, built from the theme's
   * pieces (CONFIG.themes[id].layout: headstones or crates, tombs or statues, walls, blocks).
   * The pattern keeps off the cross through the room's middle, so every doorway has a clear
   * run in and the middle stays open; a mirrored group that won't fit (a doorway, the edge)
   * is left out whole, so the room stays symmetrical. Big rockets can knock any of it down.
   */
  addLayout(r) {
    const units = this.theme.layout;
    if (!units) return;
    const f = this.floor;
    const T = f.T;
    const W = r.x1 - r.x0 + 1;
    const H = r.y1 - r.y0 + 1;
    const kx = W / 24;   // patterns are drawn for a 24x16 room and stretched to fit
    const ky = H / 16;
    const cx = Math.floor((r.x0 + r.x1 + 1) / 2);
    const cy = Math.floor((r.y0 + r.y1 + 1) / 2);
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    const fits = (tx, ty, w, h) => {
      if (tx < r.x0 + 1 || ty < r.y0 + 2 || tx + w - 1 > r.x1 - 1 || ty + h - 1 > r.y1 - 1) return false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (f.grid[ty + j][tx + i] !== TILE.FLOOR) return false;
      if (doors.some((d) => d.tx >= tx - 3 && d.tx <= tx + w + 2 && d.ty >= ty - 3 && d.ty <= ty + h + 2)) return false;
      return !this.cover.some((o) => tx < o.tx + o.w + 1 && tx + w + 1 > o.tx && ty < o.ty + o.h + 1 && ty + h + 1 > o.ty);
    };
    for (const [unit, cdx, cdy, w, h] of choose(ROOM_LAYOUTS)) {
      // the top-left copy (its near corner cdx, cdy tiles from the middle), mirrored to the other three
      const tx = cx - Math.round(cdx * kx) - w;
      const ty = cy - Math.round(cdy * ky) - h;
      const copies = [[tx, ty], [r.x0 + r.x1 - tx - (w - 1), ty], [tx, r.y0 + r.y1 - ty - (h - 1)], [r.x0 + r.x1 - tx - (w - 1), r.y0 + r.y1 - ty - (h - 1)]];
      if (!copies.every(([x, y]) => fits(x, y, w, h))) continue;
      const seed = Math.floor(Math.random() * 1000);
      for (const [x, y] of copies) {
        // a stack of the small piece fills its area one tile at a time; anything else is one piece
        const kind = units[unit];
        const parts = unit === 'small' ? [...Array(w * h).keys()].map((i) => [x + (i % w), y + Math.floor(i / w), 1, 1]) : [[x, y, w, h]];
        for (const [px, py, pw, ph] of parts) {
          this.cover.push({ kind, tx: px, ty: py, w: pw, h: ph, x: px * T, y: py * T, seed: seed + px + py, room: r, material: this.coverMaterial(kind) });
          for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) f.grid[py + j][px + i] = TILE.COVER;
        }
      }
    }
  }

  /** What a piece of cover is made of (picks its rubble when it's blown apart). */
  coverMaterial(kind) {
    return { crates: 'wood', study: 'wood' }[kind] || 'stone';
  }

  /**
   * A big blast at (x, y): every obstacle (walls, cover, solid decor) with a tile within r
   * is knocked down: its tiles become floor again and rubble is left where it stood.
   * Boss-room fixtures (the throne, the bell, the desk) hold. Returns how many fell.
   */
  destroyObstacles(x, y, r) {
    const T = this.floor.T;
    let n = 0;
    for (const o of this.cover) {
      if (o.fixed || o.dead) continue;
      // nearest point of its footprint to the blast
      const nx = clamp(x, o.x, o.x + o.w * T);
      const ny = clamp(y, o.y, o.y + o.h * T);
      if (dist(x, y, nx, ny) > r) continue;
      this.knockDown(o);
      n++;
    }
    removeDead(this.cover);
    if (n) Sound.play('partBreak');
    return n;
  }

  /**
   * Knocks down everything solid in room r: all its cover and solid decor, even the pieces no
   * blast can move, and the posts of its braziers and furniture (the decor goes with them).
   * The golem does this as it curls up to roll, so nothing in its room can stop the ball.
   * Only the hidden fixtures (a throne's solid back, stairs) stay. Returns how many fell.
   */
  clearRoom(r) {
    const f = this.floor;
    const inRoom = (tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
    let n = 0;
    for (const o of this.cover) {
      if (o.dead || o.hidden || !inRoom(o.tx, o.ty)) continue;
      this.knockDown(o);
      n++;
    }
    removeDead(this.cover);
    for (const d of this.decor.items) {
      if (!d.post || d.dead || !inRoom(Math.floor(d.x / f.T), Math.floor((d.y - 2) / f.T))) continue;
      f.removePost(d.post);
      d.dead = true;
      n++;
      this.world.effects.burst(d.x, d.y - 14, { count: 16, colors: ['#56546a', '#8e8ca2', '#3e3c4c', '#ffb02e'], speed: [80, 240], life: [0.4, 0.8], up: 110, gravity: 420, size: [2, 4] });
      this.world.effects.smoke(d.x, d.y - 8, { count: 4, radius: 12, life: 0.8, rise: 18, colors: ['#3a3430', '#5a524a', '#8a8070'] });
      this.rubble.push({ x: d.x, y: d.y - 2, material: 'stone', seed: Math.round(d.x * 3 + d.y) });
    }
    for (const b of this.barrels) if (b.room === r && !b.dead) { Barrels.burst(this.world, b, 0.1 + n * 0.02); n++; }
    if (n) Sound.play('partBreak');
    return n;
  }

  /** One obstacle falls: its tiles are floor again, rubble is left on them, debris and dust fly. */
  knockDown(o) {
    const f = this.floor;
    const T = f.T;
    o.dead = true;
    for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
      if (f.grid[o.ty + j][o.tx + i] === TILE.COVER) f.grid[o.ty + j][o.tx + i] = TILE.FLOOR;
      this.rubble.push({ x: (o.tx + i + 0.5) * T, y: (o.ty + j + 0.75) * T, material: o.material || this.coverMaterial(o.kind), seed: o.tx * 7 + o.ty * 13 + i * 3 + j });
    }
    if (o.item) o.item.dead = true;   // solid decor goes with it
    const cx = o.x + (o.w * T) / 2;
    const cy = o.y + (o.h * T) / 2;
    const colors = { wood: ['#5b3922', '#9c6c3e', '#3b2416'], metal: ['#585d6c', '#adb2c0', '#383b48'], plant: ['#264228', '#6a9a52', '#5b3922'] }[o.material] || ['#56546a', '#8e8ca2', '#3e3c4c'];
    this.world.effects.burst(cx, cy - 10, { count: 14 + o.w * o.h * 4, colors, speed: [80, 260], life: [0.4, 0.9], up: 120, gravity: 420, size: [2, 4] });
    this.world.effects.smoke(cx, cy - 6, { count: 3 + o.w * o.h, radius: 14, life: 0.9, rise: 18, colors: ['#3a3430', '#5a524a', '#8a8070'] });
  }

  /** Rubble left by knocked-down obstacles, flat on the floor under everyone. */
  drawRubble(ctx) {
    const cam = this.world.camera;
    for (const b of this.rubble) {
      if (b.x < cam.x - 40 || b.x > cam.x + cam.width + 40 || b.y < cam.y - 40 || b.y > cam.y + cam.height + 40) continue;
      const set = Sprites.rubble[b.material] || Sprites.rubble.stone;
      const img = set[b.seed % set.length];
      ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - img.height / 2));
    }
  }

  /**
   * The King's throne is solid from the wall down to its seat, the whole height of its
   * tall back, so heroes can't walk up behind it (and it's drawn under them, see CastleDecor.sortY).
   */
  solidThrone(r) {
    const f = this.floor;
    const mid = Math.round((r.x0 + r.x1 + 1) / 2);
    for (let ty = r.y0; ty <= r.y0 + 3; ty++) for (let tx = mid - 2; tx < mid + 2; tx++) f.grid[ty][tx] = TILE.COVER;
    // (no art of its own: the throne decor draws it; fixed, so no blast knocks it down)
    this.cover.push({ kind: 'throne', tx: mid - 2, ty: r.y0, w: 4, h: 4, x: (mid - 2) * f.T, y: r.y0 * f.T, seed: 0, room: r, fixed: true, item: null, hidden: true });
  }

  /**
   * The manor's grand staircase is solid: its landing the width of the stairs along the top
   * wall, and the main flight down from it to the hall floor (see MANOR_STAIRS; ManorDecor draws it).
   */
  manorStairs(r) {
    const f = this.floor;
    const mid = Math.round((r.x0 + r.x1 + 1) / 2);
    const solid = (tx, ty, w, h) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f.grid[ty + j][tx + i] = TILE.COVER;
      this.cover.push({ kind: 'stairs', tx, ty, w, h, x: tx * f.T, y: ty * f.T, seed: 0, room: r, fixed: true, item: null, hidden: true });
    };
    const L = MANOR_STAIRS.landingTiles;
    const F = MANOR_STAIRS.flightTiles;
    solid(mid - L / 2, r.y0, L, 1);
    solid(mid - F / 2, r.y0 + 1, F, 3);
  }

  /**
   * The Princess's study: solid bookshelves and tables standing about the floor (cover from
   * her bolts and arrows), in pairs either side of the middle, clear of her desk and the doors.
   */
  studyCover(r) {
    const f = this.floor;
    const T = f.T;
    const mid = Math.round((r.x0 + r.x1 + 1) / 2);
    // [prop, first column from the middle, row from the top wall, width, height] in tiles
    const pieces = [
      ['bookshelf', -9, 7, 2, 1], ['bookshelf', 7, 7, 2, 1],
      ['readingTable', -5, 11, 2, 1], ['readingTable', 3, 11, 2, 1],
      ['bookshelf', -9, 15, 2, 1], ['bookshelf', 7, 15, 2, 1],
      ['table', -1, 15, 2, 1],
    ];
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    for (const [prop, dx, dy, w, h] of pieces) {
      const tx = mid + dx;
      const ty = r.y0 + dy;
      if (ty + h > r.y1 || doors.some((d) => d.tx >= tx - 3 && d.tx <= tx + w + 2 && d.ty >= ty - 3 && d.ty <= ty + h + 2)) continue;
      this.cover.push({ kind: 'study', prop, tx, ty, w, h, x: tx * T, y: ty * T, seed: 0, room: r });
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f.grid[ty + j][tx + i] = TILE.COVER;
    }
  }

  /**
   * Solid cover pieces: each [kind, first column from the middle, row from the room's middle row,
   * width, height] in tiles (kind a Sprites.cover set; seed picks the variant). Skips any that
   * would land on a doorway's approach or off the floor.
   */
  bossCover(r, pieces) {
    const f = this.floor;
    const T = f.T;
    const mid = Math.round((r.x0 + r.x1 + 1) / 2);
    const midY = Math.floor((r.y0 + r.y1 + 1) / 2);
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    pieces.forEach(([kind, dx, dy, w, h], i) => {
      const tx = mid + dx;
      const ty = midY + dy;
      if (tx < r.x0 + 1 || tx + w > r.x1 || ty < r.y0 + 2 || ty + h > r.y1) return;
      if (doors.some((d) => d.tx >= tx - 3 && d.tx <= tx + w + 2 && d.ty >= ty - 3 && d.ty <= ty + h + 2)) return;
      this.cover.push({ kind, tx, ty, w, h, x: tx * T, y: ty * T, seed: i, room: r, material: 'stone' });
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) f.grid[ty + j][tx + k] = TILE.COVER;
    });
  }

  /**
   * The Clay Golem's room in the ruins: broken columns and mossy rock piles in a ring inside the
   * braziers, cover from its orbs and beams. When it curls up and rolls, it smashes straight through them.
   */
  guardianCover(r) {
    this.bossCover(r, [
      ['ruinPillar', -6, -2, 1, 1], ['ruinPillar', 5, -2, 1, 1], ['ruinPillar', -6, 3, 1, 1], ['ruinPillar', 5, 3, 1, 1],
      ['ruinRocks', -3, 4, 1, 1], ['ruinRocks', 2, 4, 1, 1], ['ruinRocks', -10, 0, 1, 1], ['ruinRocks', 9, 0, 1, 1],
    ]);
  }

  /**
   * The Guardian's crystal cavern: rocks split open by crystals in a wide ring (out past the giant
   * rocks it rises from), cover from its beam until its phase 2 beam smashes through them.
   */
  crystalCover(r) {
    this.bossCover(r, [
      ['ruinCrystal', -7, -2, 1, 1], ['ruinCrystal', 6, -2, 1, 1], ['ruinCrystal', -7, 3, 1, 1], ['ruinCrystal', 6, 3, 1, 1],
      ['ruinCrystal', -3, 5, 1, 1], ['ruinCrystal', 2, 5, 1, 1], ['ruinRocks', -11, 0, 1, 1], ['ruinRocks', 10, 0, 1, 1],
    ]);
  }

  /**
   * The Deathbringer's room: four obsidian sarcophagi in a ring round the middle, where its portal
   * opens. They stand in the way of its waves of darkness (cover to duck behind); it floats over them.
   */
  cryptTombs(r) {
    this.bossCover(r, [
      ['darkTomb', -8, -3, 2, 1], ['darkTomb', 6, -3, 2, 1],
      ['darkTomb', -8, 4, 2, 1], ['darkTomb', 6, 4, 2, 1],
    ]);
  }

  /**
   * The King's throne room: two rows of great pillars down the hall either side of the carpet (well
   * clear of it and of the braziers lining it): something to lead him round once he waddles after
   * you in phase 2, and to break up the hall his guards march down.
   */
  throneHallPillars(r) {
    const pieces = [];
    for (const dy of [-2, 2, 6]) for (const dx of [-9, 8]) pieces.push(['pillar', dx, dy, 1, 1]);
    this.bossCover(r, pieces);
  }

  /** True if (x, y) is within `pad` px of any piece of cover. */
  nearCover(x, y, pad) {
    return this.cover.some((o) => x > o.x - pad && x < o.x + o.w * this.floor.T + pad && y > o.y - pad && y < o.y + o.h * this.floor.T + pad);
  }

  /** A piece of cover in the dungeon's style (bottom of its tiles at y). */
  drawCover(ctx, o) {
    const T = this.floor.T;
    const bx = Math.round(o.x + (o.w * T) / 2);
    const by = Math.round(o.y + o.h * T);
    if (o.prop) {
      // the study's furniture (see studyCover)
      const pr = Sprites.props[o.prop];
      drawShadow(ctx, bx, by - 3, (o.w * T) / 2 + 2, 6, 0.4);
      if (pr) ctx.drawImage(pr.img, bx - pr.ax, by - pr.ay - 1);
      return;
    }
    const set = Sprites.cover && Sprites.cover[o.kind];
    if (!set) return;
    const img = set[o.seed % set.length];
    drawShadow(ctx, bx, by - 3, (o.w * T) / 2 + 2, 6, 0.4);
    ctx.drawImage(img, bx - Math.round(img.width / 2), by - img.height);
  }

  // ---------- spike traps (combat rooms) ----------

  /** Square spike pads (2x2 or 4x4) in mirrored pairs round a combat room, clear of its middle, its doorways, its obstacles and each other. */
  addSpikes(r) {
    const c = CONFIG.run.spikes;
    const f = this.floor;
    const T = f.T;
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    const ok = (tx, ty, size) => {
      const cx = (tx + size / 2) * T;
      const cy = (ty + size / 2) * T;
      if (Math.abs(cx - r.cx) < (2.5 + size / 2) * T && Math.abs(cy - r.cy) < (2 + size / 2) * T) return false;
      if (doors.some((d) => d.tx >= tx - 3 && d.tx <= tx + size + 2 && d.ty >= ty - 3 && d.ty <= ty + size + 2)) return false;
      if (this.cover.some((o) => tx < o.tx + o.w + 1 && tx + size + 1 > o.tx && ty < o.ty + o.h + 1 && ty + size + 1 > o.ty)) return false;
      return !this.spikePads.some((p) => tx < p.tx + p.size + 1 && tx + size + 1 > p.tx && ty < p.ty + p.size + 1 && ty + size + 1 > p.ty);
    };
    const addPad = (tx, ty, size, offset) => {
      const pad = { tx, ty, size, x: tx * T, y: ty * T, offset, hits: new Set() };
      this.spikePads.push(pad);
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) this.spikes.push({ tx: tx + i, ty: ty + j, x: (tx + i) * T, y: (ty + j) * T, offset, pad });
      }
    };
    // pads come in mirrored pairs, one either side of the room, firing together
    const n = randInt(c.pads[0], c.pads[1]);
    for (let k = 0, placed = 0; k < 60 && placed < n; k++) {
      const size = Math.random() < c.bigChance ? 4 : 2;
      const tx = randInt(r.x0 + 1, Math.floor((r.x0 + r.x1) / 2) - size);
      const ty = randInt(r.y0 + 1, r.y1 - size);
      const mx = r.x0 + r.x1 - tx - (size - 1);
      if (!ok(tx, ty, size) || !ok(mx, ty, size) || mx < tx + size + 1) continue;
      const offset = rand(0, c.period);
      addPad(tx, ty, size, offset);
      addPad(mx, ty, size, offset);
      placed += 2;
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

  /** A pad's spikes hurt whoever stands on it when they shoot up: once per hero per thrust. */
  updateSpikes() {
    const T = this.floor.T;
    for (const pad of this.spikePads) {
      if (this.spikeState(pad) !== 1) { pad.hits.clear(); continue; }
      const w = pad.size * T;
      for (const a of this.world.allies) {
        if (a.flying || pad.hits.has(a)) continue;   // the bird flies over
        if (a.x > pad.x && a.x < pad.x + w && a.y > pad.y && a.y < pad.y + w && a.hurt(CONFIG.run.spikes.damage, this.world, a.x, a.y + 10, { trap: true })) pad.hits.add(a);
      }
    }
  }

  // ---------- shops, specials, secret rooms (placeholders) ----------

  addProps(r) {
    const T = this.floor.T;
    const add = (kind, dx, dy, label, color) => this.props.push({ kind, room: r, x: r.cx + dx * T, y: r.cy + dy * T, label, color });
    if (r.type === 'shop') {
      // three stalls in a row across the middle of the room: Mira's potions on the left,
      // Tobin's trade-ins (buying upgrades and potions back) in the middle, Bram's enchantments on the right
      add('shopkeeper', -6.5, 1, 'POTIONS', '#ff8aa0');
      add('pawn', 0, 1, 'SELL', '#ffd34a');
      add('enchanter', 6.5, 1, 'UPGRADES', '#8ab8ff');
      this.potionStock = rollPotionStock();
    } else if (r.type === 'special') {
      const info = SPECIAL_INFO[r.special];
      if (r.special === 'treasure') for (const dx of [-3, 0, 3]) add('chest', dx, 0, 'TREASURE CHEST', info.color);
      else add(r.special, 0, -0.5, info.name, info.color);
    } else if (r.type === 'puzzle') {
      // Simon's stone, and a row of its four coloured floor plates in front of it
      add('puzzle', 0, -1.5, 'RUNE STONE', ROOM_INFO.puzzle.color);
      const stone = this.props[this.props.length - 1];
      Object.assign(stone, { state: 'idle', wins: 0, strikes: 0, seq: [], step: 0, timer: 0, wrong: 0, nextBeep: 0, plates: [] });
      SIMON_COLORS.forEach((c, i) => {
        add('simonPlate', (i - 1.5) * 2.75, 2.5, '', c.color);
        const pl = this.props[this.props.length - 1];
        Object.assign(pl, { ground: true, i, lit: 0, on: false });
        stone.plates.push(pl);
      });
    } else if (r.type === 'secret') {
      // three chests, one of them a mimic; the party may open only `picks` of them
      const c = CONFIG.run.secret;
      const mimic = randInt(0, c.chests - 1);
      r.chestPicks = 0;
      for (let i = 0; i < c.chests; i++) {
        add('secretChest', (i - (c.chests - 1) / 2) * 4, 2.2, 'MYSTERY CHEST', '#fff6c8');   // below where heroes land
        this.props[this.props.length - 1].mimic = i === mimic;
      }
      add('holeExit', 0, -1.5, 'CLIMB UP', '#fff6c8');   // the way back up to the hole
    } else if (r.type === 'vault') {
      add('gemChest', 0, -0.6, 'GEM CHEST', '#7ac8ff');
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
      if (this.nearCover(pt.x, pt.y, 48)) continue;
      const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ x: (t % f.cols + 0.5) * T, y: (Math.floor(t / f.cols) + 0.5) * T }));
      if (doors.some((d) => dist(d.x, d.y, pt.x, pt.y) < 3 * T)) continue;
      this.hole = { kind: 'hole', room: r, x: pt.x, y: pt.y, label: 'JUMP IN', color: '#fff6c8' };
      this.props.push(this.hole);
      return;
    }
  }

  /** Down the hole into the secret room / back up beside the hole (just that hero). */
  descend(hero) {
    const secret = this.floor.rooms.find((r) => r.type === 'secret');
    this.travel(hero, secret.cx, secret.cy + this.floor.T);
    Sound.play('phantomVanish');
  }

  ascend(hero) {
    this.travel(hero, this.hole.x, this.hole.y + 40);
    Sound.play('phantomAppear');
  }

  travel(hero, x, y) {
    const w = this.world;
    const p = hero;
    w.effects.burst(p.hx, p.hy, { count: 24, colors: ['#fff6c8', '#ffd34a', '#b67aff'], speed: [40, 140], life: [0.3, 0.6], up: 40 });
    p.x = x;
    p.y = y;
    p.iframes = Math.max(p.iframes, 0.6);
    w.clones = w.clones.filter((c) => c.owner !== p);
    w.effects.burst(p.hx, p.hy, { count: 24, colors: ['#fff6c8', '#ffd34a', '#b67aff'], speed: [40, 140], life: [0.3, 0.6], up: 40 });
    if (p === w.localPlayer) {
      w.camera.follow(p.x, p.y - 16, 0, this.floor.width, this.floor.height, true);
      w.shake(4, 0.2);
    }
  }

  /**
   * Runs for each hero before they update, so pressing E at something here is
   * used up by the interaction and never also fires the hero's E ability.
   * Reward and secret chests open, the shopkeeper and chef talk, the wishing
   * well takes coins, the hole takes you down; the other special rooms aren't in yet.
   * hero.nearProp is what that hero could use right now (prompts show the local hero's).
   */
  preUpdate(hero) {
    const w = this.world;
    const p = hero;
    p.nearProp = null;
    if (this.active || p.dead) return;
    // the portal out of a beaten boss room waits for someone to step up and use it
    if (this.portal && dist(p.x, p.y, this.portal.x, this.portal.y) < 48) p.nearProp = this.portal;
    else for (const pr of this.props) {
      if (pr.opened || pr.ground) continue;
      if (pr.kind === 'puzzle' && pr.state !== 'idle') continue;   // busy with a pattern
      if (pr.kind === 'hole' && (pr.reveal || 0) < 1) continue;   // still under its trapdoor
      const reach = pr.kind === 'hole' || pr.kind === 'holeExit' ? dist(p.x, p.y, pr.x, pr.y) < 40 : dist(p.x, p.y, pr.x, pr.y + 10) < 44;
      if (reach) { p.nearProp = pr; break; }
    }
    const pr = p.nearProp;
    if (!pr || !Input.pressed('interact')) return;
    Input.consume('interact');
    if (pr.kind === 'portal') return this.enterPortal();
    if (pr.kind === 'rewardChest') return this.openChest(pr);
    if (pr.kind === 'secretChest') return this.openSecretChest(pr);
    if (pr.kind === 'gemChest') return this.openGemChest(pr);
    if (pr.kind === 'chest') return this.openTreasureChest(pr);
    if (pr.kind === 'wishingWell') return this.wish(pr, p);
    if (pr.kind === 'puzzle') return this.startPattern(pr);
    if (pr.kind === 'hole') return this.descend(p);
    if (pr.kind === 'holeExit') return this.ascend(p);
    if (pr.kind === 'shopkeeper' || pr.kind === 'chef' || pr.kind === 'enchanter' || pr.kind === 'pawn') return w.events.onNpc?.(pr.kind, this, p);
    if (pr.kind === 'restaurant5') return w.events.onNpc?.('chef', this, p);
    if (p === w.localPlayer) {
      w.events.onToast?.(`${pr.label}: COMING SOON`);
      Sound.play('uiClick');
    }
  }

  /** Opened chests animate their lid. */
  updateProps(dt = 0) {
    for (const pr of this.props) if (pr.opened) pr.t += dt;
    // the secret hole stays under its trapdoor until its room is cleared, then the trapdoor scrapes aside
    const h = this.hole;
    if (h && h.room.state === 'cleared' && (h.reveal || 0) < 1) {
      if (!h.reveal) {
        const w = this.world;
        w.effects.burst(h.x, h.y - 4, { count: 22, colors: ['#8a7a6a', '#6a5a48', '#fff6c8'], speed: [30, 110], life: [0.4, 0.9], up: 30 });
        w.effects.smoke(h.x + 20, h.y - 6, { count: 6, radius: 18, life: 0.8, rise: 16 });
        Sound.play('graveRumble');
      }
      h.reveal = Math.min(1, (h.reveal || 0) + dt / 0.9);
    }
  }

  /**
   * Opens a chest: it rattles, then (CHEST_POP later) the lid bursts open with a
   * flash, a puff of sparkles and a little shake, and loot() spills out.
   */
  chestPop(pr, loot, colors = ['#ffd34a', '#fff2a0', '#ffffff']) {
    const w = this.world;
    pr.opened = true;
    pr.t = 0;
    Sound.play('bounce', 0.05);
    w.after(CHEST_POP, () => {
      w.effects.burst(pr.x, pr.y - 16, { count: 36, colors, speed: [70, 200], life: [0.3, 0.8], up: 80, size: [1, 3] });
      w.effects.add(0.35, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 1 - t;
        PFX.ring(ctx, pr.x, pr.y - 6, 12 + t * 40, (12 + t * 40) * 0.45, colors[1], 2, { thick: t < 0.3 ? 2 : 1 });
        ctx.restore();
      });
      w.shake(2, 0.12);
      Sound.play('chestOpen');
      loot();
    });
  }

  openChest(pr) {
    const w = this.world;
    this.chestPop(pr, () => {
      // 5 coins for every hero in the party
      this.spawnCoins(pr.x, pr.y - 12, CONFIG.run.coins.roomChest * w.players.length);
      w.effects.text(pr.x, pr.y - 40, `+${CONFIG.run.coins.roomChest} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
      Upgrades.onChest(this, pr.x, pr.y);
    });
  }

  /**
   * Secret room chest: coins, a handful of random potions, or a mimic that
   * jumps out. After the party's last pick the other chests seal shut.
   */
  openSecretChest(pr) {
    const w = this.world;
    const c = CONFIG.run.secret;
    const r = pr.room;
    pr.opened = true;
    pr.t = 0;
    r.chestPicks++;
    if (r.chestPicks >= c.picks) {
      for (const o of this.props) {
        if (o.kind === 'secretChest' && o.room === r && !o.opened) { o.opened = true; o.sealed = true; }
      }
      w.effects.text(r.cx, r.cy - 20, 'THE OTHER CHESTS SEAL SHUT', { color: '#fff6c8', size: 8, life: 2 });
    }
    if (pr.mimic) {
      // the chest was never a chest
      pr.gone = true;
      const m = createEnemy('mimic', pr.x, pr.y);
      m.secret = true;
      w.addEnemy(m);
      w.effects.burst(pr.x, pr.y - 14, { count: 30, colors: ['#744420', '#e8b83a', '#e0507a', '#ffffff'], speed: [60, 180], life: [0.3, 0.7], up: 60 });
      w.effects.text(pr.x, pr.y - 44, 'MIMIC!', { color: '#ff5a4a', size: 10, life: 1.2 });
      w.shake(5, 0.25);
      Sound.play('windup');
      return;
    }
    this.chestPop(pr, () => {
      if (Math.random() < 0.5) {
        const n = randInt(c.coins[0], c.coins[1]);
        this.spawnCoins(pr.x, pr.y - 12, n);
        w.effects.text(pr.x, pr.y - 44, `+${n} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
      } else {
        const n = randInt(c.potions[0], c.potions[1]);
        this.spawnPotions(pr.x, pr.y, n, () => choose(Object.keys(POTIONS)));
        w.effects.text(pr.x, pr.y - 44, `${n} POTIONS!`, { color: '#ff8aa0', size: 9, life: 1.2 });
      }
    }, ['#fff6c8', '#d8c8ff', '#ffffff']);
  }

  /** Treasure room chest: a pile of coins, or a handful of healing potions (mostly the small ones). */
  openTreasureChest(pr) {
    const w = this.world;
    const c = CONFIG.run.treasure;
    this.chestPop(pr, () => {
      if (Math.random() >= c.potionChance) {
        const n = randInt(c.coins[0], c.coins[1]);
        this.spawnCoins(pr.x, pr.y - 12, n);
        w.effects.text(pr.x, pr.y - 44, `+${n} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
        return;
      }
      const heals = Object.values(POTIONS).filter((p) => p.family === 'heal');
      const total = heals.reduce((s, p) => s + (c.healTierWeights[p.tier - 1] || 0), 0);
      const pick = () => {
        let r = Math.random() * total;
        for (const p of heals) if ((r -= c.healTierWeights[p.tier - 1] || 0) < 0) return p.id;
        return heals[0].id;
      };
      const n = randInt(c.potions[0], c.potions[1]);
      this.spawnPotions(pr.x, pr.y, n, pick);
      w.effects.text(pr.x, pr.y - 44, `${n} HEALING POTIONS!`, { color: '#ff8aa0', size: 9, life: 1.2 });
    });
  }

  /** Potions spill out in front of a spot, one pickup each; pick(i) chooses each potion's id. */
  spawnPotions(x, y, n, pick) {
    const w = this.world;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.6;
      const pt = w.dungeon.freePoint(x + Math.cos(a) * 34, y + Math.sin(a) * 26, 6, 6);
      w.pickups.push(new PotionPickup(pt.x, pt.y, pick(i)));
    }
  }

  /**
   * Wishing well: one coin per toss. Each coin may grant the wish (sure to by
   * the pity-th); the wish is 2-6 of one random potion, or (upgradeChance of the
   * time) a random upgrade the hero doesn't have yet. One wish per hero.
   */
  wish(pr, hero) {
    const w = this.world;
    const c = CONFIG.run.well;
    const local = hero === w.localPlayer;
    pr.wishes = pr.wishes || {};
    const key = hero.netId || 'solo';
    const st = pr.wishes[key] || (pr.wishes[key] = { coins: 0, granted: false });
    if (st.granted) {
      if (local) { w.events.onToast?.('THE WELL HAS GRANTED YOUR WISH'); Sound.play('denied'); }
      return;
    }
    if (hero.coins < 1) {
      if (local) { w.events.onToast?.('NO COINS TO TOSS'); Sound.play('denied'); }
      return;
    }
    hero.coins--;
    st.coins++;
    Sound.play('coin');
    w.effects.burst(pr.x, pr.y - 16, { count: 6, colors: ['#9ad0ff', '#ffffff'], speed: [20, 60], life: [0.2, 0.4], up: 40 });
    if (st.coins < c.pity && Math.random() >= c.chance) {
      w.effects.text(pr.x, pr.y - 40, choose(['*plink*', 'nothing...', '*splash*', 'not yet...']), { color: '#9ad0ff', size: 7 });
      return;
    }
    st.granted = true;
    const gifts = shopStock(hero).filter((u) => !hero.upgradeLevels[u.id]);
    if (gifts.length && Math.random() < c.upgradeChance) {
      const u = choose(gifts);
      w.pickups.push(new UpgradePickup(pr.x, pr.y + 30, u.id, hero));
      w.effects.burst(pr.x, pr.y - 20, { count: 60, colors: [u.color, '#ffffff', '#ffe680'], speed: [60, 220], life: [0.5, 1], up: 90 });
      w.effects.text(pr.x, pr.y - 50, `WISH GRANTED: ${u.name.toUpperCase()}!`, { color: u.color, size: 9, life: 2.2 });
      Sound.play('magic');
      return;
    }
    const id = choose(Object.keys(POTIONS));
    const n = randInt(c.potions[0], c.potions[1]);
    this.spawnPotions(pr.x, pr.y + 30, n, () => id);
    w.effects.burst(pr.x, pr.y - 20, { count: 40, colors: ['#6ad8ff', '#ffffff', '#ffe680'], speed: [60, 200], life: [0.4, 0.8], up: 80 });
    w.effects.text(pr.x, pr.y - 50, `WISH GRANTED: ${n} ${POTIONS[id].name.toUpperCase()}`, { color: '#6ad8ff', size: 8, life: 1.8 });
    Sound.play('chestOpen');
  }

  // ---------- the puzzle room: Simon's stone ----------
  //
  // idle -> (E) show: the stone lights its pattern, one colour at a time -> input: the heroes step
  // on the floor plates in that order. Right: next (a pause) -> a longer pattern, until `wins` right
  // answers solve it (a free upgrade each). Wrong: a strike, back to idle; `strikes` of them and
  // it's fuse (blinking red) -> blown: the whole room goes up in flames.

  /** Touching the stone: a fresh pattern, as long as this round's. */
  startPattern(s) {
    const c = CONFIG.run.puzzle;
    s.seq = Array.from({ length: c.lengths[Math.min(s.wins, c.lengths.length - 1)] }, () => randInt(0, SIMON_COLORS.length - 1));
    s.state = 'show';
    s.step = 0;
    s.timer = -0.6;   // a breath before the first colour
    s.lit = -1;
    Sound.play('uiClick');
    this.world.effects.burst(s.x, s.y - 24, { count: 16, colors: ['#e0c0ff', '#b67aff', '#ffffff'], speed: [30, 90], life: [0.3, 0.6], up: 30 });
  }

  updateStone(s, dt) {
    const w = this.world;
    const c = CONFIG.run.puzzle;
    s.timer += dt;
    s.wrong = Math.max(0, s.wrong - dt);
    // a plate is pressed by stepping onto it (standing on it doesn't press it again)
    for (const pl of s.plates) {
      pl.lit = Math.max(0, pl.lit - dt);
      const half = SIMON_PLATE / 2;
      const on = w.heroes.some((p) => Math.abs(p.x - pl.x) < half && Math.abs(p.y - pl.y) < half);
      if (on && !pl.on && s.state === 'input') this.pressPlate(s, pl);
      pl.on = on;
    }
    switch (s.state) {
      case 'show': {
        if (s.timer < 0) break;
        const per = c.show + c.gap;
        const k = Math.floor(s.timer / per);
        if (k >= s.seq.length) {
          s.state = 'input';
          s.lit = -1;
          w.effects.text(s.x, s.y - 66, 'YOUR TURN', { color: '#e0c0ff', size: 8, life: 1 });
          break;
        }
        const lit = s.timer - k * per < c.show ? s.seq[k] : -1;
        if (lit >= 0 && (s.lit !== lit || s.litStep !== k)) {
          s.plates[lit].lit = c.show;
          Sound.play(`simon${lit}`);
        }
        s.lit = lit;
        s.litStep = k;
        break;
      }
      case 'input':
        // everyone walked off: the round is called off (no strike), touch the stone to start again
        if (!w.heroes.some((p) => this.floor.roomAt(p.x, p.y) === s.room)) s.state = 'idle';
        break;
      case 'next':
        if (s.timer >= 1.4) this.startPattern(s);
        break;
      case 'fuse': {
        // beeping faster and faster as it blinks red
        if (s.timer >= s.nextBeep) {
          Sound.play('simonFuse');
          s.nextBeep = s.timer + lerp(0.4, 0.08, Math.min(1, s.timer / c.fuse));
        }
        if (s.timer >= c.fuse) this.blowStone(s);
        break;
      }
    }
  }

  /** A hero stepped on a plate while the stone waits for the pattern back. */
  pressPlate(s, pl) {
    const w = this.world;
    const c = CONFIG.run.puzzle;
    pl.lit = 0.35;
    Sound.play(`simon${pl.i}`);
    w.effects.burst(pl.x, pl.y, { count: 10, colors: [SIMON_COLORS[pl.i].color, '#ffffff'], speed: [30, 90], life: [0.2, 0.5], up: 30 });
    if (pl.i !== s.seq[s.step]) return this.strike(s);
    if (++s.step < s.seq.length) return;
    // the whole pattern, right
    s.wins++;
    Sound.play('simonRight');
    w.effects.burst(s.x, s.y - 30, { count: 30, colors: ['#ffe680', '#e0c0ff', '#ffffff'], speed: [50, 160], life: [0.4, 0.8], up: 60 });
    if (s.wins >= c.wins) return this.solveStone(s);
    w.effects.text(s.x, s.y - 66, `CORRECT!  ${s.wins}/${c.wins}`, { color: '#ffe680', size: 9, life: 1.3 });
    s.state = 'next';
    s.timer = 0;
  }

  /** A wrong plate: a strike. The last one lights the fuse. */
  strike(s) {
    const w = this.world;
    const c = CONFIG.run.puzzle;
    s.strikes++;
    s.wrong = 0.6;
    s.timer = 0;
    Sound.play('simonWrong');
    w.shake(4, 0.25);
    w.effects.burst(s.x, s.y - 24, { count: 22, colors: ['#ff5a4a', '#8a2420', '#6e6c80'], speed: [50, 150], life: [0.3, 0.6], up: 40 });
    if (s.strikes < c.strikes) {
      s.state = 'idle';
      w.effects.text(s.x, s.y - 66, `WRONG!  MISTAKES ${s.strikes}/${c.strikes}`, { color: '#ff5a4a', size: 9, life: 1.6 });
      return;
    }
    s.state = 'fuse';
    s.opened = true;   // nothing more to touch
    s.nextBeep = 0;
    w.banner('RUN!', 'The stone is about to blow', 1.6);
    Sound.play('windup');
  }

  /** Every pattern right: each hero gets a random upgrade they don't have yet. */
  solveStone(s) {
    const w = this.world;
    s.state = 'solved';
    s.opened = true;
    const heroes = w.players.filter((p) => shopStock(p).some((u) => !p.upgradeLevels[u.id]));
    heroes.forEach((p, i) => {
      const u = choose(shopStock(p).filter((x) => !p.upgradeLevels[x.id]));
      const pt = w.dungeon.freePoint(s.x + (i - (heroes.length - 1) / 2) * 30, s.y + 34, 6, 6);
      w.pickups.push(new UpgradePickup(pt.x, pt.y, u.id, p));
    });
    w.banner('PUZZLE SOLVED', heroes.length > 1 ? 'A free upgrade for every hero' : 'A free upgrade', 2);
    w.effects.burst(s.x, s.y - 30, { count: 70, colors: ['#ffe680', '#b67aff', '#ffffff'], speed: [60, 240], life: [0.5, 1.1], up: 100 });
    Sound.play('magic');
    Sound.play('chestOpen');
  }

  /**
   * The fuse runs out: the stone bursts, the blast hurts everyone in the room
   * (it's a trap) and the whole floor is left burning, the fire racing out from the stone.
   */
  blowStone(s) {
    const w = this.world;
    const c = CONFIG.run.puzzle;
    const r = s.room;
    s.state = 'blown';
    s.timer = 0;
    Sound.play('ovenBoom');
    Sound.play('explosion');
    w.shake(14, 0.8);
    w.effects.burst(s.x, s.y - 20, { count: 90, colors: ['#ffffff', '#ffd34a', '#ff8a1e', '#e0461e', '#6e6c80'], speed: [100, 420], life: [0.4, 1.1], up: 80, size: [1, 4] });
    w.effects.burst(s.x, s.y - 20, { count: 40, colors: ['#6e6c80', '#9492a8', '#3e3c4c'], speed: [120, 320], life: [0.6, 1.2], up: 140, size: [2, 4] });   // stone shards
    w.effects.smoke(s.x, s.y - 16, { count: 16, radius: 40, life: 1.6, rise: 30 });
    const b = this.floor.roomBounds(r);
    const reach = Math.hypot(b.right - b.left, b.bottom - b.top);
    // the shockwave: a white-hot ring sweeping out across the room
    w.effects.add(0.6, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const rr = 20 + t * reach * 0.6;
      PFX.glow(ctx, s.x, s.y - 10, rr + 40, '255, 160, 60', 0.8, 2, (rr + 40) * 0.55);
      PFX.ring(ctx, s.x, s.y, rr, rr * 0.55, '#fff2a0', 3, { thick: 3 });
      ctx.restore();
    });
    for (const a of w.allies) {
      if (this.floor.roomAt(a.x, a.y) !== r) continue;
      if (a.hurt(c.blastDamage, w, s.x, s.y, { trap: true })) a.burn?.(c.fire.burnDps, c.fire.burnTime, w);
    }
    // fire all over the floor, spreading outwards from the stone
    const F = c.fire;
    const step = F.radius * 1.5;
    const patches = [];
    for (let y = b.top + step / 2; y < b.bottom; y += step) {
      for (let x = b.left + step / 2; x < b.right; x += step) {
        const px = x + rand(-10, 10);
        const py = y + rand(-8, 8);
        patches.push({ x: px, y: py, at: dist(px, py, s.x, s.y) / 700, seed: patches.length });
      }
    }
    this.roomFire(r, patches, F);
  }

  /**
   * The blown-up puzzle room burning: patches of fire (each catching `at` seconds in, spreading out
   * from the stone) that set alight anyone standing in one, for F.life seconds. One effect for the
   * whole room rather than a fire zone per patch, so a room full of fire stays cheap to draw:
   * scorch and a ring under each patch, a few tongues of flame on each, a glow on every other one
   * and a light on every fourth.
   */
  roomFire(r, patches, F) {
    const w = this.world;
    const stage = this.stage;
    const t0 = w.time;
    const lit = (pt) => w.time - t0 >= pt.at;
    // burning: every quarter second, anyone in a patch that's caught is set alight
    const tick = () => {
      if (this.stage !== stage || w.time - t0 > F.life) return;
      for (const a of w.allies) {
        if (a.dead || this.floor.roomAt(a.x, a.y) !== r) continue;
        if (patches.some((pt) => lit(pt) && dist(a.x, a.y, pt.x, pt.y) < F.radius + (a.radius || 0) * 0.5)) a.burn?.(F.burnDps, F.burnTime, w);
      }
      // a few flames leaping off random patches
      for (let i = 0; i < 3; i++) {
        const pt = choose(patches);
        if (lit(pt)) w.effects.flames(pt.x + vrand(-F.radius * 0.6, F.radius * 0.6), pt.y + vrand(-F.radius * 0.3, F.radius * 0.3), { count: 1, height: vrand(16, 26), width: vrand(8, 12), life: 0.5, colors: ENEMY_FIRE_COLORS });
      }
      w.after(0.25, tick);
    };
    w.after(0.25, tick);
    const fade = (pt) => {
      const age = w.time - t0 - pt.at;
      const left = F.life - (w.time - t0);
      return age < 0 ? 0 : Math.min(1, age * 4, left / (F.life * 0.15));
    };
    // scorched floor and a smouldering ring under each patch
    w.effects.add(F.life, (ctx) => {
      ctx.save();
      for (const pt of patches) {
        const k = fade(pt);
        if (k <= 0) continue;
        ctx.globalAlpha = 0.6 * k;
        PFX.disc(ctx, pt.x, pt.y, F.radius, F.radius * 0.55, '#2a0e06');
        ctx.globalAlpha = 0.8 * k;
        PFX.ring(ctx, pt.x, pt.y, F.radius * 0.9, F.radius * 0.5, '#a8200e', 2, { dash: [3, 3] });
      }
      ctx.restore();
    }, true);
    // the flames, above the gloom
    w.effects.add(F.life, (ctx) => {
      const secs = w.time - t0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const pt of patches) {
        const k = fade(pt);
        if (k > 0 && pt.seed % 2 === 0) PFX.glow(ctx, pt.x, pt.y - 6, F.radius * 1.3, '255, 40, 30', 0.5 * k * (0.85 + Math.sin(secs * 13 + pt.seed) * 0.15), 2, F.radius * 0.75);
      }
      ctx.restore();
      for (const pt of patches) {
        const k = fade(pt);
        if (k <= 0) continue;
        ctx.globalAlpha = k;
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + pt.seed;
          const d = ((i + pt.seed) % 3) / 3;
          const lick = 1 + Math.sin(secs * 7 + i * 2.3 + pt.seed) * 0.25;
          PFX.flame(ctx, pt.x + Math.cos(a) * F.radius * 0.8 * d, pt.y + Math.sin(a) * F.radius * 0.4 * d, 13, (18 + (i % 3) * 7) * lick, secs * 9 + i * 1.7 + pt.seed, ENEMY_FIRE_COLORS);
        }
      }
      ctx.globalAlpha = 1;
    });
    // the room glows red: a light on every fourth patch, each switching on as its fire catches
    for (const pt of patches) {
      if (pt.seed % 4 !== 0) continue;
      w.after(pt.at, () => { if (this.stage === stage) this.addLight({ x: pt.x, y: pt.y, r: F.radius * 4, s: 0.95, rgb: '255, 60, 50', until: t0 + F.life }); });
    }
    Sound.play('fireballCast');
  }

  /** The HUD's line for the puzzle room the local hero is in (none once it's done). */
  stoneText(s) {
    const c = CONFIG.run.puzzle;
    if (s.state === 'fuse') return 'RUN! THE STONE IS ABOUT TO BLOW';
    if (s.state === 'solved' || s.state === 'blown') return '';
    const goal = s.state === 'input' ? 'STEP ON THE PLATES IN ORDER' : s.state === 'show' ? 'WATCH THE PATTERN' : 'TOUCH THE STONE';
    return `${goal}  ${s.wins}/${c.wins}  MISTAKES ${s.strikes}/${c.strikes}`;
  }

  // ---------- world hooks ----------

  /** Extra things hero attacks can hit: the barrels still standing. */
  targets() { return Barrels.alive(this); }

  /** Extra things enemy attacks hit: the defend totem, and the barrels (so enemies can set them off too). */
  allies() {
    const out = Barrels.alive(this);
    if (this.totem && !this.totem.dead) out.push(this.totem);
    return out;
  }

  getDrawables() {
    // holes are flat on the floor, so they always sort under the characters;
    // special rooms are whole little scenes (Scenes) with their label on top
    const items = [];
    for (const pr of this.props) {
      if (pr.ground) continue;   // floor plates are drawn with the ground
      if (Scenes[pr.kind]) {
        items.push(...Scenes.drawables(pr.kind, pr.x, pr.y, this.time));
        items.push({ y: pr.y + 80, draw: (ctx) => this.drawPropLabel(ctx, pr) });
      } else {
        items.push({ y: pr.kind === 'hole' || pr.kind === 'holeExit' ? pr.y - 1000 : pr.y, draw: (ctx) => this.drawProp(ctx, pr) });
      }
    }
    if (this.totem) items.push({ y: this.totem.y, draw: (ctx) => this.totem.draw(ctx) });
    if (this.totem && this.totem.souls.length) items.push({ y: this.totem.y + 1000, draw: (ctx) => this.totem.drawSouls(ctx) });
    items.push(...this.decor.getDrawables(this.world.camera));
    const cam = this.world.camera;
    for (const o of this.cover) {
      if (o.item || o.hidden) continue;   // solid decor and the throne are drawn by the decor
      if (o.x > cam.x + cam.width + 64 || o.x + o.w * this.floor.T + 32 < cam.x || o.y - 40 > cam.y + cam.height || o.y + o.h * this.floor.T + 40 < cam.y) continue;
      items.push({ y: o.y + o.h * this.floor.T - 2, draw: (ctx) => this.drawCover(ctx, o) });
    }
    for (const e of this.sleepers) {
      if (e.x < cam.x - 80 || e.x > cam.x + cam.width + 80 || e.y < cam.y - 40 || e.y > cam.y + cam.height + 120) continue;
      items.push({ y: e.y, draw: (ctx) => Game.drawEnemy(ctx, e) });
    }
    for (const b of this.barrels) {
      if (b.dead || b.x < cam.x - 40 || b.x > cam.x + cam.width + 40 || b.y < cam.y - 20 || b.y > cam.y + cam.height + 60) continue;
      items.push({ y: b.y, draw: (ctx) => Barrels.draw(ctx, b, this.time) });
    }
    items.push(...this.doors.drawables(this.world.camera));
    return items;
  }

  // ---------- drawing ----------

  drawGround(ctx) {
    const T = this.floor.T;
    this.drawRubble(ctx);
    this.decor.drawGround(ctx, this.world.camera);
    for (const e of this.sleepers) e.drawGround(ctx);
    // spike pads: a riveted iron plate with hazard-striped corners, glowing red as it's about to fire
    for (const pad of this.spikePads) {
      const st = this.spikeState(pad);
      const w = pad.size * T;
      const { x, y } = pad;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, y - 2, w + 4, w + 4);
      ctx.fillStyle = '#3a3846';
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = '#6a6878';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = '#26242e';
      ctx.fillRect(x, y + w - 2, w, 2);
      // hazard stripes in each corner
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + w, 1, -1], [x + w, y + w, -1, -1]]) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k % 2 ? '#2a2420' : '#e0a82a';
          ctx.fillRect(sx > 0 ? cx + k * 3 : cx - (k + 1) * 3, sy > 0 ? cy : cy - 3, 3, 3);
          ctx.fillRect(sx > 0 ? cx : cx - 3, sy > 0 ? cy + k * 3 : cy - (k + 1) * 3, 3, 3);
        }
      }
      // a yellow-and-black hazard border all the way round
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1a1416';
      ctx.strokeRect(x + 1, y + 1, w - 2, w - 2);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#f0b830';
      ctx.strokeRect(x + 1, y + 1, w - 2, w - 2);
      ctx.restore();
      for (const [rx, ry] of [[x + 9, y + 9], [x + w - 10, y + 9], [x + 9, y + w - 10], [x + w - 10, y + w - 10]]) {
        ctx.fillStyle = '#80869a';
        ctx.fillRect(rx, ry, 2, 2);
      }
      if (st !== 0) {
        const glow = st === 1 ? 0.35 : 0.18 + Math.sin(this.time * 30) * 0.1;
        ctx.fillStyle = `rgba(255, 60, 40, ${glow})`;
        ctx.fillRect(x, y, w, w);
      }
    }
    for (const s of this.spikes) {
      const st = this.spikeState(s);
      ctx.fillStyle = '#1a1820';
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
    for (const pr of this.props) if (pr.kind === 'simonPlate') this.drawSimonPlate(ctx, pr);
    if (this.portal) this.drawPortal(ctx);
  }

  /**
   * A puzzle-room floor plate: a bevelled flagstone, lit from the top left, with a
   * cut rune gem of its colour set in it that blazes up when the stone shows it or a hero steps on it.
   */
  drawSimonPlate(ctx, pl) {
    const c = SIMON_COLORS[pl.i];
    const S = SIMON_PLATE;
    const sink = pl.on ? 1 : 0;   // it gives a little underfoot
    const x = Math.round(pl.x - S / 2);
    const y = Math.round(pl.y - S / 2) + sink;
    const glow = Math.min(1, pl.lit / 0.2);
    drawShadow(ctx, pl.x, pl.y + S / 2 - 2, S / 2 + 2, 5, 0.25);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, S + 2, S + 2 - sink);
    ctx.fillStyle = '#6e6c80';
    ctx.fillRect(x, y, S, S - sink);
    ctx.fillStyle = '#9492a8';   // lit rim, top and left
    ctx.fillRect(x, y, S, 2);
    ctx.fillRect(x, y, 2, S - sink);
    ctx.fillStyle = '#4a4858';   // shaded rim, bottom and right
    ctx.fillRect(x, y + S - 3 - sink, S, 3);
    ctx.fillRect(x + S - 2, y + 2, 2, S - 4);
    // a thin groove round the inset
    ctx.fillStyle = '#56546a';
    ctx.fillRect(x + 7, y + 7, S - 14, 1);
    ctx.fillRect(x + 7, y + S - 9 - sink, S - 14, 1);
    ctx.fillRect(x + 7, y + 7, 1, S - 16 - sink);
    ctx.fillRect(x + S - 8, y + 7, 1, S - 16 - sink);
    // moss in one corner
    ctx.fillStyle = '#4e6e44';
    ctx.fillRect(x + 2, y + S - 7 - sink, 6, 4);
    ctx.fillStyle = '#6a8e58';
    ctx.fillRect(x + 3, y + S - 8 - sink, 2, 1);
    // the rune gem: a diamond, dim until it lights
    const gx = x + S / 2;
    const gy = y + S / 2 - 1;
    const R = 12;
    const fill = (rr, color) => {
      ctx.fillStyle = color;
      for (let k = -rr; k <= rr; k++) {
        const wdt = rr - Math.abs(k);
        ctx.fillRect(gx - wdt, gy + k, wdt * 2 + 1, 1);
      }
    };
    fill(R + 1, OUTLINE);
    fill(R, glow > 0 ? c.color : c.dark);
    fill(Math.round(R * 0.55), glow > 0 ? '#ffffff' : c.color);
    ctx.globalAlpha = glow > 0 ? 1 : 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 4, gy - 5, 2, 2);   // glint, top left
    ctx.globalAlpha = 1;
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, gx, gy, 40, c.rgb, 0.7 * glow, 2, 24);
      ctx.globalAlpha = 0.35 * glow;
      ctx.fillStyle = c.color;
      ctx.fillRect(x, y, S, S - sink);
      ctx.restore();
    }
  }

  /**
   * Simon's stone (bottom centre at x, y): a weathered rune stone with an arched top and moss at
   * its foot, its four colour runes in a row (the plates' order) lighting as it shows its pattern,
   * a gold pip on its crown for each right answer and a crack for each mistake. Its fuse lit, it
   * shudders and blinks red; blown, only a scorched stump is left.
   */
  drawStone(ctx, s, x, y) {
    const c = CONFIG.run.puzzle;
    if (s.state === 'blown') {
      // a jagged, blackened stump in a ring of scorched rubble
      ctx.save();
      ctx.globalAlpha = 0.55;
      PFX.disc(ctx, x, y, 46, 22, '#1a0e0a');
      ctx.restore();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 18, y - 12, 36, 14);
      ctx.fillRect(x - 12, y - 17, 8, 5);
      ctx.fillRect(x + 4, y - 15, 9, 3);
      ctx.fillStyle = '#4a4858';
      ctx.fillRect(x - 17, y - 11, 34, 12);
      ctx.fillRect(x - 11, y - 16, 6, 5);
      ctx.fillRect(x + 5, y - 14, 7, 3);
      ctx.fillStyle = '#6e6c80';
      ctx.fillRect(x - 17, y - 11, 1, 10);
      ctx.fillRect(x - 11, y - 16, 6, 1);
      ctx.fillStyle = '#2a2430';
      ctx.fillRect(x - 17, y - 2, 34, 3);
      for (const [dx, dy, w] of [[-30, -2, 5], [26, 0, 4], [-22, 6, 3], [18, -8, 3], [34, 6, 3]]) {
        ctx.fillStyle = OUTLINE; ctx.fillRect(x + dx - 1, y + dy - 1, w + 2, w + 1);
        ctx.fillStyle = '#56546a'; ctx.fillRect(x + dx, y + dy, w, w - 1);
      }
      return;
    }
    const fuse = s.state === 'fuse';
    const red = fuse ? this.stoneBlink(s) : s.wrong > 0;
    const k = fuse ? Math.min(1, s.timer / c.fuse) : 0;
    const jx = fuse ? Math.round(vrand(-1, 1) * (1 + k * 2)) : 0;   // shuddering harder as the fuse runs down
    x += jx;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 19, y - 38, 38, 40);
    ctx.fillRect(x - 15, y - 42, 30, 4);
    ctx.fillRect(x - 10, y - 45, 20, 3);
    ctx.fillStyle = '#6e6c80';
    ctx.fillRect(x - 18, y - 37, 36, 38);
    ctx.fillRect(x - 14, y - 41, 28, 4);
    ctx.fillRect(x - 9, y - 44, 18, 3);
    ctx.fillStyle = '#9492a8';   // lit from the top left
    ctx.fillRect(x - 9, y - 44, 18, 1);
    ctx.fillRect(x - 14, y - 41, 5, 1);
    ctx.fillRect(x - 18, y - 37, 1, 36);
    ctx.fillStyle = '#56546a';
    ctx.fillRect(x + 15, y - 37, 3, 38);
    ctx.fillRect(x - 18, y - 1, 36, 2);
    // a carved band the runes sit in
    ctx.fillStyle = '#4a4858';
    ctx.fillRect(x - 15, y - 29, 30, 14);
    ctx.fillStyle = '#86849a';
    ctx.fillRect(x - 15, y - 15, 30, 1);
    // cracks, one more for each mistake
    ctx.fillStyle = '#2a2430';
    const cracks = [[[8, -36], [9, -32], [7, -29]], [[-12, -14], [-10, -10], [-13, -6], [-11, -3]], [[3, -12], [5, -8], [2, -5], [4, -2]]];
    for (let i = 0; i < Math.min(s.strikes, cracks.length); i++) for (const [dx, dy] of cracks[i]) ctx.fillRect(x + dx, y + dy, 1, 4);
    // moss at its foot
    ctx.fillStyle = '#4e6e44';
    ctx.fillRect(x - 18, y - 4, 9, 4);
    ctx.fillRect(x + 9, y - 3, 9, 3);
    ctx.fillStyle = '#6a8e58';
    ctx.fillRect(x - 17, y - 5, 4, 1);
    ctx.fillRect(x + 11, y - 4, 3, 1);
    // the four runes: lit while the stone shows that colour, all glowing gold once it's solved
    SIMON_COLORS.forEach((col, i) => {
      const rx = x - 12 + i * 7;
      const on = s.state === 'show' && s.lit === i;
      const gold = s.state === 'solved';
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(rx - 1, y - 27, 5, 10);
      ctx.fillStyle = on ? '#ffffff' : gold ? '#ffe680' : red ? '#ff5a4a' : col.dark;
      ctx.fillRect(rx, y - 26, 3, 8);
      ctx.fillStyle = on ? col.color : gold ? '#ffd34a' : red ? '#8a2420' : col.color;
      ctx.fillRect(rx, y - 22 + (i % 2) * 2, 3, 2);
      if (on || gold) drawGlow(ctx, rx + 1, y - 22, on ? 22 : 12, on ? col.rgb : '255, 220, 120', on ? 0.6 : 0.3);
    });
    // a pip on its crown for each right answer
    for (let i = 0; i < c.wins; i++) {
      const px = x - 7 + i * 6;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(px - 1, y - 37, 4, 4);
      ctx.fillStyle = i < s.wins ? '#ffd34a' : '#3e3c4c';
      ctx.fillRect(px, y - 36, 2, 2);
      if (i < s.wins) drawGlow(ctx, px + 1, y - 35, 8, '255, 210, 90', 0.4);
    }
    // blinking red: a hot flush over the whole stone and a glow round it
    if (red) {
      ctx.save();
      ctx.globalAlpha = fuse ? 0.45 + k * 0.25 : 0.4 * (s.wrong / 0.6);
      ctx.fillStyle = '#ff3a26';
      ctx.fillRect(x - 18, y - 37, 36, 38);
      ctx.fillRect(x - 14, y - 41, 28, 4);
      ctx.fillRect(x - 9, y - 44, 18, 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      PFX.glow(ctx, x, y - 22, 46 + k * 30, '255, 40, 30', fuse ? 0.7 : 0.4, 2, 26);
      ctx.restore();
    }
  }

  /** On or off, as the stone blinks red (faster and faster while its fuse burns). */
  stoneBlink(s) {
    const k = Math.min(1, s.timer / CONFIG.run.puzzle.fuse);
    return Math.sin(s.timer * lerp(9, 40, k * k)) > -0.2;
  }

  /** The portal out of a beaten boss room: violet, or blue to the gem vault and out of the vault. */
  drawPortal(ctx) {
    const P = this.portal;
    const { x, y } = P;
    const blue = P.vault || P.exit;
    const [ring, core, edge] = blue ? ['90, 170, 255', '200, 230, 255', '30, 90, 220'] : ['180, 90, 255', '230, 190, 255', '120, 40, 200'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const r = ((this.time * 30 + i * 12) % 48);
      ctx.strokeStyle = `rgba(${ring}, ${0.8 * (1 - r / 48)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
    g.addColorStop(0, `rgba(${core}, 0.7)`);
    g.addColorStop(1, `rgba(${edge}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
    ctx.restore();
    const near = this.world.localPlayer.nearProp === P;
    if (near) HUD.text(ctx, `[${Settings.label('interact')}] ${P.label}`, x, y - 50, { size: 8, align: 'center', color: '#ffe680' });
    else HUD.text(ctx, this.practiceBoss ? 'PRACTICE RANGE' : P.vault ? 'GEM VAULT' : this.stage < 3 && !P.exit ? 'NEXT STAGE' : 'EXIT', x, y - 46, { size: 7, align: 'center', color: blue ? '#bfe0ff' : '#e0c0ff' });
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
      case 'enchanter':
      case 'pawn':
      case 'chef': {
        // the keeper stands behind a counter under a striped awning (Tobin, at the trade-in stall, is the travelling trader)
        const frames = Sprites.npcs[pr.kind === 'pawn' ? 'trader' : pr.kind].idle;
        drawSprite(ctx, frames[Math.floor((this.time + x * 0.01) * CUTE.fps.idle) % frames.length].img, x, y - 8, HERO_ANCHOR.x, HERO_ANCHOR.y, pr.kind !== 'shopkeeper', 1);
        const enchant = pr.kind === 'enchanter';
        const pawn = pr.kind === 'pawn';
        box(56, 18, enchant ? '#3e5a96' : pawn ? '#4a7a44' : '#9c6c3e', enchant ? '#22325e' : pawn ? '#2a4a2a' : '#5b3922');
        ctx.fillStyle = enchant || pawn ? '#d4ac4c' : '#7d532f';
        ctx.fillRect(x - 28, y - 12, 56, 2);                       // counter trim
        ctx.fillStyle = '#5b3922';
        ctx.fillRect(x - 27, y - 66, 3, 50);
        ctx.fillRect(x + 24, y - 66, 3, 50);
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = i % 2 ? '#f4ead7' : pr.color;
          ctx.fillRect(x - 31 + i * 7, y - 72, 7, 9);
          ctx.fillRect(x - 31 + i * 7 + 2, y - 63, 3, 2);         // scalloped edge
        }
        if (pr.kind === 'shopkeeper') {
          // the potions actually in stock, lined up on the counter
          const stock = this.potionStock.filter((s) => s.left > 0).slice(0, 4);
          stock.forEach((s, i) => ctx.drawImage(Sprites.potions[s.id], x - 26 + i * 13, y - 30, 16, 16));
          // herbs drying under the awning
          for (const [dx, c] of [[-20, '#4a8a3a'], [-6, '#8a6a3a'], [9, '#6a9a4a'], [19, '#9a4a6a']]) {
            ctx.fillStyle = '#5b3922'; ctx.fillRect(x + dx, y - 62, 1, 4);
            ctx.fillStyle = c; ctx.fillRect(x + dx - 2, y - 58, 5, 5); ctx.fillRect(x + dx - 1, y - 53, 3, 2);
          }
        } else if (enchant) {
          // three glowing rune orbs bobbing over the counter: one per enchantment on offer
          ['#e84a4a', '#9ad0ff', '#ffd34a'].forEach((c, i) => {
            const ox = x - 16 + i * 16;
            const oy = y - 26 + Math.round(Math.sin(this.time * 2.4 + i * 2) * 2);
            drawGlow(ctx, ox, oy, 14, i === 0 ? '255, 110, 110' : i === 1 ? '140, 200, 255' : '255, 220, 110', 0.35);
            ctx.fillStyle = OUTLINE; ctx.fillRect(ox - 4, oy - 4, 8, 8);
            ctx.fillStyle = c; ctx.fillRect(ox - 3, oy - 3, 6, 6);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(ox - 2, oy - 2, 2, 2);
          });
          // runes on the counter cloth
          ctx.fillStyle = '#9ae6ff';
          for (let i = 0; i < 4; i++) ctx.fillRect(x - 20 + i * 12, y - 8 + (i % 2), 4, 2);
        } else if (pawn) {
          // a brass balance scale, gently tipping, and a stack of coins beside it
          const tip = Math.round(Math.sin(this.time * 1.6) * 2);
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x - 9, y - 36, 3, 18);
          ctx.fillRect(x - 21, y - 37 + tip, 27, 3);
          ctx.fillStyle = '#d4ac4c';
          ctx.fillRect(x - 8, y - 35, 1, 16);
          ctx.fillRect(x - 13, y - 20, 11, 2);                     // its foot
          ctx.fillRect(x - 20, y - 36 + tip, 25, 1);
          for (const [px, py] of [[x - 20, y - 32 + tip], [x + 2, y - 32 - tip]]) {
            ctx.fillStyle = OUTLINE; ctx.fillRect(px - 1, py - 1, 9, 5);
            ctx.fillStyle = '#d4ac4c'; ctx.fillRect(px, py, 7, 3);
            ctx.fillStyle = '#fff2a0'; ctx.fillRect(px, py, 7, 1);
          }
          drawSprite(ctx, Sprites.potions['health-potion'], x - 16, y - 34 + tip, 14, 26, false, 0.5);   // a potion weighed against a coin
          ctx.fillStyle = '#ffd34a'; ctx.fillRect(x + 3, y - 35 - tip, 5, 2);
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = OUTLINE; ctx.fillRect(x + 11, y - 21 - i * 3, 11, 4);
            ctx.fillStyle = i % 2 ? '#d4ac4c' : '#ffd34a'; ctx.fillRect(x + 12, y - 20 - i * 3, 9, 2);
          }
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
      case 'chest':          // treasure room chests
      case 'rewardChest':
      case 'secretChest':
      case 'gemChest': {
        if (pr.gone) return;   // it was a mimic
        if ((pr.kind === 'secretChest' || pr.kind === 'chest') && !pr.opened) drawGlints(ctx, [[x - 10, y - 22], [x + 11, y - 14], [x + 3, y - 26]], this.time + x * 0.01);
        if (pr.sealed) ctx.globalAlpha = 0.55;
        if (pr.kind === 'gemChest') {
          // the vault's chest is bigger, glowing blue, gems glinting on its lid until it's opened
          drawShadow(ctx, x, y + 1, 28, 7, 0.35);
          if (!pr.opened) {
            drawGlow(ctx, x, y - 20, 44, '110, 180, 255', 0.3 + Math.sin(this.time * 3) * 0.08);
            drawGlints(ctx, [[x - 14, y - 34], [x + 15, y - 26], [x + 4, y - 40]], this.time + 3);
          }
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1.5, 1.5);
          ctx.translate(-x, -y);
          this.drawChest(ctx, pr, x, y);
          ctx.restore();
        } else this.drawChest(ctx, pr, x, y);
        ctx.globalAlpha = 1;
        if (Upgrades.isSensed(pr, this.world.localPlayer)) Upgrades.drawMimicSense(ctx, x, y, this.time);   // Mimic Sense
        if (pr.sealed) {
          // chained shut
          for (const [x1, x2] of [[-16, 16], [16, -16]]) {
            for (let i = 0; i <= 6; i++) {
              const cx = Math.round(x + x1 + (x2 - x1) * (i / 6));
              const cy = Math.round(y - 24 + 20 * (i / 6));
              ctx.fillStyle = OUTLINE; ctx.fillRect(cx - 2, cy - 2, 5, 4);
              ctx.fillStyle = '#80869a'; ctx.fillRect(cx - 1, cy - 1, 3, 2);
            }
          }
        }
        break;
      }
      case 'puzzle': this.drawStone(ctx, pr, x, y); break;
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
    this.drawPropLabel(ctx, pr);
  }

  /**
   * A chest (bottom centre at x, y) and its opening: a quick rattle, then the lid
   * flies open with an overshoot as the box squashes and springs back, light pours
   * out of it in rays, sparkles drift up, and the mouth glows gold before going
   * dark. Reward chests are oak with gold bands, secret chests violet with silver, the gem vault's sapphire with gold.
   */
  drawChest(ctx, pr, x, y) {
    const secret = pr.kind === 'secretChest';
    const gem = pr.kind === 'gemChest';   // the gem vault's: sapphire-lacquered, bound in gold
    const wood = secret ? ['#2e2440', '#4a3a5e', '#5c4a74'] : gem ? ['#122a6a', '#1e4ab0', '#3a6ad8'] : ['#5b3922', '#7d532f', '#9c6c3e'];
    const trim = secret ? '#cfc7e8' : '#dcb44c';
    const trimD = secret ? '#8a82a8' : '#a07a24';
    const t = pr.opened && !pr.sealed ? pr.t : -1;
    const P = CHEST_POP;
    // rattle, then squash-and-stretch as the lid bursts open
    let dx = 0;
    let sy = 1;
    if (t >= 0 && t < P) dx = Math.round(Math.sin(t * 95) * 2);
    else if (t >= P && t < P + 0.3) {
      const u = (t - P) / 0.3;
      sy = 1 - Math.sin(u * Math.PI * 2) * 0.1 * (1 - u);
    }
    // how far the lid is open: eased out with an overshoot
    let k = 0;
    if (t >= P) {
      const u = Math.min(1, (t - P) / 0.22);
      const c = 2.2;
      k = 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
    } else if (t >= 0) k = Math.max(0, Math.sin(t * 60)) * 0.08;   // the lid jumps on its hinge
    const glow = t >= P ? Math.max(0, 1 - (t - P) / 1.6) : 0;
    // light pouring up out of the chest
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rgb = secret ? '210, 190, 255' : gem ? '140, 200, 255' : '255, 225, 130';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.26 + Math.sin(this.time * 2 + i) * 0.04;
        const len = (40 + (i % 3) * 14) * Math.min(1, (t - P) * 6) * (0.4 + glow * 0.6);
        const w = 4 + (i % 2) * 3;
        ctx.fillStyle = `rgba(${rgb}, ${0.22 * glow})`;
        ctx.beginPath();
        ctx.moveTo(x - w, y - 16);
        ctx.lineTo(x + w, y - 16);
        ctx.lineTo(x + Math.cos(a) * len + Math.cos(a + Math.PI / 2) * w * 2, y - 16 + Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a) * len - Math.cos(a + Math.PI / 2) * w * 2, y - 16 + Math.sin(a) * len);
        ctx.closePath();
        ctx.fill();
      }
      PFX.glow(ctx, x, y - 16, 40, rgb, 0.9 * glow, 2, 26);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x + dx, y);
    ctx.scale(1 + (1 - sy) * 0.6, sy);
    const R = (px, py, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(px, py, w, h); };
    const ok = Math.min(1.15, k);
    if (ok >= 0.5) {
      // swung open: the lid stands up from its hinge at the back, its underside facing us
      const h = Math.round(6 + ok * 9);
      R(-15, -16 - h, 30, h + 1, OUTLINE);
      R(-14, -15 - h, 28, h - 1, wood[0]);
      R(-14, -15 - h, 28, 2, trimD);
      R(-12, -12 - h, 24, h - 4, secret ? '#3a2e4c' : gem ? '#0c1a44' : '#4a2e1c');
    }
    // the box: planks, gold bands at the corners, a lock plate
    R(-15, -16, 30, 17, OUTLINE);
    R(-14, -15, 28, 15, wood[1]);
    R(-14, -15, 28, 2, wood[2]);
    R(-14, -2, 28, 2, wood[0]);
    R(-6, -14, 1, 12, wood[0]);
    R(5, -14, 1, 12, wood[0]);
    R(-14, -15, 3, 15, trimD);
    R(11, -15, 3, 15, trimD);
    R(-14, -15, 1, 15, trim);
    R(11, -15, 1, 15, trim);
    // the open mouth: glowing gold at first, then the dark, empty inside
    if (k > 0.05) {
      R(-13, -18, 26, 4, glow > 0 ? (secret ? '#e8dcff' : gem ? '#d8f0ff' : '#fff2a0') : '#1e140e');
      if (glow > 0) R(-13, -15, 26, 1, secret ? '#b8a8e8' : gem ? '#8ac8ff' : '#ffd34a');
    }
    // the lid while shut (or just starting to lift): a rounded front with a band and the lock
    if (ok < 0.5) {
      const lidH = Math.round(11 - ok * 8);
      const lidY = Math.round(-26 - ok * 9);
      R(-15, lidY, 30, lidH + 1, OUTLINE);
      R(-14, lidY + 1, 28, lidH - 1, wood[2]);
      R(-14, lidY + 1, 28, 2, secret ? '#7a6898' : gem ? '#6a9aff' : '#b8844c');
      R(-14, lidY + lidH - 3, 28, 2, trim);
      R(-2, lidY + lidH - 5, 4, 6, trim);
      R(-1, lidY + lidH - 3, 2, 2, OUTLINE);
    }
    ctx.restore();
    // sparkles drifting up out of it
    if (glow > 0) {
      for (let i = 0; i < 8; i++) {
        const s = ((t - P) * 0.9 + i * 0.13) % 1;
        const sx = x + Math.sin(i * 2.7 + s * 4) * (6 + s * 14);
        const syy = y - 18 - s * 46;
        const a = (1 - s) * glow;
        ctx.fillStyle = `rgba(255, 245, 200, ${a})`;
        ctx.fillRect(Math.round(sx), Math.round(syy), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
    }
  }

  /** The prop's name, or "[E] ..." when the local hero can use it. */
  drawPropLabel(ctx, pr) {
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    if (pr.opened) return;
    const near = this.world.localPlayer.nearProp === pr;
    const npc = ['shopkeeper', 'chef', 'enchanter', 'pawn', 'restaurant5'].includes(pr.kind);
    const labelY = npc || Scenes[pr.kind] ? y - 86 : pr.kind === 'rewardChest' || pr.kind === 'secretChest' || pr.kind === 'chest' || pr.kind === 'gemChest' ? y - 36 : y - 62;
    let label = near && npc ? 'TALK' : pr.label;
    if (pr.kind === 'wishingWell') {
      const st = pr.wishes?.[this.world.localPlayer.netId || 'solo'];
      if (st?.granted) label = 'WISH GRANTED';
      else if (near) label = 'TOSS A COIN';
    }
    if (pr.kind === 'puzzle') {
      if (pr.state !== 'idle') return;
      if (near) label = pr.wins || pr.strikes ? 'TRY A NEW PATTERN' : 'SHOW THE PATTERN';
    }
    if (pr.kind === 'rewardChest' && !near) return;
    HUD.text(ctx, near ? `[${Settings.label('interact')}] ${label}` : label, x, labelY, { size: near ? 7 : 6, align: 'center', color: near ? '#ffe680' : pr.color });
  }

  /**
   * The secret hole, in hard pixels like the rest of the art: a dark pit stepping down into blackness,
   * a pulsing ring of gold round its lip, rough stones and tufts round the rim, and sparks drifting
   * up out of it. In the secret room, a shaft of light (with a rope) is the way back up.
   */
  drawHole(ctx, pr) {
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    const t = this.time;
    const pulse = 0.5 + Math.sin(t * 3) * 0.25;
    const shown = pr.kind === 'hole' ? pr.reveal || 0 : 1;   // how far the trapdoor has slid off it
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, 54, '255, 220, 140', (0.3 * pulse + 0.12) * shown, 2, 34);
    ctx.restore();
    if (pr.kind === 'hole') {
      // the pit: an outline, then each step down darker, the lip lit along its far (top) edge
      PFX.disc(ctx, x, y, 26, 14, OUTLINE);
      PFX.disc(ctx, x, y, 24, 12, '#3a3046');
      PFX.disc(ctx, x, y + 1, 22, 10, '#1e1626');
      PFX.disc(ctx, x, y + 2, 18, 8, '#0e0a14');
      PFX.disc(ctx, x, y + 3, 12, 5, '#05020a');
      PFX.ring(ctx, x, y, 24, 12, '#5c5676', 2, { from: Math.PI, to: TAU });   // the far wall catching the light
      // its golden rim, pulsing
      ctx.save();
      ctx.globalAlpha = (0.55 + pulse * 0.45) * Math.max(0.3, shown);
      PFX.ring(ctx, x, y, 26, 13, '#ffd66e', 2, { dash: [3, 1], spin: t * 0.4 });
      ctx.restore();
      // rough stones and grass tufts round the lip
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.3;
        const sx = Math.round(x + Math.cos(a) * 29);
        const sy = Math.round(y + Math.sin(a) * 15);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(sx - 3, sy - 2, 6, 5);
        ctx.fillStyle = i % 3 ? '#5c5676' : '#77699a';
        ctx.fillRect(sx - 2, sy - 1, 4, 3);
        ctx.fillStyle = '#9a90b8';
        ctx.fillRect(sx - 2, sy - 1, 2, 1);
        if (i % 4 === 1) { ctx.fillStyle = '#4e6e44'; ctx.fillRect(sx + 3, sy - 3, 2, 3); }
      }
    } else {
      // shaft of light from above, in stepped bands, and a rope to climb
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 7; band++) {
        const top = y - 140 + band * 20;
        ctx.fillStyle = `rgba(255, 240, 190, ${(0.04 + band * 0.04) * (0.8 + pulse * 0.4)})`;
        ctx.fillRect(x - 20, top, 40, 20);
        ctx.fillStyle = `rgba(255, 250, 220, ${(0.03 + band * 0.03)})`;
        ctx.fillRect(x - 8, top, 16, 20);
      }
      ctx.restore();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, y - 140, 4, 136);
      ctx.fillStyle = '#c89a5a';
      ctx.fillRect(x - 1, y - 140, 2, 136);
      for (let ry = y - 136; ry < y - 6; ry += 8) { ctx.fillStyle = '#7d532f'; ctx.fillRect(x - 1, ry, 2, 2); }
      ctx.save();
      ctx.globalAlpha = 0.4 + pulse * 0.3;
      PFX.ring(ctx, x, y, 18, 8, '#ffd66e', 2, { dash: [3, 1], spin: t * 0.4 });
      ctx.restore();
    }
    if (pr.kind === 'hole' && shown < 1.01) this.drawTrapdoor(ctx, x, y, shown);
    // sparks drifting up, twinkling
    for (let i = 0; i < 6; i++) {
      const s = (t * 0.5 + i / 6) % 1;
      const sx = Math.round(x + Math.sin(i * 2.3 + t) * 12);
      const sy = Math.round(y - s * 54);
      ctx.fillStyle = `rgba(255, 230, 150, ${(1 - s) * shown})`;
      ctx.fillRect(sx, sy, 2, 2);
      if (i % 2 && s < 0.5) { ctx.fillRect(sx - 1, sy + 0.5, 4, 1); }
    }
    const near = this.world.localPlayer.nearProp === pr;
    if (near) HUD.text(ctx, `[${Settings.label('interact')}] ${pr.label}`, x, y - 40, { size: 7, align: 'center', color: '#ffe680' });
  }

  /**
   * The wooden trapdoor over the secret hole, in hard pixels: a round hatch of oak planks (built row
   * by row in 2px steps) with two iron straps and a ring pull. k = 0 sits over the hole; as the room is
   * cleared it scrapes aside (eased, lifting a touch as it goes) and comes to rest beside the hole.
   */
  drawTrapdoor(ctx, x, y, k) {
    const e = k * k * (3 - 2 * k);
    const ox = Math.round(x + e * 58);
    const oy = Math.round(y + e * 6 - Math.sin(k * Math.PI) * 3);
    drawShadow(ctx, ox, oy + 3, 26, 9, 0.35);
    PFX.disc(ctx, ox, oy, 27, 14, OUTLINE);
    const planks = ['#7d532f', '#8a5c34', '#74502c', '#86582f'];
    const rx = 25;
    const ry = 12;
    for (let j = -ry; j < ry; j += 2) {
      const mid = j + 1;
      const half = Math.round((rx * Math.sqrt(Math.max(0, 1 - (mid * mid) / (ry * ry)))) / 2) * 2;
      if (half <= 0) continue;
      for (let px = ox - half; px < ox + half; px++) {
        const col = Math.floor((px - (ox - rx)) / 9);
        const edge = (px - (ox - rx)) % 9;
        ctx.fillStyle = edge === 0 ? '#9c6c3e' : edge === 8 ? '#4a2e1c' : planks[col % planks.length];
        ctx.fillRect(px, oy + j, 1, 2);
      }
      // shade the lower part of the hatch, light its top
      if (j >= 6) { ctx.fillStyle = 'rgba(30, 16, 8, 0.35)'; ctx.fillRect(ox - half, oy + j, half * 2, 2); }
      if (j === -ry) { ctx.fillStyle = '#b08050'; ctx.fillRect(ox - half, oy + j, half * 2, 1); }
    }
    // two iron straps with rivets
    for (const sy of [-6, 4]) {
      const half = Math.round((rx * Math.sqrt(Math.max(0, 1 - ((sy + 1) * (sy + 1)) / (ry * ry)))) / 2) * 2;
      ctx.fillStyle = '#363a46';
      ctx.fillRect(ox - half, oy + sy, half * 2, 3);
      ctx.fillStyle = '#80869a';
      ctx.fillRect(ox - half, oy + sy, half * 2, 1);
      for (let rxp = -18; rxp <= 18; rxp += 12) { ctx.fillStyle = '#c9d3dd'; ctx.fillRect(ox + rxp, oy + sy + 1, 1, 1); }
    }
    // the ring pull: a little square ring of brass
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(ox + 8, oy - 4, 9, 7);
    ctx.fillStyle = '#d4ac4c';
    ctx.fillRect(ox + 9, oy - 3, 7, 5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(ox + 11, oy - 1, 3, 1);
    ctx.fillStyle = '#f0d88a';
    ctx.fillRect(ox + 9, oy - 3, 3, 1);
  }

  // ---------- gloom and fog (themes with `night`) ----------

  /** Where fog lies on this floor: a few low banks in every room and hallway (visual only). */
  placeFog(f) {
    const T = f.T;
    const out = [];
    const bank = (x, y) => out.push({ x, y, r: vrand(46, 84), seed: vrand(0, 100), drift: vrand(20, 60), speed: vrand(0.05, 0.12) });
    for (const r of f.rooms) {
      if (r.type === 'secret') continue;
      const n = Math.round(((r.x1 - r.x0) * (r.y1 - r.y0)) / 110);
      for (let i = 0; i < n; i++) bank((vrand(r.x0 + 1, r.x1)) * T, (vrand(r.y0 + 1, r.y1)) * T);
    }
    for (const l of f.links) {
      const a = f.rooms[l.a];
      const b = f.rooms[l.b];
      if (vrand(0, 1) < 0.7) bank((a.cx + b.cx) / 2, (a.cy + b.cy) / 2);
    }
    return out;
  }

  /** Every light on the floor, for the gloom: { x, y, r, s, rgb } (see Lighting). */
  lights() {
    const t = this.time;
    const f = this.floor;
    const out = [];
    for (const tr of f.torches) {
      const k = Math.sin(t * 12 + tr.seed) * 0.5 + Math.sin(t * 23 + tr.seed * 2) * 0.5;
      out.push({ x: tr.x, y: tr.y + 24, r: 150 + k * 8, s: 0.95, rgb: '255, 150, 60' });
    }
    for (const d of this.decor.items) {
      const flick = Math.sin(t * 9 + d.seed);
      if (d.kind === 'lampPost') out.push({ x: d.x, y: d.y - 40, r: 150 + flick * 5, s: 0.95, rgb: d.warm ? '255, 200, 110' : '110, 255, 170' });
      else if (d.kind === 'soulTree') for (const [lx, ly] of SOUL_LANTERNS) out.push({ x: d.x + lx * (d.facing || 1), y: d.y + ly, r: 110 + flick * 5, s: 0.9, rgb: '110, 220, 255' });
      else if (d.kind === 'gemCluster') out.push({ x: d.x, y: d.y - 16, r: 80, s: 0.6, rgb: hexToRgb(GEM_RAMPS[d.v || 0][2]).join(', ') });
      else if (d.kind === 'candles') out.push({ x: d.x, y: d.y - 8, r: 74 + flick * 4, s: 0.8, rgb: '255, 190, 90' });
      else if (d.kind === 'campfire') out.push({ x: d.x, y: d.y - 10, r: 200 + flick * 10, s: 1, rgb: '255, 150, 60' });
      else if (d.kind === 'prop' && (d.name === 'candelabra' || d.name === 'cauldron')) out.push({ x: d.x, y: d.y - 24, r: 90, s: 0.85, rgb: d.name === 'cauldron' ? '140, 255, 140' : '255, 190, 90' });
    }
    if (this.themeId === 'castle') CastleDecor.lights(this.decor, out, t);
    if (this.themeId === 'ruins') RuinsDecor.lights(this.decor, out, t);
    if (this.bossType === 'phantom') ManorDecor.lights(this.decor, out, t);
    this.extraLights = this.extraLights.filter((l) => l.until > this.world.time);
    out.push(...this.extraLights);
    for (const pr of this.props) {
      if (pr.kind === 'hole' || pr.kind === 'holeExit') { if (pr.kind === 'holeExit' || pr.reveal > 0) out.push({ x: pr.x, y: pr.y, r: 110 * (pr.kind === 'hole' ? pr.reveal : 1), s: 0.85, rgb: '255, 220, 140' }); }
      else if (pr.kind === 'gemChest') out.push({ x: pr.x, y: pr.y - 14, r: 150, s: 0.9, rgb: '110, 180, 255' });
      else if (pr.kind === 'simonPlate') { if (pr.lit > 0 || pr.on) out.push({ x: pr.x, y: pr.y, r: 90, s: pr.lit > 0 ? 0.9 : 0.4, rgb: SIMON_COLORS[pr.i].rgb }); }
      else if (pr.kind === 'puzzle') {
        if (pr.state === 'blown') continue;
        const red = pr.state === 'fuse' ? this.stoneBlink(pr) : pr.wrong > 0;
        out.push({ x: pr.x, y: pr.y - 30, r: red ? 190 : 150, s: red ? 1 : 0.85, rgb: red ? '255, 50, 40' : pr.state === 'solved' ? '255, 220, 120' : '190, 130, 255' });
      }
      else if (pr.kind === 'rewardChest' || pr.kind === 'secretChest' || pr.kind === 'chest') out.push({ x: pr.x, y: pr.y - 10, r: 70, s: 0.6, rgb: '255, 210, 120' });
      else if (!pr.opened) out.push({ x: pr.x, y: pr.y - 30, r: 150, s: 0.85, rgb: '255, 200, 120' });   // shops, special rooms
    }
    if (this.portal) out.push({ x: this.portal.x, y: this.portal.y, r: 190, s: 1, rgb: this.portal.vault || this.portal.exit ? '90, 170, 255' : '180, 90, 255' });
    if (this.totem) out.push({ x: this.totem.x, y: this.totem.y - 24, r: 180, s: 1, rgb: '106, 216, 255' });
    for (const s of this.spikes) if (this.spikeState(s) === 1) out.push({ x: s.x + 16, y: s.y + 16, r: 30, s: 0.3 });
    // a faint glow off each barrel, so they read in the dark (the fuse's spark, the ooze, the frost)
    // the Deathbringer's tombs: their runes glow faintly, so they can still be made out in its darkness
    for (const o of this.cover) if (o.kind === 'darkTomb') out.push({ x: o.x + o.w * this.floor.T / 2, y: o.y + 6, r: 70, s: 0.5, rgb: '154, 106, 255' });
    for (const b of this.barrels) if (!b.dead) out.push({ x: b.x, y: b.y - 14, r: 48, s: 0.45, rgb: { explosive: '255, 170, 80', poison: '140, 240, 100', frost: '150, 200, 255' }[b.kind] });
    const w = this.world;
    if (w.boss?.addLights) w.boss.addLights(out);
    else     if (w.boss) out.push({ x: w.boss.x, y: w.boss.y - 40, r: 150, s: 0.6, rgb: { queen: '255, 130, 210', king: '255, 200, 120', prince: '255, 210, 150', princess: '170, 150, 255' }[this.bossType] || '200, 120, 255' });
    // each hero carries a little light; spells and souls in flight glow as they go
    for (const p of w.players) if (!p.dead) out.push({ x: p.x, y: p.y - 16, r: 130, s: 0.7 });
    for (const p of w.playerProjectiles) out.push({ x: p.x, y: p.y, r: 44, s: 0.55 });
    for (const p of w.enemyProjectiles) out.push({ x: p.x, y: p.y, r: 36, s: 0.5, rgb: '255, 120, 110' });
    if (this.totem) for (const s of this.totem.souls) out.push({ x: s.x, y: s.y, r: 40, s: 0.7, rgb: '106, 216, 255' });
    return out;
  }

  /** A light that glows until world time `until` (burning ground, ice...). */
  addLight(l) { this.extraLights.push(l); }

  /** The gloom: cold night darkness with every torch, lamp, candle and spell glowing out of it. */
  drawLighting(ctx, cam) {
    const night = this.theme.night;
    if (!night) return;
    // the Deathbringer's room is darker still, and pitch dark once it covers it in darkness
    let dark = night.dark;
    const w = this.world;
    const here = this.floor.roomAt(w.localPlayer.x, w.localPlayer.y);
    if (this.bossType === 'deathbringer' && here && here.type === 'boss') dark = Math.max(dark, 0.6);
    if (this.bossType === 'phantom' && here && here.type === 'boss') dark = Math.max(dark, 0.5);   // the manor's hall: candlelight and moonlight
    if (w.boss && w.boss.darkness) dark = Math.max(dark, w.boss.darkness);
    // the gloom is light, so the lamps' bloom is turned up to keep their warm pools
    Lighting.draw(ctx, cam, this.lights(), { dark, color: night.color, bloom: 0.5 });
  }

  /**
   * Low banks of fog lying over the graveyard (like Terraria's graveyard mist):
   * soft, pale, slowly drifting and breathing, a touch brighter where light falls.
   */
  drawFog(ctx, cam) {
    if (!this.fog.length) return;
    const t = this.time;
    ctx.save();
    for (const b of this.fog) {
      const x = b.x + Math.sin(t * b.speed + b.seed) * b.drift;
      const y = b.y + Math.sin(t * b.speed * 0.7 + b.seed * 2) * 10;
      if (x < cam.x - b.r * 2 || x > cam.x + cam.width + b.r * 2 || y < cam.y - b.r || y > cam.y + cam.height + b.r) continue;
      const breathe = 0.6 + 0.4 * Math.sin(t * 0.4 + b.seed);
      ctx.globalAlpha = 0.16 * breathe;
      // a bank is a few wide, flat billows side by side
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(x + i * b.r * 0.8, y + Math.abs(i) * 4);
        ctx.scale(1, 0.42);
        PFX.smokeBlob(ctx, 0, 0, b.r * (1 - Math.abs(i) * 0.25), this.theme.fog || ['#7a8c90', '#a8b8b8', '#d4e0dc'], t * 0.15 + i, b.seed + i, 0.9, 4);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** Top-right: theme + stage, the room objective, and the minimap. */
  drawHud(ctx) {
    HUD.text(ctx, `${this.theme.name.toUpperCase()}  STAGE ${this.stage}/3`, CONFIG.screen.width - 14, 14, { size: 9, align: 'right', color: '#f2a541' });
    const goal = this.objectiveText();
    if (goal) HUD.text(ctx, goal, CONFIG.screen.width - 14, 30, { size: 7, align: 'right' });
    this.drawMinimap(ctx, CONFIG.screen.width - 14, 46);
    this.drawTimer(ctx);
  }

  /**
   * Survival and defend rooms: a big countdown at the top of the screen, with a bar
   * draining as it runs (and the lantern's health while defending). The last five
   * seconds flash red and tick.
   */
  drawTimer(ctx) {
    const r = this.active;
    if (!r || !(r.type === 'survival' || r.type === 'defend') || !(r.timeLeft > 0) || r.retry > 0) return;
    const left = r.timeLeft;
    const secs = Math.ceil(left);
    const urgent = left <= 5;
    if (urgent && secs !== this.lastTick) Sound.play('uiClick');
    this.lastTick = secs;
    const x = CONFIG.screen.width / 2;
    const w = 190;
    const h = this.totem ? 58 : 46;
    const top = 40;
    HUD.panel(ctx, x - w / 2, top, w, h);
    if (urgent) {
      ctx.fillStyle = `rgba(255, 50, 40, ${0.15 + Math.max(0, Math.sin(performance.now() / 90)) * 0.25})`;
      ctx.fillRect(x - w / 2, top, w, h);
    }
    const color = r.type === 'defend' ? '#6ad8ff' : '#ff8a1e';
    HUD.text(ctx, r.type === 'defend' ? 'DEFEND THE LANTERN' : 'SURVIVE', x, top + 4, { size: 7, align: 'center', color });
    const pop = urgent ? 1 + Math.max(0, 0.35 - (secs - left)) : 1;
    HUD.text(ctx, `${secs}`, x, top + 14, { size: Math.round(16 * pop), align: 'center', color: urgent ? '#ff6a5a' : '#ffffff' });
    // time left
    HUD.bar(ctx, x - w / 2 + 10, top + 36, w - 20, 5, left / (r.timeTotal || left), urgent ? '#ff5a4a' : color, '#1c1410');
    if (this.totem) {
      HUD.text(ctx, 'LANTERN', x - w / 2 + 10, top + 45, { size: 5, color: '#a8e8ff' });
      HUD.bar(ctx, x - w / 2 + 46, top + 46, w - 56, 4, this.totem.hp / this.totem.maxHp, '#8cf0c8', '#1c1410');
    }
  }

  objectiveText() {
    const r = this.active;
    const w = this.world;
    if (this.portal) return this.portal.exit ? 'LEAVE THE DUNGEON' : 'ENTER THE PORTAL';
    if (this.props.some((pr) => pr.kind === 'gemChest' && !pr.opened)) return 'OPEN THE GEM CHEST';
    if (!r) {
      const me = w.localPlayer;
      const here = me && this.floor.roomAt(me.x, me.y);
      const stone = here?.type === 'puzzle' && this.props.find((pr) => pr.kind === 'puzzle' && pr.room === here);
      return stone ? this.stoneText(stone) : '';
    }
    switch (r.type) {
      case 'combat': return `DEFEAT ALL ENEMIES  WAVE ${r.wave}/${r.waves}`;
      case 'defend': return r.retry > 0 ? 'THE DEFENSE STARTS OVER...' : `DEFEND THE LANTERN  ${Math.ceil(r.timeLeft)}s`;
      case 'survival': return `SURVIVE  ${Math.ceil(r.timeLeft)}s`;
      case 'boss': return `DEFEAT ${r.bossName}`;
    }
    return '';
  }

  /**
   * The minimap (scaled by the Minimap size setting): seen rooms and the hallways
   * between them, the room or hallway the hero is in highlighted, and a dot for
   * each hero at their real position. The secret room never shows on it.
   */
  drawMinimap(ctx, right, top) {
    const f = this.floor;
    const g = CONFIG.run.grid;
    const s = Settings.data.minimapSize || 1.4;
    const cw = Math.round(20 * s);
    const ch = Math.round(15 * s);
    const bw = Math.round(16 * s);
    const bh = Math.round(12 * s);
    const hall = Math.max(2, Math.round(2 * s));
    const iconPx = s >= 1.75 ? 2 : 1;
    const left = right - g.cols * cw;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.6)';
    ctx.fillRect(left - 4, top - 4, g.cols * cw + 8, g.rows * ch + 8);
    ctx.strokeStyle = 'rgba(160, 122, 36, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left - 4.5, top - 4.5, g.cols * cw + 9, g.rows * ch + 9);
    const pos = (r) => ({ x: left + r.gx * cw + cw / 2, y: top + r.gy * ch + ch / 2 });
    // where a point on the floor lands on the map
    const mapAt = (x, y) => ({ x: left + ((x / f.T - 1) / g.cellW) * cw, y: top + ((y / f.T - 1) / g.cellH) * ch });
    const me = this.world.localPlayer;
    const here = f.roomAt(me.x, me.y);
    const inHall = here ? null : f.hallAt(me.x, me.y);
    for (const l of f.links) {
      const a = f.rooms[l.a];
      const b = f.rooms[l.b];
      if (!(a.seen && b.seen)) continue;
      const pa = pos(a);
      const pb = pos(b);
      ctx.fillStyle = l === inHall ? '#c8b8e8' : '#5a4d78';
      ctx.fillRect(Math.min(pa.x, pb.x) - hall / 2, Math.min(pa.y, pb.y) - hall / 2, Math.abs(pa.x - pb.x) + hall, Math.abs(pa.y - pb.y) + hall);
    }
    for (const r of f.rooms) {
      if (!r.seen || r.type === 'secret') continue;
      const { x, y } = pos(r);
      const bx = Math.round(x - bw / 2);
      const by = Math.round(y - bh / 2);
      // cleared: green with a tick; a fight still waiting: red-rimmed (pulsing while it's on);
      // shops and other safe rooms: neutral; seen but not yet visited: dark
      const fight = LOCKING_ROOMS.includes(r.type);
      const cleared = r.state === 'cleared' && fight;
      const todo = fight && r.state !== 'cleared';
      ctx.fillStyle = cleared ? '#2c4a30' : todo ? (r.visited ? '#6a1e28' : '#3a1a24') : r.visited ? '#4a4058' : '#2a2438';
      ctx.fillRect(bx, by, bw, bh);
      if (todo) {
        const on = r.state === 'active';
        ctx.strokeStyle = on ? `rgba(255, 90, 80, ${0.6 + Math.sin(this.time * 8) * 0.4})` : '#c83a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      }
      if (cleared) ctx.globalAlpha = 0.6;
      drawRoomIcon(ctx, r.type, Math.round(x - 4 * iconPx), Math.round(y - 4 * iconPx), iconPx);
      ctx.globalAlpha = 1;
      if (cleared) {
        // a little tick in the corner
        const tx = bx + bw - 6;
        const ty = by + 1;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(tx - 1, ty + 1, 7, 5);
        ctx.fillStyle = '#8cff9a';
        ctx.fillRect(tx, ty + 3, 1, 1);
        ctx.fillRect(tx + 1, ty + 4, 1, 1);
        ctx.fillRect(tx + 2, ty + 3, 1, 1);
        ctx.fillRect(tx + 3, ty + 2, 1, 1);
        ctx.fillRect(tx + 4, ty + 1, 1, 1);
      }
      if (r === here) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(x - bw / 2) - 0.5, Math.round(y - bh / 2) - 0.5, bw + 1, bh + 1);
      }
    }
    // the heroes (not while down in the secret room: that stays off the map)
    if (here && here.type === 'secret') return;
    for (const p of this.world.players) {
      if (p.dead || p === me || f.roomAt(p.x, p.y)?.type === 'secret') continue;
      const d = mapAt(p.x, p.y);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 2, 4, 4);
      ctx.fillStyle = '#8ad0ff';
      ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 1, 2, 2);
    }
    const d = mapAt(me.x, me.y);
    const blink = Math.floor(this.time * 3) % 2 === 0;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(d.x) - 3, Math.round(d.y) - 3, 6, 6);
    ctx.fillStyle = blink ? '#ffffff' : '#ffe680';
    ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 2, 4, 4);
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
    this.souls = [];      // slain enemies' souls on their way in
    this.mendGlow = 0;
  }

  get hx() { return this.x; }
  get hy() { return this.y - 18; }

  /** A soul rises out of a slain enemy, then curls into the lantern's flame. */
  addSoul(x, y, heal) {
    const n = this.souls.length;
    const a = -Math.PI / 2 + (n % 2 ? 1 : -1) * (0.5 + (n % 3) * 0.35);
    this.souls.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, heal, t: 0, trail: [] });
  }
  get invisible() { return false; }
  /** Enemies bumping into it don't hurt it; only their actual attacks do. */
  get contactImmune() { return true; }

  knockback() {}

  update(dt, world) {
    this.time += dt;
    this.invulnerable -= dt;
    this.flashTime -= dt;
    this.mendGlow -= dt;
    const speed = CONFIG.run.defendSouls.soulSpeed;
    const tx = this.x;
    const ty = this.y - 24;
    for (const s of this.souls) {
      s.t += dt;
      // drift up for a moment, then home in harder and harder
      const dx = tx - s.x;
      const dy = ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, s.t * 1.6);
      const want = speed * (0.4 + pull);
      const steer = Math.min(1, dt * (1.5 + pull * 6));
      s.vx += ((dx / d) * want - s.vx) * steer;
      s.vy += ((dy / d) * want - s.vy) * steer;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 9) s.trail.shift();
      if (d < 9 || s.t > 4) {
        s.dead = true;
        if (!this.dead) this.mend(s.heal, world);
      }
    }
    this.souls = this.souls.filter((s) => !s.dead);
  }

  /** A soul reaches the flame: it flares and the lantern mends. */
  mend(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.mendGlow = 0.35;
    world.effects.burst(this.x, this.y - 24, { count: 8, colors: ['#6ad8ff', '#e6f6ff', '#b4f0ff'], speed: [20, 70], life: [0.3, 0.6], up: 30, size: [1, 2] });
    const gained = Math.round(this.hp - before);
    if (gained > 0) world.effects.text(this.x, this.y - 54, `+${gained}`, { color: '#8cf0c8', size: 8 });
    Sound.play('pickup');
  }

  drawSouls(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.souls) {
      const fade = Math.min(1, s.t * 5);
      // a fading wispy tail
      s.trail.forEach((p, i) => {
        const k = (i + 1) / s.trail.length;
        ctx.fillStyle = `rgba(106, 216, 255, ${0.35 * k * fade})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1 + k * 2.5, 0, TAU);
        ctx.fill();
      });
      const wob = Math.sin(this.time * 14 + s.heal) * 1.2;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 12);
      g.addColorStop(0, `rgba(200, 245, 255, ${0.8 * fade})`);
      g.addColorStop(1, 'rgba(106, 216, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - 12, s.y - 12, 24, 24);
      ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
      ctx.fillRect(Math.round(s.x - 2 + wob), Math.round(s.y - 2), 4, 4);
      ctx.fillStyle = `rgba(106, 216, 255, ${fade})`;
      ctx.fillRect(Math.round(s.x - 1 + wob), Math.round(s.y - 4), 2, 2);
    }
    ctx.restore();
  }

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
    ctx.fillStyle = this.mendGlow > 0 ? '#b4f0ff' : '#6ad8ff';
    ctx.fillRect(x - 4, y - 30 + flick, 8, 14 - flick);
    ctx.fillStyle = '#e6f6ff';
    ctx.fillRect(x - 2, y - 24, 4, 7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 24, 2, x, y - 24, 46);
    g.addColorStop(0, `rgba(106, 216, 255, ${0.35 + Math.max(0, this.mendGlow) * 1.2})`);
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

