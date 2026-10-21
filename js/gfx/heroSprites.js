// Shared character-sprite parts: 64x64 pixel-art characters drawn facing
// right and lit from the top-left (used by enemies, NPCs and bosses; the
// playable heroes live in js/gfx/heroes/, one file each).
// Layout (in sprite pixels): head y9-20, torso y20-36, legs y36-59.
// Anchor point (the entity's x,y) is at (32, 50).

const Sprites = {};

const HERO_ANCHOR = { x: 32, y: 50 };

// Animation poses. bob moves the upper body, stride swings the legs
// (front foot forward when positive), liftF/liftB raise a foot.
const HERO_POSES = {
  idle: [{ bob: 0 }, { bob: 1 }],
  walk: [
    { bob: 0, stride: 3 },
    { bob: -1, stride: 0, liftB: 2 },
    { bob: 0, stride: -3 },
    { bob: -1, stride: 0, liftF: 2 },
  ],
};

// Colour ramps, darkest first.
const RAMP = {
  steel: ['#1f2029', '#383b48', '#585d6c', '#80869a', '#adb2c0', '#e4e7ee'],
  red: ['#2a0910', '#50131d', '#7c1f2a', '#a63036', '#cc5046'],
  leather: ['#22150e', '#3b2416', '#5b3922', '#7d532f', '#9c6c3e'],
  gold: ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'],
  skin: ['#6a3c30', '#b37158', '#e0a584', '#f7d3b6'],
};

// Shifts every point of a polygon down by dy (used for the idle bob).
const shift = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);

// ---------- shared body parts ----------

/**
 * One leg from the hip (row `top`) to the foot (row `floor`), slanting from
 * hipX to footX. ramp/boot are [dark, mid, light]; returns the leg's x at a row.
 */
function heroLeg(p, hipX, footX, lift, w, ramp, boot, bootTop, top = 36, floor = 58) {
  const bottom = floor - lift;
  const xAt = (y) => Math.round(hipX + ((footX - hipX) * (y - top)) / (bottom - top));
  for (let y = top; y <= bottom; y++) {
    const r = y >= bootTop - lift ? boot : ramp;
    const x = xAt(y);
    p.rect(x, y, w, 1, r[1]);
    p.px(x, y, r[2]);
    p.px(x + w - 1, y, r[0]);
  }
  // toe cap pointing forward
  const fx = xAt(bottom);
  p.rect(fx + 1, bottom - 1, w + 1, 2, boot[1]);
  p.rect(fx + 1, bottom - 1, w, 1, boot[2]);
  p.rect(fx, bottom, w + 2, 1, boot[0]);
  return xAt;
}

/** Back leg then front leg, following the pose. opts: backX, frontX, top, floor. */
function heroLegs(p, pose, w, back, front, bootTop, opts = {}) {
  const { backX = 27, frontX = 32, top = 36, floor = 58 } = opts;
  const s = pose.stride || 0;
  const xb = heroLeg(p, backX, backX - s, pose.liftB || 0, w, back.leg, back.boot, bootTop, top, floor);
  const xf = heroLeg(p, frontX, frontX + s, pose.liftF || 0, w, front.leg, front.boot, bootTop, top, floor);
  return { xb, xf };
}

/** Side-on face: skin block, eye, nose and mouth. */
function heroFace(p, b, skin, eye, opts = {}) {
  p.round(30, 11 + b, 9, 10, skin[2], 2);
  p.rect(30, 17 + b, 3, 3, skin[1]); // jaw shadow
  p.px(39, 16 + b, skin[2]);         // nose
  p.px(39, 17 + b, skin[1]);
  p.rect(36, 19 + b, 2, 1, opts.mouth || skin[1]);
  p.px(33, 13 + b, skin[3]);
  // eye: lash line, iris, glint
  p.rect(35, 14 + b, 3, 1, OUTLINE);
  p.rect(35, 15 + b, 2, opts.bigEyes ? 2 : 1, eye);
  p.px(36, 15 + b, '#ffffff');
}

// ---------- frame building ----------

/** Builds { idle: [frame], walk: [frame] } where frame = { img, flash }. */
function buildPoseFrames(drawFn, size, poses = HERO_POSES, tint = 0) {
  const out = {};
  for (const [name, list] of Object.entries(poses)) {
    out[name] = list.map((pose) => {
      const img = PixelArt.make(size, size, (p) => drawFn(p, pose), OUTLINE, tint);
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  return out;
}

/** The playable heroes, each drawn in its own file under js/gfx/heroes/. */
function buildHeroSprites() {
  Sprites.heroes = {
    warrior: buildCuteHero(drawKnight),
    ranger: buildCuteHero(drawArcher),
    mage: buildCuteHero(drawMage),
    rogue: buildCuteHero(drawRogue, rogueEyeGlint),
    priestess: buildCuteHero(drawPriestess, priestessHaloGlow),
    bard: buildCuteHero(drawBard),
  };
}
