// The Ancient Ruins dungeon: an old temple of carved stone, overgrown. Mossy grey-green
// slabs with grass in the cracks, some carved with diamond glyphs (a few still glowing
// with the magic in the air), overgrown paths of grass and stepping stones through the
// hallways, sandstone walls with a greek-key frieze and vines trailing down them, leafy
// growth over the wall tops, and in the guardian's room a great rune circle in the floor.
// Same rules as the other tile painters: one 32x32 tile at (x, y), seeded rng.

const RUINS_COLORS = {
  slab: ['#4a5446', '#4e5849', '#465042', '#525c4c'], slabL: '#66705c', slabD: '#343c32', grout: '#1e2a1c',
  carve: '#2c3428', carveL: '#76806a',
  grass: ['#2e5a2a', '#386a32', '#2a5426', '#3e7036'], blade: '#5a9044', bladeL: '#86bc5a', bladeD: '#1e3e1c',
  path: ['#5a5a3e', '#605f42', '#56553a'],
  wall: '#7a6648', wallAlt: '#6e5c40', wallL: '#a08a64', mortar: '#2e2418', rim: '#bca47a',
  frieze: '#5a4a34', friezeL: '#9a845e',
  top: ['#1e3a1e', '#24442a', '#1a321c'], topL: '#386a36', topRim: '#549044',
};

const RuinsTiles = {
  /** Mossy temple slabs: grass and moss in the joints, the odd glyph carved in, a few still glowing. */
  floor(p, x, y, rng) {
    const C = RUINS_COLORS;
    p.rect(x, y, 32, 32, C.grout);
    const slabs = rng() < 0.5 ? [[0, 0, 16, 16], [16, 0, 16, 16], [0, 16, 16, 16], [16, 16, 16, 16]]
      : [[0, 0, 32, 16], [0, 16, 16, 16], [16, 16, 16, 16]];
    for (const [sx, sy, w, h] of slabs) {
      p.round(x + sx, y + sy, w - 1, h - 1, C.slab[Math.floor(rng() * C.slab.length)], 2);
      p.rect(x + sx + 2, y + sy, w - 5, 1, C.slabL);
      p.rect(x + sx, y + sy + 2, 1, h - 5, C.slabL);
      p.rect(x + sx + 2, y + sy + h - 2, w - 5, 1, C.slabD);
      p.rect(x + sx + w - 2, y + sy + 2, 1, h - 5, C.slabD);
      if (w === 16 && rng() < 0.07) this.glyph(p, x + sx + 7, y + sy + 7, rng() < 0.15);
      else if (rng() < 0.18) p.line(x + sx + 3, y + sy + 4, x + sx + 3 + Math.floor(rng() * (w - 6)), y + sy + h - 4, C.slabD);
      // moss creeping over the slab from a corner
      if (rng() < 0.3) {
        const mx = x + sx + (rng() < 0.5 ? 2 : w - 6);
        const my = y + sy + (rng() < 0.5 ? 2 : h - 6);
        p.ellipse(mx + 2, my + 2, 4 + Math.floor(rng() * 3), 3, RU.moss[2]);
        p.ellipse(mx + 1, my + 1, 2, 1, RU.moss[3]);
      }
    }
    // grass and moss pushing up through the joints
    for (let i = 0; i < 4; i++) {
      if (rng() < 0.45) continue;
      const along = rng() < 0.5;
      const gx = x + (along ? Math.floor(rng() * 28) : (rng() < 0.5 ? 15 : 31));
      const gy = y + (along ? (rng() < 0.5 ? 15 : 31) : Math.floor(rng() * 28));
      p.rect(gx, gy - 1, 3, 2, C.blade);
      p.px(gx + 1, gy - 2, C.bladeL);
    }
    if (rng() < 0.05) {
      // a flower in a crack
      const fx = x + 4 + Math.floor(rng() * 24);
      const fy = y + 4 + Math.floor(rng() * 24);
      p.rect(fx, fy, 1, 3, C.blade);
      p.px(fx, fy - 1, RU.flower[Math.floor(rng() * 3)]);
    }
  },

  /** A diamond glyph carved into a slab, optionally still glowing. */
  glyph(p, cx, cy, lit) {
    const C = RUINS_COLORS;
    const c = lit ? RU.magic[2] : C.carve;
    p.line(cx - 4, cy, cx, cy - 4, c);
    p.line(cx, cy - 4, cx + 4, cy, c);
    p.line(cx + 4, cy, cx, cy + 4, c);
    p.line(cx, cy + 4, cx - 4, cy, c);
    p.rect(cx - 1, cy - 1, 2, 2, lit ? RU.magic[4] : C.carve);
    if (!lit) p.line(cx - 3, cy + 1, cx, cy + 4, C.carveL);
  },

  /** Hallways: a path of worn stepping stones through long grass. off = tiles from the hall's centre line. */
  hall(p, x, y, rng, along, off) {
    const C = RUINS_COLORS;
    p.rect(x, y, 32, 32, C.grass[Math.floor(rng() * C.grass.length)]);
    for (let i = 0; i < 10; i++) {
      const bx = x + Math.floor(rng() * 31);
      const by = y + Math.floor(rng() * 30);
      p.rect(bx, by, 1, 2, rng() < 0.5 ? C.blade : C.bladeD);
      if (rng() < 0.3) p.px(bx, by - 1, C.bladeL);
    }
    if (Math.abs(off) > 1) return;
    // stepping stones down the middle of the path
    const n = 2;
    for (let i = 0; i < n; i++) {
      const a = 4 + i * 16 + Math.floor(rng() * 3);
      const b = 6 + Math.floor(rng() * 12);
      const [sx, sy] = along ? [x + a, y + b] : [x + b, y + a];
      p.round(sx, sy, 11, 9, C.slabD, 3);
      p.round(sx, sy, 10, 8, C.slab[Math.floor(rng() * C.slab.length)], 3);
      p.rect(sx + 2, sy, 6, 1, C.slabL);
    }
    if (rng() < 0.08) p.px(x + 4 + Math.floor(rng() * 24), y + 4 + Math.floor(rng() * 24), RU.flower[Math.floor(rng() * 3)]);
  },

  /** Carved sandstone wall. row 0 = upper half, with the greek-key frieze under its lip; 1 = lower. Vines trail down. */
  wallFace(p, x, y, row, rng) {
    const C = RUINS_COLORS;
    p.rect(x, y, 32, 32, C.mortar);
    for (let r = 0; r < 3; r++) {
      const offset = (r + row) % 2 === 0 ? 0 : -10;
      for (let c = -1; c < 3; c++) {
        const bx = x + c * 20 + offset;
        const by = y + r * 11;
        const left = Math.max(bx, x);
        const right = Math.min(bx + 19, x + 32);
        if (right <= left) continue;
        p.rect(left, by, right - left, 10, rng() < 0.3 ? C.wallAlt : C.wall);
        p.rect(left, by, right - left, 1, C.wallL);
        if (rng() < 0.12) p.px(left + 2 + Math.floor(rng() * Math.max(1, right - left - 4)), by + 4, C.mortar);
      }
    }
    if (row === 0) {
      p.rect(x, y, 32, 3, C.rim);
      p.rect(x, y + 3, 32, 8, C.frieze);
      for (let i = 0; i < 32; i += 8) {
        p.rect(x + i + 1, y + 4, 6, 1, C.friezeL);
        p.rect(x + i + 6, y + 4, 1, 5, C.friezeL);
        p.rect(x + i + 3, y + 6, 3, 1, C.friezeL);
        p.rect(x + i + 1, y + 4, 1, 6, C.friezeL);
        p.rect(x + i + 1, y + 9, 7, 1, C.friezeL);
      }
      p.rect(x, y + 11, 32, 1, C.mortar);
      // grass over the lip
      for (let i = 0; i < 32; i += 3) if (rng() < 0.5) p.rect(x + i, y - 1, 2, 2 + Math.floor(rng() * 2), RU.moss[2 + Math.floor(rng() * 2)]);
    }
    if (rng() < 0.3) this.vines(p, x, y, row, rng);
    if (row === 1) {
      p.rect(x, y + 27, 32, 5, '#2a2216');
      for (let i = 0; i < 32; i += 2) if (rng() < 0.5) p.rect(x + i, y + 28 - Math.floor(rng() * 3), 2, 4, RU.moss[2]);   // grass at the foot
    }
  },

  /** Vines trailing down a wall, leaves along them. */
  vines(p, x, y, row, rng) {
    const vx0 = x + 3 + Math.floor(rng() * 26);
    const len = row === 0 ? 32 : 18 + Math.floor(rng() * 10);
    for (let i = 0; i < len; i++) {
      const vx = vx0 + Math.round(Math.sin(i * 0.4 + vx0) * 2);
      p.px(vx, y + i, RU.moss[1]);
      if (i % 5 === 2) { p.rect(vx + 1, y + i, 2, 2, RU.moss[3]); p.px(vx + 2, y + i, RU.moss[4]); }
      if (i % 7 === 4) p.rect(vx - 2, y + i, 2, 2, RU.moss[2]);
    }
  },

  /** The tops of walls between rooms: overgrown, a thick mat of leaves and bushes. */
  wallTop(p, x, y, rng, edges) {
    const C = RUINS_COLORS;
    p.rect(x, y, 32, 32, C.top[Math.floor(rng() * C.top.length)]);
    for (let i = 0; i < 5; i++) {
      const cx = x + 3 + Math.floor(rng() * 26);
      const cy = y + 3 + Math.floor(rng() * 26);
      p.circle(cx, cy, 4, C.top[1]);
      p.circle(cx - 1, cy - 1, 2, C.topL);
    }
    if (rng() < 0.1) p.px(x + 4 + Math.floor(rng() * 24), y + 4 + Math.floor(rng() * 24), RU.flower[Math.floor(rng() * 3)]);
    if (edges.left) { p.rect(x, y, 2, 32, C.topRim); p.rect(x + 2, y, 1, 32, '#0e1a0e'); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, C.topRim); p.rect(x + 29, y, 1, 32, '#0e1a0e'); }
    if (edges.up) p.rect(x, y, 32, 2, C.topRim);
  },

  /** A stone tablet set in the wall, its glyph glowing (on the upper face of a two-tile wall). */
  tablet(p, x, y) {
    const D = RU.sand;
    p.rect(x + 7, y + 13, 18, 18, D[0]);
    p.rect(x + 8, y + 14, 16, 16, D[3]);
    p.rect(x + 8, y + 14, 16, 1, D[4]);
    p.rect(x + 10, y + 16, 12, 12, D[1]);
    ruGlyph(p, x + 16, y + 22, true);
  },

  /** The guardian's room: a ring of glowing glyphs inlaid round its middle (r px), drawn over the floor tile. */
  circle(p, x, y, cx, cy, r) {
    for (let py = y; py < y + 32; py += 2) {
      for (let px = x; px < x + 32; px += 2) {
        const d = Math.hypot(px + 1 - cx, (py + 1 - cy) * 1.4);
        if (Math.abs(d - r) < 2.2) p.rect(px, py, 2, 2, RU.magic[1]);
        else if (Math.abs(d - r * 0.62) < 1.6) p.rect(px, py, 2, 2, RUINS_COLORS.carve);
      }
    }
    // glyphs set round the ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const gx = Math.round(cx + Math.cos(a) * r * 0.82);
      const gy = Math.round(cy + (Math.sin(a) * r * 0.82) / 1.4);
      if (gx >= x + 3 && gx < x + 29 && gy >= y + 3 && gy < y + 29) ruGlyph(p, gx, gy, true);
    }
  },
};
