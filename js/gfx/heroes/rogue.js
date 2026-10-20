// Rogue: a lean young thief with a dark hood, red mask and fluttering red
// scarf, sharp amber eyes, a strapped leather jerkin, dark trousers and
// wrapped boots, a spare dagger at his hip. The thrown dagger is drawn separately.

function drawRogue(p, P) {
  const { b, hb, s } = P;
  const D = ['#121218', '#1e1e28', '#2c2c3a', '#3e3e52', '#56566e'];    // charcoal
  const RS = ['#3a0c14', '#6a1622', '#9a2230', '#c43a44'];              // red scarf
  const LR = ['#1e1410', '#33221a', '#4c3426', '#6a4a34', '#86603f'];   // dark leather
  const HD = ['#141018', '#241c2c', '#3a2e44', '#54465e'];              // ink-black hair
  const S = RAMP.steel;
  const Sk = RAMP.skin;
  const f = P.cf;

  // scarf tails fluttering behind
  p.poly([[29, 21 + b], [23, 20 + b + f], [17, 22 + hb + f], [11 + f, 20 + hb + f], [13 + f, 24 + hb],
    [19, 25 + b], [28, 25 + b]], RS[2]);
  p.line(27, 23 + b, 14 + f, 22 + hb, RS[1]);
  p.line(26, 21 + b, 18, 21 + b + f, RS[3]);
  p.poly([[28, 24 + b], [23, 27 + b], [18 + f, 31 + hb], [16 + f, 30 + hb], [21, 25 + b]], RS[1]);

  // back arm
  const ba = P.ba;
  p.poly([[28, 24 + b], [31, 25 + b], [30 + ba, 32 + b], [26 + ba, 33 + b]], D[1]);

  // dark trousers, boots with leather wraps
  const xb = cuteLeg(p, 29, 29 - s, P.lb, [D[0], D[1], D[2]], [LR[0], LR[1], LR[2]], 51);
  const xf = cuteLeg(p, 34, 34 + s, P.lf, [D[1], D[2], D[3]], [LR[1], LR[2], LR[3]], 51);
  for (const [xAt, lift, c] of [[xb, P.lb, LR[0]], [xf, P.lf, LR[1]]]) {
    p.rect(xAt(52 - lift), 52 - lift, 3, 1, c);
    p.rect(xAt(54 - lift), 54 - lift, 3, 1, c);
  }

  // leather hip flaps
  const hem = Math.round(s / 2);
  p.poly([[28, 34 + b], [39, 34 + b], [41 + hem, 42 + b], [26 + hem, 42 + b]], LR[1]);
  p.poly([[28, 34 + b], [31, 34 + b], [28 + hem, 42 + b], [26 + hem, 42 + b]], LR[2]);
  p.line(33, 35 + b, 33 + hem, 41 + b, LR[0]);

  // broad jerkin with a crossing strap
  p.round(28, 24 + b, 12, 11, LR[2], 1);
  p.rect(28, 25 + b, 3, 8, LR[3]);
  p.px(29, 25 + b, LR[4]);
  p.rect(38, 26 + b, 2, 8, LR[1]);
  p.line(29, 25 + b, 38, 33 + b, D[1]);
  p.line(30, 25 + b, 39, 33 + b, D[2]);
  p.px(34, 29 + b, S[4]);
  // belt and the spare dagger at the hip
  p.rect(28, 33 + b, 12, 2, D[1]);
  p.rect(28, 33 + b, 12, 1, D[3]);
  p.rect(31, 33 + b, 2, 2, S[4]);
  p.line(28, 35 + b, 26, 40 + b, LR[0]);
  p.rect(27, 34 + b, 3, 1, S[3]);
  p.px(25, 41 + b, S[4]);

  // wide shoulder mantle
  p.poly(shift([[25, 22], [41, 22], [42, 26], [37, 28], [33, 25], [29, 28], [25, 26]], b), D[2]);
  p.rect(26, 22 + b, 14, 1, D[3]);
  p.rect(26, 23 + b, 3, 2, D[3]);

  // face with sharp amber eyes, red mask over nose and mouth
  cuteFace(p, P, ['#6a3a08', '#c07a10', '#f0b030', '#fff2b0'], { mask: true, male: true });
  p.rect(29, 21 + b, 12, 3, RS[2]);
  p.rect(29, 21 + b, 12, 1, RS[3]);
  p.line(31, 23 + b, 39, 23 + b, RS[1]);
  // short messy fringe
  p.rect(29, 12 + b, 11, 3, HD[2]);
  p.rect(30, 12 + b, 8, 1, HD[3]);
  for (const [x, len] of [[29, 3], [30, 1], [32, 2], [34, 1], [36, 2], [38, 1], [39, 3]]) p.rect(x, 15 + b, 1, len, HD[2]);
  cuteHood(p, P, D);
  // hood point at the back
  p.poly(shift([[27, 13], [24, 11], [22, 13], [24, 15], [27, 17]], b), D[2]);

  // dagger arm: sleeve, strapped bracer, hand
  p.round(36, 26 + b, 5, 5, D[2], 1);
  p.rect(37, 27 + b, 2, 1, D[3]);
  p.rect(38, 30 + b, 4, 4, LR[2]);
  p.rect(38, 31 + b, 4, 1, LR[0]);
  p.rect(38, 33 + b, 4, 1, LR[0]);
  p.rect(39, 34 + b, 3, 3, Sk[1]);
  p.px(39, 34 + b, Sk[2]);
}

/** A faint glint in the eyes under the hood. */
function rogueEyeGlint(p, P) {
  if (P.eyes === 'blink') return;
  const ctx = p.ctx;
  ctx.fillStyle = 'rgba(255, 242, 176, 0.55)';
  ctx.fillRect(32, 19 + P.b, 1, 1);
  ctx.fillRect(38, 19 + P.b, 1, 1);
}
