// Mage: spends mana. LMB homing magic missiles, RMB frostfire ball, E lightning
// strike (pick a target with LMB), F bird form, Q placeable mana-drain magic circle.

const MAGIC_CIRCLE_SY = 0.6; // the drain circle is drawn squashed vertically (floor perspective)

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
    if (!(this.manaSurge > 0)) world.effects.text(this.hx, this.hy - 40, 'MANA SURGE!', { color: '#6ad8ff', size: 8, life: 1 });
    this.manaSurge = this.cfg.passive.duration;
    world.effects.burst(this.hx, this.hy, { count: 14, colors: ['#4a8aff', '#9ad0ff', '#ffffff'], speed: [40, 120], life: [0.3, 0.6], up: 30 });
  }

  get passiveInfo() {
    const c = this.cfg.passive;
    const on = this.manaSurge > 0;
    return {
      name: 'MANA SURGE', color: '#6ad8ff', ready: on,
      text: on ? `+${Math.round((c.damageMultiplier - 1) * 100)}% DAMAGE` : 'GRAB MANA ORBS',
      bar: on ? this.manaSurge / c.duration : null,
    };
  }

  get tipX() { return this.pivotX + Math.cos(this.aim) * 30; }
  get tipY() { return this.pivotY + 4 + Math.sin(this.aim) * 22; }

  get channeling() { return !!this.bird; }
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
    if (!this.spend(c.cost, world)) return;
    this.recoil = 0.08;
    const m = world.mouseWorld;
    const spread = rand(-0.12, 0.12);
    world.playerProjectiles.push(new Projectile({
      x: this.tipX, y: this.tipY,
      vx: Math.cos(this.aim + spread) * c.speed,
      vy: Math.sin(this.aim + spread) * c.speed,
      radius: 6, damage: c.damage, life: c.life, knockback: 60,
      sprite: Sprites.projectiles.bolt, spin: 10, glow: '170, 100, 255', trail: ['#b67aff', '#e6ccff'],
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
    Sound.play('magic');
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
      sprite: Sprites.projectiles.fireball, spin: 8, glow: '90, 160, 255', trail: ['#4a8aff', '#9ad0ff', '#e6f6ff'],
      onHit: (p, w) => this.explode(w, p.x, p.y),
    }));
    Sound.play('fireballCast');
  }

  explode(world, x, y) {
    const c = this.cfg.fireball;
    this.hitCircle(world, x, y, c.radius, c.damage, { knockback: 260, sound: 'hit' });
    world.effects.burst(x, y, { count: 30, colors: ['#4a8aff', '#9ad0ff', '#e6f6ff', '#2a3a6a'], speed: [80, 260], life: [0.3, 0.7], size: [3, 6] });
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#4a8aff';
      ctx.beginPath();
      ctx.arc(x, y, c.radius * (0.4 + t * 0.7), 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e6f6ff';
      ctx.beginPath();
      ctx.arc(x, y, c.radius * 0.5 * (1 - t), 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    world.effects.add(3, (ctx, t) => {
      ctx.fillStyle = `rgba(20, 10, 10, ${0.35 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(x, y, c.radius * 0.7, 0, TAU);
      ctx.fill();
    }, true);
    world.shake(6, 0.25);
    Sound.play('explosion');
  }

  // ---------- E: lightning strike ----------

  abilityE(world) {
    if (this.targeting) { this.targeting = false; return; }
    if (this.resource.value < this.cfg.lightning.cost) { this.spend(this.cfg.lightning.cost, world); return; }
    this.targeting = true;
    this.placing = false;
    Sound.play('aim');
  }

  castLightning(world) {
    const c = this.cfg.lightning;
    const m = world.mouseWorld;
    const target = nearestTarget(world, m.x, m.y, c.selectRadius);
    if (!target) {
      Sound.play('denied');
      world.effects.text(m.x, m.y - 10, 'NO TARGET', { color: '#9ad0ff', size: 7 });
      return;
    }
    if (!this.spend(c.cost, world)) { this.targeting = false; return; }
    this.targeting = false;
    this.cooldowns.e = c.cooldown;
    this.strikes.push({ target, t: 0, x: target.hx, y: target.hy });
    Sound.play('laserCharge');
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
      Sound.play('laser');
      Sound.play('explosion', 0.1);
    }
    removeDead(this.strikes);
  }

  /** Jagged lightning bolt between two points. */
  boltFx(world, x1, y1, x2, y2, width) {
    const pts = [];
    const n = Math.max(4, Math.round(dist(x1, y1, x2, y2) / 18));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : rand(-10, 10);
      pts.push([lerp(x1, x2, t) + j, lerp(y1, y2, t) + j * 0.5]);
    }
    world.effects.add(0.3, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      for (const [w, col] of [[width * 2.5, 'rgba(120, 160, 255, 0.6)'], [width, '#ffffff']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
    });
    world.effects.burst(x2, y2, { count: 10, colors: ['#ffffff', '#9ab8ff', '#5a7aff'], speed: [60, 180], life: [0.15, 0.3] });
  }

  // ---------- F: bird form ----------

  abilityF(world) {
    const c = this.cfg.bird;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.f = c.cooldown;
    this.bird = { t: 0 };
    this.targeting = false;
    this.placing = false;
    this.radius = c.radius;   // tiny hitbox
    this.poof(world);
    Sound.play('magic');
  }

  updateBird(dt, world) {
    const b = this.bird;
    // F again lands early (ignoring the frame it started)
    if ((b.t > 0 && Input.pressed('f')) || b.t >= this.cfg.bird.duration) return this.endBird(world);
    b.t += dt;
    if (this.moving && Math.random() < 0.3) {
      world.effects.burst(this.x, this.y - 18, { count: 1, colors: ['#b67aff', '#e6ccff'], speed: [5, 20], life: [0.2, 0.4], size: [2, 3] });
    }
  }

  endBird(world) {
    this.bird = null;
    this.radius = 12;
    this.poof(world);
    Sound.play('dash');
  }

  poof(world) {
    world.effects.burst(this.hx, this.hy, { count: 18, colors: ['#b67aff', '#e6ccff', '#ffffff'], speed: [40, 140], life: [0.2, 0.5] });
  }

  // ---------- Q: mana drain circle ----------

  /** Q starts placing the circle (Q again cancels); the charge is only spent on placement. */
  ultimate() {
    this.ult = this.ultMax;
    this.placing = !this.placing;
    this.targeting = false;
    Sound.play('aim');
  }

  placeCircle(world) {
    this.placing = false;
    this.ult = 0;
    this.circles.push({ x: this.placePos.x, y: this.placePos.y, t: 0, tick: 0 });
    Sound.play('burstCharge');
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
          const dealt = world.damageTarget(t, c.dps * c.tick, { sound: null, noCrit: true, color: '#c8a8ff', fromUlt: true });
          if (dealt) {
            this.gainResource(dealt * c.manaSteal);
            world.effects.burst(t.hx, t.hy, { count: 1, colors: ['#b67aff', '#6ad8ff'], speed: [0, 0], life: [0.4, 0.5], size: [3, 4] });
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
      world.effects.burst(this.x + rand(-10, 10), this.y - rand(0, 26), { count: 1, colors: ['#4a8aff', '#9ad0ff', '#e6f6ff'], speed: [10, 30], life: [0.3, 0.5], up: 40 });
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
    if (this.placing) {
      // preview: the circle, pulsing
      const pulse = 0.55 + Math.sin(this.animTime * 8) * 0.15;
      this.drawMagicCircle(ctx, { x: this.placePos.x, y: this.placePos.y, t: this.animTime % 1 + 1 }, c, pulse);
    }
    for (const s of this.strikes) {
      const t = s.t / this.cfg.lightning.delay;
      Telegraph.circle(ctx, s.x, s.y + 14, 22, t, '120, 160, 255');
    }
  }

  /** Arcane circle on the floor: rings, rotating rune ticks, inner square. */
  drawMagicCircle(ctx, pg, c, alpha = 1) {
    const fade = Math.min(1, pg.t * 4, (c.duration - pg.t) * 2);
    const r = c.radius;
    const sy = MAGIC_CIRCLE_SY;
    const ring = (rr) => { ctx.beginPath(); ctx.ellipse(pg.x, pg.y, rr, rr * sy, 0, 0, TAU); };
    const pt = (a, rr) => [pg.x + Math.cos(a) * rr, pg.y + Math.sin(a) * rr * sy];
    ctx.save();
    ctx.globalAlpha = fade * alpha;
    ctx.fillStyle = 'rgba(110, 60, 220, 0.16)';
    ring(r);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#a07aff';
    ctx.lineWidth = 2;
    ring(r);
    ctx.stroke();
    ctx.strokeStyle = '#6ad8ff';
    ctx.lineWidth = 1;
    ring(r * 0.88);
    ctx.stroke();
    ring(r * 0.45);
    ctx.stroke();
    // rune ticks spinning between the two outer rings
    ctx.fillStyle = '#d8c8ff';
    for (let i = 0; i < 16; i++) {
      const [x, y] = pt(pg.t * 0.8 + (i * TAU) / 16, r * 0.94);
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, i % 2 ? 2 : 3, i % 2 ? 2 : 3);
    }
    // two squares turning in opposite directions
    ctx.strokeStyle = '#a07aff';
    for (const dir of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const [x, y] = pt(dir * pg.t * 0.5 + (i * TAU) / 4, r * 0.88);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawExtras(ctx) {
    if (this.targeting && this.world) {
      const m = this.world.mouseWorld;
      const t = nearestTarget(this.world, m.x, m.y, this.cfg.lightning.selectRadius);
      ctx.save();
      ctx.strokeStyle = t ? '#9ad0ff' : 'rgba(154, 208, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (t) ctx.arc(t.hx, t.hy, t.radius + 8, 0, TAU);
      else ctx.arc(m.x, m.y, this.cfg.lightning.selectRadius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGround(ctx) {
    if (!this.bird) return super.drawGround(ctx);
    drawShadow(ctx, this.x, this.y + 9, 6, 2, 0.3);
    this.drawGroundExtras(ctx);
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
    ctx.fillStyle = '#b67aff';
    ctx.fillRect(Math.round(this.x - 10), Math.round(this.y - 35), Math.round(20 * r), 2);
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
