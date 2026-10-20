// Spirits, casters and the undead knight in the heroes' cute style: round
// hooded heads with big glowing eyes, little robed bodies, the same 8-frame
// poses (the floating wraith and ghost use 4 wave frames instead).
// 64x64 facing right, anchor (32, 50); the undead knight is 80x80 (KNIGHT_ANCHOR).

// ---------- floaters ----------

/** Phantom (wraith): a floating hood with a void face, big cyan eyes, a tattered tail and claws. pose.wave 0-3. */
function drawWraith(p, pose) {
  const b = pose.bob;
  const w = pose.wave;
  const W = ['#120c22', '#241a40', '#3a2c62', '#564590', '#7c68bc'];
  const eye = '#86f8ff';
  // tattered tail
  for (let i = 0; i < 5; i++) {
    const x0 = 23 + i * 4;
    const len = 6 + ((i + w) % 3) * 3;
    p.poly([[x0, 42 + b], [x0 + 5, 42 + b], [x0 + 3 + (i % 2 ? 1 : -1), 42 + b + len]], i % 2 ? W[2] : W[1]);
  }
  // little robe
  p.poly(shift([[25, 24], [41, 24], [43, 34], [42, 43], [24, 43], [23, 34]], b), W[2]);
  p.rect(24, 27 + b, 3, 15, W[1]);
  p.line(39, 26 + b, 41, 42 + b, W[3]);
  // big round hood with a point flicking back
  p.poly(shift([[24, 12], [17, 7 + (w % 2)], [21, 16]], b), W[2]);
  p.round(22, 5 + b, 22, 21, W[2], 8);
  p.round(25, 6 + b, 9, 4, W[3], 2);
  p.px(27, 7 + b, W[4]);
  p.rect(23, 13 + b, 3, 9, W[1]);
  // void face with big glowing eyes
  p.round(29, 11 + b, 14, 13, '#06030c', 5);
  p.round(31, 15 + b, 4, 5, eye, 1);
  p.round(37, 15 + b, 4, 5, eye, 1);
  p.rect(32, 16 + b, 2, 2, '#ffffff');
  p.rect(38, 16 + b, 2, 2, '#ffffff');
  p.rect(31, 19 + b, 4, 1, '#3a98a8');
  p.rect(37, 19 + b, 4, 1, '#3a98a8');
  // reaching sleeve and skeletal claws
  p.poly(shift([[37, 28], [47, 29], [47, 34], [38, 34]], b), W[3]);
  p.line(38, 28 + b, 46, 29 + b, W[4]);
  const claw = '#cfc7e8';
  p.rect(47, 29 + b, 2, 5, claw);
  p.line(48, 29 + b, 52, 27 + b, claw);
  p.line(48, 31 + b, 53, 31 + b, claw);
  p.line(48, 33 + b, 52, 35 + b, claw);
}

/** Sheet ghost: a round little spook with big dark eyes, blush and an "o" mouth. pose.wave 0-3 ripples the hem. */
function drawGhost(p, pose) {
  const G = ['#2e4a66', '#5e88ac', '#a4d0ec', '#daf2ff', '#ffffff'];
  const w = pose.wave;
  const b = pose.bob;
  for (let i = 0; i < 5; i++) {
    const x0 = 20 + i * 5;
    const len = (i + w) % 2 ? 6 : 3;
    p.poly([[x0, 41 + b], [x0 + 6, 41 + b], [x0 + 3, 41 + b + len]], i % 2 ? G[2] : G[1]);
  }
  p.rect(20, 25 + b, 25, 17, G[2]);
  p.ellipse(32, 24 + b, 13, 13, G[1]);
  p.ellipse(32, 24 + b, 12, 12, G[2]);
  p.rect(20, 25 + b, 3, 17, G[1]);
  p.ellipse(28, 17 + b, 6, 4, G[3]);
  p.rect(25, 15 + b, 3, 1, G[4]);
  p.line(42, 26 + b, 43, 40 + b, G[3]);
  // little arm waving forward
  p.poly([[42, 27 + b], [50, 30 + b - (w % 2)], [42, 34 + b]], G[2]);
  p.px(49, 30 + b - (w % 2), G[3]);
  // big eyes with a glint, blush, an "o" of a mouth
  const face = '#1a1030';
  p.round(32, 19 + b, 4, 6, face, 1);
  p.round(38, 19 + b, 4, 6, face, 1);
  p.px(33, 20 + b, G[4]);
  p.px(39, 20 + b, G[4]);
  p.rect(31, 26 + b, 3, 1, '#e8a0b4');
  p.rect(40, 26 + b, 3, 1, '#e8a0b4');
  p.rect(35, 27 + b, 3, 2, face);
  p.px(36, 29 + b, face);
}

// ---------- robed casters ----------

/**
 * A little robed figure: a big round hood over a face, a robe flaring to the
 * floor that sways as it walks, a sleeve reaching forward.
 * R = robe ramp darkest first (5); face(p, y) paints inside the hood opening.
 * opts.trim: hem / sash colour; opts.hand: hand colour.
 */
function drawRobedCute(p, P, R, face, opts = {}) {
  const { b, hb } = P;
  const hem = Math.round(P.s / 2) + P.cf;
  // robe body flaring to the floor
  p.poly([[27, 24 + b], [39, 24 + b], [42, 36 + b], [45 + hem, 57], [21 + hem, 57], [24, 36 + b]], R[2]);
  p.poly([[27, 24 + b], [30, 24 + b], [26 + hem, 57], [21 + hem, 57], [24, 36 + b]], R[3]);
  p.poly([[38, 30 + b], [42, 36 + b], [45 + hem, 57], [40 + hem, 57]], R[1]);
  p.line(33, 32 + b, 33 + hem, 56, R[1]);
  for (let x = 22; x < 45; x += 4) p.px(x + hem, 57, R[0]);   // ragged hem
  if (opts.trim) {
    p.rect(22 + hem, 55, 23, 1, opts.trim);
    p.rect(27, 34 + b, 12, 2, opts.trim);
  }
  // back sleeve
  p.poly([[26, 26 + b], [29, 26 + b], [28 + P.ba, 35 + b], [24 + P.ba, 35 + b]], R[1]);
  // big round hood
  p.round(24, 6 + hb, 19, 19, R[2], 7);
  p.round(26, 7 + hb, 8, 4, R[3], 2);
  p.px(28, 7 + hb, R[4]);
  p.rect(24, 13 + hb, 3, 10, R[1]);
  p.round(29, 11 + hb, 13, 13, R[0], 5);   // the shadowed opening
  face(p, hb);
  // sleeve reaching forward, hand at the end
  p.poly([[35, 25 + b], [40, 25 + b], [44, 31 + b], [44, 35 + b], [39, 35 + b], [37, 30 + b]], R[2]);
  p.poly([[40, 31 + b], [44, 35 + b], [39, 35 + b]], R[1]);
  p.line(36, 25 + b, 40, 25 + b, R[4]);
  if (opts.hand) p.round(40, 34 + b, 4, 4, opts.hand, 1);
}

/** A cute skull face in a hood (big sockets, glowing eyes, little teeth). */
function hoodSkullCute(eye) {
  return (p, y) => {
    p.round(30, 12 + y, 11, 11, BONE[3], 4);
    p.round(31, 12 + y, 5, 3, BONE[4], 1);
    p.round(31, 15 + y, 4, 4, BONE_DARK, 1);
    p.round(36, 15 + y, 4, 4, BONE_DARK, 1);
    p.rect(32, 16 + y, 2, 2, eye);
    p.rect(37, 16 + y, 2, 2, eye);
    p.px(32, 16 + y, '#ffffff');
    p.px(37, 16 + y, '#ffffff');
    p.rect(32, 21 + y, 7, 1, BONE[2]);
    for (const x of [33, 35, 37]) p.px(x, 21 + y, BONE_DARK);
  };
}

/** Necromancer: purple robe with green trim, a skull face with green eyes, a skull on the sash. */
function drawNecromancer(p, P) {
  const R = ['#0e0816', '#22143a', '#3a2260', '#563890', '#7a58c0'];
  drawRobedCute(p, P, R, hoodSkullCute('#9cf06a'), { trim: '#6ac040', hand: BONE[3] });
  const b = P.b;
  p.round(31, 33 + b, 4, 4, BONE[3], 1);
  p.px(32, 34 + b, BONE_DARK); p.px(33, 34 + b, BONE_DARK);
}

/** Skeleton sorcerer: bone-white robe with red trim and a crown of bones. */
function drawSkeletonSorcerer(p, P) {
  const R = ['#3a2e1e', '#6a5a3a', '#a08c6a', '#cdb994', '#efe0bc'];
  drawRobedCute(p, P, R, hoodSkullCute('#ff4a3a'), { trim: '#c0302a', hand: BONE[3] });
  const hb = P.hb;
  for (let i = 0; i < 5; i++) p.poly(shift([[26 + i * 3, 8], [27 + i * 3, 2 + (i % 2) * 2], [28 + i * 3, 8]], hb), BONE[3]);
  p.rect(26, 7 + hb, 15, 2, BONE[2]);
}

/** Reaper: a black robe and a hood with nothing in it but two cold eyes. The scythe is drawn by the enemy. */
function drawReaper(p, P) {
  const R = ['#06030a', '#120c1a', '#1e1628', '#2e2440', '#463a5c'];
  drawRobedCute(p, P, R, (pp, y) => {
    if (P.eyes === 'blink') {
      pp.rect(32, 17 + y, 3, 1, '#c8e8ff');
      pp.rect(37, 17 + y, 3, 1, '#c8e8ff');
      return;
    }
    pp.round(32, 15 + y, 3, 4, '#c8e8ff', 1);
    pp.round(37, 15 + y, 3, 4, '#c8e8ff', 1);
    pp.px(32, 15 + y, '#ffffff');
    pp.px(37, 15 + y, '#ffffff');
  }, { hand: '#cfc7e8' });
}

// ---------- shadowalker ----------

/** Shadowalker: a little assassin like the rogue but all in shadow, violet eyes, a scarf over the mouth. */
function drawShadowalker(p, P) {
  const { b, hb, s } = P;
  const D = ['#06040c', '#100c1a', '#1c1628', '#2c2440', '#3e345a'];
  const V = ['#2a0a3a', '#4a1a5e', '#6a2a84', '#9a4ac0'];   // violet scarf
  const f = P.cf;
  // scarf tails fluttering behind
  p.poly([[28, 21 + b], [23, 22 + b + f], [18 + f, 26 + hb], [20 + f, 28 + hb], [25, 25 + b], [28, 24 + b]], V[2]);
  p.poly([[27, 23 + b], [24, 26 + b], [21 + f, 32 + hb], [23 + f, 33 + hb], [28, 25 + b]], V[1]);
  // back arm
  p.poly([[28, 24 + b], [31, 25 + b], [30 + P.ba, 32 + b], [26 + P.ba, 33 + b]], D[1]);
  // wrapped legs
  const xb = cuteLeg(p, 29, 29 - s, P.lb, [D[0], D[1], D[2]], [D[0], D[1], D[2]], 50);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, [D[1], D[2], D[3]], [D[1], D[2], D[3]], 50);
  for (const [xAt, lift] of [[xb, P.lb], [xf, P.lf]]) {
    p.rect(xAt(46 - lift), 46 - lift, 3, 1, D[3]);
    p.rect(xAt(53 - lift), 53 - lift, 3, 1, D[3]);
  }
  // short ragged cloak over the body
  p.round(27, 24 + b, 13, 12, D[2], 2);
  p.rect(27, 25 + b, 3, 10, D[3]);
  const hem = Math.round(s / 2);
  p.poly([[26, 34 + b], [41, 34 + b], [42 + hem, 46 + b], [25 + hem, 46 + b]], D[2]);
  p.poly([[26, 34 + b], [29, 34 + b], [28 + hem, 46 + b], [25 + hem, 46 + b]], D[3]);
  for (let x = 26; x < 42; x += 3) p.px(x + hem, 46 + b, D[1]);
  p.rect(27, 34 + b, 13, 1, V[1]);   // sash
  // big round hood, dark face, violet eyes, scarf over the mouth
  p.round(25, 7 + hb, 17, 17, D[2], 6);
  p.round(27, 8 + hb, 7, 3, D[3], 1);
  p.round(29, 12 + hb, 12, 11, D[0], 4);
  if (P.eyes === 'blink') {
    p.rect(31, 17 + hb, 3, 1, '#c07aff');
    p.rect(36, 17 + hb, 3, 1, '#c07aff');
  } else {
    p.rect(31, 16 + hb, 3, 2, '#c07aff');
    p.rect(36, 16 + hb, 3, 2, '#c07aff');
    p.px(31, 16 + hb, '#f0d8ff');
    p.px(36, 16 + hb, '#f0d8ff');
  }
  p.rect(28, 20 + hb, 14, 3, V[2]);
  p.rect(28, 20 + hb, 14, 1, V[3]);
  p.poly(shift([[26, 12], [22, 10], [20, 13], [23, 15], [26, 17]], hb), D[2]);
  // dagger arm (the dagger is drawn as part of the attack)
  p.round(36, 25 + b, 5, 6, D[3], 1);
  p.rect(38, 30 + b, 4, 4, D[2]);
  p.round(39, 33 + b, 4, 3, '#9a8ab0', 1);
}

// ---------- undead knight ----------

/**
 * Zombie knight: a big chibi brute in black plate (80x80, feet on row 76),
 * horned helm with a burning red visor, a tattered cape and a glowing chest
 * rune. The greatsword is drawn by the enemy at the gauntlet (52, 44).
 */
function drawUndeadKnight(p, P) {
  const { b, hb } = P;
  const s = Math.round(P.s * 1.3);
  const A = ['#14141c', '#24242f', '#373a48', '#4e5468', '#6c7488', '#9aa2b8'];
  const C = ['#1e0a18', '#3a1430', '#5a2a4a', '#7a3a62'];
  const H = ['#6a604e', '#a89e8a', '#ddd4c2'];
  const visor = '#ff3b30';
  const f = P.cf;

  // tattered cape behind
  p.poly([[31, 36 + b], [42, 36 + b], [38, 58], [33 + f, 73], [24 + f, 74], [18 + f, 70], [22, 52], [27, 42 + b]], C[2]);
  p.line(28, 40 + b, 21 + f, 70, C[1]);
  p.line(33, 44 + b, 29 + f, 72, C[3]);
  for (let x = 19; x < 34; x += 4) p.rect(x + f, 72, 2, 2, C[1]);

  // short armoured legs (plate greaves, sabatons) from row 58 to the floor at 76
  const leg = (hip, lift, dx, R) => {
    const top = 58;
    const bottom = 76 - lift;
    for (let y = top; y <= bottom; y++) {
      const x = Math.round(hip + (dx * (y - top)) / (bottom - top));
      p.rect(x, y, 6, 1, R[1]);
      p.px(x, y, R[2]);
      p.px(x + 5, y, R[0]);
    }
    const fx = hip + dx;
    p.round(fx, bottom - 3, 9, 4, R[1], 1);
    p.rect(fx + 1, bottom - 3, 6, 1, R[2]);
    p.round(hip + Math.round(dx / 2) - 1, 64 - lift, 8, 4, R[2], 1);   // knee cop
  };
  leg(32, P.lb, -s, [A[0], A[1], A[3]]);
  leg(39, P.lf, s, [A[1], A[3], A[4]]);

  // faulds
  p.round(30, 50 + b, 21, 9, A[2], 2);
  p.rect(30, 53 + b, 21, 1, A[4]);
  p.rect(30, 56 + b, 21, 1, A[0]);

  // back pauldron with a spike
  p.poly(shift([[27, 34], [22, 26], [31, 33]], b), A[3]);
  p.round(25, 33 + b, 10, 9, A[2], 3);

  // barrel cuirass with the glowing rune
  p.round(29, 34 + b, 23, 18, A[3], 4);
  p.round(31, 35 + b, 9, 8, A[4], 2);
  p.rect(32, 35 + b, 4, 2, A[5]);
  p.rect(47, 37 + b, 4, 12, A[2]);
  p.rect(40, 35 + b, 1, 15, A[5]);
  p.round(38, 41 + b, 5, 6, '#3a0a0a', 1);
  p.rect(39, 42 + b, 3, 4, visor);
  p.px(39, 42 + b, '#ff9a80');
  p.rect(30, 49 + b, 22, 2, '#3a2814');
  p.rect(39, 49 + b, 4, 2, RAMP.gold[1]);

  // big round horned great helm
  p.poly(shift([[33, 14], [26, 9], [23, 3], [27, 4], [32, 9], [37, 12]], hb), H[0]);
  p.line(32, 11 + hb, 26, 5 + hb, H[1]);
  p.round(30, 8 + hb, 26, 26, A[3], 9);
  p.round(33, 9 + hb, 12, 6, A[4], 3);
  p.rect(35, 10 + hb, 5, 1, A[5]);
  p.rect(30, 17 + hb, 3, 12, A[2]);
  p.rect(43, 9 + hb, 2, 10, A[5]);        // crest ridge
  // the visor slit, eyes burning red
  p.round(36, 19 + hb, 19, 6, '#0a0610', 2);
  if (P.eyes !== 'blink') {
    p.rect(39, 21 + hb, 4, 2, visor);
    p.rect(47, 21 + hb, 4, 2, visor);
    p.px(39, 21 + hb, '#ffb0a0');
    p.px(47, 21 + hb, '#ffb0a0');
  }
  for (let y = 27; y < 32; y += 2) p.rect(42, y + hb, 9, 1, A[1]);   // breaths
  p.poly(shift([[51, 13], [57, 8], [60, 3], [62, 6], [59, 11], [54, 17]], hb), H[1]);
  p.line(53, 13 + hb, 59, 5 + hb, H[2]);

  // front pauldron and the arm down to the gauntlet
  p.poly(shift([[50, 33], [53, 25], [57, 33]], b), A[4]);
  p.round(46, 32 + b, 14, 11, A[3], 4);
  p.rect(48, 33 + b, 6, 1, A[5]);
  p.rect(48, 38 + b, 12, 1, A[1]);
  p.rect(50, 42 + b, 6, 4, A[2]);
  p.round(49, 42 + b, 8, 7, A[2], 2);
  p.rect(50, 43 + b, 5, 1, A[4]);
}
