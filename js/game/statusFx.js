// Screen-edge warnings for this screen's hero, so you can feel what's wrong without reading the
// HUD: a blood-red border pulsing with a heartbeat while under 25% health, and a border of its
// own for each ailment - flames licking up the edges while burning, molten rock welling up and
// oozing down while melting in lava, ice crystals creeping in from
// the corners while frozen (a lighter frost while chilled), green ooze dripping while poisoned,
// stars wheeling round the edge while stunned - plus a giant STUNNED / FROZEN word while you
// can't act. Looks and sound only; drawn over the world, under the HUD.

const LOW_HP = 0.25;   // the share of max health that starts the warning
// molten rock for the melting border, crust to white-hot (the fortress lava's reds)
const MELT_COLORS = ['#2a0604', '#6a0c08', '#a8100e', '#d81e14', '#ff4a2a', '#ff9a80'];

const StatusFx = {
  levels: { low: 0, burn: 0, melt: 0, frozen: 0, poison: 0, stun: 0 },   // each border's strength, fading in and out
  lv: {},           // the levels as drawn: scaled by the Screen borders setting
  last: null,        // the game time last drawn (borders and the heartbeat follow game time, so pausing stops them)
  beat: 0,           // seconds to the next heartbeat
  pulse: 0,          // 1 on a heartbeat, fading
  word: null,        // the big word: { text, colors, t (s shown), out (s fading) }
  borders: null,     // pre-drawn borders for this screen size: { key, low, burn, melt, frozen, poison, stun }

  draw(ctx, game) {
    const p = game.localPlayer;
    const dt = this.last === null ? 0 : clamp(game.time - this.last, 0, 0.1);
    this.last = game.time;
    const alive = p && !p.dead && !game.cutscene;
    const k = alive ? clamp(p.hp / p.maxHp, 0, 1) : 1;
    const low = alive && k < LOW_HP;
    const frozen = alive && p.frozenTime > 0;
    const stunned = alive && p.stunTime > 0 && !frozen;
    const target = {
      low: low ? 0.7 + 0.3 * (1 - k / LOW_HP) : 0,
      burn: alive && p.ailments?.burn ? 1 : 0,
      melt: alive && p.ailments?.lava ? 1 : 0,
      frozen: frozen ? 1 : alive && p.chillTime > 0 ? 0.45 : 0,
      poison: alive && p.poisonTime > 0 ? 1 : 0,
      stun: stunned ? 1 : 0,
    };
    for (const id of Object.keys(this.levels)) {
      const v = this.levels[id];
      const t = target[id];
      this.levels[id] = t > v ? Math.min(t, v + dt * 6) : Math.max(t, v - dt * 2.5);   // in fast, out slower
    }

    // the heartbeat: quicker the lower you are
    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    if (low) {
      this.beat -= dt;
      if (this.beat <= 0) {
        Sound.play('heartbeat');
        this.pulse = 1;
        this.beat = 1.05 - 0.4 * (1 - k / LOW_HP);
      }
    } else this.beat = 0;   // the first beat comes the moment you drop under

    // the big word: punches in when you're stunned or frozen, fades once you can move again
    const text = frozen ? 'FROZEN' : stunned ? 'STUNNED' : null;
    if (text) {
      if (this.word?.text !== text || this.word.out > 0) {
        this.word = { text, t: 0, out: 0, colors: frozen ? ['#9ad0ff', '#e6f6ff', '#1e3a6a'] : ['#ff3a2a', '#ff9a7a', '#4a0606'] };
      }
      this.word.t += dt;
    } else if (this.word) {
      this.word.out += dt;
      if (this.word.out > 0.3) this.word = null;
    }

    const { width: w, height: h } = CONFIG.screen;
    // the Screen borders setting scales every border (the big word and the heartbeat stay)
    const fx = Settings.data.borderFx ?? 1;
    this.lv = {};
    for (const [id, v] of Object.entries(this.levels)) this.lv[id] = v * fx;
    if (!Object.values(this.lv).some((v) => v > 0) && !this.word) return;
    if (this.borders?.key !== `${w}x${h}`) this.borders = this.build(w, h);
    const b = this.borders;
    const t = game.time;
    ctx.save();
    const lv = this.lv;
    if (lv.poison > 0) {
      ctx.globalAlpha = lv.poison;
      ctx.drawImage(b.poison, 0, 0, w, h);
      this.drawBubbles(ctx, w, h, t);
    }
    if (lv.frozen > 0) {
      ctx.globalAlpha = lv.frozen;
      ctx.drawImage(b.frozen, 0, 0, w, h);
    }
    if (lv.burn > 0) {
      ctx.globalAlpha = lv.burn * (0.85 + 0.15 * Math.sin(t * 11));
      ctx.drawImage(b.burn, 0, 0, w, h);
      ctx.globalAlpha = lv.burn;
      this.drawFlames(ctx, w, h, t);
    }
    if (lv.melt > 0) {
      ctx.globalAlpha = lv.melt;
      ctx.drawImage(b.melt, 0, 0, w, h);
      this.drawLava(ctx, w, h, t);
    }
    if (lv.stun > 0) {
      ctx.globalAlpha = lv.stun;
      ctx.drawImage(b.stun, 0, 0, w, h);
      this.drawStars(ctx, w, h, t);
    }
    if (lv.low > 0) {
      ctx.globalAlpha = lv.low * (0.8 + 0.2 * this.pulse);
      ctx.drawImage(b.low, 0, 0, w, h);
    }
    ctx.restore();
    if (this.word) this.drawWord(ctx, w, h);
  },

  // ---------- the live parts ----------

  /** Flame tongues standing along the bottom and up the lower sides. */
  drawFlames(ctx, w, h, t) {
    for (const f of this.borders.flames) {
      const x = f.side === 0 ? f.u * w : f.side < 0 ? f.d : w - f.d;
      const y = f.side === 0 ? h + 4 : h * (0.55 + f.u * 0.45);
      const flick = 0.75 + 0.25 * Math.sin(t * 7 + f.seed * 9);
      PFX.flame(ctx, x, y, f.w, f.h * flick, t + f.seed, ENEMY_FIRE_COLORS, 4);
    }
  },

  /**
   * Melting in lava: a molten pool welling and sloshing along the bottom (crust rafts drifting on it,
   * bubbles swelling and bursting), and thick drips oozing down from the top until a drop falls off.
   */
  drawLava(ctx, w, h, t) {
    const L = MELT_COLORS;
    const surface = (x) => h - 52 - Math.sin(x * 0.018 + t * 1.1) * 6 - Math.sin(x * 0.047 - t * 0.7) * 4;
    for (let x = 0; x < w; x += 4) {
      const y = Math.round(surface(x));
      ctx.fillStyle = L[0];
      ctx.fillRect(x, y - 2, 4, h - y + 2);
      ctx.fillStyle = L[1];
      ctx.fillRect(x, y, 4, h - y);
      // slow bright swirls in the body, a hot band under the skin, the glowing skin itself
      if (Math.sin(x * 0.06 + t * 0.6) + Math.sin(x * 0.021 - t * 0.4) > 0.9) {
        ctx.fillStyle = L[2];
        ctx.fillRect(x, y + 12, 4, h - y - 12);
      }
      ctx.fillStyle = L[3];
      ctx.fillRect(x, y + 2, 4, 6);
      ctx.fillStyle = L[4];
      ctx.fillRect(x, y, 4, 2);
    }
    // rafts of dark crust riding the surface
    for (let i = 0; i < 6; i++) {
      const x = ((i * 0.173 + t * 0.012 * (i % 2 ? 1 : -1)) % 1 + 1) % 1 * w;
      const y = surface(x);
      const len = 14 + (i % 3) * 8;
      ctx.fillStyle = L[0];
      ctx.fillRect(Math.round(x - len / 2), Math.round(y) - 1, len, 4);
      ctx.fillStyle = '#4a2218';
      ctx.fillRect(Math.round(x - len / 2) + 2, Math.round(y) - 1, len - 6, 1);
    }
    // bubbles swelling on the surface and bursting
    for (let i = 0; i < 8; i++) {
      const cycle = t / (1.3 + (i % 3) * 0.4) + i * 0.29;
      const u = cycle % 1;
      const x = ((Math.floor(cycle) * 0.618 + i * 0.137) % 1) * w;
      const y = surface(x) + 1;
      if (u < 0.8) {
        const r = Math.round(1 + (u / 0.8) * 6);
        ctx.fillStyle = L[0];
        ctx.fillRect(Math.round(x - r) - 1, Math.round(y - r * 1.4) - 1, r * 2 + 2, Math.round(r * 1.4) + 2);
        ctx.fillStyle = L[3];
        ctx.fillRect(Math.round(x - r), Math.round(y - r * 1.4), r * 2, Math.round(r * 1.4));
        ctx.fillStyle = L[5];
        ctx.fillRect(Math.round(x - r * 0.5), Math.round(y - r * 1.2), 2, 2);
      } else {
        // burst: spatters flung up and falling back
        const k = (u - 0.8) / 0.2;
        ctx.fillStyle = L[4];
        for (const dx of [-1, -0.4, 0.4, 1]) {
          ctx.fillRect(Math.round(x + dx * 10 * k), Math.round(y - 14 * Math.sin(k * Math.PI) * (1.2 - Math.abs(dx) * 0.5)), 3, 3);
        }
      }
    }
    // drips oozing down from the top edge, swelling at the tip until a drop lets go
    for (let i = 0; i < 12; i++) {
      const period = 2.6 + (i % 4) * 0.7;
      const u = (t / period + i * 0.31) % 1;
      const x = Math.round(((i * 0.0833 + 0.04 + Math.sin(i * 7.3) * 0.03) * w) / 2) * 2;
      const max = 18 + (i % 5) * 8;
      const len = u < 0.75 ? (u / 0.75) * max : max * (1 - (u - 0.75) * 2);
      const wid = 8 + (i % 3) * 2;
      ctx.fillStyle = L[0];
      ctx.fillRect(x - wid / 2 - 1, 0, wid + 2, len + 1);
      ctx.fillStyle = L[3];
      ctx.fillRect(x - wid / 2, 0, wid, len);
      ctx.fillStyle = L[4];
      ctx.fillRect(x - wid / 2 + 1, 0, 2, len);
      const tip = u < 0.75 ? 1 + (u / 0.75) * 3 : 1;
      ctx.fillStyle = L[0];
      ctx.fillRect(x - wid / 2 - tip - 1, len - 1, wid + tip * 2 + 2, wid + 2);
      ctx.fillStyle = L[3];
      ctx.fillRect(x - wid / 2 - tip, len, wid + tip * 2, wid);
      ctx.fillStyle = L[5];
      ctx.fillRect(x - wid / 2 - tip + 1, len + 1, 2, 2);
      if (u >= 0.75) {
        // the drop that fell, speeding up
        const k = (u - 0.75) / 0.25;
        const dy = max + 6 + k * k * 260;
        ctx.fillStyle = L[0];
        ctx.fillRect(x - 5, Math.round(dy) - 1, 10, 11);
        ctx.fillStyle = L[3];
        ctx.fillRect(x - 4, Math.round(dy), 8, 9);
        ctx.fillStyle = L[5];
        ctx.fillRect(x - 3, Math.round(dy) + 1, 2, 2);
      }
    }
  },

  /** Poison bubbles rising off the bottom edge and popping. */
  drawBubbles(ctx, w, h, t) {
    for (let i = 0; i < 18; i++) {
      const life = (t * 0.6 + i * 0.37) % 1;   // 0..1, each bubble on its own loop
      const lap = Math.floor(t * 0.6 + i * 0.37);
      const x = ((i * 97 + lap * 211) % 1000) / 1000 * w;
      const y = h - 6 - life * 70;
      const r = 2 + (i % 3) + life * 2;
      ctx.globalAlpha = this.lv.poison * (1 - life);
      ctx.fillStyle = '#2a5a14';
      ctx.fillRect(Math.round(x - r) - 1, Math.round(y - r) - 1, r * 2 + 2, r * 2 + 2);
      ctx.fillStyle = '#7ad84a';
      ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
      ctx.fillStyle = '#d8ffb0';
      ctx.fillRect(Math.round(x - r) + 1, Math.round(y - r) + 1, 2, 2);
    }
    ctx.globalAlpha = this.lv.poison;
  },

  /** Stars wheeling slowly round the edge of the screen. */
  drawStars(ctx, w, h, t) {
    const n = 18;
    const per = 2 * (w + h);
    for (let i = 0; i < n; i++) {
      let d = ((i / n) + t * 0.03) % 1 * per;   // distance round the edge, clockwise from the top left
      const inset = 16 + (i % 3) * 8;
      let x, y;
      if (d < w) { x = d; y = inset; }
      else if ((d -= w) < h) { x = w - inset; y = d; }
      else if ((d -= h) < w) { x = w - d; y = h - inset; }
      else { x = inset; y = h - (d - w); }
      PFX.star5(ctx, x, y, 5 + (i % 3) * 2 + Math.sin(t * 6 + i) * 1.2, t * 2 + i, i % 2 ? '#ffe14a' : '#fff2a0');
    }
  },

  /** STUNNED / FROZEN across the upper middle of the screen: slanted, thick outline, punching in. */
  drawWord(ctx, w, h) {
    const wd = this.word;
    const punch = wd.t < 0.18 ? 1 + 0.6 * (1 - wd.t / 0.18) ** 2 : 1;
    const shake = wd.t < 0.3 ? (1 - wd.t / 0.3) * 3 : 0;
    const [fill, light, dark] = wd.colors;
    ctx.save();
    ctx.globalAlpha = wd.out > 0 ? 1 - wd.out / 0.3 : Math.min(1, wd.t / 0.08);
    ctx.translate(w / 2 + (nativeRandom() - 0.5) * shake, h * 0.3 + (nativeRandom() - 0.5) * shake);
    ctx.transform(1, 0, -0.22, 1, 0, 0);   // leaning forward
    ctx.scale(punch, punch);
    ctx.font = uiFont(32);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // a deep drop shadow, a thick dark outline, then the word with a light top half
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(wd.text, 5, 6);
    ctx.fillStyle = dark;
    for (let ox = -3; ox <= 3; ox += 3) for (let oy = -3; oy <= 3; oy += 3) if (ox || oy) ctx.fillText(wd.text, ox, oy);
    ctx.fillStyle = OUTLINE;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (ox || oy) ctx.fillText(wd.text, ox * 2, oy * 2);
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, light);
    g.addColorStop(0.45, fill);
    g.addColorStop(1, fill);
    ctx.fillStyle = g;
    ctx.fillText(wd.text, 0, 0);
    ctx.restore();
  },

  // ---------- the borders, drawn once per screen size ----------

  build(w, h) {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const canvas = (draw) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'));
      return c;
    };
    // a soft glow in from every edge, strongest in the corners
    const edge = (g, rgb, a, inner = 0.72) => {
      g.save();
      g.setTransform(w / 2, 0, 0, h / 2, w / 2, h / 2);
      const gr = g.createRadialGradient(0, 0, inner, 0, 0, 1.42);
      gr.addColorStop(0, `rgba(${rgb}, 0)`);
      gr.addColorStop(0.45, `rgba(${rgb}, ${a * 0.3})`);
      gr.addColorStop(1, `rgba(${rgb}, ${a})`);
      g.fillStyle = gr;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    };
    // a firmer band of colour depth px in along every edge, fading inward
    const band = (g, rgb, a, depth) => {
      const side = (x0, y0, x1, y1, rx, ry, rw, rh) => {
        const gr = g.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, `rgba(${rgb}, ${a})`);
        gr.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = gr;
        g.fillRect(rx, ry, rw, rh);
      };
      side(0, 0, 0, depth, 0, 0, w, depth);
      side(0, h, 0, h - depth, 0, h - depth, w, depth);
      side(0, 0, depth, 0, 0, 0, depth, h);
      side(w, 0, w - depth, 0, w - depth, 0, depth, h);
    };
    const rim = (g, color, width) => {
      g.fillStyle = color;
      g.fillRect(0, 0, w, width); g.fillRect(0, h - width, w, width);
      g.fillRect(0, 0, width, h); g.fillRect(w - width, 0, width, h);
    };
    // a random spot near an edge: depth px in at most (mostly closer)
    const nearEdge = (depth) => {
      const along = rng();
      const inset = rng() ** 2 * depth;
      const side = rng() * 2 * (w + h);
      if (side < w) return { x: along * w, y: inset, d: inset };
      if (side < 2 * w) return { x: along * w, y: h - inset, d: inset };
      if (side < 2 * w + h) return { x: inset, y: along * h, d: inset };
      return { x: w - inset, y: along * h, d: inset };
    };
    const blob = (g, x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

    const low = canvas((g) => {
      edge(g, '150, 0, 8', 0.85, 0.66);
      band(g, '170, 0, 10', 0.45, 48);
      // blood spattered in round the edges
      for (let i = 0; i < 90; i++) {
        const s = nearEdge(46);
        const r = (4 + rng() * 22) * (1 - s.d / 70);
        blob(g, s.x, s.y, r, 'rgba(100, 0, 8, 0.6)');
        blob(g, s.x - r * 0.15, s.y - r * 0.15, r * 0.6, 'rgba(170, 12, 20, 0.45)');
        for (let j = 0; j < 3; j++) blob(g, s.x + (rng() - 0.5) * r * 4, s.y + (rng() - 0.5) * r * 4, 1 + rng() * 3, 'rgba(130, 0, 10, 0.55)');
      }
      // runs dripping down from the top
      for (let i = 0; i < 16; i++) {
        const x = rng() * w;
        const len = 14 + rng() * 50;
        g.fillStyle = 'rgba(110, 0, 8, 0.75)';
        g.fillRect(Math.round(x - 1.5), 0, 3, len);
        blob(g, x, len, 3, 'rgba(110, 0, 8, 0.8)');
      }
      rim(g, 'rgba(60, 0, 4, 0.6)', 4);
    });

    const burn = canvas((g) => {
      edge(g, '255, 60, 20', 0.8, 0.64);
      const gr = g.createLinearGradient(0, h, 0, h * 0.65);   // the heat rising off the bottom
      gr.addColorStop(0, 'rgba(255, 70, 24, 0.55)');
      gr.addColorStop(1, 'rgba(255, 70, 24, 0)');
      g.fillStyle = gr;
      g.fillRect(0, h * 0.65, w, h * 0.35);
      // embers and ash scattered round the edges
      for (let i = 0; i < 60; i++) {
        const s = nearEdge(60);
        g.fillStyle = rng() < 0.5 ? 'rgba(255, 106, 74, 0.8)' : 'rgba(40, 8, 6, 0.5)';
        g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }
      rim(g, 'rgba(120, 10, 6, 0.5)', 3);
    });

    // melting: a deep heat glow, the edges charred to a black crust split by glowing cracks
    const melt = canvas((g) => {
      edge(g, '200, 30, 12', 0.8, 0.62);
      rim(g, 'rgba(26, 6, 4, 0.85)', 7);
      band(g, '26, 6, 4', 0.5, 20);
      for (let i = 0; i < 40; i++) {
        let s = nearEdge(8);
        g.beginPath();
        g.moveTo(s.x, s.y);
        for (let j = 0; j < 3; j++) {
          s = { x: s.x + (rng() - 0.5) * 12, y: s.y + (rng() - 0.5) * 12 };
          g.lineTo(clamp(s.x, 0, w), clamp(s.y, 0, h));
        }
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(168, 16, 14, 0.7)';
        g.stroke();
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(255, 74, 42, 0.85)';
        g.stroke();
      }
    });

    const frozen = canvas((g) => {
      edge(g, '150, 205, 255', 0.8, 0.64);
      rim(g, 'rgba(230, 246, 255, 0.55)', 3);
      const shard = (x, y, angle, len, wid) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const pt = (a, b) => [x + c * a - s * b, y + s * a + c * b];
        const pts = [pt(-len * 0.15, 0), pt(len * 0.3, -wid), pt(len, 0), pt(len * 0.3, wid)];
        g.beginPath();
        for (const [px, py] of pts) g.lineTo(px, py);
        g.closePath();
        g.fillStyle = 'rgba(214, 240, 255, 0.95)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(30, 58, 106, 0.95)';
        g.stroke();
        g.beginPath();   // a lit ridge down its middle
        g.moveTo(...pt(0, 0));
        g.lineTo(...pt(len * 0.85, 0));
        g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        g.lineWidth = 1;
        g.stroke();
      };
      // clusters of crystals growing in from each corner
      for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const toward = Math.atan2(h / 2 - cy, w / 2 - cx);
        for (let i = 0; i < 10; i++) shard(cx, cy, toward + (rng() - 0.5) * 1.5, 50 + rng() * 110, 6 + rng() * 8);
      }
      // smaller ones along the edges, pointing in
      for (let i = 0; i < 36; i++) {
        const s = nearEdge(4);
        const toward = s.y <= 4 ? Math.PI / 2 : s.y >= h - 4 ? -Math.PI / 2 : s.x <= 4 ? 0 : Math.PI;
        shard(s.x, s.y, toward + (rng() - 0.5) * 0.9, 16 + rng() * 40, 4 + rng() * 5);
      }
      // frost speckle
      for (let i = 0; i < 160; i++) {
        const s = nearEdge(70);
        g.fillStyle = 'rgba(255, 255, 255, 0.75)';
        g.fillRect(Math.round(s.x), Math.round(s.y), rng() < 0.3 ? 2 : 1, rng() < 0.3 ? 2 : 1);
      }
    });

    const poison = canvas((g) => {
      edge(g, '60, 190, 40', 0.75, 0.64);
      // ooze along the top, sagging into drips
      const top = (x) => 7 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13 + 1) * 2;
      g.fillStyle = 'rgba(42, 90, 20, 0.85)';
      g.beginPath();
      g.moveTo(0, 0);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, top(x) + 2);
      g.lineTo(w, 0);
      g.fill();
      g.fillStyle = 'rgba(110, 200, 60, 0.85)';
      g.beginPath();
      g.moveTo(0, 0);
      for (let x = 0; x <= w; x += 6) g.lineTo(x, top(x));
      g.lineTo(w, 0);
      g.fill();
      for (let i = 0; i < 22; i++) {
        const x = rng() * w;
        const len = 10 + rng() * 46;
        const r = 2.5 + rng() * 2.5;
        g.fillStyle = 'rgba(42, 90, 20, 0.85)';
        g.fillRect(x - r - 1, 0, r * 2 + 2, len);
        blob(g, x, len, r + 2, 'rgba(42, 90, 20, 0.85)');
        g.fillStyle = 'rgba(110, 200, 60, 0.9)';
        g.fillRect(x - r, 0, r * 2, len);
        blob(g, x, len, r + 1, 'rgba(110, 200, 60, 0.9)');
        g.fillStyle = 'rgba(216, 255, 176, 0.9)';
        g.fillRect(Math.round(x - r + 1), Math.round(len - r), 2, 2);
      }
      // green blotches round the other edges
      for (let i = 0; i < 50; i++) {
        const s = nearEdge(36);
        blob(g, s.x, s.y, (3 + rng() * 12) * (1 - s.d / 50), 'rgba(80, 170, 40, 0.35)');
      }
      rim(g, 'rgba(30, 70, 14, 0.55)', 3);
    });

    const stun = canvas((g) => {
      edge(g, '255, 220, 70', 0.55, 0.7);
      band(g, '255, 220, 70', 0.25, 26);
      rim(g, 'rgba(255, 230, 128, 0.4)', 3);
    });

    // the flame tongues' spots (drawn live): along the bottom, and up the lower sides
    const flames = [];
    for (let i = 0; i < 18; i++) flames.push({ side: 0, u: (i + rng() * 0.6) / 18, w: 26 + rng() * 18, h: 60 + rng() * 60, seed: rng() * 10 });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) flames.push({ side, u: (i + rng() * 0.5) / 5, d: 6 + rng() * 12, w: 20 + rng() * 14, h: 40 + rng() * 40, seed: rng() * 10 });
    }

    return { key: `${w}x${h}`, low, burn, melt, frozen, poison, stun, flames };
  },
};
