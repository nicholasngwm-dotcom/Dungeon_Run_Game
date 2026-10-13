// Undead Knight: very slow, very tanky, huge telegraphed greatsword smash.

class UndeadKnight extends Enemy {
  constructor(x, y) {
    super('undeadKnight', x, y);
    this.anchor = KNIGHT_ANCHOR;
    this.hitOffY = 22;
    this.hw = 14;
    this.hh = 8;
    this.barOffset = 66;
    this.attackAngle = 0;
    this.gibColors = ['#4e5468', '#30333f', '#ff3b30'];
  }

  think(dt, world) {
    this.meleeThink(dt, world, () => {
      this.swipeFx(world, '#ff8080');
      world.shake(8, 0.3);
      Sound.play('heavySwing');
      const tipX = this.x + Math.cos(this.attackAngle) * this.cfg.attackReach * 0.8;
      const tipY = this.y + Math.sin(this.attackAngle) * this.cfg.attackReach * 0.8;
      world.effects.burst(tipX, tipY, { count: 18, colors: ['#6a6080', '#3a354d', '#9a90b0'], speed: [60, 160], life: [0.3, 0.6], size: [3, 5] });
    });
  }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }

  weaponAngle() {
    const f = this.facing;
    if (this.state === 'windup') {
      const t = clamp(this.stateTime / this.cfg.windup, 0, 1);
      return this.attackAngle - lerp(0.5, 2.0, t) * f;
    }
    if (this.state === 'recover') return this.attackAngle + 0.9 * f;
    return f > 0 ? 0.7 : Math.PI - 0.7;
  }

  draw(ctx) {
    const w = Sprites.weapons.greatsword;
    const a = this.weaponAngle();
    const behind = Math.sin(a) < -0.3;
    const drawWeapon = () => {
      ctx.globalAlpha = this.spawnAlpha;
      drawRotated(ctx, w.img, this.x + 12 * this.facing, this.y - 22, w.pivotX, w.pivotY, a, Math.cos(a) < 0);
      ctx.globalAlpha = 1;
    };
    if (behind) drawWeapon();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (!behind) drawWeapon();
    this.drawHealthBar(ctx);
  }
}
