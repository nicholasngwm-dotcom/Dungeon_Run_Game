// Room walls and wreckage. Short stretches of wall that stand inside the fight rooms
// (DungeonRun.addWalls) in each theme's style: the graveyard's mossy mausoleum stone and
// the keep's crenellated brick wound with black thorns. Each comes as a horizontal run
// (3 tiles wide) and an upright one (3 tiles deep: mostly its top, with its south face at
// the bottom). Then the rubble left where any obstacle stood once it's blown apart
// (DungeonRun.destroyObstacles): stone chunks, splintered wood, twisted iron and torn
// greenery, laid flat on the floor.

function buildObstacleSprites() {
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.18, shade: 0.8 });
  const GRAVE = ['#3e3c4c', '#56546a', '#6e6c80', '#8e8ca2', '#aeacc0'];
  const MOSS = ['#2e4a30', '#4e6e44', '#6a8e58'];
  const DIRT = ['#2e241a', '#3e3226', '#56462f'];
  const KEEP = ['#26222e', '#36313f', '#3c3748', '#565068', '#6c6484'];
  const THORN = ['#120c16', '#2a1e30', '#9a6ad8'];

  /** A face of staggered blocks: rows `rh` tall over x..x+w, y..y+h, mortar between, lit along each block's top. */
  const blocks = (p, x, y, w, h, R, rh, bw, seed = 0) => {
    p.rect(x, y, w, h, R[1]);
    for (let row = 0, yy = y; yy < y + h; row++, yy += rh) {
      const off = row % 2 ? Math.floor(bw / 2) : 0;
      for (let bx = x - off; bx < x + w; bx += bw) {
        const x0 = Math.max(x, bx);
        const x1 = Math.min(x + w, bx + bw - 1);
        const hh = Math.min(rh - 1, y + h - yy);
        if (x1 <= x0 || hh <= 0) continue;
        const shade = ((bx * 7 + row * 13 + seed) % 5) === 0 ? R[1] : R[2];
        p.rect(x0, yy, x1 - x0, hh, shade);
        p.rect(x0, yy, x1 - x0, 1, R[3]);
        p.px(x0, yy, R[4]);
      }
    }
  };
  const moss = (p, x, y, w) => {
    for (let i = 0; i < w; i += 2) p.rect(x + i, y - (i % 3), 2, 2 + (i % 3), MOSS[1]);
    p.rect(x + 1, y - 1, Math.max(1, Math.floor(w / 3)), 1, MOSS[2]);
  };
  const thorns = (p, x, y, w) => {
    for (let i = 0; i < w; i += 2) {
      const vy = y + Math.round(Math.sin(i * 0.5) * 3);
      p.rect(x + i, vy, 2, 2, THORN[0]);
      if (i % 8 === 0) { p.px(x + i, vy - 1, THORN[2]); p.px(x + i + 1, vy + 2, THORN[1]); }
    }
  };

  Object.assign(Sprites.cover, {
    // the graveyard: a run of old mausoleum wall, its coping chipped, moss at the foot
    graveWallH: [make(96, 62, (p) => {
      p.ellipse(48, 58, 47, 4, DIRT[1]);
      blocks(p, 1, 22, 94, 34, GRAVE, 9, 16, 1);
      // the coping slab along the top, chipped in two places
      p.rect(0, 10, 96, 13, GRAVE[2]);
      p.rect(0, 10, 96, 3, GRAVE[4]);
      p.rect(1, 13, 94, 1, GRAVE[3]);
      p.rect(0, 21, 96, 2, GRAVE[0]);
      p.poly([[20, 10], [27, 10], [25, 15], [21, 14]], GRAVE[0]);
      p.poly([[70, 10], [74, 10], [73, 13]], GRAVE[0]);
      for (const x of [12, 46, 80]) { p.rect(x, 4, 4, 7, GRAVE[1]); p.rect(x, 4, 4, 1, GRAVE[3]); p.circle(x + 2, 3, 2, GRAVE[2]); }   // little finials
      p.line(58, 24, 54, 38, GRAVE[0]);
      p.line(54, 38, 59, 50, GRAVE[0]);
      moss(p, 2, 55, 30);
      moss(p, 60, 55, 26);
      moss(p, 30, 22, 10);
    })],
    graveWallV: [make(34, 126, (p) => {
      p.ellipse(17, 122, 16, 4, DIRT[1]);
      // its long top, seen from above: coping slabs end to end
      p.rect(1, 2, 32, 96, GRAVE[2]);
      for (let y = 2; y < 96; y += 24) {
        p.rect(1, y, 32, 2, GRAVE[4]);
        p.rect(1, y + 22, 32, 2, GRAVE[0]);
        p.rect(1, y + 2, 2, 20, GRAVE[3]);
        p.rect(31, y + 2, 2, 20, GRAVE[1]);
      }
      p.line(12, 30, 18, 44, GRAVE[0]);
      moss(p, 4, 72, 10);
      // the south face
      blocks(p, 1, 98, 32, 22, GRAVE, 8, 11, 3);
      p.rect(1, 98, 32, 1, GRAVE[4]);
      moss(p, 3, 121, 26);
    })],
    // the keep: a stretch of curtain wall, crenellated, thorns creeping along it
    keepWallH: [make(96, 64, (p) => {
      p.rect(0, 58, 96, 4, KEEP[0]);
      blocks(p, 1, 24, 94, 34, KEEP, 8, 14, 2);
      // the wall walk and its merlons
      p.rect(0, 16, 96, 9, KEEP[3]);
      p.rect(0, 16, 96, 2, KEEP[4]);
      p.rect(0, 23, 96, 2, KEEP[0]);
      for (let x = 2; x < 96; x += 16) {
        p.rect(x, 4, 10, 13, KEEP[2]);
        p.rect(x, 4, 10, 2, KEEP[4]);
        p.rect(x, 4, 2, 13, KEEP[3]);
        p.rect(x + 8, 6, 2, 11, KEEP[1]);
      }
      p.rect(44, 30, 4, 10, KEEP[0]);   // an arrow slit
      p.rect(45, 31, 2, 8, '#0c0a10');
      thorns(p, 4, 52, 40);
      thorns(p, 62, 48, 30);
    })],
    keepWallV: [make(34, 128, (p) => {
      p.rect(1, 120, 32, 6, KEEP[0]);
      // the long wall walk from above, merlons down both edges
      p.rect(1, 2, 32, 96, KEEP[3]);
      for (let y = 4; y < 94; y += 14) {
        for (const x of [1, 27]) {
          p.rect(x, y, 6, 9, KEEP[2]);
          p.rect(x, y, 6, 2, KEEP[4]);
          p.rect(x, y + 7, 6, 2, KEEP[1]);
        }
      }
      for (let y = 10; y < 96; y += 12) p.rect(9, y, 16, 1, KEEP[2]);
      thorns(p, 10, 60, 14);
      // the south face
      blocks(p, 1, 98, 32, 22, KEEP, 8, 12, 5);
      p.rect(1, 98, 32, 1, KEEP[4]);
      thorns(p, 3, 112, 26);
    })],
  });

  // the Deathbringer's room (DungeonRun.cryptTombs): obsidian sarcophagi bound in tarnished gold, a hooded
  // reaper inlaid on the front and violet runes along the lid; one sealed, one with its lid cracked and the dark
  // seeping out (2x1 tiles, like the graveyard's tomb)
  const OBS = ['#0c0812', '#171021', '#241a33', '#36294a', '#4c3a66'];
  const GOLD = ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'];
  const RUNE = ['#4a2a8a', '#9a6aff', '#d8c0ff'];
  const darkTomb = (cracked) => make(68, 46, (p) => {
    p.ellipse(34, 42, 32, 4, '#0a0610');
    // the box: its front face between squat stone corner pillars (a coffin's shape, not a chest's), on a dark plinth
    p.rect(5, 20, 58, 20, OBS[1]);
    p.rect(5, 20, 58, 2, OBS[2]);
    for (const x of [5, 57]) { p.rect(x, 20, 6, 20, OBS[3]); p.rect(x, 20, 1, 20, OBS[4]); p.rect(x + 5, 20, 1, 20, OBS[0]); }
    p.rect(3, 38, 62, 3, OBS[0]);
    p.rect(3, 38, 62, 1, OBS[2]);
    // the lid: wider than the box, a lit top edge and a thin tarnished-gold rim
    p.rect(2, 8, 64, 13, OBS[2]);
    p.rect(2, 8, 64, 3, OBS[4]);
    p.rect(4, 11, 60, 2, OBS[3]);
    p.rect(2, 20, 64, 1, GOLD[1]);
    // runes carved along the lid, glowing violet
    for (let x = 9; x < 60; x += 7) {
      p.rect(x, 14, 1, 3, RUNE[1]);
      p.rect(x + 1, 13 + (x % 3), 2, 1, RUNE[1]);
      if (x % 2) p.px(x, 14, RUNE[2]);
    }
    // the reaper inlaid in gold on the front: a hood, a dark face, a scythe across it
    p.round(29, 23, 10, 13, GOLD[1], 4);
    p.round(30, 24, 8, 11, GOLD[2], 3);
    p.round(31, 26, 6, 6, OBS[0], 2);
    p.px(32, 28, RUNE[1]);
    p.px(35, 28, RUNE[1]);
    p.line(22, 34, 45, 24, GOLD[1], 1);
    p.line(42, 22, 47, 25, GOLD[2], 1);
    // engraved side panels
    for (const x of [14, 48]) { p.rect(x, 24, 6, 12, OBS[0]); p.rect(x + 1, 25, 4, 10, OBS[2]); }
    if (cracked) {
      // the lid split across, the dark and a violet light seeping out of the crack
      p.line(40, 8, 34, 15, OBS[0], 2);
      p.line(34, 15, 37, 20, OBS[0], 2);
      p.line(41, 9, 35, 15, RUNE[1], 1);
      p.px(36, 16, RUNE[2]);
      p.rect(33, 4, 3, 4, '#1e1028');
      p.rect(37, 2, 2, 5, '#1e1028');
      p.px(34, 3, RUNE[0]);
    } else {
      // a gold skull-clasp sealing the lid
      p.round(31, 15, 6, 5, GOLD[2], 2);
      p.px(32, 16, OBS[0]);
      p.px(35, 16, OBS[0]);
    }
  });
  Sprites.cover.darkTomb = [darkTomb(false), darkTomb(true)];

  // square 2x2 blocks for the room layouts (DungeonRun.addLayout): its top seen from above, its south face below
  Object.assign(Sprites.cover, {
    // a squat mausoleum block: a slab roof with a carved cross, mossy stone walls
    graveBlock: [make(66, 92, (p) => {
      p.ellipse(33, 88, 32, 4, DIRT[1]);
      p.rect(1, 6, 64, 58, GRAVE[2]);
      p.rect(1, 6, 64, 3, GRAVE[4]);
      p.rect(1, 9, 3, 53, GRAVE[3]);
      p.rect(61, 9, 4, 53, GRAVE[1]);
      p.rect(5, 12, 56, 46, GRAVE[3]);
      p.rect(7, 14, 52, 42, GRAVE[2]);
      p.rect(30, 20, 6, 30, GRAVE[1]);   // the carved cross on the roof
      p.rect(20, 28, 26, 6, GRAVE[1]);
      p.rect(31, 21, 4, 28, GRAVE[4]);
      moss(p, 8, 54, 14);
      blocks(p, 1, 62, 64, 24, GRAVE, 8, 16, 7);
      p.rect(1, 62, 64, 1, GRAVE[4]);
      p.rect(28, 66, 10, 20, GRAVE[0]);   // a sealed door
      p.rect(29, 67, 8, 18, '#2a2834');
      moss(p, 3, 86, 60);
    })],
    // a squat tower block: a crenellated top, brick walls with an arrow slit, thorns creeping up
    keepBlock: [make(66, 92, (p) => {
      p.rect(1, 84, 64, 6, KEEP[0]);
      p.rect(1, 8, 64, 56, KEEP[3]);
      for (let i = 0; i < 4; i++) {
        for (const [x, y] of [[1 + i * 16, 4], [1 + i * 16, 56]]) {
          p.rect(x, y, 12, 8, KEEP[2]);
          p.rect(x, y, 12, 2, KEEP[4]);
        }
      }
      for (const y of [12, 50]) for (const x of [1, 57]) { p.rect(x, y, 8, 8, KEEP[2]); p.rect(x, y, 8, 2, KEEP[4]); }
      p.rect(12, 20, 42, 28, KEEP[1]);   // the floor of the tower top, in shade
      p.rect(12, 20, 42, 2, KEEP[0]);
      blocks(p, 1, 62, 64, 24, KEEP, 8, 14, 3);
      p.rect(1, 62, 64, 1, KEEP[4]);
      p.rect(31, 66, 4, 14, KEEP[0]);
      p.rect(32, 67, 2, 12, '#0c0a10');
      thorns(p, 4, 78, 26);
      thorns(p, 40, 70, 22);
    })],
  });

  // ---------- rubble: what's left once an obstacle is blown apart (lies flat, 34x22) ----------
  const rubble = (fn) => PixelArt.make(34, 22, fn, OUTLINE, 0.4);
  const chunk = (p, x, y, w, h, R) => {
    p.round(x, y, w, h, R[2], 1);
    p.rect(x + 1, y, w - 2, 1, R[3]);
    p.rect(x, y + h - 1, w, 1, R[1]);
  };
  const STONE = ['#3e3c4c', '#56546a', '#7a7890', '#a4a2b6'];
  const WOOD = ['#22150e', '#5b3922', '#7d532f', '#b08050'];
  const IRON = ['#1f2029', '#383b48', '#6a6f80', '#adb2c0'];
  const LEAF = ['#122016', '#264228', '#3e6a3a', '#6a9a52'];
  Sprites.rubble = {
    stone: [
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(30, 26, 34, 0.55)');
        chunk(p, 4, 9, 9, 7, STONE); chunk(p, 14, 6, 11, 9, STONE); chunk(p, 24, 11, 7, 6, STONE);
        chunk(p, 10, 15, 6, 4, STONE); chunk(p, 19, 15, 5, 4, STONE);
        for (const [x, y] of [[2, 17], [30, 8], [8, 6], [27, 18]]) p.rect(x, y, 2, 2, STONE[2]);
      }),
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(30, 26, 34, 0.55)');
        chunk(p, 3, 12, 12, 6, STONE); chunk(p, 16, 8, 8, 8, STONE); chunk(p, 22, 14, 9, 5, STONE);
        p.line(17, 9, 21, 15, STONE[0]);
        for (const [x, y] of [[13, 5], [29, 9], [6, 9], [15, 18]]) p.rect(x, y, 2, 2, STONE[3]);
      }),
    ],
    wood: [
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(30, 20, 14, 0.5)');
        p.line(3, 15, 18, 9, WOOD[2], 3); p.line(3, 15, 18, 9, WOOD[3]);
        p.line(14, 17, 31, 12, WOOD[1], 3); p.line(15, 16, 30, 11, WOOD[2]);
        p.poly([[18, 9], [21, 6], [20, 10]], WOOD[3]);   // a splintered end
        chunk(p, 22, 5, 7, 6, WOOD);
        for (const [x, y] of [[6, 7], [28, 18], [11, 19], [24, 3]]) p.rect(x, y, 2, 1, WOOD[3]);
        p.rect(9, 12, 1, 1, '#adb2c0');   // a bent nail
      }),
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(30, 20, 14, 0.5)');
        p.line(5, 9, 26, 17, WOOD[2], 3); p.line(5, 8, 26, 16, WOOD[3]);
        p.line(8, 17, 20, 6, WOOD[1], 2);
        chunk(p, 23, 8, 8, 6, WOOD);
        p.round(2, 13, 6, 5, IRON[2], 1);   // a barrel hoop
        for (const [x, y] of [[14, 19], [29, 5], [3, 5]]) p.rect(x, y, 2, 1, WOOD[3]);
      }),
    ],
    metal: [
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(20, 20, 28, 0.55)');
        p.line(4, 16, 14, 8, IRON[2], 2); p.line(14, 8, 22, 12, IRON[2], 2);
        p.line(18, 17, 30, 10, IRON[1], 2);
        chunk(p, 8, 12, 8, 5, IRON);
        p.circle(26, 15, 3, IRON[1]);
        for (const [x, y] of [[3, 9], [24, 5], [30, 17]]) p.px(x, y, IRON[3]);
      }),
    ],
    plant: [
      rubble((p) => {
        p.ellipse(17, 14, 15, 6, 'rgba(14, 24, 16, 0.5)');
        p.rect(15, 9, 4, 8, WOOD[1]);   // a snapped stump
        p.rect(15, 9, 4, 1, WOOD[3]);
        for (const [x, y] of [[4, 13], [9, 8], [22, 10], [27, 15], [10, 17], [24, 5], [3, 18]]) {
          p.ellipse(x, y, 3, 2, LEAF[2]);
          p.px(x - 1, y - 1, LEAF[3]);
        }
        p.px(20, 16, '#c03048'); p.px(7, 11, '#c03048');
      }),
    ],
  };
}
