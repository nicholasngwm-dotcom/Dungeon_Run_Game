// Pickups dropped by enemies: health hearts, mana orbs, light orbs, buff orbs and coins.

class Pickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.dead = false;
    this.magnet = 70;      // pulled toward the hero inside this range
    this.pullSpeed = 220;  // ...this fast (px/s), plus up to pullBoost times more as it closes in
    this.pullBoost = 0;
    this.lifetime = 20;    // seconds before it vanishes (blinks for the last 3)
    this.sound = 'pickup';
    this.soundGap = 0.02;  // the same sound can't play again within this many seconds
  }

  /** True while the hero can use this pickup (otherwise it just sits there). */
  wanted() { return false; }
  collect() {}

  /** The nearest living hero who can use this pickup, with their distance. */
  claimant(world) {
    let best = null;
    let bestD = Infinity;
    for (const p of world.players) {
      if (p.dead || !this.wanted(p)) continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return { p: best, d: bestD };
  }

  update(dt, world) {
    this.age += dt;
    if (this.age > this.lifetime) this.dead = true;
    const { p, d } = this.claimant(world);
    if (!p) return;
    if (d < this.magnet) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      const speed = this.pullSpeed * (1 + (1 - d / this.magnet) * this.pullBoost);
      this.x += Math.cos(a) * speed * dt;
      this.y += Math.sin(a) * speed * dt;
    }
    if (d < 18) {
      this.collect(p, world);
      Sound.play(this.sound, this.soundGap);
      this.dead = true;
    }
    if (this.age > this.lifetime) this.dead = true;
  }

  drawSprite(ctx, img) {
    if (this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2) return; // blink before vanishing
    const bob = Math.sin(this.age * 4) * 3;
    drawShadow(ctx, this.x, this.y + 4, 6, 2);
    ctx.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y - img.height + bob));
  }
}

class HeartPickup extends Pickup {
  wanted(p) { return p.hp < p.maxHp; }
  collect(p, world) { p.heal(CONFIG.drops.heartHeal, world); }
  draw(ctx) { this.drawSprite(ctx, Sprites.pickups.heart); }
}

class ManaPickup extends Pickup {
  // always worth grabbing: even at full mana it grants a mana surge
  wanted(p) { return !!p.resource && p.resource.name === 'MANA'; }

  collect(p, world) {
    p.gainResource(CONFIG.drops.manaRestore);
    world.effects.text(p.hx, p.hy - 24, `+${CONFIG.drops.manaRestore}`, { color: p.resource.color, size: 8 });
    p.startManaSurge?.(world); // Mage passive
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 12;
    const cy = this.y - 6 + Math.sin(this.age * 4) * 3;
    const g = ctx.createRadialGradient(this.x, cy, 1, this.x, cy, r);
    g.addColorStop(0, 'rgba(74, 138, 255, 0.5)');
    g.addColorStop(1, 'rgba(74, 138, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(this.x - r, cy - r, r * 2, r * 2);
    ctx.restore();
    this.drawSprite(ctx, Sprites.pickups.mana);
  }
}

/**
 * Super buff orb from a mimic: type is a key of CONFIG.buffs (regen, speed, damage).
 * It lasts for the next few room clears (CONFIG.buffs[type].stacks).
 */
class BuffPickup extends Pickup {
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
    this.lifetime = 60;
  }

  wanted() { return true; }

  collect(p, world) {
    const b = CONFIG.buffs[this.type];
    p.addBuff(this.type);
    world.effects.text(p.hx, p.hy - 40, `${b.name}! (${b.stacks} ROOMS)`, { color: b.color, size: 9, life: 1.4 });
    world.effects.burst(p.hx, p.hy, { count: 18, colors: [b.color, '#ffffff'], speed: [40, 140], life: [0.3, 0.6], up: 30 });
  }

  draw(ctx) {
    const b = CONFIG.buffs[this.type];
    const rgb = hexToRgb(b.color).join(', ');
    const cy = this.y - 8 + Math.sin(this.age * 4) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 18 + Math.sin(this.age * 6) * 2;
    const g = ctx.createRadialGradient(this.x, cy, 1, this.x, cy, r);
    g.addColorStop(0, `rgba(${rgb}, 0.6)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(this.x - r, cy - r, r * 2, r * 2);
    ctx.restore();
    this.drawSprite(ctx, Sprites.pickups[`buff_${this.type}`]);
  }
}

/**
 * Potions on the floor: from secret chests, the wishing well, or dropped out
 * of a hero's bag. Any hero with room in their bag picks them up (a stack
 * leaves behind what doesn't fit). Whoever dropped it has to step away before
 * they can pick it back up, so dropping works for making space or handing
 * potions to a teammate.
 */
class PotionPickup extends Pickup {
  constructor(x, y, id, count = 1, dropper = null) {
    super(x, y);
    this.id = id;
    this.count = count;
    this.dropper = dropper;
    this.magnet = 40;
    this.lifetime = 90;
  }

  wanted(p) { return p !== this.dropper && p.canCarry(this.id); }

  update(dt, world) {
    if (this.dropper && dist(this.x, this.y, this.dropper.x, this.dropper.y) > 60) this.dropper = null;
    super.update(dt, world);
    if (this.dead && this.count > 0 && this.age <= this.lifetime) this.dead = false;   // the rest didn't fit
  }

  collect(p, world) {
    let n = 0;
    while (this.count > 0 && p.addItem(this.id)) { this.count--; n++; }
    const pot = POTIONS[this.id];
    world.effects.text(p.hx, p.hy - 36, `+${n} ${pot.name.toUpperCase()}`, { color: POTION_COLORS[pot.family][1], size: 7, life: 1 });
  }

  draw(ctx) {
    this.drawSprite(ctx, Sprites.potions[this.id]);
    if (this.count > 1 && !(this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2)) {
      HUD.text(ctx, `x${this.count}`, Math.round(this.x + 10), Math.round(this.y - 10), { size: 6, align: 'center' });
    }
  }
}

/** Light orb for the Priestess: dropped by marked enemies, ignored while her orbs are full. */
class LightPickup extends Pickup {
  wanted(p) { return !!p.resource && p.resource.name === 'LIGHT' && p.resource.value < p.resource.max; }

  collect(p, world) {
    p.gainResource(1);
    world.effects.text(p.hx, p.hy - 24, '+1 LIGHT', { color: p.resource.color, size: 8 });
    world.effects.burst(p.hx, p.hy, { count: 10, colors: ['#ffe680', '#fff6c8', '#ffffff'], speed: [30, 90], life: [0.3, 0.5], up: 30 });
  }

  /**
   * A floating holy cross of pale blue-white light inside a halo, rays turning behind it and a
   * spark circling it: nothing like the round gold coins, so it's easy to tell apart on the floor.
   */
  draw(ctx) {
    if (this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2) return; // blink before vanishing
    const x = Math.round(this.x);
    const cy = Math.round(this.y - 12 + Math.sin(this.age * 4) * 3);
    drawShadow(ctx, this.x, this.y + 4, 6, 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, cy, 16 + Math.sin(this.age * 6) * 2, '190, 225, 255', 0.9);
    // four soft rays slowly turning behind the cross
    for (let i = 0; i < 4; i++) {
      const a = this.age * 1.5 + (i * Math.PI) / 2;
      PFX.beam(ctx, x, cy, a, 12, 3, ['#6aa8ff', '#c8e4ff'], 1);
    }
    PFX.ring(ctx, x, cy, 9, 9, 'rgba(200, 230, 255, 0.7)', 1);
    ctx.restore();
    // the cross: outline, pale blue, white heart
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, cy - 6, 5, 13);
    ctx.fillRect(x - 5, cy - 3, 11, 5);
    ctx.fillStyle = '#9ad0ff';
    ctx.fillRect(x - 1, cy - 5, 3, 11);
    ctx.fillRect(x - 4, cy - 2, 9, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, cy - 4, 1, 8);
    ctx.fillRect(x - 3, cy - 1, 7, 1);
    // a spark circling it
    const sa = this.age * 5;
    PFX.star(ctx, x + Math.cos(sa) * 11, cy + Math.sin(sa) * 6, Math.floor(this.age * 8) % 2 ? 2 : 1, '#c8e4ff', '#ffffff', 1);
  }
}

/**
 * Coin (dungeon runs): pops out with a little hop, then gets pulled to the
 * hero from further away than other pickups. value 5 coins are bigger.
 */
class CoinPickup extends Pickup {
  constructor(x, y, value = 1) {
    super(x, y);
    this.value = value;
    this.magnet = CONFIG.drops.coinMagnet;
    this.pullSpeed = 260;
    this.pullBoost = 1.4;   // whooshes in faster the closer it gets
    this.lifetime = 35;
    this.sound = 'coin';
    this.soundGap = 0.09;   // a pile hoovered up at once is a quick jingle, not dozens of clinks
    const a = rand(0, TAU);
    const sp = rand(40, 110);
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp * 0.6;
    this.hop = 0;
    this.hopV = rand(120, 180);
    this.spin = rand(0, TAU);
  }

  wanted() { return true; }

  update(dt, world) {
    // fly out, land, then behave like a normal pickup
    if (this.hopV !== null) {
      world.dungeon.move(this, this.vx * dt, this.vy * dt);
      this.hop += this.hopV * dt;
      this.hopV -= 600 * dt;
      if (this.hop <= 0) { this.hop = 0; this.hopV = null; }
      this.age += dt;
      return;
    }
    super.update(dt, world);
  }

  get hw() { return 3; }
  get hh() { return 3; }

  collect(p, world) {
    world.run?.addCoins(this.value, p);   // into the purse of whoever picked it up
  }

  draw(ctx) {
    if (this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2) return;
    const big = this.value >= 5;
    const r = big ? 6 : 4;
    const w = Math.max(1, Math.round(Math.abs(Math.cos(this.age * 6 + this.spin)) * r));
    const y = Math.round(this.y - 4 - this.hop + (this.hopV === null ? Math.sin(this.age * 4) * 1.5 : 0));
    const x = Math.round(this.x);
    drawShadow(ctx, x, this.y + 2, r, 2, 0.3);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - w - 1, y - r - 1, w * 2 + 2, r * 2 + 2);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(x - w, y - r, w * 2, r * 2);
    ctx.fillStyle = '#ffd34a';
    ctx.fillRect(x - w, y - r, Math.max(1, w * 2 - 1), r * 2 - 1);
    if (w > 1) {
      ctx.fillStyle = '#fff2a0';
      ctx.fillRect(x - w + 1, y - r + 1, 1, r);
    }
  }
}

/**
 * One of the Baker's pastries: tossed in an arc from (x0, y0) to where it lands, then sitting
 * on the floor for any hero to eat: heals `heal` hp and gives a sugar rush (CONFIG.buffs.sugar).
 * kind is a key of Sprites.pastries.
 */
class PastryPickup extends Pickup {
  constructor(x0, y0, x, y, kind, { heal, life, flightTime, premium = false }) {
    super(x, y);
    this.premium = premium;   // Premium Baking Goods: its sugar rush stacks
    this.x0 = x0;
    this.y0 = y0;
    this.kind = kind;
    this.heal = heal;
    this.lifetime = life;
    this.flightTime = flightTime;
    this.magnet = 36;
    this.sound = 'pastryEat';
  }

  get landed() { return this.age >= this.flightTime; }

  /** Anyone will have one (even at full health, for the sugar rush). */
  wanted() { return this.landed; }

  update(dt, world) {
    const was = this.landed;
    super.update(dt, world);
    if (!was && this.landed) {
      // it plops down with a little bounce of crumbs
      world.effects.burst(this.x, this.y - 4, { count: 6, colors: ['#f4e0b8', '#ff8ad0', '#ffffff'], speed: [20, 60], life: [0.2, 0.4], up: 40 });
    }
  }

  collect(p, world) {
    p.heal(this.heal, world);
    const b = CONFIG.buffs.sugar;
    // premium pastries stack the rush (up to 3); plain ones just start or refresh it
    const stacks = p.buffs.sugar > 0 ? p.sugarStacks || 1 : 0;
    p.sugarStacks = this.premium ? Math.min(3, stacks + 1) : Math.max(1, stacks);
    p.buffs.sugar = b.duration;
    p.buffMax.sugar = b.duration;
    world.effects.text(p.hx, p.hy - 40, p.sugarStacks > 1 ? `SUGAR RUSH x${p.sugarStacks}!` : 'SUGAR RUSH!', { color: b.color, size: 9, life: 1 });
    world.effects.burst(p.hx, p.hy, { count: 16, colors: ['#ff8ad0', '#ffffff', '#8ad8ff', '#ffe680'], speed: [40, 140], life: [0.3, 0.6], up: 30 });
  }

  draw(ctx) {
    const img = Sprites.pastries[this.kind];
    if (!this.landed) {
      // in flight: big, arcing over, turning as it goes
      const k = this.age / this.flightTime;
      const x = lerp(this.x0, this.x, k);
      const y = lerp(this.y0, this.y, k) - Math.sin(k * Math.PI) * 70;
      drawShadow(ctx, x, lerp(this.y0, this.y, k) + 4, 8, 3, 0.25);
      ctx.save();
      ctx.translate(x, y - img.height);
      ctx.scale(1.8, 1.8);
      drawRotated(ctx, img, 0, 0, img.width / 2, img.height / 2, k * TAU);
      ctx.restore();
      return;
    }
    // on the floor, drawn larger (and bobbing) so it's easy to spot, with a soft pink sparkle
    if (this.age > this.lifetime - 3 && Math.floor(this.age * 8) % 2) return;   // blinking before it goes stale
    const s = 1.5;
    const bob = Math.sin(this.age * 4) * 2;
    drawShadow(ctx, this.x, this.y + 4, 10, 3);
    ctx.drawImage(img, Math.round(this.x - (img.width * s) / 2), Math.round(this.y - img.height * s + bob), Math.round(img.width * s), Math.round(img.height * s));
    if (Math.floor(this.age * 3) % 3 === 0) PFX.star(ctx, this.x + 12, this.y - img.height * s - 2 + bob, 2, '#ff8ad0', '#ffffff', 1);
  }
}

