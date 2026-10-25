// Set dressing for a dungeon floor: dead trees, soul-flame lamp posts, coffins, urns,
// crows that take off when you get close, a campfire in the start room, barrels / crates /
// shelves in the shop, the castle's braziers and armour, the Phantom King's haunted manor... It's laid out in a pattern
// (along the walls, mirrored across the room) and it's walkable floor dressing, except
// the base of anything that gives light (lamp posts, braziers, candelabras, campfires),
// which is a small solid post (see solidify), and the boss rooms' fixtures (her bell, her
// desk). The rooms' real obstacles are their walls and cover (DungeonRun.addLayout).
// Drifting mist rises around the hero. Placement happens once, inside the shared
// simulation; the idle animation (crows, embers, mist) is visual only.

// Lights: the half-size of the small solid post at the base of each [hw, hh] (px)
const DECOR_POSTS = { lampPost: [6, 4], brazier: [8, 5], campfire: [12, 6], soulTree: [6, 4], magicBrazier: [8, 5], runeStone: [8, 4], ruinTree: [5, 4] };
const PROP_POSTS = { candelabra: [5, 4] };
// the two soul lanterns hanging off a soulTree, from its foot (px; mirrored when it faces left)
const SOUL_LANTERNS = [[-20, -40], [22, -44]];
// Boss-room fixtures the fights are built round: solid across their footprint (tiles wide)
const DECOR_FIXTURES = { gardenBell: 3, studyDesk: 3 };

class FloorDecor {
  constructor(floor, run) {
    this.floor = floor;
    this.run = run;
    this.items = [];
    this.time = 0;
    this.mistTimer = 0;
    for (const r of floor.rooms) this.decorate(r);
    this.solidify();
  }

  /**
   * Lights get a small solid post at their base (heroes and enemies walk round it, not
   * through it); the boss rooms' fixtures become solid cover tiles. Everything else stays
   * walkable. A light whose base would block a doorway is left out.
   */
  solidify() {
    const f = this.floor;
    const T = f.T;
    const run = this.run;
    for (const d of this.items) {
      // (a piece placed with `solid: [hw, hh]` is solid wherever it stands, like the boss rooms' furniture)
      const post = d.solid || (d.kind === 'prop' ? PROP_POSTS[d.name] : DECOR_POSTS[d.kind]);
      if (post) {
        const [hw, hh] = post;
        if (f.boxHitsTiles(d.x, d.y - hh, hw + 4, hh + 4)) { d.dead = true; continue; }   // up against a wall or doorway: dropped
        f.addPost(d.x, d.y - hh, hw, hh);
        continue;
      }
      const w = DECOR_FIXTURES[d.kind];
      if (!w) continue;
      const tx = Math.round(d.x / T - w / 2);
      const ty = Math.floor((d.y - 2) / T);
      if (![...Array(w).keys()].every((i) => f.baseTile(tx + i, ty) === TILE.FLOOR)) continue;
      for (let i = 0; i < w; i++) f.grid[ty][tx + i] = TILE.COVER;
      run.cover.push({ kind: 'decor', item: d, tx, ty, w, h: 1, x: tx * T, y: ty * T, seed: 0, room: f.roomAt(d.x, d.y), material: 'wood', fixed: true });
    }
    removeDead(this.items);
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
      if (this.run.nearCover?.(pt.x, pt.y, 40)) continue;   // not on or against cover
      return pt;
    }
    return null;
  }

  add(kind, pt, extra = {}) {
    if (pt) this.items.push({ kind, x: pt.x, y: pt.y, seed: Math.random() * 10, ...extra });
  }

  decorate(r) {
    if (r.type === 'vault') {
      // the gem vault (any theme): crystal clusters and heaps of gold round the walls, warm lamps
      this.dressRoom(r, {
        light: ['lampPost', { warm: true }],
        wall: [['gemCluster', { v: 0 }], ['prop:goldPile'], ['gemCluster', { v: 2 }], ['gemCluster', { v: 1 }]],
        floor: [['gemCluster', { v: 3 }], ['prop:goldPile'], ['gemCluster', { v: 0 }]],
      });
      return;
    }
    if (this.floor.themeId === 'castle' && CastleDecor.decorate(this, r)) return;
    if (this.floor.themeId === 'ruins' && RuinsDecor.decorate(this, r)) return;
    const T = this.floor.T;
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
        const at = (kind, dx, dy, extra = {}) => this.add(kind, { x: r.cx + dx * T, y: r.cy + dy * T }, extra);
        // Mira's corner: a tiered potion stand, a crate of bottles, herb baskets and plants
        at('bottleStand', -4.8, -0.9);
        at('bottleCrate', -1.4, -0.7);
        at('herbBasket', -5.2, 1.3);
        at('herbBasket', -7.4, 1.8);
        at('prop', -7.3, -2.2, { name: 'sacks' });
        for (const dx of [-4.3, -1.7]) at('prop', dx, -3.9, { name: 'plant' });
        // Bram's corner: a glowing rune circle before his counter, a floating crystal,
        // drifting spellbooks, bookshelves behind and candles
        at('runeCircle', 3, 0.5);
        at('crystal', 4.9, -0.9);
        at('floatingBooks', 1.3, -1.4);
        for (const dx of [1.7, 4.3]) at('prop', dx, -3.9, { name: 'bookshelf' });
        at('candles', 7.3, -2.2);
        at('candles', 1.4, 1.5);
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
        if (this.run.bossType === 'phantom') {
          // the Phantom King's room: the entrance hall of a haunted manor
          ManorDecor.decorate(this, r);
          return;
        }
        if (this.run.bossType === 'deathbringer') {
          // the Deathbringer's room: dead trees hung with soul lanterns, dark gold-plated graves, bones
          this.dressRoom(r, {
            light: 'soulTree',
            wall: [['darkGrave', { v: 0 }], ['darkGrave', { v: 2 }], ['soulTree'], ['darkGrave', { v: 1 }]],
            floor: [['darkGrave', { v: 3 }], ['bonePile'], ['darkGrave', { v: 0 }]],
          });
          return;
        }
      // falls through
      default:
        // graveyard rooms: lamp posts in the corners, trees, coffins and
        // urns along the walls, candles, bones and the odd crow on the floor, all mirrored
        this.dressRoom(r, {
          light: 'lampPost',
          wall: [['deadTree'], ['coffin'], ['urn'], ['deadTree']],
          floor: [['bonePile'], ['candles'], ['crow', { flying: false, t: 0, vx: 0, vy: 0 }]],
        });
    }
  }

  /**
   * Dresses a room the same on both sides (Soul Knight style, not scattered): `light` in its
   * four corners and halfway along its top and bottom walls, `wall` pieces lined up along the
   * walls, and `floor` clutter in pairs out on the floor. Each entry is [kind, extra] where kind
   * may be 'prop:name'. A pair is only placed if both of its spots are clear (of doorways,
   * cover, spikes and each other), so the room stays symmetrical.
   */
  dressRoom(r, { light, wall = [], floor = [] }) {
    const T = this.floor.T;
    const L = (r.x0 + 0.5) * T;
    const Rt = (r.x1 + 0.5) * T;
    const top = (r.y0 + 1.2) * T;
    const bottom = (r.y1 + 0.85) * T;
    const at = (fx, fy) => ({ x: lerp(L, Rt, fx), y: lerp(top, bottom, fy) });
    const place = (entry, fx, fy, minGap = 44) => {
      const [kind, extra = {}] = Array.isArray(entry) ? entry : [entry];
      const pair = [at(fx, fy), at(1 - fx, fy)];
      if (!pair.every((pt) => this.clear(r, pt, minGap))) return;
      pair.forEach((pt, i) => {
        const [k, name] = kind.split(':');
        this.add(k, pt, { ...extra, ...(name ? { name } : {}), facing: i ? -1 : 1, seed: i ? 6 : 0 });
      });
    };
    for (const fy of [0, 1]) place(light, 0.02, fy, 30);
    place(light, 0.27, 0, 30);
    place(light, 0.27, 1, 30);
    // along the top and bottom walls, then down the sides (clear of the doors halfway along each)
    wall.forEach((e, i) => place(e, [0.12, 0.38][i % 2], i < 2 ? 0 : 1));
    wall.forEach((e, i) => place(e, 0.02, [0.28, 0.72][i % 2]));
    floor.forEach((e, i) => place(e, [0.2, 0.3, 0.16][i % 3], [0.3, 0.7, 0.5][i % 3], 30));
  }

  /** True if (x, y) in room r is clear of its doorways, cover, spike pads, keepers and other decor. */
  clear(r, pt, minGap) {
    const f = this.floor;
    const T = f.T;
    if (!pt || f.roomAt(pt.x, pt.y) !== r) return false;
    if (r.doors.flatMap((d) => d.tiles).some((t) => dist((t % f.cols + 0.5) * T, (Math.floor(t / f.cols) + 0.5) * T, pt.x, pt.y) < 2.8 * T)) return false;
    if (this.run.spikes.some((s) => Math.abs(s.x + 16 - pt.x) < 34 && Math.abs(s.y + 16 - pt.y) < 34)) return false;
    if (this.run.props.some((p) => p.room === r && dist(p.x, p.y, pt.x, pt.y) < 80)) return false;
    if (this.run.nearCover?.(pt.x, pt.y, 26)) return false;
    return !this.items.some((d) => dist(d.x, d.y, pt.x, pt.y) < minGap);
  }

  // ---------- life ----------

  update(dt, world) {
    this.time += dt;
    const p = world.localPlayer;   // visual only: crows and mist react to this screen's hero
    const castle = this.floor.themeId === 'castle';
    if (castle) CastleDecor.update(this, dt, world);
    if (this.floor.themeId === 'ruins') RuinsDecor.update(this, dt, world);
    for (const d of this.items) {
      if (d.kind === 'crow') this.updateCrow(d, dt, p);
      else if (d.kind === 'campfire' && nativeRandom() < dt * 8) {
        world.effects.burst(d.x + vrand(-6, 6), d.y - 10, { count: 1, colors: ['#ffb02e', '#ff5a1e', '#fff2a0'], speed: [5, 20], up: 60, life: [0.5, 1.1], size: [1, 3] });
      } else if (d.kind === 'lampPost' && nativeRandom() < dt * 1.2) {
        world.effects.burst(d.x + vrand(-4, 4), d.y - 44, { count: 1, colors: d.warm ? ['#ffd34a', '#fff2a0'] : ['#8affb0', '#c8ffe0'], speed: [3, 10], up: 18, life: [1, 1.8], size: [1, 2] });
      }
    }
    removeDead(this.items);
    // mist drifting up out of the ground near the hero (the graveyard only)
    this.mistTimer -= dt;
    if (this.floor.themeId === 'graveyard' && this.mistTimer <= 0 && !p.dead) {
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
    pad = Math.max(pad, d.pad || 0);   // big pieces (the manor's stairs, its chandelier) reach far from their anchor
    return d.x > cam.x - pad && d.x < cam.x + cam.width + pad && d.y > cam.y - pad && d.y < cam.y + cam.height + pad * 2;
  }

  /** Rugs and light pools sit on the floor under everything. */
  drawGround(ctx, cam) {
    for (const d of this.items) {
      if (!this.visible(d, cam, 200)) continue;
      if (this.floor.themeId === 'castle') CastleDecor.drawGround(this, ctx, d);
      else if (RuinsDecor.draws(d.kind)) RuinsDecor.drawGround(this, ctx, d);
      else if (ManorDecor.draws(d.kind)) ManorDecor.drawGround(this, ctx, d);
      if (d.kind === 'rug') this.drawRug(ctx, d);
      if (d.kind === 'runeCircle') this.drawRuneCircle(ctx, d);
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
      .filter((d) => d.kind !== 'rug' && d.kind !== 'runeCircle' && this.visible(d, cam))
      .map((d) => ({ y: this.sortY(d), draw: (ctx) => (d.levitate ? this.drawFloating(ctx, d) : this.drawItem(ctx, d)) }));
  }

  /** Where an item sorts among the characters (crows in flight over everything, the manor's phantoms where they've drifted to). */
  sortY(d) {
    if (d.kind === 'crow' && d.flying) return d.y + 400;
    if (d.kind === 'manorPhantom') return ManorDecor.phantomAt(d, this.time).y;
    if (ManorDecor.draws(d.kind)) return ManorDecor.sortY(d);
    if (RuinsDecor.draws(d.kind)) return RuinsDecor.sortY(d);
    return CastleDecor.sortY(d);
  }

  /**
   * An item lifted off the floor by magic (the Princess's study in her second phase):
   * it rises over a second, then bobs and tilts gently in a violet glow above its shadow.
   */
  drawFloating(ctx, d) {
    const k = Math.min(1, (this.time - (d.levitateAt || 0)) / 1);
    const lift = k * (14 + Math.sin(this.time * 1.6 + d.seed) * 5);
    const tilt = k * Math.sin(this.time * 1.1 + d.seed * 2) * 0.06;
    drawShadow(ctx, d.x, d.y, 14, 4, 0.25 * k);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, d.x, d.y - lift - 14, 26, '170, 120, 255', 0.3 * k, 2, 20);
    ctx.restore();
    ctx.save();
    ctx.translate(d.x, d.y - lift);
    ctx.rotate(tilt);
    ctx.translate(-d.x, -d.y);
    this.drawItem(ctx, d);
    ctx.restore();
  }

  drawItem(ctx, d) {
    if (CastleDecor.draws(d.kind)) return CastleDecor.drawItem(this, ctx, d);
    if (ManorDecor.draws(d.kind)) return ManorDecor.drawItem(this, ctx, d);
    if (RuinsDecor.draws(d.kind)) return RuinsDecor.drawItem(this, ctx, d);
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
      case 'soulTree': {
        // a black dead tree with two iron soul lanterns on chains, ghost-blue souls flickering in them
        const img = Sprites.deathbringerRoom.soulTree;
        const flip = (d.facing || 1) < 0;
        drawShadow(ctx, x, y + 2, 18, 5);
        drawSprite(ctx, img, x, y + 1, 28, 76, flip);
        for (const [lx, ly] of SOUL_LANTERNS) {
          const sx = x + lx * (flip ? -1 : 1);
          const sy = y + ly + Math.round(Math.sin(t * 1.4 + d.seed + lx) * 1);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          PFX.glow(ctx, sx, sy, 16 + Math.sin(t * 5 + lx) * 2, '110, 220, 255', 0.7);
          ctx.restore();
          const fl = Math.sin(t * 9 + d.seed + lx) > 0 ? 1 : 0;
          R(sx - x - 2, sy - y - 3 - fl, 4, 5 + fl, '#7ae8ff');
          R(sx - x - 1, sy - y - 2, 2, 3, '#e6fbff');
        }
        break;
      }
      case 'gemCluster': {
        // crystals growing out of a rock, glowing in their own colour, a glint running over them
        const img = Sprites.vault.clusters[d.v || 0];
        const rgb = hexToRgb(GEM_RAMPS[d.v || 0][2]).join(', ');
        drawShadow(ctx, x, y + 1, 14, 4, 0.3);
        drawGlow(ctx, x, y - 16, 30, rgb, 0.25 + Math.sin(t * 2 + d.seed) * 0.06);
        drawSprite(ctx, img, x, y + 2, 16, 34, (d.facing || 1) < 0);
        drawGlints(ctx, [[x - 4, y - 24], [x + 6, y - 14]], t + d.seed);
        break;
      }
      case 'darkGrave':
        drawShadow(ctx, x, y + 1, 10, 3);
        drawSprite(ctx, Sprites.deathbringerRoom.graves[d.v || 0], x, y + 2, 12, 32, (d.facing || 1) < 0);
        if (d.v === 0 || d.v === 2) drawGlints(ctx, [[x - 2, y - 22], [x + 3, y - 12]], t + d.seed);
        break;
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
      case 'bottleStand': {
        // three tiers of potion bottles on a wooden stand, matching Mira's stall
        drawShadow(ctx, x, y + 2, 18, 4);
        R(-19, -34, 38, 36, OUTLINE);
        R(-18, -33, 36, 34, '#5b3922');
        for (const sy of [-24, -12, 0]) R(-18, sy - 2, 36, 3, '#9c6c3e');
        const cols = ['#e84a4a', '#3ab84a', '#2a5ad0', '#e0c030', '#9a4ae0', '#30c8b0'];
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 4 - (row === 0 ? 1 : 0); i++) {
            const c = cols[(i + row * 2 + Math.floor(d.seed)) % cols.length];
            const bx = -15 + i * 9 + (row === 0 ? 4 : 0);
            const by = -26 + row * 12;
            R(bx, by - 7, 6, 8, OUTLINE); R(bx + 1, by - 6, 4, 6, c); R(bx + 1, by - 6, 1, 4, 'rgba(255,255,255,0.5)');
            R(bx + 2, by - 9, 2, 2, '#9a6a3a');
          }
        }
        // a hand-painted sign
        R(-12, -42, 24, 9, OUTLINE); R(-11, -41, 22, 7, '#f4ead7');
        R(-7, -39, 3, 3, '#e84a4a'); R(-2, -39, 3, 3, '#2a5ad0'); R(3, -39, 3, 3, '#3ab84a');
        break;
      }
      case 'bottleCrate':
        drawShadow(ctx, x, y + 2, 12, 3);
        drawProp(ctx, 'crate', x, y + 2);
        for (const [bx, c] of [[-8, '#e84a4a'], [-2, '#3aa0c8'], [4, '#e0602a']]) {
          R(bx, -30, 5, 9, OUTLINE); R(bx + 1, -29, 3, 8, c); R(bx + 1, -32, 3, 3, '#9a6a3a');
        }
        break;
      case 'herbBasket':
        drawShadow(ctx, x, y + 2, 10, 3);
        R(-10, -10, 20, 12, OUTLINE); R(-9, -9, 18, 10, '#9c6c3e');
        for (let i = 0; i < 4; i++) R(-9, -8 + i * 2 + 1, 18, 1, '#7d532f');
        for (const [hx, hc] of [[-7, '#4a8a3a'], [-2, '#6a9a4a'], [3, '#9a4a6a'], [6, '#8a6a3a']]) {
          R(hx, -15, 3, 6, OUTLINE); R(hx, -14, 2, 5, hc); R(hx - 1, -16, 4, 2, hc);
        }
        break;
      case 'crystal': {
        // a stone pedestal with a crystal hovering and turning above it
        drawShadow(ctx, x, y + 2, 12, 3);
        R(-9, -16, 18, 18, OUTLINE); R(-8, -15, 16, 16, '#78738a'); R(-8, -15, 16, 3, '#9a96aa');
        R(-11, -18, 22, 4, OUTLINE); R(-10, -17, 20, 2, '#9a96aa');
        const bob = Math.round(Math.sin(t * 2 + d.seed) * 3);
        const cy = -34 + bob;
        const wdt = Math.max(1, Math.round(Math.abs(Math.cos(t * 1.5 + d.seed)) * 7));
        drawGlow(ctx, x, y + cy, 30, '140, 200, 255', 0.3 + Math.sin(t * 3) * 0.08);
        ctx.fillStyle = OUTLINE;
        ctx.beginPath(); ctx.moveTo(x, y + cy - 12); ctx.lineTo(x + wdt + 1, y + cy); ctx.lineTo(x, y + cy + 12); ctx.lineTo(x - wdt - 1, y + cy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7ac8ff';
        ctx.beginPath(); ctx.moveTo(x, y + cy - 10); ctx.lineTo(x + wdt, y + cy); ctx.lineTo(x, y + cy + 10); ctx.lineTo(x - wdt, y + cy); ctx.closePath(); ctx.fill();
        R(-1, cy - 6, 1, 6, '#e8f6ff');
        // motes orbiting the crystal
        for (let i = 0; i < 3; i++) {
          const a = t * 2.2 + (i / 3) * TAU;
          R(Math.round(Math.cos(a) * 14), cy + Math.round(Math.sin(a) * 5), 2, 2, '#c8ecff');
        }
        break;
      }
      case 'floatingBooks':
        // spellbooks drifting in the air, pages flapping
        for (let i = 0; i < 3; i++) {
          const bx = -14 + i * 14;
          const by = -30 - i * 6 + Math.round(Math.sin(t * 1.8 + i * 2 + d.seed) * 4);
          const flap = Math.sin(t * 6 + i) > 0 ? 1 : 0;
          const c = ['#3e5a96', '#87262a', '#33604e'][i];
          drawGlow(ctx, x + bx, y + by, 12, '180, 160, 255', 0.15);
          R(bx - 6, by - 3 - flap, 12, 6 + flap, OUTLINE);
          R(bx - 5, by - 2 - flap, 5, 4 + flap, c); R(bx + 1, by - 2 - flap, 5, 4 + flap, c);
          R(bx - 4, by - 1 - flap, 3, 2, '#e8dcc0'); R(bx + 2, by - 1 - flap, 3, 2, '#e8dcc0');
        }
        drawShadow(ctx, x, y + 2, 16, 3, 0.15);
        break;
    }
  }

  /** A slowly turning circle of glowing runes on the floor (Bram's side of the shop). */
  drawRuneCircle(ctx, d) {
    const t = this.time;
    const pulse = 0.55 + Math.sin(t * 2.2) * 0.2;
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(d.y));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
    g.addColorStop(0, `rgba(140, 180, 255, ${0.16 * pulse})`);
    g.addColorStop(1, 'rgba(140, 180, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-56, -56, 112, 112);
    ctx.scale(1, 0.45);
    ctx.strokeStyle = `rgba(150, 190, 255, ${0.5 * pulse})`;
    ctx.lineWidth = 2;
    for (const r of [46, 34]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    ctx.rotate(t * 0.4);
    ctx.fillStyle = `rgba(190, 215, 255, ${0.75 * pulse})`;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * 40, Math.sin(a) * 40);
      ctx.rotate(a);
      ctx.fillRect(-1, -4, 2, 8);
      ctx.fillRect(-3, (i % 2 ? -4 : 2), 6, 2);
      ctx.restore();
    }
    // a star inside
    ctx.strokeStyle = `rgba(150, 190, 255, ${0.4 * pulse})`;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = (i * 2 / 5) * TAU - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
      else ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
    }
    ctx.stroke();
    ctx.restore();
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
