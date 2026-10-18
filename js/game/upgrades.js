// Shop upgrades (dungeon runs): simple stat boosts bought with coins. Each
// can be bought up to CONFIG.run.shop.maxLevel times per run; the price
// grows with every level. Five are the same for everyone; the sixth fits the
// hero's resource (mana / energy / light) or, for heroes without one, speeds
// up their abilities.

const SHOP_UPGRADES = [
  {
    id: 'vitality', name: 'Vital Draught', price: 14, color: '#e84a4a',
    desc: '+40 max HP (and heals 40)',
    apply(p) { p.maxHp += 40; p.hp = Math.min(p.maxHp, p.hp + 40); },
  },
  {
    id: 'regen', name: 'Troll Blood', price: 16, color: '#6cff7a',
    desc: '+1 HP per second, even while fighting',
    apply(p) { p.bonusRegen += 1; },
  },
  {
    id: 'attackSpeed', name: 'Quick Hands', price: 18, color: '#ffd34a',
    desc: '+15% attack speed (left click)',
    apply(p) { p.attackSpeed *= 1.15; },
  },
  {
    id: 'power', name: 'Whetstone', price: 20, color: '#ff8a4a',
    desc: '+10% damage',
    apply(p) { p.upgradeDamage *= 1.1; },
  },
  {
    id: 'swift', name: 'Light Boots', price: 12, color: '#9ad0ff',
    desc: '+8% move speed',
    apply(p) { p.speed *= 1.08; },
  },
  // the hero-specific one: picked by resource
  {
    id: 'mana', name: 'Arcane Font', price: 15, color: '#4a8aff', resource: 'MANA',
    desc: '+3 mana per second',
    apply(p) { p.resource.regen += 3; },
  },
  {
    id: 'energy', name: 'Second Wind', price: 15, color: '#f0c040', resource: 'ENERGY',
    desc: '+1.5 energy per second',
    apply(p) { p.resource.regen += 1.5; },
  },
  {
    id: 'light', name: 'Lantern of Faith', price: 22, color: '#ffe680', resource: 'LIGHT',
    desc: '+1 light orb capacity (and one orb)',
    apply(p) { p.resource.max += 1; p.resource.value += 1; },
  },
  {
    id: 'haste', name: 'War Focus', price: 18, color: '#c08aff', resource: null,
    desc: 'Abilities (RMB, E, F) recharge 12% faster',
    apply(p) { p.abilityHaste *= 1.12; },
  },
];

/** The six upgrades this hero sees: the five shared ones plus the one for their resource. */
function shopStock(player) {
  const res = player.resource ? player.resource.name : null;
  return SHOP_UPGRADES.filter((u) => !('resource' in u) || u.resource === res);
}

/** Small pixel icon per upgrade, drawn into a canvas. */
function drawUpgradeIcon(ctx, id, color) {
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  ctx.clearRect(0, 0, 32, 32);
  const D = OUTLINE;
  switch (id) {
    case 'vitality': // red potion
      px(12, 4, 8, 4, '#9a6a3a'); px(11, 8, 10, 4, '#c8d8e8'); px(7, 12, 18, 16, D);
      px(8, 13, 16, 14, color); px(10, 15, 3, 6, '#ff9a9a'); break;
    case 'regen': // green heart
      px(6, 8, 8, 8, color); px(18, 8, 8, 8, color); px(6, 12, 20, 6, color); px(9, 18, 14, 4, color);
      px(12, 22, 8, 3, color); px(14, 25, 4, 2, color); px(9, 10, 3, 3, '#c8ffd0'); break;
    case 'attackSpeed': // three speed lines and a sword
      for (let i = 0; i < 3; i++) px(3, 9 + i * 6, 8, 2, '#f4ead7');
      px(12, 14, 16, 4, '#adb2c0'); px(12, 14, 16, 1, '#ffffff'); px(9, 11, 3, 10, color); px(5, 15, 4, 2, '#7d532f'); break;
    case 'power': // whetstone + spark
      px(4, 18, 24, 8, '#585d6c'); px(4, 18, 24, 2, '#80869a'); px(14, 4, 4, 10, color); px(10, 8, 12, 2, color); px(15, 6, 2, 2, '#ffffff'); break;
    case 'swift': // boot with a wing
      px(10, 8, 8, 14, '#7d532f'); px(10, 20, 16, 6, '#7d532f'); px(10, 24, 16, 2, '#5b3922');
      px(3, 10, 7, 3, color); px(4, 14, 6, 3, color); px(5, 18, 5, 2, color); break;
    case 'mana': case 'light': // glowing orb
      px(8, 8, 16, 16, D); px(9, 9, 14, 14, color); px(11, 11, 4, 4, '#ffffff'); break;
    case 'energy': // lightning bolt
      px(16, 3, 6, 4, color); px(12, 7, 7, 6, color); px(10, 13, 12, 3, color); px(14, 16, 5, 6, color); px(12, 22, 4, 6, color); break;
    case 'haste': // hourglass
      px(8, 4, 16, 3, '#9c6c3e'); px(8, 25, 16, 3, '#9c6c3e'); px(10, 7, 12, 4, color); px(13, 11, 6, 3, color);
      px(15, 14, 2, 4, color); px(13, 18, 6, 3, color); px(10, 21, 12, 4, color); break;
  }
}

/** The shop window: six cards, coins, and the shopkeeper's reaction line. */
const Shop = {
  run: null,

  open(run) {
    this.run = run;
    this.say(choose(['Take your time, dear.', 'Everything here is guaranteed... mostly.', 'Coins first, questions later!']));
    this.render();
    Menus.show('shop');
  },

  get isOpen() { return !document.getElementById('screen-shop').classList.contains('hidden'); },

  level(u) { return this.run.upgradeLevels[u.id] || 0; },
  price(u) { return Math.round(u.price * Math.pow(CONFIG.run.shop.priceGrowth, this.level(u))); },

  say(text) { document.getElementById('shop-line').textContent = `"${text}"`; },

  render() {
    const run = this.run;
    const p = run.world.player;
    const max = CONFIG.run.shop.maxLevel;
    document.getElementById('shop-coins').textContent = run.coins;
    const grid = document.getElementById('shop-items');
    grid.innerHTML = shopStock(p).map((u) => {
      const lvl = this.level(u);
      const maxed = lvl >= max;
      const price = this.price(u);
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="shop-item${maxed ? ' maxed' : ''}">
        <canvas width="32" height="32" data-icon="${u.id}" data-color="${u.color}"></canvas>
        <div class="shop-info"><b style="color:${u.color}">${u.name}</b><span>${u.desc}</span><div class="pips">${pips}</div></div>
        <button class="buy" data-action="buy:${u.id}" ${maxed || run.coins < price ? 'disabled' : ''}>${maxed ? 'MAXED' : `${price}<em></em>`}</button>
      </div>`;
    }).join('');
    for (const c of grid.querySelectorAll('canvas')) drawUpgradeIcon(c.getContext('2d'), c.dataset.icon, c.dataset.color);
  },

  buy(id) {
    const run = this.run;
    const u = SHOP_UPGRADES.find((x) => x.id === id);
    if (!u || this.level(u) >= CONFIG.run.shop.maxLevel) return;
    const price = this.price(u);
    if (run.coins < price) {
      this.say("You're a little short, dear.");
      Sound.play('denied');
      return;
    }
    run.coins -= price;
    run.upgradeLevels[u.id] = this.level(u) + 1;
    u.apply(run.world.player);
    Sound.play('buy');
    this.say(choose(['A fine choice!', 'Pleasure doing business.', 'That one suits you.', 'Come back soon!']));
    this.render();
  },
};
