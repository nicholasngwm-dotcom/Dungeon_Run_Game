// Swinging double doors, shared by the lobby keep and the dungeon floors. Each
// doorway gets two leaves hinged at the sides of the opening: wooden doors, or
// wrought-iron gates (the graveyard). They swing open away from a hero walking
// up, stay open while anyone's near, then slowly shut. Doors are visual only
// (locks are solid tiles); a locked door slams shut and is barred (or chained)
// until it's unlocked.

class SwingDoors {
  /**
   * list: [{ ns, x, a, b }] (the door plane runs north-south at x, from y=a to y=b)
   * or [{ ns: false, y, a, b }] (east-west at y, from x=a to x=b).
   * opts.reach: how close (px, to the door line) a hero has to be to open it.
   * opts.height: how tall the leaves stand; opts.edge: how thick a leaf seen side-on looks.
   * opts.style: 'wood' | 'iron'; opts.sounds: { open, shut, slam } sound names.
   */
  constructor(list, { reach = 84, height = 54, edge = 4, style = 'wood', sounds = {} } = {}) {
    this.doors = list.map((d) => ({ ...d, open: 0, dir: 1, idle: 0, locked: false, slam: 0 }));
    this.reach = reach;
    this.height = height;
    this.edge = edge;   // how thick a leaf looks when seen side-on
    this.style = style;
    this.sounds = { open: 'uiClick', ...sounds };
  }

  /** A door sound, only for doors near this screen's hero. */
  sound(name, dr, world) {
    if (!name) return;
    const me = world.localPlayer;
    if (me && SwingDoors.distTo(dr, me.x, me.y) < 360) Sound.play(name, 0.2);
  }

  /** Distance from (x, y) to a door's line. */
  static distTo(dr, x, y) {
    return dr.ns
      ? Math.hypot(x - dr.x, y - clamp(y, dr.a, dr.b))
      : Math.hypot(x - clamp(x, dr.a, dr.b), y - dr.y);
  }

  /**
   * Shut doors are walls: while a door is less than half open its doorway tiles
   * (dr.tiles, tile indices) go into the dungeon's doorBlocks, which tileAt treats
   * as solid, so heroes, enemies and projectiles all stop at it. A door never
   * turns solid on top of someone standing in its doorway.
   */
  updateBlocking(dr, world) {
    if (!dr.tiles) return;
    const d = world.dungeon;
    d.doorBlocks ??= new Set();
    let shut = dr.open < 0.5;
    if (shut && !dr.blocking) {
      const T = d.T;
      const inDoorway = (e) => {
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const tx = Math.floor((e.x + ox * (e.hw || 8)) / T);
          const ty = Math.floor((e.y + oy * (e.hh || 6)) / T);
          if (dr.tiles.includes(ty * d.cols + tx)) return true;
        }
        return false;
      };
      if ([...world.players, ...world.enemies, ...world.clones].some((e) => !e.dead && inDoorway(e))) shut = false;
    }
    dr.blocking = shut;
    for (const t of dr.tiles) {
      if (shut) d.doorBlocks.add(t);
      else d.doorBlocks.delete(t);
    }
  }

  update(dt, world) {
    for (const dr of this.doors) {
      this.updateBlocking(dr, world);
      dr.slam -= dt;
      // the ruins' stone doors: how far they moved last step (rock and dust while moving, a thud as they settle)
      if (this.style === 'stone') { this.stoneFx(dr, world, dr.lastOpen ?? dr.open, dr.open); dr.lastOpen = dr.open; }
      if (dr.locked) {
        // slam shut: a puff of dust along the doorway as it bangs closed
        if (dr.open > 0) {
          dr.open = Math.max(0, dr.open - dt * 5);
          if (dr.open === 0) this.slammed(dr, world);
        }
        continue;
      }
      let near = null;
      let best = this.reach;
      for (const p of world.players) {
        if (p.dead) continue;
        const dd = SwingDoors.distTo(dr, p.x, p.y);
        if (dd < best) { best = dd; near = p; }
      }
      if (near) {
        // only pick the swing direction from shut, so a door never flips through someone
        if (dr.open < 0.05) dr.dir = dr.ns ? (near.x < dr.x ? 1 : -1) : (near.y < dr.y ? 1 : -1);
        if (dr.open === 0) this.sound(this.sounds.open, dr, world);
        dr.open = Math.min(1, dr.open + dt * 3.2);
        dr.idle = 0;
      } else {
        dr.idle += dt;
        if (dr.idle > 0.6 && dr.open > 0) {
          if (dr.open === 1) this.sound(this.sounds.open, dr, world);   // creaks as it starts to swing back
          dr.open = Math.max(0, dr.open - dt * 0.65);
          if (dr.open === 0) this.sound(this.sounds.shut, dr, world);
        }
      }
    }
  }

  slammed(dr, world) {
    dr.slam = 0.35;
    this.sound(this.sounds.slam || this.sounds.shut, dr, world);
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const u = lerp(dr.a, dr.b, i / steps);
      const x = dr.ns ? dr.x : u;
      const y = dr.ns ? u : dr.y;
      world.effects.burst(x, y, { count: 2, colors: ['#8a7a6a', '#5c5068'], speed: [10, 40], life: [0.3, 0.6], up: 20 });
    }
  }

  /**
   * The two leaves of each door as y-sorted drawables. Each leaf turns about its
   * hinge on the floor; it's drawn as an upright wooden panel (planks, two iron
   * bands, a ring pull) from its base line up to the door's height.
   */
  drawables(camera = null) {
    const items = [];
    for (const dr of this.doors) {
      if (camera) {
        const x0 = dr.ns ? dr.x : dr.a;
        const x1 = dr.ns ? dr.x : dr.b;
        const y0 = dr.ns ? dr.a : dr.y;
        const y1 = dr.ns ? dr.b : dr.y;
        const m = 120;
        if (x1 < camera.x - m || x0 > camera.x + camera.width + m || y1 < camera.y - m || y0 > camera.y + camera.height + m) continue;
      }
      if (this.style === 'stone') { items.push(...this.stoneDrawables(dr)); continue; }
      // eased swing with a little overshoot when it bangs open
      const k = dr.open;
      const e = k < 1 ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.06 : 1;
      const turn = (Math.PI / 2) * e * dr.dir;
      const half = (dr.b - dr.a) / 2;
      // a slammed door shudders for a moment
      const jolt = dr.slam > 0 ? Math.sin(dr.slam * 60) * dr.slam * 3 : 0;
      const leaves = dr.ns
        ? [{ hx: dr.x, hy: dr.a, phi: Math.PI / 2 - turn }, { hx: dr.x, hy: dr.b, phi: -Math.PI / 2 + turn }]
        : [{ hx: dr.a, hy: dr.y, phi: turn }, { hx: dr.b, hy: dr.y, phi: Math.PI - turn }];
      for (const l of leaves) {
        const ex = l.hx + Math.cos(l.phi) * half + (dr.ns ? jolt : 0);
        const ey = l.hy + Math.sin(l.phi) * half + (dr.ns ? 0 : jolt);
        items.push({ y: Math.max(l.hy, ey) - 1, draw: (ctx) => (this.style === 'iron' ? this.drawGate(ctx, l.hx, l.hy, ex, ey) : this.drawLeaf(ctx, l.hx, l.hy, ex, ey)) });
      }
      if (dr.locked && dr.open === 0) items.push({ y: (dr.ns ? dr.b : dr.y) + 1, draw: (ctx) => (this.style === 'iron' ? this.drawChains(ctx, dr) : this.drawBar(ctx, dr)) });
    }
    return items;
  }

  // ---------- the ruins' doors: stone pillars that the magic raises and sinks ----------

  /**
   * One great carved sandstone pillar standing in a doorway (built once), 26px wide: a broad capital
   * with a key band, a fluted shaft lit down its left, a base, moss on top and a vine. Its glyph is
   * drawn live (it brightens when sealed).
   */
  static stonePillar(H) {
    SwingDoors.pillars ??= {};
    if (SwingDoors.pillars[H]) return SwingDoors.pillars[H];
    const D = RU.sand;
    const W = 26;
    const img = PixelArt.make(W, H + 4, (p) => {
      p.rect(3, 8, W - 6, H - 6, D[2]);
      p.rect(3, 8, 4, H - 6, D[4]);
      p.rect(W - 7, 8, 4, H - 6, D[1]);
      for (const x of [9, 13, 17]) p.rect(x, 11, 1, H - 12, D[1]);   // fluting
      // the capital: broad, with a key band carved round it
      p.rect(0, 1, W, 8, D[3]);
      p.rect(0, 1, W, 1, D[4]);
      p.rect(0, 8, W, 1, D[0]);
      for (let x = 2; x < W - 4; x += 6) { p.rect(x, 3, 4, 1, D[1]); p.rect(x + 3, 3, 1, 3, D[1]); p.rect(x, 5, 2, 1, D[1]); }
      // the base
      p.rect(1, H - 2, W - 2, 5, D[1]);
      p.rect(1, H - 2, W - 2, 1, D[3]);
      p.rect(9, Math.round(H * 0.42) - 1, 8, 11, D[1]);   // the glyph's recess
      ruMoss(p, 1, 1, 12, Math.round(H) % 3 === 0 ? 0 : -1);
      ruCrack(p, [[5, Math.round(H * 0.7)], [8, Math.round(H * 0.8)]], D, false);
      for (let i = 0; i < 18; i++) {
        const vx = W - 5 + Math.round(Math.sin(i * 0.5) * 1.5);
        p.px(vx, 9 + i, RU.moss[1]);
        if (i % 5 === 2) p.rect(vx - 2, 9 + i, 2, 2, RU.moss[3]);
      }
    }, OUTLINE, 0.5);
    return (SwingDoors.pillars[H] = img);
  }

  /**
   * A doorway of great stone pillars, one every 22px along it: shut, they stand full height side by
   * side; as the door opens they sink into the ground all together, as one wall, grinding and
   * trembling, and rise again together to shut it. Locked, their glyphs flare in a pulsing seal.
   */
  stoneDrawables(dr) {
    const items = [];
    const H = this.height;
    const len = dr.b - dr.a;
    const n = Math.max(1, Math.round(len / 22));
    const img = SwingDoors.stonePillar(H);
    const sealed = dr.locked && dr.open === 0;
    const k = dr.open;
    const up = 1 - (k * k * (3 - 2 * k));
    const moving = k > 0 && k < 1;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const x = dr.ns ? dr.x : lerp(dr.a, dr.b, u);
      const y = dr.ns ? lerp(dr.a, dr.b, u) + 8 : dr.y + 8;
      const jolt = dr.slam > 0 ? Math.round(Math.sin(dr.slam * 60 + i) * dr.slam * 4) : 0;
      items.push({
        y: y - 1,
        draw: (ctx) => {
          // grinding: the whole wall trembles side to side while it moves
          const shake = moving ? Math.round(Math.sin(performance.now() / 30 + i * 0.3)) : 0;
          const h = Math.round((H + 4) * up);
          if (h > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - 14, y - H - 10, 28, H + 10);
            ctx.clip();
            ctx.drawImage(img, Math.round(x - 13 + shake), Math.round(y - h + jolt));
            ctx.restore();
            // the glyph on its face: faint at rest, bright while it moves, burning as a seal while the room is locked
            const gy = Math.round(y - h + H * 0.42 + 4 + jolt);
            if (gy < y - 3) {
              const pulse = sealed ? 0.75 + Math.sin(performance.now() / 160 + i) * 0.25 : moving ? 0.8 : 0.45;
              ctx.save();
              ctx.globalAlpha = pulse;
              ctx.fillStyle = sealed || moving ? '#b8fff0' : '#22b8a6';
              ctx.fillRect(Math.round(x + shake) - 1, gy - 4, 2, 9);
              ctx.fillRect(Math.round(x + shake) - 4, gy - 1, 8, 3);
              ctx.globalCompositeOperation = 'lighter';
              PFX.glow(ctx, x, gy, sealed ? 14 : moving ? 12 : 8, RUIN_MAGIC, sealed ? 0.5 : moving ? 0.4 : 0.2);
              ctx.restore();
            }
          }
          // where it sinks into the floor: a dark slot, its lip glowing with the magic while it moves
          if (up < 1) {
            ctx.fillStyle = 'rgba(14, 20, 14, 0.8)';
            ctx.fillRect(Math.round(x - 12), Math.round(y - 3), 24, 5);
            if (moving) {
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.8;
              ctx.fillStyle = '#5cf0d8';
              ctx.fillRect(Math.round(x - 12), Math.round(y - 3), 24, 1);
              PFX.glow(ctx, x, y - 2, 14, RUIN_MAGIC, 0.3);
              ctx.restore();
            }
          }
        },
      });
    }
    return items;
  }

  /**
   * The ruins' stone doors moving (visual only): while they grind up or down, chips of rock and grit
   * spray from the slot and tumble off the pillar tops, dust rolls along the floor and motes of the
   * magic rise; the moment they settle (fully up or fully down) they land with a thud: a burst of
   * rubble and dust all along the doorway, and a bump of the camera if this screen's hero is near.
   */
  stoneFx(dr, world, prev, now) {
    const H = this.height;
    const along = (u) => (dr.ns ? { x: dr.x + vrand(-8, 8), y: lerp(dr.a, dr.b, u) } : { x: lerp(dr.a, dr.b, u), y: dr.y + vrand(-2, 4) });
    const ROCK = ['#9a845e', '#7a6648', '#5a4a34', '#bca47a'];
    if (prev !== now) {
      const top = H * (1 - (now * now * (3 - 2 * now)));
      for (let i = 0; i < 3; i++) {
        const p = along(vrand(0, 1));
        // rock chips spraying out of the slot; grit and chunks tumbling off the tops of the pillars
        world.effects.burst(p.x, p.y + 6, { count: 2, colors: ROCK, speed: [30, 110], life: [0.3, 0.7], up: 90, gravity: 380, size: [2, 4] });
        if (top > 8 && vrand(0, 1) < 0.5) world.effects.burst(p.x, p.y + 6 - top, { count: 1, colors: ROCK, speed: [10, 40], life: [0.4, 0.8], gravity: 420, size: [2, 3] });
      }
      if (vrand(0, 1) < 0.3) {
        const p = along(vrand(0, 1));
        world.effects.smoke(p.x, p.y + 6, { count: 2, radius: 10, life: 0.8, rise: 10, colors: ['#5a4a34', '#7a6648', '#9a845e'] });
      }
      if (vrand(0, 1) < 0.5) {
        const p = along(vrand(0, 1));
        world.effects.burst(p.x, p.y + 4, { count: 1, colors: ['#5cf0d8', '#b8fff0'], speed: [10, 30], life: [0.5, 0.9], up: 60, size: [1, 2] });
      }
    }
    const landed = (prev > 0 && now === 0) || (prev < 1 && now === 1);
    if (!landed) return;
    // the thud: rubble and dust bursting all along the doorway
    const steps = Math.max(3, Math.round((dr.b - dr.a) / 14));
    for (let i = 0; i <= steps; i++) {
      const p = along(i / steps);
      world.effects.burst(p.x, p.y + 6, { count: 4, colors: ROCK, speed: [40, 140], life: [0.3, 0.7], up: 70, gravity: 380, size: [2, 4] });
      world.effects.smoke(p.x, p.y + 6, { count: 1, radius: 12, life: 0.9, rise: 8, colors: ['#5a4a34', '#7a6648', '#9a845e'] });
    }
    const me = world.localPlayer;
    if (me && SwingDoors.distTo(dr, me.x, me.y) < 260) world.shake(now === 0 ? 3 : 2, 0.15);
  }

  drawLeaf(ctx, hx, hy, ex, ey) {
    const H = this.height;
    const wide = Math.abs(ex - hx);
    // face-on leaves are lit; leaves turned edge-on to us are in shade
    const lit = wide / Math.max(1, Math.hypot(ex - hx, ey - hy));
    const body = lit > 0.5 ? '#7a4e2c' : '#5e3a20';
    const quad = (pts, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(Math.round(pts[i][0]), Math.round(pts[i][1]));
      ctx.closePath();
      ctx.fill();
    };
    // a leaf seen almost edge-on still shows its thickness
    const t = wide < this.edge ? (this.edge - wide) / 2 : 0;
    const l = Math.min(hx, ex) - t;
    const r = Math.max(hx, ex) + t;
    const edgeOn = wide < this.edge;
    const pts = edgeOn
      ? [[l, Math.max(hy, ey)], [r, Math.max(hy, ey)], [r, Math.min(hy, ey) - H], [l, Math.min(hy, ey) - H]]
      : [[hx, hy], [ex, ey], [ex, ey - H], [hx, hy - H]];
    quad(pts, body);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
    for (let i = 1; i < 4; i++) ctx.lineTo(Math.round(pts[i][0]), Math.round(pts[i][1]));
    ctx.closePath();
    ctx.stroke();
    if (edgeOn) {
      // the oak slab seen side-on: a lit edge, plank lines and iron straps
      const top = Math.min(hy, ey) - H;
      const bottom = Math.max(hy, ey);
      const w = Math.round(r - l);
      if (w >= 6) {
        ctx.fillStyle = '#a8784a';
        ctx.fillRect(Math.round(l) + 1, Math.round(top) + 1, 1, Math.round(bottom - top) - 2);
        ctx.fillStyle = '#3e2716';
        ctx.fillRect(Math.round((l + r) / 2), Math.round(top) + 2, 1, Math.round(bottom - top) - 4);
        ctx.fillStyle = '#363a46';
        for (const v of [0.12, 0.45, 0.88]) ctx.fillRect(Math.round(l), Math.round(lerp(top, bottom, v)), w, 3);
      }
      return;
    }
    // planks
    ctx.strokeStyle = '#3e2716';
    ctx.lineWidth = 1;
    const planks = Math.max(4, Math.round(wide / 10));
    for (let i = 1; i < planks; i++) {
      const u = i / planks;
      const px = lerp(hx, ex, u);
      const py = lerp(hy, ey, u);
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, Math.round(py));
      ctx.lineTo(Math.round(px) + 0.5, Math.round(py - H));
      ctx.stroke();
    }
    // top edge highlight and two iron bands
    ctx.strokeStyle = '#a8784a';
    ctx.beginPath();
    ctx.moveTo(hx, hy - H + 0.5);
    ctx.lineTo(ex, ey - H + 0.5);
    ctx.stroke();
    ctx.strokeStyle = '#363a46';
    ctx.lineWidth = 2;
    for (const v of [0.22, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(hx, hy - H * v);
      ctx.lineTo(ex, ey - H * v);
      ctx.stroke();
    }
    // a ring pull near the free edge
    const rx = lerp(hx, ex, 0.82);
    const ry = lerp(hy, ey, 0.82) - H * 0.48;
    ctx.fillStyle = '#d4ac4c';
    ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 3, 3);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(rx), Math.round(ry), 1, 1);
  }

  /** A locked door: an iron bar across both leaves and a pulsing red seal where they meet. */
  drawBar(ctx, dr) {
    const H = this.height;
    const pulse = 0.6 + Math.sin(performance.now() / 180) * 0.25;
    const mid = (dr.a + dr.b) / 2;
    if (dr.ns) {
      // seen edge-on: iron straps along the doorway and the seal on its face
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(dr.x) - 4, Math.round(dr.a - H * 0.5) - 1, 8, Math.round(dr.b - dr.a) + 2);
      ctx.fillStyle = '#80869a';
      ctx.fillRect(Math.round(dr.x) - 3, Math.round(dr.a - H * 0.5), 6, Math.round(dr.b - dr.a));
      PFX.glow(ctx, dr.x, mid - H * 0.5, 16, '255, 70, 70', pulse * 0.6);
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(Math.round(dr.x) - 3, Math.round(mid - H * 0.5) - 3, 6, 6);
      return;
    }
    const y = Math.round(dr.y - H * 0.5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(dr.a) - 4, y - 4, Math.round(dr.b - dr.a) + 8, 8);
    ctx.fillStyle = '#80869a';
    ctx.fillRect(Math.round(dr.a) - 3, y - 3, Math.round(dr.b - dr.a) + 6, 6);
    ctx.fillStyle = '#c9d3dd';
    ctx.fillRect(Math.round(dr.a) - 3, y - 3, Math.round(dr.b - dr.a) + 6, 1);
    // the seal: a red rune lock where the leaves meet
    PFX.glow(ctx, mid, y, 20, '255, 70, 70', pulse * 0.7);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(mid) - 7, y - 8, 14, 16);
    ctx.fillStyle = '#7a1e24';
    ctx.fillRect(Math.round(mid) - 6, y - 7, 12, 14);
    ctx.fillStyle = `rgba(255, 110, 90, ${pulse})`;
    ctx.fillRect(Math.round(mid) - 1, y - 5, 2, 10);
    ctx.fillRect(Math.round(mid) - 4, y - 1, 8, 2);
  }

  /**
   * A wrought-iron gate leaf: spear-tipped bars of uneven height between three
   * rails, a scroll in the upper panel, rust creeping along the iron. You can see
   * straight through it. Seen side-on it's a spiked iron post.
   */
  drawGate(ctx, hx, hy, ex, ey) {
    const H = this.height;
    const wide = Math.abs(ex - hx);
    const IRON = '#34323e';
    const IRON_L = '#706e80';
    const RUST = '#7a4630';
    const seg = (x0, y0, x1, y1, w, col) => {
      ctx.beginPath();
      ctx.moveTo(Math.round(x0), Math.round(y0));
      ctx.lineTo(Math.round(x1), Math.round(y1));
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = w + 2;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const tip = (x, y) => {
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(Math.round(x), Math.round(y) - 7);
      ctx.lineTo(Math.round(x) + 3, Math.round(y) - 1);
      ctx.lineTo(Math.round(x) - 3, Math.round(y) - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = IRON_L;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 5, 2, 4);
    };
    if (wide < this.edge) {
      // side-on: a stout iron post bristling with the bar tips
      const top = Math.min(hy, ey) - H;
      const bottom = Math.max(hy, ey);
      const x = Math.round((hx + ex) / 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 3, Math.round(top) - 1, 6, Math.round(bottom - top) + 2);
      ctx.fillStyle = IRON;
      ctx.fillRect(x - 2, Math.round(top), 4, Math.round(bottom - top));
      ctx.fillStyle = IRON_L;
      ctx.fillRect(x - 2, Math.round(top), 1, Math.round(bottom - top));
      for (let yy = top + 6; yy < bottom - 4; yy += 9) {
        ctx.fillStyle = (yy | 0) % 3 ? IRON_L : RUST;
        ctx.fillRect(x - 3, Math.round(yy), 6, 2);
      }
      tip(x, top);
      return;
    }
    const at = (u, v) => [lerp(hx, ex, u), lerp(hy, ey, u) - H * v];
    const len = Math.hypot(ex - hx, ey - hy);
    const n = Math.max(4, Math.round(len / 9));
    // bars, every other one a little taller, each with a spear tip
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const h = i === 0 ? 1.08 : i % 2 ? 0.96 : 1.04;
      const [bx, by] = at(u, 0);
      const [tx, ty] = at(u, h);
      seg(bx, by, tx, ty, i === 0 ? 3 : 2, i % 3 === 1 ? RUST : IRON);
      tip(tx, ty);
    }
    // rails
    for (const v of [0.06, 0.5, 0.86]) {
      const [x0, y0] = at(0, v);
      const [x1, y1] = at(1, v);
      seg(x0, y0, x1, y1, 2, IRON);
      ctx.strokeStyle = IRON_L;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x0), Math.round(y0) - 1);
      ctx.lineTo(Math.round(x1), Math.round(y1) - 1);
      ctx.stroke();
    }
    // a scroll curling in the upper panel
    const [sx, sy] = at(0.5, 0.68);
    const squash = Math.max(0.15, wide / Math.max(1, len));
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6 * squash, 6, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = IRON_L;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** A locked gate: chains wound across it and a heavy padlock whose keyhole glows a ghostly green. */
  drawChains(ctx, dr) {
    const H = this.height;
    const pulse = 0.6 + Math.sin(performance.now() / 220) * 0.3;
    const link = (x, y, upright) => {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(x) - (upright ? 2 : 3), Math.round(y) - (upright ? 3 : 2), upright ? 5 : 7, upright ? 7 : 5);
      ctx.fillStyle = '#9a98a8';
      ctx.fillRect(Math.round(x) - (upright ? 1 : 2), Math.round(y) - (upright ? 2 : 1), upright ? 3 : 5, upright ? 5 : 3);
      ctx.fillStyle = '#4a4856';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    let lx;
    let ly;
    if (dr.ns) {
      // side-on: chain wound down the post
      lx = dr.x;
      ly = (dr.a + dr.b) / 2 - H * 0.5;
      for (let y = dr.a - H * 0.6; y < dr.b - H * 0.2; y += 5) link(dr.x + ((y / 5) % 2 ? 1 : -1), y, true);
    } else {
      // two chains slung across the gate in a sag, meeting at the padlock
      const mid = (dr.a + dr.b) / 2;
      lx = mid;
      ly = dr.y - H * 0.42;
      for (const [from, to] of [[dr.a + 6, mid], [mid, dr.b - 6]]) {
        const steps = Math.max(4, Math.round(Math.abs(to - from) / 6));
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const x = lerp(from, to, u);
          const sag = Math.sin(u * Math.PI) * 6;
          link(x, dr.y - H * 0.55 + (Math.abs(x - mid) / ((dr.b - dr.a) / 2)) * -4 + sag, i % 2 === 0);
        }
      }
    }
    // the padlock
    const x = Math.round(lx);
    const y = Math.round(ly);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y, 18, '120, 255, 170', pulse * 0.6, 1);
    ctx.restore();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 6, 4, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = '#9a98a8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 7, y - 6, 14, 13);
    ctx.fillStyle = '#5a5868';
    ctx.fillRect(x - 6, y - 5, 12, 11);
    ctx.fillStyle = '#8a889a';
    ctx.fillRect(x - 6, y - 5, 12, 2);
    ctx.fillStyle = '#3a3846';
    ctx.fillRect(x - 6, y + 4, 12, 2);
    ctx.fillStyle = `rgba(150, 255, 190, ${pulse})`;
    ctx.fillRect(x - 1, y - 2, 2, 2);
    ctx.fillRect(x - 0.5, y, 1, 3);
  }
}
