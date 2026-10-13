// =============================================================
//  PHANTOM KING BOSS
//
//  A single floating target that drifts over walls and pillars.
//  Phase 1: orbits the player, dashes at them, and fires slow
//    eye lasers.
//  Phase 2 (50% hp): vanishes and reappears near the player, then
//    pulses shockwaves that pull the player in while spraying slow
//    lasers in every direction.
//  Phase 3 (25% hp): mixes both move sets, faster, with double
//    dashes and wider laser volleys.
//  (x, y) is the ground point under the king; it hovers above it.
// =============================================================

class PhantomKing {
  constructor(x, y) {
    const c = CONFIG.phantom;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 26;        // hit radius around (hx, hy)
    this.hover = 22;         // float height above the ground point
    this.time = 0;
    this.phase = 1;
    this.intro = 2.4;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.alpha = 0;          // fades in/out; only hittable while mostly visible

    this.state = 'float';    // float | dashWindup | dash | dashRecover | vanish | hidden | appear | pulse
    this.t = 0;
    this.attackTimer = c.attackInterval[0];
    this.orbit = rand(0, TAU);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;

    this.eyeTimer = 1.2;
    this.eyeCharge = -1;     // >= 0 while the eyes charge a volley
    this.eyeAim = 0;

    this.dash = null;
    this.dashesLeft = 0;
    this.dest = null;        // reappear point

    this.pulses = [];        // expanding pull rings
    this.pulsesLeft = 0;
    this.pulseTimer = 0;
    this.sprayTimer = 0;
  }

  get name() { return 'PHANTOM KING'; }
  get title() { return 'Sovereign of the Restless Dead'; }

  get bob() { return Math.sin(this.time * 2.2) * 3; }
  /** Point the sprite is drawn at (the tips of its tails). */
  get drawY() { return this.y - this.hover + this.bob; }
  get hx() { return this.x; }
  get hy() { return this.drawY - 44; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead && this.alpha > 0.5; }

  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead || this.alpha < 0.3) return [];
    const c = this.cfg;
    return [{ part: this, x: this.x, y: this.drawY - PHANTOM_SPRITE.ay - 8, w: 90, color: '#b06aff', marker: [c.phase2At, c.phase3At] }];
  }

  knockback() {} // it's a ghost
  stun() {}

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    const r = this.hp / this.maxHp;
    const phase = r <= this.cfg.phase3At ? 3 : r <= this.cfg.phase2At ? 2 : 1;
    if (phase > this.phase) this.enterPhase(phase, world);
    return true;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.flashTime -= dt;

    if (this.intro > 0) {
      this.intro -= dt;
      this.alpha = clamp(1 - this.intro / 2.4, 0, 1);
      world.shake(2, 0.1);
      if (Math.random() < 0.6) this.wisp(world, 70);
      return;
    }
    this.updatePulseRings(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);

    const c = this.cfg;
    this.t += dt;
    switch (this.state) {
      case 'float': this.updateFloat(dt, world); break;
      case 'dashWindup': this.updateDashWindup(dt, world); break;
      case 'dash': this.updateDash(dt, world); break;
      case 'dashRecover':
        if (this.t >= c.dashRecover) {
          if (--this.dashesLeft > 0) this.beginDash(world);
          else this.toFloat(world);
        }
        break;
      case 'vanish':
        this.alpha = clamp(1 - this.t / c.vanishTime, 0, 1);
        if (Math.random() < 0.5) this.wisp(world, 30);
        if (this.t >= c.vanishTime) this.setState('hidden');
        break;
      case 'hidden':
        this.alpha = 0;
        if (this.t >= c.hiddenTime) {
          this.dest = this.pickAppearPoint(world);
          this.setState('appear');
        }
        break;
      case 'appear':
        this.x = this.dest.x;
        this.y = this.dest.y;
        this.alpha = clamp(this.t / c.appearTime, 0, 1);
        if (Math.random() < 0.6) this.wisp(world, 40);
        if (this.t >= c.appearTime) this.startPulse(world);
        break;
      case 'pulse': this.updatePulse(dt, world); break;
    }
    this.contactDamage(world);
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** Clamps a ground point into the arena floor. */
  clampToFloor(world, x, y) {
    const b = world.dungeon.floorBounds;
    return { x: clamp(x, b.left + 40, b.right - 40), y: clamp(y, b.top + 70, b.bottom - 20) };
  }

  /** Drifts toward a point, at most `speed` px/s. */
  driftToward(tx, ty, speed, dt) {
    const d = dist(this.x, this.y, tx, ty);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    this.x += ((tx - this.x) / d) * s;
    this.y += ((ty - this.y) / d) * s;
  }

  // ---------- floating + eye lasers ----------

  updateFloat(dt, world) {
    const c = this.cfg;
    const p = world.player;
    this.alpha = Math.min(1, this.alpha + dt * 4);
    this.orbit += dt * 0.5 * this.orbitDir;
    const t = this.clampToFloor(world, p.x + Math.cos(this.orbit) * c.orbitRadius, p.y + Math.sin(this.orbit) * c.orbitRadius * 0.7);
    this.driftToward(t.x, t.y, c.floatSpeed, dt);

    this.updateEyes(dt, world);
    this.attackTimer -= dt;
    if (this.attackTimer <= 0 && this.eyeCharge < 0 && !p.dead) this.startAttack(world);
  }

  updateEyes(dt, world) {
    const c = this.cfg;
    const p = world.player;
    if (this.eyeCharge >= 0) {
      this.eyeCharge += dt;
      if (this.eyeCharge < c.eyeWindup - 0.15) this.eyeAim = angleTo(this.hx, this.hy - 22, p.hx, p.hy);
      if (this.eyeCharge >= c.eyeWindup) {
        const spread = c.eyeSpreadDegrees * DEG;
        const angles = this.phase === 3 ? [-spread, 0, spread] : [-spread / 2, spread / 2];
        angles.forEach((da, i) => {
          const e = PHANTOM_EYES[i % 2];
          this.fireLaser(world, this.x + e.x, this.drawY + e.y, this.eyeAim + da);
        });
        Sound.play('eyeLaser');
        this.eyeCharge = -1;
        this.eyeTimer = c.eyeInterval[this.phase - 1];
      }
      return;
    }
    this.eyeTimer -= dt;
    if (this.eyeTimer <= 0 && !p.dead && this.attackTimer > c.eyeWindup) {
      this.eyeCharge = 0;
      this.eyeAim = angleTo(this.hx, this.hy - 22, p.hx, p.hy);
      Sound.play('laserCharge', 0.2);
    }
  }

  fireLaser(world, x, y, angle) {
    const L = this.cfg.eyeLaser;
    world.enemyProjectiles.push(new Projectile({
      x, y,
      vx: Math.cos(angle) * L.speed,
      vy: Math.sin(angle) * L.speed,
      radius: L.radius, damage: L.damage, life: L.life, friendly: false,
      sprite: Sprites.phantom.laser, glow: '255, 70, 220', trail: ['#ff4ad8', '#ffb0f0'],
    }));
  }

  startAttack(world) {
    const dash = this.phase === 1 || (this.phase === 3 && Math.random() < 0.5);
    if (dash) {
      this.dashesLeft = this.cfg.dashChain[this.phase - 1];
      this.beginDash(world);
    } else {
      this.startVanish(world);
    }
  }

  toFloat(world) {
    const p = world.player;
    this.setState('float');
    this.attackTimer = this.cfg.attackInterval[this.phase - 1];
    this.eyeTimer = Math.min(this.eyeTimer, 0.6);
    // carry on orbiting from wherever we ended up
    this.orbit = angleTo(p.x, p.y, this.x, this.y);
    if (Math.random() < 0.4) this.orbitDir *= -1;
  }

  // ---------- dash ----------

  beginDash(world) {
    this.setState('dashWindup');
    this.eyeCharge = -1;
    this.aimDash(world);
    Sound.play('wraithShriek');
  }

  /** Points the dash at the hero, stopping at the arena edge. */
  aimDash(world) {
    const c = this.cfg;
    const p = world.player;
    const a = angleTo(this.x, this.y, p.x, p.y);
    let len = Math.min(c.dashRange, dist(this.x, this.y, p.x, p.y) + 110);
    const b = world.dungeon.floorBounds;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    if (cos > 0.001) len = Math.min(len, (b.right - 40 - this.x) / cos);
    if (cos < -0.001) len = Math.min(len, (b.left + 40 - this.x) / cos);
    if (sin > 0.001) len = Math.min(len, (b.bottom - 20 - this.y) / sin);
    if (sin < -0.001) len = Math.min(len, (b.top + 70 - this.y) / sin);
    len = Math.max(0, len);
    this.dash = { angle: a, len, traveled: 0, hit: false, ex: this.x + cos * len, ey: this.y + sin * len, ghost: 0 };
  }

  updateDashWindup(dt, world) {
    const c = this.cfg;
    if (this.t < c.dashWindup - c.dashAimLockAt) this.aimDash(world);
    if (this.t >= c.dashWindup) {
      this.setState('dash');
      Sound.play('dash');
      Sound.play('fistLaunch');
    }
  }

  updateDash(dt, world) {
    const c = this.cfg;
    const D = this.dash;
    const p = world.player;
    const step = Math.min(c.dashSpeed * dt, D.len - D.traveled);
    this.x += Math.cos(D.angle) * step;
    this.y += Math.sin(D.angle) * step;
    D.traveled += step;
    D.ghost -= dt;
    if (D.ghost <= 0) {
      D.ghost = 0.035;
      this.afterimage(world);
    }
    if (!D.hit && !p.dead && dist(this.hx, this.hy, p.hx, p.hy) < this.radius + p.radius) {
      D.hit = p.hurt(c.dashDamage, world, this.x, this.y);
    }
    if (D.traveled >= D.len - 0.01) {
      world.shake(4, 0.2);
      world.effects.burst(this.hx, this.hy, { count: 14, colors: ['#7048b4', '#c8b8ff', '#ff4ad8'], speed: [60, 180], life: [0.3, 0.6] });
      this.setState('dashRecover');
    }
  }

  afterimage(world) {
    const frame = this.currentFrame();
    const gx = this.x;
    const gy = this.drawY;
    world.effects.add(0.3, (ctx, t) => {
      drawSprite(ctx, frame.flash, gx, gy, PHANTOM_SPRITE.ax, PHANTOM_SPRITE.ay, false, 0.25 * (1 - t));
      drawSprite(ctx, frame.img, gx, gy, PHANTOM_SPRITE.ax, PHANTOM_SPRITE.ay, false, 0.3 * (1 - t));
    });
  }

  // ---------- vanish -> reappear -> pull pulses ----------

  startVanish(world) {
    this.setState('vanish');
    this.eyeCharge = -1;
    this.dash = null;
    this.pulsesLeft = 0;
    Sound.play('phantomVanish');
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#33195a', '#7048b4', '#c8b8ff'], speed: [40, 160], life: [0.4, 0.8], up: 30 });
  }

  /** A spot near the hero, preferring ones that don't land right on top of them. */
  pickAppearPoint(world) {
    const c = this.cfg;
    const p = world.player;
    let best = null;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      const d = rand(c.appearDistance[0], c.appearDistance[1]);
      const pt = this.clampToFloor(world, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      const gap = dist(pt.x, pt.y, p.x, p.y);
      if (!best || gap > best.gap) best = { ...pt, gap };
      if (gap >= c.appearDistance[0] * 0.85) break;
    }
    return { x: best.x, y: best.y };
  }

  startPulse(world) {
    this.setState('pulse');
    this.alpha = 1;
    this.pulsesLeft = this.cfg.pulseCount;
    this.pulseTimer = 0.15;
    this.sprayTimer = 0.3;
    Sound.play('phantomAppear');
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#33195a', '#7048b4', '#c8b8ff'], speed: [40, 160], life: [0.4, 0.8] });
  }

  updatePulse(dt, world) {
    const c = this.cfg;
    const p = world.player;

    this.pulseTimer -= dt;
    if (this.pulseTimer <= 0 && this.pulsesLeft > 0) {
      this.pulsesLeft--;
      this.pulseTimer = c.pulseInterval;
      this.pulses.push({ x: this.x, y: this.y, r: 12, hit: false });
      world.shake(4, 0.2);
      Sound.play('pulse');
    }

    // a steady drag toward the king the whole time (dodging slips free)
    const d = dist(p.x, p.y, this.x, this.y);
    if (!p.dead && !p.dodge && d > 20 && d < c.pulseRadius) {
      const a = angleTo(p.x, p.y, this.x, this.y);
      world.dungeon.move(p, Math.cos(a) * c.pullSpeed * dt, Math.sin(a) * c.pullSpeed * dt);
    }

    // slow lasers sprayed in random directions
    this.sprayTimer -= dt;
    while (this.sprayTimer <= 0) {
      this.sprayTimer += c.pulseLaserEvery;
      this.fireLaser(world, this.hx, this.hy - 10, rand(0, TAU));
      Sound.play('eyeLaser', 0.08);
    }

    // dust sucked in from the edges
    if (Math.random() < 0.8) {
      const a = rand(0, TAU);
      const r = rand(120, c.pulseRadius);
      world.effects.burst(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.7, { count: 1, colors: ['#7048b4', '#c8b8ff'], speed: [0, 0], life: [0.4, 0.6], size: [2, 3] });
      const last = world.effects.particles[world.effects.particles.length - 1];
      last.vx = -Math.cos(a) * r * 1.6;
      last.vy = -Math.sin(a) * r * 1.1;
      last.drag = 0;
    }

    if (this.pulsesLeft === 0 && this.pulseTimer <= c.pulseInterval - 0.6) this.toFloat(world);
  }

  updatePulseRings(dt, world) {
    const c = this.cfg;
    const p = world.player;
    for (const s of this.pulses) {
      s.r += c.pulseSpeed * dt;
      if (s.r >= c.pulseRadius) s.dead = true;
      if (!s.hit && !p.dead && !p.dodge && Math.abs(dist(p.x, p.y, s.x, s.y) - s.r) < 18) {
        s.hit = true;
        p.knockback(angleTo(p.x, p.y, s.x, s.y), c.pulseYank);
      }
    }
    removeDead(this.pulses);
  }

  /** Touching the king hurts (its dash deals its own damage). */
  contactDamage(world) {
    const p = world.player;
    if (p.dead || this.state === 'dash' || this.alpha < 0.6) return;
    if (dist(this.hx, this.hy, p.hx, p.hy) < this.radius + p.radius - 6) p.hurt(this.cfg.contactDamage, world, this.x, this.y);
  }

  // ---------------------------------------------------------
  //  EVENTS
  // ---------------------------------------------------------

  enterPhase(phase, world) {
    this.phase = phase;
    if (phase === 2) world.banner('THE KING FADES', 'He strikes from the shadows');
    else world.banner("THE KING'S WRATH", 'All his power unleashed');
    Sound.play('bossRoar');
    world.shake(8, 0.6);
    this.startVanish(world);
  }

  die(world) {
    this.dying = 2.6;
    this.state = 'dying';
    this.eyeCharge = -1;
    this.dash = null;
    this.pulsesLeft = 0;
    Sound.play('bossRoar');
    world.banner('THE KING IS BANISHED!', '');
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.alpha = clamp(this.dying / 2.6, 0, 1) * (0.6 + 0.4 * Math.sin(this.time * 30));
    this.hover += dt * 14;
    this.flashBurst = (this.flashBurst || 0) - dt;
    if (this.flashBurst <= 0) {
      this.flashBurst = 0.16;
      this.flashTime = 0.08;
      world.effects.burst(this.hx + rand(-30, 30), this.hy + rand(-40, 30), { count: 12, colors: ['#7048b4', '#c8b8ff', '#ff4ad8', '#ffffff'], speed: [60, 200], life: [0.3, 0.7], size: [2, 5] });
      world.shake(5, 0.2);
      Sound.play('phantomVanish', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 80, colors: ['#33195a', '#7048b4', '#c8b8ff', '#ff4ad8', '#ffe07a'], speed: [100, 340], life: [0.6, 1.4], size: [3, 6] });
      world.shake(12, 0.7);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  /** Spectral motes drifting up around the king. */
  wisp(world, spread) {
    world.effects.burst(this.x + rand(-spread, spread), this.y + rand(-spread * 0.4, spread * 0.4), {
      count: 1, colors: ['#4e2a86', '#7048b4', '#c8b8ff'], speed: [5, 25], life: [0.5, 0.9], size: [2, 4], up: 50,
    });
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  get angry() {
    return this.phase === 3 || this.eyeCharge >= 0 || this.state === 'dashWindup' || this.state === 'dash' || this.state === 'pulse';
  }

  currentFrame() {
    const set = this.angry ? Sprites.phantom.angry : Sprites.phantom.idle;
    return set[Math.floor(this.time * 6) % 4];
  }

  drawGround(ctx) {
    if (this.dead) return;
    const c = this.cfg;
    if (this.alpha > 0) drawShadow(ctx, this.x, this.y + 4, 26 - this.bob, 8, 0.3 * this.alpha);

    for (const s of this.pulses) {
      const fade = 1 - s.r / c.pulseRadius;
      ctx.save();
      ctx.strokeStyle = `rgba(176, 106, 255, ${0.35 + 0.55 * fade})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, TAU);
      ctx.stroke();
      // inward chevrons show which way it pulls
      ctx.strokeStyle = `rgba(230, 200, 255, ${0.4 + 0.5 * fade})`;
      ctx.lineWidth = 2;
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.time * 0.3;
        const ox = s.x + Math.cos(a) * (s.r - 10);
        const oy = s.y + Math.sin(a) * (s.r - 10) * 0.7;
        const ix = s.x + Math.cos(a) * (s.r - 20);
        const iy = s.y + Math.sin(a) * (s.r - 20) * 0.7;
        const px = -Math.sin(a) * 5;
        const py = Math.cos(a) * 5 * 0.7;
        ctx.beginPath();
        ctx.moveTo(ox + px, oy + py);
        ctx.lineTo(ix, iy);
        ctx.lineTo(ox - px, oy - py);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.intro > 0 || this.dying > 0) return;

    const purple = '176, 90, 255';
    if (this.state === 'dashWindup' && this.dash) {
      Telegraph.line(ctx, this.x, this.y, this.dash.ex, this.dash.ey, this.radius * 2, this.t / c.dashWindup);
    }
    if (this.state === 'appear' || this.state === 'hidden') {
      const pt = this.state === 'appear' ? this.dest : null;
      if (pt) {
        Telegraph.circle(ctx, pt.x, pt.y, 40, this.t / c.appearTime, purple);
        ctx.save();
        ctx.strokeStyle = `rgba(${purple}, 0.35)`;
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, c.pulseRadius, c.pulseRadius * 0.7, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  getDrawables() {
    if (this.dead || this.alpha <= 0) return [];
    return [{ y: this.y, draw: (ctx) => this.drawKing(ctx) }];
  }

  drawKing(ctx) {
    const frame = this.currentFrame();
    const shaking = this.state === 'dashWindup' || this.eyeCharge >= 0;
    const x = this.x + (shaking ? rand(-1.5, 1.5) : 0);
    const y = this.drawY;
    const a = this.alpha * (this.phase >= 2 ? 0.85 + 0.1 * Math.sin(this.time * 9) : 0.95);

    // aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 56 + Math.sin(this.time * 4) * 4;
    const tint = this.angry ? '200, 60, 200' : '120, 70, 220';
    const gr = ctx.createRadialGradient(x, y - 46, 4, x, y - 46, r);
    gr.addColorStop(0, `rgba(${tint}, ${0.35 * this.alpha})`);
    gr.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - 46 - r, r * 2, r * 2);
    ctx.restore();

    drawSprite(ctx, frame.img, x, y, PHANTOM_SPRITE.ax, PHANTOM_SPRITE.ay, false, a);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, x, y, PHANTOM_SPRITE.ax, PHANTOM_SPRITE.ay, false, a * 0.8);

    // eyes flare while a volley charges
    if (this.eyeCharge >= 0) {
      const k = clamp(this.eyeCharge / this.cfg.eyeWindup, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of PHANTOM_EYES) {
        const ex = x + e.x;
        const ey = y + e.y;
        const er = 3 + k * 7;
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er);
        g.addColorStop(0, 'rgba(255, 220, 250, 0.9)');
        g.addColorStop(1, 'rgba(255, 70, 220, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
      }
      ctx.restore();
    }
  }

  /** Aim lines for the eye volley, above everything. */
  drawOverlay(ctx) {
    if (this.eyeCharge < 0 || this.dying > 0) return;
    const c = this.cfg;
    const k = clamp(this.eyeCharge / c.eyeWindup, 0, 1);
    const spread = c.eyeSpreadDegrees * DEG;
    const angles = this.phase === 3 ? [-spread, 0, spread] : [-spread / 2, spread / 2];
    ctx.save();
    ctx.strokeStyle = `rgba(255, 70, 220, ${0.2 + 0.4 * k})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    angles.forEach((da, i) => {
      const e = PHANTOM_EYES[i % 2];
      const ex = this.x + e.x;
      const ey = this.drawY + e.y;
      const a = this.eyeAim + da;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a) * 150, ey + Math.sin(a) * 150);
      ctx.stroke();
    });
    ctx.restore();
  }
}
