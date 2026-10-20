// The lobby: an open room the hero walks around between runs (Soul Knight style).
// Stations: one statue per hero (pick a hero), the tech workshop (a tinkerer and machines), the
// map legend board, the bestiary lectern, the potion guide's alchemy table,
// the practice range, and the dungeon gate. Walk up to one and press E.

// Lobby room size in tiles (bigger than the screen, so the camera follows the hero).
const LOBBY_LAYOUT = { cols: 34, rows: 22, lobby: true };

class LobbyHub {
  constructor(world) {
    this.world = world;

    this.time = 0;
    const T = CONFIG.tileSize;
    const d = world.dungeon;
    this.stations = [];
    // hero hall: a row of statues on the left
    Object.keys(CONFIG.classes).forEach((id, i) => {
      this.stations.push({ kind: 'hero', id, x: (4 + i * 2.4) * T, y: 9 * T, r: 40, prompt: `PICK ${CONFIG.classes[id].name.toUpperCase()}` });
    });
    this.stations.push({ kind: 'workshop', x: 27 * T, y: 9 * T, r: 56, prompt: 'WORKSHOP' });
    this.stations.push({ kind: 'practice', x: 27 * T, y: 16 * T, r: 50, prompt: 'PRACTICE RANGE' });
    // the library: a carpeted corner (bottom left) with the map legend, bestiary and potion guide
    this.library = { x0: 1.1 * T, y0: 15.2 * T, x1: 10.2 * T, y1: 20.9 * T };
    this.stations.push({ kind: 'legend', x: 3.1 * T, y: 18.6 * T, r: 48, prompt: 'MAP LEGEND' });
    this.stations.push({ kind: 'bestiary', x: 5.9 * T, y: 17.4 * T, r: 44, prompt: 'BESTIARY' });
    this.stations.push({ kind: 'potions', x: 8.5 * T, y: 19.1 * T, r: 44, prompt: 'POTION GUIDE' });
    this.stations.push({ kind: 'gate', x: d.width / 2, y: 4 * T + 18, r: 54, prompt: 'CHOOSE A DUNGEON' });

    // set dressing (tile coordinates): banners in the hero hall, plants by the gate,
    // a wall of shelves behind the library, hay and a dummy at the practice range, a bench to rest on
    const g = d.width / 2 / T;
    this.decor = [
      ['bannerRed', 2.4, 7.4], ['bannerBlue', 15.2, 7.4],
      ['plant', g - 3, 4.9], ['plant', g + 3, 4.9],
      ['bookshelf', 1.85, 15.4], ['bookshelf', 3.2, 15.4], ['bookshelf', 4.55, 15.4], ['bookshelf', 5.9, 15.4], ['bookshelf', 7.25, 15.4],
      ['plant', 9.3, 15.6], ['candelabra', 1.7, 20.6], ['candelabra', 9.7, 20.6],
      ['dummy', 30.5, 16.4], ['hayBale', 23.8, 17.2], ['hayBale', 30.8, 19], ['bannerGreen', 24.2, 14],
      ['crate', 31.6, 6.6], ['sacks', 22.4, 6.4], ['barrel', 32, 12.2],
      ['bench', g - 3.8, 12.4], ['bench', g + 3.8, 12.4], ['plant', g - 5.6, 12.6], ['plant', g + 5.6, 12.6],
    ].map(([name, tx, ty]) => ({ name, x: tx * T, y: ty * T }));
    // a cat strolls between a few favourite spots (visual only)
    this.catPath = [[g + 2, 13.4], [g + 6, 9.5], [21.5, 15.5], [g - 2.5, 17.5], [g - 6, 10]].map(([tx, ty]) => ({ x: tx * T, y: ty * T }));
    // fireflies drifting through the hall
    this.motes = Array.from({ length: 26 }, (_, i) => ({
      x: ((i * 0.618) % 1) * d.width, y: (4.5 + ((i * 0.382) % 1) * 16) * T, s: i * 1.7,
    }));
  }

  update(dt) {
    this.time += dt;
  }

  /** The station the local hero is at (for prompts and highlights). */
  get near() { return this.world.localPlayer.nearStation || null; }

  /**
   * Runs for each hero before they update, so pressing E at a station doesn't
   * also cast the E ability. The station's menu only opens on that hero's screen.
   */
  interact(hero) {
    hero.nearStation = null;
    let best = Infinity;
    for (const s of this.stations) {
      const d = dist(hero.x, hero.y, s.x, s.y);
      if (d < s.r && d < best) { best = d; hero.nearStation = s; }
    }
    if (hero.nearStation && Input.pressed('interact')) {
      Input.consume('interact');
      if (hero === this.world.localPlayer) Sound.play('uiClick');
      this.world.events.onInteract?.(hero.nearStation, hero);
    }
  }

  /** Floor-level art: the gate in the back wall and the station footprints. */
  drawGround(ctx) {
    this.drawLibraryCarpet(ctx);
    for (const s of this.stations) {
      if (s.kind === 'gate') this.drawGate(ctx, s);
      if (s.kind === 'practice') this.drawPracticePad(ctx, s);
      if (s.kind !== 'workshop') drawShadow(ctx, s.x, s.y + 4, s.kind === 'hero' ? 18 : 26, 6);
    }
    // the hero hall plaque
    const T = CONFIG.tileSize;
    HUD.text(ctx, 'HEROES', 8.8 * T, 6.6 * T, { size: 8, align: 'center', color: '#f2a541' });
  }

  /** A deep blue carpet with a gold border marking out the library corner, and its plaque above the shelves. */
  drawLibraryCarpet(ctx) {
    const L = this.library;
    const x = Math.round(L.x0);
    const y = Math.round(L.y0);
    const w = Math.round(L.x1 - L.x0);
    const h = Math.round(L.y1 - L.y0);
    ctx.fillStyle = '#141a30';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = '#22305a';
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    ctx.fillStyle = '#2a3a6a';
    ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
    // a gold diamond pattern down the middle
    ctx.fillStyle = '#7a5c1c';
    for (let i = 0; i < 6; i++) {
      const dx = x + 30 + i * ((w - 60) / 5);
      const dy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 6); ctx.lineTo(dx + 6, dy); ctx.lineTo(dx, dy + 6); ctx.lineTo(dx - 6, dy);
      ctx.fill();
    }
    // fringe tassels along the open edges
    ctx.fillStyle = '#d4ac4c';
    for (let tx = x + 4; tx < x + w - 4; tx += 6) ctx.fillRect(tx, y + h, 2, 3);
    for (let ty = y + 8; ty < y + h - 4; ty += 6) ctx.fillRect(x + w, ty, 3, 2);
    HUD.text(ctx, 'LIBRARY', (L.x0 + L.x1) / 2 - 16, L.y0 - 76, { size: 8, align: 'center', color: '#8ab8ff' });
  }

  /** Statues and props, y-sorted with the hero. */
  getDrawables() {
    const items = [];
    for (const s of this.stations) {
      if (s.kind === 'gate') continue;
      // the workshop: a tinkerer welding gadgets among coils, gears and machines
      if (s.kind === 'workshop') items.push(...Scenes.drawables('workshop', s.x, s.y, this.time));
      else items.push({ y: s.y, draw: (ctx) => this.drawStation(ctx, s) });
    }
    for (const d of this.decor) {
      items.push({
        y: d.y,
        draw: (ctx) => {
          const pr = Sprites.props[d.name];
          drawShadow(ctx, d.x, d.y, Math.max(6, pr.img.width * 0.4), 4, 0.3);
          drawProp(ctx, d.name, d.x, d.y);
          if (d.name === 'candelabra') for (const cx of [-7, -1, 5]) drawFlame(ctx, d.x + cx + 1, d.y - 27, this.time, cx);
        },
      });
    }
    const cat = this.catState();
    items.push({
      y: cat.y,
      draw: (ctx) => {
        drawShadow(ctx, cat.x, cat.y, 6, 2, 0.3);
        drawProp(ctx, cat.walking ? (Math.floor(this.time * 8) % 2 ? 'catWalk1' : 'catWalk2') : 'catSit', cat.x, cat.y, cat.flip);
      },
    });
    return items;
  }

  /** Where the cat is: it sits a while at each spot, then trots to the next. */
  catState() {
    const sit = 6;
    const walkSpeed = 34;
    const path = this.catPath;
    const legs = path.map((a, i) => { const b = path[(i + 1) % path.length]; return dist(a.x, a.y, b.x, b.y) / walkSpeed; });
    const total = legs.reduce((s, l) => s + l + sit, 0);
    let t = this.time % total;
    for (let i = 0; i < path.length; i++) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      if (t < sit) return { x: a.x, y: a.y, walking: false, flip: b.x < a.x };
      t -= sit;
      if (t < legs[i]) {
        const k = t / legs[i];
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, walking: true, flip: b.x < a.x };
      }
      t -= legs[i];
    }
    return { x: path[0].x, y: path[0].y, walking: false, flip: false };
  }

  /** Fireflies drifting and pulsing over the hall (drawn above the floor art). */
  drawMotes(ctx) {
    for (const m of this.motes) {
      const t = this.time * 0.25 + m.s;
      const x = m.x + Math.sin(t * 1.3) * 40 + Math.sin(t * 0.7) * 20;
      const y = m.y + Math.cos(t) * 24;
      const a = 0.35 + 0.35 * Math.sin(this.time * 2 + m.s * 3);
      ctx.fillStyle = `rgba(255, 236, 150, ${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      drawGlow(ctx, x + 1, y + 1, 7, '255, 220, 120', a * 0.35);
    }
  }

  drawStation(ctx, s) {
    if (s.kind === 'hero') this.drawStatue(ctx, s);
    else if (s.kind === 'practice') this.drawPractice(ctx, s);
    else if (s.kind === 'legend') this.drawLegendBoard(ctx, s);
    else if (s.kind === 'bestiary') this.drawLectern(ctx, s);
    else if (s.kind === 'potions') this.drawAlchemyTable(ctx, s);
  }

  /** "[E] ..." (the interact key) over the station the hero is at, plus names under the statues. Drawn on top. */
  drawPrompts(ctx) {
    this.drawMotes(ctx);
    for (const s of this.stations) {
      if (s.kind === 'hero') {
        const current = this.world.localPlayer.classId === s.id;
        HUD.text(ctx, CONFIG.classes[s.id].name.toUpperCase(), s.x, s.y + 12, { size: 6, align: 'center', color: current ? '#ffe680' : '#d8c8a0' });
      }
    }
    const s = this.near;
    if (!s) return;
    const h = { hero: 78, workshop: 80, practice: 70, gate: -6, legend: 74, bestiary: 54, potions: 58 }[s.kind];
    const bob = Math.sin(this.time * 5) * 2;
    HUD.text(ctx, `[${Settings.label('interact')}] ${s.prompt}`, s.x, s.y - h + bob, { size: 8, align: 'center', color: '#ffe680' });
  }

  // ---------- station art ----------

  /** Stone pedestal with the hero on top; the hero you're playing shows as a faint ghost. */
  drawStatue(ctx, s) {
    const current = this.world.localPlayer.classId === s.id;
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 17, y - 9, 34, 15);
    ctx.fillStyle = '#5c5676';
    ctx.fillRect(x - 16, y - 8, 32, 6);
    ctx.fillStyle = '#46415b';
    ctx.fillRect(x - 16, y - 2, 32, 7);
    ctx.fillStyle = '#77699a';
    ctx.fillRect(x - 16, y - 8, 32, 1);
    if (current || this.near === s) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 34);
      g.addColorStop(0, `rgba(255, 220, 120, ${current ? 0.35 : 0.22})`);
      g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 34, y - 64, 68, 68);
      ctx.restore();
    }
    const frames = Sprites.heroes[s.id];
    const frame = frames.idle[Math.floor((this.time + s.x * 0.01) * 2.5) % 2];
    drawSprite(ctx, frame.img, x, y - 8, HERO_ANCHOR.x, HERO_ANCHOR.y, false, current ? 0.3 : 1);
  }

  /** Glowing green ring on the floor in front of the targets. */
  drawPracticePad(ctx, s) {
    const pulse = 0.5 + Math.sin(this.time * 3) * 0.2;
    ctx.save();
    ctx.strokeStyle = `rgba(140, 255, 154, ${pulse})`;
    ctx.fillStyle = 'rgba(140, 255, 154, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -this.time * 12;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 40, 20, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Wooden signboard showing the minimap's room colours. */
  drawLegendBoard(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(x - 22, y - 30, 4, 32);
    ctx.fillRect(x + 18, y - 30, 4, 32);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 28, y - 62, 56, 36);
    ctx.fillStyle = '#7d532f';
    ctx.fillRect(x - 27, y - 61, 54, 34);
    ctx.fillStyle = '#9c6c3e';
    ctx.fillRect(x - 27, y - 61, 54, 2);
    // every room's minimap icon
    Object.keys(ROOM_INFO).forEach((type, i) => {
      const bx = x - 25 + (i % 5) * 10;
      const by = y - 58 + Math.floor(i / 5) * 14;
      ctx.fillStyle = '#2a2438';
      ctx.fillRect(bx, by, 10, 10);
      drawRoomIcon(ctx, type, bx + 1, by + 1);
    });
  }

  /** A lectern holding the open bestiary. */
  drawLectern(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 5, y - 24, 10, 26);
    ctx.fillRect(x - 13, y - 2, 26, 5);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(x - 4, y - 23, 8, 24);
    ctx.fillRect(x - 12, y - 1, 24, 3);
    // slanted top with the book on it
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 17, y - 34, 34, 12);
    ctx.fillStyle = '#7d532f';
    ctx.fillRect(x - 16, y - 33, 32, 10);
    ctx.fillStyle = '#3a1a4a';
    ctx.fillRect(x - 15, y - 40, 30, 9);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(x - 14, y - 41, 13, 8);
    ctx.fillRect(x + 1, y - 41, 13, 8);
    ctx.fillStyle = '#8a7a5a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 12, y - 39 + i * 2, 9, 1);
      ctx.fillRect(x + 3, y - 39 + i * 2, 9, 1);
    }
    // a faint glow so it reads as something to use
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 40, 1, x, y - 40, 22);
    g.addColorStop(0, `rgba(200, 160, 255, ${0.25 + Math.sin(this.time * 3) * 0.08})`);
    g.addColorStop(1, 'rgba(200, 160, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 62, 44, 44);
    ctx.restore();
  }

  /** The potion guide: an alchemy table with bottles, a bubbling flask and an open recipe book. */
  drawAlchemyTable(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const t = this.time;
    // a dark wooden workbench with a violet cloth
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 21, y - 16, 5, 17);
    ctx.fillRect(x + 16, y - 16, 5, 17);
    ctx.fillRect(x - 25, y - 25, 50, 11);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(x - 20, y - 15, 3, 15);
    ctx.fillRect(x + 17, y - 15, 3, 15);
    ctx.fillRect(x - 24, y - 24, 48, 9);
    ctx.fillStyle = '#7d532f';
    ctx.fillRect(x - 24, y - 24, 48, 2);
    ctx.fillStyle = '#5a2a8a';
    ctx.fillRect(x - 10, y - 24, 20, 12);
    ctx.fillStyle = '#d4ac4c';
    ctx.fillRect(x - 10, y - 13, 20, 1);
    // open recipe book
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 20, y - 32, 22, 9);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(x - 19, y - 31, 10, 7);
    ctx.fillRect(x - 8, y - 31, 9, 7);
    ctx.fillStyle = '#8a7a5a';
    for (let i = 0; i < 3; i++) { ctx.fillRect(x - 17, y - 30 + i * 2, 6, 1); ctx.fillRect(x - 6, y - 30 + i * 2, 5, 1); }
    // three potions from the shop on the table
    ['health-potion', 'mana-potion', 'speed-potion'].forEach((id, i) => {
      const img = Sprites.potions[id];
      if (img) ctx.drawImage(img, x + 2 + i * 8, y - 39, 16, 16);
    });
    // a bubbling flask over a little flame
    const fx = x + 19;
    drawFlame(ctx, fx, y - 26, t, 3);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(fx - 5, y - 38, 10, 9);
    ctx.fillRect(fx - 2, y - 44, 4, 6);
    ctx.fillStyle = '#9a4ae0';
    ctx.fillRect(fx - 4, y - 36, 8, 6);
    for (let i = 0; i < 2; i++) {
      const b = (t * 0.8 + i * 0.5) % 1;
      ctx.fillStyle = `rgba(224, 184, 255, ${1 - b})`;
      ctx.fillRect(fx - 1 + i * 2, Math.round(y - 46 - b * 14), 2, 2);
    }
    drawGlow(ctx, x, y - 34, 30, '200, 140, 255', 0.18 + Math.sin(t * 3) * 0.06);
  }

  /** An archery target on a stand. */
  drawPractice(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y - 6);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(x - 12, y - 16, 3, 18);
    ctx.fillRect(x + 10, y - 16, 3, 18);
    const rings = [[14, OUTLINE], [13, '#efe6d2'], [10, '#d84a4a'], [7, '#efe6d2'], [4, '#d84a4a'], [2, '#ffd34a']];
    for (const [r, col] of rings) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, y - 26, r, r, 0, 0, TAU);
      ctx.fill();
    }
    // an arrow stuck in it
    ctx.fillStyle = '#9c6c3e';
    ctx.fillRect(x + 3, y - 31, 10, 2);
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(x + 12, y - 33, 3, 6);
  }

  /** Arched doorway cut into the back wall with a swirling portal. */
  drawGate(ctx, s) {
    const T = CONFIG.tileSize;
    const x = Math.round(s.x);
    const top = 2 * T - 10;
    const bottom = 4 * T;
    const w = 72;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - w / 2 - 6, top + 10, w + 12, bottom - top - 10);
    ctx.beginPath();
    ctx.ellipse(x, top + 18, w / 2 + 6, 22, 0, Math.PI, TAU);
    ctx.fill();
    // stone frame
    ctx.fillStyle = '#77699a';
    ctx.fillRect(x - w / 2 - 4, top + 14, 4, bottom - top - 14);
    ctx.fillRect(x + w / 2, top + 14, 4, bottom - top - 14);
    // portal
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, top + 16, w, bottom - top - 16);
    ctx.ellipse(x, top + 18, w / 2, 20, 0, Math.PI, TAU);
    ctx.clip();
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(x - w / 2, top - 4, w, bottom - top + 4);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const r = ((this.time * 18 + i * 14) % 56);
      ctx.strokeStyle = `rgba(180, 90, 255, ${0.6 * (1 - r / 56)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, bottom - 22, r, r * 0.8, 0, 0, TAU);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, bottom - 22, 2, x, bottom - 22, 40);
    g.addColorStop(0, 'rgba(220, 170, 255, 0.55)');
    g.addColorStop(1, 'rgba(120, 40, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, top - 4, w, bottom - top + 4);
    ctx.restore();
    // light spilling onto the floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(x, bottom + 10, 2, x, bottom + 10, 60);
    fg.addColorStop(0, 'rgba(180, 90, 255, 0.25)');
    fg.addColorStop(1, 'rgba(180, 90, 255, 0)');
    ctx.fillStyle = fg;
    ctx.fillRect(x - 60, bottom - 20, 120, 80);
    ctx.restore();
  }
}
