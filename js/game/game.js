// One run of the game (or the lobby between runs): owns the world state,
// updates and renders it. Entities receive this object as `world`.
//
// There can be several heroes (multiplayer). Simulation code must only ever
// use `players` / `heroes` (or the hero acting right now, `actor`); `player`
// and `localPlayer` are the hero on THIS screen and are for the camera, HUD
// and menus only. In multiplayer every machine runs the same simulation from
// the same inputs (see Session), so the simulation must not depend on which
// hero is local.

class Game {
  /**
   * classId: the hero for single player (ignored when opts.roster is given).
   * opts.practice: practice-range cheat options ({ infiniteMana,
   * infiniteEnergy, god }) or null for a normal run.
   * opts.lobby: true for the hub room (no waves; stations to walk up to).
   * opts.run: { mode: 'set' | 'random', theme } for a dungeon run (generated floors,
   *   3 stages); otherwise it's the test dungeon (the original wave arena).
   * opts.roster: [{ id, name, classId }] for multiplayer; opts.localId: which one is this screen.
   */
  constructor(classId, events, opts = {}) {
    this.events = events;          // { onGameOver(stats), onVictory(stats), onInteract(station, hero), onToast(text), onNpc(kind, run, hero), onGems(n) }
    this.camera = new Camera(CONFIG.screen.width, CONFIG.screen.height);
    this.effects = new Effects();
    this.timers = [];
    this.roster = opts.roster || [{ id: 'local', name: '', classId }];
    this.localId = opts.localId || this.roster[0].id;
    this.multiplayer = !!opts.roster;
    this.showcase = !!opts.showcase;   // the main menu's backdrop fights (no HUD or name tags)
    // each player's gem enhancements, { id: { classId: count } }: from their roster entry in
    // multiplayer, from the profile playing on this machine in single player
    this.enh = {};
    for (const r of this.roster) this.enh[r.id] = { ...(r.enh || {}) };
    if (!this.multiplayer && !this.showcase) this.enh[this.roster[0].id] = { ...(Profiles.current?.enhancements || {}) };
    this.players = [];
    // a run builds its own floors (FloorMap) and sets this.dungeon
    this.run = opts.run ? new DungeonRun(this, opts.run) : null;
    if (!this.run) this.dungeon = opts.lobby ? new CastleKeep() : new Dungeon({});
    const s = this.dungeon.playerStart;
    this.roster.forEach((r, i) => {
      const off = Game.spawnOffset(i);
      this.players.push(this.makeHero(r, r.classId, s.x + off.x, s.y + off.y));
    });
    this.enemies = [];
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.clones = [];
    this.barriers = [];            // Knight barrier shields; soak enemy projectiles while raised
    this.dots = [];
    this.hazards = [];
    this.boss = null;
    this.pendingSpawns = 0;
    this.pendingSummons = 0;       // summoned enemies still in their summoning circle (see summonRoom)
    this.time = 0;
    this.kills = 0;
    this.bannerData = null;
    this.cutscene = null;     // a boss entrance in progress (beginBossIntro)
    this.finished = false;
    this.mouseWorld = { x: 0, y: 0 };
    this.actor = null;             // the hero whose turn it is (their attacks, their input)
    this.director = new WaveDirector(this);
    this.practice = opts.practice ? { options: opts.practice, log: [], total: 0, respawn: 0 } : null;
    // practice cheats ({ god, infiniteMana, infiniteEnergy, noCooldowns }): the range's, or a boss arena's opened from it
    this.cheats = opts.cheats || opts.practice || null;
    this.dummies = [];
    this.readyCheck = null;        // multiplayer lobby: { ready: { id: bool } } while the host waits at the gate
    if (this.practice) {
      const c = this.dungeon.center;
      this.dummies.push(new TrainingDummy(c.x - 220, c.y + 40));
      this.banner('PRACTICE RANGE', 'Use the panel to spawn enemies and toggle cheats', 2.6);
    }
    this.lobby = opts.lobby ? new LobbyHub(this) : null;
    if (this.lobby) {
      // a dummy in the sparring ring out in the yard to try abilities on
      const T = CONFIG.tileSize;
      this.dummies.push(new TrainingDummy(36.5 * T, 24.8 * T));
      for (const t of this.lobby.targets) this.dummies.push(new TrainingTarget(t.x, t.y));
      if (opts.welcome) this.banner('THE LOBBY', 'Pick a hero, then head through the gate', 2.6);
    }
    if (this.run) this.run.start();
    this.camera.follow(this.player.x, this.player.y, 0, this.dungeon.width, this.dungeon.height, true);
    this.vignette = Game.buildVignette();
  }

  /** Heroes stand in a loose group: 4 per row. */
  static spawnOffset(i) {
    return { x: ((i % 4) - 1.5) * 30, y: Math.floor(i / 4) * 26 };
  }

  /** A hero for a roster entry, tagged with its network id and name. */
  makeHero(entry, classId, x, y) {
    const p = createHero(classId, x, y, this.enhancementsOf(entry.id, classId));
    p.netId = entry.id;
    p.name = entry.name;
    p.isBot = !!entry.bot;   // a player who dropped out mid-run, played by the AI (BotPilot)
    return p;
  }

  // ---------------------------------------------------------
  //  Heroes
  // ---------------------------------------------------------

  /** The hero on this screen (camera, HUD, menus). Never use it in simulation code. */
  get localPlayer() {
    return this.players.find((p) => p.netId === this.localId) || this.players[0];
  }

  /**
   * In single player there's only one hero, so `player` is it. While a boss
   * updates, it's the hero the boss is focused on (bosses were written for
   * one target). Everywhere else it's the local hero.
   */
  get player() { return this.bossFocus || this.localPlayer; }
  set player(p) { this.replaceHero(this.localPlayer, p); }

  /** How many gem enhancements player `id` has for hero `classId`. */
  enhancementsOf(id, classId) { return (this.enh[id] && this.enh[id][classId]) || 0; }

  replaceHero(old, p) {
    p.netId = old.netId;
    p.name = old.name;
    const i = this.players.indexOf(old);
    if (i >= 0) this.players[i] = p;
  }

  /** Living heroes, in roster order. */
  get heroes() { return this.players.filter((p) => !p.dead); }

  /** The nearest living hero to a point (or the first hero if all are down). */
  nearestHero(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.dead) continue;
      const d = dist(x, y, p.x, p.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best || this.players[0];
  }

  heroById(id) { return this.players.find((p) => p.netId === id) || null; }

  /** Enemy toughness / numbers grow with the party size. */
  get playerScale() {
    const m = CONFIG.multiplayer;
    const extra = Math.max(0, this.players.length - 1);
    return { hp: 1 + m.hpPerExtraPlayer * extra, count: 1 + m.countPerExtraPlayer * extra };
  }

  // ---------------------------------------------------------
  //  API used by entities
  // ---------------------------------------------------------

  /** Everything the heroes' attacks can hit. */
  getTargets() {
    const list = this.enemies.filter((e) => !e.dead && e.age > 0.15);
    if (this.boss) list.push(...this.boss.getTargets());
    list.push(...this.dummies);
    if (this.run) list.push(...this.run.targets());
    return list;
  }

  /**
   * Applies hero damage (with crits, numbers, knockback, sound). The damage
   * belongs to `source` (default: the acting hero) for its multipliers, ult
   * charge and kill credit. sound: null for silent ticks. fromUlt: damage from
   * an ultimate doesn't charge the ultimate. Returns the damage dealt (0 if none).
   */
  damageTarget(target, amount, { angle = 0, knockback = 0, sound = 'hit', noCrit = false, crit: forced = null, color = '#ffffff', fromUlt = false, source = null, fire = false, arrow = false } = {}) {
    const src = source || this.actor || this.players[0];
    // crit: true / false decides it up front (one roll shared by a whole attack, e.g. a rocket and its blast)
    let crit = forced ?? (!noCrit && Math.random() < (src.critChance ?? CONFIG.player.critChance));
    crit = Upgrades.forceCrit(src, target, crit, noCrit);   // First Encounter
    this.lastCrit = crit;   // (Piercing Crit reads it straight after)
    // a Bard-weakened target takes extra damage
    const weak = target.weakenUntil > this.time ? 1 + CONFIG.classes.bard.ult.weakenTaken : 1;
    const dmg = Math.max(1, Math.round(amount * weak * (crit ? src.critMultiplier ?? CONFIG.player.critMultiplier : 1) * src.damageMultiplier * src.buffDamage * src.upgradeDamage * (fire ? Upgrades.fireScale(src) : 1)));
    if (!target.takeDamage(dmg, this)) return 0;
    // a sleeping boss is jolted awake: it takes a moment to come round
    if (this.boss && this.boss.sleepUntil > this.time + CONFIG.classes.bard.lullaby.wake && this.boss.getTargets().includes(target)) {
      this.boss.sleepUntil = this.time + CONFIG.classes.bard.lullaby.wake;
      this.boss.wakeAt = this.time;
      this.effects.text(target.hx, target.hy - 40, 'WOKE UP', { color: '#c8b8ff', size: 9 });
    }
    target.lastHitBy = src;
    if (knockback) target.knockback(angle, knockback * (src.knockbackMultiplier || 1));
    if (crit) {
      // visual only (effects and the camera use the unshared random), so safe in multiplayer
      this.effects.crit(target.hx, target.hy, dmg, angle, dmg >= 120);
      if (src === this.localPlayer) this.shake(dmg >= 120 ? 4 : 2.5, 0.12);
      if (sound !== null) Sound.play('crit', 0.04);
    } else {
      this.effects.text(target.hx, target.hy - 22, `${dmg}`, { color, size: 8 });
      if (sound !== null) {
        this.effects.burst(target.hx, target.hy, { count: 4, colors: ['#ffffff', '#ffe0a0'], speed: [40, 120], life: [0.1, 0.25] });
        Sound.play(sound || 'hit', 0.04);
      }
    }
    if (this.players.includes(src)) Game.statsOf(src).damage += dmg;
    if (!fromUlt && !src.dead) src.gainUlt(dmg);
    src.onDamageDealt(target, dmg, this);
    Upgrades.onDealt(src, target, dmg, { crit, fire, arrow }, this);
    if (this.practice) {
      this.practice.log.push({ t: this.time, dmg });
      this.practice.total += dmg;
    }
    return dmg;
  }

  /** True if `t` is the boss or one of its hittable parts (the golem's fists...). */
  isBossTarget(t) {
    return !!this.boss && (t === this.boss || this.boss.getTargets().includes(t));
  }

  /**
   * Debuffs reach bosses too, all but plain stuns: a freeze locks a boss in ice (it can't
   * move or attack) for freezeTime x the freeze's length. Once it thaws it can't be frozen
   * again for freezeImmune seconds, so it can't be kept frozen forever.
   */
  freezeBoss(duration) {
    const b = this.boss;
    if (!b || b.intro > 0 || b.dying > 0 || b.thawImmuneUntil > this.time) return;
    const c = CONFIG.bossDebuffs;
    if (b.frozenUntil > this.time) return;
    b.frozenUntil = this.time + duration * c.freezeTime;
    b.thawImmuneUntil = b.frozenUntil + c.freezeImmune;
    this.effects.text(b.hx, b.hy - 60, 'FROZEN', { color: '#9ad0ff', size: 9 });
    this.effects.shards(b.x, b.y - 10, { count: 14, speed: [80, 200], life: 0.45, len: [8, 14], width: 5 });
    Sound.play('glass', 0.05);
  }

  /** Damage over time (bleed etc.), ticking twice a second; it belongs to the hero who applied it. */
  /** kind: 'burn' (flames lick up the target), 'bleed' (drips) or null. */
  addDot(target, dps, duration, color = '#ff6060', kind = null) {
    this.dots.push({ target, dps, t: duration, tick: 0.5, color, kind, source: this.actor });
  }

  updateDots(dt) {
    for (const d of this.dots) {
      d.t -= dt;
      d.tick -= dt;
      if (d.target.dead) { d.dead = true; continue; }
      this.dotFx(d, dt);
      if (d.tick <= 0) {
        d.tick += 0.5;
        this.damageTarget(d.target, d.dps * 0.5, { sound: null, noCrit: true, color: d.color, source: d.source, fire: d.kind === 'burn' });
        const colors = d.kind === 'burn' ? ['#ffd34a', '#ff8a1e', '#e0461e'] : [d.color, '#7a1010'];
        this.effects.burst(d.target.hx, d.target.hy, { count: d.kind === 'burn' ? 5 : 2, colors, speed: [10, 40], life: [0.2, 0.4], up: d.kind === 'burn' ? 40 : 0 });
      }
      if (d.t <= 0) d.dead = true;
    }
    removeDead(this.dots);
  }

  /** Ongoing look of a damage-over-time effect (visual randomness only). */
  dotFx(d, dt) {
    const t = d.target;
    const r = t.radius || 12;
    if (d.kind === 'burn') {
      // flame tongues licking up the body, embers floating off
      if (vrand(0, 1) < dt * 22) {
        this.effects.flames(t.hx + vrand(-r * 0.7, r * 0.7), t.hy + r * vrand(0.2, 0.9), { count: 1, height: vrand(18, 30), width: vrand(8, 12), life: vrand(0.3, 0.5) });
      }
      if (vrand(0, 1) < dt * 10) {
        this.effects.burst(t.hx + vrand(-r, r), t.hy - vrand(0, r), { count: 1, colors: ['#ffd34a', '#ff8a1e', '#fff6c8'], speed: [5, 20], life: [0.4, 0.7], up: 50, size: [1, 2] });
      }
    } else if (d.kind === 'bleed' && vrand(0, 1) < dt * 6) {
      this.effects.burst(t.hx + vrand(-r * 0.5, r * 0.5), t.hy, { count: 1, colors: ['#c43a44', '#6a1622'], speed: [0, 10], life: [0.3, 0.5], gravity: 300, drag: 0, size: [2, 2] });
    }
  }

  /** The heroes plus anything enemies may attack instead (clones, a defend room's lantern). */
  get allies() {
    const list = this.heroes;
    list.push(...this.clones.filter((c) => !c.dead));
    list.push(...this.barriers.filter((b) => b.ally && !b.dead));   // the Baker's oven: enemies can hit it
    if (this.run) list.push(...this.run.allies());
    return list;
  }

  /**
   * What an enemy should chase: the nearest ally it can see. Returns a
   * stand-in with dead = true when there is nothing to chase.
   */
  targetFor(enemy) {
    // defend rooms: a hero if spotted, otherwise the lantern
    if (this.run && this.run.totem && !this.run.totem.dead) return this.run.defendTarget(enemy);
    let best = null;
    let bestD = Infinity;
    const allies = this.allies;
    // a taunting ally (the Baker's oven) draws every enemy within its range to it first
    for (const a of allies) {
      if (!a.taunt) continue;
      const d = dist(enemy.x, enemy.y, a.x, a.y);
      if (d < a.taunt && d < bestD) { bestD = d; best = a; }
    }
    if (best) return best;
    for (const a of allies) {
      const d = dist(enemy.x, enemy.y, a.x, a.y);
      if (a.invisible && d > (a.detectRange ?? CONFIG.player.invisibleDetectRange)) continue;
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best) return best;
    const p = this.players[0];
    return { dead: true, x: p.x, y: p.y, hx: p.hx, hy: p.hy, radius: 0, hurt: () => false };
  }

  addEnemy(enemy) {
    this.scaleEnemy(enemy);
    this.enemies.push(enemy);
  }

  /**
   * Stage / wave and party-size toughness for a new enemy (addEnemy; the run's waiting first waves).
   * Every one of its damage numbers is first raised by CONFIG.enemyDamage.
   */
  scaleEnemy(enemy) {
    if (CONFIG.enemyDamage !== 1) enemy.cfg = scaleBossDamage(enemy.cfg, CONFIG.enemyDamage);
    const s = this.enemyScale;
    if (s.hp !== 1 || s.damage !== 1) {
      const cfg = enemy.cfg;
      enemy.cfg = { ...cfg, damage: Math.round(cfg.damage * s.damage) };
      if (cfg.contactDamage) enemy.cfg.contactDamage = Math.round(cfg.contactDamage * s.damage);
      enemy.maxHp = Math.round(enemy.maxHp * s.hp);
      enemy.hp = enemy.maxHp;
    }
    if (s.speed) enemy.speed *= s.speed;
  }

  /** Stage / wave scaling times party size (boss minions and the practice range don't scale with waves). */
  get enemyScale() {
    const party = this.playerScale.hp;
    if (this.run) return { hp: this.run.scale.hp * party, damage: this.run.scale.damage, speed: this.run.scale.speed };
    const d = this.director;
    if (this.practice) return { hp: 1, damage: 1 };
    if (d.state === 'boss' || d.waveIndex <= 0) return { hp: party, damage: 1 };
    const s = CONFIG.waveScaling;
    return { hp: (1 + s.hp * d.waveIndex) * party, damage: 1 + s.damage * d.waveIndex };
  }

  /** Shows a summoning circle, then spawns the enemy. setup(enemy), if given, runs once it appears. */
  spawnEnemy(type, x, y, setup = null) {
    if (x === undefined) {
      let pt;
      for (let i = 0; i < 30; i++) {
        pt = this.dungeon.randomFloorPoint(60);
        const near = this.nearestHero(pt.x, pt.y);
        if (dist(pt.x, pt.y, near.x, near.y) > 260) break;
      }
      x = pt.x;
      y = pt.y;
    }
    ({ x, y } = this.dungeon.freePoint(x, y, 16, 16));
    this.pendingSpawns++;
    const life = CONFIG.spawnTelegraph;
    this.effects.add(life, (ctx, t) => {
      const r = 22 * Math.min(1, t * 3);
      ctx.save();
      ctx.strokeStyle = `rgba(180, 90, 255, ${0.9 - t * 0.4})`;
      ctx.fillStyle = `rgba(120, 40, 200, ${0.25 + t * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, r, r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }, true);
    Sound.play('spawn', 0.1);
    this.after(life, () => {
      this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
      const enemy = createEnemy(type, x, y);
      this.addEnemy(enemy);
      if (setup) setup(enemy);
      this.effects.burst(x, y - 10, { count: 12, colors: ['#b45aff', '#6a28c8', '#e0c0ff'], speed: [30, 100], up: 60 });
    }).spawn = true;
  }

  /**
   * Summoners (gravestones, necromancers, skeleton sorcerers) share one cap: at
   * most CONFIG.summonCap summoned enemies alive or rising at once (more with a
   * bigger party). Each summoner can also only ever raise cfg.summonTotal in its
   * life. Returns how many more `owner` (or anyone, without one) can raise right now.
   */
  summonRoom(owner = null) {
    const alive = this.enemies.filter((e) => e.owner && !e.dead).length;
    const shared = Math.max(0, Math.round(CONFIG.summonCap * this.playerScale.count) - alive - this.pendingSummons);
    const total = owner?.cfg?.summonTotal;
    return total ? Math.max(0, Math.min(shared, total - (owner.summoned || 0))) : shared;
  }

  /** Counts a raised minion against its summoner's lifetime summonTotal. */
  countSummon(owner) {
    if (owner) owner.summoned = (owner.summoned || 0) + 1;
  }

  /** Raises an enemy for a summoner, counted against the summon cap until it dies. then(enemy) runs once it appears. */
  summon(owner, type, x, y, then = null) {
    this.countSummon(owner);
    this.pendingSummons++;
    this.spawnEnemy(type, x, y, (e) => {
      this.pendingSummons = Math.max(0, this.pendingSummons - 1);
      e.owner = owner;
      if (then) then(e);
    });
  }

  maybeDropHeart(x, y, chance = CONFIG.drops.heartChance) {
    if (Math.random() < chance) this.pickups.push(new HeartPickup(x, y));
  }

  /** Mana orbs only drop while someone in the party uses mana. */
  maybeDropMana(x, y) {
    if (!this.players.some((p) => p.resource && p.resource.name === 'MANA')) return;
    if (Math.random() >= CONFIG.drops.manaChance) return;
    this.pickups.push(new ManaPickup(x + rand(-8, 8), y + rand(-8, 8)));
  }

  /** The first barrier crossing the segment, or null (lasers and other hitscan shots). */
  barrierOnSegment(x1, y1, x2, y2) {
    return this.barriers.find((b) => !b.dead && b.crossesSegment(x1, y1, x2, y2)) || null;
  }

  /** The first barrier a projectile at (x, y) with radius r is touching, or null. */
  barrierAt(x, y, r) {
    return this.barriers.find((b) => !b.dead && b.touches(x, y, r)) || null;
  }

  /** Enemy bodies hurt heroes/clones they touch (not while airborne or fading in). */
  contactDamage() {
    for (const e of this.enemies) {
      if (e.dead || e.age < 0.3 || e.state === 'leap') continue;
      const damage = e.cfg.contactDamage ?? CONFIG.enemyContactDamage;
      if (damage <= 0) continue;
      this.weakenScale = Game.weakenOf(e, this);
      for (const a of this.allies) {
        if (a.contactImmune) continue;
        if (dist(e.x, e.y, a.x, a.y) < e.radius + a.radius) a.hurt(damage, this, e.x, e.y, { contact: true });
      }
    }
    this.weakenScale = 1;
  }

  /** Damage scale for whatever `e` dishes out: lower while a Bard's Screeching Tuning has it weakened. */
  static weakenOf(e, world) {
    return e && e.weakenUntil > world.time ? 1 - CONFIG.classes.bard.ult.weakenDamage : 1;
  }

  /** Expanding ground ring that damages heroes/clones once as it passes. */
  addShockwave(x, y, { radius, speed, width, damage, color = '255, 150, 60' }) {
    // a weakened enemy's shockwave hits softer (weakenScale is set while it acts)
    this.hazards.push({ x, y, r: 6, radius, speed, width, damage: damage * (this.weakenScale ?? 1), color, hit: new Set(), clip: { ...this.dungeon.floorBounds } });   // drawn only inside the room it's in
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      h.r += h.speed * dt;
      if (h.r >= h.radius) h.dead = true;
      for (const a of this.allies) {
        // measured on the same flattened ring that's drawn (0.7 as tall as it is wide)
        if (h.hit.has(a) || Math.abs(Math.hypot(a.x - h.x, (a.y - h.y) / 0.7) - h.r) > h.width) continue;
        if (a.hurt(h.damage, this, h.x, h.y, { shockwave: true })) h.hit.add(a);
      }
    }
    removeDead(this.hazards);
  }

  /**
   * Shockwaves: a dark rolling band of dust with a bright crest along its front edge
   * and debris kicked up as it passes, so it reads on any floor.
   */
  drawHazards(ctx) {
    for (const h of this.hazards) {
      const fade = 1 - h.r / h.radius;
      const ring = (dr, width, style) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, Math.max(1, h.r + dr), Math.max(1, (h.r + dr) * 0.7), 0, 0, TAU);
        ctx.stroke();
      };
      ctx.save();
      const b = h.clip;
      ctx.beginPath();
      ctx.rect(b.left, b.top - 40, b.right - b.left, b.bottom - b.top + 40);
      ctx.clip();
      ring(-h.width * 0.2, h.width * 1.3, `rgba(20, 14, 24, ${0.35 * fade + 0.1})`);   // shadowed trough behind the crest
      ring(0, h.width * 0.9, `rgba(${h.color}, ${0.45 + 0.4 * fade})`);
      ring(h.width * 0.35, 3, `rgba(255, 255, 255, ${0.5 + 0.5 * fade})`);           // the bright leading edge
      ring(h.width * 0.35 + 3, 2, OUTLINE);
      ctx.globalCompositeOperation = 'lighter';
      ring(0, h.width * 1.6, `rgba(${h.color}, ${0.18 * fade + 0.06})`);
      ctx.restore();
      // debris and sparks thrown up along the front (visual randomness only)
      if (vrand(0, 1) < 0.7) {
        const a = vrand(0, TAU);
        this.effects.burst(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.7, { count: 1, colors: [`rgb(${h.color})`, '#ffffff', '#5e5a6c'], speed: [20, 60], life: [0.2, 0.4], up: 50 });
      }
    }
  }

  after(seconds, fn) {
    const timer = { t: seconds, fn };
    this.timers.push(timer);
    return timer;
  }

  /** Camera shake. A hero's own attacks only shake their own screen; the world (bosses, blasts) shakes everyone's. */
  shake(magnitude, duration) {
    if (this.actor && this.actor !== this.localPlayer) return;
    this.camera.shake(magnitude, duration);
  }

  banner(text, sub = '', duration = 2.4) {
    this.bannerData = { text, sub, t: duration, maxT: duration };
  }

  /** type: 'golem' | 'phantom', or omitted to roll using CONFIG.bosses. */
  startBoss(type = Game.rollBoss()) {
    Music.play('boss');
    for (const p of this.heroes) p.heal(p.maxHp * CONFIG.bossHealPercent, this);
    this.boss = Game.createBoss(type, this.dungeon.center);
    this.boss.cfg = scaleBossDamage(this.boss.cfg, CONFIG.enemyDamage);
    this.boss.maxHp = Math.round(this.boss.maxHp * this.playerScale.hp);
    this.boss.hp = this.boss.maxHp;
    this.beginBossIntro();
  }

  /**
   * A boss's entrance, played as a cutscene: the heroes stand still while the camera
   * pans over to the boss, its entrance plays out, then its title card strikes across
   * the screen (HUD.drawBossCard). Only then does the fight start. subtitle: the card's
   * second line (the boss's title by default).
   */
  beginBossIntro(subtitle = null) {
    const b = this.boss;
    this.cutscene = { stage: 'pan', t: 0, subtitle: subtitle || b.title };
    if ('onReveal' in b) b.onReveal = () => Sound.play('bossRoar');
  }

  /** Steps the cutscene: pan (boss waits), intro (only its entrance runs), card (everyone waits). */
  updateCutscene(dt) {
    const cs = this.cutscene;
    const b = this.boss;
    const c = CONFIG.bossIntro;
    if (!b) { this.cutscene = null; return; }
    cs.t += dt;
    if (cs.stage === 'pan') {
      if ('time' in b) b.time += dt;
      if (cs.t >= c.pan) { cs.stage = 'intro'; cs.t = 0; }
    } else if (cs.stage === 'intro') {
      b.update(dt, this);
      if (!(b.intro > 0)) {
        cs.stage = 'card';
        cs.t = 0;
        Sound.play('swordDraw');
        Sound.play('impact');
        if (!('onReveal' in b)) Sound.play('bossRoar');
        this.shake(5, 0.3);
      }
    } else {
      if ('time' in b) b.time += dt;
      if (cs.t >= c.card) {
        this.cutscene = null;
        this.cameraEase = 0.7;   // the camera glides back to the heroes
      }
    }
  }

  static rollBoss() {
    const entries = Object.entries(CONFIG.bosses);
    let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [type, w] of entries) {
      if ((r -= w) < 0) return type;
    }
    return entries[0][0];
  }

  /** A hero's scoreboard numbers for this run (kills, damage dealt, healing done, damage taken, deaths). */
  static statsOf(p) {
    return p.stats || (p.stats = { kills: 0, damage: 0, healing: 0, taken: 0, deaths: 0 });
  }

  static createBoss(type, center) {
    if (type === 'phantom') return new PhantomKing(center.x, center.y);
    if (type === 'deathbringer') return new Deathbringer(center.x, center.y);
    if (type === 'queen') return new Queen(center.x, center.y);
    if (type === 'king') return new King(center.x, center.y);
    if (type === 'prince') return new RoyalPrince(center.x, center.y);
    if (type === 'princess') return new RoyalPrincess(center.x, center.y);
    return new Golem(center.x, center.y + 40);
  }

  onBossDefeated() {
    if (this.boss && this.players.includes(this.boss.lastHitBy)) Game.statsOf(this.boss.lastHitBy).kills++;
    if (this.run) return this.run.onBossDefeated();
    if (this.practice) {
      this.banner(`${this.boss.name} DEFEATED`, 'Spawn it again from the panel');
      return;
    }
    if (this.finished) return;
    this.finished = true;
    this.defeatText = this.boss.defeatText;
    Music.stop();
    this.after(2.5, () => {
      Sound.play('victory');
      this.events.onVictory(this.stats);
    });
  }

  /**
   * The boss keeps attacking one hero for a few seconds, then re-picks the
   * nearest living one, so a party splits its attention.
   */
  updateBossFocus(dt) {
    const b = this.boss;
    b.focusTimer = (b.focusTimer || 0) - dt;
    if (!b.focus || b.focus.dead || !this.players.includes(b.focus) || b.focusTimer <= 0) {
      b.focus = this.nearestHero(b.x, b.y);
      b.focusTimer = 4;
    }
  }

  // ---------------------------------------------------------
  //  Commands (hero picks, shopping, ready checks)
  //  In multiplayer these arrive inside the host's input bundles, so every
  //  machine applies them on the same tick.
  // ---------------------------------------------------------

  applyCommand(cmd, fromId) {
    const hero = this.heroById(fromId);
    switch (cmd.type) {
      case 'hero': {
        if (!this.lobby || !hero || hero.classId === cmd.classId) return;
        const taken = this.players.filter((p) => p.classId === cmd.classId).length;
        if (this.multiplayer && taken >= CONFIG.multiplayer.maxDuplicates) {
          if (fromId === this.localId) this.events.onToast?.(`ONLY ${CONFIG.multiplayer.maxDuplicates} OF EACH HERO`);
          return;
        }
        this.swapHero(cmd.classId, hero);
        return;
      }
      case 'enhance': {
        // a player bought an enhancement with their gems (in the lobby): they take it on now
        if (!this.lobby || !hero || !CONFIG.classes[cmd.classId]) return;
        const max = CONFIG.enhancements.filter((t) => !t.locked).length;
        this.enh[fromId] = { ...(this.enh[fromId] || {}), [cmd.classId]: clamp(Math.floor(cmd.count) || 0, 0, max) };
        if (hero.classId === cmd.classId) this.swapHero(cmd.classId, hero);
        return;
      }
      case 'buy':
        if (this.run && hero) this.run.buyUpgrade(hero, cmd.upgrade);
        return;
      case 'reroll':
        if (this.run && hero) this.run.rerollUpgrades(hero);
        return;
      case 'pickUpgrade':
        if (this.run && hero) this.run.pickUpgrade(hero, cmd.upgrade);
        return;
      case 'buyPotion':
        if (this.run && hero) this.run.buyPotion(hero, cmd.id);
        return;
      case 'moveItem':
        if (hero) hero.moveItem(cmd.from, cmd.to);
        return;
      case 'dropItem':
        if (hero) hero.dropItem(cmd.slot, this);
        return;
      case 'cheat':
        if (hero) Cheats.apply(this, cmd, hero);
        return;
      case 'readyCheck':
        if (this.lobby && fromId === this.roster[0].id && !this.readyCheck) {
          this.readyCheck = { ready: {} };
          for (const p of this.players) this.readyCheck.ready[p.netId] = p.netId === fromId;
        }
        return;
      case 'ready':
        if (this.readyCheck && hero) this.readyCheck.ready[fromId] = !!cmd.value;
        return;
      case 'cancelReady':
        if (fromId === this.roster[0].id) this.readyCheck = null;
        return;
      case 'leave':
        this.removeHero(cmd.id);
        return;
      case 'bot': {
        // a player dropped out mid-run: the AI plays on as their hero
        const p = this.heroById(cmd.id);
        if (!p || p.isBot) return;
        p.isBot = true;
        p.name = `${p.name} (AI)`;
        const r = this.roster.find((e) => e.id === cmd.id);
        if (r) r.name = p.name;
        this.effects.text(p.hx, p.hy - 40, 'AI TAKES OVER', { color: '#8ad8ff', size: 8, life: 1.6 });
        this.effects.burst(p.hx, p.hy, { count: 16, colors: ['#8ad8ff', '#ffffff'], speed: [30, 110], life: [0.3, 0.6], up: 40 });
        return;
      }
    }
  }

  get allReady() {
    return !!this.readyCheck && this.players.every((p) => this.readyCheck.ready[p.netId]);
  }

  /** A player left the game: their hero (and clones) vanish. */
  removeHero(id) {
    const p = this.heroById(id);
    if (!p) return;
    this.effects.burst(p.hx, p.hy, { count: 20, colors: ['#b45aff', '#e0c0ff'], speed: [30, 120], life: [0.3, 0.6], up: 40 });
    this.players.splice(this.players.indexOf(p), 1);
    this.roster = this.roster.filter((r) => r.id !== id);
    this.clones = this.clones.filter((c) => c.owner !== p);
    if (this.readyCheck) delete this.readyCheck.ready[id];
  }

  // ---------------------------------------------------------
  //  PRACTICE RANGE
  // ---------------------------------------------------------

  /** Lobby: a hero becomes another hero on the spot. */
  swapHero(classId, old = this.localPlayer) {
    const p = createHero(classId, old.x, old.y, this.enhancementsOf(old.netId, classId));
    this.replaceHero(old, p);
    this.clones = this.clones.filter((c) => c.owner !== old);
    this.barriers = this.barriers.filter((b) => b.owner !== old);
    this.effects.burst(old.hx, old.hy, { count: 30, colors: ['#ffe680', '#ffffff', '#b45aff'], speed: [40, 160], life: [0.3, 0.7], up: 40 });
    Sound.play('pickup');
  }

  /** Practice range: an enemy spawned on request (bosses are fought in their arenas, see openBossPortal). */
  practiceSpawn(type) {
    return this.spawnEnemy(type);
  }

  /**
   * Practice range: a portal to a boss's own room opens beside the hero. Walking into it
   * takes them to a small entrance room leading to that boss (see App.startBossPractice).
   */
  openBossPortal(boss) {
    const p = this.player;
    const pt = this.dungeon.freePoint(p.x + 90, p.y, 20, 14);
    this.practice.portal = { boss, x: pt.x, y: pt.y, t: 0, used: false };
    this.effects.burst(pt.x, pt.y - 20, { count: 30, colors: ['#b45aff', '#e0c0ff', '#ffffff'], speed: [40, 160], life: [0.3, 0.7] });
    Sound.play('phantomAppear');
    const name = { golem: 'THE CLAY GOLEM', phantom: 'THE PHANTOM KING', deathbringer: 'THE DEATHBRINGER', queen: 'THE QUEEN', king: 'THE KING', prince: 'THE PRINCE', princess: 'THE PRINCESS' }[boss] || boss.toUpperCase();
    this.banner('A PORTAL OPENS', `Step in to face ${name}`, 2.4);
  }

  /** The boss portal waits for the hero to step into it. */
  updateBossPortal(dt) {
    const P = this.practice.portal;
    if (!P || P.used) return;
    P.t += dt;
    const p = this.player;
    if (P.t > 0.4 && !p.dead && dist(p.x, p.y, P.x, P.y) < 26) {
      P.used = true;
      Sound.play('phantomVanish');
      this.events.onBossArena?.(P.boss);
    }
  }

  /** The boss portal: rings of violet light rippling out of a bright core, with its boss's name over it. */
  drawBossPortal(ctx) {
    const P = this.practice && this.practice.portal;
    if (!P) return;
    const { x, y } = P;
    const grow = Math.min(1, P.t / 0.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const r = ((P.t * 30 + i * 12) % 48) * grow;
      ctx.strokeStyle = `rgba(180, 90, 255, ${0.8 * (1 - r / 48)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(1, r), Math.max(1, r * 0.55), 0, 0, TAU);
      ctx.stroke();
    }
    PFX.glow(ctx, x, y, 40 * grow, '200, 140, 255', 0.8, 2, 24 * grow);
    ctx.restore();
    const name = { golem: 'CLAY GOLEM', phantom: 'PHANTOM KING', deathbringer: 'DEATHBRINGER', queen: 'THE QUEEN', king: 'THE KING', prince: 'THE PRINCE', princess: 'THE PRINCESS' }[P.boss] || P.boss.toUpperCase();
    HUD.text(ctx, `TO ${name}`, Math.round(x), Math.round(y - 50), { size: 7, align: 'center', color: '#e0c0ff' });
    HUD.text(ctx, 'STEP IN', Math.round(x), Math.round(y - 40), { size: 5, align: 'center', color: '#ffe680' });
  }

  clearEnemies() {
    this.enemies = [];
    this.boss = null;
    this.enemyProjectiles = [];
    this.hazards = [];
    this.timers = this.timers.filter((t) => !t.spawn); // cancel summons in progress
    this.pendingSpawns = 0;
    this.pendingSummons = 0;
  }

  resetDps() {
    this.practice.log = [];
    this.practice.total = 0;
    for (const d of this.dummies) d.hp = d.maxHp;
  }

  /** Damage per second over the last 5 seconds. */
  get dps() {
    const log = this.practice.log;
    if (!log.length) return 0;
    const span = Math.max(1, Math.min(5, this.time - log[0].t));
    return log.reduce((s, e) => s + e.dmg, 0) / span;
  }

  /** The practice cheats on the local hero: full mana / light / energy, and abilities and dodge always ready. */
  applyCheats() {
    const o = this.cheats;
    const p = this.player;
    // infinite mana also covers the Priestess's light orbs
    if (p.resource && ((p.resource.name !== 'ENERGY' && o.infiniteMana) || (p.resource.name === 'ENERGY' && o.infiniteEnergy))) {
      p.resource.value = p.resource.max;
    }
    // no cooldowns on RMB / E / F and the dodge (the basic attack keeps its own rate)
    if (o.noCooldowns) for (const k of ['secondary', 'e', 'f', 'dodge']) p.cooldowns[k] = Math.min(p.cooldowns[k], 0);
  }

  updatePractice(dt) {
    const pr = this.practice;
    const p = this.player;
    while (pr.log.length && pr.log[0].t < this.time - 5) pr.log.shift();
    for (const d of this.dummies) d.update(dt);
    this.updateBossPortal(dt);

    // no game over in practice: respawn instead
    if (p.dead && pr.respawn <= 0) {
      pr.respawn = 1.5;
      this.banner('DOWNED', 'Respawning...', 1.5);
    }
    if (pr.respawn > 0) {
      pr.respawn -= dt;
      if (pr.respawn <= 0) {
        const s = this.dungeon.playerStart;
        this.player = createHero(p.classId, s.x, s.y, this.enhancementsOf(p.netId, p.classId));
        this.clones = [];
        this.barriers = [];
      }
    }
  }

  get stats() {
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60).toString().padStart(2, '0');
    return {
      time: `${m}:${s}`, kills: this.kills, wave: this.director.waveNumber, defeatText: this.defeatText,
      stage: this.run ? this.run.stage : null, theme: this.run ? this.run.theme.name : null,
      gems: this.gemsEarned || 0, dungeon: !!this.run && !this.run.practiceBoss,
    };
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  /**
   * One step of the simulation. inputs: { heroId: input } in multiplayer
   * (each hero reads its own input through Input.override); omitted in
   * single player, where the one hero reads the keyboard and mouse directly.
   */
  update(dt, inputs = null) {
    this.time += dt;
    if (!inputs) this.mouseWorld = this.camera.screenToWorld(Input.mouse.x, Input.mouse.y);

    if (this.lobby) this.lobby.update(dt);
    for (const p of this.players.slice()) {
      if (inputs) {
        const inp = inputs[p.netId] || Session.idleInput;
        Input.override = Session.toOverride(inp);
        this.mouseWorld = { x: inp.mx, y: inp.my };
      }
      this.setActor(p);
      // stations / props get the interact key before the hero, so E there never casts an ability
      if (this.lobby) this.lobby.interact(p);
      if (this.run && !this.finished) this.run.preUpdate(p);
      this.updateRevive(p, dt);
      if (!p.dead && !this.cutscene) p.update(dt, this);   // the heroes wait out a boss's entrance
    }
    Input.override = null;
    this.decayRevives(dt);
    for (const c of this.clones) { this.setActor(c.owner); c.update(dt, this); }
    this.setActor(null);
    for (const b of this.barriers) b.update(dt, this);
    // while each enemy acts, weakenScale tones down the hits it lands and the shots it fires
    for (const e of this.enemies) {
      this.weakenScale = Projectile.enemyScale = Game.weakenOf(e, this);
      e.update(dt, this);
    }
    this.weakenScale = Projectile.enemyScale = 1;
    this.separateEnemies();
    this.contactDamage();
    if (this.boss) {
      this.updateBossFocus(dt);
      this.bossFocus = this.boss.focus;
      // the Bard's sleeping song can put a boss to sleep for a moment
      this.weakenScale = Projectile.enemyScale = Game.weakenOf(this.boss, this);
      if (this.boss.sleepMeter > 0 && this.boss.lullabyTick !== this.time) {
        this.boss.sleepMeter = Math.max(0, this.boss.sleepMeter - CONFIG.classes.bard.lullaby.meterDecay * dt);
      }
      // a frozen boss (ice) can't move or attack at all until it thaws
      const frozen = this.boss.frozenUntil > this.time;
      if (frozen) {
        this.boss.flashTime -= dt;
        if (vrand(0, 1) < dt * 12) {
          this.effects.burst(this.boss.hx + vrand(-30, 30), this.boss.hy + vrand(-30, 20), { count: 1, colors: ['#e6f6ff', '#9ad0ff'], speed: [5, 20], life: [0.4, 0.8], up: 20, size: [1, 3] });
        }
        if (this.boss.frozenUntil - this.time <= dt) {
          // it thaws: the ice shatters off it
          this.effects.shards(this.boss.x, this.boss.y - 20, { count: 20, speed: [100, 260], life: 0.5, len: [8, 16], width: 6 });
          Sound.play('glass', 0.05);
        }
      }
      if (this.cutscene) this.updateCutscene(dt);
      // pinned to a Knight's shield (Pinning Charge), it's held there, helpless
      else if (!(this.boss.sleepUntil > this.time) && !frozen && !(this.boss.pinnedUntil > this.time)) this.boss.update(dt, this);
      this.weakenScale = Projectile.enemyScale = 1;
      this.bossFocus = null;
      if (this.boss.dead) this.boss = null;
    }
    for (const p of this.playerProjectiles) { this.setActor(p.owner); p.update(dt, this); }
    this.setActor(null);
    for (const p of this.enemyProjectiles) p.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);

    for (const t of this.timers) {
      t.t -= dt;
      if (t.t <= 0) { t.dead = true; t.fn(); }
    }

    this.updateDots(dt);
    this.updateHazards(dt);
    if (this.cheats) this.applyCheats();
    if (this.practice) this.updatePractice(dt);
    else if (this.lobby) this.dummies.forEach((d) => d.update(dt));
    else if (this.run) { if (!this.finished) this.run.update(dt); }
    else if (!this.finished) this.director.update(dt);
    this.effects.update(dt);

    const dead = this.enemies.filter((e) => e.dead);
    if (this.run) for (const e of dead) this.run.onEnemyKilled(e);
    this.kills += dead.length;
    for (const e of dead) if (this.players.includes(e.lastHitBy) && !e.exploded) Game.statsOf(e.lastHitBy).kills++;
    for (const e of dead) {
      const killer = this.players.includes(e.lastHitBy) ? e.lastHitBy : this.players[0];
      killer.onKill(this, e);
    }
    // scoreboard: a hero going down counts as a death
    for (const p of this.players) {
      if (p.dead && !p.wasDown) Game.statsOf(p).deaths++;
      p.wasDown = p.dead;
    }
    removeDead(this.enemies);
    removeDead(this.clones);
    removeDead(this.barriers);
    removeDead(this.playerProjectiles);
    removeDead(this.enemyProjectiles);
    removeDead(this.pickups);
    removeDead(this.timers);

    if (this.bannerData) {
      this.bannerData.t -= dt;
      if (this.bannerData.t <= 0) this.bannerData = null;
    }

    // the camera follows this screen's hero (or a living teammate while they're down);
    // during a boss's entrance it pans over to the boss, then glides back
    if (this.cutscene && this.boss) {
      this.camera.follow(this.boss.x, this.boss.y - 50, dt, this.dungeon.width, this.dungeon.height, false, 0.03);
    } else {
      const view = this.cameraTarget;
      this.cameraEase = Math.max(0, (this.cameraEase || 0) - dt);
      this.camera.follow(view.x, view.y - 16, dt, this.dungeon.width, this.dungeon.height, false, this.cameraEase > 0 ? 0.01 : 0.0001);
    }
    if (this.cutscene && !this.boss) this.cutscene = null;

    if (!this.finished && !this.practice && this.players.every((p) => p.dead)) {
      this.finished = true;
      this.wiped = true;   // the revive cheat can undo this
      // a wiped dungeon run still pays gems for how far it got (each machine banks them on its own player's profile);
      // wiped again after a revive cheat, it only pays for the progress since
      if (this.run) {
        const earned = this.run.gemsForProgress();
        const more = earned - (this.gemsEarned || 0);
        this.gemsEarned = Math.max(earned, this.gemsEarned || 0);
        if (more > 0) this.events.onGems?.(more);
      }
      Music.stop();
      Sound.play('defeat');
      this.after(1.8, () => { if (this.wiped) this.events.onGameOver(this.stats); });
    }
  }

  /**
   * Multiplayer: a living hero holding interact by a downed teammate picks them
   * up after CONFIG.multiplayer.revive.time seconds (one helper at a time). The
   * press is used up here, so it never also casts the hero's E ability.
   * Runs while this hero's input is the active one.
   */
  updateRevive(p, dt) {
    p.reviveTarget = null;
    if (!this.multiplayer || p.dead || this.finished) return;
    const c = CONFIG.multiplayer.revive;
    let body = null;
    let bestD = c.range;
    for (const o of this.players) {
      if (!o.dead || o === p) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bestD) { bestD = d; body = o; }
    }
    p.reviveTarget = body;   // for the prompt over the body
    if (!body) return;
    // the Priestess's Resurrect: one press and they're up (once a stage)
    if (Input.pressed('interact') && Upgrades.canResurrect(p)) {
      Input.consume('interact');
      Upgrades.resurrect(p, body, this);
      return;
    }
    if (Input.pressed('interact')) Input.consume('interact');
    if (!Input.down('interact') || (body.revivedBy && body.revivedBy !== p)) return;
    body.revivedBy = p;
    body.reviveProgress += dt;
    if (body.reviveProgress >= c.time) body.revive(c.hp, this);
  }

  /** Revive progress drains from bodies nobody held interact by this tick. */
  decayRevives(dt) {
    for (const p of this.players) {
      if (p.dead && !p.revivedBy) p.reviveProgress = Math.max(0, p.reviveProgress - dt * CONFIG.multiplayer.revive.decay);
      p.revivedBy = null;
    }
  }

  /** Projectiles fired from here on belong to `hero` (for damage credit). */
  setActor(hero) {
    this.actor = hero;
    Projectile.actor = hero;
  }

  /** Who the camera watches: this screen's hero, or a living teammate while they're down. */
  get cameraTarget() {
    const me = this.localPlayer;
    if (!me.dead || !this.multiplayer) return me;
    return this.heroes[0] || me;
  }

  /** Stops enemies from stacking on top of each other. */
  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const min = (a.radius + b.radius) * 0.8;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= min || d === 0) continue;
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (a.state !== 'leap' && !a.immovable) this.dungeon.move(a, -nx * push, -ny * push);
        if (b.state !== 'leap' && !b.immovable) this.dungeon.move(b, nx * push, ny * push);
      }
    }
  }

  // ---------------------------------------------------------
  //  RENDER
  // ---------------------------------------------------------

  render(ctx) {
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(0, 0, CONFIG.screen.width, CONFIG.screen.height);

    ctx.save();
    this.camera.apply(ctx);
    this.dungeon.draw(ctx, this.camera);
    if (this.lobby) this.lobby.drawGround(ctx);
    if (this.practice) this.drawBossPortal(ctx);
    if (this.run) this.run.drawGround(ctx);
    this.effects.drawGround(ctx);
    this.drawHazards(ctx);

    // ground layer: shadows + telegraphs
    for (const p of this.pickups) p.draw(ctx);
    if (this.boss) this.boss.drawGround(ctx);
    for (const e of this.enemies) e.drawGround(ctx);
    for (const cl of this.clones) cl.drawGround(ctx);
    for (const d of this.dummies) d.drawGround(ctx);
    for (const p of this.players) if (p.dead && this.multiplayer) p.drawDowned(ctx, this.time);
    // aim previews (targeting rings, placement ghosts) are only drawn for this screen's hero
    for (const p of this.players) p.isLocal = !this.multiplayer || p === this.localPlayer;
    for (const p of this.heroes) p.drawGround(ctx);

    // y-sorted characters
    const items = this.enemies.map((e) => ({ y: e.y, draw: (c) => Game.drawEnemy(c, e) }));
    for (const p of this.heroes) items.push({ y: p.y, draw: (c) => p.draw(c) });
    for (const cl of this.clones) items.push({ y: cl.y, draw: (c) => cl.draw(c) });
    for (const d of this.dummies) items.push({ y: d.y, draw: (c) => d.draw(c) });
    for (const b of this.barriers) items.push({ y: b.y, draw: (c) => b.draw(c) });
    if (this.boss) items.push(...this.boss.getDrawables());
    if (this.lobby) items.push(...this.lobby.getDrawables());
    if (this.run) items.push(...this.run.getDrawables());
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw(ctx);
    // a gloomy theme's darkness and fog fall over the world; spells, effects and flames stay bright on top
    if (this.run) {
      this.run.drawLighting(ctx, this.camera);
      this.run.drawFog(ctx, this.camera);
    }

    for (const p of this.playerProjectiles) p.draw(ctx);
    for (const p of this.enemyProjectiles) p.draw(ctx);
    if (this.boss) this.boss.drawOverlay(ctx);
    if (this.boss && this.boss.frozenUntil > this.time) this.drawBossFrozen(ctx);
    this.effects.draw(ctx);
    if (this.boss && !this.cutscene) HUD.drawBossBars(ctx, this.boss);
    this.dungeon.drawTorches(ctx, this.time, this.camera);
    if (this.lobby) this.lobby.drawLighting(ctx, this.camera);   // night falls over the keep (under the prompts and names)
    if (this.lobby) this.lobby.drawPrompts(ctx);
    if (this.multiplayer && !this.showcase) this.drawNameTags(ctx);
    if (this.boss) this.drawBossSleep(ctx);
    this.effects.drawTexts(ctx);
    ctx.restore();

    if (this.run) ctx.globalAlpha = 0.55;   // a softer vignette in the dungeons
    ctx.drawImage(this.vignette, 0, 0);
    ctx.globalAlpha = 1;
    if (!this.showcase) HUD.draw(ctx, this);
  }

  /**
   * A frozen boss: locked in a block of ice sized to its body (lit facet on the left,
   * shaded on the right, a jagged top), a glint sweeping across it and icicles at its feet.
   */
  drawBossFrozen(ctx) {
    const b = this.boss;
    const left = b.frozenUntil - this.time;
    const a = Math.min(1, left * 3);
    const x = Math.round(b.x);
    const y = Math.round(b.y + 4);
    const h = Math.round(Math.max(60, (b.y - b.hy) * 2 + 16));
    const w = Math.round(Math.max(44, (b.hw || 12) * 2 + 24));
    const top = y - h;
    // the outline of the block: straight sides, a jagged crystal top
    const pts = [[x - w / 2, y], [x - w / 2, top + 14], [x - w / 4, top + 4], [x - 4, top + 12], [x + 6, top], [x + w / 4 + 2, top + 10], [x + w / 2, top + 6], [x + w / 2, y]];
    const shape = () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - h / 2, w, '140, 200, 255', 0.35, 2, h * 0.6);
    ctx.globalCompositeOperation = 'source-over';
    shape();
    ctx.fillStyle = 'rgba(150, 210, 255, 0.32)';
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    ctx.fillStyle = 'rgba(230, 246, 255, 0.22)';           // the lit facet
    ctx.fillRect(x - w / 2, top, w * 0.3, h);
    ctx.fillStyle = 'rgba(40, 90, 160, 0.25)';             // the shaded facet
    ctx.fillRect(x + w * 0.22, top, w * 0.3, h);
    const g = ((this.time * 0.7) % 1.6) - 0.3;             // a glint sweeping across
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + g * w, y);
    ctx.lineTo(x - w / 2 + g * w + 8, y);
    ctx.lineTo(x - w / 2 + g * w + 8 + h * 0.4, top);
    ctx.lineTo(x - w / 2 + g * w + h * 0.4, top);
    ctx.fill();
    ctx.restore();
    shape();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e6f6ff';
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const sx = x - w / 2 - 6 + (i * (w + 12)) / 4;
      PFX.shard(ctx, sx, y + 2, -Math.PI / 2 + (i - 2) * 0.3, 10 + (i % 2) * 5, 5, ICE_COLORS, 2);
    }
    ctx.restore();
  }

  /**
   * The Bard's lullaby on a boss: its sleep meter filling while it hears the
   * song, z's while it sleeps, a startled "!" when a hit wakes it.
   */
  drawBossSleep(ctx) {
    const b = this.boss;
    const x = Math.round(b.x);
    const y = Math.round(b.y - 120);
    const c = CONFIG.classes.bard.lullaby;
    if (b.sleepUntil > this.time) {
      if (b.wakeAt > this.time - c.wake) {
        HUD.text(ctx, '!', x, y - 4 - Math.max(0, Math.sin((this.time - b.wakeAt) * 12)) * 6, { size: 14, align: 'center', color: '#ffe680' });
        return;
      }
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 0.5 + i / 3) % 1;
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
        HUD.text(ctx, i === 2 ? 'Z' : 'z', Math.round(x + 8 + k * 20), Math.round(y - k * 26), { size: i === 2 ? 12 : 8, color: '#c8b8ff' });
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (!(b.sleepMeter > 0)) return;
    const k = clamp(b.sleepMeter / c.exposure, 0, 1);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 31, y - 1, 62, 6);
    ctx.fillStyle = '#2a2448';
    ctx.fillRect(x - 30, y, 60, 4);
    ctx.fillStyle = '#a898f0';
    ctx.fillRect(x - 30, y, Math.round(60 * k), 4);
    HUD.text(ctx, 'DROWSY', x, y - 12, { size: 7, align: 'center', color: '#c8b8ff' });
  }

  /** Multiplayer: every other hero's name and health over their head. */
  drawNameTags(ctx) {
    const me = this.localPlayer;
    const body = !me.dead && me.reviveTarget;
    if (body) {
      const helping = body.reviveProgress > 0;
      const text = helping ? `REVIVING ${body.name.toUpperCase()}... ${Math.floor((body.reviveProgress / CONFIG.multiplayer.revive.time) * 100)}%`
        : Upgrades.canResurrect(me) ? `[${Settings.label('interact')}] RESURRECT` : `HOLD [${Settings.label('interact')}] TO REVIVE`;
      HUD.text(ctx, text, Math.round(body.x), Math.round(body.y + 14), { size: 7, align: 'center', color: '#8cff9a' });
    }
    for (const p of this.players) {
      if (p === me) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y - 66);
      HUD.text(ctx, p.dead ? `${p.name} (DOWN)` : p.name, x, y, { size: 6, align: 'center', color: p.dead ? '#a99bbd' : '#8cff9a' });
      if (p.dead) continue;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 13, y + 9, 26, 4);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(x - 12, y + 10, Math.round(24 * clamp(p.hp / p.maxHp, 0, 1)), 2);
    }
  }

  /** An enemy (sprite, weapon, hp bar, stun stars) drawn CONFIG.enemyDrawScale smaller around its feet. */
  static drawEnemy(ctx, e) {
    const s = CONFIG.enemyDrawScale;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    // squashed flat under the Baker's giant cake, springing back up over its last 0.4s
    const flat = e.squash > 0 ? (e.squash > 0.4 ? 0.3 : 1 - 0.7 * (e.squash / 0.4)) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (2 - flat), s * flat);
    ctx.translate(-x, -y);
    e.draw(ctx);
    ctx.restore();
    Upgrades.drawEnemy(ctx, e);
  }

  static buildVignette() {
    const { width: w, height: h } = CONFIG.screen;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.65);
    g.addColorStop(0, 'rgba(8, 4, 16, 0)');
    g.addColorStop(1, 'rgba(8, 4, 16, 0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  }
}
