// DOM screens: main menu, controls, lobby panels (hero, workshop, dungeon), pause, end screen.

const CLASS_INFO = {
  warrior: {
    PASSIVE: ['Tanker', 'Every 5th hit is blocked'],
    LMB: ['Sword Combo', 'Slash, slash, long stab'],
    RMB: ['Barrier Shield', 'Hold: stops shots. +LMB: stun bash'],
    E: ['Whirlwind', '5.5s spin, move faster'],
    F: ['Charge', 'Stunning rush, 2 charges'],
    Q: ['World Cutter', 'Power up, then a massive strike'],
  },
  ranger: {
    PASSIVE: ['Agility', 'Fastest hero, quicker dodge'],
    LMB: ['Arrow', 'Piercing shot'],
    RMB: ['Swift Camo', 'Hide + cleanse, attacking reveals'],
    E: ['Rapid Fire', 'Next 5 arrows: faster, +25%'],
    F: ['Fire / Ice Arrow', 'F, then LMB fire or RMB ice'],
    Q: ['Volley', 'Mark an area, rain arrows for 5s'],
  },
  mage: {
    PASSIVE: ['Mana Surge', 'Mana orbs: +20% damage 2s'],
    LMB: ['Magic Missile', 'Homing orbs (3 mana)'],
    RMB: ['Frostfire Ball', 'Big explosion (20 mana)'],
    E: ['Lightning', 'Pick a target, it arcs (120)'],
    F: ['Bird Form', 'Tiny, fast bird (50 mana)'],
    Q: ['Mana Drain', 'Drain circle, 1s cooldowns while up'],
  },
  rogue: {
    PASSIVE: ['Killing Streak', '+3% damage per kill, max 10'],
    LMB: ['Dagger Fan', 'Three daggers (2 energy)'],
    RMB: ['Swift Strike', 'Dash slash + mark; marked kill resets'],
    E: ['Parry', 'Block a hit: +75 energy, haste'],
    F: ['Dagger Storm', 'Next attack: 3s of daggers (100)'],
    Q: ['Clone Surprise', '3 tough exploding clones'],
  },
  priestess: {
    PASSIVE: ['Divine Mark', 'Marked foes drop light orbs'],
    LMB: ['Ray of Light', 'A beam falls on the cursor'],
    RMB: ['Light Missiles', '5 missiles mark 5 foes for 10s'],
    E: ['Healing Rune', 'Aim + place: 50 hp/s for 4s (2 light)'],
    F: ['Guardian Aegis', '150 hp shield, LMB ally / RMB self (2)'],
    Q: ['Light Bomb', 'Charge up to 4s, stuns everything'],
  },
};

const Menus = {
  screens: {},
  heroPreview: null,   // { id, ctx } for the hero panel's animated portrait

  init(app) {
    for (const el of document.querySelectorAll('.screen')) {
      this.screens[el.id.replace('screen-', '')] = el;
    }
    document.addEventListener('click', (e) => {
      const pp = e.target.closest('[data-pp]');
      if (pp) {
        Sound.play('uiClick');
        pp.blur(); // keep keyboard input going to the game
        this.handlePractice(pp.dataset.pp, app);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      Sound.play('uiClick');
      btn.blur();
      this.handleAction(btn.dataset.action, app);
    });
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('.btn, .card:not(.locked)') && e.target !== this.lastHover) Sound.play('uiHover', 0.05);
      this.lastHover = e.target;
    });
    this.initSettings();
    this.musicChanged(Settings.data.music, false);
  },

  // ---------- settings ----------

  initSettings() {
    const slider = (id, key, fmt, after) => {
      const el = document.getElementById(id);
      el.addEventListener('input', () => {
        Settings.data[key] = parseFloat(el.value);
        document.getElementById(`${id}-val`).textContent = fmt(Settings.data[key]);
        if (after) after();
        this.updateSaveState();
      });
    };
    slider('set-sens', 'sensitivity', (v) => `${v.toFixed(1)}x`);
    slider('set-mvol', 'musicVolume', (v) => `${Math.round(v * 100)}%`, () => Sound.applyVolumes());
    slider('set-svol', 'sfxVolume', (v) => `${Math.round(v * 100)}%`, () => { Sound.applyVolumes(); Sound.play('uiClick', 0.15); });
    document.getElementById('set-keys').addEventListener('click', (e) => {
      const btn = e.target.closest('.keybind');
      if (btn) this.captureKey(btn);
    });
  },

  /**
   * Opens settings over the current screen (main menu or pause); Back returns there.
   * Changes apply live (so volume and keys can be tried out) but are only stored
   * by Save; `savedSettings` is what Discard goes back to.
   */
  openSettings() {
    const open = Object.entries(this.screens).find(([, el]) => !el.classList.contains('hidden'));
    this.settingsReturn = open ? open[0] : 'menu';
    this.savedSettings = Settings.copy();
    this.refreshSettings();
    this.show('settings');
  },

  get settingsDirty() { return !!this.savedSettings && Settings.differsFrom(this.savedSettings); },

  /** Stores the current settings. */
  saveSettings() {
    Settings.save();
    this.savedSettings = Settings.copy();
    this.updateSaveState();
    this.toast('SETTINGS SAVED', '#6cff7a');
    Sound.play('pickup');
  },

  /** Back / Esc: asks first if there are unsaved changes. */
  requestCloseSettings() {
    Input.onKeyCapture = null;
    if (this.settingsDirty) {
      this.refreshSettings(); // clears a half-finished "PRESS A KEY"
      document.getElementById('set-confirm').classList.remove('hidden');
      return;
    }
    this.closeSettings();
  },

  get confirmOpen() { return !document.getElementById('set-confirm').classList.contains('hidden'); },

  hideConfirm() { document.getElementById('set-confirm').classList.add('hidden'); },

  /** Throws away unsaved changes and leaves. */
  discardSettings() {
    Settings.data = Settings.copy(this.savedSettings);
    Sound.applyVolumes();
    this.musicChanged(Settings.data.music, false);
    this.closeSettings();
  },

  closeSettings() {
    Input.onKeyCapture = null;
    this.hideConfirm();
    this.savedSettings = null;
    this.show(this.settingsReturn || 'menu');
  },

  get settingsOpen() { return !this.screens.settings.classList.contains('hidden'); },

  /** Save button + "unsaved changes" line follow whether anything changed. */
  updateSaveState() {
    const dirty = this.settingsDirty;
    document.getElementById('set-save').disabled = !dirty;
    const status = document.getElementById('set-status');
    status.textContent = dirty ? 'Unsaved changes' : 'All changes saved';
    status.classList.toggle('dirty', dirty);
  },

  /** Fills every control from Settings. */
  refreshSettings() {
    const s = Settings.data;
    const set = (id, v, text) => {
      document.getElementById(id).value = v;
      document.getElementById(`${id}-val`).textContent = text;
    };
    set('set-sens', s.sensitivity, `${s.sensitivity.toFixed(1)}x`);
    set('set-mvol', s.musicVolume, `${Math.round(s.musicVolume * 100)}%`);
    set('set-svol', s.sfxVolume, `${Math.round(s.sfxVolume * 100)}%`);
    this.musicChanged(s.music, false);
    const keys = document.getElementById('set-keys');
    keys.innerHTML = KEY_ACTIONS
      .map(([action, label]) => `<span>${label}</span><button class="keybind" data-bind="${action}">${Settings.label(action)}</button>`)
      .join('');
    this.updateSaveState();
  },

  /** Waits for the next key press and binds it (Esc cancels). */
  captureKey(btn) {
    for (const b of document.querySelectorAll('.keybind.waiting')) b.classList.remove('waiting');
    btn.classList.add('waiting');
    btn.textContent = 'PRESS A KEY';
    Input.onKeyCapture = (code) => {
      if (code !== 'Escape') {
        Settings.bind(btn.dataset.bind, code);
        Sound.play('pickup');
      }
      this.refreshSettings();
    };
  },

  /** Updates every music on/off indicator; toast = also flash it on screen. */
  musicChanged(on, toast = true) {
    const btn = document.getElementById('set-music');
    btn.textContent = on ? 'ON' : 'OFF';
    btn.classList.toggle('off', !on);
    document.getElementById('menu-music-hint').textContent = `${Settings.label('music')} - music: ${on ? 'ON' : 'OFF'}`;
    if (toast) this.toast(on ? 'MUSIC: ON' : 'MUSIC: OFF', on ? '#6cff7a' : '#a99bbd');
  },

  /** Short message at the top of the screen that fades out. */
  toast(text, color = '#f4ead7') {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('hidden', 'fade');
    clearTimeout(this.toastTimer);
    clearTimeout(this.toastHide);
    this.toastTimer = setTimeout(() => el.classList.add('fade'), 1200);
    this.toastHide = setTimeout(() => el.classList.add('hidden'), 1600);
  },

  handleAction(cmd, app) {
    const [action, arg, arg2] = cmd.split(':');
    switch (action) {
      case 'play': app.enterLobby(true); break;
      case 'controls': this.show('controls'); break;
      case 'back': this.show('menu'); break;
      case 'resume': app.resume(); break;
      case 'quit': app.quitToMenu(); break;
      case 'retry': app.retry(); break;
      case 'lobby': app.enterLobby(); break;
      case 'closePanel': app.closePanel(); break;
      case 'chooseHero': app.pickHero(this.heroPreview.id); break;
      case 'mode':
        if (arg === 'set') this.showDungeonView('themes');
        else if (arg === 'random') app.startDungeonRun({ mode: 'random' });
        else app.startRun();   // test dungeon
        break;
      case 'theme': app.startDungeonRun({ mode: 'set', theme: arg }); break;
      case 'dungeonBack': this.showDungeonView('modes'); break;
      case 'bestiaryFilter': Bestiary.setFilter(arg, arg2); break;
      case 'bestiaryFlip': Bestiary.flip(Number(arg)); break;
      case 'dialogOption': Dialog.choose(Number(arg)); break;
      case 'dialogSkip': Dialog.finish(); break;
      case 'buy': Shop.buy(arg); break;
      case 'settings': this.openSettings(); break;
      case 'closeSettings': this.requestCloseSettings(); break;
      case 'saveSettings': this.saveSettings(); break;
      case 'confirmSave': this.saveSettings(); this.closeSettings(); break;
      case 'confirmDiscard': this.discardSettings(); break;
      case 'confirmCancel': this.hideConfirm(); break;
      case 'toggleMusic':
        // inside settings it's an unsaved edit like the rest
        this.musicChanged(Music.toggle(!this.settingsOpen));
        this.updateSaveState();
        break;
      case 'resetSettings':
        Settings.reset(false);
        Sound.applyVolumes();
        this.refreshSettings();
        break;
    }
  },

  /** Buttons on the practice-range panel. */
  handlePractice(cmd, app) {
    const [name, arg] = cmd.split(':');
    const game = app.game;
    switch (name) {
      case 'collapse': document.getElementById('practice-panel').classList.toggle('collapsed'); break;
      case 'class': app.startPractice(arg); break;
      case 'spawn': game.practiceSpawn(arg); break;
      case 'clear': game.clearEnemies(); break;
      case 'toggle':
        app.practiceOptions[arg] = !app.practiceOptions[arg];
        this.refreshPractice(app.practiceOptions);
        break;
      case 'ult': game.player.ult = game.player.ultMax; break;
      case 'resetDps': game.resetDps(); break;
      case 'lobby': app.enterLobby(); break;
    }
  },

  refreshPractice(options) {
    for (const el of document.querySelectorAll('[data-pp^="toggle:"]')) {
      el.classList.toggle('on', !!options[el.dataset.pp.split(':')[1]]);
    }
  },

  /** Shows one screen (or none, while playing). */
  show(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
  },

  /** Pause menu; "Return to Lobby" only makes sense outside the lobby. */
  showPause(inLobby) {
    document.getElementById('pause-lobby').classList.toggle('hidden', inLobby);
    this.show('pause');
  },

  showEnd(won, stats) {
    document.getElementById('end-title').textContent = won ? 'Victory!' : 'You Died';
    document.getElementById('end-title').style.color = won ? '#f2a541' : '#e04545';
    document.getElementById('end-sub').innerHTML = won
      ? `${stats.defeatText || "The crypt falls silent."}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`
      : `${stats.stage ? `Fell in the ${stats.theme}, stage ${stats.stage}.` : `Reached wave ${stats.wave}.`}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`;
    this.show('end');
  },

  /** Dungeon gate: 'modes' (Set / Random / Test) or 'themes' (Set Dungeon's theme list). */
  showDungeonView(view) {
    document.getElementById('dungeon-modes').classList.toggle('hidden', view !== 'modes');
    document.getElementById('dungeon-themes').classList.toggle('hidden', view !== 'themes');
    this.show('dungeon');
  },

  /** Hero statue panel: the class card, main class / subclass choices (subclasses aren't in yet). */
  showHero(id, currentId) {
    const cfg = CONFIG.classes[id];
    document.getElementById('hero-title').textContent = cfg.name;
    document.getElementById('hero-main').textContent = `Main: ${cfg.name}`;
    const choose = document.getElementById('hero-choose');
    choose.textContent = id === currentId ? 'Playing' : 'Choose';
    const holder = document.getElementById('hero-card');
    holder.innerHTML = '';
    const card = this.buildCard(id);
    holder.appendChild(card);
    const ctx = card.querySelector('canvas').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    this.heroPreview = { id, ctx };
    this.show('hero');
  },

  /** Hero card: portrait, stats, passive and every ability. */
  buildCard(id) {
    const cfg = CONFIG.classes[id];
    const info = CLASS_INFO[id];
    const card = document.createElement('div');
    card.className = 'card';
    const resource = cfg.resource ? ` &nbsp; ${cfg.resource.name} ${cfg.resource.max}` : '';
    const abilities = Object.entries(info)
      .map(([key, [name, desc]]) => {
        const bound = { E: 'e', F: 'f', Q: 'ult' }[key];   // show the player's own keys
        return `<div class="ability"><b>${bound ? Settings.label(bound) : key} ${name}</b><br><span>${desc}</span></div>`;
      })
      .join('');
    card.innerHTML = `
      <canvas width="64" height="64"></canvas>
      <h3>${cfg.name}</h3>
      <div class="stats">HP ${cfg.hp} &nbsp; SPD ${cfg.speed}${resource}</div>
      ${abilities}`;
    return card;
  },

  /** Map legend board: every room's minimap icon and what it's for, plus the map's other markings. */
  showLegend() {
    // icons are drawn by the same code as the minimap, so they always match
    const icon = (type, state = 'cleared', here = false) => `<img class="map-icon" src="${roomIconImage(type, state, here)}" alt="">`;
    const row = (iconHtml, name, desc) => `<div class="legend-row">${iconHtml}<div><b>${name}</b><span>${desc}</span></div></div>`;
    document.getElementById('legend-rooms').innerHTML = Object.entries(ROOM_INFO)
      .map(([type, r]) => row(icon(type), r.name.toUpperCase(), r.desc)).join('');
    document.getElementById('legend-states').innerHTML = [
      row(icon(null, 'unseen'), 'UNEXPLORED', 'Seen next to a room you visited.'),
      row(icon(null, 'active'), 'IN PROGRESS', 'Visited, objective not done.'),
      row(icon(null), 'CLEARED', 'Done, or a safe room.'),
      row(icon(null, 'cleared', true), 'YOU ARE HERE', 'The room you are in.'),
      row('<div class="map-hall"></div>', 'HALLWAY', 'Connects two rooms.'),
    ].join('');
    this.show('legend');
  },

  /** Animates the hero panel's portrait (walking) and the bestiary's open pages. */
  drawPreviews(time) {
    Bestiary.drawPreviews(time);
    Dialog.drawPortrait(time);
    const p = this.heroPreview;
    if (!p || this.screens.hero.classList.contains('hidden')) return;
    const frame = Sprites.heroes[p.id].walk[Math.floor(time * 9) % 4];
    p.ctx.clearRect(0, 0, 64, 64);
    p.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    p.ctx.beginPath();
    p.ctx.ellipse(32, 59, 13, 4, 0, 0, TAU);
    p.ctx.fill();
    p.ctx.drawImage(frame.img, 0, 0);
  },
};
