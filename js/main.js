// Entry point: builds sprites, wires up screens and runs the main loop.
//
// Dev shortcuts (add to the URL):
//   ?class=mage          skip menus and start as a class
//   ?class=rogue&wave=3  start at a given wave
//   ?class=warrior&boss  start at a random boss (&boss=golem or &boss=phantom to pick)
//   ?class=mage&practice start in the practice range

const App = {
  state: 'menu',     // menu | playing | paused | ended
  game: null,
  classId: null,
  lastTime: 0,
  menuTime: 0,
  practiceMode: false,
  // practice-range cheats, kept when switching hero
  practiceOptions: { god: false, infiniteMana: false, infiniteEnergy: false },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.stage = document.getElementById('stage');
    this.practicePanel = document.getElementById('practice-panel');

    buildHeroSprites();
    buildEnemySprites();
    buildBossSprites();
    buildPhantomSprites();
    buildItemSprites();
    buildIconSprites();

    Input.init(this.canvas);
    Menus.init(this);
    this.menuDungeon = new Dungeon();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      Sound.init();
      if (!Music.track) Music.play(this.state === 'playing' ? 'battle' : 'menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.applyDevShortcuts();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const s = Math.min(window.innerWidth / CONFIG.screen.width, window.innerHeight / CONFIG.screen.height);
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  },

  applyDevShortcuts() {
    const params = new URLSearchParams(location.search);
    const classId = params.get('class');
    if (!classId || !CONFIG.classes[classId]) return;
    this.practiceMode = params.has('practice');
    this.startGame(classId);
    if (this.practiceMode) return;
    if (params.has('boss')) this.game.director.skipTo(CONFIG.waves.length + 1, params.get('boss'));
    else if (params.get('wave')) this.game.director.skipTo(parseInt(params.get('wave'), 10));
  },

  startGame(classId) {
    Sound.init();
    this.classId = classId;
    this.game = new Game(classId, {
      onGameOver: (stats) => this.endGame(false, stats),
      onVictory: (stats) => this.endGame(true, stats),
    }, { practice: this.practiceMode ? this.practiceOptions : null });
    Menus.refreshPractice(this.practiceOptions);
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
    Music.stop();
    Music.play('battle');
  },

  endGame(won, stats) {
    this.state = 'ended';
    Menus.showEnd(won, stats);
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    Menus.show('pause');
  },

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    Input.reset();
    Menus.show(null);
  },

  quitToMenu(screen = 'menu') {
    this.state = 'menu';
    this.game = null;
    Menus.show(screen);
    Music.stop();
    Music.play('menu');
  },

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000 || 0, 1 / 30);
    this.lastTime = now;

    if (Input.wasPressed('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (Input.wasPressed('KeyM')) Music.toggle();

    if (this.state === 'playing') this.game.update(dt);

    if (this.game) {
      this.game.render(this.ctx);
      if (this.state === 'playing') HUD.drawCrosshair(this.ctx, Input.mouse.x, Input.mouse.y);
    } else {
      this.renderMenuBackground(dt);
    }
    Menus.drawPreviews(now / 1000);
    this.practicePanel.classList.toggle('hidden', !(this.state === 'playing' && this.game && this.game.practice));

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  /** Slow pan across the dungeon behind the menus. */
  renderMenuBackground(dt) {
    this.menuTime += dt;
    const d = this.menuDungeon;
    const ctx = this.ctx;
    const x = (Math.sin(this.menuTime * 0.08) * 0.5 + 0.5) * (d.width - CONFIG.screen.width);
    ctx.save();
    ctx.translate(-Math.round(x), -40);
    d.draw(ctx);
    d.drawTorches(ctx, this.menuTime);
    ctx.restore();
  },
};

window.addEventListener('load', () => App.init());
