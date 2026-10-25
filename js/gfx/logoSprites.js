// The game's logo (Sprites.logo) and its small icon (Sprites.logoIcon, the browser tab's: the gate
// with eyes glowing in its dark), painted in code like the rest of the art: a mossy stone dungeon
// archway with a skull keystone and a lowered portcullis, a torch burning either side; across
// it "DUNGEON" carved in pale stone and, big beneath, "RUN" in shaded gold with speed streaks
// trailing off it. The lettering is the game's Alagard font, turned into hard pixels (no blur),
// filled with a ramp lit from the top, with a lit top edge, a 1px dark outline and a drop shadow.
// Built once the font has loaded (see App.init); drawn small and scaled up with sharp pixels.

const LOGO_W = 156;
const LOGO_H = 104;
// the torches' flicker, a loop of phases: [extra height, tip lean, side-lobe shift, ember [dx, dy] or null]
const LOGO_FLICKER = [
  [0, 0, 0, null],
  [1, 1, 1, null],
  [2, 1, 0, [0, 0]],
  [1, 0, -1, [1, 2]],
  [0, -1, 0, [1, 4]],
  [-1, -1, 1, null],
  [1, 0, 1, null],
  [0, 1, -1, null],
];

function buildLogo() {
  const STONE = ['#2e2c38', '#3e3c4c', '#56546a', '#6e6c80', '#8e8ca2', '#aeacc0'];
  const MOSS = ['#2e4a30', '#4e6e44', '#6a8e58'];
  const GOLD = ['#7a4a14', '#a07a24', '#dcb44c', '#f2cf62', '#fbe796', '#fff6c8'];
  const PALE = ['#6e6250', '#9a8a70', '#bfae94', '#d8c8a8', '#f4ead7', '#ffffff'];
  const FIRE = ['#e0461e', '#ff8a1e', '#ffd34a', '#fff6c8'];

  /** Text as a hard-edged mask (alpha 0 or 255) at the font's own pixel size. */
  const mask = (text, px) => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${px}px Alagard`;
    c.width = Math.ceil(ctx.measureText(text).width) + 2;
    c.height = Math.ceil(px * 1.25);
    ctx.font = `${px}px Alagard`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 1, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] >= 110 ? 255 : 0;
    ctx.putImageData(d, 0, 0);
    return c;
  };

  /**
   * Lettering from a mask: filled with `ramp` lit from the top (lightest rows first), each letter's
   * top edge picked out brighter and its bottom edge darker, a 1px dark outline, and a drop shadow.
   */
  const letters = (m, ramp, shadow) => {
    const w = m.width + 4;
    const h = m.height + 4;
    const src = m.getContext('2d').getImageData(0, 0, m.width, m.height).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < m.width && y < m.height && src[(y * m.width + x) * 4 + 3] > 0;
    // where the letters sit, top to bottom (for the ramp)
    let top = m.height;
    let bottom = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (on(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const px = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); };
    // the drop shadow (2px down and right), then the outline round the letters
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (on(x, y)) { px(x + 3, y + 3, shadow); px(x + 2, y + 3, shadow); }
    for (let y = -1; y <= m.height; y++) {
      for (let x = -1; x <= m.width; x++) {
        if (on(x, y)) continue;
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)) px(x + 1, y + 1, OUTLINE);
      }
    }
    // the fill: the ramp down the letters, brighter on each top edge, darker on each bottom edge
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (!on(x, y)) continue;
        const k = bottom > top ? (y - top) / (bottom - top) : 0;
        let i = Math.round((1 - k) * (ramp.length - 3)) + 1;
        if (!on(x, y - 1)) i = ramp.length - 1;
        else if (!on(x, y + 1)) i = 0;
        else if (!on(x - 1, y)) i = Math.min(ramp.length - 1, i + 1);   // lit from the left too
        px(x + 1, y + 1, ramp[i]);
      }
    }
    return c;
  };

  /** A torch flame at flicker phase `f` (see LOGO_FLICKER): taller or shorter, leaning, an ember above. */
  const flame = (p, cx, by, f) => {
    const [dh, lean, lobe, ember] = LOGO_FLICKER[f];
    p.poly([[cx - 4, by], [cx - 3, by - 6 - lobe], [cx - 1, by - 5], [cx + lean, by - 11 - dh], [cx + 2, by - 6 + lobe], [cx + 4, by]], FIRE[0]);
    p.poly([[cx - 3, by], [cx - 1, by - 5], [cx + 1 + lean, by - 8 - dh], [cx + 3, by]], FIRE[1]);
    p.ellipse(cx, by - 2, 2, 2, FIRE[2]);
    p.px(cx, by - 3 - Math.max(0, dh), FIRE[3]);
    if (ember) p.px(cx + lean * 2 + ember[0], by - 13 - dh - ember[1], FIRE[2]);
  };

  // ---------- the archway, the gate and the torches (left flame at phase fl, right at fr) ----------
  const back = (fl, fr) => PixelArt.bevel(PixelArt.make(LOGO_W, LOGO_H, (p) => {
    const cx = LOGO_W / 2;
    const top = 6;
    const outer = 46;   // the arch's half width
    const inner = 30;
    const spring = 40;  // where the round top meets the straight sides
    const base = LOGO_H - 8;
    // the dark inside of the gate
    p.rect(cx - inner, spring, inner * 2, base - spring, '#0c0812');
    p.ellipse(cx, spring, inner, inner - 4, '#0c0812');
    // the portcullis, lowered most of the way
    for (let x = cx - inner + 5; x < cx + inner; x += 7) p.rect(x, spring - 14, 2, base - spring + 6, '#26242e');
    for (let y = spring - 6; y < base; y += 9) p.rect(cx - inner + 2, y, inner * 2 - 4, 2, '#26242e');
    for (let x = cx - inner + 5; x < cx + inner; x += 7) p.px(x, spring - 14, STONE[3]);
    // the stone arch: the round top in wedge-shaped blocks, then the two jambs in courses
    for (let a = Math.PI; a <= TAU + 0.001; a += Math.PI / 9) {
      const a2 = a + Math.PI / 9;
      const pts = [
        [cx + Math.cos(a) * inner, spring + Math.sin(a) * (inner - 4)],
        [cx + Math.cos(a) * outer, spring + Math.sin(a) * (spring - top)],
        [cx + Math.cos(a2) * outer, spring + Math.sin(a2) * (spring - top)],
        [cx + Math.cos(a2) * inner, spring + Math.sin(a2) * (inner - 4)],
      ];
      if (a2 > TAU + 0.01) break;
      p.poly(pts, STONE[2 + (Math.round(a * 10) % 2)]);
    }
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? cx - outer : cx + inner;
      for (let y = spring, row = 0; y < base; y += 8, row++) {
        p.rect(x0, y, outer - inner, 7, STONE[2 + (row % 2)]);
        p.rect(x0, y, outer - inner, 1, STONE[4]);
        p.rect(x0 + (row % 2 ? 7 : 4), y + 1, 1, 6, STONE[1]);
      }
      // moss creeping up from the ground
      for (let i = 0; i < outer - inner; i += 2) p.rect(x0 + i, base - 3 - (i % 3), 2, 3 + (i % 3), MOSS[1]);
      p.rect(x0 + 2, base - 4, 4, 1, MOSS[2]);
    }
    // the keystone: a carved skull
    p.round(cx - 6, top - 2, 12, 12, STONE[4], 3);
    p.round(cx - 4, top, 8, 7, STONE[5], 2);
    p.rect(cx - 3, top + 2, 2, 2, STONE[0]);
    p.rect(cx + 1, top + 2, 2, 2, STONE[0]);
    p.rect(cx - 1, top + 5, 2, 2, STONE[1]);
    // the ground, and the torches on their brackets either side
    p.rect(cx - outer - 6, base, outer * 2 + 12, 3, STONE[1]);
    for (const s of [-1, 1]) {
      const tx = cx + s * (outer + 13);
      p.rect(tx - 1, 46, 3, 14, '#5b3922');
      p.rect(tx - 3, 44, 7, 3, '#80869a');
      p.rect(tx - 2, 58, 5, 2, '#80869a');
      flame(p, tx, 44, s < 0 ? fl : fr);
    }
  }, OUTLINE));

  // ---------- the lettering ----------
  const dungeon = letters(mask('DUNGEON', 16), PALE, '#1a1020');
  const run = letters(mask('RUN', 32), GOLD, '#5a2414');

  /** One frame of the logo, the torches at flicker phases fl and fr. */
  const frame = (fl, fr) => {
    const c = document.createElement('canvas');
    c.width = LOGO_W;
    c.height = LOGO_H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // the torches' glow on the stone, under everything, swelling as the flame does
    for (const s of [-1, 1]) {
      const dh = LOGO_FLICKER[s < 0 ? fl : fr][0];
      const g = ctx.createRadialGradient(LOGO_W / 2 + s * 59, 38, 1, LOGO_W / 2 + s * 59, 38, 22 + dh);
      g.addColorStop(0, `rgba(255, 170, 70, ${0.33 + dh * 0.03})`);
      g.addColorStop(1, 'rgba(255, 170, 70, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LOGO_W, LOGO_H);
    }
    ctx.drawImage(back(fl, fr), 0, 0);
    const dx = Math.round((LOGO_W - dungeon.width) / 2);
    ctx.drawImage(dungeon, dx, 26);
    const rx = Math.round((LOGO_W - run.width) / 2) + 4;
    const ry = 50;
    // speed streaks trailing off the left of RUN: it's dashing off to the right
    for (const [y, len, col] of [[ry + 12, 26, FIRE[1]], [ry + 19, 34, GOLD[3]], [ry + 26, 22, FIRE[0]], [ry + 33, 14, GOLD[2]]]) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(rx - len - 1, y - 1, len + 4, 4);
      ctx.fillStyle = col;
      ctx.fillRect(rx - len, y, len + 2, 2);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(rx - 4, y, 4, 1);
    }
    ctx.drawImage(run, rx, ry);
    // a few glints on the gold
    for (const [gx, gy] of [[rx + 6, ry + 4], [rx + run.width - 12, ry + 6], [rx + 26, ry + 3]]) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx, gy - 1, 1, 3);
      ctx.fillRect(gx - 1, gy, 3, 1);
    }
    return c;
  };
  // the animation (the two torches out of step with each other); frame 0 doubles as the still logo
  const n = LOGO_FLICKER.length;
  Sprites.logoFrames = LOGO_FLICKER.map((_, i) => frame(i, (i + Math.floor(n / 2) + 1) % n));
  Sprites.logo = Sprites.logoFrames[0];

  // ---------- the icon: the gate with its watching eyes, gold-rimmed (browser tab, 32x32) ----------
  Sprites.logoIcon = PixelArt.bevel(PixelArt.make(32, 32, (p) => {
    p.round(1, 1, 30, 30, GOLD[1], 6);
    p.round(2, 2, 28, 28, '#2e1f17', 5);
    p.rect(9, 14, 14, 15, '#0c0812');
    p.ellipse(16, 14, 7, 7, '#0c0812');
    for (const s of [-1, 1]) { p.rect(16 + s * 3 - 1, 18, 2, 2, '#ffd34a'); }
    for (let x = 10; x < 23; x += 4) p.rect(x, 9, 1, 18, '#3e3c4c');
    for (const s of [-1, 1]) p.rect(s < 0 ? 4 : 23, 12, 5, 17, STONE[3]);
    p.poly([[4, 13], [9, 13], [12, 6], [16, 4], [20, 6], [23, 13], [28, 13], [24, 4], [16, 1], [8, 4]], STONE[3]);
    p.rect(14, 2, 4, 4, STONE[5]);
    p.rect(3, 28, 26, 2, MOSS[1]);
  }, OUTLINE));
}
