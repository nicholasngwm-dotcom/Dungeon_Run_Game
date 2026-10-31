// The Fiery Fortress's guardians: demons, living fire and molten things, at home in a fortress
// of black nether brick over a sea of lava. Charred black rock (basalt and obsidian) split by
// glowing lava, demon reds, scorched iron, and the fire itself showing as orange-gold light in
// their eyes, cracks and seams. Lit from the top-left like the heroes; 64x64 (feet on row 58,
// anchor 32, 50) unless noted. The demons and the molten knight are built on the heroes' cute
// body (js/gfx/heroes/cute.js); the rest keep their own shapes. Weapons that aim or swing, and
// living flames, are drawn by the enemy at runtime, not baked in.

const FF = {
  rock: ['#0e0a0c', '#1c1618', '#2c2426', '#3e3434', '#544846', '#706260', '#94847c'],   // charred basalt, darkest first
  brick: ['#14070a', '#240c0e', '#361214', '#4a1a18', '#602420', '#7c3226'],             // nether brick
  lava: ['#4a0a04', '#9a1c0c', '#d63c16', '#ff7a1a', '#ffb52e', '#ffe27a', '#fff8d0'],    // cooling crust to white-hot
  demon: ['#240608', '#460c0e', '#6e1614', '#98241c', '#c23a26', '#e8643c'],             // demon hide
  horn: ['#1c1614', '#3a2e28', '#62544a', '#9a8a7a', '#d8ccbc'],
  iron: ['#0c0a0e', '#1c1a20', '#2e2a32', '#46404a', '#66606a', '#948c96'],              // scorched iron
  magic: ['#1e0630', '#46107a', '#7a24c0', '#b05af0', '#e0a8ff', '#ffffff'],             // the magic demon's violet fire
  scale: ['#3a0c06', '#6a180a', '#a02a10', '#d04818', '#f07a2a', '#ffb050'],             // dragon scales
  belly: ['#6a4a1a', '#a87a30', '#dcb050', '#f6dc8a'],
};
const FORT_LAVA = '255, 120, 40';     // lava's glow (rgb)
const FORT_FIRE = ['#a8200e', '#e0461e', '#ff8a1e', '#ffd34a', '#fff6c8'];   // living flames, darkest first
const FORT_MAGIC = '190, 110, 255';   // the magic demon's glow (rgb)

// ---------- shared parts ----------

/** A lump of charred basalt lit from the top-left. R = ramp darkest first. */
function ffRock(p, cx, cy, rx, ry, R = FF.rock) {
  p.ellipse(cx, cy, rx, ry, R[1]);
  p.ellipse(cx - 1, cy - 1, rx - 1, ry - 1, R[2]);
  p.ellipse(cx - 2, cy - 2, Math.max(1, rx - 4), Math.max(1, ry - 4), R[3]);
  p.ellipse(cx - Math.round(rx * 0.35), cy - Math.round(ry * 0.4), Math.max(1, Math.round(rx * 0.35)), Math.max(1, Math.round(ry * 0.25)), R[4]);
  p.px(cx - Math.round(rx * 0.5), cy - Math.round(ry * 0.55), R[5]);
}

/** A crack with lava glowing in it: a dark split, a hot core, a white-hot fleck. */
function ffCrack(p, pts, hot = true) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    p.line(x0, y0, x1, y1, FF.lava[1], 2);
    p.line(x0, y0, x1, y1, hot ? FF.lava[3] : FF.lava[2]);
  }
  if (hot) p.px(pts[0][0], pts[0][1], FF.lava[5]);
}

/** Two glowing ember eyes (each a 2x2 with a white-hot glint). */
function ffEyes(p, x, y, gap = 4, R = FF.lava) {
  for (const ex of [x, x + gap]) {
    p.rect(ex, y, 2, 2, R[4]);
    p.px(ex, y, R[6] || R[5]);
  }
}

/** A curved horn from (x, y) sweeping up and back, `len` px, thick at the root. */
function ffHorn(p, x, y, len, dir = -1, R = FF.horn) {
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const hx = Math.round(x + dir * Math.sin(k * 1.6) * len * 0.55);
    const hy = Math.round(y - k * len * 0.8);
    const w = Math.max(1, Math.round(3 * (1 - k)));
    p.rect(hx - Math.floor(w / 2), hy, w, 2, k > 0.7 ? R[4] : R[2]);
    p.px(hx - Math.floor(w / 2), hy, R[3]);
  }
}

/** A demon's face on a round head: red hide, a heavy brow, ember eyes and a fanged grin. */
function ffDemonHead(p, P, R = FF.demon, eye = FF.lava) {
  const hb = P.hb;
  p.round(27, 9 + hb, 14, 14, R[2], 4);
  p.round(28, 9 + hb, 8, 5, R[3], 2);
  p.rect(27, 15 + hb, 2, 6, R[1]);
  p.px(30, 11 + hb, R[4]);
  // the brow, glowering, and the eyes under it
  p.rect(30, 14 + hb, 10, 2, R[1]);
  if (P.eyes === 'blink') {
    p.rect(31, 16 + hb, 3, 1, OUTLINE);
    p.rect(36, 16 + hb, 3, 1, OUTLINE);
  } else {
    p.rect(31, 16 + hb, 3, 2, eye[4]); p.px(32, 16 + hb, eye[6] || eye[5]);
    p.rect(36, 16 + hb, 3, 2, eye[4]); p.px(37, 16 + hb, eye[6] || eye[5]);
  }
  // a wide grin with two fangs
  p.rect(32, 20 + hb, 7, 1, OUTLINE);
  p.px(33, 21 + hb, '#f4ead7');
  p.px(37, 21 + hb, '#f4ead7');
  p.px(40, 18 + hb, R[3]);   // the snout
  // horns: one sweeping back, the near one forward and up
  ffHorn(p, 29, 10 + hb, 9, -1);
  ffHorn(p, 37, 10 + hb, 8, 1);
}

/** A demon's tail curling out behind, ending in a spade. */
function ffTail(p, P, R = FF.demon) {
  const b = P.b;
  const sw = P.cf || 0;
  const pts = [[27, 38 + b], [22, 40 + b], [18 + sw, 44], [17 + sw, 49], [20 + sw, 52]];
  for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], R[2], 2);
  p.poly([[19 + sw, 51], [24 + sw, 50], [22 + sw, 55]], R[3]);
  p.px(21 + sw, 52, R[4]);
}

// ---------- the guardians ----------

/** Skeleflame: a skeleton archer charred black by the fortress, a burning quiver on its back (its skull burns at runtime). */
function drawSkeleflame(p, P) {
  const { b, hb } = P;
  // the quiver on its back: burnt leather, three arrows with glowing heads
  p.round(22, 22 + b, 5, 13, RAMP.leather[1], 1);
  p.rect(23, 23 + b, 1, 11, RAMP.leather[3]);
  for (const [x, h] of [[22, 4], [24, 6], [26, 3]]) {
    p.rect(x, 22 + b - h, 1, h, RAMP.leather[4]);
    p.px(x, 21 + b - h, FF.lava[4]);
  }
  drawSkeletonBody(p, P, { cloth: '#4a1410', eye: '#ffb02e' });
  // soot and scorch on the skull and ribs, embers caught in the sockets
  for (const [x, y] of [[29, 10], [30, 11], [38, 12], [28, 13]]) p.px(x, y + hb, '#5a5040');
  for (const [x, y] of [[29, 27], [37, 29], [31, 31]]) p.px(x, y + b, '#4a4438');
  p.px(31, 15 + hb, FF.lava[3]);
  p.px(37, 15 + hb, FF.lava[3]);
  // a scorched shoulder wrap
  p.poly([[27, 23 + b], [33, 22 + b], [35, 26 + b], [28, 27 + b]], '#3a1410');
  p.line(28, 23 + b, 33, 23 + b, '#6a2a1a');
}

/** Magma slime: a blob of molten rock under a cracked crust of cooling basalt. */
function drawMagmaSlime(p, size, rx, ry, tiny) {
  const L = FF.lava;
  const R = FF.rock;
  const cx = Math.floor(size / 2);
  const bottom = size - (tiny ? 5 : 8);
  const cy = bottom - ry;
  p.ellipse(cx, cy, rx, ry, L[1]);
  p.rect(cx - rx + 2, bottom - 2, rx * 2 - 3, 3, L[1]);
  p.ellipse(cx - 1, cy - 1, rx - 2, ry - 2, L[2]);
  p.ellipse(cx - 1, cy, Math.max(2, rx - 4), Math.max(2, ry - 4), L[3]);
  p.ellipse(cx - 2, cy + 1, Math.max(1, rx - 7), Math.max(1, ry - 6), L[4]);
  // cooled crust plates riding on top
  const plates = tiny ? [[-3, -ry + 2, 3, 2]] : [[-7, -ry + 3, 5, 3], [3, -ry + 2, 6, 3], [-rx + 3, -1, 3, 4], [rx - 6, 1, 3, 3]];
  for (const [dx, dy, w, h] of plates) {
    p.round(cx + dx, cy + dy, w, h, R[2], 1);
    p.rect(cx + dx, cy + dy, w, 1, R[4]);
  }
  p.rect(cx - rx + 3, bottom - 1, rx * 2 - 5, 1, L[0]);
  // drips and a bubble
  p.rect(cx + rx - 4, cy + 2, 2, ry - 1, L[2]);
  p.px(cx - 4, cy + 3, L[5]);
  if (!tiny) p.rect(cx + 5, cy + 4, 2, 2, L[5]);
  // fierce little eyes and a frown
  const es = tiny ? 2 : 3;
  const ex = cx + 1;
  const ey = cy - (tiny ? 2 : 3);
  for (const x of [ex, ex + es + 2]) {
    p.rect(x, ey, es, es, OUTLINE);
    p.px(x + es - 1, ey, L[6]);
  }
  p.rect(ex + 1, ey + es + 2, 4, 1, OUTLINE);
}

/** Magma bat: a little bat of black rock, lava in its veins and wing membranes. 40x32, pose.wing 0 up / 1 level / 2 down. */
function drawMagmaBat(p, pose) {
  const R = FF.rock;
  const L = FF.lava;
  const w = pose.wing || 0;
  const tipY = [3, 12, 22][w];
  const midY = [9, 14, 19][w];
  for (const s of [-1, 1]) {
    const x0 = 20 + s * 4;
    const pts = [[x0, 13], [20 + s * 10, midY - 2], [20 + s * 18, tipY], [20 + s * 15, midY + 3], [20 + s * 11, midY + 4], [20 + s * 7, 18]];
    p.poly(pts, R[2]);
    // the membrane glowing between the finger bones
    p.poly([[x0, 14], [20 + s * 10, midY], [20 + s * 14, midY + 2], [20 + s * 7, 17]], L[1]);
    p.line(x0, 13, 20 + s * 18, tipY, R[4]);
    p.line(20 + s * 10, midY - 2, 20 + s * 11, midY + 4, R[3]);
    p.px(20 + s * 12, midY + 1, L[3]);
  }
  // the body, ears and a glowing belly crack
  ffRock(p, 20, 16, 5, 6);
  p.poly([[16, 11], [17, 6], [19, 10]], R[3]);
  p.poly([[21, 10], [23, 6], [24, 11]], R[4]);
  ffCrack(p, [[19, 18], [21, 21]]);
  ffEyes(p, 18, 14, 3);
  p.px(20, 19, '#f4ead7');   // a fang
}

/** Demon warrior: a red demon in a studded leather kilt and a spiked iron pauldron (the pitchfork is drawn by the enemy). */
function drawDemonWarrior(p, P) {
  const D = FF.demon;
  const I = FF.iron;
  const b = P.b;
  ffTail(p, P);
  ckBackArm(p, P, D, D[1]);
  ckLegs(p, P, [D[0], D[1], D[2], D[3]], [FF.horn[0], FF.horn[1], FF.horn[2], FF.horn[3]], 55, 4);
  // a kilt of scorched leather strips with iron studs
  ckSkirt(p, P, [RAMP.leather[0], RAMP.leather[1], RAMP.leather[2], RAMP.leather[3]], 1, true);
  ckTorso(p, P, [D[1], D[2], D[3], D[4]]);
  // a bare chest: the muscles shaded in, a brand burned into it
  p.rect(33, 26 + b, 1, 6, D[1]);
  p.rect(29, 29 + b, 9, 1, D[1]);
  p.px(36, 27 + b, FF.lava[4]);
  p.px(35, 28 + b, FF.lava[4]);
  p.px(37, 28 + b, FF.lava[4]);
  ckBelt(p, P, RAMP.leather, I);
  for (const x of [29, 35, 38]) p.px(x, 37 + b, I[4]);
  ffDemonHead(p, P);
  ckFrontArm(p, P, [I[0], I[1], I[2], I[3], I[4], I[5]], D[3], true);
  // spikes on the pauldron
  for (const x of [36, 40]) p.poly(shift([[x - 1, 22], [x, 18], [x + 1, 22]], b), I[4]);
}

/** Magic demon: a robed demon sorcerer, long horns through its hood, violet fire in its eyes (the staff is drawn by the enemy). */
function drawMagicDemon(p, P) {
  const D = FF.demon;
  const M = FF.magic;
  const robe = ['#120814', '#24102a', '#381a40', '#4e2658'];
  const b = P.b;
  ffTail(p, P);
  ckBackArm(p, P, robe, D[2]);
  ckLegs(p, P, [D[0], D[1], D[2], D[3]], [FF.horn[0], FF.horn[1], FF.horn[2], FF.horn[3]], 55, 3);
  // a long robe trimmed in ember gold, a violet sash
  const hem = ckSkirt(p, P, robe, 10, false);
  p.line(26 + hem, 54 + b, 41 + hem, 54 + b, '#c88a30');
  ckTorso(p, P, robe);
  p.line(29, 25 + b, 38, 33 + b, M[2], 2);
  p.px(33, 29 + b, M[4]);
  ffDemonHead(p, P, D, [M[0], M[1], M[2], M[3], M[4], M[5]]);
  // the hood thrown back over its shoulders, the horns long and swept back
  p.poly(shift([[26, 22], [24, 14], [27, 9], [30, 13], [29, 22]], P.hb), robe[2]);
  p.line(25, 15 + P.hb, 27, 21 + P.hb, robe[3]);
  ffHorn(p, 28, 9 + P.hb, 13, -1);
  ckFrontArm(p, P, robe, D[3]);
  // runes glowing on its sleeve
  p.px(39, 31 + b, M[3]);
  p.px(39, 33 + b, M[3]);
}

/**
 * Elite demon: a tall demon knight in black iron, great bat wings, two broad swords. 80x80, anchor 40, 66
 * (feet on row 74). pose.wing 0 raised / 1 level / 2 swept down (flying); pose.ground: wings folded, swords
 * held ready; pose.slash: swords raised overhead.
 */
function drawEliteDemon(p, P) {
  const D = FF.demon;
  const I = FF.iron;
  const L = FF.lava;
  const b = P.bob || 0;
  // the wings, behind everything
  const w = P.ground ? -1 : P.wing || 0;
  const tip = [[6, 6], [2, 26], [10, 44]][w] || [24, 30];
  for (const s of [-1, 1]) {
    const sx = (x) => 40 + s * (x - 40);
    if (w < 0) {
      // folded behind its back
      p.poly([[sx(34), 30 + b], [sx(22), 22 + b], [sx(20), 50 + b], [sx(30), 46 + b]], D[1]);
      p.line(sx(34), 30 + b, sx(22), 22 + b, FF.horn[2]);
      continue;
    }
    const tx = sx(tip[0]);
    const ty = tip[1] + b;
    p.poly([[sx(36), 30 + b], [tx, ty], [sx(tip[0] + 6), ty + 18], [sx(18), 48 + b], [sx(26), 44 + b], [sx(32), 46 + b]], D[1]);
    p.poly([[sx(35), 32 + b], [sx(tip[0] + 4), ty + 6], [sx(tip[0] + 8), ty + 16], [sx(24), 42 + b]], D[2]);
    p.line(sx(36), 30 + b, tx, ty, FF.horn[3]);
    p.line(sx(30), 34 + b, sx(tip[0] + 6), ty + 18, FF.horn[2]);
    p.line(sx(30), 34 + b, sx(20), 47 + b, FF.horn[2]);
    p.px(tx, ty, FF.horn[4]);
  }
  // legs: armoured greaves, clawed feet
  for (const [x, lift, c] of [[33, 0, I[1]], [42, 0, I[2]]]) {
    p.round(x, 54, 7, 20 - lift, c, 2);
    p.rect(x + 1, 55, 2, 14, I[3]);
    p.rect(x - 1, 72, 10, 2, I[1]);
    p.px(x + 8, 73, FF.horn[3]);
  }
  // a skirt of iron plates
  p.poly([[31, 50 + b], [49, 50 + b], [52, 60 + b], [28, 60 + b]], I[2]);
  p.line(30, 55 + b, 50, 55 + b, I[1]);
  p.rect(39, 51 + b, 2, 9, L[2]);
  // the breastplate, a molten sigil glowing on it
  p.round(30, 32 + b, 20, 19, I[2], 3);
  p.rect(31, 33 + b, 5, 15, I[3]);
  p.rect(46, 34 + b, 3, 15, I[1]);
  p.rect(39, 37 + b, 3, 7, L[3]);
  p.rect(37, 39 + b, 7, 2, L[3]);
  p.px(40, 39 + b, L[5]);
  // pauldrons with spikes
  for (const [x, c] of [[26, I[2]], [46, I[3]]]) {
    p.round(x, 29 + b, 9, 8, c, 3);
    p.rect(x + 1, 30 + b, 6, 1, I[4]);
    p.poly([[x + 3, 30 + b], [x + 4, 24 + b], [x + 6, 30 + b]], FF.horn[3]);
  }
  // the head: a horned helm, a red jaw and ember eyes in the slit
  p.round(33, 16 + b, 15, 15, I[2], 4);
  p.rect(34, 17 + b, 4, 11, I[3]);
  p.rect(36, 23 + b, 11, 2, OUTLINE);
  ffEyes(p, 39, 23 + b, 4);
  p.round(36, 26 + b, 10, 5, D[2], 2);
  p.rect(37, 29 + b, 8, 1, OUTLINE);
  p.px(38, 30 + b, '#f4ead7'); p.px(44, 30 + b, '#f4ead7');
  ffHorn(p, 35, 17 + b, 12, -1);
  ffHorn(p, 45, 17 + b, 12, 1);
  // the two swords: down at its sides in flight, held out ready on the ground, raised high to slash
  const sword = (hx, hy, ang) => {
    const ex = Math.round(hx + Math.cos(ang) * 26);
    const ey = Math.round(hy + Math.sin(ang) * 26);
    p.line(hx, hy, ex, ey, I[4], 3);
    p.line(hx, hy, ex, ey, I[5]);
    p.line(Math.round(hx + Math.cos(ang) * 6), Math.round(hy + Math.sin(ang) * 6), ex, ey, L[3]);   // a red-hot edge
    const gx = Math.round(Math.cos(ang + Math.PI / 2) * 4);
    const gy = Math.round(Math.sin(ang + Math.PI / 2) * 4);
    p.line(hx - gx, hy - gy, hx + gx, hy + gy, FF.horn[2], 2);
    p.round(hx - 2, hy - 2, 4, 4, D[3], 1);
  };
  if (P.slash) {
    sword(28, 26 + b, -2.2);
    sword(52, 26 + b, -0.9);
  } else if (P.ground) {
    sword(27, 44 + b, 2.5);
    sword(53, 44 + b, 0.6);
  } else {
    sword(27, 46 + b, 1.9);
    sword(53, 46 + b, 1.2);
  }
}

/** Magma den: a heap of black rock round a cave mouth with a lava pool glowing inside it. 64x52, anchor 32, 46. */
function drawMagmaDen(p) {
  const R = FF.rock;
  const L = FF.lava;
  ffRock(p, 14, 38, 12, 10);
  ffRock(p, 50, 38, 12, 10);
  ffRock(p, 32, 26, 22, 18);
  ffRock(p, 20, 20, 9, 8);
  ffRock(p, 44, 18, 10, 8);
  // the cave mouth, lava glowing deep inside it
  p.ellipse(32, 36, 13, 10, R[0]);
  p.ellipse(32, 41, 11, 5, L[1]);
  p.ellipse(32, 42, 8, 3, L[3]);
  p.ellipse(31, 42, 4, 1, L[5]);
  // fangs of rock round the mouth
  for (const [x, y, h] of [[23, 28, 4], [28, 26, 5], [36, 26, 5], [41, 28, 4]]) p.poly([[x - 2, y], [x, y + h], [x + 2, y]], R[4]);
  ffCrack(p, [[12, 30], [16, 36], [14, 42]]);
  ffCrack(p, [[50, 28], [47, 34]]);
  ffCrack(p, [[30, 10], [33, 16]], false);
  // little spires on top
  for (const [x, h] of [[24, 9], [40, 7], [33, 12]]) p.poly([[x - 3, 12], [x, 12 - h], [x + 3, 12]], R[3]);
  p.rect(2, 46, 60, 2, R[0]);
}

/**
 * Meteorite crab: a crab carrying a meteorite for a shell: pitted black rock with a molten crater on top.
 * 72x72, anchor 36, 50. P.raised = claws up (calling the meteor), P.step = walking.
 */
function drawMeteorCrab(p, P) {
  const R = FF.rock;
  const L = FF.lava;
  const C = ['#2a0e08', '#4e1a0e', '#7a2c16', '#a84420', '#d0683a'];
  const b = P.bob || 0;
  const st = P.step || 0;
  // legs, three a side
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const x0 = 36 + s * (12 + i * 5);
      const lift = (i + st) % 2 ? 2 : 0;
      p.line(x0, 44 + b, x0 + s * 8, 48 + b - lift, C[1], 2);
      p.line(x0 + s * 8, 48 + b - lift, x0 + s * 10, 56 - lift, C[2], 2);
    }
  }
  // the claws: low and ready, or raised high
  for (const s of [-1, 1]) {
    const cx = 36 + s * 22;
    const cy = P.raised ? 24 + b : 42 + b;
    p.line(36 + s * 12, 40 + b, cx, cy + 6, C[2], 3);
    p.round(cx - 6, cy - 4, 12, 9, C[3], 3);
    p.rect(cx - 5, cy - 3, 6, 1, C[4]);
    p.poly([[cx + s * 2, cy - 4], [cx + s * 8, cy - 9], [cx + s * 5, cy - 1]], C[3]);
    p.px(cx - 1, cy, L[3]);
  }
  // the body under the shell, eyes up on stalks
  p.round(24, 38 + b, 24, 10, C[2], 4);
  p.rect(26, 39 + b, 20, 1, C[4]);
  for (const x of [32, 40]) {
    p.rect(x, 33 + b, 1, 6, C[3]);
    p.round(x - 1, 31 + b, 3, 3, '#1a0a08', 1);
    p.px(x, 31 + b, L[4]);
  }
  // the meteorite shell: pitted black rock, a crater of lava, cracks running from it
  ffRock(p, 36, 30 + b, 20, 13);
  p.ellipse(38, 24 + b, 8, 4, R[0]);
  p.ellipse(38, 25 + b, 6, 3, L[2]);
  p.ellipse(37, 25 + b, 3, 1, L[5]);
  for (const [x, y] of [[24, 30], [48, 32], [30, 36], [44, 26]]) { p.round(x, y + b, 3, 2, R[1], 1); p.px(x, y + b, R[4]); }
  ffCrack(p, [[30, 25 + b], [24, 32 + b], [26, 38 + b]]);
  ffCrack(p, [[46, 25 + b], [52, 31 + b]]);
}

/** Wildfire (for the bestiary; in a fight it's drawn live): a tongue of living flame with a fierce little face. 48x48. */
function drawWildfirePortrait(p) {
  const F = FORT_FIRE;
  p.poly([[10, 44], [6, 30], [12, 18], [16, 24], [20, 8], [26, 20], [32, 4], [36, 22], [42, 26], [40, 44]], F[1]);
  p.poly([[14, 44], [12, 32], [18, 24], [22, 30], [26, 16], [30, 28], [34, 20], [36, 44]], F[2]);
  p.poly([[18, 44], [18, 34], [24, 28], [28, 34], [32, 28], [32, 44]], F[3]);
  p.ellipse(25, 40, 6, 4, F[4]);
  p.rect(20, 32, 3, 3, OUTLINE);
  p.rect(28, 32, 3, 3, OUTLINE);
  p.px(22, 32, F[4]); p.px(30, 32, F[4]);
  p.rect(23, 37, 5, 1, OUTLINE);
}

/** Blazing turret: a squat tower of nether brick topped by an iron demon's head with fire in its mouth. 64x64. */
function drawBlazingTurret(p) {
  const B = FF.brick;
  const I = FF.iron;
  const L = FF.lava;
  // the brick base, stepped
  p.rect(14, 44, 36, 14, B[2]);
  p.rect(14, 44, 36, 1, B[4]);
  for (let y = 46; y < 58; y += 4) {
    for (let x = 14 + ((y / 4) % 2) * 4; x < 50; x += 8) { p.rect(x, y, 7, 3, B[3]); p.px(x, y, B[5]); }
  }
  p.rect(10, 56, 44, 3, B[1]);
  // the iron head: brow, horns, a grill of teeth round a furnace mouth
  p.round(16, 18, 32, 28, I[2], 8);
  p.round(17, 18, 18, 10, I[3], 5);
  p.rect(18, 26, 28, 3, I[1]);
  ffEyes(p, 23, 26, 14);
  p.round(22, 32, 20, 11, OUTLINE, 3);
  p.round(23, 33, 18, 9, L[1], 3);
  p.ellipse(32, 38, 7, 3, L[3]);
  p.ellipse(31, 38, 3, 1, L[5]);
  for (let x = 24; x < 41; x += 4) { p.poly([[x, 33], [x + 1, 36], [x + 2, 33]], I[4]); p.poly([[x, 42], [x + 1, 39], [x + 2, 42]], I[4]); }
  ffHorn(p, 18, 20, 12, -1, I.slice(1));
  ffHorn(p, 46, 20, 12, 1, I.slice(1));
  // rivets
  for (const [x, y] of [[19, 22], [45, 22], [19, 40], [45, 40]]) { p.px(x, y, I[5]); p.px(x + 1, y + 1, I[1]); }
}

/**
 * Molten knight: an old royal knight's armour, scorched black, lava welling up through every joint and
 * dripping off it; a crest of fire on the helm (it flickers at runtime). The sword is drawn by the enemy.
 */
function drawMoltenKnight(p, P) {
  const { b, hb } = P;
  const S = FF.iron;
  const L = FF.lava;
  const G = CK.gold;
  // a tattered, burning half-cape
  const f = P.cf;
  p.poly([[27, 23 + b], [34, 23 + b], [32, 34 + b], [31, 44], [27, 47], [21 + f, 48], [18 + f, 44], [20, 36 + b], [23, 28 + b]], '#3a0c0a');
  p.line(24, 27 + b, 19 + f, 45, '#5a160e');
  p.rect(19 + f, 46, 4, 2, L[2]);
  const legs = ckLegs(p, P, [S[0], S[1], S[2], S[3]], [S[0], S[1], S[2], S[4]], 55, 4);
  ckKnees(p, P, legs, S);
  ckSkirt(p, P, [S[0], S[1], S[2], S[3]], 0, true);
  ckTorso(p, P, [S[1], S[2], S[3], S[4]]);
  // the old royal trim, tarnished, and lava welling up through the seams
  p.rect(28, 24 + b, 12, 1, G[2]);
  p.rect(34, 25 + b, 1, 8, L[3]);
  p.rect(29, 31 + b, 10, 1, L[2]);
  p.px(34, 28 + b, L[5]);
  ckBelt(p, P, RAMP.leather, G);
  p.round(29, 21 + b, 10, 4, S[2], 1);
  // the helm: a visor glowing orange through its slit, lava dripping from under it
  p.round(28, 8 + b, 13, 15, S[3], 4);
  p.rect(29, 10 + b, 3, 10, S[4]);
  p.rect(38, 10 + b, 2, 11, S[1]);
  p.poly(shift([[31, 14], [42, 16], [38, 21], [31, 21]], b), S[3]);
  p.rect(32, 15 + b, 7, 1, L[3]);
  p.px(34, 15 + b, L[6]); p.px(37, 15 + b, L[6]);
  p.rect(37, 21 + b, 1, 3, L[3]);
  p.px(37, 24 + b, L[4]);
  p.rect(29, 13 + b, 11, 1, G[2]);
  // the crest's base (the fire on it is drawn live)
  p.rect(31, 6 + hb, 7, 3, S[2]);
  p.rect(32, 5 + hb, 5, 1, L[3]);
  ckFrontArm(p, P, S, S[2], true);
  p.rect(36, 28 + b, 6, 1, L[2]);   // a seam in the pauldron
  // drips down the legs
  p.rect(legs[1](52) + 1, 50, 1, 3, L[3]);
  p.rect(legs[0](50), 48, 1, 2, L[2]);
}

/**
 * Molten elemental (its body; the floating fists are drawn live): an angular plate of black rock for a head and
 * chest with a crest of spikes, the lava inside showing through a great round eye, and lava pouring down out of
 * it in thick streams to the ground. 96x96, anchor 48, 90.
 */
function drawMoltenElementalBody(p, P) {
  const R = FF.rock;
  const L = FF.lava;
  const b = P.bob || 0;
  // the lava pouring down to the ground: three thick streams, a white-hot core in each
  for (const [x, w] of [[38, 9], [48, 11], [58, 8]]) {
    p.poly([[x - w / 2, 54 + b], [x + w / 2, 54 + b], [x + w / 2 + 3, 88], [x - w / 2 - 3, 88]], L[2]);
    p.rect(Math.round(x - w / 4), 56 + b, Math.round(w / 2), 30 - b, L[3]);
    p.rect(Math.round(x - 1), 60 + b, 2, 24 - b, L[5]);
  }
  p.ellipse(48, 89, 24, 4, L[2]);
  // the lava torso behind the plates, then the plates
  p.poly([[26, 30 + b], [70, 30 + b], [66, 56 + b], [30, 56 + b]], L[2]);
  p.poly([[30, 34 + b], [66, 34 + b], [62, 52 + b], [34, 52 + b]], L[3]);
  // the lower plate: a V of rock
  p.poly([[24, 44 + b], [72, 44 + b], [60, 54 + b], [48, 66 + b], [36, 54 + b]], R[2]);
  p.poly([[26, 44 + b], [48, 44 + b], [48, 64 + b], [36, 54 + b]], R[3]);
  p.line(26, 44 + b, 70, 44 + b, R[5]);
  // the head plate: a great angular shield of rock, a crest of spikes, a round eye of lava
  p.poly([[22, 26 + b], [34, 12 + b], [48, 6 + b], [64, 12 + b], [74, 26 + b], [70, 44 + b], [26, 44 + b]], R[2]);
  p.poly([[24, 26 + b], [34, 14 + b], [46, 9 + b], [44, 42 + b], [28, 42 + b]], R[3]);
  p.line(34, 13 + b, 47, 7 + b, R[5]);
  for (const [x, y, h, lean] of [[40, 8, 12, -3], [52, 8, 14, 2], [62, 13, 10, 5], [30, 15, 8, -5]]) {
    p.poly([[x - 3, y + b], [x + lean, y - h + b], [x + 3, y + b]], R[3]);
    p.line(x - 2, y + b, x + lean, y - h + b, R[5]);
  }
  // the lava showing through, and the eye: a ring of rock round a white-hot core
  p.poly([[40, 18 + b], [56, 18 + b], [60, 30 + b], [48, 38 + b], [36, 30 + b]], L[2]);
  p.circle(48, 27 + b, 8, R[1]);
  p.circle(48, 27 + b, 6, L[3]);
  p.circle(48, 27 + b, 4, L[4]);
  p.circle(47, 26 + b, 2, L[6]);
  for (const [x, y] of [[36, 20], [60, 22], [38, 34], [58, 34]]) { p.rect(x, y + b, 3, 3, R[1]); p.px(x, y + b, R[4]); }   // chips of rock in the lava
  ffCrack(p, [[26, 30 + b], [30, 36 + b]]);
  ffCrack(p, [[68, 30 + b], [64, 38 + b]]);
}

/** One of the elemental's floating fists: a great block of black rock, cracked with lava. 34x38; molten: lava dripping off its knuckles. */
function drawMoltenFist(p, molten) {
  const R = FF.rock;
  const L = FF.lava;
  p.poly([[6, 4], [24, 2], [32, 12], [30, 30], [20, 36], [6, 32], [2, 18]], R[2]);
  p.poly([[6, 4], [18, 3], [16, 30], [6, 30], [3, 18]], R[3]);
  p.line(7, 4, 23, 3, R[5]);
  // knuckles
  for (const y of [12, 19, 26]) p.line(20, y, 30, y + 1, R[1]);
  ffCrack(p, [[10, 8], [14, 16], [11, 24]]);
  ffCrack(p, [[24, 6], [27, 12]]);
  if (molten) {
    p.poly([[4, 26], [20, 30], [24, 36], [8, 37]], L[2]);
    p.rect(9, 30, 8, 3, L[4]);
    for (const [x, h] of [[8, 4], [14, 6], [20, 3]]) { p.rect(x, 34, 2, h, L[3]); p.px(x, 34 + h, L[4]); }
  }
}

/**
 * Blazing baby dragon: a little dragon of red-orange scales, a cream belly, stubby horns, flapping wings.
 * 72x64, anchor 36, 56. pose.wing 0 up / 1 down; pose.open: jaws open (fire coming).
 */
function drawBabyDragon(p, P) {
  const S = FF.scale;
  const B = FF.belly;
  const b = P.bob || 0;
  const up = !(P.wing);
  // the far wing
  if (up) p.poly([[30, 26 + b], [18, 4 + b], [10, 12 + b], [14, 24 + b], [22, 30 + b]], S[1]);
  else p.poly([[30, 28 + b], [12, 40 + b], [8, 32 + b], [18, 24 + b]], S[1]);
  // the tail curling behind, a spade of flame at its tip
  p.line(26, 40 + b, 14, 44 + b, S[2], 4);
  p.line(14, 44 + b, 8, 38 + b, S[2], 3);
  p.poly([[8, 38 + b], [3, 33 + b], [9, 31 + b], [11, 36 + b]], FF.lava[3]);
  // legs tucked under (it's flying)
  p.round(28, 44 + b, 6, 6, S[2], 2);
  p.round(38, 45 + b, 6, 6, S[3], 2);
  for (const x of [28, 38]) { p.px(x + 1, 50 + b, '#f4ead7'); p.px(x + 4, 50 + b, '#f4ead7'); }
  // the body: round, a cream belly with ridges
  p.round(24, 28 + b, 24, 20, S[2], 8);
  p.round(25, 28 + b, 14, 9, S[3], 5);
  p.round(33, 33 + b, 13, 13, B[2], 5);
  for (const y of [36, 39, 42]) p.line(35, y + b, 44, y + b, B[1]);
  p.px(28, 30 + b, S[5]);
  // spines down its back
  for (const [x, y] of [[26, 28], [30, 25], [34, 24]]) p.poly([[x - 2, y + b], [x, y - 4 + b], [x + 2, y + b]], FF.lava[3]);
  // the head: a snout, horns, a glowing eye, jaws (open while it breathes fire)
  p.round(38, 14 + b, 18, 15, S[2], 6);
  p.round(39, 14 + b, 10, 6, S[3], 3);
  p.round(48, 20 + b, 13, 8, S[3], 3);
  p.px(58, 21 + b, S[0]);
  if (P.open) {
    p.rect(50, 26 + b, 11, 4, '#2a0604');
    p.rect(51, 27 + b, 8, 2, FF.lava[4]);
    p.round(48, 29 + b, 12, 4, S[2], 2);
  } else {
    p.rect(50, 27 + b, 10, 1, S[0]);
    p.px(53, 28 + b, '#f4ead7');
  }
  p.rect(46, 18 + b, 4, 3, OUTLINE);
  p.rect(47, 18 + b, 2, 2, FF.lava[5]);
  ffHorn(p, 41, 15 + b, 8, -1, FF.horn);
  ffHorn(p, 46, 14 + b, 7, -1, FF.horn);
  // the near wing, over the body
  if (up) {
    p.poly([[36, 28 + b], [30, 2 + b], [44, 4 + b], [54, 0 + b], [50, 16 + b], [42, 30 + b]], S[1]);
    p.poly([[37, 27 + b], [33, 6 + b], [43, 8 + b], [48, 4 + b], [46, 16 + b], [41, 28 + b]], FF.lava[1]);
    p.line(36, 28 + b, 30, 2 + b, S[4]);
    p.line(38, 26 + b, 44, 4 + b, S[3]);
    p.line(40, 27 + b, 54, 0 + b, S[3]);
  } else {
    p.poly([[36, 30 + b], [28, 52 + b], [40, 50 + b], [50, 56 + b], [48, 40 + b], [42, 30 + b]], S[1]);
    p.poly([[37, 32 + b], [31, 49 + b], [40, 47 + b], [46, 52 + b], [45, 40 + b], [41, 32 + b]], FF.lava[1]);
    p.line(36, 30 + b, 28, 52 + b, S[4]);
    p.line(39, 31 + b, 40, 50 + b, S[3]);
    p.line(41, 31 + b, 50, 56 + b, S[3]);
  }
}
