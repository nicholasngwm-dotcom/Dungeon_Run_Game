// Priestess: white robe with a gold hem, blue tabard with a gold cross,
// auburn hair under a white veil, a gold circlet with a blue gem and a
// floating halo. Her sun scepter is drawn separately.

function drawPriestess(p, P) {
  const { b, hb, s } = P;
  const WR = ['#6e6878', '#a39cad', '#d2ccd8', '#efebf2', '#ffffff'];   // white robe
  const BL = ['#1e2a5a', '#2e4490', '#4a6ad0', '#8aa8ff'];              // blue tabard
  const HP = ['#4a2a14', '#7a4a22', '#a86e36', '#d09a54'];              // auburn hair
  const GO = ['#5a3c10', '#a07a24', '#dcb44c', '#fbe796'];              // bright holy gold
  const L = RAMP.leather;
  const Sk = RAMP.skin;
  const sw = P.sw;

  // veil trailing down the back
  p.poly([[25, 12 + b], [31, 12 + b], [31, 30 + b], [28 + sw, 42 + hb], [21 + sw, 44 + hb], [22, 28 + b]], WR[2]);
  p.line(24, 16 + b, 22 + sw, 42 + hb, WR[1]);
  p.line(27, 16 + b, 26 + sw, 41 + hb, WR[3]);

  // back sleeve
  p.poly([[28, 24 + b], [31, 25 + b], [30 + P.ba, 33 + b], [25 + P.ba, 34 + b]], WR[1]);

  // sandals peeking out under the robe
  for (const [x, lift, c] of [[28 - s, P.lb, L[2]], [33 + s, P.lf, L[3]]]) {
    p.rect(x, 55 - lift, 4, 3, c);
    p.rect(x + 1, 57 - lift, 5, 2, c);
    p.rect(x + 1, 57 - lift, 4, 1, GO[1]);
  }

  // white robe flaring to a gold hem
  const hem = Math.round(s / 2);
  p.poly([...shift([[28, 24], [38, 24], [39, 34]], b), [42 + hem, 56], [23 + hem, 56], ...shift([[27, 34]], b)], WR[3]);
  p.poly([...shift([[28, 24], [31, 24]], b), [27 + hem, 56], [23 + hem, 56], ...shift([[27, 34]], b)], WR[4]);
  p.poly([...shift([[37, 30], [39, 34]], b), [42 + hem, 56], [38 + hem, 56]], WR[1]);
  p.rect(23 + hem, 55, 20, 1, GO[2]);
  p.rect(23 + hem, 56, 20, 1, GO[1]);
  for (let x = 24; x <= 42; x += 2) p.px(x + hem, 57, WR[2]);

  // blue tabard with a gold cross
  p.poly([...shift([[32, 26], [37, 26], [37, 34]], b), [38 + hem, 54], [32 + hem, 54], ...shift([[32, 34]], b)], BL[2]);
  p.line(33, 27 + b, 33 + hem, 53, BL[3]);
  p.line(37, 34 + b, 38 + hem, 53, BL[1]);
  p.rect(35 + hem, 41, 1, 7, GO[3]);
  p.rect(33 + hem, 43, 5, 1, GO[3]);
  p.px(35 + hem, 43, '#ffffff');

  // gold belt
  p.rect(28, 33 + b, 11, 2, GO[1]);
  p.rect(28, 33 + b, 11, 1, GO[2]);
  p.rect(33, 33 + b, 2, 2, GO[3]);

  // mantle with gold edging and a blue clasp
  p.poly(shift([[26, 22], [40, 22], [41, 26], [37, 27], [33, 25], [29, 27], [26, 26]], b), WR[3]);
  p.rect(27, 22 + b, 12, 1, WR[4]);
  p.line(26, 26 + b, 29, 27 + b, GO[2]);
  p.line(37, 27 + b, 41, 26 + b, GO[2]);
  p.line(33, 25 + b, 37, 27 + b, GO[1]);
  p.rect(33, 23 + b, 2, 2, BL[2]);
  p.px(33, 23 + b, BL[3]);

  // auburn hair behind, face, fringe, side lock
  p.rect(27, 13 + b, 4, 11, HP[1]);
  cuteFace(p, P, BL);
  cuteBangs(p, P, HP);
  p.poly([[39, 14 + b], [41, 14 + b], [41, 21 + b], [40, 23 + hb], [39, 20 + b]], HP[2]);
  p.px(39, 14 + b, HP[3]);

  // white veil over the head, gold circlet with a blue gem
  cuteHood(p, P, [WR[1], WR[1], WR[3], WR[4], WR[4]]);
  p.line(27, 14 + b, 27, 22 + b, WR[2]);
  p.rect(31, 11 + b, 9, 1, GO[2]);
  p.px(35, 11 + b, '#6ad8ff');
  p.px(35, 10 + b, GO[3]);

  // floating halo, a beat behind the body
  const hy = 3 + hb;
  p.rect(29, hy, 10, 1, GO[3]);
  p.px(28, hy + 1, GO[2]);
  p.px(39, hy + 1, GO[2]);
  p.rect(29, hy + 2, 10, 1, GO[1]);

  // casting arm: wide white sleeve, gold cuff, hand
  p.poly(shift([[36, 23], [40, 22], [43, 29], [44, 35], [39, 36], [37, 30]], b), WR[3]);
  p.poly(shift([[40, 30], [44, 35], [39, 36]], b), WR[1]);
  p.line(37, 23 + b, 39, 32 + b, WR[4]);
  p.rect(39, 33 + b, 6, 2, GO[2]);
  p.rect(40, 35 + b, 3, 2, Sk[2]);
}

/** Soft gold light around the halo. */
function priestessHaloGlow(p, P) {
  cuteGlow(p, 33.5, 4 + P.hb, 8, 3.2, '251, 231, 150', 0.45);
}
