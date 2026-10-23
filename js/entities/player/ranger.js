// Archer (class id 'ranger'): LMB arrow, RMB fire/ice arrow (choose with LMB/RMB),
// E rapid fire, F camo (invisible + fast, broken by attacking),
// Q arrow volley (mark an area, then LMB rains arrows).

// pixel effect colours: the archer's hood greens and linen, plus fire and frost
const ARCHER_FX = {
  leaves: ['#4a6e32', '#6a8e44', '#a8cc6a', '#e0d2aa'],
  rapidGlow: '168, 204, 106',
  zone: '168, 204, 106',
  frost: ['#4a8aff', '#9ad0ff', '#e6f6ff'],
  leafSmoke: ['#24361a', '#4a6e32', '#6a8e44'],
};

/** Faint streak behind a flying arrow. colors = edge first. */
function arrowStreak(ctx, p, len, width, colors, alpha) {
  const back = Math.atan2(p.vy, p.vx) + Math.PI;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  PFX.beam(ctx, p.x, p.y, back, len, width, colors, 2);
  ctx.restore();
}

class Ranger extends Player {
  constructor(x, y) {
    super('ranger', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.bow;
    this.maxCooldowns = {
      primary: c.arrow.cooldown, secondary: c.elemental.cooldown, e: c.rapidFire.cooldown,
      f: c.camo.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'ARROW', secondary: 'FIRE/ICE', e: 'RAPID', f: 'CAMO', q: 'VOLLEY' };
    this.targeting = false;     // Q pressed: choosing where the volley lands
    this.choosingArrow = false; // RMB pressed: LMB fire arrow, RMB ice arrow
    this.targetPos = { x, y };
    this.volleys = [];
    this.rapidArrows = 0;
    this.camo = 0;
    this.recoil = 0;
  }

  get invisible() { return this.camo > 0; }
  get detectRange() { return this.cfg.camo.detectRange; }
  get bodyAlpha() { return this.camo > 0 ? 0.35 : 1; }
  get moveMultiplier() { return this.camo > 0 ? this.cfg.camo.speedMultiplier : 1; }

  handleMouse(world) {
    const m = Input.mouse;
    if (this.choosingArrow) {
      if (m.leftPressed) this.fireArrow(world);
      else if (m.rightPressed) this.iceArrow(world);
      return;
    }
    if (this.targeting) {
      if (m.rightPressed) this.targeting = false;
      else if (m.leftPressed) this.fireVolley(world);
      return;
    }
    super.handleMouse(world);
  }

  /** Attacking gives the archer away. */
  breakCamo(world) {
    if (!(this.camo > 0)) return;
    this.camo = 0;
    world.effects.burst(this.hx, this.hy, { count: 12, colors: ARCHER_FX.leaves, speed: [40, 120], life: [0.2, 0.4] });
    world.effects.smoke(this.hx, this.hy + 4, { count: 5, radius: 12, life: 0.5, colors: ARCHER_FX.leafSmoke });
    world.effects.text(this.hx, this.hy - 30, 'REVEALED', { color: '#d8c8a0', size: 7 });
  }

  // ---------- LMB: arrow (empowered while rapid fire is active) ----------

  primary(world) {
    const c = this.cfg.arrow;
    const r = this.cfg.rapidFire;
    const rapid = this.rapidArrows > 0;
    const cooldown = rapid ? r.fireCooldown : c.cooldown;
    this.breakCamo(world);
    this.cooldowns.primary = cooldown;
    this.maxCooldowns.primary = cooldown;
    this.recoil = 0.12;
    if (rapid) this.rapidArrows--;
    world.playerProjectiles.push(new Projectile({
      x: this.pivotX + Math.cos(this.aim) * 14,
      y: this.pivotY + Math.sin(this.aim) * 14,
      vx: Math.cos(this.aim) * c.speed,
      vy: Math.sin(this.aim) * c.speed,
      radius: 5,
      damage: c.damage * (rapid ? 1 + r.damageBonus : 1),
      pierce: rapid ? Math.ceil(c.pierce * (1 + r.pierceBonus)) : c.pierce,
      life: 1.5, knockback: 140,
      sprite: Sprites.projectiles.arrow,
      glow: rapid ? ARCHER_FX.rapidGlow : null,
      trail: rapid ? ['#a8cc6a', '#e0d2aa'] : ['#e0d2aa'],
      // a wind streak behind the arrow (green and longer while rapid firing)
      aura: rapid
        ? (ctx, p) => arrowStreak(ctx, p, 30, 6, ['#4a6e32', '#a8cc6a', '#f0ffd8'], 0.7)
        : (ctx, p) => arrowStreak(ctx, p, 18, 3, ['#8a7a6a', '#e0d2aa'], 0.45),
    }));
    Sound.play('bowShot');
  }

  // ---------- F: swift camo ----------

  abilityF(world) {
    const c = this.cfg.camo;
    this.cooldowns.f = c.cooldown;
    this.choosingArrow = false;
    this.targeting = false;
    this.camo = c.duration;
    this.slowTime = 0; // cleanse
    this.chillTime = 0;
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ARCHER_FX.leaves, speed: [60, 160], life: [0.3, 0.6] });
    world.effects.smoke(this.hx, this.hy + 4, { count: 9, radius: 18, life: 0.7, colors: ARCHER_FX.leafSmoke });
    world.effects.text(this.hx, this.hy - 30, 'CAMO', { color: '#a8cc6a', size: 8 });
    Sound.play('camo');
  }

  // ---------- E: rapid fire ----------

  abilityE(world) {
    const r = this.cfg.rapidFire;
    this.cooldowns.e = r.cooldown;
    this.rapidArrows = r.arrows;
    this.cooldowns.primary = 0;
    world.effects.text(this.hx, this.hy - 30, 'RAPID FIRE', { color: '#a8cc6a', size: 8 });
    world.effects.burst(this.hx, this.hy, { count: 12, colors: ['#a8cc6a', '#ffffff'], speed: [40, 100], up: 30 });
    Sound.play('rapidFire');
  }

  // ---------- RMB: fire / ice arrow ----------

  /** RMB opens the choice; the next click fires the arrow (LMB fire, RMB ice). */
  secondary() {
    this.choosingArrow = true;
    this.targeting = false;
    Sound.play('bowDraw');
  }

  shootElemental(world, c, opts) {
    this.breakCamo(world);
    this.choosingArrow = false;
    this.cooldowns.secondary = this.cfg.elemental.cooldown;
    this.cooldowns.primary = 0.25; // so the choosing click doesn't also loose a normal arrow
    this.recoil = 0.15;
    world.playerProjectiles.push(new Projectile({
      x: this.pivotX + Math.cos(this.aim) * 14,
      y: this.pivotY + Math.sin(this.aim) * 14,
      vx: Math.cos(this.aim) * c.speed,
      vy: Math.sin(this.aim) * c.speed,
      radius: 6, damage: c.damage, life: 1.4, knockback: 160,
      ...opts,
    }));
    Sound.play('bowShotHeavy');
  }

  /** Piercing, hard-hitting arrow that sets everything it passes through on fire. */
  fireArrow(world) {
    const c = this.cfg.elemental.fire;
    this.shootElemental(world, c, {
      sprite: Sprites.projectiles.fireArrow,
      pierce: c.pierce, glow: '255, 130, 40', trail: ['#ff8a1e', '#ffd34a', '#e0461e'],
      // a flickering comet tail of fire
      aura: (ctx, p) => {
        const flicker = Math.sin(p.age * 40) * 4 + Math.sin(p.age * 27) * 3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, p.x, p.y, 22, '255, 110, 30', 0.9);
        ctx.restore();
        arrowStreak(ctx, p, 46 + flicker, 15 + flicker * 0.4, FIRE_COLORS, 0.95);
        // flame tongues licking up off the shaft
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const back = Math.atan2(p.vy, p.vx) + Math.PI;
        for (let i = 1; i <= 3; i++) {
          PFX.flame(ctx, p.x + Math.cos(back) * i * 9, p.y + Math.sin(back) * i * 9 + 3, 10 - i * 2, 20 - i * 4, p.age + i, FIRE_COLORS);
        }
        ctx.restore();
      },
      // embers and little flames shed along the way
      fx: (p, dt, w) => {
        if (vrand(0, 1) < dt * 30) {
          w.effects.burst(p.x + vrand(-4, 4), p.y + vrand(-4, 4), { count: 1, colors: ['#ffd34a', '#ff8a1e', '#fff6c8'], speed: [10, 40], life: [0.3, 0.6], up: 50, size: [1, 3] });
        }
        if (vrand(0, 1) < dt * 18) w.effects.flames(p.x, p.y + 6, { count: 1, height: vrand(14, 22), width: 9, life: 0.4 });
      },
      onStrike: (p, w, t) => {
        // the target goes up in flames
        w.effects.flames(t.hx, t.hy + (t.radius || 12) * 0.6, { count: 4, spread: 10, height: 28, width: 11, life: 0.55 });
        w.effects.burst(t.hx, t.hy, { count: 14, colors: FIRE_COLORS, speed: [60, 180], life: [0.2, 0.5], up: 40, angle: Math.atan2(p.vy, p.vx), spread: 1.6 });
        if (t.dead) return;
        w.addDot(t, c.burnDps, c.burnDuration, '#ff8a1e', 'burn');
        w.effects.text(t.hx, t.hy - 34, 'BURN', { color: '#ff8a1e', size: 7 });
      },
      onHit: (p, w) => {
        Sound.play('fireImpact');
        w.effects.flames(p.x, p.y + 6, { count: 3, spread: 8, height: 20, width: 9, life: 0.5 });
        w.effects.burst(p.x, p.y, { count: 10, colors: FIRE_COLORS, speed: [40, 140], life: [0.2, 0.45], up: 30 });
        w.effects.smoke(p.x, p.y - 4, { count: 4, radius: 8, life: 0.6, colors: ['#2a2129', '#4a3a3a', '#6a5a52'] });
      },
    });
    Sound.play('fireArrow');
  }

  /** Weak arrow that bursts into a freezing nova where it lands. */
  iceArrow(world) {
    const c = this.cfg.elemental.ice;
    this.shootElemental(world, c, {
      sprite: Sprites.projectiles.iceArrow,
      glow: '140, 220, 255', trail: ['#9ad0ff', '#e6f6ff'],
      // a cold aura: frosty tail with snowflakes circling the arrowhead
      aura: (ctx, p) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, p.x, p.y, 20, '140, 210, 255', 0.8);
        for (let i = 0; i < 3; i++) {
          const a = p.age * 9 + (i * TAU) / 3;
          PFX.star(ctx, p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 7, 2, '#9ad0ff', '#ffffff', 2);
        }
        ctx.restore();
        arrowStreak(ctx, p, 26, 8, ICE_COLORS, 0.8);
      },
      // snow drifting off, and the odd shard flaking away
      fx: (p, dt, w) => {
        if (vrand(0, 1) < dt * 24) {
          w.effects.burst(p.x + vrand(-5, 5), p.y + vrand(-5, 5), { count: 1, colors: ['#ffffff', '#e6f6ff', '#9ad0ff'], speed: [5, 20], life: [0.4, 0.7], gravity: 40, size: [1, 2] });
        }
        if (vrand(0, 1) < dt * 6) {
          w.effects.shards(p.x, p.y, { count: 1, speed: [20, 50], life: 0.4, len: [5, 7], width: 3, angle: Math.atan2(p.vy, p.vx) + Math.PI, spread: 1.4 });
        }
      },
      onHit: (p, w) => this.iceNova(w, p.x, p.y),
    });
    Sound.play('iceArrow');
  }

  iceNova(world, x, y) {
    const c = this.cfg.elemental.ice;
    const hit = this.hitCircle(world, x, y, c.radius, c.damage, { knockback: 0, sound: 'hit' });
    for (const t of hit) {
      if (t.freeze) t.freeze(c.freeze);
      else if (world.isBossTarget(t)) world.freezeBoss(c.freeze);   // a boss is frozen as a whole (its fists too)
      else t.stun?.(c.freeze);
    }
    world.effects.burst(x, y, { count: 28, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [80, 240], life: [0.3, 0.6], size: [2, 4] });
    world.effects.shards(x, y, { count: 18, speed: [160, 320], life: 0.55, len: [9, 16], width: 6 });
    world.effects.smoke(x, y + 4, { count: 8, radius: c.radius * 0.45, life: 0.8, rise: 10, colors: ['#5a8ab8', '#9ac8ea', '#e6f6ff'] });
    const spin = vrand(0, TAU);
    world.effects.add(0.45, (ctx, t) => {
      // a flash, then an expanding frost ring
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const r = c.radius * (0.3 + t * 0.75);
      PFX.glow(ctx, x, y, c.radius * 0.6 * (1 - t) + 6, '200, 240, 255', 1.4);
      PFX.disc(ctx, x, y, r, r, 'rgba(140, 220, 255, 0.25)', 3);
      PFX.ring(ctx, x, y, r, r, '#e6f6ff', 3, { thick: 2 });
      PFX.ring(ctx, x, y, r * 0.75, r * 0.75, '#9ad0ff', 2, { dash: [2, 2], spin: spin + t * 2 });
      PFX.star(ctx, x, y, Math.round(10 * (1 - t)) + 1, '#9ad0ff', '#ffffff', 2);
      ctx.restore();
    });
    // a ring of ice spikes bursting up out of the floor, standing while enemies are frozen, then crumbling
    const spikes = Array.from({ length: 11 }, (_, i) => {
      const a = spin + (i / 11) * TAU + vrand(-0.15, 0.15);
      const d = c.radius * vrand(0.35, 0.85);
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, len: vrand(22, 38), lean: vrand(-0.35, 0.35), delay: vrand(0, 0.12) };
    });
    spikes.sort((a, b) => a.y - b.y);
    const fx = world.effects;
    let shattered = false;
    fx.add(c.freeze, (ctx, t) => {
      const secs = t * c.freeze;
      if (!shattered && t > 0.82) {
        // the spikes shatter as the freeze wears off
        shattered = true;
        for (const s of spikes) fx.shards(s.x, s.y - s.len * 0.5, { count: 3, speed: [40, 110], life: 0.35, len: [5, 8], width: 4 });
      }
      // a pale sheet of frost on the floor
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.disc(ctx, x, y, c.radius * 0.85, c.radius * 0.6, `rgba(90, 150, 210, ${0.3 * (1 - t)})`, 4);
      PFX.ring(ctx, x, y, c.radius * 0.85, c.radius * 0.6, `rgba(230, 246, 255, ${0.6 * (1 - t)})`, 2, { dash: [2, 3] });
      ctx.restore();
      const fade = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
      ctx.save();
      for (const s of spikes) {
        const grow = clamp((secs - s.delay) / 0.12, 0, 1);
        if (grow <= 0) continue;
        const len = s.len * (1 - (1 - grow) ** 2) * (t > 0.8 ? fade : 1);
        const a = -Math.PI / 2 + s.lean;
        ctx.globalAlpha = fade;
        PFX.disc(ctx, s.x, s.y, 6, 3, 'rgba(154, 208, 255, 0.6)', 2);           // icy mound at the base
        PFX.shard(ctx, s.x + Math.cos(a) * len * 0.45, s.y + Math.sin(a) * len * 0.45, a, len + 2, 14, ['#2a4a8a', '#2a4a8a', '#2a4a8a']);
        PFX.shard(ctx, s.x + Math.cos(a) * len * 0.45, s.y + Math.sin(a) * len * 0.45, a, len, 11, ICE_COLORS);
      }
      // glints running over the spikes
      ctx.globalAlpha = fade;
      const g = spikes[Math.floor(secs * 6) % spikes.length];
      PFX.star(ctx, g.x, g.y - g.len * 0.6, 2, '#9ad0ff', '#ffffff', 2);
      ctx.restore();
    }, true);
    world.shake(4, 0.2);
    Sound.play('iceBurst');
  }

  // ---------- Q: arrow volley ----------

  /** Q starts aiming the volley (Q again cancels); the charge is only spent when it fires. */
  ultimate() {
    this.ult = this.ultMax;
    this.targeting = !this.targeting;
    this.choosingArrow = false;
    Sound.play('bowDraw');
  }

  fireVolley(world) {
    const c = this.cfg.ult;
    this.breakCamo(world);
    this.targeting = false;
    this.ult = 0;
    this.cooldowns.primary = 0.25; // so the aiming click doesn't also loose an arrow
    const impacts = [];
    for (let i = 0; i < c.arrows; i++) {
      const a = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * c.radius;
      impacts.push({
        x: this.targetPos.x + Math.cos(a) * r,
        y: this.targetPos.y + Math.sin(a) * r,
        time: c.delay + (i / c.arrows) * c.duration + rand(-0.03, 0.03),
        done: false,
      });
    }
    this.volleys.push({ x: this.targetPos.x, y: this.targetPos.y, t: 0, impacts });
    world.effects.burst(this.pivotX, this.pivotY - 10, { count: 8, colors: ['#efe6d2', '#9a6232'], angle: -Math.PI / 2, spread: 0.6, speed: [200, 320], life: [0.2, 0.3], drag: 0 });
    Sound.play('volleyLoose');
  }

  updateAbility(dt, world) {
    this.world = world; // for the camo detection preview while drawing
    this.recoil -= dt;
    this.camo -= dt;
    if (this.camo > 0) { this.slowTime = 0; this.chillTime = 0; }

    const c = this.cfg.ult;
    const m = world.mouseWorld;
    const d = dist(this.x, this.y, m.x, m.y);
    const a = angleTo(this.x, this.y, m.x, m.y);
    const r = Math.min(d, c.maxRange);
    this.targetPos = { x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r };

    for (const v of this.volleys) {
      v.t += dt;
      for (const imp of v.impacts) {
        if (imp.done || v.t < imp.time) continue;
        imp.done = true;
        this.hitCircle(world, imp.x, imp.y, c.impactRadius, c.damage, { knockback: 40, sound: 'arrowRain', fromUlt: true });
        world.effects.burst(imp.x, imp.y, { count: 4, colors: ['#8a7a6a', '#efe6d2'], speed: [20, 70], life: [0.15, 0.3] });
        const { x: ix, y: iy } = imp;
        world.effects.add(0.25, (ctx, t) => {
          // a puff of dust ringing out where the arrow thuds in
          ctx.save();
          ctx.globalAlpha = 1 - t;
          PFX.ring(ctx, ix, iy, 6 + t * 14, (6 + t * 14) * 0.5, '#c8b898', 2);
          ctx.restore();
        }, true);
        Sound.play('arrowRain', 0.04);
      }
      if (v.impacts.every((i) => i.done)) v.dead = true;
    }
    removeDead(this.volleys);
  }

  drawGroundExtras(ctx) {
    const c = this.cfg.ult;
    if (this.camo > 0 && this.isLocal) this.drawDetectRing(ctx);
    if (this.choosingArrow && this.isLocal) {
      // aim line, half fire / half ice
      const len = 90;
      const cos = Math.cos(this.aim);
      const sin = Math.sin(this.aim);
      for (const [col, off] of [['rgba(255, 140, 50, 0.85)', -2], ['rgba(150, 220, 255, 0.85)', 2]]) {
        const x0 = this.pivotX - sin * off;
        const y0 = this.pivotY + cos * off;
        PFX.line(ctx, x0, y0, x0 + cos * len, y0 + sin * len, col, 2, [3, 2], -this.animTime * 12);
      }
    }
    if (this.targeting && this.isLocal) {
      const pulse = 1 + Math.sin(this.animTime * 8) * 0.04;
      PFX.zone(ctx, this.targetPos.x, this.targetPos.y, c.radius * pulse, 0, ARCHER_FX.zone, { spin: this.animTime * 0.6 });
      // crosshair in the middle
      PFX.line(ctx, this.targetPos.x - 8, this.targetPos.y, this.targetPos.x + 8, this.targetPos.y, 'rgba(168, 204, 106, 0.85)');
      PFX.line(ctx, this.targetPos.x, this.targetPos.y - 8, this.targetPos.x, this.targetPos.y + 8, 'rgba(168, 204, 106, 0.85)');
    }
    for (const v of this.volleys) {
      PFX.disc(ctx, v.x, v.y, c.radius, c.radius, 'rgba(168, 204, 106, 0.1)', 3);
      PFX.ring(ctx, v.x, v.y, c.radius, c.radius, 'rgba(168, 204, 106, 0.35)', 2, { dash: [3, 3], spin: v.t });
    }
  }

  /** Enemies close enough to see through the camo. */
  spotters() {
    const range = this.detectRange;
    return this.world ? this.world.enemies.filter((e) => !e.dead && dist(e.x, e.y, this.x, this.y) <= range) : [];
  }

  /** Camo: ring showing how close enemies can get before they see you (red when one is inside). */
  drawDetectRing(ctx) {
    const range = this.detectRange;
    const seen = this.spotters().length > 0;
    PFX.disc(ctx, this.x, this.y, range, range, seen ? 'rgba(255, 80, 70, 0.07)' : 'rgba(168, 204, 106, 0.05)', 4);
    PFX.ring(ctx, this.x, this.y, range, range, seen ? 'rgba(255, 80, 70, 0.8)' : 'rgba(168, 204, 106, 0.6)', 2, { dash: [4, 3], spin: this.animTime * 0.4 });
  }

  // passive: Agility (faster base speed in CONFIG, shorter dodge via dodgeCooldown)
  get passiveInfo() {
    return { name: 'AGILITY', color: '#a8cc6a', text: `FAST, ${this.dodgeCooldown}s DODGE` };
  }

  drawExtras(ctx) {
    // "!" over enemies that can see through the camo
    if (this.camo > 0 && this.isLocal) {
      for (const e of this.spotters()) {
        const x = Math.round(e.x);
        const y = Math.round(e.y - e.barOffset - 16);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 2, y - 1, 5, 12);
        ctx.fillStyle = '#ff5046';
        ctx.fillRect(x - 1, y, 3, 6);
        ctx.fillRect(x - 1, y + 8, 3, 2);
      }
    }
    // arrows raining down
    const img = Sprites.projectiles.arrow;
    for (const v of this.volleys) {
      for (const imp of v.impacts) {
        const until = imp.time - v.t;
        if (imp.done || until > 0.2) continue;
        const h = (until / 0.2) * 220;
        // a pale streak above each falling arrow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        PFX.beam(ctx, imp.x, imp.y - h, -Math.PI / 2, 28, 3, ['#8a7a6a', '#efe6d2'], 2);
        ctx.restore();
        drawRotated(ctx, img, imp.x, imp.y - h, img.width / 2, img.height / 2, Math.PI / 2);
      }
    }
  }

  /** Ability outlines while a key is held: rapid fire on herself, the elemental arrow's line, the volley's circle. */
  abilityPreview(slot) {
    if (slot === 'e') return { self: true };
    if (slot === 'q') return { circle: { x: this.targetPos.x, y: this.targetPos.y, r: this.cfg.ult.radius } };
    return null;
  }

  get weaponReach() { return this.recoil > 0 ? 6 : 10; }
}
