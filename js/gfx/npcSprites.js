// Friendly dungeon NPCs: Mira the shopkeeper and the restaurant's chef.
// 64x64, facing right, same anchor and style as the heroes.

function drawShopkeeper(p, pose) {
  const b = pose.bob;
  const Hr = ['#5a1a10', '#8a2a18', '#b8442a', '#e06a40'];      // red hair
  const D = ['#1e3a2a', '#2e5a3e', '#3e7a52', '#5a9a6a'];        // green dress
  const A = ['#a89878', '#cdbd9a', '#e8dcc0', '#fff6e0'];        // apron
  const Sk = RAMP.skin;
  const G = RAMP.gold;
  // long hair down the back
  p.poly(shift([[26, 12], [32, 11], [31, 32], [25, 36], [22, 30], [24, 18]], b), Hr[1]);
  p.line(25, 16 + b, 23, 32 + b, Hr[2]);
  // dress to the floor
  p.poly(shift([[26, 21], [38, 21], [40, 33]], b).concat([[43, 57], [22, 57]], shift([[24, 33]], b)), D[2]);
  p.poly(shift([[26, 21], [29, 21]], b).concat([[26, 57], [22, 57]], shift([[24, 33]], b)), D[3]);
  p.rect(22, 56, 21, 1, D[0]);
  // apron
  p.poly(shift([[29, 27], [37, 27], [38, 33]], b).concat([[39, 53], [28, 53]], shift([[28, 33]], b)), A[2]);
  p.rect(28, 52, 12, 1, A[0]);
  p.rect(30, 38 + b, 6, 4, A[1]);                                  // pocket
  p.rect(26, 31 + b, 13, 2, A[1]);                                 // apron tie
  // shawl
  p.poly(shift([[24, 20], [40, 20], [41, 25], [33, 27], [24, 25]], b), '#7a3a5a');
  p.rect(25, 20 + b, 14, 1, '#9a5a7a');
  // head
  heroFace(p, b, Sk, '#3e7a52', { mouth: '#b85a5a' });
  p.rect(31, 10 + b, 9, 3, Hr[2]);                                 // fringe
  p.rect(30, 10 + b, 2, 9, Hr[2]);
  p.px(37, 12 + b, Hr[1]);
  p.rect(30, 9 + b, 9, 1, Hr[3]);
  // gold earring and a coin necklace
  p.px(31, 18 + b, G[3]);
  p.rect(34, 22 + b, 2, 2, G[2]);
  // arm resting forward
  p.poly(shift([[36, 23], [40, 23], [43, 30], [41, 33], [37, 29]], b), D[2]);
  p.rect(41, 30 + b, 3, 3, Sk[2]);
}

function drawChef(p, pose) {
  const b = pose.bob;
  const W = ['#a8a2b4', '#d4cfdc', '#f0edf4', '#ffffff'];
  const Sk = RAMP.skin;
  const L = RAMP.leather;
  heroLegs(p, pose, 5,
    { leg: ['#2c2c3a', '#3e3e52', '#56566e'], boot: [L[0], L[1], L[2]] },
    { leg: ['#3e3e52', '#56566e', '#6a6a84'], boot: [L[1], L[2], L[3]] }, 54);
  // round white jacket
  p.poly(shift([[24, 21], [39, 21], [42, 30], [40, 39], [24, 39], [22, 30]], b), W[2]);
  p.rect(23, 23 + b, 4, 15, W[3]);
  p.rect(37, 24 + b, 3, 14, W[1]);
  for (const y of [25, 29, 33]) { p.px(34, y + b, '#585d6c'); p.px(36, y + b, '#585d6c'); }
  p.rect(25, 36 + b, 15, 3, '#c0302a');                            // red sash
  // face with a big moustache
  heroFace(p, b, Sk, '#3a2a1a');
  p.rect(34, 18 + b, 7, 2, '#5a3a1a');
  p.px(41, 19 + b, '#5a3a1a');
  // tall chef hat
  p.rect(29, 9 + b, 11, 3, W[1]);
  p.round(28, 1 + b, 13, 9, W[2], 3);
  p.round(29, 1 + b, 6, 6, W[3], 2);
  // arm holding a ladle
  p.rect(37, 24 + b, 4, 8, W[2]);
  p.rect(39, 32 + b, 3, 3, Sk[2]);
  p.line(41, 34 + b, 47, 22 + b, '#80869a');
  p.round(45, 19 + b, 5, 4, '#adb2c0', 1);
}

function buildNpcSprites() {
  Sprites.npcs = {
    shopkeeper: buildPoseFrames(drawShopkeeper, 64, HERO_POSES, 0.5),
    chef: buildPoseFrames(drawChef, 64, HERO_POSES, 0.5),
  };
}
