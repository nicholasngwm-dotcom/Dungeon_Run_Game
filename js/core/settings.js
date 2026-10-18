// Player settings: mouse sensitivity, audio and key bindings. Saved in the
// browser (localStorage) so they survive reloads; falls back to defaults if
// storage is unavailable.

// Rebindable actions, in the order the settings screen lists them.
// LMB / RMB (primary / secondary) stay on the mouse buttons.
const KEY_ACTIONS = [
  ['up', 'Move up'],
  ['down', 'Move down'],
  ['left', 'Move left'],
  ['right', 'Move right'],
  ['e', 'Ability E'],
  ['f', 'Ability F'],
  ['ult', 'Ultimate'],
  ['dodge', 'Dodge'],
  ['potion', 'Health potion'],
  ['interact', 'Interact (lobby)'],
  ['music', 'Toggle music'],
];

const Settings = {
  defaults: {
    sensitivity: 1,      // mouse speed multiplier while the game has the pointer locked
    music: true,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    keys: {
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      e: 'KeyE', f: 'KeyF', ult: 'KeyQ', dodge: 'ShiftLeft', potion: 'KeyH',
      interact: 'KeyE', music: 'KeyM',
    },
  },
  data: null,
  storageKey: 'dungeonRun.settings',

  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey)) || {}; } catch (e) { saved = {}; }
    this.data = { ...this.defaults, ...saved, keys: { ...this.defaults.keys, ...(saved.keys || {}) } };
  },

  save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch (e) { /* storage blocked: keep in memory */ }
  },

  /** Back to defaults; save = false leaves it as an unsaved edit (settings screen). */
  reset(save = true) {
    this.data = this.copy(this.defaults);
    if (save) this.save();
  },

  /** Deep copy of a settings object (for the settings screen's undo snapshot). */
  copy(d = this.data) { return JSON.parse(JSON.stringify(d)); },

  /** True if the live settings differ from a snapshot. */
  differsFrom(snapshot) { return JSON.stringify(this.data) !== JSON.stringify(snapshot); },

  get keys() { return this.data.keys; },

  /**
   * Binds an action to a key. If another action already uses that key it gets
   * this action's old key instead (a swap), so nothing ends up unbound.
   * Interact may share a key with anything: it only fires next to a lobby station.
   * Not saved until the settings screen's Save.
   */
  bind(action, code) {
    const keys = this.data.keys;
    const old = keys[action];
    if (action !== 'interact') {
      for (const [other] of KEY_ACTIONS) {
        if (other !== action && other !== 'interact' && keys[other] === code) keys[other] = old;
      }
    }
    keys[action] = code;
  },

  /** Short label for a key code: KeyE -> E, ShiftLeft -> SHIFT, Digit1 -> 1, ArrowUp -> UP. */
  keyName(code) {
    if (!code) return '?';
    const special = { Space: 'SPACE', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
      Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'CAPS', Enter: 'ENTER' };
    if (special[code]) return special[code];
    return code.replace(/^Key|^Digit|^Numpad/, '').replace(/Left$|Right$/, '').replace(/^Arrow/, '')
      .replace('Control', 'CTRL').toUpperCase();
  },

  /** Label for an action's current key. */
  label(action) { return this.keyName(this.data.keys[action]); },
};

Settings.load();
