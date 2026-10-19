// Dungeon tile painters. Each draws one 32x32 tile at (x, y)
// into a PixelArt surface using a seeded random generator.

const TILE_COLORS = {
  floor: ['#4c4660', '#504963', '#48425a', '#534b66'],
  floorLight: '#625a78',
  floorSheen: '#5a5370',
  floorDark: '#3a344b',
  grout: '#28233a',
  moss: '#4a6844',
  mossLight: '#6a8a58',
  wallTop: '#262033',
  wallTopL: '#3a3150',
  wallRim: '#5a4d78',
  brick: '#5c4f78',
  brickAlt: '#544870',
  brickL: '#77699a',
  mortar: '#2e2640',
  bone: '#d8d0bc',
};

const Tiles = {
  floor(p, x, y, rng) {
    const T = CONFIG.tileSize;
    p.rect(x, y, T, T, TILE_COLORS.grout);
    // four flagstones per tile
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const ox = x + sx * 16;
        const oy = y + sy * 16;
        // soft, rounded flagstone: lit top-left edge, shaded bottom-right, a worn sheen
        const col = TILE_COLORS.floor[Math.floor(rng() * TILE_COLORS.floor.length)];
        p.round(ox, oy, 15, 15, col, 2);
        p.rect(ox + 2, oy, 11, 1, TILE_COLORS.floorLight);
        p.rect(ox, oy + 2, 1, 11, TILE_COLORS.floorLight);
        p.px(ox + 1, oy + 1, TILE_COLORS.floorLight);
        p.rect(ox + 2, oy + 14, 11, 1, TILE_COLORS.floorDark);
        p.rect(ox + 14, oy + 2, 1, 11, TILE_COLORS.floorDark);
        p.px(ox + 13, oy + 13, TILE_COLORS.floorDark);
        if (rng() < 0.5) p.rect(ox + 3, oy + 3, 3, 1, TILE_COLORS.floorSheen);
        if (rng() < 0.15) p.line(ox + 3, oy + 4, ox + 3 + Math.floor(rng() * 8), oy + 10, TILE_COLORS.floorDark);
        if (rng() < 0.08) {
          const mx = ox + 2 + Math.floor(rng() * 9);
          p.rect(mx, oy + 10, 4, 2, TILE_COLORS.moss);
          p.px(mx + 1, oy + 9, TILE_COLORS.mossLight);
          p.px(mx + 3, oy + 9, TILE_COLORS.moss);
        }
      }
    }
  },

  wallTop(p, x, y, rng) {
    const T = CONFIG.tileSize;
    p.rect(x, y, T, T, TILE_COLORS.wallTop);
    for (let i = 0; i < 4; i++) {
      p.rect(x + Math.floor(rng() * 28), y + Math.floor(rng() * 28), 3, 2, TILE_COLORS.wallTopL);
    }
  },

  /** row: 0 = upper half of the wall face, 1 = lower half. */
  wallFace(p, x, y, row, rng) {
    const T = CONFIG.tileSize;
    p.rect(x, y, T, T, TILE_COLORS.mortar);
    for (let r = 0; r < 4; r++) {
      const offset = (r + row) % 2 === 0 ? 0 : -8;
      for (let c = -1; c < 3; c++) {
        const bx = x + c * 16 + offset;
        const by = y + r * 8;
        const left = Math.max(bx, x);
        const right = Math.min(bx + 15, x + T);
        if (right <= left) continue;
        p.rect(left, by, right - left, 7, rng() < 0.3 ? TILE_COLORS.brickAlt : TILE_COLORS.brick);
        p.rect(left, by, right - left, 1, TILE_COLORS.brickL);
      }
    }
    if (row === 0) p.rect(x, y, T, 3, TILE_COLORS.wallRim);
    if (row === 1) p.rect(x, y + T - 4, T, 4, TILE_COLORS.mortar);
  },

  /** Bright rim where a wall top meets the floor. */
  wallEdges(p, x, y, edges) {
    const T = CONFIG.tileSize;
    const c = TILE_COLORS.wallRim;
    if (edges.down) p.rect(x, y + T - 3, T, 3, c);
    if (edges.left) p.rect(x, y, 3, T, c);
    if (edges.right) p.rect(x + T - 3, y, 3, T, c);
  },

  /** Stone cap of a cover pillar, rimmed on its open sides. */
  pillarTop(p, x, y, rng, edges) {
    const T = CONFIG.tileSize;
    this.wallTop(p, x, y, rng);
    const c = TILE_COLORS.wallRim;
    p.rect(x, y, T, 3, c);
    p.rect(x, y + 3, T, 1, TILE_COLORS.wallTopL);
    if (edges.left) p.rect(x, y, 3, T, c);
    if (edges.right) p.rect(x + T - 3, y, 3, T, c);
    p.rect(x, y + T - 2, T, 2, TILE_COLORS.wallTopL);
  },

  banner(p, x, y) {
    p.rect(x + 6, y + 2, 20, 2, '#6a4a2a');
    p.rect(x + 8, y + 4, 16, 40, '#6a2a5a');
    p.rect(x + 8, y + 4, 2, 40, '#4a1a40');
    p.rect(x + 8, y + 44, 4, 4, '#6a2a5a');
    p.rect(x + 20, y + 44, 4, 4, '#6a2a5a');
    p.rect(x + 14, y + 16, 4, 12, '#e0b040');
    p.rect(x + 11, y + 19, 10, 3, '#e0b040');
  },

  torchBracket(p, x, y) {
    p.rect(x + 13, y + 14, 6, 10, '#3a2a20');
    p.rect(x + 11, y + 10, 10, 5, '#5a4030');
    p.rect(x + 11, y + 10, 10, 1, '#7a5a40');
  },

  bones(p, x, y, rng) {
    const ox = x + 4 + Math.floor(rng() * 14);
    const oy = y + 6 + Math.floor(rng() * 14);
    p.line(ox, oy, ox + 9, oy + 4, TILE_COLORS.bone, 2);
    p.rect(ox - 1, oy - 1, 3, 3, TILE_COLORS.bone);
    p.rect(ox + 8, oy + 3, 3, 3, TILE_COLORS.bone);
  },

  skull(p, x, y, rng) {
    const ox = x + 6 + Math.floor(rng() * 12);
    const oy = y + 6 + Math.floor(rng() * 12);
    p.round(ox, oy, 9, 8, TILE_COLORS.bone, 2);
    p.rect(ox + 2, oy + 3, 2, 2, '#2a1a2a');
    p.rect(ox + 5, oy + 3, 2, 2, '#2a1a2a');
    p.rect(ox + 2, oy + 7, 5, 2, '#b8b09c');
  },

  rubble(p, x, y, rng) {
    for (let i = 0; i < 4; i++) {
      const rx = x + 4 + Math.floor(rng() * 22);
      const ry = y + 4 + Math.floor(rng() * 22);
      p.rect(rx, ry, 3 + Math.floor(rng() * 3), 2 + Math.floor(rng() * 2), TILE_COLORS.floorDark);
      p.px(rx, ry, TILE_COLORS.floorLight);
    }
  },

  // ---------- graveyard theme ----------

  /** Dead, dark grass with dirt patches (graveyard room floors). */
  graveGrass(p, x, y, rng) {
    const T = CONFIG.tileSize;
    const greens = ['#2e3a2a', '#323f2c', '#2a3527', '#36432f'];
    p.rect(x, y, T, T, greens[Math.floor(rng() * greens.length)]);
    for (let i = 0; i < 7; i++) {
      const gx = x + Math.floor(rng() * 30);
      const gy = y + Math.floor(rng() * 30);
      p.rect(gx, gy, 1, 2, rng() < 0.5 ? '#46573a' : '#232c20');
    }
    // little tufts: a dark base with a lit blade or two
    for (let i = 0; i < 2; i++) {
      if (rng() < 0.5) continue;
      const gx = x + 3 + Math.floor(rng() * 25);
      const gy = y + 4 + Math.floor(rng() * 24);
      p.rect(gx, gy + 2, 4, 1, '#232c20');
      p.px(gx, gy + 1, '#46573a'); p.px(gx + 1, gy, '#5a6e48'); p.px(gx + 3, gy + 1, '#46573a');
    }
    if (rng() < 0.18) p.rect(x + 4 + Math.floor(rng() * 16), y + 6 + Math.floor(rng() * 16), 8, 5, '#3a3024'); // bare dirt
    if (rng() < 0.06) p.rect(x + 6 + Math.floor(rng() * 18), y + 8 + Math.floor(rng() * 16), 3, 2, '#6a6a5a'); // pebble
  },

  /** A small, sunken grave marker painted on the floor (decor only, not solid). */
  graveDecor(p, x, y, rng) {
    const cross = rng() < 0.5;
    const cx = x + 10 + Math.floor(rng() * 10);
    const cy = y + 6 + Math.floor(rng() * 8);
    p.rect(cx - 5, cy + 12, 14, 5, '#3a3024');                 // dirt mound
    if (cross) {
      p.rect(cx, cy, 3, 14, '#5a5868');
      p.rect(cx - 3, cy + 3, 9, 3, '#5a5868');
      p.rect(cx, cy, 1, 14, '#747288');
    } else {
      p.rect(cx - 3, cy + 2, 9, 12, '#545266');
      p.rect(cx - 2, cy, 7, 2, '#545266');
      p.rect(cx - 2, cy + 2, 1, 11, '#747288');
      p.rect(cx - 1, cy + 5, 5, 1, '#383646');
    }
  },
};
