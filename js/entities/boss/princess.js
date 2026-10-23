// =============================================================
//  THE PRINCESS (castle stage 1, her magic study)
//
//  She's at her desk, nose in a spellbook, when you burst in. She looks up, slams the
//  book shut in a fury and opens the fight by flinging a potion at you, then vaults
//  her desk. She keeps her distance and takes turns:
//    - a rapid burst of crossbow bolts
//    - an ice potion: a little damage, a moment frozen, and a patch of slowing ice
//    - a fire potion: it bursts into flames, flinging bouncing fireballs, and leaves
//      the ground burning
//  Anyone who gets close sees her blink away, still nearby (once every blink.cooldown s).
//  At half health she flings the crossbow away and conjures a magic bow, and the study
//  comes alive: furniture floats and things fly slowly across the room (they hurt to
//  touch). Then: volleys of golden arrows that weave through the air spitting little
//  bolts to either side, a giant golden arrow shot into the sky that falls on you and
//  bursts in a blaze of golden magic, and potions three at a time (less often).
//  Solid bookshelves and tables stand about the study for cover (DungeonRun.studyCover).
//  She's the castle's cute Princess (js/gfx/enemies/castle.js) drawn PRINCESS_SCALE bigger.
//  (x, y) is her feet.
// =============================================================

const PRINCESS_SCALE = 1.5;
// the entrance: studying, then she notices you, then she's on her feet in a rage (seconds)
const PRINCESS_INTRO = { notice: 1.0, rage: 1.55, total: 2.3 };

class RoyalPrincess {
  constructor(x, y) {
    const c = CONFIG.princessBoss;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 18;
    this.hw = 11;
    this.hh = 7;
    this.time = 0;
    this.animTime = 0;
    this.intro = PRINCESS_INTRO.total;
    this.introAt = 0;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = 1;
    this.moving = false;
    // opening | vault | walk | burstWindup | burst | potionWindup |
    // transform | volleyWindup | skyWindup | potionsWindup (phase 2)
    this.state = 'opening';
    this.t = 0;
    this.attackTimer = 0.6;
    this.attackStep = 0;
    this.aim = Math.PI / 2;
    this.strafe = 1;
    this.potion = 'ice';
    this.blinkCd = 0;
    this.phase = 1;
    this.sky = null;           // the giant arrow coming down: { t, x, y, target }
    this.flyers = [];          // phase 2: things flying across the study
    this.flyerTimer = 0;
  }

  get name() { return 'THE PRINCESS'; }
  get title() { return 'Spellbound Heir of the Empire'; }
  get defeatText() { return 'The Princess falls among her scattered books.'; }

  get hx() { return this.x; }
  get hy() { return this.y - 14 * PRINCESS_SCALE; }
  get headY() { return this.y - 44 * PRINCESS_SCALE; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead; }
  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.intro > 0 || this.dying > 0 || this.dead) return [];
    return [{ part: this, x: this.x, y: this.y - 92, w: 80, color: '#a890ff', marker: [this.cfg.phase2At] }];
  }

  knockback() {}
  stun() {}

  heal(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) world.effects.text(this.hx, this.hy - 40, `+${Math.round(this.hp - before)}`, { color: '#8cf08a', size: 9 });
  }

  takeDamage(amount, world) {
    if (!this.targetable || this.state === 'transform') return false;   // wrapped in magic as she changes
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.startTransform(world);
    return true;
  }

  /** Per-phase value from a [phase 1, phase 2] pair. */
  P(v) { return Array.isArray(v) ? v[this.phase - 1] : v; }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** Where her crossbow's bolts leave from (in front of her, at chest height). */
  get handX() { return this.x + this.facing * 14; }
  get handY() { return this.y - 22; }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.animTime += dt;
    this.flashTime -= dt;
    if (this.intro > 0) return this.updateIntro(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.t += dt;
    this.moving = false;
    this.blinkCd -= dt;
    const p = world.player;
    this.updateSky(dt, world);
    if (this.phase === 2) this.updateFlyers(dt, world);
    if (this.state !== 'opening' && this.state !== 'vault' && this.state !== 'transform') {
      if (this.tryBlink(world)) return;
    }
    switch (this.state) {
      case 'opening':
        // her first act: a potion flung straight at you
        this.faceTo(p);
        if (this.t >= 0.35) { this.throwPotion(world, p, choose(['ice', 'fire'])); this.setState('vault'); this.vaultFrom = { x: this.x, y: this.y }; }
        break;
      case 'vault': {
        // over the desk in one bound, landing in front of it
        const k = Math.min(1, this.t / 0.45);
        const tx = this.vaultFrom.x;
        const ty = this.vaultFrom.y + 80;
        this.x = tx;
        this.y = lerp(this.vaultFrom.y, ty, k);
        this.vaultLift = Math.sin(k * Math.PI) * 30;
        if (k >= 1) {
          this.vaultLift = 0;
          const pt = world.dungeon.freePoint(this.x, this.y, this.hw, this.hh);
          this.x = pt.x;
          this.y = pt.y;
          world.effects.burst(this.x, this.y - 4, { count: 10, colors: ['#c49aff', '#e4cfff', '#ffffff'], speed: [30, 100], life: [0.2, 0.4] });
          this.toWalk(0.5);
        }
        break;
      }
      case 'walk': this.updateWalk(dt, world, p); break;
      case 'burstWindup':
        this.faceTo(p);
        this.aim = angleTo(this.handX, this.handY, p.hx, p.hy);
        if (this.t >= this.cfg.burst.windup) { this.setState('burst'); this.shots = 0; }
        break;
      case 'burst': this.updateBurst(dt, world, p); break;
      case 'potionWindup':
        this.faceTo(p);
        if (this.t >= this.cfg[this.potion === 'ice' ? 'icePotion' : 'firePotion'].windup) {
          this.throwPotion(world, p, this.potion);
          this.toWalk();
        }
        break;
      case 'transform': this.updateTransform(dt, world); break;
      case 'volleyWindup':
        this.faceTo(p);
        this.aim = angleTo(this.handX, this.handY, p.hx, p.hy);
        if (this.t >= this.cfg.volley.windup) { this.fireVolley(world); this.toWalk(); }
        break;
      case 'skyWindup':
        // the bow drawn straight up at the ceiling
        this.aim = -Math.PI / 2;
        if (this.t >= this.cfg.sky.windup) { this.loftArrow(world, p); this.toWalk(); }
        break;
      case 'potionsWindup':
        this.faceTo(p);
        if (this.t >= this.cfg.icePotion.windup) { this.throwPotions(world, p); this.toWalk(); }
        break;
    }
    this.contactDamage(world);
  }

  faceTo(p) { if (!p.dead) this.facing = p.x >= this.x ? 1 : -1; }

  toWalk(delay = null) {
    this.setState('walk');
    this.attackTimer = delay ?? this.P(this.cfg.attackInterval);
    if (Math.random() < 0.5) this.strafe *= -1;
  }

  /** Keeps her distance: backs off if you're close, closes in if you're far, circles you between. */
  updateWalk(dt, world, p) {
    if (p.dead) return;
    const c = this.cfg;
    const d = dist(this.x, this.y, p.x, p.y);
    const toward = angleTo(this.x, this.y, p.x, p.y);
    let a = toward + (Math.PI / 2) * this.strafe;
    if (d < c.keepAway[0]) a = toward + Math.PI + (Math.PI / 5) * this.strafe;
    else if (d > c.keepAway[1]) a = toward;
    const x0 = this.x;
    const y0 = this.y;
    world.dungeon.move(this, Math.cos(a) * c.speed * dt, Math.sin(a) * c.speed * dt);
    if (dist(x0, y0, this.x, this.y) < c.speed * dt * 0.3) this.strafe *= -1;   // a wall: circle the other way
    this.moving = dist(x0, y0, this.x, this.y) > 0.1;
    this.faceTo(p);
    this.attackTimer -= dt;
    if (this.attackTimer > 0) return;
    if (this.phase === 2) {
      // the magic bow: arrow volleys and the arrow from the sky, potions only now and then
      const kind = ['volley', 'potions', 'sky', 'volley', 'sky'][this.attackStep++ % 5];
      if (kind === 'volley') { this.setState('volleyWindup'); Sound.play('laserCharge', 0.2); }
      else if (kind === 'sky') { this.setState('skyWindup'); Sound.play('lightCharge'); }
      else this.setState('potionsWindup');
      return;
    }
    const kind = ['burst', 'potion'][this.attackStep++ % 2];
    if (kind === 'burst') { this.setState('burstWindup'); Sound.play('bowDraw'); }
    else {
      this.potion = this.potion === 'ice' ? 'fire' : 'ice';
      this.setState('potionWindup');
    }
  }

  // ---------- the crossbow ----------

  /** A rapid burst of bolts, each aimed at you (with a little scatter). */
  updateBurst(dt, world, p) {
    const c = this.cfg.burst;
    this.faceTo(p);
    if (!p.dead) this.aim += clamp(angleDiff(this.aim, angleTo(this.handX, this.handY, p.hx, p.hy)), -4 * dt, 4 * dt);
    while (this.shots < c.count && this.t >= this.shots * c.every) {
      const a = this.aim + rand(-0.06, 0.06);
      world.enemyProjectiles.push(new Projectile({
        x: this.handX + Math.cos(a) * 16, y: this.handY + Math.sin(a) * 16, vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
        radius: 4, damage: c.damage, life: 2, friendly: false, sprite: Sprites.projectiles.crossbowBolt, trail: ['#6a449a', '#c49aff'],
      }));
      Sound.play('crossbow', 0.04);
      this.shots++;
    }
    if (this.shots >= c.count && this.t >= c.count * c.every + 0.2) this.toWalk();
  }

  // ---------- potions ----------

  /** Lobs a potion where you stand: ice (chip, freeze, slowing ice) or fire (flames, bouncing fireballs, burning ground). */
  throwPotion(world, p, kind, target = null) {
    const c = kind === 'ice' ? this.cfg.icePotion : this.cfg.firePotion;
    const at = target || (p.dead ? { x: this.x, y: this.y + 120 } : { x: p.x + rand(-8, 8), y: p.y + rand(-6, 6) });
    Sound.play('daggerFan');
    lobShot(world, this.x + this.facing * 10, this.y - 40, at.x, at.y, c.flight, {
      sprite: kind === 'ice' ? Sprites.projectiles.icePotion : Sprites.projectiles.firePotion,
      radius: c.radius, height: 100, spin: 9, rgb: kind === 'ice' ? '140, 200, 255' : '255, 120, 40',
      trail: kind === 'ice' ? ['#9ad0ff', '#e6f6ff'] : ['#ffd34a', '#ff8a1e'],
      onLand: (w) => (kind === 'ice' ? this.iceBurst(w, at) : this.fireBurst(w, at)),
    });
  }

  iceBurst(world, at) {
    const c = this.cfg.icePotion;
    Sound.play('glass');
    Sound.play('iceBurst');
    world.effects.shards(at.x, at.y - 6, { count: 16, speed: [80, 220], life: 0.5, len: [6, 11], width: 4 });
    world.effects.burst(at.x, at.y - 4, { count: 18, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [40, 160], life: [0.3, 0.6] });
    for (const a of hitAround(world, at.x, at.y, c.radius, c.damage)) {
      a.stun?.(c.freeze, world);
      a.chill?.(1 - c.slow, c.freeze + 1);
      world.effects.text(a.hx, a.hy - 46, 'FROZEN', { color: '#9ad0ff', size: 7 });
    }
    groundZone(world, {
      x: at.x, y: at.y, r: c.radius, life: c.zoneTime, every: 0.2,
      tick: (w, x, y, r) => {
        for (const a of w.allies) if (dist(a.x, a.y, x, y) < r + (a.radius || 0) * 0.5) a.chill?.(1 - c.slow, 0.3);
      },
      draw: (ctx, x, y, r, t) => {
        const k = t < 0.85 ? Math.min(1, t * 8) : (1 - t) / 0.15;
        ctx.save();
        ctx.globalAlpha = 0.55 * k;
        PFX.disc(ctx, x, y, r, r * 0.55, '#9ad0ff');
        ctx.globalAlpha = 0.7 * k;
        PFX.ring(ctx, x, y, r, r * 0.55, '#e6f6ff', 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + 0.3;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.44); ctx.stroke();
        }
        ctx.restore();
      },
      light: { r: c.radius * 2, rgb: '140, 200, 255', s: 0.6 },
    });
  }

  fireBurst(world, at) {
    const c = this.cfg.firePotion;
    Sound.play('glass');
    Sound.play('fireImpact');
    world.shake(4, 0.2);
    world.effects.burst(at.x, at.y - 6, { count: 30, colors: ['#ffd34a', '#ff8a1e', '#e0461e', '#ffffff'], speed: [60, 220], life: [0.3, 0.7], up: 60 });
    world.effects.flames(at.x, at.y + 4, { count: 5, spread: 20, height: 26, width: 12, life: 0.6, colors: ENEMY_FIRE_COLORS });
    for (const a of hitAround(world, at.x, at.y, c.radius, c.damage)) a.burn?.(c.burnDps, c.burnTime, world);
    // bouncing fireballs flung out all round
    const off = rand(0, TAU);
    for (let i = 0; i < c.fireballs; i++) {
      const a = off + (i / c.fireballs) * TAU;
      world.enemyProjectiles.push(new Projectile({
        x: at.x + Math.cos(a) * 10, y: at.y - 8 + Math.sin(a) * 6, vx: Math.cos(a) * c.fireballSpeed, vy: Math.sin(a) * c.fireballSpeed,
        radius: 6, damage: c.fireballDamage, life: 2.6, bounces: c.bounces, friendly: false,
        sprite: Sprites.projectiles.golemFireball, spin: 8, glow: '255, 60, 40', trail: ['#ff3a26', '#c81a1a', '#8a0c12'],
        onHit: (pr, w, t) => {
          if (t) t.burn?.(c.burnDps, c.burnTime, w);
          w.effects.burst(pr.x, pr.y, { count: 6, colors: ['#ffd34a', '#ff8a1e'], speed: [30, 90], life: [0.15, 0.3] });
        },
      }));
    }
    // and the ground left burning, like the flaming catapult's
    FlamingCatapult.prototype.ignite.call({ cfg: { fireRadius: c.fireRadius, fireTime: c.fireTime, burnDps: c.burnDps, burnTime: c.burnTime } }, world, at, 1);
  }

  // ---------- phase 2: the magic bow ----------

  /** Half health: she flings her crossbow away, calls up a bow of pure magic, and the study wakes. */
  startTransform(world) {
    this.phase = 2;
    this.setState('transform');
    this.sky = null;
    world.banner('THE PRINCESS UNLEASHES HER MAGIC', 'The study comes alive', 2.2);
    Sound.play('phantomVanish');
    // the crossbow, tossed over her shoulder, clattering away across the floor
    const x0 = this.handX;
    const y0 = this.handY;
    const dir = -this.facing;
    world.effects.add(0.9, (ctx, t) => {
      const xb = Sprites.weapons.crossbow;
      const x = x0 + dir * t * 120;
      const y = y0 - Math.sin(Math.min(1, t * 1.4) * Math.PI) * 50 + t * 26;
      drawRotated(ctx, xb.img, x, y, xb.pivotX, xb.pivotY, t * 14 * dir);
    });
    world.after(0.8, () => Sound.play('blockClang', 0.1));
  }

  updateTransform(dt, world) {
    // a swirl of magic gathering in her hands, the bow forming out of it
    if (vrand(0, 1) < dt * 30) {
      const a = vrand(0, TAU);
      world.effects.burst(this.x + Math.cos(a) * 40, this.y - 30 + Math.sin(a) * 26, { count: 1, colors: ['#ffe680', '#c49aff', '#ffffff'], speed: [10, 30], life: [0.3, 0.5] });
    }
    if (!this.awoke && this.t >= this.cfg.transform * 0.55) {
      // the bow appears, and the study's magic wakes: the furniture lifts off the floor
      this.awoke = true;
      world.effects.burst(this.handX, this.handY, { count: 30, colors: ['#ffe680', '#fffbe8', '#c49aff', '#ffffff'], speed: [60, 200], life: [0.3, 0.7] });
      world.shake(5, 0.3);
      Sound.play('lightBomb');
      this.levitateStudy(world, true);
      this.flyerTimer = 1;
    }
    if (this.t >= this.cfg.transform) this.toWalk(0.6);
  }

  /** Lifts the study's furniture into the air (or lets it settle again when she falls). */
  levitateStudy(world, on) {
    const run = world.run;
    if (!run) return;
    const r = run.floor.bossRoom;
    const T = run.floor.T;
    for (const d of run.decor.items) {
      if (!['prop', 'studyDesk', 'crystal'].includes(d.kind)) continue;
      if (r && (d.x < r.x0 * T || d.x > (r.x1 + 1) * T || d.y < r.y0 * T || d.y > (r.y1 + 1) * T)) continue;
      d.levitate = on;
      d.levitateAt = run.decor.time;
    }
  }

  /** Five golden arrows fanned at you: each flies straight on, weaving side to side, and spits little bolts out to its sides. */
  fireVolley(world) {
    const c = this.cfg.volley;
    const spread = c.spreadDegrees * DEG;
    const w0 = c.waveFreq * TAU;
    for (let i = 0; i < c.count; i++) {
      const a0 = this.aim + (i / (c.count - 1) - 0.5) * spread;
      const sway = i % 2 ? -1 : 1;   // neighbours weave opposite ways, braiding the fan
      let side = c.sideEvery * (0.5 + i * 0.12);
      world.enemyProjectiles.push(new Projectile({
        x: this.handX + Math.cos(a0) * 16, y: this.handY + Math.sin(a0) * 16, vx: Math.cos(a0) * c.speed, vy: Math.sin(a0) * c.speed,
        radius: 7, damage: c.damage, life: c.life, friendly: false,
        sprite: Sprites.projectiles.goldenArrow, glow: '255, 220, 120', trail: ['#ffe680', '#fffbe8', '#c49aff'],
        homing: (pr, dt, w) => {
          // forward along its line, plus a sideways sine sway (the arrow turns with it)
          const across = sway * c.waveAmp * w0 * Math.cos(w0 * pr.age);
          pr.vx = Math.cos(a0) * c.speed - Math.sin(a0) * across;
          pr.vy = Math.sin(a0) * c.speed + Math.cos(a0) * across;
          // little magic bolts out to its left and right
          side -= dt;
          if (side <= 0) {
            side = c.sideEvery;
            const head = Math.atan2(pr.vy, pr.vx);
            for (const s of [-1, 1]) {
              const a = head + s * Math.PI / 2;
              w.enemyProjectiles.push(new Projectile({
                x: pr.x, y: pr.y, vx: Math.cos(a) * c.sideSpeed, vy: Math.sin(a) * c.sideSpeed,
                radius: 4, damage: c.sideDamage, life: 1.6, friendly: false,
                sprite: Sprites.projectiles.queenMagic, spin: 8, glow: '255, 200, 120', trail: ['#ffe680', '#c49aff'],
              }));
            }
            Sound.play('magic', 0.12);
          }
        },
      }));
    }
    world.effects.burst(this.handX, this.handY, { count: 16, colors: ['#ffe680', '#fffbe8', '#ffffff'], speed: [60, 180], life: [0.2, 0.5] });
    Sound.play('volleyLoose');
    Sound.play('magic');
  }

  /** An arrow loosed straight up through the ceiling; a giant one comes down where you stand. */
  loftArrow(world, p) {
    const x = this.handX;
    const y = this.handY;
    world.effects.add(0.5, (ctx, t) => {
      const img = Sprites.projectiles.goldenArrow;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y - t * 500, 20, '255, 220, 120', 1 - t);
      ctx.restore();
      drawRotated(ctx, img, x, y - t * 500, img.width / 2, img.height / 2, -Math.PI / 2);
    });
    world.effects.burst(x, y - 10, { count: 14, colors: ['#ffe680', '#fffbe8'], speed: [40, 140], life: [0.2, 0.4], angle: -Math.PI / 2, spread: 0.6 });
    Sound.play('bowShotHeavy');
    this.sky = { t: 0, x: p.x, y: p.y, target: p };
  }

  /** The mark follows you, then locks; the giant arrow falls on it. */
  updateSky(dt, world) {
    const S = this.sky;
    if (!S) return;
    const c = this.cfg.sky;
    S.t += dt;
    if (S.t < c.track && S.target && !S.target.dead) {
      const k = Math.min(1, dt * 5);
      S.x += (S.target.x - S.x) * k;
      S.y += (S.target.y - S.y) * k;
    }
    if (S.t >= c.track && !S.locked) { S.locked = true; Sound.play('aim'); }
    if (S.t >= c.track + c.fall) {
      // impact: the arrow bursts in a blaze of shining golden magic
      for (const a of hitAround(world, S.x, S.y, c.radius, c.damage, 300)) world.effects.text(a.hx, a.hy - 44, 'SMITTEN', { color: '#ffe680', size: 8 });
      world.shake(12, 0.6);
      this.goldenBlast(world, S.x, S.y, c.radius);
      const x = S.x;
      const y = S.y;
      // the giant arrow left standing in the floor a moment
      world.effects.add(1.2, (ctx, t) => {
        const img = Sprites.projectiles.goldenArrow;
        ctx.save();
        ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
        ctx.translate(Math.round(x), Math.round(y - 30));
        ctx.rotate(Math.PI / 2);
        ctx.scale(3, 3);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      });
      Sound.play('lightBomb');
      Sound.play('impact');
      this.sky = null;
    }
  }

  /**
   * The giant arrow's burst (visual only): a white-gold flash, rays of light shooting out,
   * shockwave rings and a turning rune circle over the blast, sparkles twinkling across it,
   * and a shower of gold motes and glitter drifting down after.
   */
  goldenBlast(world, x, y, r) {
    world.effects.burst(x, y - 10, { count: 60, colors: ['#ffe680', '#fffbe8', '#c8a456', '#ffffff'], speed: [100, 340], life: [0.4, 1], up: 90 });
    world.effects.burst(x, y - 20, { count: 36, colors: ['#ffd34a', '#fff2a0', '#c49aff'], speed: [20, 90], life: [0.9, 1.6], gravity: -20, size: [1, 3] });
    const rays = [];
    for (let i = 0; i < 12; i++) rays.push({ a: (i / 12) * TAU + vrand(-0.12, 0.12), len: vrand(0.8, 1.25) });
    const sparks = [];
    for (let i = 0; i < 18; i++) {
      const a = vrand(0, TAU);
      const d = vrand(0.15, 1) * r;
      sparks.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 - vrand(0, 30), at: vrand(0, 0.5), size: vrand(2, 5) | 0 });
    }
    world.effects.add(1.1, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // the flash, then a lingering golden glow
      if (t < 0.15) PFX.glow(ctx, x, y - 20, r * 1.6, '255, 250, 220', 1 - t / 0.15, 2, r * 1.1);
      PFX.glow(ctx, x, y - 10, r * 1.3, '255, 210, 110', 0.9 * (1 - t), 2, r * 0.8);
      // rays of light bursting outward
      const rk = Math.min(1, t / 0.25);
      for (const R of rays) {
        PFX.beam(ctx, x, y - 16, R.a, r * 1.2 * R.len * rk, 6 * (1 - t), ['rgba(255, 220, 120, 0.6)', 'rgba(255, 250, 220, 0.9)'], 2, true);
      }
      // two shockwave rings racing out across the floor
      for (const [delay, col] of [[0, '#ffe680'], [0.12, '#fffbe8']]) {
        const k = clamp((t - delay) / 0.55, 0, 1);
        if (k <= 0 || k >= 1) continue;
        ctx.globalAlpha = 1 - k;
        PFX.ring(ctx, x, y, r * (0.3 + k * 0.9), r * 0.6 * (0.3 + k * 0.9), col, 2, { thick: k < 0.4 ? 3 : 2 });
      }
      // a rune circle of golden magic turning over the blast
      ctx.globalAlpha = t < 0.2 ? t / 0.2 : (1 - t) / 0.8;
      PFX.ring(ctx, x, y, r * 0.85, r * 0.51, '#ffd34a', 2, { dash: [3, 2], spin: t * 3 });
      PFX.ring(ctx, x, y, r * 0.6, r * 0.36, '#c49aff', 2, { dash: [2, 3], spin: -t * 4 });
      // sparkles winking on and off across it
      ctx.globalAlpha = 1;
      for (const s of sparks) {
        const k = (t - s.at) / 0.45;
        if (k <= 0 || k >= 1) continue;
        PFX.star(ctx, s.x, s.y, Math.max(1, Math.round(s.size * Math.sin(k * Math.PI))), '#ffe680', '#ffffff', 2);
      }
      ctx.restore();
    });
    // glitter falling where it burst
    for (let i = 0; i < 4; i++) {
      world.after(0.15 + i * 0.15, () => world.effects.burst(x + vrand(-r * 0.7, r * 0.7), y - vrand(40, 80), { count: 8, colors: ['#ffe680', '#fffbe8', '#ffffff'], speed: [5, 30], life: [0.6, 1.1], gravity: 60, size: [1, 2] }));
    }
    world.run?.addLight({ x, y: y - 20, r: r * 2.4, s: 1, rgb: '255, 220, 130', until: world.time + 0.8 });
  }

  /** Three potions at once, a mix of ice and fire, landing on and around you. */
  throwPotions(world, p) {
    const c = this.cfg.potions;
    const kinds = ['ice', 'fire', choose(['ice', 'fire'])];
    for (let i = 0; i < c.count; i++) {
      const a = rand(0, TAU);
      const d = i === 0 ? 0 : rand(c.spread * 0.5, c.spread);
      const at = p.dead ? { x: this.x + Math.cos(a) * 100, y: this.y + 120 } : { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.75 };
      world.after(i * c.gap, () => { if (!this.dead && this.dying <= 0) this.throwPotion(world, p, kinds[i % kinds.length], at); });
    }
  }

  // ---------- phase 2: the study's flying things ----------

  /** Now and then a book, a candelabra or a chair drifts across the room; touching one hurts. */
  updateFlyers(dt, world) {
    const c = this.cfg.flyers;
    if (this.state !== 'transform') {
      this.flyerTimer -= dt;
      if (this.flyerTimer <= 0 && this.flyers.length < c.max) {
        this.flyerTimer = c.every;
        this.spawnFlyer(world);
      }
    }
    const b = world.dungeon.floorBounds;
    for (const F of this.flyers) {
      F.t += dt;
      F.x += F.vx * dt;
      F.y += F.vy * dt;
      F.rot += F.spin * dt;
      for (const a of world.allies) {
        if (F.hit.has(a) || dist(a.x, a.y, F.x, F.y) > c.radius + a.radius) continue;
        F.hit.add(a);
        if (a.hurt(c.damage, world, F.x, F.y)) a.knockback?.(Math.atan2(F.vy, F.vx), 200);
      }
      if (vrand(0, 1) < dt * 6) world.effects.burst(F.x, F.y - 34, { count: 1, colors: ['#c49aff', '#e4cfff'], speed: [5, 20], life: [0.3, 0.6] });
      if (F.x < b.left - 60 || F.x > b.right + 60 || F.y < b.top - 60 || F.y > b.bottom + 60) F.dead = true;
    }
    removeDead(this.flyers);
  }

  /** A new flier, from one side of the study, drifting across it toward roughly where a hero is. */
  spawnFlyer(world) {
    const c = this.cfg.flyers;
    const b = world.dungeon.floorBounds;
    const p = world.player;
    const side = randInt(0, 3);
    const x = side === 0 ? b.left - 20 : side === 1 ? b.right + 20 : rand(b.left + 40, b.right - 40);
    const y = side === 2 ? b.top + 20 : side === 3 ? b.bottom + 20 : rand(b.top + 60, b.bottom - 40);
    const tx = (p.dead ? (b.left + b.right) / 2 : p.x) + rand(-90, 90);
    const ty = (p.dead ? (b.top + b.bottom) / 2 : p.y) + rand(-70, 70);
    const a = angleTo(x, y, tx, ty);
    const speed = rand(c.speed[0], c.speed[1]);
    this.flyers.push({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0, rot: rand(-0.3, 0.3), spin: rand(-1.2, 1.2),
      name: choose(['bookStack', 'candelabra', 'chair', 'globe', 'scrollRack']), hit: new Set(),
    });
    Sound.play('phantomAppear', 0.3);
  }

  /** A flier: the object turning slowly in the air in a violet glow, its shadow on the floor. */
  drawFlyer(ctx, F) {
    const pr = Sprites.props[F.name];
    const lift = 30 + Math.sin(F.t * 2) * 5;
    drawShadow(ctx, F.x, F.y, 12, 4, 0.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, F.x, F.y - lift - 10, 28, '170, 120, 255', 0.45, 2, 24);
    ctx.restore();
    if (!pr) return;
    ctx.save();
    ctx.translate(Math.round(F.x), Math.round(F.y - lift));
    ctx.rotate(F.rot);
    ctx.drawImage(pr.img, -pr.ax, -pr.ay + pr.img.height / 2);
    ctx.restore();
  }

  // ---------- blinking ----------

  /** Someone right on top of her: she blinks away, still close by. True if she blinked. */
  tryBlink(world) {
    const c = this.cfg.blink;
    if (this.blinkCd > 0) return false;
    const near = world.heroes.find((h) => !h.dead && dist(h.x, h.y, this.x, this.y) < c.trigger);
    if (!near) return false;
    const f = world.dungeon;
    const b = f.floorBounds;
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const d = rand(c.distance[0], c.distance[1]);
      const x = near.x + Math.cos(a) * d;
      const y = near.y + Math.sin(a) * d * 0.8;
      if (x < b.left + 40 || x > b.right - 40 || y < b.top + 60 || y > b.bottom - 30 || f.boxHitsWall(x, y, this.hw, this.hh)) continue;
      // the spot furthest from the other heroes too
      const score = Math.min(...world.heroes.filter((h) => !h.dead).map((h) => dist(h.x, h.y, x, y)));
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) return false;
    this.blinkCd = c.cooldown;
    world.effects.burst(this.x, this.y - 30, { count: 26, colors: ['#46286a', '#9a72cc', '#e4cfff', '#ffffff'], speed: [40, 160], life: [0.3, 0.6] });
    this.x = best.x;
    this.y = best.y;
    world.effects.burst(this.x, this.y - 30, { count: 26, colors: ['#46286a', '#9a72cc', '#e4cfff', '#ffffff'], speed: [40, 160], life: [0.3, 0.6] });
    world.effects.text(this.hx, this.hy - 50, 'TOO CLOSE!', { color: '#e4cfff', size: 8 });
    Sound.play('phantomVanish');
    this.toWalk(0.4);
    return true;
  }

  // ---------- contact, death ----------

  contactDamage(world) {
    if (!this.targetable) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 14 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  die(world) {
    this.dying = 2.2;
    this.state = 'dying';
    this.sky = null;
    // the magic leaves the study: the fliers drop and the furniture settles
    for (const F of this.flyers) world.effects.burst(F.x, F.y - 30, { count: 10, colors: ['#c49aff', '#e4cfff'], speed: [30, 100], life: [0.3, 0.5] });
    this.flyers = [];
    this.levitateStudy(world, false);
    Sound.play('bossRoar');
    world.banner('THE PRINCESS HAS FALLEN!', '');
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.burstTimer = (this.burstTimer || 0) - dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = 0.18;
      this.flashTime = 0.08;
      world.effects.burst(this.x + rand(-16, 16), this.y - rand(10, 70), { count: 10, colors: ['#46286a', '#9a72cc', '#e4cfff', '#efe6cf'], speed: [40, 160], life: [0.4, 0.9], gravity: 60 });
      Sound.play('phantomVanish', 0.15);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.x, this.y - 40, { count: 70, colors: ['#46286a', '#9a72cc', '#e4cfff', '#ecd690', '#ffffff'], speed: [80, 300], life: [0.6, 1.3], size: [2, 5] });
      world.shake(10, 0.6);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  // ---------- entrance: disturbed at her books ----------

  updateIntro(dt, world) {
    const I = PRINCESS_INTRO;
    const before = this.introAt;
    this.introAt += dt;
    this.intro = I.total - this.introAt;
    const crossed = (at) => before < at && this.introAt >= at;
    // pages turning as she reads
    if (this.introAt < I.notice && vrand(0, 1) < dt * 3) world.effects.burst(this.x + vrand(-8, 8), this.y - 4, { count: 1, colors: ['#efe6cf', '#c49aff'], speed: [10, 30], life: [0.4, 0.7], up: 30 });
    if (crossed(I.notice)) Sound.play('parryReady');
    if (crossed(I.rage)) {
      // the book slams shut and she's on her feet, furious
      world.shake(4, 0.25);
      world.effects.burst(this.x, this.y - 30, { count: 30, colors: ['#ff5a6a', '#c49aff', '#ffffff'], speed: [60, 200], life: [0.3, 0.7] });
      world.effects.text(this.hx, this.headY - 10, 'HOW DARE YOU?!', { color: '#ff6a7a', size: 11, life: 1.6 });
      Sound.play('blockClang');
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
    }
    if (this.intro <= 0) this.intro = 0;
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  currentFrame() {
    const F = Sprites.enemies.princess;
    if (this.dying > 0) return F.idle[0];
    return heroFrame(F, this.moving, this.animTime * 1.2);
  }

  drawGround(ctx) {
    if (this.dead) return;
    drawShadow(ctx, this.x, this.y + 2, 16, 5, this.vaultLift ? 0.2 : 0.35);
    // the aim line of her crossbow while she draws a burst
    if (this.state === 'burstWindup') {
      const end = { x: this.handX + Math.cos(this.aim) * 520, y: this.handY + Math.sin(this.aim) * 520 };
      Telegraph.line(ctx, this.handX, this.handY, end.x, end.y, 4, this.t / this.cfg.burst.windup, '170, 120, 255');
    }
    if (this.state === 'volleyWindup') {
      Telegraph.cone(ctx, this.handX, this.handY, this.aim, this.cfg.volley.spreadDegrees * DEG, 260, this.t / this.cfg.volley.windup, '255, 200, 90');
    }
    // where the giant arrow will fall: a golden mark following you, then locking on
    const S = this.sky;
    if (S) {
      const c = this.cfg.sky;
      Telegraph.circle(ctx, S.x, S.y, c.radius, S.t / (c.track + c.fall), S.locked ? '255, 90, 60' : '255, 200, 90');
    }
  }

  getDrawables() {
    if (this.dead) return [];
    const out = [{ y: this.y, draw: (ctx) => this.drawPrincess(ctx) }];
    for (const F of this.flyers) out.push({ y: F.y, draw: (ctx) => this.drawFlyer(ctx, F) });
    return out;
  }

  /** The giant golden arrow coming down out of the sky onto its mark (over everything). */
  drawOverlay(ctx) {
    const S = this.sky;
    if (!S || !S.locked) return;
    const c = this.cfg.sky;
    const k = clamp((S.t - c.track) / c.fall, 0, 1);
    const img = Sprites.projectiles.goldenArrow;
    const y = S.y - 30 - (1 - k * k) * 520;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, S.x, y, 40, '255, 220, 120', 0.8);
    ctx.restore();
    ctx.save();
    ctx.translate(Math.round(S.x), Math.round(y));
    ctx.rotate(Math.PI / 2);
    ctx.scale(3, 3);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }

  drawPrincess(ctx, portrait = false) {
    const I = PRINCESS_INTRO;
    const S = PRINCESS_SCALE;
    const f = this.facing;
    const frame = portrait ? Sprites.enemies.princess.idle[0] : this.currentFrame();   // the card: eyes open, never mid-blink
    const alpha = this.dying > 0 ? clamp(this.dying / 2.2, 0, 1) : 1;
    // seated at her desk until she flies into a rage
    const seated = !portrait && this.intro > 0 && this.introAt < I.rage;
    const x = this.x;
    const y = this.y - (this.vaultLift || 0) + (seated ? 8 : 0);
    const angry = !portrait && this.intro > 0 && this.introAt >= I.rage;
    // her violet aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 34, 40, angry ? '255, 90, 110' : '170, 120, 255', 0.28 * alpha, 2, 46);
    ctx.restore();
    if (this.state === 'transform') {
      // wrapped in a whirl of magic while the bow forms
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, x, y - 34, 34, 44, `rgba(255, 220, 140, ${0.5 + Math.sin(this.time * 12) * 0.3})`, 2, { dash: [4, 4], spin: this.time * 2 });
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(S, S);
    drawSprite(ctx, frame.img, 0, 0, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, f < 0, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, 0, 0, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, f < 0, alpha * 0.8);
    if (this.dying <= 0 && !seated) {
      ctx.globalAlpha = alpha;
      const hy = -14;
      if (this.state === 'potionWindup' || this.state === 'potionsWindup' || this.state === 'opening') {
        // a potion raised to throw
        const img = this.state === 'opening' || this.potion === 'fire' ? Sprites.projectiles.firePotion : Sprites.projectiles.icePotion;
        ctx.drawImage(img, Math.round(f * 12 - 6), -34);
      } else if (this.phase === 2 && (this.state !== 'transform' || this.awoke)) {
        // the magic bow, held upright across her aim, its string of light drawn while she aims
        const bow = Sprites.weapons.magicBow;
        const aiming = this.state === 'volleyWindup' || this.state === 'skyWindup';
        const a = aiming ? this.aim : (f > 0 ? -0.25 : Math.PI + 0.25);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, Math.cos(a) * 8, hy + Math.sin(a) * 8, 14, '255, 220, 140', 0.5 + Math.sin(this.time * 8) * 0.15, 1);
        ctx.restore();
        drawRotated(ctx, bow.img, Math.cos(a) * 8, hy + Math.sin(a) * 8, bow.pivotX, bow.pivotY, a);
      } else if (this.phase === 1) {
        const xb = Sprites.weapons.crossbow;
        const aiming = this.state === 'burstWindup' || this.state === 'burst';
        const a = aiming ? this.aim : (f > 0 ? 0.4 : Math.PI - 0.4);
        drawRotated(ctx, xb.img, Math.cos(a) * 6, hy + 4 + Math.sin(a) * 4, xb.pivotX, xb.pivotY, a, Math.cos(a) < 0);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (this.intro > 0 && !portrait) this.drawIntroMarks(ctx, x, y);
  }

  /** The "!" as she notices you, then a throbbing anger mark once she's furious. */
  drawIntroMarks(ctx, x, y) {
    const I = PRINCESS_INTRO;
    const top = y - 92;
    if (this.introAt >= I.notice && this.introAt < I.rage) {
      const pop = Math.min(1, (this.introAt - I.notice) / 0.12);
      HUD.text(ctx, '!', Math.round(x + 14), Math.round(top - 6 * pop), { size: 16, align: 'center', color: '#ffe680' });
    } else if (this.introAt >= I.rage) {
      const s = 1 + Math.sin(this.time * 14) * 0.15;
      const ax = Math.round(x + 16);
      const ay = Math.round(top + 10);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(s, s);
      ctx.fillStyle = OUTLINE;
      for (const [dx, dy] of [[-5, -5], [2, -5], [-5, 2], [2, 2]]) ctx.fillRect(dx - 1, dy - 1, 5, 5);
      ctx.fillStyle = '#ff3b4a';
      for (const [dx, dy] of [[-5, -5], [2, -5], [-5, 2], [2, 2]]) ctx.fillRect(dx, dy, 3, 3);
      ctx.restore();
    }
  }

  /** The title card's portrait: her, standing, crossbow in hand. */
  drawPortrait(ctx) {
    this.drawPrincess(ctx, true);
  }

}
