// Phantom King sprites: a crowned, hooded spectre with floating claws and
// a tattered robe, plus its slow eye-laser bolt.
// Front-facing, so it never needs flipping. Same top-left-lit style as
// the other sprites (colour ramps darkest first).

const PHANTOM_SPRITE = { w: 96, h: 106, ax: 48, ay: 100 };  // anchor = tip of the tails (drawn 6px down: headroom for the hovering crown)
// eye positions relative to the anchor, used as laser origins
const PHANTOM_EYES = [{ x: -6, y: -67 }, { x: 6, y: -67 }];

const PHANTOM_ROBE = ['#0e0618', '#1e0f34', '#33195a', '#4e2a86', '#7048b4', '#9a78e0'];
const PHANTOM_GOLD = ['#4a2c08', '#8a5a14', '#d09a2a', '#ffe07a'];
const PHANTOM_VOID = '#05020a';
const PHANTOM_EYE = { calm: ['#1a6a80', '#7af8ff'], angry: ['#8a1070', '#ff4ad8'] };

/**
 * The Phantom King: a king-sized phantom (the wraith's big round hood with its
 * point flicking back, a void face, huge glowing eyes) gone ethereal and creepy:
 * the eyes weep streaks of light, ribs show faintly through the robe around the
 * soul gem, the hem frays into long ragged wisps, the crown hovers above the hood
 * and long bony claws trail ghostly sleeves. pose.wave (0-3) animates the wisps
 * and claws; pose.angry turns the eyes and gem magenta and splits the face in a grin.
 */
function drawPhantomKing(p, pose) {
  const R = PHANTOM_ROBE;
  const G = PHANTOM_GOLD;
  const w = pose.wave;
  const [eyeD, eye] = pose.angry ? PHANTOM_EYE.angry : PHANTOM_EYE.calm;
  const BONE = ['#6a6288', '#a8a0c8', '#dcd6f0'];

  // the hem frays into long ragged wisps that thin to nothing
  for (let i = 0; i < 9; i++) {
    const x0 = 22 + i * 6;
    const len = 14 + ((i * 2 + w) % 4) * 4 + (i % 3 === 1 ? 6 : 0);
    const sway = ((i + w) % 3) - 1;
    p.poly([[x0, 66], [x0 + 7, 66], [x0 + 4 + sway * 3, 66 + len]], i % 2 ? R[2] : R[1]);
    p.line(x0 + 3, 68, x0 + 4 + sway * 2, 62 + len * 0.8, i % 2 ? R[3] : R[2]);
    if (i % 3 === 0) p.px(x0 + 4 + sway * 4, 66 + len + 3, R[3]);   // a torn-off scrap drifting free
  }

  // robe: wider at the hem, ragged, with tears showing the void behind
  p.poly([[31, 42], [65, 42], [74, 70], [22, 70]], R[2]);
  p.poly([[31, 42], [38, 42], [32, 70], [22, 70]], R[1]);
  p.line(60, 44, 70, 68, R[3]);
  p.line(61, 44, 71, 68, R[4]);
  p.line(41, 50, 38, 69, R[1]);
  p.line(55, 50, 58, 69, R[1]);
  p.poly([[28, 62], [31, 58], [33, 66]], PHANTOM_VOID);
  p.poly([[66, 60], [68, 56], [70, 65]], PHANTOM_VOID);
  // faint ribs showing through the cloth around the gem
  for (const ry of [47, 52, 57]) {
    p.line(36, ry + 2, 43, ry, BONE[0]);
    p.line(53, ry, 60, ry + 2, BONE[0]);
  }
  p.line(48, 44, 48, 62, BONE[0]);

  // the soul gem, hung where a heart would be
  p.poly([[48, 47], [55, 55], [48, 63], [41, 55]], R[0]);
  p.poly([[48, 49], [53, 55], [48, 61], [43, 55]], eyeD);
  p.poly([[48, 51], [51, 55], [48, 59], [45, 55]], eye);
  p.px(47, 52, '#ffffff');
  p.px(46, 53, '#ffffff');

  // mantle: tattered shoulders and a ragged spiked collar
  p.poly([[16, 46], [29, 35], [67, 35], [80, 46], [74, 52], [68, 47], [62, 51], [56, 46], [48, 50], [40, 46], [34, 51], [28, 47], [22, 52]], R[3]);
  p.poly([[20, 44], [30, 37], [48, 37], [48, 39], [31, 39], [22, 45]], R[4]);
  p.rect(31, 36, 14, 1, R[5]);
  p.poly([[29, 37], [25, 24], [36, 33]], R[2]);
  p.poly([[67, 37], [71, 24], [60, 33]], R[3]);
  p.circle(48, 44, 3, G[1]);
  p.circle(48, 44, 2, G[2]);
  p.px(47, 43, G[3]);

  // the big round hood (the wraith's), its point flicking back
  p.poly([[34, 18], [22, 10 + (w % 2) * 2], [30, 24]], R[2]);
  p.line(33, 18, 24, 11 + (w % 2) * 2, R[3]);
  p.round(31, 10, 34, 32, R[2], 11);
  p.round(34, 11, 22, 8, R[3], 5);
  p.rect(37, 12, 10, 1, R[4]);
  p.px(36, 13, R[5]);
  p.rect(31, 20, 3, 18, R[1]);
  p.round(36, 18, 24, 21, PHANTOM_VOID, 8);

  // huge glowing eyes (the eye lasers fire from 42,27 and 54,27) weeping streaks of light
  if (pose.angry) {
    p.poly([[37, 22], [46, 26], [46, 32], [38, 29]], eyeD);
    p.poly([[59, 22], [50, 26], [50, 32], [58, 29]], eyeD);
    p.rect(40, 26, 5, 4, eye);
    p.rect(51, 26, 5, 4, eye);
    // the void splits in a too-wide grin
    for (let x = 40; x < 57; x += 2) p.rect(x, 34 + (x % 4 ? 0 : 1), 1, 2, eyeD);
    p.rect(40, 35, 16, 1, eye);
  } else {
    p.round(38, 23, 8, 9, eyeD, 2);
    p.round(50, 23, 8, 9, eyeD, 2);
    p.round(39, 24, 6, 7, eye, 2);
    p.round(51, 24, 6, 7, eye, 2);
  }
  p.rect(40, 25, 2, 2, '#ffffff');
  p.rect(52, 25, 2, 2, '#ffffff');
  // light running down from the eyes like tears
  for (const [tx, len] of [[42, 6 + (w % 2)], [44, 3], [54, 5 + ((w + 1) % 2)], [52, 3]]) {
    p.rect(tx, 32, 1, len, eyeD);
    p.px(tx, 32 + len, eye);
  }

  // the crown hovers just above the hood, held up by nothing
  const lift = [0, 1, 2, 1][w];
  const cy = -lift;
  for (const [x, top] of [[35, 5], [41, 3], [48, 0], [55, 3], [61, 5]]) {
    p.poly([[x - 3, 11 + cy], [x, top + cy + 1], [x + 3, 11 + cy]], G[2]);
    p.line(x - 1, top + cy + 4, x - 2, 10 + cy, G[3]);
    p.px(x, top + cy + 1, G[3]);
  }
  p.rect(32, 8 + cy, 32, 4, G[1]);
  p.rect(32, 8 + cy, 32, 1, G[3]);
  p.rect(32, 11 + cy, 32, 1, G[0]);
  p.rect(46, 9 + cy, 4, 2, '#c81e4a');
  p.px(46, 9 + cy, '#ff8aa8');
  p.rect(38, 9 + cy, 2, 2, eye);
  p.rect(56, 9 + cy, 2, 2, eye);

  // floating claws: wisps of sleeve, long bony fingers ending in hooks
  for (const [hx, side] of [[12, -1], [84, 1]]) {
    const y = 52 - lift * (side < 0 ? 1 : -1) + 1;
    p.line(hx - side * 5, y + 3, hx - side * 14, y - 6, R[2], 3);
    p.line(hx - side * 6, y + 2, hx - side * 13, y - 5, R[3]);
    p.round(hx - 6, y, 12, 8, R[3], 3);
    p.rect(hx - 5, y + 1, 5, 1, R[4]);
    for (let k = 0; k < 4; k++) {
      const fx = hx - 5 + k * 3;
      const flen = 7 + (k === 1 || k === 2 ? 3 : 0);
      p.rect(fx, y + 7, 2, flen, BONE[1]);
      p.px(fx, y + 7 + Math.floor(flen / 2), BONE[0]);   // knuckle
      p.px(fx + side, y + 7 + flen, BONE[2]);           // hooked tip
    }
  }
}

function buildPhantomSprites() {
  const frame = (pose) => {
    const img = PixelArt.make(PHANTOM_SPRITE.w, PHANTOM_SPRITE.h, (p) => { p.ctx.translate(0, 6); drawPhantomKing(p, pose); }, OUTLINE, 0.5);
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
