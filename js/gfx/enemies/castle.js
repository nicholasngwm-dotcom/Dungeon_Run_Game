// The castle's corrupted court in the heroes' cute style (js/gfx/heroes/cute.js):
// big round heads, slim legs, the same 8-frame idle and walk. 64x64, facing right,
// feet on row 58, anchor (32, 50). The empire rotted from within: its people are
// living, but cruel - scowls and sneers, scars, hard eyes - its steel blackened, its
// crimson faded. Weapons that aim or swing are drawn by the enemy, not baked in.

const CK = {
  skin: null,                                                       // the body being drawn (see useSkin)
  skins: {                                                          // living people, darkest first
    fair: ['#6a3c30', '#b37158', '#e0a584', '#f7d3b6'],
    pale: ['#6a4440', '#b88a80', '#e4c0b0', '#f8e2d6'],
    tan: ['#5a3020', '#9a5a3a', '#c8845a', '#e6aa7e'],
    dark: ['#2e1810', '#5a3420', '#8a5434', '#b07a50'],
    ruddy: ['#6a3028', '#b0604c', '#d88a70', '#f0b49a'],
  },
  steel: ['#141219', '#26232e', '#3e3a48', '#5e5a6c', '#8e8a9e', '#c4c0d0'],   // blackened steel
  crimson: ['#1e0a10', '#3e1220', '#62182c', '#8a2438', '#b0384a'],
  violet: ['#140a20', '#2a1840', '#46286a', '#6a449a', '#9a72cc'],
  gold: ['#3a2a10', '#6a4e1e', '#9a7a34', '#c8a456', '#ecd690'],
  cloth: ['#16131c', '#26222e', '#3a3444', '#544c60'],              // dark wool
  linen: ['#5e5660', '#8a8290', '#b4acb8', '#d8d0dc'],               // greyed linen
  eye: '#e8e2da',                                                    // eyes glinting in a helmet's slit
};
CK.skin = CK.skins.fair;

// ---------- shared parts ----------

/** Picks the skin the next body is drawn with (its face and hands share it). */
function useSkin(name) { CK.skin = CK.skins[name]; return CK.skin; }

/**
 * A living face gone cruel: whites of the eyes with a dark iris, heavy brows scowling
 * down at the nose, and a sneer. opts.eye = iris colour; opts.mask hides the mouth;
 * opts.scar cuts a scar across the cheek.
 */
function castleFace(p, P, opts = {}) {
  const b = P.b + (opts.dy || 0);
  const Sk = CK.skin;
  const iris = opts.eye || '#4a2a1a';
  const brow = opts.brow || '#2a1a14';
  p.round(29, 12 + b, 11, 12, Sk[2], 3);
  p.rect(29, 19 + b, 2, 3, Sk[1]);
  p.px(39, 20 + b, Sk[1]);
  p.round(30, 13 + b, 5, 3, Sk[3], 1);   // light catching the brow
  if (P.eyes === 'blink') {
    p.rect(30, 19 + b, 3, 1, OUTLINE);
    p.rect(35, 19 + b, 4, 1, OUTLINE);
  } else {
    // narrowed eyes: whites, a dark iris looking ahead, a black pupil
    p.rect(30, 18 + b, 3, 2, '#f2ece6');
    p.rect(35, 18 + b, 4, 2, '#f2ece6');
    p.px(32, 18 + b, iris); p.px(32, 19 + b, '#120a10');
    p.px(37, 18 + b, iris); p.px(38, 18 + b, iris); p.px(37, 19 + b, '#120a10'); p.px(38, 19 + b, iris);
    p.rect(30, 17 + b, 3, 1, OUTLINE);
    p.rect(35, 17 + b, 4, 1, OUTLINE);
  }
  // scowling brows, slanting down toward the nose
  p.line(29, 15 + b, 32, 16 + b, brow);
  p.line(35, 16 + b, 39, 14 + b, brow);
  p.px(33, 17 + b, Sk[1]);              // a crease between them
  if (opts.scar) p.line(36, 19 + b, 38, 22 + b, '#8a4a4a');
  if (!opts.mask) {
    // a sneer: one corner pulled up
    p.rect(33, 22 + b, 3, 1, '#5a2028');
    p.px(36, 21 + b, '#5a2028');
  }
}

/** Both legs (back then front). legR / bootR are [dark, mid, light, lighter]; w = leg width. */
function ckLegs(p, P, legR, bootR, bootTop = 52, w = 3, cuff = null) {
  const { s } = P;
  const xb = cuteLeg(p, 29, 29 - s, P.lb, [legR[0], legR[1], legR[2]], [bootR[0], bootR[1], bootR[2]], bootTop, cuff, w);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, [legR[1], legR[2], legR[3]], [bootR[1], bootR[2], bootR[3]], bootTop, cuff, w);
  return [xb, xf];
}

/** Knee cops for armoured legs. */
function ckKnees(p, P, legs, R) {
  for (const [xAt, lift, c, hi] of [[legs[0], P.lb, R[2], R[3]], [legs[1], P.lf, R[3], R[5] || R[4]]]) {
    const kx = xAt(49 - lift);
    p.round(kx - 1, 48 - lift, 6, 3, c, 1);
    p.px(kx, 48 - lift, hi);
  }
}

/** A skirt (tunic, faulds or robe) from the waist (33) flaring to the hem (44 + extra). R = ramp darkest first. */
function ckSkirt(p, P, R, extra = 0, bands = false) {
  const b = P.b;
  const hem = Math.round(P.s / 2);
  const bot = 44 + extra;
  p.poly([[28, 33 + b], [39, 33 + b], [41 + hem, bot + b], [26 + hem, bot + b]], R[2]);
  p.poly([[28, 33 + b], [31, 33 + b], [28 + hem, bot + b], [26 + hem, bot + b]], R[3]);
  p.poly([[37, 33 + b], [39, 33 + b], [41 + hem, bot + b], [38 + hem, bot + b]], R[1]);
  if (bands) {
    for (const y of [37, 40]) {
      const t = (y - 33) / (bot - 33);
      p.line(28 - 2 * t + hem * t, y + b, 39 + 2 * t + hem * t, y + b, R[1]);
    }
  }
  return hem;
}

/** Chest (a rounded block from row 24 to 35). R = ramp darkest first (4+ colours). */
function ckTorso(p, P, R) {
  const b = P.b;
  p.round(28, 24 + b, 12, 11, R[2], 2);
  p.rect(29, 25 + b, 3, 7, R[3]);
  p.rect(38, 26 + b, 2, 7, R[1]);
}

/** Belt with a buckle. */
function ckBelt(p, P, L = RAMP.leather, G = CK.gold) {
  const b = P.b;
  p.rect(28, 33 + b, 12, 2, L[1]);
  p.rect(28, 33 + b, 12, 1, L[2]);
  p.rect(32, 33 + b, 2, 2, G[3]);
}

/** Back arm hanging behind, swinging with the stride. R = sleeve ramp, hand = skin/glove colour. */
function ckBackArm(p, P, R, hand = CK.skin[1]) {
  const { b } = P;
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], R[1]);
  p.rect(26 + ba, 32 + b, 3, 3, hand);
}

/** Front (weapon) arm reaching forward to the hand at about (40, 35). R = sleeve or plate ramp. */
function ckFrontArm(p, P, R, hand = CK.skin[2], pauldron = false) {
  const b = P.b;
  if (pauldron) {
    p.round(35, 22 + b, 9, 7, R[3], 2);
    p.rect(36, 23 + b, 5, 1, R[5] || R[4]);
    p.rect(35, 28 + b, 9, 1, R[1]);
  } else {
    p.round(35, 24 + b, 6, 6, R[2], 1);
    p.rect(36, 25 + b, 3, 1, R[3]);
  }
  p.rect(38, 29 + b, 4, 5, R[2]);
  p.rect(38, 29 + b, 1, 5, R[3]);
  p.round(38, 34 + b, 4, 3, hand, 1);
}

// ---------- the court ----------

/** Squire: a young soldier in a broad kettle hat, padded gambeson and a faded crimson tabard. */
function drawSquire(p, P) {
  useSkin('fair');
  const { b, hb } = P;
  const S = CK.steel;
  const C = CK.crimson;
  const W = CK.cloth;
  ckBackArm(p, P, W);
  ckLegs(p, P, W, RAMP.leather.slice(1), 52, 3, RAMP.leather[3]);
  // quilted gambeson skirt with the tabard over it
  ckSkirt(p, P, W);
  const hem = Math.round(P.s / 2);
  p.poly([[31, 33 + b], [37, 33 + b], [38 + hem, 45 + b], [30 + hem, 45 + b]], C[2]);
  p.line(31, 34 + b, 30 + hem, 44 + b, C[3]);
  for (let x = 30; x < 39; x += 2) p.px(x + hem, 45 + b, C[1]);
  ckTorso(p, P, W);
  for (const y of [27, 30]) p.rect(29, y + b, 10, 1, W[1]);   // quilting
  p.poly([[31, 24 + b], [37, 24 + b], [37, 34 + b], [31, 34 + b]], C[2]);
  p.rect(31, 24 + b, 2, 10, C[3]);
  p.rect(33, 27 + b, 2, 4, CK.gold[2]);   // a faded crest
  ckBelt(p, P);
  // a mail coif under the hat, the face peeking out
  p.round(27, 12 + hb, 14, 13, S[2], 4);
  for (let y = 14; y < 24; y += 2) for (let x = 28; x < 40; x += 2) p.px(x + (y % 4 ? 1 : 0), y + hb, S[1]);
  castleFace(p, P, { dy: 0 });
  // kettle hat: a domed crown with a broad brim
  p.round(28, 6 + hb, 13, 8, S[3], 4);
  p.rect(30, 7 + hb, 5, 2, S[4]);
  p.px(31, 7 + hb, S[5]);
  p.rect(24, 13 + hb, 21, 2, S[2]);
  p.rect(25, 13 + hb, 19, 1, S[4]);
  p.rect(24, 15 + hb, 21, 1, S[0]);
  ckFrontArm(p, P, W, CK.skin[2]);
}

/** Castle archer: a deep crimson hood and capelet, a leather brigandine and a quiver. */
function drawCastleArcher(p, P) {
  useSkin('tan');
  const { b, hb } = P;
  const C = CK.crimson;
  const L = RAMP.leather;
  const W = CK.cloth;
  // quiver on the back with black-fletched arrows
  p.poly(shift([[19, 21], [24, 19], [28, 35], [23, 36]], b), L[2]);
  p.line(20, 22 + b, 24, 35 + b, L[3]);
  for (const [x0, x1] of [[20, 16], [22, 19], [24, 23]]) {
    p.line(x0, 19 + b, x1, 12 + b, L[4]);
    p.rect(x1 - 1, 9 + b, 2, 3, '#2a1a2e');
  }
  ckBackArm(p, P, W);
  ckLegs(p, P, W, L.slice(1), 50, 3, L[3]);
  ckSkirt(p, P, C);
  ckTorso(p, P, [L[0], L[1], L[2], L[3]]);
  for (let y = 26; y <= 31; y += 2) p.rect(30, y + b, 8, 1, L[1]);   // brigandine rivets
  for (let y = 26; y <= 31; y += 2) p.px(34, y + b, CK.gold[3]);
  p.line(29, 24 + b, 38, 33 + b, L[1]);   // quiver strap
  ckBelt(p, P);
  castleFace(p, P);
  // the hood and a ragged capelet
  cuteHood(p, P, [C[0], C[1], C[2], C[3], C[4]]);
  p.poly(shift([[27, 22], [40, 22], [41, 26], [39, 27], [37, 25], [35, 27], [33, 25], [31, 27], [29, 25], [27, 27]], b), C[2]);
  p.rect(28, 22 + b, 12, 1, C[3]);
  ckFrontArm(p, P, W, CK.skin[2]);
  p.rect(38, 30 + b, 4, 3, L[2]);   // bracer
}

/** Minstrel: a feathered cap, puffed striped sleeves and a crimson-and-violet doublet (the lute is drawn by the enemy). */
function drawMinstrel(p, P) {
  useSkin('fair');
  const { b, hb } = P;
  const C = CK.crimson;
  const V = CK.violet;
  const legs = (row) => (row % 4 < 2 ? [C[1], C[2], C[3]] : [V[1], V[2], V[3]]);   // striped hose
  ckBackArm(p, P, V);
  cuteLeg(p, 29, 29 - P.s, P.lb, legs, [CK.cloth[0], CK.cloth[1], CK.cloth[2]], 54);
  cuteLeg(p, 34, 34 + P.s, P.lf, legs, [CK.cloth[1], CK.cloth[2], CK.cloth[3]], 54);
  // short dagged doublet skirt
  const hem = Math.round(P.s / 2);
  p.poly([[28, 33 + b], [39, 33 + b], [40 + hem, 40 + b], [27 + hem, 40 + b]], V[2]);
  for (let x = 27; x < 40; x += 3) p.poly([[x + hem, 40 + b], [x + 3 + hem, 40 + b], [x + 1.5 + hem, 43 + b]], x % 2 ? V[2] : C[2]);
  // the doublet: half crimson, half violet
  p.round(28, 24 + b, 12, 11, C[2], 2);
  p.rect(34, 24 + b, 6, 11, V[2]);
  p.rect(29, 25 + b, 3, 7, C[3]);
  for (let y = 26; y < 33; y += 2) p.px(34, y + b, CK.gold[3]);   // buttons
  ckBelt(p, P);
  // puffed sleeve on the front arm, striped
  p.round(34, 23 + b, 8, 8, C[2], 3);
  p.rect(36, 23 + b, 2, 8, V[2]);
  p.rect(35, 24 + b, 2, 2, C[3]);
  p.rect(38, 30 + b, 4, 4, V[1]);
  p.round(38, 34 + b, 4, 3, CK.skin[2], 1);
  castleFace(p, P);
  // a lank fringe and a cap with a long drooping feather
  cuteBangs(p, P, ['#1a1420', '#2e2434', '#443650', '#5a4a66']);
  p.round(26, 7 + hb, 15, 7, C[2], 3);
  p.rect(27, 7 + hb, 7, 2, C[3]);
  p.rect(25, 12 + hb, 17, 2, C[1]);
  p.poly(shift([[33, 8], [27, 3], [20 + P.hs, 2], [16 + P.hs, 5], [22, 5], [28, 7]], hb), '#e8e0d0');
  p.line(31, 7 + hb, 19 + P.hs, 3 + hb, '#b0a8a0');
  p.px(16 + P.hs, 5 + hb, '#8a2438');
}

/** Gunner: a squire with a crested morion helmet and a bandolier of powder flasks (the gun is drawn by the enemy). */
function drawGunner(p, P) {
  useSkin('dark');
  const { b, hb } = P;
  const S = CK.steel;
  const L = RAMP.leather;
  const W = CK.cloth;
  ckBackArm(p, P, W);
  ckLegs(p, P, W, L.slice(1), 50, 3, L[3]);
  ckSkirt(p, P, [CK.crimson[0], CK.crimson[1], CK.crimson[2], CK.crimson[3]]);
  ckTorso(p, P, [S[1], S[2], S[3], S[4]]);   // a steel breastplate
  p.rect(34, 25 + b, 1, 8, S[5]);
  // bandolier with wooden flasks
  p.line(28, 24 + b, 39, 34 + b, L[1], 2);
  for (let i = 0; i < 4; i++) {
    p.rect(29 + i * 2.6, 25 + b + i * 2.4, 2, 3, L[3]);
    p.px(29 + i * 2.6, 25 + b + i * 2.4, CK.gold[3]);
  }
  ckBelt(p, P);
  castleFace(p, P);
  // morion: a tall comb on a domed cap, the brim swept up front and back
  p.round(28, 7 + hb, 13, 8, S[3], 4);
  p.poly(shift([[29, 8], [33, 2], [37, 2], [40, 8]], hb), S[3]);
  p.line(33, 3 + hb, 36, 3 + hb, S[5]);
  p.poly(shift([[23, 11], [28, 13], [41, 13], [46, 10], [44, 14], [25, 14]], hb), S[2]);
  p.rect(26, 13 + hb, 17, 1, S[4]);
  p.rect(30, 9 + hb, 5, 1, S[5]);
  ckFrontArm(p, P, W, CK.skin[2]);
}

/** Mace spinner: a hulking brute in a mail hood and a studded leather jerkin, arms bare and scarred. */
function drawMaceSpinner(p, P) {
  useSkin('ruddy');
  const { b, hb } = P;
  const S = CK.steel;
  const L = RAMP.leather;
  const Sk = CK.skin;
  // thick back arm
  p.poly([[27, 24 + b], [31, 25 + b], [30 + P.ba, 33 + b], [25 + P.ba, 34 + b]], Sk[1]);
  ckLegs(p, P, CK.cloth, L.slice(1), 51, 4, L[3]);
  ckSkirt(p, P, [L[0], L[1], L[2], L[3]], 0, true);
  // a broad barrel chest in studded leather
  p.round(26, 23 + b, 16, 13, L[2], 3);
  p.rect(27, 24 + b, 3, 10, L[3]);
  p.rect(39, 25 + b, 3, 9, L[1]);
  for (let y = 26; y < 34; y += 3) for (let x = 29; x < 40; x += 3) p.px(x + (y % 2), y + b, S[4]);
  p.rect(26, 33 + b, 16, 2, L[1]);
  p.rect(32, 33 + b, 3, 2, S[4]);
  // mail hood down to the shoulders, a dented iron skullcap
  p.round(26, 10 + hb, 16, 15, S[2], 5);
  for (let y = 12; y < 25; y += 2) for (let x = 27; x < 41; x += 2) p.px(x + (y % 4 ? 1 : 0), y + hb, S[1]);
  castleFace(p, P, { eye: '#3a2010', scar: true });
  p.rect(30, 16 + b, 3, 1, Sk[1]);   // a heavy brow
  p.round(27, 7 + hb, 14, 7, S[3], 4);
  p.rect(29, 8 + hb, 5, 2, S[4]);
  p.rect(25, 12 + hb, 18, 2, S[2]);
  // thick bare front arm with a scar and a leather wrap at the wrist
  p.round(35, 23 + b, 8, 7, Sk[2], 3);
  p.rect(37, 24 + b, 3, 1, Sk[3]);
  p.rect(38, 29 + b, 5, 5, Sk[2]);
  p.line(39, 26 + b, 41, 29 + b, '#6a3a4a');
  p.rect(38, 32 + b, 5, 2, L[2]);
  p.round(38, 34 + b, 5, 3, Sk[2], 1);
}

/** Bishop: a tall mitre, violet chasuble trimmed in tarnished gold over long grey robes. */
function drawBishop(p, P) {
  useSkin('pale');
  const { b, hb } = P;
  const V = CK.violet;
  const G = CK.gold;
  const Ln = CK.linen;
  ckBackArm(p, P, Ln, CK.skin[1]);
  ckLegs(p, P, CK.cloth, CK.cloth, 56, 3);
  // long robes to the ankle
  ckSkirt(p, P, [Ln[0], Ln[1], Ln[2], Ln[3]], 9);
  // chasuble: a violet panel front, gold orphrey down the middle
  const hem = Math.round(P.s / 2);
  p.poly([[28, 24 + b], [40, 24 + b], [41 + hem, 46 + b], [27 + hem, 46 + b]], V[2]);
  p.poly([[28, 24 + b], [31, 24 + b], [29 + hem, 46 + b], [27 + hem, 46 + b]], V[3]);
  p.poly([[32, 24 + b], [36, 24 + b], [36 + hem, 46 + b], [32 + hem, 46 + b]], G[2]);
  p.line(33, 25 + b, 33 + hem, 45 + b, G[3]);
  p.rect(33, 30 + b, 2, 6, V[1]);   // a cross worked into it
  p.rect(32, 32 + b, 4, 2, V[1]);
  castleFace(p, P);
  // the mitre: two tall points with gold bands, lappets hanging behind
  p.poly(shift([[28, 13], [29, 2], [34, -1], [39, 2], [40, 13]], hb), V[2]);
  p.poly(shift([[28, 13], [29, 2], [31, 1], [31, 13]], hb), V[3]);
  p.rect(28, 11 + hb, 13, 2, G[2]);
  p.rect(33, 0 + hb, 2, 12, G[2]);
  p.px(33, 1 + hb, G[4]);
  p.line(27, 13 + hb, 25 + P.sw, 22 + hb, V[1], 2);
  // the blessing hand
  p.round(35, 24 + b, 6, 6, Ln[2], 1);
  p.rect(38, 29 + b, 4, 5, Ln[2]);
  p.round(38, 34 + b, 4, 3, CK.skin[2], 1);
}

/** Castle knight: full blackened plate, a visored helm with a crimson plume (sword and shield drawn by the enemy). */
function drawCastleKnight(p, P, royal = false) {
  useSkin('fair');
  const { b, hb } = P;
  const S = CK.steel;
  const C = CK.crimson;
  const G = CK.gold;
  const trim = royal ? G[3] : S[4];
  // crimson half-cape
  const f = P.cf;
  p.poly([[27, 23 + b], [34, 23 + b], [32, 34 + b], [31, 46], [27, 48], [21 + f, 49], [18 + f, 46], [20, 36 + b], [23, 28 + b]], C[2]);
  p.line(24, 27 + b, 19 + f, 46, C[3]);
  p.line(28, 30 + b, 25 + f, 47, C[1]);
  const legs = ckLegs(p, P, [S[0], S[1], S[2], S[3]], [S[0], S[1], S[2], S[4]], 55, 4);
  ckKnees(p, P, legs, S);
  ckSkirt(p, P, [S[0], S[1], S[2], S[3]], 0, true);
  if (royal) {
    // a gold-edged crimson tabard
    const hem = Math.round(P.s / 2);
    p.poly([[31, 33 + b], [37, 33 + b], [38 + hem, 46 + b], [30 + hem, 46 + b]], C[2]);
    p.rect(30 + hem, 45 + b, 9, 1, G[3]);
    p.rect(33 + Math.round(hem / 2), 37 + b, 2, 5, G[3]);
  }
  ckTorso(p, P, [S[1], S[2], S[3], S[4]]);
  p.rect(34, 25 + b, 1, 8, S[5]);
  p.rect(35, 25 + b, 1, 8, S[1]);
  if (royal) {
    p.rect(28, 24 + b, 12, 1, G[3]);
    p.rect(30, 28 + b, 3, 3, G[2]);
    p.px(31, 29 + b, '#ff5a6a');
  }
  ckBelt(p, P, RAMP.leather, G);
  p.round(29, 21 + b, 10, 4, S[2], 1);
  p.rect(30, 21 + b, 8, 1, trim);
  // plume
  const hs = P.hs;
  p.poly([[34, 7 + b], [33, 4 + b], [28, 2 + b], [23, 3 + b], [18 + hs, 6 + hb], [14 + hs, 11 + hb], [18 + hs, 11 + hb], [23, 8 + b], [29, 7 + b]], royal ? G[2] : C[2]);
  p.line(32, 4 + b, 20 + hs, 7 + hb, royal ? G[4] : C[4]);
  p.line(29, 6 + b, 17 + hs, 10 + hb, royal ? G[1] : C[1]);
  // visored helm: a pointed visor with breaths, eyes glowing through the slit
  p.round(28, 8 + b, 13, 15, S[3], 4);
  p.rect(29, 10 + b, 3, 10, S[4]);
  p.rect(30, 9 + b, 4, 1, S[5]);
  p.rect(38, 10 + b, 2, 11, S[1]);
  p.poly(shift([[31, 14], [42, 16], [38, 21], [31, 21]], b), S[3]);   // the visor's beak
  p.rect(32, 15 + b, 7, 1, '#0b0a10');
  if (P.eyes !== 'blink') { p.px(34, 15 + b, CK.eye); p.px(37, 15 + b, CK.eye); }
  for (const [x, y] of [[36, 18], [38, 18], [34, 19]]) p.px(x, y + b, S[0]);
  p.rect(29, 13 + b, 11, 1, trim);
  if (royal) {
    p.rect(30, 7 + b, 9, 2, G[2]);   // a gold crest band
    p.px(34, 6 + b, G[4]);
  }
  ckFrontArm(p, P, S, S[2], true);
}

function drawRoyalGuard(p, P) { drawCastleKnight(p, P, true); }

/** Castle sorcerer: a court mage in a high-collared violet robe with glowing runes, a deep hood. */
function drawCastleSorcerer(p, P) {
  useSkin('pale');
  const { b, hb } = P;
  const V = CK.violet;
  const G = CK.gold;
  ckBackArm(p, P, V, CK.skin[1]);
  ckLegs(p, P, CK.cloth, CK.cloth, 56, 3);
  ckSkirt(p, P, V, 10);
  // runes stitched glowing down the hem
  const hem = Math.round(P.s / 2);
  for (let i = 0; i < 4; i++) p.rect(29 + i * 3 + hem, 50 + b, 1, 2, '#c49aff');
  ckTorso(p, P, V);
  p.rect(33, 24 + b, 2, 11, G[2]);
  p.px(33, 27 + b, G[4]);
  ckBelt(p, P, [V[0], V[0], V[1], V[2]], G);
  // a tall stiff collar fanning behind the head
  p.poly(shift([[25, 24], [24, 12], [27, 10], [30, 20], [38, 20], [41, 10], [44, 12], [43, 24]], b), V[1]);
  p.line(25, 23 + b, 25, 13 + b, V[3]);
  castleFace(p, P, { eye: '#6a3a9a' });
  cuteHood(p, P, V);
  p.px(33, 9 + hb, G[3]);   // a gem on the hood
  // a sleeve hanging wide from the casting arm
  p.poly([[34, 24 + b], [41, 26 + b], [44, 34 + b], [37, 35 + b]], V[2]);
  p.line(35, 25 + b, 38, 34 + b, V[3]);
  p.round(39, 33 + b, 4, 3, CK.skin[2], 1);
}

/** Jester: harlequin motley in crimson and black, a three-pointed belled hat and a white mask with a painted grin. */
function drawJester(p, P) {
  useSkin('pale');
  const { b, hb } = P;
  const C = CK.crimson;
  const K = ['#0c0a10', '#1a1620', '#2c2634', '#3e3648'];
  const legL = [C[1], C[2], C[3]];
  const legR = [K[0], K[1], K[2]];
  cuteLeg(p, 29, 29 - P.s, P.lb, legL, [K[0], K[1], K[2]], 55);
  cuteLeg(p, 34, 34 + P.s, P.lf, legR, [K[1], K[2], K[3]], 55);
  ckBackArm(p, P, K, '#e8e4ec');
  // diamond-checked tunic with a jagged hem
  const hem = Math.round(P.s / 2);
  p.poly([[28, 24 + b], [39, 24 + b], [41 + hem, 41 + b], [26 + hem, 41 + b]], C[2]);
  for (let y = 26; y < 40; y += 4) {
    for (let x = 28; x < 40; x += 4) {
      const xx = x + ((y / 4) % 2 ? 2 : 0) + Math.round(hem * (y - 24) / 17);
      p.poly([[xx, y - 2 + b], [xx + 2, y + b], [xx, y + 2 + b], [xx - 2, y + b]], K[1]);
    }
  }
  for (let x = 26; x < 41; x += 3) p.poly([[x + hem, 41 + b], [x + 3 + hem, 41 + b], [x + 1.5 + hem, 44 + b]], (x / 3) % 2 ? C[2] : K[1]);
  // a ruffled collar
  for (let x = 27; x < 41; x += 3) p.round(x, 21 + b, 4, 4, '#d8d0dc', 2);
  // the mask: bone white, black diamond eyes, a too-wide painted grin
  const Sk = ['#8a8290', '#c8c0cc', '#ece6f0'];
  p.round(29, 12 + b, 11, 12, Sk[2], 3);
  p.rect(29, 19 + b, 2, 3, Sk[1]);
  p.poly(shift([[31, 15], [33, 17], [31, 19], [29, 17]], b), '#0c0a10');
  p.poly(shift([[37, 15], [39, 17], [37, 19], [35, 17]], b), '#0c0a10');
  if (P.eyes !== 'blink') { p.px(31, 17 + b, CK.eye); p.px(37, 17 + b, CK.eye); }
  p.line(30, 21 + b, 33, 23 + b, '#8a1a2a');
  p.line(33, 23 + b, 39, 20 + b, '#8a1a2a');
  p.px(31, 20 + b, '#8a1a2a');
  p.px(31, 14 + b, '#ff8aa0');   // a painted tear
  // the hat: three floppy points, crimson and black, gold bells
  p.round(27, 8 + hb, 14, 6, K[1], 3);
  p.poly(shift([[28, 10], [23, 4], [19 + P.hs, 6], [25, 12]], hb), C[2]);
  p.poly(shift([[32, 9], [33, 1], [37 + P.hs, -1], [36, 9]], hb), K[2]);
  p.poly(shift([[38, 10], [44, 5], [47 + P.hs, 9], [41, 12]], hb), C[2]);
  for (const [x, y] of [[19, 6], [37, -1], [47, 9]]) {
    p.round(x + P.hs - 1, y + hb, 3, 3, CK.gold[3], 1);
    p.px(x + P.hs, y + hb, CK.gold[4]);
  }
  p.rect(27, 12 + hb, 14, 2, CK.gold[2]);
  ckFrontArm(p, P, K, '#e8e4ec');
}

/** Executioner: a huge brute (80x80 frame) in a black hood, bare ashen arms, a leather apron stained dark. */
function drawExecutioner(p, P) {
  useSkin('tan');
  const { b, hb, s } = P;
  const Sk = CK.skin;
  const L = RAMP.leather;
  const K = ['#08060c', '#141018', '#221c28', '#342c3c'];
  const o = 8;   // the 80px frame: everything shifted right/down
  const X = (x) => x + o;
  const Y = (y) => y + 8;
  const sh = (pts, dy) => pts.map(([x, y]) => [X(x), Y(y) + dy]);
  // back arm
  p.poly(sh([[25, 22], [30, 23], [29 + P.ba, 34], [23 + P.ba, 35]], b), Sk[1]);
  // heavy legs in dark breeches, boots
  const leg = (hip, foot, lift, R, B) => {
    for (let y = 40; y <= 58 - lift; y++) {
      const t = (y - 40) / (18 - lift);
      const x = Math.round(X(hip) + (foot - hip) * t);
      const r = y >= 52 - lift ? B : R;
      p.rect(x, Y(y) - 8 + 8, 5, 1, r[1]);
      p.px(x, Y(y), r[2]);
      p.px(x + 4, Y(y), r[0]);
    }
    const fx = Math.round(X(foot));
    p.rect(fx + 1, Y(58 - lift) - 1, 6, 2, B[1]);
    p.rect(fx, Y(58 - lift) + 1, 7, 1, B[0]);
  };
  leg(27, 27 - s, P.lb, [K[0], K[1], K[2]], [L[0], L[1], L[2]]);
  leg(34, 34 + s, P.lf, [K[1], K[2], K[3]], [L[1], L[2], L[3]]);
  // a huge bare belly and chest under a leather apron
  p.round(X(23), Y(21) + b, 22, 20, Sk[2], 6);
  p.rect(X(24), Y(23) + b, 4, 14, Sk[3]);
  p.rect(X(41), Y(24) + b, 3, 14, Sk[1]);
  p.line(X(29), Y(27) + b, X(31), Y(30) + b, '#6a3a4a');   // scars
  p.line(X(36), Y(25) + b, X(39), Y(28) + b, '#6a3a4a');
  p.poly(sh([[26, 30], [42, 30], [44, 47], [24, 47]], b), L[2]);
  p.poly(sh([[26, 30], [30, 30], [28, 47], [24, 47]], b), L[3]);
  p.rect(X(24), Y(30) + b, 20, 2, L[1]);
  p.ellipse(X(35), Y(39) + b, 4, 3, '#3e0e16');   // old stains
  p.ellipse(X(30), Y(43) + b, 2, 2, '#3e0e16');
  // the black hood with eye holes, the cowl spreading over the shoulders
  p.poly(sh([[22, 26], [24, 14], [27, 6], [33, 3], [39, 5], [43, 12], [45, 26]], hb), K[2]);
  p.poly(sh([[22, 26], [24, 14], [27, 6], [29, 6], [27, 18], [26, 26]], hb), K[3]);
  p.rect(X(29), Y(12) + hb, 13, 3, K[0]);
  if (P.eyes !== 'blink') {
    // hard eyes staring out of the holes
    p.rect(X(31), Y(13) + hb, 3, 1, '#ece4dc');
    p.rect(X(37), Y(13) + hb, 3, 1, '#ece4dc');
    p.px(X(33), Y(13) + hb, '#120a10');
    p.px(X(38), Y(13) + hb, '#120a10');
  }
  p.line(X(26), Y(24) + hb, X(42), Y(24) + hb, K[1]);
  // the axe arm: huge, bare, a leather bracer
  p.round(X(37), Y(21) + b, 10, 9, Sk[2], 4);
  p.rect(X(39), Y(22) + b, 4, 1, Sk[3]);
  p.rect(X(40), Y(29) + b, 6, 7, Sk[2]);
  p.rect(X(40), Y(31) + b, 6, 3, L[2]);
  p.round(X(40), Y(36) + b, 6, 4, Sk[2], 1);
}

/** The Prince: a pale golden-haired noble with a circlet, a short crimson cape and a gilded doublet (sword and trumpet drawn by the enemy). */
function drawPrince(p, P) {
  useSkin('fair');
  const { b, hb } = P;
  const C = CK.crimson;
  const G = CK.gold;
  const W = CK.cloth;
  const HA = ['#3a2e14', '#6a5626', '#a08a4a', '#cfc08a', '#ece2b8'];   // ashen gold hair
  const f = P.cf;
  p.poly([[27, 23 + b], [33, 23 + b], [32, 33 + b], [30, 42], [25, 44], [20 + f, 44], [19 + f, 40], [22, 31 + b]], C[2]);
  p.line(24, 27 + b, 20 + f, 42, C[3]);
  ckBackArm(p, P, W);
  const legs = ckLegs(p, P, [W[0], W[1], W[2], W[3]], [RAMP.leather[1], RAMP.leather[2], RAMP.leather[3], RAMP.leather[4]], 48, 3, G[2]);
  void legs;
  const hem = ckSkirt(p, P, [C[0], C[1], C[2], C[3]]);
  p.rect(26 + hem, 43 + b, 16, 1, G[3]);
  ckTorso(p, P, [W[0], W[1], W[2], W[3]]);
  // a gilded doublet front with a sash
  p.poly([[31, 24 + b], [37, 24 + b], [37, 34 + b], [31, 34 + b]], G[2]);
  p.rect(31, 24 + b, 2, 10, G[3]);
  p.line(29, 24 + b, 39, 33 + b, C[3], 2);
  ckBelt(p, P);
  castleFace(p, P);
  // golden hair swept over, a thin crown
  cuteBangs(p, P, HA);
  p.round(27, 9 + hb, 14, 6, HA[2], 3);
  p.rect(28, 9 + hb, 8, 1, HA[3]);
  p.rect(26, 13 + hb, 3, 8, HA[2]);   // hair over the ear
  p.rect(28, 9 + hb, 13, 2, G[2]);
  for (const x of [29, 33, 37]) p.poly(shift([[x - 1, 9], [x, 5], [x + 1, 9]], hb), G[3]);
  p.px(33, 8 + hb, '#c43a6a');
  ckFrontArm(p, P, W, CK.skin[2]);
  p.rect(38, 30 + b, 4, 2, G[3]);   // a gold cuff
}

/** The Princess: a violet gown with a crimson bodice, long silver hair and a tiara (crossbow drawn by the enemy). */
function drawPrincess(p, P) {
  useSkin('pale');
  const { b, hb } = P;
  const V = CK.violet;
  const C = CK.crimson;
  const G = CK.gold;
  const HA = ['#3e3a4a', '#6e6880', '#a29cb4', '#cfcadc', '#ece8f4'];   // silver-grey hair
  // long hair down the back
  p.poly(shift([[26, 12], [30, 10], [29, 30], [27 + P.sw, 38], [22 + P.sw, 36], [23, 24]], hb), HA[2]);
  p.line(26, 14 + hb, 23 + P.sw, 34 + hb, HA[3]);
  ckBackArm(p, P, V, CK.skin[1]);
  ckLegs(p, P, CK.cloth, CK.cloth, 56, 3);
  // a full gown to the floor
  const hem = Math.round(P.s / 2);
  p.poly([[28, 32 + b], [39, 32 + b], [43 + hem, 54], [24 + hem, 54]], V[2]);
  p.poly([[28, 32 + b], [31, 32 + b], [27 + hem, 54], [24 + hem, 54]], V[3]);
  p.poly([[37, 32 + b], [39, 32 + b], [43 + hem, 54], [39 + hem, 54]], V[1]);
  p.rect(24 + hem, 53, 20, 1, G[2]);
  for (let x = 27; x < 41; x += 4) p.px(x + hem, 50, G[3]);
  // bodice
  p.round(29, 24 + b, 10, 9, C[2], 2);
  p.rect(30, 25 + b, 2, 6, C[3]);
  p.rect(33, 25 + b, 1, 7, G[3]);
  p.rect(29, 31 + b, 10, 1, G[2]);
  castleFace(p, P, { eye: '#3a6ab0', brow: '#6e6880' });
  cuteBangs(p, P, HA);
  // tiara with a pale blue gem
  p.rect(29, 10 + hb, 11, 2, G[2]);
  p.poly(shift([[32, 10], [34, 6], [36, 10]], hb), G[3]);
  p.px(34, 8 + hb, '#9ad0ff');
  p.round(35, 24 + b, 6, 6, V[2], 2);
  p.rect(38, 29 + b, 4, 5, V[2]);
  p.round(38, 34 + b, 4, 3, CK.skin[2], 1);
}

/** The Queen's gardener: a straw hat, a green apron over a grey smock, soil on the boots (the watering can is drawn by the enemy). */
function drawGardener(p, P) {
  useSkin('tan');
  const { b, hb } = P;
  const GR = ['#14200e', '#22361a', '#345226', '#4a6e32'];
  const Ln = CK.linen;
  const L = RAMP.leather;
  ckBackArm(p, P, Ln);
  ckLegs(p, P, CK.cloth, L.slice(1), 52, 3);
  ckSkirt(p, P, Ln);
  ckTorso(p, P, Ln);
  // the apron with a pocket of seed packets
  p.poly([[30, 23 + b], [38, 23 + b], [39 + Math.round(P.s / 2), 44 + b], [29 + Math.round(P.s / 2), 44 + b]], GR[2]);
  p.rect(30, 23 + b, 2, 20, GR[3]);
  p.rect(32, 33 + b, 5, 4, GR[1]);
  p.rect(33, 32 + b, 1, 2, '#c8a456');
  p.rect(35, 31 + b, 1, 3, '#c03048');
  castleFace(p, P, { eye: '#3a6a2a' });
  // a wide straw hat with a red band and a rose tucked in
  p.round(27, 7 + hb, 14, 7, '#a88a4a', 3);
  p.rect(29, 8 + hb, 6, 1, '#d4b46a');
  p.rect(22, 13 + hb, 24, 2, '#8a6e36');
  p.rect(23, 13 + hb, 22, 1, '#c8a45a');
  p.rect(27, 11 + hb, 14, 2, '#7a1a2a');
  p.circle(39, 11 + hb, 2, '#c03048');
  p.px(38, 10 + hb, '#ff6a80');
  ckFrontArm(p, P, Ln, CK.skin[2]);
}
