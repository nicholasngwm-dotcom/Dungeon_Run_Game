// Small math helpers shared across the game.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** Signed shortest difference from angle a to angle b, in [-PI, PI]. */
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Distance from point (px,py) to the segment (x1,y1)-(x2,y2). */
function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}

/** Deterministic random generator so the dungeon looks the same every run. */
function seededRandom(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Removes items flagged `dead` from an array in place. */
function removeDead(arr) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].dead) arr[w++] = arr[i];
  }
  arr.length = w;
}

/** True if segment (ax,ay)-(bx,by) crosses segment (cx,cy)-(dx,dy). */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ---------------------------------------------------------------
//  Randomness. In multiplayer every machine runs the same simulation, so
//  while the simulation steps, Math.random is swapped for a seeded generator
//  shared by everyone (see Session). Purely visual / audio randomness
//  (particles, sounds, screen shake) uses the browser's own generator through
//  vrand, so it can never push the machines out of step.
// ---------------------------------------------------------------
const nativeRandom = Math.random;
const vrand = (min, max) => min + nativeRandom() * (max - min);
const vchoose = (arr) => arr[Math.floor(nativeRandom() * arr.length)];

/** Seeded generator (mulberry32): same seed, same sequence, on every machine. */
function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------
//  Deterministic maths. Browsers don't all compute Math.sin, cos, atan2,
//  exp, pow or hypot identically (the last bit can differ, e.g. Safari vs
//  Chrome), and in lockstep multiplayer those tiny differences snowball into
//  a desync. These versions (the classic fdlibm algorithms) use only + - * /
//  and sqrt, which IEEE-754 makes exact on every machine. Session swaps them
//  in while the shared simulation steps.
// ---------------------------------------------------------------
const DetMath = (() => {
  const PIO2_1 = 1.57079632673412561417e+00;
  const PIO2_1T = 6.07710050650619224932e-11;
  const S = [-1.66666666666666324348e-01, 8.33333333332248946124e-03, -1.98412698298579493134e-04,
    2.75573137070700676789e-06, -2.50507602534068634195e-08, 1.58969099521155010221e-10];
  const C = [4.16666666666666019037e-02, -1.38888888888741095749e-03, 2.48015872894767294178e-05,
    -2.75573143513906633035e-07, 2.08757232129817482790e-09, -1.13596475577881948265e-11];
  const ksin = (r) => { const z = r * r; return r + r * z * (S[0] + z * (S[1] + z * (S[2] + z * (S[3] + z * (S[4] + z * S[5]))))); };
  const kcos = (r) => { const z = r * r; return 1 - 0.5 * z + z * z * (C[0] + z * (C[1] + z * (C[2] + z * (C[3] + z * (C[4] + z * C[5]))))); };
  // x = k * pi/2 + r with |r| <= pi/4
  const reduce = (x) => { const k = Math.round(x * 6.36619772367581382433e-01); return [((k % 4) + 4) % 4, (x - k * PIO2_1) - k * PIO2_1T]; };
  const sin = (x) => {
    if (!Number.isFinite(x)) return NaN;
    const [q, r] = reduce(x);
    return q === 0 ? ksin(r) : q === 1 ? kcos(r) : q === 2 ? -ksin(r) : -kcos(r);
  };
  const cos = (x) => {
    if (!Number.isFinite(x)) return NaN;
    const [q, r] = reduce(x);
    return q === 0 ? kcos(r) : q === 1 ? -ksin(r) : q === 2 ? -kcos(r) : ksin(r);
  };

  const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  const atan = (v) => {
    if (Number.isNaN(v)) return NaN;
    const sign = v < 0 || Object.is(v, -0) ? -1 : 1;
    let x = Math.abs(v);
    if (x >= 7.378697629483821e19) return sign * (ATANHI[3] + ATANLO[3]);
    let id = -1;
    if (x >= 0.4375) {
      if (x < 1.1875) {
        if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); }
      } else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); } else { id = 3; x = -1 / x; }
    }
    const z = x * x;
    const w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    if (id < 0) return sign * (x - x * (s1 + s2));
    return sign * (ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x));
  };
  const PI = 3.14159265358979311600e+00;
  const atan2 = (y, x) => {
    if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
    if (y === 0) return x > 0 || Object.is(x, 0) ? y : (Object.is(y, -0) ? -PI : PI);
    if (x === 0) return y > 0 ? PI / 2 : -PI / 2;
    if (!Number.isFinite(x) && !Number.isFinite(y)) return (x > 0 ? PI / 4 : 3 * PI / 4) * (y > 0 ? 1 : -1);
    const a = atan(y / x);
    if (x > 0) return a;
    return y > 0 ? a + PI : a - PI;
  };

  // 2^k as an exact double (k between -1074 and 1023)
  const bits = new DataView(new ArrayBuffer(8));
  const pow2 = (k) => {
    if (k > 1023) return Infinity;
    if (k < -1022) return pow2(k + 60) * 8.673617379884035e-19;   // * 2^-60
    bits.setUint32(0, (k + 1023) << 20);
    bits.setUint32(4, 0);
    return bits.getFloat64(0);
  };
  const LN2_HI = 6.93147180369123816490e-01;
  const LN2_LO = 1.90821492927058770002e-10;
  const P = [1.66666666666666019037e-01, -2.77777777770155933842e-03, 6.61375632143793436117e-05, -1.65339022054652515390e-06, 4.13813679705723846039e-08];
  const exp = (x) => {
    if (Number.isNaN(x)) return NaN;
    if (x > 709.782712893384) return Infinity;
    if (x < -745.1332191019411) return 0;
    const k = Math.round(x * 1.44269504088896338700e+00);
    const hi = x - k * LN2_HI;
    const lo = k * LN2_LO;
    const r = hi - lo;
    const t = r * r;
    const c = r - t * (P[0] + t * (P[1] + t * (P[2] + t * (P[3] + t * P[4]))));
    const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
    return k < -1000 ? y * pow2(k + 100) * pow2(-100) : y * pow2(k);
  };
  const LG = [6.666666666666735130e-01, 3.999999999940941908e-01, 2.857142874366239149e-01, 2.222219843214978396e-01,
    1.818357216161805012e-01, 1.531383769920937332e-01, 1.479819860511658591e-01];
  const log = (x) => {
    if (Number.isNaN(x) || x < 0) return NaN;
    if (x === 0) return -Infinity;
    if (x === Infinity) return Infinity;
    // x = 2^k * m, with m in [sqrt(2)/2, sqrt(2))
    let k = 0;
    if (x < 2.2250738585072014e-308) { x *= 18014398509481984; k = -54; }   // subnormals: scale by 2^54
    bits.setFloat64(0, x);
    let hx = bits.getUint32(0);
    k += ((hx >>> 20) & 0x7ff) - 1023;
    hx &= 0x000fffff;
    const i = (hx + 0x95f64) & 0x100000;
    bits.setUint32(0, hx | (i ^ 0x3ff00000));
    k += i >>> 20;
    const f = bits.getFloat64(0) - 1;
    const s = f / (2 + f);
    const z = s * s;
    const w = z * z;
    const R = z * (LG[0] + w * (LG[2] + w * (LG[4] + w * LG[6]))) + w * (LG[1] + w * (LG[3] + w * LG[5]));
    const hfsq = 0.5 * f * f;
    return k * LN2_HI - ((hfsq - (s * (hfsq + R) + k * LN2_LO)) - f);
  };
  const pow = (b, e) => {
    if (e === 0) return 1;
    if (Number.isNaN(b) || Number.isNaN(e)) return NaN;
    if (Number.isInteger(e) && Math.abs(e) <= 1024) {
      // exact repeated squaring for whole powers
      let result = 1;
      let base = b;
      let n = Math.abs(e);
      while (n > 0) {
        if (n & 1) result *= base;
        base *= base;
        n = Math.floor(n / 2);
      }
      return e < 0 ? 1 / result : result;
    }
    if (b === 0) return e > 0 ? 0 : Infinity;
    if (b < 0) return NaN;
    return exp(e * log(b));
  };
  const hypot = (...v) => {
    let s = 0;
    for (const x of v) s += x * x;
    return Math.sqrt(s);
  };
  return { sin, cos, atan, atan2, exp, log, pow, hypot };
})();

/** The browser's own versions, restored after a deterministic step. */
const NativeMath = { sin: Math.sin, cos: Math.cos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, pow: Math.pow, hypot: Math.hypot };

/** Player-typed text (names) made safe to put into HTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
