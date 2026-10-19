// Tiny toolkit for drawing pixel art into offscreen canvases.
// Sprites are "painted" with rects/ellipses/polygons, then given a dark
// outline by the outline() pass (optionally tinted by the colour it borders).

const OUTLINE = '#1a1020';

class PixelArt {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  px(x, y, color) { return this.rect(x, y, 1, 1, color); }

  /** Rectangle with the four corner pixels removed. */
  round(x, y, w, h, color, r = 1) {
    for (let i = 0; i < h; i++) {
      const inset = i < r ? r - i : i >= h - r ? i - (h - r) + 1 : 0;
      this.rect(x + inset, y + i, w - inset * 2, 1, color);
    }
    return this;
  }

  /** Filled pixel ellipse centred on (cx, cy). */
  ellipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
      this.rect(cx - half, cy + y, half * 2 + 1, 1, color);
    }
    return this;
  }

  circle(cx, cy, r, color) { return this.ellipse(cx, cy, r, r, color); }

  /** Bresenham line. */
  line(x0, y0, x1, y1, color, thickness = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.rect(x0, y0, thickness, thickness, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** Filled polygon from [x, y] corner points (scanline, even-odd). */
  poly(points, color) {
    const ys = points.map((pt) => pt[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y < maxY; y++) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]);
        const b = Math.round(xs[i + 1]);
        if (b > a) this.rect(a, y, b - a, 1, color);
      }
    }
    return this;
  }

  /** Checkerboard dither over a rect, only on pixels that are already opaque. */
  dither(x, y, w, h, color, phase = 0) {
    const d = this.ctx.getImageData(0, 0, this.width, this.height).data;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const px = x + i;
        const py = y + j;
        if ((px + py + phase) % 2 || px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
        if (d[(py * this.width + px) * 4 + 3] > 40) this.px(px, py, color);
      }
    }
    return this;
  }

  /**
   * Adds a 1px outline around every opaque region. With tint > 0 the outline
   * picks up a darkened version of the colour it borders (selective outline).
   */
  outline(color = OUTLINE, tint = 0) {
    const { width: w, height: h } = this;
    const img = this.ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const [r, g, b] = hexToRgb(color);
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
    const marks = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => solid(nx, ny));
        if (!n.length) continue;
        let cr = r;
        let cg = g;
        let cb = b;
        if (tint === 'soft') {
          // set dressing: a deep, slightly warm shade of the colour it borders
          const avg = [0, 1, 2].map((c) => n.reduce((s, [nx, ny]) => s + d[(ny * w + nx) * 4 + c], 0) / n.length);
          cr = avg[0] * 0.4 + 14;
          cg = avg[1] * 0.34 + 4;
          cb = avg[2] * 0.36 + 10;
        } else if (tint > 0) {
          const avg = [0, 1, 2].map((c) => n.reduce((s, [nx, ny]) => s + d[(ny * w + nx) * 4 + c], 0) / n.length);
          cr = r + (avg[0] * 0.3 - r) * tint;
          cg = g + (avg[1] * 0.3 - g) * tint;
          cb = b + (avg[2] * 0.3 - b) * tint;
        }
        marks.push([y * w + x, cr, cg, cb]);
      }
    }
    for (const [i, cr, cg, cb] of marks) {
      d[i * 4] = cr; d[i * 4 + 1] = cg; d[i * 4 + 2] = cb; d[i * 4 + 3] = 255;
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /**
   * Builds a canvas with a fresh PixelArt, runs draw(p), outlines it.
   * tint: 0-1 = how much the outline picks up the colour it borders,
   * 'soft' = a warm dark shade of that colour (used for set-dressing props).
   */
  static make(width, height, draw, outlineColor = OUTLINE, tint = 0) {
    const p = new PixelArt(width, height);
    draw(p);
    if (outlineColor) p.outline(outlineColor, tint);
    return p.canvas;
  }

  /** White silhouette of a sprite, used for hit flashes. */
  static silhouette(source, color = '#ffffff') {
    const c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Draws a sprite canvas anchored at (x, y) = anchor point inside the sprite.
 * flip mirrors horizontally around the anchor.
 */
function drawSprite(ctx, img, x, y, anchorX, anchorY, flip = false, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -anchorX, -anchorY);
  ctx.restore();
}

/** Draws a sprite rotated around a pivot point inside the sprite. */
function drawRotated(ctx, img, x, y, pivotX, pivotY, angle, flipY = false) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  if (flipY) ctx.scale(1, -1);
  ctx.drawImage(img, -pivotX, -pivotY);
  ctx.restore();
}

/** Soft ground shadow under characters. */
function drawShadow(ctx, x, y, rx, ry = rx * 0.4, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
