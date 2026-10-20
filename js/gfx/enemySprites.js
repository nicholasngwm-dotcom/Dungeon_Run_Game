// Enemy sprites that keep their own shapes (slimes, the tombstone, the mimic), drawn
// facing right in the heroes' style (ramps darkest-first, light from the top-left).

const ENEMY_ANCHOR = { x: 32, y: 50 };
const KNIGHT_ANCHOR = { x: 40, y: 66 };   // 80x80 sprite
const SLIME_BIG = { size: 56, ax: 28, ay: 46 };
const SLIME_SMALL = { size: 32, ax: 16, ay: 26 };

// The zombies, skeletons, spirits, casters and the undead knight are drawn in
// js/gfx/enemies/ (the heroes' cute style). Slimes, the tombstone and the mimic stay here.

/** 8-frame idle + walk in the heroes' poses (CUTE_POSES); frames.cute makes Enemy play them at the heroes' speed. */
function buildCuteEnemy(draw, size = 64) {
  const out = { cute: true };
  for (const [name, poses] of Object.entries(CUTE_POSES)) {
    out[name] = poses.map((P) => {
      const img = PixelArt.make(size, size, (p) => draw(p, P), OUTLINE, 0.5);
      return { img, flash: PixelArt.silhouette(img) };
    });
  }
  return out;
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
  // big round eyes with glints, rosy cheeks and a little smile (facing right, like the heroes)
  const es = small ? 3 : 4;
  const gap = small ? 2 : 3;
  const ey = cy - (small ? 2 : 3);
  const ex = cx + 1;
  for (const x of [ex, ex + es + gap]) {
    p.round(x, ey, es, es + 1, OUTLINE, 1);
    p.px(x, ey, '#ffffff');
    if (!small) p.px(x + 1, ey + 1, '#ffffff');
  }
  if (!small) {
    p.rect(ex - 2, ey + es + 1, 2, 1, '#e88a9a');
    p.rect(ex + es * 2 + gap + 1, ey + es + 1, 2, 1, '#e88a9a');
  }
  p.rect(ex + es, ey + es + 2, gap, 1, G[0]);
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
    zombie: buildCuteEnemy(drawZombie),
    skeleton: buildCuteEnemy(drawSkeleton),
    wraith: buildPoseFrames(drawWraith, 64, wraithPoses, 0.5),
    undeadKnight: buildCuteEnemy(drawUndeadKnight, 80),
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
