// Ancient Ruins enemies (dungeon runs): the temple's rock and clay guardians, woken by the
// magic lingering in the air. Bodies are drawn in js/gfx/enemies/ruins.js; weapons, the
// turret's head, the floating heads and guns, and the magic itself are drawn here. Uses the
// graveyard's and castle's helpers (kite, enemyShot, hitAround, groundZone, holdWeapon).

const RUIN_ROCK_GIBS = ['#5c6558', '#a0a892', '#2e342d'];
const RUIN_CLAY_GIBS = ['#a95f30', '#e3a066', '#5e3018'];
const RUIN_MAGIC_FX = ['#5cf0d8', '#b8fff0', '#22b8a6'];

/** Hurts every ally within `width / 2` of the segment (x1, y1)-(x2, y2); returns those hit. */
function hitLine(world, x1, y1, x2, y2, width, damage, onHit = null) {
  const hit = [];
  for (const a of world.allies) {
    if (pointSegmentDistance(a.hx ?? a.x, a.hy ?? a.y, x1, y1, x2, y2) > width / 2 + a.radius) continue;
    if (a.hurt(damage, world, x1, y1, { projectile: true })) { hit.push(a); onHit?.(a); }
  }
  return hit;
}

/** A beam of magic flashing along a line (visual only): a white core inside teal light, fading. */
function magicBeamFx(world, x1, y1, x2, y2, width, life = 0.25) {
  const angle = angleTo(x1, y1, x2, y2);
  const len = dist(x1, y1, x2, y2);
  world.effects.add(life, (ctx, t) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - t;
    PFX.beam(ctx, x1, y1, angle, len, width * (1.4 - t * 0.6), ['#127068', '#22b8a6', '#5cf0d8', '#ffffff'], 2, false);
    PFX.glow(ctx, x2, y2, 14, RUIN_MAGIC, 0.8 * (1 - t));
    ctx.restore();
  });
  world.effects.burst(x2, y2, { count: 8, colors: RUIN_MAGIC_FX, speed: [40, 140], life: [0.15, 0.35] });
}

/** Rock rising out of the ground at (x, y) (visual only): a cluster of jagged spikes that shoot up, hold, then sink. */
function rockSpikeFx(world, x, y, h = 26) {
  world.effects.add(0.8, (ctx, t) => {
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - t);
    PFX.disc(ctx, x, y, 16, 7, '#1c201c', 1);
    ctx.restore();
  }, true);
  world.effects.add(0.7, (ctx, t) => {
    const up = Math.min(1, t * 6) * (1 - Math.max(0, t - 0.6) * 2.5);
    if (up <= 0) return;
    for (const [dx, k] of [[-7, 0.6], [6, 0.7], [0, 1]]) {
      const hh = Math.round(h * k * up);
      const bx = Math.round(x + dx);
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(bx - 6, y + 1); ctx.lineTo(bx, y - hh - 1); ctx.lineTo(bx + 6, y + 1); ctx.fill();
      ctx.fillStyle = '#5c6558';
      ctx.beginPath(); ctx.moveTo(bx - 5, y); ctx.lineTo(bx, y - hh); ctx.lineTo(bx + 5, y); ctx.fill();
      ctx.fillStyle = '#a0a892';
      ctx.beginPath(); ctx.moveTo(bx - 5, y); ctx.lineTo(bx, y - hh); ctx.lineTo(bx - 1, y); ctx.fill();
    }
  });
  world.effects.burst(x, y - 4, { count: 8, colors: RUIN_ROCK_GIBS, speed: [40, 120], life: [0.2, 0.45], up: 60 });
}

// ---------------------------------------------------------------

/** Rockmite: a little rock golem; keeps back and throws small rocks. */
class Rockmite extends Enemy {
  constructor(x, y) {
    super('rockmite', x, y);
    this.aim = 0;
    this.gibColors = RUIN_ROCK_GIBS;
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 100) this.setState('windup');
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy - 8, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.windup) {
          enemyShot(world, this.hx + Math.cos(this.aim) * 10, this.hy - 8 + Math.sin(this.aim) * 10, this.aim, c.rockSpeed, {
            radius: 5, damage: c.damage, sprite: Sprites.projectiles.pebble, spin: 12, trail: ['#7a6648', '#5c6558'],
          });
          Sound.play('dagger', 0.1);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.35) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.5); }
        break;
    }
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.throw[0];
    return super.currentFrame();
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const k = this.stateTime / this.cfg.windup;
    Telegraph.line(ctx, this.hx, this.hy, this.hx + Math.cos(this.aim) * 90, this.hy + Math.sin(this.aim) * 90, 5, k);
  }
}

/** Rock disc: a floating stone ring with magic at its core; aims a line that locks, then fires a laser. */
class RockDisc extends Enemy {
  constructor(x, y) {
    super('rockDisc', x, y);
    this.flying = true;
    this.hitOffY = 26;
    this.barOffset = 58;
    this.aim = 0;
    this.gibColors = [...RUIN_ROCK_GIBS, '#5cf0d8'];
  }

  update(dt, world) {
    super.update(dt, world);
    if (this.state === 'windup') this.aimEnd = world.dungeon.raycast(this.hx, this.hy, this.aim, 800);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 140) { this.setState('windup'); Sound.play('laserCharge', 0.15); }
        break;
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt) { this.aim = angleTo(this.hx, this.hy, p.hx, p.hy); this.faceToward(p.x); }
        if (this.stateTime >= c.windup) {
          const end = world.dungeon.raycast(this.hx, this.hy, this.aim, 800);
          const barrier = world.barrierOnSegment?.(this.hx, this.hy, end.x, end.y);
          if (barrier) barrier.absorb(c.damage, world, barrier.x, barrier.hy);
          else hitLine(world, this.hx, this.hy, end.x, end.y, c.beamWidth, c.damage);
          magicBeamFx(world, this.hx, this.hy, end.x, end.y, c.beamWidth, c.beamTime);
          Sound.play('laser', 0.15);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.4) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = this.aimEnd || { x: this.hx, y: this.hy };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, this.cfg.beamWidth, this.stateTime / this.cfg.windup);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 6, 10, 4, 0.25);
    this.drawTelegraph(ctx);
  }

  draw(ctx) {
    const f = this.frames.idle[0];
    const bob = Math.round(Math.sin(this.animTime * 2.4) * 2);
    const cy = this.y - 26 + bob;
    const charge = this.state === 'windup' ? this.stateTime / this.cfg.windup : 0;
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    drawRotated(ctx, f.img, this.x, cy, 20, 20, this.animTime * (1.2 + charge * 6));
    if (this.flashTime > 0) drawRotated(ctx, f.flash, this.x, cy, 20, 20, this.animTime * 1.2);
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, cy, 10 + charge * 10, RUIN_MAGIC, 0.5 + charge * 0.5);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Clay guard: its clay shield soaks the first hit it takes, then crumbles. Thrusts its spear down a lane. */
class ClayGuard extends Enemy {
  constructor(x, y) {
    super('clayGuard', x, y);
    this.shield = true;
    this.attackAngle = 0;
    this.gibColors = RUIN_CLAY_GIBS;
  }

  takeDamage(amount, world) {
    if (this.shield && !this.dead) {
      this.shield = false;
      this.frames = Sprites.enemies.clayGuardBroken;
      this.flashTime = 0.1;
      world.effects.text(this.hx, this.hy - 30, 'SHIELD BROKEN', { color: '#e3a066', size: 7 });
      world.effects.burst(this.x - this.facing * 8, this.hy, { count: 14, colors: RUIN_CLAY_GIBS, speed: [60, 180], life: [0.25, 0.5], size: [2, 4] });
      Sound.play('partBreak', 0.15);
      return true;
    }
    return super.takeDamage(amount, world);
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
          const x2 = this.x + Math.cos(this.attackAngle) * c.thrustReach;
          const y2 = this.y + Math.sin(this.attackAngle) * c.thrustReach;
          for (const a of world.allies) {
            if (pointSegmentDistance(a.x, a.y, this.x, this.y, x2, y2) <= c.thrustWidth / 2 + a.radius) a.hurt(c.damage, world, this.x, this.y);
          }
          world.effects.burst(x2, y2 - 10, { count: 6, colors: ['#ffffff', '#e3a066'], speed: [40, 120], life: [0.12, 0.3], angle: this.attackAngle, spread: 0.8 });
          Sound.play('slash');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    const a = this.attackAngle;
    Telegraph.line(ctx, this.x, this.y, this.x + Math.cos(a) * c.thrustReach, this.y + Math.sin(a) * c.thrustReach, c.thrustWidth, this.stateTime / c.windup);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    if (this.shield) {
      // the shield's glyph glows while it holds, so it's plain it will soak a hit
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x - f * 12, this.y - 16, 12, RUIN_MAGIC, (0.35 + Math.sin(this.animTime * 4) * 0.1) * this.spawnAlpha);
      ctx.restore();
    }
    // the spear: held upright at rest; drawn back in the windup, then thrust out along the lane
    let a = f > 0 ? -1.1 : Math.PI + 1.1;
    let reach = 0;
    if (this.state === 'windup') { a = this.attackAngle; reach = -6 * Math.min(1, this.stateTime / 0.2); }
    else if (this.state === 'recover') { a = this.attackAngle; reach = this.stateTime < 0.15 ? 18 : 18 * Math.max(0, 1 - (this.stateTime - 0.15) / 0.3); }
    ctx.globalAlpha = this.spawnAlpha;
    const w = Sprites.weapons.claySpear;
    drawRotated(ctx, w.img, this.x + f * 6 + Math.cos(a) * reach, this.hy + 4 + Math.sin(a) * reach * 0.7, w.pivotX, w.pivotY, a, Math.cos(a) < 0);
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Clay slime: a dollop of living clay. Comes in threes; leaps onto you; splits into three little ones. */
class ClaySlime extends Slime {
  constructor(x, y, type = 'claySlime') {
    super(x, y, type);
    this.small = type === 'claySlimeTiny';
    const a = this.small ? SLIME_CLAY_TINY : SLIME_CLAY;
    this.anchor = { x: a.ax, y: a.ay };
    this.hitOffY = this.small ? 5 : 10;
    this.hw = this.small ? 7 : 12;
    this.hh = this.small ? 4 : 6;
    this.barOffset = this.small ? 20 : 32;
    this.gibColors = RUIN_CLAY_GIBS;
  }

  onDeath(world) {
    if (!this.cfg.splitCount) return;
    Sound.play('slimeSplit');
    for (let i = 0; i < this.cfg.splitCount; i++) {
      const a = (i / this.cfg.splitCount) * TAU + rand(-0.3, 0.3);
      const s = new ClaySlime(this.x + Math.cos(a) * 8, this.y + Math.sin(a) * 8, 'claySlimeTiny');
      s.knockback(a, 240);
      s.attackCooldown = rand(0.8, 1.4);
      world.addEnemy(s);
    }
  }
}

/** Clay bud golem: a small clay golem that walks up to you and slams the ground all round it. */
class ClayBud extends Enemy {
  constructor(x, y) {
    super('clayBud', x, y);
    this.gibColors = [...RUIN_CLAY_GIBS, '#e86a8a'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.slamRange && this.attackCooldown <= 0) {
          this.setState('windup');
          Sound.play('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= c.windup) {
          hitAround(world, this.x, this.y, c.slamRadius, c.damage, 120);
          const { x, y } = this;
          const r = c.slamRadius;
          world.effects.add(0.4, (ctx, t) => {
            ctx.save();
            ctx.globalAlpha = 1 - t;
            PFX.ring(ctx, x, y, r * (0.4 + t * 0.6), r * 0.55 * (0.4 + t * 0.6), '#e3a066', 2, { thick: t < 0.3 ? 3 : 1 });
            ctx.restore();
          });
          world.effects.burst(x, y, { count: 16, colors: RUIN_CLAY_GIBS, speed: [60, 180], life: [0.25, 0.5], up: 40 });
          world.shake(3, 0.15);
          Sound.play('stomp', 0.15);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.smash[0];
    return super.currentFrame();
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    Telegraph.circle(ctx, this.x, this.y, this.cfg.slamRadius, this.stateTime / this.cfg.windup);
  }
}

/** Rock shell: a crab in a spiked rock shell (armoured). Rock spikes burst up in a line right across the room. */
class RockShell extends Enemy {
  constructor(x, y) {
    super('rockShell', x, y);
    this.anchor = SHELL_ANCHOR;
    this.hw = 18;
    this.hh = 8;
    this.hitOffY = 14;
    this.barOffset = 44;
    this.spikeTimer = this.cfg.spikeEvery * rand(0.4, 0.8);
    this.spikes = [];   // pending eruptions: { x, y, t, delay }
    this.gibColors = RUIN_ROCK_GIBS;
  }

  update(dt, world) {
    super.update(dt, world);
    this.updateSpikes(dt, world);   // eruptions finish even if it's stunned or dies
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    if (this.state === 'cast') {
      if (this.stateTime >= c.castTime) { this.setState('chase'); this.castSpikes(world, p); }
      return;
    }
    kite(this, world, p, dt);
    this.spikeTimer -= dt;
    if (this.spikeTimer <= 0) { this.spikeTimer = c.spikeEvery + rand(0, 0.8); this.setState('cast'); Sound.play('windup'); }
  }

  /** A line of eruptions from the shell through the hero and on across the room, until a wall. */
  castSpikes(world, p) {
    const c = this.cfg;
    const a = angleTo(this.x, this.y, p.x, p.y);
    for (let i = 1; i <= c.spikeMax; i++) {
      const x = this.x + Math.cos(a) * i * c.spikeSpacing;
      const y = this.y + Math.sin(a) * i * c.spikeSpacing;
      if (world.dungeon.isSolidAt(x, y)) break;
      const delay = c.spikeDelay + i * c.spikeStep;
      this.spikes.push({ x, y, t: 0, delay });
      // the ground cracks where each spike will come up (drawn on the ground, outlives the crab)
      world.effects.add(delay, (ctx, t) => Telegraph.circle(ctx, x, y, c.spikeRadius, t, '255, 120, 70'), true);
    }
    Sound.play('graveRumble');
  }

  updateSpikes(dt, world) {
    const c = this.cfg;
    for (const s of this.spikes) {
      s.t += dt;
      if (s.t < s.delay) continue;
      s.dead = true;
      hitAround(world, s.x, s.y, c.spikeRadius, c.damage);
      rockSpikeFx(world, s.x, s.y);
      Sound.play('hit', 0.04);
    }
    removeDead(this.spikes);
  }

  currentFrame() {
    if (this.state === 'cast') return this.frames.cast[0];
    if (this.moving) return this.frames.walk[Math.floor(this.animTime * 8) % 4];
    return this.frames.idle[Math.floor(this.animTime * 2) % 2];
  }
}

/**
 * Rock bowler: a rock golem that carries a giant boulder about in its arms. It hoists it overhead and
 * rolls it down a lane (it bounces off one wall), then raises a new one out of the ground to carry.
 */
class RockBowler extends Enemy {
  constructor(x, y) {
    super('rockBowler', x, y);
    this.aim = 0;
    this.carrying = true;
    this.gibColors = RUIN_ROCK_GIBS;
  }

  update(dt, world) {
    super.update(dt, world);
    if (this.state === 'windup') this.aimEnd = world.dungeon.raycast(this.x, this.y - 8, this.aim, 700);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.x, this.y - 8, p.x, p.y - 8);
        if (this.carrying && this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 160) { this.setState('windup'); Sound.play('windup'); }
        break;
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt) { this.aim = angleTo(this.x, this.y - 8, p.x, p.y - 8); this.faceToward(p.x); }
        if (this.stateTime >= c.windup) {
          this.carrying = false;
          enemyShot(world, this.x + Math.cos(this.aim) * 26, this.y - 8 + Math.sin(this.aim) * 26, this.aim, c.boulderSpeed, {
            radius: c.boulderRadius, damage: c.damage, life: 6, bounces: c.bounces, pierce: 4, knockback: 220,
            sprite: Sprites.projectiles.ruinBoulder, spin: (c.boulderSpeed / c.boulderRadius) * (Math.cos(this.aim) >= 0 ? 1 : -1),
            trail: ['#5c6558', '#7a6648'],
          });
          world.shake(3, 0.15);
          Sound.play('roll');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.6) { this.setState('raise'); Sound.play('graveRumble', 0.1); }
        break;
      case 'raise':
        // empty-handed: it calls a new boulder up out of the ground in front of it, then picks it up
        if (vrand(0, 1) < dt * 20) world.effects.burst(this.x + this.facing * 14 + vrand(-10, 10), this.y + 4, { count: 1, colors: RUIN_ROCK_GIBS, speed: [20, 60], life: [0.2, 0.4], up: 50 });
        if (this.stateTime >= c.raiseTime) {
          this.carrying = true;
          this.setState('chase');
          this.attackCooldown = c.cooldown + rand(0, 0.8);
          Sound.play('stomp', 0.06);
        }
        break;
    }
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.lift[0];
    if (this.carrying) return super.currentFrame();
    const list = this.moving ? this.frames.walkEmpty : this.frames.idleEmpty;
    return this.moving ? list[Math.floor(this.animTime * 7) % list.length] : list[Math.floor(this.animTime * 2) % list.length];
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = this.aimEnd || { x: this.x, y: this.y };
    Telegraph.line(ctx, this.x, this.y - 8, end.x, end.y, this.cfg.boulderRadius * 2, this.stateTime / this.cfg.windup);
  }

  draw(ctx) {
    const img = Sprites.projectiles.ruinBoulder;
    const s = CONFIG.enemyDrawScale;
    const f = this.facing;
    const held = 28;   // the boulder's size in its arms (it's held a little in front, so it looks smaller than rolling)
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    if (this.state === 'raise') {
      // the new boulder pushing up out of the ground in front of it, dirt and grit spilling off
      const k = clamp(this.stateTime / this.cfg.raiseTime, 0, 1);
      const bx = Math.round(this.x + f * 24 - held / 2);
      const by = Math.round(this.y + 8 - held * k);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx - 2, by - 2, held + 4, Math.round(held * k) + 2);
      ctx.clip();
      ctx.drawImage(img, bx, by, held, held);
      ctx.restore();
      ctx.fillStyle = '#2e342d';
      ctx.fillRect(bx - 2, Math.round(this.y + 7), held + 4, 2);
    } else if (this.state === 'windup') {
      // the boulder hoisted overhead, trembling
      const shake = this.stateTime > this.cfg.windup * 0.6 ? Math.round(Math.sin(this.animTime * 50)) : 0;
      ctx.drawImage(img, Math.round(this.x - img.width / 2 + shake), Math.round(this.y - 74 * s));
    } else if (this.carrying) {
      // hugged low against its belly, below its face, bobbing with its step, a stone hand either side
      const bob = this.moving ? Math.round(Math.abs(Math.sin(this.animTime * 7)) * 2) : Math.round(Math.sin(this.animTime * 2));
      const cx = Math.round(this.x + f * 14);
      const cy = Math.round(this.y - 4 * s - bob);
      ctx.drawImage(img, cx - held / 2, cy - held / 2, held, held);
      for (const side of [-1, 1]) {
        const hx = cx + side * 12;
        const hy = cy + 2;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(hx - 4, hy - 4, 8, 9);
        ctx.fillStyle = side === f ? '#7a8372' : '#5c6558';
        ctx.fillRect(hx - 3, hy - 3, 6, 7);
        ctx.fillStyle = '#a0a892';
        ctx.fillRect(hx - 3, hy - 3, 3, 1);
      }
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Rock wizard: draws the lingering magic into a cloud and launches it; the cloud lingers, hurting anyone inside. */
class RockWizard extends Enemy {
  constructor(x, y) {
    super('rockWizard', x, y);
    this.aim = 0;
    this.gibColors = [...RUIN_ROCK_GIBS, '#549044'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) { this.setState('gather'); Sound.play('magic', 0.1); }
        break;
      case 'gather':
        this.faceToward(p.x);
        // wisps of magic drawn in from the air round it (visual only)
        if (vrand(0, 1) < dt * 30) {
          const a = vrand(0, TAU);
          const sx = this.x + Math.cos(a) * 70;
          const sy = this.y - 40 + Math.sin(a) * 40;
          const tx = this.x + this.facing * 10;
          const ty = this.y - 46;
          world.effects.add(0.45, (ctx, t) => {
            ctx.fillStyle = `rgba(140, 255, 230, ${1 - t * 0.5})`;
            ctx.fillRect(Math.round(lerp(sx, tx, t * t)), Math.round(lerp(sy, ty, t * t)), 2, 2);
          });
        }
        if (this.stateTime >= c.gather) {
          this.launch(world, p);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.5) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.8); }
        break;
    }
  }

  /** The cloud flies to where the hero stands and settles there for cloudLife seconds. */
  launch(world, p) {
    const c = this.cfg;
    const sx = this.x + this.facing * 10;
    const sy = this.y - 46;
    const a = angleTo(sx, sy, p.x, p.y - 10);
    const d = dist(sx, sy, p.x, p.y - 10);
    const damage = c.damage;
    const r = c.cloudRadius;
    const life = c.cloudLife;
    enemyShot(world, sx, sy, a, c.cloudSpeed, {
      radius: 14, damage: c.cloudHit, life: d / c.cloudSpeed, sprite: null, glow: RUIN_MAGIC,
      aura: (ctx, pr) => PFX.smokeBlob(ctx, pr.x, pr.y, 16, ['rgba(34, 184, 166, 0.55)', 'rgba(92, 240, 216, 0.6)', 'rgba(184, 255, 240, 0.7)'], pr.age * 3, 3),
      onHit: (pr, w) => {
        const x = pr.x;
        const y = pr.y + 10;
        groundZone(w, {
          x, y, r, life, every: 0.25,
          tick: (ww, zx, zy, zr) => { for (const a2 of ww.allies) if (dist(a2.x, a2.y, zx, zy) < zr + a2.radius) a2.hurt(damage, ww, zx, zy, { dot: true }); },
          draw: (ctx, zx, zy, zr, t) => {
            ctx.save();
            ctx.globalAlpha = Math.min(1, (1 - t) * 4) * 0.4;
            PFX.disc(ctx, zx, zy, zr, zr * 0.55, '#127068', 2);
            ctx.restore();
          },
          top: (ctx, zx, zy, zr, t) => {
            const fade = Math.min(1, (1 - t) * 4, t * 10);
            ctx.save();
            ctx.globalAlpha = fade * 0.75;
            for (let i = 0; i < 5; i++) {
              const ang = (i / 5) * TAU + t * 2;
              PFX.smokeBlob(ctx, zx + Math.cos(ang) * zr * 0.45, zy - 14 + Math.sin(ang) * zr * 0.2, zr * 0.45, ['rgba(18, 112, 104, 0.5)', 'rgba(34, 184, 166, 0.5)', 'rgba(140, 255, 230, 0.55)'], t * 4 + i, i);
            }
            ctx.restore();
          },
          light: { r: r * 2, s: 0.6, rgb: RUIN_MAGIC },
        });
        Sound.play('magic', 0.1);
      },
    });
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const gathering = this.state === 'gather';
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.ruinStaff, gathering ? (f > 0 ? -1.35 : Math.PI + 1.35) : (f > 0 ? -1.0 : Math.PI + 1.0), 4, 6);
    ctx.globalAlpha = 1;
    if (gathering) {
      // the cloud swelling over its staff
      const k = Math.min(1, this.stateTime / this.cfg.gather);
      ctx.save();
      ctx.globalAlpha = 0.5 + k * 0.4;
      PFX.smokeBlob(ctx, this.x + f * 10, this.y - 46, 4 + k * 12, ['rgba(34, 184, 166, 0.55)', 'rgba(92, 240, 216, 0.6)', 'rgba(184, 255, 240, 0.7)'], this.animTime * 3, 2);
      ctx.restore();
    }
    this.drawHealthBar(ctx);
  }
}

/**
 * Ruined turret: never moves; fires four lasers at once in a cross. While it aims (the four lines
 * showing) it turns to a + or an X, whichever lines up with you, then locks and fires all four
 * to the walls. Stand between the lines.
 */
// the turret's lasers are aimed along the floor, and drawn this high above it (out of its head)
const TURRET_LIFT = 26;

class RuinedTurret extends Enemy {
  constructor(x, y) {
    super('ruinedTurret', x, y);
    this.hw = 18;
    this.hh = 10;
    this.hitOffY = 22;
    this.barOffset = 62;
    this.rot = Math.random() < 0.5 ? 0 : Math.PI / 4;   // 0 = a +, PI/4 = an X
    this.want = this.rot;
    this.attackCooldown = rand(0.8, 1.6);
    this.ends = [];
    this.gibColors = ['#9a845e', '#5a4a34', '#5cf0d8'];
  }

  /** Where the head's emitters are: just off its four faces. */
  get headY() { return this.y - TURRET_LIFT; }

  /** The + or the X, whichever has a laser closer to the line from it to (x, y). */
  patternFor(x, y) {
    const a = angleTo(this.x, this.y, x, y);
    const off = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);   // 0..90 deg from the nearest + line
    return off < Math.PI / 8 || off > (3 * Math.PI) / 8 ? 0 : Math.PI / 4;
  }

  /** The four lasers' ends on the floor (to the walls, at most range away): they're aimed along the ground. */
  aimEnds(world) {
    this.ends = [0, 1, 2, 3].map((k) => world.dungeon.raycast(this.x, this.y, this.rot + (k * Math.PI) / 2, this.cfg.range));
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    // the head turns toward the pattern it wants (a quarter turn is the furthest it ever needs to go)
    const d = angleDiff(this.rot, this.want);
    this.rot += clamp(d, -c.turnRate * dt, c.turnRate * dt);
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        this.want = this.patternFor(p.x, p.y);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.range) { this.setState('windup'); Sound.play('laserCharge', 0.15); }
        break;
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt && !p.dead) this.want = this.patternFor(p.x, p.y);
        else this.rot = this.want;
        this.aimEnds(world);
        if (this.stateTime >= c.windup) this.fire(world);
        break;
      case 'recover':
        if (this.stateTime >= c.beamTime) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  fire(world) {
    const c = this.cfg;
    this.rot = this.want;
    this.aimEnds(world);
    const hit = new Set();
    for (const end of this.ends) {
      const barrier = world.barrierOnSegment?.(this.x, this.y, end.x, end.y);
      if (barrier) barrier.absorb(c.damage, world, barrier.x, barrier.hy);
      else {
        // a hero standing where two lasers cross is still only hit once
        for (const a of world.allies) {
          if (hit.has(a) || pointSegmentDistance(a.x, a.y, this.x, this.y, end.x, end.y) > c.beamWidth / 2 + a.radius) continue;
          if (a.hurt(c.damage, world, this.x, this.headY, { projectile: true })) hit.add(a);
        }
      }
      magicBeamFx(world, this.x, this.headY, end.x, end.y - TURRET_LIFT, c.beamWidth, c.beamTime);
    }
    world.effects.burst(this.x, this.headY, { count: 14, colors: RUIN_MAGIC_FX, speed: [60, 180], life: [0.15, 0.35] });
    world.shake(2, 0.1);
    Sound.play('laser', 0.15);
    this.setState('recover');
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const k = this.stateTime / this.cfg.windup;
    for (const end of this.ends) Telegraph.line(ctx, this.x, this.y, end.x, end.y, this.cfg.beamWidth, k);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const head = Sprites.ruins.turretHead;
    ctx.globalAlpha = this.spawnAlpha;
    drawRotated(ctx, head, this.x, this.headY, 17, 17, this.rot);
    ctx.globalAlpha = 1;
    // its four lenses charging up as it aims, flaring as it fires
    const charge = this.state === 'windup' ? this.stateTime / this.cfg.windup : this.state === 'recover' ? 1 : 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const a = this.rot + (k * Math.PI) / 2;
      PFX.glow(ctx, this.x + Math.cos(a) * 15, this.headY + Math.sin(a) * 15, 4 + charge * 8, RUIN_MAGIC, 0.25 + charge * 0.6);
    }
    PFX.glow(ctx, this.x, this.headY, 10 + charge * 6, RUIN_MAGIC, 0.2 + charge * 0.3);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/** Stone pillar: hops after you quickly and slams the ground round it, then stands still a moment, unhurtable. */
class StonePillar extends Enemy {
  constructor(x, y) {
    super('stonePillar', x, y);
    this.anchor = PILLAR_ANCHOR;
    this.hw = 14;
    this.hh = 8;
    this.hitOffY = 28;
    this.barOffset = 70;
    this.height = 0;
    this.invuln = 0;
    this.hopTimer = rand(0.2, 0.6);
    this.gibColors = ['#9a845e', '#5a4a34', '#5cf0d8'];
  }

  get hy() { return this.y - (this.hitOffY + this.height) * CONFIG.enemyDrawScale; }

  takeDamage(amount, world) {
    if (this.invuln > 0) {
      this.flashTime = 0.04;
      if (!(this.immuneText > world.time)) {
        this.immuneText = world.time + 0.6;
        world.effects.text(this.hx, this.hy - 30, 'IMMUNE', { color: '#b8fff0', size: 7 });
      }
      return false;
    }
    return super.takeDamage(amount, world);
  }

  update(dt, world) {
    this.invuln -= dt;
    super.update(dt, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.height = 0;
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        this.hopTimer -= dt;
        if (this.distanceTo(p) < c.slamRange && this.attackCooldown <= 0) { this.setState('windup'); Sound.play('windup'); break; }
        if (this.hopTimer <= 0) {
          const a = angleTo(this.x, this.y, p.x, p.y);
          const d = Math.min(c.hopDistance, Math.max(0, this.distanceTo(p) - 30));
          const to = world.dungeon.freePoint(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, this.hw, this.hh);
          this.hopFrom = { x: this.x, y: this.y };
          this.hopTo = to;
          this.faceToward(p.x);
          this.setState('hop');
        }
        break;
      case 'hop': {
        const t = clamp(this.stateTime / c.hopTime, 0, 1);
        this.x = lerp(this.hopFrom.x, this.hopTo.x, t);
        this.y = lerp(this.hopFrom.y, this.hopTo.y, t);
        this.height = Math.sin(t * Math.PI) * 18;
        if (t >= 1) {
          this.hopTimer = c.hopEvery;
          world.effects.burst(this.x, this.y, { count: 4, colors: ['#9a845e', '#5a4a34'], speed: [20, 60], life: [0.2, 0.35] });
          Sound.play('stomp', 0.04);
          this.setState('chase');
        }
        break;
      }
      case 'windup':
        if (this.stateTime >= c.windup) {
          hitAround(world, this.x, this.y, c.slamRadius, c.damage, 160);
          world.effects.burst(this.x, this.y, { count: 18, colors: ['#9a845e', '#5a4a34', '#5cf0d8'], speed: [60, 180], life: [0.25, 0.5], up: 40 });
          const { x, y } = this;
          const r = c.slamRadius;
          world.effects.add(0.35, (ctx, t) => {
            ctx.save();
            ctx.globalAlpha = 1 - t;
            PFX.ring(ctx, x, y, r * (0.5 + t * 0.5), r * 0.55 * (0.5 + t * 0.5), '#bca47a', 2, { thick: 2 });
            ctx.restore();
          });
          world.shake(4, 0.15);
          Sound.play('stomp', 0.15);
          // the slam leaves it hard as the temple stone: it stands still, immune, for a moment
          this.invuln = c.invulnTime;
          this.attackCooldown = c.invulnTime + 0.4;
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.invulnTime) {
          this.invuln = 0;   // moving again: it can be hurt
          this.setState('chase');
        }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    Telegraph.circle(ctx, this.x, this.y, this.cfg.slamRadius, this.stateTime / this.cfg.windup);
  }

  currentFrame() {
    return this.state === 'windup' ? this.frames.squash[0] : this.frames.idle[0];
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(0, -Math.round(this.height));
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (this.invuln > 0) {
      // the stone hardened: glyph-light running over it
      ctx.globalCompositeOperation = 'lighter';
      const s = CONFIG.enemyDrawScale;
      PFX.glow(ctx, this.x, this.y - 30 * s, 22, RUIN_MAGIC, 0.35 + Math.sin(this.animTime * 10) * 0.1, 2, 34);
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/**
 * Rock golem (stage 2+): extremely tanky. It raises both fists (its core blazing, the ground
 * trembling, a red fan marking where it'll strike) and slams the ground: a shockwave of rock rips
 * outward in a wide fan, a ridge of jagged stone racing across the floor, and stuns whoever it catches.
 */
class RockGolem extends Enemy {
  constructor(x, y) {
    super('rockGolem', x, y);
    this.anchor = KNIGHT_ANCHOR;
    this.hw = 18;
    this.hh = 9;
    this.hitOffY = 30;
    this.barOffset = 74;
    this.attackAngle = 0;
    this.waves = [];   // fans of rock racing outward: { x, y, angle, r, hit }
    this.gibColors = [...RUIN_ROCK_GIBS, '#549044'];
  }

  update(dt, world) {
    super.update(dt, world);
    this.updateWaves(dt, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (!p.dead) this.moveToward(world, p.x, p.y, this.speed, dt);
        if (!p.dead && this.distanceTo(p) < c.slamRange && this.attackCooldown <= 0) {
          this.setState('windup');
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          Sound.play('windup');
          Sound.play('graveRumble', 0.15);
        }
        break;
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt && !p.dead) { this.attackAngle = angleTo(this.x, this.y, p.x, p.y); this.faceToward(p.x); }
        // the ground trembles round it as it gathers itself (visual only)
        if (vrand(0, 1) < dt * 18) world.effects.burst(this.x + vrand(-30, 30), this.y + vrand(-6, 10), { count: 1, colors: RUIN_ROCK_GIBS, speed: [10, 40], life: [0.2, 0.4], up: 40 });
        if (this.stateTime >= c.windup) this.slam(world);
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  slam(world) {
    this.waves.push({ x: this.x, y: this.y, angle: this.attackAngle, r: 24, hit: new Set() });
    world.shake(9, 0.35);
    world.effects.burst(this.x, this.y, { count: 30, colors: RUIN_ROCK_GIBS, speed: [80, 240], life: [0.3, 0.7], up: 70, gravity: 380, size: [2, 5] });
    world.effects.smoke(this.x, this.y, { count: 6, radius: 20, life: 0.9, rise: 12, colors: ['#2e342d', '#5c6558', '#7a8372'] });
    const { x, y } = this;
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, 20 + t * 40, (20 + t * 40) * 0.5, '#a0a892', 2, { thick: 2 });
      ctx.restore();
    });
    Sound.play('stomp');
    Sound.play('impact', 0.1);
    this.setState('recover');
  }

  updateWaves(dt, world) {
    const c = this.cfg;
    const half = (c.waveArcDegrees * DEG) / 2;
    for (const w of this.waves) {
      w.r += c.waveSpeed * dt;
      if (w.r > c.waveReach) { w.dead = true; continue; }
      // everyone the front of the fan sweeps over (inside its arc), once each
      for (const a of world.allies) {
        if (w.hit.has(a)) continue;
        const d = dist(w.x, w.y, a.x, a.y);
        if (Math.abs(d - w.r) > c.waveWidth / 2 + a.radius) continue;
        if (Math.abs(angleDiff(w.angle, angleTo(w.x, w.y, a.x, a.y))) > half + a.radius / Math.max(d, 1)) continue;
        w.hit.add(a);
        if (a.hurt(c.damage, world, w.x, w.y)) {
          a.stun?.(c.stun, world);
          a.knockback?.(angleTo(w.x, w.y, a.x, a.y), 160);
        }
      }
      // grit thrown up all along the front as it tears through the floor (visual only)
      for (let i = 0; i < 2; i++) {
        const ang = w.angle + vrand(-half, half);
        const fx = w.x + Math.cos(ang) * w.r;
        const fy = w.y + Math.sin(ang) * w.r;
        if (!world.dungeon.isSolidAt(fx, fy)) world.effects.burst(fx, fy, { count: 1, colors: RUIN_ROCK_GIBS, speed: [30, 90], life: [0.2, 0.45], up: 60, gravity: 300, size: [2, 3] });
      }
    }
    removeDead(this.waves);
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const c = this.cfg;
    Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.waveArcDegrees * DEG, c.waveReach, this.stateTime / c.windup);
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    for (const w of this.waves) this.drawWave(ctx, w);
  }

  /**
   * One fan of rock racing outward: the torn-up floor behind it, and along its front a ridge of jagged
   * stone spikes, tallest in the middle of the fan, fading as it reaches the end of its run.
   */
  drawWave(ctx, w) {
    const c = this.cfg;
    const half = (c.waveArcDegrees * DEG) / 2;
    const fade = 1 - Math.max(0, (w.r - c.waveReach * 0.7) / (c.waveReach * 0.3));
    const n = Math.max(6, Math.round((w.r * half * 2) / 9));
    ctx.save();
    // the scar it leaves: a dark band behind the front
    ctx.globalAlpha = 0.35 * fade;
    for (let i = 0; i <= n; i++) {
      const ang = w.angle - half + (i / n) * half * 2;
      for (let back = 6; back < 30; back += 6) {
        const r = w.r - back;
        if (r < 20) continue;
        ctx.fillStyle = '#1c201c';
        ctx.fillRect(Math.round(w.x + Math.cos(ang) * r) - 2, Math.round(w.y + Math.sin(ang) * r * 0.9) - 1, 4, 3);
      }
    }
    // a band of dust and grit boiling up just ahead of the ridge
    ctx.globalAlpha = 0.45 * fade;
    for (let i = 0; i <= n; i += 2) {
      const ang = w.angle - half + (i / n) * half * 2;
      PFX.disc(ctx, w.x + Math.cos(ang) * (w.r + 6), w.y + Math.sin(ang) * (w.r + 6) * 0.9 - 6, 8, 5, '#7a8372', 2);
    }
    // the ridge of spikes along the front
    ctx.globalAlpha = fade;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const ang = w.angle - half + u * half * 2;
      const x = Math.round(w.x + Math.cos(ang) * w.r);
      const y = Math.round(w.y + Math.sin(ang) * w.r * 0.9);
      const h = Math.round((12 + Math.sin(u * Math.PI) * 14) * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.7))));
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.moveTo(x - 7, y + 2); ctx.lineTo(x, y - h - 1); ctx.lineTo(x + 7, y + 2); ctx.fill();
      ctx.fillStyle = '#5c6558';
      ctx.beginPath(); ctx.moveTo(x - 6, y + 1); ctx.lineTo(x, y - h); ctx.lineTo(x + 6, y + 1); ctx.fill();
      ctx.fillStyle = '#a0a892';
      ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.lineTo(x, y - h); ctx.lineTo(x - 1, y + 1); ctx.fill();
    }
    ctx.restore();
  }

  currentFrame() {
    if (this.state === 'windup') return this.frames.slam[0];
    return super.currentFrame();
  }

  draw(ctx) {
    // trembling and glowing as it gathers itself to slam
    const windup = this.state === 'windup' ? this.stateTime / this.cfg.windup : 0;
    const shake = windup > 0.4 ? Math.round(Math.sin(this.animTime * 45) * windup * 2) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.restore();
    if (windup > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x, this.y - 18, 16 + windup * 18, RUIN_MAGIC, (0.3 + windup * 0.6) * this.spawnAlpha);
      ctx.restore();
    }
    this.drawHealthBar(ctx);
  }
}

/**
 * Ancient portal (stage 2+): an old stone gateway in the floor, its pool of magic swirling. Every few
 * seconds it opens (the swirl races and brightens, a column of light rising) and something comes
 * through: one rock golem, or three rock discs. It never moves or attacks: break it.
 */
class AncientPortal extends Enemy {
  constructor(x, y) {
    super('ancientPortal', x, y);
    this.anchor = { x: 30, y: 36 };
    this.hw = 24;
    this.hh = 12;
    this.hitOffY = 14;
    this.barOffset = 40;
    this.summonTimer = this.cfg.summonEvery * rand(0.35, 0.6);
    this.swirl = rand(0, TAU);   // the pool's turn (visual)
    this.gibColors = ['#9a845e', '#5a4a34', '#5cf0d8'];
  }

  think(dt, world) {
    const c = this.cfg;
    if (this.state === 'open') {
      if (this.stateTime >= c.openTime) { this.callThrough(world); this.setState('chase'); }
      return;
    }
    this.summonTimer -= dt;
    if (this.summonTimer > 0) return;
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length;
    const room = Math.min(c.summonMax - alive, world.summonRoom(this));
    if (room <= 0) { this.summonTimer = 2; return; }
    this.summonTimer = c.summonEvery + rand(0, 1.5);
    // a golem if there's room for one and the roll says so, otherwise up to three discs
    this.calling = Math.random() < c.golemChance ? 'rockGolem' : 'rockDisc';
    this.callCount = this.calling === 'rockGolem' ? 1 : Math.min(3, room);
    this.setState('open');
    Sound.play('burstCharge', 0.15);
  }

  callThrough(world) {
    for (let i = 0; i < this.callCount; i++) {
      const a = this.callCount === 1 ? Math.PI / 2 : Math.PI / 2 + (i - 1) * 0.9;
      const d = this.callCount === 1 ? 46 : 58;
      world.summon(this, this.calling, this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.7 + (this.callCount === 1 ? 0 : 4));
    }
    world.effects.burst(this.x, this.y - 16, { count: 30, colors: RUIN_MAGIC_FX, speed: [60, 220], life: [0.3, 0.7], up: 80 });
    const { x, y } = this;
    world.effects.add(0.5, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y - 16, 20 + t * 50, (20 + t * 50) * 0.5, '#5cf0d8', 2, { thick: t < 0.3 ? 3 : 1 });
      ctx.restore();
    });
    world.shake(3, 0.2);
    Sound.play('magic', 0.15);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 2, 30, 8, 0.3);
  }

  draw(ctx) {
    const t = this.animTime;
    const open = this.state === 'open' ? clamp(this.stateTime / this.cfg.openTime, 0, 1) : 0;
    ctx.globalAlpha = this.spawnAlpha;
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // the pool swirling: two spiral arms of light turning inward, faster and brighter as it opens
    const px = this.x;
    const py = this.y - 16;
    const turn = t * (1.2 + open * 7) + this.swirl;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(px, py, 17, 9, 0, 0, TAU);
    ctx.clip();
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 26; i++) {
        const k = i / 26;
        const a = turn + arm * Math.PI + k * 5.5;
        const x = Math.round(px + Math.cos(a) * k * 17);
        const y = Math.round(py + Math.sin(a) * k * 9);
        ctx.fillStyle = k < 0.35 ? '#e8fffa' : k < 0.7 ? '#b8fff0' : '#5cf0d8';
        ctx.globalAlpha = (0.55 + open * 0.45) * this.spawnAlpha;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, px, py, 20 + open * 14, RUIN_MAGIC, (0.25 + open * 0.5 + Math.sin(t * 3) * 0.05) * this.spawnAlpha, 2, 12 + open * 8);
    if (open > 0) {
      // a column of light rising out of it as it opens
      const h = Math.round(20 + open * 70);
      ctx.globalAlpha = open * 0.55;
      ctx.fillStyle = '#5cf0d8';
      ctx.fillRect(Math.round(px - 10 * open), py - h, Math.round(20 * open), h);
      ctx.fillStyle = '#e8fffa';
      ctx.fillRect(Math.round(px - 4 * open), py - h, Math.max(1, Math.round(8 * open)), h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Magic pillar (stage 2+): every other enemy within its ward takes only 1 damage from any hit, until it falls. */
class MagicPillar extends Enemy {
  constructor(x, y) {
    super('magicPillar', x, y);
    this.anchor = OBELISK_ANCHOR;
    this.hw = 14;
    this.hh = 8;
    this.hitOffY = 34;
    this.barOffset = 84;
    this.warded = [];
    this.gibColors = [...RUIN_ROCK_GIBS, '#5cf0d8'];
  }

  think(dt, world) {
    const c = this.cfg;
    this.warded = [];
    for (const e of world.enemies) {
      if (e === this || e.dead || e instanceof MagicPillar || dist(e.x, e.y, this.x, this.y) > c.wardRadius) continue;
      e.wardedUntil = world.time + 0.15;
      e.wardCap = c.wardCap;
      this.warded.push(e);
    }
  }

  onDeath(world) {
    world.effects.text(this.x, this.y - 60, 'WARD BROKEN', { color: '#b8fff0', size: 8 });
    world.effects.burst(this.x, this.y - 40, { count: 30, colors: RUIN_MAGIC_FX, speed: [60, 220], life: [0.3, 0.7], up: 30 });
    Sound.play('partBreak', 0.15);
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    const r = this.cfg.wardRadius;
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(this.animTime * 2) * 0.08;
    PFX.ring(ctx, this.x, this.y, r, r * 0.55, '#5cf0d8', 2, { dash: [3, 5], spin: this.animTime * 0.3 });
    ctx.restore();
  }

  draw(ctx) {
    const s = CONFIG.enemyDrawScale;
    const tipY = this.y - 74 * s;
    const t = this.animTime;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.warded) if (!e.dead) this.drawTether(ctx, this.x, tipY, e, t);
    // the crystal blazing with the ward it's holding up
    const n = this.warded.length;
    PFX.glow(ctx, this.x, tipY, 18 + Math.min(n, 4) * 3, RUIN_MAGIC, 0.55 + Math.sin(t * 3) * 0.15 + Math.min(n, 4) * 0.05);
    ctx.restore();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    this.drawHealthBar(ctx);
  }

  /**
   * A tether of magic from its crystal to one enemy it wards: a stream arcing up and over, a soft
   * glowing band round a bright white core that ripples as it flows, pulses of light running
   * down it to the enemy, and a flare where it lands. (Drawn additively, inside draw.)
   */
  drawTether(ctx, x0, y0, e, t) {
    const x1 = e.x;
    const y1 = e.hy;
    const len = dist(x0, y0, x1, y1);
    // a curve bowing upward, its height swaying a little
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - 24 - len * 0.08 + Math.sin(t * 2 + e.x * 0.01) * 4;
    const at = (k) => {
      const a = (1 - k) * (1 - k);
      const b = 2 * (1 - k) * k;
      const c = k * k;
      return [a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1];
    };
    const steps = Math.max(8, Math.round(len / 3));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const [px, py] = at(k);
      // the stream ripples: its width breathing along its length as the magic flows down it
      const ripple = Math.sin(k * 18 - t * 9);
      const X = Math.round(px);
      const Y = Math.round(py);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#22b8a6';
      ctx.fillRect(X - 2, Y - 2, 4, 4 + (ripple > 0.3 ? 1 : 0));
      ctx.globalAlpha = 0.55 + ripple * 0.2;
      ctx.fillStyle = '#5cf0d8';
      ctx.fillRect(X - 1, Y - 1, 2, 2);
      if (ripple > 0.6) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#e8fffa';
        ctx.fillRect(X, Y, 1, 1);
      }
    }
    // pulses of light running down to the enemy
    for (let j = 0; j < 3; j++) {
      const k = (t * 0.9 + j / 3 + (e.x % 7) * 0.05) % 1;
      const [px, py] = at(k);
      ctx.globalAlpha = 1;
      PFX.glow(ctx, px, py, 7, RUIN_MAGIC, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
    }
    // a flare where the ward takes hold of it, and sparks off the crystal end
    ctx.globalAlpha = 1;
    PFX.glow(ctx, x1, y1, 12 + Math.sin(t * 6) * 2, RUIN_MAGIC, 0.45);
    for (let j = 0; j < 4; j++) {
      const a = t * 3 + j * (TAU / 4);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#b8fff0';
      ctx.fillRect(Math.round(x1 + Math.cos(a) * 9), Math.round(y1 + Math.sin(a) * 5), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Light totem: the ancient light's source. While it stands the light can't be hurt; when it falls, so does the light. */
class LightTotem extends Enemy {
  constructor(x, y) {
    super('lightTotem', x, y);
    this.anchor = TOTEM_ANCHOR;
    this.hw = 14;
    this.hh = 8;
    this.hitOffY = 28;
    this.barOffset = 72;
    this.light = null;
    this.gibColors = ['#9a845e', '#5a4a34', '#5cf0d8'];
  }

  think() {}

  onDeath(world) {
    world.effects.burst(this.x, this.y - 50, { count: 30, colors: RUIN_MAGIC_FX, speed: [60, 220], life: [0.3, 0.7], up: 30 });
    if (this.light && !this.light.dead) {
      world.effects.text(this.light.x, this.light.y - 60, 'THE LIGHT FADES', { color: '#b8fff0', size: 8 });
      this.light.falling = true;
      this.light.die(world);
    }
  }

  draw(ctx) {
    const s = CONFIG.enemyDrawScale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 58 * s, 14, RUIN_MAGIC, 0.5 + Math.sin(this.animTime * 4) * 0.15);
    ctx.restore();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    this.drawHealthBar(ctx);
  }
}

/**
 * Ancient light (stage 3): a being of magic and light, invincible while its totem stands. It charges
 * a beam (a widening line) for chargeTime, blasts it for beamTime while turning slowly after you, then rests.
 */
class AncientLight extends Enemy {
  constructor(x, y) {
    super('ancientLight', x, y);
    this.flying = true;
    this.hitOffY = 30;
    this.barOffset = 64;
    this.aim = 0;
    this.totem = undefined;          // set by adopt (its companion), or raised the first time it acts
    this.setState('rest');
    this.gibColors = RUIN_MAGIC_FX;
  }

  adopt(totem) {
    this.totem = totem;
    totem.light = this;
  }

  takeDamage(amount, world) {
    if (this.totem && !this.totem.dead) {
      this.flashTime = 0.04;
      if (!(this.immuneText > world.time)) {
        this.immuneText = world.time + 0.8;
        world.effects.text(this.hx, this.hy - 34, 'BREAK ITS TOTEM', { color: '#b8fff0', size: 7 });
      }
      return false;
    }
    return super.takeDamage(amount, world);
  }

  think(dt, world) {
    const c = this.cfg;
    if (this.totem === undefined) {
      // came without one (summoned on its own): it raises its totem beside it
      const pt = world.dungeon.freePoint(this.x - 40, this.y + 10, 14, 8);
      const t = createEnemy('lightTotem', pt.x, pt.y);
      t.isCompanion = true;
      this.adopt(t);
      world.addEnemy(t);
    }
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'rest':
        kite(this, world, p, dt);
        this.aim = angleTo(this.x, this.hy, p.hx, p.hy);
        if (this.stateTime >= c.rest && this.distanceTo(p) < c.preferredMax + 200) { this.setState('charge'); Sound.play('burstCharge', 0.15); }
        break;
      case 'charge':
        this.aim = angleTo(this.x, this.hy, p.hx, p.hy);
        this.faceToward(p.x);
        this.aimEnd = world.dungeon.raycast(this.x, this.hy, this.aim, 900);
        if (this.stateTime >= c.chargeTime) { this.setState('beam'); this.tick = 0; Sound.play('laser'); }
        break;
      case 'beam': {
        // turns slowly after you while it blasts
        const want = angleTo(this.x, this.hy, p.hx, p.hy);
        this.aim += clamp(angleDiff(this.aim, want), -c.beamTurn * dt, c.beamTurn * dt);
        this.aimEnd = world.dungeon.raycast(this.x, this.hy, this.aim, 900);
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = c.beamTick;
          const end = this.aimEnd;
          const barrier = world.barrierOnSegment?.(this.x, this.hy, end.x, end.y);
          if (barrier) barrier.absorb(c.damage, world, barrier.x, barrier.hy);
          else hitLine(world, this.x, this.hy, end.x, end.y, c.beamWidth, c.damage);
          world.effects.burst(end.x, end.y, { count: 3, colors: RUIN_MAGIC_FX, speed: [40, 140], life: [0.15, 0.3] });
        }
        if (this.stateTime >= c.beamTime) this.setState('rest');
        break;
      }
    }
  }

  die(world) {
    if (this.totem && !this.totem.dead && !this.falling) { this.hp = 1; return; }   // only falls with its totem
    super.die(world);
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y + 6, 10, 4, 0.2);
    if (this.state === 'charge' && this.aimEnd) {
      // the beam's path: a line that widens and brightens as it charges
      const k = this.stateTime / this.cfg.chargeTime;
      Telegraph.line(ctx, this.x, this.hy, this.aimEnd.x, this.aimEnd.y, 4 + this.cfg.beamWidth * k, k, RUIN_MAGIC);
    }
  }

  draw(ctx) {
    const s = CONFIG.enemyDrawScale;
    const t = this.animTime;
    const bob = Math.sin(t * 2) * 3;
    const cx = this.x;
    const cy = this.y - 30 * s + bob;
    const charge = this.state === 'charge' ? this.stateTime / this.cfg.chargeTime : this.state === 'beam' ? 1 : 0;
    ctx.save();
    ctx.globalAlpha = this.spawnAlpha;
    // the tether of light to its totem
    if (this.totem && !this.totem.dead) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1;
      PFX.line(ctx, this.totem.x, this.totem.y - 58 * s, cx, cy, '#5cf0d8', 2, [4, 3], -t * 40);
      ctx.globalAlpha = this.spawnAlpha;
    }
    // a body of light: a robe tapering to nothing, arms of light, brighter at the heart
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, cx, cy, 30 + charge * 10, RUIN_MAGIC, 0.35 + charge * 0.3, 2, 34);
    PFX.disc(ctx, cx, cy + 6, 8, 16, 'rgba(92, 240, 216, 0.5)', 2);
    PFX.disc(ctx, cx, cy + 4, 4, 12, 'rgba(184, 255, 240, 0.6)', 2);
    for (const side of [-1, 1]) PFX.line(ctx, cx + side * 4, cy - 4, cx + side * 14, cy + 6 + Math.sin(t * 3 + side) * 3, 'rgba(140, 255, 230, 0.6)', 2);
    for (let i = 0; i < 4; i++) {
      const a = t * 1.5 + (i * TAU) / 4;
      ctx.fillStyle = 'rgba(184, 255, 240, 0.8)';
      ctx.fillRect(Math.round(cx + Math.cos(a) * 18), Math.round(cy + Math.sin(a) * 8), 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // its stone mask
    const mask = Sprites.ruins.lightMask;
    ctx.drawImage(mask, Math.round(cx - 8), Math.round(cy - 20));
    if (this.flashTime > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx - 7), Math.round(cy - 19), 14, 14); }
    ctx.restore();
    // the beam itself
    if (this.state === 'beam' && this.aimEnd) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.85 + Math.sin(t * 40) * 0.15;
      PFX.beam(ctx, cx, this.hy, this.aim, dist(cx, this.hy, this.aimEnd.x, this.aimEnd.y), this.cfg.beamWidth * flick, ['#127068', '#22b8a6', '#5cf0d8', '#ffffff'], 2, false);
      PFX.glow(ctx, this.aimEnd.x, this.aimEnd.y, 20, RUIN_MAGIC, 0.7);
      ctx.restore();
    }
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    // shows no bar while it can't be hurt: break the totem first
    if (this.totem && !this.totem.dead) return this.drawStun(ctx);
    super.drawHealthBar(ctx);
  }
}

/**
 * Ancient rotator (stage 3): two stone rings circle it, blocking some hits. It sends out one of its three
 * floating guns at a time: a laser from afar, or a rush in close for a shotgun blast, then home again.
 */
class AncientRotator extends Enemy {
  constructor(x, y) {
    super('ancientRotator', x, y);
    this.hitOffY = 22;
    this.barOffset = 56;
    this.gunTimer = this.cfg.gunEvery;
    this.guns = [0, 1, 2].map((i) => ({ i, state: 'orbit', t: 0, x, y: y - 30, angle: 0, aim: 0 }));
    this.gibColors = [...RUIN_ROCK_GIBS, '#5cf0d8'];
  }

  takeDamage(amount, world) {
    if (!this.dead && Math.random() < this.cfg.blockChance) {
      this.flashTime = 0.05;
      world.effects.text(this.hx, this.hy - 30, 'BLOCKED', { color: '#e4e7ee', size: 7 });
      world.effects.burst(this.hx, this.hy, { count: 6, colors: ['#ffffff', '#a0a892'], speed: [60, 160], life: [0.1, 0.25] });
      Sound.play('parry', 0.1);
      return false;
    }
    return super.takeDamage(amount, world);
  }

  /** Where gun i rests in its orbit. */
  orbitAt(g) {
    const a = this.animTime * 1.6 + (g.i * TAU) / 3;
    return { x: this.x + Math.cos(a) * 26, y: this.y - 26 + Math.sin(a) * 10 };
  }

  update(dt, world) {
    super.update(dt, world);
    this.updateGuns(dt, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    kite(this, world, p, dt);
    this.gunTimer -= dt;
    if (this.gunTimer > 0) return;
    const g = this.guns.find((x) => x.state === 'orbit');
    if (!g) return;
    this.gunTimer = c.gunEvery + rand(0, 0.6);
    g.t = 0;
    g.state = this.distanceTo(p) > c.preferredMax * 0.8 || Math.random() < 0.45 ? 'aim' : 'rush';
    Sound.play(g.state === 'aim' ? 'laserCharge' : 'dash', 0.12);
  }

  updateGuns(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    for (const g of this.guns) {
      g.t += dt;
      const home = this.orbitAt(g);
      switch (g.state) {
        case 'orbit':
          g.x = lerp(g.x, home.x, Math.min(1, dt * 10));
          g.y = lerp(g.y, home.y, Math.min(1, dt * 10));
          g.aim = p.dead ? 0 : angleTo(g.x, g.y, p.hx, p.hy);
          break;
        case 'aim': {
          // floats out a little toward you, aims (locking just before it fires), then fires a laser
          const out = { x: this.x + Math.cos(g.aim) * 44, y: this.y - 30 + Math.sin(g.aim) * 30 };
          g.x = lerp(g.x, out.x, Math.min(1, dt * 6));
          g.y = lerp(g.y, out.y, Math.min(1, dt * 6));
          if (g.t < c.laserWindup - 0.3 && !p.dead) g.aim = angleTo(g.x, g.y, p.hx, p.hy);
          g.end = world.dungeon.raycast(g.x, g.y, g.aim, 800);
          if (g.t >= c.laserWindup) {
            const barrier = world.barrierOnSegment?.(g.x, g.y, g.end.x, g.end.y);
            if (barrier) barrier.absorb(c.laserDamage, world, barrier.x, barrier.hy);
            else hitLine(world, g.x, g.y, g.end.x, g.end.y, c.laserWidth, c.laserDamage);
            magicBeamFx(world, g.x, g.y, g.end.x, g.end.y, c.laserWidth);
            Sound.play('laser', 0.12);
            g.state = 'return';
            g.t = 0;
          }
          break;
        }
        case 'rush': {
          // flies at you; close enough (or out of time), it blasts a spread of pellets
          if (!p.dead) {
            g.aim = angleTo(g.x, g.y, p.hx, p.hy);
            const step = c.rushSpeed * dt;
            if (dist(g.x, g.y, p.hx, p.hy) > 70) { g.x += Math.cos(g.aim) * step; g.y += Math.sin(g.aim) * step; }
          }
          if (g.t > 0.25 && (p.dead || dist(g.x, g.y, p.hx, p.hy) <= 74 || g.t > 1.3)) { g.state = 'blast'; g.t = 0; }
          break;
        }
        case 'blast':
          if (g.t >= 0.25) {
            const spread = c.spreadDegrees * DEG;
            for (let i = 0; i < c.pellets; i++) {
              const a = g.aim + (i / (c.pellets - 1) - 0.5) * spread;
              enemyShot(world, g.x + Math.cos(a) * 10, g.y + Math.sin(a) * 10, a, c.pelletSpeed * rand(0.9, 1.1), {
                radius: 4, damage: c.damage, life: 1.4, sprite: Sprites.projectiles.magicPellet, glow: RUIN_MAGIC,
              });
            }
            world.effects.burst(g.x, g.y, { count: 10, colors: RUIN_MAGIC_FX, speed: [60, 180], life: [0.1, 0.25], angle: g.aim, spread: 0.8 });
            Sound.play('musket', 0.1);
            g.state = 'return';
            g.t = 0;
          }
          break;
        case 'return': {
          const a = angleTo(g.x, g.y, home.x, home.y);
          const step = c.rushSpeed * dt;
          if (dist(g.x, g.y, home.x, home.y) <= step + 2) g.state = 'orbit';
          else { g.x += Math.cos(a) * step; g.y += Math.sin(a) * step; }
          break;
        }
      }
    }
  }

  drawTelegraph(ctx) {
    for (const g of this.guns) {
      if (g.state === 'aim' && g.end) Telegraph.line(ctx, g.x, g.y, g.end.x, g.end.y, this.cfg.laserWidth, g.t / this.cfg.laserWindup);
      if (g.state === 'blast') Telegraph.cone(ctx, g.x, g.y, g.aim, this.cfg.spreadDegrees * DEG, 90, g.t / 0.25);
    }
  }

  /**
   * One of its two stone rings, tilted like a planet's: the half behind the body (back) or in
   * front. A band of stone in pixel steps, lit on its upper edge, with carved notches going round.
   */
  drawRing(ctx, front, tilt, rx, ry, spin) {
    const cx = this.x;
    const cy = this.y - 26 * CONFIG.enemyDrawScale;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const n = Math.round(rx * 2.4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if ((Math.sin(a) >= 0) !== front) continue;   // front half: the near side (lower on screen)
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      const x = Math.round(cx + ex * cos - ey * sin);
      const y = Math.round(cy + ex * sin + ey * cos);
      const notch = Math.floor(((a + spin) / TAU) * 12 + 1200) % 3 === 0;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, y - 2, 4, 5);
      ctx.fillStyle = notch ? '#444c42' : '#7a8372';
      ctx.fillRect(x - 1, y - 1, 2, 3);
      ctx.fillStyle = notch ? '#5cf0d8' : '#a0a892';
      ctx.fillRect(x - 1, y - 1, 2, 1);
    }
  }

  draw(ctx) {
    const t = this.animTime;
    ctx.globalAlpha = this.spawnAlpha;
    this.drawRing(ctx, false, 0.25, 28, 8, t * 1.2);
    this.drawRing(ctx, false, -0.35, 23, 6, -t * 1.6);
    ctx.globalAlpha = 1;
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    this.drawRing(ctx, true, 0.25, 28, 8, t * 1.2);
    this.drawRing(ctx, true, -0.35, 23, 6, -t * 1.6);
    const gun = Sprites.ruins.rotatorGun;
    for (const g of this.guns) {
      const x = this.guns && g.x !== undefined ? g.x : this.x;
      drawRotated(ctx, gun, x, g.y, 6, 6, g.aim, Math.cos(g.aim) < 0);
      if (g.state !== 'orbit') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, g.y, 10, RUIN_MAGIC, 0.4);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}
