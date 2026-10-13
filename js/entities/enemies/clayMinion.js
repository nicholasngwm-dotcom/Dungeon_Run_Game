// Clay Minion: small, weak golem spawn summoned by the Clay Golem.
// Raises its fists (orange ring shows the reach), then smashes the ground,
// sending out a shockwave ring that hurts anything it passes.

class ClayMinion extends Enemy {
  constructor(x, y) {
    super('clayMinion', x, y);
    this.hitOffY = 12;
    this.barOffset = 40;
    this.gibColors = [GOLEM_COLORS.clay, GOLEM_COLORS.clayD, GOLEM_COLORS.clayL];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.setState('windup');
          this.faceToward(p.x);
          Sound.play('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= c.windup) this.smash(world);
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) {
          this.setState('chase');
          this.attackCooldown = c.cooldown;
        }
        break;
    }
  }

  smash(world) {
    const c = this.cfg;
    world.addShockwave(this.x, this.y, { radius: c.waveRadius, speed: c.waveSpeed, width: c.waveWidth, damage: c.damage });
    world.effects.burst(this.x, this.y, { count: 12, colors: ['#6a6080', '#3a354d', GOLEM_COLORS.clayD], speed: [60, 160], life: [0.2, 0.5], size: [2, 4] });
    world.shake(2, 0.12);
    Sound.play('stomp', 0.1);
    this.setState('recover');
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    Telegraph.circle(ctx, this.x, this.y, this.cfg.waveRadius, this.stateTime / this.cfg.windup, Telegraph.orange);
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.smash[0];
    return super.currentFrame();
  }
}
