// Pixel-art effects for the heroes' attacks and skills. Everything is drawn
// as square chunks (k px) snapped to a grid, so slashes, beams, rings and
// glows match the sprites instead of being smooth canvas arcs and gradients.
// Colour lists run from the outer edge to the core. Callers choose the
// blend mode (e.g. 'lighter' for light and magic).

const PFX = {
  snap(v, k) { return Math.round(v / k) * k; },

  /** Filled ellipse built from k-px rows. */
  disc(ctx, x, y, rx, ry, color, k = 2) {
    if (rx <= 0 || ry <= 0) return;
    ctx.fillStyle = color;
    const cx = PFX.snap(x, k);
    const cy = PFX.snap(y, k);
    const rows = Math.ceil(ry / k);
    for (let j = -rows; j <= rows; j++) {
      const dy = j * k;
      const half = PFX.snap(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))), k);
      if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2, k);
    }
  },

  /**
   * Ring of chunks around an ellipse. dash = [on, off] in chunks, spin
   * (radians) turns the ring, thick = chunks inward.
   */
  ring(ctx, x, y, rx, ry, color, k = 2, { dash = null, spin = 0, thick = 1, from = 0, to = TAU } = {}) {
    if (rx <= 0) return;
    ctx.fillStyle = color;
    const n = Math.max(12, Math.round((TAU * Math.max(rx, ry)) / k));
    const span = to - from;
    const count = Math.max(1, Math.round((n * Math.abs(span)) / TAU));
    for (let i = 0; i <= count; i++) {
      if (dash && i % (dash[0] + dash[1]) >= dash[0]) continue;
      const a = from + (span * i) / count + spin;
      for (let t = 0; t < thick; t++) {
        const s = 1 - (t * k) / rx;
        ctx.fillRect(PFX.snap(x + Math.cos(a) * rx * s, k), PFX.snap(y + Math.sin(a) * ry * s, k), k, k);
      }
    }
  },

  /**
   * Crescent slash around (x, y) at radius r, sweeping from angle a0 to a1:
   * thin tail, thick middle, sharp leading tip.
   */
  slash(ctx, x, y, r, a0, a1, width, colors, k = 2) {
    const steps = Math.max(6, Math.ceil((Math.abs(a1 - a0) * r) / k));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = a0 + (a1 - a0) * u;
      const w = width * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.08));
      const layers = Math.max(1, Math.round(w / k));
      for (let j = 0; j < layers; j++) {
        const rr = r + w / 2 - j * k;
        ctx.fillStyle = colors[Math.min(colors.length - 1, Math.floor((j / layers) * colors.length))];
        ctx.fillRect(PFX.snap(x + Math.cos(a) * rr, k), PFX.snap(y + Math.sin(a) * rr, k), k, k);
      }
    }
  },

  /** Straight streak from (x, y) along `angle`, banded across its width, with an optional pointed tip. */
  beam(ctx, x, y, angle, length, width, colors, k = 2, tip = true) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const half = width / 2;
    for (let s = 0; s <= length; s += k) {
      const hw = tip ? half * Math.min(1, (length - s) / Math.max(width * 0.8, k)) : half;
      for (let o = -hw; o <= hw + 0.01; o += k) {
        const band = hw > 0 ? Math.abs(o) / hw : 0;
        ctx.fillStyle = colors[Math.min(colors.length - 1, Math.floor((1 - band) * colors.length))];
        ctx.fillRect(PFX.snap(x + cos * s - sin * o, k), PFX.snap(y + sin * s + cos * o, k), k, k);
      }
    }
  },

  /** Stepped glow: stacked translucent discs, brightest in the middle. rgb = 'r, g, b'. */
  glow(ctx, x, y, r, rgb, alpha = 1, k = 2, ry = r) {
    for (let i = 4; i >= 1; i--) {
      PFX.disc(ctx, x, y, (r * i) / 4, (ry * i) / 4, `rgba(${rgb}, ${(alpha * 0.2).toFixed(3)})`, k);
    }
  },

  /** 4-point sparkle with arms `size` chunks long. */
  star(ctx, x, y, size, color, core = '#ffffff', k = 1) {
    const cx = PFX.snap(x, k);
    const cy = PFX.snap(y, k);
    ctx.fillStyle = color;
    for (let i = 1; i <= size; i++) {
      ctx.fillRect(cx - i * k, cy, k, k);
      ctx.fillRect(cx + i * k, cy, k, k);
      ctx.fillRect(cx, cy - i * k, k, k);
      ctx.fillRect(cx, cy + i * k, k, k);
    }
    ctx.fillStyle = core;
    ctx.fillRect(cx, cy, k, k);
  },

  /** Chunky line; dash = [on, off] in chunks, offset scrolls the dashes. */
  line(ctx, x1, y1, x2, y2, color, k = 2, dash = null, offset = 0) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / k));
    const period = dash ? dash[0] + dash[1] : 0;
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) {
      if (dash && (((i + Math.floor(offset)) % period) + period) % period >= dash[0]) continue;
      const t = i / n;
      ctx.fillRect(PFX.snap(x1 + (x2 - x1) * t, k), PFX.snap(y1 + (y2 - y1) * t, k), k, k);
    }
  },

  /** Chunky polyline through [[x, y], ...]. */
  path(ctx, pts, color, k = 2) {
    for (let i = 1; i < pts.length; i++) PFX.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], color, k);
  },

  /**
   * Ground zone for a hero skill preview: faint fill, fill growing with
   * progress (0..1), dashed rim turning slowly. sy squashes it for floor
   * perspective (1 = round, matching circular hit areas).
   */
  zone(ctx, x, y, r, progress, rgb, { sy = 1, k = 2, spin = 0, alpha = 1 } = {}) {
    PFX.disc(ctx, x, y, r, r * sy, `rgba(${rgb}, ${0.12 * alpha})`, k);
    const p = clamp(progress, 0, 1);
    if (p > 0) PFX.disc(ctx, x, y, r * p, r * sy * p, `rgba(${rgb}, ${0.22 * alpha})`, k);
    PFX.ring(ctx, x, y, r, r * sy, `rgba(${rgb}, ${0.85 * alpha})`, k, { dash: [3, 2], spin });
  },

  /** Ground lane for a dash or strike preview, filling with progress (0..1). */
  lane(ctx, x1, y1, x2, y2, width, progress, rgb, k = 2) {
    const a = angleTo(x1, y1, x2, y2);
    const len = dist(x1, y1, x2, y2);
    PFX.beam(ctx, x1, y1, a, len, width, [`rgba(${rgb}, 0.12)`], k * 2, false);
    const p = clamp(progress, 0, 1);
    if (p > 0) PFX.beam(ctx, x1, y1, a, len * p, width, [`rgba(${rgb}, 0.2)`], k * 2, false);
    const ox = -Math.sin(a) * (width / 2);
    const oy = Math.cos(a) * (width / 2);
    for (const s of [1, -1]) PFX.line(ctx, x1 + ox * s, y1 + oy * s, x2 + ox * s, y2 + oy * s, `rgba(${rgb}, 0.8)`, k, [3, 2]);
    PFX.line(ctx, x2 + ox, y2 + oy, x2 - ox, y2 - oy, `rgba(${rgb}, 0.8)`, k);
  },
};
