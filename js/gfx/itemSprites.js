// Weapons, projectiles, pickups and placed items. Weapons point right (+x);
// `pivot` is the grip point they rotate around. Same ramps as the heroes.

function buildItemSprites() {
  const S = RAMP.steel;
  const L = RAMP.leather;
  const G = RAMP.gold;
  const R = RAMP.red;
  const B = CUTE.brass;                                                   // antique brass
  const YEW = ['#3a2010', '#6a3e1c', '#9a6430', '#c8904a'];               // longbow wood
  const TEAL = ['#0e3a3a', '#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'];   // the mage's ghostly magic
  const GO = ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'];                // the priestess's holy gold
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });

  /** Straight blade from x0 to x1 centred on row cy, half-height hh, with a point. */
  const blade = (p, x0, x1, cy, hh, ramp) => {
    p.poly([[x0, cy - hh], [x1 - hh * 2, cy - hh], [x1, cy + 0.5], [x1 - hh * 2, cy + hh + 1], [x0, cy + hh + 1]], ramp[3]);
    p.poly([[x0, cy - hh], [x1 - hh * 2, cy - hh], [x1, cy + 0.5], [x0, cy + 0.5]], ramp[4]);
    p.rect(x0, cy - hh, x1 - x0 - hh * 2, 1, ramp[5]);
    p.rect(x0 + 2, cy, x1 - x0 - hh * 2 - 2, 1, ramp[2]); // fuller
    p.rect(x0, cy + hh, x1 - x0 - hh * 2, 1, ramp[1]);
  };

  Sprites.weapons = {
    // the knight's greatblade: red-wrapped grip, brass guard with a ruby, broad steel blade
    greatblade: weapon(54, 16, 6, 8, (p) => {
      p.rect(2, 6, 8, 4, R[2]);
      for (let x = 3; x < 10; x += 2) p.rect(x, 6, 1, 4, R[1]); // grip wrap
      p.rect(2, 6, 8, 1, R[3]);
      p.round(0, 5, 4, 6, B[2], 1);                          // pommel
      p.px(1, 6, B[3]);
      p.rect(10, 2, 4, 12, B[1]);                            // crossguard with curled tips
      p.rect(10, 2, 2, 12, B[2]);
      p.rect(10, 2, 1, 5, B[3]);
      p.rect(9, 1, 3, 2, B[2]);
      p.rect(9, 13, 3, 2, B[1]);
      p.rect(11, 7, 2, 2, '#d0303a');
      p.px(11, 7, '#ff9a8a');
      blade(p, 14, 53, 7, 3, S);
      p.rect(16, 7, 20, 1, R[2]);                            // red etched fuller
    }),
    sword: weapon(38, 12, 4, 6, (p) => {
      p.rect(1, 5, 6, 3, L[2]);
      p.rect(1, 5, 2, 3, G[2]);
      p.rect(7, 1, 3, 10, G[1]);
      p.rect(7, 1, 2, 10, G[2]);
      blade(p, 10, 37, 6, 2, S);
    }),
    // the archer's medieval yew longbow: tall D-shaped stave, leather grip, horn nocks
    bow: weapon(14, 42, 3, 21, (p) => {
      for (let y = 1; y < 41; y++) {
        const t = (y - 1) / 39;
        const x = 2 + Math.round(7 * Math.sin(Math.PI * t));
        const grip = y > 17 && y < 25;
        const w = t < 0.1 || t > 0.9 ? 2 : 3;
        p.rect(x, y, w, 1, grip ? L[1] : YEW[2]);
        p.px(x, y, grip ? L[3] : YEW[3]);
        if (w === 3) p.px(x + 2, y, grip ? L[0] : YEW[1]);
      }
      p.rect(9, 17, 3, 1, '#c84040');                        // red cloth binding the grip
      p.rect(9, 25, 3, 1, '#c84040');
      p.rect(1, 0, 2, 2, '#e8dcc0');                         // horn nocks
      p.rect(1, 40, 2, 2, '#e8dcc0');
      p.rect(2, 2, 1, 38, '#efe6d2');                        // string
    }),
    boneBow: weapon(14, 32, 3, 16, (p) => {
      for (let y = 1; y < 31; y++) {
        const x = 2 + Math.round(8 * Math.sin((Math.PI * (y - 1)) / 29));
        p.rect(x, y, 2, 1, y > 12 && y < 20 ? '#5a4a3a' : '#cfc6ad');
        p.px(x, y, y > 12 && y < 20 ? '#7a6a58' : '#ebe5d3');
      }
      p.rect(2, 2, 1, 28, '#8a8070');
    }),
    // the mage's dark wood staff: brass bands, teal wrap, a brass crescent moon cradling a ghost-teal orb
    staff: weapon(46, 16, 10, 8, (p) => {
      p.rect(1, 7, 32, 3, L[2]);
      p.rect(1, 7, 32, 1, L[3]);
      p.rect(1, 9, 32, 1, L[1]);
      for (const x of [4, 22]) { p.rect(x, 6, 2, 5, B[1]); p.rect(x, 6, 2, 1, B[2]); }
      p.rect(12, 6, 4, 5, TEAL[1]);
      p.rect(12, 6, 4, 1, TEAL[2]);
      p.rect(30, 6, 4, 5, B[1]);                             // collar
      p.rect(30, 6, 4, 1, B[3]);
      for (let y = 2; y <= 14; y++) {                        // crescent: disc minus an offset disc
        for (let x = 33; x <= 45; x++) {
          const d1 = (x - 39) ** 2 + (y - 8) ** 2;
          const d2 = (x - 41) ** 2 + (y - 6) ** 2;
          if (d1 > 26 || d2 <= 17) continue;
          p.px(x, y, x < 37 && y < 9 ? B[3] : y > 10 ? B[1] : B[2]);
        }
      }
      for (let y = 4; y <= 10; y++) {                        // orb resting in the crescent
        for (let x = 37; x <= 43; x++) {
          if ((x - 40) ** 2 + (y - 7) ** 2 > 5) continue;
          p.px(x, y, x + y < 46 ? TEAL[3] : x + y > 48 ? TEAL[1] : TEAL[2]);
        }
      }
      p.px(39, 6, TEAL[4]);
    }),
    // the priestess's ivory scepter: gold bands, a gold sun with a blue gem heart
    scepter: weapon(44, 16, 10, 8, (p) => {
      p.rect(1, 7, 29, 2, '#d2ccd8');
      p.rect(1, 7, 29, 1, '#ffffff');
      for (const x of [2, 12, 22]) { p.rect(x, 6, 2, 4, GO[1]); p.rect(x, 6, 2, 1, GO[2]); }
      p.rect(28, 5, 3, 6, GO[1]);
      p.rect(28, 5, 1, 6, GO[3]);
      for (let i = 0; i < 8; i++) {                           // long and short sun rays
        const a = (i / 8) * TAU + TAU / 16;
        const len = i % 2 ? 5 : 7;
        p.line(37, 8, 37 + Math.cos(a) * len, 8 + Math.sin(a) * len, i % 2 ? GO[1] : GO[2], 2);
      }
      p.circle(37, 8, 4, GO[2]);
      p.circle(37, 8, 3, GO[3]);
      p.circle(37, 8, 2, '#4a6ad0');
      p.px(36, 7, '#8aa8ff');
      p.px(36, 6, '#ffffff');
    }),
    // the rogue's dagger (also thrown): red-wrapped grip, brass guard, keen steel
    dagger: weapon(20, 8, 4, 4, (p) => {
      p.rect(1, 3, 5, 2, '#9a2230');
      p.px(2, 3, '#3a0c14');
      p.px(4, 4, '#3a0c14');
      p.px(0, 3, B[2]);
      p.rect(6, 1, 2, 6, B[1]);
      p.px(6, 1, B[3]);
      p.poly([[8, 2], [16, 2], [19, 4], [16, 6], [8, 6]], S[3]);
      p.poly([[8, 2], [16, 2], [19, 4], [8, 4]], S[4]);
      p.rect(8, 2, 8, 1, S[5]);
    }),
    greatsword: weapon(64, 16, 6, 8, (p) => {
      p.rect(1, 6, 10, 4, '#2a1e2a');
      p.rect(11, 1, 4, 14, '#5a5a6a');
      p.rect(11, 1, 1, 14, '#7a7a8c');
      p.rect(15, 4, 42, 8, '#3a3e4c');
      p.rect(15, 4, 42, 1, '#6a7088');
      p.rect(15, 11, 42, 1, '#24262f');
      p.rect(57, 5, 4, 6, '#3a3e4c');
      p.rect(61, 7, 2, 2, '#3a3e4c');
      for (let x = 20; x < 54; x += 8) p.rect(x, 7, 3, 2, '#ff3b30');
    }),
  };

  const sprite = (w, h, fn, outline) => PixelArt.make(w, h, fn, outline);
  Sprites.projectiles = {
    // the archer's arrows: yew shaft, red-and-linen fletching like her quiver, steel bodkin
    arrow: sprite(20, 7, (p) => {
      p.rect(1, 1, 4, 2, '#c84040');
      p.rect(1, 4, 4, 2, '#e0d2aa');
      p.px(1, 1, '#e86060');
      p.rect(3, 3, 13, 1, YEW[2]);
      p.px(5, 3, YEW[3]);
      p.poly([[15, 1], [19, 3.5], [15, 6]], S[3]);
      p.px(16, 2, S[5]);
    }),
    // F: fire arrow, its head wrapped in flame
    fireArrow: sprite(24, 11, (p) => {
      p.rect(1, 3, 4, 2, '#c84040');
      p.rect(1, 6, 4, 2, '#e0d2aa');
      p.rect(3, 5, 12, 1, YEW[2]);
      p.poly([[12, 5.5], [16, 1], [19, 3], [23, 5.5], [19, 8], [16, 10]], '#a8400e');
      p.poly([[14, 5.5], [17, 2.5], [22, 5.5], [17, 8.5]], '#e87a1c');
      p.poly([[16, 5.5], [18, 4], [21, 5.5], [18, 7]], '#ffc040');
      p.rect(18, 5, 2, 1, '#fff4c0');
    }),
    // F: ice arrow, a frost crystal for a head
    iceArrow: sprite(24, 11, (p) => {
      p.rect(1, 3, 4, 2, '#9ad0ff');
      p.rect(1, 6, 4, 2, '#e6f6ff');
      p.rect(3, 5, 13, 1, YEW[2]);
      p.poly([[14, 5.5], [18, 1], [23, 5.5], [18, 10]], '#4a8aff');
      p.poly([[15, 5.5], [18, 2], [22, 5.5]], '#9ad0ff');
      p.line(18, 2, 18, 9, '#e6f6ff');
      p.px(19, 4, '#ffffff');
    }),
    enemyArrow: sprite(20, 7, (p) => {
      p.rect(1, 2, 4, 3, '#d84a4a');
      p.rect(4, 3, 11, 1, '#cfc6ad');
      p.rect(15, 2, 2, 3, '#8a8070');
      p.rect(17, 3, 2, 1, '#8a8070');
    }),
    // the mage's magic missile: a spinning ghost-teal star, like the sparkles off her staff
    bolt: sprite(14, 14, (p) => {
      p.poly([[7, 0.5], [8.5, 5.5], [13.5, 7], [8.5, 8.5], [7, 13.5], [5.5, 8.5], [0.5, 7], [5.5, 5.5]], TEAL[1]);
      p.poly([[7, 2.5], [8, 6], [11.5, 7], [8, 8], [7, 11.5], [6, 8], [2.5, 7], [6, 6]], TEAL[2]);
      p.rect(6, 5, 3, 4, TEAL[3]);
      p.rect(5, 6, 5, 2, TEAL[3]);
      p.rect(6, 6, 2, 2, '#ffffff');
    }),
    // the priestess's homing missile of light: a little gold star with a white heart
    lightMissile: sprite(12, 12, (p) => {
      p.poly([[6, 0.5], [7.5, 4.5], [11.5, 6], [7.5, 7.5], [6, 11.5], [4.5, 7.5], [0.5, 6], [4.5, 4.5]], GO[2]);
      p.rect(5, 4, 2, 4, GO[3]);
      p.rect(4, 5, 4, 2, GO[3]);
      p.rect(5, 5, 2, 2, '#ffffff');
    }),
    // the mage's frostfire ball: ghost-teal flame with spiky tongues, unlike the golem's orange one
    fireball: sprite(20, 20, (p) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        p.poly([[10 + Math.cos(a - 0.4) * 6, 10 + Math.sin(a - 0.4) * 6], [10 + Math.cos(a) * 9.5, 10 + Math.sin(a) * 9.5], [10 + Math.cos(a + 0.4) * 6, 10 + Math.sin(a + 0.4) * 6]], TEAL[1]);
      }
      p.circle(10, 10, 7, TEAL[1]);
      p.circle(10, 10, 6, TEAL[2]);
      p.circle(10, 10, 4, TEAL[3]);
      p.circle(9, 9, 2, TEAL[4]);
      p.rect(8, 8, 2, 2, '#ffffff');
    }),
    golemFireball: sprite(22, 22, (p) => {
      p.circle(11, 11, 9, '#a8241a');
      p.circle(11, 11, 7, '#ff5a1e');
      p.circle(10, 10, 4, '#ffd34a');
      p.rect(9, 9, 2, 2, '#fff6c8');
    }),
  };

  Sprites.pickups = {
    heart: sprite(16, 14, (p) => {
      p.rect(2, 2, 5, 4, '#e83a4a'); p.rect(9, 2, 5, 4, '#e83a4a');
      p.rect(1, 3, 14, 4, '#e83a4a');
      p.rect(2, 7, 12, 2, '#e83a4a');
      p.rect(4, 9, 8, 2, '#c42438');
      p.rect(6, 11, 4, 1, '#c42438');
      p.rect(10, 6, 4, 2, '#c42438');
      p.rect(3, 3, 2, 2, '#ffb0b8');
      p.px(5, 3, '#ffffff');
    }),
    // mana for the mage, in her ghost-teal
    mana: sprite(12, 12, (p) => {
      p.circle(6, 6, 5, TEAL[1]);
      p.circle(6, 6, 4, TEAL[2]);
      p.circle(5, 5, 2, TEAL[3]);
      p.px(4, 4, '#ffffff');
    }),
  };

  // mimic buff orbs: a coloured gem orb with an icon (cross / chevrons / sword)
  const orb = (dark, mid, light, icon) => sprite(18, 18, (p) => {
    p.circle(9, 9, 8, dark);
    p.circle(9, 9, 7, mid);
    p.circle(7, 7, 3, light);
    icon(p);
    p.px(5, 5, '#ffffff');
  });
  Sprites.pickups.buff_regen = orb('#1a6a2a', '#3ab84a', '#9cf0a0', (p) => {
    p.rect(8, 4, 3, 10, '#ffffff');
    p.rect(4, 8, 11, 3, '#ffffff');
  });
  Sprites.pickups.buff_speed = orb('#8a6010', '#d8a020', '#fff0a0', (p) => {
    for (const x of [5, 10]) {
      p.line(x, 5, x + 3, 9, '#ffffff', 2);
      p.line(x + 3, 9, x, 13, '#ffffff', 2);
    }
  });
  Sprites.pickups.buff_damage = orb('#7a1a14', '#d8402e', '#ffa090', (p) => {
    p.line(5, 13, 12, 5, '#ffffff', 2);
    p.rect(4, 10, 5, 2, '#5a2a10');
    p.rect(5, 12, 2, 2, '#5a2a10');
  });

  // mage's bird form (faces right): a little charcoal raven in her witch hat,
  // ghost-teal eye and wing tips. Wings up / wings down.
  const D = ['#100c10', '#1c161c', '#2a2129', '#3c3038', '#54444e'];
  const bird = (up) => {
    const img = PixelArt.make(24, 18, (p) => {
      if (up) p.poly([[8, 9], [10, 2], [16, 3], [14, 9]], D[1]);
      else p.poly([[8, 9], [14, 9], [14, 17], [9, 16]], D[1]);
      p.poly([[2, 8], [6, 6], [6, 11]], D[1]);                  // tail
      p.px(2, 8, TEAL[2]);
      p.ellipse(11, 10, 6, 3, D[2]);                            // body
      p.ellipse(11, 11, 4, 1, '#6e2032');                       // wine breast
      p.circle(17, 9, 3, D[2]);                                 // head
      p.poly([[19, 8], [23, 9], [19, 10]], B[2]);               // brass beak
      p.px(18, 8, TEAL[3]);
      p.poly([[14, 6], [20, 6], [17, 0]], D[3]);                // tiny witch hat
      p.rect(15, 5, 5, 1, TEAL[2]);
      p.rect(13, 6, 9, 1, D[2]);
      if (up) p.poly([[10, 8], [12, 1], [15, 2], [14, 8]], D[3]);
      else p.poly([[10, 9], [14, 9], [13, 16], [10, 15]], D[3]);
      if (up) p.px(12, 1, TEAL[2]); else p.px(13, 16, TEAL[2]);
    }, OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  };
  Sprites.items = { birdFrames: [bird(true), bird(false)] };

  // practice-range dummy: straw body and sack head on a post (40x56, base at 20,52)
  const straw = ['#6a4a18', '#9a7228', '#c8a040', '#e8c86a'];
  const sack = ['#5a4a32', '#8a7650', '#b09a6a', '#d0bc8a'];
  const dummy = PixelArt.make(40, 56, (p) => {
    p.rect(18, 30, 4, 24, L[2]);                // post
    p.rect(18, 30, 1, 24, L[3]);
    p.rect(14, 52, 12, 3, L[1]);
    p.rect(6, 22, 28, 4, L[2]);                 // crossbar arms
    p.rect(6, 22, 28, 1, L[3]);
    p.rect(3, 20, 4, 7, straw[2]);              // straw tufts at the hands
    p.rect(33, 20, 4, 7, straw[1]);
    p.round(11, 18, 18, 22, straw[1], 4);       // straw body
    p.round(12, 18, 14, 19, straw[2], 4);
    p.rect(13, 20, 3, 12, straw[3]);
    for (let y = 22; y < 38; y += 3) p.px(14 + (y % 5), y, straw[0]);
    p.rect(11, 26, 18, 2, L[1]);                // rope bands
    p.rect(11, 34, 18, 2, L[1]);
    p.circle(20, 30, 4, '#c8302e');             // target
    p.circle(20, 30, 2, '#efe6d2');
    p.px(20, 30, '#c8302e');
    p.round(13, 3, 14, 15, sack[1], 4);         // sack head
    p.round(14, 3, 11, 13, sack[2], 4);
    p.rect(15, 4, 4, 2, sack[3]);
    p.rect(13, 15, 14, 2, L[1]);                // tied neck
    p.line(16, 8, 18, 10, OUTLINE); p.line(18, 8, 16, 10, OUTLINE); // stitched X eyes
    p.line(22, 8, 24, 10, OUTLINE); p.line(24, 8, 22, 10, OUTLINE);
    p.rect(17, 12, 6, 1, sack[0]);
  }, OUTLINE, 0.5);
  Sprites.items.dummy = { img: dummy, flash: PixelArt.silhouette(dummy) };
}
