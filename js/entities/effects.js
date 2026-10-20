// Visual effects: particles, floating damage numbers, short-lived
// custom effects, and the red "telegraph" zones for enemy attacks.

const PIXEL_FONT = 'Alagard, monospace';

/**
 * Canvas text font for a size on the game's old 8px-grid scale (5 = smallest
 * label, 8 = normal, 20 = banner). Alagard is drawn on a 16px grid and the
 * canvas renders at 2x, so 8 (16 screen px) is its sharpest small size;
 * bigger text snaps to steps of 4 so it stays readable.
 */
function fontPx(size) {
  return size <= 7 ? 8 : Math.round((size * 1.5) / 4) * 4;
}

function uiFont(size) {
  return `${fontPx(size)}px ${PIXEL_FONT}`;
}

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

  /**
   * A critical hit: a big popping "CRIT!" number, a shockwave ring, a star of
   * light rays, a slash streak along the hit direction and a shower of sparks.
   * huge = an especially big hit (even more flash).
   */
  crit(x, y, dmg, angle = 0, huge = false) {
    this.texts.push({ x: x + vrand(-4, 4), y: y - 26, str: `${dmg}`, color: '#ffe066', size: huge ? 16 : 13, life: 1.1, maxLife: 1.1, rise: 46, crit: true });
    const rays = huge ? 10 : 8;
    const spin = vrand(0, TAU);
    this.add(0.32, (ctx, t) => {
      const e = 1 - (1 - t) * (1 - t);   // ease out
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // flash core
      const g = ctx.createRadialGradient(x, y, 1, x, y, 26 + e * 18);
      g.addColorStop(0, `rgba(255, 250, 220, ${0.9 * (1 - t)})`);
      g.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 46, y - 46, 92, 92);
      // shockwave ring
      ctx.strokeStyle = `rgba(255, 230, 140, ${1 - t})`;
      ctx.lineWidth = Math.max(1, 4 * (1 - t));
      ctx.beginPath();
      ctx.arc(x, y, 6 + e * (huge ? 46 : 34), 0, TAU);
      ctx.stroke();
      // star of light rays
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < rays; i++) {
        const a = spin + (i / rays) * TAU;
        const r0 = 6 + e * 10;
        const r1 = r0 + (i % 2 ? 12 : 22) * (1 - t * 0.5);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.stroke();
      }
      // slash streak through the target along the hit direction
      const len = 34 * (1 - t * 0.3);
      ctx.strokeStyle = `rgba(255, 245, 200, ${1 - t})`;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle + 0.5) * len, y - Math.sin(angle + 0.5) * len);
      ctx.lineTo(x + Math.cos(angle + 0.5) * len, y + Math.sin(angle + 0.5) * len);
      ctx.stroke();
      ctx.restore();
    });
    this.burst(x, y, { count: huge ? 22 : 16, colors: ['#ffffff', '#fff2a0', '#ffd34a', '#ff9a2a'], speed: [90, 240], life: [0.2, 0.5], size: [2, 4] });
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
      if (t.crit) { this.drawCritText(ctx, t, a); continue; }
      const pop = 1 + Math.max(0, (t.life / t.maxLife - 0.8)) * 2;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(fontPx(t.size) * pop)}px ${PIXEL_FONT}`;
      ctx.fillStyle = OUTLINE;
      ctx.fillText(t.str, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillText(t.str, Math.round(t.x) - 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  }

  /** Crit number: slams in big, jitters for a moment, with a "CRIT!" tag and a thick outline. */
  drawCritText(ctx, t, alpha) {
    const age = 1 - t.life / t.maxLife;
    const pop = age < 0.12 ? 2.2 - (age / 0.12) * 1.2 : 1 + Math.max(0, 0.06 - (age - 0.12)) * 3;
    const jitter = age < 0.3 ? Math.round(Math.sin(age * 90) * 2) : 0;
    const x = Math.round(t.x) + jitter;
    const y = Math.round(t.y);
    ctx.globalAlpha = alpha;
    const draw = (str, size, sy, fill) => {
      ctx.font = `${Math.max(8, Math.round(size * 1.5))}px ${PIXEL_FONT}`;   // scales smoothly while it slams in
      ctx.fillStyle = '#5a1a08';
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, 2], [2, 2], [-1, -1], [1, -1]]) ctx.fillText(str, x + dx, sy + dy);
      ctx.fillStyle = '#ff7a1e';
      ctx.fillText(str, x, sy + 1);
      ctx.fillStyle = fill;
      ctx.fillText(str, x, sy);
    };
    draw('CRIT!', 7 * Math.min(pop, 1.6), y - t.size * pop * 0.95, '#ffffff');
    draw(t.str, t.size * pop, y, age < 0.08 ? '#ffffff' : t.color);
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
