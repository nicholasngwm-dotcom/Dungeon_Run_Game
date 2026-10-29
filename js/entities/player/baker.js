// Baker: LMB throw a cake (it splats in a gooey burst of frosting), RMB a sack of
// flour that bursts into a poofy cloud and confuses enemies, E arms her next throw
// to toss pastries for the team (heal + sugar rush), F an oven that stops enemy
// shots (and blows up in fire and food when it breaks), Q a massive cake dropped
// from the sky. Passive (Sticky Icing): her splats leave icing that slows enemies.

const PASTRY_KINDS = ['shortcake', 'pancakes', 'macarons', 'crepe', 'creamPuff', 'donut', 'cupcake', 'cinnamonRoll'];
const FLOUR = ['rgba(250, 246, 238, ', 'rgba(236, 228, 214, ', 'rgba(255, 255, 255, '];   // + alpha

/**
 * A gooey splat of frosting at (x, y) (visual only): globs flung out that fall and stick,
 * stringy drips, and a glossy blob left on the floor for `stay`s. colors = [frosting, sponge, shine].
 */
function cakeSplatFx(world, x, y, r, colors, stay = 4) {
  const [frost, sponge, shine] = colors;
  const e = world.effects;
  // the blob on the floor: an irregular puddle of overlapping drops with a shine, fading out
  const blobs = Array.from({ length: 7 }, () => [vrand(-0.7, 0.7) * r, vrand(-0.35, 0.35) * r, vrand(0.3, 0.55) * r]);
  const flecks = Array.from({ length: 9 }, () => [vrand(-1.3, 1.3) * r, vrand(-0.7, 0.7) * r, vrand(2, 4)]);
  e.add(stay, (ctx, t) => {
    const k = t < 0.8 ? 1 : (1 - t) / 0.2;
    const grow = Math.min(1, t * stay * 8);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    for (const [bx, by, br] of blobs) PFX.disc(ctx, x + bx * grow, y + by * grow, br * grow, br * 0.55 * grow, frost, 2);
    for (const [fx, fy, fr] of flecks) PFX.disc(ctx, x + fx * grow, y + fy * grow, fr, fr * 0.6, frost, 2);
    ctx.globalAlpha = 0.6 * k;
    PFX.disc(ctx, x - r * 0.2, y - r * 0.1, r * 0.25, r * 0.1, shine, 2);
    ctx.restore();
  }, true);
  // globs flung up that drop back down, and stringy drips
  e.add(0.6, (ctx, t) => {
    ctx.save();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + i;
      const d = r * (0.4 + (i % 3) * 0.3) * Math.min(1, t * 3);
      const gx = x + Math.cos(a) * d;
      const gy = y + Math.sin(a) * d * 0.5 - Math.sin(Math.min(1, t * 1.6) * Math.PI) * (16 + (i % 4) * 6);
      const s = i % 3 ? 3 : 4;
      ctx.globalAlpha = 1 - t * 0.5;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(gx) - s, Math.round(gy) - s, s * 2 + 1, s * 2 + 1);
      ctx.fillStyle = i % 4 ? frost : sponge;
      ctx.fillRect(Math.round(gx) - s + 1, Math.round(gy) - s + 1, s * 2 - 1, s * 2 - 1);
      ctx.fillStyle = shine;
      ctx.fillRect(Math.round(gx) - s + 1, Math.round(gy) - s + 1, 1, 1);
      // a sticky string trailing under it
      if (i % 2) { ctx.fillStyle = frost; ctx.fillRect(Math.round(gx), Math.round(gy) + s, 1, Math.round(6 * t)); }
    }
    ctx.restore();
  });
  e.burst(x, y - 8, { count: 14, colors: [frost, sponge, shine], speed: [60, 180], life: [0.25, 0.5], up: 60, gravity: 400, size: [2, 4] });
}

/** A great soft cloud of flour hanging at (x, y) for `life`s (visual only): see-through, puffing and drifting. */
function flourCloudFx(world, x, y, r, life) {
  const puffs = Array.from({ length: 16 }, (_, i) => ({
    a: (i / 16) * TAU + vrand(-0.3, 0.3), d: vrand(0.1, 0.85) * r, s: vrand(0.35, 0.6) * r, ph: vrand(0, TAU), c: i % 3,
  }));
  world.effects.add(life, (ctx, t) => {
    const k = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
    ctx.save();
    for (const p of puffs) {
      const swell = 0.75 + Math.min(1, t * 6) * 0.25 + Math.sin(t * life * 2 + p.ph) * 0.06;
      const px = x + Math.cos(p.a) * p.d * swell + Math.sin(t * life + p.ph) * 4;
      const py = y - 14 + Math.sin(p.a) * p.d * 0.55 * swell - t * 10;
      const s = p.s * swell;
      // soft round puffs: a faint outer halo, a fuller middle, a bright top
      ctx.fillStyle = `${FLOUR[p.c]}${0.18 * k})`;
      ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
      ctx.fillStyle = `${FLOUR[p.c]}${0.22 * k})`;
      ctx.beginPath(); ctx.arc(px, py - s * 0.15, s * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = `${FLOUR[2]}${0.2 * k})`;
      ctx.beginPath(); ctx.arc(px - s * 0.25, py - s * 0.35, s * 0.35, 0, TAU); ctx.fill();
    }
    ctx.restore();
  });
}

class Baker extends Player {
  constructor(x, y) {
    super('baker', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.rollingPin;
    this.maxCooldowns = {
      primary: c.cake.cooldown, secondary: c.flour.cooldown, e: c.pastries.cooldown,
      f: c.oven.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'CAKE', secondary: 'FLOUR', e: 'PASTRIES', f: 'OVEN', q: 'MEGA CAKE' };
    this.throwAnim = 0;
    this.pastriesReady = false;  // E pressed: the next LMB throws pastries
    this.icing = [];             // sticky icing on the floor: { x, y, t }
    this.lobs = [];              // cakes in the air: { x0, y0, x1, y1, t, time, height, flavour, spin }
    this.clouds = [];            // flour clouds: { x, y, t }
    this.megaCakes = [];         // giant cakes: { x, y, t, landed }
    this.oven = null;
  }

  aimPoint(maxRange) {
    const m = this.cursor;
    const d = Math.min(dist(this.x, this.y, m.x, m.y), maxRange);
    const a = angleTo(this.x, this.y, m.x, m.y);
    return { x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d };
  }

  get handX() { return this.pivotX + Math.cos(this.aim) * 14; }
  get handY() { return this.pivotY + Math.sin(this.aim) * 10; }

  /** The pastries slot glows while her next throw is armed. */
  slotHeld(slot) { return slot === 'e' && this.pastriesReady; }

  // ---------- LMB: cake (or the armed pastries) ----------

  /**
   * Where a cake lobbed at the cursor comes down: at the cursor, at most `range` away. It flies
   * over walls and obstacles alike; only its landing spot has to be clear of walls and shut doors.
   */
  lobTarget(world) {
    const c = this.cfg.cake;
    const to = this.aimPoint(c.range);
    const a = angleTo(this.x, this.y, to.x, to.y);
    // it flies high over everything; it just can't come down inside a wall or a shut door,
    // so a cursor on one pulls the landing back toward her until it's clear (obstacles are fine to splat on)
    let reach = dist(this.x, this.y, to.x, to.y);
    while (reach > 0 && world.dungeon.boxHitsWall(this.x + Math.cos(a) * reach, this.y + Math.sin(a) * reach, 4, 4, true)) reach -= 4;
    reach = Math.max(0, reach);
    return { x: this.x + Math.cos(a) * reach, y: this.y + Math.sin(a) * reach };
  }

  /** LMB: a cake lobbed high in an arc onto the cursor. */
  primary(world) {
    if (this.pastriesReady) return this.throwPastries(world);
    const c = this.cfg.cake;
    this.cooldowns.primary = c.cooldown;
    this.throwAnim = 0.15;
    const to = this.lobTarget(world);
    const d = dist(this.handX, this.handY, to.x, to.y);
    const lob = {
      x0: this.handX, y0: this.handY, x1: to.x, y1: to.y, t: 0, time: c.flightTime + d / c.speed,
      height: 30 + d * 0.3, flavour: Math.floor(Math.random() * Sprites.projectiles.cakes.length), spin: this.facing,
      big: Upgrades.has(this, 'biggerCakes'),
    };
    // Bigger Cakes: every 5th cake is an iced one
    if (lob.big) lob.iced = ++Upgrades.state(this).cakes % 5 === 0;
    this.lobs.push(lob);
    // drawn over everyone while it's up in the air
    world.effects.add(lob.time, (ctx) => this.drawLob(ctx, lob));
    Sound.play('cakeThrow', 0.04);
  }

  updateLobs(dt, world) {
    for (const lob of this.lobs) {
      lob.t += dt;
      if (lob.t < lob.time) continue;
      lob.dead = true;
      this.splat(world, lob.x1, lob.y1, lob.flavour, lob);
    }
    removeDead(this.lobs);
  }

  /** A lobbed cake in flight: big enough to see, turning over as it arcs, its shadow sliding along the floor under it. */
  drawLob(ctx, lob) {
    const c = this.cfg.cake;
    const k = clamp(lob.t / lob.time, 0, 1);
    const gx = lerp(lob.x0, lob.x1, k);
    const gy = lerp(lob.y0, lob.y1, k);
    drawShadow(ctx, gx, gy + 4, 7 + 3 * k, 3, 0.18 + 0.2 * k);
    const img = Sprites.projectiles.cakes[lob.flavour];
    ctx.save();
    ctx.translate(gx, gy - Math.sin(k * Math.PI) * lob.height - 6);
    const s = c.scale * (lob.big ? 1.35 : 1);
    ctx.scale(s, s);
    drawRotated(ctx, img, 0, 0, img.width / 2, img.height / 2, k * TAU * 0.75 * lob.spin);
    if (lob.iced) {
      // the iced cake: a white glow round it in flight
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, 0, 0, 10, '255, 230, 245', 0.8);
    }
    ctx.restore();
  }

  /**
   * The cake comes down: whoever it lands right on takes the full hit, the rest of the
   * splat a little; a gooey burst of frosting and a patch of sticky icing.
   */
  splat(world, x, y, flavour, lob = {}) {
    const c = this.cfg.cake;
    const grow = lob.big ? 1.45 : 1;   // Bigger Cakes
    const direct = new Set(this.hitCircle(world, x, y - 8, c.hitRadius * grow, c.damage, { knockback: 90, sound: null }));
    const splashed = this.hitCircle(world, x, y - 8, c.radius * grow, c.splash, { knockback: 40, sound: null, exclude: direct });
    cakeSplatFx(world, x, y + 4, c.radius * 0.7 * grow, Sprites.cakeSplats[flavour], this.cfg.passive.time);
    this.icing.push({ x, y: y + 4, t: 0, grow });
    if (lob.iced) {
      // every 5th: everything it splashed is coated in icing (slowed for 3s)
      for (const t of [...direct, ...splashed]) {
        if (t.dead) continue;
        t.iced = 3;
        world.effects.text(t.hx, t.hy - 34, 'ICED', { color: '#ffe0f0', size: 7 });
      }
      Upgrades.proc(this, world, 'biggerCakes');
      world.effects.burst(x, y - 6, { count: 20, colors: ['#ffffff', '#ffe0f0', '#ff8ad0'], speed: [60, 180], life: [0.3, 0.6], up: 50 });
    }
    Sound.play('cakeSplat', 0.04);
  }

  /** Passive (Sticky Icing): enemies standing in her icing are slowed. */
  updateIcing(dt, world) {
    const c = this.cfg.passive;
    for (const s of this.icing) {
      s.t += dt;
      if (s.t >= c.time) { s.dead = true; continue; }
      for (const e of world.enemies) {
        if (Math.hypot(e.x - s.x, (e.y - s.y) / 0.55) < (s.big ? this.cfg.ult.radius * 0.8 : c.radius * (s.grow || 1)) + e.radius * 0.5) e.sticky = 0.2;
      }
    }
    removeDead(this.icing);
  }

  // ---------- RMB: flour ----------

  secondary(world) {
    const c = this.cfg.flour;
    this.cooldowns.secondary = c.cooldown;
    this.throwAnim = 0.2;
    const to = this.aimPoint(c.maxRange);
    const a = angleTo(this.handX, this.handY, to.x, to.y);
    const life = Math.max(0.15, dist(this.handX, this.handY, to.x, to.y) / c.speed);
    world.playerProjectiles.push(new Projectile({
      x: this.handX, y: this.handY, vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
      radius: 7, damage: c.damage, life, knockback: 30, spin: 7, sprite: Sprites.projectiles.flourSack, scale: 1.7,
      // a little trail of flour dust behind the sack
      fx: (p, dt, w) => { if (vrand(0, 1) < dt * 30) w.effects.burst(p.x, p.y, { count: 1, colors: ['#f4f0e8', '#ffffff'], speed: [5, 20], life: [0.3, 0.6], size: [2, 3] }); },
      onHit: (p, w) => this.flourBurst(w, p.x, p.y),
    }));
    Sound.play('cakeThrow', 0.04);
  }

  /** The sack bursts into a cloud: everyone in it is confused for as long as it hangs there (and a bit after). */
  flourBurst(world, x, y) {
    const c = this.cfg.flour;
    this.clouds.push({ x, y, t: 0 });
    flourCloudFx(world, x, y, c.radius, c.cloudTime);
    world.effects.burst(x, y - 10, { count: 26, colors: ['#ffffff', '#f4f0e8', '#ece4d6'], speed: [40, 180], life: [0.4, 0.9], up: 30, size: [2, 4] });
    for (const e of world.enemies) if (dist(e.x, e.y, x, y) < c.radius + e.radius) e.confuse?.(c.confuse, world);
    Sound.play('flourPoof');
  }

  updateClouds(dt, world) {
    const c = this.cfg.flour;
    for (const f of this.clouds) {
      f.t += dt;
      if (f.t >= c.cloudTime) { f.dead = true; continue; }
      // walking into the cloud while it hangs confuses too
      for (const e of world.enemies) {
        if (!(e.confused > 0) && dist(e.x, e.y, f.x, f.y) < c.radius * 0.85 + e.radius) e.confuse?.(c.confuse, world);
      }
    }
    removeDead(this.clouds);
  }

  // ---------- E: pastries for the team ----------

  abilityE(world) {
    this.pastriesReady = true;
    this.cooldowns.primary = 0;
    world.effects.text(this.hx, this.hy - 34, 'PASTRIES READY', { color: '#ff8ad0', size: 7 });
    Sound.play('pastryReady');
  }

  /** E: while her pastries are armed, E again doesn't start the cooldown over. */
  tryAbility(slot, world, fn) {
    if (slot === 'e' && this.pastriesReady) return;
    super.tryAbility(slot, world, fn);
  }

  /** Her armed throw: `count` pastries tossed round the cursor, landing as treats for anyone to eat. */
  throwPastries(world) {
    const c = this.cfg.pastries;
    this.pastriesReady = false;
    this.cooldowns.e = c.cooldown;
    this.cooldowns.primary = this.cfg.cake.cooldown;
    this.throwAnim = 0.25;
    const at = this.aimPoint(260);
    const kinds = PASTRY_KINDS.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < c.count; i++) {
      const a = (i / c.count) * TAU + rand(-0.3, 0.3);
      const d = c.spread * rand(0.6, 1);   // well apart, so they're spread round the area
      const pt = world.dungeon.freePoint(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d * 0.7, 6, 6);
      world.pickups.push(new PastryPickup(this.handX, this.handY, pt.x, pt.y, kinds[i % kinds.length], this.pastryOpts({ heal: c.heal, life: c.life, flightTime: c.flightTime + i * 0.06 })));
    }
    Sound.play('pastryToss');
  }

  /** Premium Baking Goods: her pastries heal 35 and their sugar rushes stack (up to 3). */
  pastryOpts(o) {
    return Upgrades.has(this, 'premiumBaking') ? { ...o, heal: 35, premium: true } : o;
  }

  // ---------- F: the oven ----------

  abilityF(world) {
    const c = this.cfg.oven;
    this.cooldowns.f = c.cooldown;
    if (this.oven && !this.oven.dead) this.oven.vanish(world);   // one oven at a time
    const a = this.aim;
    const spot = world.dungeon.freePoint(this.x + Math.cos(a) * c.distance, this.y + Math.sin(a) * c.distance * 0.8, 16, 10);
    this.oven = new BakerOven(this, spot.x, spot.y);
    world.barriers.push(this.oven);
    world.effects.smoke(spot.x, spot.y, { count: 6, radius: 16, life: 0.6, rise: 12, colors: ['#e8e4dc', '#c8c4bc', '#f4f0ea'] });
    world.effects.burst(spot.x, spot.y - 20, { count: 14, colors: ['#7ac0a8', '#ffd34a', '#ffffff'], speed: [40, 140], life: [0.3, 0.5], up: 40 });
    Sound.play('ovenPlace');
  }

  // ---------- Q: the massive cake ----------

  ultimate(world) {
    const c = this.cfg.ult;
    const at = this.aimPoint(c.maxRange);
    const m = { x: at.x, y: at.y, t: 0, landed: false };
    this.megaCakes.push(m);
    // drawn over everyone (it's coming down from the sky, and it's huge)
    world.effects.add(c.fall + c.stay, (ctx) => this.drawMegaCake(ctx, m));
    world.effects.text(this.hx, this.hy - 40, 'ORDER UP!', { color: '#ff8ad0', size: 10 });
    Sound.play('megaCakeFall');
  }

  updateMegaCakes(dt, world) {
    const c = this.cfg.ult;
    for (const m of this.megaCakes) {
      m.t += dt;
      if (!m.landed && m.t >= c.fall) {
        m.landed = true;
        // SQUASH: everything under it is flattened, the floor shakes, frosting everywhere
        const hit = this.hitCircle(world, m.x, m.y, c.radius, c.damage, { knockback: 0, stun: c.stun, fromUlt: true, sound: 'crit' });
        for (const t of hit) if (t instanceof Enemy) t.squash = c.stun;
        cakeSplatFx(world, m.x, m.y + 4, c.radius * 0.9, Sprites.cakeSplats[0], c.stay + 4);
        this.icing.push({ x: m.x, y: m.y + 4, t: -c.stay, big: true });
        world.effects.smoke(m.x, m.y, { count: 14, radius: c.radius * 0.6, life: 1, rise: 20, colors: ['#f4ecf0', '#ffc0d4', '#ffffff'] });
        world.effects.burst(m.x, m.y - 30, { count: 50, colors: ['#ff8aae', '#ffffff', '#f08aa0', '#c82a3a'], speed: [120, 360], life: [0.4, 0.9], up: 100, gravity: 500, size: [2, 5] });
        world.effects.text(m.x, m.y - 150, 'SQUASH!', { color: '#ff8ad0', size: 14, life: 1.2 });
        world.shake(12, 0.6);
        Sound.play('megaCakeSlam');
      }
      if (m.t >= c.fall + c.stay) m.dead = true;
    }
    removeDead(this.megaCakes);
  }

  // ---------- passive ----------

  get passiveInfo() {
    const n = this.icing.length;
    return {
      name: 'STICKY ICING', color: '#ff8ad0', ready: n > 0,
      text: this.pastriesReady ? 'PASTRIES READY' : n ? `${n} SPLAT${n > 1 ? 'S' : ''}` : 'SPLAT CAKES TO SLOW',
    };
  }

  // ---------- update & drawing ----------

  updateAbility(dt, world) {
    this.world = world;
    this.throwAnim -= dt;
    this.updateLobs(dt, world);
    this.updateIcing(dt, world);
    this.updateClouds(dt, world);
    this.updateMegaCakes(dt, world);
    if (this.oven && this.oven.dead) this.oven = null;
  }

  /** Ability outlines while a key is held: the giant cake's landing zone. */
  abilityPreview(slot) {
    if (slot === 'secondary') {   // (shown while the touch button is held) the flour sack's flight and its cloud
      const c = this.cfg.flour;
      const to = this.aimPoint(c.maxRange);
      return { blast: { fromX: this.handX, fromY: this.handY, x: to.x, y: to.y, r: c.radius, rgb: '244, 240, 232' } };
    }
    if (slot === 'q') {
      const pt = this.aimPoint(this.cfg.ult.maxRange);
      return { circle: { x: pt.x, y: pt.y, r: this.cfg.ult.radius, sy: 0.55 } };
    }
    if (slot === 'f') {
      const c = this.cfg.oven;
      return { circle: { x: this.x + Math.cos(this.aim) * c.distance, y: this.y + Math.sin(this.aim) * c.distance * 0.8, r: c.radius + 6, sy: 0.5 } };
    }
    return null;
  }

  drawGroundExtras(ctx) {
    // the oven's pull: a ring on the floor showing how close enemies have to be before they go for it
    const o = this.oven;
    if (o && !o.dead) {
      const r = o.cfg.taunt;
      const pulse = 0.45 + Math.sin(this.animTime * 4) * 0.15;
      PFX.disc(ctx, o.x, o.y, r, r * 0.55, 'rgba(255, 140, 190, 0.06)', 3);
      PFX.ring(ctx, o.x, o.y, r, r * 0.55, `rgba(255, 140, 190, ${pulse})`, 2, { dash: [4, 3], spin: -this.animTime * 0.6 });
    }
    // where her next cake will land (only on her own screen, and not while pastries are armed)
    if (this.isLocal && this.world && !this.pastriesReady && !this.dead) {
      const to = this.lobTarget(this.world);
      PFX.ring(ctx, to.x, to.y, 12, 6, 'rgba(255, 200, 220, 0.55)', 2, { dash: [2, 2], spin: this.animTime * 2 });
    }
    const c = this.cfg.ult;
    for (const m of this.megaCakes) {
      if (m.landed) continue;
      // the shadow of the cake grows as it falls, inside a warning ring
      const k = m.t / c.fall;
      PFX.zone(ctx, m.x, m.y, c.radius, k, '255, 120, 170', { sy: 0.55, spin: m.t * 2 });
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.4;
      PFX.disc(ctx, m.x, m.y, c.radius * (0.3 + k * 0.6), c.radius * 0.5 * (0.3 + k * 0.6), '#2a1a28', 3);
      ctx.restore();
    }
  }

  /** The giant cake: falling from the sky, then standing there wobbling before it melts away. */
  drawMegaCake(ctx, m) {
    const c = this.cfg.ult;
    const img = Sprites.items.megaCake;
    let y = m.y;
    let sx = 1;
    let sy = 1;
    let alpha = 1;
    if (!m.landed) {
      const k = m.t / c.fall;
      y = m.y - (1 - k * k) * 520;
    } else {
      const t = m.t - c.fall;
      const wob = Math.exp(-t * 5) * Math.sin(t * 30) * 0.12;   // the squash and jiggle of landing
      sx = 1 + wob;
      sy = 1 - wob;
      if (t > c.stay - 0.6) { alpha = (c.stay - t) / 0.6; sy *= 0.6 + alpha * 0.4; }   // melting down
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(Math.round(m.x), Math.round(y));
    ctx.scale(sx, sy);
    ctx.drawImage(img, -Math.round(img.width / 2), -img.height + 6);
    ctx.restore();
  }

  get weaponReach() { return this.throwAnim > 0 ? 4 : 9; }

  /** The rolling pin swings forward as she throws. */
  weaponAngle() {
    const swing = this.throwAnim > 0 ? (this.throwAnim / 0.15) * 1.4 : 0;
    return this.aim - (0.6 - swing) * this.facing;
  }
}

/**
 * The Baker's oven: a little mint-enamel oven set down on the floor. It's a barrier
 * (world.barriers), so enemy shots that reach it are soaked by it, and an ally that
 * enemies within `taunt` px go after first. When its hp runs out, or its `life`s fuse
 * burns down, it blows up: a blast, fire everywhere (heroFireZone) and pastries flung
 * out in all directions.
 */
class BakerOven {
  constructor(owner, x, y) {
    this.owner = owner;
    this.cfg = owner.cfg.oven;
    this.x = x;
    this.y = y;
    this.hp = this.cfg.hp;
    this.t = 0;
    this.flash = 0;
    this.dead = false;
    this.ally = true;              // enemies can hit it (world.allies)...
    this.taunt = this.cfg.taunt;   // ...and the ones this close go for it first (Game.targetFor)
    this.radius = this.cfg.radius;
    this.invuln = 0;
  }

  get hx() { return this.x; }
  get hy() { return this.y - 22; }

  /** Melee blows and bodies bumping it (shots go through absorb). A short grace between hits. */
  hurt(amount, world, fromX, fromY) {
    if (this.dead || this.invuln > 0) return false;
    this.invuln = 0.3;
    this.absorb(amount, world, fromX, fromY);
    return true;
  }
  get raised() { return true; }

  touches(x, y, r) { return dist(x, y, this.x, this.hy) <= r + this.cfg.radius; }

  crossesSegment(x1, y1, x2, y2) { return pointSegmentDistance(this.x, this.hy, x1, y1, x2, y2) <= this.cfg.radius; }

  absorb(amount, world, x, y) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 0.12;
    world.effects.burst(x ?? this.x, y ?? this.hy, { count: 8, colors: ['#7ac0a8', '#ffd34a', '#ffffff'], speed: [60, 160], life: [0.15, 0.3] });
    Sound.play('ovenHit', 0.05);
    if (this.hp <= 0) this.explode(world);
  }

  /** FIRE EVERYWHERE AND FOOD. */
  explode(world) {
    const c = this.cfg;
    const o = this.owner;
    this.dead = true;
    world.setActor(o);
    o.hitCircle(world, this.x, this.y, c.blastRadius, c.damage, { knockback: 240, sound: 'hit' });
    world.setActor(null);
    heroFireZone(world, o, this.x, this.y, { r: c.fireRadius, life: c.fireTime, dps: c.fireDps, burnDps: c.burnDps, burnTime: c.burnTime });
    rocketBlastFx(world, this.x, this.y, c.blastRadius * 0.8);
    // the oven's door flies open and out comes everything it was baking
    const P = o.cfg.pastries;
    for (let i = 0; i < c.food; i++) {
      const a = (i / c.food) * TAU + rand(-0.4, 0.4);
      const pt = world.dungeon.freePoint(this.x + Math.cos(a) * rand(60, 110), this.y + Math.sin(a) * rand(40, 80), 6, 6);
      world.pickups.push(new PastryPickup(this.x, this.hy, pt.x, pt.y, choose(PASTRY_KINDS), this.owner.pastryOpts({ heal: P.heal, life: P.life, flightTime: 0.6 + i * 0.08 })));
    }
    for (let i = 0; i < 6; i++) {
      world.effects.burst(this.x, this.hy, { count: 3, colors: ['#4a8a7a', '#7ac0a8', '#383b48'], speed: [100, 300], life: [0.4, 0.9], up: 120, gravity: 500, size: [3, 5] });
    }
    world.effects.text(this.x, this.y - 70, 'KABOOM!', { color: '#ffd34a', size: 12, life: 1.2 });
    world.shake(9, 0.5);
    Sound.play('ovenBoom');
  }

  /** Gone quietly (its baker fell, or put down a new oven): a puff and a ding. */
  vanish(world) {
    this.dead = true;
    world.effects.smoke(this.x, this.y - 10, { count: 6, radius: 14, life: 0.6, rise: 16, colors: ['#e8e4dc', '#c8c4bc', '#f4f0ea'] });
    Sound.play('ovenDing');
  }

  update(dt, world) {
    this.t += dt;
    this.flash -= dt;
    this.invuln -= dt;
    if (!world) return;
    if (this.owner.dead) return this.vanish(world);
    // its timer runs out: it blows up all the same
    if (this.t >= this.cfg.life) return this.explode(world);
    if (Math.floor(this.t) !== Math.floor(this.t - dt)) Sound.play('ovenTick');
    // steam from the stovepipe, hotter (and smoking black) as it takes damage
    if (vrand(0, 1) < dt * 6) {
      const hurt = 1 - this.hp / this.cfg.hp;
      world.effects.burst(this.x + 10, this.y - 50, { count: 1, colors: hurt > 0.6 ? ['#3a3430', '#5a524a'] : ['#f4f0ea', '#d8d4cc'], speed: [5, 15], life: [0.6, 1], up: 30, size: [2, 4] });
    }
  }

  draw(ctx) {
    const img = Sprites.items.oven;
    const hurt = 1 - clamp(this.hp / this.cfg.hp, 0, 1);
    const pop = Math.max(0, 1 - this.t / 0.2);   // it thumps down with a little bounce
    const shake = hurt > 0.5 ? Math.round(Math.sin(this.t * 50) * hurt * 2) : 0;
    const x = Math.round(this.x + shake);
    const y = Math.round(this.y);
    drawShadow(ctx, x, y + 2, 22, 5, 0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + pop * 0.2, 1 - pop * 0.2);
    ctx.drawImage(img, -Math.round(img.width / 2), -img.height + 2);
    // the window glowing: a warm bake, turning angry orange-red as it nears bursting
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.8 + Math.sin(this.t * 9) * 0.1;
    PFX.disc(ctx, 0, -18, 12, 5, `rgba(255, ${Math.round(200 - hurt * 120)}, ${Math.round(90 - hurt * 60)}, ${0.55 * flick})`, 2);
    PFX.glow(ctx, 0, -18, 22, hurt > 0.6 ? '255, 110, 40' : '255, 190, 90', (0.35 + hurt * 0.4) * flick);
    if (this.flash > 0) PFX.disc(ctx, 0, -24, 20, 18, 'rgba(255, 255, 255, 0.35)', 2);
    ctx.restore();
    // its fuse: seconds left, over a ring that runs down
    const left = Math.max(0, this.cfg.life - this.t);
    const fy = Math.round(this.y - 70);
    PFX.ring(ctx, this.x, fy, 9, 9, 'rgba(40, 24, 30, 0.7)', 2);
    PFX.ring(ctx, this.x, fy, 9, 9, left < 1.5 ? '#ff6a3a' : '#ffd34a', 2, { from: -Math.PI / 2, to: -Math.PI / 2 + TAU * (left / this.cfg.life) });
    HUD.text(ctx, `${Math.ceil(left)}`, this.x, fy - 5, { size: 8, align: 'center', color: left < 1.5 ? '#ff6a3a' : '#fff2c8' });
    // its hp bar
    const w = 34;
    const bx = Math.round(this.x - w / 2);
    const by = Math.round(this.y - 56);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 1, by - 1, w + 2, 5);
    ctx.fillStyle = hurt > 0.6 ? '#ff8a3a' : '#7ac0a8';
    ctx.fillRect(bx, by, Math.round(w * (1 - hurt)), 3);
  }
}
