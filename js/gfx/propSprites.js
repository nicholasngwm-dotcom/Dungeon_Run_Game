// Set-dressing props for the lobby and the dungeon's special rooms, drawn in
// the same style as the characters (soft ramps, selective outlines). Each prop
// is a cached canvas anchored at its bottom centre: Sprites.props[name] =
// { img, ax, ay }. Draw one with drawProp(ctx, name, x, y, flip).

const WOOD = ['#2a1a10', '#4a2e1c', '#6a4428', '#8c5e36', '#ae7c4a'];
const STONE = ['#2a2834', '#423f50', '#5c586c', '#78738a', '#9a95ac'];
const IRON = ['#1e2028', '#363a46', '#545a6a', '#7a8092', '#a8aebc'];

const PROP_DEFS = {
  anvil: [34, 26, (p) => {
    const S = IRON;
    p.rect(11, 18, 12, 7, WOOD[2]);                 // tree-stump base
    p.rect(11, 18, 3, 7, WOOD[3]);
    p.rect(11, 18, 12, 1, WOOD[4]);
    p.rect(13, 13, 8, 5, S[1]);                      // waist
    p.rect(13, 13, 2, 5, S[2]);
    p.poly([[4, 7], [27, 7], [33, 9], [27, 11], [27, 13], [6, 13], [4, 11]], S[2]);   // face + horn
    p.rect(5, 7, 22, 2, S[4]);
    p.rect(6, 7, 6, 1, '#d8dce6');
    p.rect(5, 11, 22, 2, S[1]);
  }],

  forge: [48, 56, (p) => {
    // chimney hood
    p.poly([[14, 0], [34, 0], [34, 10], [42, 20], [6, 20], [14, 10]], STONE[2]);
    p.rect(15, 0, 5, 10, STONE[3]);
    p.rect(6, 19, 36, 2, STONE[1]);
    for (let y = 3; y < 18; y += 5) p.rect(16, y, 16, 1, STONE[1]);
    // hearth body of rough stone
    p.rect(4, 21, 40, 33, STONE[2]);
    for (let y = 23; y < 52; y += 6) {
      for (let x = 4 + ((y / 6) % 2) * 5; x < 42; x += 10) { p.rect(x, y, 9, 5, STONE[3]); p.rect(x, y, 9, 1, STONE[4]); }
    }
    p.rect(4, 21, 40, 2, STONE[4]);
    // arched fire mouth (the glow is drawn live over it)
    p.round(13, 28, 22, 18, '#1a0c08', 6);
    p.rect(15, 40, 18, 6, '#3a140a');
    // bellows on the side
    p.poly([[42, 40], [48, 36], [48, 48], [42, 46]], WOOD[3]);
    p.rect(44, 38, 1, 9, WOOD[1]);
  }],

  weaponRack: [38, 42, (p) => {
    p.rect(3, 8, 3, 33, WOOD[2]); p.rect(32, 8, 3, 33, WOOD[2]);
    p.rect(2, 10, 34, 3, WOOD[3]); p.rect(2, 10, 34, 1, WOOD[4]);
    p.rect(2, 34, 34, 3, WOOD[2]);
    // sword
    p.rect(10, 4, 2, 28, IRON[4]); p.rect(11, 4, 1, 28, IRON[2]);
    p.rect(7, 30, 8, 2, '#a07a24'); p.rect(10, 32, 2, 5, WOOD[1]);
    // axe
    p.rect(19, 6, 2, 31, WOOD[3]);
    p.poly([[21, 7], [27, 4], [28, 14], [21, 12]], IRON[3]);
    p.line(27, 5, 28, 13, IRON[4]);
    // spear
    p.rect(28, 2, 1, 35, WOOD[3]);
    p.poly([[27, 2], [28, -2], [30, 2], [28, 6]], IRON[4]);
  }],

  grindstone: [26, 26, (p) => {
    p.rect(3, 12, 3, 13, WOOD[2]); p.rect(20, 12, 3, 13, WOOD[2]);
    p.circle(13, 12, 9, STONE[3]);
    p.circle(13, 12, 6, STONE[2]);
    p.rect(12, 11, 3, 3, WOOD[1]);
    p.line(14, 12, 23, 6, WOOD[3]);
    p.rect(3, 22, 20, 3, WOOD[2]);
  }],

  barrel: [22, 26, (p) => {
    p.round(2, 3, 18, 22, WOOD[2], 3);
    p.rect(4, 4, 4, 20, WOOD[3]);
    p.rect(5, 4, 1, 20, WOOD[4]);
    for (const y of [7, 18]) { p.rect(2, y, 18, 2, IRON[1]); p.rect(2, y, 18, 1, IRON[3]); }
    p.ellipse(11, 4, 8, 2, WOOD[1]);
    p.ellipse(11, 4, 6, 1, '#3a5a7a');
    p.px(8, 4, '#8ab0d0');
  }],

  crate: [26, 26, (p) => {
    p.rect(2, 4, 22, 21, WOOD[3]);
    p.rect(2, 4, 22, 2, WOOD[4]);
    p.rect(2, 4, 2, 21, WOOD[4]);
    p.rect(22, 4, 2, 21, WOOD[2]);
    p.rect(2, 23, 22, 2, WOOD[2]);
    p.line(4, 6, 21, 22, WOOD[2], 2);
    p.rect(10, 12, 6, 6, WOOD[2]);
    p.rect(11, 13, 4, 4, '#c8a050');
  }],

  sacks: [28, 20, (p) => {
    p.round(1, 6, 13, 13, '#a89870', 4);
    p.round(2, 7, 5, 8, '#c8b890', 2);
    p.round(12, 3, 14, 16, '#988860', 4);
    p.round(13, 4, 5, 9, '#b8a880', 2);
    p.rect(17, 3, 4, 2, '#6a5a3a');
    p.rect(6, 6, 3, 2, '#6a5a3a');
    p.px(20, 1, '#e8d8a0'); p.px(19, 2, '#d8c890');
  }],

  bookshelf: [42, 54, (p) => {
    p.rect(1, 2, 40, 51, WOOD[1]);
    p.rect(1, 2, 40, 2, WOOD[3]);
    p.rect(1, 2, 2, 51, WOOD[2]);
    p.rect(39, 2, 2, 51, WOOD[0]);
    const books = ['#8a2a2a', '#2a4a8a', '#3a7a4a', '#a07a24', '#6a3a8a', '#b8a080', '#4a6a6a'];
    let k = 3;
    for (const sy of [5, 18, 31]) {
      let x = 4;
      while (x < 37) {
        const w = 2 + (k % 3 === 0 ? 2 : 1);
        const h = 9 + (k % 4 === 1 ? 0 : 2);
        const c = books[k % books.length];
        p.rect(x, sy + 11 - h, w, h, c);
        p.px(x, sy + 11 - h, '#e8dcc0');
        x += w + (k % 5 === 0 ? 2 : 0);
        k += 3;
      }
      p.rect(3, sy + 11, 36, 2, WOOD[3]);
    }
    // bottom cupboard
    p.rect(3, 44, 36, 8, WOOD[2]);
    p.rect(20, 44, 1, 8, WOOD[1]);
    p.px(18, 48, '#d4ac4c'); p.px(22, 48, '#d4ac4c');
  }],

  plant: [22, 34, (p) => {
    p.poly([[5, 22], [17, 22], [15, 33], [7, 33]], '#a0583a');
    p.rect(5, 22, 12, 2, '#c07450');
    p.rect(7, 24, 2, 8, '#c07450');
    const G = ['#1a3a1e', '#2a5a2e', '#3a7a3c', '#5a9a52'];
    for (const [x0, y0, x1, y1, c] of [[11, 22, 3, 8, 1], [11, 22, 19, 6, 2], [11, 22, 11, 1, 3], [11, 22, 5, 14, 2], [11, 22, 18, 14, 1], [11, 22, 15, 4, 3], [11, 22, 7, 4, 2]]) {
      p.line(x0, y0, x1, y1, G[c], 2);
      p.px(x1, y1, G[3]);
    }
  }],

  table: [46, 30, (p) => {
    p.rect(5, 14, 3, 15, WOOD[1]); p.rect(38, 14, 3, 15, WOOD[1]);
    p.rect(1, 8, 44, 8, '#e8e2d4');                 // tablecloth
    p.rect(1, 8, 44, 2, '#ffffff');
    for (let x = 1; x < 45; x += 4) p.rect(x, 15, 2, 3, '#b4302a');
    p.rect(1, 16, 44, 1, '#c8c0b0');
    // plates, a roast and a candle
    p.ellipse(10, 9, 5, 2, '#f4f0e8'); p.ellipse(10, 8, 3, 1, '#c87a3a');
    p.ellipse(34, 9, 5, 2, '#f4f0e8'); p.ellipse(34, 8, 3, 1, '#7aa04a');
    p.round(19, 3, 9, 6, '#a8602a', 2); p.rect(20, 3, 4, 2, '#d08a4a');
    p.rect(27, 2, 2, 6, '#f0e8d0');
  }],

  stool: [14, 14, (p) => {
    p.rect(2, 4, 10, 3, WOOD[3]); p.rect(2, 4, 10, 1, WOOD[4]);
    p.rect(3, 7, 2, 6, WOOD[1]); p.rect(9, 7, 2, 6, WOOD[1]);
  }],

  well: [50, 60, (p) => {
    // posts and roof
    p.rect(6, 12, 3, 36, WOOD[2]); p.rect(41, 12, 3, 36, WOOD[2]);
    p.poly([[1, 14], [25, 1], [49, 14], [45, 16], [25, 6], [5, 16]], '#7a2a24');
    p.poly([[5, 14], [25, 4], [45, 14]], '#9a3a30');
    for (let i = 0; i < 4; i++) p.line(9 + i * 9, 11 - i * 2, 9 + i * 9, 13 - i, '#5a1a18');
    p.rect(8, 18, 34, 2, WOOD[3]);                   // crank beam
    p.line(25, 20, 25, 30, '#c4a46a');              // rope
    p.round(22, 30, 7, 6, WOOD[3], 1);              // bucket
    p.rect(22, 31, 7, 1, IRON[2]);
    // stone ring
    p.rect(3, 38, 44, 20, STONE[2]);
    for (let y = 39; y < 57; y += 6) {
      for (let x = 3 + ((y / 3) % 2) * 4; x < 45; x += 8) { p.rect(x, y, 7, 5, STONE[3]); p.rect(x, y, 7, 1, STONE[4]); }
    }
    p.ellipse(25, 38, 22, 5, STONE[3]);
    p.ellipse(25, 38, 18, 3, '#1a3a5a');
    p.ellipse(22, 37, 8, 1, '#3a6a9a');
  }],

  goldPile: [34, 18, (p) => {
    const G = ['#6a4a10', '#a87e24', '#dcb444', '#f8e08a', '#fff8d8'];
    p.ellipse(17, 13, 15, 5, G[1]);
    p.ellipse(15, 11, 11, 5, G[2]);
    p.ellipse(13, 8, 6, 4, G[3]);
    for (const [x, y] of [[8, 11], [20, 9], [24, 13], [12, 14], [16, 6]]) { p.rect(x, y, 3, 2, G[3]); p.px(x, y, G[4]); }
    p.rect(26, 6, 4, 6, '#2a8ad0'); p.px(26, 6, '#a0e0ff');   // a gem
    p.rect(5, 8, 3, 4, '#c03040'); p.px(5, 8, '#ff9aa0');
  }],

  chest: [30, 26, (p) => {
    const G = RAMP.gold;
    p.rect(2, 12, 26, 13, WOOD[2]);
    p.rect(2, 12, 26, 2, WOOD[3]);
    p.rect(2, 12, 3, 13, WOOD[3]);
    p.round(2, 3, 26, 10, WOOD[3], 3);
    p.rect(4, 4, 20, 2, WOOD[4]);
    for (const x of [7, 21]) { p.rect(x, 3, 3, 22, G[1]); p.rect(x, 3, 1, 22, G[2]); }
    p.rect(2, 12, 26, 1, G[2]);
    p.rect(13, 11, 5, 6, G[2]); p.rect(14, 13, 3, 3, G[0]);
  }],

  cauldron: [30, 28, (p) => pot(p, '#5a2a8a', '#9a5ae0')],
  stewPot: [30, 28, (p) => pot(p, '#a8521e', '#e0904a')],

  hayBale: [30, 20, (p) => {
    p.round(1, 3, 28, 16, '#c4a046', 3);
    p.rect(2, 4, 26, 3, '#e0c060');
    for (let x = 3; x < 28; x += 3) p.line(x, 7, x + 1, 17, '#a07e30');
    for (const x of [8, 20]) p.rect(x, 3, 2, 16, '#7a4a2a');
    p.px(4, 2, '#e0c060'); p.px(24, 1, '#e0c060'); p.px(15, 2, '#d0b050');
  }],

  fence: [46, 22, (p) => {
    for (const x of [2, 22, 42]) { p.rect(x, 2, 3, 19, WOOD[2]); p.rect(x, 2, 1, 19, WOOD[3]); p.rect(x, 1, 3, 1, WOOD[4]); }
    for (const y of [6, 13]) { p.rect(0, y, 46, 3, WOOD[3]); p.rect(0, y, 46, 1, WOOD[4]); }
  }],

  trough: [36, 16, (p) => {
    p.rect(2, 4, 32, 10, WOOD[2]);
    p.rect(2, 4, 32, 2, WOOD[4]);
    p.rect(4, 6, 28, 2, '#3a6a9a');
    p.px(10, 6, '#8ab0d0');
    p.rect(4, 13, 3, 3, WOOD[1]); p.rect(29, 13, 3, 3, WOOD[1]);
  }],

  cart: [60, 46, (p) => {
    // goods piled in the bed
    p.round(10, 6, 14, 12, '#8a3a3a', 3);
    p.round(22, 3, 12, 15, '#3a6a4a', 3);
    p.round(33, 8, 12, 10, '#a07a24', 3);
    p.rect(26, 5, 4, 2, '#5a9a6a');
    // bed and wheels
    p.rect(4, 16, 46, 12, WOOD[3]);
    p.rect(4, 16, 46, 2, WOOD[4]);
    for (let x = 8; x < 48; x += 8) p.rect(x, 18, 1, 10, WOOD[2]);
    p.line(50, 24, 59, 30, WOOD[2], 2);              // shaft
    for (const cx of [14, 40]) {
      p.circle(cx, 34, 10, WOOD[1]);
      p.circle(cx, 34, 8, WOOD[3]);
      p.circle(cx, 34, 6, WOOD[1]);
      p.line(cx - 6, 34, cx + 6, 34, WOOD[3]); p.line(cx, 28, cx, 40, WOOD[3]);
      p.rect(cx - 1, 33, 3, 3, IRON[3]);
    }
  }],

  tent: [62, 50, (p) => {
    p.poly([[31, 2], [60, 48], [2, 48]], '#a85a3a');
    p.poly([[31, 2], [60, 48], [42, 48]], '#8a4430');
    p.poly([[31, 2], [16, 48], [2, 48]], '#c8784e');
    p.poly([[31, 12], [38, 48], [24, 48]], '#2a140c');           // doorway
    p.poly([[31, 12], [24, 48], [21, 48]], '#d89060');           // tied-back flap
    p.rect(30, 0, 2, 4, WOOD[2]);
    p.rect(32, 0, 7, 3, '#e0c060');                                // pennant
  }],

  bannerRed: [18, 52, (p) => banner(p, '#87262a', '#ad3a36', '#d4ac4c')],
  bannerBlue: [18, 52, (p) => banner(p, '#2c4270', '#3e5a96', '#d4ac4c')],
  bannerGreen: [18, 52, (p) => banner(p, '#24463a', '#33604e', '#d4ac4c')],

  candelabra: [18, 34, (p) => {
    const G = RAMP.gold;
    p.rect(8, 10, 2, 22, G[1]);
    p.rect(4, 31, 10, 2, G[1]);
    p.rect(2, 12, 14, 2, G[2]);
    for (const x of [2, 8, 14]) { p.rect(x, 6, 2, 6, '#f0e8d0'); }
  }],

  pedestal: [40, 20, (p) => {
    p.rect(2, 10, 36, 9, STONE[2]);
    p.rect(2, 10, 36, 2, STONE[4]);
    p.rect(5, 4, 30, 7, STONE[3]);
    p.rect(5, 4, 30, 1, STONE[4]);
    p.rect(14, 13, 12, 4, STONE[1]);
    p.rect(15, 14, 10, 2, '#d4ac4c');
  }],

  bench: [40, 18, (p) => {
    p.rect(2, 6, 36, 4, WOOD[3]); p.rect(2, 6, 36, 1, WOOD[4]);
    p.rect(4, 10, 3, 7, WOOD[1]); p.rect(33, 10, 3, 7, WOOD[1]);
  }],

  dummy: [26, 46, (p) => {
    p.rect(12, 20, 2, 25, WOOD[2]);
    p.rect(4, 22, 18, 3, WOOD[3]);
    p.round(7, 18, 12, 18, '#c4a046', 3);
    p.rect(8, 19, 3, 16, '#e0c060');
    p.rect(7, 26, 12, 2, '#7a4a2a');
    p.round(8, 6, 10, 11, '#d0b050', 3);
    p.rect(10, 10, 2, 2, '#4a2a1a'); p.rect(14, 10, 2, 2, '#4a2a1a');
    p.px(4, 21, '#e0c060'); p.px(21, 24, '#e0c060');
  }],

  flowers: [20, 12, (p) => {
    const G = '#3a7a3c';
    for (const [x, c] of [[3, '#e86a8a'], [8, '#f0d060'], [13, '#a07ae0'], [17, '#f4f0e8']]) {
      p.line(x, 11, x + (x % 2 ? 1 : -1), 5, G);
      p.rect(x - 1, 3, 3, 3, c);
      p.px(x, 4, '#fff8d8');
    }
  }],

  skullPile: [24, 14, (p) => {
    const B = ['#6a6250', '#b5ad96', '#e4dcc8'];
    for (const [x, y] of [[2, 6], [12, 6], [7, 1]]) {
      p.round(x, y, 9, 8, B[2], 2);
      p.rect(x + 2, y + 3, 2, 2, '#2a1a24'); p.rect(x + 5, y + 3, 2, 2, '#2a1a24');
      p.rect(x + 2, y + 6, 5, 1, B[1]);
    }
  }],

  // ---------- the tech workshop ----------

  workbench: [58, 32, (p) => {
    const M = IRON;
    p.rect(4, 14, 3, 17, M[1]); p.rect(51, 14, 3, 17, M[1]);      // steel legs
    p.rect(4, 24, 50, 2, M[1]);                                    // lower shelf
    p.rect(8, 20, 12, 4, '#8a5a2a');                               // toolbox on the shelf
    p.rect(8, 20, 12, 1, '#b07a3a');
    p.rect(1, 8, 56, 6, WOOD[3]);                                  // thick wooden top
    p.rect(1, 8, 56, 2, WOOD[4]);
    p.rect(1, 13, 56, 1, WOOD[1]);
    // vise on the right end
    p.rect(46, 3, 9, 5, M[2]); p.rect(46, 3, 9, 1, M[4]);
    p.rect(54, 5, 3, 1, M[3]);
    // scattered parts: gears, bolts, a coil of wire
    p.circle(10, 6, 3, M[3]); p.px(10, 6, M[1]);
    p.rect(17, 6, 2, 2, M[4]); p.rect(21, 7, 2, 1, M[4]);
    p.circle(28, 6, 2, '#c87a3a'); p.px(28, 6, '#7a4a20');
  }],

  teslaCoil: [26, 60, (p) => {
    const M = IRON;
    p.rect(3, 48, 20, 11, M[1]); p.rect(3, 48, 20, 2, M[3]);      // base
    p.rect(7, 52, 3, 3, '#ffd34a'); p.rect(16, 52, 3, 3, '#6cff7a');
    for (let y = 16; y < 48; y += 3) {                             // copper coil
      p.rect(8, y, 10, 2, '#c87a3a');
      p.rect(8, y, 10, 1, '#e8a060');
      p.rect(8, y + 2, 10, 1, '#6a3a18');
    }
    p.rect(12, 14, 2, 34, M[2]);
    p.ellipse(13, 9, 11, 5, M[2]);                                 // torus on top
    p.ellipse(13, 8, 9, 3, M[3]);
    p.ellipse(10, 7, 4, 1, M[4]);
  }],

  console: [38, 44, (p) => {
    const M = IRON;
    p.rect(2, 6, 34, 37, M[1]);
    p.rect(2, 6, 34, 2, M[3]);
    p.rect(2, 6, 2, 37, M[2]);
    p.rect(6, 10, 26, 16, '#0a1a14');                              // screen
    p.rect(7, 11, 24, 14, '#103a28');
    p.rect(7, 11, 24, 1, '#1a5a3a');
    p.rect(6, 30, 26, 10, M[2]);                                   // keyboard deck
    for (let i = 0; i < 6; i++) p.rect(8 + i * 4, 32, 3, 2, M[4]);
    for (let i = 0; i < 5; i++) p.rect(9 + i * 4, 36, 3, 2, M[3]);
    p.line(30, 6, 34, 0, M[3]);                                    // antenna
    p.px(34, 0, '#ff6a6a');
  }],

  robot: [30, 46, (p) => {
    const M = IRON;
    p.rect(8, 34, 5, 11, M[2]); p.rect(17, 34, 5, 11, M[2]);      // legs
    p.rect(6, 43, 8, 2, M[1]); p.rect(16, 43, 8, 2, M[1]);
    p.round(5, 16, 20, 19, '#c87a3a', 2);                          // copper body
    p.rect(6, 17, 4, 16, '#e8a060');
    p.rect(9, 22, 12, 7, M[1]);                                    // chest hatch, open
    p.rect(10, 23, 4, 2, '#ffd34a'); p.rect(15, 26, 4, 2, '#6a3a18');
    p.line(14, 25, 17, 28, '#e04545');                             // dangling wire
    p.rect(1, 18, 4, 12, M[2]); p.rect(25, 18, 4, 12, M[2]);      // arms
    p.round(8, 4, 14, 12, M[3], 2);                                // head
    p.rect(9, 5, 4, 2, M[4]);
    p.rect(11, 9, 8, 3, M[0]);                                     // visor (the eye lights up live)
    p.line(15, 4, 15, 0, M[2]);
  }],

  boiler: [34, 50, (p) => {
    const M = IRON;
    p.rect(4, 44, 26, 5, M[1]);
    p.round(5, 10, 24, 35, '#a8602a', 6);                          // copper tank
    p.rect(7, 12, 5, 31, '#d08a4a');
    for (const y of [16, 28, 40]) { p.rect(5, y, 24, 1, '#6a3a18'); for (let x = 7; x < 28; x += 4) p.px(x, y + 1, '#e8b070'); }
    p.circle(22, 22, 4, '#e8e0c8');                                // pressure gauge (needle drawn live)
    p.rect(14, 2, 4, 9, M[2]);                                     // pipe up and over
    p.rect(14, 2, 18, 3, M[2]);
    p.rect(14, 2, 18, 1, M[4]);
  }],

  gearPanel: [48, 36, (p) => {
    p.rect(1, 1, 46, 34, WOOD[1]);
    p.rect(1, 1, 46, 2, WOOD[3]);
    for (const [x, y] of [[4, 4], [43, 4], [4, 31], [43, 31]]) p.rect(x, y, 2, 2, IRON[3]);
  }],

  toolBoard: [44, 32, (p) => {
    p.rect(1, 1, 42, 30, '#8a7a5a');
    p.rect(1, 1, 42, 2, '#a8987a');
    for (let y = 6; y < 30; y += 5) for (let x = 4; x < 42; x += 5) p.px(x, y, '#5a4a3a');
    // wrench, hammer, screwdriver, pliers, saw
    p.line(6, 8, 6, 26, IRON[3], 2); p.rect(4, 6, 6, 3, IRON[3]); p.rect(6, 6, 2, 2, '#8a7a5a');
    p.rect(14, 8, 2, 18, WOOD[3]); p.rect(11, 6, 8, 4, IRON[2]);
    p.rect(22, 6, 2, 9, '#e04545'); p.line(23, 15, 23, 25, IRON[4]);
    p.line(29, 7, 33, 24, IRON[3]); p.line(33, 7, 29, 24, IRON[3]);
    p.rect(36, 6, 4, 20, IRON[4]); for (let y = 8; y < 26; y += 2) p.px(40, y, IRON[2]);
  }],

  catSit: [16, 14, (p) => cat(p, 'sit', 0)],
  catWalk1: [16, 14, (p) => cat(p, 'walk', 0)],
  catWalk2: [16, 14, (p) => cat(p, 'walk', 1)],

  rugRound: [64, 30, (p) => {
    p.ellipse(32, 15, 30, 13, '#5a1a3a');
    p.ellipse(32, 15, 27, 11, '#7a2a4a');
    p.ellipse(32, 15, 20, 7, '#3a1a4a');
    p.ellipse(32, 15, 8, 3, '#d4ac4c');
  }],
};

/** A little ginger cat facing right, sitting or mid-stride (step 0/1). */
function cat(p, mode, step) {
  const C = ['#7a3a1a', '#b8622a', '#e08a44', '#f4b878'];
  if (mode === 'sit') {
    p.round(3, 5, 8, 8, C[2], 3);                  // body
    p.rect(4, 6, 3, 6, C[3]);
    p.line(3, 12, 0, 9, C[1]);                      // tail curled up
    p.px(0, 8, C[1]);
    p.round(8, 1, 7, 6, C[2], 2);                   // head
    p.px(9, 0, C[2]); p.px(13, 0, C[2]);            // ears
    p.px(11, 3, '#2a1a10'); p.px(13, 3, '#2a1a10'); // eyes
    p.px(12, 5, '#e8a0a0');
    p.rect(7, 12, 2, 1, C[3]); p.rect(10, 12, 2, 1, C[3]);
    for (const x of [4, 6]) p.px(x, 8, C[1]);       // stripes
    return;
  }
  p.round(1, 4, 11, 5, C[2], 2);                    // body
  p.rect(2, 5, 8, 1, C[3]);
  p.line(1, 5, 0, 1, C[1]);                          // tail up
  p.round(10, 1, 6, 5, C[2], 2);                    // head
  p.px(11, 0, C[2]); p.px(14, 0, C[2]);
  p.px(13, 3, '#2a1a10');
  for (const x of [4, 7]) p.px(x, 4, C[1]);
  // legs mid-stride
  const a = step ? 1 : -1;
  for (const [x, s] of [[2, a], [4, -a], [8, a], [10, -a]]) p.rect(x + s, 9, 1, 4, C[1]);
}

/** An iron pot on three legs, filled with something (dark, light). */
function pot(p, dark, light) {
  p.line(5, 26, 9, 18, IRON[1], 2); p.line(25, 26, 21, 18, IRON[1], 2);   // legs
  p.ellipse(15, 15, 13, 10, IRON[1]);
  p.ellipse(13, 13, 9, 7, IRON[2]);
  p.ellipse(10, 11, 3, 3, IRON[3]);
  p.ellipse(15, 6, 13, 3, IRON[3]);
  p.ellipse(15, 6, 11, 2, dark);
  p.ellipse(13, 6, 5, 1, light);
}

function banner(p, dark, mid, trim) {
  p.rect(8, 0, 2, 52, WOOD[2]);                    // pole
  p.rect(6, 50, 6, 2, WOOD[1]);
  p.rect(2, 4, 14, 2, WOOD[3]);
  p.poly([[3, 6], [15, 6], [15, 34], [9, 30], [3, 34]], mid);
  p.rect(3, 6, 3, 26, dark);
  p.rect(3, 6, 12, 1, trim);
  p.rect(8, 13, 2, 10, trim); p.rect(5, 16, 8, 2, trim);
  p.circle(9, 1, 1, trim);
}

/** Builds Sprites.props from PROP_DEFS. */
function buildPropSprites() {
  Sprites.props = {};
  for (const [name, [w, h, fn]] of Object.entries(PROP_DEFS)) {
    Sprites.props[name] = { img: PixelArt.make(w + 2, h + 2, (p) => { p.ctx.translate(1, 1); fn(p); }, OUTLINE, 'soft'), ax: Math.round(w / 2) + 1, ay: h };
  }
}

/** Draws a prop with its bottom centre at (x, y). */
function drawProp(ctx, name, x, y, flip = false, alpha = 1) {
  const pr = Sprites.props[name];
  if (pr) drawSprite(ctx, pr.img, x, y, pr.ax, pr.ay, flip, alpha);
}

/** A stone copy of a sprite (grey, lit from above) for statues. */
function stoneify(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] < 40) continue;
    const l = (d.data[i] * 0.3 + d.data[i + 1] * 0.55 + d.data[i + 2] * 0.15) / 255;
    const v = 40 + l * 150;
    d.data[i] = v * 0.98; d.data[i + 1] = v * 0.96; d.data[i + 2] = v * 1.08;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}
