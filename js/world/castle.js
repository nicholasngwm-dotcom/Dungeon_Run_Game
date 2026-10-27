// The lobby's castle keep: the party's home between runs. A great hall with the
// dungeon gate in its north wall, and rooms off it through doorways: the armory,
// the library, the workshop and the sleeping quarters, with the big hall of heroes
// through the quarters to the south (every hero busy in a nook of their own, see
// HeroNooks) and the training grounds outside in the castle yard (grass, hedges
// and trees instead of walls).
// Warm materials (wood floors, sandstone walls, windows, tapestries) instead of
// dungeon stone. Same interface as Dungeon (grid, collision, background, torches),
// plus furniture obstacles (see addObstacle) that bodies bump into.

// Room floors in tile coordinates (inclusive). floor: flag | wood | stone | dirt | grass.
const KEEP_ROOMS = {
  hall:     { x0: 14, y0: 5,  x1: 29, y1: 19, floor: 'flag' },
  armory:   { x0: 2,  y0: 5,  x1: 11, y1: 12, floor: 'flag' },
  heroes:   { x0: 4,  y0: 33, x1: 39, y1: 45, floor: 'wood' },
  library:  { x0: 2,  y0: 16, x1: 11, y1: 28, floor: 'wood' },
  workshop: { x0: 32, y0: 5,  x1: 41, y1: 12, floor: 'flag' },
  quarters: { x0: 14, y0: 23, x1: 29, y1: 28, floor: 'wood' },
  // outdoors: the training grounds, and a garden corner beside the workshop
  yard:     { x0: 32, y0: 16, x1: 51, y1: 29, floor: 'grass', outdoor: true },
  garden:   { x0: 43, y0: 5,  x1: 51, y1: 15, floor: 'grass', outdoor: true },
};

// Doorways carved through the walls between rooms: [x0, y0, x1, y1] in tiles.
const KEEP_DOORS = [
  [12, 9, 13, 11],    // armory <-> great hall
  [12, 17, 13, 19],   // library <-> great hall
  [30, 9, 31, 11],    // workshop <-> great hall
  [30, 17, 31, 19],   // great hall <-> the yard (the keep's side door)
  [6, 13, 7, 15],     // armory <-> library
  [36, 13, 37, 15],   // workshop <-> the yard
  [21, 20, 22, 22],   // great hall <-> quarters
  [21, 29, 22, 32],   // quarters <-> hall of heroes
];

const KEEP_COLORS = {
  flag: ['#7a6656', '#806a5a', '#745f50', '#86705e'],
  flagLight: '#9a8470',
  flagDark: '#54443a',
  flagGrout: '#3a2c26',
  wood: ['#6a4428', '#714a2b', '#664026', '#76502e'],
  woodLight: '#8c5e36',
  woodDark: '#3e2716',
  dirt: ['#6e5a40', '#735e43', '#6a563c', '#78624a'],
  wallTop: '#3e3430',
  wallTopL: '#54473f',
  wallRim: '#a8987e',
  brick: '#8a7a66',
  brickAlt: '#7e6e5c',
  brickL: '#a8987e',
  mortar: '#3a2e2a',
  panel: '#5b3922',
  panelL: '#7d532f',
  panelD: '#3b2416',
};

class CastleKeep extends Dungeon {
  constructor() {
    super({ custom: true });
    this.T = CONFIG.tileSize;
    this.cols = 54;
    this.rows = 48;
    this.lobby = true;
    this.pillars = [];
    this.width = this.cols * this.T;
    this.height = this.rows * this.T;
    this.rooms = KEEP_ROOMS;
    this.grid = this.buildGrid();
    this.torches = [];
    this.obstacles = [];     // furniture footprints: { x, y, w, h } in pixels
    const T = this.T;
    this.center = { x: 22 * T, y: 12 * T };
    this.playerStart = { x: 22 * T, y: 17 * T };
    this.background = this.renderBackground();
  }

  buildGrid() {
    const g = Array.from({ length: this.rows }, () => new Array(this.cols).fill(TILE.WALL));
    const carve = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = TILE.FLOOR;
    };
    for (const r of Object.values(KEEP_ROOMS)) carve(r.x0, r.y0, r.x1, r.y1);
    for (const d of KEEP_DOORS) carve(...d);
    return g;
  }

  /** The room a tile belongs to (doorways count as the great hall's flagstones). */
  roomOfTile(tx, ty) {
    for (const [id, r] of Object.entries(KEEP_ROOMS)) {
      if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return id;
    }
    return null;
  }

  get floorBounds() {
    const T = this.T;
    return { left: 2 * T, top: 5 * T, right: 52 * T, bottom: 46 * T };
  }

  /** Wall tiles bordering the yard are hedges and trees rather than castle stone (the hall of heroes' walls below it are stone). */
  isOutdoorWall(tx, ty) {
    if (ty > 30) return false;
    return tx >= 52 || (ty >= 30 && tx >= 32) || (tx >= 43 && ty <= 4);
  }

  // ---------- furniture collision ----------

  /** A solid footprint (furniture base) that heroes bump into. Projectiles fly over furniture. */
  addObstacle(x, y, w, h) {
    this.obstacles.push({ x, y, w, h });
  }

  boxHitsWall(x, y, hw, hh, flying = false) {
    if (super.boxHitsWall(x, y, hw, hh, flying)) return true;
    if (flying) return false;   // fliers pass over furniture
    for (const o of this.obstacles) {
      if (x + hw > o.x && x - hw < o.x + o.w && y + hh > o.y && y - hh < o.y + o.h) return true;
    }
    return false;
  }

  /**
   * Moves an entity, sliding along walls and furniture. Furniture isn't on the
   * tile grid, so instead of snapping to a tile edge (which jolted the hero and
   * the camera) each axis advances as far as it can (binary search). Someone
   * already overlapping something (e.g. just stood up from a seat) can always
   * walk out of it.
   */
  move(e, dx, dy) {
    // fliers (the mage's bird) pass over furniture; only walls stop them
    if (e.flying) return Dungeon.prototype.move.call(this, e, dx, dy);
    let hitX = false;
    let hitY = false;
    const step = (axis, d) => {
      const from = e[axis];
      const stuckBefore = this.boxHitsWall(e.x, e.y, e.hw, e.hh);
      e[axis] = from + d;
      if (!this.boxHitsWall(e.x, e.y, e.hw, e.hh)) return false;
      // overlapping furniture already: free to move off it, but never into a wall
      if (stuckBefore && !Dungeon.prototype.boxHitsWall.call(this, e.x, e.y, e.hw, e.hh)) return false;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        e[axis] = from + d * mid;
        if (this.boxHitsWall(e.x, e.y, e.hw, e.hh)) hi = mid;
        else lo = mid;
      }
      e[axis] = from + d * lo;
      return true;
    };
    if (dx !== 0) hitX = step('x', dx);
    if (dy !== 0) hitY = step('y', dy);
    return { hitX, hitY };
  }

  // ---------- rendering ----------

  renderBackground() {
    const T = this.T;
    const p = new PixelArt(this.width, this.height);
    const rng = seededRandom(4242);
    const floorAt = (tx, ty) => this.tileAt(tx, ty) === TILE.FLOOR;
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * T;
        const y = ty * T;
        if (floorAt(tx, ty)) {
          const room = this.roomOfTile(tx, ty);
          const kind = room ? KEEP_ROOMS[room].floor : 'flag';
          if (kind === 'wood') Castle.wood(p, x, y, rng);
          else if (kind === 'dirt') Castle.dirt(p, x, y, rng);
          else if (kind === 'grass') Castle.grass(p, x, y, rng);
          else if (kind === 'stone') Tiles.floor(p, x, y, rng);
          else Castle.flag(p, x, y, rng);
          continue;
        }
        if (this.isOutdoorWall(tx, ty)) {
          Castle.hedge(p, x, y, rng, floorAt(tx, ty + 1));
          continue;
        }
        // walls: a face where floor lies one or two tiles below, a flat top otherwise
        const below1 = floorAt(tx, ty + 1);
        const below2 = !below1 && floorAt(tx, ty + 2);
        if (below1 || below2) {
          // rooms with wooden floors get wood panelling along the bottom of the wall
          const room = this.roomOfTile(tx, ty + (below1 ? 1 : 2));
          Castle.wallFace(p, x, y, below1 ? 1 : 0, rng, room && KEEP_ROOMS[room].floor === 'wood');
        } else {
          Castle.wallTop(p, x, y, rng, { left: floorAt(tx - 1, ty), right: floorAt(tx + 1, ty) });
        }
      }
    }
    // shadows under every wall
    for (let ty = 1; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (!floorAt(tx, ty) || floorAt(tx, ty - 1)) continue;
        p.ctx.fillStyle = 'rgba(16, 8, 6, 0.42)';
        p.ctx.fillRect(tx * T, ty * T, T, 8);
        p.ctx.fillStyle = 'rgba(16, 8, 6, 0.2)';
        p.ctx.fillRect(tx * T, ty * T + 8, T, 6);
      }
    }
    this.drawDoorFrames(p);
    this.drawRugs(p);
    this.drawWallDressing(p);
    return p.canvas;
  }

  /** Wooden lintels over the doorways in the north-south walls, and thresholds on the floor. */
  drawDoorFrames(p) {
    const T = this.T;
    for (const [x0, y0, x1, y1] of KEEP_DOORS) {
      const horizontal = y1 - y0 >= 2 && x1 - x0 <= 1 && this.tileAt(x0, y0 - 1) !== TILE.FLOOR;
      if (horizontal) {
        // a doorway through a north/south wall: dark posts either side of the opening
        const left = x0 * T;
        const right = (x1 + 1) * T;
        p.rect(left - 4, y0 * T, 4, (y1 - y0 + 1) * T, KEEP_COLORS.panelD);
        p.rect(right, y0 * T, 4, (y1 - y0 + 1) * T, KEEP_COLORS.panelD);
        p.rect(left - 3, y0 * T, 1, (y1 - y0 + 1) * T, KEEP_COLORS.panelL);
      }
      // a worn stone threshold across the doorway
      const w = (x1 - x0 + 1) * T;
      const h = (y1 - y0 + 1) * T;
      p.ctx.fillStyle = 'rgba(40, 30, 26, 0.25)';
      p.ctx.fillRect(x0 * T, y0 * T, w, h);
    }
  }

  /**
   * Baked rugs: the red runner from the gate through the quarters into the hall of
   * heroes, the long purple one in the pet room (the old armory), the library's blue carpet.
   */
  drawRugs(p) {
    const T = this.T;
    // runner down the great hall, through the quarters and into the hall of heroes
    Castle.rug(p, 21 * T + 4, 5 * T, 2 * T - 8, 36 * T, ['#3e0f16', '#7c1f2a', '#dcb44c', '#a63036'], { runner: true });
    Castle.rug(p, 2.6 * T, 8.9 * T, 8.8 * T, 2.6 * T, ['#1e1430', '#4a2a6a', '#d4ac4c', '#6a3a8a']);   // under the pet keeper's board, clear of the pets' spots
    Castle.rug(p, 3.2 * T, 20.2 * T, 6.2 * T, 5.4 * T, ['#141a30', '#22305a', '#a07a24', '#2a3a6a']);
    // a rug in each hero's colours under their nook in the hall of heroes (north row: against the
    // wall; south row: reaching down towards the south wall)
    for (const n of Object.values(HERO_NOOKS)) {
      const [hx, hy] = n.at;
      const north = hy < 40;
      const left = hx - 2.5;
      const right = hx + (n.rugTo ?? 2.5);
      const top = north ? hy - 1.3 : hy - 0.8;
      const bottom = north ? hy + 1.0 : hy + 2.7;
      Castle.rug(p, left * T, top * T, (right - left) * T, (bottom - top) * T, n.rug);
    }
  }

  /**
   * The training grounds look well used: dirt paths worn into the grass from the
   * keep's doors, bare earth where heroes spar, a chalked duelling ring, scorch
   * marks from spells, frost patches, and stray arrows stuck in the turf.
   */
  drawYardWear(p) {
    const T = this.T;
    const rng = seededRandom(777);
    const ctx = p.ctx;
    const patch = (cx, cy, rx, ry, col) => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const r = 0.65 + rng() * 0.35;
        p.ellipse(Math.round(cx + Math.cos(a) * rx * 0.35), Math.round(cy + Math.sin(a) * ry * 0.35), Math.round(rx * r * 0.7), Math.round(ry * r * 0.7), col);
      }
    };
    // worn paths: from the side door and from the workshop door, meeting in the middle
    const path = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const n = Math.ceil((dist(x0, y0, x1, y1) * T) / 8);
        for (let k = 0; k <= n; k++) {
          const x = lerp(x0, x1, k / n) * T + (rng() - 0.5) * 8;
          const y = lerp(y0, y1, k / n) * T + (rng() - 0.5) * 6;
          p.ellipse(Math.round(x), Math.round(y), 13, 7, '#6e5a40');
          if (rng() < 0.3) p.rect(Math.round(x + (rng() - 0.5) * 16), Math.round(y), 3, 2, '#8a8478');
        }
      }
    };
    path([[32, 18.5], [37, 19.5], [41, 21]]);
    path([[36.5, 16], [37, 19.5]]);
    path([[41, 21], [45, 21.5], [48, 21]]);
    // bare, trampled earth in the sparring pit and under the targets
    patch(36.5 * T, 24.8 * T, 120, 56, '#6a563c');
    patch(49.6 * T, 21.5 * T, 40, 90, '#6e5a40');
    // chalked duelling ring in the sparring pit
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 230, 214, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(36.5 * T, 24.8 * T, 88, 40, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // the shooting line facing the targets
    for (let y = 17.3 * T; y < 26 * T; y += 14) p.rect(Math.round(45 * T), Math.round(y), 3, 8, '#e8e0cc');
    // scorch marks and frost from spell practice
    for (const [x, y, r] of [[43.5, 26.6, 22], [45.6, 27.6, 16], [41.6, 28.4, 14]]) {
      patch(x * T, y * T, r, r * 0.55, '#2a2220');
      patch(x * T, y * T, r * 0.55, r * 0.3, '#1a1412');
    }
    for (const [x, y] of [[47.6, 27.1]]) {
      patch(x * T, y * T, 26, 13, '#9ab8d0');
      patch(x * T, y * T, 14, 7, '#cfe4f4');
    }
    // stray arrows stuck in the turf near the targets (the ones that missed)
    for (let i = 0; i < 14; i++) {
      const x = (47.5 + rng() * 4) * T;
      const y = (16.6 + rng() * 9.5) * T;
      p.line(Math.round(x), Math.round(y), Math.round(x - 4), Math.round(y - 9), '#8c5e36');
      p.rect(Math.round(x - 6), Math.round(y - 12), 3, 3, '#efe6d2');
      p.px(Math.round(x), Math.round(y), '#3a2a20');
    }
    // footprints scuffed across the sparring pit
    for (let i = 0; i < 26; i++) {
      const x = (33.6 + rng() * 6) * T;
      const y = (22.8 + rng() * 4) * T;
      p.rect(Math.round(x), Math.round(y), 3, 2, '#5a4632');
    }
  }

  /** Windows, tapestries, sconces and shields on the north walls. */
  drawWallDressing(p) {
    const T = this.T;
    // tall arched windows in the outer north wall, moonlight falling through
    this.windows = [];
    for (const tx of [3.5, 10, 16, 27.5, 33.5, 39.5]) {
      Castle.window(p, tx * T, 3 * T + 4, true);
      this.windows.push({ x: tx * T, top: 3 * T + 4, tall: true });
    }
    // smaller windows into the quarters
    for (const tx of [14.7, 28]) {
      Castle.window(p, tx * T, 21 * T + 4, false);
      this.windows.push({ x: tx * T, top: 21 * T + 4, tall: false });
    }
    // tapestries in the great hall flanking the gate
    for (const tx of [18.5, 25]) Castle.tapestry(p, tx * T, 3 * T + 2, tx < 22 ? ['#5a1a22', '#87262a', '#d4ac4c'] : ['#1e2c4e', '#2c4270', '#d4ac4c']);
    // the hall of heroes: each north-row hero's colours hung above their nook
    for (const n of Object.values(HERO_NOOKS)) if (n.tapestry) Castle.tapestry(p, n.at[0] * T, 31 * T + 2, n.tapestry);
    this.drawYardWear(p);
    // wall sconces (their flames and glow are drawn live by drawTorches)
    const sconces = [[5.1, 3], [8.4, 3], [14.8, 3], [20.6, 3], [23.4, 3], [29.2, 3], [36.5, 3], [41.4, 3],
      [3.6, 14], [10.4, 14], [33.6, 14], [40.4, 14],
      [19.4, 21], [23.9, 21], [27.1, 21],
      [5.6, 31], [11.2, 31], [16.1, 31], [26.2, 31], [32.2, 31], [38.4, 31]];
    for (const [tx, ty] of sconces) {
      Tiles.torchBracket(p, tx * T - 16, ty * T);
      this.torches.push({ x: tx * T, y: ty * T + 8, seed: (tx * 7.3 + ty) % 10 });
    }
  }
}

/** Painters for the keep's warm materials (32x32 tiles, seeded). */
const Castle = {
  /** Warm flagstones: big irregular slabs, worn smooth. */
  flag(p, x, y, rng) {
    const C = KEEP_COLORS;
    p.rect(x, y, 32, 32, C.flagGrout);
    const slabs = rng() < 0.5 ? [[0, 0, 15, 15], [16, 0, 16, 15], [0, 16, 20, 16], [21, 16, 11, 16]]
      : [[0, 0, 20, 15], [21, 0, 11, 15], [0, 16, 15, 16], [16, 16, 16, 16]];
    for (const [sx, sy, w, h] of slabs) {
      const col = C.flag[Math.floor(rng() * C.flag.length)];
      p.round(x + sx, y + sy, w - 1, h - 1, col, 2);
      p.rect(x + sx + 2, y + sy, w - 5, 1, C.flagLight);
      p.rect(x + sx + 2, y + sy + h - 2, w - 5, 1, C.flagDark);
      if (rng() < 0.3) p.rect(x + sx + 3, y + sy + 3, 3, 1, C.flagLight);
    }
  },

  /** Wooden floorboards running left to right, with staggered seams and nail heads. */
  wood(p, x, y, rng) {
    const C = KEEP_COLORS;
    for (let row = 0; row < 4; row++) {
      const by = y + row * 8;
      p.rect(x, by, 32, 8, C.wood[Math.floor(rng() * C.wood.length)]);
      p.rect(x, by, 32, 1, C.woodLight);
      p.rect(x, by + 7, 32, 1, C.woodDark);
      // a seam where one board ends and the next begins
      const seam = x + ((row * 13 + Math.floor(rng() * 6)) % 28) + 2;
      p.rect(seam, by + 1, 1, 6, C.woodDark);
      p.px(seam - 2, by + 3, C.woodDark);
      p.px(seam + 2, by + 3, C.woodDark);
      if (rng() < 0.35) p.rect(x + Math.floor(rng() * 24) + 2, by + 3, 5, 1, C.woodDark);   // grain
    }
  },

  /** Packed earth with pebbles and stray straw (the training yard). */
  dirt(p, x, y, rng) {
    const C = KEEP_COLORS;
    p.rect(x, y, 32, 32, C.dirt[Math.floor(rng() * C.dirt.length)]);
    for (let i = 0; i < 9; i++) p.rect(x + Math.floor(rng() * 30), y + Math.floor(rng() * 30), 2, 1, rng() < 0.5 ? '#5e4c36' : '#86704f');
    if (rng() < 0.4) p.rect(x + 4 + Math.floor(rng() * 20), y + 4 + Math.floor(rng() * 22), 3, 2, '#8a8478');   // pebble
    if (rng() < 0.3) {
      const sx = x + 3 + Math.floor(rng() * 22);
      const sy = y + 3 + Math.floor(rng() * 24);
      p.line(sx, sy, sx + 5, sy + 2, '#c8a85a');                                                   // straw
    }
  },

  /** Lush castle-yard grass: blades, clover and the odd daisy. */
  grass(p, x, y, rng) {
    const greens = ['#4a6e32', '#4e7434', '#466a30', '#527836'];
    p.rect(x, y, 32, 32, greens[Math.floor(rng() * greens.length)]);
    for (let i = 0; i < 10; i++) {
      const gx = x + Math.floor(rng() * 30);
      const gy = y + Math.floor(rng() * 30);
      p.rect(gx, gy, 1, 2, rng() < 0.5 ? '#6a8e44' : '#3a5a28');
    }
    for (let i = 0; i < 2; i++) {
      if (rng() < 0.4) continue;
      const gx = x + 3 + Math.floor(rng() * 25);
      const gy = y + 4 + Math.floor(rng() * 24);
      p.rect(gx, gy + 2, 4, 1, '#3a5a28');
      p.px(gx, gy + 1, '#6a8e44'); p.px(gx + 1, gy, '#86aa58'); p.px(gx + 3, gy + 1, '#6a8e44');
    }
    if (rng() < 0.07) { const fx = x + 4 + Math.floor(rng() * 22); const fy = y + 4 + Math.floor(rng() * 22); p.px(fx, fy, '#f4f0e8'); p.px(fx + 1, fy, '#f4f0e8'); p.px(fx, fy + 1, '#f4f0e8'); p.px(fx + 1, fy + 1, '#ffd34a'); }
  },

  /** The yard's edge: a dense hedge with trees behind it. front = the hedge's face (floor below). */
  hedge(p, x, y, rng, front) {
    const G = ['#1a2e16', '#24401e', '#2e5226', '#3e6a30', '#527e3c'];
    p.rect(x, y, 32, 32, G[1]);
    // round leafy clumps, lit from the top-left
    for (let i = 0; i < 6; i++) {
      const cx = x + 4 + Math.floor(rng() * 24);
      const cy = y + 4 + Math.floor(rng() * 24);
      const r = 5 + Math.floor(rng() * 4);
      p.circle(cx, cy, r, G[2]);
      p.circle(cx - 1, cy - 1, r - 2, G[3]);
      p.px(cx - 2, cy - 3, G[4]); p.px(cx - 3, cy - 2, G[4]);
    }
    if (front) {
      // the hedge's shaded lower face, roots and a line of shadow on the grass
      p.rect(x, y + 20, 32, 12, G[0]);
      for (let i = 0; i < 4; i++) p.circle(x + 4 + i * 8, y + 20, 4, G[2]);
      p.rect(x, y + 30, 32, 2, '#14200f');
    }
  },

  /** Wall top: dark timber-and-stone cap with lit rims along the floor sides. */
  wallTop(p, x, y, rng, edges) {
    const C = KEEP_COLORS;
    p.rect(x, y, 32, 32, C.wallTop);
    for (let i = 0; i < 3; i++) p.rect(x + Math.floor(rng() * 28), y + Math.floor(rng() * 28), 3, 2, C.wallTopL);
    if (edges.left) p.rect(x, y, 3, 32, C.wallRim);
    if (edges.right) p.rect(x + 29, y, 3, 32, C.wallRim);
  },

  /** Sandstone brick face. row 0 = upper half, 1 = lower half; panelled = wood wainscoting low down. */
  wallFace(p, x, y, row, rng, panelled) {
    const C = KEEP_COLORS;
    p.rect(x, y, 32, 32, C.mortar);
    for (let r = 0; r < 4; r++) {
      const offset = (r + row) % 2 === 0 ? 0 : -8;
      for (let c = -1; c < 3; c++) {
        const bx = x + c * 16 + offset;
        const by = y + r * 8;
        const left = Math.max(bx, x);
        const right = Math.min(bx + 15, x + 32);
        if (right <= left) continue;
        p.rect(left, by, right - left, 7, rng() < 0.3 ? C.brickAlt : C.brick);
        p.rect(left, by, right - left, 1, C.brickL);
      }
    }
    if (row === 0) p.rect(x, y, 32, 3, C.wallRim);
    if (row === 1 && panelled) {
      // wood panelling with a moulded rail along the top
      p.rect(x, y + 12, 32, 20, C.panel);
      p.rect(x, y + 12, 32, 2, C.panelL);
      p.rect(x, y + 14, 32, 1, C.panelD);
      p.rect(x + 3, y + 17, 11, 11, C.panelD);
      p.rect(x + 4, y + 18, 9, 9, C.panel);
      p.rect(x + 18, y + 17, 11, 11, C.panelD);
      p.rect(x + 19, y + 18, 9, 9, C.panel);
      p.rect(x + 4, y + 18, 9, 1, C.panelL);
      p.rect(x + 19, y + 18, 9, 1, C.panelL);
    }
    if (row === 1) p.rect(x, y + 28, 32, 4, C.panelD);   // skirting
  },

  /** Arched window showing the night sky; tall ones throw a patch of moonlight on the floor. */
  window(p, cx, top, tall) {
    const w = 20;
    const h = tall ? 36 : 22;
    const x = Math.round(cx - w / 2);
    // stone frame and arch
    p.rect(x - 3, top + 6, w + 6, h, '#b8a888');
    p.round(x - 3, top, w + 6, 14, '#b8a888', 6);
    // glass: deep blue sky, a few stars, a lighter glow low down
    p.rect(x, top + 6, w, h - 3, '#16203c');
    p.round(x, top + 3, w, 10, '#16203c', 5);
    p.rect(x, top + h - 12, w, 9, '#22305a');
    p.px(x + 4, top + 8, '#e6ecff'); p.px(x + 14, top + 13, '#c8d4ff'); p.px(x + 7, top + 18, '#c8d4ff');
    // leaded mullions
    p.rect(x + w / 2 - 1, top + 3, 2, h, '#3a3040');
    p.rect(x, top + 14, w, 2, '#3a3040');
    // sill
    p.rect(x - 5, top + h + 3, w + 10, 3, '#8a7a66');
    p.rect(x - 5, top + h + 3, w + 10, 1, '#c8b898');
    if (!tall) return;
    // moonlight on the floor below
    p.ctx.fillStyle = 'rgba(150, 170, 255, 0.07)';
    p.ctx.beginPath();
    const fy = top + 64;
    p.ctx.moveTo(x, fy); p.ctx.lineTo(x + w, fy); p.ctx.lineTo(x + w + 26, fy + 70); p.ctx.lineTo(x + 18, fy + 70);
    p.ctx.fill();
  },

  /** Long hanging tapestry with a gold crest. colors = [dark, body, trim]. */
  tapestry(p, cx, top, [dark, body, trim]) {
    const x = Math.round(cx - 12);
    p.rect(x - 3, top, 30, 3, '#5b3922');           // rod
    p.rect(x - 4, top, 2, 3, trim); p.rect(x + 26, top, 2, 3, trim);
    p.rect(x, top + 3, 24, 44, body);
    p.rect(x, top + 3, 3, 44, dark);
    p.rect(x, top + 6, 24, 2, trim);
    p.rect(x, top + 41, 24, 2, trim);
    for (let i = 0; i < 4; i++) p.rect(x + i * 6 + 1, top + 47, 4, 4, body);   // tasselled hem
    // crest: a crown over a cross
    p.rect(x + 11, top + 18, 2, 18, trim);
    p.rect(x + 6, top + 23, 12, 2, trim);
    p.rect(x + 7, top + 12, 10, 3, trim);
    p.px(x + 7, top + 11, trim); p.px(x + 11, top + 10, trim); p.px(x + 16, top + 11, trim);
  },


  /**
   * Rectangular rug: dark edge, gold border, body, and a band of diamonds (or,
   * for a runner, a row of medallions down its length). colors = [edge, body, trim, pattern].
   */
  rug(p, x, y, w, h, [edge, body, trim, pattern], { runner = false } = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    p.rect(x, y, w, h, edge);
    p.rect(x + 3, y + 3, w - 6, h - 6, trim);
    p.rect(x + 5, y + 5, w - 10, h - 10, body);
    if (runner) {
      for (let yy = y + 16; yy < y + h - 12; yy += 28) {
        p.rect(x + w / 2 - 5, yy, 10, 10, trim);
        p.rect(x + w / 2 - 3, yy + 2, 6, 6, pattern);
      }
      return;
    }
    p.rect(x + 10, y + 10, w - 20, h - 20, pattern);
    p.rect(x + 12, y + 12, w - 24, h - 24, body);
    const n = Math.max(2, Math.floor((w - 40) / 26));
    for (let i = 0; i <= n; i++) {
      const dx = x + 20 + (i * (w - 40)) / n;
      const dy = y + h / 2;
      p.poly([[dx, dy - 6], [dx + 6, dy], [dx, dy + 6], [dx - 6, dy]], trim);
    }
    // fringe along the short ends
    for (let ty = y + 4; ty < y + h - 3; ty += 5) { p.rect(x - 3, ty, 3, 2, trim); p.rect(x + w, ty, 3, 2, trim); }
  },
};
