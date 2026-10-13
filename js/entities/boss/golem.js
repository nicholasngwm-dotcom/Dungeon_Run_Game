// =============================================================
//  CLAY GOLEM BOSS
//
//  Phase 1: head + two fists are attackable (body is immune).
//    - Head fires spreads of bouncing fireballs.
//    - Fists rocket-punch toward the player and retract.
//  Phase 2 (head destroyed): head detaches, floats, becomes
//    untouchable. Fires a laser every second + periodic fireball
//    bursts. The body becomes attackable and deals contact damage.
//  Fists destroyed: body walks toward the player, stomping out
//    shockwaves that slow. After 30s of walking it curls into a
//    ball and rolls at the player.
//  Throughout: summons weak clay minions that smash out shockwaves.
//  Defeat the body to win.
// =============================================================

/** One damageable piece of the golem. */
class GolemPart {
  constructor(golem, name, hp, radius) {
    this.golem = golem;
    this.name = name;
    this.maxHp = hp;
    this.hp = hp;
    this.radius = radius;
    this.x = 0;
    this.y = 0;
    this.flashTime = 0;
    this.immune = false;
    this.dead = false;
  }

  get hx() { return this.x; }
  get hy() { return this.y; }

  knockback() {} // far too heavy

  takeDamage(amount, world) {
    if (this.dead) return false;
    if (this.immune) {
      this.flashTime = 0.05;
      if (!this.immuneTextCd || world.time > this.immuneTextCd) {
        this.immuneTextCd = world.time + 0.6;
        world.effects.text(this.x, this.y - 20, 'IMMUNE', { color: '#a0a0b0', size: 7 });
      }
      return false;
    }
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.golem.onPartDestroyed(this, world);
    }
    return true;
  }
}

/** A rocket fist: rest -> windup (aim) -> launch -> hold -> retract. */
class GolemFist extends GolemPart {
  constructor(golem, side) {
    super(golem, side < 0 ? 'LEFT FIST' : 'RIGHT FIST', CONFIG.golem.fistHp, 22);
    this.side = side;
    this.state = 'rest';
    this.t = 0;
    this.angle = Math.PI / 2;
    this.target = { x: 0, y: 0 };
    this.hitPlayer = false;
    this.snapToRest();
  }

  get restX() { return this.golem.x + this.side * 80 + Math.sin(this.golem.time * 2 + this.side) * 3; }
  get restY() { return this.golem.y - 34 + Math.cos(this.golem.time * 2.4 + this.side) * 4; }
  get shoulderX() { return this.golem.x + this.side * 48; }
  get shoulderY() { return this.golem.y - 62; }

  snapToRest() {
    this.x = this.restX;
    this.y = this.restY;
  }

  startPunch() {
    this.state = 'windup';
    this.t = 0;
    Sound.play('fistCharge');
  }

  update(dt, world) {
    const c = CONFIG.golem;
    const p = world.player;
    this.flashTime -= dt;
    this.t += dt;

    switch (this.state) {
      case 'rest':
        this.x = lerp(this.x, this.restX, Math.min(1, dt * 10));
        this.y = lerp(this.y, this.restY, Math.min(1, dt * 10));
        this.angle = Math.PI / 2;
        break;

      case 'windup': {
        // pull back toward the shoulder and track the player until locked
        const pull = Math.min(1, this.t / 0.3);
        this.x = lerp(this.restX, this.shoulderX, pull * 0.3) + rand(-1.5, 1.5);
        this.y = lerp(this.restY, this.shoulderY, pull * 0.3) + rand(-1.5, 1.5);
        if (this.t < c.fistWindup - c.fistAimLockAt) {
          this.angle = angleTo(this.x, this.y, p.hx, p.hy);
          const reach = Math.min(c.fistRange, dist(this.x, this.y, p.hx, p.hy) + 60);
          const end = world.dungeon.raycast(this.x, this.y, this.angle, reach);
          this.target = end;
        }
        if (this.t >= c.fistWindup) {
          this.state = 'launch';
          this.t = 0;
          this.hitPlayer = false;
          Sound.play('fistLaunch');
        }
        break;
      }

      case 'launch': {
        const step = c.fistSpeed * dt;
        const remaining = dist(this.x, this.y, this.target.x, this.target.y);
        if (remaining <= step) {
          this.x = this.target.x;
          this.y = this.target.y;
          this.state = 'hold';
          this.t = 0;
          const hitWall = world.dungeon.isSolidAt(this.x + Math.cos(this.angle) * 6, this.y + Math.sin(this.angle) * 6);
          world.shake(hitWall ? 6 : 3, 0.2);
          Sound.play('impact');
          world.effects.burst(this.x, this.y, { count: 12, colors: [GOLEM_COLORS.clay, GOLEM_COLORS.clayDD, '#6a6080'], speed: [60, 160] });
        } else {
          this.x += Math.cos(this.angle) * step;
          this.y += Math.sin(this.angle) * step;
        }
        if (!this.hitPlayer && dist(this.x, this.y, p.hx, p.hy) < this.radius + p.radius) {
          this.hitPlayer = p.hurt(c.fistDamage, world, this.x, this.y);
        }
        break;
      }

      case 'hold':
        if (this.t >= 0.35) { this.state = 'retract'; this.t = 0; }
        break;

      case 'retract': {
        const a = angleTo(this.x, this.y, this.restX, this.restY);
        const step = c.fistRetractSpeed * dt;
        if (dist(this.x, this.y, this.restX, this.restY) <= step) {
          this.state = 'rest';
        } else {
          this.x += Math.cos(a) * step;
          this.y += Math.sin(a) * step;
        }
        break;
      }
    }
  }

  drawTelegraph(ctx) {
    if (this.dead || this.state !== 'windup') return;
    Telegraph.line(ctx, this.x, this.y, this.target.x, this.target.y, this.radius * 2, this.t / CONFIG.golem.fistWindup);
  }

  draw(ctx) {
    if (this.dead) return;
    // chain from shoulder to fist
    const link = Sprites.golem.link.img;
    const d = dist(this.shoulderX, this.shoulderY, this.x, this.y);
    const n = Math.floor(d / 12);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      ctx.drawImage(link, Math.round(lerp(this.shoulderX, this.x, t) - 5), Math.round(lerp(this.shoulderY, this.y, t) - 5));
    }
    const f = Sprites.golem.fist;
    const flip = Math.cos(this.angle) < 0;
    drawRotated(ctx, f.img, this.x, this.y, GOLEM_FIST.ax, GOLEM_FIST.ay, this.angle, flip);
    if (this.flashTime > 0) drawRotated(ctx, f.flash, this.x, this.y, GOLEM_FIST.ax, GOLEM_FIST.ay, this.angle, flip);
    if (this.state === 'windup') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.t * 30);
      drawRotated(ctx, f.flash, this.x, this.y, GOLEM_FIST.ax, GOLEM_FIST.ay, this.angle, flip);
      ctx.restore();
    }
  }
}

class Golem {
  constructor(x, y) {
    const c = CONFIG.golem;
    this.cfg = c;
    this.x = x;          // feet position
    this.y = y;
    this.hw = 40;        // wall collision box (feet)
    this.hh = 16;
    this.time = 0;
    this.phase = 1;
    this.mode = 'stand'; // stand | walk | roll
    this.intro = 2.6;
    this.dying = 0;
    this.dead = false;
    this.facing = 1;

    this.body = new GolemPart(this, 'BODY', c.bodyHp, 48);
    this.body.immune = true;
    this.head = new GolemPart(this, 'HEAD', c.headHp, 28);
    this.fists = [new GolemFist(this, -1), new GolemFist(this, 1)];

    // phase 1 head
    this.headTimer = 1.5;
    this.headCharge = -1;     // >= 0 while charging fireballs
    this.headAim = Math.PI / 2;

    this.fistTimer = 1.2;
    this.nextFist = 0;

    // phase 2 head
    this.hover = { angle: -Math.PI / 2 };
    this.laser = null;
    this.laserTimer = 1.5;
    this.burstTimer = c.burstInterval * 0.6;
    this.burstCharge = -1;

    // walking / rolling
    this.walkTime = 0;
    this.stompTimer = c.stompInterval;
    this.stompRaise = -1;
    this.shockwaves = [];
    this.roll = null;
    this.rollCount = 0;
    this.ballAngle = 0;

    this.minionTimer = c.minionInterval * 0.5;

    this.updatePartPositions();
  }

  get isRolling() { return this.mode === 'roll' && this.roll && this.roll.state !== 'rest' && this.roll.state !== 'stun'; }
  get bodyCenterY() { return this.mode === 'roll' ? this.y - GOLEM_BALL.r : this.y - 50; }

  /** Parts the player can currently hit. */
  getTargets() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const list = [];
    if (this.phase === 1) list.push(this.head);
    for (const f of this.fists) if (!f.dead) list.push(f);
    list.push(this.body);
    return list;
  }

  /** Health bars for the HUD. */
  get bars() {
    return [
      { label: 'L.FIST', part: this.fists[0] },
      { label: 'HEAD', part: this.head, locked: this.phase === 2, lockedText: 'DETACHED' },
      { label: 'R.FIST', part: this.fists[1] },
      { label: 'BODY', part: this.body, locked: this.body.immune, lockedText: 'IMMUNE', wide: true },
    ];
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.body.flashTime -= dt;
    this.head.flashTime -= dt;

    if (this.intro > 0) {
      this.intro -= dt;
      world.shake(3, 0.1);
      if (Math.random() < 0.5) {
        world.effects.burst(this.x + rand(-60, 60), this.y + rand(-4, 8), { count: 2, colors: ['#5a4d78', '#3a354d', GOLEM_COLORS.clayD], speed: [40, 120], up: 60, gravity: 200 });
      }
      this.updatePartPositions();
      return;
    }
    if (this.dying > 0) return this.updateDeath(dt, world);

    const p = world.player;
    if (this.mode === 'walk') this.updateWalk(dt, world);
    if (this.mode === 'roll') this.updateRoll(dt, world);
    this.updatePartPositions(dt, world);

    if (this.phase === 1 && !this.isRollingMode) this.updateHeadPhase1(dt, world);
    if (this.phase === 2) this.updateHeadPhase2(dt, world);
    this.updateFists(dt, world);
    this.updateShockwaves(dt, world);
    this.updateMinions(dt, world);

    // body contact damage (phase 2) and keeping the player out of the body
    if (!p.dead) {
      const bx = this.x;
      const by = this.y - 18;
      const d = dist(p.x, p.y, bx, by);
      const solidR = this.mode === 'roll' ? 46 : 42;
      if (d < solidR + p.hw) {
        const a = angleTo(bx, by, p.x, p.y);
        const push = solidR + p.hw - d;
        world.dungeon.move(p, Math.cos(a) * push, Math.sin(a) * push);
        if (this.phase === 2 && !this.isRolling) p.hurt(this.cfg.bodyContactDamage, world, bx, by);
      }
    }
  }

  get isRollingMode() { return this.mode === 'roll'; }

  updatePartPositions(dt = 0, world = null) {
    this.body.x = this.x;
    this.body.y = this.bodyCenterY;
    if (this.phase === 1) {
      this.head.x = this.x;
      this.head.y = this.y - 104 + Math.sin(this.time * 2) * 2 - (this.stompRaise >= 0 ? this.stompLift : 0);
    } else if (world) {
      // floating head orbits the player at a distance
      const p = world.player;
      const b = world.dungeon.floorBounds;
      this.hover.angle += dt * 0.45;
      const tx = clamp(p.x + Math.cos(this.hover.angle) * 250, b.left + 50, b.right - 50);
      const ty = clamp(p.y - 30 + Math.sin(this.hover.angle) * 160, b.top + 30, b.bottom - 60);
      const k = Math.min(1, dt * 1.6);
      this.head.x = lerp(this.head.x, tx, k);
      this.head.y = lerp(this.head.y, ty, k);
    }
  }

  get stompLift() {
    return this.stompRaise >= 0 ? Math.sin(clamp(this.stompRaise / this.cfg.stompWindup, 0, 1) * Math.PI / 2) * 10 : 0;
  }

  // ---------- phase 1 head: bouncing fireballs ----------

  updateHeadPhase1(dt, world) {
    const c = this.cfg;
    const p = world.player;
    if (this.headCharge >= 0) {
      this.headCharge += dt;
      if (this.headCharge < c.headFireWindup - 0.25) this.headAim = angleTo(this.head.x, this.head.y, p.hx, p.hy);
      if (this.headCharge >= c.headFireWindup) {
        const spread = c.headFireSpreadDegrees * DEG;
        const n = c.headFireballs;
        for (let i = 0; i < n; i++) {
          const a = this.headAim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * 2);
          this.fireball(world, this.head.x, this.head.y + 10, a, c.fireball);
        }
        Sound.play('bossFireball');
        this.headCharge = -1;
        this.headTimer = c.headFireInterval;
      }
      return;
    }
    this.headTimer -= dt;
    if (this.headTimer <= 0) {
      this.headCharge = 0;
      Sound.play('laserCharge');
    }
  }

  fireball(world, x, y, angle, f) {
    world.enemyProjectiles.push(new Projectile({
      x, y,
      vx: Math.cos(angle) * f.speed,
      vy: Math.sin(angle) * f.speed,
      radius: f.radius, damage: f.damage, life: f.life, bounces: f.bounces, friendly: false,
      sprite: Sprites.projectiles.golemFireball, spin: 6, glow: '255, 90, 30', trail: ['#ff5a1e', '#ffd34a'],
    }));
  }

  // ---------- phase 2 head: lasers + bursts ----------

  updateHeadPhase2(dt, world) {
    const c = this.cfg;
    const p = world.player;
    const h = this.head;

    // big fireball burst (lasers pause while charging)
    if (this.burstCharge >= 0) {
      this.burstCharge += dt;
      if (Math.random() < 0.6) {
        const a = rand(0, TAU);
        world.effects.burst(h.x + Math.cos(a) * 50, h.y + Math.sin(a) * 50, { count: 1, colors: ['#ffd34a', '#ff7a1a'], speed: [0, 0], life: [0.2, 0.3], size: [3, 4] });
        const last = world.effects.particles[world.effects.particles.length - 1];
        last.vx = -Math.cos(a) * 200;
        last.vy = -Math.sin(a) * 200;
        last.drag = 0;
      }
      if (this.burstCharge >= c.burstWindup) {
        const offset = rand(0, TAU);
        for (let i = 0; i < c.burstCount; i++) {
          this.fireball(world, h.x, h.y, offset + (i / c.burstCount) * TAU, c.burstFireball);
        }
        world.shake(8, 0.3);
        Sound.play('explosion');
        Sound.play('bossFireball');
        this.burstCharge = -1;
        this.burstTimer = c.burstInterval;
        this.laserTimer = 0.8;
      }
      return;
    }
    this.burstTimer -= dt;
    if (this.burstTimer <= 0 && !this.laser) {
      this.burstCharge = 0;
      Sound.play('burstCharge');
      return;
    }

    // lasers
    if (this.laser) {
      const L = this.laser;
      L.t += dt;
      if (L.t < c.laserWindup - c.laserAimLockAt) L.angle = angleTo(h.x, h.y, p.hx, p.hy);
      L.end = world.dungeon.raycast(h.x, h.y, L.angle);
      if (!L.fired && L.t >= c.laserWindup) {
        L.fired = true;
        Sound.play('laser');
        world.shake(2, 0.1);
        if (!p.dead && pointSegmentDistance(p.hx, p.hy, h.x, h.y, L.end.x, L.end.y) < c.laserWidth / 2 + p.radius) {
          p.hurt(c.laserDamage, world, h.x, h.y);
        }
        world.effects.burst(L.end.x, L.end.y, { count: 8, colors: ['#ff4a3a', '#ffd0c0'], speed: [40, 140], life: [0.15, 0.3] });
      }
      if (L.t >= c.laserWindup + c.laserDuration) {
        this.laser = null;
        this.laserTimer = Math.max(0.05, c.laserInterval - c.laserWindup - c.laserDuration);
      }
      return;
    }
    this.laserTimer -= dt;
    if (this.laserTimer <= 0) {
      this.laser = { t: 0, angle: angleTo(h.x, h.y, p.hx, p.hy), fired: false, end: { x: h.x, y: h.y } };
      Sound.play('laserCharge', 0.2);
    }
  }

  // ---------- fists ----------

  updateFists(dt, world) {
    for (const f of this.fists) if (!f.dead) f.update(dt, world);
    if (this.mode !== 'stand') return;
    this.fistTimer -= dt;
    if (this.fistTimer > 0) return;
    for (let i = 0; i < 2; i++) {
      const f = this.fists[(this.nextFist + i) % 2];
      if (!f.dead && f.state === 'rest') {
        f.startPunch();
        this.nextFist = (this.fists.indexOf(f) + 1) % 2;
        this.fistTimer = this.cfg.fistInterval;
        return;
      }
    }
  }

  // ---------- walking + stomping ----------

  updateWalk(dt, world) {
    const c = this.cfg;
    const p = world.player;
    this.walkTime += dt;

    if (this.stompRaise >= 0) {
      this.stompRaise += dt;
      if (this.stompRaise >= c.stompWindup) {
        this.stompRaise = -1;
        this.shockwaves.push({ x: this.x, y: this.y, r: 20, hit: false });
        world.shake(7, 0.3);
        Sound.play('stomp');
        world.effects.burst(this.x, this.y, { count: 24, colors: ['#6a6080', '#3a354d', GOLEM_COLORS.clayD], speed: [80, 220], life: [0.3, 0.6], size: [3, 5] });
      }
    } else {
      if (!p.dead) {
        const a = angleTo(this.x, this.y, p.x, p.y);
        world.dungeon.move(this, Math.cos(a) * c.walkSpeed * dt, Math.sin(a) * c.walkSpeed * dt);
        this.facing = Math.cos(a) >= 0 ? 1 : -1;
      }
      this.stompTimer -= dt;
      if (this.stompTimer <= 0) {
        this.stompTimer = c.stompInterval;
        this.stompRaise = 0;
      }
    }

    if (this.walkTime >= c.rollAfter) this.startRolling(world);
  }

  updateShockwaves(dt, world) {
    const c = this.cfg;
    const p = world.player;
    for (const s of this.shockwaves) {
      s.r += c.shockwaveSpeed * dt;
      if (s.r >= c.shockwaveRadius) s.dead = true;
      if (!s.hit && !p.dead && !p.isInvulnerable && Math.abs(dist(p.x, p.y, s.x, s.y) - s.r) < 16) {
        s.hit = true;
        p.slowTime = c.slowDuration;
        world.effects.text(p.hx, p.hy - 28, 'SLOWED', { color: '#d8b070', size: 7 });
      }
    }
    removeDead(this.shockwaves);
  }

  // ---------- clay minions ----------

  updateMinions(dt, world) {
    const c = this.cfg;
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return;
    this.minionTimer = c.minionInterval;
    const alive = world.enemies.filter((e) => e.type === 'clayMinion').length;
    const n = Math.min(c.minionCount, c.minionMax - alive);
    const b = world.dungeon.floorBounds;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const x = clamp(this.x + Math.cos(a) * 100, b.left + 30, b.right - 30);
      const y = clamp(this.y + 20 + Math.sin(a) * 70, b.top + 30, b.bottom - 30);
      world.spawnEnemy('clayMinion', x, y);
    }
  }

  // ---------- rolling ----------

  startRolling(world) {
    this.mode = 'roll';
    this.stompRaise = -1;
    if (this.phase === 1) this.enterPhase2(world); // the head can't stay on a rolling ball
    this.roll = { state: 'curl', t: 0, angle: 0, hit: false };
    world.banner('IT CURLS INTO A BALL!', 'Dodge the roll');
    Sound.play('bossRoar');
  }

  updateRoll(dt, world) {
    const c = this.cfg;
    const p = world.player;
    const R = this.roll;
    R.t += dt;
    switch (R.state) {
      case 'curl':
        if (R.t < c.rollWindup - c.rollAimLockAt) R.angle = angleTo(this.x, this.y, p.x, p.y);
        R.end = world.dungeon.raycast(this.x, this.y - GOLEM_BALL.r, R.angle);
        if (R.t >= c.rollWindup) {
          R.state = 'rolling';
          R.t = 0;
          R.hit = false;
          Sound.play('roll');
        }
        break;
      case 'rolling': {
        const step = c.rollSpeed * dt;
        const hit = world.dungeon.move(this, Math.cos(R.angle) * step, Math.sin(R.angle) * step);
        this.ballAngle += (step / GOLEM_BALL.r) * (Math.cos(R.angle) >= 0 ? 1 : -1);
        if (Math.random() < 0.7) {
          world.effects.burst(this.x, this.y, { count: 1, colors: ['#6a6080', GOLEM_COLORS.clayD], speed: [20, 60], life: [0.3, 0.5], size: [3, 5] });
        }
        if (!R.hit && !p.dead && dist(this.x, this.bodyCenterY, p.hx, p.hy) < GOLEM_BALL.r + p.radius - 6) {
          R.hit = p.hurt(c.rollDamage, world, this.x, this.bodyCenterY);
        }
        if (hit.hitX || hit.hitY || R.t >= c.rollMaxTime) {
          this.rollCount++;
          world.shake(hit.hitX || hit.hitY ? 10 : 4, 0.35);
          Sound.play('impact');
          world.effects.burst(this.x, this.bodyCenterY, { count: 20, colors: ['#5a4d78', '#3a354d', GOLEM_COLORS.clay], speed: [60, 200], life: [0.3, 0.6], size: [3, 5] });
          const rest = this.rollCount % c.rollsBeforeRest === 0;
          R.state = rest ? 'rest' : 'stun';
          R.t = 0;
        }
        break;
      }
      case 'stun':
      case 'rest': {
        const wait = R.state === 'rest' ? c.rollRest : c.rollStun;
        if (R.t >= wait) { R.state = 'curl'; R.t = 0; }
        break;
      }
    }
  }

  // ---------------------------------------------------------
  //  EVENTS
  // ---------------------------------------------------------

  onPartDestroyed(part, world) {
    world.effects.burst(part.x, part.y, { count: 40, colors: [GOLEM_COLORS.clay, GOLEM_COLORS.clayD, GOLEM_COLORS.clayL, GOLEM_COLORS.glow], speed: [80, 260], life: [0.4, 0.9], size: [3, 6] });
    world.shake(10, 0.5);
    Sound.play('partBreak');

    if (part === this.head) {
      this.enterPhase2(world);
    } else if (part === this.body) {
      this.dying = 3;
      this.laser = null;
      // its minions crumble with it
      for (const e of world.enemies) if (e.type === 'clayMinion' && !e.dead) e.die(world);
      Sound.play('bossRoar');
      world.banner('THE GOLEM CRUMBLES!', '');
    } else if (this.fists.every((f) => f.dead) && this.mode === 'stand') {
      this.mode = 'walk';
      this.walkTime = 0;
      world.banner('IT LUMBERS TOWARD YOU!', 'Stomps slow you down');
      Sound.play('bossRoar');
    }
  }

  enterPhase2(world) {
    if (this.phase === 2) return;
    this.phase = 2;
    this.headCharge = -1;
    this.head.hp = 0;
    this.body.immune = false;
    this.laserTimer = 1.5;
    world.banner('THE HEAD BREAKS FREE!', 'Attack the body!');
    Sound.play('bossRoar');
    world.shake(10, 0.8);
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.flashBody = (this.flashBody || 0) - dt;
    if (this.flashBody <= 0) {
      this.flashBody = 0.18;
      this.body.flashTime = 0.08;
      const ex = this.x + rand(-50, 50);
      const ey = this.bodyCenterY + rand(-40, 40);
      world.effects.burst(ex, ey, { count: 14, colors: [GOLEM_COLORS.clay, GOLEM_COLORS.clayL, GOLEM_COLORS.glow, '#ffffff'], speed: [60, 200], life: [0.3, 0.7], size: [3, 6] });
      world.shake(6, 0.2);
      Sound.play('explosion', 0.1);
    }
    // the floating head drifts back down
    this.head.x = lerp(this.head.x, this.x, Math.min(1, dt * 2));
    this.head.y = lerp(this.head.y, this.y - 40, Math.min(1, dt * 2));
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.x, this.bodyCenterY, { count: 80, colors: [GOLEM_COLORS.clay, GOLEM_COLORS.clayD, GOLEM_COLORS.clayL, GOLEM_COLORS.glow], speed: [100, 340], life: [0.6, 1.4], size: [3, 7] });
      world.shake(14, 0.8);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  drawGround(ctx) {
    if (this.dead) return;
    const lift = this.mode === 'roll' ? 0 : this.stompLift;
    drawShadow(ctx, this.x, this.y + 4, 60 - lift, 16, 0.4);
    for (const f of this.fists) {
      if (!f.dead) drawShadow(ctx, f.x, f.y + 26, 18, 6, 0.3);
    }
    if (this.phase === 2) drawShadow(ctx, this.head.x, this.head.y + 60, 22, 7, 0.25);

    // shockwaves (slow, no damage) in orange
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = 'rgba(216, 176, 112, 0.8)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (this.dying > 0 || this.intro > 0) return;

    if (this.stompRaise >= 0) {
      Telegraph.circle(ctx, this.x, this.y, this.cfg.shockwaveRadius, this.stompRaise / this.cfg.stompWindup, Telegraph.orange);
    }
    for (const f of this.fists) f.drawTelegraph(ctx);
    if (this.headCharge >= 0) {
      const spread = this.cfg.headFireSpreadDegrees * DEG;
      const n = this.cfg.headFireballs;
      for (let i = 0; i < n; i++) {
        const a = this.headAim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * 2);
        Telegraph.line(ctx, this.head.x, this.head.y + 10, this.head.x + Math.cos(a) * 160, this.head.y + 10 + Math.sin(a) * 160, 10, this.headCharge / this.cfg.headFireWindup, Telegraph.orange);
      }
    }
    if (this.mode === 'roll' && this.roll.state === 'curl' && this.roll.end) {
      Telegraph.line(ctx, this.x, this.y - GOLEM_BALL.r, this.roll.end.x, this.roll.end.y, GOLEM_BALL.r * 2, this.roll.t / this.cfg.rollWindup);
    }
    if (this.burstCharge >= 0) {
      Telegraph.circle(ctx, this.head.x, this.head.y, 60, this.burstCharge / this.cfg.burstWindup, Telegraph.orange);
    }
  }

  /** Items for y-sorted drawing: [{ y, draw(ctx) }]. */
  getDrawables() {
    if (this.dead) return [];
    const items = [{ y: this.y, draw: (ctx) => this.drawBody(ctx) }];
    for (const f of this.fists) {
      if (!f.dead && this.intro <= 0) items.push({ y: f.y + 24, draw: (ctx) => f.draw(ctx) });
    }
    if (this.mode !== 'roll' || this.phase === 2) {
      items.push({ y: this.phase === 1 ? this.y + 1 : this.head.y + 80, draw: (ctx) => this.drawHead(ctx) });
    }
    return items;
  }

  drawBody(ctx) {
    const S = Sprites.golem;
    ctx.save();
    if (this.intro > 0) {
      // rise out of the floor
      const t = 1 - this.intro / 2.6;
      ctx.beginPath();
      ctx.rect(this.x - 100, this.y - 300, 200, 300 + 10);
      ctx.clip();
      ctx.translate(rand(-2, 2), (1 - t) * 130);
    }
    if (this.mode === 'roll') {
      const shake = this.roll.state === 'curl' ? rand(-2, 2) : 0;
      drawRotated(ctx, S.ball.img, this.x + shake, this.y - GOLEM_BALL.r, GOLEM_BALL.size / 2, GOLEM_BALL.size / 2, this.ballAngle);
      if (this.body.flashTime > 0) drawRotated(ctx, S.ball.flash, this.x, this.y - GOLEM_BALL.r, GOLEM_BALL.size / 2, GOLEM_BALL.size / 2, this.ballAngle);
      if (this.roll.state === 'rest') this.drawDizzy(ctx, this.x, this.y - GOLEM_BALL.r * 2 - 6);
    } else {
      const walking = this.mode === 'walk' && this.stompRaise < 0;
      const frame = walking ? S.body.walk[Math.floor(this.time * 4) % 4] : S.body.idle[0];
      const lift = this.stompLift;
      drawSprite(ctx, frame.img, this.x, this.y - lift, GOLEM_BODY.ax, GOLEM_BODY.ay);
      if (this.body.flashTime > 0) drawSprite(ctx, frame.flash, this.x, this.y - lift, GOLEM_BODY.ax, GOLEM_BODY.ay, false, 0.8);
      // pulsing chest glow; brighter once the body is vulnerable
      ctx.globalCompositeOperation = 'lighter';
      const g = this.body.immune ? 0.15 : 0.35 + Math.sin(this.time * 6) * 0.15;
      const gr = ctx.createRadialGradient(this.x, this.y - 46 - lift, 2, this.x, this.y - 46 - lift, 30);
      gr.addColorStop(0, `rgba(255, 180, 60, ${g})`);
      gr.addColorStop(1, 'rgba(255, 120, 30, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(this.x - 30, this.y - 76 - lift, 60, 60);
    }
    ctx.restore();
  }

  drawHead(ctx) {
    const S = Sprites.golem;
    const h = this.head;
    const charging = this.headCharge >= 0 || this.burstCharge >= 0 || (this.laser && !this.laser.fired);
    const frame = charging || this.phase === 2 ? S.headAngry : S.head;
    const shake = this.burstCharge >= 0 ? rand(-2, 2) : 0;
    ctx.save();
    if (this.intro > 0) {
      const t = 1 - this.intro / 2.6;
      ctx.beginPath();
      ctx.rect(this.x - 100, this.y - 300, 200, 300);
      ctx.clip();
      ctx.translate(0, (1 - t) * 130);
    }
    if (this.phase === 2) {
      ctx.globalCompositeOperation = 'lighter';
      const r = 50 + Math.sin(this.time * 5) * 5;
      const gr = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, r);
      gr.addColorStop(0, 'rgba(255, 90, 40, 0.45)');
      gr.addColorStop(1, 'rgba(255, 60, 20, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(h.x - r, h.y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawSprite(ctx, frame.img, h.x + shake, h.y, GOLEM_HEAD.ax, GOLEM_HEAD.ay);
    if (h.flashTime > 0) drawSprite(ctx, frame.flash, h.x, h.y, GOLEM_HEAD.ax, GOLEM_HEAD.ay, false, 0.8);
    ctx.restore();
  }

  drawDizzy(ctx, x, y) {
    for (let i = 0; i < 3; i++) {
      const a = this.time * 4 + (i * TAU) / 3;
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(Math.round(x + Math.cos(a) * 22) - 2, Math.round(y + Math.sin(a) * 6) - 2, 4, 4);
    }
  }

  /** Lasers are drawn above everything else. */
  drawOverlay(ctx) {
    const L = this.laser;
    if (!L || this.dying > 0) return;
    const h = this.head;
    const c = this.cfg;
    ctx.save();
    if (!L.fired) {
      const t = L.t / c.laserWindup;
      ctx.strokeStyle = `rgba(255, 60, 60, ${0.3 + 0.5 * t})`;
      ctx.lineWidth = 1 + t * 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(L.end.x, L.end.y);
      ctx.stroke();
    } else {
      const t = (L.t - c.laserWindup) / c.laserDuration;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255, 60, 40, ${0.7 * (1 - t)})`;
      ctx.lineWidth = c.laserWidth * 1.6;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(L.end.x, L.end.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 240, 220, ${1 - t})`;
      ctx.lineWidth = c.laserWidth * 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}
