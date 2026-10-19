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
  shop: { name: 'Shop', color: '#ffd34a', desc: 'Two stores: pick an upgrade (or reroll) at the enchanter, buy potions from Mira.' },
  special: { name: 'Special', color: '#c08aff', desc: 'Something unusual: a blacksmith, restaurant, wishing well, trader, treasure... The wishing well grants a wish for coins; the rest are coming soon.' },
  secret: { name: 'Secret', color: '#fff6c8', desc: 'Not connected to anything. Look for a glowing hole in a combat room floor and jump in. Three chests, open two: one is a mimic.' },
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
  restaurant5: { name: 'RESTAURANT', color: '#ffd34a' },
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
    // this stage's shop: the potion shelf (shared) and each hero's upgrade store state
    this.shopSeed = Math.floor(Math.random() * 2 ** 31);
    this.potionStock = [];
    this.shopStates = {};
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
    w.banner(`${this.theme.name.toUpperCase()} - STAGE ${this.stage}`, this.stage === 1 ? 'Clear the rooms and find the boss' : 'The dead grow stronger', 3);
  }

  nextStage() {
    const w = this.world;
    this.stage++;
    // fallen teammates get back up for the new stage, at half health
    for (const p of w.players) {
      if (!p.dead) continue;
      p.dead = false;
      p.hp = Math.round(p.maxHp * 0.5);
      p.invulnerable = 1;
    }
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
    this.time += dt;
    for (const p of w.heroes) {
      const here = this.floor.roomAt(p.x, p.y);
      if (here) this.visit(here);
      // only lock once the hero is clear of the doorway
      const inside = this.floor.roomAt(p.x, p.y, 1);
      if (inside && inside.state === 'idle' && !this.active) this.enter(inside, p);
    }
    if (this.active) this.updateRoom(dt);
    this.updateSpikes(dt);
    this.updateProps(dt);
    this.decor.update(dt, w);
    if (this.totem) this.totem.update(dt);
    for (const p of w.players) p.coinFlash -= dt;
    // the portal only works once every hero has stepped away from it (so it can't grab
    // someone the moment it opens); then any hero stepping in takes the whole party
    if (this.portal) {
      const heroes = w.heroes;
      if (heroes.every((p) => dist(p.x, p.y, this.portal.x, this.portal.y) > 50)) this.portal.armed = true;
      if (this.portal.armed && heroes.some((p) => dist(p.x, p.y, this.portal.x, this.portal.y) < 26)) {
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
    for (const d of r.doors) if (!d.secret) f.lock(d.tiles);
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

  /** Coins go into one hero's purse (each hero keeps their own for the whole run). */
  addCoins(n, hero) {
    hero.coins += n;
    hero.coinFlash = 0.25;
  }

  /** A hero's upgrade-store state at this stage's shop: { rerolls, bought (upgrade id or null) }. */
  shopState(hero) {
    const key = hero.netId || 'solo';
    return this.shopStates[key] || (this.shopStates[key] = { rerolls: 0, bought: null });
  }

  // Shop actions are commands, so every machine applies them on the same tick.

  /** Upgrade store: buy one of the hero's three offers (one per shop). */
  buyUpgrade(hero, id) {
    const st = this.shopState(hero);
    const u = upgradeOffers(this, hero).find((x) => x.id === id);
    const price = u ? upgradePrice(u, this) : Infinity;
    const ok = !!u && !st.bought && !hero.upgradeLevels[id] && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      hero.upgradeLevels[id] = 1;
      u.apply(hero);
      st.bought = id;
      this.enchantFx(hero, u);
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

  /** Every price in this stage's shop is multiplied by this (shops cost more deeper in). */
  get priceScale() { return this.byStage(CONFIG.run.shop.stagePrice); }

  /** Upgrade store: pay to swap the three offers for three new ones. */
  rerollUpgrades(hero) {
    const st = this.shopState(hero);
    const price = rerollPrice(st.rerolls, this);
    const ok = !st.bought && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      st.rerolls++;
    }
    this.world.events.onPurchase?.(hero, 'reroll', ok);
  }

  /** Potion store: buy one potion off the shared shelf into the hero's bag. */
  buyPotion(hero, id) {
    const s = this.potionStock.find((x) => x.id === id);
    const pot = POTIONS[id];
    const price = pot ? potionPrice(this, id) : Infinity;
    const ok = !!s && !!pot && s.left > 0 && hero.coins >= price && hero.canCarry(id);
    if (ok) {
      hero.coins -= price;
      s.left--;
      hero.addItem(id);
    }
    this.world.events.onPurchase?.(hero, 'potion', ok);
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
    // somewhere in the room, away from every hero
    const tooClose = (pt) => w.heroes.some((p) => dist(pt.x, pt.y, p.x, p.y) < 170);
    let pt = this.floor.randomPointIn(r, 2);
    for (let i = 0; i < 20 && tooClose(pt); i++) pt = this.floor.randomPointIn(r, 2);
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
    const type = this.theme.boss;
    w.boss = Game.createBoss(type, { x: r.cx, y: r.cy - 20 });
    const s = this.scale;
    const b = w.boss;
    b.maxHp = Math.round(b.maxHp * s.hp * w.playerScale.hp);   // stage x party size
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
      // two stores: Mira's potions on the left, Bram's enchantments (upgrades) on the right
      add('shopkeeper', -3, -1, 'POTIONS', '#ff8aa0');
      add('enchanter', 3, -1, 'UPGRADES', '#8ab8ff');
      this.potionStock = rollPotionStock();
    } else if (r.type === 'special') {
      const info = SPECIAL_INFO[r.special];
      if (r.special === 'treasure') for (const dx of [-3, 0, 3]) add('chest', dx, 0, 'TREASURE CHEST', info.color);
      else add(r.special, 0, -0.5, info.name, info.color);
    } else if (r.type === 'puzzle') {
      add('puzzle', 0, -0.5, 'PUZZLE ROOM', ROOM_INFO.puzzle.color);
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
    for (const pr of this.props) {
      if (pr.opened) continue;
      const reach = pr.kind === 'hole' || pr.kind === 'holeExit' ? dist(p.x, p.y, pr.x, pr.y) < 40 : dist(p.x, p.y, pr.x, pr.y + 10) < 44;
      if (reach) { p.nearProp = pr; break; }
    }
    const pr = p.nearProp;
    if (!pr || !Input.pressed('interact')) return;
    Input.consume('interact');
    if (pr.kind === 'rewardChest') return this.openChest(pr);
    if (pr.kind === 'secretChest') return this.openSecretChest(pr);
    if (pr.kind === 'wishingWell') return this.wish(pr, p);
    if (pr.kind === 'hole') return this.descend(p);
    if (pr.kind === 'holeExit') return this.ascend(p);
    if (pr.kind === 'shopkeeper' || pr.kind === 'chef' || pr.kind === 'enchanter') return w.events.onNpc?.(pr.kind, this, p);
    if (pr.kind === 'restaurant5') return w.events.onNpc?.('chef', this, p);
    if (p === w.localPlayer) {
      w.events.onToast?.(`${pr.label}: COMING SOON`);
      Sound.play('uiClick');
    }
  }

  /** Opened chests animate their lid. */
  updateProps(dt = 0) {
    for (const pr of this.props) if (pr.opened) pr.t += dt;
  }

  openChest(pr) {
    const w = this.world;
    pr.opened = true;
    pr.t = 0;
    // 5 coins for every hero in the party
    this.spawnCoins(pr.x, pr.y - 12, CONFIG.run.coins.roomChest * this.world.players.length);
    w.effects.burst(pr.x, pr.y - 14, { count: 30, colors: ['#ffd34a', '#fff2a0', '#ffffff'], speed: [60, 180], life: [0.3, 0.7], up: 60 });
    w.effects.text(pr.x, pr.y - 40, `+${CONFIG.run.coins.roomChest} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
    Sound.play('chestOpen');
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
    w.effects.burst(pr.x, pr.y - 14, { count: 30, colors: ['#fff6c8', '#ffd34a', '#ffffff'], speed: [60, 180], life: [0.3, 0.7], up: 60 });
    Sound.play('chestOpen');
    if (Math.random() < 0.5) {
      const n = randInt(c.coins[0], c.coins[1]);
      this.spawnCoins(pr.x, pr.y - 12, n);
      w.effects.text(pr.x, pr.y - 44, `+${n} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
    } else {
      const n = randInt(c.potions[0], c.potions[1]);
      this.spawnPotions(pr.x, pr.y, n, () => choose(Object.keys(POTIONS)));
      w.effects.text(pr.x, pr.y - 44, `${n} POTIONS!`, { color: '#ff8aa0', size: 9, life: 1.2 });
    }
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
   * the pity-th); the wish is 2-6 of one random potion. One wish per hero.
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
    const id = choose(Object.keys(POTIONS));
    const n = randInt(c.potions[0], c.potions[1]);
    this.spawnPotions(pr.x, pr.y + 30, n, () => id);
    w.effects.burst(pr.x, pr.y - 20, { count: 40, colors: ['#6ad8ff', '#ffffff', '#ffe680'], speed: [60, 200], life: [0.4, 0.8], up: 80 });
    w.effects.text(pr.x, pr.y - 50, `WISH GRANTED: ${n} ${POTIONS[id].name.toUpperCase()}`, { color: '#6ad8ff', size: 8, life: 1.8 });
    Sound.play('chestOpen');
  }

  // ---------- world hooks ----------

  /** Extra things hero attacks can hit (none right now). */
  targets() { return []; }

  /** Extra things enemies attack (the defend totem). */
  allies() { return this.totem && !this.totem.dead ? [this.totem] : []; }

  getDrawables() {
    // holes are flat on the floor, so they always sort under the characters;
    // special rooms are whole little scenes (Scenes) with their label on top
    const items = [];
    for (const pr of this.props) {
      if (Scenes[pr.kind]) {
        items.push(...Scenes.drawables(pr.kind, pr.x, pr.y, this.time));
        items.push({ y: pr.y + 80, draw: (ctx) => this.drawPropLabel(ctx, pr) });
      } else {
        items.push({ y: pr.kind === 'hole' || pr.kind === 'holeExit' ? pr.y - 1000 : pr.y, draw: (ctx) => this.drawProp(ctx, pr) });
      }
    }
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
      case 'enchanter':
      case 'chef': {
        // the keeper stands behind a counter under a striped awning
        const frames = Sprites.npcs[pr.kind].idle;
        drawSprite(ctx, frames[Math.floor((this.time + x * 0.01) * 2.5) % frames.length].img, x, y - 8, HERO_ANCHOR.x, HERO_ANCHOR.y, pr.kind !== 'shopkeeper', 1);
        const enchant = pr.kind === 'enchanter';
        box(56, 18, enchant ? '#3e5a96' : '#9c6c3e', enchant ? '#22325e' : '#5b3922');
        ctx.fillStyle = enchant ? '#d4ac4c' : '#7d532f';
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
      case 'rewardChest':
      case 'secretChest': {
        if (pr.gone) return;   // it was a mimic
        const secret = pr.kind === 'secretChest';
        const lift = pr.opened && !pr.sealed ? Math.min(1, pr.t * 6) : 0;
        if (secret && !pr.opened) drawGlints(ctx, [[x - 10, y - 22], [x + 11, y - 14], [x + 3, y - 26]], this.time + x * 0.01);
        if (pr.opened && !pr.sealed && pr.t < 1.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 40);
          g.addColorStop(0, `rgba(255, 220, 120, ${0.6 * (1 - pr.t / 1.5)})`);
          g.addColorStop(1, 'rgba(255, 220, 120, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, y - 54, 80, 80);
          ctx.restore();
        }
        // secret chests: dark violet wood with silver trim
        const trim = secret ? '#cfc7e8' : '#dcb44c';
        if (pr.sealed) ctx.globalAlpha = 0.55;
        box(28, 14, secret ? '#4a3a5e' : '#7d532f', secret ? '#2e2440' : '#5b3922');
        ctx.fillStyle = trim;
        ctx.fillRect(x - 14, y - 9, 28, 2);
        // the lid tips back when opened
        const ly = y - 14 - lift * 8;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 15, ly - 10 + lift * 4, 30, 11 - lift * 4);
        ctx.fillStyle = secret ? '#5c4a74' : '#9c6c3e';
        ctx.fillRect(x - 14, ly - 9 + lift * 4, 28, 9 - lift * 4);
        ctx.fillStyle = trim;
        ctx.fillRect(x - 14, ly - 2, 28, 2);
        if (!pr.opened || pr.sealed) ctx.fillRect(x - 2, y - 17, 4, 6);
        ctx.globalAlpha = 1;
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
      case 'chest':
        drawProp(ctx, 'chest', x, y + 2);
        drawGlints(ctx, [[x - 8, y - 18], [x + 9, y - 10], [x + 2, y - 22]], this.time + x * 0.01);
        break;
      case 'puzzle': {
        // a rune-carved stone tablet with runes glowing in turn
        box(26, 34, '#78738a', '#5c586c');
        for (let i = 0; i < 3; i++) {
          const on = Math.floor(this.time * 1.5) % 3 === i;
          ctx.fillStyle = on ? '#e0c0ff' : '#9a6ae0';
          ctx.fillRect(x - 7 + i * 6, y - 26 + (i % 2) * 6, 3, 8);
          if (on) drawGlow(ctx, x - 6 + i * 6, y - 22 + (i % 2) * 6, 14, '190, 130, 255', 0.35);
        }
        break;
      }
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

  /** The prop's name, or "[E] ..." when the local hero can use it. */
  drawPropLabel(ctx, pr) {
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    if (pr.opened) return;
    const near = this.world.localPlayer.nearProp === pr;
    const npc = ['shopkeeper', 'chef', 'enchanter', 'restaurant5'].includes(pr.kind);
    const labelY = npc || Scenes[pr.kind] ? y - 86 : pr.kind === 'rewardChest' || pr.kind === 'secretChest' ? y - 36 : y - 62;
    let label = near && npc ? 'TALK' : pr.label;
    if (pr.kind === 'wishingWell') {
      const st = pr.wishes?.[this.world.localPlayer.netId || 'solo'];
      if (st?.granted) label = 'WISH GRANTED';
      else if (near) label = 'TOSS A COIN';
    }
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
    const near = this.world.localPlayer.nearProp === pr;
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
    const here = f.roomAt(this.world.localPlayer.x, this.world.localPlayer.y);
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
  /** Enemies bumping into it don't hurt it; only their actual attacks do. */
  get contactImmune() { return true; }

  knockback() {}

  update(dt) {
    this.time += dt;
    this.invulnerable -= dt;
    this.flashTime -= dt;
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

