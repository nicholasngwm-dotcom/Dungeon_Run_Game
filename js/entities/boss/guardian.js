// =============================================================
//  THE GUARDIAN (the Ancient Ruins' other boss, any stage)
//
//  A floating figure of rock held together by the ruins' magic (see guardianSprites.js), drawn
//  from the great power crystals round its cavern: it rises out of the giant rocks lying in the
//  room as their magic lifts them and binds them together (see GUARDIAN_INTRO), and streams of
//  it flow from them into its chest all fight, slowly healing it. The heroes can break the crystals
//  (GuardianCrystal) to stop that.
//  It drifts round the room over every obstacle, its crystals shedding wisps of magic, and
//  takes turns between two attacks (CONFIG.guardian):
//    Beam:  a ring of magic bursts out of it, slowing every hero it passes (no damage); then its
//           chest crystal charges for 3s and it blasts a giant beam that turns slowly after the
//           hero. Obstacles stop the beam in phase 1.
//    Slams: ground slams in a row (4; 6 in phase 2). Odd slams make massive rock spikes erupt
//           where the hero is; every 2nd one where they're heading (in front of them).
//  Phase 2 (below half hp): its spikes grow bigger, its beam becomes a wrecking beam that smashes
//  through obstacles and tears up the floor, and broken crystals reform (each only once).
//  (x, y) is the ground point under it; it hovers above it.
// =============================================================

// Its power comes from the great crystals round its room (RuinsDecor.crystalRoom): streams of magic
// flow from them into it the whole fight, and it's their magic that raises it.
//
// The entrance, out of the giant rocks lying about the room: they tremble and rock where they lie
// (stir), tear free of the floor and rise on the crystals' magic (lift), drift together, turning, to
// where each belongs in its body (gather), then the magic binds them into one in a flash (bind) and
// its eyes open. Seconds from the start.
const GUARDIAN_INTRO = { stir: 1.2, lift: 2.1, gather: 3.6, bind: 4.15, total: 4.8 };
// where the giant rocks lie (tiles from the room's middle; see RuinsDecor.crystalRoom)
const GUARDIAN_ROCK_SPOTS = [[-3.8, -0.6], [3.6, -0.9], [-2.2, -2.7], [2.1, -2.8], [-2.7, 2.0], [2.9, 1.8], [-0.7, 3.0], [0.9, 2.9]];
// ...and where each one ends up in its body (from its anchor), at what size: chest, head, shoulders, arms, legs
const GUARDIAN_SLOTS = [
  { x: 0, y: -74, s: 1.3 }, { x: 0, y: -104, s: 0.62 }, { x: -27, y: -90, s: 0.8 }, { x: 27, y: -90, s: 0.8 },
  { x: -40, y: -60, s: 0.72 }, { x: 40, y: -60, s: 0.72 }, { x: -11, y: -36, s: 0.78 }, { x: 11, y: -36, s: 0.78 },
];
const smooth01 = (k) => { const c = clamp(k, 0, 1); return c * c * (3 - 2 * c); };

/**
 * One of the power crystals round its room, as something the heroes can break (it's one of the
 * Guardian's targets while whole). It wraps the room's decor item (d), which draws it: whole, broken
 * (d.broken: only its plinth and shards left) or reforming out of the magic (d.reform 0-1).
 */
class GuardianCrystal {
  constructor(d, guardian, hp) {
    this.d = d;
    this.guardian = guardian;
    this.maxHp = hp;
    this.hp = hp;
    this.radius = 18;
    this.broken = false;
    this.reform = 0;     // phase 2: seconds into reforming (0 = not)
    this.reformed = false;   // it has reformed once already: broken again, it stays broken
    this.flashTime = 0;
  }

  /** Phase 2 can bring it back: it's broken, and hasn't reformed before. */
  get canReform() { return this.broken && !this.reformed; }

  get x() { return this.d.x; }
  get y() { return this.d.y; }
  get hx() { return this.d.x; }
  get hy() { return this.d.y - 40; }
  get dead() { return this.broken; }
  /** The tip, where its stream of magic leaves it. */
  get top() { return { x: this.d.x, y: this.d.y - 62 }; }

  knockback() {}
  stun() {}

  takeDamage(amount, world) {
    if (this.broken) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    this.d.flash = 0.1;
    if (this.hp <= 0) this.shatter(world);
    return true;
  }

  /** It bursts apart: shards of crystal everywhere, its magic gone (until phase 2 reforms it, once). */
  shatter(world) {
    this.hp = 0;
    this.broken = true;
    this.reform = 0;
    this.d.broken = true;
    this.d.reform = 0;
    const { x } = this;
    const y = this.hy;
    world.effects.shards(x, y, { count: 22, speed: [120, 320], life: 0.7, len: [8, 16], width: 6, colors: RU.magic.slice(1, 5) });
    world.effects.burst(x, y, { count: 36, colors: ['#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], speed: [80, 260], life: [0.4, 0.9], gravity: 300 });
    world.effects.text(x, y - 30, this.reformed ? 'CRYSTAL DESTROYED FOR GOOD' : 'CRYSTAL SHATTERED', { color: '#5cf0d8', size: 8, life: 1.4 });
    world.shake(7, 0.3);
    Sound.play('glass');
    Sound.play('partBreak');
  }

  /** Phase 2: a broken crystal gathers itself back out of the magic, then shines whole again (only ever once). */
  updateReform(dt, world, time) {
    this.reform += dt;
    this.d.reform = clamp(this.reform / time, 0, 1);
    if (vrand(0, 1) < dt * 14) {
      // motes of magic drifting in to it
      const a = vrand(0, TAU);
      const r = vrand(24, 50);
      world.effects.burst(this.x + Math.cos(a) * r, this.hy + Math.sin(a) * r * 0.6, { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [0, 0], life: [0.3, 0.4], size: [1, 2] });
      const last = world.effects.particles[world.effects.particles.length - 1];
      if (last) { last.vx = -Math.cos(a) * r * 2.6; last.vy = -Math.sin(a) * r * 1.6; last.drag = 0; }
    }
    if (this.reform < time) return;
    this.broken = false;
    this.reformed = true;
    this.hp = this.maxHp;
    this.reform = 0;
    this.d.broken = false;
    this.d.reform = 0;
    world.effects.burst(this.x, this.hy, { count: 30, colors: ['#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], speed: [60, 200], life: [0.4, 0.8], up: 40 });
    world.effects.text(this.x, this.hy - 30, 'CRYSTAL REFORMED', { color: '#5cf0d8', size: 8, life: 1.4 });
    Sound.play('magic');
  }
}

class Guardian {
  constructor(x, y) {
    const c = CONFIG.guardian;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 30;          // hit radius round (hx, hy)
    this.time = 0;
    this.phase = 1;
    this.intro = GUARDIAN_INTRO.total;
    this.introAt = 0;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;

    this.state = 'float';      // float | wave | charge | beam | slam
    this.t = 0;
    this.attackTimer = 1.6;
    this.attackStep = 0;       // the attacks take turns: beam, slams, beam...
    this.orbit = rand(0, TAU);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;

    this.waves = [];           // magic shockwave rings: { x, y, r, hit }
    this.beam = null;          // { angle, end, tick }
    this.slam = null;          // { n (slams done), t, down (it has struck this slam) }
    this.spikes = [];          // spike zones: { x, y, t, erupted }
    this.rocks = null;         // the entrance's rocks (gatherRocks): { x0, y0, v, flip, seed, slot }
    this.powerCrystals = [];   // the room's power crystals (decor items) its magic flows from
    this.crystalParts = [];    // ...as things the heroes can break (GuardianCrystal), which heal it while whole
    this.crystalHp = CONFIG.guardian.crystals.hp;
  }

  get name() { return 'THE GUARDIAN'; }
  get title() { return 'Heart of the Ancient Ruins'; }
  get defeatText() { return 'The Guardian crumbles back into the ruins.'; }

  get bob() { return Math.sin(this.time * 1.8) * 4; }
  /** Where the sprite's anchor (its floating leg tips) is drawn. */
  get drawY() { return this.y - this.cfg.hover + this.bob - (this.slamLift || 0); }
  get hx() { return this.x; }
  get hy() { return this.drawY - 72; }
  /** The chest crystal: where the beam comes from. */
  get coreX() { return this.x + GUARDIAN_CORE.x; }
  get coreY() { return this.drawY + GUARDIAN_CORE.y; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead; }
  /** It, and every power crystal still whole (break them to stop them healing it). */
  getTargets() { return this.targetable ? [this, ...this.crystalParts.filter((c) => !c.broken)] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    const out = [{ part: this, x: this.x, y: this.drawY - GUARDIAN_SPRITE.ay - 6, w: 100, color: '#5cf0d8', marker: this.cfg.phase2At }];
    for (const c of this.crystalParts) {
      if (c.broken && !c.reform) continue;
      out.push({ part: c, x: c.x, y: c.y - 84, w: 36, color: '#9cf0d8', locked: c.broken, lockedText: 'REFORMING' });
    }
    return out;
  }

  /** The stage's (and party's) toughness: its own hp and its crystals'. */
  scaleHealth(k) {
    this.maxHp = Math.round(this.cfg.hp * k);
    this.hp = this.maxHp;
    this.crystalHp = Math.round(CONFIG.guardian.crystals.hp * k);
    for (const c of this.crystalParts) { c.maxHp = this.crystalHp; c.hp = Math.min(c.hp, c.maxHp); }
  }

  /**
   * The power crystals at work: every one still whole heals it (both phases), its magic flowing in
   * along its stream; in phase 2 the broken ones reform out of the magic.
   */
  updateCrystals(dt, world) {
    const c = CONFIG.guardian.crystals;
    for (const cr of this.crystalParts) {
      cr.flashTime -= dt;
      cr.d.flash = (cr.d.flash || 0) - dt;
      if (cr.broken) {
        if (this.phase === 2 && cr.canReform) cr.updateReform(dt, world, c.reform);
        continue;
      }
      if (this.hp >= this.maxHp) continue;
      const heal = c.heal * (this.maxHp / this.cfg.hp) * dt;
      this.hp = Math.min(this.maxHp, this.hp + heal);
      this.healShown = (this.healShown || 0) + heal;
    }
    // the healing shows as green numbers now and then, not every frame
    this.healTick = (this.healTick || 0) - dt;
    if (this.healTick <= 0 && this.healShown >= 1) {
      this.healTick = 0.8;
      world.effects.text(this.hx + vrand(-20, 20), this.hy - 50, `+${Math.round(this.healShown)}`, { color: '#6cff9a', size: 8 });
      this.healShown = 0;
    }
  }

  knockback() {}   // a mountain's worth of rock
  stun() {}

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.enterPhase2(world);
    return true;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.flashTime -= dt;
    if (this.intro > 0) return this.updateIntro(dt, world);
    this.updateWaves(dt, world);
    this.updateSpikes(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);

    this.t += dt;
    this.shedMagic(world);
    this.updateCrystals(dt, world);
    switch (this.state) {
      case 'float': this.updateFloat(dt, world); break;
      case 'waveWindup':
        // gathering the magic for the slowing ring: motes streaming in to its feet
        if (vrand(0, 1) < 0.7) {
          const a = vrand(0, TAU);
          const r = vrand(60, this.cfg.shockwave.radius * 0.6);
          world.effects.burst(this.waveAt.x + Math.cos(a) * r, this.waveAt.y + Math.sin(a) * r * 0.6, { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [0, 0], life: [0.3, 0.4], size: [1, 2] });
          const last = world.effects.particles[world.effects.particles.length - 1];
          if (last) { last.vx = -Math.cos(a) * r * 2.8; last.vy = -Math.sin(a) * r * 0.6 * 2.8; last.drag = 0; }
        }
        if (this.t >= this.cfg.shockwave.windup) this.releaseWave(world);
        break;
      case 'wave':
        // the ring is on its way out; the charge begins
        if (this.t >= 0.35) this.setState('charge');
        break;
      case 'charge': this.updateCharge(dt, world); break;
      case 'beam': this.updateBeam(dt, world); break;
      case 'slam': this.updateSlams(dt, world); break;
    }
    this.contactDamage(world);
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** Clamps a ground point into the room, leaving headroom for its tall body under the north wall. */
  clampToFloor(world, x, y) {
    const b = world.dungeon.floorBounds;
    return { x: clamp(x, b.left + 50, b.right - 50), y: clamp(y, b.top + 120, b.bottom - 24) };
  }

  /** Drifts toward a point, at most `speed` px/s (over anything: it floats). */
  driftToward(tx, ty, speed, dt) {
    const d = dist(this.x, this.y, tx, ty);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    this.x += ((tx - this.x) / d) * s;
    this.y += ((ty - this.y) / d) * s;
  }

  /** Wisps of magic drifting off its crystals (and, in phase 2, more of them). Visual only. */
  shedMagic(world) {
    if (vrand(0, 1) > (this.phase === 2 ? 0.5 : 0.25)) return;
    const k = GUARDIAN_CRYSTALS[Math.floor(vrand(0, GUARDIAN_CRYSTALS.length))];
    world.effects.smoke(this.x + k.x + vrand(-3, 3), this.drawY + k.y, { count: 1, radius: 5, life: vrand(0.7, 1.2), rise: -10, colors: ['#127068', '#22b8a6', '#5cf0d8'] });
  }

  // ---------- floating ----------

  updateFloat(dt, world) {
    const c = this.cfg;
    const p = world.player;
    this.orbit += dt * 0.5 * this.orbitDir;
    const t = this.clampToFloor(world, p.x + Math.cos(this.orbit) * c.orbitRadius, p.y + Math.sin(this.orbit) * c.orbitRadius * 0.6);
    this.driftToward(t.x, t.y, c.floatSpeed, dt);
    this.attackTimer -= dt;
    if (this.attackTimer <= 0 && !p.dead) {
      if (this.attackStep++ % 2 === 0) this.startBeam(world);
      else this.startSlams(world);
    }
  }

  toFloat() {
    this.setState('float');
    this.beam = null;
    this.slam = null;
    this.slamLift = 0;
    this.attackTimer = this.cfg.attackInterval[this.phase - 1];
    if (vrand(0, 1) < 0.35) this.orbitDir *= -1;
  }

  // ---------- the beam ----------

  /** A ring of magic bursts out (it slows, it doesn't hurt), then the chest starts to charge. */
  /**
   * The beam attack begins with the slowing ring: first it gathers the magic, its arms raised, while
   * the ring's whole reach glows on the floor round it (waveWindup, see drawWaveWarning)...
   */
  startBeam(world) {
    this.setState('waveWindup');
    this.waveAt = { x: this.x, y: this.y };
    Sound.play('windup');
    Sound.play('laserCharge', 0.1);
  }

  /** ...then releases it: the ring bursts out from under it, and the chest starts to charge. */
  releaseWave(world) {
    const { x, y } = this.waveAt;
    this.setState('wave');
    this.waves.push({ x, y, r: 10, hit: new Set() });
    this.beam = { angle: angleTo(this.coreX, this.coreY, world.player.hx, world.player.hy), end: null, tick: 0 };
    this.beam.end = this.beamEnd(world, this.beam.angle).end;
    world.effects.burst(this.coreX, this.coreY, { count: 24, colors: ['#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], speed: [80, 220], life: [0.3, 0.6] });
    world.effects.burst(x, y, { count: 30, colors: ['#5cf0d8', '#b8fff0', '#ffffff'], speed: [150, 320], life: [0.3, 0.6], up: 20 });
    world.shake(8, 0.3);
    Sound.play('stomp');
    Sound.play('magic');
    Sound.play('guardianCharge');
  }

  updateCharge(dt, world) {
    const c = this.cfg.beam;
    const p = world.player;
    const B = this.beam;
    // tracks the hero until just before it fires
    if (this.t < c.charge - c.lockAt && !p.dead) B.angle = angleTo(this.coreX, this.coreY, p.hx, p.hy);
    const aim = this.beamEnd(world, B.angle);
    B.end = aim.end;
    B.smash = aim.smash;   // phase 2: the cover it's about to blast through (marked on the aim line)
    if (vrand(0, 1) < 0.6) {
      // motes of magic streaming into the chest
      const a = vrand(0, TAU);
      const r = vrand(30, 60);
      world.effects.burst(this.coreX + Math.cos(a) * r, this.coreY + Math.sin(a) * r, { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [0, 0], life: [0.25, 0.35], size: [2, 3] });
      const last = world.effects.particles[world.effects.particles.length - 1];
      if (last) { last.vx = -Math.cos(a) * r * 3.5; last.vy = -Math.sin(a) * r * 3.5; last.drag = 0; }
    }
    if (this.t > c.charge * 0.6) world.shake(1.5, 0.1);
    if (this.t >= c.charge) {
      this.setState('beam');
      B.tick = 0;
      world.shake(10, 0.4);
      Sound.play('guardianBeam');
    }
  }

  /**
   * Where the beam stops along `angle` from the chest: at the walls always, and in phase 1 at any
   * obstacle too (cover, and the solid furniture and braziers that shots usually fly over). In
   * phase 2 it runs on through cover: `smash` is the first piece of cover it's going through.
   */
  beamEnd(world, angle) {
    const d = world.dungeon;
    const c = this.cfg.beam;
    const smash = this.phase >= 2;
    const step = 6;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let x = this.coreX;
    let y = this.coreY;
    let clear = false;   // fired from high up over the room: it only starts hitting things once it's over open floor
    let hit = null;
    for (let l = 0; l < c.length; l += step) {
      const tile = d.tileAt(Math.floor(x / d.T), Math.floor(y / d.T));
      if (tile === TILE.FLOOR) {
        clear = true;
        if (!smash && d.postAt?.(x, y, 0)) break;
      } else if (clear) {
        if (!(smash && tile === TILE.COVER)) break;
        hit ||= { x, y };
      }
      x += dx;
      y += dy;
    }
    return { end: { x, y }, smash: hit };
  }

  updateBeam(dt, world) {
    const c = this.cfg.beam;
    const p = world.player;
    const B = this.beam;
    // turns after the hero, slowly
    if (!p.dead) {
      const want = angleTo(this.coreX, this.coreY, p.hx, p.hy);
      const turn = c.turn[this.phase - 1] * dt;
      B.angle += clamp(angleDiff(B.angle, want), -turn, turn);
    }
    const ray = this.beamEnd(world, B.angle);
    B.end = ray.end;
    // phase 2: it blasts straight through whatever cover is in its way, and tears up the floor as it sweeps
    if (ray.smash && world.run && world.run.destroyObstacles(ray.smash.x, ray.smash.y, 14)) this.smashFx(world, ray.smash.x, ray.smash.y);
    if (this.phase === 2) this.scorch(dt, world, B);
    // whoever's in it is hurt every tick
    B.tick -= dt;
    if (B.tick <= 0) {
      B.tick += c.tick;
      for (const a of world.allies) {
        if (a.dead || a.prop) continue;
        if (pointSegmentDistance(a.hx, a.hy, this.coreX, this.coreY, B.end.x, B.end.y) < c.width[this.phase - 1] / 2 + (a.radius || 10)) {
          a.hurt(this.phase === 2 ? c.damage2 : c.damage, world, this.coreX, this.coreY, { projectile: true });
        }
      }
    }
    // sparks and scorching where it strikes
    if (vrand(0, 1) < 0.8) {
      world.effects.burst(B.end.x, B.end.y, { count: 2, colors: ['#5cf0d8', '#b8fff0', '#ffffff'], speed: [60, 180], life: [0.15, 0.35] });
    }
    world.shake(2, 0.08);
    if (this.t >= c.time) {
      world.effects.burst(this.coreX, this.coreY, { count: 18, colors: ['#22b8a6', '#5cf0d8', '#ffffff'], speed: [40, 140], life: [0.3, 0.6] });
      this.toFloat();
    }
  }

  /** Phase 2: the beam blasting through a piece of cover - it explodes into rubble and a fireball of magic. */
  smashFx(world, x, y) {
    world.effects.burst(x, y - 10, { count: 40, colors: ['#2e342d', '#5c6558', '#a0a892', '#5cf0d8', '#ffffff'], speed: [120, 360], life: [0.4, 0.9], up: 160, gravity: 480, size: [2, 6] });
    world.effects.smoke(x, y - 6, { count: 8, radius: 26, life: 1.2, rise: 30, colors: ['#3a3430', '#5a524a', '#8a8070'] });
    world.effects.text(x, y - 40, 'SMASHED!', { color: '#b8fff0', size: 9, life: 1 });
    world.effects.add(0.45, (ctx, k) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k;
      PFX.glow(ctx, x, y - 10, 30 + k * 40, RUIN_MAGIC, 1.4, 2);
      const r = 14 + k * 70;
      PFX.ring(ctx, x, y, r, r * 0.6, '#b8fff0', 2, { thick: k < 0.3 ? 3 : 1 });
      ctx.restore();
    });
    world.shake(12, 0.35);
    Sound.play('rockErupt', 0.05);
    Sound.play('explosion', 0.1);
  }

  /**
   * Phase 2: where the beam strikes the floor it tears it up: a molten trench of scorched stone glowing
   * teal at its edges (fading over a few seconds), chunks of floor kicked up, sparks, a rumble.
   */
  scorch(dt, world, B) {
    B.scorchT = (B.scorchT || 0) - dt;
    if (B.scorchT > 0) return;
    B.scorchT = 0.05;
    const { x, y } = B.end;
    const seed = vrand(0, 10);
    world.effects.add(2.6, (ctx, k) => {
      const hot = Math.max(0, 1 - k * 2.5);
      PFX.disc(ctx, x, y, 20, 10, `rgba(18, 14, 12, ${0.55 * (1 - k)})`, 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.disc(ctx, x + Math.sin(seed) * 3, y, 13, 6, `rgba(92, 240, 216, ${0.5 * hot})`, 2);
      PFX.disc(ctx, x, y, 6, 3, `rgba(255, 255, 255, ${0.6 * hot})`, 2);
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 4, { count: 3, colors: ['#2e342d', '#5c6558', '#a0a892'], speed: [80, 220], life: [0.35, 0.7], up: 140, gravity: 520, size: [2, 4] });
    world.effects.burst(x, y - 4, { count: 3, colors: ['#5cf0d8', '#b8fff0', '#ffffff'], speed: [100, 260], life: [0.15, 0.35] });
    if (vrand(0, 1) < 0.3) world.effects.smoke(x, y, { count: 1, radius: 14, life: 0.8, rise: 24, colors: ['#3a3430', '#5a524a', '#8a8070'] });
    world.shake(3.5, 0.08);
  }

  /** The slowing rings sweep outward; each slows every hero it passes over, once. */
  updateWaves(dt, world) {
    const c = this.cfg.shockwave;
    for (const w of this.waves) {
      w.r += c.speed * dt;
      if (w.r >= c.radius) { w.dead = true; continue; }
      // sparks thrown off its leading edge (visual only)
      for (let i = 0; i < 3; i++) {
        const a = vrand(0, TAU);
        world.effects.burst(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r * 0.6, { count: 1, colors: ['#5cf0d8', '#b8fff0', '#ffffff'], speed: [10, 40], life: [0.2, 0.45], up: 30, size: [1, 2] });
      }
      for (const p of world.heroes) {
        // where the hero is on the ring's flattened (floor) ellipse, matching what's drawn
        const d = Math.hypot(p.x - w.x, (p.y - w.y) / 0.6);
        if (w.hit.has(p) || p.dead || d > w.r + 6 || d < w.r - c.band) continue;
        w.hit.add(p);
        if (p.blocksShockwave?.(w.x, w.y)) {
          world.effects.text(p.hx, p.hy - 28, 'BLOCKED', { color: '#e4e7ee', size: 7 });
          continue;
        }
        if (p.isInvulnerable || p.brews?.purity) continue;
        p.slowTime = Math.max(p.slowTime || 0, c.slow);
        world.effects.text(p.hx, p.hy - 34, 'SLOWED!', { color: '#5cf0d8', size: 9 });
        world.effects.burst(p.hx, p.hy, { count: 14, colors: ['#22b8a6', '#5cf0d8', '#b8fff0'], speed: [40, 120], life: [0.3, 0.6] });
      }
    }
    removeDead(this.waves);
  }

  // ---------- slams ----------

  startSlams() {
    this.setState('slam');
    this.slam = { n: 0, t: 0, down: false };
  }

  /**
   * Raises its fists (windup), slams: rock spikes will erupt at the hero (the 1st, 3rd, 5th slam) or
   * in front of them (every 2nd). Then the next, until all of them (4, or 6 in phase 2) are done.
   */
  updateSlams(dt, world) {
    const c = this.cfg.slams;
    const S = this.slam;
    const p = world.player;
    S.t += dt;
    // it rises as it raises its fists, and drops as it slams
    this.slamLift = S.down ? Math.max(0, (this.slamLift || 0) - dt * 200) : Math.min(14, (S.t / c.windup) * 14);
    if (!S.down && S.t >= c.windup) {
      S.down = true;
      const lead = S.n % 2 === 1;
      const dir = p.moving && p.moveDir ? p.moveDir : { x: p.facing || 1, y: 0 };
      const at = this.clampToFloor(world, p.x + (lead ? dir.x * c.lead : 0), p.y + (lead ? dir.y * c.lead : 0));
      const size = this.phase === 2 ? c.phase2Size : 1;
      this.spikes.push({ x: at.x, y: Math.min(at.y, world.dungeon.floorBounds.bottom - 10), t: 0, erupted: false, r: c.spikeRadius * size, size });
      world.shake(9, 0.3);
      Sound.play('impact');
      world.effects.burst(this.x, this.y, { count: 22, colors: ['#5c6558', '#7a8372', '#a0a892', '#22b8a6'], speed: [80, 220], life: [0.3, 0.6], up: 60, gravity: 400 });
      this.groundRing(world);
    }
    if (S.t >= c.every) {
      S.n++;
      if (S.n >= c.count[this.phase - 1]) return this.toFloat();
      S.t = 0;
      S.down = false;
    }
  }

  /** A ring of dust thrown out across the floor by a slam (visual only). */
  groundRing(world) {
    const { x, y } = this;
    world.effects.add(0.45, (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      const r = 20 + k * 90;
      PFX.ring(ctx, x, y, r, r * 0.5, '#a0a892', 2, { thick: k < 0.4 ? 2 : 1 });
      ctx.restore();
    }, true);
  }

  /** Each spike zone glows, then spikes of rock erupt across it, hurting anyone inside once. */
  updateSpikes(dt, world) {
    const c = this.cfg.slams;
    for (const s of this.spikes) {
      s.t += dt;
      if (!s.erupted && s.t >= c.spikeDelay) {
        s.erupted = true;
        for (const a of world.allies) {
          if (a.dead || a.prop || dist(a.x, a.y, s.x, s.y) > s.r + (a.radius || 8) * 0.5) continue;
          a.hurt(c.damage, world, s.x, s.y);
        }
        world.effects.burst(s.x, s.y - 6, { count: 44, colors: ['#2e342d', '#5c6558', '#a0a892', '#c8cebb'], speed: [100, 320], life: [0.4, 0.9], up: 220, gravity: 520, size: [2, 6] });
        world.effects.smoke(s.x, s.y, { count: 6, radius: s.r * 0.5, life: 0.8, rise: 20, colors: ['#3a3430', '#5a524a', '#8a8070'] });
        world.shake(12, 0.3);
        Sound.play('rockErupt', 0.05);
        this.rocksFly(world, s);
        // where each spike stands (seeded off the spot, so it's the same on every screen)
        // massive: one towering spike in the middle, a ring of big ones leaning outward round it, smaller
        // ones at the edge, bursting up from the middle out in a quick ripple (delay)
        // (all of it s.size x bigger in phase 2)
        const R = s.r;
        const k = s.size;
        const turn = s.x * 0.01;
        s.rocks = [{ dx: 0, dy: 0, h: 130 * k, w: 42 * k, lean: 0, delay: 0 }];
        for (let i = 0; i < 6; i++) {
          const a = turn + (i / 6) * TAU;
          s.rocks.push({ dx: Math.cos(a) * R * 0.5, dy: Math.sin(a) * R * 0.3, h: (70 + ((i * 5) % 3) * 14) * k, w: (26 + (i % 2) * 6) * k, lean: Math.cos(a) * 18 * k, delay: 0.03 + (i % 3) * 0.015 });
        }
        for (let i = 0; i < 6; i++) {
          const a = turn + ((i + 0.5) / 6) * TAU;
          s.rocks.push({ dx: Math.cos(a) * R * 0.88, dy: Math.sin(a) * R * 0.53, h: (38 + (i % 3) * 8) * k, w: (16 + (i % 2) * 4) * k, lean: Math.cos(a) * 14 * k, delay: 0.07 + (i % 2) * 0.02 });
        }
      }
      if (s.t >= c.spikeDelay + c.spikeTime) s.dead = true;
    }
    removeDead(this.spikes);
  }

  /**
   * Rocks blasting up out of the ground where the spikes erupt: chunks of stone thrown high, tumbling
   * as they arc out and crash back down, a ring of dust bursting outward (visual only).
   */
  rocksFly(world, s) {
    const R = s.r;
    const chunks = Array.from({ length: 12 }, (_, i) => {
      const a = vrand(0, TAU);
      const r = vrand(0, R * 0.8);
      return { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * 0.6, vx: Math.cos(a) * vrand(30, 110), vy: Math.sin(a) * vrand(15, 50), up: vrand(220, 420), spin: vrand(-14, 14), v: i % 3, big: i < 4 };
    });
    const life = 1.1;
    world.effects.add(life, (ctx, k) => {
      const t = k * life;
      for (const c of chunks) {
        const h = c.up * t - 0.5 * 900 * t * t;   // thrown up, falling back
        if (h < -2) continue;
        const x = c.x + c.vx * t;
        const y = c.y + c.vy * t;
        drawShadow(ctx, x, y + 1, 4, 2, 0.25 * clamp(1 - h / 200, 0, 1));
        const img = Sprites.guardian.chunks[c.v];
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y - Math.max(0, h)));
        ctx.rotate(c.spin * t);
        if (c.big) ctx.scale(1.6, 1.6);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
    });
    // the ground bursting: a ring of dust and grit racing outward
    world.effects.add(0.5, (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - k);
      const r = R * (0.6 + k * 0.8);
      PFX.ring(ctx, s.x, s.y, r, r * 0.6, '#8a8070', 2, { thick: k < 0.3 ? 3 : 1 });
      ctx.restore();
    }, true);
    world.effects.burst(s.x, s.y - 4, { count: 16, colors: ['#3a3430', '#5a524a', '#8a8070'], speed: [100, 220], life: [0.3, 0.6], up: 20, size: [2, 4] });
  }

  /** Touching its shadow hurts. */
  contactDamage(world) {
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < this.cfg.contactRadius + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  // ---------------------------------------------------------
  //  EVENTS
  // ---------------------------------------------------------

  enterPhase2(world) {
    this.phase = 2;
    world.banner('THE GUARDIAN UNLEASHES THE MAGIC', 'Its beam breaks through cover now');
    Sound.play('bossRoar');
    world.shake(10, 0.6);
    // a great burst of magic from every crystal
    world.effects.burst(this.hx, this.hy, { count: 60, colors: ['#127068', '#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], speed: [100, 320], life: [0.5, 1.1], size: [2, 5] });
    const { x, y } = this;
    world.effects.add(0.8, (ctx, k) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k;
      const r = 30 + k * 300;
      PFX.ring(ctx, x, y, r, r * 0.6, '#5cf0d8', 2, { thick: k < 0.3 ? 4 : 2 });
      ctx.restore();
    }, true);
  }

  die(world) {
    this.dying = 2.6;
    this.beam = null;
    this.slam = null;
    this.waves = [];
    this.spikes = [];
    this.slamLift = 0;
    Sound.play('bossRoar');
    world.banner('THE GUARDIAN FALLS!', '');
  }

  /** The magic leaves it: crystals flicker out and rocks shake loose, then it collapses into rubble. */
  updateDeath(dt, world) {
    this.dying -= dt;
    this.burstT = (this.burstT || 0) - dt;
    if (this.burstT <= 0) {
      this.burstT = 0.18;
      this.flashTime = 0.08;
      world.effects.burst(this.hx + rand(-34, 34), this.hy + rand(-50, 40), { count: 12, colors: ['#2e342d', '#5c6558', '#a0a892', '#5cf0d8'], speed: [60, 200], life: [0.3, 0.7], gravity: 400, size: [2, 5] });
      world.shake(5, 0.2);
      Sound.play('partBreak', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 90, colors: ['#1c201c', '#444c42', '#7a8372', '#a0a892', '#22b8a6', '#b8fff0'], speed: [100, 340], life: [0.6, 1.4], gravity: 380, size: [3, 6] });
      world.effects.smoke(this.x, this.y - 10, { count: 14, radius: 50, life: 1.4, rise: 30, colors: ['#3a3430', '#5a524a', '#8a8070'] });
      if (world.run) world.run.rubble.push(...Array.from({ length: 6 }, (_, i) => ({ x: this.x + (i - 2.5) * 12, y: this.y + (i % 2) * 8, material: 'stone', seed: i * 5 + 3 })));
      world.shake(14, 0.7);
      Sound.play('explosion');
      world.onBossDefeated();
    }
  }

  /**
   * The giant rocks lying in its room become its body: they're taken out of the room's decor (and
   * stop being solid), each given its place in the body. A room without them (the test arena) gets
   * them anyway, lying round where it will rise. Its power crystals are found too.
   */
  gatherRocks(world) {
    const run = world.run;
    const T = world.dungeon.T || 32;
    const items = run ? run.decor.items.filter((d) => d.kind === 'guardianRock' && !d.dead && dist(d.x, d.y, this.x, this.y) < 12 * T) : [];
    this.rocks = items.slice(0, GUARDIAN_SLOTS.length).map((d, i) => {
      if (d.post) world.dungeon.removePost(d.post);
      d.dead = true;
      return { x0: d.x, y0: d.y, v: d.v || 0, flip: d.facing < 0, seed: d.seed, slot: GUARDIAN_SLOTS[i] };
    });
    while (this.rocks.length < GUARDIAN_SLOTS.length) {
      const i = this.rocks.length;
      const [dx, dy] = GUARDIAN_ROCK_SPOTS[i];
      this.rocks.push({ x0: this.x + dx * T, y0: this.y + 20 + dy * T, v: i % 4, flip: i % 2 === 1, seed: i * 1.7, slot: GUARDIAN_SLOTS[i] });
    }
    this.powerCrystals = run ? run.decor.items.filter((d) => d.kind === 'powerCrystal' && dist(d.x, d.y, this.x, this.y) < 16 * T) : [];
    this.crystalParts = this.powerCrystals.map((d) => { d.broken = false; d.reform = 0; return new GuardianCrystal(d, this, this.crystalHp); });
  }

  /**
   * Where rock `rk` is at entrance time e: { x, y (its middle), ground (the floor under it), h (how
   * high it is off the floor), rot, scale }.
   */
  rockPose(rk, e) {
    const I = GUARDIAN_INTRO;
    const s = rk.seed;
    const lie = rk.y0 - 15;   // a rock lying on the floor: its middle
    if (e < I.stir) {
      // trembling where it lies, rocking and hopping a little, more and more
      const k = e / I.stir;
      const hop = Math.max(0, Math.sin(e * 11 + s * 3)) ** 4 * 3 * k;
      return { x: rk.x0 + Math.sin(e * 47 + s) * 1.4 * k, y: lie - hop, ground: rk.y0, h: hop, rot: Math.sin(e * 23 + s) * 0.05 * k, scale: 1 };
    }
    if (e < I.lift) {
      // torn free, rising slowly on the magic, wobbling
      const k = smooth01((e - I.stir) / (I.lift - I.stir));
      const h = k * 30 + Math.sin(e * 5 + s) * 2 * k;
      return { x: rk.x0 + Math.sin(e * 3 + s) * 3 * k, y: lie - h, ground: rk.y0, h, rot: Math.sin(e * 2.5 + s) * 0.18 * k, scale: 1 };
    }
    // drifting together along an arc (up and in), turning to fit, shrinking or growing to its place
    const tx = this.x + rk.slot.x;
    const ty = this.drawY + rk.slot.y;
    const k = smooth01((e - I.lift) / (I.gather - I.lift));
    const sx = rk.x0 + Math.sin(I.lift * 3 + s) * 3;
    const sy = lie - 30;
    const cx = (sx + tx) / 2 + Math.sin(s * 5) * 30;
    const cy = Math.min(sy, ty) - 50;
    const u = 1 - k;
    const x = u * u * sx + 2 * u * k * cx + k * k * tx;
    const y = u * u * sy + 2 * u * k * cy + k * k * ty;
    // once in place it settles, a last shiver as the magic takes hold
    const settle = e > I.gather ? Math.sin((e - I.gather) * 30) * 1.5 * Math.max(0, 1 - (e - I.gather) * 3) : 0;
    const ground = lerp(rk.y0, this.y, k);
    return { x: x + settle, y, ground, h: ground - y, rot: (Math.sin(s) * 0.5 + Math.sin(e * 4 + s) * 0.2) * u, scale: lerp(1, rk.slot.s, k) };
  }

  /** The entrance (see GUARDIAN_INTRO): rumbling, the rocks tearing free and rising, coming together, then the bind. */
  updateIntro(dt, world) {
    const I = GUARDIAN_INTRO;
    if (!this.rocks) this.gatherRocks(world);
    const before = this.introAt;
    this.introAt += dt;
    this.intro = Math.max(0, I.total - this.introAt);
    const e = this.introAt;
    const crossed = (at) => before < at && e >= at;
    if (crossed(0.05)) Sound.play('graveRumble');
    if (crossed(I.stir * 0.5)) Sound.play('graveRumble');
    // the ground shaking, harder and harder until the rocks come together
    if (e < I.gather) world.shake(0.8 + Math.min(1, e / I.lift) * 2.5, 0.1);
    for (const rk of this.rocks) {
      const p = this.rockPose(rk, e);
      // dust kicked up by the trembling rocks, grit and pebbles falling off them once they're up
      if (e < I.stir && vrand(0, 1) < dt * 3) world.effects.burst(rk.x0 + vrand(-14, 14), rk.y0, { count: 2, colors: ['#5a524a', '#8a8070'], speed: [10, 40], life: [0.3, 0.6], up: 20 });
      if (e > I.stir && e < I.gather && vrand(0, 1) < dt * 5) world.effects.burst(p.x + vrand(-10, 10), p.y + 8, { count: 1, colors: ['#5c6558', '#7a8372', '#2e342d'], speed: [0, 15], life: [0.5, 0.9], gravity: 500, size: [1, 3] });
      if (e > I.stir && e < I.bind && vrand(0, 1) < dt * 4) world.effects.burst(p.x + vrand(-8, 8), p.y + vrand(-6, 6), { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [5, 20], life: [0.3, 0.6], up: 10, size: [1, 2] });
    }
    if (crossed(I.stir)) {
      // they tear free of the floor: earth breaking round each one, a crunch
      for (const rk of this.rocks) {
        world.effects.burst(rk.x0, rk.y0 - 2, { count: 10, colors: ['#3a3430', '#5a524a', '#8a8070', '#5c6558'], speed: [40, 130], life: [0.3, 0.7], up: 60, gravity: 420, size: [1, 3] });
        world.effects.smoke(rk.x0, rk.y0, { count: 3, radius: 16, life: 0.9, rise: 14, colors: ['#3a3430', '#5a524a', '#8a8070'] });
      }
      world.shake(6, 0.3);
      Sound.play('rockErupt');
      Sound.play('magic', 0.1);
    }
    if (crossed(I.gather)) {
      // they come together with a grinding crash
      world.shake(10, 0.4);
      Sound.play('impact');
      Sound.play('stomp');
      world.effects.burst(this.x, this.drawY - 70, { count: 36, colors: ['#5c6558', '#a0a892', '#2e342d', '#22b8a6'], speed: [80, 240], life: [0.4, 0.9], gravity: 380, size: [2, 5] });
    }
    if (crossed(I.bind)) {
      // the magic binds it into one: a blinding flash, a ring of light racing out, its crystals ablaze
      world.shake(14, 0.6);
      Sound.play('explosion');
      Sound.play('magic');
      world.effects.burst(this.coreX, this.coreY, { count: 60, colors: ['#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], speed: [120, 360], life: [0.4, 1] });
      const { x, y } = this;
      world.effects.add(0.8, (ctx, k) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        const r = 30 + k * 320;
        PFX.ring(ctx, x, y, r, r * 0.6, '#5cf0d8', 2, { thick: k < 0.3 ? 4 : 2 });
        ctx.restore();
      }, true);
    }
  }

  /**
   * The streams of magic flowing from the power crystals: into the rising rocks during the entrance,
   * into its chest the rest of the fight (surging while the beam charges and fires). [{ from, to, k }]
   */
  streams() {
    const out = [];
    const cs = this.crystalParts.filter((c) => !c.broken);
    if (!cs.length || this.dead || this.dying > 0) return out;
    const I = GUARDIAN_INTRO;
    const e = this.introAt;
    const top = (c) => c.top;
    if (this.intro > 0 && e < I.bind) {
      // each rock is lifted by the crystal nearest it
      const k = clamp((e - I.stir * 0.4) / (I.stir * 0.6), 0, 1);
      if (k <= 0) return out;
      for (const rk of this.rocks || []) {
        const c = cs.reduce((a, b) => (dist(a.x, a.y, rk.x0, rk.y0) <= dist(b.x, b.y, rk.x0, rk.y0) ? a : b));
        const p = this.rockPose(rk, e);
        out.push({ crystal: c.d, from: top(c), to: { x: p.x, y: p.y }, k: k * 0.8 });
      }
      return out;
    }
    const surge = this.state === 'charge' ? 0.6 + clamp(this.t / this.cfg.beam.charge, 0, 1) * 0.6 : this.state === 'beam' ? 1.2 : 0.5;
    const k = (this.intro > 0 ? clamp((e - I.bind) / 0.4, 0, 1) : 1) * (surge + (this.phase === 2 ? 0.15 : 0));
    for (const c of cs) out.push({ crystal: c.d, from: top(c), to: { x: this.coreX, y: this.coreY }, k });
    return out;
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  /**
   * The slowing ring's warning while it gathers the magic: the whole area it will sweep glows teal on
   * the floor, a dashed rim pulsing faster and faster, the glow filling out from under it to the rim,
   * and "SLOW" marked round the edge - get out of its reach, or dodge through it.
   */
  drawWaveWarning(ctx) {
    const sw = this.cfg.shockwave;
    const { x, y } = this.waveAt;
    const R = sw.radius;
    const k = clamp(this.t / sw.windup, 0, 1);
    const pulse = 0.5 + Math.sin(this.time * (8 + k * 20)) * 0.5;
    ctx.save();
    PFX.disc(ctx, x, y, R, R * 0.6, `rgba(34, 184, 166, ${0.1 + k * 0.08})`, 3);
    PFX.disc(ctx, x, y, R * k, R * k * 0.6, `rgba(92, 240, 216, ${0.16 + pulse * 0.08})`, 3);
    ctx.globalCompositeOperation = 'lighter';
    PFX.ring(ctx, x, y, R, R * 0.6, `rgba(92, 240, 216, ${0.55 + pulse * 0.4})`, 2, { dash: [8, 6], spin: -this.time * 1.5, thick: 2 });
    PFX.ring(ctx, x, y, R * k, R * k * 0.6, `rgba(255, 255, 255, ${0.5 + k * 0.4})`, 2, { thick: 2 });
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      HUD.text(ctx, 'SLOW', Math.round(x + Math.cos(a) * R * 0.82), Math.round(y + Math.sin(a) * R * 0.6 * 0.82) - 4, { size: 7, align: 'center', color: pulse > 0.5 ? '#b8fff0' : '#5cf0d8' });
    }
  }

  /** The rising rocks' shadows, the slowing rings, spike warnings and spikes. */
  drawGround(ctx) {
    if (this.dead) return;
    const c = this.cfg;
    if (this.intro <= 0) drawShadow(ctx, this.x, this.y + 4, 30 - this.bob, 9, 0.3);
    else if (this.rocks) {
      // the rising rocks' shadows, shrinking and fading as they go up
      for (const rk of this.rocks) {
        const p = this.rockPose(rk, this.introAt);
        const k = clamp(1 - p.h / 160, 0.3, 1) * (1 - clamp((this.introAt - GUARDIAN_INTRO.bind) / 0.45, 0, 1));
        drawShadow(ctx, p.x, p.ground + 2, 16 * p.scale * k + 4, 5 * k + 1, 0.35 * k);
      }
      drawShadow(ctx, this.x, this.y + 4, 30 * smooth01((this.introAt - GUARDIAN_INTRO.lift) / 2), 9, 0.3);
    }
    if (this.state === 'waveWindup') this.drawWaveWarning(ctx);
    // the slowing rings sweeping out: a thick band of magic, bright at its leading edge, chevrons on it pointing out
    for (const w of this.waves) {
      const sw = c.shockwave;
      const k = w.r / sw.radius;
      const fade = Math.min(1, (1 - k) * 4);
      ctx.save();
      PFX.disc(ctx, w.x, w.y, w.r, w.r * 0.6, `rgba(18, 112, 104, ${0.18 * fade})`, 3);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const r = Math.max(1, w.r - (i / 5) * sw.band);
        PFX.ring(ctx, w.x, w.y, r, r * 0.6, `rgba(92, 240, 216, ${(0.75 - i * 0.13) * fade})`, 2, { thick: 2 });
      }
      PFX.ring(ctx, w.x, w.y, w.r + 2, (w.r + 2) * 0.6, `rgba(255, 255, 255, ${0.9 * fade})`, 2, { thick: 2 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + this.time * 0.6;
        const cx = w.x + Math.cos(a) * (w.r - sw.band / 2);
        const cy = w.y + Math.sin(a) * (w.r - sw.band / 2) * 0.6;
        const ox = Math.cos(a) * 6;
        const oy = Math.sin(a) * 6 * 0.6;
        const px = -Math.sin(a) * 5;
        const py = Math.cos(a) * 5 * 0.6;
        PFX.line(ctx, cx - ox + px, cy - oy + py, cx + ox, cy + oy, `rgba(184, 255, 240, ${0.8 * fade})`, 2);
        PFX.line(ctx, cx - ox - px, cy - oy - py, cx + ox, cy + oy, `rgba(184, 255, 240, ${0.8 * fade})`, 2);
      }
      ctx.restore();
    }
    // spike zones: a warning glow, then the spikes themselves
    for (const s of this.spikes) {
      if (!s.erupted) {
        Telegraph.circle(ctx, s.x, s.y, s.r, s.t / c.slams.spikeDelay);
        this.drawCracks(ctx, s, s.t / c.slams.spikeDelay);
        continue;
      }
      PFX.disc(ctx, s.x, s.y, s.r * 0.9, s.r * 0.55, 'rgba(30, 24, 20, 0.35)', 3);
    }
  }

  /** The ground cracking open over a spike zone before it erupts: jagged cracks spreading from the middle, glowing. */
  drawCracks(ctx, s, progress) {
    const k = clamp(progress, 0, 1);
    const R = s.r * 0.9;
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const a0 = i * 0.9 + s.x * 0.013;
      const pts = [[s.x, s.y]];
      for (let j = 1; j <= 4; j++) {
        const r = (j / 4) * R * k;
        const a = a0 + Math.sin(i * 3 + j * 1.7) * 0.35;
        pts.push([s.x + Math.cos(a) * r, s.y + Math.sin(a) * r * 0.6]);
      }
      PFX.path(ctx, pts, 'rgba(20, 16, 12, 0.8)', 2);
      if (k > 0.5) {
        ctx.globalCompositeOperation = 'lighter';
        PFX.path(ctx, pts, `rgba(92, 240, 216, ${(k - 0.5) * 0.9})`, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  getDrawables() {
    const out = [];
    if (this.dead) return out;
    out.push({ y: this.y, draw: (ctx) => this.drawBody(ctx) });
    // the entrance's rocks, each sorted by the floor under it
    if (this.intro > 0 && this.rocks) for (const rk of this.rocks) out.push({ y: this.rockPose(rk, this.introAt).ground, draw: (ctx) => this.drawRock(ctx, rk) });
    // the rock spikes stand up out of the floor, sorted with everyone
    for (const s of this.spikes) {
      if (!s.rocks) continue;
      for (const r of s.rocks) out.push({ y: s.y + r.dy, draw: (ctx) => this.drawSpike(ctx, s, r) });
    }
    return out;
  }

  /**
   * One massive rock spike: it blasts up out of the floor in a blink, overshooting and slamming
   * to a stop, stands a moment, then cracks and grinds back down. A jagged pillar of stone leaning
   * out from the middle: a lit face and a shaded one, strata lines, a crystal vein glowing up it,
   * a teal-tipped point and a ring of broken ground round its foot.
   */
  drawSpike(ctx, s, r) {
    const c = this.cfg.slams;
    const t = s.t - c.spikeDelay - r.delay;
    if (t <= 0) return;
    // up in 0.09s with a big overshoot that settles, then down over the last 0.25s
    const up = t / 0.09;
    const grow = up < 1 ? up * up * 1.25 : 1 + 0.25 * (1 - clamp((t - 0.09) / 0.14, 0, 1)) ** 2;
    const sink = clamp((c.spikeTime - t - r.delay) / 0.25, 0, 1);
    const h = r.h * Math.min(grow, 1.25) * (sink < 1 ? sink * sink : 1);
    if (h < 3) return;
    const x = s.x + r.dx;
    const y = s.y + r.dy;
    const w = r.w * (0.85 + 0.15 * sink);
    const shake = sink < 1 ? vrand(-1, 1) : 0;
    const tipX = x + r.lean * (h / r.h) + shake;
    const tipY = y - h;
    // a jagged outline: left edge (lit) kinked once, right edge (shaded) kinked twice
    const L = [[x - w / 2, y], [lerp(x - w / 2, tipX, 0.45) - w * 0.12, lerp(y, tipY, 0.45)], [tipX, tipY]];
    const R = [[tipX, tipY], [lerp(x + w / 2, tipX, 0.6) + w * 0.1, lerp(y, tipY, 0.6)], [lerp(x + w / 2, tipX, 0.25) + w * 0.06, lerp(y, tipY, 0.25)], [x + w / 2, y]];
    const shape = [...L, ...R.slice(1)];
    const fill = (pts, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(Math.round(px), Math.round(py)) : ctx.moveTo(Math.round(px), Math.round(py))));
      ctx.closePath();
      ctx.fill();
    };
    // broken ground heaved up round its foot
    PFX.disc(ctx, x, y, w * 0.85, w * 0.32, 'rgba(26, 22, 18, 0.55)', 2);
    // the outline (1px bigger all round), then the shaded body, the lit face, the ridge
    ctx.save();
    ctx.translate(-1, 0);
    fill(shape, OUTLINE);
    ctx.translate(2, 0);
    fill(shape, OUTLINE);
    ctx.restore();
    fill([[x - w / 2, y + 1], [tipX, tipY - 2], [x + w / 2, y + 1]], OUTLINE);
    fill(shape, '#444c42');
    const midX = lerp(x, tipX, 0.5) - w * 0.05;
    fill([L[0], L[1], L[2], [midX, lerp(y, tipY, 0.5)], [x - w * 0.05, y]], '#7a8372');
    fill([L[0], L[1], [lerp(L[1][0], midX, 0.4), L[1][1]], [x - w * 0.3, y]], '#a0a892');
    // strata: bands of darker rock across it
    ctx.fillStyle = '#2e342d';
    for (const k of [0.22, 0.48, 0.7]) {
      if (k * r.h > h) break;
      const yy = Math.round(lerp(y, tipY, k));
      const half = (w / 2) * (1 - k) + 1;
      const cx = lerp(x, tipX, k);
      ctx.fillRect(Math.round(cx - half), yy, Math.round(half * 1.4), 1);
    }
    // a crystal vein glowing up the middle, and the teal point
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.line(ctx, lerp(x, tipX, 0.1) + w * 0.08, lerp(y, tipY, 0.1), lerp(x, tipX, 0.75) + w * 0.03, lerp(y, tipY, 0.75), 'rgba(92, 240, 216, 0.75)', 2);
    PFX.glow(ctx, tipX, tipY + 6, 10 + r.w * 0.2, RUIN_MAGIC, 0.6 * sink, 2);
    ctx.restore();
    fill([[tipX - 3, tipY + 9], [tipX, tipY], [tipX + 3, tipY + 9]], '#5cf0d8');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(tipX) - 1, Math.round(tipY) + 2, 1, 3);
  }

  currentFrame() {
    const f = Sprites.guardian;
    if (this.state === 'waveWindup') return f.slam;   // arms raised, gathering the magic
    if (this.state === 'charge' || this.state === 'beam' || this.state === 'wave') return f.charge;
    if (this.state === 'slam' && this.slam && !this.slam.down) return f.slam;
    return f.idle[Math.floor(this.time * 2) % 2];
  }

  drawBody(ctx) {
    if (this.intro > 0) return this.drawIntro(ctx);
    const frame = this.currentFrame();
    const G = GUARDIAN_SPRITE;
    const charging = this.state === 'charge';
    const shake = charging && this.t > this.cfg.beam.charge * 0.6 ? vrand(-1.5, 1.5) : 0;
    const x = this.x + shake;
    const y = this.drawY;
    const fade = this.dying > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time * 25)) : 1;
    // the magic about it: a soft teal aura (stronger in phase 2)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 70, 70 + Math.sin(this.time * 3) * 4, '34, 184, 166', (this.phase === 2 ? 0.35 : 0.22) * fade, 2, 80);
    ctx.restore();
    // a dying guardian shakes apart, rocks dropping lower as it goes
    const drop = this.dying > 0 ? (1 - this.dying / 2.6) * 20 : 0;
    drawSprite(ctx, frame.img, x, y + drop, G.ax, G.ay, false, fade);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, x, y + drop, G.ax, G.ay, false, 0.8);
    if (this.dying > 0) return;
    // glowing crystals, eyes and the heart (brighter as the beam charges)
    const k = charging ? clamp(this.t / this.cfg.beam.charge, 0, 1) : this.state === 'beam' ? 1 : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of GUARDIAN_EYES) PFX.glow(ctx, x + e.x, y + e.y, 5, RUIN_MAGIC, 0.9, 1);
    for (const cr of GUARDIAN_CRYSTALS) PFX.glow(ctx, x + cr.x, y + cr.y, 7, RUIN_MAGIC, 0.35 + Math.sin(this.time * 4 + cr.x) * 0.1, 1);
    PFX.glow(ctx, x + GUARDIAN_CORE.x, y + GUARDIAN_CORE.y, 12 + k * 26, RUIN_MAGIC, 0.7 + k * 0.6, 2);
    ctx.restore();
  }

  /**
   * The entrance's body: a light gathering where it will stand as the rocks come together, then
   * (from the bind) its whole body, white-hot at first, cooling to stone as the rocks fade into it,
   * and its eyes opening.
   */
  drawIntro(ctx) {
    const I = GUARDIAN_INTRO;
    const e = this.introAt;
    const G = GUARDIAN_SPRITE;
    const cx = this.x;
    const g = smooth01((e - I.lift) / (I.bind - I.lift));
    if (g > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, cx, this.drawY - 70, 20 + g * 60, '34, 184, 166', 0.2 + g * 0.6, 2, 30 + g * 70);
      ctx.restore();
    }
    if (e < I.bind) return;
    const k = clamp((e - I.bind) / 0.45, 0, 1);
    drawSprite(ctx, Sprites.guardian.idle[0].img, cx, this.drawY, G.ax, G.ay, false, k);
    drawSprite(ctx, Sprites.guardian.idle[0].flash, cx, this.drawY, G.ax, G.ay, false, (1 - k) * 0.9);
    // its eyes open, then its crystals light one by one
    const w = clamp((e - I.bind - 0.3) / 0.3, 0, 1);
    if (w > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const eye of GUARDIAN_EYES) PFX.glow(ctx, cx + eye.x, this.drawY + eye.y, 6, RUIN_MAGIC, w, 1);
      GUARDIAN_CRYSTALS.forEach((cr, i) => {
        const c = clamp(w * GUARDIAN_CRYSTALS.length - i, 0, 1);
        if (c > 0) PFX.glow(ctx, cx + cr.x, this.drawY + cr.y, 7, RUIN_MAGIC, 0.4 * c, 1);
      });
      ctx.restore();
    }
  }

  /** One of the entrance's rocks: the boulder itself, turning as it flies, its veins glowing brighter the higher it goes. */
  drawRock(ctx, rk) {
    const e = this.introAt;
    const I = GUARDIAN_INTRO;
    const p = this.rockPose(rk, e);
    const img = Sprites.guardian.rocks[rk.v % 4];
    // they fade into the body as it binds
    const fade = 1 - clamp((e - I.bind) / 0.45, 0, 1);
    if (fade <= 0) return;
    const glow = clamp((e - I.stir * 0.5) / I.stir, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, p.x, p.y, 18 * p.scale + glow * 6, RUIN_MAGIC, 0.15 + glow * 0.3 + (e > I.gather ? 0.4 : 0), 2);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(p.rot);
    ctx.scale(rk.flip ? -p.scale : p.scale, p.scale);
    ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
    ctx.restore();
  }

  /** A stream of magic from a power crystal: a wavering ribbon of light, motes of magic racing along it. */
  drawStream(ctx, s, i) {
    const { from: a, to: b, k } = s;
    const len = dist(a.x, a.y, b.x, b.y);
    if (len < 4 || k <= 0) return;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      const wob = Math.sin(t * 9 - this.time * 6 + i * 1.7) * 6 * Math.sin(t * Math.PI);
      pts.push([lerp(a.x, b.x, t) + nx * wob, lerp(a.y, b.y, t) + ny * wob]);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(k * 0.55, 0, 1);
    PFX.path(ctx, pts, 'rgba(34, 184, 166, 0.7)', 3);
    ctx.globalAlpha = clamp(k * 0.8, 0, 1);
    PFX.path(ctx, pts, 'rgba(184, 255, 240, 0.8)', 1);
    // motes flowing from the crystal to the Guardian
    for (let m = 0; m < 4; m++) {
      const t = (this.time * 0.9 + m / 4 + i * 0.13) % 1;
      const [mx, my] = pts[Math.round(t * 16)];
      PFX.star(ctx, mx, my, k > 0.9 && m % 2 ? 2 : 1, '#5cf0d8', '#ffffff', 1);
    }
    PFX.glow(ctx, a.x, a.y, 10 + k * 6, RUIN_MAGIC, k * 0.6, 1);
    ctx.restore();
  }

  /** Above everything: the power crystals' streams, the beam's aim line as it charges, and the beam itself. */
  drawOverlay(ctx) {
    for (const c of this.powerCrystals) c.feeding = 0;
    if (this.dead || this.dying > 0) return;
    this.streams().forEach((s, i) => {
      s.crystal.feeding = Math.min(1, s.k);
      this.drawStream(ctx, s, i);
    });
    const B = this.beam;
    if (B && B.end && (this.state === 'charge' || this.state === 'wave')) {
      // a thin line of light tracking the hero, filling in and flickering as it's about to fire
      const k = this.state === 'charge' ? clamp(this.t / this.cfg.beam.charge, 0, 1) : 0;
      const locked = this.state === 'charge' && this.t >= this.cfg.beam.charge - this.cfg.beam.lockAt;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.line(ctx, this.coreX, this.coreY, B.end.x, B.end.y, `rgba(92, 240, 216, ${0.25 + k * 0.45})`, 2, locked ? null : [6, 6], -this.time * 40);
      if (locked && Math.floor(this.time * 20) % 2) PFX.line(ctx, this.coreX, this.coreY, B.end.x, B.end.y, 'rgba(255, 255, 255, 0.5)', 1);
      ctx.restore();
      // phase 2: the cover in its way is marked - it's going to blast straight through it
      if (B.smash) {
        const { x, y } = B.smash;
        const p = 0.6 + Math.sin(this.time * 14) * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.ring(ctx, x, y, 16 + p * 4, 10 + p * 2, `rgba(255, 120, 90, ${0.5 + k * 0.4})`, 2, { dash: [3, 3], spin: this.time * 4 });
        ctx.restore();
        for (const s of [-1, 1]) PFX.line(ctx, x - 7, y - 7 * s, x + 7, y + 7 * s, `rgba(255, 110, 80, ${0.6 + k * 0.4})`, 2);
        HUD.text(ctx, 'BREAKS THROUGH', Math.round(x), Math.round(y - 30), { size: 6, align: 'center', color: '#ff9a7a' });
      }
    }
    if (B && this.state === 'beam') this.drawBeam(ctx, B);
  }

  /**
   * The giant beam: a wide teal shaft with a white-hot core, rippling, flaring where it strikes. In
   * phase 2 it's a wrecking beam: wider and hotter, crackling with lightning along its edges, chunks of
   * rock it has torn loose tumbling down it, and a blast flaring where it tears into the floor.
   */
  drawBeam(ctx, B) {
    const c = this.cfg.beam;
    const p2 = this.phase === 2;
    const len = dist(this.coreX, this.coreY, B.end.x, B.end.y);
    const ripple = Math.sin(this.time * 40) * 3;
    const fade = Math.min(1, this.t * 6, (c.time - this.t) * 4);
    const width = c.width[this.phase - 1] + 10 + ripple;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    PFX.beam(ctx, this.coreX, this.coreY, B.angle, len, width, p2 ? ['#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff', '#ffffff'] : ['#127068', '#22b8a6', '#5cf0d8', '#b8fff0', '#ffffff'], 3, false);
    PFX.glow(ctx, this.coreX, this.coreY, 34 + ripple + (p2 ? 12 : 0), RUIN_MAGIC, 1.2, 2);
    PFX.glow(ctx, B.end.x, B.end.y, 30 + ripple + (p2 ? 22 : 0), RUIN_MAGIC, p2 ? 1.5 : 1, 2);
    if (p2) {
      // lightning crackling along both edges, re-forking every few frames
      const nx = -Math.sin(B.angle);
      const ny = Math.cos(B.angle);
      for (const side of [-1, 1]) {
        const off = (width / 2 + 3) * side;
        PFX.path(ctx, zigzag(this.coreX + nx * off, this.coreY + ny * off, B.end.x + nx * off, B.end.y + ny * off, 7, 22), 'rgba(184, 255, 240, 0.85)', 2);
      }
      // a blast of white where it tears into the floor
      const b = 0.7 + Math.sin(this.time * 30) * 0.3;
      PFX.disc(ctx, B.end.x, B.end.y, 26 * b, 14 * b, 'rgba(255, 255, 255, 0.55)', 2);
    }
    ctx.restore();
    if (!p2) return;
    // chunks of rock tumbling down the beam
    for (let i = 0; i < 6; i++) {
      const t = (this.time * 1.6 + i / 6) % 1;
      const x = lerp(this.coreX, B.end.x, t) + Math.sin(i * 2.3 + this.time * 5) * width * 0.25;
      const y = lerp(this.coreY, B.end.y, t) + Math.cos(i * 1.7 + this.time * 4) * width * 0.15;
      const img = Sprites.guardian.chunks[i % 3];
      ctx.save();
      ctx.globalAlpha = fade * Math.min(1, (1 - t) * 4);
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(this.time * 9 + i);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    }
  }
}
