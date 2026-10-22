// =============================================================
//  THE QUEEN (the castle's garden)
//
//  Her magic umbrella is always open, twirling, wrapped in a violet aura: over her
//  shoulder as she walks, overhead as she floats down out of the night sky at the
//  start, and spinning through the air when she throws it. The garden's hedges grow
//  up round her in a fixed pattern.
//  Phase 1: she walks toward you and takes turns between:
//    - throwing her umbrella: it flies at you (she steers it after you), stops and
//      spins spraying rings of magic, turning clockwise one time and anticlockwise the
//      next; after a few stops it flies back to her hand
//    - fans of homing bolts that chase the nearest hero for a few seconds
//  The umbrella can't pass through hedges: it bounces off them.
//  At half health she glides to the bell in the middle of the garden and rings it
//  (she can't be hurt while she does). Phase 2: she runs after you, and the hedges
//  change pattern every so often. Her one attack is the blink: she throws her
//  umbrella, it flies after you shooting bolts out of its sides, then (telegraphed)
//  she blinks to it, a magic shockwave bursts where she lands and a ring of
//  bolts follows. Hit her while it's in her hand and she holds it out before her:
//  every hit on it heals her. Each time the bell tolls, her gardeners come through
//  the rose gates.
//  (x, y) is her feet. The garden's bell and gates are decor (see CastleDecor).
// =============================================================

// the entrance: she floats down from the sky under her umbrella and lands (seconds)
const QUEEN_INTRO = { descend: 2.1, total: 2.7, height: 320 };
const QUEEN_HAND = { x: 20, y: -38 };      // her hand held out in front (guarding), from her feet facing right
const QUEEN_HAND_UP = { x: 14, y: -66 };   // ...raised over her head
const QUEEN_HOLD = { x: 15, y: -56 };      // ...at her shoulder, holding the umbrella as she walks

/**
 * The garden's hedge layouts, as runs of hedge tiles from the room's middle tile:
 * [dx, dy, length, 'h' (along) | 'v' (down)]. The first stands from the start; in
 * phase 2 she cycles through the rest. Tiles too near the bell, the gates, the doors
 * or anyone standing there are left out when they grow.
 */
const QUEEN_HEDGES = [
  // a formal parterre: long beds above and below the bell, short walls out to the sides
  [[-10, -7, 6, 'h'], [5, -7, 6, 'h'], [-10, 7, 6, 'h'], [5, 7, 6, 'h'], [-12, -3, 5, 'v'], [12, -3, 5, 'v']],
  // staggered posts: walls down the middle of each quarter and bars across the flanks
  [[-8, -9, 4, 'v'], [8, -9, 4, 'v'], [-8, 5, 4, 'v'], [8, 5, 4, 'v'], [-13, 3, 4, 'h'], [10, -4, 4, 'h']],
  // a broken ring round the bell
  [[-11, -4, 4, 'h'], [8, -4, 4, 'h'], [-11, 4, 4, 'h'], [8, 4, 4, 'h'], [-4, -9, 3, 'v'], [4, 7, 3, 'v']],
  // corridors: long walls either side of the bell, short bars top and bottom
  [[-6, -2, 5, 'v'], [6, -2, 5, 'v'], [-3, -8, 6, 'h'], [-2, 8, 6, 'h'], [-13, -6, 3, 'h'], [11, 5, 3, 'h']],
];

class Queen {
  constructor(x, y) {
    const c = CONFIG.queen;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 22;
    this.hw = 11;
    this.hh = 7;
    this.time = 0;
    this.phase = 1;
    this.intro = QUEEN_INTRO.total;
    this.introAt = 0;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = -1;
    this.moving = false;
    // walk | homingWindup | homing | throwWindup | conduct | blinkWarn | burst | parasolWindup | parasol | toBell | bell
    this.state = 'walk';
    this.t = 0;
    this.attackTimer = 1.2;
    this.attackStep = 0;
    this.aim = 0;
    this.strafe = 1;
    this.brolly = null;        // her thrown umbrella: { state: 'fly' | 'open' | 'back' | 'wait', x, y, ... }
    this.spinDir = 1;          // which way the umbrella's magic turns next time it stops (1 = clockwise)
    this.parasolCd = 0;
    this.hedges = [];          // { tiles: [{ tx, ty }], t, up, withering }
    this.layout = -1;          // which QUEEN_HEDGES pattern is growing
    this.shuffleTimer = 0;
    this.tollTimer = 0;
  }

  get name() { return 'THE QUEEN'; }
  get title() { return 'Thorned Sovereign of the Fallen Court'; }
  get defeatText() { return 'The Queen has fallen among her roses.'; }

  get hx() { return this.x; }
  get hy() { return this.y - 44; }
  /** Per-phase value from a [phase 1, phase 2] pair. */
  P(list) { return Array.isArray(list) ? list[this.phase - 1] : list; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead && this.state !== 'bell' && this.state !== 'toBell'; }
  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    return [{ part: this, x: this.x, y: this.y - 104, w: 90, color: '#c46aff', marker: [this.cfg.phase2At] }];
  }

  knockback() {}
  stun() {}

  /** Bishops can mend her (and so can her umbrella, held out to guard her). */
  heal(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) world.effects.text(this.hx, this.hy - 40, `+${Math.round(this.hp - before)}`, { color: '#8cf08a', size: 9 });
  }

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    if (this.state === 'parasol') {
      // her umbrella, held out before her, drinks the blow: no harm done, and it mends her instead
      const u = this.heldUmbrella();
      this.heal(amount * this.cfg.parasol.healRatio, world);
      world.effects.burst(u.cx, u.cy, { count: 8, colors: ['#ffe680', '#f0c8ff', '#8cf08a'], speed: [40, 120], life: [0.2, 0.4] });
      Sound.play('blessing', 0.08);
      return false;
    }
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.startBell(world);
    else if (this.phase === 2 && this.state === 'walk' && !this.brolly && this.parasolCd <= 0) {
      this.setState('parasolWindup');
      Sound.play('magic');
    }
    return true;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  get room() { return this.roomRef; }

  /** The garden's bell and rose gates (placed by CastleDecor), and her room. */
  findGarden(world) {
    if (this.garden) return this.garden;
    const run = world.run;
    const items = run ? run.decor.items : [];
    const f = world.dungeon;
    this.roomRef = f.roomAt ? f.roomAt(this.x, this.y) : null;
    this.garden = {
      bell: items.find((d) => d.kind === 'gardenBell') || { x: this.x, y: this.y - 80 },
      gates: items.filter((d) => d.kind === 'roseGate'),
    };
    return this.garden;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.flashTime -= dt;
    this.findGarden(world);
    if (this.layout < 0) this.growLayout(world, 0);   // the garden's hedges rise as she arrives
    this.updateHedges(dt, world);
    if (this.intro > 0) return this.updateIntro(dt, world);
    this.updateBrolly(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.t += dt;
    this.moving = false;
    this.parasolCd -= dt;
    switch (this.state) {
      case 'walk': this.updateWalk(dt, world); break;
      case 'homingWindup': this.updateHomingWindup(dt, world); break;
      case 'homing': this.updateHoming(dt, world); break;
      case 'throwWindup': this.updateThrowWindup(dt, world); break;
      case 'conduct': this.updateConduct(dt, world); break;
      case 'blinkWarn': this.updateBlinkWarn(dt, world); break;
      case 'burst': this.updateBurst(dt, world); break;
      case 'parasolWindup': this.updateParasol(dt, world); break;
      case 'parasol': this.updateParasol(dt, world); break;
      case 'toBell': this.updateToBell(dt, world); break;
      case 'bell': this.updateBell(dt, world); break;
    }
    if (this.phase === 2 && this.state !== 'bell' && this.state !== 'toBell') this.updatePhase2Garden(dt, world);
    this.contactDamage(world);
  }

  /** A step in direction a; if a hedge or wall is in the way, she goes round it. */
  stepToward(world, a, speed, dt) {
    const x0 = this.x;
    const y0 = this.y;
    world.dungeon.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (dist(x0, y0, this.x, this.y) < speed * dt * 0.3) {
      const x1 = this.x;
      const y1 = this.y;
      const side = a + (Math.PI / 2) * this.strafe;
      world.dungeon.move(this, Math.cos(side) * speed * dt, Math.sin(side) * speed * dt);
      if (dist(x1, y1, this.x, this.y) < speed * dt * 0.2) this.strafe *= -1;
    }
    this.moving = dist(x0, y0, this.x, this.y) > 0.1;
  }

  /** Comes after her target (walking in phase 1, running in phase 2), circling once she's close. */
  chase(world, dt, speedScale = 1) {
    const p = world.player;
    if (p.dead) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const toward = angleTo(this.x, this.y, p.x, p.y);
    const near = this.P(this.cfg.keepAway);
    const speed = this.P(this.cfg.speed) * speedScale;
    if (d > near) this.stepToward(world, toward, speed, dt);
    else this.stepToward(world, toward + (Math.PI / 2) * this.strafe, speed * 0.4, dt);
  }

  updateWalk(dt, world) {
    const p = world.player;
    if (p.dead) return;
    this.chase(world, dt);
    this.facing = p.x >= this.x ? 1 : -1;
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      // phase 1 alternates the umbrella and homing bolts; phase 2 only ever blinks
      const kind = this.phase === 2 ? 'umbrella' : ['umbrella', 'homing'][this.attackStep++ % 2];
      if (kind === 'umbrella') { this.setState('throwWindup'); Sound.play('fistCharge'); }
      else { this.setState('homingWindup'); Sound.play('laserCharge', 0.2); }
    }
  }

  // ---------- the umbrella in her hand ----------

  /**
   * Where her umbrella is while she holds it: the hand, the shaft's angle (0 = upright),
   * where the canopy's rim sits (px, py) and the canopy's middle (cx, cy, where her magic
   * comes from). Over her shoulder as she walks, overhead while she reaches up, held out
   * before her like a shield while she guards.
   */
  heldUmbrella(x = this.x, y = this.y) {
    const f = this.facing;
    let hand;
    let angle;
    let shaft;
    if (this.state === 'parasolWindup' || this.state === 'parasol') {
      const k = this.state === 'parasol' ? 1 : Math.min(1, this.t / this.cfg.parasol.windup);
      hand = QUEEN_HAND;
      angle = f * (Math.PI / 2) * k - f * 0.35 * (1 - k);
      shaft = 6;
    } else if (this.frameKind() === 'reach') {
      hand = QUEEN_HAND_UP;
      angle = Math.sin(this.time * 2) * 0.12;
      shaft = 22;
    } else {
      hand = QUEEN_HOLD;
      angle = -f * 0.38 + Math.sin(this.time * 2.2) * 0.05;   // leaned back over her shoulder
      shaft = 26;
    }
    const hx = x + hand.x * f;
    const hy = y + hand.y;
    const ux = Math.sin(angle);
    const uy = -Math.cos(angle);
    const px = hx + ux * shaft;
    const py = hy + uy * shaft;
    return { hx, hy, angle, px, py, cx: px + ux * 10, cy: py + uy * 10 };
  }

  /** Where her magic comes from: the middle of her umbrella's canopy. */
  get tipX() { return this.heldUmbrella().cx; }
  get tipY() { return this.heldUmbrella().cy; }

  // ---------- homing bolts (phase 1) ----------

  updateHomingWindup(dt, world) {
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    if (this.t >= this.cfg.homing.windup) { this.setState('homing'); this.waves = 0; this.waveTimer = 0; }
  }

  updateHoming(dt, world) {
    const h = this.cfg.homing;
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    this.aim = angleTo(this.tipX, this.tipY, p.hx, p.hy);
    this.waveTimer -= dt;
    if (this.waveTimer <= 0 && this.waves < h.waves) {
      this.waveTimer = h.waveEvery;
      this.waves++;
      const spread = h.spreadDegrees * DEG;
      const step = spread / (h.perWave - 1);
      for (let i = 0; i < h.perWave; i++) {
        this.fireHoming(world, this.aim - spread / 2 + step * i + (this.waves % 2 ? step / 2 : 0) - step / 4);
      }
      world.effects.burst(this.tipX, this.tipY, { count: 10, colors: ['#ff6ad8', '#f0c8ff', '#ffffff'], speed: [40, 140], life: [0.2, 0.4] });
      Sound.play('magic');
    }
    if (this.waves >= h.waves && this.waveTimer <= 0) this.toWalk();
  }

  /** A magic bolt that chases the nearest hero for `chase` seconds, turning only so fast. */
  fireHoming(world, angle) {
    const h = this.cfg.homing;
    let chase = h.chase;
    world.enemyProjectiles.push(new Projectile({
      x: this.tipX, y: this.tipY, vx: Math.cos(angle) * h.speed, vy: Math.sin(angle) * h.speed,
      radius: 5, damage: h.damage, life: h.life, friendly: false,
      sprite: Sprites.projectiles.queenMagic, spin: 6, glow: '255, 110, 220', trail: ['#ff6ad8', '#f0c8ff'],
      homing: (pr, dt, w) => {
        chase -= dt;
        if (chase <= 0) return;
        const t = w.nearestHero(pr.x, pr.y);
        if (!t || t.dead) return;
        const cur = Math.atan2(pr.vy, pr.vx);
        const a = cur + clamp(angleDiff(cur, angleTo(pr.x, pr.y, t.hx, t.hy)), -h.turn * dt, h.turn * dt);
        pr.vx = Math.cos(a) * h.speed;
        pr.vy = Math.sin(a) * h.speed;
      },
    }));
  }

  /** A magic bolt in a straight line (the umbrella's sprays, the rings after a blink). */
  fireBolt(world, x, y, angle, speed, damage, spin = 6) {
    world.enemyProjectiles.push(new Projectile({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, damage, life: 4, friendly: false,
      sprite: Sprites.projectiles.queenMagic, spin, glow: '255, 110, 220', trail: ['#ff6ad8', '#f0c8ff'],
    }));
  }

  toWalk() {
    this.setState('walk');
    this.attackTimer = this.P(this.cfg.attackInterval);
    if (Math.random() < 0.5) this.strafe *= -1;
  }

  // ---------- the thrown umbrella ----------

  /** She raises the umbrella over her head, twirling it faster, then flings it at you, still open. */
  updateThrowWindup(dt, world) {
    const p = world.player;
    this.facing = p.x >= this.x ? 1 : -1;
    if (this.t < this.cfg.umbrella.windup) return;
    const u = this.heldUmbrella();
    // it leaves from beside her, or from her feet if she's backed up against a hedge
    const sx = world.dungeon.isSolidAt(u.px, this.y - 4) ? this.x : u.px;
    const a = angleTo(sx, this.y, p.x, p.y);
    this.brolly = { state: 'fly', x: sx, y: this.y - 4, angle: a, t: 0, stop: 0, shot: 0, base: 0, dir: 1, side: 0, hit: new Set(), stuck: 0 };
    Sound.play('fistLaunch');
    world.effects.burst(u.cx, u.cy, { count: 12, colors: ['#ff6ad8', '#f0c8ff', '#ffffff'], speed: [40, 140], life: [0.2, 0.4] });
    this.setState('conduct');
  }

  /** While her umbrella is away she conducts it, arm raised (in phase 2 running after you). */
  updateConduct(dt, world) {
    const B = this.brolly;
    if (!B) return this.toWalk();
    if (this.phase === 2) {
      this.chase(world, dt);
      this.facing = world.player.x >= this.x ? 1 : -1;
    } else {
      this.facing = B.x >= this.x ? 1 : -1;
    }
  }

  /**
   * Moves the umbrella (its ground point) by (dx, dy) unless a hedge or wall is in the way:
   * it bounces off them instead of passing through. True if it bounced.
   */
  moveBrolly(world, B, dx, dy) {
    const f = world.dungeon;
    if (f.isSolidAt(B.x, B.y)) { B.x += dx; B.y += dy; return false; }   // already inside (a hedge grew round it): let it out
    let bounced = false;
    if (f.isSolidAt(B.x + dx, B.y)) { B.angle = Math.PI - B.angle; bounced = true; } else B.x += dx;
    if (f.isSolidAt(B.x, B.y + dy)) { B.angle = -B.angle; bounced = true; } else B.y += dy;
    if (bounced) world.effects.burst(B.x, B.y - 30, { count: 4, colors: ['#ff6ad8', '#f0c8ff'], speed: [30, 80], life: [0.15, 0.3] });
    return bounced;
  }

  /**
   * The umbrella. Phase 1: flies a leg after the hero (steered), stops and spins, spraying
   * rings of magic that turn one way (then the other way next time); after its last stop it
   * flies home. Phase 2: one long flight after the hero, bolts flying out of its sides, then
   * it hangs spinning while she blinks to it.
   */
  updateBrolly(dt, world) {
    const B = this.brolly;
    if (!B) return;
    const c = this.cfg.umbrella;
    const k = this.cfg.blink;
    B.t += dt;
    const p = world.player;
    switch (B.state) {
      case 'fly': {
        const phase2 = this.phase === 2 && this.state === 'conduct';
        if (p && !p.dead) {
          const want = angleTo(B.x, B.y, p.x, p.y);
          const steer = phase2 ? k.steer : c.steer;
          B.angle += clamp(angleDiff(B.angle, want), -steer * dt, steer * dt);
        }
        const speed = phase2 ? k.speed : c.speed;
        this.moveBrolly(world, B, Math.cos(B.angle) * speed * dt, Math.sin(B.angle) * speed * dt);
        for (const a of world.allies) {
          if (B.hit.has(a) || dist(a.x, a.y, B.x, B.y) > c.radius + (a.radius || 10)) continue;
          B.hit.add(a);
          a.hurt(c.damage, world, B.x, B.y);
        }
        if (phase2) {
          // bolts fly out of both its sides as it goes
          B.side -= dt;
          if (B.side <= 0) {
            B.side = k.sideEvery;
            for (const s of [-1, 1]) this.fireBolt(world, B.x, B.y - 26, B.angle + s * Math.PI / 2, k.sideSpeed, k.sideDamage);
            Sound.play('magic', 0.08);
          }
          if (B.t >= k.leg) { B.state = 'wait'; B.t = 0; this.setState('blinkWarn'); Sound.play('laserCharge', 0.2); }
        } else if (B.t >= c.leg) {
          B.state = 'open';
          B.t = 0;
          B.shot = 0;
          B.base = rand(0, TAU);
          B.dir = this.spinDir;
          this.spinDir = -this.spinDir;   // the next stop turns the other way
          Sound.play('magic');
          world.effects.burst(B.x, B.y - 30, { count: 14, colors: ['#ff6ad8', '#f0c8ff', '#ffffff', '#ecd690'], speed: [60, 160], life: [0.2, 0.5] });
        }
        break;
      }
      case 'open': {
        const at = 0.2 + B.shot * ((c.spin - 0.35) / Math.max(1, c.shots - 1));
        if (B.shot < c.shots && B.t >= at) {
          for (let i = 0; i < c.arms; i++) {
            const a = B.base + (i / c.arms) * TAU;
            this.fireBolt(world, B.x + Math.cos(a) * 14, B.y - 26 + Math.sin(a) * 8, a, c.boltSpeed, c.boltDamage, 6 * B.dir);
          }
          B.base += c.turn * B.dir;
          B.shot++;
          Sound.play('magic', 0.06);
        }
        if (B.t >= c.spin) {
          B.stop++;
          B.t = 0;
          B.hit = new Set();
          if (B.stop < c.stops) B.state = 'fly';
          else { B.state = 'back'; Sound.play('phantomAppear', 0.2); }
        }
        break;
      }
      case 'back': {
        // home to her hand, sliding round any hedge in the way (if it gets stuck, it blinks home)
        const u = this.heldUmbrella();
        const tx = u.px;
        const ty = this.y - 4;
        const d = dist(B.x, B.y, tx, ty);
        const s = Math.min(d, c.back * dt);
        const x0 = B.x;
        const y0 = B.y;
        if (d > 0.5) {
          const f = world.dungeon;
          const nx = B.x + ((tx - B.x) / d) * s;
          const ny = B.y + ((ty - B.y) / d) * s;
          if (!f.isSolidAt(nx, B.y)) B.x = nx;
          if (!f.isSolidAt(B.x, ny)) B.y = ny;
        }
        B.stuck = dist(x0, y0, B.x, B.y) < s * 0.3 ? B.stuck + dt : 0;
        if (d - s < 4 || B.stuck > 0.5 || this.state === 'toBell' || this.state === 'bell') {
          this.brolly = null;
          world.effects.burst(u.cx, u.cy, { count: 10, colors: ['#ff6ad8', '#f0c8ff', '#ecd690'], speed: [30, 100], life: [0.2, 0.4] });
        }
        break;
      }
      case 'wait':
        break;
    }
  }

  // ---------- phase 2: blinking to the umbrella ----------

  /** She shimmers where she stands and a mark glows under the umbrella; then she's there, in a burst of magic. */
  updateBlinkWarn(dt, world) {
    const B = this.brolly;
    if (!B) return this.toWalk();
    const k = this.cfg.blink;
    if (vrand(0, 1) < 0.6) world.effects.burst(this.x + vrand(-14, 14), this.y - vrand(0, 70), { count: 1, colors: ['#c46aff', '#ff6ad8', '#f0c8ff'], speed: [10, 50], life: [0.3, 0.6], up: 30 });
    if (this.t < k.warn) return;
    world.effects.burst(this.x, this.y - 40, { count: 30, colors: ['#c46aff', '#ff6ad8', '#f0c8ff', '#ffffff'], speed: [60, 200], life: [0.3, 0.6] });
    const pt = world.dungeon.freePoint(B.x, B.y, this.hw, this.hh);
    this.x = pt.x;
    this.y = pt.y;
    this.brolly = null;
    world.addShockwave(this.x, this.y, { radius: k.radius, speed: k.speed2, width: k.width, damage: k.damage, color: '220, 120, 255' });
    world.effects.burst(this.x, this.y - 40, { count: 40, colors: ['#c46aff', '#ff6ad8', '#f0c8ff', '#ffffff'], speed: [80, 260], life: [0.3, 0.7] });
    world.shake(7, 0.35);
    Sound.play('phantomAppear');
    Sound.play('impact');
    this.setState('burst');
    this.rings = 0;
    this.ringBase = rand(0, TAU);
  }

  /** Just after a blink: rings of bolts burst out of her umbrella, each turned half a step from the last. */
  updateBurst(dt, world) {
    const k = this.cfg.blink;
    if (this.rings < k.rings && this.t >= this.rings * k.ringGap) {
      const u = this.heldUmbrella();
      const off = this.ringBase + (this.rings % 2 ? Math.PI / k.count : 0);
      for (let i = 0; i < k.count; i++) this.fireBolt(world, u.cx, u.cy, off + (i / k.count) * TAU, k.ringSpeed, k.ringDamage);
      world.effects.burst(u.cx, u.cy, { count: 12, colors: ['#ff6ad8', '#f0c8ff', '#ffffff'], speed: [60, 180], life: [0.2, 0.4] });
      Sound.play('magic');
      this.rings++;
    }
    if (this.t >= k.rings * k.ringGap + 0.25) this.toWalk();
  }

  // ---------- phase 2: guarding behind the umbrella ----------

  updateParasol(dt, world) {
    const c = this.cfg.parasol;
    this.facing = world.player.x >= this.x ? 1 : -1;
    if (this.state === 'parasolWindup') {
      if (this.t >= c.windup) {
        this.setState('parasol');
        Sound.play('blessing');
        world.effects.text(this.hx, this.hy - 56, 'GUARDED', { color: '#ffe680', size: 8 });
      }
      return;
    }
    if (this.t >= c.time) {
      this.parasolCd = c.cooldown;
      this.toWalk();
      this.attackTimer = 0.4;
    }
  }

  // ---------- the bell (phase 2) ----------

  startBell(world) {
    this.phase = 2;
    this.setState('toBell');
    if (this.brolly) this.brolly.state = 'back';
    world.banner('THE QUEEN RETREATS', 'To the garden bell...', 1.8);
    Sound.play('phantomVanish');
  }

  /** Glides fast to the bell, roses trailing. */
  updateToBell(dt, world) {
    const b = this.garden.bell;
    const tx = b.x + 34;
    const ty = b.y + 14;
    const d = dist(this.x, this.y, tx, ty);
    this.facing = b.x >= this.x ? 1 : -1;
    if (d > 4) {
      const s = Math.min(d, 320 * dt);
      this.x += ((tx - this.x) / d) * s;
      this.y += ((ty - this.y) / d) * s;
      this.moving = true;
      if (vrand(0, 1) < 0.6) world.effects.burst(this.x + vrand(-10, 10), this.y - vrand(0, 30), { count: 1, colors: ['#c03048', '#ff6a80', '#8a1a30'], speed: [10, 40], life: [0.5, 0.9], gravity: 60 });
    } else {
      this.setState('bell');
      this.facing = -1;
      this.rings = 0;
    }
  }

  updateBell(dt, world) {
    const c = this.cfg.bell;
    if (this.t >= (this.rings + 0.6) * c.ringEvery && this.rings < c.rings) {
      this.rings++;
      this.ringFx(world);
    }
    if (this.t >= (c.rings + 0.9) * c.ringEvery) {
      world.banner('THE GARDEN AWAKENS', 'The hedges shift and her gardeners come', 2.2);
      Sound.play('bossRoar');
      this.growLayout(world, 1);
      this.shuffleTimer = this.cfg.hedges.shuffle;
      this.tollTimer = this.cfg.gardeners.first;
      this.toWalk();
      this.attackTimer = 0.8;
    }
  }

  /** The bell swings and rings: a ring of sound rolls out across the garden. */
  ringFx(world) {
    const b = this.garden.bell;
    b.kick = (b.kick || 0) + 1;
    Sound.play('bell');
    world.shake(5, 0.3);
    const x = b.x;
    const y = b.y - 70;
    world.effects.add(0.9, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      for (const k of [0, 0.15]) PFX.ring(ctx, x, y + 50, 40 + (t + k) * 380, (40 + (t + k) * 380) * 0.6, '#ecd690', 2, { thick: t < 0.3 ? 2 : 1 });
      ctx.restore();
    }, true);
    world.effects.burst(x, y, { count: 16, colors: ['#ecd690', '#fff6d0', '#c03048'], speed: [40, 140], life: [0.4, 0.8] });
  }

  /** Phase 2: the hedges change pattern now and then, and each toll of the bell brings her gardeners. */
  updatePhase2Garden(dt, world) {
    this.shuffleTimer -= dt;
    if (this.shuffleTimer <= 0) {
      this.shuffleTimer = this.cfg.hedges.shuffle;
      this.growLayout(world, 1 + (this.layout % (QUEEN_HEDGES.length - 1)));
    }
    this.tollTimer -= dt;
    if (this.tollTimer <= 0) {
      this.tollTimer = this.cfg.gardeners.every;
      this.ringFx(world);
      world.effects.text(this.garden.bell.x, this.garden.bell.y - 110, 'THE BELL TOLLS', { color: '#ecd690', size: 8, life: 1.4 });
      this.callGardeners(world);
    }
  }

  // ---------- hedges ----------

  /** The current hedges wither away and layout i grows up in their place (sprouting first). */
  growLayout(world, i) {
    const f = world.dungeon;
    const r = this.room || (f.roomAt ? f.roomAt(this.x, this.y) : null);
    this.layout = i;
    for (const h of this.hedges) this.witherHedge(world, h);
    if (!r || !f.idx) return;
    const mx = Math.floor((r.x0 + r.x1) / 2);
    const my = Math.floor((r.y0 + r.y1) / 2);
    const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ tx: t % f.cols, ty: Math.floor(t / f.cols) }));
    const bad = (x, y) => x <= r.x0 || x >= r.x1 || y <= r.y0 + 1 || y >= r.y1
      || Math.hypot(x + 0.5 - (r.x0 + r.x1 + 1) / 2, (y + 0.5 - (r.y0 + r.y1 + 1) / 2) * 1.25) < 4.5
      || (Math.min(x - r.x0, r.x1 - x) < 4 && Math.min(y - r.y0, r.y1 - y) < 4)
      || doors.some((d) => Math.abs(d.tx - x) < 4 && Math.abs(d.ty - y) < 4);
    const T = f.T;
    for (const [dx, dy, len, dir] of QUEEN_HEDGES[i]) {
      const tiles = [];
      for (let k = 0; k < len; k++) {
        const tx = mx + dx + (dir === 'h' ? k : 0);
        const ty = my + dy + (dir === 'v' ? k : 0);
        if (!bad(tx, ty)) tiles.push({ tx, ty });
      }
      if (!tiles.length) continue;
      this.hedges.push({
        tiles, t: 0, up: false, withering: false, seed: Math.floor(Math.random() * 3),
        cx: (tiles[0].tx + tiles[tiles.length - 1].tx + 1) / 2 * T, cy: (tiles[0].ty + tiles[tiles.length - 1].ty + 1) / 2 * T,
      });
    }
  }

  witherHedge(world, h) {
    if (h.withering) return;
    h.withering = true;
    h.wither = 0;
    if (h.up) for (const { tx, ty } of h.tiles) world.dungeon.blocks?.delete(world.dungeon.idx(tx, ty));
    else h.dead = true;   // still only a sprout: it just never comes up
  }

  /** Hedges sprout (a green outline first), then grow into walls; withered ones sink back into the lawn. */
  updateHedges(dt, world) {
    const f = world.dungeon;
    for (const h of this.hedges) {
      h.t += dt;
      if (!h.up && !h.withering && h.t >= this.cfg.hedges.sprout) {
        // it grows up: every tile nobody (and not her umbrella) is on becomes a wall
        h.up = true;
        h.tiles = h.tiles.filter(({ tx, ty }) => !this.occupied(world, tx, ty));
        f.blocks = f.blocks || new Set();
        for (const { tx, ty } of h.tiles) f.blocks.add(f.idx(tx, ty));
        world.effects.burst(h.cx, h.cy, { count: 14, colors: ['#264228', '#365a36', '#c03048'], speed: [30, 100], life: [0.3, 0.6], up: 40 });
        Sound.play('graveRumble', 0.2);
      }
      if (this.dying > 0) this.witherHedge(world, h);
      if (h.withering) {
        h.wither += dt;
        if (h.wither >= 0.5) h.dead = true;
      }
    }
    removeDead(this.hedges);
  }

  /** True if any hero, enemy, the queen herself or her thrown umbrella overlaps tile (tx, ty). */
  occupied(world, tx, ty) {
    const T = world.dungeon.T;
    const x0 = tx * T - 4;
    const y0 = ty * T - 4;
    const x1 = (tx + 1) * T + 4;
    const y1 = (ty + 1) * T + 4;
    const inside = (e) => e.x > x0 - (e.hw || 8) && e.x < x1 + (e.hw || 8) && e.y > y0 - (e.hh || 6) && e.y < y1 + (e.hh || 6);
    const list = [...world.players.filter((p) => !p.dead), ...world.enemies, ...world.clones, this];
    if (this.brolly) list.push(this.brolly);
    return list.some(inside);
  }

  // ---------- gardeners (phase 2) ----------

  /** The bell tolls: gardeners come through the rose gates (up to gardeners.max at once). */
  callGardeners(world) {
    const g = this.cfg.gardeners;
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    const gates = this.garden.gates;
    if (!gates.length) return;
    for (let i = 0; i < Math.min(g.perWave, g.max - alive); i++) {
      const gate = choose(gates);
      gate.openUntil = this.time + 1.4;
      gate.openAt = this.time;
      world.after(0.4, () => {
        if (this.dead || this.dying > 0) return;
        // where it comes in is chosen as it steps through, clear of any hedge grown there since
        const pt = world.dungeon.freePoint(gate.x, gate.spawnY ?? gate.y + 26, 10, 8);
        const e = createEnemy('gardener', pt.x, pt.y);
        e.owner = this;
        world.addEnemy(e);
        world.effects.burst(pt.x, pt.y - 14, { count: 14, colors: ['#c03048', '#ff6a80', '#365a36'], speed: [30, 110], life: [0.3, 0.6], up: 30 });
      });
      Sound.play('gateCreak', 0.2);
    }
  }

  // ---------- contact, death ----------

  contactDamage(world) {
    if (!this.targetable) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 18 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  die(world) {
    this.dying = 2.4;
    this.state = 'dying';
    this.brolly = null;
    Sound.play('bossRoar');
    world.banner('THE QUEEN HAS FALLEN!', '');
    // her gardeners wilt with her
    for (const e of world.enemies) {
      if (e.owner !== this || e.dead) continue;
      e.dead = true;
      world.effects.burst(e.hx, e.hy, { count: 14, colors: ['#365a36', '#c03048', '#b4acb8'], speed: [40, 140], life: [0.3, 0.6] });
    }
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.petalBurst = (this.petalBurst || 0) - dt;
    if (this.petalBurst <= 0) {
      this.petalBurst = 0.18;
      this.flashTime = 0.08;
      world.effects.burst(this.x + rand(-20, 20), this.y - rand(10, 70), { count: 12, colors: ['#c03048', '#ff6a80', '#8a1a30', '#c46aff'], speed: [40, 160], life: [0.5, 1], gravity: 80 });
      Sound.play('phantomVanish', 0.15);
    }
    if (this.dying <= 0) {
      this.dead = true;
      if (world.dungeon.blocks) world.dungeon.blocks.clear();
      world.effects.burst(this.x, this.y - 40, { count: 80, colors: ['#c03048', '#ff6a80', '#8a1a30', '#c46aff', '#ecd690'], speed: [80, 300], life: [0.6, 1.4], size: [2, 5] });
      world.shake(10, 0.6);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------- entrance ----------

  /** How far above her landing spot she is during the entrance (floating down, slowing as she nears). */
  get lift() {
    if (this.intro <= 0) return 0;
    const k = Math.min(1, this.introAt / QUEEN_INTRO.descend);
    return QUEEN_INTRO.height * (1 - k) * (1 - k);
  }

  updateIntro(dt, world) {
    const I = QUEEN_INTRO;
    const before = this.introAt;
    this.introAt += dt;
    this.intro = I.total - this.introAt;
    const crossed = (at) => before < at && this.introAt >= at;
    if (crossed(0.05)) Sound.play('magic');
    if (this.introAt < I.descend && vrand(0, 1) < 0.7) {
      world.effects.burst(this.x + vrand(-26, 26), this.y - this.lift - vrand(70, 100), { count: 1, colors: ['#f0c8ff', '#ff6ad8', '#ffffff', '#ecd690'], speed: [5, 30], life: [0.5, 1], gravity: 40 });
    }
    if (crossed(I.descend)) {
      // she touches down: petals and dust puff out round her
      world.shake(5, 0.3);
      world.effects.burst(this.x, this.y - 6, { count: 40, colors: ['#c03048', '#ff6a80', '#c46aff', '#f0c8ff', '#ffffff'], speed: [80, 240], life: [0.4, 0.9], size: [2, 4], gravity: 80 });
      world.effects.smoke(this.x, this.y - 4, { count: 8, radius: 26, life: 0.7, rise: 10, colors: ['#3e5a40', '#5a7a52', '#8aa080'] });
      Sound.play('bell');
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
    }
    if (this.intro <= 0) this.intro = 0;
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  /** Which set of frames she's in: 'reach' (arm up), 'guard' (arm out), 'rest', or her walking set. */
  frameKind() {
    if (this.dying > 0) return 'rest';
    if (this.state === 'parasolWindup' || this.state === 'parasol') return 'guard';
    if (this.intro > 0 || ['bell', 'throwWindup', 'conduct', 'blinkWarn', 'burst', 'homingWindup', 'homing'].includes(this.state)) return 'reach';
    if (!this.moving) return 'idle';
    return this.phase === 2 ? 'run' : 'walk';
  }

  currentFrame() {
    const S = Sprites.queen;
    const kind = this.frameKind();
    const list = S[kind] || S.idle;
    const fps = kind === 'run' ? 12 : kind === 'walk' ? 8 : kind === 'reach' || kind === 'guard' ? 4 : 5;
    return list[Math.floor(this.time * fps) % list.length];
  }

  drawGround(ctx) {
    if (this.dead) return;
    // sprouting hedges: a green outline and leaves pushing up where they'll stand
    for (const h of this.hedges) {
      if (h.up || h.withering) continue;
      const k = h.t / this.cfg.hedges.sprout;
      const T = CONFIG.tileSize;
      for (const { tx, ty } of h.tiles) {
        const x = tx * T;
        const y = ty * T;
        ctx.fillStyle = `rgba(60, 140, 70, ${0.15 + k * 0.25})`;
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.strokeStyle = `rgba(150, 255, 150, ${0.5 + Telegraph.pulse(k) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
        for (let i = 0; i < 3; i++) {
          const lx = x + 6 + i * 9;
          const ly = y + 22 - k * 8;
          ctx.fillStyle = '#365a36';
          ctx.fillRect(lx, ly, 3, 4 + k * 6);
          ctx.fillStyle = '#5a7a52';
          ctx.fillRect(lx, ly, 2, 2);
        }
      }
    }
    // her shadow, growing as she floats down to it
    const lift = this.lift;
    drawShadow(ctx, this.x, this.y + 2, 20 * (1 - lift / 500), 6 * (1 - lift / 500), 0.35 * (1 - lift / 400));
    if (this.state === 'homingWindup') Telegraph.circle(ctx, this.x, this.y, 46, this.t / this.cfg.homing.windup, '255, 110, 220');
    const B = this.brolly;
    if (B) {
      drawShadow(ctx, B.x, B.y + 2, 18, 6, 0.3);
      if (B.state === 'open') Telegraph.circle(ctx, B.x, B.y, 26, B.t / this.cfg.umbrella.spin, '255, 110, 220');
    }
    // the blink: the mark where she'll land, and how far its shockwave reaches
    if (this.state === 'blinkWarn' && B) {
      const k = this.t / this.cfg.blink.warn;
      Telegraph.circle(ctx, B.x, B.y, 40, k, '200, 110, 255');
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * Telegraph.pulse(k);
      PFX.ring(ctx, B.x, B.y, this.cfg.blink.radius * k, this.cfg.blink.radius * k * 0.7, '#c46aff', 2, { dash: [6, 6], spin: this.time });
      ctx.restore();
    }
  }

  getDrawables() {
    const out = [];
    if (this.dead) return out;
    out.push({ y: this.y, draw: (ctx) => this.drawQueen(ctx) });
    const B = this.brolly;
    if (B) out.push({ y: B.y, draw: (ctx) => this.drawBrolly(ctx) });
    const T = CONFIG.tileSize;
    for (const h of this.hedges) {
      if (!h.up) continue;
      const grow = h.withering ? 1 - h.wither / 0.5 : Math.min(1, (h.t - this.cfg.hedges.sprout) / 0.25);
      for (const { tx, ty } of h.tiles) {
        out.push({ y: (ty + 1) * T - 2, draw: (ctx) => this.drawHedge(ctx, tx, ty, grow, h.seed + tx + ty) });
      }
    }
    return out;
  }

  /** One hedge block, growing up out of the lawn (or sinking back into it). */
  drawHedge(ctx, tx, ty, grow, seed) {
    const T = CONFIG.tileSize;
    const img = Sprites.hedgeBlock[seed % Sprites.hedgeBlock.length];
    const h = Math.max(1, Math.round(img.height * grow));
    const x = tx * T;
    const bottom = (ty + 1) * T + 2;
    drawShadow(ctx, x + T / 2, bottom - 2, T / 2 + 2, 6, 0.35 * grow);
    ctx.drawImage(img, 0, 0, img.width, h, x, bottom - h, img.width, h);
  }

  /**
   * Her umbrella, open, with its rim's middle at (x, y) and turned by angle (0 = upright):
   * twirling at `spin` turns a second, in a violet aura with motes of magic circling it.
   */
  drawUmbrella(ctx, x, y, angle, spin, alpha = 1, gold = false) {
    const frames = Sprites.queenParasol;
    const img = frames[Math.floor(this.time * spin * frames.length) % frames.length];
    const ux = Math.sin(angle);
    const uy = -Math.cos(angle);
    const cx = x + ux * 10;
    const cy = y + uy * 10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, cx, cy, 40, gold ? '255, 220, 140' : '200, 110, 255', 0.4 + Math.sin(this.time * 5) * 0.08, 2, 26);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.drawImage(img, -img.width / 2, -22);
    ctx.restore();
    // motes of magic circling the canopy
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 5; i++) {
      const a = this.time * 2.6 + (i / 5) * TAU;
      const mx = Math.round(cx + Math.cos(a) * 34);
      const my = Math.round(cy + Math.sin(a) * 12);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(mx - 1, my - 1, 4, 4);
      ctx.fillStyle = i % 2 ? '#f0c8ff' : (gold ? '#ffe680' : '#ff6ad8');
      ctx.fillRect(mx, my, 2, 2);
    }
    ctx.restore();
  }

  drawQueen(ctx) {
    const frame = this.currentFrame();
    const S = QUEEN_SPRITE;
    const flip = this.facing < 0;
    const alpha = this.dying > 0 ? clamp(this.dying / 2.4, 0, 1) : this.state === 'blinkWarn' ? 0.55 + 0.45 * Math.abs(Math.sin(this.time * 18)) : 1;
    const lift = this.lift;
    const x = this.x + (this.intro > 0 ? Math.sin(this.introAt * 2.4) * 14 * (lift / QUEEN_INTRO.height) : 0);
    const y = this.y - lift;
    const holding = !this.brolly && this.dying <= 0;
    const guarding = this.state === 'parasolWindup' || this.state === 'parasol';
    const u = this.heldUmbrella(x, y);
    // the shaft from her hand to the canopy
    const drawShaft = () => {
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const [w, col] of [[4, OUTLINE], [2, '#463a56']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(u.hx, u.hy + 2);
        ctx.lineTo(u.px, u.py);
        ctx.stroke();
      }
      ctx.restore();
    };
    // a soft violet aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 40, 48, '170, 90, 220', 0.35 * alpha, 2, 56);
    ctx.restore();
    // over her shoulder, it leans back behind her head; held out to guard, it's in front of her
    const behind = holding && !guarding && this.frameKind() !== 'reach';
    if (behind) { drawShaft(); this.drawUmbrella(ctx, u.px, u.py, u.angle, this.phase === 2 && this.moving ? 1.6 : 0.8, alpha); }
    drawSprite(ctx, frame.img, x, y, S.ax, S.ay, flip, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, x, y, S.ax, S.ay, flip, alpha * 0.8);
    if (holding && !behind) {
      drawShaft();
      const spin = guarding ? 2.4 : this.state === 'throwWindup' ? 3 : this.state === 'homing' || this.state === 'homingWindup' ? 2 : 0.8;
      this.drawUmbrella(ctx, u.px, u.py, u.angle, spin, alpha, this.state === 'parasol');
    }
    if (this.state === 'parasol') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, u.cx, u.cy, 30, 36, `rgba(255, 230, 150, ${0.5 + Math.sin(this.time * 10) * 0.3})`, 2, { dash: [4, 4], spin: this.time });
      ctx.restore();
    }
    // ringing the bell: she can't be hurt (a shimmer of rose light round her)
    if (this.state === 'bell' || this.state === 'toBell') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, this.x, this.y - 40, 30, 46, `rgba(255, 140, 200, ${0.5 + Math.sin(this.time * 10) * 0.3})`, 2, { dash: [4, 4], spin: this.time });
      ctx.restore();
    }
  }

  /** The thrown umbrella: open, floating upright with a little wobble, twirling fast in its aura. */
  drawBrolly(ctx) {
    const B = this.brolly;
    const y = B.y - 30 - Math.sin(this.time * 3) * 2;
    const spin = B.state === 'open' ? 3 : B.state === 'wait' ? 1.6 : 2.2;
    const tilt = B.state === 'fly' ? Math.cos(B.angle) * 0.25 : Math.sin(this.time * 4) * 0.1;
    // the crook handle swings round as the canopy twirls (it faces us, then away)
    const turn = Math.sin(this.time * spin * TAU);
    this.drawHandle(ctx, B.x, y, tilt, turn);
    this.drawUmbrella(ctx, B.x, y, tilt, spin);
  }

  /**
   * The umbrella's shaft and handle hanging below its rim (x, y), turned by angle with the
   * canopy: an ebony shaft, a leather grip under a gold collar, and a gold crook curling
   * off to one side. turn (-1..1) is which way the crook points as the umbrella twirls.
   */
  drawHandle(ctx, x, y, angle, turn) {
    const L = 22;   // shaft length below the rim
    const side = Math.round(turn * 6);
    const parts = [
      // [x, y, w, h, colour]
      [-1, 0, 2, L, '#2a1e30'],                  // the shaft
      [0, 0, 1, L - 8, '#463a56'],               // its lit edge
      [-1, L - 9, 3, 2, CK.gold[3]],             // the gold collar
      [-2, L - 7, 4, 7, '#3a2a20'],              // the leather grip
      [-1, L - 7, 1, 7, '#5b3922'],
    ];
    // the crook: down past the grip, then curling round to whichever side it faces
    if (Math.abs(side) >= 2) {
      const dir = Math.sign(side);
      const w = Math.abs(side);
      parts.push([-1, L, 3, 4, CK.gold[2]]);
      parts.push([dir > 0 ? 0 : -w, L + 3, w + 1, 3, CK.gold[2]]);
      parts.push([dir > 0 ? w - 2 : -w, L - 1, 3, 5, CK.gold[2]]);
      parts.push([dir > 0 ? w - 2 : -w, L - 1, 1, 1, CK.gold[4]]);
    } else {
      parts.push([-1, L, 3, 6, CK.gold[2]]);    // edge-on: the crook is just a short gold tail
      parts.push([0, L + 4, 1, 1, CK.gold[4]]);
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = OUTLINE;
    for (const [px, py, w, h] of parts) ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
    for (const [px, py, w, h, col] of parts) {
      ctx.fillStyle = col;
      ctx.fillRect(px, py, w, h);
    }
    ctx.restore();
  }

  /** The title card's portrait: just her (no hedges, no umbrella in flight). */
  drawPortrait(ctx) {
    this.drawQueen(ctx);
  }

  drawOverlay() {}
}
