// Shared parts for the hero sprites in js/gfx/heroes/: the cute style
// (big round heads, big eyes, slim striped or armoured legs), 8-frame idle
// and walk poses, and the frame builder.
// Layout matches the rest of the game: 64x64, facing right, lit from the
// top-left, feet on row 58, anchor HERO_ANCHOR (32, 50).

const CUTE = {
  blush: '#d87a74',
  mouth: '#a8505c',
  brass: ['#3e2a10', '#7a5a24', '#b08a3e', '#e0c47a'],   // antique gold, darkest first
  fps: { idle: 8, walk: 18 },                             // frames per second of each animation
};

/**
 * Pose parameters per frame:
 *  b  body bob (+ = down)     hb hair/cloth bob, a frame behind the body
 *  s  stride (front foot forward when +)   lb/lf lift the back/front foot
 *  sw hair sway (x)           cf cape flutter (x)   hs hat/plume tip sway (x)
 *  ba back arm swing (x)      eyes 'open' | 'blink'
 */
const CUTE_POSES = (() => {
  const pose = (o) => ({ b: 0, hb: 0, s: 0, lb: 0, lf: 0, sw: 0, cf: 0, hs: 0, ba: 0, eyes: 'open', ...o });
  const lag = (arr, i) => arr[(i + arr.length - 1) % arr.length];
  // idle: soft breathing, hair and cloth a frame behind, one blink
  const ib = [0, 0, 1, 1, 1, 1, 0, 0];
  const idle = ib.map((b, i) => pose({
    b, hb: lag(ib, i),
    sw: [0, 0, 0, -1, -1, -1, 0, 0][i],
    cf: [0, 0, 0, -1, -1, -1, -1, 0][i],
    hs: [0, 0, 0, 0, -1, -1, -1, 0][i],
    eyes: i === 6 ? 'blink' : 'open',
  }));
  // walk: 8-frame stride with passing poses, hair and capes trailing
  const wb = [1, 0, -1, 0, 1, 0, -1, 0];
  const stride = [3, 2, 0, -2, -3, -2, 0, 2];
  const walk = wb.map((b, i) => pose({
    b, hb: lag(wb, i), s: stride[i],
    lb: [0, 1, 2, 1, 0, 0, 0, 0][i],
    lf: [0, 0, 0, 0, 0, 1, 2, 1][i],
    sw: [-1, -2, -2, -1, -1, -2, -2, -1][i],
    cf: [-1, -2, -3, -2, -1, -2, -3, -2][i],
    hs: [-1, -1, -2, -1, -1, -1, -2, -1][i],
    ba: -Math.round(stride[i] / 2),
  }));
  return { idle, walk };
})();

/**
 * Builds { idle: [frame x8], walk: [frame x8] } where frame = { img, flash }.
 * draw(p, P) paints one pose; post(p, P) runs after the outline (soft glows).
 */
function buildCuteHero(draw, post) {
  const out = {};
  for (const [name, poses] of Object.entries(CUTE_POSES)) {
    out[name] = poses.map((P) => {
      const p = new PixelArt(64, 64);
      draw(p, P);
      p.outline(OUTLINE, 0.5);
      if (post) post(p, P);
      return { img: p.canvas, flash: PixelArt.silhouette(p.canvas) };
    });
  }
  return out;
}

/** The frame a hero (or anything using hero frames) shows at `time`. */
function heroFrame(frames, moving, time) {
  const list = moving ? frames.walk : frames.idle;
  return list[Math.floor(time * CUTE.fps[moving ? 'walk' : 'idle']) % list.length];
}

/** Shifts polygon points by (dx, dy). */
const shiftXY = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);

/**
 * One slim leg from the hip (row 42) to the floor (58). legR / bootR are
 * [dark, mid, light]; legR may be a function of the row (for stripes).
 * Returns the leg's x at a given row.
 */
function cuteLeg(p, hipX, footX, lift, legR, bootR, bootTop, cuff) {
  const top = 42;
  const bottom = 58 - lift;
  const bt = bootTop - lift;
  const xAt = (y) => Math.round(hipX + ((footX - hipX) * (y - top)) / (bottom - top));
  for (let y = top; y <= bottom; y++) {
    const r = y >= bt ? bootR : typeof legR === 'function' ? legR(y - top) : legR;
    const x = xAt(y);
    p.rect(x, y, 3, 1, r[1]);
    p.px(x, y, r[2]);
    p.px(x + 2, y, r[0]);
  }
  if (cuff) p.rect(xAt(bt) - 1, bt, 5, 1, cuff);
  const fx = xAt(bottom);
  p.rect(fx + 1, bottom - 1, 3, 2, bootR[1]);
  p.rect(fx + 1, bottom - 1, 2, 1, bootR[2]);
  p.rect(fx, bottom, 4, 1, bootR[0]);
  return xAt;
}

/**
 * Big round face with big eyes. iris = ramp darkest first.
 * opts.mask hides blush and mouth; opts.male draws narrower, sharper eyes.
 */
function cuteFace(p, P, iris, opts = {}) {
  const b = P.b;
  const Sk = RAMP.skin;
  const I = iris;
  p.round(29, 12 + b, 11, 12, Sk[2], 3);
  p.rect(29, 19 + b, 2, 3, Sk[1]);
  p.px(39, 20 + b, Sk[1]);
  if (P.eyes === 'blink') {
    p.rect(30, 19 + b, 3, 1, OUTLINE);
    p.rect(35, 19 + b, 4, 1, OUTLINE);
  } else if (opts.male) {
    p.rect(30, 17 + b, 3, 1, OUTLINE);
    p.px(31, 18 + b, '#ffffff'); p.px(32, 18 + b, I[0]);
    p.px(31, 19 + b, I[2]); p.px(32, 19 + b, I[3]);
    p.rect(35, 17 + b, 4, 1, OUTLINE);
    p.px(39, 16 + b, OUTLINE);
    p.px(36, 18 + b, '#ffffff'); p.px(37, 18 + b, I[0]); p.px(38, 18 + b, I[1]);
    p.px(36, 19 + b, I[2]); p.px(37, 19 + b, I[3]); p.px(38, 19 + b, I[2]);
    p.rect(31, 20 + b, 2, 1, Sk[1]);
    p.rect(36, 20 + b, 3, 1, Sk[1]);
  } else {
    p.rect(30, 17 + b, 3, 1, OUTLINE);
    p.px(31, 18 + b, '#ffffff'); p.px(32, 18 + b, I[0]);
    p.px(31, 19 + b, I[1]); p.px(32, 19 + b, I[0]);
    p.px(31, 20 + b, I[2]); p.px(32, 20 + b, I[3]);
    p.rect(35, 17 + b, 4, 1, OUTLINE);
    p.px(36, 18 + b, '#ffffff'); p.px(37, 18 + b, I[0]); p.px(38, 18 + b, I[0]);
    p.px(36, 19 + b, I[1]); p.px(37, 19 + b, I[1]); p.px(38, 19 + b, I[0]);
    p.px(36, 20 + b, I[2]); p.px(37, 20 + b, I[3]); p.px(38, 20 + b, I[2]);
  }
  if (!opts.mask) {
    p.rect(30, 21 + b, 2, 1, CUTE.blush);
    p.rect(37, 21 + b, 2, 1, CUTE.blush);
    p.rect(34, 22 + b, 2, 1, CUTE.mouth);
  }
}

/** Jagged fringe over the forehead. hair = ramp darkest first (4+ colours). */
function cuteBangs(p, P, hair) {
  const b = P.b;
  p.rect(29, 12 + b, 11, 3, hair[2]);
  p.rect(30, 12 + b, 8, 1, hair[3]);
  for (const [x, len] of [[29, 3], [30, 2], [31, 1], [32, 2], [33, 3], [34, 1], [35, 1], [36, 2], [37, 1], [38, 2], [39, 3]]) {
    p.rect(x, 15 + b, 1, len, hair[2]);
  }
  p.px(33, 17 + b, hair[1]);
}

/** Hood (or veil) around the head, open at the face. R = ramp darkest first (4+ colours). */
function cuteHood(p, P, R) {
  const b = P.b;
  p.poly(shift([[26, 23], [26, 13], [28, 9], [32, 7], [37, 8], [40, 11], [41, 14],
    [38, 12], [33, 12], [30, 13], [29, 23]], b), R[2]);
  p.line(30, 14 + b, 29, 22 + b, R[0]);
  p.line(31, 12 + b, 38, 12 + b, R[1]);
  p.line(28, 10 + b, 33, 8 + b, R[3]);
  p.px(30, 9 + b, R[4] || R[3]);
  p.line(27, 14 + b, 27, 21 + b, R[1]);
}

/** Soft glow painted only behind the sprite (transparent pixels), after the outline. */
function cuteGlow(p, cx, cy, rx, ry, rgb, alpha) {
  const ctx = p.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d > 1) continue;
      ctx.fillStyle = `rgba(${rgb}, ${(alpha * (1 - d)).toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}
