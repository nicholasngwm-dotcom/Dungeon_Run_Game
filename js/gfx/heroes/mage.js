// Mage: a little witch with long copper hair, a drooping charcoal witch hat
// with a teal band and a brass star, a wine dress with a bone-white frilled
// hem and collar, striped stockings and a teal cape lining.
// Her crescent-moon staff is drawn separately.

function drawMage(p, P) {
  const { b, hb, s } = P;
  const HR = ['#3e1a12', '#6e2e1a', '#a24a26', '#d0763a', '#f0a860'];   // copper hair
  const D = ['#100c10', '#1c161c', '#2a2129', '#3c3038', '#54444e'];    // charcoal hat/cape
  const V = ['#2a0c16', '#4a1424', '#6e2032', '#922e40', '#b84a56'];    // wine dress
  const RO = ['#0e2a2c', '#17484a', '#246a68', '#3a908a'];              // teal ribbons
  const WH = ['#5a5244', '#8f8672', '#c8bfa8', '#ece4d0'];              // bone lace
  const CY = ['#0e3a3a', '#1f7a72', '#3fc2a8', '#9cf0d8', '#f0fff8'];   // ghostly magic
  const G = CUTE.brass;
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const sw = P.sw;
  const f = P.cf;

  // cape behind, hem fluttering back, teal lining
  p.poly([[27, 23 + b], [33, 23 + b], [32, 34 + b], [31, 47], [27, 50], [22 + f, 51],
    [17 + f, 48], [19, 38 + b], [23, 28 + b]], D[1]);
  p.line(23, 28 + b, 17 + f, 48, RO[1]);
  p.line(24, 27 + b, 19 + f, 47, RO[2]);
  p.line(28, 30 + b, 25 + f, 49, D[0]);
  p.line(30, 33 + b, 29, 47, D[2]);

  // long copper hair down the back
  p.poly([[25, 13 + b], [34, 13 + b], [34, 22 + b], [32, 30 + hb], [30, 37 + hb], [27 + sw, 41 + hb],
    [23 + sw, 39 + hb], [22 + sw, 34 + hb], [23, 26 + b], [24, 18 + b]], HR[2]);
  p.line(26, 16 + b, 24 + sw, 37 + hb, HR[3]);
  p.line(25, 19 + b, 23 + sw, 31 + hb, HR[4]);
  p.line(30, 23 + b, 27 + sw, 39 + hb, HR[1]);
  p.line(32, 25 + b, 30, 35 + hb, HR[1]);
  // ribbon tying it at the nape
  p.poly([[27, 22 + b], [24, 20 + b], [24, 25 + b]], RO[2]);
  p.rect(26, 21 + b, 3, 3, RO[1]);
  p.px(26, 21 + b, RO[3]);
  p.line(26, 24 + b, 25 + sw, 28 + hb, RO[1]);
  p.line(28, 24 + b, 28, 28 + hb, RO[2]);

  // back arm
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], V[1]);
  p.rect(27 + ba, 31 + b, 3, 1, WH[1]);

  // striped stockings and little boots
  const stripes = (back) => (row) => (row % 4 < 2
    ? (back ? [V[0], V[1], V[2]] : [V[1], V[2], V[3]])
    : (back ? [WH[0], WH[1], WH[2]] : [WH[1], WH[2], WH[3]]));
  cuteLeg(p, 29, 29 - s, P.lb, stripes(true), [L[0], L[1], L[2]], 54, L[2]);
  cuteLeg(p, 34, 34 + s, P.lf, stripes(false), [L[1], L[2], L[3]], 54, L[4]);

  // puffy skirt, swaying with the stride
  const hem = Math.round(s / 2);
  p.poly([[28, 33 + b], [38, 33 + b], [43 + hem, 46 + b], [23 + hem, 46 + b]], V[2]);
  p.poly([[28, 33 + b], [31, 33 + b], [28 + hem, 46 + b], [23 + hem, 46 + b]], V[3]);
  p.poly([[36, 33 + b], [38, 33 + b], [43 + hem, 46 + b], [39 + hem, 46 + b]], V[1]);
  p.line(33, 36 + b, 33 + hem, 45 + b, V[1]);
  p.line(30, 37 + b, 28 + hem, 45 + b, V[2]);
  p.px(27 + hem, 42 + b, G[3]);
  p.px(36 + hem, 40 + b, G[2]);
  p.px(40 + hem, 44 + b, G[2]);
  // frilly hem
  p.rect(23 + hem, 46 + b, 21, 1, WH[2]);
  for (let x = 23; x <= 43; x += 2) p.px(x + hem, 47 + b, WH[1]);

  // bodice and sash with a brass buckle
  p.round(29, 24 + b, 10, 11, V[2], 1);
  p.rect(29, 25 + b, 3, 8, V[3]);
  p.rect(37, 26 + b, 2, 8, V[1]);
  p.rect(28, 33 + b, 11, 2, RO[1]);
  p.rect(28, 33 + b, 11, 1, RO[2]);
  p.rect(33, 33 + b, 2, 2, G[2]);
  p.px(33, 33 + b, G[3]);

  // neck
  p.rect(32, 22 + b, 4, 3, Sk[1]);
  p.rect(32, 22 + b, 4, 1, Sk[0]);

  // bone-white capelet collar and chest bow
  p.poly(shift([[28, 24], [39, 24], [40, 27], [37, 28], [34, 27], [31, 28], [27, 27]], b), WH[2]);
  p.rect(29, 24 + b, 9, 1, WH[3]);
  p.px(30, 27 + b, WH[1]);
  p.px(38, 27 + b, WH[1]);
  p.poly(shift([[34, 27], [31, 25], [31, 29]], b), RO[2]);
  p.poly(shift([[35, 27], [38, 25], [38, 29]], b), RO[1]);
  p.rect(33, 26 + b, 3, 3, RO[2]);
  p.px(33, 26 + b, RO[3]);
  p.px(33, 29 + b, RO[1]);
  p.px(35, 30 + b, RO[1]);

  // face, fringe, side locks framing the face
  cuteFace(p, P, [CY[0], CY[1], CY[2], CY[3]]);
  cuteBangs(p, P, HR);
  p.poly([[27, 14 + b], [30, 14 + b], [30, 22 + b], [30 + sw, 28 + hb], [27 + sw, 27 + hb]], HR[2]);
  p.line(28, 15 + b, 28 + sw, 25 + hb, HR[3]);
  p.rect(39, 14 + b, 2, 6, HR[2]);
  p.px(40, 20 + hb, HR[1]);
  p.px(39, 14 + b, HR[3]);

  // witch hat: drooping cone, wide brim, teal band with a brass star
  const hs = P.hs;
  p.poly(shift([[26, 11], [40, 11], [38, 6], [35, 3], [32, 1], [27, 1], [23 + hs, 3],
    [19 + hs, 6], [21 + hs, 7], [25, 5], [27, 7]], b), D[2]);
  p.line(28, 10 + b, 28, 3 + b, D[3]);
  p.line(29, 2 + b, 24 + hs, 4 + b, D[3]);
  p.line(37, 10 + b, 35, 4 + b, D[1]);
  p.rect(27, 9 + b, 13, 2, RO[1]);
  p.rect(27, 9 + b, 13, 1, RO[2]);
  p.px(33, 8 + b, G[2]); p.rect(32, 9 + b, 3, 1, G[2]); p.px(33, 10 + b, G[2]); p.px(33, 9 + b, G[3]);
  p.poly(shift([[21, 13], [26, 10], [40, 10], [46, 12], [44, 14], [36, 15], [27, 15], [22, 15]], b), D[2]);
  p.poly(shift([[22, 14], [44, 14], [36, 15], [27, 15], [22, 15]], b), D[0]);
  p.line(22, 13 + b, 26, 11 + b, D[4]);
  p.line(27, 11 + b, 39, 11 + b, D[3]);
  // little star dangling from the hat tip
  const tx = 19 + hs;
  p.px(tx, 8 + b, G[2]); p.px(tx - 1, 9 + b, G[2]); p.px(tx + 1, 9 + b, G[2]); p.px(tx, 10 + b, G[2]);
  p.px(tx, 9 + b, G[3]);

  // casting arm: wine sleeve, bone cuff, open hand
  const hx = 43;
  const hy = 34 + b;
  p.poly([[35, 24 + b], [38, 24 + b], [hx - 1, hy - 2], [hx - 1, hy + 1], [hx - 5, hy + 2], [35, 31 + b]], V[2]);
  p.line(36, 25 + b, hx - 4, hy - 1, V[3]);
  p.line(36, 30 + b, hx - 5, hy + 1, V[1]);
  p.rect(hx - 3, hy - 2, 2, 4, WH[2]);
  p.px(hx - 3, hy - 2, WH[3]);
  p.rect(hx - 1, hy - 1, 3, 3, Sk[2]);
  p.px(hx - 1, hy + 1, Sk[1]);
  p.px(hx + 2, hy, Sk[1]);
}
