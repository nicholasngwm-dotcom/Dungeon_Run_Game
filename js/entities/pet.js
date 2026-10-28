// Pets: a hero's animal companion (CONFIG.pets: cat, dog, bird, fish, pig), bought with gems in the
// keep's pet room and brought along on every run. A pet trots after its hero and fights whatever
// comes near them: the cat's scratches make enemies bleed, the dog's bark knocks them back, the bird
// pecks fast and can't be reached by melee, the flying fish spits bursting water balls from afar,
// and the pig's bites leave slowing, hurting mud.
//
// Pets never die. Enemies may go for them (they're allies, see Game.allies), but enemy bodies
// never hurt them; at 0 hp a pet runs back to its hero and sits out the fight until it has
// healed to full (CONFIG.petRules.recoverTime). The shop's follower upgrades work on them:
// Stronger Buddies (60% more hp, bigger) and Total Loyalty (attacks 50% faster, strays further).
//
// States: follow (at the hero's heel) | fight (a target near the hero) | retreat (healing by the hero)

class Pet extends Entity {
  constructor(kind, owner, world) {
    super(owner.x - owner.facing * 24, owner.y + 8);
    this.kind = kind;
    this.cfg = CONFIG.pets[kind];
    this.owner = owner;
    this.ownerId = owner.netId;
    this.frames = Sprites.pets[kind];
    this.hw = 6;
    this.hh = 4;
    this.radius = this.cfg.flying ? 7 : 9;
    this.hitOffY = this.cfg.flying ? 22 : 8;
    this.flying = !!this.cfg.flying;  // the bird flies over cover and furniture (walls still stop it)
    this.contactImmune = true;        // enemy bodies never hurt a pet
    this.notHunted = !!this.cfg.flying;   // nothing chases the bird (melee can't reach it anyway)
    this.hp = this.maxHp;
    this.state = 'follow';
    this.target = null;
    this.attackT = 0;
    this.lunge = 0;                   // the attack pose, held a moment after each attack
    this.specialT = this.cfg.bleed ? 1 : this.cfg.bark ? 1.5 : 0;   // first bleed / bark comes soon
    this.mud = [];                    // the pig's mud patches: { x, y, t, tick }
    this.shots = [];                  // the fish's water balls in flight: { x0, y0 (mouth), g0 (ground under it), x, y (where it lands), t, time }
    this.sinceHit = 99;
    this.invulnerable = 0;
    this.moving = false;
    this.poof(world);
  }

  /** Stronger Buddies: 60% more hp, and bigger. */
  get buddy() { return Upgrades.has(this.owner, 'strongerBuddies'); }
  /** Total Loyalty: attacks 50% faster and ranges further from its hero. */
  get loyal() { return Upgrades.has(this.owner, 'totalLoyalty'); }
  get maxHp() { return this.cfg.hp * (this.buddy ? 1.6 : 1); }
  get size() { return this.buddy ? 1.25 : 1; }

  /** In the fight (enemies may attack it). A pet healing by its hero is left out of it. */
  get fighting() { return this.state !== 'retreat' && !this.dead; }

  get invisible() { return false; }

  /** Its bites grow with the stage, like the enemies. */
  stageScale(world) { return 1 + CONFIG.petRules.stageDamage * ((world.run?.stage || 1) - 1); }

  update(dt, world) {
    const R = CONFIG.petRules;
    const o = this.owner;
    this.animTime += dt;
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.attackT -= dt;
    this.specialT -= dt;
    this.lunge -= dt;
    this.sinceHit += dt;
    this.hp = Math.min(this.hp, this.maxHp);
    this.updateKnockback(dt, world);
    this.updateMud(dt, world);
    this.updateShots(dt, world);
    // too far behind (or shut out of the room the hero's fighting in): it catches up in a puff
    if (dist(this.x, this.y, o.x, o.y) > R.leash * 1.8 || this.shutOut(world)) this.catchUp(world);

    if (this.state === 'retreat') {
      // healing by its hero; back in once it's whole again
      this.hp = Math.min(this.maxHp, this.hp + (this.maxHp / R.recoverTime) * dt);
      this.heel(dt, world, 16);
      if (this.hp >= this.maxHp) {
        this.state = 'follow';
        world.effects.text(this.hx, this.hy - 20, 'READY!', { color: this.cfg.color, size: 7 });
        world.effects.burst(this.hx, this.hy, { count: 12, colors: [this.cfg.color, '#ffffff'], speed: [40, 120], life: [0.25, 0.5], up: 30 });
      }
      return;
    }
    if (this.sinceHit > R.regenDelay) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * R.regen * dt);

    // something to fight near its hero? (never in the keep)
    const reach = R.leash * (this.loyal ? 1.3 : 1);
    const t = world.lobby ? null : this.pickTarget(world, reach);
    this.target = t;
    this.state = t ? 'fight' : 'follow';
    if (!t) return this.heel(dt, world, 26);

    const near = t.radius + this.radius + this.cfg.reach;
    const d = dist(this.x, this.y, t.x, t.y);
    this.facing = t.x >= this.x ? 1 : -1;
    if (d > near) this.moveToward(t.x, t.y, this.cfg.speed, dt, world);
    else {
      this.moving = false;
      if (this.attackT <= 0) this.attack(t, world);
    }
    if (this.cfg.bark && this.specialT <= 0 && d < this.cfg.bark.radius) this.bark(world);
  }

  /** The nearest enemy within `reach` of its hero (it sticks with the one it's on while it can). */
  pickTarget(world, reach) {
    const o = this.owner;
    const ok = (t) => t && !t.dead && !t.immune && !t.prop && world.getTargets().includes(t) && dist(o.x, o.y, t.x, t.y) < reach;
    if (ok(this.target)) return this.target;
    const t = nearestTarget(world, o.x, o.y, reach);
    return ok(t) ? t : null;
  }

  /** In a run, the hero is fighting in a room this pet isn't in (its doors are shut). */
  shutOut(world) {
    const run = world.run;
    if (!run || !run.active || !run.floor) return false;
    return run.floor.roomAt(this.x, this.y) !== run.active && run.floor.roomAt(this.owner.x, this.owner.y) === run.active;
  }

  /** Pops back in beside its hero. */
  catchUp(world) {
    this.poof(world);
    this.x = this.owner.x - this.owner.facing * 20;
    this.y = this.owner.y + 6;
    const f = world.dungeon;
    if (f.boxHitsWall?.(this.x, this.y, this.hw, this.hh)) {
      const pt = f.freePoint(this.owner.x, this.owner.y, this.hw, this.hh);
      this.x = pt.x;
      this.y = pt.y;
    }
    this.kbx = 0;
    this.kby = 0;
    this.poof(world);
  }

  /** Trots to a spot at its hero's heel, `gap` px behind them. */
  heel(dt, world, gap) {
    const o = this.owner;
    const tx = o.x - o.facing * gap;
    const ty = o.y + 6;
    const d = dist(this.x, this.y, tx, ty);
    if (d < 10) {
      this.moving = false;
      this.facing = o.facing;
      return;
    }
    // hurries the further behind it falls
    this.moveToward(tx, ty, Math.max(this.cfg.speed * 0.8, Math.min(d * 3, (o.speed || 200) * 1.4)), dt, world);
  }

  moveToward(x, y, speed, dt, world) {
    const a = angleTo(this.x, this.y, x, y);
    const step = Math.min(speed * dt, dist(this.x, this.y, x, y));
    world.dungeon.move(this, Math.cos(a) * step, Math.sin(a) * step);
    if (Math.abs(Math.cos(a)) > 0.1) this.facing = Math.cos(a) >= 0 ? 1 : -1;
    this.moving = true;
  }

  // ---------- attacks ----------

  attack(t, world) {
    const c = this.cfg;
    this.attackT = c.every / (this.loyal ? 1.5 : 1);
    this.lunge = Math.min(0.18, this.attackT * 0.6);
    if (c.shot) return this.shoot(t, world);
    const angle = angleTo(this.x, this.y, t.x, t.y);
    world.damageTarget(t, c.damage * this.stageScale(world), { source: this.owner, angle, knockback: c.flying ? 10 : 40, sound: null, fromUlt: true, color: c.color });
    world.effects.burst(t.hx, t.hy, { count: 3, colors: ['#ffffff', c.color], speed: [30, 90], life: [0.1, 0.22] });
    if (vrand(0, 1) < (c.flying ? 0.3 : 1)) Sound.play(this.kind === 'pig' ? 'slimeLand' : 'hit', 0.06);
    if (c.bleed && this.specialT <= 0 && !t.dead) {
      // a deep scratch: it bleeds (the hero gets the credit)
      this.specialT = c.bleed.every;
      world.addDot(t, c.bleed.dps * this.stageScale(world), c.bleed.time, '#ff4a5a', 'bleed');
      world.effects.text(t.hx, t.hy - 34, 'BLEEDING', { color: '#ff4a5a', size: 7 });
      this.clawFx(world, t);
    }
    if (c.mud) this.dropMud(t.x, t.y, world);
  }

  /** Three red claw marks raked across the target. */
  clawFx(world, t) {
    const { hx: x, hy: y } = t;
    world.effects.add(0.3, (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      for (let i = -1; i <= 1; i++) {
        PFX.line(ctx, x - 8 + i * 4, y - 8, x + 4 + i * 4, y + 8, OUTLINE, 3);
        PFX.line(ctx, x - 8 + i * 4, y - 8, x + 4 + i * 4, y + 8, '#ff6a6a', 1);
      }
      ctx.restore();
    });
  }

  /** The dog barks: every enemy close by is knocked away from it (a wall slam counts as its hero's hit). */
  bark(world) {
    const b = this.cfg.bark;
    this.specialT = b.every;
    this.lunge = 0.25;
    for (const e of world.enemies) {
      if (e.dead || e.prop || dist(this.x, this.y, e.x, e.y) > b.radius + (e.radius || 0)) continue;
      e.lastHitBy = this.owner;
      e.knockback(angleTo(this.x, this.y, e.x, e.y), b.knockback);
    }
    world.effects.text(this.x + this.facing * 14, this.y - 30, 'WOOF!', { color: '#ffe0a0', size: 8 });
    const { x, y } = this;
    world.effects.add(0.45, (ctx, k) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k;
      const r = 14 + k * b.radius;
      PFX.ring(ctx, x, y - 4, r, r * 0.55, 'rgba(255, 224, 160, 0.8)', 2, { thick: k < 0.4 ? 2 : 1 });
      ctx.restore();
    });
    Sound.play('windup', 0.15);
  }

  /** The fish spits a water ball, lobbed at where the target stands now. */
  shoot(t, world) {
    const y0 = this.y - this.flyHeight - 6;
    const time = Math.max(0.15, dist(this.x, y0, t.x, t.y) / this.cfg.shot.speed);
    this.shots.push({ x0: this.x + this.facing * 6, y0, g0: this.y, x: t.x, y: t.y, t: 0, time });
    world.effects.burst(this.x + this.facing * 8, y0, { count: 4, colors: ['#c8f4ff', '#4ad0e8'], speed: [20, 60], life: [0.1, 0.25] });
    Sound.play('splash', 0.04);
  }

  /** Water balls in flight: each bursts where it lands, splashing every enemy close by. */
  updateShots(dt, world) {
    const s = this.cfg.shot;
    if (!s) return;
    for (const b of this.shots) {
      b.t += dt;
      if (b.t < b.time) continue;
      b.dead = true;
      for (const e of world.getTargets()) {
        if (e.dead || e.prop || dist(b.x, b.y, e.x, e.y) > s.splash + (e.radius || 0)) continue;
        world.damageTarget(e, this.cfg.damage * this.stageScale(world), { source: this.owner, angle: angleTo(b.x, b.y, e.x, e.y), knockback: 25, sound: null, fromUlt: true, color: this.cfg.color });
      }
      world.effects.burst(b.x, b.y - 4, { count: 14, colors: ['#ffffff', '#c8f4ff', '#4ad0e8', '#2a8ab0'], speed: [40, 130], life: [0.2, 0.45], gravity: 300, up: 50 });
      const { x, y } = b;
      world.effects.add(0.35, (ctx, k) => {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        PFX.ring(ctx, x, y, s.splash * (0.4 + k * 0.6), s.splash * 0.55 * (0.4 + k * 0.6), '#a8ecff', 2, { thick: k < 0.4 ? 2 : 1 });
        ctx.restore();
      });
      Sound.play('splash', 0.08);
    }
    removeDead(this.shots);
  }

  /** The water balls arcing through the air: a little blue drop with a bright glint and a shadow below. */
  drawShots(ctx) {
    for (const b of this.shots) {
      const k = clamp(b.t / b.time, 0, 1);
      const x = lerp(b.x0, b.x, k);
      const y = lerp(b.y0, b.y, k) - Math.sin(k * Math.PI) * 26;
      drawShadow(ctx, x, lerp(b.g0, b.y, k), 3, 1.5, 0.25);
      PFX.disc(ctx, x, y, 4, 4, OUTLINE, 1);
      PFX.disc(ctx, x, y, 3, 3, '#2a8ab0', 1);
      PFX.disc(ctx, x - 0.5, y - 0.5, 2, 2, '#4ad0e8', 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x - 1), Math.round(y - 2), 1, 1);
    }
  }

  /** The pig's bite leaves a patch of mud under the enemy (only a few at once). */
  dropMud(x, y, world) {
    const m = this.cfg.mud;
    const near = this.mud.find((p) => dist(p.x, p.y, x, y) < m.radius * 0.6);
    if (near) { near.t = 0; return; }   // freshened up instead of piling on
    this.mud.push({ x, y, t: 0, tick: 0.5, blobs: Array.from({ length: 5 }, () => [vrand(-0.6, 0.6), vrand(-0.4, 0.4), vrand(0.35, 0.6)]) });
    if (this.mud.length > 4) this.mud.shift();
    world.effects.burst(x, y - 2, { count: 8, colors: ['#4a3420', '#6a4a2a', '#8a6a3a'], speed: [30, 90], life: [0.2, 0.4], gravity: 300, up: 40 });
  }

  /** Mud slows every enemy standing in it, and hurts them twice a second. */
  updateMud(dt, world) {
    const m = this.cfg.mud;
    if (!m) return;
    for (const p of this.mud) {
      p.t += dt;
      p.tick -= dt;
      if (p.t >= m.time) { p.dead = true; continue; }
      const hurt = p.tick <= 0;
      if (hurt) p.tick += 0.5;
      for (const e of world.enemies) {
        if (e.dead || e.flying) continue;
        const dx = (e.x - p.x) / m.radius;
        const dy = (e.y - p.y) / (m.radius * 0.55);
        if (dx * dx + dy * dy > 1) continue;
        e.petSlowed?.(m.slow, 0.3);
        if (hurt) world.damageTarget(e, m.dps * 0.5 * this.stageScale(world), { source: this.owner, noCrit: true, sound: null, fromUlt: true, color: '#b8905e' });
      }
    }
    removeDead(this.mud);
  }

  // ---------- taking hits ----------

  /** Enemy bodies never hurt it, and melee can't reach the bird (only projectiles can). */
  hurt(amount, world, fromX, fromY, opts = {}) {
    if (!this.fighting || this.invulnerable > 0 || opts.contact) return false;
    if (this.cfg.flying && !opts.projectile) return false;
    const dmg = Math.max(1, Math.round(amount));
    this.hp -= dmg;
    this.sinceHit = 0;
    this.invulnerable = CONFIG.petRules.hurtGrace;
    this.flashTime = 0.1;
    world.effects.text(this.hx, this.hy - 16, `-${dmg}`, { color: '#ff8a8a', size: 7 });
    if (fromX !== undefined) this.knockback(angleTo(fromX, fromY, this.x, this.y), 120);
    if (this.hp <= 0) this.retreat(world);
    return true;
  }

  /** Worn out: it runs back to its hero to lick its wounds. */
  retreat(world) {
    this.hp = 0;
    this.state = 'retreat';
    this.target = null;
    world.effects.burst(this.hx, this.hy, { count: 10, colors: ['#ffffff', '#c8c0b8'], speed: [30, 90], life: [0.2, 0.4], up: 20 });
  }

  /** Sent home (no longer chosen, or its player left). */
  leave(world) {
    if (this.dead) return;
    this.dead = true;
    this.poof(world);
  }

  poof(world) {
    world.effects.smoke(this.x, this.y - 6, { count: 6, radius: 10, life: 0.5, rise: 16 });
    world.effects.burst(this.x, this.y - 8, { count: 10, colors: [this.cfg.color, '#ffffff'], speed: [30, 100], life: [0.2, 0.45], up: 30 });
  }

  // ---------- drawing ----------

  drawGround(ctx) {
    const m = this.cfg.mud;
    for (const p of this.mud) {
      // a brown splat with wet highlights, drying out at the end
      const k = Math.min(1, p.t * 6, (m.time - p.t) * 1.5);
      ctx.save();
      ctx.globalAlpha = 0.85 * k;
      PFX.disc(ctx, p.x, p.y, m.radius, m.radius * 0.55, '#4a3420', 3);
      for (const [bx, by, br] of p.blobs) PFX.disc(ctx, p.x + bx * m.radius, p.y + by * m.radius * 0.55, m.radius * br * 0.5, m.radius * br * 0.28, '#6a4a2a', 2);
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = '#a8865a';   // wet glints
      for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(p.x - m.radius * 0.4 + i * 13), Math.round(p.y - 3 + (i % 2) * 4), 3, 1);
      ctx.restore();
    }
    if (this.dead) return;
    drawShadow(ctx, this.x, this.y + 1, 8 * this.size, 3, this.cfg.flying ? 0.18 : 0.3);
  }

  currentPose() {
    const f = this.frames;
    if (this.state === 'retreat' && !this.moving) return f.rest;
    if (this.lunge > 0) return f.attack;
    if (this.flying) return f.walk[Math.floor(this.animTime * 14) % 2];   // always flapping (it lands only to rest)
    return this.moving ? f.walk[Math.floor(this.animTime * 9) % 2] : f.sit;
  }

  /** How high the bird hovers (it dips to peck, and lands to rest). */
  get flyHeight() {
    if (!this.flying || this.state === 'retreat') return 0;
    return 18 + Math.sin(this.animTime * 6) * 2 + (this.lunge > 0 ? -6 : 0);
  }

  draw(ctx) {
    this.drawShots(ctx);
    if (this.dead) return;
    const pose = this.currentPose();
    const fly = this.flyHeight;
    const hop = !this.cfg.flying && this.moving ? Math.abs(Math.sin(this.animTime * 9)) * 2 : 0;
    const blink = this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2;
    const s = this.size;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y - fly - hop));
    ctx.scale(this.facing < 0 ? -s : s, s);
    ctx.globalAlpha = blink ? 0.5 : this.state === 'retreat' ? 0.8 : 1;
    ctx.drawImage(pose.img, -pose.ax, -pose.ay);
    ctx.restore();
    if (this.loyal && this.fighting) {
      // Total Loyalty: a gold ring turning round its feet
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, this.x, this.y + 1, 10 * s, 4 * s, 'rgba(255, 184, 74, 0.6)', 1, { dash: [2, 2], spin: this.animTime * 3 });
      ctx.restore();
    }
    // health: red while fighting, a green bar filling back up while it heals
    const w = 20;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - fly - 22 * s);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#3a1a1a';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = this.state === 'retreat' ? '#6cff7a' : '#e84a4a';
    ctx.fillRect(x, y, Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 2);
    if (this.state === 'retreat') {
      // a little bandage cross bobbing over it
      const by = Math.round(y - 6 + Math.sin(this.animTime * 4));
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(this.x) - 3, by - 1, 7, 3);
      ctx.fillRect(Math.round(this.x) - 1, by - 3, 3, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(this.x) - 2, by, 5, 1);
      ctx.fillRect(Math.round(this.x), by - 2, 1, 5);
    }
  }
}
