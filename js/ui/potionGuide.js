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

  render() {
    document.getElementById('potion-groups').innerHTML = Object.keys(POTION_GUIDE_GROUPS)
      .map((g) => `<button class="chip${this.group === g ? ' on' : ''}" data-action="potionGroup:${g}">${g.toUpperCase()}</button>`).join('');
    const tierName = ['', 'PLAIN', 'LARGE', 'SUPER'];
    document.getElementById('potion-list').innerHTML = this.families.map(([family, pots]) => {
      const [liquid] = POTION_COLORS[family];
      const rows = pots.map((pot) => `
        <div class="pg-row">
          <canvas width="28" height="28" data-potion="${pot.id}"></canvas>
          <div class="pg-text">
            <b>${pot.name} <i>${tierName[pot.tier]}</i></b>
            <span>${pot.desc}</span>
          </div>
          <div class="pg-price">${pot.price}<em></em></div>
        </div>`).join('');
      return `<div class="pg-family" style="--fam:${liquid}"><h4>${BREW_LABELS[family] || pots[0].name.replace(/ Potion$/, '').toUpperCase()}</h4>${rows}</div>`;
    }).join('');
    for (const c of document.querySelectorAll('#potion-list canvas')) {
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Sprites.potions[c.dataset.potion], 0, 0);
    }
  },
};
