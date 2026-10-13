// Dungeon tile painters. Each draws one 32x32 tile at (x, y)
// into a PixelArt surface using a seeded random generator.

const TILE_COLORS = {
  floor: ['#4a4560', '#4e4864', '#46415b', '#504a68'],
  floorLight: '#5c5676',
  floorDark: '#3a354d',
  grout: '#2c283b',
  moss: '#4f6a45',
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
        const col = TILE_COLORS.floor[Math.floor(rng() * TILE_COLORS.floor.length)];
        p.rect(ox, oy, 15, 15, col);
        p.rect(ox, oy, 15, 1, TILE_COLORS.floorLight);
        p.rect(ox, oy, 1, 15, TILE_COLORS.floorLight);
        p.rect(ox + 1, oy + 14, 14, 1, TILE_COLORS.floorDark);
        if (rng() < 0.15) p.line(ox + 3, oy + 4, ox + 3 + Math.floor(rng() * 8), oy + 10, TILE_COLORS.floorDark);
        if (rng() < 0.08) p.rect(ox + 2 + Math.floor(rng() * 9), oy + 9, 4, 3, TILE_COLORS.moss);
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
};
