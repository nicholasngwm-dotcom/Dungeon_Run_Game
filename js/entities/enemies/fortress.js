// Fiery Fortress enemies (dungeon runs): demons, living fire and molten things guarding a fortress
// over a sea of lava. Bodies are drawn in js/gfx/enemies/fortress.js; weapons, living flames, the
// elemental's fists and the fire and lava themselves are drawn here. Uses the other themes' helpers
// (kite, enemyShot, hitAround, groundZone, holdWeapon, meleeArc, stageDamage, hitLine).
//
// Fire and lava are different (CONFIG.run.lava / fire):
//   fire  sets you on fire: the slow, light burn every theme's fire uses (hero.burn)
//   lava  burns FAST while you stand in it, and clings a moment after (hero.lavaBurn)
// The fortress's own creatures are at home in both.

const FORT_ROCK_GIBS = ['#2c2426', '#544846', '#0e0a0c'];
const FORT_LAVA_GIBS = ['#ff7a1a', '#ffb52e', '#d63c16'];
const FORT_DEMON_GIBS = ['#6e1614', '#98241c', '#240608'];

/** Sets a hero alight with cfg's burn (burnDps for burnTime), scaled for the stage. */
function setAlight(world, a, c) {
  a.burn?.(stageDamage(world, c.burnDps), c.burnTime, world);
}

/** Lava searing whoever it touches: the fast burn, scaled for the stage. */
function searLava(world, a) {
  const L = CONFIG.run.lava;
  a.lavaBurn?.(stageDamage(world, L.dps), L.linger, world);
}

/** A shot of fire: it sets whoever it hits alight, and bursts in sparks. */
function fireShot(world, x, y, angle, speed, c, opts) {
  enemyShot(world, x, y, angle, speed, {
    radius: 5, trail: ['#ffd34a', '#ff8a1e', '#e0461e'], glow: FORT_LAVA,
    onHit: (pr, w, t) => {
      if (t) setAlight(w, t, c);
      w.effects.burst(pr.x, pr.y, { count: 8, colors: FORT_LAVA_GIBS, speed: [30, 110], life: [0.15, 0.35] });
    },
    ...opts,
  });
}

/** A pool of molten lava on the ground (layers of crust, molten rock and white-hot swirls), k = fade 0-1, secs = its age. */
function drawLavaDisc(ctx, x, y, r, k, secs, seed = 0) {
  ctx.save();
  ctx.globalAlpha = k;
  PFX.disc(ctx, x, y, r, r * 0.55, '#2e1612');
  PFX.disc(ctx, x, y, r * 0.88, r * 0.47, '#a8200e');
  PFX.disc(ctx, x, y, r * 0.7, r * 0.36, '#e0461e');
  for (let i = 0; i < 4; i++) {
    const a = secs * 0.8 + i * 1.7 + seed;
    PFX.disc(ctx, x + Math.cos(a) * r * 0.35, y + Math.sin(a * 1.3) * r * 0.18, r * 0.22, r * 0.11, i % 2 ? '#ff8a1e' : '#ffc23a');
  }
  // bubbles swelling and popping
  const ph = (secs * 1.4 + seed) % 1;
  ctx.fillStyle = `rgba(255, 240, 180, ${1 - ph})`;
  ctx.fillRect(Math.round(x + Math.sin(seed * 3 + Math.floor(secs * 1.4)) * r * 0.5), Math.round(y - 1), 2 + Math.round(ph * 2), 2);
  ctx.restore();
}

/**
 * A pool of lava an attack leaves (a magma slime's last gasp, the elemental's wave, a dragon's fireball):
 * heroes standing in it get the fast lava burn every tick. Lasts `life` s, cooling to crust at the end.
 */
function lavaPool(world, x, y, r, life) {
  groundZone(world, {
    x, y, r, life, every: CONFIG.run.lava.every,
    tick: (w, px, py, pr) => {
      for (const a of w.heroes) if (!a.dead && dist(a.x, a.y, px, py) < pr + a.radius * 0.4) searLava(w, a);
      if (vrand(0, 1) < 0.3) w.effects.burst(px + vrand(-pr * 0.6, pr * 0.6), py + vrand(-pr * 0.3, pr * 0.3), { count: 1, colors: FORT_LAVA_GIBS, speed: [10, 30], life: [0.3, 0.6], up: 30, size: [1, 2] });
    },
    draw: (ctx, px, py, pr, t) => drawLavaDisc(ctx, px, py, pr * (t < 0.08 ? t / 0.08 : 1), t < 0.85 ? 1 : (1 - t) / 0.15, t * life, px * 0.01),
    top: (ctx, px, py, pr, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, px, py, pr * 1.2, FORT_LAVA, 0.35 * (t < 0.85 ? 1 : (1 - t) / 0.15), 2, pr * 0.6);
      ctx.restore();
    },
    light: { r: r * 2.6, rgb: FORT_LAVA, s: 0.85 },
  });
}

/**
 * Ground left burning (a meteor's crater, the worm's arrow, a wildfire's trail): whoever stands in it is set
 * on fire (the slow burn, cfg.burnDps for cfg.burnTime). `flames`: how many tongues of fire dance over it.
 */
function firePatch(world, x, y, r, life, c, flames = 9) {
  const dps = stageDamage(world, c.burnDps);
  groundZone(world, {
    x, y, r, life, every: 0.25,
    tick: (w, px, py, pr) => {
      for (const a of w.heroes) if (!a.dead && dist(a.x, a.y, px, py) < pr + a.radius * 0.5) a.burn?.(dps, c.burnTime, w);
    },
    draw: (ctx, px, py, pr, t) => {
      const k = t < 0.85 ? 1 : (1 - t) / 0.15;
      ctx.save();
      ctx.globalAlpha = 0.55 * k;
      PFX.disc(ctx, px, py, pr, pr * 0.55, '#2a0e06');
      ctx.globalAlpha = 0.8 * k;
      PFX.ring(ctx, px, py, pr * 0.9, pr * 0.5, '#ff6a1a', 2, { dash: [3, 3] });
      ctx.restore();
    },
    top: (ctx, px, py, pr, t) => {
      const k = t < 0.85 ? 1 : (1 - t) / 0.15;
      const secs = t * life;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, px, py - 6, pr * 1.05, '255, 110, 30', 0.5 * k, 2, pr * 0.6);
      ctx.restore();
      ctx.globalAlpha = k;
      for (let i = 0; i < flames; i++) {
        const a = i * 2.4;
        const d = (i % 4) / 3.6;
        const lick = 1 + Math.sin(secs * 7 + i * 2.3) * 0.25;
        PFX.flame(ctx, px + Math.cos(a) * pr * d, py + Math.sin(a) * pr * 0.5 * d, 10, (12 + (i % 3) * 6) * lick, secs * 9 + i * 1.7, FORT_FIRE);
      }
      ctx.globalAlpha = 1;
    },
    light: { r: r * 2.4, rgb: '255, 120, 40', s: 0.8 },
  });
}

/** A beam of lava along a line (visual only): a white-hot core in orange, spattering where it ends. */
function lavaBeamFx(world, x1, y1, x2, y2, width, life = 0.3) {
  const angle = angleTo(x1, y1, x2, y2);
  const len = dist(x1, y1, x2, y2);
  world.effects.add(life, (ctx, t) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - t;
    PFX.beam(ctx, x1, y1, angle, len, width * (1.4 - t * 0.6), ['#7a1206', '#e0461e', '#ffb02e', '#fff6c8'], 2, false);
    PFX.glow(ctx, x2, y2, 16, FORT_LAVA, 0.8 * (1 - t));
    ctx.restore();
  });
  world.effects.burst(x2, y2, { count: 12, colors: FORT_LAVA_GIBS, speed: [40, 160], life: [0.2, 0.45], gravity: 300, up: 40 });
}

// ---------------------------------------------------------------

/** Skeleflame: a charred skeleton archer, its skull ablaze; its burning arrows set you on fire. */
class Skeleflame extends Enemy {
  constructor(x, y) {
    super('skeleflame', x, y);
    this.aim = 0;
    this.gibColors = ['#5a5040', '#b5ad96', '#ff8a1e'];
  }

  update(dt, world) {
    super.update(dt, world);
    if (this.state === 'windup') this.aimEnd = world.dungeon.raycast(this.hx, this.hy, this.aim, 700);
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
        if (this.stateTime < c.windup - c.aimLockAt) { this.aim = angleTo(this.hx, this.hy, p.hx, p.hy); this.faceToward(p.x); }
        if (this.stateTime >= c.windup) {
          fireShot(world, this.hx + Math.cos(this.aim) * 14, this.hy + Math.sin(this.aim) * 14, this.aim, c.arrowSpeed, c, {
            radius: 4, damage: c.damage, life: 3, sprite: Sprites.projectiles.fireArrow,
          });
          Sound.play('fireArrow', 0.1);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.3) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = this.aimEnd || { x: this.hx, y: this.hy };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, 4, this.stateTime / this.cfg.windup);
  }

  draw(ctx) {
    const bow = Sprites.weapons.boneBow;
    const behind = Math.sin(this.aim) < -0.35;
    const pull = this.state === 'windup' ? 4 : 10;
    const bx = this.hx + Math.cos(this.aim) * pull;
    const by = this.hy + 2 + Math.sin(this.aim) * pull * 0.7;
    const drawBow = () => {
      ctx.globalAlpha = this.spawnAlpha;
      drawRotated(ctx, bow.img, bx, by, bow.pivotX, bow.pivotY, this.aim);
      // the arrow on the string, its head burning
      if (this.state === 'windup') PFX.flame(ctx, bx + Math.cos(this.aim) * 12, by + Math.sin(this.aim) * 12, 5, 8, this.animTime * 10, FORT_FIRE);
      ctx.globalAlpha = 1;
    };
    if (behind) drawBow();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (!behind) drawBow();
    // its skull burns: flames licking up off the crown
    ctx.globalAlpha = this.spawnAlpha;
    const f = this.facing;
    for (let i = 0; i < 3; i++) PFX.flame(ctx, this.x + f * (-1 + i * 3) - f * 1, this.y - 40 + (i === 1 ? -2 : 0), 6, 10 + (i === 1 ? 5 : 0), this.animTime * 9 + i * 2, FORT_FIRE);
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Magma slime: molten rock under a crust. Leaps onto you; splits into three little ones, each leaving lava when it dies. */
class MagmaSlime extends Slime {
  constructor(x, y, type = 'magmaSlime') {
    super(x, y, type);
    this.small = type === 'magmaSlimeTiny';
    const a = this.small ? SLIME_MAGMA_TINY : SLIME_MAGMA;
    this.anchor = { x: a.ax, y: a.ay };
    this.hitOffY = this.small ? 5 : 10;
    this.hw = this.small ? 7 : 12;
    this.hh = this.small ? 4 : 6;
    this.barOffset = this.small ? 20 : 32;
    this.gibColors = FORT_LAVA_GIBS;
  }

  onDeath(world) {
    const c = this.cfg;
    if (!c.splitCount) {
      // a little one bursts into a small pool of lava
      lavaPool(world, this.x, this.y, c.poolRadius, c.poolTime);
      Sound.play('splash', 0.1);
      return;
    }
    Sound.play('slimeSplit');
    for (let i = 0; i < c.splitCount; i++) {
      const a = (i / c.splitCount) * TAU + rand(-0.3, 0.3);
      const s = new MagmaSlime(this.x + Math.cos(a) * 8, this.y + Math.sin(a) * 8, 'magmaSlimeTiny');
      s.knockback(a, 240);
      s.attackCooldown = rand(0.8, 1.4);
      world.addEnemy(s);
    }
  }

  draw(ctx) {
    super.draw(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - (this.small ? 6 : 12) - this.height, this.small ? 10 : 18, FORT_LAVA, 0.25 * this.spawnAlpha);
    ctx.restore();
  }
}

/** Magma bat: small, quick and erratic, flitting aside from your hits; swoops in to bite and set you on fire. */
class MagmaBat extends Enemy {
  constructor(x, y) {
    super('magmaBat', x, y);
    this.flying = true;
    this.anchor = BAT_ANCHOR;
    this.hw = 6;
    this.hh = 4;
    this.hitOffY = 30;
    this.barOffset = 52;
    this.wander = rand(0, TAU);
    this.gibColors = [...FORT_ROCK_GIBS, '#ff8a1e'];
  }

  /** Hard to hit: it flits aside from some hits altogether. */
  takeDamage(amount, world) {
    if (!this.dead && this.state !== 'swoop' && Math.random() < this.cfg.dodgeChance) {
      const a = rand(0, TAU);
      world.dungeon.move(this, Math.cos(a) * this.cfg.dodgeDistance, Math.sin(a) * this.cfg.dodgeDistance);
      world.effects.text(this.hx, this.hy - 16, 'MISS', { color: '#ffb52e', size: 7 });
      return false;
    }
    return super.takeDamage(amount, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase': {
        // a jittery, zigzagging flight round the hero
        this.wander += dt * rand(-6, 6);
        const d = this.distanceTo(p);
        const toward = angleTo(this.x, this.y, p.x, p.y);
        const a = d > 90 ? toward + Math.sin(this.wander) * 0.9 : toward + Math.PI / 2 + Math.sin(this.wander) * 1.4;
        this.moveAngle(world, a, this.speed, dt);
        if (this.attackCooldown <= 0 && d < c.attackRange) {
          this.setState('windup');
          this.swoopAngle = toward;
          this.faceToward(p.x);
        }
        break;
      }
      case 'windup':
        // pulls back a little, screeching
        this.moveAngle(world, this.swoopAngle + Math.PI, 40, dt);
        if (this.stateTime >= c.windup) { this.setState('swoop'); this.swoopHit = new Set(); Sound.play('dash', 0.1); }
        break;
      case 'swoop':
        this.moveAngle(world, this.swoopAngle, c.swoopSpeed, dt);
        for (const a of world.allies) {
          if (this.swoopHit.has(a) || dist(a.x, a.y, this.x, this.y) > this.radius + a.radius + 6) continue;
          this.swoopHit.add(a);
          if (a.hurt(c.damage, world, this.x, this.y)) setAlight(world, a, c);
        }
        if (this.stateTime >= c.swoopTime) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.5); }
        break;
    }
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 4, 8, 3, 0.25);
    if (this.state === 'windup') Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(this.swoopAngle) * 120, this.y + Math.sin(this.swoopAngle) * 120, 12, this.stateTime / this.cfg.windup);
  }

  draw(ctx) {
    const list = this.frames.idle;
    const f = list[Math.floor(this.animTime * (this.state === 'swoop' ? 22 : 14)) % list.length];
    const bob = Math.round(Math.sin(this.animTime * 5) * 3);
    ctx.save();
    ctx.translate(0, -20 + bob);
    this.drawFrame(ctx, f, this.anchor, this.spawnAlpha);
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 2, 10, FORT_LAVA, 0.3 * this.spawnAlpha);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Demon warrior: stabs its pitchfork down a lane; from further off the fork spits a fan of burning fireballs. */
class DemonWarrior extends Enemy {
  constructor(x, y) {
    super('demonWarrior', x, y);
    this.attackAngle = 0;
    this.fireTimer = this.cfg.fireEvery * rand(0.3, 0.7);
    this.gibColors = FORT_DEMON_GIBS;
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.fireTimer -= dt;
    switch (this.state) {
      case 'chase': {
        if (p.dead) break;
        this.moveToward(world, p.x, p.y, this.speed, dt);
        const d = this.distanceTo(p);
        if (d < c.attackRange && this.attackCooldown <= 0) {
          this.setState('windup');
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          Sound.play('windup');
        } else if (this.fireTimer <= 0 && d > c.fireRange[0] && d < c.fireRange[1]) {
          this.setState('cast');
          this.attackAngle = angleTo(this.hx, this.hy, p.hx, p.hy);
          this.faceToward(p.x);
          Sound.play('fireballCast', 0.1);
        }
        break;
      }
      case 'windup':
        if (this.stateTime >= c.windup) {
          const x2 = this.x + Math.cos(this.attackAngle) * c.thrustReach;
          const y2 = this.y + Math.sin(this.attackAngle) * c.thrustReach;
          for (const a of world.allies) {
            if (pointSegmentDistance(a.x, a.y, this.x, this.y, x2, y2) <= c.thrustWidth / 2 + a.radius) a.hurt(c.damage, world, this.x, this.y);
          }
          world.effects.burst(x2, y2 - 10, { count: 8, colors: ['#ffffff', '#ffb52e', '#ff7a1a'], speed: [40, 120], life: [0.12, 0.3], angle: this.attackAngle, spread: 0.8 });
          Sound.play('swordStab');
          this.setState('recover');
        }
        break;
      case 'cast':
        if (!p.dead && this.stateTime < c.fireWindup * 0.6) this.attackAngle = angleTo(this.hx, this.hy, p.hx, p.hy);
        if (this.stateTime >= c.fireWindup) {
          // three little fireballs out of the tines, in a fan
          const n = c.fireballs;
          const tip = this.forkTip();
          for (let i = 0; i < n; i++) {
            const a = this.attackAngle + (n > 1 ? (i / (n - 1) - 0.5) * c.fanDegrees * DEG : 0);
            fireShot(world, tip.x, tip.y, a, c.fireSpeed, c, { radius: 5, damage: stageDamage(world, c.fireDamage), sprite: Sprites.projectiles.fireballSmall, spin: 8 });
          }
          Sound.play('bossFireball', 0.1);
          this.fireTimer = c.fireEvery + rand(0, 1.5);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  /** Where the pitchfork's tines are. */
  forkTip() {
    return { x: this.x + this.facing * 6 + Math.cos(this.attackAngle) * 44, y: this.hy + 4 + Math.sin(this.attackAngle) * 44 * 0.7 };
  }

  drawTelegraph(ctx) {
    const c = this.cfg;
    const a = this.attackAngle;
    if (this.state === 'windup') Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(a) * c.thrustReach, this.y + Math.sin(a) * c.thrustReach, c.thrustWidth, this.stateTime / c.windup);
    if (this.state === 'cast') {
      for (let i = 0; i < c.fireballs; i++) {
        const fa = a + (i / (c.fireballs - 1) - 0.5) * c.fanDegrees * DEG;
        Telegraph.line(ctx, this.hx, this.hy, this.hx + Math.cos(fa) * 120, this.hy + Math.sin(fa) * 120, 6, this.stateTime / c.fireWindup, Telegraph.orange);
      }
    }
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    // the pitchfork: held upright at rest, levelled for the stab or the spit of fire
    let a = f > 0 ? -1.1 : Math.PI + 1.1;
    let reach = 0;
    if (this.state === 'windup' || this.state === 'cast') { a = this.attackAngle; reach = -6 * Math.min(1, this.stateTime / 0.2); }
    else if (this.state === 'recover') { a = this.attackAngle; reach = this.stateTime < 0.15 ? 18 : 18 * Math.max(0, 1 - (this.stateTime - 0.15) / 0.3); }
    ctx.globalAlpha = this.spawnAlpha;
    const w = Sprites.weapons.pitchfork;
    drawRotated(ctx, w.img, this.x + f * 6 + Math.cos(a) * reach, this.hy + 4 + Math.sin(a) * reach * 0.7, w.pivotX, w.pivotY, a, Math.cos(a) < 0);
    if (this.state === 'cast') {
      const tip = this.forkTip();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, tip.x, tip.y, 8 + this.stateTime * 18, FORT_LAVA, 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Magic demon: gathers a ring of violet orbs round its staff and launches the whole circle at you, widening as it flies. */
class MagicDemon extends Enemy {
  constructor(x, y) {
    super('magicDemon', x, y);
    this.aim = 0;
    this.gibColors = [...FORT_DEMON_GIBS, '#b05af0'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) { this.setState('windup'); Sound.play('burstCharge', 0.12); }
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.windup) { this.launch(world); this.setState('recover'); }
        break;
      case 'recover':
        if (this.stateTime >= 0.5) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.8); }
        break;
    }
  }

  /** Where the ring gathers: round the staff's head. */
  get ringAt() { return { x: this.x + this.facing * 14, y: this.hy - 14 }; }

  /** The circle of orbs flies off at the hero together: each orb keeps its place round the moving, widening ring. */
  launch(world) {
    const c = this.cfg;
    const o = this.ringAt;
    const dir = this.aim;
    for (let i = 0; i < c.ringCount; i++) {
      const slot = (i / c.ringCount) * TAU;
      enemyShot(world, o.x + Math.cos(slot) * c.ringRadius, o.y + Math.sin(slot) * c.ringRadius * 0.7, dir, c.ringSpeed, {
        radius: 5, damage: c.damage, life: c.ringLife, sprite: Sprites.projectiles.magicOrb, glow: FORT_MAGIC, trail: ['#b05af0', '#e0a8ff'],
        homing: (pr, dt) => {
          if (!(dt > 0)) return;
          const k = Math.min(1, pr.age / (c.ringLife * 0.6));
          const r = c.ringRadius + (c.ringWiden - c.ringRadius) * k;
          const cx = o.x + Math.cos(dir) * c.ringSpeed * pr.age;
          const cy = o.y + Math.sin(dir) * c.ringSpeed * pr.age;
          const a = slot + pr.age * 1.2;
          pr.vx = (cx + Math.cos(a) * r - pr.x) / dt;
          pr.vy = (cy + Math.sin(a) * r * 0.7 - pr.y) / dt;
        },
      });
    }
    world.effects.burst(o.x, o.y, { count: 18, colors: ['#7a24c0', '#b05af0', '#e0a8ff'], speed: [40, 140], life: [0.2, 0.5] });
    Sound.play('magic', 0.12);
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const k = this.stateTime / this.cfg.windup;
    Telegraph.line(ctx, this.hx, this.hy, this.hx + Math.cos(this.aim) * 160, this.hy + Math.sin(this.aim) * 160, this.cfg.ringRadius * 2, k);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const raised = this.state === 'windup';
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.demonStaff, raised ? (f > 0 ? -1.2 : Math.PI + 1.2) : (f > 0 ? -0.5 : Math.PI + 0.5));
    // the ring of orbs gathering, one by one, turning round the staff's head
    if (raised) {
      const c = this.cfg;
      const o = this.ringAt;
      const k = Math.min(1, this.stateTime / (c.windup * 0.8));
      const n = Math.ceil(c.ringCount * k);
      const img = Sprites.projectiles.magicOrb;
      for (let i = 0; i < n; i++) {
        const a = (i / c.ringCount) * TAU + this.animTime * 2;
        ctx.drawImage(img, Math.round(o.x + Math.cos(a) * c.ringRadius - 5), Math.round(o.y + Math.sin(a) * c.ringRadius * 0.7 - 5));
      }
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, o.x, o.y, 14 + k * 20, FORT_MAGIC, 0.4 + k * 0.4);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/**
 * Elite demon: flies high on great wings, out of melee's reach (shots, burns and blasts still find it). It marks
 * where you stand and dives in with both swords, then fights on the ground - where anything can hit it - before
 * taking off again.
 */
class EliteDemon extends Enemy {
  constructor(x, y) {
    super('eliteDemon', x, y);
    this.anchor = ELITE_ANCHOR;
    this.flying = true;
    this.hw = 12;
    this.hh = 7;
    this.hitOffY = 30;
    this.barOffset = 70;
    this.alt = this.cfg.hover;      // how high it flies (px)
    this.state = 'fly';
    this.diveTimer = rand(...this.cfg.diveEvery);
    this.orbit = rand(0, TAU);
    this.gibColors = [...FORT_DEMON_GIBS, '#46404a'];
  }

  get hy() { return this.y - this.hitOffY - this.alt; }
  /** High enough that a sword or a punch can't reach it. */
  get aloft() { return this.alt > 12; }

  setState(s) {
    super.setState(s === 'chase' ? 'fly' : s);   // (a stun or a confusion ending sends it back to 'chase')
  }

  takeDamage(amount, world) {
    // in the air only shots (and burns, and the far-off reach of other attacks) can touch it
    if (this.aloft && !world.rangedHit && world.actor && dist(world.actor.x, world.actor.y, this.x, this.y) < this.cfg.meleeRange) {
      if (!(this.missShown > world.time)) {
        this.missShown = world.time + 0.4;
        world.effects.text(this.hx, this.hy - 24, 'OUT OF REACH', { color: '#ffb52e', size: 7 });
      }
      return false;
    }
    return super.takeDamage(amount, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.flying = this.aloft || this.state === 'dive';   // on the ground it walks round cover like anyone
    switch (this.state) {
      case 'fly': {
        this.alt = Math.min(c.hover, this.alt + dt * 120);
        if (p.dead) break;
        // circles the hero from up high
        this.orbit += dt * 0.9;
        const tx = p.x + Math.cos(this.orbit) * 150;
        const ty = p.y + Math.sin(this.orbit) * 90;
        this.moveToward(world, tx, ty, this.speed, dt);
        this.faceToward(p.x);
        this.diveTimer -= dt;
        if (this.diveTimer <= 0) {
          const b = world.dungeon.floorBounds;
          this.diveTo = { x: clamp(p.x, b.left + 20, b.right - 20), y: clamp(p.y, b.top + 20, b.bottom - 20) };
          this.setState('mark');
          Sound.play('windup');
        }
        break;
      }
      case 'mark':
        // rears up, swords raised, over the spot it will dive on
        this.alt = c.hover + Math.min(1, this.stateTime / c.diveWindup) * 20;
        this.faceToward(this.diveTo.x);
        if (this.stateTime >= c.diveWindup) { this.diveFrom = { x: this.x, y: this.y, alt: this.alt }; this.setState('dive'); Sound.play('chargeRush', 0.1); }
        break;
      case 'dive': {
        const k = clamp(this.stateTime / c.diveTime, 0, 1);
        const e = k * k;
        this.x = lerp(this.diveFrom.x, this.diveTo.x, e);
        this.y = lerp(this.diveFrom.y, this.diveTo.y, e);
        this.alt = this.diveFrom.alt * (1 - e);
        if (k >= 1) this.land(world);
        break;
      }
      case 'ground':
        this.alt = 0;
        if (!p.dead) {
          const d = this.distanceTo(p);
          if (this.attackCooldown <= 0 && d < c.slashRange) {
            this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
            this.faceToward(p.x);
            this.setState('slash');
            Sound.play('windup');
            break;
          }
          this.moveToward(world, p.x, p.y, this.speed * 0.8, dt);
        }
        if (this.stateTime >= c.groundTime) { this.setState('lift'); Sound.play('birdForm', 0.1); }
        break;
      case 'slash':
        if (this.stateTime >= c.slashWindup) {
          meleeArc(this, world, () => {});
          this.swipeFx(world, '255, 140, 60');
          Sound.play('greatswordSweep', 0.1);
          this.attackCooldown = c.slashCooldown;
          this.setState('ground');
          this.stateTime = c.groundTime * 0.5;   // a slash eats into its time on the ground
        }
        break;
      case 'lift':
        this.alt = c.hover * clamp(this.stateTime / c.liftTime, 0, 1);
        if (this.stateTime >= c.liftTime) { this.setState('fly'); this.diveTimer = rand(...c.diveEvery); }
        break;
    }
  }

  /** It lands on the marked spot, both swords first. */
  land(world) {
    const c = this.cfg;
    this.alt = 0;
    const free = world.dungeon.freePoint(this.x, this.y, this.hw, this.hh);
    this.x = free.x;
    this.y = free.y;
    hitAround(world, this.x, this.y, c.landRadius, c.damage, 200);
    const { x, y } = this;
    world.effects.add(0.4, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, c.landRadius * (0.4 + t * 0.7), c.landRadius * 0.55 * (0.4 + t * 0.7), '#ffb52e', 2, { thick: t < 0.3 ? 3 : 1 });
      ctx.restore();
    }, true);
    world.effects.burst(x, y, { count: 20, colors: ['#ffb52e', '#ff7a1a', '#4a1a18'], speed: [60, 200], life: [0.25, 0.5], up: 40 });
    world.shake(4, 0.2);
    Sound.play('impact', 0.1);
    this.setState('ground');
    this.attackCooldown = 0.4;
  }

  drawGround(ctx) {
    const s = Math.max(0.5, 1 - this.alt / 160);
    drawShadow(ctx, this.x, this.y + 6, 18 * s, 6 * s, 0.35);
    const c = this.cfg;
    if (this.state === 'mark' || this.state === 'dive') {
      const k = this.state === 'mark' ? this.stateTime / c.diveWindup : 1;
      Telegraph.circle(ctx, this.diveTo.x, this.diveTo.y, c.landRadius, k);
    }
    if (this.state === 'slash') Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.attackArcDegrees * DEG, c.attackReach, this.stateTime / c.slashWindup);
  }

  currentFrame() {
    if (this.state === 'slash' || this.state === 'mark') return this.frames.slash[0];
    if (this.aloft || this.state === 'dive') return this.frames.fly[Math.floor(this.animTime * 9) % this.frames.fly.length];
    return this.frames.idle[Math.floor(this.animTime * 2) % 2];
  }

  draw(ctx) {
    const bob = this.aloft ? Math.round(Math.sin(this.animTime * 3) * 3) : 0;
    ctx.save();
    ctx.translate(0, -Math.round(this.alt) + bob);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.restore();
    // a hot haze off its wings while it's up out of reach
    if (this.aloft) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.hy, 26, '255, 90, 40', 0.18 * this.spawnAlpha);
      ctx.restore();
    }
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    ctx.save();
    ctx.translate(0, -Math.round(this.alt));
    super.drawHealthBar(ctx);
    ctx.restore();
  }
}

/** Magma den: never moves; every few seconds its mouth glows and lets out three magma bats or three magma slimes. */
class MagmaDen extends Enemy {
  constructor(x, y) {
    super('magmaDen', x, y);
    this.anchor = DEN_ANCHOR;
    this.hw = 24;
    this.hh = 12;
    this.hitOffY = 16;
    this.barOffset = 48;
    this.summonTimer = this.cfg.summonEvery * rand(0.35, 0.6);
    this.gibColors = [...FORT_ROCK_GIBS, '#ff7a1a'];
  }

  think(dt, world) {
    const c = this.cfg;
    if (this.state === 'open') {
      if (this.stateTime >= c.openTime) { this.letOut(world); this.setState('chase'); }
      return;
    }
    this.summonTimer -= dt;
    if (this.summonTimer > 0) return;
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    const room = Math.min(c.summonMax - alive, world.summonRoom(this));
    if (room <= 0) { this.summonTimer = 2; return; }
    this.summonTimer = c.summonEvery;
    this.calling = Math.random() < c.batChance ? 'magmaBat' : 'magmaSlime';
    this.callCount = Math.min(3, room);
    this.setState('open');
    Sound.play('graveRumble', 0.12);
  }

  letOut(world) {
    for (let i = 0; i < this.callCount; i++) {
      const a = Math.PI / 2 + (i - 1) * 0.8;
      world.summon(this, this.calling, this.x + Math.cos(a) * 44, this.y + Math.sin(a) * 30 + 4);
    }
    world.effects.burst(this.x, this.y - 6, { count: 30, colors: FORT_LAVA_GIBS, speed: [60, 200], life: [0.3, 0.7], up: 70 });
    world.effects.smoke(this.x, this.y - 10, { count: 6, radius: 18, life: 0.8, rise: 30, colors: ['#2a1a18', '#4a3430', '#6a5048'] });
    world.shake(3, 0.2);
    Sound.play('fireImpact', 0.12);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 4, 30, 8, 0.35);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const open = this.state === 'open' ? clamp(this.stateTime / this.cfg.openTime, 0, 1) : 0;
    PFX.glow(ctx, this.x, this.y, 40 + open * 20, FORT_LAVA, 0.2 + open * 0.3, 2, 18);
    ctx.restore();
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // the mouth's glow, flaring as something comes up out of it
    const open = this.state === 'open' ? clamp(this.stateTime / this.cfg.openTime, 0, 1) : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 4, 12 + open * 14, FORT_LAVA, 0.4 + open * 0.6 + Math.sin(this.animTime * 4) * 0.08);
    ctx.restore();
    if (open > 0) {
      ctx.globalAlpha = this.spawnAlpha;
      for (let i = 0; i < 3; i++) PFX.flame(ctx, this.x - 6 + i * 6, this.y - 2, 6, 8 + open * 14, this.animTime * 9 + i, FORT_FIRE);
      ctx.globalAlpha = 1;
    }
    this.drawHealthBar(ctx);
  }
}

/** Meteorite crab: armoured in a meteorite; raises its claws and calls a meteor down on you that leaves the ground burning. */
class MeteorCrab extends Enemy {
  constructor(x, y) {
    super('meteorCrab', x, y);
    this.anchor = CRAB_ANCHOR;
    this.hw = 18;
    this.hh = 8;
    this.hitOffY = 16;
    this.barOffset = 46;
    this.meteorTimer = this.cfg.meteorEvery * rand(0.4, 0.8);
    this.gibColors = [...FORT_ROCK_GIBS, '#a84420'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    if (this.state === 'cast') {
      if (this.stateTime >= c.castTime) { this.setState('chase'); this.callMeteor(world, p); }
      return;
    }
    kite(this, world, p, dt);
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) { this.meteorTimer = c.meteorEvery + rand(0, 1); this.setState('cast'); Sound.play('burstCharge', 0.12); }
  }

  /** A meteor falls where the hero stands: its shadow grows, then it crashes and leaves the ground burning. */
  callMeteor(world, p) {
    const c = this.cfg;
    const b = world.dungeon.floorBounds;
    const at = { x: clamp(p.x, b.left + 10, b.right - 10), y: clamp(p.y, b.top + 10, b.bottom - 10) };
    const damage = c.damage;
    const fall = c.fallTime;
    const img = Sprites.projectiles.meteor;
    world.effects.add(fall, (ctx, t) => {
      Telegraph.circle(ctx, at.x, at.y, c.meteorRadius, t, '255, 120, 40');
      drawShadow(ctx, at.x, at.y, 8 + t * c.meteorRadius * 0.6, 3 + t * c.meteorRadius * 0.3, 0.2 + t * 0.3);
    }, true);
    world.effects.add(fall, (ctx, t) => {
      // the meteor streaking down out of the sky, trailing fire
      const k = t * t;
      const x = at.x + (1 - k) * 160;
      const y = at.y - (1 - k) * 420;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, 30, FORT_LAVA, 0.7 * t);
      ctx.restore();
      for (let i = 1; i < 5; i++) PFX.flame(ctx, x + i * 8, y - i * 20, 14 - i * 2, 22 - i * 3, t * 20 + i, FORT_FIRE);
      drawRotated(ctx, img, x, y, img.width / 2, img.height / 2, t * 8);
    });
    const stage = world.run ? world.run.stage : 0;
    world.after(fall, () => {
      if (world.run && world.run.stage !== stage) return;
      for (const a of world.allies) {
        if (dist(a.x, a.y, at.x, at.y) >= c.meteorRadius + a.radius) continue;
        if (a.hurt(damage, world, at.x, at.y)) {
          setAlight(world, a, c);
          a.knockback?.(angleTo(at.x, at.y, a.x, a.y), 220);
        }
      }
      firePatch(world, at.x, at.y, c.meteorRadius * 0.8, c.fireTime, c);
      enemyBlastFx(world, at.x, at.y, c.meteorRadius);
      world.effects.burst(at.x, at.y - 6, { count: 20, colors: FORT_ROCK_GIBS, speed: [80, 240], life: [0.3, 0.7], gravity: 320, up: 120, size: [2, 5] });
    });
    Sound.play('fireballCast', 0.12);
  }

  currentFrame() {
    if (this.state === 'cast') return this.frames.cast[0];
    if (this.moving) return this.frames.walk[Math.floor(this.animTime * 8) % 4];
    return this.frames.idle[Math.floor(this.animTime * 2) % 2];
  }

  draw(ctx) {
    super.draw(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x + this.facing * 2, this.y - 26, this.state === 'cast' ? 20 : 10, FORT_LAVA, (this.state === 'cast' ? 0.6 : 0.3) * this.spawnAlpha);
    ctx.restore();
  }
}

/** The look of a fiery blast with no damage of its own (the crash of a meteor, the burst of a fireball). */
function enemyBlastFx(world, x, y, r) {
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
  world.effects.flames(x, y, { count: 6, spread: r * 0.45, height: 26, width: 12, life: 0.55, colors: FIRE_COLORS });
  world.effects.smoke(x, y - 14, { count: 8, radius: r * 0.45, life: 0.9, rise: 30 });
  world.shake(5, 0.2);
  Sound.play('explosion');
}

/** Wildfire: living fire that rushes at you (touching it sets you on fire), leaving burning ground behind it. */
class Wildfire extends Enemy {
  constructor(x, y) {
    super('wildfire', x, y);
    this.anchor = WILDFIRE_ANCHOR;
    this.hitOffY = 14;
    this.barOffset = 44;
    this.trailTimer = 0;
    this.gibColors = FORT_LAVA_GIBS;
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
    this.trailTimer -= dt;
    if (this.trailTimer <= 0 && this.moving) {
      this.trailTimer = c.trailEvery;
      firePatch(world, this.x, this.y + 2, c.trailRadius, c.trailLife, c, 3);
    }
  }

  onContact(a, world) { setAlight(world, a, this.cfg); }

  drawGround(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y, 30, '255, 110, 30', 0.35 * this.spawnAlpha, 2, 14);
    ctx.restore();
  }

  draw(ctx) {
    // a living tongue of fire: tall flames leaning back from where it rushes, a fierce little face in the middle
    const t = this.animTime;
    const lean = this.moving ? -this.facing * 4 : 0;
    ctx.globalAlpha = this.spawnAlpha;
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 5;
      PFX.flame(ctx, this.x + dx + lean * 0.5, this.y + 2, 11 - Math.abs(i - 2) * 2, 26 + (2 - Math.abs(i - 2)) * 10, t * 10 + i * 1.3, FORT_FIRE);
    }
    const fx = Math.round(this.x + this.facing * 2);
    const fy = Math.round(this.y - 14);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(fx - 5, fy, 3, 3);
    ctx.fillRect(fx + 2, fy, 3, 3);
    ctx.fillRect(fx - 2, fy + 5, 5, 1);
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(fx - 4, fy, 1, 1);
    ctx.fillRect(fx + 3, fy, 1, 1);
    if (this.flashTime > 0) {
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.y - 14, 18, '255, 255, 255', 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Blazing turret: never moves; aims, then pours fireballs at you for two seconds, each setting you on fire. */
class BlazingTurret extends Enemy {
  constructor(x, y) {
    super('blazingTurret', x, y);
    this.hw = 18;
    this.hh = 10;
    this.hitOffY = 22;
    this.barOffset = 52;
    this.aim = 0;
    this.attackCooldown = this.cfg.cooldown * rand(0.4, 0.8);
    this.gibColors = ['#361214', '#46404a', '#ff7a1a'];
  }

  get mouth() { return { x: this.x, y: this.y - 14 }; }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    const m = this.mouth;
    switch (this.state) {
      case 'chase':
        this.aim = angleTo(m.x, m.y, p.hx, p.hy);
        if (this.attackCooldown <= 0 && dist(m.x, m.y, p.x, p.y) < c.range) { this.setState('windup'); Sound.play('fireballCast', 0.1); }
        break;
      case 'windup':
        this.aim = angleTo(m.x, m.y, p.hx, p.hy);
        if (this.stateTime >= c.windup) { this.setState('burst'); this.shotTimer = 0; }
        break;
      case 'burst':
        // it follows the hero as it pours, its aim wobbling
        this.aim += clamp(angleDiff(angleTo(m.x, m.y, p.hx, p.hy), this.aim), -1.6 * dt, 1.6 * dt);
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this.shotTimer += c.fireEvery;
          const a = this.aim + rand(-0.5, 0.5) * c.spreadDegrees * DEG;
          fireShot(world, m.x + Math.cos(a) * 10, m.y + Math.sin(a) * 8, a, c.fireSpeed, c, { radius: 5, damage: c.damage, sprite: Sprites.projectiles.fireballSmall, spin: 10 });
          if (Math.random() < 0.5) Sound.play('bossFireball', 0.06);
        }
        if (this.stateTime >= c.burstTime) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 8, 22, 7, 0.35);
    if (this.state === 'windup') Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(this.aim) * 200, this.y + Math.sin(this.aim) * 200, 16, this.stateTime / this.cfg.windup, Telegraph.orange);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha, false);
    const m = this.mouth;
    const hot = this.state === 'burst' ? 1 : this.state === 'windup' ? this.stateTime / this.cfg.windup : 0.2;
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, m.x, m.y + 4, 12 + hot * 16, FORT_LAVA, 0.4 + hot * 0.5);
    ctx.restore();
    if (hot > 0.5) {
      ctx.globalAlpha = this.spawnAlpha;
      PFX.flame(ctx, m.x + Math.cos(this.aim) * 10, m.y + 6 + Math.sin(this.aim) * 6, 10, 14, this.animTime * 14, FORT_FIRE);
      ctx.globalAlpha = 1;
    }
    this.drawHealthBar(ctx);
  }
}

/** Molten knight: old royal armour dripping lava; its sword, and even touching it, set you on fire. */
class MoltenKnight extends Enemy {
  constructor(x, y) {
    super('moltenKnight', x, y);
    this.gibColors = ['#2e2a32', '#66606a', '#ff7a1a'];
  }

  think(dt, world) {
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
          meleeArc(this, world, (a) => setAlight(world, a, c));
          this.swipeFx(world, '255, 130, 40');
          Sound.play('swordSwing');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
    // lava dripping off it as it goes (visual only)
    if (vrand(0, 1) < dt * 3) world.effects.burst(this.x + vrand(-8, 8), this.y - vrand(4, 24), { count: 1, colors: FORT_LAVA_GIBS, speed: [0, 10], life: [0.3, 0.5], gravity: 300, size: [2, 2] });
  }

  onContact(a, world) { setAlight(world, a, this.cfg); }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    // the crest of fire on its helm
    ctx.globalAlpha = this.spawnAlpha;
    for (let i = 0; i < 3; i++) PFX.flame(ctx, this.x - f * (2 + i * 4), this.y - 44 + i * 2, 6, 12 - i * 2, this.animTime * 9 + i * 1.7, FORT_FIRE);
    const swing = this.state === 'windup' ? -1.3 : this.state === 'recover' ? 0.9 : -0.4;
    holdWeapon(ctx, this, Sprites.weapons.moltenSword, (f > 0 ? 0 : Math.PI) + swing * f);
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/**
 * Molten elemental: a body of lava under plates of black rock, its fists floating beside it, always standing in its
 * own pool of lava. Pours waves of lava along the ground at you and shoots beams of lava.
 */
class MoltenElemental extends Enemy {
  constructor(x, y) {
    super('moltenElemental', x, y);
    this.anchor = ELEMENTAL_ANCHOR;
    this.hw = 18;
    this.hh = 9;
    this.hitOffY = 40;
    this.barOffset = 96;
    this.aim = 0;
    this.beamTimer = this.cfg.beamEvery * rand(0.4, 0.8);
    this.waveTimer = this.cfg.waveEvery * rand(0.5, 0.9);
    this.auraTick = 0;
    this.wave = null;   // a wave of lava on its way: { x, y, angle, d, laid, hit }
    this.gibColors = [...FORT_ROCK_GIBS, '#ff7a1a', '#ffb52e'];
  }

  update(dt, world) {
    super.update(dt, world);
    if (this.state === 'beam') this.aimEnd = world.dungeon.raycast(this.hx, this.hy, this.aim, 700);
    this.updateWave(dt, world);
    // its pool of lava sears whoever steps in it
    this.auraTick -= dt;
    if (this.auraTick <= 0 && !this.dead) {
      this.auraTick = CONFIG.run.lava.every;
      for (const a of world.heroes) if (!a.dead && dist(a.x, a.y, this.x, this.y) < this.cfg.auraRadius + a.radius * 0.4) searLava(world, a);
    }
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.beamTimer -= dt;
        this.waveTimer -= dt;
        if (this.waveTimer <= 0 && !this.wave) {
          this.waveTimer = c.waveEvery + rand(0, 1.5);
          this.aim = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          this.setState('pour');
          Sound.play('graveRumble', 0.12);
        } else if (this.beamTimer <= 0) {
          this.beamTimer = c.beamEvery + rand(0, 1);
          this.setState('beam');
          Sound.play('laserCharge', 0.12);
        }
        break;
      case 'beam':
        if (this.stateTime < c.beamWindup - c.aimLockAt) { this.aim = angleTo(this.hx, this.hy, p.hx, p.hy); this.faceToward(p.x); }
        if (this.stateTime >= c.beamWindup) {
          const end = world.dungeon.raycast(this.hx, this.hy, this.aim, 700);
          const barrier = world.barrierOnSegment?.(this.hx, this.hy, end.x, end.y);
          if (barrier) barrier.absorb(c.damage, world, barrier.x, barrier.hy);
          else hitLine(world, this.hx, this.hy, end.x, end.y, c.beamWidth, c.damage, (a) => searLava(world, a));
          lavaBeamFx(world, this.hx, this.hy, end.x, end.y, c.beamWidth, c.beamTime);
          Sound.play('laser', 0.12);
          this.setState('recover');
        }
        break;
      case 'pour':
        if (this.stateTime < c.waveWindup * 0.6) { this.aim = angleTo(this.x, this.y, p.x, p.y); this.faceToward(p.x); }
        if (this.stateTime >= c.waveWindup) {
          this.wave = { x: this.x, y: this.y, angle: this.aim, d: 30, laid: 0, hit: new Set() };
          world.shake(3, 0.2);
          Sound.play('splash', 0.12);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.6) this.setState('chase');
        break;
    }
  }

  /** The wave of lava rolls out along the ground, hurting whoever it reaches and leaving lava behind it. */
  updateWave(dt, world) {
    const w = this.wave;
    if (!w) return;
    const c = this.cfg;
    w.d += c.waveSpeed * dt;
    const fx = w.x + Math.cos(w.angle) * w.d;
    const fy = w.y + Math.sin(w.angle) * w.d;
    if (w.d >= c.waveReach || world.dungeon.isSolidAt(fx, fy)) { this.wave = null; return; }
    for (const a of world.allies) {
      if (w.hit.has(a) || dist(a.x, a.y, fx, fy) > c.waveWidth / 2 + a.radius) continue;
      w.hit.add(a);
      if (a.hurt(c.damage, world, fx, fy)) searLava(world, a);
    }
    // lava left in its wake
    const step = c.waveWidth * 0.55;
    while (w.laid * step + 30 < w.d) {
      const d = w.laid * step + 30;
      lavaPool(world, w.x + Math.cos(w.angle) * d, w.y + Math.sin(w.angle) * d, c.waveWidth * 0.42, c.waveLife);
      w.laid++;
    }
    if (vrand(0, 1) < 0.7) world.effects.burst(fx, fy - 6, { count: 2, colors: FORT_LAVA_GIBS, speed: [30, 90], life: [0.2, 0.4], up: 60, gravity: 300 });
  }

  /** Where its fists float (beside it, bobbing; drawn forward and down while it pours, raised for a beam). */
  fistAt(side) {
    const t = this.animTime;
    let dx = side * 50;
    let dy = -34 + Math.sin(t * 2 + side) * 4;
    if (this.state === 'pour') { dx = side * 40 + this.facing * 14; dy = -20 + Math.min(1, this.stateTime / 0.5) * 12; }
    if (this.state === 'beam') dy -= 10;
    return { x: this.x + dx, y: this.y + dy };
  }

  drawGround(ctx) {
    // its pool of lava, always round its base
    drawLavaDisc(ctx, this.x, this.y + 2, this.cfg.auraRadius, this.spawnAlpha, this.animTime, 1.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y, this.cfg.auraRadius * 1.4, FORT_LAVA, 0.3 * this.spawnAlpha, 2, this.cfg.auraRadius * 0.7);
    ctx.restore();
    const c = this.cfg;
    if (this.state === 'beam') {
      const end = this.aimEnd || { x: this.hx, y: this.hy };
      Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, c.beamWidth, this.stateTime / c.beamWindup);
    }
    if (this.state === 'pour') {
      Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(this.aim) * c.waveReach, this.y + Math.sin(this.aim) * c.waveReach, c.waveWidth, this.stateTime / c.waveWindup, Telegraph.orange);
    }
    if (this.wave) {
      // the front of the wave: a cresting swell of lava
      const w = this.wave;
      const fx = w.x + Math.cos(w.angle) * w.d;
      const fy = w.y + Math.sin(w.angle) * w.d;
      drawLavaDisc(ctx, fx, fy, c.waveWidth * 0.55, 1, this.animTime * 2, 2.1);
    }
  }

  draw(ctx) {
    const f = this.frames.idle[Math.floor(this.animTime * 2) % 2];
    // the far fist, the body, then the near fist
    const fist = (side) => {
      const at = this.fistAt(side);
      const img = side === this.facing ? Sprites.fortress.fistMolten : Sprites.fortress.fist;
      ctx.save();
      ctx.globalAlpha = this.spawnAlpha;
      drawSprite(ctx, img, at.x, at.y, img.width / 2, img.height / 2, side < 0);
      ctx.restore();
      // a stream of lava from the shoulder to the fist
      ctx.save();
      ctx.globalAlpha = this.spawnAlpha * 0.9;
      PFX.line(ctx, this.x + side * 22, this.y - 44, at.x - side * 10, at.y - 8, '#ff7a1a', 3);
      PFX.line(ctx, this.x + side * 22, this.y - 44, at.x - side * 10, at.y - 8, '#ffd34a', 1);
      ctx.restore();
    };
    fist(-this.facing);
    this.drawFrame(ctx, f, this.anchor, this.spawnAlpha);
    fist(this.facing);
    // the eye blazing (brighter while it charges a beam) and rock shards floating round it
    const charge = this.state === 'beam' ? this.stateTime / this.cfg.beamWindup : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 55, 12 + charge * 14, '255, 200, 90', (0.5 + charge * 0.5) * this.spawnAlpha);
    ctx.restore();
    ctx.fillStyle = '#2c2426';
    for (let i = 0; i < 4; i++) {
      const a = this.animTime * 0.8 + i * 1.6;
      ctx.fillRect(Math.round(this.x + Math.cos(a) * 44), Math.round(this.y - 60 + Math.sin(a * 1.3) * 18), 4, 3);
    }
    this.drawHealthBar(ctx);
  }
}

/** Blazing baby dragon: flies over walls and cover alike; spits massive fireballs that burst into lava, and charges you down. */
class BabyDragon extends Enemy {
  constructor(x, y) {
    super('babyDragon', x, y);
    this.anchor = DRAGON_ANCHOR;
    this.flying = true;
    this.hw = 14;
    this.hh = 8;
    this.hitOffY = 44;
    this.barOffset = 82;
    this.aim = 0;
    this.fireTimer = this.cfg.fireEvery * rand(0.4, 0.8);
    this.chargeTimer = this.cfg.chargeEvery * rand(0.6, 1);
    this.gibColors = ['#a02a10', '#f07a2a', '#dcb050'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.fireTimer -= dt;
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0 && this.distanceTo(p) < c.chargeDistance) {
          this.chargeTimer = c.chargeEvery + rand(0, 1.5);
          this.aim = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          this.setState('chargeWindup');
          Sound.play('windup');
        } else if (this.fireTimer <= 0) {
          this.fireTimer = c.fireEvery + rand(0, 0.8);
          this.setState('breathe');
          Sound.play('fireballCast', 0.1);
        }
        break;
      case 'breathe':
        this.aim = angleTo(this.hx, this.hy, p.x, p.y);
        this.faceToward(p.x);
        if (this.stateTime >= c.fireWindup) { this.spit(world, p); this.setState('recover'); }
        break;
      case 'chargeWindup':
        if (this.stateTime < c.chargeWindup * 0.6) { this.aim = angleTo(this.x, this.y, p.x, p.y); this.faceToward(p.x); }
        if (this.stateTime >= c.chargeWindup) { this.setState('charge'); this.chargeHit = new Set(); this.charged = 0; Sound.play('chargeRush', 0.12); }
        break;
      case 'charge': {
        const x0 = this.x;
        const y0 = this.y;
        this.moveAngle(world, this.aim, c.chargeSpeed, dt);
        const moved = dist(x0, y0, this.x, this.y);
        this.charged += moved;
        for (const a of world.allies) {
          if (this.chargeHit.has(a) || dist(a.x, a.y, this.x, this.y) > c.chargeWidth / 2 + a.radius) continue;
          this.chargeHit.add(a);
          if (a.hurt(stageDamage(world, c.chargeDamage), world, this.x, this.y)) { setAlight(world, a, c); a.knockback?.(this.aim, 260); }
        }
        if (vrand(0, 1) < 0.6) world.effects.flames(this.x - Math.cos(this.aim) * 14, this.y - 30, { count: 1, height: 16, width: 10, life: 0.35, colors: FIRE_COLORS });
        if (this.charged >= c.chargeDistance || moved < c.chargeSpeed * dt * 0.3) this.setState('recover');
        break;
      }
      case 'recover':
        if (this.stateTime >= 0.6) this.setState('chase');
        break;
    }
  }

  /** A massive fireball at where the hero stands: it bursts there (or on a wall) into a pool of lava. */
  spit(world, p) {
    const c = this.cfg;
    const mx = this.x + this.facing * 20;
    const my = this.y - 34;
    const a = angleTo(mx, my, p.x, p.y);
    const life = Math.min(3, dist(mx, my, p.x, p.y) / c.fireSpeed);
    const burst = (w, x, y) => {
      hitAround(w, x, y, c.blastRadius, c.damage);
      enemyBlastFx(w, x, y, c.blastRadius);
      const pt = w.dungeon.freePoint ? w.dungeon.freePoint(x, y, 4, 4) : { x, y };
      lavaPool(w, pt.x, pt.y, c.poolRadius, c.poolTime);
    };
    enemyShot(world, mx, my, a, c.fireSpeed, {
      radius: 12, damage: 0, life, sprite: Sprites.projectiles.fireballBig, spin: 6, glow: FORT_LAVA, trail: ['#ffd34a', '#ff8a1e', '#e0461e'],
      onHit: (pr, w) => burst(w, pr.x, pr.y),
    });
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 6, 18, 6, 0.3);
    const c = this.cfg;
    if (this.state === 'chargeWindup') Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(this.aim) * c.chargeDistance, this.y + Math.sin(this.aim) * c.chargeDistance, c.chargeWidth, this.stateTime / c.chargeWindup);
  }

  currentFrame() {
    const list = this.state === 'breathe' ? this.frames.open : this.frames.idle;
    return list[Math.floor(this.animTime * (this.state === 'charge' ? 12 : 6)) % list.length];
  }

  draw(ctx) {
    const bob = Math.round(Math.sin(this.animTime * 3) * 3);
    ctx.save();
    ctx.translate(0, -22 + bob);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (this.state === 'breathe') {
      // fire gathering in its jaws
      const k = this.stateTime / this.cfg.fireWindup;
      const mx = this.x + this.facing * 22;
      const my = this.y - 25;
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, mx, my, 8 + k * 16, FORT_LAVA, 0.5 + k * 0.5);
      ctx.globalCompositeOperation = 'source-over';
      PFX.flame(ctx, mx, my, 6 + k * 4, 8 + k * 6, this.animTime * 12, FORT_FIRE);
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
