// Baker: a cheerful pâtissière in a tall puffy chef's toque, strawberry-blonde
// hair in a bun with a flour smudge on her cheek, a pink dress under a frilly
// white apron with a strawberry pocket, a pink oven mitt, striped stockings and
// little pink shoes. Her rolling pin is drawn separately (Sprites.weapons.rollingPin,
// see buildBakerSprites).

const BAKER_COLORS = {
  pink: ['#5a1a32', '#9a3058', '#d8507e', '#ff8aae', '#ffc0d4'],
  apron: ['#8a8094', '#c8c0d0', '#ece6f0', '#ffffff'],
  hair: ['#5a2a1a', '#a0502a', '#d8803e', '#f0aa5a', '#ffd08a'],
  sponge: ['#8a5a2a', '#d8a858', '#f4d08a'],
  cream: ['#c8b8c0', '#f4ecf0', '#ffffff'],
  berry: ['#7a0e1e', '#c82a3a', '#ff6a6a'],
  choc: ['#2a140c', '#4e2a18', '#7a4626', '#a86a3e'],
  oven: ['#1e3a36', '#2e5a52', '#4a8a7a', '#7ac0a8', '#b0e8d0'],
};

function drawBaker(p, P) {
  const { b, hb, s } = P;
  const PK = BAKER_COLORS.pink;
  const AP = BAKER_COLORS.apron;
  const HA = BAKER_COLORS.hair;
  const BR = BAKER_COLORS.berry;
  const Sk = RAMP.skin;

  // the bun at the back of her head
  p.circle(25, 15 + hb, 4, HA[2]);
  p.circle(24, 14 + hb, 2, HA[3]);
  p.px(23, 13 + hb, HA[4]);

  // back arm in a puffed sleeve, a pink oven mitt
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], PK[2]);
  p.round(25 + ba, 31 + b, 5, 5, PK[3], 2);
  p.px(26 + ba, 32 + b, PK[4]);

  // striped stockings, little pink shoes
  const stripe = (row) => (row % 4 < 2 ? [AP[1], AP[2], AP[3]] : [PK[1], PK[2], PK[3]]);
  cuteLeg(p, 29, 29 - s, P.lb, stripe, [PK[0], PK[1], PK[2]], 55, null);
  cuteLeg(p, 34, 34 + s, P.lf, stripe, [PK[1], PK[2], PK[3]], 55, null);

  // the pink dress, flaring out
  const hem = Math.round(s / 2);
  p.poly([[28, 32 + b], [39, 32 + b], [42 + hem, 44 + b], [25 + hem, 44 + b]], PK[2]);
  p.poly([[28, 32 + b], [31, 32 + b], [28 + hem, 44 + b], [25 + hem, 44 + b]], PK[3]);
  p.poly([[37, 32 + b], [39, 32 + b], [42 + hem, 44 + b], [39 + hem, 44 + b]], PK[1]);
  // the frilly white apron over it, a strawberry on its pocket
  p.poly([[29, 31 + b], [38, 31 + b], [39 + hem, 42 + b], [28 + hem, 42 + b]], AP[2]);
  p.rect(29, 31 + b, 9, 1, AP[3]);
  for (let x = 28; x <= 39; x += 2) p.circle(x + hem, 43 + b, 1, AP[3]);   // the frill
  p.rect(31 + hem, 36 + b, 5, 4, AP[3]);
  p.circle(33 + hem, 38 + b, 1, BR[1]);
  p.px(33 + hem, 36 + b, '#4a8a3a');

  // bodice and the apron's bib
  p.round(29, 24 + b, 10, 9, PK[2], 1);
  p.rect(29, 25 + b, 2, 6, PK[3]);
  p.rect(31, 24 + b, 6, 8, AP[2]);
  p.rect(31, 24 + b, 6, 1, AP[3]);
  p.line(31, 24 + b, 29, 22 + b, AP[1]);   // the apron's neck strap
  p.line(36, 24 + b, 38, 22 + b, AP[1]);
  // a pink bow at the waist
  p.rect(28, 31 + b, 11, 2, PK[1]);
  p.round(25, 30 + b, 4, 4, PK[3], 1);
  p.px(26, 31 + b, PK[4]);

  // collar
  p.rect(31, 22 + b, 6, 2, AP[3]);

  // face with a flour smudge, strawberry-blonde fringe and side locks
  cuteFace(p, P, ['#3a1a2a', '#8a3a5a', '#d06a8a', '#ffb0c8']);
  p.rect(37, 21 + b, 2, 1, '#f4ecf0');   // the flour smudge
  cuteBangs(p, P, HA);
  p.rect(28, 14 + b, 2, 9, HA[2]);
  p.rect(28, 14 + b, 1, 9, HA[3]);
  p.rect(39, 14 + hb, 2, 7, HA[1]);

  // the tall puffy chef's toque
  p.rect(28, 8 + b, 13, 4, AP[2]);
  p.rect(28, 8 + b, 13, 1, AP[3]);
  p.rect(28, 11 + b, 13, 1, AP[1]);
  p.circle(30, 5 + b, 4, AP[2]);
  p.circle(35, 3 + b, 5, AP[2]);
  p.circle(39, 5 + b, 4, AP[2]);
  p.circle(34, 2 + b, 2, AP[3]);
  p.px(30, 3 + b, AP[3]);
  p.line(33, 6 + b, 33, 8 + b, AP[1]);
  p.line(37, 6 + b, 37, 8 + b, AP[1]);

  // rolling-pin arm: a puffed sleeve, a bare hand
  p.round(36, 25 + b, 5, 5, PK[3], 2);
  p.px(37, 26 + b, PK[4]);
  p.rect(38, 30 + b, 3, 3, PK[2]);
  p.rect(39, 33 + b, 3, 3, Sk[2]);
  p.px(39, 33 + b, Sk[3]);
}

/**
 * Her kitchen: the rolling pin, the cakes she throws (three flavours), the flour sack,
 * eight pastries (Sprites.pastries), the oven, the giant cake, the sugar-rush orb and the
 * HUD icons (Sprites.icons.baker).
 */
function buildBakerSprites() {
  const C = BAKER_COLORS;
  const S = RAMP.steel;
  const W = RAMP.leather;
  const make = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);

  // a pale wooden rolling pin with turned handles
  Sprites.weapons.rollingPin = { img: PixelArt.make(36, 10, (p) => {
    p.rect(1, 4, 6, 2, W[3]);
    p.round(0, 3, 3, 4, W[4], 1);
    p.round(7, 1, 22, 8, '#e8c890', 3);
    p.rect(8, 2, 20, 2, '#f8e4b8');
    p.rect(8, 7, 20, 1, '#b08850');
    p.rect(29, 4, 6, 2, W[3]);
    p.round(33, 3, 3, 4, W[4], 1);
    p.px(12, 5, '#f4ecf0'); p.px(20, 4, '#f4ecf0');   // a dusting of flour
  }, OUTLINE, 0.5), pivotX: 4, pivotY: 5 };

  // a wedge of layer cake: sponge, cream and a topping (sponge ramp, cream colour, topping)
  const slice = (sponge, cream, top) => make(16, 13, (p) => {
    p.poly([[1, 4], [15, 1], [15, 11], [1, 12]], sponge[1]);
    p.rect(1, 6, 14, 2, cream);
    p.rect(1, 10, 14, 1, sponge[0]);
    p.poly([[1, 4], [15, 1], [15, 3], [1, 5]], cream);
    p.poly([[1, 5], [4, 4], [4, 12], [1, 12]], sponge[2]);
    p.circle(11, 1, 2, top);
    p.px(10, 0, '#ffffff');
  });
  Sprites.projectiles.cakes = [
    slice(['#a04a5a', '#f08aa0', '#ffc0cc'], '#ffffff', C.berry[1]),           // strawberry
    slice(['#3a1e10', C.choc[2], C.choc[3]], '#f4d8b8', C.berry[1]),          // chocolate
    slice([C.sponge[0], C.sponge[1], C.sponge[2]], '#ffffff', '#ffd34a'),     // vanilla
  ];
  // the splat colours of each flavour: [frosting, sponge, highlight]
  Sprites.cakeSplats = [
    ['#ff8aae', '#f08aa0', '#ffffff'],
    ['#7a4626', '#a86a3e', '#f4d8b8'],
    ['#fff2d8', '#f4d08a', '#ffffff'],
  ];

  // a little burlap sack of flour, tied at the neck
  Sprites.projectiles.flourSack = make(14, 15, (p) => {
    p.round(1, 4, 12, 10, '#d8c8a0', 4);
    p.rect(2, 5, 4, 7, '#ece0c0');
    p.rect(4, 2, 6, 3, '#b8a880');
    p.rect(3, 4, 8, 1, '#8a6a40');
    p.rect(5, 0, 4, 2, '#f4f0e8');   // flour puffing out the top
    for (const [x, y] of [[6, 8], [8, 8], [7, 10]]) p.px(x, y, '#8a6a40');
  });

  // ---------- pastries (Sprites.pastries) ----------
  const P = (fn) => PixelArt.bevel(make(18, 16, fn), { light: 0.2, shade: 0.85 });
  Sprites.pastries = {
    // a slice of strawberry shortcake
    shortcake: P((p) => {
      p.poly([[1, 6], [17, 3], [17, 14], [1, 15]], '#f4e4c0');
      p.rect(1, 9, 16, 2, '#ffffff');
      p.rect(3, 9, 2, 2, C.berry[1]); p.rect(9, 9, 2, 2, C.berry[1]);
      p.poly([[1, 6], [17, 3], [17, 5], [1, 8]], '#ffffff');
      p.circle(12, 3, 3, C.berry[1]); p.px(11, 2, C.berry[2]); p.px(12, 0, '#4a8a3a');
    }),
    // a stack of pancakes, butter melting, syrup running down
    pancakes: P((p) => {
      for (let i = 0; i < 3; i++) { p.round(1, 11 - i * 3, 16, 4, '#d8a050', 2); p.rect(2, 11 - i * 3, 14, 1, '#f0c878'); }
      p.rect(7, 2, 4, 3, '#fff2a0');
      p.rect(3, 5, 12, 2, '#a85a1a');
      p.rect(3, 7, 2, 4, '#a85a1a'); p.rect(13, 7, 2, 6, '#a85a1a');
    }),
    // three pastel macarons
    macarons: P((p) => {
      for (const [x, y, c] of [[1, 8, '#ff9ac0'], [9, 8, '#a8e0c0'], [5, 2, '#c8a8ff']]) {
        p.round(x, y, 8, 3, c, 1); p.rect(x + 1, y + 3, 6, 1, '#ffffff'); p.round(x, y + 4, 8, 3, c, 1);
        p.px(x + 2, y, '#ffffff');
      }
    }),
    // a folded chocolate-strawberry crêpe dusted with sugar
    crepe: P((p) => {
      p.poly([[1, 14], [9, 2], [17, 14]], '#e8b878');
      p.poly([[3, 13], [9, 4], [15, 13]], '#f4d098');
      p.line(4, 10, 14, 10, C.choc[1], 2);
      p.circle(7, 7, 2, C.berry[1]); p.circle(11, 8, 2, C.berry[1]);
      p.line(5, 6, 9, 3, C.choc[2]);
      for (const [x, y] of [[6, 11], [10, 12], [12, 11]]) p.px(x, y, '#ffffff');
    }),
    // a cream puff split and piped full
    creamPuff: P((p) => {
      p.round(2, 8, 14, 7, '#d8a050', 3);
      p.round(3, 4, 12, 5, '#ffffff', 2);
      p.round(2, 1, 14, 5, '#e8b060', 3);
      p.rect(4, 2, 8, 1, '#f8d898');
      p.px(8, 0, '#ffffff'); p.px(5, 1, '#ffffff');
    }),
    // a pink-glazed donut with sprinkles
    donut: P((p) => {
      p.ellipse(9, 9, 8, 6, '#d8a050');
      p.ellipse(9, 8, 7, 5, '#ff8ac0');
      p.ellipse(9, 8, 2, 2, OUTLINE);
      for (const [x, y, c] of [[5, 6, '#ffffff'], [12, 6, '#8ad8ff'], [6, 10, '#ffe680'], [13, 10, '#8cff9a'], [9, 4, '#ffffff']]) p.px(x, y, c);
    }),
    // a cupcake with a swirl of frosting and a cherry
    cupcake: P((p) => {
      p.poly([[3, 9], [15, 9], [13, 15], [5, 15]], '#ff9ac0');
      for (let x = 5; x < 14; x += 2) p.line(x, 9, x, 15, '#d8507e');
      p.round(2, 5, 14, 5, '#fff2f6', 2);
      p.round(4, 2, 10, 4, '#fff2f6', 2);
      p.circle(9, 1, 2, C.berry[1]);
    }),
    // a cinnamon roll with a white glaze
    cinnamonRoll: P((p) => {
      p.ellipse(9, 9, 8, 6, '#c8843e');
      p.ellipse(9, 9, 5, 4, '#a8682a');
      p.ellipse(9, 9, 2, 2, '#c8843e');
      p.line(3, 6, 13, 5, '#ffffff'); p.line(5, 12, 14, 9, '#ffffff');
    }),
  };

  // ---------- the oven (F) ----------
  const O = C.oven;
  Sprites.items.oven = PixelArt.bevel(make(46, 50, (p) => {
    p.rect(30, 0, 6, 10, S[2]);            // the stovepipe
    p.rect(30, 0, 6, 2, S[4]);
    p.round(3, 8, 40, 36, O[2], 6);        // the body, a rounded mint enamel box
    p.rect(5, 10, 36, 4, O[3]);
    p.rect(5, 10, 8, 30, O[3]);
    p.rect(36, 12, 5, 30, O[1]);
    p.rect(3, 18, 40, 2, O[1]);
    for (const x of [9, 17, 25]) { p.circle(x, 15, 2, '#efe6cf'); p.px(x, 14, '#ffffff'); }   // dials
    p.round(8, 22, 30, 17, '#3a2a2a', 3);  // the window (its glow is drawn at runtime)
    p.round(10, 24, 26, 13, '#5a2a1a', 2);
    p.rect(12, 40, 22, 2, '#d8c8a0');      // the handle
    for (const x of [6, 36]) p.rect(x, 44, 4, 5, S[1]);   // stubby legs
  }), { light: 0.2, shade: 0.8 });

  // ---------- the giant cake (Q) ----------
  Sprites.items.megaCake = PixelArt.bevel(make(164, 146, (p) => {
    const tier = (cx, top, w, h, sponge, frost) => {
      p.round(cx - w / 2, top, w, h, sponge[1], 6);
      p.rect(cx - w / 2 + 3, top + 4, 8, h - 8, sponge[2]);
      p.rect(cx + w / 2 - 8, top + 4, 5, h - 8, sponge[0]);
      p.round(cx - w / 2 - 2, top - 4, w + 4, 12, frost, 6);
      // frosting dripping down the side
      for (let x = cx - w / 2 + 4; x < cx + w / 2 - 4; x += 9) p.round(x, top + 4, 5, 6 + ((x * 7) % 9), frost, 2);
      p.rect(cx - w / 2 + 4, top - 3, w - 8, 2, '#ffffff');
    };
    p.ellipse(82, 138, 80, 7, '#c8c0d0');          // the cake board
    p.ellipse(82, 136, 78, 6, '#f4f0f8');
    tier(82, 88, 150, 46, ['#a04a5a', '#f08aa0', '#ffc0cc'], '#fff2f6');
    tier(82, 50, 110, 40, [C.choc[1], C.choc[2], C.choc[3]], '#ff9ac0');
    tier(82, 18, 70, 34, [C.sponge[0], C.sponge[1], C.sponge[2]], '#ffffff');
    // a row of strawberries round each tier's top, swirls of cream and a candle
    for (let x = 18; x <= 146; x += 16) { p.circle(x, 86, 4, C.berry[1]); p.px(x - 1, 84, C.berry[2]); }
    for (let x = 36; x <= 128; x += 15) { p.circle(x, 48, 4, '#ffffff'); p.px(x, 46, '#fff2f6'); }
    for (const x of [62, 82, 102]) { p.circle(x, 14, 5, C.berry[1]); p.px(x - 2, 12, C.berry[2]); p.px(x, 8, '#4a8a3a'); }
    p.rect(80, 0, 4, 10, '#8ad8ff');
    p.rect(81, 0, 1, 10, '#ffffff');
  }), { light: 0.18, shade: 0.82 });

  // the sugar rush buff orb (for the HUD's buff chips): a pink candy with a swirl
  Sprites.pickups.buff_sugar = make(18, 18, (p) => {
    p.circle(9, 9, 8, '#8a2a5a');
    p.circle(9, 9, 7, '#ff8ad0');
    p.circle(7, 7, 3, '#ffc0e8');
    p.line(5, 9, 13, 9, '#ffffff', 2);
    p.line(9, 5, 9, 13, '#ffffff', 2);
    p.px(5, 5, '#ffffff');
  });

  // ---------- HUD icons (28x28) ----------
  const icon = (fn) => PixelArt.bevel(PixelArt.make(28, 28, fn, OUTLINE));
  Sprites.icons.baker = {
    // a cake slice flying with a splat behind
    primary: icon((p) => {
      p.circle(7, 20, 5, '#ff8aae'); p.circle(4, 17, 2, '#ff8aae'); p.circle(11, 24, 2, '#ffffff');
      p.poly([[12, 12], [25, 6], [25, 16], [12, 19]], '#f08aa0');
      p.rect(12, 13, 13, 2, '#ffffff');
      p.poly([[12, 12], [25, 6], [25, 8], [12, 14]], '#ffffff');
      p.circle(21, 6, 2, C.berry[1]);
    }),
    // a flour sack bursting into a cloud
    secondary: icon((p) => {
      for (const [x, y, r] of [[16, 9, 6], [22, 13, 5], [11, 13, 5], [18, 16, 5]]) p.circle(x, y, r, '#f4f0e8');
      p.circle(15, 8, 3, '#ffffff');
      p.round(3, 16, 10, 10, '#d8c8a0', 3);
      p.rect(5, 16, 6, 2, '#8a6a40');
    }),
    // three pastries in a fan
    e: icon((p) => {
      p.ellipse(8, 18, 6, 4, '#d8a050'); p.ellipse(8, 17, 5, 3, '#ff8ac0'); p.ellipse(8, 17, 1, 1, OUTLINE);
      p.round(15, 14, 10, 4, '#ff9ac0', 1); p.rect(16, 18, 8, 1, '#ffffff'); p.round(15, 19, 10, 4, '#ff9ac0', 1);
      p.poly([[8, 10], [14, 2], [20, 10]], '#f4e4c0'); p.rect(8, 7, 12, 1, '#ffffff'); p.circle(14, 3, 2, C.berry[1]);
    }),
    // the oven, glowing
    f: icon((p) => {
      p.round(3, 6, 22, 20, O[2], 4); p.rect(5, 8, 18, 2, O[3]);
      p.round(7, 13, 14, 9, '#ff8a1e', 2); p.round(9, 15, 10, 5, '#ffd34a', 2);
      p.rect(19, 1, 3, 6, S[2]);
    }),
    // the giant cake falling, a shadow under it
    q: icon((p) => {
      p.ellipse(14, 25, 12, 2, '#3a2a3a');
      p.round(4, 13, 20, 9, '#f08aa0', 3); p.round(3, 11, 22, 4, '#fff2f6', 2);
      p.round(8, 5, 12, 7, C.choc[2], 2); p.round(7, 4, 14, 3, '#ff9ac0', 1);
      p.circle(14, 2, 2, C.berry[1]);
      for (const y of [6, 11, 16]) p.px(1, y, '#efe6d2');
      for (const y of [6, 11, 16]) p.px(26, y, '#efe6d2');
    }),
  };
}
