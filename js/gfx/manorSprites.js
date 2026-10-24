// The Phantom King's room: the entrance hall of a haunted manor. Old dark floorboards with
// a worn runner up the middle, teal damask wallpaper over wood panelling, a grand stone
// staircase climbing to a landing and a gallery under a moonlit window, a chandelier, tall
// moonlit windows and portraits along the back wall, furniture under dust sheets, cobwebs,
// and the pale phantoms of the old household still drifting about (decor only, see ManorDecor).
// Tiles follow the other painters (one 32x32 tile at (x, y), seeded rng); sprites are
// painted with the PixelArt toolkit in the house style: dark outline, lit from the top-left.

const MANOR_COLORS = {
  board: ['#33241f', '#372822', '#2f211c', '#3b2b24'], boardL: '#4a372e', boardD: '#1c1210', dust: '#54443c',
  runner: ['#3a1420', '#421824', '#36121c'], runnerL: '#5a2232', runnerD: '#240a12', trim: '#8a7034', trimL: '#c8a456',
  paper: '#16282a', paperL: '#20383a', paperM: '#2a4a4c', plaster: '#3a3a3e',
  wood: ['#120c10', '#22161a', '#33222a', '#4a3238', '#62464c'],
  stone: ['#1a2224', '#283234', '#3a4648', '#526062', '#6e7e80'],
  slate: ['#101418', '#151a20', '#1d242b', '#2a333c'],
  glass: ['#12222e', '#1e3a4a', '#2e5468', '#4a7a90', '#8ac0d8'],
  curtain: ['#24080e', '#3a1420', '#5a1e2c'],
  gold: ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'],
  sheet: ['#5a6474', '#7a8494', '#9aa4b4', '#c0c8d4', '#dee4ec'],
  ghost: ['#2e5a6a', '#5e98ac', '#9cd4e4', '#d4f4ff', '#ffffff'],
};

const ManorTiles = {
  /** Old dark floorboards: long planks (a joint every few tiles), grained, dusty, the odd scratch. */
  floor(p, x, y, rng, tx, ty) {
    const C = MANOR_COLORS;
    for (let i = 0; i < 4; i++) {
      const by = y + i * 8;
      const row = ty * 4 + i;
      // each plank keeps its colour along its length (it spans several tiles)
      const plank = Math.floor((tx + row * 3) / 4);
      p.rect(x, by, 32, 8, C.board[(plank * 7 + row) % C.board.length]);
      p.rect(x, by, 32, 1, C.boardL);
      p.rect(x, by + 7, 32, 1, C.boardD);
      // long grain streaks
      for (let g = 0; g < 2; g++) {
        const gy = by + 2 + ((row * 5 + g * 3 + tx) % 4);
        const gx = x + ((row * 11 + g * 17 + tx * 7) % 20);
        p.rect(gx, gy, 8 + ((row + g) % 3) * 4, 1, g ? C.boardD : C.board[(plank + 2) % C.board.length]);
      }
      // the end of a plank, staggered row by row
      if ((tx + row * 3) % 4 === 0) {
        const jx = x + ((row * 13) % 24) + 4;
        p.rect(jx, by + 1, 1, 6, C.boardD);
        p.px(jx + 1, by + 1, C.boardL);
        p.px(jx - 2, by + 4, C.boardD);   // nails
        p.px(jx + 2, by + 4, C.boardD);
      }
    }
    for (let i = 0; i < 3; i++) p.px(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), C.dust);
    if (rng() < 0.06) {
      // a scratch dragged across the boards
      const sx = x + 4 + Math.floor(rng() * 14);
      const sy = y + 4 + Math.floor(rng() * 20);
      p.line(sx, sy, sx + 10, sy + 3, C.boardL);
    }
  },

  /**
   * The faded wine runner from the doors to the stairs, four tiles wide. off: the tile's centre
   * from the runner's centre line, in tiles (-1.5, -0.5, 0.5, 1.5; the outer ones carry its gold edge).
   */
  runner(p, x, y, rng, off) {
    const C = MANOR_COLORS;
    p.rect(x, y, 32, 32, C.runner[Math.floor(rng() * C.runner.length)]);
    for (let i = 0; i < 5; i++) p.rect(x + Math.floor(rng() * 30), y + Math.floor(rng() * 30), 2, 1, rng() < 0.5 ? C.runnerL : C.runnerD);
    for (let i = 0; i < 4; i++) p.px(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), C.dust);   // dust trodden in
    if (Math.abs(off) < 1) {
      // a faded medallion down the middle every other tile (on the seam: each middle tile paints all
      // of it, and the half that spills over is painted again by its neighbour)
      if ((y / 32) % 2 === 0) {
        const mx = off < 0 ? x + 32 : x;
        p.poly([[mx, y + 6], [mx + 10, y + 16], [mx, y + 26], [mx - 10, y + 16]], C.runnerL);
        p.poly([[mx, y + 10], [mx + 6, y + 16], [mx, y + 22], [mx - 6, y + 16]], C.runnerD);
        p.rect(mx - 1, y + 15, 2, 2, C.trim);
      }
    } else {
      const ex = off < 0 ? x : x + 26;
      p.rect(ex, y, 6, 32, C.runnerD);
      p.rect(off < 0 ? x + 2 : x + 27, y, 2, 32, C.trim);
      p.rect(off < 0 ? x + 2 : x + 28, y, 1, 32, C.trimL);
      for (let i = 2; i < 32; i += 5) p.rect(off < 0 ? x : x + 31, y + i, 1, 2, C.trim);   // fringe
    }
    if (rng() < 0.1) {
      // worn through to the boards
      const hx = x + 8 + Math.floor(rng() * 14);
      const hy = y + 8 + Math.floor(rng() * 14);
      p.rect(hx, hy, 5, 3, C.board[0]);
      p.rect(hx, hy, 5, 1, C.runnerD);
    }
  },

  /**
   * The hall's walls: teal damask wallpaper (peeling here and there) under a dark crown
   * moulding; the lower tile is dark wood wainscot below a chair rail. row 0 upper, 1 lower.
   */
  wallFace(p, x, y, row, rng, tx) {
    const C = MANOR_COLORS;
    const W = C.wood;
    p.rect(x, y, 32, 32, C.paper);
    const paperTo = row === 0 ? 32 : 10;
    // the damask: a little diamond motif on a half-drop grid
    for (let my = 4; my < paperTo; my += 12) {
      for (let mx = 0; mx < 32; mx += 16) {
        const dx = x + mx + (((my / 12) | 0) % 2 ? 8 : 0) + 4;
        const dy = y + my;
        if (dy + 6 > y + paperTo) continue;
        p.poly([[dx + 3, dy], [dx + 6, dy + 3], [dx + 3, dy + 6], [dx, dy + 3]], C.paperL);
        p.px(dx + 3, dy + 3, C.paperM);
        p.px(dx + 3, dy - 1, C.paperL);
      }
    }
    for (let sx = 0; sx < 32; sx += 8) p.rect(x + sx, y, 1, paperTo, '#132224');   // the paper's stripes
    if (row === 0) {
      // crown moulding
      p.rect(x, y, 32, 5, W[1]);
      p.rect(x, y, 32, 1, W[3]);
      p.rect(x, y + 3, 32, 1, W[2]);
      p.rect(x, y + 5, 32, 1, '#0c1416');
      if (rng() < 0.18) {
        // a strip of wallpaper peeling away from the plaster
        const px = x + 4 + Math.floor(rng() * 18);
        const py = y + 10 + Math.floor(rng() * 10);
        p.rect(px, py, 7, 9, C.plaster);
        p.rect(px + 1, py + 1, 2, 2, '#4a4a50');
        p.poly([[px + 7, py], [px + 10, py + 3], [px + 7, py + 7]], C.paperL);
      }
      return;
    }
    // chair rail, then panelled wainscot down to the skirting
    p.rect(x, y + 10, 32, 3, W[2]);
    p.rect(x, y + 10, 32, 1, W[4]);
    p.rect(x, y + 13, 32, 19, W[1]);
    const px0 = x + ((tx % 2) ? 2 : 2);
    p.rect(px0, y + 16, 28, 11, W[2]);
    p.rect(px0, y + 16, 28, 1, W[3]);
    p.rect(px0, y + 16, 1, 11, W[3]);
    p.rect(px0 + 27, y + 16, 1, 11, W[0]);
    p.rect(px0, y + 26, 28, 1, W[0]);
    p.rect(x, y + 28, 32, 4, W[0]);
    p.rect(x, y + 28, 32, 1, W[2]);
  },

  /** The manor's dark slate roof, seen from above (the walls between it and the graveyard). */
  wallTop(p, x, y, rng, edges) {
    const S = MANOR_COLORS.slate;
    p.rect(x, y, 32, 32, S[1]);
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 4 : 0;
      for (let c = -1; c < 4; c++) {
        const sx = x + c * 8 + off;
        const sy = y + r * 8;
        const l = Math.max(sx, x);
        const w = Math.min(sx + 7, x + 32) - l;
        if (w <= 0) continue;
        p.rect(l, sy, w, 7, rng() < 0.15 ? S[3] : S[2]);
        p.rect(l, sy + 6, w, 1, S[0]);
      }
    }
    if (edges.left) { p.rect(x, y, 2, 32, S[0]); p.rect(x + 2, y, 1, 32, S[3]); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, S[0]); p.rect(x + 29, y, 1, 32, S[3]); }
    if (edges.up) p.rect(x, y, 32, 2, S[3]);
  },
};

// the staircase sprite: its size and anchor (its bottom step, centre), the solid footprint
// (in tiles from the room's top wall: the landing's full width, then the flight), and its candles
const MANOR_STAIRS = { w: 320, h: 236, landingTiles: 10, flightTiles: 6, candles: [[-88, -76], [88, -76]] };
// the chandelier: sprite size, how high it hangs over its floor point (px), and where its candles stand on it
const MANOR_CHANDELIER = { w: 104, h: 76, high: 120,
  candles: [[-46, 40], [-30, 46], [-14, 50], [14, 50], [30, 46], [46, 40], [-22, 22], [0, 18], [22, 22]] };

function buildManorSprites() {
  const C = MANOR_COLORS;
  const W = C.wood;
  const S = C.stone;
  const G = C.gold;

  /**
   * The grand staircase (see MANOR_STAIRS): a back wall with a tall arched moonlit window
   * over a gallery and its balustrade; two flights climbing from a landing up to the gallery,
   * and the wide main flight down from the landing to the hall floor, carpeted up the middle,
   * between turned balusters and two great newel posts topped with candles.
   */
  const stairs = PixelArt.make(MANOR_STAIRS.w, MANOR_STAIRS.h, (p) => {
    const H = MANOR_STAIRS.h;
    const wallTop = H - 192;     // where the hall's back wall starts (2 tiles above the room)
    const roomTop = H - 128;     // the room's top edge
    const landY = roomTop - 6;   // the landing's top surface
    const landF = roomTop + 12;  // its front face
    const landB = roomTop + 32;  // its foot (the first solid row ends here)
    // ---- the back wall: wallpaper, the window, panelling under the gallery ----
    p.rect(0, wallTop + 8, 320, roomTop - wallTop, C.paper);
    for (let sx = 0; sx < 320; sx += 8) p.rect(sx, wallTop + 8, 1, roomTop - wallTop, '#132224');
    for (let my = wallTop + 14; my < roomTop - 6; my += 12) {
      for (let mx = 4; mx < 316; mx += 16) {
        const dx = mx + (((my / 12) | 0) % 2 ? 8 : 0);
        p.poly([[dx + 3, my], [dx + 6, my + 3], [dx + 3, my + 6], [dx, my + 3]], C.paperL);
      }
    }
    // the tall arched window over the landing, moonlight through it
    const wx = 132;
    const ww = 56;
    const wy = wallTop + 10;
    const wh = roomTop - wallTop - 16;
    p.round(wx - 4, wy - 2, ww + 8, wh + 4, W[1], 28);
    p.round(wx - 2, wy, ww + 4, wh, W[3], 26);
    p.round(wx, wy + 2, ww, wh - 4, C.glass[1], 24);
    for (let i = 0; i < wh - 4; i += 2) p.rect(wx + 2, wy + 2 + i, ww - 4, 1, i < (wh - 4) / 3 ? C.glass[2] : C.glass[1]);
    p.circle(wx + 18, wy + 18, 7, '#cfe6f0');   // the moon behind the glass
    p.circle(wx + 20, wy + 16, 2, '#a8c8d8');
    p.rect(wx + ww / 2 - 1, wy + 2, 3, wh - 4, W[2]);   // mullions
    for (const my of [wy + 26, wy + 44]) p.rect(wx, my, ww, 2, W[2]);
    p.line(wx + 4, wy + 10, wx + 10, wy + 4, C.glass[4]);
    // tattered curtains either side of it
    for (const s of [-1, 1]) {
      const cx = s < 0 ? wx - 14 : wx + ww + 4;
      p.rect(cx, wy - 4, 10, wh + 6, C.curtain[1]);
      p.rect(cx + (s < 0 ? 0 : 6), wy - 4, 4, wh + 6, C.curtain[2]);
      for (let i = 0; i < 10; i += 3) p.rect(cx + i, wy + wh + 2 + (i % 2) * 3, 2, 3, C.curtain[0]);
    }
    p.rect(wx - 18, wy - 6, ww + 36, 3, G[1]);   // the curtain rod
    p.rect(wx - 18, wy - 6, ww + 36, 1, G[2]);
    // ---- the gallery along the top: its floor edge and a balustrade ----
    const galY = wallTop + 4;
    p.rect(0, galY, 320, 6, S[2]);
    p.rect(0, galY, 320, 1, S[4]);
    p.rect(0, galY + 6, 320, 4, S[1]);
    const rail = (x0, x1, y, h) => {
      for (let x = x0 + 3; x < x1 - 2; x += 6) {
        p.rect(x, y - h + 3, 3, h - 3, W[2]);
        p.rect(x, y - h + 3, 1, h - 3, W[4]);
        p.rect(x + 1, y - Math.floor(h / 2), 2, 2, W[3]);   // the turned bulge
      }
      p.rect(x0, y - h, x1 - x0, 3, W[3]);
      p.rect(x0, y - h, x1 - x0, 1, W[4]);
    };
    rail(0, 128, galY, 18);
    rail(192, 320, galY, 18);
    for (const x of [0, 62, 124, 192, 254, 314]) {
      p.rect(x, galY - 24, 6, 24, W[2]);
      p.rect(x, galY - 24, 2, 24, W[3]);
      p.round(x - 1, galY - 29, 8, 6, W[3], 2);
    }
    // ---- the two upper flights: from the landing's ends up to the gallery ----
    for (const s of [-1, 1]) {
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const k0 = i / steps;
        const y0 = Math.round(landY - (landY - galY - 6) * k0);
        const xi = Math.round(s < 0 ? 100 - 44 * k0 : 220 + 44 * k0);   // inner edge (by the wall)
        const xo = Math.round(s < 0 ? 22 - 22 * k0 : 298 + 22 * k0);   // outer edge
        const l = Math.min(xi, xo);
        const w = Math.abs(xi - xo);
        p.rect(l, y0 - 8, w, 8, S[1]);
        p.rect(l, y0 - 8, w, 2, S[3]);
        p.rect(l, y0 - 8, w, 1, S[4]);
      }
      // the stringer up the inner side, and a rail up the outer
      const xi0 = s < 0 ? 100 : 220;
      const xi1 = s < 0 ? 56 : 264;
      p.line(xi0, landY, xi1, galY + 6, W[1], 4);
      p.line(xi0, landY - 1, xi1, galY + 5, W[3], 1);
      const xo0 = s < 0 ? 22 : 298;
      const xo1 = s < 0 ? 0 : 320;
      for (let k = 0; k <= 1; k += 0.125) {
        const bx = Math.round(lerp(xo0, xo1, k));
        const by = Math.round(lerp(landY, galY + 4, k));
        p.rect(bx - 1, by - 16, 3, 14, W[2]);
        p.rect(bx - 1, by - 16, 1, 14, W[4]);
      }
      p.line(xo0, landY - 18, xo1, galY - 14, W[3], 3);
      p.line(xo0, landY - 18, xo1, galY - 14, W[4], 1);
    }
    // ---- the landing: a stone floor across the stairs' width, panelled below ----
    p.rect(16, landY, 288, landF - landY, S[2]);
    p.rect(16, landY, 288, 1, S[4]);
    p.rect(16, landY + 1, 288, 1, S[3]);
    for (let i = 0; i < 12; i++) p.px(24 + ((i * 71) % 272), landY + 4 + (i % 3) * 4, S[1]);
    p.rect(16, landF, 288, landB - landF, W[1]);
    p.rect(16, landF, 288, 2, W[3]);
    for (let px = 20; px < 300; px += 36) {
      if (px > 56 && px < 264) continue;   // the main flight comes down in front
      p.rect(px, landF + 5, 30, landB - landF - 9, W[2]);
      p.rect(px, landF + 5, 30, 1, W[3]);
      p.rect(px, landF + 5, 1, landB - landF - 9, W[3]);
    }
    p.rect(16, landB - 3, 288, 3, W[0]);
    // the landing's balustrade along its front, where the flight doesn't cut through
    rail(16, 68, landY + 2, 16);
    rail(252, 304, landY + 2, 16);
    // ---- the main flight: down from the landing to the floor ----
    const top = landF;
    const bottom = H - 1;
    const n = 13;
    const edge = (k) => ({ l: lerp(96, 70, k), r: lerp(224, 250, k) });   // k: 0 at the top, 1 at the bottom
    for (let i = 0; i < n; i++) {
      const k0 = i / n;
      const k1 = (i + 1) / n;
      const y0 = Math.round(lerp(top, bottom, k0));
      const y1 = Math.round(lerp(top, bottom, k1));
      const e = edge(k1);
      const l = Math.round(e.l);
      const w = Math.round(e.r - e.l);
      // tread (with a bright nosing) and the riser beneath it
      p.rect(l, y0, w, y1 - y0, S[1]);
      p.rect(l, y0, w, 3, S[3]);
      p.rect(l, y0, w, 1, S[4]);
      p.rect(l, y1 - 1, w, 1, S[0]);
      if (i % 3 === 1) p.px(l + 8 + ((i * 37) % (w - 16)), y0 + 4, S[2]);
      // the carpet up the middle, held by brass rods
      const cw = Math.round(lerp(26, 34, k1));
      const cx = 160;
      p.rect(cx - cw, y0, cw * 2, y1 - y0, C.runner[1]);
      p.rect(cx - cw, y0, cw * 2, 3, C.runnerL);
      p.rect(cx - cw, y1 - 1, cw * 2, 1, C.runnerD);
      p.rect(cx - cw, y0, 2, y1 - y0, C.trim);
      p.rect(cx + cw - 2, y0, 2, y1 - y0, C.trim);
      p.rect(cx - cw - 2, y1 - 3, cw * 2 + 4, 1, G[2]);
    }
    // balustrades down both sides of the flight
    for (const s of [-1, 1]) {
      const ex = (k) => (s < 0 ? edge(k).l + 4 : edge(k).r - 4);
      for (let k = 0.05; k < 0.86; k += 0.065) {
        const bx = Math.round(ex(k));
        const by = Math.round(lerp(top, bottom, k));
        p.rect(bx - 1, by - 20, 3, 20, W[2]);
        p.rect(bx - 1, by - 20, 1, 20, W[4]);
        p.rect(bx - 2, by - 11, 5, 2, W[3]);
      }
      p.line(ex(0), top - 22, ex(0.9), lerp(top, bottom, 0.9) - 28, W[1], 5);
      p.line(ex(0), top - 23, ex(0.9), lerp(top, bottom, 0.9) - 29, W[3], 2);
      p.line(ex(0), top - 24, ex(0.9), lerp(top, bottom, 0.9) - 30, W[4], 1);
      // the newel post at its foot, with a carved ball and a candle on top
      const nx = s < 0 ? 64 : 240;
      p.rect(nx, bottom - 50, 16, 51, W[1]);
      p.rect(nx + 1, bottom - 50, 4, 51, W[3]);
      p.rect(nx + 12, bottom - 50, 3, 51, W[0]);
      p.rect(nx + 3, bottom - 36, 10, 22, W[2]);
      p.rect(nx + 3, bottom - 36, 10, 1, W[4]);
      p.rect(nx - 2, bottom - 54, 20, 5, W[3]);
      p.rect(nx - 2, bottom - 54, 20, 1, W[4]);
      p.circle(nx + 8, bottom - 60, 6, W[2]);
      p.circle(nx + 6, bottom - 62, 2, W[4]);
      // a short candle in a brass dish (its flame is drawn live)
      p.rect(nx + 3, bottom - 68, 10, 2, G[1]);
      p.rect(nx + 6, bottom - 76, 4, 8, '#e8e0c8');
      p.rect(nx + 6, bottom - 76, 1, 8, '#ffffff');
      p.rect(nx + 9, bottom - 72, 1, 3, '#c8c0a8');   // a drip of wax
    }
  }, OUTLINE);

  /** The chandelier (see MANOR_CHANDELIER): black iron with gold, two tiers of candles, crystal drops. Hangs from (w/2, 0). */
  const chandelier = PixelArt.bevel(PixelArt.make(MANOR_CHANDELIER.w, MANOR_CHANDELIER.h, (p) => {
    const I = ['#16141c', '#2a2834', '#423f50'];
    const cx = 52;
    for (let y = 0; y < 14; y += 3) { p.rect(cx - 1, y, 3, 2, I[2]); p.px(cx, y + 2, I[1]); }   // the chain
    p.rect(cx - 2, 14, 5, 46, I[1]);
    p.rect(cx - 2, 14, 2, 46, I[2]);
    for (const y of [24, 36, 52]) { p.ellipse(cx, y, 4, 3, G[1]); p.px(cx - 1, y - 1, G[2]); }
    p.ellipse(cx, 62, 3, 5, I[1]);   // the finial
    p.px(cx, 68, G[2]);
    // the arms: curving out from the stem and up to the candle cups
    const cup = (x, y) => {
      p.rect(x - 4, y, 9, 3, G[1]);
      p.rect(x - 4, y, 9, 1, G[2]);
      p.rect(x - 1, y - 7, 3, 7, '#e8e0c8');
      p.px(x - 1, y - 7, '#ffffff');
      p.px(x, y + 5, '#bfe8ff');   // a crystal drop
      p.px(x, y + 6, '#7ab8d8');
    };
    for (const [ox, oy] of MANOR_CHANDELIER.candles) {
      const x = cx + ox;
      const y = oy;
      const midY = oy > 30 ? 48 : 30;
      p.line(cx, midY, x, y + 4, I[1], 2);
      p.line(cx, midY - 1, x, y + 3, I[2], 1);
      cup(x, y);
    }
    // a ring of crystal drops hanging under the lower tier
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 9;
      const y = 54 + Math.round(Math.abs(i) * -2);
      p.px(x, y, '#d8f4ff');
      p.px(x, y + 1, '#7ab8d8');
    }
  }, OUTLINE));

  /** A chair (or a sofa, wide) hidden under a dusty grey sheet, its hem pooling on the floor. */
  const sheeted = (wide) => PixelArt.bevel(PixelArt.make(wide ? 60 : 34, 36, (p) => {
    const Sh = C.sheet;
    const w = wide ? 60 : 34;
    // the shape under it: a high back on the left, a seat, an arm
    p.round(2, 2, wide ? 18 : 14, 30, Sh[1], 5);
    p.round(4, 14, w - 6, 18, Sh[2], 4);
    p.round(w - 12, 10, 10, 20, Sh[2], 4);
    if (wide) p.round(16, 6, 30, 12, Sh[1], 5);
    p.rect(4, 4, 4, 22, Sh[3]);
    p.rect(8, 15, w - 16, 2, Sh[3]);
    // folds falling down the front
    for (let x = 10; x < w - 6; x += 7) p.line(x, 18, x - 2, 31, Sh[1], 1);
    // the ragged hem on the floor
    for (let x = 2; x < w - 2; x += 4) p.rect(x, 31 + ((x / 4) % 2), 4, 3, Sh[1]);
    p.px(6, 6, Sh[4]);
    for (let i = 0; i < 6; i++) p.px(6 + ((i * 13) % (w - 10)), 8 + ((i * 7) % 20), Sh[0]);   // dust and stains
  }, OUTLINE));

  /** A portrait in a heavy gilt frame. who: 0 a lady, 1 a lord, 2 the Phantom King as he was, crowned. */
  const portrait = (who) => PixelArt.make(38, 50, (p) => {
    p.rect(0, 0, 38, 50, G[1]);
    p.rect(0, 0, 38, 2, G[2]);
    p.rect(0, 0, 2, 50, G[2]);
    p.rect(36, 0, 2, 50, G[0]);
    p.rect(0, 48, 38, 2, G[0]);
    for (const [x, y] of [[1, 1], [34, 1], [1, 46], [34, 46]]) p.rect(x, y, 3, 3, G[3]);
    p.rect(4, 4, 30, 42, '#141018');
    p.rect(4, 4, 30, 14, '#1c1620');
    const skin = '#d8cab8';
    const coat = [['#1e3a2a', '#2a5a3a'], ['#1a1424', '#2a2034'], ['#2a1a3a', '#4a2e5e']][who];
    // shoulders and coat
    p.round(8, 32, 22, 16, coat[0], 6);
    p.rect(12, 34, 14, 2, coat[1]);
    if (who === 1) p.line(10, 34, 26, 46, '#7a1e2a', 2);   // his crimson sash
    if (who === 0) { p.round(10, 4, 18, 14, '#3a2418', 6); p.rect(9, 14, 3, 16, '#3a2418'); p.rect(26, 14, 3, 16, '#3a2418'); }   // her hair, up and down
    if (who === 2) { p.rect(12, 8, 14, 4, G[2]); for (const x of [12, 17, 22]) p.rect(x, 5, 3, 3, G[2]); p.px(18, 6, '#c03048'); }   // a crown
    // the face
    p.round(13, 12, 12, 16, skin, 4);
    p.rect(13, 12, 3, 14, '#b8a898');
    p.rect(15, 18, 2, 2, '#1a1020');
    p.rect(21, 18, 2, 2, '#1a1020');
    p.px(16, 18, '#ffffff');
    p.px(22, 18, '#ffffff');
    if (who === 1) p.round(14, 23, 10, 6, '#8a8a92', 3);   // a grey beard
    else p.rect(17, 24, 4, 1, '#8a5a5a');
    if (who === 2) p.round(14, 23, 10, 6, '#ece6f0', 3);
    // a crack across the varnish
    p.line(28, 6, 32, 14, '#2a2430');
  }, OUTLINE);

  /** A tall arched window, black-framed, cold moonlight in the glass, tattered curtains either side. */
  const windowTall = PixelArt.make(44, 62, (p) => {
    p.round(4, 0, 36, 60, W[1], 16);
    p.round(6, 2, 32, 56, W[3], 14);
    p.round(8, 4, 28, 52, C.glass[1], 12);
    for (let y = 4; y < 56; y += 2) p.rect(9, y, 26, 1, y < 22 ? C.glass[2] : C.glass[1]);
    p.rect(21, 4, 2, 52, W[2]);
    for (const y of [20, 36]) p.rect(8, y, 28, 2, W[2]);
    p.line(11, 14, 16, 8, C.glass[4]);
    p.px(30, 26, C.glass[3]);
    p.rect(2, 56, 40, 4, S[2]);   // the sill
    p.rect(2, 56, 40, 1, S[4]);
    for (const x of [0, 36]) {
      p.rect(x, 2, 8, 50, C.curtain[1]);
      p.rect(x + (x ? 5 : 0), 2, 3, 50, C.curtain[2]);
      for (let i = 0; i < 8; i += 3) p.rect(x + i, 52 + (i % 2) * 2, 2, 3, C.curtain[0]);
    }
  }, OUTLINE);

  /** A cobweb strung across a corner (top left; flip it for the top right). */
  const cobweb = PixelArt.make(30, 30, (p) => {
    const silk = 'rgba(214, 222, 232, 0.55)';
    for (const [ex, ey] of [[29, 0], [26, 12], [18, 22], [8, 28], [0, 29]]) p.line(0, 0, ex, ey, silk);
    for (const r of [8, 15, 22]) {
      let prev = null;
      for (let a = 0; a <= 90; a += 18) {
        const t = (a / 180) * Math.PI;
        const pt = [Math.round(Math.cos(t) * r), Math.round(Math.sin(t) * r)];
        if (prev) p.line(prev[0], prev[1], pt[0], pt[1], silk);
        prev = pt;
      }
    }
  }, null);

  /**
   * One of the household's phantoms (40x56, anchored at the tip of its tail, facing right):
   * a pale see-through figure with hollow eyes whose hem trails off into wisps. kind: 0 a maid
   * with a bonnet and duster, 1 the butler with a tray and teacup, 2 a lady in a long gown.
   * wave 0-3 ripples the tail.
   */
  const phantom = (kind, wave) => PixelArt.bevel(PixelArt.make(40, 56, (p) => {
    const Gh = C.ghost;
    // the tail trailing off into wisps
    for (let i = 0; i < 4; i++) {
      const x0 = 12 + i * 4;
      const len = 6 + ((i + wave) % 3) * 3;
      p.poly([[x0, 40], [x0 + 5, 40], [x0 + 2 + (i % 2 ? 1 : -1), 40 + len]], i % 2 ? Gh[2] : Gh[1]);
    }
    // the body
    const flare = kind === 2 ? 4 : 0;
    p.poly([[14, 20], [26, 20], [29 + flare, 41], [11 - flare, 41]], Gh[2]);
    p.poly([[14, 20], [17, 20], [13 - flare, 41], [11 - flare, 41]], Gh[1]);
    p.line(24, 22, 27 + flare, 40, Gh[3]);
    if (kind === 0) { p.rect(15, 26, 10, 12, Gh[3]); p.rect(15, 26, 10, 1, Gh[4]); }   // her apron
    if (kind === 1) { p.poly([[18, 20], [22, 20], [20, 26]], Gh[1]); p.rect(18, 20, 4, 2, '#3a5a6a'); }   // his waistcoat and bowtie
    if (kind === 2) for (let y = 28; y < 40; y += 4) p.line(16 - (y - 28) / 4, y, 24 + (y - 28) / 4, y, Gh[3]);   // the gown's flounces
    // the head
    p.circle(20, 13, 8, Gh[2]);
    p.circle(19, 12, 6, Gh[3]);
    p.px(16, 9, Gh[4]);
    if (kind === 0) { p.ellipse(19, 6, 9, 3, Gh[3]); p.rect(11, 6, 3, 6, Gh[3]); }   // the bonnet
    if (kind === 2) { p.circle(15, 7, 4, Gh[1]); p.circle(15, 6, 2, Gh[2]); }   // her hair, up in a bun
    if (kind === 1) p.rect(14, 5, 12, 2, Gh[1]);   // slicked hair
    // hollow eyes and a sad little mouth
    p.rect(21, 11, 2, 3, '#1e3a4a');
    p.rect(25, 11, 2, 3, '#1e3a4a');
    p.rect(23, 17, 2, 1, '#2e5a6a');
    // an arm reaching forward: a feather duster, a tray with a teacup, or a held-out hand
    p.poly([[23, 22], [31, 25], [31, 29], [23, 27]], Gh[2]);
    if (kind === 0) { p.line(31, 26, 37, 20, Gh[1]); p.circle(37, 18, 3, Gh[3]); }
    if (kind === 1) { p.rect(27, 23, 12, 2, Gh[3]); p.rect(31, 19, 5, 4, Gh[4]); p.px(36, 20, Gh[3]); }
    if (kind === 2) p.round(31, 25, 4, 4, Gh[3], 1);
  }, OUTLINE));

  Sprites.manor = {
    stairs,
    chandelier,
    sheetChair: sheeted(false),
    sheetSofa: sheeted(true),
    portraits: [0, 1, 2].map(portrait),
    window: windowTall,
    cobweb,
    phantoms: [0, 1, 2].map((k) => [0, 1, 2, 3].map((w) => phantom(k, w))),
  };
}
