// Archer (class id 'ranger'): LMB arrow, RMB camo (invisible + fast, broken by
// attacking), E rapid fire, F fire/ice arrow (choose with LMB/RMB),
// Q arrow volley (mark an area, then LMB rains arrows).

// pixel effect colours: the archer's hood greens and linen, plus fire and frost
const ARCHER_FX = {
  leaves: ['#4a6e32', '#6a8e44', '#a8cc6a', '#e0d2aa'],
  rapidGlow: '168, 204, 106',
  zone: '168, 204, 106',
  frost: ['#4a8aff', '#9ad0ff', '#e6f6ff'],
};

class Ranger extends Player {
  constructor(x, y) {
    super('ranger', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.bow;
    this.maxCooldowns = {
      primary: c.arrow.cooldown, secondary: c.camo.cooldown, e: c.rapidFire.cooldown,
      f: c.elemental.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'ARROW', secondary: 'CAMO', e: 'RAPID', f: 'FIRE/ICE', q: 'VOLLEY' };
    this.targeting = false;     // Q pressed: choosing where the volley lands
    this.choosingArrow = false; // F pressed: LMB fire arrow, RMB ice arrow
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
    }));
    Sound.play('arrow');
  }

  // ---------- RMB: swift camo ----------

  secondary(world) {
    const c = this.cfg.camo;
    this.cooldowns.secondary = c.cooldown;
    this.camo = c.duration;
    this.slowTime = 0; // cleanse
    this.chillTime = 0;
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ARCHER_FX.leaves, speed: [60, 160], life: [0.3, 0.6] });
    world.effects.text(this.hx, this.hy - 30, 'CAMO', { color: '#a8cc6a', size: 8 });
    Sound.play('dash');
  }

  // ---------- E: rapid fire ----------

  abilityE(world) {
    const r = this.cfg.rapidFire;
    this.cooldowns.e = r.cooldown;
    this.rapidArrows = r.arrows;
    this.cooldowns.primary = 0;
    world.effects.text(this.hx, this.hy - 30, 'RAPID FIRE', { color: '#a8cc6a', size: 8 });
    world.effects.burst(this.hx, this.hy, { count: 12, colors: ['#a8cc6a', '#ffffff'], speed: [40, 100], up: 30 });
    Sound.play('aim');
  }

  // ---------- F: fire / ice arrow ----------

  /** F opens the choice (F again cancels); the click then fires the arrow. */
  abilityF() {
    this.choosingArrow = !this.choosingArrow;
    this.targeting = false;
    Sound.play(this.choosingArrow ? 'bowDraw' : 'uiClick');
  }

  shootElemental(world, c, opts) {
    this.breakCamo(world);
    this.choosingArrow = false;
    this.cooldowns.f = this.cfg.elemental.cooldown;
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
    Sound.play('arrow');
  }

  /** Piercing, hard-hitting arrow that sets everything it passes through on fire. */
  fireArrow(world) {
    const c = this.cfg.elemental.fire;
    this.shootElemental(world, c, {
      sprite: Sprites.projectiles.fireArrow,
      pierce: c.pierce, glow: '255, 130, 40', trail: ['#ff8a1e', '#ffd34a', '#e0461e'],
      onStrike: (p, w, t) => {
        if (t.dead) return;
        w.addDot(t, c.burnDps, c.burnDuration, '#ff8a1e');
        w.effects.text(t.hx, t.hy - 34, 'BURN', { color: '#ff8a1e', size: 7 });
      },
    });
    Sound.play('fireballCast');
  }

  /** Weak arrow that bursts into a freezing nova where it lands. */
  iceArrow(world) {
    const c = this.cfg.elemental.ice;
    this.shootElemental(world, c, {
      sprite: Sprites.projectiles.iceArrow,
      glow: '140, 220, 255', trail: ['#9ad0ff', '#e6f6ff'],
      onHit: (p, w) => this.iceNova(w, p.x, p.y),
    });
  }

  iceNova(world, x, y) {
    const c = this.cfg.elemental.ice;
    const hit = this.hitCircle(world, x, y, c.radius, c.damage, { knockback: 0, sound: 'hit' });
    for (const t of hit) {
      if (t.freeze) t.freeze(c.freeze);
      else t.stun?.(c.freeze);
    }
    world.effects.burst(x, y, { count: 28, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [80, 240], life: [0.3, 0.6], size: [2, 4] });
    const spin = rand(0, TAU);
    world.effects.add(0.4, (ctx, t) => {
      // an expanding frost ring with ice shards bursting out
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const r = c.radius * (0.3 + t * 0.7);
      PFX.disc(ctx, x, y, r, r, 'rgba(140, 220, 255, 0.3)', 3);
      PFX.ring(ctx, x, y, r, r, '#e6f6ff', 3, { thick: 2 });
      for (let i = 0; i < 8; i++) {
        const a = spin + (i / 8) * TAU;
        PFX.beam(ctx, x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35, a, r * (i % 2 ? 0.45 : 0.6), 8, ARCHER_FX.frost);
      }
      ctx.restore();
    });
    // frost left on the floor, glinting with crystals
    const glints = Array.from({ length: 7 }, () => [rand(-0.6, 0.6) * c.radius, rand(-0.6, 0.6) * c.radius]);
    world.effects.add(c.freeze, (ctx, t) => {
      PFX.disc(ctx, x, y, c.radius * 0.8, c.radius * 0.8, `rgba(160, 220, 255, ${0.22 * (1 - t)})`, 4);
      PFX.ring(ctx, x, y, c.radius * 0.8, c.radius * 0.8, `rgba(230, 246, 255, ${0.35 * (1 - t)})`, 2, { dash: [2, 3] });
      ctx.globalAlpha = 1 - t;
      for (const [gx, gy] of glints) PFX.star(ctx, x + gx, y + gy, 2, '#9ad0ff', '#ffffff');
      ctx.globalAlpha = 1;
    }, true);
    world.shake(4, 0.2);
    Sound.play('explosion');
  }

  // ---------- Q: arrow volley ----------

  /** Q starts aiming the volley (Q again cancels); the charge is only spent when it fires. */
  ultimate() {
    this.ult = this.ultMax;
    this.targeting = !this.targeting;
    this.choosingArrow = false;
    Sound.play('aim');
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
    Sound.play('volley');
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
        Sound.play('arrowRain', 0.04);
      }
      if (v.impacts.every((i) => i.done)) v.dead = true;
    }
    removeDead(this.volleys);
  }

  drawGroundExtras(ctx) {
    const c = this.cfg.ult;
    if (this.camo > 0) this.drawDetectRing(ctx);
    if (this.choosingArrow) {
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
    if (this.targeting) {
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
    if (this.camo > 0) {
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
        drawRotated(ctx, img, imp.x, imp.y - h, img.width / 2, img.height / 2, Math.PI / 2);
      }
    }
  }

  get weaponReach() { return this.recoil > 0 ? 6 : 10; }
}
