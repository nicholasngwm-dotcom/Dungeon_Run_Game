// The castle's set dressing (see FloorDecor): braziers, empty suits of armour, torn
// banners, corrupted crystals, rubble and hanging cages in its halls; in the boss
// rooms the Queen's garden (the bell she rings, the rose gates her gardeners come
// through, roses and topiary) or the King's throne room (the throne, the two side
// doors his guards march through, braziers lining the carpet).
// None of it blocks movement. The bell's swing and the doors are visual only.

const CastleDecor = {
  /** Fills room r. Returns false for rooms it leaves to FloorDecor (shops, specials). */
  decorate(fd, r) {
    const T = fd.floor.T;
    const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    const many = (n) => Math.max(1, Math.round(n * area / 250));
    const at = (kind, dx, dy, extra = {}) => fd.add(kind, { x: r.cx + dx * T, y: r.cy + dy * T }, extra);
    const scatter = (kind, n, opts = {}, extra = {}) => { for (let i = 0; i < n; i++) fd.add(kind, fd.spot(r, opts), extra); };
    switch (r.type) {
      case 'start':
        at('brazier', -3, 0.5);
        at('brazier', 3, 0.5);
        fd.add('signpost', { x: r.cx, y: r.cy - 1 * T }, { text: `STAGE ${fd.run.stage}` });
        at('banner', -5.5, -3.2);
        at('banner', 5.5, -3.2);
        scatter('rubble', 2, { clearMiddle: false });
        return true;
      case 'shop':
      case 'special':
        return false;
      case 'boss':
        if (fd.floor.bossType === 'queen') this.garden(fd, r);
        else if (fd.floor.bossType === 'king') this.throneRoom(fd, r);
        return true;
      default: {
        // the halls of the fallen keep
        scatter('brazier', many(0.8), { minGap: 110 });
        scatter('armor', many(0.5), { minGap: 70 });
        scatter('banner', many(0.5), { minGap: 70 });
        scatter('crystal', many(0.6), { minGap: 60 });
        scatter('rubble', many(0.9), { minGap: 40 });
        if (Math.random() < 0.35) scatter('cage', 1, { minGap: 80 });
        for (let i = 0; i < many(0.8); i++) {
          fd.add('prop', fd.spot(r, { minGap: 44 }), { name: choose(['weaponRack', 'barrel', 'crate', 'candelabra', 'skullPile', 'sacks']) });
        }
        scatter('candles', many(0.8));
        return true;
      }
    }
  },

  /** The Queen's garden: the bell in the middle, rose gates in the corners, roses, topiary and statues. */
  garden(fd, r) {
    const T = fd.floor.T;
    fd.add('gardenBell', { x: r.cx, y: r.cy + 0.4 * T }, { angle: 0, vel: 0, kick: 0, seen: 0 });
    const left = r.x0 * T + 34;
    const right = (r.x1 + 1) * T - 34;
    const top = r.y0 * T + 26;
    const bottom = (r.y1 + 1) * T - 4;
    for (const [x, y, down] of [[left, top, true], [right, top, true], [left, bottom, false], [right, bottom, false]]) {
      fd.add('roseGate', { x, y }, { spawnY: down ? y + 30 : y - 40, openUntil: 0 });
    }
    // lamp posts round the bell, roses and topiary along the paths, two weeping statues
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fd.add('lampPost', { x: r.cx + sx * 6 * T, y: r.cy + sy * 4.5 * T }, { warm: true });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fd.add('topiary', { x: r.cx + sx * 3 * T, y: r.cy + sy * 3.2 * T });
    for (let i = 0; i < 10; i++) fd.add('roseBush', fd.spot(r, { minGap: 60 }));
    fd.add('statue', { x: r.cx - 10 * T, y: r.cy - 0.5 * T });
    fd.add('statue', { x: r.cx + 10 * T, y: r.cy - 0.5 * T });
    for (let i = 0; i < 4; i++) fd.add('prop', fd.spot(r, { minGap: 50 }), { name: 'flowers' });
  },

  /** The King's throne room: the throne on its dais, a door either side, braziers down the carpet. */
  throneRoom(fd, r) {
    const T = fd.floor.T;
    fd.add('throne', { x: r.cx, y: (r.y0 + 5) * T });
    for (const s of [-1, 1]) fd.add('throneDoor', { x: r.cx + s * 8 * T, y: r.y0 * T }, { openUntil: 0, open: 0 });
    for (let ty = r.y0 + 8; ty < r.y1; ty += 4) for (const s of [-1, 1]) fd.add('brazier', { x: r.cx + s * 3.6 * T, y: ty * T });
    for (const s of [-1, 1]) {
      fd.add('prop', { x: r.cx + s * 4.2 * T, y: (r.y0 + 3) * T }, { name: 'candelabra' });
      fd.add('banner', { x: r.cx + s * 11.5 * T, y: (r.y0 + 2.4) * T });
      for (let ty = r.y0 + 6; ty < r.y1 - 1; ty += 5) fd.add('armor', { x: r.cx + s * 12.5 * T, y: ty * T });
    }
  },

  // ---------- life (visual only) ----------

  update(fd, dt, world) {
    for (const d of fd.items) {
      if (d.kind === 'gardenBell') {
        // a heavy pendulum: each ring kicks it, then it swings out and settles
        if (d.kick > d.seen) { d.vel += 3.2; d.seen = d.kick; }
        d.vel += -d.angle * 18 * dt;
        d.vel *= Math.exp(-1.2 * dt);
        d.angle += d.vel * dt;
      } else if (d.kind === 'brazier' && nativeRandom() < dt * 6) {
        world.effects.burst(d.x + vrand(-6, 6), d.y - 34, { count: 1, colors: ['#ffb02e', '#ff5a1e', '#fff2a0'], speed: [5, 20], up: 60, life: [0.5, 1], size: [1, 2] });
      } else if (d.kind === 'crystal' && nativeRandom() < dt * 1.5) {
        world.effects.burst(d.x + vrand(-8, 8), d.y - vrand(6, 26), { count: 1, colors: ['#c49aff', '#e4cfff'], speed: [3, 10], up: 16, life: [0.8, 1.4], size: [1, 2] });
      } else if (d.kind === 'throneDoor') {
        const want = d.openUntil > (world.boss ? world.boss.time : 0) ? 1 : 0;
        d.open += clamp(want - d.open, -dt * 2.5, dt * 2.5);
      } else if (d.kind === 'roseGate') {
        const t = world.boss ? world.boss.time : 0;
        const want = d.openUntil > t ? 1 : 0;
        d.open = (d.open || 0) + clamp(want - (d.open || 0), -dt * 2.5, dt * 2.5);
      }
    }
  },

  /** Lights for the gloom (see DungeonRun.lights). */
  lights(fd, out, t) {
    for (const d of fd.items) {
      const flick = Math.sin(t * 9 + d.seed);
      if (d.kind === 'brazier') out.push({ x: d.x, y: d.y - 26, r: 170 + flick * 8, s: 1, rgb: '255, 150, 60' });
      else if (d.kind === 'crystal') out.push({ x: d.x, y: d.y - 14, r: 90 + flick * 4, s: 0.7, rgb: '170, 110, 255' });
      else if (d.kind === 'throne') out.push({ x: d.x, y: d.y - 90, r: 180, s: 0.6, rgb: '255, 120, 140' });
      else if (d.kind === 'gardenBell') out.push({ x: d.x, y: d.y - 60, r: 150, s: 0.5, rgb: '200, 210, 255' });
      else if (d.kind === 'roseGate') out.push({ x: d.x, y: d.y - 30, r: 80, s: 0.4, rgb: '255, 120, 160' });
    }
  },

  /** Warm pools of light on the floor under the braziers. */
  drawGround(fd, ctx, d) {
    if (d.kind !== 'brazier') return;
    const flick = 1 + Math.sin(fd.time * 9 + d.seed) * 0.05;
    const r = 90 * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
    g.addColorStop(0, 'rgba(255, 160, 70, 0.18)');
    g.addColorStop(1, 'rgba(255, 160, 70, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
    ctx.restore();
  },

  /** Where an item sorts among the characters (the throne and doors stand at the back). */
  sortY(d) {
    if (d.kind === 'throne') return d.y - 40;
    if (d.kind === 'throneDoor') return d.y - 4;
    return d.y;
  },

  /** True if this module draws `kind`. */
  draws(kind) {
    return ['brazier', 'armor', 'banner', 'crystal', 'rubble', 'cage', 'gardenBell', 'roseGate', 'throne', 'throneDoor', 'roseBush', 'topiary', 'statue'].includes(kind);
  },

  drawItem(fd, ctx, d) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const t = fd.time;
    const S = Sprites.castleDecor;
    const R = Sprites.royal;
    const sprite = (img, sx = x, sy = y, shadow = 0.3) => {
      if (shadow) drawShadow(ctx, sx, sy + 1, Math.max(6, img.width * 0.38), 4, shadow);
      ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height + 2));
    };
    switch (d.kind) {
      case 'brazier':
        sprite(S.brazier);
        for (let i = 0; i < 3; i++) PFX.flame(ctx, x - 6 + i * 6, y - 30, 7, 14 + (i === 1 ? 6 : 0), t * 8 + i + d.seed, FIRE_COLORS);
        drawGlow(ctx, x, y - 36, 26, '255, 150, 60', 0.3 + Math.sin(t * 9 + d.seed) * 0.05);
        break;
      case 'armor': sprite(S.armor); break;
      case 'banner': sprite(S.banner, x, y, 0.2); break;
      case 'crystal':
        sprite(S.crystal, x, y, 0.2);
        drawGlow(ctx, x, y - 16, 22, '170, 110, 255', 0.25 + Math.sin(t * 2 + d.seed) * 0.08);
        break;
      case 'rubble': sprite(S.rubble, x, y, 0); break;
      case 'cage': {
        // the cage creaks round on its chain
        drawShadow(ctx, x, y + 1, 14, 4, 0.3);
        const img = S.cage;
        ctx.save();
        ctx.translate(x - img.width / 2 + 24, y - img.height + 10);
        ctx.rotate(Math.sin(t * 1.3 + d.seed) * 0.05);
        ctx.drawImage(img, -24, -8);
        ctx.restore();
        break;
      }
      case 'roseBush': sprite(S.roseBush, x, y, 0.25); break;
      case 'topiary': sprite(S.topiary, x, y, 0.3); break;
      case 'statue': sprite(S.statue, x, y, 0.3); break;
      case 'throne': {
        const img = R.throne;
        drawShadow(ctx, x, y - 4, 66, 10, 0.4);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height));
        break;
      }
      case 'throneDoor': {
        // the arch in the wall; its two oak leaves swing inward (narrowing) to open
        const arch = R.doorArch;
        const leaf = R.doorLeaf;
        const bottom = y + 8;
        ctx.drawImage(arch, Math.round(x - arch.width / 2), Math.round(bottom - arch.height));
        const k = 1 - (d.open || 0) * 0.82;
        const w = Math.max(2, Math.round(leaf.width * k));
        ctx.drawImage(leaf, Math.round(x - 24), Math.round(bottom - leaf.height), w, leaf.height);
        ctx.save();
        ctx.translate(Math.round(x + 24), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(leaf, 0, Math.round(bottom - leaf.height), w, leaf.height);
        ctx.restore();
        if (d.open > 0.05) drawGlow(ctx, x, bottom - 26, 22, '255, 160, 90', 0.25 * d.open);
        break;
      }
      case 'roseGate': {
        // the iron gates swing open (narrowing to each side) inside the rose arch
        const arch = R.roseArch;
        const leaf = R.gateLeaf;
        drawShadow(ctx, x, y + 1, 30, 5, 0.3);
        const k = 1 - (d.open || 0) * 0.85;
        const w = Math.max(2, Math.round(leaf.width * k));
        const base = y - 2;
        ctx.drawImage(leaf, Math.round(x - 20), Math.round(base - leaf.height), w, leaf.height);
        ctx.save();
        ctx.translate(Math.round(x + 20), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(leaf, 0, Math.round(base - leaf.height), w, leaf.height);
        ctx.restore();
        ctx.drawImage(arch, Math.round(x - arch.width / 2), Math.round(y - arch.height + 2));
        if (d.open > 0.05) drawGlow(ctx, x, y - 26, 26, '255, 120, 170', 0.35 * d.open);
        break;
      }
      case 'gardenBell': {
        const frame = R.bellFrame;
        const bell = R.bell;
        drawShadow(ctx, x, y + 1, 40, 6, 0.3);
        ctx.drawImage(frame, Math.round(x - frame.width / 2), Math.round(y - frame.height + 2));
        // the bell swings from the beam
        const px = x;
        const py = y - frame.height + 20;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(d.angle || 0);
        ctx.drawImage(bell, -21, -2);
        ctx.restore();
        // the rope hanging from it
        ctx.strokeStyle = '#a89878';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.sin(-(d.angle || 0)) * -36, py + 36);
        ctx.lineTo(px + 2 + Math.sin(-(d.angle || 0)) * -40, y - 20);
        ctx.stroke();
        if (Math.abs(d.vel || 0) > 0.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          PFX.glow(ctx, px, py + 18, 30, '255, 230, 150', Math.min(0.8, Math.abs(d.vel) * 0.2));
          ctx.restore();
        }
        break;
      }
    }
  },
};
