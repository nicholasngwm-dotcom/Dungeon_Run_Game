// Graveyard enemies (dungeon runs). The zombie, skeleton archer, wraith
// (Phantom), undead knight (Zombie Knight), gravestone (Tombstone) and ghost
// live in their own files; these are the rest of the theme's roster.

/** Ranged enemies keep between preferredMin and preferredMax, strafing in between. */
function kite(e, world, p, dt, speedMul = 1) {
  const c = e.cfg;
  const d = e.distanceTo(p);
  const toward = angleTo(e.x, e.y, p.x, p.y);
  e.strafeTimer = (e.strafeTimer ?? rand(1, 2.5)) - dt;
  if (e.strafeTimer <= 0) { e.strafeTimer = rand(1, 2.5); e.strafeDir = -(e.strafeDir || 1); }
  if (d < c.preferredMin) e.moveAngle(world, toward + Math.PI, e.speed * speedMul, dt);
  else if (d > c.preferredMax) e.moveToward(world, p.x, p.y, e.speed * speedMul, dt);
  else e.moveAngle(world, toward + (Math.PI / 2) * (e.strafeDir || 1), e.speed * 0.6 * speedMul, dt);
  e.faceToward(p.x);
}

/** Enemy shot from (x, y) at `angle`. */
function enemyShot(world, x, y, angle, speed, opts) {
  world.enemyProjectiles.push(new Projectile({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, friendly: false, life: 4, ...opts,
  }));
}

/** Blast that hurts every hero / clone / defended object in range. */
function enemyBlast(world, x, y, r, damage, colors = ['#ffb02e', '#ff5a1e', '#3a2a2a'], enemyDamage = 0) {
  for (const a of world.allies) {
    if (dist(a.x, a.y, x, y) < r + a.radius) a.hurt(damage, world, x, y);
  }
  // a bomb doesn't care whose side you're on: enemyDamage hurts the other enemies caught in it
  if (enemyDamage > 0) {
    for (const e of world.enemies) {
      if (e.dead || dist(e.x, e.y, x, y) >= r + e.radius) continue;
      e.takeDamage(enemyDamage, world);
      e.knockback?.(angleTo(x, y, e.x, e.y), 180);
      world.effects.text(e.hx, e.hy - 20, `${Math.round(enemyDamage)}`, { color: '#ff8a3a', size: 8 });
    }
  }
  // a scorch mark left on the ground, then the blast: a white-hot fireball, a shockwave
  // racing out to the edge of the blast, licking flames and a rolling cloud of smoke
  world.effects.add(1.4, (ctx, t) => {
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - t);
    PFX.disc(ctx, x, y, r * 0.55, r * 0.3, '#1a1210');
    ctx.restore();
  }, true);
  world.effects.add(0.45, (ctx, t) => {
    const e = 1 - (1 - t) ** 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 12, r * (0.5 + e * 0.5), '255, 140, 50', 1.3 * (1 - t), 2, r * 0.6 * (0.5 + e * 0.5));
    PFX.glow(ctx, x, y - 14, r * 0.35 * (1 - t * 0.7), '255, 240, 200', 1.4 * (1 - t));
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - t;
    PFX.ring(ctx, x, y, r * e, r * 0.55 * e, '#ffe0a0', 2, { thick: t < 0.3 ? 3 : 1 });
    ctx.restore();
  });
  world.effects.flames(x, y, { count: 6, spread: r * 0.45, height: 26, width: 12, life: 0.55 });
  world.effects.smoke(x, y - 14, { count: 10, radius: r * 0.45, life: 0.9, rise: 30 });
  world.effects.burst(x, y - 10, { count: 30, colors, speed: [80, 260], life: [0.3, 0.7], size: [2, 5] });
  world.shake(5, 0.2);
  Sound.play('explosion');
}

/** Melee swing at the allies inside an arc; onHit(ally) for those it connects with. */
function meleeArc(e, world, onHit) {
  const c = e.cfg;
  for (const a of world.allies) {
    const d = e.distanceTo(a);
    const inArc = Math.abs(angleDiff(e.attackAngle, angleTo(e.x, e.y, a.x, a.y))) <= (c.attackArcDegrees * DEG) / 2;
    if (d <= c.attackReach + a.radius && (inArc || d < a.radius + e.radius)) {
      if (a.hurt(c.damage, world, e.x, e.y) && onHit) onHit(a);
    }
  }
}

// ---------------------------------------------------------------

/** Bletching zombie: barely moves, lobs slow globs of poison. */
class Bletcher extends Enemy {
  constructor(x, y) {
    super('bletcher', x, y);
    this.aim = 0;
    this.gibColors = ['#86a86a', '#9cf06a', '#5a1a1a'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) {
          this.setState('windup');
          Sound.play('zombieGroan', 0.3);
        }
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.windup) {
          enemyShot(world, this.hx + Math.cos(this.aim) * 14, this.hy + Math.sin(this.aim) * 14, this.aim, c.spitSpeed, {
            radius: 7, damage: c.damage, sprite: Sprites.projectiles.spit, spin: 6, trail: ['#7ac040', '#4a8a2a'],
            onHit: (pr, w, t) => {
              t?.poison?.(c.poisonDps, c.poisonTime, w);
              w.effects.burst(pr.x, pr.y, { count: 10, colors: ['#9cf06a', '#4a8a2a'], speed: [30, 90], life: [0.2, 0.4] });
            },
          });
          Sound.play('slimeHop');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.5) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    Telegraph.circle(ctx, this.hx + Math.cos(this.aim) * 14, this.hy + Math.sin(this.aim) * 14, 10, this.stateTime / this.cfg.windup, '150, 240, 100');
  }
}

/** Skeleton warrior: sword and shield. The shield soaks the first hit it takes, then breaks. */
class SkeletonWarrior extends Enemy {
  constructor(x, y) {
    super('skeletonWarrior', x, y);
    this.shield = true;
    this.gibColors = ['#ebe5d3', '#b5ad96'];
  }

  takeDamage(amount, world) {
    if (this.dead) return false;
    if (this.shield) {
      this.shield = false;
      this.flashTime = 0.1;
      world.effects.text(this.hx, this.hy - 30, 'BLOCKED', { color: '#c8c0b0', size: 7 });
      world.effects.burst(this.hx + this.facing * 10, this.hy, { count: 14, colors: ['#9c6c3e', '#5b3922', '#adb2c0'], speed: [60, 160], life: [0.2, 0.4] });
      Sound.play('bounce');
      return false;
    }
    return super.takeDamage(amount, world);
  }

  think(dt, world) {
    this.meleeThink(dt, world, () => { this.swipeFx(world, '220, 214, 196'); Sound.play('slash'); });
  }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const sword = Sprites.weapons.sword;
    const swing = this.state === 'windup' ? -1.2 : this.state === 'recover' ? 0.9 : -0.3;
    const a = (f > 0 ? 0 : Math.PI) + swing * f;
    ctx.globalAlpha = this.spawnAlpha;
    drawRotated(ctx, sword.img, this.x + f * 8, this.hy + 4, sword.pivotX, sword.pivotY, a, f < 0);
    if (this.shield) {
      // a battered round shield on the off arm: planks, an iron rim and boss, lit from the top-left
      const sx = Math.round(this.x + f * 2);
      const sy = Math.round(this.hy + 2);
      PFX.disc(ctx, sx, sy, 8, 9, OUTLINE, 1);
      PFX.disc(ctx, sx, sy, 7, 8, '#80869a', 1);
      PFX.disc(ctx, sx, sy, 6, 7, '#7d532f', 1);
      ctx.fillStyle = '#9c6c3e';
      ctx.fillRect(sx - 4, sy - 6, 5, 2);
      ctx.fillStyle = '#5b3922';
      ctx.fillRect(sx - 1, sy - 6, 1, 13);
      ctx.fillRect(sx + 3, sy - 5, 1, 11);
      PFX.disc(ctx, sx, sy, 2, 2, '#adb2c0', 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 1, 1, 1);
      ctx.fillStyle = '#c9d3dd';
      ctx.fillRect(sx - 5, sy - 6, 2, 1);
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Skeleton bomber: rushes in carrying a bomb; close up it lights the fuse. Killing it sets the bomb off too. */
class Bomber extends Enemy {
  constructor(x, y) {
    super('bomber', x, y);
    this.gibColors = ['#ebe5d3', '#b5ad96', '#3a2a2a'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (this.state === 'fuse') {
      if (!p.dead) this.moveToward(world, p.x, p.y, this.speed * 0.35, dt);
      if (this.stateTime >= c.fuse) this.blowUp(world);
      return;
    }
    if (p.dead) return;
    this.moveToward(world, p.x, p.y, this.speed, dt);
    if (this.distanceTo(p) < c.triggerRange) {
      this.setState('fuse');
      Sound.play('fistCharge');
    }
  }

  blowUp(world) {
    if (this.dead) return;
    this.exploded = true;
    this.dead = true;
    enemyBlast(world, this.x, this.y, this.cfg.blastRadius, this.cfg.damage, undefined, this.cfg.enemyDamage);
    world.effects.burst(this.hx, this.hy, { count: 12, colors: this.gibColors, speed: [60, 180], life: [0.3, 0.6] });
  }

  /** Killed: the bomb drops and goes off a moment later. */
  die(world) {
    if (this.exploded) return;
    this.dead = true;
    world.effects.burst(this.hx, this.hy, { count: 14, colors: this.gibColors, speed: [60, 160], life: [0.3, 0.6] });
    Sound.play('enemyDie');
    world.maybeDropHeart(this.x, this.y, this.cfg.heartChance);
    const { x, y } = this;
    const c = this.cfg;
    world.effects.add(c.deathFuse, (ctx, t) => Telegraph.circle(ctx, x, y, c.blastRadius, t, '255, 120, 40'), true);
    world.after(c.deathFuse, () => enemyBlast(world, x, y, c.blastRadius, c.damage, undefined, c.enemyDamage));
  }

  drawTelegraph(ctx) {
    if (this.state === 'fuse') Telegraph.circle(ctx, this.x, this.y, this.cfg.blastRadius, this.stateTime / this.cfg.fuse, '255, 120, 40');
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // a round black bomb hugged to its chest in both bony hands (bobbing as it runs): lit
    // from the top-left, an iron cap, a curling fuse with a spark that sputters (and flares
    // when lit), blinking red as it's about to go
    const f = this.facing;
    const bob = this.moving ? Math.round(Math.abs(Math.sin(this.animTime * 10)) * 2) : 0;
    const x = Math.round(this.x + f * 7);
    const y = Math.round(this.hy + 4 - bob);
    const lit = this.state === 'fuse';
    const blink = lit && Math.floor(this.stateTime * (6 + this.stateTime * 14)) % 2;
    ctx.globalAlpha = this.spawnAlpha;
    // arms reaching from the shoulders round the bomb
    const shoulderY = Math.round(this.hy - 6);
    for (const side of [-1, 1]) {
      const sx0 = Math.round(this.x + side * 5);
      const hx = x + side * 8;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx0, shoulderY); ctx.lineTo(hx, y); ctx.stroke();
      ctx.strokeStyle = '#ebe5d3';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx0, shoulderY); ctx.lineTo(hx, y); ctx.stroke();
    }
    PFX.disc(ctx, x, y, 8, 8, OUTLINE, 1);
    PFX.disc(ctx, x, y, 7, 7, blink ? '#b8343a' : '#2c2a36', 1);
    PFX.disc(ctx, x + 1, y + 1, 5, 5, blink ? '#8a2228' : '#22202a', 1);
    ctx.fillStyle = blink ? '#ff8a80' : '#5a5868';
    ctx.fillRect(x - 4, y - 4, 3, 2);
    ctx.fillRect(x - 5, y - 2, 1, 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 3, y - 9, 6, 3);
    ctx.fillStyle = '#80869a';
    ctx.fillRect(x - 2, y - 8, 4, 1);
    // the fuse curling up
    ctx.fillStyle = '#8a7a6a';
    ctx.fillRect(x + 1, y - 11, 1, 2);
    ctx.fillRect(x + 2, y - 13, 1, 2);
    ctx.fillRect(x + 3, y - 14, 2, 1);
    const sx = x + 5;
    const sy = y - 15;
    const sputter = Math.floor(this.animTime * 10) % 2;
    if (lit || sputter) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, sx, sy, lit ? 10 : 6, '255, 190, 80', lit ? 1 : 0.6, 1);
      ctx.restore();
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
      if (lit) {
        ctx.fillStyle = '#ffb030';
        for (let i = 0; i < 3; i++) {
          const a = this.animTime * 9 + i * 2.1;
          ctx.fillRect(Math.round(sx + Math.cos(a) * 4), Math.round(sy + Math.sin(a) * 3 - 1), 1, 1);
        }
      }
    }
    // bony fingers gripping each side
    for (const side of [-1, 1]) {
      const hx = x + side * 8;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(hx - 2, y - 3, 5, 6);
      ctx.fillStyle = '#ebe5d3';
      ctx.fillRect(hx - 1, y - 2, 3, 4);
      ctx.fillStyle = '#b5ad96';
      ctx.fillRect(hx - 1, y, 3, 1);
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Candlehead: fires souls that knock heroes far back. */
class Candlehead extends Enemy {
  constructor(x, y) {
    super('candlehead', x, y);
    this.aim = 0;
    this.gibColors = ['#e8e0c8', '#6ad8ff', '#b5ad96'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) this.setState('windup');
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy - 20, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.windup) {
          fireSoul(world, this.hx, this.hy - 22, this.aim, c);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.4) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.5); }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    Telegraph.circle(ctx, this.hx, this.hy - 22, 9, this.stateTime / this.cfg.windup, '110, 210, 255');
  }
}

/** A soul bolt that shoves whoever it hits (Candlehead, Necromancer). */
function fireSoul(world, x, y, angle, c) {
  enemyShot(world, x, y, angle, c.soulSpeed, {
    radius: 6, damage: c.damage, sprite: Sprites.projectiles.soul, glow: '110, 210, 255', trail: ['#6ad8ff', '#e6f6ff'],
    onHit: (pr, w, t) => {
      if (t && t.knockback) t.knockback(Math.atan2(pr.vy, pr.vx), c.knockback);
      w.effects.burst(pr.x, pr.y, { count: 8, colors: ['#6ad8ff', '#e6f6ff'], speed: [30, 100], life: [0.2, 0.4] });
    },
  });
  Sound.play('magic', 0.1);
}

/** Shadowalker: poison dagger; every few seconds it blinks behind the hero and stabs. */
class Shadowalker extends Enemy {
  constructor(x, y) {
    super('shadowalker', x, y);
    this.blinkTimer = this.cfg.blinkInterval * rand(0.5, 1);
    this.quick = false;
    this.gibColors = ['#2c2440', '#c07aff', '#06040c'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.blinkTimer -= dt;
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        if (this.blinkTimer <= 0) return this.blink(world, p);
        this.moveToward(world, p.x, p.y, this.speed, dt);
        if (this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) this.startStab(p, false);
        break;
      case 'windup':
        if (this.stateTime >= (this.quick ? c.blinkWindup : c.windup)) {
          meleeArc(this, world, (a) => a.poison?.(c.poisonDps, c.poisonTime, world));
          this.swipeFx(world, '192, 122, 255');
          Sound.play('slash');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  startStab(p, quick) {
    this.quick = quick;
    this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
    this.faceToward(p.x);
    this.setState('windup');
  }

  /** Teleports to just behind the hero (opposite the way they're aiming). */
  blink(world, p) {
    this.blinkTimer = this.cfg.blinkInterval;
    const behind = (p.aim ?? angleTo(this.x, this.y, p.x, p.y)) + Math.PI;
    world.effects.burst(this.hx, this.hy, { count: 16, colors: ['#2c2440', '#c07aff'], speed: [40, 120], life: [0.2, 0.4] });
    const pt = world.dungeon.freePoint(p.x + Math.cos(behind) * 40, p.y + Math.sin(behind) * 30, this.hw, this.hh);
    this.x = pt.x;
    this.y = pt.y;
    world.effects.burst(this.hx, this.hy, { count: 16, colors: ['#2c2440', '#c07aff'], speed: [40, 120], life: [0.2, 0.4] });
    Sound.play('phantomVanish', 0.2);
    this.startStab(p, true);
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.attackArcDegrees * DEG, c.attackReach, this.stateTime / (this.quick ? c.blinkWindup : c.windup));
  }
}

/** Necromancer (stage 2+): stays back, raises groups of undead and fires souls. */
class Necromancer extends Enemy {
  constructor(x, y) {
    super('necromancer', x, y);
    this.soulTimer = 1.5;
    this.summonTimer = 2;
    this.gibColors = ['#3a2260', '#9cf06a', '#d8d0bc'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    if (this.state === 'cast') {
      if (this.stateTime >= 0.7) { this.raise(world); this.setState('chase'); }
      return;
    }
    kite(this, world, p, dt);
    this.soulTimer -= dt;
    if (this.soulTimer <= 0) {
      this.soulTimer = c.soulEvery;
      fireSoul(world, this.hx + this.facing * 12, this.hy, angleTo(this.hx, this.hy, p.hx, p.hy), c);
    }
    this.summonTimer -= dt;
    if (this.summonTimer <= 0) {
      this.summonTimer = c.summonEvery;
      const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
      if (alive < c.summonMax && world.summonRoom(this) > 0) { this.setState('cast'); Sound.play('graveRumble'); }
    }
  }

  raise(world) {
    const c = this.cfg;
    // its own limit and the cap shared by every summoner in the fight
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    const n = Math.min(c.summonCount, c.summonMax - alive, world.summonRoom(this));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.3, 0.3);
      world.summon(this, choose(c.summonTypes), this.x + Math.cos(a) * 50, this.y + Math.sin(a) * 34);
    }
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    if (this.state !== 'cast') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(156, 240, 106, ${0.8 - this.stateTime})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 4, 20 + this.stateTime * 40, (20 + this.stateTime * 40) * 0.5, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/** Reaper (stage 2+): wide scythe swings, waves of darkness, and teleports in when far away. */
class Reaper extends Enemy {
  constructor(x, y) {
    super('reaper', x, y);
    this.waveTimer = this.cfg.waveEvery * 0.6;
    this.blinkTimer = this.cfg.blinkEvery;
    this.waveAim = 0;
    this.hitOffY = 18;
    this.barOffset = 58;
    this.gibColors = ['#1e1628', '#463a5c', '#c8e8ff'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.waveTimer -= dt;
    this.blinkTimer -= dt;
    if (this.state === 'waveWindup') {
      if (this.stateTime < c.waveWindup * 0.6 && !p.dead) this.waveAim = angleTo(this.hx, this.hy, p.hx, p.hy);
      if (this.stateTime >= c.waveWindup) {
        enemyShot(world, this.hx, this.hy, this.waveAim, c.waveSpeed, {
          radius: 20, damage: c.waveDamage, life: 2.4, sprite: Sprites.projectiles.darkWave, glow: '120, 80, 180', trail: ['#463a5c', '#9a7ac0'],
        });
        Sound.play('heavySwing');
        this.setState('recover');
      }
      return;
    }
    if (this.state === 'chase' && !p.dead) {
      const d = this.distanceTo(p);
      if (this.blinkTimer <= 0 && d > c.blinkRange) return this.blink(world, p);
      if (this.waveTimer <= 0 && d > c.attackRange) {
        this.waveTimer = c.waveEvery;
        this.faceToward(p.x);
        this.setState('waveWindup');
        return;
      }
    }
    this.meleeThink(dt, world, () => { this.swipeFx(world, '154, 122, 192'); Sound.play('heavySwing'); });
  }

  blink(world, p) {
    this.blinkTimer = this.cfg.blinkEvery;
    world.effects.burst(this.hx, this.hy, { count: 20, colors: ['#06030a', '#463a5c'], speed: [40, 140], life: [0.3, 0.5] });
    const a = rand(0, TAU);
    const pt = world.dungeon.freePoint(p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 50, this.hw, this.hh);
    this.x = pt.x;
    this.y = pt.y;
    world.effects.burst(this.hx, this.hy, { count: 20, colors: ['#06030a', '#463a5c'], speed: [40, 140], life: [0.3, 0.5] });
    Sound.play('phantomAppear', 0.2);
    this.attackCooldown = 0.2;
  }

  /** Darkness gathers where it fell (red circle), then explodes: a blast plus a ring of dark waves. */
  onDeath(world) {
    const c = this.cfg;
    const x = this.x;
    const y = this.y;
    const scale = world.enemyScale ? world.enemyScale.damage : 1;
    world.effects.add(c.deathDelay, (ctx, t) => {
      Telegraph.circle(ctx, x, y, c.deathRadius, t, '150, 100, 220');
      // shadows swirling inward
      ctx.save();
      ctx.fillStyle = `rgba(10, 4, 20, ${0.35 + t * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 10 + t * 18, 8 + t * 14, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 14, { count: 26, colors: ['#06030a', '#1e1628', '#463a5c'], speed: [20, 70], life: [0.4, c.deathDelay], up: 20 });
    Sound.play('phantomVanish');
    world.after(c.deathDelay, () => {
      for (const a of world.allies) {
        if (dist(a.x, a.y, x, y) < c.deathRadius + a.radius) a.hurt(Math.round(c.deathDamage * scale), world, x, y);
      }
      for (let i = 0; i < c.deathWaves; i++) {
        const a = (i / c.deathWaves) * TAU;
        enemyShot(world, x, y - 14, a, c.deathWaveSpeed, {
          radius: 16, damage: Math.round(c.deathWaveDamage * scale), life: 1.8, sprite: Sprites.projectiles.darkWave,
          glow: '120, 80, 180', trail: ['#463a5c', '#9a7ac0'],
        });
      }
      world.effects.burst(x, y - 14, { count: 50, colors: ['#06030a', '#1e1628', '#463a5c', '#9a7ac0'], speed: [80, 280], life: [0.4, 0.9], size: [2, 6] });
      world.effects.add(0.5, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = 'rgba(14, 6, 26, 0.75)';
        ctx.beginPath();
        ctx.ellipse(x, y, c.deathRadius * (0.3 + t * 0.7), c.deathRadius * 0.6 * (0.3 + t * 0.7), 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(154, 122, 192, 0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }, true);
      world.shake(7, 0.3);
      Sound.play('explosion');
    });
  }

  drawTelegraph(ctx) {
    this.drawMeleeTelegraph(ctx);
    if (this.state === 'waveWindup') {
      const ex = this.hx + Math.cos(this.waveAim) * 260;
      const ey = this.hy + Math.sin(this.waveAim) * 260;
      Telegraph.line(ctx, this.x, this.y, ex, ey + 14, 40, this.stateTime / this.cfg.waveWindup, '150, 100, 220');
    }
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // the scythe: long handle, curved blade
    const f = this.facing;
    const raise = this.state === 'windup' || this.state === 'waveWindup' ? -0.9 : this.state === 'recover' ? 0.7 : -0.2;
    const a = (f > 0 ? -Math.PI / 2 : -Math.PI / 2) + raise * f + 0.4 * f;
    const hx = this.x + f * 10;
    const hy = this.hy + 10;
    const tx = hx + Math.cos(a) * 46;
    const ty = hy + Math.sin(a) * 46;
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#5b3922';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(tx + f * 14, ty + 4, 16, f > 0 ? Math.PI * 1.05 : -0.05, f > 0 ? Math.PI * 1.75 : -0.75, f < 0); ctx.stroke();
    ctx.strokeStyle = '#cfc7e8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tx + f * 14, ty + 4, 16, f > 0 ? Math.PI * 1.05 : -0.05, f > 0 ? Math.PI * 1.75 : -0.75, f < 0); ctx.stroke();
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Skeleton minigunner (stage 2+): a big skeleton; spins up, then sprays slow bullets. */
class Minigunner extends Enemy {
  constructor(x, y) {
    super('minigunner', x, y);
    this.aim = 0;
    this.fireTimer = 0;
    this.hitOffY = 20;
    this.barOffset = 66;
    this.hw = 13;
    this.hh = 8;
    this.gibColors = ['#ebe5d3', '#b5ad96', '#585d6c'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    const want = angleTo(this.hx, this.hy, p.hx, p.hy);
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = want;
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 140) { this.setState('spin'); Sound.play('fistCharge'); }
        break;
      case 'spin':
        this.aim += clamp(angleDiff(this.aim, want), -3 * dt, 3 * dt);
        this.faceToward(p.x);
        if (this.stateTime >= c.spinUp) { this.setState('fire'); this.fireTimer = 0; }
        break;
      case 'fire':
        this.aim += clamp(angleDiff(this.aim, want), -1.2 * dt, 1.2 * dt);   // tracks slowly, so you can outrun the stream
        this.fireTimer -= dt;
        while (this.fireTimer <= 0) {
          this.fireTimer += c.fireEvery;
          const a = this.aim + rand(-0.5, 0.5) * c.spreadDegrees * DEG;
          const s = CONFIG.enemyDrawScale;   // the muzzle of the scaled-down gun
          enemyShot(world, this.hx + Math.cos(this.aim) * 30 * s, this.hy + (4 + Math.sin(this.aim) * 30) * s, a, c.bulletSpeed, {
            radius: 5, damage: c.damage, sprite: Sprites.projectiles.heavyBullet, trail: ['#ff8a4a'],
          });
          Sound.play('enemyArrow', 0.05);
        }
        if (this.stateTime >= c.fireTime) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'spin') return;
    const ex = this.hx + Math.cos(this.aim) * 200;
    const ey = this.hy + Math.sin(this.aim) * 200;
    Telegraph.line(ctx, this.x, this.y, ex, ey + 14, 20, this.stateTime / this.cfg.spinUp, '255, 140, 70');
  }

  draw(ctx) {
    const s = 1.35;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.translate(-this.x, -this.y);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.restore();
    // minigun: a chunky barrel block pointing at the aim, barrels spinning while active
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    ctx.translate(this.hx + this.facing * 6, this.hy + 6);
    ctx.rotate(this.aim);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(-6, -7, 40, 14);
    ctx.fillStyle = '#585d6c';
    ctx.fillRect(-5, -6, 16, 12);
    ctx.fillStyle = '#383b48';
    ctx.fillRect(11, -5, 22, 10);
    const spin = this.state !== 'chase' ? Math.floor(this.animTime * 30) % 3 : 0;
    ctx.fillStyle = '#80869a';
    for (let i = 0; i < 3; i++) ctx.fillRect(11, -4 + ((i + spin) % 3) * 3, 22, 1);
    if (this.state === 'fire' && Math.floor(this.animTime * 25) % 2) {
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(33, -4, 6, 8);
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Zombie soldier (stage 3): armoured; aims, then fires a fast three-round burst. */
class ZombieSoldier extends Enemy {
  constructor(x, y) {
    super('zombieSoldier', x, y);
    this.aim = 0;
    this.shots = 0;
    this.gibColors = ['#4a5638', '#86a86a', '#5a1a1a'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) { this.setState('windup'); Sound.play('bowDraw'); }
        break;
      case 'windup':
        if (this.stateTime < c.windup * 0.6) { this.aim = angleTo(this.hx, this.hy, p.hx, p.hy); this.faceToward(p.x); }
        if (this.stateTime >= c.windup) { this.setState('burst'); this.shots = 0; }
        break;
      case 'burst':
        if (this.stateTime >= this.shots * c.burstEvery) {
          const mx = this.hx + Math.cos(this.aim) * 20;
          const my = this.hy + 2 + Math.sin(this.aim) * 20;
          enemyShot(world, mx, my, this.aim + rand(-0.03, 0.03), c.bulletSpeed, {
            radius: 5, damage: c.damage, sprite: Sprites.projectiles.bullet, trail: ['#ffd070', '#ff8a3a'], glow: '255, 190, 90',
          });
          // a heavy round: muzzle flash, a kick of smoke
          world.effects.burst(mx, my, { count: 6, colors: ['#ffffff', '#ffd070', '#ff8a3a'], speed: [60, 160], life: [0.06, 0.16], angle: this.aim, spread: 0.6, size: [1, 3] });
          world.effects.smoke(mx, my, { count: 2, radius: 6, life: 0.4, rise: 8 });
          Sound.play('enemyArrow', 0.02);
          Sound.play('impact', 0.02);
          if (++this.shots >= c.burst) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.5); }
        }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = { x: this.hx + Math.cos(this.aim) * 600, y: this.hy + Math.sin(this.aim) * 600 };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, 3, this.stateTime / this.cfg.windup);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // rifle
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    ctx.translate(this.hx + this.facing * 6, this.hy + 4);
    ctx.rotate(this.aim);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(-4, -4, 28, 7);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(-3, -3, 9, 5);
    ctx.fillStyle = '#383b48';
    ctx.fillRect(6, -3, 17, 3);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Skeleton sorcerer (stage 3): lines of bone hands that stun, and swarms of exploding skulls. */
class SkeletonSorcerer extends Enemy {
  constructor(x, y) {
    super('skeletonSorcerer', x, y);
    this.handsTimer = 2;
    this.skullsTimer = 4;
    this.hands = [];            // pending eruptions: { x, y, t, delay }
    this.gibColors = ['#cdb994', '#ebe5d3', '#c0302a'];
  }

  update(dt, world) {
    super.update(dt, world);
    this.updateHands(dt, world);   // eruptions finish even if the caster is stunned or dies
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    if (this.state === 'cast') {
      if (this.stateTime >= 0.5) {
        this.setState('chase');
        if (this.casting === 'hands') this.castHands(world, p);
        else this.castSkulls(world);
      }
      return;
    }
    kite(this, world, p, dt);
    this.handsTimer -= dt;
    this.skullsTimer -= dt;
    if (this.handsTimer <= 0) {
      this.handsTimer = c.handsEvery;
      this.casting = 'hands';
      this.setState('cast');
    } else if (this.skullsTimer <= 0) {
      this.skullsTimer = c.skullsEvery;
      if (this.skullsLeft(world) > 0) {
        this.casting = 'skulls';
        this.setState('cast');
      }
    }
  }

  /** A line of eruption spots from the sorcerer toward the hero (stopping at walls). */
  castHands(world, p) {
    const c = this.cfg;
    const a = angleTo(this.x, this.y, p.x, p.y);
    for (let i = 1; i <= c.handsCount; i++) {
      const x = this.x + Math.cos(a) * i * c.handsSpacing;
      const y = this.y + Math.sin(a) * i * c.handsSpacing;
      if (world.dungeon.isSolidAt(x, y)) break;
      this.hands.push({ x, y, t: 0, delay: c.handsDelay + i * c.handsStep });
    }
    Sound.play('graveRumble');
  }

  updateHands(dt, world) {
    const c = this.cfg;
    for (const h of this.hands) {
      h.t += dt;
      if (h.t < h.delay) continue;
      h.dead = true;
      for (const a of world.allies) {
        if (dist(a.x, a.y, h.x, h.y) > c.handsRadius + a.radius) continue;
        if (a.hurt(c.damage, world, h.x, h.y)) a.stun?.(c.stun, world);
      }
      const { x, y } = h;
      // the ground cracks open...
      world.effects.add(0.9, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 0.8 * (1 - t);
        PFX.disc(ctx, x, y, 14, 6, '#1e1612', 1);
        ctx.strokeStyle = '#2a1e18';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + 0.4;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 3);
          ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 7);
          ctx.stroke();
        }
        ctx.restore();
      }, true);
      // ...and a skeletal hand claws up out of it: bony fingers with knuckles, a wrist, a sickly glow
      world.effects.add(0.5, (ctx, t) => {
        const up = Math.sin(Math.min(1, t * 2.5) * Math.PI / 2) * (1 - Math.max(0, t - 0.6) * 2.5);
        if (up <= 0) return;
        const h = Math.round(24 * up);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - h / 2, 14, '150, 230, 110', 0.5 * up, 1);
        ctx.restore();
        const bone = (bx, by, w, bh) => {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(bx - 1, by - 1, w + 2, bh + 2);
          ctx.fillStyle = '#ebe5d3';
          ctx.fillRect(bx, by, w, bh);
          ctx.fillStyle = '#b5ad96';
          ctx.fillRect(bx + w - 1, by, 1, bh);
        };
        bone(x - 3, y - h * 0.45, 6, h * 0.45);                 // wrist
        bone(x - 6, y - h * 0.6, 12, 5);                        // palm
        for (let i = -2; i <= 2; i++) {
          const len = h * (0.42 - Math.abs(i) * 0.06);
          const fx = x + i * 3 - 1;
          const fy = y - h * 0.6 - len + Math.abs(i) * 2;
          bone(fx, fy, 2, len);
          ctx.fillStyle = '#b5ad96';
          ctx.fillRect(fx, fy + Math.round(len * 0.45), 2, 1);   // knuckle
        }
      });
      world.effects.burst(x, y, { count: 8, colors: ['#4a3426', '#6a5040', '#ebe5d3'], speed: [30, 100], life: [0.2, 0.45], up: 50 });
      Sound.play('hit', 0.05);
    }
    removeDead(this.hands);
  }

  /** How many more skulls it may raise: its own skullMax and the summon cap shared by every summoner. */
  skullsLeft(world) {
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    return Math.min(this.cfg.skullMax - alive, world.summonRoom(this));
  }

  castSkulls(world) {
    const n = Math.min(this.cfg.skullCount, this.skullsLeft(world));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const pt = world.dungeon.freePoint(this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 20, 8, 6);
      const skull = createEnemy('flyingSkull', pt.x, pt.y);
      skull.owner = this;
      world.countSummon(this);
      world.addEnemy(skull);
      world.effects.burst(pt.x, pt.y - 14, { count: 8, colors: ['#9cf06a', '#d8d0bc'], speed: [30, 90], life: [0.2, 0.4] });
    }
    Sound.play('ghostWail');
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    for (const h of this.hands) Telegraph.circle(ctx, h.x, h.y, this.cfg.handsRadius, h.t / h.delay, '150, 230, 110');
    if (this.state === 'cast') Telegraph.circle(ctx, this.x, this.y + 4, 26, this.stateTime / 0.5, '255, 80, 60');
  }
}

/** Flying skull (summoned by the sorcerer): flies at the hero and explodes on contact. */
class FlyingSkull extends Enemy {
  constructor(x, y) {
    super('flyingSkull', x, y);
    this.anchor = SKULL_ANCHOR;
    this.hitOffY = 16;
    this.barOffset = 28;
    this.hw = 6;
    this.hh = 4;
    this.gibColors = ['#d8d0bc', '#9cf06a'];
  }

  think(dt, world) {
    const p = this.target(world);
    if (p.dead) return;
    this.moveToward(world, p.x, p.y, this.speed, dt);
    for (const a of world.allies) {
      if (dist(this.x, this.y, a.x, a.y) < this.radius + a.radius + 4) {
        this.dead = true;
        enemyBlast(world, this.x, this.y, this.cfg.blastRadius, this.cfg.damage, ['#9cf06a', '#d8d0bc', '#4a8a2a']);
        return;
      }
    }
  }

  drawGround(ctx) { drawShadow(ctx, this.x, this.y + 6, 6, 2, 0.25); }

  draw(ctx) {
    const frame = this.frames.idle[Math.floor(this.animTime * 10) % 2];
    ctx.save();
    ctx.translate(0, Math.sin(this.animTime * 8) * 2 - 10);
    this.drawFrame(ctx, frame, this.anchor, this.spawnAlpha);
    ctx.restore();
  }
}
