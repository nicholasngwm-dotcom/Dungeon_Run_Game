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

  /**
   * A small grave marker painted on the floor (decor only, not solid): outlined, lit from the top-left, mossy.
   * dark: the Deathbringer's room, where they're near-black stone, some of them plated in gold.
   */
  graveDecor(p, x, y, rng, dark = false) {
    const cross = rng() < 0.5;
    const gold = dark && rng() < 0.5;
    const S = dark ? ['#24222c', '#33303e', '#46424f', '#16141c'] : ['#6e6c80', '#686678', '#9492a8', '#56546a'];
    const cx = x + 10 + Math.floor(rng() * 10);
    const cy = y + 4 + Math.floor(rng() * 8);
    const O = '#1a1620';
    // the grave's mound, with a sprig of pale flowers
    p.ellipse(cx + 1, cy + 16, 9, 3, '#3e3226');
    p.rect(cx - 6, cy + 15, 14, 1, '#56462f');
    if (rng() < 0.5) { p.px(cx + 5, cy + 14, '#e8e4f0'); p.px(cx + 6, cy + 15, '#c8b4e8'); p.px(cx - 4, cy + 15, '#e8e4f0'); }
    if (cross) {
      p.rect(cx - 1, cy - 1, 5, 17, O);
      p.rect(cx - 4, cy + 2, 11, 5, O);
      p.rect(cx, cy, 3, 15, S[0]);
      p.rect(cx - 3, cy + 3, 9, 3, S[0]);
      p.rect(cx, cy, 1, 15, S[2]);
      p.rect(cx - 3, cy + 3, 9, 1, S[2]);
      p.rect(cx + 2, cy + 6, 1, 9, S[3]);
      if (gold) { p.rect(cx, cy + 3, 3, 3, '#dcb44c'); p.rect(cx - 3, cy + 3, 9, 1, '#fbe796'); p.rect(cx, cy, 3, 1, '#dcb44c'); }
    } else {
      p.rect(cx - 4, cy - 1, 11, 17, O);
      p.round(cx - 3, cy, 9, 15, S[1], 3);
      p.rect(cx - 2, cy + 1, 1, 13, S[2]);
      p.rect(cx - 1, cy, 5, 1, S[2]);
      p.rect(cx + 5, cy + 3, 1, 11, S[3]);
      if (gold) { p.rect(cx - 2, cy + 2, 7, 2, '#dcb44c'); p.px(cx + 1, cy + 2, '#fbe796'); p.rect(cx - 3, cy + 13, 9, 2, '#a07a24'); }
      p.rect(cx - 1, cy + 5, 5, 1, '#3e3c4c');
      p.rect(cx, cy + 7, 3, 1, '#3e3c4c');
    }
    // moss creeping up the stone (none on the gilded dark ones)
    if (dark) return;
    p.rect(cx - 2, cy + 12, 3, 2, '#4e6e44');
    p.px(cx - 1, cy + 11, '#6a8e58');
  },
};

// The graveyard in the keep's newer, warmer style: soft moonlit grass full of clover and
// pale flowers, mossy cobbled paths for the hallways, ivy-hung stone walls and dark yew
// hedges filling the space between the rooms.
const GRAVE_COLORS = {
  grass: ['#3d5341', '#3f5643', '#3b5140', '#405743'],
  blade: '#5a7a58', bladeL: '#7a9a6c', bladeD: '#2c3e30',
  cob: ['#686a7c', '#626476', '#6e6e82', '#5c5e70'], cobL: '#8a8ca0', cobD: '#46485a', cobGrout: '#2a2a36',
  moss: '#4e6e44', mossL: '#6a8e58',
  brick: '#5e5c70', brickAlt: '#56546a', brickL: '#7c7a90', mortar: '#2c2a38', rim: '#8e8ca4',
  hedge: ['#121a18', '#18261f', '#203426', '#2a4430', '#3a5a40'],
};

const Grave = {
  /** Moonlit graveyard grass: blades, clover, pale flowers, fallen leaves, worn dirt. */
  grass(p, x, y, rng) {
    const C = GRAVE_COLORS;
    p.rect(x, y, 32, 32, C.grass[Math.floor(rng() * C.grass.length)]);
    // soft mottling, so the tiles blend into one lawn instead of a checkerboard
    for (let i = 0; i < 3; i++) {
      p.ellipse(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), 4 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 3), rng() < 0.5 ? '#375039' : '#445c46');
    }
    for (let i = 0; i < 10; i++) {
      p.rect(x + Math.floor(rng() * 30), y + Math.floor(rng() * 30), 1, 2, rng() < 0.55 ? C.blade : C.bladeD);
    }
    for (let i = 0; i < 2; i++) {
      if (rng() < 0.45) continue;
      const gx = x + 3 + Math.floor(rng() * 25);
      const gy = y + 4 + Math.floor(rng() * 24);
      p.rect(gx, gy + 2, 4, 1, C.bladeD);
      p.px(gx, gy + 1, C.blade); p.px(gx + 1, gy, C.bladeL); p.px(gx + 3, gy + 1, C.blade);
    }
    if (rng() < 0.12) {
      // a clover patch
      const cx = x + 5 + Math.floor(rng() * 20);
      const cy = y + 5 + Math.floor(rng() * 20);
      for (const [dx, dy] of [[0, 0], [2, 0], [1, -1], [1, 1]]) p.px(cx + dx, cy + dy, C.bladeL);
      p.px(cx + 1, cy, C.blade);
    }
    if (rng() < 0.06) {
      // a pale grave-flower
      const fx = x + 4 + Math.floor(rng() * 22);
      const fy = y + 4 + Math.floor(rng() * 22);
      p.px(fx, fy, '#e8e4f0'); p.px(fx + 1, fy, '#e8e4f0'); p.px(fx, fy + 1, '#e8e4f0'); p.px(fx + 1, fy + 1, '#b8a0d8');
      p.px(fx + 1, fy + 2, C.bladeD);
    }
    if (rng() < 0.08) {
      // a fallen leaf
      const lx = x + 4 + Math.floor(rng() * 22);
      const ly = y + 4 + Math.floor(rng() * 22);
      p.rect(lx, ly, 3, 2, rng() < 0.5 ? '#8a5a2a' : '#7a4a3a');
      p.px(lx + 1, ly, '#b07a3a');
    }
    if (rng() < 0.14) {
      // worn earth
      const dx = x + 4 + Math.floor(rng() * 18);
      const dy = y + 6 + Math.floor(rng() * 18);
      p.ellipse(dx + 4, dy + 2, 5, 3, '#4a3e30');
      p.px(dx + 2, dy + 1, '#5e5040');
    }
  },

  /** Hallways: a mossy cobbled path, rounded stones lit from the top-left. */
  path(p, x, y, rng) {
    const C = GRAVE_COLORS;
    p.rect(x, y, 32, 32, C.cobGrout);
    for (let sy = 0; sy < 3; sy++) {
      const off = sy % 2 ? -5 : 0;
      for (let sx = -1; sx < 3; sx++) {
        const w = 10 + Math.floor(rng() * 4);
        const ox = x + sx * 12 + off + Math.floor(rng() * 2);
        const oy = y + sy * 11 - 1 + Math.floor(rng() * 2);
        const l = Math.max(ox, x);
        const r = Math.min(ox + w, x + 32);
        const t = Math.max(oy, y);
        const b = Math.min(oy + 10, y + 32);
        if (r - l < 3 || b - t < 3) continue;
        p.round(l, t, r - l, b - t, C.cob[Math.floor(rng() * C.cob.length)], 2);
        p.rect(l + 1, t, r - l - 2, 1, C.cobL);
        p.rect(l + 1, b - 1, r - l - 2, 1, C.cobD);
        if (rng() < 0.12) p.rect(l + 1, b - 2, 3, 1, C.moss);
      }
    }
    if (rng() < 0.25) {
      const mx = x + 2 + Math.floor(rng() * 24);
      const my = y + 2 + Math.floor(rng() * 24);
      p.rect(mx, my, 4, 1, C.moss);
      p.px(mx + 1, my - 1, C.mossL);
    }
  },

  /** A dark yew hedge filling the gaps between rooms; lit on any side facing open ground. */
  hedge(p, x, y, rng, edges) {
    const G = GRAVE_COLORS.hedge;
    p.rect(x, y, 32, 32, G[1]);
    for (let i = 0; i < 6; i++) {
      const cx = x + 4 + Math.floor(rng() * 24);
      const cy = y + 4 + Math.floor(rng() * 24);
      const r = 5 + Math.floor(rng() * 4);
      p.circle(cx, cy, r, G[2]);
      p.circle(cx - 1, cy - 1, r - 2, G[3]);
      p.px(cx - 2, cy - 3, G[4]);
    }
    if (rng() < 0.08) {
      // a bare branch poking out
      const bx = x + 6 + Math.floor(rng() * 18);
      const by = y + 6 + Math.floor(rng() * 18);
      p.line(bx, by, bx + 6, by - 4, '#3a2e26');
      p.px(bx + 4, by - 4, '#3a2e26');
    }
    if (edges.left) { p.rect(x, y, 2, 32, G[0]); p.rect(x + 2, y, 1, 32, G[4]); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, G[0]); p.rect(x + 29, y, 1, 32, G[4]); }
    if (edges.up) { p.rect(x, y, 32, 2, G[4]); p.rect(x, y + 2, 32, 1, G[3]); }
    if (edges.down) {
      // the hedge's shaded foot where it meets the path
      p.rect(x, y + 24, 32, 8, G[0]);
      for (let i = 0; i < 4; i++) p.circle(x + 4 + i * 8, y + 24, 4, G[2]);
      p.rect(x, y + 30, 32, 2, '#0c1210');
    }
  },

  /** The cemetery wall: grey stone with moss along the cap and ivy trailing down. row 0 = upper, 1 = lower. */
  wallFace(p, x, y, row, rng) {
    const C = GRAVE_COLORS;
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
        if (rng() < 0.1) p.px(left + 2 + Math.floor(rng() * Math.max(1, right - left - 4)), by + 3, C.mortar);   // a chip
      }
    }
    if (row === 0) {
      // mossy cap
      p.rect(x, y, 32, 3, C.rim);
      for (let i = 0; i < 32; i += 2) if (rng() < 0.55) p.rect(x + i, y + 2, 2, 1 + Math.floor(rng() * 3), C.moss);
      p.rect(x + Math.floor(rng() * 26), y + 1, 5, 1, C.mossL);
    }
    // ivy trailing down the stones
    if (rng() < 0.35) {
      let vx = x + 3 + Math.floor(rng() * 26);
      for (let vy = y; vy < y + 26; vy += 2) {
        vx += Math.floor(rng() * 3) - 1;
        p.px(vx, vy, '#2e4a30');
        if (rng() < 0.5) { p.px(vx + 1, vy + 1, C.moss); p.px(vx - 1, vy, C.mossL); }
      }
    }
    if (row === 1) p.rect(x, y + 28, 32, 4, '#22202c');   // damp foot of the wall
  },
};
