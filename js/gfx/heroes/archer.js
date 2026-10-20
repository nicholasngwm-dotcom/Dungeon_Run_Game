// Archer: a medieval longbow archer in a green hood with a dagged capelet,
// laced leather jerkin, chestnut braid, brown hose and tall folded boots,
// and a quiver of red-fletched arrows. The longbow is drawn separately.

function drawArcher(p, P) {
  const { b, hb, s } = P;
  const GR = ['#121e10', '#22361a', '#345226', '#4a6e32', '#6a8e44'];   // forest green
  const LN = ['#7a6a4a', '#b8a67e', '#e0d2aa', '#f8f0d8'];              // linen
  const BR = ['#1e1612', '#33261e', '#4c3a2c', '#6a523e'];              // brown hose
  const HA = ['#3a1a0e', '#66301a', '#944a26', '#bc6a36', '#dc9050'];   // chestnut hair
  const L = RAMP.leather;
  const G = CUTE.brass;
  const Sk = RAMP.skin;
  const FL = '#c84040';

  // quiver on the back with arrows
  p.poly(shift([[19, 21], [24, 19], [28, 35], [23, 36]], b), L[2]);
  p.line(20, 22 + b, 24, 35 + b, L[3]);
  p.line(23, 20 + b, 27, 34 + b, L[1]);
  p.round(18, 19 + b, 7, 3, L[1], 1);
  for (const [x0, x1, tip] of [[20, 16, FL], [22, 19, LN[2]], [24, 23, FL]]) {
    p.line(x0, 19 + b, x1, 12 + b, L[4]);
    p.rect(x1 - 1, 9 + b, 2, 3, tip);
  }

  // pointed hood tail hanging down the back
  p.poly([[26, 13 + b], [30, 13 + b], [28, 21 + b], [23 + P.sw, 31 + hb], [21 + P.sw, 30 + hb], [25, 20 + b]], GR[1]);
  p.line(27, 15 + b, 22 + P.sw, 30 + hb, GR[2]);

  // back arm in a linen sleeve
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], LN[1]);
  p.rect(26 + ba, 32 + b, 3, 2, Sk[1]);

  // brown hose, tall folded boots
  cuteLeg(p, 29, 29 - s, P.lb, [BR[0], BR[1], BR[2]], [L[0], L[1], L[2]], 50, L[2]);
  cuteLeg(p, 34, 34 + s, P.lf, [BR[1], BR[2], BR[3]], [L[1], L[2], L[3]], 50, L[4]);

  // green tunic skirt with a dagged hem
  const hem = Math.round(s / 2);
  p.poly([[28, 33 + b], [38, 33 + b], [41 + hem, 44 + b], [25 + hem, 44 + b]], GR[2]);
  p.poly([[28, 33 + b], [31, 33 + b], [28 + hem, 44 + b], [25 + hem, 44 + b]], GR[3]);
  p.poly([[36, 33 + b], [38, 33 + b], [41 + hem, 44 + b], [38 + hem, 44 + b]], GR[1]);
  for (let x = 25; x <= 39; x += 3) {
    const c = x < 36 ? GR[2] : GR[1];
    p.rect(x + hem, 44 + b, 2, 1, c);
    p.px(x + hem, 45 + b, c);
  }
  p.line(33, 36 + b, 33 + hem, 43 + b, GR[1]);

  // leather jerkin with front lacing and the quiver strap
  p.round(29, 24 + b, 10, 11, L[3], 1);
  p.rect(29, 25 + b, 3, 8, L[4]);
  p.rect(37, 26 + b, 2, 8, L[2]);
  for (let y = 26; y <= 31; y += 2) { p.px(34, y + b, LN[2]); p.px(35, y + 1 + b, LN[1]); }
  p.line(29, 24 + b, 38, 33 + b, L[1]);
  // belt and pouch
  p.rect(28, 33 + b, 11, 2, L[1]);
  p.rect(28, 33 + b, 11, 1, L[2]);
  p.rect(31, 33 + b, 2, 2, G[2]);
  p.round(36, 34 + b, 4, 5, L[2], 1);
  p.rect(36, 34 + b, 4, 1, L[4]);
  p.px(38, 36 + b, G[2]);

  // neck and linen collar
  p.rect(32, 22 + b, 4, 3, Sk[1]);
  p.rect(31, 23 + b, 6, 2, LN[2]);
  p.px(32, 23 + b, LN[3]);

  // hooded capelet with a dagged edge
  p.poly(shift([[27, 22], [40, 22], [41, 26], [39, 27], [38, 26], [36, 27], [35, 26],
    [33, 27], [32, 26], [30, 27], [29, 26], [27, 27]], b), GR[2]);
  p.rect(28, 22 + b, 12, 1, GR[3]);
  p.px(29, 23 + b, GR[4]);
  p.line(38, 23 + b, 40, 25 + b, GR[1]);

  // face, fringe, hood, braid over the shoulder
  cuteFace(p, P, ['#1e3a1a', '#3a6a2a', '#6a9a3a', '#a8cc6a']);
  cuteBangs(p, P, HA);
  cuteHood(p, P, GR);
  for (let y = 22; y <= 31; y++) {
    p.rect(29, y + (y > 26 ? hb : b), 2, 1, y % 2 === 0 ? HA[3] : HA[2]);
  }
  p.rect(29, 32 + hb, 2, 1, GR[3]);
  p.px(29, 33 + hb, HA[2]);
  p.px(30, 34 + hb, HA[1]);

  // bow arm: linen sleeve, leather bracer, bare hand
  p.round(36, 26 + b, 5, 5, LN[2], 1);
  p.rect(37, 27 + b, 2, 1, LN[3]);
  p.rect(38, 30 + b, 4, 4, L[2]);
  p.rect(38, 30 + b, 4, 1, L[4]);
  p.rect(38, 32 + b, 4, 1, L[1]);
  p.rect(39, 34 + b, 3, 3, Sk[2]);
  p.px(39, 34 + b, Sk[3]);
}
