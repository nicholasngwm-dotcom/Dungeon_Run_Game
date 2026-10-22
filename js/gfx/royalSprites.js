// The castle's royals and their rooms: the Queen (72x88) and the King (112x112) in
// the heroes' cute style but grander, the King's throne, the garden bell, the rose
// gates the gardeners come through, the throne room's side doors, and the castle's
// set dressing (braziers, armour stands, banners, corrupted crystals, garden plants).
// Faces right, lit from the top-left; anchors are the feet (bottom centre).

const QUEEN_SPRITE = { w: 72, h: 88, ax: 36, ay: 84 };
const KING_SPRITE = { w: 112, h: 112, ax: 56, ay: 106 };
// where the King's weapon hand is in each pose (sprite pixels), for drawing the scepter or greatsword
const KING_HANDS = {
  sit: { x: 84, y: 70 }, shout: { x: 84, y: 70 }, throw: { x: 62, y: 16 }, raise: { x: 66, y: 12 },
  stand: { x: 86, y: 66 }, slam: { x: 92, y: 80 }, swing: { x: 94, y: 60 },
};

// ---------- the Queen ----------

/**
 * pose: { b body bob, sway hair/train sway, hem gown hem swing, arm: 'bow' (holding her bow out front)
 * | 'up' (reaching up for the bell rope) | 'down' }
 */
function drawQueen(p, pose) {
  const V = CK.violet;
  const C = CK.crimson;
  const G = CK.gold;
  const Sk = CK.skins.pale;
  const HA = ['#06040a', '#120c18', '#221a2c', '#3a2e48', '#5a4a6e'];   // raven hair
  const b = pose.b;
  const sw = pose.sway;
  const hem = pose.hem;
  // the long train flowing out behind her
  p.poly([[30, 40 + b], [24, 42 + b], [14 + sw, 64], [6 + sw * 2, 84], [32, 84], [32, 52 + b]], V[1]);
  p.poly([[28, 42 + b], [22, 48 + b], [12 + sw, 70], [8 + sw * 2, 84], [14 + sw * 2, 84], [20 + sw, 64]], V[2]);
  p.line(7 + sw * 2, 83, 31, 83, G[2]);
  // hair falling behind to the waist
  p.poly([[26, 20 + b], [32, 16 + b], [32, 46 + b], [26 + sw, 54 + b], [20 + sw, 50 + b], [22, 34 + b]], HA[2]);
  p.line(25, 24 + b, 22 + sw, 48 + b, HA[3]);
  // back arm
  p.poly([[30, 38 + b], [34, 38 + b], [31, 52 + b], [27, 52 + b]], V[1]);
  p.rect(27, 51 + b, 4, 3, Sk[1]);
  // the gown: a full skirt to the floor, embroidered and hemmed in gold
  p.poly([[29, 50 + b], [45, 50 + b], [56 + hem, 84], [18 + hem, 84]], V[2]);
  p.poly([[29, 50 + b], [33, 50 + b], [24 + hem, 84], [18 + hem, 84]], V[3]);
  p.poly([[42, 50 + b], [45, 50 + b], [56 + hem, 84], [50 + hem, 84]], V[1]);
  p.poly([[35, 50 + b], [39, 50 + b], [42 + hem, 84], [32 + hem, 84]], C[2]);   // a crimson panel down the front
  p.line(37, 51 + b, 37 + hem, 83, G[2]);
  for (let y = 56; y < 82; y += 6) {
    const k = (y - 50) / 34;
    p.px(Math.round(33 - k * 8 + hem * k), y + (y < 70 ? b : 0), G[3]);
    p.px(Math.round(42 + k * 10 + hem * k), y + (y < 70 ? b : 0), G[2]);
  }
  p.rect(18 + hem, 82, 39, 2, G[2]);
  p.rect(18 + hem, 82, 39, 1, G[3]);
  // bodice: a narrow waist, gold lacing, a crimson stomacher
  p.poly([[29, 36 + b], [45, 36 + b], [43, 51 + b], [31, 51 + b]], V[2]);
  p.poly([[34, 37 + b], [40, 37 + b], [38, 51 + b], [36, 51 + b]], C[2]);
  for (let y = 39; y < 50; y += 3) p.line(34, y + b, 40, y + 2 + b, G[3]);
  p.rect(29, 36 + b, 16, 1, G[3]);
  // the tall lace collar fanning up behind her head
  p.poly([[26, 38 + b], [21, 22 + b], [25, 18 + b], [30, 30 + b], [44, 30 + b], [49, 18 + b], [53, 22 + b], [48, 38 + b]], '#cfc6d8');
  for (const x of [24, 27, 47, 50]) p.line(x, 22 + b, x + (x < 37 ? 4 : -4), 36 + b, '#8a809a');
  // the head: big and round, pale, eyes glowing violet under long lashes
  p.round(26, 10 + b, 22, 22, Sk[2], 7);
  p.rect(27, 18 + b, 3, 10, Sk[1]);
  p.rect(45, 20 + b, 2, 8, Sk[1]);
  p.round(28, 11 + b, 12, 6, Sk[3], 3);
  if (pose.eyes === 'blink') {
    p.rect(31, 23 + b, 4, 1, OUTLINE);
    p.rect(39, 23 + b, 5, 1, OUTLINE);
  } else {
    p.rect(31, 20 + b, 4, 1, OUTLINE);
    p.rect(39, 20 + b, 5, 1, OUTLINE);
    p.px(44, 19 + b, OUTLINE);                     // a winged lash
    // cold, haughty eyes: whites, violet irises, a glint
    p.rect(31, 21 + b, 4, 4, '#f4eee8');
    p.rect(39, 21 + b, 5, 4, '#f4eee8');
    p.rect(32, 21 + b, 3, 4, '#6a3a9a');
    p.rect(40, 21 + b, 3, 4, '#6a3a9a');
    p.rect(33, 22 + b, 2, 2, '#140a18');
    p.rect(41, 22 + b, 2, 2, '#140a18');
    p.px(32, 21 + b, '#ffffff');
    p.px(40, 21 + b, '#ffffff');
    // thin arched brows, one raised in contempt
    p.line(30, 18 + b, 34, 17 + b, '#120c18');
    p.line(39, 17 + b, 44, 16 + b, '#120c18');
  }
  p.rect(37, 28 + b, 4, 1, '#5a1830');   // dark lips
  p.px(38, 29 + b, '#7a2240');
  // raven hair parted over the brow, falling past the ears
  p.poly([[25, 26 + b], [24, 14 + b], [29, 8 + b], [37, 6 + b], [45, 8 + b], [49, 14 + b], [49, 22 + b], [46, 16 + b], [40, 14 + b], [36, 17 + b], [31, 14 + b], [28, 19 + b], [28, 28 + b]], HA[2]);
  p.line(29, 9 + b, 36, 7 + b, HA[4]);
  p.line(27, 15 + b, 27, 26 + b, HA[3]);
  p.rect(36, 7 + b, 1, 10, HA[1]);   // the parting
  // the crown: tall dark-gold spires set with violet gems
  p.rect(28, 7 + b, 18, 3, G[2]);
  p.rect(28, 7 + b, 18, 1, G[3]);
  for (const [x, h] of [[29, 4], [33, 7], [37, 9], [41, 7], [45, 4]]) {
    p.poly([[x - 2, 8 + b], [x, 8 - h + b], [x + 2, 8 + b]], G[2]);
    p.px(x, 9 - h + b, G[4]);
  }
  p.rect(36, 1 + b, 3, 3, V[4]);
  p.px(36, 1 + b, '#f0e0ff');
  for (const x of [31, 42]) p.px(x, 8 + b, '#c43a6a');
  // the front arm in a long belled sleeve
  if (pose.arm === 'up') {
    p.poly([[42, 36 + b], [46, 36 + b], [52, 22 + b], [48, 20 + b]], V[2]);
    p.round(48, 16 + b, 5, 5, Sk[2], 2);
  } else if (pose.arm === 'hold') {
    // bent up at the elbow, her hand at her shoulder holding the umbrella's shaft
    p.poly([[41, 37 + b], [46, 37 + b], [52, 32 + b], [48, 29 + b]], V[2]);
    p.poly([[45, 36 + b], [51, 33 + b], [53, 38 + b], [48, 41 + b]], V[3]);
    p.round(48, 26 + b, 5, 5, Sk[2], 2);
  } else if (pose.arm === 'bow') {
    p.poly([[41, 37 + b], [46, 37 + b], [54, 44 + b], [50, 48 + b]], V[2]);
    p.poly([[48, 44 + b], [56, 42 + b], [55, 49 + b], [50, 50 + b]], V[3]);
    p.round(54, 43 + b, 5, 5, Sk[2], 2);
  } else {
    p.poly([[41, 37 + b], [46, 37 + b], [46, 52 + b], [40, 54 + b]], V[2]);
    p.round(42, 52 + b, 5, 5, Sk[2], 2);
  }
}

function buildQueenSprites() {
  const pose = (o) => ({ b: 0, sway: 0, hem: 0, arm: 'hold', eyes: 'open', ...o });
  const frame = (o) => {
    const img = PixelArt.make(QUEEN_SPRITE.w, QUEEN_SPRITE.h, (p) => drawQueen(p, pose(o)), OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  };
  Sprites.queen = {
    // her umbrella over her shoulder as she stands and walks (it's drawn by the Queen herself)
    idle: [frame({}), frame({ b: 1, sway: -1 }), frame({ b: 1, sway: -2 }), frame({ b: 0, sway: -1, eyes: 'blink' })],
    walk: [frame({ hem: 2, sway: -2 }), frame({ b: 1, hem: 0, sway: -3 }), frame({ hem: -2, sway: -2 }), frame({ b: 1, hem: 0, sway: -1 })],
    // running after you in phase 2: a bigger swing of the gown, the train streaming
    run: [frame({ hem: 4, sway: -4 }), frame({ b: 2, hem: 0, sway: -6 }), frame({ hem: -4, sway: -4 }), frame({ b: 2, hem: 0, sway: -2 })],
    reach: [frame({ arm: 'up' }), frame({ arm: 'up', b: 1 })],
    guard: [frame({ arm: 'bow' }), frame({ arm: 'bow', b: 1 })],   // the umbrella held out in front
    rest: [frame({ arm: 'down' })],
  };
  buildQueenUmbrella();
}

/**
 * Her magic umbrella, always open: a violet and crimson dome with gold ribs and a lace
 * hem, seen from the side. Eight frames turn it round its shaft, so it twirls (the panels
 * sweep across the front, the lit ones on the left). Pivot: the middle of its rim.
 */
function buildQueenUmbrella() {
  const V = CK.violet;
  const C = CK.crimson;
  const G = CK.gold;
  const R = CASTLE_COLORS.rose;
  const canopy = (ph) => PixelArt.make(60, 30, (p) => {
    const cx = 30;
    const apex = 4;
    const rim = 21;
    const rad = 27;
    p.rect(29, 0, 2, 4, G[3]);                        // the finial
    p.px(29, 0, G[4]);
    p.poly([[3, 22], [10, 10], [20, 5], [30, 3], [40, 5], [50, 10], [57, 22]], V[2]);
    // the panels facing us, alternately violet and crimson, the left ones catching the light
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU + ph;
      const a1 = ((k + 1) / 8) * TAU + ph;
      const mid = (a0 + a1) / 2;
      if (Math.cos(mid) < 0) continue;
      const lit = Math.sin(mid) < 0.15;
      const col = k % 2 ? (lit ? C[4] : C[3]) : (lit ? V[4] : V[3]);
      p.poly([[cx, apex], [cx + Math.sin(a0) * rad, rim], [cx + Math.sin(a1) * rad, rim]], col);
    }
    // gold ribs down to a rose at the rim
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + ph;
      if (Math.cos(a) < 0.05) continue;
      const rx = Math.round(cx + Math.sin(a) * rad);
      p.line(cx, apex + 1, rx, rim, G[2]);
      p.rect(rx - 1, rim - 1, 3, 3, R[2]);
      p.px(rx - 1, rim - 1, R[3]);
    }
    p.poly([[48, 9], [51, 11], [57, 22], [53, 22]], V[1]);   // the shaded far side
    p.poly([[9, 12], [17, 6], [22, 5], [13, 10]], '#c8a8f0');  // a sheen on the lit shoulder
    p.px(16, 7, '#f0e0ff');
    p.rect(3, 21, 54, 2, V[1]);                            // the shaded rim
    for (let x = 3; x < 57; x += 6) p.round(x, 22, 6, 4, '#cfc6d8', 2);   // lace scallops
    for (let x = 4; x < 57; x += 6) p.px(x + 2, 24, '#8a809a');
    p.rect(29, 23, 2, 7, '#2a1e30');                       // the shaft below the rim
  }, OUTLINE, 0.5);
  Sprites.queenParasol = [];
  for (let f = 0; f < 8; f++) Sprites.queenParasol.push(canopy((f / 8) * (TAU / 8)));
  // the magic it sprays: rose-violet sparks of light
  Sprites.projectiles.queenMagic = PixelArt.make(14, 14, (p) => {
    p.circle(7, 7, 5.5, '#8a2a9a');
    p.circle(7, 7, 4.5, '#ff6ad8');
    p.circle(6, 6, 2.5, '#f0c8ff');
    p.rect(5, 5, 2, 2, '#ffffff');
  }, OUTLINE);
}

// ---------- the King ----------

/**
 * pose: { mode: 'sit' | 'stand', b bob, step (walking: -1..1), head: 'calm' | 'shout',
 * arm: 'rest' | 'up' (throwing) | 'raise' | 'forward' | 'slam' }
 */
function drawKing(p, pose) {
  const C = CK.crimson;
  const G = CK.gold;
  const V = CK.violet;
  const Sk = CK.skins.ruddy;   // red-faced from feasting
  const ER = ['#8a8090', '#cfc8d4', '#f0ecf2'];               // ermine
  const BE = ['#5a5462', '#8e8898', '#c0bac8', '#e4e0ea'];   // grey beard
  const b = pose.b;
  const sit = pose.mode === 'sit';
  const st = pose.step || 0;
  const by = sit ? 0 : 6;                // standing he sits higher on his legs... his belly drops a little lower
  // the ermine cape spread behind him
  p.poly([[40, 40 + b], [30, 50 + b], [24, 84], [30, sit ? 92 : 100], [52, sit ? 92 : 100], [56, 46 + b]], C[1]);
  p.poly([[38, 44 + b], [30, 56 + b], [26, 84], [32, 84], [36, 60 + b]], C[2]);
  // legs
  if (sit) {
    for (const [hy, kx, near] of [[86, 74, false], [88, 78, true]]) {
      const R = near ? [C[1], C[2], C[3]] : [C[0], C[1], C[2]];
      p.rect(56, hy - 3, kx - 56, 8, R[1]);
      p.rect(56, hy - 3, kx - 56, 1, R[2]);
      p.rect(kx - 6, hy - 2, 7, 16, R[1]);
      p.rect(kx - 6, hy - 2, 1, 16, R[2]);
      // pointed slippers
      p.poly([[kx - 7, hy + 13], [kx + 8, hy + 14], [kx + 12, hy + 12], [kx + 9, hy + 17], [kx - 7, hy + 17]], near ? G[2] : G[1]);
    }
  } else {
    for (const [hx, near, k] of [[50, false, -st], [62, true, st]]) {
      const R = near ? [C[1], C[2], C[3]] : [C[0], C[1], C[2]];
      const fx = hx + k * 6;
      p.poly([[hx - 4, 84], [hx + 5, 84], [fx + 5, 101], [fx - 4, 101]], R[1]);
      p.line(hx - 4, 84, fx - 4, 101, R[2]);
      p.poly([[fx - 5, 100], [fx + 9, 100], [fx + 13, 98], [fx + 10, 104], [fx - 5, 104]], near ? G[2] : G[1]);
    }
  }
  // back arm resting (on the armrest when seated)
  p.poly([[38, 50 + b], [44, 50 + b], [40, 70 + b], [32, 70 + b]], C[2]);
  p.round(30, 68 + b, 8, 6, Sk[2], 2);
  // the great round belly in a crimson robe straining at gold buttons, a jewelled belt
  const cy = 70 + b + by;
  p.ellipse(58, cy, 27, 22, C[2]);
  p.ellipse(52, cy - 6, 17, 13, C[3]);
  p.ellipse(48, cy - 10, 6, 4, C[4]);
  p.ellipse(68, cy + 8, 14, 10, C[1]);
  for (let i = 0; i < 4; i++) {
    p.round(60 + i * 2, cy - 14 + i * 7, 3, 3, G[2], 1);
    p.px(60 + i * 2, cy - 14 + i * 7, G[4]);
  }
  // the belt follows the curve of the belly
  for (let x = 33; x <= 83; x++) {
    const k = (x - 58) / 26;
    const yy = cy + 2 + Math.round(3 * (1 - k * k));
    p.rect(x, yy, 1, 5, G[1]);
    p.px(x, yy, G[2]);
  }
  p.round(54, cy + 1, 8, 8, G[2], 2);
  p.rect(56, cy + 3, 4, 4, V[3]);
  p.px(56, cy + 3, '#f0e0ff');
  // the ermine collar over his shoulders
  p.poly([[36, 46 + b], [44, 40 + b], [74, 40 + b], [82, 46 + b], [78, 54 + b], [40, 54 + b]], ER[1]);
  p.poly([[36, 46 + b], [44, 40 + b], [74, 40 + b], [76, 43 + b], [42, 44 + b]], ER[2]);
  for (const [x, y] of [[44, 47], [52, 50], [60, 46], [68, 50], [74, 47]]) { p.rect(x, y + b, 2, 3, '#141018'); p.px(x + 1, y + 3 + b, '#141018'); }
  // the head (tilted back when he shouts)
  const shout = pose.head === 'shout';
  const hx = shout ? -2 : 0;
  const hy2 = (shout ? -3 : 0) + b;
  p.round(42 + hx, 18 + hy2, 34, 28, Sk[2], 10);
  p.round(46 + hx, 19 + hy2, 16, 8, Sk[3], 4);
  p.rect(43 + hx, 28 + hy2, 3, 12, Sk[1]);
  // tiny glowing eyes in heavy lids, a big red nose, flushed cheeks
  if (!shout && pose.eyes !== 'blink') {
    p.rect(55 + hx, 28 + hy2, 5, 2, '#140c18');
    p.rect(65 + hx, 28 + hy2, 5, 2, '#140c18');
    p.px(57 + hx, 28 + hy2, '#f4eee8');
    p.px(67 + hx, 28 + hy2, '#f4eee8');
    p.rect(54 + hx, 26 + hy2, 7, 1, BE[1]);
    p.rect(64 + hx, 26 + hy2, 7, 1, BE[1]);
  } else {
    // squeezed shut
    p.line(55 + hx, 28 + hy2, 59 + hx, 27 + hy2, '#140c18');
    p.line(65 + hx, 27 + hy2, 69 + hx, 28 + hy2, '#140c18');
    p.rect(54 + hx, 24 + hy2, 6, 1, BE[1]);
    p.rect(64 + hx, 24 + hy2, 6, 1, BE[1]);
  }
  p.rect(52 + hx, 32 + hy2, 4, 2, '#a84a5a');
  p.rect(70 + hx, 32 + hy2, 4, 2, '#a84a5a');
  p.round(60 + hx, 29 + hy2, 7, 6, '#b04a5a', 3);
  p.px(61 + hx, 30 + hy2, '#e88a9a');
  // the beard and moustache (parted round a wide-open mouth when he shouts)
  if (shout) {
    p.poly([[46 + hx, 34 + hy2], [80 + hx, 34 + hy2], [78 + hx, 46 + hy2], [72, 60 + b], [60, 64 + b], [50, 58 + b], [46 + hx, 44 + hy2]], BE[2]);
    p.round(56 + hx, 36 + hy2, 14, 12, '#200810', 5);
    p.rect(58 + hx, 44 + hy2, 9, 3, '#8a2a3a');
    p.rect(57 + hx, 36 + hy2, 12, 2, '#e8e0d0');   // teeth
  } else {
    p.poly([[46, 34 + b], [80, 34 + b], [78, 44 + b], [72, 60 + b], [62, 66 + b], [52, 60 + b], [46, 46 + b]], BE[2]);
    p.rect(58, 40 + b, 8, 2, '#3a1420');
  }
  p.poly([[50 + hx, 34 + hy2], [62 + hx, 33 + hy2], [74 + hx, 34 + hy2], [76 + hx, 38 + hy2], [62 + hx, 36 + hy2], [48 + hx, 38 + hy2]], BE[3]);
  for (const x of [52, 58, 64, 70]) p.line(x, 46 + b, x + 2, 58 + b, BE[1]);
  p.line(50, 40 + b, 54, 52 + b, BE[3]);
  // the crown on a crimson velvet cap: a heavy gold band, five spires, violet and ruby stones
  p.round(46 + hx, 8 + hy2, 26, 12, C[2], 5);
  p.rect(48 + hx, 9 + hy2, 10, 3, C[3]);
  p.rect(44 + hx, 16 + hy2, 30, 5, G[2]);
  p.rect(44 + hx, 16 + hy2, 30, 1, G[4]);
  p.rect(44 + hx, 20 + hy2, 30, 1, G[1]);
  for (const x of [46, 52, 59, 66, 72]) {
    p.poly([[x - 3 + hx, 17 + hy2], [x + hx, 8 + hy2], [x + 3 + hx, 17 + hy2]], G[2]);
    p.circle(x + hx, 8 + hy2, 1, G[4]);
  }
  for (const [x, c] of [[50, '#c43a6a'], [59, V[4]], [68, '#c43a6a']]) p.rect(x - 1 + hx, 17 + hy2, 3, 3, c);
  // the front (weapon) arm
  const hand = (x, y) => { p.round(x - 3, y - 3, 7, 7, Sk[2], 2); p.px(x - 2, y - 2, Sk[3]); };
  const sleeve = (pts) => { p.poly(pts, C[2]); p.line(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1], C[3]); };
  if (pose.arm === 'up') {
    sleeve([[70, 46 + b], [78, 46 + b], [66, 18], [60, 20]]);
    hand(62, 16);
  } else if (pose.arm === 'raise') {
    sleeve([[70, 46 + b], [78, 46 + b], [70, 14], [62, 16]]);
    hand(66, 12);
  } else if (pose.arm === 'slam') {
    sleeve([[72, 48 + b], [80, 46 + b], [94, 76], [86, 80]]);
    hand(92, 80);
  } else if (pose.arm === 'forward') {
    sleeve([[72, 48 + b], [80, 46 + b], [96, 58], [92, 64]]);
    hand(94, 60);
  } else {
    sleeve([[72, 48 + b], [80, 46 + b], [88, sit ? 66 : 62], [80, sit ? 70 : 66]]);
    hand(sit ? 84 : 86, sit ? 70 : 66);
  }
}

function buildKingSprites() {
  const pose = (o) => ({ mode: 'sit', b: 0, head: 'calm', arm: 'rest', eyes: 'open', ...o });
  const frame = (o) => {
    const img = PixelArt.make(KING_SPRITE.w, KING_SPRITE.h, (p) => drawKing(p, pose(o)), OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  };
  Sprites.king = {
    sit: [frame({}), frame({ b: 1 }), frame({ b: 1 }), frame({ eyes: 'blink' })],
    shout: [frame({ head: 'shout' }), frame({ head: 'shout', b: -1 })],
    throw: [frame({ arm: 'up' })],
    stand: [frame({ mode: 'stand' }), frame({ mode: 'stand', b: 1 })],
    walk: [frame({ mode: 'stand', step: 1 }), frame({ mode: 'stand', step: 0, b: -1 }), frame({ mode: 'stand', step: -1 }), frame({ mode: 'stand', step: 0, b: -1 })],
    raise: [frame({ mode: 'stand', arm: 'raise' })],
    slam: [frame({ mode: 'stand', arm: 'slam', b: 2 })],
    swing: [frame({ mode: 'stand', arm: 'forward' })],
    crown: [frame({ mode: 'stand', head: 'shout', arm: 'rest' })],
  };
}

// ---------- the rooms' set pieces ----------

function buildRoyalSetPieces() {
  const G = CK.gold;
  const C = CK.crimson;
  const V = CK.violet;
  const S = CK.steel;
  const W = ['#1e120c', '#33201a', '#4e3224', '#6a4630', '#8a5e3e'];
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  Sprites.royal = {
    // the throne: a towering back of crimson velvet in a spiked dark-gold frame, on a marble dais
    throne: make(132, 150, (p) => {
      // dais: three steps of marble
      for (let i = 0; i < 3; i++) {
        const w = 132 - i * 16;
        const y = 142 - i * 8;
        p.rect((132 - w) / 2, y, w, 8, i % 2 ? '#d8d2dc' : '#c8c0d0');
        p.rect((132 - w) / 2, y, w, 1, '#f2eef4');
        p.rect((132 - w) / 2, y + 7, w, 1, '#8a8296');
      }
      // the back
      p.round(30, 6, 72, 116, G[1], 10);
      p.round(34, 12, 64, 104, C[2], 8);
      p.round(38, 16, 22, 96, C[3], 6);
      for (let y = 24; y < 108; y += 12) for (let x = 42; x < 94; x += 12) p.px(x + ((y / 12) % 2) * 6, y, G[3]);
      // spires along the top
      for (const [x, h] of [[36, 12], [50, 20], [66, 28], [82, 20], [96, 12]]) {
        p.poly([[x - 5, 14], [x, 14 - h], [x + 5, 14]], G[2]);
        p.line(x - 1, 14 - h + 3, x - 3, 12, G[4]);
        p.circle(x, 14 - h + 2, 2, x === 66 ? V[4] : '#c43a6a');
      }
      p.round(56, 26, 20, 20, G[2], 8);   // the empire's sun, tarnished
      p.circle(66, 36, 6, V[3]);
      p.px(64, 34, '#f0e0ff');
      // seat and armrests
      p.rect(26, 92, 80, 18, G[1]);
      p.rect(30, 94, 72, 12, C[2]);
      p.rect(30, 94, 72, 3, C[3]);
      for (const x of [20, 98]) {
        p.rect(x, 78, 14, 34, G[1]);
        p.rect(x, 78, 14, 3, G[3]);
        p.round(x - 2, 74, 18, 8, G[2], 3);
        p.circle(x + 7, 76, 3, G[4]);
      }
      p.rect(24, 110, 84, 8, G[1]);
      p.rect(24, 110, 84, 1, G[3]);
      for (const x of [26, 100]) p.rect(x, 112, 6, 14, G[1]);
    }),
    // the bell frame: two posts and a crossbeam (the bell itself swings at runtime)
    bellFrame: make(84, 104, (p) => {
      for (const x of [6, 70]) {
        p.rect(x, 10, 8, 90, W[2]);
        p.rect(x, 10, 2, 90, W[4]);
        p.rect(x + 6, 10, 2, 90, W[0]);
        p.rect(x - 4, 96, 16, 6, '#4a4652');
        p.rect(x - 4, 96, 16, 1, '#6a6676');
      }
      p.rect(2, 6, 80, 9, W[2]);
      p.rect(2, 6, 80, 2, W[4]);
      p.rect(2, 13, 80, 2, W[0]);
      for (const x of [4, 76]) { p.poly([[x, 6], [x + 4, 0], [x + 8, 6]], W[3]); }
      p.rect(38, 14, 8, 4, S[3]);
      // climbing roses on the posts
      for (let y = 30; y < 94; y += 9) for (const x of [4, 76]) { p.circle(x + (y % 2) * 2, y, 2, CASTLE_COLORS.rose[1]); p.px(x, y - 1, CASTLE_COLORS.rose[3]); }
    }),
    // the bell: tarnished bronze, a crowned rim (drawn hanging from (21, 2))
    bell: make(42, 40, (p) => {
      p.rect(19, 0, 4, 5, S[2]);
      p.poly([[12, 6], [30, 6], [33, 26], [38, 34], [4, 34], [9, 26]], '#7a5a2a');
      p.poly([[12, 6], [19, 6], [14, 26], [9, 34], [4, 34], [9, 26]], '#a8823e');
      p.rect(4, 32, 34, 3, '#5a4018');
      p.rect(4, 32, 34, 1, '#c8a456');
      p.rect(11, 12, 20, 2, '#5a4018');
      p.round(18, 34, 6, 5, '#3a2a12', 2);   // the clapper
    }),
    // a rose arch: a trellis wound with dark roses; iron gates hang in it at runtime
    roseArch: make(64, 84, (p) => {
      const Gr = CASTLE_COLORS.hedge;
      const R = CASTLE_COLORS.rose;
      for (const x of [4, 52]) {
        p.rect(x, 18, 8, 64, W[2]);
        p.rect(x, 18, 2, 64, W[4]);
      }
      p.ctx.strokeStyle = W[2];
      p.ctx.lineWidth = 7;
      p.ctx.beginPath(); p.ctx.arc(32, 26, 24, Math.PI, 0); p.ctx.stroke();
      const rng = seededRandom(91);
      for (let i = 0; i < 40; i++) {
        const a = Math.PI + rng() * Math.PI;
        const onArch = i < 22;
        const x = onArch ? 32 + Math.cos(a) * 24 : (i % 2 ? 6 : 54) + rng() * 4;
        const y = onArch ? 26 + Math.sin(a) * 24 : 30 + rng() * 50;
        p.circle(x, y, 3 + Math.floor(rng() * 2), Gr[2 + Math.floor(rng() * 2)]);
        if (rng() < 0.45) { p.circle(x + 1, y, 2, R[1]); p.px(x, y - 1, R[3]); p.px(x + 1, y, R[2]); }
      }
    }),
    // one leaf of the garden gates (opens by narrowing at runtime)
    gateLeaf: make(20, 54, (p) => {
      p.rect(0, 0, 20, 3, S[2]);
      p.rect(0, 51, 20, 3, S[2]);
      for (let x = 1; x < 20; x += 4) { p.rect(x, 0, 2, 54, S[2]); p.px(x, 0, S[4]); p.poly([[x - 1, 2], [x + 1, -2 + 2], [x + 3, 2]], S[3]); }
      p.rect(0, 24, 20, 2, S[3]);
      p.circle(10, 25, 4, S[3]);
      p.circle(10, 25, 2, CASTLE_COLORS.rose[1]);
    }),
    // a throne-room side door: a stone arch round two iron-bound oak leaves (they open at runtime)
    doorArch: make(64, 72, (p) => {
      const arch = (inset, color) => {
        p.rect(inset, 32, 64 - inset * 2, 40 - (inset ? 0 : 0), color);
        p.ellipse(32, 32, 32 - inset, 32 - inset, color);
      };
      arch(0, '#2a2534');
      arch(4, '#3e3848');
      p.rect(4, 30, 3, 42, '#4e4860');
      arch(9, '#0a080e');   // the dark beyond
      p.rect(28, 1, 8, 7, G[2]);              // a keystone with a gold crest
      p.px(31, 3, G[4]);
    }),
    doorLeaf: make(24, 62, (p) => {
      p.rect(0, 10, 24, 52, W[2]);
      p.round(0, 0, 24, 30, W[2], 12);
      for (let x = 2; x < 24; x += 5) p.rect(x, 4, 1, 58, W[1]);
      p.rect(0, 2, 2, 60, W[3]);
      for (const y of [16, 40]) { p.rect(0, y, 24, 3, S[2]); p.rect(0, y, 24, 1, S[4]); }
      p.circle(18, 30, 2, G[3]);
    }),
  };
}

/** Castle set dressing as cached sprites (anchored at the bottom centre). */
function buildCastleDecor() {
  const S = CK.steel;
  const C = CK.crimson;
  const G = CK.gold;
  const V = CK.violet;
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  Sprites.castleDecor = {
    // an iron brazier on three legs (its fire burns at runtime)
    brazier: make(30, 34, (p) => {
      p.line(6, 32, 12, 16, S[2], 2);
      p.line(24, 32, 18, 16, S[2], 2);
      p.line(15, 33, 15, 18, S[1], 2);
      p.poly([[2, 8], [28, 8], [24, 18], [6, 18]], S[2]);
      p.poly([[2, 8], [28, 8], [27, 11], [3, 11]], S[4]);
      p.rect(4, 6, 22, 3, '#1a0e08');
      for (const x of [6, 14, 22]) p.px(x, 14, G[2]);
    }),
    // an empty suit of armour on a stand, blackened, a torn crimson sash
    armor: make(30, 58, (p) => {
      p.rect(13, 50, 4, 6, '#3b2416');
      p.rect(6, 54, 18, 3, '#5b3922');
      p.rect(10, 38, 4, 13, S[2]); p.rect(16, 38, 4, 13, S[3]);
      p.poly([[8, 28], [22, 28], [24, 40], [6, 40]], S[2]);
      p.round(8, 14, 14, 16, S[3], 3);
      p.rect(9, 15, 3, 12, S[4]);
      p.round(4, 14, 7, 6, S[3], 2); p.round(19, 14, 7, 6, S[3], 2);
      p.rect(4, 20, 4, 12, S[2]); p.rect(22, 20, 4, 12, S[2]);
      p.round(9, 2, 12, 13, S[3], 4);
      p.rect(10, 7, 10, 2, '#0b0a10');
      p.rect(10, 3, 3, 8, S[4]);
      p.line(9, 16, 21, 28, C[2], 2);
      p.line(20, 28, 18, 36, C[1], 2);
    }),
    // a torn crimson banner on a standing pole
    banner: make(26, 66, (p) => {
      p.rect(11, 4, 3, 60, '#3b2416');
      p.rect(11, 4, 1, 60, '#5b3922');
      p.rect(4, 6, 18, 2, '#3b2416');
      p.circle(12, 3, 2, G[3]);
      p.rect(5, 8, 16, 34, C[2]);
      p.rect(5, 8, 3, 34, C[1]);
      p.rect(18, 8, 3, 34, C[3]);
      p.rect(9, 18, 8, 4, G[2]);
      p.line(7, 30, 19, 14, C[0]);
      for (let i = 0; i < 16; i += 2) p.rect(5 + i, 42, 2, 2 + ((i * 7) % 5), C[i < 6 ? 1 : 2]);
    }),
    // a cluster of corrupted crystal pushing up through the floor (glows at runtime)
    crystal: make(30, 34, (p) => {
      p.poly([[4, 32], [8, 16], [12, 32]], V[2]);
      p.poly([[10, 32], [15, 2], [21, 32]], V[3]);
      p.poly([[15, 2], [21, 32], [17, 32]], V[2]);
      p.poly([[19, 32], [24, 14], [28, 32]], V[2]);
      p.line(14, 8, 13, 28, V[4]);
      p.line(8, 20, 7, 30, V[4]);
      p.rect(2, 31, 28, 3, '#1a1222');
    }),
    // a heap of rubble and a broken beam
    rubble: make(34, 18, (p) => {
      p.ellipse(17, 13, 15, 5, '#26222e');
      for (const [x, y, w, h, c] of [[4, 8, 8, 6, '#524c60'], [12, 4, 10, 8, '#6e687e'], [22, 8, 8, 6, '#3a3646'], [8, 11, 6, 4, '#6e687e']]) {
        p.rect(x, y, w, h, c);
        p.rect(x, y, w, 1, '#908aa0');
      }
      p.line(2, 6, 30, 12, '#5b3922', 2);
    }),
    // a hanging iron cage on a gibbet (something in it long ago)
    cage: make(34, 70, (p) => {
      p.rect(4, 4, 4, 64, '#3b2416');
      p.rect(4, 4, 24, 4, '#3b2416');
      p.rect(4, 64, 14, 4, '#26222e');
      p.line(24, 8, 24, 20, S[1]);
      p.round(16, 20, 16, 26, '#0e0c12', 5);
      for (let x = 17; x < 32; x += 4) p.rect(x, 20, 1, 26, S[3]);
      p.rect(16, 20, 16, 2, S[3]);
      p.rect(16, 44, 16, 2, S[3]);
      p.rect(20, 38, 6, 4, '#d8d0bc');   // a skull
      p.px(21, 39, '#140c18'); p.px(24, 39, '#140c18');
    }),
    // garden: a dark rose bush
    roseBush: make(30, 26, (p) => {
      const Gr = CASTLE_COLORS.hedge;
      const R = CASTLE_COLORS.rose;
      p.ellipse(15, 17, 13, 8, Gr[1]);
      for (const [x, y] of [[8, 14], [15, 10], [22, 14], [11, 19], [20, 19]]) { p.circle(x, y, 5, Gr[2]); p.circle(x - 1, y - 1, 3, Gr[3]); }
      for (const [x, y] of [[9, 11], [17, 8], [23, 13], [13, 17], [21, 18]]) { p.circle(x, y, 2, R[1]); p.px(x, y, R[2]); p.px(x - 1, y - 1, R[3]); }
    }),
    // garden: a clipped topiary cone in a stone pot
    topiary: make(26, 56, (p) => {
      const Gr = CASTLE_COLORS.hedge;
      p.rect(7, 44, 12, 10, '#524c60');
      p.rect(5, 42, 16, 3, '#6e687e');
      p.rect(12, 38, 2, 6, '#3b2416');
      p.poly([[13, 2], [23, 40], [3, 40]], Gr[2]);
      p.poly([[13, 2], [13, 40], [3, 40]], Gr[3]);
      for (let y = 10; y < 38; y += 6) p.line(13 - (y - 2) / 4, y, 13 + (y - 2) / 4, y + 2, Gr[1]);
    }),
    // garden: a weeping stone maiden on a plinth
    statue: make(28, 64, (p) => {
      const ST = ['#3a3646', '#524c60', '#6e687e', '#908aa0'];
      p.rect(4, 52, 20, 10, ST[1]);
      p.rect(4, 52, 20, 1, ST[3]);
      p.poly([[9, 52], [11, 24], [17, 24], [20, 52]], ST[2]);
      p.poly([[9, 52], [11, 24], [13, 24], [12, 52]], ST[3]);
      p.round(9, 12, 10, 12, ST[2], 4);
      p.rect(10, 13, 3, 8, ST[3]);
      p.line(12, 19, 12, 30, '#1e1a26');   // a dark tear streak
      p.line(16, 26, 20, 36, ST[1], 2);
      p.circle(20, 38, 2, CASTLE_COLORS.rose[1]);
    }),
  };
}
