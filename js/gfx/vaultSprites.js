// Gems and the gem vault (the room the last boss's blue portal leads to): the vault's floor of
// polished midnight-blue stone with gold inlay and glinting gem chips, faceted gems (the HUD's
// counter, the chest's fountain), crystal clusters growing round the walls, and the 20x20 icons
// for the heroes' gem enhancements. Painted with the PixelArt toolkit: dark outline, lit from
// the top-left (bevel).

// gem colour ramps, darkest first: sapphire, emerald, ruby, amethyst
const GEM_RAMPS = [
  ['#122a6a', '#1e4ab0', '#3a8aff', '#8ac8ff', '#e6f6ff'],
  ['#0e4a2a', '#1a8a4a', '#3ad07a', '#9af0b8', '#effff4'],
  ['#5a0e1e', '#a01e34', '#e8405a', '#ff9aa8', '#fff0f2'],
  ['#3a1a6a', '#6a3aa0', '#a070e0', '#d8b8ff', '#f8f0ff'],
];

const VaultTiles = {
  /** Polished midnight-blue flagstones edged in gold, a chip of gem glinting here and there. */
  floor(p, x, y, rng, tx, ty) {
    const base = ['#141a34', '#171e3a', '#121730'];
    p.rect(x, y, 32, 32, '#0a0d1c');
    p.rect(x + 1, y + 1, 30, 30, base[(tx * 3 + ty * 5) % base.length]);
    p.rect(x + 1, y + 1, 30, 1, '#26305a');
    p.rect(x + 1, y + 1, 1, 30, '#26305a');
    p.rect(x + 1, y + 30, 30, 1, '#0c1024');
    p.rect(x + 30, y + 1, 1, 30, '#0c1024');
    // gold inlay at the corners, where four flags meet
    p.rect(x, y, 3, 1, '#a07a24');
    p.rect(x, y, 1, 3, '#a07a24');
    p.px(x, y, '#dcb44c');
    // a soft sheen
    p.ctx.fillStyle = 'rgba(140, 170, 255, 0.07)';
    p.ctx.fillRect(x + 4, y + 4, 12, 3);
    if (rng() < 0.18) {
      const ramp = GEM_RAMPS[Math.floor(rng() * GEM_RAMPS.length)];
      const gx = x + 5 + Math.floor(rng() * 20);
      const gy = y + 5 + Math.floor(rng() * 20);
      p.rect(gx, gy, 2, 2, ramp[2]);
      p.px(gx, gy, ramp[4]);
    }
  },
};

function buildVaultSprites() {
  /** A cut gem, w wide (odd), in ramp R: a crown of facets over a pointed pavilion. */
  const gem = (R, w) => PixelArt.bevel(PixelArt.make(w + 2, Math.round(w * 0.9) + 2, (p) => {
    const c = (w + 2) / 2;
    const top = 1;
    const girdle = 1 + Math.round(w * 0.32);
    const bottom = Math.round(w * 0.9);
    const half = w / 2;
    p.poly([[c - half * 0.55, top], [c + half * 0.55, top], [c + half, girdle], [c, bottom], [c - half, girdle]], R[2]);
    p.poly([[c - half, girdle], [c, bottom], [c - half * 0.2, girdle]], R[1]);           // the shaded left pavilion
    p.poly([[c + half * 0.2, girdle], [c, bottom], [c + half, girdle]], R[3]);
    p.poly([[c - half * 0.55, top], [c - half * 0.1, top], [c - half * 0.3, girdle], [c - half, girdle]], R[3]);
    p.line(c - half, girdle, c + half, girdle, R[1]);
    p.px(Math.round(c - half * 0.4), top + 1, R[4]);
    if (w >= 9) p.px(Math.round(c - half * 0.4) + 1, top + 1, R[4]);
  }, OUTLINE));

  /** A cluster of crystal shards growing out of a rock, in ramp R (32x36, anchored at its foot). */
  const cluster = (R, seed) => PixelArt.bevel(PixelArt.make(32, 36, (p) => {
    const shards = [[16, 4, 5], [9, 12, 4], [23, 10, 4], [4, 20, 3], [27, 20, 3]];
    shards.forEach(([sx, sy, hw], i) => {
      const lean = ((i + seed) % 3) - 1;
      p.poly([[sx - hw, 31], [sx - hw + lean, sy + 4], [sx + lean, sy], [sx + hw + lean, sy + 4], [sx + hw, 31]], i % 2 ? R[1] : R[2]);
      p.poly([[sx - hw, 31], [sx - hw + lean, sy + 4], [sx + lean, sy], [sx + lean, 31]], i % 2 ? R[2] : R[3]);
      p.px(sx + lean - 1, sy + 3, R[4]);
    });
    p.ellipse(16, 32, 14, 3, '#2a2834');
    p.ellipse(13, 31, 8, 2, '#423f50');
  }, OUTLINE));

  // ---------- enhancement icons (20x20) ----------
  const icon = (fn) => PixelArt.bevel(PixelArt.make(20, 20, fn, OUTLINE));
  const icons = {
    // a big red heart with a plus
    hp: icon((p) => {
      p.circle(6, 7, 4, '#e84a4a');
      p.circle(13, 7, 4, '#e84a4a');
      p.poly([[2, 8], [18, 8], [10, 17]], '#e84a4a');
      p.rect(4, 4, 2, 2, '#ffb0b8');
      p.rect(9, 6, 2, 7, '#ffffff');
      p.rect(7, 8, 6, 2, '#ffffff');
    }),
    // a winged boot
    speed: icon((p) => {
      p.poly([[6, 3], [11, 3], [11, 12], [17, 13], [17, 17], [5, 17]], '#8a5a34');
      p.rect(6, 3, 5, 2, '#b07a48');
      p.rect(5, 15, 12, 2, '#5a3a20');
      p.poly([[11, 5], [18, 2], [16, 6], [19, 6], [12, 9]], '#e6f6ff');
      p.line(12, 6, 17, 3, '#9ad0ff');
    }),
    // an eye with a gold crosshair through it
    crit: icon((p) => {
      p.ellipse(10, 10, 8, 5, '#f4ead7');
      p.circle(10, 10, 4, '#3a8aff');
      p.circle(10, 10, 2, '#122a6a');
      p.px(8, 8, '#ffffff');
      p.rect(9, 1, 2, 4, '#ffd34a');
      p.rect(9, 15, 2, 4, '#ffd34a');
      p.rect(1, 9, 3, 2, '#ffd34a');
      p.rect(16, 9, 3, 2, '#ffd34a');
    }),
    // a hero's silhouette dashing, with speed streaks behind
    dodge: icon((p) => {
      for (const [y, w] of [[6, 6], [10, 8], [14, 5]]) p.rect(2, y, w, 2, '#9ad0ff');
      p.circle(14, 5, 3, '#e6f6ff');
      p.poly([[11, 8], [17, 8], [16, 14], [12, 14]], '#5a9ad0');
      p.poly([[12, 14], [15, 14], [18, 18], [14, 18]], '#2a5a8a');
      p.poly([[12, 14], [14, 14], [10, 18], [8, 18]], '#2a5a8a');
    }),
    // an hourglass with its sand running fast
    cooldowns: icon((p) => {
      p.rect(3, 1, 14, 3, '#a07a24');
      p.rect(3, 16, 14, 3, '#a07a24');
      p.poly([[5, 4], [15, 4], [11, 10], [15, 16], [5, 16], [9, 10]], '#9ad0ff');
      p.poly([[6, 5], [14, 5], [10, 9]], '#ffd34a');
      p.poly([[7, 16], [13, 16], [10, 12]], '#ffd34a');
      p.px(10, 10, '#ffd34a');
      p.rect(3, 1, 14, 1, '#ffd34a');
    }),
    // a little glowing tree, padlocked
    tree: icon((p) => {
      p.rect(9, 9, 2, 9, '#7d532f');
      p.line(10, 12, 5, 7, '#7d532f');
      p.line(10, 11, 15, 6, '#7d532f');
      for (const [x, y] of [[5, 6], [15, 5], [10, 4]]) { p.circle(x, y, 2, '#a070e0'); p.px(x - 1, y - 1, '#e0c8ff'); }
      p.rect(11, 12, 8, 7, '#8a8a9a');
      p.rect(12, 9, 2, 3, '#585868');
      p.rect(16, 9, 2, 3, '#585868');
      p.rect(13, 8, 4, 1, '#585868');
      p.rect(14, 14, 2, 3, '#2a2834');
    }),
  };

  Sprites.vault = {
    gems: GEM_RAMPS.map((R) => gem(R, 9)),        // fountain gems, one per colour
    gemIcon: gem(GEM_RAMPS[0], 13),               // the HUD counter's and the menus' gem
    clusters: GEM_RAMPS.map((R, i) => cluster(R, i)),
    icons,
  };
}
