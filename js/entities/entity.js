// Base for anything that walks around the arena.
// (x, y) is the entity's footprint centre; (hx, hy) is the centre of
// its body, used for hit detection.

class Entity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.kbx = 0;           // knockback velocity
    this.kby = 0;
    this.hw = 10;           // wall-collision half extents
    this.hh = 7;
    this.radius = 14;       // hit radius around (hx, hy)
    this.hitOffY = 14;
    this.facing = 1;
    this.flashTime = 0;
    this.animTime = 0;
    this.dead = false;
  }

  get hx() { return this.x; }
  get hy() { return this.y - this.hitOffY; }

  knockback(angle, force) {
    this.kbx += Math.cos(angle) * force;
    this.kby += Math.sin(angle) * force;
  }

  updateKnockback(dt, world) {
    if (Math.abs(this.kbx) + Math.abs(this.kby) < 1) return;
    world.dungeon.move(this, this.kbx * dt, this.kby * dt);
    const decay = Math.min(1, 10 * dt);
    this.kbx -= this.kbx * decay;
    this.kby -= this.kby * decay;
  }

  /** Draws an animation frame, with the white hit-flash on top. */
  drawFrame(ctx, frame, anchor, alpha = 1, flip = this.facing < 0) {
    drawSprite(ctx, frame.img, this.x, this.y, anchor.x, anchor.y, flip, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, this.x, this.y, anchor.x, anchor.y, flip, alpha * 0.85);
  }
}
