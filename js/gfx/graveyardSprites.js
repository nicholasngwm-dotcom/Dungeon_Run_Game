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
