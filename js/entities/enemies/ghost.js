// Ghost: rises from broken gravestones. Drifts slowly after the hero with a
// chilling aura that slows anyone inside it. Only hurts by touch.

class Ghost extends Enemy {
  constructor(x, y) {
    super('ghost', x, y);
    this.hitOffY = 20;
    this.barOffset = 54;
    this.gibColors = ['#daf2ff', '#a4d0ec', '#5e88ac'];
    this.auraSpin = rand(0, TAU);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.auraSpin += dt * 0.6;
    if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
    for (const a of world.allies) {
      if (a.chill && dist(a.x, a.y, this.x, this.y) < c.auraRadius) a.chill(c.slowAmount);
    }
    if (Math.random() < dt * 2) Sound.play('ghostWail', 2.5);
  }

  die(world) {
    this.dead = true;
    Sound.play('wraithDie');
    world.maybeDropHeart(this.x, this.y);
    world.maybeDropMana(this.x, this.y);
    const frame = this.currentFrame();
    const { x, y, facing } = this;
    world.effects.add(0.8, (ctx, t) => {
      drawSprite(ctx, frame.flash, x, y - 4 - t * 36, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, facing < 0, 0.6 * (1 - t));
    });
    world.effects.burst(this.hx, this.hy, { count: 14, colors: this.gibColors, speed: [20, 70], life: [0.4, 0.8], up: 50 });
  }

  currentFrame() {
    return this.frames.idle[Math.floor(this.animTime * 5) % 4];
  }

  drawGround(ctx) {
    const r = this.cfg.auraRadius;
    const a = this.spawnAlpha;
    ctx.save();
    // frosty pool
    ctx.fillStyle = `rgba(150, 220, 255, ${0.09 * a})`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r, r * 0.7, 0, 0, TAU);
    ctx.fill();
    // slowly turning rim and drifting motes
    ctx.strokeStyle = `rgba(190, 235, 255, ${0.35 * a})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -this.auraSpin * 30;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r, r * 0.7, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(220, 245, 255, ${0.6 * a})`;
    for (let i = 0; i < 6; i++) {
      const ang = this.auraSpin + (i / 6) * TAU;
      const rr = r * (0.55 + 0.3 * Math.sin(this.auraSpin * 1.7 + i));
      ctx.fillRect(Math.round(this.x + Math.cos(ang) * rr) - 1, Math.round(this.y + Math.sin(ang) * rr * 0.7) - 1, 3, 3);
    }
    ctx.restore();
    drawShadow(ctx, this.x, this.y + 12, 10, 3, 0.2);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(0, Math.sin(this.animTime * 2.4) * 3 - 6);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, 0.8 * this.spawnAlpha);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
