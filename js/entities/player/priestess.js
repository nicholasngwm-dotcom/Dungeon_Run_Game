// Priestess: spends light orbs (no regen; marked enemies drop more).
// LMB ray of light at the cursor, RMB light missiles that mark enemies,
// E healing rune at her feet, F guardian aegis (LMB ally / RMB self), Q charged light bomb.

// pixel effect colours: holy gold and white, with her blue and a healing green
const PRIESTESS_FX = {
  beam: ['#a07a24', '#dcb44c', '#fbe796', '#ffffff'],
  gold: '255, 230, 128',
  motes: ['#ffffff', '#fff6c8', '#ffe680'],
};

/** A cross of light flaring at (x, y): arms `size` long, fading over t (0..1). */
function holyCross(ctx, x, y, size, t, k = 2) {
  const s = size * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) * 0.6);
  const w = Math.max(k, 8 * (1 - t));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - t;
  PFX.glow(ctx, x, y, s * 0.8, PRIESTESS_FX.gold, 1.2);
  PFX.beam(ctx, x, y - s, Math.PI / 2, s * 2.3, w, PRIESTESS_FX.beam, k, false);   // the upright runs long below
  PFX.beam(ctx, x - s * 0.75, y, 0, s * 1.5, w, PRIESTESS_FX.beam, k, false);
  ctx.restore();
}

/** A little green-and-gold cross of healing light floating up from (x, y) and fading (visual only). */
function healCross(world, x, y) {
  const gold = vrand(0, 1) < 0.35;
  const drift = vrand(-6, 6);
  world.effects.add(0.9, (ctx, t) => {
    const cx = Math.round(x + drift * t);
    const cy = Math.round(y - t * 32);
    const s = t < 0.15 ? 1 : 2;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, cx, cy, 7, gold ? '255, 230, 140' : '140, 255, 160', 0.6, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - s - 1, cy - s * 2 - 1, s * 2 + 2, s * 4 + 2);
    ctx.fillRect(cx - s * 2 - 1, cy - s - 1, s * 4 + 2, s * 2 + 2);
    ctx.fillStyle = gold ? '#ffe680' : '#8cf0a0';
    ctx.fillRect(cx - s, cy - s * 2, s * 2, s * 4);
    ctx.fillRect(cx - s * 2, cy - s, s * 4, s * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - s + 1, cy - s * 2 + 1, 1, 1);
    ctx.restore();
  });
}

class Priestess extends Player {
  constructor(x, y) {
    super('priestess', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.scepter;
    this.maxCooldowns = {
      primary: c.ray.cooldown, secondary: c.missiles.cooldown, e: c.rune.cooldown,
      f: c.aegis.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'RAY', secondary: 'MISSILES', e: 'RUNE', f: 'AEGIS', q: 'LIGHT BOMB' };
    this.recoil = 0;
    this.rays = [];             // beams waiting to land: { x, y, t }
    this.marks = new Map();     // missile marks: target -> world.time the mark expires
    this.runes = [];
    this.choosingAegis = false; // F pressed: LMB ally, RMB self
    this.bomb = null;           // charging the Q: { t }
    this.bombs = [];            // thrown bombs in flight
  }

  get channeling() { return !!this.bomb; }
  get moveMultiplier() { return this.bomb ? this.cfg.ult.moveMultiplier : 1; }

  /** Cursor position, pulled in to at most maxRange from the priestess. */
  aimPoint(world, maxRange) {
    const m = this.cursor;
    const d = Math.min(dist(this.x, this.y, m.x, m.y), maxRange);
    const a = angleTo(this.x, this.y, m.x, m.y);
    return { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
  }

  handleMouse(world) {
    const m = Input.mouse;
    if (this.choosingAegis) {
      if (m.leftPressed) this.castAegis(world, this.allyAtCursor(world));
      else if (m.rightPressed) this.castAegis(world, this);
      return;
    }
    super.handleMouse(world);
  }

  // ---------- LMB: ray of light ----------

  primary(world) {
    const c = this.cfg.ray;
    this.cooldowns.primary = c.cooldown;
    this.recoil = 0.12;
    const pt = this.aimPoint(world, c.maxRange);
    // Blinding Light: every 4th ray stuns what it hits
    const blind = Upgrades.has(this, 'blindingLight') && ++Upgrades.state(this).rays % 4 === 0;
    this.rays.push({ x: pt.x, y: pt.y, t: 0, blind });
    Sound.play('holyChime');
  }

  updateRays(dt, world) {
    const c = this.cfg.ray;
    for (const r of this.rays) {
      r.t += dt;
      if (r.t < c.delay) continue;
      r.dead = true;
      const was = world.basicHit;
      world.basicHit = r.tag || null;   // a basic attack's ray (see Forge.attack)
      const hit = this.hitCircle(world, r.x, r.y, c.radius, c.damage, { knockback: 60, stun: r.blind ? 1 : 0 });
      world.basicHit = was;
      const { x, y } = r;
      if (r.blind) {
        Upgrades.proc(this, world, 'blindingLight', hit.length ? 'BLINDING LIGHT!' : null);
        for (const t of hit) world.effects.text(t.hx, t.hy - 34, 'BLINDED', { color: '#fff6c8', size: 7 });
        // a white flash ringing out over the whole pool
        world.effects.add(0.45, (ctx, t) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t;
          PFX.disc(ctx, x, y, c.radius * 1.2, c.radius * 0.66, 'rgba(255, 255, 240, 0.5)', 2);
          PFX.ring(ctx, x, y, c.radius * (1 + t), c.radius * 0.55 * (1 + t), '#ffffff', 2, { thick: 2 });
          ctx.restore();
        });
      }
      world.effects.add(0.3, (ctx, t) => {
        // a pixel pillar of light falling from above onto a glowing pool
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        const w = c.radius * 1.2 * (1 - t * 0.5);
        PFX.disc(ctx, x, y, c.radius, c.radius * 0.55, 'rgba(255, 230, 128, 0.35)', 3);
        PFX.ring(ctx, x, y, c.radius, c.radius * 0.55, '#fbe796', 3);
        PFX.beam(ctx, x, y - 300, Math.PI / 2, 300, w, PRIESTESS_FX.beam, 3, false);
        ctx.restore();
      });
      world.effects.burst(x, y, { count: 12, colors: ['#ffffff', '#fff6c8', '#ffe680'], speed: [40, 140], life: [0.2, 0.4], up: 60 });
      // a cross flaring where it lands, a shock ring on the floor, and motes drifting up the pillar
      world.effects.add(0.4, (ctx, t) => holyCross(ctx, x, y - 10, 16, t));
      world.effects.add(0.35, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        const rr = c.radius * (0.6 + t * 0.8);
        PFX.ring(ctx, x, y, rr, rr * 0.55, '#fbe796', 2, { thick: t < 0.4 ? 2 : 1 });
        ctx.restore();
      }, true);
      world.effects.burst(x, y - 20, { count: 10, colors: PRIESTESS_FX.motes, speed: [5, 25], life: [0.5, 0.9], up: 70, size: [1, 2] });
      Sound.play('holyRay', 0.05);
    }
    removeDead(this.rays);
  }

  // ---------- RMB: missiles of light ----------

  secondary(world) {
    const c = this.cfg.missiles;
    this.cooldowns.secondary = c.cooldown;
    this.recoil = 0.2;
    // nearest enemies first, one missile each; with fewer enemies than missiles, they double up
    const targets = world.getTargets()
      .filter((t) => !t.immune && !t.prop)
      .sort((a, b) => dist(this.x, this.y, a.hx, a.hy) - dist(this.x, this.y, b.hx, b.hy))
      .slice(0, c.count);
    for (let i = 0; i < c.count; i++) {
      const angle = this.aim + (i / (c.count - 1) - 0.5) * 1.6;
      world.playerProjectiles.push(new Projectile({
        x: this.pivotX + Math.cos(angle) * 14,
        y: this.pivotY + Math.sin(angle) * 14,
        vx: Math.cos(angle) * c.speed,
        vy: Math.sin(angle) * c.speed,
        radius: 6, damage: c.damage, life: c.life, knockback: 50,
        sprite: Sprites.projectiles.lightMissile, glow: '255, 230, 128', trail: ['#ffe680', '#fff6c8'],
        // a twinkling star riding the missile, and sparkles hanging in its wake
        aura: (ctx, p) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          PFX.star(ctx, p.x, p.y, Math.floor(p.age * 12) % 2 ? 5 : 3, '#fbe796', '#ffffff', 2);
          ctx.restore();
        },
        fx: (p, dt, w) => {
          if (vrand(0, 1) > dt * 16) return;
          const sx = p.x + vrand(-3, 3);
          const sy = p.y + vrand(-3, 3);
          w.effects.add(vrand(0.25, 0.45), (ctx, t) => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - t;
            PFX.star(ctx, sx, sy, t < 0.5 ? 2 : 1, '#ffe680', '#ffffff', 2);
            ctx.restore();
          });
        },
        target: targets.length ? targets[i % targets.length] : null,
        homing: (p, dt, w) => {
          if (!p.target || p.target.dead || !w.getTargets().includes(p.target)) p.target = nearestTarget(w, p.x, p.y, 420);
          if (!p.target) return;
          const cur = Math.atan2(p.vy, p.vx);
          const want = angleTo(p.x, p.y, p.target.hx, p.target.hy);
          const turn = clamp(angleDiff(cur, want), -c.turnRate * dt, c.turnRate * dt);
          p.vx = Math.cos(cur + turn) * c.speed;
          p.vy = Math.sin(cur + turn) * c.speed;
        },
        onStrike: (p, w, t) => this.mark(t, w),
      }));
    }
    Sound.play('lightMissiles');
  }

  mark(target, world) {
    const { hx: x, hy: y } = target;
    world.effects.add(0.3, (ctx, t) => holyCross(ctx, x, y, 10, t));
    if (target.dead) return;
    if (!this.marks.has(target)) world.effects.text(target.hx, target.hy - 34, 'MARKED', { color: '#ffe680', size: 7 });
    this.marks.set(target, world.time + this.cfg.missiles.markDuration);
  }

  /** Passive (Divine Mark): hits on marked enemies may shake loose a light orb. */
  onDamageDealt(target, dmg, world) {
    const until = this.marks.get(target);
    if (!(until > world.time)) return;
    // killing a marked enemy always shakes loose a light orb; other hits on it only sometimes do
    if (target.dead) this.marks.delete(target);
    if (target.dead || Math.random() < this.cfg.passive.orbChance) {
      world.pickups.push(new LightPickup(target.x + rand(-10, 10), target.y + rand(-6, 6)));
    }
  }

  updateMarks(world) {
    for (const [t, until] of this.marks) {
      if (t.dead || until <= world.time) this.marks.delete(t);
    }
  }

  // ---------- E: rune of healing ----------

  /** E lays the rune down at her feet straight away (it stays where it was cast). */
  abilityE(world) {
    const c = this.cfg.rune;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.e = c.cooldown;
    this.choosingAegis = false;
    const pt = { x: this.x, y: this.y };
    this.runes.push({ x: pt.x, y: pt.y, t: 0 });
    world.effects.burst(pt.x, pt.y, { count: 18, colors: ['#9cf0a0', '#ffe680', '#ffffff'], speed: [30, 110], life: [0.3, 0.6], up: 40 });
    // a ring of light settling down onto the rune
    const rad = c.radius;
    world.effects.add(0.4, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t * 0.5;
      const e = 1 - (1 - t) ** 2;
      PFX.ring(ctx, pt.x, pt.y - 50 * (1 - e), rad * (1.4 - 0.4 * e), rad * (1.4 - 0.4 * e) * MAGIC_CIRCLE_SY, '#c8ffd0', 2, { thick: 2 });
      ctx.restore();
    });
    Sound.play('healRune');
  }

  updateRunes(dt, world) {
    const c = this.cfg.rune;
    for (const r of this.runes) {
      r.t += dt;
      if (r.t >= c.duration) { r.dead = true; continue; }
      for (const a of world.allies) {
        if (!a.heal || !this.inRune(r, a)) continue;
        a.heal(c.heal * dt, world, true);
        // little crosses of light float up off whoever is being healed, and every so often
        // a ring of light washes up over their feet
        if (vrand(0, 1) < dt * 7) healCross(world, a.x + vrand(-10, 10), a.y - vrand(6, 26));
        a.runeGlow = (a.runeGlow || 0) - dt;
        if (a.runeGlow <= 0) {
          a.runeGlow = 1;
          const hx = a.x;
          const hy = a.y;
          world.effects.add(0.6, (ctx, t) => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - t;
            PFX.ring(ctx, hx, hy + 2 - t * 26, 14 + t * 6, (14 + t * 6) * 0.45, '#9cf0a0', 2, { thick: 2 });
            PFX.glow(ctx, hx, hy - 14, 22, '140, 255, 160', 0.5 * (1 - t));
            ctx.restore();
          });
        }
      }
    }
    removeDead(this.runes);
  }

  /** Runes are ellipses on the floor, like the mage's circle. */
  inRune(r, a) {
    const rad = this.cfg.rune.radius;
    const dx = (a.x - r.x) / rad;
    const dy = (a.y - r.y) / (rad * MAGIC_CIRCLE_SY);
    return dx * dx + dy * dy <= 1;
  }

  // ---------- F: guardian aegis ----------

  /** F opens the choice (F again cancels); LMB shields the ally at the cursor, RMB yourself. */
  abilityF(world) {
    if (!this.choosingAegis && !this.canAfford('f')) { this.spend(this.cfg.aegis.cost, world); return; }
    this.choosingAegis = !this.choosingAegis;
    Sound.play(this.choosingAegis ? 'aim' : 'uiClick');
  }

  /** The ally (hero or clone) nearest the cursor that can carry an aegis; yourself if none is close. */
  allyAtCursor(world) {
    const m = this.cursor;
    let best = this;
    let bestD = this.cfg.aegis.selectRadius;
    for (const a of world.allies) {
      if (!a.applyAegis) continue;
      const d = dist(m.x, m.y, a.hx, a.hy);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  castAegis(world, target) {
    const c = this.cfg.aegis;
    this.choosingAegis = false;
    this.cooldowns.primary = 0.25; // so the choosing click doesn't also cast a ray
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.f = c.cooldown;
    // a teammate gets the stronger shield; on herself it's a lighter one
    target.applyAegis(target === this ? c.selfHp : c.allyHp, c.duration, world);
    Sound.play('aegis');
  }

  // ---------- Q: light bomb ----------

  castSlot(slot, world) {
    // the light bomb takes light orbs too: short of them it's refused, and keeps its charge
    // (in the saddle it's refused before anything is spent)
    if (slot === 'q' && this.ultReady && !this.riding && !this.spend(this.cfg.ult.cost, world)) return;
    super.castSlot(slot, world);
  }

  ultimate(world) {
    this.bomb = { t: 0 };
    this.choosingAegis = false;
    world.effects.text(this.hx, this.hy - 34, 'CHARGING', { color: '#ffe680', size: 8 });
    Sound.play('lightCharge');
  }

  /** 0..1 charge of the light bomb. */
  get bombPower() {
    return this.bomb ? clamp(this.bomb.t / this.cfg.ult.powerTime, 0, 1) : 0;
  }

  updateBomb(dt, world) {
    const c = this.cfg.ult;
    const b = this.bomb;
    // LMB throws early (ignoring the frame Q was pressed in)
    const release = b.t > 0 && Input.mouse.leftPressed;
    b.t += dt;
    if (Math.random() < 0.3 + this.bombPower * 0.6) {
      world.effects.burst(this.tipX + rand(-6, 6), this.tipY + rand(-6, 6), { count: 1, colors: ['#ffffff', '#fff6c8', '#ffe680'], speed: [10, 40], up: 40, life: [0.3, 0.6] });
    }
    if (b.t < c.powerTime && !release) return;
    const power = this.bombPower;
    this.bomb = null;
    this.cooldowns.primary = 0.3; // so the releasing click doesn't also cast a ray
    const to = this.aimPoint(world, c.maxRange);
    this.bombs.push({ x0: this.tipX, y0: this.tipY, x1: to.x, y1: to.y, t: 0, power });
    if (power >= 1) world.effects.text(this.hx, this.hy - 40, 'FULL POWER!', { color: '#ffe680', size: 9 });
    Sound.play('lightBombThrow');
  }

  updateBombs(dt, world) {
    const c = this.cfg.ult;
    for (const b of this.bombs) {
      b.t += dt;
      if (b.t < c.flightTime) {
        // sparkles streaming off the bomb in flight
        const k = b.t / c.flightTime;
        if (vrand(0, 1) < dt * 40) {
          world.effects.burst(lerp(b.x0, b.x1, k) + vrand(-5, 5), lerp(b.y0, b.y1, k) - Math.sin(k * Math.PI) * 60 + vrand(-5, 5), {
            count: 1, colors: PRIESTESS_FX.motes, speed: [5, 25], life: [0.3, 0.5], size: [1, 3],
          });
        }
        continue;
      }
      b.dead = true;
      const radius = lerp(c.minRadius, c.radius, b.power);
      const damage = c.damage * lerp(c.minPower, 1, b.power);
      const stun = lerp(c.minStun, c.stun, b.power);
      this.hitCircle(world, b.x1, b.y1, radius, damage, { knockback: 220, stun, fromUlt: true, sound: 'crit' });
      const { x1: x, y1: y } = b;
      world.effects.burst(x, y, { count: 50, colors: ['#ffffff', '#fff6c8', '#ffe680', '#ffd34a'], speed: [100, 340], life: [0.3, 0.8], size: [2, 5] });
      world.effects.add(0.5, (ctx, t) => {
        // stepped burst of light with chunky rays turning out of it
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        const r = radius * (0.4 + t * 0.7);
        PFX.disc(ctx, x, y, r, r, 'rgba(255, 220, 110, 0.35)', 4);
        PFX.disc(ctx, x, y, r * 0.7, r * 0.7, 'rgba(255, 240, 180, 0.45)', 4);
        PFX.disc(ctx, x, y, radius * 0.4 * (1 - t), radius * 0.4 * (1 - t), '#ffffff', 4);
        PFX.ring(ctx, x, y, r, r, '#fbe796', 4);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + t;
          const r0 = radius * 0.3;
          PFX.beam(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, a, radius * (0.3 + t) * (i % 2 ? 0.7 : 1), 8, PRIESTESS_FX.beam, 3);
        }
        ctx.restore();
      });
      // a towering cross of light, a second shock ring along the floor, glitter settling for a while
      world.effects.add(0.7, (ctx, t) => holyCross(ctx, x, y - radius * 0.3, radius * 0.7, t, 3));
      world.effects.add(0.6, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        const rr = radius * (0.5 + t * 0.9);
        PFX.ring(ctx, x, y, rr, rr * 0.55, '#fff6c8', 3, { thick: t < 0.3 ? 3 : 1 });
        ctx.restore();
      }, true);
      const glitter = Array.from({ length: 14 }, () => [vrand(-0.8, 0.8) * radius, vrand(-0.5, 0.5) * radius, vrand(0, 10)]);
      world.effects.add(1.6, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        for (const [gx, gy, ph] of glitter) {
          if (Math.sin(ph + t * 30) > 0.3) PFX.star(ctx, x + gx, y + gy - t * 20, 2, '#ffe680', '#ffffff', 2);
        }
        ctx.restore();
      });
      world.shake(6 + 8 * b.power, 0.5);
      Sound.play('lightBomb');
    }
    removeDead(this.bombs);
  }

  // ---------- passive: Divine Mark ----------

  get passiveInfo() {
    const n = this.marks.size;
    return {
      name: 'DIVINE MARK', color: '#ffe680', ready: n > 0,
      text: n ? `${n} MARKED` : 'MARK WITH RMB',
    };
  }

  // ---------- update & drawing ----------

  get tipX() { return this.pivotX + Math.cos(this.aim) * 28; }
  get tipY() { return this.pivotY + 4 + Math.sin(this.aim) * 20; }

  updateAbility(dt, world) {
    this.world = world; // for previews while drawing
    this.recoil -= dt;
    this.updateMarks(world);
    this.updateRays(dt, world);
    this.updateRunes(dt, world);
    this.updateBombs(dt, world);
    if (this.bomb) this.updateBomb(dt, world);
  }

  drawGroundExtras(ctx) {
    for (const r of this.runes) this.drawRune(ctx, r);
    // each ray's target marker: the spot filling with light, a bright ring closing in on it as the
    // strike comes down, and a cross at its heart, so it's clear where (and when) it will land
    for (const r of this.rays) {
      const rad = this.cfg.ray.radius;
      const k = clamp(r.t / this.cfg.ray.delay, 0, 1);
      PFX.zone(ctx, r.x, r.y, rad, k, PRIESTESS_FX.gold, { spin: r.t * 3, alpha: 1.6 });
      PFX.disc(ctx, r.x, r.y, rad * k, rad * k, `rgba(${PRIESTESS_FX.gold}, ${0.18 + 0.2 * k})`, 2);
      const closing = rad * (1.7 - 0.7 * k);
      PFX.ring(ctx, r.x, r.y, closing, closing, `rgba(255, 246, 200, ${0.4 + 0.6 * k})`, 2, { thick: 2 });
      const s = 6;
      PFX.line(ctx, r.x - s, r.y, r.x + s, r.y, 'rgba(255, 250, 220, 0.95)', 2);
      PFX.line(ctx, r.x, r.y - s, r.x, r.y + s, 'rgba(255, 250, 220, 0.95)', 2);
    }
    if (this.bomb && this.world) {
      const c = this.cfg.ult;
      const pt = this.aimPoint(this.world, c.maxRange);
      const power = this.bombPower;
      PFX.zone(ctx, pt.x, pt.y, lerp(c.minRadius, c.radius, power), power, power >= 1 ? '255, 250, 200' : PRIESTESS_FX.gold, { spin: this.animTime * 0.5 });
    }
    if (this.choosingAegis && this.world && this.isLocal) {
      const a = this.allyAtCursor(this.world);
      PFX.ring(ctx, a.x, a.y + 4, 20, 9, 'rgba(255, 230, 128, 0.85)', 2, { dash: [2, 2], spin: this.animTime * 3 });
    }
  }

  /** Pixel healing rune on the floor: green and gold rings, a slowly turning cross, rising motes. */
  drawRune(ctx, r, alpha = 1) {
    const c = this.cfg.rune;
    const fade = Math.min(1, r.t * 5, (c.duration - r.t) * 2) * alpha;
    const rad = c.radius;
    const sy = MAGIC_CIRCLE_SY;
    ctx.save();
    ctx.globalAlpha = fade;
    PFX.disc(ctx, r.x, r.y, rad, rad * sy, 'rgba(120, 230, 140, 0.14)', 4);
    ctx.globalCompositeOperation = 'lighter';
    PFX.ring(ctx, r.x, r.y, rad, rad * sy, '#9cf0a0', 2, { thick: 2 });
    PFX.ring(ctx, r.x, r.y, rad * 0.8, rad * 0.8 * sy, '#ffe680', 2, { dash: [3, 2], spin: -r.t * 0.5 });
    // cross arms turning slowly
    for (let i = 0; i < 4; i++) {
      const a = r.t * 0.7 + (i * TAU) / 4;
      PFX.line(ctx, r.x, r.y, r.x + Math.cos(a) * rad * 0.7, r.y + Math.sin(a) * rad * 0.7 * sy, '#ffe680', 2);
    }
    PFX.star(ctx, r.x, r.y, 2, '#9cf0a0', '#ffffff', 2);
    // healing ripples spreading out from the middle
    for (let i = 0; i < 2; i++) {
      const k = (r.t * 0.7 + i * 0.5) % 1;
      ctx.globalAlpha = fade * (1 - k) * 0.6;
      PFX.ring(ctx, r.x, r.y, rad * k, rad * k * sy, '#c8ffd0', 2);
    }
    ctx.globalAlpha = fade;
    // a soft pillar of light rising off the rune
    const pulse = 0.75 + Math.sin(r.t * 3) * 0.25;
    const g = ctx.createLinearGradient(0, r.y - 110, 0, r.y);
    g.addColorStop(0, 'rgba(160, 255, 180, 0)');
    g.addColorStop(1, `rgba(160, 255, 180, ${0.16 * pulse})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y - 55, rad * 0.75, 55, 0, 0, TAU);
    ctx.fill();
    PFX.glow(ctx, r.x, r.y, rad * 0.9, '255, 230, 140', 0.25 * pulse, 4, rad * 0.9 * sy);
    // little crosses of light drifting up out of it
    for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9 + i;
      const k = ((r.t * 0.6 + i * 0.11) % 1);
      const cx = PFX.snap(r.x + Math.cos(a) * rad * 0.55 * (1 - k * 0.3), 2);
      const cy = PFX.snap(r.y + Math.sin(a) * rad * 0.55 * sy - k * 60, 2);
      ctx.globalAlpha = fade * Math.sin(k * Math.PI);
      ctx.fillStyle = i % 3 ? '#c8ffd0' : '#ffe680';
      ctx.fillRect(cx - 1, cy - 3, 2, 6);
      ctx.fillRect(cx - 3, cy - 1, 6, 2);
    }
    ctx.restore();
  }

  drawExtras(ctx) {
    // golden diamond over every marked enemy, blinking as it runs out
    if (this.world) {
      for (const [t, until] of this.marks) {
        const left = until - this.world.time;
        if (left < 1.5 && Math.floor(left * 8) % 2) continue;
        const x = Math.round(t.hx);
        const y = Math.round(t.hy - t.radius - 20 + Math.sin(this.animTime * 4) * 2);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 1, y - 5, 3, 11);
        ctx.fillRect(x - 3, y - 3, 7, 7);
        ctx.fillRect(x - 5, y - 1, 11, 3);
        ctx.fillStyle = '#ffe680';
        ctx.fillRect(x, y - 4, 1, 9);
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillRect(x - 4, y, 9, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // thrown light bombs, arcing toward the target
    for (const b of this.bombs) {
      const k = clamp(b.t / this.cfg.ult.flightTime, 0, 1);
      const x = lerp(b.x0, b.x1, k);
      const y = lerp(b.y0, b.y1, k) - Math.sin(k * Math.PI) * 60;
      this.drawOrb(ctx, x, y, 6 + 6 * b.power);
    }
    // the bomb growing at the scepter tip while charging
    if (this.bomb) this.drawOrb(ctx, this.tipX, this.tipY, 3 + 9 * this.bombPower);
  }

  /** Pixel light orb: stepped gold glow, white core, a sparkle turning on it. */
  drawOrb(ctx, x, y, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, r * 2.2, '255, 210, 100', 1.1);
    PFX.disc(ctx, x, y, r * 0.8, r * 0.8, 'rgba(255, 246, 200, 0.9)', 2);
    PFX.disc(ctx, x, y, r * 0.45, r * 0.45, '#ffffff', 2);
    if (Math.floor(this.animTime * 10) % 2) PFX.star(ctx, x, y, Math.max(2, Math.round(r * 0.6)), '#fbe796', '#ffffff', 2);
    ctx.restore();
  }

  /** Light orbs per slot (F while choosing only cancels). */
  abilityCost(slot) {
    if (slot === 'e') return this.cfg.rune.cost;
    if (slot === 'f') return this.choosingAegis ? 0 : this.cfg.aegis.cost;
    if (slot === 'q') return this.cfg.ult.cost;
    return 0;
  }

  /** Light orbs each slot always costs, shown as orbs above the PC's ability boxes. */
  orbCost(slot) {
    return { e: this.cfg.rune.cost, f: this.cfg.aegis.cost, q: this.cfg.ult.cost }[slot] || 0;
  }

  /** Ability outlines while a key is held: who gets the aegis, the light bomb's blast (the rune casts on the press). */
  /**
   * Her ray, aimed like a thrower's shot: the circle where it will land (no line to it)
   * (shown while a phone's aim stick is dragged).
   */
  throwPreview() {
    if (!this.world) return null;
    const c = this.cfg.ray;
    const pt = this.aimPoint(this.world, c.maxRange);
    return { blast: { fromX: this.tipX, fromY: this.tipY, x: pt.x, y: pt.y, r: c.radius, rgb: PRIESTESS_FX.gold, noLine: true } };
  }

  /** Aegis: a silver ring round whoever it would shield. Light bomb: a golden circle on its spot (no line). */
  abilityPreview(slot) {
    if (slot === 'f') {
      const a = this.world ? this.allyAtCursor(this.world) : this;
      return { circle: { x: a.x, y: a.y + 4, r: 24, sy: 0.5, self: true }, rgb: '220, 232, 255' };
    }
    if (slot === 'q') {
      const pt = this.aimPoint(this.world, this.cfg.ult.maxRange);
      return { circle: { x: pt.x, y: pt.y, r: this.cfg.ult.radius }, rgb: '255, 226, 120' };
    }
    return null;
  }

  get weaponReach() { return this.recoil > 0 ? 5 : 8; }
}
