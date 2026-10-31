// Player profiles: whoever is playing picks (or makes) their profile after the main menu,
// before the lobby, and their progress will be saved under it. For now profiles live in this
// browser (localStorage). ProfileStore is the only part that touches storage, so it can be
// swapped for Steam Cloud or an online account later without changing the rest.

const PROFILE_VERSION = 3;   // bump when a profile's saved shape changes (and upgrade old ones in Profiles.upgrade)
const PROFILE_MAX = 6;       // profiles kept on one machine
const PROFILE_NAME_MAX = 14;

const ProfileStore = {
  prefix: 'dungeonRun.',
  ok: true,   // false once a write has failed (storage blocked): profiles then last until the game closes

  read(key) {
    try { return JSON.parse(localStorage.getItem(this.prefix + key)); } catch (e) { return null; }
  },

  write(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
    return this.ok;
  },

  remove(key) {
    try { localStorage.removeItem(this.prefix + key); } catch (e) { /* storage blocked: nothing was kept anyway */ }
  },
};

const Profiles = {
  list: [],         // { id, name, createdAt, lastPlayedAt, version }, in the order they were made
  lastId: null,     // the profile picked last time (highlighted on the profile screen)
  current: null,    // the profile playing now (null until one is picked)

  load() {
    const saved = ProfileStore.read('profiles') || {};
    const list = Array.isArray(saved.list) ? saved.list : [];
    this.list = list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string').map((p) => this.upgrade(p));
    this.lastId = this.byId(saved.lastId) ? saved.lastId : null;
  },

  save() {
    return ProfileStore.write('profiles', { list: this.list, lastId: this.lastId });
  },

  /**
   * A profile saved by an older version of the game, brought up to PROFILE_VERSION.
   * v2: gems, and how many enhancements each hero has ({ classId: count }).
   * v3: the pets bought (pets: [kind]) and the one that comes along (pet: kind or null).
   */
  upgrade(p) {
    const out = { createdAt: 0, lastPlayedAt: 0, ...p, version: PROFILE_VERSION };
    out.gems = Math.max(0, Math.floor(Number(out.gems) || 0));
    out.enhancements = this.cleanEnhancements(out.enhancements);
    out.pets = Array.isArray(out.pets) ? [...new Set(out.pets.filter((k) => CONFIG.pets[k]))] : [];
    out.pet = out.pets.includes(out.pet) ? out.pet : null;
    return out;
  },

  /** A pet kind, or null if it isn't one (also used on what other players send). */
  cleanPet(kind) { return CONFIG.pets[kind] ? kind : null; },

  /** { classId: count } with only real heroes and counts in range (also used on what other players send). */
  cleanEnhancements(e) {
    const out = {};
    const max = CONFIG.enhancements.filter((t) => !t.locked).length;
    for (const id of Object.keys(CONFIG.classes)) {
      const n = Math.floor(Number(e && e[id]) || 0);
      if (n > 0) out[id] = Math.min(n, max);
    }
    return out;
  },

  byId(id) { return this.list.find((p) => p.id === id) || null; },

  get full() { return this.list.length >= PROFILE_MAX; },

  /** Why `name` can't be used for a new profile, or '' if it can. */
  nameError(name) {
    const n = (name || '').trim();
    if (!n) return 'Type a name for the profile.';
    if (n.length > PROFILE_NAME_MAX) return `Names can be up to ${PROFILE_NAME_MAX} letters.`;
    if (this.list.some((p) => p.name.toLowerCase() === n.toLowerCase())) return 'There is already a profile with that name.';
    if (this.full) return `There is room for ${PROFILE_MAX} profiles. Delete one to make another.`;
    return '';
  },

  /** Makes a new profile (check nameError first). */
  create(name) {
    const now = Date.now();
    const p = {
      id: `p${now.toString(36)}${Math.floor(nativeRandom() * 1e6).toString(36)}`, name: name.trim(), createdAt: now, lastPlayedAt: 0,
      version: PROFILE_VERSION, gems: 0, enhancements: {}, pets: [], pet: null,
    };
    this.list.push(p);
    this.save();
    return p;
  },

  remove(id) {
    RunSave.clear(id);
    this.list = this.list.filter((p) => p.id !== id);
    if (this.lastId === id) this.lastId = null;
    if (this.current && this.current.id === id) this.current = null;
    this.save();
  },

  /** Starts playing as profile `id`. */
  select(id) {
    const p = this.byId(id);
    if (!p) return null;
    p.lastPlayedAt = Date.now();
    this.current = p;
    this.lastId = id;
    this.save();
    return p;
  },

  // ---------- gems and enhancements (the profile playing now) ----------

  get gems() { return this.current ? this.current.gems : 0; },

  addGems(n) {
    if (!this.current || !(n > 0)) return;
    this.current.gems += Math.floor(n);
    this.save();
  },

  /** How many enhancements hero `classId` has (on the profile playing now). */
  enhancementCount(classId) { return (this.current && this.current.enhancements[classId]) || 0; },

  /** The next enhancement hero `classId` can buy (null when it has every one that's in). */
  nextEnhancement(classId) {
    const t = CONFIG.enhancements[this.enhancementCount(classId)];
    return t && !t.locked ? t : null;
  },

  /** Buys hero `classId`'s next enhancement. Returns it, or null (none left, or not enough gems). */
  buyEnhancement(classId) {
    const t = this.nextEnhancement(classId);
    if (!t || this.gems < t.cost) return null;
    this.current.gems -= t.cost;
    this.current.enhancements[classId] = this.enhancementCount(classId) + 1;
    this.save();
    return t;
  },

  // ---------- pets (the profile playing now) ----------

  ownsPet(kind) { return !!this.current && this.current.pets.includes(kind); },

  /** The pet that comes along (null for none). */
  get pet() { return this.current ? this.current.pet : null; },

  /** Buys pet `kind` with gems and brings it along. Returns true if it worked. */
  buyPet(kind) {
    const c = CONFIG.pets[kind];
    if (!c || !this.current || this.ownsPet(kind) || this.gems < c.cost) return false;
    this.current.gems -= c.cost;
    this.current.pets.push(kind);
    this.current.pet = kind;
    this.save();
    return true;
  },

  /** Brings owned pet `kind` along (null: leave every pet at home). */
  choosePet(kind) {
    if (!this.current || (kind && !this.ownsPet(kind))) return false;
    this.current.pet = kind || null;
    this.save();
    return true;
  },
};

/**
 * A solo dungeon run in progress, kept per profile (through ProfileStore, like the profiles) and
 * written at the start of every stage (App.saveRun) so it can be continued from the main menu:
 * { run: { mode, theme }, classId, snapshot (DungeonRun.snapshot, saved: true), time, kills, stats, savedAt }.
 * It's cleared when the run ends; starting a new run instead gives it up (paying its gems, see gems).
 */
const RunSave = {
  key(id) { return `run.${id}`; },

  /** The profile's saved run, or null (none, or one this version can't read). */
  get(id = Profiles.current?.id) {
    if (!id) return null;
    const s = ProfileStore.read(this.key(id));
    const ok = s && s.run && s.snapshot && CONFIG.classes[s.classId] && s.snapshot.stage >= 1 && s.snapshot.stage <= 3
      && Array.isArray(s.snapshot.themes) && s.snapshot.themes.every((t) => CONFIG.themes[t]) && s.snapshot.heroes?.local;
    return ok ? s : null;
  },

  put(data, id = Profiles.current?.id) { if (id) ProfileStore.write(this.key(id), data); },

  clear(id = Profiles.current?.id) { if (id) ProfileStore.remove(this.key(id)); },

  /** Gems a saved run pays when it's given up: what a wipe at the start of its stage would have paid. */
  gems(save) {
    const G = CONFIG.gems;
    return Math.floor(G.win * G.deathShare * clamp((save.snapshot.stage - 1) / 3, 0, 1));
  },
};

Profiles.load();
