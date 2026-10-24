// 20x20 icons for the shop upgrades (Sprites.upgrades, keyed by upgrade id): shown as they are
// in the HUD's upgrade tray and blown up in the shop and pause screens. Painted with the PixelArt
// toolkit like the ability icons: dark outline, lit from the top-left (bevel).

function buildUpgradeSprites() {
  const S = RAMP.steel;
  const G = RAMP.gold;
  const R = RAMP.red;
  const L = RAMP.leather;
  const SK = RAMP.skin;
  const TEAL = ['#0e3a3a', '#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'];
  const ICE = ['#2a5a8a', '#5a9ad0', '#9ad0ff', '#e6f6ff'];
  const FIRE = ['#e0461e', '#ff8a1e', '#ffd34a', '#fff6c8'];
  const PINK = ['#a0346a', '#e0609a', '#ff8ad0', '#ffd0e8'];
  const VIOLET = ['#3a1a6a', '#6a3aa0', '#a070e0', '#e0c8ff'];
  const N = 20;
  const icon = (fn) => PixelArt.bevel(PixelArt.make(N, N, fn, OUTLINE));

  // ---------- shared shapes ----------
  const heart = (p, cx, cy, s, col, light) => {
    p.circle(cx - 3 * s, cy - 2 * s, 3 * s, col);
    p.circle(cx + 3 * s, cy - 2 * s, 3 * s, col);
    p.poly([[cx - 6 * s - 0.5, cy - 1.5 * s], [cx + 6 * s + 1.5, cy - 1.5 * s], [cx + 0.5, cy + 6 * s]], col);
    if (light) p.rect(cx - 4 * s, cy - 4 * s, 2, 2, light);
  };
  const flame = (p, cx, by, w, h, cols = FIRE) => {
    p.poly([[cx - w, by], [cx - w * 0.6, by - h * 0.55], [cx - w * 0.15, by - h * 0.4], [cx, by - h], [cx + w * 0.45, by - h * 0.5], [cx + w, by]], cols[0]);
    p.ellipse(cx, by - 1, w, w * 0.6, cols[0]);
    p.poly([[cx - w * 0.6, by], [cx - w * 0.2, by - h * 0.5], [cx + w * 0.15, by - h * 0.65], [cx + w * 0.6, by]], cols[1]);
    p.ellipse(cx, by - 1, w * 0.55, w * 0.4, cols[2]);
  };
  const paw = (p, cx, cy, col, pad) => {
    p.ellipse(cx, cy + 2, 4, 3, col);
    for (const [dx, dy] of [[-5, -2], [-2, -5], [2, -5], [5, -2]]) p.circle(cx + dx, cy + dy, 1.6, col);
    if (pad) p.rect(cx - 2, cy + 1, 2, 1, pad);
  };
  const plus = (p, cx, cy, col) => { p.rect(cx - 2, cy, 5, 1, col); p.rect(cx, cy - 2, 1, 5, col); };
  const upArrow = (p, cx, cy, col) => { p.poly([[cx - 3, cy], [cx + 4, cy], [cx + 0.5, cy - 4]], col); p.rect(cx - 1, cy, 3, 3, col); };
  const star = (p, cx, cy, r, col, core) => {
    p.poly([[cx - r, cy], [cx - 1, cy - 1], [cx, cy - r], [cx + 1, cy - 1], [cx + r + 1, cy], [cx + 1, cy + 1], [cx, cy + r + 1], [cx - 1, cy + 1]], col);
    if (core) p.rect(cx - 1, cy - 1, 2, 2, core);
  };
  const bolt = (p, x, y, col) => p.poly([[x + 3, y], [x + 7, y], [x + 4, y + 5], [x + 7, y + 5], [x + 1, y + 13], [x + 3, y + 7], [x, y + 7]], col);
  const kite = (p, x, y, field, rim, cross) => {
    p.poly([[x, y], [x + 12, y], [x + 12, y + 7], [x + 6, y + 15], [x, y + 7]], rim);
    p.poly([[x + 2, y + 2], [x + 10, y + 2], [x + 10, y + 7], [x + 6, y + 12], [x + 2, y + 7]], field);
    p.rect(x + 5, y + 3, 2, 9, cross);
    p.rect(x + 3, y + 5, 6, 2, cross);
  };
  const rocket = (p, x, y, body) => {
    p.rect(x, y + 3, 4, 10, body);
    p.poly([[x - 0.5, y + 3.5], [x + 2, y - 0.5], [x + 4.5, y + 3.5]], G[3]);
    p.rect(x - 1, y + 11, 6, 2, S[2]);
    p.rect(x + 1, y + 4, 1, 7, '#ee6a4a');
  };
  const dagger = (p, x0, y0, x1, y1) => {
    p.line(x0, y0, x1, y1, S[4], 2);
    p.line(x0 + 1, y0, x1, y1 + 1, S[5], 1);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const gx = x0 + Math.cos(a) * 3;
    const gy = y0 + Math.sin(a) * 3;
    p.line(gx - Math.sin(a) * 3, gy + Math.cos(a) * 3, gx + Math.sin(a) * 3, gy - Math.cos(a) * 3, G[2], 2);
    p.line(x0 - Math.cos(a) * 3, y0 - Math.sin(a) * 3, x0, y0, '#9a2230', 2);
  };
  const ring = (p, cx, cy, r, col, size = 1, sy = 1) => {
    for (let a = 0; a < TAU; a += 0.18) p.rect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy, size, size, col);
  };

  const U = {};

  // ---------- shared upgrades ----------
  U.vitalHeart = icon((p) => {
    heart(p, 9, 10, 1.15, R[3], '#ff9a9a');
    p.rect(5, 7, 3, 3, R[4]);
    plus(p, 15, 3, G[3]);
  });
  U.revitalisingBlood = icon((p) => {
    p.poly([[8, 2], [13, 10], [3, 10]], R[3]);
    p.circle(8, 12, 5, R[3]);
    p.circle(8, 13, 3, R[2]);
    p.rect(6, 8, 2, 3, '#ff9a9a');
    plus(p, 15, 13, '#6cff7a');
    plus(p, 15, 5, '#b8ffc0');
  });
  U.piercingCrit = icon((p) => {
    p.line(2, 17, 15, 4, L[4], 2);
    p.poly([[12, 3], [18, 1], [16, 7]], G[3]);
    for (const [x, y] of [[3, 15], [5, 17]]) p.line(x - 2, y + 1, x, y - 1, '#efe6d2', 1);
    star(p, 9, 10, 4, G[2], '#ffffff');
  });
  U.deadlyPrecision = icon((p) => {
    p.circle(10, 10, 8, '#ff9a2a');
    p.circle(10, 10, 6, '#3a2418');
    p.circle(10, 10, 4, '#ff9a2a');
    p.circle(10, 10, 3, '#3a2418');
    p.rect(9, 1, 2, 6, '#ffe0a0');
    p.rect(9, 13, 2, 6, '#ffe0a0');
    p.rect(1, 9, 6, 2, '#ffe0a0');
    p.rect(13, 9, 6, 2, '#ffe0a0');
    p.rect(9, 9, 2, 2, '#ff3a3a');
  });
  U.burstDodging = icon((p) => {
    for (const x of [2, 9]) p.poly([[x, 3], [x + 4, 3], [x + 9, 10], [x + 4, 17], [x, 17], [x + 5, 10]], x === 2 ? ICE[1] : ICE[2]);
    p.rect(1, 9, 2, 2, ICE[3]);
  });
  U.firstEncounter = icon((p) => {
    star(p, 10, 10, 8, G[2]);
    star(p, 10, 10, 5, G[3]);
    p.rect(9, 5, 3, 7, R[2]);
    p.rect(9, 13, 3, 2, R[2]);
  });
  U.fightingSpirit = icon((p) => {
    flame(p, 10, 17, 8, 16);
    p.round(5, 8, 10, 8, SK[2], 2);
    for (let i = 0; i < 3; i++) p.rect(6 + i * 3, 8, 1, 3, SK[1]);
    p.rect(4, 11, 3, 4, SK[2]);
    p.rect(7, 15, 6, 2, '#a63036');
  });
  U.beatdown = icon((p) => {
    for (const [a, l] of [[-2.4, 4], [-1.6, 5], [-0.8, 4]]) p.line(12 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 12 + Math.cos(a) * (4 + l), 8 + Math.sin(a) * (4 + l), '#ff5a3a', 1);
    p.round(3, 9, 11, 8, S[3], 2);
    for (let i = 0; i < 3; i++) p.rect(4 + i * 3, 9, 1, 3, S[2]);
    p.rect(3, 15, 11, 3, L[3]);
    p.rect(4, 10, 8, 1, S[5]);
    star(p, 15, 6, 3, '#ff8a3a', '#fff2a0');
  });
  U.manaCrystal = icon((p) => {
    p.poly([[10, 1], [14, 6], [12, 18], [8, 18], [6, 6]], TEAL[2]);
    p.poly([[10, 1], [14, 6], [12, 18], [10, 18]], TEAL[1]);
    p.poly([[4, 8], [7, 10], [7, 18], [3, 18], [2, 11]], TEAL[1]);
    p.poly([[16, 9], [18, 12], [17, 18], [14, 18], [14, 11]], TEAL[2]);
    p.rect(8, 5, 1, 7, TEAL[4]);
  });
  U.celestialPeach = icon((p) => {
    p.circle(10, 11, 7, PINK[2]);
    p.ellipse(13, 12, 3, 5, PINK[1]);
    p.line(10, 5, 10, 11, PINK[1], 1);
    p.poly([[10, 4], [16, 1], [14, 5]], '#5ab84a');
    p.rect(6, 8, 2, 2, PINK[3]);
    star(p, 4, 3, 2, '#fff2a0', '#ffffff');
  });
  U.totalLoyalty = icon((p) => {
    paw(p, 9, 11, G[2], G[1]);
    heart(p, 15, 4, 0.5, R[3]);
  });
  U.strongerBuddies = icon((p) => {
    paw(p, 8, 11, '#7ac850', '#4a8a32');
    upArrow(p, 15, 7, G[3]);
  });
  U.longerReach = icon((p) => {
    p.line(4, 15, 15, 4, S[4], 2);
    p.line(5, 15, 15, 5, S[5], 1);
    p.line(3, 11, 7, 15, G[2], 2);
    p.line(2, 16, 4, 14, L[3], 2);
    p.poly([[13, 1], [19, 1], [19, 7]], '#c8d8e8');
    p.rect(14, 11, 4, 1, '#c8d8e8');
    p.rect(16, 9, 1, 4, '#c8d8e8');
  });
  U.panicGetaway = icon((p) => {
    p.rect(8, 4, 6, 9, L[3]);
    p.rect(8, 11, 10, 5, L[3]);
    p.rect(8, 15, 10, 2, L[1]);
    p.rect(9, 5, 4, 1, L[4]);
    for (const [y, w] of [[6, 5], [10, 6], [14, 4]]) p.rect(1, y, w, 1, '#b8f06a');
    p.poly([[16, 1], [18, 5], [14, 5]], '#8ad8ff');
    p.circle(16, 5, 2, '#8ad8ff');
  });
  U.warDetermination = icon((p) => {
    p.rect(4, 1, 12, 2, L[4]);
    p.rect(4, 17, 12, 2, L[4]);
    p.poly([[5, 3], [15, 3], [11, 10], [15, 17], [5, 17], [9, 10]], '#c8d8e8');
    p.poly([[7, 4], [13, 4], [10, 8]], VIOLET[2]);
    p.poly([[10, 12], [14, 16], [6, 16]], VIOLET[2]);
    p.rect(9, 9, 2, 3, VIOLET[3]);
  });
  U.blazeborn = icon((p) => {
    flame(p, 10, 18, 8, 17);
    p.rect(8, 9, 1, 4, FIRE[3]);
  });
  U.heartOfFrost = icon((p) => {
    heart(p, 10, 10, 1.15, ICE[1], ICE[3]);
    p.line(10, 4, 10, 14, ICE[3], 1);
    p.line(6, 9, 14, 9, ICE[3], 1);
    p.line(7, 6, 13, 12, '#ffffff', 1);
    p.line(13, 6, 7, 12, '#ffffff', 1);
  });
  U.radialBarrier = icon((p) => {
    ring(p, 10, 10, 8, '#6ae0c8', 2);
    p.poly([[5, 15], [7, 8], [9, 15]], S[3]);
    p.poly([[9, 15], [11, 6], [13, 15]], S[4]);
    p.poly([[12, 15], [14, 9], [16, 15]], S[3]);
    p.rect(4, 15, 12, 2, L[2]);
  });
  U.lastDefence = icon((p) => {
    kite(p, 4, 2, '#3a6ac8', S[3], '#e6f6ff');
    ring(p, 10, 10, 9, '#6aa8ff', 1);
  });
  U.biggerMagazine = icon((p) => {
    p.rect(1, 14, 18, 3, L[2]);
    for (const x of [2, 7, 12]) rocket(p, x, 1, '#c8342a');
    plus(p, 17, 3, G[3]);
  });
  U.chestsOfAlchemy = icon((p) => {
    p.round(2, 9, 16, 9, L[3], 1);
    p.rect(2, 9, 16, 3, L[4]);
    p.rect(2, 12, 16, 1, G[1]);
    p.rect(9, 11, 2, 3, G[2]);
    p.rect(7, 3, 4, 2, '#c8d8e8');
    p.circle(9, 7, 3, '#d8303a');
    p.rect(8, 6, 1, 1, '#ff9a9a');
    p.rect(8, 1, 2, 2, L[4]);
  });
  U.coinSiphon = icon((p) => {
    for (const [y, c] of [[15, G[1]], [12, G[2]], [9, G[2]]]) { p.ellipse(8, y, 6, 2, c); p.rect(3, y - 1, 1, 1, G[3]); }
    p.circle(15, 5, 3, G[2]);
    p.rect(14, 4, 1, 2, G[3]);
    for (const [x, y] of [[12, 9], [13, 8]]) p.px(x, y, '#ffffff');
  });
  U.lifeLeech = icon((p) => {
    p.poly([[3, 3], [9, 3], [6, 13]], '#f4ead7');
    p.poly([[11, 3], [17, 3], [14, 13]], '#f4ead7');
    p.rect(2, 2, 16, 2, '#9a1a32');
    p.poly([[13, 12], [16, 17], [10, 17]], R[3]);
    p.circle(13, 16, 3, R[3]);
    p.rect(12, 14, 1, 2, '#ff9aaa');
  });
  U.teslaArmour = icon((p) => {
    p.poly([[3, 3], [7, 2], [10, 4], [13, 2], [17, 3], [16, 12], [10, 18], [4, 12]], S[3]);
    p.poly([[5, 4], [8, 4], [10, 6], [12, 4], [15, 4], [14, 11], [10, 16], [6, 11]], S[2]);
    bolt(p, 6, 4, '#6ad8ff');
    p.px(10, 6, '#ffffff');
  });

  // ---------- hero upgrades ----------
  U.barrierField = icon((p) => {
    ring(p, 10, 10, 9, '#8ab8ff', 2, 0.9);
    kite(p, 4, 3, R[3], S[3], S[5]);
  });
  U.pinningCharge = icon((p) => {
    // the shield driving into a wall, impact lines and a dazed star off it
    p.rect(16, 1, 3, 18, S[1]);
    for (const y of [4, 9, 14]) p.rect(16, y, 3, 1, S[0]);
    kite(p, 3, 3, R[3], S[3], S[5]);
    for (const [x0, y0, x1, y1] of [[15, 2, 13, 0], [15, 17, 13, 19]]) p.line(x0, y0, x1, y1, G[3], 1);
    p.line(1, 9, 3, 9, '#e0a83a', 1);
    p.line(0, 13, 3, 12, '#e0a83a', 1);
    star(p, 4, 2, 2, G[3], '#ffffff');
  });
  U.razorArrows = icon((p) => {
    p.line(2, 18, 11, 9, L[4], 2);
    p.poly([[9, 5], [16, 2], [14, 7], [17, 8], [12, 12], [12, 9]], S[4]);
    p.line(10, 8, 15, 3, S[5], 1);
    for (const [x, y] of [[15, 12], [17, 16], [12, 16]]) { p.rect(x, y, 2, 2, '#ff4a5a'); p.px(x, y + 2, '#9a1a32'); }
  });
  U.confusionCloud = icon((p) => {
    for (const [x, y, r] of [[6, 11, 5], [13, 10, 5], [10, 7, 5], [10, 13, 4]]) p.circle(x, y, r, '#4a8a32');
    for (const [x, y, r] of [[7, 10, 3], [12, 8, 3]]) p.circle(x, y, r, '#7ae05a');
    p.rect(8, 6, 2, 1, '#ffe680');
    p.rect(10, 7, 1, 2, '#ffe680');
    p.rect(9, 9, 1, 2, '#ffe680');
    p.rect(9, 12, 1, 1, '#ffe680');
  });
  U.empoweredSurge = icon((p) => {
    p.circle(8, 11, 6, TEAL[1]);
    p.circle(8, 11, 4, TEAL[2]);
    p.circle(7, 10, 2, TEAL[4]);
    upArrow(p, 15, 8, '#5af0e0');
    star(p, 15, 15, 2, TEAL[3], '#ffffff');
  });
  U.magicAura = icon((p) => {
    ring(p, 10, 11, 8, TEAL[2], 2, 0.6);
    ring(p, 10, 11, 5, TEAL[3], 1, 0.6);
    star(p, 10, 8, 4, TEAL[3], '#ffffff');
    p.rect(3, 4, 2, 2, TEAL[3]);
    p.rect(16, 5, 1, 1, TEAL[4]);
  });
  U.birdieTrail = icon((p) => {
    for (let a = 0.6; a < TAU - 0.2; a += 0.45) p.rect(10 + Math.cos(a) * 7, 11 + Math.sin(a) * 6, 2, 2, VIOLET[2]);
    p.ellipse(15, 5, 3, 2, '#2a2129');
    p.poly([[13, 4], [17, 1], [16, 5]], '#3c3038');
    p.rect(17, 5, 2, 1, G[2]);
    p.px(15, 4, TEAL[3]);
    star(p, 9, 11, 2, VIOLET[3], '#ffffff');
  });
  U.throwingStamina = icon((p) => {
    dagger(p, 4, 15, 15, 4);
    bolt(p, 11, 6, '#f0c040');
  });
  U.mimicClones = icon((p) => {
    for (const [x, col, dark] of [[9, '#6a1a24', '#4a1a24'], [3, '#c43a44', '#9a2230']]) {
      p.circle(x + 4, 6, 4, col);
      p.poly([[x, 18], [x + 1, 10], [x + 7, 10], [x + 8, 18]], col);
      p.rect(x + 2, 6, 4, 2, dark);
      p.rect(x + 3, 6, 1, 1, '#ffd0c0');
      p.rect(x + 5, 6, 1, 1, '#ffd0c0');
    }
  });
  U.blindingLight = icon((p) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      p.line(10 + Math.cos(a) * 5, 10 + Math.sin(a) * 5, 10 + Math.cos(a) * 9, 10 + Math.sin(a) * 9, i % 2 ? '#ffe680' : '#fff6c8', 2);
    }
    p.circle(10, 10, 5, '#ffe680');
    p.circle(10, 10, 3, '#fff6c8');
    p.rect(9, 9, 2, 2, '#ffffff');
  });
  U.resurrect = icon((p) => {
    // a soul rising in a shaft of light, a halo over it
    p.poly([[5, 19], [7, 4], [13, 4], [15, 19]], G[1]);
    p.ellipse(10, 4, 5, 2, '#ffe680');
    p.ellipse(10, 4, 3, 1, '#a07a24');
    p.circle(10, 9, 3, '#fff6c8');
    p.poly([[6, 18], [7.5, 12], [12.5, 12], [14, 18]], '#fff6c8');
    p.line(7, 13, 3, 10, '#ffffff', 1);
    p.line(13, 13, 17, 10, '#ffffff', 1);
    p.rect(9, 8, 1, 1, '#a07a24');
    p.rect(11, 8, 1, 1, '#a07a24');
    star(p, 16, 4, 2, '#ffffff', '#ffe680');
  });
  U.groggy = icon((p) => {
    // a sleepy crescent moon (a circle with a bite taken out) and its z's
    p.circle(7, 12, 6, '#e0d8ff');
    p.ctx.globalCompositeOperation = 'destination-out';
    p.circle(11, 9, 5, '#000000');
    p.ctx.globalCompositeOperation = 'source-over';
    p.rect(12, 2, 6, 1, VIOLET[2]);
    p.line(17, 3, 12, 7, VIOLET[2], 1);
    p.rect(12, 7, 6, 1, VIOLET[2]);
    p.rect(14, 10, 4, 1, VIOLET[3]);
    p.line(17, 11, 14, 13, VIOLET[3], 1);
    p.rect(14, 13, 4, 1, VIOLET[3]);
  });
  U.warSong = icon((p) => {
    // a bold music note inside a ring of shield
    ring(p, 10, 10, 9, '#ff9a5a', 2, 0.9);
    p.circle(7, 14, 3, '#ffb07a');
    p.circle(13, 12, 3, '#ffb07a');
    p.rect(9, 4, 2, 10, '#ffb07a');
    p.rect(15, 2, 2, 10, '#ffb07a');
    p.poly([[9, 4], [17, 2], [17, 5], [9, 7]], '#ff9a5a');
    p.rect(6, 13, 1, 1, '#ffffff');
    p.rect(12, 11, 1, 1, '#ffffff');
  });
  U.rapidReload = icon((p) => {
    // a rocket with a reload arrow curling round it
    for (let a = 0.4; a < TAU - 1.2; a += 0.35) p.rect(10 + Math.cos(a) * 8, 10 + Math.sin(a) * 8, 2, 2, '#ffb84a');
    p.poly([[14, 1], [19, 3], [15, 6]], '#ffb84a');
    rocket(p, 8, 4, '#c8342a');
    star(p, 4, 15, 2, G[3], '#ffffff');
  });
  U.incendiary = icon((p) => {
    flame(p, 8, 19, 5, 9);
    p.rect(9, 2, 5, 10, '#c8342a');
    p.poly([[8.5, 2.5], [11.5, -1], [14.5, 2.5]], G[3]);
    p.rect(8, 10, 7, 2, S[2]);
    p.rect(10, 3, 1, 7, '#ee6a4a');
  });
  U.premiumBaking = icon((p) => {
    p.poly([[3, 11], [17, 11], [15, 18], [5, 18]], '#d8a060');
    for (let x = 5; x < 16; x += 3) p.rect(x, 12, 1, 6, '#a07038');
    p.circle(10, 9, 6, PINK[2]);
    p.circle(7, 7, 2, PINK[3]);
    p.circle(10, 3, 2, '#d8303a');
    p.px(9, 2, '#ff9a9a');
    star(p, 16, 4, 2, G[3], '#ffffff');
  });
  U.biggerCakes = icon((p) => {
    p.poly([[2, 9], [14, 4], [14, 17], [2, 17]], '#f4e0b8');
    p.poly([[2, 9], [14, 4], [14, 7], [2, 12]], PINK[2]);
    p.rect(2, 13, 12, 1, PINK[1]);
    for (const x of [4, 8, 12]) p.rect(x, 9 - (x - 2) / 3, 1, 3, '#ffffff');
    upArrow(p, 17, 7, G[3]);
  });

  Sprites.upgrades = U;
}
