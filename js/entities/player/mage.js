// Mage: spends mana. LMB homing magic missiles, RMB frostfire ball, E lightning
// strike (pick a target with LMB), F bird form, Q placeable mana-drain magic circle.

const MAGIC_CIRCLE_SY = 0.6; // the drain circle is drawn squashed vertically (floor perspective)

// pixel effect colours: the mage's ghost-teal magic, brass and wine
const MAGE_FX = {
  sparkle: ['#3fc2a8', '#9cf0d8', '#ffffff'],
  glow: '63, 194, 168',
  brass: '#b08a3e',
  flame: ['#0e3a3a', '#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'],   // ghost fire, outer first
  ice: ['#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'],
  smoke: ['#141c22', '#26363c', '#3e5a5a'],
};

/** Jagged path between two points; jitter = max sideways kink. Visual randomness only. */
function zigzag(x1, y1, x2, y2, jitter, step = 18) {
  const pts = [];
  const n = Math.max(3, Math.round(dist(x1, y1, x2, y2) / step));
  const nx = -(y2 - y1) / (dist(x1, y1, x2, y2) || 1);
  const ny = (x2 - x1) / (dist(x1, y1, x2, y2) || 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : vrand(-jitter, jitter);
    pts.push([lerp(x1, x2, t) + nx * j, lerp(y1, y2, t) + ny * j]);
  }
  return pts;
}

class Mage extends Player {
  constructor(x, y) {
    super('mage', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.staff;
    this.maxCooldowns = {
      primary: c.bolt.cooldown, secondary: c.fireball.cooldown, e: c.lightning.cooldown,
      f: c.bird.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'MISSILE', secondary: 'FROSTFIRE', e: 'LIGHTNING', f: 'BIRD', q: 'DRAIN' };
    this.recoil = 0;
    this.targeting = false;   // choosing a lightning target
    this.placing = false;     // choosing where the Q circle goes
    this.placePos = { x, y };
    this.strikes = [];
    this.bird = null;         // bird form: { t }
    this.circles = [];
    this.manaSurge = 0;       // passive: seconds of boosted damage left
  }

  // ---------- passive: Mana Surge ----------

  get damageMultiplier() { return this.manaSurge > 0 ? this.cfg.passive.damageMultiplier : 1; }

  /** Mana orb pickup: boosts all damage for a moment. Another orb refreshes it. */
  startManaSurge(world) {
    if (!(this.manaSurge > 0)) world.effects.text(this.hx, this.hy - 40, 'MANA SURGE!', { color: '#9cf0d8', size: 8, life: 1 });
    this.manaSurge = this.cfg.passive.duration;
    world.effects.burst(this.hx, this.hy, { count: 14, colors: MAGE_FX.sparkle, speed: [40, 120], life: [0.3, 0.6], up: 30 });
  }

  get passiveInfo() {
    const c = this.cfg.passive;
    const on = this.manaSurge > 0;
    return {
      name: 'MANA SURGE', color: '#9cf0d8', ready: on,
      text: on ? `+${Math.round((c.damageMultiplier - 1) * 100)}% DAMAGE` : 'GRAB MANA ORBS',
      bar: on ? this.manaSurge / c.duration : null,
    };
  }

  get tipX() { return this.pivotX + Math.cos(this.aim) * 30; }
  get tipY() { return this.pivotY + 4 + Math.sin(this.aim) * 22; }

  get channeling() { return !!this.bird; }
  /** In bird form she flies over obstacles (cover, furniture, hedges) and spike traps (walls and doors still stop her). */
  get flying() { return !!this.bird; }
  get moveMultiplier() { return this.bird ? this.cfg.bird.speedMultiplier : 1; }

  handleMouse(world) {
    const m = Input.mouse;
    if (this.placing) {
      if (m.rightPressed) this.placing = false;
      else if (m.leftPressed) this.placeCircle(world);
      return;
    }
    if (!this.targeting) return super.handleMouse(world);
    if (m.rightPressed) { this.targeting = false; return; }
    if (m.leftPressed) this.castLightning(world);
  }

  // ---------- LMB: magic missile ----------

  primary(world) {
    const c = this.cfg.bolt;
    this.cooldowns.primary = c.cooldown;
    // Empowered Mana Surge: cast with over 150 mana, the missile is bigger and hits 30% harder
    const empowered = Upgrades.has(this, 'empoweredSurge') && this.resource.value > 150;
    if (!this.spend(c.cost, world)) return;
    if (empowered) Upgrades.state(this).flash.empoweredSurge = world.time;
    this.recoil = 0.08;
    const m = world.mouseWorld;
    const spread = rand(-0.12, 0.12);
    world.playerProjectiles.push(new Projectile({
      x: this.tipX, y: this.tipY,
      vx: Math.cos(this.aim + spread) * c.speed,
      vy: Math.sin(this.aim + spread) * c.speed,
      radius: 6, damage: c.damage * (empowered ? 1.3 : 1), life: c.life, knockback: 60, scale: empowered ? 1.5 : 1,
      sprite: Sprites.projectiles.bolt, spin: 10, glow: empowered ? '156, 255, 240' : MAGE_FX.glow, trail: ['#3fc2a8', '#9cf0d8'],
      // two motes circling the missile, and twinkles left hanging in its wake
      aura: (ctx, p) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const a = p.age * 16 + i * Math.PI;
          PFX.star(ctx, p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9, 1, '#9cf0d8', '#ffffff', 2);
        }
        ctx.restore();
      },
      fx: (p, dt, w) => {
        if (vrand(0, 1) > dt * 18) return;
        const sx = p.x + vrand(-4, 4);
        const sy = p.y + vrand(-4, 4);
        w.effects.add(vrand(0.25, 0.4), (ctx, t) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t;
          PFX.star(ctx, sx, sy, t < 0.5 ? 2 : 1, '#3fc2a8', '#f0fff8', 2);
          ctx.restore();
        });
      },
      target: nearestTarget(world, m.x, m.y, 160),
      homing: (p, dt, w) => {
        if (!p.target || p.target.dead || !w.getTargets().includes(p.target)) {
          p.target = nearestTarget(w, p.x, p.y, c.seekRange);
        }
        if (!p.target) return;
        const cur = Math.atan2(p.vy, p.vx);
        const want = angleTo(p.x, p.y, p.target.hx, p.target.hy);
        const turn = clamp(angleDiff(cur, want), -c.turnRate * dt, c.turnRate * dt);
        p.vx = Math.cos(cur + turn) * c.speed;
        p.vy = Math.sin(cur + turn) * c.speed;
      },
    }));
    Sound.play('arcaneBolt');
  }

  // ---------- RMB: fireball ----------

  secondary(world) {
    const c = this.cfg.fireball;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.secondary = c.cooldown;
    this.recoil = 0.2;
    const m = world.mouseWorld;
    const travel = Math.min(dist(this.tipX, this.tipY, m.x, m.y), c.maxRange);
    world.playerProjectiles.push(new Projectile({
      x: this.tipX, y: this.tipY,
      vx: Math.cos(this.aim) * c.speed,
      vy: Math.sin(this.aim) * c.speed,
      radius: 9, damage: 0, life: travel / c.speed,
      sprite: Sprites.projectiles.fireball, spin: 8, glow: MAGE_FX.glow, trail: ['#1f7a72', '#3fc2a8', '#9cf0d8'],
      // frostfire: ghostly teal flames streaming back off the ball, frost motes orbiting it
      aura: (ctx, p) => {
        const back = Math.atan2(p.vy, p.vx) + Math.PI;
        const flicker = Math.sin(p.age * 35) * 3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, p.x, p.y, 24, MAGE_FX.glow, 0.7);
        const bright = MAGE_FX.flame.slice(1);   // the darkest teal adds nothing in 'lighter'
        PFX.beam(ctx, p.x, p.y, back, 36 + flicker, 18 + flicker, bright, 2);
        PFX.flame(ctx, p.x, p.y + 6, 16, 28 + flicker, p.age, bright);
        ctx.restore();
        // frost shards orbiting the flames (solid, so they read against the glow)
        for (let i = 0; i < 4; i++) {
          const a = -p.age * 7 + (i * TAU) / 4;
          PFX.shard(ctx, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 14, a + Math.PI / 2, 11, 6, ['#1f5a8a', '#9ad0ff', '#ffffff']);
        }
      },
      fx: (p, dt, w) => {
        if (vrand(0, 1) < dt * 24) {
          w.effects.burst(p.x + vrand(-6, 6), p.y + vrand(-6, 6), { count: 1, colors: ['#9cf0d8', '#3fc2a8', '#f0fff8'], speed: [10, 40], life: [0.3, 0.6], up: 40, size: [1, 3] });
        }
      },
      onHit: (p, w) => this.explode(w, p.x, p.y),
    }));
    Sound.play('frostfireCast');
  }

  explode(world, x, y) {
    const c = this.cfg.fireball;
    this.hitCircle(world, x, y, c.radius, c.damage, { knockback: 260, sound: 'hit', fire: true });
    world.effects.burst(x, y, { count: 30, colors: ['#1f7a72', '#3fc2a8', '#9cf0d8', '#2a2129'], speed: [80, 260], life: [0.3, 0.7], size: [3, 6] });
    // frostfire: a crown of ghost flames, shards of teal ice and a dark smoke cloud
    world.effects.flames(x, y + 8, { count: 7, spread: c.radius * 0.55, height: 42, width: 16, life: 0.7, colors: MAGE_FX.flame });
    world.effects.shards(x, y, { count: 14, speed: [180, 340], life: 0.5, len: [9, 15], width: 6, colors: MAGE_FX.ice });
    world.effects.smoke(x, y - 6, { count: 9, radius: c.radius * 0.5, life: 0.9, rise: 30, colors: MAGE_FX.smoke });
    world.effects.add(0.35, (ctx, t) => {
      // ghost-teal blast: stepped bands round a white-hot core, ring racing out
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const r = c.radius * (0.4 + t * 0.7);
      PFX.disc(ctx, x, y, r, r, 'rgba(31, 122, 114, 0.7)', 3);
      PFX.disc(ctx, x, y, r * 0.7, r * 0.7, 'rgba(63, 194, 168, 0.6)', 3);
      PFX.disc(ctx, x, y, c.radius * 0.45 * (1 - t), c.radius * 0.45 * (1 - t), '#f0fff8', 3);
      PFX.ring(ctx, x, y, r * 1.1, r * 1.1, '#9cf0d8', 3);
      ctx.restore();
    });
    // scorched floor with ghost flames guttering out on it
    const embers = Array.from({ length: 5 }, () => ({ dx: vrand(-0.5, 0.5) * c.radius, dy: vrand(-0.3, 0.3) * c.radius, phase: vrand(0, 10) }));
    world.effects.add(3, (ctx, t) => {
      PFX.disc(ctx, x, y, c.radius * 0.7, c.radius * 0.7, `rgba(20, 10, 10, ${0.35 * (1 - t)})`, 4);
      if (t > 0.6) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const s = 1 - t / 0.6;
      for (const e of embers) PFX.flame(ctx, x + e.dx, y + e.dy, 7 * s, 12 * s, e.phase + t * 3, MAGE_FX.flame);
      ctx.restore();
    }, true);
    world.shake(6, 0.25);
    Sound.play('frostfireBurst');
  }

  // ---------- E: lightning strike ----------

  abilityE(world) {
    if (this.targeting) { this.targeting = false; return; }
    if (this.resource.value < this.cfg.lightning.cost) { this.spend(this.cfg.lightning.cost, world); return; }
    this.targeting = true;
    this.placing = false;
    Sound.play('spellAim');
  }

  castLightning(world) {
    const c = this.cfg.lightning;
    const m = world.mouseWorld;
    const target = nearestTarget(world, m.x, m.y, c.selectRadius);
    if (!target) {
      Sound.play('denied');
      world.effects.text(m.x, m.y - 10, 'NO TARGET', { color: '#9cf0d8', size: 7 });
      return;
    }
    if (!this.spend(c.cost, world)) { this.targeting = false; return; }
    this.targeting = false;
    this.cooldowns.e = c.cooldown;
    this.strikes.push({ target, t: 0, x: target.hx, y: target.hy });
    Sound.play('thunderCharge');
  }

  updateStrikes(dt, world) {
    const c = this.cfg.lightning;
    for (const s of this.strikes) {
      s.t += dt;
      if (!s.target.dead) { s.x = s.target.hx; s.y = s.target.hy; }
      if (s.t < c.delay) continue;
      s.dead = true;
      const hit = new Set();
      if (!s.target.dead) {
        world.damageTarget(s.target, c.damage, { knockback: 80, sound: 'crit' });
        hit.add(s.target);
      }
      this.boltFx(world, s.x, s.y - 260, s.x, s.y, 5);
      this.strikeFx(world, s.x, s.y);
      // chain to nearby enemies
      let from = { x: s.x, y: s.y };
      for (let i = 0; i < c.arcCount; i++) {
        let next = null;
        let best = c.arcRange;
        for (const t of world.getTargets()) {
          if (hit.has(t) || t.immune) continue;
          const d = dist(from.x, from.y, t.hx, t.hy);
          if (d < best) { best = d; next = t; }
        }
        if (!next) break;
        hit.add(next);
        world.damageTarget(next, c.arcDamage, { knockback: 40 });
        this.boltFx(world, from.x, from.y, next.hx, next.hy, 3);
        from = { x: next.hx, y: next.hy };
      }
      world.shake(8, 0.3);
      Sound.play('thunderStrike');
    }
    removeDead(this.strikes);
  }

  /**
   * Jagged lightning bolt between two points, flickering between a few shapes,
   * with forks splitting off it. Visual only.
   */
  boltFx(world, x1, y1, x2, y2, width) {
    const shapes = [0, 1, 2].map(() => zigzag(x1, y1, x2, y2, 11));
    const forks = shapes[0].slice(1, -1).filter(() => vrand(0, 1) < 0.45).map(([fx, fy]) => {
      const a = angleTo(x1, y1, x2, y2) + vrand(0.5, 1.1) * vchoose([-1, 1]);
      const len = vrand(14, 30);
      return zigzag(fx, fy, fx + Math.cos(a) * len, fy + Math.sin(a) * len, 5, 8);
    });
    world.effects.add(0.35, (ctx, t) => {
      // chunky zigzag: a wide teal halo with a white core, re-forking as it flickers
      const pts = shapes[Math.floor(t * 14) % shapes.length];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t < 0.15 ? 1 : (1 - t) * (Math.floor(t * 20) % 3 ? 1 : 0.4);
      PFX.path(ctx, pts, 'rgba(63, 194, 168, 0.55)', Math.round(width * 1.6));
      PFX.path(ctx, pts, '#f0fff8', width > 3 ? 3 : 2);
      if (t < 0.6) for (const f of forks) PFX.path(ctx, f, '#9cf0d8', 2);
      ctx.restore();
    });
    world.effects.burst(x2, y2, { count: 10, colors: ['#ffffff', '#9cf0d8', '#3fc2a8'], speed: [60, 180], life: [0.15, 0.3] });
  }

  /** Where the main bolt lands: a flash down the sky, a shock ring, a scorch and arcs crackling over the ground. */
  strikeFx(world, x, y) {
    world.effects.add(0.2, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.beam(ctx, x, y - 300, Math.PI / 2, 300, 34 * (1 - t), ['#1f7a72', '#3fc2a8', '#9cf0d8'], 3, false);
      PFX.glow(ctx, x, y, 46 * (1 - t) + 10, '200, 255, 240', 1.5);
      ctx.restore();
    });
    world.effects.add(0.4, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const r = 10 + t * 50;
      PFX.ring(ctx, x, y + 6, r, r * 0.5, '#9cf0d8', 2, { thick: t < 0.5 ? 2 : 1 });
      ctx.restore();
    }, true);
    const arcs = Array.from({ length: 4 }, () => vrand(0, TAU));
    world.effects.add(0.8, (ctx, t) => {
      PFX.disc(ctx, x, y + 6, 22, 11, `rgba(10, 20, 20, ${0.45 * (1 - t)})`, 2);
      // little arcs of lightning jumping over the scorch
      if (Math.floor(t * 18) % 2) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      for (const a0 of arcs) {
        const a = a0 + t * 3;
        const ex = x + Math.cos(a) * 26;
        const ey = y + 6 + Math.sin(a) * 13;
        PFX.path(ctx, zigzag(x, y + 6, ex, ey, 4, 6), '#9cf0d8', 2);
      }
      ctx.restore();
    }, true);
    world.effects.burst(x, y, { count: 16, colors: ['#ffffff', '#9cf0d8', '#3fc2a8'], speed: [100, 260], life: [0.15, 0.35], size: [1, 3] });
  }

  /** Mana per slot (E while picking a target only cancels). */
  abilityCost(slot) {
    const c = this.cfg;
    return { primary: c.bolt.cost, secondary: c.fireball.cost, e: this.targeting ? 0 : c.lightning.cost, f: c.bird.cost }[slot] || 0;
  }

  // ---------- F: bird form ----------

  abilityF(world) {
    const c = this.cfg.bird;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.f = c.cooldown;
    this.bird = { t: 0, facing: this.facing };
    this.targeting = false;
    this.placing = false;
    this.radius = c.radius;   // tiny hitbox
    this.poof(world);
    Sound.play('birdForm');
  }

  updateBird(dt, world) {
    const b = this.bird;
    // F again lands early (ignoring the frame it started)
    if ((b.t > 0 && Input.pressed('f')) || b.t >= this.cfg.bird.duration) return this.endBird(world);
    Upgrades.birdTrail(this, world);   // Birdie Trail
    b.t += dt;
    // the bird faces the way it flies (not the mouse), keeping its heading when hovering or flying straight up/down
    if (this.moving && this.moveDir.x) b.facing = this.moveDir.x > 0 ? 1 : -1;
    this.facing = b.facing;
    if (this.moving && Math.random() < 0.3) {
      world.effects.burst(this.x, this.y - 18, { count: 1, colors: ['#3fc2a8', '#9cf0d8'], speed: [5, 20], life: [0.2, 0.4], size: [2, 3] });
    }
  }

  endBird(world) {
    this.bird = null;
    this.radius = 12;
    // landing on top of cover, furniture or a hedge: she flutters down beside it, onto open floor
    const f = world.dungeon;
    if (f.boxHitsWall(this.x, this.y, this.hw, this.hh)) {
      const pt = f.freePoint(this.x, this.y, this.hw, this.hh);
      this.x = pt.x;
      this.y = pt.y;
    }
    this.poof(world);
    Sound.play('birdLand');
  }

  poof(world) {
    world.effects.smoke(this.hx, this.hy + 2, { count: 9, radius: 16, life: 0.6, colors: MAGE_FX.smoke });
    world.effects.burst(this.hx, this.hy, { count: 18, colors: ['#2a2129', '#3c3038', '#3fc2a8', '#9cf0d8'], speed: [40, 140], life: [0.2, 0.5] });
  }

  // ---------- Q: mana drain circle ----------

  /** Q starts placing the circle (Q again cancels); the charge is only spent on placement. */
  ultimate() {
    this.ult = this.ultMax;
    this.placing = !this.placing;
    this.targeting = false;
    Sound.play('spellAim');
  }

  placeCircle(world) {
    this.placing = false;
    this.ult = 0;
    const { x, y } = this.placePos;
    this.circles.push({ x, y, t: 0, tick: 0 });
    // the circle slams down: a teal shockwave and a column of sparkles
    const r = this.cfg.ult.radius;
    world.effects.add(0.5, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, r * (0.6 + t * 0.7), r * (0.6 + t * 0.7) * MAGIC_CIRCLE_SY, '#9cf0d8', 2, { thick: 2 });
      PFX.beam(ctx, x, y, -Math.PI / 2, 120 * (1 - t * 0.5), 26 * (1 - t), MAGE_FX.flame, 3, false);
      ctx.restore();
    }, true);
    world.effects.burst(x, y, { count: 24, colors: MAGE_FX.sparkle, speed: [40, 160], life: [0.4, 0.8], up: 80, size: [1, 3] });
    Sound.play('manaDrain');
    world.shake(4, 0.3);
  }

  updateCircles(dt, world) {
    const c = this.cfg.ult;
    for (const pg of this.circles) {
      pg.t += dt;
      pg.tick -= dt;
      if (pg.tick <= 0) {
        pg.tick = c.tick;
        for (const t of world.getTargets()) {
          if (!this.inCircle(pg, t)) continue;
          const dealt = world.damageTarget(t, c.dps * c.tick, { sound: null, noCrit: true, color: '#9cf0d8', fromUlt: true });
          if (dealt) {
            this.gainResource(dealt * c.manaSteal);
            world.effects.burst(t.hx, t.hy, { count: 1, colors: ['#3fc2a8', '#9cf0d8'], speed: [0, 0], life: [0.4, 0.5], size: [3, 4] });
            const last = world.effects.particles[world.effects.particles.length - 1];
            const a = angleTo(t.hx, t.hy, this.hx, this.hy);
            last.vx = Math.cos(a) * 260;
            last.vy = Math.sin(a) * 260;
            last.drag = 0;
          }
        }
      }
      if (pg.t >= c.duration) pg.dead = true;
    }
    removeDead(this.circles);
  }

  /**
   * True if a target's feet are inside the drawn circle. The circle is an
   * ellipse on the floor (squashed to MAGIC_CIRCLE_SY), with a little slack
   * so bodies overlapping the rim still count.
   */
  inCircle(pg, t) {
    const r = this.cfg.ult.radius + Math.min(t.radius * 0.5, 8);
    const dx = (t.x - pg.x) / r;
    const dy = ((t.footY ?? t.y) - pg.y) / (r * MAGIC_CIRCLE_SY);
    return dx * dx + dy * dy <= 1;
  }

  updateAbility(dt, world) {
    this.world = world; // for the targeting preview while drawing
    this.recoil -= dt;
    this.manaSurge -= dt;
    if (this.manaSurge > 0 && Math.random() < 0.4) {
      world.effects.burst(this.x + rand(-10, 10), this.y - rand(0, 26), { count: 1, colors: MAGE_FX.sparkle, speed: [10, 30], life: [0.3, 0.5], up: 40 });
    }
    // while a drain circle is down, abilities come back within a second
    if (this.circles.length) {
      const cap = this.cfg.ult.activeCooldown;
      for (const k of ['secondary', 'e', 'f']) this.cooldowns[k] = Math.min(this.cooldowns[k], cap);
    }
    if (this.bird) this.updateBird(dt, world);
    const c = this.cfg.ult;
    const m = world.mouseWorld;
    const d = Math.min(dist(this.x, this.y, m.x, m.y), c.maxRange);
    const a = angleTo(this.x, this.y, m.x, m.y);
    this.placePos = { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
    this.updateStrikes(dt, world);
    this.updateCircles(dt, world);
  }

  drawGroundExtras(ctx) {
    const c = this.cfg.ult;
    for (const pg of this.circles) this.drawMagicCircle(ctx, pg, c);
    if (this.placing && this.isLocal) {
      // preview: the circle, pulsing
      const pulse = 0.55 + Math.sin(this.animTime * 8) * 0.15;
      this.drawMagicCircle(ctx, { x: this.placePos.x, y: this.placePos.y, t: this.animTime % 1 + 1 }, c, pulse);
    }
    for (const s of this.strikes) {
      const t = s.t / this.cfg.lightning.delay;
      PFX.zone(ctx, s.x, s.y + 14, 22, t, MAGE_FX.glow, { spin: s.t * 4 });
    }
  }

  /** Pixel arcane circle on the floor: brass and teal rings, turning rune ticks, two counter-turning squares. */
  drawMagicCircle(ctx, pg, c, alpha = 1) {
    const fade = Math.min(1, pg.t * 4, (c.duration - pg.t) * 2);
    const r = c.radius;
    const sy = MAGIC_CIRCLE_SY;
    const pt = (a, rr) => [pg.x + Math.cos(a) * rr, pg.y + Math.sin(a) * rr * sy];
    ctx.save();
    ctx.globalAlpha = fade * alpha;
    PFX.disc(ctx, pg.x, pg.y, r, r * sy, 'rgba(31, 122, 114, 0.16)', 4);
    ctx.globalCompositeOperation = 'lighter';
    PFX.ring(ctx, pg.x, pg.y, r, r * sy, MAGE_FX.brass, 2, { thick: 2 });
    PFX.ring(ctx, pg.x, pg.y, r * 0.88, r * 0.88 * sy, '#3fc2a8', 2);
    PFX.ring(ctx, pg.x, pg.y, r * 0.45, r * 0.45 * sy, '#3fc2a8', 2, { dash: [2, 2], spin: -pg.t });
    // rune ticks turning between the two outer rings: little crosses and dots
    for (let i = 0; i < 16; i++) {
      const [x, y] = pt(pg.t * 0.8 + (i * TAU) / 16, r * 0.94);
      if (i % 2) PFX.star(ctx, x, y, 1, '#9cf0d8', '#f0fff8');
      else { ctx.fillStyle = MAGE_FX.brass; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
    }
    // two squares turning in opposite directions
    for (const [dir, col] of [[1, '#3fc2a8'], [-1, MAGE_FX.brass]]) {
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = pt(dir * pg.t * 0.5 + (i * TAU) / 4, r * 0.88);
        const [x2, y2] = pt(dir * pg.t * 0.5 + ((i + 1) * TAU) / 4, r * 0.88);
        PFX.line(ctx, x1, y1, x2, y2, col, 2);
      }
    }
    // a teal star in the middle
    PFX.star(ctx, pg.x, pg.y, 3, '#3fc2a8', '#f0fff8', 2);
    ctx.restore();
  }

  drawExtras(ctx) {
    if (this.targeting && this.world && this.isLocal) {
      const m = this.cursor;
      const t = nearestTarget(this.world, m.x, m.y, this.cfg.lightning.selectRadius);
      const spin = this.animTime * 2;
      if (t) PFX.ring(ctx, t.hx, t.hy, t.radius + 8, t.radius + 8, '#9cf0d8', 2, { dash: [2, 2], spin });
      else PFX.ring(ctx, m.x, m.y, this.cfg.lightning.selectRadius, this.cfg.lightning.selectRadius, 'rgba(156, 240, 216, 0.4)', 2, { dash: [2, 2], spin });
    }
  }

  drawGround(ctx) {
    if (!this.bird) return super.drawGround(ctx);
    drawShadow(ctx, this.x, this.y + 9, 6, 2, 0.3);
    this.drawGroundExtras(ctx);
    Upgrades.drawGround(this, ctx, this.animTime);
  }

  draw(ctx) {
    if (!this.bird) return super.draw(ctx);
    if (this.dead) return;
    const frames = Sprites.items.birdFrames;
    const frame = frames[Math.floor(this.animTime * (this.moving ? 12 : 6)) % 2];
    const blink = this.invulnerable > 0 && this.flashTime <= 0 && Math.floor(this.invulnerable * 14) % 2 === 0;
    const bob = Math.sin(this.animTime * 6) * 2;
    drawSprite(ctx, frame.img, this.x, this.y - 18 + bob, 12, 9, this.facing < 0, blink ? 0.45 : 1);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, this.x, this.y - 18 + bob, 12, 9, this.facing < 0, 0.85);
    // time left
    const r = 1 - this.bird.t / this.cfg.bird.duration;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(this.x - 11), Math.round(this.y - 36), 22, 4);
    ctx.fillStyle = '#3fc2a8';
    ctx.fillRect(Math.round(this.x - 10), Math.round(this.y - 35), Math.round(20 * r), 2);
  }

  /** Ability outlines while a key is held: the lightning's pick radius, bird form on herself, the drain circle. */
  abilityPreview(slot) {
    if (slot === 'e') return { circle: { x: this.cursor.x, y: this.cursor.y, r: this.cfg.lightning.selectRadius } };
    if (slot === 'f') return { self: true };
    if (slot === 'q') return { circle: { x: this.placePos.x, y: this.placePos.y, r: this.cfg.ult.radius, sy: MAGIC_CIRCLE_SY } };
    return null;
  }

  get weaponReach() { return this.recoil > 0 ? 5 : 8; }
}

/** Closest attackable target to a point, within maxRange. */
function nearestTarget(world, x, y, maxRange) {
  let best = null;
  let bestD = maxRange;
  for (const t of world.getTargets()) {
    if (t.immune) continue;
    const d = dist(x, y, t.hx, t.hy);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
