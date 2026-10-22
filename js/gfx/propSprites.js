// Set-dressing props for the lobby and the dungeon's special rooms, drawn in
// the same style as the characters (soft ramps, selective outlines). Each prop
// is a cached canvas anchored at its bottom centre: Sprites.props[name] =
// { img, ax, ay }. Draw one with drawProp(ctx, name, x, y, flip).

const WOOD = ['#2a1a10', '#4a2e1c', '#6a4428', '#8c5e36', '#ae7c4a'];
const STONE = ['#2a2834', '#423f50', '#5c586c', '#78738a', '#9a95ac'];
const IRON = ['#1e2028', '#363a46', '#545a6a', '#7a8092', '#a8aebc'];

// the keep's cats: [name, coat ramp darkest first, eye colour]
const CAT_COATS = {
  ginger: { name: 'WHISKERS', coat: ['#7a3a1a', '#b8622a', '#e08a44', '#f4b878'], eye: '#2a1a10' },
  black: { name: 'SOOT', coat: ['#08060c', '#16121c', '#2a2432', '#443c50'], eye: '#c8e040' },
  grey: { name: 'PEBBLE', coat: ['#34343e', '#585864', '#86869a', '#b4b4c4'], eye: '#2a1a10' },
  white: { name: 'SNOWDROP', coat: ['#9a929e', '#c8c0cc', '#ece6ee', '#ffffff'], eye: '#4a8aff' },
  cream: { name: 'BISCUIT', coat: ['#6a4a2a', '#a8845a', '#dcc29a', '#f6e8cc'], eye: '#2a1a10' },
};

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
  catHappy: [16, 14, (p) => cat(p, 'happy', 0)],

  // the keep's fireplace: a stone surround under a wooden mantel (the fire is drawn live)
  hearth: [66, 60, (p) => {
    // chimney breast rising up the wall
    p.rect(12, 0, 42, 16, STONE[2]);
    for (let y = 2; y < 16; y += 5) for (let x = 12 + ((y / 5) % 2) * 6; x < 52; x += 12) { p.rect(x, y, 11, 4, STONE[3]); p.rect(x, y, 11, 1, STONE[4]); }
    // mantel shelf with candles and a little clock
    p.rect(2, 16, 62, 6, WOOD[2]);
    p.rect(2, 16, 62, 2, WOOD[4]);
    p.rect(2, 21, 62, 1, WOOD[0]);
    p.rect(8, 9, 2, 7, '#f0e8d0'); p.rect(56, 10, 2, 6, '#f0e8d0');
    p.round(28, 8, 10, 8, WOOD[3], 2); p.circle(33, 12, 2, '#f0e8d0');
    // stone surround
    p.rect(5, 22, 56, 38, STONE[2]);
    for (let y = 24; y < 58; y += 6) for (let x = 5 + ((y / 6) % 2) * 5; x < 59; x += 10) { p.rect(x, y, 9, 5, STONE[3]); p.rect(x, y, 9, 1, STONE[4]); }
    // firebox: a soot-black arch with a grate and logs
    p.round(16, 30, 34, 28, '#140806', 8);
    p.rect(18, 50, 30, 8, '#24100a');
    p.rect(20, 52, 26, 2, IRON[2]);
    p.line(21, 50, 44, 46, WOOD[1], 3);
    p.line(22, 46, 45, 50, WOOD[2], 3);
    // hearthstone
    p.rect(2, 57, 62, 3, STONE[3]);
    p.rect(2, 57, 62, 1, STONE[4]);
  }],

  bedRed: [34, 48, (p) => bed(p, ['#5a1a22', '#87262a', '#ad3a36'])],
  bedBlue: [34, 48, (p) => bed(p, ['#1e2c4e', '#2c4270', '#3e5a96'])],
  bedGreen: [34, 48, (p) => bed(p, ['#1e3a2a', '#2a5a3a', '#3a7a4a'])],

  // padded armchair facing right (flip it to face left)
  armchair: [24, 28, (p) => {
    const V = ['#3a1018', '#6a1e2a', '#8a2e36', '#a8443c'];
    p.rect(3, 22, 2, 6, WOOD[1]); p.rect(19, 22, 2, 6, WOOD[1]);
    p.round(1, 2, 9, 22, V[1], 3);                 // tall back
    p.rect(3, 4, 4, 16, V[2]);
    p.round(4, 14, 19, 10, V[2], 2);               // seat
    p.rect(6, 14, 15, 2, V[3]);
    p.round(16, 10, 7, 12, V[1], 2);               // arm
    p.rect(17, 10, 5, 2, V[3]);
    for (const [x, y] of [[5, 7], [5, 12]]) p.px(x, y, '#d4ac4c');   // buttons
  }],

  // a tall grandfather clock (its hands and pendulum are drawn live)
  grandfatherClock: [26, 72, (p) => {
    // hood with a scrolled crown
    p.poly([[2, 8], [6, 3], [13, 0], [20, 3], [24, 8]], WOOD[3]);
    p.rect(12, 0, 2, 2, '#d4ac4c');
    p.rect(1, 8, 24, 20, WOOD[2]);
    p.rect(1, 8, 24, 2, WOOD[4]);
    p.rect(1, 8, 2, 20, WOOD[3]);
    p.rect(23, 8, 2, 20, WOOD[1]);
    // the dial: brass bezel, ivory face, hour ticks
    p.circle(13, 18, 9, '#a07a24');
    p.circle(13, 18, 8, '#f0e8d0');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      p.px(Math.round(13 + Math.cos(a) * 6.5), Math.round(18 + Math.sin(a) * 6.5), i % 3 === 0 ? '#2a1a10' : '#8a7a5a');
    }
    // waist with a glass door over the pendulum
    p.rect(4, 28, 18, 30, WOOD[2]);
    p.rect(4, 28, 2, 30, WOOD[3]);
    p.rect(20, 28, 2, 30, WOOD[1]);
    p.rect(7, 31, 12, 24, '#1e120a');
    p.rect(7, 31, 12, 1, WOOD[0]);
    p.rect(8, 32, 1, 22, '#4a3a4e');                     // glint on the glass
    // plinth and feet
    p.rect(1, 58, 24, 12, WOOD[2]);
    p.rect(1, 58, 24, 2, WOOD[4]);
    p.rect(4, 62, 18, 5, WOOD[1]);
    p.rect(1, 70, 4, 2, WOOD[1]); p.rect(21, 70, 4, 2, WOOD[1]);
  }],

  // ---------- training grounds ----------

  // a fresh straw butt for the live targets (TrainingTarget sticks arrows in as you hit it)
  targetClean: [36, 46, (p) => archeryButt(p, false)],
  // straw archery butt on an easel, peppered with arrows
  target: [36, 46, (p) => {
    p.line(6, 45, 13, 8, WOOD[1], 3); p.line(30, 45, 23, 8, WOOD[1], 3);   // easel legs
    p.line(18, 45, 18, 30, WOOD[0], 2);
    p.circle(18, 20, 15, '#c8a85a');                 // straw boss
    p.circle(18, 20, 13, '#efe6d2');
    p.circle(18, 20, 10, '#d84a4a');
    p.circle(18, 20, 7, '#efe6d2');
    p.circle(18, 20, 4, '#d84a4a');
    p.circle(18, 20, 2, '#ffd34a');
    for (const [x, y, dx] of [[20, 18, 7], [12, 24, -6], [24, 26, 8], [16, 13, -7], [21, 21, 6]]) {   // arrows stuck in it
      p.line(x, y, x + dx, y - 4, '#8c5e36');
      p.rect(x + dx - (dx > 0 ? 0 : 2), y - 6, 3, 3, '#efe6d2');
    }
    p.line(4, 8, 7, 12, '#c8a85a'); p.line(30, 30, 33, 28, '#c8a85a');     // loose straw
  }],

  // a beaten straw dummy, sagging on its post with straw spilling out
  dummyBroken: [30, 44, (p) => {
    p.rect(14, 18, 3, 26, WOOD[2]);
    p.rect(14, 18, 1, 26, WOOD[3]);
    p.poly([[6, 14], [22, 10], [24, 30], [9, 32]], '#c8a85a');          // slumped body
    p.poly([[6, 14], [12, 13], [13, 31], [9, 32]], '#e0c47a');
    p.line(8, 22, 22, 20, '#7a5a24', 2);                                  // rope
    p.round(16, 2, 11, 10, '#c8a85a', 3);                                 // head lolling to one side
    p.px(19, 6, '#3a2a10'); p.px(23, 6, '#3a2a10');
    p.rect(19, 9, 4, 1, '#3a2a10');
    for (const [x, y, x2, y2] of [[10, 32, 6, 40], [14, 32, 13, 42], [20, 31, 25, 41], [4, 18, 0, 22], [24, 16, 29, 14]]) p.line(x, y, x2, y2, '#e0c47a');
    p.line(9, 26, 20, 16, '#8a2a24', 2);                                  // a deep slash
  }],

  // a pell: a thick wooden post hacked full of notches
  pell: [16, 40, (p) => {
    p.rect(4, 2, 9, 36, WOOD[2]);
    p.rect(4, 2, 3, 36, WOOD[3]);
    p.rect(4, 2, 9, 2, WOOD[4]);
    for (const y of [8, 13, 19, 24, 30]) { p.line(5, y, 12, y + 2, WOOD[0]); p.px(7, y + 1, WOOD[1]); }
    p.rect(1, 36, 15, 4, STONE[2]);
    p.rect(1, 36, 15, 1, STONE[3]);
  }],

  // a big shady oak for the yard
  tree: [72, 92, (p) => {
    p.poly([[30, 92], [42, 92], [40, 58], [44, 48], [36, 52], [32, 46], [32, 60]], WOOD[1]);   // trunk
    p.rect(33, 58, 3, 32, WOOD[2]);
    p.line(30, 92, 24, 90, WOOD[1], 2); p.line(42, 92, 49, 90, WOOD[1], 2);                     // roots
    const G = ['#1a3a1e', '#24502a', '#2e6a34', '#3e8040', '#5a9a52'];
    for (const [cx, cy, r] of [[36, 28, 26], [18, 36, 16], [54, 36, 16], [26, 16, 14], [48, 16, 14], [36, 44, 14]]) p.circle(cx, cy, r, G[1]);
    for (const [cx, cy, r] of [[34, 24, 20], [18, 32, 11], [52, 32, 11], [26, 13, 10], [46, 13, 10]]) p.circle(cx, cy, r, G[2]);
    for (const [cx, cy, r] of [[30, 18, 11], [16, 28, 6], [44, 10, 6], [24, 9, 5]]) p.circle(cx, cy, r, G[3]);
    for (const [x, y] of [[26, 12], [28, 14], [14, 26], [42, 8], [33, 16]]) p.rect(x, y, 2, 2, G[4]);
    for (const [x, y] of [[44, 30], [22, 40], [50, 20]]) p.circle(x, y, 2, '#d84a4a');           // apples
  }],

  // a lantern on an iron post, lighting the yard
  lampPost: [14, 56, (p) => {
    p.rect(6, 12, 3, 42, IRON[1]);
    p.rect(6, 12, 1, 42, IRON[3]);
    p.rect(3, 52, 9, 4, IRON[1]);
    p.rect(2, 2, 11, 11, IRON[1]);
    p.rect(4, 4, 7, 7, '#ffd36a');
    p.rect(5, 5, 3, 3, '#fff6c8');
    p.rect(1, 0, 13, 3, IRON[2]);
  }],

  // ---------- library ----------

  // long reading table with open books, a candle and a stack of tomes
  readingTable: [60, 32, (p) => {
    p.rect(5, 16, 4, 15, WOOD[1]); p.rect(51, 16, 4, 15, WOOD[1]);
    p.rect(1, 9, 58, 9, WOOD[2]);
    p.rect(1, 9, 58, 2, WOOD[4]);
    p.rect(1, 17, 58, 1, WOOD[0]);
    p.rect(8, 6, 16, 6, '#e8dcc0'); p.rect(16, 6, 1, 6, '#a89878');      // open book
    for (let i = 0; i < 2; i++) { p.rect(10, 8 + i * 2, 5, 1, '#8a7a5a'); p.rect(18, 8 + i * 2, 5, 1, '#8a7a5a'); }
    p.rect(30, 4, 12, 4, '#7a2a3a'); p.rect(31, 1, 10, 3, '#2a4a7a'); p.rect(32, -1, 9, 2, '#3a6a3a');   // book stack
    p.rect(48, 1, 2, 9, '#f0e8d0'); p.rect(46, 9, 6, 2, '#d4ac4c');     // candle
    p.rect(26, 9, 3, 1, '#2a1a10'); p.line(27, 9, 29, 5, '#efe6d2');     // inkwell and quill
  }],

  // a carved wooden chair facing right (flip it to face left)
  chair: [18, 28, (p) => {
    p.rect(2, 0, 4, 28, WOOD[2]);                    // tall back
    p.rect(2, 0, 4, 2, WOOD[4]);
    p.rect(3, 4, 2, 10, WOOD[3]);
    p.rect(2, 15, 15, 4, WOOD[3]);                   // seat
    p.rect(2, 15, 15, 1, WOOD[4]);
    p.rect(14, 19, 3, 9, WOOD[1]);
    p.rect(6, 15, 9, 3, '#6a1e2a');                  // cushion
  }],

  // the librarian's front desk: a counter with a ledger, a bell and returned books
  desk: [56, 30, (p) => {
    p.rect(2, 8, 52, 22, WOOD[2]);
    p.rect(2, 8, 52, 2, WOOD[4]);
    p.rect(6, 13, 20, 13, WOOD[1]); p.rect(30, 13, 20, 13, WOOD[1]);    // panels
    p.rect(7, 14, 18, 1, WOOD[3]); p.rect(31, 14, 18, 1, WOOD[3]);
    p.rect(8, 4, 14, 5, '#e8dcc0'); p.rect(15, 4, 1, 5, '#a89878');      // ledger
    p.circle(30, 6, 3, '#d4ac4c'); p.px(30, 2, '#d4ac4c');               // bell
    p.rect(38, 3, 12, 3, '#3a6a3a'); p.rect(39, 0, 10, 3, '#7a2a3a');    // returned books
  }],

  // a globe on a brass stand
  globe: [22, 34, (p) => {
    p.rect(9, 22, 4, 10, '#a07a24');
    p.rect(4, 31, 14, 3, '#7a5a24');
    p.circle(11, 12, 10, '#2c4a7a');
    p.circle(10, 11, 8, '#3a6aa8');
    p.poly([[6, 6], [12, 5], [13, 10], [8, 13]], '#5a9a52');               // continents
    p.poly([[12, 14], [17, 12], [16, 18]], '#5a9a52');
    p.px(7, 7, '#cfe0ff');
    p.line(1, 12, 21, 12, '#d4ac4c'); p.line(11, 1, 11, 23, '#d4ac4c');
  }],

  // a rack of scrolls in pigeonholes
  scrollRack: [36, 44, (p) => {
    p.rect(1, 0, 34, 44, WOOD[1]);
    p.rect(1, 0, 34, 2, WOOD[3]);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 3 + c * 8;
        const y = 4 + r * 10;
        p.rect(x, y, 7, 8, WOOD[0]);
        if ((r * 4 + c) % 5 === 3) continue;
        p.circle(x + 3, y + 4, 3, '#e8dcc0');
        p.px(x + 3, y + 4, '#a89878');
        if ((r + c) % 3 === 0) p.rect(x + 1, y + 3, 5, 1, '#8a2a24');   // ribbon
      }
    }
  }],

  // a crooked stack of books on the floor
  bookStack: [20, 18, (p) => {
    const cols = ['#7a2a3a', '#2a4a7a', '#3a6a3a', '#7a5a24', '#5a2a7a'];
    cols.forEach((c, i) => {
      const off = [0, 2, -1, 1, 0][i];
      p.rect(2 + off, 14 - i * 3, 16, 3, c);
      p.rect(2 + off, 14 - i * 3, 16, 1, '#e8dcc0');
    });
  }],

  rugRound: [64, 30, (p) => {
    p.ellipse(32, 15, 30, 13, '#5a1a3a');
    p.ellipse(32, 15, 27, 11, '#7a2a4a');
    p.ellipse(32, 15, 20, 7, '#3a1a4a');
    p.ellipse(32, 15, 8, 3, '#d4ac4c');
  }],
};

/**
 * A little cat facing right: sitting, mid-stride (step 0/1), or "happy" (sitting with its eyes
 * squeezed shut and its tail up, being petted). C = coat ramp, darkest first; eye = eye colour.
 */
function cat(p, mode, step, C = CAT_COATS.ginger.coat, eye = '#2a1a10') {
  if (mode === 'happy') {
    p.round(3, 5, 8, 8, C[2], 3);
    p.rect(4, 6, 3, 6, C[3]);
    p.line(3, 11, 1, 4, C[1]);                      // tail straight up
    p.px(2, 3, C[1]);
    p.round(8, 2, 7, 6, C[2], 2);                   // head tipped back into the hand
    p.px(9, 1, C[2]); p.px(13, 1, C[2]);
    const shut = eye === '#2a1a10' ? '#2a1a10' : C[3];   // ^ ^ eyes (pale on a dark coat)
    p.px(10, 5, shut); p.px(11, 4, shut); p.px(12, 5, shut);
    p.px(13, 5, shut); p.px(14, 4, shut); p.px(15, 5, shut);
    p.px(12, 6, '#e8a0a0');
    p.rect(7, 12, 2, 1, C[3]); p.rect(10, 12, 2, 1, C[3]);
    return;
  }
  if (mode === 'sit') {
    p.round(3, 5, 8, 8, C[2], 3);                  // body
    p.rect(4, 6, 3, 6, C[3]);
    p.line(3, 12, 0, 9, C[1]);                      // tail curled up
    p.px(0, 8, C[1]);
    p.round(8, 1, 7, 6, C[2], 2);                   // head
    p.px(9, 0, C[2]); p.px(13, 0, C[2]);            // ears
    p.px(11, 3, eye); p.px(13, 3, eye); // eyes
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
  p.px(13, 3, eye);
  for (const x of [4, 7]) p.px(x, 4, C[1]);
  // legs mid-stride
  const a = step ? 1 : -1;
  for (const [x, s] of [[2, a], [4, -a], [8, a], [10, -a]]) p.rect(x + s, 9, 1, 4, C[1]);
}

/** A wooden bed seen from the foot, headboard against the wall. blanket = [dark, mid, light]. */
function bed(p, blanket) {
  p.rect(1, 0, 32, 14, WOOD[2]);                    // headboard
  p.rect(1, 0, 32, 2, WOOD[4]);
  p.rect(4, 4, 26, 8, WOOD[1]);
  p.rect(1, 0, 3, 48, WOOD[1]); p.rect(30, 0, 3, 48, WOOD[1]);   // posts
  p.rect(4, 12, 26, 32, '#e8e2d4');                 // sheet
  p.round(7, 13, 20, 8, '#f8f4ec', 3);              // pillow
  p.rect(9, 14, 16, 2, '#ffffff');
  p.rect(4, 22, 26, 22, blanket[1]);                // blanket folded back
  p.rect(4, 22, 26, 3, '#f0eadc');
  p.rect(4, 25, 26, 2, blanket[2]);
  p.rect(4, 38, 26, 6, blanket[0]);
  for (let x = 6; x < 30; x += 6) p.rect(x, 30, 3, 3, blanket[2]);   // quilted squares
  p.rect(1, 43, 32, 5, WOOD[2]);                    // footboard
  p.rect(1, 43, 32, 1, WOOD[4]);
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
  // every coat of cat in each pose: catSit_black, catWalk1_grey, catHappy_cream...
  for (const [coat, c] of Object.entries(CAT_COATS)) {
    for (const [pose, mode, step] of [['Sit', 'sit', 0], ['Walk1', 'walk', 0], ['Walk2', 'walk', 1], ['Happy', 'happy', 0]]) {
      PROP_DEFS[`cat${pose}_${coat}`] = [16, 14, (p) => cat(p, mode, step, c.coat, c.eye)];
    }
  }
  for (const [name, [w, h, fn]] of Object.entries(PROP_DEFS)) {
    Sprites.props[name] = { img: PixelArt.make(w + 2, h + 2, (p) => { p.ctx.translate(1, 1); fn(p); }, OUTLINE, 'soft'), ax: Math.round(w / 2) + 1, ay: h };
  }
  // a dummy charred black by spell practice
  const d = Sprites.props.dummy;
  Sprites.props.dummyBurnt = { ...d, img: charred(d.img) };
}

/** A soot-blackened copy of a sprite, with embers glowing in its darkest cracks. */
function charred(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] < 40) continue;
    const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 765;
    const v = 18 + l * 70;
    const ember = (i / 4) % 23 === 0 && l > 0.3;
    d.data[i] = ember ? 230 : v * 1.1;
    d.data[i + 1] = ember ? 110 : v * 0.9;
    d.data[i + 2] = ember ? 40 : v * 0.8;
  }
  ctx.putImageData(d, 0, 0);
  return c;
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

/** A straw archery butt on an easel (arrows: a few old ones stuck in it). */
function archeryButt(p, arrows) {
  p.line(6, 45, 13, 8, WOOD[1], 3); p.line(30, 45, 23, 8, WOOD[1], 3);   // easel legs
  p.line(18, 45, 18, 30, WOOD[0], 2);
  p.circle(18, 20, 15, '#c8a85a');                 // straw boss
  p.circle(18, 20, 13, '#efe6d2');
  p.circle(18, 20, 10, '#d84a4a');
  p.circle(18, 20, 7, '#efe6d2');
  p.circle(18, 20, 4, '#d84a4a');
  p.circle(18, 20, 2, '#ffd34a');
  if (arrows) {
    for (const [x, y, dx] of [[20, 18, 7], [12, 24, -6], [24, 26, 8], [16, 13, -7], [21, 21, 6]]) {
      p.line(x, y, x + dx, y - 4, '#8c5e36');
      p.rect(x + dx - (dx > 0 ? 0 : 2), y - 6, 3, 3, '#efe6d2');
    }
  }
  p.line(4, 8, 7, 12, '#c8a85a'); p.line(30, 30, 33, 28, '#c8a85a');     // loose straw
}
