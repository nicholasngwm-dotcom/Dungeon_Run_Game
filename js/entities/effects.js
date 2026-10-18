// Visual effects: particles, floating damage numbers, short-lived
// custom effects, and the red "telegraph" zones for enemy attacks.

const PIXEL_FONT = '"Press Start 2P", monospace';

class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.fx = [];        // drawn above entities
    this.groundFx = [];  // drawn on the floor, below entities
  }

  /** Spray of square pixel particles. */
  burst(x, y, opts = {}) {
    const {
      count = 8, colors = ['#ffffff'], speed = [40, 140], life = [0.3, 0.6],
      size = [2, 4], gravity = 0, drag = 3, angle = null, spread = TAU, up = 0,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = angle === null ? vrand(0, TAU) : angle + vrand(-spread / 2, spread / 2);
      const s = vrand(speed[0], speed[1]);
      const l = vrand(life[0], life[1]);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up,
        life: l, maxLife: l, size: Math.round(vrand(size[0], size[1])),
        color: vchoose(colors), gravity, drag,
      });
    }
  }

  text(x, y, str, { color = '#ffffff', size = 8, life = 0.8, rise = 40 } = {}) {
    this.texts.push({ x: x + vrand(-6, 6), y, str, color, size, life, maxLife: life, rise });
  }

  /** Custom effect: draw(ctx, t) where t goes 0 -> 1 over `life` seconds. */
  add(life, draw, ground = false) {
    (ground ? this.groundFx : this.fx).push({ life, maxLife: life, draw });
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) p.dead = true;
    }
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= (t.rise * dt * t.life) / t.maxLife;
      if (t.life <= 0) t.dead = true;
    }
    for (const list of [this.fx, this.groundFx]) {
      for (const f of list) {
        f.life -= dt;
        if (f.life <= 0) f.dead = true;
      }
      removeDead(list);
    }
    removeDead(this.particles);
    removeDead(this.texts);
  }

  drawGround(ctx) {
    for (const f of this.groundFx) f.draw(ctx, 1 - f.life / f.maxLife);
  }

  draw(ctx) {
    for (const f of this.fx) f.draw(ctx, 1 - f.life / f.maxLife);
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife * 1.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = clamp(t.life / t.maxLife * 2, 0, 1);
      const pop = 1 + Math.max(0, (t.life / t.maxLife - 0.8)) * 2;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(t.size * pop)}px ${PIXEL_FONT}`;
      ctx.fillStyle = OUTLINE;
      ctx.fillText(t.str, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillText(t.str, Math.round(t.x) - 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------
//  Telegraphs: ground markings that warn the player.
//  progress goes 0 -> 1 as the attack charges up.
// ---------------------------------------------------------------
const Telegraph = {
  red: '255, 60, 60',
  orange: '255, 150, 40',

  circle(ctx, x, y, r, progress, rgb = this.red) {
    ctx.save();
    ctx.fillStyle = `rgba(${rgb}, 0.14)`;
    ctx.strokeStyle = `rgba(${rgb}, 0.75)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb}, 0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, r * clamp(progress, 0, 1), 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  line(ctx, x1, y1, x2, y2, width, progress, rgb = this.red) {
    const a = angleTo(x1, y1, x2, y2);
    const len = dist(x1, y1, x2, y2);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(${rgb}, 0.14)`;
    ctx.fillRect(0, -width / 2, len, width);
    ctx.fillStyle = `rgba(${rgb}, 0.35)`;
    ctx.fillRect(0, -width / 2, len * clamp(progress, 0, 1), width);
    ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -width / 2, len, width);
    ctx.restore();
  },

  cone(ctx, x, y, angle, arc, range, progress, rgb = this.red) {
    ctx.save();
    const sector = (r) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, angle - arc / 2, angle + arc / 2);
      ctx.closePath();
    };
    ctx.fillStyle = `rgba(${rgb}, 0.14)`;
    sector(range);
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb}, 0.75)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb}, 0.32)`;
    sector(range * clamp(progress, 0, 1));
    ctx.fill();
    ctx.restore();
  },
};
