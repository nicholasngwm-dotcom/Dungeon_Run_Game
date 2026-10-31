// Window mode (Settings.data.display) and the game's screen space:
//   fullscreen - fills the whole screen (browser Fullscreen API); the default
//   default    - the game fills the browser window
//
// Browsers only allow entering fullscreen from a click, tap or key press, so fullscreen
// is entered on the first input after the page loads, and again on the next click or tap
// whenever the browser leaves it (Esc, F11, switching apps). Settings > Window mode turns it off.
//
// The game space (CONFIG.screen) takes the window's shape: 960x540, widened (or made
// taller) to match it, so there are no black bars. With the touch controls it is shrunk
// by the interface size (Settings uiScale), so the HUD, buttons, text and menus all show
// bigger on a phone; the world is zoomed (Display.zoom) to stay a comfortable size.
// None of this touches the shared simulation: each screen draws its own view of it.

const DISPLAY_MODES = [
  ['fullscreen', 'Fullscreen'],
  ['default', 'Window'],
];

// the touch view shows about this much of the world from top to bottom (a PC shows 540)
const TOUCH_VIEW_HEIGHT = 470;

const Display = {
  stage: null,
  canvas: null,
  scale: 1,          // CSS px per game px
  renderScale: 2,    // canvas pixels per game px (the text stays sharp)
  ui: 1,             // interface size: how much bigger than on a PC everything shows
  zoom: 1,           // game px per world px

  get isFullscreen() { return !!document.fullscreenElement; },
  get mode() { return Settings.data.display; },

  init(stage, canvas) {
    this.stage = stage;
    this.canvas = canvas;
    // older saves may hold a mode that no longer exists
    if (!DISPLAY_MODES.some(([m]) => m === this.mode)) Settings.data.display = 'fullscreen';
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('fullscreenchange', () => this.layout());
    // fullscreen needs a gesture: the first one of any kind, then every click or tap while out of it
    const first = () => {
      window.removeEventListener('keydown', first);
      if (this.mode === 'fullscreen') this.enterFullscreen();
    };
    window.addEventListener('keydown', first);
    window.addEventListener('pointerdown', () => { if (this.mode === 'fullscreen') this.enterFullscreen(); });
    this.apply();
  },

  /** Switches to a mode (call from a click so fullscreen is allowed). */
  set(mode) {
    Settings.data.display = mode;
    this.apply();
  },

  apply() {
    if (this.mode === 'fullscreen') this.enterFullscreen();
    else if (this.isFullscreen) document.exitFullscreen().catch(() => {});
    this.layout();
  },

  enterFullscreen() {
    if (this.isFullscreen || !document.documentElement.requestFullscreen) return;   // (iPhones: add to the home screen instead)
    document.documentElement.requestFullscreen()
      .then(() => { if (Touch.enabled) screen.orientation?.lock?.('landscape').catch(() => {}); })
      .catch(() => { /* needs a gesture: retried on the next one */ });
  },

  /** Sizes the game space to the window's shape, and the stage and canvas to fill it. */
  layout() {
    this.ui = Touch.enabled ? Settings.data.uiScale || 1.35 : 1;
    // the screen minus its safe area (an iPhone's notch and home bar; zero elsewhere), so nothing hides under them
    const css = getComputedStyle(document.documentElement);
    const inset = (side) => parseFloat(css.getPropertyValue(`--safe-${side}`)) || 0;
    const left = inset('l');
    const top = inset('t');
    const availW = Math.max(1, window.innerWidth - left - inset('r'));
    const availH = Math.max(1, window.innerHeight - top - inset('b'));
    const aspect = availW / availH;
    let w = 960;
    let h = 540;
    if (aspect > w / h) w = h * aspect;
    else h = w / aspect;
    w = Math.round(w / this.ui);
    h = Math.round(h / this.ui);
    CONFIG.screen.width = w;
    CONFIG.screen.height = h;
    this.zoom = Touch.enabled ? h / TOUCH_VIEW_HEIGHT : 1;
    this.scale = Math.min(availW / w, availH / h);
    this.renderScale = clamp(this.scale * (window.devicePixelRatio || 1), 1, Settings.gfx.res);   // (capped by the graphics preset)
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
    this.stage.style.left = `${left + availW / 2}px`;
    this.stage.style.top = `${top + availH / 2}px`;
    this.stage.style.transform = `translate(-50%, -50%) scale(${this.scale})`;
    const cw = Math.round(w * this.renderScale);
    const ch = Math.round(h * this.renderScale);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
  },
};
