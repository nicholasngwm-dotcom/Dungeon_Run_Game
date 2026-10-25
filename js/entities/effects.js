// Visual effects: particles, floating damage numbers, short-lived
// custom effects, and the red "telegraph" zones for enemy attacks.

const PIXEL_FONT = 'Alagard, monospace';

// shared palettes for the elemental effects (rim / outer first)
const SMOKE_COLORS = ['#1c1c26', '#3e3e52', '#62627c'];
const ICE_COLORS = ['#4a8aff', '#9ad0ff', '#e6f6ff', '#ffffff'];
const FIRE_COLORS = ['#a8200e', '#e0461e', '#ff8a1e', '#ffd34a', '#fff6c8'];
// enemy fire burns a deep blood red, so it never looks like the heroes' orange-gold flames on the floor
const ENEMY_FIRE_COLORS = ['#4a0408', '#8a0c12', '#c81a1a', '#ff3a26', '#ff9a80'];

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
    // Set by Game in multiplayer: othersActing() is true while a teammate's hero acts, and
    // nearMe(x, y) is true at this screen's hero (a teammate's buff landing on you stays bright).
    // Teammates' effects are thinned and faded by Settings.othersFx - looks only, never the outcome.
    this.othersActing = null;
    this.nearMe = null;
    this.layer = null;   // offscreen canvas teammates' effects are drawn on, then faded in as one
  }

  /** True if an effect starting now (at x, y, if it has a spot) is a teammate's to fade. */
  isOthers(x, y) {
    if (!this.othersActing || Settings.data.othersFx >= 1 || !this.othersActing()) return false;
    return x === undefined || !this.nearMe(x, y);
  }

  /** Spray of square pixel particles. */
  burst(x, y, opts = {}) {
    const {
      count = 8, colors = ['#ffffff'], speed = [40, 140], life = [0.3, 0.6],
      size = [2, 4], gravity = 0, drag = 3, angle = null, spread = TAU, up = 0,
    } = opts;
    const other = this.isOthers(x, y);
    // a teammate's bursts get fewer sparks too (rounded at random, so small ones still show sometimes)
    const n = other ? Math.floor(count * Settings.data.othersFx + vrand(0, 1)) : count;
    for (let i = 0; i < n; i++) {
      const a = angle === null ? vrand(0, TAU) : angle + vrand(-spread / 2, spread / 2);
      const s = vrand(speed[0], speed[1]);
      const l = vrand(life[0], life[1]);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up,
        life: l, maxLife: l, size: Math.round(vrand(size[0], size[1])),
        color: vchoose(colors), gravity, drag, other,
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

  /**
   * Billowing cloud of pixel smoke. Each wisp bursts outward, then keeps
   * rising while it curls along a swirling path, trailing smaller billows
   * behind it into a tendril, and frays apart strand by strand as it thins.
   * colors = [shadow, body, light].
   */
  smoke(x, y, { count = 8, radius = 16, life = 0.7, rise = 22, colors = SMOKE_COLORS } = {}) {
    const n = Math.round(count * 1.1);
    const wisps = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU + vrand(-0.5, 0.5);
      return {
        a, d0: vrand(0, 0.35) * radius, out: vrand(0.5, 1.1) * radius, r: vrand(0.38, 0.62) * radius,
        swirl: vrand(4, 10) * vchoose([-1, 1]), freq: vrand(1.5, 3), rise: vrand(0.7, 1.3),
        delay: vrand(0, 0.12), seed: vrand(0, 100),
      };
    });
    // the biggest wisps first, so the small ones curl over them
    wisps.sort((a, b) => b.r - a.r);
    const at = (w, u) => {
      const e = 1 - (1 - u) ** 2.5;                             // fast burst out, then a slow drift
      const d = w.d0 + w.out * e;
      const s = Math.sin(u * w.freq * Math.PI + w.seed) * w.swirl * u;
      return [
        x + Math.cos(w.a) * d + s,
        y + Math.sin(w.a) * d * 0.6 - rise * w.rise * u + Math.cos(u * w.freq * Math.PI + w.seed) * w.swirl * 0.4 * u,
        e,
      ];
    };
    this.add(life, (ctx, t) => {
      ctx.save();
      const secs = t * life;
      for (const w of wisps) {
        const u = clamp((t - w.delay) / (1 - w.delay), 0, 1);
        if (u <= 0) continue;
        ctx.globalAlpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.45;
        const density = u < 0.4 ? 1 : 1 - ((u - 0.4) / 0.6) * 1.05;
        const shrink = u > 0.7 ? 1 - (u - 0.7) : 1;
        // the tendril: smaller billows trailing back along the path, then the head on top
        for (const [lag, scale] of [[0.24, 0.4], [0.12, 0.65], [0, 1]]) {
          if (u - lag <= 0) continue;
          const [px, py, e] = at(w, u - lag);
          PFX.smokeBlob(ctx, px, py, w.r * (0.5 + 0.7 * e) * shrink * scale, colors, secs, w.seed + lag * 10, density);
        }
      }
      ctx.restore();
    });
  }

  /** Spray of spinning ice shards that slow down and fade. */
  shards(x, y, { count = 10, speed = [120, 260], life = 0.5, len = [7, 13], width = 5, colors = ICE_COLORS, angle = null, spread = TAU, glow = true } = {}) {
    const list = Array.from({ length: count }, () => {
      const a = angle === null ? vrand(0, TAU) : angle + vrand(-spread / 2, spread / 2);
      return { a, v: vrand(speed[0], speed[1]), len: vrand(len[0], len[1]), spin: vrand(-8, 8) };
    });
    this.add(life, (ctx, t) => {
      const travel = (1 - Math.exp(-5 * t * life)) / 5;   // seconds of flight, slowed by drag
      ctx.save();
      if (glow) ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      for (const s of list) {
        const d = s.v * travel;
        PFX.shard(ctx, x + Math.cos(s.a) * d, y + Math.sin(s.a) * d, s.a + s.spin * t, s.len * (1 - t * 0.4), width, colors);
      }
      ctx.restore();
    });
  }

  /** Flames licking up from (x, y) for `life` seconds. colors = outer first. */
  flames(x, y, { count = 3, spread = 10, height = 18, width = 9, life = 0.5, colors = FIRE_COLORS } = {}) {
    const tongues = Array.from({ length: count }, () => ({
      dx: vrand(-spread, spread), h: vrand(0.6, 1) * height, w: vrand(0.7, 1) * width, phase: vrand(0, 10),
    }));
    this.add(life, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const s = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;   // flare up, then die down
      for (const f of tongues) PFX.flame(ctx, x + f.dx, y, f.w * s, f.h * s, f.phase + t * life, colors);
      ctx.restore();
    });
  }

  /** Custom effect: draw(ctx, t) where t goes 0 -> 1 over `life` seconds. */
  add(life, draw, ground = false) {
    (ground ? this.groundFx : this.fx).push({ life, maxLife: life, draw, other: this.isOthers() });
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
    this.drawFaded(ctx, this.groundFx, []);
  }

  draw(ctx) {
    this.drawFaded(ctx, this.fx, this.particles);
  }

  /** Your own and the world's effects as they are, then teammates' faded together on one layer. */
  drawFaded(ctx, fx, particles) {
    this.drawList(ctx, fx, particles, false);
    const level = Settings.data.othersFx;
    if (!(level > 0) || !(fx.some((f) => f.other) || particles.some((p) => p.other))) return;
    const src = ctx.canvas;
    if (!this.layer) this.layer = document.createElement('canvas');
    const layer = this.layer;
    if (layer.width !== src.width || layer.height !== src.height) { layer.width = src.width; layer.height = src.height; }
    const lc = layer.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, layer.width, layer.height);
    lc.setTransform(ctx.getTransform());
    lc.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
    this.drawList(lc, fx, particles, true);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = level;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  drawList(ctx, fx, particles, other) {
    for (const f of fx) if (!!f.other === other) f.draw(ctx, 1 - f.life / f.maxLife);
    for (const p of particles) {
      if (!!p.other !== other) continue;
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
// Drawn in the house style: a dark outline under a bright rim, a soft gradient
// that's strongest at the edge, the charge filling outward with a glowing
// leading edge, chevrons showing which way the attack goes, and a quick pulse
// in the last moment before it lands. Shapes match the real hit areas exactly.
const Telegraph = {
  red: '255, 60, 60',
  orange: '255, 150, 40',

  /** 0..1 flicker for the final moments of a windup (visual only). */
  pulse(progress) {
    return progress > 0.8 ? 0.5 + Math.sin(performance.now() / 45) * 0.5 : 0;
  },

  /** Dark outline then a bright rim along whatever path is current. */
  rim(ctx, rgb, alpha, width = 2) {
    ctx.strokeStyle = 'rgba(26, 16, 32, 0.55)';
    ctx.lineWidth = width + 2;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();
  },

  circle(ctx, x, y, r, progress, rgb = this.red) {
    const k = clamp(progress, 0, 1);
    const flash = this.pulse(k);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, `rgba(${rgb}, 0.05)`);
    g.addColorStop(1, `rgba(${rgb}, ${0.22 + flash * 0.12})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    this.rim(ctx, rgb, 0.8 + flash * 0.2);
    // a slow dashed ring turning inside the edge
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -performance.now() / 60;
    ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r - 6), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // the charge filling outward, its edge glowing
    if (k > 0) {
      ctx.fillStyle = `rgba(${rgb}, ${0.22 + flash * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 240, 220, ${0.35 + k * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  },

  line(ctx, x1, y1, x2, y2, width, progress, rgb = this.red) {
    const a = angleTo(x1, y1, x2, y2);
    const len = dist(x1, y1, x2, y2);
    const k = clamp(progress, 0, 1);
    const flash = this.pulse(k);
    const hw = width / 2;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, `rgba(${rgb}, ${0.24 + flash * 0.1})`);
    g.addColorStop(0.5, `rgba(${rgb}, 0.08)`);
    g.addColorStop(1, `rgba(${rgb}, ${0.24 + flash * 0.1})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, -hw, len, width);
    ctx.fillStyle = `rgba(${rgb}, ${0.26 + flash * 0.15})`;
    ctx.fillRect(0, -hw, len * k, width);
    // edges
    ctx.beginPath();
    ctx.moveTo(0, -hw); ctx.lineTo(len, -hw);
    ctx.moveTo(0, hw); ctx.lineTo(len, hw);
    this.rim(ctx, rgb, 0.8 + flash * 0.2, width > 10 ? 2 : 1);
    // the charge's leading edge
    if (k > 0) {
      ctx.fillStyle = `rgba(255, 240, 220, ${0.4 + k * 0.4})`;
      ctx.fillRect(Math.round(len * k) - 1, -hw, 2, width);
    }
    // chevrons running down the lane
    if (width >= 8) {
      const step = Math.max(18, width * 1.2);
      const s = Math.min(hw * 0.6, 7);
      const shift = (performance.now() / 12) % step;
      ctx.strokeStyle = `rgba(255, 230, 210, ${0.28 + flash * 0.2})`;
      ctx.lineWidth = 2;
      for (let d = shift; d < len - s; d += step) {
        ctx.beginPath();
        ctx.moveTo(d - s, -s);
        ctx.lineTo(d, 0);
        ctx.lineTo(d - s, s);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  cone(ctx, x, y, angle, arc, range, progress, rgb = this.red) {
    const k = clamp(progress, 0, 1);
    const flash = this.pulse(k);
    ctx.save();
    const sector = (r) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, angle - arc / 2, angle + arc / 2);
      ctx.closePath();
    };
    const g = ctx.createRadialGradient(x, y, 0, x, y, range);
    g.addColorStop(0, `rgba(${rgb}, 0.04)`);
    g.addColorStop(1, `rgba(${rgb}, ${0.24 + flash * 0.12})`);
    ctx.fillStyle = g;
    sector(range);
    ctx.fill();
    this.rim(ctx, rgb, 0.8 + flash * 0.2);
    if (k > 0) {
      ctx.fillStyle = `rgba(${rgb}, ${0.24 + flash * 0.15})`;
      sector(range * k);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 240, 220, ${0.35 + k * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, range * k, angle - arc / 2, angle + arc / 2);
      ctx.stroke();
    }
    // a chevron pointing the way the blow travels
    const cr = range * 0.62;
    const cx = x + Math.cos(angle) * cr;
    const cy = y + Math.sin(angle) * cr;
    const s = Math.min(9, range * 0.12);
    ctx.strokeStyle = `rgba(255, 230, 210, ${0.35 + flash * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle + 2.4) * s, cy + Math.sin(angle + 2.4) * s);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle - 2.4) * s, cy + Math.sin(angle - 2.4) * s);
    ctx.stroke();
    ctx.restore();
  },
};
