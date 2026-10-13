// Training dummy for the practice range. Takes damage (so DPS, crits and
// hp-threshold effects like bleed can be tested) but never dies: it refills
// when emptied, or after a few seconds without being hit.

const DUMMY_ANCHOR = { x: 20, y: 52 };

class TrainingDummy extends Entity {
  constructor(x, y) {
    super(x, y);
    this.maxHp = 2000;
    this.hp = this.maxHp;
    this.radius = 16;
    this.hitOffY = 22;
    this.hw = 10;
    this.hh = 6;
    this.immune = false;
    this.regenDelay = 0;
    this.wobble = 0;
    this.wobbleDir = 1;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTime = 0.1;
    this.wobble = 1;
    this.regenDelay = 3;
    if (this.hp <= 0) this.hp = this.maxHp;
    return true;
  }

  knockback(angle) { this.wobbleDir = Math.cos(angle) >= 0 ? 1 : -1; }
  stun() {}

  update(dt) {
    this.flashTime -= dt;
    this.wobble = Math.max(0, this.wobble - dt * 2.5);
    this.regenDelay -= dt;
    if (this.regenDelay <= 0) this.hp = this.maxHp;
  }

  drawGround(ctx) { drawShadow(ctx, this.x, this.y + 2, 14, 5); }

  draw(ctx) {
    const img = Sprites.items.dummy;
    const lean = Math.sin(this.wobble * 14) * this.wobble * 0.25 * this.wobbleDir;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(lean);
    ctx.drawImage(img.img, -DUMMY_ANCHOR.x, -DUMMY_ANCHOR.y);
    if (this.flashTime > 0) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img.flash, -DUMMY_ANCHOR.x, -DUMMY_ANCHOR.y);
    }
    ctx.restore();
    if (this.hp < this.maxHp) {
      const w = 34;
      const x = Math.round(this.x - w / 2);
      const y = Math.round(this.y - 60);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = '#3a3a2a';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#e8c45a';
      ctx.fillRect(x, y, Math.round(w * this.hp / this.maxHp), 3);
    }
  }
}
