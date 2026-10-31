// Friends a hero picks up in the special rooms, and the dark trader's minions:
//   Hirelings (the helper room): a knight with sword and shield who blocks and slashes, an archer,
//     and a priest who heals the heroes every 10 seconds while his two acolytes shoot beams of
//     light. They follow their hero from stage to stage until they fall (CONFIG.run.helpers).
//   DarkMinion (Dark Minions upgrade): a little shadow with a dark dagger, for 20 seconds.
//   Horse (the mount trader): carries its rider faster and takes their hits; see Mounts.
//   SoulPickup (Soulreap upgrade): a soul fragment flying to its hero.
// All of them are part of the shared simulation (Math.random only; vrand for looks).

/** Common to hirelings and minions: hp, following their hero, finding something to fight, getting hit. */
class Ally extends Entity {
  constructor(owner, x, y, hp) {
    super(x, y);
    this.owner = owner;
    this.ownerId = owner.netId;
    this.maxHp = hp;
    this.hp = hp;
    this.hw = 7;
    this.hh = 5;
    this.radius = 11;
    this.hitOffY = 16;
    this.attackT = 0.5;
    this.lunge = 0;
    this.sinceHit = 99;
    this.invulnerable = 0;
    this.moving = false;
    this.target = null;
    this.slot = 0;            // where round the hero it stands (see heelSpot)
  }

  get fighting() { return !this.dead; }
  get invisible() { return false; }

  /** Their hits grow with the stage, like the enemies. */
  stageScale(world) { return 1 + CONFIG.run.helpers.stageDamage * ((world.run?.stage || 1) - 1); }

  updateCommon(dt, world) {
    this.animTime += dt;
    this.flashTime -= dt;
    this.invulnerable -= dt;
    this.attackT -= dt;
    this.lunge -= dt;
    this.sinceHit += dt;
    this.updateKnockback(dt, world);
    const o = this.owner;
    // too far behind (or shut out of the room the hero's fighting in): it catches up in a puff
    if (dist(this.x, this.y, o.x, o.y) > CONFIG.run.helpers.leash * 2 || this.shutOut(world)) this.catchUp(world);
  }

  /** The nearest enemy within `reach` of its hero (it sticks with the one it's on while it can). */
  pickTarget(world, reach) {
    const o = this.owner;
    const ok = (t) => t && !t.dead && !t.immune && !t.prop && world.getTargets().includes(t) && dist(o.x, o.y, t.x, t.y) < reach;
    if (ok(this.target)) return this.target;
    const t = nearestTarget(world, this.x, this.y, reach);
    return ok(t) ? t : null;
  }

  shutOut(world) {
    const run = world.run;
    if (!run || !run.active || !run.floor) return false;
    return run.floor.roomAt(this.x, this.y) !== run.active && run.floor.roomAt(this.owner.x, this.owner.y) === run.active;
  }

  catchUp(world) {
    this.poof(world);
    const pt = this.heelSpot();
    const f = world.dungeon;
    const free = f.freePoint ? f.freePoint(pt.x, pt.y, this.hw, this.hh) : pt;
    this.x = free.x;
    this.y = free.y;
    this.kbx = 0;
    this.kby = 0;
    this.poof(world);
  }

  /** A spot at the hero's back, fanned out by slot so a few of them don't stand on each other. */
  heelSpot(gap = 30) {
    const o = this.owner;
    const a = Math.PI + (this.slot - 1) * 0.8;
    return { x: o.x + Math.cos(a) * gap * o.facing, y: o.y + 4 + Math.sin(a) * gap * 0.6 };
  }

  heel(dt, world, gap = 30) {
    const pt = this.heelSpot(gap);
    const d = dist(this.x, this.y, pt.x, pt.y);
    if (d < 10) { this.moving = false; this.facing = this.owner.facing; return; }
    this.moveToward(pt.x, pt.y, Math.max(this.speed * 0.8, Math.min(d * 3, (this.owner.speed || 200) * 1.4)), dt, world);
  }

  moveToward(x, y, speed, dt, world) {
    const a = angleTo(this.x, this.y, x, y);
    const step = Math.min(speed * dt, dist(this.x, this.y, x, y));
    world.dungeon.move(this, Math.cos(a) * step, Math.sin(a) * step);
    if (Math.abs(Math.cos(a)) > 0.1) this.facing = Math.cos(a) >= 0 ? 1 : -1;
    this.moving = true;
  }

  /** Out of a fight for a while, they patch themselves up. */
  regen(dt) {
    const c = CONFIG.run.helpers;
    if (this.sinceHit > c.regenDelay) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * c.regen * dt);
  }

  /** Enemy hits wear them down; at 0 they fall for good. Returns true if the hit connected. */
  hurt(amount, world, fromX, fromY, opts = {}) {
    if (this.dead || this.invulnerable > 0) return false;
    let dmg = Math.max(1, Math.round(amount * this.guardScale(fromX, fromY, opts)));
    if (dmg < amount * 0.5) this.blockFx(world);
    this.hp -= dmg;
    this.sinceHit = 0;
    this.invulnerable = 0.3;
    this.flashTime = 0.1;
    world.effects.text(this.hx, this.hy - 18, `-${dmg}`, { color: '#ff8a8a', size: 7 });
    if (fromX !== undefined) this.knockback(angleTo(fromX, fromY, this.x, this.y), 110);
    if (this.hp <= 0) this.die(world);
    return true;
  }

  /** How much of a hit gets through (the knight's raised shield). */
  guardScale() { return 1; }
  blockFx() {}

  die(world, quiet = false) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.poof(world);
    if (!quiet) {
      world.effects.text(this.hx, this.hy - 30, `${this.name} FELL`, { color: '#d8c8a0', size: 7, life: 1.4 });
      world.effects.burst(this.hx, this.hy, { count: 18, colors: ['#ffffff', this.color, '#8a7a6a'], speed: [40, 140], life: [0.3, 0.6], up: 30 });
    }
  }

  poof(world) {
    world.effects.smoke(this.x, this.y - 6, { count: 5, radius: 10, life: 0.5, rise: 16 });
    world.effects.burst(this.x, this.y - 10, { count: 8, colors: [this.color, '#ffffff'], speed: [30, 100], life: [0.2, 0.45], up: 30 });
  }

  drawGround(ctx) {
    if (!this.dead) drawShadow(ctx, this.x, this.y + 9, 11 * this.size, 4, 0.3);
  }

  get size() { return 1; }

  frame() {
    const f = this.frames;
    return heroFrame(f, this.moving, this.animTime);
  }

  /** A small health bar over the head in their colour (shown once they've been hurt). */
  drawBar(ctx, top = 44) {
    if (this.hp >= this.maxHp) return;
    const w = 20;
    const x = Math.round(this.x - w / 2);
    const y = Math.round(this.y - top * this.size);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#3a1a1a';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = this.color;
    ctx.fillRect(x, y, Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 2);
  }

  /** The body: their sprite (scaled by size), a white flash when hit. */
  drawBody(ctx) {
    const s = this.size;
    const f = this.frame();
    if (s === 1) return this.drawFrame(ctx, f, HERO_ANCHOR, this.alpha ?? 1);
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.scale(s, s);
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
    this.drawFrame(ctx, f, HERO_ANCHOR, this.alpha ?? 1);
    ctx.restore();
  }
}

// ---------------------------------------------------------------
//  Hirelings (the helper room)
// ---------------------------------------------------------------

class Hireling extends Ally {
  constructor(kind, owner, x, y) {
    const c = CONFIG.run.helpers[kind];
    super(owner, x, y, c.hp);
    this.kind = kind;
    this.cfg = c;
    this.name = c.name.toUpperCase();
    this.color = c.color;
    this.speed = c.speed;
    this.frames = Sprites.npcs[`hired${kind[0].toUpperCase()}${kind.slice(1)}`];
    this.contactImmune = true;   // (like pets: enemy bodies don't hurt them, only enemy attacks)
  }

  update(dt, world) {
    this.updateCommon(dt, world);
    this.regen(dt);
    const t = world.lobby ? null : this.pickTarget(world, CONFIG.run.helpers.leash);
    this.target = t;
    if (!t) { this.idle(dt, world); return; }
    this.fight(t, dt, world);
  }

  idle(dt, world) { this.heel(dt, world); }
  fight() {}

  draw(ctx) {
    if (this.dead) return;
    this.drawBody(ctx);
    this.drawBar(ctx);
  }
}

/** The hired knight: walks up to enemies and slashes in an arc; now and then raises his shield to block. */
class HiredKnight extends Hireling {
  constructor(owner, x, y) {
    super('knight', owner, x, y);
    this.blocking = 0;
    this.blockT = this.cfg.blockEvery * 0.5;
    this.swing = 0;
  }

  update(dt, world) {
    this.blocking -= dt;
    this.blockT -= dt;
    this.swing -= dt;
    super.update(dt, world);
  }

  fight(t, dt, world) {
    const c = this.cfg;
    const d = dist(this.x, this.y, t.x, t.y);
    this.facing = t.x >= this.x ? 1 : -1;
    // the shield goes up when something is close, every so often
    if (this.blockT <= 0 && d < 90) {
      this.blockT = c.blockEvery;
      this.blocking = c.blockTime;
      Sound.play('blockClang', 0.2);
    }
    if (this.blocking > 0) {
      // edging in behind the shield
      if (d > t.radius + c.reach) this.moveToward(t.x, t.y, this.speed * 0.4, dt, world);
      else this.moving = false;
      return;
    }
    if (d > t.radius + c.reach) { this.moveToward(t.x, t.y, this.speed, dt, world); return; }
    this.moving = false;
    if (this.attackT <= 0) this.slash(t, world);
  }

  slash(t, world) {
    const c = this.cfg;
    this.attackT = c.every;
    this.swing = 0.22;
    const aim = angleTo(this.x, this.hy, t.hx, t.hy);
    const arc = c.arc * DEG;
    const range = c.reach + 18;
    for (const e of world.getTargets()) {
      if (e.prop) continue;
      const dd = dist(this.x, this.hy, e.hx, e.hy);
      if (dd > range + e.radius) continue;
      if (dd > e.radius && Math.abs(angleDiff(aim, angleTo(this.x, this.hy, e.hx, e.hy))) > arc / 2) continue;
      world.damageTarget(e, c.damage * this.stageScale(world), { source: this.owner, angle: aim, knockback: 120, sound: null, fromUlt: true, color: c.color });
    }
    const x = this.x;
    const y = this.hy;
    const dir = this.facing;
    world.effects.add(0.22, (ctx, k) => Warrior.drawSlashFx(ctx, x, y, aim, arc, range - 6, dir, k));
    Sound.play('swordSwing', 0.08);
  }

  /** The raised shield turns away most of a hit from in front. */
  guardScale(fromX) {
    if (!(this.blocking > 0) || fromX === undefined) return 1;
    const front = (fromX - this.x) * this.facing >= -6;
    return front ? 1 - this.cfg.block : 1;
  }

  blockFx(world) {
    world.effects.burst(this.x + this.facing * 12, this.hy, { count: 8, colors: ['#e6ecf6', '#8ab8ff', '#ffffff'], speed: [50, 140], life: [0.15, 0.3] });
    Sound.play('blockClang', 0.1);
  }

  draw(ctx) {
    if (this.dead) return;
    const f = this.facing;
    const sh = Sprites.weapons.heaterShield;
    const up = this.blocking > 0;
    if (!up) drawRotated(ctx, sh.img, this.x - f * 7, this.hy + 4, sh.pivotX, sh.pivotY, 0, false);
    this.drawBody(ctx);
    const swing = this.swing > 0 ? 0.9 : this.attackT < 0.2 && this.target ? -1.3 : -0.4;
    holdWeapon(ctx, this, Sprites.weapons.sword, (f > 0 ? 0 : Math.PI) + swing * f);
    if (up) {
      drawRotated(ctx, sh.img, this.x + f * 12, this.hy + 2, sh.pivotX, sh.pivotY, 0, false);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x + f * 12, this.hy + 2, 16, '138, 184, 255', 0.3 * Math.min(1, this.blocking * 3));
      ctx.restore();
    }
    this.drawBar(ctx);
  }
}

/** The hired archer: keeps a little way off and looses arrows at whatever threatens their hero. */
class HiredArcher extends Hireling {
  constructor(owner, x, y) {
    super('archer', owner, x, y);
    this.aim = 0;
    this.draw_ = 0;
  }

  fight(t, dt, world) {
    const c = this.cfg;
    const d = dist(this.x, this.y, t.x, t.y);
    this.aim = angleTo(this.hx, this.hy, t.hx, t.hy);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    if (d > c.range) this.moveToward(t.x, t.y, this.speed, dt, world);
    else if (d < 110) this.moveToward(this.x * 2 - t.x, this.y * 2 - t.y, this.speed * 0.8, dt, world);   // backing away
    else if (dist(this.x, this.y, this.owner.x, this.owner.y) > 140) this.heel(dt, world, 60);
    else this.moving = false;
    if (this.attackT <= 0 && d <= c.range + 40) this.shoot(world);
  }

  shoot(world) {
    const c = this.cfg;
    this.attackT = c.every;
    this.lunge = 0.15;
    const a = this.aim;
    world.playerProjectiles.push(new Projectile({
      x: this.hx + Math.cos(a) * 12, y: this.hy + Math.sin(a) * 12,
      vx: Math.cos(a) * c.arrowSpeed, vy: Math.sin(a) * c.arrowSpeed,
      radius: 5, damage: c.damage * this.stageScale(world), life: 1.2, knockback: 90, arrow: true, fromUlt: true,
      sprite: Sprites.projectiles.arrow, trail: ['#c8f0c0'], owner: this.owner,
      aura: (ctx, p) => arrowStreak(ctx, p, 16, 3, ['#4a8a3a', '#c8f0c0'], 0.45),
    }));
    Sound.play('bowShot', 0.06);
  }

  draw(ctx) {
    if (this.dead) return;
    const bow = Sprites.weapons.bow;
    const behind = Math.sin(this.aim) < -0.35;
    const pull = this.lunge > 0 ? 10 : this.target ? 5 : 8;
    const drawBow = () => drawRotated(ctx, bow.img, this.hx + Math.cos(this.aim) * pull, this.hy + 2 + Math.sin(this.aim) * pull * 0.7, bow.pivotX, bow.pivotY, this.target ? this.aim : (this.facing > 0 ? 0.9 : Math.PI - 0.9));
    if (behind) drawBow();
    this.drawBody(ctx);
    if (!behind) drawBow();
    this.drawBar(ctx);
  }
}

/** The hired priest: stays by the heroes and, every 10 seconds, heals every hero near him. Two acolytes fight for him. */
class HiredPriest extends Hireling {
  constructor(owner, x, y) {
    super('priest', owner, x, y);
    this.healT = 3;
    this.cast = 0;
  }

  update(dt, world) {
    this.updateCommon(dt, world);
    this.regen(dt);
    this.cast -= dt;
    this.healT -= dt;
    this.heel(dt, world, 56);   // he keeps a little way back from the fighting
    if (this.healT <= 0 && !world.lobby) this.blessing(world);
  }

  /** A pillar of light on every hero in range: they're healed (heroes only, not other helpers). */
  blessing(world) {
    const c = this.cfg;
    const hurt = world.heroes.filter((p) => dist(p.x, p.y, this.x, this.y) < c.healRange);
    if (!hurt.some((p) => p.hp < p.maxHp)) { this.healT = 1; return; }   // nobody needs it: waits until someone does
    this.healT = c.healEvery;
    this.cast = 0.6;
    for (const p of hurt) {
      p.heal(c.heal, world);
      const { x, y } = p;
      world.effects.add(0.7, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        PFX.beam(ctx, x, y + 6, -Math.PI / 2, 120, 22 * (1 - t * 0.5), ['#a07a24', '#ffe680', '#ffffff'], 2, false);
        PFX.ring(ctx, x, y + 6, 12 + t * 26, (12 + t * 26) * 0.45, '#fff2a0', 2);
        ctx.restore();
      });
    }
    world.effects.text(this.hx, this.hy - 34, 'BLESSING', { color: c.color, size: 7 });
    world.effects.burst(this.hx, this.hy - 20, { count: 16, colors: ['#ffffff', '#fff6c8', '#ffe680'], speed: [30, 110], life: [0.3, 0.6], up: 50 });
    Sound.play('holyChime', 0.1);
  }

  frame() {
    return this.cast > 0 ? this.frames.idle[0] : super.frame();
  }

  draw(ctx) {
    if (this.dead) return;
    const st = Sprites.weapons.crosier;
    const f = this.facing;
    this.drawBody(ctx);
    drawRotated(ctx, st.img, this.x + f * 9, this.hy + 6, st.pivotX, st.pivotY, -Math.PI / 2 + f * 0.15, false);
    if (this.cast > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, this.x + f * 9, this.hy - 30, 20, '255, 230, 128', this.cast);
      ctx.restore();
    }
    this.drawBar(ctx);
  }
}

/** One of the priest's two acolytes: frail, but its staff shoots beams of light at enemies. */
class Acolyte extends Ally {
  constructor(priest, side) {
    const c = CONFIG.run.helpers.priest.acolyte;
    super(priest.owner, priest.x + side * 20, priest.y + 10, c.hp);
    this.priest = priest;
    this.cfg = c;
    this.kind = 'acolyte';
    this.name = 'ACOLYTE';
    this.color = '#fff6c8';
    this.speed = c.speed;
    this.side = side;
    this.frames = Sprites.npcs.acolyte;
    this.contactImmune = true;
    this.aim = 0;
    this.beam = null;
  }

  get size() { return 0.82; }

  /** Beside the priest (or the hero, once he's gone). */
  heelSpot() {
    const lead = this.priest && !this.priest.dead ? this.priest : this.owner;
    return { x: lead.x + this.side * 22, y: lead.y + 12 };
  }

  update(dt, world) {
    this.updateCommon(dt, world);
    this.regen(dt);
    if (this.beam) { this.beam.t += dt; if (this.beam.t > 0.25) this.beam = null; }
    const t = world.lobby ? null : this.pickTarget(world, CONFIG.run.helpers.leash);
    this.target = t;
    const spot = this.heelSpot();
    const d = dist(this.x, this.y, spot.x, spot.y);
    if (d > 14) this.moveToward(spot.x, spot.y, Math.max(this.speed, d * 2), dt, world);
    else this.moving = false;
    if (!t) return;
    this.aim = angleTo(this.hx, this.hy - 10, t.hx, t.hy);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    if (this.attackT <= 0 && dist(this.x, this.y, t.x, t.y) <= this.cfg.range) this.shoot(t, world);
  }

  /** A beam of light, straight to the target (stopped by walls). */
  shoot(t, world) {
    const c = this.cfg;
    this.attackT = c.every;
    const x0 = this.x + this.facing * 8;
    const y0 = this.hy - 14;
    world.damageTarget(t, c.damage * this.stageScale(world), { source: this.owner, angle: this.aim, knockback: 40, sound: null, fromUlt: true, color: '#fff2a0' });
    this.beam = { x0, y0, x1: t.hx, y1: t.hy, t: 0 };
    world.effects.burst(t.hx, t.hy, { count: 6, colors: ['#ffffff', '#fff6c8', '#ffe680'], speed: [30, 90], life: [0.15, 0.3] });
    Sound.play('holyChime', 0.15);
  }

  draw(ctx) {
    if (this.dead) return;
    this.drawBody(ctx);
    const st = Sprites.weapons.acolyteStaff;
    const f = this.facing;
    drawRotated(ctx, st.img, this.x + f * 7, this.hy + 2, st.pivotX, st.pivotY, -Math.PI / 2 + f * 0.2, false);
    const b = this.beam;
    if (b) {
      const k = 1 - b.t / 0.25;
      const a = angleTo(b.x0, b.y0, b.x1, b.y1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      PFX.beam(ctx, b.x0, b.y0, a, dist(b.x0, b.y0, b.x1, b.y1), 5 * k + 1, ['#a07a24', '#ffe680', '#ffffff'], 1);
      PFX.glow(ctx, b.x1, b.y1, 12, '255, 242, 160', k);
      ctx.restore();
    }
    this.drawBar(ctx, 40);
  }
}

const HIRELINGS = { knight: HiredKnight, archer: HiredArcher, priest: HiredPriest };

/**
 * A new hireling for `hero` (the priest comes with his two acolytes), standing at (x, y).
 * Returns every unit it added to world.helpers.
 */
function hireHelper(world, kind, hero, x, y, hp = null) {
  const h = new HIRELINGS[kind](hero, x, y);
  h.slot = world.helpers.filter((o) => o.owner === hero && !o.dead && !(o instanceof Acolyte)).length % 3;
  if (hp != null) h.hp = clamp(hp, 1, h.maxHp);
  const out = [h];
  if (kind === 'priest') for (const side of [-1, 1]) out.push(new Acolyte(h, side));
  world.helpers.push(...out);
  for (const u of out) u.poof(world);
  return out;
}

// ---------------------------------------------------------------
//  Dark minions (the Dark Minions upgrade)
// ---------------------------------------------------------------

class DarkMinion extends Ally {
  constructor(owner, x, y, life, world) {
    super(owner, x, y, 50);
    this.life = life;
    this.age = 0;
    this.speed = 215;
    this.name = 'MINION';
    this.color = '#b45aff';
    this.frames = Sprites.npcs.darkMinion;
    this.contactImmune = false;
    this.rise = 0.4;           // climbing out of its pool of shadow
    this.slash = 0;
    const { x: px, y: py } = this;
    world.effects.add(0.6, (ctx, t) => {
      ctx.save();
      PFX.disc(ctx, px, py + 4, 18 * (1 - t * 0.5), 8 * (1 - t * 0.5), `rgba(20, 8, 36, ${0.8 * (1 - t)})`, 2);
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, px, py + 4, 18, 8, `rgba(180, 90, 255, ${1 - t})`, 2);
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 6, { count: 14, colors: ['#b45aff', '#1e1430', '#e0c0ff'], speed: [30, 110], life: [0.3, 0.6], up: 50 });
    Sound.play('spawn', 0.1);
  }

  get size() { return 0.72; }
  get alpha() { return Math.min(1, (this.life - this.age) * 2, 1 - this.rise / 0.4 * 0.7); }

  update(dt, world) {
    this.updateCommon(dt, world);
    this.age += dt;
    this.slash -= dt;
    if (this.rise > 0) { this.rise -= dt; return; }
    if (this.age >= this.life) { this.fade(world); return; }
    const t = this.pickTarget(world, 280);
    this.target = t;
    if (!t) { this.heel(dt, world, 26); return; }
    const near = t.radius + this.radius + 6;
    const d = dist(this.x, this.y, t.x, t.y);
    this.facing = t.x >= this.x ? 1 : -1;
    if (d > near) this.moveToward(t.x, t.y, this.speed, dt, world);
    else {
      this.moving = false;
      if (this.attackT <= 0) this.stab(t, world);
    }
    // a wisp of shadow coming off it now and then (looks only)
    if (vrand(0, 1) < dt * 6) world.effects.burst(this.x + vrand(-6, 6), this.y - vrand(4, 20), { count: 1, colors: ['#6a28c8', '#1e1430'], speed: [5, 20], life: [0.3, 0.5], up: 20, size: [1, 2] });
  }

  stab(t, world) {
    this.attackT = 0.6;
    this.slash = 0.16;
    const a = angleTo(this.x, this.y, t.x, t.y);
    world.damageTarget(t, 16 * this.stageScale(world), { source: this.owner, angle: a, knockback: 40, sound: null, fromUlt: true, color: '#c8a0ff' });
    const { hx: x, hy: y } = t;
    world.effects.add(0.2, (ctx, k) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k;
      PFX.beam(ctx, x - Math.cos(a + 0.9) * 10, y - Math.sin(a + 0.9) * 10, a + 0.9, 22, 4 * (1 - k) + 1, ['#46286a', '#b45aff', '#f0e0ff'], 1);
      ctx.restore();
    });
    world.effects.burst(x, y, { count: 4, colors: ['#b45aff', '#ffffff'], speed: [30, 90], life: [0.1, 0.22] });
    Sound.play('hit', 0.08);
  }

  /** It melts back into the shadows (time's up, or a newer one took its place). */
  fade(world) {
    if (this.dead) return;
    this.dead = true;
    world.effects.smoke(this.x, this.y - 8, { count: 6, radius: 10, life: 0.6, rise: 18, colors: ['#1e1430', '#2e2048', '#46286a'] });
    world.effects.burst(this.x, this.y - 10, { count: 10, colors: ['#b45aff', '#e0c0ff'], speed: [20, 80], life: [0.3, 0.5], up: 30 });
  }

  die(world) { this.fade(world); }

  drawGround(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    PFX.disc(ctx, this.x, this.y + 7, 11, 4, '#1e1430', 2);
    ctx.restore();
  }

  draw(ctx) {
    if (this.dead) return;
    const lift = this.rise > 0 ? Math.round((this.rise / 0.4) * 10) : 0;
    ctx.save();
    ctx.translate(0, lift);
    this.drawBody(ctx);
    const dg = Sprites.weapons.darkDagger;
    const f = this.facing;
    const swing = this.slash > 0 ? 0.8 : -0.5;
    drawRotated(ctx, dg.img, this.x + f * 6, this.y - 9, dg.pivotX, dg.pivotY, (f > 0 ? 0 : Math.PI) + swing * f, f < 0);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, this.x, this.y - 14, 16, '138, 58, 255', 0.25 * (this.alpha ?? 1));
    ctx.restore();
    this.drawBar(ctx, 34);
  }
}

// ---------------------------------------------------------------
//  The horse (the mount trader)
// ---------------------------------------------------------------

const HORSE_LIFT = 14;   // the horse is drawn this far below its rider's feet (the rider sits in the saddle)

class Horse extends Entity {
  constructor(owner, hp = null) {
    super(owner.x - owner.facing * 30, owner.y + 6);
    const c = CONFIG.run.mount;
    this.owner = owner;
    this.ownerId = owner.netId;
    this.maxHp = c.hp;
    this.hp = hp ?? c.hp;
    this.hw = 9;
    this.hh = 5;
    this.moving = false;
    this.contactImmune = true;
    this.flashTime = 0;
  }

  get resting() { return this.hp <= 0; }

  update(dt, world) {
    this.animTime += dt;
    this.flashTime -= dt;
    const o = this.owner;
    if (o.riding) {
      this.x = o.x;
      this.y = o.y;
      this.facing = o.facing;
      this.moving = o.moving || !!o.dodge;
      return;
    }
    if (this.resting) { this.moving = false; return; }
    const R = CONFIG.run.helpers.leash;
    const shut = world.run?.active && world.run.floor.roomAt(this.x, this.y) !== world.run.active && world.run.floor.roomAt(o.x, o.y) === world.run.active;
    if (dist(this.x, this.y, o.x, o.y) > R * 1.6 || shut) return this.catchUp(world);
    const tx = o.x - o.facing * 40;
    const ty = o.y + 4;
    const d = dist(this.x, this.y, tx, ty);
    if (d < 12) { this.moving = false; this.facing = o.facing; return; }
    const a = angleTo(this.x, this.y, tx, ty);
    const step = Math.min(Math.max(160, Math.min(d * 3, (o.speed || 200) * 1.5)) * dt, d);
    world.dungeon.move(this, Math.cos(a) * step, Math.sin(a) * step);
    if (Math.abs(Math.cos(a)) > 0.1) this.facing = Math.cos(a) >= 0 ? 1 : -1;
    this.moving = true;
  }

  catchUp(world) {
    const o = this.owner;
    const pt = world.dungeon.freePoint ? world.dungeon.freePoint(o.x - o.facing * 36, o.y + 4, this.hw, this.hh) : { x: o.x, y: o.y };
    this.x = pt.x;
    this.y = pt.y;
    world.effects.smoke(this.x, this.y - 8, { count: 5, radius: 12, life: 0.5, rise: 14 });
  }

  /** The rider was hit: the horse takes it. Past 0 hp it lies down and the rest of the hit goes to the rider. */
  soak(amount, world) {
    const o = this.owner;
    const took = Math.min(this.hp, amount);
    this.hp -= took;
    this.flashTime = 0.12;
    world.effects.text(o.hx + 14, o.hy - 4, `-${Math.round(took)}`, { color: '#e0b080', size: 8 });
    world.effects.burst(o.x, o.y + 8, { count: 6, colors: ['#b48058', '#6e4428', '#ffffff'], speed: [40, 120], life: [0.15, 0.3] });
    if (this.hp > 0) return 0;
    this.hp = 0;
    Mounts.throwOff(o, world);
    return amount - took;
  }

  /** A new stage: it gets back on its feet (some of its health back). */
  stageHeal() {
    this.hp = Math.min(this.maxHp, this.hp + CONFIG.run.mount.stageHeal);
  }

  /** The pony's frame now: walking, standing or lying down to rest. */
  frame() {
    const P = Sprites.npcs.pony;
    if (this.resting) return P.rest[Math.floor(this.animTime * 1.2) % P.rest.length];
    if (this.moving) return P.walk[Math.floor(this.animTime * 10) % P.walk.length];
    return P.idle[Math.floor(this.animTime * 1.2) % P.idle.length];
  }

  drawGround(ctx, lift = 0) {
    drawShadow(ctx, this.x, this.y + 9 + lift, 26, 6, 0.3);
  }

  /** The pony at its spot (lift: drawn further down, under a rider). */
  drawBody(ctx, lift = 0) {
    const f = this.frame();
    drawSprite(ctx, f.img, this.x, this.y + 8 + lift, 40, 58, this.facing < 0);
    if (this.flashTime > 0) drawSprite(ctx, f.flash, this.x, this.y + 8 + lift, 40, 58, this.facing < 0, 0.8);
  }

  draw(ctx) {
    if (this.owner.riding) return;   // drawn under its rider (Player.draw)
    this.drawBody(ctx);
    if (this.resting) {
      // a few z's while it rests
      for (let i = 0; i < 2; i++) {
        const k = (this.animTime * 0.4 + i / 2) % 1;
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
        HUD.text(ctx, 'z', Math.round(this.x + this.facing * 22 + k * 10), Math.round(this.y - 18 - k * 18), { size: 6, color: '#e8e0ff' });
      }
      ctx.globalAlpha = 1;
    }
    this.drawBar(ctx, this.y - 44);
  }

  drawBar(ctx, y) {
    if (this.hp >= this.maxHp) return;
    const w = 26;
    const x = Math.round(this.x - w / 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, Math.round(y) - 1, w + 2, 4);
    ctx.fillStyle = '#3a1a1a';
    ctx.fillRect(x, Math.round(y), w, 2);
    ctx.fillStyle = '#e0b080';
    ctx.fillRect(x, Math.round(y), Math.round(w * clamp(this.hp / this.maxHp, 0, 1)), 2);
  }
}

/** Getting on and off the horse (the mount key), and being thrown off it. */
const Mounts = {
  /** The mount key: on, or off. In a locked room you can get off, but not back on. */
  toggle(p, world) {
    const h = p.horse;
    if (!h || p.dead) return;
    const say = (text, color = '#e0b080') => world.effects.text(p.hx, p.hy - 40, text, { color, size: 7 });
    if (p.riding) {
      p.riding = false;
      const pt = world.dungeon.freePoint(p.x - p.facing * 30, p.y + 4, h.hw, h.hh);
      h.x = pt.x;
      h.y = pt.y;
      world.effects.smoke(p.x, p.y + 6, { count: 4, radius: 10, life: 0.4, rise: 10 });
      Sound.play('stomp', 0.1);
      return;
    }
    if (h.resting) return say('YOUR HORSE IS RESTING');
    if (world.run?.active) return say("CAN'T MOUNT IN BATTLE", '#ff8a6a');
    p.riding = true;
    world.effects.smoke(p.x, p.y + 10, { count: 6, radius: 12, life: 0.5, rise: 12 });
    world.effects.burst(p.x, p.y + 4, { count: 10, colors: ['#e0b080', '#ffffff'], speed: [30, 90], life: [0.2, 0.4], up: 30 });
    Sound.play('dash', 0.1);
  },

  /** The horse is spent: it rears, the rider tumbles off, and it lies down where it is. */
  throwOff(p, world) {
    p.riding = false;
    const h = p.horse;
    world.effects.text(p.hx, p.hy - 44, 'YOUR HORSE NEEDS REST', { color: '#e0b080', size: 7, life: 1.6 });
    world.effects.smoke(h.x, h.y + 6, { count: 8, radius: 16, life: 0.6, rise: 12 });
    p.knockback(Math.PI / 2, 120);
    Sound.play('stomp');
  },
};

// ---------------------------------------------------------------
//  Soul fragments (the Soulreap upgrade)
// ---------------------------------------------------------------

/** A wisp of soul knocked loose from an enemy: it drifts to the hero who freed it. */
class SoulPickup extends Pickup {
  constructor(x, y, owner) {
    super(x, y);
    this.owner = owner;
    this.magnet = 140;
    this.pullSpeed = 160;
    this.pullBoost = 2;
    this.lifetime = 12;
    this.sound = 'magic';
    this.soundGap = 0.08;
  }

  wanted(p) { return p === this.owner && (p.hp < p.maxHp || (p.soulHp || 0) < UPGRADE_BY_ID.soulreap.maxSoul); }

  collect(p, world) { Upgrades.collectSoul(p, world); }

  draw(ctx) {
    if (this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y - 12 + Math.sin(this.age * 4) * 3);
    drawShadow(ctx, this.x, this.y + 3, 5, 2, 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, 14, '200, 160, 255', 0.8);
    ctx.restore();
    // a little flame of soul: violet with a white heart, flickering upward
    const f = Math.floor(this.age * 10) % 2;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 3, y - 4 - f, 7, 9 + f);
    ctx.fillStyle = '#6a3aa0';
    ctx.fillRect(x - 2, y - 3 - f, 5, 7 + f);
    ctx.fillStyle = '#c8a0ff';
    ctx.fillRect(x - 1, y - 2 - f, 3, 5 + f);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 1, 2);
  }
}
