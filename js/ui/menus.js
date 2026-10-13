// DOM screens: main menu, controls, class select, pause, end screen.

const CLASS_INFO = {
  warrior: {
    LMB: ['Sword Combo', 'Slash, slash, stab'],
    RMB: ['Barrier Shield', 'Hold: 400 hp frontal shield'],
    E: ['Whirlwind', 'Spin and slash, move faster'],
    F: ['Charge', 'Rush forward, stunning foes'],
    Q: ['World Cutter', 'Power up, then a massive strike'],
  },
  ranger: {
    LMB: ['Arrow', 'Piercing shot'],
    RMB: ['Volley', 'Mark an area, rain arrows for 3s'],
    E: ['Rapid Fire', 'Next 5 arrows: faster, +25%'],
    F: ['Fire / Ice Arrow', 'F, then LMB fire or RMB ice'],
    Q: ['Swift Camo', 'Cleanse, invisible, faster'],
  },
  mage: {
    LMB: ['Magic Missile', 'Homing orbs (3 mana)'],
    RMB: ['Frostfire Ball', 'Big explosion (20 mana)'],
    E: ['Lightning', 'Pick a target, it arcs (150)'],
    F: ['Bird Form', 'Tiny, fast bird (50 mana)'],
    Q: ['Life Drain', 'Place a circle that drains hp + mana'],
  },
  rogue: {
    LMB: ['Dagger Fan', 'Three daggers (2 energy)'],
    RMB: ['Swift Strike', 'Dash slash, bleeds wounded (30)'],
    E: ['Parry', 'Block a hit: +75 energy, haste'],
    F: ['Dagger Storm', 'Next attack: 3s of daggers (100)'],
    Q: ['Clone Surprise', '4 exploding clones hunt foes'],
  },
};

const Menus = {
  screens: {},
  previews: [],

  init(app) {
    for (const el of document.querySelectorAll('.screen')) {
      this.screens[el.id.replace('screen-', '')] = el;
    }
    document.addEventListener('click', (e) => {
      const pp = e.target.closest('[data-pp]');
      if (pp) {
        Sound.play('uiClick');
        pp.blur(); // keep keyboard input going to the game
        this.handlePractice(pp.dataset.pp, app);
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      Sound.play('uiClick');
      this.handleAction(btn.dataset.action, app);
    });
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('.btn, .card') && e.target !== this.lastHover) Sound.play('uiHover', 0.05);
      this.lastHover = e.target;
    });
    this.buildCards(app);
  },

  handleAction(action, app) {
    switch (action) {
      case 'play':
      case 'practice':
        app.practiceMode = action === 'practice';
        document.getElementById('select-title').textContent = app.practiceMode ? 'Practice: Choose a Hero' : 'Choose Your Hero';
        this.show('select');
        break;
      case 'controls': this.show('controls'); break;
      case 'back': this.show('menu'); break;
      case 'resume': app.resume(); break;
      case 'quit': app.quitToMenu(); break;
      case 'retry': app.startGame(app.classId); break;
      case 'select': app.quitToMenu('select'); break;
    }
  },

  /** Buttons on the practice-range panel. */
  handlePractice(cmd, app) {
    const [name, arg] = cmd.split(':');
    const game = app.game;
    switch (name) {
      case 'collapse': document.getElementById('practice-panel').classList.toggle('collapsed'); break;
      case 'class': app.startGame(arg); break;
      case 'spawn': game.practiceSpawn(arg); break;
      case 'clear': game.clearEnemies(); break;
      case 'toggle':
        app.practiceOptions[arg] = !app.practiceOptions[arg];
        this.refreshPractice(app.practiceOptions);
        break;
      case 'ult': game.player.ult = game.player.ultMax; break;
      case 'resetDps': game.resetDps(); break;
    }
  },

  refreshPractice(options) {
    for (const el of document.querySelectorAll('[data-pp^="toggle:"]')) {
      el.classList.toggle('on', !!options[el.dataset.pp.split(':')[1]]);
    }
  },

  /** Shows one screen (or none, while playing). */
  show(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name);
    }
  },

  showEnd(won, stats) {
    document.getElementById('end-title').textContent = won ? 'Victory!' : 'You Died';
    document.getElementById('end-title').style.color = won ? '#f2a541' : '#e04545';
    document.getElementById('end-sub').innerHTML = won
      ? `${stats.defeatText || "The crypt falls silent."}<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`
      : `Reached wave ${stats.wave}.<br>Time ${stats.time} &nbsp; Kills ${stats.kills}`;
    this.show('end');
  },

  buildCards(app) {
    const container = document.getElementById('class-cards');
    for (const [id, cfg] of Object.entries(CONFIG.classes)) {
      const info = CLASS_INFO[id];
      const card = document.createElement('div');
      card.className = 'card';
      const resource = cfg.resource ? ` &nbsp; ${cfg.resource.name} ${cfg.resource.max}` : '';
      const abilities = Object.entries(info)
        .map(([key, [name, desc]]) => `<div class="ability"><b>${key} ${name}</b><br><span>${desc}</span></div>`)
        .join('');
      card.innerHTML = `
        <canvas width="64" height="64"></canvas>
        <h3>${cfg.name}</h3>
        <div class="stats">HP ${cfg.hp} &nbsp; SPD ${cfg.speed}${resource}</div>
        ${abilities}`;
      card.addEventListener('click', () => {
        Sound.play('uiClick');
        app.startGame(id);
      });
      container.appendChild(card);
      const canvas = card.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      this.previews.push({ id, ctx, card });
    }
  },

  /** Animates the hero previews on the class select screen. */
  drawPreviews(time) {
    if (this.screens.select.classList.contains('hidden')) return;
    for (const p of this.previews) {
      const hovered = p.card.matches(':hover');
      const frames = Sprites.heroes[p.id];
      const frame = hovered ? frames.walk[Math.floor(time * 9) % 4] : frames.idle[Math.floor(time * 2.5) % 2];
      p.ctx.clearRect(0, 0, 64, 64);
      p.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      p.ctx.beginPath();
      p.ctx.ellipse(32, 59, 13, 4, 0, 0, TAU);
      p.ctx.fill();
      p.ctx.drawImage(frame.img, 0, 0);
    }
  },
};
