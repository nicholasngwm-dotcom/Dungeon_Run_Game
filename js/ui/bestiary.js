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
    { type: 'bomber', name: 'Skeleton Bomber', role: 'special', desc: 'Runs at you and lights its fuse up close. Killing it drops the bomb, which still goes off. The blast hurts other enemies too: lure it into a crowd.' },
    { type: 'wraith', name: 'Phantom', role: 'melee', desc: 'Floats fast, then dashes straight at you along a red lane. Step out of the lane.' },
    { type: 'undeadKnight', name: 'Zombie Knight', role: 'melee', desc: 'Extremely slow and tanky, but its huge swings deal massive damage.' },
    { type: 'gravestone', name: 'Tombstone', role: 'summoner', desc: 'Raises undead beside it until it is destroyed, then releases ghosts.' },
    { type: 'ghost', name: 'Ghost', role: 'special', from: 1, note: 'FROM TOMBSTONES', desc: 'Rises from broken tombstones. Only hurts by touch, but its icy aura slows you.' },
    { type: 'candlehead', name: 'Candlehead', role: 'ranged', desc: 'A skeleton with a candle for a head. Its souls knock you far back.' },
    { type: 'shadowalker', name: 'Shadowalker', role: 'melee', desc: 'Stabs with a poison dagger. Every 5 seconds it teleports behind you and strikes.' },
    { type: 'necromancer', name: 'Necromancer', role: 'summoner', desc: 'Stays back, raising groups of zombies and skeletons while firing souls.' },
    { type: 'reaper', name: 'Reaper', role: 'melee', desc: 'Wide scythe swings and waves of darkness. Teleports next to you if you keep away. Explodes into darkness when it dies: get clear!' },
    { type: 'minigunner', name: 'Skeleton Minigunner', role: 'ranged', desc: 'A big skeleton with a minigun. Spins up, then sprays slow bullets that track you slowly.' },
    { type: 'zombieSoldier', name: 'Zombie Soldier', role: 'ranged', desc: 'Light armour, easy to bring down, but it aims, then fires three-round bursts of heavy bullets. Get out of the line!' },
    { type: 'skeletonSorcerer', name: 'Skeleton Sorcerer', role: 'summoner', desc: 'Lines of bone hands burst from the ground and stun. Also summons exploding skulls.' },
    { type: 'flyingSkull', name: 'Flying Skull', role: 'special', from: 3, note: 'SUMMONED', desc: 'Summoned by skeleton sorcerers. Flies straight at you and explodes on contact.' },
    { boss: 'phantom', name: 'Phantom King', role: 'boss', from: 1, desc: 'Sovereign of the restless dead. Dashes, laser barrages, and pulling shockwaves. Gets stronger every stage.' },
    { boss: 'deathbringer', name: 'The Deathbringer', role: 'boss', from: 2, stage: 'STAGE 2 OR 3', desc: 'A faceless reaper of darkness rising from a portal. Its scythe slashes send waves of darkness across the room, its tendrils burst from the ground to slam it, and it blinks across the room every few seconds. At half health the room goes dark and its forked scythes spin on their own, throwing shadow bombs. Near death it vanishes, sends four reapers and hunts you as a shade.' },
  ],
  castle: [
    { type: 'squire', name: 'Squire', role: 'melee', desc: 'A young soldier of the fallen empire. Quick sword slashes behind a short red cone.' },
    { type: 'castleArcher', name: 'Castle Archer', role: 'ranged', desc: 'Keeps its distance and looses arrows. A red line shows its aim, then locks just before it fires.' },
    { type: 'minstrel', name: 'Minstrel', role: 'special', desc: 'Plays a war song: every enemy inside the crimson ring recovers faster between attacks (a red note bobs over them). Plinks notes at you. Kill it first.' },
    { type: 'gunner', name: 'Squire with a Gun', role: 'ranged', desc: 'Why not. Aims down a long red line, fires one heavy ball, then takes ages to reload: that is your moment.' },
    { type: 'catapult', name: 'Catapult', role: 'ranged', desc: 'Never moves. Winds back its arm and hurls a boulder that lands on the red circle. Close in and it cannot stop you.' },
    { type: 'maceSpinner', name: 'Mace Spinner', role: 'melee', desc: 'Up close it whirls both maces round, hurting everything near it again and again as it lurches after you. Then it reels, dizzy.' },
    { type: 'bishop', name: 'Bishop', role: 'special', desc: 'Never attacks. It hurries to the wounded and blesses the ground every few seconds, healing every enemy near it (bosses too). A gold ring shows a blessing gathering.' },
    { type: 'castleKnight', name: 'Knight', role: 'melee', desc: 'Blackened plate, sword and kite shield. When struck it may raise the shield: hits from the front glance off. Get round it.' },
    { type: 'cavalry', name: 'Cavalry', role: 'melee', desc: 'Two spear lunges along red lanes, then it rides you down, stabbing as it passes. Hard to stop once it gets going.' },
    { type: 'castleSorcerer', name: 'Castle Sorcerer', role: 'ranged', desc: 'Conjures bolts in patterns: a ring, a turning spiral, or a circle that closes in on you. Teleports away the first time it gets low.' },
    { type: 'executioner', name: 'Executioner', role: 'melee', desc: 'A huge axe chop down a red lane. Below a quarter health, a red skull marks you: if the axe lands, you are executed outright.' },
    { type: 'jester', name: 'Jester', role: 'melee', desc: 'Flips back or sidesteps out of half your hits. Two daggers in a flurry of slashes and a stab, and every cut makes you bleed.' },
    { type: 'flamingCatapult', name: 'Flaming Catapult', role: 'ranged', desc: 'Tougher than the plain one. Its burning boulders hit harder and leave fire on the ground that sets you alight.' },
    { type: 'royalGuard', name: 'Royal Guard', role: 'melee', desc: 'A stronger knight with a tower shield that blocks from the front. Also charges at you along a red lane.' },
    { type: 'general', name: 'Army General', role: 'special', desc: 'Once, he raises the empire\'s banner and calls the charge: everyone near him runs faster and gets a 20 hp shield. Then he runs you down glowing red, stabbing as he passes, and stops, out of breath, after each charge.' },
    { type: 'clusterCatapult', name: 'Cluster Catapult', role: 'ranged', desc: 'A plain catapult\'s health, but it flings a whole volley: five or six burning boulders rain down round you, each leaving fire behind. Find the gaps.' },
    { type: 'princeGuard', name: 'Prince\'s Guard', role: 'melee', from: 1, note: 'FROM THE PRINCE', desc: 'Whirls a flail round himself all the time, so keep clear. Stand back and he casts it at you down a line. Shoot at him and he plants his massive shield and blocks everything for a moment.' },
    { type: 'gardener', name: 'Gardener', role: 'ranged', from: 1, note: 'FROM THE QUEEN', desc: 'Comes through the rose gates each time the Queen\'s bell tolls. Sprays droplets of magic water from its watering can that bounce off walls once.' },
    { boss: 'princeBoss', name: 'The Prince', role: 'boss', from: 1, stage: 'STAGE 1 (OR THE PRINCESS)', desc: 'Rides into his training yard and leaps down to fight. Every attack is a medium-range dash and a flurry of cuts with a long stab (called out by a red lane), then he stops to catch his breath. At 45% health his trumpet calls two royal guards and his flail-wielding bodyguard; a beam of light joins them and he cannot be hurt until the bodyguard falls. His blade catches fire.' },
    { boss: 'princessBoss', name: 'The Princess', role: 'boss', from: 1, stage: 'STAGE 1 (OR THE PRINCE)', desc: 'Disturbed at her books, she opens with a potion. Long bursts of crossbow bolts, ice potions that freeze and fire potions that fling bouncing fireballs; she blinks away when you close in. At half health she conjures a magic bow: weaving golden arrows that spit bolts, a giant arrow from the sky that bursts in golden magic, and potions three at a time. Hide behind her shelves and tables.' },
    { boss: 'queen', name: 'The Queen', role: 'boss', from: 1, stage: 'STAGE 2', desc: 'Floats down under a magic umbrella and throws it to spin and spray magic, clockwise then anticlockwise. At half health she rings the bell: she runs you down, blinks to her umbrella in bursts of magic, guards behind it to heal, and the hedges shift.' },
    { boss: 'king', name: 'The King', role: 'boss', from: 1, stage: 'STAGE 3', desc: 'Smites shockwaves from his throne with his scepter, calls a royal guard, and throws the scepter where you would run. At half health he rises with four bishops and his greatsword.' },
  ],
};

// portrait scale per enemy (default 1.5) so the big ones still fit the page
const BESTIARY_SCALE = {
  undeadKnight: 1.15, minigunner: 1.05, gravestone: 1.4, reaper: 1.3, flyingSkull: 2.4, ghost: 1.3, wraith: 1.3,
  cavalry: 1.0, catapult: 1.2, flamingCatapult: 1.2, executioner: 1.05, royalGuard: 1.3,
};

const BESTIARY_ROLES = ['all', 'melee', 'ranged', 'summoner', 'special', 'boss'];
const BESTIARY_STAGES = ['all', 1, 2, 3];

// the turning page: hinged strips it bends along, and the page width they divide (CSS .book-page)
const LEAF_STRIPS = 8;
const LEAF_PAGE_W = 300;

/** Page numbers in the grimoire's old style. */
function romanNumeral(n) {
  let out = '';
  for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { out += s; n -= v; }
  return out;
}

const Bestiary = {
  theme: 'graveyard',
  stage: 'all',
  role: 'all',
  spread: 0,          // which two-page spread is open
  previews: [],       // { canvas, entry, index, enemy } for every portrait on show
  queue: 0,           // more pages to turn after the one falling now (quick presses, searches)
  found: null,        // entry index a search landed on (its name glows)

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
    this.queue = 0;
    this.found = null;
    const input = document.getElementById('bestiary-search');
    if (input) input.value = '';
    this.renderFilters();
    this.render();
    Menus.show('bestiary');
  },

  get isOpen() { return !document.getElementById('screen-bestiary').classList.contains('hidden'); },

  /** A dungeon bookmark: the book turns over to that dungeon's chapter (every filter back to ALL). */
  setTheme(id) {
    if (!BESTIARY[id] || id === this.theme) return;
    this.found = null;
    const oldList = this.entries;
    this.theme = id;
    this.stage = 'all';
    this.role = 'all';
    this.renderFilters();
    this.turnToNewList(0, oldList);
  },

  /** A bookmark was pulled: the book turns over from the pages on show to the first of the marked entries. */
  setFilter(kind, value) {
    this.found = null;
    const oldList = this.entries;
    this.applyFilter(kind, value);
    this.renderFilters();
    this.turnToNewList(0, oldList);
  },

  applyFilter(kind, value) {
    if (kind === 'stage') this.stage = value === 'all' ? 'all' : Number(value);
    if (kind === 'role') this.role = value;
  },

  /**
   * The entries just changed (bookmarks): rather than swapping the text in place,
   * a page turns over from what's showing now to spread `target` of the new list.
   * The pages on show must still hold the old list when this is called.
   */
  turnToNewList(target, oldList) {
    this.queue = 0;
    this.grab = null;
    this.oldList = oldList;
    // the pages on show belong to the old list now
    const stale = (id) => document.getElementById(id).innerHTML.replace(/data-entry="/g, 'data-old-entry="');
    const left = stale('bestiary-left');
    const right = stale('bestiary-right');
    this.dropLeaf(false);
    document.getElementById('bestiary-left').innerHTML = left.replace(/<i class="under-shade"><\/i>/, '');
    document.getElementById('bestiary-right').innerHTML = right.replace(/<i class="under-shade"><\/i>/, '');
    target = clamp(target, 0, this.spreads - 1);
    const dir = target < this.spread ? -1 : 1;
    const L = this.startLeaf(dir, {
      front: dir > 0 ? right : left,
      back: this.pageHtml(dir > 0 ? target * 2 : target * 2 + 1),
      under: this.pageHtml(dir > 0 ? target * 2 + 1 : target * 2),
      to: target,
    });
    L.target = 180;
    L.fast = true;
    L.v = 520;
    L.cv = -180;
    Sound.play('uiHover', 0.06);
  },

  renderFilters() {
    const mark = (kind, value, label, on, cls = '', tip = '') => `<button class="bookmark ${cls}${on ? ' on' : ''}" title="${tip}" data-action="bestiaryFilter:${kind}:${value}">${label}</button>`;
    // dungeon bookmarks: an emblem tab that slides out to show the dungeon's name when hovered
    const emblem = (type) => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      drawRoomIcon(c.getContext('2d'), type, 0, 0, 2);
      return c.toDataURL();
    };
    // the castle's: a gold crown set with a ruby
    const crown = () => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      const rows = ['........', 'X..X..X.', 'XX.XX.XX', 'XXXXXXXX', 'XXXrXXXX', 'XXXXXXXX', 'kkkkkkkk', '........'];
      const colors = { X: '#ecd690', r: '#ff5a6a', k: OUTLINE };
      rows.forEach((row, j) => [...row].forEach((ch, i) => { if (colors[ch]) { ctx.fillStyle = colors[ch]; ctx.fillRect(i * 2, j * 2 + 1, 2, 2); } }));
      return c.toDataURL();
    };
    this.emblems ??= { boss: emblem('boss'), puzzle: emblem('puzzle'), castle: crown() };
    const theme = (name, icon, on, locked, id = '') => `<button class="bookmark dungeon${on ? ' on' : ''}${locked ? ' locked' : ''}"${locked ? ' disabled' : ` data-action="bestiaryTheme:${id}"`}>`
      + `<img src="${icon}" alt=""><span>${name}</span></button>`;
    document.getElementById('bestiary-themes').innerHTML = Object.keys(BESTIARY)
      .map((id) => theme(CONFIG.themes[id].name.toUpperCase(), this.emblems[id] || this.emblems.boss, id === this.theme, false, id)).join('')
      + theme('UNDISCOVERED', this.emblems.puzzle, false, true);
    // stage ribbons read "STAGE I" / "STAGE II" ... so it's clear what they filter
    document.getElementById('bestiary-stages').innerHTML = BESTIARY_STAGES
      .map((s) => mark('stage', s, s === 'all' ? '<small>STAGES</small><b>ALL</b>' : `<small>STAGE</small><b>${romanNumeral(s)}</b>`, this.stage === s, '',
        s === 'all' ? 'Show enemies from every stage' : s === 1 ? 'Show only enemies you can meet in stage 1' : `Show enemies you can meet by stage ${s}`)).join('');
    document.getElementById('bestiary-roles').innerHTML = BESTIARY_ROLES
      .map((r) => mark('role', r, r === 'all' ? 'ALL' : r === 'summoner' ? 'SUMMON' : r.toUpperCase(), this.role === r, r,
        r === 'all' ? 'Show every kind of enemy' : `Show only ${r === 'boss' ? 'the boss' : `${r} enemies`}`)).join('');
    this.initSearch();
  },

  // ---------- searching ----------

  /** Hooks up the search box once: it searches as you type (after a pause) and on Enter. */
  initSearch() {
    if (this.searchReady) return;
    this.searchReady = true;
    const input = document.getElementById('bestiary-search');
    input.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.search(input.value), 450);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      clearTimeout(this.searchTimer);
      this.search(input.value);
    });
  },

  /**
   * Finds an enemy by (part of) its name and flips the book through to its page.
   * If the bookmarks hide it, they go back to ALL first.
   */
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = (e) => e.name.toLowerCase().includes(q) || (e.type || e.boss || '').toLowerCase().includes(q);
    const input = document.getElementById('bestiary-search');
    let i = this.entries.findIndex(match);
    if (i < 0 && BESTIARY[this.theme].some(match)) {
      // the bookmarks hide it: back to ALL, and turn straight to it in the full book
      const oldList = this.entries;
      this.stage = 'all';
      this.role = 'all';
      this.renderFilters();
      this.found = this.entries.findIndex(match);
      this.turnToNewList(Math.floor(this.found / 2), oldList);
      return;
    }
    if (i < 0) {
      input.classList.remove('miss');
      void input.offsetWidth;
      input.classList.add('miss');
      document.getElementById('bestiary-count').textContent = 'NOT IN THIS BOOK';
      return;
    }
    this.found = i;
    const target = Math.floor(i / 2);
    if (target === this.spread) { this.render(); this.found = null; }   // already open: just make it glow
    else this.goTo(target);
  },

  /** Riffles through to spread `target`, a page at a time (fast when it's far). */
  goTo(target) {
    target = clamp(target, 0, this.spreads - 1);
    const dir = Math.sign(target - this.spread);
    if (!dir) return;
    this.dropLeaf();
    this.queue = Math.abs(target - this.spread) - 1;
    this.flip(dir, true);
  },

  /** The HTML of page `i` of the filtered list (left pages are even), or the empty-book note. */
  pageHtml(i) {
    const list = this.entries;
    const e = list[i];
    if (e) return this.entryHtml(e, i);
    return i === 0 && !list.length ? '<p class="b-empty">No enemies match these filters.</p>' : '';
  },

  /** Fills both pages of the current spread. */
  render() {
    this.dropLeaf();
    const list = this.entries;
    this.spread = clamp(this.spread, 0, this.spreads - 1);
    document.getElementById('bestiary-left').innerHTML = this.pageHtml(this.spread * 2);
    document.getElementById('bestiary-right').innerHTML = this.pageHtml(this.spread * 2 + 1);
    this.collectPreviews();
    const n = list.length;
    document.getElementById('bestiary-count').textContent =
      n ? `PAGE ${this.spread + 1} / ${this.spreads}   (${n} ${n === 1 ? 'ENTRY' : 'ENTRIES'})` : 'NO ENTRIES';
    document.getElementById('bestiary-prev').disabled = this.spread <= 0;
    document.getElementById('bestiary-next').disabled = this.spread >= this.spreads - 1;
  },

  /** Every portrait canvas in the book right now (pages and a turning leaf) gets animated. */
  collectPreviews() {
    const list = this.entries;
    const old = this.previews;
    // pages still showing the list from before a bookmark changed it point into oldList
    this.previews = [...document.querySelectorAll('#bestiary-book canvas[data-entry], #bestiary-book canvas[data-old-entry]')].map((canvas) => {
      const stale = canvas.dataset.oldEntry != null;
      const i = Number(stale ? canvas.dataset.oldEntry : canvas.dataset.entry);
      const entry = stale ? this.oldList?.[i] : list[i];
      canvas.getContext('2d').imageSmoothingEnabled = false;
      // keep the stand-in enemy of an entry already on show, so its animation carries on
      const prev = old.find((pv) => pv.entry === entry);
      return { canvas, entry, index: i, enemy: prev && prev.enemy };
    }).filter((pv) => pv.entry);
  },

  entryHtml(e, i) {
    const first = this.firstStage(e);
    const stageText = e.role === 'boss' ? e.stage || 'ALL STAGES' : e.note ? `${e.note} - STAGE ${first}+` : first === 1 ? 'STAGES 1-3' : first === 3 ? 'STAGE 3 ONLY' : `STAGE ${first}+`;
    let stats;
    if (e.boss) {
      const c = CONFIG[e.boss];
      const dmg = { phantom: c.dashDamage, deathbringer: c.slash?.damage, queen: c.homing?.damage, king: c.sword?.damage, princeBoss: c.dash?.damage, princessBoss: c.sky?.damage }[e.boss];
      stats = `HP ${c.hp} &nbsp; DMG ${dmg}`;
    } else {
      const c = CONFIG.enemies[e.type];
      stats = `HP ${c.hp} &nbsp; DMG ${c.damage} &nbsp; SPD ${c.speed}${c.armor ? ` &nbsp; ARMOR ${Math.round(c.armor * 100)}%` : ''}`;
    }
    const exclusive = first > 1 && e.role !== 'boss' && !e.note;
    return `
      <canvas width="112" height="104" data-entry="${i}"></canvas>
      <h3${this.found === i ? ' class="found"' : ''}>${e.name}</h3>
      <div class="b-tags"><span class="b-role ${e.role}">${e.role.toUpperCase()}</span><span class="b-stage${exclusive ? ' excl' : ''}">${stageText}</span></div>
      <div class="b-stats">${stats}</div>
      <p class="b-desc">${e.desc}</p>
      <div class="b-folio">${romanNumeral(i + 1)}</div>`;
  },

  // ---------- page turning ----------
  // A turning page is a "leaf": a two-sided page hinged on the spine, at an angle
  // from 0 (lying where it started) to 180 (turned over onto the other side).
  // The leaf is cut into LEAF_STRIPS hinged strips so it bends like old paper:
  // `curl` spreads extra turn along it, so the outer edge leads while you pull
  // it, trails behind as it falls, and peels up first when you hover near the
  // corner. The angle and the curl are both soft damped springs.
  // Arrow keys and the side buttons throw a page over the same way.
  //   leaf: { dir: +1 next / -1 back, a, v (deg/s), target, curl, cv, tilt, held, el, strips, under }

  leaf: null,
  grab: null,          // { dir } while the mouse holds a page
  pointer: null,       // last cursor position over the book, in client px
  lastStep: 0,

  /** Hooks up the mouse once; listeners only act while the book is open. */
  initPointer() {
    if (this.pointerReady) return;
    this.pointerReady = true;
    const book = document.getElementById('bestiary-book');
    book.addEventListener('pointerdown', (e) => {
      const side = this.sideAt(e.clientX, e.clientY);
      if (!side) return;
      const dir = side === 'right' ? 1 : -1;
      if (!this.canTurn(dir) || (this.leaf && this.leaf.dir !== dir)) return;
      e.preventDefault();
      this.grab = { dir };
      this.startLeaf(dir).held = true;
    });
    window.addEventListener('pointermove', (e) => { this.pointer = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointerup', () => this.release());
    window.addEventListener('blur', () => this.release());
  },

  /** The book's layout in client pixels (the stage is CSS-scaled, so measure it live). */
  bookRect() {
    const spine = document.querySelector('#bestiary-book .book-spine').getBoundingClientRect();
    const right = document.getElementById('bestiary-right').getBoundingClientRect();
    return { spineX: spine.left + spine.width / 2, pageW: right.width, top: right.top, bottom: right.bottom };
  },

  /** 'left' / 'right' when the point is on a page, else null. */
  sideAt(x, y) {
    const r = this.bookRect();
    if (y < r.top || y > r.bottom || Math.abs(x - r.spineX) > r.pageW + 6) return null;
    return x >= r.spineX ? 'right' : 'left';
  },

  canTurn(dir) {
    const next = this.spread + dir;
    return next >= 0 && next < this.spreads;
  },

  /**
   * Builds the leaf for turning toward `dir` (or returns the one already up).
   * Its front is the page being lifted, its back the page that lands on the
   * other side; the page underneath already shows the spread it reveals.
   * Each strip shows its slice of both pages and holds the next strip, so
   * turning one strip carries everything beyond it.
   */
  startLeaf(dir, custom = null) {
    if (this.leaf && this.leaf.dir === dir && !custom) return this.leaf;
    if (!custom) this.dropLeaf();
    const s = this.spread;
    const t = custom ? custom.to : s + dir;
    const W = LEAF_PAGE_W;
    const n = LEAF_STRIPS;
    const sw = W / n;
    // next: lift the right page (front) whose back is the next spread's left page
    // back: lift the left page (front) whose back is the previous spread's right page
    // (custom: explicit pages, when the list itself changed under the book)
    const frontHtml = custom ? custom.front : this.pageHtml(dir > 0 ? s * 2 + 1 : s * 2);
    const backHtml = custom ? custom.back : this.pageHtml(dir > 0 ? t * 2 : t * 2 + 1);
    const frontSide = dir > 0 ? 'right' : 'left';
    const backSide = dir > 0 ? 'left' : 'right';
    let inner = '';
    for (let i = n - 1; i >= 0; i--) {
      // which slice of each page this strip shows (strip 0 is at the spine)
      const fx = dir > 0 ? i * sw : W - (i + 1) * sw;
      const bx = dir > 0 ? W - (i + 1) * sw : i * sw;
      const pos = i === 0 ? (dir > 0 ? 0 : W - sw) : (dir > 0 ? sw : -sw);
      inner = `<div class="leaf-strip" style="left:${pos}px;width:${sw}px">`
        + `<div class="leaf-face"><div class="book-page ${frontSide} leaf-sheet" style="left:${-fx}px">${frontHtml}</div><i class="leaf-shade"></i></div>`
        + `<div class="leaf-face leaf-back"><div class="book-page ${backSide} leaf-sheet" style="left:${-bx}px">${backHtml}</div><i class="leaf-shade"></i></div>`
        + `${inner}</div>`;
    }
    const book = document.getElementById('bestiary-book');
    const el = document.createElement('div');
    el.className = `book-leaf ${dir > 0 ? 'next' : 'prev'}`;
    el.innerHTML = inner;
    book.appendChild(el);
    // the page under the leaf now shows what turning reveals
    const under = document.getElementById(dir > 0 ? 'bestiary-right' : 'bestiary-left');
    under.innerHTML = (custom ? custom.under : this.pageHtml(dir > 0 ? t * 2 + 1 : t * 2)) + '<i class="under-shade"></i>';
    const strips = [...el.querySelectorAll('.leaf-strip')];
    this.leaf = { dir, a: 0, v: 0, target: 0, curl: 0, cv: 0, tilt: 0, held: false, el, strips, under, to: custom ? custom.to : null };
    this.collectPreviews();
    this.applyLeaf();
    return this.leaf;
  },

  /** Puts the pages back to plain (no leaf) without changing the spread. */
  /** restore = false leaves the page under the leaf as it is (the caller fills it). */
  dropLeaf(restore = true) {
    if (!this.leaf) return;
    const { dir, el } = this.leaf;
    el.remove();
    this.leaf = null;
    if (restore) document.getElementById(dir > 0 ? 'bestiary-right' : 'bestiary-left').innerHTML = this.pageHtml(this.spread * 2 + (dir > 0 ? 1 : 0));
    this.collectPreviews();
  },

  /** Letting go of a held page: past the spine (or flicked) it turns over, otherwise it falls back. */
  release() {
    if (!this.grab) return;
    this.grab = null;
    const L = this.leaf;
    if (!L) return;
    L.held = false;
    const turn = L.a + L.v * 0.2 > 90;
    L.target = turn ? 180 : 0;
    if (turn) Sound.play('uiHover');
  },

  /**
   * Arrow keys / side buttons: throw the page over (dir +1 / -1). Pressing again
   * while a page is still falling queues another, so you can riffle quickly;
   * the turning speeds up while pages are queued. fast: a search / bookmark riffle.
   */
  flip(dir, fast = false) {
    if (this.grab) return;
    const L0 = this.leaf;
    if (L0 && L0.target >= 180) {
      if (L0.dir === dir) {
        if (this.canTurn(dir * (2 + this.queue))) this.queue++;
      } else if (this.queue > 0) this.queue--;   // pressing back cancels a queued page
      return;
    }
    if (!this.canTurn(dir)) return;
    if (L0 && L0.dir !== dir) {
      if (L0.a > 20) return;   // the other page is mid-turn
      this.dropLeaf();
    }
    const L = this.startLeaf(dir);
    L.target = 180;
    L.fast = fast || this.queue > 0;
    L.v = Math.max(L.v, L.fast ? 520 : 380);
    L.cv = Math.min(L.cv, -180);       // flung from the spine, the edge trails behind
    Sound.play('uiHover', 0.06);
  },

  /** One physics step for the leaf (and the hover peel that starts one). */
  step(time) {
    const dt = clamp(time - (this.lastStep || time), 0, 1 / 20);
    this.lastStep = time;
    this.initPointer();
    let peel = 0;
    // hovering near a page's outer edge lifts its corner toward the cursor
    if (!this.grab && this.pointer && (!this.leaf || this.leaf.target < 90)) {
      const side = this.sideAt(this.pointer.x, this.pointer.y);
      const r = this.bookRect();
      const reach = side ? 1 - Math.abs(Math.abs(this.pointer.x - r.spineX) - r.pageW) / (r.pageW * 0.35) : 0;
      const dir = side === 'right' ? 1 : -1;
      if (reach > 0 && this.canTurn(dir) && (!this.leaf || this.leaf.dir === dir)) {
        peel = reach;
        this.startLeaf(dir).target = 14 * reach;
      } else if (this.leaf) this.leaf.target = 0;
    }
    const L = this.leaf;
    if (!L) return;
    const r = this.bookRect();
    if (L.held && this.pointer) {
      // the page edge goes where the cursor is: its angle from how far across the spread it is
      const across = ((this.pointer.x - r.spineX) * L.dir) / r.pageW;
      L.target = Math.acos(clamp(across, -1, 1)) * (180 / Math.PI);
    }
    // the angle: a soft spring with a little give (heavy old paper, not card); a riffle turns quicker
    const rush = !L.held && L.target >= 180 && (L.fast || this.queue > 0) ? 2.6 : 1;
    const k = (L.held ? 90 : 70) * rush;
    const damp = (L.held ? 12 : 11) * Math.sqrt(rush);
    L.v += (k * (L.target - L.a) - damp * L.v) * dt;
    L.a += L.v * dt;
    if (L.a < 0) { L.a = 0; L.v = -L.v * 0.3; }
    if (L.a > 180) { L.a = 180; L.v = -L.v * 0.3; }
    // the curl: pulled by its edge it leads; falling, the air holds the edge back; hovered, the corner peels up
    const lift = Math.sin((L.a * Math.PI) / 180);
    const curlTarget = L.held ? 34 * lift : peel > 0 ? 20 * peel : -0.09 * L.v;
    L.cv += (70 * (curlTarget - L.curl) - 9 * L.cv) * dt;
    L.curl += L.cv * dt;
    // a held page twists a little toward the corner it's held by
    const tiltTarget = L.held && this.pointer ? clamp(((this.pointer.y - (r.top + r.bottom) / 2) / (r.bottom - r.top)) * -10, -5, 5) : 0;
    L.tilt += (tiltTarget - L.tilt) * Math.min(1, dt * 8);
    if (!L.held && L.target >= 180 && L.a > 166) {
      // as good as down on the other side: that spread is open now (no slow settle at the end),
      // and the next queued page goes straight over
      const dir = L.dir;
      this.spread = L.to != null ? L.to : this.spread + dir;
      this.oldList = null;
      this.render();
      if (this.queue > 0 && this.canTurn(dir)) {
        this.queue--;
        this.flip(dir, true);
      } else {
        this.queue = 0;
        this.found = null;   // the glow has played on the landed page
      }
      return;
    }
    if (!L.held && L.target === 0 && L.a < 0.4 && Math.abs(L.v) < 4 && Math.abs(L.curl) < 0.6) {
      this.dropLeaf();
      return;
    }
    this.applyLeaf();
  },

  /**
   * Bends the leaf: strip 0 turns by the angle less half the curl and each
   * further strip adds its share of the curl, so the paper arcs. Every strip is
   * shaded by its own angle, and the page underneath darkens under the leaf.
   */
  applyLeaf() {
    const L = this.leaf;
    const n = L.strips.length;
    const a = L.a;
    const curl = clamp(L.curl, -2 * a, 2 * (180 - a));   // the paper can't fold through the book
    L.el.style.transform = `rotateX(${L.tilt.toFixed(2)}deg)`;
    let total = 0;
    L.strips.forEach((s, i) => {
      const turn = i === 0 ? a - curl / 2 : curl / (n - 1);
      total += turn;
      s.style.transform = `rotateY(${(-L.dir * turn).toFixed(2)}deg)`;
      const mid = clamp(total, 0, 180);
      const [front, back] = s.querySelectorAll(':scope > .leaf-face > .leaf-shade');
      const crease = Math.abs(turn) / 40;   // where the paper bends it catches more shadow
      front.style.opacity = ((mid / 180) * 0.6 + crease * 0.12).toFixed(3);
      back.style.opacity = ((1 - mid / 180) * 0.6 + crease * 0.12).toFixed(3);
    });
    const shade = L.under.querySelector('.under-shade');
    if (shade) shade.style.opacity = (Math.sin((a * Math.PI) / 180) * 0.5).toFixed(3);
  },

  /**
   * Animated portraits on the open pages. Enemies are drawn by a stand-in
   * enemy's own draw() so weapons and gear (bows, scythes, guns, shields,
   * bombs) look exactly as in a fight; the boss uses its sprite.
   */
  drawPreviews(time) {
    if (!this.isOpen) return;
    this.step(time);
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
      // each boss's idle loop (the King on his throne)
      const list = { phantom: Sprites.phantom.walk || Sprites.phantom.idle, deathbringer: Sprites.deathbringer.body, queen: Sprites.queen.idle, king: Sprites.king.sit, princeBoss: Sprites.enemies.prince.idle, princessBoss: Sprites.enemies.princess.idle }[entry.boss];
      const frame = list[Math.floor(time * (entry.boss === 'phantom' ? 8 : 4)) % list.length].img;
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
