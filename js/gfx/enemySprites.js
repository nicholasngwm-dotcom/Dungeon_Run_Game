// Enemy sprites, drawn facing right in the same shaded style as the heroes
// (colour ramps darkest-first, light from the top-left). 64x64 unless noted.

const ENEMY_ANCHOR = { x: 32, y: 50 };
const KNIGHT_ANCHOR = { x: 40, y: 66 };   // 80x80 sprite
const SLIME_BIG = { size: 56, ax: 28, ay: 46 };
const SLIME_SMALL = { size: 32, ax: 16, ay: 26 };

function drawZombie(p, pose) {
  const b = pose.bob;
  const Z = ['#2e3a22', '#4a5e36', '#6a8250', '#8faa6c', '#b4cc90']; // rotting skin
  const T = ['#2a2018', '#463628', '#64503a', '#86704f'];            // torn shirt
  const P = ['#1c2030', '#2c3448', '#3e4a62', '#56647e'];            // trousers
  const eye = '#f2e85a';

  heroLegs(p, pose, 5,
    { leg: [P[0], P[1], P[2]], boot: [Z[0], Z[1], Z[2]] },
    { leg: [P[1], P[2], P[3]], boot: [Z[1], Z[2], Z[3]] }, 56);

  // back arm reaching forward
  p.poly(shift([[29, 23], [46, 24], [46, 28], [30, 28]], b), Z[1]);
  p.rect(46, 23 + b, 4, 5, Z[1]);
  p.px(50, 24 + b, Z[1]); p.px(50, 26 + b, Z[1]);

  // hunched torso in a torn shirt
  p.poly(shift([[25, 23], [37, 21], [39, 30], [37, 37], [26, 37], [24, 30]], b), T[2]);
  p.rect(26, 24 + b, 4, 7, T[3]);
  p.rect(35, 25 + b, 3, 10, T[1]);
  p.rect(28, 29 + b, 4, 4, Z[2]);              // hole showing ribs
  p.rect(28, 30 + b, 4, 1, Z[0]);
  p.rect(28, 32 + b, 4, 1, Z[0]);
  p.rect(34, 26 + b, 2, 3, '#6a1a1a');          // blood
  p.px(35, 29 + b, '#6a1a1a');
  p.rect(25, 35 + b, 13, 1, T[0]);              // rope belt
  for (let x = 26; x < 38; x += 3) p.px(x, 37 + b, T[2]); // ragged hem

  // head hanging forward
  p.rect(32, 21 + b, 4, 3, Z[1]);               // neck
  p.round(31, 12 + b, 10, 11, Z[2], 3);
  p.rect(32, 13 + b, 4, 2, Z[3]);
  p.px(33, 13 + b, Z[4]);
  p.rect(38, 17 + b, 3, 4, Z[1]);
  p.rect(36, 20 + b, 6, 3, Z[1]);               // slack jaw
  p.rect(37, 21 + b, 4, 1, '#2a0a0a');
  p.px(37, 20 + b, '#e8e0c8'); p.px(39, 20 + b, '#e8e0c8'); p.px(40, 22 + b, '#e8e0c8');
  p.rect(36, 15 + b, 3, 2, '#1a1408');          // sunken eyes
  p.px(37, 15 + b, eye);
  p.px(40, 16 + b, eye);
  p.px(41, 18 + b, Z[0]);
  p.px(32, 17 + b, Z[1]);
  p.line(32, 16 + b, 34, 19 + b, Z[0]);         // stitches
  p.px(32, 18 + b, Z[0]); p.px(34, 17 + b, Z[0]);
  for (const [x0, y0, x1, y1] of [[31, 12, 29, 16], [33, 11, 32, 15], [36, 11, 36, 13]]) {
    p.line(x0, y0 + b, x1, y1 + b, '#2a2a1e');  // stringy hair
  }

  // front arm reaching forward, torn sleeve
  p.poly(shift([[35, 24], [48, 25], [48, 29], [36, 29]], b), Z[2]);
  p.rect(36, 24 + b, 12, 1, Z[3]);
  p.poly(shift([[34, 23], [40, 24], [40, 29], [35, 29]], b), T[2]);
  p.px(40, 28 + b, T[1]);
  p.rect(48, 24 + b, 4, 6, Z[2]);
  p.px(52, 25 + b, Z[3]); p.px(52, 27 + b, Z[3]); p.px(52, 29 + b, Z[3]);
  p.px(48, 24 + b, Z[4]);
}

function drawSkeleton(p, pose) {
  const b = pose.bob;
  const B = ['#4a4438', '#8a8270', '#b5ad96', '#ebe5d3', '#fffaf0'];
  const dark = '#140c14';
  const eye = '#ff4a3a';
  const rust = ['#3a2418', '#6a4a3a', '#8a6a4a'];

  const legs = heroLegs(p, pose, 3,
    { leg: [B[0], B[1], B[2]], boot: [B[0], B[1], B[2]] },
    { leg: [B[1], B[2], B[3]], boot: [B[1], B[2], B[3]] }, 57, { backX: 28, frontX: 33 });
  for (const [xAt, c] of [[legs.xb, B[2]], [legs.xf, B[3]]]) p.round(xAt(47) - 1, 46, 5, 3, c, 1); // knees

  // back arm
  p.line(27, 23 + b, 25, 31 + b, B[1], 2);
  p.line(25, 31 + b, 28, 37 + b, B[1], 2);

  // pelvis + tattered loincloth
  p.round(26, 34 + b, 12, 4, B[2], 1);
  p.px(29, 35 + b, dark); p.px(35, 35 + b, dark);
  p.poly(shift([[28, 36], [37, 36], [36, 43], [33, 41], [29, 43]], b), '#5a2a2a');
  p.rect(28, 36 + b, 9, 1, '#7a3a34');

  // spine, collarbone, ribs
  p.rect(31, 22 + b, 2, 13, B[2]);
  for (let y = 23; y < 35; y += 2) p.px(32, y + b, B[1]);
  p.rect(26, 22 + b, 13, 1, B[3]);
  for (const y of [24, 26, 28, 30]) {
    p.rect(27, y + b, 11, 1, B[3]);
    p.px(27, y + b, B[1]);
    p.px(37, y + b, B[1]);
  }
  p.rect(33, 23 + b, 2, 8, B[4]);

  // skull with a rusty half-helm
  p.round(30, 10 + b, 10, 10, B[3], 3);
  p.rect(31, 11 + b, 3, 3, B[4]);
  p.rect(36, 15 + b, 4, 4, B[2]);
  p.rect(35, 14 + b, 3, 3, dark);
  p.px(36, 15 + b, eye);
  p.px(37, 15 + b, '#ff9a80');
  p.px(39, 17 + b, dark);
  p.rect(33, 19 + b, 6, 3, B[2]);
  p.rect(33, 19 + b, 6, 1, B[3]);
  p.px(34, 20 + b, dark); p.px(36, 20 + b, dark); p.px(38, 20 + b, dark);
  p.round(29, 7 + b, 12, 5, rust[1], 2);
  p.rect(31, 7 + b, 5, 1, rust[2]);
  p.rect(28, 11 + b, 14, 1, rust[0]);
  p.px(31, 9 + b, rust[2]); p.px(38, 9 + b, rust[0]);

  // bow arm
  p.line(37, 23 + b, 39, 30 + b, B[3], 2);
  p.line(39, 30 + b, 41, 35 + b, B[2], 2);
}

function drawWraith(p, pose) {
  const b = pose.bob;
  const w = pose.wave;
  const W = ['#120c22', '#241a40', '#3a2c62', '#564590', '#7c68bc'];
  const voidC = '#06030c';
  const eye = '#86f8ff';
  const claw = '#cfc7e8';

  // tattered tail
  for (let i = 0; i < 5; i++) {
    const x0 = 22 + i * 4;
    const len = 8 + ((i + w) % 3) * 3;
    p.poly([[x0, 44 + b], [x0 + 5, 44 + b], [x0 + 3 + (i % 2 ? 1 : -1), 44 + b + len]], i % 2 ? W[2] : W[1]);
  }

  // robe
  p.poly(shift([[22, 22], [42, 22], [44, 34], [42, 46], [22, 46], [20, 34]], b), W[2]);
  p.rect(20, 26 + b, 4, 20, W[1]);
  p.line(40, 24 + b, 42, 44 + b, W[3]);
  p.line(28, 30 + b, 26, 46 + b, W[1]);
  p.line(34, 30 + b, 35, 46 + b, W[1]);

  // hood with a void face
  p.poly(shift([[23, 11], [15, 5], [18, 14]], b), W[2]);
  p.round(21, 6 + b, 24, 22, W[2], 7);
  p.rect(25, 8 + b, 8, 2, W[3]);
  p.px(26, 8 + b, W[4]);
  p.rect(22, 14 + b, 3, 10, W[1]);
  p.round(31, 12 + b, 13, 12, voidC, 4);
  p.rect(30, 13 + b, 1, 10, W[1]);
  p.rect(35, 16 + b, 3, 2, eye);
  p.rect(40, 16 + b, 2, 2, eye);
  p.px(35, 16 + b, '#ffffff');
  p.px(40, 16 + b, '#ffffff');
  p.px(36, 19 + b, '#3a98a8'); p.px(41, 20 + b, '#3a98a8');

  // reaching sleeve and skeletal claws
  p.poly(shift([[37, 27], [48, 29], [48, 35], [38, 34]], b), W[3]);
  p.line(38, 27 + b, 47, 29 + b, W[4]);
  p.rect(47, 30 + b, 3, 5, claw);
  p.line(49, 30 + b, 54, 28 + b, claw);
  p.line(49, 32 + b, 55, 32 + b, claw);
  p.line(49, 34 + b, 54, 36 + b, claw);
}

function drawUndeadKnight(p, pose) {
  const b = pose.bob;
  const A = ['#14141c', '#24242f', '#373a48', '#4e5468', '#6c7488', '#9aa2b8'];
  const C = ['#1e0a18', '#3a1430', '#5a2a4a', '#7a3a62'];
  const H = ['#6a604e', '#a89e8a', '#ddd4c2'];
  const visor = '#ff3b30';
  const G = RAMP.gold;

  // tattered cape
  p.poly([[30, 32 + b], [40, 32 + b], [38, 55], [36, 75], [26, 77], [18, 75], [22, 55], [26, 40 + b]], C[2]);
  p.line(28, 36 + b, 22, 73, C[1]);
  p.line(33, 40 + b, 30, 75, C[1]);
  p.line(27, 34 + b, 20, 60, C[3]);
  for (let x = 19; x < 36; x += 4) p.rect(x, 75, 2, 2, C[1]);

  // armoured legs with spiked knees
  const legs = heroLegs(p, pose, 7,
    { leg: [A[0], A[1], A[2]], boot: [A[0], A[1], A[2]] },
    { leg: [A[1], A[3], A[4]], boot: [A[0], A[2], A[3]] }, 71,
    { backX: 33, frontX: 41, top: 51, floor: 76 });
  for (const [xAt, c] of [[legs.xb, A[2]], [legs.xf, A[4]]]) {
    const kx = xAt(63);
    p.round(kx - 1, 62, 9, 4, c, 1);
    p.poly([[kx + 7, 62], [kx + 11, 61], [kx + 7, 65]], A[5]);
  }

  // back pauldron with spike
  p.poly(shift([[24, 31], [19, 22], [28, 30]], b), A[3]);
  p.round(23, 30 + b, 10, 9, A[2], 3);
  p.rect(24, 31 + b, 6, 1, A[4]);

  // faulds
  p.poly(shift([[30, 48], [51, 48], [52, 57], [29, 57]], b), A[2]);
  p.rect(30, 50 + b, 21, 1, A[4]);
  p.rect(30, 53 + b, 22, 1, A[0]);
  p.rect(30, 54 + b, 22, 1, A[3]);

  // cuirass
  p.poly(shift([[28, 31], [52, 31], [53, 39], [50, 50], [31, 50], [28, 39]], b), A[3]);
  p.rect(30, 32 + b, 9, 8, A[4]);
  p.rect(31, 32 + b, 4, 2, A[5]);
  p.rect(48, 33 + b, 4, 13, A[2]);
  p.rect(32, 43 + b, 17, 5, A[2]);
  p.rect(43, 32 + b, 1, 15, A[5]);
  p.rect(44, 32 + b, 1, 15, A[1]);
  p.rect(36, 37 + b, 2, 4, visor);             // glowing chest rune
  p.px(36, 37 + b, '#ff9a80');
  p.rect(30, 47 + b, 21, 2, '#3a2814');
  p.rect(39, 47 + b, 4, 2, G[1]);
  p.px(40, 47 + b, G[2]);

  // horned great helm
  p.poly(shift([[34, 16], [27, 10], [22, 2], [26, 3], [31, 9], [37, 14]], b), H[0]);
  p.line(33, 14 + b, 25, 5 + b, H[1]);
  p.round(32, 12 + b, 18, 20, A[3], 5);
  p.rect(34, 14 + b, 4, 12, A[4]);
  p.rect(35, 13 + b, 4, 1, A[5]);
  p.rect(46, 15 + b, 3, 14, A[2]);
  p.rect(40, 12 + b, 2, 9, A[5]);              // crest ridge
  p.rect(39, 21 + b, 12, 2, '#0a0610');        // visor
  p.rect(42, 21 + b, 3, 1, visor);
  p.rect(47, 21 + b, 3, 1, visor);
  p.px(43, 22 + b, '#ff9a80');
  for (let y = 25; y < 30; y += 2) p.rect(43, y + b, 6, 1, A[1]);
  p.rect(32, 30 + b, 18, 2, A[1]);
  p.poly(shift([[47, 15], [53, 10], [57, 2], [59, 7], [55, 13], [50, 18]], b), H[1]);
  p.line(49, 15 + b, 56, 5 + b, H[2]);
  p.px(53, 11 + b, H[0]); p.px(55, 9 + b, H[0]);

  // front pauldron with spikes, gauntlet
  p.rect(53, 40 + b, 7, 10, A[2]);
  p.rect(53, 40 + b, 2, 10, A[4]);
  p.rect(53, 50 + b, 7, 5, A[1]);
  p.rect(54, 50 + b, 5, 1, A[3]);
  p.poly(shift([[51, 30], [54, 22], [57, 30]], b), A[4]);
  p.poly(shift([[56, 31], [60, 25], [61, 32]], b), A[3]);
  p.round(48, 29 + b, 14, 11, A[3], 4);
  p.rect(50, 30 + b, 6, 1, A[5]);
  p.rect(50, 31 + b, 3, 3, A[4]);
  p.rect(48, 36 + b, 14, 1, A[1]);
  p.rect(49, 37 + b, 12, 2, A[2]);
}

function drawSlime(p, size, rx, ry, small) {
  const G = ['#14401e', '#246a30', '#36974a', '#5fd068', '#9ce88e', '#e0ffd4'];
  const cx = Math.floor(size / 2);
  const bottom = small ? size - 6 : size - 10;
  const cy = bottom - ry;
  p.ellipse(cx, cy, rx, ry, G[1]);
  p.rect(cx - rx + 2, bottom - 2, rx * 2 - 3, 3, G[1]);
  p.ellipse(cx - 1, cy - 1, rx - 2, ry - 2, G[2]);
  p.ellipse(cx - 2, cy - 2, Math.max(2, rx - 5), Math.max(2, ry - 5), G[3]);
  p.ellipse(cx - Math.floor(rx / 2), cy - Math.floor(ry / 2), Math.max(1, Math.floor(rx / 4)), Math.max(1, Math.floor(ry / 5)), G[4]);
  p.px(cx - Math.floor(rx / 2) - 1, cy - Math.floor(ry / 2) - 1, G[5]);
  p.rect(cx - rx + 3, bottom - 1, rx * 2 - 5, 1, G[0]);
  // bubbles, and a swallowed bone in the big ones
  p.px(cx - 4, cy + 3, G[4]);
  if (!small) {
    p.rect(cx + 6, cy + 5, 2, 2, G[4]);
    p.line(cx - 8, cy + 6, cx - 3, cy + 8, '#c8d8b0');
    p.px(cx - 9, cy + 5, '#c8d8b0'); p.px(cx - 2, cy + 9, '#c8d8b0');
  }
  // eyes (face right)
  const es = small ? 2 : 3;
  const ey = cy - (small ? 1 : 2);
  p.rect(cx + 1, ey, es, es + 1, OUTLINE);
  p.rect(cx + es + (small ? 3 : 5), ey, es, es + 1, OUTLINE);
  p.px(cx + 1, ey, '#ffffff');
  p.px(cx + es + (small ? 3 : 5), ey, '#ffffff');
  p.rect(cx + 3, ey + es + 2, small ? 2 : 4, 1, G[0]);
}

function buildSlimeFrames(cfg, small) {
  const base = small ? { rx: 9, ry: 7 } : { rx: 20, ry: 15 };
  const shapes = {
    idle: [base, { rx: base.rx + 1, ry: base.ry - 1 }],
    squash: [{ rx: Math.round(base.rx * 1.2), ry: Math.round(base.ry * 0.7) }],
    stretch: [{ rx: Math.round(base.rx * 0.82), ry: Math.round(base.ry * 1.3) }],
  };
  const out = {};
  for (const [name, list] of Object.entries(shapes)) {
    out[name] = list.map((s) => {
      const img = PixelArt.make(cfg.size, cfg.size, (p) => drawSlime(p, cfg.size, s.rx, s.ry, small), OUTLINE, 0.5);
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  return out;
}

const GRAVE_SPRITE = { w: 48, h: 56, ax: 24, ay: 50 };

/** Mossy headstone on a dirt mound. cracked = badly damaged, ghost-light leaking out. */
function drawGravestone(p, cracked) {
  const S = ['#22202c', '#383646', '#545266', '#747288', '#9e9cb2'];
  const glow = ['#3a8a5a', '#8affb0'];
  // dirt mound
  p.ellipse(24, 49, 21, 5, '#2e2018');
  p.ellipse(24, 48, 19, 4, '#4a3426');
  p.rect(14, 47, 6, 1, '#6a4c36');
  // headstone
  p.round(11, 8, 26, 40, S[1], 9);
  p.round(12, 8, 24, 38, S[2], 9);
  p.round(15, 9, 14, 8, S[3], 4);
  p.rect(18, 9, 8, 1, S[4]);
  p.rect(12, 18, 3, 28, S[1]);
  p.dither(12, 38, 24, 8, S[1], 0);
  // engraved cross (dark cut with a lit lower lip)
  p.rect(22, 15, 4, 18, S[0]);
  p.rect(17, 20, 14, 4, S[0]);
  p.rect(22, 33, 4, 1, S[3]);
  p.rect(17, 24, 5, 1, S[3]);
  p.rect(26, 24, 5, 1, S[3]);
  // base slab
  p.rect(8, 43, 32, 6, S[1]);
  p.rect(8, 43, 32, 1, S[3]);
  p.rect(9, 48, 30, 1, S[0]);
  // moss
  p.rect(12, 14, 4, 3, '#4f6a2a');
  p.px(13, 13, '#6f8f3c');
  p.rect(30, 40, 6, 3, '#4f6a2a');
  p.rect(31, 39, 3, 1, '#6f8f3c');
  if (cracked) {
    for (const [pts, light] of [[[[28, 10], [24, 18], [27, 26], [23, 36]], true], [[[14, 30], [19, 36], [17, 42]], false]]) {
      for (let i = 0; i + 1 < pts.length; i++) {
        p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], S[0], 2);
        if (light) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], glow[1]);
      }
    }
    p.rect(32, 9, 3, 2, S[0]); // chipped corner
    p.px(25, 20, glow[0]);
  }
}

/** Sheet ghost facing right; pose.wave (0-3) ripples the hem. */
function drawGhost(p, pose) {
  const G = ['#2e4a66', '#5e88ac', '#a4d0ec', '#daf2ff', '#ffffff'];
  const w = pose.wave;
  const face = '#1a1030';
  // rippling hem
  for (let i = 0; i < 5; i++) {
    const x0 = 19 + i * 5;
    const len = (i + w) % 2 ? 7 : 3;
    p.poly([[x0, 42], [x0 + 6, 42], [x0 + 3, 42 + len]], i % 2 ? G[2] : G[1]);
  }
  // body + dome
  p.rect(19, 26, 26, 17, G[2]);
  p.ellipse(32, 25, 13, 13, G[1]);
  p.ellipse(32, 25, 12, 12, G[2]);
  p.rect(19, 26, 3, 17, G[1]);
  p.ellipse(28, 19, 6, 4, G[3]);
  p.rect(25, 17, 3, 1, G[4]);
  p.line(41, 28, 43, 41, G[3]);
  // little arm reaching forward
  p.poly([[42, 27], [51, 31], [42, 35]], G[2]);
  p.px(50, 31, G[3]);
  // hollow eyes and a moaning mouth
  p.rect(33, 21, 3, 5, face);
  p.rect(39, 21, 3, 5, face);
  p.px(33, 21, '#4a5a8a');
  p.ellipse(37, 31, 2, 3, face);
}

/**
 * Mimic: a treasure chest with a toothy mouth and a lolling tongue, facing right.
 * pose.gap = how far the lid is open; pose.lift raises the whole chest (hops);
 * pose.wag moves the tongue tip.
 */
function drawMimic(p, pose) {
  const W = ['#2e1a0c', '#4e2e14', '#744420', '#9a6030', '#c08448'];
  const G = ['#5a3e0e', '#a87a22', '#e8b83a', '#fff0a0'];
  const mouth = '#3a0a14';
  const tooth = '#f4ead7';
  const T = ['#a02848', '#e0507a', '#ff8aa8'];
  const gap = pose.gap;
  const up = pose.lift || 0;
  const base = 50 - up;           // bottom of the chest
  const top = base - 14;          // top rim of the box
  const lidBottom = top - gap;

  // box
  p.rect(13, top, 38, 14, W[2]);
  p.rect(13, top, 38, 2, W[3]);
  p.rect(13, top, 4, 14, W[1]);
  for (const y of [top + 5, top + 10]) p.rect(17, y, 34, 1, W[1]);
  p.rect(13, base - 2, 38, 2, W[0]);
  for (const x of [19, 43]) {       // gold bands
    p.rect(x, top, 3, 14, G[1]);
    p.rect(x, top, 1, 14, G[2]);
  }
  p.rect(13, top, 38, 1, G[2]);     // rim
  // mouth interior + lower teeth
  if (gap > 0) {
    p.rect(15, lidBottom, 34, gap + 1, mouth);
    p.rect(15, lidBottom + gap - 2, 34, 2, '#5a1424');
    for (let x = 16; x < 48; x += 4) p.poly([[x, top + 1], [x + 3, top + 1], [x + 1.5, top - Math.min(4, gap - 1)]], tooth);
  }
  // tongue lolling out of the front
  const wag = pose.wag || 0;
  p.round(30, top - 2, 20, 4, T[0], 1);
  p.rect(31, top - 2, 18, 2, T[1]);
  p.round(47, top - 2, 7, 8 + wag, T[1], 2);
  p.rect(48, top - 1, 2, 5 + wag, T[2]);
  p.px(50, top + 4 + wag, T[0]);
  // lid
  p.round(12, lidBottom - 12, 40, 12, W[2], 4);
  p.round(13, lidBottom - 12, 36, 5, W[3], 3);
  p.rect(16, lidBottom - 11, 20, 1, W[4]);
  p.rect(12, lidBottom - 2, 40, 2, G[1]);
  p.rect(12, lidBottom - 2, 40, 1, G[2]);
  for (const x of [19, 43]) p.rect(x, lidBottom - 12, 3, 10, G[1]);
  // upper teeth
  if (gap > 0) for (let x = 18; x < 50; x += 4) p.poly([[x, lidBottom], [x + 3, lidBottom], [x + 1.5, lidBottom + Math.min(4, gap - 1)]], tooth);
  // angry eyes on the lid and a lock plate
  p.poly([[33, lidBottom - 9], [39, lidBottom - 7], [39, lidBottom - 5], [33, lidBottom - 6]], '#ffd34a');
  p.poly([[42, lidBottom - 7], [48, lidBottom - 9], [48, lidBottom - 6], [42, lidBottom - 5]], '#ffd34a');
  p.px(37, lidBottom - 6, '#7a1a10');
  p.px(44, lidBottom - 6, '#7a1a10');
  p.rect(28, top + 3, 6, 6, G[1]);
  p.rect(29, top + 4, 4, 4, G[2]);
  p.rect(30, top + 6, 2, 2, G[0]);
}

function buildEnemySprites() {
  const wraithPoses = { idle: [0, 1, 2, 3].map((w) => ({ bob: w % 2 ? -1 : 1, wave: w })) };
  Sprites.enemies = {
    zombie: buildPoseFrames(drawZombie, 64, HERO_POSES, 0.5),
    skeleton: buildPoseFrames(drawSkeleton, 64, HERO_POSES, 0.5),
    wraith: buildPoseFrames(drawWraith, 64, wraithPoses, 0.5),
    undeadKnight: buildPoseFrames(drawUndeadKnight, 80, HERO_POSES, 0.5),
    slime: buildSlimeFrames(SLIME_BIG, false),
    slimeSmall: buildSlimeFrames(SLIME_SMALL, true),
    ghost: buildPoseFrames(drawGhost, 64, wraithPoses, 0.5),
    mimic: buildPoseFrames(drawMimic, 64, {
      idle: [{ gap: 4, wag: 0 }, { gap: 5, wag: 2 }],
      crouch: [{ gap: 2, wag: 1 }],
      hop: [{ gap: 7, wag: 3, lift: 2 }],
      bite: [{ gap: 13, wag: 4 }],
    }, 0.5),
    gravestone: {
      idle: [false, true].map((cracked) => {
        const img = PixelArt.make(GRAVE_SPRITE.w, GRAVE_SPRITE.h, (p) => drawGravestone(p, cracked), OUTLINE, 0.5);
        return { img, flash: PixelArt.silhouette(img) };
      }),
    },
  };
}
