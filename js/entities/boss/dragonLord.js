// =============================================================
//  THE BLAZING DRAGON LORD (the Fiery Fortress's deeper boss, stage 2 or 3)
//
//  A great crimson dragon (see buildDragonLordSprites) whose arena is a fenced platform over a moat of lava,
//  his perch - a squat tower - in its middle (see DragonArena). He takes turns (CONFIG.dragonLord):
//    flying:  he circles out over the moat, out of reach (he can't be hurt), hurling giant lava meteors at the
//             heroes; each crashes where its circle grew and leaves the ground burning. In phase 2 he calls his
//             baby dragons too, and they fly in over the lava.
//    perched: he lands on his tower and can be hit anywhere on it. Twice he rears his head and spits fireballs
//             up into the sky that rain down all over the platform (in phase 2, thickly round every hero).
//             In phase 2 he breathes fire between the rains: a fan of ground lights up, then his breath
//             sweeps across it, searing in rapid ticks whoever it plays over and setting them alight.
//  Below phase2At of his health: faster meteors, longer perches with three far heavier rains, the brood, the breath.
//  (x, y) is the ground under him; z how high he is above it (perched: on the tower's top).
// =============================================================

// his entrance: he swoops down out of the sky onto his tower (land), then rears up and roars (roar)
const DRAGON_INTRO = { land: 2.4, roar: 2.8, total: 4.2 };
const DRAGON_FLY_LIFT = 52;   // sprite px the middle of his body sits above his feet (flying poses are anchored there; x his scale)

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
    this.roar = null;        // perched: { t, rained, len } while he spits a rain of fire up (rained once it's begun), or roars in fury
    this.breath = null;      // perched (phase 2): { t, aim, from, to, tick } while he breathes fire
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
  get hy() { return this.perched || this.dying > 0 ? this.tower.y - 84 : this.y - this.z - this.flyLift; }
  /** How far the middle of his body is above his feet, at his size. */
  get flyLift() { return DRAGON_FLY_LIFT * this.cfg.scale; }
  get drawY() { return this.y; }

  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const marker = this.phase === 1 ? this.cfg.phase2At : undefined;
    if (this.perched) return [{ part: this, x: this.x, y: this.tower.y - this.cfg.perchHeight - 186 * this.cfg.scale, w: 140, color: '#ff6a2a', marker }];
    return [{ part: this, x: this.x, y: this.y - this.z - this.flyLift - 150, w: 140, color: '#ff6a2a', marker, locked: true, lockedText: 'IN THE SKY' }];
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
    if (!this.roar && !this.breath) this.roar = { t: 0, rained: true, len: this.cfg.perch.roarTime };   // a roar of fury (no rain)
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
      this.rains = P.rains[ph].slice();
      this.breaths = P.breaths[ph].slice();
      this.setState('perch');
    }
  }

  /** On his tower: he can be hurt; he spits rains of fire into the sky, and in phase 2 breathes fire between them. */
  updatePerch(dt, world) {
    const P = this.cfg.perch;
    this.flap += dt * 2;
    const near = this.nearestHero(world);
    if (!this.breath && near) this.facing = near.x >= this.x ? 1 : -1;
    if (this.roar) {
      this.roar.t += dt;
      if (!this.roar.rained && this.roar.t >= P.rainAt) {
        this.roar.rained = true;
        this.rainFire(world);
      }
      if (this.roar.t >= this.roar.len) this.roar = null;
    } else if (this.breath) {
      this.updateBreath(dt, world);
    } else if (this.rains.length && this.t >= this.rains[0]) {
      // he rears his head back and spits a rain of fire up into the sky
      this.rains.shift();
      this.roar = { t: 0, rained: false, len: P.volleyTime };
      Sound.play('fireballCast');
    } else if (this.breaths.length && this.t >= this.breaths[0]) {
      this.breaths.shift();
      this.startBreath(world);
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

  /** Where his breath meets the ground: the tower's foot, a little out along where it's aimed. */
  breathOrigin(a = this.breath ? this.breath.aim : 0) {
    return { x: this.tower.x + Math.cos(a) * 36, y: this.tower.y - 6 + Math.sin(a) * 20 };
  }

  /** A point `d` px out along angle a from the breath's origin (the ground is foreshortened up and down). */
  breathPoint(a, d) {
    const o = this.breathOrigin(a);
    return { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d * 0.6 };
  }

  /** His dragon's breath: a fan aimed at a hero lights up, then he sweeps his fire across it from one edge to the other. */
  startBreath(world) {
    const B = this.cfg.breath;
    const heroes = this.heroesAlive(world);
    const p = heroes.length ? choose(heroes) : null;
    const mid = p ? angleTo(this.tower.x, this.tower.y, p.x, p.y) : (this.facing > 0 ? 0.4 : Math.PI - 0.4);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.breath = { t: 0, mid, from: mid - dir * B.fan, to: mid + dir * B.fan, aim: mid - dir * B.fan, tick: 0 };
    this.facing = Math.cos(mid) >= 0 ? 1 : -1;
    Sound.play('fireballCast');
    Sound.play('burstCharge', 0.2);
  }

  updateBreath(dt, world) {
    const B = this.cfg.breath;
    const br = this.breath;
    br.t += dt;
    if (br.t < B.windup) return;
    const k = clamp((br.t - B.windup) / B.sweep, 0, 1);
    br.aim = lerp(br.from, br.to, k * k * (3 - 2 * k));
    this.facing = Math.cos(br.aim) >= 0 ? 1 : -1;
    if (!br.roaring) { br.roaring = true; Sound.play('dragonBreath'); world.shake(5, B.sweep); }
    br.tick -= dt;
    if (br.tick <= 0) {
      br.tick = B.every;
      const o = this.breathOrigin();
      for (const a of world.allies) {
        if (a.dead) continue;
        // (the ground is foreshortened up and down: measure on the unsquashed floor)
        const dx = a.x - o.x;
        const dy = (a.y - o.y) / 0.6;
        const d = Math.hypot(dx, dy);
        if (d > B.range + a.radius) continue;
        const ang = Math.atan2(dy, dx);
        if (Math.abs(angleDiff(br.aim, ang)) > B.beam + a.radius / Math.max(40, d)) continue;
        // rapid little sears (they don't wait on a hero's moment of safety after a hit), and it sets them alight
        if (a.scorch) a.scorch(B.damage / B.every, B.every * 2, world, B.every);
        else a.hurt?.(B.damage, world, o.x, o.y);
        setAlight(world, a, B);
      }
      // embers and smoke boiling up where it lands
      const e = this.breathPoint(br.aim, B.range * vrand(0.55, 1));
      world.effects.burst(e.x, e.y - 6, { count: 6, colors: ['#ffffff', '#ffd2c4', '#ff6a4a', '#e8281a'], speed: [60, 200], life: [0.25, 0.6], up: 120, gravity: 260, size: [2, 3] });
      if (vrand(0, 1) < 0.5) world.effects.smoke(e.x, e.y - 10, { count: 2, radius: 18, life: 0.8, rise: 40, colors: ['#2a1612', '#4a2a22', '#6a3a2a'] });
      if (vrand(0, 1) < 0.4) Sound.play('fireImpact', 0.2);
    }
    if (k >= 1 && br.t >= B.windup + B.sweep + 0.25) this.breath = null;
  }

  // ---------- his attacks ----------

  /** Where his mouth is on screen, in the frame he's showing. */
  mouth() {
    const fr = this.frame();
    const m = fr.mouth;
    const base = this.anchorY();
    const s = this.cfg.scale;
    return { x: this.x + m.x * s * this.facing, y: base + m.y * s };
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
    // spat out of his jaws: it shoots forward out of his mouth the way he faces, then curves up and over onto
    // its circle (a curve from his mouth, through a point out in front of it, to the ground)
    const mid = { x: from.x + this.facing * 150, y: Math.min(from.y, at.y) - 120 };
    const curve = (t) => ({
      x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t * t * at.x,
      y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t * t * at.y,
    });
    world.effects.add(flight, (ctx, t) => {
      const { x, y } = curve(t);
      const q = curve(Math.max(0, t - 0.04));
      const back = Math.atan2(q.y - y, q.x - x);
      const grow = 0.6 + Math.min(1, t * 5) * 1.3;   // it swells to full size just out of his jaws
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, 22 + grow * 12, FORT_LAVA, 0.75);
      ctx.restore();
      // a trail of fire back along its path, all the way to his jaws at first
      for (let i = 1; i < 7; i++) {
        PFX.flame(ctx, x + Math.cos(back) * i * 11, y + Math.sin(back) * i * 11 + 10, (26 - i * 3.2) * grow / 1.9, (30 - i * 3) * grow / 1.9, t * 22 + i + seed, FORT_FIRE);
      }
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(t * 9 + seed);
      ctx.scale(grow, grow);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    });
    // the burst of fire out of his mouth as he spits it
    world.effects.add(0.3, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, from.x, from.y, 50 * (1 - t * 0.5), FORT_LAVA, 1 - t);
      PFX.glow(ctx, from.x, from.y, 18, '255, 240, 230', 1 - t);
      ctx.restore();
    });
    world.effects.burst(from.x, from.y, { count: 22, colors: ['#ffffff', '#ffd2c4', '#ff6a4a', '#e8281a'], speed: [80, 260], life: [0.2, 0.5], gravity: 200 });
    world.effects.smoke(from.x + this.facing * 10, from.y, { count: 4, radius: 16, life: 0.7, rise: 30, colors: ['#2a1612', '#4a2a22', '#6a3a2a'] });
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
      // it leaves a pool of molten rock as wide as its blast (the fast lava burn while you stand in it)
      lavaPool(world, at.x, at.y, M.radius, M.poolTime);
      enemyBlastFx(world, at.x, at.y, M.radius);
      world.effects.burst(at.x, at.y - 8, { count: 26, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [90, 280], life: [0.4, 0.8], gravity: 360, up: 140, size: [2, 6] });
      world.shake(7, 0.3);
    });
    Sound.play('bossFireball');
  }

  /** A rain of fire: fireballs spat up into the sky, one after another, falling all over the platform, or (phase 2) thickly round every hero. */
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

  /**
   * One fireball of the rain: spat up out of his jaws and away into the sky (rain.rise s), then down onto its
   * spot (rain.fall s), its circle growing from the moment it leaves him; it bursts there, setting heroes alight.
   */
  dropFireball(world, x, y) {
    const R = this.cfg.rain;
    const img = Sprites.projectiles.fireballBig;
    const side = vrand(-1, 1) * 60;
    const from = this.mouth();
    const up = { x: from.x + vrand(-50, 50), y: from.y - 420 };
    world.effects.add(R.rise + R.fall, (ctx, t) => Telegraph.circle(ctx, x, y, R.radius, t, '255, 50, 30'), true);
    world.effects.add(R.rise, (ctx, t) => {
      // shooting up out of his jaws, trailing fire back down to them
      const k = 1 - (1 - t) ** 2;
      const fx = lerp(from.x, up.x, k);
      const fy = lerp(from.y, up.y, k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, fx, fy, 22, FORT_LAVA, 0.8);
      ctx.restore();
      for (let i = 1; i < 4; i++) PFX.flame(ctx, fx, fy + i * 13, 12 - i * 2, 18 - i * 2, t * 20 + i, FORT_FIRE);
      drawRotated(ctx, img, fx, fy, img.width / 2, img.height / 2, t * 8);
    });
    world.effects.add(0.18, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, from.x, from.y, 30 * (1 - t * 0.4), FORT_LAVA, 1 - t);
      ctx.restore();
    });
    world.effects.burst(from.x, from.y, { count: 6, colors: ['#ffd2c4', '#ff6a4a', '#e8281a'], speed: [60, 180], life: [0.15, 0.35], up: 120 });
    Sound.play('bossFireball', 0.08);
    const stage = world.run ? world.run.stage : 0;
    world.after(R.rise, () => {
      if (world.run && world.run.stage !== stage) return;
      this.fallFireball(world, x, y, img, side);
    });
  }

  /** A rain fireball dropping out of the sky onto (x, y), and bursting there. */
  fallFireball(world, x, y, img, side) {
    const R = this.cfg.rain;
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
      const list = this.spit > 0 || (this.state === 'fly' && this.meteorIn < 0.45) ? S.flyOpen : S.fly;   // (jaws open round the meteor forming in them)
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
  anchorY() { return this.y - this.z - (this.flyingPose ? this.flyLift : 0); }

  drawGround(ctx) {
    if (this.dead || (this.state === 'intro' && this.intro >= DRAGON_INTRO.total)) return;
    // his shadow, smaller and fainter the higher he flies
    if (!this.perched && this.dying <= 0) {
      const k = clamp(1 - (this.z - this.cfg.perchHeight) / 500, 0.35, 1);
      const s = this.cfg.scale;
      drawShadow(ctx, this.x, this.y + 4, 80 * k * s, 22 * k * s, 0.32 * k);
    }
    if (this.breath) this.drawBreathGround(ctx);
  }

  /** The ground between angles a0 and a1 of his breath's fan, out to `d` px, as a path. */
  fanPath(ctx, a0, a1, d) {
    const o = this.breathOrigin((a0 + a1) / 2);
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * 10));
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      ctx.lineTo(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * 0.6);
    }
    ctx.closePath();
  }

  /**
   * His breath's fan on the ground: it lights up and pulses while he draws in (a bright edge where the sweep
   * starts, chevrons along its rim the way it will go), then the swept part is left scorched and smouldering.
   */
  drawBreathGround(ctx) {
    const B = this.cfg.breath;
    const br = this.breath;
    const R = B.range;
    const warm = clamp(br.t / B.windup, 0, 1);
    const dir = Math.sign(br.to - br.from);
    ctx.save();
    // the whole fan: still to come
    this.fanPath(ctx, br.from, br.to, R * (0.7 + 0.3 * warm));
    ctx.fillStyle = `rgba(255, 50, 30, ${0.1 + warm * 0.12 + (br.t < B.windup ? Math.sin(br.t * 22) * 0.05 : 0)})`;
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = `rgba(255, 90, 60, ${0.5 + warm * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    if (br.t > B.windup) {
      // what the fire has already swept: charred, embers glowing through
      this.fanPath(ctx, br.from, br.aim, R);
      ctx.fillStyle = 'rgba(26, 8, 6, 0.5)';
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      this.fanPath(ctx, br.from, br.aim, R);
      ctx.fillStyle = 'rgba(255, 60, 30, 0.16)';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // the edge it starts from, burning bright, and chevrons racing along the rim the way it will sweep
      const o = this.breathOrigin(br.from);
      const e = this.breathPoint(br.from, R);
      ctx.strokeStyle = `rgba(255, 220, 200, ${0.5 + warm * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 200, 180, ${0.4 + warm * 0.5})`;
      for (let i = 0; i < 5; i++) {
        const u = (br.t * 1.6 + i / 5) % 1;
        const a = lerp(br.from, br.to, u);
        const p = this.breathPoint(a, R * 0.86);
        const ta = a + dir * Math.PI / 2;
        const tx = Math.cos(ta);
        const ty = Math.sin(ta) * 0.6;
        const nx = Math.cos(a);
        const ny = Math.sin(a) * 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x + tx * 9, p.y + ty * 9);
        ctx.lineTo(p.x - tx * 4 + nx * 7, p.y - ty * 4 + ny * 7);
        ctx.lineTo(p.x - tx * 4 - nx * 7, p.y - ty * 4 - ny * 7);
        ctx.closePath();
        ctx.fill();
      }
    }
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
    const s = this.cfg.scale;
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
    ctx.scale(this.facing < 0 ? -s : s, s);
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
      PFX.glow(ctx, m.x, m.y, 24, FORT_LAVA, 0.7);
      ctx.restore();
      if (this.roar) PFX.flame(ctx, m.x, m.y + 4, 14, 24, this.time * 14, FORT_FIRE);
    }
    if (this.state === 'fly' && this.meteorIn < 0.45) {
      // a meteor of molten rock swelling in his jaws, fire gathering in round it
      const k = 1 - this.meteorIn / 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, m.x, m.y, 14 + k * 30, FORT_LAVA, 0.4 + k * 0.5);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const u = (this.time * 2.2 + i / 6) % 1;
        const a = i * 1.05 + this.time * 5;
        PFX.disc(ctx, m.x + Math.cos(a) * (1 - u) * 46, m.y + Math.sin(a) * (1 - u) * 32, 2 + u * 2, 2 + u * 2, u > 0.6 ? '#ffd2c4' : '#e8281a');
      }
      const img = Sprites.projectiles.meteor;
      ctx.save();
      ctx.translate(Math.round(m.x + this.facing * 4), Math.round(m.y));
      ctx.rotate(this.time * 4);
      ctx.scale(0.3 + k * 0.4, 0.3 + k * 0.4);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    }
  }

  /**
   * His breath. Drawing in: fire swirling into his jaws round a swelling white-hot core. Then a jet of fire:
   * a blinding flare at his jaws, billows of red flame round a white-hot heart that pour down onto the ground
   * and roll out along it, swelling and darkening into smoke, and a wall of flame where it lands.
   */
  drawBreath(ctx, m) {
    const B = this.cfg.breath;
    const br = this.breath;
    const time = this.time;
    if (br.t < B.windup) {
      const k = br.t / B.windup;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, m.x, m.y, 16 + k * 30, FORT_LAVA, 0.5 + k * 0.5);
      PFX.glow(ctx, m.x, m.y, 5 + k * 10, '255, 230, 220', 0.9);
      ctx.restore();
      for (let i = 0; i < 8; i++) {
        const u = (time * 1.8 + i / 8) % 1;
        const a = i * 0.8 + time * 6;
        const r = (1 - u) * 70;
        PFX.disc(ctx, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r * 0.7, 2 + u * 3, 2 + u * 3, u > 0.6 ? '#ffd2c4' : '#e8281a');
      }
      return;
    }
    const R = B.range;
    const ground = this.breathOrigin();
    const end = this.breathPoint(br.aim, R);
    // the jet pours straight down from his jaws onto the ground a third of the way out, then rolls on along it
    const land = this.breathPoint(br.aim, R * 0.33);
    const along = (u, wob) => {
      if (u >= 0.33) return this.breathPoint(br.aim + wob, R * u);
      const d = u / 0.33;
      return { x: lerp(m.x, land.x, d), y: lerp(m.y, land.y, d) };
    };
    // the glow of it, and the wall of flame where it lands
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, end.x, end.y - 10, 70, '255, 60, 30', 0.9, 2, 36);
    PFX.glow(ctx, (ground.x + end.x) / 2, (ground.y + end.y) / 2, R * 0.55, '255, 50, 30', 0.5, 2, R * 0.3);
    ctx.restore();
    for (let i = -2; i <= 2; i++) {
      const p = this.breathPoint(br.aim + i * 0.06, R * (0.86 + Math.abs(i) * 0.03));
      PFX.flame(ctx, p.x, p.y + 4, 16, 40 + Math.sin(time * 9 + i) * 10 - Math.abs(i) * 6, time * 14 + i, FORT_FIRE);
    }
    // the jet itself: one unbroken stream of fire from his jaws down onto the ground and out along it, a
    // white-hot core inside it, flickering
    const path = [];
    for (let u = 0; u <= 0.62; u += 0.04) path.push(along(u, Math.sin(u * 20 - time * 30) * 0.03 * u));
    const stroke = (w0, w1, color, k = path.length) => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (let i = 0; i + 1 < k; i++) {
        ctx.lineWidth = lerp(w0, w1, i / (path.length - 1)) * (1 + Math.sin(time * 37 + i) * 0.12);
        ctx.beginPath();
        ctx.moveTo(path[i].x, path[i].y);
        ctx.lineTo(path[i + 1].x, path[i + 1].y);
        ctx.stroke();
      }
    };
    ctx.save();
    stroke(14, 40, '#a8100e');
    stroke(10, 30, '#e8281a');
    stroke(6, 18, '#ff6a4a', path.length - 2);
    stroke(3, 8, '#ffd2c4', path.length - 5);
    stroke(2, 3, '#ffffff', 6);
    ctx.restore();
    // sparks spat out of it
    for (let i = 0; i < 10; i++) {
      const u = (time * 3.1 + i / 10) % 1;
      const p = along(u * 0.8, Math.sin(i * 4.1) * B.beam * 1.4 * u);
      ctx.fillStyle = u < 0.5 ? '#ffffff' : '#ffd2c4';
      ctx.fillRect(Math.round(p.x + Math.sin(i * 7) * 14 * u), Math.round(p.y - 10 - u * 30), 2, 2);
    }
    // the billows, far ones first: smoke rolling off the old ones, red flame, a white-hot heart while they're young
    const N = 30;
    const blobs = [];
    for (let i = 0; i < N; i++) {
      const u = (time * 2.4 + i / N) % 1;
      const wob = Math.sin(i * 2.3 + time * 3) * B.beam * 0.8 * Math.min(1, u * 2);
      blobs.push({ u, i, ...along(u, wob) });
    }
    blobs.sort((a, b) => b.u - a.u);
    for (const b of blobs) {
      const r = 6 + b.u * 26;
      const lift = b.u > 0.33 ? r * 0.35 : 0;
      if (b.u > 0.6) {
        ctx.save();
        ctx.globalAlpha = (b.u - 0.6) * 1.6;
        PFX.disc(ctx, b.x + 3, b.y - lift - r * 0.4 - (b.u - 0.6) * 40, r * 0.9, r * 0.7, b.i % 2 ? '#2a1612' : '#3e2420');
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, 1.6 - b.u * 1.4);
      PFX.disc(ctx, b.x, b.y - lift, r, r * 0.8, b.u > 0.7 ? '#6e0a0a' : '#a8100e');
      PFX.disc(ctx, b.x - r * 0.1, b.y - lift - r * 0.1, r * 0.75, r * 0.6, '#e8281a');
      if (b.u < 0.8) PFX.disc(ctx, b.x - r * 0.15, b.y - lift - r * 0.15, r * 0.55, r * 0.45, '#ff6a4a');
      if (b.u < 0.6) PFX.disc(ctx, b.x - r * 0.18, b.y - lift - r * 0.18, r * 0.34, r * 0.27, b.u < 0.35 ? '#ffffff' : '#ffd2c4');
      ctx.restore();
    }
    // the white-hot core of the jet, and the flare at his jaws
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let u = 0; u < 0.6; u += 0.06) {
      const p = along(u, 0);
      PFX.glow(ctx, p.x, p.y - (u > 0.33 ? 6 : 0), 16 - u * 10, '255, 200, 180', 0.7 - u);
    }
    PFX.glow(ctx, m.x, m.y, 34 + Math.sin(time * 30) * 4, '255, 80, 50', 1);
    PFX.glow(ctx, m.x, m.y, 12, '255, 245, 235', 1);
    ctx.restore();
    PFX.star(ctx, m.x, m.y, 10 + Math.sin(time * 40) * 3, '#ffd2c4', '#ffffff');
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
