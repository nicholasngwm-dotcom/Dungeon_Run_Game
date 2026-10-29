// Follows a target, clamps to the map and adds screen shake.
// Its view is the game space (CONFIG.screen) at the display's world zoom, so a phone
// and a PC each see the world their own size (only drawing reads the camera).

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** How much of the world is in view (whole pixels, so canvases sized from it stay put). */
  get width() { return Math.ceil(CONFIG.screen.width / Display.zoom); }
  get height() { return Math.ceil(CONFIG.screen.height / Display.zoom); }

  /** rate: the share of the way still left after a second (smaller = snappier). */
  follow(tx, ty, dt, mapWidth, mapHeight, snap = false, rate = 0.0001) {
    // a map narrower (or shorter) than the view sits in the middle of it
    const fit = (t, size, map) => (map <= size ? (map - size) / 2 : clamp(t - size / 2, 0, map - size));
    const goalX = fit(tx, this.width, mapWidth);
    const goalY = fit(ty, this.height, mapHeight);
    const t = snap ? 1 : 1 - Math.pow(rate, dt);
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
    ctx.scale(Display.zoom, Display.zoom);
    ctx.translate(-Math.round(this.x + this.offsetX), -Math.round(this.y + this.offsetY));
  }

  screenToWorld(sx, sy) {
    return { x: sx / Display.zoom + this.x, y: sy / Display.zoom + this.y };
  }

  worldToScreen(wx, wy) {
    return { x: (wx - this.x) * Display.zoom, y: (wy - this.y) * Display.zoom };
  }
}
