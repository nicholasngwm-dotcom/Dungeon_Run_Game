// Ranger: LMB arrow, RMB volley (mark an area, then LMB rains arrows),
// E rapid fire, F fire/ice arrow (choose with LMB/RMB), Q swift camo (invisible + fast).

class Ranger extends Player {
  constructor(x, y) {
    super('ranger', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.bow;
    this.maxCooldowns = {
      primary: c.arrow.cooldown, secondary: c.volley.cooldown, e: c.rapidFire.cooldown,
      f: c.elemental.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'ARROW', secondary: 'VOLLEY', e: 'RAPID', f: 'FIRE/ICE', q: 'CAMO' };
    this.targeting = false;
    this.choosingArrow = false; // F pressed: LMB fire arrow, RMB ice arrow
    this.targetPos = { x, y };
    this.volleys = [];
    this.rapidArrows = 0;
    this.camo = 0;
    this.recoil = 0;
  }

  get invisible() { return this.camo > 0; }
  get bodyAlpha() { return this.camo > 0 ? 0.35 : 1; }
  get moveMultiplier() { return this.camo > 0 ? this.cfg.ult.speedMultiplier : 1; }

  handleMouse(world) {
    const m = Input.mouse;
    if (this.choosingArrow) {
      if (m.leftPressed) this.fireArrow(world);
      else if (m.rightPressed) this.iceArrow(world);
      return;
    }
    if (m.rightPressed) {
      if (this.targeting) this.targeting = false;
      else if (this.cooldowns.secondary <= 0) { this.targeting = true; Sound.play('aim'); }
      else Sound.play('denied');
    }
    if (this.targeting) {
      if (m.leftPressed) this.fireVolley(world);
      return;
    }
    if (m.left && this.cooldowns.primary <= 0) this.primary(world);
  }

  // ---------- LMB: arrow (empowered while rapid fire is active) ----------

  primary(world) {
    const c = this.cfg.arrow;
    const r = this.cfg.rapidFire;
    const rapid = this.rapidArrows > 0;
    const cooldown = rapid ? r.fireCooldown : c.cooldown;
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
      glow: rapid ? '120, 255, 140' : null,
      trail: rapid ? ['#8cff9a', '#efe6d2'] : ['#efe6d2'],
    }));
    Sound.play('arrow');
  }

  // ---------- RMB: volley ----------

  fireVolley(world) {
    const c = this.cfg.volley;
    this.targeting = false;
    this.cooldowns.secondary = c.cooldown;
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

  // ---------- E: rapid fire ----------

  abilityE(world) {
    const r = this.cfg.rapidFire;
    this.cooldowns.e = r.cooldown;
    this.rapidArrows = r.arrows;
    this.cooldowns.primary = 0;
    world.effects.text(this.hx, this.hy - 30, 'RAPID FIRE', { color: '#8cff9a', size: 8 });
    world.effects.burst(this.hx, this.hy, { count: 12, colors: ['#8cff9a', '#ffffff'], speed: [40, 100], up: 30 });
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
      sprite: Sprites.projectiles.arrow,
      ...opts,
    }));
    Sound.play('arrow');
  }

  /** Piercing, hard-hitting arrow that sets everything it passes through on fire. */
  fireArrow(world) {
    const c = this.cfg.elemental.fire;
    this.shootElemental(world, c, {
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
    world.effects.add(0.4, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = 'rgba(140, 220, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(x, y, c.radius * (0.3 + t * 0.7), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#e6f6ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    });
    // frost left on the floor
    world.effects.add(c.freeze, (ctx, t) => {
      ctx.fillStyle = `rgba(160, 220, 255, ${0.25 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(x, y, c.radius * 0.8, 0, TAU);
      ctx.fill();
    }, true);
    world.shake(4, 0.2);
    Sound.play('explosion');
  }

  // ---------- Q: swift camo ----------

  ultimate(world) {
    this.camo = this.cfg.ult.duration;
    this.slowTime = 0; // cleanse
    this.chillTime = 0;
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = 0; // every ability ready again
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#62802f', '#88a446', '#e0d2aa'], speed: [60, 160], life: [0.3, 0.6] });
    world.effects.text(this.hx, this.hy - 30, 'CAMO', { color: '#8cff9a', size: 8 });
    Sound.play('dash');
  }

  updateAbility(dt, world) {
    this.world = world; // for the camo detection preview while drawing
    this.recoil -= dt;
    this.camo -= dt;
    if (this.camo > 0) { this.slowTime = 0; this.chillTime = 0; }

    const c = this.cfg.volley;
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
        this.hitCircle(world, imp.x, imp.y, c.impactRadius, c.damage, { knockback: 40, sound: 'arrowRain' });
        world.effects.burst(imp.x, imp.y, { count: 4, colors: ['#8a7a6a', '#efe6d2'], speed: [20, 70], life: [0.15, 0.3] });
        Sound.play('arrowRain', 0.04);
      }
      if (v.impacts.every((i) => i.done)) v.dead = true;
    }
    removeDead(this.volleys);
  }

  drawGroundExtras(ctx) {
    const c = this.cfg.volley;
    if (this.camo > 0) this.drawDetectRing(ctx);
    if (this.choosingArrow) {
      // aim line, half fire / half ice
      const len = 90;
      ctx.save();
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      for (const [col, off] of [['rgba(255, 140, 50, 0.8)', -1.5], ['rgba(150, 220, 255, 0.8)', 1.5]]) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(this.pivotX - Math.sin(this.aim) * off, this.pivotY + Math.cos(this.aim) * off);
        ctx.lineTo(this.pivotX + Math.cos(this.aim) * len - Math.sin(this.aim) * off, this.pivotY + Math.sin(this.aim) * len + Math.cos(this.aim) * off);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.targeting) {
      const pulse = 1 + Math.sin(this.animTime * 8) * 0.04;
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 255, 140, 0.85)';
      ctx.fillStyle = 'rgba(120, 255, 140, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(this.targetPos.x, this.targetPos.y, c.radius * pulse, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const v of this.volleys) {
      ctx.fillStyle = 'rgba(120, 255, 140, 0.1)';
      ctx.beginPath();
      ctx.arc(v.x, v.y, c.radius, 0, TAU);
      ctx.fill();
    }
  }

  /** Enemies close enough to see through the camo. */
  spotters() {
    const range = CONFIG.player.invisibleDetectRange;
    return this.world ? this.world.enemies.filter((e) => !e.dead && dist(e.x, e.y, this.x, this.y) <= range) : [];
  }

  /** Camo: ring showing how close enemies can get before they see you (red when one is inside). */
  drawDetectRing(ctx) {
    const range = CONFIG.player.invisibleDetectRange;
    const seen = this.spotters().length > 0;
    ctx.save();
    ctx.strokeStyle = seen ? 'rgba(255, 80, 70, 0.8)' : 'rgba(140, 255, 154, 0.6)';
    ctx.fillStyle = seen ? 'rgba(255, 80, 70, 0.07)' : 'rgba(140, 255, 154, 0.05)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this.animTime * 20;
    ctx.beginPath();
    ctx.arc(this.x, this.y, range, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // passive: Agility (faster base speed in CONFIG, shorter dodge via dodgeCooldown)
  get passiveInfo() {
    return { name: 'AGILITY', color: '#8cff9a', text: `FAST, ${this.dodgeCooldown}s DODGE` };
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
