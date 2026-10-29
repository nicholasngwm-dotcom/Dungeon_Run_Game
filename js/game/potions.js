// Potions: sold in the shop's potion store, carried in the 5-slot inventory
// (up to BAG_STACK of a kind per slot) and drunk with keys 1-5. Each potion belongs to a family (heal, speed,
// thorns...) and a tier (1 plain, 2 large, 3 super). Timed effects live on the
// hero as "brews" (Player.brews[family] = { t, v, tier, under }). One effect of a kind at
// a time: the same family can't be drunk again until it wears off, except a higher
// tier, which goes on over the weaker one (that keeps running underneath, and takes
// over again if it outlasts the stronger one).
//
// Everything here runs inside the shared simulation (drinking is a key press,
// buying is a command), so it stays in sync in multiplayer.

const POTION_DEFS = [
  // family, tier, name, price, effect value, duration (s), description
  ['heal', 1, 'Health Potion', 8, 40, 0, 'Heals 40 HP.'],
  ['heal', 2, 'Large Health Potion', 16, 100, 0, 'Heals 100 HP.'],
  ['heal', 3, 'Super Health Potion', 28, 200, 0, 'Heals 200 HP.'],
  ['regen', 1, 'Regen Potion', 9, 1, 10, 'Regenerate 2% of your max HP per second for 10s.'],
  ['regen', 2, 'Large Regen Potion', 16, 1, 30, 'Regenerate 2% of your max HP per second for 30s.'],
  ['regen', 3, 'Super Regen Potion', 26, 2, 30, 'Regenerate 4% of your max HP per second for 30s.'],
  ['mana', 1, 'Mana Potion', 8, 20, 0, 'Restores 20 mana (or energy; 1 light orb).'],
  ['mana', 2, 'Large Mana Potion', 14, 50, 0, 'Restores 50 mana (or energy; 2 light orbs).'],
  ['mana', 3, 'Super Mana Potion', 22, 100, 0, 'Restores 100 mana (or energy; 4 light orbs).'],
  ['manaRegen', 1, 'Mana Regen Potion', 8, 0.2, 30, 'Mana / energy regenerates 20% faster for 30s.'],
  ['manaRegen', 2, 'Large Mana Regen Potion', 14, 0.4, 30, 'Mana / energy regenerates 40% faster for 30s.'],
  ['manaRegen', 3, 'Super Mana Regen Potion', 24, 1, 30, 'Mana / energy regenerates twice as fast for 30s.'],
  ['rage', 1, 'Rage Potion', 14, 0.25, 20, '+25% attack speed (primary attack) for 20s.'],
  ['rage', 3, 'Super Rage Potion', 24, 0.5, 20, '+50% attack speed (primary attack) for 20s.'],
  ['focus', 1, 'Focus Potion', 14, 0.1, 20, '+10% crit chance for 20s.'],
  ['focus', 3, 'Super Focus Potion', 24, 0.25, 20, '+25% crit chance for 20s.'],
  ['strength', 1, 'Strength Potion', 14, 0.15, 20, '+15% damage for 20s.'],
  ['strength', 3, 'Super Strength Potion', 24, 0.3, 20, '+30% damage for 20s.'],
  ['speed', 1, 'Speed Potion', 10, 0.2, 15, '+20% move speed for 15s.'],
  ['speed', 3, 'Super Speed Potion', 20, 0.5, 15, '+50% move speed for 15s.'],
  ['bulldose', 1, 'Bulldose Potion', 8, 0.6, 20, 'Your hits knock enemies back 60% harder for 20s. Enemies slammed into walls take more damage the harder they hit.'],
  ['bulldose', 3, 'Super Bulldose Potion', 14, 1.2, 20, 'Your hits knock enemies back more than twice as hard for 20s. Enemies slammed into walls take more damage the harder they hit.'],
  ['teleport', 1, 'Teleportation Potion', 12, 2, 0, 'Teleports you to a random spot in the room, invulnerable for 2s.'],
  ['ironskin', 1, 'Ironskin Potion', 14, 4, 30, '+4 defence (every hit deals 4 less damage) for 30s.'],
  ['thorns', 1, 'Thorns Potion', 10, 0.1, 30, 'Reflects 10% of damage you take back at the attacker for 30s.'],
  ['thorns', 2, 'Large Thorns Potion', 16, 0.15, 30, 'Reflects 15% of damage you take back at the attacker for 30s.'],
  ['thorns', 3, 'Super Thorns Potion', 26, 0.3, 30, 'Reflects 30% of damage you take back at the attacker for 30s.'],
  ['purity', 1, 'Purity Potion', 14, 1, 3, 'Cleanses poison, slows and stuns, and makes you immune to them for 3s.'],
  ['inferno', 1, 'Inferno Potion', 26, 30, 8, 'A wide ring of fire circles you for 8s, burning enemies around you (30 damage per second) and setting them on fire.'],
];

/** How many of one potion fit in a bag slot. */
const BAG_STACK = 10;

/** Bag slots every hero starts with (the Backpack upgrade adds more). */
const BAG_SLOTS = 5;

/** Reach of the Inferno potion's ring of fire around the hero (px). */
const INFERNO_RADIUS = 180;

/** A potion's price at this point of the run (prices rise each stage), for this hero (Discount Cards). full: before any discount. */
function potionPrice(run, id, hero, full = false) {
  return Math.round(POTIONS[id].price * run.priceScale * (full ? 1 : Upgrades.priceScale(hero)));
}

const POTIONS = {};
for (const [family, tier, name, price, value, duration, desc] of POTION_DEFS) {
  const id = name.toLowerCase().replace(/ /g, '-');
  POTIONS[id] = { id, family, tier, name, price, value, duration, desc };
}

// colour per family: [glass liquid, highlight]
const POTION_COLORS = {
  heal: ['#d8303a', '#ff9a9a'], regen: ['#3ab84a', '#a8ffb0'], mana: ['#2a5ad0', '#8ab8ff'],
  manaRegen: ['#3aa0c8', '#a8e8ff'], rage: ['#e0602a', '#ffb07a'], focus: ['#e0c030', '#fff2a0'],
  strength: ['#a82a2a', '#ff7a5a'], speed: ['#30c8b0', '#a8fff0'], bulldose: ['#8a6a4a', '#d8b890'],
  teleport: ['#9a4ae0', '#e0b8ff'], ironskin: ['#7a8090', '#d0d6e0'], thorns: ['#4a8a2a', '#b8e07a'],
  purity: ['#e8e8f8', '#ffffff'], inferno: ['#ff6a1e', '#ffd34a'],
};

/** Heal-type potions: the shop always stocks at least one. */
const HEAL_FAMILIES = ['heal', 'regen'];

/**
 * Each potion family's bottle (Terraria-style: every kind its own shape, easy to tell apart at a
 * glance). body(p, d, c) fills the bottle's body inset by d px (d = 0: the glass, 1+: the liquid
 * inside); neck: [top, bottom] rows of its neck (null: none); fill: the row the liquid comes up to;
 * mark(p, light, white) paints its symbol on the liquid; extra(p) adds trim over the glass (bands,
 * spikes, flames). All on a 28x28 canvas, the bottle standing on row 26.
 */
const POTION_BOTTLES = {
  // health: the classic round flask, a heart in it
  heal: { neck: [6, 12], fill: 13, body: (p, d, c) => p.circle(14, 18, 8 - d, c),
    mark: (p, l, w) => { p.rect(11, 16, 2, 2, w); p.rect(15, 16, 2, 2, w); p.rect(11, 18, 6, 2, w); p.rect(12, 20, 4, 1, w); p.rect(13, 21, 2, 1, w); } },
  // regeneration: a squat jar, a leaf in it
  regen: { neck: [8, 13], fill: 15, body: (p, d, c) => p.round(5 + d, 13 + d, 18 - d * 2, 13 - d * 2, c, 3),
    mark: (p, l, w) => { p.poly([[10, 22], [17, 15], [18, 16], [12, 23]], w); p.line(10, 23, 15, 18, l); } },
  // mana: a conical flask, a star in it
  mana: { neck: [5, 10], fill: 14, body: (p, d, c) => p.poly([[11 + d * 0.5, 9 + d], [17 - d * 0.5, 9 + d], [23 - d, 26 - d], [5 + d, 26 - d]], c),
    mark: (p, l, w) => { p.rect(13, 16, 2, 7, w); p.rect(11, 18, 6, 3, w); p.px(10, 19, w); p.px(17, 19, w); } },
  // mana regeneration: a tall test-tube vial, rising waves in it
  manaRegen: { neck: null, fill: 10, body: (p, d, c) => p.round(9 + d, 5 + d, 10 - d * 2, 21 - d * 2, c, 4),
    mark: (p, l, w) => { for (const y of [13, 17, 21]) { p.rect(11, y, 2, 1, w); p.rect(13, y - 1, 2, 1, w); p.rect(15, y, 2, 1, w); } } },
  // rage: a cut-glass diamond, a flame in it
  rage: { neck: [5, 9], fill: 14, body: (p, d, c) => p.poly([[14, 8 + d], [23 - d, 17], [14, 26 - d], [5 + d, 17]], c),
    mark: (p, l, w) => { p.poly([[11, 22], [12, 17], [14, 19], [15, 14], [17, 18], [17, 22]], w); p.rect(13, 20, 2, 2, l); } },
  // focus: a flat lens-shaped flask, an eye in it
  focus: { neck: [7, 13], fill: 15, body: (p, d, c) => p.ellipse(14, 20, 11 - d, 6 - d, c),
    mark: (p, l, w) => { p.poly([[8, 20], [14, 17], [20, 20], [14, 23]], w); p.rect(13, 19, 3, 3, l); p.px(14, 20, OUTLINE); } },
  // strength: a heavy square bottle with shoulders, a sword in it
  strength: { neck: [5, 10], fill: 13, body: (p, d, c) => p.poly([[9 + d, 10 + d], [19 - d, 10 + d], [22 - d, 13 + d], [22 - d, 26 - d], [6 + d, 26 - d], [6 + d, 13 + d]], c),
    mark: (p, l, w) => { p.rect(13, 14, 2, 8, w); p.rect(11, 21, 6, 1, w); p.rect(13, 22, 2, 2, l); } },
  // speed: a small bulb on a very long neck, a lightning bolt in it
  speed: { neck: [5, 15], fill: 17, body: (p, d, c) => p.circle(14, 20, 6 - d, c),
    mark: (p, l, w) => { p.poly([[15, 16], [12, 20], [14, 20], [12, 24], [17, 19], [15, 19]], w); } },
  // bulldose: a banded keg, chevrons pushing out
  bulldose: { neck: [7, 12], fill: 14, body: (p, d, c) => p.round(5 + d, 12 + d, 18 - d * 2, 14 - d * 2, c, 5),
    mark: (p, l, w) => { for (const x of [10, 15]) { p.line(x, 16, x + 3, 19, w); p.line(x + 3, 19, x, 22, w); } },
    extra: (p) => { p.rect(5, 15, 18, 1, '#8a6a4a'); p.rect(5, 23, 18, 1, '#8a6a4a'); } },
  // teleportation: a twisting teardrop, a swirl in it
  teleport: { neck: [5, 8], fill: 13, body: (p, d, c) => { p.circle(14, 20, 6 - d, c); p.poly([[14, 7 + d * 2], [20 - d, 19], [8 + d, 19]], c); },
    mark: (p, l, w) => { p.circle(14, 20, 3, w); p.circle(14, 20, 2, l); p.px(15, 19, w); p.px(13, 17, w); } },
  // ironskin: a shield-shaped bottle, riveted
  ironskin: { neck: [5, 11], fill: 14, body: (p, d, c) => p.poly([[6 + d, 11 + d], [22 - d, 11 + d], [22 - d, 18], [14, 26 - d], [6 + d, 18]], c),
    mark: (p, l, w) => { p.rect(13, 14, 2, 8, w); p.rect(10, 16, 8, 2, w); },
    extra: (p) => { for (const [x, y] of [[7, 12], [20, 12], [7, 17], [20, 17]]) p.px(x, y, '#d0d6e0'); } },
  // thorns: a round bottle bristling with thorns, a thorn in it
  thorns: { neck: [6, 11], fill: 14, body: (p, d, c) => p.circle(14, 19, 7 - d, c),
    mark: (p, l, w) => { p.poly([[11, 22], [14, 15], [17, 22]], w); p.rect(13, 20, 2, 2, l); },
    extra: (p) => { for (const [x0, y0, x1, y1] of [[6, 16, 3, 14], [6, 22, 3, 23], [22, 16, 25, 14], [22, 22, 25, 23], [10, 26, 9, 27], [18, 26, 19, 27]]) p.line(x0, y0, x1, y1, '#4a8a2a', 2); } },
  // purity: a tall elegant vase, a sparkle in it
  purity: { neck: [5, 10], fill: 13, body: (p, d, c) => p.poly([[12 + d * 0.5, 10], [16 - d * 0.5, 10], [21 - d, 21], [18 - d, 26 - d], [10 + d, 26 - d], [7 + d, 21]], c),
    mark: (p, l, w) => { p.rect(13, 15, 2, 8, w); p.rect(10, 18, 8, 2, w); p.px(11, 16, l); p.px(16, 21, l); } },
  // inferno: a fat cauldron-round flask with fire licking out of its mouth, a flame in it
  inferno: { neck: [8, 11], fill: 13, body: (p, d, c) => p.ellipse(14, 19, 10 - d, 7 - d, c),
    mark: (p, l, w) => { p.poly([[10, 23], [11, 18], [13, 20], [14, 15], [16, 19], [18, 17], [18, 23]], w); },
    extra: (p) => { p.poly([[11, 8], [12, 3], [14, 6], [15, 1], [17, 8]], '#ff8a1e'); p.poly([[13, 8], [14, 5], [16, 8]], '#ffd34a'); } },
};

/**
 * Builds Sprites.potions[id]: 28x28 bottle icons. Every family has its own bottle shape, colour and
 * symbol (POTION_BOTTLES); the tier shows on the stopper and trim: I a plain cork, II a silver cap and
 * collar, III a gold cap, a gold band round the neck and a twinkle.
 */
function buildPotionSprites() {
  Sprites.potions = {};
  const glass = '#c8d8e8';
  const glassDark = '#9aa8c0';
  for (const pot of Object.values(POTIONS)) {
    const B = POTION_BOTTLES[pot.family];
    const [liquid, light] = POTION_COLORS[pot.family];
    Sprites.potions[pot.id] = PixelArt.make(28, 28, (p) => {
      const c = p.ctx;
      const clipped = (x, y, w, h, fn) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); fn(); c.restore(); };
      // the neck and the glass body
      const neckTop = B.neck ? B.neck[0] : 5;
      if (B.neck) {
        p.rect(12, B.neck[0], 4, B.neck[1] - B.neck[0] + 1, glass);
        p.rect(15, B.neck[0], 1, B.neck[1] - B.neck[0] + 1, glassDark);
      }
      B.body(p, 0, glass);
      // the liquid up to its fill line, lit along its left side, a bright line at its surface
      clipped(0, B.fill, 28, 28, () => B.body(p, 1, liquid));
      clipped(0, B.fill, 11, 28, () => { B.body(p, 2, light); B.body(p, 3, liquid); });
      clipped(0, B.fill, 28, 1, () => B.body(p, 1, light));
      B.mark(p, light, '#ffffff');
      if (B.extra) B.extra(p);
      p.rect(9, B.fill - 3, 1, 2, '#ffffff');   // a glint on the glass
      // the stopper, by tier
      const top = neckTop - 3;
      if (pot.tier === 1) {
        p.rect(12, top, 4, 3, '#9a6a3a');
        p.rect(12, top, 4, 1, '#c8925a');
      } else if (pot.tier === 2) {
        p.rect(11, top, 6, 3, '#a8aebc');
        p.rect(11, top, 6, 1, '#e4e7ee');
        p.rect(11, top + 3, 6, 1, '#7a8092');                          // a silver collar
      } else {
        p.rect(11, top, 6, 3, '#d4ac4c');
        p.rect(11, top, 6, 1, '#fff2a0');
        p.rect(13, top - 2, 2, 2, '#d4ac4c');                          // the knob
        p.rect(11, top + 4, 6, 1, '#d4ac4c');                          // a gold band round the neck
        p.rect(21, 4, 3, 1, '#fff2a0'); p.rect(22, 3, 1, 3, '#fff2a0');   // a twinkle
      }
    }, OUTLINE, 0.5);
  }
}

/** A potion store's shelf: how many different potions, and how many of each: [fewest, most]. */
const POTION_STOCK = { kinds: 6, count: [3, 7] };

/**
 * A potion store's stock: six different potions (POTION_STOCK), 3-7 of each, at least one
 * of them heal-type. Runs inside the shared simulation (Math.random is seeded).
 */
function rollPotionStock() {
  const all = Object.values(POTIONS);
  const heals = all.filter((p) => HEAL_FAMILIES.includes(p.family));
  const picked = [choose(heals)];
  while (picked.length < POTION_STOCK.kinds) {
    const p = choose(all);
    if (!picked.includes(p)) picked.push(p);
  }
  // shuffle so the heal isn't always first
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.map((p) => ({ id: p.id, left: randInt(POTION_STOCK.count[0], POTION_STOCK.count[1]) }));
}

/** Short label for a potion's effect while it's active (HUD). */
const BREW_LABELS = {
  regen: 'REGEN', manaRegen: 'MANA REGEN', rage: 'RAGE', focus: 'FOCUS', strength: 'STRENGTH', speed: 'SPEED',
  bulldose: 'BULLDOSE', ironskin: 'IRONSKIN', thorns: 'THORNS', purity: 'PURITY', inferno: 'INFERNO',
};

/** Tier marks shown with a running effect (HUD chips, pop-up text): plain I, large II, super III. */
const TIER_MARKS = { 1: 'I', 2: 'II', 3: 'III' };
const TIER_COLORS = { 1: '#d8cfe4', 2: '#8ad8ff', 3: '#ffd34a' };
