// Cheat console, for testing: press ` (the key left of 1) to open it, type a cheat, Enter.
// Up / Down go through the cheats typed before; Esc, ` or its X button closes it. Single player
// pauses while it's open.
//
//   gems [n]          n gems on this profile (default 1000)
//   coins [n]         n coins for your hero, in a run (default 500)
//   revive            every hero back up at full health, even after the party wiped
//   kill              kills every enemy in your room (the boss too)
//   clear             kills them and finishes the room: no more waves, timers run out
//   upgrade [name]    a random upgrade you don't have yet, one by name or id, or "all"
//   upgrades          lists the upgrades your hero can get
//
// Gems are this machine's own profile. The rest change the shared world, so they go
// through App.command like any other gameplay command (in multiplayer, everyone's
// machine applies them on the same tick).

const CHEAT_HELP = [
  'gems [n]  -  add gems to this profile (1000)',
  'coins [n]  -  add coins in a run (500)',
  'revive  -  everyone up at full health, even after a wipe',
  'kill  -  kill every enemy in your room',
  'clear  -  kill them and finish the room',
  'upgrade [name | all]  -  a random upgrade, a named one, or all',
  'upgrades  -  list the upgrades you can get',
];

const Cheats = {
  isOpen: false,
  history: [],
  historyAt: 0,

  init(app) {
    this.app = app;
    this.el = document.getElementById('cheat-console');
    this.input = document.getElementById('cheat-input');
    this.logEl = document.getElementById('cheat-log');
    // caught first (capture), wherever the focus is: ` opens it, and while it's open Esc or ` close it
    // (and never reach the game, where Esc would pause)
    window.addEventListener('keydown', (e) => {
      if (this.isOpen) {
        if (e.code !== 'Escape' && e.code !== 'Backquote') return;
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.code !== 'Backquote') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      e.preventDefault();   // so the ` isn't typed into the box
      this.open();
    }, true);
    document.getElementById('cheat-close').addEventListener('click', () => this.close());
    // clicking anywhere on the console puts the cursor back in the box
    this.el.addEventListener('mousedown', (e) => {
      if (e.target !== this.input && e.target.id !== 'cheat-close') setTimeout(() => this.input.focus(), 0);
    });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();   // the game never sees what's typed here
      if (e.code === 'Enter') {
        const text = this.input.value.trim();
        this.input.value = '';
        if (!text) return;
        this.history.push(text);
        this.historyAt = this.history.length;
        this.run(text);
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        this.historyAt = clamp(this.historyAt + (e.code === 'ArrowUp' ? -1 : 1), 0, this.history.length);
        this.input.value = this.history[this.historyAt] || '';
      }
    });
  },

  open() {
    const app = this.app;
    this.isOpen = true;
    if (app.state === 'playing') app.state = 'cheats';   // single player pauses (multiplayer keeps going)
    Input.reset();
    Input.unlockPointer();
    this.el.classList.remove('hidden');
    if (!this.logEl.childElementCount) this.print('Type "help" for the cheats.', 'muted');
    setTimeout(() => this.input.focus(), 0);
  },

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.input.blur();
    if (this.app.state === 'cheats') this.app.state = 'playing';
    Input.reset();
  },

  /** A line in the console's log (kind: 'muted' | 'ok' | 'bad'). */
  print(text, kind = '') {
    const line = document.createElement('div');
    line.textContent = text;
    if (kind) line.className = kind;
    this.logEl.appendChild(line);
    while (this.logEl.childElementCount > 40) this.logEl.firstChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  },

  /** A typed cheat. */
  run(text) {
    const [name, ...rest] = text.toLowerCase().split(/\s+/);
    const arg = rest.join(' ');
    const g = this.app.game;
    const hero = g?.localPlayer;
    const inRun = !!g?.run;
    const amount = (def) => {
      const n = Math.floor(Number(arg || def));
      return n > 0 ? Math.min(n, 1e7) : 0;
    };
    this.print(`> ${text}`, 'muted');
    switch (name) {
      case 'help':
      case '?':
        for (const l of CHEAT_HELP) this.print(l);
        return;
      case 'gems': {
        const n = amount(1000);
        if (!n) return this.print('Usage: gems 1000', 'bad');
        if (!Profiles.current) return this.print('No profile is playing', 'bad');
        Profiles.addGems(n);
        this.print(`+${n} gems (now ${Profiles.gems})`, 'ok');
        Sound.play('coin');
        return;
      }
      case 'coins': {
        const n = amount(500);
        if (!n) return this.print('Usage: coins 500', 'bad');
        if (!inRun) return this.print('Coins only work in a dungeon run', 'bad');
        return this.send({ cheat: 'coins', n });
      }
      case 'revive':
        if (!g || g.lobby) return this.print('Only in a game', 'bad');
        return this.send({ cheat: 'revive' });
      case 'kill':
      case 'clear':
        if (!g || g.lobby) return this.print('Only in a game', 'bad');
        return this.send({ cheat: name });
      case 'upgrade':
        if (!inRun) return this.print('Upgrades only work in a dungeon run', 'bad');
        return this.send({ cheat: 'upgrade', name: arg });
      case 'upgrades': {
        if (!hero) return this.print('No hero', 'bad');
        const pool = shopStock(hero);
        this.print(pool.map((u) => `${u.id}${hero.upgradeLevels?.[u.id] ? '*' : ''}`).join(', '));
        this.print('(* = you have it)', 'muted');
        return;
      }
    }
    this.print(`Unknown cheat "${name}". Type "help".`, 'bad');
  },

  send(cmd) {
    this.app.command({ type: 'cheat', ...cmd });
    // a multiplayer command lands a tick or so later: its result is printed when it does
    if (this.app.mp) this.print('Sent', 'muted');
  },

  // ---------- applied on the world (every machine, on the same tick) ----------

  apply(w, cmd, hero) {
    const say = (text, kind = 'ok') => { if (hero === w.localPlayer) this.print(text, kind); };
    switch (cmd.cheat) {
      case 'coins': {
        if (!w.run) return;
        const n = Math.max(0, Math.floor(cmd.n) || 0);
        w.run.addCoins(n, hero);
        w.effects.text(hero.hx, hero.hy - 40, `+${n} COINS`, { color: '#ffd34a', size: 9, life: 1.2 });
        Sound.play('coin');
        return say(`+${n} coins (now ${hero.coins})`);
      }
      case 'revive':
        return say(this.revive(w));
      case 'kill':
      case 'clear':
        return say(this.kill(w, hero, cmd.cheat === 'clear'));
      case 'upgrade': {
        const out = this.upgrade(w, hero, cmd.name || '');
        return say(out.text, out.ok ? 'ok' : 'bad');
      }
    }
  },

  /** Every downed hero up at full health (the living ones healed); a party wipe is undone. */
  revive(w) {
    let up = 0;
    for (const p of w.players) {
      if (p.dead) { p.revive(1, w); up++; }
      else p.hp = p.maxHp;
    }
    if (w.wiped) {
      w.wiped = false;
      w.finished = false;
      Music.play(w.lobby ? 'lobby' : 'battle');
      w.events.onRevived?.();
    }
    return up ? `Revived ${up} hero${up > 1 ? 'es' : ''}` : 'Everyone healed to full';
  },

  /**
   * Kills every enemy in the hero's room (the locked room, or wherever they stand), the boss
   * too, and again once any still being summoned appear. clear also finishes the room's objective.
   */
  kill(w, hero, clear) {
    const run = w.run;
    const f = run?.floor;
    const room = run && (run.active || f.roomAt(hero.x, hero.y));
    const here = (e) => !room || f.roomAt(e.x, e.y) === room;
    let n = 0;
    const sweep = () => {
      for (const e of w.enemies) {
        if (e.dead || !here(e)) continue;
        e.lastHitBy = hero;
        e.hp = 0;
        e.die(w);
        n++;
      }
      const b = w.boss;
      if (b && !b.dead && !(b.dying > 0) && here(b)) {
        b.intro = 0;
        if (b instanceof Golem) {
          // the golem falls when its body breaks
          b.body.hp = 0;
          b.body.dead = true;
          b.onPartDestroyed(b.body, w);
        } else {
          b.hp = 0;
          b.die(w);
        }
        n++;
      }
    };
    sweep();
    if (w.pendingSpawns > 0) w.after(CONFIG.spawnTelegraph + 0.05, sweep);
    if (clear && run?.active) {
      const r = run.active;
      if (r.type === 'combat') r.wave = r.waves;
      if (r.type === 'survival' || r.type === 'defend') r.timeLeft = 0;
      if (r.type === 'defend') r.retry = 0;
    }
    return `Killed ${n} enem${n === 1 ? 'y' : 'ies'}${clear && run?.active ? ', room cleared' : ''}`;
  },

  /**
   * name '': a random upgrade the hero doesn't have; 'all': every one; otherwise the one whose
   * id or name matches (spaces and case don't matter, part of it will do).
   */
  upgrade(w, hero, name) {
    if (!w.run) return { ok: false, text: 'Not in a run' };
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const stock = shopStock(hero);
    const pool = stock.filter((u) => !hero.upgradeLevels[u.id]);
    let list;
    if (!name) list = pool.length ? [choose(pool)] : [];
    else if (name === 'all') list = pool;
    else {
      const key = norm(name);
      const u = stock.find((x) => norm(x.id) === key || norm(x.name) === key)
        || stock.find((x) => norm(x.id).includes(key) || norm(x.name).includes(key));
      if (!u) return { ok: false, text: `No upgrade "${name}" for this hero (try "upgrades")` };
      if (hero.upgradeLevels[u.id]) return { ok: false, text: `You already have ${u.name}` };
      list = [u];
    }
    if (!list.length) return { ok: false, text: 'You have every upgrade' };
    for (const u of list) w.run.grantUpgrade(hero, u);
    return { ok: true, text: list.length > 1 ? `+${list.length} upgrades` : `+${list[0].name}` };
  },
};
