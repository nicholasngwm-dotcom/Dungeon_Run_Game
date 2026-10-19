// One run of the game (or the lobby between runs): owns the world state,
// updates and renders it. Entities receive this object as `world`.
//
// There can be several heroes (multiplayer). Simulation code must only ever
// use `players` / `heroes` (or the hero acting right now, `actor`); `player`
// and `localPlayer` are the hero on THIS screen and are for the camera, HUD
// and menus only. In multiplayer every machine runs the same simulation from
// the same inputs (see Session), so the simulation must not depend on which
// hero is local.

class Game {
  /**
   * classId: the hero for single player (ignored when opts.roster is given).
   * opts.practice: practice-range cheat options ({ infiniteMana,
   * infiniteEnergy, god }) or null for a normal run.
   * opts.lobby: true for the hub room (no waves; stations to walk up to).
   * opts.run: { mode: 'set' | 'random', theme } for a dungeon run (generated floors,
   *   3 stages); otherwise it's the test dungeon (the original wave arena).
   * opts.roster: [{ id, name, classId }] for multiplayer; opts.localId: which one is this screen.
   */
  constructor(classId, events, opts = {}) {
    this.events = events;          // { onGameOver(stats), onVictory(stats), onInteract(station, hero), onToast(text), onNpc(kind, run, hero) }
    this.camera = new Camera(CONFIG.screen.width, CONFIG.screen.height);
    this.effects = new Effects();
    this.timers = [];
    this.roster = opts.roster || [{ id: 'local', name: '', classId }];
    this.localId = opts.localId || this.roster[0].id;
    this.multiplayer = !!opts.roster;
    this.players = [];
    // a run builds its own floors (FloorMap) and sets this.dungeon
    this.run = opts.run ? new DungeonRun(this, opts.run) : null;
    if (!this.run) this.dungeon = new Dungeon(opts.lobby ? LOBBY_LAYOUT : {});
    const s = this.dungeon.playerStart;
    this.roster.forEach((r, i) => {
      const off = Game.spawnOffset(i);
      this.players.push(this.makeHero(r, r.classId, s.x + off.x, s.y + off.y));
    });
    this.enemies = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.clones = [];
    this.barriers = [];            // Knight barrier shields; soak enemy projectiles while raised
    this.dots = [];
    this.hazards = [];
    this.boss = null;
    this.pendingSpawns = 0;
    this.time = 0;
    this.kills = 0;
    this.bannerData = null;
    this.finished = false;
    this.mouseWorld = { x: 0, y: 0 };
    this.actor = null;             // the hero whose turn it is (their attacks, their input)
    this.director = new WaveDirector(this);
    this.practice = opts.practice ? { options: opts.practice, log: [], total: 0, respawn: 0 } : null;
    this.dummies = [];
    this.readyCheck = null;        // multiplayer lobby: { ready: { id: bool } } while the host waits at the gate
    if (this.practice) {
      const c = this.dungeon.center;
      this.dummies.push(new TrainingDummy(c.x - 220, c.y + 40));
      this.banner('PRACTICE RANGE', 'Use the panel to spawn enemies and toggle cheats', 2.6);
    }
    this.lobby = opts.lobby ? new LobbyHub(this) : null;
    if (this.lobby) {
      // a dummy by the practice targets to try abilities on
      const T = CONFIG.tileSize;
      this.dummies.push(new TrainingDummy(31 * T, 16 * T));
      if (opts.welcome) this.banner('THE LOBBY', 'Pick a hero, then head through the gate', 2.6);
    }
    if (this.run) this.run.start();
    this.camera.follow(this.player.x, this.player.y, 0, this.dungeon.width, this.dungeon.height, true);
    this.vignette = Game.buildVignette();
  }

  /** Heroes stand in a loose group: 4 per row. */
  static spawnOffset(i) {
    return { x: ((i % 4) - 1.5) * 30, y: Math.floor(i / 4) * 26 };
  }

  /** A hero for a roster entry, tagged with its network id and name. */
  makeHero(entry, classId, x, y) {
    const p = createHero(classId, x, y);
    p.netId = entry.id;
    p.name = entry.name;
    return p;
  }

  // ---------------------------------------------------------
  //  Heroes
  // ---------------------------------------------------------

  /** The hero on this screen (camera, HUD, menus). Never use it in simulation code. */
  get localPlayer() {
    return this.players.find((p) => p.netId === this.localId) || this.players[0];
  }

  /**
   * In single player there's only one hero, so `player` is it. While a boss
   * updates, it's the hero the boss is focused on (bosses were written for
   * one target). Everywhere else it's the local hero.
   */
  get player() { return this.bossFocus || this.localPlayer; }
  set player(p) { this.replaceHero(this.localPlayer, p); }

  replaceHero(old, p) {
    p.netId = old.netId;
    p.name = old.name;
    const i = this.players.indexOf(old);
    if (i >= 0) this.players[i] = p;
  }

  /** Living heroes, in roster order. */
  get heroes() { return this.players.filter((p) => !p.dead); }

  /** The nearest living hero to a point (or the first hero if all are down). */
  nearestHero(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.dead) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best || this.players[0];
  }

  heroById(id) { return this.players.find((p) => p.netId === id) || null; }

  /** Enemy toughness / numbers grow with the party size. */
  get playerScale() {
    const m = CONFIG.multiplayer;
    const extra = Math.max(0, this.players.length - 1);
    return { hp: 1 + m.hpPerExtraPlayer * extra, count: 1 + m.countPerExtraPlayer * extra };
  }

  // ---------------------------------------------------------
  //  API used by entities
  // ---------------------------------------------------------

  /** Everything the heroes' attacks can hit. */
  getTargets() {
    const list = this.enemies.filter((e) => !e.dead && e.age > 0.15);
    if (this.boss) list.push(...this.boss.getTargets());
    list.push(...this.dummies);
    if (this.run) list.push(...this.run.targets());
    return list;
  }

  /**
   * Applies hero damage (with crits, numbers, knockback, sound). The damage
   * belongs to `source` (default: the acting hero) for its multipliers, ult
   * charge and kill credit. sound: null for silent ticks. fromUlt: damage from
   * an ultimate doesn't charge the ultimate. Returns the damage dealt (0 if none).
   */
  damageTarget(target, amount, { angle = 0, knockback = 0, sound = 'hit', noCrit = false, color = '#ffffff', fromUlt = false, source = null } = {}) {
    const src = source || this.actor || this.players[0];
    const crit = !noCrit && Math.random() < (src.critChance ?? CONFIG.player.critChance);
    const dmg = Math.max(1, Math.round(amount * (crit ? CONFIG.player.critMultiplier : 1) * src.damageMultiplier * src.buffDamage * src.upgradeDamage));
    if (!target.takeDamage(dmg, this)) return 0;
    target.lastHitBy = src;
    if (knockback) target.knockback(angle, knockback * (src.knockbackMultiplier || 1));
    if (crit) {
      // visual only (effects and the camera use the unshared random), so safe in multiplayer
      this.effects.crit(target.hx, target.hy, dmg, angle, dmg >= 120);
      if (src === this.localPlayer) this.shake(dmg >= 120 ? 4 : 2.5, 0.12);
      if (sound !== null) Sound.play('crit', 0.04);
    } else {
      this.effects.text(target.hx, target.hy - 22, `${dmg}`, { color, size: 8 });
      if (sound !== null) {
        this.effects.burst(target.hx, target.hy, { count: 4, colors: ['#ffffff', '#ffe0a0'], speed: [40, 120], life: [0.1, 0.25] });
        Sound.play(sound || 'hit', 0.04);
      }
    }
    if (!fromUlt && !src.dead) src.gainUlt(dmg);
    src.onDamageDealt(target, dmg, this);
    if (this.practice) {
      this.practice.log.push({ t: this.time, dmg });
      this.practice.total += dmg;
    }
    return dmg;
  }

  /** Damage over time (bleed etc.), ticking twice a second; it belongs to the hero who applied it. */
  addDot(target, dps, duration, color = '#ff6060') {
    this.dots.push({ target, dps, t: duration, tick: 0.5, color, source: this.actor });
  }

  updateDots(dt) {
    for (const d of this.dots) {
      d.t -= dt;
      d.tick -= dt;
      if (d.target.dead) { d.dead = true; continue; }
      if (d.tick <= 0) {
        d.tick += 0.5;
        this.damageTarget(d.target, d.dps * 0.5, { sound: null, noCrit: true, color: d.color, source: d.source });
        this.effects.burst(d.target.hx, d.target.hy, { count: 2, colors: [d.color, '#7a1010'], speed: [10, 40], life: [0.2, 0.4] });
      }
      if (d.t <= 0) d.dead = true;
    }
    removeDead(this.dots);
  }

  /** The heroes plus anything enemies may attack instead (clones, a defend room's lantern). */
  get allies() {
    const list = this.heroes;
    list.push(...this.clones.filter((c) => !c.dead));
    if (this.run) list.push(...this.run.allies());
    return list;
  }

  /**
   * What an enemy should chase: the nearest ally it can see. Returns a
   * stand-in with dead = true when there is nothing to chase.
   */
  targetFor(enemy) {
    // defend rooms: a hero if spotted, otherwise the lantern
    if (this.run && this.run.totem && !this.run.totem.dead) return this.run.defendTarget(enemy);
    let best = null;
    let bestD = Infinity;
    for (const a of this.allies) {
      const d = dist(enemy.x, enemy.y, a.x, a.y);
      if (a.invisible && d > (a.detectRange ?? CONFIG.player.invisibleDetectRange)) continue;
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) return best;
    const p = this.players[0];
    return { dead: true, x: p.x, y: p.y, hx: p.hx, hy: p.hy, radius: 0, hurt: () => false };
  }

  addEnemy(enemy) {
    const s = this.enemyScale;
    if (s.hp !== 1 || s.damage !== 1) {
      const cfg = enemy.cfg;
      enemy.cfg = { ...cfg, damage: Math.round(cfg.damage * s.damage) };
      if (cfg.contactDamage) enemy.cfg.contactDamage = Math.round(cfg.contactDamage * s.damage);
      enemy.maxHp = Math.round(enemy.maxHp * s.hp);
      enemy.hp = enemy.maxHp;
    }
    this.enemies.push(enemy);
  }

  /** Stage / wave scaling times party size (boss minions and the practice range don't scale with waves). */
  get enemyScale() {
    const party = this.playerScale.hp;
    if (this.run) return { hp: this.run.scale.hp * party, damage: this.run.scale.damage };
    const d = this.director;
    if (this.practice) return { hp: 1, damage: 1 };
    if (d.state === 'boss' || d.waveIndex <= 0) return { hp: party, damage: 1 };
    const s = CONFIG.waveScaling;
    return { hp: (1 + s.hp * d.waveIndex) * party, damage: 1 + s.damage * d.waveIndex };
  }

  /** Shows a summoning circle, then spawns the enemy. setup(enemy), if given, runs once it appears. */
  spawnEnemy(type, x, y, setup = null) {
    if (x === undefined) {
      let pt;
      for (let i = 0; i < 30; i++) {
        pt = this.dungeon.randomFloorPoint(60);
        const near = this.nearestHero(pt.x, pt.y);
        if (dist(pt.x, pt.y, near.x, near.y) > 260) break;
      }
      x = pt.x;
      y = pt.y;
    }
    ({ x, y } = this.dungeon.freePoint(x, y, 16, 16));
    this.pendingSpawns++;
    const life = CONFIG.spawnTelegraph;
    this.effects.add(life, (ctx, t) => {
      const r = 22 * Math.min(1, t * 3);
      ctx.save();
      ctx.strokeStyle = `rgba(180, 90, 255, ${0.9 - t * 0.4})`;
      ctx.fillStyle = `rgba(120, 40, 200, ${0.25 + t * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, r, r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }, true);
    Sound.play('spawn', 0.1);
    this.after(life, () => {
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
      const enemy = createEnemy(type, x, y);
      this.addEnemy(enemy);
      if (setup) setup(enemy);
      this.effects.burst(x, y - 10, { count: 12, colors: ['#b45aff', '#6a28c8', '#e0c0ff'], speed: [30, 100], up: 60 });
    }).spawn = true;
  }

  maybeDropHeart(x, y, chance = CONFIG.drops.heartChance) {
    if (Math.random() < chance) this.pickups.push(new HeartPickup(x, y));
  }

  /** Mana orbs only drop while someone in the party uses mana. */
  maybeDropMana(x, y) {
    if (!this.players.some((p) => p.resource && p.resource.name === 'MANA')) return;
    if (Math.random() >= CONFIG.drops.manaChance) return;
    this.pickups.push(new ManaPickup(x + rand(-8, 8), y + rand(-8, 8)));
  }

  /** The first barrier crossing the segment, or null (lasers and other hitscan shots). */
  barrierOnSegment(x1, y1, x2, y2) {
    return this.barriers.find((b) => !b.dead && b.crossesSegment(x1, y1, x2, y2)) || null;
  }

  /** The first barrier a projectile at (x, y) with radius r is touching, or null. */
  barrierAt(x, y, r) {
    return this.barriers.find((b) => !b.dead && b.touches(x, y, r)) || null;
  }

  /** Enemy bodies hurt heroes/clones they touch (not while airborne or fading in). */
  contactDamage() {
    for (const e of this.enemies) {
      if (e.dead || e.age < 0.3 || e.state === 'leap') continue;
      const damage = e.cfg.contactDamage ?? CONFIG.enemyContactDamage;
      if (damage <= 0) continue;
      for (const a of this.allies) {
        if (a.contactImmune) continue;
        if (dist(e.x, e.y, a.x, a.y) < e.radius + a.radius) a.hurt(damage, this, e.x, e.y);
      }
    }
  }

  /** Expanding ground ring that damages heroes/clones once as it passes. */
  addShockwave(x, y, { radius, speed, width, damage, color = '255, 150, 60' }) {
    this.hazards.push({ x, y, r: 6, radius, speed, width, damage, color, hit: new Set() });
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      h.r += h.speed * dt;
      if (h.r >= h.radius) h.dead = true;
      for (const a of this.allies) {
        if (h.hit.has(a) || Math.abs(dist(a.x, a.y, h.x, h.y) - h.r) > h.width) continue;
        if (a.hurt(h.damage, this, h.x, h.y)) h.hit.add(a);
      }
    }
    removeDead(this.hazards);
  }

  drawHazards(ctx) {
    for (const h of this.hazards) {
      const fade = 1 - h.r / h.radius;
      ctx.save();
      ctx.strokeStyle = `rgba(${h.color}, ${0.4 + 0.5 * fade})`;
      ctx.lineWidth = h.width * 0.8;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  after(seconds, fn) {
    const timer = { t: seconds, fn };
    this.timers.push(timer);
    return timer;
  }

  shake(magnitude, duration) {
    this.camera.shake(magnitude, duration);
  }

  banner(text, sub = '', duration = 2.4) {
    this.bannerData = { text, sub, t: duration, maxT: duration };
  }

  /** type: 'golem' | 'phantom', or omitted to roll using CONFIG.bosses. */
  startBoss(type = Game.rollBoss()) {
    Music.play('boss');
    for (const p of this.heroes) p.heal(p.maxHp * CONFIG.bossHealPercent, this);
    this.boss = Game.createBoss(type, this.dungeon.center);
    this.boss.maxHp = Math.round(this.boss.maxHp * this.playerScale.hp);
    this.boss.hp = this.boss.maxHp;
    this.banner(this.boss.name, this.boss.title, 3);
    Sound.play('bossRoar');
  }

  static rollBoss() {
    const entries = Object.entries(CONFIG.bosses);
    let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [type, w] of entries) {
      if ((r -= w) < 0) return type;
    }
    return entries[0][0];
  }

  static createBoss(type, center) {
    return type === 'phantom' ? new PhantomKing(center.x, center.y) : new Golem(center.x, center.y + 40);
  }

  onBossDefeated() {
    if (this.run) return this.run.onBossDefeated();
    if (this.practice) {
      this.banner(`${this.boss.name} DEFEATED`, 'Spawn it again from the panel');
      return;
    }
    if (this.finished) return;
    this.finished = true;
    this.defeatText = this.boss.defeatText;
    Music.stop();
    this.after(2.5, () => {
      Sound.play('victory');
      this.events.onVictory(this.stats);
    });
  }

  /**
   * The boss keeps attacking one hero for a few seconds, then re-picks the
   * nearest living one, so a party splits its attention.
   */
  updateBossFocus(dt) {
    const b = this.boss;
    b.focusTimer = (b.focusTimer || 0) - dt;
    if (!b.focus || b.focus.dead || !this.players.includes(b.focus) || b.focusTimer <= 0) {
      b.focus = this.nearestHero(b.x, b.y);
      b.focusTimer = 4;
    }
  }

  // ---------------------------------------------------------
  //  Commands (hero picks, shopping, ready checks)
  //  In multiplayer these arrive inside the host's input bundles, so every
  //  machine applies them on the same tick.
  // ---------------------------------------------------------

  applyCommand(cmd, fromId) {
    const hero = this.heroById(fromId);
    switch (cmd.type) {
      case 'hero': {
        if (!this.lobby || !hero || hero.classId === cmd.classId) return;
        const taken = this.players.filter((p) => p.classId === cmd.classId).length;
        if (this.multiplayer && taken >= CONFIG.multiplayer.maxDuplicates) {
          if (fromId === this.localId) this.events.onToast?.(`ONLY ${CONFIG.multiplayer.maxDuplicates} OF EACH HERO`);
          return;
        }
        this.swapHero(cmd.classId, hero);
        return;
      }
      case 'buy':
        if (this.run && hero) this.run.buyUpgrade(hero, cmd.upgrade);
        return;
      case 'reroll':
        if (this.run && hero) this.run.rerollUpgrades(hero);
        return;
      case 'buyPotion':
        if (this.run && hero) this.run.buyPotion(hero, cmd.id);
        return;
      case 'moveItem':
        if (hero) hero.moveItem(cmd.from, cmd.to);
        return;
      case 'readyCheck':
        if (this.lobby && fromId === this.roster[0].id && !this.readyCheck) {
          this.readyCheck = { ready: {} };
          for (const p of this.players) this.readyCheck.ready[p.netId] = p.netId === fromId;
        }
        return;
      case 'ready':
        if (this.readyCheck && hero) this.readyCheck.ready[fromId] = !!cmd.value;
        return;
      case 'cancelReady':
        if (fromId === this.roster[0].id) this.readyCheck = null;
        return;
      case 'leave':
        this.removeHero(cmd.id);
        return;
    }
  }

  get allReady() {
    return !!this.readyCheck && this.players.every((p) => this.readyCheck.ready[p.netId]);
  }

  /** A player left the game: their hero (and clones) vanish. */
  removeHero(id) {
    const p = this.heroById(id);
    if (!p) return;
    this.effects.burst(p.hx, p.hy, { count: 20, colors: ['#b45aff', '#e0c0ff'], speed: [30, 120], life: [0.3, 0.6], up: 40 });
    this.players.splice(this.players.indexOf(p), 1);
    this.roster = this.roster.filter((r) => r.id !== id);
    this.clones = this.clones.filter((c) => c.owner !== p);
    if (this.readyCheck) delete this.readyCheck.ready[id];
  }

  // ---------------------------------------------------------
  //  PRACTICE RANGE
  // ---------------------------------------------------------

  /** Lobby: a hero becomes another hero on the spot. */
  swapHero(classId, old = this.localPlayer) {
    const p = createHero(classId, old.x, old.y);
    this.replaceHero(old, p);
    this.clones = this.clones.filter((c) => c.owner !== old);
    this.barriers = this.barriers.filter((b) => b.owner !== old);
    this.effects.burst(old.hx, old.hy, { count: 30, colors: ['#ffe680', '#ffffff', '#b45aff'], speed: [40, 160], life: [0.3, 0.7], up: 40 });
    Sound.play('pickup');
  }

  practiceSpawn(type) {
    if (type !== 'golem' && type !== 'phantom') return this.spawnEnemy(type);
    if (this.boss) return;
    this.boss = Game.createBoss(type, this.dungeon.center);
    Sound.play('bossRoar');
  }

  clearEnemies() {
    this.enemies = [];
    this.boss = null;
    this.enemyProjectiles = [];
    this.hazards = [];
    this.timers = this.timers.filter((t) => !t.spawn); // cancel summons in progress
    this.pendingSpawns = 0;
  }

  resetDps() {
    this.practice.log = [];
    this.practice.total = 0;
    for (const d of this.dummies) d.hp = d.maxHp;
  }

  /** Damage per second over the last 5 seconds. */
  get dps() {
    const log = this.practice.log;
    if (!log.length) return 0;
    const span = Math.max(1, Math.min(5, this.time - log[0].t));
    return log.reduce((s, e) => s + e.dmg, 0) / span;
  }

  updatePractice(dt) {
    const pr = this.practice;
    const o = pr.options;
    const p = this.player;
    // infinite mana also covers the Priestess's light orbs
    if (p.resource && ((p.resource.name !== 'ENERGY' && o.infiniteMana) || (p.resource.name === 'ENERGY' && o.infiniteEnergy))) {
      p.resource.value = p.resource.max;
    }
    while (pr.log.length && pr.log[0].t < this.time - 5) pr.log.shift();
    for (const d of this.dummies) d.update(dt);

    // no game over in practice: respawn instead
    if (p.dead && pr.respawn <= 0) {
      pr.respawn = 1.5;
      this.banner('DOWNED', 'Respawning...', 1.5);
    }
    if (pr.respawn > 0) {
      pr.respawn -= dt;
      if (pr.respawn <= 0) {
        const s = this.dungeon.playerStart;
        this.player = createHero(p.classId, s.x, s.y);
        this.clones = [];
        this.barriers = [];
      }
    }
  }

  get stats() {
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60).toString().padStart(2, '0');
    return {
      time: `${m}:${s}`, kills: this.kills, wave: this.director.waveNumber, defeatText: this.defeatText,
      stage: this.run ? this.run.stage : null, theme: this.run ? this.run.theme.name : null,
    };
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  /**
   * One step of the simulation. inputs: { heroId: input } in multiplayer
   * (each hero reads its own input through Input.override); omitted in
   * single player, where the one hero reads the keyboard and mouse directly.
   */
  update(dt, inputs = null) {
    this.time += dt;
    if (!inputs) this.mouseWorld = this.camera.screenToWorld(Input.mouse.x, Input.mouse.y);

    if (this.lobby) this.lobby.update(dt);
    for (const p of this.players.slice()) {
      if (inputs) {
        const inp = inputs[p.netId] || Session.idleInput;
        Input.override = Session.toOverride(inp);
        this.mouseWorld = { x: inp.mx, y: inp.my };
      }
      this.setActor(p);
      // stations / props get the interact key before the hero, so E there never casts an ability
      if (this.lobby) this.lobby.interact(p);
      if (this.run && !this.finished) this.run.preUpdate(p);
      if (!p.dead) p.update(dt, this);
    }
    Input.override = null;
    for (const c of this.clones) { this.setActor(c.owner); c.update(dt, this); }
    this.setActor(null);
    for (const b of this.barriers) b.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    this.separateEnemies();
    this.contactDamage();
    if (this.boss) {
      this.updateBossFocus(dt);
      this.bossFocus = this.boss.focus;
      this.boss.update(dt, this);
      this.bossFocus = null;
      if (this.boss.dead) this.boss = null;
    }
    for (const p of this.playerProjectiles) { this.setActor(p.owner); p.update(dt, this); }
    this.setActor(null);
    for (const p of this.enemyProjectiles) p.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);

    for (const t of this.timers) {
      t.t -= dt;
      if (t.t <= 0) { t.dead = true; t.fn(); }
    }

    this.updateDots(dt);
    this.updateHazards(dt);
    if (this.practice) this.updatePractice(dt);
    else if (this.lobby) this.dummies.forEach((d) => d.update(dt));
    else if (this.run) { if (!this.finished) this.run.update(dt); }
    else if (!this.finished) this.director.update(dt);
    this.effects.update(dt);

    const dead = this.enemies.filter((e) => e.dead);
    if (this.run) for (const e of dead) this.run.onEnemyKilled(e);
    this.kills += dead.length;
    for (const e of dead) {
      const killer = this.players.includes(e.lastHitBy) ? e.lastHitBy : this.players[0];
      killer.onKill(this);
    }
    removeDead(this.enemies);
    removeDead(this.clones);
    removeDead(this.barriers);
    removeDead(this.playerProjectiles);
    removeDead(this.enemyProjectiles);
    removeDead(this.pickups);
    removeDead(this.timers);

    if (this.bannerData) {
      this.bannerData.t -= dt;
      if (this.bannerData.t <= 0) this.bannerData = null;
    }

    // the camera follows this screen's hero (or a living teammate while they're down)
    const view = this.cameraTarget;
    this.camera.follow(view.x, view.y - 16, dt, this.dungeon.width, this.dungeon.height);

    if (!this.finished && !this.practice && this.players.every((p) => p.dead)) {
      this.finished = true;
      Music.stop();
      Sound.play('defeat');
      this.after(1.8, () => this.events.onGameOver(this.stats));
    }
  }

  /** Projectiles fired from here on belong to `hero` (for damage credit). */
  setActor(hero) {
    this.actor = hero;
    Projectile.actor = hero;
  }

  /** Who the camera watches: this screen's hero, or a living teammate while they're down. */
  get cameraTarget() {
    const me = this.localPlayer;
    if (!me.dead || !this.multiplayer) return me;
    return this.heroes[0] || me;
  }

  /** Stops enemies from stacking on top of each other. */
  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const min = (a.radius + b.radius) * 0.8;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= min || d === 0) continue;
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (a.state !== 'leap' && !a.immovable) this.dungeon.move(a, -nx * push, -ny * push);
        if (b.state !== 'leap' && !b.immovable) this.dungeon.move(b, nx * push, ny * push);
      }
    }
  }

  // ---------------------------------------------------------
  //  RENDER
  // ---------------------------------------------------------

  render(ctx) {
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(0, 0, CONFIG.screen.width, CONFIG.screen.height);

    ctx.save();
    this.camera.apply(ctx);
    this.dungeon.draw(ctx, this.camera);
    if (this.lobby) this.lobby.drawGround(ctx);
    if (this.run) this.run.drawGround(ctx);
    this.effects.drawGround(ctx);
    this.drawHazards(ctx);

    // ground layer: shadows + telegraphs
    for (const p of this.pickups) p.draw(ctx);
    if (this.boss) this.boss.drawGround(ctx);
    for (const e of this.enemies) e.drawGround(ctx);
    for (const cl of this.clones) cl.drawGround(ctx);
    for (const d of this.dummies) d.drawGround(ctx);
    for (const p of this.heroes) p.drawGround(ctx);

    // y-sorted characters
    const items = this.enemies.map((e) => ({ y: e.y, draw: (c) => e.draw(c) }));
    for (const p of this.heroes) items.push({ y: p.y, draw: (c) => p.draw(c) });
    for (const cl of this.clones) items.push({ y: cl.y, draw: (c) => cl.draw(c) });
    for (const d of this.dummies) items.push({ y: d.y, draw: (c) => d.draw(c) });
    for (const b of this.barriers) items.push({ y: b.y, draw: (c) => b.draw(c) });
    if (this.boss) items.push(...this.boss.getDrawables());
    if (this.lobby) items.push(...this.lobby.getDrawables());
    if (this.run) items.push(...this.run.getDrawables());
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw(ctx);

    for (const p of this.playerProjectiles) p.draw(ctx);
    for (const p of this.enemyProjectiles) p.draw(ctx);
    if (this.boss) this.boss.drawOverlay(ctx);
    this.effects.draw(ctx);
    if (this.boss) HUD.drawBossBars(ctx, this.boss);
    this.dungeon.drawTorches(ctx, this.time, this.camera);
    if (this.lobby) this.lobby.drawPrompts(ctx);
    if (this.multiplayer) this.drawNameTags(ctx);
    this.effects.drawTexts(ctx);
    ctx.restore();

    ctx.drawImage(this.vignette, 0, 0);
    HUD.draw(ctx, this);
  }

  /** Multiplayer: every other hero's name and health over their head. */
  drawNameTags(ctx) {
    const me = this.localPlayer;
    for (const p of this.players) {
      if (p === me) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y - 66);
      HUD.text(ctx, p.dead ? `${p.name} (DOWN)` : p.name, x, y, { size: 6, align: 'center', color: p.dead ? '#a99bbd' : '#8cff9a' });
      if (p.dead) continue;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 13, y + 9, 26, 4);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(x - 12, y + 10, Math.round(24 * clamp(p.hp / p.maxHp, 0, 1)), 2);
    }
  }

  static buildVignette() {
    const { width: w, height: h } = CONFIG.screen;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.65);
    g.addColorStop(0, 'rgba(8, 4, 16, 0)');
    g.addColorStop(1, 'rgba(8, 4, 16, 0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  }
}
