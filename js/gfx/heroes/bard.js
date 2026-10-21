// Bard: a travelling minstrel with a honey-blonde bob and a braid over her
// shoulder under a tilted plum beret
// and its sweeping white feather, a cream blouse with puffed sleeves under a
// teal corset laced in gold, a plum skirt with a gold hem, striped stockings
// and short boots. Her lute is drawn separately.

function drawBard(p, P) {
  const { b, hb, s } = P;
  const PL = ['#2a1230', '#4a1e4e', '#6e2c68', '#944488', '#b866a8'];   // plum
  const TE = ['#0e2a30', '#1e5a64', '#2e7a84', '#4aa0a8', '#7ac8c8'];   // teal
  const CR = ['#a89878', '#cdbd9a', '#e8dcc0', '#fff6e0'];              // cream linen
  const HA = ['#5a3a10', '#8a6420', '#c8962e', '#e8c050', '#f8e088'];   // honey-blonde hair
  const L = RAMP.leather;
  const G = CUTE.brass;
  const Sk = RAMP.skin;

  // a short bob at the back of the head, curling under at the nape
  p.round(24, 11 + hb, 9, 13, HA[2], 3);
  p.rect(25, 13 + hb, 2, 8, HA[3]);
  p.px(24 + P.sw, 23 + hb, HA[1]); p.px(26 + P.sw, 24 + hb, HA[1]);

  // back arm in a puffed sleeve
  const ba = P.ba;
  p.round(25, 23 + b, 7, 7, CR[1], 3);
  p.poly([[27, 29 + b], [30, 29 + b], [29 + ba, 34 + b], [26 + ba, 34 + b]], CR[1]);
  p.rect(26 + ba, 34 + b, 3, 2, Sk[1]);

  // striped stockings and short boots with turned-down cuffs
  const stripes = (row) => (row % 3 === 0 ? [PL[1], PL[2], PL[3]] : [CR[0], CR[1], CR[2]]);
  const stripesFront = (row) => (row % 3 === 0 ? [PL[2], PL[3], PL[4]] : [CR[1], CR[2], CR[3]]);
  cuteLeg(p, 29, 29 - s, P.lb, stripes, [L[0], L[1], L[2]], 53, L[3]);
  cuteLeg(p, 34, 34 + s, P.lf, stripesFront, [L[1], L[2], L[3]], 53, L[4]);

  // layered skirt: a cream petticoat peeking under a plum overskirt with a gold hem
  const hem = Math.round(s / 2);
  p.poly([[27, 33 + b], [39, 33 + b], [43 + hem, 45 + b], [23 + hem, 45 + b]], CR[2]);
  p.poly([[27, 33 + b], [39, 33 + b], [42 + hem, 43 + b], [24 + hem, 43 + b]], PL[2]);
  p.poly([[27, 33 + b], [30, 33 + b], [27 + hem, 43 + b], [24 + hem, 43 + b]], PL[3]);
  p.poly([[37, 33 + b], [39, 33 + b], [42 + hem, 43 + b], [39 + hem, 43 + b]], PL[1]);
  p.rect(24 + hem, 42 + b, 19, 1, G[2]);
  p.line(33, 35 + b, 33 + hem, 42 + b, PL[1]);
  for (let x = 24; x <= 41; x += 4) p.px(x + hem, 45 + b, CR[1]);   // lace edge

  // cream blouse showing above a teal corset laced in gold
  p.round(28, 23 + b, 12, 5, CR[2], 2);
  p.rect(29, 23 + b, 4, 2, CR[3]);
  p.round(29, 26 + b, 10, 9, TE[2], 1);
  p.rect(29, 27 + b, 3, 6, TE[3]);
  p.rect(37, 27 + b, 2, 7, TE[1]);
  for (let y = 27; y <= 32; y += 2) { p.px(33, y + b, G[3]); p.px(35, y + b, G[3]); p.px(34, y + 1 + b, G[2]); }
  p.rect(29, 34 + b, 10, 1, TE[0]);
  // a little brooch at the neckline
  p.rect(33, 23 + b, 2, 2, '#d0303a');
  p.px(33, 23 + b, '#ff9a8a');

  // face and fringe
  cuteFace(p, P, ['#1a3a1e', '#2e6a32', '#4a9a4a', '#a8e8a0']);
  cuteBangs(p, P, HA);
  p.rect(27, 12 + b, 2, 9, HA[2]);               // the bob framing the face
  p.rect(26, 20 + b, 3, 2, HA[1]);
  // a single braid over the front shoulder, tied off with a plum ribbon
  for (let y = 15; y <= 32; y++) {
    const x = 39 + (y > 24 ? 1 : 0);
    const by = y + (y > 22 ? hb : b);
    p.rect(x, by, 2, 1, y % 2 === 0 ? HA[3] : HA[2]);
    p.px(x + (y % 2), by, y % 2 === 0 ? HA[4] : HA[1]);
  }
  p.rect(39, 33 + hb, 3, 2, PL[3]);
  p.px(42, 34 + hb, PL[2]);
  p.rect(40, 35 + hb, 2, 2, HA[2]);
  p.px(40, 37 + hb, HA[1]);

  // plum beret tilted back, a gold band and a long feather sweeping behind
  const hs = P.hs;
  p.poly([[25, 12 + b], [27, 7 + b], [33, 5 + b], [40, 6 + b], [43, 9 + b], [42, 12 + b]], PL[2]);
  p.poly([[27, 7 + b], [33, 5 + b], [36, 6 + b], [29, 9 + b]], PL[4]);
  p.rect(26, 11 + b, 16, 2, PL[1]);
  p.rect(27, 11 + b, 14, 1, G[2]);
  p.poly([[28, 9 + b], [23 + hs, 4 + hb], [16 + hs, 1 + hb], [12 + hs, 2 + hb], [17 + hs, 5 + hb], [24, 9 + b]], CR[3]);
  p.line(27, 9 + b, 15 + hs, 2 + hb, CR[1]);
  p.rect(12 + hs, 2 + hb, 3, 2, TE[3]);           // teal-dipped tip
  p.rect(28, 8 + b, 2, 3, G[3]);                  // feather clasp

  // front arm: puffed sleeve, a gold cuff, the hand that strums
  p.round(35, 23 + b, 7, 7, CR[2], 3);
  p.px(37, 24 + b, CR[3]);
  p.poly([[37, 29 + b], [40, 29 + b], [41, 33 + b], [38, 33 + b]], CR[1]);
  p.rect(38, 32 + b, 4, 1, G[2]);
  p.round(38, 33 + b, 4, 4, Sk[2], 1);
  p.px(38, 33 + b, Sk[3]);
}
