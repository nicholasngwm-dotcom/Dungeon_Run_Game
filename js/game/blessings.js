// The hero statues' blessings. A statue in a special room carries one hero's blessing; any hero
// can buy it (CONFIG.run.heroStatue.price coins, x the stage's prices) and bind it to their right
// click, E, F or ultimate - never the dodge. Each hero carries one blessing at a time: buying
// another replaces it. Whenever the blessed ability is used and the blessing is off cooldown, the
// blessing goes off too, then waits out its own cooldown.
//
// hero.blessing = { id (the statue's class id), slot ('secondary' | 'e' | 'f' | 'q'), cd (s left) }
// Each blessing's numbers live in CONFIG.run.heroStatue.blessings[id].

const BLESS_SLOTS = ['secondary', 'e', 'f', 'q'];

/** The knight statue's little knights: a hired knight in miniature that fights for a while, then fades. */
class BlessedKnight extends HiredKnight {
  constructor(owner, x, y) {
    super(owner, x, y);
    const c = CONFIG.run.heroStatue.blessings.warrior;
    this.cfg = { ...this.cfg, damage: c.damage };
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.life = c.life;
    this.age = 0;
    this.blessed = true;           // (never carried to the next stage like a hireling)
    this.name = 'LITTLE KNIGHT';
    this.color = '#ffe680';
    this.speed = 205;
  }

  get size() { return 0.72; }

  update(dt, world) {
    this.age += dt;
    if (this.age >= this.life) { this.die(world); return; }
    super.update(dt, world);
  }

  die(world) {
    if (this.dead) return;
    this.dead = true;
    this.poof(world);
  }
}

const BLESSINGS = {
  warrior: {
    name: 'Knight', title: 'BLESSING OF THE KNIGHT', color: '#8ab8ff',
    desc: (c) => `Summons ${c.count} little knights with sword and shield (${c.hp} HP each) to fight for you for ${c.life}s.`,
    cast(hero, world, c) {
      // the last ones fade as the new ones arrive
      for (const k of world.helpers) if (k.blessed && k.owner === hero) k.die(world);
      for (let i = 0; i < c.count; i++) {
        const a = hero.aim + Math.PI + (i - 1) * 0.9;
        const pt = world.dungeon.freePoint(hero.x + Math.cos(a) * 30, hero.y + Math.sin(a) * 20, 7, 5);
        const k = new BlessedKnight(hero, pt.x, pt.y);
        k.slot = i;
        world.helpers.push(k);
        k.poof(world);
      }
    },
  },
  priestess: {
    name: 'Priestess', title: 'BLESSING OF THE PRIESTESS', color: '#9cf0a0',
    desc: (c) => `Lays a small rune of healing at your feet: ${c.heal} HP a second for ${c.duration}s to everyone standing in it.`,
    cast(hero, world, c) {
      (hero.blessRunes ||= []).push({ x: hero.x, y: hero.y, t: 0 });
      world.effects.burst(hero.x, hero.y, { count: 14, colors: ['#9cf0a0', '#ffe680', '#ffffff'], speed: [30, 100], life: [0.3, 0.6], up: 40 });
      Sound.play('healRune');
    },
  },
  ranger: {
    name: 'Archer', title: 'BLESSING OF THE ARCHER', color: '#a8cc6a',
    desc: (c) => `Drops a smoke bomb at your feet: enemies caught in it are confused for ${c.confuse}s.`,
    cast(hero, world, c) {
      (hero.blessSmokes ||= []).push({ x: hero.x, y: hero.y, t: 0, hit: new Set() });
      smokeBomb(world, hero.x, hero.y, c.radius / 60);
      Sound.play('flourPoof');
    },
  },
  rogue: {
    name: 'Rogue', title: 'BLESSING OF THE ROGUE', color: '#ff9a8a',
    desc: (c) => `Throws ${c.count} daggers that pierce through every enemy, ${c.damage} damage each.`,
    cast(hero, world, c) {
      for (let i = 0; i < c.count; i++) {
        const a = hero.aim + (i - (c.count - 1) / 2) * 0.22;
        world.playerProjectiles.push(new Projectile({
          x: hero.pivotX + Math.cos(a) * 12, y: hero.pivotY + Math.sin(a) * 12,
          vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
          radius: 6, damage: c.damage, life: c.range / c.speed, pierce: Infinity, knockback: 30,
          sprite: Sprites.weapons.dagger.img, trail: ['#ff9a8a', '#ffffff'], owner: hero,
        }));
      }
      Sound.play('daggerFan');
    },
  },
  bard: {
    name: 'Bard', title: 'BLESSING OF THE BARD', color: '#ffd38a',
    desc: (c) => `Plays a quick tune: +${Math.round(c.speed * 100)}% movement speed for ${c.duration}s.`,
    cast(hero, world, c) {
      hero.tuneSpeed = Math.max(hero.tuneSpeed || 0, c.duration);
      hero.tuneSpeedAmount = Math.max(hero.tuneSpeed > c.duration ? hero.tuneSpeedAmount || 0 : 0, c.speed);
      world.effects.text(hero.hx, hero.hy - 40, 'QUICKSTEP!', { color: '#ffd38a', size: 8 });
      world.effects.burst(hero.hx, hero.hy, { count: 14, colors: ['#ffd38a', '#ff8a3a', '#ffffff'], speed: [40, 120], life: [0.3, 0.6], up: 40 });
      Bardsong.flourish('energetic');
    },
  },
  baker: {
    name: 'Baker', title: 'BLESSING OF THE BAKER', color: '#ff8ad0',
    desc: (c) => `A sugar rush for ${c.duration}s (${Math.round((1 - c.sickChance) * 100)}%) - or, ${Math.round(c.sickChance * 100)}% of the time, sweet sickness: -15% attack speed and -20% movement speed.`,
    cast(hero, world, c) {
      if (Math.random() < c.sickChance) {
        hero.buffs.sickness = c.duration;
        hero.buffMax.sickness = c.duration;
        world.effects.text(hero.hx, hero.hy - 40, 'SWEET SICKNESS...', { color: CONFIG.buffs.sickness.color, size: 9, life: 1.2 });
        world.effects.burst(hero.hx, hero.hy, { count: 14, colors: ['#9ac86a', '#ff8ad0', '#6a8a4a'], speed: [20, 80], life: [0.3, 0.6], up: 20 });
        Sound.play('denied');
        return;
      }
      hero.sugarStacks = Math.max(1, hero.buffs.sugar > 0 ? hero.sugarStacks || 1 : 1);
      hero.buffs.sugar = Math.max(hero.buffs.sugar || 0, c.duration);
      hero.buffMax.sugar = c.duration;
      world.effects.text(hero.hx, hero.hy - 40, 'SUGAR RUSH!', { color: CONFIG.buffs.sugar.color, size: 9, life: 1 });
      world.effects.burst(hero.hx, hero.hy, { count: 16, colors: ['#ff8ad0', '#ffffff', '#8ad8ff', '#ffe680'], speed: [40, 140], life: [0.3, 0.6], up: 30 });
    },
  },
  rocketeer: {
    name: 'Rocketeer', title: 'BLESSING OF THE ROCKETEER', color: '#ff9a3a',
    desc: (c) => `Fires a heavy-duty rocket: ${c.damage} damage, stunning everything in its blast for ${c.stun}s.`,
    cast(hero, world, c) {
      const a = hero.aim;
      world.playerProjectiles.push(new Projectile({
        x: hero.pivotX + Math.cos(a) * 14, y: hero.pivotY + Math.sin(a) * 14,
        vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
        radius: 9, damage: 0, life: 1.6, knockback: 0, scale: 1.4, owner: hero,
        sprite: Sprites.projectiles.rocket, glow: '255, 170, 60', trail: ['#ff9a3a', '#ffd34a', '#5a5060'],
        onHit: (p, w) => {
          for (const t of w.getTargets()) {
            if (t.prop || dist(p.x, p.y, t.hx, t.hy) > c.radius + t.radius) continue;
            w.damageTarget(t, c.damage, { angle: Math.atan2(p.vy, p.vx), knockback: 60, fire: true });
            t.stun?.(c.stun, w);
          }
          w.effects.burst(p.x, p.y, { count: 30, colors: ['#ffd34a', '#ff8a1e', '#e0461e', '#ffffff'], speed: [80, 240], life: [0.3, 0.6] });
          w.effects.smoke(p.x, p.y - 6, { count: 8, radius: c.radius * 0.5, life: 0.8, rise: 24 });
          w.effects.add(0.3, (ctx, k) => PFX.ring(ctx, p.x, p.y, c.radius * (0.5 + k * 0.5), c.radius * 0.6 * (0.5 + k * 0.5), `rgba(255, 210, 120, ${1 - k})`, 2, { thick: 3 }));
          w.shake(4, 0.18);
          Sound.play('explosion');
        },
      }));
      Sound.play('rocketLaunch');
    },
  },
  mage: {
    name: 'Mage', title: 'BLESSING OF THE MAGE', color: '#ff8a3a',
    desc: (c) => `Launches ${c.count} flaming, heat-seeking magic missiles all around you: ${c.damage} damage each, and they set enemies alight.`,
    cast(hero, world, c) {
      for (let i = 0; i < c.count; i++) {
        const a = (i / c.count) * TAU;
        world.playerProjectiles.push(new Projectile({
          x: hero.pivotX + Math.cos(a) * 12, y: hero.pivotY + Math.sin(a) * 12,
          vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
          radius: 6, damage: c.damage, life: c.life, knockback: 30, fire: true, owner: hero,
          sprite: Sprites.projectiles.bolt, spin: 10, glow: '255, 150, 60', trail: FIRE_COLORS.slice(1, 4),
          homing: (p, dt, w) => {
            if (p.age < 0.15) return;   // fanning out first
            if (!p.target || p.target.dead || !w.getTargets().includes(p.target)) p.target = nearestTarget(w, p.x, p.y, 420);
            if (!p.target) return;
            const cur = Math.atan2(p.vy, p.vx);
            const turn = clamp(angleDiff(cur, angleTo(p.x, p.y, p.target.hx, p.target.hy)), -c.turnRate * dt, c.turnRate * dt);
            const sp = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(cur + turn) * sp;
            p.vy = Math.sin(cur + turn) * sp;
          },
          onStrike: (p, w, t) => w.addDot(t, c.burnDps, c.burnTime, '#ff8a1e', 'burn'),
        }));
      }
      world.effects.burst(hero.hx, hero.hy, { count: 18, colors: FIRE_COLORS.slice(1), speed: [60, 160], life: [0.2, 0.5] });
      Sound.play('fireballCast');
    },
  },
};

const Blessings = {
  /** The blessing's config (numbers) for a statue's class id. */
  cfg(id) { return CONFIG.run.heroStatue.blessings[id]; },

  /** Binds statue `id`'s blessing to the hero's `slot` (replacing whatever they carried); ready straight away. */
  attach(hero, id, slot) {
    if (!BLESSINGS[id] || !BLESS_SLOTS.includes(slot)) return false;
    hero.blessing = { id, slot, cd: 0 };
    hero.blessPrev = {};   // (so a slot already cooling down doesn't set it off the moment it's bound)
    return true;
  },

  /**
   * Every frame, after the hero's abilities: notices the blessed ability being used (its cooldown
   * jumping up, or a full ultimate being spent) and sets the blessing off if it's ready.
   */
  update(hero, dt, world) {
    this.updateRunes(hero, dt, world);
    this.updateSmokes(hero, dt, world);
    const b = hero.blessing;
    const prev = hero.blessPrev || (hero.blessPrev = {});
    let used = false;
    if (b) {
      b.cd = Math.max(0, b.cd - dt);
      if (b.slot === 'q') used = prev.ultReady && !hero.ultReady;
      else used = prev.cd != null && (hero.cooldowns[b.slot] || 0) > prev.cd + 0.01;   // (none on the frame it was bound)
    }
    prev.ultReady = hero.ultReady;
    prev.cd = b && b.slot !== 'q' ? hero.cooldowns[b.slot] || 0 : null;
    if (!used || b.cd > 0 || hero.dead) return;
    const c = this.cfg(b.id);
    b.cd = c.cooldown;
    BLESSINGS[b.id].cast(hero, world, c);
    // a flash of the statue's light off the hero, so it's clear the blessing went off
    world.effects.burst(hero.hx, hero.hy - 6, { count: 10, colors: [BLESSINGS[b.id].color, '#fff6c8'], speed: [30, 90], life: [0.3, 0.5], up: 30 });
  },

  updateRunes(hero, dt, world) {
    if (!hero.blessRunes?.length) return;
    const c = this.cfg('priestess');
    for (const r of hero.blessRunes) {
      r.t += dt;
      if (r.t >= c.duration) { r.dead = true; continue; }
      for (const a of world.allies) {
        if (!a.heal || a.dead) continue;
        const dx = (a.x - r.x) / c.radius;
        const dy = (a.y - r.y) / (c.radius * MAGIC_CIRCLE_SY);
        if (dx * dx + dy * dy > 1) continue;
        a.heal(c.heal * dt, world, true);
        if (vrand(0, 1) < dt * 5) healCross(world, a.x + vrand(-10, 10), a.y - vrand(6, 26));
      }
    }
    removeDead(hero.blessRunes);
  },

  updateSmokes(hero, dt, world) {
    if (!hero.blessSmokes?.length) return;
    const c = this.cfg('ranger');
    for (const s of hero.blessSmokes) {
      s.t += dt;
      if (s.t >= c.duration) { s.dead = true; continue; }
      for (const t of world.getTargets()) {
        if (s.hit.has(t) || t.prop || dist(s.x, s.y, t.x, t.y) > c.radius + (t.radius || 0)) continue;
        s.hit.add(t);
        t.confuse?.(c.confuse, world);
      }
    }
    removeDead(hero.blessSmokes);
  },

  /** The priestess blessing's runes on the floor (the Priestess's own rune, smaller). */
  drawGround(hero, ctx) {
    if (!hero.blessRunes?.length) return;
    const c = this.cfg('priestess');
    const look = { cfg: { rune: { duration: c.duration, radius: c.radius } } };
    for (const r of hero.blessRunes) Priestess.prototype.drawRune.call(look, ctx, r, 0.85);
  },

  /** A small round badge (the blessing's colour, its cooldown counting down) for a blessed ability's button. */
  drawBadge(ctx, hero, x, y, r = 9) {
    const b = hero.blessing;
    if (!b) return;
    const info = BLESSINGS[b.id];
    const c = this.cfg(b.id);
    const ready = b.cd <= 0;
    ctx.save();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = ready ? info.color : '#3a2e3e';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (!ready) {
      // the part still cooling, swept away clockwise
      ctx.fillStyle = info.color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - b.cd / c.cooldown));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      HUD.text(ctx, `${Math.ceil(b.cd)}`, x, y + 1, { size: 6, align: 'center', baseline: 'middle', color: '#ffffff' });
    } else {
      PFX.star(ctx, x, y, 3, '#fff6c8', '#ffffff', 1);
    }
    ctx.restore();
  },

  /** The blessing's chip in the HUD's buff row: whose blessing, on which key, and its cooldown. Returns its width. */
  drawChip(ctx, hero, x, y) {
    const b = hero.blessing;
    if (!b) return 0;
    const info = BLESSINGS[b.id];
    const c = this.cfg(b.id);
    const w = 124;
    HUD.panel(ctx, x, y, w, 20);
    ctx.fillStyle = info.color;
    ctx.fillRect(x, y, 2, 20);
    this.drawBadge(ctx, hero, x + 11, y + 10, 7);
    HUD.text(ctx, `${info.name.toUpperCase()} BLESSING`, x + 22, y + 3, { size: 6, color: info.color });
    HUD.text(ctx, this.slotKey(hero, b.slot), x + w - 3, y + 3, { size: 6, align: 'right', color: '#f2a541' });
    ctx.fillStyle = '#1c1410';
    ctx.fillRect(x + 22, y + 13, w - 25, 3);
    ctx.fillStyle = b.cd <= 0 ? '#6cff7a' : info.color;
    ctx.fillRect(x + 22, y + 13, Math.round((w - 25) * (1 - clamp(b.cd / c.cooldown, 0, 1))), 3);
    return w;
  },

  /** The key (or button) a slot is on, for the HUD and the statue's choices. */
  slotKey(hero, slot) {
    if (Touch.enabled) return { secondary: 'SECONDARY', e: 'E', f: 'F', q: 'ULT' }[slot];
    return { secondary: 'RMB', e: Settings.label('e'), f: Settings.label('f'), q: Settings.label('ult') }[slot];
  },

  /** "RMB - SHIELD" style label for a slot of this hero's. */
  slotLabel(hero, slot) { return `${this.slotKey(hero, slot)} - ${hero.icons[slot]}`; },
};
