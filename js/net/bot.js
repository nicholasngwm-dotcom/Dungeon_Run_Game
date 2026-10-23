// AI stand-in for a player who disconnects in the middle of a run (Session.onPeerLeft):
// the host works out the hero's input each tick and sends it in the bundle like any
// player's, so every machine plays the same bot. It plays at a medium level: it fights
// the nearest enemy from its hero's comfortable range, aims a little loosely, uses its
// abilities every few seconds and its ultimate when it has it, dodges when crowded,
// revives fallen teammates when it's safe, and otherwise follows the party.
// Host only, outside the shared simulation (it reads the game, never changes it).

// how close each hero likes to fight (melee wades in, casters keep their distance)
const BOT_RANGE = { warrior: 50, rogue: 56, bard: 170, priestess: 200, mage: 230, ranger: 250, rocketeer: 210, baker: 190 };

const BotPilot = {
  /**
   * The input a bot-driven hero sends this tick (Session input format). mem holds its
   * timers between ticks; dt is the tick length.
   */
  drive(game, hero, mem, dt) {
    const inp = { h: 0, p: [], mx: hero ? hero.x : 0, my: hero ? hero.y : 0, ml: 0, mr: 0, lp: 0, rp: 0 };
    if (!hero || hero.dead) return inp;
    for (const k of ['retarget', 'jitter', 'ability', 'secondary', 'dodge', 'click', 'stuck', 'strafeSwap']) mem[k] = (mem[k] ?? nativeRandom() * 2) - dt;
    let goal = null;   // where to walk: { x, y, near } (stop within `near`)

    // a teammate down nearby and nothing close: go and pick them up
    const downed = game.players.find((p) => p.dead && p !== hero && dist(p.x, p.y, hero.x, hero.y) < 320);
    const threat = this.nearestEnemy(game, hero.x, hero.y);
    const threatD = threat ? dist(threat.x, threat.y, hero.x, hero.y) : Infinity;
    if (downed && threatD > 150) {
      goal = { x: downed.x, y: downed.y, near: 20 };
      if (dist(downed.x, downed.y, hero.x, hero.y) < 34) inp.h |= 1 << HELD_ACTIONS.indexOf('interact');
    }

    // pick a foe now and then (not every tick: a human takes a moment to switch)
    if (mem.retarget <= 0 || !mem.target || mem.target.dead || !game.getTargets().includes(mem.target)) {
      mem.retarget = 0.4 + nativeRandom() * 0.3;
      mem.target = threat;
    }
    const t = mem.target;
    if (t && !goal) {
      const tx = t.hx ?? t.x;
      const ty = t.hy ?? t.y;
      const d = dist(hero.x, hero.y, tx, ty);
      const want = BOT_RANGE[hero.classId] || 140;
      // aim, a little loosely
      if (mem.jitter <= 0) { mem.jitter = 0.3; mem.ax = (nativeRandom() - 0.5) * 36; mem.ay = (nativeRandom() - 0.5) * 36; }
      inp.mx = tx + (mem.ax || 0);
      inp.my = ty + (mem.ay || 0);
      // keep its range, circling the foe
      if (mem.strafeSwap <= 0) { mem.strafeSwap = 1.5 + nativeRandom() * 2; mem.strafe = nativeRandom() < 0.5 ? -1 : 1; }
      const a = angleTo(hero.x, hero.y, tx, ty);
      const toward = d > want + 30 ? 1 : d < want - 30 ? -0.8 : 0;
      goal = {
        x: hero.x + Math.cos(a) * toward * 60 - Math.sin(a) * (mem.strafe || 1) * 40,
        y: hero.y + Math.sin(a) * toward * 60 + Math.cos(a) * (mem.strafe || 1) * 40,
        near: 6,
      };
      // attack while it's in reach; a click now and then answers "pick a spot" abilities
      if (d < want * 1.6 + 60) inp.ml = 1;
      if (mem.click <= 0) { mem.click = 0.5; inp.lp = 1; }
      // abilities every few seconds, the ultimate when it's charged and a foe is close
      if (mem.ability <= 0 && d < want * 1.8 + 80) {
        mem.ability = 2.5 + nativeRandom() * 2.5;
        const slot = ['e', 'f'].find((s) => hero.cooldowns[s] <= 0 && hero.canAfford(s));
        if (slot) inp.p.push(slot);
      }
      if (mem.secondary <= 0 && d < want * 1.8 + 80) {
        mem.secondary = 3.5 + nativeRandom() * 2.5;
        if (hero.cooldowns.secondary <= 0) inp.rp = 1;
      }
      if (hero.ultReady && d < 320) inp.p.push('ult');
      // crowded: a dodge away now and then
      if (threatD < 55 && mem.dodge <= 0) {
        mem.dodge = 2.5 + nativeRandom() * 2;
        inp.p.push('dodge');
      }
    }

    // nothing to fight: stay with the party (the nearest teammate still playing)
    if (!goal) {
      const mate = game.players.filter((p) => p !== hero && !p.dead && !p.isBot).sort((a, b) => dist(a.x, a.y, hero.x, hero.y) - dist(b.x, b.y, hero.x, hero.y))[0]
        || game.players.find((p) => p !== hero && !p.dead);
      if (mate) goal = { x: mate.x, y: mate.y, near: 70 };
    }
    if (goal) this.walk(game, hero, mem, goal, inp, dt);
    return inp;
  },

  /** The nearest enemy (or boss part) to (x, y), or null. */
  nearestEnemy(game, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of game.getTargets()) {
      if (e.dead || (e.age !== undefined && e.age < 0.3)) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  },

  /** Holds the movement keys toward goal, sidestepping for a moment when it's stuck on something. */
  walk(game, hero, mem, goal, inp, dt) {
    let vx = goal.x - hero.x;
    let vy = goal.y - hero.y;
    const len = Math.hypot(vx, vy);
    if (len < goal.near) return;
    // stuck (barely moved while trying to): pick a side and go round for a moment
    const moved = mem.lastX === undefined ? Infinity : dist(mem.lastX, mem.lastY, hero.x, hero.y);
    mem.lastX = hero.x;
    mem.lastY = hero.y;
    if (moved < hero.speed * dt * 0.2 && mem.stuck <= 0) { mem.stuck = 0.6; mem.side = nativeRandom() < 0.5 ? 1 : -1; }
    if (mem.stuck > 0) {
      const sx = -vy * mem.side;
      const sy = vx * mem.side;
      vx = sx;
      vy = sy;
    }
    const l = Math.hypot(vx, vy) || 1;
    if (vx / l < -0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('left');
    if (vx / l > 0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('right');
    if (vy / l < -0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('up');
    if (vy / l > 0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('down');
  },
};
