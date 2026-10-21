// The arena: tile grid, pre-rendered background, wall collision and torches.

// PILLAR = cover cap (top tile), PILLAR_FACE = its brick front. Both are solid.
const TILE = { FLOOR: 0, WALL: 1, FACE: 2, PILLAR: 3, PILLAR_FACE: 4 };

// Top-left tiles of the optional 2x2 cover pillars (off by default: the arena is open).
const PILLARS = [[6, 7], [30, 7], [11, 13], [25, 13], [6, 19], [30, 19]];

class Dungeon {
  /** lobby: the hub room (no ritual circle or bones, a carpet up to the gate). */
  constructor({ cols = 38, rows = 26, pillars = false, lobby = false, custom = false } = {}) {
    if (custom) return; // subclasses (FloorMap) build their own grid and art
    this.cols = cols;
    this.rows = rows;
    this.lobby = lobby;
    this.pillars = pillars ? PILLARS : [];
    this.T = CONFIG.tileSize;
    this.width = cols * this.T;
    this.height = rows * this.T;
    this.grid = this.buildGrid();
    this.torches = [];
    // middle of the floor; the golem stands just below it
    this.center = { x: this.width / 2, y: 13 * this.T };
    this.playerStart = { x: this.width / 2, y: (rows - 3) * this.T };
    this.background = this.renderBackground();
  }

  buildGrid() {
    const g = [];
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        let t = TILE.FLOOR;
        if (y < 2 || y === this.rows - 1 || x === 0 || x === this.cols - 1) t = TILE.WALL;
        else if (y < 4) t = TILE.FACE;
        row.push(t);
      }
      g.push(row);
    }
    for (const [tx, ty] of this.pillars) {
      g[ty][tx] = g[ty][tx + 1] = TILE.PILLAR;
      g[ty + 1][tx] = g[ty + 1][tx + 1] = TILE.PILLAR_FACE;
    }
    return g;
  }

  // ---------- rendering ----------

  renderBackground() {
    const T = this.T;
    const p = new PixelArt(this.width, this.height);
    const rng = seededRandom(1337);

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * T;
        const y = ty * T;
        const t = this.grid[ty][tx];
        const edges = { left: this.tileAt(tx - 1, ty) === TILE.FLOOR, right: this.tileAt(tx + 1, ty) === TILE.FLOOR };
        // the keep's warm sandstone (see Castle): flagstones, brick faces, timber-and-stone wall tops
        if (t === TILE.FLOOR) {
          Castle.flag(p, x, y, rng);
        } else if (t === TILE.PILLAR) {
          Castle.wallTop(p, x, y, rng, edges);
          p.rect(x, y, T, 3, KEEP_COLORS.wallRim);
        } else if (t === TILE.PILLAR_FACE) {
          Castle.wallFace(p, x, y, 1, rng, false);
        } else if (t === TILE.FACE) {
          Castle.wallFace(p, x, y, ty - 2, rng, false);
        } else {
          Castle.wallTop(p, x, y, rng, edges);
          if (this.tileAt(tx, ty + 1) === TILE.FLOOR) p.rect(x, y + T - 3, T, 3, KEEP_COLORS.wallRim);
        }
      }
    }

    // shadow cast by the back wall
    p.ctx.fillStyle = 'rgba(16, 8, 6, 0.45)';
    p.ctx.fillRect(T, 4 * T, this.width - 2 * T, 10);
    p.ctx.fillStyle = 'rgba(16, 8, 6, 0.25)';
    p.ctx.fillRect(T, 4 * T + 10, this.width - 2 * T, 8);

    // wall decorations
    for (let tx = 4; tx < this.cols - 2; tx += 6) {
      if (this.lobby && Math.abs(tx * T + 16 - this.width / 2) < 60) continue; // the gate goes there
      Tiles.torchBracket(p, tx * T, 2 * T);
      this.torches.push({ x: tx * T + 16, y: 2 * T + 8, seed: Math.random() * 10 });
    }
    for (let tx = 7; tx < this.cols - 4; tx += 6) {
      if (Math.abs(tx * T + 16 - this.center.x) < 40) continue;
      Castle.tapestry(p, tx * T + 16, 2 * T + 2, ['#5a1a22', '#87262a', '#d4ac4c']);
    }

    // shadows cast by the pillars
    for (const [tx, ty] of this.pillars) {
      p.ctx.fillStyle = 'rgba(16, 8, 6, 0.4)';
      p.ctx.fillRect(tx * T, (ty + 2) * T, 2 * T, 8);
      p.ctx.fillStyle = 'rgba(16, 8, 6, 0.2)';
      p.ctx.fillRect(tx * T + 2, (ty + 2) * T + 8, 2 * T - 4, 6);
    }

    if (this.lobby) {
      this.drawCarpet(p);
      return p.canvas;
    }
    this.drawRitualCircle(p);

    // floor clutter (kept away from the centre)
    for (let ty = 4; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const x = tx * T;
        const y = ty * T;
        if (this.grid[ty][tx] !== TILE.FLOOR || this.tileAt(tx, ty - 1) === TILE.PILLAR_FACE) continue;
        if (dist(x + 16, y + 16, this.center.x, this.center.y) < 140) continue;
        const r = rng();
        if (r < 0.025) Tiles.bones(p, x, y, rng);
        else if (r < 0.035) Tiles.skull(p, x, y, rng);
      }
    }
    return p.canvas;
  }

  /** Lobby: a red runner from the start up to the gate in the back wall. */
  drawCarpet(p) {
    const T = this.T;
    const x = this.width / 2 - T;
    const top = 4 * T;
    const h = this.height - T - top;
    p.rect(x, top, 2 * T, h, '#50131d');
    p.rect(x + 3, top, 2 * T - 6, h, '#7c1f2a');
    p.rect(x + 6, top, 2, h, '#dcb44c');
    p.rect(x + 2 * T - 8, top, 2, h, '#dcb44c');
    for (let y = top + 12; y < top + h; y += 24) p.rect(this.width / 2 - 3, y, 6, 6, '#a63036');
  }

  drawRitualCircle(p) {
    const { x: cx, y: cy } = this.center;
    // a chalked training circle with brass studs
    const col = '#b8a888';
    const glow = '#8a6a26';
    for (const r of [96, 84]) {
      for (let a = 0; a < TAU; a += 0.012) {
        p.rect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 2, 2, col);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const x = cx + Math.cos(a) * 90;
      const y = cy + Math.sin(a) * 54;
      p.rect(x - 3, y - 3, 6, 6, glow);
      p.rect(x - 1, y - 1, 2, 2, '#ffd34a');
    }
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const a = -Math.PI / 2 + (i * TAU * 2) / 5;
      return [cx + Math.cos(a) * 80, cy + Math.sin(a) * 48];
    });
    for (let i = 0; i < 5; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % 5];
      p.line(x0, y0, x1, y1, col, 2);
    }
  }

  draw(ctx) {
    ctx.drawImage(this.background, 0, 0);
  }

  /** Animated torch flames + warm glow. Drawn after entities. */
  drawTorches(ctx, time) {
    for (const t of this.torches) {
      const f = Math.sin(time * 12 + t.seed) * 0.5 + Math.sin(time * 23 + t.seed * 2) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 70 + f * 6;
      const g = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, r);
      g.addColorStop(0, 'rgba(255, 160, 60, 0.35)');
      g.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(t.x - r, t.y - r, r * 2, r * 2);
      ctx.restore();
      const h = Math.round(9 + f * 2);
      ctx.fillStyle = '#e0461e';
      ctx.fillRect(t.x - 4, t.y - h + 2, 8, h);
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(t.x - 2, t.y - h + 4, 5, h - 3);
      ctx.fillStyle = '#fff2a0';
      ctx.fillRect(t.x - 1, t.y - 2, 2, 3);
    }
  }

  // ---------- collision ----------

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return TILE.WALL;
    if (this.doorBlocks?.has(ty * this.cols + tx)) return TILE.WALL;   // a shut door (see SwingDoors)
    return this.grid[ty][tx];
  }

  isSolidAt(x, y) {
    return this.tileAt(Math.floor(x / this.T), Math.floor(y / this.T)) !== TILE.FLOOR;
  }

  boxHitsWall(x, y, hw, hh) {
    const T = this.T;
    const x0 = Math.floor((x - hw) / T);
    const x1 = Math.floor((x + hw) / T);
    const y0 = Math.floor((y - hh) / T);
    const y1 = Math.floor((y + hh) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) !== TILE.FLOOR) return true;
      }
    }
    return false;
  }

  /** Moves an entity (with hw/hh box) and slides it along walls. */
  move(e, dx, dy) {
    const T = this.T;
    let hitX = false;
    let hitY = false;
    if (dx !== 0) {
      e.x += dx;
      if (this.boxHitsWall(e.x, e.y, e.hw, e.hh)) {
        hitX = true;
        if (dx > 0) e.x = Math.floor((e.x + e.hw) / T) * T - e.hw - 0.01;
        else e.x = (Math.floor((e.x - e.hw) / T) + 1) * T + e.hw + 0.01;
      }
    }
    if (dy !== 0) {
      e.y += dy;
      if (this.boxHitsWall(e.x, e.y, e.hw, e.hh)) {
        hitY = true;
        if (dy > 0) e.y = Math.floor((e.y + e.hh) / T) * T - e.hh - 0.01;
        else e.y = (Math.floor((e.y - e.hh) / T) + 1) * T + e.hh + 0.01;
      }
    }
    return { hitX, hitY };
  }

  /** Walks a ray until it hits a wall; returns the end point. */
  raycast(x, y, angle, maxLength = 1600) {
    const step = 4;
    const cx = Math.cos(angle) * step;
    const cy = Math.sin(angle) * step;
    let d = 0;
    while (d < maxLength && !this.isSolidAt(x, y)) {
      x += cx;
      y += cy;
      d += step;
    }
    return { x, y };
  }

  /** Inner floor rectangle (in pixels). */
  get floorBounds() {
    const T = this.T;
    return { left: T, top: 4 * T, right: this.width - T, bottom: this.height - T };
  }

  /** Random open floor point, clear of walls and pillars by about 20px. */
  randomFloorPoint(margin = 40) {
    const b = this.floorBounds;
    let pt;
    for (let i = 0; i < 30; i++) {
      pt = { x: rand(b.left + margin, b.right - margin), y: rand(b.top + margin, b.bottom - margin) };
      if (!this.boxHitsWall(pt.x, pt.y, 20, 20)) break;
    }
    return pt;
  }

  /** Nearest spot to (x, y) where a hw/hh box doesn't overlap a wall or pillar. */
  freePoint(x, y, hw = 10, hh = 7) {
    if (!this.boxHitsWall(x, y, hw, hh)) return { x, y };
    for (let r = 8; r < 400; r += 8) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (!this.boxHitsWall(px, py, hw, hh)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
}
