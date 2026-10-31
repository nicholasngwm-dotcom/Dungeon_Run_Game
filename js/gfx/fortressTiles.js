// The Fiery Fortress: a fortress of black nether brick standing over a sea of lava. Dark red
// brick floors with glowing cracks and drifts of ash, brick bridges with low parapets for the
// hallways (the lava sea glows below them), walls of nether brick with iron-barred windows
// lit from within, crenellated ramparts, and beyond them the lava ocean itself. Pools and
// channels of lava sit in the fight rooms, crossed by stone bridges.
// Same rules as the other tile painters: one 32x32 tile at (x, y), seeded rng. The lava's
// flow and glow are animated over the top by FortressDecor.

const FORT_COLORS = {
  flag: ['#2c1014', '#321216', '#281012', '#361418'], flagL: '#4e2020', flagD: '#1a080a', grout: '#0e0406',
  ash: '#4a3a36', ashL: '#6a5a52', ember: '#ff7a1a', emberL: '#ffd27a',
  brick: '#3a1214', brickAlt: '#30100f', brickL: '#5a2020', mortar: '#120406', rim: '#6e2a22',
  top: '#1e080a', topL: '#2c0e10', topRim: '#5a2420',
  window: '#ff9a2a', windowL: '#ffe08a', bars: '#141016',
  lava: ['#7a1206', '#b02a0c', '#e04a14', '#ff7a1a', '#ffb02e', '#ffe27a'], crust: ['#1a0c0a', '#2e1612', '#4a2218'],
  bridge: ['#2a1416', '#3a1c1c', '#4a2622', '#62342a'],
};

const FortressTiles = {
  /** Nether brick flagstones: dark red bricks in courses, the odd glowing crack, drifts of ash. */
  floor(p, x, y, rng) {
    const C = FORT_COLORS;
    p.rect(x, y, 32, 32, C.grout);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let bx = -off; bx < 32; bx += 16) {
        const x0 = Math.max(0, bx);
        const x1 = Math.min(32, bx + 15);
        if (x1 <= x0) continue;
        const yy = y + row * 8;
        p.rect(x + x0, yy, x1 - x0, 7, C.flag[Math.floor(rng() * C.flag.length)]);
        p.rect(x + x0, yy, x1 - x0, 1, C.flagL);
        p.rect(x + x0, yy + 6, x1 - x0, 1, C.flagD);
        if (rng() < 0.08) p.px(x + x0 + 2 + Math.floor(rng() * Math.max(1, x1 - x0 - 4)), yy + 3, C.flagD);
      }
    }
    if (rng() < 0.08) {
      // a crack with lava glowing far down in it
      let cx = x + 4 + Math.floor(rng() * 12);
      let cy = y + 3 + Math.floor(rng() * 8);
      for (let i = 0; i < 7; i++) {
        const nx = cx + 1 + Math.floor(rng() * 3);
        const ny = cy + Math.floor(rng() * 3);
        p.line(cx, cy, nx, ny, '#4a0a04');
        if (i % 2) p.px(cx, cy, C.ember);
        cx = nx; cy = Math.min(y + 30, ny);
        if (cx > x + 30) break;
      }
      p.px(cx, cy, C.emberL);
    }
    if (rng() < 0.12) {
      // a drift of ash, a cinder still glowing in it
      const ax = x + 4 + Math.floor(rng() * 22);
      const ay = y + 6 + Math.floor(rng() * 20);
      p.ellipse(ax, ay, 4, 2, C.ash);
      p.ellipse(ax - 1, ay - 1, 2, 1, C.ashL);
      if (rng() < 0.4) p.px(ax + 2, ay, C.ember);
    }
    if (rng() < 0.03) {
      // an old bone
      const bx = x + 6 + Math.floor(rng() * 18);
      const by = y + 8 + Math.floor(rng() * 16);
      p.rect(bx, by, 6, 1, '#b5ad96');
      p.px(bx - 1, by - 1, '#b5ad96'); p.px(bx + 6, by + 1, '#b5ad96');
    }
  },

  /**
   * The hallways: brick bridges over the lava. off = tiles from the hall's centre line (-2..2): the
   * outer courses are a low parapet, the middle a worn walkway of big slabs. along: runs left to right.
   */
  hall(p, x, y, rng, along, off) {
    const C = FORT_COLORS;
    const B = C.bridge;
    p.rect(x, y, 32, 32, C.grout);
    // the walkway: big worn slabs laid across the bridge
    for (let i = 0; i < 2; i++) {
      const a = i * 16;
      const [sx, sy, sw, sh] = along ? [x + a, y, 15, 31] : [x, y + a, 31, 15];
      p.round(sx, sy, sw, sh, B[1 + Math.floor(rng() * 2)], 1);
      p.rect(sx + 1, sy, sw - 2, 1, B[3]);
      p.rect(sx, sy + 1, 1, sh - 2, B[3]);
      if (rng() < 0.25) p.line(sx + 3, sy + 4, sx + 3 + Math.floor(rng() * (sw - 6)), sy + sh - 4, B[0]);
    }
    if (rng() < 0.12) p.px(x + 4 + Math.floor(rng() * 24), y + 4 + Math.floor(rng() * 24), C.ember);
    if (Math.abs(off) >= 2) {
      // the outer edge: a kerb of dark brick along the bridge's side, iron studs set in it
      const far = off > 0;
      const [kx, ky, kw, kh] = along ? [x, far ? y + 27 : y, 32, 5] : [far ? x + 27 : x, y, 5, 32];
      p.rect(kx, ky, kw, kh, C.top);
      along ? p.rect(x, far ? y + 27 : y + 4, 32, 1, C.topRim) : p.rect(far ? x + 27 : x + 4, y, 1, 32, C.topRim);
      for (let i = 6; i < 32; i += 12) along ? p.px(x + i, ky + 2, '#948c96') : p.px(kx + 2, y + i, '#948c96');
    }
  },

  /** A wall of nether brick. row 0 = upper half (a lit coping, an iron-barred window glowing now and then); 1 = lower. */
  wallFace(p, x, y, row, rng, windowed = false) {
    const C = FORT_COLORS;
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
        if (rng() < 0.06) p.px(left + 2 + Math.floor(rng() * Math.max(1, right - left - 4)), by + 3, C.mortar);
      }
    }
    if (row === 0) {
      p.rect(x, y, 32, 4, C.rim);
      p.rect(x, y, 32, 1, '#8a3a2a');
      p.rect(x, y + 4, 32, 1, C.mortar);
      if (windowed) {
        // an arched window behind iron bars, the fire inside it lighting it
        p.round(x + 10, y + 9, 12, 20, OUTLINE, 5);
        p.round(x + 11, y + 10, 10, 19, C.window, 4);
        p.rect(x + 12, y + 18, 8, 10, '#ff6a1a');
        p.round(x + 13, y + 12, 6, 5, C.windowL, 2);
        for (const bx of [x + 13, x + 16, x + 19]) p.rect(bx, y + 10, 1, 19, C.bars);
        p.rect(x + 11, y + 20, 10, 1, C.bars);
      }
    } else {
      // the bottom course: soot, and a glowing seam where the heat gets in
      p.rect(x, y + 29, 32, 3, '#1a0608');
      if (rng() < 0.2) p.rect(x + Math.floor(rng() * 20), y + 30, 6 + Math.floor(rng() * 6), 1, '#7a1a0a');
    }
  },

  /** The flat top of the fortress's walls and ramparts: dark capstones, crenellated along any edge over the floor. */
  wallTop(p, x, y, rng, edges) {
    const C = FORT_COLORS;
    p.rect(x, y, 32, 32, C.top);
    for (let i = 0; i < 6; i++) {
      const sx = x + Math.floor(rng() * 26);
      const sy = y + Math.floor(rng() * 26);
      p.rect(sx, sy, 6, 1, C.topL);
    }
    if (rng() < 0.15) p.px(x + 4 + Math.floor(rng() * 24), y + 4 + Math.floor(rng() * 24), '#3a1412');
    const merlons = (horiz, at) => {
      for (let i = 0; i < 32; i += 8) {
        const [mx, my, mw, mh] = horiz ? [x + i, at, 5, 4] : [at, y + i, 4, 5];
        p.rect(mx, my, mw, mh, C.brick);
        p.rect(mx, my, mw, 1, C.topRim);
      }
    };
    if (edges.up) { p.rect(x, y, 32, 2, C.topRim); merlons(true, y + 2); }
    if (edges.left) { p.rect(x, y, 2, 32, C.topRim); merlons(false, x + 2); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, C.topRim); merlons(false, x + 26); }
  },

  /**
   * Where the fortress's walls end and the lava sea begins: the outer face of the wall dropping into the
   * lava. sea: { down, left, right, up } = which sides the sea lies on.
   */
  rampartEdge(p, x, y, sea) {
    const C = FORT_COLORS;
    if (sea.down) {
      p.rect(x, y + 18, 32, 14, C.brickAlt);
      for (let i = 0; i < 32; i += 8) { p.rect(x + i, y + 20, 7, 4, C.brick); p.rect(x + i + 4, y + 25, 7, 4, C.brick); }
      p.rect(x, y + 18, 32, 1, C.topRim);
      p.rect(x, y + 29, 32, 3, '#a8280c');   // lava licking the foot of the wall
      p.rect(x, y + 30, 32, 1, '#ff7a1a');
    }
    if (sea.left) { p.rect(x, y, 3, 32, '#0a0204'); p.rect(x, y, 1, 32, '#7a1a0a'); }
    if (sea.right) { p.rect(x + 29, y, 3, 32, '#0a0204'); p.rect(x + 31, y, 1, 32, '#7a1a0a'); }
    if (sea.up) { p.rect(x, y, 32, 2, '#0a0204'); p.rect(x, y, 32, 1, '#7a1a0a'); }
  },

  /**
   * The lava sea (and the fight rooms' pools): molten rock in slow swirls, rafts of dark crust drifting on it,
   * bright veins between them. edges: which sides meet something that isn't lava (a crusted rim of rock).
   */
  lava(p, x, y, rng, edges = {}, tx = 0, ty = 0) {
    const C = FORT_COLORS;
    const L = C.lava;
    p.rect(x, y, 32, 32, L[1]);
    // slow swirls, continuous from tile to tile (by world position), so the sea reads as one body
    for (let j = 0; j < 32; j += 2) {
      for (let i = 0; i < 32; i += 2) {
        const wx = tx * 32 + i;
        const wy = ty * 32 + j;
        const v = Math.sin(wx * 0.09 + Math.sin(wy * 0.07) * 2.2) + Math.sin(wy * 0.11 - wx * 0.03);
        const c = v > 1.3 ? L[4] : v > 0.6 ? L[3] : v > -0.4 ? L[2] : v > -1.2 ? L[1] : L[0];
        p.rect(x + i, y + j, 2, 2, c);
      }
    }
    // rafts of cooling crust
    if (rng() < 0.45) {
      const cx = x + 6 + Math.floor(rng() * 20);
      const cy = y + 6 + Math.floor(rng() * 20);
      const w = 4 + Math.floor(rng() * 5);
      p.round(cx - w, cy - 2, w * 2, 5, C.crust[1], 2);
      p.round(cx - w + 1, cy - 2, w, 2, C.crust[2], 1);
      p.px(cx + w - 2, cy + 2, L[4]);
    }
    if (rng() < 0.2) p.px(x + 3 + Math.floor(rng() * 26), y + 3 + Math.floor(rng() * 26), L[5]);
    // a crust of cooled rock round its edge where it meets the floor
    const rim = (rx, ry, rw, rh) => { p.rect(rx, ry, rw, rh, C.crust[0]); };
    if (edges.up) { rim(x, y, 32, 3); p.rect(x, y + 3, 32, 1, C.crust[2]); }
    if (edges.down) { rim(x, y + 29, 32, 3); p.rect(x, y + 28, 32, 1, L[4]); }
    if (edges.left) { rim(x, y, 3, 32); p.rect(x + 3, y, 1, 32, C.crust[2]); }
    if (edges.right) { rim(x + 29, y, 3, 32); p.rect(x + 28, y, 1, 32, C.crust[2]); }
  },

  /**
   * A stone bridge over a lava channel: thick slabs (across: the channel runs left-right, so the bridge spans it
   * top to bottom). side: -1 its left edge (a kerb, lava showing past it), 1 its right edge, 0 the middle.
   */
  bridge(p, x, y, rng, across, side = 0) {
    const C = FORT_COLORS;
    const B = C.bridge;
    this.lava(p, x, y, rng, {}, Math.floor(x / 32), Math.floor(y / 32));
    if (across) {
      const x0 = side < 0 ? x + 4 : x;
      const x1 = side > 0 ? x + 28 : x + 32;
      p.rect(x0, y, x1 - x0, 32, B[1]);
      for (let i = 0; i < 32; i += 8) { p.rect(x0, y + i, x1 - x0, 1, B[0]); p.rect(x0, y + i + 1, x1 - x0, 1, B[3]); }
      if (side < 0) { p.rect(x0 - 1, y, 1, 32, OUTLINE); p.rect(x0, y, 4, 32, B[2]); p.rect(x0, y, 1, 32, B[3]); }
      if (side > 0) { p.rect(x1, y, 1, 32, OUTLINE); p.rect(x1 - 4, y, 4, 32, B[0]); }
    } else {
      p.rect(x, y + 2, 32, 28, OUTLINE);
      p.rect(x, y + 3, 32, 26, B[1]);
      for (let i = 0; i < 32; i += 8) { p.rect(x + i, y + 3, 1, 26, B[0]); p.rect(x + i + 1, y + 4, 1, 24, B[3]); }
      p.rect(x, y + 3, 32, 3, B[2]);
      p.rect(x, y + 26, 32, 3, B[0]);
    }
  },

  /** A demon's sigil worked into the floor of the worm's arena (part of a great ring), its lines glowing faintly. */
  sigil(p, x, y, cx, cy, r) {
    for (let j = 0; j < 32; j += 2) {
      for (let i = 0; i < 32; i += 2) {
        const dx = x + i + 1 - cx;
        const dy = (y + j + 1 - cy) * 1.35;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const ring = Math.abs(d - r) < 2 || Math.abs(d - r * 0.62) < 1.5;
        const spoke = d < r && d > r * 0.62 && Math.abs(((a * 5 / Math.PI) % 2 + 2) % 2 - 1) < 0.06;
        if (ring || spoke) p.rect(x + i, y + j, 2, 2, ring ? '#5a1408' : '#4a1008');
      }
    }
  },
};
