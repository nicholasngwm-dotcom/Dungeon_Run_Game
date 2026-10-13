// Skeleton archer: keeps its distance, draws its bow (red aim line),
// locks aim shortly before firing.

class Skeleton extends Enemy {
  constructor(x, y) {
    super('skeleton', x, y);
    this.aim = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = rand(1, 2.5);
    this.gibColors = ['#ebe5d3', '#b5ad96'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    const d = this.distanceTo(p);
    const toPlayer = angleTo(this.x, this.y, p.x, p.y);

    switch (this.state) {
      case 'chase': {
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) { this.strafeTimer = rand(1, 2.5); this.strafeDir *= -1; }
        if (d < c.preferredMin) this.moveAngle(world, toPlayer + Math.PI, this.speed, dt);
        else if (d > c.preferredMax) this.moveAngle(world, toPlayer, this.speed, dt);
        else this.moveAngle(world, toPlayer + (Math.PI / 2) * this.strafeDir, this.speed * 0.6, dt);
        this.faceToward(p.x);
        if (this.attackCooldown <= 0 && d < c.preferredMax + 120) {
          this.setState('windup');
          Sound.play('bowDraw');
        }
        break;
      }
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt) {
          this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
          this.faceToward(p.x);
        }
        if (this.stateTime >= c.windup) this.fire(world);
        break;
      case 'recover':
        if (this.stateTime >= 0.3) {
          this.setState('chase');
          this.attackCooldown = c.cooldown + rand(0, 0.6);
        }
        break;
    }
  }

  fire(world) {
    const c = this.cfg;
    world.enemyProjectiles.push(new Projectile({
      x: this.hx + Math.cos(this.aim) * 14,
      y: this.hy + Math.sin(this.aim) * 14,
      vx: Math.cos(this.aim) * c.arrowSpeed,
      vy: Math.sin(this.aim) * c.arrowSpeed,
      radius: 4, damage: c.damage, life: 3, friendly: false,
      sprite: Sprites.projectiles.enemyArrow, trail: ['#d84a4a'],
    }));
    Sound.play('enemyArrow');
    this.setState('recover');
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const t = this.stateTime / this.cfg.windup;
    const end = this._aimEnd || { x: this.hx, y: this.hy };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, 4, t);
  }

  update(dt, world) {
    super.update(dt, world);
    if (this.state === 'windup') this._aimEnd = world.dungeon.raycast(this.hx, this.hy, this.aim, 700);
  }

  draw(ctx) {
    const bow = Sprites.weapons.boneBow;
    const behind = Math.sin(this.aim) < -0.35;
    const drawBow = () => {
      ctx.globalAlpha = this.spawnAlpha;
      const pull = this.state === 'windup' ? 4 : 10;
      drawRotated(ctx, bow.img, this.hx + Math.cos(this.aim) * pull, this.hy + 2 + Math.sin(this.aim) * pull * 0.7, bow.pivotX, bow.pivotY, this.aim);
      ctx.globalAlpha = 1;
    };
    if (behind) drawBow();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (!behind) drawBow();
    this.drawHealthBar(ctx);
  }
}
