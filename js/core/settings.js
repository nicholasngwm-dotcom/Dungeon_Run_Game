// Player settings: mouse sensitivity, audio, window mode and key bindings. Saved in the
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
  ['item1', 'Inventory slot 1'],
  ['item2', 'Inventory slot 2'],
  ['item3', 'Inventory slot 3'],
  ['item4', 'Inventory slot 4'],
  ['item5', 'Inventory slot 5'],
  ['interact', 'Interact / revive'],
  ['music', 'Toggle music'],
  ['cursor', 'Mouse / crosshair'],
];

const Settings = {
  defaults: {
    sensitivity: 1,      // mouse speed multiplier while the game has the pointer locked
    music: true,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    display: 'default',   // default | fullscreen (see Display)
    keys: {
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      e: 'KeyE', f: 'KeyF', ult: 'KeyQ', dodge: 'ShiftLeft',
      interact: 'KeyE', music: 'KeyM', cursor: 'KeyC',
      item1: 'Digit1', item2: 'Digit2', item3: 'Digit3', item4: 'Digit4', item5: 'Digit5',
    },
  },
  data: null,
  storageKey: 'dungeonRun.settings',

  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey)) || {}; } catch (e) { saved = {}; }
    this.data = { ...this.defaults, ...saved, keys: { ...this.defaults.keys, ...(saved.keys || {}) } };
    // drop saved bindings for actions that no longer exist (the old free potion)
    for (const k of Object.keys(this.data.keys)) if (!(k in this.defaults.keys)) delete this.data.keys[k];
  },

  save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch (e) { /* storage blocked: keep in memory */ }
  },

  /** Stores one setting's live value without also storing other unsaved edits. */
  saveOne(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey)) || {};
      saved[key] = this.data[key];
      localStorage.setItem(this.storageKey, JSON.stringify(saved));
    } catch (e) { /* storage blocked: keep in memory */ }
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
