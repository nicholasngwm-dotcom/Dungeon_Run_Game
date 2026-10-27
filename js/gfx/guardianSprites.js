// The Guardian (the Ancient Ruins' other boss): a tall figure of weathered rock held together by the
// ruins' magic. Teal crystals jut from its shoulders like spikes, bands of crystal glow round its
// waist, thighs and knees, a crystal heart blazes in its chest (the beam comes from there), and
// its legs end in floating rock shards - it never touches the ground. Moss grows on its head and
// shoulders. Front-facing, lit from the top-left, in the ruins' palette (RU, gfx/enemies/ruins.js).
// Its arena's art is here too: the power crystals it draws its magic from, crystal cover and
// shards, and the giant rocks lying about the room that come together to form it.

const GUARDIAN_SPRITE = { w: 112, h: 132, ax: 56, ay: 128 };   // anchor = the tips of its floating legs
const GUARDIAN_CORE = { x: 0, y: -78 };                        // the chest crystal, from the anchor (the beam's origin)
const GUARDIAN_EYES = [{ x: -4, y: -105 }, { x: 4, y: -105 }];
// the crystals that shed magic as it floats (from the anchor): shoulder spikes, waist band, knees
const GUARDIAN_CRYSTALS = [{ x: -36, y: -112 }, { x: 36, y: -112 }, { x: -14, y: -57 }, { x: 14, y: -57 }, { x: -11, y: -29 }, { x: 11, y: -29 }];

/**
 * pose.arms: 'down' (hanging, claws open; sway 0/1 lifts them a little), 'wide' (flung out to the
 * sides as the beam charges or a cloud is sent off) or 'up' (both fists raised over its head to slam).
 * pose.lit: the chest crystal blazing (charging / firing).
 */
function drawGuardian(p, pose) {
  const S = RU.stone;
  const M = RU.magic;
  const cx = 56;
  const sway = pose.sway || 0;

  // ---------- floating legs: crystal bands between rock segments, ending in shards ----------
  for (const s of [-1, 1]) {
    const lx = cx + s * 11;
    p.rect(lx - 7, 79, 14, 3, M[1]);                         // hip band
    p.rect(lx - 6, 79, 12, 1, M[3]);
    ruRock(p, lx, 89, 7, 8);                                  // thigh
    p.rect(lx - 6, 98, 12, 3, M[1]);                         // knee band
    p.rect(lx - 5, 98, 10, 1, M[3]);
    p.poly([[lx - 6, 102], [lx + 6, 102], [lx + 2 + s, 119], [lx - 2 + s, 119]], S[3]);   // shin, tapering
    p.poly([[lx - 6, 102], [lx - 1, 102], [lx - 1 + s, 119], [lx - 2 + s, 119]], S[4]);
    p.poly([[lx + 3, 102], [lx + 6, 102], [lx + 2 + s, 119], [lx + 1 + s, 119]], S[2]);
    p.poly([[lx - 2 + s * 2, 122], [lx + 2 + s * 2, 122], [lx + s * 2, 127]], S[3]);     // a shard floating under it
    p.px(lx - 1 + s * 2, 122, S[5]);
  }

  // ---------- waist: a rock girdle with a crystal belt ----------
  ruRock(p, cx, 74, 14, 6);
  p.rect(cx - 14, 69, 28, 3, M[2]);
  p.rect(cx - 13, 69, 26, 1, M[4]);

  // ---------- torso: a broad slab of rock, cracked, glyphs carved low on it ----------
  p.poly([[cx - 22, 36], [cx + 22, 36], [cx + 16, 67], [cx - 16, 67]], S[3]);
  p.poly([[cx - 22, 36], [cx - 8, 36], [cx - 11, 67], [cx - 16, 67]], S[4]);
  p.poly([[cx + 14, 36], [cx + 22, 36], [cx + 16, 67], [cx + 10, 67]], S[2]);
  p.rect(cx - 20, 36, 40, 2, S[5]);
  ruCrack(p, [[cx - 14, 42], [cx - 9, 48], [cx - 12, 56]]);
  ruCrack(p, [[cx + 15, 44], [cx + 10, 50], [cx + 13, 60]]);
  ruGlyph(p, cx - 10, 62);
  ruGlyph(p, cx + 10, 62);
  // the crystal heart in its socket
  p.circle(cx, 50, 9, S[1]);
  p.circle(cx, 50, 7, M[1]);
  p.circle(cx, 50, 6, pose.lit ? M[3] : M[2]);
  p.circle(cx - 1, 49, pose.lit ? 4 : 3, pose.lit ? M[4] : M[3]);
  p.rect(cx - 3, 46, 2, 2, M[5]);

  // ---------- arms: rock segments, crystal bracers, three-clawed hands ----------
  const arm = (s) => {
    const sh = [cx + s * 26, 44];
    const [el, hd] = {
      down: [[cx + s * 36, 64 - sway], [cx + s * 40, 84 - sway * 2]],
      wide: [[cx + s * 44, 44], [cx + s * 51, 30]],
      up: [[cx + s * 32, 22], [cx + s * 14, 8]],
    }[pose.arms];
    p.line(sh[0], sh[1], el[0], el[1], S[2], 8);              // upper arm
    p.line(sh[0], sh[1] - 1, el[0], el[1] - 1, S[3], 5);
    p.line(sh[0] - 1, sh[1] - 2, el[0] - 1, el[1] - 2, S[4], 2);
    ruRock(p, el[0], el[1], 5, 5);                            // elbow
    p.line(el[0], el[1], hd[0], hd[1], S[2], 7);              // forearm
    p.line(el[0], el[1] - 1, hd[0], hd[1] - 1, S[3], 4);
    const bx = lerp(el[0], hd[0], 0.62);
    const by = lerp(el[1], hd[1], 0.62);
    p.circle(bx, by, 4, M[1]);                                // crystal bracer
    p.circle(bx - 1, by - 1, 2, M[3]);
    ruRock(p, hd[0], hd[1], 6, 5);                            // hand
    const a = Math.atan2(hd[1] - el[1], hd[0] - el[0]);
    for (const da of [-0.55, 0, 0.55]) {                      // claws
      const ca = a + da;
      p.line(hd[0] + Math.cos(ca) * 4, hd[1] + Math.sin(ca) * 4, hd[0] + Math.cos(ca) * 10, hd[1] + Math.sin(ca) * 10, S[1], 2);
      p.px(Math.round(hd[0] + Math.cos(ca) * 10), Math.round(hd[1] + Math.sin(ca) * 10), S[5]);
    }
  };
  arm(-1);
  arm(1);

  // ---------- shoulders: heavy pauldrons, crystal spikes jutting up and out ----------
  for (const s of [-1, 1]) {
    const sx = cx + s * 26;
    p.poly([[cx + s * 20, 36], [cx + s * 30, 34], [cx + s * 40, 8]], M[1]);           // the big spike
    p.poly([[cx + s * 23, 35], [cx + s * 28, 34], [cx + s * 38, 11]], s < 0 ? M[3] : M[2]);
    p.line(cx + s * 25, 33, cx + s * 37, 12, M[4]);
    p.poly([[cx + s * 30, 39], [cx + s * 36, 37], [cx + s * 49, 22]], M[1]);          // a smaller one beside it
    p.poly([[cx + s * 31, 38], [cx + s * 34, 37], [cx + s * 46, 24]], M[2]);
    ruRock(p, sx, 40, 11, 8);
    p.rect(sx - 8, 34, 10, 1, S[5]);
  }
  ruMoss(p, cx - 33, 33, 8, 0);
  ruMoss(p, cx + 24, 34, 6);

  // ---------- head: a small craggy block, glowing eyes, a tuft of moss and a flower ----------
  ruRock(p, cx, 24, 9, 11);
  p.rect(cx - 7, 28, 14, 6, S[2]);                            // heavy jaw
  p.rect(cx - 7, 28, 14, 1, S[3]);
  p.rect(cx - 7, 20, 14, 1, S[1]);                            // brow
  for (const ex of [cx - 6, cx + 2]) {
    p.rect(ex, 22, 4, 2, M[3]);
    p.px(ex + 1, 22, M[5]);
  }
  ruMoss(p, cx - 5, 13, 8, 1);
}

// ---------- its arena: the crystals it draws its power from ----------

/** A crystal: a six-sided prism leaning `lean`, base at (x, y), h tall, w wide, lit on its left facet. */
function guardianCrystal(p, x, y, h, w, lean = 0) {
  const M = RU.magic;
  const tx = x + lean;
  const ty = y - h;
  p.poly([[x - w, y], [x - w, y - h * 0.7 + lean * 0.3], [tx, ty], [x + w, y - h * 0.7 - lean * 0.3], [x + w, y]], M[1]);   // shaded right
  p.poly([[x - w, y], [x - w, y - h * 0.7 + lean * 0.3], [tx, ty], [x, y - h * 0.62], [x, y]], M[2]);
  p.poly([[x - w, y], [x - w, y - h * 0.7 + lean * 0.3], [tx, ty], [x - w * 0.4, y - h * 0.6], [x - w * 0.4, y]], M[3]);   // lit left facet
  p.line(x - w * 0.4, y - 2, x - w * 0.4, y - h * 0.58, M[4]);
  p.px(Math.round(tx), Math.round(ty) + 1, M[5]);
  p.px(Math.round(x - w * 0.7), Math.round(y - h * 0.4), M[5]);
}

/** A power crystal: a towering crystal on a carved plinth, smaller crystals clustered at its foot. */
function drawPowerCrystal(p) {
  drawCrystalPlinth(p);
  // the crystals: a great one in the middle, smaller ones leaning out round it
  guardianCrystal(p, 13, 59, 18, 4, -5);
  guardianCrystal(p, 36, 59, 22, 4, 6);
  guardianCrystal(p, 24, 59, 56, 8, 1);
  guardianCrystal(p, 30, 60, 12, 3, 3);
  ruMoss(p, 6, 63, 8, 0);
  ruMoss(p, 36, 63, 6);
}

/** A power crystal the heroes have broken: its plinth, jagged dark stubs where the crystals snapped off, splinters about. */
function drawBrokenCrystal(p) {
  const M = RU.magic;
  drawCrystalPlinth(p);
  for (const [x, h, w] of [[14, 7, 4], [24, 13, 7], [34, 9, 4]]) {
    p.poly([[x - w, 59], [x - w + 1, 59 - h], [x - 1, 59 - h + 3], [x + 1, 59 - h - 1], [x + w - 1, 59 - h + 2], [x + w, 59]], M[0]);
    p.poly([[x - w, 59], [x - w + 1, 59 - h], [x - 1, 59 - h + 3], [x - 1, 59]], M[1]);
  }
  for (const [x, y] of [[6, 66], [40, 65], [19, 71], [31, 70]]) { p.px(x, y, M[2]); p.px(x + 1, y - 1, M[3]); }
  ruMoss(p, 6, 63, 8, 0);
}

/** The carved stone plinth a power crystal stands on. */
function drawCrystalPlinth(p) {
  const S = RU.stone;
  // the plinth: a stepped block of carved stone with glowing glyphs
  p.rect(4, 64, 40, 8, S[2]);
  p.rect(4, 64, 40, 2, S[4]);
  p.rect(4, 70, 40, 2, S[1]);
  p.rect(8, 58, 32, 7, S[3]);
  p.rect(8, 58, 32, 1, S[5]);
  ruGlyph(p, 14, 68);
  ruGlyph(p, 34, 68);
  ruGlyph(p, 24, 68, true);
}

/** Crystal cover: a mossy rock split open by a cluster of crystals growing out of it. */
function drawCrystalCover(p, v) {
  ruRock(p, 17, 36, 15, 7);
  if (v) {
    guardianCrystal(p, 10, 36, 20, 4, -4);
    guardianCrystal(p, 19, 36, 32, 6, 2);
    guardianCrystal(p, 27, 37, 16, 3, 5);
  } else {
    guardianCrystal(p, 22, 36, 26, 5, 4);
    guardianCrystal(p, 12, 37, 30, 5, -3);
    guardianCrystal(p, 28, 38, 11, 3, 6);
  }
  ruMoss(p, 3, 36, 8, v ? -1 : 2);
}

/** A few small crystals poking up through the floor. */
function drawCrystalShards(p) {
  guardianCrystal(p, 6, 13, 9, 2, -2);
  guardianCrystal(p, 13, 13, 13, 3, 1);
  guardianCrystal(p, 20, 13, 7, 2, 3);
}

/**
 * One of the giant rocks lying about its room, which rise and come together to form it: a big
 * weathered boulder with veins of crystal running through it, moss on top. v = 0-3 picks the shape.
 */
function drawGuardianRock(p, v) {
  const S = RU.stone;
  const M = RU.magic;
  const shapes = [
    () => { ruRock(p, 20, 18, 17, 13); ruRock(p, 11, 24, 8, 6); },
    () => { ruRock(p, 20, 19, 18, 11); ruRock(p, 29, 14, 8, 7); },
    () => { ruRock(p, 19, 17, 14, 14); },
    () => { ruRock(p, 21, 20, 18, 10); ruRock(p, 13, 13, 9, 7); },
  ];
  shapes[v % 4]();
  // crystal veins (the magic that will bind it) and a carved glyph
  const veins = [[[9, 16], [16, 21], [24, 19], [30, 25]], [[8, 22], [15, 17], [26, 21]], [[12, 10], [18, 18], [15, 26]], [[10, 20], [20, 23], [31, 18]]][v % 4];
  for (let i = 0; i + 1 < veins.length; i++) {
    p.line(veins[i][0], veins[i][1], veins[i + 1][0], veins[i + 1][1], S[0], 2);
    p.line(veins[i][0], veins[i][1], veins[i + 1][0], veins[i + 1][1], M[2]);
  }
  ruGlyph(p, [27, 12, 22, 26][v % 4], [13, 25, 22, 12][v % 4]);
  ruMoss(p, [8, 14, 10, 16][v % 4], [6, 8, 4, 9][v % 4], 10, v % 2 ? 1 : -1);
}

/** Builds Sprites.guardian: its frames (idle x2, charge, slam: { img, flash }), its arena's crystals and rocks. */
function buildGuardianSprites() {
  const G = GUARDIAN_SPRITE;
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  const frame = (pose) => {
    const img = make(G.w, G.h, (p) => drawGuardian(p, pose));
    return { img, flash: PixelArt.silhouette(img) };
  };
  Sprites.guardian = {
    idle: [frame({ arms: 'down', sway: 0 }), frame({ arms: 'down', sway: 1 })],
    charge: frame({ arms: 'wide', lit: true }),
    slam: frame({ arms: 'up' }),
    powerCrystal: make(48, 74, drawPowerCrystal),
    brokenCrystal: make(48, 74, drawBrokenCrystal),
    shards: make(26, 15, drawCrystalShards),
    rocks: [0, 1, 2, 3].map((v) => make(40, 34, (p) => drawGuardianRock(p, v))),
    // a rock thrown up by its spikes (small, for the eruptions)
    chunks: [0, 1, 2].map((v) => make(12, 11, (p) => ruRock(p, 6, 6, 4 + (v % 2), 4 - (v === 2 ? 1 : 0)))),
  };
  Sprites.cover.ruinCrystal = [0, 1].map((v) => make(34, 46, (p) => drawCrystalCover(p, v)));
}
