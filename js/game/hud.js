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
    if (game.boss && !game.boss.dead && game.boss.intro <= 0 && !game.practice) {
      this.text(ctx, game.boss.name, 480, 12, { size: 10, align: 'center', color: '#f2a541' });
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
    this.drawPassive(ctx, p.passiveInfo, 12, y + 16);

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

  /**
   * Class passive panel: name + state text, then pips (hit/streak counters)
   * and/or a draining timer bar. Glows while the passive is ready/active.
   */
  drawPassive(ctx, info, x, y) {
    if (!info) return;
    const w = 218;
    const hasRow = info.maxPips || info.bar != null;
    const h = hasRow ? 26 : 15;
    this.panel(ctx, x, y, w, h);
    if (info.ready) {
      ctx.fillStyle = `rgba(255, 220, 120, ${0.12 + Math.sin(performance.now() / 120) * 0.08})`;
      ctx.fillRect(x, y, w, h);
    }
    this.text(ctx, 'PASSIVE', x + 4, y + 4, { size: 5, color: '#7a6a8a' });
    this.text(ctx, info.name, x + 44, y + 3, { size: 6, color: info.color });
    this.text(ctx, info.text, x + w - 4, y + 3, { size: 6, align: 'right', color: info.ready ? '#ffe680' : '#d8c8a0' });
    if (!hasRow) return;
    const rowY = y + 14;
    let barX = x + 4;
    if (info.maxPips) {
      const n = info.maxPips;
      const pw = n <= 5 ? 22 : 12;
      for (let i = 0; i < n; i++) {
        const px = x + 4 + i * (pw + 2);
        const lit = i < info.pips;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(px - 1, rowY - 1, pw + 2, 8);
        ctx.fillStyle = lit ? info.color : '#2a2438';
        ctx.fillRect(px, rowY, pw, 6);
        if (lit) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(px, rowY, pw, 1);
        }
      }
      barX = x + 4 + n * (pw + 2) + 4;
    }
    if (info.bar != null) {
      const bw = x + w - 4 - barX;
      if (bw > 10) this.bar(ctx, barX + 1, rowY + 1, bw - 2, 4, info.bar, info.color, '#1a1a30');
    }
  },

  /** Short list of active buffs/debuffs. */
  statusText(p) {
    const s = [];
    if (p.slowTime > 0) s.push('SLOWED');
    if (p.chillTime > 0) s.push('CHILLED');
    if (p.shielding) s.push(`SHIELD ${Math.ceil(p.shieldHp)}`);
    if (p.parryTime > 0) s.push('PARRY');
    if (p.haste > 0) s.push('HASTE');
    if (p.bird) s.push('BIRD (F: LAND)');
    if (p.invisible) s.push('HIDDEN');
    if (p.rapidArrows > 0) s.push(`RAPID x${p.rapidArrows}`);
    if (p.stormReady) s.push('STORM READY');
    if (p.cleave) s.push(`POWER ${Math.floor(p.cleavePower * 100)}% (LMB)`);
    if (p.spin) s.push('SPIN (E: STOP)');
    if (p.regenerating) s.push('REGEN');
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

  /**
   * Boss health bars, drawn in world space (inside the camera transform)
   * next to each part that can be hit. boss.bars gives
   * [{ part, x, y, w, locked?, lockedText?, marker? }] centred on (x, y);
   * marker is an hp fraction to tick (e.g. a phase threshold).
   */
  drawBossBars(ctx, boss) {
    for (const b of boss.bars) {
      const h = 4;
      const x = Math.round(b.x - b.w / 2);
      const y = Math.round(b.y);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y - 1, b.w + 2, h + 2);
      if (b.locked) {
        ctx.fillStyle = '#4a4058';
        ctx.fillRect(x, y, b.w, h);
        if (b.lockedText) this.text(ctx, b.lockedText, b.x, y - 8, { size: 5, align: 'center', color: '#a99bbd' });
        continue;
      }
      const ratio = clamp(b.part.hp / b.part.maxHp, 0, 1);
      ctx.fillStyle = '#3a1a24';
      ctx.fillRect(x, y, b.w, h);
      ctx.fillStyle = b.color || '#e8732a';
      ctx.fillRect(x, y, Math.round(b.w * ratio), h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(x, y, Math.round(b.w * ratio), 1);
      for (const m of [].concat(b.marker ?? [])) {
        ctx.fillStyle = '#f4ead7';
        ctx.fillRect(x + Math.round(b.w * m), y - 1, 1, h + 2);
      }
    }
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
