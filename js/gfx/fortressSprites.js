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
    // the worm's divine flame arrow (drawn pointing right): an arrow made of fire itself - a white-hot shaft
    // braided with flame, a great barbed head of fire, tongues of it streaming back off the barbs and fletching
    wormArrow: sprite(78, 30, (p) => {
      const Fr = FORT_FIRE;
      // the tongues streaming back off the barbs
      p.poly([[50, 3], [36, 1], [22, 6], [38, 6], [48, 9]], Fr[1]);
      p.poly([[50, 27], [36, 29], [22, 24], [38, 24], [48, 21]], Fr[1]);
      p.poly([[48, 5], [38, 3], [30, 6], [40, 7]], Fr[2]);
      p.poly([[48, 25], [38, 27], [30, 24], [40, 23]], Fr[2]);
      // the shaft: flame wound round a white-hot core
      p.poly([[6, 11], [52, 12], [52, 18], [6, 19], [12, 15]], Fr[1]);
      p.poly([[10, 13], [52, 13], [52, 17], [10, 17], [14, 15]], Fr[2]);
      for (let x = 12; x < 50; x += 8) { p.line(x, 13, x + 5, 17, Fr[3]); p.line(x + 4, 13, x + 8, 15, Fr[1]); }
      p.rect(14, 14, 38, 2, Fr[3]);
      p.rect(20, 15, 32, 1, Fr[4]);
      // the fletching: three flames licking back
      p.poly([[14, 13], [4, 4], [0, 6], [8, 14]], Fr[2]);
      p.poly([[14, 17], [4, 26], [0, 24], [8, 16]], Fr[2]);
      p.poly([[12, 14], [1, 13], [1, 17], [12, 16]], Fr[3]);
      p.poly([[12, 13], [6, 7], [5, 9]], Fr[3]);
      p.poly([[12, 17], [6, 23], [5, 21]], Fr[3]);
      // the head: barbed, layered from its red edge to a white-hot point
      p.poly([[46, 2], [77, 15], [46, 28], [52, 15]], Fr[1]);
      p.poly([[49, 6], [73, 15], [49, 24], [54, 15]], Fr[2]);
      p.poly([[52, 9], [69, 15], [52, 21], [56, 15]], Fr[3]);
      p.poly([[55, 12], [65, 15], [55, 18]], Fr[4]);
      p.line(56, 15, 66, 15, '#ffffff');
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
 * The Decronic Flameworm: a giant sandworm armoured in plates of dark crimson rock, molten pustules glowing
 * between them. Seen from the side, facing right: its body is a run of overlapping plated segments (the rear lip
 * of each is what shows), drawn turned along its spine at runtime; its head is a plated skull and a hinged lower
 * jaw, both ringed with fangs, opening on a throat of raw flesh and fire. Rocks for its holes and the rubble it
 * throws up. The jaw and skull pivot on their hinge (WORM_HEAD in flameworm.js holds the pivots).
 */
function buildFlamewormSprites() {
  const R = FF.rock;
  const B = FF.brick;
  const L = FF.lava;
  const W = ['#16050a', '#2c0a10', '#4a1216', '#6a1c1e', '#8c2a26', '#b04232', '#d0623e'];   // its armour, darkest first
  const M = ['#24060c', '#5a1222', '#9a2a3a', '#d0566a', '#f08a96'];                        // its maw
  const F = ['#8a7a6a', '#d8ccb8', '#f4ecdc'];                                               // fangs
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE, 0.5);
  /** A molten pustule bulging between the plates. */
  const pustule = (p, x, y, r) => {
    p.circle(x, y, r + 1, W[1]);
    p.circle(x, y, r, L[3]);
    p.circle(x - 1, y - 1, Math.max(1, r - 1), L[4]);
    p.px(x - 1, y - 1, L[6]);
  };
  /** A fang from (x, y) pointing along dy (down +, up -), w wide at the root. */
  const fang = (p, x, y, w, len, dy, lean = 0) => {
    p.poly([[x, y], [x + w, y], [x + w / 2 + lean, y + dy * len]], F[1]);
    p.line(x + w - 1, y, x + w / 2 + lean, y + dy * (len - 1), F[0]);
    p.px(x + 1, y + dy, F[2]);
  };
  /** One body segment, 26x50: a plated band with its rear lip (left) raised, a dorsal spike, lava in the seam. */
  const segment = (p, spot, spike) => {
    p.poly([[4, 8], [17, 5], [23, 10], [25, 25], [23, 40], [17, 45], [4, 43], [8, 25]], W[2]);
    // lit along the top, the belly in shadow
    p.poly([[5, 9], [17, 6], [22, 11], [23, 19], [7, 18]], W[4]);
    p.poly([[6, 34], [23, 33], [22, 40], [17, 44], [5, 42]], W[1]);
    p.line(7, 8, 16, 6, W[5]);
    p.line(8, 7, 12, 6, W[6]);
    // the rear lip: a thick rim of plate with the seam of lava under it
    p.line(4, 9, 8, 25, W[5], 2);
    p.line(8, 25, 4, 42, W[3], 2);
    p.line(2, 12, 5, 26, L[2]);
    p.line(5, 26, 2, 40, L[1]);
    // the plate's ribs
    p.line(13, 8, 15, 42, W[1]);
    p.line(14, 9, 16, 18, W[5]);
    if (spike) { p.poly([[9, 8], [16, 6], [11, 0]], W[3]); p.line(10, 6, 11, 1, W[5]); }
    if (spot === 1) pustule(p, 18, 26, 3);
    if (spot === 2) { pustule(p, 11, 22, 2); pustule(p, 19, 30, 2); }
  };
  const skull = make(70, 54, (p) => {
    // the plated dome of its head, the snout coming to a hooked lip over the fangs
    p.poly([[0, 14], [10, 8], [24, 5], [40, 7], [54, 14], [63, 24], [68, 32], [62, 36], [27, 37], [23, 44], [14, 50], [0, 48]], W[2]);
    p.poly([[2, 15], [11, 10], [24, 7], [39, 9], [52, 15], [59, 22], [32, 21], [6, 25]], W[4]);
    p.poly([[4, 40], [24, 39], [21, 45], [13, 49], [2, 47]], W[1]);
    p.line(8, 11, 22, 7, W[5]);
    p.line(26, 7, 38, 9, W[6]);
    // the plates' seams, lava under them
    for (const [x0, y0, x1, y1] of [[18, 7, 14, 36], [32, 8, 30, 36], [46, 12, 46, 35]]) {
      p.line(x0, y0, x1, y1, W[0], 2);
      p.line(x0 + 1, y0 + 2, x1 + 1, y1, L[2]);
    }
    // ridge spikes along the crown
    for (const x of [12, 25, 38]) { p.poly([[x, 9], [x + 8, 7], [x + 1, 1]], W[3]); p.line(x + 1, 7, x + 1, 2, W[5]); }
    pustule(p, 24, 24, 3);
    pustule(p, 40, 22, 2);
    pustule(p, 9, 32, 2);
    // the hooked lip and a deep-set ember eye
    p.poly([[56, 30], [68, 32], [64, 38], [58, 36]], W[3]);
    p.rect(50, 24, 5, 3, L[4]);
    p.px(51, 24, L[6]);
    p.line(48, 22, 56, 23, W[0]);
    // the upper fangs hanging from the jaw line, the front ones longest
    for (const [x, len] of [[28, 5], [33, 6], [38, 6], [43, 7], [48, 7], [53, 8], [58, 9]]) fang(p, x, 36, 4, len, 1, 1);
  });
  const jaw = make(50, 30, (p) => {
    p.poly([[0, 9], [8, 7], [40, 10], [48, 13], [45, 19], [32, 24], [12, 25], [0, 20]], W[2]);
    p.poly([[2, 10], [8, 9], [40, 12], [46, 14], [45, 15], [3, 12]], M[2]);
    p.poly([[2, 19], [12, 23], [32, 22], [44, 18], [30, 26], [12, 27]], W[1]);
    p.line(4, 17, 40, 17, W[4]);
    pustule(p, 14, 20, 2);
    // the lower fangs, up from the gum, the front ones longest
    for (const [x, len] of [[14, 5], [20, 6], [26, 6], [32, 7], [38, 7], [43, 8]]) fang(p, x, 11, 4, len, -1, 1);
  });
  // its throat behind the jaws: raw flesh round a gullet of fire
  const throat = make(44, 34, (p) => {
    p.ellipse(22, 17, 20, 15, M[0]);
    p.ellipse(23, 17, 17, 12, M[1]);
    p.ellipse(25, 18, 12, 8, M[2]);
    p.ellipse(20, 17, 7, 6, L[2]);
    p.ellipse(19, 17, 4, 4, L[4]);
    p.px(18, 16, L[6]);
    p.ellipse(32, 24, 8, 3, M[3]);
    p.line(28, 23, 36, 23, M[4]);
  });
  // its tail (when it leaps clear): the plates tapering to a barbed point, facing right like the rest
  const tail = make(34, 40, (p) => {
    p.poly([[33, 6], [33, 34], [16, 30], [1, 21], [16, 11]], W[2]);
    p.poly([[33, 7], [16, 12], [6, 19], [33, 17]], W[4]);
    p.poly([[33, 28], [16, 29], [6, 23], [33, 33]], W[1]);
    p.line(22, 9, 22, 32, W[0]);
    p.line(23, 10, 23, 18, W[5]);
    p.line(1, 21, 10, 20, W[5]);
    pustule(p, 27, 20, 2);
  });
  // the rocks of its holes and the rubble it throws up: charred basalt and broken nether brick
  /** A broken, faceted rock: its outline `pts`, a lit top face, a shaded foot, a sharp lit edge. */
  const shard = (p, pts, top, R = R0) => {
    p.poly(pts, R[2]);
    p.poly(top, R[4]);
    const ys = pts.map((q) => q[1]);
    const low = Math.max(...ys);
    p.poly(pts.filter((q) => q[1] >= low - 3).concat([[pts[0][0], low - 2]]), R[1]);
    p.line(top[0][0], top[0][1], top[1][0], top[1][1], R[5]);
  };
  const R0 = ['#140808', '#2a1210', '#46201a', '#5e2c22', '#7c4030', '#a05a40'];   // scorched red rock, like its floor
  const rocks = [
    make(12, 11, (p) => shard(p, [[1, 6], [4, 1], [9, 2], [11, 7], [7, 10], [2, 9]], [[4, 1], [9, 2], [8, 5], [3, 5]])),
    make(15, 12, (p) => { shard(p, [[1, 7], [5, 1], [11, 1], [14, 6], [12, 11], [3, 11]], [[5, 1], [11, 1], [11, 5], [4, 6]]); ffCrack(p, [[5, 8], [9, 9]], false); }),
    make(17, 14, (p) => shard(p, [[1, 9], [3, 3], [8, 1], [15, 4], [16, 10], [10, 13], [3, 13]], [[3, 3], [8, 1], [15, 4], [9, 7], [3, 7]], R)),
    make(20, 16, (p) => { shard(p, [[1, 10], [5, 2], [13, 1], [19, 7], [17, 14], [6, 15]], [[5, 2], [13, 1], [17, 6], [10, 8], [4, 8]]); ffCrack(p, [[6, 11], [10, 9], [14, 11]]); }),
    make(15, 11, (p) => { p.poly([[1, 4], [12, 1], [14, 7], [3, 10]], B[3]); p.poly([[1, 4], [12, 1], [13, 4], [2, 6]], B[5]); p.line(7, 3, 8, 9, B[1]); }),
    make(24, 17, (p) => { shard(p, [[1, 12], [4, 5], [10, 1], [17, 3], [23, 9], [20, 16], [5, 16]], [[4, 5], [10, 1], [17, 3], [19, 8], [11, 9], [4, 9]], R); ffCrack(p, [[8, 12], [13, 13], [18, 10]]); }),
  ];
  Sprites.flameworm = {
    segments: [make(26, 50, (p) => segment(p, 1, true)), make(26, 50, (p) => segment(p, 0, false)), make(26, 50, (p) => segment(p, 2, true)), make(26, 50, (p) => segment(p, 0, true))],
    skull, jaw, throat, tail, rocks,
    // the bestiary's picture of it: the head, jaws agape
    head: PixelArt.make(72, 64, (p) => {
      p.ctx.drawImage(throat, 18, 26);
      p.ctx.save();
      p.ctx.translate(24, 38);
      p.ctx.rotate(0.45);
      p.ctx.drawImage(jaw, -3, -4);
      p.ctx.restore();
      p.ctx.drawImage(skull, 0, 0);
    }, null),
  };
}
