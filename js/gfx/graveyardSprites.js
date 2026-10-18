// Graveyard enemy sprites (dungeon runs), drawn facing right in the same
// style as enemySprites.js. Several reuse the zombie / skeleton bodies and
// add gear on top; the robed casters share drawRobed(). Weapons that aim
// (sword, scythe, guns) are drawn at runtime by the enemy, not baked in.

const SKULL_ANCHOR = { x: 12, y: 18 };    // 24x24 flying skull

/** Long robe flaring to the floor with a hood and a face; used by the casters and the reaper. */
function drawRobed(p, pose, R, face, opts = {}) {
  const b = pose.bob;
  const hem = Math.round((pose.stride || 0) / 2);
  // robe body
  p.poly(shift([[25, 21], [39, 21], [41, 33]], b).concat([[44 + hem, 57], [21 + hem, 57]], shift([[23, 33]], b)), R[2]);
  p.poly(shift([[25, 21], [29, 21]], b).concat([[26 + hem, 57], [21 + hem, 57]], shift([[23, 33]], b)), R[3]);
  p.poly(shift([[37, 28], [41, 33]], b).concat([[44 + hem, 57], [39 + hem, 57]]), R[1]);
  p.line(33, 30 + b, 33 + hem, 56, R[1]);
  for (let x = 22; x < 44; x += 4) p.px(x + hem, 57, R[0]);   // ragged hem
  if (opts.trim) {
    p.rect(21 + hem, 55, 23, 1, opts.trim);
    p.rect(26, 33 + b, 13, 2, opts.trim);
  }
  // sleeve reaching forward
  p.poly(shift([[35, 23], [40, 22], [44, 29], [45, 34], [40, 35], [37, 29]], b), R[2]);
  p.poly(shift([[40, 29], [45, 34], [40, 35]], b), R[1]);
  if (opts.hand) p.rect(41, 34 + b, 3, 3, opts.hand);
  // hood
  p.poly(shift([[26, 22], [25, 12], [28, 7], [34, 6], [39, 8], [41, 13], [41, 21]], b), R[2]);
  p.poly(shift([[26, 22], [25, 12], [28, 7], [31, 7], [29, 13], [29, 21]], b), R[3]);
  p.line(34, 6 + b, 40, 9 + b, R[4]);
  // shadowed opening and face
  p.round(31, 10 + b, 9, 11, R[0], 2);
  face(p, b);
}

/** Bone-white skull with glowing eyes, inside a hood (x0, y0 = top-left of the face). */
function hoodSkull(eye) {
  return (p, b) => {
    p.round(32, 11 + b, 7, 8, '#d8d0bc', 2);
    p.rect(32, 17 + b, 6, 2, '#b5ad96');
    p.rect(34, 13 + b, 2, 2, '#140c14');
    p.rect(37, 13 + b, 2, 2, '#140c14');
    p.px(34, 13 + b, eye);
    p.px(37, 13 + b, eye);
    p.rect(34, 18 + b, 4, 1, '#140c14');
  };
}

// ---------- reworked zombies and skeletons ----------

function drawBletcher(p, pose) {
  drawZombie(p, pose);
  const b = pose.bob;
  // swollen, blistered belly
  p.ellipse(32, 31 + b, 10, 8, '#6a8250');
  p.ellipse(31, 30 + b, 8, 6, '#8faa6c');
  p.ellipse(29, 28 + b, 3, 2, '#b4cc90');
  for (const [x, y] of [[35, 33], [27, 34], [37, 28]]) {
    p.px(x, y + b, '#c8e070');
    p.px(x + 1, y + b, '#4a5e36');
  }
  // green drool
  p.rect(39, 22 + b, 2, 4, '#9cf06a');
  p.px(40, 26 + b, '#6ac040');
}

function drawSkeletonWarrior(p, pose) {
  drawSkeleton(p, pose);
  const b = pose.bob;
  // dented iron helmet
  p.round(30, 8 + b, 11, 6, '#585d6c', 2);
  p.rect(31, 8 + b, 8, 1, '#80869a');
  p.rect(30, 13 + b, 11, 1, '#383b48');
  p.rect(39, 10 + b, 2, 6, '#383b48');
  // rusty chest plate
  p.rect(27, 23 + b, 10, 8, '#6a4a3a');
  p.rect(27, 23 + b, 10, 1, '#8a6a4a');
  p.rect(31, 24 + b, 1, 7, '#3a2418');
}

function drawBomber(p, pose) {
  drawSkeleton(p, pose);
  const b = pose.bob;
  // bandolier
  p.line(27, 22 + b, 37, 33 + b, '#5b3922');
  for (let i = 0; i < 4; i++) p.rect(28 + i * 2.5, 23 + b + i * 3, 2, 2, '#c8a040');
}

function drawCandlehead(p, pose) {
  drawSkeleton(p, pose);
  const b = pose.bob;
  // a fat candle where the skull should be, wax dripping down, soul flame on top
  p.rect(30, 6 + b, 10, 14, '#e8e0c8');
  p.rect(30, 6 + b, 3, 14, '#fffaf0');
  p.rect(38, 7 + b, 2, 13, '#b5ad96');
  p.rect(33, 18 + b, 2, 4, '#e8e0c8');
  p.rect(37, 17 + b, 2, 3, '#e8e0c8');
  p.rect(33, 11 + b, 2, 2, '#140c14');
  p.rect(36, 11 + b, 2, 2, '#140c14');
  p.px(34, 1 + b, '#ffffff');
  p.poly(shift([[32, 6], [35, -1], [38, 6]], b), '#6ad8ff');
  p.poly(shift([[34, 6], [35, 2], [36, 6]], b), '#e6f6ff');
}

function drawZombieSoldier(p, pose) {
  drawZombie(p, pose);
  const b = pose.bob;
  // army helmet
  p.round(29, 9 + b, 13, 6, '#3e4a2a', 2);
  p.rect(28, 13 + b, 15, 2, '#2c3420');
  p.rect(31, 9 + b, 6, 1, '#5a6a3e');
  // flak vest
  p.poly(shift([[25, 23], [37, 21], [39, 30], [37, 36], [26, 36], [24, 30]], b), '#4a5638');
  p.rect(26, 26 + b, 10, 1, '#2c3420');
  p.rect(26, 31 + b, 10, 1, '#2c3420');
  p.rect(27, 24 + b, 3, 3, '#6a7a4a');
}

// ---------- robed casters ----------

function drawNecromancer(p, pose) {
  const R = ['#0e0816', '#22143a', '#3a2260', '#563890', '#7a58c0'];
  drawRobed(p, pose, R, hoodSkull('#9cf06a'), { trim: '#9cf06a', hand: '#d8d0bc' });
}

function drawSkeletonSorcerer(p, pose) {
  const R = ['#3a2e1e', '#6a5a3a', '#a08c6a', '#cdb994', '#efe0bc'];
  drawRobed(p, pose, R, hoodSkull('#ff4a3a'), { trim: '#c0302a', hand: '#d8d0bc' });
  const b = pose.bob;
  // bone crown on the hood
  for (let i = 0; i < 4; i++) p.poly(shift([[27 + i * 3, 8], [28 + i * 3, 3], [29 + i * 3, 8]], b), '#ebe5d3');
}

function drawReaper(p, pose) {
  const R = ['#06030a', '#120c1a', '#1e1628', '#2e2440', '#463a5c'];
  drawRobed(p, pose, R, (pp, b) => {
    // nothing but two cold eyes in the dark
    pp.rect(34, 13 + b, 2, 2, '#c8e8ff');
    pp.rect(37, 13 + b, 2, 2, '#c8e8ff');
  }, { hand: '#cfc7e8' });
}

function drawShadowalker(p, pose) {
  const b = pose.bob;
  const D = ['#06040c', '#100c1a', '#1c1628', '#2c2440', '#3e345a'];
  // thin legs in wraps
  heroLegs(p, pose, 4,
    { leg: [D[0], D[1], D[2]], boot: [D[0], D[1], D[2]] },
    { leg: [D[1], D[2], D[3]], boot: [D[1], D[2], D[3]] }, 52);
  // short ragged cloak
  p.poly(shift([[24, 20], [40, 20], [42, 30], [40, 40], [24, 40], [22, 30]], b), D[2]);
  p.rect(24, 21 + b, 4, 18, D[3]);
  for (let x = 24; x < 40; x += 3) p.px(x, 40 + b, D[1]);
  // hood with violet eyes and a scarf over the mouth
  p.poly(shift([[27, 21], [26, 12], [29, 8], [35, 7], [40, 10], [41, 16], [40, 21]], b), D[2]);
  p.round(31, 11 + b, 9, 9, D[0], 2);
  p.rect(34, 13 + b, 2, 1, '#c07aff');
  p.rect(37, 13 + b, 2, 1, '#c07aff');
  p.rect(30, 17 + b, 11, 3, '#3a1a4a');
  // arm with the dagger hand
  p.rect(37, 24 + b, 4, 8, D[3]);
  p.rect(38, 32 + b, 3, 2, '#9a8ab0');
}

/** Small flying skull trailing green fire. */
function drawFlyingSkull(p, pose) {
  const f = pose.flame;
  p.poly([[2, 12], [8, 8 + f], [8, 16 - f]], '#6ac040');
  p.poly([[4, 12], [9, 10], [9, 14]], '#c8f0a0');
  p.round(8, 5, 12, 12, '#d8d0bc', 3);
  p.rect(9, 6, 8, 2, '#fffaf0');
  p.rect(13, 9, 3, 3, '#140c14');
  p.rect(17, 9, 2, 3, '#140c14');
  p.px(14, 10, '#9cf06a');
  p.rect(11, 15, 8, 3, '#b5ad96');
  for (let x = 12; x < 19; x += 2) p.px(x, 16, '#140c14');
}

function buildGraveyardSprites() {
  Object.assign(Sprites.enemies, {
    bletcher: buildPoseFrames(drawBletcher, 64, HERO_POSES, 0.5),
    skeletonWarrior: buildPoseFrames(drawSkeletonWarrior, 64, HERO_POSES, 0.5),
    bomber: buildPoseFrames(drawBomber, 64, HERO_POSES, 0.5),
    candlehead: buildPoseFrames(drawCandlehead, 64, HERO_POSES, 0.5),
    shadowalker: buildPoseFrames(drawShadowalker, 64, HERO_POSES, 0.5),
    necromancer: buildPoseFrames(drawNecromancer, 64, HERO_POSES, 0.5),
    reaper: buildPoseFrames(drawReaper, 64, HERO_POSES, 0.5),
    minigunner: buildPoseFrames(drawSkeleton, 64, HERO_POSES, 0.5),   // drawn scaled up
    zombieSoldier: buildPoseFrames(drawZombieSoldier, 64, HERO_POSES, 0.5),
    skeletonSorcerer: buildPoseFrames(drawSkeletonSorcerer, 64, HERO_POSES, 0.5),
    flyingSkull: buildPoseFrames(drawFlyingSkull, 24, { idle: [{ flame: 0 }, { flame: 2 }] }, 0.5),
  });

  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  Object.assign(Sprites.projectiles, {
    spit: sprite(14, 14, (p) => {
      p.circle(7, 7, 5, '#4a8a2a');
      p.circle(7, 7, 4, '#7ac040');
      p.circle(6, 6, 2, '#c8f0a0');
    }),
    soul: sprite(16, 12, (p) => {
      p.poly([[1, 6], [7, 2], [7, 10]], '#4a8aff');
      p.circle(10, 6, 4, '#6ad8ff');
      p.circle(10, 6, 2, '#e6f6ff');
    }),
    bullet: sprite(10, 6, (p) => {
      p.rect(1, 1, 7, 4, '#c8a040');
      p.rect(6, 1, 3, 4, '#f0d070');
      p.rect(1, 1, 7, 1, '#fff0b0');
    }),
    heavyBullet: sprite(12, 10, (p) => {
      p.circle(6, 5, 4, '#a03a2a');
      p.circle(6, 5, 3, '#ff8a4a');
      p.px(5, 4, '#ffe0a0');
    }),
    // crescent wave of darkness (travels right)
    darkWave: sprite(26, 48, (p) => {
      for (let i = 0; i < 3; i++) {
        const c = ['#1e1628', '#463a5c', '#9a7ac0'][i];
        for (let y = 2; y < 46; y++) {
          const t = (y - 24) / 22;
          const x = 4 + i * 4 + Math.round(14 * (1 - t * t));
          p.rect(x, y, 4 - i, 1, c);
        }
      }
    }),
  });
}
