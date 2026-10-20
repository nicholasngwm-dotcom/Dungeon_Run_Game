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
    document.getElementById('dialog-name').textContent = opts.name;
    document.getElementById('dialog-options').innerHTML = '';
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

  /** Shows the whole line and the choices. */
  finish() {
    clearInterval(this.timer);
    this.timer = null;
    this.shown = this.full.length;
    document.getElementById('dialog-text').textContent = this.full;
    const box = document.getElementById('dialog-options');
    if (!box.children.length) {
      box.innerHTML = this.options.map((o, i) => `<button class="btn small" data-action="dialogOption:${i}">${o.label}</button>`).join('');
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
