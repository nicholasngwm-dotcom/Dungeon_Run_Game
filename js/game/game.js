// One run of the game: owns the world state, updates and renders it.
// Entities receive this object as `world`.

class Game {
  /**
   * opts.practice: practice-range cheat options ({ infiniteMana,
   * infiniteEnergy, god }) or null for a normal run.
   */
  constructor(classId, events, opts = {}) {
    this.events = events;          // { onGameOver(stats), onVictory(stats) }
    this.dungeon = new Dungeon({ pillars: !opts.practice }); // open floor in the practice range
    this.camera = new Camera(CONFIG.screen.width, CONFIG.screen.height);
    this.effects = new Effects();
    this.player = createHero(classId, this.dungeon.playerStart.x, this.dungeon.playerStart.y);
    this.enemies = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.clones = [];
    this.dots = [];
    this.hazards = [];
    this.timers = [];
    this.boss = null;
    this.pendingSpawns = 0;
    this.time = 0;
    this.kills = 0;
    this.bannerData = null;
    this.finished = false;
    this.mouseWorld = { x: 0, y: 0 };
    this.director = new WaveDirector(this);
    this.practice = opts.practice ? { options: opts.practice, log: [], total: 0, respawn: 0 } : null;
    this.dummies = [];
    if (this.practice) {
      const c = this.dungeon.center;
      this.dummies.push(new TrainingDummy(c.x - 220, c.y + 40));
      this.banner('PRACTICE RANGE', 'Use the panel to spawn enemies and toggle cheats', 2.6);
    }
    this.camera.follow(this.player.x, this.player.y, 0, this.dungeon.width, this.dungeon.height, true);
    this.vignette = Game.buildVignette();
  }

  // ---------------------------------------------------------
  //  API used by entities
  // ---------------------------------------------------------

  /** Everything the player's attacks can hit. */
  getTargets() {
    const list = this.enemies.filter((e) => !e.dead && e.age > 0.15);
    if (this.boss) list.push(...this.boss.getTargets());
    list.push(...this.dummies);
    return list;
  }

  /**
   * Applies player damage (with crits, numbers, knockback, sound).
   * sound: null for silent ticks. fromUlt: damage from an ultimate doesn't
   * charge the ultimate. Returns the damage dealt (0 if none).
   */
  damageTarget(target, amount, { angle = 0, knockback = 0, sound = 'hit', noCrit = false, color = '#ffffff', fromUlt = false } = {}) {
    const crit = !noCrit && Math.random() < CONFIG.player.critChance;
    const dmg = Math.max(1, Math.round(amount * (crit ? CONFIG.player.critMultiplier : 1)));
    if (!target.takeDamage(dmg, this)) return 0;
    if (knockback) target.knockback(angle, knockback);
    this.effects.text(target.hx, target.hy - 22, crit ? `${dmg}!` : `${dmg}`, {
      color: crit ? '#ffd34a' : color, size: crit ? 11 : 8,
    });
    if (sound !== null) {
      this.effects.burst(target.hx, target.hy, { count: crit ? 8 : 4, colors: ['#ffffff', '#ffe0a0'], speed: [40, 120], life: [0.1, 0.25] });
      Sound.play(crit ? 'crit' : (sound || 'hit'), 0.04);
    }
    if (!fromUlt && !this.player.dead) this.player.gainUlt(dmg);
    if (this.practice) {
      this.practice.log.push({ t: this.time, dmg });
      this.practice.total += dmg;
    }
    return dmg;
  }

  /** Damage over time (bleed etc.), ticking twice a second. */
  addDot(target, dps, duration, color = '#ff6060') {
    this.dots.push({ target, dps, t: duration, tick: 0.5, color });
  }

  updateDots(dt) {
    for (const d of this.dots) {
      d.t -= dt;
      d.tick -= dt;
      if (d.target.dead) { d.dead = true; continue; }
      if (d.tick <= 0) {
        d.tick += 0.5;
        this.damageTarget(d.target, d.dps * 0.5, { sound: null, noCrit: true, color: d.color });
        this.effects.burst(d.target.hx, d.target.hy, { count: 2, colors: [d.color, '#7a1010'], speed: [10, 40], life: [0.2, 0.4] });
      }
      if (d.t <= 0) d.dead = true;
    }
    removeDead(this.dots);
  }

  /** The hero plus anything enemies may attack instead (clones). */
  get allies() {
    const list = this.clones.filter((c) => !c.dead);
    if (!this.player.dead) list.unshift(this.player);
    return list;
  }

  /**
   * What an enemy should chase: the nearest ally it can see. Returns a
   * stand-in with dead = true when there is nothing to chase.
   */
  targetFor(enemy) {
    let best = null;
    let bestD = Infinity;
    for (const a of this.allies) {
      const d = dist(enemy.x, enemy.y, a.x, a.y);
      if (a.invisible && d > CONFIG.player.invisibleDetectRange) continue;
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) return best;
    const p = this.player;
    return { dead: true, x: p.x, y: p.y, hx: p.hx, hy: p.hy, radius: 0, hurt: () => false };
  }

  addEnemy(enemy) {
    const s = this.enemyScale;
    if (s.hp !== 1 || s.damage !== 1) {
      enemy.cfg = { ...enemy.cfg, damage: Math.round(enemy.cfg.damage * s.damage) };
      enemy.maxHp = Math.round(enemy.maxHp * s.hp);
      enemy.hp = enemy.maxHp;
    }
    this.enemies.push(enemy);
  }

  /** Later waves get tougher enemies (boss minions and the practice range don't). */
  get enemyScale() {
    const d = this.director;
    if (this.practice || d.state === 'boss' || d.waveIndex <= 0) return { hp: 1, damage: 1 };
    const s = CONFIG.waveScaling;
    return { hp: 1 + s.hp * d.waveIndex, damage: 1 + s.damage * d.waveIndex };
  }

  /** Shows a summoning circle, then spawns the enemy. */
  spawnEnemy(type, x, y) {
    if (x === undefined) {
      let pt;
      for (let i = 0; i < 30; i++) {
        pt = this.dungeon.randomFloorPoint(60);
        if (dist(pt.x, pt.y, this.player.x, this.player.y) > 260) break;
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
      this.addEnemy(createEnemy(type, x, y));
      this.effects.burst(x, y - 10, { count: 12, colors: ['#b45aff', '#6a28c8', '#e0c0ff'], speed: [30, 100], up: 60 });
    }).spawn = true;
  }

  maybeDropHeart(x, y, chance = CONFIG.drops.heartChance) {
    if (Math.random() < chance) this.pickups.push(new HeartPickup(x, y));
  }

  maybeDropMana(x, y) {
    const r = this.player.resource;
    if (!r || r.name !== 'MANA' || Math.random() >= CONFIG.drops.manaChance) return;
    this.pickups.push(new ManaPickup(x + rand(-8, 8), y + rand(-8, 8)));
  }

  /** Enemy bodies hurt heroes/clones they touch (not while airborne or fading in). */
  contactDamage() {
    for (const e of this.enemies) {
      if (e.dead || e.age < 0.3 || e.state === 'leap') continue;
      const damage = e.cfg.contactDamage ?? CONFIG.enemyContactDamage;
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
    this.player.heal(this.player.maxHp * CONFIG.bossHealPercent, this);
    this.boss = Game.createBoss(type, this.dungeon.center);
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
    if (this.practice) {
      this.banner(`${this.boss.name} DEFEATED`, 'Spawn it again from the panel');
      return;
    }
    if (this.finished) return;
    this.finished = true;
    Music.stop();
    this.after(2.5, () => {
      Sound.play('victory');
      this.events.onVictory(this.stats);
    });
  }

  // ---------------------------------------------------------
  //  PRACTICE RANGE
  // ---------------------------------------------------------

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
    if (p.resource && ((p.resource.name === 'MANA' && o.infiniteMana) || (p.resource.name === 'ENERGY' && o.infiniteEnergy))) {
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
      }
    }
  }

  get stats() {
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60).toString().padStart(2, '0');
    return { time: `${m}:${s}`, kills: this.kills, wave: this.director.waveNumber };
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.mouseWorld = this.camera.screenToWorld(Input.mouse.x, Input.mouse.y);

    if (!this.player.dead) this.player.update(dt, this);
    for (const c of this.clones) c.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    this.separateEnemies();
    this.contactDamage();
    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.dead) this.boss = null;
    }
    for (const p of this.playerProjectiles) p.update(dt, this);
    for (const p of this.enemyProjectiles) p.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);

    for (const t of this.timers) {
      t.t -= dt;
      if (t.t <= 0) { t.dead = true; t.fn(); }
    }

    this.updateDots(dt);
    this.updateHazards(dt);
    if (this.practice) this.updatePractice(dt);
    else if (!this.finished) this.director.update(dt);
    this.effects.update(dt);

    const killed = this.enemies.filter((e) => e.dead).length;
    this.kills += killed;
    for (let i = 0; i < killed; i++) this.player.onKill(this);
    removeDead(this.enemies);
    removeDead(this.clones);
    removeDead(this.playerProjectiles);
    removeDead(this.enemyProjectiles);
    removeDead(this.pickups);
    removeDead(this.timers);

    if (this.bannerData) {
      this.bannerData.t -= dt;
      if (this.bannerData.t <= 0) this.bannerData = null;
    }

    this.camera.follow(this.player.x, this.player.y - 16, dt, this.dungeon.width, this.dungeon.height);

    if (this.player.dead && !this.finished && !this.practice) {
      this.finished = true;
      Music.stop();
      Sound.play('defeat');
      this.after(1.8, () => this.events.onGameOver(this.stats));
    }
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
        if (a.state !== 'leap') this.dungeon.move(a, -nx * push, -ny * push);
        if (b.state !== 'leap') this.dungeon.move(b, nx * push, ny * push);
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
    this.dungeon.draw(ctx);
    this.effects.drawGround(ctx);
    this.drawHazards(ctx);

    // ground layer: shadows + telegraphs
    for (const p of this.pickups) p.draw(ctx);
    if (this.boss) this.boss.drawGround(ctx);
    for (const e of this.enemies) e.drawGround(ctx);
    for (const cl of this.clones) cl.drawGround(ctx);
    for (const d of this.dummies) d.drawGround(ctx);
    if (!this.player.dead) this.player.drawGround(ctx);

    // y-sorted characters
    const items = this.enemies.map((e) => ({ y: e.y, draw: (c) => e.draw(c) }));
    items.push({ y: this.player.y, draw: (c) => this.player.draw(c) });
    for (const cl of this.clones) items.push({ y: cl.y, draw: (c) => cl.draw(c) });
    for (const d of this.dummies) items.push({ y: d.y, draw: (c) => d.draw(c) });
    if (this.boss) items.push(...this.boss.getDrawables());
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw(ctx);

    for (const p of this.playerProjectiles) p.draw(ctx);
    for (const p of this.enemyProjectiles) p.draw(ctx);
    if (this.boss) this.boss.drawOverlay(ctx);
    this.effects.draw(ctx);
    if (this.boss) HUD.drawBossBars(ctx, this.boss);
    this.dungeon.drawTorches(ctx, this.time);
    this.effects.drawTexts(ctx);
    ctx.restore();

    ctx.drawImage(this.vignette, 0, 0);
    HUD.draw(ctx, this);
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
