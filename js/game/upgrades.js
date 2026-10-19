// Shop: the upgrade store and the potion store in every stage's shop room.
//
// Upgrade store: each hero is offered 3 random upgrades and may buy ONE of
// them; rerolling (for coins, pricier each time) swaps the 3 for new ones.
// Offers come from a seed (run + stage + hero + rerolls), so every machine and
// the shop window agree on them without sending them around. Each upgrade can
// be owned up to CONFIG.run.shop.maxLevel times per run.
//
// Potion store: 6 different potions, 1-4 of each (see potions.js), shared by
// the whole party.

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

/** Price of an upgrade when the hero already owns `level` of it. */
function upgradePrice(u, level) {
  return Math.round(u.price * Math.pow(CONFIG.run.shop.priceGrowth, level));
}

/** Price of the next reroll at this stage's upgrade store. */
function rerollPrice(rerolls) {
  const r = CONFIG.run.shop.reroll;
  return r.base + r.step * rerolls;
}

/** Small string hash (FNV-1a) for seeding. */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The (up to) 3 upgrades on offer to a hero right now: a seeded shuffle of the
 * upgrades they can still level, so it's the same on every machine.
 */
function upgradeOffers(run, hero) {
  const st = run.shopState(hero);
  const pool = shopStock(hero).filter((u) => (hero.upgradeLevels[u.id] || 0) < CONFIG.run.shop.maxLevel);
  const rng = seededRng(hashString(`${run.shopSeed}|${hero.netId || 'solo'}|${st.rerolls}`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/**
 * The shop window, in one of two modes: 'upgrades' (Bram's enchantments: pick
 * one of three, or reroll) or 'potions' (Mira's potions: six on the shelf, plus
 * your bag). Buying sends a command (App.command) - in multiplayer it's applied
 * a moment later on every machine, so the window re-renders whenever anything
 * it shows changes.
 */
const Shop = {
  run: null,
  mode: 'upgrades',
  shown: '',

  open(run, mode) {
    this.run = run;
    this.mode = mode;
    this.say(mode === 'potions'
      ? choose(['Fresh from the cauldron!', 'One sip and you\'ll feel brand new, dear.', 'Mind the fizzy ones.'])
      : choose(['Pick one. Choose wisely.', 'Power has a price, adventurer.', 'Not to your liking? I can show you others... for a fee.']));
    this.render();
    Menus.show('shop');
  },

  get isOpen() { return !document.getElementById('screen-shop').classList.contains('hidden'); },
  get hero() { return this.run.world.localPlayer; },

  say(text) { document.getElementById('shop-line').textContent = `"${text}"`; },

  /** Everything the window shows, to notice changes. */
  signature() {
    const p = this.hero;
    return JSON.stringify([this.mode, p.coins, p.upgradeLevels, p.inventory, this.run.shopState(p), this.run.potionStock]);
  },

  /** Re-renders if anything shown changed since last time. */
  refresh() {
    if (!this.isOpen || !this.run) return;
    if (this.signature() !== this.shown) this.render();
  },

  render() {
    this.shown = this.signature();
    const p = this.hero;
    document.getElementById('shop-coins').textContent = p.coins;
    const potions = this.mode === 'potions';
    document.getElementById('shop-title').textContent = potions ? "Mira's Potions" : "Bram's Enchantments";
    const grid = document.getElementById('shop-items');
    grid.className = `shop-items ${this.mode}`;
    if (potions) this.renderPotions(grid, p);
    else this.renderUpgrades(grid, p);
  },

  renderUpgrades(grid, p) {
    const st = this.run.shopState(p);
    const offers = upgradeOffers(this.run, p);
    const max = CONFIG.run.shop.maxLevel;
    grid.innerHTML = offers.map((u) => {
      const lvl = p.upgradeLevels[u.id] || 0;
      const price = upgradePrice(u, lvl);
      const chosen = st.bought === u.id;
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const btn = chosen ? '<button class="buy" disabled>CHOSEN</button>'
        : st.bought ? '<button class="buy" disabled>-</button>'
          : `<button class="buy" data-action="buy:${u.id}" ${p.coins < price ? 'disabled' : ''}>${price}<em></em></button>`;
      return `<div class="shop-card${chosen ? ' chosen' : ''}${st.bought && !chosen ? ' faded' : ''}">
        <canvas width="32" height="32" data-icon="${u.id}" data-color="${u.color}"></canvas>
        <b style="color:${u.color}">${u.name}</b>
        <span>${u.desc}</span>
        <div class="pips">${pips}</div>
        ${btn}
      </div>`;
    }).join('') || '<p class="shop-empty">You have every upgrade maxed out!</p>';
    for (const c of grid.querySelectorAll('canvas')) drawUpgradeIcon(c.getContext('2d'), c.dataset.icon, c.dataset.color);
    const extra = document.getElementById('shop-extra');
    if (st.bought) {
      extra.innerHTML = '<p class="shop-note">You made your choice. New upgrades at the next stage\'s shop.</p>';
    } else {
      const price = rerollPrice(st.rerolls);
      extra.innerHTML = `<button class="btn small reroll" data-action="reroll" ${p.coins < price ? 'disabled' : ''}>Reroll &nbsp;${price}<em></em></button>`;
    }
    document.getElementById('shop-hint').textContent = `Pick ONE upgrade per shop. It lasts the whole run; each can be owned ${max} times.`;
  },

  renderPotions(grid, p) {
    grid.innerHTML = this.run.potionStock.map((s) => {
      const pot = POTIONS[s.id];
      const out = s.left <= 0;
      const full = !p.canCarry(s.id);
      const label = out ? 'SOLD OUT' : full ? 'BAG FULL' : `${pot.price}<em></em>`;
      return `<div class="shop-card potion${out ? ' faded' : ''}">
        <canvas width="28" height="28" data-potion="${pot.id}"></canvas>
        <b style="color:${POTION_COLORS[pot.family][1]}">${pot.name}</b>
        <span>${pot.desc}</span>
        <div class="stock">${out ? 'none left' : `${s.left} left`}</div>
        <button class="buy" data-action="buyPotion:${pot.id}" ${out || full || p.coins < pot.price ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    for (const c of grid.querySelectorAll('canvas')) c.getContext('2d').drawImage(Sprites.potions[c.dataset.potion], 0, 0);
    // the bag: what this hero is carrying, with the keys to drink it
    const extra = document.getElementById('shop-extra');
    extra.innerHTML = `<div class="bag"><span class="bag-label">YOUR BAG</span>${p.inventory.map((s, i) => `
      <div class="bag-slot" data-slot="${i}"${s ? ' draggable="true"' : ''}><i>${Settings.label(`item${i + 1}`)}</i>${s ? `<canvas width="28" height="28" data-bag="${s.id}"></canvas><b>${s.count > 1 ? `x${s.count}` : ''}</b>` : ''}</div>`).join('')}</div>`;
    for (const c of extra.querySelectorAll('canvas')) c.getContext('2d').drawImage(Sprites.potions[c.dataset.bag], 0, 0);
    this.bindBagDrag(extra);
    document.getElementById('shop-hint').textContent = 'Potions go in your bag (5 slots, up to 5 of a kind each). Drag to rearrange; drink with the slot keys during a fight.';
  },

  /** Drag a bag slot onto another to move, swap or stack it (same command as the in-game bag). */
  bindBagDrag(root) {
    for (const el of root.querySelectorAll('.bag-slot')) {
      const i = Number(el.dataset.slot);
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(i));
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drop');
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from) && from !== i) App.command({ type: 'moveItem', from, to: i });
      });
    }
  },

  buy(id) {
    const p = this.hero;
    const u = SHOP_UPGRADES.find((x) => x.id === id);
    if (!u || this.run.shopState(p).bought) return;
    if (p.coins < upgradePrice(u, p.upgradeLevels[id] || 0)) {
      this.say("You'll need more coin than that.");
      Sound.play('denied');
      return;
    }
    App.command({ type: 'buy', upgrade: id });
  },

  reroll() {
    const p = this.hero;
    const st = this.run.shopState(p);
    if (st.bought) return;
    if (p.coins < rerollPrice(st.rerolls)) {
      this.say('A reroll costs coin, friend.');
      Sound.play('denied');
      return;
    }
    App.command({ type: 'reroll' });
  },

  buyPotion(id) {
    const p = this.hero;
    const pot = POTIONS[id];
    if (!pot) return;
    if (p.coins < pot.price) { this.say("You're a little short, dear."); Sound.play('denied'); return; }
    if (!p.canCarry(id)) { this.say('Your bag is full, dear!'); Sound.play('denied'); return; }
    App.command({ type: 'buyPotion', id });
  },

  /** A purchase went through (or didn't) - the keeper reacts if it was ours. what: 'upgrade' | 'reroll' | 'potion'. */
  onPurchase(hero, what, ok) {
    if (!this.run || hero !== this.hero) return;
    if (ok) {
      Sound.play('buy');
      if (what === 'reroll') this.say(choose(['Hmm... how about these?', 'Fresh choices, fresh fortunes.']));
      else if (what === 'potion') this.say(choose(['Drink it while it\'s fizzy!', 'Pleasure doing business.', 'Come back soon, dear!']));
      else this.say(choose(['A fine choice. It is yours.', 'The enchantment takes hold...', 'Use it well.']));
    } else {
      Sound.play('denied');
      this.say(what === 'potion' ? 'Ah... someone beat you to it, dear.' : 'That deal is off the table.');
    }
    this.render();
  },
};
