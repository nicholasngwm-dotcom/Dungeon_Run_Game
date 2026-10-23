// =============================================================
//  THE PRINCE (castle stage 1, the training grounds)
//
//  He gallops out of the stable gate on his white charger, reins in, and leaps down
//  into the sparring ring; the horse trots back out. Then he is relentless, and every
//  attack goes the same way: he runs you down, dashes in (a medium-range dash down a red
//  lane), then lays into you with a flurry of cuts and long stabs (combo.pattern), stepping
//  in with each blow; every stab is called out by a red lane first. At 45% health he sounds his trumpet: two royal guards and his
//  own bodyguard (a flail and a massive shield) march in, and he sets his blade alight:
//  every cut and stab flings embers that set you burning. His pace stays the same. While
//  his bodyguard stands, a ribbon of light joins them and the Prince can't be hurt.
//  He's the castle's cute Prince (js/gfx/enemies/castle.js) drawn PRINCE_SCALE bigger.
//  (x, y) is his feet.
// =============================================================

const PRINCE_SCALE = 1.5;
// the entrance: the ride out of the gate, the leap down, then he draws his sword (seconds)
const PRINCE_INTRO = { ride: 1.5, leap: 0.55, total: 2.5 };
const HORSE_SCALE = 1.35;
// his slash crescents (Warrior.drawSlashFx palettes): gold, and alight once his blade burns
const PRINCE_FX = {
  gold: { slash: ['#ffffff', '#fffbe8', '#ecd690', '#a07a24'], slashGlow: ['#8a6a26', '#5a3a1a'], flare: '#fff2a0' },
  fire: { slash: ['#fff2a0', '#ffd34a', '#ff8a1e', '#e0461e'], slashGlow: ['#a03a14', '#5a1a0a'], flare: '#ffd34a' },
};
const THRUST_TIME = 0.16;   // the rapier shoots out and back on a stab

class RoyalPrince {
  constructor(x, y) {
    const c = CONFIG.princeBoss;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 20;
    this.hw = 12;
    this.hh = 8;
    this.time = 0;
    this.animTime = 0;
    this.phase = 1;
    this.intro = PRINCE_INTRO.total;
    this.introAt = 0;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = 1;
    this.moving = false;
    this.state = 'walk';     // walk | dashWindup | dash | combo | recover | trumpet
    this.t = 0;
    this.cooldown = 0.6;
    this.aim = 0;
    this.cut = 0;
    this.lungeLeft = 0;      // px left of the step he takes with a blow of his flurry
    this.swingDir = 1;       // which way the next cut sweeps
    this.blow = null;        // the last blow of his flurry, for the sword animation: { stab, at, dir }
    this.ghostT = 0;         // afterimages while dashing
    this.stabEnd = null;     // where the stab being lined up ends
    this.horse = null;       // his charger during the entrance: { x, y, facing, state, t }
  }

  get name() { return 'THE PRINCE'; }
  get title() { return 'Blade of the Fallen Empire'; }
  get defeatText() { return 'The Prince lies in the dust of his own yard.'; }

  get hx() { return this.x; }
  get hy() { return this.y - 14 * PRINCE_SCALE; }
  get headY() { return this.y - 44 * PRINCE_SCALE; }
  /** Per-phase value from a [phase 1, phase 2] pair. */
  P(v) { return Array.isArray(v) ? v[this.phase - 1] : v; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead; }
  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    return [{ part: this, x: this.x, y: this.y - 92, w: 80, color: '#e8b040', marker: [this.cfg.phase2At] }];
  }

  knockback() {}
  stun() {}

  heal(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) world.effects.text(this.hx, this.hy - 40, `+${Math.round(this.hp - before)}`, { color: '#8cf08a', size: 9 });
  }

  /**
   * True while his bodyguard stands (from the moment his trumpet calls it until it falls):
   * a beam of light joins them, and no blow can touch the Prince.
   */
  get guarded() {
    return !!this.guardCalled && !(this.guard && this.guard.dead);
  }

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    if (this.guarded) {
      // the blow glances off the light his guard lends him
      if (!(this.shieldMsgAt > this.time - 0.6)) {
        this.shieldMsgAt = this.time;
        world.effects.text(this.hx, this.hy - 44, 'PROTECTED', { color: '#ffe680', size: 8 });
      }
      world.effects.burst(this.hx, this.hy, { count: 6, colors: ['#ffe680', '#fffbe8', '#ffffff'], speed: [40, 120], life: [0.15, 0.3] });
      Sound.play('barrierHit', 0.08);
      return false;
    }
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.startTrumpet(world);
    return true;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** The stable gate his horse comes out of (a door in the yard's top wall, see CastleDecor). */
  gate(world) {
    if (this.gateRef === undefined) {
      const items = world.run ? world.run.decor.items : [];
      this.gateRef = items.find((d) => d.kind === 'throneDoor' && d.stable) || null;
    }
    return this.gateRef;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.animTime += dt;
    this.flashTime -= dt;
    this.updateHorse(dt, world);
    if (this.intro > 0) return this.updateIntro(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.t += dt;
    this.moving = false;
    this.cooldown -= dt;
    const p = world.player;
    // the short step he takes with each blow of his flurry
    if (this.lungeLeft > 0 && this.state === 'combo') {
      const s = Math.min(this.lungeLeft, 420 * dt);
      this.lungeLeft -= s;
      world.dungeon.move(this, Math.cos(this.aim) * s, Math.sin(this.aim) * s);
      this.moving = true;
    } else this.lungeLeft = 0;
    switch (this.state) {
      case 'walk': this.updateWalk(dt, world, p); break;
      case 'dashWindup':
        if (this.t < this.windup * 0.6 && !p.dead) this.aimAt(world, p);
        if (this.t >= this.windup) { this.setState('dash'); this.dashed = 0; this.dashHits = new Set(); Sound.play('swiftStrike'); }
        break;
      case 'dash': this.updateDash(dt, world, p); break;
      case 'combo': this.updateCombo(dt, world, p); break;
      case 'recover': this.updateWinded(dt, world); break;
      case 'trumpet': this.updateTrumpet(dt, world); break;
    }
    // his guard has fallen: the light between them shatters and he can be hurt again
    if (this.guard && this.guard.dead && !this.guardBroken) {
      this.guardBroken = true;
      world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#ffe680', '#fffbe8', '#ffffff'], speed: [60, 200], life: [0.3, 0.6] });
      world.effects.text(this.hx, this.headY - 10, 'HIS GUARD HAS FALLEN!', { color: '#ffe680', size: 9, life: 1.6 });
      world.shake(4, 0.25);
      Sound.play('barrierBreak');
    }
    this.contactDamage(world);
  }

  /** Runs straight at you; within dashing range (and off cooldown) he dashes. */
  updateWalk(dt, world, p) {
    if (p.dead) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const a = angleTo(this.x, this.y, p.x, p.y);
    const speed = this.P(this.cfg.speed);
    const x0 = this.x;
    const y0 = this.y;
    world.dungeon.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    this.moving = dist(x0, y0, this.x, this.y) > 0.1;
    this.facing = p.x >= this.x ? 1 : -1;
    if (this.moving && vrand(0, 1) < 0.3) world.effects.burst(this.x - this.facing * 8, this.y, { count: 1, colors: ['#7a6448', '#5a4632'], speed: [10, 30], life: [0.2, 0.4] });
    if (d < this.cfg.dashRange && this.cooldown <= 0) this.startDash(world, p);
  }

  /** Straight off a dash: the flurry of cuts and stabs. */
  startCombo(world, p) {
    this.setState('combo');
    this.cut = 0;
    this.blow = null;
    if (!p.dead) this.aimBlow(world, p);
  }

  /** The current blow of his combo is a stab (not a cut). */
  get stabbing() { return this.cfg.combo.pattern[this.cut] === 'stab'; }

  /** Turns to face p for the next blow; a stab's lane stops at the first wall. */
  aimBlow(world, p) {
    this.aim = angleTo(this.x, this.y, p.x, p.y);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    this.stabEnd = world.dungeon.raycast(this.x, this.y, this.aim, this.cfg.combo.stabRange);
  }

  startDash(world, p) {
    this.aimAt(world, p);
    this.windup = this.P(this.cfg.dash.windup);
    this.setState('dashWindup');
    Sound.play('windup');
  }

  aimAt(world, p) {
    this.aim = angleTo(this.x, this.y, p.x, p.y);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    this.dashEnd = world.dungeon.raycast(this.x, this.y, this.aim, this.cfg.dash.distance);
  }

  /** A medium-range dash: anyone in the lane is cut as he passes. */
  updateDash(dt, world, p) {
    const c = this.cfg.dash;
    const step = (c.distance / c.time) * dt;
    const x0 = this.x;
    const y0 = this.y;
    world.dungeon.move(this, Math.cos(this.aim) * step, Math.sin(this.aim) * step);
    this.dashed += step;
    // fading copies of him streaming behind
    this.ghostT -= dt;
    if (this.ghostT <= 0) {
      this.ghostT = 0.035;
      const img = this.currentFrame().img;
      const gx = this.x;
      const gy = this.y;
      const flip = this.facing < 0;
      world.effects.add(0.25, (ctx, t) => {
        ctx.save();
        ctx.translate(Math.round(gx), Math.round(gy));
        ctx.scale(PRINCE_SCALE, PRINCE_SCALE);
        drawSprite(ctx, img, 0, 0, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, flip, 0.4 * (1 - t));
        ctx.restore();
      });
    }
    this.moving = true;
    for (const a of world.allies) {
      if (this.dashHits.has(a) || pointSegmentDistance(a.x, a.y, x0, y0, this.x, this.y) > c.width / 2 + a.radius) continue;
      this.dashHits.add(a);
      if (a.hurt(c.damage, world, this.x, this.y)) a.knockback?.(this.aim, 180);
    }
    if (vrand(0, 1) < 0.8) world.effects.burst(this.x, this.y - 20, { count: 1, colors: ['#ecd690', '#fffbe8'], speed: [10, 30], life: [0.15, 0.3] });
    if (this.dashed >= c.distance || dist(x0, y0, this.x, this.y) < step * 0.3) this.afterDash(world, p);
  }

  /** Every dash ends in his flurry, wherever you are (he turns and steps in after you). */
  afterDash(world, p) {
    this.startCombo(world, p);
  }

  /**
   * The flurry: cuts and stabs in the combo's pattern, each aimed at you as it comes and
   * stepping him in after you. A stab is called out by a red lane (it locks on partway
   * through the tell), then thrusts the whole length of it.
   */
  updateCombo(dt, world, p) {
    const c = this.cfg.combo;
    const stab = this.stabbing;
    const wait = stab ? c.stabWindup : this.P(c.gap);
    if (!p.dead && (!stab || this.t < wait * 0.6)) this.aimBlow(world, p);
    if (stab && this.t < dt * 1.5) Sound.play('windup', 0.1);
    if (this.t < wait) return;
    // step in with the blow (unless already on top of you)
    if (p.dead || dist(this.x, this.y, p.x, p.y) > 46) this.lungeLeft = stab ? c.stabStep : c.step;
    const reach = c.reach * PRINCE_SCALE * 0.75;
    if (stab) this.thrust(world);
    else {
      for (const a of world.allies) {
        const d = dist(this.x, this.y, a.x, a.y);
        const off = Math.abs(angleDiff(this.aim, angleTo(this.x, this.y, a.x, a.y)));
        if (off <= (c.arcDegrees * DEG) / 2 && d < reach + a.radius && a.hurt(c.damage, world, this.x, this.y)) a.knockback?.(this.aim, 140);
      }
      // a gold crescent sweeping with the blade, each cut the opposite way to the last
      const sx = this.x;
      const sy = this.y - 18;
      const aim = this.aim;
      const dir = this.swingDir;
      const pal = this.blazing ? PRINCE_FX.fire : PRINCE_FX.gold;
      world.effects.add(SLASH_FX_LIFE, (ctx, t) => Warrior.drawSlashFx(ctx, sx, sy, aim, c.arcDegrees * DEG, reach, dir, t, pal));
      Sound.play('swordSwing');
    }
    if (this.blazing) this.flingEmbers(world, stab, reach);
    this.blow = { stab, at: this.time, dir: this.swingDir };
    if (!stab) this.swingDir = -this.swingDir;
    this.cut++;
    this.t = 0;
    if (this.cut >= c.pattern.length) this.setState('recover');
  }

  /**
   * After every dash and flurry he stops to catch his breath (recovery s): bent over, sword
   * point down in the dirt, panting out little clouds, sweat flying off him.
   */
  updateWinded(dt, world) {
    if (this.t < dt * 1.5) world.effects.text(this.hx, this.headY - 6, 'HUFF... PUFF...', { color: '#d8c8a0', size: 7, life: 1.2 });
    const mouth = { x: this.x + this.facing * 16, y: this.y - 38 * PRINCE_SCALE * (1 - this.pose().squash) };
    this.puff = (this.puff ?? 0) - dt;
    if (this.puff <= 0) {
      this.puff = 0.45;
      world.effects.smoke(mouth.x, mouth.y, { count: 2, radius: 5, life: 0.5, rise: 10, colors: ['#e8e4dc', '#c8c4bc', '#f4f0ea'] });
    }
    if (vrand(0, 1) < dt * 3) {
      world.effects.burst(this.x + vrand(-10, 10), this.y - 56, { count: 1, colors: ['#9ad0ff', '#d8f0ff'], speed: [20, 50], life: [0.3, 0.5], up: 40, gravity: 260, size: [2, 2] });
    }
    if (this.t >= this.P(this.cfg.recovery)) { this.setState('walk'); this.cooldown = this.P(this.cfg.cooldown); }
  }

  /**
   * His body pose: lean (radians toward where he faces) and squash (0 = standing tall).
   * Small amounts only, so the sprite never looks stretched.
   */
  pose() {
    const t = this.t;
    switch (this.state) {
      case 'dashWindup': {
        const k = Math.min(1, t / Math.max(0.05, this.windup * 0.5));
        return { lean: 0.1 * k, squash: 0.07 * k };   // crouching to spring
      }
      case 'dash': return { lean: 0.2, squash: -0.03 };
      case 'combo': {
        const age = this.blow ? this.time - this.blow.at : 1;
        const hit = Math.max(0, 1 - age / 0.15);   // a jolt forward with each blow
        if (this.stabbing) {
          const k = Math.min(1, t / this.cfg.combo.stabWindup);
          return { lean: -0.06 * k + 0.12 * hit, squash: 0.04 * k };   // drawn back, coiled for the thrust
        }
        return { lean: 0.12 * hit, squash: 0.02 * hit };
      }
      case 'recover': {
        // winded: eases down into a hunch, heaving with each breath, then straightens up
        const k = clamp(Math.min(t / 0.25, (this.P(this.cfg.recovery) - t) / 0.3), 0, 1);
        const pant = (Math.sin(t * 9) + 1) / 2;
        return { lean: 0.14 * k, squash: k * (0.03 + pant * 0.035) };
      }
    }
    return { lean: 0, squash: 0 };
  }

  /**
   * The rapier in his hand: angle a and how far it's pushed out along the blade (reach).
   * Cuts sweep it across the arc in step with the crescent; a stab draws it back, then
   * shoots it out and back; winded he leans on it, point in the dirt.
   */
  swordPose(pos, f) {
    const rest = { a: f > 0 ? -0.35 : Math.PI + 0.35, reach: 0 };
    if (this.intro > 0) return pos.seated ? { a: f > 0 ? -1.1 : Math.PI + 1.1, reach: 0 } : rest;
    switch (this.state) {
      case 'dashWindup': return { a: this.aim + Math.PI * 0.8 * (f > 0 ? 1 : -1), reach: -2 };   // drawn back behind him
      case 'dash': return { a: this.aim + (f > 0 ? -0.35 : 0.35), reach: 4 };
      case 'recover': return { a: f > 0 ? 1.25 : Math.PI - 1.25, reach: 2 };
      case 'combo': {
        const half = (this.cfg.combo.arcDegrees * DEG) / 2;
        const b = this.blow;
        const age = b ? this.time - b.at : 1;
        if (b && b.stab && age < THRUST_TIME) {
          const k = age / THRUST_TIME;
          return { a: this.aim, reach: 16 * Math.sin(Math.PI * Math.min(1, k * 1.6)) };   // out fast, back slower
        }
        if (this.stabbing) return { a: this.aim, reach: -8 * Math.min(1, this.t / (this.cfg.combo.stabWindup * 0.6)) };
        if (b && !b.stab) {
          // sweeping through the last cut, then held at the end of it (the next cut comes back the other way)
          const k = swingEase(Math.min(1, age / SWING_TIME));
          return { a: this.aim + lerp(-half, half, k) * b.dir, reach: 2 };
        }
        return { a: this.aim - half * this.swingDir, reach: 0 };   // raised, ready for the first cut
      }
    }
    return rest;
  }

  /** A long stab down the telegraphed lane: everyone in it is run through and thrown back. */
  thrust(world) {
    const c = this.cfg.combo;
    const sx = this.x;
    const sy = this.y;
    const end = this.stabEnd || { x: sx + Math.cos(this.aim) * c.stabRange, y: sy + Math.sin(this.aim) * c.stabRange };
    for (const a of world.allies) {
      if (pointSegmentDistance(a.x, a.y, sx, sy, end.x, end.y) > c.stabWidth / 2 + (a.radius || 10)) continue;
      if (a.hurt(c.stabDamage, world, sx, sy)) a.knockback?.(this.aim, 280);
    }
    // a bright golden (or, once his blade burns, fiery) streak the length of the thrust, at hand height
    const len = dist(sx, sy, end.x, end.y);
    const aim = this.aim;
    const colors = this.blazing ? ['#e0461e', '#ff8a1e', '#ffd34a', '#fff2a0'] : ['#a07a24', '#e8b040', '#fffbe8', '#ffffff'];
    world.effects.add(0.3, (ctx, t) => Warrior.drawLineFx(ctx, sx, sy - 18, aim, len, c.stabWidth, colors, t));
    world.effects.burst(end.x, end.y - 18, { count: 10, colors: ['#fffbe8', '#ecd690', '#ffffff'], speed: [60, 180], life: [0.15, 0.35] });
    world.shake(4, 0.15);
    Sound.play('swordStab');
  }

  // ---------- phase 2: the trumpet ----------

  startTrumpet(world) {
    this.phase = 2;
    this.setState('trumpet');
    this.summoned = false;
    world.banner('THE PRINCE SOUNDS HIS TRUMPET', 'To arms! Guard the Prince!', 2.2);
    Sound.play('trumpet');
  }

  /** He raises the trumpet: two royal guards and his bodyguard come at his call. */
  updateTrumpet(dt, world) {
    if (vrand(0, 1) < dt * 12) world.effects.burst(this.x + this.facing * 40, this.y - 50, { count: 1, colors: ['#ecd690', '#ffffff'], speed: [30, 80], life: [0.4, 0.7], up: 30 });
    if (!this.summoned && this.t >= 0.7) {
      this.summoned = true;
      this.guardCalled = true;   // protected from now (his guard is on its way) until it falls
      const types = [...Array(this.cfg.trumpet.guards).fill('royalGuard'), 'princeGuard'];
      types.forEach((type, i) => {
        const a = (i / types.length) * TAU + Math.PI / 2;
        world.spawnEnemy(type, this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 60, (e) => {
          e.owner = this;
          if (type === 'princeGuard') this.guard = e;   // while it stands, he can't be hurt
        });
      });
      world.shake(4, 0.3);
    }
    if (this.t >= this.cfg.trumpet.time) {
      // he lowers the trumpet and runs a hand down his blade: it bursts into flame
      this.blazing = true;
      const hx = this.x + this.facing * 20;
      const hy = this.y - 30;
      world.effects.burst(hx, hy, { count: 24, colors: ['#ffd34a', '#ff8a1e', '#e0461e', '#fff2a0'], speed: [40, 160], life: [0.3, 0.6], up: 50 });
      world.effects.text(this.hx, this.headY - 10, 'BURN!', { color: '#ff8a3a', size: 10, life: 1.2 });
      Sound.play('fireArrow');
      this.setState('walk');
      this.cooldown = this.cfg.cooldown;
    }
  }

  /**
   * The burning blade's embers: small flames flung off each cut (fanned across its arc)
   * or the stab (down its line). Each does a little damage and sets whoever it hits alight.
   */
  flingEmbers(world, stab, reach) {
    const c = this.cfg.flame;
    const n = stab ? c.stabEmbers : c.slashEmbers;
    const arc = stab ? 0.25 : (this.cfg.combo.arcDegrees * DEG) * 0.8;
    const x = this.x + Math.cos(this.aim) * reach * 0.5;
    const y = this.y - 18 + Math.sin(this.aim) * reach * 0.5;
    for (let i = 0; i < n; i++) {
      const a = this.aim + (n > 1 ? (i / (n - 1) - 0.5) * arc : 0) + rand(-0.06, 0.06);
      const speed = c.speed * (stab ? 1.25 : rand(0.85, 1.1));
      world.enemyProjectiles.push(new Projectile({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, radius: 5, damage: c.damage, life: c.life, friendly: false,
        glow: '255, 60, 40', trail: ['#ff3a26', '#c81a1a', '#8a0c12'],
        // a small licking flame, not a fireball: drawn here, flickering and shrinking as it flies
        aura: (ctx, p) => {
          const k = 1 - p.age / c.life;
          PFX.flame(ctx, p.x, p.y + 4, 6 + 3 * k, 9 + 7 * k, p.age * 18 + i, ENEMY_FIRE_COLORS);
        },
        onHit: (pr, w, t) => {
          if (t) t.burn?.(c.burnDps, c.burnTime, w);
          w.effects.burst(pr.x, pr.y, { count: 5, colors: ['#ffd34a', '#ff8a1e', '#e0461e'], speed: [20, 70], life: [0.15, 0.3], up: 30 });
        },
      }));
    }
    Sound.play('emberFlick', 0.1);
  }

  // ---------- contact, death ----------

  contactDamage(world) {
    if (!this.targetable) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 16 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  die(world) {
    this.dying = 2.2;
    this.state = 'dying';
    Sound.play('bossRoar');
    world.banner('THE PRINCE HAS FALLEN!', '');
    for (const e of world.enemies) {
      if (e.owner !== this || e.dead) continue;
      e.dead = true;
      world.effects.burst(e.hx, e.hy, { count: 14, colors: ['#3e3a48', '#c8a456', '#8a2438'], speed: [40, 140], life: [0.3, 0.6] });
    }
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.burstTimer = (this.burstTimer || 0) - dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = 0.2;
      this.flashTime = 0.08;
      world.effects.burst(this.x + rand(-16, 16), this.y - rand(10, 70), { count: 10, colors: ['#8a2438', '#c8a456', '#ffffff'], speed: [50, 160], life: [0.3, 0.7] });
      Sound.play('hit', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.x, this.y - 40, { count: 70, colors: ['#8a2438', '#c8a456', '#ecd690', '#ffffff'], speed: [80, 300], life: [0.6, 1.3], size: [2, 5] });
      world.shake(10, 0.6);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------- entrance: the ride in ----------

  /** The horse comes out of the stable gate, gallops to the middle of the yard and rears; he leaps down. */
  updateIntro(dt, world) {
    const I = PRINCE_INTRO;
    const before = this.introAt;
    this.introAt += dt;
    this.intro = I.total - this.introAt;
    const crossed = (at) => before < at && this.introAt >= at;
    const gate = this.gate(world);
    if (!this.horse) {
      const from = gate ? { x: gate.x, y: gate.y + 26 } : { x: this.x - 320, y: this.y };
      this.horse = { x: from.x, y: from.y, fromX: from.x, fromY: from.y, facing: 1, state: 'ride', t: 0 };
      if (gate) gate.openUntil = this.time + I.ride + 2.5;
      Sound.play('gateCreak');
    }
    const H = this.horse;
    if (crossed(0.05)) Sound.play('gallop');
    if (crossed(I.ride * 0.5)) Sound.play('gallop');
    if (crossed(I.ride)) {
      H.state = 'rear';
      H.t = 0;
      Sound.play('trumpet');
    }
    if (crossed(I.ride + I.leap)) {
      // he lands in the ring
      world.shake(5, 0.3);
      world.effects.burst(this.x, this.y - 4, { count: 26, colors: ['#7a6448', '#5a4632', '#c8a456'], speed: [60, 200], life: [0.3, 0.7], gravity: 300, up: 80 });
      world.effects.smoke(this.x, this.y - 4, { count: 6, radius: 22, life: 0.6, rise: 10, colors: ['#5a4632', '#7a6448', '#a08a6a'] });
      Sound.play('stomp');
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
      H.state = 'leave';
      H.t = 0;
    }
    if (crossed(I.total - 0.4)) Sound.play('swordSwing');
    if (this.intro <= 0) this.intro = 0;
  }

  /** The horse's ride in, its rearing, and its trot back out through the gate. */
  updateHorse(dt, world) {
    const H = this.horse;
    if (!H) return;
    H.t += dt;
    const I = PRINCE_INTRO;
    // the horse pulls up beside the spot he lands on (on the side it rode in from), clear of him
    const stopX = this.x - (H.fromX <= this.x ? 1 : -1) * 66;
    const stopY = this.y - 6;
    if (H.state === 'ride') {
      const k = Math.min(1, this.introAt / I.ride);
      const e = 1 - (1 - k) * (1 - k);   // slowing as he reins in
      const nx = lerp(H.fromX, stopX, e);
      const ny = lerp(H.fromY, stopY, e);
      if (Math.abs(nx - H.x) > 0.01) H.facing = nx > H.x ? 1 : -1;
      H.x = nx;
      H.y = ny;
      if (vrand(0, 1) < 0.6) world.effects.burst(H.x - H.facing * 20, H.y, { count: 1, colors: ['#7a6448', '#5a4632'], speed: [10, 40], life: [0.3, 0.6] });
    } else if (H.state === 'leave') {
      // off back to the stable at a trot, fading into the gate
      const gate = this.gate(world);
      const tx = gate ? gate.x : H.fromX;
      const ty = gate ? gate.y + 20 : H.fromY;
      const d = dist(H.x, H.y, tx, ty);
      const s = Math.min(d, 190 * dt);
      if (d > 1) { H.x += ((tx - H.x) / d) * s; H.y += ((ty - H.y) / d) * s; H.facing = tx > H.x ? 1 : -1; }
      if (d < 6) this.horse = null;
    }
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  /** Where he is during the entrance: in the saddle, in the air as he leaps down, then in the ring. */
  introPos() {
    const I = PRINCE_INTRO;
    const H = this.horse;
    const saddle = H ? { x: H.x - H.facing * 4, y: H.y - 34 * HORSE_SCALE } : { x: this.x, y: this.y };
    if (this.introAt < I.ride) return { x: saddle.x, y: saddle.y, seated: true };
    const k = Math.min(1, (this.introAt - I.ride) / I.leap);
    if (k < 1) {
      return { x: lerp(saddle.x, this.x, k), y: lerp(saddle.y, this.y, k) - Math.sin(k * Math.PI) * 50, seated: false, air: true };
    }
    return { x: this.x, y: this.y, seated: false };
  }

  currentFrame() {
    const F = Sprites.enemies.prince;
    if (this.dying > 0) return F.idle[0];
    const moving = this.moving || this.state === 'dash';
    return heroFrame(F, moving, this.animTime * 1.2);
  }

  drawGround(ctx) {
    if (this.dead || this.offstage) return;
    const pos = this.intro > 0 ? this.introPos() : { x: this.x, y: this.y };
    if (!pos.seated) drawShadow(ctx, pos.x, this.y + 2, pos.air ? 12 : 18, pos.air ? 4 : 6, pos.air ? 0.2 : 0.35);
    if (this.horse) drawShadow(ctx, this.horse.x, this.horse.y + 2, 40, 9, 0.35);
    if (this.state === 'dashWindup' && this.dashEnd) {
      Telegraph.line(ctx, this.x, this.y, this.dashEnd.x, this.dashEnd.y, this.cfg.dash.width, this.t / this.windup);
    }
    // each stab of his flurry is called out down its whole length before it lands
    if (this.state === 'combo' && this.stabbing && this.stabEnd) {
      const c = this.cfg.combo;
      Telegraph.line(ctx, this.x, this.y, this.stabEnd.x, this.stabEnd.y, c.stabWidth, this.t / c.stabWindup);
    }
  }

  /** Before the ride begins he's still in the stable (not yet in the yard). */
  get offstage() { return this.intro > 0 && !this.horse && this.introAt < PRINCE_INTRO.ride; }

  getDrawables() {
    const out = [];
    if (this.dead || this.offstage) return out;
    const H = this.horse;
    if (H) out.push({ y: H.y, draw: (ctx) => this.drawHorse(ctx) });
    // seated, he's drawn with the horse (just after it)
    const pos = this.intro > 0 ? this.introPos() : { x: this.x, y: this.y };
    out.push({ y: pos.seated && H ? H.y + 0.5 : pos.air ? this.y : this.y, draw: (ctx) => this.drawPrince(ctx) });
    return out;
  }

  /** His white charger: galloping in, rearing up as he leaps off, trotting away. */
  drawHorse(ctx) {
    const H = this.horse;
    const F = Sprites.royalHorse;
    const galloping = H.state === 'ride' ? this.introAt < PRINCE_INTRO.ride * 0.92 : H.state === 'leave';
    const list = galloping ? F.walk : F.idle;
    const frame = list[Math.floor(this.time * (H.state === 'leave' ? 9 : 13)) % list.length];
    const rear = H.state === 'rear' ? Math.sin(Math.min(1, H.t / 0.5) * Math.PI) : 0;
    ctx.save();
    ctx.translate(Math.round(H.x), Math.round(H.y));
    if (rear) {
      // rearing up on its hind legs: tipped back round its hind hooves
      const hind = -H.facing * 16 * HORSE_SCALE;
      ctx.translate(hind, 0);
      ctx.rotate(-H.facing * rear * 0.32);
      ctx.translate(-hind, 0);
    }
    ctx.scale(HORSE_SCALE, HORSE_SCALE);
    drawSprite(ctx, frame.img, 0, 0, CAVALRY_ANCHOR.x, CAVALRY_ANCHOR.y, H.facing < 0, 1);
    ctx.restore();
  }

  /** Him at PRINCE_SCALE, the rapier (or the trumpet) in his hand, seated in the saddle during the ride. */
  drawPrince(ctx, at = null) {
    const pos = at || (this.intro > 0 ? this.introPos() : { x: this.x, y: this.y, seated: false });
    const S = PRINCE_SCALE;
    const x = pos.x;
    const y = pos.y;
    const f = this.horse && pos.seated ? this.horse.facing : this.facing;
    const frame = at ? Sprites.enemies.prince.idle[0] : this.currentFrame();   // the card: eyes open, never mid-blink
    const alpha = this.dying > 0 ? clamp(this.dying / 2.2, 0, 1) : 1;
    // a golden aura, stronger when he's fired up
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 34, 40, this.phase === 2 ? '255, 140, 90' : '255, 210, 140', (this.phase === 2 ? 0.35 : 0.22) * alpha, 2, 46);
    ctx.restore();
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    // his pose, tipped round his feet: leaning into blows and dashes, crouched to spring, hunched when winded
    const pose = at || this.intro > 0 ? { lean: 0, squash: 0 } : this.pose();
    ctx.rotate(f * pose.lean);
    ctx.scale(S * (1 + pose.squash * 0.6), S * (1 - pose.squash));
    if (pos.seated) {
      // in the saddle: only the top half shows above the horse's back
      ctx.beginPath();
      ctx.rect(-40, -60, 80, 52);
      ctx.clip();
      ctx.translate(0, 8);
    }
    drawSprite(ctx, frame.img, 0, 0, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, f < 0, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, 0, 0, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, f < 0, alpha * 0.8);
    // the weapon in his hand (positions as the castle enemies hold theirs, in the scaled frame)
    if (this.dying <= 0) {
      ctx.globalAlpha = alpha;
      const hy = -14;
      if (this.state === 'trumpet') {
        const T = Sprites.weapons.trumpet;
        const a = f > 0 ? -0.35 : Math.PI + 0.35;
        drawRotated(ctx, T.img, f * 4, hy - 8, T.pivotX, T.pivotY, a, Math.cos(a) < 0);
      } else {
        const R = Sprites.weapons.rapier;
        const { a, reach } = at ? { a: f > 0 ? -0.35 : Math.PI + 0.35, reach: 0 } : this.swordPose(pos, f);
        const wx = f * 8 + Math.cos(a) * reach;
        const wy = hy + 4 + Math.sin(a) * reach;
        drawRotated(ctx, R.img, wx, wy, R.pivotX, R.pivotY, a, Math.cos(a) < 0);
        if (!at && this.state === 'combo' && this.stabbing) {
          // a glint flickering on the point as he draws back for a stab
          const tx = wx + Math.cos(a) * 24;
          const ty = wy + Math.sin(a) * 24;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          PFX.glow(ctx, tx, ty, 8, '255, 120, 100', 0.8);
          PFX.star(ctx, tx, ty, Math.floor(this.time * 16) % 2 ? 3 : 2, '#fffbe8', '#ffffff', 1);
          ctx.restore();
        }
        if (this.blazing) {
          // the blade alight: flames licking up its length, and a hot glow round it
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          PFX.glow(ctx, f * 8 + ca * 20, hy + 4 + sa * 20, 18, '255, 130, 40', 0.5 + Math.sin(this.time * 17) * 0.1, 1, 12);
          ctx.restore();
          for (let i = 0; i < 4; i++) {
            const k = 8 + i * 8;
            PFX.flame(ctx, f * 8 + ca * k, hy + 4 + sa * k, 5, 7 + (i % 2) * 3 + Math.sin(this.time * 13 + i) * 2, this.time * 10 + i * 1.7, ENEMY_FIRE_COLORS, 1);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // the trumpet's notes ringing out
    if (this.state === 'trumpet') {
      for (let i = 0; i < 3; i++) {
        const k = (this.t * 1.5 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        PFX.ring(ctx, x + f * (54 + k * 40), y - 46, 5 + k * 18, 8 + k * 24, '#ecd690', 2, { from: f > 0 ? -1 : Math.PI - 1, to: f > 0 ? 1 : Math.PI + 1 });
        ctx.restore();
      }
    }
  }

  /** The title card's portrait: just him, standing in the ring. */
  drawPortrait(ctx) {
    this.drawPrince(ctx, { x: this.x, y: this.y, seated: false });
  }

  /**
   * While his guard stands: a ribbon of golden light from the guard to him (motes flowing
   * along it toward the Prince) and a shimmering ward round him, so it's plain he can't be
   * hurt until the guard falls. Drawn over the room's gloom.
   */
  drawOverlay(ctx) {
    if (!this.guarded || this.dying > 0 || this.dead) return;
    const px = this.x;
    const py = this.y - 34;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the ward round the Prince
    PFX.glow(ctx, px, py, 46, '255, 220, 120', 0.3 + Math.sin(this.time * 6) * 0.08, 2, 50);
    PFX.ring(ctx, px, py, 30, 42, `rgba(255, 230, 150, ${0.55 + Math.sin(this.time * 8) * 0.25})`, 2, { dash: [5, 4], spin: this.time * 1.5 });
    const G = this.guard;
    if (G && !G.dead) {
      const gx = G.x;
      const gy = G.hy;
      const len = dist(gx, gy, px, py);
      const nx = -(py - gy) / (len || 1);
      const ny = (px - gx) / (len || 1);
      // the ribbon: a gently waving band of light (a soft wide stroke, a bright core)
      const ribbon = (width, style, phase) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const k = i / 16;
          const wave = Math.sin(k * Math.PI) * Math.sin(this.time * 4 + k * 8 + phase) * 8;
          const x = lerp(gx, px, k) + nx * wave;
          const y = lerp(gy, py, k) + ny * wave;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      };
      ribbon(10, 'rgba(255, 210, 110, 0.18)', 0);
      ribbon(4, 'rgba(255, 230, 150, 0.45)', 0.5);
      ribbon(2, 'rgba(255, 250, 220, 0.8)', 1);
      // motes of light flowing along it to the Prince
      for (let i = 0; i < 6; i++) {
        const k = (this.time * 0.6 + i / 6) % 1;
        const wave = Math.sin(k * Math.PI) * Math.sin(this.time * 4 + k * 8 + 1) * 8;
        const x = lerp(gx, px, k) + nx * wave;
        const y = lerp(gy, py, k) + ny * wave;
        PFX.glow(ctx, x, y, 8, '255, 240, 180', 0.9);
      }
      PFX.glow(ctx, gx, gy, 20, '255, 220, 120', 0.5);
    }
    ctx.restore();
  }
}
