// Knight: a stout young knight in a closed great helm (eyes glinting through
// the slit), red plume and cape, steel plate, red tabard with a gold cross
// and a red heater shield strapped high on his off arm. The greatblade is drawn separately.

function drawKnight(p, P) {
  const { b, hb, s } = P;
  const S = RAMP.steel;
  const R = RAMP.red;
  const G = CUTE.brass;
  const L = RAMP.leather;
  const f = P.cf;

  // red cape
  p.poly([[27, 23 + b], [34, 23 + b], [32, 34 + b], [31, 48], [27, 51], [22 + f, 52],
    [17 + f, 49], [19, 38 + b], [23, 28 + b]], R[2]);
  p.line(24, 27 + b, 19 + f, 48, R[3]);
  p.line(28, 30 + b, 25 + f, 50, R[1]);
  p.line(30, 33 + b, 29, 48, R[1]);

  // sturdy plate greaves (wider than the other heroes' legs) with knee cops and sabatons
  const xb = cuteLeg(p, 28, 28 - s, P.lb, [S[0], S[1], S[2]], [S[0], S[1], S[2]], 55, null, 4);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, [S[1], S[3], S[4]], [S[1], S[2], S[4]], 55, null, 4);
  for (const [xAt, c, hi] of [[xb, S[2], S[3]], [xf, S[3], S[5]]]) {
    const kx = xAt(49);
    p.round(kx - 1, 48, 6, 3, c, 1);
    p.px(kx, 48, hi);
    p.px(kx + 1, 48, hi);
  }

  // faulds (hip plates) and the red tabard panel
  const hem = Math.round(s / 2);
  p.poly([[28, 33 + b], [39, 33 + b], [42 + hem, 44 + b], [25 + hem, 44 + b]], S[2]);
  p.poly([[28, 33 + b], [31, 33 + b], [28 + hem, 44 + b], [25 + hem, 44 + b]], S[3]);
  for (const y of [37, 40, 43]) {
    const t = (y - 33) / 11;
    p.line(28 - 3 * t + hem * t, y + b, 39 + 3 * t + hem * t, y + b, S[1]);
    p.line(28 - 3 * t + hem * t, y - 1 + b, 31 + hem * t, y - 1 + b, S[4]);
  }
  const h2 = Math.round(hem / 2);
  p.poly([[31, 34 + b], [37, 34 + b], [38 + hem, 46 + b], [30 + hem, 46 + b]], R[2]);
  p.line(31, 35 + b, 30 + hem, 45 + b, R[3]);
  p.rect(30 + hem, 45 + b, 9, 1, G[2]);
  p.rect(33 + h2, 38 + b, 1, 5, G[3]);
  p.rect(32 + h2, 39 + b, 3, 1, G[3]);

  // broad breastplate with a centre ridge
  p.round(28, 24 + b, 12, 11, S[3], 2);
  p.rect(29, 25 + b, 3, 6, S[4]);
  p.px(29, 25 + b, S[5]);
  p.rect(38, 26 + b, 2, 7, S[1]);
  p.rect(34, 25 + b, 1, 8, S[5]);
  p.rect(35, 25 + b, 1, 8, S[1]);
  // belt
  p.rect(28, 33 + b, 12, 2, L[2]);
  p.rect(28, 33 + b, 12, 1, L[3]);
  p.rect(33, 33 + b, 2, 2, G[2]);
  p.px(33, 33 + b, G[3]);
  // gorget
  p.round(29, 21 + b, 10, 4, S[2], 1);
  p.rect(30, 21 + b, 8, 1, S[4]);

  // red plume streaming back from a gold holder
  const hs = P.hs;
  p.poly([[34, 7 + b], [33, 4 + b], [29, 2 + b], [24, 3 + b], [19 + hs, 6 + hb],
    [15 + hs, 11 + hb], [18 + hs, 11 + hb], [23, 8 + b], [29, 7 + b]], R[2]);
  p.line(32, 4 + b, 20 + hs, 7 + hb, R[4]);
  p.line(29, 6 + b, 17 + hs, 10 + hb, R[1]);
  p.line(31, 3 + b, 26, 3 + b, R[3]);

  // great helm: round bucket, eye slit, nose ridge, breathing holes
  p.round(28, 8 + b, 13, 15, S[3], 4);
  p.rect(29, 10 + b, 3, 10, S[4]);
  p.rect(30, 9 + b, 4, 1, S[5]);
  p.rect(29, 11 + b, 1, 5, S[5]);
  p.rect(38, 10 + b, 2, 11, S[1]);
  p.rect(29, 21 + b, 11, 1, S[1]);
  p.rect(29, 14 + b, 11, 1, S[4]);                  // brow band
  p.rect(31, 15 + b, 9, 2, '#0b0a10');              // eye slit
  if (P.eyes !== 'blink') {
    p.px(33, 15 + b, '#9ad0ff');                    // eyes glinting in the dark
    p.px(37, 15 + b, '#9ad0ff');
  }
  p.rect(35, 9 + b, 1, 5, S[5]);                    // nose ridge
  p.rect(35, 17 + b, 1, 4, S[4]);
  for (const [x, y] of [[37, 18], [37, 20], [39, 18], [33, 18], [33, 20]]) p.px(x, y + b, S[0]);
  p.px(30, 14 + b, G[3]);                           // gold rivets
  p.px(39, 14 + b, G[2]);
  p.rect(33, 6 + b, 3, 2, G[2]);                    // plume holder
  p.px(33, 6 + b, G[3]);

  // heater shield strapped high on the off arm, tucked against his side:
  // steel rim, red field, gold cross with a ruby boss
  const o = P.ba;
  const sh = (pts) => shiftXY(pts, o, b);
  p.poly(sh([[17, 24], [29, 24], [29, 31], [27, 36], [23, 40], [19, 36], [17, 31]]), S[3]);
  p.poly(sh([[18, 25], [28, 25], [28, 31], [26, 35], [23, 38], [20, 35], [18, 31]]), R[2]);
  p.poly(sh([[23, 25], [28, 25], [28, 31], [26, 35], [23, 38]]), R[1]);
  p.rect(18 + o, 26 + b, 1, 6, R[3]);                // lit left edge of the field
  p.rect(17 + o, 24 + b, 9, 1, S[5]);                // rim catching the light
  p.rect(17 + o, 25 + b, 1, 6, S[4]);
  p.rect(29 + o, 25 + b, 1, 6, S[1]);                // rim in shadow
  p.rect(22 + o, 26 + b, 2, 11, G[2]);               // gold cross
  p.rect(22 + o, 26 + b, 1, 11, G[3]);
  p.rect(19 + o, 29 + b, 8, 2, G[2]);
  p.rect(19 + o, 29 + b, 8, 1, G[3]);
  p.rect(22 + o, 29 + b, 2, 2, '#d0303a');
  p.px(22 + o, 29 + b, '#ff9a8a');

  // sword arm: big rounded pauldron, vambrace, gauntlet
  p.round(35, 22 + b, 9, 7, S[3], 2);
  p.rect(36, 23 + b, 5, 1, S[5]);
  p.rect(36, 24 + b, 2, 2, S[4]);
  p.rect(35, 28 + b, 9, 1, S[1]);
  p.rect(38, 29 + b, 4, 2, S[2]);
  p.rect(38, 31 + b, 4, 3, S[3]);
  p.rect(38, 31 + b, 1, 3, S[5]);
  p.round(38, 34 + b, 4, 3, S[1], 1);
  p.rect(39, 34 + b, 2, 1, S[3]);
}
