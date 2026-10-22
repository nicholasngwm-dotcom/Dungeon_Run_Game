// Graveyard enemy sprites (dungeon runs): the bodies are drawn in js/gfx/enemies/
// (the heroes' cute style); this builds their frames and the graveyard projectiles.
// Weapons that aim (sword, scythe, guns) are drawn at runtime by the enemy, not baked in.

const SKULL_ANCHOR = { x: 12, y: 18 };    // 24x24 flying skull

function buildGraveyardSprites() {
  Object.assign(Sprites.enemies, {
    bletcher: buildCuteEnemy(drawBletcher),
    skeletonWarrior: buildCuteEnemy(drawSkeletonWarrior),
    bomber: buildCuteEnemy(drawBomber),
    candlehead: buildCuteEnemy(drawCandlehead),
    shadowalker: buildCuteEnemy(drawShadowalker),
    necromancer: buildCuteEnemy(drawNecromancer),
    reaper: buildCuteEnemy(drawReaper),
    minigunner: buildCuteEnemy(drawMinigunner),   // drawn scaled up
    zombieSoldier: buildCuteEnemy(drawZombieSoldier),
    skeletonSorcerer: buildCuteEnemy(drawSkeletonSorcerer),
    flyingSkull: buildPoseFrames(drawFlyingSkull, 24, { idle: [{ flame: 0 }, { flame: 2 }] }, 0.5),
  });

  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  buildGraveCover();
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

/**
 * The graveyard's cover (DungeonRun.addCover): big weathered headstones (one tile)
 * and stone tombs (two tiles wide), lit from the top-left with moss, cracks, dirt
 * mounds and the odd flower. Variants are picked per piece.
 */
function buildGraveCover() {
  const STONE = ['#3e3c4c', '#56546a', '#6e6c80', '#8e8ca2', '#aeacc0'];
  const MOSS = ['#2e4a30', '#4e6e44', '#6a8e58'];
  const DIRT = ['#2e241a', '#3e3226', '#56462f'];
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.18, shade: 0.8 });
  const mound = (p, cx, y, rx) => {
    p.ellipse(cx, y, rx, 4, DIRT[1]);
    p.rect(cx - rx + 3, y - 2, rx * 2 - 6, 1, DIRT[2]);
    p.rect(cx - rx + 2, y + 2, rx * 2 - 4, 1, DIRT[0]);
  };
  const flowers = (p, x, y) => { p.px(x, y, '#e8e4f0'); p.px(x + 1, y + 1, '#c8b4e8'); p.px(x + 4, y, '#e8e4f0'); p.px(x + 1, y + 2, MOSS[1]); };
  const moss = (p, x, y, w) => {
    for (let i = 0; i < w; i += 2) p.rect(x + i, y - (i % 3), 2, 2 + (i % 3), MOSS[1]);
    p.rect(x + 1, y - 1, Math.max(1, Math.floor(w / 3)), 1, MOSS[2]);
  };

  Sprites.cover = {
    headstone: [
      // round-topped, a carved cross, moss creeping up
      make(30, 48, (p) => {
        mound(p, 15, 42, 14);
        p.round(5, 6, 20, 37, STONE[2], 7);
        p.rect(6, 12, 2, 28, STONE[3]);
        p.rect(9, 7, 10, 2, STONE[4]);
        p.rect(22, 12, 2, 29, STONE[1]);
        p.rect(14, 14, 3, 14, STONE[0]);
        p.rect(10, 18, 11, 3, STONE[0]);
        p.rect(9, 31, 13, 1, STONE[1]);
        p.rect(9, 34, 13, 1, STONE[1]);
        moss(p, 6, 39, 18);
        flowers(p, 22, 41);
      }),
      // a cross on a plinth
      make(30, 50, (p) => {
        mound(p, 15, 44, 14);
        p.rect(7, 36, 16, 8, STONE[1]);
        p.rect(7, 36, 16, 2, STONE[3]);
        p.rect(12, 4, 7, 33, STONE[2]);
        p.rect(4, 12, 23, 7, STONE[2]);
        p.rect(12, 4, 2, 32, STONE[3]);
        p.rect(4, 12, 23, 2, STONE[4]);
        p.rect(17, 19, 2, 17, STONE[1]);
        moss(p, 8, 41, 14);
        p.rect(18, 8, 1, 6, STONE[0]);   // a crack
      }),
      // cracked and chipped, leaning a little
      make(32, 48, (p) => {
        mound(p, 16, 42, 15);
        p.poly([[7, 42], [6, 14], [10, 7], [21, 5], [26, 10], [27, 42]], STONE[2]);
        p.poly([[21, 5], [26, 10], [23, 12], [19, 7]], STONE[0]);   // the missing chip
        p.rect(7, 14, 2, 26, STONE[3]);
        p.rect(24, 14, 2, 27, STONE[1]);
        p.line(16, 9, 13, 20, STONE[0]);
        p.line(13, 20, 17, 28, STONE[0]);
        p.rect(11, 31, 12, 1, STONE[1]);
        moss(p, 7, 39, 20);
        flowers(p, 3, 41);
      }),
    ],
    tomb: [
      // a stone sarcophagus: the lid's top, its front with a carved skull
      make(68, 46, (p) => {
        mound(p, 34, 41, 32);
        p.rect(5, 20, 58, 20, STONE[1]);
        p.rect(5, 20, 58, 2, STONE[2]);
        p.rect(2, 8, 64, 13, STONE[2]);
        p.rect(2, 8, 64, 3, STONE[4]);
        p.rect(4, 11, 60, 2, STONE[3]);
        p.rect(2, 20, 64, 2, STONE[0]);
        for (const x of [10, 54]) { p.rect(x, 24, 4, 14, STONE[2]); p.rect(x, 24, 1, 14, STONE[3]); }
        // the skull carving
        p.round(28, 24, 12, 10, STONE[3], 3);
        p.rect(30, 27, 3, 3, STONE[0]);
        p.rect(35, 27, 3, 3, STONE[0]);
        p.rect(31, 32, 6, 3, STONE[2]);
        p.rect(32, 33, 1, 2, STONE[0]);
        p.rect(35, 33, 1, 2, STONE[0]);
        moss(p, 6, 38, 22);
        moss(p, 44, 38, 16);
        p.line(48, 9, 44, 16, STONE[0]);   // a crack across the lid
        flowers(p, 60, 41);
      }),
      // a plainer tomb with a cross on the lid and ivy over one end
      make(68, 46, (p) => {
        mound(p, 34, 41, 32);
        p.rect(5, 20, 58, 20, STONE[1]);
        p.rect(2, 8, 64, 13, STONE[2]);
        p.rect(2, 8, 64, 3, STONE[4]);
        p.rect(2, 20, 64, 2, STONE[0]);
        p.rect(30, 10, 8, 9, STONE[3]);
        p.rect(24, 12, 20, 4, STONE[3]);
        p.rect(30, 10, 2, 9, STONE[4]);
        for (let x = 9; x < 60; x += 10) p.rect(x, 24, 1, 14, STONE[0]);
        // ivy hanging over the left end
        for (let y = 8; y < 38; y += 2) {
          const x = 3 + ((y * 7) % 5);
          p.rect(x, y, 3, 2, y % 4 ? MOSS[1] : MOSS[0]);
          if (y % 6 === 0) p.px(x + 3, y + 1, MOSS[2]);
        }
        moss(p, 30, 38, 26);
      }),
    ],
  };
}
