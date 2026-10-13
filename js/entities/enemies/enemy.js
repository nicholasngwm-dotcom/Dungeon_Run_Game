// Base enemy: state machine helpers, damage, death, drawing.
// Subclasses implement think(dt, world) and optionally drawTelegraph(ctx).

class Enemy extends Entity {
  constructor(type, x, y) {
    super(x, y);
    this.type = type;
    this.cfg = CONFIG.enemies[type];
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.speed = this.cfg.speed * rand(0.9, 1.1);
    this.radius = this.cfg.radius;
    this.knockbackResist = this.cfg.knockbackResist || 0;
    this.frames = Sprites.enemies[type];
    this.anchor = ENEMY_ANCHOR;
    this.state = 'chase';
    this.stateTime = 0;
    this.attackCooldown = rand(0.4, 1.2);
    this.moving = false;
    this.age = 0;
    this.gibColors = ['#8a2a2a', '#5a1a1a'];
    this.barOffset = 46;     // health bar height above (x, y)
    this.frozenTime = 0;
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  update(dt, world) {
    this.age += dt;
    this.animTime += dt;
    this.flashTime -= dt;
    this.attackCooldown -= dt;
    this.moving = false;
    this.updateKnockback(dt, world);
    this.frozenTime -= dt;
    if (this.stunTime > 0) {
      this.stunTime -= dt;
      return;
    }
    this.stateTime += dt;
    this.think(dt, world);
  }

  think() {}

  /** Stuns cancel attack windups. Leaps and dashes in flight finish first. */
  stun(duration) {
    if (this.dead || this.state === 'leap' || this.state === 'dash') return;
    this.stunTime = Math.max(this.stunTime || 0, duration * (1 - (this.cfg.stunResist || 0)));
    if (this.state === 'windup') this.setState('chase');
  }

  /** Whatever this enemy is chasing (hero, clone or nobody). */
  target(world) { return world.targetFor(this); }

  distanceTo(p) { return dist(this.x, this.y, p.x, p.y); }

  /** Chases a point, sidestepping around pillars when walking straight gets stuck. */
  moveToward(world, tx, ty, speed, dt) {
    const a = angleTo(this.x, this.y, tx, ty);
    const x0 = this.x;
    const y0 = this.y;
    this.moveAngle(world, a, speed, dt);
    if (dist(x0, y0, this.x, this.y) > speed * dt * 0.5) {
      if (this.detourTime > 0) this.detourTime -= dt;
      else this.detour = 0;
      return;
    }
    // blocked: commit to a side for a moment so we walk around the obstacle
    if (!this.detour) this.detour = Math.random() < 0.5 ? 1 : -1;
    this.detourTime = 0.4;
    const x1 = this.x;
    const y1 = this.y;
    world.dungeon.move(this, Math.cos(a + this.detour * Math.PI / 2) * speed * dt, Math.sin(a + this.detour * Math.PI / 2) * speed * dt);
    if (dist(x1, y1, this.x, this.y) < speed * dt * 0.2) this.detour *= -1; // hit a wall that way, try the other side
  }

  moveAngle(world, a, speed, dt) {
    world.dungeon.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (Math.abs(Math.cos(a)) > 0.1) this.facing = Math.cos(a) >= 0 ? 1 : -1;
    this.moving = true;
  }

  faceToward(x) { this.facing = x >= this.x ? 1 : -1; }

  knockback(angle, force) {
    super.knockback(angle, force * (1 - this.knockbackResist));
  }

  /** Returns true if the damage was applied. */
  takeDamage(amount, world) {
    if (this.dead) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) this.die(world);
    return true;
  }

  die(world) {
    this.dead = true;
    world.effects.burst(this.hx, this.hy, { count: 16, colors: this.gibColors, speed: [60, 180], life: [0.3, 0.7], size: [2, 5] });
    Sound.play('enemyDie');
    world.maybeDropHeart(this.x, this.y, this.cfg.heartChance);
    world.maybeDropMana(this.x, this.y);
    this.onDeath(world);
  }

  onDeath() {}

  // ---------- shared melee behaviour (zombie, knight) ----------
  // chase -> windup (telegraph cone) -> strike -> recover

  meleeThink(dt, world, onStrike) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.setState('windup');
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          Sound.play('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= c.windup) {
          for (const a of world.allies) {
            const d = this.distanceTo(a);
            const inArc = Math.abs(angleDiff(this.attackAngle, angleTo(this.x, this.y, a.x, a.y))) <= (c.attackArcDegrees * DEG) / 2;
            if (d <= c.attackReach + a.radius && (inArc || d < a.radius + this.radius)) {
              a.hurt(c.damage, world, this.x, this.y);
            }
          }
          if (onStrike) onStrike();
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) {
          this.setState('chase');
          this.attackCooldown = c.cooldown;
        }
        break;
    }
  }

  drawMeleeTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.attackArcDegrees * DEG, c.attackReach, this.stateTime / c.windup);
  }

  /** Quick white slash arc shown when a melee attack lands. */
  swipeFx(world, color = '#ffdddd') {
    const { x, y, attackAngle: a } = this;
    const arc = this.cfg.attackArcDegrees * DEG;
    const r = this.cfg.attackReach * 0.8;
    world.effects.add(0.18, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = color;
      ctx.lineWidth = 8 * (1 - t) + 2;
      ctx.beginPath();
      ctx.arc(x, y, r, a - arc / 2, a + arc / 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  // ---------- drawing ----------

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 9, this.radius, this.radius * 0.4);
    this.drawTelegraph(ctx);
  }

  drawTelegraph() {}

  currentFrame() {
    if (this.moving && this.frames.walk) return this.frames.walk[Math.floor(this.animTime * 7) % 4];
    return this.frames.idle[Math.floor(this.animTime * 2) % this.frames.idle.length];
  }

  /** Brief fade-in after spawning. */
  get spawnAlpha() { return clamp(this.age / 0.3, 0, 1); }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    this.drawHealthBar(ctx);
  }

  /** A stun that encases the enemy in ice. */
  freeze(duration) {
    this.stun(duration);
    if (this.stunTime > 0) this.frozenTime = this.stunTime;
  }

  /** Circling stars over stunned enemies (an ice block if frozen). */
  drawStun(ctx) {
    if (!(this.stunTime > 0)) return;
    if (this.frozenTime > 0) {
      const w = this.radius * 2 + 8;
      const h = this.barOffset - 6;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.y + 6 - h);
      ctx.fillStyle = 'rgba(150, 220, 255, 0.35)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(230, 248, 255, 0.55)';
      ctx.fillRect(x + 3, y + 3, 3, h - 10);
      ctx.fillRect(x + 3, y + 3, w / 2, 2);
      ctx.strokeStyle = 'rgba(200, 240, 255, 0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    const y = this.y - this.barOffset - 8;
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 6 + (i * TAU) / 3;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(this.x + Math.cos(a) * 10) - 2, Math.round(y + Math.sin(a) * 3) - 2, 5, 5);
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(Math.round(this.x + Math.cos(a) * 10) - 1, Math.round(y + Math.sin(a) * 3) - 1, 3, 3);
    }
  }

  drawHealthBar(ctx) {
    this.drawStun(ctx);
    if (this.hp >= this.maxHp) return;
    const w = Math.max(20, this.radius * 2);
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - this.barOffset);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#e84a4a';
    ctx.fillRect(x, y, Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 3);
  }
}

/** Factory used by the wave director. */
function createEnemy(type, x, y) {
  const classes = {
    zombie: Zombie, slime: Slime, slimeSmall: Slime, wraith: Wraith, skeleton: Skeleton,
    undeadKnight: UndeadKnight, clayMinion: ClayMinion, gravestone: Gravestone, ghost: Ghost,
  };
  return new classes[type](x, y, type);
}
