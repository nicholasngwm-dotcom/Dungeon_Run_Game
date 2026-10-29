// Rocketeer: LMB old rocket launcher (AMMO rockets, reloaded one at a time),
// RMB (hold) rocket jump, E barrage over an area (one rocket per rocket loaded),
// F ammo pack (refills the launcher), Q the IBFR (a huge weaving rocket whose
// blast knocks down obstacles and leaves the ground burning).
// None of his own blasts can hurt him or his allies: they only hit enemies.

// his fire burns orange-gold (enemy fire is a deep red, see ENEMY_FIRE_COLORS)
const ROCKET_FX = {
  exhaust: ['#e0461e', '#ff8a1e', '#ffd34a', '#fff6c8'],
  smoke: ['#2e2a28', '#4a4440', '#7a726a'],
  debris: ['#ffd34a', '#ff8a1e', '#fff6c8', '#5a524a'],
  hot: '255, 170, 70',
  jump: '255, 210, 110',   // the rocket jump's landing marker
  blast: '255, 110, 60',   // ...and the blast at his feet
};

/**
 * A rocket's blast at (x, y) with radius r (visual only): a white-hot flash, a fireball,
 * a shock ring racing out, orange flames, a rolling cloud of smoke, flying debris and a
 * scorch mark left on the floor. big = the IBFR.
 */
function rocketBlastFx(world, x, y, r, big = false) {
  const e = world.effects;
  e.add(big ? 4 : 2, (ctx, t) => {
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - t);
    PFX.disc(ctx, x, y, r * 0.75, r * 0.4, '#1a1210', 3);
    ctx.restore();
  }, true);
  e.add(big ? 0.7 : 0.4, (ctx, t) => {
    const k = 1 - (1 - t) ** 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 10, r * (0.6 + k * 0.5), ROCKET_FX.hot, 1.4 * (1 - t), 2, r * 0.6 * (0.6 + k * 0.5));
    PFX.disc(ctx, x, y - 10, r * 0.55 * (1 - t), r * 0.45 * (1 - t), 'rgba(255, 220, 140, 0.8)', 3);
    PFX.disc(ctx, x, y - 10, r * 0.3 * (1 - t), r * 0.25 * (1 - t), '#ffffff', 3);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - t;
    PFX.ring(ctx, x, y, r * k, r * 0.55 * k, '#fff2c8', 2, { thick: t < 0.3 ? 3 : 1 });
    ctx.restore();
  });
  e.flames(x, y, { count: big ? 12 : 5, spread: r * 0.5, height: big ? 46 : 26, width: big ? 16 : 11, life: big ? 0.9 : 0.5 });
  e.smoke(x, y - 12, { count: big ? 18 : 7, radius: r * 0.4, life: big ? 1.6 : 0.9, rise: big ? 50 : 26, colors: ROCKET_FX.smoke });
  e.burst(x, y - 10, { count: big ? 70 : 24, colors: ROCKET_FX.debris, speed: big ? [140, 420] : [80, 240], life: [0.3, big ? 1 : 0.6], size: [2, big ? 5 : 4], up: 60, gravity: 260 });
}

class Rocketeer extends Player {
  constructor(x, y) {
    super('rocketeer', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.rocketLauncher;
    this.maxCooldowns = {
      primary: c.rocket.cooldown, secondary: c.jump.cooldown, e: c.barrage.cooldown,
      f: c.ammoPack.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'ROCKET', secondary: 'JUMP', e: 'BARRAGE', f: 'AMMO PACK', q: 'IBFR' };
    this.sinceShot = 9;      // seconds since the last rocket left the launcher (reloading waits a moment)
    this.reloadT = 0;        // progress on the rocket being loaded
    this.jumpCharge = null;  // RMB held: { t }
    this.jump = null;        // in the air: { t, x0, y0, x1, y1 }
    this.salvo = [];         // barrage rockets: { x0, y0, x1, y1, t, delay, launched }
    this.bigRockets = [];    // IBFRs in flight
    this.packs = [];         // dropped ammo packs (visual): { x, y, t }
    this.packCharges = c.ammoPack.charges;   // F uses stored up
    this.packRecharge = 0;                   // seconds until the next one restocks
    this.targeting = false;  // E pressed: choosing where the barrage lands (LMB fires, RMB / E cancels)
    this.recoil = 0;
    this.reloadPose = 0;     // 0..1 how far the launcher is tipped up to reload (eases in and out)
    this.ammoShow = 0;       // seconds the ammo pips stay over his head after his ammo last changed
  }

  /** Charging a jump ties his hands; in the air he can still call in a barrage (E), nothing else. */
  get channeling() { return !!this.jumpCharge; }
  /** In the air he sails over obstacles (cover, decor) and spike traps; walls still stop him. */
  get flying() { return !!this.jump; }
  /** Nothing can touch him while he's up in the air. */
  get isInvulnerable() { return !!this.jump || super.isInvulnerable; }
  /** Passive (Blast Rider): his blasts throw enemies further. */
  get knockbackMultiplier() { return (1 + this.brew('bulldose')) * this.cfg.passive.knockback; }

  get ammo() { return Math.floor(this.resource.value + 1e-6); }

  /** Ammo per slot: a rocket for LMB, at least one for the barrage (it fires them all; E while picking only cancels). */
  abilityCost(slot) {
    if (slot === 'e') return this.targeting ? 0 : 1;
    return slot === 'primary' ? 1 : 0;
  }

  /** Cursor position, pulled in to at most maxRange from him. */
  aimPoint(maxRange) {
    const m = this.cursor;
    const d = Math.min(dist(this.x, this.y, m.x, m.y), maxRange);
    const a = angleTo(this.x, this.y, m.x, m.y);
    return { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
  }

  get muzzleX() { return this.pivotX + Math.cos(this.aim) * 32; }
  get muzzleY() { return this.pivotY + 4 + Math.sin(this.aim) * 24; }

  handleMouse(world) {
    const m = Input.mouse;
    if (this.targeting) {
      if (m.rightPressed) { this.targeting = false; Sound.play('uiClick'); }
      else if (m.leftPressed) this.fireBarrage(world);
      return;
    }
    if (this.jump) return;   // in the air: no rockets, no second jump
    if (m.left && this.cooldowns.primary <= 0) this.primary(world);
    if (m.rightPressed) this.tryAbility('secondary', world, () => this.startJumpCharge(world));
  }

  /** In the air only the barrage (E) can be used. */
  castSlot(slot, world) {
    if (this.jump && slot !== 'e') return Sound.play('denied');
    super.castSlot(slot, world);
  }

  /** No dodging out of the middle of a jump. */
  startDodge(world, aimed) {
    if (this.jump) return;
    super.startDodge(world, aimed);
  }

  // ---------- shared: a rocket's blast ----------

  /** Whether an attack crits, rolled once (with his crit chance). */
  rollCrit() { return Math.random() < this.critChance; }

  /**
   * Hurts every enemy within r of (x, y): never him, never his allies. A blast crits all or
   * nothing: opts.crit if the rocket's crit was already rolled, otherwise one roll for the whole blast.
   */
  blast(world, x, y, r, damage, knockback, opts = {}) {
    const crit = opts.crit ?? this.rollCrit();
    this.hitCircle(world, x, y, r, damage, { knockback, sound: 'hit', fromUlt: opts.fromUlt, crit, exclude: opts.exclude });
    rocketBlastFx(world, x, y, r, opts.big);
    world.shake(opts.big ? 14 : 2 + r / 40, opts.big ? 0.7 : 0.2);
    Sound.play(opts.big ? 'ibfrBoom' : 'rocketBoom', 0.05);
  }

  /** Incendiary: a rocket's blast leaves a small patch of burning ground. */
  incendiary(world, x, y) {
    if (!Upgrades.has(this, 'incendiary')) return;
    heroFireZone(world, this, x, y, { r: 40, life: 2.5, dps: 14, burnDps: 6, burnTime: 2 });
    Upgrades.state(this).flash.incendiary = world.time;
  }

  // ---------- LMB: rocket launcher ----------

  primary(world) {
    const c = this.cfg.rocket;
    this.cooldowns.primary = c.cooldown;
    if (!this.spend(c.cost, world)) return;
    this.sinceShot = 0;
    this.ammoShow = 3;
    this.reloadT = 0;
    this.recoil = 0.16;
    this.fireRocket(world, this.aim);
  }

  fireRocket(world, angle) {
    const c = this.cfg.rocket;
    const x = this.muzzleX;
    const y = this.muzzleY;
    // one crit roll for the whole rocket: if the hit crits, so does its blast; if not, neither does
    const crit = this.rollCrit();
    world.playerProjectiles.push(new Projectile({
      x, y, vx: Math.cos(angle) * c.speed, vy: Math.sin(angle) * c.speed,
      radius: 7, damage: c.damage + c.splash, life: c.life, knockback: 40, crit,   // a direct hit: the rocket and its blast in one
      sprite: Sprites.projectiles.rocket, glow: ROCKET_FX.hot,
      // the exhaust: a flickering tongue of flame out of the back
      aura: (ctx, p) => {
        const back = Math.atan2(p.vy, p.vx) + Math.PI;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.beam(ctx, p.x + Math.cos(back) * 8, p.y + Math.sin(back) * 8, back, 10 + Math.sin(p.age * 60) * 3, 6, ROCKET_FX.exhaust, 2);
        ctx.restore();
      },
      // a trail of smoke puffs left hanging behind
      fx: (p, dt, w) => {
        if (vrand(0, 1) < dt * 26) w.effects.smoke(p.x - p.vx * 0.03, p.y - p.vy * 0.03, { count: 1, radius: 4, life: 0.6, rise: 6, colors: ROCKET_FX.smoke });
      },
      // the burst: everyone round it but the one it hit square (who already took it in the direct hit)
      onHit: (p, w, hit) => {
        this.blast(w, p.x, p.y, c.radius, c.splash, c.knockback, { crit, exclude: hit ? new Set([hit]) : null });
        this.incendiary(w, p.x, p.y);
      },
    }));
    world.effects.burst(x, y, { count: 8, colors: ROCKET_FX.exhaust, speed: [40, 120], life: [0.1, 0.25], angle, spread: 0.7 });
    world.effects.smoke(this.pivotX - Math.cos(angle) * 14, this.pivotY - Math.sin(angle) * 10, { count: 2, radius: 6, life: 0.5, rise: 8, colors: ROCKET_FX.smoke });
    Sound.play('rocketLaunch', 0.04);
  }

  /** Rockets reload one at a time, a moment after the last shot. */
  updateReload(dt, world) {
    const r = this.resource;
    const c = r;
    this.sinceShot += dt;
    if (r.value >= r.max) { this.reloadT = 0; return; }
    if (this.sinceShot < c.reloadDelay) return;
    this.reloadT += dt * (1 + this.brew('manaRegen'));
    if (this.reloadT < c.reload) return;
    this.reloadT = 0;
    r.value = Math.min(r.max, this.ammo + 1);
    this.ammoShow = 3;     // the pips over his head stay up a few seconds after each one loads
    // the rocket clicks home: a puff out of the back of the tube and a brass glint
    const b = this.tubeBack();
    world.effects.burst(b.x, b.y, { count: 5, colors: ['#e0c47a', '#8a8070', '#c8c0b0'], speed: [20, 60], life: [0.15, 0.3] });
    world.effects.add(0.25, (ctx, t) => PFX.star(ctx, b.x, b.y, Math.round(4 * (1 - t)) + 1, '#ffe680', '#ffffff', 1));
    Sound.play('rocketReload', 0.05);
  }

  /** Reloading right now: short of rockets, a moment since the last shot, feet on the ground. */
  get reloading() {
    const r = this.resource;
    return r.value < r.max && this.sinceShot >= r.reloadDelay && !this.jumpCharge && !this.jump && !this.dead;
  }

  /** His own kills feed the launcher (Rapid Rocket Reload). */
  onKill(world, e) {
    if (e?.lastHitBy === this) Upgrades.rapidReload(this, world);
  }

  /** The open back end of the launcher tube, where rockets slide in (follows the drawn weapon). */
  tubeBack() {
    const a = this.weaponAngle();
    const reach = this.weaponReach;
    const wx = this.pivotX + Math.cos(this.aim) * reach;
    const wy = this.pivotY + 4 + Math.sin(this.aim) * reach * 0.7;
    return { x: wx - Math.cos(a) * 11, y: wy - Math.sin(a) * 11, angle: a };
  }

  /**
   * The reload: the launcher tipped up, a fresh rocket in his hand sliding into the back of
   * the tube as the reload fills, and the rockets loaded shown as pips over his head.
   */
  drawReload(ctx) {
    if (this.reloadPose > 0.6 && this.reloading) {
      const p = clamp(this.reloadT / this.resource.reload, 0, 1);
      if (p > 0.12 && p < 0.9) {
        const b = this.tubeBack();
        const u = clamp((p - 0.25) / 0.55, 0, 1);
        const e = u * u * (3 - 2 * u);   // eased: lifted up behind the tube, then pushed in
        const from = { x: b.x - Math.cos(b.angle) * 20, y: b.y - Math.sin(b.angle) * 20 + 8 };
        const to = { x: b.x + Math.cos(b.angle) * 6, y: b.y + Math.sin(b.angle) * 6 };
        drawRotated(ctx, Sprites.projectiles.rocket, lerp(from.x, to.x, e), lerp(from.y, to.y, e), 10, 4, b.angle);
      }
    }
    // the rockets loaded, over his head, while reloading and for a moment after
    // (always while it isn't full, so they never blink out between shots; a few seconds after that)
    if (!(this.ammo < this.resource.max || this.ammoShow > 0) || this.jumpCharge) return;
    const r = this.resource;
    const n = r.max;
    const w = 5;
    const x0 = Math.round(this.x - (n * (w + 2) - 2) / 2);
    const y = Math.round(this.y - 64);
    const loading = this.reloading ? clamp(this.reloadT / r.reload, 0, 1) : 0;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (w + 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, w + 2, 10);
      ctx.fillStyle = '#2a1a14';
      ctx.fillRect(x, y, w, 8);
      const fill = i < this.ammo ? 1 : i === this.ammo ? loading : 0;
      if (fill <= 0) continue;
      const h = Math.round(8 * fill);
      ctx.fillStyle = '#c8342a';
      ctx.fillRect(x, y + 8 - h, w, h);
      ctx.fillStyle = '#ee6a4a';
      ctx.fillRect(x, y + 8 - h, 1, h);
      if (fill >= 1) { ctx.fillStyle = '#e0c47a'; ctx.fillRect(x, y, w, 2); }   // its brass nose
    }
  }

  // ---------- RMB (hold): rocket jump ----------

  startJumpCharge() {
    this.jumpCharge = { t: 0 };
    Sound.play('jumpCharge');
  }

  /** 0..1 how far the rocket jump is charged. */
  get jumpPower() {
    return this.jumpCharge ? clamp(this.jumpCharge.t / this.cfg.jump.chargeTime, 0, 1) : 0;
  }

  /**
   * Where the jump lands at this charge: toward the cursor, as far as the charge reaches
   * (never past the cursor), stopping short of walls and shut doors (it sails over
   * obstacles), and never on top of one.
   */
  jumpTarget(world, power = this.jumpPower) {
    const c = this.cfg.jump;
    const dg = world.dungeon;
    const m = this.cursor;
    const a = angleTo(this.x, this.y, m.x, m.y);
    const want = clamp(dist(this.x, this.y, m.x, m.y), c.minDistance, lerp(c.minDistance, c.maxDistance, power));
    let reach = 0;
    for (let d = 8; d <= want; d += 8) {
      if (dg.boxHitsWall(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, this.hw, this.hh, true)) break;
      reach = d;
    }
    // back off from any obstacle it would come down on
    while (reach > 0 && dg.boxHitsWall(this.x + Math.cos(a) * reach, this.y + Math.sin(a) * reach, this.hw, this.hh, false)) reach -= 4;
    reach = Math.max(0, reach);
    return { x: this.x + Math.cos(a) * reach, y: this.y + Math.sin(a) * reach, angle: a };
  }

  /** The rocket jump charges while RMB is held. */
  get holdsSecondary() { return true; }

  updateJumpCharge(dt, world) {
    this.jumpCharge.t += dt;
    if (Input.mouse.right && !this.dead && !(this.stunTime > 0)) return;
    this.launchJump(world);
  }

  /** He fires a rocket into the floor at his feet and rides the blast. */
  launchJump(world) {
    const c = this.cfg.jump;
    const power = this.jumpPower;
    const to = this.jumpTarget(world);
    this.jumpCharge = null;
    this.cooldowns.secondary = c.cooldown;
    this.blast(world, this.x, this.y, c.radius, c.damage, c.knockback);
    // the longer the charge, the longer (and higher) he's in the air
    const time = lerp(c.flightTime[0], c.flightTime[1], power);
    this.jump = { t: 0, x0: this.x, y0: this.y, x1: to.x, y1: to.y, time, height: lerp(c.height[0], c.height[1], power) };
    this.facing = to.x >= this.x ? 1 : -1;
    this.iframes = Math.max(this.iframes, time + 0.15);   // and a moment after landing
    this.kbx = this.kby = 0;
    this.cooldowns.primary = Math.max(this.cooldowns.primary, 0.2);
    Sound.play('rocketJump');
  }

  updateJump(dt, world) {
    const J = this.jump;
    const c = this.cfg.jump;
    J.t += dt;
    const k = Math.min(1, J.t / J.time);
    this.x = lerp(J.x0, J.x1, k);
    this.y = lerp(J.y0, J.y1, k);
    this.kbx = this.kby = 0;
    if (vrand(0, 1) < 0.7) world.effects.smoke(this.x, this.y - this.jumpHeight - 6, { count: 1, radius: 5, life: 0.5, rise: 4, colors: ROCKET_FX.smoke });
    if (k < 1) return;
    this.jump = null;
    world.effects.burst(this.x, this.y, { count: 14, colors: ['#8a7a6a', '#c8c0b0', '#5a524a'], speed: [40, 140], life: [0.2, 0.4] });
    world.effects.smoke(this.x, this.y, { count: 4, radius: 10, life: 0.5, rise: 6, colors: ['#5a524a', '#8a8070', '#b0a898'] });
    if (this === world.localPlayer) world.shake(3, 0.12);
    Sound.play('stomp', 0.1);
  }

  /** How high he is off the floor mid-jump. */
  get jumpHeight() {
    if (!this.jump) return 0;
    const k = Math.min(1, this.jump.t / this.jump.time);
    return Math.sin(k * Math.PI) * this.jump.height;
  }

  // ---------- E: barrage ----------

  /** E starts picking the area (E again cancels); LMB then fires the barrage there. */
  abilityE() {
    this.targeting = !this.targeting;
    Sound.play(this.targeting ? 'aim' : 'uiClick');
  }

  /** One rocket per rocket in the launcher, each falling on a random spot in the area at the cursor. */
  fireBarrage(world) {
    const c = this.cfg.barrage;
    this.targeting = false;
    this.cooldowns.primary = Math.max(this.cooldowns.primary, 0.25);   // so the click doesn't also fire a rocket
    if (!this.spend(1, world)) return;
    const n = this.ammo + 1;            // the one just spent, and every other one loaded
    this.resource.value -= n - 1;
    this.cooldowns.e = c.cooldown;
    this.sinceShot = 0;
    this.ammoShow = 3;
    this.reloadT = 0;
    const at = this.aimPoint(c.maxRange);
    // spread evenly over the whole area (a sunflower spiral: any number of rockets, none stacked
    // on another), the pattern turned a random way each time, each spot nudged only a little
    const turn = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = turn + i * 2.39996;   // the golden angle
      const d = c.radius * 0.85 * Math.sqrt((i + 0.5) / n) + rand(-6, 6);
      this.salvo.push({ x1: at.x + Math.cos(a) * d, y1: at.y + Math.sin(a) * d * 0.7, t: 0, delay: i * c.interval, launched: false });
    }
    world.effects.text(this.hx, this.hy - 34, `BARRAGE x${n}`, { color: '#ff9a3a', size: 8 });
  }

  updateSalvo(dt, world) {
    const c = this.cfg.barrage;
    for (const s of this.salvo) {
      s.delay -= dt;
      if (s.delay > 0) continue;
      if (!s.launched) {
        // up out of the launcher, high over the area
        s.launched = true;
        s.x0 = this.muzzleX;
        s.y0 = this.muzzleY;
        this.recoil = 0.12;
        world.effects.burst(s.x0, s.y0, { count: 6, colors: ROCKET_FX.exhaust, speed: [40, 110], life: [0.1, 0.25], up: 60 });
        Sound.play('rocketLaunch', 0.04);
      }
      s.t += dt;
      if (s.t < c.flightTime) continue;
      s.dead = true;
      this.blast(world, s.x1, s.y1, c.blastRadius, c.damage, 120);
      this.incendiary(world, s.x1, s.y1);
    }
    removeDead(this.salvo);
  }

  /** Where a barrage rocket is on its arc (k 0..1), and the way it's pointing. */
  salvoPos(s) {
    const k = clamp(s.t / this.cfg.barrage.flightTime, 0, 1);
    const h = Math.sin(k * Math.PI) * 120;
    const x = lerp(s.x0, s.x1, k);
    const y = lerp(s.y0, s.y1, k) - h;
    const dh = Math.cos(k * Math.PI) * 120 * Math.PI;   // d(height)/dk
    return { x, y, angle: Math.atan2(s.y1 - s.y0 - dh, s.x1 - s.x0) };
  }

  // ---------- F: ammo pack ----------

  abilityF(world) {
    const r = this.resource;
    if (r.value >= r.max) {
      world.effects.text(this.hx, this.hy - 34, 'AMMO FULL', { color: '#d8c8a0', size: 7 });
      Sound.play('denied');
      return;
    }
    const c = this.cfg.ammoPack;
    this.packCharges--;
    if (this.packRecharge <= 0) this.packRecharge = c.cooldown;
    this.cooldowns.f = this.packCharges > 0 ? 0 : this.packRecharge;
    const gained = r.max - this.ammo;
    r.value = r.max;
    this.ammoShow = 3;
    this.reloadT = 0;
    this.packs.push({ x: this.x + this.facing * 24, y: this.y + 4, t: 0 });
    world.effects.text(this.hx, this.hy - 34, `+${gained} ROCKETS`, { color: '#ff9a3a', size: 8 });
    world.effects.burst(this.hx, this.hy, { count: 14, colors: ['#ff9a3a', '#ffd34a', '#ffffff'], speed: [30, 100], life: [0.3, 0.6], up: 50 });
    Sound.play('ammoPack');
  }

  /** Packs restock one at a time; F is only on cooldown once both are used. */
  updatePackCharges(dt) {
    const c = this.cfg.ammoPack;
    if (this.packCharges < c.charges) {
      this.packRecharge -= dt * this.abilityHaste;
      if (this.packRecharge <= 0) {
        this.packCharges++;
        this.packRecharge = this.packCharges < c.charges ? c.cooldown : 0;
      }
    }
    this.cooldowns.f = this.packCharges > 0 ? Math.min(this.cooldowns.f, 0) : this.packRecharge;
  }

  /** Ammo pack count for the HUD's F slot. */
  get slotCharges() {
    const c = this.cfg.ammoPack;
    return { f: { count: this.packCharges, max: c.charges, refill: this.packCharges < c.charges ? 1 - this.packRecharge / c.cooldown : 1 } };
  }

  // ---------- Q: the IBFR ----------

  ultimate(world) {
    const c = this.cfg.ult;
    this.recoil = 0.4;
    this.bigRockets.push({ x0: this.muzzleX, y0: this.muzzleY, x: this.muzzleX, y: this.muzzleY, angle: this.aim, t: 0, heading: this.aim });
    world.effects.text(this.hx, this.hy - 40, 'IBFR!', { color: '#ffd34a', size: 10 });
    world.effects.smoke(this.x, this.y, { count: 8, radius: 16, life: 0.8, rise: 10, colors: ROCKET_FX.smoke });
    if (this === world.localPlayer) world.shake(5, 0.25);
    Sound.play('ibfrLaunch');
  }

  /** Where the IBFR is t seconds out: straight on along its angle, weaving side to side. */
  ibfrAt(B, t) {
    const c = this.cfg.ult;
    const along = c.speed * t;
    const side = Math.sin(t * c.waves * TAU) * c.amplitude * Math.min(1, t * 3);
    const nx = -Math.sin(B.angle);
    const ny = Math.cos(B.angle);
    return { x: B.x0 + Math.cos(B.angle) * along + nx * side, y: B.y0 + Math.sin(B.angle) * along + ny * side };
  }

  updateBigRockets(dt, world) {
    const c = this.cfg.ult;
    for (const B of this.bigRockets) {
      B.t += dt;
      const pos = this.ibfrAt(B, B.t);
      B.heading = Math.atan2(pos.y - B.y, pos.x - B.x);
      B.x = pos.x;
      B.y = pos.y;
      // unstable: it sheds sparks and smoke the whole way
      if (vrand(0, 1) < 0.9) world.effects.smoke(B.x - Math.cos(B.heading) * 26, B.y - Math.sin(B.heading) * 26, { count: 1, radius: 9, life: 0.9, rise: 10, colors: ROCKET_FX.smoke });
      if (vrand(0, 1) < 0.6) world.effects.burst(B.x, B.y, { count: 1, colors: ROCKET_FX.exhaust, speed: [40, 140], life: [0.15, 0.35] });
      const hitWall = world.dungeon.isSolidAt(B.x, B.y);
      const hitFoe = world.getTargets().some((t) => dist(B.x, B.y, t.hx, t.hy) < 16 + t.radius);
      if (!hitWall && !hitFoe && B.t < c.life) continue;
      B.dead = true;
      this.detonate(world, B.x, B.y);
    }
    removeDead(this.bigRockets);
  }

  /** The IBFR goes off: a massive blast, every obstacle near it knocked down, the ground left burning. */
  detonate(world, x, y) {
    const c = this.cfg.ult;
    this.blast(world, x, y, c.radius, c.damage, c.knockback, { big: true, fromUlt: true });
    world.run?.destroyObstacles(x, y, c.destroyRadius);
    world.effects.text(x, y - 60, 'BOOM!', { color: '#ffd34a', size: 14, life: 1.2 });
    heroFireZone(world, this, x, y, { r: c.fireRadius, life: c.fireTime, dps: c.fireDps, burnDps: c.burnDps, burnTime: c.burnTime });
  }

  // ---------- passive: Blast Rider ----------

  update(dt, world) {
    super.update(dt, world);
    this.checkLastStand(world);   // (poison and burns can finish him off inside update)
  }

  hurt(amount, world, fromX, fromY, opts) {
    const landed = super.hurt(amount, world, fromX, fromY, opts);
    this.checkLastStand(world);
    return landed;
  }

  /** Back on his feet: a fresh rack of rockets on his back. */
  revive(hpRatio, world = null) {
    super.revive(hpRatio, world);
    this.payloadSpent = false;
  }

  checkLastStand(world) {
    if (!this.dead || this.payloadSpent || !world) return;
    this.payloadSpent = true;
    this.lastStand(world);
  }

  /** He goes down and the three rockets on his back go off: one big blast, three fireballs round it, the ground left burning. */
  lastStand(world) {
    const c = this.cfg.passive.lastStand;
    const actor = world.actor;
    world.setActor(this);   // the damage is his, whoever (or whatever) brought him down
    this.blast(world, this.x, this.y - 6, c.radius, c.damage, 300);
    world.setActor(actor);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU - Math.PI / 2;
      const x = this.x + Math.cos(a) * c.radius * 0.45;
      const y = this.y + Math.sin(a) * c.radius * 0.3;
      world.after(0.08 * (i + 1), () => rocketBlastFx(world, x, y, c.radius * 0.5));
    }
    // splinters of the rack and spent rocket casings flung out
    world.effects.burst(this.x, this.y - 20, { count: 30, colors: ['#6e4424', '#94603a', '#46562c', '#c8a878'], speed: [120, 320], life: [0.4, 0.9], up: 140, gravity: 500, size: [2, 4] });
    heroFireZone(world, this, this.x, this.y, { r: c.fireRadius, life: c.fireTime, dps: c.fireDps, burnDps: c.burnDps, burnTime: c.burnTime });
    world.effects.text(this.x, this.y - 70, 'LAST HURRAH!', { color: '#ffd34a', size: 12, life: 1.4 });
    world.shake(10, 0.5);
  }

  /** The passive panel shows the rockets loaded (pips) and the next one loading (bar). */
  get passiveInfo() {
    const r = this.resource;
    const n = this.ammo;
    return {
      name: 'BLAST RIDER', color: '#ff9a3a', pips: n, maxPips: r.max, ready: n >= r.max,
      bar: n < r.max ? clamp(this.reloadT / r.reload, 0, 1) : null,
      text: n < 1 ? 'RELOADING' : `${n}/${r.max} ROCKETS`,
    };
  }

  // ---------- update & drawing ----------

  updateAbility(dt, world) {
    this.world = world;   // for the jump preview while drawing
    this.recoil -= dt;
    this.ammoShow -= dt;
    this.reloadPose += ((this.reloading ? 1 : 0) - this.reloadPose) * Math.min(1, dt * 12);
    this.updatePackCharges(dt);
    this.updateReload(dt, world);
    if (this.jumpCharge) this.updateJumpCharge(dt, world);
    if (this.jump) this.updateJump(dt, world);
    this.updateSalvo(dt, world);
    this.updateBigRockets(dt, world);
    for (const pk of this.packs) { pk.t += dt; if (pk.t > 1.4) pk.dead = true; }
    removeDead(this.packs);
  }

  /** Ability outlines while a key is held: the IBFR's weaving path (the barrage picks its area with LMB). */
  /** Barrage: an orange strike zone placed on a spot. IBFR: a long fiery beam. */
  abilityPreview(slot) {
    if (slot === 'e' && !this.targeting) {
      const c = this.cfg.barrage;
      const pt = this.aimPoint(c.maxRange);
      return { circle: { x: pt.x, y: pt.y, r: c.radius, sy: 0.7 }, rgb: '255, 154, 58' };
    }
    if (slot === 'q') {
      const c = this.cfg.ult;
      return { lane: { x: this.pivotX, y: this.pivotY, angle: this.aim, length: c.speed * c.life, width: c.amplitude * 2 + 30 }, rgb: '255, 120, 40' };
    }
    return null;
  }

  drawGroundExtras(ctx) {
    // the barrage: a warning ring where each rocket will land
    for (const s of this.salvo) {
      const k = s.launched ? clamp(s.t / this.cfg.barrage.flightTime, 0, 1) : 0;
      PFX.zone(ctx, s.x1, s.y1, this.cfg.barrage.blastRadius, k, ROCKET_FX.blast, { sy: 0.55, spin: k * 3 });
    }
    if (this.jumpCharge && this.world) this.drawJumpPreview(ctx);
    if (this.targeting && this.isLocal) {
      // picking the barrage's area: the circle at the cursor, a rocket marker for each one loaded
      const c = this.cfg.barrage;
      const pt = this.aimPoint(c.maxRange);
      const pulse = 0.7 + Math.sin(this.animTime * 8) * 0.15;
      PFX.zone(ctx, pt.x, pt.y, c.radius, 0.35, ROCKET_FX.blast, { sy: 0.7, spin: this.animTime * 0.8, alpha: pulse });
      const n = this.ammo;
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * TAU + this.animTime;
        PFX.star(ctx, pt.x + Math.cos(a) * c.radius * 0.5, pt.y + Math.sin(a) * c.radius * 0.35, 2, '#ff9a3a', '#fff2a0', 2);
      }
    }
  }

  /**
   * While the rocket jump charges: the blast ring at his feet (where the rocket goes in),
   * the arc he'll fly and the ring where he'll land, filling as it charges.
   */
  drawJumpPreview(ctx) {
    const c = this.cfg.jump;
    const power = this.jumpPower;
    const to = this.jumpTarget(this.world, power);
    const pulse = 0.65 + Math.sin(this.animTime * 10) * 0.2;
    // the rocket's blast at his feet, and the line it fires down from the launcher
    PFX.zone(ctx, this.x, this.y, c.radius, power, ROCKET_FX.blast, { sy: 0.55, spin: this.animTime * 2, alpha: pulse });
    const wa = this.weaponAngle();
    const mx = this.pivotX + Math.cos(wa) * 30;
    const my = this.pivotY + 4 + Math.sin(wa) * 22;
    PFX.line(ctx, mx, my, this.x - Math.cos(to.angle) * 14, this.y + 8, `rgba(${ROCKET_FX.blast}, ${pulse})`, 2, [3, 2], -this.animTime * 20);
    // the flight path: a bold dashed arc (higher the longer it charges), marching toward where he'll land
    const h = lerp(c.height[0], c.height[1], power);
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const u = i / 18;
      pts.push([lerp(this.x, to.x, u), lerp(this.y, to.y, u) - 20 - Math.sin(u * Math.PI) * h]);
    }
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      PFX.line(ctx, x1 - 1, y1 - 1, x2 - 1, y2 - 1, OUTLINE, 4);
    }
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      PFX.line(ctx, x1, y1, x2, y2, `rgb(${ROCKET_FX.jump})`, 2, [4, 3], -this.animTime * 24 + i * 7);
    }
    // where he'll land: a filled ring, a ghost of him standing there, a cross at his feet
    PFX.zone(ctx, to.x, to.y, 30, Math.max(0.35, power), ROCKET_FX.jump, { sy: 0.5, spin: -this.animTime * 2, alpha: 1 });
    const frame = this.frames.idle[0];
    drawSprite(ctx, frame.img, to.x, to.y, HERO_ANCHOR.x, HERO_ANCHOR.y, to.x < this.x, 0.35 + 0.15 * pulse);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(to.x) - 6, Math.round(to.y) - 2, 13, 4);
    ctx.fillRect(Math.round(to.x) - 2, Math.round(to.y) - 5, 4, 10);
    ctx.fillStyle = `rgb(${ROCKET_FX.jump})`;
    ctx.fillRect(Math.round(to.x) - 5, Math.round(to.y) - 1, 11, 2);
    ctx.fillRect(Math.round(to.x) - 1, Math.round(to.y) - 4, 2, 8);
  }

  drawExtras(ctx) {
    // barrage rockets arcing over
    for (const s of this.salvo) {
      if (!s.launched) continue;
      const p = this.salvoPos(s);
      drawRotated(ctx, Sprites.projectiles.rocket, p.x, p.y, 10, 4, p.angle);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.beam(ctx, p.x - Math.cos(p.angle) * 9, p.y - Math.sin(p.angle) * 9, p.angle + Math.PI, 8, 5, ROCKET_FX.exhaust, 2);
      ctx.restore();
    }
    // the IBFR, wobbling as it weaves, a roaring plume behind it
    for (const B of this.bigRockets) {
      const a = B.heading + Math.sin(B.t * 40) * 0.05;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, B.x, B.y, 34, ROCKET_FX.hot, 0.8);
      PFX.beam(ctx, B.x - Math.cos(a) * 24, B.y - Math.sin(a) * 24, a + Math.PI, 26 + Math.sin(B.t * 50) * 6, 14, ROCKET_FX.exhaust, 2);
      ctx.restore();
      drawRotated(ctx, Sprites.projectiles.ibfr, B.x, B.y, 26, 11, a);
    }
    // dropped ammo packs: thrown down, the lid popping, then fading away
    for (const pk of this.packs) {
      const img = Sprites.items.ammoPack;
      const fall = Math.max(0, 1 - pk.t / 0.15);
      ctx.save();
      ctx.globalAlpha = pk.t > 1 ? 1 - (pk.t - 1) / 0.4 : 1;
      drawShadow(ctx, pk.x, pk.y, 11, 3, 0.3);
      ctx.drawImage(img, Math.round(pk.x - img.width / 2), Math.round(pk.y - img.height - fall * 24));
      ctx.restore();
    }
    this.drawReload(ctx);
    // the jump's charge, over his head
    if (this.jumpCharge) {
      const w = 30;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.y - 58);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = this.jumpPower >= 1 ? '#fff2a0' : '#ff9a3a';
      ctx.fillRect(x, y, Math.round(w * this.jumpPower), 3);
    }
  }

  /** In the air he's drawn lifted off his shadow. */
  draw(ctx) {
    const h = this.jumpHeight;
    if (!h) return super.draw(ctx);
    ctx.save();
    ctx.translate(0, -Math.round(h));
    super.draw(ctx);
    // untouchable up there: a golden shimmer round him, glints turning about his body
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 18, 26, '255, 220, 120', 0.45 + Math.sin(this.animTime * 16) * 0.15, 2, 30);
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 7 + (i * TAU) / 3;
      PFX.star(ctx, this.x + Math.cos(a) * 16, this.y - 18 + Math.sin(a) * 22, 2, '#fff2a0', '#ffffff', 2);
    }
    ctx.restore();
  }

  get weaponReach() { return this.recoil > 0 ? 4 : 9; }

  /** Charging the jump, the launcher points down at the floor behind him. */
  weaponAngle() {
    if (this.jumpCharge && this.world) {
      const to = this.jumpTarget(this.world);
      const back = angleTo(to.x, to.y, this.x, this.y);
      return angleTo(this.pivotX, this.pivotY, this.x + Math.cos(back) * 14, this.y + 8);
    }
    // reloading: tipped up over his shoulder so a rocket can go in the back
    if (this.reloadPose > 0.01) {
      const up = this.facing > 0 ? -0.95 : Math.PI + 0.95;
      return this.aim + angleDiff(this.aim, up) * this.reloadPose;
    }
    return this.aim;
  }
}
