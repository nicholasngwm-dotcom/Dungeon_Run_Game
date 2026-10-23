// The Deathbringer (graveyard boss): its robed body (a deep hood with nothing in it but
// darkness, a gold-trimmed robe with a tattered hem that stirs), its scythe, and the
// double scythe it conjures at half health (a blade forked both ways at each end).
// Painted with the PixelArt toolkit in the house style: dark outline, lit from the top-left.
// Its arms, its eight tendrils and the darkness pouring off it are drawn live (deathbringer.js).

const DB_SPRITE = { w: 64, h: 84, ax: 32, ay: 82 };   // body sprite size and its anchor (the ground under it)
// where its shoulders and face are on the body sprite, relative to the anchor
const DB_POINTS = { shoulderL: { x: -15, y: -54 }, shoulderR: { x: 15, y: -54 }, face: { x: 0, y: -66 }, back: { x: 0, y: -52 } };
const DB_ROBE = ['#0c0a12', '#16121e', '#221a2e', '#2f2440', '#3e3156'];
const DB_GOLD = ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'];
const DB_BLADE = ['#26222e', '#4a4458', '#7a7290', '#b8b0d0', '#ece8ff'];

function buildDeathbringerSprites() {
  const R = DB_ROBE;
  const G = DB_GOLD;
  const { w: W, h: H } = DB_SPRITE;

  /** One frame of the body: k (0-3) stirs the tattered hem and the hanging cloth. */
  const body = (k) => PixelArt.bevel(PixelArt.make(W, H, (p) => {
    const cx = 32;
    const sway = [0, 1, 0, -1][k];
    // the robe: narrow at the shoulders, flaring out to a ragged hem
    const hem = [];
    for (let i = 0; i <= 12; i++) {
      const x = 4 + i * (56 / 12);
      const tooth = (i + k) % 2 ? 0 : 5 + ((i * 7 + k * 3) % 4);
      hem.push([x + (i === 0 || i === 12 ? 0 : sway), 72 + tooth]);
    }
    p.poly([[17, 26], [47, 26], [54, 56], [60, 72], ...hem.reverse(), [4, 72], [10, 56]], R[2]);
    // shading folds down the robe
    for (const [x, c] of [[16, R[1]], [24, R[3]], [40, R[3]], [48, R[1]]]) p.line(x + (x < cx ? -2 : 2), 34, x + (x < cx ? -6 : 6) + sway, 74, c, 2);
    // the open front: a dark parting edged in gold
    p.poly([[29, 30], [35, 30], [38 + sway, 76], [26 + sway, 76]], R[0]);
    p.line(28, 31, 25 + sway, 75, G[2], 1);
    p.line(36, 31, 39 + sway, 75, G[2], 1);
    // a gold-trimmed hem band
    for (let i = 0; i < hem.length - 1; i++) p.line(hem[i][0], hem[i][1] - 3, hem[i + 1][0], hem[i + 1][1] - 3, G[1], 1);
    // belt with a skull clasp
    p.rect(17, 44, 30, 4, R[1]);
    p.rect(17, 44, 30, 1, G[1]);
    p.round(29, 42, 7, 7, '#d8d0c0', 2);
    p.rect(30, 44, 2, 2, R[0]);
    p.rect(33, 44, 2, 2, R[0]);
    p.rect(31, 47, 3, 1, R[0]);
    // shoulder plates: dark iron rimmed in gold
    for (const sx of [11, 41]) {
      p.round(sx, 24, 12, 8, '#2a2834', 3);
      p.rect(sx + 1, 24, 10, 1, G[2]);
      p.rect(sx + 2, 30, 8, 1, G[1]);
      p.px(sx + 5, 27, G[3]);
    }
    // the hood: tall and pointed, falling over the shoulders
    p.poly([[32, 0], [43, 10], [47, 24], [44, 32], [20, 32], [17, 24], [21, 10]], R[3]);
    p.poly([[32, 0], [43, 10], [47, 24], [44, 32], [36, 32], [38, 14]], R[2]);
    p.line(32, 1, 22, 11, R[4], 1);
    // the face: nothing in there but darkness, its rim edged in gold
    p.ellipse(32, 18, 8, 10, '#020104');
    p.ellipse(32, 19, 6, 8, '#000000');
    p.line(24, 12, 26, 26, G[1], 1);
    p.line(40, 12, 38, 26, G[1], 1);
  }, OUTLINE));

  /**
   * A scythe lying along +x with its grip at the pivot (left). The blade hooks down off the
   * far end. double: the conjured one, with a forked blade (two hooks) at both ends.
   */
  const scythe = (double) => {
    const len = double ? 80 : 66;
    const w = len + 8;
    const h = 44;
    const cy = 22;
    return PixelArt.bevel(PixelArt.make(w, h, (p) => {
      // the haft: blackened wood bound in gold
      p.rect(4, cy - 1, len, 3, '#2a1e18');
      p.rect(4, cy - 1, len, 1, '#4a3424');
      for (const x of double ? [len / 2 - 8, len / 2 + 8] : [len - 10, 14]) p.rect(4 + x, cy - 2, 2, 5, DB_GOLD[2]);
      /** A crescent blade hooking from the haft at hx, curving to side sy (1 down, -1 up), facing dir (1 right, -1 left), s: its size. */
      const blade = (hx, sy, dir, s = 1) => {
        const R1 = 18 * s;
        const R2 = 15 * s;
        const c1 = { x: hx - dir * 14 * s, y: cy };
        const c2 = { x: hx - dir * 12 * s, y: cy - sy * 4 * s };
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const inSide = sy > 0 ? yy >= cy : yy <= cy;
            const ahead = dir > 0 ? xx <= hx + 1 : xx >= hx - 1;
            if (!inSide || !ahead) continue;
            const d1 = Math.hypot(xx - c1.x, yy - c1.y);
            const d2 = Math.hypot(xx - c2.x, yy - c2.y);
            if (d1 > R1 || d2 < R2) continue;
            const edge = d1 > R1 - 1.6;
            p.px(xx, yy, edge ? DB_BLADE[4] : d1 > R1 - 4 ? DB_BLADE[3] : DB_BLADE[2]);
          }
        }
        p.rect(hx - 2, cy - 3, 4, 7, DB_GOLD[1]);
      };
      if (double) {
        // a fork of two hooks at each end, the ends turned opposite ways (so it wheels when it spins)
        blade(4 + len - 1, 1, 1);
        blade(4 + len - 14, 1, 1, 0.7);
        blade(5, -1, -1);
        blade(18, -1, -1, 0.7);
      } else {
        blade(4 + len - 1, 1, 1);
      }
    }, OUTLINE));
  };

  const frames = [0, 1, 2, 3].map(body);
  Sprites.deathbringer = {
    body: frames.map((img) => ({ img, flash: PixelArt.silhouette(img, '#ffffff'), shade: PixelArt.silhouette(img, '#120a1e'), rim: PixelArt.silhouette(img, '#8a5aff') })),
    scythe: scythe(false),
    doubleScythe: scythe(true),
  };

  // ---------- its room: soul lanterns hanging off dead trees, dark gold-plated graves ----------

  /** A gnarled dead tree, black and twisted, with two iron soul lanterns hanging off its branches on chains. */
  const soulTree = PixelArt.bevel(PixelArt.make(56, 76, (p) => {
    const bark = ['#1a1418', '#2a2026', '#3c2e34'];
    p.poly([[24, 75], [26, 40], [22, 22], [27, 22], [30, 36], [33, 20], [36, 22], [33, 42], [34, 75]], bark[1]);
    p.line(26, 74, 27, 42, bark[2], 1);
    for (const [x1, y1, x2, y2] of [[26, 34, 8, 18], [8, 18, 4, 20], [31, 30, 50, 14], [50, 14, 54, 16], [24, 26, 14, 8], [33, 24, 40, 6], [14, 8, 12, 4]]) {
      p.line(x1, y1, x2, y2, bark[1], 3);
      p.line(x1, y1 - 1, x2, y2 - 1, bark[2], 1);
    }
    // roots
    p.poly([[18, 75], [24, 68], [26, 75]], bark[1]);
    p.poly([[32, 75], [34, 68], [42, 75]], bark[1]);
    // the chains
    for (const [x, y0, y1] of [[8, 19, 30], [50, 15, 26]]) for (let y = y0; y < y1; y += 2) p.px(x, y, '#585d6c');
    // the lanterns: iron cages, the soul-light inside is drawn glowing on top (decor.js)
    for (const [x, y] of [[8, 30], [50, 26]]) {
      p.rect(x - 4, y, 9, 2, '#2a2834');
      p.rect(x - 4, y + 2, 9, 9, '#16141c');
      p.rect(x - 3, y + 3, 7, 7, '#3a7a8a');
      p.rect(x - 1, y + 2, 1, 9, '#2a2834');
      p.rect(x + 1, y + 2, 1, 9, '#2a2834');
      p.rect(x - 4, y + 11, 9, 2, '#2a2834');
      p.px(x, y - 1, DB_GOLD[2]);
    }
  }, OUTLINE));

  /** Gravestones of dark, almost black stone; the gold ones are plated and edged in gold. */
  const grave = (gold, cross) => PixelArt.bevel(PixelArt.make(24, 32, (p) => {
    const S = ['#16141c', '#24222c', '#33303e', '#46424f'];
    p.ellipse(12, 29, 10, 3, '#1c1820');
    if (cross) {
      p.rect(10, 4, 5, 25, S[2]);
      p.rect(4, 9, 17, 5, S[2]);
      p.rect(10, 4, 2, 25, S[3]);
      if (gold) { p.rect(11, 9, 3, 5, DB_GOLD[2]); p.rect(4, 9, 17, 1, DB_GOLD[2]); p.rect(10, 4, 5, 1, DB_GOLD[2]); }
    } else {
      p.round(4, 4, 17, 25, S[2], 6);
      p.round(4, 4, 6, 25, S[3], 5);
      p.rect(8, 14, 9, 1, S[0]);
      p.rect(8, 17, 9, 1, S[0]);
      p.rect(8, 20, 6, 1, S[0]);
      if (gold) {
        p.round(7, 7, 11, 4, DB_GOLD[2], 1);
        p.px(12, 8, DB_GOLD[3]);
        p.rect(4, 26, 17, 2, DB_GOLD[1]);
      }
    }
  }, OUTLINE));

  Sprites.deathbringerRoom = {
    soulTree,
    graves: [grave(true, false), grave(false, false), grave(true, true), grave(false, true)],
  };
}
