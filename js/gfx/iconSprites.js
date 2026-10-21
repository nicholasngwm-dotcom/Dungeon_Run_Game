// 28x28 ability icons for the HUD, one set per class (keyed by ability slot)
// plus the shared dodge icon. Painted with the same PixelArt toolkit.

function buildIconSprites() {
  const S = RAMP.steel;
  const L = RAMP.leather;
  const G = RAMP.gold;
  const R = RAMP.red;
  const B = CUTE.brass;
  const TEAL = ['#0e3a3a', '#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'];   // the mage's magic
  const FLETCH = '#c84040';                                               // the archer's red fletching
  const DAGGER = { w: 1.5, grip: 4, guard: 3, guardCol: B[2], gripCol: '#9a2230' };
  const N = 28;
  const icon = (fn) => PixelArt.make(N, N, fn, OUTLINE);

  /** Sword/dagger from the pommel (x0, y0) to the tip (x1, y1). */
  const blade = (p, x0, y0, x1, y1, { w = 2, grip = 5, guard = 4, ramp = S, guardCol = G[2], gripCol = L[2] } = {}) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const gx = x0 + ux * grip;
    const gy = y0 + uy * grip;
    p.line(x0, y0, gx, gy, gripCol, 2);
    const bx = gx + ux;
    const by = gy + uy;
    p.poly([
      [bx + nx * w, by + ny * w], [x1 - ux * w * 2 + nx * w, y1 - uy * w * 2 + ny * w], [x1, y1],
      [x1 - ux * w * 2 - nx * w, y1 - uy * w * 2 - ny * w], [bx - nx * w, by - ny * w],
    ], ramp[3]);
    p.line(bx + nx * 0.5, by + ny * 0.5, x1 - ux * w * 2, y1 - uy * w * 2, ramp[5], 1);
    p.line(gx - nx * guard, gy - ny * guard, gx + nx * guard, gy + ny * guard, guardCol, 2);
  };

  /** Arrow from the fletching (x0, y0) to the head at (x1, y1). */
  const arrow = (p, x0, y0, x1, y1, { head = S[4], shaft = L[4], fletch = '#efe6d2' } = {}) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    p.line(x0, y0, x1, y1, shaft, 2);
    p.poly([
      [x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4],
      [x1 + Math.cos(a + 2.3) * 5, y1 + Math.sin(a + 2.3) * 5],
      [x1 + Math.cos(a - 2.3) * 5, y1 + Math.sin(a - 2.3) * 5],
    ], head);
    for (const s of [2.6, -2.6]) p.line(x0, y0, x0 + Math.cos(a + s) * 4, y0 + Math.sin(a + s) * 4, fletch, 2);
  };

  /** Dotted pixel ring, optionally only between two angles. */
  const ring = (p, cx, cy, r, color, from = 0, to = TAU, size = 2) => {
    for (let a = from; a < to; a += 0.12) p.rect(cx + Math.cos(a) * r - size / 2, cy + Math.sin(a) * r - size / 2, size, size, color);
  };

  const FIRE = ['#e0461e', '#ff8a1e', '#ffd34a'];
  const FROSTFIRE = ['#1f7a72', '#3fc2a8', '#f0fff8'];
  const flame = (p, cx, cy, r, cols = FIRE) => {
    p.poly([[cx - r, cy], [cx - r * 0.4, cy - r * 1.6], [cx, cy - r * 0.8], [cx + r * 0.5, cy - r * 2], [cx + r, cy]], cols[0]);
    p.circle(cx, cy, r, cols[0]);
    p.circle(cx, cy, r * 0.65, cols[1]);
    p.circle(cx, cy + 1, r * 0.3, cols[2]);
  };

  const snowflake = (p, cx, cy, r, color = '#e6f6ff') => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      p.line(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r, color, 1);
    }
    p.px(cx, cy, '#ffffff');
  };

  /** The knight's red kite shield with its steel cross and ruby, offset by (dx, dy). */
  const kite = (p, dx, dy, s = 1) => {
    const pt = (pts) => pts.map(([x, y]) => [dx + x * s, dy + y * s]);
    p.poly(pt([[0, 0], [16, 0], [16, 9], [12, 17], [8, 21], [4, 17], [0, 9]]), S[3]);
    p.poly(pt([[2, 2], [14, 2], [14, 9], [11, 15], [8, 18], [5, 15], [2, 9]]), R[3]);
    p.poly(pt([[8, 2], [14, 2], [14, 9], [11, 15], [8, 18]]), R[2]);
    p.rect(dx + 7 * s, dy + 3 * s, 2 * s, 14 * s, S[5]);
    p.rect(dx + 3 * s, dy + 6 * s, 10 * s, 2 * s, S[5]);
    p.rect(dx + 7 * s, dy + 6 * s, 2 * s, 2 * s, '#d0303a');
    p.rect(dx + 1 * s, dy, 6 * s, 1, S[5]);
  };

  Sprites.icons = {
    warrior: {
      primary: icon((p) => blade(p, 4, 24, 24, 4, { w: 2, grip: 5, guard: 4, guardCol: B[2], gripCol: R[2] })),
      // shield wall: the knight's kite shield before panels of steel light
      secondary: icon((p) => {
        for (const x of [2, 6, 21, 25]) p.rect(x, 4, 2, 20, 'rgba(173, 178, 192, 0.6)');
        p.rect(2, 3, 25, 1, S[5]);
        p.rect(2, 24, 25, 1, S[5]);
        kite(p, 6, 4);
      }),
      e: icon((p) => {
        ring(p, 14, 14, 11, S[4], 0.3, 2.6);
        ring(p, 14, 14, 11, S[4], 3.4, 5.8);
        p.poly([[24, 8], [26, 14], [21, 12]], S[5]);
        p.poly([[4, 20], [2, 14], [7, 16]], S[5]);
        blade(p, 7, 14, 22, 14, { w: 1, grip: 3, guard: 3 });
      }),
      f: icon((p) => {
        p.poly([[8, 6], [20, 14], [8, 22], [12, 14]], S[3]);
        p.poly([[8, 6], [20, 14], [12, 14]], S[4]);
        p.poly([[14, 6], [26, 14], [14, 22], [18, 14]], R[3]);
        p.poly([[14, 6], [26, 14], [18, 14]], R[4]);
        for (const y of [9, 14, 19]) p.rect(1, y, 5, 1, '#c9d3dd');
      }),
      q: icon((p) => {
        for (let i = 0; i < 3; i++) p.rect(5 + i * 8, 2 + (i % 2) * 3, 1, 4, G[3]);
        blade(p, 14, 2, 14, 26, { w: 3, grip: 5, guard: 6, ramp: ['', '', '', G[2], '', G[3]], guardCol: S[4] });
      }),
      // shield bash: the kite shield lunging forward into an impact
      bash: icon((p) => {
        for (const y of [8, 14, 20]) p.rect(1, y, 5, 1, '#c9d3dd');
        kite(p, 5, 4);
        // impact star
        p.poly([[23, 8], [24, 12], [27, 13], [24, 15], [23, 19], [22, 15], [19, 14], [22, 12]], G[3]);
        p.px(23, 13, '#ffffff');
      }),
    },
    ranger: {
      primary: icon((p) => arrow(p, 4, 24, 21, 7, { fletch: FLETCH })),
      // camo leaf
      secondary: icon((p) => {
        p.poly([[4, 24], [6, 10], [14, 3], [24, 4], [22, 14], [14, 22]], '#4f6a45');
        p.poly([[6, 22], [8, 11], [14, 5], [22, 6], [20, 13], [13, 20]], '#88a446');
        p.line(4, 24, 20, 8, '#3a5030', 1);
        p.line(11, 16, 11, 10, '#3a5030', 1);
        p.line(15, 12, 20, 12, '#3a5030', 1);
      }),
      e: icon((p) => {
        arrow(p, 3, 18, 19, 4, { head: '#a8cc6a', fletch: FLETCH });
        arrow(p, 8, 25, 24, 11, { head: '#a8cc6a', fletch: FLETCH });
      }),
      // fire arrow over ice arrow
      f: icon((p) => {
        arrow(p, 3, 11, 19, 3, { head: '#ff8a1e', shaft: L[4], fletch: '#ffd34a' });
        flame(p, 22, 6, 3);
        arrow(p, 3, 25, 19, 17, { head: '#9ad0ff', shaft: L[4], fletch: '#e6f6ff' });
        snowflake(p, 23, 19, 4);
      }),
      // arrow volley
      q: icon((p) => {
        arrow(p, 7, 2, 7, 18, { fletch: FLETCH });
        arrow(p, 14, 6, 14, 22, { fletch: FLETCH });
        arrow(p, 21, 2, 21, 18, { fletch: FLETCH });
      }),
    },
    mage: {
      // magic missile: a teal star trailing sparkles
      primary: icon((p) => {
        for (let i = 0; i < 4; i++) p.rect(4 + i * 3, 21 - i * 3, 2, 2, i % 2 ? TEAL[3] : TEAL[2]);
        p.poly([[18, 2], [20, 8], [26, 10], [20, 12], [18, 18], [16, 12], [10, 10], [16, 8]], TEAL[1]);
        p.poly([[18, 4], [19, 9], [24, 10], [19, 11], [18, 16], [17, 11], [12, 10], [17, 9]], TEAL[2]);
        p.rect(17, 8, 3, 5, TEAL[3]);
        p.rect(16, 9, 5, 3, TEAL[3]);
        p.rect(17, 9, 2, 2, '#ffffff');
      }),
      secondary: icon((p) => {
        for (let i = 0; i < 3; i++) p.rect(3 + i * 3, 21 - i * 3, 3, 3, i ? TEAL[3] : TEAL[2]);
        flame(p, 16, 15, 7, FROSTFIRE);
      }),
      // teal lightning with a white-hot edge
      e: icon((p) => {
        p.poly([[16, 1], [6, 15], [13, 15], [9, 27], [22, 11], [15, 11], [20, 1]], TEAL[2]);
        p.poly([[16, 1], [8, 14], [13, 14], [18, 3]], TEAL[4]);
      }),
      // the bird-form sprite, enlarged
      f: icon((p) => p.ctx.drawImage(Sprites.items.birdFrames[0].img, 2, 5, 24, 18)),
      // the drain circle as seen on the floor: brass rim, teal rings, two turning squares
      q: icon((p) => {
        const ell = (rx, color, size = 1) => {
          for (let a = 0; a < TAU; a += 0.1) p.rect(14 + Math.cos(a) * rx - size / 2, 15 + Math.sin(a) * rx * 0.6 - size / 2, size, size, color);
        };
        p.ellipse(14, 15, 12, 7, TEAL[0]);
        ell(12, B[2], 2);
        ell(10, TEAL[2]);
        ell(5, TEAL[2]);
        for (const [off, col] of [[0, TEAL[2]], [Math.PI / 4, B[2]]]) {
          for (let i = 0; i < 4; i++) {
            const a = off + (i * TAU) / 4;
            const b = off + ((i + 1) * TAU) / 4;
            p.line(14 + Math.cos(a) * 10, 15 + Math.sin(a) * 6, 14 + Math.cos(b) * 10, 15 + Math.sin(b) * 6, col, 1);
          }
        }
        // drained life rising out of it
        p.rect(13, 3, 2, 4, TEAL[3]);
        p.rect(7, 6, 2, 3, TEAL[2]);
        p.rect(19, 5, 2, 3, TEAL[2]);
      }),
    },
    rogue: {
      primary: icon((p) => {
        blade(p, 14, 26, 14, 6, DAGGER);
        blade(p, 12, 26, 3, 9, DAGGER);
        blade(p, 16, 26, 25, 9, DAGGER);
      }),
      secondary: icon((p) => {
        for (const y of [8, 13, 18]) p.rect(1, y, 7 - Math.abs(y - 13) / 2, 1, '#c43a44');
        blade(p, 9, 20, 25, 6, DAGGER);
      }),
      e: icon((p) => {
        blade(p, 4, 24, 22, 6, DAGGER);
        blade(p, 24, 24, 6, 6, DAGGER);
        p.poly([[14, 8], [16, 13], [21, 14], [16, 15], [14, 20], [12, 15], [7, 14], [12, 13]], '#ffe680');
        p.rect(13, 13, 3, 3, '#ffffff');
      }),
      f: icon((p) => {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          const x = 14 + Math.cos(a) * 9;
          const y = 14 + Math.sin(a) * 9;
          blade(p, x - Math.cos(a + 1.6) * 5, y - Math.sin(a + 1.6) * 5, x + Math.cos(a + 1.6) * 5, y + Math.sin(a + 1.6) * 5, { w: 1, grip: 2, guard: 2 });
        }
        p.circle(14, 14, 2, '#f0c040');
      }),
      q: icon((p) => {
        // a red shadow clone behind the hooded rogue
        p.round(13, 4, 12, 12, '#6a1622', 3);
        p.round(12, 14, 14, 12, '#6a1622', 3);
        p.rect(16, 9, 2, 2, '#f0b030'); p.rect(21, 9, 2, 2, '#f0b030');
        p.round(3, 6, 12, 12, '#3e3e52', 3);
        p.round(2, 16, 14, 11, '#2c2c3a', 3);
        p.rect(5, 10, 8, 2, RAMP.skin[2]);
        p.rect(6, 10, 2, 1, '#f0b030'); p.rect(10, 10, 2, 1, '#f0b030');
        p.rect(4, 12, 10, 3, '#9a2230');
      }),
    },
    priestess: {
      // beam of light falling onto the floor
      primary: icon((p) => {
        p.rect(10, 1, 8, 20, '#d8a640');
        p.rect(11, 1, 6, 20, '#ffe680');
        p.rect(13, 1, 2, 20, '#ffffff');
        p.ellipse(14, 22, 10, 3, '#d8a640');
        p.ellipse(14, 22, 7, 2, '#fff6c8');
      }),
      // five homing light missiles
      secondary: icon((p) => {
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          const x = 14 + Math.cos(a) * 10;
          const y = 18 + Math.sin(a) * 10;
          p.line(14, 22, x, y, '#a07a24', 1);
          p.circle(x, y, 2, '#ffe680');
          p.px(x, y, '#ffffff');
        }
      }),
      // healing rune with a cross
      e: icon((p) => {
        p.ellipse(14, 18, 12, 7, '#1a4a2a');
        ring(p, 14, 14, 11, '#9cf0a0', 0, TAU, 1);
        p.rect(12, 6, 4, 16, '#6cff7a');
        p.rect(6, 12, 16, 4, '#6cff7a');
        p.rect(13, 7, 2, 14, '#c8ffd0');
        p.rect(7, 13, 14, 2, '#c8ffd0');
      }),
      // golden aegis bubble around a shield
      f: icon((p) => {
        ring(p, 14, 14, 12, '#ffe680', 0, TAU, 2);
        p.poly([[8, 7], [20, 7], [20, 15], [14, 22], [8, 15]], G[1]);
        p.poly([[9, 8], [19, 8], [19, 15], [14, 20], [9, 15]], G[2]);
        p.rect(13, 9, 2, 9, '#fff6c8');
        p.rect(10, 12, 8, 2, '#fff6c8');
      }),
      // radiant light bomb
      q: icon((p) => {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const r = i % 2 ? 9 : 13;
          p.line(14, 14, 14 + Math.cos(a) * r, 14 + Math.sin(a) * r, i % 2 ? G[2] : '#ffe680', 1);
        }
        p.circle(14, 14, 6, G[2]);
        p.circle(14, 14, 4, '#fff6c8');
        p.circle(13, 13, 2, '#ffffff');
      }),
    },
    bard: {
      // three notes fanning out of a lute string
      primary: icon((p) => {
        p.line(2, 25, 12, 15, '#c8823e', 2);
        p.ellipse(5, 23, 4, 3, '#9a5a2a');
        for (const [x, y] of [[13, 3], [18, 9], [12, 12]]) {
          p.ellipse(x, y + 6, 3, 2, '#ff8a3a');
          p.rect(x + 2, y, 1, 6, '#a8401e');
          p.px(x + 3, y + 1, '#ff8a3a');
        }
      }),
      // the two tunes: a fiery note and a cool one, with swap arrows
      secondary: icon((p) => {
        p.ellipse(7, 18, 4, 3, '#ff8a3a'); p.rect(10, 6, 2, 12, '#a8401e'); p.poly([[11, 6], [15, 9], [15, 12], [12, 10]], '#ff8a3a');
        p.ellipse(19, 21, 4, 3, '#5ac8e6'); p.rect(22, 9, 2, 12, '#1e5a7a'); p.poly([[23, 9], [27, 12], [27, 15], [24, 13]], '#5ac8e6');
        p.line(4, 4, 12, 2, '#efe6d2'); p.px(11, 1, '#efe6d2'); p.px(11, 3, '#efe6d2');
        p.line(16, 26, 24, 25, '#efe6d2'); p.px(17, 24, '#efe6d2'); p.px(17, 26, '#efe6d2');
      }),
      // moral support: a raised fist in a gold star burst with a note
      e: icon((p) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          p.line(14, 14, 14 + Math.cos(a) * 12, 14 + Math.sin(a) * 12, i % 2 ? G[1] : G[2], 1);
        }
        p.round(9, 9, 10, 9, RAMP.skin[2], 3);
        p.rect(10, 10, 8, 2, RAMP.skin[3]);
        p.rect(11, 17, 6, 7, '#e8dcc0');
        p.rect(19, 3, 2, 6, '#a8401e'); p.ellipse(18, 9, 2, 2, '#ff8a3a');
      }),
      // sleeping song: a crescent moon with z's
      f: icon((p) => {
        p.circle(11, 15, 9, '#c8b8ff');
        p.circle(15, 12, 8, '#1a1430');
        p.rect(16, 3, 6, 1, '#efe6d2'); p.line(21, 3, 16, 8, '#efe6d2'); p.rect(16, 8, 6, 1, '#efe6d2');
        p.rect(21, 13, 4, 1, '#c8b8ff'); p.line(24, 13, 21, 16, '#c8b8ff'); p.rect(21, 16, 4, 1, '#c8b8ff');
      }),
      // screeching tuning: a cracked note blasting out jagged sound waves
      q: icon((p) => {
        p.ellipse(6, 20, 4, 3, '#b04ae0'); p.rect(9, 6, 2, 14, '#5a1a6a'); p.poly([[10, 6], [14, 10], [14, 14], [11, 11]], '#b04ae0');
        for (const r of [6, 10, 14]) {
          const pts = [];
          for (let i = 0; i <= 6; i++) {
            const a = -0.9 + (i / 6) * 1.8;
            const rr = r + (i % 2 ? 1.5 : 0);
            pts.push([12 + Math.cos(a) * rr, 14 + Math.sin(a) * rr]);
          }
          for (let i = 1; i < pts.length; i++) p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r === 14 ? '#f0c8ff' : '#b04ae0');
        }
      }),
    },
    dodge: icon((p) => {
      p.poly([[6, 5], [14, 14], [6, 23], [9, 14]], '#c8c0b0');
      p.poly([[14, 5], [22, 14], [14, 23], [17, 14]], '#efe6d2');
      for (const y of [8, 20]) p.rect(1, y, 4, 1, '#8a8070');
      p.rect(23, 13, 4, 2, '#8a8070');
    }),
  };
}
