// Clay Golem sprites: body, head, fists, rolled-up ball, chain link,
// plus its clay minions.
// Drawn with a 7-step clay ramp (darkest first), molten rune glow and moss,
// in the same top-left-lit style as the heroes.

const GOLEM_COLORS = {
  clay: '#c47a45', clayD: '#94552c', clayDD: '#6b3a1d', clayL: '#e3a066',
  crack: '#4a2412', moss: '#6f8f3c', mossD: '#4f6a2a', glow: '#ffd34a', hot: '#ff7a1a',
};

const GOLEM_BODY = { w: 132, h: 120, ax: 66, ay: 108 };
const GOLEM_HEAD = { w: 72, h: 60, ax: 36, ay: 30 };
const GOLEM_FIST = { w: 52, h: 48, ax: 24, ay: 24 };
const GOLEM_BALL = { r: 54, size: 116 };

const CLAY = ['#3a1c0c', '#5e3018', '#84461f', '#a95f30', '#c97b45', '#e3a066', '#f6c890'];
const MOSS = ['#2e4418', '#4f6a2a', '#6f8f3c', '#94b450'];
const EMBER = ['#7a2a10', '#c84a14', '#ff7a1a', '#ffd34a', '#fff6c8'];

/** Moss clump with a lit top and a couple of drips. */
function golemMoss(p, x, y, w) {
  p.rect(x, y, w, 3, MOSS[1]);
  p.rect(x + 1, y - 1, w - 2, 2, MOSS[2]);
  p.rect(x + 2, y - 1, Math.max(1, Math.floor(w / 3)), 1, MOSS[3]);
  p.rect(x + 2, y + 3, 1, 2, MOSS[1]);
  p.rect(x + w - 3, y + 3, 1, 3, MOSS[0]);
}

/** Crack with molten light leaking out of it. */
function golemCrack(p, pts, molten = true) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    p.line(x0, y0, x1, y1, CLAY[0], 2);
    if (molten) p.line(x0, y0, x1, y1, EMBER[1]);
    p.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, CLAY[5]); // lit upper lip
  }
}

function drawGolemBody(p, pose) {
  const L = pose.liftL || 0;
  const R = pose.liftR || 0;

  // stone pillar legs
  for (const [x, lift] of [[32, L], [74, R]]) {
    p.round(x, 84 - lift, 26, 28, CLAY[1], 5);
    p.round(x + 1, 84 - lift, 24, 25, CLAY[2], 5);
    p.rect(x + 3, 86 - lift, 6, 20, CLAY[3]);
    p.rect(x + 3, 86 - lift, 2, 16, CLAY[4]);
    p.rect(x + 1, 95 - lift, 24, 1, CLAY[0]);
    p.rect(x + 1, 96 - lift, 24, 1, CLAY[3]);
    p.rect(x - 2, 105 - lift, 30, 5, CLAY[1]);
    p.rect(x - 2, 105 - lift, 30, 1, CLAY[3]);
    for (let t = x + 4; t < x + 26; t += 7) p.rect(t, 106 - lift, 1, 4, CLAY[0]);
  }

  // torso: stacked shading, then bevelled plate seams
  p.ellipse(66, 62, 52, 36, CLAY[1]);
  p.ellipse(65, 60, 50, 33, CLAY[2]);
  p.ellipse(63, 56, 46, 28, CLAY[3]);
  p.ellipse(58, 50, 36, 20, CLAY[4]);
  p.ellipse(52, 42, 22, 8, CLAY[5]);
  p.ellipse(47, 39, 9, 2, CLAY[6]);
  p.dither(16, 74, 100, 6, CLAY[2], 0);
  p.dither(22, 50, 100, 4, CLAY[3], 1);
  for (let x = 20; x < 112; x++) {
    const y = 70 - Math.round(((x - 66) / 52) ** 2 * 8);
    p.px(x, y, CLAY[0]);
    p.px(x, y + 1, CLAY[4]);
  }
  p.line(40, 36, 46, 69, CLAY[1]);
  p.line(92, 36, 86, 68, CLAY[1]);

  // boulder shoulders
  for (const sx of [20, 112]) {
    p.circle(sx, 48, 16, CLAY[1]);
    p.circle(sx - 1, 46, 14, CLAY[2]);
    p.circle(sx - 3, 44, 10, CLAY[3]);
    p.circle(sx - 5, 41, 5, CLAY[4]);
    p.rect(sx - 8, 38, 4, 1, CLAY[5]);
    p.px(sx - 7, 37, CLAY[6]);
    golemMoss(p, sx - 7, 33, 10);
  }

  // glowing chest rune with a heat halo
  const rune = [[66, 47], [79, 62], [66, 77], [53, 62], [66, 47]];
  for (let i = 0; i < 4; i++) p.line(rune[i][0], rune[i][1], rune[i + 1][0], rune[i + 1][1], EMBER[0], 4);
  for (let i = 0; i < 4; i++) p.line(rune[i][0], rune[i][1], rune[i + 1][0], rune[i + 1][1], EMBER[3], 2);
  p.rect(62, 58, 8, 8, EMBER[1]);
  p.rect(63, 59, 6, 6, EMBER[2]);
  p.rect(64, 60, 4, 4, EMBER[3]);
  p.rect(65, 61, 2, 2, EMBER[4]);

  // molten cracks
  golemCrack(p, [[30, 52], [40, 64], [36, 74]]);
  golemCrack(p, [[96, 46], [90, 58], [98, 70]]);
  golemCrack(p, [[72, 82], [78, 90]], false);

  // moss on top, neck socket
  golemMoss(p, 44, 29, 14);
  golemMoss(p, 80, 31, 10);
  p.ellipse(66, 30, 18, 6, CLAY[1]);
  p.ellipse(66, 29, 14, 4, CLAY[0]);
  p.rect(58, 29, 16, 1, EMBER[0]);
}

function drawGolemHead(p, angry) {
  const eye = angry ? EMBER[2] : EMBER[3];
  p.round(8, 6, 56, 48, CLAY[1], 7);
  p.round(9, 6, 54, 45, CLAY[2], 7);
  p.round(11, 6, 50, 40, CLAY[3], 7);
  p.round(12, 7, 40, 12, CLAY[4], 5);
  p.rect(11, 12, 4, 26, CLAY[4]);
  p.rect(18, 9, 20, 2, CLAY[5]);
  p.px(19, 8, CLAY[6]);
  p.dither(10, 40, 54, 4, CLAY[2], 0);

  // brow ridge
  p.rect(12, 20, 48, 5, CLAY[2]);
  p.rect(12, 20, 48, 1, CLAY[4]);
  p.rect(12, 24, 48, 1, CLAY[0]);
  if (angry) {
    p.line(14, 22, 30, 25, CLAY[0], 2);
    p.line(42, 25, 58, 22, CLAY[0], 2);
  }

  // deep eye sockets with glowing eyes
  for (const ex of [17, 40]) {
    p.rect(ex, 25, 15, 8, CLAY[0]);
    p.rect(ex + 1, 26, 13, 6, EMBER[0]);
    p.rect(ex + 2, 27, 11, 4, eye);
    p.rect(ex + 4, 28, 4, 2, EMBER[4]);
  }

  // mouth full of stone teeth
  p.rect(20, 37, 32, 10, CLAY[0]);
  if (angry) {
    p.rect(22, 40, 28, 4, EMBER[2]);
    p.rect(26, 41, 20, 2, EMBER[3]);
  } else {
    p.rect(22, 40, 28, 4, EMBER[0]);
  }
  for (let x = 22; x < 50; x += 5) {
    p.rect(x, 37, 3, 3, CLAY[4]);
    p.px(x, 37, CLAY[5]);
    p.rect(x + 2, 44, 3, 3, CLAY[3]);
  }

  // seams, cracks and moss
  p.line(14, 34, 19, 46, CLAY[1]);
  p.line(58, 34, 54, 46, CLAY[1]);
  golemCrack(p, [[52, 8], [46, 17]]);
  golemCrack(p, [[16, 34], [13, 44]], false);
  golemMoss(p, 28, 4, 12);
}

function drawGolemFist(p) {
  // wrist (left) -> knuckles (right); the fist "points" along +x
  p.rect(1, 14, 10, 20, CLAY[1]);
  p.rect(2, 16, 8, 15, CLAY[2]);
  p.rect(2, 16, 8, 2, CLAY[4]);
  p.rect(5, 14, 2, 20, EMBER[1]);            // molten wrist band
  p.rect(5, 15, 1, 18, EMBER[3]);
  p.round(8, 5, 34, 38, CLAY[1], 7);
  p.round(9, 5, 32, 35, CLAY[2], 7);
  p.round(10, 6, 28, 30, CLAY[3], 6);
  p.round(12, 7, 18, 14, CLAY[4], 4);
  p.rect(14, 8, 8, 1, CLAY[5]);
  // knuckles
  for (let i = 0; i < 4; i++) {
    const y = 6 + i * 9;
    p.round(36, y, 13, 9, CLAY[1], 2);
    p.round(36, y, 12, 8, i === 0 ? CLAY[4] : CLAY[3], 2);
    p.rect(37, y + 1, 5, 1, i === 0 ? CLAY[6] : CLAY[5]);
    p.rect(37, y + 6, 11, 1, CLAY[2]);
  }
  for (let i = 1; i < 4; i++) {
    p.rect(26, 5 + i * 9, 14, 1, CLAY[0]);
    p.rect(26, 6 + i * 9, 14, 1, CLAY[4]);
  }
  // thumb
  p.round(14, 2, 20, 9, CLAY[2], 3);
  p.round(15, 2, 18, 7, CLAY[4], 3);
  p.rect(17, 3, 8, 1, CLAY[6]);
  golemCrack(p, [[16, 22], [22, 30]]);
}

function drawGolemBall(p) {
  const c = GOLEM_BALL.size / 2;
  const r = GOLEM_BALL.r;
  p.circle(c, c, r, CLAY[1]);
  p.circle(c - 1, c - 1, r - 3, CLAY[2]);
  p.circle(c - 3, c - 3, r - 10, CLAY[3]);
  p.circle(c - 8, c - 8, r - 24, CLAY[4]);
  p.ellipse(c - 16, c - 22, 14, 6, CLAY[5]);
  p.ellipse(c - 18, c - 24, 6, 2, CLAY[6]);
  // bevelled bands so rotation is visible
  p.line(c - r + 6, c, c + r - 6, c, CLAY[0], 3);
  p.line(c - r + 6, c - 2, c + r - 6, c - 2, CLAY[4]);
  p.line(c, c - r + 6, c, c + r - 6, CLAY[0], 3);
  p.line(c - 2, c - r + 6, c - 2, c + r - 6, CLAY[4]);
  // molten core
  p.circle(c, c, 10, CLAY[0]);
  p.circle(c, c, 7, EMBER[1]);
  p.circle(c, c, 5, EMBER[2]);
  p.circle(c - 1, c - 1, 2, EMBER[4]);
  golemCrack(p, [[c + 14, c - 30], [c + 28, c - 14]]);
  golemCrack(p, [[c - 30, c + 16], [c - 16, c + 32]]);
  golemMoss(p, c - 26, c - 40, 12);
}

/** Clay minion (64x64, ENEMY_ANCHOR). pose.raised = fists up for the smash. */
function drawClayMinion(p, pose) {
  const b = pose.bob;
  const s = pose.stride || 0;
  // stubby legs
  for (const [x, lift, c] of [[25 - s, pose.liftB || 0, CLAY[1]], [33 + s, pose.liftF || 0, CLAY[2]]]) {
    p.round(x, 47, 8, 12 - lift, c, 2);
    p.rect(x + 1, 48, 2, 7 - lift, CLAY[3]);
    p.rect(x, 57 - lift, 10, 2, CLAY[1]);
  }
  const arm = (x, y, w, h, c) => { p.round(x, y + b, w, h, c, 2); p.rect(x + 1, y + 1 + b, 1, h - 3, CLAY[4]); };
  if (!pose.raised) arm(19, 34, 6, 12, CLAY[1]);
  else arm(20, 14, 8, 17, CLAY[1]);
  // boulder body with a small glowing rune
  p.ellipse(32, 40 + b, 13, 11, CLAY[1]);
  p.ellipse(31, 39 + b, 12, 10, CLAY[2]);
  p.ellipse(30, 37 + b, 9, 7, CLAY[3]);
  p.ellipse(28, 34 + b, 5, 3, CLAY[4]);
  p.px(26, 33 + b, CLAY[5]);
  p.rect(33, 39 + b, 3, 3, EMBER[1]);
  p.px(34, 40 + b, EMBER[3]);
  golemCrack(p, [[24, 40 + b], [27, 46 + b]], false);
  // head
  p.round(29, 22 + b, 12, 10, CLAY[2], 3);
  p.rect(30, 23 + b, 6, 2, CLAY[4]);
  p.rect(33, 25 + b, 8, 1, CLAY[0]);
  p.rect(35, 26 + b, 2, 2, EMBER[3]);
  p.rect(38, 26 + b, 2, 1, EMBER[2]);
  p.rect(35, 29 + b, 5, 1, CLAY[0]);
  golemMoss(p, 30, 22 + b, 6);
  // fists: hanging, or raised overhead
  if (!pose.raised) {
    p.round(18, 44 + b, 8, 7, CLAY[2], 2);
    arm(40, 33, 6, 12, CLAY[2]);
    p.round(39, 43 + b, 9, 8, CLAY[3], 2);
    p.rect(40, 43 + b, 6, 1, CLAY[5]);
  } else {
    p.round(17, 4 + b, 13, 11, CLAY[2], 3);
    p.rect(19, 5 + b, 6, 1, CLAY[4]);
    arm(36, 12, 8, 18, CLAY[2]);
    p.round(34, 2 + b, 14, 12, CLAY[3], 3);
    p.rect(36, 3 + b, 8, 1, CLAY[5]);
    p.px(40, 8 + b, EMBER[2]);
    p.px(23, 9 + b, EMBER[1]);
  }
}

function buildBossSprites() {
  // the golem's minions are regular enemies; they share the clay palette above
  Sprites.enemies.clayMinion = buildPoseFrames(drawClayMinion, 64, { ...HERO_POSES, smash: [{ bob: 0, raised: true }] }, 0.5);

  const bodyPoses = { idle: [{}], walk: [{ liftL: 6 }, {}, { liftR: 6 }, {}] };
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  const body = {};
  for (const [name, list] of Object.entries(bodyPoses)) {
    body[name] = list.map((pose) => {
      const img = make(GOLEM_BODY.w, GOLEM_BODY.h, (p) => drawGolemBody(p, pose));
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  const frame = (w, h, fn) => {
    const img = make(w, h, fn);
    return { img, flash: PixelArt.silhouette(img) };
  };
  Sprites.golem = {
    body,
    head: frame(GOLEM_HEAD.w, GOLEM_HEAD.h, (p) => drawGolemHead(p, false)),
    headAngry: frame(GOLEM_HEAD.w, GOLEM_HEAD.h, (p) => drawGolemHead(p, true)),
    fist: frame(GOLEM_FIST.w, GOLEM_FIST.h, drawGolemFist),
    ball: frame(GOLEM_BALL.size, GOLEM_BALL.size, drawGolemBall),
    link: frame(10, 10, (p) => {
      p.round(1, 1, 8, 8, CLAY[2], 2);
      p.rect(3, 3, 4, 4, CLAY[0]);
      p.rect(2, 2, 3, 1, CLAY[5]);
      p.px(2, 3, CLAY[4]);
    }),
  };
}
