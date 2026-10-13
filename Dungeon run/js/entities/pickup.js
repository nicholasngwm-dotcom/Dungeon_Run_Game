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
  wanted(p) { return p.resource && p.resource.value < p.resource.max; }

  collect(p, world) {
    p.gainResource(CONFIG.drops.manaRestore);
    world.effects.text(p.hx, p.hy - 24, `+${CONFIG.drops.manaRestore}`, { color: p.resource.color, size: 8 });
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
