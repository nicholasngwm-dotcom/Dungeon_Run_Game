// Castle dungeon sprites: the court's bodies (js/gfx/enemies/castle.js) built into
// frames, the cavalry's horse and the catapult (their own shapes), the weapons the
// enemies hold at runtime, their projectiles, and the castle's cover.

const CAVALRY_ANCHOR = { x: 48, y: 70 };     // 96x80 horse and rider
const CATAPULT_ANCHOR = { x: 40, y: 58 };    // 80x64 siege engine
const EXEC_ANCHOR = { x: 40, y: 66 };        // 80x80 executioner

function buildCastleSprites() {
  Object.assign(Sprites.enemies, {
    squire: buildCuteEnemy(drawSquire),
    castleArcher: buildCuteEnemy(drawCastleArcher),
    minstrel: buildCuteEnemy(drawMinstrel),
    gunner: buildCuteEnemy(drawGunner),
    maceSpinner: buildCuteEnemy(drawMaceSpinner),
    bishop: buildCuteEnemy(drawBishop),
    castleKnight: buildCuteEnemy(drawCastleKnight),
    royalGuard: buildCuteEnemy(drawRoyalGuard),
    castleSorcerer: buildCuteEnemy(drawCastleSorcerer),
    jester: buildCuteEnemy(drawJester),
    executioner: buildCuteEnemy(drawExecutioner, 80),
    prince: buildCuteEnemy(drawPrince),
    princess: buildCuteEnemy(drawPrincess),
    gardener: buildCuteEnemy(drawGardener),
    cavalry: buildCavalryFrames(),
    catapult: buildCatapultFrames(false),
    flamingCatapult: buildCatapultFrames(true),
    clusterCatapult: buildCatapultFrames(true, true),
    general: buildCuteEnemy(drawGeneral),
    princeGuard: buildCuteEnemy(drawPrinceGuard),
  });
  // the Prince's white charger, which he rides in on (no rider: he's drawn in the saddle)
  Sprites.royalHorse = buildCavalryFrames({ coat: 'white', rider: false });
  buildCastleWeapons();
  buildCastleProjectiles();
  buildCastleCover();
}

// ---------- cavalry ----------

/**
 * A corrupted warhorse in a crimson caparison with a knight in blackened plate.
 * pose: { legs: [backFar, backNear, frontFar, frontNear] leg swing (-1..1), b: body bob, tail, head }
 */
function drawCavalry(p, pose) {
  const S = CK.steel;
  const C = CK.crimson;
  const G = CK.gold;
  // black coat (the cavalry), or the Prince's white charger (pose.coat 'white')
  const H = pose.coat === 'white' ? ['#6a6478', '#a8a2b4', '#cfcadc', '#ece8f4', '#ffffff'] : ['#0c0a10', '#1a1620', '#2a2432', '#3c3446', '#544a60'];
  const b = pose.b;
  const hipY = 46 + b;
  // a leg: from the body down to the hoof, bent by `k` (-1 back .. 1 forward)
  const leg = (x, k, near, front) => {
    const R = near ? H : [H[0], H[0], H[1], H[2], H[3]];
    const kneeX = x + k * 4 + (front ? 2 : -2);
    const kneeY = hipY + 10;
    const footX = x + k * 9;
    const footY = 70 - Math.max(0, -k * 3 * (front ? 0 : 1)) - (Math.abs(k) > 0.6 ? 2 : 0);
    p.line(x, hipY, kneeX, kneeY, R[2], 4);
    p.line(kneeX, kneeY, footX, footY - 2, R[2], 3);
    p.line(x - 1, hipY, kneeX - 1, kneeY, R[3], 1);
    p.rect(footX - 2, footY - 3, 5, 2, '#d8d0c0');                 // feathering at the fetlock
    p.rect(footX - 2, footY - 1, 6, 2, '#141018');                  // hoof
  };
  const [bf, bn, ff, fn] = pose.legs;
  leg(30, bf, false, false);
  leg(60, ff, false, true);
  // tail streaming back
  const t = pose.tail;
  p.poly([[24, 36 + b], [16, 40 + b + t], [10, 50 + t], [14, 51 + t], [20, 44 + b], [26, 40 + b]], H[1]);
  p.line(22, 38 + b, 13, 49 + t, H[3]);
  // body
  p.ellipse(44, 40 + b, 22, 10, H[2]);
  p.ellipse(42, 37 + b, 18, 6, H[3]);
  // neck and head reaching forward
  const hd = pose.head;
  p.poly([[58, 34 + b], [66, 20 + b + hd], [72, 18 + b + hd], [74, 24 + b + hd], [66, 38 + b], [60, 42 + b]], H[2]);
  p.poly([[66, 18 + b + hd], [80, 24 + b + hd], [82, 29 + b + hd], [77, 31 + b + hd], [68, 27 + b + hd]], H[2]);   // muzzle
  p.line(67, 19 + b + hd, 79, 24 + b + hd, H[4]);
  p.poly([[66, 18 + b + hd], [65, 12 + b + hd], [69, 16 + b + hd]], H[2]);   // ear
  // a steel chanfron over the face, a violet eye glowing through
  p.poly([[67, 19 + b + hd], [78, 24 + b + hd], [77, 27 + b + hd], [68, 24 + b + hd]], S[3]);
  p.line(68, 20 + b + hd, 77, 24 + b + hd, S[5]);
  p.rect(70, 21 + b + hd, 2, 2, '#140c18');
  p.px(71, 21 + b + hd, '#e8e0d8');   // an eye in the chanfron's hole
  p.px(81, 28 + b + hd, '#08060c');   // nostril
  // mane
  for (let i = 0; i < 5; i++) p.rect(58 + i * 2, 33 - i * 3 + b + hd * (i / 5), 3, 4, H[0]);
  // the caparison: crimson cloth draped over the body with a gold hem and a crest
  p.poly([[24, 32 + b], [62, 32 + b], [64, 48 + b], [58, 52 + b], [50, 50 + b], [42, 53 + b], [34, 50 + b], [26, 52 + b], [22, 46 + b]], C[2]);
  p.poly([[24, 32 + b], [62, 32 + b], [62, 35 + b], [24, 35 + b]], C[3]);
  for (const [x0, x1] of [[22, 34], [34, 50], [50, 64]]) p.line(x0, 50 + b, x1, 50 + b, G[2]);
  p.round(38, 38 + b, 8, 8, G[1], 2);
  p.rect(40, 40 + b, 4, 4, C[1]);
  p.px(41, 41 + b, G[3]);
  leg(34, bn, true, false);
  leg(56, fn, true, true);
  if (pose.rider === false) return;   // the Prince's horse: he's drawn in the saddle himself
  // the rider: plate legs down the side, a torso, a visored helm with a crimson plume
  p.rect(43, 34 + b, 5, 12, S[2]);
  p.rect(43, 34 + b, 1, 12, S[4]);
  p.rect(43, 45 + b, 6, 3, S[1]);
  p.round(38, 14 + b, 14, 15, S[3], 3);
  p.rect(39, 15 + b, 3, 12, S[4]);
  p.rect(49, 16 + b, 3, 12, S[1]);
  p.rect(44, 16 + b, 1, 11, S[5]);
  p.rect(40, 26 + b, 12, 2, RAMP.leather[2]);
  p.poly([[38, 18 + b], [33, 24 + b], [31, 30 + b], [36, 30 + b], [40, 24 + b]], C[2]);   // half cape
  p.round(40, 2 + b, 12, 13, S[3], 4);
  p.rect(41, 4 + b, 3, 8, S[4]);
  p.poly([[43, 8 + b], [54, 10 + b], [50, 14 + b], [43, 14 + b]], S[3]);
  p.rect(44, 9 + b, 7, 1, '#0b0a10');
  p.px(46, 9 + b, CK.eye);
  p.px(49, 9 + b, CK.eye);
  p.poly([[46, 2 + b], [40, -1 + b], [33, 0 + b], [28 + t, 4 + b], [34, 4 + b], [41, 4 + b]], C[2]);
  p.line(44, 1 + b, 31 + t, 3 + b, C[4]);
  // the lance arm
  p.round(48, 16 + b, 8, 7, S[3], 2);
  p.rect(50, 22 + b, 4, 5, S[2]);
}

/** opts.coat 'white' + opts.rider false: the Prince's riderless white charger. */
function buildCavalryFrames(opts = {}) {
  // a four-beat gallop: [backFar, backNear, frontFar, frontNear]
  const gallop = [
    { legs: [-0.9, -0.5, 0.7, 1], b: 0, tail: 0, head: 0 },
    { legs: [-0.2, 0.2, 0.1, 0.4], b: -2, tail: -2, head: -1 },
    { legs: [0.6, 0.9, -0.6, -0.3], b: -1, tail: -1, head: 1 },
    { legs: [0.2, -0.1, -0.1, 0.3], b: 1, tail: 1, head: 2 },
  ];
  const idle = [
    { legs: [-0.15, 0.1, 0.15, -0.1], b: 0, tail: 0, head: 0 },
    { legs: [-0.15, 0.1, 0.15, -0.1], b: 1, tail: 2, head: 1 },
  ];
  const dress = (list) => list.map((pose) => ({ ...pose, ...opts }));
  return buildPoseFrames(drawCavalry, 96, { idle: dress(idle), walk: dress(gallop) }, 0.5);
}

// ---------- catapult ----------

/**
 * The engine (the throwing arm is drawn at runtime, see Catapult.draw). flame: the burning
 * variant; cluster: the stage-3 volley engine (iron-plated, a second windlass, shot piled ready).
 */
function drawCatapultBase(p, flame, cluster = false) {
  const W = flame ? ['#1a100c', '#2e1c12', '#46301e', '#5e432a', '#7a5a38'] : ['#22150e', '#3b2416', '#5b3922', '#7d532f', '#9c6c3e'];
  const I = CK.steel;
  // the base frame: two long rails with cross beams
  p.rect(8, 44, 62, 6, W[2]);
  p.rect(8, 44, 62, 1, W[4]);
  p.rect(8, 49, 62, 1, W[0]);
  for (const x of [12, 40, 62]) { p.rect(x, 42, 4, 10, W[1]); p.rect(x, 42, 1, 10, W[3]); }
  // the A-frame uprights holding the axle
  for (const [x0, x1] of [[22, 34], [46, 34]]) p.line(x0, 46, x1, 18, W[2], 4);
  p.line(21, 46, 33, 18, W[3], 1);
  p.round(30, 14, 9, 9, I[2], 3);   // axle hub
  p.round(32, 16, 5, 5, I[3], 2);
  p.px(33, 17, I[5]);
  // the windlass drum at the back with its crank
  p.round(54, 34, 12, 12, W[2], 4);
  p.rect(55, 35, 2, 10, W[4]);
  for (let i = 0; i < 4; i++) p.rect(56, 36 + i * 2, 8, 1, '#a89878');   // rope wound on it
  // iron bands and rivets
  for (const x of [10, 30, 50, 68]) { p.rect(x, 44, 2, 6, I[3]); p.px(x, 45, I[5]); }
  // wheels
  for (const cx of [18, 60]) {
    p.circle(cx, 52, 8, W[1]);
    p.circle(cx, 52, 6, W[2]);
    p.line(cx - 6, 52, cx + 6, 52, W[0]);
    p.line(cx, 46, cx, 58, W[0]);
    p.circle(cx, 52, 2, I[3]);
    p.px(cx - 1, 51, I[5]);
    for (let a = 0; a < 8; a++) p.px(Math.round(cx + Math.cos(a * 0.785) * 7), Math.round(52 + Math.sin(a * 0.785) * 7), I[2]);
  }
  if (flame) {
    // a brazier hung on the front to light the shot, and soot on the timbers
    p.rect(2, 30, 10, 3, I[2]);
    p.rect(3, 33, 8, 6, I[1]);
    p.rect(3, 33, 8, 1, I[3]);
    p.rect(5, 39, 4, 6, I[1]);
    p.rect(4, 28, 6, 2, '#ff8a1e');
    p.px(6, 27, '#ffd34a');
    for (let i = 0; i < 6; i++) p.px(14 + i * 9, 45 + (i % 2), '#0e0808');
  }
  if (cluster) {
    // iron plates over the rails, a second windlass for the heavier throw, and a pile of shot ready on the frame
    for (const x of [16, 34, 52]) { p.rect(x, 44, 8, 6, I[2]); p.rect(x, 44, 8, 1, I[4]); p.px(x + 1, 46, I[5]); p.px(x + 6, 46, I[5]); }
    p.round(62, 26, 10, 10, W[2], 3);
    for (let i = 0; i < 3; i++) p.rect(63, 28 + i * 2, 8, 1, '#a89878');
    for (const [bx, by] of [[44, 38], [49, 38], [46, 34]]) { p.circle(bx, by, 3, '#4a4652'); p.px(bx - 1, by - 1, '#8e8a9c'); }
  }
}

/** The throwing arm (pointing right from its pivot at the axle): a long beam with the bucket at its end. */
function drawCatapultArm(p, flame, cluster = false) {
  const W = flame ? ['#1a100c', '#2e1c12', '#46301e', '#5e432a', '#7a5a38'] : ['#22150e', '#3b2416', '#5b3922', '#7d532f', '#9c6c3e'];
  p.rect(2, 5, 40, 5, W[2]);
  p.rect(2, 5, 40, 1, W[4]);
  p.rect(2, 9, 40, 1, W[0]);
  for (const x of [12, 26]) { p.rect(x, 4, 2, 7, CK.steel[3]); p.px(x, 5, CK.steel[5]); }
  if (cluster) {
    // a wide iron-hooped basket that holds a whole volley of shot
    p.round(36, 0, 22, 12, W[1], 4);
    p.round(38, 2, 18, 6, '#120a08', 3);
    p.rect(36, 9, 22, 2, CK.steel[2]);
    p.rect(36, 9, 22, 1, CK.steel[4]);
    for (const x of [41, 47, 53]) p.rect(x, 0, 1, 10, CK.steel[3]);
    return;
  }
  // the bucket: an iron-bound wooden cup
  p.round(38, 0, 14, 12, W[1], 4);
  p.round(40, 2, 10, 6, '#120a08', 3);
  p.rect(38, 9, 14, 2, CK.steel[2]);
  p.rect(38, 9, 14, 1, CK.steel[4]);
}

function buildCatapultFrames(flame, cluster = false) {
  const make = (w, h, fn) => {
    const img = PixelArt.make(w, h, fn, OUTLINE, 0.5);
    return { img, flash: PixelArt.silhouette(img) };
  };
  const base = make(80, 64, (p) => drawCatapultBase(p, flame, cluster));
  const arm = make(cluster ? 60 : 54, 14, (p) => drawCatapultArm(p, flame, cluster));
  return { idle: [base], base, arm, armPivot: { x: 5, y: 7 } };
}

// ---------- weapons (drawn at runtime by the enemies) ----------

function buildCastleWeapons() {
  const S = RAMP.steel;
  const L = RAMP.leather;
  const G = CK.gold;
  const weapon = (w, h, pivotX, pivotY, fn) => ({ img: PixelArt.make(w, h, fn, OUTLINE, 0.5), pivotX, pivotY });
  Object.assign(Sprites.weapons, {
    // a long matchlock: walnut stock, a long iron barrel, the glowing match on its serpentine
    musket: weapon(46, 10, 8, 5, (p) => {
      p.poly([[0, 4], [10, 3], [16, 4], [16, 7], [10, 7], [1, 9]], L[3]);
      p.line(1, 5, 14, 4, L[4]);
      p.rect(14, 3, 30, 3, CK.steel[2]);
      p.rect(14, 3, 30, 1, CK.steel[4]);
      p.rect(42, 2, 3, 5, CK.steel[3]);
      p.rect(18, 6, 2, 3, CK.steel[3]);   // the trigger
      p.px(12, 1, '#ff8a3a');            // the slow match
      p.px(12, 2, '#5a3a2a');
    }),
    // a heavy steel crossbow with a violet-lacquered stock
    crossbow: weapon(30, 22, 6, 11, (p) => {
      p.rect(0, 9, 22, 4, CK.violet[2]);
      p.rect(0, 9, 22, 1, CK.violet[4]);
      p.rect(20, 1, 3, 20, CK.steel[3]);
      p.line(20, 1, 26, 5, CK.steel[3], 2);
      p.line(20, 20, 26, 16, CK.steel[3], 2);
      p.line(26, 5, 26, 16, '#d8d0c0');   // the string
      p.rect(22, 10, 7, 2, CK.steel[4]);
      p.rect(9, 12, 2, 4, CK.steel[2]);
      p.px(4, 10, G[3]);
    }),
    // a spiked iron mace on a short haft
    mace: weapon(26, 14, 3, 7, (p) => {
      p.rect(0, 6, 15, 3, L[2]);
      p.rect(0, 6, 15, 1, L[3]);
      p.circle(19, 7, 5, CK.steel[2]);
      p.circle(18, 6, 3, CK.steel[4]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        p.line(19 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 19 + Math.cos(a) * 7, 7 + Math.sin(a) * 7, CK.steel[3]);
      }
    }),
    // the executioner's axe: a long haft and a huge crescent blade, stained
    axe: weapon(62, 34, 6, 22, (p) => {
      p.rect(0, 20, 50, 4, L[2]);
      p.rect(0, 20, 50, 1, L[4]);
      for (const x of [8, 14]) p.rect(x, 19, 2, 6, L[0]);
      p.rect(46, 18, 6, 8, CK.steel[2]);
      for (let y = 1; y <= 33; y++) {
        const t = (y - 17) / 16;
        const w = Math.round(12 * Math.sqrt(Math.max(0, 1 - t * t)));
        if (w <= 0) continue;
        p.rect(48, y, w + 2, 1, CK.steel[3]);
        p.px(49 + w, y, CK.steel[5]);
        p.px(48, y, CK.steel[1]);
      }
      p.rect(52, 6, 3, 4, '#5a1420');
      p.rect(55, 23, 3, 3, '#5a1420');
    }),
    // a long cavalry lance with a crimson pennon
    lance: weapon(84, 12, 14, 6, (p) => {
      p.rect(0, 5, 72, 3, L[3]);
      p.rect(0, 5, 72, 1, L[4]);
      p.poly([[10, 2], [20, 3], [20, 9], [10, 10]], CK.steel[3]);   // vamplate
      p.poly([[72, 3], [84, 6.5], [72, 10]], CK.steel[4]);
      p.line(72, 6, 83, 6, CK.steel[5]);
      p.poly([[60, 5], [70, 5], [66, 1], [56, 0]], CK.crimson[3]);  // pennon
    }),
    // the castle sorcerer's staff (not the mage's wood and brass): a shaft of blackened iron
    // wound with thorns and a crimson grip, its head an iron claw clutching a jagged violet
    // shard of the keep's corruption
    sorcererStaff: weapon(50, 18, 10, 9, (p) => {
      p.rect(0, 8, 34, 3, CK.steel[1]);
      p.rect(0, 8, 34, 1, CK.steel[3]);
      p.rect(8, 7, 6, 5, CK.crimson[2]);                     // the grip
      p.rect(8, 7, 6, 1, CK.crimson[3]);
      for (const x of [18, 24, 30]) {                        // thorns along the shaft
        p.px(x, 7, CK.steel[2]);
        p.px(x + 1, 6, CK.steel[3]);
        p.px(x + 2, 11, CK.steel[2]);
        p.px(x + 3, 12, CK.steel[3]);
      }
      p.poly([[0, 7], [3, 9.5], [0, 12]], CK.steel[2]);      // a spiked iron butt
      // the claw: three iron talons curling round the shard
      p.rect(33, 7, 3, 5, CK.steel[2]);
      p.poly([[35, 7], [40, 1], [42, 2], [38, 8]], CK.steel[2]);
      p.poly([[35, 11], [40, 17], [42, 16], [38, 10]], CK.steel[2]);
      p.poly([[36, 9], [46, 8], [46, 10]], CK.steel[1]);
      // the shard: a jagged violet crystal, lit on its upper face
      p.poly([[38, 9], [41, 3], [45, 5], [49, 9], [44, 14], [40, 13]], CK.violet[3]);
      p.poly([[38, 9], [41, 3], [45, 5], [43, 9]], CK.violet[4]);
      p.poly([[43, 9], [49, 9], [44, 14]], CK.violet[2]);
      p.px(41, 5, '#ffffff');
      p.px(42, 6, '#e0c8ff');
      p.rect(40, 1, 2, 1, CK.steel[4]);                      // talon tips
      p.rect(40, 17, 2, 1, CK.steel[4]);
    }),
    // the bishop's crosier: a tall staff with a gilded crook
    crosier: weapon(52, 16, 10, 8, (p) => {
      p.rect(0, 7, 40, 3, G[2]);
      p.rect(0, 7, 40, 1, G[4]);
      for (const x of [10, 24]) { p.rect(x, 6, 2, 5, G[1]); }
      p.ctx.strokeStyle = G[2];
      p.ctx.lineWidth = 3;
      p.ctx.beginPath(); p.ctx.arc(44, 8, 5, Math.PI, Math.PI * 2.6); p.ctx.stroke();
      p.rect(41, 7, 3, 3, CK.violet[3]);
    }),
    // a kite shield in black steel with a crimson field and a faded gold crown
    kiteShield: weapon(18, 26, 9, 12, (p) => {
      p.poly([[1, 2], [17, 2], [17, 12], [9, 25], [1, 12]], CK.steel[3]);
      p.poly([[3, 4], [15, 4], [15, 12], [9, 22], [3, 12]], CK.crimson[2]);
      p.poly([[9, 4], [15, 4], [15, 12], [9, 22]], CK.crimson[1]);
      p.rect(5, 9, 8, 3, G[2]);
      p.px(5, 8, G[2]); p.px(9, 7, G[3]); p.px(12, 8, G[2]);
      p.rect(1, 2, 16, 1, CK.steel[5]);
    }),
    // the royal guard's tower shield: gilded, with the empire's sun
    towerShield: weapon(22, 32, 11, 15, (p) => {
      p.round(1, 1, 20, 30, G[2], 4);
      p.round(3, 3, 16, 26, CK.crimson[2], 3);
      p.rect(3, 3, 3, 26, CK.crimson[3]);
      p.circle(11, 14, 4, G[3]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        p.line(11 + Math.cos(a) * 5, 14 + Math.sin(a) * 5, 11 + Math.cos(a) * 7, 14 + Math.sin(a) * 7, G[2]);
      }
      p.px(10, 13, '#ffffff');
    }),
    // the prince's rapier with a swept gold hilt
    rapier: weapon(40, 12, 5, 6, (p) => {
      p.rect(0, 5, 6, 3, CK.crimson[2]);
      p.ctx.strokeStyle = G[3];
      p.ctx.lineWidth = 1;
      p.ctx.beginPath(); p.ctx.arc(8, 6, 4, -1.2, 1.4); p.ctx.stroke();
      p.rect(7, 2, 2, 8, G[2]);
      p.rect(9, 5, 30, 2, S[4]);
      p.rect(9, 5, 30, 1, S[5]);
      p.px(39, 6, S[5]);
    }),
    // a long brass herald's trumpet with a crimson banner
    trumpet: weapon(36, 18, 3, 6, (p) => {
      p.rect(0, 5, 26, 2, G[3]);
      p.rect(0, 5, 26, 1, G[4]);
      p.poly([[24, 3], [34, 0], [34, 12], [24, 9]], G[2]);
      p.poly([[24, 3], [34, 0], [34, 3], [24, 5]], G[4]);
      p.rect(8, 7, 12, 9, CK.crimson[2]);
      p.rect(12, 9, 4, 4, G[2]);
    }),
    // the gardener's watering can, its rose spout glowing with magic water
    wateringCan: weapon(28, 18, 6, 10, (p) => {
      p.round(2, 6, 14, 11, '#4a7a6a', 3);
      p.rect(3, 7, 3, 9, '#6a9a8a');
      p.ctx.strokeStyle = '#2e5a4a';
      p.ctx.lineWidth = 2;
      p.ctx.beginPath(); p.ctx.arc(9, 6, 5, Math.PI, 0); p.ctx.stroke();
      p.line(15, 12, 24, 5, '#4a7a6a', 2);
      p.round(23, 2, 5, 6, '#6a9a8a', 2);
      p.px(26, 4, '#9ad0ff');
    }),
    // the general's spear, flying the empire's banner (crimson with a gold sun) below the head
    flagSpear: weapon(74, 26, 12, 20, (p) => {
      p.rect(0, 19, 62, 3, L[3]);
      p.rect(0, 19, 62, 1, L[4]);
      p.rect(8, 18, 3, 5, G[2]);
      p.poly([[62, 17], [74, 20.5], [62, 24]], CK.steel[4]);
      p.line(62, 20, 73, 20, CK.steel[5]);
      p.rect(58, 17, 4, 7, G[2]);
      // the banner hanging from the shaft, swallow-tailed
      p.poly([[34, 18], [56, 18], [56, 2], [50, 6], [44, 2], [40, 6], [34, 2]], CK.crimson[2]);
      p.poly([[34, 18], [56, 18], [56, 15], [34, 15]], CK.crimson[1]);
      p.rect(34, 2, 1, 16, CK.crimson[3]);
      p.circle(45, 11, 3, G[3]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        p.px(Math.round(45 + Math.cos(a) * 5), Math.round(11 + Math.sin(a) * 5), G[2]);
      }
      p.px(44, 10, '#ffffff');
    }),
    // the bodyguard's massive shield: a towering slab of black steel, gold-edged, with a crowned lion
    greatShield: weapon(30, 46, 15, 23, (p) => {
      p.round(1, 1, 28, 44, CK.steel[1], 5);
      p.round(3, 3, 24, 40, CK.steel[2], 4);
      p.rect(3, 3, 4, 40, CK.steel[3]);
      p.rect(24, 4, 3, 38, CK.steel[0]);
      p.round(1, 1, 28, 3, G[2], 1);
      p.rect(1, 42, 28, 3, G[1]);
      for (const y of [6, 22, 38]) for (const x of [5, 25]) { p.px(x, y, G[3]); }
      // the crowned lion: a gold head with a mane on a crimson boss
      p.round(8, 13, 14, 16, CK.crimson[2], 4);
      p.round(10, 17, 10, 9, G[2], 3);
      p.round(12, 19, 6, 6, G[3], 2);
      p.px(13, 21, OUTLINE); p.px(16, 21, OUTLINE);
      p.rect(14, 23, 2, 1, CK.crimson[1]);
      for (const x of [11, 15, 19]) p.poly([[x - 1, 16], [x, 12], [x + 1, 16]], G[3]);
    }),
    // the Princess's magic bow (phase 2): a slender golden bow wound with violet light, a string of pure gold,
    // drawn upright (it's turned to her aim, crosswise to it)
    magicBow: weapon(16, 54, 6, 27, (p) => {
      for (let y = 1; y < 53; y++) {
        const t = (y - 1) / 51;
        const x = 2 + Math.round(8 * Math.sin(Math.PI * t));
        p.rect(x, y, 3, 1, G[2]);
        p.px(x, y, G[4]);
      }
      for (const y of [6, 18, 34, 46]) { const x = 2 + Math.round(8 * Math.sin(Math.PI * (y - 1) / 51)); p.rect(x, y, 3, 2, CK.violet[4]); }
      p.round(8, 23, 5, 8, CK.violet[2], 2);      // the grip
      p.px(10, 27, '#e4cfff');
      p.line(3, 2, 3, 52, '#fff6c8');               // the golden string
      p.rect(9, 0, 3, 3, '#ffe680'); p.rect(9, 51, 3, 3, '#ffe680');   // glowing tips
    }),
    // a spiked iron flail ball
    flailBall: weapon(18, 18, 9, 9, (p) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        p.poly([[9 + Math.cos(a - 0.3) * 5, 9 + Math.sin(a - 0.3) * 5], [9 + Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5], [9 + Math.cos(a + 0.3) * 5, 9 + Math.sin(a + 0.3) * 5]], CK.steel[4]);
      }
      p.circle(9, 9, 5.5, CK.steel[2]);
      p.circle(8, 8, 3, CK.steel[3]);
      p.rect(6, 6, 2, 2, CK.steel[5]);
    }),
  });
}

// ---------- projectiles ----------

function buildCastleProjectiles() {
  const sprite = (w, h, fn) => PixelArt.make(w, h, fn, OUTLINE);
  const glowOrb = (size, R) => sprite(size, size, (p) => {
    const c = size / 2;
    p.circle(c, c, c - 1.5, R[0]);
    p.circle(c, c, c - 2.5, R[1]);
    p.circle(c - 1, c - 1, Math.max(1, c - 4.5), R[2]);
    p.rect(c - 2, c - 2, 2, 2, '#ffffff');
  });
  Object.assign(Sprites.projectiles, {
    castleArrow: sprite(20, 7, (p) => {
      p.rect(1, 1, 4, 2, '#2a1a2e');
      p.rect(1, 4, 4, 2, '#8a2438');
      p.rect(3, 3, 13, 1, '#5b3922');
      p.poly([[15, 1], [19, 3.5], [15, 6]], CK.steel[4]);
    }),
    musketBall: sprite(10, 10, (p) => {
      p.circle(5, 5, 3, '#3a3844');
      p.circle(4, 4, 2, '#7a7888');
      p.px(4, 3, '#e0dce8');
    }),
    boulder: sprite(24, 22, (p) => {
      p.poly([[3, 9], [8, 2], [16, 1], [22, 7], [22, 15], [15, 21], [6, 20], [2, 15]], '#4a4652');
      p.poly([[5, 9], [9, 4], [15, 3], [19, 7], [12, 10], [6, 12]], '#6a6676');
      p.line(10, 12, 16, 17, '#2e2a36');
      p.line(14, 6, 19, 10, '#2e2a36');
      p.px(9, 5, '#8e8a9c');
    }),
    flameBoulder: sprite(24, 22, (p) => {
      p.poly([[3, 9], [8, 2], [16, 1], [22, 7], [22, 15], [15, 21], [6, 20], [2, 15]], '#3a2420');
      p.poly([[5, 9], [9, 4], [15, 3], [19, 7], [12, 10], [6, 12]], '#a8401e');
      p.line(10, 12, 16, 17, '#ffb02e');
      p.line(14, 6, 19, 10, '#ff8a1e');
      p.px(9, 5, '#fff2a0');
    }),
    sorcererBolt: glowOrb(14, ['#46286a', '#9a72cc', '#e4cfff']),
    holyOrb: glowOrb(14, ['#8a6a24', '#e0c060', '#fff6d0']),
    redNote: sprite(12, 16, (p) => musicNote(p, 1, ['#5a1420', '#c0384a', '#ff9aa8'])),
    crossbowBolt: sprite(18, 6, (p) => {
      p.rect(1, 1, 3, 1, '#6a449a');
      p.rect(1, 4, 3, 1, '#6a449a');
      p.rect(2, 2, 12, 2, '#3a2a20');
      p.poly([[13, 0.5], [17, 3], [13, 5.5]], CK.steel[4]);
    }),
    magicBolt: sprite(22, 10, (p) => {
      p.poly([[1, 5], [8, 2], [8, 8]], '#4a6ad0');
      p.rect(4, 4, 12, 2, '#9ad0ff');
      p.poly([[14, 1], [21, 5], [14, 9]], '#e6f6ff');
      p.px(17, 5, '#ffffff');
    }),
    // the Princess's great golden arrow, glowing with magic
    goldenArrow: sprite(34, 12, (p) => {
      p.poly([[1, 2], [8, 6], [1, 10]], '#ffe680');
      p.poly([[3, 3], [9, 6], [3, 9]], '#c8a456');
      p.rect(6, 5, 20, 2, '#ecd690');
      p.rect(6, 5, 20, 1, '#fffbe8');
      p.poly([[24, 1], [33, 6], [24, 11]], '#ffd34a');
      p.poly([[24, 1], [33, 6], [27, 6]], '#fffbe8');
      p.px(29, 6, '#ffffff');
    }),
    // her fire potion: a round flask of churning red-orange flame
    firePotion: sprite(12, 16, (p) => {
      p.rect(4, 1, 4, 4, '#c8b08a');
      p.round(1, 5, 10, 10, '#e0461e', 4);
      p.round(2, 7, 7, 6, '#ff8a1e', 3);
      p.rect(4, 9, 3, 3, '#ffd34a');
      p.px(3, 8, '#fff2a0');
    }),
    icePotion: sprite(12, 16, (p) => {
      p.rect(4, 1, 4, 4, '#c8b08a');
      p.round(1, 5, 10, 10, '#4a8aff', 4);
      p.round(2, 7, 7, 6, '#9ad0ff', 3);
      p.px(3, 8, '#ffffff');
    }),
    waterDrop: sprite(10, 12, (p) => {
      p.poly([[5, 1], [9, 7], [5, 11], [1, 7]], '#3a7ad0');
      p.circle(5, 7, 3, '#5aa8f0');
      p.px(4, 6, '#e6f6ff');
    }),
    queenArrow: sprite(24, 9, (p) => {
      p.poly([[1, 1], [6, 4], [1, 8]], '#ff6ad8');
      p.rect(4, 4, 14, 1, '#f0c8ff');
      p.poly([[16, 1], [23, 4.5], [16, 8]], '#c46aff');
      p.px(19, 4, '#ffffff');
    }),
    queenPierce: sprite(28, 7, (p) => {
      p.rect(1, 2, 5, 3, '#e8d8a0');
      p.rect(4, 3, 18, 1, '#fff6d0');
      p.poly([[20, 0.5], [27, 3.5], [20, 6.5]], '#ffe680');
      p.px(23, 3, '#ffffff');
    }),
    lightOrb: glowOrb(16, ['#a07a24', '#ffe680', '#fffbe8']),
  });
}

// ---------- cover ----------

/**
 * The castle's cover (DungeonRun.addCover): stacked crates and barrels, broken pillars
 * wound with black thorns, and a toppled knight's statue on its plinth (two tiles wide).
 */
function buildCastleCover() {
  const STONE = ['#26222e', '#3a3646', '#524c60', '#6e687e', '#908aa0'];
  const W = ['#22150e', '#3b2416', '#5b3922', '#7d532f', '#9c6c3e'];
  const make = (w, h, fn) => PixelArt.bevel(PixelArt.make(w, h, fn, OUTLINE), { light: 0.16, shade: 0.8 });
  const crate = (p, x, y, s) => {
    p.rect(x, y, s, s, W[2]);
    p.rect(x, y, s, 2, W[3]);
    p.rect(x, y + s - 2, s, 2, W[1]);
    p.rect(x, y, 2, s, W[3]);
    p.rect(x + s - 2, y, 2, s, W[1]);
    p.line(x + 2, y + 2, x + s - 3, y + s - 3, W[1], 2);
    for (const [cx, cy] of [[x + 1, y + 1], [x + s - 2, y + 1], [x + 1, y + s - 2], [x + s - 2, y + s - 2]]) p.px(cx, cy, CK.steel[4]);
  };
  const thorns = (p, x, y, h) => {
    for (let i = 0; i < h; i += 2) {
      const vx = x + Math.round(Math.sin(i * 0.6) * 4);
      p.rect(vx, y + i, 2, 2, '#120c16');
      if (i % 6 === 0) { p.px(vx + 2, y + i, '#9a6ad8'); p.px(vx - 1, y + i + 1, '#2a1e30'); }
    }
  };
  Sprites.cover = Object.assign(Sprites.cover || {}, {
    crates: [
      make(34, 46, (p) => {
        crate(p, 2, 24, 18);
        crate(p, 16, 26, 16);
        crate(p, 8, 8, 16);
        p.rect(4, 42, 28, 2, '#1a1418');
      }),
      make(34, 46, (p) => {
        // a barrel beside two crates
        crate(p, 1, 22, 20);
        crate(p, 4, 6, 16);
        p.round(20, 20, 13, 22, W[2], 5);
        p.rect(21, 22, 3, 18, W[3]);
        for (const y of [24, 32, 38]) p.rect(20, y, 13, 2, CK.steel[2]);
        p.rect(20, 20, 13, 2, W[4]);
      }),
    ],
    pillar: [
      make(30, 58, (p) => {
        p.rect(3, 50, 24, 6, STONE[1]);
        p.rect(3, 50, 24, 1, STONE[3]);
        p.rect(6, 12, 18, 38, STONE[2]);
        for (const x of [9, 14, 19]) p.rect(x, 12, 1, 38, STONE[1]);
        p.rect(6, 12, 3, 38, STONE[3]);
        // snapped off: a jagged top
        p.poly([[6, 12], [9, 6], [13, 10], [16, 3], [20, 9], [24, 7], [24, 12]], STONE[2]);
        p.poly([[9, 6], [13, 10], [16, 3], [16, 8], [11, 12]], STONE[3]);
        thorns(p, 18, 14, 36);
        p.rect(2, 54, 7, 3, STONE[1]);   // rubble at its foot
      }),
      make(30, 58, (p) => {
        p.rect(3, 50, 24, 6, STONE[1]);
        p.rect(3, 50, 24, 1, STONE[3]);
        p.rect(6, 18, 18, 32, STONE[2]);
        for (const x of [9, 14, 19]) p.rect(x, 18, 1, 32, STONE[1]);
        p.rect(6, 18, 3, 32, STONE[3]);
        p.rect(4, 14, 22, 5, STONE[3]);   // a cracked capital
        p.rect(4, 14, 22, 1, STONE[4]);
        p.line(12, 14, 15, 30, STONE[0]);
        thorns(p, 9, 20, 30);
      }),
    ],
    statue: [
      // a toppled knight statue lying across its plinth, cracked, wound with thorns
      make(70, 50, (p) => {
        p.rect(4, 30, 62, 16, STONE[1]);
        p.rect(4, 30, 62, 2, STONE[3]);
        p.rect(4, 44, 62, 2, STONE[0]);
        for (const x of [14, 34, 54]) p.rect(x, 33, 2, 10, STONE[0]);
        // the fallen knight: helm, body and a broken sword along the top
        p.round(6, 16, 14, 14, STONE[3], 5);
        p.rect(10, 22, 8, 2, STONE[0]);
        p.round(20, 18, 30, 12, STONE[2], 4);
        p.rect(22, 19, 26, 2, STONE[4]);
        p.round(48, 20, 14, 9, STONE[2], 3);
        p.rect(30, 12, 2, 8, STONE[3]);   // the sword hilt pointing up
        p.rect(26, 14, 10, 2, STONE[3]);
        p.line(40, 18, 46, 28, STONE[0]);
        thorns(p, 56, 24, 18);
        thorns(p, 8, 30, 14);
      }),
    ],
  });
  // the Queen's living hedges (phase 2): a clipped hedge block with dark roses
  const G = CASTLE_COLORS.hedge;
  const R = CASTLE_COLORS.rose;
  Sprites.hedgeBlock = [0, 1, 2].map((v) => PixelArt.make(32, 52, (p) => {
    const rng = seededRandom(v * 977 + 13);
    p.rect(0, 20, 32, 30, G[1]);
    for (let i = 0; i < 8; i++) {
      const cx = 3 + Math.floor(rng() * 26);
      const cy = 22 + Math.floor(rng() * 24);
      p.circle(cx, cy, 4, G[2]);
      p.circle(cx - 1, cy - 1, 2, G[3]);
    }
    p.rect(0, 46, 32, 4, G[0]);
    p.rect(0, 0, 32, 22, G[2]);
    for (let i = 0; i < 7; i++) {
      const cx = 3 + Math.floor(rng() * 26);
      const cy = 3 + Math.floor(rng() * 16);
      p.circle(cx, cy, 4, G[3]);
      p.px(cx - 1, cy - 2, G[4]);
    }
    p.rect(0, 20, 32, 2, G[1]);
    for (let i = 0; i < 4; i++) {
      const rx = 4 + Math.floor(rng() * 24);
      const ry = 6 + Math.floor(rng() * 36);
      p.circle(rx, ry, 2, R[1]);
      p.px(rx, ry, R[2]);
      p.px(rx - 1, ry - 1, R[3]);
    }
  }, OUTLINE));
}
