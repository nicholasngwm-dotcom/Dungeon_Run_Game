// =============================================================
//  THE DEATHBRINGER (graveyard, stage 2 or 3)
//
//  A robed reaper with no face, only darkness pouring out of its hood, two scythes and
//  eight tendrils on its back. Every few seconds it blinks to a random spot in its room.
//  Phase 1: scythe slashes (one swing, throwing a fan of three big waves of darkness across
//    the room) and tendrils: two sink into the ground at its feet and rise somewhere else in
//    the room, slamming the ground now and then (a shockwave and a ring of small dark waves).
//    A tendril that's cut down goes back to it; it can have all eight out at once.
//  Phase 2 (half health): darkness covers the room; its scythes become double-ended and
//    forked, and circle it on their own, spinning as they go (faster when you're close).
//    Every few seconds one of them, taking turns, looses a big wave of darkness at you.
//    Darkness gathers in its hands and it hurls shadow bombs that explode over an area.
//    It chases you between attacks (faster in phase 2), and after a tendril is cut down it
//    sends no more out for a while.
//  Phase 3 (10%): it vanishes and comes back as a shade, its scythes whirling round it extremely
//    fast, and hunts you down, faster still.
//  (x, y) is the ground under it; it floats a little above it.
// =============================================================

// The entrance: a dark portal opens in the middle of the room, it rises up through it,
// darkness gathers in its hands and forms its scythes, then the portal closes. Seconds from the start.
const DB_INTRO = { open: 1.0, rise: 2.6, forge: 3.6, close: 4.1, total: 4.4 };
// how much bigger than its sprite it's drawn (its hit box, hands and scythes scale with it)
const DB_SCALE = 1.45;
const DB_RISE = 130;   // how far below the floor it starts its rise through the portal (px)
const DB_DARK = ['#000000', '#0e0814', '#1e1028', '#33195a'];   // darkness, deepest first

class Deathbringer {
  constructor(x, y) {
    const c = CONFIG.deathbringer;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 42;
    this.time = 0;
    this.phase = 1;
    this.intro = DB_INTRO.total;
    this.introAt = 0;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.alpha = 1;
    this.facing = 1;

    this.state = 'idle';     // idle | slash | cast | bombs | transform | vanish | shade | teleport
    this.t = 0;
    this.attackTimer = c.attackInterval[0];
    this.attackStep = 0;
    this.teleTimer = c.teleportEvery;
    this.tele = null;        // { stage: 'out' | 'in', t, to }

    this.tendrilsOut = 0;    // tendrils away from its back (in the ground, out in the room, or flying home)
    this.sinking = 0;        // back tendrils diving into the ground right now (drawn shrinking)
    this.tendrils = [];      // DeathTendril out in the room
    this.bombs = [];         // shadow bombs: { x0, y0, x, y, t }
    this.strikes = 0;        // slashes done in the current attack
    this.arm = { '-1': Math.PI / 2 + 0.5, 1: Math.PI / 2 - 0.5 };   // each arm's angle from its shoulder
    this.armGoal = { ...this.arm };
    this.double = false;     // phase 2: the scythes have left its hands
    this.spinAngle = 0;
    this.orbitAngle = 0;     // phase 2: where the scythes are round it
    this.orbitSpin = 0;      // how fast they circle (eased toward spin or fastSpin)
    this.orbitR = 0;         // how far out they circle (they spread out after the transform)
    this.near = 0;           // 0-1: eased toward 1 while a hero is close
    this.waveTimer = 0;      // phase 2: till the next scythe looses its wave
    this.waveTurn = 0;       // which scythe looses the next one
    this.darkness = 0;       // how dark it's made the room (0-1), eased toward darknessGoal
    this.darknessGoal = 0;
  }

  get name() { return 'THE DEATHBRINGER'; }
  get title() { return 'Reaper of the Endless Dark'; }
  get defeatText() { return 'The Deathbringer has been unmade.'; }

  get bob() { return Math.sin(this.time * 2) * 2; }
  /** Where the body sprite stands (it hovers a little off the ground). */
  get drawY() { return this.y - 6 + this.bob; }
  get hx() { return this.x; }
  get hy() { return this.drawY - 46 * DB_SCALE; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead && this.alpha > 0.5; }

  /** It, and every tendril that's up out of the ground. */
  getTargets() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const list = this.targetable ? [this] : [];
    for (const td of this.tendrils) if (td.hittable) list.push(td);
    return list;
  }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const c = this.cfg;
    const out = this.alpha > 0.3 ? [{ part: this, x: this.x, y: this.drawY - DB_SPRITE.ay * DB_SCALE - 14, w: 110, color: '#8a5aff', marker: [c.phase2At, c.phase3At] }] : [];
    for (const td of this.tendrils) if (td.hittable) out.push({ part: td, x: td.x, y: td.y - 92, w: 30, color: '#b06aff' });
    return out;
  }

  knockback() {}   // darkness doesn't stagger
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
    this.darkness += (this.darknessGoal - this.darkness) * Math.min(1, dt * 1.5);
    this.spinAngle += dt * (7 + 9 * this.near);
    for (const s of [-1, 1]) this.arm[s] += angleDiff(this.arm[s], this.armGoal[s]) * Math.min(1, dt * 20);
    if (this.intro > 0) return this.updateIntro(dt, world);
    this.updateTendrils(dt, world);
    this.updateBombs(dt, world);
    if (this.double) this.updateOrbit(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.pourDarkness(world);

    const p = world.player;
    this.t += dt;
    if (this.phase === 3) return this.updateShade(dt, world);
    if (this.double && this.state !== 'transform') this.updateScytheWaves(dt, world);
    if (this.state === 'idle') this.facing = p.x >= this.x ? 1 : -1;
    // every few seconds, between attacks, it blinks somewhere else in the room
    this.teleTimer -= dt;
    if (this.tele) return this.updateTeleport(dt, world);
    switch (this.state) {
      case 'idle': this.updateIdle(dt, world); break;
      case 'slash': this.updateSlash(dt, world); break;
      case 'cast': this.updateCast(dt, world); break;
      case 'bombs': this.updateBombThrow(dt, world); break;
      case 'transform': this.updateTransform(dt, world); break;
    }
    this.contactDamage(world, this.cfg.contactDamage);
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** A ground point clamped inside the room's floor. */
  clampToFloor(world, x, y) {
    const b = world.dungeon.floorBounds;
    return { x: clamp(x, b.left + 50, b.right - 50), y: clamp(y, b.top + 90, b.bottom - 30) };
  }

  /** A random open spot in the room at least `away` px from every hero (and `from` points). */
  randomSpot(world, away, from = []) {
    const b = world.dungeon.floorBounds;
    let best = null;
    for (let i = 0; i < 24; i++) {
      const pt = { x: rand(b.left + 70, b.right - 70), y: rand(b.top + 100, b.bottom - 50) };
      if (world.dungeon.isSolidAt(pt.x, pt.y)) continue;
      best = pt;
      const near = world.heroes.some((h) => dist(h.x, h.y, pt.x, pt.y) < away) || from.some((f) => dist(f.x, f.y, pt.x, pt.y) < 90);
      if (!near) return pt;
    }
    return best || this.clampToFloor(world, this.x, this.y);
  }

  /** Darkness pouring out of its hood and trailing off its robe (visual only). */
  pourDarkness(world) {
    if (this.alpha < 0.2) return;
    const face = { x: this.x, y: this.drawY + DB_POINTS.face.y * DB_SCALE };
    if (vrand(0, 1) < 0.7) world.effects.burst(face.x + vrand(-5, 5), face.y + vrand(-4, 6), { count: 1, colors: DB_DARK, speed: [8, 26], life: [0.5, 1], up: 30, size: [2, 4] });
    if (vrand(0, 1) < 0.35) world.effects.burst(this.x + vrand(-34, 34), this.drawY - vrand(0, 10), { count: 1, colors: DB_DARK, speed: [4, 14], life: [0.6, 1.1], up: 14, size: [2, 3] });
  }

  // ---------- drifting and choosing attacks ----------

  updateIdle(dt, world) {
    const c = this.cfg;
    const p = world.player;
    this.restArms();
    const d = dist(this.x, this.y, p.x, p.y);
    if (!p.dead) {
      // glide toward the hero, keeping about keepAway off
      const dir = d > c.keepAway + 40 ? 1 : d < c.keepAway - 40 ? -0.6 : 0;
      const a = angleTo(this.x, this.y, p.x, p.y);
      const speed = c.glideSpeed[Math.min(this.phase, 2) - 1];
      const to = this.clampToFloor(world, this.x + Math.cos(a) * speed * dir * dt, this.y + Math.sin(a) * speed * dir * dt);
      this.x = to.x;
      this.y = to.y;
    }
    if (this.teleTimer <= 0) return this.startTeleport(world);
    this.attackTimer -= dt;
    if (this.attackTimer > 0 || p.dead) return;
    this.attackTimer = c.attackInterval[this.phase - 1];
    // tendrils only while there's room for more, and not for respawnDelay seconds after one is severed
    const canCast = this.tendrilsOut + c.tendrils.perCast <= c.tendrils.max && !(this.tendrilsReadyAt > this.time);
    if (this.phase === 1) {
      const kind = ['slash', 'tendrils'][this.attackStep++ % 2];
      if (kind === 'tendrils' && canCast) this.startCast(world);
      else this.startSlash(world);
    } else {
      // phase 2 (the scythes circle it on their own): bombs, tendrils, bombs
      const kind = ['bombs', 'tendrils', 'bombs'][this.attackStep++ % 3];
      if (kind === 'tendrils' && canCast) this.startCast(world);
      else this.startBombs(world);
    }
  }

  /** Arms at its sides (scythes held upright), or (phase 2) held out to the floating scythes. */
  restArms() {
    const out = this.double ? 0.9 : 0.5;
    this.armGoal[-1] = Math.PI / 2 + out;
    this.armGoal[1] = Math.PI / 2 - out;
  }

  // ---------- teleport ----------

  startTeleport(world) {
    this.tele = { stage: 'out', t: 0, to: this.randomSpot(world, 160) };
    this.teleTimer = this.cfg.teleportEvery;
    Sound.play('phantomVanish', 0.15);
    this.portalFx(world, this.x, this.y, 0.6);
  }

  updateTeleport(dt, world) {
    const T = this.tele;
    const f = this.cfg.teleportFade;
    T.t += dt;
    if (T.stage === 'out') {
      this.alpha = clamp(1 - T.t / f, 0, 1);
      if (T.t >= f) {
        this.x = T.to.x;
        this.y = T.to.y;
        T.stage = 'in';
        T.t = 0;
        this.portalFx(world, this.x, this.y, 0.6);
        Sound.play('phantomAppear', 0.15);
      }
    } else {
      this.alpha = clamp(T.t / f, 0, 1);
      if (T.t >= f) {
        this.tele = null;
        this.alpha = 1;
      }
    }
  }

  /** A small dark portal flaring open and shut on the floor (visual only). */
  portalFx(world, x, y, life) {
    world.effects.add(life, (ctx, t) => {
      const k = Math.sin(t * Math.PI);
      ctx.save();
      PFX.disc(ctx, x, y, 34 * k, 14 * k, 'rgba(4, 2, 8, 0.85)', 2);
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, x, y, 34 * k, 14 * k, `rgba(150, 90, 255, ${0.8 * k})`, 2, { dash: [4, 3], spin: t * 8 });
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 30, { count: 18, colors: DB_DARK.concat('#6a3aa0'), speed: [30, 120], life: [0.4, 0.8], up: 50, size: [2, 4] });
  }

  // ---------- phase 1: scythe slashes ----------

  startSlash(world) {
    this.setState('slash');
    this.strikes = 0;
    this.slashAim = angleTo(this.x, this.hy, world.player.x, world.player.hy);
    this.facing = Math.cos(this.slashAim) >= 0 ? 1 : -1;
    // both scythes raised high, ready to come down
    for (const s of [-1, 1]) this.armGoal[s] = -Math.PI / 2 + s * 0.6;
    Sound.play('windup');
  }

  updateSlash(dt, world) {
    const c = this.cfg.slash;
    const p = world.player;
    if (this.t < c.windup - 0.15) this.slashAim = angleTo(this.x, this.hy, p.x, p.hy);
    const due = c.windup + this.strikes * c.every;
    if (this.strikes < c.count && this.t >= due) {
      const side = this.strikes % 2 ? -1 : 1;
      this.slashAim = angleTo(this.x, this.hy, p.x, p.hy);
      this.facing = Math.cos(this.slashAim) >= 0 ? 1 : -1;
      this.strike(world, side);
      this.strikes++;
      // the other arm winds back up for the next swing
      this.armGoal[-side] = -Math.PI / 2 - side * 0.6;
    }
    if (this.t >= c.windup + c.count * c.every + 0.35) {
      this.setState('idle');
      this.restArms();
    }
  }

  /**
   * One swing of the scythe on `side`: everything in the arc in front of it is cut, and a
   * fan of big waves of darkness flies off across the room.
   */
  strike(world, side) {
    const c = this.cfg.slash;
    const a = this.slashAim;
    this.armGoal[side] = a + side * 0.9;
    const arc = (c.arcDegrees * DEG) / 2;
    for (const h of world.allies) {
      const d = dist(this.x, this.hy, h.x, h.hy ?? h.y);
      if (d > c.reach + (h.radius || 10)) continue;
      if (d > 20 && Math.abs(angleDiff(a, angleTo(this.x, this.hy, h.x, h.hy ?? h.y))) > arc) continue;
      if (h.hurt(c.damage, world, this.x, this.y) && !h.lastBlocked) h.knockback?.(a, c.knockback);
    }
    const spread = c.waveSpreadDegrees * DEG;
    for (let i = 0; i < c.waves; i++) {
      const wa = a + (c.waves > 1 ? (i / (c.waves - 1) - 0.5) * spread : 0);
      this.darkWave(world, this.x + Math.cos(wa) * 40, this.hy + Math.sin(wa) * 30, wa, { speed: c.waveSpeed, damage: c.waveDamage, scale: c.waveScale, radius: 26, life: c.waveLife });
    }
    // the cut itself: a violet-black crescent
    const x = this.x;
    const y = this.hy;
    const dir = side;
    world.effects.add(0.3, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 0.6 * (1 - t);
      PFX.slash(ctx, x, y, c.reach, a - arc * dir, a - arc * dir + arc * 2 * dir * Math.min(1, t * 3), 14 * (1 - t * 0.5), ['#1e1028', '#33195a', '#6a3aa0', '#c8b8ff'], 2, true);
      ctx.restore();
    });
    world.shake(4, 0.15);
    Sound.play('heavySwing', 0.08);
  }

  /** A wave of darkness: a dark crescent flying off at `angle`. */
  darkWave(world, x, y, angle, { speed, damage, scale = 1, radius = 16, life = 2.4 }) {
    world.enemyProjectiles.push(new Projectile({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius, damage, life, friendly: false, scale,
      sprite: Sprites.projectiles.darkWave, glow: '120, 80, 200', trail: ['#1e1028', '#463a5c', '#9a7ac0'],
    }));
  }

  // ---------- tendrils ----------

  /** Two tendrils dive into the ground at its feet... */
  startCast(world) {
    this.setState('cast');
    this.sinking = this.cfg.tendrils.perCast;
    world.effects.burst(this.x, this.y, { count: 20, colors: DB_DARK.concat('#6a3aa0'), speed: [30, 110], life: [0.4, 0.8], up: 20 });
    Sound.play('graveRumble');
  }

  /** ...and rise out of the ground somewhere else in the room. */
  updateCast(dt, world) {
    const c = this.cfg.tendrils;
    this.armGoal[-1] = Math.PI / 2 + 1.1;
    this.armGoal[1] = Math.PI / 2 - 1.1;
    if (this.t < c.sinkTime) return;
    for (let i = 0; i < this.sinking; i++) {
      const pt = this.randomSpot(world, 110, this.tendrils);
      this.tendrils.push(new DeathTendril(this, pt.x, pt.y));
    }
    this.tendrilsOut += this.sinking;
    this.sinking = 0;
    world.shake(5, 0.3);
    this.setState('idle');
  }

  updateTendrils(dt, world) {
    for (const td of this.tendrils) td.update(dt, world);
    removeDead(this.tendrils);
  }

  /** A tendril was cut down: once it's flown home, it grows back out of its back. */
  tendrilHome() {
    this.tendrilsOut = Math.max(0, this.tendrilsOut - 1);
  }

  // ---------- phase 2: shadow bombs ----------

  startBombs(world) {
    this.setState('bombs');
    Sound.play('burstCharge', 0.1);
  }

  /** Darkness gathers in its raised hands, then it thrusts them at the heroes and hurls the bombs. */
  updateBombThrow(dt, world) {
    const c = this.cfg.bombs;
    const p = world.player;
    if (!this.thrown) {
      for (const s of [-1, 1]) this.armGoal[s] = -Math.PI / 2 + s * 0.7;
      if (vrand(0, 1) < 0.8) {
        // darkness streaming into its hands
        for (const s of [-1, 1]) {
          const h = this.hand(s);
          const a = vrand(0, TAU);
          world.effects.add(0.25, (ctx, t) => {
            const r = 34 * (1 - t);
            ctx.fillStyle = t < 0.5 ? '#1e1028' : '#9a6aff';
            ctx.fillRect(Math.round(h.x + Math.cos(a) * r) - 1, Math.round(h.y + Math.sin(a) * r) - 1, 3, 3);
          });
        }
      }
    }
    if (!this.thrown && this.t >= c.windup) {
      this.thrown = true;
      const heroes = world.heroes;
      const aim = angleTo(this.x, this.hy, p.x, p.hy);
      this.facing = Math.cos(aim) >= 0 ? 1 : -1;
      for (const s of [-1, 1]) this.armGoal[s] = aim + s * 0.3;
      // one lands on its target, the rest are thrown wide round it, evenly spaced round a big ring
      const turn = rand(0, TAU);
      for (let i = 0; i < c.count; i++) {
        const h = heroes[i % heroes.length] || world.player;
        const a = turn + (i / Math.max(1, c.count - 1)) * TAU + rand(-0.3, 0.3);
        const d = i === 0 ? 0 : c.spread * rand(0.65, 1);
        const to = this.clampToFloor(world, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.7);
        const from = this.hand(i % 2 ? 1 : -1);
        this.bombs.push({ x0: from.x, y0: from.y, x: to.x, y: to.y, t: -i * 0.08 });
      }
      for (const s of [-1, 1]) {
        const h = this.hand(s);
        world.effects.burst(h.x, h.y, { count: 12, colors: DB_DARK.concat(['#9a6aff', '#c8b8ff']), speed: [40, 140], life: [0.2, 0.5], size: [2, 3] });
      }
      world.shake(3, 0.15);
      Sound.play('scepterThrow', 0.1);
    }
    if (this.t >= c.windup + 0.6) {
      this.thrown = false;
      this.setState('idle');
    }
  }

  updateBombs(dt, world) {
    const c = this.cfg.bombs;
    for (const b of this.bombs) {
      b.t += dt;
      if (b.t < c.flight + c.fuse) continue;
      b.dead = true;
      // it explodes where it lies: everyone in its area is hit (no waves)
      for (const h of world.allies) if (dist(h.x, h.y, b.x, b.y) < c.radius + (h.radius || 10) * 0.5) h.hurt(c.damage, world, b.x, b.y);
      const { x, y } = b;
      const r = c.radius;
      // a dome of darkness bursting out to the edge of the area, a violet shockwave racing to its rim
      world.effects.add(0.5, (ctx, t) => {
        const e = 1 - (1 - t) ** 3;
        ctx.save();
        ctx.globalAlpha = 0.85 * (1 - t);
        PFX.disc(ctx, x, y, r * (0.4 + e * 0.6), r * 0.6 * (0.4 + e * 0.6), 'rgba(6, 2, 12, 0.8)', 2);
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 14, r * (0.5 + e * 0.5), '120, 60, 220', 0.9 * (1 - t), 2, r * 0.55);
        PFX.ring(ctx, x, y, r * e, r * 0.6 * e, '#9a6aff', 2, { thick: t < 0.4 ? 3 : 1 });
        ctx.restore();
      });
      world.effects.add(1.2, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - t);
        PFX.disc(ctx, x, y, r * 0.8, r * 0.45, '#0a0412');
        ctx.restore();
      }, true);
      world.effects.burst(x, y - 10, { count: 40, colors: DB_DARK.concat(['#6a3aa0', '#c8b8ff']), speed: [80, 260], life: [0.3, 0.8], up: 50, size: [2, 5] });
      world.effects.smoke(x, y - 12, { count: 8, radius: r * 0.45, life: 0.9, rise: 26, colors: ['#0e0814', '#1e1028', '#33195a'] });
      world.shake(6, 0.25);
      Sound.play('explosion', 0.1);
    }
    removeDead(this.bombs);
  }

  // ---------- phase 2: the circling scythes ----------

  /**
   * The scythes circle it, turning faster while a hero is close (the rate eases, so they wind
   * up and slow down smoothly). While it can be seen, touching one hurts.
   */
  updateOrbit(dt, world) {
    const c = this.cfg.orbit;
    const close = this.dying <= 0 && world.heroes.some((h) => !h.dead && dist(h.x, h.y, this.x, this.y) < c.trigger);
    this.near += ((close ? 1 : 0) - this.near) * Math.min(1, dt * 3);
    // phase 3: they whirl round him extremely fast all the time (the rate still eases up to it)
    const goal = this.phase === 3 ? c.shadeSpin : lerp(c.spin, c.fastSpin, this.near);
    this.orbitSpin += (goal - this.orbitSpin) * Math.min(1, dt * 2);
    this.orbitAngle += dt * this.orbitSpin;
    this.orbitR += (c.radius - this.orbitR) * Math.min(1, dt * 3);
    const turnSound = Math.floor(this.orbitAngle / Math.PI);
    if ((this.near > 0.5 || this.phase === 3) && turnSound !== this.orbitSound) Sound.play('whirlwindSpin', 0.2);
    this.orbitSound = turnSound;
    if (this.dying > 0 || this.alpha < 0.6) return;
    for (const s of this.scythePoints()) {
      for (const h of world.allies) if (dist(h.x, h.hy ?? h.y, s.x, s.y) < c.hitRadius + (h.radius || 10)) h.hurt(c.damage, world, s.x, s.y);
    }
  }

  /** Every few seconds a scythe (they take turns) glows, then looses a big wave of darkness at the hero. */
  updateScytheWaves(dt, world) {
    const c = this.cfg.scytheWave;
    const p = world.player;
    this.waveTimer -= dt;
    if (this.waveTimer > 0 || this.alpha < 0.6 || p.dead) return;
    const s = this.scythePoints()[this.waveTurn];
    const a = angleTo(s.x, s.y, p.x, p.hy);
    this.darkWave(world, s.x + Math.cos(a) * 20, s.y + Math.sin(a) * 20, a, { speed: c.speed, damage: c.damage, scale: c.scale, radius: c.radius, life: c.life });
    world.effects.burst(s.x, s.y, { count: 18, colors: DB_DARK.concat(['#9a6aff', '#c8b8ff']), speed: [60, 180], life: [0.3, 0.6], size: [2, 4] });
    world.shake(4, 0.15);
    Sound.play('heavySwing', 0.08);
    this.waveTurn = 1 - this.waveTurn;
    this.waveTimer = c.every;
  }

  /** 0-1: how charged the scythe that looses the next wave is (it glows in the last `charge`s). */
  get waveCharge() {
    const c = this.cfg.scytheWave;
    return this.double && this.phase === 2 ? clamp(1 - this.waveTimer / c.charge, 0, 1) : 0;
  }

  /**
   * Where the two scythes are (their middles, world space). Phase 1 they're in its hands;
   * phase 2 they circle it, half a turn apart.
   */
  scythePoints() {
    if (!this.double) return [-1, 1].map((s) => this.hand(s));
    const y0 = this.drawY - 58;
    return [0, Math.PI].map((o) => ({ x: this.x + Math.cos(this.orbitAngle + o) * this.orbitR, y: y0 + Math.sin(this.orbitAngle + o) * this.orbitR * 0.6 }));
  }

  // ---------- phase 3: the shade ----------

  updateShade(dt, world) {
    const c = this.cfg.shade;
    const p = world.player;
    if (this.state === 'vanish') {
      this.alpha = clamp(1 - this.t / c.vanish, 0, 1);
      if (this.t < c.vanish + 1.2) return;
      // it comes back as a shade, far from the heroes
      const pt = this.randomSpot(world, 220);
      this.x = pt.x;
      this.y = pt.y;
      this.portalFx(world, this.x, this.y, 0.7);
      Sound.play('phantomAppear');
      this.setState('shade');
      return;
    }
    this.alpha = Math.min(0.8, this.alpha + dt * 2);
    for (const s of [-1, 1]) this.armGoal[s] = angleTo(this.x, this.hy, p.x, p.hy) + s * 0.25;
    if (!p.dead) {
      this.facing = p.x >= this.x ? 1 : -1;
      const to = this.clampToFloor(world, p.x, p.y);
      const d = dist(this.x, this.y, to.x, to.y);
      if (d > 4) {
        this.x += ((to.x - this.x) / d) * Math.min(d, c.speed * dt);
        this.y += ((to.y - this.y) / d) * Math.min(d, c.speed * dt);
      }
    }
    if (vrand(0, 1) < 0.6) world.effects.burst(this.x + vrand(-20, 20), this.drawY - vrand(10, 70), { count: 1, colors: DB_DARK, speed: [10, 30], life: [0.4, 0.8], up: 20, size: [2, 4] });
    this.contactDamage(world, c.contactDamage);
  }

  /** Touching it hurts. */
  contactDamage(world, damage) {
    if (this.alpha < 0.6) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < this.cfg.contactRadius + p.hw) p.hurt(damage, world, this.x, this.y, { contact: true });
    }
  }

  // ---------------------------------------------------------
  //  EVENTS
  // ---------------------------------------------------------

  enterPhase(phase, world) {
    this.phase = phase;
    this.tele = null;
    this.alpha = Math.max(this.alpha, 0.6);
    Sound.play('bossRoar');
    world.shake(9, 0.6);
    if (phase === 2) {
      world.banner('DARKNESS FALLS', 'The light is swallowed');
      this.darknessGoal = this.cfg.darkness;
      this.setState('transform');
      return;
    }
    // phase 3: everything goes back to it, it vanishes and comes back as a shade, its scythes whirling round it
    world.banner('THE DEATHBRINGER VANISHES', 'Its scythes whirl as it hunts you');
    for (const td of this.tendrils) td.recall(world);
    this.bombs = [];
    if (!this.double) {
      // (knocked straight from phase 1 to 3: the scythes take flight now)
      this.double = true;
      this.orbitAngle = 0;
      this.orbitR = 60;
    }
    this.setState('vanish');
  }

  /** Phase 2 begins: the scythes leave its hands, reform double-bladed and start circling it. */
  updateTransform(dt, world) {
    for (const s of [-1, 1]) this.armGoal[s] = -Math.PI / 2 + s * 0.9;
    if (!this.double && this.t >= 0.7) {
      this.double = true;
      this.orbitAngle = 0;
      this.orbitR = 60;
      this.waveTimer = this.cfg.scytheWave.every;
      for (const pt of this.scythePoints()) {
        world.effects.burst(pt.x, pt.y, { count: 24, colors: DB_DARK.concat(['#9a6aff', '#ffffff']), speed: [60, 200], life: [0.3, 0.7], size: [2, 4] });
      }
      world.shake(6, 0.3);
      Sound.play('swordDraw');
    }
    if (this.t >= 1.4) {
      this.setState('idle');
      this.attackTimer = 0.6;
    }
  }

  die(world) {
    this.dying = 2.8;
    this.state = 'dying';
    this.tele = null;
    this.alpha = 1;
    for (const td of this.tendrils) td.recall(world);
    this.bombs = [];
    this.darknessGoal = 0;
    Sound.play('bossRoar');
    world.banner('THE DEATHBRINGER IS UNMADE!', '');
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.alpha = clamp(this.dying / 2.8, 0, 1) * (0.6 + 0.4 * Math.sin(this.time * 30));
    this.flashBurst = (this.flashBurst || 0) - dt;
    if (this.flashBurst <= 0) {
      this.flashBurst = 0.15;
      this.flashTime = 0.08;
      world.effects.burst(this.hx + rand(-30, 30), this.hy + rand(-40, 30), { count: 14, colors: DB_DARK.concat(['#6a3aa0', '#c8b8ff', '#ffe07a']), speed: [60, 220], life: [0.3, 0.7], size: [2, 5] });
      world.shake(5, 0.2);
      Sound.play('phantomVanish', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      this.darkness = 0;
      world.effects.burst(this.hx, this.hy, { count: 90, colors: ['#000000', '#33195a', '#6a3aa0', '#c8b8ff', '#ffe07a'], speed: [100, 360], life: [0.6, 1.4], size: [3, 6] });
      world.shake(12, 0.7);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------- the entrance ----------

  /**
   * The entrance (see DB_INTRO): a dark portal tears open in the middle of the room, it rises
   * up through it, darkness gathers in its hands into two scythes, and the portal closes.
   */
  updateIntro(dt, world) {
    const I = DB_INTRO;
    const before = this.introAt;
    this.introAt += dt;
    this.intro = I.total - this.introAt;
    const e = this.introAt;
    const crossed = (at) => before < at && e >= at;
    if (crossed(0.05)) Sound.play('graveRumble');
    if (crossed(I.open)) Sound.play('ghostWail');
    if (e < I.rise) world.shake(1 + 2 * clamp(e / I.rise, 0, 1), 0.1);
    if (e > I.open * 0.4 && e < I.close && vrand(0, 1) < 0.8) {
      // darkness streaming up out of the portal
      const a = vrand(0, TAU);
      world.effects.burst(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 14, { count: 1, colors: DB_DARK.concat('#6a3aa0'), speed: [10, 40], life: [0.5, 1], up: 60, size: [2, 4] });
    }
    if (e > I.rise && e < I.forge && vrand(0, 1) < 0.9) {
      // darkness gathering in its hands
      for (const s of [-1, 1]) {
        const h = this.hand(s);
        const a = vrand(0, TAU);
        world.effects.add(0.3, (ctx, t) => {
          const r = 30 * (1 - t);
          ctx.fillStyle = t < 0.5 ? '#1e1028' : '#9a6aff';
          ctx.fillRect(Math.round(h.x + Math.cos(a) * r) - 1, Math.round(h.y + Math.sin(a) * r) - 1, 3, 3);
        });
      }
    }
    if (crossed(I.forge)) {
      for (const s of [-1, 1]) {
        const h = this.hand(s);
        world.effects.burst(h.x, h.y - 20, { count: 20, colors: ['#33195a', '#9a6aff', '#ffffff'], speed: [40, 160], life: [0.3, 0.6], size: [2, 3] });
      }
      world.shake(8, 0.4);
      Sound.play('swordDraw');
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
    }
    if (this.intro <= 0) this.intro = 0;
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  /** How far it has risen out of the portal (0 below the floor, 1 standing). */
  get risen() { return this.intro > 0 ? clamp((this.introAt - DB_INTRO.open) / (DB_INTRO.rise - DB_INTRO.open), 0, 1) : 1; }

  /** A shoulder (side -1 left, 1 right on screen) and the hand at the end of that arm, in world space. */
  shoulder(s) {
    const pt = s < 0 ? DB_POINTS.shoulderL : DB_POINTS.shoulderR;
    return { x: this.x + pt.x * DB_SCALE, y: this.drawY + pt.y * DB_SCALE + (1 - this.risen) * DB_RISE };
  }

  hand(s) {
    const sh = this.shoulder(s);
    return { x: sh.x + Math.cos(this.arm[s]) * 24 * DB_SCALE, y: sh.y + Math.sin(this.arm[s]) * 24 * DB_SCALE };
  }

  /** Tendrils still on its back (not out in the room or diving into the ground). */
  get backTendrils() {
    if (this.phase === 3 && this.state !== 'vanish') return 0;
    return Math.max(0, 8 - this.tendrilsOut - this.sinking);
  }

  drawGround(ctx) {
    if (this.dead) return;
    if (this.intro > 0) this.drawPortal(ctx);
    if (this.alpha > 0) drawShadow(ctx, this.x, this.y + 4, 40, 11, 0.4 * this.alpha);
    if (this.sinking && this.state === 'cast') {
      // a pool of darkness at its feet where the tendrils go down
      const k = clamp(this.t / this.cfg.tendrils.sinkTime, 0, 1);
      PFX.disc(ctx, this.x, this.y + 4, 30 * Math.sin(k * Math.PI) + 6, 10, 'rgba(6, 2, 12, 0.8)', 2);
    }
    for (const td of this.tendrils) td.drawGround(ctx);
    const c = this.cfg.bombs;
    for (const b of this.bombs) {
      if (b.t < c.flight) continue;
      // where a bomb will burst: a dark ring tightening as the fuse burns
      const k = clamp((b.t - c.flight) / c.fuse, 0, 1);
      PFX.ring(ctx, b.x, b.y, c.radius, c.radius * 0.6, `rgba(154, 106, 255, ${0.3 + k * 0.5})`, 2, { dash: [4, 3], spin: b.t * 3 });
      PFX.disc(ctx, b.x, b.y, c.radius * k, c.radius * 0.6 * k, 'rgba(10, 4, 20, 0.35)', 2);
    }
  }

  /** The entrance portal: a swirling pit of darkness rimmed in violet, opening then closing. */
  drawPortal(ctx) {
    const I = DB_INTRO;
    const e = this.introAt;
    const open = e < I.open ? 1 - (1 - e / I.open) ** 3 : e < I.close ? 1 : clamp(1 - (e - I.close) / (I.total - I.close), 0, 1);
    if (open <= 0) return;
    const rx = 96 * open;
    const ry = 36 * open;
    ctx.save();
    PFX.disc(ctx, this.x, this.y, rx + 8, ry + 4, 'rgba(60, 20, 100, 0.35)', 3);
    PFX.disc(ctx, this.x, this.y, rx, ry, '#030106', 2);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.28;
      PFX.ring(ctx, this.x, this.y, rx * k, ry * k, `rgba(${i ? '106, 58, 160' : '170, 120, 255'}, ${0.9 - i * 0.25})`, 2, { dash: [6, 4], spin: (i % 2 ? -1 : 1) * this.time * (2 + i) });
    }
    PFX.glow(ctx, this.x, this.y - 10, rx * 0.9, '120, 60, 220', 0.6 * open, 2, rx * 0.5);
    ctx.restore();
  }

  getDrawables() {
    const out = [];
    if (this.dead) return out;
    for (const td of this.tendrils) out.push({ y: td.y, draw: (ctx) => td.draw(ctx) });
    if (this.alpha > 0 && this.risen > 0) out.push({ y: this.y, draw: (ctx) => this.drawBody(ctx) });
    const c = this.cfg.bombs;
    for (const b of this.bombs) out.push({ y: b.t < c.flight ? this.y + 1000 : b.y, draw: (ctx) => this.drawBomb(ctx, b) });
    if (this.double && this.alpha > 0) {
      // each scythe sorts by where it is on its circle (in front of it on the near side, behind on the far)
      this.scythePoints().forEach((p, i) => out.push({ y: this.y + Math.sin(this.orbitAngle + i * Math.PI) * 30, draw: (ctx) => this.drawFloatingScythe(ctx, p, i) }));
    }
    return out;
  }

  /** The portrait for the title card: its body with its scythes in hand. */
  drawPortrait(ctx) { this.drawBody(ctx); }

  drawBody(ctx) {
    const rise = (1 - this.risen) * DB_RISE;
    const x = Math.round(this.x);
    const y = Math.round(this.drawY + rise);
    ctx.save();
    if (rise > 0) {
      // rising out of the portal: nothing below the floor shows
      ctx.beginPath();
      ctx.rect(x - 300, this.y - 800, 600, 804);
      ctx.clip();
    }
    // everything below is drawn at sprite size, scaled up round its feet
    ctx.translate(x, y);
    ctx.scale(DB_SCALE, DB_SCALE);
    ctx.translate(-x, -y);
    ctx.globalAlpha = this.alpha;
    const shade = this.phase === 3;
    // a dark aura round it
    PFX.glow(ctx, x, y - 44, 70, '20, 6, 36', 0.55, 2, 40);
    // the tendrils on its back (behind it)
    const n = this.intro > 0 ? Math.round(8 * clamp((this.introAt - 2.0) / 0.6, 0, 1)) : this.backTendrils;
    for (let i = 0; i < 8; i++) {
      if (!this.tendrilOn(i, n)) continue;
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const ang = -Math.PI / 2 + side * (0.45 + k * 0.32);
      drawDarkTendril(ctx, x + side * 4, y + DB_POINTS.back.y, ang, 52 + k * 7, this.time, i, 6, side);
    }
    // the body
    const frame = Sprites.deathbringer.body[Math.floor(this.time * 5) % 4];
    if (shade) {
      // the shade: a black shape edged in violet light, so it can be seen coming in the dark
      const flick = 0.6 + 0.4 * Math.sin(this.time * 12);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSprite(ctx, frame.rim, x + dx, y + dy, DB_SPRITE.ax, DB_SPRITE.ay, this.facing < 0, this.alpha * flick);
    }
    drawSprite(ctx, shade ? frame.shade : frame.img, x, y, DB_SPRITE.ax, DB_SPRITE.ay, this.facing < 0, this.alpha * (shade ? 0.9 : 1));
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, x, y, DB_SPRITE.ax, DB_SPRITE.ay, this.facing < 0, this.alpha * 0.7);
    // the darkness in its hood: a pit of black with a faint violet breath round it
    const fx = x + DB_POINTS.face.x;
    const fy = y + DB_POINTS.face.y;
    PFX.glow(ctx, fx, fy, 14, '0, 0, 0', 0.9, 2, 8);
    if (shade || this.phase >= 2) {
      // two pinpricks of violet light deep inside (only once it's angry)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const dx of [-3, 3]) PFX.glow(ctx, fx + dx, fy, 4, '170, 110, 255', 0.9, 1);
      ctx.restore();
    }
    // arms and (phase 1) the scythes in its hands
    if (!shade) for (const s of [-1, 1]) this.drawArm(ctx, s, x, y);
    ctx.restore();
  }

  /** Which of its 8 back tendrils show when only n are home (the outermost go first). */
  tendrilOn(i, n) {
    const order = [3, 7, 2, 6, 1, 5, 0, 4];   // outermost pairs first
    return order.indexOf(i) >= 8 - n;
  }

  /** A ragged sleeve from the shoulder to a bony hand; in phase 1 the hand holds its scythe (sprite size, round its feet at x, y). */
  drawArm(ctx, s, x, y) {
    const pt = s < 0 ? DB_POINTS.shoulderL : DB_POINTS.shoulderR;
    const sh = { x: x + pt.x, y: y + pt.y };
    const h = { x: sh.x + Math.cos(this.arm[s]) * 24, y: sh.y + Math.sin(this.arm[s]) * 24 };
    fatLine(ctx, sh.x, sh.y, h.x, h.y, OUTLINE, 9);
    fatLine(ctx, sh.x, sh.y, h.x, h.y, DB_ROBE[2], 7);
    fatLine(ctx, sh.x, sh.y - 2, h.x, h.y - 2, DB_ROBE[3], 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(h.x) - 3, Math.round(h.y) - 3, 7, 7);
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(Math.round(h.x) - 2, Math.round(h.y) - 2, 5, 5);
    if (this.double) {
      if (this.state === 'bombs' && !this.thrown) {
        // a shadow bomb swelling in its hand
        const r = 2 + 5 * clamp(this.t / this.cfg.bombs.windup, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, h.x, h.y - 2, r * 3, '140, 80, 255', 0.7, 2);
        ctx.restore();
        PFX.disc(ctx, h.x, h.y - 2, r + 1, r + 1, OUTLINE, 1);
        PFX.disc(ctx, h.x, h.y - 2, r, r, '#0a0412', 1);
        PFX.ring(ctx, h.x, h.y - 2, Math.max(1, r - 1), Math.max(1, r - 1), '#9a6aff', 1, { dash: [2, 2], spin: this.time * 8 });
      }
      return;
    }
    // the scythes are only formed once the darkness has gathered (in the entrance)
    const forged = this.intro > 0 ? clamp((this.introAt - (DB_INTRO.forge - 0.4)) / 0.4, 0, 1) : 1;
    if (forged <= 0) return;
    const img = Sprites.deathbringer.scythe;
    const ang = this.arm[s] - s * Math.PI / 2;
    ctx.save();
    ctx.globalAlpha *= forged;
    drawRotated(ctx, img, h.x, h.y, 22, 22, ang, s < 0);
    ctx.restore();
  }

  /**
   * Phase 2: double scythe i spinning as it circles it. The one about to loose a wave
   * swells with violet light, with motes of darkness drawn in round it.
   */
  drawFloatingScythe(ctx, p, i) {
    const img = Sprites.deathbringer.doubleScythe;
    const charge = i === this.waveTurn ? this.waveCharge : 0;
    // whirling fast (phase 3): fading afterimages trail it round its circle
    const blur = clamp((this.orbitSpin - 5) / 6, 0, 1);
    if (blur > 0) {
      const y0 = this.drawY - 58;   // (the circle's centre, as scythePoints)
      for (let k = 1; k <= 3; k++) {
        const a = this.orbitAngle + i * Math.PI - k * 0.32;
        ctx.save();
        ctx.globalAlpha = this.alpha * blur * (0.35 - k * 0.09);
        ctx.translate(this.x + Math.cos(a) * this.orbitR, y0 + Math.sin(a) * this.orbitR * 0.6);
        ctx.scale(DB_SCALE, DB_SCALE);
        drawRotated(ctx, img, 0, 0, img.width / 2, 22, this.spinAngle * (i ? -1 : 1) + i - k * 0.5);
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalAlpha = this.alpha;
    drawShadow(ctx, p.x, this.y + (p.y - this.drawY + 58), 22, 6, 0.25 * this.alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, p.x, p.y, 48 + charge * 30, '120, 70, 220', 0.45 + charge * 0.4, 2, 28);
    if (charge > 0) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + this.time * 3;
        const r = 44 * (1 - ((this.time * 2 + k / 6) % 1)) * charge + 6;
        ctx.fillStyle = k % 2 ? '#c8b8ff' : '#9a6aff';
        ctx.fillRect(Math.round(p.x + Math.cos(a) * r) - 1, Math.round(p.y + Math.sin(a) * r) - 1, 3, 3);
      }
    }
    ctx.restore();
    ctx.translate(p.x, p.y);
    ctx.scale(DB_SCALE, DB_SCALE);
    drawRotated(ctx, img, 0, 0, img.width / 2, 22, this.spinAngle * (i ? -1 : 1) + i);
    ctx.restore();
  }

  /** A shadow bomb: a black orb arcing through the air, then sitting and swelling with violet light. */
  drawBomb(ctx, b) {
    const c = this.cfg.bombs;
    let x = b.x;
    let y = b.y - 8;
    let r = 7;
    if (b.t < c.flight) {
      const k = clamp(b.t / c.flight, 0, 1);
      if (k <= 0) return;
      x = lerp(b.x0, b.x, k);
      y = lerp(b.y0, b.y - 8, k) - Math.sin(k * Math.PI) * 70;
      drawShadow(ctx, lerp(b.x0, b.x, k), lerp(b.y0 + 60, b.y, k), 6, 2, 0.3);
    } else {
      r = 7 + clamp((b.t - c.flight) / c.fuse, 0, 1) * 5 + Math.sin(b.t * 30) * 1;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, r * 3, '140, 80, 255', 0.7, 2);
    ctx.restore();
    PFX.disc(ctx, x, y, r + 1, r + 1, OUTLINE, 1);
    PFX.disc(ctx, x, y, r, r, '#0a0412', 1);
    PFX.ring(ctx, x, y, r - 1, r - 1, '#9a6aff', 1, { dash: [2, 2], spin: b.t * 8 });
    ctx.fillStyle = '#c8b8ff';
    ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), 2, 2);
  }

  /** Its glow, its tendrils' and its bombs' in the room's darkness (DungeonRun.lights). */
  addLights(out) {
    if (this.dead) return;
    if (this.alpha > 0.1) out.push({ x: this.x, y: this.drawY - 70, r: 150, s: 0.45 * this.alpha, rgb: '150, 90, 255' });
    for (const td of this.tendrils) out.push({ x: td.x, y: td.y - 30, r: 60, s: 0.35, rgb: '150, 90, 255' });
    for (const b of this.bombs) out.push({ x: b.x, y: b.y, r: 50, s: 0.5, rgb: '170, 110, 255' });
    if (this.double) for (const p of this.scythePoints()) out.push({ x: p.x, y: p.y, r: 60, s: 0.45, rgb: '150, 90, 255' });
  }

  drawOverlay() {}
}

/**
 * One of the Deathbringer's tendrils, risen out of the ground in its room: it sways, now and then
 * rears up and slams the ground (a shockwave and a ring of small waves of darkness). It can be
 * cut down (then it sinks and flies home to the Deathbringer).
 */
class DeathTendril {
  constructor(boss, x, y) {
    this.boss = boss;
    this.cfg = boss.cfg.tendrils;
    this.x = x;
    this.y = y;
    this.maxHp = Math.round(this.cfg.hp * (boss.maxHp / CONFIG.deathbringer.hp));   // as tough as the stage made its master
    this.hp = this.maxHp;
    this.radius = 20;
    this.state = 'rise';     // rise | idle | windup | slam | sink | home
    this.t = 0;
    this.slamTimer = rand(...this.cfg.slamEvery) * 0.6;
    this.flashTime = 0;
    this.dead = false;
    this.seed = rand(0, 10);
    this.side = Math.random() < 0.5 ? -1 : 1;
  }

  get hx() { return this.x; }
  get hy() { return this.y - 36; }
  get hittable() { return this.state === 'idle' || this.state === 'windup' || this.state === 'slam'; }

  knockback() {}
  stun() {}

  takeDamage(amount, world) {
    if (!this.hittable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      world.effects.text(this.x, this.y - 60, 'SEVERED', { color: '#c8b8ff', size: 8 });
      this.boss.tendrilsReadyAt = this.boss.time + this.cfg.respawnDelay;   // no new ones for a while
      this.recall(world);
    }
    return true;
  }

  /** Sinks back into the ground and flies home to its master. */
  recall(world) {
    if (this.state === 'sink' || this.state === 'home') return;
    this.state = 'sink';
    this.t = 0;
    world.effects.burst(this.x, this.y - 30, { count: 20, colors: DB_DARK.concat('#6a3aa0'), speed: [40, 140], life: [0.3, 0.7], up: 30 });
    Sound.play('wraithDie', 0.1);
  }

  update(dt, world) {
    const c = this.cfg;
    this.t += dt;
    this.flashTime -= dt;
    switch (this.state) {
      case 'rise':
        if (this.t >= c.riseTime) { this.state = 'idle'; this.t = 0; }
        break;
      case 'idle':
        this.slamTimer -= dt;
        if (this.slamTimer <= 0) { this.state = 'windup'; this.t = 0; Sound.play('windup', 0.15); }
        break;
      case 'windup':
        if (this.t >= c.slamWindup) { this.slam(world); this.state = 'slam'; this.t = 0; }
        break;
      case 'slam':
        if (this.t >= 0.35) { this.state = 'idle'; this.t = 0; this.slamTimer = rand(...c.slamEvery); }
        break;
      case 'sink':
        if (this.t >= 0.5) {
          // a streak of darkness flies home to the Deathbringer's back
          this.state = 'home';
          this.t = 0;
          const b = this.boss;
          const x0 = this.x;
          const y0 = this.y - 10;
          world.effects.add(0.5, (ctx, t) => {
            const px = lerp(x0, b.x, t);
            const py = lerp(y0, b.drawY - 52, t) - Math.sin(t * Math.PI) * 60;
            PFX.glow(ctx, px, py, 12, '20, 6, 36', 0.9, 2);
            ctx.fillStyle = '#9a6aff';
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
          });
        }
        break;
      case 'home':
        if (this.t >= 0.5) { this.dead = true; this.boss.tendrilHome(); }
        break;
    }
  }

  /** The slam: heroes right under it are struck, a shockwave rolls out and small waves of darkness fly off all round. */
  slam(world) {
    const c = this.cfg;
    const b = this.boss;
    for (const h of world.allies) if (dist(h.x, h.y, this.x, this.y) < c.slamRadius + (h.radius || 10) * 0.5) h.hurt(c.slamDamage, world, this.x, this.y);
    world.addShockwave(this.x, this.y, { ...c.shockwave, color: '120, 70, 210' });
    const turn = rand(0, TAU);
    for (let i = 0; i < c.waves; i++) {
      const a = turn + (i / c.waves) * TAU;
      b.darkWave(world, this.x + Math.cos(a) * 14, this.y - 6 + Math.sin(a) * 8, a, { speed: c.waveSpeed, damage: c.waveDamage, life: c.waveLife, radius: 12, scale: 0.7 });
    }
    world.effects.burst(this.x, this.y - 4, { count: 22, colors: ['#3a3024', '#5e5040', '#1e1028', '#6a3aa0'], speed: [60, 180], life: [0.3, 0.6], up: 50 });
    world.shake(4, 0.2);
    Sound.play('stomp', 0.1);
  }

  /** The hole it grows out of. */
  drawGround(ctx) {
    const grow = this.state === 'rise' ? clamp(this.t / 0.25, 0, 1) : this.state === 'home' ? 1 - clamp(this.t / 0.3, 0, 1) : 1;
    if (grow <= 0) return;
    PFX.disc(ctx, this.x, this.y, 18 * grow, 7 * grow, '#030106', 2);
    PFX.ring(ctx, this.x, this.y, 20 * grow, 8 * grow, 'rgba(106, 58, 160, 0.7)', 2, { dash: [3, 3], spin: this.t * 2 });
    if (this.state === 'windup') {
      // where it will slam: a ring tightening
      const k = clamp(this.t / this.cfg.slamWindup, 0, 1);
      PFX.ring(ctx, this.x, this.y, this.cfg.slamRadius, this.cfg.slamRadius * 0.6, `rgba(154, 106, 255, ${0.3 + 0.6 * k})`, 2, { dash: [4, 3] });
    }
  }

  draw(ctx) {
    const c = this.cfg;
    let len = 78;
    let ang = -Math.PI / 2;
    if (this.state === 'rise') len *= clamp(this.t / c.riseTime, 0, 1);
    else if (this.state === 'sink') len *= 1 - clamp(this.t / 0.5, 0, 1);
    else if (this.state === 'home') return;
    else if (this.state === 'windup') {
      const k = clamp(this.t / c.slamWindup, 0, 1);
      len *= 1 + 0.25 * k;
      ang -= this.side * 0.55 * k;   // rearing back
    } else if (this.state === 'slam') {
      // whipping down onto the floor, then lifting back up
      const k = this.t < 0.12 ? this.t / 0.12 : 1 - clamp((this.t - 0.12) / 0.2, 0, 1);
      ang += this.side * 1.3 * k;
    }
    if (len < 2) return;
    drawDarkTendril(ctx, this.x, this.y, ang, len, this.boss.time, this.seed, 9, this.side);
    if (this.flashTime > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.y - len / 2, 22, '255, 255, 255', 0.6);
      ctx.restore();
    }
  }
}

/**
 * A tendril of living darkness from (x, y) toward angle `ang`, `len` long and `thick` at its root,
 * tapering to a hooked tip and swaying with `time` (seed staggers it). side: which way its tip curls.
 */
function drawDarkTendril(ctx, x, y, ang, len, time, seed, thick, side = 1) {
  const n = 9;
  const pts = [[x, y]];
  let a = ang;
  let px = x;
  let py = y;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    a = ang + Math.sin(time * 2.2 + seed + k * 3) * 0.35 * k + side * k * k * 0.8;
    px += Math.cos(a) * (len / n);
    py += Math.sin(a) * (len / n);
    pts.push([px, py]);
  }
  for (const [color, extra] of [[OUTLINE, 2], ['#1e1028', 0]]) {
    for (let i = 1; i < pts.length; i++) {
      const w = Math.max(2, Math.round(thick * (1 - (i - 1) / n) + extra));
      fatLine(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], color, w);
    }
  }
  // a violet sheen down its top side, and suckers of light along it
  for (let i = 1; i < pts.length - 1; i++) {
    fatLine(ctx, pts[i - 1][0] - 1, pts[i - 1][1] - 1, pts[i][0] - 1, pts[i][1] - 1, '#4a2a6a', 1);
    if (i % 2 === 0) {
      ctx.fillStyle = '#9a6aff';
      ctx.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]), 1, 1);
    }
  }
  // the hooked tip
  const [tx, ty] = pts[pts.length - 1];
  fatLine(ctx, tx, ty, tx + Math.cos(a + side * 1.6) * 5, ty + Math.sin(a + side * 1.6) * 5, '#2e1a40', 2);
}

/** A solid line `w` px thick (square pixels stamped along it, snapped to whole pixels). */
function fatLine(ctx, x1, y1, x2, y2, color, w) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  const h = Math.floor(w / 2);
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x1 + (x2 - x1) * t) - h, Math.round(y1 + (y2 - y1) * t) - h, w, w);
  }
}
