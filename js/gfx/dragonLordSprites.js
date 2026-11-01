// The Blazing Dragon Lord (js/entities/boss/dragonLord.js), his perch and the fence round his arena.
// He's a great crimson dragon, side on and facing right (flipped at runtime): plated gold belly, obsidian
// horns tipped with gold, wings of dark red membrane with lava glowing in their veins. Every pose is baked
// whole; parts are painted as polygons turned about their own pivots (dlXf) so the head and wings can
// take any angle. Each frame remembers where its mouth is (fire and meteors leave from there).

// canvas sizes and anchors: flying, the anchor is the middle of his body; perched, his feet on the tower's top
const DRAGON_LORD = {
  fly: { w: 236, h: 190, ax: 124, ay: 100 },
  perch: { w: 236, h: 200, ax: 116, ay: 192 },
};
// his tower: the foot of it (its anchor) and how far up its top is
const DRAGON_TOWER = { w: 120, h: 112, ax: 60, ay: 106, top: 66 };

const DL = {
  scale: ['#16030a', '#2e0610', '#4e0c16', '#741420', '#9e2024', '#c8382c', '#ec6038'],   // crimson scales, darkest first
  belly: ['#5a3412', '#8e5a1e', '#c4902c', '#e8c25a', '#fff0a8'],                         // gold plates
  wing: ['#22040a', '#3e0a10', '#621214', '#8a1e16', '#b8361c'],                          // the membrane
  horn: ['#0c080c', '#221a22', '#3e323a', '#6a5a5e', '#e2b850', '#fff0a0'],               // obsidian, gold tips
  fang: ['#8a7a6a', '#d8ccb8', '#f4ecdc'],
};

/** Points [x, y] turned by a about the origin, scaled by s, then moved to (ox, oy). */
function dlXf(pts, ox, oy, a = 0, s = 1) {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return pts.map(([x, y]) => [ox + (x * c - y * sn) * s, oy + (x * sn + y * c) * s]);
}

/** A thick limb (neck, tail, leg) along a polyline, its radius easing from r0 to r1. */
function dlTube(p, pts, r0, r1, color, dx = 0, dy = 0) {
  const segs = [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(l);
    total += l;
  }
  let at = 0;
  for (let i = 0; i < segs.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    for (let d = 0; d < segs[i]; d += 1.5) {
      const k = d / segs[i];
      const r = Math.max(1, Math.round(lerp(r0, r1, (at + d) / Math.max(1, total))));
      p.circle(Math.round(lerp(x0, x1, k) + dx), Math.round(lerp(y0, y1, k) + dy), r, color);
    }
    at += segs[i];
  }
  const e = pts[pts.length - 1];
  p.circle(Math.round(e[0] + dx), Math.round(e[1] + dy), Math.max(1, Math.round(r1)), color);
}

/** A row of spines along a polyline, leaning back (lean = how far back their tips sit). */
function dlSpines(p, pts, size, lean = -3, every = 2) {
  pts.forEach(([x, y], i) => {
    if (i % every) return;
    const s = size * (1 - (i / pts.length) * 0.4);
    p.poly([[x - s * 0.6, y + 1], [x + s * 0.6, y + 1], [x + lean, y - s * 1.6]], DL.horn[2]);
    p.line(x - s * 0.3, y, x + lean * 0.8, y - s * 1.3, DL.horn[3]);
    p.px(Math.round(x + lean), Math.round(y - s * 1.6), FF.lava[4]);
  });
}

/** Points along a polyline every `step` px (for spines and plates). */
function dlAlong(pts, step) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const l = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < l; d += step) out.push([lerp(x0, x1, d / l), lerp(y0, y1, d / l)]);
  }
  return out;
}

/**
 * His head at (x, y) (the back of his skull), turned by a, scale s, jaw open by `jaw` (radians).
 * Returns where his mouth is.
 */
function dlHead(p, x, y, a, s, jaw) {
  const X = (pts) => dlXf(pts, x, y, a, s);
  const S = DL.scale;
  const H = DL.horn;
  // the far horn, behind it all
  p.poly(X([[-4, -2], [2, -5], [-14, -10], [-30, -8], [-18, -3]]), H[1]);
  p.poly(X([[-30, -8], [-24, -9], [-25, -6]]), H[4]);
  // the inside of his mouth, then his lower jaw swung open on its hinge
  const hinge = X([[2, 5]])[0];
  const J = (pts) => dlXf(dlXf(pts, 0, 0, jaw), hinge[0], hinge[1], a, s);
  if (jaw > 0.08) {
    p.poly([...X([[4, 5], [46, 5]]), ...J([[42, 0], [4, 0]])], '#2a0406');
    p.poly([...X([[8, 6], [30, 6]]), ...J([[26, 1], [8, 1]])], FF.lava[2]);
    p.poly([...X([[8, 6], [18, 6]]), ...J([[16, 1], [8, 1]])], FF.lava[4]);
    // the lower fangs, pointing up
    for (const fx of [16, 23, 30, 37]) p.poly(J([[fx, 0], [fx + 3, 0], [fx + 1.5, -4]]), DL.fang[1]);
  }
  p.poly(J([[-2, -1], [20, 0], [40, 0], [44, 2], [36, 6], [16, 8], [2, 7], [-4, 3]]), S[2]);
  p.poly(J([[2, 1], [20, 2], [38, 2], [30, 4], [12, 5]]), S[3]);
  p.poly(J([[10, 5], [34, 4], [30, 6], [14, 7]]), DL.belly[2]);
  // the skull and snout
  p.poly(X([[-8, -6], [0, -11], [12, -12], [24, -9], [36, -6], [46, -3], [50, 1], [46, 5], [30, 6], [12, 8], [-4, 8], [-10, 3]]), S[3]);
  p.poly(X([[-4, -8], [2, -10], [14, -11], [26, -8], [40, -4], [44, -2], [30, -2], [10, -2], [-2, -2]]), S[4]);
  p.poly(X([[4, -10], [14, -10], [22, -8], [12, -7]]), S[5]);
  p.poly(X([[10, 5], [44, 3], [46, 5], [30, 6], [12, 8]]), S[2]);
  // the upper fangs, hanging over the lip
  for (const fx of [14, 21, 28, 35, 42]) p.poly(X([[fx, 5], [fx + 3, 5], [fx + 1.5, 10]]), DL.fang[2]);
  // a heavy brow over an ember eye, a nostril smouldering at the snout's tip
  p.poly(X([[12, -8], [26, -7], [24, -4], [14, -5]]), S[1]);
  p.poly(X([[15, -5], [23, -4], [22, -1], [16, -2]]), FF.lava[4]);
  const g = X([[17, -4]])[0];
  p.px(Math.round(g[0]), Math.round(g[1]), FF.lava[6]);
  const n = X([[45, -1]])[0];
  p.rect(Math.round(n[0]), Math.round(n[1]), 2, 2, FF.lava[3]);
  // the crest of spikes along his crown, a frill at his cheek
  for (const fx of [0, 8, 16]) p.poly(X([[fx - 2, -9 + fx * 0.1], [fx + 4, -10 - fx * 0.1], [fx - 6, -17]]), H[2]);
  p.poly(X([[-10, 2], [-4, 6], [-18, 13], [-13, 5]]), S[2]);
  p.poly(X([[-9, -2], [-4, 0], [-17, 2]]), S[2]);
  // the great near horn sweeping back, gold at its tip
  p.poly(X([[-2, -9], [6, -11], [-6, -20], [-20, -28], [-36, -31], [-22, -21], [-12, -13]]), H[2]);
  p.poly(X([[0, -10], [4, -11], [-8, -20], [-20, -27], [-10, -17]]), H[3]);
  p.poly(X([[-36, -31], [-27, -28], [-28, -24]]), H[4]);
  const tip = X([[-34, -30]])[0];
  p.px(Math.round(tip[0]), Math.round(tip[1]), H[5]);
  // where fire leaves him: between the jaws, at the front
  return J([[44, -3]])[0];
}

/**
 * A wing from the shoulder S. pts: [elbow, wrist, tip0..tip3, root] relative to S (x back = negative).
 * The membrane between the fingers is scalloped toward the wrist; veins of lava run through it.
 */
function dlWing(p, S, pts, sc, back) {
  const W = DL.wing;
  const at = (q) => [S[0] + q[0] * sc, S[1] + q[1] * sc];
  const [elbow, wrist, ...rest] = pts.map(at);
  const root = rest.pop();
  const tips = rest;
  const scallop = (a, b, k) => lerp2(lerp2(a, b, 0.5), wrist, k);
  const scs = [scallop(tips[0], tips[1], 0.3), scallop(tips[1], tips[2], 0.3), scallop(tips[2], tips[3], 0.3), scallop(tips[3], root, 0.22)];
  const membrane = [S, elbow, wrist, tips[0], scs[0], tips[1], scs[1], tips[2], scs[2], tips[3], scs[3], root];
  const base = back ? W[1] : W[2];
  const lit = back ? W[2] : W[3];
  p.poly(membrane, base);
  // lighter panels between the fingers, nearer the wrist
  for (let i = 0; i < 3; i++) p.poly([wrist, lerp2(wrist, tips[i], 0.8), lerp2(wrist, scs[i], 0.8), lerp2(wrist, tips[i + 1], 0.8)], lit);
  if (!back) p.poly([wrist, lerp2(wrist, tips[0], 0.45), lerp2(wrist, scs[0], 0.5), lerp2(wrist, tips[1], 0.45)], W[4]);
  // glowing veins out to the scallops
  for (const s of scs) p.line(wrist[0], wrist[1], lerp(wrist[0], s[0], 0.85), lerp(wrist[1], s[1], 0.85), back ? FF.lava[0] : FF.lava[1]);
  // the bones: the arm, then the fingers to each tip
  const bone = back ? DL.scale[2] : DL.scale[4];
  p.line(S[0], S[1], elbow[0], elbow[1], bone, 4);
  p.line(elbow[0], elbow[1], wrist[0], wrist[1], bone, 3);
  for (const t of tips) p.line(wrist[0], wrist[1], t[0], t[1], bone, 2);
  if (!back) for (const t of tips) p.line(wrist[0], wrist[1], lerp(wrist[0], t[0], 0.6), lerp(wrist[1], t[1], 0.6), DL.scale[5]);
  // a hooked claw at the wrist, a talon at each tip
  p.poly([[wrist[0] - 2, wrist[1] + 1], [wrist[0] + 2, wrist[1] - 1], [wrist[0] + 4, wrist[1] - 6]], DL.horn[3]);
  for (const t of tips) p.rect(Math.round(t[0]) - 1, Math.round(t[1]) - 1, 2, 2, DL.horn[back ? 2 : 4]);
}

function lerp2(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; }

/** A wing's points flapping: k = 1 raised high, -1 swept down (each finger's lift flips with it). */
function dlFlapPts(k) {
  const f = (dx, dy) => [dx, -dy * k];
  return [f(-14, 30), f(-2, 52), f(30, 72), f(-14, 84), f(-52, 72), f(-80, 42), [-44, 6]];
}

/** His tail from `from`, swaying by `ph`, tapering, an obsidian blade at its end. */
function dlTail(p, pts) {
  dlTube(p, pts, 10, 3, DL.scale[2]);
  dlTube(p, pts, 7, 2, DL.scale[3], -1, -2);
  const e = pts[pts.length - 1];
  const b = pts[pts.length - 2];
  const a = Math.atan2(e[1] - b[1], e[0] - b[0]);
  p.poly(dlXf([[0, -2], [12, -9], [16, 0], [12, 9], [0, 2]], e[0], e[1], a), DL.horn[2]);
  p.poly(dlXf([[2, -1], [11, -6], [13, 0], [6, 0]], e[0], e[1], a), DL.horn[3]);
  const c = dlXf([[4, 0], [12, 0]], e[0], e[1], a);
  p.line(c[0][0], c[0][1], c[1][0], c[1][1], FF.lava[3]);
  dlSpines(p, dlAlong(pts.slice(0, -1), 7).map(([x, y]) => [x, y - 6]), 3, -3);
}

/** Talons gripping the ground (or tucked): three cream claws curving forward from (x, y). */
function dlClaws(p, x, y) {
  for (const dx of [-3, 1, 5]) {
    p.poly([[x + dx, y - 2], [x + dx + 3, y - 2], [x + dx + 4, y + 2]], DL.fang[1]);
    p.px(x + dx + 1, y - 2, DL.fang[2]);
  }
}

/** Flying: body level, legs tucked, wings beating (P.wing: 1 up .. -1 down), P.jaw open. */
function drawDragonLordFly(p, P) {
  const S = DL.scale;
  const B = DL.belly;
  const bx = DRAGON_LORD.fly.ax;
  const by = DRAGON_LORD.fly.ay;
  const k = P.wing;
  // the far wing, darker, a beat behind and a little smaller
  dlWing(p, [bx + 6, by - 12], dlFlapPts(k * 0.9), 0.78, true);
  // the tail streaming out behind
  dlTail(p, [[bx - 34, by + 4], [bx - 54, by + 10], [bx - 74, by + 12], [bx - 92, by + 8 + k * 3], [bx - 104, by + k * 5]]);
  // the far legs, tucked up
  dlTube(p, [[bx - 24, by + 10], [bx - 34, by + 20], [bx - 44, by + 22]], 6, 3, S[1]);
  dlTube(p, [[bx + 16, by + 12], [bx + 24, by + 20]], 4, 3, S[1]);
  // the body: crimson scales lit along the back, gold plates down the belly, spines along the spine
  p.ellipse(bx, by, 38, 19, S[3]);
  p.ellipse(bx - 4, by - 6, 32, 11, S[4]);
  p.ellipse(bx - 12, by - 10, 16, 4, S[5]);
  p.ellipse(bx + 4, by + 9, 30, 8, B[2]);
  p.ellipse(bx + 2, by + 7, 24, 4, B[3]);
  for (let x = bx - 22; x <= bx + 28; x += 7) p.line(x, by + 4, x + 2, by + 15, B[1]);
  dlSpines(p, Array.from({ length: 7 }, (_, i) => {
    const x = bx - 30 + i * 9;
    return [x, by - 19 * Math.sqrt(Math.max(0, 1 - ((x - bx) / 38) ** 2)) + 1];
  }), 4, -4, 1);
  // the near legs, tucked: a heavy haunch, a foreleg, talons curled
  p.ellipse(bx - 24, by + 8, 13, 10, S[3]);
  p.ellipse(bx - 27, by + 4, 8, 5, S[4]);
  dlTube(p, [[bx - 22, by + 14], [bx - 32, by + 22], [bx - 42, by + 24]], 6, 3, S[3]);
  dlClaws(p, bx - 46, by + 25);
  dlTube(p, [[bx + 18, by + 10], [bx + 26, by + 20], [bx + 32, by + 22]], 5, 3, S[3]);
  dlClaws(p, bx + 32, by + 23);
  // the neck reaching forward to the head
  const neck = [[bx + 26, by - 6], [bx + 38, by - 16], [bx + 48, by - 24], [bx + 56, by - 28]];
  dlTube(p, neck, 11, 8, S[3]);
  dlTube(p, neck, 6, 4, S[4], -1, -3);
  dlTube(p, neck, 5, 3, B[2], 3, 6);
  dlSpines(p, dlAlong(neck, 6).map(([x, y]) => [x - 2, y - 9]), 3, -3, 1);
  P.mouth = dlHead(p, bx + 56, by - 30, 0.12, 0.95, P.jaw || 0.05);
  // the near wing over it all
  dlWing(p, [bx - 2, by - 8], dlFlapPts(k), 1, false);
}

// a perched wing: [elbow, wrist, tip0..3, root] folded like a cloak behind him, or spread wide over him
const DL_FOLD_FAR = [[-10, -26], [-4, -44], [-2, -50], [-30, 30], [-40, 56], [-22, 66], [-6, 40]];
const DL_SPREAD_FAR = [[-28, -36], [-52, -70], [-30, -100], [-84, -88], [-108, -52], [-112, -10], [-14, 30]];
const DL_FOLD_NEAR = [[-6, -24], [2, -40], [6, -46], [-22, 34], [-30, 62], [-12, 70], [4, 40]];
const DL_SPREAD_NEAR = [[-20, -44], [-28, -84], [6, -108], [-50, -108], [-86, -82], [-100, -36], [-10, 34]];

function dlBlend(a, b, k) { return a.map((q, i) => lerp2(q, b[i], k)); }

/**
 * Perched on his tower: sitting up, wings folded (P.spread 0) to spread wide (1), the neck idle, reared
 * back roaring at the sky, or lowered breathing fire (P.neck), P.jaw open, P.bob (his chest rising).
 */
function drawDragonLordPerch(p, P) {
  const S = DL.scale;
  const B = DL.belly;
  const F = DRAGON_LORD.perch.ay;   // the tower's top, under his feet
  const x0 = DRAGON_LORD.perch.ax - 116;
  const b = P.bob || 0;
  const sp = P.spread || 0;
  dlWing(p, [x0 + 120, 118 + b], dlBlend(DL_FOLD_FAR, DL_SPREAD_FAR, sp), 1, true);
  // the tail curled round the tower's top
  dlTail(p, [[x0 + 104, F - 12], [x0 + 86, F - 6], [x0 + 64, F - 2], [x0 + 42, F - 4], [x0 + 26, F - 12], [x0 + 18, F - 24]]);
  // the far legs
  dlTube(p, [[x0 + 128, F - 30], [x0 + 136, F - 10], [x0 + 140, F - 2]], 7, 5, S[1]);
  // the haunch and its foot gripping the edge
  p.ellipse(x0 + 112, F - 22 + b, 22, 18, S[3]);
  p.ellipse(x0 + 106, F - 30 + b, 13, 8, S[4]);
  p.ellipse(x0 + 102, F - 34 + b, 5, 3, S[5]);
  dlTube(p, [[x0 + 118, F - 12], [x0 + 124, F - 3]], 7, 5, S[2]);
  dlClaws(p, x0 + 126, F - 1);
  // the body sitting up, leaning into its chest, gold plates down the front
  p.ellipse(x0 + 126, F - 52 + b, 24, 34, S[3]);
  p.ellipse(x0 + 120, F - 60 + b, 17, 24, S[4]);
  p.ellipse(x0 + 114, F - 70 + b, 7, 10, S[5]);
  p.ellipse(x0 + 138, F - 46 + b, 12, 28, B[2]);
  p.ellipse(x0 + 136, F - 50 + b, 7, 22, B[3]);
  for (let y = F - 70; y <= F - 22; y += 6) p.line(x0 + 128, y + b, x0 + 149, y + 2 + b, B[1]);
  dlSpines(p, Array.from({ length: 6 }, (_, i) => {
    const y = F - 82 + i * 10;
    return [x0 + 126 - 24 * Math.sqrt(Math.max(0, 1 - ((y - (F - 52)) / 34) ** 2)) + 1, y + b];
  }), 4, -6, 1);
  dlWing(p, [x0 + 116, 122 + b], dlBlend(DL_FOLD_NEAR, DL_SPREAD_NEAR, sp), 1, false);
  // the neck: idle, reared back to roar, or lowered at whoever's close
  const necks = {
    idle: { pts: [[132, F - 80], [140, F - 96], [150, F - 108], [160, F - 116]], head: [160, F - 120], a: 0.2 },
    roar: { pts: [[132, F - 80], [136, F - 98], [140, F - 116], [144, F - 132]], head: [144, F - 136], a: -1.05 },
    breath: { pts: [[134, F - 78], [148, F - 84], [162, F - 86], [174, F - 84]], head: [176, F - 86], a: 0.45 },
  };
  const N = necks[P.neck || 'idle'];
  const neck = N.pts.map(([x, y]) => [x0 + x, y + b]);
  dlTube(p, neck, 13, 9, S[3]);
  dlTube(p, neck, 7, 5, S[4], -2, -3);
  dlTube(p, neck, 6, 4, B[2], 4, 3);
  dlSpines(p, dlAlong(neck, 6).map(([x, y]) => [x - 7, y - 4]), 3, -5, 1);
  // the foreleg down the front of his chest, talons over the edge
  dlTube(p, [[x0 + 140, F - 64 + b], [x0 + 148, F - 40], [x0 + 148, F - 14], [x0 + 152, F - 3]], 7, 5, S[3]);
  dlTube(p, [[x0 + 139, F - 66 + b], [x0 + 145, F - 44]], 4, 3, S[4], -1, -1);
  dlClaws(p, x0 + 154, F - 1);
  P.mouth = dlHead(p, x0 + N.head[0], N.head[1] + b, N.a, 1.1, P.jaw || 0.05);
}

/**
 * His perch: a squat round tower of nether brick, ringed with iron, lava glowing out of its arrow slits,
 * a gold dragon's-head relief over its door, its top a flat ring of scorched stone scored by his claws.
 */
function drawDragonTower(p) {
  const Bk = FF.brick;
  const R = FF.rock;
  const L = FF.lava;
  const T = DRAGON_TOWER;
  const cx = T.ax;
  const top = T.ay - T.top;
  const foot = T.ay;
  // the plinth it stands on
  p.ellipse(cx, foot - 4, 54, 11, R[1]);
  p.ellipse(cx - 2, foot - 6, 50, 9, R[2]);
  // the drum: brick, coursed and staggered, lit on the left, in shade on the right
  for (let y = top; y < foot - 4; y++) {
    const row = Math.floor((y - top) / 6);
    for (let x = cx - 46; x <= cx + 46; x++) {
      const u = (x - cx) / 46;
      const shade = u < -0.55 ? 4 : u < -0.1 ? 3 : u < 0.5 ? 2 : 1;
      const mortar = (y - top) % 6 === 5 || (Math.floor((x - cx + 64 + (row % 2) * 6) / 12) !== Math.floor((x - cx + 65 + (row % 2) * 6) / 12));
      p.px(x, y, mortar ? Bk[0] : Bk[shade]);
    }
  }
  // the rounded bottom of the drum
  p.ellipse(cx, foot - 6, 46, 7, Bk[1]);
  p.ellipse(cx - 6, foot - 8, 34, 4, Bk[2]);
  // two iron bands with rivets
  for (const by of [top + 14, foot - 20]) {
    p.rect(cx - 46, by, 93, 3, FF.iron[2]);
    p.rect(cx - 46, by, 93, 1, FF.iron[4]);
    for (let x = cx - 40; x <= cx + 40; x += 10) p.px(x, by + 1, FF.iron[5]);
  }
  // arrow slits glowing with lava, either side
  for (const sx of [cx - 30, cx + 26]) {
    p.rect(sx, top + 22, 5, 14, '#2a0406');
    p.rect(sx + 1, top + 24, 3, 11, L[3]);
    p.rect(sx + 1, top + 26, 3, 3, L[5]);
  }
  // the gold dragon's-head relief over a barred door
  p.round(cx - 9, foot - 24, 18, 16, '#2a0406', 4);
  p.rect(cx - 7, foot - 20, 14, 12, L[2]);
  for (let x = cx - 6; x <= cx + 6; x += 4) p.rect(x, foot - 21, 1, 13, FF.iron[3]);
  p.poly([[cx - 10, top + 6], [cx + 10, top + 6], [cx + 6, top + 16], [cx, top + 20], [cx - 6, top + 16]], DL.belly[2]);
  p.poly([[cx - 8, top + 7], [cx + 2, top + 7], [cx - 2, top + 13], [cx - 6, top + 13]], DL.belly[3]);
  p.rect(cx - 5, top + 10, 3, 2, L[4]);
  p.rect(cx + 2, top + 10, 3, 2, L[4]);
  p.poly([[cx - 10, top + 6], [cx - 16, top + 1], [cx - 8, top + 4]], DL.belly[1]);
  p.poly([[cx + 10, top + 6], [cx + 16, top + 1], [cx + 8, top + 4]], DL.belly[1]);
  // the top: a ring of scorched stone, claw marks scored across it, a lip of brick round it
  p.ellipse(cx, top, 48, 12, Bk[1]);
  p.ellipse(cx, top - 1, 45, 10, R[3]);
  p.ellipse(cx - 6, top - 3, 30, 5, R[4]);
  p.ellipse(cx - 14, top - 5, 10, 2, R[5]);
  for (const [x, y] of [[-20, -2], [8, 1], [22, -4]]) {
    p.line(cx + x, top + y, cx + x + 7, top + y - 3, R[1]);
    p.line(cx + x + 2, top + y + 1, cx + x + 9, top + y - 2, R[1]);
  }
  // crenels round its far rim
  for (const a of [-2.7, -2.0, -1.2, -0.5]) {
    const x = Math.round(cx + Math.cos(a) * 44);
    const y = Math.round(top + Math.sin(a) * 10);
    p.rect(x - 5, y - 9, 10, 9, Bk[3]);
    p.rect(x - 5, y - 9, 10, 2, Bk[5]);
  }
}

/**
 * The fence round his platform: a kerb of nether brick with an iron railing on it, spear-tipped posts
 * glowing hot at the top. h: a run along the platform's top or bottom edge (one tile wide);
 * v: a run down its side (one tile long, seen end on); post: a corner post with a brazier cap.
 */
function drawDragonFence(p, kind) {
  const Bk = FF.brick;
  const I = FF.iron;
  const L = FF.lava;
  const spear = (x, y) => {
    p.poly([[x - 2, y], [x + 3, y], [x + 0.5, y - 5]], I[4]);
    p.px(x, y - 4, L[4]);
  };
  if (kind === 'h') {
    // 32 wide, 30 tall: kerb along the bottom, posts and two rails over it
    p.rect(0, 23, 32, 7, Bk[2]);
    p.rect(0, 23, 32, 2, Bk[4]);
    p.rect(0, 28, 32, 2, Bk[1]);
    for (let x = 0; x < 32; x += 10) p.rect(x, 25, 1, 3, Bk[0]);
    p.rect(0, 9, 32, 2, I[3]);
    p.rect(0, 9, 32, 1, I[5]);
    p.rect(0, 17, 32, 2, I[2]);
    for (const x of [4, 12, 20, 28]) {
      p.rect(x - 1, 8, 2, 16, x === 4 || x === 20 ? I[3] : I[2]);
      p.px(x - 1, 8, I[5]);
      spear(x, 8);
    }
  } else if (kind === 'v') {
    // 12 wide, 54 tall: the kerb running away from you down the tile, posts at either end of it
    p.rect(3, 22, 7, 32, Bk[2]);
    p.rect(3, 22, 2, 32, Bk[4]);
    p.rect(8, 22, 2, 32, Bk[1]);
    for (let y = 26; y < 54; y += 10) p.rect(3, y, 7, 1, Bk[0]);
    p.rect(5, 6, 2, 34, I[3]);
    p.rect(5, 6, 1, 34, I[5]);
    for (const y of [22, 38]) {
      p.rect(5, y - 16, 3, 17, I[3]);
      spear(6, y - 16);
    }
  } else {
    // a corner post: a stout pillar of brick with a basin of embers on it
    p.rect(2, 12, 14, 24, Bk[3]);
    p.rect(2, 12, 4, 24, Bk[4]);
    p.rect(12, 12, 4, 24, Bk[1]);
    for (let y = 18; y < 36; y += 6) p.rect(2, y, 14, 1, Bk[0]);
    p.rect(0, 8, 18, 4, I[3]);
    p.rect(0, 8, 18, 1, I[5]);
    p.ellipse(9, 7, 7, 3, I[2]);
    p.ellipse(9, 6, 5, 2, L[3]);
    p.px(7, 5, L[5]);
  }
}

function buildDragonLordSprites() {
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE, 0.5), { light: 0.18, shade: 0.82 });
  /** Bakes a pose: its image, its flash, and where its mouth ended up. */
  const pose = (size, fn, P) => {
    const q = { ...P };
    const img = make(size.w, size.h, (p) => fn(p, q));
    return { img, flash: PixelArt.silhouette(img), mouth: { x: q.mouth[0] - size.ax, y: q.mouth[1] - size.ay } };
  };
  const flaps = [1, 0.62, 0.18, -0.4, -0.85, -0.45];
  const fly = DRAGON_LORD.fly;
  const perch = DRAGON_LORD.perch;
  Sprites.dragonLord = {
    fly: flaps.map((wing) => pose(fly, drawDragonLordFly, { wing })),
    flyOpen: flaps.map((wing) => pose(fly, drawDragonLordFly, { wing, jaw: 0.55 })),
    perch: [pose(perch, drawDragonLordPerch, {}), pose(perch, drawDragonLordPerch, { bob: 1, spread: 0.04 })],
    roar: [pose(perch, drawDragonLordPerch, { spread: 1, neck: 'roar', jaw: 0.95 }), pose(perch, drawDragonLordPerch, { spread: 0.9, neck: 'roar', jaw: 0.85 })],
    breath: [pose(perch, drawDragonLordPerch, { spread: 0.35, neck: 'breath', jaw: 0.65 }), pose(perch, drawDragonLordPerch, { spread: 0.4, neck: 'breath', jaw: 0.75, bob: 1 })],
    land: [pose(perch, drawDragonLordPerch, { spread: 0.55 }), pose(perch, drawDragonLordPerch, { spread: 0.8, jaw: 0.2 })],
    tower: PixelArt.make(DRAGON_TOWER.w, DRAGON_TOWER.h, drawDragonTower, OUTLINE, 0.5),
    fence: {
      h: PixelArt.make(32, 30, (p) => drawDragonFence(p, 'h'), OUTLINE, 0.5),
      v: PixelArt.make(12, 54, (p) => drawDragonFence(p, 'v'), OUTLINE, 0.5),
      post: PixelArt.make(18, 38, (p) => drawDragonFence(p, 'post'), OUTLINE, 0.5),
    },
  };
}
