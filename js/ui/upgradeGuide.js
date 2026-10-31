// The enchantment tome on its enchanting table in the lobby's library: every upgrade Bram can bind
// to a hero in the dungeon shops (SHOP_UPGRADES), with its icon, what it does and its cooldown.
// The general ones any hero can be offered come first, then each hero's own. Chips narrow it to
// the general upgrades or one hero's.

const UpgradeGuide = {
  filter: 'all',

  open() {
    this.render();
    Menus.show('tome');
  },

  setFilter(f) {
    this.filter = f;
    this.render();
  },

  /** [title, color, upgrades] sections: the general ones, then each hero's (the filter picks which). */
  get sections() {
    const out = [];
    if (this.filter === 'all' || this.filter === 'general') out.push(['GENERAL - ANY HERO', '#c8a0ff', SHOP_UPGRADES.filter((u) => !u.hero && !u.dark)]);
    for (const [id, c] of Object.entries(CONFIG.classes)) {
      if (this.filter !== 'all' && this.filter !== id) continue;
      const list = SHOP_UPGRADES.filter((u) => u.hero === id);
      if (list.length) out.push([`${c.name.toUpperCase()} ONLY`, '#ffd34a', list]);
    }
    // the dark trader's own: never in the shops
    if (this.filter === 'all' || this.filter === 'general') out.push([`ONLY FROM THE DARK TRADER (FOR ${CONFIG.run.darkTrader.hp} HP)`, '#b45aff', SHOP_UPGRADES.filter((u) => u.dark)]);
    return out;
  },

  render() {
    const chips = [['all', 'ALL'], ['general', 'GENERAL'], ...Object.entries(CONFIG.classes).map(([id, c]) => [id, c.name.toUpperCase()])];
    document.getElementById('tome-filters').innerHTML = chips
      .map(([f, label]) => `<button class="chip${this.filter === f ? ' on' : ''}" data-action="tomeFilter:${f}">${label}</button>`).join('');
    const total = SHOP_UPGRADES.length;
    document.getElementById('tome-count').textContent = `${total} enchantments: ${SHOP_UPGRADES.filter((u) => !u.hero && !u.dark).length} general, ${SHOP_UPGRADES.filter((u) => u.hero).length} for one hero only, ${SHOP_UPGRADES.filter((u) => u.dark).length} only the dark trader deals in.`;
    // each section: a heading, then its upgrades as cards filling the rows left to right
    document.getElementById('tome-list').innerHTML = this.sections.map(([title, color, list]) => {
      const cards = list.map((u) => {
        const cd = u.cooldown ? `<em>COOLDOWN ${u.cooldown >= 60 ? `${u.cooldown / 60} MIN` : `${u.cooldown}s`}</em>` : '';
        const mp = u.id === 'resurrect' ? '<em>MULTIPLAYER ONLY</em>' : '';
        return `
        <div class="tome-card" style="--glow:${u.color}">
          <canvas data-icon="${u.id}"></canvas>
          <b style="color:${u.color}">${u.name}</b>
          <span>${u.desc}</span>${cd}${mp}
        </div>`;
      }).join('');
      return `<div class="tome-section" style="--fam:${color}"><h4>${title}</h4><div class="tome-cards">${cards}</div></div>`;
    }).join('');
    for (const c of document.querySelectorAll('#tome-list canvas[data-icon]')) drawUpgradeIcon(c, c.dataset.icon);
  },
};
