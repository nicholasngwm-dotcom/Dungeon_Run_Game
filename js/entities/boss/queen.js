// =============================================================
//  THE QUEEN (the castle's garden)
//
//  She keeps her distance, walking the garden paths, and takes turns between:
//    - waves of homing arrows that chase the nearest hero for a few seconds
//    - quick piercing shots, each aimed where her target is about to be
//  At half health she glides to the bell in the middle of the garden and rings it
//  (she can't be hurt while she does): from then on hedges rise out of the lawn as
//  walls, here and there, and her gardeners come through the rose gates in the
//  corners. She does the same attacks, faster.
//  (x, y) is her feet. The garden's bell and gates are decor (see CastleDecor).
// =============================================================

// the entrance: rose petals whirl in round the spot, then burst to reveal her (seconds)
const QUEEN_INTRO = { gather: 1.7, total: 2.4 };
const QUEEN_HAND = { x: 20, y: -38 };   // her bow hand from her feet (facing right)

/** A shot that passes through everyone in its path (each hero is hit once). */
class PiercingShot extends Projectile {
  hitPlayer(world) {
    const barrier = world.barrierAt(this.x, this.y, this.radius);
    if (barrier) {
      barrier.absorb(this.damage, world, this.x, this.y);
      return this.destroy(world, null);
    }
    for (const p of world.allies) {
      if (this.hitSet.has(p) || dist(this.x, this.y, p.hx, p.hy) > this.radius + p.radius) continue;
      this.hitSet.add(p);
      if (p.hurt(this.damage, world, this.x, this.y, { projectile: true })) {
        world.effects.burst(this.x, this.y, { count: 8, colors: ['#fff6d0', '#ffe680'], speed: [40, 140], life: [0.15, 0.3] });
      }
    }
  }
}

class Queen {
  constructor(x, y) {
    const c = CONFIG.queen;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 22;
    this.hw = 11;
    this.hh = 7;
    this.time = 0;
    this.phase = 1;
    this.intro = QUEEN_INTRO.total;
    this.introAt = 0;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = -1;
    this.moving = false;
    this.state = 'walk';     // walk | homingWindup | homing | pierce | toBell | bell
    this.t = 0;
    this.attackTimer = 1.2;
    this.attackStep = 0;
    this.aim = 0;
    this.strafe = 1;
    this.track = null;       // her target's smoothed position and velocity, for leading shots
    this.hedges = [];        // { tiles: [{ tx, ty }], t, life, up }
    this.hedgeTimer = 0;
    this.gardenerTimer = 0;
  }

  get name() { return 'THE QUEEN'; }
  get title() { return 'Thorned Sovereign of the Fallen Court'; }
  get defeatText() { return 'The Queen has fallen among her roses.'; }

  get hx() { return this.x; }
  get hy() { return this.y - 44; }
  /** Per-phase value from a [phase 1, phase 2] pair. */
  P(list) { return Array.isArray(list) ? list[this.phase - 1] : list; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead && this.state !== 'bell' && this.state !== 'toBell'; }
  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    return [{ part: this, x: this.x, y: this.y - 104, w: 90, color: '#c46aff', marker: [this.cfg.phase2At] }];
  }

  knockback() {}
  stun() {}

  /** Bishops can mend her. */
  heal(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) world.effects.text(this.hx, this.hy - 40, `+${Math.round(this.hp - before)}`, { color: '#8cf08a', size: 9 });
  }

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.startBell(world);
    return true;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  get room() { return this.roomRef; }

  /** The garden's bell and rose gates (placed by CastleDecor), and her room. */
  findGarden(world) {
    if (this.garden) return this.garden;
    const run = world.run;
    const items = run ? run.decor.items : [];
    const f = world.dungeon;
    this.roomRef = f.roomAt ? f.roomAt(this.x, this.y) : null;
    this.garden = {
      bell: items.find((d) => d.kind === 'gardenBell') || { x: this.x, y: this.y - 80 },
      gates: items.filter((d) => d.kind === 'roseGate'),
    };
    return this.garden;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.flashTime -= dt;
    this.findGarden(world);
    if (this.intro > 0) return this.updateIntro(dt, world);
    this.updateHedges(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.trackTarget(dt, world);
    this.t += dt;
    this.moving = false;
    switch (this.state) {
      case 'walk': this.updateWalk(dt, world); break;
      case 'homingWindup': this.updateHomingWindup(dt, world); break;
      case 'homing': this.updateHoming(dt, world); break;
      case 'pierce': this.updatePierce(dt, world); break;
      case 'toBell': this.updateToBell(dt, world); break;
      case 'bell': this.updateBell(dt, world); break;
    }
    if (this.phase === 2 && this.state !== 'bell' && this.state !== 'toBell') this.updateGardeners(dt, world);
    this.contactDamage(world);
  }

  /** Her target's position and velocity, smoothed (to lead the piercing shots). */
  trackTarget(dt, world) {
    const p = world.player;
    if (!this.track || this.track.who !== p) { this.track = { who: p, x: p.x, y: p.y, vx: 0, vy: 0 }; return; }
    const T = this.track;
    const vx = (p.x - T.x) / Math.max(dt, 1e-3);
    const vy = (p.y - T.y) / Math.max(dt, 1e-3);
    const k = Math.min(1, dt * 8);
    T.vx += (clamp(vx, -600, 600) - T.vx) * k;
    T.vy += (clamp(vy, -600, 600) - T.vy) * k;
    T.x = p.x;
    T.y = p.y;
  }

  /** Walks the garden keeping her distance from her target, strafing round them. */
  updateWalk(dt, world) {
    const c = this.cfg;
    const p = world.player;
    if (p.dead) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const toward = angleTo(this.x, this.y, p.x, p.y);
    const speed = this.P(c.speed);
    let a;
    if (d < c.keepAway[0]) a = toward + Math.PI;
    else if (d > c.keepAway[1]) a = toward;
    else a = toward + (Math.PI / 2) * this.strafe;
    const x0 = this.x;
    const y0 = this.y;
    world.dungeon.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (dist(x0, y0, this.x, this.y) < speed * dt * 0.3) this.strafe *= -1;   // a hedge or a wall in the way
    this.moving = dist(x0, y0, this.x, this.y) > 0.1;
    this.facing = p.x >= this.x ? 1 : -1;
    this.aim = angleTo(this.handX, this.handY, p.hx, p.hy);
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      const kind = ['homing', 'pierce'][this.attackStep++ % 2];
      if (kind === 'homing') { this.setState('homingWindup'); Sound.play('laserCharge', 0.2); } else { this.setState('pierce'); this.shots = 0; }
    }
  }

  get handX() { return this.x + QUEEN_HAND.x * this.facing; }
  get handY() { return this.y + QUEEN_HAND.y; }

  // ---------- homing arrows ----------

  updateHomingWindup(dt, world) {
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    this.aim = angleTo(this.handX, this.handY, p.hx, p.hy);
    if (this.t >= this.cfg.homing.windup) { this.setState('homing'); this.waves = 0; this.waveTimer = 0; }
  }

  updateHoming(dt, world) {
    const h = this.cfg.homing;
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    this.aim = angleTo(this.handX, this.handY, p.hx, p.hy);
    this.waveTimer -= dt;
    if (this.waveTimer <= 0 && this.waves < this.P(h.waves)) {
      this.waveTimer = this.P(h.waveEvery);
      this.waves++;
      const spread = h.spreadDegrees * DEG;
      for (let i = 0; i < h.perWave; i++) {
        const a = this.aim - spread / 2 + (spread * i) / (h.perWave - 1) + (this.waves % 2 ? spread / (h.perWave - 1) / 2 : 0) - spread / (h.perWave - 1) / 4;
        this.fireHoming(world, a);
      }
      world.effects.burst(this.handX, this.handY, { count: 10, colors: ['#ff6ad8', '#f0c8ff', '#ffffff'], speed: [40, 140], life: [0.2, 0.4] });
      Sound.play('magic');
    }
    if (this.waves >= this.P(h.waves) && this.waveTimer <= 0) this.toWalk();
  }

  /** A magic arrow that chases the nearest hero for `chase` seconds, turning only so fast. */
  fireHoming(world, angle) {
    const h = this.cfg.homing;
    const speed = this.P(h.speed);
    let chase = h.chase;
    world.enemyProjectiles.push(new Projectile({
      x: this.handX, y: this.handY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: 5, damage: h.damage, life: h.life, friendly: false,
      sprite: Sprites.projectiles.queenArrow, glow: '255, 110, 220', trail: ['#ff6ad8', '#f0c8ff'],
      homing: (pr, dt, w) => {
        chase -= dt;
        if (chase <= 0) return;
        const t = w.nearestHero(pr.x, pr.y);
        if (!t || t.dead) return;
        const cur = Math.atan2(pr.vy, pr.vx);
        const a = cur + clamp(angleDiff(cur, angleTo(pr.x, pr.y, t.hx, t.hy)), -h.turn * dt, h.turn * dt);
        pr.vx = Math.cos(a) * speed;
        pr.vy = Math.sin(a) * speed;
      },
    }));
  }

  // ---------- piercing shots ----------

  /** Where her target will be when a shot from her hand reaches them. */
  leadPoint() {
    const T = this.track;
    const s = this.P(this.cfg.pierce.speed);
    const d = dist(this.handX, this.handY, T.x, T.y - 14);
    const k = (d / s) * this.cfg.pierce.lead;
    return { x: T.x + T.vx * k, y: T.y - 14 + T.vy * k };
  }

  updatePierce(dt, world) {
    const c = this.cfg.pierce;
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    const at = this.leadPoint();
    // each shot: a quick aim (the line shows where), then it flies
    if (this.t < c.aim) {
      this.aim = angleTo(this.handX, this.handY, at.x, at.y);
      return;
    }
    if (this.t >= c.aim && !this.loosed) {
      this.loosed = true;
      const speed = this.P(c.speed);
      world.enemyProjectiles.push(new PiercingShot({
        x: this.handX, y: this.handY, vx: Math.cos(this.aim) * speed, vy: Math.sin(this.aim) * speed,
        radius: 5, damage: c.damage, life: 2, friendly: false,
        sprite: Sprites.projectiles.queenPierce, glow: '255, 240, 180', trail: ['#fff6d0', '#ffe680'],
      }));
      world.effects.burst(this.handX, this.handY, { count: 6, colors: ['#ffffff', '#fff6d0'], speed: [60, 180], life: [0.1, 0.25], angle: this.aim, spread: 0.6 });
      Sound.play('arrow');
      this.shots++;
    }
    if (this.t >= c.aim + this.P(c.every) * 0.5) {
      this.loosed = false;
      if (this.shots >= this.P(c.shots)) this.toWalk();
      else this.t = 0;
    }
  }

  toWalk() {
    this.setState('walk');
    this.attackTimer = this.P(this.cfg.attackInterval);
    if (Math.random() < 0.5) this.strafe *= -1;
  }

  // ---------- the bell (phase 2) ----------

  startBell(world) {
    this.phase = 2;
    this.setState('toBell');
    world.banner('THE QUEEN RETREATS', 'To the garden bell...', 1.8);
    Sound.play('phantomVanish');
  }

  /** Glides fast to the bell, roses trailing. */
  updateToBell(dt, world) {
    const b = this.garden.bell;
    const tx = b.x + 34;
    const ty = b.y + 14;
    const d = dist(this.x, this.y, tx, ty);
    this.facing = b.x >= this.x ? 1 : -1;
    if (d > 4) {
      const s = Math.min(d, 320 * dt);
      this.x += ((tx - this.x) / d) * s;
      this.y += ((ty - this.y) / d) * s;
      this.moving = true;
      if (vrand(0, 1) < 0.6) world.effects.burst(this.x + vrand(-10, 10), this.y - vrand(0, 30), { count: 1, colors: ['#c03048', '#ff6a80', '#8a1a30'], speed: [10, 40], life: [0.5, 0.9], gravity: 60 });
    } else {
      this.setState('bell');
      this.facing = -1;
      this.rings = 0;
    }
  }

  updateBell(dt, world) {
    const c = this.cfg.bell;
    const b = this.garden.bell;
    if (this.t >= (this.rings + 0.6) * c.ringEvery && this.rings < c.rings) {
      this.rings++;
      b.kick = (b.kick || 0) + 1;
      Sound.play('bell');
      world.shake(5, 0.3);
      const x = b.x;
      const y = b.y - 70;
      world.effects.add(0.9, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.8;
        for (const k of [0, 0.15]) PFX.ring(ctx, x, y + 50, 40 + (t + k) * 380, (40 + (t + k) * 380) * 0.6, '#ecd690', 2, { thick: t < 0.3 ? 2 : 1 });
        ctx.restore();
      }, true);
      world.effects.burst(x, y, { count: 16, colors: ['#ecd690', '#fff6d0', '#c03048'], speed: [40, 140], life: [0.4, 0.8] });
    }
    if (this.t >= (c.rings + 0.9) * c.ringEvery) {
      world.banner('THE GARDEN AWAKENS', 'Hedges rise and her gardeners come', 2.2);
      Sound.play('bossRoar');
      this.hedgeTimer = 0.5;
      this.gardenerTimer = 1;
      this.toWalk();
      this.attackTimer = 0.8;
    }
  }

  // ---------- hedges (phase 2) ----------

  /** Hedges sprout (a green outline first), grow into walls for a while, then wither away. */
  updateHedges(dt, world) {
    const f = world.dungeon;
    if (this.phase === 2 && this.dying <= 0 && this.state !== 'bell' && this.state !== 'toBell') {
      this.hedgeTimer -= dt;
      if (this.hedgeTimer <= 0) {
        this.hedgeTimer = this.P(this.cfg.hedges.every);
        for (let i = 0; i < this.cfg.hedges.count; i++) this.sproutHedge(world);
      }
    }
    for (const h of this.hedges) {
      h.t += dt;
      const c = this.cfg.hedges;
      if (!h.up && h.t >= c.sprout && !h.withering) {
        // it grows up: every tile nobody is standing on becomes a wall
        h.up = true;
        h.tiles = h.tiles.filter(({ tx, ty }) => !this.occupied(world, tx, ty));
        f.blocks = f.blocks || new Set();
        for (const { tx, ty } of h.tiles) f.blocks.add(f.idx(tx, ty));
        world.effects.burst(h.cx, h.cy, { count: 14, colors: ['#264228', '#365a36', '#c03048'], speed: [30, 100], life: [0.3, 0.6], up: 40 });
        Sound.play('graveRumble', 0.2);
      }
      if (h.up && !h.withering && (h.t >= c.sprout + h.life || this.dying > 0)) {
        h.withering = true;
        h.wither = 0;
        for (const { tx, ty } of h.tiles) f.blocks?.delete(f.idx(tx, ty));
      }
      if (h.withering) {
        h.wither += dt;
        if (h.wither >= 0.5) h.dead = true;
      }
    }
    removeDead(this.hedges);
  }

  /** True if any hero, enemy or the queen herself overlaps tile (tx, ty). */
  occupied(world, tx, ty) {
    const T = world.dungeon.T;
    const x0 = tx * T - 4;
    const y0 = ty * T - 4;
    const x1 = (tx + 1) * T + 4;
    const y1 = (ty + 1) * T + 4;
    const inside = (e) => e.x > x0 - (e.hw || 8) && e.x < x1 + (e.hw || 8) && e.y > y0 - (e.hh || 6) && e.y < y1 + (e.hh || 6);
    return [...world.players.filter((p) => !p.dead), ...world.enemies, ...world.clones, this].some(inside);
  }

  /** A new hedge somewhere on the lawn, clear of the bell, the gates, the doors and the other hedges. */
  sproutHedge(world) {
    const f = world.dungeon;
    const r = this.room || f.roomAt(this.x, this.y);
    if (!r) return;
    const c = this.cfg.hedges;
    const live = this.hedges.length;
    if (live >= c.max) return;
    const mx = (r.x0 + r.x1) / 2;
    const my = (r.y0 + r.y1) / 2;
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    const taken = new Set(this.hedges.flatMap((h) => h.tiles.map(({ tx, ty }) => `${tx},${ty}`)));
    for (let k = 0; k < 30; k++) {
      const len = randInt(c.len[0], c.len[1]);
      const along = Math.random() < 0.5;
      const tx = randInt(r.x0 + 2, r.x1 - 2 - (along ? len : 0));
      const ty = randInt(r.y0 + 2, r.y1 - 2 - (along ? 0 : len));
      const tiles = [];
      for (let i = 0; i < len; i++) tiles.push(along ? { tx: tx + i, ty } : { tx, ty: ty + i });
      const bad = tiles.some(({ tx: x, ty: y }) => Math.hypot(x - mx, (y - my) * 1.25) < 4.5
        || (Math.min(x - r.x0, r.x1 - x) < 4 && Math.min(y - r.y0, r.y1 - y) < 4)
        || doors.some((d) => Math.abs(d.tx - x) < 4 && Math.abs(d.ty - y) < 4)
        || [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => taken.has(`${x + dx},${y + dy}`)))
        || world.players.some((p) => !p.dead && Math.abs(p.x / f.T - (x + 0.5)) < 1.6 && Math.abs(p.y / f.T - (y + 0.5)) < 1.6));
      if (bad) continue;
      const T = f.T;
      this.hedges.push({
        tiles, t: 0, life: rand(c.life[0], c.life[1]), up: false, seed: Math.floor(Math.random() * 3),
        cx: (tiles[0].tx + tiles[tiles.length - 1].tx + 1) / 2 * T, cy: (tiles[0].ty + tiles[tiles.length - 1].ty + 1) / 2 * T,
      });
      return;
    }
  }

  // ---------- gardeners (phase 2) ----------

  updateGardeners(dt, world) {
    const g = this.cfg.gardeners;
    this.gardenerTimer -= dt;
    if (this.gardenerTimer > 0) return;
    this.gardenerTimer = g.every;
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    const gates = this.garden.gates;
    if (!gates.length) return;
    for (let i = 0; i < Math.min(g.perWave, g.max - alive); i++) {
      const gate = choose(gates);
      gate.openUntil = this.time + 1.4;
      gate.openAt = this.time;
      const pt = world.dungeon.freePoint(gate.x, gate.spawnY ?? gate.y + 26, 10, 8);
      world.after(0.4, () => {
        if (this.dead || this.dying > 0) return;
        const e = createEnemy('gardener', pt.x, pt.y);
        e.owner = this;
        world.addEnemy(e);
        world.effects.burst(pt.x, pt.y - 14, { count: 14, colors: ['#c03048', '#ff6a80', '#365a36'], speed: [30, 110], life: [0.3, 0.6], up: 30 });
      });
      Sound.play('gateCreak', 0.2);
    }
  }

  // ---------- contact, death ----------

  contactDamage(world) {
    if (!this.targetable) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 18 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  die(world) {
    this.dying = 2.4;
    this.state = 'dying';
    Sound.play('bossRoar');
    world.banner('THE QUEEN HAS FALLEN!', '');
    // her gardeners wilt with her
    for (const e of world.enemies) {
      if (e.owner !== this || e.dead) continue;
      e.dead = true;
      world.effects.burst(e.hx, e.hy, { count: 14, colors: ['#365a36', '#c03048', '#b4acb8'], speed: [40, 140], life: [0.3, 0.6] });
    }
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.petalBurst = (this.petalBurst || 0) - dt;
    if (this.petalBurst <= 0) {
      this.petalBurst = 0.18;
      this.flashTime = 0.08;
      world.effects.burst(this.x + rand(-20, 20), this.y - rand(10, 70), { count: 12, colors: ['#c03048', '#ff6a80', '#8a1a30', '#c46aff'], speed: [40, 160], life: [0.5, 1], gravity: 80 });
      Sound.play('phantomVanish', 0.15);
    }
    if (this.dying <= 0) {
      this.dead = true;
      if (world.dungeon.blocks) world.dungeon.blocks.clear();
      world.effects.burst(this.x, this.y - 40, { count: 80, colors: ['#c03048', '#ff6a80', '#8a1a30', '#c46aff', '#ecd690'], speed: [80, 300], life: [0.6, 1.4], size: [2, 5] });
      world.shake(10, 0.6);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------- entrance ----------

  updateIntro(dt, world) {
    const I = QUEEN_INTRO;
    const before = this.introAt;
    this.introAt += dt;
    this.intro = I.total - this.introAt;
    const crossed = (at) => before < at && this.introAt >= at;
    if (crossed(0.05)) Sound.play('ghostWail');
    if (crossed(I.gather)) {
      world.shake(6, 0.35);
      world.effects.burst(this.x, this.y - 44, { count: 60, colors: ['#c03048', '#ff6a80', '#8a1a30', '#c46aff', '#ffffff'], speed: [120, 340], life: [0.5, 1.1], size: [2, 5], gravity: 60 });
      Sound.play('bell');
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
    }
    if (this.intro <= 0) this.intro = 0;
  }

  /** Petals whirling in to the spot where she appears. */
  drawIntro(ctx) {
    const I = QUEEN_INTRO;
    const e = this.introAt;
    const cx = this.x;
    const cy = this.y - 44;
    if (e >= I.gather) return;
    const k = e / I.gather;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, cx, cy, 20 + k * 60, '255, 90, 160', 0.3 + k * 0.8, 2, (20 + k * 60) * 0.8);
    ctx.restore();
    // a whirl of rose petals tightening round the spot, each tumbling as it flies
    const colors = [['#8a1a30', '#c03048'], ['#c03048', '#ff6a80'], ['#5a0e1e', '#8a1a30'], ['#c46aff', '#f0c8ff']];
    ctx.globalAlpha = Math.min(1, e * 3);
    for (let i = 0; i < 72; i++) {
      const base = (i / 72) * TAU;
      const r = (280 - k * 250) * (0.55 + ((i * 37) % 10) / 22);
      const a = base + e * (2 + k * 5) + i;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r * 0.55 - Math.sin(e * 3 + i) * 6);
      const [dark, light] = colors[i % 4];
      const flat = Math.sin(e * 9 + i * 1.3) > 0;   // tumbling: seen face-on, then edge-on
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, flat ? 6 : 4, flat ? 5 : 3);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, flat ? 4 : 2, flat ? 3 : 1);
      ctx.fillStyle = light;
      ctx.fillRect(x, y, flat ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  currentFrame() {
    const S = Sprites.queen;
    if (this.state === 'bell') return S.reach[Math.floor(this.time * 4) % 2];
    if (this.dying > 0) return S.rest[0];
    const list = this.moving ? S.walk : S.idle;
    return list[Math.floor(this.time * (this.moving ? 8 : 5)) % list.length];
  }

  drawGround(ctx) {
    if (this.dead) return;
    // sprouting hedges: a green outline and leaves pushing up where they'll stand
    for (const h of this.hedges) {
      if (h.up) continue;
      const k = h.t / this.cfg.hedges.sprout;
      const T = CONFIG.tileSize;
      for (const { tx, ty } of h.tiles) {
        const x = tx * T;
        const y = ty * T;
        ctx.fillStyle = `rgba(60, 140, 70, ${0.15 + k * 0.25})`;
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.strokeStyle = `rgba(150, 255, 150, ${0.5 + Telegraph.pulse(k) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
        for (let i = 0; i < 3; i++) {
          const lx = x + 6 + i * 9;
          const ly = y + 22 - k * 8;
          ctx.fillStyle = '#365a36';
          ctx.fillRect(lx, ly, 3, 4 + k * 6);
          ctx.fillStyle = '#5a7a52';
          ctx.fillRect(lx, ly, 2, 2);
        }
      }
    }
    if (this.intro > 0 && this.introAt < QUEEN_INTRO.gather) return;
    drawShadow(ctx, this.x, this.y + 2, 20, 6, 0.35);
    if (this.state === 'homingWindup') Telegraph.circle(ctx, this.x, this.y, 46, this.t / this.cfg.homing.windup, '255, 110, 220');
  }

  getDrawables() {
    const out = [];
    if (this.dead) return out;
    if (!(this.intro > 0 && this.introAt < QUEEN_INTRO.gather)) out.push({ y: this.y, draw: (ctx) => this.drawQueen(ctx) });
    const T = CONFIG.tileSize;
    for (const h of this.hedges) {
      if (!h.up) continue;
      const grow = h.withering ? 1 - h.wither / 0.5 : Math.min(1, (h.t - this.cfg.hedges.sprout) / 0.25);
      for (const { tx, ty } of h.tiles) {
        out.push({ y: (ty + 1) * T - 2, draw: (ctx) => this.drawHedge(ctx, tx, ty, grow, h.seed + tx + ty) });
      }
    }
    return out;
  }

  /** One hedge block, growing up out of the lawn (or sinking back into it). */
  drawHedge(ctx, tx, ty, grow, seed) {
    const T = CONFIG.tileSize;
    const img = Sprites.hedgeBlock[seed % Sprites.hedgeBlock.length];
    const h = Math.max(1, Math.round(img.height * grow));
    const x = tx * T;
    const bottom = (ty + 1) * T + 2;
    drawShadow(ctx, x + T / 2, bottom - 2, T / 2 + 2, 6, 0.35 * grow);
    ctx.drawImage(img, 0, 0, img.width, h, x, bottom - h, img.width, h);
  }

  drawQueen(ctx) {
    const frame = this.currentFrame();
    const S = QUEEN_SPRITE;
    const flip = this.facing < 0;
    const alpha = this.dying > 0 ? clamp(this.dying / 2.4, 0, 1) : 1;
    const bow = Sprites.weapons.queenBow;
    const attacking = this.state === 'homingWindup' || this.state === 'homing' || this.state === 'pierce';
    // her bow: held out toward her aim while she shoots, upright at her side otherwise
    const drawBow = () => {
      if (this.state === 'bell' || this.dying > 0) return;
      const a = attacking ? this.aim : (flip ? Math.PI : 0) - this.facing * 0.2;
      ctx.globalAlpha = alpha;
      drawRotated(ctx, bow.img, this.handX, this.handY, bow.pivotX, bow.pivotY, a);
      ctx.globalAlpha = 1;
    };
    // a soft violet aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 40, 48, '170, 90, 220', 0.35 * alpha, 2, 56);
    ctx.restore();
    const behind = attacking && Math.sin(this.aim) < -0.4;
    if (behind) drawBow();
    drawSprite(ctx, frame.img, this.x, this.y, S.ax, S.ay, flip, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, this.x, this.y, S.ax, S.ay, flip, alpha * 0.8);
    if (!behind) drawBow();
    // the bow's string of light flares as it charges
    if (this.state === 'homingWindup' || this.state === 'homing') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.handX, this.handY, 14 + Math.sin(this.time * 20) * 3, '255, 110, 220', 0.9);
      ctx.restore();
    }
    // ringing the bell: she can't be hurt (a shimmer of rose light round her)
    if (this.state === 'bell' || this.state === 'toBell') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, this.x, this.y - 40, 30, 46, `rgba(255, 140, 200, ${0.5 + Math.sin(this.time * 10) * 0.3})`, 2, { dash: [4, 4], spin: this.time });
      ctx.restore();
    }
  }

  drawOverlay(ctx) {
    if (this.intro > 0) this.drawIntro(ctx);
    // the piercing shot's aim line while she lines it up
    if (this.state === 'pierce' && this.t < this.cfg.pierce.aim && this.dying <= 0) {
      const k = this.t / this.cfg.pierce.aim;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 240, 180, ${0.3 + k * 0.6})`;
      ctx.lineWidth = 1 + k * 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(this.handX, this.handY);
      ctx.lineTo(this.handX + Math.cos(this.aim) * 700, this.handY + Math.sin(this.aim) * 700);
      ctx.stroke();
      ctx.restore();
    }
  }
}
