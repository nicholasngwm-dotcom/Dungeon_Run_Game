// Generic projectile used by heroes, enemies and the boss.
// Behaviour is configured with options rather than subclasses.

class Projectile {
  /** The hero whose attack this is (set by the game while each hero acts) - damage is credited to them. */
  static actor = null;

  constructor(opts) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 5,
      damage: 10,
      life: 2,
      friendly: true,      // true = hurts enemies, false = hurts the player
      pierce: 0,           // extra targets it can pass through
      bounces: 0,          // wall bounces before it breaks
      knockback: 80,
      sprite: null,
      spin: 0,             // radians/s; 0 = face direction of travel
      glow: null,          // 'r, g, b' for an additive glow
      trail: null,         // particle colours
      homing: null,        // fn(projectile, dt, world)
      onHit: null,         // fn(projectile, world, target?) when it stops
      onStrike: null,      // fn(projectile, world, target) each time it damages a target
      hitSound: 'hit',
      fromUlt: false,      // damage from an ultimate doesn't charge the ultimate
      owner: Projectile.actor, // hero who fired it (null for enemy shots)
    }, opts);
    this.age = 0;
    this.hitSet = new Set();
    this.dead = false;
  }

  update(dt, world) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) return this.destroy(world, null);
    if (this.homing) this.homing(this, dt, world);

    const px = this.x;
    const py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (world.dungeon.isSolidAt(this.x, this.y)) {
      if (this.bounces > 0) {
        this.bounce(world, px, py);
      } else {
        return this.destroy(world, null);
      }
    }

    if (this.trail && Math.random() < 0.6) {
      world.effects.burst(this.x, this.y, { count: 1, colors: this.trail, speed: [5, 20], life: [0.15, 0.35], size: [2, 3] });
    }

    if (this.friendly) this.hitEnemies(world);
    else this.hitPlayer(world);
  }

  bounce(world, px, py) {
    const solidX = world.dungeon.isSolidAt(this.x, py);
    const solidY = world.dungeon.isSolidAt(px, this.y);
    if (solidX) this.vx = -this.vx;
    if (solidY) this.vy = -this.vy;
    if (!solidX && !solidY) { this.vx = -this.vx; this.vy = -this.vy; }
    this.x = px;
    this.y = py;
    this.bounces--;
    Sound.play('bounce', 0.05);
    world.effects.burst(this.x, this.y, { count: 4, colors: ['#ffb02e', '#ff5a1e'], speed: [30, 80], life: [0.15, 0.3] });
  }

  hitEnemies(world) {
    for (const t of world.getTargets()) {
      if (this.hitSet.has(t)) continue;
      if (dist(this.x, this.y, t.hx, t.hy) > this.radius + t.radius) continue;
      this.hitSet.add(t);
      if (this.damage > 0) {
        world.damageTarget(t, this.damage, {
          angle: Math.atan2(this.vy, this.vx), knockback: this.knockback, sound: this.hitSound, fromUlt: this.fromUlt,
        });
      }
      if (this.onStrike) this.onStrike(this, world, t);
      if (this.pierce-- <= 0) return this.destroy(world, t);
    }
  }

  /** Enemy shots hit the hero or a clone, unless a Knight barrier soaks them first. */
  hitPlayer(world) {
    const barrier = world.barrierAt(this.x, this.y, this.radius);
    if (barrier) {
      barrier.absorb(this.damage, world, this.x, this.y);
      return this.destroy(world, null);
    }
    for (const p of world.allies) {
      if (dist(this.x, this.y, p.hx, p.hy) > this.radius + p.radius) continue;
      if (p.hurt(this.damage, world, this.x, this.y, { projectile: true })) return this.destroy(world, p);
    }
  }

  destroy(world, target) {
    if (this.dead) return;
    this.dead = true;
    if (this.onHit) this.onHit(this, world, target);
    else world.effects.burst(this.x, this.y, { count: 5, colors: this.trail || ['#ffffff', '#cccccc'], speed: [30, 90], life: [0.1, 0.3] });
  }

  draw(ctx) {
    if (this.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = this.radius * 3;
      const g = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, r);
      g.addColorStop(0, `rgba(${this.glow}, 0.55)`);
      g.addColorStop(1, `rgba(${this.glow}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
      ctx.restore();
    }
    if (this.sprite) {
      const angle = this.spin ? this.age * this.spin : Math.atan2(this.vy, this.vx);
      drawRotated(ctx, this.sprite, this.x, this.y, this.sprite.width / 2, this.sprite.height / 2, angle);
    }
  }
}
