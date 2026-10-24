// Barrels standing about the fight rooms (see js/game/barrels.js): an explosive keg banded in
// hazard stripes, a poison cask oozing green, a frost barrel crusted in ice. Oak staves and
// iron hoops lit from the top left, with a dark outline (Sprites.barrels[kind] = { img, flash }).

const BARREL_W = 22;
const BARREL_H = 26;

function buildBarrelSprites() {
  const OAK = ['#3b2416', '#5b3922', '#7d532f', '#9c6c3e', '#c08a52'];
  const IRON = ['#383b48', '#585d6c', '#80869a', '#adb2c0'];
  const W = BARREL_W;
  const H = BARREL_H;

  /** The barrel itself: bulging staves, a lid, two hoops; `wood` tints the staves. */
  const body = (p, wood, hoop = IRON) => {
    // bulging body: wider in the middle
    p.round(2, 5, W - 4, H - 7, wood[1], 3);
    p.rect(1, 9, W - 2, H - 15, wood[1]);
    p.rect(3, 6, W - 7, H - 9, wood[2]);
    p.rect(2, 10, W - 6, H - 17, wood[2]);
    p.rect(4, 7, 2, H - 11, wood[3]);   // lit staves, left
    p.rect(3, 10, 1, H - 17, wood[4]);
    for (const x of [7, 11, 15]) p.rect(x, 7, 1, H - 10, wood[0]);   // stave seams
    p.rect(W - 5, 8, 2, H - 13, wood[0]);   // shaded side
    // the lid: an ellipse on top
    p.ellipse(W / 2, 5, W / 2 - 2, 3, wood[0]);
    p.ellipse(W / 2, 5, W / 2 - 4, 2, wood[2]);
    p.rect(W / 2 - 5, 4, 4, 1, wood[3]);
    // iron hoops round the top and bottom
    for (const y of [8, H - 6]) {
      p.rect(1, y, W - 2, 2, hoop[1]);
      p.rect(2, y, W - 8, 1, hoop[3]);
      p.rect(W - 4, y, 2, 2, hoop[0]);
    }
  };

  const explosive = PixelArt.bevel(PixelArt.make(W, H, (p) => {
    body(p, ['#4a1a14', '#7c1f2a', '#a63036', '#cc5046', '#e87a5a']);
    // a hazard band round the middle
    for (let i = 0; i < 9; i++) p.rect(2 + i * 2, 13, 2, 4, i % 2 ? '#2a2420' : '#f0b830');
    // a flame mark on it
    p.poly([[8, 21], [9.5, 17.5], [11, 19], [12, 16.5], [14, 21]], '#ffd34a');
    p.rect(10, 19, 2, 2, '#ff8a1e');
    // the fuse, poking out of the lid
    p.line(12, 4, 15, 0, '#3a3028', 1);
  }, OUTLINE));

  const poison = PixelArt.bevel(PixelArt.make(W, H, (p) => {
    body(p, ['#1e2a14', '#2e4422', '#3e5a2c', '#56783c', '#7a9a52'], ['#2a2e2a', '#4a524a', '#6a7a6a', '#9aa89a']);
    // green ooze welling over the lid and dripping down
    p.ellipse(W / 2, 5, W / 2 - 4, 2, '#7ae05a');
    p.rect(W / 2 - 3, 4, 3, 1, '#c8ff9a');
    for (const [x, len] of [[5, 6], [10, 3], [15, 8]]) {
      p.rect(x, 6, 2, len, '#6ac04a');
      p.rect(x, 6 + len, 2, 1, '#9cf06a');
    }
    // a skull label
    p.circle(W / 2, 17, 3.5, '#e8e4d8');
    p.rect(W / 2 - 2, 19, 5, 3, '#e8e4d8');
    p.rect(W / 2 - 2, 16, 1, 2, '#2e4422');
    p.rect(W / 2 + 1, 16, 1, 2, '#2e4422');
    p.rect(W / 2 - 1, 21, 1, 1, '#2e4422');
    p.rect(W / 2 + 1, 21, 1, 1, '#2e4422');
  }, OUTLINE));

  const frost = PixelArt.bevel(PixelArt.make(W, H, (p) => {
    body(p, ['#2a3a5a', '#3a5a8a', '#5a7aa8', '#7a9ac8', '#9ab8e0'], ['#4a5a7a', '#7a8ab0', '#adc0e0', '#e6f6ff']);
    // frost crusting the lid, icicles hanging off the top hoop
    p.ellipse(W / 2, 5, W / 2 - 3, 2.5, '#e6f6ff');
    p.rect(W / 2 - 4, 4, 5, 1, '#ffffff');
    for (const [x, len] of [[4, 4], [8, 2], [13, 5], [17, 3]]) p.poly([[x, 10], [x + 2, 10], [x + 1, 10 + len]], '#e6f6ff');
    // a snowflake
    const cx = W / 2;
    const cy = 18;
    p.rect(cx - 4, cy, 9, 1, '#e6f6ff');
    p.rect(cx, cy - 4, 1, 9, '#e6f6ff');
    p.line(cx - 3, cy - 3, cx + 3, cy + 3, '#9ad0ff', 1);
    p.line(cx - 3, cy + 3, cx + 3, cy - 3, '#9ad0ff', 1);
    p.rect(cx, cy, 1, 1, '#ffffff');
    // rime on the bottom staves
    p.dither(3, H - 9, W - 6, 3, '#e6f6ff');
  }, OUTLINE));

  Sprites.barrels = {};
  for (const [kind, img] of Object.entries({ explosive, poison, frost })) Sprites.barrels[kind] = { img, flash: PixelArt.silhouette(img) };
}
