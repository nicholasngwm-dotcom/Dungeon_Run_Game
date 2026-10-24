// The Phantom King's room (see FloorDecor): the entrance hall of a haunted manor. The grand
// staircase against the back wall (solid, see DungeonRun.manorStairs), a chandelier hanging
// over the hall, moonlit windows and portraits along the back wall, grandfather clocks stopped
// at midnight, candelabras, furniture under dust sheets, urns and cobwebs, and the phantoms of
// the old household drifting about. The phantoms are decor only: they don't fight, can't be
// hit and pass through everything; they drift on fixed looping paths (visual only).

const ManorDecor = {
  /** Fills the boss room r. */
  decorate(fd, r) {
    const T = fd.floor.T;
    const top = r.y0 * T;
    fd.add('manorStairs', { x: r.cx, y: (r.y0 + 4) * T }, { pad: 240 });
    fd.add('chandelier', { x: r.cx, y: r.cy + 1 * T }, { pad: 220 });
    // along the back wall either side of the stairs: portraits and tall windows
    for (const s of [-1, 1]) {
      fd.add('portrait', { x: r.cx + s * 6.6 * T, y: top - 8 }, { who: s < 0 ? 0 : 1 });
      fd.add('manorWindow', { x: r.cx + s * 9.6 * T, y: top - 2 });
      fd.add('portrait', { x: r.cx + s * 12.6 * T, y: top - 8 }, { who: s < 0 ? 2 : 0 });
      fd.add('cobweb', { x: (s < 0 ? r.x0 : r.x1 + 1) * T, y: top - 64 }, { facing: -s });
    }
    // candelabras at the foot of the stairs and down the sides, clocks in the top corners
    const at = (kind, dx, dy, extra = {}) => fd.add(kind, { x: r.cx + dx * T, y: r.cy + dy * T }, extra);
    for (const s of [-1, 1]) {
      at('prop', s * 6.4, -5.2, { name: 'candelabra' });
      at('prop', s * 13.4, -1, { name: 'candelabra' });
      at('prop', s * 13.4, 6, { name: 'candelabra' });
      fd.add('manorClock', { x: r.cx + s * 13.6 * T, y: top + 1.4 * T });
      at('sheeted', s * 10.4, -2.4, { name: 'sheetChair', facing: s });
      at('sheeted', s * 11.2, 2.4, { name: 'sheetSofa', facing: s });
      at('urn', s * 8.6, -4.8);
      at('urn', s * 12.6, 8.4);
      at('candles', s * 9.4, 8.6);
    }
    // the household's phantoms, drifting round the hall on slow looping paths
    const kinds = [0, 1, 2, 0, 1];
    kinds.forEach((kind, i) => {
      const side = i % 2 ? 1 : -1;
      fd.add('manorPhantom', { x: r.cx + side * rand(3, 9) * T, y: r.cy + rand(-3, 6) * T }, {
        ghost: kind, rx: rand(2, 4) * T, ry: rand(1, 2.5) * T, speed: rand(0.12, 0.22) * (rand(0, 1) < 0.5 ? 1 : -1), phase: rand(0, TAU), pad: 200,
      });
    });
  },

  /** Where a phantom is at time t (its home, plus a slow figure-of-eight loop) and which way it faces. */
  phantomAt(d, t) {
    const a = t * d.speed + d.phase;
    const x = d.x + Math.cos(a) * d.rx;
    const y = d.y + Math.sin(a * 2) * d.ry * 0.5;
    const vx = -Math.sin(a) * d.speed;
    return { x, y, facing: vx >= 0 ? 1 : -1 };
  },

  /** Lights for the gloom (see DungeonRun.lights). */
  lights(fd, out, t) {
    for (const d of fd.items) {
      const flick = Math.sin(t * 9 + d.seed);
      if (d.kind === 'chandelier') {
        out.push({ x: d.x, y: d.y - MANOR_CHANDELIER.high + 20, r: 300 + flick * 10, s: 0.9, rgb: '255, 190, 110' });
      } else if (d.kind === 'manorStairs') {
        for (const [cx, cy] of MANOR_STAIRS.candles) out.push({ x: d.x + cx, y: d.y + cy, r: 120 + flick * 5, s: 0.85, rgb: '255, 190, 110' });
        out.push({ x: d.x, y: d.y - 150, r: 170, s: 0.5, rgb: '150, 200, 255' });   // moonlight through its window
      } else if (d.kind === 'manorWindow') {
        out.push({ x: d.x + 20, y: d.y + 70, r: 130, s: 0.55, rgb: '150, 200, 255' });
      } else if (d.kind === 'manorPhantom') {
        const p = this.phantomAt(d, t);
        out.push({ x: p.x, y: p.y - 30, r: 80, s: 0.45, rgb: '150, 230, 255' });
      }
    }
  },

  /** Moonbeams slanting in from the windows, and the chandelier's warm pool on the floor. */
  drawGround(fd, ctx, d) {
    if (d.kind === 'manorWindow' || d.kind === 'manorStairs') {
      // a pale shaft of moonlight falling from the window across the floor, motes of dust in it
      const t = fd.time;
      const x = d.x;
      const y = d.kind === 'manorStairs' ? d.y - 120 : d.y;
      const w = d.kind === 'manorStairs' ? 50 : 30;
      const len = d.kind === 'manorStairs' ? 110 : 150;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x, y, x + 40, y + len);
      g.addColorStop(0, 'rgba(150, 200, 255, 0.12)');
      g.addColorStop(1, 'rgba(150, 200, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w / 2 + 50, y + len);
      ctx.lineTo(x - w / 2 + 40, y + len);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(220, 235, 255, 0.5)';
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.05 + i / 5 + d.seed) % 1;
        ctx.fillRect(Math.round(x - w / 4 + k * 40 + Math.sin(t + i * 2) * 6), Math.round(y + k * len), 1, 1);
      }
      ctx.restore();
    } else if (d.kind === 'chandelier') {
      drawShadow(ctx, d.x, d.y, 34, 9, 0.18);
      const r = 150 * (1 + Math.sin(fd.time * 9 + d.seed) * 0.03);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
      g.addColorStop(0, 'rgba(255, 180, 90, 0.14)');
      g.addColorStop(1, 'rgba(255, 180, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
      ctx.restore();
    }
  },

  /**
   * Where an item sorts among the characters: the stairs, windows, portraits and cobwebs are
   * on the back wall (under everyone); the chandelier hangs over everyone's heads.
   */
  sortY(d) {
    if (d.kind === 'manorStairs') return d.y - 200;
    if (d.kind === 'chandelier') return d.y + 2000;
    return d.y;
  },

  /** True if this module draws `kind`. */
  draws(kind) {
    return ['manorStairs', 'chandelier', 'portrait', 'manorWindow', 'cobweb', 'manorClock', 'sheeted', 'manorPhantom'].includes(kind);
  },

  drawItem(fd, ctx, d) {
    const M = Sprites.manor;
    const t = fd.time;
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    switch (d.kind) {
      case 'manorStairs': {
        const img = M.stairs;
        ctx.drawImage(img, Math.round(x - img.width / 2), y - img.height);
        for (const [cx, cy] of MANOR_STAIRS.candles) drawFlame(ctx, x + cx, y + cy, t, cx + d.seed, true);
        break;
      }
      case 'chandelier': {
        // it hangs high over its floor point, swaying a little on its chain
        const img = M.chandelier;
        const hy = y - MANOR_CHANDELIER.high - img.height;
        const sway = Math.sin(t * 0.8 + d.seed) * 0.03;
        ctx.save();
        ctx.translate(x, hy);
        ctx.rotate(sway);
        ctx.drawImage(img, -img.width / 2, 0);
        for (const [cx, cy] of MANOR_CHANDELIER.candles) drawFlame(ctx, cx, cy - 7, t, cx + d.seed);
        ctx.restore();
        drawGlow(ctx, x, hy + 40, 70, '255, 180, 90', 0.18 + Math.sin(t * 7 + d.seed) * 0.02);
        break;
      }
      case 'portrait': {
        // hung a touch crooked; the eyes glint now and then
        const img = M.portraits[d.who || 0];
        ctx.save();
        ctx.translate(x, y - 50);
        ctx.rotate((d.seed % 1 - 0.5) * 0.06);
        ctx.drawImage(img, -img.width / 2, 0);
        if (Math.sin(t * 0.7 + d.seed * 3) > 0.97) {
          ctx.fillStyle = '#9af0ff';
          ctx.fillRect(-4, 18, 2, 1);
          ctx.fillRect(2, 18, 2, 1);
        }
        ctx.restore();
        break;
      }
      case 'manorWindow': {
        const img = M.window;
        ctx.drawImage(img, x - img.width / 2, y - img.height);
        drawGlow(ctx, x, y - 34, 30, '150, 200, 255', 0.14);
        break;
      }
      case 'cobweb': {
        const img = M.cobweb;
        drawSprite(ctx, img, x, y, 0, 0, d.facing < 0);
        break;
      }
      case 'manorClock': {
        // stopped at midnight, but the pendulum still swings
        drawShadow(ctx, x, y + 1, 12, 4, 0.3);
        drawProp(ctx, 'grandfatherClock', x, y);
        const cy = y - 72 + 18;
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(x, cy - 6, 1, 6);
        ctx.fillRect(x - 1, cy - 4, 1, 4);
        const swing = Math.sin(t * Math.PI * 0.5 + d.seed) * 0.35;
        const px = x + Math.sin(swing) * 16;
        const py = y - 72 + 33 + Math.cos(swing) * 16;
        ctx.strokeStyle = '#a07a24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y - 72 + 33);
        ctx.lineTo(px + 0.5, py);
        ctx.stroke();
        ctx.fillStyle = '#d4ac4c';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, TAU);
        ctx.fill();
        break;
      }
      case 'sheeted': {
        const img = M[d.name];
        drawShadow(ctx, x, y + 1, img.width * 0.42, 5, 0.3);
        drawSprite(ctx, img, x, y + 2, img.width / 2, img.height, (d.facing || 1) < 0);
        break;
      }
      case 'manorPhantom': {
        // pale and see-through, bobbing as it drifts, now and then fading almost away
        const p = this.phantomAt(d, t);
        const frames = M.phantoms[d.ghost];
        const img = frames[Math.floor(t * 6 + d.seed) % 4];
        const bob = Math.sin(t * 2 + d.seed) * 3;
        const fade = 0.45 + 0.15 * Math.sin(t * 0.6 + d.seed * 2);
        const px = Math.round(p.x);
        const py = Math.round(p.y - 18 + bob);
        drawShadow(ctx, px, Math.round(p.y), 9, 3, fade * 0.25);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, px, py - 28, 26, '150, 230, 255', fade * 0.5, 2, 16);
        ctx.restore();
        drawSprite(ctx, img, px, py, 20, 54, p.facing < 0, fade);
        break;
      }
    }
  },
};
