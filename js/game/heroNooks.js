// The hall of heroes (the keep's south wing, in the spirit of Soul Knight's hero
// select): every hero lives in a nook of their own, busy with their own thing,
// and you pick one by walking up and pressing E. The knight sharpens his
// greatblade at the grindstone, the archer looses arrows into a straw butt, the
// mage studies a spellbook floating in front of her, the priestess kneels in
// prayer at a little shrine, the rogue juggles a dagger beside his loot, the bard
// plays the lute on a stool, the baker bakes and carries pastries to her table,
// and the rocketeer welds a new rocket at his bench (and it sometimes sputters).
// Heroes someone is playing are out of their nook (they're walking the keep).
// All of it is visual only (driven by time), never part of the shared simulation.

// Where each hero stands in the hall (tile coordinates of their feet), the solid
// props of their nook as [prop, dx, dy, flip] in tiles from the hero, the colours of
// the rug under the nook [edge, body, trim, pattern] (baked into the floor, see
// CastleKeep.drawRugs) and, along the north wall, the tapestry hung above it [dark, body, trim].
const HERO_NOOKS = {
  warrior: {
    at: [7.5, 35.6],
    props: [['weaponRack', -1.15, -0.75], ['grindstone', 0.82, 0.1], ['bannerRed', -2.6, -0.6], ['pell', 2.3, -0.6], ['chest', -2.2, 0.75], ['barrel', 2.6, 0.75]],
    rug: ['#3e0f16', '#7c1f2a', '#dcb44c', '#a63036'], tapestry: ['#5a1a22', '#87262a', '#d4ac4c'],
  },
  mage: {
    at: [14.5, 35.6],
    props: [['bookshelf', -1.2, -0.85], ['candelabra', 1.6, -0.5], ['bookStack', -2.3, 0.45], ['scrollRack', -2.5, -0.85], ['cauldron', 2.5, 0.65], ['globe', 2.6, -0.6]],
    rug: ['#1e1430', '#4a2a6a', '#d4ac4c', '#6a3a8a'], tapestry: ['#2a1640', '#4a2a6a', '#c88aff'],
  },
  priestess: {
    at: [28.5, 35.6],
    props: [['pedestal', 0.95, 0.15], ['flowers', 0.2, 0.55], ['flowers', 1.75, 0.55, true], ['candelabra', 2.3, -0.4], ['bannerBlue', -1.4, -0.6],
      ['bench', 0.9, 1.45], ['plant', -2.4, -0.4], ['bookStack', -1.1, 0.75]],
    rug: ['#2a3450', '#3e5a96', '#efe6d2', '#5a7ab6'], tapestry: ['#c8c0cc', '#efe6d2', '#d4ac4c'],
  },
  ranger: {
    at: [34.2, 35.6],
    props: [['targetClean', 4.5, 0.05], ['barrel', -0.95, -0.6], ['hayBale', 4.5, -1.0], ['weaponRack', -2.2, -0.8], ['target', 3.2, -0.95], ['sacks', -1.9, 0.8], ['plant', 2.0, -0.75]],
    rug: ['#1a2e1e', '#2e4a30', '#d4ac4c', '#4e6e44'], tapestry: ['#1a3020', '#2e5a36', '#d4ac4c'], rugTo: 5.2,
  },
  rogue: {
    at: [7.5, 42.6],
    props: [['chest', -1.2, -0.1], ['goldPile', 1.0, 0.25], ['crate', -2.4, -0.4], ['barrel', 1.9, -0.6],
      ['sacks', -2.2, 1.3], ['goldPile', -0.6, 1.9], ['chest', 1.6, 1.9, true], ['candelabra', 2.8, 1.2], ['crate', -3.0, 2.2]],
    rug: ['#14141c', '#2c2c3a', '#c43a44', '#3e3e52'],
  },
  bard: {
    at: [14.5, 42.6],
    props: [['plant', 1.7, -0.4], ['plant', -1.6, -0.4], ['bench', 0, 2.2], ['flowers', -1.1, 0.8], ['flowers', 1.1, 0.8, true],
      ['barrel', 2.6, 1.2], ['stool', 2.0, 2.0], ['candelabra', -2.4, 1.2]],
    rug: ['#3a1a10', '#8a3a2a', '#ffd34a', '#b0583a'],
  },
  baker: {
    at: [28.5, 42.6],
    props: [['table', -1.95, 0.15], ['sacks', 2.4, -0.55], ['table', 0.6, 2.2], ['stewPot', -1.2, 2.1], ['barrel', 3.0, 1.3], ['sacks', -3.0, 1.4]],
    rug: ['#5a2a3a', '#c87a90', '#ffffff', '#e8a8b8'],
  },
  rocketeer: {
    at: [35.5, 42.6],
    props: [['workbench', 1.1, 0.15], ['crate', -2.0, -0.5], ['crate', -2.8, -0.3], ['bannerGreen', 2.7, -0.75],
      ['barrel', 2.6, 1.5], ['crate', 1.2, 2.0], ['anvil', -1.3, 1.5], ['sacks', -2.6, 1.9]],
    rug: ['#2a2a1a', '#4a4a2a', '#ff9a3a', '#6a6a3a'],
  },
};

const HeroNooks = {
  /** Every nook prop as lobby decor: { name, x, y, flip } in pixels. */
  decor(T) {
    const out = [];
    for (const n of Object.values(HERO_NOOKS)) {
      for (const [name, dx, dy, flip] of n.props) out.push({ name, x: (n.at[0] + dx) * T, y: (n.at[1] + dy) * T, flip: !!flip });
    }
    return out;
  },

  /** Solid things in the nooks that aren't props (the baker's oven, the rocketeer's rocket stand). */
  solids(T) {
    const b = HERO_NOOKS.baker.at;
    const r = HERO_NOOKS.rocketeer.at;
    return [
      { x: (b[0] * T) + 30 - 22, y: b[1] * T - 10, w: 44, h: 12 },
      { x: (r[0] * T) - 35, y: r[1] * T - 30, w: 24, h: 6 },
    ];
  },

  /** Pieces (y-sorted with everything else) for hero `id` at (x, y). away: someone is playing them. */
  drawables(id, x, y, t, away) {
    const fn = this[id];
    return fn ? fn.call(this, Math.round(x), Math.round(y), t, away) : [];
  },

  /** Warm lights the nooks give off at night (see LobbyHub.lights). */
  lights(T, t) {
    const at = (id, dx, dy) => ({ x: HERO_NOOKS[id].at[0] * T + dx, y: HERO_NOOKS[id].at[1] * T + dy });
    return [
      { ...at('baker', 30, -18), r: 90 + Math.sin(t * 9) * 4, s: 0.85, rgb: '255, 170, 80' },
      { ...at('mage', 24, -27), r: 70, s: 0.7, rgb: '150, 200, 255' },
      { ...at('priestess', 30, -30), r: 80, s: 0.8, rgb: '255, 236, 160' },
      { ...at('rocketeer', 28, -22), r: 60, s: 0.6, rgb: '140, 210, 255' },
    ];
  },

  // ---------- shared pieces ----------

  /** The hero themself: a shadow and their frame. o: flip, anim ('idle' | 'walk' | 'sit'), lift. */
  hero(id, x, y, t, o = {}) {
    const frames = Sprites.heroes[id];
    const anim = o.anim || 'idle';
    const list = frames[anim];
    const fps = anim === 'walk' ? CUTE.fps.walk : anim === 'sit' ? 1.2 : CUTE.fps.idle;
    const f = list[Math.floor((t + x * 0.013) * fps) % list.length];
    drawShadow(this.ctx, x, y + 9, 13, 5);
    drawSprite(this.ctx, f.img, x, y - (o.lift || 0), HERO_ANCHOR.x, HERO_ANCHOR.y, !!o.flip);
  },

  /** A weapon in a hero's hand at (hx, hy), turned to `angle` (facing left mirrors it). */
  held(name, hx, hy, angle, flip = false) {
    const w = Sprites.weapons[name];
    drawRotated(this.ctx, w.img, hx, hy, w.pivotX, w.pivotY, flip ? Math.PI - angle : angle, flip);
  },

  /** Wraps a draw function so the shared helpers above draw onto ctx. */
  piece(y, fn) {
    return { y, draw: (ctx) => { this.ctx = ctx; fn(ctx); } };
  },

  /** Sparks spraying from (x, y): n of them, `dir` the spray's mean angle, `seed` picks the spray. */
  sparks(ctx, x, y, t, n, dir, spread, len, colors = ['#ffffff', '#ffd34a']) {
    for (let i = 0; i < n; i++) {
      const k = (t * 3 + i * 0.37) % 1;
      const a = dir + Math.sin(i * 4.1 + Math.floor(t * 9)) * spread;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(Math.round(x + Math.cos(a) * k * len), Math.round(y + Math.sin(a) * k * len + k * k * 10), 1, 1);
    }
  },

  /** A music note (or two joined) at (x, y). */
  note(ctx, x, y, color, double) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, 5, 4);
    ctx.fillRect(x + 2, y - 8, 3, 9);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, 2);
    ctx.fillRect(x + 3, y - 7, 1, 8);
    ctx.fillRect(x + 3, y - 7, 3, 1);
    if (double) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 5, y - 2, 5, 4);
      ctx.fillRect(x + 8, y - 8, 3, 7);
      ctx.fillStyle = color;
      ctx.fillRect(x + 6, y - 1, 3, 2);
      ctx.fillRect(x + 9, y - 7, 1, 7);
      ctx.fillRect(x + 4, y - 7, 6, 1);
    }
  },

  /** An arrow flying or stuck, its tip at (x, y), pointing along `angle`. */
  arrow(ctx, x, y, angle, len = 14) {
    const bx = x - Math.cos(angle) * len;
    const by = y - Math.sin(angle) * len;
    ctx.strokeStyle = '#8c5e36';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(bx) + 0.5, Math.round(by) + 0.5);
    ctx.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 3, 2);
    ctx.fillRect(Math.round(bx) - 1, Math.round(by) + 1, 3, 2);
    ctx.fillStyle = '#adb2c0';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  },

  // ---------- the nooks ----------

  /** The knight sharpens his greatblade on the grindstone, then holds it up to admire the edge. */
  warrior(x, y, t, away) {
    const gx = x + 26;              // the grindstone's wheel
    const gy = y + 3 - 15;
    const c = (t + 1.3) % 6;
    const grinding = !away && c < 3.8;
    return [
      this.piece(y + 4, (ctx) => {
        // the wheel turning: a spoke going round, fast while it's grinding
        const a = grinding ? t * 14 : t * 2;
        ctx.fillStyle = '#585d6c';
        ctx.fillRect(Math.round(gx + Math.cos(a) * 6) - 1, Math.round(gy + Math.sin(a) * 6) - 1, 2, 2);
        if (grinding) this.sparks(ctx, gx - 4, gy - 7, t, 9, -2.2, 0.7, 20);
      }),
      ...(away ? [] : [this.piece(y, (ctx) => {
        this.hero('warrior', x, y, t);
        if (grinding) this.held('greatblade', x + 9 + Math.round(Math.sin(t * 9) * 2), y - 8, -0.32);
        else {
          this.held('greatblade', x + 8, y - 11, -1.05);
          // a glint running up the edge
          const k = ((c - 3.8) / 2.2) * 1.4;
          if (k < 1) {
            const d = 12 + k * 38;
            const px = Math.round(x + 8 + Math.cos(-1.05) * d);
            const py = Math.round(y - 11 + Math.sin(-1.05) * d);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px, py - 2, 1, 5);
            ctx.fillRect(px - 2, py, 5, 1);
          }
        }
      })]),
    ];
  },

  /**
   * The archer draws, holds and looses at the straw butt across her nook; arrows thud in
   * and stay (up to four) until she goes to fetch them... well, until they vanish.
   */
  ranger(x, y, t, away) {
    const T = CONFIG.tileSize;
    const tx = x + 4.5 * T;            // the butt's bull's-eye
    const ty = y + 2 - 26;
    const period = 2.4;
    const shot = Math.floor(t / period);
    const c = t % period;
    const hits = [[-3, -2], [4, 3], [-1, 5], [5, -4]];
    const stuck = away ? 0 : shot % 5;
    const pieces = [
      this.piece(y + 3, (ctx) => {
        for (let i = 0; i < stuck; i++) this.arrow(ctx, tx + hits[i][0], ty + hits[i][1], 0.05, 12);
      }),
      this.piece(y - 18, (ctx) => {
        // arrows standing in the barrel she shoots from
        const bx = x - 0.95 * T;
        const by = y - 0.6 * T - 24;
        for (const dx of [-5, -1, 3, 6]) this.arrow(ctx, bx + dx + 2, by - 12, -Math.PI / 2 - dx * 0.04, 12);
      }),
    ];
    if (away) return pieces;
    pieces.push(this.piece(y, (ctx) => {
      this.hero('ranger', x, y, t);
      this.held('bow', x + 11, y - 9, 0);
      // drawing the string back, then loosing
      const pull = c < 1.3 ? Math.min(1, c / 0.8) : 0;
      if (c < 1.3) {
        const sx = x + 11 - Math.round(pull * 6);
        ctx.strokeStyle = '#efe6d2';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10.5, y - 29.5); ctx.lineTo(sx + 0.5, y - 8.5); ctx.lineTo(x + 10.5, y + 11.5);
        ctx.stroke();
        this.arrow(ctx, sx + 14, y - 9, 0, 14);
      }
      // in flight
      if (c >= 1.3 && c < 1.55) {
        const k = (c - 1.3) / 0.25;
        const h = hits[shot % 5 % 4];
        this.arrow(ctx, lerp(x + 24, tx + h[0], k), lerp(y - 9, ty + h[1], k) - Math.sin(k * Math.PI) * 4, 0.05, 14);
      }
      // the thud: a puff of straw
      if (c >= 1.55 && c < 1.8) {
        const k = (c - 1.55) / 0.25;
        ctx.fillStyle = `rgba(232, 208, 130, ${1 - k})`;
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(tx - 4 + Math.cos(i * 1.3) * k * 10), Math.round(ty + Math.sin(i * 1.3) * k * 8), 2, 1);
      }
    }));
    return pieces;
  },

  /** The mage studies a spellbook floating open in front of her, runes circling it, pages turning. */
  mage(x, y, t, away) {
    const bx = x + 24;
    const by = y - 27 + Math.round(Math.sin(t * 2) * 2);
    const pieces = [];
    if (!away) pieces.push(this.piece(y, () => {
      // the staff leans at her back, behind her, so it never covers her
      this.held('staff', x - 11, y + 6, -Math.PI / 2 - 0.12);
      this.hero('mage', x, y, t);
    }));
    pieces.push(this.piece(y + 1, (ctx) => {
      if (away) return;
      drawGlow(ctx, bx, by, 26, '120, 190, 255', 0.25 + Math.sin(t * 3) * 0.06);
      // the book: dark covers, two cream pages
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(bx - 10, by - 5, 21, 10);
      ctx.fillStyle = '#3a2a6a';
      ctx.fillRect(bx - 9, by - 4, 19, 8);
      ctx.fillStyle = '#efe6d2';
      ctx.fillRect(bx - 8, by - 4, 8, 6);
      ctx.fillRect(bx + 1, by - 4, 8, 6);
      ctx.fillStyle = '#a89a80';
      for (let i = 0; i < 3; i++) { ctx.fillRect(bx - 7, by - 3 + i * 2, 6, 1); ctx.fillRect(bx + 2, by - 3 + i * 2, 5, 1); }
      // a page turning over every few seconds
      const p = (t % 3.2) / 0.5;
      if (p < 1) {
        const w = Math.round(Math.cos(p * Math.PI) * 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(w >= 0 ? bx + 1 : bx + w, by - 5 - Math.round(Math.sin(p * Math.PI) * 3), Math.abs(w) || 1, 6);
      }
      // runes circling the book
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + (i * TAU) / 3;
        const rx = Math.round(bx + Math.cos(a) * 15);
        const ry = Math.round(by + Math.sin(a) * 6);
        ctx.fillStyle = ['#6ae0ff', '#c88aff', '#8affc8'][i];
        ctx.fillRect(rx - 1, ry - 1, 3, 1);
        ctx.fillRect(rx, ry - 2, 1, 3);
      }
      // sparkles drifting up off the pages
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.7 + i / 4) % 1;
        ctx.fillStyle = `rgba(190, 230, 255, ${1 - k})`;
        ctx.fillRect(Math.round(bx - 6 + i * 4 + Math.sin(k * 6 + i) * 2), Math.round(by - 4 - k * 22), 1, 1);
      }
    }));
    // her cauldron, bubbling away with something violet
    const T = CONFIG.tileSize;
    const cx = Math.round(x + 2.5 * T);
    const cy = Math.round(y + 0.65 * T);
    pieces.push(this.piece(cy + 1, (ctx) => {
      drawGlow(ctx, cx, cy - 22, 22, '170, 90, 255', 0.22 + Math.sin(t * 4) * 0.06);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.9 + i / 3) % 1;
        ctx.fillStyle = `rgba(210, 160, 255, ${1 - k})`;
        ctx.fillRect(cx - 6 + i * 5, Math.round(cy - 24 - k * 14), 2, 2);
      }
    }));
    return pieces;
  },

  /** The priestess kneels in prayer before a glowing orb on a little shrine, then rises a while. */
  priestess(x, y, t, away) {
    const sx = x + 30;
    const sy = y + 5 - 20;          // the top of the shrine
    const c = (t + 2) % 9;
    const kneeling = !away && c < 6.2;
    const pieces = [
      this.piece(y + 6, (ctx) => {
        const pulse = 0.5 + Math.sin(t * 2) * 0.15 + (kneeling ? 0.2 : 0);
        drawGlow(ctx, sx, sy - 6, 30, '255, 230, 150', pulse * 0.5);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(sx - 5, sy - 11, 10, 10);
        ctx.fillStyle = '#ffe680';
        ctx.fillRect(sx - 4, sy - 10, 8, 8);
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(sx - 3, sy - 9, 3, 3);
        // motes of light rising while she prays
        if (kneeling) {
          for (let i = 0; i < 6; i++) {
            const k = (t * 0.45 + i / 6) % 1;
            ctx.fillStyle = `rgba(255, 240, 170, ${1 - k})`;
            ctx.fillRect(Math.round(lerp(x + 4, sx, 0.5) + Math.sin(k * 7 + i * 2) * 12), Math.round(sy - k * 40), 2, 2);
          }
        }
      }),
    ];
    if (!away) pieces.push(this.piece(y, () => this.hero('priestess', x, y, t, kneeling ? { anim: 'sit', lift: -1 } : {})));
    return pieces;
  },

  /** The rogue lounges by his loot, flipping a dagger end over end and catching it. */
  rogue(x, y, t, away) {
    const pieces = [
      this.piece(y + 9, (ctx) => drawGlints(ctx, [[x + 26, y - 4], [x + 38, y - 1], [x + 31, y - 8]], t)),
    ];
    if (away) return pieces;
    pieces.push(this.piece(y, (ctx) => {
      this.hero('rogue', x, y, t);
      const c = (t % 1.3) / 1.3;
      const hx = x + 10;
      const hy = y - 10;
      if (c < 0.75) {
        // up and spinning
        const k = c / 0.75;
        const w = Sprites.weapons.dagger;
        drawRotated(ctx, w.img, hx + Math.sin(k * Math.PI) * 3, hy - Math.sin(k * Math.PI) * 30, 10, 4, k * TAU * 2);
      } else this.held('dagger', hx, hy, -0.4);
    }));
    return pieces;
  },

  /** The bard sits on a stool strumming the lute, notes drifting up and away. */
  bard(x, y, t, away) {
    const pieces = [
      this.piece(y - 1, () => drawProp(this.ctx, 'stool', x - 1, y + 9)),
      this.piece(y + 10, (ctx) => {
        // a hat on the floor for tips
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 21, y + 4, 14, 6);
        ctx.fillStyle = '#7c1f2a';
        ctx.fillRect(x + 22, y + 5, 12, 4);
        ctx.fillStyle = '#ffd34a';
        ctx.fillRect(x + 25, y + 5, 2, 1);
        ctx.fillRect(x + 29, y + 6, 2, 1);
      }),
    ];
    if (away) return pieces;
    pieces.push(this.piece(y, (ctx) => {
      this.hero('bard', x, y, t, { anim: 'sit', lift: 8 });
      this.held('lute', x + 6, y - 12, -0.45 + Math.sin(t * 8) * 0.04);
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.4 + i / 4) % 1;
        const col = ['#ffe680', '#ff9ac8', '#9ae6ff', '#b0ff9a'][i];
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        this.note(ctx, x + 12 + k * 18 + Math.sin(k * 8 + i) * 5, y - 30 - k * 44, col, i % 2);
        ctx.globalAlpha = 1;
      }
    }));
    return pieces;
  },

  /**
   * The baker minds her oven, then carries each fresh bake over to the table
   * (a pastry appears there) and goes back for the next.
   */
  baker(x, y, t, away) {
    const T = CONFIG.tileSize;
    const ox = x + 30;
    const oy = y + 2;
    const period = 10;
    const loop = Math.floor(t / period);
    const c = t % period;
    const names = Object.keys(Sprites.pastries);
    const tableX = x - 1.95 * T;
    const tableY = y + 0.15 * T;
    // where she is: by the oven, walking to the table, at the table, walking back
    let bx = x;
    let anim = 'idle';
    let flip = false;
    let carrying = false;
    if (c >= 4 && c < 5.5) { bx = lerp(x, x - 32, (c - 4) / 1.5); anim = 'walk'; flip = true; carrying = true; }
    else if (c >= 5.5 && c < 7) { bx = x - 32; flip = true; carrying = c < 6; }
    else if (c >= 7 && c < 8.5) { bx = lerp(x - 32, x, (c - 7) / 1.5); anim = 'walk'; }
    const baked = away ? 3 : Math.min(4, (loop % 5) + (c >= 6 ? 1 : 0));
    const pieces = [
      this.piece(oy, (ctx) => {
        const img = Sprites.items.oven;
        drawShadow(ctx, ox, oy + 2, 22, 5, 0.35);
        ctx.drawImage(img, ox - Math.round(img.width / 2), oy - img.height + 2);
        const hot = c < 4 ? 0.55 + (c / 4) * 0.3 : 0.45;
        const flick = 0.8 + Math.sin(t * 9) * 0.1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.disc(ctx, ox, oy - 18, 12, 5, `rgba(255, 190, 90, ${hot * flick})`, 2);
        PFX.glow(ctx, ox, oy - 18, 22, '255, 190, 90', 0.4 * flick);
        ctx.restore();
        drawPuffs(ctx, ox + 10, oy - 52, t, '244, 240, 234', 3, 22, 3);
        // ding! it's ready
        if (c >= 3.7 && c < 4.2) HUD.text(ctx, 'DING!', ox, oy - 64 - (c - 3.7) * 16, { size: 6, align: 'center', color: '#ffe680' });
      }),
      // the pastries cooling on the table
      this.piece(tableY + 1, () => {
        for (let i = 0; i < baked; i++) {
          const img = Sprites.pastries[names[(loop + 4 - i) % names.length]];
          drawSprite(this.ctx, img, tableX - 15 + i * 10, tableY - 23, img.width / 2, img.height, false);
        }
      }),
    ];
    if (!away) {
      pieces.push(this.piece(y, (ctx) => {
        this.hero('baker', Math.round(bx), y, t, { anim, flip });
        if (carrying) {
          const img = Sprites.pastries[names[loop % names.length]];
          drawSprite(ctx, img, Math.round(bx) - 11, y - 14, img.width / 2, img.height, false);
        } else if (c < 4) this.held('rollingPin', x + 8, y - 6 + Math.round(Math.sin(t * 6) * 2), 0.2);
      }));
    }
    // the display table at the front of her nook, laid out with a row of finished bakes
    const dx = Math.round(x + 0.6 * T);
    const dy = Math.round(y + 2.2 * T);
    pieces.push(this.piece(dy + 1, () => {
      for (let i = 0; i < 3; i++) {
        const img = Sprites.pastries[names[(i * 3 + 1) % names.length]];
        drawSprite(this.ctx, img, dx - 13 + i * 13, dy - 23, img.width / 2, img.height, false);
      }
    }));
    return pieces;
  },

  /**
   * The rocketeer welds a new rocket at his bench, a rack of finished ones standing behind
   * him; now and then the one on the bench sputters and puffs smoke (not quite right yet).
   */
  rocketeer(x, y, t, away) {
    const T = CONFIG.tileSize;
    const rocket = Sprites.projectiles.rocket;
    const rx = x + 28;            // the rocket on the bench
    const ry = y + 0.15 * T - 24;
    const c = t % 8;
    const welding = !away && c < 4.5;
    const sputter = c >= 5.6 && c < 7;
    const flash = welding && Math.sin(t * 40) > 0.2;
    const pieces = [
      // the rack of finished rockets, standing on their tails
      this.piece(y - 26, (ctx) => {
        const sx = x - 34;
        const sy = y - 26;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(sx - 1, sy - 3, 24, 5);
        ctx.fillStyle = '#5b3922';
        ctx.fillRect(sx, sy - 2, 22, 3);
        for (let i = 0; i < 3; i++) drawRotated(ctx, rocket, sx + 4 + i * 7, sy - 12, 10, 4, -Math.PI / 2);
      }),
      this.piece(y + 6, (ctx) => {
        drawSprite(ctx, rocket, rx, ry, 10, 4, false);
        drawGlow(ctx, rx, ry, flash ? 30 : 12, flash ? '200, 240, 255' : '120, 200, 255', flash ? 0.5 : 0.12);
        if (welding) this.sparks(ctx, rx - 2, ry - 1, t, 8, -Math.PI / 2, 1.3, 16, ['#ffffff', '#9ae6ff']);
        if (sputter) {
          // the tail coughs: a flicker of flame and a puff of smoke
          if (Math.sin(t * 30) > 0) {
            ctx.fillStyle = '#ffb02e';
            ctx.fillRect(rx - 14, ry - 1, 4, 3);
            ctx.fillStyle = '#fff2a0';
            ctx.fillRect(rx - 12, ry, 2, 1);
          }
          drawPuffs(ctx, rx - 16, ry - 2, t * 1.6, '120, 114, 126', 4, 20, 3);
        }
      }),
    ];
    if (!away) {
      pieces.push(this.piece(y, (ctx) => {
        // jumps back from the sputtering rocket, then leans in again
        const hop = sputter && c < 6 ? -Math.round(Math.sin(((c - 5.6) / 0.4) * Math.PI) * 4) : 0;
        this.hero('rocketeer', x - (sputter ? 4 : 0), y + hop, t);
        if (welding) {
          // the welding torch: a little nozzle with a blue-white tip
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x + 7, y - 13, 10, 4);
          ctx.fillStyle = '#80869a';
          ctx.fillRect(x + 8, y - 12, 8, 2);
          ctx.fillStyle = flash ? '#ffffff' : '#9ae6ff';
          ctx.fillRect(x + 17, y - 12, 2, 2);
        }
      }));
    }
    // a spare rocket lying on the crate at the front of his nook
    const kx = Math.round(x + 1.2 * T);
    const ky = Math.round(y + 2.0 * T);
    pieces.push(this.piece(ky + 1, () => drawSprite(this.ctx, rocket, kx, ky - 27, 10, 4, false)));
    return pieces;
  },
};
