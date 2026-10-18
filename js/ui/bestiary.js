// The bestiary book on the lobby lectern: every enemy of a dungeon theme,
// two to a spread. Pages flip with the arrows (or A / D, or your movement
// keys), and the entries can be filtered by stage and role.
// Stats shown are stage 1 values; later stages scale them up.

const BESTIARY = {
  graveyard: [
    { type: 'zombie', name: 'Zombie', role: 'melee', desc: 'A slow shambler. Telegraphs a wide claw swipe before it lands.' },
    { type: 'bletcher', name: 'Bletching Zombie', role: 'ranged', desc: 'Barely moves. Lobs slow globs of spit that poison you for a few seconds.' },
    { type: 'skeleton', name: 'Skeleton Archer', role: 'ranged', desc: 'Keeps its distance and fires fast arrows. A red line shows its aim before it shoots.' },
    { type: 'skeletonWarrior', name: 'Skeleton Warrior', role: 'melee', desc: 'Its shield blocks the first hit it takes. After that it is just a skeleton with a sword.' },
    { type: 'bomber', name: 'Skeleton Bomber', role: 'special', desc: 'Runs at you and lights its fuse up close. Killing it drops the bomb, which still goes off.' },
    { type: 'wraith', name: 'Phantom', role: 'melee', desc: 'Floats fast, then dashes straight at you along a red lane. Step out of the lane.' },
    { type: 'undeadKnight', name: 'Zombie Knight', role: 'melee', desc: 'Extremely slow and tanky, but its huge swings deal massive damage.' },
    { type: 'gravestone', name: 'Tombstone', role: 'summoner', desc: 'Raises undead beside it until it is destroyed, then releases ghosts.' },
    { type: 'ghost', name: 'Ghost', role: 'special', from: 1, note: 'FROM TOMBSTONES', desc: 'Rises from broken tombstones. Only hurts by touch, but its icy aura slows you.' },
    { type: 'candlehead', name: 'Candlehead', role: 'ranged', desc: 'A skeleton with a candle for a head. Its souls knock you far back.' },
    { type: 'shadowalker', name: 'Shadowalker', role: 'melee', desc: 'Stabs with a poison dagger. Every 5 seconds it teleports behind you and strikes.' },
    { type: 'necromancer', name: 'Necromancer', role: 'summoner', desc: 'Stays back, raising groups of zombies and skeletons while firing souls.' },
    { type: 'reaper', name: 'Reaper', role: 'melee', desc: 'Wide scythe swings and waves of darkness. Teleports next to you if you keep away.' },
    { type: 'minigunner', name: 'Skeleton Minigunner', role: 'ranged', desc: 'A big skeleton with a minigun. Spins up, then sprays slow bullets that track you slowly.' },
    { type: 'zombieSoldier', name: 'Zombie Soldier', role: 'ranged', desc: 'Armoured: shrugs off 40% of all damage. Aims, then fires fast three-round bursts.' },
    { type: 'skeletonSorcerer', name: 'Skeleton Sorcerer', role: 'summoner', desc: 'Lines of bone hands burst from the ground and stun. Also summons exploding skulls.' },
    { type: 'flyingSkull', name: 'Flying Skull', role: 'special', from: 3, note: 'SUMMONED', desc: 'Summoned by skeleton sorcerers. Flies straight at you and explodes on contact.' },
    { boss: 'phantom', name: 'Phantom King', role: 'boss', from: 1, desc: 'Sovereign of the restless dead. Dashes, laser barrages, and pulling shockwaves. Gets stronger every stage.' },
  ],
};

// portrait scale per enemy (default 1.5) so the big ones still fit the page
const BESTIARY_SCALE = { undeadKnight: 1.15, minigunner: 1.05, gravestone: 1.4, reaper: 1.3, flyingSkull: 2.4, ghost: 1.3, wraith: 1.3 };

const BESTIARY_ROLES = ['all', 'melee', 'ranged', 'summoner', 'special', 'boss'];
const BESTIARY_STAGES = ['all', 1, 2, 3];

const Bestiary = {
  theme: 'graveyard',
  stage: 'all',
  role: 'all',
  spread: 0,          // which two-page spread is open
  previews: [],       // { canvas, entry } for the open spread
  flipping: false,

  /** First stage the enemy shows up in (from the theme's enemy lists unless the entry says). */
  firstStage(e) {
    if (e.from) return e.from;
    const pools = CONFIG.themes[this.theme].enemies;
    for (const s of [1, 2, 3]) if (pools[s].some(([t]) => t === e.type)) return s;
    return 1;
  },

  get entries() {
    return BESTIARY[this.theme].filter((e) =>
      (this.role === 'all' || e.role === this.role) && (this.stage === 'all' || this.firstStage(e) <= this.stage));
  },

  get spreads() { return Math.max(1, Math.ceil(this.entries.length / 2)); },

  open() {
    this.spread = 0;
    this.renderFilters();
    this.render();
    Menus.show('bestiary');
  },

  get isOpen() { return !document.getElementById('screen-bestiary').classList.contains('hidden'); },

  setFilter(kind, value) {
    if (kind === 'stage') this.stage = value === 'all' ? 'all' : Number(value);
    if (kind === 'role') this.role = value;
    this.spread = 0;
    this.renderFilters();
    this.render();
  },

  renderFilters() {
    const chip = (kind, value, label, on) => `<button class="chip${on ? ' on' : ''}" data-action="bestiaryFilter:${kind}:${value}">${label}</button>`;
    document.getElementById('bestiary-themes').innerHTML = Object.keys(BESTIARY)
      .map((id) => `<button class="chip on">${CONFIG.themes[id].name.toUpperCase()}</button>`).join('')
      + '<button class="chip locked" disabled>???</button><button class="chip locked" disabled>???</button>';
    document.getElementById('bestiary-stages').innerHTML = BESTIARY_STAGES
      .map((s) => chip('stage', s, s === 'all' ? 'ALL STAGES' : `STAGE ${s}`, this.stage === s)).join('');
    document.getElementById('bestiary-roles').innerHTML = BESTIARY_ROLES
      .map((r) => chip('role', r, r === 'all' ? 'ALL' : r.toUpperCase(), this.role === r)).join('');
  },

  /** Fills both pages of the current spread. */
  render() {
    const list = this.entries;
    this.spread = clamp(this.spread, 0, this.spreads - 1);
    this.previews = [];
    ['left', 'right'].forEach((side, i) => {
      const page = document.getElementById(`bestiary-${side}`);
      const e = list[this.spread * 2 + i];
      page.innerHTML = e ? this.entryHtml(e) : (i === 0 && !list.length ? '<p class="b-empty">No enemies match these filters.</p>' : '');
      const canvas = page.querySelector('canvas');
      if (canvas) {
        canvas.getContext('2d').imageSmoothingEnabled = false;
        this.previews.push({ canvas, entry: e });
      }
    });
    const n = list.length;
    document.getElementById('bestiary-count').textContent =
      n ? `PAGE ${this.spread + 1} / ${this.spreads}   (${n} ${n === 1 ? 'ENTRY' : 'ENTRIES'})` : 'NO ENTRIES';
    document.getElementById('bestiary-prev').disabled = this.spread <= 0;
    document.getElementById('bestiary-next').disabled = this.spread >= this.spreads - 1;
  },

  entryHtml(e) {
    const first = this.firstStage(e);
    const stageText = e.role === 'boss' ? 'ALL STAGES' : e.note ? `${e.note} - STAGE ${first}+` : first === 1 ? 'STAGES 1-3' : first === 3 ? 'STAGE 3 ONLY' : `STAGE ${first}+`;
    let stats;
    if (e.boss) {
      const c = CONFIG.phantom;
      stats = `HP ${c.hp} &nbsp; DMG ${c.dashDamage}`;
    } else {
      const c = CONFIG.enemies[e.type];
      stats = `HP ${c.hp} &nbsp; DMG ${c.damage} &nbsp; SPD ${c.speed}${c.armor ? ` &nbsp; ARMOR ${Math.round(c.armor * 100)}%` : ''}`;
    }
    const exclusive = first > 1 && e.role !== 'boss' && !e.note;
    return `
      <canvas width="112" height="104"></canvas>
      <h3>${e.name}</h3>
      <div class="b-tags"><span class="b-role ${e.role}">${e.role.toUpperCase()}</span><span class="b-stage${exclusive ? ' excl' : ''}">${stageText}</span></div>
      <div class="b-stats">${stats}</div>
      <p class="b-desc">${e.desc}</p>`;
  },

  /** Turns the page (dir +1 / -1) with a little flip animation. */
  flip(dir) {
    const next = this.spread + dir;
    if (this.flipping || next < 0 || next >= this.spreads) return;
    this.flipping = true;
    const book = document.getElementById('bestiary-book');
    book.classList.add(dir > 0 ? 'flip-next' : 'flip-prev');
    Sound.play('uiHover');
    setTimeout(() => {
      this.spread = next;
      this.render();
    }, 160);
    setTimeout(() => {
      book.classList.remove('flip-next', 'flip-prev');
      this.flipping = false;
    }, 330);
  },

  /**
   * Animated portraits on the open pages. Enemies are drawn by a stand-in
   * enemy's own draw() so weapons and gear (bows, scythes, guns, shields,
   * bombs) look exactly as in a fight; the boss uses its sprite.
   */
  drawPreviews(time) {
    if (!this.isOpen) return;
    for (const pv of this.previews) {
      const { canvas, entry } = pv;
      const ctx = canvas.getContext('2d');
      if (!entry.boss) {
        if (!pv.enemy) {
          pv.enemy = createEnemy(entry.type, 0, 0);
          pv.enemy.age = 5;    // fully faded in
        }
        const e = pv.enemy;
        e.animTime = time;
        e.moving = !!e.frames.walk;
        e.facing = 1;
        const s = BESTIARY_SCALE[entry.type] || 1.5;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(60, 40, 20, 0.25)';
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, canvas.height - 8, 26, 5, 0, 0, TAU);
        ctx.fill();
        ctx.translate(canvas.width / 2, canvas.height - 10);
        ctx.scale(s, s);
        e.draw(ctx);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        continue;
      }
      const frames = Sprites.phantom;
      const list = frames.walk || frames.idle;
      const frame = list[Math.floor(time * (frames.walk ? 8 : 4)) % list.length].img;
      const s = Math.min(3, Math.floor(Math.min(canvas.width / frame.width, canvas.height / frame.height) * 4) / 4);
      const w = frame.width * s;
      const h = frame.height * s;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(60, 40, 20, 0.25)';
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height - 8, Math.min(30, w * 0.3), 5, 0, 0, TAU);
      ctx.fill();
      ctx.drawImage(frame, Math.round((canvas.width - w) / 2), Math.round(canvas.height - h), w, h);
    }
  },
};
