// Keyboard + mouse state. Mouse coordinates are in game pixels (960x540, whatever the canvas resolution).
// Game code asks about actions (Input.down('up'), Input.pressed('e')), which
// go through the key bindings in Settings.
//
// While playing, the game locks the pointer and moves its own crosshair by
// the mouse's movement times Settings sensitivity; otherwise (menus) it
// follows the real cursor. The 'cursor' key switches play to free-mouse mode:
// no lock, the normal pointer instead of the crosshair.

const Input = {
  keys: new Set(),
  pressedKeys: new Set(),
  _mouse: { x: 480, y: 270, left: false, right: false, leftPressed: false, rightPressed: false, leftReleased: false },
  // multiplayer: while a hero updates, its networked input stands in for the real devices
  // ({ held: Set, pressed: Set, mouse }); null otherwise
  override: null,

  get mouse() { return this.override ? this.override.mouse : this._mouse; },
  canvas: null,
  freeMouse: false,     // playing with the normal pointer instead of the locked crosshair
  onKeyCapture: null,   // settings screen waiting for a key to bind: fn(code)

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (this.onKeyCapture) {
        e.preventDefault();
        const fn = this.onKeyCapture;
        this.onKeyCapture = null;
        fn(e.code);
        return;
      }
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        const rect = canvas.getBoundingClientRect();
        const s = Settings.data.sensitivity;
        this._mouse.x = clamp(this._mouse.x + e.movementX * (CONFIG.screen.width / rect.width) * s, 0, CONFIG.screen.width);
        this._mouse.y = clamp(this._mouse.y + e.movementY * (CONFIG.screen.height / rect.height) * s, 0, CONFIG.screen.height);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      this._mouse.x = ((e.clientX - rect.left) / rect.width) * CONFIG.screen.width;
      this._mouse.y = ((e.clientY - rect.top) / rect.height) * CONFIG.screen.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this._mouse.left = true; this._mouse.leftPressed = true; }
      if (e.button === 2) { this._mouse.right = true; this._mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this._mouse.left = false; this._mouse.leftReleased = true; }
      if (e.button === 2) this._mouse.right = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  isDown(code) { return this.keys.has(code); },
  wasPressed(code) { return this.pressedKeys.has(code); },

  /** Codes that count for an action: its bound key (either side for Shift / Ctrl / Alt). */
  codesFor(action) {
    const code = Settings.keys[action];
    const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code || '');
    return m ? [`${m[1]}Left`, `${m[1]}Right`] : [code];
  },

  /** Held this frame. Movement also always works on the arrow keys. */
  down(action) {
    const arrows = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    if (this.override) return this.override.held.has(action);
    return this.codesFor(action).some((c) => this.keys.has(c)) || (arrows[action] && this.keys.has(arrows[action]));
  },

  /** Pressed this frame. */
  pressed(action) {
    if (this.override) return this.override.pressed.has(action);
    return this.codesFor(action).some((c) => this.pressedKeys.has(c));
  },

  /**
   * Swallows this frame's press of an action (so a shared key doesn't trigger twice).
   * A networked player's press also takes the actions they have on the same key
   * (E is both interact and an ability by default), as their machine reported them.
   */
  consume(action) {
    if (this.override) {
      this.override.pressed.delete(action);
      for (const a of this.override.linked?.[action] || []) this.override.pressed.delete(a);
      return;
    }
    for (const c of this.codesFor(action)) this.pressedKeys.delete(c);
  },

  /** The other actions bound to the same key as `action` on this machine. */
  sharingKeyWith(action) {
    const codes = this.codesFor(action);
    return Object.keys(Settings.keys).filter((a) => a !== action && this.codesFor(a).some((c) => codes.includes(c)));
  },

  // ---------- pointer lock (aiming with sensitivity) ----------

  get locked() { return !!this.canvas && document.pointerLockElement === this.canvas; },

  lockPointer() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* not allowed here: keep the normal cursor */ }
  },

  unlockPointer() {
    if (this.locked) document.exitPointerLock();
  },

  /** Switches between the locked crosshair and the free mouse pointer. Returns true if now free. */
  toggleFreeMouse() {
    this.freeMouse = !this.freeMouse;   // set first: losing the lock below must not pause
    if (this.freeMouse) this.unlockPointer();
    else this.lockPointer();            // if the browser refuses, the next click locks
    return this.freeMouse;
  },

  /** Call once at the end of every frame. */
  endFrame() {
    this.pressedKeys.clear();
    this._mouse.leftPressed = false;
    this._mouse.rightPressed = false;
    this._mouse.leftReleased = false;
  },

  reset() {
    this.keys.clear();
    this.pressedKeys.clear();
    this._mouse.left = this._mouse.right = false;
  },
};
