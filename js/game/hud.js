// Heads-up display, drawn in screen space on top of the world.

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
    this.drawPickupHover(ctx, game);
    // always this screen's hero (game.player is the boss's target while a boss updates)
    this.drawPlayer(ctx, game.localPlayer);
    if (game.run) this.drawCoins(ctx, game.localPlayer);
    if (game.multiplayer) this.drawParty(ctx, game);
    this.drawWave(ctx, game);
    if (game.boss && !game.boss.dead && game.boss.intro <= 0 && !game.practice) {
      this.text(ctx, game.boss.name, 480, 12, { size: 10, align: 'center', color: '#f2a541' });
    }
    this.drawBanner(ctx, game);
    const p = game.localPlayer;
    if (game.run?.active && p.strayTime > 0) {
      const left = Math.max(0, CONFIG.run.strayReturn - p.strayTime).toFixed(1);
      this.text(ctx, `OUTSIDE THE ROOM - RETURNING IN ${left}s`, 480, 400, { size: 8, align: 'center', color: '#e0c0ff' });
    }
    if (p.targeting) {
      const msg = p.classId === 'mage' ? 'LEFT CLICK: PICK LIGHTNING TARGET   RIGHT CLICK: CANCEL' : 'LEFT CLICK: FIRE VOLLEY   RIGHT CLICK: CANCEL';
      this.text(ctx, msg, 480, 440, { size: 8, align: 'center', color: p.classId === 'mage' ? '#9cf0d8' : '#a8cc6a' });
    }
    if (p.placing) {
      this.text(ctx, 'LEFT CLICK: PLACE DRAIN CIRCLE   RIGHT CLICK: CANCEL', 480, 440, { size: 8, align: 'center', color: '#9cf0d8' });
    }
    if (p.placingRune) {
      this.text(ctx, 'LEFT CLICK: PLACE HEALING RUNE   RIGHT CLICK: CANCEL', 480, 440, { size: 8, align: 'center', color: '#9cf0a0' });
    }
    if (p.choosingAegis) {
      this.text(ctx, 'LEFT CLICK: AEGIS ON ALLY', 474, 440, { size: 8, align: 'right', color: '#ffe680' });
      this.text(ctx, 'RIGHT CLICK: AEGIS ON SELF', 486, 440, { size: 8, color: '#ffe680' });
      this.text(ctx, `${Settings.label('f')}: CANCEL`, 480, 456, { size: 6, align: 'center', color: '#d8c8a0' });
    }
    if (p.choosingArrow) {
      this.text(ctx, 'LEFT CLICK: FIRE ARROW', 474, 440, { size: 8, align: 'right', color: '#ff8a1e' });
      this.text(ctx, 'RIGHT CLICK: ICE ARROW', 486, 440, { size: 8, color: '#9ad0ff' });
      this.text(ctx, `${Settings.label('f')}: CANCEL`, 480, 456, { size: 6, align: 'center', color: '#d8c8a0' });
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
    if (others.length) this.text(ctx, 'PARTY', 14, y - 12, { size: 6, color: '#7a6a8a' });
    for (const p of others) {
      this.panel(ctx, 12, y, 150, 18);
      const icon = Sprites.heroes[p.classId].idle[0].img;
      ctx.globalAlpha = p.dead ? 0.4 : 1;
      ctx.drawImage(icon, 22, 8, 22, 22, 13, y, 18, 18);
      ctx.globalAlpha = 1;
      this.text(ctx, p.name, 34, y + 2, { size: 6, color: p.dead ? '#7a6a8a' : '#f4ead7' });
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
      this.bar(ctx, 60, 34, 170, 8, r.value / r.max, r.color, '#1a1a30');
      this.text(ctx, `${r.name} ${Math.floor(r.value)}`, 145, 34, { size: 6, align: 'center' });
      y = 50;
    }
    this.text(ctx, p.cfg.name.toUpperCase(), 60, y, { size: 8, color: '#f2a541' });
    this.text(ctx, this.statusText(p), 148, y, { size: 7, color: '#d8c8a0' });
    const info = p.passiveInfo;
    this.drawPassive(ctx, info, 12, y + 16);
    this.drawBuffs(ctx, p, 12, y + 16 + (info ? (info.maxPips || info.bar != null ? 26 : 15) + 8 : 0));

    // abilities
    const slots = [
      { key: 'LMB', name: p.icons.primary, slot: 'primary' },
      { key: 'RMB', name: p.icons.secondary, slot: 'secondary' },
      { key: Settings.label('e'), name: p.icons.e, slot: 'e' },
      { key: Settings.label('f'), name: p.icons.f, slot: 'f' },
      { key: Settings.label('dodge'), name: 'DODGE', slot: 'dodge' },
    ];
    // class extras (the knight's shield bash) go right after the slot they belong to
    for (const extra of p.extraSlots) slots.splice(slots.findIndex((s) => s.slot === extra.after) + 1, 0, extra);
    // abilities sit bottom-right, ending with the ultimate in the corner
    const icons = Sprites.icons[p.classId];
    const x0 = 960 - 14 - 70 - 6 - slots.length * 70;
    slots.forEach((s, i) => {
      const icon = s.icon || (s.slot === 'dodge' ? Sprites.icons.dodge : icons[s.slot]);
      const cd = s.cd ?? p.cooldowns[s.slot];
      const max = s.max ?? p.maxCooldowns[s.slot];
      // a slot glows while its ability is held (the knight's raised shield), or when an extra is armed
      const armed = s.slot && p.slotHeld(s.slot) ? 'held' : !!s.armed;
      this.abilitySlot(ctx, x0 + i * 70, 474, s.key, s.name, cd, max, icon, s.slot ? p.slotCharges?.[s.slot] : null, armed, s.slot || s.name);
    });
    this.ultSlot(ctx, 960 - 14 - 70, 474, p);
    this.drawInventory(ctx, p);
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
    ctx.fillStyle = 'rgba(20, 14, 32, 0.95)';
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
    this.text(ctx, 'DRAG: MOVE / OUT TO DROP  RMB: DRINK', first.x + 24, first.y - 19, { size: 5, color: '#7a6a8a' });
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
      ctx.fillStyle = '#1a1a30';
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
      ctx.fillStyle = '#1a1a30';
      ctx.fillRect(cx + 21, by + 13, w - 24, 3);
      ctx.fillStyle = color;
      ctx.fillRect(cx + 21, by + 13, Math.round((w - 24) * clamp(b.t / (b.max || b.t), 0, 1)), 3);
      if (b.under) {
        const u = b.under;
        this.text(ctx, `${TIER_MARKS[u.tier]} UNDER`, cx + 21, by + 17, { size: 5, color: '#7a6a8a', shadow: false });
        this.text(ctx, `${Math.ceil(u.t)}s`, cx + w - 3, by + 17, { size: 5, align: 'right', color: '#7a6a8a', shadow: false });
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
    if (p.spin) s.push(`SPIN (${Settings.label('e')}: STOP)`);
    if (p.regenerating) s.push('REGEN');
    return s.join(' ');
  },

  /** charges (optional): { count, max, refill 0-1 } for abilities with stored uses. */
  /** armed: the slot glows - true while the ability can be used right now, 'held' while it is being held (glows even on cooldown). */
  abilitySlot(ctx, x, y, key, name, cd, max, icon, charges = null, armed = false, id = null) {
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
    if (charges) {
      this.text(ctx, `x${charges.count}`, x + w - 4, y + 4, { size: 7, align: 'right', color: charges.count ? '#ffe680' : '#7a6a8a' });
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
    this.text(ctx, Settings.label('ult'), x + 4, y + 4, { size: 6, color: ready ? '#ffe680' : '#7a6a8a' });
    const icon = Sprites.icons[p.classId].q;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(icon, x + w / 2 - icon.width / 2, y + 8);
    ctx.globalAlpha = 1;
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
