// Window mode (Settings.data.display) and the stage scaling:
//   default    - the game fills the browser window
//   fullscreen - fills the whole screen (browser Fullscreen API)
//
// Browsers only allow entering fullscreen from a click or key press, so a saved
// "fullscreen" is entered on the first input after the page loads. Leaving
// fullscreen from the browser (Esc / F11) falls back to default.

const DISPLAY_MODES = [
  ['default', 'Default'],
  ['fullscreen', 'Fullscreen'],
];

const Display = {
  stage: null,
  onChange: null,   // fn(mode) when the browser changes the mode by itself

  get isFullscreen() { return !!document.fullscreenElement; },
  get mode() { return Settings.data.display; },

  init(stage) {
    this.stage = stage;
    // older saves may hold a mode that no longer exists
    if (!DISPLAY_MODES.some(([m]) => m === this.mode)) Settings.data.display = 'default';
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('fullscreenchange', () => {
      // left fullscreen without going through the settings: show what's on screen
      if (!this.isFullscreen && this.mode === 'fullscreen') {
        Settings.data.display = 'default';
        Settings.saveOne('display');
        if (this.onChange) this.onChange('default');
      }
      this.layout();
    });
    // a saved fullscreen needs a user gesture before the browser allows it
    const enter = () => {
      window.removeEventListener('pointerdown', enter);
      window.removeEventListener('keydown', enter);
      if (this.mode === 'fullscreen') this.enterFullscreen();
    };
    window.addEventListener('pointerdown', enter);
    window.addEventListener('keydown', enter);
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
    if (this.isFullscreen || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen().catch(() => { /* needs a gesture: retried on the next one */ });
  },

  /** Scales the 960x540 stage to fit the window, keeping 16:9. */
  layout() {
    const s = Math.min(window.innerWidth / CONFIG.screen.width, window.innerHeight / CONFIG.screen.height);
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  },
};
