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

/** Player-typed text (names) made safe to put into HTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
