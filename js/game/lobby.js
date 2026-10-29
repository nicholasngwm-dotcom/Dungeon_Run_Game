// The lobby: the party's castle keep (see CastleKeep), walked around between runs.
// Every room has its job: the great hall holds the dungeon gate and the feast
// tables; the pet room (the old armory) has the pets on show and the keeper's board, where
// pets are bought with gems and one is picked to come along; the big hall of heroes (south,
// through the quarters) has every hero busy in a nook of their own (see HeroNooks:
// walk up to one to pick them); the library,
// kept by Elowen the librarian, has the map legend board, the bestiary lectern
// (with enchanted books flying round it), the potion guide's alchemy table and the enchanting
// table with the tome of every upgrade;
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
  bookStack: [16, 6], lampPost: [8, 6], trough: [32, 10], perch: [10, 4],
  anvil: [28, 10], grindstone: [22, 6], pedestal: [36, 10], goldPile: [28, 8], targetClean: [26, 8],
  anvil: [28, 10], grindstone: [22, 6], pedestal: [36, 10], goldPile: [28, 8], targetClean: [26, 8],
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
    // hall of heroes: each hero in their own nook
    for (const id of Object.keys(CONFIG.classes)) {
      const n = HERO_NOOKS[id];
      if (n) this.stations.push({ kind: 'hero', id, x: n.at[0] * T, y: n.at[1] * T, r: 40, prompt: `PICK ${CONFIG.classes[id].name.toUpperCase()}` });
    }
    this.stations.push({ kind: 'workshop', x: 36.6 * T, y: 9.6 * T, r: 56, prompt: 'WORKSHOP' });
    // the pet room: the keeper's signboard in the middle (buy and choose pets), and a spot on show for each pet
    this.stations.push({ kind: 'pets', x: 6.75 * T, y: 10.4 * T, r: 60, prompt: 'PETS' });
    this.petSpots = { cat: [3.4, 7.55], dog: [5.6, 7.55], bird: [7.75, 6.95], pig: [9.9, 7.95], fish: [4.4, 10.4], butterfly: [9.3, 10.75] };
    for (const k of Object.keys(this.petSpots)) this.petSpots[k] = { x: this.petSpots[k][0] * T, y: this.petSpots[k][1] * T };
    // out in the yard, by the path from the keep's side door
    this.stations.push({ kind: 'practice', x: 40.6 * T, y: 18.8 * T, r: 50, prompt: 'PRACTICE RANGE' });
    // the library: bestiary lectern on the carpet, the legend board and potion guide along the east side
    this.stations.push({ kind: 'bestiary', x: 6.3 * T, y: 22.9 * T, r: 44, prompt: 'BESTIARY' });
    this.stations.push({ kind: 'legend', x: 10.2 * T, y: 23.0 * T, r: 48, prompt: 'MAP LEGEND' });
    this.stations.push({ kind: 'potions', x: 10.1 * T, y: 26.3 * T, r: 44, prompt: 'POTION GUIDE' });
    // the enchanting table by the west shelves: the tome of every upgrade
    this.stations.push({ kind: 'tome', x: 4.9 * T, y: 19.9 * T, r: 44, prompt: 'ENCHANTMENT TOME' });
    // the gate stands in the great hall's north wall; bottom = the floor line
    this.stations.push({ kind: 'gate', x: 22 * T, y: 5 * T + 18, bottom: 5 * T, r: 54, prompt: 'CHOOSE A DUNGEON' });
    // the grandfather clock against the great hall's west wall: tells the time of day
    this.stations.push({ kind: 'clock', x: 14.75 * T, y: 13.6 * T, r: 44, prompt: 'CHECK THE TIME' });
    // the celestial hourglass across the hall from it: turn it to bring on night or day
    this.stations.push({ kind: 'hourglass', x: 29.2 * T, y: 13.6 * T, r: 44, prompt: 'TURN THE HOURGLASS' });

    // set dressing per room (tile coordinates of each prop's bottom centre; true = flipped)
    this.decor = [
      // the pet room (the old armory): the four pets on show along the north wall - the cat and dog on
      // cushions with their bowls, the bird on its perch, the pig in its wallow - with sacks of feed,
      // hay and plants about; the flying fish hovers over its pond nearer the door, the butterfly round a potted plant
      ['rugMud', 9.9, 7.9], ['rugPond', 4.4, 10.65], ['plant', 9.3, 10.7], ['petBedRed', 3.4, 7.7], ['petBedBlue', 5.6, 7.7], ['perch', 7.75, 7.6],
      ['bowl', 4.4, 8.3], ['bowl', 6.6, 8.3], ['trough', 9.9, 6.4], ['plant', 11.4, 6.1], ['plant', 2.4, 6.1],
      ['bannerGreen', 6.75, 6.6], ['sacks', 3.0, 12.6], ['hayBale', 10.3, 12.6], ['barrel', 2.7, 10.4],
      // the hall of heroes' lounge, between the nooks: armchairs on a round rug, candles
      ['rugRound', 21.5, 43.4], ['armchair', 19.7, 42.9], ['armchair', 23.3, 42.9, true],
      ['candelabra', 18.2, 45.0], ['candelabra', 24.8, 45.0], ['plant', 4.6, 45.7], ['plant', 38.8, 45.7],
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
      ['barrel', 44.3, 17.4], ['crate', 44.4, 28.4],
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
    this.decor.push(...HeroNooks.decor(T));

    // furniture is solid, and stations stand on solid bases
    for (const o of this.decor) {
      const fp = PROP_FOOTPRINT[o.name];
      if (fp) d.addObstacle?.(o.x - fp[0] / 2, o.y - fp[1], fp[0], fp[1]);
    }
    for (const o of HeroNooks.solids(T)) d.addObstacle?.(o.x, o.y, o.w, o.h);
    // the archery lane's targets are live (TrainingTarget, made by the game): hit them like the dummy
    this.targets = [[50.4, 18.6], [50.4, 21.8], [50.4, 25.0]].map(([tx, ty]) => ({ x: tx * T, y: ty * T }));
    for (const t of this.targets) d.addObstacle?.(t.x - 13, t.y - 8, 26, 8);
    const base = { hero: [16, 8], pets: [36, 6], tome: [30, 8], bestiary: [24, 6], legend: [44, 5], potions: [48, 10], practice: [26, 6], clock: [24, 10], hourglass: [34, 10] };
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
    // the wanderers each live in a slot on one of the library shelves: they wriggle loose,
    // fly a lap of the library, then come home and slide back in (see drawBooks)
    const shelves = this.decor.filter((o) => o.name === 'bookshelf');
    this.books = [
      ...[0, 1, 2, 3].map((i) => ({ orbit: lectern, r: 34, h: 50, phase: (i * TAU) / 4, speed: 0.9, color: ['#7a2a3a', '#2a4a7a', '#3a6a3a', '#5a2a7a'][i] })),
      ...shelves.map((s, i) => ({
        wander: true, phase: i * 2.1, speed: 0.35 + (i % 3) * 0.07, offset: i * 4.3, color: ['#7a5a24', '#2a6a6a', '#8a3a2a', '#4a3a7a'][i % 4],
        home: { x: s.x - 21 + [9, 27, 15, 31][i % 4], y: s.y - 54 + [5, 18, 31, 18][i % 4] + 5 },
      })),
    ];
    // wooden signs naming the rooms: [text, x, y (board centre), sort y]
    this.signs = [
      ['PETS', 6.75, 3.75, 5], ['HALL OF HEROES', 18.6, 31.75, 33],['LIBRARY', 9.55, 14.3, 16], ['WORKSHOP', 36.6, 3.75, 5], ['QUARTERS', 16.9, 21.6, 23],
    ].map(([text, tx, ty, sy]) => ({ text, x: tx * T, y: ty * T, sortY: sy * T }));
    this.signposts = [{ text: 'TRAINING GROUNDS', x: 34.6 * T, y: 19.0 * T }];

    // the keep's cats, each with its own haunts: it sits a while at each spot, then trots to the next.
    // Walk up and press E to pet one: it stops, leans into it and purrs
    this.cats = [
      ['ginger', [[17.5, 18.4], [22, 17], [22, 24.5], [25.5, 26.4], [22, 21.5], [26.5, 18.2], [22.5, 8.5]], 6],
      ['black', [[4.2, 19.2], [7.4, 21.6], [5.2, 25.2], [9.4, 25.6], [7.2, 18.6]], 7],
      ['grey', [[36.2, 21.2], [42.5, 20.4], [46.4, 24.2], [38.6, 26.8], [45.2, 28.2]], 5],
      ['white', [[25.5, 25.3], [21.8, 27.6], [21.6, 36.4], [21.5, 42.2], [17.8, 38.6], [26.4, 38.8], [21.9, 34.0], [28.4, 27.4]], 9],
      ['cream', [[45.2, 13.1], [48.2, 11.2], [47.6, 7.6], [44.6, 8.6]], 8],
    ].map(([coat, path, sit], i) => ({ coat, name: CAT_COATS[coat].name, sit, t: i * 7.3, pet: 0, path: path.map(([tx, ty]) => ({ x: tx * T, y: ty * T })) }));
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
    // cats go about their rounds, except while someone is petting them
    for (const c of this.cats) {
      if (c.pet > 0) {
        c.pet -= dt;
        c.heart = (c.heart || 0) - dt;
        if (c.heart <= 0) { c.heart = 0.45; this.heartFx(c); }
      } else c.t += dt;
    }
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
   * A pair of wooden doors in every doorway (see SwingDoors), hinged at the sides of the opening.
   * ns: the door plane runs north-south (a doorway through a side wall), else east-west.
   */
  buildDoors() {
    const T = CONFIG.tileSize;
    const d = this.world.dungeon;
    return new SwingDoors((typeof KEEP_DOORS === 'undefined' ? [] : KEEP_DOORS).map(([x0, y0, x1, y1]) => {
      const ns = d.tileAt(x0 - 1, Math.floor((y0 + y1) / 2)) === TILE.FLOOR;
      // the doorway's tiles: solid while the door is shut
      const tiles = [];
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) tiles.push(ty * d.cols + tx);
      return ns
        ? { ns, x: (x0 + x1 + 1) / 2 * T, a: y0 * T, b: (y1 + 1) * T, tiles }
        : { ns, y: (y0 + y1 + 1) / 2 * T, a: x0 * T, b: (x1 + 1) * T, tiles };
    }));
  }

  updateDoors(dt) {
    this.doors ??= this.buildDoors();
    this.doors.update(dt, this.world);
  }

  doorDrawables() {
    return this.doors ? this.doors.drawables() : [];
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
    hero.nearCat = null;
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
    // a cat close by can be petted
    best = 34;
    for (const c of this.cats) {
      const s = this.catState(c);
      const d = dist(hero.x, hero.y, s.x, s.y);
      if (d < best) { best = d; hero.nearCat = c; }
    }
    if (hero.nearCat && Input.pressed('interact')) {
      Input.consume('interact');
      this.pet(hero.nearCat, hero);
      return;
    }
    if (hero.nearCat) return;
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

  /** Petting a cat: it stops, turns to you, leans in with its eyes shut and purrs, hearts drifting up. */
  pet(c, hero) {
    const s = this.catState(c);
    const fresh = !(c.pet > 0);
    c.pet = 2.6;
    c.heart = 0;
    c.petFlip = hero.x < s.x;
    hero.facing = s.x >= hero.x ? 1 : -1;
    c.pets = (c.pets || 0) + 1;
    if (hero === this.world.localPlayer) {
      Sound.play(fresh ? 'meow' : 'purr', 0.3);
      if (fresh) Sound.play('purr');
      this.world.effects.text(s.x, s.y - 30, `${c.name} PURRS`, { color: '#ffb0c8', size: 7, life: 1.2, rise: 20 });
    }
  }

  /** A little pixel heart floating up off a cat being petted (visual only). */
  heartFx(c) {
    const s = this.catState(c);
    const x0 = s.x + vrand(-6, 6);
    const y0 = s.y - 14;
    const sway = vrand(0, 6);
    this.world.effects.add(1.1, (ctx, t) => {
      const x = Math.round(x0 + Math.sin(t * 6 + sway) * 4);
      const y = Math.round(y0 - t * 34);
      ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y + 3, 5, 1); ctx.fillRect(x - 1, y + 4, 3, 1);
      ctx.fillStyle = '#ff6a8a';
      ctx.fillRect(x - 2, y - 1, 2, 3); ctx.fillRect(x + 1, y - 1, 2, 3); ctx.fillRect(x - 1, y + 1, 3, 2); ctx.fillRect(x, y + 3, 1, 1);
      ctx.fillStyle = '#ffd0dc';
      ctx.fillRect(x - 2, y - 1, 1, 1);
      ctx.globalAlpha = 1;
    });
  }

  /**
   * The teleport map (see HUD.drawTeleport): the hero vanishes in a puff of sparkles and
   * reappears at (x, y), nudged to the nearest clear floor. Only onto the keep's floor.
   * A shared command, so every machine moves them on the same tick.
   */
  teleport(hero, x, y) {
    const d = this.world.dungeon;
    const T = CONFIG.tileSize;
    if (d.tileAt(Math.floor(x / T), Math.floor(y / T)) !== TILE.FLOOR) return;
    if (hero.seat) this.standUp(hero);
    const fx = this.world.effects;
    const poof = (px, py) => fx.burst(px, py - 14, { count: 18, colors: ['#ffffff', '#a8d8ff', '#ffe680'], speed: [30, 110], life: [0.3, 0.6], up: 30 });
    poof(hero.x, hero.y);
    const pt = d.freePoint(x, y, hero.hw, hero.hh);
    hero.x = pt.x;
    hero.y = pt.y;
    hero.kbx = 0;
    hero.kby = 0;
    poof(hero.x, hero.y);
    if (hero === this.world.localPlayer) {
      this.world.camera.follow(hero.x, hero.y, 0, d.width, d.height, true);
      Sound.play('uiClick');
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
      if (s.kind === 'hero') this.drawNookRing(ctx, s);
      if (s.kind !== 'workshop' && s.kind !== 'hero') drawShadow(ctx, s.x, s.y + 4, s.kind === 'hero' ? 18 : 26, 6);
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
      // a hero at home in their nook, unless someone's out playing them
      else if (s.kind === 'hero') items.push(...HeroNooks.drawables(s.id, s.x, s.y, this.time, this.world.players.some((p) => p.classId === s.id)));
      else items.push({ y: s.y, draw: (ctx) => this.drawStation(ctx, s) });
    }
    // the pets on show, each at its spot, unless it's out following someone around the keep
    for (const [kind, at] of Object.entries(this.petSpots)) {
      if (this.world.pets.some((pt) => pt.kind === kind)) continue;
      items.push({ y: at.y + 2, draw: (ctx) => this.drawShowPet(ctx, kind, at) });
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
    for (const c of this.cats) {
      const s = this.catState(c);
      const pose = c.pet > 0 ? 'Happy' : s.walking ? (Math.floor(this.time * 8) % 2 ? 'Walk1' : 'Walk2') : 'Sit';
      items.push({
        y: s.y,
        draw: (ctx) => {
          drawShadow(ctx, s.x, s.y, 6, 2, 0.3);
          // purring: a gentle wobble
          const purr = c.pet > 0 ? Math.round(Math.sin(this.time * 30) * 0.6) : 0;
          drawProp(ctx, `cat${pose}_${c.coat}`, s.x + purr, s.y, c.pet > 0 ? c.petFlip : s.flip);
        },
      });
    }
    return items;
  }

  /** Where a cat is on its rounds: it sits a while at each spot, then trots to the next. */
  catState(c) {
    const sit = c.sit;
    const walkSpeed = 34;
    const path = c.path;
    const legs = path.map((a, i) => { const b = path[(i + 1) % path.length]; return dist(a.x, a.y, b.x, b.y) / walkSpeed; });
    const total = legs.reduce((s, l) => s + l + sit, 0);
    let t = c.t % total;
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

  /**
   * A pet on show in the pet room, sitting at its spot: it breathes, now and then looks about or
   * hops (the cat and dog), and the bird flutters up off its perch and settles again.
   */
  drawShowPet(ctx, kind, at) {
    const f = Sprites.pets[kind];
    const seed = { cat: 0, dog: 2.3, bird: 4.1, pig: 6.7, fish: 1.2, butterfly: 3.3 }[kind];
    const t = this.time + seed;
    const cycle = t % 7;
    let pose = f.sit;
    let lift = 0;
    let facing = Math.floor(t / 7) % 2 ? -1 : 1;   // turns to look the other way now and then
    // the fish hovers over its pond, fins beating, and now and then leaps up in an arc
    if (kind === 'fish') {
      pose = f.walk[Math.floor(t * 10) % 2];
      lift = 12 + Math.sin(t * 2.5) * 2 + (cycle > 5.8 ? Math.sin(((cycle - 5.8) / 1.2) * Math.PI) * 10 : 0);
    } else if (kind === 'butterfly') {
      // flutters about over its plant, settling on a leaf for a moment now and then
      const settled = cycle > 4.5 && cycle < 6;
      pose = settled ? f.sit : f.walk[Math.floor(t * 12) % 2];
      lift = settled ? 22 : 30 + Math.sin(t * 1.7) * 5;
    } else if (kind === 'bird' && cycle > 5.6) { pose = f.walk[Math.floor(t * 14) % 2]; lift = Math.sin(((cycle - 5.6) / 1.4) * Math.PI) * 10; }
    else if (kind === 'pig' && cycle < 2) pose = f.rest;                       // a roll in the mud
    else if (cycle > 6.4) { pose = f.walk[0]; lift = Math.sin(((cycle - 6.4) / 0.6) * Math.PI) * 4; }   // a happy hop
    if (kind === 'pig' && cycle < 2) facing = 1;
    drawShadow(ctx, at.x, at.y + 1, 8, 3, 0.25);
    const breathe = Math.sin(t * 3) > 0.6 ? 1 : 0;
    ctx.save();
    ctx.translate(Math.round(at.x), Math.round(at.y - lift));
    ctx.scale(facing, 1);
    ctx.drawImage(pose.img, -pose.ax, -pose.ay - breathe);
    ctx.restore();
    // a heart now and then for the pets you own
    if (Profiles.ownsPet(kind) && cycle > 3 && cycle < 3.8) {
      const k = (cycle - 3) / 0.8;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      HUD.text(ctx, '♥', Math.round(at.x), Math.round(at.y - 26 - k * 10), { size: 7, align: 'center', color: '#ff7aa0' });
      ctx.restore();
    }
  }

  /**
   * The pet keeper's signboard: a hanging board on two posts with a paw print and "PETS",
   * a little bell on the corner, a pouch of treats hung from a peg.
   */
  drawPetBoard(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    for (const dx of [-20, 18]) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + dx - 1, y - 34, 4, 35);
      ctx.fillStyle = '#5b3922';
      ctx.fillRect(x + dx, y - 34, 2, 34);
      ctx.fillStyle = '#8c5e36';
      ctx.fillRect(x + dx, y - 34, 1, 34);
    }
    // the board
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 25, y - 50, 50, 22);
    ctx.fillStyle = '#a07a24';
    ctx.fillRect(x - 24, y - 49, 48, 20);
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(x - 22, y - 47, 44, 16);
    ctx.fillStyle = '#4e301c';
    ctx.fillRect(x - 22, y - 47, 44, 2);
    // a paw print, then the word
    ctx.fillStyle = '#ffb0c8';
    ctx.fillRect(x - 18, y - 39, 5, 4);
    for (const [px, py] of [[-19, -43], [-16, -44], [-13, -43]]) ctx.fillRect(x + px, y + py, 2, 2);
    HUD.text(ctx, 'PETS', x + 4, y - 44, { size: 8, align: 'center', color: '#ffe9a8' });
    // the bell, swinging
    const sw = Math.round(Math.sin(this.time * 2.5) * 1.5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 21 + sw, y - 30, 6, 6);
    ctx.fillStyle = '#e0b84a';
    ctx.fillRect(x + 22 + sw, y - 29, 4, 4);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(x + 22 + sw, y - 29, 1, 2);
    // a pouch of treats on the left post
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 27, y - 26, 8, 9);
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(x - 26, y - 25, 6, 7);
    ctx.fillStyle = '#e8c890';
    ctx.fillRect(x - 26, y - 25, 2, 3);
  }

  drawStation(ctx, s) {
    if (s.kind === 'pets') this.drawPetBoard(ctx, s);
    else if (s.kind === 'practice') this.drawPractice(ctx, s);
    else if (s.kind === 'legend') this.drawLegendBoard(ctx, s);
    else if (s.kind === 'bestiary') this.drawLectern(ctx, s);
    else if (s.kind === 'potions') this.drawAlchemyTable(ctx, s);
    else if (s.kind === 'tome') this.drawEnchantingTable(ctx, s);
    else if (s.kind === 'clock') this.drawClock(ctx, s);
    else if (s.kind === 'hourglass') this.drawHourglass(ctx, s);
  }

  /**
   * Enchanted books: four circle the bestiary lectern; the rest live on the library
   * shelves. Every so often one wriggles out of its slot (leaving a gap), flies a
   * lap of the library flapping its covers like wings and trailing sparkles, then
   * flies home and slides back in. Drawn above everything.
   */
  drawBooks(ctx) {
    const T = CONFIG.tileSize;
    const t = this.time;
    const ease = (k) => k * k * (3 - 2 * k);
    for (const b of this.books) {
      let x;
      let y;
      let wings = 1;   // how far the covers flap (0 = shut, in or near the shelf)
      if (b.orbit) {
        const a = b.phase + t * b.speed;
        x = b.orbit.x + Math.cos(a) * b.r;
        y = b.orbit.y - b.h + Math.sin(a) * b.r * 0.4 + Math.sin(t * 2 + b.phase) * 3;
      } else {
        const u = t * b.speed + b.phase;
        const fx = (6.6 + Math.sin(u) * 3.4 + Math.sin(u * 2.3) * 0.6) * T;
        const fy = (21.5 + Math.sin(u * 1.4 + 1) * 3 + Math.cos(u * 0.7) * 1) * T - 40;
        // its 18 second round: 0.9 wriggling loose, 1.5 out to the lap, ~10 flying,
        // 1.6 back home, 0.6 sliding in, then a rest on the shelf
        const k = (t + b.offset) % 18;
        const h = b.home;
        if (k >= 15) continue;                       // resting on the shelf (part of the shelf art)
        this.drawShelfGap(ctx, h, k);
        if (k < 0.9) {
          this.drawShelvedBook(ctx, b, h.x + Math.round(Math.sin(k * 45) * 1.5 * (k / 0.9)), h.y);
          continue;
        } else if (k < 2.4) {
          const e = ease((k - 0.9) / 1.5);
          x = lerp(h.x, fx, e);
          y = lerp(h.y, fy, e) + Math.sin(e * Math.PI) * 10;   // dips as it pulls free, then climbs
          wings = e;
        } else if (k < 12.8) {
          x = fx;
          y = fy;
        } else if (k < 14.4) {
          const e = ease((k - 12.8) / 1.6);
          x = lerp(fx, h.x, e);
          y = lerp(fy, h.y, e);
          wings = 1 - e;
        } else {
          // sliding back into its slot
          this.drawShelvedBook(ctx, b, h.x, h.y + Math.round((1 - (k - 14.4) / 0.6) * 2));
          continue;
        }
      }
      const flap = Math.abs(Math.sin(t * 6 + b.phase * 3)) * wings;   // 0 = closed, 1 = wide open
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

  /** A wandering book's empty slot while it's out: a dark gap among the spines. */
  drawShelfGap(ctx, h, k) {
    ctx.fillStyle = '#1a1018';
    ctx.fillRect(Math.round(h.x) - 2, Math.round(h.y) - 5, 4, 10);
    // a few sparkles where it pulled free / is about to land
    if (k < 1.4 || k > 13.8) {
      ctx.fillStyle = '#e8d8ff';
      const s = (this.time * 7) % 1;
      ctx.fillRect(Math.round(h.x - 5 + s * 10), Math.round(h.y - 7 - s * 4), 1, 1);
      ctx.fillRect(Math.round(h.x + 4 - s * 8), Math.round(h.y + 2 - s * 6), 1, 1);
    }
  }

  /** A wandering book standing in its slot (spine out), with a faint glow while it stirs. */
  drawShelvedBook(ctx, b, x, y) {
    const bx = Math.round(x);
    const by = Math.round(y);
    drawGlow(ctx, bx, by, 10, '200, 170, 255', 0.3);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 2, by - 6, 5, 12);
    ctx.fillStyle = b.color;
    ctx.fillRect(bx - 1, by - 5, 3, 10);
    ctx.fillStyle = '#d4ac4c';
    ctx.fillRect(bx - 1, by - 3, 3, 1);
    ctx.fillRect(bx - 1, by + 2, 3, 1);
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
      HUD.text(ctx, `[${Settings.prompt('interact')}] ${me.seat.bed ? 'GET UP' : 'STAND UP'}`, me.x, me.y - (me.seat.bed ? 70 : 64) + bob, { size: 7, align: 'center', color: '#ffe680' });
    } else if (me.nearCat && !me.nearStation) {
      const s = this.catState(me.nearCat);
      HUD.text(ctx, `[${Settings.prompt('interact')}] PET ${me.nearCat.name}`, s.x, s.y - 30 + bob, { size: 7, align: 'center', color: '#ffe680' });
    } else if (me.nearSeat && !me.nearStation) {
      HUD.text(ctx, `[${Settings.prompt('interact')}] ${me.nearSeat.bed ? 'SLEEP' : 'SIT'}`, me.nearSeat.x, me.nearSeat.y - (me.nearSeat.bed ? 56 : 30) + bob, { size: 7, align: 'center', color: '#ffe680' });
    }
    for (const s of this.stations) {
      if (s.kind === 'hero') {
        const current = this.world.localPlayer.classId === s.id;
        HUD.text(ctx, current ? `${CONFIG.classes[s.id].name.toUpperCase()} (YOU)` : CONFIG.classes[s.id].name.toUpperCase(), s.x, s.y + 14, { size: 6, align: 'center', color: current ? '#ffe680' : '#d8c8a0' });
      }
    }
    const s = this.near;
    if (!s) return;
    const h = { hero: 78, pets: 62, tome: 74, workshop: 80, practice: 70, gate: -6, legend: 74, bestiary: 54, potions: 58, clock: 86, hourglass: 72 }[s.kind];
    HUD.text(ctx, `[${Settings.prompt('interact')}] ${s.prompt}`, s.x, s.y - h + bob, { size: 8, align: 'center', color: '#ffe680' });
  }

  // ---------- station art ----------

  /** A hero's nook lights up on the floor while you stand at it (gold dashes going round). */
  drawNookRing(ctx, s) {
    if (this.near !== s) return;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.55 + Math.sin(this.time * 4) * 0.15})`;
    ctx.fillStyle = 'rgba(255, 220, 120, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -this.time * 10;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 8, 24, 10, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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

  /**
   * The enchantment tome: a squat table of dark stone with a gold-trimmed violet cloth and glowing runes
   * carved in its front, and above it the tome itself, floating open, bobbing, its pages flicking over,
   * glyphs of every colour of enchantment circling it and drifting up off it.
   */
  drawEnchantingTable(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const t = this.time;
    // the table: a stone block, lit top, shaded side, a cloth hanging over the front
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 17, y - 22, 34, 23);
    ctx.fillStyle = '#423f50';
    ctx.fillRect(x - 16, y - 21, 32, 21);
    ctx.fillStyle = '#5c586c';
    ctx.fillRect(x - 16, y - 21, 32, 4);
    ctx.fillStyle = '#2a2834';
    ctx.fillRect(x + 11, y - 17, 5, 17);
    ctx.fillStyle = '#5a2a8a';
    ctx.fillRect(x - 10, y - 21, 20, 13);
    ctx.fillStyle = '#7a4ab0';
    ctx.fillRect(x - 10, y - 21, 20, 2);
    ctx.fillStyle = '#d4ac4c';
    ctx.fillRect(x - 10, y - 9, 20, 1);
    for (const fx of [-8, 0, 8]) ctx.fillRect(x + fx - 1, y - 8, 2, 2);   // tassels
    // runes carved in the stone, glowing in turn
    for (let i = 0; i < 2; i++) {
      const rx = x - 13 + i * 24;
      const k = 0.4 + Math.max(0, Math.sin(t * 2 + i * 2)) * 0.6;
      ctx.fillStyle = `rgba(200, 160, 255, ${k})`;
      ctx.fillRect(rx, y - 6, 3, 1);
      ctx.fillRect(rx + 1, y - 7, 1, 3);
    }
    // the glow under the floating tome
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y - 40, 30 + Math.sin(t * 3) * 3, '190, 140, 255', 0.45);
    ctx.restore();
    // the tome: floating open over the table, bobbing, a page flicking over now and then
    const by = Math.round(y - 40 + Math.sin(t * 2) * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 13, by - 2, 26, 11);
    ctx.fillStyle = '#6a2a3a';                 // the leather cover showing under the pages
    ctx.fillRect(x - 12, by + 6, 24, 2);
    ctx.fillStyle = '#f4ead7';
    ctx.fillRect(x - 12, by - 1, 11, 7);
    ctx.fillRect(x + 1, by - 1, 11, 7);
    ctx.fillStyle = '#c8b898';
    ctx.fillRect(x - 1, by - 1, 2, 8);         // the spine's fold
    ctx.fillStyle = '#8a6a9a';
    for (let i = 0; i < 3; i++) { ctx.fillRect(x - 10, by + 1 + i * 2, 7, 1); ctx.fillRect(x + 3, by + 1 + i * 2, 7, 1); }
    const flip = (t * 0.7) % 3;
    if (flip < 0.4) {
      // a page turning: rising off the right side and falling over to the left
      const k = flip / 0.4;
      const w = Math.round(Math.cos(k * Math.PI) * 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w >= 0 ? x + 1 : x + w, by - 1 - Math.round(Math.sin(k * Math.PI) * 5), Math.abs(w) || 1, 7);
    }
    // glyphs of the enchantments' colours circling it, sparks drifting up off the pages
    const colors = ['#e84a4a', '#ffd34a', '#6ad8ff', '#c08aff', '#9aff4a', '#ff8ad0'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    colors.forEach((c, i) => {
      const a = t * 1.2 + (i / colors.length) * TAU;
      const gx = x + Math.cos(a) * 22;
      const gy = by + 2 + Math.sin(a) * 7;
      const front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 1 : 0.45;
      PFX.star(ctx, gx, gy, 1, c, '#ffffff', 2);
    });
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      ctx.fillStyle = `rgba(220, 190, 255, ${1 - k})`;
      ctx.fillRect(Math.round(x - 6 + i * 6 + Math.sin(t * 2 + i) * 3), Math.round(by - 4 - k * 22), 2, 2);
    }
    ctx.restore();
  }

  /**
   * The potion guide: an alchemist's table (after Terraria's). A dark wooden table banded in brass,
   * glass orbs set in its front corners glowing blue round a brass emblem; on top a big green flask
   * tipped on its stand pouring into a little pink round-bottomed flask, orange bottles in a row, and
   * a tall brass still with a blue bulb, bubbling.
   */
  drawAlchemyTable(ctx, s) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const t = this.time;
    const WOOD = ['#2a1a10', '#4a2e1c', '#6a4428', '#8c5e36'];
    const BRASS = ['#6a4a14', '#a07a24', '#d4ac4c', '#f4d88a'];
    const rect = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
    // legs and the table's front panel
    rect(OUTLINE, -25, -26, 50, 27);
    rect(WOOD[1], -24, -25, 48, 25);
    rect(WOOD[2], -24, -25, 48, 3);
    rect(WOOD[0], -24, -3, 48, 3);
    rect(WOOD[0], -19, -21, 38, 16);                     // the recessed middle
    rect(WOOD[1], -19, -21, 38, 1);
    // brass banding round the top and down the corners
    rect(BRASS[1], -25, -27, 50, 3);
    rect(BRASS[3], -25, -27, 50, 1);
    for (const cx of [-25, 22]) { rect(BRASS[1], cx, -24, 3, 22); rect(BRASS[2], cx, -24, 1, 22); }
    // glass orbs in the front corners, glowing blue, and the brass emblem between them
    for (const ox of [-15, 15]) {
      PFX.disc(ctx, x + ox, y - 13, 6, 6, OUTLINE, 1);
      PFX.disc(ctx, x + ox, y - 13, 5, 5, '#2a5ad0', 1);
      PFX.disc(ctx, x + ox, y - 13, 3, 3, '#8ad8ff', 1);
      rect('#ffffff', ox - 2, -16, 2, 2);
    }
    PFX.disc(ctx, x, y - 13, 6, 6, OUTLINE, 1);
    PFX.disc(ctx, x, y - 13, 5, 5, BRASS[2], 1);
    PFX.disc(ctx, x, y - 13, 3, 3, BRASS[3], 1);
    rect(BRASS[0], -1, -15, 2, 4);
    // on top, left: a big green flask tipped on a brass stand, pouring into a pink round-bottomed flask
    rect(OUTLINE, -22, -34, 2, 8);
    rect(BRASS[1], -21, -34, 1, 7);
    PFX.disc(ctx, x - 16, y - 40, 8, 8, OUTLINE, 1);
    PFX.disc(ctx, x - 16, y - 40, 7, 7, '#3ab84a', 1);
    PFX.disc(ctx, x - 17, y - 42, 4, 4, '#a8ffb0', 1);
    rect(OUTLINE, -10, -50, 9, 5);                       // its neck, tipped right
    rect('#a8e8ff', -9, -49, 7, 3);
    const drip = (t * 2) % 1;
    rect('#6aff7a', -2, -45 + Math.round(drip * 10), 1, 2);
    PFX.disc(ctx, x + 1, y - 30, 5, 5, OUTLINE, 1);
    PFX.disc(ctx, x + 1, y - 30, 4, 4, '#e0609a', 1);
    PFX.disc(ctx, x, y - 31, 2, 2, '#ffd0e8', 1);
    rect(OUTLINE, -1, -38, 4, 5);
    rect('#d8e8f8', 0, -37, 2, 4);
    // orange bottles in a row
    for (const bx of [-8, 8]) {
      rect(OUTLINE, bx - 2, -33, 5, 7);
      rect('#ff8a1e', bx - 1, -31, 3, 4);
      rect('#ffd34a', bx - 1, -31, 1, 2);
      rect(WOOD[3], bx - 1, -35, 3, 2);
    }
    // right: a tall brass still with a blue bulb, bubbles rising out of its spout
    rect(OUTLINE, 14, -58, 5, 32);
    rect(BRASS[1], 15, -57, 3, 31);
    rect(BRASS[3], 15, -57, 1, 31);
    PFX.disc(ctx, x + 16, y - 37, 6, 7, OUTLINE, 1);
    PFX.disc(ctx, x + 16, y - 37, 5, 6, '#4a8ad8', 1);
    PFX.disc(ctx, x + 15, y - 39, 2, 3, '#c8f0ff', 1);
    rect(OUTLINE, 12, -60, 9, 3);
    rect(BRASS[2], 13, -59, 7, 1);
    rect(OUTLINE, 19, -56, 6, 2);                         // the spout
    rect(BRASS[1], 20, -56, 5, 1);
    for (let i = 0; i < 3; i++) {
      const b = (t * 0.8 + i / 3) % 1;
      ctx.fillStyle = `rgba(200, 240, 255, ${1 - b})`;
      ctx.fillRect(Math.round(x + 24 + Math.sin(t * 3 + i) * 2), Math.round(y - 58 - b * 14), 2, 2);
    }
    // the glass glowing
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x - 16, y - 40, 16, '90, 220, 110', 0.25 + Math.sin(t * 3) * 0.05);
    drawGlow(ctx, x + 16, y - 37, 14, '120, 180, 255', 0.25);
    for (const ox of [-15, 15]) drawGlow(ctx, x + ox, y - 13, 10, '120, 180, 255', 0.2 + Math.sin(t * 2 + ox) * 0.06);
    ctx.restore();
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
    const T = CONFIG.tileSize;
    Lighting.draw(ctx, cam, this.lights(), {
      dark,
      tint,
      // moonlight outdoors: the yard is never as dark as the halls
      cut: (lc, ox, oy) => {
        lc.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (const id of ['yard', 'garden']) {
          const r = KEEP_ROOMS[id];
          lc.fillRect(r.x0 * T - ox, r.y0 * T - oy, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T);
        }
      },
    });
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
      else if (s.kind === 'tome') out.push({ x: s.x, y: s.y - 40, r: 90, s: 0.85, rgb: '190, 140, 255' });
      else if (s.kind === 'hourglass') out.push({ x: s.x, y: s.y - 34, r: 90, s: 0.8, rgb: '170, 180, 255' });
    }
    out.push({ x: this.librarian.x, y: this.librarian.y - 10, r: 70, s: 0.7, rgb: '255, 200, 120' });
    out.push(...HeroNooks.lights(CONFIG.tileSize, t));
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
