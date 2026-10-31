// NPC dialogue box: a portrait, a name, text that types itself out, and a
// list of choices. Click the text (or press the interact key) to finish
// typing early. The game is frozen while it's open (App panel state).

const Dialog = {
  npc: null,         // { name, frames }
  options: [],
  full: '',
  shown: 0,
  timer: null,

  /** opts: { name, frames (sprite frames for the portrait), text, options: [{ label, fn }] } */
  open(opts) {
    this.npc = opts;
    this.options = opts.options;
    this.full = opts.text;
    this.shown = 0;
    this.selected = 0;   // PC: the highlighted choice (W / S or the mouse move it, E picks it)
    document.getElementById('dialog-name').textContent = opts.name;
    document.getElementById('dialog-options').innerHTML = '';
    document.getElementById('dialog-more').classList.remove('hidden');
    document.getElementById('dialog-keys').textContent = `[${Settings.label('interact')}] skip   [Esc] leave`;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.type(), 28);
    Menus.show('dialog');
    this.type();
  },

  get isOpen() { return !document.getElementById('screen-dialog').classList.contains('hidden'); },

  /** One more letter (a soft blip every few letters). */
  type() {
    if (this.shown >= this.full.length) return this.finish();
    this.shown++;
    if (this.shown % 3 === 0) Sound.play('talk', 0.02);
    document.getElementById('dialog-text').textContent = this.full.slice(0, this.shown);
  },

  /** Shows the whole line and the choices (on PC a numbered list, the highlighted one marked). */
  finish() {
    clearInterval(this.timer);
    this.timer = null;
    this.shown = this.full.length;
    document.getElementById('dialog-text').textContent = this.full;
    document.getElementById('dialog-more').classList.add('hidden');
    const box = document.getElementById('dialog-options');
    if (!box.children.length) {
      box.innerHTML = this.options.map((o, i) => `<button class="btn small" data-action="dialogOption:${i}" data-index="${i}"><em class="dialog-num">${i + 1}</em>${o.label}</button>`).join('');
      // the mouse moves the highlight too
      for (const b of box.children) b.addEventListener('mouseenter', () => this.select(Number(b.dataset.index)));
      this.select(this.selected);
      const n = this.options.length;
      document.getElementById('dialog-keys').textContent = `[1${n > 1 ? `-${n}` : ''}] choose   [W/S] move   [${Settings.label('interact')}] pick   [Esc] leave`;
    }
  },

  /** PC: highlights choice i. */
  select(i) {
    const box = document.getElementById('dialog-options');
    this.selected = clamp(i, 0, Math.max(0, this.options.length - 1));
    [...box.children].forEach((b, k) => b.classList.toggle('selected', k === this.selected));
  },

  /**
   * PC keys while it's open (App.frame): the interact key finishes the line, then picks the highlighted
   * choice; W / S (or the arrows) move the highlight; 1-9 pick a choice straight away.
   */
  keys() {
    if (Input.pressed('interact')) {
      if (this.shown < this.full.length) this.finish();
      else if (!Touch.enabled) this.choose(this.selected);   // (phones pick with the buttons, as before)
      return;
    }
    if (this.shown < this.full.length || Touch.enabled) return;
    const n = this.options.length;
    if (Input.pressed('up') || Input.wasPressed('ArrowUp')) { this.select((this.selected + n - 1) % n); Sound.play('uiHover', 0.05); }
    if (Input.pressed('down') || Input.wasPressed('ArrowDown')) { this.select((this.selected + 1) % n); Sound.play('uiHover', 0.05); }
    for (let i = 0; i < Math.min(9, n); i++) {
      if (Input.wasPressed(`Digit${i + 1}`) || Input.wasPressed(`Numpad${i + 1}`)) {
        Sound.play('uiClick');
        this.choose(i);
        return;
      }
    }
  },

  choose(i) {
    const o = this.options[i];
    if (o) o.fn();
  },

  close() {
    clearInterval(this.timer);
    App.closePanel();
  },

  /** The portrait: the NPC's idle animation, scaled up. */
  drawPortrait(time) {
    if (!this.isOpen || !this.npc) return;
    const canvas = document.getElementById('dialog-portrait');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const frames = this.npc.frames.idle;
    const frame = frames[Math.floor(time * CUTE.fps.idle) % frames.length].img;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // head and shoulders: crop the top of the 64px sprite and scale it up
    ctx.drawImage(frame, 12, 2, 40, 40, 0, 0, canvas.width, canvas.height);
  },
};
