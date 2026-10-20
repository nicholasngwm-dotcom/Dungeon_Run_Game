// Slime: hops slowly, telegraphs a body-slam leap (landing circle),
// and splits into smaller slimes when the big one dies.

class Slime extends Enemy {
  constructor(x, y, type = 'slime') {
    super(type, x, y);
    this.small = type === 'slimeSmall';
    this.anchor = this.small ? { x: SLIME_SMALL.ax, y: SLIME_SMALL.ay } : { x: SLIME_BIG.ax, y: SLIME_BIG.ay };
    this.hitOffY = this.small ? 6 : 14;
    this.hw = this.small ? 8 : 16;
    this.hh = this.small ? 5 : 8;
    this.barOffset = this.small ? 24 : 44;
    this.hopTime = rand(0, 1);
    this.height = 0;          // visual jump height
    this.gibColors = ['#5fd068', '#36974a', '#b6f5ae'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.height = 0;
    switch (this.state) {
      case 'chase': {
        // short hops toward the player
        this.hopTime += dt;
        const phase = this.hopTime % 1;
        if (phase < 0.4 && !p.dead) {
          this.moveToward(world, p.x, p.y, this.speed * 2, dt);
          this.height = Math.sin((phase / 0.4) * Math.PI) * (this.small ? 4 : 7);
        }
        if (!p.dead && this.distanceTo(p) < c.leapTrigger && this.attackCooldown <= 0) {
          const a = angleTo(this.x, this.y, p.x, p.y);
          const d = Math.min(this.distanceTo(p), c.leapMaxDistance);
          const b = world.dungeon.floorBounds;
          this.leapFrom = { x: this.x, y: this.y };
          this.leapTo = {
            x: clamp(this.x + Math.cos(a) * d, b.left + this.hw + 2, b.right - this.hw - 2),
            y: clamp(this.y + Math.sin(a) * d, b.top + this.hh + 2, b.bottom - this.hh - 2),
          };
          this.faceToward(p.x);
          this.setState('windup');
        }
        break;
      }
      case 'windup':
        if (this.stateTime >= c.windup) {
          this.setState('leap');
          Sound.play('slimeHop');
        }
        break;
      case 'leap': {
        const t = clamp(this.stateTime / c.leapTime, 0, 1);
        this.x = lerp(this.leapFrom.x, this.leapTo.x, t);
        this.y = lerp(this.leapFrom.y, this.leapTo.y, t);
        this.height = Math.sin(t * Math.PI) * (this.small ? 24 : 40);
        if (t >= 1) this.land(world);
        break;
      }
      case 'recover':
        if (this.stateTime >= c.recovery) {
          this.setState('chase');
          this.attackCooldown = c.cooldown;
        }
        break;
    }
  }

  land(world) {
    const c = this.cfg;
    const free = world.dungeon.freePoint(this.x, this.y, this.hw, this.hh); // don't land inside a pillar
    this.x = free.x;
    this.y = free.y;
    for (const a of world.allies) {
      if (dist(a.x, a.y, this.x, this.y) < c.landRadius + a.radius) a.hurt(c.damage, world, this.x, this.y);
    }
    world.effects.burst(this.x, this.y, { count: this.small ? 6 : 14, colors: this.gibColors, speed: [60, 150], life: [0.2, 0.4] });
    if (!this.small) world.shake(3, 0.15);
    Sound.play('slimeLand');
    this.setState('recover');
  }

  // shift the hit centre up while airborne
  get hy() { return this.y - (this.hitOffY + this.height) * CONFIG.enemyDrawScale; }

  onDeath(world) {
    if (!this.cfg.splitCount) return;
    Sound.play('slimeSplit');
    for (let i = 0; i < this.cfg.splitCount; i++) {
      const a = (i / this.cfg.splitCount) * TAU + rand(-0.3, 0.3);
      const s = new Slime(this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10, 'slimeSmall');
      s.knockback(a, 260);
      s.attackCooldown = rand(0.8, 1.4);
      world.addEnemy(s);
    }
  }

  drawTelegraph(ctx) {
    if (this.state === 'windup' || this.state === 'leap') {
      const progress = this.state === 'windup' ? this.stateTime / this.cfg.windup : 1;
      Telegraph.circle(ctx, this.leapTo.x, this.leapTo.y, this.cfg.landRadius, progress);
    }
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.squash[0];
    if (this.height > 2) return this.frames.stretch[0];
    return this.frames.idle[Math.floor(this.animTime * 3) % 2];
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(0, -Math.round(this.height));
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
