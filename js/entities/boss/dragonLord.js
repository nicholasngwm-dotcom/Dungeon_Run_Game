// =============================================================
//  THE BLAZING DRAGON LORD (the Fiery Fortress's deeper boss, stage 2 or 3)
//
//  A great crimson dragon (see buildDragonLordSprites) whose arena is a fenced platform over a moat of lava,
//  his perch - a squat tower - in its middle (see DragonArena). He takes turns (CONFIG.dragonLord):
//    flying:  he circles out over the moat, out of reach (he can't be hurt), hurling giant lava meteors at the
//             heroes; each crashes where its circle grew and leaves the ground burning. In phase 2 he calls his
//             baby dragons too, and they fly in over the lava.
//    perched: he lands on his tower and can be hit anywhere on it. He roars, and fireballs rain down all over
//             the platform (in phase 2, round every hero); on a long perch he roars again. In phase 2 a hero
//             coming close sets off his dragon's breath: a stream of fire that sears in rapid ticks and sets
//             them alight.
//  Below phase2At of his health: faster meteors, longer perches with up to three roars, the brood, the breath.
//  (x, y) is the ground under him; z how high he is above it (perched: on the tower's top).
// =============================================================

// his entrance: he swoops down out of the sky onto his tower (land), then rears up and roars (roar)
const DRAGON_INTRO = { land: 2.4, roar: 2.8, total: 4.2 };
const DRAGON_FLY_LIFT = 52;   // px the middle of his body sits above his feet (flying poses are anchored there)

class BlazingDragonLord {
  constructor(x, y) {
    const c = CONFIG.dragonLord;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.tower = { x, y };   // the foot of his tower
    this.z = 420;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.time = 0;
    this.phase = 1;
    this.intro = DRAGON_INTRO.total;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = 1;
    this.state = 'intro';    // intro | takeoff | fly | land | perch
    this.t = 0;
    this.flap = 0;           // where his wings are in their beat (frames)
    this.spit = 0;           // s left of his jaws open after hurling a meteor
    this.theta = 0;          // flying: where he is round the platform, and which way he circles
    this.spin = 1;
    this.roar = null;        // perched: { t, rained } while he roars
    this.breath = null;      // perched (phase 2): { t, aim, tick } while he breathes fire
    this.breathCd = 0;
    this.babiesCalled = false;
  }

  get name() { return 'THE BLAZING DRAGON LORD'; }
  get title() { return 'Tyrant of the Burning Sky'; }
  get defeatText() { return 'The Dragon Lord falls from his tower, his fire spent.'; }

  get perched() { return this.state === 'perch' && this.intro <= 0; }
  get targetable() { return this.perched && this.dying <= 0 && !this.dead; }
  get radius() { return this.cfg.hitRadius; }
  get hx() { return this.x; }
  /** Perched, his hit point is low on him (the tower's top), so heroes at its foot can reach him. */
  get hy() { return this.perched || this.dying > 0 ? this.tower.y - 70 : this.y - this.z - DRAGON_FLY_LIFT; }
  get drawY() { return this.y; }

  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const marker = this.phase === 1 ? this.cfg.phase2At : undefined;
    if (this.perched) return [{ part: this, x: this.x, y: this.tower.y - this.cfg.perchHeight - 186, w: 120, color: '#ff6a2a', marker }];
    return [{ part: this, x: this.x, y: this.y - this.z - DRAGON_FLY_LIFT - 100, w: 120, color: '#ff6a2a', marker, locked: true, lockedText: 'IN THE SKY' }];
  }

  knockback() {}
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
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.enrage(world);
    return true;
  }

  /** Below half health: he roars in fury, and from now on calls his brood and breathes fire. */
  enrage(world) {
    this.phase = 2;
    world.banner('THE DRAGON LORD IS ENRAGED!', 'His brood answers - and keep clear of his breath');
    world.shake(8, 0.5);
    Sound.play('dragonRoar');
    if (!this.roar && !this.breath) this.roar = { t: 0, rained: true };   // a roar of fury (no rain)
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.t += dt;
    this.flashTime -= dt;
    this.spit = Math.max(0, this.spit - dt);
    this.ring ??= this.findRing(world);
    if (this.intro > 0) return this.updateIntro(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    switch (this.state) {
      case 'takeoff': this.updateTakeoff(dt, world); break;
      case 'fly': this.updateFly(dt, world); break;
      case 'land': this.updateLand(dt, world); break;
      case 'perch': this.updatePerch(dt, world); break;
    }
  }

  /** The path he circles: an ellipse out over the moat round his platform. */
  findRing(world) {
    const A = world.run?.dragonArena;
    const T = CONFIG.tileSize;
    if (A) {
      const r = A.room;
      return { cx: r.cx, cy: r.cy, rx: ((r.x1 - r.x0 + 1) / 2 - 1.5) * T, ry: ((r.y1 - r.y0 + 1) / 2 - 1.4) * T };
    }
    const b = world.dungeon.floorBounds;
    return { cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2, rx: (b.right - b.left) / 2 - 30, ry: (b.bottom - b.top) / 2 - 30 };
  }

  /** The platform he rains fire on (the arena's, or the room's). */
  platform(world) {
    const A = world.run?.dragonArena;
    if (A) return A.platform;
    const b = world.dungeon.floorBounds;
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  }

  ringPoint(theta) {
    const R = this.ring;
    return { x: R.cx + Math.cos(theta) * R.rx, y: R.cy + Math.sin(theta) * R.ry };
  }

  /** Living heroes he can pick on. */
  heroesAlive(world) { return world.heroes.filter((p) => !p.dead); }

  /** His entrance: down out of the sky in a long swoop onto his tower, then he rears up and roars. */
  updateIntro(dt, world) {
    this.intro -= dt;
    const at = DRAGON_INTRO.total - this.intro;
    const { cx, cy } = this.ring;
    const P = this.cfg.perchHeight;
    this.flap += dt * 9;
    if (at < DRAGON_INTRO.land) {
      // a curve from high off to the left, round over the right, down onto the tower
      const k = at / DRAGON_INTRO.land;
      const e = 1 - (1 - k) ** 2;
      const q = (a, b, c) => (1 - e) ** 2 * a + 2 * (1 - e) * e * b + e * e * c;
      const nx = q(cx - 560, cx + 420, this.tower.x);
      this.facing = nx >= this.x ? 1 : -1;
      this.x = nx;
      this.y = q(cy - 220, cy - 140, this.tower.y);
      this.z = q(420, 280, P);
      if (k > 0.2 && vrand(0, 1) < dt * 2) Sound.play('wingBeat', 0.3);
    } else {
      this.x = this.tower.x;
      this.y = this.tower.y;
      this.z = P;
      if (!this.landed) {
        this.landed = true;
        this.thump(world);
      }
      if (at >= DRAGON_INTRO.roar && !this.roared) {
        this.roared = true;
        Sound.play('dragonRoar');
        Sound.play('bossRoar');
        world.shake(10, 0.8);
      }
    }
    if (this.intro <= 0) this.startTakeoff(world);
  }

  /** Landing on his tower: dust, a shudder through the floor. */
  thump(world) {
    const t = this.tower;
    world.effects.smoke(t.x, t.y - this.cfg.perchHeight, { count: 10, radius: 50, life: 0.9, rise: 20, colors: ['#2a1a18', '#4a3430', '#6a5048'] });
    world.effects.burst(t.x, t.y - this.cfg.perchHeight, { count: 16, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [60, 180], life: [0.3, 0.7], up: 80, gravity: 400 });
    world.shake(7, 0.35);
    Sound.play('stomp');
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** Up off his tower and out to the ring he circles. */
  startTakeoff(world) {
    this.roar = null;
    this.breath = null;
    this.spin = Math.random() < 0.5 ? 1 : -1;
    this.theta = rand(0, TAU);
    this.from = { x: this.x, y: this.y, z: this.z };
    this.setState('takeoff');
    Sound.play('wingBeat');
  }

  updateTakeoff(dt, world) {
    const F = this.cfg.fly;
    this.flap += dt * 11;
    const k = Math.min(1, this.t / F.takeoff);
    const e = k * k * (3 - 2 * k);
    this.theta += this.spin * F.spin * dt * k;
    const to = this.ringPoint(this.theta);
    const nx = lerp(this.from.x, to.x, e);
    if (Math.abs(nx - this.x) > 0.2) this.facing = nx > this.x ? 1 : -1;
    this.x = nx;
    this.y = lerp(this.from.y, to.y, e);
    this.z = lerp(this.from.z, F.height, Math.sqrt(k));
    if (k >= 1) {
      this.setState('fly');
      this.meteorIn = 0.7;
      this.babiesCalled = false;
    }
  }

  /** Circling out over the lava, untouchable, hurling meteors (and in phase 2 calling his brood). */
  updateFly(dt, world) {
    const c = this.cfg;
    const F = c.fly;
    const ph = this.phase - 1;
    const beat = Math.floor(this.flap / 6);
    this.flap += dt * 7;
    if (Math.floor(this.flap / 6) !== beat) Sound.play('wingBeat', 0.3);
    this.theta += this.spin * F.spin * dt;
    const pt = this.ringPoint(this.theta);
    if (Math.abs(pt.x - this.x) > 0.2) this.facing = pt.x > this.x ? 1 : -1;
    this.x = pt.x;
    this.y = pt.y;
    this.z = F.height + Math.sin(this.time * 1.7) * 8;
    this.meteorIn -= dt;
    if (this.meteorIn <= 0) {
      this.meteorIn = c.meteor.every[ph];
      this.hurlMeteor(world);
    }
    if (this.phase === 2 && !this.babiesCalled && this.t >= c.babies.at) {
      this.babiesCalled = true;
      this.callBrood(world);
    }
    if (this.t >= F.time[ph]) {
      this.from = { x: this.x, y: this.y, z: this.z };
      this.setState('land');
    }
  }

  /** Back down onto his tower. */
  updateLand(dt, world) {
    const F = this.cfg.fly;
    this.flap += dt * 10;
    const k = Math.min(1, this.t / F.land);
    const e = 1 - (1 - k) ** 3;
    const nx = lerp(this.from.x, this.tower.x, e);
    if (Math.abs(nx - this.x) > 0.3) this.facing = nx > this.x ? 1 : -1;
    this.x = nx;
    this.y = lerp(this.from.y, this.tower.y, e);
    this.z = lerp(this.from.z, this.cfg.perchHeight, e) + Math.sin(k * Math.PI) * 30;
    if (k >= 1) {
      this.x = this.tower.x;
      this.y = this.tower.y;
      this.z = this.cfg.perchHeight;
      this.thump(world);
      const P = this.cfg.perch;
      const ph = this.phase - 1;
      this.perchFor = rand(...P.time[ph]);
      this.roars = P.roars[ph].slice();
      this.breathCd = 1;
      this.setState('perch');
    }
  }

  /** On his tower: he can be hurt; he roars down fire, and in phase 2 breathes it on whoever comes close. */
  updatePerch(dt, world) {
    const c = this.cfg;
    const P = c.perch;
    this.flap += dt * 2;
    this.breathCd -= dt;
    const near = this.nearestHero(world);
    if (!this.breath && near) this.facing = near.x >= this.x ? 1 : -1;
    if (this.roar) {
      this.roar.t += dt;
      if (!this.roar.rained && this.roar.t >= P.rainAt) {
        this.roar.rained = true;
        this.rainFire(world);
      }
      if (this.roar.t >= P.roarTime) this.roar = null;
    } else if (this.breath) {
      this.updateBreath(dt, world);
    } else if (this.roars.length && this.t >= this.roars[0]) {
      this.roars.shift();
      // (only with time left in the perch for it)
      if (this.perchFor - this.t >= P.roarLeft) {
        this.roar = { t: 0, rained: false };
        world.shake(7, 0.6);
        Sound.play('dragonRoar');
      }
    } else if (this.phase === 2 && this.breathCd <= 0 && near && dist(near.x, near.y, this.tower.x, this.tower.y) < c.breath.trigger) {
      this.breath = { t: 0, aim: angleTo(this.tower.x, this.tower.y, near.x, near.y), tick: 0, target: near };
      this.facing = near.x >= this.x ? 1 : -1;
      Sound.play('fireballCast');
    } else if (this.t >= this.perchFor) {
      this.startTakeoff(world);
    }
  }

  nearestHero(world) {
    let best = null;
    let bd = Infinity;
    for (const p of this.heroesAlive(world)) {
      const d = dist(p.x, p.y, this.tower.x, this.tower.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Where his breath starts on the ground: the tower's foot on the side he faces, a little forward. */
  breathOrigin() {
    const a = this.breath ? this.breath.aim : 0;
    return { x: this.tower.x + Math.cos(a) * 40, y: this.tower.y - 6 + Math.sin(a) * 24 };
  }

  /** His dragon's breath: a moment drawing in, then a stream of fire swinging after its target. */
  updateBreath(dt, world) {
    const B = this.cfg.breath;
    const br = this.breath;
    br.t += dt;
    const p = br.target && !br.target.dead ? br.target : this.nearestHero(world);
    if (p) {
      const want = angleTo(this.tower.x, this.tower.y, p.x, p.y);
      br.aim += clamp(angleDiff(br.aim, want), -B.turn * dt, B.turn * dt);
      this.facing = Math.cos(br.aim) >= 0 ? 1 : -1;
    }
    if (br.t < B.windup) return;
    if (!br.roaring) { br.roaring = true; Sound.play('dragonBreath'); }
    br.tick -= dt;
    if (br.tick <= 0) {
      br.tick = B.every;
      const o = this.breathOrigin();
      for (const a of world.allies) {
        if (a.dead) continue;
        const d = dist(o.x, o.y, a.x, a.y);
        if (d > B.range + a.radius || Math.abs(angleDiff(br.aim, angleTo(o.x, o.y, a.x, a.y))) > B.cone + a.radius / Math.max(40, d)) continue;
        // rapid little sears (they don't wait on a hero's moment of safety after a hit), and it sets them alight
        if (a.scorch) a.scorch(B.damage / B.every, B.every * 2, world, B.every);
        else a.hurt?.(B.damage, world, o.x, o.y);
        setAlight(world, a, B);
      }
      if (vrand(0, 1) < 0.5) Sound.play('fireImpact', 0.25);
    }
    if (br.t >= B.windup + B.time) {
      this.breath = null;
      this.breathCd = B.cooldown;
    }
  }

  // ---------- his attacks ----------

  /** Where his mouth is on screen, in the frame he's showing. */
  mouth() {
    const fr = this.frame();
    const m = fr.mouth;
    const base = this.anchorY();
    return { x: this.x + m.x * this.facing, y: base + m.y };
  }

  /** A giant lava meteor hurled at a hero: it arcs down onto where its circle grows, crashes and leaves the ground burning. */
  hurlMeteor(world) {
    const M = this.cfg.meteor;
    const heroes = this.heroesAlive(world);
    if (!heroes.length) return;
    const p = choose(heroes);
    const pl = this.platform(world);
    const at = { x: clamp(p.x + rand(-28, 28), pl.left + 16, pl.right - 16), y: clamp(p.y + rand(-18, 18), pl.top + 16, pl.bottom - 12) };
    const from = this.mouth();
    const flight = M.flight;
    this.spit = 0.35;
    const img = Sprites.projectiles.meteor;
    world.effects.add(flight, (ctx, t) => {
      Telegraph.circle(ctx, at.x, at.y, M.radius, t, '255, 50, 30');
      drawShadow(ctx, at.x, at.y, 10 + t * M.radius * 0.6, 4 + t * M.radius * 0.3, 0.2 + t * 0.3);
    }, true);
    const seed = vrand(0, 10);
    world.effects.add(flight, (ctx, t) => {
      // lobbed high out of his jaws, trailing fire, tumbling
      const x = lerp(from.x, at.x, t);
      const y = lerp(from.y, at.y, t) - Math.sin(t * Math.PI) * 110;
      const vx = at.x - from.x;
      const vy = at.y - from.y - Math.cos(t * Math.PI) * 110 * Math.PI;
      const back = Math.atan2(-vy, -vx);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, 44, FORT_LAVA, 0.75);
      ctx.restore();
      for (let i = 1; i < 6; i++) {
        PFX.flame(ctx, x + Math.cos(back) * i * 11, y + Math.sin(back) * i * 11 + 10, 26 - i * 3.5, 30 - i * 3, t * 22 + i + seed, FORT_FIRE);
      }
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(t * 9 + seed);
      ctx.scale(1.9, 1.9);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    });
    const stage = world.run ? world.run.stage : 0;
    world.after(flight, () => {
      if ((world.run && world.run.stage !== stage) || world.boss !== this) return;
      for (const a of world.allies) {
        if (dist(a.x, a.y, at.x, at.y) >= M.radius + a.radius) continue;
        if (a.hurt(M.damage, world, at.x, at.y)) {
          setAlight(world, a, M);
          a.knockback?.(angleTo(at.x, at.y, a.x, a.y), 240);
        }
      }
      firePatch(world, at.x, at.y, M.fireRadius, M.fireTime, M);
      enemyBlastFx(world, at.x, at.y, M.radius);
      world.effects.burst(at.x, at.y - 8, { count: 26, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [90, 280], life: [0.4, 0.8], gravity: 360, up: 140, size: [2, 6] });
      world.shake(7, 0.3);
    });
    Sound.play('bossFireball');
  }

  /** His roar calls fire down out of the sky: all over the platform, or (phase 2) round every hero. */
  rainFire(world) {
    const R = this.cfg.rain;
    const pl = this.platform(world);
    const T = this.tower;
    const spots = [];
    const free = (x, y) => dist(x, y, T.x, T.y - 16) > 56;
    const wild = (n) => {
      for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
        const x = rand(pl.left + 18, pl.right - 18);
        const y = rand(pl.top + 18, pl.bottom - 12);
        if (free(x, y)) { spots.push({ x, y }); i++; }
      }
    };
    if (this.phase === 1) wild(R.count);
    else {
      for (const p of this.heroesAlive(world)) {
        for (let i = 0; i < R.near; i++) {
          const a = rand(0, TAU);
          const d = i === 0 ? 0 : rand(20, R.spread);
          spots.push({ x: clamp(p.x + Math.cos(a) * d, pl.left + 14, pl.right - 14), y: clamp(p.y + Math.sin(a) * d * 0.7, pl.top + 14, pl.bottom - 10) });
        }
      }
      wild(R.wild);
    }
    const stage = world.run ? world.run.stage : 0;
    spots.forEach((s, i) => {
      world.after((i / spots.length) * R.over, () => {
        if ((world.run && world.run.stage !== stage) || world.boss !== this) return;
        this.dropFireball(world, s.x, s.y);
      });
    });
  }

  /** One fireball of the rain: its circle grows as it falls, it bursts where it lands, setting heroes alight. */
  dropFireball(world, x, y) {
    const R = this.cfg.rain;
    const img = Sprites.projectiles.fireballBig;
    const side = vrand(-1, 1) * 60;
    world.effects.add(R.fall, (ctx, t) => Telegraph.circle(ctx, x, y, R.radius, t, '255, 50, 30'), true);
    world.effects.add(R.fall, (ctx, t) => {
      const k = t * t;
      const fx = x + (1 - k) * side;
      const fy = y - 6 - (1 - k) * 420;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, fx, fy, 24, FORT_LAVA, 0.6 * t + 0.2);
      ctx.restore();
      for (let i = 1; i < 4; i++) PFX.flame(ctx, fx + side * 0.06 * i, fy - i * 14, 12 - i * 2, 18 - i * 2, t * 20 + i, FORT_FIRE);
      drawRotated(ctx, img, fx, fy, img.width / 2, img.height / 2, t * 8);
    });
    const stage = world.run ? world.run.stage : 0;
    world.after(R.fall, () => {
      if (world.run && world.run.stage !== stage) return;
      for (const a of world.allies) {
        if (dist(a.x, a.y, x, y) >= R.radius + a.radius) continue;
        if (a.hurt(R.damage, world, x, y)) setAlight(world, a, R);
      }
      world.effects.add(0.4, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 1 - t;
        PFX.ring(ctx, x, y, R.radius * (0.5 + t * 0.6), R.radius * 0.55 * (0.5 + t * 0.6), '#ff4a2a', 2, { thick: t < 0.3 ? 3 : 1 });
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 8, R.radius * 0.9, '255, 60, 40', 1.1 * (1 - t), 2, R.radius * 0.5);
        ctx.restore();
      });
      world.effects.flames(x, y, { count: 4, spread: R.radius * 0.4, height: 22, width: 10, life: 0.45, colors: ENEMY_FIRE_COLORS });
      world.effects.burst(x, y - 6, { count: 10, colors: FORT_LAVA_GIBS, speed: [50, 160], life: [0.2, 0.5], up: 80, gravity: 300 });
      world.shake(2, 0.12);
      Sound.play('fireImpact', 0.06);
    });
  }

  /** Phase 2: his baby dragons answer his call, flying in over the lava from the edges of the room (up to babies.count at once). */
  callBrood(world) {
    const B = this.cfg.babies;
    const alive = world.enemies.filter((e) => e.lordBaby && !e.dead).length;
    const n = Math.max(0, B.count - alive);
    if (!n) return;
    const pl = this.platform(world);
    const R = this.ring;
    const img = Sprites.enemies.babyDragon.idle;
    const stage = world.run ? world.run.stage : 0;
    for (let i = 0; i < n; i++) {
      const a = this.theta + Math.PI + (i - (n - 1) / 2) * 1.1 + rand(-0.2, 0.2);
      const from = { x: R.cx + Math.cos(a) * (R.rx + 160), y: R.cy + Math.sin(a) * (R.ry + 140) };
      const to = { x: clamp(R.cx + Math.cos(a) * R.rx * 0.55, pl.left + 40, pl.right - 40), y: clamp(R.cy + Math.sin(a) * R.ry * 0.5, pl.top + 40, pl.bottom - 30) };
      const face = to.x >= from.x ? 1 : -1;
      world.effects.add(B.flyIn, (ctx, t) => {
        // swooping in, its shadow racing over the floor under it
        const k = 1 - (1 - t) ** 2;
        const x = lerp(from.x, to.x, k);
        const y = lerp(from.y, to.y, k);
        const z = 22 + (1 - k) * 90;
        drawShadow(ctx, x, y + 6, 18, 6, 0.3 * t);
        const fr = img[Math.floor(t * 12) % img.length];
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y - z));
        if (face < 0) ctx.scale(-1, 1);
        ctx.drawImage(fr.img, -DRAGON_ANCHOR.x, -DRAGON_ANCHOR.y);
        ctx.restore();
      });
      world.after(B.flyIn, () => {
        if ((world.run && world.run.stage !== stage) || world.boss !== this || this.dying > 0) return;
        const e = createEnemy('babyDragon', to.x, to.y);
        e.lordBaby = true;
        e.age = 0.3;   // (already here: no fade in)
        e.facing = face;
        world.addEnemy(e);
      });
    }
    world.banner('THE BROOD ANSWERS', 'His baby dragons fly in');
    Sound.play('fireballCast');
  }

  // ---------- death ----------

  die(world) {
    this.dying = 3.2;
    this.roar = null;
    this.breath = null;
    world.banner('THE DRAGON LORD FALLS!', '');
    Sound.play('dragonRoar');
    // his brood flees the fortress with him
    for (const e of world.enemies) if (e.lordBaby && !e.dead) e.die(world);
  }

  /** He thrashes on his tower, fire bursting from him, topples off it and crashes down, and his fire goes out. */
  updateDeath(dt, world) {
    this.dying -= dt;
    const at = 3.2 - this.dying;
    this.burstT = (this.burstT || 0) - dt;
    if (this.burstT <= 0) {
      this.burstT = 0.16;
      world.effects.burst(this.x + rand(-40, 40), this.tower.y - this.cfg.perchHeight - rand(20, 120), { count: 10, colors: [...FORT_LAVA_GIBS, '#ffd2c4'], speed: [60, 200], life: [0.3, 0.7], gravity: 300 });
      if (at < 1.4) world.shake(4, 0.15);
    }
    if (at >= 2.2 && !this.crashed) {
      this.crashed = true;
      const gx = this.tower.x + this.facing * 70;
      const gy = this.tower.y + 22;
      enemyBlastFx(world, gx, gy, 110);
      world.effects.burst(gx, gy - 20, { count: 60, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS, '#ffd2c4'], speed: [100, 320], life: [0.5, 1.1], gravity: 380, size: [3, 6] });
      world.shake(14, 0.7);
      Sound.play('stomp');
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.smoke(this.tower.x + this.facing * 70, this.tower.y + 10, { count: 14, radius: 70, life: 1.4, rise: 40, colors: ['#2a1a18', '#4a3430', '#6a5048'] });
      world.onBossDefeated();
    }
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  /** The frame he's in: flapping in the sky, or on his tower roaring, breathing fire or watching. */
  frame() {
    const S = Sprites.dragonLord;
    const flying = this.state === 'fly' || this.state === 'takeoff' || (this.state === 'land' && this.t < this.cfg.fly.land - 0.35) || (this.state === 'intro' && this.intro > DRAGON_INTRO.total - DRAGON_INTRO.land);
    if (flying && this.dying <= 0) {
      const list = this.spit > 0 ? S.flyOpen : S.fly;
      return list[Math.floor(this.flap) % list.length];
    }
    if (this.dying > 0) return S.roar[Math.floor(this.time * 9) % 2];
    if (this.state === 'land' || (this.state === 'takeoff' && this.t < 0.3)) return S.land[Math.floor(this.time * 8) % 2];
    if (this.state === 'intro') {
      const at = DRAGON_INTRO.total - this.intro;
      return at >= DRAGON_INTRO.roar ? S.roar[Math.floor(this.time * 9) % 2] : S.land[0];
    }
    if (this.roar) return S.roar[Math.floor(this.time * 9) % 2];
    if (this.breath) return S.breath[Math.floor(this.time * 10) % 2];
    return S.perch[Math.floor(this.time * 1.4) % 2];
  }

  /** True while he's drawn with the flying poses (anchored at the middle of his body). */
  get flyingPose() {
    const S = Sprites.dragonLord;
    const f = this.frame();
    return S.fly.includes(f) || S.flyOpen.includes(f);
  }

  /**
   * Where the frame's anchor sits on screen: his feet at height z in the perched poses; the middle of his
   * body FLY_LIFT above that in the flying ones (where it is when he's perched, so landing doesn't jump).
   */
  anchorY() { return this.y - this.z - (this.flyingPose ? DRAGON_FLY_LIFT : 0); }

  drawGround(ctx) {
    if (this.dead || (this.state === 'intro' && this.intro >= DRAGON_INTRO.total)) return;
    // his shadow, smaller and fainter the higher he flies
    if (!this.perched && this.dying <= 0) {
      const k = clamp(1 - (this.z - this.cfg.perchHeight) / 500, 0.35, 1);
      drawShadow(ctx, this.x, this.y + 4, 80 * k, 22 * k, 0.32 * k);
    }
    if (this.perched && this.phase === 2 && !this.breath) {
      // the ground his breath reaches: a faint ring round the tower
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 4) * 0.1;
      PFX.ring(ctx, this.tower.x, this.tower.y - 10, this.cfg.breath.trigger, this.cfg.breath.trigger * 0.55, '#ff4a2a', 2, { dash: [4, 4], spin: this.time * 0.3 });
      ctx.restore();
    }
    if (this.breath) this.drawBreathGround(ctx);
  }

  /** The cone of ground his breath plays over: a warning while he draws in, then scorched and glowing. */
  drawBreathGround(ctx) {
    const B = this.cfg.breath;
    const br = this.breath;
    const o = this.breathOrigin();
    const k = clamp(br.t / B.windup, 0, 1);
    const pts = [[o.x, o.y]];
    for (let i = 0; i <= 8; i++) {
      const a = br.aim - B.cone + (i / 8) * B.cone * 2;
      pts.push([o.x + Math.cos(a) * B.range * k, o.y + Math.sin(a) * B.range * 0.6 * k]);
    }
    ctx.save();
    ctx.fillStyle = br.t < B.windup ? `rgba(255, 60, 30, ${0.12 + k * 0.12})` : 'rgba(255, 90, 40, 0.28)';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 80, 50, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  getDrawables() {
    if (this.dead || (this.state === 'intro' && this.intro >= DRAGON_INTRO.total)) return [];   // (not in sight until his swoop begins)
    // up in the sky he's over everything; on (or by) his tower he's sorted just in front of it
    const low = this.z <= this.cfg.perchHeight + 40 && dist(this.x, this.y, this.tower.x, this.tower.y) < 60;
    const y = low || this.dying > 0 ? this.tower.y + 1 : this.y + 100000;
    return [{ y, draw: (ctx) => this.drawBody(ctx) }];
  }

  drawBody(ctx, portrait = false) {
    const fr = this.frame();
    const D = this.flyingPose ? DRAGON_LORD.fly : DRAGON_LORD.perch;
    let x = this.x;
    let y = this.anchorY();
    let rot = 0;
    let alpha = 1;
    if (this.dying > 0 && !portrait) {
      // thrashing, then toppling off the tower and crashing down beside it, then his fire goes out
      const at = 3.2 - this.dying;
      if (at < 1.4) x += Math.sin(this.time * 40) * 2;
      else {
        const k = clamp((at - 1.4) / 0.8, 0, 1);
        rot = this.facing * k * k * 1.35;
        x += this.facing * 70 * k;
        y += (this.cfg.perchHeight + 22) * k * k;
      }
      alpha = at > 2.4 ? clamp(1 - (at - 2.4) / 0.8, 0, 1) : 1;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
    if (this.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(fr.img, -D.ax, -D.ay);
    if (this.flashTime > 0) {
      ctx.globalAlpha = 0.6 * alpha;
      ctx.drawImage(fr.flash, -D.ax, -D.ay);
    }
    ctx.restore();
    if (portrait || this.dying > 0) return;
    // the fire in him: his jaws glowing when open, the breath streaming out, meteors forming
    const m = this.mouth();
    if (this.breath) this.drawBreath(ctx, m);
    else if (this.roar || this.spit > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, m.x, m.y, 18, FORT_LAVA, 0.7);
      ctx.restore();
      if (this.roar) PFX.flame(ctx, m.x, m.y + 4, 10, 18, this.time * 14, FORT_FIRE);
    }
    if (this.state === 'fly' && this.meteorIn < 0.45) {
      // a meteor of molten rock swelling in his jaws
      const k = 1 - this.meteorIn / 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, m.x, m.y, 10 + k * 22, FORT_LAVA, 0.4 + k * 0.5);
      ctx.restore();
    }
  }

  /** His breath: fire gathering in his jaws, then a roaring stream of it pouring down along his aim. */
  drawBreath(ctx, m) {
    const B = this.cfg.breath;
    const br = this.breath;
    const o = this.breathOrigin();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, m.x, m.y, 14 + Math.min(1, br.t / B.windup) * 14, FORT_LAVA, 0.8);
    ctx.restore();
    if (br.t < B.windup) {
      PFX.flame(ctx, m.x, m.y + 4, 8, 12, this.time * 16, FORT_FIRE);
      return;
    }
    // blobs of fire racing from his jaws down to the ground and out along the cone, swelling as they go
    const end = { x: o.x + Math.cos(br.aim) * B.range, y: o.y + Math.sin(br.aim) * B.range * 0.6 };
    for (let i = 0; i < 22; i++) {
      const u = (this.time * 2.6 + i / 22) % 1;
      const spread = Math.sin(i * 2.7) * B.cone * u;
      const gx = o.x + Math.cos(br.aim + spread) * B.range * u;
      const gy = o.y + Math.sin(br.aim + spread) * B.range * 0.6 * u;
      // from the mouth the stream drops to the ground over its first third
      const drop = Math.min(1, u * 3);
      const x = lerp(m.x, gx, drop);
      const y = lerp(m.y, gy, drop);
      const r = 5 + u * 16;
      ctx.save();
      ctx.globalAlpha = 1 - u * 0.6;
      PFX.flame(ctx, x, y + r * 0.4, r, r * 1.5, this.time * 18 + i, FORT_FIRE);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, (o.x + end.x) / 2, (o.y + end.y) / 2, B.range * 0.5, '255, 70, 40', 0.45, 2, B.range * 0.3);
    ctx.restore();
  }

  drawOverlay() {}

  /** His title card portrait: reared up, wings spread, roaring (feet at y). */
  drawPortrait(ctx) {
    const fr = Sprites.dragonLord.roar[0];
    const D = DRAGON_LORD.perch;
    ctx.drawImage(fr.img, Math.round(this.x - D.ax), Math.round(this.y - D.ay));
  }

  /** He lights the room round him: hotter when his jaws are full of fire. */
  addLights(out) {
    const hot = this.breath || this.roar ? 1 : 0.6;
    out.push({ x: this.x, y: this.perched ? this.tower.y - 40 : this.y, r: 170, s: 0.55 * hot, rgb: FORT_LAVA });
  }
}
