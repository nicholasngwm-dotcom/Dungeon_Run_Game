// Rogue: spends energy. LMB throws three daggers, RMB swift strike (dash
// slash, bleeds wounded enemies), E parry, F dagger storm, Q clone surprise.

class Rogue extends Player {
  constructor(x, y) {
    super('rogue', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.dagger;
    this.maxCooldowns = {
      primary: c.dagger.cooldown, secondary: c.strike.cooldown, e: c.parry.cooldown,
      f: c.storm.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'DAGGERS', secondary: 'STRIKE', e: 'PARRY', f: 'STORM', q: 'CLONE' };
    this.dash = null;
    this.throwAnim = 0;
    this.parryTime = 0;
    this.haste = 0;
    this.stormReady = false;
    this.storm = null;
    this.vanish = 0;
    this.streak = 0;       // Killing Streak passive
    this.streakTime = 0;
  }

  get moveMultiplier() { return this.haste > 0 ? this.cfg.parry.speedMultiplier : 1; }
  get invisible() { return this.vanish > 0; }
  get ignoresContact() { return !!this.dash; }
  get bodyAlpha() { return this.vanish > 0 ? 0.15 : 1; }

  onKill(world) {
    this.gainResource(this.cfg.resource.perKill);
    // passive: Killing Streak
    const c = this.cfg.passive;
    const was = this.streak;
    this.streak = Math.min(c.maxStreak, this.streak + 1);
    this.streakTime = c.duration;
    if (this.streak !== was) {
      world.effects.text(this.hx, this.hy - 40, this.streak === c.maxStreak ? 'MAX STREAK!' : `STREAK x${this.streak}`, { color: '#f0c040', size: this.streak === c.maxStreak ? 9 : 7 });
    }
  }

  // ---------- passive: Killing Streak ----------

  get damageMultiplier() { return 1 + this.streak * this.cfg.passive.damagePerStreak; }

  updateStreak(dt, world) {
    if (this.streak <= 0) return;
    this.streakTime -= dt;
    if (this.streakTime > 0) return;
    world.effects.text(this.hx, this.hy - 40, 'STREAK LOST', { color: '#a99bbd', size: 7 });
    this.streak = 0;
  }

  get passiveInfo() {
    const c = this.cfg.passive;
    const on = this.streak > 0;
    return {
      name: 'KILL STREAK', color: '#f0c040', pips: this.streak, maxPips: c.maxStreak, ready: this.streak === c.maxStreak,
      text: on ? `x${this.streak}  +${Math.round(this.streak * c.damagePerStreak * 100)}% DMG` : 'KILL TO START',
      bar: on ? this.streakTime / c.duration : null,
    };
  }

  /** Streak counter over the rogue's head, with a ring that drains as the streak runs out. */
  drawPassive(ctx) {
    if (this.streak <= 0 || this.dead) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y - 54);
    const k = clamp(this.streakTime / this.cfg.passive.duration, 0, 1);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = k < 0.3 && Math.floor(this.animTime * 10) % 2 ? '#ff6040' : '#f0c040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUTLINE;
    ctx.fillText(`${this.streak}`, x + 1, y + 1);
    ctx.fillStyle = '#ffe680';
    ctx.fillText(`${this.streak}`, x, y);
    ctx.restore();
  }

  handleMouse(world) {
    if (this.storm) {
      if (Input.mouse.rightPressed) this.tryAbility('secondary', world, () => this.secondary(world));
      return;
    }
    super.handleMouse(world);
  }

  throwDagger(world, angle, damage, opts = {}) {
    world.playerProjectiles.push(new Projectile({
      x: this.pivotX + Math.cos(angle) * 12,
      y: this.pivotY + Math.sin(angle) * 12,
      vx: Math.cos(angle) * this.cfg.dagger.speed,
      vy: Math.sin(angle) * this.cfg.dagger.speed,
      radius: 5, damage, life: 0.9, knockback: 70,
      sprite: Sprites.weapons.dagger.img,
      ...opts,
    }));
  }

  // ---------- LMB: dagger fan (or start the storm) ----------

  primary(world) {
    const c = this.cfg.dagger;
    if (this.stormReady) {
      this.stormReady = false;
      this.storm = { t: 0, next: 0 };
      Sound.play('volley');
      return;
    }
    this.cooldowns.primary = c.cooldown;
    if (!this.spend(c.cost, world)) return;
    this.throwAnim = 0.1;
    const spread = c.spreadDegrees * DEG;
    for (let i = 0; i < c.count; i++) {
      this.throwDagger(world, this.aim + (i / (c.count - 1) - 0.5) * spread, c.damage);
    }
    Sound.play('dagger');
  }

  updateStorm(dt, world) {
    const s = this.storm;
    const c = this.cfg.storm;
    s.t += dt;
    s.next -= dt;
    while (s.next <= 0) {
      s.next += c.interval;
      this.throwAnim = 0.06;
      for (let i = 0; i < 2; i++) {
        this.throwDagger(world, this.aim + rand(-0.5, 0.5) * c.spreadDegrees * DEG, c.damage, { trail: ['#f0c040'] });
      }
      Sound.play('dagger', 0.1);
    }
    if (s.t >= c.duration) this.storm = null;
  }

  // ---------- RMB: swift strike ----------

  secondary(world) {
    const c = this.cfg.strike;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.secondary = c.cooldown;
    const angle = this.aim;
    this.dash = { t: 0, angle, hit: new Set(), ghostTimer: 0 };
    this.busy = c.duration;
    this.iframes = Math.max(this.iframes, c.invulnerability);
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
    Sound.play('dash');
    world.effects.burst(this.x, this.y, { count: 10, colors: ['#8a8aaa', '#c8c8e0'], speed: [40, 100], life: [0.2, 0.4] });
  }

  updateDash(dt, world) {
    const d = this.dash;
    const c = this.cfg.strike;
    d.t += dt;
    const speed = c.distance / c.duration;
    world.dungeon.move(this, Math.cos(d.angle) * speed * dt, Math.sin(d.angle) * speed * dt);

    for (const t of world.getTargets()) {
      if (d.hit.has(t)) continue;
      if (dist(this.hx, this.hy, t.hx, t.hy) > this.radius + t.radius + 10) continue;
      d.hit.add(t);
      const wounded = t.hp / t.maxHp < c.bleedBelow;
      world.damageTarget(t, c.damage, { angle: d.angle, knockback: 200 });
      if (wounded && !t.dead) {
        world.addDot(t, c.bleedDps, c.bleedDuration);
        world.effects.text(t.hx, t.hy - 34, 'BLEED', { color: '#ff6060', size: 7 });
      }
      world.effects.burst(t.hx, t.hy, { count: 8, colors: ['#ffffff', '#b52c3e'], speed: [80, 180] });
    }

    d.ghostTimer -= dt;
    if (d.ghostTimer <= 0) {
      d.ghostTimer = 0.03;
      this.afterimage(world, 0.25, 0.45);
    }
    if (d.t >= c.duration) this.dash = null;
  }

  // ---------- E: parry ----------

  abilityE() {
    const c = this.cfg.parry;
    this.cooldowns.e = c.cooldown;
    this.parryTime = c.window;
    Sound.play('aim');
  }

  absorb(amount, world) {
    if (this.parryTime <= 0) return amount;
    const c = this.cfg.parry;
    this.parryTime = 0;
    this.gainResource(c.energy);
    this.haste = c.speedDuration;
    world.effects.text(this.hx, this.hy - 30, 'PARRY!', { color: '#f0c040', size: 9 });
    world.effects.burst(this.hx, this.hy - 10, { count: 16, colors: ['#ffffff', '#f0c040'], speed: [80, 200], life: [0.15, 0.35] });
    world.shake(3, 0.1);
    Sound.play('crit');
    return 0;
  }

  // ---------- F: dagger storm ----------

  abilityF(world) {
    const c = this.cfg.storm;
    if (this.stormReady || this.storm) return;
    if (!this.spend(c.cost, world)) return;
    this.cooldowns.f = c.cooldown;
    this.stormReady = true;
    world.effects.text(this.hx, this.hy - 30, 'STORM READY', { color: '#f0c040', size: 7 });
    Sound.play('aim');
  }

  // ---------- Q: clone surprise ----------

  ultimate(world) {
    const c = this.cfg.ult;
    this.vanish = c.vanish;
    this.iframes = Math.max(this.iframes, c.vanish);
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#3e3e52', '#56566e', '#9a2230'], speed: [40, 140], life: [0.3, 0.6] });
    Sound.play('dash');
    world.after(c.vanish, () => {
      if (this.dead) return;
      const start = rand(0, TAU);
      for (let i = 0; i < c.clones; i++) {
        const slot = start + (i / c.clones) * TAU;
        const pt = world.dungeon.freePoint(this.x + Math.cos(slot) * 34, this.y + Math.sin(slot) * 24, 9, 6);
        const clone = new RogueClone(this, pt.x, pt.y, slot);
        world.clones.push(clone);
        world.effects.burst(clone.hx, clone.hy, { count: 16, colors: ['#3e3e52', '#9a2230'], speed: [40, 120] });
      }
      world.effects.burst(this.hx, this.hy, { count: 16, colors: ['#3e3e52', '#9a2230'], speed: [40, 120] });
    });
  }

  updateAbility(dt, world) {
    this.updateStreak(dt, world);
    this.throwAnim -= dt;
    this.parryTime -= dt;
    this.haste -= dt;
    this.vanish -= dt;
    if (this.haste > 0 && Math.random() < 0.3) {
      world.effects.burst(this.x, this.y, { count: 1, colors: ['#f0c040'], speed: [5, 15], life: [0.2, 0.3] });
    }
    if (this.dash) this.updateDash(dt, world);
    if (this.storm) this.updateStorm(dt, world);
  }

  drawExtras(ctx) {
    if (this.stormReady || this.storm) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(240, 192, 64, ${0.4 + Math.sin(this.animTime * 15) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.hy, 22, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  get weaponReach() { return this.throwAnim > 0 ? 16 : 10; }

  weaponAngle() {
    if (this.parryTime > 0) return -Math.PI / 2;
    return this.aim;
  }
}

/**
 * Rogue clone: hunts the nearest enemy on its own, circling it from its own
 * side (`slot` angle) and throwing weaker daggers. Enemies may target it; it
 * takes extra damage and explodes into daggers when it dies or its time runs out.
 */
class RogueClone extends Entity {
  constructor(owner, x, y, slot = 0) {
    super(x, y);
    this.owner = owner;
    this.cfg = owner.cfg.ult;
    this.maxHp = this.cfg.cloneHp;
    this.hp = this.maxHp;
    this.life = this.cfg.cloneLife;
    this.radius = 12;
    this.hw = 9;
    this.hh = 6;
    this.frames = owner.frames;
    this.fireTimer = 0.3;
    this.invulnerable = 0;
    this.moving = false;
    this.aim = 0;
    this.slot = slot;
  }

  update(dt, world) {
    this.animTime += dt;
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.life -= dt;
    if (this.life <= 0) return this.die(world);
    this.updateKnockback(dt, world);

    // hunt the nearest enemy: move to this clone's side of it, at throwing range
    const o = this.owner;
    const target = nearestTarget(world, this.x, this.hy, 900);
    this.moving = false;
    if (target) {
      const tx = target.x + Math.cos(this.slot) * this.cfg.cloneRange;
      const ty = target.y + Math.sin(this.slot) * this.cfg.cloneRange * 0.7;
      if (dist(this.x, this.y, tx, ty) > 12) {
        this.moving = true;
        const a = angleTo(this.x, this.y, tx, ty);
        const s = o.speed * 0.95 * dt;
        world.dungeon.move(this, Math.cos(a) * s, Math.sin(a) * s);
        this.facing = Math.cos(a) >= 0 ? 1 : -1;
      }
    }
    if (target) {
      this.aim = angleTo(this.x, this.hy, target.hx, target.hy);
      this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    }
    this.fireTimer -= dt;
    if (target && this.fireTimer <= 0 && dist(this.x, this.hy, target.hx, target.hy) < 320) {
      this.fireTimer = this.cfg.cloneFireInterval;
      const d = o.cfg.dagger;
      const spread = d.spreadDegrees * DEG;
      for (let i = 0; i < d.count; i++) {
        const a = this.aim + (i / (d.count - 1) - 0.5) * spread;
        world.playerProjectiles.push(new Projectile({
          x: this.x + Math.cos(a) * 12, y: this.hy + 2 + Math.sin(a) * 12,
          vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed,
          radius: 5, damage: d.damage * this.cfg.cloneDamageDealt, life: 0.9, knockback: 50,
          sprite: Sprites.weapons.dagger.img, fromUlt: true,
        }));
      }
      Sound.play('dagger', 0.1);
    }
  }

  get invisible() { return false; }

  hurt(amount, world, fromX, fromY) {
    if (this.dead || this.invulnerable > 0) return false;
    const dmg = Math.round(amount * this.cfg.cloneDamageTaken);
    this.hp -= dmg;
    this.invulnerable = 0.3;
    this.flashTime = 0.1;
    world.effects.text(this.hx, this.hy - 24, `-${dmg}`, { color: '#c08aff', size: 8 });
    if (fromX !== undefined) this.knockback(angleTo(fromX, fromY, this.x, this.y), 140);
    if (this.hp <= 0) this.die(world);
    return true;
  }

  /** Bursts into a ring of piercing daggers; each stuns the first enemy it hits. */
  die(world) {
    if (this.dead) return;
    this.dead = true;
    const c = this.cfg;
    for (let i = 0; i < c.burstDaggers; i++) {
      const a = (i / c.burstDaggers) * TAU;
      world.playerProjectiles.push(new Projectile({
        x: this.x, y: this.hy,
        vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        radius: 6, damage: c.burstDamage, pierce: c.burstPierce, life: 0.8, knockback: 90,
        sprite: Sprites.weapons.dagger.img, trail: ['#c08aff', '#ffffff'], fromUlt: true,
        onStrike: (p, w, t) => {
          if (p.stunned) return;
          p.stunned = true;
          t.stun?.(c.burstStun);
        },
      }));
    }
    world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#3e3e52', '#9a2230', '#c08aff', '#ffffff'], speed: [80, 220], life: [0.3, 0.6] });
    world.shake(6, 0.25);
    Sound.play('explosion');
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 9, 13, 5, 0.25);
  }

  draw(ctx) {
    if (this.dead) return;
    const frame = this.moving ? this.frames.walk[Math.floor(this.animTime * 9) % 4] : this.frames.idle[Math.floor(this.animTime * 2.5) % 2];
    const fade = Math.min(1, this.life * 2);
    this.drawFrame(ctx, frame, HERO_ANCHOR, 0.7 * fade);
    // ghostly purple sheen
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(ctx, frame.flash, this.x, this.y, HERO_ANCHOR.x, HERO_ANCHOR.y, this.facing < 0, 0.12 * fade);
    ctx.restore();
    const w = 24;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - 50);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#c08aff';
    ctx.fillRect(x, y, Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 2);
  }
}
