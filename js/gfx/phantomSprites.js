// Phantom King sprites: a crowned, hooded spectre with floating claws and
// a tattered robe, plus its slow eye-laser bolt.
// Front-facing, so it never needs flipping. Same top-left-lit style as
// the other sprites (colour ramps darkest first).

const PHANTOM_SPRITE = { w: 96, h: 100, ax: 48, ay: 94 };  // anchor = tip of the tails
// eye positions relative to the anchor, used as laser origins
const PHANTOM_EYES = [{ x: -6, y: -67 }, { x: 6, y: -67 }];

const PHANTOM_ROBE = ['#0e0618', '#1e0f34', '#33195a', '#4e2a86', '#7048b4', '#9a78e0'];
const PHANTOM_GOLD = ['#4a2c08', '#8a5a14', '#d09a2a', '#ffe07a'];
const PHANTOM_VOID = '#05020a';
const PHANTOM_EYE = { calm: ['#1a6a80', '#7af8ff'], angry: ['#8a1070', '#ff4ad8'] };

/** pose.wave (0-3) animates the tails and claws; pose.angry turns the eyes magenta. */
function drawPhantomKing(p, pose) {
  const R = PHANTOM_ROBE;
  const G = PHANTOM_GOLD;
  const w = pose.wave;
  const [eyeD, eye] = pose.angry ? PHANTOM_EYE.angry : PHANTOM_EYE.calm;

  // tattered tails
  for (let i = 0; i < 7; i++) {
    const x0 = 27 + i * 6;
    const len = 12 + ((i + w) % 3) * 5;
    const sway = (i + w) % 2 ? 2 : -2;
    p.poly([[x0, 70], [x0 + 7, 70], [x0 + 3.5 + sway, 70 + len]], i % 2 ? R[2] : R[1]);
    p.line(x0 + 2, 71, x0 + 3 + sway / 2, 68 + len * 0.7, i % 2 ? R[3] : R[2]);
  }

  // robe
  p.poly([[30, 44], [66, 44], [72, 74], [24, 74]], R[2]);
  p.poly([[30, 44], [37, 44], [33, 74], [24, 74]], R[1]);
  p.line(61, 46, 67, 72, R[3]);
  p.line(62, 46, 68, 72, R[4]);
  p.line(42, 52, 40, 73, R[1]);
  p.line(54, 52, 56, 73, R[1]);
  p.rect(24, 72, 48, 2, G[1]);
  p.rect(25, 72, 46, 1, G[2]);

  // soul gem in the chest
  p.poly([[48, 49], [54, 56], [48, 63], [42, 56]], R[0]);
  p.poly([[48, 51], [52, 56], [48, 61], [44, 56]], eyeD);
  p.poly([[48, 53], [50, 56], [48, 59], [46, 56]], eye);
  p.px(47, 54, '#ffffff');

  // mantle with spiked collar
  p.poly([[30, 39], [27, 25], [37, 35]], R[2]);
  p.poly([[66, 39], [69, 25], [59, 35]], R[3]);
  p.poly([[16, 47], [29, 36], [67, 36], [80, 47], [71, 51], [60, 46], [48, 50], [36, 46], [25, 51]], R[3]);
  p.poly([[20, 45], [30, 38], [48, 38], [48, 40], [31, 40], [22, 46]], R[4]);
  p.rect(31, 37, 14, 1, R[5]);
  p.circle(48, 45, 3, G[1]);
  p.circle(48, 45, 2, G[2]);
  p.px(47, 44, G[3]);

  // hood and void face
  p.round(32, 12, 32, 30, R[2], 8);
  p.round(34, 13, 24, 9, R[3], 6);
  p.rect(37, 14, 10, 1, R[4]);
  p.rect(32, 20, 3, 18, R[1]);
  p.round(37, 20, 22, 18, PHANTOM_VOID, 6);
  if (pose.angry) {
    p.poly([[39, 25], [46, 28], [45, 30], [39, 28]], eyeD);
    p.poly([[57, 25], [50, 28], [51, 30], [57, 28]], eyeD);
    p.rect(40, 27, 5, 2, eye);
    p.rect(51, 27, 5, 2, eye);
    for (let x = 43; x < 54; x += 2) p.px(x, 34 + (x % 4 ? 0 : 1), eyeD); // jagged grin
  } else {
    p.rect(39, 26, 7, 4, eyeD);
    p.rect(50, 26, 7, 4, eyeD);
    p.rect(40, 27, 5, 2, eye);
    p.rect(51, 27, 5, 2, eye);
  }
  p.px(41, 27, '#ffffff');
  p.px(52, 27, '#ffffff');

  // crown
  for (const [x, top] of [[35, 5], [41, 3], [48, 0], [55, 3], [61, 5]]) {
    p.poly([[x - 3, 12], [x, top], [x + 3, 12]], G[2]);
    p.line(x - 1, top + 3, x - 2, 11, G[3]);
    p.px(x, top, G[3]);
  }
  p.rect(32, 10, 32, 5, G[1]);
  p.rect(32, 10, 32, 1, G[3]);
  p.rect(32, 14, 32, 1, G[0]);
  p.rect(46, 11, 4, 3, '#c81e4a');
  p.px(46, 11, '#ff8aa8');
  p.rect(38, 11, 2, 2, eye);
  p.rect(56, 11, 2, 2, eye);

  // floating claws
  const lift = [0, 1, 2, 1][w];
  for (const [hx, side] of [[13, -1], [83, 1]]) {
    const y = 54 - lift * (side < 0 ? 1 : -1) + 1;
    p.round(hx - 6, y, 12, 9, R[3], 2);
    p.rect(hx - 5, y + 1, 5, 1, R[4]);
    for (let k = 0; k < 3; k++) {
      const fx = hx - 4 + k * 3;
      p.rect(fx, y + 8, 2, 5, '#cfc7e8');
      p.px(fx + (side > 0 ? 1 : 0), y + 13, '#8a82a8');
    }
    // wisp trailing back toward the mantle
    p.line(hx - side * 4, y + 3, hx - side * 9, y - 3, R[2], 2);
  }
}

function buildPhantomSprites() {
  const frame = (pose) => {
    const img = PixelArt.make(PHANTOM_SPRITE.w, PHANTOM_SPRITE.h, (p) => drawPhantomKing(p, pose), OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  };
  const waves = [0, 1, 2, 3];
  Sprites.phantom = {
    idle: waves.map((wave) => frame({ wave, angry: false })),
    angry: waves.map((wave) => frame({ wave, angry: true })),
    // slow eye laser, points along +x
    laser: PixelArt.make(26, 9, (p) => {
      p.round(1, 2, 24, 5, '#8a1070', 2);
      p.round(3, 3, 21, 3, '#ff4ad8', 1);
      p.rect(10, 4, 13, 1, '#ffd0f6');
      p.rect(21, 3, 3, 3, '#ffffff');
    }, '#2a0428'),
  };
}
