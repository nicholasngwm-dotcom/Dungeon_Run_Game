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
  ['rage', 1, 'Rage Potion', 14, 0.25, 20, '+25% attack speed (left click) for 20s.'],
  ['rage', 3, 'Super Rage Potion', 24, 0.5, 20, '+50% attack speed (left click) for 20s.'],
  ['focus', 1, 'Focus Potion', 14, 0.1, 20, '+10% crit chance for 20s.'],
  ['focus', 3, 'Super Focus Potion', 24, 0.25, 20, '+25% crit chance for 20s.'],
  ['strength', 1, 'Strength Potion', 14, 0.15, 20, '+15% damage for 20s.'],
  ['strength', 3, 'Super Strength Potion', 24, 0.3, 20, '+30% damage for 20s.'],
  ['speed', 1, 'Speed Potion', 10, 0.2, 15, '+20% move speed for 15s.'],
  ['speed', 3, 'Super Speed Potion', 20, 0.5, 15, '+50% move speed for 15s.'],
  ['bulldose', 1, 'Bulldose Potion', 8, 0.25, 20, 'Your hits knock enemies back 25% further for 20s.'],
  ['bulldose', 3, 'Super Bulldose Potion', 14, 0.5, 20, 'Your hits knock enemies back 50% further for 20s.'],
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

/** Reach of the Inferno potion's ring of fire around the hero (px). */
const INFERNO_RADIUS = 180;

/** A potion's price at this point of the run (prices rise each stage). */
function potionPrice(run, id) {
  return Math.round(POTIONS[id].price * run.priceScale);
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

/** Builds Sprites.potions[id]: 28x28 bottle icons (bigger, fancier bottles for higher tiers). */
function buildPotionSprites() {
  Sprites.potions = {};
  for (const pot of Object.values(POTIONS)) {
    const [liquid, light] = POTION_COLORS[pot.family];
    Sprites.potions[pot.id] = PixelArt.make(28, 28, (p) => {
      const glass = '#c8d8e8';
      const cork = '#9a6a3a';
      if (pot.tier === 1) {
        // small round flask
        p.rect(12, 5, 4, 3, cork);
        p.rect(11, 8, 6, 3, glass);
        p.circle(14, 17, 7, glass);
        p.ellipse(14, 18, 6, 5, liquid);
        p.rect(11, 14, 2, 4, light);
      } else if (pot.tier === 2) {
        // tall bottle
        p.rect(12, 2, 4, 3, cork);
        p.rect(11, 5, 6, 4, glass);
        p.round(8, 9, 12, 16, glass, 3);
        p.round(9, 12, 10, 12, liquid, 2);
        p.rect(10, 13, 2, 7, light);
      } else {
        // ornate flask with a gold band and a star
        p.rect(12, 1, 4, 3, '#d4ac4c');
        p.rect(11, 4, 6, 3, glass);
        p.poly([[7, 9], [21, 9], [24, 17], [20, 25], [8, 25], [4, 17]], glass);
        p.poly([[8, 12], [20, 12], [22, 17], [19, 23], [9, 23], [6, 17]], liquid);
        p.rect(7, 9, 14, 2, '#d4ac4c');
        p.rect(9, 13, 2, 6, light);
        p.rect(19, 15, 3, 1, '#fff2a0'); p.rect(20, 14, 1, 3, '#fff2a0');
      }
    }, OUTLINE, 0.5);
  }
}

/**
 * A potion store's stock: 6 different potions, 1-4 of each, at least one of
 * them heal-type. Runs inside the shared simulation (Math.random is seeded).
 */
function rollPotionStock() {
  const all = Object.values(POTIONS);
  const heals = all.filter((p) => HEAL_FAMILIES.includes(p.family));
  const picked = [choose(heals)];
  while (picked.length < 6) {
    const p = choose(all);
    if (!picked.includes(p)) picked.push(p);
  }
  // shuffle so the heal isn't always first
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.map((p) => ({ id: p.id, left: randInt(1, 4) }));
}

/** Short label for a potion's effect while it's active (HUD). */
const BREW_LABELS = {
  regen: 'REGEN', manaRegen: 'MANA REGEN', rage: 'RAGE', focus: 'FOCUS', strength: 'STRENGTH', speed: 'SPEED',
  bulldose: 'BULLDOSE', ironskin: 'IRONSKIN', thorns: 'THORNS', purity: 'PURITY', inferno: 'INFERNO',
};

/** Tier marks shown with a running effect (HUD chips, pop-up text): plain I, large II, super III. */
const TIER_MARKS = { 1: 'I', 2: 'II', 3: 'III' };
const TIER_COLORS = { 1: '#d8cfe4', 2: '#8ad8ff', 3: '#ffd34a' };
