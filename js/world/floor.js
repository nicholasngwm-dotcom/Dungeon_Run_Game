// A generated dungeon floor (one stage of a run): rooms on a grid of cells,
// joined by straight wide hallways (with swinging doors), Soul Knight style. Rooms are a tree
// grown out from the start room; the boss sits in the farthest dead end.
// One extra secret room sits on its own with no hallways: a glowing hole in a
// combat room's floor drops the hero into it.
//
// It's a Dungeon (same collision API), with three differences:
//   - door tiles can be locked (solid) while a room's objective runs
//   - floorBounds is the active room while one is locked (boss, ghosts, spawns)
//   - the background is painted in 512px chunks on demand, since a whole floor
//     is far too big for one canvas

const CHUNK = 16;                 // tiles per chunk side
const ZONE = { WALL: 0, ROOM: 1, HALL: 2 };

// floor size (tiles) per room type: [w, h] or [[wMin, wMax], [hMin, hMax]]; odd, so the hallways meet
// rooms dead centre (see placeRoom)
const ROOM_SIZES = {
  start: [17, 13], boss: [31, 21], shop: [21, 13], special: [17, 13], secret: [15, 11], puzzle: [19, 15], vault: [19, 13],
  combat: [[23, 29], [17, 19]], defend: [[27, 31], [19, 21]], survival: [[29, 31], [19, 21]],
};
const MAX_CHUNKS = 48;            // painted chunks kept around (the least recently drawn go first)

class FloorMap extends Dungeon {
  /**
   * opts.boss: the stage boss (the castle paints its boss room as her garden or his throne room).
   * opts.practice: a boss practice floor (from the practice range): only the start room and the boss room.
   * opts.vault: the run's last floor: it also has the gem vault, sealed off like the secret room (the
   *   last boss's blue portal is the way in).
   */
  constructor(stage, themeId, seed = Math.floor(Math.random() * 1e9), opts = {}) {
    super({ custom: true });
    const g = CONFIG.run.grid;
    this.stage = stage;
    this.themeId = themeId;
    this.bossType = opts.boss || null;
    this.practice = !!opts.practice;   // boss practice: just a small entrance room and the boss's room
    this.test = !!opts.test;           // the test dungeon: a fixed floor with one of every room (see testLayout)
    this.hasVault = (!!opts.vault || this.test) && !this.practice;
    this.seed = seed;
    this.T = CONFIG.tileSize;
    this.cols = g.cols * g.cellW + 2;
    this.rows = g.rows * g.cellH + 2;
    this.width = this.cols * this.T;
    this.height = this.rows * this.T;
    this.grid = [];
    for (let y = 0; y < this.rows; y++) this.grid.push(new Array(this.cols).fill(TILE.WALL));
    this.zone = new Uint8Array(this.cols * this.rows);
    this.locked = new Set();      // tile indices that are solid right now (locked doors)
    this.activeRoom = null;
    this.rooms = [];
    this.links = [];              // { a, b }: hallways between neighbouring rooms
    this.torches = [];
    this.chunks = new Map();
    this.generate();
    const s = this.startRoom;
    this.center = { x: s.cx, y: s.cy };
    this.playerStart = { x: s.cx, y: s.cy + this.T };
  }

  idx(tx, ty) { return ty * this.cols + tx; }

  // ---------- generation ----------

  generate() {
    for (let tries = 0; tries < 40; tries++) {
      this.rooms = [];
      this.links = [];
      if (this.layout() || tries === 39) break;
    }
    for (const r of this.rooms) this.placeRoom(r);
    for (const l of this.links) this.carveLink(this.rooms[l.a], this.rooms[l.b]);
    this.placeTorches();
  }

  /** Grows the tree of rooms and picks their types. False if the layout doesn't suit the boss (try again). */
  layout() {
    const g = CONFIG.run.grid;
    const count = CONFIG.run.roomCount[this.stage - 1];
    const cells = new Map();                       // "cx,cy" -> room
    const key = (cx, cy) => `${cx},${cy}`;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const addRoom = (cx, cy) => {
      const room = { id: this.rooms.length, gx: cx, gy: cy, links: [], type: 'combat', state: 'idle', seen: false, visited: false };
      this.rooms.push(room);
      cells.set(key(cx, cy), room);
      return room;
    };
    const link = (a, b) => {
      a.links.push(b.id);
      b.links.push(a.id);
      this.links.push({ a: a.id, b: b.id });
    };

    // boss practice: the entrance room, and the boss room beside it (entered from the side)
    if (this.practice) {
      const start = addRoom(Math.floor(g.cols / 2) - 1, Math.floor(g.rows / 2));
      const boss = addRoom(Math.floor(g.cols / 2), Math.floor(g.rows / 2));
      link(start, boss);
      start.type = 'start';
      boss.type = 'boss';
      return true;
    }

    if (this.test) return this.testLayout(addRoom, link);

    // grow a tree out from the middle cell, preferring rooms with few neighbours (long branches)
    const start = addRoom(Math.floor(g.cols / 2), Math.floor(g.rows / 2));
    let guard = 0;
    while (this.rooms.length < count && guard++ < 2000) {
      const from = choose(this.rooms.filter((r) => r.links.length < 3));
      if (!from) break;
      const [dx, dy] = choose(dirs);
      const nx = from.gx + dx;
      const ny = from.gy + dy;
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || cells.has(key(nx, ny))) continue;
      // keep rooms from touching more than one existing room (cleaner corridors, real dead ends)
      const touching = dirs.filter(([ax, ay]) => cells.has(key(nx + ax, ny + ay))).length;
      if (touching > 1 && Math.random() < 0.85) continue;
      link(from, addRoom(nx, ny));
    }

    // room types: start, boss in the farthest dead end, shop + specials in other dead ends,
    // then one each of defend / survival / puzzle, the rest combat
    start.type = 'start';
    const depth = this.bfs(start);
    const leaves = this.rooms.filter((r) => r !== start && r.links.length === 1).sort((a, b) => depth[b.id] - depth[a.id]);
    // the throne room, the study and the manor's hall are entered from the side or from below, never
    // through the wall behind the throne (or her desk, or the grand staircase)
    const fits = (r) => !['king', 'princess', 'prince', 'phantom'].includes(this.bossType) || !r.links.some((id) => this.rooms[id].gy < r.gy);
    const boss = leaves.find(fits) || this.rooms.filter((r) => r !== start && fits(r)).sort((a, b) => depth[b.id] - depth[a.id])[0];
    if (!boss) return false;
    if (leaves.includes(boss)) leaves.splice(leaves.indexOf(boss), 1);
    boss.type = 'boss';
    const rest = this.rooms.filter((r) => r.type === 'combat');
    const pick = (list) => list.splice(Math.floor(Math.random() * list.length), 1)[0];
    const deadEnds = rest.filter((r) => leaves.includes(r));
    const take = () => (deadEnds.length ? rest.splice(rest.indexOf(pick(deadEnds)), 1)[0] : pick(rest));
    const shop = take();
    if (shop) shop.type = 'shop';
    const specials = CONFIG.run.specials.slice();
    for (let i = 0; i < (rest.length >= 8 ? 2 : 1); i++) {
      const r = take();
      if (!r) break;
      r.type = 'special';
      r.special = pick(specials) || choose(CONFIG.run.specials);   // (a list of one, from ?special=, can run out)
    }
    for (const t of ['defend', 'survival', 'puzzle']) {
      if (rest.length > 3) pick(rest).type = t;
    }
    // every stage must have a shop (with its restaurant) and a special room: if the
    // layout came out too small, turn combat rooms into them
    const ensure = (type, setup) => {
      if (this.rooms.some((r) => r.type === type)) return;
      const combat = this.rooms.filter((r) => r.type === 'combat');
      const pool = combat.filter((r) => r.links.length === 1);
      const r = choose(pool.length ? pool : combat);
      if (r) { r.type = type; setup?.(r); }
    };
    ensure('shop');
    ensure('special', (r) => { r.special = choose(CONFIG.run.specials); });

    // secret room: a room in an empty cell with no hallways at all. The only way
    // in is the glowing hole in one combat room's floor (see DungeonRun).
    const empty = [];
    for (let cy = 0; cy < g.rows; cy++) for (let cx = 0; cx < g.cols; cx++) if (!cells.has(key(cx, cy))) empty.push([cx, cy]);
    if (empty.length && this.rooms.some((r) => r.type === 'combat')) {
      const [cx, cy] = choose(empty);
      addRoom(cx, cy).type = 'secret';
    }
    // the gem vault (last floor only): another room on its own, reached by the last boss's portal
    if (this.hasVault) {
      const free = empty.filter(([cx, cy]) => !cells.has(key(cx, cy)));
      if (!free.length) return false;
      const [cx, cy] = choose(free);
      addRoom(cx, cy).type = 'vault';
    }
    return true;
  }

  /**
   * The test dungeon's floor (on the 5x5 grid): the start room in the middle with a puzzle room above,
   * the shop to the right (and the boss room beyond it, entered from the side), a combat room (with the
   * secret hole) and a survival room to the left, a defend room below, and the nine special rooms
   * hanging off them. The secret room and the gem vault sit on their own in the corners.
   *
   *   (0,0) vault  (1,0)        (2,0) special  (3,0)          (4,0)
   *   (0,1) special(1,1) special(2,1) PUZZLE   (3,1) special  (4,1)
   *   (0,2) SURVIVE(1,2) COMBAT (2,2) START    (3,2) SHOP     (4,2) BOSS
   *   (0,3) special(1,3) special(2,3) DEFEND   (3,3) special  (4,3)
   *   (0,4)        (1,4) special(2,4) special  (3,4)          (4,4) secret
   */
  testLayout(addRoom, link) {
    const at = {};
    const room = (cx, cy, type, from = null, special = null) => {
      const r = addRoom(cx, cy);
      r.type = type;
      if (special) r.special = special;
      if (from) link(at[from], r);
      at[`${cx},${cy}`] = r;
      return r;
    };
    room(2, 2, 'start');
    room(1, 2, 'combat', '2,2');
    room(0, 2, 'survival', '1,2');
    room(3, 2, 'shop', '2,2');
    room(4, 2, 'boss', '3,2');
    room(2, 1, 'puzzle', '2,2');
    room(2, 3, 'defend', '2,2');
    const specials = CONFIG.run.specials;
    [['1,1', '1,2'], ['0,1', '0,2'], ['3,1', '3,2'], ['2,0', '2,1'], ['1,3', '1,2'], ['0,3', '0,2'], ['3,3', '3,2'], ['2,4', '2,3'], ['1,4', '1,3']]
      .forEach(([cell, from], i) => {
        const [cx, cy] = cell.split(',').map(Number);
        room(cx, cy, 'special', from, specials[i % specials.length]);
      });
    room(4, 4, 'secret');
    room(0, 0, 'vault');
    return true;
  }

  /** Steps from `from` to every room. */
  bfs(from) {
    const depth = { [from.id]: 0 };
    const queue = [from];
    while (queue.length) {
      const r = queue.shift();
      for (const id of r.links) {
        if (depth[id] !== undefined) continue;
        depth[id] = depth[r.id] + 1;
        queue.push(this.rooms[id]);
      }
    }
    return depth;
  }

  /**
   * Sizes the room inside its cell and carves it. Its middle tile sits exactly on the cell's middle
   * row and column (midX, midY), which the hallways run along, so every hallway (an odd number of
   * tiles wide) meets the room dead centre: rooms are an odd number of tiles each way (an even size
   * rolls up by one).
   */
  placeRoom(r) {
    const g = CONFIG.run.grid;
    const size = ROOM_SIZES[r.type];
    const roll = (v) => (Array.isArray(v) ? randInt(v[0], v[1]) : v) | 1;
    const w = roll(size[0]);
    const h = roll(size[1]);
    const ox = 1 + r.gx * g.cellW;
    const oy = 1 + r.gy * g.cellH;
    r.midX = ox + Math.floor(g.cellW / 2);
    r.midY = oy + Math.floor(g.cellH / 2) + 1;   // (a little low in the cell: the top wall face is 2 tiles tall)
    r.x0 = r.midX - (w - 1) / 2;
    r.y0 = r.midY - (h - 1) / 2;
    r.x1 = r.x0 + w - 1;
    r.y1 = r.y0 + h - 1;
    const T = this.T;
    r.cx = (r.x0 + r.x1 + 1) / 2 * T;
    r.cy = (r.y0 + r.y1 + 1) / 2 * T;
    r.doors = [];
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) this.setFloor(x, y, ZONE.ROOM);
    }
  }

  setFloor(x, y, zone) {
    this.grid[y][x] = TILE.FLOOR;
    if (this.zone[this.idx(x, y)] !== ZONE.ROOM) this.zone[this.idx(x, y)] = zone;
  }

  /**
   * A straight hallway (CONFIG.run.grid.hall tiles wide) between neighbouring rooms.
   * The hallway tiles in each room's wall line are that room's door (locked while
   * it's active); `leaf` is where its swinging doors stand (see SwingDoors).
   */
  carveLink(a, b) {
    if (a.gx > b.gx || a.gy > b.gy) [a, b] = [b, a];   // a is left of / above b
    const T = this.T;
    const half = Math.floor(CONFIG.run.grid.hall / 2);
    const tiles = [];
    const doorA = [];
    const doorB = [];
    let leafA;
    let leafB;
    if (a.gy === b.gy) {
      const y = a.midY;
      for (let x = a.x1 + 1; x <= b.x0 - 1; x++) {
        for (let dy = -half; dy <= half; dy++) {
          tiles.push([x, y + dy]);
          if (x === a.x1 + 1) doorA.push(this.idx(x, y + dy));
          if (x === b.x0 - 1) doorB.push(this.idx(x, y + dy));
        }
      }
      const span = { a: (y - half) * T, b: (y + half + 1) * T };
      leafA = { ns: true, x: (a.x1 + 1.5) * T, ...span };
      leafB = { ns: true, x: (b.x0 - 0.5) * T, ...span };
    } else {
      const x = a.midX;
      for (let y = a.y1 + 1; y <= b.y0 - 1; y++) {
        for (let dx = -half; dx <= half; dx++) {
          tiles.push([x + dx, y]);
          if (y === a.y1 + 1) doorA.push(this.idx(x + dx, y));
          if (y === b.y0 - 1) doorB.push(this.idx(x + dx, y));
        }
      }
      const span = { a: (x - half) * T, b: (x + half + 1) * T };
      leafA = { ns: false, y: (a.y1 + 1.6) * T, ...span };   // stands in the low south wall
      leafB = { ns: false, y: b.y0 * T, ...span };           // at the foot of the tall north wall
    }
    for (const [x, y] of tiles) this.setFloor(x, y, ZONE.HALL);
    a.doors.push({ tiles: doorA, to: b.id, leaf: leafA });
    b.doors.push({ tiles: doorB, to: a.id, leaf: leafB });
  }

  /** The hallway (as a link { a, b }) that (x, y) is standing in, or null. */
  hallAt(x, y) {
    const tx = Math.floor(x / this.T);
    const ty = Math.floor(y / this.T);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows || this.zone[this.idx(tx, ty)] !== ZONE.HALL) return null;
    const half = Math.floor(CONFIG.run.grid.hall / 2);
    return this.links.find((l) => {
      let a = this.rooms[l.a];
      let b = this.rooms[l.b];
      if (a.gx > b.gx || a.gy > b.gy) [a, b] = [b, a];
      return a.gy === b.gy
        ? tx > a.x1 && tx < b.x0 && Math.abs(ty - a.midY) <= half
        : ty > a.y1 && ty < b.y0 && Math.abs(tx - a.midX) <= half;
    }) || null;
  }

  /** Torches along the top wall face of every room. */
  placeTorches() {
    const T = this.T;
    for (const r of this.rooms) {
      if (r.type === 'boss' && (this.themeId === 'castle' || this.manor)) continue;   // the garden, the throne room and the manor have their own lights
      for (let tx = r.x0 + 2; tx <= r.x1 - 2; tx += 5) {
        if (this.grid[r.y0 - 1][tx] !== TILE.WALL || this.grid[r.y0 - 2][tx] !== TILE.WALL) continue;
        this.torches.push({ tx, ty: r.y0 - 2, x: tx * T + 16, y: (r.y0 - 2) * T + 8, seed: Math.random() * 10 });
      }
    }
  }

  // ---------- queries ----------

  get startRoom() { return this.rooms.find((r) => r.type === 'start'); }

  /** The room whose floor contains (x, y), or null (walls, hallways). margin in tiles shrinks the room. */
  roomAt(x, y, margin = 0) {
    const tx = x / this.T;
    const ty = y / this.T;
    return this.rooms.find((r) => tx >= r.x0 + margin && tx <= r.x1 + 1 - margin && ty >= r.y0 + margin && ty <= r.y1 + 1 - margin) || null;
  }

  /** A random floor tile centre inside a room (margin tiles from its walls). */
  randomPointIn(r, margin = 1) {
    const T = this.T;
    return { x: (randInt(r.x0 + margin, r.x1 - margin) + 0.5) * T, y: (randInt(r.y0 + margin, r.y1 - margin) + 0.5) * T };
  }

  roomBounds(r) {
    const T = this.T;
    return { left: r.x0 * T, top: r.y0 * T, right: (r.x1 + 1) * T, bottom: (r.y1 + 1) * T };
  }

  // ---------- collision (locked tiles are solid) ----------

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return TILE.WALL;
    if (this.locked.has(this.idx(tx, ty))) return TILE.WALL;
    if (this.doorBlocks?.has(this.idx(tx, ty))) return TILE.WALL;   // a shut door or gate (see SwingDoors)
    if (this.blocks?.has(this.idx(tx, ty))) return TILE.WALL;       // a hedge grown up in the Queen's garden
    return this.grid[ty][tx];
  }

  /** A flier passes over cover, the throne and the Queen's hedges, but not walls, shut doors or locked doorways. */
  flyOver(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    const i = this.idx(tx, ty);
    if (this.locked.has(i) || this.doorBlocks?.has(i)) return false;
    if (this.blocks?.has(i)) return true;
    return FLY_OVER.has(this.grid[ty][tx]);
  }

  /** The active room while one is locked, otherwise the whole floor. */
  get floorBounds() {
    if (this.activeRoom) return this.roomBounds(this.activeRoom);
    return { left: this.T, top: this.T, right: this.width - this.T, bottom: this.height - this.T };
  }

  lock(tiles) { for (const t of tiles) this.locked.add(t); }
  unlock(tiles) { for (const t of tiles) this.locked.delete(t); }

  // ---------- rendering (chunked) ----------

  /** The base tile art ignores locks, so doors don't need repainting. */
  baseTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return TILE.WALL;
    return this.grid[ty][tx];
  }

  draw(ctx, camera) {
    const size = CHUNK * this.T;
    const x0 = camera ? Math.max(0, Math.floor(camera.x / size)) : 0;
    const y0 = camera ? Math.max(0, Math.floor(camera.y / size)) : 0;
    const x1 = camera ? Math.floor((camera.x + camera.width) / size) : Math.ceil(this.width / size);
    const y1 = camera ? Math.floor((camera.y + camera.height) / size) : Math.ceil(this.height / size);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx * size >= this.width || cy * size >= this.height) continue;
        const k = `${cx},${cy}`;
        let chunk = this.chunks.get(k);
        if (chunk) this.chunks.delete(k);   // re-inserted below: the Map keeps the most recently drawn last
        else chunk = this.renderChunk(cx, cy);
        this.chunks.set(k, chunk);
        if (this.chunks.size > MAX_CHUNKS) this.chunks.delete(this.chunks.keys().next().value);
        ctx.drawImage(chunk, cx * size, cy * size);
      }
    }
  }

  renderChunk(cx, cy) {
    const T = this.T;
    const size = CHUNK * T;
    const p = new PixelArt(size, size);
    p.ctx.translate(-cx * size, -cy * size);
    const rng = seededRandom((this.seed + cx * 7919 + cy * 104729) >>> 0);
    // cover stands on ordinary floor (it is drawn as a prop, see DungeonRun.addCover)
    const B = (x, y) => { const t = this.baseTile(x, y); return t === TILE.COVER ? TILE.FLOOR : t; };
    const grave = this.themeId === 'graveyard';
    const castle = this.themeId === 'castle';
    const ruins = this.themeId === 'ruins';
    const deep = grave && this.bossType === 'deathbringer';
    for (let ty = cy * CHUNK; ty < (cy + 1) * CHUNK && ty < this.rows; ty++) {
      for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK && tx < this.cols; tx++) {
        const x = tx * T;
        const y = ty * T;
        if (B(tx, ty) === TILE.FLOOR) {
          const zone = this.zone[this.idx(tx, ty)];
          if (zone === ZONE.ROOM && this.hasVault && this.nearRoom(this.vaultRoom, tx, ty)) {
            VaultTiles.floor(p, x, y, rng, tx, ty);
          } else if (ruins) {
            this.ruinsFloor(p, tx, ty, zone, rng);
          } else if (castle) {
            this.castleFloor(p, tx, ty, zone, rng);
          } else if (this.manor && this.nearRoom(this.bossRoom, tx, ty)) {
            this.manorFloor(p, tx, ty, rng);
          } else if (grave && zone === ZONE.ROOM) {
            Grave.grass(p, x, y, rng);
            // the Deathbringer's room: withered, darker grass and more graves, of dark stone plated in gold
            const dark = deep && this.roomAt(x + T / 2, y + T / 2)?.type === 'boss';
            if (dark) { p.ctx.fillStyle = 'rgba(16, 8, 26, 0.5)'; p.ctx.fillRect(x, y, T, T); }
            if (rng() < (dark ? 0.07 : 0.03) && B(tx, ty - 1) === TILE.FLOOR && B(tx, ty + 1) === TILE.FLOOR) Tiles.graveDecor(p, x, y, rng, dark);
            else if (rng() < 0.015) Tiles.bones(p, x, y, rng);
          } else if (grave) {
            Grave.path(p, x, y, rng);
          } else {
            Tiles.floor(p, x, y, rng);
          }
          // soft shadow under walls above
          if (B(tx, ty - 1) !== TILE.FLOOR) {
            p.ctx.fillStyle = 'rgba(10, 6, 18, 0.42)';
            p.ctx.fillRect(x, y, T, 8);
            p.ctx.fillStyle = 'rgba(10, 6, 18, 0.18)';
            p.ctx.fillRect(x, y + 8, T, 6);
          }
          continue;
        }
        // walls: brick face where floor lies one or two tiles below, flat top otherwise
        const below1 = B(tx, ty + 1) === TILE.FLOOR;
        const below2 = B(tx, ty + 1) !== TILE.FLOOR && B(tx, ty + 2) === TILE.FLOOR;
        const edges = { left: B(tx - 1, ty) === TILE.FLOOR, right: B(tx + 1, ty) === TILE.FLOOR, up: B(tx, ty - 1) === TILE.FLOOR, down: false };
        if (ruins) {
          if (below1 || below2) RuinsTiles.wallFace(p, x, y, below1 ? 1 : 0, rng);
          else RuinsTiles.wallTop(p, x, y, rng, edges);
        } else if (castle) {
          this.castleWall(p, tx, ty, below1 ? 1 : below2 ? 0 : -1, edges, rng);
        } else if (this.manor && this.nearRoom(this.bossRoom, tx, ty, 1, 1)) {
          if (below1 || below2) ManorTiles.wallFace(p, x, y, below1 ? 1 : 0, rng, tx);
          else ManorTiles.wallTop(p, x, y, rng, edges);
        } else if (grave && (below1 || below2)) {
          Grave.wallFace(p, x, y, below1 ? 1 : 0, rng);
        } else if (grave) {
          Grave.hedge(p, x, y, rng, edges);
        } else if (below1 || below2) {
          Tiles.wallFace(p, x, y, below1 ? 1 : 0, rng);
        } else {
          Tiles.wallTop(p, x, y, rng);
          Tiles.wallEdges(p, x, y, { down: false, left: edges.left, right: edges.right });
        }
      }
    }
    // things hung on the walls span two tiles, so they go on after every tile (including the row above the chunk)
    if (ruins) {
      for (let ty = cy * CHUNK - 1; ty < (cy + 1) * CHUNK && ty < this.rows; ty++) {
        for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK && tx < this.cols; tx++) this.ruinsWallHanging(p, tx, ty, B);
      }
    }
    if (castle) {
      for (let ty = cy * CHUNK - 1; ty < (cy + 1) * CHUNK && ty < this.rows; ty++) {
        for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK && tx < this.cols; tx++) this.castleWallHanging(p, tx, ty, B);
      }
    }
    for (const t of this.torches) {
      if (Math.floor(t.tx / CHUNK) === cx && Math.floor(t.ty / CHUNK) === cy) Tiles.torchBracket(p, t.tx * T, t.ty * T);
    }
    return p.canvas;
  }

  // ---------- the castle's look (see CastleTiles) ----------

  get bossRoom() { return this.rooms.find((r) => r.type === 'boss'); }
  get vaultRoom() { return this.rooms.find((r) => r.type === 'vault'); }

  /** True if the boss room is the Phantom King's haunted manor hall (see ManorTiles, ManorDecor). */
  get manor() { return this.themeId === 'graveyard' && this.bossType === 'phantom'; }

  /** The manor's hall: dark old floorboards, with the runner from the doors up to the stairs. */
  manorFloor(p, tx, ty, rng) {
    const T = this.T;
    const boss = this.bossRoom;
    const off = tx + 0.5 - (boss.x0 + boss.x1 + 1) / 2;   // the tile's centre from the room's centre line, in tiles
    if (Math.abs(off) < 2 && ty >= boss.y0 + 4) ManorTiles.runner(p, tx * T, ty * T, rng, off);
    else ManorTiles.floor(p, tx * T, ty * T, rng, tx, ty);
  }

  /** True if tile (tx, ty) is inside room r grown by `pad` tiles (and `top` more above, for the tall back wall). */
  nearRoom(r, tx, ty, pad = 0, top = 0) {
    return !!r && tx >= r.x0 - pad && tx <= r.x1 + pad && ty >= r.y0 - pad - top && ty <= r.y1 + pad;
  }

  /** A same-every-time number for a tile (so each chunk agrees on what hangs where). */
  tileHash(tx, ty) {
    let h = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663) ^ this.seed) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ---------- the ruins' look (see RuinsTiles) ----------

  /** Mossy temple slabs in the rooms (a rune circle round the middle of the guardian's), grassy stepping-stone paths in the halls. */
  ruinsFloor(p, tx, ty, zone, rng) {
    const T = this.T;
    const x = tx * T;
    const y = ty * T;
    if (zone === ZONE.HALL) {
      const l = this.hallAt(x + T / 2, y + T / 2);
      if (l) {
        let a = this.rooms[l.a];
        let b = this.rooms[l.b];
        if (a.gx > b.gx || a.gy > b.gy) [a, b] = [b, a];
        const along = a.gy === b.gy;
        RuinsTiles.hall(p, x, y, rng, along, along ? ty - a.midY : tx - a.midX);
        return;
      }
    }
    RuinsTiles.floor(p, x, y, rng);
    const boss = this.bossRoom;
    if (boss && this.nearRoom(boss, tx, ty)) {
      const cx = (boss.x0 + boss.x1 + 1) / 2 * T;
      const cy = (boss.y0 + boss.y1 + 1) / 2 * T;
      RuinsTiles.circle(p, x, y, cx, cy, 6.5 * T);
    }
  }

  /** Glyph tablets set into the ruins' walls here and there (the upper tile of a two-tile wall face). */
  ruinsWallHanging(p, tx, ty, B) {
    if (B(tx, ty) === TILE.FLOOR || B(tx, ty + 1) === TILE.FLOOR || B(tx, ty + 2) !== TILE.FLOOR) return;
    if (B(tx - 1, ty + 2) !== TILE.FLOOR || B(tx + 1, ty + 2) !== TILE.FLOOR) return;
    if (this.torches.some((t) => Math.abs(t.tx - tx) <= 1 && t.ty === ty)) return;
    if (this.tileHash(tx, ty) % 11 === 0) RuinsTiles.tablet(p, tx * this.T, ty * this.T);
  }

  castleFloor(p, tx, ty, zone, rng) {
    const T = this.T;
    const x = tx * T;
    const y = ty * T;
    const boss = this.bossRoom;
    if (this.nearRoom(boss, tx, ty) && this.bossType === 'queen') {
      // the garden: gravel paths crossing at the bell, a gravel ring round it, lawn between
      const mx = (boss.x0 + boss.x1) / 2;
      const my = (boss.y0 + boss.y1) / 2;
      const d = Math.hypot(tx - mx, (ty - my) * 1.25);
      const path = Math.abs(tx - mx) <= 1 || Math.abs(ty - my) <= 1 || (d > 3.2 && d < 4.6);
      if (path && d > 1.4) CastleTiles.gravel(p, x, y, rng);
      else if (d <= 1.4) CastleTiles.gravel(p, x, y, rng);
      else CastleTiles.gardenGrass(p, x, y, rng);
      return;
    }
    if (this.nearRoom(boss, tx, ty) && this.bossType === 'prince') {
      // the training grounds: packed earth with a chalk sparring ring in the middle
      CastleTiles.yardDirt(p, x, y, rng);
      const cx = (boss.x0 + boss.x1 + 1) / 2 * T;
      const cy = (boss.y0 + boss.y1 + 1) / 2 * T + T;
      CastleTiles.yardChalk(p, x, y, cx, cy, 7 * T);
      return;
    }
    if (this.nearRoom(boss, tx, ty) && this.bossType === 'princess') {
      // the magic study: midnight floorboards and a great rune circle inlaid in the middle
      CastleTiles.studyFloor(p, x, y, rng, tx, ty);
      const cx = (boss.x0 + boss.x1 + 1) / 2 * T;
      const cy = (boss.y0 + boss.y1 + 1) / 2 * T + T;
      CastleTiles.studyCircle(p, x, y, cx, cy, 6 * T);
      return;
    }
    if (this.nearRoom(boss, tx, ty) && this.bossType === 'king') {
      // the throne room: marble, with the red carpet running up the middle to the dais
      const off = Math.round(tx + 0.5 - (boss.x0 + boss.x1 + 1) / 2 - 0.5);
      if (Math.abs(off) <= 2 && ty >= boss.y0 + 4) CastleTiles.throneCarpet(p, x, y, rng, off);
      else CastleTiles.marble(p, x, y, rng, tx, ty);
      return;
    }
    if (zone === ZONE.HALL) {
      const l = this.hallAt(x + T / 2, y + T / 2);
      if (l) {
        let a = this.rooms[l.a];
        let b = this.rooms[l.b];
        if (a.gx > b.gx || a.gy > b.gy) [a, b] = [b, a];
        const along = a.gy === b.gy;
        CastleTiles.hall(p, x, y, rng, along, along ? ty - a.midY : tx - a.midX);
        return;
      }
    }
    CastleTiles.floor(p, x, y, rng);
  }

  /** row: 0 upper wall face, 1 lower wall face, -1 the masonry (or hedge) between rooms. */
  castleWall(p, tx, ty, row, edges, rng) {
    const T = this.T;
    const x = tx * T;
    const y = ty * T;
    const boss = this.bossRoom;
    const garden = this.bossType === 'queen' && this.nearRoom(boss, tx, ty, 2, 1);
    const throne = this.bossType === 'king' && this.nearRoom(boss, tx, ty, 1, 1);
    if (row >= 0) {
      if (garden) CastleTiles.hedgeFace(p, x, y, row, rng);
      else if (throne) CastleTiles.royalWall(p, x, y, row, rng, tx);
      else CastleTiles.wallFace(p, x, y, row, rng);
      return;
    }
    if (garden) CastleTiles.hedgeTop(p, x, y, rng, edges);
    else CastleTiles.wallTop(p, x, y, rng, edges);
  }

  /** Arrow slits and torn banners along the castle's walls; tall stained glass in the throne room. */
  castleWallHanging(p, tx, ty, B) {
    const T = this.T;
    // only on the upper tile of a two-tile wall face
    if (B(tx, ty) === TILE.FLOOR || B(tx, ty + 1) === TILE.FLOOR || B(tx, ty + 2) !== TILE.FLOOR) return;
    if (B(tx - 1, ty + 2) !== TILE.FLOOR || B(tx + 1, ty + 2) !== TILE.FLOOR) return;   // not right at a corner
    if (this.torches.some((t) => Math.abs(t.tx - tx) <= 1 && t.ty === ty)) return;
    const boss = this.bossRoom;
    if (this.bossType === 'queen' && this.nearRoom(boss, tx, ty, 2, 1)) return;
    if (this.bossType === 'king' && this.nearRoom(boss, tx, ty, 1, 1)) {
      const mid = (boss.x0 + boss.x1 + 1) / 2;
      const off = tx + 0.5 - mid;
      if (Math.abs(Math.abs(off) - 12) < 0.6 || Math.abs(Math.abs(off) - 4.5) < 0.6) CastleTiles.stainedGlass(p, tx * T, ty * T);
      return;
    }
    const h = this.tileHash(tx, ty) % 13;
    const rng = seededRandom(this.tileHash(tx, ty));
    if (h === 0) CastleTiles.slit(p, tx * T, ty * T);
    else if (h === 6 && B(tx, ty + 3) === TILE.FLOOR) CastleTiles.banner(p, tx * T, ty * T, rng);
  }

  drawTorches(ctx, time, camera) {
    if (!camera) return super.drawTorches(ctx, time);
    const visible = this.torches.filter((t) => t.x > camera.x - 80 && t.x < camera.x + camera.width + 80 && t.y > camera.y - 80 && t.y < camera.y + camera.height + 80);
    const all = this.torches;
    this.torches = visible;
    super.drawTorches(ctx, time);
    this.torches = all;
  }
}
