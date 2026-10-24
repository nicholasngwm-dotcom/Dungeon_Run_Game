// Bard: plays one of two tunes for herself and every hero near her (RMB swaps
// them: Energetic speeds everyone up, Calming slowly heals). LMB strums three
// bobbing magic notes (each strum plays the next bars of the tune), E inspires
// the whole ensemble and makes her song swell, F plays a lullaby she can walk
// around with (enemies that hear it long enough fall asleep), and Q is
// Screeching Tuning: a wave of piercing notes that knocks back and weakens.

// pixel effect colours per tune, plus the lullaby's lavender and the screech's violet
const BARD_FX = {
  energetic: { rgb: '255, 150, 60', notes: ['#a8401e', '#ff8a3a', '#ffd38a'], label: 'ENERGETIC TUNE', color: '#ffb060' },
  calming: { rgb: '90, 200, 230', notes: ['#1e5a7a', '#5ac8e6', '#c8f4ff'], label: 'CALMING TUNE', color: '#8ce0f4' },
  sleep: '170, 150, 255',
  screech: ['#5a1a6a', '#b04ae0', '#f0c8ff', '#ffffff'],
  gold: '255, 211, 74',
};

class Bard extends Player {
  constructor(x, y) {
    super('bard', x, y);
    const c = this.cfg;
    this.weapon = Sprites.weapons.lute;
    this.maxCooldowns = {
      primary: c.strum.cooldown, secondary: c.tunes.cooldown, e: c.morale.cooldown,
      f: c.lullaby.cooldown, dodge: this.dodgeCooldown,
    };
    this.icons = { primary: 'STRUM', secondary: 'TUNE', e: 'INSPIRE', f: 'LULLABY', q: 'SCREECH' };
    this.tune = 'energetic';
    this.strumAnim = 0;
    this.songBoost = 0;     // seconds left of Inspire swelling her tune
    this.lullaby = null;    // playing the lullaby: { t }
  }

  // ---------- LMB: magical strumming ----------

  primary(world) {
    const c = this.cfg.strum;
    const song = this.cfg.tunes[this.tune];
    this.cooldowns.primary = c.cooldown / (1 + (song.attackSpeed || 0));   // she strums faster to the energetic tune
    this.strumAnim = 0.15;
    const tone = BARD_FX[this.tune];
    const speed = c.speed * (song.noteSpeed || 1);       // energetic notes fly faster, calming ones drift slower
    const damage = c.damage * (song.noteDamage || 1);    // calming notes hit softer
    const life = c.life * Math.max(1, 1 / (song.noteSpeed || 1));   // slow notes fly longer, so they reach as far
    const spread = c.spreadDegrees * DEG;
    for (let i = 0; i < c.count; i++) {
      const a = this.aim + (i - (c.count - 1) / 2) * spread;
      const phase = i * 2.1;
      world.playerProjectiles.push(new Projectile({
        x: this.pivotX + Math.cos(a) * 16, y: this.pivotY + Math.sin(a) * 16,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        radius: 7, damage, life, knockback: 70, upright: true,
        sprite: Sprites.projectiles.notes[this.tune][i % 2], glow: tone.rgb, trail: tone.notes.slice(1),
        // bob side to side along the flight like a melody
        homing: (p) => {
          const ang = a + Math.sin(p.age * 14 + phase) * c.wobble;
          p.vx = Math.cos(ang) * speed;
          p.vy = Math.sin(ang) * speed;
        },
        onStrike: (p, w, t) => noteHit(w, t.hx, t.hy, tone.notes),
      }));
    }
    world.effects.burst(this.pivotX + Math.cos(this.aim) * 14, this.pivotY + Math.sin(this.aim) * 14, { count: 5, colors: tone.notes, speed: [30, 90], life: [0.15, 0.3], angle: this.aim, spread: 1.2 });
    Bardsong.strum(this);
  }

  // ---------- RMB: switch tunes ----------

  secondary(world) {
    this.cooldowns.secondary = this.cfg.tunes.cooldown;
    this.tune = this.tune === 'energetic' ? 'calming' : 'energetic';
    const tone = BARD_FX[this.tune];
    world.effects.text(this.hx, this.hy - 34, tone.label, { color: tone.color, size: 8 });
    // a ring of the new tune's colour racing out to the edge of the ensemble
    const r = this.cfg.passive.radius;
    const { x, y } = this;
    world.effects.add(0.45, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, r * (0.2 + t * 0.8), r * (0.2 + t * 0.8), `rgb(${tone.rgb})`, 2, { thick: 2 });
      ctx.restore();
    }, true);
    world.effects.burst(this.hx, this.hy, { count: 14, colors: tone.notes, speed: [60, 160], life: [0.3, 0.5], up: 30 });
    Bardsong.flourish(this.tune);
  }

  /** The tune's strength right now (Inspire makes it swell). */
  get songSpeed() { return this.songBoost > 0 ? this.cfg.morale.boostSpeed : this.cfg.tunes.energetic.speed; }
  get songHeal() { return this.songBoost > 0 ? this.cfg.morale.boostHeal : this.cfg.tunes.calming.heal; }

  /** Passive (Ensemble): the tune plays for every living hero within reach, herself included. */
  playTune(dt, world) {
    const r = this.cfg.passive.radius;
    for (const a of world.heroes) {
      if (dist(a.x, a.y, this.x, this.y) > r) continue;
      if (this.tune === 'energetic') {
        a.tuneSpeed = 0.25;
        a.tuneSpeedAmount = this.songSpeed;
      } else {
        a.heal(this.songHeal * dt, world, true);
      }
      // a little note drifting up off everyone the tune reaches
      if (vrand(0, 1) < dt * (this.songBoost > 0 ? 4 : 1.5)) {
        world.effects.burst(a.x + vrand(-10, 10), a.y - vrand(10, 30), { count: 1, colors: BARD_FX[this.tune].notes.slice(1), speed: [5, 15], life: [0.5, 0.8], up: 30, size: [2, 3] });
      }
    }
  }

  // ---------- E: inspire (moral support for the whole ensemble) ----------

  abilityE(world) {
    const c = this.cfg.morale;
    const r = this.cfg.passive.radius;
    this.cooldowns.e = c.cooldown;
    this.songBoost = c.duration;
    for (const a of world.heroes) {
      if (dist(a.x, a.y, this.x, this.y) > r) continue;
      a.inspired = c.duration;
      Upgrades.warSong(this, a, world);
      world.effects.text(a.hx, a.hy - 36, 'INSPIRED!', { color: '#ffd34a', size: 8 });
      world.effects.burst(a.hx, a.hy, { count: 14, colors: ['#ffffff', '#fff2a0', '#ffd34a'], speed: [50, 150], life: [0.3, 0.6], up: 50 });
      // a column of golden light rising over each hero as the inspiration lands
      const hx = a.x;
      const hy = a.y;
      world.effects.add(0.5, (ctx, t) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        PFX.beam(ctx, hx, hy + 6, -Math.PI / 2, 40 + t * 50, 22 * (1 - t * 0.5), ['#a07a24', '#ffd34a', '#fff6c8'], 2, false);
        PFX.ring(ctx, hx, hy + 6, 8 + t * 22, (8 + t * 22) * 0.45, '#ffd34a', 2);
        ctx.restore();
      });
    }
    // a golden wave rolling out across the ensemble, stars riding its edge
    const { x, y } = this;
    world.effects.add(0.6, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const rr = r * (0.1 + t * 0.9);
      PFX.disc(ctx, x, y, rr, rr, `rgba(${BARD_FX.gold}, 0.08)`, 4);
      PFX.ring(ctx, x, y, rr, rr, '#ffd34a', 2, { thick: t < 0.4 ? 3 : 1 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * 2;
        PFX.star(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2, '#fff2a0', '#ffffff', 2);
      }
      ctx.restore();
    }, true);
    world.effects.text(this.hx, this.hy - 46, 'ENCORE!', { color: '#fff2a0', size: 9 });
    Bardsong.fanfare();
  }

  // ---------- F: lullaby ----------

  abilityF(world) {
    const c = this.cfg.lullaby;
    this.cooldowns.f = c.cooldown;
    this.lullaby = { t: 0 };
    world.effects.text(this.hx, this.hy - 34, 'LULLABY...', { color: '#c8b8ff', size: 8 });
    Bardsong.lullaby(c.duration);
  }

  /** F again while the lullaby plays ends it early (the music fades out). */
  stopLullaby(world) {
    this.lullaby = null;
    world.effects.text(this.hx, this.hy - 34, 'SONG ENDED', { color: '#a99bbd', size: 7 });
    Bardsong.stopLullaby();
  }

  /** While the lullaby is on cooldown (it always is while playing), pressing F stops the song instead of being refused. */
  tryAbility(slot, world, fn) {
    if (slot === 'f' && this.lullaby) return this.stopLullaby(world);
    super.tryAbility(slot, world, fn);
  }

  /** She can't attack while she plays the lullaby: no strumming (LMB) and no Screeching Tuning (Q). */
  handleMouse(world) {
    if (this.lullaby) {
      if (Input.mouse.leftPressed) Sound.play('denied');
      if (Input.mouse.rightPressed) this.tryAbility('secondary', world, () => this.secondary(world));
      return;
    }
    super.handleMouse(world);
  }

  castSlot(slot, world) {
    if (slot === 'q' && this.lullaby) return Sound.play('denied');
    super.castSlot(slot, world);
  }

  /**
   * While she plays (and walks about), everything within range fills its sleep
   * meter; `exposure`s of the song puts it to sleep. Meters drain out of range
   * (enemies and the game handle that, see lullabyTick).
   */
  updateLullaby(dt, world) {
    const c = this.cfg.lullaby;
    const L = this.lullaby;
    L.t += dt;
    const bossParts = world.boss ? world.boss.getTargets() : [];
    let bossHears = false;
    for (const t of world.getTargets()) {
      if (dist(this.x, this.hy, t.hx, t.hy) > c.radius + (t.radius || 0)) continue;
      if (bossParts.includes(t)) { bossHears = true; continue; }
      if (t.asleep || t.waking > 0 || t.dead) continue;
      t.lullabyTick = world.time;
      t.sleepMeter = (t.sleepMeter || 0) + dt;
      if (t.sleepMeter < c.exposure) continue;
      t.sleepMeter = 0;
      if (t.sleep) { t.sleep(c.sleep); t.sleptBy = this; }   // (Groggy: she makes them drowsy when they wake)
      else t.stun?.(c.sleep);
      world.effects.text(t.hx, t.hy - 36, 'ASLEEP', { color: '#c8b8ff', size: 7 });
      world.effects.burst(t.hx, t.hy - 10, { count: 10, colors: ['#ffffff', '#e8e0ff', '#c8b8ff'], speed: [20, 70], life: [0.4, 0.7], up: 30 });
    }
    const b = world.boss;
    if (b && bossHears && !(b.sleepUntil > world.time)) {
      b.lullabyTick = world.time;
      b.sleepMeter = (b.sleepMeter || 0) + dt;
      if (b.sleepMeter >= c.exposure) {
        b.sleepMeter = 0;
        b.sleepUntil = world.time + c.bossSleep;
        world.effects.text(b.x, b.y - 140, 'ASLEEP', { color: '#c8b8ff', size: 11 });
      }
    }
    // soft notes drifting through the area
    if (vrand(0, 1) < dt * 16) {
      const a = vrand(0, TAU);
      const r = vrand(0.2, 1) * c.radius;
      world.effects.burst(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r - 10, { count: 1, colors: ['#c8b8ff', '#e8e0ff', '#8a78e0'], speed: [5, 20], life: [0.5, 0.9], up: 20, size: [2, 3] });
    }
    if (L.t >= c.duration) this.lullaby = null;
  }

  // ---------- Q: screeching tuning ----------

  ultimate(world) {
    const c = this.cfg.ult;
    const spread = c.spreadDegrees * DEG;
    const hit = new Set();   // the whole wave hits each enemy once
    for (let i = 0; i < c.notes; i++) {
      const a = this.aim + (i / (c.notes - 1) - 0.5) * spread;
      world.playerProjectiles.push(new Projectile({
        x: this.pivotX + Math.cos(a) * 14, y: this.pivotY + Math.sin(a) * 14,
        vx: Math.cos(a) * c.speed, vy: Math.sin(a) * c.speed,
        radius: 9, damage: c.damage, life: c.life, knockback: c.knockback, pierce: 99, fromUlt: true, hitSet: hit,
        upright: true, sprite: Sprites.projectiles.screech, glow: '176, 74, 224', trail: ['#b04ae0', '#f0c8ff'],
        onStrike: (p, w, t) => {
          const until = w.time + c.weaken;
          const isBoss = w.boss && w.boss.getTargets().includes(t);
          if (!(t.weakenUntil > w.time)) w.effects.text(t.hx, t.hy - 34, 'WEAKENED', { color: '#d090ff', size: 7 });
          t.weakenUntil = until;
          if (isBoss) w.boss.weakenUntil = until;
          noteHit(w, t.hx, t.hy, BARD_FX.screech);
        },
      }));
    }
    // jagged sound waves fanning out in front of her
    const x = this.pivotX;
    const y = this.pivotY;
    const aim = this.aim;
    world.effects.add(0.55, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const u = t - k * 0.12;
        if (u <= 0 || u >= 0.85) continue;
        const r = 20 + u * c.speed * c.life * 0.9;
        ctx.globalAlpha = 1 - u / 0.85;
        const pts = [];
        for (let i = 0; i <= 14; i++) {
          const a = aim - spread / 2 + (i / 14) * spread;
          const rr = r + (i % 2 ? 6 : 0);
          pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
        }
        PFX.path(ctx, pts, k === 0 ? '#f0c8ff' : '#b04ae0', 2);
      }
      ctx.restore();
    });
    world.effects.burst(x, y, { count: 20, colors: BARD_FX.screech, speed: [80, 220], life: [0.2, 0.45], angle: aim, spread });
    world.shake(6, 0.3);
    Bardsong.screech();
  }

  // ---------- update & drawing ----------

  updateAbility(dt, world) {
    this.strumAnim -= dt;
    this.songBoost -= dt;
    this.playTune(dt, world);
    if (this.lullaby) this.updateLullaby(dt, world);
  }

  get passiveInfo() {
    const tone = BARD_FX[this.tune];
    return { name: 'ENSEMBLE', color: tone.color, ready: true, text: this.songBoost > 0 ? `${tone.label} (INSPIRED)` : tone.label };
  }

  /** Ability outlines while a key is held (see Player.abilityPreview). */
  abilityPreview(slot) {
    if (slot === 'e') return { circle: { x: this.x, y: this.y, r: this.cfg.passive.radius } };
    if (slot === 'f') return { circle: { x: this.x, y: this.y, r: this.cfg.lullaby.radius } };
    if (slot === 'q') {
      const c = this.cfg.ult;
      return { cone: { x: this.pivotX, y: this.pivotY, angle: this.aim, arc: c.spreadDegrees * DEG, range: c.speed * c.life } };
    }
    return null;
  }

  drawGroundExtras(ctx) {
    // the ensemble's reach: a faint ring in the tune's colour with a few notes drifting round it
    // (brighter while Inspire makes the song swell)
    const r = this.cfg.passive.radius;
    const tone = BARD_FX[this.tune];
    const boost = this.songBoost > 0;
    // while the lullaby plays the aura steps back so the sleep area reads clearly
    const quiet = this.lullaby ? 0.3 : 1;
    const pulse = ((boost ? 0.5 : 0.28) + Math.sin(this.animTime * 3) * 0.06) * quiet;
    ctx.save();
    if (boost && !this.lullaby) PFX.disc(ctx, this.x, this.y, r, r, `rgba(${tone.rgb}, 0.05)`, 4);
    ctx.globalCompositeOperation = 'lighter';
    PFX.ring(ctx, this.x, this.y, r, r, `rgba(${tone.rgb}, ${pulse})`, 2, { dash: [4, 3], spin: this.animTime * 0.2 });
    for (let i = 0; i < 3; i++) {
      const a = this.animTime * 0.5 + (i * TAU) / 3;
      const img = Sprites.projectiles.notes[this.tune][i % 2];
      ctx.globalAlpha = (boost ? 0.7 : 0.4) * quiet;
      ctx.drawImage(img, Math.round(this.x + Math.cos(a) * r - img.width / 2), Math.round(this.y + Math.sin(a) * r - img.height + Math.sin(this.animTime * 4 + i) * 2));
    }
    ctx.restore();
    if (this.songBoost > 0 && !this.lullaby) this.drawInspiredAura(ctx);
    if (this.lullaby) this.drawLullabyArea(ctx);
  }

  /**
   * While Inspire makes her song swell, the ensemble glows gold: ripples pulse
   * out from her, a shimmering ring with sparkles twinkling along it, motes and
   * notes rising inside, and a thin arc round the outside for the time left.
   */
  drawInspiredAura(ctx) {
    const r = this.cfg.passive.radius;
    const x = this.x;
    const y = this.y;
    const t = this.animTime;
    const left = clamp(this.songBoost / this.cfg.morale.duration, 0, 1);
    const fade = Math.min(1, this.songBoost * 2);   // fades out over the last half second
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // ripples pulsing outward
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      ctx.globalAlpha = (1 - k) * 0.45 * fade;
      PFX.ring(ctx, x, y, r * (0.15 + k * 0.85), r * (0.15 + k * 0.85), '#ffd34a', 2);
    }
    // the shimmering golden rim and the time left
    ctx.globalAlpha = (0.55 + Math.sin(t * 6) * 0.15) * fade;
    PFX.ring(ctx, x, y, r, r, '#ffd34a', 2, { dash: [5, 2], spin: t * 0.5 });
    ctx.globalAlpha = 0.6 * fade;
    PFX.ring(ctx, x, y, r + 6, r + 6, '#fff2a0', 2, { from: -Math.PI / 2, to: -Math.PI / 2 + TAU * left });
    // sparkles twinkling along the rim
    for (let i = 0; i < 10; i++) {
      if ((Math.floor(t * 6) + i) % 3 === 0) continue;
      const a = (i / 10) * TAU + t * 0.6;
      ctx.globalAlpha = fade;
      PFX.star(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, (Math.floor(t * 6) + i) % 3 === 1 ? 2 : 3, '#ffd34a', '#ffffff', 2);
    }
    // golden motes rising through the area
    for (let i = 0; i < 8; i++) {
      const a = i * 2.39996;
      const d = r * (0.2 + ((i * 0.41) % 0.7));
      const rise = (t * 22 + i * 9) % 36;
      ctx.globalAlpha = fade * (rise < 26 ? 0.9 : (36 - rise) / 10 * 0.9);
      PFX.star(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d - rise, 1, '#ffd34a', '#fff6c8', 2);
    }
    ctx.restore();
    // a few golden notes drifting up among them
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.7;
      const d = r * (0.35 + i * 0.18);
      const rise = (t * 16 + i * 13) % 40;
      ctx.globalAlpha = fade * (rise < 30 ? 0.75 : (40 - rise) / 10 * 0.75);
      const img = Sprites.projectiles.notes.energetic[i % 2];
      ctx.drawImage(img, Math.round(x + Math.cos(a) * d - img.width / 2), Math.round(y + Math.sin(a) * d - rise - img.height));
    }
    ctx.restore();
  }

  /**
   * The lullaby's reach as a drowsy dream: a soft lavender haze, a gently
   * rippling edge with dream clouds drifting round it, z's, crescent moons and
   * twinkling stars floating up inside, and a bright arc on the edge that
   * shrinks as the song plays out.
   */
  drawLullabyArea(ctx) {
    const c = this.cfg.lullaby;
    const r = c.radius;
    const x = this.x;
    const y = this.y;
    const t = this.animTime;
    const left = clamp(1 - this.lullaby.t / c.duration, 0, 1);
    const fadeIn = Math.min(1, this.lullaby.t * 3);
    ctx.save();
    ctx.globalAlpha = fadeIn;
    // haze, deeper toward the middle
    PFX.disc(ctx, x, y, r, r, 'rgba(110, 90, 210, 0.14)', 4);
    PFX.disc(ctx, x, y, r * 0.66, r * 0.66, 'rgba(150, 130, 240, 0.07)', 4);
    ctx.globalCompositeOperation = 'lighter';
    // a rippling edge, like the song's breath
    const edge = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const rr = r + Math.sin(a * 7 + t * 2.2) * 3 + Math.sin(a * 3 - t * 1.3) * 2;
      edge.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    PFX.path(ctx, edge, 'rgba(200, 184, 255, 0.3)', 2);
    // how much of the song is left: a bright arc from the top
    PFX.ring(ctx, x, y, r - 6, r - 6, 'rgba(190, 170, 255, 0.4)', 2, { from: -Math.PI / 2, to: -Math.PI / 2 + TAU * left });
    ctx.globalCompositeOperation = 'source-over';
    // dream clouds drifting slowly round the rim
    ctx.globalAlpha = 0.6 * fadeIn;
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * TAU + t * 0.12;
      PFX.smokeBlob(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 15 + (i % 3) * 3, ['#4a3a8a', '#7a6ac8', '#c8b8ff'], t * 0.5, i, 1);
    }
    // z's, crescent moons and stars floating up through the area
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996;                                  // golden angle: spread evenly
      const d = r * (0.2 + ((i * 0.37) % 0.65));
      const rise = (t * 10 + i * 7) % 28;
      const px = Math.round(x + Math.cos(a) * d + Math.sin(t + i) * 3);
      const py = Math.round(y + Math.sin(a) * d - rise);
      ctx.globalAlpha = fadeIn * (rise < 20 ? 0.85 : (28 - rise) / 8 * 0.85);
      if (i % 3 === 0) {
        HUD.text(ctx, i % 2 ? 'Z' : 'z', px, py, { size: i % 2 ? 8 : 6, color: '#d8ccff' });
      } else if (i % 3 === 1) {
        // a crescent: the moon's disc with a smaller one cut out of it
        ctx.fillStyle = '#e8e0ff';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, TAU);
        ctx.arc(px + 2, py - 1, 3.2, 0, TAU, true);
        ctx.fill('evenodd');
      } else {
        PFX.star(ctx, px, py, Math.floor(t * 4 + i) % 2 ? 2 : 1, '#c8b8ff', '#ffffff', 2);
      }
    }
    ctx.restore();
  }

  drawExtras(ctx) {
    if (!this.lullaby) return;
    // notes circling her while she sings, and how long the song has left
    const c = this.cfg.lullaby;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = this.animTime * 2 + (i * TAU) / 4;
      PFX.star(ctx, this.x + Math.cos(a) * 20, this.y - 26 + Math.sin(a) * 8 - Math.sin(this.animTime * 3 + i) * 4, 2, '#c8b8ff', '#ffffff', 2);
    }
    ctx.restore();
    const k = clamp(1 - this.lullaby.t / c.duration, 0, 1);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(this.x - 16), Math.round(this.y - 58), 32, 5);
    ctx.fillStyle = '#c8b8ff';
    ctx.fillRect(Math.round(this.x - 15), Math.round(this.y - 57), Math.round(30 * k), 3);
  }

  get weaponReach() { return this.strumAnim > 0 ? 6 : 9; }

  /** The lute is held across the body, neck tilted up toward the side she faces (and shaking as she strums). */
  weaponAngle() {
    const strum = this.strumAnim > 0 ? Math.sin(this.strumAnim * 60) * 0.12 : 0;
    const sway = this.lullaby ? Math.sin(this.animTime * 4) * 0.08 : 0;
    const base = Math.cos(this.aim) >= 0 ? -0.6 : Math.PI + 0.6;
    return base + strum + sway;
  }
}

/** A note bursting on an enemy: a quick ring and a spray in the tune's colours. */
function noteHit(world, x, y, colors) {
  world.effects.burst(x, y, { count: 6, colors, speed: [50, 140], life: [0.15, 0.3], size: [2, 3] });
  world.effects.add(0.2, (ctx, t) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - t;
    PFX.ring(ctx, x, y, 4 + t * 12, 4 + t * 12, colors[colors.length - 2] || colors[0], 2);
    ctx.restore();
  });
}
