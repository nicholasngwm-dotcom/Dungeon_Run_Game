// DOM screens: main menu, controls, lobby panels (hero, workshop, dungeon), pause, end screen.

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
    slider('set-map', 'minimapSize', (v) => `${Math.round(v * 100)}%`);
    slider('set-xsize', 'crosshairSize', (v) => `${Math.round(v * 100)}%`, () => this.drawCrosshairPreview());
    document.getElementById('set-xhair').innerHTML = CROSSHAIR_TYPES
      .map(([type, label]) => `<button class="toggle" data-action="crosshair:${type}">${label.toUpperCase()}</button>`)
      .join('');
    document.getElementById('set-keys').addEventListener('click', (e) => {
      const btn = e.target.closest('.keybind');
      if (btn) this.captureKey(btn);
    });
    document.getElementById('set-display').innerHTML = DISPLAY_MODES
      .map(([mode, label]) => `<button class="toggle" data-action="display:${mode}">${label.toUpperCase()}</button>`)
      .join('');
    // the browser left fullscreen by itself: already stored, so not an unsaved edit
    Display.onChange = (mode) => {
      if (this.savedSettings) this.savedSettings.display = mode;
      if (this.settingsOpen) this.refreshSettings();
    };
  },

  /** Highlights the chosen crosshair style and redraws the preview. */
  crosshairChanged() {
    for (const btn of document.querySelectorAll('#set-xhair .toggle')) {
      btn.classList.toggle('off', btn.dataset.action !== `crosshair:${Settings.data.crosshair}`);
    }
    this.drawCrosshairPreview();
  },

  /** The crosshair as it'll look in game, in the little box by the style buttons. */
  drawCrosshairPreview() {
    const c = document.getElementById('set-xhair-preview');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    HUD.drawCrosshair(ctx, c.width / 2, c.height / 2);
  },

  /** Highlights the current window mode. */
  displayChanged() {
    for (const btn of document.querySelectorAll('#set-display .toggle')) {
      btn.classList.toggle('off', btn.dataset.action !== `display:${Settings.data.display}`);
    }
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
    Display.apply();
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
    set('set-map', s.minimapSize, `${Math.round(s.minimapSize * 100)}%`);
    set('set-xsize', s.crosshairSize, `${Math.round(s.crosshairSize * 100)}%`);
    this.musicChanged(s.music, false);
    this.displayChanged();
    this.crosshairChanged();
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
      case 'multiplayer': app.openMultiplayer(); break;
      case 'mpHost': app.hostMultiplayer(); break;
      case 'mpJoin': app.joinMultiplayer(); break;
      case 'readyToggle': {
        const g = app.game;
        if (g && g.readyCheck) app.command({ type: 'ready', value: !g.readyCheck.ready[g.localId] });
        break;
      }
      case 'readyStart': if (app.game && app.game.allReady) app.openGatePicker(); break;
      case 'readyCancel': app.command({ type: 'cancelReady' }); break;
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
      case 'bestiaryTheme': Bestiary.setTheme(arg); break;
      case 'bestiaryFlip': Bestiary.flip(Number(arg)); break;
      case 'potionGroup': PotionGuide.setGroup(arg); break;
      case 'dialogOption': Dialog.choose(Number(arg)); break;
      case 'dialogSkip': Dialog.finish(); break;
      case 'buy': Shop.buy(arg); break;
      case 'buyPotion': Shop.buyPotion(arg); break;
      case 'reroll': Shop.reroll(); break;
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
      case 'display':
        Display.set(arg);
        this.displayChanged();
        this.updateSaveState();
        break;
      case 'crosshair':
        Settings.data.crosshair = arg;
        this.crosshairChanged();
        this.updateSaveState();
        break;
      case 'resetSettings':
        Settings.reset(false);
        Sound.applyVolumes();
        Display.apply();
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
      case 'arena': game.openBossPortal(arg); break;
      case 'clear': game.clearEnemies(); break;
      case 'toggle':
        app.practiceOptions[arg] = !app.practiceOptions[arg];
        this.refreshPractice(app.practiceOptions);
        break;
      case 'ult': game.player.ult = game.player.ultMax; break;
      case 'resetDps': game.resetDps(); break;
      case 'range': app.startPractice(); break;
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
  /** Pause menu. Multiplayer: the world doesn't stop, and leaving replaces the lobby / quit buttons. */
  /** In multiplayer only the host gets "Return to Lobby" (in the lobby it rebuilds it, which resyncs everyone). */
  showPause(inLobby, mp = false, host = false) {
    const lobbyBtn = document.getElementById('pause-lobby');
    lobbyBtn.classList.toggle('hidden', mp ? !host : inLobby);
    lobbyBtn.textContent = mp && inLobby ? 'Restart Lobby (resync)' : 'Return to Lobby';
    document.getElementById('pause-quit').textContent = mp ? 'Leave Game' : 'Quit to Menu';
    document.querySelector('#screen-pause h2').textContent = mp ? 'Menu' : 'Paused';
    this.show('pause');
  },

  /** mpRole: null (single player), 'host' or 'client' - only the host can take everyone back to the lobby. */
  showEnd(won, stats, mpRole = null) {
    document.getElementById('end-title').textContent = won ? 'Victory!' : mpRole ? 'Party Wiped' : 'You Died';
    document.getElementById('end-title').style.color = won ? '#f2a541' : '#e04545';
    document.getElementById('end-sub').innerHTML = won
      ? `${stats.defeatText || "The crypt falls silent."}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`
      : `${stats.stage ? `Fell in the ${stats.theme}, stage ${stats.stage}.` : `Reached wave ${stats.wave}.`}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`;
    document.getElementById('end-retry').classList.toggle('hidden', !!mpRole);
    document.getElementById('end-lobby').classList.toggle('hidden', mpRole === 'client');
    document.getElementById('end-wait').classList.toggle('hidden', mpRole !== 'client');
    document.getElementById('end-quit').textContent = mpRole ? 'Leave Game' : 'Main Menu';
    this.show('end');
  },

  // ---------- multiplayer ----------

  showMultiplayer(name) {
    document.getElementById('mp-name').value = name;
    this.mpStatus('');
    this.show('mp');
  },

  mpStatus(text) { document.getElementById('mp-status').textContent = text || ''; },

  /**
   * The ready-check panel at the side (multiplayer lobby, while the host waits
   * at the gate): who is ready, a ready toggle, and for the host "Choose dungeon"
   * (once everyone is ready) and Cancel. Rebuilt only when something changes.
   */
  updateReadyPanel(app) {
    const panel = document.getElementById('ready-panel');
    const g = app.game;
    const show = !!(app.mp && g && g.lobby && g.readyCheck && (app.state === 'playing' || app.state === 'panel'));
    panel.classList.toggle('hidden', !show);
    if (!show) { this.readySig = ''; return; }
    const sig = JSON.stringify(g.readyCheck.ready) + g.players.map((p) => p.netId + p.name).join() + app.mp.isHost;
    if (sig === this.readySig) return;
    this.readySig = sig;
    document.getElementById('ready-list').innerHTML = g.players.map((p) => {
      const ready = g.readyCheck.ready[p.netId];
      const host = p.netId === g.roster[0].id ? ' (HOST)' : '';
      return `<div><span>${escapeHtml(p.name)}${host}</span><span class="${ready ? 'yes' : 'no'}">${ready ? 'READY' : '...'}</span></div>`;
    }).join('');
    const mine = g.readyCheck.ready[g.localId];
    const toggle = document.getElementById('ready-toggle');
    toggle.textContent = mine ? 'Not ready' : 'Ready';
    toggle.classList.toggle('hidden', app.mp.isHost);
    document.getElementById('ready-start').classList.toggle('hidden', !app.mp.isHost);
    document.getElementById('ready-start').disabled = !g.allReady;
    document.getElementById('ready-cancel').classList.toggle('hidden', !app.mp.isHost);
  },

  /** Dungeon gate: 'modes' (Set / Random / Test) or 'themes' (Set Dungeon's theme list). */
  showDungeonView(view) {
    document.getElementById('dungeon-modes').classList.toggle('hidden', view !== 'modes');
    document.getElementById('dungeon-themes').classList.toggle('hidden', view !== 'themes');
    this.show('dungeon');
  },

  /**
   * Hero statue panel: on the left who the hero is (portrait, role, difficulty,
   * stat bars); on the right every ability with its key, icon, key numbers and a
   * plain-language description (from heroGuide). Subclasses aren't in yet.
   */
  showHero(id, currentId) {
    const cfg = CONFIG.classes[id];
    const guide = heroGuide(id);
    document.getElementById('hero-title').textContent = cfg.name;
    document.getElementById('hero-role').textContent = guide.role.toUpperCase();
    document.getElementById('hero-diff').innerHTML = `DIFFICULTY ${[1, 2, 3].map((n) => `<i class="${n <= guide.difficulty ? 'on' : ''}"></i>`).join('')}`;
    document.getElementById('hero-blurb').textContent = guide.blurb;
    document.getElementById('hero-choose').textContent = id === currentId ? 'Playing' : 'Choose';

    document.getElementById('hero-stats').innerHTML = heroStats(id).map((s) => `
      <div class="stat">
        <span class="stat-label">${s.label}</span>
        <span class="stat-value" style="color:${s.color}">${s.value}</span>
        ${s.bar === null ? '' : `<span class="stat-bar"><span style="width:${Math.round(clamp(s.bar, 0.04, 1) * 100)}%;background:${s.color}"></span></span>`}
      </div>`).join('');

    // the player's own keys for E / F / Q
    const keyLabel = (key) => ({ E: Settings.label('e'), F: Settings.label('f'), Q: Settings.label('ult') }[key] || key);
    const list = document.getElementById('hero-abilities');
    list.innerHTML = guide.abilities.map((a, i) => `
      <div class="ab ${a.key === 'PASSIVE' ? 'passive' : ''}">
        <div class="ab-icon" data-i="${i}">${a.icon ? '' : '<span>P</span>'}</div>
        <div class="ab-body">
          <div class="ab-head">
            <span class="ab-key">${keyLabel(a.key)}</span>
            <span class="ab-name">${a.name}</span>
            ${a.tags.map((t) => `<span class="ab-tag">${t}</span>`).join('')}
          </div>
          <div class="ab-desc">${a.desc}</div>
        </div>
      </div>`).join('');
    // ability icons: the same pictures as the in-game HUD
    for (const el of list.querySelectorAll('.ab-icon[data-i]')) {
      const a = guide.abilities[Number(el.dataset.i)];
      const img = a.icon && Sprites.icons[id][a.icon];
      if (!img) continue;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      el.appendChild(c);
    }

    const ctx = document.getElementById('hero-portrait').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    this.heroPreview = { id, ctx };
    this.show('hero');
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
    const frame = heroFrame(Sprites.heroes[p.id], true, time);
    p.ctx.clearRect(0, 0, 64, 64);
    p.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    p.ctx.beginPath();
    p.ctx.ellipse(32, 59, 13, 4, 0, 0, TAU);
    p.ctx.fill();
    p.ctx.drawImage(frame.img, 0, 0);
  },
};
