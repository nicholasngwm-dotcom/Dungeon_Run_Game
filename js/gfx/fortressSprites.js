// The Fiery Fortress's sprites: the guardians' bodies (js/gfx/enemies/fortress.js) built into
// frames, the parts drawn at runtime (the elemental's fists, the worm's head and segments),
// weapons and projectiles, the fortress's cover (charred rubble, brick pillars, a fallen demon
// statue, crenellated walls and an obsidian altar) and its set dressing (FortressDecor).

const SLIME_MAGMA = { size: 46, ax: 23, ay: 36 };
const SLIME_MAGMA_TINY = { size: 28, ax: 14, ay: 21 };
const ELITE_ANCHOR = { x: 40, y: 66 };
const CRAB_ANCHOR = { x: 36, y: 48 };
const DEN_ANCHOR = { x: 32, y: 40 };
const DRAGON_ANCHOR = { x: 36, y: 50 };
const ELEMENTAL_ANCHOR = { x: 48, y: 82 };
const BAT_ANCHOR = { x: 20, y: 16 };
const WILDFIRE_ANCHOR = { x: 24, y: 36 };

function buildFortressSprites() {
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
    for (const [name, list] of Object.entries(shapes)) out[name] = list.map((s) => frame(make(cfg.size, cfg.size, (p) => drawMagmaSlime(p, cfg.size, s.rx, s.ry, tiny))));
    return out;
  };
  const one = (w, h, fn) => ({ idle: [frame(make(w, h, fn))] });
  const flap = (w, h, fn, wings) => wings.map((wing) => frame(make(w, h, (p) => fn(p, { wing }))));

  Object.assign(Sprites.enemies, {
    skeleflame: buildCuteEnemy(drawSkeleflame),
    magmaSlime: slime(SLIME_MAGMA, false),
    magmaSlimeTiny: slime(SLIME_MAGMA_TINY, true),
    magmaBat: { idle: flap(40, 32, drawMagmaBat, [0, 1, 2, 1]) },
    demonWarrior: buildCuteEnemy(drawDemonWarrior),
    magicDemon: buildCuteEnemy(drawMagicDemon),
    eliteDemon: buildPoseFrames(drawEliteDemon, 80, {
      fly: [{ wing: 0 }, { wing: 1 }, { wing: 2 }, { wing: 1 }],
      idle: [{ ground: true }, { ground: true, bob: 1 }],
      walk: [{ ground: true }, { ground: true, bob: 1 }],
      slash: [{ ground: true, slash: true }],
    }, 0.5),
    magmaDen: one(64, 52, drawMagmaDen),
    meteorCrab: buildPoseFrames(drawMeteorCrab, 72, {
      idle: [{ step: 0 }, { step: 0, bob: 1 }], walk: [{ step: 0 }, { step: 1 }, { step: 0, bob: 1 }, { step: 1, bob: 1 }], cast: [{ raised: true }],
    }, 0.5),
    wildfire: one(48, 48, drawWildfirePortrait),
    blazingTurret: one(64, 64, drawBlazingTurret),
    moltenKnight: buildCuteEnemy(drawMoltenKnight),
    moltenElemental: { idle: [frame(make(96, 96, (p) => drawMoltenElementalBody(p, { bob: 0 }))), frame(make(96, 96, (p) => drawMoltenElementalBody(p, { bob: 1 })))] },
    babyDragon: buildPoseFrames(drawBabyDragon, 72, {
      idle: [{ wing: 0 }, { wing: 1 }], walk: [{ wing: 0 }, { wing: 1 }], open: [{ wing: 0, open: true }, { wing: 1, open: true }],
    }, 0.5),
  });

  Sprites.fortress = {
    fist: make(34, 38, (p) => drawMoltenFist(p, false)),
    fistMolten: make(34, 38, (p) => drawMoltenFist(p, true)),
  };
  buildFortressWeapons();
  buildFortressProjectiles();
  buildFortressCover();
  buildFortressDecor();
  buildFlamewormSprites();
}

function buildFortressWeapons() {
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });
  const W = RAMP.leather;
  const I = FF.iron;
  const L = FF.lava;
  Object.assign(Sprites.weapons, {
    // the demon warrior's pitchfork: a long charred haft, three iron tines glowing red-hot at the points
    pitchfork: weapon(62, 16, 16, 8, (p) => {
      p.rect(1, 7, 44, 2, W[2]);
      p.rect(1, 7, 44, 1, W[3]);
      for (const x of [12, 30]) p.rect(x, 6, 2, 4, I[3]);
      p.rect(44, 3, 3, 10, I[3]);
      p.rect(44, 3, 1, 10, I[4]);
      for (const y of [3, 7, 11]) {
        p.rect(47, y, 11, 2, I[3]);
        p.rect(47, y, 11, 1, I[4]);
        p.rect(56, y, 3, 2, L[3]);
        p.px(59, y, L[5]);
      }
    }),
    // the magic demon's staff: a black iron rod, a horned skull at its head holding a violet flame
    demonStaff: weapon(48, 18, 10, 9, (p) => {
      p.rect(1, 8, 32, 2, I[2]);
      p.rect(1, 8, 32, 1, I[4]);
      for (const x of [8, 20]) p.rect(x, 7, 2, 4, '#c88a30');
      p.round(32, 4, 11, 10, '#d8ccbc', 3);
      p.rect(35, 7, 2, 2, OUTLINE); p.rect(39, 7, 2, 2, OUTLINE);
      p.px(36, 7, FF.magic[4]); p.px(40, 7, FF.magic[4]);
      p.rect(36, 11, 5, 1, OUTLINE);
      p.line(33, 5, 30, 1, FF.horn[3], 2);
      p.line(42, 5, 45, 1, FF.horn[3], 2);
    }),
    // the molten knight's old royal sword, its blade glowing with the lava in it
    moltenSword: weapon(44, 12, 9, 6, (p) => {
      p.rect(1, 5, 7, 2, W[2]);
      p.round(0, 4, 3, 4, CK.gold[3], 1);
      p.rect(8, 1, 3, 10, CK.gold[2]);
      p.rect(8, 1, 1, 10, CK.gold[4]);
      p.poly([[11, 3], [38, 3], [43, 6], [38, 9], [11, 9]], I[3]);
      p.rect(11, 3, 27, 1, I[5]);
      p.rect(12, 5, 26, 2, L[3]);
      p.rect(14, 6, 20, 1, L[5]);
    }),
  });
}

function buildFortressProjectiles() {
  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  const L = FF.lava;
  const M = FF.magic;
  const fireball = (r) => sprite(r * 2 + 2, r * 2 + 2, (p) => {
    const c = r + 1;
    p.circle(c, c, r, L[2]);
    p.circle(c - 1, c - 1, Math.max(1, r - 2), L[3]);
    p.circle(c - 1, c - 1, Math.max(1, r - 4), L[4]);
    p.circle(c - 2, c - 2, Math.max(1, Math.floor(r / 3)), L[6]);
  });
  Object.assign(Sprites.projectiles, {
    // a skeleflame's burning arrow
    fireArrow: sprite(20, 7, (p) => {
      p.rect(2, 3, 12, 1, RAMP.leather[3]);
      p.rect(0, 1, 3, 1, '#5a1410'); p.rect(0, 5, 3, 1, '#5a1410');
      p.poly([[13, 0], [19, 3], [13, 6]], L[3]);
      p.poly([[14, 2], [18, 3], [14, 4]], L[5]);
    }),
    fireballSmall: fireball(5),
    fireball: fireball(7),
    fireballBig: fireball(12),
    magicOrb: sprite(11, 11, (p) => {
      p.circle(5, 5, 4, M[2]);
      p.circle(5, 5, 3, M[3]);
      p.circle(4, 4, 1, M[5]);
    }),
    lavaGlob: sprite(14, 14, (p) => {
      p.ellipse(7, 8, 6, 5, L[1]);
      p.ellipse(6, 7, 4, 3, L[3]);
      p.px(5, 6, L[5]);
      p.rect(9, 3, 2, 3, FF.rock[3]);
    }),
    // the meteorite crab's meteor: a lump of black rock, molten through
    meteor: sprite(36, 36, (p) => {
      ffRock(p, 18, 18, 15, 14);
      ffCrack(p, [[10, 12], [16, 20], [12, 28]]);
      ffCrack(p, [[22, 8], [26, 16], [24, 24]]);
      p.ellipse(20, 20, 4, 3, L[3]);
      p.px(19, 19, L[6]);
    }),
    // the worm's giant flaming magic arrow (drawn pointing right): a shaft of violet magic, a head of fire
    wormArrow: sprite(64, 20, (p) => {
      p.rect(2, 9, 44, 3, M[2]);
      p.rect(2, 9, 44, 1, M[4]);
      for (const x of [10, 22, 34]) { p.rect(x, 8, 3, 5, M[3]); p.px(x + 1, 10, M[5]); }
      p.poly([[0, 3], [10, 9], [10, 12], [0, 17], [4, 10]], M[1]);
      p.poly([[44, 2], [63, 10], [44, 18], [48, 10]], L[2]);
      p.poly([[46, 5], [60, 10], [46, 15], [49, 10]], L[4]);
      p.poly([[49, 8], [57, 10], [49, 12]], L[6]);
    }),
  });
}

/** The fortress's cover: what the fight rooms' obstacle patterns are built from (CONFIG.themes.fortress.layout). */
function buildFortressCover() {
  const R = FF.rock;
  const B = FF.brick;
  const I = FF.iron;
  const L = FF.lava;
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.16, shade: 0.8 });
  /** Courses of nether brick over a rect, each lit along its top. */
  const bricks = (p, x, y, w, h, bw = 12, rh = 6, seed = 0) => {
    p.rect(x, y, w, h, B[0]);
    for (let row = 0, yy = y; yy < y + h; row++, yy += rh) {
      const off = row % 2 ? Math.floor(bw / 2) : 0;
      for (let bx = x - off; bx < x + w; bx += bw) {
        const x0 = Math.max(x, bx);
        const x1 = Math.min(x + w, bx + bw - 1);
        const hh = Math.min(rh - 1, y + h - yy);
        if (x1 <= x0 || hh <= 0) continue;
        p.rect(x0, yy, x1 - x0, hh, ((bx * 7 + row * 13 + seed) % 5) === 0 ? B[2] : B[3]);
        p.rect(x0, yy, x1 - x0, 1, B[4]);
      }
    }
  };
  /** Crenellations along a top edge. */
  const merlons = (p, x, y, w) => {
    for (let i = x; i < x + w - 4; i += 9) { p.rect(i, y, 6, 6, B[3]); p.rect(i, y, 6, 1, B[5]); }
  };
  Sprites.cover = Object.assign(Sprites.cover || {}, {
    fortRubble: [
      make(34, 40, (p) => {
        ffRock(p, 12, 28, 10, 9);
        ffRock(p, 24, 30, 8, 7);
        bricks(p, 10, 12, 14, 10, 7, 5);
        ffCrack(p, [[8, 26], [12, 32]]);
        p.px(22, 28, L[4]);
        p.rect(3, 36, 28, 2, R[0]);
      }),
      make(34, 40, (p) => {
        ffRock(p, 17, 26, 14, 11);
        ffCrack(p, [[12, 20], [17, 27], [14, 34]]);
        p.rect(20, 14, 10, 4, I[3]);   // a broken iron bar lying on it
        p.rect(20, 14, 10, 1, I[5]);
        p.poly([[6, 24], [9, 14], [12, 24]], R[4]);   // an obsidian shard
        p.line(8, 16, 9, 22, '#6a4a8a');
      }),
    ],
    fortPillar: [
      make(30, 62, (p) => {
        p.rect(2, 54, 26, 6, B[2]);
        p.rect(2, 54, 26, 1, B[4]);
        bricks(p, 5, 14, 20, 40, 10, 6, 1);
        p.rect(3, 8, 24, 7, B[3]);
        p.rect(3, 8, 24, 1, B[5]);
        // an iron fire-basket on top, burning
        p.rect(7, 4, 16, 5, I[2]);
        p.rect(7, 4, 16, 1, I[4]);
        p.poly([[8, 4], [12, 0], [15, 3], [18, -1], [22, 4]], L[3]);
        p.poly([[11, 4], [14, 1], [17, 4]], L[5]);
      }),
      make(30, 62, (p) => {
        p.rect(2, 54, 26, 6, B[2]);
        p.rect(2, 54, 26, 1, B[4]);
        bricks(p, 5, 10, 20, 44, 10, 6, 4);
        merlons(p, 4, 4, 22);
        // an iron-barred slit glowing from inside
        p.round(12, 24, 6, 14, OUTLINE, 2);
        p.rect(13, 25, 4, 12, L[3]);
        p.rect(13, 25, 4, 3, L[5]);
        p.rect(14, 25, 1, 12, I[0]); p.rect(16, 25, 1, 12, I[0]);
      }),
    ],
    fortStatue: [
      // a toppled demon statue across its plinth, its horned head broken off
      make(70, 50, (p) => {
        bricks(p, 4, 30, 62, 16, 12, 6, 2);
        p.rect(4, 30, 62, 1, B[5]);
        p.round(18, 18, 32, 13, R[3], 4);
        p.rect(20, 19, 28, 2, R[5]);
        p.round(48, 20, 12, 10, R[2], 3);
        p.round(6, 14, 15, 16, R[3], 6);
        ffHorn(p, 8, 16, 9, -1, R.slice(2));
        ffHorn(p, 17, 15, 8, 1, R.slice(2));
        p.rect(10, 21, 3, 2, L[3]); p.rect(15, 21, 3, 2, L[3]);
        ffCrack(p, [[30, 20], [34, 28]]);
      }),
      // an iron cage hanging empty on its frame, a scorched skull in its corner
      make(70, 50, (p) => {
        p.rect(4, 42, 62, 6, B[2]);
        p.rect(4, 42, 62, 1, B[4]);
        p.rect(12, 6, 46, 4, I[3]);
        p.rect(12, 6, 46, 1, I[5]);
        for (let x = 13; x < 58; x += 6) p.rect(x, 10, 2, 32, I[2]);
        p.rect(12, 26, 46, 2, I[3]);
        p.round(42, 34, 9, 8, '#c8bea8', 3);
        p.rect(44, 37, 2, 2, OUTLINE); p.rect(48, 37, 2, 2, OUTLINE);
        p.px(44, 37, L[3]);
      }),
    ],
    fortWallH: [make(96, 64, (p) => {
      p.rect(0, 58, 96, 4, R[0]);
      bricks(p, 1, 16, 94, 42, 12, 6, 2);
      merlons(p, 2, 10, 92);
      p.rect(0, 15, 96, 2, B[5]);
      // two barred windows, the fire within lighting them
      for (const wx of [22, 66]) {
        p.round(wx, 28, 9, 16, OUTLINE, 3);
        p.rect(wx + 1, 29, 7, 15, L[3]);
        p.rect(wx + 1, 29, 7, 4, L[5]);
        for (const bx of [wx + 3, wx + 6]) p.rect(bx, 29, 1, 15, I[0]);
      }
      ffCrack(p, [[46, 40], [50, 52]]);
    })],
    fortWallV: [make(34, 128, (p) => {
      p.rect(1, 120, 32, 6, R[0]);
      p.rect(1, 2, 32, 96, B[1]);
      p.rect(1, 2, 2, 96, B[4]);
      for (let y = 6; y < 94; y += 10) { p.rect(4, y, 26, 1, B[3]); p.px(6 + (y % 3) * 8, y + 4, B[0]); }
      for (let y = 16; y < 94; y += 30) { p.rect(8, y, 18, 3, I[2]); p.rect(8, y, 18, 1, I[4]); }   // iron bands
      bricks(p, 1, 98, 32, 22, 10, 6, 5);
      merlons(p, 2, 92, 30);
      ffCrack(p, [[16, 104], [18, 114]]);
    })],
    fortBlock: [make(66, 92, (p) => {
      // an obsidian altar: a basin of lava on top, demon runes glowing down its face
      p.rect(1, 84, 64, 6, R[0]);
      p.rect(1, 8, 64, 56, R[2]);
      p.rect(1, 8, 64, 2, R[4]);
      p.rect(8, 16, 50, 40, R[1]);
      p.ellipse(33, 30, 18, 9, R[0]);
      p.ellipse(33, 31, 15, 7, L[2]);
      p.ellipse(32, 30, 10, 4, L[3]);
      p.ellipse(31, 29, 4, 2, L[5]);
      for (const [x, y] of [[16, 44], [33, 48], [50, 44]]) { p.line(x - 3, y, x + 3, y, L[2]); p.line(x, y - 3, x, y + 3, L[2]); p.px(x, y, L[4]); }
      bricks(p, 1, 62, 64, 24, 12, 6, 3);
      p.poly([[4, 8], [8, 0], [12, 8]], R[3]);
      p.poly([[54, 8], [58, -1], [62, 8]], R[3]);
    })],
  });
}

/** Set dressing for FortressDecor: iron braziers, the vent cracks the open fires burn out of, bones, banners, obsidian. */
function buildFortressDecor() {
  const R = FF.rock;
  const B = FF.brick;
  const I = FF.iron;
  const L = FF.lava;
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.18, shade: 0.82 });
  Sprites.fortressDecor = {
    // a tall iron brazier on three legs (its fire is drawn live)
    brazier: make(26, 40, (p) => {
      p.line(6, 38, 11, 20, I[2], 2);
      p.line(20, 38, 15, 20, I[1], 2);
      p.line(13, 38, 13, 20, I[3], 2);
      p.round(3, 12, 20, 9, I[2], 3);
      p.rect(4, 12, 18, 2, I[4]);
      p.rect(5, 14, 16, 3, L[1]);
      p.rect(7, 14, 10, 2, L[3]);
      for (const x of [6, 12, 18]) p.poly([[x - 1, 12], [x, 8], [x + 1, 12]], I[3]);
    }),
    // the vent an open fire burns up out of: a ring of scorched, cracked brick round an iron grate
    vent: make(40, 22, (p) => {
      p.ellipse(20, 11, 18, 9, B[2]);
      p.ellipse(20, 11, 16, 8, B[1]);
      for (let a = 0; a < 8; a++) {
        const x = Math.round(20 + Math.cos(a * 0.8) * 15);
        const y = Math.round(11 + Math.sin(a * 0.8) * 7);
        p.rect(x - 2, y - 1, 4, 2, B[4]);
      }
      p.ellipse(20, 11, 11, 5, '#2a0604');
      p.ellipse(20, 11, 9, 4, L[2]);
      p.ellipse(20, 11, 6, 2, L[4]);
      for (const x of [13, 17, 21, 25]) p.rect(x, 7, 2, 9, I[1]);
      p.rect(11, 10, 18, 1, I[2]);
    }),
    bones: make(30, 16, (p) => {
      p.round(4, 4, 9, 8, '#c8bea8', 3);
      p.rect(6, 7, 2, 2, OUTLINE); p.rect(10, 7, 2, 2, OUTLINE);
      p.line(14, 12, 26, 9, '#b5ad96', 2);
      p.line(12, 14, 22, 14, '#a89e88', 2);
      p.px(26, 8, '#d8d0c0'); p.px(22, 13, '#d8d0c0');
    }),
    // a cluster of obsidian spikes, purple light in their edges
    obsidian: make(26, 30, (p) => {
      for (const [x, h, w] of [[8, 22, 5], [15, 28, 6], [20, 16, 4]]) {
        p.poly([[x - w, 29], [x, 29 - h], [x + w, 29]], '#1a1222');
        p.poly([[x - w, 29], [x, 29 - h], [x - 1, 29]], '#3a2a4a');
        p.line(x, 29 - h, x, 27, '#8a5ac0');
      }
    }),
    // a war banner of the fortress on an iron pole: black cloth, a burning eye
    banner: make(22, 60, (p) => {
      p.rect(3, 4, 2, 56, I[3]);
      p.rect(3, 4, 1, 56, I[5]);
      p.rect(1, 3, 18, 2, I[3]);
      p.poly([[5, 5], [19, 5], [19, 36], [12, 31], [5, 36]], '#200a0c');
      p.poly([[5, 5], [8, 5], [8, 34], [5, 36]], '#3a1214');
      p.ellipse(12, 16, 4, 3, L[3]);
      p.circle(12, 16, 1, OUTLINE);
      p.line(8, 24, 17, 24, '#7a2a1a');
    }),
    // a stone basin a lavafall pours into
    basin: make(40, 20, (p) => {
      p.ellipse(20, 12, 18, 7, B[3]);
      p.ellipse(20, 11, 15, 5, OUTLINE);
      p.ellipse(20, 11, 14, 4, L[2]);
      p.ellipse(19, 10, 8, 2, L[4]);
      p.rect(3, 12, 34, 5, B[2]);
      p.rect(3, 12, 34, 1, B[4]);
    }),
  };
}

/**
 * The Decronic Flameworm: a giant sandworm of black molten rock. Its body is a chain of segments (each a ring
 * of rock plates with lava welling between them), drawn at runtime rising out of its burrow; its head is a great
 * round maw ringed with fangs, lava in its throat (open) or its plates clamped shut to a point (closed).
 */
function buildFlamewormSprites() {
  const R = FF.rock;
  const L = FF.lava;
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  const segment = (p, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    p.ellipse(cx, cy, cx - 1, cy - 1, L[1]);
    p.ellipse(cx, cy + 1, cx - 3, cy - 4, L[2]);
    // the plates round it, lit on the upper left
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU - Math.PI / 2 + 0.12;
      const a1 = ((i + 1) / n) * TAU - Math.PI / 2 - 0.12;
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (a1 - a0) * (k / 4);
        pts.push([cx + Math.cos(a) * (cx - 1), cy + Math.sin(a) * (cy - 1)]);
      }
      for (let k = 4; k >= 0; k--) {
        const a = a0 + (a1 - a0) * (k / 4);
        pts.push([cx + Math.cos(a) * (cx * 0.45), cy + Math.sin(a) * (cy * 0.45)]);
      }
      const lit = Math.cos((a0 + a1) / 2 + 2.3);
      p.poly(pts, lit > 0.4 ? R[4] : lit > -0.3 ? R[3] : R[2]);
    }
    // the core: molten, a white-hot fleck
    p.ellipse(cx, cy, cx * 0.4, cy * 0.4, L[3]);
    p.ellipse(cx - 1, cy - 1, cx * 0.2, cy * 0.2, L[5]);
  };
  Sprites.flameworm = {
    segment: make(44, 40, (p) => segment(p, 44, 40)),
    tail: make(28, 26, (p) => segment(p, 28, 26)),
    // the head, maw open: a ring of plates round a mouth of fangs and fire
    head: make(64, 60, (p) => {
      p.ellipse(32, 32, 30, 26, R[2]);
      p.ellipse(31, 30, 27, 23, R[3]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const x = Math.round(32 + Math.cos(a) * 24);
        const y = Math.round(32 + Math.sin(a) * 20);
        p.round(x - 5, y - 4, 10, 8, Math.cos(a + 2.3) > 0 ? R[5] : R[2], 3);
        ffCrack(p, [[x, y], [Math.round(32 + Math.cos(a + 0.4) * 18), Math.round(32 + Math.sin(a + 0.4) * 15)]], false);
      }
      // the maw
      p.ellipse(32, 33, 18, 15, '#1a0604');
      p.ellipse(32, 34, 15, 12, L[1]);
      p.ellipse(32, 35, 10, 8, L[2]);
      p.ellipse(32, 36, 6, 4, L[4]);
      p.ellipse(31, 35, 2, 1, L[6]);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const x = 32 + Math.cos(a) * 16;
        const y = 33 + Math.sin(a) * 13;
        const tx = 32 + Math.cos(a) * 10;
        const ty = 33 + Math.sin(a) * 8;
        p.poly([[x + Math.cos(a + 1.6) * 2, y + Math.sin(a + 1.6) * 2], [tx, ty], [x - Math.cos(a + 1.6) * 2, y - Math.sin(a + 1.6) * 2]], '#e8dcc0');
      }
      // eyes high on the plates, glaring
      for (const ex of [17, 43]) { p.rect(ex, 10, 5, 3, L[4]); p.px(ex + 1, 10, L[6]); }
    }),
    // the head, maw shut: the plates clamped together to a blunt point, lava in the seams
    headClosed: make(56, 60, (p) => {
      p.poly([[6, 50], [4, 26], [14, 8], [28, 2], [42, 8], [52, 26], [50, 50], [28, 58]], R[2]);
      p.poly([[8, 48], [6, 26], [15, 10], [27, 4], [26, 56]], R[3]);
      for (const [x0, y0, x1, y1] of [[28, 4, 28, 56], [10, 18, 46, 40], [46, 18, 10, 40]]) ffCrack(p, [[x0, y0], [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)], [x1, y1]]);
      for (const ex of [14, 37]) { p.rect(ex, 22, 5, 3, L[4]); p.px(ex + 1, 22, L[6]); }
      p.line(14, 8, 28, 3, R[5]);
    }),
  };
}
