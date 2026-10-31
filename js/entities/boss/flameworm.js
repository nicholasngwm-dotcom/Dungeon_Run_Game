// =============================================================
//  THE DECRONIC FLAMEWORM (the Fiery Fortress's boss, any stage)
//
//  A giant sandworm armoured in plates of crimson rock (see buildFlamewormSprites) that lives under the
//  fortress's floor. Its body is a spine of plated segments following a curve: rooted in its hole it rears
//  up out of it, swaying; when it dives or leaps the whole body runs along an arc through the air and into
//  the ground, so every move flows. Each worm goes round (CONFIG.flameworm):
//    up:      it sways, watching, for surfaceTime s, then sprays fireballs in all directions (always the
//             first time) or forms a divine flame arrow in its jaws and looses it at the hero: it bursts into
//             a pillar of flame and leaves the area burning
//    plunge:  it arcs over and dives head first into the floor beside the hero, biting as it goes in
//    diving:  for a few seconds it leaps out of the floor at the hero again and again, diving in where they
//             stood (it comes up `from` px short of them, tunnelling between leaps)
//    under:   it can't be hurt; its mound of heaving rock burrows about near the hero (digTime s, random),
//             leaving a trail of molten rock behind it
//    surface: the floor cracks and glows where it will burst up (bite.windup), then it bites up through it
//  and round again. Below splitAt of its health it convulses and splits into splitCount worms, each splitScale
//  x its size and with its own health bar (sharing out what was left): the three rear up out of its hole and
//  plunge away into the floor, then all do the same, out of step. It's beaten when the last one falls. Fire
//  (burnDps for burnTime) is the slow, light burn; the bites, leaps and blasts hurt.
//  The boss object holds the worms, their holes and the molten trail; each worm is something the heroes can hit
//  while it's up out of the ground.
// =============================================================

// its entrance: the floor trembles and cracks (until burst), it bursts up through it (rise), roars
const FLAMEWORM_INTRO = { burst: 1.7, rise: 2.3, total: 3.2 };
const WORM_JOINTS = 18;   // segments along its spine, the head first
const WORM_GAP = 14;      // px between them (x its scale)
const WORM_PER = 10;      // curve samples between control points
// the head's pivots (sprite px): where the neck meets the body, the jaw's hinge, and where each part hangs off it
const WORM_HEAD = { hinge: [22, 7], skull: [24, 38], jaw: [3, 4], throat: [10, -8], scale: 1.2 };
// states it's rooted in its hole for (its body rears up out of it)
const WORM_ROOTED = ['intro', 'emerge', 'up', 'spray', 'arrow', 'diveWait', 'splitting', 'birth'];

/** A Catmull-Rom curve through 3D control points ({x, y, z}, z up off the floor), as a dense polyline with the length along it. */
function wormCurve(ctrl) {
  const pts = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let k = 0; k < WORM_PER; k++) {
      const t = k / WORM_PER;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z), s: 0 });
    }
  }
  const e = ctrl[n - 1];
  pts.push({ x: e.x, y: e.y, z: e.z, s: 0 });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    b.s = a.s + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return pts;
}

/** The point `s` px along a wormCurve, and the way the curve runs there on screen (`a`). */
function wormCurveAt(pts, s) {
  let lo = 0;
  let hi = pts.length - 1;
  if (s <= 0) hi = 1;
  else if (s >= pts[hi].s) lo = hi - 1;
  else {
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m].s <= s) lo = m; else hi = m;
    }
  }
  const a = pts[lo];
  const b = pts[hi];
  const k = clamp((s - a.s) / Math.max(0.001, b.s - a.s), 0, 1);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), a: Math.atan2((b.y - b.z) - (a.y - a.z), b.x - a.x) };
}

/** Rocks flung up out of the floor, tumbling and bouncing to rest (visual only). */
function wormRocks(world, x, y, n, power = 1, s = 1) {
  const rocks = Sprites.flameworm.rocks;
  for (let i = 0; i < n; i++) {
    const img = vchoose(rocks);
    const a = vrand(0, TAU);
    const sp = vrand(30, 110) * power;
    const vz = vrand(110, 250) * power;
    const spin = vrand(-9, 9);
    const sc = s * vrand(0.6, 1.05);
    const fly = (2 * vz) / 600;
    const x0 = x + vrand(-12, 12) * s;
    const y0 = y + vrand(-5, 5) * s;
    world.effects.add(fly + 0.5, (ctx, t) => {
      const secs = t * (fly + 0.5);
      const f = Math.min(secs, fly);
      const z = Math.max(0, vz * f - 300 * f * f);
      const px = x0 + Math.cos(a) * sp * f;
      const py = y0 + Math.sin(a) * sp * f * 0.5;
      ctx.save();
      ctx.globalAlpha = secs < fly ? 1 : 1 - (secs - fly) / 0.5;
      drawShadow(ctx, px, py, img.width * sc * 0.4, img.height * sc * 0.15, 0.3);
      ctx.translate(Math.round(px), Math.round(py - z));
      ctx.rotate(spin * f);
      ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
      ctx.restore();
    });
  }
}

/** The divine flame arrow's burst: a pillar of flame roaring up out of the ground, r wide, h tall (visual only). */
function flamePillar(world, x, y, r, h) {
  const seed = vrand(0, 10);
  const life = 1.5;
  world.effects.add(0.5, (ctx, t) => {
    // a ring of fire racing out across the floor from its foot
    ctx.save();
    ctx.globalAlpha = 1 - t;
    PFX.ring(ctx, x, y, r * (0.4 + t * 0.8), r * 0.5 * (0.4 + t * 0.8), '#ffb52e', 2, { thick: 3 });
    ctx.restore();
  }, true);
  world.effects.add(life, (ctx, t) => {
    const secs = t * life;
    const up = 1 - (1 - Math.min(1, t / 0.1)) ** 3;
    const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    const hh = h * up * (0.8 + 0.2 * fade);
    const w = r * (0.8 - t * 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - hh * 0.45, w * 1.4, '255, 110, 30', 0.9 * fade, 2, hh * 0.65);
    PFX.glow(ctx, x, y - 6, w * 1.2, '255, 220, 140', 0.8 * fade, 2, w * 0.5);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade * 1.5);
    // the column: tongues of flame side by side, the middle ones tallest, a white-hot heart
    for (let i = -3; i <= 3; i++) {
      const k = 1 - Math.abs(i) / 4;
      PFX.flame(ctx, x + i * w * 0.22, y + 4, w * 0.5, hh * (0.4 + 0.6 * k), secs + seed + i * 0.37, FORT_FIRE, 3);
    }
    PFX.flame(ctx, x, y + 2, w * 0.36, hh * 0.85, secs * 1.3 + seed, ['#ff8a1e', '#ffd34a', '#fff6c8', '#ffffff'], 3);
    // blobs of flame tearing off its top and rising away
    for (let j = 0; j < 6; j++) {
      const u = (secs * 1.3 + j / 6) % 1;
      const by = y - hh * (0.75 + u * 0.45);
      const br = (w * 0.14 + 3) * (1 - u);
      PFX.disc(ctx, x + Math.sin(j * 2.1 + secs * 3) * w * 0.35, by, br, br, u < 0.4 ? FORT_FIRE[3] : FORT_FIRE[2], 3);
    }
    ctx.restore();
  });
}

class FlamewormBody {
  constructor(boss, x, y, hp, scale) {
    this.boss = boss;
    this.x = x;
    this.y = y;
    this.maxHp = hp;
    this.hp = hp;
    this.scale = scale;
    this.state = 'under';
    this.t = 0;
    this.digFor = rand(...boss.cfg.digTime);
    this.rise = 0;          // 0 below ground .. 1 reared up to its full height (while rooted)
    this.aim = Math.PI / 2;
    this.facing = 1;        // its head faces right (1) or left (-1)
    this.sway = rand(0, TAU);
    this.flashTime = 0;
    this.dead = false;
    this.sinking = 0;
    this.waves = 0;         // fireball waves left to spray
    this.jaw = 0.1;         // how far its jaw hangs open (radians)
    this.kick = 0;          // its jaw snapping wide on a fireball wave, then easing back
    this.recoil = 0;        // px its head is thrown back by a wave or the arrow
    this.rear = 0;          // px its head rears up drawing the arrow
    this.path = null;       // while diving or leaping: the curve its body runs along
    this.sHead = 0;
    this.joints = [];
    this.attacked = false;
  }

  get cfg() { return this.boss.cfg; }
  get bodyLen() { return (WORM_JOINTS - 1) * WORM_GAP * this.scale; }
  get rooted() { return !this.path && WORM_ROOTED.includes(this.state); }
  /** Where its head is on screen. */
  get head() {
    const j = this.joints[0];
    return j ? { x: j.x, y: j.y - j.z } : { x: this.x, y: this.y };
  }
  /** Its mouth on screen: where fireballs and the arrow leave from. */
  get mouth() {
    const j = this.joints[0];
    if (!j) return { x: this.x, y: this.y };
    const s = this.scale;
    const lx = 48 * s;
    const ly = 4 * s * this.facing;
    return { x: j.x + Math.cos(j.a) * lx - Math.sin(j.a) * ly, y: j.y - j.z + Math.sin(j.a) * lx + Math.cos(j.a) * ly };
  }
  get hx() { return this.hit ? this.hit.x : this.x; }
  get hy() { return this.hit ? this.hit.y : this.y; }
  get radius() { return 34 * this.scale; }
  /** Up out of the ground far enough to be hit. */
  get targetable() {
    return !this.dead && this.exposed && this.state !== 'splitting' && this.state !== 'birth' && this.boss.intro <= 0 && this.boss.dying <= 0;
  }

  knockback() {}
  stun() {}

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.boss.onWormDown(this, world);
      return true;
    }
    this.boss.checkSplit(world);
    return true;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  update(dt, world) {
    this.t += dt;
    this.flashTime -= dt;
    this.sway += dt * 1.6;
    this.kick = Math.max(0, this.kick - dt * 3);
    this.recoil = Math.max(0, this.recoil - dt * 50);
    if (this.dead) {
      // fallen: it sinks back into its hole (or carries on down into the floor), rock and lava spilling off it
      this.sinking -= dt;
      if (this.path) this.sHead += this.speed * dt;
      else this.rise = Math.max(0, this.rise - dt * 0.6);
      this.pose(world.time);
      if (this.exposed && vrand(0, 1) < dt * 14) world.effects.burst(this.head.x + vrand(-14, 14), this.head.y + vrand(-10, 20), { count: 4, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [40, 160], life: [0.3, 0.6], gravity: 360 });
      return;
    }
    const c = this.cfg;
    const p = world.player;
    if (!p.dead && this.rooted && this.state !== 'birth' && this.state !== 'splitting') {
      const want = angleTo(this.x, this.y, p.x, p.y);
      this.aim += clamp(angleDiff(this.aim, want), -2.5 * dt, 2.5 * dt);
    }
    if (this.rooted) {
      if (Math.cos(this.aim) > 0.25) this.facing = 1;
      else if (Math.cos(this.aim) < -0.25) this.facing = -1;
    }
    switch (this.state) {
      case 'under': this.updateUnder(dt, world, p); break;
      case 'gap': this.updateGap(dt, world); break;
      case 'surface':
        // the floor cracking and glowing over it, rocks jumping, then it bursts up and bites
        this.rise = 0;
        if (vrand(0, 1) < 0.5) world.effects.burst(this.x + vrand(-30, 30) * this.scale, this.y + vrand(-14, 14) * this.scale, { count: 1, colors: FORT_LAVA_GIBS, speed: [20, 60], life: [0.2, 0.4], up: 50 });
        if (vrand(0, 1) < dt * 6) wormRocks(world, this.x, this.y, 1, 0.4, this.scale);
        if (this.t >= c.bite.windup) this.bite(world);
        break;
      case 'emerge': {
        // up out of its hole, overshooting a little and settling
        const k = Math.min(1, this.t / 0.4);
        const b = 1.70158;
        this.rise = 1 + (b + 1) * (k - 1) ** 3 + b * (k - 1) ** 2;
        if (k >= 1) { this.rise = 1; this.setState('up'); }
        break;
      }
      case 'up':
        this.rise = Math.min(1, this.rise + dt * 2);
        if (this.t >= c.surfaceTime[this.boss.split ? 1 : 0]) {
          // always fireballs the first time; after that a coin toss with the arrow
          if (!this.attacked || Math.random() < 0.5) { this.setState('spray'); this.waves = c.fireballs.waves; }
          else { this.setState('arrow'); Sound.play('crownCharge', 0.12); }
          this.attacked = true;
        }
        break;
      case 'spray':
        if (this.t >= c.fireballs.every) {
          this.t = 0;
          this.sprayWave(world);
          if (--this.waves <= 0) this.setState('diveWait');
        }
        break;
      case 'arrow': {
        // it rears back, the arrow of fire forming in its jaws; the aim locks a moment before it looses
        const k = clamp(this.t / c.arrow.windup, 0, 1);
        this.rear = 26 * this.scale * Math.sin(k * Math.PI * 0.5);
        if (!p.dead && this.t < c.arrow.windup - 0.35) this.arrowAt = { x: p.x, y: p.y };
        if (this.t >= c.arrow.windup) { this.loose(world); this.rear = 0; this.setState('diveWait'); }
        break;
      }
      case 'diveWait':
        if (this.t >= 0.35) this.startPlunge(world);
        break;
      case 'birth': {
        // one of the three new worms rearing up out of the old one's hole, fanning out
        const k = Math.min(1, this.t / c.split.birth);
        this.rise = 1 - (1 - k) ** 3;
        if (k >= 1) this.startPlunge(world, this.plungeTo);
        break;
      }
      case 'splitting':
        // convulsing, glowing hotter and hotter, rocks bursting from its hole, until it tears apart
        if (vrand(0, 1) < dt * 8) wormRocks(world, this.hit.gx, this.hit.gy, 2, 0.8, this.scale);
        if (vrand(0, 1) < dt * 5) world.shake(4, 0.15);
        if (this.t >= c.split.time) this.boss.finishSplit(world, this);
        break;
      case 'plunge':
      case 'leap':
        this.updateFlight(dt, world);
        break;
    }
    this.jaw += (this.jawTarget(world.time) - this.jaw) * Math.min(1, dt * 16);
    this.pose(world.time);
  }

  /** How far its jaw wants to hang open, whatever it's doing. */
  jawTarget(time) {
    switch (this.state) {
      case 'emerge': return this.t < 0.22 ? 0.95 : 0.1;
      case 'spray': return 0.3 + this.kick * 0.55;
      case 'arrow': return 0.6;
      case 'diveWait': return 0.35;
      case 'birth': return 0.8;
      case 'splitting': return 0.85 + Math.sin(time * 30) * 0.1;
      case 'intro': return 0.9;
      case 'plunge':
      case 'leap': {
        if (this.struck) return 0;
        const j = this.joints[0];
        return j && Math.sin(j.a) > 0.2 ? 0.95 : 0.35;   // agape as it comes down
      }
      default: return 0.12 + Math.sin(time * 3) * 0.06;
    }
  }

  /** Below ground: its mound of heaving rock burrows after the hero, then it comes up under them. */
  updateUnder(dt, world, p) {
    const c = this.cfg;
    this.rise = 0;
    if (!p.dead) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > 4) {
        const s = Math.min(d, c.digSpeed * dt);
        this.x += ((p.x - this.x) / d) * s;
        this.y += ((p.y - this.y) / d) * s;
      }
    }
    this.keepInside(world, this);
    this.churn(dt, world);
    if (this.t >= this.digFor) {
      this.setState('surface');
      Sound.play('graveRumble', 0.12);
    }
  }

  /** Tunnelling between leaps: its mound races to where it'll come up. */
  updateGap(dt, world) {
    const k = Math.min(1, this.t / this.gapTime);
    this.x = lerp(this.gapFrom.x, this.leapFrom.x, k);
    this.y = lerp(this.gapFrom.y, this.leapFrom.y, k);
    this.churn(dt, world);
    this.diveLeft -= dt;
    if (k >= 1) this.startLeap(world);
  }

  /** The molten rock its burrow leaves behind, and the rubble churning up off its mound. */
  churn(dt, world) {
    const tr = this.boss.trail;
    const last = this.lastTrail;
    if (!last || dist(last.x, last.y, this.x, this.y) >= 7 * this.scale) {
      this.lastTrail = { x: this.x, y: this.y, t: this.boss.time, s: this.scale, seed: tr.length % 7, prev: last };
      tr.push(this.lastTrail);
    }
    if (vrand(0, 1) < dt * 30) world.effects.burst(this.x + vrand(-16, 16) * this.scale, this.y + vrand(-6, 6), { count: 1, colors: [...FORT_ROCK_GIBS, '#ff7a1a'], speed: [20, 70], life: [0.3, 0.5], up: 60, gravity: 300, size: [2, 3] });
    if (vrand(0, 1) < dt * 4) wormRocks(world, this.x, this.y, 1, 0.45, this.scale);
  }

  keepInside(world, pt, m = 40) {
    const b = world.dungeon.floorBounds;
    pt.x = clamp(pt.x, b.left + m, b.right - m);
    pt.y = clamp(pt.y, b.top + m + 20, b.bottom - m + 10);
    return pt;
  }

  /** It bursts up through the floor, jaws first: everyone over it is bitten. */
  bite(world) {
    const c = this.cfg;
    const r = c.bite.radius * this.scale;
    hitAround(world, this.x, this.y, r, c.bite.damage, 260);
    const { x, y } = this;
    world.effects.add(0.45, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, r * (0.5 + t * 0.7), r * 0.55 * (0.5 + t * 0.7), '#ffb52e', 2, { thick: t < 0.3 ? 4 : 2 });
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 10, { count: 30, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [100, 300], life: [0.4, 0.9], up: 160, gravity: 400, size: [2, 6] });
    wormRocks(world, x, y, 12, 1.2, this.scale);
    world.effects.smoke(x, y - 8, { count: 8, radius: r * 0.6, life: 1, rise: 30, colors: ['#2a1a18', '#4a3430', '#6a5048'] });
    world.shake(8 * this.scale, 0.35);
    Sound.play('rockErupt');
    Sound.play('bossRoar', 0.1);
    this.holeBorn = this.boss.time;
    this.rise = 0;
    this.setState('emerge');
  }

  /** One wave of fireballs flung out in every direction (each wave turned half a gap from the last). */
  sprayWave(world) {
    const F = this.cfg.fireballs;
    const n = F.count[this.boss.split ? 1 : 0];
    const m = this.mouth;
    const off = (this.waves % 2) * (Math.PI / n) + this.sway * 0.1;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      fireShot(world, m.x + Math.cos(a) * 10, m.y + Math.sin(a) * 8, a, F.speed, F, {
        radius: 6, damage: F.damage, life: 4, sprite: Sprites.projectiles.fireball, spin: 8,
      });
    }
    world.effects.burst(m.x, m.y, { count: 14, colors: FORT_LAVA_GIBS, speed: [40, 160], life: [0.2, 0.4] });
    this.kick = 1;
    this.recoil = 10 * this.scale;
    Sound.play('bossFireball', 0.1);
  }

  /** The divine flame arrow, loosed at where the hero stood: it bursts there into a pillar of flame and leaves the area burning. */
  loose(world) {
    const A = this.cfg.arrow;
    const m = this.mouth;
    const to = this.arrowAt || { x: m.x, y: m.y + 100 };
    const a = angleTo(m.x, m.y, to.x, to.y);
    const life = Math.max(0.2, dist(m.x, m.y, to.x, to.y) / A.speed);
    const burst = (w, x, y) => {
      for (const t of w.allies) {
        if (dist(t.x, t.y, x, y) >= A.blastRadius + t.radius) continue;
        if (t.hurt(A.damage, w, x, y)) { setAlight(w, t, A); t.knockback?.(angleTo(x, y, t.x, t.y), 240); }
      }
      enemyBlastFx(w, x, y, A.blastRadius);
      flamePillar(w, x, y, A.blastRadius * 0.7, A.pillar);
      firePatch(w, x, y, A.fireRadius, A.fireTime, A, 14);
      w.effects.burst(x, y - 10, { count: 30, colors: ['#fff6c8', '#ffd34a', '#ff8a1e', '#e0461e'], speed: [80, 260], life: [0.3, 0.8], up: 120 });
      w.shake(9, 0.45);
      Sound.play('crownBlast', 0.15);
    };
    enemyShot(world, m.x, m.y, a, A.speed, {
      radius: 12, damage: 0, life, sprite: Sprites.projectiles.wormArrow, glow: '255, 150, 60', trail: ['#fff6c8', '#ffd34a', '#ff8a1e'],
      // fire streaming off it behind as it flies
      aura: (ctx, pr) => {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI * 1.5);
        PFX.flame(ctx, 0, 10, 22, 64, pr.age, FORT_FIRE);
        PFX.flame(ctx, -9, 4, 10, 34, pr.age + 0.4, FORT_FIRE);
        PFX.flame(ctx, 9, 4, 10, 34, pr.age + 0.8, FORT_FIRE);
        ctx.restore();
      },
      onHit: (pr, w) => burst(w, pr.x, pr.y),
    });
    this.recoil = 16 * this.scale;
    world.shake(4, 0.2);
    Sound.play('fireArrow');
  }

  /** It arcs over and dives head first into the floor (by the hero, or at `to`), biting as it goes in. */
  startPlunge(world, to = null) {
    const c = this.cfg.plunge;
    const s = this.scale;
    const p = world.player;
    let end = to;
    if (!end) {
      const a = p.dead ? this.aim : angleTo(this.x, this.y, p.x, p.y);
      const k = Math.max(70 * s, (p.dead ? 0 : dist(this.x, this.y, p.x, p.y)) - c.near);
      end = { x: this.x + Math.cos(a) * k, y: this.y + Math.sin(a) * k };
    }
    end = this.keepInside(world, { ...end });
    // the curve: its body as it stands now, then up over and down into the floor
    const ctrl = this.rootedCtrl(world.time).slice(0, 5);
    const head = ctrl[4];
    const d = Math.max(1, dist(this.x, this.y, end.x, end.y));
    const ux = (end.x - this.x) / d;
    const uy = (end.y - this.y) / d;
    ctrl.push(
      { x: lerp(head.x, end.x, 0.5), y: lerp(head.y, end.y, 0.5), z: head.z * 0.75 + 20 * s },
      { x: end.x, y: end.y, z: 0 },
      { x: end.x + ux * 24 * s, y: end.y + uy * 24 * s, z: -50 * s },
      { x: end.x + ux * 120 * s, y: end.y + uy * 120 * s, z: -340 * s },
    );
    this.boss.holes.push({ x: this.x, y: this.y, s, seed: Math.round(this.x + this.y), born: this.boss.time - 1, until: this.boss.time + 1.6 });
    this.fly(ctrl, 4, 6, end, c.radius, c.damage);
    const sHit = this.hitS;
    this.speed = (sHit - this.sHead) / (c.time * 0.6);
    this.facing = end.x >= this.x ? 1 : -1;
    this.setState('plunge');
    Sound.play('graveRumble', 0.1);
  }

  /** A leap out of the floor at the hero: up `from` px short of them, in an arc, and down where they stood. */
  startLeap(world) {
    const D = this.cfg.diving;
    const s = this.scale;
    const A = this.leapFrom;
    const B = this.leapTo;
    const d = Math.max(1, dist(A.x, A.y, B.x, B.y));
    const ux = (B.x - A.x) / d;
    const uy = (B.y - A.y) / d;
    const ctrl = [
      { x: A.x - ux * 120 * s, y: A.y - uy * 120 * s, z: -340 * s },
      { x: A.x - ux * 24 * s, y: A.y - uy * 24 * s, z: -50 * s },
      { x: A.x, y: A.y, z: 0 },
      { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: D.height * s },
      { x: B.x, y: B.y, z: 0 },
      { x: B.x + ux * 24 * s, y: B.y + uy * 24 * s, z: -50 * s },
      { x: B.x + ux * 120 * s, y: B.y + uy * 120 * s, z: -340 * s },
    ];
    this.fly(ctrl, 2, 4, B, D.radius, D.damage);
    this.sHead = this.outS - 20 * s;
    this.speed = D.speed * s;
    this.facing = ux >= 0 ? 1 : -1;
    this.x = A.x;
    this.y = A.y;
    this.setState('leap');
  }

  /** Sets it moving along a curve (ctrl), coming out of the floor at ctrl[outAt], diving back in at ctrl[inAt] (= `to`), biting there. */
  fly(ctrl, outAt, inAt, to, radius, damage) {
    this.path = wormCurve(ctrl);
    this.sHead = this.path[outAt * WORM_PER].s;
    this.outS = this.path[outAt * WORM_PER].s;
    this.hitS = this.path[inAt * WORM_PER].s;
    this.flyFrom = { x: ctrl[outAt].x, y: ctrl[outAt].y };
    this.flyTo = to;
    this.strike = { radius: radius * this.scale, damage };
    this.struck = false;
    this.out = false;
  }

  /** Diving or leaping: its body runs along the curve, out of the floor and back in where it bites. */
  updateFlight(dt, world) {
    const s = this.scale;
    this.sHead += this.speed * dt;
    if (this.state === 'leap') this.diveLeft -= dt;
    if (!this.out && this.sHead >= this.outS) {
      // bursting out of the floor
      this.out = true;
      const f = this.flyFrom;
      if (this.state === 'leap') {
        this.boss.holes.push({ x: f.x, y: f.y, s, seed: Math.round(f.x + f.y), born: this.boss.time, until: this.boss.time + (this.bodyLen + 60 * s) / this.speed + 0.8 });
        wormRocks(world, f.x, f.y, 8, 1, s);
        world.effects.burst(f.x, f.y - 6, { count: 18, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [60, 220], life: [0.3, 0.7], up: 120, gravity: 400 });
        world.shake(4 * s, 0.2);
        Sound.play('rockErupt', 0.08);
      }
    }
    if (!this.struck && this.sHead >= this.hitS) {
      // head first into the floor, jaws snapping shut on whoever's there
      this.struck = true;
      const e = this.flyTo;
      hitAround(world, e.x, e.y, this.strike.radius, this.strike.damage, 220);
      this.boss.holes.push({ x: e.x, y: e.y, s, seed: Math.round(e.x + e.y), born: this.boss.time, until: this.boss.time + (this.bodyLen + 40 * s) / this.speed + 0.9 });
      const r = this.strike.radius;
      world.effects.add(0.4, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 1 - t;
        PFX.ring(ctx, e.x, e.y, r * (0.6 + t * 0.6), r * 0.55 * (0.6 + t * 0.6), '#ffb52e', 2, { thick: t < 0.3 ? 3 : 2 });
        ctx.restore();
      }, true);
      wormRocks(world, e.x, e.y, 10, 1.1, s);
      world.effects.burst(e.x, e.y - 6, { count: 26, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [80, 260], life: [0.4, 0.8], up: 140, gravity: 400, size: [2, 5] });
      world.shake(7 * s, 0.3);
      Sound.play('rockErupt');
    }
    // all of it gone into the floor: on with the dive
    if (this.sHead - this.bodyLen > this.hitS + 10 * s) {
      this.x = this.flyTo.x;
      this.y = this.flyTo.y;
      this.path = null;
      this.lastTrail = null;
      if (this.state === 'plunge' && !this.afterPlunge) {
        this.diveLeft = this.cfg.diving.time[this.boss.split ? 1 : 0];
        this.startGap(world);
      } else if (this.state === 'leap' && this.diveLeft > 0) this.startGap(world);
      else {
        this.setState('under');
        this.digFor = this.afterPlunge ? this.digAfter : rand(...this.cfg.digTime);
        this.afterPlunge = null;
      }
    }
  }

  /** Between leaps: picks where it'll come up (short of the hero, from a new side if it's right under them) and where it'll dive in (where they stand now). */
  startGap(world) {
    const D = this.cfg.diving;
    const s = this.scale;
    const p = world.player;
    const at = p.dead ? { x: this.x, y: this.y + 1 } : { x: p.x, y: p.y };
    const d = dist(this.x, this.y, at.x, at.y);
    let a = d > 60 ? angleTo(this.x, this.y, at.x, at.y) : (this.leapAngle ?? 0) + (Math.random() < 0.5 ? -1 : 1) * rand(1.6, 2.6);
    this.leapAngle = a;
    this.leapTo = this.keepInside(world, { ...at });
    this.leapFrom = this.keepInside(world, { x: at.x - Math.cos(a) * D.from * s, y: at.y - Math.sin(a) * D.from * s * 0.7 });
    this.gapFrom = { x: this.x, y: this.y };
    this.gapTime = Math.max(D.gap, dist(this.x, this.y, this.leapFrom.x, this.leapFrom.y) / 700);
    this.setState('gap');
  }

  /** Touching it while it's reared up out of its hole hurts. */
  contactDamage(world) {
    if (!this.rooted || this.rise < 0.5 || this.dead || this.state === 'birth') return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 30 * this.scale + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  // ---------- its spine ----------

  /** The control points of its body reared up out of its hole: deep below, the hole, a bow, its head, where it looks. */
  rootedCtrl(time) {
    const s = this.scale;
    const r = this.rise;
    const ca = Math.cos(this.aim);
    const sa = Math.sin(this.aim);
    const side = Math.sin(this.sway) * 12 * s * r;
    const reach = (58 * s - this.recoil - this.rear * 0.8) * r;
    const hz = (118 * s + this.rear) * r - 50 * s * (1 - r) + Math.sin(this.sway * 1.3) * 5 * s * r;
    const head = { x: this.x + ca * reach - sa * side, y: this.y + sa * reach * 0.55 + ca * side * 0.5, z: hz };
    const bow = { x: this.x - ca * 22 * s * r + sa * side * 0.6, y: this.y - sa * 10 * s * r, z: hz * 0.55 };
    const fx = ca * 0.55 + this.facing * 0.45;
    const look = { x: head.x + fx * 60 * s, y: head.y + sa * 16 * s, z: head.z - 58 * s * r + this.rear * 0.3 };
    return [
      { x: this.x, y: this.y, z: -300 * s },
      { x: this.x, y: this.y, z: -40 * s },
      { x: this.x, y: this.y, z: 0 },
      bow, head, look,
    ];
  }

  /** Lays its joints along its curve (rooted, or the one it's flying along), and finds where it can be hit. */
  pose(time) {
    const s = this.scale;
    let pts;
    let sHead;
    if (this.path) { pts = this.path; sHead = this.sHead; }
    else { pts = wormCurve(this.rootedCtrl(time)); sHead = pts[4 * WORM_PER].s; }
    const J = [];
    const ripple = this.path ? 0 : this.rise;
    const shake = this.state === 'splitting' ? Math.min(1, this.t / this.cfg.split.time) : 0;
    for (let i = 0; i < WORM_JOINTS; i++) {
      const j = wormCurveAt(pts, sHead - i * WORM_GAP * s);
      // a ripple running down its body as it sways; a shudder as it splits
      if (i > 0) j.x += Math.sin(time * 4 - i * 0.6) * 3 * s * Math.min(1, i / 4) * ripple;
      if (shake) { j.x += Math.sin(time * 47 + i * 1.7) * 3 * shake; j.z += Math.cos(time * 41 + i * 2.3) * 2 * shake; }
      J.push(j);
    }
    this.joints = J;
    let top = null;
    for (const j of J) if (!top || j.z > top.z) top = j;
    if (this.path) {
      this.exposed = top.z > 30 * s;
      this.hit = { x: top.x, y: top.y - top.z, gx: top.x, gy: top.y };
    } else {
      this.exposed = this.rise > 0.4;
      const j = J[4];
      this.hit = { x: j.x, y: j.y - j.z, gx: this.x, gy: this.y };
    }
  }

  // ---------- drawing ----------

  /** On the floor: the hole it's rooted in (back half), the glow over its burrow, the cracks where it'll come up, the warnings. */
  drawGround(ctx, time) {
    const s = this.scale;
    const c = this.cfg;
    if (this.dead && !this.exposed) return;
    if (this.state === 'under' || this.state === 'gap') {
      drawShadow(ctx, this.x, this.y + 6, 40 * s, 13 * s, 0.45);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.y, 44 * s, FORT_LAVA, 0.45, 2, 16 * s);
      ctx.restore();
      return;
    }
    if (this.state === 'surface') {
      const k = clamp(this.t / c.bite.windup, 0, 1);
      Telegraph.circle(ctx, this.x, this.y, c.bite.radius * s, k, '255, 120, 40');
      // cracks spreading out from where it will come up, glowing hotter
      ctx.save();
      ctx.strokeStyle = `rgba(255, ${140 + Math.round(k * 100)}, 60, ${0.5 + k * 0.5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + this.x * 0.01;
        const len = c.bite.radius * s * k;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(a) * len * 0.5 + Math.sin(a * 3) * 6, this.y + Math.sin(a) * len * 0.28);
        ctx.lineTo(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len * 0.55);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (this.path && !this.struck && !this.dead) {
      const k = clamp((this.sHead - (this.outS - 20 * s)) / Math.max(1, this.hitS - this.outS + 20 * s), 0, 1);
      Telegraph.circle(ctx, this.flyTo.x, this.flyTo.y, this.strike.radius, k, '255, 120, 40');
    }
    if (this.rooted) FlamewormBody.drawHole(ctx, { x: this.x, y: this.y, s, seed: Math.round(this.x + this.y) }, this.holeOpen(), time, false);
    if (this.state === 'arrow' && this.arrowAt) {
      Telegraph.circle(ctx, this.arrowAt.x, this.arrowAt.y, c.arrow.blastRadius, clamp(this.t / c.arrow.windup, 0, 1), '255, 120, 40');
    }
  }

  /** How open the hole it's rooted in is (it tears open as it bursts up). */
  holeOpen() {
    return this.holeBorn === undefined ? 1 : clamp((this.boss.time - this.holeBorn) / 0.15, 0, 1);
  }

  /**
   * A hole torn in the floor: a pit glowing with lava, ringed with broken rock and brick heaved up round it.
   * front = the near half of the ring (drawn over the worm's body), else the pit and the far half. k = how open.
   */
  static drawHole(ctx, h, k, time, front) {
    if (k <= 0) return;
    const s = h.s * (0.6 + 0.4 * k);
    const rocks = Sprites.flameworm.rocks;
    if (!front) {
      PFX.disc(ctx, h.x, h.y + 2, 40 * s, 15 * s, '#1a0a0a');
      PFX.disc(ctx, h.x, h.y + 3, 30 * s, 10 * s, '#5a1006');
      PFX.disc(ctx, h.x, h.y + 4, 20 * s, 6 * s, '#c43a16');
      PFX.disc(ctx, h.x, h.y + 4, 9 * s, 3 * s, '#ffb52e');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, h.x, h.y, 50 * s, FORT_LAVA, 0.4 * k + Math.sin(time * 3 + h.seed) * 0.05, 2, 20 * s);
      ctx.restore();
    }
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + (h.seed % 7) * 0.3;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const img = rocks[(i + h.seed) % rocks.length];
      const sc = s * (0.8 + ((i * 7 + h.seed) % 5) * 0.08);
      const rx = 36 * s + ((i * 3) % 4) * s;
      const x = h.x + Math.cos(a) * rx;
      const y = h.y + Math.sin(a) * 14 * s - (isFront ? 0 : 4 * s);
      const w = img.width * sc;
      const hh = img.height * sc;
      ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - hh * 0.8), Math.round(w), Math.round(hh));
    }
  }

  /** Its mound while it burrows: a dome of broken rock heaving and churning over it, lava glowing through. */
  drawMound(ctx, time) {
    const s = this.scale;
    const rocks = Sprites.flameworm.rocks;
    PFX.disc(ctx, this.x, this.y + 2, 32 * s, 12 * s, '#1a0a0a');
    PFX.disc(ctx, this.x, this.y, 22 * s, 8 * s, '#a8200e');
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 150, 60, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + time * 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * 12 * s, this.y + Math.sin(a) * 4 * s);
      ctx.lineTo(this.x + Math.cos(a + 0.2) * 38 * s, this.y + Math.sin(a + 0.2) * 14 * s);
      ctx.stroke();
    }
    ctx.restore();
    // the rocks of the dome, the far ones first: they tumble round as it ploughs on and bob as it heaves
    const list = [];
    for (let i = 0; i < 21; i++) {
      // a heap: one big rock on top, rings of smaller ones down its sides, rubble round its foot
      const rr = i === 0 ? 0 : i < 6 ? 0.4 : i < 13 ? 0.72 : 1;
      const a = i * 2.39 + time * (1.5 - rr) * (i % 2 ? 1 : 0.7);
      const x = this.x + Math.cos(a) * rr * 30 * s;
      const y = this.y + Math.sin(a) * rr * 12 * s;
      const z = (1 - rr * rr) * 24 * s + Math.abs(Math.sin(time * 11 + i * 1.3)) * (rr < 1 ? 6 : 2) * s;
      list.push({ x, y, z, img: rocks[(i * 5) % rocks.length], sc: s * (1.25 - rr * 0.5) });
    }
    list.sort((a, b) => a.y - b.y || a.z - b.z);
    for (const r of list) {
      const w = r.img.width * r.sc;
      const h = r.img.height * r.sc;
      ctx.drawImage(r.img, Math.round(r.x - w / 2), Math.round(r.y - r.z - h * 0.7), Math.round(w), Math.round(h));
    }
  }

  /** Its body: the plated segments along its spine, tail first, then its head with the jaw hanging open. */
  drawBody(ctx, time) {
    const J = this.joints;
    if (!J.length) return;
    const S = Sprites.flameworm;
    const s = this.scale;
    const flash = this.flashTime > 0;
    const flip = this.facing < 0;
    const glow = this.state === 'splitting' ? Math.min(1, this.t / this.cfg.split.time) : 0;
    const draw = (img, j, sc, px, py, rot = 0) => {
      // what's below its own spot on the floor is underground: cut off
      const low = j.z < 40 * s;
      ctx.save();
      if (low) { ctx.beginPath(); ctx.rect(j.x - 200, j.y - j.z - 400, 400, 400 + j.z + 3); ctx.clip(); }
      ctx.translate(j.x, j.y - j.z);
      ctx.rotate(j.a + rot);
      if (flip) ctx.scale(1, -1);
      ctx.scale(sc, sc);
      ctx.drawImage(img, -px, -py);
      if (flash || glow) { ctx.globalAlpha = flash ? 0.6 : glow * 0.8; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, -px, -py); }
      ctx.restore();
    };
    for (let i = WORM_JOINTS - 1; i >= 1; i--) {
      const j = J[i];
      if (j.z < -30 * s) continue;
      const k = i / WORM_JOINTS;
      const sc = s * (1 - 0.38 * k * k);
      if (i === WORM_JOINTS - 1) { draw(S.tail, j, sc, 30, 20); continue; }
      const img = S.segments[i % S.segments.length];
      draw(img, j, sc, 13, 25);
    }
    // its molten pustules pulsing, a beat running up its body
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < WORM_JOINTS - 1; i++) {
      const j = J[i];
      if (j.z < 4 * s || i % 4 !== 1) continue;
      const beat = 0.5 + 0.5 * Math.sin(time * 5 + i * 0.7);
      PFX.glow(ctx, j.x, j.y - j.z, (7 + beat * 5 + glow * 10) * s, FORT_LAVA, 0.3 + beat * 0.35 + glow * 0.5);
    }
    ctx.restore();
    // the head: the throat, the jaw swung open on its hinge, the skull over them
    const h = J[0];
    if (h.z > -40 * s) {
      const H = WORM_HEAD;
      const low = h.z < 50 * s;
      ctx.save();
      if (low) { ctx.beginPath(); ctx.rect(h.x - 200, h.y - h.z - 400, 400, 400 + h.z + 3); ctx.clip(); }
      ctx.translate(h.x, h.y - h.z);
      ctx.rotate(h.a);
      if (flip) ctx.scale(1, -1);
      ctx.scale(s * H.scale, s * H.scale);
      const parts = (glowing) => {
        ctx.save();
        ctx.translate(H.hinge[0], H.hinge[1]);
        ctx.save(); ctx.rotate(this.jaw * 0.5); ctx.drawImage(S.throat, H.throat[0] - 4, H.throat[1] - 6); ctx.restore();
        ctx.save(); ctx.rotate(this.jaw); ctx.drawImage(S.jaw, -H.jaw[0], -H.jaw[1]); ctx.restore();
        ctx.save(); ctx.rotate(-this.jaw * 0.25); ctx.drawImage(S.skull, -H.skull[0], -H.skull[1]); ctx.restore();
        ctx.restore();
        if (glowing) return;
        // its maw glowing with the fire in its throat
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, H.hinge[0] + 16, H.hinge[1] + 4, 10 + this.jaw * 22, FORT_LAVA, 0.25 + this.jaw * 0.5);
        ctx.restore();
      };
      parts(false);
      if (flash || glow) { ctx.globalAlpha = flash ? 0.6 : glow * 0.8; ctx.globalCompositeOperation = 'lighter'; parts(true); }
      ctx.restore();
    }
    if (this.state === 'arrow') this.drawArrowForming(ctx, time);
  }

  /** The divine flame arrow forming in its jaws: fire gathering in, the arrow taking shape and burning brighter. */
  drawArrowForming(ctx, time) {
    const k = clamp(this.t / this.cfg.arrow.windup, 0, 1);
    const m = this.mouth;
    const to = this.arrowAt || { x: m.x, y: m.y + 100 };
    const a = angleTo(m.x, m.y, to.x, to.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, m.x, m.y, 14 + k * 34, '255, 140, 50', 0.4 + k * 0.6);
    PFX.glow(ctx, m.x, m.y, 6 + k * 12, '255, 240, 200', 0.9);
    // tongues of fire spiralling in to it
    for (let i = 0; i < 6; i++) {
      const u = (time * 1.6 + i / 6) % 1;
      const ang = i * 1.05 + time * 5;
      const r = (1 - u) * (60 - k * 20);
      PFX.disc(ctx, m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r * 0.7, 3 + u * 2, 3 + u * 2, u > 0.6 ? '#ffd34a' : '#ff8a1e');
    }
    ctx.restore();
    const img = Sprites.projectiles.wormArrow;
    const sc = 0.4 + k * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.35 + k * 0.65;
    ctx.translate(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14);
    ctx.rotate(a);
    ctx.scale(sc, sc);
    ctx.drawImage(img, -img.width * 0.35, -img.height / 2);
    ctx.restore();
    PFX.flame(ctx, m.x, m.y + 6, 10 + k * 8, 14 + k * 18, time, FORT_FIRE);
  }
}

class Flameworm {
  constructor(x, y) {
    const c = CONFIG.flameworm;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.time = 0;
    this.intro = FLAMEWORM_INTRO.total;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.split = false;
    this.holes = [];        // holes torn in the floor by its dives and leaps, closing up again
    this.trail = [];        // the molten rock behind its burrows, cooling
    this.worms = [new FlamewormBody(this, x, y, c.hp, 1)];
    this.worms[0].state = 'intro';
    this.worms[0].holeBorn = FLAMEWORM_INTRO.burst;
    // a stand-in worm, reared up with its maw open, for its title card
    this.portrait = new FlamewormBody(this, x, y, 1, 1);
    Object.assign(this.portrait, { rise: 1, state: 'spray', aim: 0.3, jaw: 0.7 });
    this.portrait.pose(0);
  }

  get name() { return 'THE DECRONIC FLAMEWORM'; }
  get title() { return 'Terror beneath the Fiery Fortress'; }
  get defeatText() { return 'The Flameworm sinks back into the lava for good.'; }

  /** Its health: what every worm still has, together. */
  get hp() { return this.worms.reduce((s, w) => s + Math.max(0, w.hp), 0); }
  set hp(v) {
    // (a cheat or the showcase setting its health spreads it over the worms still alive)
    const alive = this.worms.filter((w) => !w.dead);
    const now = this.hp;
    for (const w of alive) w.hp = now > 0 ? (w.hp / now) * v : v / alive.length;
  }
  get hx() { return this.worms.find((w) => !w.dead)?.hx ?? this.x; }
  get hy() { return this.worms.find((w) => !w.dead)?.hy ?? this.y; }
  get drawY() { return this.y; }

  get targetable() { return this.worms.some((w) => w.targetable); }
  getTargets() { return this.intro > 0 || this.dying > 0 ? [] : this.worms.filter((w) => w.targetable); }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    return this.worms.filter((w) => !w.dead).map((w) => {
      const top = w.exposed ? w.head.y - 46 * w.scale : w.y - 30;
      const x = w.exposed ? w.head.x : w.x;
      const buried = ['under', 'gap', 'surface'].includes(w.state);
      return { part: w, x, y: top, w: Math.round(100 * w.scale), color: '#ff8a2a', marker: this.split ? undefined : this.cfg.splitAt, locked: buried || w.state === 'splitting', lockedText: buried ? 'BURROWED' : 'SPLITTING' };
    });
  }

  scaleHealth(k) {
    this.maxHp = Math.round(this.cfg.hp * k);
    for (const w of this.worms) { w.maxHp = this.maxHp; w.hp = this.maxHp; }
  }

  knockback() {}
  stun() {}
  takeDamage() { return false; }   // (the worms are what's hit)

  /** Below splitAt of its health the worm convulses (finishSplit tears it apart a moment later). */
  checkSplit(world) {
    if (this.split || this.hp > this.maxHp * this.cfg.splitAt) return;
    this.split = true;
    const old = this.worms[0];
    old.setState('splitting');
    world.banner('THE FLAMEWORM SPLITS!', 'Three worms burrow away - each has its own health');
    world.shake(6, 0.5);
    Sound.play('bossRoar');
  }

  /** It tears apart: three smaller worms, each with a share of what's left, rear up out of its hole and plunge away. */
  finishSplit(world, old) {
    const c = this.cfg;
    const share = Math.max(1, Math.round(old.hp / c.splitCount));
    const spot = old.keepInside(world, old.path ? { x: old.hit.gx, y: old.hit.gy } : { x: old.x, y: old.y }, 60);
    const p = world.player;
    const base = p.dead ? Math.PI / 2 : angleTo(spot.x, spot.y, p.x, p.y);
    this.worms = [];
    for (let i = 0; i < c.splitCount; i++) {
      const a = base + (i - (c.splitCount - 1) / 2) * (TAU / c.splitCount);
      const w = new FlamewormBody(this, spot.x, spot.y, share, c.splitScale);   // a full bar each, together what the worm had left
      w.aim = a;
      w.facing = Math.cos(a) >= 0 ? 1 : -1;
      w.attacked = true;
      w.plungeTo = { x: spot.x + Math.cos(a) * c.split.spread, y: spot.y + Math.sin(a) * c.split.spread * 0.7 };
      w.afterPlunge = 'under';
      w.digAfter = 0.6 + i * 0.7;   // out of step: they come up one after another
      w.holeBorn = this.time;
      w.setState('birth');
      w.pose(world.time);
      this.worms.push(w);
    }
    const h = old.head;
    world.effects.burst(h.x, h.y, { count: 70, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS, '#fff6c8'], speed: [120, 360], life: [0.5, 1.1], gravity: 380, size: [3, 6] });
    wormRocks(world, spot.x, spot.y, 22, 1.4, 1);
    enemyBlastFx(world, spot.x, spot.y, 120);
    world.shake(12, 0.6);
    Sound.play('bossRoar');
    Sound.play('rockErupt');
  }

  /** A worm has fallen: the last one ends the fight. */
  onWormDown(w, world) {
    w.sinking = 2;
    this.lastDown = w;
    world.effects.burst(w.head.x, w.head.y, { count: 40, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [80, 260], life: [0.4, 0.9], gravity: 380, size: [2, 5] });
    Sound.play('partBreak');
    if (this.worms.some((o) => !o.dead)) {
      world.effects.text(w.head.x, w.head.y - 30, 'A WORM FALLS', { color: '#ffb52e', size: 9, life: 1.4 });
      return;
    }
    this.die(world);
  }

  update(dt, world) {
    this.time += dt;
    const T = this.cfg.trailTime;
    while (this.trail.length && this.time - this.trail[0].t > T) this.trail.shift();
    if (this.trail.length) this.trail[0].prev = null;   // (so the cooled run behind it can go)
    this.holes = this.holes.filter((h) => h.until > this.time);
    if (this.intro > 0) return this.updateIntro(dt, world);
    for (const w of this.worms) w.update(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    for (const w of this.worms) w.contactDamage(world);
  }

  /** The entrance: the floor of its arena trembles and cracks, then it bursts up through the middle and roars. */
  updateIntro(dt, world) {
    this.intro -= dt;
    const w = this.worms[0];
    const at = FLAMEWORM_INTRO.total - this.intro;
    if (at < FLAMEWORM_INTRO.burst) {
      w.rise = 0;
      if (vrand(0, 1) < 0.6) world.effects.burst(this.x + vrand(-90, 90), this.y + vrand(-40, 40), { count: 1, colors: [...FORT_ROCK_GIBS, '#ff7a1a'], speed: [20, 80], life: [0.3, 0.6], up: 60, gravity: 300 });
      if (vrand(0, 1) < dt * 6) world.shake(3, 0.2);
    } else {
      if (!this.burst) {
        this.burst = true;
        w.holeBorn = this.time;
        world.effects.burst(this.x, this.y - 10, { count: 60, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [120, 360], life: [0.5, 1.1], up: 200, gravity: 420, size: [2, 6] });
        wormRocks(world, this.x, this.y, 20, 1.4, 1);
        world.shake(12, 0.6);
        Sound.play('rockErupt');
      }
      const k = Math.min(1, (at - FLAMEWORM_INTRO.burst) / (FLAMEWORM_INTRO.rise - FLAMEWORM_INTRO.burst));
      w.rise = 1 - (1 - k) ** 3;
      if (!this.roared && at >= FLAMEWORM_INTRO.rise) { this.roared = true; Sound.play('bossRoar'); }
    }
    w.sway += dt * 1.6;
    w.jaw += ((at >= FLAMEWORM_INTRO.rise ? 0.95 : 0.4) - w.jaw) * Math.min(1, dt * 10);
    w.pose(world.time);
    if (this.intro <= 0) { w.rise = 1; w.setState('up'); }
  }

  die(world) {
    this.dying = 2.6;
    Sound.play('bossRoar');
    world.banner('THE FLAMEWORM FALLS!', '');
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.burstT = (this.burstT || 0) - dt;
    const last = this.lastDown || this.worms[this.worms.length - 1];
    if (this.burstT <= 0) {
      this.burstT = 0.2;
      const h = last.head;
      world.effects.burst(h.x + rand(-30, 30), h.y + rand(-20, 60), { count: 12, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [60, 200], life: [0.3, 0.7], gravity: 400, size: [2, 5] });
      world.shake(5, 0.2);
      Sound.play('partBreak', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(last.x, last.y - 20, { count: 90, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS, '#fff6c8'], speed: [100, 340], life: [0.6, 1.4], gravity: 380, size: [3, 6] });
      enemyBlastFx(world, last.x, last.y, 110);
      if (world.run) world.run.rubble.push(...Array.from({ length: 6 }, (_, i) => ({ x: last.x + (i - 2.5) * 12, y: last.y + (i % 2) * 8, material: 'stone', seed: i * 5 + 3 })));
      world.shake(14, 0.7);
      world.onBossDefeated();
    }
  }

  drawGround(ctx) {
    this.drawTrail(ctx);
    for (const h of this.holes) FlamewormBody.drawHole(ctx, h, this.holeK(h), this.time, false);
    if (this.intro > 0 && this.worms[0].rise <= 0) {
      // the floor cracking open over it during its entrance
      const k = clamp((FLAMEWORM_INTRO.total - this.intro) / FLAMEWORM_INTRO.burst, 0, 1);
      Telegraph.circle(ctx, this.x, this.y, this.cfg.bite.radius, k, '255, 120, 40');
      return;
    }
    for (const w of this.worms) w.drawGround(ctx, this.time);
  }

  /** How open a hole is: torn open in a blink, closing up (the rocks settling back) at the end. */
  holeK(h) {
    return Math.min(clamp((this.time - h.born) / 0.15, 0, 1), clamp((h.until - this.time) / 0.6, 0, 1));
  }

  /** The molten rock behind its burrows: a seam of glowing rock in a crust of black, cooling from white-gold to dull red. */
  drawTrail(ctx) {
    const T = this.cfg.trailTime;
    const tr = this.trail;
    if (!tr.length) return;
    // each point, and the run back to the one before it, filled in every few px so the seam is unbroken
    const along = (fn) => {
      for (const p of tr) {
        const age = this.time - p.t;
        if (age >= T) continue;
        const q = p.prev && dist(p.prev.x, p.prev.y, p.x, p.y) < 60 ? p.prev : null;
        const n = q ? Math.max(1, Math.round(dist(q.x, q.y, p.x, p.y) / 3)) : 1;
        for (let i = 0; i < n; i++) {
          const u = q ? i / n : 1;
          fn(q ? lerp(q.x, p.x, u) : p.x, q ? lerp(q.y, p.y, u) : p.y, age, p, i);
        }
      }
    };
    along((x, y, age, p, i) => {
      const k = 1 - age / T;
      ctx.globalAlpha = Math.min(1, k * 2);
      PFX.disc(ctx, x, y + 1, (8 + 6 * k) * p.s, (4 + 3 * k) * p.s, '#22100c');
    });
    along((x, y, age, p, i) => {
      const k = 1 - age / T;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      const col = age < 0.5 ? '#fff6c8' : age < 1.1 ? '#ffd34a' : age < 1.7 ? '#ff8a1e' : age < 2.3 ? '#e0461e' : '#a8200e';
      PFX.disc(ctx, x, y, (3 + 5 * k) * p.s, (1.5 + 2.5 * k) * p.s, col);
      // lumps of cooling crust breaking its surface
      if (i === 0 && p.seed % 2) PFX.disc(ctx, x + ((p.seed % 5) - 2) * 3 * p.s, y - 1, (2 + 2 * (1 - k)) * p.s, 2 * p.s, '#3e1a12');
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = tr.length - 1; i >= 0; i -= 2) {
      const age = this.time - tr[i].t;
      if (age > 1.6) break;
      PFX.glow(ctx, tr[i].x, tr[i].y, 18 * tr[i].s, FORT_LAVA, 0.4 * (1 - age / 1.6), 2, 8 * tr[i].s);
    }
    ctx.restore();
  }

  getDrawables() {
    if (this.dead) return [];
    const out = [];
    for (const h of this.holes) out.push({ y: h.y + 6, draw: (ctx) => FlamewormBody.drawHole(ctx, h, this.holeK(h), this.time, true) });
    for (const w of this.worms) {
      if (w.dead && !w.exposed && !w.joints.some((j) => j.z > -20)) continue;
      if (w.state === 'under' || w.state === 'gap') { out.push({ y: w.y + 8, draw: (ctx) => w.drawMound(ctx, this.time) }); continue; }
      if (w.state === 'surface') continue;
      if (this.intro > 0 && w.rise <= 0) continue;
      const y = w.path ? Math.min(w.flyFrom.y, w.flyTo.y) + 4 : w.y + 4;
      out.push({ y, draw: (ctx) => w.drawBody(ctx, this.time) });
      if (w.rooted) out.push({ y: w.y + 6, draw: (ctx) => FlamewormBody.drawHole(ctx, { x: w.x, y: w.y, s: w.scale, seed: Math.round(w.x + w.y) }, w.holeOpen(), this.time, true) });
    }
    return out;
  }

  drawOverlay() {}

  /** Its title card portrait: one worm, reared up, maw open. */
  drawPortrait(ctx) { this.portrait.drawBody(ctx, this.time); }
}
