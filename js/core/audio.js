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
