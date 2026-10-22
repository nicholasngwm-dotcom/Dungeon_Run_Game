// The castle dungeon: a fallen empire's keep gone dark and corrupt. Cold slate
// flagstones split by faintly glowing violet veins, tattered crimson runners down the
// hallways, damp stone walls hung with torn banners and black thorny vines, and the
// two boss rooms: the Queen's moonlit garden and the King's marble throne room.
// Same rules as the other tile painters: one 32x32 tile at (x, y), seeded rng.

const CASTLE_COLORS = {
  flag: ['#3a3644', '#3e3a49', '#36323f', '#423d4c'], flagL: '#565068', flagD: '#26222e', grout: '#18141e',
  vein: '#4a2a6e', veinL: '#8a5ad0', veinGlow: '#c49aff',
  blood: '#3e0e16', bloodL: '#5a1620',
  carpet: ['#5a1420', '#62162a', '#54121e'], carpetL: '#7e2236', carpetD: '#3a0a14', trim: '#9a7a34', trimD: '#5e4a1e',
  brick: '#3c3748', brickAlt: '#36313f', brickL: '#565068', mortar: '#15111b', rim: '#6c6484',
  top: '#1a1622', topL: '#24202e', topRim: '#4a4258',
  thorn: '#120c16', thornL: '#2a1e30', thornTip: '#9a6ad8',
  banner: ['#3a0c18', '#5a1424', '#7a1e30'],
  // the Queen's garden at night
  grass: ['#26382a', '#283b2c', '#243528', '#2a3e2e'], blade: '#3e5a40', bladeL: '#5a7a52', bladeD: '#18261a',
  gravel: ['#57525e', '#5e5966', '#514c58'], gravelL: '#7a7484', gravelD: '#3a3640',
  hedge: ['#0c140e', '#122016', '#1a2e1e', '#264228', '#365a36'],
  rose: ['#5a0e1e', '#8a1a30', '#c03048', '#ff6a80'],
  // the King's throne room
  marble: ['#24202c', '#8e8698'], marbleD: ['#18151e', '#6e6678'], marbleL: ['#322c3c', '#aaa2b4'],
  gold: ['#4a3410', '#8a6a24', '#c8a040', '#f0d88a'],
  glass: ['#2a0e3a', '#5a1a6a', '#8a2a5a', '#3a2a8a'],
};

const CastleTiles = {
  /** Cold slate flagstones, some cracked through with faintly glowing violet veins, the odd old bloodstain. */
  floor(p, x, y, rng) {
    const C = CASTLE_COLORS;
    p.rect(x, y, 32, 32, C.grout);
    const slabs = rng() < 0.5 ? [[0, 0, 15, 15], [16, 0, 16, 15], [0, 16, 20, 16], [21, 16, 11, 16]]
      : [[0, 0, 20, 15], [21, 0, 11, 15], [0, 16, 15, 16], [16, 16, 16, 16]];
    for (const [sx, sy, w, h] of slabs) {
      p.round(x + sx, y + sy, w - 1, h - 1, C.flag[Math.floor(rng() * C.flag.length)], 2);
      p.rect(x + sx + 2, y + sy, w - 5, 1, C.flagL);
      p.rect(x + sx, y + sy + 2, 1, h - 5, C.flagL);
      p.rect(x + sx + 2, y + sy + h - 2, w - 5, 1, C.flagD);
      p.rect(x + sx + w - 2, y + sy + 2, 1, h - 5, C.flagD);
      if (rng() < 0.25) p.rect(x + sx + 3, y + sy + 3, 3, 1, C.flagL);
      if (rng() < 0.12) p.line(x + sx + 3, y + sy + 4, x + sx + 3 + Math.floor(rng() * (w - 6)), y + sy + h - 4, C.flagD);
    }
    if (rng() < 0.07) {
      // a crack of corruption: a dark split with violet light in it
      let cx = x + 4 + Math.floor(rng() * 10);
      let cy = y + 2 + Math.floor(rng() * 6);
      for (let i = 0; i < 9; i++) {
        const nx = cx + 1 + Math.floor(rng() * 3);
        const ny = cy + 1 + Math.floor(rng() * 3) - 1;
        p.line(cx, cy, nx, ny, C.vein);
        if (i % 2) p.px(cx, cy, C.veinL);
        cx = nx; cy = Math.min(y + 30, Math.max(y + 1, ny + 1));
        if (cx > x + 30) break;
      }
      p.px(cx, cy, C.veinGlow);
    }
    if (rng() < 0.04) {
      // an old dark stain
      const bx = x + 6 + Math.floor(rng() * 16);
      const by = y + 8 + Math.floor(rng() * 14);
      p.ellipse(bx, by, 5, 3, C.blood);
      p.ellipse(bx - 1, by - 1, 2, 1, C.bloodL);
      p.px(bx + 6, by + 2, C.blood);
    }
    if (rng() < 0.05) {
      // rubble fallen from the walls
      const rx = x + 4 + Math.floor(rng() * 22);
      const ry = y + 6 + Math.floor(rng() * 20);
      p.rect(rx, ry, 3, 2, C.flagL);
      p.px(rx + 4, ry + 1, C.flag[2]);
      p.px(rx + 1, ry + 2, C.flagD);
    }
  },

  /**
   * Hallways: stone flags under a tattered crimson runner with a tarnished gold border.
   * along: true = the hall runs left to right; off = tiles from the hall's centre line (-2..2).
   */
  hall(p, x, y, rng, along, off) {
    const C = CASTLE_COLORS;
    this.floor(p, x, y, rng);
    if (Math.abs(off) > 1) return;
    // the runner covers the middle three tiles; its gold border on the outer edge
    const fill = (rx, ry, w, h, c) => (along ? p.rect(x + rx, y + ry, w, h, c) : p.rect(x + ry, y + rx, h, w, c));
    fill(0, 0, 32, 32, C.carpet[Math.floor(rng() * C.carpet.length)]);
    for (let i = 0; i < 6; i++) fill(Math.floor(rng() * 30), Math.floor(rng() * 30), 2, 1, rng() < 0.5 ? C.carpetL : C.carpetD);
    if (off !== 0) {
      const edge = off < 0 ? 0 : 28;
      fill(0, edge, 32, 4, C.carpetD);
      fill(0, off < 0 ? 2 : 28, 32, 2, C.trim);
      fill(0, off < 0 ? 3 : 28, 32, 1, C.trimD);
      // frayed edge
      for (let i = 0; i < 32; i += 3) if (rng() < 0.4) fill(i, off < 0 ? 0 : 31, 2, 1, C.grout);
    } else {
      // a faded diamond pattern down the middle
      for (let i = 4; i < 32; i += 16) {
        fill(i + 3, 15, 2, 2, C.trim);
        fill(i + 1, 15, 1, 2, C.trimD);
        fill(i + 6, 15, 1, 2, C.trimD);
      }
    }
    if (rng() < 0.12) {
      // a hole worn through to the stone
      const hx = 6 + Math.floor(rng() * 18);
      const hy = 6 + Math.floor(rng() * 18);
      fill(hx, hy, 5, 4, C.flag[1]);
      fill(hx, hy, 5, 1, C.carpetD);
    }
  },

  /** Damp dark stone wall. row 0 = upper half (with the cap), 1 = lower. Thorny black vines creep over some of it. */
  wallFace(p, x, y, row, rng) {
    const C = CASTLE_COLORS;
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
        if (rng() < 0.12) p.px(left + 2 + Math.floor(rng() * Math.max(1, right - left - 4)), by + 3, C.mortar);
      }
    }
    if (row === 0) {
      p.rect(x, y, 32, 3, C.rim);
      p.rect(x, y + 3, 32, 1, C.mortar);
    }
    if (rng() < 0.22) this.thorns(p, x, y, rng);
    if (row === 1) {
      p.rect(x, y + 27, 32, 5, '#110d16');   // damp foot of the wall
      p.rect(x, y + 27, 32, 1, C.brickAlt);
    }
  },

  /** Black thorny vines creeping down a wall, a few thorns catching violet light. */
  thorns(p, x, y, rng) {
    const C = CASTLE_COLORS;
    let vx = x + 3 + Math.floor(rng() * 26);
    for (let vy = y; vy < y + 28; vy += 2) {
      vx += Math.floor(rng() * 3) - 1;
      p.rect(vx, vy, 2, 2, C.thorn);
      if (rng() < 0.35) { p.px(vx + 2, vy, C.thornL); p.px(vx + 3, vy - 1, C.thornTip); }
      if (rng() < 0.25) { p.px(vx - 1, vy + 1, C.thornL); p.px(vx - 2, vy, C.thornTip); }
    }
  },

  /** A narrow arrow slit with a faint violet glow inside (wall face, upper row). */
  slit(p, x, y) {
    p.rect(x + 13, y + 6, 6, 22, CASTLE_COLORS.mortar);
    p.round(x + 13, y + 4, 6, 6, CASTLE_COLORS.mortar, 3);
    p.rect(x + 14, y + 8, 4, 19, '#1e0e2e');
    p.rect(x + 15, y + 12, 2, 12, '#3a1e5a');
    p.px(x + 15, y + 14, '#8a5ad0');
    p.rect(x + 12, y + 28, 8, 2, CASTLE_COLORS.rim);
  },

  /** A torn crimson banner hanging from the wall cap (two tiles tall: drawn from the upper tile). */
  banner(p, x, y, rng) {
    const C = CASTLE_COLORS;
    p.rect(x + 5, y + 4, 22, 2, '#2a2018');
    p.rect(x + 4, y + 4, 2, 2, C.gold[2]);
    p.rect(x + 26, y + 4, 2, 2, C.gold[2]);
    p.rect(x + 8, y + 6, 16, 40, C.banner[1]);
    p.rect(x + 8, y + 6, 3, 40, C.banner[0]);
    p.rect(x + 21, y + 6, 3, 40, C.banner[2]);
    p.rect(x + 8, y + 9, 16, 1, C.gold[1]);
    // the empire's crest, defaced: a crown with a slash through it
    p.rect(x + 12, y + 18, 8, 4, C.gold[1]);
    p.px(x + 12, y + 17, C.gold[1]); p.px(x + 15, y + 16, C.gold[2]); p.px(x + 19, y + 17, C.gold[1]);
    p.line(x + 10, y + 27, x + 22, y + 14, C.banner[0]);
    // a ragged torn hem
    for (let i = 0; i < 16; i += 2) {
      const len = 2 + Math.floor(rng() * 6);
      p.rect(x + 8 + i, y + 46, 2, len, C.banner[i < 4 ? 0 : 1]);
    }
    p.rect(x + 14, y + 36, 3, 6, C.mortar);   // a rip
  },

  /** The dark masonry between rooms: rough stone in shadow, lit along any side facing floor. */
  wallTop(p, x, y, rng, edges) {
    const C = CASTLE_COLORS;
    p.rect(x, y, 32, 32, C.top);
    for (let i = 0; i < 4; i++) {
      const sx = x + Math.floor(rng() * 26);
      const sy = y + Math.floor(rng() * 28);
      p.rect(sx, sy, 6, 3, C.topL);
      p.rect(sx, sy, 6, 1, '#2c2738');
    }
    if (rng() < 0.08) p.px(x + 4 + Math.floor(rng() * 24), y + 4 + Math.floor(rng() * 24), '#3a2a50');
    if (edges.left) { p.rect(x, y, 2, 32, C.topRim); p.rect(x + 2, y, 1, 32, '#0c0a10'); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, C.topRim); p.rect(x + 29, y, 1, 32, '#0c0a10'); }
    if (edges.up) { p.rect(x, y, 32, 2, C.topRim); }
  },

  // ---------- the Queen's garden ----------

  /** Night-dark lawn with clover, pale moon-flowers and the odd fallen rose petal. */
  gardenGrass(p, x, y, rng) {
    const C = CASTLE_COLORS;
    p.rect(x, y, 32, 32, C.grass[Math.floor(rng() * C.grass.length)]);
    for (let i = 0; i < 3; i++) {
      p.ellipse(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), 4 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 3), rng() < 0.5 ? '#223326' : '#2c4230');
    }
    for (let i = 0; i < 11; i++) p.rect(x + Math.floor(rng() * 30), y + Math.floor(rng() * 30), 1, 2, rng() < 0.55 ? C.blade : C.bladeD);
    if (rng() < 0.12) {
      const cx = x + 5 + Math.floor(rng() * 20);
      const cy = y + 5 + Math.floor(rng() * 20);
      for (const [dx, dy] of [[0, 0], [2, 0], [1, -1], [1, 1]]) p.px(cx + dx, cy + dy, C.bladeL);
    }
    if (rng() < 0.08) {
      const fx = x + 4 + Math.floor(rng() * 22);
      const fy = y + 4 + Math.floor(rng() * 22);
      p.px(fx, fy, '#e8e4f0'); p.px(fx + 1, fy, '#e8e4f0'); p.px(fx, fy + 1, '#d8d0f0'); p.px(fx + 1, fy + 1, '#a890d8');
    }
    if (rng() < 0.1) {
      const rx = x + 4 + Math.floor(rng() * 22);
      const ry = y + 4 + Math.floor(rng() * 22);
      p.rect(rx, ry, 2, 1, C.rose[2]);
      p.px(rx + 1, ry + 1, C.rose[1]);
    }
  },

  /** Pale raked gravel for the garden paths. */
  gravel(p, x, y, rng) {
    const C = CASTLE_COLORS;
    p.rect(x, y, 32, 32, C.gravel[Math.floor(rng() * C.gravel.length)]);
    for (let i = 0; i < 26; i++) {
      p.px(x + Math.floor(rng() * 32), y + Math.floor(rng() * 32), rng() < 0.5 ? C.gravelL : C.gravelD);
    }
    for (let i = 0; i < 3; i++) {
      const px = x + Math.floor(rng() * 28);
      const py = y + Math.floor(rng() * 28);
      p.rect(px, py, 3, 2, C.gravelL);
      p.px(px + 1, py + 2, C.gravelD);
    }
  },

  /** The garden's walls: a tall clipped hedge studded with dark roses. row 0 upper, 1 lower (its shaded foot). */
  hedgeFace(p, x, y, row, rng) {
    const C = CASTLE_COLORS;
    const G = C.hedge;
    p.rect(x, y, 32, 32, G[1]);
    for (let i = 0; i < 7; i++) {
      const cx = x + 3 + Math.floor(rng() * 26);
      const cy = y + 3 + Math.floor(rng() * 26);
      const r = 4 + Math.floor(rng() * 3);
      p.circle(cx, cy, r, G[2]);
      p.circle(cx - 1, cy - 1, r - 2, G[3]);
      p.px(cx - 2, cy - 2, G[4]);
    }
    if (row === 0) { p.rect(x, y, 32, 3, G[4]); p.rect(x, y + 3, 32, 1, G[3]); }
    for (let i = 0; i < 3; i++) {
      if (rng() < 0.45) continue;
      const rx = x + 3 + Math.floor(rng() * 25);
      const ry = y + 4 + Math.floor(rng() * 22);
      p.circle(rx, ry, 2, C.rose[1]);
      p.px(rx - 1, ry - 1, C.rose[3]);
      p.px(rx, ry, C.rose[2]);
    }
    if (row === 1) {
      p.rect(x, y + 24, 32, 8, G[0]);
      for (let i = 0; i < 4; i++) p.circle(x + 4 + i * 8, y + 24, 4, G[2]);
      p.rect(x, y + 30, 32, 2, '#060a08');
    }
  },

  /** Hedge seen from above (filling between rooms around the garden). */
  hedgeTop(p, x, y, rng, edges) {
    const G = CASTLE_COLORS.hedge;
    p.rect(x, y, 32, 32, G[1]);
    for (let i = 0; i < 6; i++) {
      const cx = x + 4 + Math.floor(rng() * 24);
      const cy = y + 4 + Math.floor(rng() * 24);
      const r = 5 + Math.floor(rng() * 4);
      p.circle(cx, cy, r, G[2]);
      p.circle(cx - 1, cy - 1, r - 2, G[3]);
    }
    if (edges.left) { p.rect(x, y, 2, 32, G[0]); p.rect(x + 2, y, 1, 32, G[4]); }
    if (edges.right) { p.rect(x + 30, y, 2, 32, G[0]); p.rect(x + 29, y, 1, 32, G[4]); }
    if (edges.up) { p.rect(x, y, 32, 2, G[4]); }
  },

  // ---------- the King's throne room ----------

  /** Polished black-and-ivory marble checker, veined, with soft reflections. */
  marble(p, x, y, rng, tx, ty) {
    const C = CASTLE_COLORS;
    const k = (tx + ty) % 2;
    p.rect(x, y, 32, 32, C.marble[k]);
    p.rect(x, y, 32, 1, C.marbleL[k]);
    p.rect(x, y, 1, 32, C.marbleL[k]);
    p.rect(x, y + 31, 32, 1, C.marbleD[k]);
    p.rect(x + 31, y, 1, 32, C.marbleD[k]);
    // a vein wandering across
    let vx = x + Math.floor(rng() * 32);
    let vy = y;
    for (let i = 0; i < 14; i++) {
      p.px(vx, vy, C.marbleD[k]);
      vx += Math.floor(rng() * 3) - 1;
      vy += 2 + Math.floor(rng() * 2);
      if (vy > y + 31 || vx < x || vx > x + 31) break;
    }
    // a soft sheen
    p.ctx.fillStyle = k ? 'rgba(255, 255, 255, 0.12)' : 'rgba(160, 130, 200, 0.06)';
    p.ctx.fillRect(x + 4, y + 4, 10, 2);
  },

  /** The red carpet up to the throne. off: tiles from its centre line (-2..2; 2 = past its gold edge). */
  throneCarpet(p, x, y, rng, off) {
    const C = CASTLE_COLORS;
    p.rect(x, y, 32, 32, C.carpet[0]);
    for (let i = 0; i < 5; i++) p.rect(x + Math.floor(rng() * 30), y + Math.floor(rng() * 30), 2, 1, C.carpetL);
    if (off === 0) {
      // gold medallions down the middle
      if ((y / 32) % 2 === 0) {
        p.poly([[x + 16, y + 8], [x + 24, y + 16], [x + 16, y + 24], [x + 8, y + 16]], C.gold[1]);
        p.poly([[x + 16, y + 11], [x + 21, y + 16], [x + 16, y + 21], [x + 11, y + 16]], C.carpetD);
        p.rect(x + 15, y + 15, 2, 2, C.gold[2]);
      }
    } else {
      const ex = off < 0 ? x : x + 26;
      p.rect(ex, y, 6, 32, C.carpetD);
      p.rect(off < 0 ? x + 2 : x + 27, y, 3, 32, C.gold[2]);
      p.rect(off < 0 ? x + 2 : x + 29, y, 1, 32, C.gold[3]);
      for (let i = 2; i < 32; i += 6) p.rect(off < 0 ? x : x + 31, y + i, 1, 3, C.gold[1]);   // fringe
    }
  },

  /** The throne room's walls: dark stone between gilded pilasters. */
  royalWall(p, x, y, row, rng, tx) {
    const C = CASTLE_COLORS;
    this.wallFace(p, x, y, row, rng);
    if (tx % 4 === 0) {
      // a gilded pilaster
      p.rect(x + 10, y, 12, 32, '#2a2534');
      p.rect(x + 11, y, 2, 32, '#433c52');
      p.rect(x + 20, y, 2, 32, '#18141e');
      p.rect(x + 10, y + (row === 0 ? 4 : 26), 12, 2, C.gold[2]);
      p.rect(x + 10, y + (row === 0 ? 4 : 26), 12, 1, C.gold[3]);
    }
    if (row === 0) { p.rect(x, y, 32, 3, C.gold[1]); p.rect(x, y, 32, 1, C.gold[2]); }
  },

  /** A tall stained-glass window in violet and crimson (drawn from the upper wall tile, two tiles tall). */
  stainedGlass(p, x, y) {
    const C = CASTLE_COLORS;
    p.round(x + 6, y + 2, 20, 52, C.gold[1], 9);
    p.round(x + 8, y + 4, 16, 48, '#0e0812', 7);
    const panes = [[9, 10, 6, 10], [17, 10, 6, 10], [9, 22, 6, 12], [17, 22, 6, 12], [9, 36, 6, 12], [17, 36, 6, 12]];
    panes.forEach(([px, py, w, h], i) => {
      p.rect(x + px, y + py, w, h, C.glass[i % C.glass.length]);
      p.px(x + px + 1, y + py + 1, '#c08ad8');
    });
    p.round(x + 11, y + 5, 10, 6, C.glass[1], 4);
    p.px(x + 15, y + 7, '#ffd0f0');
    p.rect(x + 15, y + 4, 2, 48, '#0e0812');
    p.rect(x + 4, y + 52, 24, 3, C.gold[2]);
    p.rect(x + 4, y + 52, 24, 1, C.gold[3]);
  },
};
