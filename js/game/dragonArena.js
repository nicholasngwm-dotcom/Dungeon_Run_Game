// The Blazing Dragon Lord's arena (the Fiery Fortress's boss room when he's its boss): an open platform
// of nether brick over a moat of lava, fenced all round, with his perch - a squat tower - in the middle.
//   The moat: every tile round the room's edge (EDGE tiles deep) is lava, solid to walk into (the fence
//     keeps the heroes out of it) but shots fly over it, as they do over his tower.
//   Bridges of stone cross it from each doorway to the platform, with a gap in the fence there.
//   He circles out over the moat while he flies (see BlazingDragonLord).

const DRAGON_ARENA = { top: 3, bottom: 2, side: 3 };   // how many tiles deep the moat is along each edge

const DragonArena = {
  /** Lays the moat, its bridges, the tower and the fence round room r (run = the DungeonRun). */
  build(run, r) {
    const f = run.floor;
    const T = f.T;
    const E = DRAGON_ARENA;
    const px0 = r.x0 + E.side;
    const px1 = r.x1 - E.side;
    const py0 = r.y0 + E.top;
    const py1 = r.y1 - E.bottom;
    const half = Math.floor(CONFIG.run.grid.hall / 2);
    // which edges have a doorway (each hallway meets the room dead centre)
    const doors = { top: false, bottom: false, left: false, right: false };
    for (const d of r.doors) {
      const t = d.tiles[0];
      const tx = t % f.cols;
      const ty = Math.floor(t / f.cols);
      if (ty < r.y0) doors.top = true;
      else if (ty > r.y1) doors.bottom = true;
      else if (tx < r.x0) doors.left = true;
      else doors.right = true;
    }
    const bridgeAt = (tx, ty) => {
      if (Math.abs(tx - r.midX) <= half && ((doors.top && ty < py0) || (doors.bottom && ty > py1))) return { across: true, side: tx === r.midX - half ? -1 : tx === r.midX + half ? 1 : 0 };
      if (Math.abs(ty - r.midY) <= half && ((doors.left && tx < px0) || (doors.right && tx > px1))) return { across: false };
      return null;
    };
    f.shotThrough ??= new Set();
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (tx >= px0 && tx <= px1 && ty >= py0 && ty <= py1) continue;
        const i = f.idx(tx, ty);
        f.lava.add(i);
        const b = bridgeAt(tx, ty);
        if (b) { f.bridges.set(i, b); continue; }
        f.grid[ty][tx] = TILE.COVER;
        f.shotThrough.add(i);
      }
    }
    // the tower: 3 x 2 tiles in the middle, solid, shots fly past it to him
    for (let ty = r.midY - 1; ty <= r.midY; ty++) {
      for (let tx = r.midX - 1; tx <= r.midX + 1; tx++) {
        f.grid[ty][tx] = TILE.COVER;
        f.shotThrough.add(f.idx(tx, ty));
      }
    }
    // the lava's glow round the moat
    for (let tx = r.x0 + 2; tx <= r.x1 - 2; tx += 5) {
      run.lavaPools.push({ x: (tx + 0.5) * T, y: (r.y0 + 1.5) * T, r: 120 }, { x: (tx + 0.5) * T, y: (r.y1 + 0.5) * T, r: 100 });
    }
    for (let ty = r.y0 + 4; ty <= r.y1 - 3; ty += 5) {
      run.lavaPools.push({ x: (r.x0 + 1.5) * T, y: (ty + 0.5) * T, r: 110 }, { x: (r.x1 - 0.5) * T, y: (ty + 0.5) * T, r: 110 });
    }
    // the fence along the platform's edges, gaps where the bridges come in
    const X0 = px0 * T;
    const X1 = (px1 + 1) * T;
    const Y0 = py0 * T;
    const Y1 = (py1 + 1) * T;
    const pieces = [];
    const gapX = (tx, open) => open && Math.abs(tx - r.midX) <= half;
    const gapY = (ty, open) => open && Math.abs(ty - r.midY) <= half;
    for (let tx = px0; tx <= px1; tx++) {
      if (!gapX(tx, doors.top)) pieces.push({ kind: 'h', x: tx * T, y: Y0 + 4, sort: Y0 + 4 });
      if (!gapX(tx, doors.bottom)) pieces.push({ kind: 'h', x: tx * T, y: Y1 + 2, sort: Y1 + 2 });
    }
    for (let ty = py0; ty <= py1; ty++) {
      if (!gapY(ty, doors.left)) pieces.push({ kind: 'v', x: X0, y: (ty + 1) * T + 4, sort: (ty + 1) * T });
      if (!gapY(ty, doors.right)) pieces.push({ kind: 'v', x: X1, y: (ty + 1) * T + 4, sort: (ty + 1) * T });
    }
    // posts at the corners and either side of each gap
    const posts = [[X0, Y0 + 4], [X1, Y0 + 4], [X0, Y1 + 2], [X1, Y1 + 2]];
    for (const [open, y] of [[doors.top, Y0 + 4], [doors.bottom, Y1 + 2]]) {
      if (open) posts.push([(r.midX - half) * T, y], [(r.midX + half + 1) * T, y]);
    }
    for (const [open, x] of [[doors.left, X0], [doors.right, X1]]) {
      if (open) posts.push([x, (r.midY - half) * T + 4], [x, (r.midY + half + 1) * T + 4]);
    }
    for (const [x, y] of posts) pieces.push({ kind: 'post', x, y, sort: y + 1 });
    run.dragonArena = { room: r, pieces, tower: { x: r.cx, y: (r.midY + 1) * T }, platform: { left: X0, right: X1, top: Y0, bottom: Y1 } };
  },

  /** The fence and the tower, sorted in with everyone else. */
  drawables(run, cam) {
    const A = run.dragonArena;
    if (!A) return [];
    const S = Sprites.dragonLord;
    const out = [];
    for (const pc of A.pieces) {
      if (pc.x < cam.x - 40 || pc.x > cam.x + cam.width + 40 || pc.y < cam.y - 20 || pc.y > cam.y + cam.height + 60) continue;
      const img = S.fence[pc.kind];
      const x = pc.kind === 'h' ? pc.x : pc.x - Math.floor(img.width / 2);
      out.push({ y: pc.sort, draw: (ctx) => ctx.drawImage(img, x, pc.y - img.height) });
    }
    const t = A.tower;
    out.push({ y: t.y, draw: (ctx) => DragonArena.drawTower(ctx, t, run.time) });
    return out;
  },

  /** His tower, its slits and door flickering with the lava inside. */
  drawTower(ctx, t, time) {
    const img = Sprites.dragonLord.tower;
    const D = DRAGON_TOWER;
    drawShadow(ctx, t.x, t.y - 2, 56, 12, 0.45);
    ctx.drawImage(img, Math.round(t.x - D.ax), Math.round(t.y - D.ay));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.75 + Math.sin(time * 5.3) * 0.12 + Math.sin(time * 9.1) * 0.08;
    for (const dx of [-28, 28]) PFX.glow(ctx, t.x + dx, t.y - D.top + 30, 12, FORT_LAVA, 0.35 * flick);
    PFX.glow(ctx, t.x, t.y - 14, 16, FORT_LAVA, 0.45 * flick);
    ctx.restore();
  },

  /** Lights for the room: the tower's glow (the moat's is in lavaPools). */
  lights(run, out) {
    const A = run.dragonArena;
    if (A) out.push({ x: A.tower.x, y: A.tower.y - 30, r: 120, s: 0.5, rgb: FORT_LAVA });
  },

  /** Where the portal opens once he's beaten: in front of his tower. */
  portalSpot(r) { return { x: r.cx, y: r.cy + 3.6 * CONFIG.tileSize }; },
};
