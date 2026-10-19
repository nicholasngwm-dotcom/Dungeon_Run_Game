// Friendly dungeon NPCs: Mira the shopkeeper, the restaurant's chef, and the
// special-room keepers (the blacksmith with his hammering animation, the
// traders, the ranch hand and the helper). 64x64, facing right, same anchor
// and style as the heroes. Plus the mount trader's pony (80x64).

function drawShopkeeper(p, pose) {
  const b = pose.bob;
  const Hr = ['#5a1a10', '#8a2a18', '#b8442a', '#e06a40'];      // red hair
  const D = ['#1e3a2a', '#2e5a3e', '#3e7a52', '#5a9a6a'];        // green dress
  const A = ['#a89878', '#cdbd9a', '#e8dcc0', '#fff6e0'];        // apron
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  // long hair down the back
  p.poly(shift([[26, 12], [32, 11], [31, 32], [25, 36], [22, 30], [24, 18]], b), Hr[1]);
  p.line(25, 16 + b, 23, 32 + b, Hr[2]);
  // dress to the floor
  p.poly(shift([[26, 21], [38, 21], [40, 33]], b).concat([[43, 57], [22, 57]], shift([[24, 33]], b)), D[2]);
  p.poly(shift([[26, 21], [29, 21]], b).concat([[26, 57], [22, 57]], shift([[24, 33]], b)), D[3]);
  p.rect(22, 56, 21, 1, D[0]);
  // apron
  p.poly(shift([[29, 27], [37, 27], [38, 33]], b).concat([[39, 53], [28, 53]], shift([[28, 33]], b)), A[2]);
  p.rect(28, 52, 12, 1, A[0]);
  p.rect(30, 38 + b, 6, 4, A[1]);                                  // pocket
  p.rect(26, 31 + b, 13, 2, A[1]);                                 // apron tie
  // shawl
  p.poly(shift([[24, 20], [40, 20], [41, 25], [33, 27], [24, 25]], b), '#7a3a5a');
  p.rect(25, 20 + b, 14, 1, '#9a5a7a');
  // head
  heroFace(p, b, Sk, '#3e7a52', { mouth: '#b85a5a' });
  p.rect(31, 10 + b, 9, 3, Hr[2]);                                 // fringe
  p.rect(30, 10 + b, 2, 9, Hr[2]);
  p.px(37, 12 + b, Hr[1]);
  p.rect(30, 9 + b, 9, 1, Hr[3]);
  // gold earring and a coin necklace
  p.px(31, 18 + b, G[3]);
  p.rect(34, 22 + b, 2, 2, G[2]);
  // arm resting forward
  p.poly(shift([[36, 23], [40, 23], [43, 30], [41, 33], [37, 29]], b), D[2]);
  p.rect(41, 30 + b, 3, 3, Sk[2]);
}

function drawChef(p, pose) {
  const b = pose.bob;
  const W = ['#a8a2b4', '#d4cfdc', '#f0edf4', '#ffffff'];
  const Sk = RAMP.skin;
  const L = RAMP.leather;
  heroLegs(p, pose, 5,
    { leg: ['#2c2c3a', '#3e3e52', '#56566e'], boot: [L[0], L[1], L[2]] },
    { leg: ['#3e3e52', '#56566e', '#6a6a84'], boot: [L[1], L[2], L[3]] }, 54);
  // round white jacket
  p.poly(shift([[24, 21], [39, 21], [42, 30], [40, 39], [24, 39], [22, 30]], b), W[2]);
  p.rect(23, 23 + b, 4, 15, W[3]);
  p.rect(37, 24 + b, 3, 14, W[1]);
  for (const y of [25, 29, 33]) { p.px(34, y + b, '#585d6c'); p.px(36, y + b, '#585d6c'); }
  p.rect(25, 36 + b, 15, 3, '#c0302a');                            // red sash
  // face with a big moustache
  heroFace(p, b, Sk, '#3a2a1a');
  p.rect(34, 18 + b, 7, 2, '#5a3a1a');
  p.px(41, 19 + b, '#5a3a1a');
  // tall chef hat
  p.rect(29, 9 + b, 11, 3, W[1]);
  p.round(28, 1 + b, 13, 9, W[2], 3);
  p.round(29, 1 + b, 6, 6, W[3], 2);
  // arm holding a ladle
  p.rect(37, 24 + b, 4, 8, W[2]);
  p.rect(39, 32 + b, 3, 3, Sk[2]);
  p.line(41, 34 + b, 47, 22 + b, '#80869a');
  p.round(45, 19 + b, 5, 4, '#adb2c0', 1);
}

/**
 * The blacksmith: broad, bearded, in a leather apron, swinging a hammer at the
 * anvil in front of him. pose.swing: 0 = resting, 1 = raised overhead,
 * 2 = swinging forward, 3 = struck down on the anvil.
 */
function drawBlacksmith(p, pose) {
  const b = pose.bob;
  const swing = pose.swing || 0;
  const Sh = ['#2a2420', '#463c34', '#625448', '#80705e'];    // grey shirt
  const Hr = ['#140c0a', '#2a1a14', '#40281e', '#5a3a2a'];    // dark hair and beard
  const Sk = ['#5a2e24', '#a0604a', '#cc8c6e', '#e8b498'];    // ruddy skin
  const L = RAMP.leather;
  const S = RAMP.steel;
  const W = RAMP.leather;

  heroLegs(p, pose, 6,
    { leg: [Sh[0], Sh[1], Sh[2]], boot: [L[0], L[1], L[2]] },
    { leg: [Sh[1], Sh[2], Sh[3]], boot: [L[1], L[2], L[3]] }, 52, { backX: 26, frontX: 32 });
  // back arm, bare and thick
  p.rect(22, 23 + b, 5, 12, Sk[1]);
  p.rect(22, 35 + b, 5, 3, Sk[1]);
  // broad chest in a grey shirt
  p.poly(shift([[23, 20], [39, 20], [42, 29], [40, 38], [24, 38], [22, 29]], b), Sh[2]);
  p.rect(24, 22 + b, 4, 14, Sh[3]);
  // big leather apron down the front
  p.poly(shift([[30, 22], [39, 22], [41, 31]], b).concat([[43, 51], [29, 51]], shift([[29, 31]], b)), L[2]);
  p.rect(31, 23 + b, 2, 10, L[3]);
  p.line(39, 30 + b, 42, 50, L[1]);
  p.rect(29, 50, 15, 1, L[0]);
  p.rect(33, 38 + b, 6, 5, L[1]);              // pocket with tongs
  p.line(35, 35 + b, 34, 38 + b, S[3]);
  p.line(37, 35 + b, 38, 38 + b, S[3]);
  p.line(31, 22 + b, 30, 19 + b, L[1]);        // neck strap
  // head: ruddy face, bushy beard, short hair, red headband, soot smudge
  heroFace(p, b, Sk, '#3a2a1a');
  p.rect(30, 9 + b, 9, 3, Hr[2]);
  p.rect(30, 9 + b, 3, 8, Hr[2]);
  p.px(31, 9 + b, Hr[3]);
  p.rect(30, 11 + b, 10, 2, '#8a2a24');
  p.rect(30, 11 + b, 10, 1, '#b2443a');
  p.poly(shift([[33, 16], [40, 17], [41, 21], [38, 25], [33, 24], [32, 20]], b), Hr[2]);
  p.rect(36, 18 + b, 4, 1, Sk[1]);             // mouth in the beard
  p.line(34, 22 + b, 38, 23 + b, Hr[3]);
  p.px(35, 15 + b, '#2a2224');

  // hammer arm
  const T = [W[1], W[2], W[3]];
  if (swing === 1) {
    p.line(37, 23 + b, 40, 13 + b, Sk[2], 4);
    p.round(39, 9 + b, 4, 4, Sk[2], 1);
    p.line(41, 9 + b, 44, 3 + b, T[1], 2);
    p.round(40, 0 + b, 9, 5, S[2], 1);
    p.rect(41, 0 + b, 7, 1, S[4]);
  } else if (swing === 2) {
    p.line(37, 23 + b, 44, 20 + b, Sk[2], 4);
    p.round(45, 18 + b, 4, 4, Sk[2], 1);
    p.line(48, 19 + b, 54, 15 + b, T[1], 2);
    p.round(52, 10 + b, 6, 9, S[2], 1);
    p.rect(53, 11 + b, 1, 7, S[4]);
  } else if (swing === 3) {
    p.line(37, 24 + b, 44, 31 + b, Sk[2], 4);
    p.round(45, 31 + b, 4, 4, Sk[2], 1);
    p.line(48, 33 + b, 54, 34 + b, T[1], 2);
    p.round(53, 31 + b, 9, 7, S[2], 1);
    p.rect(54, 32 + b, 7, 1, S[4]);
  } else {
    p.rect(37, 23 + b, 5, 11, Sk[2]);
    p.rect(37, 23 + b, 2, 11, Sk[3]);
    p.round(38, 34 + b, 4, 4, Sk[2], 1);
    p.line(41, 36 + b, 44, 44 + b, T[1], 2);
    p.round(41, 43 + b, 8, 5, S[2], 1);
    p.rect(42, 43 + b, 6, 1, S[4]);
  }
}

/**
 * The lobby workshop's tinkerer: messy hair, brass goggles, oil-stained
 * overalls. pose.work: 0 = idle, 1/2 = welding at the bench (torch held out,
 * goggles down; the two frames jiggle the torch).
 */
function drawTinkerer(p, pose) {
  const b = pose.bob;
  const work = pose.work || 0;
  const O = ['#1e2a3a', '#2c3e56', '#3e5676', '#567296'];     // blue overalls
  const Sh = ['#7a6a5a', '#a8988a', '#d0c4b8'];               // shirt
  const Hr = ['#5a2a10', '#8a4418', '#b8682a', '#d89048'];    // copper hair
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  heroLegs(p, pose, 5,
    { leg: [O[0], O[1], O[2]], boot: [L[0], L[1], L[2]] },
    { leg: [O[1], O[2], O[3]], boot: [L[1], L[2], L[3]] }, 52);
  p.rect(24, 23 + b, 4, 11, Sh[1]);              // back arm
  p.round(23, 33 + b, 5, 4, '#3a2a1a', 1);       // glove
  // shirt, then overalls with a bib, straps and a pocket of tools
  p.poly(shift([[26, 21], [38, 21], [39, 28], [38, 36], [27, 36], [25, 28]], b), Sh[1]);
  p.poly(shift([[27, 26], [38, 26], [39, 34], [40, 42], [25, 42], [26, 34]], b), O[2]);
  p.rect(27, 27 + b, 3, 14, O[3]);
  p.line(28, 21 + b, 28, 26 + b, O[1]);
  p.line(36, 21 + b, 36, 26 + b, O[1]);
  p.rect(31, 29 + b, 5, 5, O[1]);
  p.line(32, 26 + b, 32, 29 + b, '#e04545');     // screwdriver
  p.line(34, 25 + b, 34, 29 + b, IRON_TINT);     // wrench
  p.rect(26, 36 + b, 14, 2, L[2]);               // tool belt
  p.rect(36, 35 + b, 3, 5, L[1]);
  p.px(28, 31 + b, '#2a2018'); p.px(37, 39 + b, '#2a2018');   // oil stains
  // head: messy copper hair and goggles
  heroFace(p, b, Sk, '#2a6a8a', { mouth: '#b85a5a' });
  p.px(36, 17 + b, '#3a2a24');                   // smudge
  p.round(28, 7 + b, 12, 7, Hr[2], 2);
  p.rect(30, 8 + b, 6, 1, Hr[3]);
  p.rect(29, 12 + b, 3, 8, Hr[2]);
  p.line(30, 7 + b, 28, 4 + b, Hr[2]);
  p.line(34, 7 + b, 35, 4 + b, Hr[2]);
  p.line(38, 9 + b, 41, 8 + b, Hr[2]);
  // goggles: up on the forehead, or down over the eyes while welding
  const gy = work ? 14 : 10;
  p.rect(30, gy + b, 10, 2, '#3a2a1a');
  p.rect(34, gy - 1 + b, 5, 4, G[1]);
  p.rect(35, gy + b, 3, 2, work ? '#6ae0ff' : '#9ad0ff');
  p.px(35, gy + b, '#ffffff');
  // front arm: hanging, or holding a welding torch out over the bench
  if (work) {
    const j = work === 2 ? 1 : 0;
    p.line(37, 23 + b, 44, 28 + b, Sh[1], 4);
    p.round(44, 27 + b, 5, 4, '#3a2a1a', 1);     // glove
    p.line(48, 29 + b, 53, 31 + j + b, IRON_TINT, 2);
    p.rect(53, 30 + j + b, 2, 3, '#ffd34a');     // torch nozzle
  } else {
    p.rect(37, 23 + b, 4, 10, Sh[1]);
    p.rect(37, 23 + b, 2, 10, Sh[2]);
    p.round(37, 33 + b, 5, 4, '#3a2a1a', 1);
  }
}
const IRON_TINT = '#8e94a6';

/** Bram the enchanter (the shop's upgrade store): an old man in a starry blue robe, holding a glowing rune stone. */
function drawEnchanter(p, pose) {
  const b = pose.bob;
  const R = ['#16203e', '#22325e', '#334a86', '#4a66b0', '#6a88d0'];   // robe
  const W = ['#a8a4b4', '#d4d0dc', '#f0eef4'];                          // white beard
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  // robe to the floor
  p.poly(shift([[25, 20], [38, 20], [40, 34]], b).concat([[43, 57], [22, 57]], shift([[24, 34]], b)), R[2]);
  p.poly(shift([[25, 20], [28, 20]], b).concat([[26, 57], [22, 57]], shift([[24, 34]], b)), R[3]);
  p.poly(shift([[36, 28], [40, 34]], b).concat([[43, 57], [39, 57]]), R[1]);
  p.rect(22, 55, 21, 2, G[1]);                      // gold hem
  for (const [sx, sy] of [[28, 44], [34, 50], [31, 38], [37, 42]]) { p.px(sx, sy, G[3]); p.px(sx - 1, sy + 1, G[2]); }   // stars
  p.rect(24, 33 + b, 16, 2, G[1]);                  // sash
  p.rect(24, 33 + b, 16, 1, G[2]);
  // back arm in a wide sleeve
  p.poly(shift([[23, 22], [27, 22], [27, 33], [22, 34]], b), R[1]);
  // face with a long white beard
  heroFace(p, b, Sk, '#3a5ab0');
  p.poly(shift([[32, 16], [40, 17], [41, 22], [38, 32], [34, 34], [32, 26]], b), W[1]);
  p.line(36, 20 + b, 36, 31 + b, W[0]);
  p.line(34, 18 + b, 39, 18 + b, W[2]);
  p.rect(35, 13 + b, 4, 1, W[2]);                    // bushy eyebrow
  // tall pointed hat, bent back, with a moon
  p.poly(shift([[27, 12], [41, 12], [37, 6], [33, 1], [28, -1], [24, 1], [29, 4], [30, 8]], b), R[2]);
  p.poly(shift([[26, 13], [44, 13], [42, 11], [28, 11]], b), R[1]);
  p.line(28, 12 + b, 42, 12 + b, R[4]);
  p.rect(32, 6 + b, 2, 2, G[3]); p.px(34, 6 + b, R[2]);
  // front arm holding up a glowing rune stone
  p.poly(shift([[36, 21], [40, 21], [43, 28], [41, 31], [37, 27]], b), R[3]);
  p.round(41, 25 + b, 3, 3, Sk[2], 1);
  p.round(42, 19 + b, 6, 7, '#5a6a8a', 2);
  p.rect(44, 21 + b, 2, 3, '#9ae6ff');
  p.px(44, 21 + b, '#ffffff');
}

/** Travelling merchant with a huge pack on his back. */
function drawTrader(p, pose) {
  const b = pose.bob;
  const C = ['#1e3a24', '#2e5a34', '#447a48', '#62985e'];     // green cloak
  const T = ['#3a2a1a', '#5a4430', '#7a6048', '#9a7e62'];     // tunic
  const Hr = ['#3a2410', '#6a4220', '#946032', '#bc8848'];    // sandy hair
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  // big backpack with a rolled blanket and a pot
  p.round(14, 17 + b, 13, 22, L[2], 3);
  p.rect(15, 18 + b, 4, 19, L[3]);
  p.rect(14, 25 + b, 13, 2, L[1]);
  p.round(13, 12 + b, 15, 6, '#8a3a3a', 2);
  p.rect(14, 13 + b, 13, 1, '#b25a4a');
  p.round(15, 37 + b, 8, 5, '#424656', 2);
  heroLegs(p, pose, 5,
    { leg: [T[0], T[1], T[2]], boot: [L[0], L[1], L[2]] },
    { leg: [T[1], T[2], T[3]], boot: [L[1], L[2], L[3]] }, 52);
  // tunic, belt and coin purse
  p.poly(shift([[26, 21], [38, 21], [40, 30], [41, 42], [25, 42], [25, 30]], b), T[2]);
  p.rect(26, 22 + b, 3, 19, T[3]);
  p.rect(37, 24 + b, 2, 17, T[1]);
  p.rect(25, 33 + b, 15, 2, L[1]);
  p.round(36, 34 + b, 4, 5, G[1], 1);
  p.px(37, 35 + b, G[3]);
  // pack straps over the shoulder
  p.line(27, 21 + b, 29, 33 + b, L[1]);
  // cloak over the shoulders
  p.poly(shift([[24, 20], [40, 20], [41, 25], [36, 27], [31, 24], [26, 27], [23, 25]], b), C[2]);
  p.rect(25, 20 + b, 14, 1, C[3]);
  // head, hat with a feather
  heroFace(p, b, Sk, '#5a3418', { mouth: '#a8584e' });
  p.rect(30, 12 + b, 3, 8, Hr[2]);
  p.rect(31, 12 + b, 1, 8, Hr[3]);
  p.poly(shift([[24, 12], [44, 12], [42, 10], [38, 9], [29, 9], [26, 10]], b), C[1]);
  p.round(28, 3 + b, 12, 8, C[2], 3);
  p.rect(29, 4 + b, 4, 2, C[3]);
  p.rect(28, 8 + b, 12, 2, '#8a3a3a');
  p.line(30, 7 + b, 24, 1 + b, '#e0d090');
  p.px(24, 1 + b, '#fff4c0');
  // arm forward, open palm
  p.poly(shift([[36, 22], [40, 22], [43, 29], [41, 32], [37, 28]], b), C[2]);
  p.rect(41, 29 + b, 3, 3, Sk[2]);
}

/** The dark trader: a tall hooded figure with glowing eyes and a lantern. */
function drawDarkTrader(p, pose) {
  const b = pose.bob;
  const w = pose.stride || 0;
  const R = ['#100a18', '#1e1430', '#2e2048', '#443266', '#5e4a88'];
  const glow = '#c48aff';
  // robe to the floor, ragged hem
  p.poly([[24, 14 + b], [38, 14 + b], [42, 34], [44, 56], [21, 56], [22, 34]], R[2]);
  for (let x = 22; x < 44; x += 4) p.poly([[x, 55], [x + 4, 55], [x + 2, 58 + ((x + w) % 2)]], R[1]);
  p.rect(22, 20 + b, 4, 34, R[1]);
  p.line(38, 18 + b, 42, 54, R[3]);
  p.line(31, 30 + b, 30, 55, R[1]);
  p.line(35, 24 + b, 37, 50, '#a07a24');      // gold-trimmed stole
  // hood, deep and pointed, with a void face facing right
  p.poly(shift([[25, 10], [19, 5], [22, 13]], b), R[2]);
  p.round(23, 6 + b, 18, 20, R[2], 7);
  p.rect(26, 8 + b, 7, 2, R[3]);
  p.px(27, 8 + b, R[4]);
  p.round(32, 11 + b, 11, 12, '#06030c', 4);
  p.rect(35, 15 + b, 2, 1, glow); p.rect(39, 15 + b, 2, 1, glow);
  p.px(35, 15 + b, '#ffffff'); p.px(39, 15 + b, '#ffffff');
  // pale hand holding a lantern on a chain
  p.poly(shift([[36, 26], [42, 28], [42, 32], [37, 31]], b), R[3]);
  p.round(42, 29 + b, 3, 3, '#cfc7e8', 1);
  p.line(44, 32 + b, 45, 37 + b, '#646a7c');
  p.round(42, 37 + b, 6, 8, '#2a2034', 1);
  p.rect(43, 39 + b, 4, 4, '#9a5aff');
  p.px(44, 40 + b, '#e8d0ff');
}

/** Ranch hand who looks after the mounts: cowboy hat, vest, coiled rope. */
function drawMountTrader(p, pose) {
  const b = pose.bob;
  const J = ['#1e2a44', '#2c3c5e', '#3e527a', '#56709a'];     // jeans
  const Sh = ['#6a5a3a', '#9a8656', '#c4b07a', '#e4d4a0'];    // shirt
  const V = ['#3a2416', '#5b3922', '#7d532f', '#9c6c3e'];     // vest + hat
  const Hr = ['#24140c', '#4a2a18', '#70442a'];
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  heroLegs(p, pose, 5,
    { leg: [J[0], J[1], J[2]], boot: [L[0], L[1], L[2]] },
    { leg: [J[1], J[2], J[3]], boot: [L[1], L[2], L[3]] }, 51);
  p.rect(24, 23 + b, 4, 11, Sh[1]);            // back arm
  // shirt with an open vest, belt with a buckle
  p.poly(shift([[26, 21], [38, 21], [39, 27], [38, 36], [27, 36], [25, 27]], b), Sh[2]);
  p.rect(27, 22 + b, 3, 13, Sh[3]);
  p.poly(shift([[26, 21], [31, 21], [30, 36], [27, 36], [25, 27]], b), V[2]);
  p.poly(shift([[35, 21], [38, 21], [39, 27], [38, 36], [35, 36]], b), V[1]);
  p.rect(26, 34 + b, 13, 2, L[1]);
  p.rect(31, 34 + b, 3, 2, '#bcc0cc');
  // coiled rope on the hip
  p.round(21, 32 + b, 6, 6, '#c4a46a', 2);
  p.rect(23, 34 + b, 2, 2, '#7a6040');
  p.rect(30, 20 + b, 7, 2, '#b4302a');          // bandana
  // head and cowboy hat
  heroFace(p, b, Sk, '#2a6a3a');
  p.rect(30, 12 + b, 2, 7, Hr[2]);
  p.poly(shift([[22, 12], [46, 12], [44, 10], [40, 11], [27, 11], [24, 10]], b), V[1]);
  p.round(28, 4 + b, 12, 8, V[2], 3);
  p.rect(30, 5 + b, 4, 2, V[3]);
  p.rect(28, 9 + b, 12, 2, V[0]);
  // arm forward
  p.rect(37, 24 + b, 4, 7, Sh[2]);
  p.rect(38, 31 + b, 3, 3, Sk[2]);
}

/** A cheerful young squire who offers a hand, waving. */
function drawHelper(p, pose) {
  const b = pose.bob;
  const wave = (pose.stride || 0) > 0 || pose.bob > 0 ? 1 : 0;
  const Tu = ['#1e2c4a', '#2c4270', '#3e5a96', '#5a7abc'];    // blue tunic
  const Hr = ['#6a3a10', '#a86424', '#d08c3a', '#eeb862'];    // ginger
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const S = RAMP.steel;
  heroLegs(p, pose, 4,
    { leg: ['#3a3446', '#524a60', '#6a6278'], boot: [L[0], L[1], L[2]] },
    { leg: ['#524a60', '#6a6278', '#8a8296'], boot: [L[1], L[2], L[3]] }, 51);
  p.rect(24, 23 + b, 4, 11, Tu[1]);            // back arm
  // tunic with a crest, belt
  p.poly(shift([[26, 21], [38, 21], [39, 28], [40, 41], [25, 41], [25, 28]], b), Tu[2]);
  p.rect(26, 22 + b, 3, 18, Tu[3]);
  p.rect(37, 24 + b, 2, 16, Tu[1]);
  p.rect(25, 33 + b, 15, 2, L[2]);
  p.rect(33, 33 + b, 2, 2, '#d4ac4c');
  p.rect(32, 25 + b, 3, 4, '#d4ac4c');
  p.round(24, 20 + b, 6, 5, S[3], 2);          // little pauldron
  // head: ginger mop of hair
  heroFace(p, b, Sk, '#2a62a8', { bigEyes: true, mouth: '#c46a6a' });
  p.px(35, 18 + b, '#f0a0a0');
  p.round(28, 8 + b, 11, 6, Hr[2], 2);
  p.rect(30, 9 + b, 6, 1, Hr[3]);
  p.rect(29, 12 + b, 3, 7, Hr[2]);
  p.rect(33, 13 + b, 5, 1, Hr[2]);
  p.line(33, 8 + b, 35, 5 + b, Hr[2]);
  // waving arm
  p.line(37, 23 + b, 41, 15 + b - wave, Tu[2], 3);
  p.round(40, 12 + b - wave, 4, 4, Sk[2], 1);
}

/** A sturdy brown pony with a saddle, facing right (80x64, feet at y 58). */
function drawPony(p, pose) {
  const b = pose.bob;
  const B = ['#2a1810', '#4a2c1a', '#6e4428', '#92603a', '#b48058'];
  const M = ['#140c08', '#24160e', '#3a2618'];
  const s = pose.stride || 0;
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
  p.rect(65, 19 + b, 2, 2, '#0c0808');      // eye
  p.px(65, 19 + b, '#ffffff');
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

function buildNpcSprites() {
  const swing = { idle: [{ bob: 0, swing: 0 }, { bob: 1, swing: 0 }], work: [1, 2, 3, 3].map((sw, i) => ({ bob: i === 3 ? 1 : 0, swing: sw })) };
  Sprites.npcs = {
    shopkeeper: buildPoseFrames(drawShopkeeper, 64, HERO_POSES, 0.5),
    chef: buildPoseFrames(drawChef, 64, HERO_POSES, 0.5),
    enchanter: buildPoseFrames(drawEnchanter, 64, HERO_POSES, 0.5),
    blacksmith: buildPoseFrames(drawBlacksmith, 64, swing, 0.5),
    tinkerer: buildPoseFrames(drawTinkerer, 64, {
      idle: [{ bob: 0, work: 0 }, { bob: 1, work: 0 }],
      work: [{ bob: 0, work: 1 }, { bob: 0, work: 2 }],
    }, 0.5),
    trader: buildPoseFrames(drawTrader, 64, HERO_POSES, 0.5),
    darkTrader: buildPoseFrames(drawDarkTrader, 64, HERO_POSES, 0.5),
    mountTrader: buildPoseFrames(drawMountTrader, 64, HERO_POSES, 0.5),
    helper: buildPoseFrames(drawHelper, 64, HERO_POSES, 0.5),
    pony: {
      idle: [{ bob: 0 }, { bob: 1 }].map((pose) => {
        const img = PixelArt.make(80, 64, (p) => drawPony(p, pose), OUTLINE, 0.5);
        return { img, flash: PixelArt.silhouette(img) };
      }),
    },
  };
}
