// The Ancient Ruins' sprites: the guardians' bodies (js/gfx/enemies/ruins.js) built into
// frames, the parts drawn at runtime (the turret's head, the clay heads, the rotator's guns),
// their weapons and projectiles, the ruins' cover (mossy rocks, broken columns, a toppled
// clay statue, carved walls and an altar block) and its set dressing (RuinsDecor).

const SLIME_CLAY = { size: 44, ax: 22, ay: 34 };
const SLIME_CLAY_TINY = { size: 28, ax: 14, ay: 21 };
const SHELL_ANCHOR = { x: 36, y: 50 };
const PILLAR_ANCHOR = { x: 28, y: 60 };
const OBELISK_ANCHOR = { x: 20, y: 72 };
const TOTEM_ANCHOR = { x: 20, y: 60 };

function buildRuinsSprites() {
  const frame = (img) => ({ img, flash: PixelArt.silhouette(img) });
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  const slime = (cfg, tiny) => {
    const base = tiny ? { rx: 8, ry: 6 } : { rx: 15, ry: 11 };
    const shapes = {
      idle: [base, { rx: base.rx + 1, ry: base.ry - 1 }],
      squash: [{ rx: Math.round(base.rx * 1.2), ry: Math.round(base.ry * 0.7) }],
      stretch: [{ rx: Math.round(base.rx * 0.82), ry: Math.round(base.ry * 1.3) }],
    };
    const out = {};
    for (const [name, list] of Object.entries(shapes)) out[name] = list.map((s) => frame(make(cfg.size, cfg.size, (p) => drawClaySlime(p, cfg.size, s.rx, s.ry, tiny))));
    return out;
  };
  const one = (w, h, fn) => ({ idle: [frame(make(w, h, fn))] });

  Object.assign(Sprites.enemies, {
    rockmite: buildPoseFrames(drawRockmite, 64, { ...HERO_POSES, throw: [{ bob: 0, throw: true }] }, 0.5),
    rockDisc: one(40, 40, drawRockDisc),
    clayGuard: buildCuteEnemy((p, P) => drawClayGuard(p, P, true)),
    clayGuardBroken: buildCuteEnemy((p, P) => drawClayGuard(p, P, false)),
    claySlime: slime(SLIME_CLAY, false),
    claySlimeTiny: slime(SLIME_CLAY_TINY, true),
    clayBud: buildPoseFrames(drawClayBud, 64, { ...HERO_POSES, smash: [{ bob: 0, raised: true }] }, 0.5),
    rockShell: buildPoseFrames(drawRockShell, 72, { idle: [{ step: 0 }, { step: 0, bob: 1 }], walk: [{ step: 0 }, { step: 1 }, { step: 0, bob: 1 }, { step: 1, bob: 1 }], cast: [{ step: 0, raised: true }] }, 0.5),
    // the bowler carries its boulder about (idle, walk); empty-handed once it's rolled it, until it raises another
    rockBowler: buildPoseFrames(drawRockBowler, 64, {
      idle: HERO_POSES.idle.map((q) => ({ ...q, carry: true })), walk: HERO_POSES.walk.map((q) => ({ ...q, carry: true })),
      idleEmpty: HERO_POSES.idle, walkEmpty: HERO_POSES.walk, lift: [{ bob: 0, lift: true }],
    }, 0.5),
    rockWizard: buildCuteEnemy(drawRockWizard),
    ruinedTurret: one(64, 64, drawTurretBase),
    stonePillar: { idle: [frame(make(56, 72, (p) => drawStonePillar(p, { squash: 0 })))], squash: [frame(make(56, 72, (p) => drawStonePillar(p, { squash: 4 })))] },
    rockGolem: buildPoseFrames(drawRockGolem, 80, { ...HERO_POSES, slam: [{ bob: 0, raised: true }] }, 0.5),
    ancientPortal: one(60, 44, drawAncientPortal),
    magicPillar: one(40, 84, drawMagicPillar),
    lightTotem: one(40, 72, drawLightTotem),
    ancientLight: one(64, 64, drawAncientLightPortrait),
    ancientRotator: buildPoseFrames(drawRotatorBody, 64, { idle: [{ bob: 0 }, { bob: 1 }], walk: [{ bob: 0 }, { bob: -1 }, { bob: 0 }, { bob: 1 }] }, 0.5),
  });

  Sprites.ruins = {
    turretHead: make(34, 34, drawTurretHead),
    rotatorGun: make(22, 12, drawRotatorGun),
    lightMask: make(16, 16, (p) => {
      // the stone mask the ancient light wears: a calm carved face
      const S = RU.sand;
      p.round(1, 1, 14, 14, S[3], 4);
      p.round(2, 1, 10, 6, S[4], 3);
      p.rect(3, 6, 4, 2, S[0]); p.rect(9, 6, 4, 2, S[0]);
      p.rect(4, 7, 2, 1, RU.magic[4]); p.rect(10, 7, 2, 1, RU.magic[4]);
      p.rect(7, 8, 2, 3, S[2]);
      p.rect(5, 12, 6, 1, S[1]);
    }),
  };
  buildRuinsWeapons();
  buildRuinsProjectiles();
  buildRuinsCover();
  buildRuinsDecor();
}

/** The ancient light for the bestiary (in a fight it's drawn live as light): a robed figure of light behind its stone mask. */
function drawAncientLightPortrait(p) {
  const G = RU.magic;
  p.poly([[22, 58], [26, 30], [32, 22], [38, 30], [42, 58]], G[2]);
  p.poly([[26, 58], [28, 32], [32, 26], [36, 32], [38, 58]], G[3]);
  p.poly([[29, 58], [31, 34], [33, 34], [35, 58]], G[4]);
  for (const s of [-1, 1]) p.poly([[32 + s * 5, 30], [32 + s * 14, 40], [32 + s * 12, 44], [32 + s * 4, 36]], G[2]);
  p.round(25, 10, 14, 14, RU.sand[3], 4);
  p.round(26, 10, 10, 6, RU.sand[4], 3);
  p.rect(27, 15, 4, 2, RU.sand[0]); p.rect(33, 15, 4, 2, RU.sand[0]);
  p.rect(28, 16, 2, 1, G[5]); p.rect(34, 16, 2, 1, G[5]);
  p.rect(31, 17, 2, 3, RU.sand[2]);
  for (const [x, y] of [[20, 26], [44, 22], [16, 44], [48, 48]]) { p.px(x, y, G[4]); p.px(x + 1, y + 1, G[3]); }
}

function buildRuinsWeapons() {
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });
  const W = RAMP.leather;
  Object.assign(Sprites.weapons, {
    // the clay guard's spear: a long shaft bound in cord, a carved stone head with a glowing glyph
    claySpear: weapon(58, 12, 14, 6, (p) => {
      p.rect(1, 5, 42, 2, W[3]);
      p.rect(1, 5, 42, 1, W[4]);
      for (const x of [10, 18, 36]) p.rect(x, 4, 2, 4, RU.clay[3]);
      p.poly([[42, 6], [47, 1], [57, 6], [47, 11]], RU.stone[3]);
      p.poly([[42, 6], [47, 1], [57, 6]], RU.stone[5]);
      p.px(48, 6, RU.magic[3]);
      p.px(49, 6, RU.magic[4]);
    }),
    // the rock wizard's old staff: a gnarled branch, leaves and a stone held in its crook, glowing
    ruinStaff: weapon(46, 16, 10, 8, (p) => {
      p.rect(1, 7, 34, 2, W[2]);
      p.rect(1, 7, 34, 1, W[3]);
      p.line(12, 8, 15, 4, W[2]);
      p.rect(14, 2, 3, 2, RU.moss[3]);
      p.line(34, 8, 39, 3, W[2], 2);
      p.line(34, 8, 39, 13, W[2], 2);
      ruRock(p, 40, 8, 4, 4, RU.stone);
      p.px(40, 8, RU.magic[4]);
      p.rect(28, 9, 3, 2, RU.moss[2]);
    }),
  });
}

function buildRuinsProjectiles() {
  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  Object.assign(Sprites.projectiles, {
    pebble: sprite(10, 10, (p) => ruRock(p, 5, 5, 4, 4, RU.sand)),
    boulder: sprite(36, 36, (p) => {
      ruRock(p, 18, 18, 16, 16);
      p.line(6, 18, 30, 18, RU.stone[1], 2);   // a band so its roll shows
      p.line(6, 16, 30, 16, RU.stone[4]);
      ruMoss(p, 10, 6, 8, 0);
      ruGlyph(p, 22, 25);
    }),
    magicBolt: sprite(12, 12, (p) => {
      p.circle(6, 6, 5, RU.magic[2]);
      p.circle(6, 6, 3, RU.magic[3]);
      p.circle(5, 5, 1, RU.magic[5]);
    }),
    magicPellet: sprite(7, 7, (p) => {
      p.circle(3, 3, 3, RU.magic[3]);
      p.px(2, 2, RU.magic[5]);
    }),
    poisonArrow: sprite(18, 6, (p) => {
      p.rect(1, 2, 12, 2, RU.sand[3]);
      p.rect(0, 1, 3, 1, '#d8d0b8'); p.rect(0, 4, 3, 1, '#d8d0b8');
      p.poly([[12, 0], [17, 3], [12, 5]], '#7ac040');
      p.px(13, 2, '#c8ff90');
    }),
    // the golem's bouncing orb of magic (its old fireball, remade for the ruins)
    golemOrb: sprite(20, 20, (p) => {
      p.circle(10, 10, 8, RU.magic[1]);
      p.circle(10, 10, 6, RU.magic[2]);
      p.circle(9, 9, 4, RU.magic[3]);
      p.circle(8, 8, 2, RU.magic[4]);
      p.px(7, 7, RU.magic[5]);
      for (const [x, y] of [[2, 10], [18, 9], [10, 1]]) p.px(x, y, RU.stone[4]);   // flecks of stone caught in it
    }),
  });
}

/** The ruins' cover: what the fight rooms' obstacle patterns are built from (CONFIG.themes.ruins.layout). */
function buildRuinsCover() {
  const S = RU.stone;
  const D = RU.sand;
  const M = RU.moss;
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.16, shade: 0.8 });
  /** A run of big carved blocks, staggered, each lit along its top. */
  const blocks = (p, x, y, w, h, R, rh, bw, seed = 0) => {
    p.rect(x, y, w, h, R[1]);
    for (let row = 0, yy = y; yy < y + h; row++, yy += rh) {
      const off = row % 2 ? Math.floor(bw / 2) : 0;
      for (let bx = x - off; bx < x + w; bx += bw) {
        const x0 = Math.max(x, bx);
        const x1 = Math.min(x + w, bx + bw - 1);
        const hh = Math.min(rh - 1, y + h - yy);
        if (x1 <= x0 || hh <= 0) continue;
        p.rect(x0, yy, x1 - x0, hh, ((bx * 7 + row * 13 + seed) % 5) === 0 ? R[1] : R[2]);
        p.rect(x0, yy, x1 - x0, 1, R[3]);
        p.px(x0, yy, R[4]);
      }
    }
  };
  /** The greek-key band carved along the ruins' walls. */
  const key = (p, x, y, w, R) => {
    p.rect(x, y, w, 7, R[1]);
    for (let i = x + 1; i < x + w - 5; i += 7) {
      p.rect(i, y + 1, 5, 1, R[3]);
      p.rect(i + 4, y + 1, 1, 4, R[3]);
      p.rect(i + 2, y + 3, 3, 1, R[3]);
      p.rect(i, y + 1, 1, 5, R[3]);
      p.rect(i, y + 5, 6, 1, R[3]);
    }
  };
  /** Vines trailing down from (x, y), leaves along them. */
  const vine = (p, x, y, h) => {
    for (let i = 0; i < h; i++) {
      const vx = x + Math.round(Math.sin(i * 0.35) * 2);
      p.px(vx, y + i, M[1]);
      if (i % 5 === 2) { p.rect(vx + 1, y + i, 2, 2, M[3]); p.px(vx + 2, y + i, M[4]); }
      if (i % 7 === 5) p.rect(vx - 2, y + i, 2, 2, M[2]);
    }
  };
  Sprites.cover = Object.assign(Sprites.cover || {}, {
    ruinRocks: [
      make(34, 40, (p) => {
        ruRock(p, 12, 28, 10, 9);
        ruRock(p, 23, 30, 9, 8);
        ruRock(p, 17, 16, 9, 8);
        ruMoss(p, 11, 9, 10, 0);
        ruMoss(p, 22, 23, 6);
        p.rect(3, 36, 28, 2, '#1a1e1a');
      }),
      make(34, 40, (p) => {
        ruRock(p, 17, 26, 14, 11);
        ruRock(p, 9, 33, 6, 4, D);
        ruMoss(p, 9, 15, 14, 2);
        ruGlyph(p, 20, 28);
        ruCrack(p, [[24, 18], [27, 24]], S);
      }),
    ],
    ruinPillar: [
      make(30, 58, (p) => {
        p.rect(2, 50, 26, 6, D[1]);
        p.rect(2, 50, 26, 1, D[3]);
        p.rect(6, 12, 18, 38, D[2]);
        for (const x of [10, 15, 20]) p.rect(x, 12, 1, 38, D[1]);
        p.rect(6, 12, 3, 38, D[3]);
        p.poly([[6, 12], [9, 7], [13, 10], [16, 4], [20, 9], [24, 6], [24, 12]], D[2]);   // snapped off
        p.poly([[9, 7], [13, 10], [16, 4], [16, 9], [11, 12]], D[3]);
        ruMoss(p, 7, 8, 12, 0);
        vine(p, 20, 12, 34);
        ruGlyph(p, 14, 32);
      }),
      make(30, 58, (p) => {
        p.rect(2, 50, 26, 6, D[1]);
        p.rect(2, 50, 26, 1, D[3]);
        p.rect(6, 18, 18, 32, D[2]);
        for (const x of [10, 15, 20]) p.rect(x, 18, 1, 32, D[1]);
        p.rect(6, 18, 3, 32, D[3]);
        p.rect(3, 13, 24, 6, D[3]);   // a capital, cracked
        p.rect(3, 13, 24, 1, D[4]);
        key(p, 4, 20, 22, D);
        ruCrack(p, [[13, 26], [16, 40]], D);
        vine(p, 8, 19, 26);
        ruMoss(p, 4, 12, 10, 1);
      }),
    ],
    ruinStatue: [
      // a toppled clay guardian lying across its plinth, its head rolled off, overgrown
      make(70, 50, (p) => {
        const C = RU.clay;
        p.rect(4, 30, 62, 16, D[1]);
        p.rect(4, 30, 62, 2, D[3]);
        p.rect(4, 44, 62, 2, D[0]);
        key(p, 6, 35, 58, D);
        p.round(18, 18, 32, 13, C[2], 4);
        p.rect(20, 19, 28, 2, C[4]);
        p.round(48, 21, 12, 9, C[2], 3);
        p.round(6, 14, 15, 16, C[3], 6);   // the head
        p.rect(10, 20, 9, 2, C[0]);
        p.rect(11, 20, 2, 1, RU.magic[2]);
        p.rect(16, 20, 2, 1, RU.magic[2]);
        ruCrack(p, [[30, 20], [34, 28]], C);
        ruMoss(p, 22, 17, 14, 0);
        ruMoss(p, 52, 29, 10, 2);
        vine(p, 60, 30, 14);
      }),
      // a great carved clay head half sunk into the ground
      make(70, 50, (p) => {
        const C = RU.clay;
        p.ellipse(35, 44, 32, 6, S[1]);
        p.round(14, 8, 42, 38, C[2], 12);
        p.round(15, 8, 36, 32, C[3], 12);
        p.round(18, 10, 18, 10, C[5], 5);
        p.rect(18, 22, 34, 3, C[1]);
        p.rect(20, 25, 10, 4, C[0]); p.rect(38, 25, 10, 4, C[0]);
        p.rect(22, 26, 6, 1, RU.magic[3]); p.rect(40, 26, 6, 1, RU.magic[3]);
        p.rect(32, 28, 5, 7, C[2]);
        ruCrack(p, [[46, 10], [42, 20]], C);
        ruMoss(p, 22, 7, 22, 0);
        vine(p, 52, 12, 26);
      }),
    ],
    ruinWallH: [make(96, 64, (p) => {
      p.rect(0, 58, 96, 4, S[0]);
      blocks(p, 1, 22, 94, 36, D, 9, 18, 2);
      key(p, 1, 14, 94, D);
      p.rect(0, 8, 96, 7, D[3]);
      p.rect(0, 8, 96, 2, D[4]);
      for (let x = 4; x < 92; x += 10) ruMoss(p, x, 7, 6, x % 30 === 4 ? 0 : -1);   // grass growing along the top
      ruGlyph(p, 48, 38, true);
      ruCrack(p, [[20, 30], [24, 44]], D);
      vine(p, 10, 14, 40);
      vine(p, 70, 14, 30);
      vine(p, 84, 14, 38);
    })],
    ruinWallV: [make(34, 128, (p) => {
      p.rect(1, 120, 32, 6, S[0]);
      p.rect(1, 2, 32, 96, D[3]);
      p.rect(1, 2, 2, 96, D[4]);
      for (let y = 6; y < 94; y += 12) p.rect(4, y, 26, 1, D[2]);
      for (let y = 10; y < 90; y += 18) ruMoss(p, 4 + (y % 3) * 6, y, 10, y % 36 === 10 ? 1 : -1);
      blocks(p, 1, 98, 32, 22, D, 9, 14, 5);
      key(p, 1, 98, 32, D);
      vine(p, 26, 98, 22);
      ruGlyph(p, 16, 112);
    })],
    ruinBlock: [make(66, 92, (p) => {
      // an old altar: a stepped stone block, a magic glyph glowing on its top, a sapling growing out of a crack
      p.rect(1, 84, 64, 6, S[0]);
      p.rect(1, 8, 64, 56, D[3]);
      p.rect(1, 8, 64, 2, D[4]);
      p.rect(8, 16, 50, 40, D[2]);
      p.rect(8, 16, 50, 1, D[1]);
      p.ellipse(33, 36, 14, 9, D[1]);
      p.ellipse(33, 36, 10, 6, RU.magic[1]);
      ruGlyph(p, 33, 36, true);
      ruGlyph(p, 22, 30);
      ruGlyph(p, 44, 42);
      blocks(p, 1, 62, 64, 24, D, 9, 16, 3);
      key(p, 1, 62, 64, D);
      for (let x = 4; x < 62; x += 9) ruMoss(p, x, 8, 6, x === 31 ? 0 : -1);
      p.rect(50, 6, 2, 12, RU.clay[1]);   // the sapling
      p.circle(51, 4, 5, M[2]);
      p.circle(49, 3, 3, M[4]);
      vine(p, 6, 64, 18);
    })],
  });
}

/** Set dressing for RuinsDecor: trees, standing stones, magic braziers, broken columns, ferns, a half-buried head. */
function buildRuinsDecor() {
  const S = RU.stone;
  const D = RU.sand;
  const M = RU.moss;
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.18, shade: 0.82 });
  Sprites.ruinsDecor = {
    // a round green tree like the ones that have grown up through the temple floor
    tree: make(44, 72, (p) => {
      p.rect(19, 46, 6, 24, RAMP.leather[2]);
      p.rect(19, 46, 2, 24, RAMP.leather[3]);
      p.poly([[15, 70], [19, 62], [25, 62], [29, 70]], RAMP.leather[2]);
      for (const [cx, cy, r] of [[22, 40, 15], [14, 34, 10], [30, 32, 11], [22, 22, 13], [22, 10, 9]]) p.circle(cx, cy, r, M[2]);
      for (const [cx, cy, r] of [[19, 36, 9], [12, 30, 5], [26, 28, 6], [19, 18, 8], [20, 8, 5]]) p.circle(cx, cy, r, M[3]);
      for (const [cx, cy, r] of [[16, 33, 3], [17, 15, 4], [18, 6, 2]]) p.circle(cx, cy, r, M[4]);
      for (const [x, y] of [[28, 40], [10, 38], [30, 22]]) p.px(x, y, RU.flower[0]);
    }),
    // a standing stone carved with a rune that still glows
    runeStone: make(26, 44, (p) => {
      p.poly([[4, 42], [3, 12], [8, 3], [17, 2], [22, 10], [23, 42]], D[2]);
      p.poly([[4, 42], [3, 12], [8, 3], [9, 42]], D[3]);
      p.poly([[19, 42], [22, 10], [23, 42]], D[1]);
      p.rect(7, 14, 12, 18, D[1]);
      ruGlyph(p, 13, 23, true);
      p.px(13, 17, RU.magic[3]); p.px(13, 29, RU.magic[3]);
      ruMoss(p, 4, 41, 18, 0);
      ruMoss(p, 9, 4, 8);
    }),
    // a stone brazier where the magic burns teal instead of fire
    brazier: make(28, 36, (p) => {
      p.rect(9, 18, 10, 16, D[2]);
      p.rect(9, 18, 3, 16, D[3]);
      p.rect(6, 32, 16, 3, D[1]);
      p.round(2, 10, 24, 9, D[3], 3);
      p.rect(3, 10, 22, 2, D[4]);
      p.rect(5, 12, 18, 3, S[0]);
      for (let x = 5; x < 23; x += 5) p.px(x, 16, D[1]);
      ruGlyph(p, 14, 25);
      ruMoss(p, 3, 18, 6);
    }),
    // a column broken off low, its drum lying beside it
    column: make(40, 42, (p) => {
      p.rect(4, 36, 22, 5, D[1]);
      p.rect(7, 12, 16, 25, D[2]);
      p.rect(7, 12, 3, 25, D[3]);
      for (const x of [12, 17]) p.rect(x, 12, 1, 25, D[1]);
      p.poly([[7, 12], [10, 8], [14, 11], [18, 6], [23, 10], [23, 12]], D[3]);
      ruMoss(p, 8, 8, 12, 1);
      p.round(24, 30, 14, 10, D[3], 4);
      p.rect(26, 31, 9, 1, D[4]);
      ruMoss(p, 26, 30, 6);
    }),
    // a clump of ferns
    fern: make(28, 18, (p) => {
      for (const [x0, a] of [[14, -2.2], [14, -1.6], [14, -1.0], [14, -0.4], [14, -2.8]]) {
        const x1 = Math.round(x0 + Math.cos(a) * 12);
        const y1 = Math.round(16 + Math.sin(a) * 14);
        p.line(x0, 16, x1, y1, M[2], 2);
        p.px(x1, y1, M[4]);
      }
      p.rect(10, 14, 8, 3, M[1]);
    }),
    // the rocks that float on the magic: small and many-sided, drawn bobbing at runtime
    floatRock: make(14, 12, (p) => { ruRock(p, 7, 6, 6, 5); ruMoss(p, 4, 2, 5); }),
    floatRockSmall: make(9, 8, (p) => ruRock(p, 4, 4, 4, 3)),
  };
}
