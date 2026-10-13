// Retro sound effects and music, synthesized with the Web Audio API.
// No audio files needed: every sound is built from oscillators + noise.

const Sound = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuffer: null,
  lastPlayed: {},
  musicEnabled: true,

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
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
  noise({ dur = 0.1, vol = 0.2, filter = 'lowpass', freq = 1200, to = null, delay = 0, q = 1 }) {
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
    src.connect(f).connect(gain).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
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
  uiClick: (s) => { s.tone({ freq: 520, to: 900, dur: 0.08, vol: 0.1 }); },
  denied: (s) => s.tone({ type: 'square', freq: 140, dur: 0.1, vol: 0.08 }),

  // --- Warrior ---
  slash: (s) => {
    s.noise({ dur: 0.13, vol: 0.28, filter: 'bandpass', freq: 3000, to: 700, q: 2 });
    s.tone({ freq: 500, to: 180, dur: 0.08, vol: 0.05 });
  },
  thrustCharge: (s) => s.tone({ type: 'sawtooth', freq: 180, to: 420, dur: 0.2, vol: 0.07 }),
  thrust: (s) => {
    s.noise({ dur: 0.22, vol: 0.35, filter: 'bandpass', freq: 1800, to: 300, q: 1.5 });
    s.tone({ type: 'square', freq: 220, to: 60, dur: 0.2, vol: 0.12 });
  },

  // --- Ranger ---
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
  magic: (s) => {
    s.tone({ type: 'sine', freq: 880, to: 1500, dur: 0.12, vol: 0.12 });
    s.tone({ type: 'square', freq: 1320, to: 1800, dur: 0.06, vol: 0.03 });
  },
  fireballCast: (s) => {
    s.noise({ dur: 0.3, vol: 0.2, filter: 'lowpass', freq: 600, to: 2000 });
    s.tone({ type: 'sawtooth', freq: 120, to: 300, dur: 0.25, vol: 0.08 });
  },
  explosion: (s) => {
    s.noise({ dur: 0.5, vol: 0.5, filter: 'lowpass', freq: 1400, to: 80 });
    s.tone({ type: 'square', freq: 120, to: 30, dur: 0.35, vol: 0.18 });
  },

  // --- Rogue ---
  dagger: (s) => s.noise({ dur: 0.06, vol: 0.18, filter: 'highpass', freq: 4000, to: 2000 }),
  dash: (s) => {
    s.noise({ dur: 0.2, vol: 0.25, filter: 'bandpass', freq: 600, to: 3000, q: 1 });
    s.tone({ type: 'square', freq: 300, to: 900, dur: 0.12, vol: 0.06 });
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
};

// ---------------------------------------------------------------
//  Background music: a tiny step sequencer (bass + arpeggio).
// ---------------------------------------------------------------
const MUSIC_TRACKS = {
  menu: {
    bpm: 84,
    bass: [45, 45, 41, 41, 43, 43, 40, 40],
    lead: [69, null, 72, null, 76, null, 72, null, 65, null, 69, null, 72, null, 69, null,
           67, null, 71, null, 74, null, 71, null, 64, null, 68, null, 71, null, 76, null],
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

  toggle() {
    Sound.musicEnabled = !Sound.musicEnabled;
    if (Sound.musicBus) Sound.musicBus.gain.value = Sound.musicEnabled ? 0.22 : 0;
  },

  schedule() {
    const ctx = Sound.ctx;
    const tr = this.track;
    if (!ctx || !tr) return;
    const stepDur = 60 / tr.bpm / 2; // eighth notes
    while (this.nextTime < ctx.currentTime + 0.2) {
      const delay = this.nextTime - ctx.currentTime;
      const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
      if (this.step % 2 === 0) {
        const b = tr.bass[Math.floor(this.step / 4) % tr.bass.length];
        Sound.tone({ type: 'triangle', freq: midiToHz(b), dur: stepDur * 1.8, vol: 0.5, delay, bus: Sound.musicBus });
      }
      const n = tr.lead[this.step % tr.lead.length];
      if (n !== null) {
        Sound.tone({ type: 'square', freq: midiToHz(n), dur: stepDur * 0.9, vol: 0.12, delay, bus: Sound.musicBus });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  },
};
