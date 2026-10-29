// Knight (class id 'warrior'): LMB side-to-side sword swings, RMB (hold) carried barrier shield
// (also stops ground shockwaves), E spin attack, F stunning charge, Q world-cutting slash.

// pixel effect colours, outer edge first: steel and white with the knight's red and gold
const KNIGHT_FX = {
  slash: ['#ffffff', '#e4e7ee', '#adb2c0', '#cc5046'],
  slashGlow: ['#6a7290', '#7c1f2a'],   // soft underlay behind slashes ('lighter')
  flare: '#fff2a0',
  cleave: ['#a07a24', '#dcb44c', '#fbe796', '#ffffff'],
  sparks: ['#ffffff', '#e4e7ee', '#cc5046'],
  lane: '225, 230, 245',
  goldLane: '251, 220, 120',
};

const SWING_TIME = 0.16;      // seconds the blade takes to sweep a combo slash
const SLASH_FX_LIFE = 0.28;   // the slash effect lingers a little past the blade
/** Ease-out shared by the blade and the slash effect, so they sweep together. */
const swingEase = (u) => 1 - (1 - u) ** 3;

class Warrior extends Player {
  constructor(x, y) {
    super('warrior', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.greatblade;
    this.maxCooldowns = {
      primary: c.combo.cooldown, secondary: c.barrier.breakCooldown, e: c.spin.cooldown,
      f: c.charge.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'COMBO', secondary: 'SHIELD', e: 'SPIN', f: 'CHARGE', q: 'CLEAVE' };
    this.swingTime = 0;
    this.swingDir = 1;     // which way the next swing sweeps (flips every swing)
    this.bash = null;     // shield bash lunge in progress
    this.bashCooldown = 0;
    this.barrier = new KnightBarrier(this); // carried shield wall, raised with RMB
    this.spin = null;
    this.charge = null;
    this.cleave = null;    // ult power-up
    this.hitsTaken = 0;    // Tanker passive: hits since the last automatic block
    this.chargeCharges = c.charge.charges;  // F uses stored up
    this.chargeRecharge = 0;                // seconds until the next one refills
  }

  get channeling() { return !!(this.spin || this.cleave); }
  get ignoresContact() { return !!(this.charge || this.bash); }

  get moveMultiplier() {
    if (this.cleave) return this.cfg.ult.moveMultiplier;
    if (this.spin) return this.cfg.spin.moveMultiplier;
    if (this.shielding) return this.cfg.barrier.moveMultiplier;
    return 1;
  }

  // ---------- LMB: sword swings ----------

  /** Each swing sweeps the blade across the other way: left to right, then back. */
  primary(world) {
    this.cooldowns.primary = this.cfg.combo.cooldown;
    this.slash(world);
  }

  slash(world) {
    const c = this.cfg.combo;
    this.swingTime = SWING_TIME;
    this.swingDir *= -1;
    const arc = c.arcDegrees * DEG;
    const px = this.pivotX;
    const py = this.pivotY;
    const aim = this.aim;
    const dir = this.swingDir;
    const range = c.range * Upgrades.reach(this);   // Longer Reach
    const damage = c.damage * Upgrades.meleeScale(this);   // Beatdown stacks
    let hits = 0;
    for (const t of world.getTargets()) {
      const d = dist(px, py, t.hx, t.hy);
      if (d > range + t.radius) continue;
      const a = angleTo(px, py, t.hx, t.hy);
      if (d > t.radius && Math.abs(angleDiff(aim, a)) > arc / 2) continue;
      if (world.damageTarget(t, damage, { angle: aim, knockback: c.knockback })) {
        hits++;
        Warrior.cutFx(world, t.hx, t.hy, a + (Math.PI / 2) * dir);
      }
    }
    world.effects.add(SLASH_FX_LIFE, (ctx, t) => Warrior.drawSlashFx(ctx, px, py, aim, arc, range, dir, t));
    if (hits) Upgrades.meleeHit(this, world);
    if (hits && this === world.localPlayer) world.shake(1.5 + hits * 0.5, 0.08);
    Sound.play('swordSwing');
  }

  /**
   * The combo slash at t (0..1 of SLASH_FX_LIFE). The crescent's bright outer
   * edge sits on the hit range and sweeps the full hit arc in step with the
   * blade, then its tail chases the head and it burns out. pal: colours (the
   * knight's steel by default; the Prince passes his gold).
   */
  static drawSlashFx(ctx, px, py, aim, arc, range, dir, t, pal = KNIGHT_FX) {
    const sweep = SWING_TIME / SLASH_FX_LIFE;                // the blade's share of the effect
    const u = Math.min(1, t / sweep);
    const start = aim - (arc / 2) * dir;
    const head = start + arc * swingEase(u) * dir;
    const tail = start + arc * swingEase(clamp((t - sweep * 0.4) / (1 - sweep * 0.4), 0, 1)) * 0.92 * dir;
    const fade = t < sweep ? 1 : 1 - (t - sweep) / (1 - sweep);
    const width = 24 * (0.5 + 0.5 * fade);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * fade;
    PFX.slash(ctx, px, py, range + 2, tail, head, width * 1.7, pal.slashGlow, 2, true);
    ctx.globalCompositeOperation = 'source-over';   // solid crescent, so overlapping chunks don't blow out
    ctx.globalAlpha = fade;
    PFX.slash(ctx, px, py, range, tail, head, width, pal.slash, 2, true);
    ctx.globalCompositeOperation = 'lighter';
    // speed lines just outside the edge, and a flare riding the leading tip
    ctx.globalAlpha = 0.6 * fade;
    if (Math.abs(head - tail) > 0.5) for (const off of [6, 11]) PFX.ring(ctx, px, py, range + off, range + off, '#e4e7ee', 2, { from: lerp(tail, head, 0.35), to: head - 0.15 * dir });
    if (u < 1) {
      ctx.globalAlpha = 1;
      const hx = px + Math.cos(head) * (range - 4);
      const hy = py + Math.sin(head) * (range - 4);
      PFX.glow(ctx, hx, hy, 10, '255, 242, 160', 0.9);
      PFX.star(ctx, hx, hy, 4, pal.flare, '#ffffff', 2);
    }
    ctx.restore();
  }

  /** A bright cut flashing across a struck enemy along the swing, with a spray of sparks. */
  static cutFx(world, x, y, angle) {
    const len = 30;
    world.effects.add(0.16, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const w = 7 * (1 - t);
      PFX.beam(ctx, x - Math.cos(angle) * len / 2, y - Math.sin(angle) * len / 2, angle, len, w, ['#cc5046', '#e4e7ee', '#ffffff'], 1);
      PFX.glow(ctx, x, y, 9 * (1 - t) + 2, '255, 255, 255', 0.8);
      ctx.restore();
    });
    world.effects.burst(x, y, { count: 7, colors: KNIGHT_FX.sparks, speed: [90, 200], life: [0.12, 0.28], size: [2, 3], angle, spread: 1.2 });
  }

  // ---------- RMB (hold): carried barrier shield ----------

  get shielding() { return this.barrier.raised; }

  /** With the shield up, LMB is a shield bash instead of the combo; RMB is handled in updateShield. */
  handleMouse(world) {
    const m = Input.mouse;
    if (this.shielding) {
      if (m.leftPressed) {
        if (this.bashCooldown <= 0) this.shieldBash(world);
        else Sound.play('denied');
      }
    } else if (m.left && this.cooldowns.primary <= 0) this.primary(world);
    if (m.rightPressed && this.cooldowns.secondary > 0) Sound.play('denied');
  }

  /** Raises the barrier while RMB is held (and it isn't broken), lowers it otherwise. Stays up through a bash. */
  updateShield(world) {
    if (!world.barriers.includes(this.barrier)) world.barriers.push(this.barrier);
    const up = Input.mouse.right && (this.busy <= 0 || this.bash) && !this.channeling && this.cooldowns.secondary <= 0 && this.barrier.hp > 0;
    if (up && !this.barrier.raised) Sound.play('shieldRaise');
    this.barrier.raised = up;
    this.barrier.follow();
  }

  /** The shield stays up while RMB is held. */
  get holdsSecondary() { return true; }

  /** The shield slot glows while the shield is held up. */
  slotHeld(slot) { return slot === 'secondary' && this.barrier.raised; }

  /** The shield bash has its own HUD slot beside the shield. */
  get extraSlots() {
    return [{
      after: 'secondary', key: 'RMB+LMB', name: 'BASH', cd: this.bashCooldown, max: this.cfg.bash.cooldown,
      icon: Sprites.icons.warrior.bash, guide: 'bash',
    }];
  }

  // ---------- LMB while shielding: shield bash ----------

  shieldBash(world) {
    const c = this.cfg.bash;
    this.bashCooldown = c.cooldown;
    this.bash = { t: 0, angle: this.aim, hit: new Set() };
    this.busy = c.time;
    this.cooldowns.primary = 0.3; // so the combo doesn't swing the moment the shield drops
    world.effects.burst(this.barrier.x, this.barrier.hy, { count: 10, colors: KNIGHT_FX.sparks, speed: [40, 120], life: [0.15, 0.3] });
    Sound.play('shieldBash');
  }

  updateBash(dt, world) {
    const b = this.bash;
    const c = this.cfg.bash;
    b.t += dt;
    const speed = c.distance / c.time;
    world.dungeon.move(this, Math.cos(b.angle) * speed * dt, Math.sin(b.angle) * speed * dt);
    const arc = (c.arcDegrees * DEG) / 2;
    for (const t of world.getTargets()) {
      if (b.hit.has(t)) continue;
      const d = dist(this.x, this.hy, t.hx, t.hy);
      if (d > c.reach * Upgrades.reach(this) + t.radius) continue;
      if (d > t.radius && Math.abs(angleDiff(b.angle, angleTo(this.x, this.hy, t.hx, t.hy))) > arc) continue;
      b.hit.add(t);
      world.damageTarget(t, c.damage, { angle: b.angle, knockback: c.knockback, sound: 'impact' });
      t.stun?.(c.stun);
      this.barrier.flash = 0.15;
      world.effects.burst(t.hx, t.hy, { count: 14, colors: KNIGHT_FX.sparks, speed: [80, 220], life: [0.2, 0.4] });
      world.shake(4, 0.12);
    }
    this.afterimage(world, 0.15, 0.35);
    if (b.t >= c.time) this.bash = null;
  }

  // ---------- E: spin ----------

  abilityE() {
    const c = this.cfg.spin;
    this.cooldowns.e = c.cooldown;
    this.spin = { t: 0, tick: 0 };
    Sound.play('whirlwindStart');
  }

  /** While spinning, E cancels the spin (in updateSpin) rather than being refused as on cooldown. */
  tryAbility(slot, world, fn) {
    if (slot === 'e' && this.spin) return;
    super.tryAbility(slot, world, fn);
  }

  updateSpin(dt, world) {
    const s = this.spin;
    const c = this.cfg.spin;
    // the cooldown stays full while spinning, so it only starts once the spin ends or is cancelled
    this.cooldowns.e = c.cooldown;
    // press E again to stop spinning (ignoring the frame it started)
    if (s.t > 0 && Input.pressed('e')) {
      this.spin = null;
      return;
    }
    s.t += dt;
    s.tick -= dt;
    if (s.tick <= 0) {
      s.tick = c.tick;
      this.hitCircle(world, this.x, this.hy, c.radius, c.damage, { knockback: c.knockback, sound: 'hit' });
      Sound.play('whirlwindSpin', 0.15);
    }
    if (s.t >= c.duration) this.spin = null;
  }

  // ---------- F: charge ----------

  abilityF() {
    const c = this.cfg.charge;
    this.chargeCharges--;
    if (this.chargeRecharge <= 0) this.chargeRecharge = c.cooldown;
    this.cooldowns.f = this.chargeCharges > 0 ? 0 : this.chargeRecharge;
    this.charge = { t: 0, angle: this.aim, dashing: false, hit: new Set(), pinned: [] };
    this.busy = c.windup + c.time;
    Sound.play('chargeWindup');
  }

  updateCharge(dt, world) {
    const ch = this.charge;
    const c = this.cfg.charge;
    ch.t += dt;
    if (!ch.dashing) {
      ch.angle = this.aim;
      this.facing = Math.cos(ch.angle) >= 0 ? 1 : -1;
      if (Math.random() < 0.5) world.effects.burst(this.x, this.y, { count: 1, colors: ['#c9d3dd', '#8a7a6a'], speed: [20, 60], life: [0.2, 0.3] });
      if (ch.t >= c.windup) {
        ch.dashing = true;
        world.effects.smoke(this.x, this.y + 4, { count: 7, radius: 14, life: 0.55, rise: 8, colors: ['#3a3028', '#6a5a48', '#9a8a72'] });
        Sound.play('chargeRush');
        world.shake(4, 0.2);
      }
      return;
    }
    const speed = c.distance / c.time;
    const blocked = this.blockedAhead(world.dungeon.move(this, Math.cos(ch.angle) * speed * dt, Math.sin(ch.angle) * speed * dt), ch.angle);
    const pin = Upgrades.has(this, 'pinningCharge') ? UPGRADE_BY_ID.pinningCharge : null;
    for (const t of world.getTargets()) {
      if (ch.hit.has(t)) continue;
      if (dist(this.hx, this.hy, t.hx, t.hy) > c.width / 2 + t.radius) continue;
      ch.hit.add(t);
      // Pinning Charge: caught on the shield and carried along
      const held = pin && ch.pinned.length < pin.pins && this.pinnable(t, world);
      if (held) {
        world.damageTarget(t, c.damage, { angle: ch.angle });
        ch.pinned.push(held);
        world.effects.text(t.hx, t.hy - 30, 'PINNED', { color: pin.color, size: 7 });
        Sound.play('shieldBash', 0.05);
        continue;
      }
      // shove enemies to the side of the charge
      const side = angleDiff(ch.angle, angleTo(this.x, this.y, t.hx, t.hy)) >= 0 ? 1 : -1;
      world.damageTarget(t, c.damage, { angle: ch.angle + side * 1.1, knockback: c.knockback });
      t.stun?.(c.stun);
    }
    if (ch.pinned.length && this.carryPinned(world, blocked)) return;   // smashed into a wall: the charge stops dead
    this.afterimage(world, 0.2, 0.4);
    if (ch.t >= c.windup + c.time) {
      this.releasePinned(world);
      this.charge = null;
    }
  }

  // ---------- Pinning Charge (upgrade) ----------

  /** True if a move's collision stopped it going the way it was headed (not just sliding along a wall). */
  blockedAhead(hit, angle) {
    return (hit.hitX && Math.abs(Math.cos(angle)) > 0.3) || (hit.hitY && Math.abs(Math.sin(angle)) > 0.3);
  }

  /**
   * What the charge would carry for target t: { e, target, boss } (e is what's moved), or null.
   * Enemies that walk (not rooted ones like gravestones) and bosses whole, though not the golem
   * (far too heavy) or a boss's other parts (the Deathbringer's tendrils...).
   */
  pinnable(t, world) {
    if (t.dead) return null;
    if (world.isBossTarget(t)) {
      const b = world.boss;
      if (t !== b || b instanceof Golem || b.intro > 0 || b.dying > 0) return null;
      return { e: b, target: t, boss: true };
    }
    if (!(t instanceof Enemy) || t.cfg.speed === 0) return null;
    return { e: t, target: t, boss: false };
  }

  /**
   * The pinned ride on the front of the shield, side by side, held helpless. Returns true if
   * the knight or any of them hit a wall head on, which smashes them.
   */
  carryPinned(world, blocked) {
    const ch = this.charge;
    const a = ch.angle;
    ch.pinned = ch.pinned.filter((p) => !p.target.dead && !(p.e.dying > 0));
    const n = ch.pinned.length;
    let wall = blocked;
    ch.pinned.forEach((p, i) => {
      const e = p.e;
      const reach = 16 + (p.target.radius || 12);
      const side = (i - (n - 1) / 2) * 20;
      const tx = this.x + Math.cos(a) * reach - Math.sin(a) * side;
      const ty = this.y + Math.sin(a) * reach + Math.cos(a) * side;
      // moved as a box of its size (some bosses have no collision box of their own)
      const box = { x: e.x, y: e.y, hw: e.hw ?? 12, hh: e.hh ?? 8, flying: e.flying };
      if (this.blockedAhead(world.dungeon.move(box, tx - e.x, ty - e.y), a)) wall = true;
      e.x = box.x;
      e.y = box.y;
      e.kbx = 0;
      e.kby = 0;
      if (p.boss) e.pinnedUntil = world.time + 0.15;
      else e.stunTime = Math.max(e.stunTime || 0, 0.15);   // stunned the whole ride (past any stun resist)
    });
    if (!n || !wall) return false;
    this.smashPinned(world);
    return true;
  }

  /** Slammed into the wall: a massive hit for each of them (less for a boss), and they're left dazed. */
  smashPinned(world) {
    const ch = this.charge;
    const u = UPGRADE_BY_ID.pinningCharge;
    for (const p of ch.pinned) {
      const t = p.target;
      world.damageTarget(t, u.smash * (p.boss ? u.bossScale : 1), { angle: ch.angle, sound: null, color: u.color });
      if (!p.boss && !t.dead) t.stunTime = Math.max(t.stunTime || 0, u.stun);
      world.effects.burst(t.hx, t.hy, { count: 26, colors: ['#ffffff', '#ffe680', '#e0a83a', '#8a7a6a'], speed: [80, 260], life: [0.3, 0.7], up: 40, size: [1, 4] });
      world.effects.smoke(t.x, t.y - 6, { count: 6, radius: 14, life: 0.6, rise: 10, colors: ['#3a3028', '#6a5a48', '#9a8a72'] });
    }
    // the impact: a flash and a shockwave ring at the shield's face, stone dust flying off the wall
    const fx = this.x + Math.cos(ch.angle) * 26;
    const fy = this.y + Math.sin(ch.angle) * 26;
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.glow(ctx, fx, fy - 10, 40 + t * 30, '255, 220, 140', 0.8, 2, (40 + t * 30) * 0.7);
      PFX.ring(ctx, fx, fy, 12 + t * 50, (12 + t * 50) * 0.55, '#fff2a0', 2, { thick: t < 0.3 ? 3 : 2 });
      ctx.restore();
    });
    world.effects.text(fx, fy - 50, 'SMASHED!', { color: u.color, size: 10, life: 1.2 });
    Upgrades.proc(this, world, 'pinningCharge');
    world.shake(9, 0.35);
    Sound.play('shieldBash');
    Sound.play('explosion', 0.05);
    ch.pinned = [];
    this.charge = null;
    this.busy = 0;
    this.knockback?.(ch.angle + Math.PI, 120);   // the knight rebounds off the impact
  }

  /** The charge ran its course without meeting a wall: the pinned tumble off the shield, dazed. */
  releasePinned(world) {
    const ch = this.charge;
    for (const p of ch.pinned) {
      if (p.target.dead) continue;
      if (p.boss) continue;   // the boss simply gets back to it once its pin runs out
      p.target.stunTime = Math.max(p.target.stunTime || 0, this.cfg.charge.stun);
      p.target.knockback?.(ch.angle, this.cfg.charge.knockback * 0.6);
    }
    ch.pinned = [];
  }

  // ---------- Q: world-cutting slash ----------

  ultimate(world) {
    this.cleave = { t: 0 };
    world.effects.text(this.hx, this.hy - 34, 'POWERING UP', { color: '#ffd34a', size: 8 });
    Sound.play('worldCutterCharge');
  }

  /** 0..1 charge of the cleave; damage scales from minPower to full. */
  get cleavePower() {
    const c = this.cfg.ult;
    return this.cleave ? clamp(this.cleave.t / c.powerTime, 0, 1) : 0;
  }

  updateCleave(dt, world) {
    const c = this.cfg.ult;
    const cl = this.cleave;
    // LMB releases early (ignoring the frame Q was pressed in)
    const release = cl.t > 0 && Input.mouse.leftPressed;
    cl.t += dt;
    if (Math.random() < 0.3 + this.cleavePower * 0.5) {
      world.effects.burst(this.x + rand(-14, 14), this.y - rand(0, 30), { count: 1, colors: ['#ffd34a', '#fff6c8', '#ff8a1e'], speed: [10, 40], up: 60, life: [0.3, 0.6] });
    }
    if (cl.t < c.powerTime && !release) return;
    const power = this.cleavePower;
    this.cleave = null;
    this.cooldowns.primary = 0.3; // so the releasing click doesn't also swing
    const mult = lerp(c.minPower, 1, power);
    const width = c.width * lerp(0.6, 1, power);
    const x1 = this.pivotX;
    const y1 = this.pivotY;
    this.hitLine(world, x1, y1, this.aim, c.length, width, c.damage * mult, { knockback: 400 * mult, fromUlt: true });
    this.lineFx(world, x1, y1, this.aim, c.length, width, KNIGHT_FX.cleave, 0.45);
    if (power >= 1) world.effects.text(this.hx, this.hy - 40, 'FULL POWER!', { color: '#ffd34a', size: 9 });
    const aim = this.aim;
    world.effects.add(2.5, (ctx, t) => {
      // a scorched cut in the floor
      PFX.beam(ctx, x1, y1 + 10, aim, c.length, 12, [`rgba(20, 10, 10, ${0.3 * (1 - t)})`, `rgba(20, 10, 10, ${0.55 * (1 - t)})`], 3);
    }, true);
    // rubble and dust thrown up along the cut
    for (let i = 1; i <= 4; i++) {
      const d = (c.length * i) / 4.5;
      const px = x1 + Math.cos(aim) * d;
      const py = y1 + 10 + Math.sin(aim) * d;
      world.effects.smoke(px, py, { count: 4, radius: 10 + 6 * power, life: 0.6, rise: 14, colors: ['#3a3028', '#6a5a48', '#9a8a72'] });
      world.effects.burst(px, py, { count: 5, colors: ['#fbe796', '#dcb44c', '#8a7a6a'], speed: [60, 160], life: [0.2, 0.45], up: 60, gravity: 200 });
    }
    world.shake(6 + 8 * power, 0.6);
    Sound.play('worldCutter');
  }

  // ---------- shared ----------

  /**
   * Bright pixel streak along an attack line, pointed at the far end, as wide
   * as the line's hitbox when it lands, with a glow and a flare at the tip.
   * colors = edge first.
   */
  lineFx(world, x1, y1, angle, length, width, colors, life) {
    world.effects.add(life, (ctx, t) => Warrior.drawLineFx(ctx, x1, y1, angle, length, width, colors, t));
  }

  static drawLineFx(ctx, x1, y1, angle, length, width, colors, t) {
    const k = length > 250 ? 3 : 2;
    const len = length * Math.min(1, 0.75 + t * 8);
    const w = width * (1 - t * 0.7);
    const tipX = x1 + Math.cos(angle) * len;
    const tipY = y1 + Math.sin(angle) * len;
    const core = colors[colors.length - 1];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the glow fills the hitbox's width; the bright core runs down its middle
    ctx.globalAlpha = 0.3 * (1 - t);
    PFX.beam(ctx, x1, y1, angle, len, w, [colors[0]], k);
    ctx.globalAlpha = 1 - t * t;
    PFX.beam(ctx, x1, y1, angle, len, w * 0.5, colors, k);
    // flare and a shock ring where the point lands
    PFX.glow(ctx, tipX, tipY, width * 0.5 * (1 - t) + 4, '255, 245, 220', 1 - t);
    PFX.star(ctx, tipX, tipY, Math.round(6 * (1 - t)) + 1, core, '#ffffff', 2);
    const r = width * (0.3 + t * 0.6);
    PFX.ring(ctx, tipX, tipY, r, r * 0.6, colors[1] || core, 2, { thick: t < 0.5 ? 2 : 1 });
    ctx.restore();
  }

  /** Charges refill one at a time; F is only on cooldown once they're all spent. */
  updateChargeCharges(dt) {
    const c = this.cfg.charge;
    if (this.chargeCharges < c.charges) {
      this.chargeRecharge -= dt * this.abilityHaste;
      if (this.chargeRecharge <= 0) {
        this.chargeCharges++;
        this.chargeRecharge = this.chargeCharges < c.charges ? c.cooldown : 0;
      }
    }
    this.cooldowns.f = this.chargeCharges > 0 ? Math.min(this.cooldowns.f, 0) : this.chargeRecharge;
  }

  /** Charge count for the HUD's F slot. */
  get slotCharges() {
    const c = this.cfg.charge;
    return { f: { count: this.chargeCharges, max: c.charges, refill: this.chargeCharges < c.charges ? 1 - this.chargeRecharge / c.cooldown : 1 } };
  }

  updateAbility(dt, world) {
    this.updateChargeCharges(dt);
    this.swingTime -= dt;
    if (this.spin) this.updateSpin(dt, world);
    if (this.charge) this.updateCharge(dt, world);
    if (this.cleave) this.updateCleave(dt, world);
    this.bashCooldown -= dt * this.abilityHaste;
    this.fieldFlash = (this.fieldFlash || 0) - dt;
    if (this.bash) this.updateBash(dt, world);
    this.updateShield(world);
  }

  drawGroundExtras(ctx) {
    if (this.barrier.raised && Upgrades.has(this, 'barrierField')) {
      // Barrier Force Field: a faint dome of force around him while the shield is up (it flares when it soaks a blow)
      const a = this.fieldFlash > 0 ? 0.9 : 0.35 + Math.sin(this.animTime * 6) * 0.1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, this.x, this.y - 2, 30, 16, `rgba(138, 184, 255, ${a})`, 2, { dash: [5, 3], spin: this.animTime * 1.5 });
      if (this.fieldFlash > 0) PFX.disc(ctx, this.x, this.y - 2, 30, 16, 'rgba(138, 184, 255, 0.18)', 2);
      ctx.restore();
    }
    if (this.spin) {
      // the spin's reach: a dashed steel ring turning with the blade
      PFX.ring(ctx, this.x, this.y, this.cfg.spin.radius, this.cfg.spin.radius, 'rgba(228, 231, 238, 0.45)', 2, { dash: [4, 3], spin: this.spin.t * 3 });
    }
    if (this.charge && !this.charge.dashing) {
      const c = this.cfg.charge;
      const end = { x: this.x + Math.cos(this.charge.angle) * c.distance, y: this.y + Math.sin(this.charge.angle) * c.distance };
      PFX.lane(ctx, this.x, this.y, end.x, end.y, c.width, this.charge.t / c.windup, KNIGHT_FX.lane);
    }
    if (this.cleave) {
      const c = this.cfg.ult;
      const ex = this.pivotX + Math.cos(this.aim) * c.length;
      const ey = this.pivotY + Math.sin(this.aim) * c.length;
      const power = this.cleavePower;
      PFX.lane(ctx, this.pivotX, this.pivotY, ex, ey, c.width * lerp(0.6, 1, power), power, power >= 1 ? '255, 240, 160' : KNIGHT_FX.goldLane);
    }
  }

  // ---------- passive: Tanker ----------

  get tankerReady() { return this.hitsTaken >= this.cfg.passive.hits; }

  /**
   * Enemy bodies bump off the armour: contact hits do less damage. A ground shockwave
   * rolling at the raised shield from the front breaks on it (the shield soaks the hit).
   */
  absorb(amount, world, fromX, fromY, opts) {
    if (opts.shockwave && this.blocksShockwave(fromX, fromY)) {
      this.barrier.absorb(amount, world, this.barrier.x, this.barrier.hy);
      world.effects.text(this.barrier.x, this.barrier.hy - 30, 'BLOCKED', { color: '#e4e7ee', size: 7 });
      return 0;
    }
    // Barrier Force Field: melee (anything but shots, shockwaves and traps) is halved behind the raised shield
    if (this.barrier.raised && Upgrades.has(this, 'barrierField') && !opts.projectile && !opts.shockwave && !opts.trap) {
      amount *= 0.5;
      Upgrades.state(this).flash.barrierField = world.time;
      this.fieldFlash = 0.25;
    }
    return opts.contact ? amount * (1 - this.cfg.passive.contactReduction) : amount;
  }

  /** True while the shield is up and facing a shockwave coming from (x, y). */
  blocksShockwave(x, y) {
    if (!this.barrier.raised || x === undefined) return false;
    const arc = this.cfg.barrier.shockwaveArc * DEG;
    return Math.abs(angleDiff(this.aim, angleTo(this.x, this.y, x, y))) <= arc / 2;
  }

  onHitTaken() {
    this.hitsTaken = Math.min(this.cfg.passive.hits, this.hitsTaken + 1);
  }

  /** Once enough hits have landed, the next one is shrugged off. */
  passiveBlock(world, fromX, fromY) {
    if (!this.tankerReady) return false;
    this.hitsTaken = 0;
    this.invulnerable = CONFIG.player.hurtInvulnerability;
    world.effects.text(this.hx, this.hy - 30, 'BLOCKED!', { color: '#ffd34a', size: 10, life: 0.9 });
    world.effects.burst(this.hx, this.hy - 6, { count: 18, colors: ['#ffd34a', '#fff2a0', '#c8c0b0'], speed: [60, 180], life: [0.2, 0.45] });
    const x = this.hx;
    const y = this.hy - 6;
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 16 + t * 26;
      PFX.ring(ctx, x, y, r, r, `rgba(255, 211, 74, ${1 - t})`, 2, { thick: Math.max(1, Math.round(3 * (1 - t))) });
      ctx.restore();
    });
    world.shake(3, 0.12);
    Sound.play('blockClang');
    return true;
  }

  get passiveInfo() {
    const n = this.cfg.passive.hits;
    return {
      name: 'TANKER', color: '#f2a541', pips: this.hitsTaken, maxPips: n, ready: this.tankerReady,
      text: this.tankerReady ? 'NEXT HIT BLOCKED' : `${this.hitsTaken}/${n} HITS`,
    };
  }

  /** The knight's red kite shield, glowing gold over his head while the free block is ready. */
  drawPassive(ctx) {
    if (!this.tankerReady || this.dead) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y - 54 + Math.sin(this.animTime * 4) * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, 15, '255, 211, 74', 0.8 + Math.sin(this.animTime * 8) * 0.25);
    ctx.restore();
    // pixel kite shield: outline, steel rim, red field, steel cross with a ruby
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 7, y - 8, 14, 10);
    ctx.fillRect(x - 6, y + 2, 12, 3);
    ctx.fillRect(x - 4, y + 5, 8, 2);
    ctx.fillRect(x - 2, y + 7, 4, 2);
    ctx.fillStyle = '#adb2c0';
    ctx.fillRect(x - 6, y - 7, 12, 9);
    ctx.fillRect(x - 5, y + 2, 10, 2);
    ctx.fillRect(x - 3, y + 4, 6, 2);
    ctx.fillRect(x - 1, y + 6, 2, 2);
    ctx.fillStyle = '#a63036';
    ctx.fillRect(x - 5, y - 6, 10, 8);
    ctx.fillRect(x - 4, y + 2, 8, 1);
    ctx.fillRect(x - 2, y + 3, 4, 2);
    ctx.fillStyle = '#7c1f2a';
    ctx.fillRect(x + 1, y - 6, 4, 8);
    ctx.fillStyle = '#e4e7ee';
    ctx.fillRect(x - 1, y - 6, 2, 11);
    ctx.fillRect(x - 5, y - 3, 10, 2);
    ctx.fillStyle = '#d0303a';
    ctx.fillRect(x - 1, y - 3, 2, 2);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(x - 6, y - 7, 3, 1);
  }

  drawExtras(ctx) {
    if (this.cleave) {
      // gold light gathering on the blade
      const r = 18 + Math.sin(this.animTime * 25) * 4 + this.cleavePower * 10;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.pivotX, this.pivotY, r, '255, 200, 90', 1.2);
      if (Math.floor(this.animTime * 12) % 2) PFX.star(ctx, this.pivotX + Math.cos(this.animTime * 9) * r * 0.7, this.pivotY - 6 + Math.sin(this.animTime * 9) * r * 0.4, 2, '#fbe796');
      ctx.restore();
    }
    if (this.spin) {
      // two crescents whirling with the blade, their edges tracing the spin's reach
      const a = this.spin.t * 22;
      const r = this.cfg.spin.radius;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      for (const off of [0, Math.PI]) PFX.slash(ctx, this.x, this.hy, r + 2, a + off - 2, a + off, 22, KNIGHT_FX.slashGlow, 2, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.85;
      for (const off of [0, Math.PI]) {
        PFX.slash(ctx, this.x, this.hy, r, a + off - 1.7, a + off, 14, KNIGHT_FX.slash, 2, true);
        PFX.star(ctx, this.x + Math.cos(a + off) * (r - 3), this.hy + Math.sin(a + off) * (r - 3), 3, KNIGHT_FX.flare, '#ffffff', 2);
      }
      ctx.restore();
    }
  }

  /** Ability outlines while a key is held: the spin's reach, the charge's lane, the cleave's line. */
  /** Spin: a steel ring round him. Charge: an orange dash. Cleave: a golden beam. */
  abilityPreview(slot) {
    if (slot === 'e') return { circle: { x: this.x, y: this.hy, r: this.cfg.spin.radius, self: true }, rgb: '228, 231, 238' };
    if (slot === 'f') {
      const c = this.cfg.charge;
      return { lane: { x: this.x, y: this.y, angle: this.aim, length: c.distance, width: c.width, arrow: true }, rgb: '255, 176, 96' };
    }
    if (slot === 'q') {
      const c = this.cfg.ult;
      return { lane: { x: this.pivotX, y: this.pivotY, angle: this.aim, length: c.length, width: c.width }, rgb: '255, 214, 110' };
    }
    return null;
  }

  weaponAngle() {
    if (this.spin) return this.spin.t * 22;
    if (this.charge) return this.charge.angle;
    if (this.cleave) return -Math.PI / 2 + 0.3 * this.facing;
    if (this.swingTime > 0) {
      // follows the slash effect across the same arc
      const half = (this.cfg.combo.arcDegrees * DEG) / 2;
      const t = 1 - this.swingTime / SWING_TIME;
      return this.aim + lerp(-half, half, swingEase(t)) * this.swingDir;
    }
    return this.aim - 0.5 * this.facing;
  }
}

/**
 * Knight barrier: a wall of light the knight carries and raises with RMB.
 * It's its own entity in world.barriers, so enemy projectiles (and golem
 * lasers) crossing it are soaked by the wall itself, not the knight. It sits
 * `distance` px ahead of the knight, facing the aim, and only blocks while
 * raised. Bodies and melee pass through. (x, y) are the feet of the wall's
 * centre; projectiles collide at hy.
 */
class KnightBarrier {
  constructor(owner) {
    this.owner = owner;
    this.cfg = owner.cfg.barrier;
    this.hp = this.cfg.hp;
    this.raised = false;
    this.raise = 0;          // 0..1 raise animation
    this.age = 0;
    this.flash = 0;
    this.dead = false;
    this.follow();
  }

  get hy() { return this.y - 14; }

  /** Keeps the wall in front of the knight, facing the aim. */
  follow() {
    const o = this.owner;
    const c = this.cfg;
    const cx = o.x + Math.cos(o.aim) * c.distance;
    const cy = o.hy + Math.sin(o.aim) * c.distance;
    this.x = cx;
    this.y = cy + 14;
    const perp = o.aim + Math.PI / 2;
    const hw = c.width / 2;
    this.ax = cx + Math.cos(perp) * hw;
    this.ay = cy + Math.sin(perp) * hw;
    this.bx = cx - Math.cos(perp) * hw;
    this.by = cy - Math.sin(perp) * hw;
  }

  touches(x, y, r) {
    return this.raised && pointSegmentDistance(x, y, this.ax, this.ay, this.bx, this.by) <= r + this.cfg.thickness / 2;
  }

  crossesSegment(x1, y1, x2, y2) {
    return this.raised && segmentsIntersect(this.ax, this.ay, this.bx, this.by, x1, y1, x2, y2);
  }

  absorb(amount, world, x, y) {
    if (!this.raised) return;
    this.hp -= amount;
    this.flash = 0.12;
    world.effects.burst(x, y, { count: 10, colors: ['#ffffff', '#e4e7ee', '#adb2c0'], speed: [60, 180], life: [0.15, 0.35] });
    Sound.play('barrierHit');
    if (this.hp > 0) return;
    this.hp = 0;
    this.raised = false;
    this.owner.cooldowns.secondary = this.cfg.breakCooldown;
    world.effects.text(this.x, this.hy - 36, 'SHIELD BROKEN', { color: '#e4e7ee', size: 8 });
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      world.effects.burst(lerp(this.ax, this.bx, t), lerp(this.ay, this.by, t) - 6, {
        count: 8, colors: ['#ffffff', '#e4e7ee', '#adb2c0', '#cc5046'], speed: [40, 160], life: [0.25, 0.5],
      });
    }
    world.shake(4, 0.15);
    Sound.play('barrierBreak');
  }

  /** The knight drives raising/lowering; the wall tracks him and regens while lowered. */
  update(dt) {
    const c = this.cfg;
    this.age += dt;
    this.flash -= dt;
    this.idle = this.raised ? 0 : (this.idle || 0) + dt;
    if (this.idle >= c.regenDelay) this.hp = Math.min(c.hp, this.hp + c.regen * dt);
    this.raise = clamp(this.raise + (this.raised ? 10 : -10) * dt, 0, 1);
    if (this.owner.dead) this.raised = false;
    this.follow();
  }

  draw(ctx) {
    if (this.raise <= 0) return;
    const frac = clamp(this.hp / this.cfg.hp, 0, 1);
    const top = 26 * this.raise;   // wall height above the collision line
    const foot = 14;               // ...and down to the floor
    const { ax, ay, bx, by } = this;
    const k = 2;
    const n = Math.max(2, Math.round(dist(ax, ay, bx, by) / k));
    const seamEvery = Math.max(1, Math.round(n / 5));
    const s = (this.age * 0.8) % 1;            // a band of light sweeping up the wall
    const h = PFX.snap(top + foot, k);
    ctx.save();
    ctx.globalAlpha = this.raise;
    ctx.globalCompositeOperation = 'lighter';
    const fill = this.flash > 0 ? 'rgba(235, 240, 255, 0.5)' : `rgba(150, 175, 225, ${0.12 + 0.18 * frac})`;
    const seam = `rgba(228, 231, 238, ${0.25 + 0.3 * frac})`;
    const edge = `rgba(240, 244, 255, ${0.65 + Math.sin(this.age * 12) * 0.15})`;
    const band = `rgba(228, 231, 238, ${0.5 * (1 - s)})`;
    for (let i = 0; i <= n; i++) {
      const x = PFX.snap(lerp(ax, bx, i / n), k);
      const y0 = PFX.snap(lerp(ay, by, i / n) - top, k);
      ctx.fillStyle = i % seamEvery === 0 ? seam : fill;
      ctx.fillRect(x, y0, k, h);
      ctx.fillStyle = edge;
      ctx.fillRect(x, y0, k, k);
      ctx.fillRect(x, y0 + h, k, k);
      ctx.fillStyle = band;
      ctx.fillRect(x, PFX.snap(y0 + h - s * h, k), k, k);
    }
    // the knight's cross glowing in the middle of the wall
    if (this.raise > 0.6) {
      const cx = PFX.snap(this.x, k);
      const cy = PFX.snap(this.hy - 6 * this.raise, k);
      ctx.fillStyle = `rgba(204, 80, 70, ${0.55 + 0.25 * frac})`;
      ctx.fillRect(cx - 2, cy - 8, 4, 16);
      ctx.fillRect(cx - 7, cy - 4, 14, 4);
    }
    ctx.restore();
    // hp bar over the knight
    const o = this.owner;
    const w = 30;
    const x = Math.round(o.x - w / 2);
    const y = Math.round(o.y - 46);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = frac > 0.3 ? '#e4e7ee' : '#ff8a6a';
    ctx.fillRect(x, y, Math.round(w * frac), 3);
  }
}
