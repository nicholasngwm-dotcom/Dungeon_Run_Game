// Retro sound effects and music, synthesized with the Web Audio API.
// No audio files needed: every sound is built from oscillators + noise.

const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuffer: null,
  lastPlayed: {},
  get musicEnabled() { return Settings.data.music; },

  /** Must be called from a user gesture (browser autoplay rules). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.applyVolumes();
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = nativeRandom() * 2 - 1;
    this.initRich();
  },

  /**
   * The richer effects' tools (the heroes' attacks): brown noise for roars and rumbles,
   * a reverb the sounds can send into for a sense of space, and soft-clip curves for
   * crunchy cracks. Built once, when the audio starts.
   */
  initRich() {
    const c = this.ctx;
    const len = c.sampleRate * 2;
    this.brownBuffer = c.createBuffer(1, len, c.sampleRate);
    const b = this.brownBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (nativeRandom() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }
    // a hall-ish reverb: two channels of noise dying away over 1.8 seconds
    const irLen = Math.floor(c.sampleRate * 1.8);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (nativeRandom() * 2 - 1) * Math.pow(1 - i / irLen, 3.5);
    }
    this.verb = c.createConvolver();
    this.verb.buffer = ir;
    this.verbSend = c.createGain();
    this.verbSend.gain.value = 0.5;
    this.verbSend.connect(this.verb);
    this.verb.connect(this.sfxBus);
    this.curves = {};
  },

  /** A soft-clipping curve (more drive = more crunch), cached by drive. */
  driveCurve(drive) {
    if (this.curves[drive]) return this.curves[drive];
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    return (this.curves[drive] = curve);
  },

  /** x nudged by up to +-amt of itself (each play comes out a little different). */
  vary(x, amt = 0.08) { return x * (1 + (nativeRandom() * 2 - 1) * amt); },

  /**
   * One layer of a rich sound: a source (white 'noise', 'brown' noise or an oscillator
   * type) gliding from freq to `to`, optionally through a filter sweeping ffreq -> fto and
   * a drive, shaped by a swell (attack) and an exponential fade over dur. wet sends it
   * into the reverb; vib wobbles an oscillator's pitch by vib Hz at vibRate.
   */
  layer({ src = 'noise', freq = 440, to = null, glide = null, dur = 0.2, attack = 0.005, vol = 0.2, delay = 0,
    filter = null, ffreq = 1000, fto = null, fglide = null, q = 1, drive = 0, wet = 0, vib = 0, vibRate = 6, rate = 1 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const end = t + dur;
    let node;
    if (src === 'noise' || src === 'brown') {
      const s = c.createBufferSource();
      s.buffer = src === 'brown' ? this.brownBuffer : this.noiseBuffer;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(t, nativeRandom() * 0.5);
      s.stop(end + 0.05);
      node = s;
    } else {
      const o = c.createOscillator();
      o.type = src;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + (glide ?? dur));
      if (vib) {
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = vibRate;
        depth.gain.value = vib;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(t);
        lfo.stop(end + 0.05);
      }
      o.start(t);
      o.stop(end + 0.05);
      node = o;
    }
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter;
      f.Q.value = q;
      f.frequency.setValueAtTime(ffreq, t);
      if (fto) f.frequency.exponentialRampToValueAtTime(Math.max(fto, 20), t + (fglide ?? dur));
      node.connect(f);
      node = f;
    }
    if (drive) {
      const w = c.createWaveShaper();
      w.curve = this.driveCurve(drive);
      node.connect(w);
      node = w;
    }
    const g = c.createGain();
    const peak = Math.min(attack, dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.max(0.002, peak));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    node.connect(g);
    g.connect(this.sfxBus);
    if (wet) {
      const send = c.createGain();
      send.gain.value = wet;
      g.connect(send).connect(this.verbSend);
    }
  },

  /**
   * Crackle: a spray of tiny random clicks (fire, electricity, ice). rate clicks a second
   * for dur, filtered round freq; grow > 0 makes them come thicker toward the end.
   */
  crackle({ dur = 0.5, rate = 60, vol = 0.2, delay = 0, freq = 3000, filter = 'highpass', wet = 0, grow = 0 } = {}) {
    const n = Math.round(rate * dur);
    for (let i = 0; i < n; i++) {
      const k = nativeRandom();
      const at = delay + dur * (grow ? Math.pow(k, 1 / (1 + grow)) : k);
      this.layer({ src: 'noise', dur: 0.004 + nativeRandom() * 0.012, attack: 0.001, vol: vol * (0.3 + nativeRandom() * 0.7), delay: at,
        filter, ffreq: freq * (0.6 + nativeRandom() * 0.9), q: 0.8, wet });
    }
  },

  /** A struck blade or bell: inharmonic partials that ring and die away (metal: true) or harmonic ones (a chime). */
  ring({ freq = 2000, dur = 0.5, vol = 0.05, delay = 0, wet = 0.2, metal = true } = {}) {
    const ratios = metal ? [1, 2.32, 4.25, 6.63] : [1, 2, 3, 4.01];
    ratios.forEach((r, i) => this.layer({ src: 'sine', freq: freq * r, dur: dur / (1 + i * 0.6), attack: 0.002, vol: vol / (1 + i * 0.9), delay, wet }));
  },

  /** A whoosh: noise through a resonant band sweeping from -> to, swelling up then away. */
  whoosh({ from = 500, to = 3000, dur = 0.2, vol = 0.3, delay = 0, q = 1.2, swell = 0.45, wet = 0.05 } = {}) {
    this.layer({ src: 'noise', dur, attack: dur * swell, vol, delay, filter: 'bandpass', ffreq: from, fto: to, q, wet });
  },

  /** Music / SFX loudness from Settings (music muted when toggled off). */
  applyVolumes() {
    if (!this.ctx) return;
    const s = Settings.data;
    this.musicBus.gain.value = s.music ? 0.3 * s.musicVolume : 0;
    this.sfxBus.gain.value = s.sfxVolume;
  },

  /** A single oscillator blip with a pitch slide. */
  tone({ type = 'square', freq = 440, to = null, dur = 0.1, vol = 0.15, delay = 0, bus = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /** Filtered white noise burst (hits, explosions, whooshes). */
  noise({ dur = 0.1, vol = 0.2, filter = 'lowpass', freq = 1200, to = null, delay = 0, q = 1, bus = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(bus || this.sfxBus);
    src.start(t, nativeRandom() * 0.5);
    src.stop(t + dur + 0.02);
  },

  /** Play a named effect from SFX. Rapid repeats of the same sound are throttled. */
  play(name, minGap = 0.03) {
    if (!this.ctx || !SFX[name]) return;
    const now = this.ctx.currentTime;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
    this.lastPlayed[name] = now;
    SFX[name](this);
  },
};

const SFX = {
  // --- UI ---
  uiHover: (s) => s.tone({ freq: 660, dur: 0.04, vol: 0.05 }),
  coin: (s) => { s.tone({ type: 'square', freq: 1320, dur: 0.05, vol: 0.06 }); s.tone({ type: 'square', freq: 1760, dur: 0.08, vol: 0.06, delay: 0.05 }); },
  chestOpen: (s) => { s.noise({ dur: 0.15, vol: 0.15, filter: 'lowpass', freq: 800 }); [784, 988, 1175, 1568].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.1, delay: 0.1 + i * 0.07 })); },
  buy: (s) => { [880, 1320].forEach((f, i) => s.tone({ type: 'square', freq: f, dur: 0.08, vol: 0.07, delay: i * 0.06 })); },
  talk: (s) => s.tone({ type: 'triangle', freq: 520 + nativeRandom() * 160, dur: 0.03, vol: 0.04 }),
  uiClick: (s) => { s.tone({ freq: 520, to: 900, dur: 0.08, vol: 0.1 }); },
  denied: (s) => s.tone({ type: 'square', freq: 140, dur: 0.1, vol: 0.08 }),

  // --- Knight ---
  slash: (s) => {
    s.noise({ dur: 0.13, vol: 0.28, filter: 'bandpass', freq: 3000, to: 700, q: 2 });
    s.tone({ freq: 500, to: 180, dur: 0.08, vol: 0.05 });
  },
  thrustCharge: (s) => s.tone({ type: 'sawtooth', freq: 180, to: 420, dur: 0.2, vol: 0.07 }),
  thrust: (s) => {
    s.noise({ dur: 0.22, vol: 0.35, filter: 'bandpass', freq: 1800, to: 300, q: 1.5 });
    s.tone({ type: 'square', freq: 220, to: 60, dur: 0.2, vol: 0.12 });
  },

  // --- Archer ---
  arrow: (s) => {
    s.tone({ type: 'triangle', freq: 900, to: 300, dur: 0.1, vol: 0.18 });
    s.noise({ dur: 0.07, vol: 0.12, filter: 'highpass', freq: 3000 });
  },
  aim: (s) => s.tone({ type: 'triangle', freq: 600, to: 800, dur: 0.06, vol: 0.08 }),
  volley: (s) => {
    for (let i = 0; i < 5; i++) s.tone({ type: 'triangle', freq: 1000 - i * 80, to: 300, dur: 0.1, vol: 0.1, delay: i * 0.05 });
  },
  arrowRain: (s) => s.noise({ dur: 0.06, vol: 0.12, filter: 'bandpass', freq: 2200, q: 3 }),

  // --- Mage ---
  // a spell going off: a shimmering rise with sparkles twinkling over it
  magic: (s) => {
    const p = s.vary(1, 0.06);
    s.layer({ src: 'sine', freq: 740 * p, to: 1480 * p, dur: 0.3, attack: 0.02, vol: 0.08, vib: 30, vibRate: 18, wet: 0.4 });
    [1976, 2637, 3136].forEach((f, i) => s.layer({ src: 'sine', freq: f * p, dur: 0.25, vol: 0.025, delay: 0.03 + i * 0.035, wet: 0.5 }));
    s.layer({ src: 'noise', dur: 0.25, attack: 0.05, vol: 0.05, filter: 'highpass', ffreq: 7500, wet: 0.4 });
  },
  fireballCast: (s) => {
    s.noise({ dur: 0.3, vol: 0.2, filter: 'lowpass', freq: 600, to: 2000 });
    s.tone({ type: 'sawtooth', freq: 120, to: 300, dur: 0.25, vol: 0.08 });
  },
  explosion: (s) => {
    s.noise({ dur: 0.5, vol: 0.5, filter: 'lowpass', freq: 1400, to: 80 });
    s.tone({ type: 'square', freq: 120, to: 30, dur: 0.35, vol: 0.18 });
  },

  // --- Baker ---
  // a cake lobbed: a soft whoosh
  cakeThrow: (s) => s.whoosh({ from: 300, to: s.vary(1400), dur: 0.16, vol: 0.22, q: 0.9, swell: 0.4 }),
  // SPLAT: a wet slap and a squelch
  cakeSplat: (s) => {
    const p = s.vary(1, 0.12);
    s.layer({ src: 'noise', dur: 0.12, vol: 0.3, filter: 'lowpass', ffreq: 1800 * p, fto: 300 });
    s.layer({ src: 'sine', freq: 260 * p, to: 70, dur: 0.14, vol: 0.25 });
    s.layer({ src: 'sine', freq: 520 * p, to: 180, dur: 0.1, vol: 0.08, delay: 0.06, vib: 40, vibRate: 30 });
  },
  // flour bursting out: a big soft poof
  flourPoof: (s) => {
    s.layer({ src: 'noise', dur: 0.5, attack: 0.02, vol: 0.32, filter: 'lowpass', ffreq: 900, fto: 200, wet: 0.3 });
    s.layer({ src: 'noise', dur: 0.25, vol: 0.08, filter: 'highpass', ffreq: 3000 });
  },
  // pastries ready: a cheerful little bell
  pastryReady: (s) => [1568, 2093].forEach((f, i) => s.layer({ src: 'sine', freq: f, dur: 0.3, vol: 0.06, delay: i * 0.08, wet: 0.3 })),
  // pastries tossed: a flurry of soft whooshes
  pastryToss: (s) => [0, 0.06, 0.12, 0.18].forEach((d) => s.whoosh({ from: 500, to: s.vary(1800), dur: 0.12, vol: 0.12, delay: d })),
  // a pastry eaten: a crunchy nom and a sparkle
  pastryEat: (s) => {
    s.layer({ src: 'noise', dur: 0.06, vol: 0.2, filter: 'bandpass', ffreq: 2400, q: 2 });
    s.layer({ src: 'noise', dur: 0.06, vol: 0.16, delay: 0.09, filter: 'bandpass', ffreq: 2000, q: 2 });
    [1319, 1760, 2637].forEach((f, i) => s.layer({ src: 'sine', freq: f, dur: 0.2, vol: 0.05, delay: 0.15 + i * 0.05, wet: 0.3 }));
  },
  // the oven set down: a heavy clank and the door rattling
  ovenPlace: (s) => {
    s.layer({ src: 'sine', freq: 110, to: 50, dur: 0.18, vol: 0.35 });
    s.ring({ freq: 900, dur: 0.3, vol: 0.05, delay: 0.02 });
    s.layer({ src: 'square', freq: 180, to: 120, dur: 0.05, vol: 0.05, delay: 0.12, filter: 'lowpass', ffreq: 1000 });
  },
  // a shot clanging off the oven
  ovenHit: (s) => s.ring({ freq: s.vary(1200), dur: 0.2, vol: 0.06 }),
  // the oven's fuse ticking down: a kitchen-timer tick
  ovenTick: (s) => s.layer({ src: 'square', freq: 2400, dur: 0.025, vol: 0.04, filter: 'highpass', ffreq: 1500 }),
  // put away quietly: a kitchen-timer ding
  ovenDing: (s) => s.ring({ freq: 2093, dur: 0.6, vol: 0.08, wet: 0.3 }),
  // the oven blowing up
  ovenBoom: (s) => {
    s.layer({ src: 'brown', dur: 0.9, vol: 0.6, filter: 'lowpass', ffreq: 1600, fto: 70, wet: 0.35 });
    s.layer({ src: 'sine', freq: 90, to: 28, dur: 0.6, vol: 0.4 });
    s.ring({ freq: 700, dur: 0.6, vol: 0.06, delay: 0.05 });
    s.ring({ freq: 2093, dur: 0.5, vol: 0.05, delay: 0.25 });
  },
  // the mega cake coming down: a long falling whistle
  megaCakeFall: (s) => s.layer({ src: 'sine', freq: 2200, to: 500, dur: 1.1, attack: 0.1, vol: 0.08, wet: 0.2 }),
  // SQUASH: an enormous soft thud and a wobble
  megaCakeSlam: (s) => {
    s.layer({ src: 'brown', dur: 0.8, vol: 0.7, filter: 'lowpass', ffreq: 700, fto: 50, wet: 0.4 });
    s.layer({ src: 'sine', freq: 70, to: 25, dur: 0.7, vol: 0.5 });
    s.layer({ src: 'sine', freq: 180, to: 140, dur: 0.6, vol: 0.12, delay: 0.1, vib: 30, vibRate: 12 });
    s.layer({ src: 'noise', dur: 0.25, vol: 0.25, filter: 'lowpass', ffreq: 1500, fto: 300 });
  },

  // --- Rocketeer ---
  // a rocket leaving the tube: a hollow thump and a hissing rush away
  rocketLaunch: (s) => {
    const p = s.vary(1, 0.08);
    s.layer({ src: 'sine', freq: 140 * p, to: 50, dur: 0.14, vol: 0.3 });
    s.layer({ src: 'noise', dur: 0.32, attack: 0.02, vol: 0.22, filter: 'bandpass', ffreq: 900 * p, fto: 3600, q: 0.8, wet: 0.15 });
    s.layer({ src: 'noise', dur: 0.08, vol: 0.12, filter: 'highpass', ffreq: 5000 });
  },
  // its blast: a crack, a deep boom and debris rattling down
  rocketBoom: (s) => {
    const p = s.vary(1, 0.1);
    s.layer({ src: 'noise', dur: 0.08, vol: 0.35, filter: 'highpass', ffreq: 2500, drive: 3 });
    s.layer({ src: 'brown', dur: 0.6, attack: 0.005, vol: 0.55, filter: 'lowpass', ffreq: 1600 * p, fto: 90, wet: 0.3 });
    s.layer({ src: 'sine', freq: 90 * p, to: 32, dur: 0.45, vol: 0.4 });
    s.layer({ src: 'noise', dur: 0.3, vol: 0.05, delay: 0.12, filter: 'bandpass', ffreq: 3000, q: 2 });
  },
  // a rocket slid into the launcher: a metal clunk and a click
  rocketReload: (s) => {
    s.layer({ src: 'square', freq: 220, to: 140, dur: 0.05, vol: 0.06, filter: 'lowpass', ffreq: 1200 });
    s.layer({ src: 'noise', dur: 0.03, vol: 0.12, delay: 0.07, filter: 'highpass', ffreq: 4000 });
    s.ring({ freq: 1800, dur: 0.12, vol: 0.02, delay: 0.07 });
  },
  // winding up the rocket jump: a rising whine
  jumpCharge: (s) => {
    s.layer({ src: 'sawtooth', freq: 160, to: 520, dur: 0.8, attack: 0.1, vol: 0.05, filter: 'lowpass', ffreq: 900, fto: 2400 });
  },
  // the rocket jump: a boom underfoot and the whoosh of him flying off
  rocketJump: (s) => {
    s.layer({ src: 'brown', dur: 0.45, vol: 0.45, filter: 'lowpass', ffreq: 1400, fto: 100, wet: 0.2 });
    s.layer({ src: 'sine', freq: 110, to: 40, dur: 0.3, vol: 0.35 });
    s.whoosh({ from: 400, to: 2600, dur: 0.4, vol: 0.3, q: 1, swell: 0.5 });
  },
  // the ammo pack dropped and torn open: a thud, then rockets clacking in
  ammoPack: (s) => {
    s.layer({ src: 'sine', freq: 120, to: 60, dur: 0.12, vol: 0.3 });
    [0.1, 0.17, 0.24, 0.31].forEach((d) => s.layer({ src: 'square', freq: 260, to: 150, dur: 0.04, vol: 0.05, delay: d, filter: 'lowpass', ffreq: 1400 }));
    s.ring({ freq: 1400, dur: 0.2, vol: 0.03, delay: 0.33 });
  },
  // the IBFR lighting up: a long, unsteady roar
  ibfrLaunch: (s) => {
    s.layer({ src: 'brown', dur: 1.4, attack: 0.1, vol: 0.5, filter: 'lowpass', ffreq: 500, fto: 1400, wet: 0.3 });
    s.layer({ src: 'sawtooth', freq: 70, to: 140, dur: 1.2, vol: 0.08, vib: 12, vibRate: 9, filter: 'lowpass', ffreq: 600 });
    s.layer({ src: 'noise', dur: 1.2, attack: 0.2, vol: 0.12, filter: 'bandpass', ffreq: 1800, q: 0.7 });
  },
  // the IBFR going off: an enormous boom rolling round the room
  ibfrBoom: (s) => {
    s.layer({ src: 'noise', dur: 0.15, vol: 0.45, filter: 'highpass', ffreq: 1800, drive: 4 });
    s.layer({ src: 'brown', dur: 2, attack: 0.01, vol: 0.8, filter: 'lowpass', ffreq: 2000, fto: 50, wet: 0.5, drive: 2 });
    s.layer({ src: 'sine', freq: 70, to: 22, dur: 1.4, vol: 0.55 });
    s.layer({ src: 'noise', dur: 1, vol: 0.08, delay: 0.3, filter: 'bandpass', ffreq: 2500, q: 1.5, wet: 0.4 });
  },

  // --- Rogue ---
  dagger: (s) => s.noise({ dur: 0.06, vol: 0.18, filter: 'highpass', freq: 4000, to: 2000 }),
  dash: (s) => {
    s.noise({ dur: 0.2, vol: 0.25, filter: 'bandpass', freq: 600, to: 3000, q: 1 });
    s.tone({ type: 'square', freq: 300, to: 900, dur: 0.12, vol: 0.06 });
  },

  // --- Hero attacks: each ability its own sound ---
  // Built from layered noise, rings and crackle with a touch of reverb (see Sound.layer),
  // and every play varies a little, so repeated attacks don't sound like the same clip.

  // Knight
  // a sword cut: the blade whistling through the air, then a steel "shing" ringing after it
  swordSwing: (s) => {
    const p = s.vary(1, 0.1);
    s.whoosh({ from: 350 * p, to: 3200 * p, dur: 0.17, vol: 0.4, q: 1.4, swell: 0.55 });
    s.layer({ src: 'noise', dur: 0.12, attack: 0.07, vol: 0.09, filter: 'highpass', ffreq: 6000 });
    s.ring({ freq: s.vary(2600), dur: 0.45, vol: 0.035, delay: 0.07, wet: 0.25 });
  },
  // the finishing stab: a short hard thrust and the point biting home
  swordStab: (s) => {
    s.whoosh({ from: 900, to: s.vary(5200), dur: 0.11, vol: 0.38, q: 2, swell: 0.7 });
    s.ring({ freq: s.vary(3300), dur: 0.3, vol: 0.04, delay: 0.06, wet: 0.2 });
    s.layer({ src: 'sine', freq: 160, to: 55, dur: 0.14, vol: 0.22, delay: 0.08 });
    s.layer({ src: 'brown', dur: 0.12, vol: 0.25, delay: 0.08, filter: 'lowpass', ffreq: 700 });
  },
  // raising the shield: steel lifted with a scrape, and the barrier humming up round it
  shieldRaise: (s) => {
    s.layer({ src: 'noise', dur: 0.14, attack: 0.05, vol: 0.12, filter: 'bandpass', ffreq: 2500, fto: 4500, q: 6 });
    s.layer({ src: 'sine', freq: 220, to: 330, dur: 0.5, attack: 0.08, vol: 0.09, vib: 6, vibRate: 9, wet: 0.3 });
    s.layer({ src: 'triangle', freq: 660, to: 990, dur: 0.4, attack: 0.1, vol: 0.03, wet: 0.4 });
  },
  // the shield bash: a heavy body-blow of steel, dull and booming
  shieldBash: (s) => {
    s.layer({ src: 'brown', dur: 0.35, vol: 0.6, filter: 'lowpass', ffreq: 900, fto: 150 });
    s.layer({ src: 'sine', freq: s.vary(120), to: 45, dur: 0.3, vol: 0.4 });
    s.ring({ freq: s.vary(780), dur: 0.5, vol: 0.06, wet: 0.25 });
    s.layer({ src: 'noise', dur: 0.03, vol: 0.4, filter: 'highpass', ffreq: 2500 });
  },
  // the whirlwind winding up: a long rising whoosh with a blade's ring at its peak
  whirlwindStart: (s) => {
    s.whoosh({ from: 250, to: 2800, dur: 0.45, vol: 0.35, q: 1, swell: 0.8 });
    s.ring({ freq: s.vary(2100), dur: 0.5, vol: 0.03, delay: 0.35, wet: 0.3 });
  },
  // each turn of the whirlwind: the blade sweeping past and away (rising, then falling)
  whirlwindSpin: (s) => {
    const p = s.vary(1, 0.12);
    s.whoosh({ from: 500 * p, to: 2600 * p, dur: 0.14, vol: 0.32, q: 1.5, swell: 0.8 });
    s.whoosh({ from: 2600 * p, to: 700 * p, dur: 0.16, vol: 0.22, q: 1.5, swell: 0.1, delay: 0.12 });
  },
  // bracing for the charge: armour jangling and a growl of effort
  chargeWindup: (s) => {
    for (let i = 0; i < 5; i++) s.ring({ freq: s.vary(3400, 0.25), dur: 0.09, vol: 0.02, delay: i * 0.035 + nativeRandom() * 0.02, wet: 0.1 });
    s.layer({ src: 'sawtooth', freq: 90, to: 140, dur: 0.35, attack: 0.1, vol: 0.08, filter: 'lowpass', ffreq: 500 });
  },
  // the charge: a rush of wind, heavy armoured footfalls and jangling plate
  chargeRush: (s) => {
    s.layer({ src: 'brown', dur: 0.55, attack: 0.08, vol: 0.45, filter: 'lowpass', ffreq: 400, fto: 1600 });
    s.whoosh({ from: 600, to: 2400, dur: 0.4, vol: 0.18, q: 0.8, swell: 0.3 });
    for (let i = 0; i < 3; i++) {
      s.layer({ src: 'sine', freq: 95, to: 40, dur: 0.12, vol: 0.35, delay: i * 0.12 });
      s.ring({ freq: s.vary(3200, 0.2), dur: 0.08, vol: 0.02, delay: i * 0.12 + 0.02, wet: 0 });
    }
  },
  // World Cutter gathering: a deep drone swelling, power humming in the steel
  worldCutterCharge: (s) => {
    s.layer({ src: 'sawtooth', freq: 55, to: 110, dur: 1.1, attack: 0.8, vol: 0.18, filter: 'lowpass', ffreq: 250, fto: 1800, vib: 3, vibRate: 7 });
    s.layer({ src: 'sine', freq: 880, to: 1760, dur: 1.0, attack: 0.9, vol: 0.04, vib: 12, vibRate: 11, wet: 0.5 });
    s.layer({ src: 'noise', dur: 1.0, attack: 0.9, vol: 0.08, filter: 'bandpass', ffreq: 400, fto: 4000, q: 2, wet: 0.3 });
  },
  // World Cutter: one colossal slice through the air, the steel ringing, the ground splitting
  worldCutter: (s) => {
    s.whoosh({ from: 180, to: 5000, dur: 0.32, vol: 0.55, q: 0.9, swell: 0.5, wet: 0.2 });
    s.ring({ freq: s.vary(1500), dur: 1.2, vol: 0.06, delay: 0.18, wet: 0.5 });
    s.layer({ src: 'brown', dur: 1.4, vol: 0.75, delay: 0.16, filter: 'lowpass', ffreq: 500, fto: 60, wet: 0.4 });
    s.layer({ src: 'sine', freq: 60, to: 26, dur: 1.0, vol: 0.55, delay: 0.16 });
    s.crackle({ dur: 0.7, rate: 70, vol: 0.18, delay: 0.2, freq: 1500, filter: 'bandpass' });
  },
  // a blow turned aside by the shield: a bright, ringing clang
  blockClang: (s) => {
    s.layer({ src: 'noise', dur: 0.03, vol: 0.45, filter: 'highpass', ffreq: 3000 });
    s.ring({ freq: s.vary(1450), dur: 0.7, vol: 0.09, wet: 0.35 });
    s.layer({ src: 'brown', dur: 0.12, vol: 0.3, filter: 'lowpass', ffreq: 800 });
  },
  // a shot hitting the magic barrier: a soft, humming "wub" of force
  barrierHit: (s) => {
    s.layer({ src: 'sine', freq: s.vary(460), to: 300, dur: 0.22, vol: 0.14, vib: 25, vibRate: 30, wet: 0.2 });
    s.layer({ src: 'noise', dur: 0.08, vol: 0.12, filter: 'bandpass', ffreq: 1800, q: 3 });
  },
  // the barrier giving way: a sheet of magic glass shattering
  barrierBreak: (s) => {
    for (let i = 0; i < 12; i++) s.ring({ freq: 2200 + nativeRandom() * 4500, dur: 0.15 + nativeRandom() * 0.35, vol: 0.025, delay: nativeRandom() * 0.25, wet: 0.3 });
    s.layer({ src: 'noise', dur: 0.5, vol: 0.35, filter: 'highpass', ffreq: 3000, fto: 1200 });
    s.layer({ src: 'brown', dur: 0.3, vol: 0.4, filter: 'lowpass', ffreq: 600 });
    s.layer({ src: 'sine', freq: 600, to: 150, dur: 0.4, vol: 0.08, wet: 0.3 });
  },

  // Ranger
  // loosing an arrow: the bowstring's twang (a resonant pluck) and the arrow hissing away
  bowShot: (s) => {
    const p = s.vary(1, 0.06);
    s.layer({ src: 'sawtooth', freq: 140 * p, to: 115 * p, dur: 0.2, vol: 0.18, filter: 'lowpass', ffreq: 2400, fto: 300, q: 9 });
    s.layer({ src: 'triangle', freq: 280 * p, to: 230 * p, dur: 0.12, vol: 0.08 });
    s.whoosh({ from: 2500, to: 6500, dur: 0.12, vol: 0.14, q: 2, swell: 0.3, delay: 0.015 });
  },
  // a heavy elemental arrow: a deeper, fuller twang
  bowShotHeavy: (s) => {
    s.layer({ src: 'sawtooth', freq: s.vary(105), to: 80, dur: 0.28, vol: 0.22, filter: 'lowpass', ffreq: 2000, fto: 220, q: 10 });
    s.layer({ src: 'triangle', freq: 210, to: 160, dur: 0.18, vol: 0.1 });
    s.whoosh({ from: 1800, to: 5000, dur: 0.18, vol: 0.18, q: 1.5, swell: 0.3, delay: 0.02 });
  },
  // swift camo: a shimmer of light bending away, fading into a hush
  camo: (s) => {
    [1760, 1320, 990, 740].forEach((f, i) => s.layer({ src: 'sine', freq: f, to: f * 0.7, dur: 0.4, vol: 0.035, delay: i * 0.05, vib: 8, wet: 0.5 }));
    s.layer({ src: 'noise', dur: 0.5, attack: 0.05, vol: 0.12, filter: 'highpass', ffreq: 7000, fto: 2500, wet: 0.3 });
  },
  // rapid fire: the bow creaking under a quick double draw
  rapidFire: (s) => {
    for (const d of [0, 0.1]) s.layer({ src: 'noise', dur: 0.09, attack: 0.04, vol: 0.18, filter: 'bandpass', ffreq: s.vary(700), fto: 1100, q: 14, delay: d });
    s.layer({ src: 'noise', dur: 0.02, vol: 0.2, filter: 'highpass', ffreq: 3000, delay: 0.2 });
  },
  // the fire arrow loosed: it bursts alight with a "fwoomp", roaring and crackling as it flies
  fireArrow: (s) => {
    s.layer({ src: 'brown', dur: 0.6, attack: 0.07, vol: 0.55, filter: 'lowpass', ffreq: 300, fto: 1800, wet: 0.15 });
    s.layer({ src: 'noise', dur: 0.55, attack: 0.12, vol: 0.12, filter: 'bandpass', ffreq: 900, fto: 2200, q: 0.7 });
    s.crackle({ dur: 0.7, rate: 70, vol: 0.22, freq: 2400, delay: 0.05 });
  },
  // embers flung off a burning blade: a quick fiery whoosh and a few crackles
  emberFlick: (s) => {
    s.layer({ src: 'noise', dur: 0.22, attack: 0.04, vol: 0.18, filter: 'bandpass', ffreq: 700, fto: 2200, q: 0.8 });
    s.crackle({ dur: 0.3, rate: 40, vol: 0.12, freq: 2600 });
  },
  // the fire arrow landing: a whump of flame, crackling, and a sizzle
  fireImpact: (s) => {
    s.layer({ src: 'brown', dur: 0.5, vol: 0.55, filter: 'lowpass', ffreq: 1100, fto: 200 });
    s.crackle({ dur: 0.9, rate: 55, vol: 0.2, freq: 2200 });
    s.layer({ src: 'noise', dur: 0.6, attack: 0.1, vol: 0.06, filter: 'highpass', ffreq: 5000 });
  },
  // the ice arrow loosed: frost hissing off it and ice creaking and tinkling as it freezes
  iceArrow: (s) => {
    s.layer({ src: 'noise', dur: 0.5, attack: 0.1, vol: 0.14, filter: 'highpass', ffreq: 7000, fto: 4000, wet: 0.3 });
    s.layer({ src: 'sawtooth', freq: 300, to: 900, dur: 0.3, attack: 0.05, vol: 0.05, filter: 'bandpass', ffreq: 1200, fto: 2400, q: 12 });
    for (let i = 0; i < 6; i++) s.ring({ freq: 3000 + nativeRandom() * 3500, dur: 0.12, vol: 0.018, delay: 0.05 + nativeRandom() * 0.35, metal: false, wet: 0.4 });
  },
  // the ice arrow bursting: a sharp crack, ice spikes shattering up, a long freezing hiss
  iceBurst: (s) => {
    s.layer({ src: 'noise', dur: 0.06, vol: 0.5, filter: 'highpass', ffreq: 2000, drive: 4 });
    s.crackle({ dur: 0.35, rate: 120, vol: 0.18, freq: 4500 });
    for (let i = 0; i < 10; i++) s.ring({ freq: 2500 + nativeRandom() * 4000, dur: 0.2 + nativeRandom() * 0.3, vol: 0.022, delay: nativeRandom() * 0.2, metal: false, wet: 0.4 });
    s.layer({ src: 'noise', dur: 1.1, attack: 0.05, vol: 0.18, filter: 'highpass', ffreq: 6000, fto: 2500, wet: 0.3 });
    s.layer({ src: 'brown', dur: 0.3, vol: 0.35, filter: 'lowpass', ffreq: 500 });
  },
  // the volley loosed: a ripple of bowstrings and a great rush of arrows into the sky
  volleyLoose: (s) => {
    for (let i = 0; i < 7; i++) {
      s.layer({ src: 'sawtooth', freq: s.vary(130, 0.15), to: 95, dur: 0.18, vol: 0.1, filter: 'lowpass', ffreq: 2200, fto: 300, q: 8, delay: i * 0.035 });
    }
    s.whoosh({ from: 800, to: 5000, dur: 0.6, vol: 0.25, q: 0.8, swell: 0.6, wet: 0.2 });
  },
  // each arrow of the volley coming down: a falling whistle and a thunk
  arrowRain: (s) => {
    s.layer({ src: 'noise', dur: 0.12, attack: 0.08, vol: 0.12, filter: 'bandpass', ffreq: s.vary(4200, 0.2), fto: 1800, q: 7 });
    s.layer({ src: 'brown', dur: 0.05, vol: 0.18, delay: 0.11, filter: 'lowpass', ffreq: 900 });
  },

  // Mage
  // a magic missile: a sparkling, shimmering bolt of arcane light
  arcaneBolt: (s) => {
    const p = s.vary(1, 0.08);
    s.layer({ src: 'sine', freq: 660 * p, to: 1320 * p, dur: 0.25, vol: 0.09, vib: 40, vibRate: 22, wet: 0.35 });
    [1568, 2093, 2637].forEach((f, i) => s.layer({ src: 'sine', freq: f * p, dur: 0.22, vol: 0.035, delay: 0.02 + i * 0.03, wet: 0.45 }));
    s.layer({ src: 'noise', dur: 0.18, attack: 0.02, vol: 0.07, filter: 'highpass', ffreq: 8000, wet: 0.3 });
  },
  // the frostfire ball cast: a roar of flame laced with an icy shimmer
  frostfireCast: (s) => {
    s.layer({ src: 'brown', dur: 0.55, attack: 0.1, vol: 0.5, filter: 'lowpass', ffreq: 300, fto: 1600, wet: 0.2 });
    s.crackle({ dur: 0.5, rate: 50, vol: 0.15, freq: 2200 });
    [2349, 2794, 3136].forEach((f, i) => s.layer({ src: 'sine', freq: f, dur: 0.5, attack: 0.15, vol: 0.025, delay: i * 0.05, vib: 20, vibRate: 14, wet: 0.5 }));
  },
  // the frostfire ball bursting: a deep boom of flame, crackling embers and ice tinkling down
  frostfireBurst: (s) => {
    s.layer({ src: 'brown', dur: 0.9, vol: 0.7, filter: 'lowpass', ffreq: 1200, fto: 80, wet: 0.3 });
    s.layer({ src: 'sine', freq: 90, to: 32, dur: 0.6, vol: 0.4 });
    s.crackle({ dur: 0.9, rate: 60, vol: 0.18, freq: 2000 });
    for (let i = 0; i < 6; i++) s.ring({ freq: 3000 + nativeRandom() * 3000, dur: 0.25, vol: 0.02, delay: 0.1 + nativeRandom() * 0.4, metal: false, wet: 0.4 });
  },
  // picking a spell's target: two soft chime notes
  spellAim: (s) => {
    s.ring({ freq: 1320, dur: 0.5, vol: 0.04, metal: false, wet: 0.5 });
    s.ring({ freq: 1760, dur: 0.5, vol: 0.03, delay: 0.06, metal: false, wet: 0.5 });
  },
  // lightning gathering: static crackling ever thicker, an electric buzz and a rising whine
  thunderCharge: (s) => {
    s.crackle({ dur: 0.6, rate: 140, vol: 0.22, freq: 3500, grow: 2 });
    s.layer({ src: 'sawtooth', freq: 60, dur: 0.6, attack: 0.4, vol: 0.12, filter: 'bandpass', ffreq: 400, fto: 2500, q: 4, drive: 3 });
    s.layer({ src: 'sine', freq: 600, to: 2400, dur: 0.6, attack: 0.5, vol: 0.04, vib: 30, vibRate: 25 });
  },
  // a lightning strike: a deafening crack, a burst of crackling sparks, then rolling thunder
  thunderStrike: (s) => {
    s.layer({ src: 'noise', dur: 0.08, vol: 0.7, drive: 6 });
    s.layer({ src: 'sawtooth', freq: 2400, to: 90, dur: 0.22, vol: 0.12, drive: 5 });
    s.crackle({ dur: 0.45, rate: 260, vol: 0.28, freq: 3000 });
    s.crackle({ dur: 0.3, rate: 120, vol: 0.2, freq: 900, filter: 'bandpass', delay: 0.02 });
    s.layer({ src: 'brown', dur: 1.6, attack: 0.05, vol: 0.7, delay: 0.06, filter: 'lowpass', ffreq: 260, fto: 70, wet: 0.5 });
    s.layer({ src: 'brown', dur: 1.2, attack: 0.15, vol: 0.4, delay: 0.4, filter: 'lowpass', ffreq: 180, wet: 0.5 });
  },
  // turning into a bird: a puff of magic, wings beating and a bright chirp
  birdForm: (s) => {
    s.layer({ src: 'noise', dur: 0.3, attack: 0.03, vol: 0.2, filter: 'bandpass', ffreq: 1200, fto: 4000, q: 1, wet: 0.3 });
    [1568, 2093].forEach((f, i) => s.layer({ src: 'sine', freq: f, dur: 0.3, vol: 0.04, delay: i * 0.04, wet: 0.5 }));
    for (let i = 0; i < 4; i++) s.layer({ src: 'noise', dur: 0.09, attack: 0.03, vol: 0.22, filter: 'lowpass', ffreq: 700, delay: 0.12 + i * 0.09 });
    for (const d of [0.2, 0.3]) s.layer({ src: 'sine', freq: 2600, to: 3900, dur: 0.06, vol: 0.06, delay: d });
  },
  // landing back in her own shape: a soft puff and a falling shimmer
  birdLand: (s) => {
    s.layer({ src: 'noise', dur: 0.3, attack: 0.02, vol: 0.2, filter: 'bandpass', ffreq: 3000, fto: 600, q: 1, wet: 0.3 });
    s.layer({ src: 'sine', freq: 1760, to: 880, dur: 0.35, vol: 0.05, vib: 15, vibRate: 12, wet: 0.5 });
  },
  // the mana drain circle: a deep throb and power being drawn inward (shimmers falling toward it)
  manaDrain: (s) => {
    s.layer({ src: 'sine', freq: 55, to: 82, dur: 1.2, attack: 0.3, vol: 0.3, vib: 6, vibRate: 4 });
    s.layer({ src: 'noise', dur: 1.0, attack: 0.8, vol: 0.18, filter: 'bandpass', ffreq: 3000, fto: 300, q: 3, wet: 0.4 });
    [2637, 2093, 1568, 1175].forEach((f, i) => s.layer({ src: 'sine', freq: f, to: f * 0.5, dur: 0.6, vol: 0.03, delay: i * 0.12, wet: 0.5 }));
  },

  // Rogue
  // a fan of thrown daggers: quick blades whistling out, a glint of steel on each
  daggerFan: (s) => {
    for (let i = 0; i < 3; i++) {
      s.whoosh({ from: s.vary(1800), to: 6500, dur: 0.08, vol: 0.2, q: 2.5, swell: 0.4, delay: i * 0.03 });
      s.ring({ freq: s.vary(4200, 0.15), dur: 0.15, vol: 0.012, delay: i * 0.03 + 0.03, wet: 0.1 });
    }
  },
  // the dagger storm: blades whirring round her
  daggerStorm: (s) => {
    s.whoosh({ from: s.vary(1600), to: 4800, dur: 0.1, vol: 0.18, q: 2, swell: 0.5 });
    s.ring({ freq: s.vary(3800, 0.2), dur: 0.1, vol: 0.012, delay: 0.05, wet: 0 });
  },
  // the dagger storm starting: blades drawn with a scrape and a ring
  bladesDrawn: (s) => {
    s.layer({ src: 'noise', dur: 0.25, attack: 0.1, vol: 0.18, filter: 'bandpass', ffreq: 2500, fto: 7000, q: 9 });
    s.ring({ freq: 3600, dur: 0.5, vol: 0.04, delay: 0.2, wet: 0.3 });
  },
  // swift strike: a blur forward and a clean slice
  swiftStrike: (s) => {
    s.whoosh({ from: 400, to: 4500, dur: 0.16, vol: 0.32, q: 1, swell: 0.7 });
    s.whoosh({ from: 5000, to: 2500, dur: 0.07, vol: 0.25, q: 2, swell: 0.1, delay: 0.13 });
    s.ring({ freq: s.vary(3900), dur: 0.25, vol: 0.025, delay: 0.14, wet: 0.2 });
  },
  // parry stance: a blade drawn slowly across a blade
  parryReady: (s) => {
    s.layer({ src: 'noise', dur: 0.3, attack: 0.15, vol: 0.14, filter: 'bandpass', ffreq: 4500, fto: 2800, q: 10 });
    s.ring({ freq: 2900, dur: 0.35, vol: 0.02, delay: 0.25, wet: 0.3 });
  },
  // a parried blow: a bright, ringing clash of steel on steel
  parry: (s) => {
    s.layer({ src: 'noise', dur: 0.04, vol: 0.5, filter: 'highpass', ffreq: 3000 });
    s.ring({ freq: s.vary(1900), dur: 0.9, vol: 0.09, wet: 0.4 });
    s.ring({ freq: s.vary(2650), dur: 0.7, vol: 0.06, wet: 0.4 });
  },
  // a marked target finished off: a sharp, cold sting of steel
  markKill: (s) => {
    s.whoosh({ from: 2000, to: 7000, dur: 0.07, vol: 0.25, q: 2, swell: 0.5 });
    s.ring({ freq: 4400, dur: 0.4, vol: 0.04, delay: 0.05, wet: 0.35 });
  },
  // the clones appearing: a puff of smoke and a ghostly whisper
  cloneSummon: (s) => {
    s.layer({ src: 'noise', dur: 0.5, attack: 0.03, vol: 0.3, filter: 'lowpass', ffreq: 1800, fto: 250, wet: 0.3 });
    for (const f of [1100, 2300]) s.layer({ src: 'noise', dur: 0.6, attack: 0.2, vol: 0.06, filter: 'bandpass', ffreq: f, fto: f * 1.4, q: 9, delay: 0.1, wet: 0.5 });
  },
  // a clone bursting: a puff of smoke and blades scattering
  cloneBurst: (s) => {
    s.layer({ src: 'noise', dur: 0.4, attack: 0.02, vol: 0.32, filter: 'lowpass', ffreq: 1500, fto: 200 });
    for (let i = 0; i < 3; i++) s.whoosh({ from: 2000, to: 6000, dur: 0.07, vol: 0.12, q: 2, delay: 0.04 + i * 0.04 });
  },

  // Priestess
  // calling the rays (her basic attack, so it's heard a lot): one short, soft, rounded note with a quiet fifth over it
  holyChime: (s) => {
    s.layer({ src: 'sine', freq: s.vary(784, 0.01), dur: 0.22, attack: 0.01, vol: 0.05, wet: 0.25 });
    s.layer({ src: 'sine', freq: 1175, dur: 0.14, attack: 0.01, vol: 0.015, delay: 0.02, wet: 0.25 });
  },
  // a ray of light landing: just a soft low tick under the chime
  holyRay: (s) => {
    s.layer({ src: 'sine', freq: s.vary(523, 0.03), dur: 0.12, attack: 0.01, vol: 0.02, wet: 0.15 });
  },
  // light missiles: a quick rising cascade of bells, sparkling
  lightMissiles: (s) => {
    [1175, 1397, 1760, 2093, 2637].forEach((f, i) => s.ring({ freq: f, dur: 0.5, vol: 0.035, delay: i * 0.04, metal: false, wet: 0.5 }));
    s.layer({ src: 'noise', dur: 0.3, attack: 0.05, vol: 0.06, filter: 'highpass', ffreq: 8000, wet: 0.4 });
  },
  // the healing rune: a warm swelling chord, like a choir's held note
  healRune: (s) => {
    [523, 659, 784, 1047].forEach((f, i) => s.layer({ src: 'triangle', freq: f, dur: 1.4, attack: 0.25, vol: 0.04, delay: i * 0.04, vib: 3, vibRate: 5, wet: 0.6 }));
    s.ring({ freq: 2093, dur: 1, vol: 0.03, delay: 0.2, metal: false, wet: 0.6 });
  },
  // guardian aegis: a shield of light ringing up like a bell, humming
  aegis: (s) => {
    s.ring({ freq: 880, dur: 1.2, vol: 0.07, metal: false, wet: 0.6 });
    s.layer({ src: 'sine', freq: 440, dur: 0.9, attack: 0.2, vol: 0.06, vib: 5, vibRate: 6, wet: 0.5 });
    s.layer({ src: 'noise', dur: 0.4, attack: 0.15, vol: 0.06, filter: 'highpass', ffreq: 7000, wet: 0.5 });
  },
  // light bomb gathering: a heavenly choir swelling up
  lightCharge: (s) => {
    [262, 330, 392, 523].forEach((f, i) => s.layer({ src: 'sawtooth', freq: f, dur: 1.1, attack: 0.8, vol: 0.035, delay: i * 0.03,
      filter: 'bandpass', ffreq: 900, q: 2, vib: 4, vibRate: 5.5, wet: 0.6 }));
    s.layer({ src: 'sine', freq: 1047, to: 2093, dur: 1.0, attack: 0.9, vol: 0.03, wet: 0.6 });
  },
  // the light bomb thrown: a glowing whoosh trailing sparkles
  lightBombThrow: (s) => {
    s.whoosh({ from: 600, to: 3500, dur: 0.3, vol: 0.2, q: 1, swell: 0.5, wet: 0.2 });
    s.layer({ src: 'sine', freq: 1320, to: 1980, dur: 0.3, vol: 0.04, vib: 30, vibRate: 18, wet: 0.5 });
  },
  // the light bomb bursting: a radiant chord of bells over a soft, deep boom
  lightBomb: (s) => {
    s.layer({ src: 'brown', dur: 0.9, vol: 0.55, filter: 'lowpass', ffreq: 900, fto: 90, wet: 0.4 });
    [784, 988, 1175, 1568, 2093].forEach((f, i) => s.ring({ freq: f, dur: 1.4, vol: 0.04, delay: i * 0.02, metal: false, wet: 0.7 }));
    s.crackle({ dur: 0.6, rate: 60, vol: 0.06, freq: 7000, delay: 0.05, wet: 0.4 });
  },

  // --- Combat ---
  hit: (s) => {
    s.noise({ dur: 0.07, vol: 0.25, filter: 'lowpass', freq: 2500, to: 400 });
    s.tone({ freq: 240, to: 120, dur: 0.06, vol: 0.08 });
  },
  crit: (s) => {
    s.noise({ dur: 0.1, vol: 0.3, filter: 'lowpass', freq: 4000, to: 500 });
    s.tone({ freq: 880, to: 1760, dur: 0.08, vol: 0.08 });
  },
  playerHurt: (s) => {
    s.tone({ type: 'square', freq: 400, to: 90, dur: 0.25, vol: 0.2 });
    s.noise({ dur: 0.15, vol: 0.25, filter: 'lowpass', freq: 1500 });
  },
  enemyDie: (s) => {
    s.tone({ type: 'square', freq: 300, to: 50, dur: 0.25, vol: 0.12 });
    s.noise({ dur: 0.2, vol: 0.2, filter: 'lowpass', freq: 1000, to: 100 });
  },
  slimeSplit: (s) => {
    s.tone({ type: 'sine', freq: 200, to: 600, dur: 0.15, vol: 0.2 });
    s.tone({ type: 'sine', freq: 300, to: 800, dur: 0.15, vol: 0.12, delay: 0.06 });
  },
  slimeHop: (s) => s.tone({ type: 'sine', freq: 150, to: 350, dur: 0.12, vol: 0.12 }),
  slimeLand: (s) => s.noise({ dur: 0.12, vol: 0.2, filter: 'lowpass', freq: 500 }),
  wraithShriek: (s) => {
    s.tone({ type: 'sawtooth', freq: 700, to: 1100, dur: 0.3, vol: 0.05 });
    s.tone({ type: 'sine', freq: 1400, to: 900, dur: 0.3, vol: 0.06 });
  },
  wraithDie: (s) => {
    s.tone({ type: 'sine', freq: 1200, to: 200, dur: 0.6, vol: 0.12 });
    s.noise({ dur: 0.5, vol: 0.08, filter: 'highpass', freq: 2000, to: 6000 });
  },
  bowDraw: (s) => s.tone({ type: 'triangle', freq: 200, to: 320, dur: 0.25, vol: 0.06 }),
  enemyArrow: (s) => s.tone({ type: 'triangle', freq: 700, to: 250, dur: 0.1, vol: 0.12 }),
  graveRumble: (s) => {
    s.noise({ dur: 0.45, vol: 0.2, filter: 'lowpass', freq: 300, to: 80 });
    s.tone({ type: 'triangle', freq: 70, to: 45, dur: 0.4, vol: 0.12 });
  },
  // a rusty iron gate swinging: the hinge sticks and slips in a wandering, groaning squeal
  gateCreak: (s) => {
    let f = 260 + nativeRandom() * 60;
    for (let i = 0; i < 20; i++) {
      f += (nativeRandom() - 0.55) * 40;
      s.tone({ type: 'sawtooth', freq: f, to: f * 0.93, dur: 0.035, vol: 0.022, delay: i * 0.034 });
    }
    s.noise({ dur: 0.7, vol: 0.035, filter: 'bandpass', freq: 1400, to: 900, q: 12 });
  },
  // ...and banging shut: a heavy clang with the iron ringing (out-of-tune overtones)
  gateClang: (s) => {
    s.tone({ type: 'triangle', freq: 170, to: 150, dur: 0.55, vol: 0.09 });
    s.tone({ type: 'square', freq: 523, to: 509, dur: 0.3, vol: 0.025 });
    s.tone({ type: 'triangle', freq: 1287, dur: 0.4, vol: 0.03 });
    s.noise({ dur: 0.08, vol: 0.12, filter: 'highpass', freq: 2500 });
  },
  gateShut: (s) => {
    s.tone({ type: 'triangle', freq: 190, to: 170, dur: 0.3, vol: 0.05 });
    s.tone({ type: 'triangle', freq: 1287, dur: 0.2, vol: 0.015 });
    s.noise({ dur: 0.05, vol: 0.06, filter: 'highpass', freq: 2500 });
  },
  ghostWail: (s) => {
    s.tone({ type: 'sine', freq: 520, to: 380, dur: 0.6, vol: 0.05 });
    s.tone({ type: 'sine', freq: 530, to: 300, dur: 0.7, vol: 0.04, delay: 0.1 });
  },
  zombieGroan:(s) => s.tone({ type: 'sawtooth', freq: 110, to: 80, dur: 0.35, vol: 0.06 }),
  heavySwing: (s) => {
    s.noise({ dur: 0.3, vol: 0.4, filter: 'lowpass', freq: 900, to: 100 });
    s.tone({ type: 'square', freq: 90, to: 40, dur: 0.3, vol: 0.2 });
  },
  windup: (s) => s.tone({ type: 'square', freq: 200, to: 400, dur: 0.12, vol: 0.04 }),
  spawn: (s) => s.tone({ type: 'sine', freq: 200, to: 500, dur: 0.4, vol: 0.06 }),
  pickup: (s) => {
    s.tone({ type: 'square', freq: 660, dur: 0.07, vol: 0.1 });
    s.tone({ type: 'square', freq: 990, dur: 0.1, vol: 0.1, delay: 0.07 });
  },

  // --- Boss ---
  bossRoar: (s) => {
    s.tone({ type: 'sawtooth', freq: 90, to: 40, dur: 1.2, vol: 0.3 });
    s.tone({ type: 'square', freq: 60, to: 30, dur: 1.2, vol: 0.2 });
    s.noise({ dur: 1.2, vol: 0.3, filter: 'lowpass', freq: 400, to: 60 });
  },
  fistCharge: (s) => s.tone({ type: 'sawtooth', freq: 80, to: 200, dur: 0.5, vol: 0.08 }),
  fistLaunch: (s) => {
    s.noise({ dur: 0.25, vol: 0.3, filter: 'bandpass', freq: 400, to: 1500 });
    s.tone({ type: 'square', freq: 150, to: 60, dur: 0.2, vol: 0.12 });
  },
  impact: (s) => {
    s.noise({ dur: 0.3, vol: 0.45, filter: 'lowpass', freq: 800, to: 60 });
    s.tone({ type: 'square', freq: 80, to: 30, dur: 0.25, vol: 0.2 });
  },
  bossFireball: (s) => {
    s.noise({ dur: 0.25, vol: 0.2, filter: 'lowpass', freq: 400, to: 1800 });
    s.tone({ type: 'sawtooth', freq: 160, to: 90, dur: 0.2, vol: 0.08 });
  },
  bounce: (s) => s.tone({ type: 'square', freq: 260, to: 180, dur: 0.05, vol: 0.05 }),
  laserCharge: (s) => s.tone({ type: 'sine', freq: 400, to: 1200, dur: 0.5, vol: 0.06 }),
  laser: (s) => {
    s.tone({ type: 'sawtooth', freq: 1400, to: 300, dur: 0.2, vol: 0.12 });
    s.noise({ dur: 0.18, vol: 0.15, filter: 'highpass', freq: 3000 });
  },
  burstCharge: (s) => {
    s.tone({ type: 'sawtooth', freq: 60, to: 400, dur: 1.2, vol: 0.12 });
    s.tone({ type: 'sine', freq: 200, to: 1200, dur: 1.2, vol: 0.08 });
  },
  stomp: (s) => {
    s.noise({ dur: 0.4, vol: 0.5, filter: 'lowpass', freq: 300, to: 40 });
    s.tone({ type: 'sine', freq: 70, to: 25, dur: 0.4, vol: 0.4 });
  },
  roll: (s) => s.noise({ dur: 0.5, vol: 0.25, filter: 'lowpass', freq: 250, to: 120 }),
  phantomVanish: (s) => {
    s.tone({ type: 'sine', freq: 900, to: 180, dur: 0.45, vol: 0.1 });
    s.noise({ dur: 0.35, vol: 0.12, filter: 'bandpass', freq: 2400, to: 400, q: 2 });
  },
  phantomAppear: (s) => {
    s.tone({ type: 'sine', freq: 180, to: 900, dur: 0.4, vol: 0.1 });
    s.noise({ dur: 0.3, vol: 0.12, filter: 'bandpass', freq: 400, to: 2400, q: 2 });
  },
  pulse: (s) => {
    s.tone({ type: 'sine', freq: 140, to: 50, dur: 0.45, vol: 0.25 });
    s.noise({ dur: 0.3, vol: 0.15, filter: 'lowpass', freq: 600, to: 120 });
  },
  eyeLaser: (s) => s.tone({ type: 'square', freq: 1300, to: 500, dur: 0.12, vol: 0.05 }),
  partBreak: (s) => {
    s.noise({ dur: 0.7, vol: 0.5, filter: 'lowpass', freq: 2000, to: 60 });
    s.tone({ type: 'square', freq: 200, to: 30, dur: 0.6, vol: 0.2 });
  },

  // --- Lobby cats ---
  // a little two-note mew
  meow: (s) => {
    s.tone({ type: 'triangle', freq: 820, to: 1150, dur: 0.12, vol: 0.06 });
    s.tone({ type: 'triangle', freq: 1150, to: 700, dur: 0.22, vol: 0.06, delay: 0.12 });
  },
  // a soft rumbling purr
  purr: (s) => {
    for (let i = 0; i < 10; i++) s.noise({ dur: 0.07, vol: 0.05, filter: 'lowpass', freq: 220, delay: i * 0.09 });
    s.tone({ type: 'sine', freq: 48, dur: 0.9, vol: 0.06 });
  },

  // --- Castle ---
  // a matchlock going off: a sharp crack and a rolling boom
  musket: (s) => {
    s.noise({ dur: 0.06, vol: 0.45, filter: 'highpass', freq: 1800 });
    s.noise({ dur: 0.45, vol: 0.35, filter: 'lowpass', freq: 900, to: 90 });
    s.tone({ type: 'square', freq: 140, to: 50, dur: 0.2, vol: 0.12 });
  },
  // the catapult's arm slamming into its crossbar
  catapult: (s) => {
    s.noise({ dur: 0.25, vol: 0.3, filter: 'bandpass', freq: 500, to: 200, q: 2 });
    s.tone({ type: 'triangle', freq: 110, to: 60, dur: 0.25, vol: 0.18 });
    s.tone({ type: 'square', freq: 220, dur: 0.05, vol: 0.05, delay: 0.02 });
  },
  // a herald's fanfare: three bright rising notes and a held one
  trumpet: (s) => {
    [523, 659, 784, 1046].forEach((f, i) => s.tone({ type: 'sawtooth', freq: f, dur: i === 3 ? 0.5 : 0.14, vol: 0.06, delay: i * 0.14 }));
    [523, 659, 784, 1046].forEach((f, i) => s.tone({ type: 'square', freq: f * 1.005, dur: i === 3 ? 0.5 : 0.14, vol: 0.025, delay: i * 0.14 }));
  },
  // a big bronze bell: a low strike with long, slightly out-of-tune overtones
  bell: (s) => {
    s.tone({ type: 'sine', freq: 196, dur: 2.2, vol: 0.22 });
    s.tone({ type: 'sine', freq: 392 * 1.01, dur: 1.6, vol: 0.1 });
    s.tone({ type: 'sine', freq: 466, dur: 1.2, vol: 0.06 });
    s.tone({ type: 'triangle', freq: 1175, dur: 0.6, vol: 0.04 });
    s.noise({ dur: 0.05, vol: 0.12, filter: 'highpass', freq: 2500 });
  },
  // the King bellowing: a deep growl with a rumbling shockwave under it
  kingShout: (s) => {
    s.tone({ type: 'sawtooth', freq: 150, to: 95, dur: 0.6, vol: 0.2 });
    s.tone({ type: 'square', freq: 110, to: 70, dur: 0.6, vol: 0.12 });
    s.noise({ dur: 0.7, vol: 0.3, filter: 'lowpass', freq: 600, to: 80 });
  },
  // the King lifting his scepter: a rising golden shimmer
  scepterRaise: (s) => {
    s.tone({ type: 'triangle', freq: 330, to: 990, dur: 0.5, vol: 0.06 });
    s.tone({ type: 'sine', freq: 660, to: 1320, dur: 0.5, vol: 0.03, delay: 0.05 });
  },
  // the scepter striking marble: a metal clang ringing over a deep crack
  scepterSmite: (s) => {
    s.noise({ dur: 0.05, vol: 0.35, filter: 'highpass', freq: 2200 });
    s.tone({ type: 'triangle', freq: 740, dur: 0.6, vol: 0.09 });
    s.tone({ type: 'triangle', freq: 1110 * 1.01, dur: 0.4, vol: 0.05 });
    s.noise({ dur: 0.45, vol: 0.4, filter: 'lowpass', freq: 500, to: 50 });
    s.tone({ type: 'sine', freq: 65, to: 30, dur: 0.4, vol: 0.3 });
  },
  // calling his guard: a low war horn, two notes
  guardHorn: (s) => {
    s.tone({ type: 'sawtooth', freq: 147, dur: 0.28, vol: 0.09 });
    s.tone({ type: 'sawtooth', freq: 196, dur: 0.55, vol: 0.09, delay: 0.26 });
    s.tone({ type: 'square', freq: 98, dur: 0.8, vol: 0.04 });
  },
  // the scepter thrown: a whirring, wobbling whoosh
  scepterThrow: (s) => {
    for (let i = 0; i < 4; i++) s.noise({ dur: 0.12, vol: 0.18, filter: 'bandpass', freq: 700 + i * 250, to: 400, q: 3, delay: i * 0.08 });
    s.tone({ type: 'triangle', freq: 520, to: 260, dur: 0.35, vol: 0.05 });
  },
  // the scepter whirling where it landed: a short metallic whirr each turn
  scepterWhirl: (s) => s.noise({ dur: 0.1, vol: 0.1, filter: 'bandpass', freq: 1600, to: 900, q: 4 }),
  // a two-handed slam with the whole royal weight: a booming thud and a bell-like ring
  royalSlam: (s) => {
    s.noise({ dur: 0.6, vol: 0.55, filter: 'lowpass', freq: 400, to: 40 });
    s.tone({ type: 'sine', freq: 55, to: 25, dur: 0.6, vol: 0.45 });
    s.tone({ type: 'sine', freq: 220, dur: 1.0, vol: 0.07 });
  },
  // the greatsword sweep: a long heavy whoosh with a steel ring
  greatswordSweep: (s) => {
    s.noise({ dur: 0.45, vol: 0.35, filter: 'bandpass', freq: 300, to: 1400, q: 1 });
    s.tone({ type: 'triangle', freq: 1500, to: 1200, dur: 0.35, vol: 0.04, delay: 0.1 });
    s.tone({ type: 'square', freq: 90, to: 45, dur: 0.3, vol: 0.12 });
  },
  // his crown gathering light: a soft rising choir
  crownCharge: (s) => {
    [523, 659, 784].forEach((f, i) => s.tone({ type: 'sine', freq: f, to: f * 1.5, dur: 0.9, vol: 0.04, delay: i * 0.06 }));
  },
  // a ring of light bursting from the crown: a bright chord
  crownBlast: (s) => {
    [784, 988, 1175].forEach((f) => s.tone({ type: 'triangle', freq: f, dur: 0.4, vol: 0.05 }));
    s.noise({ dur: 0.2, vol: 0.12, filter: 'highpass', freq: 3000 });
  },
  glass: (s) => {
    for (let i = 0; i < 5; i++) s.tone({ type: 'triangle', freq: 1800 + nativeRandom() * 1400, dur: 0.08, vol: 0.05, delay: i * 0.025 });
    s.noise({ dur: 0.15, vol: 0.2, filter: 'highpass', freq: 3000 });
  },
  splash: (s) => {
    s.noise({ dur: 0.2, vol: 0.15, filter: 'bandpass', freq: 1200, to: 500, q: 1 });
    s.tone({ type: 'sine', freq: 600, to: 300, dur: 0.1, vol: 0.05 });
  },
  crossbow: (s) => {
    s.tone({ type: 'square', freq: 320, to: 180, dur: 0.05, vol: 0.08 });
    s.noise({ dur: 0.06, vol: 0.14, filter: 'highpass', freq: 2500 });
  },
  // hooves pounding: a quick four-beat
  gallop: (s) => {
    for (let i = 0; i < 6; i++) s.noise({ dur: 0.05, vol: 0.18, filter: 'lowpass', freq: 400, delay: i * 0.11 + (i % 2) * 0.03 });
  },
  // a holy chime rising
  blessing: (s) => {
    [880, 1109, 1319, 1760].forEach((f, i) => s.tone({ type: 'sine', freq: f, dur: 0.5, vol: 0.06, delay: i * 0.07 }));
  },
  // an execution: a heavy chop and a low toll
  execute: (s) => {
    s.noise({ dur: 0.4, vol: 0.5, filter: 'lowpass', freq: 1000, to: 60 });
    s.tone({ type: 'sine', freq: 98, dur: 1.4, vol: 0.2, delay: 0.1 });
    s.tone({ type: 'sine', freq: 147, dur: 1.0, vol: 0.08, delay: 0.1 });
  },
  jesterFlip: (s) => {
    s.noise({ dur: 0.18, vol: 0.18, filter: 'bandpass', freq: 800, to: 2600, q: 1 });
    s.tone({ type: 'triangle', freq: 1200, to: 1800, dur: 0.08, vol: 0.05, delay: 0.08 });
    s.tone({ type: 'triangle', freq: 1500, to: 2200, dur: 0.08, vol: 0.04, delay: 0.14 });
  },
  swordDraw: (s) => {
    s.noise({ dur: 0.45, vol: 0.22, filter: 'bandpass', freq: 3500, to: 5000, q: 4 });
    s.tone({ type: 'triangle', freq: 1400, to: 1600, dur: 0.4, vol: 0.04 });
  },

  // --- Game flow ---
  waveStart: (s) => {
    [0, 0.12, 0.24].forEach((d, i) => s.tone({ type: 'square', freq: [330, 440, 660][i], dur: 0.12, vol: 0.1, delay: d }));
  },
  victory: (s) => {
    [523, 659, 784, 1046].forEach((f, i) => s.tone({ type: 'square', freq: f, dur: 0.25, vol: 0.12, delay: i * 0.15 }));
  },
  defeat: (s) => {
    [392, 330, 262, 196].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.35, vol: 0.18, delay: i * 0.22 }));
  },

  // --- Puzzle room (Simon's stone) ---
  // each colour's note (red, blue, green, yellow): a chime of an A major chord
  simon0: (s) => s.ring({ freq: 440, dur: 0.5, vol: 0.09, wet: 0.3, metal: false }),
  simon1: (s) => s.ring({ freq: 554, dur: 0.5, vol: 0.09, wet: 0.3, metal: false }),
  simon2: (s) => s.ring({ freq: 659, dur: 0.5, vol: 0.09, wet: 0.3, metal: false }),
  simon3: (s) => s.ring({ freq: 880, dur: 0.5, vol: 0.09, wet: 0.3, metal: false }),
  simonRight: (s) => [659, 880, 1109, 1319].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.16, vol: 0.1, delay: i * 0.08 })),
  simonWrong: (s) => {
    s.tone({ type: 'sawtooth', freq: 160, to: 90, dur: 0.45, vol: 0.12 });
    s.tone({ type: 'square', freq: 170, to: 95, dur: 0.45, vol: 0.06 });
  },
  // the fuse: a shrill beep, quicker and quicker
  simonFuse: (s) => s.tone({ type: 'square', freq: 1760, dur: 0.06, vol: 0.07 }),
};

// ---------------------------------------------------------------
//  Background music: a tiny step sequencer (eighth-note steps).
//  Per track: bass (one note per `bassEvery` steps), lead (one entry per
//  step, null = rest), optional sustained `chords` (one per bar of 8 steps)
//  and a soft `hats` pattern. Instrument fields default to the original
//  chiptune sound.
// ---------------------------------------------------------------
const MUSIC_TRACKS = {
  // main menu
  menu: {
    bpm: 84,
    bass: [45, 45, 41, 41, 43, 43, 40, 40],
    lead: [69, null, 72, null, 76, null, 72, null, 65, null, 69, null, 72, null, 69, null,
           67, null, 71, null, 74, null, 71, null, 64, null, 68, null, 71, null, 76, null],
  },
  // lobby: slow, warm lo-fi loop (maj7 / min7 chords, soft sine lead, light swing)
  lobby: {
    bpm: 74,
    swing: 0.18,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],   // Fmaj7 Em7 Dm7 Cmaj7
    chordType: 'triangle', chordVol: 0.045,
    bass: [41, 41, 40, 40, 38, 38, 36, 43],
    bassEvery: 4, bassType: 'sine', bassVol: 0.45, bassLen: 3.6,
    lead: [72, null, null, 76, null, null, 74, null, 71, null, null, 74, null, null, 72, null,
           69, null, 72, null, null, 76, null, 74, 72, null, null, null, 67, null, null, null,
           72, null, null, 76, null, 79, null, 77, 76, null, 74, null, 71, null, null, null,
           69, null, null, 72, null, 71, null, 67, 69, null, null, null, null, null, null, null],
    leadType: 'sine', leadVol: 0.09, leadLen: 2.2,
    hats: [0, 0, 1, 0, 0, 0, 1, 1],
  },
  battle: {
    bpm: 132,
    bass: [45, 45, 45, 45, 41, 41, 43, 43],
    lead: [57, 60, 64, 60, 57, 60, 64, 67, 53, 57, 60, 57, 55, 59, 62, 59],
  },
  boss: {
    bpm: 150,
    bass: [40, 40, 41, 41, 40, 40, 46, 44],
    lead: [64, 67, 70, 67, 64, 67, 71, 67, 65, 68, 71, 68, 70, 68, 67, 64],
  },
};

const Music = {
  track: null,
  step: 0,
  nextTime: 0,
  timer: null,

  play(name) {
    if (this.track === MUSIC_TRACKS[name]) return;
    this.stop();
    if (!Sound.ctx) return;
    this.track = MUSIC_TRACKS[name];
    this.step = 0;
    this.nextTime = Sound.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  },

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  },

  /** Music on/off. Returns the new state. save = false inside the settings screen (Save there stores it). */
  toggle(save = true) {
    Settings.data.music = !Settings.data.music;
    if (save) Settings.save();
    Sound.applyVolumes();
    return Settings.data.music;
  },

  schedule() {
    const ctx = Sound.ctx;
    const tr = this.track;
    if (!ctx || !tr) return;
    const stepDur = 60 / tr.bpm / 2; // eighth notes
    const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const bus = Sound.musicBus;
    while (this.nextTime < ctx.currentTime + 0.2) {
      // swing pushes every off-beat eighth a little late
      const swing = this.step % 2 ? (tr.swing || 0) * stepDur : 0;
      const delay = Math.max(0, this.nextTime - ctx.currentTime + swing);
      if (tr.chords && this.step % 8 === 0) {
        const chord = tr.chords[Math.floor(this.step / 8) % tr.chords.length];
        for (const n of chord) Sound.tone({ type: tr.chordType, freq: midiToHz(n), dur: stepDur * 8.2, vol: tr.chordVol, delay, bus });
      }
      const bassEvery = tr.bassEvery || 2;
      if (this.step % bassEvery === 0) {
        const b = tr.bass[Math.floor(this.step / 4) % tr.bass.length];
        Sound.tone({ type: tr.bassType || 'triangle', freq: midiToHz(b), dur: stepDur * (tr.bassLen || 1.8), vol: tr.bassVol ?? 0.5, delay, bus });
      }
      const n = tr.lead[this.step % tr.lead.length];
      if (n !== null) {
        Sound.tone({ type: tr.leadType || 'square', freq: midiToHz(n), dur: stepDur * (tr.leadLen || 0.9), vol: tr.leadVol ?? 0.12, delay, bus });
      }
      if (tr.hats && tr.hats[this.step % tr.hats.length]) {
        Sound.noise({ dur: 0.035, vol: 0.06, filter: 'highpass', freq: 7000, delay, bus });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  },
};

/**
 * The Bard's music: a plucked lute voice and real melodies for her abilities.
 * Each strum plays the next three notes of her current tune's melody, so
 * attacking plays the tune through; switching tunes, inspiring, the lullaby and
 * the screech each have their own phrase. Notes are MIDI numbers.
 */
const Bardsong = {
  // Energetic: a lively jig in D major. Calming: a slow air in A minor. Three notes per strum.
  melodies: {
    energetic: [74, 78, 81, 83, 81, 78, 79, 78, 76, 74, 76, 78, 81, 78, 74, 76, 73, 69,
      74, 78, 81, 86, 85, 83, 81, 83, 81, 78, 76, 74],
    calming: [69, 72, 76, 74, 72, 69, 67, 71, 74, 72, 71, 67, 69, 72, 76, 79, 77, 76,
      74, 72, 71, 69, 64, 69],
  },

  /** One plucked lute string: a bright attack mellowing as it rings out. soft = the calming tune's gentler touch. */
  pluck(midi, { delay = 0, vol = 0.1, dur = 0.55, soft = false, bus = null } = {}) {
    const c = Sound.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const f = 440 * 2 ** ((midi - 69) / 12);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(soft ? 1600 : 3200, t);
    lp.frequency.exponentialRampToValueAtTime(soft ? 380 : 600, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (soft ? 0.012 : 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(bus || Sound.sfxBus);
    for (const [type, mul, v] of [['sawtooth', 1, soft ? 0.25 : 0.5], ['triangle', 1, 0.6], ['triangle', 2, 0.3]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f * mul, t);
      og.gain.value = v;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  },

  /** A strum: the next three notes of the tune, rippled like fingers across the strings. */
  strum(bard) {
    const tune = bard.tune;
    const mel = this.melodies[tune];
    const soft = tune === 'calming';
    bard.melodyAt = bard.melodyAt || { energetic: 0, calming: 0 };
    for (let i = 0; i < 3; i++) {
      const n = mel[(bard.melodyAt[tune] + i) % mel.length];
      this.pluck(n, { delay: i * (soft ? 0.09 : 0.055), vol: soft ? 0.08 : 0.09, dur: soft ? 0.8 : 0.45, soft });
    }
    bard.melodyAt[tune] = (bard.melodyAt[tune] + 3) % mel.length;
  },

  /** Swapping tunes: a run up (energetic) or a falling arpeggio (calming). */
  flourish(tune) {
    const notes = tune === 'energetic' ? [74, 76, 78, 81, 86] : [81, 76, 72, 69, 64];
    notes.forEach((n, i) => this.pluck(n, { delay: i * 0.05, vol: 0.08, dur: 0.5, soft: tune === 'calming' }));
  },

  /** Moral support: a rising fanfare ending on a ringing chord. */
  fanfare() {
    [67, 71, 74, 79].forEach((n, i) => this.pluck(n, { delay: i * 0.08, vol: 0.09, dur: 0.4 }));
    [79, 83, 86].forEach((n) => this.pluck(n, { delay: 0.36, vol: 0.08, dur: 1.1 }));
  },

  /** The sleeping song: a soft lullaby that fills its whole length (through its own bus, so stopLullaby can fade it). */
  lullaby(seconds) {
    const c = Sound.ctx;
    if (!c) return;
    this.stopLullaby();
    const bus = c.createGain();
    bus.connect(Sound.sfxBus);
    this.lullabyBus = bus;
    const phrase = [[76, 1], [76, 1], [79, 2], [76, 1], [76, 1], [79, 2], [76, 1], [79, 1], [84, 2], [83, 1.5], [81, 0.5], [81, 2],
      [74, 1], [76, 1], [77, 2], [74, 1], [76, 1], [77, 2], [74, 1], [77, 1], [83, 1], [81, 1], [79, 2], [84, 3]];
    const beat = 0.25;
    let t = 0;
    for (const [n, len] of phrase) {
      if (t > seconds - 0.4) break;
      this.pluck(n, { delay: t, vol: 0.07, dur: 1.0, soft: true, bus });
      if (len >= 2) this.pluck(n - 12, { delay: t, vol: 0.05, dur: 1.4, soft: true, bus });   // a low note under the long ones
      t += len * beat;
    }
  },

  /** Fades out a lullaby that's still playing (its notes are already scheduled, so they're silenced instead). */
  stopLullaby() {
    const bus = this.lullabyBus;
    if (!bus || !Sound.ctx) return;
    const t = Sound.ctx.currentTime;
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => bus.disconnect(), 600);
    this.lullabyBus = null;
  },

  /** Screeching tuning: strings wrenched out of tune, a dissonant shriek sliding up. */
  screech() {
    const c = Sound.ctx;
    if (!c) return;
    for (const [f, to] of [[880, 1760], [932, 1980], [622, 1480]]) Sound.tone({ type: 'sawtooth', freq: f, to, dur: 0.55, vol: 0.06 });
    Sound.noise({ dur: 0.4, vol: 0.12, filter: 'bandpass', freq: 2400, to: 5200, q: 4 });
    [61, 62, 68].forEach((n) => this.pluck(n, { vol: 0.09, dur: 0.6 }));
  },
};
