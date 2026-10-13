// Base hero: movement, aiming, dodge, health, resources, ult charge, drawing.
// Each class (Warrior, Ranger, ...) extends this and implements
// primary(), secondary(), abilityE(), abilityF(), ultimate(), plus
// optional updateAbility()/draw hooks.
//
// Keys: LMB primary, RMB secondary, E, F, Q ultimate, Shift dodge.

class Player extends Entity {
  constructor(classId, x, y) {
    super(x, y);
    this.classId = classId;
    this.cfg = CONFIG.classes[classId];
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.speed = this.cfg.speed;
    this.radius = 12;
    this.hw = 9;
    this.hh = 6;
    this.frames = Sprites.heroes[classId];
    this.weapon = null;           // sprite from Sprites.weapons
    this.aim = 0;
    this.moving = false;
    this.moveDir = { x: 0, y: 0 };
    this.invulnerable = 0;        // i-frames timer after being hit
    this.iframes = 0;             // i-frames from dodges/dashes
    this.guard = 0;               // hits are silently absorbed while > 0
    this.slowTime = 0;
    this.busy = 0;                // > 0 while an ability controls the hero
    this.dodge = null;
    this.cooldowns = { primary: 0, secondary: 0, e: 0, f: 0, dodge: 0 };
    this.maxCooldowns = { primary: 1, secondary: 1, e: 1, f: 1, dodge: CONFIG.player.dodge.cooldown };
    this.icons = { primary: '', secondary: '', e: '', f: '', q: '' }; // HUD labels
    this.ult = 0;
    this.ultMax = this.cfg.ult.charge;
    this.healPopup = 0;           // batches small heals into one number
    this.healPopupTimer = 0;
    this.sinceHurt = 0;           // seconds since hp was last lost (drives passive regen)
    const r = this.cfg.resource;
    this.resource = r ? { ...r, value: r.max } : null;
  }

  /** Point the weapon rotates around (roughly the hands). */
  get pivotX() { return this.x; }
  get pivotY() { return this.y - 12; }

  /** Overridden by classes for spins, hastes, ult slowdowns... */
  get moveMultiplier() { return 1; }
  get speedMultiplier() {
    return (this.slowTime > 0 ? CONFIG.golem.slowAmount : 1) * (this.chillTime > 0 ? this.chillAmount : 1) * this.moveMultiplier;
  }

  /** Ghost auras: slowed to `amount` speed while inside one (refreshed every frame). */
  chill(amount, time = 0.2) {
    if (!(this.chillTime > 0) || amount < this.chillAmount) this.chillAmount = amount;
    this.chillTime = Math.max(this.chillTime || 0, time);
  }

  /** True while an ability blocks other abilities (movement still allowed). */
  get channeling() { return false; }

  /** True during moves that plough through enemies (charges, dash strikes). */
  get ignoresContact() { return false; }

  /** Enemy bodies don't hurt while ploughing through them, or just after. */
  get contactImmune() { return this.ignoresContact || this.contactGrace > 0; }

  /** Invisible heroes can't be seen by distant enemies. */
  get invisible() { return false; }

  get ultReady() { return this.ult >= this.ultMax; }

  update(dt, world) {
    this.animTime += dt;
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.iframes -= dt;
    this.guard -= dt;
    this.slowTime -= dt;
    this.chillTime = (this.chillTime || 0) - dt;
    this.busy -= dt;
    this.contactGrace = this.ignoresContact ? 0.3 : (this.contactGrace || 0) - dt;
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] -= dt;
    if (this.resource) this.resource.value = Math.min(this.resource.max, this.resource.value + this.resource.regen * dt);
    this.updateRegen(dt, world);
    this.updateHealPopup(dt, world);

    const m = world.mouseWorld;
    this.aim = angleTo(this.pivotX, this.pivotY, m.x, m.y);
    if (this.busy <= 0) this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;

    // movement
    let mx = 0;
    let my = 0;
    if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) my -= 1;
    if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) my += 1;
    if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) mx -= 1;
    if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    this.moveDir = { x: mx / len, y: my / len };
    this.moving = (mx !== 0 || my !== 0) && this.busy <= 0;
    if (this.moving) {
      const s = this.speed * this.speedMultiplier * dt;
      world.dungeon.move(this, this.moveDir.x * s, this.moveDir.y * s);
    }
    this.updateKnockback(dt, world);
    this.updateDodge(dt, world);

    // abilities
    if (this.busy <= 0) this.handleInput(world);
    this.updateAbility(dt, world);

    if (this.chillTime > 0 && Math.random() < 0.25) {
      world.effects.burst(this.x + rand(-9, 9), this.y - rand(0, 24), { count: 1, colors: ['#c8f0ff', '#8ad0f0'], speed: [5, 15], life: [0.3, 0.5], up: -10 });
    }
    if (this.slowTime > 0 && Math.random() < 0.3) {
      world.effects.burst(this.x + rand(-8, 8), this.y, { count: 1, colors: ['#9a7a5a', '#6b4a2a'], speed: [5, 15], life: [0.3, 0.5] });
    }
  }

  handleInput(world) {
    if (Input.wasPressed('ShiftLeft') || Input.wasPressed('ShiftRight')) this.startDodge(world);
    if (this.busy > 0 || this.channeling) return;
    if (Input.wasPressed('KeyQ')) {
      if (this.ultReady) { this.ult = 0; this.ultimate(world); }
      else Sound.play('denied');
    }
    if (Input.wasPressed('KeyE')) this.tryAbility('e', world, () => this.abilityE(world));
    if (Input.wasPressed('KeyF')) this.tryAbility('f', world, () => this.abilityF(world));
    if (this.busy > 0 || this.channeling) return;
    this.handleMouse(world);
  }

  /** Default: hold LMB for primary, press RMB for secondary. */
  handleMouse(world) {
    if (Input.mouse.left && this.cooldowns.primary <= 0) this.primary(world);
    if (Input.mouse.rightPressed) this.tryAbility('secondary', world, () => this.secondary(world));
  }

  tryAbility(slot, world, fn) {
    if (this.cooldowns[slot] > 0) return Sound.play('denied');
    fn();
  }

  /** Spends mana/energy; shows a warning and returns false if short. */
  spend(cost, world) {
    if (!this.resource || cost <= 0) return true;
    if (this.resource.value < cost) {
      Sound.play('denied');
      if (!this.noResourceCd || world.time > this.noResourceCd) {
        this.noResourceCd = world.time + 0.6;
        world.effects.text(this.hx, this.hy - 30, `NO ${this.resource.name}`, { color: this.resource.color, size: 7 });
      }
      return false;
    }
    this.resource.value -= cost;
    return true;
  }

  gainResource(amount) {
    if (this.resource) this.resource.value = Math.min(this.resource.max, this.resource.value + amount);
  }

  /** Called by the game whenever this hero's attacks deal damage. */
  gainUlt(damage) {
    const was = this.ultReady;
    this.ult = Math.min(this.ultMax, this.ult + damage);
    if (!was && this.ultReady) Sound.play('pickup');
  }

  onKill() {}

  primary() {}
  secondary() {}
  abilityE() {}
  abilityF() {}
  ultimate() {}
  updateAbility() {}
  drawGroundExtras() {}
  drawExtras() {}

  // ---------- dodge ----------

  startDodge(world) {
    if (this.cooldowns.dodge > 0 || this.busy > 0) return;
    const c = CONFIG.player.dodge;
    const moving = this.moveDir.x !== 0 || this.moveDir.y !== 0;
    const angle = moving ? Math.atan2(this.moveDir.y, this.moveDir.x) : this.aim;
    this.cooldowns.dodge = c.cooldown;
    this.dodge = { t: 0, angle, ghost: 0 };
    this.busy = c.duration;
    this.iframes = Math.max(this.iframes, c.invulnerability);
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
    Sound.play('dash');
    world.effects.burst(this.x, this.y, { count: 8, colors: ['#c8c0b0', '#8a8070'], speed: [30, 80], life: [0.2, 0.35] });
  }

  updateDodge(dt, world) {
    const d = this.dodge;
    if (!d) return;
    const c = CONFIG.player.dodge;
    d.t += dt;
    const speed = c.distance / c.duration;
    world.dungeon.move(this, Math.cos(d.angle) * speed * dt, Math.sin(d.angle) * speed * dt);
    d.ghost -= dt;
    if (d.ghost <= 0) {
      d.ghost = 0.04;
      this.afterimage(world, 0.2, 0.35);
    }
    if (d.t >= c.duration) this.dodge = null;
  }

  /** Fading copy of the current frame, for dashes. */
  afterimage(world, life, alpha) {
    const frame = this.currentFrame();
    const gx = this.x;
    const gy = this.y;
    const flip = this.facing < 0;
    world.effects.add(life, (ctx, t) => {
      drawSprite(ctx, frame.img, gx, gy, HERO_ANCHOR.x, HERO_ANCHOR.y, flip, alpha * (1 - t));
    });
  }

  // ---------- health ----------

  get isInvulnerable() { return this.invulnerable > 0 || this.iframes > 0; }

  /**
   * Classes override this to block or soak damage (shield, parry, aegis).
   * Returns the damage that still gets through.
   */
  absorb(amount) { return amount; }

  /** Grace period after absorb() soaks a whole hit. */
  get absorbGuardTime() { return CONFIG.player.guardTime; }

  /** Returns true if the attack connected (even if it was blocked). */
  hurt(amount, world, fromX, fromY) {
    if (this.dead || this.isInvulnerable) return false;
    if (this.guard > 0) return true;
    amount = this.absorb(amount, world, fromX, fromY);
    if (amount <= 0) {
      this.guard = this.absorbGuardTime;
      return true;
    }
    // practice god mode (after absorb, so parries and blocks can still be practised)
    if (world.practice && world.practice.options.god) return true;
    this.hp -= amount;
    this.sinceHurt = 0;
    this.invulnerable = CONFIG.player.hurtInvulnerability;
    this.flashTime = 0.12;
    world.effects.text(this.hx, this.hy - 24, `-${Math.round(amount)}`, { color: '#ff5050', size: 10 });
    world.effects.burst(this.hx, this.hy, { count: 10, colors: ['#ff4a4a', '#b81e2e'], speed: [60, 160] });
    world.shake(5, 0.2);
    Sound.play('playerHurt');
    if (fromX !== undefined) this.knockback(angleTo(fromX, fromY, this.x, this.y), 160);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#ff4a4a', '#ffffff', '#b81e2e'], speed: [80, 220], life: [0.5, 1] });
    }
    return true;
  }

  /** quiet heals are batched into one floating number per second. */
  heal(amount, world, quiet = false) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (gained <= 0) return;
    if (quiet) {
      this.healPopup += gained;
      return;
    }
    world.effects.text(this.hx, this.hy - 24, `+${Math.round(gained)}`, { color: '#6cff7a', size: 10 });
    world.effects.burst(this.hx, this.hy, { count: 10, colors: ['#6cff7a', '#c8ffd0'], speed: [20, 60], up: 40 });
  }

  /** True while passive regen is ticking. */
  get regenerating() {
    return this.sinceHurt >= CONFIG.player.regen.delay && this.hp < this.maxHp;
  }

  /** Slow passive heal once the hero has gone a while without losing hp. */
  updateRegen(dt, world) {
    this.sinceHurt += dt;
    if (!this.regenerating) return;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * CONFIG.player.regen.perSecond * dt);
    if (Math.random() < dt * 4) {
      world.effects.burst(this.x + rand(-8, 8), this.y - rand(4, 20), { count: 1, colors: ['#6cff7a', '#c8ffd0'], speed: [5, 15], life: [0.4, 0.7], up: 30 });
    }
  }

  updateHealPopup(dt, world) {
    this.healPopupTimer -= dt;
    if (this.healPopupTimer > 0 || this.healPopup < 1) return;
    this.healPopupTimer = 0.8;
    world.effects.text(this.hx, this.hy - 24, `+${Math.round(this.healPopup)}`, { color: '#6cff7a', size: 8 });
    this.healPopup = 0;
  }

  /** Damages every target inside a circle; returns the targets hit. */
  hitCircle(world, x, y, r, damage, opts = {}) {
    const hit = [];
    for (const t of world.getTargets()) {
      if (opts.exclude && opts.exclude.has(t)) continue;
      if (dist(x, y, t.hx, t.hy) > r + t.radius) continue;
      world.damageTarget(t, damage, { angle: angleTo(x, y, t.hx, t.hy), knockback: opts.knockback ?? 120, sound: opts.sound, fromUlt: opts.fromUlt });
      if (opts.stun) t.stun?.(opts.stun);
      hit.push(t);
    }
    return hit;
  }

  /** Damages every target along a line; returns the targets hit. */
  hitLine(world, x1, y1, angle, length, width, damage, opts = {}) {
    const x2 = x1 + Math.cos(angle) * length;
    const y2 = y1 + Math.sin(angle) * length;
    const hit = [];
    for (const t of world.getTargets()) {
      if (opts.exclude && opts.exclude.has(t)) continue;
      if (pointSegmentDistance(t.hx, t.hy, x1, y1, x2, y2) > width / 2 + t.radius) continue;
      world.damageTarget(t, damage, { angle, knockback: opts.knockback ?? 120, sound: opts.sound, fromUlt: opts.fromUlt });
      if (opts.exclude) opts.exclude.add(t);
      hit.push(t);
    }
    return hit;
  }

  // ---------- drawing ----------

  currentFrame() {
    if (this.moving) return this.frames.walk[Math.floor(this.animTime * 9) % 4];
    return this.frames.idle[Math.floor(this.animTime * 2.5) % 2];
  }

  weaponAngle() { return this.aim; }

  drawWeapon(ctx) {
    if (!this.weapon) return;
    const a = this.weaponAngle();
    const reach = this.weaponReach ?? 10;
    const wx = this.pivotX + Math.cos(this.aim) * reach;
    const wy = this.pivotY + 4 + Math.sin(this.aim) * reach * 0.7;
    drawRotated(ctx, this.weapon.img, wx, wy, this.weapon.pivotX, this.weapon.pivotY, a, Math.cos(this.aim) < 0);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 9, 13, 5);
    this.drawGroundExtras(ctx);
  }

  /** Overall sprite opacity (invisibility, vanish). */
  get bodyAlpha() { return 1; }

  draw(ctx) {
    if (this.dead) return;
    const blink = this.invulnerable > 0 && this.flashTime <= 0 && Math.floor(this.invulnerable * 14) % 2 === 0;
    const alpha = (blink ? 0.45 : 1) * this.bodyAlpha;
    if (alpha <= 0) return this.drawExtras(ctx);
    const weaponBehind = Math.sin(this.aim) < -0.35;
    ctx.globalAlpha = alpha;
    if (weaponBehind) this.drawWeapon(ctx);
    ctx.globalAlpha = 1;
    this.drawFrame(ctx, this.currentFrame(), HERO_ANCHOR, alpha);
    ctx.globalAlpha = alpha;
    if (!weaponBehind) this.drawWeapon(ctx);
    ctx.globalAlpha = 1;
    this.drawExtras(ctx);
  }
}

/** Factory used by the game to create the chosen hero. */
function createHero(classId, x, y) {
  const classes = { warrior: Warrior, ranger: Ranger, mage: Mage, rogue: Rogue };
  return new classes[classId](x, y);
}
