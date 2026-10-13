// Warrior: LMB slash-slash-stab combo, RMB shield block, E spin attack,
// F stunning charge, Q world-cutting slash.

class Warrior extends Player {
  constructor(x, y) {
    super('warrior', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.greatblade;
    this.maxCooldowns = {
      primary: c.combo.cooldown, secondary: c.shield.breakCooldown, e: c.spin.cooldown,
      f: c.charge.cooldown, dodge: CONFIG.player.dodge.cooldown,
    };
    this.icons = { primary: 'COMBO', secondary: 'SHIELD', e: 'SPIN', f: 'CHARGE', q: 'CLEAVE' };
    this.swingTime = 0;
    this.swingDir = 1;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.stab = null;      // short lunge on the 3rd hit
    this.shielding = false;
    this.shieldHp = c.shield.hp;
    this.shieldIdle = 0;     // time since the shield was lowered (regen delay)
    this.shieldFlash = 0;
    this.spin = null;
    this.charge = null;
    this.cleave = null;    // ult power-up
  }

  get channeling() { return !!(this.spin || this.cleave); }
  get ignoresContact() { return !!this.charge; }

  get moveMultiplier() {
    if (this.cleave) return this.cfg.ult.moveMultiplier;
    if (this.spin) return this.cfg.spin.moveMultiplier;
    if (this.shielding) return this.cfg.shield.moveMultiplier;
    return 1;
  }

  // ---------- LMB: combo ----------

  primary(world) {
    const c = this.cfg.combo;
    if (this.comboTimer <= 0) this.comboStep = 0;
    this.comboTimer = c.resetTime;
    if (this.comboStep < 2) {
      this.slash(world);
      this.cooldowns.primary = c.cooldown;
      this.maxCooldowns.primary = c.cooldown;
      this.comboStep++;
    } else {
      this.stabAttack(world);
      this.cooldowns.primary = c.stabCooldown;
      this.maxCooldowns.primary = c.stabCooldown;
      this.comboStep = 0;
    }
  }

  slash(world) {
    const c = this.cfg.combo;
    this.swingTime = 0.16;
    this.swingDir *= -1;
    const arc = c.arcDegrees * DEG;
    const px = this.pivotX;
    const py = this.pivotY;
    const aim = this.aim;
    for (const t of world.getTargets()) {
      const d = dist(px, py, t.hx, t.hy);
      if (d > c.range + t.radius) continue;
      if (d > t.radius && Math.abs(angleDiff(aim, angleTo(px, py, t.hx, t.hy))) > arc / 2) continue;
      world.damageTarget(t, c.damage, { angle: aim, knockback: c.knockback });
    }
    const dir = this.swingDir;
    world.effects.add(0.16, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 12 * (1 - t) + 2;
      ctx.beginPath();
      const start = aim - (arc / 2) * dir;
      const sweep = arc * Math.min(1, t * 3) * dir;
      ctx.arc(px, py, c.range * 0.75, Math.min(start, start + sweep), Math.max(start, start + sweep));
      ctx.stroke();
      ctx.restore();
    });
    Sound.play('slash');
  }

  stabAttack(world) {
    const c = this.cfg.combo;
    this.stab = { t: 0, angle: this.aim };
    this.busy = 0.12;
    const x1 = this.pivotX;
    const y1 = this.pivotY;
    this.hitLine(world, x1, y1, this.aim, c.stabRange, c.stabWidth, c.stabDamage, { knockback: c.stabKnockback });
    this.lineFx(world, x1, y1, this.aim, c.stabRange, c.stabWidth, '#ffffff', 0.2);
    world.shake(3, 0.1);
    Sound.play('thrust');
  }

  // ---------- RMB (hold): barrier shield ----------

  /** LMB combo is disabled while the shield is up; RMB is handled in updateShield. */
  handleMouse(world) {
    if (Input.mouse.left && this.cooldowns.primary <= 0 && !this.shielding) this.primary(world);
    if (Input.mouse.rightPressed && this.cooldowns.secondary > 0) Sound.play('denied');
  }

  updateShield(dt) {
    const c = this.cfg.shield;
    const up = Input.mouse.right && this.busy <= 0 && !this.channeling && this.cooldowns.secondary <= 0;
    if (up && !this.shielding) Sound.play('aim');
    this.shielding = up;
    this.shieldIdle = up ? 0 : this.shieldIdle + dt;
    if (this.shieldIdle >= c.regenDelay) this.shieldHp = Math.min(c.hp, this.shieldHp + c.regen * dt);
    this.shieldFlash -= dt;
  }

  get absorbGuardTime() { return this.cfg.shield.guardTime; }

  /** Soaks hits coming from inside the shield's frontal arc. */
  absorb(amount, world, fromX, fromY) {
    if (!this.shielding || fromX === undefined) return amount;
    const c = this.cfg.shield;
    if (Math.abs(angleDiff(this.aim, angleTo(this.x, this.hy, fromX, fromY))) > (c.arcDegrees * DEG) / 2) return amount;
    this.shieldHp -= amount;
    this.shieldFlash = 0.12;
    const sx = this.x + Math.cos(this.aim) * c.radius;
    const sy = this.hy + Math.sin(this.aim) * c.radius;
    world.effects.burst(sx, sy, { count: 10, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [60, 180], life: [0.15, 0.35] });
    Sound.play('bounce');
    if (this.shieldHp <= 0) {
      this.shieldHp = 0;
      this.shielding = false;
      this.cooldowns.secondary = c.breakCooldown;
      world.effects.text(this.hx, this.hy - 30, 'SHIELD BROKEN', { color: '#9ad0ff', size: 8 });
      world.effects.burst(sx, sy, { count: 24, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [80, 240], life: [0.3, 0.6] });
      world.shake(4, 0.15);
      Sound.play('explosion');
    }
    return 0;
  }

  // ---------- E: spin ----------

  abilityE() {
    const c = this.cfg.spin;
    this.cooldowns.e = c.cooldown;
    this.spin = { t: 0, tick: 0 };
    Sound.play('thrustCharge');
  }

  updateSpin(dt, world) {
    const s = this.spin;
    const c = this.cfg.spin;
    // press E again to stop spinning (ignoring the frame it started)
    if (s.t > 0 && Input.wasPressed('KeyE')) {
      this.spin = null;
      return;
    }
    s.t += dt;
    s.tick -= dt;
    if (s.tick <= 0) {
      s.tick = c.tick;
      this.hitCircle(world, this.x, this.hy, c.radius, c.damage, { knockback: c.knockback, sound: 'hit' });
      Sound.play('slash', 0.1);
    }
    if (s.t >= c.duration) this.spin = null;
  }

  // ---------- F: charge ----------

  abilityF() {
    const c = this.cfg.charge;
    this.cooldowns.f = c.cooldown;
    this.charge = { t: 0, angle: this.aim, dashing: false, hit: new Set() };
    this.busy = c.windup + c.time;
    Sound.play('thrustCharge');
  }

  updateCharge(dt, world) {
    const ch = this.charge;
    const c = this.cfg.charge;
    ch.t += dt;
    if (!ch.dashing) {
      ch.angle = this.aim;
      this.facing = Math.cos(ch.angle) >= 0 ? 1 : -1;
      if (Math.random() < 0.5) world.effects.burst(this.x, this.y, { count: 1, colors: ['#c9d3dd', '#8a7a6a'], speed: [20, 60], life: [0.2, 0.3] });
      if (ch.t >= c.windup) {
        ch.dashing = true;
        Sound.play('dash');
        world.shake(4, 0.2);
      }
      return;
    }
    const speed = c.distance / c.time;
    world.dungeon.move(this, Math.cos(ch.angle) * speed * dt, Math.sin(ch.angle) * speed * dt);
    for (const t of world.getTargets()) {
      if (ch.hit.has(t)) continue;
      if (dist(this.hx, this.hy, t.hx, t.hy) > c.width / 2 + t.radius) continue;
      ch.hit.add(t);
      // shove enemies to the side of the charge
      const side = angleDiff(ch.angle, angleTo(this.x, this.y, t.hx, t.hy)) >= 0 ? 1 : -1;
      world.damageTarget(t, c.damage, { angle: ch.angle + side * 1.1, knockback: c.knockback });
      t.stun?.(c.stun);
    }
    this.afterimage(world, 0.2, 0.4);
    if (ch.t >= c.windup + c.time) this.charge = null;
  }

  // ---------- Q: world-cutting slash ----------

  ultimate(world) {
    this.cleave = { t: 0 };
    world.effects.text(this.hx, this.hy - 34, 'POWERING UP', { color: '#ffd34a', size: 8 });
    Sound.play('laserCharge');
  }

  /** 0..1 charge of the cleave; damage scales from minPower to full. */
  get cleavePower() {
    const c = this.cfg.ult;
    return this.cleave ? clamp(this.cleave.t / c.powerTime, 0, 1) : 0;
  }

  updateCleave(dt, world) {
    const c = this.cfg.ult;
    const cl = this.cleave;
    // LMB releases early (ignoring the frame Q was pressed in)
    const release = cl.t > 0 && Input.mouse.leftPressed;
    cl.t += dt;
    if (Math.random() < 0.3 + this.cleavePower * 0.5) {
      world.effects.burst(this.x + rand(-14, 14), this.y - rand(0, 30), { count: 1, colors: ['#ffd34a', '#fff6c8', '#ff8a1e'], speed: [10, 40], up: 60, life: [0.3, 0.6] });
    }
    if (cl.t < c.powerTime && !release) return;
    const power = this.cleavePower;
    this.cleave = null;
    this.cooldowns.primary = 0.3; // so the releasing click doesn't also swing
    const mult = lerp(c.minPower, 1, power);
    const width = c.width * lerp(0.6, 1, power);
    const x1 = this.pivotX;
    const y1 = this.pivotY;
    this.hitLine(world, x1, y1, this.aim, c.length, width, c.damage * mult, { knockback: 400 * mult, fromUlt: true });
    this.lineFx(world, x1, y1, this.aim, c.length, width, '#ffe08a', 0.45);
    if (power >= 1) world.effects.text(this.hx, this.hy - 40, 'FULL POWER!', { color: '#ffd34a', size: 9 });
    world.effects.add(2.5, (ctx, t) => {
      ctx.save();
      ctx.translate(x1, y1 + 10);
      ctx.rotate(this.aim);
      ctx.fillStyle = `rgba(20, 10, 10, ${0.5 * (1 - t)})`;
      ctx.fillRect(0, -6, c.length, 12);
      ctx.restore();
    }, true);
    world.shake(6 + 8 * power, 0.6);
    Sound.play('explosion');
    Sound.play('heavySwing');
  }

  // ---------- shared ----------

  /** Bright fading beam along an attack line. */
  lineFx(world, x1, y1, angle, length, width, color, life) {
    world.effects.add(life, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = width * 0.6 * (1 - t * 0.6);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
      ctx.stroke();
      ctx.restore();
    });
  }

  updateAbility(dt, world) {
    this.swingTime -= dt;
    this.comboTimer -= dt;
    if (this.stab) {
      this.stab.t += dt;
      const speed = this.cfg.combo.stabLunge / 0.12;
      if (this.stab.t < 0.12) world.dungeon.move(this, Math.cos(this.stab.angle) * speed * dt, Math.sin(this.stab.angle) * speed * dt);
      else this.stab = null;
    }
    if (this.spin) this.updateSpin(dt, world);
    if (this.charge) this.updateCharge(dt, world);
    if (this.cleave) this.updateCleave(dt, world);
    this.updateShield(dt);
  }

  drawGroundExtras(ctx) {
    if (this.spin) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.cfg.spin.radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (this.charge && !this.charge.dashing) {
      const c = this.cfg.charge;
      const end = { x: this.x + Math.cos(this.charge.angle) * c.distance, y: this.y + Math.sin(this.charge.angle) * c.distance };
      Telegraph.line(ctx, this.x, this.y, end.x, end.y, c.width, this.charge.t / c.windup, '120, 200, 255');
    }
    if (this.cleave) {
      const c = this.cfg.ult;
      const ex = this.pivotX + Math.cos(this.aim) * c.length;
      const ey = this.pivotY + Math.sin(this.aim) * c.length;
      const power = this.cleavePower;
      Telegraph.line(ctx, this.pivotX, this.pivotY, ex, ey, c.width * lerp(0.6, 1, power), power, power >= 1 ? '255, 240, 140' : '255, 210, 80');
    }
  }

  drawExtras(ctx) {
    if (this.shielding) this.drawShield(ctx);
    if (this.cleave) {
      const r = 20 + Math.sin(this.animTime * 25) * 4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.pivotX, this.pivotY, 2, this.pivotX, this.pivotY, r * 2);
      g.addColorStop(0, 'rgba(255, 220, 120, 0.6)');
      g.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.pivotX - r * 2, this.pivotY - r * 2, r * 4, r * 4);
      ctx.restore();
    }
  }

  /** Curved energy barrier in the aim direction with an hp bar above the hero. */
  drawShield(ctx) {
    const c = this.cfg.shield;
    const half = (c.arcDegrees * DEG) / 2;
    const frac = this.shieldHp / c.hp;
    const flash = this.shieldFlash > 0;
    const r0 = c.radius - 4;
    const r1 = c.radius + 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = flash ? 'rgba(220, 240, 255, 0.45)' : `rgba(80, 150, 255, ${0.15 + 0.2 * frac})`;
    ctx.beginPath();
    ctx.arc(this.x, this.hy, r1, this.aim - half, this.aim + half);
    ctx.arc(this.x, this.hy, r0, this.aim + half, this.aim - half, true);
    ctx.closePath();
    ctx.fill();
    // panel seams
    ctx.strokeStyle = `rgba(160, 210, 255, ${0.35 + 0.3 * frac})`;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const a = this.aim + (half * i) / 3;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * r0, this.hy + Math.sin(a) * r0);
      ctx.lineTo(this.x + Math.cos(a) * r1, this.hy + Math.sin(a) * r1);
      ctx.stroke();
    }
    // bright outer edge
    ctx.strokeStyle = `rgba(190, 230, 255, ${0.6 + Math.sin(this.animTime * 12) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.hy, r1, this.aim - half, this.aim + half);
    ctx.stroke();
    ctx.restore();
    // hp bar
    const w = 30;
    const bx = Math.round(this.x - w / 2);
    const by = Math.round(this.y - 46);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx - 1, by - 1, w + 2, 5);
    ctx.fillStyle = frac > 0.3 ? '#9ad0ff' : '#ff8a6a';
    ctx.fillRect(bx, by, Math.round(w * frac), 3);
  }

  get weaponReach() {
    if (this.stab) return 26;
    return 10;
  }

  weaponAngle() {
    if (this.spin) return this.spin.t * 22;
    if (this.charge) return this.charge.angle;
    if (this.stab) return this.stab.angle;
    if (this.cleave) return -Math.PI / 2 + 0.3 * this.facing;
    if (this.swingTime > 0) {
      const t = 1 - this.swingTime / 0.16;
      return this.aim + lerp(-1.4, 1.4, t) * this.swingDir;
    }
    return this.aim - 0.5 * this.facing;
  }
}
