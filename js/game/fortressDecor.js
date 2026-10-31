// The Fiery Fortress's set dressing and hazards (see FloorDecor): iron braziers, war banners,
// obsidian spikes, bones, lavafalls pouring down the walls into basins, and the open fires that
// burn up out of vents in the floor. The braziers and basins have small solid bases (DECOR_POSTS);
// the rest is walkable - the open fires too, which is what makes them dangerous, so each is drawn
// to be seen: tall roaring flames over a glowing grate, a pool
// of firelight, embers and smoke.
//
// Hazards (simulation, every step; see DungeonRun.update): an open fire sets whoever stands in it
// on fire (the slow, light burn: CONFIG.run.fire); lava - the pools and channels in the rooms -
// sears whoever stands in it, fast (CONFIG.run.lava). Bridges over the lava are safe.
//
// The lava's flow is animated over the floor's painted lava (drawLava): bright streaks drifting
// across the sea and the pools, bubbles popping. All visual only.

const FORT_FIRE_RGB = '255, 130, 40';

/**
 * A falling stream of lava, thick and slow like the real thing (the lavafalls, the doors' curtains): it creeps down
 * in heavy lumps that bulge and thin as they go, a dark cooling skin at its edges, a hot core lit from the left,
 * and slow bright folds sliding down it. From y0 down to y1 at x, about w px wide. opts.head: it's still pouring
 * down (a heavy rounded glob at its leading end); opts.tail: it's draining (it thins to a drip at the top);
 * opts.hot: brighter and a little quicker (a sealed door); opts.seed staggers the lumps between streams.
 */
function drawLavaStream(ctx, x, y0, y1, w, t, { seed = 0, head = false, tail = false, hot = false } = {}) {
  if (y1 - y0 < 1) return;
  const speed = hot ? 9 : 5;   // px/s: lava doesn't rush
  for (let yy = Math.round(y0); yy < y1; yy += 2) {
    const ph = yy - t * speed;
    let ww = w + Math.sin(ph * 0.16 + seed) * 1.8 + Math.sin(ph * 0.06 + seed * 2.3) * 1.2;
    if (tail) ww *= clamp((yy - y0) / 22, 0.25, 1);
    const sway = Math.sin(yy * 0.04 + t * 0.6 + seed) * 0.8;
    const lx = Math.round(x - ww / 2 + sway);
    const W = Math.max(2, Math.round(ww));
    ctx.fillStyle = '#7a1606';   // the cooling skin at its edges
    ctx.fillRect(lx, yy, W, 2);
    const fold = ((Math.floor(ph / 2) % 11) + 11) % 11;
    ctx.fillStyle = fold === 0 ? (hot ? '#fff0a0' : '#ffd27a') : fold === 1 ? '#ffa030' : hot ? '#ff7a1a' : '#e0461e';
    ctx.fillRect(lx + 1, yy, Math.max(1, W - 2), 2);
    ctx.fillStyle = hot ? '#ffc24a' : '#ff9a3a';   // lit down its left side
    ctx.fillRect(lx + 1, yy, Math.max(1, Math.round(W * 0.3)), 2);
  }
  if (head) {
    // the leading glob, swollen and heavy, a skin forming over it
    const gy = Math.round(y1);
    PFX.disc(ctx, x, gy, w * 0.72, 4, '#7a1606', 1);
    PFX.disc(ctx, x - 1, gy - 1, w * 0.55, 3, hot ? '#ff9a2a' : '#ff7a1a', 1);
    PFX.disc(ctx, x - 2, gy - 2, w * 0.2, 1, '#ffd27a', 1);
  }
}

const FortressDecor = {
  /** Fills room r. Returns false for rooms it leaves to FloorDecor (shops, specials). */
  decorate(fd, r) {
    const T = fd.floor.T;
    const at = (kind, dx, dy, extra = {}) => fd.add(kind, { x: r.cx + dx * T, y: r.cy + dy * T }, extra);
    switch (r.type) {
      case 'start':
        at('fortBrazier', -3, 0.5);
        at('fortBrazier', 3, 0.5);
        fd.add('signpost', { x: r.cx, y: r.cy - 1 * T }, { text: `STAGE ${fd.run.stage}` });
        at('fortBanner', -5.5, -3.2);
        at('fortBanner', 5.5, -3.2, { facing: -1 });
        this.lavafalls(fd, r, 1);
        return true;
      case 'shop':
      case 'special':
        return false;
      case 'boss':
        this.wormArena(fd, r);
        return true;
      default:
        // the fortress's halls: braziers in the corners, banners, obsidian and bones along the walls,
        // a lavafall or two, and open fires burning up out of the floor in the fight rooms
        fd.dressRoom(r, {
          light: 'fortBrazier',
          wall: [['fortBanner'], ['obsidian'], ['fortBones'], ['fortBanner']],
          floor: [['fortBones'], ['obsidian']],
        });
        this.lavafalls(fd, r, r.type === 'combat' ? 2 : 1);
        if (['combat', 'survival', 'defend'].includes(r.type)) {
          // combat rooms have no spike traps here: more open fires instead
          const [lo, hi] = r.type === 'combat' ? CONFIG.run.fire.combatFires : CONFIG.run.fire.fires;
          for (let i = 0, n = randInt(lo, hi); i < n; i++) fd.add('openFire', fd.spot(r, { minGap: 70 }));
        }
        return true;
    }
  },

  /** Lavafalls pouring out of grates high on the room's top wall into stone basins at its foot. */
  lavafalls(fd, r, n) {
    const T = fd.floor.T;
    const W = r.x1 - r.x0 + 1;
    const slots = n === 1 ? [0.5] : [0.3, 0.7];
    for (const k of slots) {
      const tx = r.x0 + Math.round((W - 1) * k + (n === 1 ? 0 : 0));
      // keep clear of the doorway in the middle of the top wall
      const off = Math.abs(tx + 0.5 - (r.x0 + r.x1 + 1) / 2) < 3 ? 4 : 0;
      const x = (tx + 0.5 + (k < 0.5 ? -off : off)) * T;
      const pt = { x, y: (r.y0 + 0.75) * T };
      if (fd.items.some((d) => dist(d.x, d.y, pt.x, pt.y) < 40)) continue;
      fd.add('lavafall', pt);
    }
  },

  /**
   * The worm's arena: braziers round the great sigil in its floor, banners on the walls, open fires in a
   * wide ring (so there's ground to fight on in the middle, where it bursts up), bones and obsidian about.
   */
  wormArena(fd, r) {
    const T = fd.floor.T;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      fd.add(i % 2 ? 'openFire' : 'fortBrazier', { x: r.cx + Math.cos(a) * 9.2 * T, y: r.cy + Math.sin(a) * 6 * T + 0.5 * T });
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      fd.add('fortBanner', { x: r.cx + sx * 12.5 * T, y: r.cy + sy * 5.6 * T + 0.6 * T }, { facing: -sx });
      fd.add('obsidian', { x: r.cx + sx * 6.5 * T, y: r.cy + sy * 8 * T });
    }
    for (let i = 0; i < 6; i++) fd.add('fortBones', fd.spot(r, { minGap: 50 }));
    this.lavafalls(fd, r, 2);
  },

  // ---------- hazards (simulation) ----------

  /** Open fires set heroes on fire; lava sears them. Called every step of the run (DungeonRun.update). */
  hazards(run, dt) {
    const w = run.world;
    run.hazardTick = (run.hazardTick || 0) - dt;
    if (run.hazardTick > 0) return;
    run.hazardTick += CONFIG.run.lava.every;
    const F = CONFIG.run.fire;
    const L = CONFIG.run.lava;
    const scale = w.enemyScale.damage;
    const f = run.floor;
    const fires = run.decor.items.filter((d) => d.kind === 'openFire');
    for (const p of w.heroes) {
      if (p.dead) continue;
      if (f.lavaAt(p.x, p.y)) p.lavaBurn?.(Math.round(L.dps * scale), L.linger, w);
      if (fires.some((d) => dist(d.x, d.y, p.x, p.y) < F.radius + p.radius * 0.4)) p.burn?.(Math.round(F.burnDps * scale), F.burnTime, w);
    }
  },

  // ---------- life (visual only) ----------

  update(fd, dt, world) {
    for (const d of fd.items) {
      if (d.kind === 'fortBrazier' && nativeRandom() < dt * 8) {
        world.effects.burst(d.x + vrand(-6, 6), d.y - 34, { count: 1, colors: ['#ffb02e', '#ff5a1e', '#fff2a0'], speed: [5, 20], up: 60, life: [0.5, 1], size: [1, 2] });
      } else if (d.kind === 'openFire') {
        // embers and smoke pouring up off it, so it's plain from across the room
        if (nativeRandom() < dt * 16) world.effects.burst(d.x + vrand(-12, 12), d.y - vrand(10, 40), { count: 1, colors: ['#ffd34a', '#ff8a1e', '#fff6c8'], speed: [10, 40], up: 90, life: [0.6, 1.2], size: [1, 3] });
        if (nativeRandom() < dt * 2) world.effects.smoke(d.x + vrand(-6, 6), d.y - 56, { count: 1, radius: 8, life: 1.4, rise: 40, colors: ['#2a1a18', '#3e2a26', '#5a4038'] });
      } else if (d.kind === 'lavafall' && nativeRandom() < dt * 4) {
        // thick lava doesn't splash: a slow, heavy blob plops out of the heap now and then
        world.effects.burst(d.x + vrand(-6, 6), d.y - 6, { count: 1, colors: ['#ffc23a', '#ff8a1e', '#e0461e'], speed: [4, 14], up: 18, gravity: 90, life: [0.6, 1], size: [2, 3] });
      }
    }
    // bubbles swelling and popping on the lava in view
    const cam = world.camera;
    const f = fd.floor;
    // (thick lava: a skin swells up slowly into a dome, then pops, a few heavy drops plopping back)
    for (let i = 0; i < 2; i++) {
      if (nativeRandom() > dt * 18) continue;
      const x = cam.x + vrand(0, cam.width);
      const y = cam.y + vrand(0, cam.height);
      const tx = Math.floor(x / f.T);
      const ty = Math.floor(y / f.T);
      if (!(f.lava.has(f.idx(tx, ty)) || (f.baseTile(tx, ty) === TILE.WALL && f.isSea(tx, ty)))) continue;
      const r = vrand(3, 6);
      const life = vrand(1.2, 2);
      world.effects.add(life, (ctx, k) => {
        if (k < 0.82) {
          const s = Math.sin((k / 0.82) * Math.PI / 2);
          PFX.disc(ctx, x, y, r * s + 1, (r * s + 1) * 0.6, '#a8200e', 1);
          PFX.disc(ctx, x - 1, y - 1, r * s * 0.7 + 0.5, (r * s * 0.7 + 0.5) * 0.6, '#ff8a1e', 1);
          if (s > 0.5) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.round(x - r * 0.4), Math.round(y - r * 0.4), 2, 1); }
          return;
        }
        // popped: a few heavy drops arcing out and back down
        const u = (k - 0.82) / 0.18;
        ctx.fillStyle = u < 0.5 ? '#ffd27a' : '#ff8a1e';
        for (let j = 0; j < 4; j++) {
          const a = j * 1.57 + 0.6;
          ctx.fillRect(Math.round(x + Math.cos(a) * r * (0.6 + u)), Math.round(y - Math.sin(u * Math.PI) * 5 + Math.sin(a) * r * 0.3), 2, 2);
        }
      }, true);
    }
  },

  /** Lights for the haze (see DungeonRun.lights): fires, braziers, lavafalls and the pools of lava in the rooms. */
  lights(fd, out, t) {
    for (const d of fd.items) {
      const flick = Math.sin(t * 9 + d.seed);
      if (d.kind === 'fortBrazier') out.push({ x: d.x, y: d.y - 28, r: 150 + flick * 8, s: 0.95, rgb: '255, 150, 60' });
      else if (d.kind === 'openFire') out.push({ x: d.x, y: d.y - 18, r: 140 + flick * 12, s: 1, rgb: FORT_FIRE_RGB });
      else if (d.kind === 'lavafall') out.push({ x: d.x, y: d.y - 30, r: 130, s: 0.9, rgb: FORT_LAVA });
    }
    for (const pl of fd.run.lavaPools || []) out.push({ x: pl.x, y: pl.y, r: pl.r, s: 0.85, rgb: FORT_LAVA });
  },

  /** Pools of firelight on the floor under the braziers and fires, and the open fires' vents. */
  drawGround(fd, ctx, d) {
    const t = fd.time;
    if (d.kind === 'openFire') {
      const img = Sprites.fortressDecor.vent;
      ctx.drawImage(img, Math.round(d.x - img.width / 2), Math.round(d.y - img.height / 2));
    }
    if (!['fortBrazier', 'openFire', 'lavafall'].includes(d.kind)) return;
    const flick = 1 + Math.sin(t * 9 + d.seed) * 0.06;
    const r = (d.kind === 'openFire' ? 100 : 80) * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
    g.addColorStop(0, `rgba(${FORT_FIRE_RGB}, ${d.kind === 'openFire' ? 0.3 : 0.16})`);
    g.addColorStop(1, `rgba(${FORT_FIRE_RGB}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
    ctx.restore();
  },

  /** True if this module draws `kind`. */
  draws(kind) {
    return ['fortBrazier', 'fortBanner', 'obsidian', 'fortBones', 'openFire', 'lavafall'].includes(kind);
  },

  sortY(d) { return d.kind === 'lavafall' ? d.y - 6 : d.y; },

  drawItem(fd, ctx, d) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const t = fd.time;
    const S = Sprites.fortressDecor;
    const sprite = (img, flip = false, shadow = 0.3) => {
      if (shadow) drawShadow(ctx, x, y + 1, Math.max(6, img.width * 0.38), 4, shadow);
      drawSprite(ctx, img, x, y + 2, Math.round(img.width / 2), img.height, flip);
    };
    switch (d.kind) {
      case 'fortBrazier':
        sprite(S.brazier);
        for (let i = 0; i < 3; i++) PFX.flame(ctx, x - 6 + i * 6, y - 26, 7, 14 + (i === 1 ? 7 : 0), t * 8 + i + d.seed, FIRE_COLORS);
        drawGlow(ctx, x, y - 32, 26, '255, 150, 60', 0.3 + Math.sin(t * 9 + d.seed) * 0.05);
        break;
      case 'fortBanner': {
        // the cloth stirs in the heat rising off the lava
        drawShadow(ctx, x, y + 1, 8, 3, 0.25);
        ctx.save();
        ctx.translate(x, y + 2);
        ctx.transform(1, 0, Math.sin(t * 1.4 + d.seed) * 0.03, 1, 0, 0);
        if (d.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(S.banner, -4, -S.banner.height);
        ctx.restore();
        break;
      }
      case 'obsidian': sprite(S.obsidian, d.facing < 0, 0.2); break;
      case 'fortBones': sprite(S.bones, d.seed > 5, 0.1); break;
      case 'openFire': {
        // tall, roaring flames: big enough to see from across the room, and lit up over the gloom
        const lick = (i) => 1 + Math.sin(t * 7 + i * 2.1 + d.seed) * 0.22;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 22, 34, FORT_FIRE_RGB, 0.45 + Math.sin(t * 11 + d.seed) * 0.08, 2, 40);
        ctx.restore();
        for (const [dx, w, h, i] of [[-11, 10, 24, 0], [10, 10, 26, 1], [-4, 13, 42, 2], [5, 12, 36, 3], [0, 9, 50, 4]]) {
          PFX.flame(ctx, x + dx, y - 2, w, h * lick(i), t * 9 + i * 1.7 + d.seed, FIRE_COLORS);
        }
        break;
      }
      case 'lavafall': {
        // a stream of lava pouring out of a grate high on the wall, down into its basin
        const top = y - 78;
        const bottom = y - 6;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 9, top - 4, 18, 8);
        ctx.fillStyle = '#46404a';
        ctx.fillRect(x - 8, top - 3, 16, 6);
        ctx.fillStyle = '#1a0604';
        ctx.fillRect(x - 6, top - 1, 12, 3);
        drawLavaStream(ctx, x, top + 2, bottom, 10, t, { seed: d.seed });
        // it piles up where it lands: a slow-spreading heap of lava in the basin
        PFX.disc(ctx, x, bottom, 9 + Math.sin(t * 0.8 + d.seed) * 1, 3, '#e0461e', 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, (top + bottom) / 2, 18, FORT_LAVA, 0.35, 2, 46);
        ctx.restore();
        sprite(S.basin, false, 0.2);
        break;
      }
    }
  },

  // ---------- the lava's flow (visual only) ----------

  /**
   * The rows of lava tiles on this floor (the sea under the fortress and the rooms' pools and channels, not the
   * bridges), as runs [ty, tx0, tx1], built once per floor.
   */
  lavaRuns(f) {
    if (f.lavaRunList) return f.lavaRunList;
    const out = [];
    for (let ty = 0; ty < f.rows; ty++) {
      let start = -1;
      for (let tx = 0; tx <= f.cols; tx++) {
        const i = f.idx(tx, ty);
        const lava = tx < f.cols && ((f.lava.has(i) && !f.bridges.has(i)) || (f.baseTile(tx, ty) === TILE.WALL && f.isSea(tx, ty)));
        if (lava && start < 0) start = tx;
        if (!lava && start >= 0) { out.push([ty, start, tx - 1]); start = -1; }
      }
    }
    f.lavaRunList = out;
    return out;
  },

  /** The two layers of bright streaks drifting over the lava (built once). */
  flowPatterns(ctx) {
    if (this.patterns) return this.patterns;
    const make = (seed, colors) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      const rng = seededRandom(seed);
      for (let i = 0; i < 26; i++) {
        const x = rng() * 128;
        const y = rng() * 128;
        const len = 10 + rng() * 26;
        g.fillStyle = colors[Math.floor(rng() * colors.length)];
        for (let k = 0; k < len; k += 2) {
          const xx = Math.round(x + k) % 128;
          const yy = Math.round(y + Math.sin((x + k) * 0.12) * 3 + 128) % 128;
          g.fillRect(xx, yy, 2, 2);
        }
      }
      return ctx.createPattern(c, 'repeat');
    };
    this.patterns = [make(7, ['rgba(255, 226, 122, 0.55)', 'rgba(255, 170, 60, 0.5)']), make(19, ['rgba(255, 120, 40, 0.45)', 'rgba(255, 210, 110, 0.35)'])];
    return this.patterns;
  },

  /** Lava drifting: two layers of bright streaks sliding across every lava tile in view, pulsing with the heat. */
  drawLava(run, ctx, cam) {
    const f = run.floor;
    const T = f.T;
    const runs = this.lavaRuns(f);
    const ty0 = Math.floor(cam.y / T) - 1;
    const ty1 = Math.ceil((cam.y + cam.height) / T) + 1;
    const tx0 = Math.floor(cam.x / T) - 1;
    const tx1 = Math.ceil((cam.x + cam.width) / T) + 1;
    const pats = this.flowPatterns(ctx);
    const t = run.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    pats.forEach((pat, i) => {
      // a slow, heavy crawl (lava creeps, it doesn't run), the two layers drifting apart
      const ox = (t * (i ? -2.2 : 3.5)) % 128;
      const oy = (t * (i ? 1.2 : 0.8)) % 128;
      pat.setTransform?.(new DOMMatrix().translate(ox, oy));
      ctx.fillStyle = pat;
      ctx.globalAlpha = (i ? 0.5 : 0.7) + Math.sin(t * (i ? 0.45 : 0.3)) * 0.15;
      for (const [ty, a, b] of runs) {
        if (ty < ty0 || ty > ty1 || b < tx0 || a > tx1) continue;
        const x0 = Math.max(a, tx0);
        const x1 = Math.min(b, tx1);
        ctx.fillRect(x0 * T, ty * T, (x1 - x0 + 1) * T, T);
      }
    });
    ctx.restore();
  },
};
