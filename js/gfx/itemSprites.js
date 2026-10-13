// Weapons, projectiles, pickups and placed items. Weapons point right (+x);
// `pivot` is the grip point they rotate around. Same ramps as the heroes.

function buildItemSprites() {
  const S = RAMP.steel;
  const L = RAMP.leather;
  const G = RAMP.gold;
  const R = RAMP.red;
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
    // the warrior's oversized blade
    greatblade: weapon(56, 16, 6, 8, (p) => {
      p.rect(1, 6, 9, 4, L[2]);
      for (let x = 2; x < 9; x += 2) p.rect(x, 6, 1, 4, L[1]); // grip wrap
      p.rect(1, 6, 9, 1, L[3]);
      p.round(0, 6, 3, 4, G[2], 1);                          // pommel
      p.rect(10, 1, 4, 14, G[1]);                            // crossguard
      p.rect(10, 1, 2, 14, G[2]);
      p.rect(10, 1, 1, 6, G[3]);
      p.rect(11, 7, 2, 2, R[3]);
      blade(p, 14, 55, 7, 3, S);
    }),
    sword: weapon(38, 12, 4, 6, (p) => {
      p.rect(1, 5, 6, 3, L[2]);
      p.rect(1, 5, 2, 3, G[2]);
      p.rect(7, 1, 3, 10, G[1]);
      p.rect(7, 1, 2, 10, G[2]);
      blade(p, 10, 37, 6, 2, S);
    }),
    bow: weapon(16, 34, 3, 17, (p) => {
      // recurve limbs with leather grip and gold tips
      for (let y = 1; y < 33; y++) {
        const t = (y - 1) / 31;
        const x = 2 + Math.round(9 * Math.sin(Math.PI * t) - (t < 0.08 || t > 0.92 ? 2 : 0));
        const grip = y > 13 && y < 21;
        p.rect(x, y, 3, 1, grip ? L[1] : L[3]);
        p.px(x, y, grip ? L[2] : L[4]);
      }
      p.rect(1, 1, 2, 2, G[2]);
      p.rect(1, 31, 2, 2, G[2]);
      p.rect(2, 3, 1, 28, '#efe6d2');
    }),
    boneBow: weapon(14, 32, 3, 16, (p) => {
      for (let y = 1; y < 31; y++) {
        const x = 2 + Math.round(8 * Math.sin((Math.PI * (y - 1)) / 29));
        p.rect(x, y, 2, 1, y > 12 && y < 20 ? '#5a4a3a' : '#cfc6ad');
        p.px(x, y, y > 12 && y < 20 ? '#7a6a58' : '#ebe5d3');
      }
      p.rect(2, 2, 1, 28, '#8a8070');
    }),
    // dark wood staff with a silver claw holding an amethyst
    staff: weapon(46, 16, 10, 8, (p) => {
      p.rect(1, 7, 33, 3, L[2]);
      p.rect(1, 7, 33, 1, L[3]);
      p.rect(1, 9, 33, 1, L[1]);
      for (let x = 6; x < 30; x += 7) p.px(x, 8, L[1]);
      p.rect(14, 6, 3, 5, '#5a2a9a');                       // purple wrap
      p.line(32, 5, 37, 2, S[4]);                            // claw prongs
      p.line(32, 11, 37, 14, S[3]);
      p.rect(31, 5, 3, 7, S[3]);
      p.rect(31, 5, 1, 7, S[5]);
      p.poly([[36, 8], [40, 3], [44, 8], [40, 14]], '#5a2a9a');
      p.poly([[36, 8], [40, 3], [44, 8]], '#8e4ee0');
      p.poly([[38, 7], [40, 4], [42, 7]], '#c79aff');
      p.px(39, 5, '#f0e0ff');
    }),
    dagger: weapon(20, 8, 4, 4, (p) => {
      p.rect(1, 3, 5, 2, L[1]);
      p.px(1, 3, L[3]);
      p.rect(6, 1, 2, 6, G[1]);
      p.px(6, 1, G[3]);
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
    arrow: sprite(20, 7, (p) => {
      p.rect(1, 1, 4, 2, '#efe6d2');
      p.rect(1, 4, 4, 2, '#c8bca2');
      p.rect(3, 3, 13, 1, L[3]);
      p.poly([[15, 1], [19, 3.5], [15, 6]], S[3]);
      p.px(16, 2, S[5]);
    }),
    enemyArrow: sprite(20, 7, (p) => {
      p.rect(1, 2, 4, 3, '#d84a4a');
      p.rect(4, 3, 11, 1, '#cfc6ad');
      p.rect(15, 2, 2, 3, '#8a8070');
      p.rect(17, 3, 2, 1, '#8a8070');
    }),
    // arcane missile (purple, to match the mage)
    bolt: sprite(14, 14, (p) => {
      p.circle(7, 7, 5, '#5a2a9a');
      p.circle(7, 7, 4, '#8e4ee0');
      p.circle(6, 6, 2, '#c79aff');
      p.px(5, 5, '#ffffff');
    }),
    // the mage's frostfire ball: blue flame with spiky tongues, unlike the golem's orange one
    fireball: sprite(20, 20, (p) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        p.poly([[10 + Math.cos(a - 0.4) * 6, 10 + Math.sin(a - 0.4) * 6], [10 + Math.cos(a) * 9.5, 10 + Math.sin(a) * 9.5], [10 + Math.cos(a + 0.4) * 6, 10 + Math.sin(a + 0.4) * 6]], '#2a5ad0');
      }
      p.circle(10, 10, 7, '#2a5ad0');
      p.circle(10, 10, 6, '#4a8aff');
      p.circle(10, 10, 4, '#9ad0ff');
      p.circle(9, 9, 2, '#e6f6ff');
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
    mana: sprite(12, 12, (p) => {
      p.circle(6, 6, 5, '#2a5ad0');
      p.circle(6, 6, 4, '#4a8aff');
      p.circle(5, 5, 2, '#9ac4ff');
      p.px(4, 4, '#ffffff');
    }),
  };

  // mage's bird form (faces right): wings up / wings down
  const bird = (up) => {
    const img = PixelArt.make(24, 18, (p) => {
      if (up) p.poly([[8, 9], [10, 1], [16, 2], [14, 9]], '#4a2a8a');
      else p.poly([[8, 9], [14, 9], [14, 17], [9, 16]], '#4a2a8a');
      p.poly([[2, 8], [6, 6], [6, 11]], '#6a28c8');             // tail
      p.ellipse(11, 9, 6, 3, '#8e4ee0');                        // body
      p.ellipse(11, 10, 4, 1, '#c79aff');
      p.circle(17, 7, 3, '#8e4ee0');                            // head
      p.poly([[19, 6], [23, 7], [19, 8]], '#ffd34a');           // beak
      p.px(18, 6, '#ffffff');
      if (up) p.poly([[10, 8], [12, 0], [15, 1], [14, 8]], '#b67aff');
      else p.poly([[10, 9], [14, 9], [13, 16], [10, 15]], '#b67aff');
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
