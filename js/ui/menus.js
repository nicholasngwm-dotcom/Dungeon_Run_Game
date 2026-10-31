// DOM screens: main menu, controls, lobby panels (hero, workshop, dungeon), pause, end screen.

const Menus = {
  screens: {},
  heroPreview: null,   // { id, ctx } for the hero panel's animated portrait

  init(app) {
    this.app = app;
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
    this.refreshContinue();
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
    slider('set-shake', 'screenShake', Menus.offOrPercent);
    slider('set-ofx', 'othersFx', Menus.offOrPercent);
    slider('set-xsize', 'crosshairSize', (v) => `${Math.round(v * 100)}%`, () => this.drawCrosshairPreview());
    slider('set-xlock', 'crosshairLock', Menus.lockLabel);
    slider('set-tsize', 'touchSize', (v) => `${Math.round(v * 100)}%`);
    slider('set-topac', 'touchOpacity', (v) => `${Math.round(v * 100)}%`);
    slider('set-ui', 'uiScale', (v) => `${Math.round(v * 100)}%`, () => Display.layout());
    document.getElementById('set-controls').innerHTML = CONTROL_MODES
      .map(([mode, label]) => `<button class="toggle" data-action="controlMode:${mode}">${label.toUpperCase()}</button>`)
      .join('');
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
    document.getElementById('set-gfx').innerHTML = GRAPHICS_PRESETS
      .map(([id, label]) => `<button class="toggle" data-action="graphics:${id}">${label.toUpperCase()}</button>`)
      .join('');
  },

  offOrPercent(v) { return v > 0 ? `${Math.round(v * 100)}%` : 'OFF'; },
  lockLabel(v) { return v > 0 ? `${v}px` : 'OFF'; },

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

  /** Highlights the control mode and shows its options (touch buttons, or keybinds and crosshair). */
  controlsChanged() {
    for (const btn of document.querySelectorAll('#set-controls .toggle')) {
      btn.classList.toggle('off', btn.dataset.action !== `controlMode:${Settings.data.controls}`);
    }
    document.body.classList.toggle('touch', Touch.enabled);
    Display.layout();   // (the interface size only applies to touch)
    const fire = document.getElementById('set-autofire');
    fire.textContent = Settings.data.autoFire ? 'ON' : 'OFF';
    fire.classList.toggle('off', !Settings.data.autoFire);
    const stick = document.getElementById('set-fixedstick');
    stick.textContent = Settings.data.fixedStick ? 'ON' : 'OFF';
    stick.classList.toggle('off', !Settings.data.fixedStick);
  },

  /** Highlights the current window mode. */
  displayChanged() {
    for (const btn of document.querySelectorAll('#set-display .toggle')) {
      btn.classList.toggle('off', btn.dataset.action !== `display:${Settings.data.display}`);
    }
    for (const btn of document.querySelectorAll('#set-gfx .toggle')) {
      btn.classList.toggle('off', btn.dataset.action !== `graphics:${Settings.data.graphics}`);
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
    this.setSettingsTab(this.settingsTab || 'general');
    this.show('settings');
  },

  /** Drops a half-finished "PRESS A KEY" (switching tabs). */
  stopKeyCapture() {
    if (!Input.onKeyCapture) return;
    Input.onKeyCapture = null;
    this.refreshSettings();
  },

  /** Shows one settings tab: general, phone, pc or multiplayer. */
  setSettingsTab(tab) {
    this.settingsTab = tab;
    this.stopKeyCapture();
    for (const b of document.querySelectorAll('#screen-settings .set-tab')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('#screen-settings .set-pane')) p.classList.toggle('hidden', p.dataset.pane !== tab);
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
    set('set-shake', s.screenShake, Menus.offOrPercent(s.screenShake));
    set('set-ofx', s.othersFx, Menus.offOrPercent(s.othersFx));
    set('set-xsize', s.crosshairSize, `${Math.round(s.crosshairSize * 100)}%`);
    set('set-xlock', s.crosshairLock, Menus.lockLabel(s.crosshairLock));
    set('set-tsize', s.touchSize, `${Math.round(s.touchSize * 100)}%`);
    set('set-topac', s.touchOpacity, `${Math.round(s.touchOpacity * 100)}%`);
    set('set-ui', s.uiScale, `${Math.round(s.uiScale * 100)}%`);
    this.controlsChanged();
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
      case 'play': this.showProfiles('play'); break;
      case 'continueRun': {
        // (on the main menu: as the profile the save belongs to)
        const id = this.continueProfile;
        if (!id || !RunSave.get(id)) { this.refreshContinue(); break; }
        if (Profiles.current?.id !== id) Profiles.select(id);
        app.continueRun();
        break;
      }
      case 'forge': Shop.forge(); break;
      case 'forgeKeep': Shop.forgeKeep(arg); break;
      case 'multiplayer': this.showProfiles('mp'); break;
      case 'profileCreate': this.createProfile(); break;
      case 'profileSelect': {
        const p = Profiles.select(arg);
        if (!p) break;
        if (this.profileNext === 'mp') app.openMultiplayer();
        else app.enterLobby(true);
        break;
      }
      case 'profileDelete': this.profileConfirm = arg; this.renderProfiles(); break;
      case 'profileDeleteNo': this.profileConfirm = null; this.renderProfiles(); break;
      case 'profileDeleteYes': {
        const p = Profiles.byId(arg);
        Profiles.remove(arg);
        this.profileConfirm = null;
        if (p) this.profileStatus(`${p.name} was deleted.`);
        this.renderProfiles();
        break;
      }
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
      case 'resync': app.resyncRun(); break;
      case 'closePanel': app.closePanel(); break;
      case 'chooseHero': app.pickHero(this.heroPreview.id); break;
      case 'heroTab': this.setHeroTab(arg); break;
      case 'enhance': app.buyEnhancement(this.heroPreview.id); break;
      case 'petBuy': app.buyPet(arg); break;
      case 'petChoose': app.choosePet(arg); break;
      case 'petNone': app.choosePet(null); break;
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
      case 'tomeFilter': UpgradeGuide.setFilter(arg); break;
      case 'dialogOption': Dialog.choose(Number(arg)); break;
      case 'dialogSkip': Dialog.finish(); break;
      case 'buy': Shop.buy(arg); break;
      case 'buyPotion': Shop.buyPotion(arg); break;
      case 'sellUpgrade': Shop.sellUpgrade(arg); break;
      case 'sellPotion': Shop.sellPotion(Number(arg)); break;
      case 'reroll': Shop.reroll(); break;
      case 'pick': Shop.pick(arg); break;
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
      case 'graphics':
        Settings.data.graphics = arg;
        Display.layout();   // (the preset caps the resolution)
        this.displayChanged();
        this.updateSaveState();
        break;
      case 'controlMode':
        Settings.data.controls = arg;
        this.controlsChanged();
        this.updateSaveState();
        break;
      case 'setTab': this.setSettingsTab(arg); break;
      case 'editTouchLayout': Touch.openEditor(); break;
      case 'toggleAutoFire':
        Settings.data.autoFire = !Settings.data.autoFire;
        this.controlsChanged();
        this.updateSaveState();
        break;
      case 'toggleFixedStick':
        Settings.data.fixedStick = !Settings.data.fixedStick;
        this.controlsChanged();
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

  /**
   * Buttons on the practice-range panel. What happens in the range goes through app.command, so in
   * multiplayer every machine applies it together (anyone can use the panel; the cheats are shared).
   * Leaving the range (or restarting it) takes the whole party along, so in multiplayer only the host can.
   */
  handlePractice(cmd, app) {
    const [name, arg] = cmd.split(':');
    const hostOnly = () => {
      if (app.mp && !app.mp.isHost) { this.toast('ONLY THE HOST CAN DO THAT', '#ffe680'); return true; }
      return false;
    };
    switch (name) {
      case 'collapse': document.getElementById('practice-panel').classList.toggle('collapsed'); break;
      case 'class':
        if (!app.mp) { app.startPractice(arg); break; }
        app.command({ type: 'hero', classId: arg });
        app.classId = arg;
        break;
      case 'spawn': case 'arena': case 'clear': case 'toggle': case 'ult': case 'resetDps':
        app.command({ type: 'practice', action: name, arg });
        break;
      case 'range': if (!hostOnly()) app.startPractice(); break;
      case 'lobby': if (!hostOnly()) app.enterLobby(); break;
    }
  },

  refreshPractice(options) {
    for (const el of document.querySelectorAll('[data-pp^="toggle:"]')) {
      el.classList.toggle('on', !!options[el.dataset.pp.split(':')[1]]);
    }
  },

  /** Shows one screen (or none, while playing). */
  show(name) {
    this.hideEnhTip();
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
    if (name === 'menu') this.refreshContinue();
  },

  /** The profile whose saved run the main menu offers to continue (the one playing, or the last one played). */
  get continueProfile() { return Profiles.current?.id || Profiles.lastId; },

  /** "Profile - Graveyard, stage 2" for a saved run. */
  saveLabel(save, withName = true) {
    const theme = CONFIG.themes[save.snapshot.themes[save.snapshot.stage - 1]]?.name || '';
    const who = withName ? `${Profiles.byId(this.continueProfile)?.name || ''} - ` : '';
    return `${who}${theme}, stage ${save.snapshot.stage}`;
  },

  /** The main menu's Continue Run, shown while the profile has a saved run. */
  refreshContinue() {
    const id = this.continueProfile;
    const save = id ? RunSave.get(id) : null;
    for (const [btn, sub] of [['menu-continue', 'menu-continue-sub'], ['menu-continue-m', 'menu-continue-m-sub']]) {
      document.getElementById(btn).classList.toggle('hidden', !save);
      document.getElementById(sub).textContent = save ? this.saveLabel(save) : '';
    }
  },

  /** Pause menu; "Return to Lobby" only makes sense outside the lobby. */
  /** Pause menu. Multiplayer: the world doesn't stop, and leaving replaces the lobby / quit buttons. */
  /** In multiplayer only the host gets "Return to Lobby" (in the lobby it rebuilds it, which resyncs everyone). */
  showPause(inLobby, mp = false, host = false, hero = null) {
    const lobbyBtn = document.getElementById('pause-lobby');
    lobbyBtn.classList.toggle('hidden', mp ? !host : inLobby);
    lobbyBtn.textContent = mp && inLobby ? 'Restart Lobby (resync)' : 'Return to Lobby';
    // the host, mid-run: rebuild the stage for everyone without losing the run (see Session.resyncRun)
    document.getElementById('pause-resync').classList.toggle('hidden', !(mp && host && !inLobby));
    document.getElementById('pause-quit').textContent = mp ? 'Leave Game' : 'Quit to Menu';
    document.querySelector('#screen-pause h2').textContent = mp ? 'Menu' : 'Paused';
    this.showPauseHero(hero);
    this.show('pause');
  },

  /**
   * The pause menu's hero sheet: the hero as they are right now (health, crit, attack
   * speed and the rest, with shop upgrades and potions counted in) and the upgrades
   * they've bought this run.
   */
  showPauseHero(p) {
    const box = document.getElementById('pause-hero');
    box.classList.toggle('hidden', !p);
    if (!p) return;
    const pct = (f) => `${Math.round(f * 100)}%`;
    const bonus = (f) => (Math.abs(f - 1) < 0.005 ? '' : ` <em>(${f > 1 ? '+' : ''}${Math.round((f - 1) * 100)}%)</em>`);
    const base = p.cfg;
    const stats = [
      ['HEALTH', `${Math.ceil(p.hp)} / ${p.maxHp}`, '#e84a4a'],
      ['DAMAGE', `${pct(p.upgradeDamage * p.buffDamage)}`, '#ff8a4a'],
      ['CRIT CHANCE', pct(p.critChance), '#ffd34a'],
      ['CRIT DAMAGE', `x${p.critMultiplier}`, '#ff9a2a'],
      ['ATTACK SPEED', `${pct(p.attackSpeed)}${bonus(p.attackSpeed)}`, '#ffd34a'],
      ['ABILITY HASTE', `${pct(p.abilityHaste)}${bonus(p.abilityHaste)}`, '#c08aff'],
      ['MOVE SPEED', `${Math.round(p.speed)}${bonus(p.speed / base.speed)}`, '#6cff7a'],
      ['HP REGEN', p.bonusRegen ? `+${p.bonusRegen}/s always, +${CONFIG.player.regen.hpPerSecond}/s out of combat` : `+${CONFIG.player.regen.hpPerSecond}/s out of combat`, '#6cff7a'],
      ['DODGE', `${Math.round(p.dodgeCooldown * 10) / 10}s cd`, '#8ad8ff'],
    ];
    if (p.resource) {
      const r = p.resource;
      stats.push([r.name, `${Math.floor(r.value)} / ${r.max}${r.regen ? ` (+${r.regen}/s)` : ''}`, r.color]);
    }
    stats.push(['ULTIMATE', p.ultReady ? 'READY' : pct(p.ult / p.ultMax), '#c08aff']);
    if (App.game?.run || p.coins) stats.push(['COINS', `${p.coins}`, '#ffd34a']);
    const owned = SHOP_UPGRADES.filter((u) => p.upgradeLevels[u.id]);
    box.innerHTML = `
      <div class="hero-head">
        <div class="hero-portrait"><canvas id="pause-portrait" width="64" height="64"></canvas></div>
        <div><h2>${base.name}</h2><div class="hero-role">${heroGuide(p.classId).role.toUpperCase()}</div></div>
      </div>
      <div class="pause-stats">${stats.map(([label, value, color]) => `
        <div class="stat"><span class="stat-label">${label}</span><span class="stat-value" style="color:${color}">${value}</span></div>`).join('')}
      </div>
      <div class="pause-sub">UPGRADES</div>
      <div class="pause-upgrades">${owned.length ? owned.map((u, i) => `
        <div class="pause-upgrade${u.hero ? ' hero-only' : ''}"><canvas data-u="${i}"></canvas><div><b style="color:${u.color}">${u.name}${u.hero ? ` <i class="hero-tag">${CONFIG.classes[u.hero].name.toUpperCase()}</i>` : ''}</b><span>${u.desc}${u.cooldown ? ` (${u.cooldown >= 60 ? `${u.cooldown / 60} min` : `${u.cooldown}s`} cooldown)` : ''}</span></div></div>`).join('')
        : '<p class="pause-none">None yet. Buy them from Bram at a dungeon run\'s shop room.</p>'}
      </div>`;
    const portrait = document.getElementById('pause-portrait').getContext('2d');
    portrait.imageSmoothingEnabled = false;
    portrait.drawImage(p.frames.idle[0].img, 0, 0);
    for (const c of box.querySelectorAll('canvas[data-u]')) {
      drawUpgradeIcon(c, owned[Number(c.dataset.u)].id);
    }
  },

  /** mpRole: null (single player), 'host' or 'client' - only the host can take everyone back to the lobby. */
  showEnd(won, stats, mpRole = null) {
    document.getElementById('end-title').textContent = won ? 'Victory!' : mpRole ? 'Party Wiped' : 'You Died';
    document.getElementById('end-title').style.color = won ? '#f2a541' : '#e04545';
    document.getElementById('end-sub').innerHTML = won
      ? `${stats.defeatText || "The crypt falls silent."}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`
      : `${stats.stage ? `Fell in the ${stats.theme}, stage ${stats.stage}.` : `Reached wave ${stats.wave}.`}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`;
    // dungeon runs pay gems: the vault's chest on a win, a share for how far a wiped run got
    const gems = document.getElementById('end-gems');
    gems.classList.toggle('hidden', !stats.dungeon);
    if (stats.dungeon) {
      const saved = Profiles.current ? `${Profiles.gems} gems in total` : 'no profile picked, so they were not saved';
      gems.innerHTML = `${this.gemImg()} <b>+${stats.gems} GEMS</b> <span>${saved}</span>`;
    }
    document.getElementById('end-retry').classList.toggle('hidden', !!mpRole);
    document.getElementById('end-lobby').classList.toggle('hidden', mpRole === 'client');
    document.getElementById('end-wait').classList.toggle('hidden', mpRole !== 'client');
    document.getElementById('end-quit').textContent = mpRole ? 'Leave Game' : 'Main Menu';
    this.show('end');
  },

  // ---------- profiles ----------

  /**
   * The profile screen: pick who's playing, make a new profile or delete one. `next` is
   * where picking one goes: 'play' (the lobby) or 'mp' (the multiplayer screen).
   */
  showProfiles(next) {
    this.profileNext = next;
    this.profileConfirm = null;
    const input = document.getElementById('profile-name');
    input.value = '';
    if (!input.dataset.wired) {
      input.dataset.wired = '1';
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.createProfile(); });
    }
    this.profileStatus(ProfileStore.ok ? '' : 'This browser is blocking saves: profiles last until the game closes.');
    this.renderProfiles();
    this.show('profiles');
    if (!Profiles.list.length) input.focus();
  },

  /** One card per profile (the last one played first in line), Play and Delete on each. */
  renderProfiles() {
    const list = document.getElementById('profile-list');
    const date = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (!Profiles.list.length) {
      list.innerHTML = '<p class="profile-empty">No profiles yet. Make one below to start.</p>';
    } else {
      list.innerHTML = Profiles.list.map((p) => {
        const name = escapeHtml(p.name);
        const last = p.id === Profiles.lastId ? ' last' : '';
        if (this.profileConfirm === p.id) {
          return `<div class="profile-card deleting">
            <div class="profile-info"><b>Delete ${name}?</b><span>Everything saved on it is lost for good.</span></div>
            <button class="btn small danger" data-action="profileDeleteYes:${p.id}">Delete</button>
            <button class="btn small" data-action="profileDeleteNo">Keep</button>
          </div>`;
        }
        return `<div class="profile-card${last}">
          <div class="profile-badge">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
          <div class="profile-info"><b>${name}</b><span>${p.lastPlayedAt ? `Last played ${date(p.lastPlayedAt)}` : `Made ${date(p.createdAt)}`}</span></div>
          <button class="btn small" data-action="profileSelect:${p.id}">Play</button>
          <button class="profile-del" data-action="profileDelete:${p.id}" title="Delete this profile">Delete</button>
        </div>`;
      }).join('');
    }
    document.querySelector('.profile-new').classList.toggle('hidden', Profiles.full);
    if (Profiles.full && ProfileStore.ok) this.profileStatus(`All ${PROFILE_MAX} profile slots are used. Delete one to make another.`);
  },

  profileStatus(text) { document.getElementById('profile-status').textContent = text || ''; },

  /** Makes a profile from the name box and plays it straight away. */
  createProfile() {
    const input = document.getElementById('profile-name');
    const err = Profiles.nameError(input.value);
    if (err) {
      this.profileStatus(err);
      Sound.play('uiClick');
      return;
    }
    const p = Profiles.create(input.value);
    this.toast(`PROFILE MADE: ${p.name.toUpperCase()}`, '#6cff7a');
    this.handleAction(`profileSelect:${p.id}`, this.app);
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
    // a saved solo run: a card to continue it, and a warning that a new run gives it up (paying its gems)
    const save = !App.mp && RunSave.get();
    document.getElementById('dungeon-continue').classList.toggle('hidden', !save);
    document.getElementById('dungeon-soon').classList.toggle('hidden', !!save);
    const note = document.getElementById('dungeon-save-note');
    note.classList.toggle('hidden', !save);
    if (save) {
      document.getElementById('dungeon-continue-stats').textContent = this.saveLabel(save, false).toUpperCase();
      const n = RunSave.gems(save);
      note.textContent = `Starting a new run ends your saved run${n > 0 ? ` and pays its reward: ${n} gems` : ''}.`;
    }
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

    this.heroBought = null;   // a fresh look: no before / after showing
    this.renderHeroStats(id);

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
    this.renderEnhancements(id);
    this.setHeroTab(this.heroTab || 'abilities');
    this.show('hero');
  },

  /**
   * The hero panel's stats, with the enhancements this profile owns for them. Every stat they've
   * raised shows the hero's base value > the value now, with the bonus in green ("+50"), and its
   * bar has the bonus as a bright piece on the end of the base. `before` (the stats a moment ago,
   * just after buying one) also lights up the stats that purchase raised, tagged UP.
   */
  renderHeroStats(id, before = null) {
    const count = Profiles.enhancementCount(id);
    const base = Object.fromEntries(heroStats(id, 0).map((s) => [s.key, s]));
    const was = before && Object.fromEntries(before.map((s) => [s.key, s]));
    const width = (bar) => Math.round(clamp(bar, 0.04, 1) * 100);
    const stats = heroStats(id, count);
    const rows = stats.map((s) => {
      const b = base[s.key];
      const enhanced = b && b.value !== s.value;
      const justNow = was?.[s.key] && was[s.key].value !== s.value;
      const value = enhanced
        ? `<span class="stat-base">${b.value}</span><span class="stat-arrow">&#9654;</span><span style="color:${s.color}">${s.value}</span>`
        : `<span style="color:${s.color}">${s.value}</span>`;
      const bonus = enhanced ? `<b class="stat-bonus">${this.statBonus(s.key, b, s)}</b>` : '';
      let bar = '';
      if (s.bar !== null) {
        const now = width(s.bar);
        const from = enhanced && b.bar !== null ? Math.min(now, width(b.bar)) : now;
        bar = `<span class="stat-bar"><span style="width:${from}%;background:${s.color}"></span>${now > from ? `<span class="stat-gain${justNow ? ' pulse' : ''}" style="width:${now - from}%"></span>` : ''}</span>`;
      }
      return `<div class="stat${enhanced ? ' enhanced' : ''}${justNow ? ' gained' : ''}">
        <span class="stat-label">${s.label} ${bonus}${justNow ? ' <b class="stat-up">UP</b>' : ''}</span>
        <span class="stat-value">${value}</span>
        ${bar}
      </div>`;
    });
    const key = count ? `<div class="stat-key"><span><i class="base"></i>BASE</span><span><i class="gain"></i>FROM ENHANCEMENTS</span></div>` : '';
    document.getElementById('hero-stats').innerHTML = key + rows.join('');
  },

  /** How much the enhancements added to a stat, as text: "+50", "+5%", "-0.2s", "-25%". */
  statBonus(key, base, now) {
    const num = (v) => parseFloat(String(v).replace(/[^0-9.]/g, ''));
    const diff = Math.round((num(now.value) - num(base.value)) * 100) / 100;
    const unit = key === 'dodge' ? 's' : String(now.value).includes('%') ? '%' : '';
    return `${diff > 0 ? '+' : ''}${diff}${unit}`;
  },

  /** Each stat the next enhancement would change: [{ label, from, to, color }]. */
  statChanges(id, from, to) {
    const before = heroStats(id, from);
    const after = heroStats(id, to);
    return after.filter((s, i) => s.value !== before[i].value).map((s) => ({ label: s.label, from: before.find((b) => b.key === s.key).value, to: s.value, color: s.color }));
  },

  /**
   * The enhancement hover card: its name, where it stands (owned / next / price), what it says,
   * and for each stat it changes the value before and after (big), the difference (and how much
   * that is, as a share of what it was), and two bars, before and after, with the gain lit.
   * It sits beside the hovered row, in the stage's own coordinates (the stage is scaled to fit).
   */
  showEnhTip(id, tier, row) {
    const tip = document.getElementById('enh-tip');
    const t = CONFIG.enhancements[tier];
    const count = Profiles.enhancementCount(id);
    const owned = tier < count;
    const status = owned ? '<span class="tip-owned">OWNED</span>'
      : t.locked ? '<span class="tip-locked">COMING SOON</span>'
        : tier === count ? `<span class="tip-price">${this.gemImg()} ${t.cost}${Profiles.current && Profiles.gems < t.cost ? ` &middot; need ${t.cost - Profiles.gems} more` : ''}</span>`
          : `<span class="tip-locked">BUY THE ONES BEFORE IT FIRST</span>`;
    const before = heroStats(id, tier);
    const after = heroStats(id, tier + 1);
    const width = (bar) => Math.round(clamp(bar ?? 0, 0.04, 1) * 100);
    const num = (v) => parseFloat(String(v).replace(/[^0-9.]/g, ''));
    const blocks = after.map((s, i) => {
      const b = before[i];
      if (b.value === s.value) return '';
      const diff = this.statBonus(s.key, b, s);
      const share = Math.round(((num(s.value) - num(b.value)) / num(b.value)) * 100);
      const bars = s.bar === null ? '' : `
        <div class="tip-bar-row"><span>BEFORE</span><span class="stat-bar"><span style="width:${width(b.bar)}%;background:#6a5e70"></span></span></div>
        <div class="tip-bar-row"><span>AFTER</span><span class="stat-bar"><span style="width:${Math.min(width(b.bar), width(s.bar))}%;background:${s.color}"></span><span class="stat-gain pulse" style="width:${Math.max(0, width(s.bar) - width(b.bar))}%"></span></span></div>`;
      return `<div class="tip-stat">
        <div class="tip-stat-head"><span>${s.label}</span><b>${diff}${share ? ` (${share > 0 ? '+' : ''}${share}%)` : ''}</b></div>
        <div class="tip-values"><span class="tip-from">${b.value}</span><span class="stat-arrow">&#9654;</span><span style="color:${s.color}">${s.value}</span></div>
        ${bars}
      </div>`;
    }).join('');
    tip.innerHTML = `<div class="tip-head"><span class="tip-name">${t.name}</span>${status}</div>
      <div class="tip-desc">${t.desc}</div>
      ${blocks || (t.locked ? '<div class="tip-desc">Lets you shape how this hero\'s abilities work, once it\'s in.</div>' : '')}`;
    tip.classList.remove('hidden');
    // beside the row (to its left, over the stats), kept inside the stage
    const stage = document.getElementById('stage');
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth;
    const rr = row.getBoundingClientRect();
    const x = (rr.left - sr.left) / k;
    const y = (rr.top - sr.top) / k;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.max(6, x - w - 10)}px`;
    tip.style.top = `${clamp(y, 6, stage.offsetHeight - h - 6)}px`;
  },

  hideEnhTip() {
    document.getElementById('enh-tip')?.classList.add('hidden');
  },

  /** A list of stat changes as "LABEL  old > new" rows. */
  changeRows(changes) {
    return changes.map((c) => `<div class="enh-change"><span class="enh-change-label">${c.label}</span>
      <span class="stat-old">${c.from}</span><span class="stat-arrow">&#9654;</span><span style="color:${c.color}">${c.to}</span></div>`).join('');
  },

  /**
   * Just bought hero `id`'s next enhancement: the stats panel shows what changed (old -> new), and
   * the enhancements list opens with a card of the same before and after.
   */
  showEnhanced(id) {
    const count = Profiles.enhancementCount(id);
    this.heroBought = { id, tier: count - 1 };
    this.renderHeroStats(id, heroStats(id, count - 1));
    this.renderEnhancements(id);
  },

  /** The hero panel's right side: 'abilities' or 'enh' (the gem enhancements). */
  setHeroTab(tab) {
    this.heroTab = tab;
    document.getElementById('hero-abilities').classList.toggle('hidden', tab !== 'abilities');
    document.getElementById('hero-enh').classList.toggle('hidden', tab !== 'enh');
    for (const b of document.querySelectorAll('.hero-tab')) b.classList.toggle('on', b.dataset.action === `heroTab:${tab}`);
  },

  /** A sprite as a data URL for <img> (cached per canvas). */
  spriteUrl(img) {
    if (!img.dataUrl) img.dataUrl = img.toDataURL();
    return img.dataUrl;
  },

  gemImg() { return `<img class="gem-img" src="${this.spriteUrl(Sprites.vault.gemIcon)}" alt="gems">`; },

  /**
   * The pet room's window: a card per pet (CONFIG.pets) with its portrait, health and what it
   * does. Not owned: its gem price on a buy button. Owned: bring it along, or (the one that's
   * along) leave it at home. Only one pet comes along at a time.
   */
  showPets() {
    document.getElementById('pets-gems').innerHTML = `${this.gemImg()} ${Profiles.gems}`;
    const along = Profiles.pet;
    document.getElementById('pets-list').innerHTML = Object.entries(CONFIG.pets).map(([kind, c]) => {
      const owned = Profiles.ownsPet(kind);
      const btn = along === kind ? '<button class="buy" data-action="petNone">LEAVE AT HOME</button>'
        : owned ? `<button class="buy" data-action="petChoose:${kind}">BRING ALONG</button>`
          : `<button class="buy" data-action="petBuy:${kind}" ${Profiles.current && Profiles.gems >= c.cost ? '' : 'disabled'}>${this.gemImg()} ${c.cost}</button>`;
      return `<div class="shop-card pet${along === kind ? ' with-you' : ''}">
        <canvas data-pet="${kind}"></canvas>
        <b style="color:${c.color}">${c.name.toUpperCase()}${along === kind ? ' (WITH YOU)' : ''}</b>
        <div class="pet-hp">${c.hp} HP</div>
        <span>${c.desc}</span>
        ${btn}
      </div>`;
    }).join('');
    // each portrait: the pet sitting, drawn 3x
    for (const cv of document.querySelectorAll('#pets-list canvas[data-pet]')) {
      const pose = Sprites.pets[cv.dataset.pet].sit;
      cv.width = 24;
      cv.height = 20;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pose.img, Math.round(12 - pose.ax), 20 - pose.ay - 1);
    }
    document.getElementById('pets-hint').textContent = Profiles.current
      ? 'Pets never die: at 0 health they run back to you and rest until they\'re healed. Enemy bodies can\'t hurt them. Follower upgrades (Total Loyalty, Stronger Buddies) work on pets.'
      : 'Pick a profile to keep pets.';
  },

  /**
   * Hero `id`'s gem enhancements (CONFIG.enhancements, the same six for every hero, each hero
   * on their own track): bought in order with the profile's gems. Owned ones are ticked off,
   * the next one has its price on a buy button, the ability tree stays locked for now.
   */
  renderEnhancements(id) {
    const count = Profiles.enhancementCount(id);
    const gems = Profiles.gems;
    const name = CONFIG.classes[id].name;
    document.getElementById('hero-gems').innerHTML = Profiles.current ? `${this.gemImg()} ${gems}` : '';
    const intro = Profiles.current
      ? `Gems come from beating dungeons (and a share for getting far). Enhancements are bought in order, last for good, and only make the ${name} stronger.`
      : 'Pick a profile from the main menu to collect gems and buy enhancements.';
    const rows = CONFIG.enhancements.map((t, i) => {
      const owned = i < count;
      const next = i === count && !t.locked;
      let state;
      if (owned) state = '<div class="enh-state owned">OWNED</div>';
      else if (t.locked) state = '<div class="enh-state">LOCKED &middot; COMING SOON</div>';
      else if (next) {
        const can = !!Profiles.current && gems >= t.cost;
        state = `<div class="enh-state"><button class="btn small" data-action="enhance" ${can ? '' : 'disabled'}>${this.gemImg()} ${t.cost}</button></div>`;
      } else state = `<div class="enh-state"><span class="enh-cost">${this.gemImg()} ${t.cost}</span></div>`;
      // owned ones show what they changed; the next one on offer previews what it would
      const preview = owned || next ? this.changeRows(this.statChanges(id, i, i + 1)) : '';
      return `<div class="enh ${owned ? 'owned' : next ? 'next' : 'locked'}" data-tier="${i}">
        <span class="enh-tier">${i + 1}</span>
        <div class="ab-icon"><img src="${this.spriteUrl(Sprites.vault.icons[t.id])}" alt=""></div>
        <div class="enh-body"><div class="enh-name">${t.name}</div><div class="enh-desc">${t.desc}</div>${preview ? `<div class="enh-preview">${preview}</div>` : ''}</div>
        ${state}
      </div>`;
    });
    // just bought one: a card with what it changed, before and after
    const b = this.heroBought;
    let bought = '';
    if (b && b.id === id && b.tier < count) {
      const t = CONFIG.enhancements[b.tier];
      bought = `<div class="enh-bought">
        <div class="ab-icon"><img src="${this.spriteUrl(Sprites.vault.icons[t.id])}" alt=""></div>
        <div class="enh-body">
          <div class="enh-name">${t.name.toUpperCase()} BOUGHT</div>
          <div class="enh-cols"><span>BEFORE</span><span>AFTER</span></div>
          ${this.changeRows(this.statChanges(id, b.tier, b.tier + 1))}
        </div>
      </div>`;
    }
    const list = document.getElementById('hero-enh');
    list.innerHTML = `<p class="enh-intro">${intro}</p>${bought}${rows.join('')}`;
    // hovering one shows exactly what it does to the stats
    this.hideEnhTip();
    for (const el of list.querySelectorAll('.enh[data-tier]')) {
      el.addEventListener('mouseenter', () => this.showEnhTip(id, Number(el.dataset.tier), el));
      el.addEventListener('mouseleave', () => this.hideEnhTip());
    }
    list.onscroll = () => this.hideEnhTip();
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
