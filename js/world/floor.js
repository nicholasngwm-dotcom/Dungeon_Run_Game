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

// floor size (tiles) per room type: [w, h] or [[wMin, wMax], [hMin, hMax]]
const ROOM_SIZES = {
  start: [16, 12], boss: [30, 21], shop: [21, 13], special: [16, 12], secret: [15, 11], puzzle: [18, 14],
  combat: [[23, 28], [16, 19]], defend: [[27, 30], [19, 21]], survival: [[28, 30], [19, 21]],
};
const MAX_CHUNKS = 48;            // painted chunks kept around (the least recently drawn go first)

class FloorMap extends Dungeon {
  constructor(stage, themeId, seed = Math.floor(Math.random() * 1e9)) {
    super({ custom: true });
    const g = CONFIG.run.grid;
    this.stage = stage;
    this.themeId = themeId;
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
    const boss = leaves.shift() || this.rooms.filter((r) => r !== start).sort((a, b) => depth[b.id] - depth[a.id])[0];
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
      r.special = pick(specials);
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

    for (const r of this.rooms) this.placeRoom(r);
    for (const l of this.links) this.carveLink(this.rooms[l.a], this.rooms[l.b]);
    this.placeTorches();
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

  /** Sizes the room inside its cell (centred, so hallways along the cell's middle always reach it) and carves it. */
  placeRoom(r) {
    const g = CONFIG.run.grid;
    const size = ROOM_SIZES[r.type];
    const roll = (v) => (Array.isArray(v) ? randInt(v[0], v[1]) : v);
    const w = roll(size[0]);
    const h = roll(size[1]);
    const ox = 1 + r.gx * g.cellW;
    const oy = 1 + r.gy * g.cellH;
    r.x0 = ox + Math.floor((g.cellW - w) / 2);
    r.y0 = oy + Math.floor((g.cellH - h) / 2) + 1;   // a little lower: the top wall face is 2 tiles tall
    r.x1 = r.x0 + w - 1;
    r.y1 = r.y0 + h - 1;
    r.midX = ox + Math.floor(g.cellW / 2);
    r.midY = oy + Math.floor(g.cellH / 2) + 1;
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
    return this.grid[ty][tx];
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
    const B = (x, y) => this.baseTile(x, y);
    const grave = this.themeId === 'graveyard';
    for (let ty = cy * CHUNK; ty < (cy + 1) * CHUNK && ty < this.rows; ty++) {
      for (let tx = cx * CHUNK; tx < (cx + 1) * CHUNK && tx < this.cols; tx++) {
        const x = tx * T;
        const y = ty * T;
        if (B(tx, ty) === TILE.FLOOR) {
          const zone = this.zone[this.idx(tx, ty)];
          if (grave && zone === ZONE.ROOM) {
            Grave.grass(p, x, y, rng);
            if (rng() < 0.03 && B(tx, ty - 1) === TILE.FLOOR && B(tx, ty + 1) === TILE.FLOOR) Tiles.graveDecor(p, x, y, rng);
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
        if (grave && (below1 || below2)) {
          Grave.wallFace(p, x, y, below1 ? 1 : 0, rng);
        } else if (grave) {
          Grave.hedge(p, x, y, rng, { left: B(tx - 1, ty) === TILE.FLOOR, right: B(tx + 1, ty) === TILE.FLOOR, up: B(tx, ty - 1) === TILE.FLOOR, down: false });
        } else if (below1 || below2) {
          Tiles.wallFace(p, x, y, below1 ? 1 : 0, rng);
        } else {
          Tiles.wallTop(p, x, y, rng);
          Tiles.wallEdges(p, x, y, {
            down: false,
            left: B(tx - 1, ty) === TILE.FLOOR,
            right: B(tx + 1, ty) === TILE.FLOOR,
          });
        }
      }
    }
    for (const t of this.torches) {
      if (Math.floor(t.tx / CHUNK) === cx && Math.floor(t.ty / CHUNK) === cy) Tiles.torchBracket(p, t.tx * T, t.ty * T);
    }
    return p.canvas;
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
