// Runs the wave sequence: break -> spawning -> fighting -> ... -> boss.

class WaveDirector {
  constructor(world) {
    this.world = world;
    this.waveIndex = -1;
    this.state = 'break';
    this.timer = 1.5;
    this.queue = [];
    this.spawnTimer = 0;
  }

  get totalWaves() { return CONFIG.waves.length; }
  get waveNumber() { return Math.max(1, this.waveIndex + 1); }

  update(dt) {
    const w = this.world;
    switch (this.state) {
      case 'break':
        this.timer -= dt;
        if (this.timer <= 0) this.startNextWave();
        break;

      case 'spawning':
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.queue.length) {
          w.spawnEnemy(this.queue.shift());
          this.spawnTimer = CONFIG.spawnInterval;
        }
        if (!this.queue.length) this.state = 'fighting';
        break;

      case 'fighting':
        if (w.enemies.length === 0 && w.pendingSpawns === 0) {
          for (const p of w.players) p.roomCleared(w);   // a cleared wave counts as a cleared room for super buffs
          if (this.waveIndex + 1 < this.totalWaves) {
            this.state = 'break';
            this.timer = CONFIG.waveBreak;
            w.banner('WAVE CLEARED', `Next wave in ${CONFIG.waveBreak}s`);
          } else {
            this.state = 'boss';
            w.startBoss();
          }
        }
        break;
    }
  }

  startNextWave() {
    this.waveIndex++;
    const wave = CONFIG.waves[this.waveIndex];
    this.queue = [];
    for (const [type, count] of Object.entries(wave)) {
      for (let i = 0; i < count; i++) this.queue.push(type);
    }
    // shuffle so enemy types arrive mixed
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.state = 'spawning';
    this.spawnTimer = 0;
    this.world.banner(`WAVE ${this.waveIndex + 1}`, `of ${this.totalWaves}`);
    Sound.play('waveStart');
  }

  /** Debug helper: jump straight to a wave (1-based) or the boss ('golem' / 'phantom', random if omitted). */
  skipTo(waveNumber, bossType) {
    if (waveNumber > this.totalWaves) {
      this.state = 'boss';
      this.waveIndex = this.totalWaves - 1;
      this.world.startBoss(CONFIG.bosses[bossType] !== undefined ? bossType : undefined);
    } else {
      this.waveIndex = waveNumber - 2;
      this.timer = 0.5;
    }
  }
}
