// Barrels: explosive, poison and frost barrels standing about the fight rooms of every dungeon
// (whatever its theme; CONFIG.run.barrels). They're solid to walk into (a post on the floor),
// shots fly over them, and any hero attack can burst one (they're among world.getTargets(),
// flagged `prop` so homing shots, auto-aim and the AI leave them be). A burst sets off any
// other barrel in its radius, a beat later, so they go up in a chain.
//
//   explosive: a fiery blast; everyone caught in it is set on fire
//   poison:    a green cloud that hangs a few seconds; heroes in it are poisoned (3 a second, 8s)
//   frost:     freezes everyone caught in it and leaves an ice patch; stepping onto the ice
//              freezes you again (step off and back on and it does it again)
//
// Heroes are hurt as by a trap (the Radial Barrier upgrade shrugs them off); the enemies
// caught in it are hurt too, credited to the hero who burst it.

class Barrel extends Entity {
  constructor(x, y, kind) {
    super(x, y);
    this.kind = kind;
    this.maxHp = CONFIG.run.barrels.hp;
    this.hp = this.maxHp;
    this.radius = 13;
    this.hitOffY = 12;
    this.prop = true;       // not an enemy: auto-aim and the AI skip it
    this.wobble = 0;
    this.seed = Math.floor(Math.random() * 1000);
    this.post = null;       // its solid footprint on the floor
  }

  takeDamage(amount, world) {
    if (this.dead) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    this.wobble = 1;
    if (this.hp <= 0) Barrels.burst(world, this, 0.05);   // a moment, so the hit that burst it is credited
    return true;
  }

  knockback() { this.wobble = 1; }
  stun() {}
}

const Barrels = {
  /** A stage's barrels, in each fight room: clear of the middle, the doors, cover, spikes, decor and each other. */
  place(run) {
    const c = CONFIG.run.barrels;
    const f = run.floor;
    const T = f.T;
    const out = [];
    for (const r of f.rooms) {
      if (!c.rooms.includes(r.type)) continue;
      const doors = r.doors.flatMap((d) => d.tiles).map((t) => ({ x: (t % f.cols + 0.5) * T, y: (Math.floor(t / f.cols) + 0.5) * T }));
      const n = randInt(c.perRoom[0], c.perRoom[1]);
      for (let k = 0, placed = 0; k < 50 && placed < n; k++) {
        const pt = f.randomPointIn(r, 2);
        const x = pt.x;
        const y = pt.y + 8;   // it stands on its tile
        if (f.boxHitsWall(x, y - 4, 14, 10)) continue;
        if (Math.abs(x - r.cx) < 3 * T && Math.abs(y - r.cy) < 2.5 * T) continue;   // the middle stays open (the lantern, the fight)
        if (doors.some((d) => dist(d.x, d.y, x, y) < 3.5 * T)) continue;
        if (run.nearCover(x, y, 28)) continue;
        if (run.spikes.some((s) => x > s.x - 20 && x < s.x + T + 20 && y > s.y - 20 && y < s.y + T + 20)) continue;
        if (run.hole && dist(run.hole.x, run.hole.y, x, y) < 70) continue;
        if (run.decor.items.some((d) => dist(d.x, d.y, x, y) < 44)) continue;
        if (out.some((b) => dist(b.x, b.y, x, y) < 44)) continue;
        const b = new Barrel(x, y, choose(c.kinds));
        b.room = r;
        b.post = f.addPost(x, y - 3, 9, 6);
        out.push(b);
        placed++;
      }
    }
    return out;
  },

  /** The barrels still standing (hittable). */
  alive(run) { return run.barrels.filter((b) => !b.dead); },

  update(run, dt) {
    for (const b of run.barrels) {
      b.flashTime -= dt;
      b.wobble = Math.max(0, b.wobble - dt * 3);
    }
  },

  /** Bursts a barrel after `delay` seconds: its post goes, and its contents go everywhere. */
  burst(world, b, delay) {
    if (b.dead) return;
    b.dead = true;
    world.after(delay, () => {
      const run = world.run;
      if (!run || !run.barrels.includes(b)) return;   // a new stage since
      world.dungeon.removePost(b.post);
      const c = CONFIG.run.barrels;
      const hero = world.players.includes(b.lastHitBy) ? b.lastHitBy : null;
      // wood flying
      world.effects.burst(b.x, b.y - 12, { count: 18, colors: ['#5b3922', '#9c6c3e', '#3b2416', '#80869a'], speed: [80, 240], life: [0.4, 0.9], up: 110, gravity: 420, size: [2, 4] });
      if (b.kind === 'explosive') this.explode(world, b, c.explosive, hero);
      else if (b.kind === 'poison') this.poison(world, b, c.poison, hero);
      else this.frost(world, b, c.frost, hero);
      // the other barrels caught in it go up too, a beat later
      const r = c[b.kind].radius;
      for (const o of run.barrels) {
        if (o.dead || dist(o.x, o.y, b.x, b.y) > r + o.radius) continue;
        o.lastHitBy = b.lastHitBy;
        this.burst(world, o, 0.15);
      }
      run.barrels = run.barrels.filter((o) => o !== b);
    });
  },

  /** Everything a burst at (x, y) catches: heroes (and clones, the lantern) and the enemy side's targets. */
  caught(world, x, y, r) {
    return {
      allies: world.allies.filter((a) => !a.dead && dist(a.x, a.y, x, y) < r + (a.radius || 0)),
      foes: world.getTargets().filter((t) => !t.prop && !t.dead && dist(t.x, t.y, x, y) < r + (t.radius || 0)),
    };
  },

  /** Hurts an enemy-side target, credited to the hero who burst the barrel. */
  hurtFoe(world, t, amount, x, y, hero) {
    world.damageTarget(t, amount, { source: hero, noCrit: true, sound: null, angle: angleTo(x, y, t.x, t.y), knockback: 160, color: '#ffb07a' });
  },

  /** A damage-over-time on an enemy-side target (burn or poison), credited to the hero. */
  dot(world, t, dps, time, color, kind, hero) {
    world.dots.push({ target: t, dps, t: time, tick: 0.5, color, kind, source: hero });
  },

  explode(world, b, c, hero) {
    const { x, y } = b;
    const r = c.radius;
    const { allies, foes } = this.caught(world, x, y, r);
    for (const a of allies) {
      if (a.hurt(c.damage, world, x, y, { trap: true })) a.burn?.(c.burnDps, c.burnTime, world);
    }
    for (const t of foes) {
      this.hurtFoe(world, t, c.enemyDamage, x, y, hero);
      if (!t.dead) this.dot(world, t, c.burnDps, c.burnTime, '#ff8a3a', 'burn', hero);
    }
    Sound.play('explosion');
    Sound.play('fireImpact', 0.05);
    world.shake(7, 0.3);
    // a scorch mark, a white-hot fireball, a shockwave racing out, flames and rolling smoke
    world.effects.add(2, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - t);
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
    world.effects.flames(x, y, { count: 8, spread: r * 0.45, height: 30, width: 13, life: 0.7 });
    world.effects.smoke(x, y - 14, { count: 10, radius: r * 0.45, life: 1, rise: 30 });
    world.effects.burst(x, y - 10, { count: 34, colors: ['#ffd34a', '#ff8a1e', '#e0461e', '#ffffff'], speed: [80, 260], life: [0.3, 0.7], size: [2, 5] });
    world.run.addLight({ x, y: y - 10, r: r * 2.4, s: 1, rgb: '255, 150, 60', until: world.time + 0.5 });
  },

  poison(world, b, c, hero) {
    const { x, y } = b;
    const r = c.radius;
    const sick = new Set();   // enemies already poisoned by this cloud (once each)
    const dose = (w) => {
      const { allies, foes } = this.caught(w, x, y, r);
      for (const a of allies) if (!a.flying) a.poison?.(c.dps, c.time, w);
      for (const t of foes) {
        if (sick.has(t)) continue;
        sick.add(t);
        this.dot(w, t, c.enemyDps, c.time, '#9cf06a', null, hero);
        w.effects.text(t.hx, t.hy - 30, 'POISONED', { color: '#9cf06a', size: 7 });
      }
    };
    dose(world);
    Sound.play('glass');
    Sound.play('cakeSplat', 0.05);
    world.effects.burst(x, y - 10, { count: 30, colors: ['#9cf06a', '#6ac04a', '#c8ff9a', '#2e4422'], speed: [60, 200], life: [0.4, 0.8], up: 50, size: [2, 4] });
    groundZone(world, {
      x, y, r, life: c.cloudTime, every: 0.25,
      tick: (w) => {
        dose(w);
        if (vrand(0, 1) < 0.9) w.effects.smoke(x + vrand(-r * 0.6, r * 0.6), y - vrand(4, 20), { count: 1, radius: 14, life: 0.9, rise: 14, colors: ['#3e5a2c', '#6ac04a', '#9cf06a'] });
      },
      draw: (ctx, cx, cy, rr, t) => {
        const k = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = 0.45 * k;
        PFX.disc(ctx, cx, cy, rr, rr * 0.55, '#3e6a2c');
        ctx.globalAlpha = 0.6 * k;
        PFX.ring(ctx, cx, cy, rr * 0.92, rr * 0.5, '#9cf06a', 2, { dash: [4, 4] });
        ctx.restore();
      },
      // the gas itself, billowing above the gloom
      top: (ctx, cx, cy, rr, t) => {
        const k = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
        const secs = t * c.cloudTime;
        ctx.save();
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + secs * 0.4;
          const d = (i % 3) / 3;
          ctx.globalAlpha = 0.28 * k;
          PFX.disc(ctx, cx + Math.cos(a) * rr * 0.55 * d, cy - 14 + Math.sin(a) * rr * 0.25 * d - Math.sin(secs * 2 + i) * 4, 22, 14, i % 2 ? '#6ac04a' : '#9cf06a');
        }
        ctx.restore();
      },
      light: { r: r * 1.8, rgb: '140, 240, 100', s: 0.6 },
    });
  },

  frost(world, b, c, hero) {
    const { x, y } = b;
    const r = c.radius;
    const { allies, foes } = this.caught(world, x, y, r);
    const inside = new Set();   // who's on the ice now (it only freezes you as you step on)
    for (const a of allies) {
      inside.add(a);
      if (a.hurt(c.damage, world, x, y, { trap: true })) a.freeze?.(c.freeze, world);
    }
    for (const t of foes) {
      inside.add(t);
      this.hurtFoe(world, t, c.enemyDamage, x, y, hero);
      this.freezeFoe(world, t, c.freeze);
    }
    Sound.play('glass');
    Sound.play('iceBurst');
    world.shake(4, 0.2);
    world.effects.shards(x, y - 10, { count: 22, speed: [100, 260], life: 0.55, len: [7, 14], width: 5 });
    world.effects.burst(x, y - 8, { count: 30, colors: ['#ffffff', '#9ad0ff', '#4a8aff'], speed: [60, 220], life: [0.3, 0.7], size: [2, 4] });
    world.effects.smoke(x, y - 6, { count: 8, radius: r * 0.4, life: 0.9, rise: 12, colors: ['#5a8ab8', '#9ac8ea', '#e6f6ff'] });
    const ice = c.iceRadius;
    const onIce = (e) => {
      const dx = (e.x - x) / ice;
      const dy = (e.y - y) / (ice * 0.55);
      return dx * dx + dy * dy < 1;
    };
    groundZone(world, {
      x, y, r: ice, life: c.iceTime, every: 0.1,
      tick: (w) => {
        const now = new Set();
        for (const a of w.allies) if (!a.dead && !a.flying && onIce(a)) now.add(a);
        for (const e of w.enemies) if (!e.dead && onIce(e)) now.add(e);
        for (const e of now) {
          if (inside.has(e)) continue;   // still standing where they were
          if (w.enemies.includes(e)) this.freezeFoe(w, e, c.refreeze);
          else e.freeze?.(c.refreeze, w);
        }
        inside.clear();
        for (const e of now) inside.add(e);
      },
      draw: (ctx, cx, cy, rr, t) => {
        const k = t < 0.9 ? 1 : (1 - t) / 0.1;
        ctx.save();
        ctx.globalAlpha = 0.6 * k;
        PFX.disc(ctx, cx, cy, rr, rr * 0.55, '#9ad0ff');
        ctx.globalAlpha = 0.75 * k;
        PFX.disc(ctx, cx - rr * 0.15, cy - rr * 0.08, rr * 0.6, rr * 0.3, '#c8e6ff');
        PFX.ring(ctx, cx, cy, rr, rr * 0.55, '#e6f6ff', 2);
        // cracks across the ice
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + 0.4;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * rr * 0.8, cy + Math.sin(a) * rr * 0.44);
          ctx.stroke();
        }
        ctx.restore();
      },
      // frost glitter twinkling on it
      top: (ctx, cx, cy, rr, t) => {
        const secs = t * c.iceTime;
        for (let i = 0; i < 6; i++) {
          const a = i * 2.1;
          const d = ((i * 37) % 10) / 12;
          if (Math.sin(secs * 3 + i * 1.7) < 0.4) continue;
          PFX.star(ctx, cx + Math.cos(a) * rr * d, cy + Math.sin(a) * rr * 0.5 * d, 1, '#e6f6ff', '#ffffff');
        }
      },
      light: { r: ice * 1.8, rgb: '140, 200, 255', s: 0.55 },
    });
  },

  /** Freezes an enemy-side target: a plain enemy in a block of ice, a boss as a whole (if it can be). */
  freezeFoe(world, t, time) {
    if (t.dead) return;
    if (t.freeze) t.freeze(time);
    else if (world.isBossTarget(t)) world.freezeBoss(time);
    else t.stun?.(time);
  },

  /** A barrel (bottom centre at its x, y): wobbling when hit, a fuse fizzing, ooze bubbling, frost breathing off it. */
  draw(ctx, b, time) {
    const spr = Sprites.barrels[b.kind];
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    drawShadow(ctx, x, y - 1, 12, 4, 0.4);
    const lean = Math.sin(b.wobble * 16) * b.wobble * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.drawImage(spr.img, -Math.floor(BARREL_W / 2), -BARREL_H);
    if (b.flashTime > 0) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(spr.flash, -Math.floor(BARREL_W / 2), -BARREL_H);
    }
    ctx.restore();
    const t = time + b.seed * 0.01;
    if (b.kind === 'explosive') {
      // the fuse's spark
      const sx = x + 4;
      const sy = y - BARREL_H - 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, sx, sy, 7 + Math.sin(t * 20) * 2, '255, 200, 90', 0.7);
      ctx.restore();
      PFX.star(ctx, sx, sy, Math.sin(t * 25) > 0 ? 2 : 1, '#ffd34a', '#ffffff');
    } else if (b.kind === 'poison') {
      // bubbles popping on the ooze
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.8 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#c8ff9a';
        ctx.fillRect(x - 4 + i * 6, Math.round(y - BARREL_H + 3 - k * 6), 2, 2);
      }
      ctx.globalAlpha = 1;
    } else {
      // cold breathing off the frost
      const k = (t * 0.5) % 1;
      ctx.globalAlpha = 0.5 * (1 - k);
      PFX.disc(ctx, x + Math.sin(t) * 3, y - BARREL_H - 2 - k * 10, 5 + k * 4, 3 + k * 2, '#e6f6ff');
      ctx.globalAlpha = 1;
    }
  },
};
