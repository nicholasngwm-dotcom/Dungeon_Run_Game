// Base hero: movement, aiming, dodge, health, resources, ult charge, drawing.
// Each class (Warrior = Knight, Ranger = Archer, ...) extends this and implements
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
    this.maxCooldowns = { primary: 1, secondary: 1, e: 1, f: 1, dodge: this.dodgeCooldown };
    this.icons = { primary: '', secondary: '', e: '', f: '', q: '' }; // HUD labels
    this.ult = 0;
    this.ultMax = this.cfg.ult.charge;
    this.healPopup = 0;           // batches small heals into one number
    this.healPopupTimer = 0;
    this.sinceHurt = 0;           // seconds since hp was last lost (drives passive regen)
    this.buffs = {};              // mimic buffs: type -> seconds left
    this.aegis = null;            // Priestess aegis: { hp, maxHp, t } soaks every kind of hit
    this.poisonTime = 0;          // enemy poison: loses poisonDps hp per second
    this.poisonDps = 0;
    this.poisonTick = 0;
    this.stunTime = 0;            // stunned by enemies: can't move or act
    // shop upgrades (multipliers start at 1)
    this.attackSpeed = 1;         // primary attack cooldowns recover this much faster
    this.abilityHaste = 1;        // RMB / E / F cooldowns recover this much faster
    this.upgradeDamage = 1;       // all damage dealt
    this.bonusRegen = 0;          // hp per second, always on (even while taking hits)
    // dungeon runs: each hero has their own purse and shop upgrades
    this.coins = 0;
    this.coinFlash = 0;
    this.upgradeLevels = {};
    // potions: 5 inventory slots ({ id, count } or null) and the effects running (family -> { t, v })
    this.inventory = [null, null, null, null, null];
    this.brews = {};
    const r = this.cfg.resource;
    this.resource = r ? { ...r, value: r.max } : null;
  }

  /**
   * Extra HUD ability slots: [{ after, key, name, cd, max, icon, armed }], each
   * placed after the slot named `after`. Classes override (the knight's bash).
   */
  get extraSlots() { return []; }

  /** Point the weapon rotates around (roughly the hands). */
  get pivotX() { return this.x; }
  get pivotY() { return this.y - 12; }

  /** Overridden by classes for spins, hastes, ult slowdowns... */
  get moveMultiplier() { return 1; }
  get speedMultiplier() {
    return (this.slowTime > 0 ? CONFIG.golem.slowAmount : 1) * (this.chillTime > 0 ? this.chillAmount : 1)
      * (this.buffs.speed > 0 ? CONFIG.buffs.speed.multiplier : 1) * this.moveMultiplier * (1 + this.brew('speed'));
  }

  /** The value of a running potion effect (0 when none). */
  brew(family) { return this.brews[family] ? this.brews[family].v : 0; }

  /** Crit chance: the base rate plus Focus potions. */
  get critChance() { return CONFIG.player.critChance + this.brew('focus'); }

  /** How much further this hero's hits knock enemies back (Bulldose potions). */
  get knockbackMultiplier() { return 1 + this.brew('bulldose'); }

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

  /** Enemies closer than this still see an invisible hero. */
  get detectRange() { return CONFIG.player.invisibleDetectRange; }

  get ultReady() { return this.ult >= this.ultMax; }

  update(dt, world) {
    this.animTime += dt;
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.iframes -= dt;
    this.guard -= dt;
    this.slowTime -= dt;
    this.chillTime = (this.chillTime || 0) - dt;
    this.updateBuffs(dt, world);
    this.updateBrews(dt, world);
    this.updatePoison(dt, world);
    this.stunTime -= dt;
    if (this.aegis) {
      this.aegis.t -= dt;
      this.aegis.flash -= dt;
      if (this.aegis.t <= 0) this.aegis = null;
    }
    for (let i = 0; i < this.inventory.length; i++) if (Input.pressed(`item${i + 1}`)) this.useItem(i, world);
    this.busy -= dt;
    this.contactGrace = this.ignoresContact ? 0.3 : (this.contactGrace || 0) - dt;
    for (const k of Object.keys(this.cooldowns)) {
      const rate = k === 'primary' ? this.attackSpeed * (1 + this.brew('rage')) : k === 'dodge' ? 1 : this.abilityHaste;
      this.cooldowns[k] -= dt * rate;
    }
    if (this.resource) {
      const regen = this.resource.regen * (1 + this.brew('manaRegen'));
      this.resource.value = Math.min(this.resource.max, this.resource.value + regen * dt);
    }
    this.updateRegen(dt, world);
    this.updateHealPopup(dt, world);

    const m = world.mouseWorld;
    this.aim = angleTo(this.pivotX, this.pivotY, m.x, m.y);
    if (this.busy <= 0) this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;

    // movement
    let mx = 0;
    let my = 0;
    if (Input.down('up')) my -= 1;
    if (Input.down('down')) my += 1;
    if (Input.down('left')) mx -= 1;
    if (Input.down('right')) mx += 1;
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
    if (Input.pressed('dodge')) this.startDodge(world);
    if (this.busy > 0 || this.channeling) return;
    if (Input.pressed('ult')) {
      if (this.ultReady) { this.ult = 0; this.ultimate(world); }
      else Sound.play('denied');
    }
    if (Input.pressed('e')) this.tryAbility('e', world, () => this.abilityE(world));
    if (Input.pressed('f')) this.tryAbility('f', world, () => this.abilityF(world));
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

  /** Called by the game after this hero's attack lands on a target (target.dead if it killed). */
  onDamageDealt() {}

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
    this.cooldowns.dodge = this.dodgeCooldown;
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
   * Classes override this to block or soak damage (shield, parry).
   * opts = the hurt() options, e.g. { projectile: true }.
   * Returns the damage that still gets through.
   */
  absorb(amount) { return amount; }

  // ---------- enemy status effects: poison and stun ----------

  /** Poisons for `duration`s (a new dose refreshes it; the stronger dps wins). Blocked hits don't poison. */
  poison(dps, duration, world) {
    if (this.dead || this.guard > 0 || this.iframes > 0 || this.brews.purity) return;
    if (!(this.poisonTime > 0)) world?.effects.text(this.hx, this.hy - 36, 'POISONED', { color: '#9cf06a', size: 7 });
    this.poisonDps = this.poisonTime > 0 ? Math.max(this.poisonDps, dps) : dps;
    this.poisonTime = Math.max(this.poisonTime, duration);
  }

  updatePoison(dt, world) {
    if (!(this.poisonTime > 0)) return;
    this.poisonTime -= dt;
    this.poisonTick -= dt;
    if (Math.random() < dt * 6) {
      world.effects.burst(this.x + rand(-8, 8), this.y - rand(4, 24), { count: 1, colors: ['#9cf06a', '#4a8a2a'], speed: [5, 15], life: [0.3, 0.5], up: 20 });
    }
    if (this.poisonTick > 0) return;
    this.poisonTick = 0.5;
    if (world.practice && world.practice.options.god) return;
    const dmg = this.poisonDps * 0.5;
    this.hp -= dmg;
    this.sinceHurt = 0;
    world.effects.text(this.hx, this.hy - 24, `-${Math.round(dmg)}`, { color: '#9cf06a', size: 8 });
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#9cf06a', '#ffffff', '#4a8a2a'], speed: [80, 220], life: [0.5, 1] });
    }
  }

  /** Can't move or act for `duration`s. Blocked hits don't stun. */
  stun(duration, world) {
    if (this.dead || this.guard > 0 || this.iframes > 0 || this.brews.purity) return;
    if (!(this.stunTime > 0)) world?.effects.text(this.hx, this.hy - 36, 'STUNNED', { color: '#ffe680', size: 7 });
    this.stunTime = Math.max(this.stunTime, duration);
    this.busy = Math.max(this.busy, duration);
  }

  /** Spinning stars over a stunned hero. */
  drawStatus(ctx) {
    if (!(this.stunTime > 0)) return;
    const y = this.y - 50;
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 6 + (i * TAU) / 3;
      const sx = Math.round(this.x + Math.cos(a) * 10);
      const sy = Math.round(y + Math.sin(a) * 3);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }
  }

  // ---------- aegis (cast by the Priestess) ----------

  /** Wraps the hero in a shield that soaks `hp` damage of any kind for `duration`s. */
  applyAegis(hp, duration, world) {
    this.aegis = { hp, maxHp: hp, t: duration, flash: 0 };
    world.effects.text(this.hx, this.hy - 36, 'AEGIS', { color: '#ffe680', size: 8 });
    world.effects.burst(this.hx, this.hy - 6, { count: 20, colors: ['#ffe680', '#fff6c8', '#ffffff'], speed: [40, 140], life: [0.3, 0.6] });
  }

  absorbAegis(amount, world) {
    const a = this.aegis;
    if (!a || amount <= 0) return amount;
    const soaked = Math.min(a.hp, amount);
    a.hp -= soaked;
    a.flash = 0.12;
    world.effects.burst(this.hx, this.hy - 6, { count: 8, colors: ['#ffe680', '#ffffff'], speed: [60, 160], life: [0.15, 0.3] });
    Sound.play('bounce');
    if (a.hp <= 0) {
      this.aegis = null;
      world.effects.text(this.hx, this.hy - 36, 'AEGIS BROKEN', { color: '#ffe680', size: 7 });
      world.effects.burst(this.hx, this.hy - 6, { count: 24, colors: ['#ffe680', '#fff6c8', '#ffffff'], speed: [80, 220], life: [0.3, 0.6] });
      Sound.play('partBreak');
    }
    return amount - soaked;
  }

  /** Golden bubble around the hero with a small hp bar. */
  drawAegis(ctx) {
    const a = this.aegis;
    if (!a) return;
    const fade = Math.min(1, a.t * 2);
    const flash = a.flash > 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.fillStyle = flash ? 'rgba(255, 250, 220, 0.35)' : 'rgba(255, 220, 110, 0.12)';
    ctx.strokeStyle = `rgba(255, 230, 128, ${0.6 + Math.sin(this.animTime * 10) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 16, 22, 28, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const w = 30;
    const bx = Math.round(this.x - w / 2);
    const by = Math.round(this.y - 50);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx - 1, by - 1, w + 2, 5);
    ctx.fillStyle = '#ffe680';
    ctx.fillRect(bx, by, Math.round(w * clamp(a.hp / a.maxHp, 0, 1)), 3);
  }

  /** Grace period after absorb() soaks a whole hit. */
  get absorbGuardTime() { return CONFIG.player.guardTime; }

  /**
   * Returns true if the attack connected (even if it was blocked).
   * opts.projectile marks ranged shots (arrows, fireballs, lasers) for shields.
   */
  hurt(amount, world, fromX, fromY, opts = {}) {
    if (this.dead || this.isInvulnerable) return false;
    if (this.guard > 0) return true;
    amount = this.absorbAegis(amount, world);
    amount = this.absorb(amount, world, fromX, fromY, opts);
    if (amount <= 0) {
      this.guard = this.absorbGuardTime;
      return true;
    }
    if (this.passiveBlock(world, fromX, fromY)) return true;
    // Ironskin: flat defence off every hit (always at least 1 gets through)
    if (this.brews.ironskin) amount = Math.max(1, amount - this.brew('ironskin'));
    // Thorns: part of the hit goes back at whoever dealt it
    if (this.brews.thorns) this.reflectDamage(amount * this.brew('thorns'), world, fromX, fromY, opts.projectile);
    this.onHitTaken(world);
    // practice god mode (after absorb, so parries and blocks can still be practised)
    if (world.practice && world.practice.options.god) {
      this.invulnerable = CONFIG.player.hurtInvulnerability; // so hit-counting passives tick at a normal rate
      return true;
    }
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

  // ---------- class passives ----------
  // Each class overrides what it needs. passiveInfo feeds the HUD widget:
  // { name, color, text, pips, maxPips, bar (0-1 or null), ready }.

  get passiveInfo() { return null; }

  /** Multiplies all damage this hero deals (Mana Surge, Killing Streak). */
  get damageMultiplier() { return 1; }

  /** Called when a hit gets past blocks and shields; return true to cancel it (Tanker). */
  passiveBlock() { return false; }

  /** Called when a hit gets past blocks and shields (and so would take hp). */
  onHitTaken() {}

  /** World-space passive indicator over the hero. */
  drawPassive() {}

  /** Shorter for the Archer (Agility). */
  get dodgeCooldown() { return this.cfg.passive?.dodgeCooldown ?? CONFIG.player.dodge.cooldown; }

  /** True while passive regen is ticking. */
  get regenerating() {
    return this.sinceHurt >= CONFIG.player.regen.delay && this.hp < this.maxHp;
  }

  /**
   * Passive heal once the hero has gone a while without losing hp, plus the
   * mimic regen buff, which heals even while taking damage.
   */
  updateRegen(dt, world) {
    this.sinceHurt += dt;
    let hps = (this.regenerating ? CONFIG.player.regen.hpPerSecond : 0) + this.bonusRegen;
    if (this.buffs.regen > 0) hps += this.maxHp * CONFIG.buffs.regen.perSecond;
    if (hps <= 0 || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + hps * dt);
    if (Math.random() < dt * (this.buffs.regen > 0 ? 12 : 1.5)) {
      world.effects.burst(this.x + rand(-8, 8), this.y - rand(4, 20), { count: 1, colors: ['#6cff7a', '#c8ffd0'], speed: [5, 15], life: [0.4, 0.7], up: 30 });
    }
  }

  // ---------- mimic buffs ----------

  /** Starts (or refreshes) a buff from CONFIG.buffs. */
  addBuff(type) {
    this.buffs[type] = CONFIG.buffs[type].duration;
  }

  updateBuffs(dt, world) {
    for (const k of Object.keys(this.buffs)) {
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) delete this.buffs[k];
    }
    if (this.buffs.speed > 0 && this.moving && Math.random() < 0.5) {
      world.effects.burst(this.x - this.moveDir.x * 10, this.y + rand(-4, 4), { count: 1, colors: ['#ffd34a', '#fff0a0'], speed: [5, 20], life: [0.2, 0.35] });
    }
    if (this.buffs.damage > 0 && Math.random() < 0.3) {
      world.effects.burst(this.x + rand(-10, 10), this.y - rand(0, 26), { count: 1, colors: ['#ff5a4a', '#ffb0a0'], speed: [10, 30], life: [0.3, 0.5], up: 40 });
    }
  }

  /** Damage multiplier from the POWER buff and Strength potions (applied on top of damageMultiplier). */
  get buffDamage() { return (this.buffs.damage > 0 ? CONFIG.buffs.damage.multiplier : 1) * (1 + this.brew('strength')); }

  // ---------- potions (inventory slots 1-5) ----------

  /** Drinks the potion in inventory slot i (keys 1-5). Nothing happens if it can't help right now. */
  useItem(i, world) {
    const slot = this.inventory[i];
    if (!slot || this.dead) return;
    const pot = POTIONS[slot.id];
    if (!pot || !this.drink(pot, world)) return Sound.play('denied');
    slot.count--;
    if (slot.count <= 0) this.inventory[i] = null;
  }

  /** Puts a potion in the bag: stacks with the same potion (up to 5), else the first free slot. */
  addItem(id) {
    const stack = this.inventory.find((s) => s && s.id === id && s.count < 5);
    if (stack) { stack.count++; return true; }
    const i = this.inventory.indexOf(null);
    if (i < 0) return false;
    this.inventory[i] = { id, count: 1 };
    return true;
  }

  /**
   * Moves the stack in bag slot `from` onto slot `to` (dragged with the mouse):
   * the same potion merges (up to 5, any extra stays behind), anything else swaps.
   */
  moveItem(from, to) {
    const inv = this.inventory;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !inv[from] || to < 0 || to >= inv.length) return;
    const a = inv[from];
    const b = inv[to];
    if (b && b.id === a.id) {
      const n = Math.min(a.count, 5 - b.count);
      b.count += n;
      a.count -= n;
      if (a.count <= 0) inv[from] = null;
    } else {
      inv[to] = a;
      inv[from] = b;
    }
  }

  /** Room in the bag for one more of this potion? */
  canCarry(id) { return this.inventory.some((s) => s === null || (s.id === id && s.count < 5)); }

  /** Applies a potion. Returns false (and keeps it) if it would be wasted. */
  drink(pot, world) {
    const say = (text, color) => world.effects.text(this.hx, this.hy - 34, text, { color, size: 7 });
    const [liquid, light] = POTION_COLORS[pot.family];
    switch (pot.family) {
      case 'heal':
        if (this.hp >= this.maxHp) { say('FULL HP', '#d8c8a0'); return false; }
        this.heal(pot.value, world);
        break;
      case 'mana': {
        const r = this.resource;
        if (!r) { say('NO MANA TO RESTORE', '#d8c8a0'); return false; }
        if (r.value >= r.max) { say(`FULL ${r.name}`, '#d8c8a0'); return false; }
        // light orbs come in ones: 20 -> 1, 50 -> 2, 100 -> 4
        const amount = r.name === 'LIGHT' ? Math.max(1, Math.round(pot.value / 25)) : pot.value;
        r.value = Math.min(r.max, r.value + amount);
        say(`+${amount} ${r.name}`, r.color);
        break;
      }
      case 'manaRegen':
        if (!this.resource) { say('NO MANA TO REGENERATE', '#d8c8a0'); return false; }
        this.addBrew(pot);
        break;
      case 'teleport': this.teleportPotion(pot, world); break;
      case 'purity':
        this.cleanse();
        this.addBrew(pot);
        say('PURIFIED', '#ffffff');
        break;
      case 'regen':
        // stacks add up (max 4), and the longer timer wins
        this.brews.regen = { t: Math.max(this.brews.regen?.t || 0, pot.duration), v: Math.min(4, (this.brews.regen?.v || 0) + pot.value), max: pot.duration };
        break;
      default:
        this.addBrew(pot);
    }
    if (pot.duration && pot.family !== 'purity') say(BREW_LABELS[pot.family] || pot.name.toUpperCase(), light);
    world.effects.burst(this.hx, this.hy - 10, { count: 14, colors: [liquid, light, '#ffffff'], speed: [20, 80], life: [0.3, 0.6], up: 40 });
    Sound.play('pickup');
    return true;
  }

  /** Starts a timed potion effect, keeping the stronger value and the longer time if one is running. */
  addBrew(pot) {
    const cur = this.brews[pot.family];
    this.brews[pot.family] = {
      v: Math.max(cur ? cur.v : 0, pot.value),
      t: Math.max(cur ? cur.t : 0, pot.duration),
      max: Math.max(cur ? cur.max : 0, pot.duration),
      tick: 0,
    };
  }

  /** Clears poison, slows, chills and stuns. */
  cleanse() {
    this.poisonTime = 0;
    this.slowTime = 0;
    this.chillTime = 0;
    if (this.stunTime > 0) { this.busy = Math.min(this.busy, 0); this.stunTime = 0; }
  }

  /** Teleportation potion: a random clear spot in the current room, then a moment of invulnerability. */
  teleportPotion(pot, world) {
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#9a4ae0', '#e0b8ff', '#ffffff'], speed: [40, 160], life: [0.3, 0.6], up: 30 });
    const run = world.run;
    const room = run && run.floor.roomAt(this.x, this.y);
    let pt = null;
    for (let i = 0; i < 20 && !pt; i++) {
      const c = room ? run.floor.randomPointIn(room, 1) : { x: this.x + rand(-200, 200), y: this.y + rand(-140, 140) };
      if (!world.dungeon.isSolidAt || !world.dungeon.isSolidAt(c.x, c.y)) pt = c;
    }
    if (pt) { this.x = pt.x; this.y = pt.y; }
    this.iframes = Math.max(this.iframes, pot.value);
    world.clones = world.clones.filter((c) => c.owner !== this);
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#9a4ae0', '#e0b8ff', '#ffffff'], speed: [40, 160], life: [0.3, 0.6], up: 30 });
    if (this === world.localPlayer) world.camera.follow(this.x, this.y - 16, 0, world.dungeon.width, world.dungeon.height, true);
    Sound.play('phantomAppear');
  }

  /** Thorns: send damage back at the attacker (the nearest enemy to where the hit came from). */
  reflectDamage(amount, world, fromX, fromY, projectile) {
    if (amount < 1) return;
    const ox = projectile || fromX === undefined ? this.x : fromX;
    const oy = projectile || fromY === undefined ? this.y : fromY;
    const reach = projectile ? 420 : 70;
    let best = null;
    let bestD = reach;
    for (const t of world.getTargets()) {
      const d = dist(ox, oy, t.x, t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return;
    world.damageTarget(best, amount, { source: this, noCrit: true, sound: null, color: '#b8e07a', fromUlt: true });
    world.effects.burst(best.hx, best.hy, { count: 6, colors: ['#4a8a2a', '#b8e07a'], speed: [40, 120], life: [0.2, 0.4] });
  }

  /** Ticks potion effects: regen heals, the inferno ring burns, purity keeps cleansing. */
  updateBrews(dt, world) {
    for (const k of Object.keys(this.brews)) {
      const b = this.brews[k];
      b.t -= dt;
      if (b.t <= 0) delete this.brews[k];
    }
    const regen = this.brews.regen;
    if (regen) this.heal(this.maxHp * 0.02 * regen.v * dt, world, true);
    if (this.brews.purity) this.cleanse();
    const fire = this.brews.inferno;
    if (fire) {
      fire.tick -= dt;
      if (fire.tick <= 0) {
        fire.tick = 0.5;
        for (const t of world.getTargets()) {
          if (dist(this.x, this.y - 10, t.hx, t.hy) > 90 + t.radius) continue;
          world.damageTarget(t, fire.v * 0.5, { source: this, sound: null, color: '#ff8a2a', fromUlt: true, noCrit: true });
          if (!t.dead) world.addDot(t, 8, 3, '#ff8a2a');
        }
      }
    }
  }

  /** Inferno potion: flames circling the hero. */
  drawBrews(ctx) {
    const fire = this.brews.inferno;
    if (!fire) return;
    const fade = Math.min(1, fire.t * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    ctx.strokeStyle = 'rgba(255, 120, 40, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y - 4, 90, 50, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = this.animTime * 2.5 + (i / 10) * TAU;
      const fx = Math.round(this.x + Math.cos(a) * 90);
      const fy = Math.round(this.y - 4 + Math.sin(a) * 50);
      const h = 7 + Math.round(Math.sin(this.animTime * 14 + i) * 2);
      ctx.fillStyle = '#ff6a1e';
      ctx.fillRect(fx - 3, fy - h, 6, h);
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(fx - 1, fy - h + 2, 3, h - 3);
    }
    ctx.restore();
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
    this.drawBrews(ctx);
    this.drawPassive(ctx);
    this.drawAegis(ctx);
    this.drawStatus(ctx);
  }
}

/** Factory used by the game to create the chosen hero. */
function createHero(classId, x, y) {
  const classes = { warrior: Warrior, ranger: Ranger, mage: Mage, rogue: Rogue, priestess: Priestess };
  return new classes[classId](x, y);
}
