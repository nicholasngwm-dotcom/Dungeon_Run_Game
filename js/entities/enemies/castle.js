// Castle enemies (dungeon runs): the corrupted court of a fallen empire. Bodies are
// drawn in js/gfx/enemies/castle.js; the weapons they hold are drawn here as they aim
// and swing. Uses the graveyard's helpers (kite, enemyShot, meleeArc).

/** A damage number from cfg scaled for the stage (addEnemy only scales cfg.damage itself). */
function stageDamage(world, v) {
  return Math.round(v * (world.enemyScale ? world.enemyScale.damage : 1));
}

/** Holds a weapon sprite in the enemy's front hand at `angle` (flipped to read right side up when aiming left). */
function holdWeapon(ctx, e, w, angle, dx = 8, dy = 4) {
  const f = e.facing;
  drawRotated(ctx, w.img, e.x + f * dx, e.hy + dy, w.pivotX, w.pivotY, angle, Math.cos(angle) < 0);
}

/**
 * A shot lobbed through the air from (x0, y0) to land at (x1, y1) after `flight` seconds:
 * it lands on a timer (part of the shared simulation), while the arc, its shadow and the
 * red circle where it will land are drawn as effects. onLand(world) runs as it hits.
 */
function lobShot(world, x0, y0, x1, y1, flight, { sprite, radius = 40, height = 120, spin = 6, rgb = '255, 60, 60', onLand, trail = null }) {
  world.effects.add(flight, (ctx, t) => {
    Telegraph.circle(ctx, x1, y1, radius, t, rgb);
    const gx = lerp(x0, x1, t);
    const gy = lerp(y0 + 20, y1, t);
    drawShadow(ctx, gx, gy, 8 + t * 6, 3 + t * 2, 0.25 + t * 0.2);
  }, true);
  world.effects.add(flight, (ctx, t) => {
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t) - Math.sin(t * Math.PI) * height;
    drawRotated(ctx, sprite, x, y, sprite.width / 2, sprite.height / 2, t * flight * spin);
  });
  if (trail) {
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      world.after(flight * t, () => world.effects.burst(lerp(x0, x1, t), lerp(y0, y1, t) - Math.sin(t * Math.PI) * height, { count: 3, colors: trail, speed: [10, 40], life: [0.2, 0.5], up: 20 }));
    }
  }
  const stage = world.run ? world.run.stage : 0;
  world.after(flight, () => { if (!world.run || world.run.stage === stage) onLand(world); });
}

/**
 * A patch on the ground that lasts `life` seconds and does something to whoever is in it
 * every `every` seconds (fire burns, ice slows): ticks on timers (simulation), drawn as a ground effect.
 */
function groundZone(world, { x, y, r, life, every = 0.25, tick, draw, top = null, light = null }) {
  const stage = world.run ? world.run.stage : 0;
  let left = life;
  const step = () => {
    left -= every;
    if (left < 0 || (world.run && world.run.stage !== stage)) return;
    tick(world, x, y, r);
    world.after(every, step);
  };
  world.after(every, step);
  world.effects.add(life, (ctx, t) => draw(ctx, x, y, r, t), true);
  // flames and frost glitter go on above the gloom; the patch lights up its surroundings
  if (top) world.effects.add(life, (ctx, t) => top(ctx, x, y, r, t));
  if (light) world.run?.addLight({ x, y, r: light.r, s: light.s ?? 0.8, rgb: light.rgb, until: world.time + life });
}

/** Hurts every ally within r of (x, y) (a landing boulder, an axe falling); returns those hit. */
function hitAround(world, x, y, r, damage, knock = 0) {
  const hit = [];
  for (const a of world.allies) {
    if (dist(a.x, a.y, x, y) >= r + a.radius) continue;
    if (a.hurt(damage, world, x, y)) {
      hit.push(a);
      if (knock && a.knockback) a.knockback(angleTo(x, y, a.x, a.y), knock);
    }
  }
  return hit;
}

// ---------------------------------------------------------------

/** Squire: a young soldier; quick sword slashes. */
class Squire extends Enemy {
  constructor(x, y) {
    super('squire', x, y);
    this.gibColors = ['#8a2438', '#3e3a48', '#ad9fb0'];
  }

  think(dt, world) {
    this.meleeThink(dt, world, () => { this.swipeFx(world, '230, 200, 210'); Sound.play('slash'); });
  }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const swing = this.state === 'windup' ? -1.3 : this.state === 'recover' ? 0.9 : -0.4;
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.sword, (f > 0 ? 0 : Math.PI) + swing * f);
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Castle archer: keeps away and looses arrows (red aim line, which locks just before it fires). */
class CastleArcher extends Enemy {
  constructor(x, y) {
    super('castleArcher', x, y);
    this.aim = 0;
    this.gibColors = ['#8a2438', '#5b3922', '#ad9fb0'];
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
          enemyShot(world, this.hx + Math.cos(this.aim) * 14, this.hy + Math.sin(this.aim) * 14, this.aim, c.arrowSpeed, {
            radius: 4, damage: c.damage, life: 3, sprite: Sprites.projectiles.castleArrow, trail: ['#8a2438'],
          });
          Sound.play('enemyArrow');
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
    const bow = Sprites.weapons.bow;
    const behind = Math.sin(this.aim) < -0.35;
    const drawBow = () => {
      ctx.globalAlpha = this.spawnAlpha;
      const pull = this.state === 'windup' ? 4 : 10;
      drawRotated(ctx, bow.img, this.hx + Math.cos(this.aim) * pull, this.hy + 2 + Math.sin(this.aim) * pull * 0.7, bow.pivotX, bow.pivotY, this.aim);
      ctx.globalAlpha = 1;
    };
    if (behind) drawBow();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (!behind) drawBow();
    this.drawHealthBar(ctx);
  }
}

/**
 * Minstrel: plays a war song. Every other enemy inside its aura recovers faster between
 * attacks (a little red note bobs over them while it does). Plinks a note at you now and then.
 */
class Minstrel extends Enemy {
  constructor(x, y) {
    super('minstrel', x, y);
    this.noteTimer = this.cfg.noteEvery * rand(0.5, 1);
    this.gibColors = ['#8a2438', '#46286a', '#e8e0d0'];
  }

  think(dt, world) {
    const c = this.cfg;
    for (const e of world.enemies) {
      if (e === this || e.dead || dist(e.x, e.y, this.x, this.y) > c.auraRadius) continue;
      e.attackCooldown -= dt * c.attackSpeed;
      e.hasted = 0.25;
      if (vrand(0, 1) < dt * 1.5) {
        // a note drifting from the lute to them (visual only)
        const tx = e.x;
        const ty = e.y - 40;
        const sx = this.x + this.facing * 8;
        const sy = this.hy;
        world.effects.add(0.7, (ctx, t) => {
          ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) * 5;
          const img = Sprites.projectiles.redNote;
          ctx.drawImage(img, Math.round(lerp(sx, tx, t) - 6), Math.round(lerp(sy, ty, t) - Math.sin(t * Math.PI) * 20 - 8));
          ctx.globalAlpha = 1;
        });
      }
    }
    const p = this.target(world);
    if (p.dead) return;
    kite(this, world, p, dt);
    this.noteTimer -= dt;
    if (this.noteTimer <= 0 && this.distanceTo(p) < c.preferredMax + 100) {
      this.noteTimer = c.noteEvery + rand(0, 0.8);
      const a = angleTo(this.hx, this.hy, p.hx, p.hy);
      enemyShot(world, this.hx + Math.cos(a) * 12, this.hy + Math.sin(a) * 12, a, c.noteSpeed, {
        radius: 6, damage: c.damage, sprite: Sprites.projectiles.redNote, upright: true, glow: '255, 110, 130', trail: ['#c0384a', '#ff9aa8'],
      });
      Sound.play('magic', 0.1);
    }
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    // the reach of its song: a faint dashed ring of crimson
    PFX.ring(ctx, this.x, this.y, this.cfg.auraRadius, this.cfg.auraRadius * 0.6, 'rgba(255, 100, 130, 0.22)', 2, { dash: [3, 5], spin: this.animTime * 0.4 });
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // the lute held across the body, bouncing with the strum
    const f = this.facing;
    const strum = Math.sin(this.animTime * 14) * 0.08;
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.lute, (f > 0 ? -0.55 : Math.PI + 0.55) + strum, 2, 6);
    ctx.globalAlpha = 1;
    // notes rising off it
    for (let i = 0; i < 2; i++) {
      const k = (this.animTime * 0.7 + i * 0.5) % 1;
      ctx.globalAlpha = (1 - k) * this.spawnAlpha;
      ctx.drawImage(Sprites.projectiles.redNote, Math.round(this.x + f * (6 + k * 10) + Math.sin(k * 6 + i) * 3 - 6), Math.round(this.y - 38 - k * 20));
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Squire with a gun: aims along a long red line, fires one heavy ball, then reloads (slowly). */
class Gunner extends Enemy {
  constructor(x, y) {
    super('gunner', x, y);
    this.aim = 0;
    this.recoil = 0;
    this.gibColors = ['#8a2438', '#5e5a6c', '#ad9fb0'];
  }

  update(dt, world) {
    super.update(dt, world);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.state === 'windup') this.aimEnd = world.dungeon.raycast(this.hx, this.hy, this.aim, 900);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 140) { this.setState('windup'); Sound.play('bowDraw'); }
        break;
      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt) { this.aim = angleTo(this.hx, this.hy, p.hx, p.hy); this.faceToward(p.x); }
        if (this.stateTime >= c.windup) this.fire(world);
        break;
      case 'reload':
        if (this.stateTime >= c.reload) { this.setState('chase'); this.attackCooldown = rand(0.2, 0.8); }
        break;
    }
  }

  fire(world) {
    const c = this.cfg;
    const mx = this.hx + Math.cos(this.aim) * 30;
    const my = this.hy + 2 + Math.sin(this.aim) * 30;
    enemyShot(world, mx, my, this.aim, c.bulletSpeed, {
      radius: 5, damage: c.damage, sprite: Sprites.projectiles.musketBall, trail: ['#d8d0c0', '#8a8290'], glow: '255, 210, 150',
    });
    // a crack, a flash and a big cloud of powder smoke
    world.effects.burst(mx, my, { count: 10, colors: ['#ffffff', '#ffe0a0', '#ff8a3a'], speed: [60, 200], life: [0.06, 0.18], angle: this.aim, spread: 0.7, size: [1, 3] });
    world.effects.smoke(mx, my, { count: 6, radius: 12, life: 0.9, rise: 14, colors: ['#4a4652', '#7a7684', '#b0acb8'] });
    world.shake(2, 0.1);
    Sound.play('musket');
    this.recoil = 1;
    this.setState('reload');
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = this.aimEnd || { x: this.hx, y: this.hy };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, 3, this.stateTime / this.cfg.windup);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    const reloading = this.state === 'reload';
    // reloading: the gun tipped up, the ramrod working up and down the barrel
    const a = reloading ? (this.facing > 0 ? -1.2 : Math.PI + 1.2) : this.aim - Math.sign(Math.cos(this.aim)) * this.recoil * 0.4;
    holdWeapon(ctx, this, Sprites.weapons.musket, a, 4 - this.recoil * 4, 4);
    if (reloading) {
      const k = Math.abs(Math.sin(this.stateTime * 6));
      const bx = this.x + this.facing * 4 + Math.cos(a) * 34;
      const by = this.hy + 4 + Math.sin(a) * 34;
      ctx.strokeStyle = '#7d532f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by - 6 - k * 10);
      ctx.lineTo(bx, by + 4 - k * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Catapult: never moves; winds back its arm, then hurls a boulder that lands on the red circle. */
class Catapult extends Enemy {
  constructor(x, y, type = 'catapult') {
    super(type, x, y);
    this.anchor = CATAPULT_ANCHOR;
    this.hitOffY = 18;
    this.barOffset = 64;
    this.hw = 22;
    this.hh = 10;
    this.arm = 0;        // 0 at rest .. -1 wound back .. 1 swung forward
    this.attackCooldown = rand(1, 2.5);
    this.gibColors = ['#5b3922', '#7d532f', '#3e3a48'];
  }

  get flaming() { return false; }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        this.arm = Math.min(0, this.arm + dt * 1.5);
        if (p.dead || this.attackCooldown > 0 || this.distanceTo(p) > c.range) return;
        this.faceToward(p.x);
        this.setState('windup');
        Sound.play('fistCharge');
        break;
      case 'windup':
        this.arm = -Math.min(1, this.stateTime / c.windup);
        if (!p.dead) this.faceToward(p.x);
        if (this.stateTime >= c.windup) {
          this.setState('release');
          this.aimAt = p.dead ? null : { x: p.x + rand(-16, 16), y: p.y + rand(-12, 12) };
        }
        break;
      case 'release':
        this.arm = Math.min(1, -1 + this.stateTime * 9);
        if (this.arm >= 1) {
          if (this.aimAt) this.hurl(world, this.aimAt);
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.6) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  /** Where the bucket is (world space) for an arm angle. */
  bucketAt(armAngle) {
    const f = this.facing;
    const a = f > 0 ? armAngle : Math.PI - armAngle;
    const px = this.x + (34 - this.anchor.x) * f;
    const py = this.y + (18 - this.anchor.y);
    return { x: px + Math.cos(a) * 44, y: py + Math.sin(a) * 44 };
  }

  get armAngle() {
    // rest lies back over the frame; wound back lower; swung up and over the front
    const rest = Math.PI - 0.25;
    if (this.arm <= 0) return rest - this.arm * 0.2;
    return lerp(rest + 0.2, Math.PI * 1.5 + 0.35, this.arm);
  }

  hurl(world, at) {
    const c = this.cfg;
    const from = this.bucketAt(this.armAngle);
    const flame = this.flaming;
    const damage = c.damage;
    const scale = world.enemyScale ? world.enemyScale.damage : 1;
    Sound.play('catapult');
    world.shake(2, 0.15);
    world.effects.burst(from.x, from.y, { count: 8, colors: ['#8a8070', '#5b3922'], speed: [30, 100], life: [0.2, 0.4] });
    lobShot(world, from.x, from.y, at.x, at.y, c.flight, {
      sprite: flame ? Sprites.projectiles.flameBoulder : Sprites.projectiles.boulder,
      radius: c.blastRadius, height: 150, spin: 5, rgb: flame ? '255, 120, 40' : '255, 60, 60',
      trail: flame ? ['#ffd34a', '#ff8a1e', '#e0461e'] : null,
      onLand: (w) => {
        hitAround(w, at.x, at.y, c.blastRadius, damage, 220);
        // a crash of stone: dust, shards and a crater
        w.effects.add(1.6, (ctx, t) => {
          ctx.save();
          ctx.globalAlpha = 0.55 * (1 - t);
          PFX.disc(ctx, at.x, at.y, c.blastRadius * 0.5, c.blastRadius * 0.28, '#1a1418');
          ctx.restore();
        }, true);
        w.effects.add(0.35, (ctx, t) => {
          ctx.save();
          ctx.globalAlpha = 1 - t;
          PFX.ring(ctx, at.x, at.y, c.blastRadius * (0.4 + t * 0.7), c.blastRadius * 0.55 * (0.4 + t * 0.7), '#e8dcc8', 2, { thick: t < 0.3 ? 3 : 1 });
          ctx.restore();
        });
        w.effects.burst(at.x, at.y - 6, { count: 26, colors: ['#4a4652', '#6a6676', '#8e8a9c', '#3a2a20'], speed: [80, 240], life: [0.3, 0.7], size: [2, 5], gravity: 300, up: 120 });
        w.effects.smoke(at.x, at.y - 8, { count: 8, radius: c.blastRadius * 0.5, life: 0.9, rise: 20, colors: ['#3e3a48', '#5e5a6c', '#8e8a9e'] });
        w.shake(5, 0.25);
        Sound.play('impact');
        if (flame) this.ignite(w, at, scale);
      },
    });
  }

  ignite() {}

  drawTelegraph(ctx) {
    if (this.state === 'windup') Telegraph.circle(ctx, this.x, this.y + 4, 30, this.stateTime / this.cfg.windup, '255, 150, 40');
  }

  draw(ctx) {
    const fr = this.frames;
    const flip = this.facing < 0;
    const alpha = this.spawnAlpha;
    // the arm swings behind the A-frame's near side: arm first, then the body over it
    const a = this.armAngle;
    const pivot = { x: this.x + (34 - this.anchor.x) * this.facing, y: this.y + (18 - this.anchor.y) };
    const drawArm = (img) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pivot.x, pivot.y);
      if (flip) ctx.scale(-1, 1);
      ctx.rotate(a);
      ctx.drawImage(img, -fr.armPivot.x, -fr.armPivot.y);
      ctx.restore();
    };
    drawArm(fr.arm.img);
    if (this.flashTime > 0) drawArm(fr.arm.flash);
    // the boulder sits in the bucket until it flies
    if (this.state === 'chase' || this.state === 'windup' || (this.state === 'release' && this.arm < 0.95)) {
      const b = this.bucketAt(a);
      const img = this.flaming ? Sprites.projectiles.flameBoulder : Sprites.projectiles.boulder;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - img.height / 2 - 4));
      ctx.globalAlpha = 1;
      if (this.flaming && vrand(0, 1) < 0.5) PFX.flame(ctx, b.x, b.y - 8, 8, 12, this.animTime * 8, FIRE_COLORS);
    }
    this.drawFrame(ctx, fr.base, this.anchor, alpha);
    if (this.flaming) {
      const bx = this.x + (6 - this.anchor.x) * this.facing;
      PFX.flame(ctx, bx, this.y - 30, 8, 12, this.animTime * 8, FIRE_COLORS);
    }
    this.drawHealthBar(ctx);
  }
}

/** Flaming catapult (stage 2+): tougher, its burning boulders hit harder and leave fire that burns. */
class FlamingCatapult extends Catapult {
  constructor(x, y) {
    super(x, y, 'flamingCatapult');
    this.gibColors = ['#46301e', '#ff8a1e', '#3e3a48'];
  }

  get flaming() { return true; }

  ignite(world, at, scale) {
    const c = this.cfg;
    const dps = c.burnDps * scale;
    Sound.play('fireballCast', 0.1);
    groundZone(world, {
      x: at.x, y: at.y, r: c.fireRadius, life: c.fireTime, every: 0.25,
      tick: (w, x, y, r) => {
        for (const a of w.allies) if (dist(a.x, a.y, x, y) < r + a.radius * 0.5) a.burn?.(dps, c.burnTime, w);
        if (vrand(0, 1) < 0.9) w.effects.flames(x + vrand(-r * 0.7, r * 0.7), y + vrand(-r * 0.35, r * 0.35), { count: 1, height: vrand(16, 26), width: vrand(8, 12), life: 0.5 });
      },
      draw: (ctx, x, y, r, t) => {
        const k = t < 0.85 ? 1 : (1 - t) / 0.15;
        ctx.save();
        ctx.globalAlpha = 0.6 * k;
        PFX.disc(ctx, x, y, r, r * 0.55, '#2a0e06');
        ctx.globalAlpha = 0.8 * k;
        PFX.ring(ctx, x, y, r * 0.9, r * 0.5, '#a8200e', 2, { dash: [3, 3] });
        ctx.restore();
      },
      // tongues of flame dancing all over the patch, above the gloom
      top: (ctx, x, y, r, t) => {
        const k = t < 0.85 ? 1 : (1 - t) / 0.15;
        const secs = t * c.fireTime;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 6, r * 1.05, '255, 110, 30', 0.55 * k * (0.85 + Math.sin(secs * 13) * 0.15), 2, r * 0.6);
        ctx.restore();
        ctx.globalAlpha = k;
        for (let i = 0; i < 11; i++) {
          const a = i * 2.4;
          const d = (i % 4) / 3.6;
          const fx = x + Math.cos(a) * r * d;
          const fy = y + Math.sin(a) * r * 0.5 * d;
          const lick = 1 + Math.sin(secs * 7 + i * 2.3) * 0.25;
          PFX.flame(ctx, fx, fy, 12, (16 + (i % 3) * 7) * lick, secs * 9 + i * 1.7, FIRE_COLORS);
        }
        ctx.globalAlpha = 1;
      },
      light: { r: c.fireRadius * 2.4, rgb: '255, 130, 50', s: 0.95 },
    });
  }
}

/** Mace spinner: up close it whirls both maces round, hurting everyone near, then reels dizzily. */
class MaceSpinner extends Enemy {
  constructor(x, y) {
    super('maceSpinner', x, y);
    this.spinAngle = 0;
    this.tick = 0;
    this.gibColors = ['#5b3922', '#ad9fb0', '#3e3a48'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        this.moveToward(world, p.x, p.y, this.speed, dt);
        if (this.distanceTo(p) < c.spinRange && this.attackCooldown <= 0) { this.setState('windup'); Sound.play('windup'); }
        break;
      case 'windup':
        this.spinAngle += dt * 8 * (this.stateTime / c.spinWindup);
        if (this.stateTime >= c.spinWindup) { this.setState('spin'); this.tick = 0; }
        break;
      case 'spin': {
        this.spinAngle += dt * 22;
        if (!p.dead) this.moveToward(world, p.x, p.y, c.spinSpeed, dt);
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = c.tickEvery;
          for (const a of world.allies) {
            if (dist(a.x, a.y, this.x, this.y) < c.spinRadius + a.radius) a.hurt(c.damage, world, this.x, this.y);
          }
          Sound.play('slash', 0.1);
          world.effects.burst(this.x + Math.cos(this.spinAngle) * c.spinRadius * 0.6, this.y - 12 + Math.sin(this.spinAngle) * c.spinRadius * 0.3, { count: 3, colors: ['#ffffff', '#c4c0d0'], speed: [40, 120], life: [0.1, 0.25] });
        }
        if (this.stateTime >= c.spinTime) { this.setState('dizzy'); Sound.play('bounce'); }
        break;
      }
      case 'dizzy':
        this.spinAngle += dt * 3 * Math.max(0, 1 - this.stateTime);
        if (this.stateTime >= c.dizzy) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state === 'windup') Telegraph.circle(ctx, this.x, this.y, this.cfg.spinRadius, this.stateTime / this.cfg.spinWindup);
  }

  draw(ctx) {
    const spinning = this.state === 'spin' || this.state === 'windup';
    const c = this.cfg;
    const cy = this.hy + 2;
    // the maces on their chains: hanging at its sides, or whirling round in a blur
    const heads = [];
    if (spinning) {
      const r = this.state === 'spin' ? c.spinRadius * 0.7 : 14 + 10 * (this.stateTime / c.spinWindup);
      for (const k of [0, Math.PI]) heads.push({ x: this.x + Math.cos(this.spinAngle + k) * r, y: cy + Math.sin(this.spinAngle + k) * r * 0.45 });
    } else {
      for (const s of [-1, 1]) heads.push({ x: this.x + s * 14 + Math.sin(this.animTime * 3 + s) * 2, y: this.y - 6 });
    }
    if (this.state === 'spin') {
      // a whirl of steel round it
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        const a0 = this.spinAngle - i * 0.35;
        PFX.ring(ctx, this.x, cy, c.spinRadius * 0.7, c.spinRadius * 0.32, i ? 'rgba(196, 192, 208, 0.35)' : 'rgba(255, 255, 255, 0.7)', 2, { from: a0 - 0.6, to: a0 });
        PFX.ring(ctx, this.x, cy, c.spinRadius * 0.7, c.spinRadius * 0.32, i ? 'rgba(196, 192, 208, 0.35)' : 'rgba(255, 255, 255, 0.7)', 2, { from: a0 + Math.PI - 0.6, to: a0 + Math.PI });
      }
      ctx.restore();
    }
    const back = heads.filter((h) => h.y < cy);
    const front = heads.filter((h) => h.y >= cy);
    const drawHead = (h) => {
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.x + (h.x > this.x ? 8 : -8), this.hy + 4); ctx.lineTo(h.x, h.y); ctx.stroke();
      const img = Sprites.weapons.mace.img;
      ctx.drawImage(img, Math.round(h.x - 19), Math.round(h.y - 7), img.width, img.height);
    };
    ctx.globalAlpha = this.spawnAlpha;
    back.forEach(drawHead);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    front.forEach(drawHead);
    ctx.globalAlpha = 1;
    if (this.state === 'dizzy') {
      // dizzy: little stars wobbling round its head
      for (let i = 0; i < 3; i++) {
        const a = this.animTime * 7 + (i * TAU) / 3;
        PFX.star(ctx, this.x + Math.cos(a) * 11, this.y - this.barOffset - 4 + Math.sin(a) * 3, 2, '#ffe680', '#ffffff');
      }
    }
    this.drawHealthBar(ctx);
  }
}

/** Bishop: fires slow holy orbs and every few seconds blesses the ground, healing every enemy (and boss) inside. */
class Bishop extends Enemy {
  constructor(x, y) {
    super('bishop', x, y);
    this.orbTimer = 1.5;
    this.healTimer = this.cfg.healEvery * rand(0.4, 0.8);
    this.gibColors = ['#46286a', '#c8a456', '#b4acb8'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (this.state === 'bless') {
      if (this.stateTime >= c.healWindup) {
        this.bless(world);
        this.setState('chase');
      }
      return;
    }
    if (p.dead) return;
    kite(this, world, p, dt);
    this.orbTimer -= dt;
    if (this.orbTimer <= 0) {
      this.orbTimer = c.orbEvery + rand(0, 0.6);
      const a = angleTo(this.hx, this.hy, p.hx, p.hy);
      enemyShot(world, this.hx + Math.cos(a) * 12, this.hy + Math.sin(a) * 12, a, c.orbSpeed, {
        radius: 6, damage: c.damage, sprite: Sprites.projectiles.holyOrb, spin: 4, glow: '255, 220, 120', trail: ['#fff6d0', '#e0c060'],
      });
      Sound.play('magic', 0.1);
    }
    this.healTimer -= dt;
    if (this.healTimer <= 0) {
      this.healTimer = c.healEvery;
      // only when someone nearby is hurt
      const hurt = world.enemies.some((e) => !e.dead && e.hp < e.maxHp && dist(e.x, e.y, this.x, this.y) < c.healRadius)
        || (world.boss && world.boss.hp < world.boss.maxHp && dist(world.boss.x, world.boss.y, this.x, this.y) < c.healRadius * 1.6);
      if (hurt) { this.setState('bless'); Sound.play('laserCharge', 0.2); }
    }
  }

  bless(world) {
    const c = this.cfg;
    const pillar = (x, y) => world.effects.add(0.8, (ctx, t) => {
      const w = 14 * (1 - t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y - 90, 0, y);
      g.addColorStop(0, 'rgba(255, 230, 140, 0)');
      g.addColorStop(1, `rgba(255, 230, 140, ${0.5 * (1 - t)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y - 90, w, 90);
      ctx.restore();
    });
    for (const e of world.enemies) {
      if (e.dead || dist(e.x, e.y, this.x, this.y) > c.healRadius) continue;
      const amount = Math.round(e.maxHp * c.healAmount);
      const before = e.hp;
      e.hp = Math.min(e.maxHp, e.hp + amount);
      if (e.hp > before) {
        world.effects.text(e.hx, e.hy - 26, `+${Math.round(e.hp - before)}`, { color: '#8cf08a', size: 8 });
        pillar(e.x, e.y);
      }
    }
    const b = world.boss;
    if (b && !b.dead && b.heal && dist(b.x, b.y, this.x, this.y) < c.healRadius * 1.6) {
      b.heal(b.maxHp * c.bossHeal, world);
      pillar(b.x, b.y);
      // a beam of light from the bishop to the boss
      const sx = this.x;
      const sy = this.y - 40;
      world.effects.add(0.5, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255, 230, 140, ${0.8 * (1 - t)})`;
        ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(b.hx, b.hy); ctx.stroke();
        ctx.restore();
      });
    }
    world.effects.add(0.6, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, this.x, this.y, c.healRadius * (0.3 + t * 0.7), c.healRadius * 0.6 * (0.3 + t * 0.7), '#ffe680', 2, { thick: 2 });
      ctx.restore();
    }, true);
    world.effects.burst(this.x, this.y - 40, { count: 20, colors: ['#ffe680', '#fff6d0', '#8cf08a'], speed: [30, 120], life: [0.4, 0.8], up: 40 });
    Sound.play('blessing');
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    if (this.state !== 'bless') return;
    // not a danger to heroes, so no telegraph: a soft gold ring closing in as the blessing gathers
    const k = this.stateTime / this.cfg.healWindup;
    const R = this.cfg.healRadius;
    ctx.save();
    ctx.globalAlpha = 0.5;
    PFX.ring(ctx, this.x, this.y, R, R * 0.55, 'rgba(255, 220, 110, 0.6)', 2, { dash: [4, 6], spin: this.stateTime * 0.8 });
    ctx.globalAlpha = 0.25 + k * 0.5;
    PFX.ring(ctx, this.x, this.y, R * (1 - k * 0.7), R * 0.55 * (1 - k * 0.7), '#ffe680', 2);
    ctx.restore();
    // a slowly turning cross of light on the floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.x, this.y);
    ctx.scale(1, 0.5);
    ctx.rotate(this.stateTime);
    ctx.fillStyle = `rgba(255, 230, 140, ${0.35 * k})`;
    ctx.fillRect(-4, -40, 8, 80);
    ctx.fillRect(-40, -4, 80, 8);
    ctx.restore();
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const raise = this.state === 'bless';
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.crosier, raise ? -Math.PI / 2 + f * 0.15 : (f > 0 ? -1.2 : Math.PI + 1.2), 8, raise ? 0 : 6);
    ctx.globalAlpha = 1;
    if (raise) {
      const k = Math.min(1, this.stateTime / this.cfg.healWindup);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x + f * 8, this.hy - 46, 8 + k * 14, '255, 230, 140', 0.6 + k * 0.6);
      ctx.restore();
    }
    this.drawHealthBar(ctx);
  }
}

/**
 * Knight: sword and kite shield. When struck it may raise the shield (blockChance): for
 * a moment every hit from the front glances off. Royal guards build on this.
 */
class CastleKnight extends Enemy {
  constructor(x, y, type = 'castleKnight') {
    super(type, x, y);
    this.blocking = 0;
    this.blockCooldown = 0;
    this.gibColors = ['#3e3a48', '#8a2438', '#8e8a9e'];
  }

  get shieldSprite() { return Sprites.weapons.kiteShield; }

  update(dt, world) {
    this.blocking -= dt;
    this.blockCooldown -= dt;
    super.update(dt, world);
  }

  /** Who is hitting it right now (for which side the blow comes from). */
  attackerX(world) {
    const src = world.actor || world.nearestHero(this.x, this.y);
    return src ? src.x : this.x + this.facing;
  }

  takeDamage(amount, world) {
    if (this.dead) return false;
    const fromFront = Math.sign(this.attackerX(world) - this.x || this.facing) === this.facing;
    if (this.blocking > 0 && fromFront) {
      this.flashTime = 0.06;
      world.effects.text(this.hx, this.hy - 30, 'BLOCKED', { color: '#c4c0d0', size: 7 });
      world.effects.burst(this.hx + this.facing * 12, this.hy, { count: 10, colors: ['#ffffff', '#ffe680', '#8e8a9e'], speed: [60, 180], life: [0.1, 0.3] });
      Sound.play('bounce');
      return false;
    }
    const ok = super.takeDamage(amount, world);
    const c = this.cfg;
    if (ok && !this.dead && this.blockCooldown <= 0 && this.state === 'chase' && Math.random() < c.blockChance) {
      this.blocking = c.blockTime;
      this.blockCooldown = c.blockCooldown + c.blockTime;
      this.faceToward(this.attackerX(world));
      Sound.play('windup');
    }
    return ok;
  }

  think(dt, world) {
    if (this.blocking > 0 && this.state === 'chase') {
      // shield up: edge in slowly behind it
      const p = this.target(world);
      if (!p.dead) {
        this.moveToward(world, p.x, p.y, this.speed * 0.35, dt);
        this.faceToward(p.x);
      }
      return;
    }
    this.meleeThink(dt, world, () => { this.swipeFx(world, '200, 196, 220'); Sound.play('heavySwing'); });
  }

  drawTelegraph(ctx) { this.drawMeleeTelegraph(ctx); }

  draw(ctx) {
    const f = this.facing;
    const sh = this.shieldSprite;
    const up = this.blocking > 0;
    ctx.globalAlpha = this.spawnAlpha;
    // shield on the off arm (behind) or raised before it
    if (!up) drawRotated(ctx, sh.img, this.x - f * 7, this.hy + 4, sh.pivotX, sh.pivotY, 0, false);
    ctx.globalAlpha = 1;
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    const swing = this.state === 'windup' ? -1.4 : this.state === 'recover' ? 0.9 : -0.4;
    holdWeapon(ctx, this, Sprites.weapons.sword, (f > 0 ? 0 : Math.PI) + swing * f);
    if (up) {
      drawRotated(ctx, sh.img, this.x + f * 12, this.hy + 2, sh.pivotX, sh.pivotY, 0, false);
      const k = Math.min(1, this.blocking * 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x + f * 12, this.hy + 2, 16, '220, 220, 255', 0.25 * k);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** Royal guard (stage 2+): a stronger knight with a tower shield that also charges along a red lane. */
class RoyalGuard extends CastleKnight {
  constructor(x, y) {
    super(x, y, 'royalGuard');
    this.chargeTimer = this.cfg.chargeEvery * rand(0.4, 0.9);
    this.barOffset = 52;
    this.gibColors = ['#3e3a48', '#c8a456', '#8a2438'];
  }

  get shieldSprite() { return Sprites.weapons.towerShield; }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.chargeTimer -= dt;
    if (this.state === 'chargeWindup') {
      if (this.stateTime < c.chargeWindup * 0.6 && !p.dead) this.aimCharge(world, p);
      if (this.stateTime >= c.chargeWindup) { this.setState('charge'); this.charged = 0; this.chargeHits = new Set(); Sound.play('dash'); }
      return;
    }
    if (this.state === 'charge') {
      const step = c.chargeSpeed * dt;
      const x0 = this.x;
      const y0 = this.y;
      world.dungeon.move(this, Math.cos(this.chargeAngle) * step, Math.sin(this.chargeAngle) * step);
      this.charged += step;
      const scale = world.enemyScale ? world.enemyScale.damage : 1;
      for (const a of world.allies) {
        if (this.chargeHits.has(a) || pointSegmentDistance(a.x, a.y, x0, y0, this.x, this.y) > c.chargeWidth / 2 + a.radius) continue;
        this.chargeHits.add(a);
        if (a.hurt(Math.round(c.chargeDamage * scale), world, this.x, this.y)) a.knockback?.(this.chargeAngle, 320);
      }
      if (vrand(0, 1) < 0.6) world.effects.burst(this.x, this.y, { count: 2, colors: ['#5e5a6c', '#8e8a9e'], speed: [20, 60], life: [0.2, 0.4] });
      if (this.charged >= c.chargeDistance || dist(x0, y0, this.x, this.y) < step * 0.3) {
        world.shake(3, 0.15);
        this.setState('recover');
        this.attackCooldown = 0.4;
      }
      return;
    }
    if (this.state === 'chase' && this.blocking <= 0 && this.chargeTimer <= 0 && !p.dead) {
      const d = this.distanceTo(p);
      if (d > c.chargeRange[0] && d < c.chargeRange[1]) {
        this.chargeTimer = c.chargeEvery;
        this.aimCharge(world, p);
        this.setState('chargeWindup');
        Sound.play('windup');
        return;
      }
    }
    super.think(dt, world);
  }

  aimCharge(world, p) {
    this.chargeAngle = angleTo(this.x, this.y, p.x, p.y);
    this.faceToward(p.x);
    const end = world.dungeon.raycast(this.x, this.y, this.chargeAngle, this.cfg.chargeDistance);
    this.chargeEnd = end;
  }

  drawTelegraph(ctx) {
    super.drawTelegraph(ctx);
    if (this.state === 'chargeWindup' && this.chargeEnd) {
      Telegraph.line(ctx, this.x, this.y, this.chargeEnd.x, this.chargeEnd.y, this.cfg.chargeWidth, this.stateTime / this.cfg.chargeWindup);
    }
  }

  draw(ctx) {
    const s = 1.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.translate(-this.x, -this.y);
    super.draw(ctx);
    ctx.restore();
  }
}

/** Cavalry: two spear lunges along red lanes, then it rides you down for a while, stabbing as it passes. */
class Cavalry extends Enemy {
  constructor(x, y) {
    super('cavalry', x, y);
    this.anchor = CAVALRY_ANCHOR;
    this.hitOffY = 26;
    this.barOffset = 76;
    this.hw = 16;
    this.hh = 9;
    this.lungesLeft = 0;
    this.heading = 0;
    this.stab = 0;
    this.stabTimer = 0;
    this.gibColors = ['#1a1620', '#8a2438', '#8e8a9e'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.stab = Math.max(0, this.stab - dt * 4);
    switch (this.state) {
      case 'chase': {
        if (p.dead) return;
        const d = this.distanceTo(p);
        if (d > 230) this.moveToward(world, p.x, p.y, this.speed, dt);
        else if (d < 120) this.moveAngle(world, angleTo(p.x, p.y, this.x, this.y), this.speed * 0.8, dt);
        this.faceToward(p.x);
        if (this.attackCooldown <= 0 && d < 300) { this.lungesLeft = c.lunges; this.beginLunge(world, p); }
        break;
      }
      case 'lungeWindup':
        if (this.stateTime < c.lungeWindup * 0.6 && !p.dead) this.aimLunge(world, p);
        if (this.stateTime >= c.lungeWindup) { this.setState('lunge'); this.lungeHits = new Set(); this.lunged = 0; Sound.play('dash'); }
        break;
      case 'lunge': {
        const step = (c.lungeDistance / c.lungeTime) * dt;
        const x0 = this.x;
        const y0 = this.y;
        world.dungeon.move(this, Math.cos(this.heading) * step, Math.sin(this.heading) * step);
        this.lunged += step;
        this.moving = true;
        this.stab = 1;
        for (const a of world.allies) {
          if (this.lungeHits.has(a) || pointSegmentDistance(a.x, a.y, x0, y0, this.x, this.y) > c.lungeWidth / 2 + a.radius) continue;
          this.lungeHits.add(a);
          if (a.hurt(c.damage, world, this.x, this.y)) a.knockback?.(this.heading, 260);
        }
        if (this.lunged >= c.lungeDistance || dist(x0, y0, this.x, this.y) < step * 0.3) {
          this.lungesLeft--;
          this.setState('lungeGap');
        }
        break;
      }
      case 'lungeGap':
        if (this.stateTime < c.lungeGap) break;
        if (this.lungesLeft > 0 && !p.dead) this.beginLunge(world, p);
        else { this.setState('ride'); this.heading = p.dead ? this.heading : angleTo(this.x, this.y, p.x, p.y); Sound.play('gallop'); }
        break;
      case 'ride': {
        // gallops after the hero, turning only so fast, the lance couched
        if (!p.dead) {
          const want = angleTo(this.x, this.y, p.x, p.y);
          this.heading += clamp(angleDiff(this.heading, want), -c.turnRate * dt, c.turnRate * dt);
        }
        const x0 = this.x;
        const y0 = this.y;
        this.moveAngle(world, this.heading, c.rideSpeed, dt);
        if (dist(x0, y0, this.x, this.y) < c.rideSpeed * dt * 0.3) this.heading += Math.PI * 0.6;   // ran into a wall: wheel round
        this.stabTimer -= dt;
        for (const a of world.allies) {
          if (this.stabTimer > 0) break;
          const d = dist(this.x, this.y, a.x, a.y);
          const ahead = Math.abs(angleDiff(this.heading, angleTo(this.x, this.y, a.x, a.y))) < 0.7;
          if (d < c.stabRange + a.radius && ahead) {
            if (a.hurt(c.damage, world, this.x, this.y)) a.knockback?.(this.heading, 200);
            this.stab = 1;
            this.stabTimer = c.stabEvery;
            Sound.play('thrust', 0.1);
          }
        }
        if (vrand(0, 1) < 0.25) world.effects.burst(this.x - Math.cos(this.heading) * 20, this.y, { count: 1, colors: ['#4a4652', '#2e2a36'], speed: [10, 30], life: [0.3, 0.5] });
        if (this.stateTime >= c.rideTime) this.setState('rest');
        break;
      }
      case 'rest':
        if (this.stateTime >= c.rest) { this.setState('chase'); this.attackCooldown = rand(0.3, 0.8); }
        break;
    }
  }

  beginLunge(world, p) {
    this.aimLunge(world, p);
    this.setState('lungeWindup');
    Sound.play('windup');
  }

  aimLunge(world, p) {
    this.heading = angleTo(this.x, this.y, p.x, p.y);
    this.faceToward(p.x);
    this.lungeEnd = world.dungeon.raycast(this.x, this.y, this.heading, this.cfg.lungeDistance);
  }

  /** Stuns and knockback barely move a warhorse mid-charge. */
  stun(duration) {
    if (this.state === 'lunge' || this.state === 'ride') return;
    super.stun(duration);
  }

  drawTelegraph(ctx) {
    if (this.state === 'lungeWindup' && this.lungeEnd) {
      Telegraph.line(ctx, this.x, this.y, this.lungeEnd.x, this.lungeEnd.y, this.cfg.lungeWidth, this.stateTime / this.cfg.lungeWindup);
    }
  }

  draw(ctx) {
    const riding = this.state === 'ride' || this.state === 'lunge';
    const frames = this.frames;
    const list = this.moving || riding ? frames.walk : frames.idle;
    const fps = riding ? 14 : this.moving ? 10 : 2;
    const frame = list[Math.floor(this.animTime * fps) % list.length];
    // rearing back a little while it winds up a lunge
    const rear = this.state === 'lungeWindup' ? Math.min(1, this.stateTime / this.cfg.lungeWindup) : 0;
    ctx.save();
    if (rear) {
      ctx.translate(this.x, this.y);
      ctx.rotate(-this.facing * rear * 0.12);
      ctx.translate(-this.x, -this.y);
    }
    this.drawFrame(ctx, frame, this.anchor, this.spawnAlpha);
    // the lance: couched forward along the heading while it attacks, raised otherwise
    const f = this.facing;
    const a = this.state === 'lungeWindup' || this.state === 'lunge' || this.state === 'ride'
      ? this.heading : (f > 0 ? -0.9 : Math.PI + 0.9);
    const thrust = this.stab * 10;
    const hx = this.x + f * 4 + Math.cos(a) * thrust;
    const hy = this.y - 50 + Math.sin(a) * thrust * 0.6;
    ctx.globalAlpha = this.spawnAlpha;
    const L = Sprites.weapons.lance;
    drawRotated(ctx, L.img, hx, hy, L.pivotX, L.pivotY, a, Math.cos(a) < 0);
    ctx.globalAlpha = 1;
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/**
 * Castle sorcerer: conjures magic bolts in patterns, taking turns: a ring bursting out of
 * itself, a turning spiral, or a circle of bolts that appears round you and closes in.
 * The first time its hp drops below blinkBelow, it teleports away.
 */
class CastleSorcerer extends Enemy {
  constructor(x, y) {
    super('castleSorcerer', x, y);
    this.castTimer = 1.5;
    this.pattern = 0;
    this.pending = [];     // closing-circle bolts waiting to fly: { x, y, tx, ty, t }
    this.gibColors = ['#46286a', '#9a72cc', '#e4cfff'];
  }

  update(dt, world) {
    super.update(dt, world);
    for (const b of this.pending) {
      b.t -= dt;
      if (b.t > 0) continue;
      b.dead = true;
      enemyShot(world, b.x, b.y, angleTo(b.x, b.y, b.tx, b.ty), this.cfg.boltSpeed * 1.2, this.boltOpts());
    }
    removeDead(this.pending);
  }

  boltOpts() {
    return { radius: 6, damage: this.cfg.damage, sprite: Sprites.projectiles.sorcererBolt, spin: 6, glow: '190, 130, 255', trail: ['#9a72cc', '#e4cfff'], life: 4 };
  }

  takeDamage(amount, world) {
    const ok = super.takeDamage(amount, world);
    if (ok && !this.dead && !this.blinked && this.hp < this.maxHp * this.cfg.blinkBelow) this.blink(world);
    return ok;
  }

  /** Teleports to the far side of the room from its target. */
  blink(world) {
    this.blinked = true;
    const p = this.target(world);
    const b = world.dungeon.floorBounds;
    let best = null;
    for (let i = 0; i < 12; i++) {
      const pt = { x: rand(b.left + 60, b.right - 60), y: rand(b.top + 60, b.bottom - 40) };
      const d = p.dead ? 0 : dist(pt.x, pt.y, p.x, p.y);
      if (!best || d > best.d) best = { ...pt, d };
    }
    const pt = world.dungeon.freePoint(best.x, best.y, this.hw, this.hh);
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#46286a', '#9a72cc', '#e4cfff'], speed: [40, 160], life: [0.3, 0.6] });
    this.x = pt.x;
    this.y = pt.y;
    world.effects.burst(this.hx, this.hy, { count: 24, colors: ['#46286a', '#9a72cc', '#e4cfff'], speed: [40, 160], life: [0.3, 0.6] });
    world.effects.text(this.hx, this.hy - 30, 'BLINK', { color: '#e4cfff', size: 7 });
    Sound.play('phantomVanish', 0.2);
    this.setState('chase');
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (this.state === 'cast') {
      if (this.stateTime < c.castWindup) return;
      const kind = ['ring', 'spiral', 'close'][this.pattern++ % 3];
      if (kind === 'ring') {
        const off = rand(0, TAU);
        for (let i = 0; i < c.ringCount; i++) enemyShot(world, this.hx, this.hy, off + (i / c.ringCount) * TAU, c.boltSpeed, this.boltOpts());
        Sound.play('magic');
        this.setState('chase');
      } else if (kind === 'spiral') {
        this.setState('spiral');
        this.spiralAt = rand(0, TAU);
        this.spiralTimer = 0;
      } else {
        if (!p.dead) {
          for (let i = 0; i < c.closeCount; i++) {
            const a = (i / c.closeCount) * TAU;
            this.pending.push({ x: p.x + Math.cos(a) * c.closeRadius, y: p.hy + Math.sin(a) * c.closeRadius * 0.75, tx: p.x, ty: p.hy, t: c.closeDelay });
          }
          Sound.play('laserCharge', 0.2);
        }
        this.setState('chase');
      }
      return;
    }
    if (this.state === 'spiral') {
      this.spiralTimer -= dt;
      while (this.spiralTimer <= 0) {
        this.spiralTimer += c.spiralEvery;
        this.spiralAt += 0.32;
        for (let k = 0; k < c.spiralArms; k++) enemyShot(world, this.hx, this.hy, this.spiralAt + (k / c.spiralArms) * TAU, c.boltSpeed, this.boltOpts());
        Sound.play('eyeLaser', 0.06);
      }
      if (this.stateTime >= c.spiralTime) this.setState('chase');
      return;
    }
    if (p.dead) return;
    kite(this, world, p, dt);
    this.castTimer -= dt;
    if (this.castTimer <= 0 && this.distanceTo(p) < c.preferredMax + 120) {
      this.castTimer = c.castEvery;
      this.setState('cast');
      Sound.play('windup');
    }
  }

  drawGround(ctx) {
    super.drawGround(ctx);
    if (this.state === 'cast') Telegraph.circle(ctx, this.x, this.y + 2, 28, this.stateTime / this.cfg.castWindup, '190, 130, 255');
    // the bolts gathering round their target, their red lines pointing in
    for (const b of this.pending) {
      const k = 1 - b.t / this.cfg.closeDelay;
      Telegraph.line(ctx, b.x, b.y, lerp(b.x, b.tx, 0.6), lerp(b.y, b.ty, 0.6), 6, k, '190, 130, 255');
    }
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // a crystal staff, glowing while it casts
    const f = this.facing;
    const casting = this.state === 'cast' || this.state === 'spiral';
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.staff, casting ? -Math.PI / 2 + f * 0.2 : (f > 0 ? -1.1 : Math.PI + 1.1), 8, casting ? 0 : 6);
    ctx.globalAlpha = 1;
    if (casting) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x + f * 10, this.hy - 34, 14 + Math.sin(this.animTime * 20) * 3, '190, 130, 255', 0.9);
      ctx.restore();
    }
    // the bolts waiting to close in
    for (const b of this.pending) {
      const img = Sprites.projectiles.sorcererBolt;
      const k = 1 - b.t / this.cfg.closeDelay;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, b.x, b.y, 10, '190, 130, 255', 0.6);
      ctx.restore();
      ctx.globalAlpha = Math.min(1, k * 3);
      drawRotated(ctx, img, b.x, b.y, img.width / 2, img.height / 2, this.animTime * 6);
      ctx.globalAlpha = 1;
    }
    this.drawHealthBar(ctx);
  }
}

/**
 * Executioner (stage 2+): a huge overhead axe chop down a red lane in front of it. If a
 * hero below executeBelow of their hp is caught in it, they are executed outright: those
 * heroes get a red skull over their head while an executioner is close.
 */
class Executioner extends Enemy {
  constructor(x, y) {
    super('executioner', x, y);
    this.anchor = EXEC_ANCHOR;
    this.hitOffY = 24;
    this.barOffset = 82;
    this.hw = 13;
    this.hh = 8;
    this.marked = [];
    this.gibColors = ['#141018', '#ad9fb0', '#5a1420'];
  }

  /** Heroes low enough to be executed. */
  doomed(world) {
    return world.heroes.filter((h) => h.hp < h.maxHp * this.cfg.executeBelow && dist(h.x, h.y, this.x, this.y) < 420);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    this.marked = this.doomed(world);
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        this.moveToward(world, p.x, p.y, this.speed, dt);
        if (this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          this.setState('windup');
          Sound.play('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= c.windup) this.chop(world);
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  get chopEnd() {
    return { x: this.x + Math.cos(this.attackAngle) * this.cfg.attackReach, y: this.y + Math.sin(this.attackAngle) * this.cfg.attackReach };
  }

  chop(world) {
    const c = this.cfg;
    const end = this.chopEnd;
    for (const a of world.allies) {
      if (pointSegmentDistance(a.x, a.y, this.x, this.y, end.x, end.y) > c.attackWidth / 2 + a.radius) continue;
      const execute = world.players.includes(a) && a.hp < a.maxHp * c.executeBelow && !a.isInvulnerable;
      // an execution deals exactly what it takes: all their hp, through any shield
      const lethal = Math.ceil(a.hp + (a.aegis ? a.aegis.hp : 0) + 1);
      if (a.hurt(execute ? lethal : c.damage, world, this.x, this.y) && execute && a.dead) {
        world.effects.text(a.hx, a.hy - 44, 'EXECUTED', { color: '#ff3b30', size: 12, life: 1.6 });
        world.shake(10, 0.4);
        Sound.play('execute');
      }
    }
    // the axe bites into the floor: a crack, a spray of stone, a heavy thud
    const ix = lerp(this.x, end.x, 0.75);
    const iy = lerp(this.y, end.y, 0.75);
    world.effects.add(1.4, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.strokeStyle = '#120e16';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = this.attackAngle + (i - 2) * 0.6;
        ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(ix + Math.cos(a) * 26, iy + Math.sin(a) * 14); ctx.stroke();
      }
      ctx.restore();
    }, true);
    world.effects.burst(ix, iy, { count: 18, colors: ['#524c60', '#6e687e', '#3a2a20'], speed: [60, 200], life: [0.3, 0.6], gravity: 300, up: 100, size: [2, 4] });
    world.effects.smoke(ix, iy - 6, { count: 5, radius: 14, life: 0.7, rise: 14, colors: ['#3e3a48', '#5e5a6c', '#8e8a9e'] });
    world.shake(6, 0.25);
    Sound.play('impact');
    this.setState('recover');
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = this.chopEnd;
    const deadly = this.marked.length > 0;
    Telegraph.line(ctx, this.x, this.y, end.x, end.y, this.cfg.attackWidth, this.stateTime / this.cfg.windup, deadly ? '200, 0, 20' : Telegraph.red);
  }

  draw(ctx) {
    const s = 1.2;
    const f = this.facing;
    // the axe: held low, hauled up overhead through the windup, slammed down
    const k = this.state === 'windup' ? Math.min(1, this.stateTime / this.cfg.windup) : 0;
    const down = this.state === 'recover' ? Math.max(0, 1 - this.stateTime / 0.15) : 0;
    let a = f > 0 ? -0.6 : Math.PI + 0.6;
    if (this.state === 'windup') a = f > 0 ? lerp(-0.6, -2.4, k) : lerp(Math.PI + 0.6, Math.PI + 2.4, k);
    if (this.state === 'recover') a = this.attackAngle + f * 0.2 * down;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.translate(-this.x, -this.y);
    const axe = Sprites.weapons.axe;
    const raised = this.state === 'windup' && k > 0.4;
    const drawAxe = () => {
      ctx.globalAlpha = this.spawnAlpha;
      drawRotated(ctx, axe.img, this.x + f * 10, this.y - 30, axe.pivotX, axe.pivotY, a, Math.cos(a) < 0);
      ctx.globalAlpha = 1;
    };
    if (raised) drawAxe();
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    if (!raised) drawAxe();
    ctx.restore();
    // the doomed: a red skull floating over their heads
    for (const h of this.marked) {
      if (h.dead) continue;
      const x = Math.round(h.x);
      const y = Math.round(h.y - 62 + Math.sin(this.animTime * 5) * 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, 12, '255, 40, 40', 0.5 + Math.sin(this.animTime * 8) * 0.2);
      ctx.restore();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(x - 4, y - 4, 8, 6);
      ctx.fillRect(x - 3, y + 2, 6, 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 3, y - 2, 2, 2);
      ctx.fillRect(x + 1, y - 2, 2, 2);
      ctx.fillRect(x - 1, y + 2, 1, 2);
      ctx.fillRect(x + 1, y + 2, 1, 2);
    }
    if (this.state === 'windup' && this.marked.length) HUD.text(ctx, 'EXECUTE', Math.round(this.x), Math.round(this.y - this.barOffset - 14), { size: 7, align: 'center', color: '#ff3b30' });
    this.drawHealthBar(ctx);
  }
}

/** Jester (stage 2+): backflips out of half your hits; a flurry of dagger slashes and a stab that make you bleed. */
class Jester extends Enemy {
  constructor(x, y) {
    super('jester', x, y);
    this.flip = 0;
    this.flipAngle = 0;
    this.strike = 0;
    this.gibColors = ['#8a2438', '#1a1620', '#ece6f0'];
  }

  takeDamage(amount, world) {
    if (this.dead) return false;
    if (this.flip > 0) return false;
    const c = this.cfg;
    if (this.state === 'chase' && Math.random() < c.dodgeChance) {
      // a backflip away from whoever swung
      const src = world.actor || world.nearestHero(this.x, this.y);
      this.flipAngle = src ? angleTo(src.x, src.y, this.x, this.y) : rand(0, TAU);
      this.flip = c.dodgeTime;
      world.effects.text(this.hx, this.hy - 30, choose(['DODGE', 'MISSED!', 'HA!']), { color: '#ff9aa8', size: 7 });
      world.effects.burst(this.hx, this.hy, { count: 8, colors: ['#ff9aa8', '#ffffff', '#ecd690'], speed: [40, 120], life: [0.2, 0.4] });
      Sound.play('jesterFlip');
      return false;
    }
    return super.takeDamage(amount, world);
  }

  update(dt, world) {
    if (this.flip > 0) {
      this.flip -= dt;
      const c = this.cfg;
      world.dungeon.move(this, Math.cos(this.flipAngle) * (c.dodgeDistance / c.dodgeTime) * dt, Math.sin(this.flipAngle) * (c.dodgeDistance / c.dodgeTime) * dt);
      this.age += dt;
      this.animTime += dt;
      return;
    }
    super.update(dt, world);
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    switch (this.state) {
      case 'chase':
        if (p.dead) return;
        this.moveToward(world, p.x, p.y, this.speed, dt);
        if (this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          this.strike = 0;
          this.setState('windup');
        }
        break;
      case 'windup':
        if (this.stateTime >= (this.strike === 0 ? c.windup : 0.2)) {
          const last = this.strike === c.combo - 1;
          if (!p.dead) { this.attackAngle = angleTo(this.x, this.y, p.x, p.y); this.faceToward(p.x); }
          meleeArc(this, world, (a) => a.bleed?.(c.bleedDps * (world.enemyScale ? world.enemyScale.damage : 1), c.bleedTime, world));
          this.swipeFx(world, last ? '255, 240, 240' : '255, 120, 140');
          if (!p.dead && !last) this.moveAngle(world, this.attackAngle, 260, 0.05);   // a skip forward into the next cut
          Sound.play(last ? 'thrust' : 'dagger');
          this.strike++;
          if (this.strike >= c.combo) this.setState('recover');
          else this.setState('windup');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup' || this.strike > 0) return;
    const c = this.cfg;
    Telegraph.cone(ctx, this.x, this.y, this.attackAngle, c.attackArcDegrees * DEG, c.attackReach, this.stateTime / c.windup);
  }

  draw(ctx) {
    const f = this.facing;
    ctx.save();
    if (this.flip > 0) {
      // the backflip: a full turn round its middle, up off the floor
      const k = 1 - this.flip / this.cfg.dodgeTime;
      const cy = this.y - 18 - Math.sin(k * Math.PI) * 18;
      ctx.translate(this.x, cy);
      ctx.rotate(-f * k * TAU);
      ctx.translate(-this.x, -(this.y - 18));
    }
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    // a dagger in each hand: crossed when idle, flashing out as it cuts
    const d = Sprites.weapons.dagger;
    const attacking = this.state === 'windup' || this.state === 'recover';
    const base = attacking ? this.attackAngle : (f > 0 ? -0.5 : Math.PI + 0.5);
    const jab = attacking && this.strike % 2 ? 0.6 : -0.4;
    ctx.globalAlpha = this.spawnAlpha;
    drawRotated(ctx, d.img, this.x + f * 8, this.hy + 4, d.pivotX, d.pivotY, base + jab * f, Math.cos(base) < 0);
    drawRotated(ctx, d.img, this.x - f * 5, this.hy + 6, d.pivotX, d.pivotY, base - jab * f + f * 0.3, Math.cos(base) < 0);
    ctx.globalAlpha = 1;
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

/**
 * The Prince (stage 3): dashes in with his rapier, then cuts twice and lunges with a stab.
 * At half health he sounds his trumpet and two royal guards join him.
 */
class Prince extends Enemy {
  constructor(x, y) {
    super('prince', x, y);
    this.cut = 0;
    this.gibColors = ['#8a2438', '#c8a456', '#ad9fb0'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (!this.trumpeted && this.hp < this.maxHp * c.summonAt && this.state === 'chase') {
      this.trumpeted = true;
      this.setState('trumpet');
      Sound.play('trumpet');
      world.effects.text(this.hx, this.hy - 36, 'TO ME, GUARDS!', { color: '#ecd690', size: 8, life: 1.4 });
      return;
    }
    switch (this.state) {
      case 'trumpet':
        if (vrand(0, 1) < dt * 10) world.effects.burst(this.x + this.facing * 30, this.hy - 10, { count: 1, colors: ['#ecd690', '#ffffff'], speed: [30, 80], life: [0.4, 0.7], up: 30 });
        if (this.stateTime >= 1.2) {
          const n = Math.min(c.summonCount, Math.max(1, world.summonRoom()));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + Math.PI / 2;
            world.summon(this, 'royalGuard', this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 40);
          }
          this.setState('chase');
          this.attackCooldown = 0.6;
        }
        break;
      case 'chase':
        if (p.dead) return;
        this.moveToward(world, p.x, p.y, this.speed, dt);
        if (this.distanceTo(p) < c.attackRange && this.attackCooldown <= 0) {
          this.aim(world, p);
          this.setState('dashWindup');
          Sound.play('windup');
        }
        break;
      case 'dashWindup':
        if (this.stateTime < c.dashWindup * 0.6 && !p.dead) this.aim(world, p);
        if (this.stateTime >= c.dashWindup) { this.setState('dash'); this.dashed = 0; this.dashHits = new Set(); Sound.play('dash'); }
        break;
      case 'dash': {
        const step = (c.dashDistance / c.dashTime) * dt;
        const x0 = this.x;
        const y0 = this.y;
        world.dungeon.move(this, Math.cos(this.attackAngle) * step, Math.sin(this.attackAngle) * step);
        this.dashed += step;
        for (const a of world.allies) {
          if (this.dashHits.has(a) || pointSegmentDistance(a.x, a.y, x0, y0, this.x, this.y) > c.dashWidth / 2 + a.radius) continue;
          this.dashHits.add(a);
          a.hurt(c.damage, world, this.x, this.y);
        }
        if (this.dashed >= c.dashDistance || dist(x0, y0, this.x, this.y) < step * 0.3) { this.setState('combo'); this.cut = 0; }
        break;
      }
      case 'combo':
        if (this.stateTime >= c.comboGap) {
          if (!p.dead) { this.attackAngle = angleTo(this.x, this.y, p.x, p.y); this.faceToward(p.x); }
          const stab = this.cut === 2;
          // the cuts sweep a wide arc; the stab reaches further in a narrow line
          for (const a of world.allies) {
            const d = this.distanceTo(a);
            const off = Math.abs(angleDiff(this.attackAngle, angleTo(this.x, this.y, a.x, a.y)));
            const inArc = stab ? off < 0.35 && d < c.comboReach * 1.5 + a.radius : off <= (c.comboArcDegrees * DEG) / 2 && d < c.comboReach + a.radius;
            if (inArc) a.hurt(c.damage, world, this.x, this.y);
          }
          if (stab) {
            const ex = this.x + Math.cos(this.attackAngle) * c.comboReach * 1.5;
            const ey = this.y - 12 + Math.sin(this.attackAngle) * c.comboReach * 1.5;
            const sx = this.x;
            const sy = this.y - 12;
            world.effects.add(0.2, (ctx, t) => {
              ctx.save();
              ctx.globalAlpha = 1 - t;
              ctx.strokeStyle = '#fffbe8';
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, ex, 0.4 + t * 0.6), lerp(sy, ey, 0.4 + t * 0.6)); ctx.stroke();
              ctx.restore();
            });
            Sound.play('thrust');
          } else {
            this.swipeFx(world, '255, 220, 140');
            Sound.play('slash');
          }
          this.cut++;
          this.stateTime = 0;
          if (this.cut >= 3) this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= c.recovery) { this.setState('chase'); this.attackCooldown = c.cooldown; }
        break;
    }
  }

  aim(world, p) {
    this.attackAngle = angleTo(this.x, this.y, p.x, p.y);
    this.faceToward(p.x);
    this.dashEnd = world.dungeon.raycast(this.x, this.y, this.attackAngle, this.cfg.dashDistance);
  }

  swipeFx(world, rgb) {
    const c = this.cfg;
    const saved = this.cfg;
    this.cfg = { ...c, attackArcDegrees: c.comboArcDegrees, attackReach: c.comboReach };
    super.swipeFx(world, rgb);
    this.cfg = saved;
  }

  drawTelegraph(ctx) {
    if (this.state === 'dashWindup' && this.dashEnd) Telegraph.line(ctx, this.x, this.y, this.dashEnd.x, this.dashEnd.y, this.cfg.dashWidth, this.stateTime / this.cfg.dashWindup);
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    ctx.globalAlpha = this.spawnAlpha;
    if (this.state === 'trumpet') {
      // the trumpet raised to his lips, banner hanging
      holdWeapon(ctx, this, Sprites.weapons.trumpet, f > 0 ? -0.35 : Math.PI + 0.35, 4, -8);
      for (let i = 0; i < 3; i++) {
        const k = (this.stateTime * 1.5 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        PFX.ring(ctx, this.x + f * (34 + k * 30), this.hy - 14, 4 + k * 14, 6 + k * 18, '#ecd690', 2, { from: f > 0 ? -1 : Math.PI - 1, to: f > 0 ? 1 : Math.PI + 1 });
      }
      ctx.globalAlpha = 1;
    } else {
      const attacking = this.state === 'dash' || this.state === 'combo' || this.state === 'dashWindup';
      const a = attacking ? this.attackAngle + (this.state === 'combo' && this.cut % 2 ? 0.8 : -0.6) * f * (this.cut === 2 ? 0 : 1)
        : (f > 0 ? -0.35 : Math.PI + 0.35);
      holdWeapon(ctx, this, Sprites.weapons.rapier, a);
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/**
 * The Princess (stage 3): looses a crossbow volley (its last bolt a magic one that chases you
 * for a few seconds), throws ice potions that leave a slowing patch of ice, and slowly heals.
 */
class Princess extends Enemy {
  constructor(x, y) {
    super('princess', x, y);
    this.aim = 0;
    this.shots = 0;
    this.potionTimer = this.cfg.potionEvery * rand(0.4, 0.8);
    this.gibColors = ['#46286a', '#8a2438', '#cfcadc'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    // she mends slowly, sparkling
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * c.regen * dt);
      if (vrand(0, 1) < dt * 4) world.effects.burst(this.x + vrand(-8, 8), this.y - vrand(10, 40), { count: 1, colors: ['#8cf08a', '#e0ffd0'], speed: [5, 15], life: [0.4, 0.7], up: 25, size: [1, 2] });
    }
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.potionTimer -= dt;
        if (this.potionTimer <= 0) {
          this.potionTimer = c.potionEvery;
          this.setState('throw');
          return;
        }
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 120) { this.setState('windup'); Sound.play('bowDraw'); }
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.volleyWindup) { this.setState('volley'); this.shots = 0; }
        break;
      case 'volley':
        this.aim += clamp(angleDiff(this.aim, angleTo(this.hx, this.hy, p.hx, p.hy)), -3 * dt, 3 * dt);
        if (this.stateTime >= this.shots * c.volleyEvery) {
          const last = this.shots === c.volley - 1;
          this.fireBolt(world, last);
          if (++this.shots >= c.volley) { this.setState('chase'); this.attackCooldown = c.volleyCooldown; }
        }
        break;
      case 'throw':
        this.faceToward(p.x);
        if (this.stateTime >= 0.35) {
          this.throwPotion(world, p);
          this.setState('chase');
        }
        break;
    }
  }

  fireBolt(world, magic) {
    const c = this.cfg;
    const x = this.hx + Math.cos(this.aim) * 16;
    const y = this.hy + Math.sin(this.aim) * 16;
    if (!magic) {
      enemyShot(world, x, y, this.aim + rand(-0.05, 0.05), c.boltSpeed, { radius: 4, damage: c.damage, sprite: Sprites.projectiles.crossbowBolt, trail: ['#6a449a'] });
      Sound.play('crossbow', 0.04);
      return;
    }
    // the last bolt glows with frost magic and chases its target for a few seconds
    let chase = c.homingTime;
    const speed = c.magicSpeed;
    enemyShot(world, x, y, this.aim, speed, {
      radius: 6, damage: stageDamage(world, c.magicDamage), life: c.homingTime + 2, sprite: Sprites.projectiles.magicBolt, glow: '140, 200, 255', trail: ['#9ad0ff', '#e6f6ff'],
      homing: (pr, dt, w) => {
        chase -= dt;
        if (chase <= 0) return;
        const t = w.nearestHero(pr.x, pr.y);
        if (!t || t.dead) return;
        const cur = Math.atan2(pr.vy, pr.vx);
        const a = cur + clamp(angleDiff(cur, angleTo(pr.x, pr.y, t.hx, t.hy)), -3 * dt, 3 * dt);
        pr.vx = Math.cos(a) * speed;
        pr.vy = Math.sin(a) * speed;
      },
    });
    Sound.play('magic');
  }

  throwPotion(world, p) {
    const c = this.cfg;
    const at = { x: p.x + rand(-10, 10), y: p.y + rand(-8, 8) };
    Sound.play('dagger');
    lobShot(world, this.x + this.facing * 8, this.hy - 10, at.x, at.y, c.potionFlight, {
      sprite: Sprites.projectiles.icePotion, radius: c.iceRadius, height: 90, spin: 9, rgb: '140, 200, 255',
      onLand: (w) => {
        Sound.play('glass');
        w.effects.shards(at.x, at.y - 6, { count: 12, speed: [80, 200], life: 0.45, len: [5, 9], width: 3 });
        w.effects.burst(at.x, at.y - 4, { count: 16, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [40, 160], life: [0.3, 0.6] });
        groundZone(w, {
          x: at.x, y: at.y, r: c.iceRadius, life: c.iceTime, every: 0.2,
          tick: (ww, x, y, r) => {
            for (const a of ww.allies) if (dist(a.x, a.y, x, y) < r + (a.radius || 0) * 0.5) a.chill?.(1 - c.iceSlow, 0.3);
          },
          draw: (ctx, x, y, r, t) => {
            const k = t < 0.85 ? Math.min(1, t * 8) : (1 - t) / 0.15;
            ctx.save();
            ctx.globalAlpha = 0.55 * k;
            PFX.disc(ctx, x, y, r, r * 0.55, '#9ad0ff');
            ctx.globalAlpha = 0.7 * k;
            PFX.ring(ctx, x, y, r, r * 0.55, '#e6f6ff', 2);
            // frost cracks
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
              const a = i * 1.05 + 0.3;
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.44); ctx.stroke();
            }
            ctx.restore();
          },
          // frost glittering over the ice, above the gloom
          top: (ctx, x, y, r, t) => {
            const k = t < 0.85 ? Math.min(1, t * 8) : (1 - t) / 0.15;
            const secs = t * c.iceTime;
            for (let i = 0; i < 6; i++) {
              const tw = (secs * 1.3 + i * 0.37) % 1;
              if (tw > 0.5) continue;
              const a = i * 2.1 + Math.floor(secs * 1.3 + i * 0.37);
              ctx.globalAlpha = k * (1 - tw * 2);
              PFX.star(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.3, 2, '#e6f6ff', '#ffffff');
            }
            ctx.globalAlpha = 1;
          },
          light: { r: c.iceRadius * 2, rgb: '140, 200, 255', s: 0.6 },
        });
      },
    });
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const end = { x: this.hx + Math.cos(this.aim) * 500, y: this.hy + Math.sin(this.aim) * 500 };
    Telegraph.line(ctx, this.hx, this.hy, end.x, end.y, 3, this.stateTime / this.cfg.volleyWindup, '170, 120, 255');
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.globalAlpha = this.spawnAlpha;
    if (this.state === 'throw') {
      // a potion raised to throw
      const img = Sprites.projectiles.icePotion;
      ctx.drawImage(img, Math.round(this.x + this.facing * 6 - 6), Math.round(this.y - 52));
    } else {
      const xb = Sprites.weapons.crossbow;
      const a = this.state === 'windup' || this.state === 'volley' ? this.aim : (this.facing > 0 ? 0.4 : Math.PI - 0.4);
      drawRotated(ctx, xb.img, this.hx + Math.cos(a) * 6, this.hy + 4 + Math.sin(a) * 4, xb.pivotX, xb.pivotY, a, Math.cos(a) < 0);
      if (this.state === 'volley' && this.shots === this.cfg.volley - 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, this.hx + Math.cos(a) * 26, this.hy + 4 + Math.sin(a) * 18, 12, '140, 200, 255', 0.9);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}

/** The Queen's gardener: sprays droplets of magic water from a watering can. */
class Gardener extends Enemy {
  constructor(x, y) {
    super('gardener', x, y);
    this.aim = 0;
    this.gibColors = ['#345226', '#b4acb8', '#5aa8f0'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    if (p.dead) return;
    switch (this.state) {
      case 'chase':
        kite(this, world, p, dt);
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        if (this.attackCooldown <= 0 && this.distanceTo(p) < c.preferredMax + 100) this.setState('windup');
        break;
      case 'windup':
        this.aim = angleTo(this.hx, this.hy, p.hx, p.hy);
        this.faceToward(p.x);
        if (this.stateTime >= c.windup) {
          for (let i = 0; i < c.drops; i++) {
            const a = this.aim + (i - (c.drops - 1) / 2) * c.spreadDegrees * DEG;
            enemyShot(world, this.hx + Math.cos(this.aim) * 16, this.hy + Math.sin(this.aim) * 16, a, c.dropSpeed, {
              radius: 5, damage: c.damage, sprite: Sprites.projectiles.waterDrop, glow: '110, 180, 255', trail: ['#5aa8f0', '#e6f6ff'],
              onHit: (pr, w) => w.effects.burst(pr.x, pr.y, { count: 8, colors: ['#5aa8f0', '#e6f6ff', '#3a7ad0'], speed: [30, 100], life: [0.2, 0.4], gravity: 200 }),
            });
          }
          Sound.play('splash');
          this.setState('recover');
        }
        break;
      case 'recover':
        if (this.stateTime >= 0.5) { this.setState('chase'); this.attackCooldown = c.cooldown + rand(0, 0.6); }
        break;
    }
  }

  draw(ctx) {
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    const f = this.facing;
    const tip = this.state === 'windup' || this.state === 'recover';
    ctx.globalAlpha = this.spawnAlpha;
    holdWeapon(ctx, this, Sprites.weapons.wateringCan, tip ? this.aim + (f > 0 ? 0.3 : -0.3) : (f > 0 ? 0.2 : Math.PI - 0.2), 8, 6);
    ctx.globalAlpha = 1;
    this.drawHealthBar(ctx);
  }
}
