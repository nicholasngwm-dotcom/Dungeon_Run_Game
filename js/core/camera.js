// Follows a target, clamps to the map and adds screen shake.

class Camera {
  constructor(width, height) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  follow(tx, ty, dt, mapWidth, mapHeight, snap = false) {
    const goalX = clamp(tx - this.width / 2, 0, Math.max(0, mapWidth - this.width));
    const goalY = clamp(ty - this.height / 2, 0, Math.max(0, mapHeight - this.height));
    const t = snap ? 1 : 1 - Math.pow(0.0001, dt);
    this.x = lerp(this.x, goalX, t);
    this.y = lerp(this.y, goalY, t);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.offsetX = vrand(-1, 1) * this.shakeMag;
      this.offsetY = vrand(-1, 1) * this.shakeMag;
    } else {
      this.offsetX = this.offsetY = 0;
    }
  }

  shake(magnitude, duration) {
    if (magnitude >= this.shakeMag || this.shakeTime <= 0) this.shakeMag = magnitude;
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  apply(ctx) {
    ctx.translate(-Math.round(this.x + this.offsetX), -Math.round(this.y + this.offsetY));
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }
}
