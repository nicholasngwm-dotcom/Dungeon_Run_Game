// Heads-up display, drawn in screen space on top of the world.

// spacing of the upgrade icon tiles on the scoreboard (px)
const UPGRADE_TILE = 24;

const HUD = {
  text(ctx, str, x, y, { size = 8, color = '#f4ead7', align = 'left', baseline = 'top', shadow = true } = {}) {
    ctx.font = uiFont(size);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = OUTLINE;
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  /** A HUD frame in the keep's style: dark walnut with a gold trim, lit along the top, shaded along the bottom. */
  panel(ctx, x, y, w, h) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#8a6a26';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#2e1f17';
    ctx.fillRect(x, y, w, h);
    // faint wood grain
    ctx.fillStyle = 'rgba(255, 220, 170, 0.035)';
    for (let gy = y + 5; gy < y + h - 3; gy += 6) ctx.fillRect(x + 2, gy, w - 4, 1);
    ctx.fillStyle = '#4e3524';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#1c120c';
    ctx.fillRect(x, y + h - 1, w, 1);
    // little gold studs in the corners
    if (w >= 20 && h >= 14) {
      ctx.fillStyle = '#d4ac4c';
      for (const [cx, cy] of [[x + 1, y + 2], [x + w - 3, y + 2], [x + 1, y + h - 3], [x + w - 3, y + h - 3]]) ctx.fillRect(cx, cy, 2, 2);
    }
  },

  /** A recessed socket for an ability icon: a rounded dark well, shaded at the top, lit along the bottom lip. */
  socket(ctx, cx, top, size, glow = null) {
    const x = Math.round(cx - size / 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, top, size + 2, size);
    ctx.fillRect(x, top - 1, size, size + 2);
    ctx.fillStyle = '#1a110c';
    ctx.fillRect(x, top, size, size);
    ctx.fillStyle = '#0e0906';
    ctx.fillRect(x, top, size, 3);
    ctx.fillStyle = '#5a3e26';
    ctx.fillRect(x + 1, top + size - 1, size - 2, 1);
    if (glow) {
      const g = ctx.createRadialGradient(cx, top + size / 2, 1, cx, top + size / 2, size * 0.7);
      g.addColorStop(0, `rgba(${glow}, 0.35)`);
      g.addColorStop(1, `rgba(${glow}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, top, size, size);
    }
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
    // a boss's entrance: only the letterbox and its title card
    if (game.cutscene && game.boss) return this.drawCutscene(ctx, game);
    this.drawPickupHover(ctx, game);
    // always this screen's hero (game.player is the boss's target while a boss updates)
    this.drawPlayer(ctx, game.localPlayer);
    if (game.run) this.drawCoins(ctx, game.localPlayer);
    else if (game.lobby && Profiles.current) this.drawGems(ctx, Profiles.gems);
    if (game.multiplayer) this.drawParty(ctx, game);
    this.drawWave(ctx, game);
    if (game.boss && !game.boss.dead && game.boss.intro <= 0 && !game.practice) {
      this.text(ctx, game.boss.name, 480, 12, { size: 10, align: 'center', color: '#f2a541' });
    }
    this.drawBanner(ctx, game);
    this.drawBossSpeech(ctx, game);
    const p = game.localPlayer;
    if (game.run && Input.down('scoreboard')) this.drawScoreboard(ctx, game);
    if (game.run?.active && p.strayTime > 0) {
      const left = Math.max(0, CONFIG.run.strayReturn - p.strayTime).toFixed(1);
      this.text(ctx, `OUTSIDE THE ROOM - RETURNING IN ${left}s`, 480, 400, { size: 8, align: 'center', color: '#e0c0ff' });
    }
    if (p.targeting) {
      const msg = { mage: 'LEFT CLICK: PICK LIGHTNING TARGET', rocketeer: `LEFT CLICK: FIRE BARRAGE (${p.ammo} ROCKETS)` }[p.classId] || 'LEFT CLICK: FIRE VOLLEY';
      const color = { mage: '#9cf0d8', rocketeer: '#ff9a3a' }[p.classId] || '#a8cc6a';
      this.text(ctx, `${msg}   RIGHT CLICK: CANCEL`, 480, 440, { size: 8, align: 'center', color });
    }
    if (p.placing) {
      this.text(ctx, 'LEFT CLICK: PLACE DRAIN CIRCLE   RIGHT CLICK: CANCEL', 480, 440, { size: 8, align: 'center', color: '#9cf0d8' });
    }
    if (p.choosingAegis) {
      this.text(ctx, 'LEFT CLICK: AEGIS ON ALLY', 474, 440, { size: 8, align: 'right', color: '#ffe680' });
      this.text(ctx, 'RIGHT CLICK: AEGIS ON SELF', 486, 440, { size: 8, color: '#ffe680' });
      this.text(ctx, `${Settings.label('f')}: CANCEL`, 480, 456, { size: 6, align: 'center', color: '#d8c8a0' });
    }
    if (p.choosingArrow) {
      this.text(ctx, 'LEFT CLICK: FIRE ARROW', 474, 440, { size: 8, align: 'right', color: '#ff8a1e' });
      this.text(ctx, 'RIGHT CLICK: ICE ARROW', 486, 440, { size: 8, color: '#9ad0ff' });
    }
    this.drawAbilityTooltip(ctx, p);
    if (game.lobby) this.drawTeleport(ctx, game);
  },

  // ---------- the lobby's teleport map ----------

  teleportOpen: false,   // this screen's map of the keep is open

  /** The TELEPORT button, under the lobby's title on the right (below the room code in multiplayer). */
  teleportButtonRect(game) { return { x: 846, y: game.multiplayer ? 112 : 50, w: 100, h: 20 }; },

  /**
   * Where the keep's map is drawn when open: right of the hero panel, the gems and the chat
   * (x < 354), left of the room code and the ready-check panel (x > 742), above the ability bar.
   */
  teleportMapRect(game) {
    const d = game.dungeon;
    const h = 330;
    return { x: 362, y: 66, w: Math.round((h * d.width) / d.height), h, s: h / d.height };
  },

  /** The world point under a screen point on the map, if it's the keep's floor; else null. */
  teleportSpot(game, sx, sy) {
    const r = this.teleportMapRect(game);
    const d = game.dungeon;
    const x = (sx - r.x) / r.s;
    const y = (sy - r.y) / r.s;
    const T = CONFIG.tileSize;
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null;
    return d.tileAt(Math.floor(x / T), Math.floor(y / T)) === TILE.FLOOR ? { x, y } : null;
  },

  /**
   * Mouse on the teleport button and map, run before the hero reads its input (like the
   * bag): the button opens and closes the map; while it's open, every click is the map's
   * (left: teleport there, right or outside it: close), so none of them attack.
   * game: the lobby being played on this screen, or null (closes the map).
   */
  handleTeleportMouse(game) {
    if (!game || !game.lobby || game.localPlayer.dead) { this.teleportOpen = false; return; }
    const m = Input._mouse;
    const inside = (r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h;
    if (m.leftPressed && inside(this.teleportButtonRect(game))) {
      m.left = m.leftPressed = false;
      this.teleportOpen = !this.teleportOpen;
      Sound.play('uiClick');
      return;
    }
    if (!this.teleportOpen) return;
    m.left = false;
    if (m.rightPressed) {
      m.right = m.rightPressed = false;
      this.teleportOpen = false;
      return;
    }
    if (!m.leftPressed) return;
    m.leftPressed = false;
    if (!inside(this.teleportMapRect(game))) { this.teleportOpen = false; return; }
    const spot = this.teleportSpot(game, m.x, m.y);
    if (!spot) return;
    App.command({ type: 'teleport', x: Math.round(spot.x), y: Math.round(spot.y) });
    this.teleportOpen = false;
  },

  /** The TELEPORT button and, while open, the map of the keep: rooms named, stations and heroes marked. */
  drawTeleport(ctx, game) {
    const m = Input._mouse;
    const b = this.teleportButtonRect(game);
    const hot = m.x >= b.x && m.x < b.x + b.w && m.y >= b.y && m.y < b.y + b.h;
    this.panel(ctx, b.x, b.y, b.w, b.h);
    if (hot || this.teleportOpen) {
      ctx.fillStyle = 'rgba(255, 230, 128, 0.18)';
      ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    }
    this.text(ctx, this.teleportOpen ? 'CLOSE MAP' : 'TELEPORT', b.x + b.w / 2, b.y + 6, { size: 7, align: 'center', color: hot ? '#ffffff' : '#ffe680' });
    if (!this.teleportOpen) return;

    const r = this.teleportMapRect(game);
    const d = game.dungeon;
    this.panel(ctx, r.x - 6, r.y - 20, r.w + 12, r.h + 26);
    this.text(ctx, 'CLICK ANYWHERE TO TELEPORT', r.x, r.y - 15, { size: 6, color: '#ffe680' });
    this.text(ctx, 'RIGHT CLICK: CLOSE', r.x + r.w, r.y - 15, { size: 6, align: 'right', color: '#d8c8a0' });
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(d.background, r.x, r.y, r.w, r.h);
    ctx.restore();
    const at = (x, y) => [Math.round(r.x + x * r.s), Math.round(r.y + y * r.s)];
    // the stations, as little gold diamonds (the gate in violet)
    for (const s of game.lobby.stations) {
      const [x, y] = at(s.x, s.kind === 'gate' ? s.bottom + 8 : s.y);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 3, y - 2, 6, 4);
      ctx.fillRect(x - 2, y - 3, 4, 6);
      ctx.fillStyle = s.kind === 'gate' ? '#c08aff' : '#ffd34a';
      ctx.fillRect(x - 2, y - 1, 4, 2);
      ctx.fillRect(x - 1, y - 2, 2, 4);
    }
    // the rooms' names
    const T = CONFIG.tileSize;
    const names = { hall: 'GREAT HALL', armory: 'ARMORY', heroes: 'HALL OF HEROES', library: 'LIBRARY', workshop: 'WORKSHOP', quarters: 'QUARTERS', yard: 'TRAINING GROUNDS', garden: 'GARDEN' };
    for (const [id, room] of Object.entries(d.rooms || {})) {
      if (!names[id]) continue;
      const [x, y] = at(((room.x0 + room.x1 + 1) / 2) * T, (room.y0 + 0.4) * T);
      this.text(ctx, names[id], x, y, { size: 6, align: 'center', color: '#f4ead7' });
    }
    // the heroes: you in blue (blinking), everyone else in white
    for (const p of game.players) {
      if (p.dead) continue;
      const me = p === game.localPlayer;
      if (me && Math.floor(performance.now() / 300) % 2) continue;
      const [x, y] = at(p.x, p.y);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 3, y - 3, 7, 7);
      ctx.fillStyle = me ? '#6ab8ff' : '#ffffff';
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
    // under the mouse: a ring where you'd land, or a red cross over walls
    if (m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) {
      const ok = this.teleportSpot(game, m.x, m.y);
      ctx.save();
      if (ok) PFX.ring(ctx, m.x, m.y, 7, 4, '#8cff9a', 1);
      else {
        ctx.fillStyle = '#ff5a5a';
        for (let i = -3; i <= 3; i++) { ctx.fillRect(Math.round(m.x) + i, Math.round(m.y) + i, 1, 1); ctx.fillRect(Math.round(m.x) + i, Math.round(m.y) - i, 1, 1); }
      }
      ctx.restore();
    }
  },

  /** Coin counter next to the health bar (dungeon runs); pops when coins come in. */
  /**
   * Multiplayer: the rest of the party down the left side (name, hero, health),
   * and a notice while this screen's hero is down and spectating.
   */
  drawParty(ctx, game) {
    const me = game.localPlayer;
    const others = game.players.filter((p) => p !== me);
    let y = 170;
    if (others.length) this.text(ctx, 'PARTY', 14, y - 12, { size: 6, color: '#8a7660' });
    for (const p of others) {
      this.panel(ctx, 12, y, 150, 18);
      const icon = Sprites.heroes[p.classId].idle[0].img;
      ctx.globalAlpha = p.dead ? 0.4 : 1;
      ctx.drawImage(icon, 22, 8, 22, 22, 13, y, 18, 18);
      ctx.globalAlpha = 1;
      this.text(ctx, p.name, 34, y + 2, { size: 6, color: p.dead ? '#8a7660' : '#f4ead7' });
      if (p.dead) {
        this.text(ctx, 'DOWN', 158, y + 2, { size: 6, align: 'right', color: '#e04545' });
      } else {
        ctx.fillStyle = '#3a1a24';
        ctx.fillRect(34, y + 11, 122, 4);
        ctx.fillStyle = '#e84a4a';
        ctx.fillRect(34, y + 11, Math.round(122 * clamp(p.hp / p.maxHp, 0, 1)), 4);
      }
      y += 22;
    }
    if (me.dead && !game.finished) {
      this.text(ctx, 'YOU ARE DOWN', 480, 96, { size: 12, align: 'center', color: '#e04545' });
      const helper = game.players.find((p) => !p.dead && p.reviveTarget === me && me.reviveProgress > 0);
      if (helper) {
        this.text(ctx, `${helper.name.toUpperCase()} IS REVIVING YOU`, 480, 120, { size: 7, align: 'center', color: '#8cff9a' });
        this.bar(ctx, 400, 136, 160, 6, me.reviveProgress / CONFIG.multiplayer.revive.time, '#8cff9a', '#1a2a1e');
      } else {
        const how = `A teammate can revive you: hold ${Settings.label('interact')} by your body for ${CONFIG.multiplayer.revive.time}s`;
        this.text(ctx, game.run ? `${how} (or you get up at the next stage)` : how, 480, 120, { size: 7, align: 'center', color: '#d8c8a0' });
      }
    }
  },

  /** The profile's gems (in the lobby, where they're spent on enhancements at the hero statues). */
  drawGems(ctx, gems) {
    const x = 244;
    const y = 14;
    const img = Sprites.vault.gemIcon;
    const w = 26 + `${gems}`.length * 7;
    this.panel(ctx, x, y - 1, w, 16);
    ctx.drawImage(img, x + 2, y);
    this.text(ctx, `${gems}`, x + w - 4, y + 3, { size: 8, align: 'right', color: '#8ac8ff' });
  },

  /** The local hero's purse (coins are per hero). */
  drawCoins(ctx, hero) {
    const x = 244;
    const y = 14;
    const pop = hero.coinFlash > 0 ? 2 : 0;
    this.panel(ctx, x, y - 1, 58, 16);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 3 - pop / 2, y + 1 - pop / 2, 12 + pop, 12 + pop);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(x + 4 - pop / 2, y + 2 - pop / 2, 10 + pop, 10 + pop);
    ctx.fillStyle = '#ffd34a';
    ctx.fillRect(x + 4 - pop / 2, y + 2 - pop / 2, 9 + pop, 9 + pop);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(x + 6, y + 4, 2, 5);
    this.text(ctx, `${hero.coins}`, x + 54, y + 3, { size: 8, align: 'right', color: hero.coinFlash > 0 ? '#fff2a0' : '#ffd34a' });
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
      this.bar(ctx, 60, 34, 170, 8, r.value / r.max, r.color, '#1c1410');
      // run dry (or just refused for being short): the bar's rim and label go red
      const out = r.value < 1;
      const warn = out || (p.resourceShort > 0 && Math.floor(performance.now() / 90) % 2 === 0);
      if (warn) {
        ctx.strokeStyle = '#ff3a3a';
        ctx.lineWidth = 2;
        ctx.strokeRect(57, 31, 176, 14);
      }
      this.text(ctx, out ? `OUT OF ${r.name}!` : `${r.name} ${Math.floor(r.value)}`, 145, 34, { size: 6, align: 'center', color: warn ? '#ff4a4a' : '#f4ead7' });
      y = 50;
    }
    this.text(ctx, p.cfg.name.toUpperCase(), 60, y, { size: 8, color: '#f2a541' });
    this.text(ctx, this.statusText(p), 148, y, { size: 7, color: '#d8c8a0' });
    const info = p.passiveInfo;
    this.drawPassive(ctx, info, 12, y + 16);
    this.drawBuffs(ctx, p, 12, y + 16 + (info ? (info.maxPips || info.bar != null ? 26 : 15) + 8 : 0));

    // abilities
    const icons = Sprites.icons[p.classId];
    for (const s of this.abilitySlots(p)) {
      if (s.slot === 'q') { this.ultSlot(ctx, s.x, s.y, p); continue; }
      const icon = s.icon || (s.slot === 'dodge' ? Sprites.icons.dodge : icons[s.slot]);
      const cd = s.cd ?? p.cooldowns[s.slot];
      const max = s.max ?? p.maxCooldowns[s.slot];
      // a slot glows while its ability is held (the knight's raised shield), or when an extra is armed
      const armed = s.slot && p.slotHeld(s.slot) ? 'held' : !!s.armed;
      const short = s.slot && !p.canAfford(s.slot) ? p.resource.name : null;
      const charges = s.slot === 'dodge' ? Upgrades.dodgeCharges(p) : s.slot ? p.slotCharges?.[s.slot] : null;   // (Burst Dodging: two dodges)
      this.abilitySlot(ctx, s.x, s.y, s.key, s.name, cd, max, icon, charges, armed, s.slot || s.name, short);
    }
    this.drawInventory(ctx, p);
  },

  /**
   * The ability slots along the bottom right, ending with the ultimate in the corner:
   * [{ key, name, slot, guide, x, y, w, h, ...extra }]. guide is the slot's entry in heroGuide.
   */
  abilitySlots(p) {
    const slots = [
      { key: 'LMB', name: p.icons.primary, slot: 'primary' },
      { key: 'RMB', name: p.icons.secondary, slot: 'secondary' },
      { key: Settings.label('e'), name: p.icons.e, slot: 'e' },
      { key: Settings.label('f'), name: p.icons.f, slot: 'f' },
      { key: Settings.label('dodge'), name: 'DODGE', slot: 'dodge' },
    ];
    // class extras (the knight's shield bash) go right after the slot they belong to
    for (const extra of p.extraSlots) slots.splice(slots.findIndex((s) => s.slot === extra.after) + 1, 0, extra);
    const x0 = 960 - 14 - 70 - 6 - slots.length * 70;
    slots.forEach((s, i) => Object.assign(s, { x: x0 + i * 70, y: 474, w: 62, h: 50, guide: s.slot || s.guide }));
    slots.push({ key: Settings.label('ult'), name: p.icons.q, slot: 'q', guide: 'q', x: 960 - 14 - 70, y: 474, w: 70, h: 50 });
    return slots;
  },

  /**
   * Hovering the mouse over an ability slot: its name and one short line on what it
   * does (HERO_TIPS; the lobby's hero panel has the full descriptions).
   */
  drawAbilityTooltip(ctx, p) {
    if (this.bagDrag) return;
    const m = Input._mouse;
    const s = this.abilitySlots(p).find((o) => m.x >= o.x && m.x < o.x + o.w && m.y >= o.y && m.y < o.y + o.h);
    if (!s) return;
    let title;
    let sub;
    if (s.guide === 'dodge') {
      title = `Dodge (${s.key})`;
      sub = 'Quick dash, untouchable for a moment.';
    } else {
      this.guideCache = this.guideCache?.id === p.classId ? this.guideCache : { id: p.classId, guide: heroGuide(p.classId) };
      const a = this.guideCache.guide.abilities.find((o) => o.icon === s.guide);
      if (!a) return;
      title = `${a.name} (${s.key})`;
      sub = HERO_TIPS[p.classId]?.[s.guide] || a.desc;
    }
    if (s.slot && s.slot !== 'dodge' && !p.canAfford(s.slot)) sub += ` Not enough ${p.resource.name.toLowerCase()}.`;
    this.tooltip(ctx, s.x + s.w / 2, s.y - 8, title, '#f2a541', sub);
  },

  /**
   * A small dark box with a title (and an optional line under it), centred on
   * x with its bottom at y, kept on screen.
   */
  tooltip(ctx, x, y, title, color = '#f4ead7', sub = '') {
    ctx.font = uiFont(7);
    const tw = ctx.measureText(title).width;
    // the sub line wraps at about 280px
    ctx.font = uiFont(5);
    const lines = [];
    for (const word of sub ? sub.split(' ') : []) {
      const last = lines[lines.length - 1];
      if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= 280) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    const sw = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const w = Math.ceil(Math.max(tw, sw)) + 12;
    const h = 17 + lines.length * 10;
    const bx = Math.round(clamp(x - w / 2, 4, 960 - w - 4));
    const by = Math.round(y - h);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(34, 23, 16, 0.96)';
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, w, 1);
    this.text(ctx, title, bx + w / 2, by + 4, { size: 7, align: 'center', color });
    lines.forEach((l, i) => this.text(ctx, l, bx + w / 2, by + 16 + i * 10, { size: 5, align: 'center', color: '#d8cfe4' }));
  },

  /** The name of the potion on the floor under the mouse / crosshair. */
  drawPickupHover(ctx, game) {
    const cam = game.camera;
    const m = cam.screenToWorld(Input._mouse.x, Input._mouse.y);
    let best = null;
    let bestD = 18;
    for (const pk of game.pickups) {
      if (!(pk instanceof PotionPickup) || pk.dead) continue;
      const d = dist(m.x, m.y, pk.x, pk.y - 12);
      if (d < bestD) { bestD = d; best = pk; }
    }
    if (!best) return;
    const pot = POTIONS[best.id];
    const name = best.count > 1 ? `${pot.name} x${best.count}` : pot.name;
    this.tooltip(ctx, best.x - cam.x, best.y - cam.y - 30, name, POTION_COLORS[pot.family][1]);
  },

  // ---------- upgrades (shown per hero on the scoreboard) ----------

  /**
   * A hero's upgrades as a row of icon tiles from (x, y), UPGRADE_TILE px apart, wrapping
   * every perRow: hero upgrades framed in gold; a cooldown darkens the tile from the top
   * with the time left; stacks and counters in the corner; a pulsing rim in the upgrade's
   * colour while it's active; a white flash whenever it goes off. Returns the tile under
   * the mouse ({ u, x, y, s, cd }) or null.
   */
  drawUpgradeTiles(ctx, p, x0, y0, perRow) {
    const owned = SHOP_UPGRADES.filter((u) => p.upgradeLevels[u.id]);
    const now = p.lastWorld?.time ?? 0;
    const flash = p.upg?.flash || {};
    const m = Input._mouse;
    const s = 22;
    let hover = null;
    owned.forEach((u, i) => {
      const x = x0 + (i % perRow) * UPGRADE_TILE;
      const y = y0 + Math.floor(i / perRow) * UPGRADE_TILE;
      const info = u.hud ? u.hud(p) : {};
      this.panel(ctx, x, y, s, s);
      if (u.hero) {
        ctx.fillStyle = '#ffd34a';
        ctx.fillRect(x - 1, y - 1, s + 2, 1);
        ctx.fillRect(x - 1, y + s, s + 2, 1);
        ctx.fillRect(x - 1, y, 1, s);
        ctx.fillRect(x + s, y, 1, s);
      }
      ctx.drawImage(Sprites.upgrades[u.id], x + 1, y + 1);
      const cd = info.cd || 0;
      if (cd > 0) {
        const r = clamp(cd / (info.max || 1), 0, 1);
        ctx.fillStyle = 'rgba(10, 6, 18, 0.7)';
        ctx.fillRect(x, y, s, Math.ceil(s * r));
        this.text(ctx, cd >= 60 ? `${Math.ceil(cd / 60)}m` : `${Math.ceil(cd)}`, x + s / 2, y + 7, { size: 5, align: 'center', color: '#ffffff' });
      } else if (info.active) {
        ctx.save();
        ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 120) * 0.35;
        ctx.strokeStyle = u.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
        ctx.restore();
      }
      if (info.count) this.text(ctx, `${info.count}`, x + s - 1, y + s - 7, { size: 5, align: 'right', color: '#ffe680' });
      const since = now - (flash[u.id] ?? -99);
      if (since >= 0 && since < 0.5) {
        ctx.fillStyle = `rgba(255, 255, 240, ${0.8 * (1 - since / 0.5)})`;
        ctx.fillRect(x, y, s, s);
      }
      if (m.x >= x && m.x < x + s && m.y >= y && m.y < y + s) hover = { u, x, y, s, cd };
    });
    return hover;
  },

  /** What an upgrade tile under the mouse does (and its cooldown). */
  upgradeTooltip(ctx, hover) {
    const { u, cd } = hover;
    const who = u.hero ? ` (${CONFIG.classes[u.hero].name.toUpperCase()})` : '';
    const cdText = u.cooldown ? (cd > 0 ? ` Recharging: ${Math.ceil(cd)}s.` : ` Cooldown ${u.cooldown >= 60 ? `${u.cooldown / 60} min` : `${u.cooldown}s`}: ready.`) : '';
    this.tooltip(ctx, hover.x + hover.s / 2, hover.y - 4, u.name + who, u.color, u.desc + cdText);
  },

  // ---------- the bag (bottom left) ----------

  bagDrag: null,   // { from } while a bag slot is being dragged with the mouse (this screen only)

  /** Screen rect of bag slot i (shared by drawing and the mouse). */
  bagSlotRect(i) { return { x: 14 + i * 44, y: 484, s: 40 }; },

  /** The bag slot under a screen point, or -1. */
  bagSlotAt(mx, my) {
    for (let i = 0; i < 5; i++) {
      const r = this.bagSlotRect(i);
      if (mx >= r.x - 2 && mx < r.x + r.s + 2 && my >= r.y - 2 && my < r.y + r.s + 2) return i;
    }
    return -1;
  },

  /** True inside the bag's area (slots, gaps and a margin): letting go of a drag here doesn't drop anything. */
  inBag(mx, my) {
    const a = this.bagSlotRect(0);
    const b = this.bagSlotRect(4);
    return mx >= a.x - 14 && mx < b.x + b.s + 14 && my >= a.y - 26;
  },

  /**
   * Mouse on the bag, run before the hero reads its input: drag a slot onto
   * another to move / swap / stack it, drag it out of the bag to drop it on
   * the floor (for a teammate, or to make space), right click a slot to drink it. Clicks
   * that land on the bag are swallowed so they don't also attack. Moves go out
   * as commands so every machine applies them on the same tick.
   * p: this screen's hero, or null when not playing (cancels a drag).
   */
  handleBagMouse(p) {
    const m = Input._mouse;
    if (!p || p.dead) { this.bagDrag = null; return; }
    if (this.bagDrag) {
      m.left = m.leftPressed = false;
      if (m.leftReleased) {
        const to = this.bagSlotAt(m.x, m.y);
        if (to >= 0 && to !== this.bagDrag.from) App.command({ type: 'moveItem', from: this.bagDrag.from, to });
        else if (!this.inBag(m.x, m.y)) App.command({ type: 'dropItem', slot: this.bagDrag.from });
        this.bagDrag = null;
      }
      return;
    }
    const over = this.bagSlotAt(m.x, m.y);
    if (over < 0) return;
    if (m.leftPressed) {
      m.left = m.leftPressed = false;
      if (p.inventory[over] && !m.leftReleased) this.bagDrag = { from: over };
    }
    if (m.rightPressed) {
      m.right = m.rightPressed = false;
      // same as pressing that slot's key
      if (p.inventory[over]) Input.pressedKeys.add(Input.codesFor(`item${over + 1}`)[0]);
    }
  },

  /**
   * Bottom-left: the 5-slot bag of bought potions, each with the key that
   * drinks it and how many. While dragging, the potion follows the mouse.
   */
  drawInventory(ctx, p) {
    const drag = this.bagDrag && p.inventory[this.bagDrag.from] ? this.bagDrag : null;
    const m = Input._mouse;
    const first = this.bagSlotRect(0);
    this.text(ctx, 'BAG', first.x + 2, first.y - 19, { size: 5, color: '#a99bbd' });
    this.text(ctx, 'DRAG: MOVE / OUT TO DROP  RMB: DRINK', first.x + 24, first.y - 19, { size: 5, color: '#8a7660' });
    const hover = this.bagSlotAt(m.x, m.y);
    p.inventory.forEach((slot, i) => {
      const { x: sx, y: sy, s } = this.bagSlotRect(i);
      this.panel(ctx, sx, sy, s, s);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(sx + 3, sy + 3, s - 6, s - 6);
      if (drag && hover === i && i !== drag.from) {
        ctx.strokeStyle = '#ffe680';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, s - 2, s - 2);
      }
      const key = Settings.label(`item${i + 1}`);
      if (!slot) {
        this.text(ctx, key, sx + 3, sy + 3, { size: 5, color: '#6a5a7e' });
        return;
      }
      const icon = Sprites.potions[slot.id];
      if (drag && drag.from === i) ctx.globalAlpha = 0.3;
      ctx.drawImage(icon, sx + s / 2 - icon.width / 2, sy + s / 2 - icon.height / 2 + 2);
      ctx.globalAlpha = 1;
      // its effect is still running (and this one isn't stronger): greyed out with the time left
      const blocking = p.brewBlocking(POTIONS[slot.id]);
      if (blocking) {
        ctx.fillStyle = 'rgba(10, 6, 18, 0.65)';
        ctx.fillRect(sx, sy, s, s);
        this.text(ctx, `${Math.ceil(blocking.t)}s`, sx + s / 2, sy + s / 2 - 4, { size: 6, align: 'center', color: '#d8c8a0' });
      }
      this.text(ctx, key, sx + 3, sy + 3, { size: 6, color: '#f2a541' });
      if (slot.count > 1) this.text(ctx, `x${slot.count}`, sx + s - 3, sy + s - 9, { size: 6, align: 'right', color: '#ffffff' });
    });
    if (!drag && hover >= 0 && p.inventory[hover]) {
      const pot = POTIONS[p.inventory[hover].id];
      const r = this.bagSlotRect(hover);
      const blocking = p.brewBlocking(pot);
      const note = blocking ? ` Can't drink yet: ${BREW_LABELS[pot.family]} ${TIER_MARKS[blocking.tier]} is still running.` : '';
      this.tooltip(ctx, r.x + r.s / 2, r.y - 24, `${pot.name} (${TIER_MARKS[pot.tier]})`, POTION_COLORS[pot.family][1], pot.desc + note);
    }
    if (drag) {
      const icon = Sprites.potions[p.inventory[drag.from].id];
      ctx.drawImage(icon, m.x - icon.width / 2, m.y - icon.height / 2);
      if (!this.inBag(m.x, m.y)) this.text(ctx, 'DROP', m.x, m.y + 16, { size: 6, align: 'center', color: '#ffe680' });
    }
  },

  /**
   * When an ability comes off cooldown its slot flashes: a white burst, a gold
   * ring growing out of the slot and "READY!" popping up. Only for cooldowns of
   * a second or more, so rapid attacks don't flicker. Visual only.
   */
  readyFlash(ctx, id, cd, x, y, w, h) {
    this.slotState = this.slotState || {};
    const st = this.slotState[id] || (this.slotState[id] = { peak: 0, flash: -1e9 });
    const now = performance.now();
    if (cd > 0) st.peak = Math.max(st.peak, cd);
    else if (st.peak > 0) {
      if (st.peak >= 1) st.flash = now;
      st.peak = 0;
    }
    const t = (now - st.flash) / 700;
    if (t >= 1) return;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 230, ${0.75 * (1 - t) * (1 - t)})`;
    ctx.fillRect(x, y, w, h);
    const g = Math.round(t * 10);
    ctx.strokeStyle = `rgba(255, 220, 90, ${1 - t})`;
    ctx.lineWidth = 3 - t * 2;
    ctx.strokeRect(x - g + 0.5, y - g + 0.5, w + g * 2 - 1, h + g * 2 - 1);
    ctx.restore();
    if (t < 0.85) {
      const pop = t < 0.15 ? 1.4 - t * 2.6 : 1;
      this.text(ctx, 'READY!', x + w / 2, y - 10 - t * 6, { size: Math.round(7 * pop), align: 'center', color: '#ffe680' });
    }
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
    this.text(ctx, 'PASSIVE', x + 4, y + 4, { size: 5, color: '#8a7660' });
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
        ctx.fillStyle = lit ? info.color : '#2e2018';
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
      if (bw > 10) this.bar(ctx, barX + 1, rowY + 1, bw - 2, 4, info.bar, info.color, '#1c1410');
    }
  },

  /** Mimic buffs: one chip each with its icon, name, seconds left and a draining bar. */
  drawBuffs(ctx, p, x, y) {
    let cx = x;
    for (const [type, t] of Object.entries(p.buffs)) {
      const b = CONFIG.buffs[type];
      const w = 70;
      const blink = t < 2 && Math.floor(t * 6) % 2;
      this.panel(ctx, cx, y, w, 20);
      ctx.globalAlpha = blink ? 0.5 : 1;
      const icon = Sprites.pickups[`buff_${type}`];
      ctx.drawImage(icon, cx + 1, y + 1);
      this.text(ctx, b.name, cx + 21, y + 3, { size: 6, color: b.color });
      this.text(ctx, `${Math.ceil(t)}s`, cx + w - 3, y + 3, { size: 6, align: 'right' });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1c1410';
      ctx.fillRect(cx + 21, y + 13, w - 24, 3);
      ctx.fillStyle = b.color;
      ctx.fillRect(cx + 21, y + 13, Math.round((w - 24) * clamp(t / (p.buffMax[type] || b.duration), 0, 1)), 3);
      cx += w + 6;
    }
    // potion effects: the bottle of the tier that's running, the effect's name with its tier
    // (I / II / III) and time left; a weaker one still running underneath shows as a small
    // second bar with its own tier and time. Wraps onto more rows.
    let row = 0;
    for (const [family, b] of Object.entries(p.brews)) {
      const w = 112;
      const h = b.under ? 28 : 20;
      if (cx + w > x + 330) { cx = x; row++; }
      const by = y + row * 32;
      const color = POTION_COLORS[family][1];
      const blink = b.t < 2 && Math.floor(b.t * 6) % 2;
      this.panel(ctx, cx, by, w, h);
      if (b.tier > 1) {
        // stronger tiers get a rim in their tier colour
        ctx.fillStyle = TIER_COLORS[b.tier];
        ctx.fillRect(cx, by, w, 1);
        ctx.fillRect(cx, by + h - 1, w, 1);
      }
      ctx.globalAlpha = blink ? 0.5 : 1;
      const pot = Object.values(POTIONS).find((o) => o.family === family && o.tier === b.tier)
        || Object.values(POTIONS).find((o) => o.family === family);
      ctx.drawImage(Sprites.potions[pot.id], cx - 3, by - 4, 24, 24);
      this.text(ctx, BREW_LABELS[family], cx + 21, by + 1, { size: 5, color });
      ctx.font = uiFont(5);
      const lw = ctx.measureText(BREW_LABELS[family]).width;
      this.text(ctx, TIER_MARKS[b.tier], cx + 25 + lw, by + 1, { size: 5, color: TIER_COLORS[b.tier] });
      this.text(ctx, `${Math.ceil(b.t)}s`, cx + w - 3, by + 1, { size: 5, align: 'right' });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1c1410';
      ctx.fillRect(cx + 21, by + 13, w - 24, 3);
      ctx.fillStyle = color;
      ctx.fillRect(cx + 21, by + 13, Math.round((w - 24) * clamp(b.t / (b.max || b.t), 0, 1)), 3);
      if (b.under) {
        const u = b.under;
        this.text(ctx, `${TIER_MARKS[u.tier]} UNDER`, cx + 21, by + 17, { size: 5, color: '#8a7660', shadow: false });
        this.text(ctx, `${Math.ceil(u.t)}s`, cx + w - 3, by + 17, { size: 5, align: 'right', color: '#8a7660', shadow: false });
      }
      cx += w + 6;
    }
  },

  /** Short list of active buffs/debuffs. */
  statusText(p) {
    const s = [];
    if (p.slowTime > 0) s.push('SLOWED');
    if (p.poisonTime > 0) s.push('POISONED');
    if (p.stunTime > 0) s.push('STUNNED');
    if (p.chillTime > 0) s.push('CHILLED');
    if (p.barrier && p.barrier.raised) s.push(`SHIELD ${Math.ceil(p.barrier.hp)}`);
    if (p.aegis) s.push(`AEGIS ${Math.ceil(p.aegis.hp)}`);
    if (p.bomb) s.push(`CHARGE ${Math.floor(p.bombPower * 100)}% (LMB)`);
    if (p.parryTime > 0) s.push('PARRY');
    if (p.haste > 0) s.push('HASTE');
    if (p.bird) s.push(`BIRD (${Settings.label('f')}: LAND)`);
    if (p.invisible) s.push('HIDDEN');
    if (p.rapidArrows > 0) s.push(`RAPID x${p.rapidArrows}`);
    if (p.stormReady) s.push('STORM READY');
    if (p.cleave) s.push(`POWER ${Math.floor(p.cleavePower * 100)}% (LMB)`);
    if (p.jumpCharge) s.push(`JUMP ${Math.floor(p.jumpPower * 100)}%`);
    if (p.spin) s.push(`SPIN (${Settings.label('e')}: STOP)`);
    if (p.regenerating) s.push('REGEN');
    return s.join(' ');
  },

  /** charges (optional): { count, max, refill 0-1 } for abilities with stored uses. */
  /** armed: the slot glows - true while the ability can be used right now, 'held' while it is being held (glows even on cooldown). */
  /** short: the resource's name when there isn't enough of it to use the ability (the slot goes red). */
  abilitySlot(ctx, x, y, key, name, cd, max, icon, charges = null, armed = false, id = null, short = null) {
    const w = 62;
    const h = 50;
    this.panel(ctx, x, y, w, h);
    const ready = cd <= 0;
    if ((armed && ready) || armed === 'held') {
      ctx.fillStyle = `rgba(255, 210, 90, ${0.14 + Math.sin(performance.now() / 110) * 0.08})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
    this.socket(ctx, x + w / 2, y + 7, 30, ready ? '255, 214, 120' : null);
    if (icon) {
      ctx.globalAlpha = ready ? 1 : 0.7;
      ctx.drawImage(icon, x + w / 2 - icon.width / 2, y + 8);
      ctx.globalAlpha = 1;
    }
    this.text(ctx, key, x + 4, y + 4, { size: key.length > 3 ? 5 : 6, color: ready ? '#f2a541' : '#8a7660' });
    this.text(ctx, name, x + w / 2, y + 39, { size: 5, align: 'center', color: ready ? '#f4ead7' : '#8a7660' });
    if (!ready) {
      const r = clamp(cd / max, 0, 1);
      ctx.fillStyle = 'rgba(10, 6, 18, 0.6)';
      ctx.fillRect(x, y + h * (1 - r), w, h * r);
      if (max >= 1) this.text(ctx, (Math.ceil(cd * 10) / 10).toFixed(1), x + w / 2, y + 17, { size: 8, align: 'center', color: '#ffffff' });
    } else {
      ctx.fillStyle = '#6cff7a';
      ctx.fillRect(x + 6, y + h - 4, w - 12, 2);
    }
    if (short) {
      // can't be paid for: a red wash and rim, and the name swapped for a warning
      ctx.fillStyle = 'rgba(120, 10, 16, 0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ff3a3a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#2e1f17';
      ctx.fillRect(x + 2, y + 37, w - 4, 10);
      this.text(ctx, `NO ${short}`, x + w / 2, y + 39, { size: 5, align: 'center', color: '#ff4a4a' });
    }
    if (charges) {
      this.text(ctx, `x${charges.count}`, x + w - 4, y + 4, { size: 7, align: 'right', color: charges.count ? '#ffe680' : '#8a7660' });
      // the next charge filling up
      if (charges.count < charges.max) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 5, y + 33, w - 10, 4);
        ctx.fillStyle = '#f2a541';
        ctx.fillRect(x + 6, y + 34, Math.round((w - 12) * clamp(charges.refill, 0, 1)), 2);
      }
    }
    if (id) this.readyFlash(ctx, id, cd, x, y, w, h);
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
    this.socket(ctx, x + w / 2, y + 7, 30, ready ? '255, 200, 60' : null);
    const icon = Sprites.icons[p.classId].q;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(icon, x + w / 2 - icon.width / 2, y + 8);
    ctx.globalAlpha = 1;
    this.text(ctx, Settings.label('ult'), x + 4, y + 4, { size: 6, color: ready ? '#ffe680' : '#8a7660' });
    this.text(ctx, ready ? 'READY' : `${Math.floor(r * 100)}%`, x + w / 2, y + 39, { size: 6, align: 'center', color: ready ? '#ffe680' : '#f4ead7' });
    // flash the moment it fills (treated as a cooldown of "how much is left to charge")
    this.readyFlash(ctx, 'ult', ready ? 0 : Math.max(1, (1 - r) * 10), x, y, w, h);
  },

  drawWave(ctx, game) {
    if (game.run) return game.run.drawHud(ctx);
    if (game.lobby) {
      this.text(ctx, 'LOBBY', 946, 14, { size: 10, align: 'right', color: '#f2a541' });
      this.text(ctx, `WALK TO A STATION, PRESS ${Settings.label('interact')}`, 946, 32, { size: 6, align: 'right', color: '#d8c8a0' });
      if (game.multiplayer) {
        // the room code, big enough to read out to friends
        this.panel(ctx, 786, 48, 160, 40);
        this.text(ctx, 'ROOM CODE', 866, 53, { size: 6, align: 'center', color: '#a99bbd' });
        this.text(ctx, game.code || '-----', 866, 66, { size: 14, align: 'center', color: '#ffe680' });
        this.text(ctx, `${game.players.length}/${CONFIG.multiplayer.maxPlayers} PLAYERS`, 946, 96, { size: 6, align: 'right', color: '#d8c8a0' });
      }
      return;
    }
    if (game.practice) {
      const pr = game.practice;
      const o = pr.options;
      const flags = [o.god && 'GOD', o.infiniteMana && 'INF MANA', o.infiniteEnergy && 'INF ENERGY', o.noCooldowns && 'NO CD'].filter(Boolean).join('  ');
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

  /**
   * Held Tab in a dungeon: every hero's run so far (kills, damage dealt, healing done,
   * damage taken, times downed). The best in each column gets a gold star; you're highlighted.
   */
  drawScoreboard(ctx, game) {
    const cols = [['KILLS', 'kills', '#ff8a6a'], ['DAMAGE', 'damage', '#ffd34a'], ['HEALING', 'healing', '#8cff9a'], ['TAKEN', 'taken', '#ff6a7a'], ['DEATHS', 'deaths', '#c8b8ff']];
    const players = game.players;
    const w = 600;
    const perRow = Math.floor((w - 60) / UPGRADE_TILE);
    // every hero's row: name and stats, then their upgrades underneath (one or more strips)
    const strips = (p) => Math.max(1, Math.ceil(Object.keys(p.upgradeLevels).length / perRow));
    const rowH = (p) => 30 + strips(p) * UPGRADE_TILE + 4;
    const h = 74 + players.reduce((a, p) => a + rowH(p), 0);
    const x = 480 - w / 2;
    const y = Math.max(40, 250 - h / 2);
    ctx.fillStyle = 'rgba(8, 4, 14, 0.55)';
    ctx.fillRect(0, 0, 960, 540);
    this.panel(ctx, x, y, w, h);
    const run = game.run;
    const secs = Math.floor(game.time);
    this.text(ctx, 'SCOREBOARD', x + 14, y + 10, { size: 12, color: '#f2a541' });
    this.text(ctx, `${run.theme.name.toUpperCase()}  STAGE ${run.stage}/3   ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, x + w - 14, y + 14, { size: 7, align: 'right', color: '#d8c8a0' });
    const colX = (i) => x + 250 + i * 72;
    cols.forEach(([label, , color], i) => this.text(ctx, label, colX(i), y + 40, { size: 6, align: 'center', color }));
    ctx.fillStyle = 'rgba(220, 180, 76, 0.35)';
    ctx.fillRect(x + 10, y + 52, w - 20, 1);
    const best = cols.map(([, key]) => Math.max(...players.map((p) => Game.statsOf(p)[key])));
    let ry = y + 58;
    let hover = null;
    players.forEach((p) => {
      const me = p === game.localPlayer;
      if (me) {
        ctx.fillStyle = 'rgba(255, 220, 120, 0.1)';
        ctx.fillRect(x + 8, ry - 2, w - 16, rowH(p) - 2);
      }
      // the hero's face, their name and class
      const icon = Sprites.heroes[p.classId].idle[0].img;
      ctx.globalAlpha = p.dead ? 0.45 : 1;
      this.socket(ctx, x + 28, ry, 24);
      ctx.drawImage(icon, 22, 8, 22, 22, x + 17, ry + 1, 22, 22);
      ctx.globalAlpha = 1;
      const name = p.name || (me ? 'YOU' : 'HERO');
      this.text(ctx, name.toUpperCase(), x + 48, ry + 2, { size: 7, color: me ? '#ffe680' : '#f4ead7' });
      this.text(ctx, `${CONFIG.classes[p.classId].name.toUpperCase()}${p.dead ? '  - DOWN' : ''}`, x + 48, ry + 14, { size: 5, color: p.dead ? '#e04545' : '#a99bbd' });
      const s = Game.statsOf(p);
      cols.forEach(([, key, color], i) => {
        const v = Math.round(s[key]);
        // the best in a column (deaths: no prize for those)
        const top = players.length > 1 && key !== 'deaths' && key !== 'taken' && v > 0 && v === Math.round(best[i]);
        this.text(ctx, v >= 10000 ? `${(v / 1000).toFixed(1)}K` : `${v}`, colX(i), ry + 6, { size: 8, align: 'center', color: top ? color : '#f4ead7' });
        if (top) PFX.star(ctx, colX(i) + 26, ry + 10, 2, '#ffd34a', '#ffffff');
      });
      // their upgrades
      if (Object.keys(p.upgradeLevels).length) hover = this.drawUpgradeTiles(ctx, p, x + 48, ry + 30, perRow) || hover;
      else this.text(ctx, 'NO UPGRADES YET', x + 48, ry + 36, { size: 5, color: '#6a5a7e' });
      ry += rowH(p);
    });
    this.text(ctx, `HOLD ${Settings.label('scoreboard')}`, x + w / 2, y + h - 12, { size: 5, align: 'center', color: '#8a7660' });
    if (hover) this.upgradeTooltip(ctx, hover);
  },

  // ---------- a boss's entrance ----------

  /**
   * Each boss's title card: the band's colours [shade, base, lit], its trim, the name's
   * shadow, and how tall the boss stands (world px) for its portrait.
   */
  BOSS_CARDS: {
    King: { band: ['#3e1220', '#62182c', '#8a2438'], trim: '#ecd690', glow: '255, 210, 120', h: 118 },
    Queen: { band: ['#1e1236', '#2a1840', '#46286a'], trim: '#ff6a80', glow: '255, 110, 220', h: 104 },
    Golem: { band: ['#1a2a1c', '#2e4430', '#4a6a44'], trim: '#5cf0d8', glow: '90, 240, 215', h: 150 },
    PhantomKing: { band: ['#140a20', '#24123a', '#3a2260'], trim: '#b45aff', glow: '180, 90, 255', h: 112 },
    Deathbringer: { band: ['#06040a', '#120a1c', '#22143a'], trim: '#dcb44c', glow: '150, 90, 255', h: 170 },
    RoyalPrince: { band: ['#2e1c10', '#5a3a1e', '#8a5a2e'], trim: '#ecd690', glow: '255, 210, 140', h: 100 },
    RoyalPrincess: { band: ['#141030', '#221a4a', '#3a2c70'], trim: '#c49aff', glow: '170, 130, 255', h: 100 },
  },

  /** Letterbox bars slide in while the camera pans to the boss, and out as the fight begins. */
  drawCutscene(ctx, game) {
    const cs = game.cutscene;
    const C = CONFIG.bossIntro;
    const { width: W, height: H } = CONFIG.screen;
    let k = 1;
    if (cs.stage === 'pan') k = Math.min(1, cs.t / 0.4);
    else if (cs.stage === 'card') k = Math.min(1, (C.card - cs.t) / 0.4);
    const bh = Math.round(48 * (1 - Math.pow(1 - k, 3)));
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, W, bh);
    ctx.fillRect(0, H - bh, W, bh);
    ctx.fillStyle = '#3a2a10';
    if (bh > 2) { ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1); }
    if (cs.stage === 'card') this.drawBossCard(ctx, game.boss, cs.t, C.card, cs.subtitle);
    else this.drawBossSpeech(ctx, game);
  },

  /**
   * What a boss is shouting (boss.speech, see King.say): a parchment speech bubble over
   * its head. While the boss is off screen the bubble is pinned to the nearest screen edge,
   * with a little crown on it and its tail pointing at where the boss is.
   */
  drawBossSpeech(ctx, game) {
    const b = game.boss;
    const s = b && b.speech;
    if (!s || !(s.until > b.time) || b.dying > 0) return;
    const { width: W, height: H } = CONFIG.screen;
    const cam = game.camera;
    const ax = (b.x) - cam.x - cam.offsetX;
    const ay = (b.headY ?? b.hy - 40) - 14 - cam.y - cam.offsetY;
    const age = b.time - s.at;
    const pop = Math.min(1, age / 0.12);
    const alpha = Math.min(1, (s.until - b.time) / 0.25);
    ctx.font = uiFont(10);
    const tw = Math.ceil(ctx.measureText(s.text).width);
    const bw = tw + 20;
    const bh = 22;
    const margin = 12;
    const top = 78;           // clear of the hero panel and the boss's name
    const bottom = H - 60;    // clear of the ability bar
    const onScreen = ax > margin && ax < W - margin && ay - bh - 10 > top && ay < bottom;
    // where the bubble sits: over the head, or pinned inside the screen's edge toward the boss
    let bx;
    let by;
    if (onScreen) {
      bx = ax - bw / 2;
      by = ay - bh - 10;
    } else {
      bx = clamp(ax - bw / 2, margin, W - margin - bw);
      by = clamp(ay - bh / 2, top, bottom - bh);
    }
    bx = Math.round(clamp(bx, margin, W - margin - bw));
    by = Math.round(by);
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    // the tail: straight down to the head, or from the bubble's edge toward the off-screen boss
    const ang = onScreen ? Math.PI / 2 : Math.atan2(ay - cy, ax - cx);
    const edge = Math.min(Math.abs((bw / 2) / (Math.cos(ang) || 1e-6)), Math.abs((bh / 2) / (Math.sin(ang) || 1e-6)));
    const tx = cx + Math.cos(ang) * (edge + (onScreen ? 9 : 12));
    const ty = cy + Math.sin(ang) * (edge + (onScreen ? 9 : 12));
    const side = ang + Math.PI / 2;
    const base = (k) => [cx + Math.cos(ang) * (edge - 2) + Math.cos(side) * 6 * k, cy + Math.sin(ang) * (edge - 2) + Math.sin(side) * 6 * k];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.translate(-cx, -cy);
    const tail = (grow, color) => {
      const [x1, y1] = base(1 + grow * 0.4);
      const [x2, y2] = base(-1 - grow * 0.4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(tx + Math.cos(ang) * grow, ty + Math.sin(ang) * grow);
      ctx.lineTo(x2, y2);
      ctx.fill();
    };
    // outline, then the parchment, lit along the top and shaded along the bottom
    tail(2, OUTLINE);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 2, by - 1, bw + 4, bh + 2);
    ctx.fillRect(bx - 1, by - 2, bw + 2, bh + 4);
    ctx.fillStyle = '#f4ead7';
    ctx.fillRect(bx, by, bw, bh);
    tail(0, '#f4ead7');
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(bx + 1, by + 1, bw - 2, 2);
    ctx.fillStyle = '#d8c4a0';
    ctx.fillRect(bx + 1, by + bh - 3, bw - 2, 2);
    // a shout shakes for a moment as it lands
    const jolt = age < 0.25 ? Math.round(Math.sin(age * 80) * 1.5) : 0;
    this.text(ctx, s.text, Math.round(cx) + jolt, by + 6, { size: 10, align: 'center', color: '#8a2438', shadow: false });
    // off screen: a little gold crown on the bubble says who's talking
    if (!onScreen) {
      const kx = bx + bw - 6;
      const ky = by - 6;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(kx - 7, ky - 4, 14, 9);
      ctx.fillStyle = '#c8a456';
      ctx.fillRect(kx - 6, ky - 1, 12, 5);
      for (const sx of [-6, -1, 4]) ctx.fillRect(kx + sx, ky - 3, 2, 3);
      ctx.fillStyle = '#ecd690';
      ctx.fillRect(kx - 6, ky - 1, 12, 1);
      ctx.fillStyle = '#8a2438';
      ctx.fillRect(kx - 1, ky + 1, 2, 2);
    }
    ctx.restore();
  },

  /** The boss drawn into an offscreen canvas (its own art, nothing round it), and its black silhouette. */
  bossPortrait(boss, h) {
    const w = Math.round(h * 1.9);
    const ph = Math.round(h + 14);
    if (!this.portrait || this.portrait.width !== w || this.portrait.height !== ph) {
      this.portrait = document.createElement('canvas');
      this.portrait.width = w;
      this.portrait.height = ph;
      this.portraitShade = document.createElement('canvas');
      this.portraitShade.width = w;
      this.portraitShade.height = ph;
    }
    const feet = boss.drawY ?? boss.y;
    const p = this.portrait.getContext('2d');
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.clearRect(0, 0, w, ph);
    p.imageSmoothingEnabled = false;
    p.translate(Math.round(w / 2 - boss.x), Math.round(ph - 8 - feet));
    if (boss.drawPortrait) boss.drawPortrait(p);
    else boss.getDrawables().sort((a, b) => a.y - b.y).forEach((it) => it.draw(p));
    const s = this.portraitShade.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, w, ph);
    s.drawImage(this.portrait, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = OUTLINE;
    s.fillRect(0, 0, w, ph);
    return { img: this.portrait, shade: this.portraitShade, feet: ph - 8 };
  },

  /**
   * The title card: a white slash strikes across the screen and bursts open into a band
   * in the boss's colours, its name slams in from the left, and the boss itself rises
   * into the band from the right (most of it showing, its feet cut off by the band's
   * lower edge, its head breaking out above the band).
   */
  drawBossCard(ctx, boss, t, total, subtitle) {
    const W = CONFIG.screen.width;
    const card = this.BOSS_CARDS[boss.constructor.name] || this.BOSS_CARDS.King;
    const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
    const out = clamp((t - (total - 0.35)) / 0.35, 0, 1);   // the card leaving
    const cy = 318;
    const fullH = 118;
    const bandH = Math.round(fullH * ease((t - 0.1) / 0.2) * (1 - ease(out)));
    const top = cy - Math.floor(bandH / 2);
    const bottom = top + bandH;
    ctx.save();
    // the world dims behind it
    ctx.fillStyle = `rgba(5, 3, 10, ${0.45 * ease(t / 0.2) * (1 - out)})`;
    ctx.fillRect(0, 48, W, CONFIG.screen.height - 96);
    // the strike: a white-hot slash cutting across the screen
    if (t < 0.32) {
      const k = ease(t / 0.14);
      const fade = 1 - clamp((t - 0.14) / 0.18, 0, 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
      ctx.beginPath();
      ctx.moveTo(-40, cy + 3);
      ctx.lineTo(-40 + (W + 80) * k, cy - 4);
      ctx.lineTo(-40 + (W + 80) * k, cy + 2);
      ctx.lineTo(-40, cy + 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, -40 + (W + 80) * k, cy, 40, card.glow, fade, 2, 16);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (bandH > 2) {
      // the band: dark outline, a trim line, lit along the top, shaded along the bottom
      const [shade, base, lit] = card.band;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, top - 4, W, bandH + 8);
      ctx.fillStyle = card.trim;
      ctx.fillRect(0, top - 2, W, 2);
      ctx.fillRect(0, bottom, W, 2);
      ctx.fillStyle = base;
      ctx.fillRect(0, top, W, bandH);
      ctx.fillStyle = lit;
      ctx.fillRect(0, top, W, Math.min(4, bandH));
      ctx.fillStyle = shade;
      ctx.fillRect(0, bottom - Math.min(6, bandH), W, Math.min(6, bandH));
      // speed stripes racing left across it
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top + 4, W, Math.max(0, bandH - 10));
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      const off = (t * 520) % 64;
      for (let x = -64; x < W + 64; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x - off, bottom);
        ctx.lineTo(x - off + 22, bottom);
        ctx.lineTo(x - off + 22 + bandH * 0.6, top);
        ctx.lineTo(x - off + bandH * 0.6, top);
        ctx.fill();
      }
      ctx.restore();
    }
    // the boss rises into the band from the right
    const P = this.bossPortrait(boss, card.h);
    const scale = clamp(Math.round(300 / card.h), 2, 3);
    const slide = 1 - ease((t - 0.18) / 0.32);
    const px = Math.round(700 + slide * 340 + ease(out) * 340);
    const feetY = bottom + Math.round(card.h * scale * 0.2);   // the lowest fifth is hidden under the band's edge
    const dw = P.img.width * scale;
    const dh = P.img.height * scale;
    const dx = px - dw / 2;
    const dy = feetY - P.feet * scale;
    if (bandH > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, bottom);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, px, bottom - card.h * scale * 0.4, card.h * scale * 0.55, card.glow, 0.35 * (1 - out), 3);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.8 * (1 - out);
      ctx.drawImage(P.shade, dx + 2 * scale, dy + 2 * scale, dw, dh);          // a hard drop shadow
      ctx.globalAlpha = 1 - out;
      ctx.drawImage(P.img, dx, dy, dw, dh);
      // a bright flash as it lands in place
      const flash = 1 - clamp((t - 0.5) / 0.2, 0, 1);
      if (t > 0.45 && flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash * 0.8;
        ctx.drawImage(P.img, dx, dy, dw, dh);
        ctx.drawImage(P.img, dx, dy, dw, dh);
      }
      ctx.restore();
    }
    // the name slams in from the left, the title under it
    if (bandH > 20) {
      const nx = Math.round(56 - (1 - ease((t - 0.16) / 0.26)) * 520 - ease(out) * 520);
      const big = 30;
      const ny = cy - 30;
      ctx.globalAlpha = 1 - out;
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [0, 4], [2, 4], [-2, 4]]) {
        this.text(ctx, boss.name, nx + ox, ny + oy, { size: big, color: OUTLINE, shadow: false });
      }
      this.text(ctx, boss.name, nx, ny + 2, { size: big, color: card.trim, shadow: false });
      this.text(ctx, boss.name, nx, ny, { size: big, color: '#ffffff', shadow: false });
      if (subtitle) {
        const sx = Math.round(nx + 6 + (1 - ease((t - 0.3) / 0.25)) * -200);
        this.text(ctx, subtitle.toUpperCase(), sx, cy + 20, { size: 9, color: card.trim });
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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

  /**
   * The aiming crosshair, in the style and size picked in the settings (Settings.data
   * .crosshair / .crosshairSize): 'cross' four white ticks round a gap, 'dot' a single
   * gold dot, 'circle' a gold ring, 'both' the ring broken into four arcs with the ticks
   * crossing it. Every style has a glowing centre and dark outlines, so it reads on any floor.
   */
  drawCrosshair(ctx, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    const type = Settings.data.crosshair || 'both';
    const k = Settings.data.crosshairSize || 1;
    const R = Math.round(12 * k);                // ring radius
    const tick = Math.max(4, Math.round(10 * k)); // tick length
    const gap = type === 'cross' ? Math.max(3, Math.round(4 * k)) : R - Math.round(tick / 2) - 1;
    ctx.save();
    // soft glow behind, so it never gets lost in a busy fight
    const glowR = type === 'dot' ? 6 * k + 4 : R + 6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0, 'rgba(255, 220, 120, 0.22)');
    g.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);
    // the ring: whole for 'circle', four arcs between the ticks for 'both'
    if (type === 'circle' || type === 'both') {
      for (const [w, col] of [[5, OUTLINE], [2, '#ffd36a']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        if (type === 'circle') {
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.stroke();
        } else {
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.arc(x, y, R, a - 0.5, a + 0.5);
            ctx.stroke();
          }
        }
      }
    }
    // the ticks: from `gap` out from the centre, tick px long
    if (type === 'cross' || type === 'both') {
      const bar = (dx, dy, w, h) => ctx.fillRect(x + dx, y + dy, w, h);
      ctx.fillStyle = OUTLINE;
      bar(-gap - tick - 1, -2, tick + 2, 4); bar(gap - 1, -2, tick + 2, 4);
      bar(-2, -gap - tick - 1, 4, tick + 2); bar(-2, gap - 1, 4, tick + 2);
      ctx.fillStyle = '#ffffff';
      bar(-gap - tick, -1, tick, 2); bar(gap, -1, tick, 2);
      bar(-1, -gap - tick, 2, tick); bar(-1, gap, 2, tick);
    }
    // the centre: a bigger dot when it's all there is
    const d = type === 'dot' ? Math.max(2, Math.round(3 * k)) : 1;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - d - 1, y - d - 1, d * 2 + 2, d * 2 + 2);
    ctx.fillStyle = '#ffd36a';
    ctx.fillRect(x - d, y - d, d * 2, d * 2);
    if (type === 'dot') {
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(x - d, y - d, Math.max(1, d - 1), Math.max(1, d - 1));
    }
    ctx.restore();
  },
};
