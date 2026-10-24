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
    this.buffMax = {};            // ...and how long each one lasted when it started
    this.aegis = null;            // Priestess aegis: { hp, maxHp, t } soaks every kind of hit
    this.poisonTime = 0;          // enemy poison: loses poisonDps hp per second
    this.poisonDps = 0;
    this.poisonTick = 0;
    this.stunTime = 0;            // stunned by enemies: can't move or act
    // Bard support: seconds left of the Energetic tune's speed boost (and how big it is), and of Moral Support
    this.tuneSpeed = 0;
    this.tuneSpeedAmount = 0;
    this.inspired = 0;
    // shop upgrades (multipliers start at 1)
    this.attackSpeed = 1;         // primary attack cooldowns recover this much faster
    this.abilityHaste = 1;        // RMB / E / F cooldowns recover this much faster
    this.upgradeDamage = 1;       // all damage dealt
    this.bonusRegen = 0;          // hp per second, always on (even while taking hits)
    // gem enhancements from the player's profile (see applyEnhancements)
    this.enhancements = 0;        // how many this hero has
    this.bonusCrit = 0;           // added to crit chance
    this.dodgeCut = 0;            // seconds off the dodge's cooldown
    // dungeon runs: each hero has their own purse and shop upgrades
    this.coins = 0;
    this.coinFlash = 0;
    this.upgradeLevels = {};
    // potions: 5 inventory slots ({ id, count } or null) and the effects running (family -> { t, v })
    this.inventory = [null, null, null, null, null];
    this.brews = {};
    this.cursor = { x, y };       // where this hero's player is pointing (each hero has their own in multiplayer)
    // downed (multiplayer): how far a teammate has got picking this hero up, in seconds
    this.reviveProgress = 0;
    this.revivedBy = null;        // the teammate holding interact by the body this tick
    const r = this.cfg.resource;
    this.resource = r ? { ...r, value: r.max } : null;
  }

  /**
   * Extra HUD ability slots: [{ after, key, name, cd, max, icon, armed }], each
   * placed after the slot named `after`. Classes override (the knight's bash).
   */
  get extraSlots() { return []; }

  /** True while the ability in a HUD slot is being held (its slot glows). Classes override. */
  slotHeld() { return false; }

  /** Point the weapon rotates around (roughly the hands). */
  get pivotX() { return this.x; }
  get pivotY() { return this.y - 12; }

  /** Overridden by classes for spins, hastes, ult slowdowns... */
  get moveMultiplier() { return 1; }
  get speedMultiplier() {
    return (this.slowTime > 0 ? CONFIG.golem.slowAmount : 1) * (this.chillTime > 0 ? this.chillAmount : 1)
      * (this.buffs.speed > 0 ? CONFIG.buffs.speed.multiplier : 1) * this.moveMultiplier * (1 + this.brew('speed'))
      * (this.tuneSpeed > 0 ? 1 + this.tuneSpeedAmount : 1) * this.sugarScale('speed') * Upgrades.speedScale(this);
  }

  /** The sugar rush's boost to `stat` (speed or attackSpeed): stacked sugar rushes (Premium Baking Goods) add up. */
  sugarScale(stat) {
    return this.buffs.sugar > 0 ? 1 + (CONFIG.buffs.sugar[stat] - 1) * (this.sugarStacks || 1) : 1;
  }

  /** The value of a running potion effect (0 when none). */
  brew(family) { return this.brews[family] ? this.brews[family].v : 0; }

  /**
   * Crit chance: the hero's base rate (CONFIG.classes[id].crit, or the shared one) plus their
   * enhancement and Focus potions (doubled standing still with Deadly Precision).
   */
  get critChance() { return ((this.cfg.crit?.chance ?? CONFIG.player.critChance) + this.bonusCrit + this.brew('focus')) * Upgrades.critScale(this); }

  /** Crit damage: this hero's own (CONFIG.classes[id].crit), or the shared one (doubled standing still with Deadly Precision). */
  get critMultiplier() { return (this.cfg.crit?.multiplier ?? CONFIG.player.critMultiplier) * Upgrades.critScale(this); }

  /** How much further this hero's hits knock enemies back (Bulldose potions). */
  get knockbackMultiplier() { return 1 + this.brew('bulldose'); }

  /** Ghost auras: slowed to `amount` speed while inside one (refreshed every frame). */
  chill(amount, time = 0.2) {
    if (Upgrades.blocksChill(this, this.lastWorld)) return;
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
    this.lastWorld = world;   // for hooks called without the world (chill)
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.iframes -= dt;
    this.guard -= dt;
    this.slowTime -= dt;
    this.chillTime = (this.chillTime || 0) - dt;
    this.updateBuffs(dt, world);
    this.updateBrews(dt, world);
    this.updatePoison(dt, world);
    this.updateAilments(dt, world);
    this.stunTime -= dt;
    if (this.frozenTime > 0) {
      this.frozenTime -= dt;
      if (this.frozenTime <= 0 || this.stunTime <= 0) {
        // the ice shatters off them
        this.frozenTime = 0;
        world.effects.shards(this.x, this.y - 16, { count: 14, speed: [80, 200], life: 0.45, len: [6, 12], width: 5 });
        Sound.play('glass', 0.05);
      }
    }
    this.tuneSpeed -= dt;
    this.inspired -= dt;
    if (this.aegis) {
      this.aegis.t -= dt;
      this.aegis.flash -= dt;
      if (this.aegis.t <= 0) this.aegis = null;
    }
    if (this.songShield) {
      this.songShield.t -= dt;
      this.songShield.flash -= dt;
      if (this.songShield.t <= 0) this.songShield = null;
    }
    for (let i = 0; i < this.inventory.length; i++) if (Input.pressed(`item${i + 1}`)) this.useItem(i, world);
    this.busy -= dt;
    this.resourceShort = (this.resourceShort || 0) - dt;
    this.contactGrace = this.ignoresContact ? 0.3 : (this.contactGrace || 0) - dt;
    for (const k of Object.keys(this.cooldowns)) {
      const rate = k === 'primary' ? this.attackSpeed * (1 + this.brew('rage')) * (this.inspired > 0 ? 1 + CONFIG.classes.bard.morale.attackSpeed : 1)
        * this.sugarScale('attackSpeed')
        : k === 'dodge' ? 1 : this.abilityHaste;
      this.cooldowns[k] -= dt * rate;
    }
    Upgrades.update(this, dt, world);
    if (this.resource) {
      const regen = this.resource.regen * (1 + this.brew('manaRegen'));
      this.resource.value = Math.min(this.resource.max, this.resource.value + regen * dt);
    }
    this.updateRegen(dt, world);
    this.updateHealPopup(dt, world);

    const m = world.mouseWorld;
    this.cursor = { x: m.x, y: m.y };   // kept for drawing aim previews (world.mouseWorld is only this hero's while it updates)
    this.aim = angleTo(this.pivotX, this.pivotY, m.x, m.y);
    if (this.busy <= 0) this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;

    // sitting on a lobby seat: no moving or fighting until the lobby stands them up
    if (this.seat) {
      this.moving = false;
      this.facing = this.seat.facing;
      return;
    }

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
    if (this.busy > 0 || this.channeling) { this.aimHold = null; return; }
    this.updateAbilityKeys(world);
    if (this.busy > 0 || this.channeling) return;
    this.handleMouse(world);
  }

  /**
   * E, F and Q: holding the key shows where the ability will land (abilityPreview)
   * and letting go casts it; a quick tap casts straight away. A key that can't be
   * used right now is refused on the press, as before.
   */
  updateAbilityKeys(world) {
    const h = this.aimHold;
    if (h) {
      if (Input.down(h.key)) return;   // still aiming
      this.aimHold = null;
      this.castSlot(h.slot, world);
      return;
    }
    for (const [key, slot] of [['ult', 'q'], ['e', 'e'], ['f', 'f']]) {
      if (!Input.pressed(key)) continue;
      if (slot === 'q' ? !this.ultReady : this.cooldowns[slot] > 0) {
        if (slot === 'q') Sound.play('denied');
        else this.tryAbility(slot, world, () => {});   // the class's own refusal (sound, or nothing)
        return;
      }
      // not enough mana / energy / light: refused outright, no aiming outline
      if (!this.canAfford(slot)) { this.spend(this.abilityCost(slot), world); return; }
      if (Input.down(key) && this.abilityPreview(slot)) this.aimHold = { slot, key };
      else this.castSlot(slot, world);
      return;
    }
  }

  castSlot(slot, world) {
    if (slot === 'q') {
      if (this.ultReady) { this.ult = 0; this.ultimate(world); }
      else Sound.play('denied');
    } else if (slot === 'e') this.tryAbility('e', world, () => this.abilityE(world));
    else this.tryAbility('f', world, () => this.abilityF(world));
  }

  /**
   * Where an ability will land, for the outline shown while its key is held:
   * { circle: { x, y, r, sy } } | { lane: { x, y, angle, length, width } } |
   * { cone: { x, y, angle, arc, range } } | { self: true }. null = no outline
   * (the key then casts on press, as it always did).
   */
  abilityPreview() { return null; }

  /** The held ability's outline on the floor (this screen's hero only). */
  drawAbilityPreview(ctx) {
    const shape = this.aimHold && this.abilityPreview(this.aimHold.slot);
    if (!shape) return;
    const rgb = '255, 236, 170';
    const spin = this.animTime * 0.8;
    const pulse = 0.7 + Math.sin(this.animTime * 8) * 0.15;
    if (shape.circle) {
      const c = shape.circle;
      PFX.zone(ctx, c.x, c.y, c.r, 0, rgb, { sy: c.sy || 1, spin, alpha: pulse });
    } else if (shape.lane) {
      const l = shape.lane;
      PFX.lane(ctx, l.x, l.y, l.x + Math.cos(l.angle) * l.length, l.y + Math.sin(l.angle) * l.length, l.width, 0, rgb);
    } else if (shape.cone) {
      const c = shape.cone;
      const a0 = c.angle - c.arc / 2;
      const a1 = c.angle + c.arc / 2;
      for (const r of [c.range * 0.5, c.range]) PFX.ring(ctx, c.x, c.y, r, r, `rgba(${rgb}, ${r === c.range ? pulse : 0.35})`, 2, { from: a0, to: a1, dash: r === c.range ? null : [3, 3] });
      for (const a of [a0, a1]) PFX.line(ctx, c.x, c.y, c.x + Math.cos(a) * c.range, c.y + Math.sin(a) * c.range, `rgba(${rgb}, ${pulse})`, 2, [3, 2], -this.animTime * 10);
    } else if (shape.self) {
      PFX.ring(ctx, this.x, this.y + 4, 26, 12, `rgba(${rgb}, ${pulse})`, 2, { dash: [3, 2], spin: spin * 3 });
    }
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

  /**
   * Mana / energy / light the ability in a HUD slot would take right now (0 if
   * none, or when pressing it would only cancel or end something). Classes override.
   */
  abilityCost() { return 0; }

  /** True if this hero has enough of their resource for the ability in `slot`. */
  canAfford(slot) {
    const cost = this.abilityCost(slot);
    return !this.resource || cost <= 0 || this.resource.value >= cost;
  }

  /** Spends mana/energy; shows a red warning (and the HUD flashes) and returns false if short. */
  spend(cost, world) {
    if (!this.resource || cost <= 0) return true;
    if (this.resource.value < cost) {
      Sound.play('denied');
      this.resourceShort = 0.8;   // the HUD's resource bar flashes red for this long
      if (!this.noResourceCd || world.time > this.noResourceCd) {
        this.noResourceCd = world.time + 0.6;
        const name = this.resource.name;
        world.effects.text(this.hx, this.hy - 34, this.resource.value < 1 ? `OUT OF ${name}!` : `NOT ENOUGH ${name}!`, { color: '#ff3a3a', size: 9, life: 0.9 });
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
    this.cooldowns.dodge = Upgrades.dodgeCooldown(this);
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

  /** True if this hero is holding off a ground shockwave coming from (x, y) (the Knight's shield). */
  blocksShockwave() { return false; }

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
    if (world.cheats?.god) return;
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

  /** Set alight (flaming catapults): burnDps hp per second for `duration`s. Blocked hits don't burn. */
  burn(dps, duration, world) { if (!Upgrades.blocksBurn(this, world)) this.ailment('burn', dps, duration, world, 'BURNING', '#ff8a3a'); }

  /** Cut open (the jester's daggers): bleeds dps hp per second for `duration`s. */
  bleed(dps, duration, world) { this.ailment('bleed', dps, duration, world, 'BLEEDING', '#ff5a6a'); }

  /** Burns and bleeding work like poison: a new dose refreshes it and the stronger dps wins. */
  ailment(kind, dps, duration, world, label, color) {
    if (this.dead || this.guard > 0 || this.iframes > 0 || this.brews.purity) return;
    this.ailments ??= {};
    const a = this.ailments[kind];
    if (!a) world?.effects.text(this.hx, this.hy - 36, label, { color, size: 7 });
    this.ailments[kind] = { dps: a ? Math.max(a.dps, dps) : dps, t: Math.max(a ? a.t : 0, duration), tick: a ? a.tick : 0.5, color };
  }

  updateAilments(dt, world) {
    if (!this.ailments) return;
    for (const [kind, a] of Object.entries(this.ailments)) {
      a.t -= dt;
      a.tick -= dt;
      if (kind === 'burn' && Math.random() < dt * 14) {
        world.effects.flames(this.x + rand(-7, 7), this.y - rand(2, 14), { count: 1, height: rand(12, 20), width: rand(6, 9), life: rand(0.25, 0.4), colors: ENEMY_FIRE_COLORS });
      } else if (kind === 'bleed' && Math.random() < dt * 7) {
        world.effects.burst(this.x + rand(-6, 6), this.y - rand(8, 22), { count: 1, colors: ['#c43a44', '#6a1622'], speed: [0, 10], life: [0.3, 0.5], gravity: 300, drag: 0, size: [2, 2] });
      }
      if (a.t <= 0) { delete this.ailments[kind]; continue; }
      if (a.tick > 0) continue;
      a.tick = 0.5;
      if (world.cheats?.god) continue;
      const dmg = a.dps * 0.5;
      this.hp -= dmg;
      this.sinceHurt = 0;
      world.effects.text(this.hx, this.hy - 24, `-${Math.round(dmg)}`, { color: a.color, size: 8 });
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        world.effects.burst(this.hx, this.hy, { count: 30, colors: [a.color, '#ffffff', '#6a1622'], speed: [80, 220], life: [0.5, 1] });
        return;
      }
    }
  }

  /** Can't move or act for `duration`s. Blocked hits don't stun. */
  stun(duration, world) {
    if (this.dead || this.guard > 0 || this.iframes > 0 || this.brews.purity) return;
    if (!(this.stunTime > 0)) world?.effects.text(this.hx, this.hy - 36, 'STUNNED', { color: '#ffe680', size: 7 });
    this.stunTime = Math.max(this.stunTime, duration);
    this.busy = Math.max(this.busy, duration);
  }

  /**
   * Frozen solid (a frost barrel, its ice): can't move or act for `duration`s, locked in a
   * block of ice. Returns false if it didn't take (dodging, guarded, Heart of Frost...).
   */
  freeze(duration, world) {
    if (this.dead || this.guard > 0 || this.iframes > 0 || this.brews.purity) return false;
    if (Upgrades.blocksChill(this, world)) return false;
    world?.effects.text(this.hx, this.hy - 36, 'FROZEN', { color: '#9ad0ff', size: 8 });
    this.stunTime = Math.max(this.stunTime, duration);
    this.busy = Math.max(this.busy, duration);
    this.frozenTime = Math.max(this.frozenTime || 0, duration);
    this.dodge = null;
    this.kbx = this.kby = 0;
    Sound.play('iceBurst', 0.1);
    return true;
  }

  /** A frozen hero: a jagged block of ice round them, lit facets, frost at their feet; it cracks as it thaws. */
  drawIceBlock(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const k = clamp(this.frozenTime / 0.4, 0, 1);   // fading the last moment before it shatters
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.25 * k;
    const top = y - 40;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 3); ctx.lineTo(x - 16, top + 10); ctx.lineTo(x - 8, top); ctx.lineTo(x - 1, top + 6);
    ctx.lineTo(x + 7, top - 2); ctx.lineTo(x + 16, top + 9); ctx.lineTo(x + 15, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9ad0ff';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 2); ctx.lineTo(x - 15, top + 11); ctx.lineTo(x - 8, top + 2); ctx.lineTo(x - 1, top + 8);
    ctx.lineTo(x + 7, top); ctx.lineTo(x + 15, top + 10); ctx.lineTo(x + 14, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7 * k + 0.2;
    ctx.fillStyle = '#e6f6ff';   // lit facet, top left
    ctx.fillRect(x - 13, top + 12, 3, 22);
    ctx.fillRect(x - 9, top + 5, 2, 8);
    ctx.fillStyle = '#5a9ad0';   // shaded side
    ctx.fillRect(x + 10, top + 12, 3, 26);
    // a glint sweeping across
    const gx = x - 12 + ((this.animTime * 30) % 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(gx), top + 14, 2, 2);
    ctx.fillRect(Math.round(gx) + 1, top + 18, 1, 3);
    ctx.restore();
    // frost on the floor round the block
    ctx.save();
    ctx.globalAlpha = 0.6;
    PFX.disc(ctx, x, y + 2, 18, 6, '#e6f6ff');
    ctx.restore();
  }

  /** Spinning stars over a stunned hero (a block of ice if frozen). */
  drawStatus(ctx) {
    if (this.frozenTime > 0) return this.drawIceBlock(ctx);
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

  /**
   * War Song shield (the Bard's): a warm amber shimmer round the hero with music notes
   * circling it, and a small hp bar (under the aegis's, if they have both).
   */
  drawSongShield(ctx) {
    const s = this.songShield;
    if (!s) return;
    const fade = Math.min(1, s.t * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    PFX.disc(ctx, this.x, this.y - 16, 19, 25, s.flash > 0 ? 'rgba(255, 220, 180, 0.35)' : 'rgba(255, 150, 90, 0.1)', 2);
    PFX.ring(ctx, this.x, this.y - 16, 19, 25, `rgba(255, 170, 100, ${0.55 + Math.sin(this.animTime * 8) * 0.2})`, 2, { dash: [4, 3], spin: this.animTime * 1.5 });
    ctx.restore();
    // two little notes riding round the shield
    ctx.globalAlpha = fade;
    for (let i = 0; i < 2; i++) {
      const a = this.animTime * 2 + i * Math.PI;
      const nx = Math.round(this.x + Math.cos(a) * 20);
      const ny = Math.round(this.y - 16 + Math.sin(a) * 25);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(nx - 2, ny - 1, 4, 4);
      ctx.fillRect(nx + 1, ny - 6, 2, 6);
      ctx.fillStyle = '#ffb07a';
      ctx.fillRect(nx - 1, ny, 2, 2);
      ctx.fillRect(nx + 1, ny - 5, 1, 5);
      ctx.fillRect(nx + 2, ny - 5, 1, 1);
    }
    ctx.globalAlpha = 1;
    const w = 30;
    const bx = Math.round(this.x - w / 2);
    const by = Math.round(this.y - (this.aegis ? 45 : 50));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx - 1, by - 1, w + 2, 5);
    ctx.fillStyle = '#ff9a5a';
    ctx.fillRect(bx, by, Math.round(w * clamp(s.hp / s.maxHp, 0, 1)), 3);
  }

  /** Golden bubble around the hero with a small hp bar. */
  drawAegis(ctx) {
    const a = this.aegis;
    if (!a) return;
    const fade = Math.min(1, a.t * 2);
    const flash = a.flash > 0;
    // pixel bubble of light: faint fill, gold rim, a glint turning round it
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fade;
    PFX.disc(ctx, this.x, this.y - 16, 22, 28, flash ? 'rgba(255, 250, 220, 0.35)' : 'rgba(255, 220, 110, 0.12)', 2);
    PFX.ring(ctx, this.x, this.y - 16, 22, 28, `rgba(255, 230, 128, ${0.6 + Math.sin(this.animTime * 10) * 0.2})`, 2);
    const ga = this.animTime * 2.5;
    PFX.star(ctx, this.x + Math.cos(ga) * 22, this.y - 16 + Math.sin(ga) * 28, 2, '#fbe796', '#ffffff');
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
    this.lastBlocked = true;            // set false below once the hit really lands
    amount *= world.weakenScale ?? 1;   // hits from a Bard-weakened enemy
    if (this.guard > 0) return true;
    // shop upgrades: trap immunity, less contact damage, the static shield, the last defence
    amount = Upgrades.incoming(this, amount, world, fromX, fromY, opts);
    if (amount < 0) { this.lastBlocked = false; return false; }
    if (amount <= 0) return true;
    amount = this.absorbAegis(amount, world);
    amount = Upgrades.absorbSongShield(this, amount, world);   // the Bard's War Song
    amount = this.absorb(amount, world, fromX, fromY, opts);
    if (amount <= 0) {
      this.guard = this.absorbGuardTime;
      return true;
    }
    if (this.passiveBlock(world, fromX, fromY)) return true;
    this.lastBlocked = false;
    // Ironskin: flat defence off every hit (always at least 1 gets through)
    if (this.brews.ironskin) amount = Math.max(1, amount - this.brew('ironskin'));
    // Thorns: part of the hit goes back at whoever dealt it
    if (this.brews.thorns) this.reflectDamage(amount * this.brew('thorns'), world, fromX, fromY, opts.projectile);
    this.onHitTaken(world);
    // practice god mode (after absorb, so parries and blocks can still be practised)
    if (world.cheats?.god) {
      this.invulnerable = CONFIG.player.hurtInvulnerability; // so hit-counting passives tick at a normal rate
      return true;
    }
    this.hp -= amount;
    this.sinceHurt = 0;
    this.invulnerable = CONFIG.player.hurtInvulnerability;
    Game.statsOf(this).taken += amount;
    this.flashTime = 0.12;
    world.effects.text(this.hx, this.hy - 24, `-${Math.round(amount)}`, { color: '#ff5050', size: 10 });
    world.effects.burst(this.hx, this.hy, { count: 10, colors: ['#ff4a4a', '#b81e2e'], speed: [60, 160] });
    if (this === world.localPlayer) world.shake(5, 0.2);
    Sound.play('playerHurt');
    if (fromX !== undefined) this.knockback(angleTo(fromX, fromY, this.x, this.y), 160);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      world.effects.burst(this.hx, this.hy, { count: 30, colors: ['#ff4a4a', '#ffffff', '#b81e2e'], speed: [80, 220], life: [0.5, 1] });
    }
    return true;
  }

  // ---------- downed and revived (multiplayer) ----------

  /** Back on their feet after being downed: hpRatio of max hp, a moment of safety, ailments cleared. */
  revive(hpRatio, world = null) {
    this.dead = false;
    this.hp = Math.max(1, Math.round(this.maxHp * hpRatio));
    this.invulnerable = 1.5;
    this.sinceHurt = 0;
    this.reviveProgress = 0;
    this.revivedBy = null;
    this.poisonTime = 0;
    this.ailments = {};
    this.slowTime = 0;
    this.chillTime = 0;
    this.stunTime = 0;
    this.busy = 0;
    this.dodge = null;
    this.kbx = this.kby = 0;
    if (!world) return;
    world.effects.text(this.hx, this.hy - 36, 'REVIVED', { color: '#8cff9a', size: 9 });
    world.effects.burst(this.hx, this.hy - 6, { count: 30, colors: ['#8cff9a', '#fff6c8', '#ffffff'], speed: [40, 160], life: [0.4, 0.8], up: 60 });
    Sound.play('pickup');
  }

  /**
   * A downed hero lies on the floor, greyed out, with a ring that fills while a
   * teammate holds interact by them (and a soft pulse to say they can be helped).
   */
  drawDowned(ctx, time) {
    const frame = this.frames.idle[0].img;
    const t = time;   // the body doesn't update, so it animates on the game clock
    const p = this.reviveProgress / CONFIG.multiplayer.revive.time;
    drawShadow(ctx, this.x, this.y + 4, 20, 6);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.filter = 'grayscale(0.75) brightness(0.75)';
    // on their side: the sprite turned a quarter, head away from where they faced
    drawRotated(ctx, frame, this.x, this.y - 6, HERO_ANCHOR.x, 34, -this.facing * Math.PI / 2);
    ctx.restore();
    const ry = this.y - 4;
    PFX.ring(ctx, this.x, ry, 26, 12, `rgba(140, 255, 154, ${0.25 + Math.sin(t * 4) * 0.12})`, 2, { dash: [3, 3], spin: t * 0.8 });
    if (p > 0) PFX.ring(ctx, this.x, ry, 26, 12, '#8cff9a', 2, { from: -Math.PI / 2, to: -Math.PI / 2 + TAU * p, thick: 2 });
    // a cross over the body, bobbing
    const cy = Math.round(this.y - 34 + Math.sin(t * 3) * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(this.x - 2, cy - 6, 5, 13);
    ctx.fillRect(this.x - 5, cy - 3, 11, 5);
    ctx.fillStyle = p > 0 ? '#8cff9a' : '#d8c8a0';
    ctx.fillRect(this.x - 1, cy - 5, 3, 11);
    ctx.fillRect(this.x - 4, cy - 2, 9, 3);
  }

  /** quiet heals are batched into one floating number per second. */
  heal(amount, world, quiet = false) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (gained <= 0) return;
    // scoreboard: healing belongs to the hero whose turn it is (a priestess's spell), or to the healed hero
    if (world) {
      const healer = world.players?.includes(world.actor) ? world.actor : this;
      Game.statsOf(healer).healing += gained;
    }
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
  get dodgeCooldown() { return Math.max(0.3, (this.cfg.passive?.dodgeCooldown ?? CONFIG.player.dodge.cooldown) - (this.dodgeCut || 0)); }

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

  /** Starts (or refreshes) a buff from CONFIG.buffs; a longer one already running is kept. */
  addBuff(type, duration = CONFIG.buffs[type].duration) {
    if ((this.buffs[type] || 0) >= duration) return;
    this.buffs[type] = duration;
    this.buffMax[type] = duration;   // for the HUD's draining bar
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
    // sugar rush: pink and white sprinkles fizzing off them
    if (this.buffs.sugar > 0 && vrand(0, 1) < 0.45) {
      world.effects.burst(this.x + vrand(-10, 10), this.y - vrand(0, 28), { count: 1, colors: ['#ff8ad0', '#ffffff', '#8ad8ff', '#ffe680'], speed: [10, 40], life: [0.3, 0.5], up: 30, size: [1, 2] });
    }
  }

  /** Damage multiplier from the POWER buff and Strength potions (applied on top of damageMultiplier). */
  get buffDamage() {
    return (this.buffs.damage > 0 ? CONFIG.buffs.damage.multiplier : 1) * (1 + this.brew('strength'))
      * (this.inspired > 0 ? 1 + CONFIG.classes.bard.morale.damage : 1);
  }

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

  /** Puts a potion in the bag: stacks with the same potion (up to BAG_STACK), else the first free slot. */
  addItem(id) {
    const stack = this.inventory.find((s) => s && s.id === id && s.count < BAG_STACK);
    if (stack) { stack.count++; return true; }
    const i = this.inventory.indexOf(null);
    if (i < 0) return false;
    this.inventory[i] = { id, count: 1 };
    return true;
  }

  /**
   * Moves the stack in bag slot `from` onto slot `to` (dragged with the mouse):
   * the same potion merges (up to BAG_STACK, any extra stays behind), anything else swaps.
   */
  moveItem(from, to) {
    const inv = this.inventory;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !inv[from] || to < 0 || to >= inv.length) return;
    const a = inv[from];
    const b = inv[to];
    if (b && b.id === a.id) {
      const n = Math.min(a.count, BAG_STACK - b.count);
      b.count += n;
      a.count -= n;
      if (a.count <= 0) inv[from] = null;
    } else {
      inv[to] = a;
      inv[from] = b;
    }
  }

  /** Drops the whole stack in bag slot i at the hero's feet (to make space, or for a teammate). */
  dropItem(i, world) {
    const slot = Number.isInteger(i) ? this.inventory[i] : null;
    if (!slot || this.dead) return;
    this.inventory[i] = null;
    const pt = world.dungeon.freePoint(this.x, this.y + 16, 6, 6);
    world.pickups.push(new PotionPickup(pt.x, pt.y, slot.id, slot.count, this));
    world.effects.text(this.hx, this.hy - 34, 'DROPPED', { color: '#d8c8a0', size: 7 });
    Sound.play('uiClick');
  }

  /** Room in the bag for one more of this potion? */
  canCarry(id) { return this.inventory.some((s) => s === null || (s.id === id && s.count < BAG_STACK)); }

  /**
   * The running effect that stops this potion being drunk right now, or null.
   * Timed potions are one at a time per effect: the same effect can't be drunk
   * again until it wears off, unless the new one is a higher tier (it then
   * goes on over the weaker one).
   */
  brewBlocking(pot) {
    const cur = pot.duration > 0 ? this.brews[pot.family] : null;
    return cur && cur.tier >= pot.tier ? cur : null;
  }

  /** Applies a potion. Returns false (and keeps it) if it would be wasted. */
  drink(pot, world) {
    const say = (text, color) => world.effects.text(this.hx, this.hy - 34, text, { color, size: 7 });
    const [liquid, light] = POTION_COLORS[pot.family];
    const blocking = this.brewBlocking(pot);
    if (blocking) {
      say(`${BREW_LABELS[pot.family]} ${TIER_MARKS[blocking.tier]} STILL ACTIVE`, '#d8c8a0');
      return false;
    }
    switch (pot.family) {
      case 'heal':
        if (this.hp >= this.maxHp) { say('FULL HP', '#d8c8a0'); return false; }
        this.heal(pot.value, world);
        break;
      case 'mana': {
        const r = this.resource;
        if (!r) { say('NO MANA TO RESTORE', '#d8c8a0'); return false; }
        if (r.value >= r.max) { say(`FULL ${r.name}`, '#d8c8a0'); return false; }
        // light orbs and rockets come in ones: 20 -> 1, 50 -> 2, 100 -> 4
        const amount = r.name === 'LIGHT' || r.name === 'AMMO' ? Math.max(1, Math.round(pot.value / 25)) : pot.value;
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
      default:
        this.addBrew(pot);
    }
    if (pot.duration && pot.family !== 'purity') say(`${BREW_LABELS[pot.family] || pot.name.toUpperCase()} ${TIER_MARKS[pot.tier]}`, light);
    world.effects.burst(this.hx, this.hy - 10, { count: 14, colors: [liquid, light, '#ffffff'], speed: [20, 80], life: [0.3, 0.6], up: 40 });
    Sound.play('pickup');
    return true;
  }

  /**
   * Starts a timed potion effect. A weaker one already running carries on
   * underneath (`under`) and takes over again if it outlasts the new one.
   */
  addBrew(pot) {
    const cur = this.brews[pot.family] || null;
    this.brews[pot.family] = { v: pot.value, t: pot.duration, max: pot.duration, tier: pot.tier, tick: cur ? cur.tick : 0, under: cur };
  }

  /** Clears poison, burns, bleeding, slows, chills and stuns. */
  cleanse() {
    this.poisonTime = 0;
    this.ailments = {};
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
      // every layer runs down at once; when the top one ends, a weaker one left underneath takes over
      for (let l = this.brews[k]; l; l = l.under) l.t -= dt;
      let top = this.brews[k];
      while (top && top.t <= 0) top = top.under;
      for (let l = top; l && l.under;) {
        if (l.under.t <= 0) l.under = l.under.under;
        else l = l.under;
      }
      if (top) this.brews[k] = top;
      else delete this.brews[k];
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
          if (dist(this.x, this.y - 10, t.hx, t.hy) > INFERNO_RADIUS + t.radius) continue;
          world.damageTarget(t, fire.v * 0.5, { source: this, sound: null, color: '#ff8a2a', fromUlt: true, noCrit: true, fire: true });
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
    ctx.ellipse(this.x, this.y - 4, INFERNO_RADIUS, INFERNO_RADIUS * 0.55, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const a = this.animTime * 1.6 + (i / 20) * TAU;
      const fx = Math.round(this.x + Math.cos(a) * INFERNO_RADIUS);
      const fy = Math.round(this.y - 4 + Math.sin(a) * INFERNO_RADIUS * 0.55);
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
    this.healPopupTimer = 1;
    world.effects.text(this.hx, this.hy - 24, `+${Math.round(this.healPopup)}`, { color: '#6cff7a', size: 8 });
    this.healPopup = 0;
  }

  /** Damages every target inside a circle; returns the targets hit. */
  hitCircle(world, x, y, r, damage, opts = {}) {
    const hit = [];
    for (const t of world.getTargets()) {
      if (opts.exclude && opts.exclude.has(t)) continue;
      if (dist(x, y, t.hx, t.hy) > r + t.radius) continue;
      world.damageTarget(t, damage, { angle: angleTo(x, y, t.hx, t.hy), knockback: opts.knockback ?? 120, sound: opts.sound, fromUlt: opts.fromUlt, crit: opts.crit ?? null, fire: opts.fire });
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
      world.damageTarget(t, damage, { angle, knockback: opts.knockback ?? 120, sound: opts.sound, fromUlt: opts.fromUlt, fire: opts.fire });
      if (opts.exclude) opts.exclude.add(t);
      hit.push(t);
    }
    return hit;
  }

  // ---------- drawing ----------

  currentFrame() {
    return heroFrame(this.frames, this.moving, this.animTime);
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
    if (!this.seat) drawShadow(ctx, this.x, this.y + 9, 13, 5);
    this.drawGroundExtras(ctx);
    Upgrades.drawGround(this, ctx, this.animTime);
    if (this.isLocal) this.drawAbilityPreview(ctx);
  }

  /**
   * Sitting on a lobby seat: the hero's sitting pose (knees bent, body lowered),
   * raised so the hips rest on the seat and the feet touch the floor, breathing
   * slowly; weapon put away.
   */
  drawSeated(ctx) {
    if (this.seat.bed) return this.drawInBed(ctx);
    const frames = this.frames.sit || this.frames.idle;
    const frame = frames[Math.floor(this.animTime * 1.2) % frames.length];
    ctx.save();
    ctx.translate(0, -this.seat.lift);
    this.drawFrame(ctx, frame, HERO_ANCHOR, 1);
    ctx.restore();
    this.drawStatus(ctx);
  }

  /**
   * Tucked up in a lobby bed: just the sleeping face (eyes shut, breathing)
   * peeking out on the pillow, the bed's blanket drawn back over the body, z's
   * drifting up. (The bed sprite is 34x48, anchored at its bottom centre.)
   */
  drawInBed(ctx) {
    const bed = this.seat.prop;
    const top = Math.round(bed.y) - 48;   // drawProp rounds the bed to whole pixels too
    const breathe = Math.sin(this.animTime * 1.6) > 0 ? 1 : 0;
    const frame = this.frames.idle[6];   // the blink pose: eyes closed
    ctx.save();
    ctx.beginPath();
    ctx.rect(bed.x - 30, top - 30, 60, 52);
    ctx.clip();
    drawSprite(ctx, frame.img, bed.x, top + 50, HERO_ANCHOR.x, HERO_ANCHOR.y, false);
    ctx.restore();
    // the blanket over the body (the bed's own blanket rows, drawn again on top)
    const pr = Sprites.props[bed.name];
    ctx.drawImage(pr.img, 0, 23, pr.img.width, 22, Math.round(bed.x - pr.ax), top + 23 - breathe, pr.img.width, 22);
    for (let i = 0; i < 3; i++) {
      const k = (this.animTime * 0.4 + i / 3) % 1;
      ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
      HUD.text(ctx, i === 2 ? 'Z' : 'z', Math.round(bed.x + 10 + k * 14), Math.round(top + 4 - k * 22), { size: i === 2 ? 8 : 6, color: '#e8e0ff' });
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Inspired by a Bard: a turning golden ring at the feet, a warm glow,
   * sparkles spiralling up around the body and a golden note bobbing over the
   * head, fading out over the last half second.
   */
  drawInspired(ctx) {
    if (!(this.inspired > 0)) return;
    const t = this.animTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, this.inspired * 2);
    PFX.ring(ctx, this.x, this.y + 6, 17, 7, 'rgba(255, 211, 74, 0.85)', 2, { dash: [2, 2], spin: t * 3 });
    PFX.glow(ctx, this.x, this.hy, 22, '255, 211, 74', 0.3 + Math.sin(t * 6) * 0.08);
    for (let i = 0; i < 4; i++) {
      const a = t * 2.5 + (i * TAU) / 4;
      const rise = (t * 26 + i * 12) % 48;
      PFX.star(ctx, this.x + Math.cos(a) * 14, this.y + 4 - rise + Math.sin(a) * 4, rise < 24 ? 2 : 1, '#ffd34a', '#fff6c8', 2);
    }
    ctx.restore();
    // the golden note over the head
    const img = Sprites.projectiles.notes.energetic[0];
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.inspired * 2);
    ctx.drawImage(img, Math.round(this.x + 9), Math.round(this.y - 62 + Math.sin(t * 4) * 2));
    ctx.restore();
  }

  /** Overall sprite opacity (invisibility, vanish). */
  get bodyAlpha() { return 1; }

  draw(ctx) {
    if (this.dead) return;
    const blink = this.invulnerable > 0 && this.flashTime <= 0 && Math.floor(this.invulnerable * 14) % 2 === 0;
    const alpha = (blink ? 0.45 : 1) * this.bodyAlpha;
    if (alpha <= 0) return this.drawExtras(ctx);
    if (this.seat) return this.drawSeated(ctx);
    const weaponBehind = Math.sin(this.aim) < -0.35;
    ctx.globalAlpha = alpha;
    if (weaponBehind) this.drawWeapon(ctx);
    ctx.globalAlpha = 1;
    this.drawFrame(ctx, this.currentFrame(), HERO_ANCHOR, alpha);
    ctx.globalAlpha = alpha;
    if (!weaponBehind) this.drawWeapon(ctx);
    ctx.globalAlpha = 1;
    this.drawExtras(ctx);
    this.drawInspired(ctx);
    this.drawBrews(ctx);
    this.drawPassive(ctx);
    this.drawAegis(ctx);
    this.drawSongShield(ctx);
    Upgrades.drawOver(this, ctx, this.animTime);
    this.drawStatus(ctx);
  }
}

/** Factory used by the game to create the chosen hero, with the first `enhancements` of CONFIG.enhancements. */
function createHero(classId, x, y, enhancements = 0) {
  const classes = { warrior: Warrior, ranger: Ranger, mage: Mage, rogue: Rogue, priestess: Priestess, bard: Bard, rocketeer: Rocketeer, baker: Baker };
  const p = new classes[classId](x, y);
  applyEnhancements(p, enhancements);
  return p;
}

/** A new hero takes its gem enhancements: the first n of CONFIG.enhancements (the locked ability tree does nothing yet). */
function applyEnhancements(p, n) {
  p.enhancements = n;
  for (const t of CONFIG.enhancements.slice(0, n)) {
    if (t.hp) { p.maxHp += t.hp; p.hp = p.maxHp; }
    if (t.speed) p.speed += t.speed;
    if (t.crit) p.bonusCrit += t.crit;
    if (t.dodge) { p.dodgeCut += t.dodge; p.maxCooldowns.dodge = p.dodgeCooldown; }
    if (t.cooldowns) p.abilityHaste /= 1 - t.cooldowns;   // 25% shorter = recovering 1/0.75 as fast
  }
}

/**
 * A patch of the heroes' burning ground (the Rocketeer's IBFR, the Baker's exploding oven):
 * orange-gold flames over charred floor for `life`s (never the enemies' red). Every half
 * second it scorches the enemies standing in it (dps) and sets them alight (burnDps for
 * burnTime); the damage is owner's.
 */
function heroFireZone(world, owner, x, y, { r, life, dps, burnDps, burnTime }) {
  const stage = world.run ? world.run.stage : 0;
  let left = life;
  const tick = () => {
    left -= 0.5;
    if (left < 0 || (world.run && world.run.stage !== stage)) return;
    world.setActor(owner);
    for (const t of world.getTargets()) {
      if (Math.hypot(t.x - x, (t.y - y) / 0.55) > r + t.radius) continue;
      world.damageTarget(t, dps * 0.5, { sound: null, noCrit: true, color: '#ffb02e', fromUlt: true, source: owner, fire: true });
      if (t.dead) continue;
      const burning = world.dots.find((d) => d.target === t && d.kind === 'burn' && d.source === owner);
      if (burning) burning.t = Math.max(burning.t, burnTime);
      else world.addDot(t, burnDps, burnTime, '#ff8a1e', 'burn');
    }
    world.setActor(null);
    world.after(0.5, tick);
  };
  world.after(0.5, tick);
  // charred ground under a dashed ring of embers
  world.effects.add(life, (ctx, t) => {
    const k = t < 0.9 ? 1 : (1 - t) / 0.1;
    ctx.save();
    ctx.globalAlpha = 0.65 * k;
    PFX.disc(ctx, x, y, r, r * 0.55, '#1e1208', 3);
    ctx.globalAlpha = 0.8 * k;
    PFX.ring(ctx, x, y, r * 0.95, r * 0.52, '#ffb02e', 2, { dash: [4, 3], spin: t * 3 });
    ctx.restore();
  }, true);
  // tongues of orange-gold flame dancing all over it
  world.effects.add(life, (ctx, t) => {
    const k = t < 0.9 ? 1 : (1 - t) / 0.1;
    const secs = t * life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 8, r * 1.05, '255, 170, 70', 0.5 * k * (0.85 + Math.sin(secs * 11) * 0.15), 2, r * 0.6);
    ctx.restore();
    ctx.globalAlpha = k;
    const n = Math.round(r / 9);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4;
      const d = (i % 5) / 4.5;
      const lick = 1 + Math.sin(secs * 7 + i * 2.3) * 0.25;
      PFX.flame(ctx, x + Math.cos(a) * r * d, y + Math.sin(a) * r * 0.5 * d, 13, (18 + (i % 3) * 8) * lick, secs * 9 + i * 1.7, FIRE_COLORS);
    }
    ctx.globalAlpha = 1;
  });
  world.run?.addLight({ x, y, r: r * 2.4, s: 0.95, rgb: '255, 190, 90', until: world.time + life });
}
