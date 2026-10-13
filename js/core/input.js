// Keyboard + mouse state. Mouse coordinates are in canvas pixels (960x540).

const Input = {
  keys: new Set(),
  pressedKeys: new Set(),
  mouse: { x: 480, y: 270, left: false, right: false, leftPressed: false, rightPressed: false },

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    window.addEventListener('mousemove', (e) => {
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
