// Knight (class id 'warrior'): LMB slash-slash-stab combo, RMB (hold) carried barrier shield,
// E spin attack, F stunning charge, Q world-cutting slash.

class Warrior extends Player {
  constructor(x, y) {
    super('warrior', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.greatblade;
    this.maxCooldowns = {
      primary: c.combo.cooldown, secondary: c.barrier.breakCooldown, e: c.spin.cooldown,
      f: c.charge.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'COMBO', secondary: 'SHIELD', e: 'SPIN', f: 'CHARGE', q: 'CLEAVE' };
    this.swingTime = 0;
    this.swingDir = 1;
    this.comboStep = 0;
    this.comboTimer = 0;
    this.stab = null;      // short lunge on the 3rd hit
    this.bash = null;      // shield bash lunge in progress
    this.bashCooldown = 0;
    this.barrier = new KnightBarrier(this); // carried shield wall, raised with RMB
    this.spin = null;
    this.charge = null;
    this.cleave = null;    // ult power-up
    this.hitsTaken = 0;    // Tanker passive: hits since the last automatic block
    this.chargeCharges = c.charge.charges;  // F uses stored up
    this.chargeRecharge = 0;                // seconds until the next one refills
  }

  get channeling() { return !!(this.spin || this.cleave); }
  get ignoresContact() { return !!(this.charge || this.bash); }

  get moveMultiplier() {
    if (this.cleave) return this.cfg.ult.moveMultiplier;
    if (this.spin) return this.cfg.spin.moveMultiplier;
    if (this.shielding) return this.cfg.barrier.moveMultiplier;
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

  // ---------- RMB (hold): carried barrier shield ----------

  get shielding() { return this.barrier.raised; }

  /** With the shield up, LMB is a shield bash instead of the combo; RMB is handled in updateShield. */
  handleMouse(world) {
    const m = Input.mouse;
    if (this.shielding) {
      if (m.leftPressed) {
        if (this.bashCooldown <= 0) this.shieldBash(world);
        else Sound.play('denied');
      }
    } else if (m.left && this.cooldowns.primary <= 0) this.primary(world);
    if (m.rightPressed && this.cooldowns.secondary > 0) Sound.play('denied');
  }

  /** Raises the barrier while RMB is held (and it isn't broken), lowers it otherwise. Stays up through a bash. */
  updateShield(world) {
    if (!world.barriers.includes(this.barrier)) world.barriers.push(this.barrier);
    const up = Input.mouse.right && (this.busy <= 0 || this.bash) && !this.channeling && this.cooldowns.secondary <= 0 && this.barrier.hp > 0;
    if (up && !this.barrier.raised) Sound.play('aim');
    this.barrier.raised = up;
    this.barrier.follow();
  }

  // ---------- LMB while shielding: shield bash ----------

  shieldBash(world) {
    const c = this.cfg.bash;
    this.bashCooldown = c.cooldown;
    this.bash = { t: 0, angle: this.aim, hit: new Set() };
    this.busy = c.time;
    this.cooldowns.primary = 0.3; // so the combo doesn't swing the moment the shield drops
    world.effects.burst(this.barrier.x, this.barrier.hy, { count: 10, colors: ['#ffffff', '#9ad0ff'], speed: [40, 120], life: [0.15, 0.3] });
    Sound.play('dash');
  }

  updateBash(dt, world) {
    const b = this.bash;
    const c = this.cfg.bash;
    b.t += dt;
    const speed = c.distance / c.time;
    world.dungeon.move(this, Math.cos(b.angle) * speed * dt, Math.sin(b.angle) * speed * dt);
    const arc = (c.arcDegrees * DEG) / 2;
    for (const t of world.getTargets()) {
      if (b.hit.has(t)) continue;
      const d = dist(this.x, this.hy, t.hx, t.hy);
      if (d > c.reach + t.radius) continue;
      if (d > t.radius && Math.abs(angleDiff(b.angle, angleTo(this.x, this.hy, t.hx, t.hy))) > arc) continue;
      b.hit.add(t);
      world.damageTarget(t, c.damage, { angle: b.angle, knockback: c.knockback, sound: 'impact' });
      t.stun?.(c.stun);
      this.barrier.flash = 0.15;
      world.effects.burst(t.hx, t.hy, { count: 14, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [80, 220], life: [0.2, 0.4] });
      world.shake(4, 0.12);
    }
    this.afterimage(world, 0.15, 0.35);
    if (b.t >= c.time) this.bash = null;
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
    if (s.t > 0 && Input.pressed('e')) {
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
    this.chargeCharges--;
    if (this.chargeRecharge <= 0) this.chargeRecharge = c.cooldown;
    this.cooldowns.f = this.chargeCharges > 0 ? 0 : this.chargeRecharge;
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

  /** Charges refill one at a time; F is only on cooldown once they're all spent. */
  updateChargeCharges(dt) {
    const c = this.cfg.charge;
    if (this.chargeCharges < c.charges) {
      this.chargeRecharge -= dt;
      if (this.chargeRecharge <= 0) {
        this.chargeCharges++;
        this.chargeRecharge = this.chargeCharges < c.charges ? c.cooldown : 0;
      }
    }
    this.cooldowns.f = this.chargeCharges > 0 ? Math.min(this.cooldowns.f, 0) : this.chargeRecharge;
  }

  /** Charge count for the HUD's F slot. */
  get slotCharges() {
    const c = this.cfg.charge;
    return { f: { count: this.chargeCharges, max: c.charges, refill: this.chargeCharges < c.charges ? 1 - this.chargeRecharge / c.cooldown : 1 } };
  }

  updateAbility(dt, world) {
    this.updateChargeCharges(dt);
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
    this.bashCooldown -= dt;
    if (this.bash) this.updateBash(dt, world);
    this.updateShield(world);
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

  // ---------- passive: Tanker ----------

  get tankerReady() { return this.hitsTaken >= this.cfg.passive.hits; }

  onHitTaken() {
    this.hitsTaken = Math.min(this.cfg.passive.hits, this.hitsTaken + 1);
  }

  /** Once enough hits have landed, the next one is shrugged off. */
  passiveBlock(world, fromX, fromY) {
    if (!this.tankerReady) return false;
    this.hitsTaken = 0;
    this.invulnerable = CONFIG.player.hurtInvulnerability;
    world.effects.text(this.hx, this.hy - 30, 'BLOCKED!', { color: '#ffd34a', size: 10, life: 0.9 });
    world.effects.burst(this.hx, this.hy - 6, { count: 18, colors: ['#ffd34a', '#fff2a0', '#c8c0b0'], speed: [60, 180], life: [0.2, 0.45] });
    const x = this.hx;
    const y = this.hy - 6;
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 211, 74, ${1 - t})`;
      ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(x, y, 16 + t * 26, 0, TAU);
      ctx.stroke();
      ctx.restore();
    });
    world.shake(3, 0.12);
    Sound.play('impact');
    Sound.play('pickup');
    return true;
  }

  get passiveInfo() {
    const n = this.cfg.passive.hits;
    return {
      name: 'TANKER', color: '#f2a541', pips: this.hitsTaken, maxPips: n, ready: this.tankerReady,
      text: this.tankerReady ? 'NEXT HIT BLOCKED' : `${this.hitsTaken}/${n} HITS`,
    };
  }

  /** A glowing shield over the warrior's head while the free block is ready. */
  drawPassive(ctx) {
    if (!this.tankerReady || this.dead) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y - 52 + Math.sin(this.animTime * 4) * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
    g.addColorStop(0, `rgba(255, 211, 74, ${0.45 + Math.sin(this.animTime * 8) * 0.15})`);
    g.addColorStop(1, 'rgba(255, 211, 74, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.restore();
    // pixel shield
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 6, y - 7, 12, 10);
    ctx.fillRect(x - 5, y + 3, 10, 2);
    ctx.fillRect(x - 3, y + 5, 6, 2);
    ctx.fillStyle = '#ffd34a';
    ctx.fillRect(x - 5, y - 6, 10, 8);
    ctx.fillRect(x - 4, y + 2, 8, 2);
    ctx.fillRect(x - 2, y + 4, 4, 2);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(x - 4, y - 5, 3, 3);
    ctx.fillStyle = '#b8862a';
    ctx.fillRect(x - 1, y - 6, 2, 11);
  }

  drawExtras(ctx) {
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

/**
 * Knight barrier: a wall of light the knight carries and raises with RMB.
 * It's its own entity in world.barriers, so enemy projectiles (and golem
 * lasers) crossing it are soaked by the wall itself, not the knight. It sits
 * `distance` px ahead of the knight, facing the aim, and only blocks while
 * raised. Bodies and melee pass through. (x, y) are the feet of the wall's
 * centre; projectiles collide at hy.
 */
class KnightBarrier {
  constructor(owner) {
    this.owner = owner;
    this.cfg = owner.cfg.barrier;
    this.hp = this.cfg.hp;
    this.raised = false;
    this.raise = 0;          // 0..1 raise animation
    this.age = 0;
    this.flash = 0;
    this.dead = false;
    this.follow();
  }

  get hy() { return this.y - 14; }

  /** Keeps the wall in front of the knight, facing the aim. */
  follow() {
    const o = this.owner;
    const c = this.cfg;
    const cx = o.x + Math.cos(o.aim) * c.distance;
    const cy = o.hy + Math.sin(o.aim) * c.distance;
    this.x = cx;
    this.y = cy + 14;
    const perp = o.aim + Math.PI / 2;
    const hw = c.width / 2;
    this.ax = cx + Math.cos(perp) * hw;
    this.ay = cy + Math.sin(perp) * hw;
    this.bx = cx - Math.cos(perp) * hw;
    this.by = cy - Math.sin(perp) * hw;
  }

  touches(x, y, r) {
    return this.raised && pointSegmentDistance(x, y, this.ax, this.ay, this.bx, this.by) <= r + this.cfg.thickness / 2;
  }

  crossesSegment(x1, y1, x2, y2) {
    return this.raised && segmentsIntersect(this.ax, this.ay, this.bx, this.by, x1, y1, x2, y2);
  }

  absorb(amount, world, x, y) {
    if (!this.raised) return;
    this.hp -= amount;
    this.flash = 0.12;
    world.effects.burst(x, y, { count: 10, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [60, 180], life: [0.15, 0.35] });
    Sound.play('bounce');
    if (this.hp > 0) return;
    this.hp = 0;
    this.raised = false;
    this.owner.cooldowns.secondary = this.cfg.breakCooldown;
    world.effects.text(this.x, this.hy - 36, 'SHIELD BROKEN', { color: '#9ad0ff', size: 8 });
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      world.effects.burst(lerp(this.ax, this.bx, t), lerp(this.ay, this.by, t) - 6, {
        count: 8, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [40, 160], life: [0.25, 0.5],
      });
    }
    world.shake(4, 0.15);
    Sound.play('explosion');
  }

  /** The knight drives raising/lowering; the wall tracks him and regens while lowered. */
  update(dt) {
    const c = this.cfg;
    this.age += dt;
    this.flash -= dt;
    this.idle = this.raised ? 0 : (this.idle || 0) + dt;
    if (this.idle >= c.regenDelay) this.hp = Math.min(c.hp, this.hp + c.regen * dt);
    this.raise = clamp(this.raise + (this.raised ? 10 : -10) * dt, 0, 1);
    if (this.owner.dead) this.raised = false;
    this.follow();
  }

  draw(ctx) {
    if (this.raise <= 0) return;
    const frac = clamp(this.hp / this.cfg.hp, 0, 1);
    const top = 26 * this.raise;   // wall height above the collision line
    const foot = 14;               // ...and down to the floor
    const { ax, ay, bx, by } = this;
    ctx.save();
    ctx.globalAlpha = this.raise;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.flash > 0 ? 'rgba(220, 240, 255, 0.5)' : `rgba(80, 150, 255, ${0.14 + 0.2 * frac})`;
    ctx.beginPath();
    ctx.moveTo(ax, ay + foot);
    ctx.lineTo(bx, by + foot);
    ctx.lineTo(bx, by - top);
    ctx.lineTo(ax, ay - top);
    ctx.closePath();
    ctx.fill();
    // panel seams
    ctx.strokeStyle = `rgba(160, 210, 255, ${0.3 + 0.3 * frac})`;
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const x = lerp(ax, bx, i / 5);
      const y = lerp(ay, by, i / 5);
      ctx.beginPath();
      ctx.moveTo(x, y + foot);
      ctx.lineTo(x, y - top);
      ctx.stroke();
    }
    // a band of light sweeping up the wall
    const s = (this.age * 0.8) % 1;
    ctx.strokeStyle = `rgba(200, 235, 255, ${0.5 * (1 - s)})`;
    ctx.beginPath();
    ctx.moveTo(ax, ay + foot - s * (top + foot));
    ctx.lineTo(bx, by + foot - s * (top + foot));
    ctx.stroke();
    // bright edges
    ctx.strokeStyle = `rgba(190, 230, 255, ${0.65 + Math.sin(this.age * 12) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay - top);
    ctx.lineTo(bx, by - top);
    ctx.moveTo(ax, ay + foot);
    ctx.lineTo(bx, by + foot);
    ctx.stroke();
    ctx.restore();
    // hp bar over the knight
    const o = this.owner;
    const w = 30;
    const x = Math.round(o.x - w / 2);
    const y = Math.round(o.y - 46);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = frac > 0.3 ? '#9ad0ff' : '#ff8a6a';
    ctx.fillRect(x, y, Math.round(w * frac), 3);
  }
}
