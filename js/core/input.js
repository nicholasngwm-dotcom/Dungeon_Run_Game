// Keyboard + mouse state. Mouse coordinates are in game pixels (960x540, whatever the canvas resolution).
// Game code asks about actions (Input.down('up'), Input.pressed('e')), which
// go through the key bindings in Settings.
//
// While playing, the game locks the pointer and moves its own crosshair by
// the mouse's movement times Settings sensitivity; otherwise (menus) it
// follows the real cursor. The 'cursor' key switches play to free-mouse mode:
// no lock, the normal pointer instead of the crosshair. With the crosshair lock setting on, the
// locked crosshair stays a set distance from the hero and the mouse only turns it round them.
//
// On a phone the on-screen controls (Touch) stand in for both: they fill in touchHeld /
// touchPressed and the mouse (aim point and buttons), so nothing downstream can tell the difference.

const Input = {
  keys: new Set(),
  pressedKeys: new Set(),
  _mouse: { x: 480, y: 270, left: false, right: false, leftPressed: false, rightPressed: false, leftReleased: false },
  // multiplayer: while a hero updates, its networked input stands in for the real devices
  // ({ held: Set, pressed: Set, mouse }); null otherwise
  override: null,
  // the touch controls' actions: held is rebuilt every frame by Touch, pressed lasts one frame
  touchHeld: new Set(),
  touchPressed: new Set(),
  // the touch movement stick's direction, in 256ths of a turn (0 = right, 64 = down), or null
  touchMove: null,

  /** Analog movement direction in radians (a touch stick), or null: move by the direction keys. */
  moveAngle() {
    const q = this.override ? this.override.move : this.touchMove;
    return q == null ? null : (q / 256) * Math.PI * 2;
  },

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
      // typing in a text box (names, room codes, the bestiary search) isn't playing
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && e.code !== 'Escape') return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    // with the touch controls on, the browser's made-up mouse events after a tap are ignored
    window.addEventListener('mousemove', (e) => {
      if (Touch.enabled) return;
      if (this.locked) {
        const rect = canvas.getBoundingClientRect();
        const s = Settings.data.sensitivity;
        const dx = e.movementX * (CONFIG.screen.width / rect.width) * s;
        const dy = e.movementY * (CONFIG.screen.height / rect.height) * s;
        const c = this.lockCenter;
        if (Settings.data.crosshairLock > 0 && c) {
          // crosshair lock: the movement only turns the crosshair round the hero, at the set distance
          const r = Settings.data.crosshairLock;
          this.lockAngle = Math.atan2(Math.sin(this.lockAngle) * r + dy, Math.cos(this.lockAngle) * r + dx);
          this.placeLocked();
          return;
        }
        this._mouse.x = clamp(this._mouse.x + dx, 0, CONFIG.screen.width);
        this._mouse.y = clamp(this._mouse.y + dy, 0, CONFIG.screen.height);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      this._mouse.x = ((e.clientX - rect.left) / rect.width) * CONFIG.screen.width;
      this._mouse.y = ((e.clientY - rect.top) / rect.height) * CONFIG.screen.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (Touch.enabled) return;
      if (e.button === 0) { this._mouse.left = true; this._mouse.leftPressed = true; }
      if (e.button === 2) { this._mouse.right = true; this._mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (Touch.enabled) return;
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
    return this.codesFor(action).some((c) => this.keys.has(c)) || (arrows[action] && this.keys.has(arrows[action]))
      || this.touchHeld.has(action);
  },

  /** Pressed this frame. */
  pressed(action) {
    if (this.override) return this.override.pressed.has(action);
    return this.codesFor(action).some((c) => this.pressedKeys.has(c)) || this.touchPressed.has(action);
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
    this.touchPressed.delete(action);
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

  // ---------- crosshair lock (Settings crosshairLock: 0 = off, else the distance in px) ----------

  lockCenter: null,   // where the hero aims from, on screen (set every frame while playing)
  lockAngle: 0,

  /**
   * Called every frame while playing with the locked crosshair: (cx, cy) is the hero's aim point on
   * screen, or null (lock not in use). With the setting on, the crosshair stays crosshairLock px from
   * it, turning with the mouse, so it can never be lost off at the edge of the screen.
   */
  updateCrosshairLock(cx, cy) {
    const on = Settings.data.crosshairLock > 0 && cx !== null && this.locked;
    if (on && !this.lockCenter) this.lockAngle = Math.atan2(this._mouse.y - cy, this._mouse.x - cx);   // carry on from where it pointed
    this.lockCenter = on ? { x: cx, y: cy } : null;
    if (on) this.placeLocked();
  },

  placeLocked() {
    const c = this.lockCenter;
    const r = Settings.data.crosshairLock;
    this._mouse.x = clamp(c.x + Math.cos(this.lockAngle) * r, 0, CONFIG.screen.width);
    this._mouse.y = clamp(c.y + Math.sin(this.lockAngle) * r, 0, CONFIG.screen.height);
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
    this.touchPressed.clear();
    this._mouse.leftPressed = false;
    this._mouse.rightPressed = false;
    this._mouse.leftReleased = false;
  },

  reset() {
    this.keys.clear();
    this.pressedKeys.clear();
    this.touchPressed.clear();
    this._mouse.left = this._mouse.right = false;
  },
};
