// 28x28 ability icons for the HUD, one set per class (keyed by ability slot)
// plus the shared dodge icon. Painted with the same PixelArt toolkit.

function buildIconSprites() {
  const S = RAMP.steel;
  const L = RAMP.leather;
  const G = RAMP.gold;
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
  const FROSTFIRE = ['#2a5ad0', '#4a8aff', '#e6f6ff'];
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

  Sprites.icons = {
    warrior: {
      primary: icon((p) => blade(p, 4, 24, 24, 4, { w: 2, grip: 5, guard: 4 })),
      // energy barrier: curved blue panels
      secondary: icon((p) => {
        p.poly([[4, 6], [14, 3], [24, 6], [24, 20], [14, 25], [4, 20]], '#2a5ad0');
        p.poly([[6, 8], [14, 5], [22, 8], [22, 19], [14, 23], [6, 19]], '#4a8aff');
        p.line(14, 5, 14, 23, '#9ad0ff', 1);
        p.line(6, 13, 22, 13, '#9ad0ff', 1);
        p.rect(8, 8, 2, 4, '#e6f6ff');
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
        p.poly([[14, 6], [26, 14], [14, 22], [18, 14]], '#9ad0ff');
        for (const y of [9, 14, 19]) p.rect(1, y, 5, 1, '#c9d3dd');
      }),
      q: icon((p) => {
        for (let i = 0; i < 3; i++) p.rect(5 + i * 8, 2 + (i % 2) * 3, 1, 4, G[3]);
        blade(p, 14, 2, 14, 26, { w: 3, grip: 5, guard: 6, ramp: ['', '', '', G[2], '', G[3]], guardCol: S[4] });
      }),
    },
    ranger: {
      primary: icon((p) => arrow(p, 4, 24, 21, 7)),
      secondary: icon((p) => {
        arrow(p, 7, 2, 7, 18);
        arrow(p, 14, 6, 14, 22);
        arrow(p, 21, 2, 21, 18);
      }),
      e: icon((p) => {
        arrow(p, 3, 18, 19, 4, { head: '#8cff9a', fletch: '#8cff9a' });
        arrow(p, 8, 25, 24, 11, { head: '#8cff9a', fletch: '#8cff9a' });
      }),
      // fire arrow over ice arrow
      f: icon((p) => {
        arrow(p, 3, 11, 19, 3, { head: '#ff8a1e', shaft: L[4], fletch: '#ffd34a' });
        flame(p, 22, 6, 3);
        arrow(p, 3, 25, 19, 17, { head: '#9ad0ff', shaft: L[4], fletch: '#e6f6ff' });
        snowflake(p, 23, 19, 4);
      }),
      q: icon((p) => {
        p.poly([[4, 24], [6, 10], [14, 3], [24, 4], [22, 14], [14, 22]], '#4f6a45');
        p.poly([[6, 22], [8, 11], [14, 5], [22, 6], [20, 13], [13, 20]], '#88a446');
        p.line(4, 24, 20, 8, '#3a5030', 1);
        p.line(11, 16, 11, 10, '#3a5030', 1);
        p.line(15, 12, 20, 12, '#3a5030', 1);
      }),
    },
    mage: {
      primary: icon((p) => {
        for (let i = 0; i < 4; i++) p.circle(5 + i * 3, 22 - i * 3, 1 + i * 0.4, i % 2 ? '#e6ccff' : '#b67aff');
        p.circle(18, 10, 6, '#6a28c8');
        p.circle(18, 10, 4, '#b67aff');
        p.circle(17, 9, 2, '#e6ccff');
      }),
      secondary: icon((p) => {
        for (let i = 0; i < 3; i++) p.rect(3 + i * 3, 21 - i * 3, 3, 3, i ? '#9ad0ff' : '#4a8aff');
        flame(p, 16, 15, 7, FROSTFIRE);
      }),
      e: icon((p) => {
        p.poly([[16, 1], [6, 15], [13, 15], [9, 27], [22, 11], [15, 11], [20, 1]], '#ffd34a');
        p.poly([[16, 1], [8, 14], [13, 14], [18, 3]], '#fff6c8');
      }),
      // the bird-form sprite, enlarged
      f: icon((p) => p.ctx.drawImage(Sprites.items.birdFrames[0].img, 2, 5, 24, 18)),
      // the drain circle as seen on the floor: purple rings, cyan inner ring, two turning squares
      q: icon((p) => {
        const ell = (rx, color, size = 1) => {
          for (let a = 0; a < TAU; a += 0.1) p.rect(14 + Math.cos(a) * rx - size / 2, 15 + Math.sin(a) * rx * 0.6 - size / 2, size, size, color);
        };
        p.ellipse(14, 15, 12, 7, '#2a1850');
        ell(12, '#a07aff', 2);
        ell(10, '#6ad8ff');
        ell(5, '#6ad8ff');
        for (const off of [0, Math.PI / 4]) {
          for (let i = 0; i < 4; i++) {
            const a = off + (i * TAU) / 4;
            const b = off + ((i + 1) * TAU) / 4;
            p.line(14 + Math.cos(a) * 10, 15 + Math.sin(a) * 6, 14 + Math.cos(b) * 10, 15 + Math.sin(b) * 6, '#a07aff', 1);
          }
        }
        // drained life rising out of it
        p.rect(13, 3, 2, 4, '#b67aff');
        p.rect(7, 6, 2, 3, '#6ad8ff');
        p.rect(19, 5, 2, 3, '#6ad8ff');
      }),
    },
    rogue: {
      primary: icon((p) => {
        blade(p, 14, 26, 14, 6, { w: 1.5, grip: 4, guard: 3 });
        blade(p, 12, 26, 3, 9, { w: 1.5, grip: 4, guard: 3 });
        blade(p, 16, 26, 25, 9, { w: 1.5, grip: 4, guard: 3 });
      }),
      secondary: icon((p) => {
        for (const y of [8, 13, 18]) p.rect(1, y, 7 - Math.abs(y - 13) / 2, 1, '#c8c8e0');
        blade(p, 9, 20, 25, 6, { w: 1.5, grip: 4, guard: 3 });
      }),
      e: icon((p) => {
        blade(p, 4, 24, 22, 6, { w: 1.5, grip: 4, guard: 3 });
        blade(p, 24, 24, 6, 6, { w: 1.5, grip: 4, guard: 3 });
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
        // faded clone behind the rogue
        p.round(13, 4, 12, 12, '#5a3a8a', 3);
        p.round(12, 14, 14, 12, '#5a3a8a', 3);
        p.rect(16, 9, 2, 2, '#e6ccff'); p.rect(21, 9, 2, 2, '#e6ccff');
        p.round(3, 6, 12, 12, '#3a3a50', 3);
        p.round(2, 16, 14, 11, '#3a3a50', 3);
        p.rect(5, 11, 8, 3, RAMP.skin[2]);
        p.rect(6, 12, 2, 1, OUTLINE); p.rect(10, 12, 2, 1, OUTLINE);
      }),
    },
    dodge: icon((p) => {
      p.poly([[6, 5], [14, 14], [6, 23], [9, 14]], '#c8c0b0');
      p.poly([[14, 5], [22, 14], [14, 23], [17, 14]], '#efe6d2');
      for (const y of [8, 20]) p.rect(1, y, 4, 1, '#8a8070');
      p.rect(23, 13, 4, 2, '#8a8070');
    }),
    // red health potion flask with a cork
    potion: icon((p) => {
      p.rect(11, 2, 6, 4, '#9a6a3a');       // cork
      p.rect(11, 2, 6, 1, '#c89a5a');
      p.rect(10, 6, 8, 5, '#c8d8e8');       // glass neck
      p.circle(14, 18, 8, '#c8d8e8');       // glass bulb
      p.circle(14, 19, 7, '#b81e2e');       // potion
      p.circle(14, 20, 6, '#e83a4a');
      p.rect(8, 15, 12, 1, '#ff8aa0');      // surface shine
      p.rect(9, 17, 3, 4, '#ff8aa0');
      p.px(10, 13, '#ffffff');
      p.px(11, 12, '#ffffff');
    }),
  };
}
