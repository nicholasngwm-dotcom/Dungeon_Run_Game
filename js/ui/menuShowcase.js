// The main menu's backdrop: real fights played by the game itself. Each scene is a
// Game with heroes on autopilot (fed synthetic input, the way multiplayer feeds each
// hero its player's input) against an army or a boss: in the graveyard arena, or (castle
// scenes) in one of the castle's boss rooms, built the way a boss practice floor is.
// Scenes rotate with a fade (clicking the fight skips to the next), the heroes can't
// fall and bosses never quite die, and it all runs muted.

// Every hero is in exactly four scenes, so each gets the same screen time.
// castle: the castle boss whose room the scene is fought in (its boss only if `boss` is set).
const SHOWCASE_SCENES = [
  { heroes: ['warrior', 'baker'], army: ['zombie', 'skeleton', 'zombie', 'skeletonWarrior', 'undeadKnight', 'zombie'], size: 8 },
  { heroes: ['mage', 'rocketeer'], boss: 'golem' },
  { heroes: ['ranger', 'bard'], army: ['wraith', 'ghost', 'wraith', 'skeleton', 'candlehead'], size: 8 },
  { heroes: ['rogue', 'priestess'], boss: 'phantom' },
  { heroes: ['rocketeer', 'warrior', 'priestess'], castle: 'prince', army: ['squire', 'castleArcher', 'castleKnight', 'squire', 'maceSpinner', 'jester'], size: 9 },
  { heroes: ['baker', 'mage', 'ranger'], castle: 'queen', boss: 'queen' },
  { heroes: ['rogue', 'bard', 'baker'], castle: 'prince', boss: 'prince' },
  { heroes: ['rocketeer', 'priestess', 'mage'], castle: 'princess', boss: 'princess' },
  { heroes: ['warrior', 'ranger', 'rogue', 'bard'], castle: 'king', boss: 'king' },
  // the finale: the whole party against the castle's garrison in the throne room
  { heroes: ['warrior', 'ranger', 'mage', 'rogue', 'priestess', 'bard', 'rocketeer', 'baker'], castle: 'king',
    army: ['squire', 'castleKnight', 'castleArcher', 'royalGuard', 'maceSpinner', 'jester', 'castleSorcerer', 'executioner'], size: 16 },
];

// how close each hero likes to fight (melee heroes wade in, casters keep their distance)
const SHOWCASE_RANGE = { warrior: 42, rogue: 48, bard: 170, priestess: 200, mage: 230, ranger: 260, rocketeer: 210, baker: 180 };

const MenuShowcase = {
  scene: -1,
  game: null,
  time: 0,          // seconds into the current scene
  length: 12,       // seconds per scene
  fadeTime: 0.7,
  view: null,       // the smoothed point the camera frames
  bots: [],         // per hero: autopilot timers

  /** Plays SHOWCASE_SCENES[i] (or the next one) from a short head start, so it opens mid-fight. */
  start(i = (this.scene + 1) % SHOWCASE_SCENES.length) {
    this.wire();
    this.scene = i;
    const s = SHOWCASE_SCENES[i];
    const roster = s.heroes.map((classId, n) => ({ id: `s${n}`, name: '', classId }));
    const noop = () => {};
    const opts = { roster, localId: 's0', showcase: true };
    // castle scenes: a boss practice floor, just the entrance and that boss's room
    if (s.castle) opts.run = { mode: 'set', theme: 'castle', practiceBoss: s.castle };
    const g = new Game(s.heroes[0], { onGameOver: noop, onVictory: noop, onInteract: noop, onToast: noop, onNpc: noop, onPurchase: noop, onPracticeReturn: noop },
      opts);
    g.director.update = noop;   // no waves: the scene brings its own enemies
    // nothing locks or starts a boss cutscene when the heroes walk in: every room counts as cleared
    if (g.run) for (const r of g.run.floor.rooms) { r.state = 'cleared'; r.visited = r.seen = true; }
    const arena = this.arenaFor(g, s);
    this.arena = arena;
    // the heroes can be knocked about but never fall
    g.players.forEach((p, n) => {
      const hurt = p.hurt.bind(p);
      p.hurt = (amount, ...rest) => hurt(Math.min(amount, Math.max(0, p.hp - p.maxHp * 0.35)), ...rest);
      const spot = g.dungeon.freePoint(arena.heroes.x + (n - (g.players.length - 1) / 2) * 44, arena.heroes.y + (n % 2) * 18, p.hw, p.hh);
      p.x = spot.x;
      p.y = spot.y;
    });
    if (s.boss) {
      g.boss = Game.createBoss(s.boss, arena.bossAt);
      // skip a boss's entrance: the scene opens mid-fight
      if ('intro' in g.boss) g.boss.intro = 0;
      if ('introAt' in g.boss) { g.boss.alpha = 1; g.boss.revealed = true; }
    } else {
      this.armyAt = 0;
    }
    this.game = g;
    this.time = 0;
    // timers staggered so the party doesn't act in unison; the ultimates are spread over the scene
    const count = g.players.length;
    this.bots = g.players.map((p, n) => ({
      strafe: n % 2 ? -1 : 1, strafeAt: 1.5 + (n % 3), nextAbility: 0.6 + (n % 3) * 0.9, nextSecondary: 1.4 + (n % 3), nextDodge: 3 + (n % 3),
      guardUntil: 0, ultAt: 3 + (n * 7.5) / count, ulted: false,
    }));
    this.view = null;
    this.muted(() => { for (let t = 0; t < 1.4; t += 1 / 60) this.step(1 / 60); });
    this.showTitle();
  },

  /** Runs fn with the game's sound switched off (the menu fights are silent). */
  muted(fn) {
    const ctx = Sound.ctx;
    Sound.ctx = null;
    try { fn(); } finally { Sound.ctx = ctx; }
  },

  update(dt) {
    if (!this.game) this.start(0);
    this.time += dt;
    if (this.time >= this.length) this.start();
    this.muted(() => this.step(Math.min(dt, 1 / 30)));
  },

  step(dt) {
    const g = this.game;
    const s = SHOWCASE_SCENES[this.scene];
    const inputs = {};
    g.players.forEach((p, n) => { inputs[p.netId] = this.drive(p, this.bots[n], dt); });
    g.update(dt, inputs);
    for (const p of g.players) {
      if (p.resource) p.resource.value = p.resource.max;
      if (p.dead) p.revive(p.maxHp, g);
    }
    if (g.boss && g.boss.hp < g.boss.maxHp * 0.45) g.boss.hp = g.boss.maxHp * 0.45;
    if (s.army) this.reinforce(g, s, dt);
    this.frame(g, dt);
  },

  /** Keeps the army topped up: fresh enemies rise from the ground around the heroes. */
  reinforce(g, s, dt) {
    this.armyAt -= dt;
    if (this.armyAt > 0 || g.enemies.length + g.pendingSpawns >= s.size) return;
    this.armyAt = 0.45;
    const b = this.arena.bounds;
    const hero = g.players[0];
    // mostly from the right, where the fight is framed, on open floor (never inside an obstacle)
    const a = (Math.random() - 0.5) * Math.PI * 1.3;
    const r = 170 + Math.random() * 110;
    const x = clamp(hero.x + Math.cos(a) * r, b.left, b.right);
    const y = clamp(hero.y + Math.sin(a) * r * 0.75, b.top, b.bottom);
    const pt = g.dungeon.freePoint(x, y, 12, 8);
    g.spawnEnemy(s.army[Math.floor(Math.random() * s.army.length)], pt.x, pt.y);
  },

  /** What a bot hero "presses" this tick: closes in or keeps range, circles its foe, attacks and casts. */
  drive(p, bot, dt) {
    const g = this.game;
    const inp = { h: 0, p: [], mx: p.x, my: p.y, ml: 0, mr: 0, lp: 0, rp: 0 };
    const target = this.targetFor(p);
    const d = g.dungeon;
    let vx = d.center.x - p.x;
    let vy = d.center.y + 40 - p.y;
    if (target) {
      inp.mx = target.x;
      inp.my = target.y;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dd = Math.hypot(dx, dy) || 1;
      const want = SHOWCASE_RANGE[p.classId] || 120;
      const toward = dd > want + 30 ? 1 : dd < want - 30 ? -0.8 : 0;
      bot.strafeAt -= dt;
      if (bot.strafeAt <= 0) { bot.strafe = -bot.strafe; bot.strafeAt = 1.6 + Math.random() * 1.6; }
      vx = (dx / dd) * toward - (dy / dd) * bot.strafe * 0.7;
      vy = (dy / dd) * toward + (dx / dd) * bot.strafe * 0.7;
      // stay near the scene's anchor (in the arena, its right side: the camera can't follow
      // further left than the wall, and the menu covers the left of the screen), and off the walls
      const { anchor, bounds } = this.arena;
      const ax = anchor.x - p.x;
      const ay = anchor.y - p.y;
      const far = Math.hypot(ax, ay);
      if (far > 140) {
        const pull = Math.min(1.5, (far - 140) / 80);
        vx += (ax / far) * pull;
        vy += (ay / far) * pull;
      }
      const T = d.T;
      if (p.y < bounds.top + T) vy += 1;
      if (p.y > bounds.bottom - T) vy -= 1;
      if (p.x < bounds.left + T) vx += 1;
      if (p.x > bounds.right - T) vx -= 1;
      inp.ml = 1;
      // a click now and then answers any "pick a spot" ability with the foe's position
      inp.lp = Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4) ? 1 : 0;
      bot.nextAbility -= dt;
      if (bot.nextAbility <= 0) {
        bot.nextAbility = 1.3 + Math.random() * 1.4;
        inp.p.push(p.cooldowns.e <= 0 ? 'e' : 'f');
      }
      bot.nextSecondary -= dt;
      if (bot.nextSecondary <= 0) {
        bot.nextSecondary = 2.5 + Math.random() * 2;
        if (p.classId === 'warrior') bot.guardUntil = this.time + 0.9;
        else inp.rp = 1;
      }
      if (this.time < bot.guardUntil) inp.mr = 1;
      bot.nextDodge -= dt;
      if (bot.nextDodge <= 0 && dd < 90) {
        bot.nextDodge = 3 + Math.random() * 3;
        inp.p.push('dodge');
      }
      // one big moment per scene: the ultimate
      if (!bot.ulted && this.time >= bot.ultAt) {
        bot.ulted = true;
        p.ult = p.ultMax;
        inp.p.push('ult');
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0.2) {
      if (vx / len < -0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('left');
      if (vx / len > 0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('right');
      if (vy / len < -0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('up');
      if (vy / len > 0.38) inp.h |= 1 << HELD_ACTIONS.indexOf('down');
    }
    return inp;
  },

  /**
   * Where a scene is fought: the play area's bounds, where the heroes start and are kept
   * (anchor), and where its boss stands. The graveyard arena keeps the heroes right of
   * centre, clear of the menu; a castle boss room puts them before its boss (each boss
   * where its own fight opens: the King on his throne, the Princess at her desk...).
   */
  arenaFor(g, s) {
    const d = g.dungeon;
    const T = d.T;
    if (!g.run) {
      const anchor = { x: d.width - CONFIG.screen.width / 2 + 120, y: d.center.y + 40 };
      return {
        bounds: { left: 2 * T, top: 5 * T, right: d.width - 2 * T, bottom: d.height - 2 * T },
        anchor, bossAt: d.center,
        heroes: s.boss ? { x: d.center.x + 120, y: d.playerStart.y - 40 } : anchor,
      };
    }
    const r = d.bossRoom;
    const bounds = { left: (r.x0 + 1) * T, top: (r.y0 + 1) * T, right: r.x1 * T, bottom: r.y1 * T };
    const bossAt = {
      queen: { x: r.cx, y: r.cy + 3.5 * T },
      king: { x: r.cx, y: (r.y0 + 5) * T - 30 },
      princess: { x: r.cx, y: (r.y0 + 4) * T - 6 },
      prince: { x: r.cx, y: r.cy },
    }[s.boss] || { x: r.cx, y: r.cy };
    const heroes = s.boss ? { x: bossAt.x + 90, y: Math.min(bounds.bottom - T, bossAt.y + 4 * T) } : { x: r.cx + 60, y: r.cy + T };
    return { bounds, anchor: heroes, bossAt, heroes };
  },

  /** The boss, or the nearest risen enemy. */
  targetFor(p) {
    const g = this.game;
    if (g.boss && !g.boss.dead) return { x: g.boss.hx ?? g.boss.x, y: g.boss.hy ?? g.boss.y };
    let best = null;
    let bestD = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.age < 0.3) continue;
      const dd = dist(p.x, p.y, e.x, e.y);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    return best ? { x: best.hx, y: best.hy } : null;
  },

  /** Frames the fight a little right of centre, clear of the menu down the left side. */
  frame(g, dt) {
    let x = 0;
    let y = 0;
    for (const p of g.players) { x += p.x; y += p.y; }
    x /= g.players.length;
    y /= g.players.length;
    if (g.boss) { x = (x + g.boss.x) / 2; y = (y + g.boss.y) / 2; }
    const goal = { x: x - 150, y: y - 30 };
    if (!this.view) this.view = goal;
    const k = 1 - Math.pow(0.02, dt);
    this.view.x = lerp(this.view.x, goal.x, k);
    this.view.y = lerp(this.view.y, goal.y, k);
    const c = g.camera;
    c.x = clamp(this.view.x - c.width / 2, 0, Math.max(0, g.dungeon.width - c.width));
    c.y = clamp(this.view.y - c.height / 2, 0, Math.max(0, g.dungeon.height - c.height));
  },

  render(ctx) {
    this.game.render(ctx);
    // fade through black between scenes
    const fade = Math.max(0, 1 - this.time / this.fadeTime, 1 - (this.length - this.time) / this.fadeTime);
    if (fade > 0) {
      ctx.fillStyle = `rgba(8, 5, 14, ${Math.min(1, fade)})`;
      ctx.fillRect(0, 0, CONFIG.screen.width, CONFIG.screen.height);
    }
  },

  /** The dots in the corner of the menu: which of the scenes is playing (click one to jump to it). */
  showTitle() {
    const dots = document.getElementById('menu-scene-dots');
    if (!dots) return;
    dots.innerHTML = SHOWCASE_SCENES.map((_, i) => `<i data-scene="${i}" class="${i === this.scene ? 'on' : ''}"></i>`).join('');
  },

  /**
   * Clicking the fight (anywhere on the menu screen but its buttons and panel) cuts to the
   * next scene; clicking a dot jumps to that scene. Hooked up once, on the first scene.
   */
  wire() {
    if (this.wired) return;
    const screen = document.getElementById('screen-menu');
    if (!screen) return;
    this.wired = true;
    screen.addEventListener('click', (e) => {
      if (!this.game) return;
      const dot = e.target.closest('[data-scene]');
      if (dot) { this.start(Number(dot.dataset.scene)); Sound.play('uiClick'); return; }
      if (e.target.closest('.menu-panel, button, a, input')) return;
      this.start();
      Sound.play('uiClick');
    });
  },
};
