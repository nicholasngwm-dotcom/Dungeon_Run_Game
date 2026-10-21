// The lobby: the party's castle keep (see CastleKeep), walked around between runs.
// Every room has its job: the great hall holds the dungeon gate and the feast
// tables; the hall of heroes has a statue per hero (pick a hero); the library,
// kept by Elowen the librarian, has the map legend board, the bestiary lectern
// (with enchanted books flying round it) and the potion guide's alchemy table;
// the workshop has the tinkerer; the quarters have beds by the hearth; outside,
// the training grounds have the practice range. Walk up to a station and press E.
// Furniture is solid, and benches, chairs and armchairs can be sat on (E).

// Solid footprint of each prop at its base: [width, depth] in pixels.
const PROP_FOOTPRINT = {
  table: [44, 12], bench: [38, 8], bookshelf: [40, 10], plant: [12, 8], candelabra: [10, 6],
  weaponRack: [34, 10], barrel: [18, 10], crate: [24, 12], sacks: [24, 10], hayBale: [28, 12],
  fence: [44, 6], bedRed: [32, 34], bedBlue: [32, 34], bedGreen: [32, 34], chest: [26, 12],
  hearth: [62, 12], armchair: [20, 12], stool: [10, 6], chair: [14, 10], target: [26, 8],
  dummy: [12, 8], dummyBroken: [12, 8], dummyBurnt: [12, 8], pell: [14, 6], tree: [18, 10],
  well: [44, 22], readingTable: [56, 12], desk: [54, 14], globe: [16, 8], scrollRack: [34, 10],
  bookStack: [16, 6], lampPost: [8, 6], trough: [32, 10],
};

// Props that can be sat on: seat offsets along the prop (px; benches seat two) and how far the
// sitter is raised so their hips rest on the seat. Bench sitters are drawn just behind the bench
// (its seat and legs hide their shins); chair sitters in front of the chair.
const PROP_SEATS = {
  bench: { at: [-10, 10], lift: 7, behind: true }, armchair: { at: [2], lift: 10 }, chair: { at: [2], lift: 9 },
  // beds: tucked in with your head on the pillow
  bedRed: { at: [0], bed: true }, bedBlue: { at: [0], bed: true }, bedGreen: { at: [0], bed: true },
};

// The lobby's day: a whole day lasts `length` real seconds and the keep wakes at `start` o'clock.
// While every hero is tucked up in bed, time runs `asleep` times faster (sleeping through the night).
const LOBBY_DAY = { length: 360, start: 8, asleep: 30 };

class LobbyHub {
  constructor(world) {
    this.world = world;

    this.time = 0;
    const T = CONFIG.tileSize;
    const d = world.dungeon;
    this.stations = [];
    // hall of heroes: a row of statues along the north wall
    Object.keys(CONFIG.classes).forEach((id, i) => {
      this.stations.push({ kind: 'hero', id, x: (3.1 + i * 1.55) * T, y: 8.6 * T, r: 40, prompt: `PICK ${CONFIG.classes[id].name.toUpperCase()}` });
    });
    this.stations.push({ kind: 'workshop', x: 36.6 * T, y: 9.6 * T, r: 56, prompt: 'WORKSHOP' });
    // out in the yard, by the path from the keep's side door
    this.stations.push({ kind: 'practice', x: 40.6 * T, y: 18.8 * T, r: 50, prompt: 'PRACTICE RANGE' });
    // the library: bestiary lectern on the carpet, the legend board and potion guide along the east side
    this.stations.push({ kind: 'bestiary', x: 6.3 * T, y: 22.9 * T, r: 44, prompt: 'BESTIARY' });
    this.stations.push({ kind: 'legend', x: 10.2 * T, y: 23.0 * T, r: 48, prompt: 'MAP LEGEND' });
    this.stations.push({ kind: 'potions', x: 10.1 * T, y: 26.3 * T, r: 44, prompt: 'POTION GUIDE' });
    // the gate stands in the great hall's north wall; bottom = the floor line
    this.stations.push({ kind: 'gate', x: 22 * T, y: 5 * T + 18, bottom: 5 * T, r: 54, prompt: 'CHOOSE A DUNGEON' });
    // the grandfather clock against the great hall's west wall: tells the time of day
    this.stations.push({ kind: 'clock', x: 14.75 * T, y: 13.6 * T, r: 44, prompt: 'CHECK THE TIME' });
    // the celestial hourglass across the hall from it: turn it to bring on night or day
    this.stations.push({ kind: 'hourglass', x: 29.2 * T, y: 13.6 * T, r: 44, prompt: 'TURN THE HOURGLASS' });

    // set dressing per room (tile coordinates of each prop's bottom centre; true = flipped)
    this.decor = [
      // hall of heroes: weapon racks by the doorways
      ['weaponRack', 3.0, 12.7], ['weaponRack', 10.6, 12.7], ['plant', 11.4, 6.1],
      // great hall: two feast tables either side of the runner, set between the side doorways (rows 12-17)
      // so nobody walks out of a doorway into a bench; benches round them,
      // candelabras flanking the gate, plants in the corners, benches by the south door
      ['bench', 17.4, 13.5], ['bench', 18.65, 13.5], ['bench', 25.35, 13.5], ['bench', 26.6, 13.5],
      ['table', 17.3, 14.8], ['table', 18.75, 14.8], ['table', 25.25, 14.8], ['table', 26.7, 14.8],
      ['bench', 17.4, 16.4], ['bench', 18.65, 16.4], ['bench', 25.35, 16.4], ['bench', 26.6, 16.4],
      ['candelabra', 19.6, 5.9], ['candelabra', 24.4, 5.9],
      ['plant', 14.6, 6.1], ['plant', 29.4, 6.1], ['plant', 15.5, 19.8], ['plant', 28.5, 19.8],
      ['bench', 17.6, 19.4], ['bench', 26.4, 19.4], ['barrel', 14.6, 15.4], ['barrel', 29.4, 15.4],
      // library: shelves and a scroll rack along the walls, Elowen's front desk by the hall door,
      // a reading table with chairs, a reading armchair, a globe, books stacked about
      ['bookshelf', 2.8, 16.55], ['bookshelf', 4.15, 16.55], ['bookshelf', 8.85, 16.55], ['bookshelf', 10.2, 16.55],
      ['scrollRack', 2.75, 20.3], ['desk', 9.6, 19.6], ['globe', 2.8, 23.6], ['armchair', 2.7, 26.6],
      ['chair', 4.75, 27.9], ['readingTable', 6.55, 28.0], ['chair', 8.35, 27.9, true],
      ['bookStack', 4.9, 17.5], ['bookStack', 3.6, 28.85], ['candelabra', 11.5, 28.85], ['candelabra', 2.4, 28.9],
      // workshop: supplies along the south wall
      ['crate', 33.9, 12.8], ['sacks', 39.6, 12.8], ['barrel', 40.9, 12.6],
      // the training grounds: weapon racks on the keep wall; a sparring pit of beaten dummies and
      // pells; an archery lane of arrow-studded targets; a scorched corner for spell practice;
      // hay bales, lantern posts and a bench to rest on
      ['weaponRack', 33.2, 16.75], ['weaponRack', 40.4, 16.75], ['bannerGreen', 35.0, 16.9],
      ['dummy', 33.7, 23.8], ['dummyBroken', 39.4, 23.4], ['pell', 33.5, 27.3], ['pell', 39.6, 27.6],
      ['target', 50.4, 18.6], ['target', 50.4, 21.8], ['target', 50.4, 25.0], ['barrel', 44.3, 17.4], ['crate', 44.4, 28.4],
      ['dummyBurnt', 43.3, 26.8], ['hayBale', 32.9, 29.6], ['hayBale', 48.6, 29.5], ['hayBale', 50.9, 29.4],
      ['lampPost', 33.3, 20.6], ['lampPost', 44.2, 22.4], ['bench', 41.4, 29.6],
      // the garden corner beside the workshop: an apple tree, the well, flowers and a bench in the shade
      ['tree', 46.2, 9.6], ['well', 50.0, 13.6], ['bench', 46.4, 11.8], ['flowers', 44.2, 14.6], ['flowers', 49.6, 6.4],
      ['flowers', 44.6, 6.2], ['lampPost', 43.6, 15.6], ['trough', 50.2, 15.4],
      // quarters: beds along the wall, the hearth with armchairs on a rug, a shelf by the door
      ['bedRed', 15.3, 24.9], ['bedBlue', 16.75, 24.9], ['bedGreen', 18.2, 24.9], ['chest', 16.75, 26.6],
      ['bookshelf', 19.7, 23.7], ['hearth', 25.5, 23.95], ['rugRound', 25.5, 26.5],
      ['armchair', 23.7, 26.2], ['armchair', 27.3, 26.2, true], ['plant', 29.4, 28.8], ['candelabra', 14.5, 28.8],
    ].map(([name, tx, ty, flip]) => ({ name, x: tx * T, y: ty * T, flip: !!flip }));

    // furniture is solid, and stations stand on solid bases
    for (const o of this.decor) {
      const fp = PROP_FOOTPRINT[o.name];
      if (fp) d.addObstacle?.(o.x - fp[0] / 2, o.y - fp[1], fp[0], fp[1]);
    }
    const base = { hero: [32, 12], bestiary: [24, 6], legend: [44, 5], potions: [48, 10], practice: [26, 6], clock: [24, 10], hourglass: [34, 10] };
    for (const s of this.stations) {
      const fp = base[s.kind];
      if (fp) d.addObstacle?.(s.x - fp[0] / 2, s.y - fp[1] + 4, fp[0], fp[1]);
    }
    // every place to sit: { x, y (where the sitter is drawn), facing, prop, by (who's sitting) }
    this.seats = [];
    for (const o of this.decor) {
      const kind = PROP_SEATS[o.name];
      for (const off of kind ? kind.at : []) {
        const facing = o.name === 'bench' ? (o.x < 22 * T || o.x > 32 * T ? 1 : -1) : (o.flip ? -1 : 1);
        this.seats.push({ x: o.x + (o.flip ? -off : off), y: o.y + (kind.behind ? -1 : 1), lift: kind.lift, bed: !!kind.bed, facing, prop: o, by: null });
      }
    }

    // Elowen the librarian behind her front desk, and enchanted books flying about
    const desk = this.decor.find((o) => o.name === 'desk');
    this.librarian = { x: desk.x + 4, y: desk.y - 10 };
    const lectern = this.stations.find((s) => s.kind === 'bestiary');
    this.books = [
      ...[0, 1, 2, 3].map((i) => ({ orbit: lectern, r: 34, h: 50, phase: (i * TAU) / 4, speed: 0.9, color: ['#7a2a3a', '#2a4a7a', '#3a6a3a', '#5a2a7a'][i] })),
      ...[0, 1, 2].map((i) => ({ wander: true, phase: i * 2.1, speed: 0.35 + i * 0.07, color: ['#7a5a24', '#2a6a6a', '#8a3a2a'][i] })),
    ];
    // wooden signs naming the rooms: [text, x, y (board centre), sort y]
    this.signs = [
      ['HALL OF HEROES', 6.75, 3.75, 5], ['LIBRARY', 9.55, 14.3, 16], ['WORKSHOP', 36.6, 3.75, 5], ['QUARTERS', 16.9, 21.6, 23],
    ].map(([text, tx, ty, sy]) => ({ text, x: tx * T, y: ty * T, sortY: sy * T }));
    this.signposts = [{ text: 'TRAINING GROUNDS', x: 34.6 * T, y: 19.0 * T }];

    // a cat wanders the hall and naps by the fire (visual only)
    this.catPath = [[17.5, 18.4], [22, 17], [22, 24.5], [25.5, 26.4], [22, 21.5], [26.5, 18.2], [22.5, 8.5]].map(([tx, ty]) => ({ x: tx * T, y: ty * T }));
    // fireflies drifting through the keep and the yard
    this.motes = Array.from({ length: 44 }, (_, i) => ({
      x: (2 + ((i * 0.618) % 1) * 50) * T, y: (5.5 + ((i * 0.382) % 1) * 24) * T, s: i * 1.7,
    }));
  }

  update(dt) {
    this.time += dt;
    // the day goes by (much faster while every hero is asleep in bed)
    const heroes = this.world.players.filter((p) => !p.dead);
    const allAsleep = heroes.length > 0 && heroes.every((p) => p.seat && p.seat.bed);
    let rate = allAsleep ? LOBBY_DAY.asleep : 1;
    // the hourglass races the day round to the hour it was turned for
    if (this.timeWarp) {
      rate = this.timeWarp.rate;
      const left = (this.timeWarp.to - this.hour + 24) % 24;
      if (left < 0.05 || left > 23.9) this.timeWarp = null;
    }
    this.clock = (this.clock || 0) + dt * rate;
    this.updateDoors(dt);
  }

  // ---------- the time of day ----------

  /** The hour of the day, 0-24 (fractional). */
  get hour() { return (LOBBY_DAY.start + (this.clock / LOBBY_DAY.length) * 24) % 24; }

  /** "9:41 PM" */
  get timeText() {
    const h = this.hour;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${(hh + 11) % 12 + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  }

  /**
   * How dark it is (0 day .. 0.62 deep night) and the sky's tint: day 7-17,
   * an orange dusk 17-19, night 19-5, a pink dawn 5-7.
   */
  get daylight() {
    const h = this.hour;
    const night = 0.62;
    if (h >= 7 && h < 17) return { dark: 0, tint: null, phase: 'DAY' };
    if (h >= 17 && h < 19) { const k = (h - 17) / 2; return { dark: night * k, tint: `rgba(255, 130, 60, ${0.18 * Math.sin(k * Math.PI)})`, phase: 'DUSK' }; }
    if (h >= 5 && h < 7) { const k = (h - 5) / 2; return { dark: night * (1 - k), tint: `rgba(255, 150, 190, ${0.16 * Math.sin(k * Math.PI)})`, phase: 'DAWN' }; }
    return { dark: night, tint: null, phase: 'NIGHT' };
  }

  /**
   * Turning the celestial hourglass: by day it brings on the night (9 PM), by
   * night it brings the morning (8 AM). Time races there over a couple of
   * seconds rather than jumping, so the sky visibly turns. Part of the shared
   * simulation, so it changes the time for every player.
   */
  turnHourglass(s) {
    if (this.timeWarp) return;   // already turning
    const toNight = this.daylight.phase === 'DAY' || this.daylight.phase === 'DAWN';
    const to = toNight ? 21 : 8;
    const hours = (to - this.hour + 24) % 24;
    this.timeWarp = { to, rate: Math.max(1, (hours / 24) * LOBBY_DAY.length / 2.5) };
    this.hourglassTurn = { at: this.time, toNight };
    const fx = this.world.effects;
    fx.text(s.x, s.y - 86, toNight ? 'NIGHTFALL' : 'DAYBREAK', { color: toNight ? '#a8b8ff' : '#ffe680', size: 11, life: 2.2, rise: 18 });
    fx.burst(s.x, s.y - 40, { count: 30, colors: toNight ? ['#ffffff', '#a8b8ff', '#5a6ad0'] : ['#ffffff', '#fff2a0', '#ffb030'], speed: [40, 160], life: [0.5, 1], up: 40 });
    const x = s.x;
    const y = s.y - 40;
    fx.add(0.9, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      const r = 10 + t * 120;
      PFX.ring(ctx, x, y + 30, r, r * 0.5, toNight ? '#a8b8ff' : '#ffe680', 2, { thick: t < 0.4 ? 3 : 1 });
      PFX.glow(ctx, x, y, 30 * (1 - t) + 6, toNight ? '120, 140, 255' : '255, 220, 120', 1.2);
      ctx.restore();
    });
    // a shimmering run up (to day) or down (to night) the strings
    const notes = toNight ? [84, 79, 76, 72, 67, 64] : [64, 67, 72, 76, 79, 84];
    notes.forEach((n, i) => Bardsong.pluck(n, { delay: i * 0.07, vol: 0.07, dur: 1.2, soft: true }));
  }

  /** The clock chimes and tells this hero the time (only on their own screen). */
  tellTime(hero) {
    if (hero !== this.world.localPlayer) return;
    const s = this.stations.find((st) => st.kind === 'clock');
    const phase = { DAY: 'Good day!', DUSK: 'The sun is setting...', NIGHT: 'Time for bed?', DAWN: 'Rise and shine!' }[this.daylight.phase];
    this.world.effects.text(s.x, s.y - 96, this.timeText, { color: '#ffe9a8', size: 12, life: 2.4, rise: 16 });
    this.world.effects.text(s.x, s.y - 80, phase, { color: '#e8dcc0', size: 7, life: 2.4, rise: 16 });
    // a soft chime: one bong per... well, just three
    for (let i = 0; i < 3; i++) Bardsong.pluck([79, 74, 67][i], { delay: i * 0.35, vol: 0.08, dur: 1.4, soft: true });
  }

  // ---------- doors ----------

  /**
   * A pair of wooden doors in every doorway, hinged at the sides of the opening.
   * ns: the door plane runs north-south (a doorway through a side wall), else east-west.
   * open: 0 shut .. 1 swung right round; dir: which side they swing into (+1 east/south).
   */
  buildDoors() {
    const T = CONFIG.tileSize;
    const d = this.world.dungeon;
    return (typeof KEEP_DOORS === 'undefined' ? [] : KEEP_DOORS).map(([x0, y0, x1, y1]) => {
      const ns = d.tileAt(x0 - 1, Math.floor((y0 + y1) / 2)) === TILE.FLOOR;
      return ns
        ? { ns, x: (x0 + x1 + 1) / 2 * T, a: y0 * T, b: (y1 + 1) * T, open: 0, dir: 1, idle: 0 }
        : { ns, y: (y0 + y1 + 1) / 2 * T, a: x0 * T, b: (x1 + 1) * T, open: 0, dir: 1, idle: 0 };
    });
  }

  /** Doors swing open away from a hero walking up to them, stay open while anyone's near, then slowly shut. */
  updateDoors(dt) {
    this.doors ??= this.buildDoors();
    for (const dr of this.doors) {
      const cx = dr.ns ? dr.x : (dr.a + dr.b) / 2;
      const cy = dr.ns ? (dr.a + dr.b) / 2 : dr.y;
      let near = null;
      let best = 84;
      for (const p of this.world.players) {
        if (p.dead) continue;
        const dd = dist(p.x, p.y, cx, cy);
        if (dd < best) { best = dd; near = p; }
      }
      if (near) {
        // only pick the swing direction from shut, so a door never flips through someone
        if (dr.open < 0.05) dr.dir = dr.ns ? (near.x < dr.x ? 1 : -1) : (near.y < dr.y ? 1 : -1);
        if (dr.open === 0 && near === this.world.localPlayer) Sound.play('uiClick', 0.2);
        dr.open = Math.min(1, dr.open + dt * 3.2);
        dr.idle = 0;
      } else {
        dr.idle += dt;
        if (dr.idle > 0.6) dr.open = Math.max(0, dr.open - dt * 0.65);
      }
    }
  }

  /**
   * The two leaves of a door as y-sorted drawables. Each leaf turns about its
   * hinge on the floor; it's drawn as an upright wooden panel (planks, two iron
   * bands, a ring pull) from its base line up to the door's height.
   */
  doorDrawables() {
    const items = [];
    for (const dr of this.doors || []) {
      // eased swing with a little overshoot when it bangs open
      const k = dr.open;
      const e = k < 1 ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.06 : 1;
      const turn = (Math.PI / 2) * e * dr.dir;
      const half = (dr.b - dr.a) / 2;
      const leaves = dr.ns
        ? [{ hx: dr.x, hy: dr.a, phi: Math.PI / 2 - turn }, { hx: dr.x, hy: dr.b, phi: -Math.PI / 2 + turn }]
        : [{ hx: dr.a, hy: dr.y, phi: turn }, { hx: dr.b, hy: dr.y, phi: Math.PI - turn }];
      for (const l of leaves) {
        const ex = l.hx + Math.cos(l.phi) * half;
        const ey = l.hy + Math.sin(l.phi) * half;
        items.push({ y: Math.max(l.hy, ey) - 1, draw: (ctx) => this.drawDoorLeaf(ctx, l.hx, l.hy, ex, ey) });
      }
    }
    return items;
  }

  drawDoorLeaf(ctx, hx, hy, ex, ey) {
    const H = 54;
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
    const t = wide < 4 ? (4 - wide) / 2 : 0;
    const l = Math.min(hx, ex) - t;
    const r = Math.max(hx, ex) + t;
    const pts = wide < 4
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
    if (wide < 4) return;
    // planks
    ctx.strokeStyle = '#3e2716';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const u = i / 4;
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

  /** The station the local hero is at (for prompts and highlights). */
  get near() { return this.world.localPlayer.nearStation || null; }

  /**
   * Runs for each hero before they update, so pressing E at a station or seat
   * doesn't also cast the E ability. A station's menu only opens on that hero's screen.
   * Seated heroes stay put until they press E, dodge or try to walk.
   */
  interact(hero) {
    hero.nearStation = null;
    hero.nearSeat = null;
    if (hero.seat) {
      const s = hero.seat;
      const leave = Input.pressed('interact') || Input.pressed('dodge') || ['up', 'down', 'left', 'right'].some((a) => Input.down(a));
      if (Input.pressed('interact')) Input.consume('interact');
      if (leave) this.standUp(hero);
      else { hero.x = s.x; hero.y = s.y; }
      return;
    }
    let best = Infinity;
    for (const s of this.stations) {
      const d = dist(hero.x, hero.y, s.x, s.y);
      if (d < s.r && d < best) { best = d; hero.nearStation = s; }
    }
    if (hero.nearStation && Input.pressed('interact')) {
      Input.consume('interact');
      if (hero === this.world.localPlayer) Sound.play('uiClick');
      if (hero.nearStation.kind === 'clock') this.tellTime(hero);
      else if (hero.nearStation.kind === 'hourglass') this.turnHourglass(hero.nearStation);
      else this.world.events.onInteract?.(hero.nearStation, hero);
      return;
    }
    if (hero.nearStation) return;
    // otherwise the closest free seat within reach
    best = 30;
    for (const s of this.seats) {
      if (s.by && this.world.players.includes(s.by) && s.by.seat === s) continue;
      const d = dist(hero.x, hero.y, s.x, s.y);
      if (d < best) { best = d; hero.nearSeat = s; }
    }
    if (hero.nearSeat && Input.pressed('interact')) {
      Input.consume('interact');
      const s = hero.nearSeat;
      s.by = hero;
      hero.seat = s;
      hero.x = s.x;
      hero.y = s.y;
      hero.kbx = 0;
      hero.kby = 0;
      if (hero === this.world.localPlayer) Sound.play('uiClick');
    }
  }

  /** Off the seat, onto the nearest clear floor beside it. */
  standUp(hero) {
    const s = hero.seat;
    hero.seat = null;
    if (s.by === hero) s.by = null;
    const pt = this.world.dungeon.freePoint(s.x, s.y + 14, hero.hw, hero.hh);
    hero.x = pt.x;
    hero.y = pt.y;
  }

  /** Floor-level art: rugs, the gate in the north wall, station footprints. */
  drawGround(ctx) {
    this.drawWindowsDaylight(ctx);
    for (const d of this.decor) if (d.name.startsWith('rug')) drawProp(ctx, d.name, d.x, d.y, d.flip);
    for (const s of this.stations) {
      if (s.kind === 'gate') this.drawGate(ctx, s);
      if (s.kind === 'practice') this.drawPracticePad(ctx, s);
      if (s.kind !== 'workshop') drawShadow(ctx, s.x, s.y + 4, s.kind === 'hero' ? 18 : 26, 6);
    }
    // warm firelight spilling from the hearth across the quarters
    const h = this.decor.find((d) => d.name === 'hearth');
    if (h) drawGlow(ctx, h.x, h.y + 20, 110 + Math.sin(this.time * 9) * 4, '255, 150, 60', 0.22);
    // lantern light pooling under the yard's lamp posts
    for (const l of this.decor) if (l.name === 'lampPost') drawGlow(ctx, l.x, l.y - 4, 46, '255, 210, 120', 0.16);
  }

  /** A wooden signboard hung on a wall: dark board, gold trim, bright lettering. */
  drawSign(ctx, text, x, y) {
    ctx.font = uiFont(8);
    const w = Math.ceil(ctx.measureText(text).width) + 18;
    const h = 17;
    const l = Math.round(x - w / 2);
    const t = Math.round(y - h / 2);
    // chains up to the wall
    ctx.fillStyle = '#545a6a';
    ctx.fillRect(l + 6, t - 6, 2, 6);
    ctx.fillRect(l + w - 8, t - 6, 2, 6);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(l - 1, t - 1, w + 2, h + 2);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(l, t, w, h);
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(l + 2, t + 2, w - 4, h - 4);
    ctx.fillStyle = '#4e301c';
    ctx.fillRect(l + 2, t + 2, w - 4, 2);
    HUD.text(ctx, text, Math.round(x), t + 4, { size: 8, align: 'center', color: '#ffe9a8' });
  }

  /** A sign on two posts standing in the yard. */
  drawSignpost(ctx, s) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.round(s.x) - 31, Math.round(s.y) - 30, 6, 31);
    ctx.fillRect(Math.round(s.x) + 25, Math.round(s.y) - 30, 6, 31);
    ctx.fillStyle = '#5b3922';
    ctx.fillRect(Math.round(s.x) - 30, Math.round(s.y) - 30, 4, 30);
    ctx.fillRect(Math.round(s.x) + 26, Math.round(s.y) - 30, 4, 30);
    this.drawSign(ctx, s.text, s.x, s.y - 34);
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
      if (d.name.startsWith('rug')) continue;   // flat on the floor (drawGround)
      items.push({
        y: d.y,
        draw: (ctx) => {
          const pr = Sprites.props[d.name];
          if (d.name !== 'hearth') drawShadow(ctx, d.x, d.y, Math.max(6, pr.img.width * 0.4), 4, 0.3);
          drawProp(ctx, d.name, d.x, d.y, d.flip);
          if (d.name === 'candelabra') for (const cx of [-7, -1, 5]) drawFlame(ctx, d.x + cx + 1, d.y - 27, this.time, cx);
          if (d.name === 'hearth') this.drawHearthFire(ctx, d.x, d.y);
        },
      });
    }
    // Elowen reads at her desk, turning a page now and then, and looks up when a hero comes near
    const L = this.librarian;
    items.push({
      y: L.y,
      draw: (ctx) => {
        const frames = Sprites.npcs.librarian;
        const hero = this.world.localPlayer;
        const near = dist(hero.x, hero.y, L.x, L.y) < 90;
        const frame = near ? heroFrame(frames, false, this.time) : frames.read[(this.time % 2.4) < 0.35 ? 1 : 0];
        drawShadow(ctx, L.x, L.y + 9, 12, 4, 0.3);
        drawSprite(ctx, frame.img, L.x, L.y, HERO_ANCHOR.x, HERO_ANCHOR.y, true);
      },
    });
    items.push(...this.doorDrawables());
    for (const s of this.signs) items.push({ y: s.sortY, draw: (ctx) => this.drawSign(ctx, s.text, s.x, s.y) });
    for (const s of this.signposts) items.push({ y: s.y, draw: (ctx) => this.drawSignpost(ctx, s) });
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

  /** A log fire crackling in the hearth's firebox, with sparks rising up the chimney. */
  drawHearthFire(ctx, x, y) {
    const t = this.time;
    for (const [dx, seed] of [[-9, 0], [0, 2], [9, 4]]) drawFlame(ctx, x + dx, y - 9, t, seed);
    for (const [dx, seed] of [[-4, 1], [5, 3]]) drawFlame(ctx, x + dx, y - 13, t, seed);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.7 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(255, ${Math.round(200 - k * 80)}, 90, ${1 - k})`;
      ctx.fillRect(Math.round(x - 6 + i * 6 + Math.sin(t * 3 + i) * 3), Math.round(y - 16 - k * 14), 2, 2);
    }
    drawGlow(ctx, x, y - 14, 30, '255, 160, 70', 0.35 + Math.sin(t * 11) * 0.05);
  }

  /** Fireflies drifting and pulsing through the keep (drawn above the floor art; never over the walls). */
  drawMotes(ctx) {
    const d = this.world.dungeon;
    for (const m of this.motes) {
      const t = this.time * 0.25 + m.s;
      const x = m.x + Math.sin(t * 1.3) * 40 + Math.sin(t * 0.7) * 20;
      const y = m.y + Math.cos(t) * 24;
      if (d.isSolidAt(x, y + 20)) continue;
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
    else if (s.kind === 'clock') this.drawClock(ctx, s);
    else if (s.kind === 'hourglass') this.drawHourglass(ctx, s);
  }

  /**
   * Enchanted books: four circle the bestiary lectern, three wander the library,
   * flapping their covers like wings and trailing sparkles. Drawn above everything.
   */
  drawBooks(ctx) {
    const T = CONFIG.tileSize;
    const t = this.time;
    for (const b of this.books) {
      let x;
      let y;
      if (b.orbit) {
        const a = b.phase + t * b.speed;
        x = b.orbit.x + Math.cos(a) * b.r;
        y = b.orbit.y - b.h + Math.sin(a) * b.r * 0.4 + Math.sin(t * 2 + b.phase) * 3;
      } else {
        const u = t * b.speed + b.phase;
        x = (6.6 + Math.sin(u) * 3.4 + Math.sin(u * 2.3) * 0.6) * T;
        y = (21.5 + Math.sin(u * 1.4 + 1) * 3 + Math.cos(u * 0.7) * 1) * T - 40;
      }
      const flap = Math.abs(Math.sin(t * 6 + b.phase * 3));   // 0 = closed, 1 = wide open
      const bx = Math.round(x);
      const by = Math.round(y);
      drawGlow(ctx, bx, by, 14, '200, 170, 255', 0.25);
      // shadow on the floor far below
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(bx - 5, by + 40, 10, 2);
      // the two covers swinging open around the spine, pages showing between
      const open = Math.round(2 + flap * 6);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(bx - open - 1, by - 5, open * 2 + 2, 9);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx - open, by - 4, open, 7);
      ctx.fillRect(bx, by - 4, open, 7);
      if (open > 3) {
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(bx - open + 2, by - 3, open - 2, 5);
        ctx.fillRect(bx, by - 3, open - 2, 5);
        ctx.fillStyle = '#8a7a5a';
        ctx.fillRect(bx - open + 3, by - 2, open - 4, 1);
        ctx.fillRect(bx + 1, by, open - 4, 1);
      }
      ctx.fillStyle = '#d4ac4c';
      ctx.fillRect(bx, by - 4, 1, 7);
      // sparkles falling off it
      if (Math.floor(t * 8 + b.phase * 5) % 3 === 0) {
        ctx.fillStyle = '#e8d8ff';
        ctx.fillRect(bx - 4 + Math.round(Math.sin(t * 5 + b.phase) * 4), by + 6 + Math.round((t * 20) % 8), 2, 2);
      }
    }
  }

  /** Elowen's word bubble when a hero comes up to her desk. */
  drawLibrarianTalk(ctx) {
    const L = this.librarian;
    const hero = this.world.localPlayer;
    if (dist(hero.x, hero.y, L.x, L.y) > 90) return;
    const lines = ['Shh... welcome, hero.', 'The bestiary is on the lectern.', 'Mind the flying books!', 'Return what you borrow.'];
    const text = lines[Math.floor(this.time / 4) % lines.length];
    ctx.font = uiFont(7);
    const w = Math.ceil(ctx.measureText(text).width) + 12;
    const x = Math.round(L.x - w / 2);
    const y = Math.round(L.y - 74);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 1, w + 2, 16);
    ctx.fillStyle = '#f4ead7';
    ctx.fillRect(x, y, w, 14);
    ctx.fillRect(Math.round(L.x) - 2, y + 14, 5, 3);
    HUD.text(ctx, text, Math.round(L.x), y + 3, { size: 7, align: 'center', color: '#3b2416', shadow: false });
    HUD.text(ctx, 'ELOWEN', Math.round(L.x), Math.round(L.y + 12), { size: 6, align: 'center', color: '#e8c8ff' });
  }

  /** "[E] ..." (the interact key) over the station the hero is at, plus names under the statues. Drawn on top. */
  drawPrompts(ctx) {
    this.drawMotes(ctx);
    this.drawBooks(ctx);
    this.drawLibrarianTalk(ctx);
    // sitting down / getting up
    const me = this.world.localPlayer;
    const bob = Math.sin(this.time * 5) * 2;
    if (me.seat) {
      HUD.text(ctx, `[${Settings.label('interact')}] ${me.seat.bed ? 'GET UP' : 'STAND UP'}`, me.x, me.y - (me.seat.bed ? 70 : 64) + bob, { size: 7, align: 'center', color: '#ffe680' });
    } else if (me.nearSeat && !me.nearStation) {
      HUD.text(ctx, `[${Settings.label('interact')}] ${me.nearSeat.bed ? 'SLEEP' : 'SIT'}`, me.nearSeat.x, me.nearSeat.y - (me.nearSeat.bed ? 56 : 30) + bob, { size: 7, align: 'center', color: '#ffe680' });
    }
    for (const s of this.stations) {
      if (s.kind === 'hero') {
        const current = this.world.localPlayer.classId === s.id;
        HUD.text(ctx, CONFIG.classes[s.id].name.toUpperCase(), s.x, s.y + 12, { size: 6, align: 'center', color: current ? '#ffe680' : '#d8c8a0' });
      }
    }
    const s = this.near;
    if (!s) return;
    const h = { hero: 78, workshop: 80, practice: 70, gate: -6, legend: 74, bestiary: 54, potions: 58, clock: 86, hourglass: 72 }[s.kind];
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
    const frame = heroFrame(Sprites.heroes[s.id], false, this.time + s.x * 0.01);
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

  /** The grandfather clock: its hands show the lobby's time of day, the pendulum swings behind the glass. */
  drawClock(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    drawProp(ctx, 'grandfatherClock', x, y);
    // the dial's centre (sprite is 26x72 anchored at its bottom centre)
    const cx = x;
    const cy = y - 72 + 18;
    const h = this.hour;
    const hand = (a, len, col, w) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, cy + 0.5);
      ctx.lineTo(Math.round(cx + Math.cos(a) * len) + 0.5, Math.round(cy + Math.sin(a) * len) + 0.5);
      ctx.stroke();
    };
    hand(((h % 12) / 12) * TAU - Math.PI / 2, 4, '#2a1a10', 2);
    hand(((h % 1)) * TAU - Math.PI / 2, 6, '#5a3a1a', 1);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(cx, cy, 1, 1);
    // pendulum swinging behind the glass door
    const swing = Math.sin(this.time * Math.PI) * 0.35;
    const px = cx + Math.sin(swing) * 16;
    const py = y - 72 + 33 + Math.cos(swing) * 16;
    ctx.strokeStyle = '#a07a24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, y - 72 + 33);
    ctx.lineTo(px + 0.5, py);
    ctx.stroke();
    ctx.fillStyle = '#d4ac4c';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, TAU);
    ctx.fill();
  }

  /**
   * The celestial hourglass on its pedestal: a gold frame with glowing sand
   * (gold by day, starry blue by night) and a little sun and moon circling it.
   * When turned it flips end over end while the time races round.
   */
  drawHourglass(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    drawProp(ctx, 'pedestal', x, y);
    const night = this.daylight.dark > 0.31;
    const sand = night ? ['#3a4ab0', '#7a8aff', '#d0d8ff'] : ['#b07a20', '#ffc840', '#fff2a0'];
    const turn = this.hourglassTurn;
    const k = turn ? clamp((this.time - turn.at) / 0.8, 0, 1) : 1;
    const angle = k < 1 ? (1 - (1 - k) ** 3) * Math.PI : 0;
    const cy = y - 34 + Math.sin(this.time * 2) * 1.5;
    drawGlow(ctx, x, cy, 26, night ? '120, 140, 255' : '255, 210, 110', 0.25 + Math.sin(this.time * 3) * 0.06);
    ctx.save();
    ctx.translate(x, Math.round(cy));
    ctx.rotate(angle);
    // the two glass bulbs and the sand settling into the bottom one
    const flow = (this.time * 0.15) % 1;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-9, -14); ctx.lineTo(9, -14); ctx.lineTo(2, 0); ctx.lineTo(9, 14); ctx.lineTo(-9, 14); ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 230, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(1, 0); ctx.lineTo(7, 12); ctx.lineTo(-7, 12); ctx.lineTo(-1, 0);
    ctx.closePath();
    ctx.fill();
    const top = 1 - flow;
    ctx.fillStyle = sand[1];
    ctx.beginPath();
    ctx.moveTo(-6 * top, -1 - 10 * top); ctx.lineTo(6 * top, -1 - 10 * top); ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.lineTo(7 - flow * 3, 12 - 9 * flow); ctx.lineTo(-7 + flow * 3, 12 - 9 * flow);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sand[2];
    ctx.fillRect(0, -1, 1, 13);                       // the falling stream
    ctx.fillRect(-4, 11, 3, 1);
    // gold caps and pillars
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(-11, -17, 22, 4);
    ctx.fillRect(-11, 13, 22, 4);
    ctx.fillRect(-11, -14, 2, 28);
    ctx.fillRect(9, -14, 2, 28);
    ctx.fillStyle = '#fbe796';
    ctx.fillRect(-11, -17, 22, 1);
    ctx.fillRect(-11, 13, 22, 1);
    ctx.restore();
    // a little sun and moon chasing each other round it
    const a = this.time * 1.2;
    const orbit = (ang) => [x + Math.cos(ang) * 18, cy + Math.sin(ang) * 7];
    const [sx, sy] = orbit(a);
    const [mx, my] = orbit(a + Math.PI);
    PFX.star(ctx, sx, sy, 2, '#ffc840', '#fff2a0', 2);
    ctx.fillStyle = '#d0d8ff';
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(mx + 1.5, my - 1, 2.5, 0, TAU);
    ctx.fill();
  }

  /** Daylight in the windows: blue sky over the painted night, and sunbeams on the floor. */
  drawWindowsDaylight(ctx) {
    const day = 1 - this.daylight.dark / 0.62;
    if (day <= 0.02 || !this.world.dungeon.windows) return;
    ctx.save();
    for (const w of this.world.dungeon.windows) {
      const h = w.tall ? 36 : 22;
      const x = Math.round(w.x - 10);
      ctx.globalAlpha = day;
      ctx.fillStyle = '#8ac8f0';
      ctx.fillRect(x, w.top + 6, 20, h - 3);
      ctx.fillRect(x + 3, w.top + 3, 14, 4);
      ctx.fillStyle = '#c8e8ff';
      ctx.fillRect(x + 2, w.top + 8, 5, 5);
      ctx.fillStyle = '#3a3040';
      ctx.fillRect(x + 9, w.top + 3, 2, h);                 // mullions
      ctx.fillRect(x, w.top + 14, 20, 2);
      if (!w.tall) continue;
      // a warm sunbeam slanting onto the floor
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = day * 0.1;
      ctx.fillStyle = '#ffe9a8';
      const fy = w.top + 64;
      ctx.beginPath();
      ctx.moveTo(x, fy); ctx.lineTo(x + 20, fy); ctx.lineTo(x + 52, fy + 86); ctx.lineTo(x + 22, fy + 86);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /**
   * Night falls over the keep: a deep blue darkness with pools of light cut out
   * of it around every torch, candle, lamp, the hearth, the portal and the
   * heroes themselves, warm glows on top, and the dusk/dawn sky tint. The yard
   * stays a little brighter under the moon. Drawn over the world, under the prompts.
   */
  drawLighting(ctx, cam) {
    const { dark, tint } = this.daylight;
    if (dark <= 0.01 && !tint) return;
    const W = cam.width;
    const H = cam.height;
    if (!this.lightCanvas) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = W;
      this.lightCanvas.height = H;
    }
    const lc = this.lightCanvas.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = `rgba(12, 14, 40, ${dark})`;
    lc.fillRect(0, 0, W, H);
    const lights = this.lights();
    lc.globalCompositeOperation = 'destination-out';
    const ox = Math.round(cam.x + cam.offsetX);   // follow the screen shake too
    const oy = Math.round(cam.y + cam.offsetY);
    // moonlight outdoors: the yard is never as dark as the halls
    const T = CONFIG.tileSize;
    lc.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (const id of ['yard', 'garden']) {
      const r = KEEP_ROOMS[id];
      lc.fillRect(r.x0 * T - ox, r.y0 * T - oy, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T);
    }
    for (const l of lights) {
      const x = l.x - ox;
      const y = l.y - oy;
      if (x < -l.r || y < -l.r || x > W + l.r || y > H + l.r) continue;
      const g = lc.createRadialGradient(x, y, 0, x, y, l.r);
      g.addColorStop(0, `rgba(0, 0, 0, ${l.s})`);
      g.addColorStop(0.55, `rgba(0, 0, 0, ${l.s * 0.6})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lc.fillStyle = g;
      lc.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(this.lightCanvas, ox, oy);
    // the lights' own colour blooming on top, stronger the darker it is
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.rgb) continue;
      if (l.x < ox - l.r || l.y < oy - l.r || l.x > ox + W + l.r || l.y > oy + H + l.r) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.7);
      g.addColorStop(0, `rgba(${l.rgb}, ${0.22 * dark})`);
      g.addColorStop(1, `rgba(${l.rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.restore();
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(ox, oy, W, H);
    }
  }

  /** Every light in the keep: { x, y, r (reach), s (how much darkness it cuts), rgb (its glow) }. */
  lights() {
    const t = this.time;
    const out = [];
    for (const tr of this.world.dungeon.torches) {
      const f = Math.sin(t * 12 + tr.seed) * 0.5 + Math.sin(t * 23 + tr.seed * 2) * 0.5;
      out.push({ x: tr.x, y: tr.y + 20, r: 120 + f * 6, s: 0.95, rgb: '255, 150, 60' });
    }
    for (const d of this.decor) {
      if (d.name === 'candelabra') out.push({ x: d.x, y: d.y - 24, r: 80, s: 0.85, rgb: '255, 190, 90' });
      else if (d.name === 'lampPost') out.push({ x: d.x, y: d.y - 46, r: 120, s: 0.9, rgb: '255, 210, 120' });
      else if (d.name === 'hearth') out.push({ x: d.x, y: d.y - 10, r: 190 + Math.sin(t * 9) * 8, s: 1, rgb: '255, 140, 50' });
    }
    for (const s of this.stations) {
      if (s.kind === 'gate') out.push({ x: s.x, y: s.bottom - 20, r: 150, s: 0.9, rgb: '180, 90, 255' });
      else if (s.kind === 'workshop') out.push({ x: s.x, y: s.y - 40, r: 130, s: 0.85, rgb: '140, 210, 255' });
      else if (s.kind === 'bestiary' || s.kind === 'potions') out.push({ x: s.x, y: s.y - 34, r: 70, s: 0.7, rgb: '200, 160, 255' });
      else if (s.kind === 'hourglass') out.push({ x: s.x, y: s.y - 34, r: 90, s: 0.8, rgb: '170, 180, 255' });
    }
    out.push({ x: this.librarian.x, y: this.librarian.y - 10, r: 70, s: 0.7, rgb: '255, 200, 120' });
    // each hero carries a little light, so nobody is lost in the dark
    for (const p of this.world.players) if (!p.dead) out.push({ x: p.x, y: p.y - 16, r: 78, s: 0.55 });
    return out;
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
    const bottom = s.bottom;
    const top = bottom - 2 * T - 10;
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
