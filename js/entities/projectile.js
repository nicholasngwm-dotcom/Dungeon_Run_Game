// Generic projectile used by heroes, enemies and the boss.
// Behaviour is configured with options rather than subclasses.

class Projectile {
  /** The hero whose attack this is (set by the game while each hero acts) - damage is credited to them. */
  static actor = null;
  /** Damage scale for enemy shots fired right now (the game lowers it while a weakened enemy acts). */
  static enemyScale = 1;

  constructor(opts) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 5,
      damage: 10,
      life: 2,
      friendly: true,      // true = hurts enemies, false = hurts the player
      pierce: 0,           // extra targets it can pass through
      bounces: 0,          // wall bounces before it breaks
      hitsPosts: false,    // stopped by posts too (furniture, braziers), which shots normally fly over
      knockback: 80,
      sprite: null,
      spin: 0,             // radians/s; 0 = face direction of travel
      glow: null,          // 'r, g, b' for an additive glow
      trail: null,         // particle colours
      homing: null,        // fn(projectile, dt, world)
      onHit: null,         // fn(projectile, world, target?) when it stops
      onStrike: null,      // fn(projectile, world, target) each time it damages a target
      fx: null,            // fn(projectile, dt, world) each step, for extra trail effects (visual only)
      aura: null,          // fn(ctx, projectile) drawn under the sprite (flames, frost...)
      upright: false,      // keep the sprite upright (music notes) instead of turning it to the flight
      scale: 1,            // draw the sprite this much bigger (the hitbox stays `radius`)
      hitSet: null,        // share one with sibling shots so each target is only hit once by the whole volley
      hitSound: 'hit',
      fromUlt: false,      // damage from an ultimate doesn't charge the ultimate
      crit: null,          // true / false: this shot's crit is already decided (null: roll on each hit)
      fire: false,         // a fire attack (Blazeborn makes these hit harder)
      arrow: false,        // an arrow (Razor Sharp Arrows make crit arrows cut)
      owner: Projectile.actor, // hero who fired it (null for enemy shots)
    }, opts);
    if (!this.friendly) this.damage *= Projectile.enemyScale;
    else this.bounces += Upgrades.extraBounces(this.owner);   // Bouncy!
    this.age = 0;
    this.hitSet = this.hitSet || new Set();
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
    if (this.hitsPosts) {
      // a shot fired from over a piece of furniture flies on until it's clear of it; after that, any post stops it
      const inPost = world.dungeon.postAt?.(this.x, this.y, this.radius);
      if (!inPost) this.clearOfPosts = true;
      else if (this.clearOfPosts) return this.destroy(world, null);
    }

    if (this.trail && Math.random() < 0.6) {
      world.effects.burst(this.x, this.y, { count: 1, colors: this.trail, speed: [5, 20], life: [0.15, 0.35], size: [2, 3] });
    }
    if (this.fx) this.fx(this, dt, world);

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
    if (this.friendly && Upgrades.has(this.owner, 'bouncy')) Upgrades.state(this.owner).flash.bouncy = world.time;
    Sound.play('bounce', 0.05);
    world.effects.burst(this.x, this.y, { count: 4, colors: this.trail || ['#ffb02e', '#ff5a1e'], speed: [30, 80], life: [0.15, 0.3] });
  }

  hitEnemies(world) {
    for (const t of world.getTargets()) {
      if (this.hitSet.has(t)) continue;
      if (dist(this.x, this.y, t.hx, t.hy) > this.radius + t.radius) continue;
      this.hitSet.add(t);
      if (this.damage > 0) {
        world.damageTarget(t, this.damage, {
          angle: Math.atan2(this.vy, this.vx), knockback: this.knockback, sound: this.hitSound, fromUlt: this.fromUlt, crit: this.crit,
          fire: this.fire, arrow: this.arrow,
        });
        Upgrades.critPierce(this, world);   // Piercing Crit: a crit carries on through
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
      if (this.friendly) {
        // heroes' shots glow in stepped pixel bands, like the rest of their effects
        PFX.glow(ctx, this.x, this.y, r, this.glow, 0.7);
      } else {
        const g = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, r);
        g.addColorStop(0, `rgba(${this.glow}, 0.55)`);
        g.addColorStop(1, `rgba(${this.glow}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    if (this.aura) this.aura(ctx, this);
    if (this.sprite) {
      const angle = this.upright ? 0 : this.spin ? this.age * this.spin : Math.atan2(this.vy, this.vx);
      if (this.scale === 1) return drawRotated(ctx, this.sprite, this.x, this.y, this.sprite.width / 2, this.sprite.height / 2, angle);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      drawRotated(ctx, this.sprite, 0, 0, this.sprite.width / 2, this.sprite.height / 2, angle);
      ctx.restore();
    }
  }
}
