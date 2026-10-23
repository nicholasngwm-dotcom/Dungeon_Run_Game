// Rocketeer: a scrappy demolitions flyer in a brown leather aviator cap with
// brass goggles pushed up, a fluttering orange scarf, a fur-collared bomber
// jacket over a bandolier of little rockets, khaki trousers and heavy buckled
// boots, with a wooden rack of three rockets strapped to his back. The launcher is drawn
// separately (Sprites.weapons.rocketLauncher, see buildRocketeerSprites).

const ROCKETEER_COLORS = {
  leather: ['#24140c', '#3e2414', '#5e3a1e', '#84562c', '#a8723c'],
  khaki: ['#2e2a18', '#4a4428', '#6a623a', '#8e8452', '#b0a66e'],
  scarf: ['#5a1a06', '#9a3410', '#d85a1a', '#ff9a3a'],
  fur: ['#8a7a5e', '#c8b894', '#eee2c4'],
  rocket: ['#4a0e0e', '#8a1c1a', '#c8342a', '#ee6a4a'],
  olive: ['#1e2414', '#2e3a1e', '#46562c', '#627a3e', '#86a056'],
};

/**
 * A wooden carrying rack holding three rockets upright, like the old infantry racks: finned
 * steel tails sticking out of the top, long tan shafts, fat olive warheads sitting in the open
 * frame, noses poking out under the bottom board. (x, y) is its top-left; s scales it
 * (1 = on his back, about 15x34; bigger for the dropped ammo pack).
 */
function paintRocketRack(p, x, y, s = 1) {
  const WD = ['#2e1a0c', '#4e2e16', '#6e4424', '#94603a', '#b07a4a'];
  const OL = ROCKETEER_COLORS.olive;
  const SH = ['#8a6a40', '#c8a878', '#e8d0a0'];
  const S = RAMP.steel;
  const R = (rx, ry, w, h, c) => p.rect(x + rx * s, y + ry * s, Math.max(1, w * s), Math.max(1, h * s), c);
  const w = 15;
  // the back board, in shadow behind the rockets
  R(1, 9, w - 2, 23, WD[1]);
  for (let i = 0; i < 3; i++) {
    const rx = 1 + i * 4.5;
    // finned tail cap on top, the shaft, the bulbous warhead, its nose
    R(rx, 0, 4, 5, S[2]); R(rx, 0, 4, 1, S[4]); R(rx, 2, 4, 1, S[1]); R(rx + 1, 5, 2, 1, S[3]);
    R(rx + 1, 6, 2, 11, SH[1]); R(rx + 1, 6, 1, 11, SH[2]); R(rx + 2.5, 6, 0.5, 11, SH[0]);
    R(rx + 0.5, 11, 3, 1, S[3]);   // a steel collar on the shaft
    p.round(x + (rx - 0.5) * s, y + 17 * s, 5 * s, 10 * s, OL[2], Math.max(1, 2 * s));
    R(rx, 18, 1.5, 7, OL[4]); R(rx + 3, 18, 1, 7, OL[1]);
    R(rx + 1, 27, 2, 5, S[2]); R(rx + 1, 32, 2, 1, S[4]);
  }
  // the frame: side posts, the top board the shafts go through, a middle slat and the bottom board
  R(0, 8, 2, 25, WD[3]); R(0, 8, 1, 25, WD[4]);
  R(w - 2, 8, 2, 25, WD[2]);
  R(0, 8, w, 3, WD[3]); R(0, 8, w, 1, WD[4]);
  R(0, 23, w, 2, WD[2]);
  R(0, 29, w, 3, WD[3]); R(0, 29, w, 1, WD[4]); R(0, 31, w, 1, WD[1]);
}

function drawRocketeer(p, P) {
  const { b, hb, s } = P;
  const LE = ROCKETEER_COLORS.leather;
  const KH = ROCKETEER_COLORS.khaki;
  const SC = ROCKETEER_COLORS.scarf;
  const FU = ROCKETEER_COLORS.fur;
  const RK = ROCKETEER_COLORS.rocket;
  const G = CUTE.brass;
  const HA = ['#4a1a08', '#7a3010', '#b04a1a', '#d8702a', '#f09a4a'];   // ginger hair
  const f = P.cf;

  // on his back: a wooden rack of three rockets, tails up over his shoulder, strapped on
  paintRocketRack(p, 14, 4 + hb, 1);
  p.rect(27, 15 + b, 2, 12, LE[1]);

  // scarf tail streaming out behind
  p.poly([[29, 22 + b], [23, 21 + b + f], [17 + f, 23 + hb + f], [19 + f, 26 + hb], [25, 25 + b], [29, 25 + b]], SC[2]);
  p.line(28, 23 + b, 19 + f, 24 + hb, SC[1]);
  p.line(27, 22 + b, 21, 22 + b + f, SC[3]);

  // back arm in a leather sleeve
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], LE[2]);
  p.rect(26 + ba, 32 + b, 3, 2, RAMP.skin[1]);

  // khaki trousers, heavy buckled boots
  const xb = cuteLeg(p, 29, 29 - s, P.lb, [KH[0], KH[1], KH[2]], [LE[0], LE[1], LE[2]], 50, LE[3], 4);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, [KH[1], KH[2], KH[3]], [LE[1], LE[2], LE[3]], 50, LE[4], 4);
  for (const [xAt, lift] of [[xb, P.lb], [xf, P.lf]]) p.px(xAt(53 - lift) + 2, 53 - lift, G[2]);

  // jacket hem over the hips
  const hem = Math.round(s / 2);
  p.poly([[28, 33 + b], [40, 33 + b], [41 + hem, 39 + b], [27 + hem, 39 + b]], LE[2]);
  p.rect(27 + hem, 38 + b, 15, 2, LE[1]);
  p.line(34, 33 + b, 34 + hem, 38 + b, LE[1]);

  // bomber jacket, open over an orange shirt, with a bandolier of little rockets
  p.round(28, 24 + b, 12, 11, LE[3], 1);
  p.rect(28, 25 + b, 3, 8, LE[4]);
  p.rect(38, 26 + b, 2, 8, LE[1]);
  p.rect(33, 25 + b, 3, 8, SC[1]);
  p.rect(33, 25 + b, 1, 8, SC[2]);
  p.line(29, 25 + b, 39, 33 + b, KH[1], 2);
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 2.4;
    const y = 26 + i * 2 + b;
    p.rect(Math.round(x), Math.round(y) - 2, 2, 3, RK[2]);
    p.px(Math.round(x), Math.round(y) - 3, G[3]);
  }
  // belt with a brass buckle
  p.rect(28, 33 + b, 12, 2, LE[0]);
  p.rect(28, 33 + b, 12, 1, LE[2]);
  p.rect(32, 33 + b, 3, 2, G[2]);
  p.px(33, 33 + b, G[3]);

  // fur collar
  p.round(27, 21 + b, 14, 5, FU[1], 2);
  p.rect(28, 21 + b, 12, 1, FU[2]);
  p.rect(28, 25 + b, 12, 1, FU[0]);

  // face, ginger fringe, the aviator cap with ear flaps and brass goggles pushed up
  cuteFace(p, P, ['#0e2a4a', '#1e5a8a', '#3a8ac8', '#9ad0ff'], { male: true });
  p.rect(29, 12 + b, 11, 3, HA[2]);
  p.rect(30, 12 + b, 8, 1, HA[3]);
  for (const [x, len] of [[29, 3], [30, 2], [32, 1], [33, 3], [35, 2], [37, 1], [39, 3]]) p.rect(x, 15 + b, 1, len, HA[2]);
  p.px(38, 16 + b, HA[3]);
  p.round(26, 6 + b, 16, 9, LE[2], 4);
  p.rect(28, 6 + b, 11, 2, LE[4]);
  p.rect(29, 7 + b, 6, 1, '#c88a4c');   // shine on the leather
  p.rect(26, 12 + b, 4, 10, LE[2]);     // ear flap
  p.rect(26, 12 + b, 1, 10, LE[3]);
  p.rect(27, 20 + b, 3, 2, FU[1]);
  p.rect(28, 13 + b, 14, 1, LE[0]);     // goggle strap
  for (const gx of [32, 38]) {
    p.circle(gx, 11 + b, 3, G[2]);
    p.circle(gx, 11 + b, 2, '#6ac8e8');
    p.px(gx - 1, 10 + b, '#e6f6ff');
  }
  p.rect(34, 11 + b, 2, 1, G[1]);

  // launcher arm: sleeve, a fingerless glove
  p.round(36, 26 + b, 5, 5, LE[3], 1);
  p.rect(37, 27 + b, 2, 1, LE[4]);
  p.rect(38, 30 + b, 4, 4, LE[2]);
  p.rect(38, 30 + b, 4, 1, LE[4]);
  p.rect(39, 34 + b, 3, 3, RAMP.skin[2]);
  p.px(39, 34 + b, RAMP.skin[3]);
}

/**
 * His gear and ability icons: the old rocket launcher, the rocket and the IBFR in
 * flight, the ammo pack, and the HUD icons (Sprites.icons.rocketeer).
 */
function buildRocketeerSprites() {
  const O = ROCKETEER_COLORS.olive;
  const RK = ROCKETEER_COLORS.rocket;
  const G = CUTE.brass;
  const S = RAMP.steel;
  const W = RAMP.leather;
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });

  // a battered olive tube with brass bands, a flip-up sight, a wooden grip, a rocket's nose peeking out
  Sprites.weapons.rocketLauncher = weapon(46, 17, 12, 10, (p) => {
    p.rect(3, 4, 36, 8, O[2]);
    p.rect(3, 4, 36, 2, O[4]);
    p.rect(3, 6, 36, 1, O[3]);
    p.rect(3, 11, 36, 1, O[1]);
    p.rect(1, 3, 4, 10, O[1]);             // the flared back end
    p.rect(1, 3, 4, 1, O[3]);
    for (const x of [9, 22, 34]) { p.rect(x, 3, 3, 10, G[1]); p.rect(x, 3, 3, 1, G[3]); p.px(x + 1, 5, G[2]); }
    p.rect(26, 0, 2, 4, S[2]);             // the sight
    p.rect(25, 0, 4, 1, S[4]);
    p.rect(11, 12, 5, 5, W[2]);            // grip and trigger
    p.rect(11, 12, 5, 1, W[4]);
    p.rect(17, 12, 1, 3, S[2]);
    p.poly([[39, 5], [44, 8], [39, 11]], RK[2]);
    p.px(40, 6, RK[3]);
    p.rect(14, 6, 6, 2, '#e8d8a0');        // a stencilled stripe
  });

  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  // the rocket: red body, brass nose, steel fins (pointing right)
  Sprites.projectiles.rocket = sprite(20, 9, (p) => {
    p.rect(4, 3, 11, 4, RK[2]);
    p.rect(4, 3, 11, 1, RK[3]);
    p.rect(4, 6, 11, 1, RK[1]);
    p.poly([[15, 3], [19, 5], [15, 7]], G[2]);
    p.px(16, 4, G[3]);
    p.poly([[2, 1], [6, 3], [2, 3]], S[3]);
    p.poly([[2, 7], [6, 6], [2, 8]], S[2]);
    p.rect(8, 3, 2, 4, '#e8d8a0');
  });
  // the IBFR: a fat, hand-painted monster of a rocket, warning stripes and a grinning skull
  Sprites.projectiles.ibfr = sprite(52, 22, (p) => {
    p.round(8, 4, 34, 14, RK[2], 5);
    p.rect(10, 4, 30, 3, RK[3]);
    p.rect(10, 15, 30, 2, RK[1]);
    for (let x = 12; x < 22; x += 4) p.poly([[x, 4], [x + 2, 4], [x + 6, 17], [x + 4, 17]], '#f0d040');
    p.round(26, 7, 8, 8, '#efe6cf', 3);      // the skull
    p.rect(27, 9, 2, 2, OUTLINE);
    p.rect(31, 9, 2, 2, OUTLINE);
    p.rect(28, 13, 4, 1, OUTLINE);
    p.poly([[42, 5], [51, 11], [42, 17]], G[2]);
    p.poly([[42, 5], [51, 11], [42, 11]], G[3]);
    p.poly([[1, 0], [11, 5], [6, 6]], S[3]);
    p.poly([[1, 21], [11, 16], [6, 15]], S[2]);
    p.rect(2, 9, 7, 4, S[2]);
    p.rect(36, 4, 2, 14, G[1]);
  });

  // the ammo pack he drops: a wooden rack of three fresh rockets, like the one on his back
  Sprites.items.ammoPack = PixelArt.bevel(PixelArt.make(18, 36, (p) => paintRocketRack(p, 1, 1, 1.05), OUTLINE), { light: 0.2, shade: 0.8 });

  // ---------- HUD icons (28x28) ----------
  const icon = (fn) => PixelArt.bevel(PixelArt.make(28, 28, fn, OUTLINE));
  const rocket = (p, x0, y0, x1, y1) => {
    p.line(x0, y0, x1, y1, RK[2], 3);
    p.line(x0, y0, x1, y1, RK[3], 1);
    p.circle(x1, y1, 2, G[2]);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(a) * 3;
    const ny = Math.cos(a) * 3;
    p.line(x0 + nx, y0 + ny, x0 - nx, y0 - ny, S[3], 2);
  };
  const puff = (p, x, y, r) => { p.circle(x, y, r, '#8a8070'); p.circle(x - 1, y - 1, r - 1, '#c8c0b0'); };
  Sprites.icons.rocketeer = {
    // a rocket streaking off, smoke behind
    primary: icon((p) => {
      puff(p, 5, 22, 3); puff(p, 9, 19, 2);
      p.poly([[8, 21], [12, 17], [10, 22]], '#ff9a3a');
      rocket(p, 10, 19, 23, 6);
    }),
    // a boot flung up an arc off a blast
    secondary: icon((p) => {
      for (let i = 0; i < 6; i++) p.px(4 + i * 3, 18 - Math.round(Math.sin((i / 5) * Math.PI) * 12), '#efe6d2');
      p.circle(6, 22, 5, '#ff8a1e'); p.circle(6, 22, 3, '#ffd34a'); p.circle(6, 22, 1, '#ffffff');
      p.rect(18, 4, 5, 7, W[3]); p.rect(18, 10, 8, 4, W[2]); p.rect(18, 13, 8, 1, W[0]);
    }),
    // rockets raining into a target circle
    e: icon((p) => {
      p.ellipse(14, 21, 11, 5, '#5a1a10');
      p.ellipse(14, 21, 9, 3, '#8a2a14');
      rocket(p, 5, 2, 9, 14); rocket(p, 13, 1, 15, 15); rocket(p, 22, 3, 20, 14);
    }),
    // the ammo pack: the rack of three rockets, a plus beside it
    f: icon((p) => {
      paintRocketRack(p, 2, 0, 0.82);
      p.rect(18, 4, 8, 2, '#8cff9a'); p.rect(21, 1, 2, 8, '#8cff9a');
    }),
    // the IBFR and its boom
    q: icon((p) => {
      p.circle(20, 20, 7, '#ff8a1e'); p.circle(20, 20, 5, '#ffd34a'); p.circle(20, 20, 2, '#ffffff');
      p.line(3, 4, 15, 14, RK[2], 6);
      p.line(3, 4, 15, 14, RK[3], 2);
      p.circle(15, 14, 3, G[2]);
      p.line(5, 9, 9, 5, '#f0d040', 2);
    }),
  };
}
