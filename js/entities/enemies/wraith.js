// Wraith: fast floating spirit. Telegraphs a straight dash (red lane),
// then streaks through it. Fades away instead of dying in a heap.

class Wraith extends Enemy {
  constructor(x, y) {
    super('wraith', x, y);
    this.dashAngle = 0;
    this.dashHit = false;
    this.gibColors = ['#86f8ff', '#6c5aab'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.dashTrigger && this.attackCooldown <= 0) {
          this.setState('windup');
          Sound.play('wraithShriek');
        }
        break;
      case 'windup':
        // tracks the player for the first half, then locks in
        if (this.stateTime < c.windup * 0.5) {
          this.dashAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
        }
        if (this.stateTime >= c.windup) {
          this.setState('dash');
          this.dashHit = false;
        }
        break;
      case 'dash': {
        const speed = c.dashDistance / c.dashTime;
        this.moveAngle(world, this.dashAngle, speed, dt);
        this.dashHits = this.dashHits || new Set();
        if (this.stateTime <= dt) this.dashHits.clear();
        for (const a of world.allies) {
          if (this.dashHits.has(a) || dist(this.hx, this.hy, a.hx, a.hy) >= this.radius + a.radius + 6) continue;
          if (a.hurt(c.damage, world, this.x, this.y)) this.dashHits.add(a);
        }
        if (Math.random() < 0.8) {
          world.effects.burst(this.hx, this.hy, { count: 1, colors: ['#4a3a7a', '#86f8ff'], speed: [5, 20], life: [0.2, 0.4], size: [3, 5] });
        }
        if (this.stateTime >= c.dashTime) this.setState('recover');
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

  die(world) {
    this.dead = true;
    Sound.play('wraithDie');
    world.maybeDropHeart(this.x, this.y);
    // dissolve upward instead of bursting
    const frame = this.currentFrame();
    const { x, y, facing } = this;
    world.effects.add(0.7, (ctx, t) => {
      drawSprite(ctx, frame.flash, x, y - t * 30, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, facing < 0, 0.7 * (1 - t));
    });
    world.effects.burst(this.hx, this.hy, { count: 14, colors: this.gibColors, speed: [20, 70], life: [0.4, 0.8], up: 50 });
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    const ex = this.x + Math.cos(this.dashAngle) * c.dashDistance;
    const ey = this.y + Math.sin(this.dashAngle) * c.dashDistance;
    Telegraph.line(ctx, this.x, this.y, ex, ey, c.dashWidth, this.stateTime / c.windup);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 12, 10, 3, 0.25);
    this.drawTelegraph(ctx);
  }

  draw(ctx) {
    const frame = this.frames.idle[Math.floor(this.animTime * 6) % 4];
    const shake = this.state === 'windup' ? rand(-1.5, 1.5) : 0;
    ctx.save();
    ctx.translate(shake, Math.sin(this.animTime * 3) * 3 - 4);
    this.drawFrame(ctx, frame, this.anchor, 0.88 * this.spawnAlpha);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
