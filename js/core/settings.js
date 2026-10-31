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
  ['item6', 'Inventory slot 6 (Backpack)'],
  ['item7', 'Inventory slot 7 (Backpack)'],
  ['quickHeal', 'Quick heal (strongest health potion)'],
  ['mount', 'Mount / dismount your horse'],
  ['interact', 'Interact / revive'],
  ['music', 'Toggle music'],
  ['cursor', 'Mouse / crosshair'],
  ['scoreboard', 'Scoreboard (hold)'],
];

// The aiming crosshair's styles, in the order the settings screen lists them.
const CROSSHAIR_TYPES = [
  ['cross', 'Crosshair'],
  ['dot', 'Dot'],
  ['circle', 'Circle'],
  ['both', 'Circle + cross'],
];

// How the game is played, in the order the settings screen lists them (auto: touch on phones and tablets).
// the touch buttons' names, for prompts like "[USE] OPEN" on a phone (Settings.prompt)
const TOUCH_PROMPTS = { interact: 'USE', scoreboard: 'SCORE', quickHeal: 'HEAL', dodge: 'DODGE', ult: 'ULT', mount: 'HORSE' };

// Graphics presets, sharpest first (the settings screen lists them in this order). Looks only: none
// of it touches the shared simulation, so teammates can each pick their own.
//   res: the most canvas pixels per game pixel (sharper text and effects; sprites look the same)
//   particles: x every spray of sparks and puff of smoke; lightRes: the darkness layer's resolution
//   (x the game's); bloom: lamps' coloured glow; fog: billows per bank of graveyard mist (0 = none);
//   glow: torch glows and full glow rings; vignette: the darkened screen edges; fps: frame cap (0 = none)
const GRAPHICS_PRESETS = [
  ['superQuality', 'Super quality', { res: 3, particles: 1.5, lightRes: 2, bloom: true, fog: 3, glow: true, vignette: true, fps: 0 }],
  ['quality', 'Quality', { res: 2, particles: 1, lightRes: 1, bloom: true, fog: 3, glow: true, vignette: true, fps: 0 }],
  ['balanced', 'Balanced', { res: 1.5, particles: 0.7, lightRes: 0.5, bloom: true, fog: 1, glow: true, vignette: true, fps: 0 }],
  ['performance', 'Performance', { res: 1, particles: 0.45, lightRes: 0.5, bloom: false, fog: 1, glow: false, vignette: true, fps: 0 }],
  ['superPerformance', 'Super performance', { res: 1, particles: 0.25, lightRes: 0.25, bloom: false, fog: 0, glow: false, vignette: false, fps: 30 }],
];
const GRAPHICS_BY_ID = Object.fromEntries(GRAPHICS_PRESETS.map(([id, , g]) => [id, g]));

const CONTROL_MODES = [
  ['auto', 'Auto'],
  ['touch', 'Touch'],
  ['mouse', 'Mouse + keys'],
];

const Settings = {
  defaults: {
    sensitivity: 1,      // mouse speed multiplier while the game has the pointer locked
    music: true,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    minimapSize: 1.4,    // dungeon minimap scale
    crosshair: 'both',   // cross | dot | circle | both (a circle with a crosshair) - see CROSSHAIR_TYPES
    crosshairSize: 1,    // crosshair scale
    crosshairLock: 0,    // 0 = off; else the crosshair stays this many px from the hero, the mouse turning it round them
    display: 'fullscreen',   // fullscreen | default (see Display)
    displayV: 2,         // saves from before fullscreen was the default are moved onto it once (see load)
    graphics: 'quality', // graphics preset - see GRAPHICS_PRESETS
    screenShake: 1,      // camera shake strength (0 = off)
    othersFx: 1,         // multiplayer: how strongly teammates' effects show (0 = hidden); yours, enemies' and text stay full
    controls: 'auto',    // auto | touch | mouse - see CONTROL_MODES and Touch
    autoFire: true,      // touch: dragging the aim stick attacks; off, letting go of it fires one shot
    fixedStick: false,   // touch: the movement stick stays in one spot (the layout editor moves it) instead of following the thumb
    touchSize: 1,        // touch buttons' scale
    touchOpacity: 0.85,  // touch buttons' opacity
    uiScale: 1.35,       // touch: interface size (HUD, buttons, text and menus), x a PC's
    touchLayout: {},     // touch: buttons moved / resized in the layout editor: { id: { x, y, s } } (offsets from the default spot, scale)
    keys: {
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      e: 'KeyE', f: 'KeyF', ult: 'KeyQ', dodge: 'ShiftLeft',
      interact: 'KeyE', music: 'KeyM', cursor: 'KeyC', scoreboard: 'Tab',
      item1: 'Digit1', item2: 'Digit2', item3: 'Digit3', item4: 'Digit4', item5: 'Digit5', item6: 'Digit6', item7: 'Digit7',
      quickHeal: 'KeyH', mount: 'KeyR',
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
    // a save from when the window was the default: fullscreen now is
    if (!saved.displayV) this.data.display = 'fullscreen';
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

  /** The chosen graphics preset's values (GRAPHICS_PRESETS). */
  get gfx() { return GRAPHICS_BY_ID[this.data.graphics] || GRAPHICS_BY_ID.quality; },

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

  /** What to press for an action in on-screen prompts: its key, or on a phone the touch button's name. */
  prompt(action) { return (Touch.enabled && TOUCH_PROMPTS[action]) || this.label(action); },
};

Settings.load();
