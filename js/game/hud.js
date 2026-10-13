// Heads-up display, drawn in screen space on top of the world.

const HUD = {
  text(ctx, str, x, y, { size = 8, color = '#f4ead7', align = 'left', baseline = 'top', shadow = true } = {}) {
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = OUTLINE;
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#241c33';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a2d52';
    ctx.fillRect(x, y, w, 2);
  },

  bar(ctx, x, y, w, h, ratio, fill, back = '#3a1a24') {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), 2);
  },

  draw(ctx, game) {
    this.drawPlayer(ctx, game.player);
    this.drawWave(ctx, game);
    if (game.boss && !game.boss.dead) {
      // fade the bars if the hero walks behind them
      const sy = game.player.y - game.camera.y;
      ctx.globalAlpha = sy > 420 ? 0.35 : 1;
      this.drawBoss(ctx, game.boss);
      ctx.globalAlpha = 1;
    }
    this.drawBanner(ctx, game);
    const p = game.player;
    if (p.targeting) {
      const msg = p.classId === 'mage' ? 'LEFT CLICK: PICK LIGHTNING TARGET   RIGHT CLICK: CANCEL' : 'LEFT CLICK: FIRE VOLLEY   RIGHT CLICK: CANCEL';
      this.text(ctx, msg, 480, 440, { size: 8, align: 'center', color: p.classId === 'mage' ? '#9ad0ff' : '#8cff9a' });
    }
    if (p.placing) {
      this.text(ctx, 'LEFT CLICK: PLACE DRAIN CIRCLE   RIGHT CLICK: CANCEL', 480, 440, { size: 8, align: 'center', color: '#c8a8ff' });
    }
    if (p.choosingArrow) {
      this.text(ctx, 'LEFT CLICK: FIRE ARROW', 474, 440, { size: 8, align: 'right', color: '#ff8a1e' });
      this.text(ctx, 'RIGHT CLICK: ICE ARROW', 486, 440, { size: 8, color: '#9ad0ff' });
      this.text(ctx, 'F: CANCEL', 480, 456, { size: 6, align: 'center', color: '#d8c8a0' });
    }
  },

  drawPlayer(ctx, p) {
    // portrait
    this.panel(ctx, 12, 12, 40, 40);
    const frame = p.frames.idle[0].img;
    ctx.drawImage(frame, 14, 6, 36, 36, 14, 14, 36, 36);

    // health
    const ratio = p.hp / p.maxHp;
    this.bar(ctx, 60, 14, 170, 14, ratio, ratio > 0.3 ? '#e84a4a' : '#ff2a2a');
    this.text(ctx, `${Math.ceil(p.hp)}/${p.maxHp}`, 145, 17, { size: 8, align: 'center' });
    let y = 36;
    if (p.resource) {
      const r = p.resource;
      this.bar(ctx, 60, 34, 170, 8, r.value / r.max, r.color, '#1a1a30');
      this.text(ctx, `${r.name} ${Math.floor(r.value)}`, 145, 34, { size: 6, align: 'center' });
      y = 50;
    }
    this.text(ctx, p.cfg.name.toUpperCase(), 60, y, { size: 8, color: '#f2a541' });
    this.text(ctx, this.statusText(p), 148, y, { size: 7, color: '#d8c8a0' });

    // abilities
    const slots = [
      ['LMB', p.icons.primary, 'primary'],
      ['RMB', p.icons.secondary, 'secondary'],
      ['E', p.icons.e, 'e'],
      ['F', p.icons.f, 'f'],
      ['SHIFT', 'DODGE', 'dodge'],
    ];
    const icons = Sprites.icons[p.classId];
    slots.forEach(([key, name, slot], i) => {
      const icon = slot === 'dodge' ? Sprites.icons.dodge : icons[slot];
      this.abilitySlot(ctx, 14 + i * 70, 474, key, name, p.cooldowns[slot], p.maxCooldowns[slot], icon);
    });
    this.ultSlot(ctx, 14 + slots.length * 70 + 6, 474, p);
  },

  /** Short list of active buffs/debuffs. */
  statusText(p) {
    const s = [];
    if (p.slowTime > 0) s.push('SLOWED');
    if (p.shielding) s.push(`SHIELD ${Math.ceil(p.shieldHp)}`);
    if (p.parryTime > 0) s.push('PARRY');
    if (p.haste > 0) s.push('HASTE');
    if (p.bird) s.push('BIRD (F: LAND)');
    if (p.invisible) s.push('HIDDEN');
    if (p.rapidArrows > 0) s.push(`RAPID x${p.rapidArrows}`);
    if (p.stormReady) s.push('STORM READY');
    if (p.cleave) s.push(`POWER ${Math.floor(p.cleavePower * 100)}% (LMB)`);
    if (p.spin) s.push('SPIN (E: STOP)');
    return s.join(' ');
  },

  abilitySlot(ctx, x, y, key, name, cd, max, icon) {
    const w = 62;
    const h = 50;
    this.panel(ctx, x, y, w, h);
    const ready = cd <= 0;
    this.text(ctx, key, x + 4, y + 4, { size: key.length > 3 ? 5 : 6, color: ready ? '#f2a541' : '#7a6a8a' });
    if (icon) ctx.drawImage(icon, x + w / 2 - icon.width / 2, y + 8);
    this.text(ctx, name, x + w / 2, y + 39, { size: 5, align: 'center', color: ready ? '#f4ead7' : '#7a6a8a' });
    if (!ready) {
      const r = clamp(cd / max, 0, 1);
      ctx.fillStyle = 'rgba(10, 6, 18, 0.6)';
      ctx.fillRect(x, y + h * (1 - r), w, h * r);
      if (max >= 1) this.text(ctx, (Math.ceil(cd * 10) / 10).toFixed(1), x + w / 2, y + 17, { size: 8, align: 'center', color: '#ffffff' });
    } else {
      ctx.fillStyle = '#6cff7a';
      ctx.fillRect(x + 6, y + h - 4, w - 12, 2);
    }
  },

  /** Q slot: fills up as the hero deals damage. */
  ultSlot(ctx, x, y, p) {
    const w = 70;
    const h = 50;
    this.panel(ctx, x, y, w, h);
    const r = clamp(p.ult / p.ultMax, 0, 1);
    const ready = p.ultReady;
    ctx.fillStyle = ready ? `rgba(255, 200, 60, ${0.35 + Math.sin(performance.now() / 150) * 0.15})` : 'rgba(255, 180, 60, 0.25)';
    ctx.fillRect(x, y + h * (1 - r), w, h * r);
    this.text(ctx, 'Q', x + 4, y + 4, { size: 6, color: ready ? '#ffe680' : '#7a6a8a' });
    const icon = Sprites.icons[p.classId].q;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(icon, x + w / 2 - icon.width / 2, y + 8);
    ctx.globalAlpha = 1;
    this.text(ctx, ready ? 'READY' : `${Math.floor(r * 100)}%`, x + w / 2, y + 39, { size: 6, align: 'center', color: ready ? '#ffe680' : '#f4ead7' });
  },

  drawWave(ctx, game) {
    if (game.practice) {
      const pr = game.practice;
      const o = pr.options;
      const flags = [o.god && 'GOD', o.infiniteMana && 'INF MANA', o.infiniteEnergy && 'INF ENERGY'].filter(Boolean).join('  ');
      this.text(ctx, 'PRACTICE RANGE', 480, 12, { size: 9, align: 'center', color: '#f2a541' });
      this.text(ctx, `DPS ${Math.round(game.dps)}   TOTAL ${pr.total}`, 480, 28, { size: 8, align: 'center' });
      if (flags) this.text(ctx, flags, 480, 42, { size: 6, align: 'center', color: '#8cff9a' });
      return;
    }
    const d = game.director;
    if (d.state === 'boss') return;
    this.text(ctx, `WAVE ${d.waveNumber}/${d.totalWaves}`, 946, 14, { size: 10, align: 'right', color: '#f2a541' });
    const left = game.enemies.length + game.pendingSpawns + d.queue.length;
    this.text(ctx, `ENEMIES ${left}`, 946, 32, { size: 8, align: 'right' });
  },

  drawBoss(ctx, boss) {
    if (boss.intro > 0) return;
    // bottom-right, clear of the ability bar and the golem itself
    const bars = boss.bars;
    const small = bars.filter((b) => !b.wide);
    const bw = 118;
    const gap = 12;
    const total = small.length * bw + (small.length - 1) * gap;
    const left = 960 - total - 16;
    this.text(ctx, 'CLAY GOLEM', left + total / 2, 448, { size: 10, align: 'center', color: '#f2a541' });
    small.forEach((b, i) => this.bossBar(ctx, left + i * (bw + gap), 478, bw, b));
    const body = bars.find((b) => b.wide);
    this.bossBar(ctx, left, 510, total, body);
  },

  bossBar(ctx, x, y, w, b) {
    const part = b.part;
    const dead = part.dead || part.hp <= 0;
    this.text(ctx, b.label, x, y - 10, { size: 6, color: dead ? '#6a5a7a' : '#f4ead7' });
    if (b.locked) {
      this.bar(ctx, x, y, w, 8, 1, '#4a4058', '#2a2438');
      this.text(ctx, b.lockedText, x + w / 2, y, { size: 6, align: 'center', color: '#a99bbd' });
      return;
    }
    this.bar(ctx, x, y, w, 8, part.hp / part.maxHp, '#e8732a');
    if (dead) this.text(ctx, 'DESTROYED', x + w / 2, y, { size: 6, align: 'center', color: '#a99bbd' });
  },

  drawBanner(ctx, game) {
    const b = game.bannerData;
    if (!b) return;
    const a = clamp(Math.min(b.t, b.maxT - b.t) * 3, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(0, 200, 960, b.sub ? 76 : 56);
    this.text(ctx, b.text, 480, 214, { size: 20, align: 'center', color: '#f2a541' });
    if (b.sub) this.text(ctx, b.sub, 480, 248, { size: 9, align: 'center' });
    ctx.globalAlpha = 1;
  },

  drawCrosshair(ctx, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 9, y - 2, 6, 4); ctx.fillRect(x + 3, y - 2, 6, 4);
    ctx.fillRect(x - 2, y - 9, 4, 6); ctx.fillRect(x - 2, y + 3, 4, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 8, y - 1, 5, 2); ctx.fillRect(x + 3, y - 1, 5, 2);
    ctx.fillRect(x - 1, y - 8, 2, 5); ctx.fillRect(x - 1, y + 3, 2, 5);
    ctx.fillStyle = '#f2a541';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  },
};
