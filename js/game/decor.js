// Set dressing for a dungeon floor: none of it blocks movement, it's there to
// make rooms feel alive. Dead trees, soul-flame lamp posts, flickering
// candles, coffins, bone piles, crows that take off when you get close, a
// campfire in the start room, and barrels / crates / shelves / rugs in the
// shop. Drifting mist rises around the hero. Placement happens once, inside the
// shared simulation; the idle animation (crows, embers, mist) is visual only.

class FloorDecor {
  constructor(floor, run) {
    this.floor = floor;
    this.run = run;
    this.items = [];
    this.time = 0;
    this.mistTimer = 0;
    for (const r of floor.rooms) this.decorate(r);
  }

  // ---------- placement ----------

  /** A free spot in the room: away from doors, the middle (for fight rooms), spikes, props and other decor. */
  spot(r, { margin = 1, clearMiddle = true, minGap = 48 } = {}) {
    const f = this.floor;
    const T = f.T;
    const doorTiles = r.doors.flatMap((d) => d.tiles).map((t) => ({ x: (t % f.cols + 0.5) * T, y: (Math.floor(t / f.cols) + 0.5) * T }));
    for (let i = 0; i < 40; i++) {
      const pt = f.randomPointIn(r, margin);
      pt.x += rand(-8, 8);
      if (clearMiddle && Math.abs(pt.x - r.cx) < 3.5 * T && Math.abs(pt.y - r.cy) < 2.5 * T) continue;
      if (doorTiles.some((d) => dist(d.x, d.y, pt.x, pt.y) < 2.6 * T)) continue;
      if (this.run.spikes.some((s) => Math.abs(s.x + 16 - pt.x) < 40 && Math.abs(s.y + 16 - pt.y) < 40)) continue;
      if (this.run.props.some((p) => p.room === r && dist(p.x, p.y, pt.x, pt.y) < 80)) continue;
      if (this.items.some((d) => dist(d.x, d.y, pt.x, pt.y) < minGap)) continue;
      return pt;
    }
    return null;
  }

  add(kind, pt, extra = {}) {
    if (pt) this.items.push({ kind, x: pt.x, y: pt.y, seed: Math.random() * 10, ...extra });
  }

  decorate(r) {
    const T = this.floor.T;
    const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    const many = (n) => Math.max(1, Math.round(n * area / 250));
    switch (r.type) {
      case 'start':
        this.add('campfire', { x: r.cx - 3 * T, y: r.cy + 0.5 * T });
        this.add('signpost', { x: r.cx + 3 * T, y: r.cy - 1 * T }, { text: `STAGE ${this.run.stage}` });
        for (let i = 0; i < 2; i++) this.add('candles', this.spot(r, { clearMiddle: false }));
        return;
      case 'shop': {
        this.add('rug', { x: r.cx, y: r.cy + 0.5 * T }, { w: 10 * T, h: 4 * T });
        for (const dx of [-6, 6]) this.add('shelf', { x: r.cx + dx * T, y: (r.y0 + 0.7) * T });
        for (let i = 0; i < 3; i++) this.add(choose(['barrel', 'barrel', 'crate']), this.spot(r, { clearMiddle: false, minGap: 34 }));
        for (const dx of [-7, 7]) this.add('lampPost', { x: r.cx + dx * T, y: r.cy + 3 * T }, { warm: true });
        // Mira's side: a bubbling cauldron; Bram's side: a banner and candles
        this.add('prop', { x: r.cx - 6.4 * T, y: r.cy - 0.2 * T }, { name: 'cauldron' });
        this.add('prop', { x: r.cx + 6.4 * T, y: r.cy - 0.6 * T }, { name: 'bannerBlue' });
        this.add('prop', { x: r.cx + 5.4 * T, y: r.cy + 0.6 * T }, { name: 'candelabra' });
        return;
      }
      case 'special': {
        // the keeper's scene sits in the middle (run.js); fill the room around it
        const place = (name, n, opts = {}) => {
          for (let i = 0; i < n; i++) this.add('prop', this.spot(r, { clearMiddle: true, minGap: 40, ...opts }), { name });
        };
        const sets = {
          blacksmith: [['crate', 2], ['barrel', 2], ['bannerRed', 1], ['sacks', 1]],
          wishingWell: [['flowers', 4], ['plant', 2], ['bench', 1]],
          heroStatue: [['bannerBlue', 2], ['plant', 2], ['flowers', 2]],
          restaurant5: [['plant', 2], ['barrel', 2], ['bannerGreen', 1], ['sacks', 1]],
          mountTrader: [['hayBale', 3], ['sacks', 1], ['fence', 1]],
          darkTrader: [['skullPile', 2], ['candelabra', 2]],
          friendlyTrader: [['crate', 2], ['sacks', 2], ['barrel', 1], ['plant', 1]],
          treasure: [['goldPile', 5], ['candelabra', 2], ['chest', 1]],
          helper: [['crate', 1], ['sacks', 1], ['bench', 1], ['flowers', 2]],
        };
        for (const [name, n] of sets[r.special] || []) place(name, n);
        for (let i = 0; i < 2; i++) this.add('candles', this.spot(r));
        return;
      }
      case 'boss':
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          this.add('lampPost', { x: r.cx + sx * ((r.x1 - r.x0) / 2 - 1.5) * T, y: r.cy + sy * ((r.y1 - r.y0) / 2 - 1.5) * T });
        }
        for (let i = 0; i < 4; i++) this.add('candles', this.spot(r));
        for (let i = 0; i < 2; i++) this.add('bonePile', this.spot(r));
        return;
      default: {
        // graveyard rooms
        for (let i = 0; i < many(1.2); i++) this.add('deadTree', this.spot(r, { minGap: 90 }));
        for (let i = 0; i < many(1); i++) this.add('lampPost', this.spot(r, { minGap: 120 }));
        for (let i = 0; i < many(1.5); i++) this.add('candles', this.spot(r));
        if (Math.random() < 0.5) this.add('coffin', this.spot(r));
        for (let i = 0; i < many(1.2); i++) this.add(choose(['bonePile', 'urn']), this.spot(r));
        for (let i = 0; i < randInt(1, 3); i++) {
          const pt = this.spot(r, { minGap: 30 });
          this.add('crow', pt, { flying: false, t: 0, vx: 0, vy: 0, facing: Math.random() < 0.5 ? 1 : -1 });
        }
      }
    }
  }

  // ---------- life ----------

  update(dt, world) {
    this.time += dt;
    const p = world.localPlayer;   // visual only: crows and mist react to this screen's hero
    for (const d of this.items) {
      if (d.kind === 'crow') this.updateCrow(d, dt, p);
      else if (d.kind === 'campfire' && nativeRandom() < dt * 8) {
        world.effects.burst(d.x + vrand(-6, 6), d.y - 10, { count: 1, colors: ['#ffb02e', '#ff5a1e', '#fff2a0'], speed: [5, 20], up: 60, life: [0.5, 1.1], size: [1, 3] });
      } else if (d.kind === 'lampPost' && nativeRandom() < dt * 1.2) {
        world.effects.burst(d.x + vrand(-4, 4), d.y - 44, { count: 1, colors: d.warm ? ['#ffd34a', '#fff2a0'] : ['#8affb0', '#c8ffe0'], speed: [3, 10], up: 18, life: [1, 1.8], size: [1, 2] });
      }
    }
    removeDead(this.items);
    // mist drifting up out of the ground near the hero
    this.mistTimer -= dt;
    if (this.mistTimer <= 0 && !p.dead) {
      this.mistTimer = 0.12;
      world.effects.burst(p.x + vrand(-460, 460), p.y + vrand(-260, 260), {
        count: 1, colors: ['rgba(120, 160, 140, 0.25)', 'rgba(90, 120, 110, 0.22)'], speed: [4, 12], up: 8, life: [2, 3.5], size: [6, 10],
      });
    }
  }

  /** Crows sit and peck; when the hero comes close they flap off and leave. */
  updateCrow(d, dt, p) {
    d.t += dt;
    if (!d.flying) {
      if (!p.dead && dist(p.x, p.y, d.x, d.y) < 90) {
        d.flying = true;
        d.t = 0;
        const away = angleTo(p.x, p.y, d.x, d.y) + vrand(-0.6, 0.6);
        d.vx = Math.cos(away) * 140;
        d.facing = d.vx >= 0 ? 1 : -1;
        Sound.play('dagger', 0.3);
      }
      return;
    }
    d.x += d.vx * dt;
    d.y -= 110 * dt;
    if (d.t > 2.2) d.dead = true;
  }

  // ---------- drawing ----------

  visible(d, cam, pad = 90) {
    return d.x > cam.x - pad && d.x < cam.x + cam.width + pad && d.y > cam.y - pad && d.y < cam.y + cam.height + pad * 2;
  }

  /** Rugs and light pools sit on the floor under everything. */
  drawGround(ctx, cam) {
    for (const d of this.items) {
      if (!this.visible(d, cam, 200)) continue;
      if (d.kind === 'rug') this.drawRug(ctx, d);
      if (d.kind === 'lampPost' || d.kind === 'campfire') {
        const flick = 1 + Math.sin(this.time * 9 + d.seed) * 0.05;
        const r = (d.kind === 'campfire' ? 110 : 80) * flick;
        const rgb = d.kind === 'campfire' || d.warm ? '255, 170, 70' : '120, 255, 170';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
        g.addColorStop(0, `rgba(${rgb}, 0.16)`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }

  getDrawables(cam) {
    return this.items
      .filter((d) => d.kind !== 'rug' && this.visible(d, cam))
      .map((d) => ({ y: d.kind === 'crow' && d.flying ? d.y + 400 : d.y, draw: (ctx) => this.drawItem(ctx, d) }));
  }

  drawItem(ctx, d) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const R = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
    const t = this.time;
    switch (d.kind) {
      case 'prop': {
        const pr = Sprites.props[d.name];
        drawShadow(ctx, x, y, Math.max(6, pr.img.width * 0.4), 4, 0.3);
        drawProp(ctx, d.name, x, y, d.seed > 5);
        if (d.name === 'candelabra') for (const cx of [-7, -1, 5]) drawFlame(ctx, x + cx + 1, y - 27, t, cx + d.seed);
        if (d.name === 'goldPile' || d.name === 'chest') drawGlints(ctx, [[x - 6, y - 10], [x + 7, y - 6], [x, y - 14]], t + d.seed);
        if (d.name === 'cauldron') {
          drawGlow(ctx, x, y - 22, 26, '170, 90, 255', 0.22 + Math.sin(t * 4) * 0.06);
          for (let i = 0; i < 3; i++) {
            const s = (t * 0.9 + i / 3) % 1;
            ctx.fillStyle = `rgba(200, 140, 255, ${1 - s})`;
            ctx.fillRect(x - 6 + i * 5, Math.round(y - 24 - s * 14), 2, 2);
          }
        }
        break;
      }
      case 'deadTree':
        drawShadow(ctx, x, y + 2, 16, 5);
        R(-4, -40, 8, 42, OUTLINE); R(-3, -40, 6, 41, '#3b2416'); R(-3, -40, 2, 41, '#5b3922');
        // gnarled branches
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        const branch = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x + x1, y + y1); ctx.lineTo(x + x2, y + y2); ctx.stroke(); };
        ctx.lineCap = 'round';
        branch(0, -30, -16, -48); branch(0, -36, 14, -54); branch(-10, -42, -20, -44); branch(8, -46, 18, -48); branch(0, -40, 2, -60);
        ctx.strokeStyle = '#4a2e1c'; ctx.lineWidth = 2;
        branch(0, -30, -16, -48); branch(0, -36, 14, -54); branch(-10, -42, -20, -44); branch(8, -46, 18, -48); branch(0, -40, 2, -60);
        ctx.lineCap = 'butt';
        break;
      case 'lampPost': {
        drawShadow(ctx, x, y + 2, 9, 3);
        R(-2, -40, 5, 42, OUTLINE); R(-1, -40, 3, 41, '#383b48');
        R(-5, -2, 11, 4, OUTLINE); R(-4, -1, 9, 2, '#585d6c');
        R(-6, -52, 13, 14, OUTLINE); R(-5, -51, 11, 12, '#22212b');
        const flick = Math.round(Math.sin(t * 11 + d.seed) * 1.5);
        R(-3, -49 + Math.max(0, flick), 7, 9 - Math.max(0, flick), d.warm ? '#ffb02e' : '#4adf8a');
        R(-1, -46, 3, 5, d.warm ? '#fff2a0' : '#c8ffe0');
        R(-7, -54, 15, 3, '#383b48');
        break;
      }
      case 'candles':
        for (const [cx, cy, h] of [[-6, 2, 10], [1, -1, 14], [7, 3, 8]]) {
          R(cx - 2, cy - h, 4, h, OUTLINE); R(cx - 1, cy - h, 2, h - 1, '#e8e0c8');
          const fl = Math.sin(t * 13 + d.seed + cx) > 0 ? 1 : 0;
          R(cx - 1, cy - h - 4 - fl, 2, 3 + fl, '#ffb02e'); R(cx, cy - h - 3, 1, 2, '#fff2a0');
        }
        R(-8, 3, 17, 2, 'rgba(232, 224, 200, 0.5)');   // wax puddle
        break;
      case 'coffin':
        drawShadow(ctx, x, y + 2, 20, 5);
        ctx.fillStyle = OUTLINE;
        ctx.beginPath(); ctx.moveTo(x - 20, y - 6); ctx.lineTo(x - 12, y - 14); ctx.lineTo(x + 18, y - 12); ctx.lineTo(x + 22, y - 4); ctx.lineTo(x + 18, y + 4); ctx.lineTo(x - 12, y + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a2e1c';
        ctx.beginPath(); ctx.moveTo(x - 18, y - 6); ctx.lineTo(x - 11, y - 12); ctx.lineTo(x + 17, y - 10); ctx.lineTo(x + 20, y - 4); ctx.lineTo(x + 17, y + 2); ctx.lineTo(x - 11, y + 1); ctx.closePath(); ctx.fill();
        R(-4, -10, 2, 10, '#7d532f'); R(-8, -6, 10, 2, '#7d532f');   // cross on the lid
        break;
      case 'bonePile':
        R(-9, -3, 18, 5, '#b5ad96'); R(-7, -5, 6, 3, '#ebe5d3'); R(2, -6, 7, 3, '#ebe5d3');
        R(-3, -11, 8, 7, OUTLINE); R(-2, -10, 6, 6, '#ebe5d3'); R(-1, -8, 1, 2, OUTLINE); R(2, -8, 1, 2, OUTLINE);
        break;
      case 'urn':
        drawShadow(ctx, x, y + 2, 7, 2);
        R(-6, -14, 12, 15, OUTLINE); R(-5, -13, 10, 13, '#5a5868'); R(-5, -13, 3, 13, '#747288'); R(-3, -17, 6, 4, '#5a5868');
        break;
      case 'crow': {
        const flap = d.flying ? Math.sin(d.t * 30) : 0;
        const peck = !d.flying && Math.sin(t * 2 + d.seed * 3) > 0.92 ? 2 : 0;
        if (!d.flying) drawShadow(ctx, x, y + 1, 5, 2, 0.3);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(d.facing, 1);
        ctx.fillStyle = '#0a0810';
        ctx.fillRect(-5, -7, 9, 5);                    // body
        ctx.fillRect(2, -10 + peck, 4, 4);             // head
        ctx.fillStyle = '#c8a040';
        ctx.fillRect(6, -9 + peck, 2, 1);              // beak
        ctx.fillStyle = '#1e1a2a';
        ctx.fillRect(-4, -8 - Math.round(flap * 6), 6, 2);   // wing
        if (!d.flying) { ctx.fillStyle = '#3a3040'; ctx.fillRect(-1, -2, 1, 2); ctx.fillRect(1, -2, 1, 2); }
        ctx.restore();
        break;
      }
      case 'campfire': {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          R(Math.round(Math.cos(a) * 12) - 3, Math.round(Math.sin(a) * 6) - 2, 6, 4, i % 2 ? '#585d6c' : '#747288');
        }
        R(-10, -3, 20, 3, '#5b3922'); R(-8, -5, 16, 3, '#7d532f');
        for (let i = 0; i < 4; i++) {
          const h = 10 + Math.sin(t * 10 + i * 1.7) * 4;
          R(-6 + i * 3, -5 - h, 4, h, i % 2 ? '#ff5a1e' : '#ffb02e');
        }
        R(-2, -10, 4, 5, '#fff2a0');
        break;
      }
      case 'signpost':
        R(-2, -30, 4, 32, '#5b3922');
        R(-22, -38, 44, 14, OUTLINE); R(-21, -37, 42, 12, '#7d532f'); R(-21, -37, 42, 2, '#9c6c3e');
        HUD.text(ctx, d.text, x, y - 35, { size: 6, align: 'center', color: '#f4ead7' });
        break;
      case 'barrel':
      case 'crate':
        drawShadow(ctx, x, y + 2, 10, 3);
        drawProp(ctx, d.kind, x, y + 2);
        break;
      case 'shelf':
        R(-40, -44, 80, 46, OUTLINE); R(-39, -43, 78, 44, '#5b3922');
        for (const sy of [-30, -14]) R(-39, sy, 78, 3, '#7d532f');
        // jars and bottles
        const colors = ['#e84a4a', '#4a8aff', '#6cff7a', '#ffd34a', '#b67aff'];
        for (let i = 0; i < 6; i++) {
          const c = colors[(i + Math.floor(d.seed)) % colors.length];
          R(-34 + i * 12, -40, 6, 9, c); R(-34 + i * 12, -40, 2, 9, 'rgba(255,255,255,0.4)');
          R(-33 + i * 12, -24, 7, 9, colors[(i * 2 + 1) % colors.length]);
        }
        break;
    }
  }

  drawRug(ctx, d) {
    const x = Math.round(d.x - d.w / 2);
    const y = Math.round(d.y - d.h / 2);
    ctx.fillStyle = '#5a1a2a';
    ctx.fillRect(x, y, d.w, d.h);
    ctx.fillStyle = '#7c1f3a';
    ctx.fillRect(x + 4, y + 4, d.w - 8, d.h - 8);
    ctx.fillStyle = '#dcb44c';
    ctx.fillRect(x + 8, y + 8, d.w - 16, 2);
    ctx.fillRect(x + 8, y + d.h - 10, d.w - 16, 2);
    for (let i = 16; i < d.w - 16; i += 24) ctx.fillRect(x + i, y + d.h / 2 - 2, 4, 4);
  }
}
