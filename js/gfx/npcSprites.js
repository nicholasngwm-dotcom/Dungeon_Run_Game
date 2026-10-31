// Friendly NPCs in the heroes' cute style (js/gfx/heroes/cute.js): Mira the
// shopkeeper, Chef Bruno, Bram the enchanter, the blacksmith (with his
// hammering animation), the lobby tinkerer (welding), the traders, the ranch
// hand and the helper. 64x64, facing right, anchor (32, 50), with the heroes'
// 8-frame idle. Plus the mount trader's pony (80x64).

const NPC_EYES = {
  green: ['#1e3a2a', '#2e6a42', '#4a9a62', '#b0e8b8'],
  brown: ['#2a1a0a', '#4a3018', '#7a5430', '#d0a878'],
  blue: ['#16203e', '#2a4a8a', '#5a80c8', '#cfe0ff'],
  teal: ['#0e2a30', '#1e5a64', '#3a9aa8', '#b8f0f0'],
};

/** A cap of hair over the head (ramp darkest first, 4+ colours), with a lock down the back of the head. */
function npcHairCap(p, P, H, opts = {}) {
  const b = P.b;
  p.round(27, 8 + b, 15, 7, H[2], 3);
  p.rect(29, 9 + b, 7, 1, H[3]);
  p.rect(27, 12 + b, 2, opts.long ? 11 : 8, H[2]);
  p.px(27, 13 + b, H[1]);
}

/** Mira the shopkeeper: long red hair, green dress, cream apron, plum shawl and a coin necklace. */
function drawShopkeeper(p, P) {
  const { b, hb } = P;
  const Hr = ['#5a1a10', '#8a2a18', '#b8442a', '#e06a40', '#f08a5a'];
  const D = ['#1e3a2a', '#2e5a3e', '#3e7a52', '#5a9a6a'];
  const A = ['#a89878', '#cdbd9a', '#e8dcc0', '#fff6e0'];
  const Sh = ['#4a1a3a', '#7a3a5a', '#9a5a7a'];
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  const sw = P.sw;
  const hem = P.cf;
  // long hair down her back, swaying a frame behind
  p.poly([[27, 12 + hb], [31, 10 + hb], [30, 30 + hb], [25 + sw, 38 + hb], [21 + sw, 35 + hb], [23, 20 + hb]], Hr[1]);
  p.line(25, 16 + hb, 23 + sw, 34 + hb, Hr[2]);
  p.line(27, 18 + hb, 26 + sw, 36 + hb, Hr[0]);
  // dress to the floor
  p.poly([[27, 24 + b], [39, 24 + b], [41, 34 + b], [44 + hem, 57], [21 + hem, 57], [24, 34 + b]], D[2]);
  p.poly([[27, 24 + b], [30, 24 + b], [26 + hem, 57], [21 + hem, 57], [24, 34 + b]], D[3]);
  p.poly([[38, 30 + b], [41, 34 + b], [44 + hem, 57], [40 + hem, 57]], D[1]);
  p.rect(21 + hem, 56, 24, 1, D[0]);
  // apron with a pocket and a bow at the back
  p.poly([[29, 30 + b], [38, 30 + b], [40 + hem, 52], [28 + hem, 52]], A[2]);
  p.poly([[29, 30 + b], [31, 30 + b], [30 + hem, 52], [28 + hem, 52]], A[3]);
  p.rect(28 + hem, 51, 13, 1, A[0]);
  p.rect(32, 40 + b, 5, 4, A[1]);
  p.rect(27, 33 + b, 13, 2, A[1]);
  p.rect(24, 32 + b, 3, 4, A[2]);
  // back arm
  p.poly([[26, 26 + b], [29, 26 + b], [28 + P.ba, 34 + b], [25 + P.ba, 34 + b]], D[1]);
  // shawl over the shoulders
  p.poly([[25, 23 + b], [41, 23 + b], [42, 27 + b], [33, 30 + b], [25, 27 + b]], Sh[1]);
  p.rect(26, 23 + b, 14, 1, Sh[2]);
  p.line(33, 29 + b, 41, 26 + b, Sh[0]);
  // face, red hair and bangs, a coin necklace
  cuteFace(p, P, NPC_EYES.green);
  npcHairCap(p, P, Hr, { long: true });
  cuteBangs(p, P, Hr);
  p.rect(40, 13 + b, 2, 7, Hr[2]);
  p.px(28, 21 + b, G[3]);              // earring
  p.rect(34, 24 + b, 2, 2, G[2]);
  p.px(34, 24 + b, G[3]);
  // arm resting forward on the counter
  p.poly([[36, 25 + b], [40, 25 + b], [43, 31 + b], [41, 34 + b], [37, 30 + b]], D[2]);
  p.round(41, 31 + b, 4, 4, Sk[2], 1);
}

/**
 * Elowen the librarian: dark hair up in a bun with a quill through it, round
 * glasses, a long plum dress under a cream cardigan, an open book in her hands.
 * P.page: 0/1 turns the page (her 'read' animation).
 */
function drawLibrarian(p, P) {
  const { b, hb } = P;
  const Hr = ['#1e1414', '#3a2422', '#55332c', '#704a3e', '#8a5e4c'];
  const D = ['#2a1230', '#4a1e4e', '#6a2e6a', '#8a4a86'];
  const C = ['#a89878', '#cdbd9a', '#e8dcc0', '#fff6e0'];
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  const hem = P.cf;
  // long dress to the floor
  p.poly([[27, 24 + b], [39, 24 + b], [41, 34 + b], [44 + hem, 57], [21 + hem, 57], [24, 34 + b]], D[2]);
  p.poly([[27, 24 + b], [30, 24 + b], [26 + hem, 57], [21 + hem, 57], [24, 34 + b]], D[3]);
  p.poly([[38, 30 + b], [41, 34 + b], [44 + hem, 57], [40 + hem, 57]], D[1]);
  p.rect(21 + hem, 56, 24, 1, D[0]);
  for (const y of [44, 50]) p.rect(23 + hem, y, 19, 1, D[1]);           // pleats
  // cream cardigan over the shoulders, buttoned
  p.poly([[25, 23 + b], [41, 23 + b], [42, 34 + b], [24, 34 + b]], C[2]);
  p.rect(25, 23 + b, 4, 11, C[3]);
  p.rect(33, 24 + b, 1, 10, C[0]);
  for (const y of [26, 29, 32]) p.px(34, y + b, G[2]);
  // back arm
  p.poly([[25, 26 + b], [28, 26 + b], [27 + P.ba, 34 + b], [24 + P.ba, 34 + b]], C[1]);
  // face, hair cap, and a big bun on the back of the head with a quill through it
  cuteFace(p, P, NPC_EYES.brown);
  npcHairCap(p, P, Hr);
  p.circle(25, 10 + hb, 5, Hr[2]);
  p.circle(24, 9 + hb, 3, Hr[3]);
  p.line(19, 4 + hb, 29, 14 + hb, '#efe6d2');
  p.px(19, 4 + hb, '#8a2a24');
  cuteBangs(p, P, Hr);
  // round glasses
  for (const gx of [30, 35]) {
    p.rect(gx, 16 + b, 4, 1, G[1]); p.rect(gx, 20 + b, 4, 1, G[1]);
    p.rect(gx - 1, 17 + b, 1, 3, G[1]); p.rect(gx + 4, 17 + b, 1, 3, G[1]);
  }
  p.px(34, 18 + b, G[1]);
  // both hands holding an open book in front
  const pg = P.page || 0;
  p.rect(36, 27 + b, 13, 8, '#5a2a3a');
  p.rect(37, 26 + b, 5, 8, C[3]);
  p.rect(43, 26 + b, 5, 8, pg ? C[2] : C[3]);
  if (pg) p.poly([[42, 26 + b], [46, 22 + b], [47, 29 + b], [42, 33 + b]], C[3]);   // page mid-turn
  for (let i = 0; i < 3; i++) p.rect(38, 28 + i * 2 + b, 3, 1, '#8a7a5a');
  p.poly([[35, 25 + b], [39, 25 + b], [40, 31 + b], [37, 32 + b]], C[2]);
  p.round(38, 30 + b, 4, 4, Sk[2], 1);
}

/** Chef Bruno: chubby, a big moustache, a tall puffy hat, white jacket and a red neckerchief, ladle in hand. */
function drawChef(p, P) {
  const { b, s } = P;
  const W = ['#a8a2b4', '#d4cfdc', '#f0edf4', '#ffffff'];
  const Hr = ['#2a1a0a', '#4a2e14', '#5a3a1a', '#7a5228'];
  const Sk = RAMP.skin;
  const L = RAMP.leather;
  cuteLeg(p, 29, 29 - s, P.lb, ['#2c2c3a', '#3e3e52', '#56566e'], [L[0], L[1], L[2]], 54);
  cuteLeg(p, 34, 34 + s, P.lf, ['#3e3e52', '#56566e', '#6a6a84'], [L[1], L[2], L[3]], 54);
  // back arm
  p.round(24, 26 + b, 5, 10, W[1], 2);
  // round double-breasted jacket
  p.round(25, 24 + b, 17, 19, W[2], 6);
  p.rect(26, 26 + b, 3, 14, W[3]);
  p.rect(39, 28 + b, 2, 12, W[1]);
  for (const y of [28, 32, 36]) { p.px(34, y + b, '#585d6c'); p.px(37, y + b, '#585d6c'); }
  p.rect(26, 40 + b, 16, 2, W[1]);
  // red neckerchief
  p.poly([[29, 23 + b], [39, 23 + b], [37, 27 + b], [34, 25 + b], [31, 27 + b]], '#c0302a');
  p.px(31, 23 + b, '#e05a4a');
  // face with rosy cheeks and a big curled moustache
  cuteFace(p, P, NPC_EYES.brown, { male: true, mask: true });
  p.rect(30, 21 + b, 2, 1, CUTE.blush);
  p.rect(32, 20 + b, 8, 2, Hr[2]);
  p.rect(33, 20 + b, 6, 1, Hr[3]);
  p.px(31, 21 + b, Hr[2]); p.px(40, 21 + b, Hr[2]); p.px(30, 20 + b, Hr[2]); p.px(41, 20 + b, Hr[2]);
  p.rect(27, 12 + b, 2, 8, Hr[2]);
  // tall puffy chef hat
  p.round(26, 2 + b, 17, 9, W[2], 5);
  p.round(28, 3 + b, 7, 4, W[3], 2);
  p.rect(37, 4 + b, 3, 5, W[1]);
  p.rect(27, 10 + b, 15, 3, W[1]);
  p.rect(27, 10 + b, 15, 1, W[3]);
  // arm with a ladle
  p.round(37, 26 + b, 5, 9, W[2], 2);
  p.round(39, 33 + b, 4, 4, Sk[2], 1);
  p.line(42, 34 + b, 48, 22 + b, '#80869a');
  p.round(46, 19 + b, 5, 4, '#adb2c0', 1);
}

/** Bram the enchanter: a kind old wizard with a long white beard, a starry blue robe and hat, holding up a glowing rune stone. */
function drawEnchanter(p, P) {
  const { b, hb } = P;
  const R = ['#16203e', '#22325e', '#334a86', '#4a66b0', '#6a88d0'];
  const W = ['#a8a4b4', '#d4d0dc', '#f0eef4'];
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  const hem = P.cf;
  // robe to the floor with a gold hem and stars
  p.poly([[26, 24 + b], [39, 24 + b], [42, 36 + b], [45 + hem, 57], [21 + hem, 57], [24, 36 + b]], R[2]);
  p.poly([[26, 24 + b], [29, 24 + b], [26 + hem, 57], [21 + hem, 57], [24, 36 + b]], R[3]);
  p.poly([[38, 30 + b], [42, 36 + b], [45 + hem, 57], [40 + hem, 57]], R[1]);
  p.rect(21 + hem, 55, 24, 2, G[1]);
  p.rect(21 + hem, 55, 24, 1, G[2]);
  for (const [sx, sy] of [[29, 45], [35, 50], [32, 40], [38, 44]]) { p.px(sx + hem, sy, G[3]); p.px(sx - 1 + hem, sy + 1, G[2]); }
  p.rect(25, 35 + b, 16, 2, G[1]);
  p.rect(25, 35 + b, 16, 1, G[2]);
  // back sleeve
  p.poly([[25, 26 + b], [29, 26 + b], [28, 36 + b], [23, 36 + b]], R[1]);
  // old face, bushy brows and a long white beard that sways
  cuteFace(p, P, NPC_EYES.blue, { male: true, mask: true });
  p.rect(30, 16 + b, 3, 1, W[2]);
  p.rect(35, 15 + b, 4, 1, W[2]);
  p.poly([[29, 20 + b], [40, 20 + b], [41, 25 + b], [38 + P.sw, 33 + hb], [35 + P.sw, 37 + hb], [32 + P.sw, 33 + hb], [29, 25 + b]], W[1]);
  p.line(35, 23 + b, 35 + P.sw, 35 + hb, W[0]);
  p.rect(31, 20 + b, 9, 1, W[2]);
  p.rect(27, 12 + b, 2, 9, W[1]);
  // tall bent wizard hat with a moon, its tip swaying
  const t = P.hs;
  p.poly([[27, 11 + b], [41, 11 + b], [37, 6 + b], [33, 2 + b], [28 + t, 0 + b], [25 + t, 2 + b], [30, 5 + b]], R[2]);
  p.poly([[27, 11 + b], [31, 11 + b], [30, 5 + b], [25 + t, 2 + b], [28 + t, 0 + b]], R[3]);
  p.poly([[24, 14 + b], [45, 14 + b], [43, 11 + b], [26, 11 + b]], R[1]);
  p.line(26, 13 + b, 43, 13 + b, R[4]);
  p.rect(33, 6 + b, 2, 2, G[3]);
  p.px(35, 6 + b, R[2]);
  // front arm raising a glowing rune stone
  p.poly([[36, 25 + b], [40, 25 + b], [43, 31 + b], [41, 34 + b], [37, 30 + b]], R[3]);
  p.round(41, 29 + b, 4, 4, Sk[2], 1);
  p.round(42, 22 + b, 6, 7, '#5a6a8a', 2);
  p.rect(44, 24 + b, 2, 3, '#9ae6ff');
  p.px(44, 24 + b, '#ffffff');
}

/**
 * The blacksmith: broad and bearded, a red headband, rolled sleeves and a
 * leather apron, swinging a hammer at the anvil in front of him.
 * P.swing: 0 = resting, 1 = raised overhead, 2 = swinging forward, 3 = struck down on the anvil.
 */
function drawBlacksmith(p, P) {
  const { b, s } = P;
  const swing = P.swing || 0;
  const Sh = ['#2a2420', '#463c34', '#625448', '#80705e'];
  const Hr = ['#140c0a', '#2a1a14', '#40281e', '#5a3a2a'];
  const L = RAMP.leather;
  const S = RAMP.steel;
  const Sk = RAMP.skin;
  cuteLeg(p, 29, 29 - s, P.lb, [Sh[0], Sh[1], Sh[2]], [L[0], L[1], L[2]], 52);
  cuteLeg(p, 34, 34 + s, P.lf, [Sh[1], Sh[2], Sh[3]], [L[1], L[2], L[3]], 52);
  // thick bare back arm
  p.round(23, 25 + b, 6, 13, Sk[1], 2);
  // broad chest, rolled sleeves
  p.round(25, 24 + b, 17, 18, Sh[2], 5);
  p.rect(26, 26 + b, 3, 12, Sh[3]);
  // leather apron to the knees, with tongs in the pocket
  p.poly([[29, 26 + b], [39, 26 + b], [41, 34 + b], [43, 48], [28, 48], [28, 34 + b]], L[2]);
  p.rect(30, 27 + b, 2, 10, L[3]);
  p.line(40, 32 + b, 42, 47, L[1]);
  p.rect(28, 47, 16, 1, L[0]);
  p.rect(33, 38 + b, 6, 5, L[1]);
  p.line(35, 36 + b, 34, 38 + b, S[3]);
  p.line(37, 36 + b, 38, 38 + b, S[3]);
  p.line(30, 26 + b, 29, 23 + b, L[1]);
  p.line(38, 26 + b, 39, 23 + b, L[1]);
  // face with a bushy beard, short dark hair, red headband and a soot smudge
  cuteFace(p, P, NPC_EYES.brown, { male: true, mask: true });
  p.poly([[29, 20 + b], [40, 20 + b], [41, 24 + b], [38, 28 + b], [31, 28 + b], [28, 24 + b]], Hr[2]);
  p.line(31, 25 + b, 38, 25 + b, Hr[3]);
  p.rect(34, 22 + b, 3, 1, CUTE.mouth);
  npcHairCap(p, P, Hr);
  p.rect(27, 11 + b, 15, 2, '#8a2a24');
  p.rect(27, 11 + b, 15, 1, '#b2443a');
  p.px(37, 21 + b, '#3a2a24');
  // hammer arm
  const T = [L[1], L[2], L[3]];
  if (swing === 1) {
    p.line(38, 27 + b, 41, 16 + b, Sk[2], 4);
    p.round(40, 12 + b, 5, 5, Sk[2], 1);
    p.line(43, 12 + b, 46, 5 + b, T[1], 2);
    p.round(42, 1 + b, 9, 5, S[2], 1);
    p.rect(43, 1 + b, 7, 1, S[4]);
  } else if (swing === 2) {
    p.line(38, 27 + b, 45, 23 + b, Sk[2], 4);
    p.round(46, 21 + b, 5, 5, Sk[2], 1);
    p.line(50, 22 + b, 56, 17 + b, T[1], 2);
    p.round(54, 12 + b, 6, 9, S[2], 1);
    p.rect(55, 13 + b, 1, 7, S[4]);
  } else if (swing === 3) {
    p.line(38, 28 + b, 45, 34 + b, Sk[2], 4);
    p.round(46, 33 + b, 5, 5, Sk[2], 1);
    p.line(50, 35 + b, 55, 36 + b, T[1], 2);
    p.round(54, 33 + b, 9, 7, S[2], 1);
    p.rect(55, 34 + b, 7, 1, S[4]);
  } else {
    p.round(37, 26 + b, 6, 11, Sk[2], 2);
    p.rect(38, 27 + b, 2, 9, Sk[3]);
    p.round(38, 36 + b, 5, 5, Sk[2], 1);
    p.line(42, 38 + b, 45, 46 + b, T[1], 2);
    p.round(42, 45 + b, 8, 5, S[2], 1);
    p.rect(43, 45 + b, 6, 1, S[4]);
  }
}

/**
 * The lobby workshop's tinkerer: messy copper hair, brass goggles, oily blue
 * overalls. P.work: 0 = idle, 1/2 = welding at the bench (torch held out,
 * goggles down; the two frames jiggle the torch).
 */
function drawTinkerer(p, P) {
  const { b, s } = P;
  const work = P.work || 0;
  const O = ['#1e2a3a', '#2c3e56', '#3e5676', '#567296'];
  const Sh = ['#7a6a5a', '#a8988a', '#d0c4b8'];
  const Hr = ['#5a2a10', '#8a4418', '#b8682a', '#d89048'];
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const G = CUTE.brass;
  cuteLeg(p, 29, 29 - s, P.lb, [O[0], O[1], O[2]], [L[0], L[1], L[2]], 52);
  cuteLeg(p, 34, 34 + s, P.lf, [O[1], O[2], O[3]], [L[1], L[2], L[3]], 52);
  p.round(25, 25 + b, 4, 10, Sh[1], 1);            // back arm
  p.round(24, 34 + b, 5, 4, '#3a2a1a', 1);         // glove
  // shirt, then overalls with a bib, straps and a pocket of tools
  p.round(27, 24 + b, 12, 10, Sh[1], 2);
  p.poly([[27, 28 + b], [39, 28 + b], [40, 36 + b], [41, 44 + b], [26, 44 + b], [26, 36 + b]], O[2]);
  p.rect(27, 29 + b, 3, 14, O[3]);
  p.line(28, 24 + b, 28, 28 + b, O[1]);
  p.line(37, 24 + b, 37, 28 + b, O[1]);
  p.rect(31, 30 + b, 5, 5, O[1]);
  p.line(32, 27 + b, 32, 30 + b, '#e04545');      // screwdriver
  p.line(34, 26 + b, 34, 30 + b, IRON_TINT);      // wrench
  p.rect(26, 37 + b, 15, 2, L[2]);                 // tool belt
  p.rect(37, 36 + b, 3, 5, L[1]);
  p.px(28, 33 + b, '#2a2018'); p.px(38, 41 + b, '#2a2018');
  // face, a smudge, messy copper hair
  cuteFace(p, P, NPC_EYES.teal);
  p.px(37, 21 + b, '#3a2a24');
  npcHairCap(p, P, Hr);
  cuteBangs(p, P, Hr);
  p.line(29, 8 + b, 27, 4 + b, Hr[2]);
  p.line(33, 8 + b, 34, 4 + b, Hr[2]);
  p.line(38, 9 + b, 41, 7 + b, Hr[2]);
  // goggles: up on the forehead, or down over the eyes while welding
  const gy = work ? 17 : 10;
  p.rect(28, gy + b, 13, 2, '#3a2a1a');
  for (const gx of [30, 35]) {
    p.round(gx, gy - 1 + b, 5, 4, G[1], 1);
    p.rect(gx + 1, gy + b, 3, 2, work ? '#6ae0ff' : '#9ad0ff');
    p.px(gx + 1, gy + b, '#ffffff');
  }
  // front arm: hanging, or holding a welding torch out over the bench
  if (work) {
    const j = work === 2 ? 1 : 0;
    p.line(37, 26 + b, 44, 30 + b, Sh[1], 4);
    p.round(44, 29 + b, 5, 4, '#3a2a1a', 1);
    p.line(48, 31 + b, 53, 32 + j + b, IRON_TINT, 2);
    p.rect(53, 31 + j + b, 2, 3, '#ffd34a');
  } else {
    p.round(37, 26 + b, 4, 10, Sh[1], 1);
    p.rect(37, 26 + b, 2, 9, Sh[2]);
    p.round(37, 35 + b, 5, 4, '#3a2a1a', 1);
  }
}
const IRON_TINT = '#8e94a6';

/** Travelling merchant: a feathered hat, green cloak and a huge pack with a bedroll and a pot. */
function drawTrader(p, P) {
  const { b, s, hb } = P;
  const C = ['#1e3a24', '#2e5a34', '#447a48', '#62985e'];
  const T = ['#3a2a1a', '#5a4430', '#7a6048', '#9a7e62'];
  const Hr = ['#3a2410', '#6a4220', '#946032', '#bc8848'];
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  // the big pack on his back, a beat behind
  p.round(13, 18 + hb, 14, 22, L[2], 3);
  p.rect(14, 19 + hb, 4, 19, L[3]);
  p.rect(13, 26 + hb, 14, 2, L[1]);
  p.round(12, 13 + hb, 16, 6, '#8a3a3a', 2);
  p.rect(13, 14 + hb, 14, 1, '#b25a4a');
  p.round(14, 38 + hb, 8, 5, '#424656', 2);
  cuteLeg(p, 29, 29 - s, P.lb, [T[0], T[1], T[2]], [L[0], L[1], L[2]], 52);
  cuteLeg(p, 34, 34 + s, P.lf, [T[1], T[2], T[3]], [L[1], L[2], L[3]], 52);
  // tunic, belt and a fat coin purse
  p.poly([[27, 24 + b], [39, 24 + b], [41, 34 + b], [42, 44 + b], [26, 44 + b], [26, 34 + b]], T[2]);
  p.rect(27, 25 + b, 3, 18, T[3]);
  p.rect(38, 27 + b, 2, 16, T[1]);
  p.rect(26, 36 + b, 16, 2, L[1]);
  p.round(37, 37 + b, 5, 6, G[1], 2);
  p.px(38, 38 + b, G[3]);
  p.line(28, 24 + b, 30, 36 + b, L[1]);           // pack strap
  // cloak over the shoulders
  p.poly([[25, 23 + b], [41, 23 + b], [42, 28 + b], [37, 30 + b], [32, 27 + b], [27, 30 + b], [24, 28 + b]], C[2]);
  p.rect(26, 23 + b, 14, 1, C[3]);
  // face, sandy hair, wide hat with a feather
  cuteFace(p, P, NPC_EYES.brown, { male: true });
  p.rect(27, 12 + b, 2, 8, Hr[2]);
  p.rect(38, 13 + b, 3, 2, Hr[2]);
  p.poly([[23, 12 + b], [46, 12 + b], [44, 10 + b], [40, 9 + b], [29, 9 + b], [25, 10 + b]], C[1]);
  p.round(28, 2 + b, 13, 9, C[2], 3);
  p.rect(29, 3 + b, 4, 2, C[3]);
  p.rect(28, 8 + b, 13, 2, '#8a3a3a');
  p.line(30, 7 + b, 23 + P.hs, 0 + b, '#e0d090');
  p.px(23 + P.hs, 0 + b, '#fff4c0');
  // arm forward, palm open
  p.poly([[36, 25 + b], [40, 25 + b], [43, 31 + b], [41, 34 + b], [37, 30 + b]], C[2]);
  p.round(41, 31 + b, 4, 4, Sk[2], 1);
}

/** The dark trader: a hooded figure with glowing violet eyes, a gold-trimmed stole and a lantern on a chain. */
function drawDarkTrader(p, P) {
  const R = ['#100a18', '#1e1430', '#2e2048', '#443266', '#5e4a88'];
  const glow = '#c48aff';
  drawRobedCute(p, P, R, (pp, y) => {
    if (P.eyes === 'blink') {
      pp.rect(32, 17 + y, 3, 1, glow);
      pp.rect(37, 17 + y, 3, 1, glow);
      return;
    }
    pp.round(32, 15 + y, 3, 4, glow, 1);
    pp.round(37, 15 + y, 3, 4, glow, 1);
    pp.px(32, 15 + y, '#ffffff');
    pp.px(37, 15 + y, '#ffffff');
  }, { hand: '#cfc7e8' });
  const b = P.b;
  p.line(36, 25 + b, 38 + Math.round(P.s / 2), 54, '#a07a24');   // gold-trimmed stole
  // a lantern swinging on its chain below the hand
  const sw = P.sw;
  p.line(42, 37 + b, 43 + sw, 41 + b, '#646a7c');
  p.round(40 + sw, 41 + b, 7, 8, '#2a2034', 1);
  p.rect(41 + sw, 43 + b, 5, 4, '#9a5aff');
  p.px(42 + sw, 44 + b, '#e8d0ff');
}

/** Ranch hand who looks after the mounts: cowboy hat, open vest, red bandana, coiled rope on the hip. */
function drawMountTrader(p, P) {
  const { b, s } = P;
  const J = ['#1e2a44', '#2c3c5e', '#3e527a', '#56709a'];
  const Sh = ['#6a5a3a', '#9a8656', '#c4b07a', '#e4d4a0'];
  const V = ['#3a2416', '#5b3922', '#7d532f', '#9c6c3e'];
  const Hr = ['#24140c', '#4a2a18', '#70442a'];
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  cuteLeg(p, 29, 29 - s, P.lb, [J[0], J[1], J[2]], [L[0], L[1], L[2]], 51);
  cuteLeg(p, 34, 34 + s, P.lf, [J[1], J[2], J[3]], [L[1], L[2], L[3]], 51);
  p.round(25, 25 + b, 4, 10, Sh[1], 1);            // back arm
  // shirt with an open vest, belt with a big buckle
  p.round(27, 24 + b, 13, 14, Sh[2], 2);
  p.rect(28, 25 + b, 3, 12, Sh[3]);
  p.poly([[27, 24 + b], [32, 24 + b], [31, 38 + b], [27, 38 + b]], V[2]);
  p.poly([[36, 24 + b], [40, 24 + b], [40, 38 + b], [36, 38 + b]], V[1]);
  p.rect(27, 36 + b, 14, 2, L[1]);
  p.rect(32, 36 + b, 4, 2, '#bcc0cc');
  p.rect(27, 38 + b, 14, 5, J[2]);
  p.round(21, 34 + b, 6, 6, '#c4a46a', 2);          // coiled rope
  p.rect(23, 36 + b, 2, 2, '#7a6040');
  p.rect(29, 23 + b, 10, 2, '#b4302a');             // bandana
  // face and a wide cowboy hat
  cuteFace(p, P, NPC_EYES.green, { male: true });
  p.rect(27, 12 + b, 2, 8, Hr[2]);
  p.poly([[22, 13 + b], [47, 13 + b], [45, 10 + b], [41, 12 + b], [28, 12 + b], [24, 10 + b]], V[1]);
  p.round(28, 4 + b, 13, 9, V[2], 3);
  p.rect(30, 5 + b, 4, 2, V[3]);
  p.rect(28, 10 + b, 13, 2, V[0]);
  // arm forward
  p.round(37, 25 + b, 4, 8, Sh[2], 1);
  p.round(38, 32 + b, 4, 4, Sk[2], 1);
}

/** A cheerful young squire: a ginger mop, blue tunic with a gold crest, waving hello. */
function drawHelper(p, P) {
  const { b, s } = P;
  const wave = P.hs ? 1 : 0;
  const Tu = ['#1e2c4a', '#2c4270', '#3e5a96', '#5a7abc'];
  const Hr = ['#6a3a10', '#a86424', '#d08c3a', '#eeb862'];
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const S = RAMP.steel;
  cuteLeg(p, 29, 29 - s, P.lb, ['#3a3446', '#524a60', '#6a6278'], [L[0], L[1], L[2]], 51);
  cuteLeg(p, 34, 34 + s, P.lf, ['#524a60', '#6a6278', '#8a8296'], [L[1], L[2], L[3]], 51);
  p.round(25, 25 + b, 4, 10, Tu[1], 1);            // back arm
  // tunic with a crest, belt
  p.poly([[27, 24 + b], [39, 24 + b], [40, 32 + b], [41, 44 + b], [26, 44 + b], [26, 32 + b]], Tu[2]);
  p.rect(27, 25 + b, 3, 18, Tu[3]);
  p.rect(38, 27 + b, 2, 16, Tu[1]);
  p.rect(26, 36 + b, 15, 2, L[2]);
  p.rect(33, 36 + b, 2, 2, '#d4ac4c');
  p.rect(32, 28 + b, 3, 4, '#d4ac4c');
  p.round(25, 23 + b, 6, 5, S[3], 2);              // little pauldron
  // face (big bright eyes) and a ginger mop
  cuteFace(p, P, NPC_EYES.blue);
  npcHairCap(p, P, Hr);
  cuteBangs(p, P, Hr);
  p.line(32, 8 + b, 34, 4 + b, Hr[2]);
  p.line(35, 8 + b, 37, 5 + b, Hr[2]);
  // waving arm
  p.line(37, 26 + b, 43, 18 + b - wave, Tu[2], 3);
  p.round(42, 14 + b - wave, 4, 4, Sk[2], 1);
}

/**
 * The hired knight (helper room): bright steel over a blue tabard with a gold cross, an open helm
 * with a blue plume and a friendly face (sword and shield drawn by the hireling).
 */
function drawHiredKnight(p, P) {
  const { b, s, hb } = P;
  const S = RAMP.steel;
  const Bl = ['#16203e', '#2a4a8a', '#3e64b0', '#5a80c8', '#8ab8ff'];
  const G = RAMP.gold;
  const hem = Math.round(s / 2);
  cuteLeg(p, 29, 29 - s, P.lb, [S[1], S[2], S[3]], [S[0], S[1], S[2]], 52, null, 4);
  cuteLeg(p, 34, 34 + s, P.lf, [S[2], S[3], S[4]], [S[1], S[2], S[3]], 52, null, 4);
  p.round(24, 25 + b, 4, 10, S[2], 1);                       // back arm
  // breastplate, with a blue tabard and gold cross over it
  p.round(26, 23 + b, 15, 16, S[3], 3);
  p.rect(27, 24 + b, 3, 13, S[4]);
  p.poly([[29, 27 + b], [38, 27 + b], [39 + hem, 46 + b], [28 + hem, 46 + b]], Bl[2]);
  p.poly([[29, 27 + b], [31, 27 + b], [30 + hem, 46 + b], [28 + hem, 46 + b]], Bl[3]);
  p.rect(28 + hem, 45 + b, 12, 1, G[2]);
  p.rect(33, 29 + b, 2, 9, G[3]);
  p.rect(30, 32 + b, 8, 2, G[3]);
  p.rect(26, 38 + b, 15, 2, RAMP.leather[2]);
  p.round(24, 22 + b, 7, 6, S[4], 2);                        // pauldron
  p.rect(25, 22 + b, 4, 1, S[5]);
  // face in an open helm, a blue plume streaming back
  cuteFace(p, P, NPC_EYES.blue, { male: true });
  p.poly([[33, 7 + b], [30, 3 + b], [24, 3 + b], [19 + P.hs, 6 + hb], [16 + P.hs, 11 + hb], [21 + P.hs, 10 + hb], [26, 7 + b]], Bl[3]);
  p.line(29, 4 + b, 20 + P.hs, 7 + hb, Bl[4]);
  p.round(27, 7 + b, 15, 9, S[3], 4);
  p.rect(29, 8 + b, 6, 1, S[5]);
  p.rect(28, 13 + b, 13, 2, S[2]);
  p.rect(28, 13 + b, 13, 1, S[4]);
  p.rect(27, 14 + b, 2, 8, S[2]);
  p.rect(40, 14 + b, 2, 7, S[1]);
  p.rect(33, 13 + b, 2, 4, S[3]);                            // nose guard
  // sword arm forward
  p.round(37, 25 + b, 4, 8, S[3], 1);
  p.round(38, 32 + b, 4, 4, S[2], 1);
}

/** The hired archer: a green hood and short cape, a leather jerkin, a quiver of arrows on the back (bow drawn by the hireling). */
function drawHiredArcher(p, P) {
  const { b, s } = P;
  const Gr = ['#14301c', '#22502e', '#327440', '#4a9a58', '#78c884'];
  const L = RAMP.leather;
  const Hr = ['#3a2416', '#5b3922', '#7d532f', '#9c6c3e'];
  const hem = P.cf;
  cuteLeg(p, 29, 29 - s, P.lb, ['#3a3426', '#524a36', '#6a6046'], [L[0], L[1], L[2]], 50);
  cuteLeg(p, 34, 34 + s, P.lf, ['#524a36', '#6a6046', '#827858'], [L[1], L[2], L[3]], 50);
  // quiver on the back, arrows poking out
  p.rect(20, 18 + b, 5, 16, L[2]);
  p.rect(20, 18 + b, 5, 1, L[4]);
  for (const [x, c] of [[20, '#e84a4a'], [22, '#f0ead8'], [24, '#e84a4a']]) p.rect(x, 14 + b, 1, 4, c);
  p.round(25, 25 + b, 4, 10, Gr[1], 1);                       // back arm
  // short cape behind, jerkin, belt
  p.poly([[26, 23 + b], [32, 23 + b], [30, 36 + b], [22 + hem, 38 + b], [21 + hem, 33 + b]], Gr[1]);
  p.round(27, 24 + b, 13, 15, L[3], 3);
  p.rect(28, 25 + b, 3, 12, L[4]);
  p.rect(33, 25 + b, 1, 12, L[1]);
  p.rect(27, 36 + b, 14, 2, L[1]);
  p.rect(32, 36 + b, 3, 2, RAMP.gold[2]);
  p.rect(27, 38 + b, 14, 4, Gr[2]);
  // face with a fringe of brown hair, in a green hood
  cuteFace(p, P, NPC_EYES.green);
  cuteBangs(p, P, Hr);
  cuteHood(p, P, Gr);
  // bow arm forward
  p.round(37, 25 + b, 4, 8, L[3], 1);
  p.round(38, 32 + b, 4, 4, RAMP.skin[2], 1);
}

/** The hired priest: an old man in white and gold robes and a tall mitre, a white beard (crosier drawn by the hireling). */
function drawHiredPriest(p, P) {
  const { b, hb } = P;
  const W = ['#8a8494', '#c4bece', '#e8e4ee', '#ffffff'];
  const G = RAMP.gold;
  const hem = Math.round(P.s / 2) + P.cf;
  // robe to the floor
  p.poly([[27, 24 + b], [39, 24 + b], [42, 36 + b], [45 + hem, 57], [21 + hem, 57], [24, 36 + b]], W[2]);
  p.poly([[27, 24 + b], [30, 24 + b], [26 + hem, 57], [21 + hem, 57], [24, 36 + b]], W[3]);
  p.poly([[38, 30 + b], [42, 36 + b], [45 + hem, 57], [40 + hem, 57]], W[1]);
  p.rect(22 + hem, 55, 23, 1, G[2]);
  // a gold stole down the front with crosses
  p.poly([[32, 25 + b], [35, 25 + b], [36 + hem, 54], [33 + hem, 54]], G[2]);
  for (const y of [34, 46]) { p.rect(33 + Math.round(hem * (y - 25) / 30), y, 2, 4, '#ffffff'); p.rect(32 + Math.round(hem * (y - 25) / 30), y + 1, 4, 1, '#ffffff'); }
  p.poly([[26, 26 + b], [29, 26 + b], [28 + P.ba, 35 + b], [24 + P.ba, 35 + b]], W[1]);   // back sleeve
  // kindly old face, a big white beard, the mitre
  cuteFace(p, P, NPC_EYES.brown, { male: true, mask: true });
  p.round(29, 20 + b, 12, 8, W[3], 3);
  p.rect(30, 21 + b, 3, 6, W[2]);
  p.rect(34, 21 + b, 2, 1, CUTE.mouth);
  p.rect(30, 16 + b, 3, 1, W[2]);                            // bushy brows
  p.rect(35, 16 + b, 4, 1, W[2]);
  p.poly(shift([[28, 12], [30, 1], [34.5, -3], [39, 1], [41, 12]], hb), W[3]);
  p.poly(shift([[28, 12], [30, 1], [32, 0], [31, 12]], hb), W[2]);
  p.rect(28, 10 + hb, 14, 2, G[2]);
  p.rect(34, 1 + hb, 1, 9, G[2]);
  p.rect(32, 4 + hb, 5, 1, G[2]);
  // sleeve reaching forward to the crosier
  p.poly([[35, 25 + b], [40, 25 + b], [44, 31 + b], [44, 35 + b], [39, 35 + b], [37, 30 + b]], W[2]);
  p.rect(40, 34 + b, 4, 1, G[2]);
  p.round(40, 34 + b, 4, 4, RAMP.skin[2], 1);
}

/** The priest's acolyte: a young novice in a cream robe with a rope belt (staff drawn by the acolyte). */
function drawAcolyte(p, P) {
  const { b } = P;
  const C = ['#8a7a5a', '#b4a47e', '#d8ccaa', '#f0e8d0'];
  const Hr = ['#3a2416', '#6a4428', '#8a5e3a', '#aa7a4e'];
  const hem = Math.round(P.s / 2) + P.cf;
  p.poly([[27, 24 + b], [39, 24 + b], [41, 36 + b], [43 + hem, 57], [23 + hem, 57], [25, 36 + b]], C[2]);
  p.poly([[27, 24 + b], [30, 24 + b], [27 + hem, 57], [23 + hem, 57], [25, 36 + b]], C[3]);
  p.poly([[38, 30 + b], [41, 36 + b], [43 + hem, 57], [39 + hem, 57]], C[1]);
  p.rect(26, 35 + b, 15, 2, '#a07a4a');                      // rope belt
  p.line(30, 37 + b, 29 + hem, 44 + b, '#a07a4a');
  p.poly([[26, 26 + b], [29, 26 + b], [28 + P.ba, 35 + b], [24 + P.ba, 35 + b]], C[1]);
  cuteFace(p, P, NPC_EYES.teal);
  npcHairCap(p, P, Hr);
  cuteBangs(p, P, Hr);
  p.poly([[35, 25 + b], [40, 25 + b], [43, 31 + b], [41, 34 + b], [37, 30 + b]], C[2]);
  p.round(40, 31 + b, 4, 4, RAMP.skin[2], 1);
}

/** A dark minion (the Dark Minions upgrade): a little hooded shadow with horns and glowing violet eyes. */
function drawDarkMinion(p, P) {
  const R = ['#06040c', '#140c22', '#22163a', '#342456', '#4a3478'];
  const glow = '#c48aff';
  drawRobedCute(p, P, R, (pp, y) => {
    if (P.eyes === 'blink') {
      pp.rect(32, 17 + y, 3, 1, glow);
      pp.rect(37, 17 + y, 3, 1, glow);
      return;
    }
    pp.rect(32, 15 + y, 3, 3, glow);
    pp.rect(37, 15 + y, 3, 3, glow);
    pp.px(33, 15 + y, '#ffffff');
    pp.px(38, 15 + y, '#ffffff');
    pp.rect(33, 21 + y, 5, 1, '#6a3aa0');   // a little grin
  }, { hand: '#2e2048' });
  // two small horns through the hood
  const hb = P.hb;
  p.poly([[27, 9 + hb], [24, 2 + hb], [30, 7 + hb]], '#46286a');
  p.poly([[39, 8 + hb], [43, 1 + hb], [41, 9 + hb]], '#46286a');
  p.px(24, 2 + hb, '#9a72cc');
  p.px(43, 1 + hb, '#9a72cc');
}

function drawPony(p, pose) {
  const b = pose.bob;
  const B = ['#2a1810', '#4a2c1a', '#6e4428', '#92603a', '#b48058'];
  const M = ['#140c08', '#24160e', '#3a2618'];
  const s = pose.stride || 0;
  if (pose.lie) return drawPonyResting(p, B, M, b);
  // legs
  for (const [x, dx, c] of [[24, -s, B[1]], [30, s, B[2]], [50, s, B[1]], [56, -s, B[2]]]) {
    p.rect(x + dx, 44, 4, 12, c);
    p.rect(x + dx, 55, 5, 3, M[1]);
  }
  // body
  p.round(20, 30 + b, 42, 18, B[2], 6);
  p.round(22, 31 + b, 30, 6, B[3], 3);
  p.rect(24, 44 + b, 34, 2, B[1]);
  // tail
  p.poly(shift([[21, 33], [14, 36], [12, 46], [15, 50], [18, 42], [22, 38]], b), M[1]);
  p.line(16, 37 + b, 13, 46 + b, M[2]);
  // neck and head
  p.poly(shift([[52, 34], [58, 20], [64, 16], [70, 18], [72, 24], [68, 27], [62, 26], [60, 36]], b), B[2]);
  p.poly(shift([[58, 20], [64, 16], [66, 18], [60, 24]], b), B[3]);
  p.round(66, 20 + b, 9, 7, B[3], 2);
  p.px(73, 24 + b, M[0]);
  // a big glossy eye with long lashes
  p.round(64, 18 + b, 4, 4, '#0c0808', 1);
  p.px(64, 18 + b, '#ffffff');
  p.px(66, 20 + b, '#5a3a2a');
  p.line(64, 17 + b, 66, 16 + b, M[0]);
  p.rect(68, 22 + b, 2, 1, '#d87a74');   // blush
  p.poly(shift([[62, 16], [63, 11], [65, 15]], b), B[2]);   // ear
  // mane
  p.poly(shift([[52, 32], [56, 22], [62, 15], [63, 18], [59, 25], [56, 34]], b), M[1]);
  p.line(55, 26 + b, 60, 18 + b, M[2]);
  // saddle and blanket
  p.rect(32, 28 + b, 16, 8, '#8a2a24');
  p.rect(32, 28 + b, 16, 1, '#b2443a');
  p.round(34, 25 + b, 12, 6, RAMP.leather[2], 2);
  p.rect(35, 25 + b, 9, 1, RAMP.leather[4]);
  p.line(40, 31 + b, 40, 44 + b, RAMP.leather[1]);
}

/** The pony lying down to rest (its health ran out): legs folded under, head low, eyes shut. */
function drawPonyResting(p, B, M, b) {
  // folded legs peeking out under the belly
  for (const x of [24, 34, 50]) p.rect(x, 53, 7, 3, B[1]);
  p.rect(58, 54, 6, 3, M[1]);
  // body lying low
  p.round(18, 40 + b, 44, 15, B[2], 6);
  p.round(20, 41 + b, 30, 5, B[3], 3);
  // tail curled on the floor
  p.poly([[19, 46], [11, 50], [10, 56], [18, 55], [21, 50]], M[1]);
  // neck and head resting forward, low
  p.poly(shift([[52, 44], [60, 34], [66, 31], [72, 33], [73, 39], [68, 42], [60, 44]], b), B[2]);
  p.round(65, 33 + b, 9, 7, B[3], 2);
  p.line(64, 35 + b, 67, 35 + b, '#0c0808');   // closed eye
  p.rect(69, 37 + b, 2, 1, '#d87a74');
  p.poly(shift([[61, 31], [62, 26], [64, 30]], b), B[2]);   // ear
  p.poly(shift([[52, 42], [58, 33], [63, 29], [63, 32], [58, 37], [56, 44]], b), M[1]);   // mane
  // saddle still on
  p.rect(32, 38 + b, 16, 7, '#8a2a24');
  p.round(34, 35 + b, 12, 6, RAMP.leather[2], 2);
}

/** The helpers' gear: the hired knight's shield, the acolytes' staffs and the dark minions' daggers. */
function buildAllyWeapons() {
  const S = RAMP.steel;
  const G = RAMP.gold;
  const L = RAMP.leather;
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });
  Sprites.weapons.heaterShield = weapon(18, 24, 9, 11, (p) => {
    p.poly([[1, 1], [17, 1], [17, 11], [9, 23], [1, 11]], S[4]);
    p.poly([[3, 3], [15, 3], [15, 11], [9, 20], [3, 11]], '#3e64b0');
    p.poly([[9, 3], [15, 3], [15, 11], [9, 20]], '#2a4a8a');
    p.rect(8, 5, 2, 12, G[3]);
    p.rect(5, 8, 8, 2, G[3]);
    p.rect(1, 1, 16, 1, S[5]);
  });
  Sprites.weapons.acolyteStaff = weapon(34, 10, 6, 5, (p) => {
    p.rect(1, 4, 26, 2, L[3]);
    p.rect(1, 4, 26, 1, L[4]);
    p.rect(25, 3, 2, 4, G[2]);
    p.circle(30, 5, 3, '#fff2a0');
    p.circle(29.5, 4.5, 1.5, '#ffffff');
  });
  Sprites.weapons.darkDagger = weapon(18, 7, 3, 3, (p) => {
    p.rect(1, 2, 4, 3, '#2e2048');
    p.rect(5, 0, 2, 7, '#46286a');
    p.poly([[7, 1], [14, 1], [17, 3.5], [14, 6], [7, 6]], '#1e1430');
    p.rect(7, 1, 8, 1, '#b45aff');
    p.rect(8, 3, 6, 1, '#6a3aa0');
  });
}

/** The heroes' 8-frame idle (and walk) for an NPC, plus extra named animations: { name: [P overrides...] } on top of the first idle pose. */
function buildCuteNpc(draw, extra = {}) {
  const out = buildCuteEnemy(draw);
  for (const [name, list] of Object.entries(extra)) {
    out[name] = list.map((o) => {
      const P = { ...CUTE_POSES.idle[0], ...o };
      const img = PixelArt.make(64, 64, (p) => draw(p, P), OUTLINE, 0.5);
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  return out;
}

function buildNpcSprites() {
  Sprites.npcs = {
    shopkeeper: buildCuteNpc(drawShopkeeper),
    chef: buildCuteNpc(drawChef),
    librarian: buildCuteNpc(drawLibrarian, { read: [{ page: 0 }, { page: 1 }] }),
    enchanter: buildCuteNpc(drawEnchanter),
    // hammer raised, swinging, struck (held a beat with a little bounce)
    blacksmith: buildCuteNpc(drawBlacksmith, { work: [1, 2, 3, 3].map((swing, i) => ({ swing, b: i === 3 ? 1 : 0, hb: i === 3 ? 1 : 0 })) }),
    tinkerer: buildCuteNpc(drawTinkerer, { work: [{ work: 1 }, { work: 2 }] }),
    trader: buildCuteNpc(drawTrader),
    darkTrader: buildCuteNpc(drawDarkTrader),
    mountTrader: buildCuteNpc(drawMountTrader),
    helper: buildCuteNpc(drawHelper),
    // the helper room's hirelings, the priest's acolytes, and the Dark Minions upgrade's shadows
    hiredKnight: buildCuteNpc(drawHiredKnight),
    hiredArcher: buildCuteNpc(drawHiredArcher),
    hiredPriest: buildCuteNpc(drawHiredPriest),
    acolyte: buildCuteNpc(drawAcolyte),
    darkMinion: buildCuteNpc(drawDarkMinion),
  };
  // the pony (and every hero's horse): standing, walking (a four-beat stride) and lying down to rest
  const pony = (poses) => poses.map((pose) => {
    const img = PixelArt.make(80, 64, (p) => drawPony(p, pose), OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  });
  Sprites.npcs.pony = {
    idle: pony([{ bob: 0 }, { bob: 1 }]),
    walk: pony([{ bob: 0, stride: 3 }, { bob: 1, stride: 1 }, { bob: 0, stride: -3 }, { bob: 1, stride: -1 }]),
    rest: pony([{ bob: 0, lie: true }, { bob: 1, lie: true }]),
  };
  buildAllyWeapons();
}
