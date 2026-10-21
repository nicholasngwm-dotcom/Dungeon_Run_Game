// Zombie: slow shambler with a telegraphed claw swipe.

class Zombie extends Enemy {
  constructor(x, y) {
    super('zombie', x, y);
    this.gibColors = ['#86a86a', '#5f8250', '#5a1a1a'];
    this.groanTimer = rand(2, 6);
  }

  think(dt, world) {
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = rand(4, 9);
      Sound.play('zombieGroan', 0.5);
    }
    this.meleeThink(dt, world, () => {
      this.swipeFx(world, '150, 200, 110');
      Sound.play('slash');
    });
  }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }
}
