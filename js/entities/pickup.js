// Pickups dropped by enemies: health hearts and mana orbs.

class Pickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.dead = false;
  }

  /** True while the hero can use this pickup (otherwise it just sits there). */
  wanted() { return false; }
  collect() {}

  update(dt, world) {
    this.age += dt;
    const p = world.player;
    if (!p || p.dead) return;
    const d = dist(this.x, this.y, p.x, p.y);
    const wanted = this.wanted(p);
    if (d < 70 && wanted) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      this.x += Math.cos(a) * 220 * dt;
      this.y += Math.sin(a) * 220 * dt;
    }
    if (d < 18 && wanted) {
      this.collect(p, world);
      Sound.play('pickup');
      this.dead = true;
    }
    if (this.age > 20) this.dead = true;
  }

  drawSprite(ctx, img) {
    if (this.age > 17 && Math.floor(this.age * 8) % 2) return; // blink before vanishing
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

/** Buff orb from a mimic: type is a key of CONFIG.buffs (regen, speed, damage). */
class BuffPickup extends Pickup {
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
  }

  wanted() { return true; }

  collect(p, world) {
    const b = CONFIG.buffs[this.type];
    p.addBuff(this.type);
    world.effects.text(p.hx, p.hy - 40, `${b.name} UP!`, { color: b.color, size: 9, life: 1 });
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
