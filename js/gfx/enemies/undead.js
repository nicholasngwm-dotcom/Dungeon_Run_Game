// Zombies and skeletons in the heroes' cute style (js/gfx/heroes/cute.js):
// big round heads with big eyes, small bodies, slim legs, the same 8-frame
// idle and walk poses. 64x64, facing right, feet on row 58, anchor (32, 50).
// The variants (bletcher, soldier, warrior, bomber, candlehead, minigunner)
// dress up the same two bodies. Weapons that aim are drawn by the enemy.

const ZOMBIE_SKIN = ['#2e3a22', '#4a5e36', '#6a8250', '#8faa6c', '#b4cc90'];
const BONE = ['#4a4438', '#8a8270', '#b5ad96', '#ebe5d3', '#fffaf0'];
const BONE_DARK = '#140c14';

// ---------- zombies ----------

/**
 * A shambling little zombie: green skin, a stitched head with one big yellow
 * eye and one sewn shut, torn shirt and trousers, both arms reaching forward.
 * opts.shirt / opts.pants: ramps darkest first; opts.noShirt skips the shirt (vests go on top).
 */
function drawZombieBody(p, P, opts = {}) {
  const { b, hb } = P;
  const s = Math.round(P.s * 0.7);   // short shuffling steps
  const Z = ZOMBIE_SKIN;
  const T = opts.shirt || ['#2a2018', '#463628', '#64503a', '#86704f'];
  const Pn = opts.pants || ['#1c2030', '#2c3448', '#3e4a62', '#56647e'];
  const wob = hb - b;                // the head lolls a frame behind

  // back arm reaching forward
  p.poly([[29, 25 + b], [43, 26 + b], [43, 29 + b], [30, 29 + b]], Z[1]);
  p.rect(43, 25 + b, 3, 4, Z[1]);
  p.px(46, 26 + b, Z[1]);

  // legs in torn trousers, bare feet
  cuteLeg(p, 29, 29 - s, P.lb, [Pn[0], Pn[1], Pn[2]], [Z[0], Z[1], Z[2]], 54);
  cuteLeg(p, 34, 34 + s, P.lf, [Pn[1], Pn[2], Pn[3]], [Z[1], Z[2], Z[3]], 54);
  p.px(30, 52, Pn[0]); p.px(35, 53, Pn[1]);   // frayed cuffs

  // torn shirt with a hole over the ribs and a ragged hem
  if (!opts.noShirt) {
    p.round(27, 24 + b, 13, 12, T[2], 2);
    p.rect(27, 25 + b, 3, 9, T[3]);
    p.rect(37, 26 + b, 3, 9, T[1]);
    p.rect(30, 29 + b, 4, 3, Z[2]);
    p.px(30, 30 + b, Z[0]); p.px(32, 30 + b, Z[0]);
    p.rect(35, 26 + b, 2, 2, '#6a1a1a');           // old blood
    for (let x = 27; x < 40; x += 3) p.px(x, 36 + b, T[1]);
    p.rect(27, 34 + b, 13, 1, T[0]);               // rope belt
  }
  // baggy trousers to the knee with a ragged hem (the bulk at the hips, like the heroes' skirts)
  const hem = Math.round(P.s / 2);
  p.poly([[27, 35 + b], [40, 35 + b], [41 + hem, 46 + b], [26 + hem, 46 + b]], Pn[2]);
  p.poly([[27, 35 + b], [30, 35 + b], [29 + hem, 46 + b], [26 + hem, 46 + b]], Pn[3]);
  p.line(33, 37 + b, 33 + hem, 46 + b, Pn[0]);
  for (let x = 27; x < 41; x += 3) p.px(x + hem, 46 + b, Pn[1]);
  p.rect(36 + hem, 40 + b, 2, 2, Pn[1]);   // patch

  // big round head, lolling
  const hy = b + wob;
  p.round(27, 10 + hy, 14, 14, Z[2], 4);
  p.round(28, 10 + hy, 8, 4, Z[3], 2);
  p.px(30, 11 + hy, Z[4]);
  p.rect(27, 18 + hy, 2, 4, Z[1]);
  p.rect(28, 22 + hy, 11, 2, Z[1]);
  // stitched scar across the brow
  p.line(29, 14 + hy, 36, 13 + hy, Z[0]);
  for (const x of [30, 32, 34]) p.px(x, 12 + hy, Z[0]);
  // the eye sewn shut
  p.line(30, 17 + hy, 32, 19 + hy, BONE_DARK);
  p.line(32, 17 + hy, 30, 19 + hy, BONE_DARK);
  // the big yellow eye
  p.rect(35, 16 + hy, 4, 1, OUTLINE);
  p.rect(35, 17 + hy, 4, 3, '#f2e85a');
  p.px(35, 17 + hy, '#fffbd0');
  p.rect(37, 18 + hy, 1, 2, '#3a2a08');
  if (P.eyes === 'blink') p.rect(35, 17 + hy, 4, 3, Z[1]);
  // slack mouth with a tooth
  p.rect(34, 21 + hy, 4, 2, '#2a0a0a');
  p.px(35, 21 + hy, '#e8e0c8');
  // a few stringy hairs
  p.line(31, 10 + hy, 29, 7 + hy, '#2a2a1e');
  p.line(34, 10 + hy, 35, 6 + hy, '#2a2a1e');
  p.line(37, 10 + hy, 39, 8 + hy, '#2a2a1e');

  // front arm reaching forward, torn sleeve
  p.poly([[34, 26 + b], [46, 27 + b], [46, 31 + b], [35, 31 + b]], Z[2]);
  p.rect(35, 26 + b, 11, 1, Z[3]);
  if (!opts.noShirt) p.round(33, 25 + b, 6, 6, T[2], 1);
  p.rect(46, 26 + b, 3, 5, Z[2]);
  p.px(49, 27 + b, Z[3]); p.px(49, 29 + b, Z[3]);
  p.px(46, 26 + b, Z[4]);
}

function drawZombie(p, P) { drawZombieBody(p, P); }

/** Bletching zombie: a swollen, blistered belly and green drool. */
function drawBletcher(p, P) {
  drawZombieBody(p, P);
  const b = P.b;
  const hy = P.hb;
  p.ellipse(33, 31 + b, 8, 7, '#6a8250');
  p.ellipse(32, 30 + b, 6, 5, '#8faa6c');
  p.ellipse(30, 28 + b, 2, 2, '#b4cc90');
  for (const [x, y] of [[36, 33], [29, 34], [37, 28]]) {
    p.px(x, y + b, '#c8e070');
    p.px(x + 1, y + b, '#4a5e36');
  }
  // puffed cheeks and a dribble of green spit
  p.rect(38, 20 + hy, 2, 2, '#8faa6c');
  p.rect(36, 23 + hy, 2, 4, '#9cf06a');
  p.px(37, 27 + hy, '#6ac040');
}

/** Zombie soldier: army helmet, flak vest with pouches. */
function drawZombieSoldier(p, P) {
  const V = ['#262e1a', '#3a4428', '#4a5638', '#62704a'];
  drawZombieBody(p, P, { pants: ['#1e2416', '#2c3420', '#3e4a2a', '#56643c'], noShirt: true });
  const b = P.b;
  const hy = P.hb;
  // flak vest over the chest, pouches on the belt
  p.round(27, 24 + b, 13, 12, V[2], 2);
  p.rect(27, 25 + b, 3, 10, V[3]);
  p.rect(37, 26 + b, 3, 9, V[1]);
  p.rect(28, 28 + b, 11, 1, V[0]);
  p.rect(28, 32 + b, 11, 1, V[0]);
  p.rect(29, 34 + b, 3, 3, '#5b3922');
  p.rect(34, 34 + b, 3, 3, '#5b3922');
  p.rect(29, 34 + b, 3, 1, '#7d532f');
  p.rect(34, 34 + b, 3, 1, '#7d532f');
  p.round(33, 25 + b, 6, 6, V[2], 1);   // sleeve over the reaching arm
  // round army helmet, strap under the chin
  p.round(26, 7 + hy, 16, 8, V[2], 3);
  p.rect(28, 7 + hy, 8, 2, V[3]);
  p.rect(25, 13 + hy, 18, 2, V[1]);
  p.rect(26, 13 + hy, 16, 1, V[3]);
  p.line(28, 15 + hy, 30, 22 + hy, V[0]);
}

// ---------- skeletons ----------

/**
 * A little skeleton: big round skull with dark sockets and red pinpoint eyes,
 * a rib cage, thin bone limbs. opts.cloth: loincloth colour; opts.noSkull
 * skips the skull (the candlehead puts a candle there).
 */
function drawSkeletonBody(p, P, opts = {}) {
  const { b, hb, s } = P;
  const B = BONE;
  const eye = opts.eye || '#ff4a3a';

  // back arm, thin and bony
  p.line(28, 25 + b, 26 + P.ba, 31 + b, B[1], 2);
  p.line(26 + P.ba, 31 + b, 28 + P.ba, 35 + b, B[1], 2);

  // bone legs with knobby knees
  const bones = (r) => [r[0], r[1], r[2]];
  const xb = cuteLeg(p, 29, 29 - s, P.lb, bones([B[0], B[1], B[2]]), bones([B[0], B[1], B[2]]), 57);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, bones([B[1], B[2], B[3]]), bones([B[1], B[2], B[3]]), 57);
  for (const [xAt, lift, c] of [[xb, P.lb, B[2]], [xf, P.lf, B[3]]]) {
    p.round(xAt(49 - lift) - 1, 48 - lift, 5, 3, c, 1);
  }

  // pelvis and a tattered loincloth
  p.round(28, 36 + b, 11, 4, B[2], 1);
  p.px(30, 37 + b, BONE_DARK); p.px(36, 37 + b, BONE_DARK);
  const cloth = opts.cloth || '#5a2a2a';
  const hem = Math.round(P.s / 2);
  p.poly([[28, 38 + b], [39, 38 + b], [40 + hem, 46 + b], [36 + hem, 44 + b], [33 + hem, 47 + b], [30 + hem, 44 + b], [27 + hem, 46 + b]], cloth);

  // spine and rib cage
  p.rect(32, 24 + b, 2, 13, B[2]);
  p.rect(27, 24 + b, 13, 1, B[3]);
  for (const y of [26, 28, 30, 32]) {
    p.rect(28, y + b, 11, 1, B[3]);
    p.px(28, y + b, B[1]);
    p.px(38, y + b, B[1]);
  }
  p.rect(34, 25 + b, 2, 8, B[4]);

  if (!opts.noSkull) {
    // big round skull
    p.round(27, 9 + hb, 14, 13, B[3], 4);
    p.round(28, 9 + hb, 7, 4, B[4], 2);
    p.rect(27, 16 + hb, 2, 5, B[2]);
    // deep sockets, red pinpoint eyes
    p.round(29, 15 + hb, 4, 4, BONE_DARK, 1);
    p.round(35, 15 + hb, 4, 4, BONE_DARK, 1);
    if (P.eyes !== 'blink') {
      p.px(31, 16 + hb, eye);
      p.px(37, 16 + hb, eye);
      p.px(36, 16 + hb, '#ff9a80');
    }
    p.px(34, 19 + hb, BONE_DARK);   // nose hole
    // jaw with teeth
    p.round(29, 20 + hb, 10, 4, B[2], 1);
    p.rect(30, 21 + hb, 8, 1, B[4]);
    for (const x of [31, 33, 35, 37]) p.px(x, 21 + hb, BONE_DARK);
    p.line(31, 10 + hb, 33, 13 + hb, B[1]);   // hairline crack
  }

  // front arm, forward to the hand
  p.line(37, 25 + b, 39, 30 + b, B[3], 2);
  p.line(39, 30 + b, 41, 34 + b, B[2], 2);
  p.round(40, 33 + b, 3, 3, B[3], 1);
}

/** Skeleton archer: a ragged brown hood. The bone bow is drawn by the enemy. */
function drawSkeleton(p, P) {
  drawSkeletonBody(p, P);
  const hb = P.hb;
  const H = ['#2a1a10', '#4a3020', '#6a4a30', '#8a6a44'];
  p.poly(shift([[26, 22], [26, 12], [29, 7], [35, 6], [40, 9], [42, 13], [38, 11], [31, 11], [29, 13], [29, 22]], hb), H[2]);
  p.line(28, 9 + hb, 33, 7 + hb, H[3]);
  p.line(27, 14 + hb, 27, 21 + hb, H[1]);
  p.poly(shift([[27, 12], [23, 10], [21, 13], [24, 15], [27, 17]], hb), H[2]);   // hood tail
}

/** Skeleton warrior: dented iron helmet and a rusty breastplate (the sword and shield are drawn by the enemy). */
function drawSkeletonWarrior(p, P) {
  drawSkeletonBody(p, P);
  const { b, hb } = P;
  const S = RAMP.steel;
  p.round(26, 7 + hb, 16, 8, S[2], 3);
  p.rect(28, 7 + hb, 7, 2, S[3]);
  p.px(29, 8 + hb, S[4]);
  p.rect(25, 13 + hb, 18, 2, S[1]);
  p.rect(26, 13 + hb, 16, 1, S[3]);
  p.rect(39, 9 + hb, 2, 2, S[0]);   // dent
  p.round(27, 24 + b, 12, 9, '#6a4a3a', 2);
  p.rect(28, 24 + b, 10, 1, '#8a6a4a');
  p.rect(33, 25 + b, 1, 7, '#3a2418');
  p.px(30, 27 + b, '#3a2418');
}

/** Skeleton bomber: leather cap with goggles and a bandolier of bombs (the lit bomb is drawn by the enemy). */
function drawBomber(p, P) {
  drawSkeletonBody(p, P);
  const { b, hb } = P;
  const L = RAMP.leather;
  p.line(28, 24 + b, 38, 35 + b, L[1]);
  for (let i = 0; i < 4; i++) {
    p.round(28 + i * 2.5, 24 + b + i * 3, 3, 3, '#2a2a32', 1);
    p.px(29 + i * 2.5, 24 + b + i * 3, '#c8a040');
  }
  p.round(26, 8 + hb, 16, 7, L[2], 3);
  p.rect(28, 8 + hb, 7, 1, L[3]);
  p.rect(26, 12 + hb, 16, 2, L[1]);
  p.round(32, 10 + hb, 5, 4, '#3a2a1a', 1);
  p.rect(33, 11 + hb, 3, 2, '#ffb02e');
  p.px(33, 11 + hb, '#fff0b0');
}

/** Candlehead: a fat candle with a little face where the skull should be, a blue soul flame on top. */
function drawCandlehead(p, P) {
  drawSkeletonBody(p, P, { noSkull: true, cloth: '#3a3a5a' });
  const hb = P.hb;
  const W = ['#b5ad96', '#e8e0c8', '#fffaf0'];
  p.round(28, 9 + hb, 12, 14, W[1], 2);
  p.rect(28, 10 + hb, 3, 12, W[2]);
  p.rect(38, 11 + hb, 2, 11, W[0]);
  // wax drips
  p.rect(31, 21 + hb, 2, 3, W[1]);
  p.rect(36, 20 + hb, 2, 4, W[1]);
  p.px(36, 24 + hb, W[0]);
  // a sleepy little face
  if (P.eyes === 'blink') {
    p.rect(31, 15 + hb, 2, 1, BONE_DARK);
    p.rect(35, 15 + hb, 2, 1, BONE_DARK);
  } else {
    p.rect(31, 14 + hb, 2, 3, BONE_DARK);
    p.rect(35, 14 + hb, 2, 3, BONE_DARK);
    p.px(31, 14 + hb, '#6ad8ff');
    p.px(35, 14 + hb, '#6ad8ff');
  }
  p.rect(33, 18 + hb, 2, 1, '#8a8270');
  // wick and the flame (sways a frame behind)
  p.rect(33, 7 + hb, 1, 2, '#3a3a3a');
  const f = P.hs;
  p.poly([[31, 8 + hb], [34 + f, 0 + hb], [37, 8 + hb]], '#4a8aff');
  p.poly([[32, 8 + hb], [34 + f, 2 + hb], [36, 8 + hb]], '#6ad8ff');
  p.poly([[33, 8 + hb], [34 + f, 4 + hb], [35, 8 + hb]], '#e6f6ff');
}

/** Minigunner: a broad skeleton (drawn scaled up) with a spiked helm and an ammo belt (the gun is drawn by the enemy). */
function drawMinigunner(p, P) {
  drawSkeletonBody(p, P, { cloth: '#3a3a2a' });
  const { b, hb } = P;
  const S = RAMP.steel;
  // ammo belt across the chest
  p.line(27, 25 + b, 39, 33 + b, '#5b3922', 2);
  for (let i = 0; i < 5; i++) p.rect(28 + i * 2.4, 25 + b + i * 1.6, 1, 2, '#e0b040');
  // spiked iron helm with a red plume tuft
  p.round(26, 7 + hb, 16, 8, S[1], 3);
  p.rect(28, 7 + hb, 6, 2, S[3]);
  p.rect(25, 13 + hb, 18, 2, S[0]);
  for (const x of [28, 33, 38]) p.poly(shift([[x - 1, 8], [x, 4], [x + 1, 8]], hb), S[3]);
  p.rect(30, 3 + hb, 4, 2, '#a63036');
}

// ---------- flying skull ----------

/** Small flying skull (24x24) trailing green fire; pose.flame flickers it. */
function drawFlyingSkull(p, pose) {
  const f = pose.flame;
  p.poly([[1, 12], [8, 7 + f], [8, 17 - f]], '#4a8a2a');
  p.poly([[3, 12], [9, 9], [9, 15]], '#9cf06a');
  p.poly([[5, 12], [9, 11], [9, 13]], '#e0ffd0');
  p.round(7, 3, 14, 14, BONE[3], 5);
  p.round(8, 3, 7, 4, BONE[4], 2);
  p.round(9, 8, 4, 4, BONE_DARK, 1);
  p.round(15, 8, 4, 4, BONE_DARK, 1);
  p.px(11, 9, '#9cf06a');
  p.px(17, 9, '#9cf06a');
  p.px(14, 13, BONE_DARK);
  p.round(10, 15, 9, 4, BONE[2], 1);
  for (let x = 11; x < 19; x += 2) p.px(x, 16, BONE_DARK);
}
