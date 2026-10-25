// The Ancient Ruins' guardians: rocks and clay that the magic lingering in the air has
// woken to guard the old temple. Weathered grey-green stone and terracotta clay, moss and
// little flowers growing on them, and the magic itself showing as teal light in their
// eyes, their cracks and the glyphs carved into them. Lit from the top-left like the
// heroes; 64x64 (feet on row 58, anchor 32, 50) unless noted. The clay guard and the rock
// wizard are built on the heroes' cute body (js/gfx/heroes/cute.js); the rest keep their
// own shapes. Weapons that aim or swing are drawn by the enemy, not baked in.

const RU = {
  stone: ['#1c201c', '#2e342d', '#444c42', '#5c6558', '#7a8372', '#a0a892', '#c8cebb'],   // weathered stone, darkest first
  sand: ['#3a2e20', '#5a4a34', '#7a6648', '#9a845e', '#bca47a', '#dccaa0'],               // carved sandstone
  clay: ['#3a1c0c', '#5e3018', '#84461f', '#a95f30', '#c97b45', '#e3a066', '#f6c890'],    // terracotta
  moss: ['#16301a', '#24482a', '#386a36', '#549044', '#7cb85a', '#b0e080'],
  magic: ['#0a3634', '#127068', '#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'],              // the lingering magic
  flower: ['#e86a8a', '#ffd34a', '#c8a0ff', '#ffffff'],
};
const RUIN_MAGIC = '90, 240, 215';   // the magic's glow (rgb)

// ---------- shared parts ----------

/** A rounded rock lit from the top-left: dark rim, body, lit cap and a glint. R = ramp darkest first. */
function ruRock(p, cx, cy, rx, ry, R = RU.stone) {
  p.ellipse(cx, cy, rx, ry, R[1]);
  p.ellipse(cx - 1, cy - 1, rx - 1, ry - 1, R[2]);
  p.ellipse(cx - 2, cy - 2, Math.max(1, rx - 4), Math.max(1, ry - 4), R[3]);
  p.ellipse(cx - Math.round(rx * 0.35), cy - Math.round(ry * 0.4), Math.max(1, Math.round(rx * 0.35)), Math.max(1, Math.round(ry * 0.25)), R[4]);
  p.px(cx - Math.round(rx * 0.5), cy - Math.round(ry * 0.55), R[5]);
}

/** A tuft of moss with a lit top, sometimes a little flower in it. */
function ruMoss(p, x, y, w, flower = -1) {
  const M = RU.moss;
  for (let i = 0; i < w; i += 2) p.rect(x + i, y - (i % 3 === 1 ? 1 : 0), 2, 2 + (i % 3), M[2]);
  p.rect(x + 1, y - 1, Math.max(1, Math.floor(w / 2)), 1, M[4]);
  p.px(x, y + 2, M[1]);
  if (flower >= 0) { p.px(x + Math.floor(w / 2), y - 2, RU.flower[flower]); p.px(x + Math.floor(w / 2) + 1, y - 2, RU.flower[3]); }
}

/** A small carved glyph glowing with magic (a diamond round a dot). */
function ruGlyph(p, cx, cy, big = false) {
  const G = RU.magic;
  const r = big ? 3 : 2;
  p.line(cx - r, cy, cx, cy - r, G[2]);
  p.line(cx, cy - r, cx + r, cy, G[2]);
  p.line(cx + r, cy, cx, cy + r, G[2]);
  p.line(cx, cy + r, cx - r, cy, G[2]);
  p.px(cx, cy, G[4]);
  if (big) { p.px(cx - 1, cy - r, G[3]); p.px(cx, cy - r, G[4]); }
}

/** A crack in stone or clay with magic light leaking out. */
function ruCrack(p, pts, R = RU.stone, glow = true) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    p.line(x0, y0, x1, y1, R[0], 2);
    if (glow) p.line(x0, y0, x1, y1, RU.magic[2]);
    p.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, R[4]);
  }
}

/** Two little glowing eyes (a slit and a dot). */
function ruEyes(p, x, y, gap = 4, glow = RU.magic) {
  for (const ex of [x, x + gap]) {
    p.rect(ex, y, 2, 2, glow[3]);
    p.px(ex, y, glow[4]);
  }
}

// ---------- the guardians ----------

/** Rockmite: a little round rock golem with stubby legs, a mossy top and a pebble in its fist. P.throw = arm up. */
function drawRockmite(p, P) {
  const S = RU.stone;
  const b = P.bob || 0;
  const s = P.stride || 0;
  for (const [x, lift, c] of [[26 - s, P.liftB || 0, S[1]], [33 + s, P.liftF || 0, S[2]]]) {
    p.round(x, 49, 7, 10 - lift, c, 2);
    p.rect(x + 1, 50, 2, 5 - lift, S[3]);
    p.rect(x - 1, 57 - lift, 9, 2, S[1]);
  }
  // the back arm, then the body: one round boulder
  p.round(19, 40 + b, 6, 8, S[1], 2);
  ruRock(p, 31, 42 + b, 12, 10);
  ruCrack(p, [[24, 44 + b], [27, 49 + b]], S, false);
  ruMoss(p, 25, 32 + b, 10, 0);
  // a stern little face
  p.rect(33, 38 + b, 9, 4, S[1]);
  ruEyes(p, 34, 39 + b, 4);
  p.rect(35, 45 + b, 4, 1, S[0]);
  if (P.throw) {
    p.round(38, 24 + b, 6, 12, S[2], 2);
    p.rect(39, 25 + b, 2, 9, S[4]);
    ruRock(p, 41, 22 + b, 4, 4, RU.sand);
  } else {
    p.round(40, 41 + b, 6, 8, S[3], 2);
    ruRock(p, 44, 49 + b, 3, 3, RU.sand);
  }
}

/** Rock disc: a ring of carved stone round a core of magic, drawn flat (it hovers; the enemy floats and tilts it). 40x40. */
function drawRockDisc(p) {
  const S = RU.stone;
  const G = RU.magic;
  p.circle(20, 20, 17, S[1]);
  p.circle(19, 19, 15, S[3]);
  p.circle(18, 18, 12, S[4]);
  // the hole in the middle where the magic sits
  p.circle(20, 20, 8, S[0]);
  p.circle(20, 20, 6, G[1]);
  p.circle(20, 20, 4, G[3]);
  p.circle(19, 19, 2, G[4]);
  p.px(19, 18, G[5]);
  // notches round the rim and glyphs between them
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    p.px(Math.round(20 + Math.cos(a) * 15), Math.round(20 + Math.sin(a) * 15), S[0]);
    p.px(Math.round(20 + Math.cos(a) * 14), Math.round(20 + Math.sin(a) * 14), S[2]);
  }
  for (const a of [0.4, 2.5, 4.6]) p.px(Math.round(20 + Math.cos(a) * 11), Math.round(20 + Math.sin(a) * 11), G[3]);
  ruMoss(p, 8, 6, 8, 1);
  p.line(28, 30, 32, 26, S[0]);   // a chip out of the rim
}

/** Clay guard: a terracotta soldier, a clay helm with a moss crest, teal light in its eye slits. shield: still has it. */
function drawClayGuard(p, P, shield = true) {
  const C = RU.clay;
  const { b, hb } = P;
  const plate = [C[1], C[2], C[3], C[4], C[5], C[6]];
  if (!shield) ckBackArm(p, P, plate, C[3]);
  ckLegs(p, P, [C[1], C[2], C[3], C[4]], [C[0], C[1], C[2], C[3]], 54, 3);
  ckSkirt(p, P, [C[0], C[1], C[2], C[3]], 1, true);
  ckTorso(p, P, plate);
  // chest plates, a glyph pressed into the clay
  p.rect(29, 28 + b, 10, 1, C[2]);
  ruGlyph(p, 34, 31 + b);
  ckBelt(p, P, RU.sand, RU.sand);
  // the helm: a round clay dome, a cheek guard, and the face plate's two glowing slits
  p.round(27, 9 + hb, 15, 15, C[2], 5);
  p.round(28, 9 + hb, 13, 12, C[3], 5);
  p.round(29, 10 + hb, 6, 4, C[5], 2);
  p.px(30, 10 + hb, C[6]);
  p.rect(33, 16 + hb, 9, 6, C[1]);
  p.rect(34, 17 + hb, 2, 2, RU.magic[3]);
  p.rect(38, 17 + hb, 2, 2, RU.magic[3]);
  p.px(34, 17 + hb, RU.magic[5]);
  p.px(38, 17 + hb, RU.magic[5]);
  p.rect(27, 22 + hb, 15, 2, C[1]);
  // a crest of moss along the top, with a flower
  ruMoss(p, 28, 8 + hb, 12, 0);
  ruCrack(p, [[39, 11 + hb], [37, 15 + hb]], C);
  // a big round shield on its back arm, held out beside it so it shows: a bright sandstone rim,
  // a clay face with rivets round it, and a great glyph glowing in its boss
  if (shield) {
    const sx = 20;
    const sy = 34 + b;
    const D = RU.sand;
    const G = RU.magic;
    p.circle(sx, sy, 11, D[1]);
    p.circle(sx, sy, 10, D[4]);
    p.circle(sx - 1, sy - 1, 9, D[5]);
    p.circle(sx, sy, 8, C[2]);
    p.circle(sx - 1, sy - 1, 7, C[4]);
    p.circle(sx - 2, sy - 2, 3, C[5]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.px(Math.round(sx + Math.cos(a) * 9), Math.round(sy + Math.sin(a) * 9), D[0]);
    }
    p.line(sx - 5, sy, sx, sy - 5, G[2]);
    p.line(sx, sy - 5, sx + 5, sy, G[2]);
    p.line(sx + 5, sy, sx, sy + 5, G[2]);
    p.line(sx, sy + 5, sx - 5, sy, G[2]);
    p.rect(sx - 1, sy - 1, 3, 3, G[3]);
    p.px(sx, sy, G[5]);
    ruMoss(p, sx - 6, sy - 10, 6, 0);
  }
  ckFrontArm(p, P, plate, C[4]);
}

/** Clay slime: a dollop of wet clay with pebbles and moss in it, glowing eyes. size 44 (medium) or 28 (tiny). */
function drawClaySlime(p, size, rx, ry, tiny) {
  const C = RU.clay;
  const cx = Math.floor(size / 2);
  const bottom = size - (tiny ? 5 : 8);
  const cy = bottom - ry;
  p.ellipse(cx, cy, rx, ry, C[2]);
  p.rect(cx - rx + 2, bottom - 2, rx * 2 - 3, 3, C[2]);
  p.ellipse(cx - 1, cy - 1, rx - 2, ry - 2, C[3]);
  p.ellipse(cx - 2, cy - 2, Math.max(2, rx - 5), Math.max(2, ry - 5), C[4]);
  p.ellipse(cx - Math.floor(rx / 2), cy - Math.floor(ry / 2), Math.max(1, Math.floor(rx / 4)), Math.max(1, Math.floor(ry / 5)), C[5]);
  p.px(cx - Math.floor(rx / 2) - 1, cy - Math.floor(ry / 2) - 1, C[6]);
  p.rect(cx - rx + 3, bottom - 1, rx * 2 - 5, 1, C[1]);
  // drips down the side, a pebble and a moss tuft riding on top
  p.rect(cx + rx - 4, cy + 2, 2, ry - 1, C[2]);
  if (!tiny) {
    ruRock(p, cx - 6, cy + 4, 3, 2);
    ruMoss(p, cx - 3, cy - ry + 1, 6, 0);
  }
  const es = tiny ? 2 : 3;
  const ex = cx + 1;
  const ey = cy - (tiny ? 2 : 3);
  for (const x of [ex, ex + es + 2]) {
    p.rect(x, ey, es, es, RU.magic[3]);
    p.px(x, ey, RU.magic[5]);
  }
  p.rect(ex + 1, ey + es + 2, 4, 1, C[0]);
}

/** Clay bud golem: a little clay golem with a flower bud sprouting from its head. P.raised = both fists up to slam. */
function drawClayBud(p, P) {
  const C = RU.clay;
  const b = P.bob || 0;
  const s = P.stride || 0;
  for (const [x, lift, c] of [[25 - s, P.liftB || 0, C[1]], [33 + s, P.liftF || 0, C[2]]]) {
    p.round(x, 47, 8, 12 - lift, c, 2);
    p.rect(x + 1, 48, 2, 7 - lift, C[3]);
    p.rect(x, 57 - lift, 10, 2, C[1]);
  }
  const arm = (x, y, w, h, c) => { p.round(x, y + b, w, h, c, 2); p.rect(x + 1, y + 1 + b, 1, h - 3, C[4]); };
  if (!P.raised) arm(19, 34, 6, 12, C[1]);
  else arm(20, 16, 8, 17, C[1]);
  // a round clay body with a glyph glowing in its chest
  p.ellipse(32, 40 + b, 13, 11, C[1]);
  p.ellipse(31, 39 + b, 12, 10, C[2]);
  p.ellipse(30, 37 + b, 9, 7, C[3]);
  p.ellipse(28, 34 + b, 5, 3, C[4]);
  p.px(26, 33 + b, C[5]);
  ruGlyph(p, 34, 41 + b);
  ruCrack(p, [[24, 41 + b], [27, 46 + b]], C, false);
  // the head, and the bud: a green stalk with two leaves and a pink bud about to open
  p.round(28, 22 + b, 13, 11, C[2], 3);
  p.rect(29, 23 + b, 7, 2, C[4]);
  p.rect(33, 26 + b, 8, 3, C[0]);
  ruEyes(p, 34, 26 + b, 4);
  p.rect(32, 15 + b, 1, 7, RU.moss[2]);
  p.rect(28, 17 + b, 4, 2, RU.moss[3]);
  p.rect(33, 18 + b, 4, 2, RU.moss[4]);
  p.round(30, 10 + b, 6, 6, '#c84a6a', 2);
  p.rect(31, 11 + b, 2, 3, RU.flower[0]);
  p.px(31, 11 + b, '#ffd0dc');
  if (!P.raised) {
    p.round(18, 44 + b, 8, 7, C[2], 2);
    arm(40, 33, 6, 12, C[2]);
    p.round(39, 43 + b, 9, 8, C[3], 2);
    p.rect(40, 43 + b, 6, 1, C[5]);
  } else {
    p.round(16, 6 + b, 13, 11, C[2], 3);
    p.rect(18, 7 + b, 6, 1, C[4]);
    arm(36, 14, 8, 18, C[2]);
    p.round(35, 4 + b, 14, 12, C[3], 3);
    p.rect(37, 5 + b, 8, 1, C[5]);
  }
}

/**
 * Rock shell: a low shell crowned with a great fan of rock spikes, one glowing red eye set in the
 * middle of it. 72x64 (anchor 36, 50). P.step shuffles the little legs under it; P.raised = the spikes
 * flared up and the eye burning (calling the spikes up out of the ground).
 */
function drawRockShell(p, P) {
  const R = ['#24160c', '#4a2e18', '#6e4626', '#9a6838', '#c8925a', '#e8b880'];   // weathered red-brown rock
  const b = P.bob || 0;
  const flare = P.raised ? 6 : 0;
  // little legs shuffling under the rim
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const up = (P.step + i + (side > 0 ? 1 : 0)) % 2 ? 1 : 0;
      const x = 36 + side * (10 + i * 7);
      p.rect(x - 1, 52 - up, 3, 6, R[1]);
      p.rect(x - 2 + side, 57 - up, 4, 2, R[0]);
    }
  }
  // the fan of spikes, longest in the middle, each lit on its left edge and shaded on its right
  const n = 11;
  const cx = 36;
  const cy = 44 + b;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = -Math.PI + 0.16 + u * (Math.PI - 0.32);
    const mid = 1 - Math.abs(u - 0.5) * 2;
    const len = (i % 2 ? 17 : 22) + mid * 9 + flare;
    const w = i % 2 ? 4 : 5;
    const tx = cx + Math.cos(a) * len;
    const ty = cy + Math.sin(a) * len * 0.95;
    const nx = -Math.sin(a) * w;
    const ny = Math.cos(a) * w;
    const bx = cx + Math.cos(a) * 9;
    const by = cy + Math.sin(a) * 7;
    p.poly([[bx - nx, by - ny], [tx, ty], [bx + nx, by + ny]], R[2]);
    p.poly([[bx - nx, by - ny], [tx, ty], [bx, by]], R[4]);
    p.line(bx + nx * 0.6, by + ny * 0.6, tx, ty, R[1]);
    p.px(Math.round(tx), Math.round(ty), R[5]);
  }
  // the shell under the fan: a low dome, ridged
  p.ellipse(36, 50 + b, 25, 8, R[0]);
  p.ellipse(36, 49 + b, 24, 7, R[2]);
  p.ellipse(34, 47 + b, 19, 4, R[3]);
  p.ellipse(31, 46 + b, 9, 2, R[4]);
  for (const x of [18, 27, 45, 54]) p.line(x, 46 + b, x + (x < 36 ? -2 : 2), 54 + b, R[1]);
  ruMoss(p, 46, 44 + b, 7, 1);
  // the eye: a dark socket ringed with lighter stone, a red iris burning with an orange core
  p.ellipse(36, 44 + b, 9, 7, R[4]);
  p.ellipse(36, 44 + b, 8, 6, R[0]);
  p.ellipse(36, 44 + b, 6, 5, P.raised ? '#ff4a2a' : '#c8281e');
  p.ellipse(36, 44 + b, 3, 3, P.raised ? '#ffd060' : '#ff7a2a');
  p.rect(34, 42 + b, 2, 2, '#fff2d8');
  p.px(38, 46 + b, '#ffb060');
}

/**
 * Rock bowler: a stocky rock golem. P.lift = arms up, the boulder hoisted overhead; P.carry = both
 * shoulders turned forward to hug the boulder it carries about (the boulder and its hands are drawn by the enemy).
 */
function drawRockBowler(p, P) {
  const S = RU.stone;
  const b = P.bob || 0;
  const s = P.stride || 0;
  for (const [x, lift, c] of [[24 - s, P.liftB || 0, S[1]], [34 + s, P.liftF || 0, S[2]]]) {
    p.round(x, 46, 10, 13 - lift, c, 3);
    p.rect(x + 1, 47, 3, 8 - lift, S[3]);
    p.rect(x - 1, 56 - lift, 12, 3, S[1]);
  }
  if (!P.lift && !P.carry) p.round(14, 30 + b, 8, 16, S[1], 3);
  // a broad boulder body, mossy shoulders, a glyph and a crack of light
  ruRock(p, 32, 36 + b, 17, 15);
  ruMoss(p, 18, 23 + b, 10, 1);
  ruMoss(p, 36, 21 + b, 12);
  ruGlyph(p, 30, 40 + b, true);
  ruCrack(p, [[42, 30 + b], [46, 38 + b], [44, 44 + b]], S);
  // the face: a heavy brow over two glowing eyes
  p.rect(33, 27 + b, 13, 3, S[4]);
  p.rect(33, 30 + b, 13, 4, S[0]);
  ruEyes(p, 35, 31 + b, 6);
  if (P.lift) {
    for (const x of [15, 43]) { p.round(x, 14 + b, 8, 18, S[2], 3); p.rect(x + 1, 15 + b, 2, 14, S[4]); }
  } else if (P.carry) {
    // upper arms reaching forward and down round the boulder
    p.round(17, 30 + b, 9, 12, S[1], 3);
    p.round(41, 28 + b, 10, 13, S[3], 3);
    p.rect(42, 29 + b, 2, 9, S[5]);
  } else {
    p.round(44, 32 + b, 9, 16, S[3], 3);
    p.rect(45, 33 + b, 2, 12, S[5]);
  }
}

/** Rock wizard: a small hooded rock being with a long mossy beard and glowing eyes (its staff is drawn by the enemy). */
function drawRockWizard(p, P) {
  const S = RU.stone;
  const M = RU.moss;
  const { b, hb } = P;
  ckBackArm(p, P, [M[0], M[1], M[2], M[3]], S[3]);
  ckLegs(p, P, [S[1], S[2], S[3], S[4]], [S[0], S[1], S[2], S[3]], 54, 3);
  // a long robe of woven leaves
  ckSkirt(p, P, [M[0], M[1], M[2], M[3]], 6, false);
  for (let x = 27; x < 42; x += 3) p.px(x + Math.round(P.s / 2), 49 + b, M[4]);
  ckTorso(p, P, [M[0], M[1], M[2], M[3]]);
  // the head: a round stone, deep in a pointed hood of moss
  ruRock(p, 34, 17 + hb, 8, 8);
  p.rect(33, 16 + hb, 8, 4, S[0]);
  ruEyes(p, 34, 17 + hb, 4);
  p.poly([[25, 22 + hb], [28, 8 + hb], [33, 1 + hb], [36, 4 + hb], [42, 10 + hb], [43, 20 + hb], [40, 13 + hb], [30, 12 + hb], [28, 20 + hb]], M[2]);
  p.poly([[28, 8 + hb], [33, 1 + hb], [34, 5 + hb], [30, 10 + hb]], M[4]);
  p.px(33, 2 + hb, RU.flower[2]);
  // a long mossy beard, braided at the tip
  p.poly([[33, 21 + hb], [41, 21 + hb], [39, 32 + hb], [36, 36 + hb], [34, 30 + hb]], M[3]);
  p.line(36, 23 + hb, 37, 33 + hb, M[2]);
  p.px(36, 36 + hb, RU.flower[1]);
  ckFrontArm(p, P, [M[0], M[1], M[2], M[3]], S[3]);
}

/** Ruined turret: the stone base (its head turns at runtime, see buildRuinsSprites). 64x64, anchor 32, 54. */
function drawTurretBase(p) {
  const S = RU.sand;
  p.rect(14, 44, 36, 12, S[1]);
  p.rect(14, 44, 36, 2, S[3]);
  for (let x = 16; x < 48; x += 8) p.rect(x, 48, 6, 6, S[2]);
  p.rect(18, 26, 28, 20, S[2]);
  p.rect(18, 26, 4, 20, S[3]);
  p.rect(42, 26, 4, 20, S[1]);
  // the greek-key band carved round it
  for (let x = 20; x < 44; x += 6) {
    p.rect(x, 30, 5, 1, S[0]);
    p.rect(x + 4, 30, 1, 4, S[0]);
    p.rect(x + 1, 33, 4, 1, S[0]);
  }
  ruGlyph(p, 32, 39, true);
  ruMoss(p, 14, 43, 12, 0);
  ruMoss(p, 38, 25, 8);
  ruCrack(p, [[24, 36], [26, 42]], S, false);
  p.line(46, 30, 50, 44, RU.moss[2]);   // a vine hanging off it
  p.px(49, 40, RU.moss[4]);
}

/**
 * The turret's head, seen from above: a squat block of carved stone with a lens of magic on each
 * of its four faces (the four lasers fire out of them). It turns between a + and an X. 34x34, pivot 17, 17.
 */
function drawTurretHead(p) {
  const S = RU.stone;
  const G = RU.magic;
  // the four emitters jutting out of its faces: stone collars round a glowing lens
  for (const [x, y, w, h] of [[13, 0, 8, 6], [13, 28, 8, 6], [0, 13, 6, 8], [28, 13, 6, 8]]) {
    p.rect(x, y, w, h, S[2]);
    p.rect(x, y, w, 1, S[4]);
    p.rect(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, 3, 3, G[3]);
    p.px(x + Math.floor(w / 2) - 1, y + Math.floor(h / 2) - 1, G[5]);
  }
  // the block: bevelled, lit from the top-left, a carved ring and the glyph that powers it in the middle
  p.round(5, 5, 24, 24, S[1], 5);
  p.round(5, 5, 23, 23, S[3], 5);
  p.round(6, 6, 16, 16, S[4], 4);
  p.rect(9, 7, 8, 1, S[5]);
  p.circle(17, 17, 7, S[2]);
  p.circle(17, 17, 5, S[1]);
  p.line(13, 17, 17, 13, G[2]); p.line(17, 13, 21, 17, G[2]);
  p.line(21, 17, 17, 21, G[2]); p.line(17, 21, 13, 17, G[2]);
  p.rect(16, 16, 3, 3, G[4]);
  ruMoss(p, 7, 6, 6, 0);
  ruCrack(p, [[24, 22], [26, 26]], S, false);
}

/**
 * Stone pillar: three carved drums held together by the magic, a grimacing stone mask on the middle
 * one, a scrolled capital with its top broken off (moss and a sapling growing there), and two stone
 * fists floating beside it. Hops on little stone feet. 56x72, anchor 28, 60. P.squash: gathering itself to slam.
 */
function drawStonePillar(p, P) {
  const S = RU.sand;
  const G = RU.magic;
  const b = P.squash || 0;   // squashed down by b px as it gathers itself to slam
  /** One carved drum of the shaft: rounded, lit down its left side, shaded on its right, fluted. */
  const drum = (x, y, w, h, light) => {
    p.round(x, y, w, h, S[2], 2);
    p.rect(x + 1, y + 1, 4, h - 2, light ? S[4] : S[3]);
    p.rect(x + w - 5, y + 1, 4, h - 2, S[1]);
    for (let fx = x + 8; fx < x + w - 6; fx += 5) p.rect(fx, y + 2, 1, h - 4, S[1]);   // fluting
    p.rect(x + 2, y, w - 4, 1, S[4]);
    p.rect(x + 2, y + h - 1, w - 4, 1, S[0]);
  };
  // little stone feet, then the stepped base
  for (const x of [15, 33]) { p.round(x, 63, 9, 6, S[1], 2); p.rect(x + 1, 63, 4, 1, S[3]); }
  p.round(12, 58, 32, 6, S[1], 2);
  p.rect(13, 58, 30, 1, S[3]);
  p.round(15, 54, 26, 5, S[2], 1);
  p.rect(16, 54, 24, 1, S[4]);
  // three drums stacked a little off true, as if the magic is all that holds them together
  drum(17, 43 + b, 23, 11, false);
  drum(15, 30 + b, 26, 13, true);
  drum(16, 19 + b, 24, 11, false);
  // magic glowing in the gaps between the drums
  p.rect(19, 42 + b, 18, 1, G[2]);
  p.rect(18, 29 + b, 20, 1, G[2]);
  p.px(28, 29 + b, G[4]);
  // the mask carved on the middle drum: a heavy brow, deep-set glowing eyes, a grimace of stone teeth
  p.round(19, 31 + b, 18, 11, S[3], 3);
  p.rect(19, 31 + b, 18, 3, S[4]);
  p.line(19, 34 + b, 26, 36 + b, S[0], 2);
  p.line(30, 36 + b, 37, 34 + b, S[0], 2);
  p.rect(21, 36 + b, 4, 2, G[3]);
  p.rect(31, 36 + b, 4, 2, G[3]);
  p.px(21, 36 + b, G[5]);
  p.px(31, 36 + b, G[5]);
  p.rect(23, 39 + b, 10, 3, S[0]);
  for (let x = 24; x < 32; x += 2) p.px(x, 39 + b, S[4]);
  // the capital: wider, scrolled at each end, its top broken off
  p.round(10, 12 + b, 36, 8, S[3], 2);
  p.rect(11, 12 + b, 34, 2, S[4]);
  p.rect(11, 19 + b, 34, 1, S[0]);
  for (const vx of [13, 43]) {
    p.circle(vx, 16 + b, 3, S[2]);
    p.circle(vx, 16 + b, 1, S[0]);
    p.px(vx - 1, 14 + b, S[5]);
  }
  for (let x = 17; x < 41; x += 6) { p.rect(x, 16 + b, 4, 1, S[1]); p.rect(x + 3, 16 + b, 1, 2, S[1]); }   // a key band
  p.poly([[12, 12 + b], [15, 7 + b], [20, 10 + b], [24, 5 + b], [30, 9 + b], [35, 6 + b], [44, 12 + b]], S[3]);
  p.poly([[15, 7 + b], [20, 10 + b], [24, 5 + b], [24, 9 + b], [17, 12 + b]], S[4]);
  // moss and a sapling on the broken top, a vine trailing down one side
  ruMoss(p, 13, 9 + b, 12, 0);
  ruMoss(p, 32, 9 + b, 8, 2);
  p.rect(37, 2 + b, 1, 7, RAMP.leather[2]);
  p.rect(34, 1 + b, 3, 2, RU.moss[3]);
  p.rect(38, 2 + b, 3, 2, RU.moss[4]);
  for (let i = 0; i < 26; i++) {
    const vy = 20 + b + i;
    const vx = 40 + Math.round(Math.sin(i * 0.5) * 1.5);
    p.px(vx, vy, RU.moss[1]);
    if (i % 5 === 2) p.rect(vx + 1, vy, 2, 2, RU.moss[3]);
  }
  ruGlyph(p, 28, 48 + b, true);
  ruCrack(p, [[20, 46 + b], [22, 52 + b]], S);
  // two stone fists floating beside it on the magic, ready to slam
  const fy = (P.squash ? 22 : 30) + b;
  for (const [fx, flip] of [[3, false], [46, true]]) {
    p.round(fx, fy, 9, 10, S[2], 3);
    p.rect(fx + (flip ? 5 : 1), fy + 1, 3, 8, flip ? S[1] : S[4]);
    for (let k = 0; k < 3; k++) p.rect(fx + 2, fy + 3 + k * 2, 5, 1, S[1]);   // knuckles
    p.rect(fx + 2, fy + 10, 5, 1, G[2]);
    p.px(fx + 4, fy + 11, G[4]);
  }
}

/** Rock golem: a hulking golem of mossy boulders with a magic core. 80x80, anchor 40, 66. P.raised = fists up. */
function drawRockGolem(p, P) {
  const S = RU.stone;
  const b = P.bob || 0;
  const s = P.stride || 0;
  for (const [x, lift, c] of [[26 - s, P.liftB || 0, S[1]], [44 + s, P.liftF || 0, S[2]]]) {
    p.round(x, 58, 14, 16 - lift, c, 4);
    p.rect(x + 2, 59, 4, 10 - lift, S[3]);
    p.rect(x - 2, 71 - lift, 18, 4, S[1]);
    p.rect(x - 2, 71 - lift, 18, 1, S[3]);
  }
  if (!P.raised) { p.round(8, 36 + b, 14, 26, S[1], 5); p.round(4, 56 + b, 16, 12, S[2], 4); }
  // the body: a great mossy boulder, smaller rocks for shoulders
  ruRock(p, 40, 44 + b, 24, 20);
  ruRock(p, 20, 30 + b, 10, 9);
  ruRock(p, 60, 31 + b, 10, 9);
  ruMoss(p, 13, 21 + b, 12, 0);
  ruMoss(p, 30, 24 + b, 18, 2);
  ruMoss(p, 54, 22 + b, 12);
  // a magic core showing through a split in the chest
  p.ellipse(42, 48 + b, 7, 6, S[0]);
  p.ellipse(42, 48 + b, 5, 4, RU.magic[2]);
  p.ellipse(41, 47 + b, 2, 2, RU.magic[4]);
  ruCrack(p, [[30, 40 + b], [36, 46 + b]], S);
  ruCrack(p, [[52, 52 + b], [58, 58 + b]], S);
  // the head sunk between the shoulders
  ruRock(p, 42, 22 + b, 11, 9);
  p.rect(37, 21 + b, 15, 5, S[0]);
  ruEyes(p, 40, 22 + b, 6);
  if (P.raised) {
    for (const x of [6, 58]) { p.round(x, 2 + b, 16, 30, S[2], 5); p.rect(x + 2, 4 + b, 4, 24, S[4]); ruRock(p, x + 8, 6 + b, 9, 8); }
  } else {
    p.round(60, 38 + b, 14, 26, S[3], 5);
    p.rect(62, 40 + b, 3, 20, S[5]);
    ruRock(p, 66, 64 + b, 9, 7);
  }
}

/**
 * Ancient portal: an octagonal frame of carved sandstone lying in the floor round a pool of the magic
 * (its swirl is drawn live by the enemy; this is the still pool, for the frame). 60x44, anchor 30, 36.
 */
function drawAncientPortal(p) {
  const D = RU.sand;
  const G = RU.magic;
  const oct = (x0, y0, x1, y1, c) => {
    const cx = (x1 - x0) * 0.28;
    const cy = (y1 - y0) * 0.3;
    p.poly([[x0 + cx, y0], [x1 - cx, y0], [x1, y0 + cy], [x1, y1 - cy], [x1 - cx, y1], [x0 + cx, y1], [x0, y1 - cy], [x0, y0 + cy]], c);
  };
  // the frame: a thick bevelled octagon, lit along its top-left, shaded bottom-right, standing a little proud of the floor
  oct(1, 4, 59, 42, D[0]);
  oct(1, 2, 59, 39, D[2]);
  oct(2, 2, 57, 36, D[3]);
  oct(3, 2, 52, 31, D[4]);
  oct(7, 6, 53, 34, D[3]);
  // the inner rim, then the pool
  oct(8, 7, 52, 33, D[1]);
  oct(10, 9, 50, 31, D[0]);
  oct(11, 10, 49, 30, G[1]);
  oct(13, 11, 47, 28, G[2]);
  p.ellipse(30, 20, 11, 6, G[3]);
  p.ellipse(28, 18, 5, 2, G[4]);
  // a notch at each of the frame's eight corners, and a glyph carved at the top and bottom
  for (const [x, y] of [[17, 4], [43, 4], [56, 13], [56, 27], [43, 36], [17, 36], [4, 27], [4, 13]]) {
    p.rect(x - 1, y - 1, 3, 3, D[0]);
    p.px(x - 1, y - 1, D[5]);
  }
  for (const gx of [30]) {
    p.line(gx - 3, 4, gx, 2, G[2]); p.line(gx, 2, gx + 3, 4, G[2]); p.px(gx, 4, G[4]);
    p.line(gx - 3, 37, gx, 39, G[2]); p.line(gx, 39, gx + 3, 37, G[2]); p.px(gx, 37, G[4]);
  }
  ruMoss(p, 3, 36, 10, 0);
  ruMoss(p, 46, 3, 8, 2);
  ruCrack(p, [[50, 30], [55, 35]], D, false);
}

/** Magic pillar: a carved obelisk wrapped in glowing glyphs, a crystal on top. 40x84, anchor 20, 78. */
function drawMagicPillar(p) {
  const S = RU.stone;
  p.rect(6, 72, 28, 8, S[1]);
  p.rect(6, 72, 28, 2, S[3]);
  p.poly([[9, 72], [12, 18], [28, 18], [31, 72]], S[2]);
  p.poly([[9, 72], [12, 18], [15, 18], [13, 72]], S[4]);
  p.poly([[27, 72], [28, 18], [31, 72]], S[1]);
  for (let y = 26; y < 70; y += 11) ruGlyph(p, 20, y, true);
  // the crystal it was raised to hold
  p.poly([[13, 18], [20, 2], [27, 18]], RU.magic[2]);
  p.poly([[13, 18], [20, 2], [19, 18]], RU.magic[3]);
  p.line(17, 8, 16, 15, RU.magic[4]);
  p.px(18, 6, RU.magic[5]);
  ruMoss(p, 6, 71, 12, 1);
  p.line(28, 24, 31, 46, RU.moss[2]);
  p.line(31, 46, 29, 60, RU.moss[1]);
}

/** Light totem: three stacked carved faces under a glowing crystal. 40x72, anchor 20, 66. */
function drawLightTotem(p) {
  const S = RU.sand;
  p.rect(6, 62, 28, 6, S[1]);
  p.rect(6, 62, 28, 1, S[3]);
  for (let i = 0; i < 3; i++) {
    const y = 22 + i * 14;
    p.round(8, y, 24, 14, S[2 + (i % 2)], 3);
    p.rect(9, y + 1, 5, 11, S[4]);
    p.rect(11, y + 4, 6, 3, S[0]);
    p.rect(23, y + 4, 6, 3, S[0]);
    p.rect(12, y + 5, 4, 1, RU.magic[3]);
    p.rect(24, y + 5, 4, 1, RU.magic[3]);
    p.rect(15, y + 9, 10, 2, S[0]);
    p.rect(8, y + 13, 24, 1, S[0]);
  }
  p.poly([[12, 22], [20, 4], [28, 22]], RU.magic[2]);
  p.poly([[12, 22], [20, 4], [19, 22]], RU.magic[3]);
  p.px(18, 9, RU.magic[5]);
  ruMoss(p, 6, 61, 10, 0);
  ruMoss(p, 26, 21, 6);
}

/** Ancient rotator: a round stone body (its rings and guns are drawn at runtime). 64x64. */
function drawRotatorBody(p, P) {
  const S = RU.stone;
  const b = P.bob || 0;
  ruRock(p, 32, 36 + b, 15, 15);
  // a carved band round its middle and a single great eye
  p.rect(18, 36 + b, 28, 3, S[1]);
  for (let x = 20; x < 44; x += 4) p.px(x, 37 + b, S[4]);
  p.ellipse(35, 30 + b, 6, 5, S[0]);
  p.ellipse(35, 30 + b, 4, 3, RU.magic[2]);
  p.rect(35, 29 + b, 2, 2, RU.magic[5]);
  ruGlyph(p, 26, 44 + b);
  ruMoss(p, 24, 21 + b, 10, 2);
  ruCrack(p, [[40, 40 + b], [43, 46 + b]], S);
}

/** One of the rotator's floating guns, pointing right: a stone barrel with a magic core. 22x12, pivot 6, 6. */
function drawRotatorGun(p) {
  const S = RU.stone;
  p.round(1, 2, 10, 8, S[3], 2);
  p.rect(2, 3, 4, 1, S[5]);
  p.rect(9, 3, 12, 6, S[2]);
  p.rect(9, 3, 12, 1, S[4]);
  p.rect(19, 4, 2, 4, S[0]);
  p.rect(4, 5, 3, 2, RU.magic[3]);
  p.px(4, 5, RU.magic[5]);
}
