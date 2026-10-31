// =============================================================
//  THE DECRONIC FLAMEWORM (the Fiery Fortress's boss, any stage)
//
//  A giant sandworm of black molten rock and lava (see buildFlamewormSprites) that lives under the
//  fortress's floor. Each worm takes turns above and below ground (CONFIG.flameworm):
//    under:   it can't be hurt; a mound of broken floor rushes about after the hero (digTime s)
//    surface: the floor cracks and glows where it will burst up (bite.windup), then it bites up
//             through it (bite.radius) and sprays its fireballs, wave after wave
//    up:      it sways, watching, for surfaceTime s, then (a coin toss) sprays fireballs in all
//             directions in `waves` waves, or draws a giant flaming magic arrow and looses it at the
//             hero: it bursts near them and leaves the area in flames
//    dive:    back down into its hole, and under again
//  Below splitAt of its health it splits into splitCount worms, each splitScale x its size and with its
//  own health bar (sharing out what was left), all doing the same, out of step. It's beaten when the
//  last one falls. Fire (burnDps for burnTime) is the slow, light burn; the bite and blasts hurt.
//  The boss object holds the worms; each worm is something the heroes can hit while it's up.
// =============================================================

// its entrance: the floor trembles and cracks (until burst), it bursts up through it (rise), roars
const FLAMEWORM_INTRO = { burst: 1.7, rise: 2.3, total: 3.2 };

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
    this.rise = 0;          // 0 below ground .. 1 reared up to its full height
    this.aim = Math.PI / 2;
    this.sway = rand(0, TAU);
    this.flashTime = 0;
    this.dead = false;
    this.sinking = 0;       // fallen (phase 2): seconds left as it sinks back into the ground
    this.waves = 0;         // fireball waves left to spray
    this.wobble = 0;
  }

  get cfg() { return this.boss.cfg; }
  /** Its height reared up, px. */
  get height() { return 130 * this.scale * this.rise; }
  /** Where its head is (the lean follows its aim). */
  get head() {
    const lean = 64 * this.scale * this.rise;
    return { x: this.x + Math.cos(this.aim) * lean + Math.sin(this.sway) * 4 * this.rise, y: this.y - this.height + Math.sin(this.aim) * lean * 0.3 };
  }
  get hx() { return lerp(this.x, this.head.x, 0.6); }
  get hy() { return lerp(this.y, this.head.y, 0.6); }
  get radius() { return 34 * this.scale; }
  /** Up out of the ground far enough to be hit. */
  get targetable() { return !this.dead && this.rise > 0.4 && this.boss.intro <= 0 && this.boss.dying <= 0; }

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
    if (this.dead) {
      // fallen: it sinks back into its hole, rock and lava spilling off it
      this.sinking -= dt;
      this.rise = Math.max(0, this.rise - dt * 0.6);
      if (vrand(0, 1) < dt * 14) world.effects.burst(this.head.x + vrand(-14, 14), this.head.y + vrand(-10, 20), { count: 4, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [40, 160], life: [0.3, 0.6], gravity: 360 });
      return;
    }
    const c = this.cfg;
    const p = world.player;
    if (!p.dead && this.rise > 0) {
      const want = angleTo(this.x, this.y, p.x, p.y);
      this.aim += clamp(angleDiff(want, this.aim), -2.5 * dt, 2.5 * dt);
    }
    switch (this.state) {
      case 'under': this.updateUnder(dt, world, p); break;
      case 'surface':
        // the floor cracking and glowing over it, then it bursts up and bites
        this.rise = 0;
        if (vrand(0, 1) < 0.5) world.effects.burst(this.x + vrand(-30, 30) * this.scale, this.y + vrand(-14, 14) * this.scale, { count: 1, colors: FORT_LAVA_GIBS, speed: [20, 60], life: [0.2, 0.4], up: 50 });
        if (this.t >= c.bite.windup) this.bite(world);
        break;
      case 'emerge':
        this.rise = Math.min(1, this.rise + dt * 3.2);
        if (this.rise >= 1) { this.setState('spray'); this.waves = c.fireballs.waves; this.after = 'up'; }
        break;
      case 'up':
        if (this.t >= c.surfaceTime[this.boss.split ? 1 : 0]) {
          if (Math.random() < 0.5) { this.setState('spray'); this.waves = c.fireballs.waves; this.after = 'dive'; }
          else { this.setState('arrow'); Sound.play('crownCharge', 0.12); }
        }
        break;
      case 'spray':
        if (this.t >= c.fireballs.every) {
          this.t = 0;
          this.sprayWave(world);
          if (--this.waves <= 0) this.setState(this.after === 'dive' ? 'diveWait' : 'up');
        }
        break;
      case 'diveWait':
        if (this.t >= 0.4) this.dive();
        break;
      case 'arrow':
        // it rears back, a giant arrow of fire and magic forming in its jaws; the aim locks a moment before it looses
        if (!p.dead && this.t < c.arrow.windup - 0.35) this.arrowAt = { x: p.x, y: p.y };
        if (this.t >= c.arrow.windup) { this.loose(world); this.setState('diveWait'); }
        break;
      case 'dive':
        this.rise = Math.max(0, this.rise - dt / c.diveTime);
        if (this.rise <= 0) {
          world.effects.burst(this.x, this.y, { count: 16, colors: FORT_ROCK_GIBS, speed: [60, 180], life: [0.3, 0.6], up: 60, gravity: 320 });
          this.setState('under');
          this.digFor = rand(...c.digTime);
        }
        break;
    }
  }

  /** Below ground: its mound of broken floor rushes after the hero, then it comes up under them. */
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
    const b = world.dungeon.floorBounds;
    this.x = clamp(this.x, b.left + 40, b.right - 40);
    this.y = clamp(this.y, b.top + 60, b.bottom - 30);
    // rubble churning up off its mound (visual only)
    if (vrand(0, 1) < dt * 30) world.effects.burst(this.x + vrand(-16, 16) * this.scale, this.y + vrand(-6, 6), { count: 1, colors: [...FORT_ROCK_GIBS, '#ff7a1a'], speed: [20, 70], life: [0.3, 0.5], up: 60, gravity: 300, size: [2, 3] });
    if (this.t >= this.digFor) {
      this.setState('surface');
      Sound.play('graveRumble', 0.12);
    }
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
    world.effects.burst(x, y - 10, { count: 40, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [100, 300], life: [0.4, 0.9], up: 160, gravity: 400, size: [2, 6] });
    world.effects.smoke(x, y - 8, { count: 8, radius: r * 0.6, life: 1, rise: 30, colors: ['#2a1a18', '#4a3430', '#6a5048'] });
    world.shake(8 * this.scale, 0.35);
    Sound.play('rockErupt');
    Sound.play('bossRoar', 0.1);
    this.setState('emerge');
  }

  /** One wave of fireballs flung out in every direction (each wave turned half a gap from the last). */
  sprayWave(world) {
    const F = this.cfg.fireballs;
    const n = F.count[this.boss.split ? 1 : 0];
    const h = this.head;
    const off = (this.waves % 2) * (Math.PI / n) + this.sway * 0.1;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      fireShot(world, h.x + Math.cos(a) * 14, h.y + 10 + Math.sin(a) * 10, a, F.speed, F, {
        radius: 6, damage: F.damage, life: 4, sprite: Sprites.projectiles.fireball, spin: 8,
      });
    }
    world.effects.burst(h.x, h.y + 8, { count: 14, colors: FORT_LAVA_GIBS, speed: [40, 160], life: [0.2, 0.4] });
    Sound.play('bossFireball', 0.1);
  }

  /** The giant flaming magic arrow, loosed at where the hero stood: it bursts there into an area of flames. */
  loose(world) {
    const A = this.cfg.arrow;
    const h = this.head;
    const to = this.arrowAt || { x: h.x, y: h.y + 100 };
    const a = angleTo(h.x, h.y + 10, to.x, to.y);
    const life = Math.max(0.2, dist(h.x, h.y + 10, to.x, to.y) / A.speed);
    const burst = (w, x, y) => {
      for (const t of w.allies) {
        if (dist(t.x, t.y, x, y) >= A.blastRadius + t.radius) continue;
        if (t.hurt(A.damage, w, x, y)) { setAlight(w, t, A); t.knockback?.(angleTo(x, y, t.x, t.y), 240); }
      }
      enemyBlastFx(w, x, y, A.blastRadius);
      firePatch(w, x, y, A.fireRadius, A.fireTime, A, 14);
      w.effects.burst(x, y - 10, { count: 24, colors: ['#7a24c0', '#b05af0', '#e0a8ff', '#ffb52e'], speed: [80, 240], life: [0.3, 0.7] });
    };
    enemyShot(world, h.x, h.y + 10, a, A.speed, {
      radius: 12, damage: 0, life, sprite: Sprites.projectiles.wormArrow, glow: '255, 140, 60', trail: ['#b05af0', '#ff8a1e', '#ffd34a'],
      onHit: (pr, w) => burst(w, pr.x, pr.y),
    });
    world.shake(4, 0.2);
    Sound.play('fireArrow');
    Sound.play('crownBlast', 0.1);
  }

  dive() {
    this.setState('dive');
    Sound.play('graveRumble', 0.1);
  }

  /** Touching it while it's up out of the ground hurts. */
  contactDamage(world) {
    if (this.rise < 0.5 || this.dead) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 30 * this.scale + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  // ---------- drawing ----------

  /** The hole it rises from, the mound it digs under, the cracks where it will burst up. */
  drawGround(ctx, time) {
    const s = this.scale;
    if (this.dead && this.rise <= 0) return;
    if (this.state === 'under') {
      // a mound of broken floor heaving up over it: chunks of brick tumbling, lava glowing through the cracks
      const heave = Math.sin(time * 14) * 1.5;
      drawShadow(ctx, this.x, this.y + 6, 40 * s, 13 * s, 0.45);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.y, 44 * s, FORT_LAVA, 0.45, 2, 16 * s);
      ctx.restore();
      PFX.disc(ctx, this.x, this.y + 2, 34 * s, 12 * s, '#1a0a0a');
      PFX.disc(ctx, this.x, this.y + 2, 22 * s, 7 * s, '#a8200e');
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + time * 0.8;
        const r = (12 + (i % 3) * 8) * s;
        const bx = this.x + Math.cos(a) * r;
        const by = this.y + Math.sin(a) * r * 0.4 - Math.abs(Math.sin(time * 9 + i)) * 4 + heave;
        PFX.disc(ctx, bx, by, (5 + (i % 2) * 2) * s, (4 + (i % 2)) * s, i % 2 ? '#4a1a18' : '#602420');
        PFX.disc(ctx, bx - 1, by - 1, 2 * s, 1.5 * s, '#7c3226');
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 150, 60, 0.75)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + this.x * 0.02;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * 14 * s, this.y + Math.sin(a) * 5 * s);
        ctx.lineTo(this.x + Math.cos(a + 0.2) * 40 * s, this.y + Math.sin(a + 0.2) * 15 * s);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (this.state === 'surface') {
      const k = clamp(this.t / this.cfg.bite.windup, 0, 1);
      Telegraph.circle(ctx, this.x, this.y, this.cfg.bite.radius * s, k, '255, 120, 40');
      // cracks spreading out from where it will come up, glowing hotter
      ctx.save();
      ctx.strokeStyle = `rgba(255, ${140 + Math.round(k * 100)}, 60, ${0.5 + k * 0.5})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + this.x * 0.01;
        const len = this.cfg.bite.radius * s * k;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(a) * len * 0.5 + Math.sin(a * 3) * 6, this.y + Math.sin(a) * len * 0.28);
        ctx.lineTo(this.x + Math.cos(a) * len, this.y + Math.sin(a) * len * 0.55);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    // the hole: torn floor round a pit glowing with lava
    PFX.disc(ctx, this.x, this.y + 2, 40 * s, 16 * s, '#1a0a0a');
    PFX.disc(ctx, this.x, this.y + 2, 30 * s, 11 * s, '#7a1206');
    PFX.disc(ctx, this.x, this.y + 3, 20 * s, 6 * s, '#e0461e');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y, 50 * s, FORT_LAVA, 0.4, 2, 20 * s);
    ctx.restore();
    if (this.state === 'arrow' && this.arrowAt) {
      Telegraph.circle(ctx, this.arrowAt.x, this.arrowAt.y, this.cfg.arrow.blastRadius, clamp(this.t / this.cfg.arrow.windup, 0, 1), '255, 120, 40');
    }
  }

  /** Its body: a chain of rock segments rising out of the hole in an arc to its head, leaning at the hero. */
  drawBody(ctx) {
    if (this.rise <= 0.02) return;
    const S = Sprites.flameworm;
    const s = this.scale;
    const h = this.head;
    const n = 9;
    const flash = this.flashTime > 0;
    const pts = [];
    // it bows out to one side as it rears (away from where it leans), an S that ripples as it sways
    const bow = (Math.cos(this.aim) >= 0 ? -1 : 1) * 30 * s * this.rise;
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      // up out of the hole, curving over toward where its head leans
      const x = lerp(this.x, h.x, k * k) + Math.sin(k * Math.PI) * bow + Math.sin(this.sway + k * 4) * 5 * this.rise;
      const y = lerp(this.y, h.y, Math.sin((k * Math.PI) / 2));
      pts.push({ x, y, k });
    }
    for (const pt of pts) {
      const img = S.segment;
      const sc = s * (1.05 - pt.k * 0.3);
      const w = Math.round(img.width * sc);
      const hh = Math.round(img.height * sc);
      ctx.drawImage(img, Math.round(pt.x - w / 2), Math.round(pt.y - hh / 2), w, hh);
      if (flash) { ctx.save(); ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, Math.round(pt.x - w / 2), Math.round(pt.y - hh / 2), w, hh); ctx.restore(); }
    }
    // the head: maw open while it bites, sprays or holds the arrow; clamped shut otherwise
    const open = ['emerge', 'spray', 'arrow'].includes(this.state);
    const img = open ? S.head : S.headClosed;
    const sc = s * 0.95;
    const w = Math.round(img.width * sc);
    const hh = Math.round(img.height * sc);
    ctx.drawImage(img, Math.round(h.x - w / 2), Math.round(h.y - hh / 2), w, hh);
    if (flash) { ctx.save(); ctx.globalAlpha = 0.6; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, Math.round(h.x - w / 2), Math.round(h.y - hh / 2), w, hh); ctx.restore(); }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, h.x, h.y + 4, (open ? 28 : 16) * s, FORT_LAVA, open ? 0.6 : 0.3);
    if (this.state === 'arrow') {
      // the arrow forming in its jaws: violet magic round a heart of fire
      const k = clamp(this.t / this.cfg.arrow.windup, 0, 1);
      PFX.glow(ctx, h.x, h.y + 6, 10 + k * 26, FORT_MAGIC, 0.5 + k * 0.5);
      PFX.glow(ctx, h.x, h.y + 6, 6 + k * 12, '255, 200, 90', 0.8);
    }
    ctx.restore();
    if (this.state === 'arrow') PFX.flame(ctx, h.x, h.y + 10, 10, 16, this.t * 14, FORT_FIRE);
    // the front lip of its hole, over the bottom of its body
    PFX.ring(ctx, this.x, this.y + 4, 34 * s, 13 * s, '#3a1a18', 2, { thick: 3, from: 0.15, to: Math.PI - 0.15 });
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
    this.worms = [new FlamewormBody(this, x, y, c.hp, 1)];
    this.worms[0].state = 'intro';
    // a stand-in worm, reared up with its maw open, for its title card
    this.portrait = new FlamewormBody(this, x, y, 1, 1);
    Object.assign(this.portrait, { rise: 1, state: 'spray', aim: 0.3 });
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
      const top = w.rise > 0.1 ? w.head.y - 46 * w.scale : w.y - 30;
      return { part: w, x: w.x, y: top, w: Math.round(100 * w.scale), color: '#ff8a2a', marker: this.split ? undefined : this.cfg.splitAt, locked: w.state === 'under' || w.state === 'surface', lockedText: 'BURROWED' };
    });
  }

  scaleHealth(k) {
    this.maxHp = Math.round(this.cfg.hp * k);
    for (const w of this.worms) { w.maxHp = this.maxHp; w.hp = this.maxHp; }
  }

  knockback() {}
  stun() {}
  takeDamage() { return false; }   // (the worms are what's hit)

  /** Below splitAt of its health the worm bursts apart into splitCount smaller worms, each with a share of what's left. */
  checkSplit(world) {
    if (this.split || this.hp > this.maxHp * this.cfg.splitAt) return;
    this.split = true;
    const old = this.worms[0];
    const c = this.cfg;
    const share = Math.max(1, Math.round(old.hp / c.splitCount));
    const b = world.dungeon.floorBounds;
    this.worms = [];
    for (let i = 0; i < c.splitCount; i++) {
      const a = (i / c.splitCount) * TAU + Math.PI / 2;
      const x = clamp(old.x + Math.cos(a) * 160, b.left + 60, b.right - 60);
      const y = clamp(old.y + Math.sin(a) * 100, b.top + 80, b.bottom - 40);
      const w = new FlamewormBody(this, x, y, share, c.splitScale);   // a full bar each, together what the worm had left
      w.digFor = 0.8 + i * 1.1;   // out of step: they come up one after another
      this.worms.push(w);
    }
    world.banner('THE FLAMEWORM SPLITS!', 'Three worms burrow away - each has its own health');
    world.effects.burst(old.head.x, old.head.y, { count: 70, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS, '#fff6c8'], speed: [120, 360], life: [0.5, 1.1], gravity: 380, size: [3, 6] });
    enemyBlastFx(world, old.x, old.y, 120);
    world.shake(12, 0.6);
    Sound.play('bossRoar');
    Sound.play('rockErupt');
  }

  /** A worm has fallen: the last one ends the fight. */
  onWormDown(w, world) {
    w.sinking = 2;
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
        world.effects.burst(this.x, this.y - 10, { count: 60, colors: [...FORT_ROCK_GIBS, ...FORT_LAVA_GIBS], speed: [120, 360], life: [0.5, 1.1], up: 200, gravity: 420, size: [2, 6] });
        world.shake(12, 0.6);
        Sound.play('rockErupt');
      }
      w.rise = Math.min(1, (at - FLAMEWORM_INTRO.burst) / (FLAMEWORM_INTRO.rise - FLAMEWORM_INTRO.burst));
      w.state = 'emerge';
      if (!this.roared && at >= FLAMEWORM_INTRO.rise) { this.roared = true; Sound.play('bossRoar'); }
    }
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
    const last = this.worms[this.worms.length - 1];
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
    if (this.intro > 0 && this.worms[0].rise <= 0) {
      // the floor cracking open over it during its entrance
      const k = clamp((FLAMEWORM_INTRO.total - this.intro) / FLAMEWORM_INTRO.burst, 0, 1);
      Telegraph.circle(ctx, this.x, this.y, this.cfg.bite.radius, k, '255, 120, 40');
      return;
    }
    for (const w of this.worms) w.drawGround(ctx, this.time);
  }

  getDrawables() {
    if (this.dead) return [];
    return this.worms.filter((w) => w.rise > 0.02).map((w) => ({ y: w.y + 4, draw: (ctx) => w.drawBody(ctx) }));
  }

  drawOverlay() {}

  /** Its title card portrait: one worm, reared up, maw open. */
  drawPortrait(ctx) { this.portrait.drawBody(ctx); }
}
