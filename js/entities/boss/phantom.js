// =============================================================
//  PHANTOM KING BOSS
//
//  A single floating target that drifts over walls and pillars.
//  Phase 1: orbits the player and fires slow eye lasers. Takes turns
//    between dash chains (1, then 2, then 3 dashes, each slower than
//    the last) and laser barrages (fans of lasers aimed at the player).
//  Phase 2 (50% hp): takes turns between barrages and vanishing:
//    it reappears near the player and pulses shockwaves that pull
//    them in while spraying lasers in every direction.
//  Phase 3 (25% hp): all three attacks, faster, and streams eye
//    lasers nonstop between attacks.
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

    this.state = 'float';    // float | dashWindup | dash | dashRecover | barrage | vanish | hidden | appear | pulse
    this.t = 0;
    this.attackTimer = c.attackInterval[0];
    this.orbit = rand(0, TAU);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;

    this.eyeTimer = 1.2;
    this.eyeCharge = -1;     // >= 0 while the eyes charge a volley
    this.eyeAim = 0;

    this.dash = null;
    this.dashesLeft = 0;
    this.dashIndex = 0;      // which dash of the current chain (0 = first, fastest)
    this.dashCycleStep = 0;  // dash chains go 1, 2, 3, 1...
    this.attackStep = 0;
    this.dest = null;        // reappear point

    this.pulses = [];        // expanding pull rings
    this.pulsesLeft = 0;
    this.pulseTimer = 0;
    this.sprayTimer = 0;
  }

  get name() { return 'PHANTOM KING'; }
  get title() { return 'Sovereign of the Restless Dead'; }
  get defeatText() { return 'The Phantom King has been banished.'; }

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
          if (--this.dashesLeft > 0) {
            this.dashIndex++;
            this.beginDash(world);
          } else {
            this.toFloat(world);
          }
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
      case 'barrage': this.updateBarrage(dt, world); break;
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
    if (this.phase === 3) return this.updateEyeStream(dt, world);
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

  /** Phase 3: a steady stream of lasers from alternating eyes whenever it isn't busy. */
  updateEyeStream(dt, world) {
    const c = this.cfg;
    const p = world.player;
    this.eyeCharge = -1;
    this.streamTimer = (this.streamTimer ?? 0.3) - dt;
    if (this.streamTimer > 0 || p.dead) return;
    this.streamTimer = c.eyeStreamEvery;
    this.streamEye = ((this.streamEye || 0) + 1) % 2;
    const e = PHANTOM_EYES[this.streamEye];
    const x = this.x + e.x;
    const y = this.drawY + e.y;
    this.fireLaser(world, x, y, angleTo(x, y, p.hx, p.hy) + rand(-1, 1) * c.eyeStreamJitterDegrees * DEG);
    Sound.play('eyeLaser', 0.08);
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

  /** Big attacks take turns, in this order, per phase. */
  get attackOrder() {
    return [['dash', 'barrage'], ['vanish', 'barrage'], ['dash', 'vanish', 'barrage']][this.phase - 1];
  }

  startAttack(world) {
    const c = this.cfg;
    const order = this.attackOrder;
    const kind = order[this.attackStep++ % order.length];
    if (kind === 'dash') {
      // 1 dash, then 2, then 3, then back to 1
      this.dashesLeft = c.dashCycle[this.dashCycleStep++ % c.dashCycle.length];
      this.dashIndex = 0;
      this.beginDash(world);
    } else if (kind === 'vanish') {
      this.startVanish(world);
    } else {
      this.startBarrage(world);
    }
  }

  // ---------- laser barrage ----------

  startBarrage(world) {
    this.setState('barrage');
    this.eyeCharge = -1;
    this.fanTimer = 0;
    this.fanCount = 0;
    Sound.play('laserCharge', 0.2);
  }

  updateBarrage(dt, world) {
    const c = this.cfg;
    const i = this.phase - 1;
    const p = world.player;
    this.alpha = Math.min(1, this.alpha + dt * 4);
    // hangs back at range while it fires
    const t = this.clampToFloor(world, p.x + Math.cos(this.orbit) * c.orbitRadius, p.y + Math.sin(this.orbit) * c.orbitRadius * 0.7);
    this.driftToward(t.x, t.y, c.floatSpeed * 0.3, dt);
    if (this.t < c.barrageWindup) return;

    this.fanTimer -= dt;
    if (this.fanTimer <= 0 && !p.dead) {
      this.fanTimer = c.barrageEvery[i];
      const n = c.barrageFan[i];
      const spread = c.barrageSpreadDegrees * DEG;
      const gap = spread / (n - 1);
      const ox = this.x;
      const oy = this.drawY + PHANTOM_EYES[0].y;
      const base = angleTo(ox, oy, p.hx, p.hy) - spread / 2 + (this.fanCount % 2 ? gap / 2 : 0);
      for (let k = 0; k < n; k++) this.fireLaser(world, ox, oy, base + k * gap);
      this.fanCount++;
      Sound.play('eyeLaser');
    }
    if (this.t >= c.barrageWindup + c.barrageTime[i]) this.toFloat(world);
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
    // later dashes in a chain are slower, giving time to react
    const speed = c.dashSpeeds[Math.min(this.dashIndex, c.dashSpeeds.length - 1)];
    const step = Math.min(speed * dt, D.len - D.traveled);
    const px = this.x;
    const py = this.y;
    this.x += Math.cos(D.angle) * step;
    this.y += Math.sin(D.angle) * step;
    D.traveled += step;
    D.ghost -= dt;
    if (D.ghost <= 0) {
      D.ghost = 0.035;
      this.afterimage(world);
    }
    // the hit lane is the ground path the telegraph showed, not the floating body
    // every hero in the lane gets hit, once each per dash
    D.hitHeroes = D.hitHeroes || new Set();
    for (const h of world.heroes) {
      if (D.hitHeroes.has(h) || pointSegmentDistance(h.x, h.y, px, py, this.x, this.y) >= c.dashWidth / 2 + h.hw) continue;
      if (h.hurt(c.dashDamage, world, this.x, this.y)) D.hitHeroes.add(h);
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

    // rings start at the edge and close in on the king
    this.pulseTimer -= dt;
    if (this.pulseTimer <= 0 && this.pulsesLeft > 0) {
      this.pulsesLeft--;
      this.pulseTimer = c.pulseInterval;
      this.pulses.push({ x: this.x, y: this.y, r: c.pulseRadius, prevR: c.pulseRadius });
      world.shake(4, 0.2);
      Sound.play('pulse');
    }

    // slow lasers sprayed in random directions
    this.sprayTimer -= dt;
    while (this.sprayTimer <= 0) {
      this.sprayTimer += c.pulseLaserEvery;
      this.fireLaser(world, this.hx, this.hy - 10, rand(0, TAU));
      Sound.play('eyeLaser', 0.08);
    }

    // dust spiralling in from the edges
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU);
      const r = rand(140, c.pulseRadius);
      world.effects.burst(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.7, { count: 1, colors: ['#7048b4', '#c8b8ff', '#e8d8ff'], speed: [0, 0], life: [0.45, 0.6], size: [2, 3] });
      const last = world.effects.particles[world.effects.particles.length - 1];
      const swirl = a + Math.PI + 0.6; // inward, bent into a spiral
      last.vx = Math.cos(swirl) * r * 1.5;
      last.vy = Math.sin(swirl) * r * 1.05;
      last.drag = 0;
    }

    if (this.pulsesLeft === 0 && this.pulses.length === 0) this.toFloat(world);
  }

  /** Moves the rings and drags the hero in. Runs every frame so a surge fades out smoothly. */
  updatePulseRings(dt, world) {
    const c = this.cfg;
    const p = world.player;
    const d = dist(p.x, p.y, this.x, this.y);
    for (const s of this.pulses) {
      s.prevR = s.r;
      s.r -= c.pulseSpeed * dt;
      if (s.r <= 24) s.dead = true;
      // the ring just swept over the hero: a strong tug toward the king
      const pd = dist(p.x, p.y, s.x, s.y);
      if (!p.dead && !p.dodge && s.prevR >= pd && s.r < pd) {
        this.surge = c.pullSurge;
        world.effects.burst(p.x, p.y - 10, { count: 8, colors: ['#b06aff', '#e8d8ff'], speed: [40, 100], life: [0.2, 0.4], angle: angleTo(p.x, p.y, s.x, s.y), spread: 1 });
      }
    }
    removeDead(this.pulses);

    this.surge = (this.surge || 0) * Math.exp(-c.pullSurgeDecay * dt);
    const pulling = this.state === 'pulse' && d < c.pulseRadius * 1.1;
    const speed = (pulling ? c.pullSpeed : 0) + this.surge;
    this.pullStrength = p.dead || p.dodge || d < 30 ? 0 : speed; // dodging slips free
    this.pullTarget = p;
    if (this.pullStrength < 1) return;
    const a = angleTo(p.x, p.y, this.x, this.y);
    world.dungeon.move(p, Math.cos(a) * this.pullStrength * dt, Math.sin(a) * this.pullStrength * dt);
    if (Math.random() < this.pullStrength / 300) {
      world.effects.burst(p.x + rand(-8, 8), p.y - rand(0, 20), { count: 1, colors: ['#b06aff', '#e8d8ff'], speed: [80, 140], life: [0.2, 0.35], angle: a, spread: 0.3, size: [2, 3] });
    }
  }

  /** Touching the king hurts (its dash deals its own damage). */
  contactDamage(world) {
    if (this.state === 'dash' || this.alpha < 0.6) return;
    // measured at ground level (its shadow), like the dash lane
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < this.cfg.dashWidth / 2 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y);
    }
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
    this.attackStep = this.attackOrder.indexOf('vanish') + 1; // the phase opens with a vanish
    this.startVanish(world);
  }

  die(world) {
    this.dying = 2.6;
    this.state = 'dying';
    this.eyeCharge = -1;
    this.dash = null;
    this.pulsesLeft = 0;
    this.pulses = [];
    this.surge = 0;
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
    return this.phase === 3 || this.eyeCharge >= 0 || ['dashWindup', 'dash', 'pulse', 'barrage'].includes(this.state);
  }

  currentFrame() {
    const set = this.angry ? Sprites.phantom.angry : Sprites.phantom.idle;
    return set[Math.floor(this.time * 6) % 4];
  }

  drawGround(ctx) {
    if (this.dead) return;
    const c = this.cfg;
    if (this.alpha > 0) drawShadow(ctx, this.x, this.y + 4, 26 - this.bob, 8, 0.3 * this.alpha);

    // swirling vortex on the floor while it pulls
    if (this.state === 'pulse') {
      const R = c.pulseRadius;
      ctx.save();
      ctx.fillStyle = 'rgba(90, 40, 150, 0.12)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, R, R * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.lineCap = 'round';
      for (let arm = 0; arm < 5; arm++) {
        const base = (arm / 5) * TAU - this.time * 2.2;
        for (let k = 0; k < 16; k++) {
          const f = k / 16;
          const rr = 30 + f * (R - 40);
          const a = base + f * 2.4;
          ctx.fillStyle = `rgba(200, 160, 255, ${0.55 * (1 - f) + 0.08})`;
          const sz = 2 + (1 - f) * 3;
          ctx.fillRect(Math.round(this.x + Math.cos(a) * rr - sz / 2), Math.round(this.y + Math.sin(a) * rr * 0.7 - sz / 2), sz, sz);
        }
      }
      ctx.restore();
    }

    for (const s of this.pulses) {
      const fade = 1 - s.r / c.pulseRadius; // brighter as it closes in
      ctx.save();
      ctx.strokeStyle = `rgba(140, 70, 230, ${0.25 + 0.25 * fade})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r + 4, (s.r + 4) * 0.7, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(200, 140, 255, ${0.6 + 0.35 * fade})`;
      ctx.lineWidth = 4;
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
    if (this.state === 'barrage' && this.t < c.barrageWindup) {
      Telegraph.circle(ctx, this.x, this.y, 50, this.t / c.barrageWindup, '255, 70, 220');
    }
    if (this.state === 'dashWindup' && this.dash) {
      Telegraph.line(ctx, this.x, this.y, this.dash.ex, this.dash.ey, c.dashWidth, this.t / c.dashWindup);
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
    const shaking = this.state === 'dashWindup' || this.eyeCharge >= 0 || (this.state === 'barrage' && this.t < this.cfg.barrageWindup);
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

    // eyes flare while a volley or barrage charges, and stay lit while a barrage fires
    const k = this.eyeCharge >= 0 ? clamp(this.eyeCharge / this.cfg.eyeWindup, 0, 1)
      : this.state === 'barrage' ? clamp(this.t / this.cfg.barrageWindup, 0, 1) : -1;
    if (k >= 0) {
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

  /** Wavy spectral chain from the hero to the king while it pulls them in. */
  drawTether(ctx) {
    const s = this.pullStrength || 0;
    const p = this.pullTarget;
    if (s < 5 || !p || this.dying > 0) return;
    const k = clamp(s / (this.cfg.pullSpeed + this.cfg.pullSurge), 0.15, 1);
    const sx = p.x;
    const sy = p.y - 14;
    const ex = this.hx;
    const ey = this.hy;
    const len = dist(sx, sy, ex, ey);
    const nx = -(ey - sy) / (len || 1);
    const ny = (ex - sx) / (len || 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [width, alpha] of [[6, 0.18], [2, 0.6]]) {
      ctx.strokeStyle = `rgba(190, 120, 255, ${alpha * k})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const wob = Math.sin(t * 14 - this.time * 18) * 5 * Math.sin(t * Math.PI);
        const x = lerp(sx, ex, t) + nx * wob;
        const y = lerp(sy, ey, t) + ny * wob;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Aim lines for the eye volley, above everything. */
  drawOverlay(ctx) {
    this.drawTether(ctx);
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
