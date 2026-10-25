// The Ancient Ruins' set dressing (see FloorDecor): trees grown up through the temple floor,
// standing stones with glowing runes, braziers where the magic burns teal, broken columns,
// ferns, rocks floating on the magic, and drifting clouds of the lingering magic itself. In
// the guardian's room, a ring of braziers and rune stones round the great circle in the floor.
// The braziers, rune stones and trees have small solid bases (DECOR_POSTS); the rest is walkable.
// All the motion (flames, floating rocks, drifting clouds) is visual only.

const RUIN_FLAME = ['#127068', '#22b8a6', '#5cf0d8', '#e8fffa'];

const RuinsDecor = {
  /** Fills room r. Returns false for rooms it leaves to FloorDecor (shops, specials). */
  decorate(fd, r) {
    const T = fd.floor.T;
    const at = (kind, dx, dy, extra = {}) => fd.add(kind, { x: r.cx + dx * T, y: r.cy + dy * T }, extra);
    const scatter = (kind, n, opts = {}, extra = {}) => { for (let i = 0; i < n; i++) fd.add(kind, fd.spot(r, opts), extra); };
    const clouds = (n) => {
      for (let i = 0; i < n; i++) {
        const pt = fd.floor.randomPointIn(r, 2);
        fd.add('magicCloud', pt, { room: { x0: (r.x0 + 1) * T, y0: (r.y0 + 1) * T, x1: r.x1 * T, y1: r.y1 * T }, size: rand(0.8, 1.3) });
      }
    };
    switch (r.type) {
      case 'start':
        at('magicBrazier', -3, 0.5);
        at('magicBrazier', 3, 0.5);
        fd.add('signpost', { x: r.cx, y: r.cy - 1 * T }, { text: `STAGE ${fd.run.stage}` });
        at('runeStone', -5.5, -2.6);
        at('runeStone', 5.5, -2.6);
        scatter('fern', 3, { clearMiddle: false });
        clouds(1);
        return true;
      case 'shop':
      case 'special':
        return false;
      case 'boss':
        this.guardianRoom(fd, r);
        return true;
      default:
        // the temple's halls: braziers in the corners, trees, columns and rune stones along the walls,
        // ferns and floating rocks on the floor, mirrored across the room; clouds of magic drifting through
        fd.dressRoom(r, {
          light: 'magicBrazier',
          wall: [['ruinTree'], ['brokenColumn'], ['runeStone'], ['ruinTree']],
          floor: [['fern'], ['floatRocks'], ['fern']],
        });
        clouds(r.type === 'combat' ? 2 : 1);
        return true;
    }
  },

  /** The guardian's room: braziers and rune stones ringing the great circle, trees and columns round the walls. */
  guardianRoom(fd, r) {
    const T = fd.floor.T;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      fd.add(i % 2 ? 'runeStone' : 'magicBrazier', { x: r.cx + Math.cos(a) * 8.6 * T, y: r.cy + Math.sin(a) * 5.4 * T + 0.5 * T });
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      fd.add('ruinTree', { x: r.cx + sx * 12 * T, y: r.cy + sy * 5.2 * T + 0.6 * T });
      fd.add('brokenColumn', { x: r.cx + sx * 10.8 * T, y: r.cy + sy * 2.6 * T });
      fd.add('floatRocks', { x: r.cx + sx * 6 * T, y: r.cy + sy * 7 * T });
    }
    for (let i = 0; i < 6; i++) fd.add('fern', fd.spot(r, { minGap: 50 }));
    for (let i = 0; i < 3; i++) {
      fd.add('magicCloud', fd.floor.randomPointIn(r, 3), { room: { x0: (r.x0 + 1) * T, y0: (r.y0 + 1) * T, x1: r.x1 * T, y1: r.y1 * T }, size: rand(1, 1.5) });
    }
  },

  // ---------- life (visual only) ----------

  update(fd, dt, world) {
    for (const d of fd.items) {
      if (d.kind === 'magicBrazier' && nativeRandom() < dt * 6) {
        world.effects.burst(d.x + vrand(-6, 6), d.y - 34, { count: 1, colors: RUIN_FLAME, speed: [5, 20], up: 50, life: [0.5, 1], size: [1, 2] });
      } else if (d.kind === 'runeStone' && nativeRandom() < dt * 1.2) {
        world.effects.burst(d.x + vrand(-5, 5), d.y - vrand(14, 30), { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [3, 10], up: 16, life: [0.8, 1.4], size: [1, 2] });
      } else if (d.kind === 'magicCloud') {
        // drifting slowly round the room, turning now and then
        d.turn = (d.turn || 0) - dt;
        if (d.turn <= 0) { d.turn = vrand(3, 7); d.heading = vrand(0, TAU); }
        d.x = clamp(d.x + Math.cos(d.heading) * 10 * dt, d.room.x0, d.room.x1);
        d.y = clamp(d.y + Math.sin(d.heading) * 6 * dt, d.room.y0, d.room.y1);
      }
    }
  },

  /** Lights for the gloom (see DungeonRun.lights). */
  lights(fd, out, t) {
    for (const d of fd.items) {
      const flick = Math.sin(t * 9 + d.seed);
      if (d.kind === 'magicBrazier') out.push({ x: d.x, y: d.y - 26, r: 160 + flick * 8, s: 0.95, rgb: RUIN_MAGIC });
      else if (d.kind === 'runeStone') out.push({ x: d.x, y: d.y - 20, r: 80, s: 0.6, rgb: RUIN_MAGIC });
      else if (d.kind === 'magicCloud') out.push({ x: d.x, y: d.y - 30, r: 90 * (d.size || 1), s: 0.35, rgb: '120, 240, 220' });
    }
  },

  /** Teal pools of light on the floor under the braziers. */
  drawGround(fd, ctx, d) {
    if (d.kind !== 'magicBrazier' && d.kind !== 'magicCloud') return;
    const cloud = d.kind === 'magicCloud';
    const flick = 1 + Math.sin(fd.time * 9 + d.seed) * 0.05;
    const r = (cloud ? 70 * (d.size || 1) : 90) * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
    g.addColorStop(0, `rgba(${RUIN_MAGIC}, ${cloud ? 0.08 : 0.16})`);
    g.addColorStop(1, `rgba(${RUIN_MAGIC}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
    ctx.restore();
  },

  /** True if this module draws `kind`. */
  draws(kind) {
    return ['magicBrazier', 'runeStone', 'ruinTree', 'brokenColumn', 'fern', 'floatRocks', 'magicCloud'].includes(kind);
  },

  /** Clouds float over everything; the rest sorts by its foot. */
  sortY(d) {
    return d.kind === 'magicCloud' ? d.y + 600 : d.y;
  },

  drawItem(fd, ctx, d) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const t = fd.time;
    const S = Sprites.ruinsDecor;
    const sprite = (img, flip = false, shadow = 0.3) => {
      if (shadow) drawShadow(ctx, x, y + 1, Math.max(6, img.width * 0.38), 4, shadow);
      drawSprite(ctx, img, x, y + 2, Math.round(img.width / 2), img.height, flip);
    };
    switch (d.kind) {
      case 'magicBrazier':
        sprite(S.brazier);
        for (let i = 0; i < 3; i++) PFX.flame(ctx, x - 6 + i * 6, y - 22, 7, 14 + (i === 1 ? 6 : 0), t * 8 + i + d.seed, RUIN_FLAME);
        drawGlow(ctx, x, y - 30, 26, RUIN_MAGIC, 0.3 + Math.sin(t * 9 + d.seed) * 0.05);
        break;
      case 'runeStone':
        sprite(S.runeStone, d.facing < 0);
        drawGlow(ctx, x, y - 21, 16, RUIN_MAGIC, 0.22 + Math.sin(t * 2 + d.seed) * 0.08);
        break;
      case 'ruinTree': {
        // the canopy sways a little in the breeze
        drawShadow(ctx, x, y + 1, 18, 6, 0.3);
        const img = S.tree;
        ctx.save();
        ctx.translate(x, y + 2);
        ctx.transform(1, 0, Math.sin(t * 0.8 + d.seed) * 0.02, 1, 0, 0);
        if (d.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(img, -Math.round(img.width / 2), -img.height);
        ctx.restore();
        break;
      }
      case 'brokenColumn': sprite(S.column, d.facing < 0); break;
      case 'fern': sprite(S.fern, d.seed > 5, 0.15); break;
      case 'floatRocks': {
        // a few rocks floating on the magic, bobbing out of step over a faint glow
        drawShadow(ctx, x, y, 14, 4, 0.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 14, 20, RUIN_MAGIC, 0.18 + Math.sin(t * 2 + d.seed) * 0.05);
        ctx.restore();
        for (const [dx, dy, ph, big] of [[-8, -20, 0, true], [9, -26, 2, false], [2, -36, 4, false], [12, -14, 1, true]]) {
          const img = big ? S.floatRock : S.floatRockSmall;
          const bob = Math.round(Math.sin(t * 1.6 + ph + d.seed) * 3);
          ctx.drawImage(img, Math.round(x + dx - img.width / 2), Math.round(y + dy + bob - img.height / 2));
        }
        break;
      }
      case 'magicCloud': {
        // a soft, slowly churning cloud of the lingering magic, sparkles twinkling in it
        const k = d.size || 1;
        const cy = y - 46;
        ctx.save();
        ctx.globalAlpha = 0.32;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + t * 0.3 + d.seed;
          PFX.smokeBlob(ctx, x + Math.cos(a) * 16 * k, cy + Math.sin(a) * 6 * k, 18 * k, ['rgba(18, 112, 104, 0.5)', 'rgba(34, 184, 166, 0.5)', 'rgba(140, 255, 230, 0.5)'], t * 0.8 + i, i);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.7 + i * 0.37 + d.seed) % 1.4;
          if (ph > 0.5) continue;
          ctx.fillStyle = `rgba(200, 255, 245, ${1 - ph * 2})`;
          ctx.fillRect(Math.round(x + Math.sin(i * 2.3 + d.seed) * 22 * k), Math.round(cy + Math.cos(i * 1.7) * 8 * k), 2, 2);
        }
        ctx.restore();
        break;
      }
    }
  },
};
