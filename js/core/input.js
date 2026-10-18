// Keyboard + mouse state. Mouse coordinates are in canvas pixels (960x540).
// Game code asks about actions (Input.down('up'), Input.pressed('e')), which
// go through the key bindings in Settings.
//
// While playing, the game locks the pointer and moves its own crosshair by
// the mouse's movement times Settings sensitivity; otherwise (menus) it
// follows the real cursor.

const Input = {
  keys: new Set(),
  pressedKeys: new Set(),
  mouse: { x: 480, y: 270, left: false, right: false, leftPressed: false, rightPressed: false },
  canvas: null,
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
        this.mouse.x = clamp(this.mouse.x + e.movementX * (canvas.width / rect.width) * s, 0, canvas.width);
        this.mouse.y = clamp(this.mouse.y + e.movementY * (canvas.height / rect.height) * s, 0, canvas.height);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
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
    return this.codesFor(action).some((c) => this.keys.has(c)) || (arrows[action] && this.keys.has(arrows[action]));
  },

  /** Pressed this frame. */
  pressed(action) { return this.codesFor(action).some((c) => this.pressedKeys.has(c)); },

  /** Swallows this frame's press of an action (so a shared key doesn't trigger twice). */
  consume(action) { for (const c of this.codesFor(action)) this.pressedKeys.delete(c); },

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

  /** Call once at the end of every frame. */
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
  },

  reset() {
    this.keys.clear();
    this.pressedKeys.clear();
    this.mouse.left = this.mouse.right = false;
  },
};
