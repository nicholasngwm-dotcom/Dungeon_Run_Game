// Little living scenes for the special places: the blacksmith at his forge,
// the wishing well, the hero statue, the restaurant, the traders, the helper's
// camp. Each scene is a set of pieces placed around a spot (x, y) = where its
// keeper stands; Scenes.drawables returns them y-sorted like everything else.
// All animation is visual only (driven by time), so it never touches the
// shared multiplayer simulation.

/** Additive radial glow. rgb = 'r, g, b'. */
function drawGlow(ctx, x, y, r, rgb, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${a})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A small flickering candle flame with its tip at (x, y). */
function drawFlame(ctx, x, y, t, seed = 0, big = false) {
  const f = Math.sin(t * 13 + seed) > 0 ? 1 : 0;
  const h = (big ? 5 : 3) + f;
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x - 1, y - h, big ? 3 : 2, h);
  ctx.fillStyle = '#fff2a0';
  ctx.fillRect(x, y - h + 2, 1, h - 2);
  drawGlow(ctx, x, y - 2, big ? 18 : 10, '255, 180, 80', 0.22);
}

/** Puffs of smoke or steam drifting up from (x, y). */
function drawPuffs(ctx, x, y, t, color, n = 3, rise = 26, size = 4) {
  for (let i = 0; i < n; i++) {
    const s = (t * 0.6 + i / n) % 1;
    ctx.fillStyle = `rgba(${color}, ${0.45 * (1 - s)})`;
    const r = Math.round(size * (0.6 + s));
    ctx.fillRect(Math.round(x + Math.sin(s * 5 + i * 2) * 4) - r, Math.round(y - s * rise) - r, r * 2, r * 2);
  }
}

/** Glints twinkling at fixed points (seeded), e.g. on gold or water. */
function drawGlints(ctx, pts, t) {
  for (let i = 0; i < pts.length; i++) {
    const [gx, gy] = pts[i];
    const k = (t * 1.3 + i * 0.37) % 1.6;
    if (k > 0.4) continue;
    const a = 1 - Math.abs(k - 0.2) / 0.2;
    ctx.fillStyle = `rgba(255, 250, 220, ${a})`;
    ctx.fillRect(gx, gy - 1, 1, 3);
    ctx.fillRect(gx - 1, gy, 3, 1);
  }
}

/** The NPC frame for a keeper (the heroes' 8-frame idle), with a soft shadow. */
function npcPiece(name, x, y, t, flip = false, anim = 'idle', fps = CUTE.fps.idle) {
  return {
    y,
    draw: (ctx) => {
      const frames = Sprites.npcs[name][anim];
      drawShadow(ctx, x, y + 9, 13, 5);
      drawSprite(ctx, frames[Math.floor((t + x * 0.01) * fps) % frames.length].img, x, y, HERO_ANCHOR.x, HERO_ANCHOR.y, flip);
    },
  };
}

function propPiece(name, x, y, flip = false, extra = null) {
  return {
    y,
    draw: (ctx) => {
      const pr = Sprites.props[name];
      drawShadow(ctx, x, y, Math.max(6, pr.img.width * 0.4), 4, 0.3);
      drawProp(ctx, name, x, y, flip);
      if (extra) extra(ctx);
    },
  };
}

/** A toothed gear turned to `angle`. */
function drawGear(ctx, cx, cy, r, teeth, angle, color, dark) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  for (let i = 0; i < teeth; i++) {
    ctx.rotate(TAU / teeth);
    ctx.fillRect(-1.5, -r - 2, 3, 4);
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, TAU);
  ctx.fill();
  ctx.fillRect(-r * 0.75, -0.5, r * 1.5, 1);
  ctx.restore();
}

/** A jagged electric arc from (x0, y0) to (x1, y1). */
function drawArc(ctx, x0, y0, x1, y1, seed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const n = 6;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const off = ((j - Math.floor(j)) - 0.5) * 10;
    ctx.lineTo(x0 + (x1 - x0) * k + off, y0 + (y1 - y0) * k + off * 0.6);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

const Scenes = {
  /** Pieces for a scene of `kind` around (x, y) at time t. */
  drawables(kind, x, y, t) {
    const fn = this[kind];
    return fn ? fn.call(this, Math.round(x), Math.round(y), t) : [];
  },

  /**
   * The lobby's tech workshop: a tinkerer welds a glowing gadget at the bench
   * among a crackling tesla coil, spinning gears, a blinking console, a steaming
   * boiler and a half-built robot.
   */
  workshop(x, y, t) {
    const cycle = t % 5;
    const welding = cycle < 3;
    const flash = welding && Math.sin(t * 40) > 0.2;
    const tx = x - 58;   // tesla coil
    const bx = x + 104;  // boiler
    const cx = x + 80;   // console
    const rx = x - 92;   // robot
    return [
      propPiece('gearPanel', x - 24, y - 46, false, (ctx) => {
        const a = t * 1.4;
        drawGear(ctx, x - 36, y - 66, 9, 10, a, '#a8aebc', '#363a46');
        drawGear(ctx, x - 21, y - 58, 6, 7, -a * 1.5 + 0.2, '#d4ac4c', '#5a3c10');
        drawGear(ctx, x - 10, y - 70, 5, 6, a * 1.8, '#c87a3a', '#4a2a10');
      }),
      propPiece('toolBoard', x + 30, y - 48),
      propPiece('robot', rx, y + 2, false, (ctx) => {
        const on = 0.5 + Math.sin(t * 2) * 0.5;
        ctx.fillStyle = `rgba(255, ${Math.round(80 + on * 120)}, 80, ${0.4 + on * 0.6})`;
        ctx.fillRect(rx - 4, y - 34, 8, 3);
        drawGlow(ctx, rx, y - 32, 10, '255, 140, 80', on * 0.3);
      }),
      propPiece('teslaCoil', tx, y - 6, false, (ctx) => {
        const top = { x: tx, y: y - 57 };
        drawGlow(ctx, top.x, top.y, 26, '140, 210, 255', 0.25 + Math.sin(t * 7) * 0.08);
        // a few arcs crackling off the top, changing every few frames
        const s = Math.floor(t * 14);
        for (let i = 0; i < 3; i++) {
          const ang = ((s * 7 + i * 13) % 20) / 20 * TAU;
          const len = 12 + ((s + i * 5) % 7) * 2;
          drawArc(ctx, top.x, top.y, top.x + Math.cos(ang) * len, top.y + Math.sin(ang) * len * 0.7, s + i);
        }
      }),
      propPiece('boiler', bx, y - 10, false, (ctx) => {
        // gauge needle twitching near the red
        const g = -0.6 + Math.sin(t * 3) * 0.3 + Math.sin(t * 17) * 0.06;
        ctx.strokeStyle = '#e04545';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 5, y - 38);
        ctx.lineTo(bx + 5 + Math.cos(g - Math.PI / 2) * 3, y - 38 + Math.sin(g - Math.PI / 2) * 3);
        ctx.stroke();
        drawPuffs(ctx, bx + 15, y - 60, t, '230, 230, 240', 3, 26, 3);
      }),
      propPiece('console', cx, y + 10, false, (ctx) => {
        // scrolling green readout and blinking lights
        ctx.fillStyle = '#6cff9a';
        for (let i = 0; i < 4; i++) {
          const w = 4 + ((Math.floor(t * 3) + i * 3) % 5) * 4;
          ctx.fillRect(cx - 12, y - 22 + i * 3, w, 1);
        }
        if (Math.floor(t * 2) % 2) ctx.fillRect(cx - 12 + ((Math.floor(t * 3) * 4) % 20), y - 22 + 12, 2, 1);
        drawGlow(ctx, cx, y - 16, 18, '100, 255, 160', 0.12);
        for (let i = 0; i < 3; i++) {
          const on = Math.floor(t * 3 + i * 1.7) % 3 === 0;
          ctx.fillStyle = on ? ['#ff6a6a', '#ffd34a', '#6cff7a'][i] : '#2a2a34';
          ctx.fillRect(cx - 10 + i * 6, y - 31 + 34, 2, 2);
        }
      }),
      {
        y,
        draw: (ctx) => {
          const frames = Sprites.npcs.tinkerer;
          const f = welding ? frames.work[Math.floor(t * 12) % 2] : frames.idle[Math.floor(t * CUTE.fps.idle) % frames.idle.length];
          drawShadow(ctx, x, y + 9, 13, 5);
          drawSprite(ctx, f.img, x, y, HERO_ANCHOR.x, HERO_ANCHOR.y);
        },
      },
      propPiece('workbench', x + 34, y + 8, false, (ctx) => {
        // the gadget on the bench: a glowing core, brighter while being welded
        const gx = x + 26;
        const gy = y - 18;
        ctx.fillStyle = '#545a6a';
        ctx.fillRect(gx - 5, gy - 4, 10, 6);
        ctx.fillStyle = flash ? '#ffffff' : '#6ae0ff';
        ctx.fillRect(gx - 2, gy - 3, 4, 3);
        drawGlow(ctx, gx, gy - 2, flash ? 34 : 14, flash ? '200, 240, 255' : '100, 220, 255', flash ? 0.6 : 0.22);
        if (welding) {
          for (let i = 0; i < 7; i++) {
            const k = ((t * 3 + i * 0.37) % 1);
            const a = -Math.PI / 2 + Math.sin(i * 4.1 + Math.floor(t * 9)) * 1.3;
            ctx.fillStyle = i % 2 ? '#ffffff' : '#9ae6ff';
            ctx.fillRect(Math.round(gx + Math.cos(a) * k * 18), Math.round(gy - 2 + Math.sin(a) * k * 14 + k * k * 12), 1, 1);
          }
        }
      }),
    ];
  },

  /** The blacksmith hammers a glowing bar on the anvil beside a roaring forge. */
  blacksmith(x, y, t) {
    const cycle = (t * 0.9) % 1;
    // raise slowly, swing fast, hold on the strike, rest a moment
    const frame = cycle < 0.42 ? 0 : cycle < 0.5 ? 1 : cycle < 0.72 ? 2 : 3;
    const strike = cycle >= 0.5 && cycle < 0.62;
    const ax = x + 22;
    const ay = y + 5;
    const forgeX = x - 36;
    const forgeY = y - 18;
    return [
      propPiece('forge', forgeX, forgeY, false, (ctx) => {
        // fire in the hearth, flickering, with smoke out of the chimney
        const fl = 0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
        drawGlow(ctx, forgeX, forgeY - 19, 40 * fl, '255, 140, 50', 0.35);
        for (let i = 0; i < 6; i++) {
          const h = 3 + Math.round((Math.sin(t * 11 + i * 1.9) + 1) * 2.5);
          ctx.fillStyle = i % 2 ? '#ff6a1e' : '#ffb02e';
          ctx.fillRect(forgeX - 8 + i * 3, forgeY - 13 - h, 3, h);
        }
        ctx.fillStyle = '#fff2a0';
        ctx.fillRect(forgeX - 3, forgeY - 16, 5, 2);
        drawPuffs(ctx, forgeX, forgeY - 58, t, '90, 84, 96', 4, 34, 4);
      }),
      propPiece('weaponRack', x + 52, y - 14),
      propPiece('grindstone', x - 62, y + 10),
      propPiece('barrel', x + 46, y + 14, false, (ctx) => {
        if ((t * 0.9) % 1 < 0.3) drawPuffs(ctx, x + 46, y - 10, t * 2, '230, 230, 240', 2, 16, 2);
      }),
      {
        y,
        draw: (ctx) => {
          drawShadow(ctx, x, y + 9, 15, 5);
          drawSprite(ctx, Sprites.npcs.blacksmith.work[frame].img, x, y, HERO_ANCHOR.x, HERO_ANCHOR.y);
        },
      },
      propPiece('anvil', ax, ay, false, (ctx) => {
        // the hot bar on the anvil, cooling between strikes
        const heat = 0.6 + 0.4 * Math.sin(t * 3);
        ctx.fillStyle = heat > 0.7 ? '#ffd060' : '#ff8a2a';
        ctx.fillRect(ax - 2, ay - 21, 9, 2);
        ctx.fillStyle = '#fff2c0';
        ctx.fillRect(ax + 1, ay - 21, 3, 1);
        drawGlow(ctx, ax + 2, ay - 20, 14, '255, 150, 60', 0.25);
        if (strike) {
          const k = (cycle - 0.5) / 0.12;
          drawGlow(ctx, ax + 3, ay - 22, 26, '255, 210, 120', 0.5 * (1 - k));
          for (let i = 0; i < 9; i++) {
            const a = -Math.PI / 2 + (i - 4) * 0.33 + Math.sin(i * 7.1) * 0.2;
            const d = 4 + k * (14 + (i % 3) * 6);
            ctx.fillStyle = i % 3 ? '#ffd34a' : '#fff6c0';
            ctx.fillRect(Math.round(ax + 3 + Math.cos(a) * d), Math.round(ay - 22 + Math.sin(a) * d + k * k * 10), 1 + (i % 2), 1);
          }
        }
      }),
    ];
  },

  /** A stone well with glinting water, flowers and a bench. */
  wishingWell(x, y, t) {
    return [
      propPiece('well', x, y + 6, false, (ctx) => {
        const s = Math.sin(t * 2) * 2;
        ctx.fillStyle = 'rgba(140, 200, 255, 0.5)';
        ctx.fillRect(x - 10 + Math.round(s), y - 15, 6, 1);
        ctx.fillRect(x + 4 - Math.round(s), y - 13, 4, 1);
        drawGlints(ctx, [[x - 6, y - 16], [x + 8, y - 14], [x + 1, y - 17]], t);
        drawGlow(ctx, x, y - 16, 26, '120, 200, 255', 0.12 + Math.sin(t * 2.4) * 0.04);
        // a coin falls in now and then
        const c = (t * 0.35) % 1;
        if (c < 0.25) {
          ctx.fillStyle = '#ffd34a';
          ctx.fillRect(x - 1 + Math.round(c * 8), Math.round(y - 52 + c * c * 600), 2, 2);
        }
      }),
      propPiece('flowers', x - 32, y + 10),
      propPiece('flowers', x + 34, y + 8, true),
      propPiece('bench', x, y + 40),
    ];
  },

  /** A stone hero on a pedestal between two candelabras. */
  heroStatue(x, y, t, id) {
    const ids = Object.keys(CONFIG.classes);
    const heroId = id || ids[Math.floor(x / 97 + y / 61) % ids.length];
    if (!this.stoneCache) this.stoneCache = {};
    if (!this.stoneCache[heroId]) this.stoneCache[heroId] = stoneify(Sprites.heroes[heroId].idle[0].img);
    const img = this.stoneCache[heroId];
    return [
      propPiece('pedestal', x, y + 8, false, (ctx) => {
        drawSprite(ctx, img, x, y - 10, HERO_ANCHOR.x, HERO_ANCHOR.y);
        drawGlow(ctx, x, y - 30, 30, '255, 230, 160', 0.1 + Math.sin(t * 1.5) * 0.04);
      }),
      ...[-34, 34].map((dx) => propPiece('candelabra', x + dx, y + 10, false, (ctx) => {
        for (const cx of [-7, -1, 5]) drawFlame(ctx, x + dx + cx + 1, y - 17, t, cx + dx);
      })),
      propPiece('flowers', x - 14, y + 18),
      propPiece('flowers', x + 14, y + 18, true),
    ];
  },

  /** The 5-star restaurant: the chef by a bubbling pot, laid tables with stools. */
  restaurant5(x, y, t) {
    const pieces = [
      npcPiece('chef', x, y, t),
      propPiece('table', x - 60, y + 44),
      propPiece('table', x + 60, y + 44),
      propPiece('stewPot', x + 26, y + 6, false, (ctx) => {
        drawPuffs(ctx, x + 26, y - 18, t, '240, 240, 240', 3, 22, 3);
        drawGlow(ctx, x + 26, y + 4, 16, '255, 140, 50', 0.25 + Math.sin(t * 8) * 0.05);
      }),
    ];
    for (const [dx, dy] of [[-82, 50], [-38, 50], [38, 50], [82, 50]]) pieces.push(propPiece('stool', x + dx, y + dy));
    // floating stars over the kitchen
    pieces.push({
      y: y - 200,
      draw: (ctx) => {
        for (let i = 0; i < 5; i++) {
          const sy = y - 96 + Math.round(Math.sin(t * 3 + i * 0.8) * 1.5);
          HUD.text(ctx, '*', x - 20 + i * 10, sy, { size: 8, align: 'center', color: '#ffd34a' });
        }
      },
    });
    return pieces;
  },

  /** The mount trader with a pony, hay and a fence. */
  mountTrader(x, y, t) {
    return [
      propPiece('fence', x - 30, y - 30),
      propPiece('fence', x + 16, y - 30),
      npcPiece('mountTrader', x, y, t),
      {
        y: y + 2,
        draw: (ctx) => {
          const frames = Sprites.npcs.pony.idle;
          drawShadow(ctx, x + 52, y + 9, 26, 6);
          // the pony bobs its head and swishes its tail
          drawSprite(ctx, frames[Math.floor(t * 1.2) % 2].img, x + 52, y + 9, 40, 58, true);
        },
      },
      propPiece('hayBale', x - 42, y + 8),
      propPiece('trough', x + 50, y + 34),
    ];
  },

  /** The dark trader on a rug, a cauldron of something purple, candles and skulls. */
  darkTrader(x, y, t) {
    return [
      { y: y - 1000, draw: (ctx) => drawProp(ctx, 'rugRound', x, y + 22) },
      npcPiece('darkTrader', x, y, t),
      propPiece('cauldron', x + 32, y + 8, false, (ctx) => {
        drawGlow(ctx, x + 32, y - 14, 30, '170, 90, 255', 0.25 + Math.sin(t * 4) * 0.08);
        for (let i = 0; i < 3; i++) {
          const s = (t * 0.9 + i / 3) % 1;
          ctx.fillStyle = `rgba(200, 140, 255, ${1 - s})`;
          ctx.fillRect(x + 26 + i * 5, Math.round(y - 15 - s * 14), 2, 2);
        }
      }),
      propPiece('skullPile', x - 30, y + 12),
      propPiece('candelabra', x - 44, y - 4, false, (ctx) => {
        for (const cx of [-7, -1, 5]) drawFlame(ctx, x - 44 + cx + 1, y - 31, t, cx);
      }),
    ];
  },

  /** A friendly trader beside a cart piled with goods. */
  friendlyTrader(x, y, t) {
    return [
      propPiece('cart', x + 48, y + 4),
      npcPiece('trader', x, y, t),
      propPiece('sacks', x - 34, y + 8),
      propPiece('crate', x - 52, y - 2),
      propPiece('barrel', x + 20, y + 30),
    ];
  },

  /** The helper's camp: a tent, a bedroll and a cosy fire. */
  helper(x, y, t) {
    return [
      propPiece('tent', x - 44, y - 6),
      npcPiece('helper', x, y, t),
      {
        y: y + 12,
        draw: (ctx) => {
          const fx = x + 36;
          const fy = y + 14;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            ctx.fillStyle = i % 2 ? '#5c586c' : '#78738a';
            ctx.fillRect(Math.round(fx + Math.cos(a) * 10) - 3, Math.round(fy + Math.sin(a) * 4) - 2, 6, 4);
          }
          ctx.fillStyle = '#5b3922'; ctx.fillRect(fx - 8, fy - 3, 16, 3);
          for (let i = 0; i < 4; i++) {
            const h = 7 + Math.sin(t * 10 + i * 1.7) * 3;
            ctx.fillStyle = i % 2 ? '#ff5a1e' : '#ffb02e';
            ctx.fillRect(fx - 5 + i * 3, fy - 3 - h, 3, h);
          }
          drawGlow(ctx, fx, fy - 6, 40, '255, 170, 70', 0.25 + Math.sin(t * 9) * 0.04);
          drawPuffs(ctx, fx, fy - 14, t, '120, 114, 126', 3, 24, 3);
        },
      },
    ];
  },
};
