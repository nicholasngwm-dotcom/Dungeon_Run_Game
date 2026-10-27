// The potion guide on the alchemy table in the lobby's library corner: every
// potion Mira can sell, one entry per family with its tiers, what each does
// and its stage 1 price. Filter chips narrow it down by what the potion is for.

const POTION_GUIDE_GROUPS = {
  all: null,
  healing: ['heal', 'regen', 'purity'],
  mana: ['mana', 'manaRegen'],
  attack: ['rage', 'focus', 'strength', 'bulldose', 'inferno'],
  defence: ['ironskin', 'thorns', 'teleport', 'speed'],
};

const PotionGuide = {
  group: 'all',

  open() {
    this.render();
    Menus.show('potions');
  },

  setGroup(g) {
    this.group = g;
    this.render();
  },

  /** Potion families in the order POTION_DEFS lists them, each with its tiers. */
  get families() {
    const fams = {};
    for (const pot of Object.values(POTIONS)) (fams[pot.family] = fams[pot.family] || []).push(pot);
    const only = POTION_GUIDE_GROUPS[this.group];
    return Object.entries(fams).filter(([f]) => !only || only.includes(f));
  },

  /** What a family is for (its filter group's name), for the tag on its card. */
  groupOf(family) {
    return Object.entries(POTION_GUIDE_GROUPS).find(([g, list]) => list && list.includes(family))?.[0] || '';
  },

  /**
   * One card per potion family: a header in the family's colour with its strongest bottle shown big,
   * its name and what it's for; then a row per tier - the bottle, a tier badge (I / II / III), the
   * potion's name, what it does and its stage 1 price.
   */
  render() {
    document.getElementById('potion-groups').innerHTML = Object.keys(POTION_GUIDE_GROUPS)
      .map((g) => `<button class="chip${this.group === g ? ' on' : ''}" data-action="potionGroup:${g}">${g.toUpperCase()}</button>`).join('');
    document.getElementById('potion-list').innerHTML = this.families.map(([family, pots]) => {
      const [liquid, light] = POTION_COLORS[family];
      const top = pots[pots.length - 1];
      const rows = pots.map((pot) => `
        <div class="pgx-row">
          <canvas width="28" height="28" data-potion="${pot.id}"></canvas>
          <i class="pgx-tier" style="color:${TIER_COLORS[pot.tier]}">${TIER_MARKS[pot.tier]}</i>
          <div class="pgx-text"><b>${pot.name}</b><span>${pot.desc}</span></div>
          <div class="pgx-price">${pot.price}<em></em></div>
        </div>`).join('');
      return `<div class="pgx-card" style="--fam:${liquid};--light:${light}">
        <div class="pgx-head">
          <canvas class="pgx-big" width="28" height="28" data-potion="${top.id}"></canvas>
          <b>${BREW_LABELS[family] || top.name.replace(/^(Super |Large )?/, '').replace(/ Potion$/, '').toUpperCase()}</b>
          <span>${this.groupOf(family).toUpperCase()}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');
    for (const c of document.querySelectorAll('#potion-list canvas')) {
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Sprites.potions[c.dataset.potion], 0, 0);
    }
  },
};
