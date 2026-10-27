// Base enemy: state machine helpers, damage, death, drawing.
// Subclasses implement think(dt, world) and optionally drawTelegraph(ctx).

class Enemy extends Entity {
  constructor(type, x, y) {
    super(x, y);
    this.type = type;
    this.cfg = CONFIG.enemies[type];
    this.maxHp = this.cfg.hp;
    this.hp = this.maxHp;
    this.speed = this.cfg.speed * rand(0.9, 1.1);
    this.radius = this.cfg.radius;
    this.knockbackResist = this.cfg.knockbackResist || 0;
    this.frames = Sprites.enemies[type];
    this.anchor = ENEMY_ANCHOR;
    this.state = 'chase';
    this.stateTime = 0;
    this.attackCooldown = rand(0.4, 1.2);
    this.moving = false;
    this.age = 0;
    this.gibColors = ['#8a2a2a', '#5a1a1a'];
    this.barOffset = 46;     // health bar height above (x, y)
    this.frozenTime = 0;
  }

  /** Body centre for hits, on the scaled-down sprite (see Game.drawEnemy). */
  get hy() { return this.y - this.hitOffY * CONFIG.enemyDrawScale; }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  update(dt, world) {
    this.age += dt;
    this.animTime += dt;
    this.flashTime -= dt;
    this.attackCooldown -= dt;
    this.moving = false;
    this.updateKnockback(dt, world);
    if (this.frozenTime > 0) this.frozenFx(dt, world);
    this.frozenTime -= dt;
    this.weakened = this.weakenUntil > world.time;   // (for drawing)
    this.isWarded = this.wardedUntil > world.time;   // inside a magic pillar's ward (for drawing)
    this.frostfired = this.frostfireUntil > world.time;   // burning with the Mage's frostfire: slowed
    if (this.asleep && !(this.stunTime > dt)) { this.asleep = false; this.wokeUp(world, 0); }
    this.iced = (this.iced || 0) - dt;       // coated in the Baker's icing (Bigger Cakes): slowed
    this.zapped = (this.zapped || 0) - dt;   // Tesla Armour's jolt (see Game.zap): stunned, crackling
    this.petSlow = (this.petSlow || 0) - dt; // a dog's bark or a pig's mud (see Pet): slowed
    this.groggy = (this.groggy || 0) - dt;   // still drowsy after a lullaby (Groggy): slowed
    this.waking = (this.waking || 0) - dt;
    this.hasted = (this.hasted || 0) - dt;   // a minstrel's war song (see Minstrel)
    this.rallied = (this.rallied || 0) - dt; // a general's call to charge (see General)
    // the Bard's lullaby meter drains whenever no lullaby reached this enemy this tick
    if (this.sleepMeter > 0 && this.lullabyTick !== world.time) this.sleepMeter = Math.max(0, this.sleepMeter - CONFIG.classes.bard.lullaby.meterDecay * dt);
    this.sticky = (this.sticky || 0) - dt;   // standing in the Baker's icing (see speedBoost)
    this.squash = (this.squash || 0) - dt;   // flattened under her giant cake (drawing only)
    if (this.stunTime > 0) {
      this.stunTime -= dt;
      return;
    }
    if (this.confused > 0) return this.updateConfused(dt, world);
    this.stateTime += dt;
    this.think(dt, world);
  }

  /**
   * Floured by the Baker: confused for `duration`s. It forgets what it was doing and
   * staggers about in random directions, attacking nobody.
   */
  confuse(duration, world) {
    if (this.dead || !(this.speed > 0)) return;   // things that can't walk (gravestones, turrets) can't wander off
    if (!(this.confused > 0)) world?.effects.text(this.hx, this.hy - 30, 'CONFUSED', { color: '#f4ead7', size: 7 });
    this.confused = Math.max(this.confused || 0, duration * (1 - (this.cfg.stunResist || 0)));
    if (this.state === 'windup') this.setState('chase');
  }

  updateConfused(dt, world) {
    this.confused -= dt;
    this.confuseTurn = (this.confuseTurn || 0) - dt;
    if (this.confuseTurn <= 0 || this.confuseHeading === undefined) {
      this.confuseTurn = rand(0.4, 1);
      this.confuseHeading = rand(0, TAU);
    }
    const x0 = this.x;
    const y0 = this.y;
    this.moveAngle(world, this.confuseHeading, this.speed * 0.65, dt);
    if (dist(x0, y0, this.x, this.y) < this.speed * dt * 0.2) this.confuseTurn = 0;   // bumped into something: turn
    if (this.confused <= 0 && this.state !== 'chase') this.setState('chase');
  }

  think() {}

  /** Stuns cancel attack windups. Leaps and dashes in flight finish first. */
  stun(duration) {
    if (this.dead || this.state === 'leap' || this.state === 'dash') return;
    this.stunTime = Math.max(this.stunTime || 0, duration * (1 - (this.cfg.stunResist || 0)));
    if (this.state === 'windup') this.setState('chase');
  }

  /** Whatever this enemy is chasing (hero, clone or nobody). */
  target(world) { return world.targetFor(this); }

  distanceTo(p) { return dist(this.x, this.y, p.x, p.y); }

  /** Chases a point, sidestepping around pillars when walking straight gets stuck. */
  moveToward(world, tx, ty, speed, dt) {
    const a = angleTo(this.x, this.y, tx, ty);
    const x0 = this.x;
    const y0 = this.y;
    this.moveAngle(world, a, speed, dt);
    if (dist(x0, y0, this.x, this.y) > speed * dt * 0.5) {
      if (this.detourTime > 0) this.detourTime -= dt;
      else this.detour = 0;
      return;
    }
    // blocked: commit to a side for a moment so we walk around the obstacle
    if (!this.detour) this.detour = Math.random() < 0.5 ? 1 : -1;
    this.detourTime = 0.4;
    const x1 = this.x;
    const y1 = this.y;
    world.dungeon.move(this, Math.cos(a + this.detour * Math.PI / 2) * speed * dt, Math.sin(a + this.detour * Math.PI / 2) * speed * dt);
    if (dist(x1, y1, this.x, this.y) < speed * dt * 0.2) this.detour *= -1; // hit a wall that way, try the other side
  }

  /** Movement speed multiplier: rallied by a general, it runs faster; stuck in the Baker's icing, slower. */
  get speedBoost() {
    return (this.rallied > 0 ? this.rallySpeed || 1 : 1) * (this.sticky > 0 ? 1 - CONFIG.classes.baker.passive.slow : 1)
      * (this.iced > 0 ? 0.6 : 1) * (this.groggy > 0 && !(this.stunTime > 0) ? 0.6 : 1)
      * (this.frostfired ? 1 - (this.frostfireSlow || 0) : 1)   // burning with the Mage's frostfire
      * (this.petSlow > 0 ? 1 - (this.petSlowBy || 0) : 1);     // a dog's bark, a pig's mud (see Pet)
  }

  /** Slowed by a pet (a dog's bark, a pig's mud) by `slow` for `time`s; the stronger slow wins while both run. */
  petSlowed(slow, time) {
    if (!(this.petSlow > 0) || slow >= (this.petSlowBy || 0)) this.petSlowBy = slow;
    this.petSlow = Math.max(this.petSlow || 0, time);
  }

  moveAngle(world, a, speed, dt) {
    speed *= this.speedBoost;
    world.dungeon.move(this, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
    if (Math.abs(Math.cos(a)) > 0.1) this.facing = Math.cos(a) >= 0 ? 1 : -1;
    this.moving = true;
  }

  faceToward(x) { this.facing = x >= this.x ? 1 : -1; }

  knockback(angle, force) {
    super.knockback(angle, force * CONFIG.knockback.scale * (1 - this.knockbackResist));
  }

  /**
   * Knockback carries an enemy further than other things (CONFIG.knockback.decay), and one
   * knocked into a wall or obstacle fast enough is slammed: a hit from whoever knocked it
   * (more the faster it was going), a short daze, dust and a thud.
   */
  updateKnockback(dt, world) {
    const k = CONFIG.knockback;
    const speed = Math.hypot(this.kbx, this.kby);
    if (speed < 1) return;
    const x0 = this.x;
    const y0 = this.y;
    const step = speed * dt;
    world.dungeon.move(this, this.kbx * dt, this.kby * dt);
    const decay = Math.min(1, k.decay * dt);
    this.kbx -= this.kbx * decay;
    this.kby -= this.kby * decay;
    if (speed < k.slamSpeed || dist(x0, y0, this.x, this.y) > step * 0.4) return;
    // it hit something solid
    const a = Math.atan2(this.kby, this.kbx);
    this.kbx = 0;
    this.kby = 0;
    const by = this.lastHitBy;
    if (by && world.players.includes(by)) {
      const dmg = Math.min(k.slamMax, Math.round(k.slamDamage * (speed / k.slamSpeed)));
      world.damageTarget(this, dmg, { source: by, noCrit: true, sound: null, color: '#d8b890', fromUlt: true });
      if (!this.dead) world.effects.text(this.hx, this.hy - 36, 'SLAM!', { color: '#d8b890', size: 7 });
    }
    if (!this.dead) this.stun(k.slamStun);
    const wx = this.x + Math.cos(a) * this.radius;
    const wy = this.y + Math.sin(a) * this.radius * 0.6;
    world.effects.burst(wx, wy - 6, { count: 12, colors: ['#8a6a4a', '#d8b890', '#f4e8d0'], speed: [40, 140], life: [0.2, 0.45], up: 30 });
    world.effects.smoke(wx, wy, { count: 4, radius: 10, life: 0.5, rise: 16 });
    world.shake(3, 0.12);
    Sound.play('heavySwing', 0.08);
  }

  /**
   * Just woken from a lullaby: if the Bard who sang it has Groggy, it stays drowsy (slowed)
   * for 3s more once it's come round (`after`s from now).
   */
  wokeUp(world, after) {
    const bard = this.sleptBy;
    this.sleptBy = null;
    if (!Upgrades.has(bard, 'groggy')) return;
    this.groggy = after + 3;
    world.effects.text(this.hx, this.hy - 40, 'GROGGY', { color: '#c8b8ff', size: 7 });
    Upgrades.state(bard).flash.groggy = world.time;
  }

  /** Lulled by the Bard's lullaby: a long stun that a hit breaks (it then takes a moment to come round). */
  sleep(duration) {
    this.stun(duration);
    if (this.stunTime > 0) this.asleep = true;
  }

  /** Returns true if the damage was applied. */
  takeDamage(amount, world) {
    this.appliedDamage = undefined;
    if (this.dead) return false;
    if (this.asleep) {
      this.asleep = false;
      // jolted awake: a second of blinking and shaking it off before it can act
      this.waking = CONFIG.classes.bard.lullaby.wake;
      this.stunTime = this.waking;
      this.sleepMeter = 0;
      world.effects.text(this.hx, this.hy - 30, 'WOKE UP', { color: '#c8b8ff', size: 7 });
      this.wokeUp(world, this.waking);
    }
    // inside a magic pillar's ward (the ruins): no hit does more than its cap
    if (this.wardedUntil > world.time && amount > this.wardCap) {
      amount = this.wardCap;
      this.appliedDamage = amount;
    }
    // a general's rallying shield soaks up hits first
    if (this.shieldHp > 0) {
      const soak = Math.min(this.shieldHp, amount);
      this.shieldHp -= soak;
      amount -= soak;
      if (this.shieldHp <= 0) world.effects.burst(this.hx, this.hy, { count: 12, colors: ['#ffe680', '#ff9a8a', '#ffffff'], speed: [40, 140], life: [0.2, 0.4] });
      if (amount <= 0) { this.flashTime = 0.05; return true; }
    }
    // armoured enemies shrug off part of every hit (but a warded hit is already as small as it gets)
    this.hp -= this.appliedDamage !== undefined ? amount : amount * (1 - (this.cfg.armor || 0));
    this.flashTime = 0.1;
    if (this.hp <= 0) this.die(world);
    return true;
  }

  die(world) {
    this.dead = true;
    world.effects.burst(this.hx, this.hy, { count: 16, colors: this.gibColors, speed: [60, 180], life: [0.3, 0.7], size: [2, 5] });
    Sound.play('enemyDie');
    world.maybeDropHeart(this.x, this.y, this.cfg.heartChance);
    world.maybeDropMana(this.x, this.y);
    this.onDeath(world);
  }

  onDeath() {}

  // ---------- shared melee behaviour (zombie, knight) ----------
  // chase -> windup (telegraph cone) -> strike -> recover

  meleeThink(dt, world, onStrike) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.setState('windup');
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          Sound.play('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= c.windup) {
          for (const a of world.allies) {
            const d = this.distanceTo(a);
            const inArc = Math.abs(angleDiff(this.attackAngle, angleTo(this.x, this.y, a.x, a.y))) <= (c.attackArcDegrees * DEG) / 2;
            if (d <= c.attackReach + a.radius && (inArc || d < a.radius + this.radius)) {
              a.hurt(c.damage, world, this.x, this.y);
            }
          }
          if (onStrike) onStrike();
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) {
          this.setState('chase');
          this.attackCooldown = c.cooldown;
        }
        break;
    }
  }

  drawMeleeTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.attackArcDegrees * DEG, c.attackReach, this.stateTime / c.windup);
  }

  /**
   * The slash a melee attack leaves: a crescent sweeping across the swing at body
   * height, thick in the middle and tapering at both ends, a white-hot core inside
   * a coloured edge, sparks thrown off its tip. rgb tints the edge.
   */
  swipeFx(world, rgb = '255, 120, 110') {
    const a = this.attackAngle;
    const arc = this.cfg.attackArcDegrees * DEG;
    const r = this.cfg.attackReach * 0.85;
    const x = this.x;
    const y = this.y - 10;
    const thick = Math.max(8, r * 0.22);
    const from = a - arc / 2;
    world.effects.add(0.26, (ctx, t) => {
      const head = Math.min(1, t * 4);           // the blade sweeps across in the first quarter
      const tail = Math.max(0, (t - 0.25) / 0.75); // then the trail fades from the back
      if (head <= tail) return;
      const n = 18;
      const outer = [];
      const inner = [];
      for (let i = 0; i <= n; i++) {
        const u = tail + (head - tail) * (i / n);
        const ang = from + arc * u;
        const w = thick * Math.sin(Math.PI * u) * (1 - t * 0.6);
        outer.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.85]);
        inner.push([x + Math.cos(ang) * (r - w), y + Math.sin(ang) * (r - w) * 0.85]);
      }
      const shape = () => {
        ctx.beginPath();
        outer.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
        ctx.closePath();
      };
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = `rgba(${rgb}, 0.85)`;
      shape();
      ctx.fill();
      ctx.strokeStyle = 'rgba(26, 16, 32, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // white-hot core along the outer edge
      ctx.strokeStyle = 'rgba(255, 250, 240, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      outer.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
      ctx.restore();
    });
    const tip = from + arc;
    world.effects.burst(x + Math.cos(tip) * r, y + Math.sin(tip) * r * 0.85, { count: 6, colors: ['#ffffff', `rgb(${rgb})`], speed: [40, 120], life: [0.15, 0.35], size: [1, 2] });
  }

  // ---------- drawing ----------

  drawGround(ctx) {
    const s = CONFIG.enemyDrawScale;   // under the scaled-down sprite (see Game.drawEnemy)
    drawShadow(ctx, this.x, this.y + 9 * s, this.radius * s, this.radius * 0.4 * s);
    this.drawTelegraph(ctx);
  }

  drawTelegraph() {}

  currentFrame() {
    // cute-style bodies have the heroes' 8-frame idle and walk
    if (this.frames.cute) return heroFrame(this.frames, this.moving, this.animTime);
    if (this.moving && this.frames.walk) return this.frames.walk[Math.floor(this.animTime * 7) % 4];
    return this.frames.idle[Math.floor(this.animTime * 2) % this.frames.idle.length];
  }

  /** Brief fade-in after spawning. */
  get spawnAlpha() { return clamp(this.age / 0.3, 0, 1); }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    this.drawHealthBar(ctx);
  }

  /** A stun that encases the enemy in ice. */
  freeze(duration) {
    this.stun(duration);
    if (this.stunTime > 0) this.frozenTime = this.stunTime;
  }

  /** While frozen: snow motes drifting off the ice; when it thaws, the block shatters (visual only). */
  frozenFx(dt, world) {
    if (vrand(0, 1) < dt * 6) {
      world.effects.burst(this.x + vrand(-this.radius, this.radius), this.y - vrand(0, this.barOffset - 10), {
        count: 1, colors: ['#e6f6ff', '#9ad0ff'], speed: [5, 15], life: [0.4, 0.7], up: 20, size: [1, 2],
      });
    }
    if (this.frozenTime - dt > 0 || this.dead) return;
    const cy = this.y - (this.barOffset - 6) / 2 + 6;
    world.effects.shards(this.x, cy, { count: 12, speed: [80, 200], life: 0.45, len: [6, 11], width: 4 });
    world.effects.burst(this.x, cy, { count: 10, colors: ['#ffffff', '#e6f6ff', '#9ad0ff'], speed: [40, 140], life: [0.2, 0.45], size: [2, 3] });
    Sound.play('bounce', 0.1);
  }

  /** Pixel ice crystal around a frozen enemy: jagged top, lit facets, a glint sweeping across, frost at its feet. */
  drawIceBlock(ctx) {
    const w = this.radius * 2 + 10;
    const h = this.barOffset - 4;
    const x0 = Math.round(this.x - w / 2);
    const yb = Math.round(this.y + 6);
    const cols = Math.ceil(w / 2);
    const spikes = [6, 1, 4, 0, 3, 7, 2, 5];
    const glint = ((this.animTime * 0.6) % 1.6) * cols;
    PFX.ring(ctx, this.x, this.y + 6, w * 0.7, w * 0.25, 'rgba(200, 240, 255, 0.55)', 2, { dash: [2, 2], spin: this.animTime * 0.5 });
    for (let i = 0; i < cols; i++) {
      const top = yb - h + spikes[i % spikes.length];
      const x = x0 + i * 2;
      const right = i > cols * 0.62;
      ctx.fillStyle = right ? 'rgba(90, 160, 235, 0.42)' : 'rgba(150, 220, 255, 0.36)';
      ctx.fillRect(x, top, 2, yb - top);
      // diagonal facet line catching the light
      ctx.fillStyle = 'rgba(230, 248, 255, 0.4)';
      ctx.fillRect(x, top + 4 + Math.round(i * 1.2), 2, 2);
      // bright rim along the jagged top, and the sweeping glint
      ctx.fillStyle = i === 0 || right ? 'rgba(200, 235, 255, 0.85)' : '#ffffff';
      ctx.fillRect(x, top, 2, 2);
      if (Math.abs(i - glint) < 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(x, top, 2, yb - top);
      }
    }
    // outline: sides and base
    ctx.fillStyle = 'rgba(220, 245, 255, 0.85)';
    ctx.fillRect(x0 - 1, yb - h + spikes[0], 1, h - spikes[0]);
    ctx.fillRect(x0 + cols * 2, yb - h + spikes[(cols - 1) % spikes.length], 1, h - spikes[(cols - 1) % spikes.length]);
    ctx.fillRect(x0, yb - 1, cols * 2, 1);
    if (Math.floor(this.animTime * 3) % 2) PFX.star(ctx, x0 + 4, yb - h + 10, 2, '#9ad0ff', '#ffffff');
  }

  /** Weakened by Screeching Tuning: a sickly violet haze and a down arrow over the head. */
  drawWeaken(ctx) {
    if (!this.weakened) return;
    const pulse = 0.5 + Math.sin(this.animTime * 6) * 0.2;
    drawGlow(ctx, this.x, this.hy, this.radius + 10, '150, 80, 200', pulse * 0.5);
    const x = Math.round(this.x + this.radius + 4);
    const y = Math.round(this.y - this.barOffset - 2 + Math.sin(this.animTime * 4) * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, y - 5, 5, 7);
    ctx.fillRect(x - 4, y + 1, 9, 3);
    ctx.fillRect(x - 2, y + 3, 5, 3);
    ctx.fillStyle = '#b070e0';
    ctx.fillRect(x - 1, y - 4, 3, 6);
    ctx.fillRect(x - 3, y + 2, 7, 1);
    ctx.fillRect(x - 1, y + 3, 3, 2);
  }

  /**
   * Rallied by a general: dust kicked up at its heels while it's quicker, and while its
   * shield holds, a gold shimmer round it (fading as the shield wears down).
   */
  drawRally(ctx) {
    if (this.shieldHp > 0) {
      const k = clamp(this.shieldHp / (this.shieldMax || 20), 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.hy, this.radius + 12, '255, 210, 120', 0.25 + 0.25 * k, 2, this.radius + 16);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.5 * k;
      PFX.ring(ctx, this.x, this.hy, this.radius + 8, this.radius + 13, '#ffe680', 2, { dash: [3, 3], spin: this.animTime * 2 });
      ctx.restore();
    }
    if (this.rallied > 0 && this.moving && Math.floor(this.animTime * 10) % 2) {
      ctx.fillStyle = 'rgba(200, 180, 150, 0.5)';
      ctx.fillRect(Math.round(this.x - this.facing * 8), Math.round(this.y - 2), 3, 2);
      ctx.fillRect(Math.round(this.x - this.facing * 13), Math.round(this.y - 4), 2, 2);
    }
  }

  /** Warded by a magic pillar: a shell of teal glyph-light round it, turning slowly. */
  drawWard(ctx) {
    const pulse = 0.55 + Math.sin(this.animTime * 5) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.hy, this.radius + 10, '90, 240, 215', 0.22 * pulse, 2, this.radius + 14);
    ctx.globalAlpha = pulse;
    PFX.ring(ctx, this.x, this.hy, this.radius + 7, this.radius + 11, '#5cf0d8', 2, { dash: [2, 3], spin: this.animTime * 1.5 });
    ctx.restore();
  }

  /** Spurred on by a minstrel's song: a little red note bobbing over its head. */
  drawHasted(ctx) {
    const img = Sprites.projectiles.redNote;
    const x = Math.round(this.x - this.radius - 10);
    const y = Math.round(this.y - this.barOffset - 10 + Math.sin(this.animTime * 6) * 2);
    ctx.drawImage(img, x, y);
  }

  /** Lazy "z z Z" drifting up from a sleeping enemy. */
  drawSleep(ctx) {
    const y0 = this.y - this.barOffset - 4;
    for (let i = 0; i < 3; i++) {
      const k = (this.animTime * 0.6 + i / 3) % 1;
      const x = Math.round(this.x + 4 + k * 12 + Math.sin(k * 6 + i) * 3);
      const y = Math.round(y0 - k * 18);
      const big = i === 2;
      ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
      HUD.text(ctx, big ? 'Z' : 'z', x, y, { size: big ? 8 : 6, color: '#c8b8ff' });
    }
    ctx.globalAlpha = 1;
  }

  /** The lullaby's sleep meter filling over a drowsy enemy: a little lavender bar with a "z". */
  drawSleepMeter(ctx) {
    const k = clamp(this.sleepMeter / CONFIG.classes.bard.lullaby.exposure, 0, 1);
    const w = 22;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - this.barOffset - 8);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#2a2448';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = k > 0.8 && Math.floor(this.animTime * 10) % 2 ? '#e8e0ff' : '#a898f0';
    ctx.fillRect(x, y, Math.round(w * k), 3);
    HUD.text(ctx, 'z', x + w + 3, y - 3, { size: 6, color: '#c8b8ff' });
  }

  /**
   * Jolted awake: a second of coming round - a startled "!" popping up, the
   * last z's scattering, and dizzy little lines shaking off its head.
   */
  drawWaking(ctx) {
    const k = 1 - this.waking / CONFIG.classes.bard.lullaby.wake;   // 0 just woken .. 1 fully awake
    const y0 = this.y - this.barOffset - 6;
    // "!" pops up with a bounce, then settles
    const pop = k < 0.25 ? Math.sin((k / 0.25) * Math.PI) * 6 : 0;
    HUD.text(ctx, '!', Math.round(this.x), Math.round(y0 - 6 - pop), { size: 10, align: 'center', color: '#ffe680' });
    // the z's flying apart as it wakes
    ctx.globalAlpha = Math.max(0, 1 - k * 2);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.8;
      const d = 6 + k * 40;
      HUD.text(ctx, 'z', Math.round(this.x + Math.cos(a) * d), Math.round(y0 + Math.sin(a) * d), { size: 6, color: '#c8b8ff' });
    }
    ctx.globalAlpha = 1;
    // shaking off the sleep: little lines either side of the head, flicking
    if (Math.floor(this.animTime * 12) % 2) {
      ctx.fillStyle = '#e8e0ff';
      const hy = Math.round(this.hy - this.radius);
      for (const s of [-1, 1]) {
        const x = Math.round(this.x + s * (this.radius + 4));
        ctx.fillRect(x, hy, 1, 4);
        ctx.fillRect(x + s * 3, hy + 2, 1, 4);
      }
    }
  }

  /** Circling stars over stunned enemies (an ice block if frozen, z's if asleep, a startled "!" while waking). */
  drawStun(ctx) {
    this.drawWeaken(ctx);
    if (this.isWarded) this.drawWard(ctx);
    if (this.hasted > 0) this.drawHasted(ctx);
    if (this.rallied > 0 || this.shieldHp > 0) this.drawRally(ctx);
    if (this.sleepMeter > 0 && !this.asleep) this.drawSleepMeter(ctx);
    if (this.confused > 0 && !(this.stunTime > 0)) return this.drawConfused(ctx);
    if (!(this.stunTime > 0)) return;
    if (this.frozenTime > 0) return this.drawIceBlock(ctx);
    if (this.zapped > 0) return Game.drawZapped(ctx, this.x, this.y, this.radius * 2 + 8, Math.max(24, this.y - this.hy) * 2, this.animTime, this.zapped);
    if (this.asleep) return this.drawSleep(ctx);
    if (this.waking > 0) return this.drawWaking(ctx);
    const y = this.y - this.barOffset - 8;
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 6 + (i * TAU) / 3;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(this.x + Math.cos(a) * 10) - 2, Math.round(y + Math.sin(a) * 3) - 2, 5, 5);
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(Math.round(this.x + Math.cos(a) * 10) - 1, Math.round(y + Math.sin(a) * 3) - 1, 3, 3);
    }
  }

  /** Confused: a puff of flour hanging on it, and question marks wheeling round its head. */
  drawConfused(ctx) {
    const y = this.y - this.barOffset - 8;
    ctx.save();
    ctx.globalAlpha = 0.35;
    PFX.disc(ctx, this.x, this.hy, this.radius + 4, this.radius * 0.8, '#f4f0e8', 2);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 4 + (i * TAU) / 3;
      HUD.text(ctx, '?', Math.round(this.x + Math.cos(a) * 11), Math.round(y + Math.sin(a) * 3) - 4, { size: 8, align: 'center', color: i === 1 ? '#ff8ad0' : '#f4ead7' });
    }
  }

  drawHealthBar(ctx) {
    this.drawStun(ctx);
    if (this.hp >= this.maxHp) return;
    const w = Math.max(20, this.radius * 2);
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - this.barOffset);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#e84a4a';
    ctx.fillRect(x, y, Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 3);
  }
}

/** Factory used by the wave director. */
function createEnemy(type, x, y) {
  const classes = {
    zombie: Zombie, slime: Slime, slimeSmall: Slime, wraith: Wraith, skeleton: Skeleton,
    undeadKnight: UndeadKnight, clayMinion: ClayMinion, gravestone: Gravestone, ghost: Ghost, mimic: Mimic,
    // graveyard
    bletcher: Bletcher, skeletonWarrior: SkeletonWarrior, bomber: Bomber, candlehead: Candlehead,
    shadowalker: Shadowalker, necromancer: Necromancer, reaper: Reaper, minigunner: Minigunner,
    zombieSoldier: ZombieSoldier, skeletonSorcerer: SkeletonSorcerer, flyingSkull: FlyingSkull,
    // castle
    squire: Squire, castleArcher: CastleArcher, minstrel: Minstrel, gunner: Gunner, catapult: Catapult,
    flamingCatapult: FlamingCatapult, maceSpinner: MaceSpinner, bishop: Bishop, castleKnight: CastleKnight,
    cavalry: Cavalry, castleSorcerer: CastleSorcerer, executioner: Executioner, jester: Jester,
    royalGuard: RoyalGuard, prince: Prince, princess: Princess, gardener: Gardener,
    general: General, clusterCatapult: ClusterCatapult, princeGuard: PrinceGuard,
    // the ancient ruins
    rockmite: Rockmite, rockDisc: RockDisc, clayGuard: ClayGuard, claySlime: ClaySlime, claySlimeTiny: ClaySlime,
    clayBud: ClayBud, rockShell: RockShell, rockBowler: RockBowler, rockWizard: RockWizard, ruinedTurret: RuinedTurret,
    stonePillar: StonePillar, rockGolem: RockGolem, ancientPortal: AncientPortal, magicPillar: MagicPillar, lightTotem: LightTotem,
    ancientLight: AncientLight, ancientRotator: AncientRotator,
  };
  return new classes[type](x, y, type);
}
