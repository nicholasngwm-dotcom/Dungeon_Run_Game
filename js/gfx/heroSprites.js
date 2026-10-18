// Hero sprites: 64x64 detailed pixel-art characters with realistic
// proportions, drawn facing right and lit from the top-left.
// Layout (in sprite pixels): head y9-20, torso y20-36, legs y36-59.
// Anchor point (the entity's x,y) is at (32, 50).

const Sprites = {};

const HERO_ANCHOR = { x: 32, y: 50 };

// Animation poses. bob moves the upper body, stride swings the legs
// (front foot forward when positive), liftF/liftB raise a foot.
const HERO_POSES = {
  idle: [{ bob: 0 }, { bob: 1 }],
  walk: [
    { bob: 0, stride: 3 },
    { bob: -1, stride: 0, liftB: 2 },
    { bob: 0, stride: -3 },
    { bob: -1, stride: 0, liftF: 2 },
  ],
};

// Colour ramps, darkest first.
const RAMP = {
  steel: ['#1f2029', '#383b48', '#585d6c', '#80869a', '#adb2c0', '#e4e7ee'],
  red: ['#2a0910', '#50131d', '#7c1f2a', '#a63036', '#cc5046'],
  leather: ['#22150e', '#3b2416', '#5b3922', '#7d532f', '#9c6c3e'],
  gold: ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'],
  skin: ['#6a3c30', '#b37158', '#e0a584', '#f7d3b6'],
};

// Shifts every point of a polygon down by dy (used for the idle bob).
const shift = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);

// ---------- shared body parts ----------

/**
 * One leg from the hip (row `top`) to the foot (row `floor`), slanting from
 * hipX to footX. ramp/boot are [dark, mid, light]; returns the leg's x at a row.
 */
function heroLeg(p, hipX, footX, lift, w, ramp, boot, bootTop, top = 36, floor = 58) {
  const bottom = floor - lift;
  const xAt = (y) => Math.round(hipX + ((footX - hipX) * (y - top)) / (bottom - top));
  for (let y = top; y <= bottom; y++) {
    const r = y >= bootTop - lift ? boot : ramp;
    const x = xAt(y);
    p.rect(x, y, w, 1, r[1]);
    p.px(x, y, r[2]);
    p.px(x + w - 1, y, r[0]);
  }
  // toe cap pointing forward
  const fx = xAt(bottom);
  p.rect(fx + 1, bottom - 1, w + 1, 2, boot[1]);
  p.rect(fx + 1, bottom - 1, w, 1, boot[2]);
  p.rect(fx, bottom, w + 2, 1, boot[0]);
  return xAt;
}

/** Back leg then front leg, following the pose. opts: backX, frontX, top, floor. */
function heroLegs(p, pose, w, back, front, bootTop, opts = {}) {
  const { backX = 27, frontX = 32, top = 36, floor = 58 } = opts;
  const s = pose.stride || 0;
  const xb = heroLeg(p, backX, backX - s, pose.liftB || 0, w, back.leg, back.boot, bootTop, top, floor);
  const xf = heroLeg(p, frontX, frontX + s, pose.liftF || 0, w, front.leg, front.boot, bootTop, top, floor);
  return { xb, xf };
}

/** Side-on face: skin block, eye, nose and mouth. */
function heroFace(p, b, skin, eye, opts = {}) {
  p.round(30, 11 + b, 9, 10, skin[2], 2);
  p.rect(30, 17 + b, 3, 3, skin[1]); // jaw shadow
  p.px(39, 16 + b, skin[2]);         // nose
  p.px(39, 17 + b, skin[1]);
  p.rect(36, 19 + b, 2, 1, opts.mouth || skin[1]);
  p.px(33, 13 + b, skin[3]);
  // eye: lash line, iris, glint
  p.rect(35, 14 + b, 3, 1, OUTLINE);
  p.rect(35, 15 + b, 2, opts.bigEyes ? 2 : 1, eye);
  p.px(36, 15 + b, '#ffffff');
}

// ---------- classes ----------

function drawWarrior(p, pose) {
  const b = pose.bob;
  const S = RAMP.steel;
  const R = RAMP.red;
  const L = RAMP.leather;
  const G = RAMP.gold;

  // cape flowing behind
  p.poly([[25, 21 + b], [31, 21 + b], [30, 40], [29, 55], [23, 57], [16, 56], [18, 44], [21, 30 + b]], R[2]);
  p.line(24, 24 + b, 19, 52, R[1]);
  p.line(28, 28 + b, 25, 55, R[1]);
  p.line(23, 22 + b, 18, 46, R[3]);
  p.rect(17, 55, 12, 1, R[1]);

  // plate legs with knee cops
  const legs = heroLegs(p, pose, 5,
    { leg: [S[0], S[1], S[2]], boot: [S[0], S[1], S[2]] },
    { leg: [S[1], S[3], S[4]], boot: [S[0], S[2], S[3]] }, 54);
  for (const [xAt, c] of [[legs.xb, S[2]], [legs.xf, S[4]]]) {
    const kx = xAt(46);
    p.round(kx - 1, 45, 7, 3, c, 1);
    p.px(kx, 45, S[5]);
    p.rect(kx, 48, 5, 1, S[0]);
  }

  // back pauldron
  p.round(22, 21 + b, 7, 6, S[2], 2);
  p.rect(23, 22 + b, 4, 1, S[3]);

  // faulds (hip plates)
  p.poly(shift([[26, 34], [38, 34], [39, 41], [25, 41]], b), S[2]);
  p.rect(26, 35 + b, 12, 1, S[3]);
  p.rect(26, 37 + b, 13, 1, S[0]);
  p.rect(26, 38 + b, 13, 1, S[3]);
  p.rect(25, 40 + b, 14, 1, S[1]);

  // breastplate
  p.poly(shift([[25, 21], [40, 21], [40, 27], [38, 34], [27, 34], [25, 27]], b), S[3]);
  p.rect(26, 22 + b, 6, 6, S[4]);
  p.rect(27, 22 + b, 3, 2, S[5]);
  p.rect(37, 23 + b, 3, 5, S[2]);
  p.rect(28, 30 + b, 10, 4, S[2]);
  p.rect(33, 22 + b, 1, 11, S[5]); // centre ridge
  p.rect(34, 22 + b, 1, 11, S[1]);
  p.rect(28, 29 + b, 10, 1, S[1]);
  // belt
  p.rect(26, 33 + b, 13, 2, L[2]);
  p.rect(26, 33 + b, 13, 1, L[3]);
  p.rect(32, 33 + b, 3, 2, G[2]);
  p.px(33, 33 + b, G[3]);

  // gorget
  p.round(29, 18 + b, 9, 4, S[2], 1);
  p.rect(30, 18 + b, 6, 1, S[4]);

  // plume, then the great helm over its base
  p.poly(shift([[33, 7], [34, 3], [31, 1], [26, 1], [21, 4], [16, 9], [14, 15], [18, 12], [23, 9], [28, 8]], b), R[2]);
  p.line(32, 3 + b, 19, 8 + b, R[3]);
  p.line(29, 6 + b, 16, 13 + b, R[1]);
  p.line(31, 2 + b, 25, 2 + b, R[4]);
  p.line(26, 5 + b, 19, 10 + b, R[3]);
  p.round(27, 7 + b, 12, 14, S[3], 3);
  p.rect(28, 9 + b, 3, 9, S[4]);
  p.rect(29, 8 + b, 4, 1, S[5]);
  p.rect(28, 10 + b, 1, 5, S[5]);
  p.rect(36, 9 + b, 2, 11, S[2]);
  p.rect(31, 12 + b, 8, 1, S[4]);   // brow band
  p.rect(31, 13 + b, 8, 1, '#0b0a10'); // eye slit
  p.rect(35, 8 + b, 1, 5, S[5]);    // front ridge
  p.rect(35, 14 + b, 1, 6, S[4]);
  for (const [hx, hy] of [[37, 16], [37, 18], [33, 16], [33, 18]]) p.px(hx, hy + b, S[0]);
  p.rect(27, 19 + b, 12, 1, S[1]);
  p.px(29, 12 + b, S[5]);
  p.px(29, 17 + b, S[5]);
  p.px(32, 6 + b, S[4]);            // plume holder

  // kite shield on the off arm
  p.poly(shift([[15, 25], [28, 25], [28, 33], [25, 41], [21, 47], [18, 41], [15, 33]], b), S[3]);
  p.poly(shift([[16, 26], [27, 26], [27, 33], [24, 40], [21, 45], [18, 40], [16, 33]], b), R[2]);
  p.poly(shift([[22, 26], [27, 26], [27, 33], [24, 40], [21, 45]], b), R[1]);
  p.rect(17, 27 + b, 1, 8, R[3]);
  p.rect(16, 25 + b, 8, 1, S[5]);
  p.rect(20, 28 + b, 2, 14, S[4]);
  p.rect(20, 28 + b, 1, 14, S[5]);
  p.rect(17, 31 + b, 8, 2, S[4]);
  p.rect(17, 31 + b, 8, 1, S[5]);
  p.rect(20, 31 + b, 2, 2, '#d0303a');
  p.px(20, 31 + b, '#ff9a8a');

  // sword arm: pauldron, vambrace, gauntlet
  p.rect(37, 27 + b, 4, 5, S[2]);
  p.px(37, 28 + b, S[4]);
  p.rect(38, 31 + b, 4, 4, S[3]);
  p.rect(38, 31 + b, 1, 4, S[5]);
  p.rect(38, 35 + b, 4, 3, S[1]);
  p.rect(39, 35 + b, 2, 1, S[3]);
  p.round(35, 20 + b, 8, 7, S[3], 2);
  p.rect(36, 21 + b, 4, 1, S[5]);
  p.rect(36, 22 + b, 2, 2, S[4]);
  p.rect(35, 25 + b, 8, 1, S[1]);
  p.rect(36, 26 + b, 6, 1, S[2]);
}

function drawRanger(p, pose) {
  const b = pose.bob;
  const B = ['#6a4416', '#a8742a', '#d8a640', '#f4d47a', '#fff0b8']; // blonde
  const Gr = ['#17220f', '#2c3d1a', '#456026', '#62802f', '#88a446'];
  const C = ['#7a6a4a', '#b8a67e', '#e0d2aa', '#f8f0d8'];               // cream linen
  const L = RAMP.leather;
  const K = RAMP.skin;
  const G = RAMP.gold;

  // quiver across the back with arrows
  p.poly(shift([[20, 19], [25, 18], [28, 34], [23, 35]], b), L[2]);
  p.line(21, 20 + b, 24, 34 + b, L[3]);
  p.rect(20, 18 + b, 6, 2, L[1]);
  for (const [x0, x1, tip] of [[21, 18, '#d84a4a'], [23, 21, C[2]], [25, 24, C[3]]]) {
    p.line(x0, 18 + b, x1, 11 + b, L[4]);
    p.rect(x1 - 1, 10 + b, 2, 3, tip);
  }

  // ponytail flowing behind
  p.poly(shift([[29, 12], [32, 13], [30, 21], [28, 30], [24, 35], [22, 32], [25, 23]], b), B[2]);
  p.line(28, 15 + b, 24, 31 + b, B[1]);
  p.line(30, 14 + b, 27, 26 + b, B[3]);
  p.px(23, 33 + b, B[1]);

  // bare legs, tall boots
  heroLegs(p, pose, 4,
    { leg: [K[0], K[1], K[2]], boot: [L[0], L[1], L[2]] },
    { leg: [K[1], K[2], K[3]], boot: [L[1], L[2], L[3]] }, 46);

  // back sleeve
  p.round(24, 21 + b, 5, 5, C[1], 1);

  // bodice
  p.poly(shift([[26, 21], [38, 21], [39, 27], [37, 34], [28, 34], [26, 27]], b), Gr[2]);
  p.rect(27, 22 + b, 4, 6, Gr[3]);
  p.px(28, 22 + b, Gr[4]);
  p.rect(36, 23 + b, 2, 9, Gr[1]);
  p.rect(30, 20 + b, 6, 2, C[2]); // blouse collar
  p.px(31, 20 + b, C[3]);
  for (let y = 24; y < 33; y += 2) p.px(34, y + b, C[3]); // lacing
  p.line(27, 22 + b, 37, 33 + b, L[2]); // quiver strap
  p.line(28, 22 + b, 38, 33 + b, L[1]);

  // skirt + belt with pouch
  p.poly(shift([[27, 35], [37, 35], [40, 43], [24, 43]], b), C[2]);
  p.poly(shift([[27, 35], [30, 35], [27, 43], [24, 43]], b), C[3]);
  p.line(32, 36 + b, 31, 42 + b, C[1]);
  p.line(36, 36 + b, 38, 42 + b, C[1]);
  p.rect(24, 42 + b, 16, 1, C[1]);
  p.rect(27, 33 + b, 11, 2, L[2]);
  p.rect(27, 33 + b, 11, 1, L[3]);
  p.rect(30, 33 + b, 2, 2, G[2]);
  p.round(35, 34 + b, 4, 5, L[2], 1);
  p.rect(35, 34 + b, 4, 1, L[4]);
  p.px(37, 36 + b, G[2]);

  // head: face, pointed ear, hair
  heroFace(p, b, K, '#2a8ad0', { bigEyes: true, mouth: '#c46a6a' });
  p.px(34, 18 + b, '#f0a0a0'); // blush
  p.round(28, 8 + b, 11, 7, B[2], 3);
  p.rect(30, 9 + b, 6, 1, B[3]);
  p.rect(31, 9 + b, 2, 1, B[4]);
  p.rect(33, 13 + b, 6, 1, B[2]);          // bangs
  p.px(38, 14 + b, B[2]);
  p.px(35, 14 + b, B[1]);
  p.rect(29, 12 + b, 2, 9, B[2]);          // side lock
  p.rect(29, 12 + b, 1, 9, B[3]);
  p.px(30, 20 + b, B[1]);
  p.line(31, 15 + b, 27, 11 + b, K[2]);    // elf ear
  p.line(31, 16 + b, 28, 12 + b, K[1]);
  p.px(27, 11 + b, K[3]);
  p.rect(28, 12 + b, 2, 2, Gr[3]);         // hair tie

  // bow arm: puff sleeve, bare arm, leather bracer
  p.rect(38, 25 + b, 3, 5, K[2]);
  p.px(38, 25 + b, K[3]);
  p.rect(38, 30 + b, 4, 4, L[2]);
  p.rect(38, 30 + b, 4, 1, L[4]);
  p.rect(39, 34 + b, 3, 3, K[2]);
  p.round(35, 20 + b, 6, 5, C[2], 1);
  p.rect(36, 21 + b, 3, 1, C[3]);
  p.rect(35, 24 + b, 6, 1, Gr[2]);
}

function drawMage(p, pose) {
  const b = pose.bob;
  const H = ['#141319', '#22212b', '#33323d', '#484652', '#605d6c'];        // hat
  const K = ['#121218', '#1f1f28', '#2f2f3b', '#424250', '#5a5a6c'];        // cloak
  const W = ['#4a4856', '#74727f', '#9f9daa', '#c9c7d2', '#ecebf2'];        // robe
  const P = ['#2e1650', '#5a2a9a', '#8e4ee0', '#c79aff', '#f0e0ff'];        // amethyst
  const A = ['#6a5c48', '#a08c6a', '#cdb994', '#efe0bc'];                   // ash hair
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const s = pose.stride || 0;

  // long dark cloak behind, ragged hem
  p.poly([[26, 20 + b], [34, 20 + b], [32, 30], [31, 58], [26, 57], [23, 59], [20, 56], [17, 58], [16, 48], [20, 32], [23, 24 + b]], K[1]);
  p.line(24, 24 + b, 19, 52, K[2]);
  p.line(27, 28 + b, 25, 56, K[0]);
  p.line(22, 30, 18, 55, K[0]);

  // boots under the robe
  for (const [x, lift, c] of [[27 - s, pose.liftB || 0, L[1]], [33 + s, pose.liftF || 0, L[2]]]) {
    p.rect(x, 55 - lift, 5, 3, c);
    p.rect(x + 1, 57 - lift, 6, 2, c);
    p.rect(x + 1, 57 - lift, 5, 1, L[3]);
  }

  // pale under-robe, flaring to the hem
  const hem = Math.round(s / 2);
  p.poly(shift([[27, 24], [38, 24], [39, 34]], b).concat([[42 + hem, 57], [23 + hem, 57]], shift([[26, 34]], b)), W[2]);
  p.poly(shift([[27, 24], [30, 24]], b).concat([[27 + hem, 57], [23 + hem, 57]], shift([[26, 34]], b)), W[3]);
  p.poly(shift([[37, 30], [39, 34]], b).concat([[42 + hem, 57], [38 + hem, 57]]), W[1]);
  p.line(35, 36 + b, 36 + hem, 56, W[0]);       // front opening
  for (let y = 38; y < 56; y += 3) p.px(34 + Math.round(((y - 36) * hem) / 20), y + b, P[2]);
  p.rect(23 + hem, 55, 20, 1, P[1]);           // hem trim
  p.rect(23 + hem, 56, 20, 1, W[1]);
  for (let x = 25; x < 40; x += 4) {           // rune diamonds
    p.px(x + hem, 51, W[0]); p.px(x + hem - 1, 52, W[0]); p.px(x + hem + 1, 52, W[0]); p.px(x + hem, 53, W[0]);
  }
  // cloak edge over the back of the robe
  p.poly([[25, 26 + b], [29, 26 + b], [27, 40], [25, 57], [22, 57], [23, 40]], K[2]);
  p.line(28, 27 + b, 26, 56, K[3]);

  // belt, amethyst, tassel
  p.rect(27, 33 + b, 12, 2, K[0]);
  p.rect(27, 33 + b, 12, 1, K[2]);
  p.rect(33, 33 + b, 2, 2, P[2]);
  p.px(33, 33 + b, P[4]);
  p.line(34, 35 + b, 33, 42 + b, P[1]);
  p.rect(32, 42 + b, 2, 3, P[2]);
  p.px(32, 42 + b, P[3]);

  // mantle with high collar and clasp
  p.poly(shift([[23, 21], [40, 21], [42, 27], [38, 29], [34, 27], [28, 29], [22, 27]], b), K[2]);
  p.rect(24, 21 + b, 15, 1, K[3]);
  p.rect(24, 22 + b, 5, 3, K[3]);
  p.line(28, 23 + b, 31, 28 + b, K[1]);
  p.rect(28, 18 + b, 9, 3, K[2]);
  p.rect(28, 18 + b, 9, 1, K[4]);
  p.rect(35, 22 + b, 3, 3, P[1]);
  p.rect(35, 22 + b, 2, 2, P[2]);
  p.px(35, 22 + b, P[4]);

  // head: hair behind, face, bangs
  p.rect(27, 12 + b, 6, 11, A[1]);
  p.rect(28, 12 + b, 2, 10, A[2]);
  heroFace(p, b, Sk, P[2]);
  p.rect(32, 12 + b, 7, 2, Sk[1]);         // shade under the brim
  p.rect(32, 12 + b, 6, 2, A[2]);
  p.px(33, 14 + b, A[2]);
  p.px(36, 14 + b, A[1]);
  p.rect(31, 13 + b, 2, 8, A[2]);
  p.rect(31, 13 + b, 1, 8, A[3]);

  // witch hat: wide brim, cone bending back
  p.poly(shift([[19, 13], [27, 10], [40, 10], [48, 12], [45, 14], [36, 15], [26, 15], [20, 15]], b), H[2]);
  p.poly(shift([[20, 14], [26, 14], [36, 14], [46, 13], [45, 14], [36, 15], [26, 15], [20, 15]], b), H[0]);
  p.line(21, 13 + b, 44, 12 + b, H[3]);
  p.poly(shift([[27, 11], [39, 11], [37, 7], [34, 3], [30, 1], [25, 1], [21, 3], [25, 4], [29, 5], [28, 8]], b), H[2]);
  p.poly(shift([[27, 11], [31, 11], [31, 6], [29, 3], [25, 2], [24, 3], [28, 5]], b), H[3]);
  p.line(22, 2 + b, 26, 2 + b, H[4]);
  p.line(36, 6 + b, 38, 10 + b, H[1]);
  p.line(29, 6 + b, 35, 7 + b, H[0]);
  p.rect(28, 9 + b, 11, 2, P[1]);           // band
  p.rect(28, 9 + b, 11, 1, P[2]);
  p.rect(32, 9 + b, 3, 2, W[3]);           // buckle
  p.px(33, 10 + b, W[1]);

  // casting arm: wide pale sleeve, cuff, open hand
  p.poly(shift([[36, 24], [40, 23], [43, 30], [44, 36], [39, 37], [37, 31]], b), W[3]);
  p.poly(shift([[40, 31], [44, 36], [39, 37]], b), W[1]);
  p.line(37, 24 + b, 39, 33 + b, W[4]);
  p.rect(39, 34 + b, 6, 2, P[1]);
  p.rect(40, 36 + b, 3, 2, Sk[2]);
  p.px(43, 36 + b, Sk[2]);
}

function drawRogue(p, pose) {
  const b = pose.bob;
  const D = ['#121218', '#1e1e28', '#2c2c3a', '#3e3e52', '#56566e'];
  const Rd = ['#3a0c14', '#6a1622', '#9a2230', '#c43a44'];
  const L = ['#1e1410', '#33221a', '#4c3426', '#6a4a34', '#86603f'];
  const Sk = RAMP.skin;
  const S = RAMP.steel;

  // scarf tail fluttering behind
  const f = pose.stride !== undefined && pose.stride === 0 ? 1 : 0;
  p.poly(shift([[29, 20], [23, 19 - f], [17, 21 - f], [11, 19 - f * 2], [13, 23], [19, 24], [28, 24]], b), Rd[2]);
  p.line(27, 22 + b, 14, 21 + b - f, Rd[1]);
  p.line(26, 20 + b, 18, 20 + b - f, Rd[3]);

  // dark trousers, wrapped boots
  const legs = heroLegs(p, pose, 5,
    { leg: [D[0], D[1], D[2]], boot: [L[0], L[1], L[2]] },
    { leg: [D[1], D[2], D[3]], boot: [L[1], L[2], L[3]] }, 49);
  for (const [xAt, c] of [[legs.xb, L[1]], [legs.xf, L[0]]]) {
    p.rect(xAt(51), 51, 5, 1, c);
    p.rect(xAt(53), 53, 5, 1, c);
  }

  // back arm
  p.rect(24, 23 + b, 4, 11, D[1]);

  // leather jerkin with straps and dagger belt
  p.poly(shift([[26, 21], [38, 21], [39, 27], [38, 36], [27, 36], [25, 27]], b), L[2]);
  p.rect(27, 22 + b, 4, 7, L[3]);
  p.px(28, 22 + b, L[4]);
  p.rect(36, 23 + b, 2, 11, L[1]);
  p.line(27, 22 + b, 37, 33 + b, D[1]);
  p.line(28, 22 + b, 38, 33 + b, D[2]);
  p.rect(26, 33 + b, 13, 2, D[1]);
  p.rect(26, 33 + b, 13, 1, D[3]);
  p.rect(30, 33 + b, 2, 2, S[4]);
  p.rect(26, 35 + b, 13, 3, L[1]); // hip flap
  p.line(27, 34 + b, 25, 38 + b, D[0]); // dagger hilt at hip
  p.px(25, 39 + b, S[4]);

  // mantle
  p.poly(shift([[24, 20], [40, 20], [41, 25], [36, 27], [31, 24], [26, 27], [23, 25]], b), D[2]);
  p.rect(25, 20 + b, 13, 1, D[3]);
  p.rect(25, 21 + b, 4, 2, D[3]);

  // head: shadowed face, glowing eye, red mask
  p.round(31, 12 + b, 8, 9, Sk[1], 2);
  p.rect(31, 12 + b, 8, 2, Sk[0]);
  p.px(39, 16 + b, Sk[1]);
  p.rect(35, 15 + b, 3, 1, OUTLINE);
  p.rect(35, 15 + b, 2, 1, '#f0b030');
  p.px(36, 15 + b, '#fff2b0');
  p.rect(34, 14 + b, 4, 1, D[0]); // brow
  p.rect(32, 17 + b, 8, 4, Rd[2]);
  p.rect(32, 17 + b, 8, 1, Rd[3]);
  p.rect(33, 19 + b, 6, 1, Rd[1]);
  p.rect(29, 19 + b, 9, 3, Rd[2]);
  p.rect(29, 21 + b, 9, 1, Rd[1]);
  // hood
  p.poly(shift([[28, 22], [27, 13], [29, 9], [33, 8], [37, 9], [39, 12], [36, 11], [33, 11], [31, 14], [31, 21]], b), D[2]);
  p.poly(shift([[27, 13], [24, 11], [22, 13], [24, 15], [27, 17]], b), D[2]);
  p.rect(30, 9 + b, 4, 1, D[4]);
  p.rect(28, 10 + b, 3, 1, D[3]);
  p.line(32, 11 + b, 37, 10 + b, D[4]);
  p.line(31, 12 + b, 30, 20 + b, D[3]);
  p.line(28, 14 + b, 28, 20 + b, D[1]);

  // dagger arm: sleeve, bracer, hand
  p.rect(37, 24 + b, 4, 6, D[2]);
  p.px(37, 25 + b, D[3]);
  p.rect(38, 30 + b, 4, 4, L[2]);
  p.rect(38, 31 + b, 4, 1, L[0]);
  p.rect(38, 33 + b, 4, 1, L[0]);
  p.rect(39, 34 + b, 3, 3, Sk[1]);
  p.round(35, 20 + b, 6, 5, D[3], 1);
  p.rect(36, 21 + b, 3, 1, D[4]);
}

function drawPriestess(p, pose) {
  const b = pose.bob;
  const W = ['#7a7486', '#a8a2b4', '#d4cfdc', '#f0edf4', '#ffffff'];        // white robe
  const Bl = ['#1e2a5a', '#2e4490', '#4a6ad0', '#8aa8ff'];                  // blue tabard
  const Hr = ['#5a3a1a', '#8a5a2a', '#b8843e', '#e0b060'];                  // auburn hair
  const G = RAMP.gold;
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const s = pose.stride || 0;

  // veil trailing down the back
  p.poly([[25, 12 + b], [31, 12 + b], [31, 30 + b], [28, 42], [21, 44], [22, 28 + b]], W[2]);
  p.line(24, 16 + b, 22, 42, W[1]);
  p.line(27, 16 + b, 26, 41, W[3]);

  // sandals under the robe
  for (const [x, lift, c] of [[27 - s, pose.liftB || 0, L[2]], [33 + s, pose.liftF || 0, L[3]]]) {
    p.rect(x, 55 - lift, 5, 3, c);
    p.rect(x + 1, 57 - lift, 6, 2, c);
    p.rect(x + 1, 57 - lift, 5, 1, G[1]);
  }

  // white robe, flaring to a gold hem
  const hem = Math.round(s / 2);
  p.poly(shift([[27, 22], [38, 22], [39, 34]], b).concat([[42 + hem, 57], [23 + hem, 57]], shift([[26, 34]], b)), W[3]);
  p.poly(shift([[27, 22], [30, 22]], b).concat([[27 + hem, 57], [23 + hem, 57]], shift([[26, 34]], b)), W[4]);
  p.poly(shift([[37, 30], [39, 34]], b).concat([[42 + hem, 57], [38 + hem, 57]]), W[1]);
  p.rect(23 + hem, 55, 20, 1, G[2]);
  p.rect(23 + hem, 56, 20, 1, G[1]);

  // blue tabard down the front with a gold cross
  p.poly(shift([[32, 24], [37, 24], [37, 34]], b).concat([[38 + hem, 55], [32 + hem, 55]], shift([[32, 34]], b)), Bl[2]);
  p.line(33, 25 + b, 33 + hem, 54, Bl[3]);
  p.line(37, 34 + b, 38 + hem, 54, Bl[1]);
  p.rect(35 + hem, 41, 1, 7, G[3]);
  p.rect(33 + hem, 43, 5, 1, G[3]);

  // gold belt
  p.rect(27, 33 + b, 12, 2, G[1]);
  p.rect(27, 33 + b, 12, 1, G[2]);
  p.rect(33, 33 + b, 2, 2, G[3]);

  // mantle with gold edging
  p.poly(shift([[24, 21], [40, 21], [41, 26], [36, 27], [31, 25], [27, 27], [23, 26]], b), W[3]);
  p.rect(25, 21 + b, 14, 1, W[4]);
  p.line(23, 26 + b, 27, 27 + b, G[2]);
  p.line(36, 27 + b, 41, 26 + b, G[2]);
  p.line(31, 25 + b, 36, 27 + b, G[1]);

  // head: hair behind, face, bangs
  p.rect(27, 12 + b, 6, 12, Hr[1]);
  p.rect(28, 12 + b, 2, 11, Hr[2]);
  heroFace(p, b, Sk, Bl[2]);
  p.rect(31, 11 + b, 8, 2, Hr[2]);
  p.rect(31, 13 + b, 2, 6, Hr[2]);
  p.rect(31, 13 + b, 1, 6, Hr[3]);
  p.px(37, 13 + b, Hr[1]);

  // white veil over the head, gold circlet with a gem
  p.poly(shift([[28, 13], [29, 9], [33, 8], [38, 9], [40, 11], [36, 10], [31, 10], [30, 14], [29, 22], [27, 22]], b), W[3]);
  p.line(30, 9 + b, 37, 9 + b, W[4]);
  p.rect(31, 10 + b, 8, 1, G[2]);
  p.px(37, 10 + b, '#6ad8ff');

  // halo
  p.rect(28, 3 + b, 11, 1, G[3]);
  p.px(27, 4 + b, G[2]);
  p.px(39, 4 + b, G[2]);
  p.rect(28, 5 + b, 11, 1, G[2]);

  // casting arm: wide white sleeve, gold cuff, hand
  p.poly(shift([[36, 23], [40, 22], [43, 29], [44, 35], [39, 36], [37, 30]], b), W[3]);
  p.poly(shift([[40, 30], [44, 35], [39, 36]], b), W[1]);
  p.line(37, 23 + b, 39, 32 + b, W[4]);
  p.rect(39, 33 + b, 6, 2, G[2]);
  p.rect(40, 35 + b, 3, 2, Sk[2]);
}

// ---------- frame building ----------

/** Builds { idle: [frame], walk: [frame] } where frame = { img, flash }. */
function buildPoseFrames(drawFn, size, poses = HERO_POSES, tint = 0) {
  const out = {};
  for (const [name, list] of Object.entries(poses)) {
    out[name] = list.map((pose) => {
      const img = PixelArt.make(size, size, (p) => drawFn(p, pose), OUTLINE, tint);
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  return out;
}

function buildHeroSprites() {
  Sprites.heroes = {
    warrior: buildPoseFrames(drawWarrior, 64, HERO_POSES, 0.5),
    ranger: buildPoseFrames(drawRanger, 64, HERO_POSES, 0.5),
    mage: buildPoseFrames(drawMage, 64, HERO_POSES, 0.5),
    rogue: buildPoseFrames(drawRogue, 64, HERO_POSES, 0.5),
    priestess: buildPoseFrames(drawPriestess, 64, HERO_POSES, 0.5),
  };
}
