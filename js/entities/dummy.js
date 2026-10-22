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
    this.time = 0;
    this.log = [];          // recent hits { t, dmg }, for the damage-per-second readout
  }

  /** Damage per second over the last few seconds of hits (0 once you stop). */
  get dps() {
    const span = 3;
    const recent = this.log.filter((h) => this.time - h.t < span);
    if (!recent.length) return 0;
    const total = recent.reduce((s, h) => s + h.dmg, 0);
    return total / Math.max(1, Math.min(span, this.time - recent[0].t + 0.5));
  }

  /** "DPS 123" over a training dummy or target while it's being hit. */
  drawDps(ctx, y) {
    const dps = this.dps;
    if (dps <= 0) return;
    HUD.text(ctx, `DPS ${Math.round(dps)}`, Math.round(this.x), Math.round(y), { size: 6, align: 'center', color: '#ffe680' });
  }

  takeDamage(amount) {
    this.log.push({ t: this.time, dmg: amount });
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
    this.time += dt;
    this.log = this.log.filter((h) => this.time - h.t < 3);
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
    this.drawDps(ctx, this.y - 72);
  }
}

/**
 * An archery target in the training grounds: hit it with anything, like the dummy.
 * It rocks on its easel, flashes, and arrows (or splinters, for blades and spells)
 * stick in its face where the blows land; the oldest fall out after a while.
 */
class TrainingTarget extends TrainingDummy {
  constructor(x, y) {
    super(x, y);
    this.radius = 18;
    this.hitOffY = 26;
    this.marks = [];        // { x, y (from the boss centre), arrow, angle, t }
  }

  takeDamage(amount, world) {
    super.takeDamage(amount);
    const hero = world && world.actor;
    // where it landed: a little spread round the middle (visual only)
    const a = vrand(0, TAU);
    const r = Math.sqrt(vrand(0, 1)) * 11;
    this.marks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, arrow: !!hero && hero.classId === 'ranger', angle: vrand(-0.5, 0.5), t: this.time });
    if (this.marks.length > 8) this.marks.shift();
    if (r < 3) world?.effects.text(this.x, this.y - 70, 'BULLSEYE!', { color: '#ffd34a', size: 8, life: 0.8 });
    return true;
  }

  update(dt) {
    super.update(dt);
    this.marks = this.marks.filter((m) => this.time - m.t < 12);
  }

  draw(ctx) {
    const img = Sprites.props.targetClean;
    const lean = Math.sin(this.wobble * 14) * this.wobble * 0.12 * this.wobbleDir;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(lean);
    ctx.drawImage(img.img, -img.ax, -img.ay - 1);
    // the boss's centre in the sprite: (18, 20) of the 36x46 drawing (+1 for its outline border)
    const cx = -img.ax + 19;
    const cy = -img.ay + 20;
    for (const m of this.marks) {
      const x = Math.round(cx + m.x);
      const y = Math.round(cy + m.y);
      if (m.arrow) {
        // an arrow shaft sticking out toward you, fletching on the end
        const dx = Math.round(Math.cos(m.angle - 0.6) * 7);
        const dy = Math.round(Math.sin(m.angle - 0.6) * 7);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
        ctx.strokeStyle = '#8c5e36';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#c84040';
        ctx.fillRect(x + dx - 1, y + dy - 1, 3, 2);
      } else {
        // a torn little hole with straw poking out
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        ctx.fillStyle = '#c8a85a';
        ctx.fillRect(x + 1, y - 2, 1, 1);
        ctx.fillRect(x - 2, y + 1, 1, 1);
      }
    }
    if (this.flashTime > 0) {
      ctx.globalAlpha = 0.6;
      img.flash ??= PixelArt.silhouette(img.img);
      ctx.drawImage(img.flash, -img.ax, -img.ay - 1);
    }
    ctx.restore();
    this.drawDps(ctx, this.y - 60);
  }
}
