// Upgrades: what they do (SHOP_UPGRADES + the Upgrades hooks the heroes call), Bram's upgrade
// store in every stage's shop, and the free pick on entering each stage.
//
// Upgrade store: each hero sees 3 upgrades at a time and may buy as many as they can afford.
// The first costs CONFIG.run.shop.upgrade.base, and every one bought makes the next cost `step`
// more (for the rest of the run). A bought card is replaced by the next upgrade in line.
// Rerolling swaps the 3 for new ones; it gets pricier each time, back to the base price at the
// next stage's shop. Offers come from a seed (run + stage + hero + rerolls), so every machine
// and the shop window agree on them without sending them around. Each upgrade can be owned once.
// Hero upgrades (`hero`) only ever show up for that hero; the shared ones show up for every hero,
// even the few that only do something for some (mana, rockets, energy, followers or pets, a melee swing).
// (`needs` can still keep an upgrade back, e.g. Resurrect is only offered in multiplayer.)
//
// Potion store: 6 different potions, 3-7 of each (see potions.js), shared by
// the whole party. Potion prices rise with the stage (CONFIG.run.shop.stagePrice).

const BEATDOWN = { max: 20, decay: 1 };   // Beatdown: most stacks, and seconds without a hit for one to fall off

const SHOP_UPGRADES = [
  // ---------- shared ----------
  {
    id: 'vitalHeart', name: 'Vital Heart', color: '#e84a4a',
    desc: '+100 max HP. Your current HP stays the same.',
    apply(p) { p.maxHp += 100; },
    remove(p) { p.maxHp -= 100; p.hp = Math.min(p.hp, p.maxHp); },
  },
  {
    id: 'revitalisingBlood', name: 'Revitalising Blood', color: '#ff5a6a',
    desc: 'Regenerate 3 HP per second, even in battle.',
    apply(p) { p.bonusRegen += 3; },
    remove(p) { p.bonusRegen -= 3; },
    hud: (p) => ({ active: p.hp < p.maxHp }),
  },
  {
    id: 'piercingCrit', name: 'Piercing Crit', color: '#ffd34a',
    desc: 'Critical projectiles pierce through up to 5 enemies.',
  },
  {
    id: 'deadlyPrecision', name: 'Deadly Precision', color: '#ff9a2a',
    desc: 'While standing still, your crit chance and crit damage are doubled.',
    hud: (p) => ({ active: Upgrades.still(p) }),
  },
  {
    id: 'burstDodging', name: 'Burst Dodging', color: '#8ad8ff',
    desc: '2 dodges in a row, but each takes 60% longer to come back.',
    apply(p) { const s = Upgrades.state(p); s.dodges = 2; s.dodgeT = 0; p.maxCooldowns.dodge = Upgrades.burstCooldown(p); },
    remove(p) { p.maxCooldowns.dodge = p.dodgeCooldown; p.cooldowns.dodge = Math.min(p.cooldowns.dodge, p.dodgeCooldown); },
    hud: (p) => { const s = Upgrades.state(p); return { count: s.dodges, cd: s.dodges < 2 ? s.dodgeT : 0, max: Upgrades.burstCooldown(p) }; },
  },
  {
    id: 'firstEncounter', name: 'First Encounter', color: '#fff2a0',
    desc: 'Hitting an enemy at full HP is always a critical hit.',
  },
  {
    id: 'fightingSpirit', name: 'Fighting Spirit', color: '#ff7a3a',
    desc: '+10% attack speed and +10% move speed.',
    apply(p) { p.attackSpeed *= 1.1; p.speed *= 1.1; },
    remove(p) { p.attackSpeed /= 1.1; p.speed /= 1.1; },
  },
  {
    id: 'beatdown', name: 'Beatdown', color: '#ff5a3a',
    desc: 'Each melee basic attack that lands adds a stack (up to 20): +2% melee damage per stack. Lose 1 stack every second without a hit.',
    hud: (p) => { const s = Upgrades.state(p); return { count: s.stacks, active: s.stacks >= BEATDOWN.max }; },
  },
  {
    id: 'manaCrystal', name: 'Mana Crystal', color: '#4ad8ff',
    desc: 'Mana regenerates at 7 per second.',
    apply(p) { const r = p.resource; if (r?.name !== 'MANA') return; const was = r.regen; r.regen = Math.max(7, r.regen + 2); Upgrades.state(p).crystalRegen = r.regen - was; },
    remove(p) { if (p.resource?.name === 'MANA') p.resource.regen -= Upgrades.state(p).crystalRegen || 0; },
  },
  {
    id: 'celestialPeach', name: 'Celestial Peach', color: '#ffaac8',
    desc: '+50 max mana.',
    apply(p) { if (p.resource?.name === 'MANA') { p.resource.max += 50; p.resource.value += 50; } },
    remove(p) { const r = p.resource; if (r?.name === 'MANA') { r.max -= 50; r.value = Math.min(r.value, r.max); } },
  },
  {
    id: 'totalLoyalty', name: 'Total Loyalty', color: '#ffb84a',
    desc: 'Your followers and pets attack 50% faster and fight up close more eagerly.',
  },
  {
    id: 'strongerBuddies', name: 'Stronger Buddies', color: '#9ae06a',
    desc: 'Your followers and pets have 60% more HP and are bigger.',
  },
  {
    id: 'longerReach', name: 'Longer Reach', color: '#c8d8e8',
    desc: 'Melee attacks reach 25% further.',
  },
  {
    id: 'panicGetaway', name: 'Panic Getaway', color: '#b8f06a',
    desc: 'Below 50% HP you move 20% faster.',
    hud: (p) => ({ active: Upgrades.panicking(p) }),
  },
  {
    id: 'warDetermination', name: 'War Determination', color: '#c08aff',
    desc: 'Ability cooldowns (RMB, E, F) are 25% shorter.',
    apply(p) { p.abilityHaste *= 4 / 3; },
    remove(p) { p.abilityHaste *= 3 / 4; },
  },
  {
    id: 'blazeborn', name: 'Blazeborn', color: '#ff8a1e',
    desc: 'Immune to burning. Your fire attacks deal 30% more damage.',
  },
  {
    id: 'heartOfFrost', name: 'Heart of Frost', color: '#9ad0ff',
    desc: 'Immune to chills and freezing. Freezes you cause last 50% longer.',
  },
  {
    id: 'radialBarrier', name: 'Radial Barrier', color: '#6ae0c8',
    desc: 'Immune to traps. Enemies bumping into you deal 50% less damage.',
  },
  {
    id: 'lastDefence', name: 'The Last Defence', color: '#6aa8ff', cooldown: 180,
    desc: 'Dropping below 10% HP gives you a 200 HP shield.',
    hud: (p) => ({ cd: Upgrades.cd(p, 'lastDefence'), max: 180, active: !!p.lastShield }),
  },
  {
    id: 'biggerMagazine', name: 'Bigger Magazine', color: '#ff9a3a',
    desc: '30% more ammo.',
    apply(p) { const r = p.resource; if (r?.name !== 'AMMO') return; const more = Math.ceil(r.max * 1.3) - r.max; r.max += more; r.value += more; Upgrades.state(p).magazine = more; },
    remove(p) { const r = p.resource; if (r?.name !== 'AMMO') return; r.max -= Upgrades.state(p).magazine || 0; r.value = Math.min(r.value, r.max); },
  },
  {
    id: 'chestsOfAlchemy', name: 'Chests of Alchemy', color: '#ff6a7a',
    desc: 'Room chests may hold a health potion for you as well as coins.',
  },
  {
    id: 'coinSiphon', name: 'Coin Siphon', color: '#ffd34a',
    desc: 'Enemies you defeat have a 30% chance to drop 3-5 extra coins.',
  },
  {
    id: 'lifeLeech', name: 'Life Leech', color: '#e83a5a',
    desc: 'Enemies you defeat are much more likely to drop a heart (+15% chance).',
  },
  {
    // zap: how long whoever hit you (and anything right next to you) is Zapped: stunned, bosses too
    id: 'teslaArmour', name: 'Tesla Armour', color: '#6ad8ff', cooldown: 10, zap: 1,
    desc: '+25 max HP. When you\'re hit, a static shock leaps out at whoever hit you and ZAPS them: stunned for 1 second, even bosses.',
    apply(p) { p.maxHp += 25; p.hp += 25; },
    remove(p) { p.maxHp -= 25; p.hp = Math.min(p.hp, p.maxHp); },
    hud: (p) => ({ cd: Upgrades.cd(p, 'teslaArmour'), max: 10, active: Upgrades.cd(p, 'teslaArmour') <= 0 }),
  },
  {
    id: 'silverShield', name: 'Silver Shield', color: '#d8e0ec', cooldown: 20,
    desc: 'A silver ward blocks the next attack that hits you completely.',
    hud: (p) => ({ cd: Upgrades.cd(p, 'silverShield'), max: 20, active: Upgrades.cd(p, 'silverShield') <= 0 }),
  },
  {
    id: 'discountCards', name: 'Discount Cards', color: '#7ae0a0', discount: 0.1,
    desc: 'Every upgrade, reroll and potion in the shops costs you 10% less.',
  },
  {
    id: 'mimicSense', name: 'Mimic Sense', color: '#ff6a5a', range: 150,
    desc: 'You can sense mimics hiding as chests when you get near them. Mimics you kill have a 35% chance to drop all three super buffs.',
  },
  {
    id: 'bouncy', name: 'Bouncy!', color: '#ff9ad8', bounces: 2,
    desc: 'Your projectiles bounce off walls up to 2 times.',
  },
  {
    id: 'energyDrink', name: 'Energy Drink', color: '#f0e040', rate: 1.5,
    desc: 'Energy comes back 50% faster.',
  },
  {
    // slots: how many the bag holds with it (5 without)
    id: 'backpack', name: 'Backpack', color: '#c8925a', slots: 7,
    desc: 'Your bag holds 2 more potions (7 slots, keys 6 and 7 for the new ones).',
    apply(p) { while (p.inventory.length < UPGRADE_BY_ID.backpack.slots) p.inventory.push(null); },
    // (it can only be sold while its extra slots are empty: see canSell)
    canSell: (p) => p.inventory.slice(BAG_SLOTS).every((s) => !s),
    remove(p) { p.inventory.length = BAG_SLOTS; },
  },
  {
    id: 'potionDosage', name: 'Higher Potion Dosage', color: '#ff7a8a', scale: 1.5,
    desc: 'Health and regeneration potions heal 50% more.',
  },
  {
    // rate: how much of the ultimate's charge fills each second on its own (1/60: a full charge a minute)
    id: 'nuclearReactor', name: 'Nuclear Reactor', color: '#9aff4a', rate: 1 / 60,
    desc: 'Your ultimate slowly charges on its own over time (a full charge every minute), on top of the damage you deal.',
    hud: (p) => ({ active: p.ult < p.ultMax }),
  },
  {
    // chance: of an enemy you kill blowing up; after delay s it bursts, hitting every enemy within radius for damage
    id: 'lastHurrah', name: 'Last Hurrah', color: '#ff8a3a', chance: 0.25, delay: 0.35, radius: 80, damage: 45,
    desc: 'Enemies you kill have a 25% chance to blow up a moment later, hurting the enemies around them.',
  },
  {
    id: 'freeReroll', name: 'Free Reroll', color: '#8ac8ff',
    desc: 'Your first reroll at every shop is free.',
  },
  {
    // attackSpeed: how much faster basic attacks come back, for `time`s after a hit lands on you (once per `cooldown`s)
    id: 'adrenalineRush', name: 'Adrenaline Rush', color: '#ff4a6a', cooldown: 7, time: 4, attackSpeed: 0.4,
    desc: 'Taking damage gives you 40% faster attacks for 4 seconds. 7 second cooldown.',
    hud: (p) => ({ cd: Upgrades.cd(p, 'adrenalineRush'), max: 7, active: Upgrades.state(p).rush > 0 }),
  },
  // ---------- hero upgrades ----------
  {
    id: 'barrierField', name: 'Barrier Force Field', color: '#8ab8ff', hero: 'warrior',
    desc: 'Melee damage you take is halved while your shield is up.',
    hud: (p) => ({ active: !!p.shielding }),
  },
  {
    // pins: how many the shield carries; smash: the hit for slamming them into a wall (bosses take bossScale of it);
    // stun: how long they stay dazed after the smash
    id: 'pinningCharge', name: 'Pinning Charge', color: '#e0a83a', hero: 'warrior', pins: 3, smash: 240, bossScale: 0.6, stun: 1.5,
    desc: 'Charge pins up to 3 enemies to your shield, stunned the whole way. Smash them into a wall for massive damage (bosses can be pinned too, but take 40% less).',
    hud: (p) => ({ active: !!p.charge?.pinned?.length }),
  },
  {
    id: 'razorArrows', name: 'Razor Sharp Arrows', color: '#ff4a5a', hero: 'ranger',
    desc: 'Critical arrows make enemies bleed.',
  },
  {
    id: 'confusionCloud', name: 'Cloud of Confusion', color: '#7ae05a', hero: 'ranger',
    desc: 'Camo leaves a cloud of green smoke that confuses enemies caught in it.',
  },
  {
    // mana: the least mana to cast with; damage: how much harder the missile hits then
    id: 'empoweredSurge', name: 'Empowered Mana Surge', color: '#5af0e0', hero: 'mage', mana: 100, damage: 1.5,
    desc: 'Basic attacks cast with 100 mana or more deal 50% more damage.',
    hud: (p) => ({ active: Upgrades.empowered(p) }),
  },
  {
    id: 'birdieTrail', name: 'Birdie Trail', color: '#c08aff', hero: 'mage',
    desc: 'Bird form leaves a magic trail. Close it into a loop to start a magic storm inside.',
    hud: (p) => ({ active: !!p.bird }),
  },
  {
    id: 'throwingStamina', name: 'Throwing Stamina', color: '#f0c040', hero: 'rogue',
    desc: 'Basic attacks no longer cost energy.',
  },
  {
    id: 'mimicClones', name: 'Mimicking Clones', color: '#c43a44', hero: 'rogue',
    desc: 'Your clones copy your abilities, at 60% less damage.',
  },
  {
    id: 'blindingLight', name: 'Blinding Light', color: '#fff6c8', hero: 'priestess',
    desc: 'Every 4th basic attack stuns enemies for 1 second.',
    hud: (p) => ({ count: Upgrades.state(p).rays % 4, active: Upgrades.state(p).rays % 4 === 3 }),
  },
  {
    // only offered in multiplayer (there's nobody to raise alone); hp: what the ally comes back with
    id: 'resurrect', name: 'Resurrect', color: '#fff2a0', hero: 'priestess', hp: 0.5, needs: (p) => !!p.netId,
    desc: 'Press interact by a downed ally to resurrect them instantly, at half health. Once per stage.',
    hud: (p) => ({ active: Upgrades.canResurrect(p) }),
  },
  {
    id: 'groggy', name: 'Groggy', color: '#c8b8ff', hero: 'bard',
    desc: 'Enemies waking from your lullaby are slowed by 40% for 3 seconds.',
  },
  {
    // shield: hp each ally gets; time: how long it lasts if nothing breaks it
    id: 'warSong', name: 'War Song', color: '#ff9a5a', hero: 'bard', shield: 25, time: 8,
    desc: 'Inspire also gives every ally in range a 25 HP shield.',
  },
  {
    id: 'incendiary', name: 'Incendiary', color: '#ff6a1e', hero: 'rocketeer',
    desc: 'Rockets leave a small patch of fire that burns enemies.',
  },
  {
    id: 'rapidReload', name: 'Rapid Rocket Reload', color: '#ffb84a', hero: 'rocketeer', reload: 0.5,
    desc: 'Every enemy you kill instantly reloads half a rocket.',
    hud: (p) => ({ active: p.ammo < p.resource.max }),
  },
  {
    id: 'premiumBaking', name: 'Premium Baking Goods', color: '#ff8ad0', hero: 'baker',
    desc: 'Pastries heal 35 HP, and sugar rush stacks up to 3 times.',
  },
  {
    id: 'biggerCakes', name: 'Bigger Cakes', color: '#ffe0f0', hero: 'baker',
    desc: 'Cakes splat over a bigger area. Every 5th cake coats enemies in icing, slowing them.',
    hud: (p) => ({ count: Upgrades.state(p).cakes % 5, active: Upgrades.state(p).cakes % 5 === 4 }),
  },
  // ---------- dark: only the dark trader deals in these (never in Bram's store or the free picks) ----------
  {
    // every: basic attacks per minion; max: how many stand at once (a new one replaces the oldest); life: seconds each lasts
    id: 'darkMinions', name: 'Dark Minions', color: '#b45aff', dark: true, every: 5, max: 3, life: 20,
    desc: 'Every 5th basic attack raises a dark minion where it lands. It slashes enemies with a dark dagger. Up to 3 at once, for 20 seconds each.',
    hud: (p) => ({ count: Upgrades.minionsOf(p), active: Upgrades.state(p).darkHits % 5 === 4 }),
  },
  {
    // radius / damage / knockback of the wave of darkness a hit sets off
    id: 'darklash', name: 'Darklash', color: '#8a3aff', dark: true, cooldown: 10, radius: 180, damage: 45, knockback: 340,
    desc: 'Taking damage releases a wave of darkness around you, knocking enemies back and hurting them.',
    hud: (p) => ({ cd: Upgrades.cd(p, 'darklash'), max: 10, active: Upgrades.cd(p, 'darklash') <= 0 }),
  },
  {
    // chance per hit (at most one roll every `gap` s); heal: hp per fragment; maxSoul: the most soul health held
    id: 'soulreap', name: 'Soulreap', color: '#c8a0ff', dark: true, chance: 0.12, gap: 0.25, heal: 10, maxSoul: 50,
    desc: 'Hitting enemies may knock soul fragments loose. Each heals 10 HP; at full HP it becomes 10 soul health instead (an extra layer of health, up to 50).',
    hud: (p) => ({ count: Math.round(p.soulHp || 0), active: (p.soulHp || 0) > 0 }),
  },
];

const UPGRADE_BY_ID = Object.fromEntries(SHOP_UPGRADES.map((u) => [u.id, u]));

/** The upgrades this hero can ever be offered: the shared ones they can use, plus their own (never the dark trader's). */
function shopStock(player) {
  return SHOP_UPGRADES.filter((u) => !u.dark && (!u.hero || u.hero === player.classId) && (!u.needs || u.needs(player)));
}

/** The dark trader's own upgrades this hero doesn't have yet. */
function darkStock(player) {
  return SHOP_UPGRADES.filter((u) => u.dark && !player.upgradeLevels[u.id]);
}

/** A hero's upgrade icon (Sprites.upgrades, 20x20) painted into a canvas, which is sized to fit. */
function drawUpgradeIcon(canvas, id) {
  const img = Sprites.upgrades[id];
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
}

/**
 * Price of the next upgrade for this hero: it goes up with every one they've bought this run.
 * full: the price before any discount (Discount Cards), for showing what was saved.
 */
function upgradePrice(hero, full = false) {
  const c = CONFIG.run.shop.upgrade;
  return Math.round((c.base + c.step * (hero.upgradesBought || 0)) * (full ? 1 : Upgrades.priceScale(hero)));
}

/** Price of the next reroll at this stage's upgrade store (back to the base price every stage). full: before any discount. */
function rerollPrice(rerolls, hero, full = false) {
  const r = CONFIG.run.shop.reroll;
  if (!full && rerolls === 0 && Upgrades.has(hero, 'freeReroll')) return 0;   // Free Reroll: the first one at each shop
  return Math.round((r.base + r.step * rerolls) * (full ? 1 : Upgrades.priceScale(hero)));
}

/** Small string hash (FNV-1a) for seeding. */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Every upgrade this hero could be offered, in a seeded order (the same on every machine). */
function seededStock(hero, key) {
  const pool = shopStock(hero);
  const rng = seededRng(hashString(key));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * The 3 card slots of a hero's store right now (null once there's nothing left to offer).
 * They're rebuilt from the seed each time: the first 3 the hero doesn't own, then each
 * upgrade bought since the last reroll hands its slot to the next one in line, so the
 * other cards stay where they are.
 */
function upgradeOffers(run, hero) {
  const st = run.shopState(hero);
  const order = seededStock(hero, `${run.shopSeed}|${hero.netId || 'solo'}|${st.rerolls}`)
    .filter((u) => !hero.upgradeLevels[u.id] || st.boughtHere.includes(u.id));
  const slots = order.slice(0, 3);
  let next = 3;
  for (const id of st.boughtHere) {
    const i = slots.findIndex((u) => u && u.id === id);
    if (i >= 0) slots[i] = order[next++] || null;
  }
  while (slots.length < 3) slots.push(null);
  return slots;
}

/** The (up to) 3 upgrades a hero chooses one of (free) on entering a stage: ones they don't own yet (or just picked here). */
function pickOffers(run, hero) {
  const picked = run.startPicks[run.pickKey(hero)];
  return seededStock(hero, `${run.shopSeed}|pick|${hero.netId || 'solo'}`)
    .filter((u) => !hero.upgradeLevels[u.id] || u.id === picked).slice(0, 3);
}

// =============================================================
//  What the upgrades do: hooks the heroes, enemies and game call
//  (inside the shared simulation; drawing uses the visual random)
// =============================================================

const Upgrades = {
  has(p, id) { return !!p?.upgradeLevels?.[id]; },

  /** Per-hero upgrade bookkeeping: timers, stacks and counters. */
  state(p) {
    return p.upg || (p.upg = { still: 0, stacks: 0, idle: 0, cd: {}, flash: {}, rays: 0, cakes: 0, darkHits: 0, dodges: 2, dodgeT: 0, trail: [], storms: [], said: {} });
  },

  // ---------- the dark trader's upgrades ----------

  /** How many of this hero's dark minions are up. */
  minionsOf(p) {
    const w = p.lastWorld;
    return w?.minions ? w.minions.filter((m) => m.owner === p && !m.dead).length : 0;
  },

  /** A basic attack went out (Forge.attack): Dark Minions counts it, and every 5th arms a minion to rise where it lands. */
  basicAttack(p, world) {
    if (!this.has(p, 'darkMinions')) return;
    const s = this.state(p);
    if (++s.darkHits % UPGRADE_BY_ID.darkMinions.every) return;
    s.minionAt = world.time + 0.8;   // nothing hit by then: it rises in front of them instead
  },

  /** A basic attack landed on `target`: a minion armed by the last attack rises beside it. */
  basicHit(p, target, world) {
    const s = p.upg;
    if (!s?.minionAt || target.prop) return;
    s.minionAt = 0;
    this.raiseMinion(p, target.x, target.y + 8, world);
  },

  /** A dark minion climbs out of a pool of shadow at (x, y); at the most already, the oldest fades to make room. */
  raiseMinion(p, x, y, world) {
    const u = UPGRADE_BY_ID.darkMinions;
    const mine = world.minions.filter((m) => m.owner === p && !m.dead);
    if (mine.length >= u.max) mine[0].fade(world);
    const pt = world.dungeon.freePoint(x, y, 6, 4);
    world.minions.push(new DarkMinion(p, pt.x, pt.y, u.life, world));
    this.proc(p, world, 'darkMinions');
  },

  /** Darklash: a hit that got through sends a wave of darkness rolling out, hurting and hurling back everything round the hero. */
  darklash(p, world) {
    if (!this.has(p, 'darklash') || this.cd(p, 'darklash') > 0 || p.dead) return;
    const u = UPGRADE_BY_ID.darklash;
    this.state(p).cd.darklash = u.cooldown;
    this.proc(p, world, 'darklash', 'DARKLASH!', 9);
    const { x, y } = p;
    for (const t of world.getTargets()) {
      if (t.prop || dist(x, y, t.x, t.y) > u.radius + (t.radius || 0)) continue;
      world.damageTarget(t, u.damage, { source: p, angle: angleTo(x, y, t.x, t.y), knockback: u.knockback, noCrit: true, sound: null, color: u.color });
    }
    const r = u.radius;
    world.effects.add(0.5, (ctx, t) => {
      const e = 1 - (1 - t) ** 3;
      ctx.save();
      PFX.disc(ctx, x, y + 2, r * e, r * 0.55 * e, `rgba(20, 8, 36, ${0.5 * (1 - t)})`, 3);
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, x, y + 2, r * e, r * 0.55 * e, `rgba(180, 90, 255, ${1 - t})`, 3, { thick: t < 0.4 ? 3 : 2 });
      PFX.ring(ctx, x, y + 2, r * e * 0.7, r * 0.38 * e, `rgba(224, 192, 255, ${0.7 * (1 - t)})`, 2, { dash: [4, 3], spin: t * 4 });
      PFX.glow(ctx, x, y - 14, 30 * (1 - t) + 6, '138, 58, 255', 0.8 * (1 - t));
      ctx.restore();
    });
    world.effects.smoke(x, y - 4, { count: 8, radius: 26, life: 0.7, rise: 18, colors: ['#1e1430', '#2e2048', '#46286a'] });
    world.effects.burst(x, y - 12, { count: 26, colors: ['#b45aff', '#6a28c8', '#e0c0ff', '#1e1430'], speed: [90, 240], life: [0.3, 0.6] });
    if (p === world.localPlayer) world.shake(4, 0.2);
    Sound.play('phantomVanish', 0.1);
  },

  /** Soulreap: a hit may knock a soul fragment loose (at most one roll every `gap` s, so damage over time can't farm them). */
  soulreap(p, target, world) {
    const u = UPGRADE_BY_ID.soulreap;
    const s = this.state(p);
    if ((s.reapAt || 0) > world.time || Math.random() >= u.chance) return;
    s.reapAt = world.time + u.gap;
    world.pickups.push(new SoulPickup(target.x + rand(-10, 10), target.y + rand(-4, 6), p));
  },

  /** A soul fragment reached its hero: it heals them, and what's past full health becomes soul health (up to maxSoul). */
  collectSoul(p, world) {
    const u = UPGRADE_BY_ID.soulreap;
    const room = p.maxHp - p.hp;
    if (room > 0) p.heal(Math.min(room, u.heal), world, true);
    const extra = u.heal - Math.max(0, room);
    if (extra > 0) {
      const before = p.soulHp || 0;
      p.soulHp = Math.min(u.maxSoul, before + extra);
      if (p.soulHp > before) world.effects.text(p.hx, p.hy - 26, `+${Math.round(p.soulHp - before)} SOUL`, { color: u.color, size: 8 });
    }
    this.state(p).flash.soulreap = world.time;
    world.effects.burst(p.hx, p.hy, { count: 8, colors: ['#c8a0ff', '#e0c8ff', '#ffffff'], speed: [20, 70], life: [0.3, 0.5], up: 40 });
  },

  /** Soul health soaks a hit before the hero's own health does; returns what gets through. */
  absorbSoul(p, amount, world) {
    if (!(p.soulHp > 0) || amount <= 0) return amount;
    const soaked = Math.min(p.soulHp, amount);
    p.soulHp -= soaked;
    world.effects.text(p.hx, p.hy - 26, `-${Math.round(soaked)}`, { color: '#c8a0ff', size: 8 });
    world.effects.burst(p.hx, p.hy - 6, { count: 6, colors: ['#c8a0ff', '#6a3aa0', '#ffffff'], speed: [40, 120], life: [0.15, 0.3] });
    if (p.soulHp <= 0) {
      p.soulHp = 0;
      world.effects.text(p.hx, p.hy - 38, 'SOUL SPENT', { color: '#c8a0ff', size: 7 });
    }
    return amount - soaked;
  },

  cd(p, id) { return Math.max(0, this.state(p).cd[id] || 0); },

  /** Adrenaline Rush: a hit that lands sets it off (if it's off cooldown): faster attacks for a few seconds. */
  adrenaline(p, world) {
    if (!this.has(p, 'adrenalineRush') || this.cd(p, 'adrenalineRush') > 0) return;
    const u = UPGRADE_BY_ID.adrenalineRush;
    const s = this.state(p);
    s.rush = u.time;
    s.cd.adrenalineRush = u.cooldown;
    this.proc(p, world, 'adrenalineRush', 'ADRENALINE!');
    world.effects.burst(p.hx, p.hy, { count: 16, colors: ['#ff4a6a', '#ffd0d8', '#ffffff'], speed: [60, 170], life: [0.25, 0.5] });
    Sound.play('thrustCharge', 0.1);
  },

  /** How much faster basic attacks come back right now (Adrenaline Rush). */
  rushScale(p) { return p.upg?.rush > 0 ? 1 + UPGRADE_BY_ID.adrenalineRush.attackSpeed : 1; },

  /** Resurrect (Priestess): owned, and not yet used this stage. */
  canResurrect(p) { return this.has(p, 'resurrect') && !this.state(p).resurrected; },

  /** Resurrect: the downed ally is back on their feet at once, in a burst of holy light. */
  resurrect(p, body, world) {
    const u = UPGRADE_BY_ID.resurrect;
    this.state(p).resurrected = true;
    body.revive(u.hp, world);
    this.proc(p, world, 'resurrect', 'RESURRECT!', 9);
    world.effects.burst(body.hx, body.hy - 10, { count: 50, colors: ['#ffffff', '#fff6c8', '#fff2a0', '#ffd34a'], speed: [60, 220], life: [0.5, 1], up: 90 });
    // a pillar of light falling on the body
    const { x, y } = body;
    world.effects.add(0.8, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.beam(ctx, x, y + 6, -Math.PI / 2, 140, 30 * (1 - t * 0.4), ['#a07a24', '#ffe680', '#ffffff'], 2, false);
      PFX.ring(ctx, x, y + 6, 10 + t * 40, (10 + t * 40) * 0.45, '#fff2a0', 2);
      ctx.restore();
    });
    Sound.play('magic');
  },

  /** War Song (Bard): Inspire wraps an ally in a shield of song. */
  warSong(bard, a, world) {
    if (!this.has(bard, 'warSong')) return;
    const u = UPGRADE_BY_ID.warSong;
    a.songShield = { hp: u.shield, maxHp: u.shield, t: u.time, flash: 0 };
    this.state(bard).flash.warSong = world.time;
    world.effects.text(a.hx, a.hy - 46, `+${u.shield} SHIELD`, { color: u.color, size: 7 });
  },

  /** A War Song shield soaks a hit first; returns what gets through. */
  absorbSongShield(p, amount, world) {
    const s = p.songShield;
    if (!s || amount <= 0) return amount;
    const soaked = Math.min(s.hp, amount);
    s.hp -= soaked;
    s.flash = 0.12;
    world.effects.burst(p.hx, p.hy - 6, { count: 6, colors: ['#ffd0a0', '#ff9a5a', '#ffffff'], speed: [50, 140], life: [0.15, 0.3] });
    if (s.hp <= 0) {
      p.songShield = null;
      world.effects.text(p.hx, p.hy - 36, 'SHIELD BROKEN', { color: '#ff9a5a', size: 7 });
      world.effects.burst(p.hx, p.hy - 6, { count: 18, colors: ['#ffd0a0', '#ff9a5a', '#ffffff'], speed: [70, 200], life: [0.3, 0.6] });
      Sound.play('barrierBreak', 0.05);
    }
    return amount - soaked;
  },

  /** Rapid Rocket Reload: the Rocketeer's kill slides half a rocket into the launcher. */
  rapidReload(p, world) {
    if (!this.has(p, 'rapidReload')) return;
    const r = p.resource;
    if (r.value >= r.max) return;
    const before = p.ammo;
    r.value = Math.min(r.max, r.value + UPGRADE_BY_ID.rapidReload.reload);
    p.ammoShow = 3;
    this.state(p).flash.rapidReload = world.time;
    if (p.ammo > before) {
      // a whole rocket's in: it clicks home
      const b = p.tubeBack();
      world.effects.burst(b.x, b.y, { count: 8, colors: ['#ffe680', '#e0c47a', '#ffffff'], speed: [30, 80], life: [0.15, 0.3] });
      Sound.play('rocketReload', 0.05);
    }
  },

  /** An upgrade going off: its HUD icon flashes and (optionally) its name pops up over the hero. */
  proc(p, world, id, text = null, size = 8) {
    const u = UPGRADE_BY_ID[id];
    this.state(p).flash[id] = world.time;
    if (text) world.effects.text(p.hx, p.hy - 46, text, { color: u.color, size, life: 1.1 });
  },

  /** A short note over the hero, at most once a second per kind (IMMUNE...). */
  say(p, world, key, text, color) {
    const s = this.state(p);
    if (s.said[key] > world.time) return;
    s.said[key] = world.time + 1;
    world.effects.text(p.hx, p.hy - 40, text, { color, size: 7 });
  },

  // ---------- every tick ----------

  update(p, dt, world) {
    if (!p.upgradeLevels || !Object.keys(p.upgradeLevels).length) return;
    const s = this.state(p);
    for (const k of Object.keys(s.cd)) s.cd[k] -= dt;
    // Adrenaline Rush: the boost wearing off, red streaks coming off the hero meanwhile (visual only)
    if (s.rush > 0) {
      s.rush -= dt;
      if (vrand(0, 1) < dt * 14) world.effects.burst(p.x + vrand(-8, 8), p.y - vrand(4, 26), { count: 1, colors: ['#ff4a6a', '#ffd0d8'], speed: [10, 30], life: [0.2, 0.4], up: 30, size: [1, 2] });
    }
    // Deadly Precision: how long the hero has stood still
    const steadyBefore = this.still(p);
    s.still = p.moving || p.dodge || p.jump || p.dash ? 0 : s.still + dt;
    // Deadly Precision locking on: called out, a click and a flash of sparks (the sights take over from there)
    if (!steadyBefore && this.still(p) && !p.dead) {
      this.proc(p, world, 'deadlyPrecision', 'STEADY AIM - x2 CRIT');
      world.effects.burst(p.hx, p.hy, { count: 14, colors: ['#ff9a2a', '#ffd34a', '#ffffff'], speed: [40, 120], life: [0.2, 0.45] });
      if (p === world.localPlayer) Sound.play('aim', 0.2);
    }
    if (this.has(p, 'deadlyPrecision')) s.steady = clamp((s.steady || 0) + (this.still(p) ? dt : -dt) * 4, 0, 1);   // eases the sights in and out
    // Beatdown: a stack falls off every BEATDOWN.decay seconds without a hit
    if (s.stacks > 0) {
      s.idle += dt;
      if (s.idle >= BEATDOWN.decay) { s.idle = 0; s.stacks--; }
    }
    // Dark Minions: an armed minion whose attack hit nothing rises in front of the hero
    if (s.minionAt && world.time >= s.minionAt) {
      s.minionAt = 0;
      if (!p.dead) this.raiseMinion(p, p.x + Math.cos(p.aim) * 50, p.y + Math.sin(p.aim) * 36, world);
    }
    if (this.has(p, 'burstDodging')) this.updateDodges(p, dt);
    if (this.has(p, 'lastDefence') && !p.dead && p.hp > 0 && p.hp < p.maxHp * 0.1) this.lastDefence(p, world);
    if (this.has(p, 'birdieTrail')) this.updateStorms(p, dt, world);
    if (this.has(p, 'mimicSense') && !p.dead) this.senseMimics(p, world);
    // Nuclear Reactor: the ultimate fills a little every second on its own (only in a fight's world, not the keep)
    if (this.has(p, 'nuclearReactor') && !p.dead && !world.lobby) p.gainUlt(p.ultMax * UPGRADE_BY_ID.nuclearReactor.rate * dt);
    if (p.lastShield) p.lastShield.flash -= dt;
    // the seen-on-the-hero tells (visual only)
    if (this.panicking(p) && p.moving && vrand(0, 1) < 0.5) {
      world.effects.burst(p.x - p.moveDir.x * 12, p.y - vrand(2, 20), { count: 1, colors: ['#b8f06a', '#ffffff'], speed: [5, 20], life: [0.15, 0.3], size: [1, 2] });
    }
    if (this.has(p, 'blazeborn') && vrand(0, 1) < dt * 3) {
      world.effects.burst(p.x + vrand(-8, 8), p.y - vrand(0, 6), { count: 1, colors: ['#ffd34a', '#ff8a1e'], speed: [5, 15], life: [0.4, 0.7], up: 30, size: [1, 2] });
    }
    if (this.has(p, 'heartOfFrost') && vrand(0, 1) < dt * 3) {
      world.effects.burst(p.x + vrand(-9, 9), p.y - vrand(4, 26), { count: 1, colors: ['#e6f6ff', '#9ad0ff'], speed: [3, 10], life: [0.4, 0.7], up: -8, size: [1, 2] });
    }
  },

  // ---------- crits ----------

  still(p) { return this.has(p, 'deadlyPrecision') && this.state(p).still >= 0.3; },

  /** Deadly Precision doubles crit chance and crit damage while standing still. */
  critScale(p) { return this.still(p) ? 2 : 1; },

  /**
   * Called by Game.damageTarget before it decides on a crit: First Encounter makes any
   * (critable) hit on a full-health enemy a crit.
   */
  forceCrit(src, target, crit, noCrit) {
    if (crit || noCrit || !this.has(src, 'firstEncounter')) return crit;
    return target.maxHp > 0 && target.hp >= target.maxHp;
  },

  /** After a hit lands (Game.damageTarget). info: { crit, fire, arrow }. */
  onDealt(src, target, dmg, info, world) {
    if (!src.upgradeLevels) return;
    if (this.has(src, 'soulreap') && !target.prop && world.run) this.soulreap(src, target, world);
    if (info.crit && info.arrow && this.has(src, 'razorArrows') && !target.dead) {
      const bleeding = world.dots.find((d) => d.target === target && d.kind === 'bleed' && d.source === src);
      if (bleeding) bleeding.t = Math.max(bleeding.t, 4);
      else {
        world.addDot(target, 12, 4, '#ff4a5a', 'bleed');
        world.dots[world.dots.length - 1].source = src;
        world.effects.text(target.hx, target.hy - 34, 'BLEEDING', { color: '#ff4a5a', size: 7 });
      }
      this.state(src).flash.razorArrows = world.time;
    }
  },

  /** Fire attacks hit harder for a Blazeborn hero. */
  fireScale(src) { return this.has(src, 'blazeborn') ? 1.3 : 1; },

  /** Freezes a Heart of Frost hero causes last longer. */
  freezeScale(p) { return this.has(p, 'heartOfFrost') ? 1.5 : 1; },

  /** Projectile.hitEnemies: a crit lets the shot carry on through up to 5 more enemies (not exploding shots). */
  critPierce(proj, world) {
    if (!world.lastCrit || proj.critPierced || proj.onHit || !this.has(proj.owner, 'piercingCrit')) return;
    proj.critPierced = true;
    proj.pierce = Math.max(proj.pierce, 5);
    proj.glow = proj.glow || '255, 211, 74';
    this.state(proj.owner).flash.piercingCrit = world.time;
  },

  // ---------- movement ----------

  panicking(p) { return this.has(p, 'panicGetaway') && !p.dead && p.hp < p.maxHp * 0.5; },

  speedScale(p) { return this.panicking(p) ? 1.2 : 1; },

  burstCooldown(p) { return p.dodgeCooldown * 1.6; },

  /** Burst Dodging: two dodges stored, each refilling over a longer cooldown. */
  updateDodges(p, dt) {
    const s = this.state(p);
    const cd = this.burstCooldown(p);
    if (s.dodges < 2) {
      s.dodgeT -= dt;
      if (s.dodgeT <= 0) { s.dodges++; s.dodgeT = s.dodges < 2 ? cd : 0; }
    }
    p.maxCooldowns.dodge = cd;
    if (s.dodges > 0) p.cooldowns.dodge = Math.min(p.cooldowns.dodge, 0.2);
    else p.cooldowns.dodge = s.dodgeT;
  },

  /** The cooldown a dodge starts (Burst Dodging spends one of its two). */
  dodgeCooldown(p) {
    if (!this.has(p, 'burstDodging')) return p.dodgeCooldown;
    const s = this.state(p);
    s.dodges--;
    if (s.dodgeT <= 0) s.dodgeT = this.burstCooldown(p);
    return s.dodges > 0 ? 0.2 : s.dodgeT;   // a moment between the two, so one press doesn't spend both
  },

  /** The HUD's dodge slot shows the two dodges like any stored charges. */
  dodgeCharges(p) {
    if (!this.has(p, 'burstDodging')) return null;
    const s = this.state(p);
    return { count: s.dodges, max: 2, refill: s.dodges < 2 ? 1 - s.dodgeT / this.burstCooldown(p) : 1 };
  },

  // ---------- melee (the Knight's swings) ----------

  reach(p) { return this.has(p, 'longerReach') ? 1.25 : 1; },

  /** Beatdown's damage bonus for the next melee swing. */
  meleeScale(p) { return this.has(p, 'beatdown') ? 1 + 0.02 * this.state(p).stacks : 1; },

  /** A melee basic attack connected: one more Beatdown stack. */
  meleeHit(p, world) {
    if (!this.has(p, 'beatdown')) return;
    const s = this.state(p);
    s.idle = 0;
    if (s.stacks < BEATDOWN.max) {
      s.stacks++;
      if (s.stacks === BEATDOWN.max) this.proc(p, world, 'beatdown', 'BEATDOWN MAX!', 9);
    }
  },

  // ---------- taking hits (Player.hurt) ----------

  /**
   * Upgrades that change an incoming hit. Returns the damage that's left, or -1 if the hit
   * never happened (a trap a Radial Barrier hero is immune to), or 0 if it was blocked.
   */
  incoming(p, amount, world, fromX, fromY, opts) {
    if (!p.upgradeLevels) return amount;
    if (opts.trap && this.has(p, 'radialBarrier')) {
      this.say(p, world, 'trap', 'IMMUNE', '#6ae0c8');
      this.state(p).flash.radialBarrier = world.time;
      return -1;
    }
    if (opts.contact && this.has(p, 'radialBarrier')) {
      amount *= 0.5;
      this.state(p).flash.radialBarrier = world.time;
    }
    // Tesla Armour shocks back but doesn't stop the hit; a Silver Shield does
    if (this.has(p, 'teslaArmour') && this.cd(p, 'teslaArmour') <= 0 && amount > 0) this.teslaShock(p, world, fromX, fromY, opts.projectile);
    if (this.has(p, 'silverShield') && this.cd(p, 'silverShield') <= 0 && amount > 0) {
      this.silverBlock(p, world);
      return 0;
    }
    // about to drop under 10%: the last defence goes up first and takes this hit
    if (this.has(p, 'lastDefence') && p.hp - amount < p.maxHp * 0.1) this.lastDefence(p, world);
    if (p.lastShield) amount = this.absorbShield(p, amount, world);
    return amount;
  },

  /** The Last Defence: a 200 hp shield once the hero is nearly down (3 minute cooldown). */
  lastDefence(p, world) {
    if (this.cd(p, 'lastDefence') > 0 || p.lastShield) return;
    this.state(p).cd.lastDefence = 180;
    p.lastShield = { hp: 200, max: 200, flash: 0.3 };
    this.proc(p, world, 'lastDefence', 'THE LAST DEFENCE!', 10);
    world.effects.burst(p.hx, p.hy - 6, { count: 30, colors: ['#6aa8ff', '#c8e4ff', '#ffffff'], speed: [60, 200], life: [0.3, 0.7] });
    const x = p.x;
    const y = p.y - 16;
    world.effects.add(0.5, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 20 + t * 40;
      PFX.ring(ctx, x, y, r, r * 1.2, `rgba(106, 168, 255, ${1 - t})`, 2, { thick: t < 0.5 ? 3 : 1 });
      ctx.restore();
    });
    if (p === world.localPlayer) world.shake(4, 0.2);
    Sound.play('magic');
  },

  absorbShield(p, amount, world) {
    const sh = p.lastShield;
    const soaked = Math.min(sh.hp, amount);
    sh.hp -= soaked;
    sh.flash = 0.12;
    world.effects.burst(p.hx, p.hy - 6, { count: 8, colors: ['#6aa8ff', '#ffffff'], speed: [60, 160], life: [0.15, 0.3] });
    Sound.play('bounce');
    if (sh.hp <= 0) {
      p.lastShield = null;
      world.effects.text(p.hx, p.hy - 40, 'SHIELD BROKEN', { color: '#6aa8ff', size: 7 });
      world.effects.burst(p.hx, p.hy - 6, { count: 24, colors: ['#6aa8ff', '#c8e4ff', '#ffffff'], speed: [80, 220], life: [0.3, 0.6] });
      Sound.play('partBreak');
    }
    return amount - soaked;
  },

  /**
   * Silver Shield: a ward of silver plates soaks the whole of the next attack, then
   * takes 20s to reforge.
   */
  silverBlock(p, world) {
    const u = UPGRADE_BY_ID.silverShield;
    this.state(p).cd.silverShield = u.cooldown;
    p.guard = CONFIG.player.guardTime;   // the rest of the same attack (a sweep, a burst) glances off too
    this.proc(p, world, 'silverShield', 'BLOCKED!', 9);
    world.effects.shards(p.hx, p.hy - 4, { count: 12, speed: [90, 220], life: 0.4, len: [6, 11], width: 4, colors: ['#8a94a8', '#d8e0ec', '#ffffff'] });
    world.effects.burst(p.hx, p.hy - 4, { count: 16, colors: ['#d8e0ec', '#ffffff', '#a8b4c8'], speed: [60, 180], life: [0.2, 0.45] });
    const x = p.x;
    const y = p.y - 16;
    world.effects.add(0.35, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - t;
      PFX.ring(ctx, x, y, 20 + t * 22, (20 + t * 22) * 1.2, '#e6ecf6', 2, { thick: t < 0.4 ? 2 : 1 });
      PFX.glow(ctx, x, y, 26, '216, 224, 236', 0.6 * (1 - t));
      ctx.restore();
    });
    if (p === world.localPlayer) world.shake(3, 0.12);
    Sound.play('blockClang');
  },

  /**
   * Tesla Armour: when a hit lands, lightning leaps out at whoever dealt it (the nearest enemy
   * to where it came from) and anything right next to the hero: a jolt of damage and a Zap
   * that stuns them for a second, bosses included. The hit itself still lands. Then it
   * recharges for 10s.
   */
  teslaShock(p, world, fromX, fromY, projectile) {
    const u = UPGRADE_BY_ID.teslaArmour;
    this.state(p).cd.teslaArmour = u.cooldown;
    const ox = projectile || fromX === undefined ? p.x : fromX;
    const oy = projectile || fromY === undefined ? p.y : fromY;
    const reach = projectile ? 420 : 90;
    const targets = world.getTargets();
    let attacker = null;
    let best = reach;
    for (const t of targets) {
      if (t.prop) continue;   // a barrel never hit anyone
      const d = dist(ox, oy, t.x, t.y);
      if (d < best) { best = d; attacker = t; }
    }
    const hit = new Set(attacker ? [attacker] : []);
    for (const t of targets) if (dist(p.x, p.hy, t.hx, t.hy) < 70 + (t.radius || 0)) hit.add(t);
    for (const t of hit) {
      world.damageTarget(t, 15, { source: p, noCrit: true, sound: null, color: '#8ad8ff', fromUlt: true });
      world.zap(t, u.zap);
      const x1 = p.x;
      const y1 = p.hy;
      const x2 = t.hx;
      const y2 = t.hy;
      const pts = [];
      const n = Math.max(3, Math.round(dist(x1, y1, x2, y2) / 16));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const j = i === 0 || i === n ? 0 : 7;
        pts.push([lerp(x1, x2, k) + vrand(-j, j), lerp(y1, y2, k) + vrand(-j, j)]);
      }
      world.effects.add(0.3, (ctx, tt) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - tt;
        for (let i = 1; i < pts.length; i++) {
          PFX.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#6ad8ff', 3);
          PFX.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#ffffff', 1);
        }
        PFX.glow(ctx, x2, y2, 14, '106, 216, 255', 1 - tt);
        ctx.restore();
      });
      world.effects.burst(t.hx, t.hy, { count: 8, colors: ['#6ad8ff', '#ffffff'], speed: [60, 160], life: [0.15, 0.3] });
    }
    this.proc(p, world, 'teslaArmour', 'STATIC SHOCK!', 9);
    world.effects.burst(p.hx, p.hy - 4, { count: 20, colors: ['#6ad8ff', '#c8f4ff', '#ffffff'], speed: [80, 200], life: [0.2, 0.4] });
    Sound.play('blockClang');
  },

  /** Blazeborn: no burning. */
  blocksBurn(p, world) {
    if (!this.has(p, 'blazeborn')) return false;
    this.say(p, world, 'fire', 'IMMUNE', '#ff8a1e');
    this.state(p).flash.blazeborn = world?.time ?? 0;
    return true;
  },

  /** Heart of Frost: no chills or freezing. */
  blocksChill(p, world) {
    if (!this.has(p, 'heartOfFrost')) return false;
    if (world) {
      this.say(p, world, 'frost', 'IMMUNE', '#9ad0ff');
      this.state(p).flash.heartOfFrost = world.time;
    }
    return true;
  },

  // ---------- kills and loot (DungeonRun) ----------

  /** An enemy died: Coin Siphon and Life Leech (an extra chance of a heart) for whoever killed it. */
  onKill(run, e) {
    const k = e.lastHitBy;
    const w = run.world;
    if (!k || !w.players.includes(k) || e.exploded) return;
    if (this.has(k, 'lastHurrah') && Math.random() < UPGRADE_BY_ID.lastHurrah.chance) this.lastHurrah(w, k, e.x, e.y);
    if (this.has(k, 'coinSiphon') && !e.owner && Math.random() < 0.3) {
      const n = randInt(3, 5);
      run.spawnCoins(e.x, e.y - 4, n);
      this.state(k).flash.coinSiphon = w.time;
      w.effects.text(e.x, e.y - 40, `+${n} SIPHON`, { color: '#ffd34a', size: 7 });
    }
    // Life Leech: an extra roll for a heart on top of the enemy's own
    if (this.has(k, 'lifeLeech') && Math.random() < 0.15) {
      w.pickups.push(new HeartPickup(e.x + 12, e.y - 4));
      this.state(k).flash.lifeLeech = w.time;
    }
  },

  /**
   * Last Hurrah: the body swells with light, then blows up, hurting every enemy round it (the hero who
   * killed it gets the credit; one it kills can blow up in turn).
   */
  lastHurrah(world, k, x, y) {
    const u = UPGRADE_BY_ID.lastHurrah;
    // the warning: a glow building where it fell
    world.effects.add(u.delay, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y - 12, 8 + t * 18, '255, 170, 70', 0.6 + t * 0.6, 2);
      ctx.restore();
    });
    world.after(u.delay, () => {
      for (const t of world.getTargets()) {
        if (t.prop || dist(x, y, t.x, t.y) > u.radius + (t.radius || 0)) continue;
        world.damageTarget(t, u.damage, { source: k, angle: angleTo(x, y, t.x, t.y), knockback: 160, noCrit: true, sound: null, fire: true, color: u.color });
      }
      this.state(k).flash.lastHurrah = world.time;
      const r = u.radius;
      world.effects.add(0.4, (ctx, t) => {
        const e = 1 - (1 - t) ** 3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y - 12, r * (0.4 + e * 0.5), '255, 140, 50', 1.3 * (1 - t), 2, r * 0.6 * (0.4 + e * 0.5));
        PFX.glow(ctx, x, y - 14, r * 0.3 * (1 - t * 0.7), '255, 240, 200', 1.4 * (1 - t));
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 1 - t;
        PFX.ring(ctx, x, y, r * e, r * 0.55 * e, '#ffe0a0', 2, { thick: t < 0.3 ? 3 : 1 });
        ctx.restore();
      });
      world.effects.add(1.6, (ctx, t) => {
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - t);
        PFX.disc(ctx, x, y, r * 0.5, r * 0.28, '#1a1210');
        ctx.restore();
      }, true);
      world.effects.smoke(x, y - 12, { count: 7, radius: r * 0.4, life: 0.9, rise: 26 });
      world.effects.burst(x, y - 10, { count: 26, colors: ['#ffd34a', '#ff8a1e', '#e0461e', '#ffffff'], speed: [80, 240], life: [0.3, 0.6], size: [2, 4] });
      world.shake(5, 0.25);
      Sound.play('explosion', 0.05);
    });
  },

  /** A mimic died: true if its killer's Mimic Sense shakes all three super buffs out of it. */
  mimicJackpot(m, world) {
    const k = m.lastHitBy;
    if (!k || !world.players.includes(k) || !this.has(k, 'mimicSense') || Math.random() >= m.cfg.senseChance) return false;
    this.proc(k, world, 'mimicSense');
    world.effects.text(m.x, m.y - 56, 'JACKPOT! ALL SUPER BUFFS', { color: UPGRADE_BY_ID.mimicSense.color, size: 9, life: 1.6 });
    return true;
  },

  /** Mimic Sense: walking near a chest that's really a mimic, the hero feels it (called out once per hero). */
  senseMimics(p, world) {
    const props = world.run?.props;
    if (!props) return;
    const key = p.netId || 'solo';
    for (const pr of props) {
      if (!this.isSensed(pr, p) || pr.sensed?.includes(key)) continue;
      (pr.sensed || (pr.sensed = [])).push(key);
      this.proc(p, world, 'mimicSense', 'MIMIC SENSED!', 8);
      if (p === world.localPlayer) Sound.play('windup', 0.2);
    }
  },

  /** True if this hero can sense the prop as a mimic right now (a closed secret chest hiding one, close by). */
  isSensed(pr, p) {
    return pr.kind === 'secretChest' && pr.mimic && !pr.opened && !pr.gone && !!p && !p.dead
      && this.has(p, 'mimicSense') && dist(p.x, p.y, pr.x, pr.y) <= UPGRADE_BY_ID.mimicSense.range;
  },

  /**
   * Over a chest the local hero senses is a mimic: a red glow, a slitted eye blinking open over
   * the lid and a "MIMIC" warning bobbing above it.
   */
  drawMimicSense(ctx, x, y, time) {
    const k = 0.75 + Math.sin(time * 6) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, y - 14, 30, '255, 90, 74', 0.45 * k, 2, 18);
    ctx.restore();
    const ex = Math.round(x);
    const ey = Math.round(y - 46 + Math.sin(time * 3) * 2);
    const open = Math.floor(time * 2) % 5 ? 2 : 1;   // it blinks now and then
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(ex - 7, ey - open - 1, 14, open * 2 + 2);
    ctx.fillStyle = '#fff2e0';
    ctx.fillRect(ex - 6, ey - open, 12, open * 2);
    ctx.fillStyle = '#e0302a';
    ctx.fillRect(ex - 2, ey - open, 4, open * 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(ex, ey - open, 1, open * 2);
    HUD.text(ctx, 'MIMIC', ex, ey - 13, { size: 6, align: 'center', color: '#ff6a5a' });
  },

  // ---------- shops, energy and projectiles ----------

  /** How much more a health or regeneration potion heals this hero (Higher Potion Dosage). */
  potionScale(p) { return this.has(p, 'potionDosage') ? UPGRADE_BY_ID.potionDosage.scale : 1; },

  /** What this hero pays of a shop price (Discount Cards: 10% off). */
  priceScale(hero) { return this.has(hero, 'discountCards') ? 1 - UPGRADE_BY_ID.discountCards.discount : 1; },

  /** How much faster this hero's energy comes back (Energy Drink). */
  energyScale(p) { return p.resource?.name === 'ENERGY' && this.has(p, 'energyDrink') ? UPGRADE_BY_ID.energyDrink.rate : 1; },

  /** Wall bounces added to this hero's projectiles (Bouncy!). */
  extraBounces(p) { return this.has(p, 'bouncy') ? UPGRADE_BY_ID.bouncy.bounces : 0; },

  /** A room chest opened: a health potion for each Chests of Alchemy hero (40%, sometimes a large one). */
  onChest(run, x, y) {
    const w = run.world;
    for (const p of w.players) {
      if (p.dead || !this.has(p, 'chestsOfAlchemy') || Math.random() >= 0.4) continue;
      const id = Math.random() < 0.25 ? 'large-health-potion' : 'health-potion';
      if (!p.addItem(id)) w.pickups.push(new PotionPickup(x + rand(-14, 14), y + 10, id));
      this.state(p).flash.chestsOfAlchemy = w.time;
      w.effects.text(x, y - 56, `${p.name ? `${p.name}: ` : ''}+${POTIONS[id].name.toUpperCase()}`, { color: '#ff6a7a', size: 7, life: 1.4 });
    }
  },

  // ---------- the Mage ----------

  /** Empowered Mana Surge: she has enough mana for an empowered missile. */
  empowered(p) { return this.has(p, 'empoweredSurge') && p.resource.value >= UPGRADE_BY_ID.empoweredSurge.mana; },

  /**
   * Birdie Trail: bird form drops a point of magic every 12px. When she flies back across
   * her trail (not the last few points), the stretch since then becomes a loop, and a magic
   * storm fills it for 4s.
   */
  birdTrail(p, world) {
    if (!this.has(p, 'birdieTrail')) return;
    const s = this.state(p);
    const pts = s.trail;
    while (pts.length && world.time - pts[0].t > 3.5) pts.shift();
    const last = pts[pts.length - 1];
    if (last && dist(last.x, last.y, p.x, p.y) < 12) return;
    const pt = { x: p.x, y: p.y, t: world.time };
    for (let i = 0; i < pts.length - 8; i++) {
      if (dist(pts[i].x, pts[i].y, pt.x, pt.y) > 20) continue;
      const poly = pts.slice(i).map((q) => [q.x, q.y]);
      poly.push([pt.x, pt.y]);
      if (polygonArea(poly) < 3500) continue;
      this.startStorm(p, world, poly);
      pts.length = 0;
      return;
    }
    pts.push(pt);
  },

  startStorm(p, world, poly) {
    const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length;
    const cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
    this.state(p).storms.push({ poly, cx, cy, t: 0, life: 4, tick: 0 });
    this.proc(p, world, 'birdieTrail', 'MAGIC STORM!', 10);
    world.effects.burst(cx, cy, { count: 30, colors: ['#c08aff', '#9cf0d8', '#ffffff'], speed: [40, 160], life: [0.4, 0.8], up: 40 });
    Sound.play('lightningStrike');
  },

  /** Storms hurt every enemy inside their loop, 3 times a second. */
  updateStorms(p, dt, world) {
    const s = this.state(p);
    if (!p.bird && s.trail.length) s.trail.length = 0;
    for (const st of s.storms) {
      st.t += dt;
      st.tick -= dt;
      if (st.t >= st.life) { st.dead = true; continue; }
      if (st.tick > 0) continue;
      st.tick = 0.33;
      world.setActor(p);
      for (const t of world.getTargets()) {
        if (!pointInPolygon(t.x, t.y, st.poly)) continue;
        world.damageTarget(t, 12, { source: p, sound: null, color: '#c08aff' });
      }
      world.setActor(null);
      // a bolt of lightning somewhere inside
      const xs = st.poly.map((q) => q[0]);
      const ys = st.poly.map((q) => q[1]);
      for (let i = 0; i < 6; i++) {
        const bx = vrand(Math.min(...xs), Math.max(...xs));
        const by = vrand(Math.min(...ys), Math.max(...ys));
        if (!pointInPolygon(bx, by, st.poly)) continue;
        world.effects.add(0.2, (ctx, t) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - t;
          PFX.beam(ctx, bx, by - 90, Math.PI / 2, 90, 4, ['#c08aff', '#ffffff'], 2, false);
          PFX.glow(ctx, bx, by, 12, '192, 138, 255', 1 - t);
          ctx.restore();
        });
        break;
      }
    }
    removeDead(s.storms);
  },

  // ---------- drawing (on the hero) ----------

  /** Under the hero: Deadly Precision's sights, the bird's trail and storms. */
  drawGround(p, ctx, time) {
    if (!p.upg) return;
    const s = p.upg;
    if (s.steady > 0 && !p.dead) this.drawSights(p, ctx, time, s);
    // the bird's glowing trail, fading at its old end
    const pts = s.trail;
    for (let i = 1; i < pts.length; i++) {
      const age = (time - pts[i].t) / 3.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(1 - age, 0, 1) * 0.8;
      PFX.line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, '#c08aff', 3);
      PFX.line(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, '#f0e0ff', 1);
      ctx.restore();
    }
    for (const st of s.storms) {
      const k = Math.min(1, st.t * 4, (st.life - st.t) * 2);
      ctx.save();
      ctx.globalAlpha = 0.25 * k;
      ctx.fillStyle = '#6a3aa0';
      ctx.beginPath();
      st.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      for (let i = 0; i < st.poly.length; i++) {
        const [x1, y1] = st.poly[i];
        const [x2, y2] = st.poly[(i + 1) % st.poly.length];
        PFX.line(ctx, x1, y1, x2, y2, '#c08aff', 2);
      }
      for (let i = 0; i < 8; i++) {
        const a = st.t * 3 + (i * TAU) / 8;
        const r = 18 + ((i * 13) % 30);
        PFX.star(ctx, st.cx + Math.cos(a) * r, st.cy + Math.sin(a) * r * 0.6 - 10, 2, '#c08aff', '#ffffff', 2);
      }
      ctx.restore();
    }
  },

  /**
   * Deadly Precision's sights on the floor round a hero standing still: a scope reticle that snaps
   * in tight as it locks on (s.steady eases 0..1), four sight ticks closing on the hero, a turning
   * outer ring and an orange glow underfoot.
   */
  drawSights(p, ctx, time, s) {
    const k = s.steady;
    const e = 1 - (1 - k) ** 3;
    const R = 46 - e * 16;   // snapping in from wide to tight
    const pulse = 0.75 + Math.sin(time * 8) * 0.25;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, p.x, p.y + 4, 44, '255, 140, 40', 0.35 * pulse, 2, 22);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = k;
    PFX.ring(ctx, p.x, p.y + 4, R + 10, (R + 10) * 0.5, `rgba(255, 154, 42, ${0.45 * pulse})`, 1, { dash: [6, 4], spin: time * 1.5 });
    PFX.ring(ctx, p.x, p.y + 4, R, R * 0.5, '#ff9a2a', 2, { thick: 2 });
    // the four sight ticks, pointing in at the hero
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      const x0 = p.x + Math.cos(a) * (R + 2);
      const y0 = p.y + 4 + Math.sin(a) * (R + 2) * 0.5;
      const x1 = p.x + Math.cos(a) * (R - 9);
      const y1 = p.y + 4 + Math.sin(a) * (R - 9) * 0.5;
      PFX.line(ctx, x0, y0, x1, y1, OUTLINE, 4);
      PFX.line(ctx, x0, y0, x1, y1, '#ffd34a', 2);
    }
    ctx.restore();
  },

  /** Over the hero: Deadly Precision's crosshair, the Last Defence's shield, Tesla Armour's crackle, the Silver Shield, Beatdown's stacks. */
  drawOver(p, ctx, time) {
    if (!p.upg || p.dead) return;
    // Deadly Precision: a crosshair out along the aim, and "x2 CRIT" over the hero, while it's steady
    const st = p.upg.steady || 0;
    if (st > 0) {
      const a = p.aim ?? 0;
      const cx = Math.round(p.x + Math.cos(a) * 64);
      const cy = Math.round(p.hy + Math.sin(a) * 64);
      const r = 9 - st * 3 + Math.sin(time * 10) * 1;
      ctx.save();
      ctx.globalAlpha = st;
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, cx, cy, 16, '255, 154, 42', 0.5, 2);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = st;
      PFX.ring(ctx, cx, cy, r, r, '#ff9a2a', 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        PFX.line(ctx, cx + dx * (r + 1), cy + dy * (r + 1), cx + dx * (r + 6), cy + dy * (r + 6), OUTLINE, 3);
        PFX.line(ctx, cx + dx * (r + 1), cy + dy * (r + 1), cx + dx * (r + 6), cy + dy * (r + 6), '#ffd34a', 1);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy, 1, 1);
      ctx.restore();
      if (st >= 1) HUD.text(ctx, 'x2 CRIT', Math.round(p.x), Math.round(p.y - 66), { size: 6, align: 'center', color: '#ffb05a' });
    }
    const sh = p.lastShield;
    if (sh) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.disc(ctx, p.x, p.y - 16, 24, 30, sh.flash > 0 ? 'rgba(220, 235, 255, 0.35)' : 'rgba(106, 168, 255, 0.12)', 2);
      PFX.ring(ctx, p.x, p.y - 16, 24, 30, `rgba(106, 168, 255, ${0.7 + Math.sin(time * 9) * 0.2})`, 2, { thick: 2 });
      // little hexagon plates turning round the bubble
      for (let i = 0; i < 6; i++) {
        const a = time * 1.2 + (i * TAU) / 6;
        PFX.star(ctx, p.x + Math.cos(a) * 24, p.y - 16 + Math.sin(a) * 30, 1, '#c8e4ff', '#ffffff', 2);
      }
      ctx.restore();
      const w = 30;
      const bx = Math.round(p.x - w / 2);
      const by = Math.round(p.y - 56);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(bx - 1, by - 1, w + 2, 5);
      ctx.fillStyle = '#6aa8ff';
      ctx.fillRect(bx, by, Math.round(w * clamp(sh.hp / sh.max, 0, 1)), 3);
    }
    if (this.has(p, 'teslaArmour') && this.cd(p, 'teslaArmour') <= 0) {
      // the charged static shield: blue sparks flicking round the body
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, p.x, p.y - 14, 17, 22, `rgba(106, 216, 255, ${0.2 + Math.sin(time * 14) * 0.1})`, 1, { dash: [2, 5], spin: time * 4 });
      const k = Math.floor(time * 10);
      for (let i = 0; i < 2; i++) {
        const a = k * 2.3 + i * Math.PI;
        const x = p.x + Math.cos(a) * 15;
        const y = p.y - 14 + Math.sin(a) * 20;
        PFX.line(ctx, x, y, x + Math.cos(a + 1.6) * 5, y + Math.sin(a + 1.6) * 5, '#c8f4ff', 1);
      }
      ctx.restore();
    }
    if (this.has(p, 'silverShield') && this.cd(p, 'silverShield') <= 0) {
      // the ward is up: a faint silver shell, three little shield plates circling it, a glint passing over them
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.ring(ctx, p.x, p.y - 15, 19, 24, `rgba(216, 224, 236, ${0.22 + Math.sin(time * 4) * 0.08})`, 1);
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const a = time * 1.4 + (i * TAU) / 3;
        const x = Math.round(p.x + Math.cos(a) * 19);
        const y = Math.round(p.y - 15 + Math.sin(a) * 24 * 0.5);
        const lit = Math.floor(time * 3) % 3 === i;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 3, y - 3, 7, 6);
        ctx.fillRect(x - 2, y + 3, 5, 1);
        ctx.fillStyle = '#a8b4c8';
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = lit ? '#ffffff' : '#e6ecf6';
        ctx.fillRect(x - 2, y - 2, 2, 3);
      }
    }
    const stacks = this.has(p, 'beatdown') ? p.upg.stacks : 0;
    if (stacks > 0) {
      const x = Math.round(p.x + 16);
      const y = Math.round(p.y - 44);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y + 3, 8 + stacks / 5, '255, 90, 58', 0.5 + stacks / 60);
      ctx.restore();
      HUD.text(ctx, `${stacks}`, x, y, { size: 6, align: 'center', color: stacks >= BEATDOWN.max ? '#ffe680' : '#ff8a6a' });
    }
  },

  /** On an enemy: the Baker's icing coat and the Bard's groggy swirl. */
  drawEnemy(ctx, e) {
    if (e.dead) return;
    const top = Math.round(e.y - (e.barOffset || 46) + 10);
    if (e.iced > 0) {
      const x = Math.round(e.x);
      const w = Math.round((e.radius || 12) * 1.3);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - w - 1, top - 1, w * 2 + 2, 5);
      ctx.fillStyle = '#fff4fa';
      ctx.fillRect(x - w, top, w * 2, 3);
      ctx.fillStyle = '#ff8ad0';
      for (let i = -w + 2; i < w - 1; i += 5) ctx.fillRect(x + i, top + 3, 2, 2 + ((i + w) % 3));
    }
    if (e.groggy > 0 && !(e.stunTime > 0)) {
      const t = e.animTime || 0;
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * TAU) / 3;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(Math.round(e.x + Math.cos(a) * 9) - 2, Math.round(top - 6 + Math.sin(a) * 3) - 2, 4, 4);
        ctx.fillStyle = '#c8b8ff';
        ctx.fillRect(Math.round(e.x + Math.cos(a) * 9) - 1, Math.round(top - 6 + Math.sin(a) * 3) - 1, 2, 2);
      }
    }
  },
};

/**
 * An upgrade granted by a wishing well: its icon floating in a ring of light in the upgrade's
 * colour (gold-framed for a hero upgrade) until the hero who made the wish walks over it.
 */
class UpgradePickup extends Pickup {
  constructor(x, y, id, owner) {
    super(x, y);
    this.id = id;
    this.owner = owner;
    this.magnet = 50;
    this.lifetime = 9999;   // it waits for them
    this.sound = 'magic';
  }

  wanted(p) { return p === this.owner && !p.upgradeLevels[this.id]; }

  collect(p, world) {
    if (world.run) world.run.grantUpgrade(p, UPGRADE_BY_ID[this.id]);
  }

  draw(ctx) {
    const u = UPGRADE_BY_ID[this.id];
    const img = Sprites.upgrades[this.id];
    const x = Math.round(this.x);
    const cy = Math.round(this.y - 18 + Math.sin(this.age * 3) * 3);
    drawShadow(ctx, this.x, this.y + 3, 9, 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, cy, 20 + Math.sin(this.age * 5) * 2, hexToRgb(u.color).join(', '), 0.9);
    PFX.ring(ctx, x, this.y, 14, 6, u.color, 2, { dash: [3, 3], spin: this.age * 2 });
    for (let i = 0; i < 3; i++) {
      const a = this.age * 2.5 + (i * TAU) / 3;
      PFX.star(ctx, x + Math.cos(a) * 15, cy + Math.sin(a) * 9, 1, u.color, '#ffffff', 2);
    }
    ctx.restore();
    if (u.hero) {
      ctx.fillStyle = '#ffd34a';
      ctx.fillRect(x - img.width / 2 - 2, cy - img.height / 2 - 2, img.width + 4, img.height + 4);
    }
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - img.width / 2 - 1, cy - img.height / 2 - 1, img.width + 2, img.height + 2);
    ctx.fillStyle = '#2e1f17';
    ctx.fillRect(x - img.width / 2, cy - img.height / 2, img.width, img.height);
    ctx.drawImage(img, x - img.width / 2, cy - img.height / 2);
    HUD.text(ctx, u.name, x, cy - 22, { size: 6, align: 'center', color: u.color });
  }
}

/** Area of a polygon of [x, y] points (shoelace). */
function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** True if (x, y) is inside a polygon of [x, y] points (even-odd). */
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The shop window, in one of four modes: 'upgrades' (Bram's enchantments: three at a time,
 * buy any you can afford, or reroll), 'potions' (Mira's potions: six on the shelf, plus your
 * bag), 'sell' (Tobin's trade-ins: sell upgrades and potions back) or 'pick' (the free upgrade chosen on entering each stage; it can't be left without
 * choosing). Buying sends a command (App.command) - in multiplayer it's applied a moment
 * later on every machine, so the window re-renders whenever anything it shows changes.
 */
const Shop = {
  run: null,
  mode: 'upgrades',
  shown: '',

  open(run, mode, stand = null) {
    this.stand = stand;   // 'trade': which of the friendly trader's stands
    this.run = run;
    this.mode = mode;
    this.justChose = null;
    this.forgeReveal = null;
    const lines = {
      potions: ['Fresh from the cauldron!', 'One sip and you\'ll feel brand new, dear.', 'Mind the fizzy ones.'],
      upgrades: ['Power has a price, adventurer. Take as much as you can carry.', 'Each enchantment I bind costs a little more than the last.', 'Not to your liking? The runes can show you others... for a fee.'],
      pick: ['Before you go deeper: the runes offer you one gift. Choose it well.', 'A new stage, a new gift. Take one.'],
      sell: ['Let us see what you have got.', 'Everything has a price. Mine is just... smaller.', 'No haggling, friend. Tobin pays fair. Ish.'],
      trade: ['Good eye! What will you give me for it?', 'One of yours for one of mine. Fair\'s fair!', 'Ooh, that one\'s a beauty. What have you got?'],
      forge: ['Hand me that weapon. I\'ll make it sing.', 'The fire\'s hot. What comes out of it... that\'s up to the anvil.', 'Every piece comes out different. Let\'s see what the fire gives you.'],
    };
    this.say(choose(lines[mode]));
    this.render();
    Menus.show('shop');
  },

  get isOpen() { return !document.getElementById('screen-shop').classList.contains('hidden'); },
  /** The stage's free pick is open and not chosen yet (the window can't be closed). */
  get locked() { return this.isOpen && this.mode === 'pick' && !!this.run && this.run.needsPick(this.hero); },
  get hero() { return this.run.world.localPlayer; },

  say(text) { document.getElementById('shop-line').textContent = `"${text}"`; },

  /** Everything the window shows, to notice changes. */
  signature() {
    const p = this.hero;
    return JSON.stringify([this.mode, p.coins, p.upgradeLevels, p.inventory, this.run.shopState(p), this.run.potionStock, this.run.startPicks, p.forged, p.forgePending, this.forgeReveal]);
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
    const titles = { potions: "Mira's Potions", upgrades: "Bram's Enchantments", pick: 'A Gift for the Journey', sell: "Tobin's Trade-ins", forge: "Borin's Forge", trade: "Wren's Wares" };
    document.getElementById('shop-title').textContent = titles[this.mode];
    document.getElementById('shop-leave').classList.toggle('hidden', this.mode === 'pick' && this.run.needsPick(p));
    const grid = document.getElementById('shop-items');
    grid.className = `shop-items ${this.mode === 'pick' || this.mode === 'forge' ? 'upgrades' : this.mode === 'trade' ? 'sell' : this.mode}`;
    if (this.mode === 'forge') Forge.render(this, grid, p);
    else if (this.mode === 'trade') this.renderTrade(grid, p);
    else if (this.mode === 'potions') this.renderPotions(grid, p);
    else if (this.mode === 'sell') this.renderSell(grid, p);
    else if (this.mode === 'pick') this.renderPick(grid, p);
    else this.renderUpgrades(grid, p);
  },

  /**
   * One enchantment card: icon floating in a rune ring, name, what it does, a cooldown line if
   * it has one, and the button. Hero upgrades get a gold frame and the hero's name on a tag.
   */
  card(u, i, button, cls = '') {
    const own = u.hero ? ` hero-only` : '';
    const tag = u.hero ? `<i class="hero-tag">${CONFIG.classes[u.hero].name.toUpperCase()}</i>` : '';
    const cd = u.cooldown ? `<em class="cd">COOLDOWN ${u.cooldown >= 60 ? `${u.cooldown / 60} MIN` : `${u.cooldown}s`}</em>` : '';
    return `<div class="shop-card magic${own}${cls}" style="--glow:${u.color};--delay:${i * 0.4}s">
      ${tag}<div class="rune-ring"></div>
      <canvas data-icon="${u.id}"></canvas>
      <b style="color:${u.color}">${u.name}</b>
      <span>${u.desc}</span>${cd}
      ${button}
    </div>`;
  },

  sparks() {
    return Array.from({ length: 14 }, (_, k) => `<i class="spark" style="left:${8 + ((k * 37) % 84)}%;animation-delay:${(k % 7) * 0.08}s"></i>`).join('');
  },

  paintIcons(grid) {
    for (const c of grid.querySelectorAll('canvas[data-icon]')) drawUpgradeIcon(c, c.dataset.icon);
  },

  /** A price on a button with its coin; when Discount Cards cut it, the full price shows struck out before it. */
  priceTag(price, full) {
    const was = full > price ? `<s class="was-price">${full}</s>` : '';
    return price <= 0 ? `${was}FREE` : `${was}${price}<em></em>`;   // (Free Reroll)
  },

  /** Bram's store: three cards to buy from (a bought one is replaced by a new one), and a reroll. */
  renderUpgrades(grid, p) {
    const st = this.run.shopState(p);
    const offers = upgradeOffers(this.run, p);
    const price = upgradePrice(p);
    const tag = this.priceTag(price, upgradePrice(p, true));
    const flare = this.justChose;
    this.justChose = null;
    grid.innerHTML = offers.map((u, i) => {
      if (!u) return '<div class="shop-card magic faded"><span class="shop-empty">Nothing left to offer here.</span></div>';
      const btn = `<button class="buy" data-action="buy:${u.id}" ${p.coins < price ? 'disabled' : ''}>${tag}</button>`;
      return this.card(u, i, btn, flare === i ? ' enchant' : '');
    }).join('');
    this.paintIcons(grid);
    const extra = document.getElementById('shop-extra');
    const rp = rerollPrice(st.rerolls, p);
    extra.innerHTML = offers.some(Boolean)
      ? `<button class="btn small reroll" data-action="reroll" ${p.coins < rp ? 'disabled' : ''}>Reroll &nbsp;${this.priceTag(rp, rerollPrice(st.rerolls, p, true))}</button>`
      : '<p class="shop-note">You own every enchantment I know!</p>';
    const owned = Object.keys(p.upgradeLevels).length;
    document.getElementById('shop-hint').textContent = `Buy as many as you like: each one makes the next cost ${CONFIG.run.shop.upgrade.step} more. Rerolls get pricier too, but reset at the next stage's shop. Upgrades owned: ${owned}.`;
  },

  /** A stage's free gift: pick one of three. */
  renderPick(grid, p) {
    const picked = this.run.startPicks[this.run.pickKey(p)];
    const flare = this.justChose;
    this.justChose = null;
    grid.innerHTML = pickOffers(this.run, p).map((u, i) => {
      const chosen = picked === u.id;
      const btn = chosen ? '<button class="buy" disabled>CHOSEN</button>'
        : picked ? '<button class="buy" disabled>-</button>'
          : `<button class="buy" data-action="pick:${u.id}">FREE</button>`;
      const cls = `${chosen ? ' chosen' : ''}${picked && !chosen ? ' faded' : ''}${flare && chosen ? ' enchant' : flare ? ' dissolve' : ''}`;
      return this.card(u, i, btn + (chosen && flare ? this.sparks() : ''), cls);
    }).join('');
    this.paintIcons(grid);
    document.getElementById('shop-extra').innerHTML = picked ? '<p class="shop-note">It is yours for the whole run. Good luck down there!</p>' : '';
    document.getElementById('shop-hint').textContent = `Choose one upgrade to take into stage ${this.run.stage}. Every stage starts with a free one; more can be bought from Bram at each stage's shop.`;
  },

  renderPotions(grid, p) {
    grid.innerHTML = this.run.potionStock.map((s) => {
      const pot = POTIONS[s.id];
      const out = s.left <= 0;
      const full = !p.canCarry(s.id);
      const price = potionPrice(this.run, pot.id, p);
      const label = out ? 'SOLD OUT' : full ? 'BAG FULL' : this.priceTag(price, potionPrice(this.run, pot.id, p, true));
      return `<div class="shop-card potion${out ? ' faded' : ''}">
        <canvas width="28" height="28" data-potion="${pot.id}"></canvas>
        <b style="color:${POTION_COLORS[pot.family][1]}">${pot.name}</b>
        <span>${pot.desc}</span>
        <div class="stock">${out ? 'none left' : `${s.left} left`}</div>
        <button class="buy" data-action="buyPotion:${pot.id}" ${out || full || p.coins < price ? 'disabled' : ''}>${label}</button>
      </div>`;
    }).join('');
    for (const c of grid.querySelectorAll('canvas')) c.getContext('2d').drawImage(Sprites.potions[c.dataset.potion], 0, 0);
    // the bag: what this hero is carrying, with the keys to drink it
    const extra = document.getElementById('shop-extra');
    extra.innerHTML = `<div class="bag"><span class="bag-label">YOUR BAG</span>${p.inventory.map((s, i) => `
      <div class="bag-slot" data-slot="${i}"${s ? ` draggable="true" title="${POTIONS[s.id].name}"` : ''}><i>${Settings.label(`item${i + 1}`)}</i>${s ? `<canvas width="28" height="28" data-bag="${s.id}"></canvas><b>${s.count > 1 ? `x${s.count}` : ''}</b>` : ''}</div>`).join('')}</div>`;
    for (const c of extra.querySelectorAll('canvas')) c.getContext('2d').drawImage(Sprites.potions[c.dataset.bag], 0, 0);
    this.bindBagDrag(extra);
    document.getElementById('shop-hint').textContent = `Potions go in your bag (${p.inventory.length} slots, up to ${BAG_STACK} of a kind each). ${Touch.enabled ? 'Tap a bag slot during a fight to drink it.' : 'Drag to rearrange; drink with the slot keys during a fight.'}${this.run.stage > 1 ? ' Prices rise each stage.' : ''}`;
  },

  /** Wren's stand: the upgrade on it, and every upgrade the hero could give him for it. */
  renderTrade(grid, p) {
    const slot = this.run.props.find((pr) => pr.kind === 'tradeStand' && pr.i === this.stand && pr.room === this.run.floor.roomAt(p.x, p.y));
    const st = slot && slot.keeper.stalls?.[p.netId || 'solo']?.[this.stand];
    const u = st && UPGRADE_BY_ID[st.id];
    const extra = document.getElementById('shop-extra');
    if (!u || st.traded) {
      grid.innerHTML = '<p class="shop-note">That stand is done trading.</p>';
      extra.innerHTML = '';
      return;
    }
    const rows = Specials.tradeable(p).map((g) => `<div class="sell-row">
        <canvas data-icon="${g.id}"></canvas>
        <b style="color:${g.color}">${g.name}</b>
        <button class="buy" data-action="standTrade:${g.id}">GIVE</button>
      </div>`).join('') || '<p class="shop-note">You have no upgrades to trade.</p>';
    grid.innerHTML = `<div class="sell-list trade-offer"><h3>ON THE STAND</h3>${this.card(u, 0, '')}</div>
      <div class="sell-list"><h3>GIVE ONE OF YOURS <span>it comes off for good</span></h3><div class="sell-rows">${rows}</div></div>`;
    this.paintIcons(grid);
    extra.innerHTML = '';
    document.getElementById('shop-hint').textContent = 'Choose which of your upgrades to hand over: its effect comes off, and you get the one on the stand. Each stand trades once.';
  },

  standTrade(id) {
    if (!this.hero.upgradeLevels[id]) return;
    App.command({ type: 'standTrade', stand: this.stand, give: id });
  },

  /** Tobin's stall: every upgrade the hero owns and every potion in their bag, each with what it sells for. */
  renderSell(grid, p) {
    const sell = CONFIG.run.shop.sell;
    const ups = Object.keys(p.upgradeLevels).map((id) => UPGRADE_BY_ID[id]).filter(Boolean);
    const upRows = ups.map((u) => {
      const blocked = u.canSell && !u.canSell(p);
      return `<div class="sell-row">
        <canvas data-icon="${u.id}"></canvas>
        <b style="color:${u.color}">${u.name}</b>
        <button class="buy" data-action="sellUpgrade:${u.id}" ${blocked ? 'disabled title="Empty the backpack\'s extra slots first"' : ''}>${blocked ? 'EMPTY SLOTS 6-7' : `+${sell.upgrade}<em></em>`}</button>
      </div>`;
    }).join('') || '<p class="shop-note">No upgrades yet.</p>';
    const potRows = p.inventory.map((s, i) => {
      if (!s) return '';
      const pot = POTIONS[s.id];
      return `<div class="sell-row">
        <canvas width="28" height="28" data-potion="${pot.id}"></canvas>
        <b style="color:${POTION_COLORS[pot.family][1]}">${pot.name}${s.count > 1 ? ` <i>x${s.count}</i>` : ''}</b>
        <button class="buy" data-action="sellPotion:${i}">+${this.run.potionSellPrice(pot.id)}<em></em></button>
      </div>`;
    }).join('') || '<p class="shop-note">Your bag is empty.</p>';
    grid.innerHTML = `<div class="sell-list"><h3>UPGRADES <span>${sell.upgrade} coins each</span></h3><div class="sell-rows">${upRows}</div></div>
      <div class="sell-list"><h3>POTIONS <span>one at a time</span></h3><div class="sell-rows">${potRows}</div></div>`;
    this.paintIcons(grid);
    for (const c of grid.querySelectorAll('canvas[data-potion]')) c.getContext('2d').drawImage(Sprites.potions[c.dataset.potion], 0, 0);
    document.getElementById('shop-extra').innerHTML = '';
    document.getElementById('shop-hint').textContent = "Selling an upgrade takes its effect away for the rest of the run, and doesn't make Bram's next one any cheaper.";
  },

  sellUpgrade(id) {
    if (!this.hero.upgradeLevels[id]) return;
    App.command({ type: 'sellUpgrade', upgrade: id });
  },

  sellPotion(slot) {
    if (!this.hero.inventory[slot]) return;
    App.command({ type: 'sellPotion', slot });
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
    if (!UPGRADE_BY_ID[id]) return;
    if (p.coins < upgradePrice(p)) {
      this.say("You'll need more coin than that.");
      Sound.play('denied');
      return;
    }
    this.buying = upgradeOffers(this.run, p).findIndex((u) => u && u.id === id);
    App.command({ type: 'buy', upgrade: id });
  },

  pick(id) {
    if (!this.run.needsPick(this.hero)) return;
    App.command({ type: 'pickUpgrade', upgrade: id });
  },

  /** The blacksmith: forge a new attachment for the hero's weapon. */
  forge() {
    const p = this.hero;
    if (this.forgeReveal || p.forgePending) return;
    if (p.coins < Forge.price(this.run, p)) {
      this.say("Coin first, then the fire. That's how it works.");
      Sound.play('denied');
      return;
    }
    App.command({ type: 'forge' });
  },

  /** After a forge: take the new attachment (true) or deny it (false). */
  forgeKeep(take) {
    if (!this.hero.forgePending) return;
    App.command({ type: 'forgeKeep', take });
  },

  reroll() {
    const p = this.hero;
    const st = this.run.shopState(p);
    if (p.coins < rerollPrice(st.rerolls, p)) {
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
    if (p.coins < potionPrice(this.run, id, p)) { this.say("You're a little short, dear."); Sound.play('denied'); return; }
    if (!p.canCarry(id)) { this.say('Your bag is full, dear!'); Sound.play('denied'); return; }
    App.command({ type: 'buyPotion', id });
  },

  /**
   * A purchase went through (or didn't) - the keeper reacts if it was ours. what: 'upgrade' | 'pick' | 'reroll' | 'potion' | 'sellUpgrade' | 'sellPotion'.
   * Runs inside the shared simulation but only on the buyer's screen, so it uses
   * the visual-only random (vchoose) to keep multiplayer in sync.
   */
  onPurchase(hero, what, ok) {
    if (!this.run || hero !== this.hero) return;
    if (ok) {
      Sound.play('buy');
      if (what === 'reroll') this.say(vchoose(['Hmm... how about these?', 'Fresh choices, fresh fortunes.', 'The runes shift...']));
      else if (what === 'potion') this.say(vchoose(['Drink it while it\'s fizzy!', 'Pleasure doing business.', 'Come back soon, dear!']));
      else if (what === 'sellPotion' || what === 'sellUpgrade') this.say(vchoose(['A fine piece. Here is your coin.', 'Done! Pleasure doing business.', 'I know just the buyer for this.']));
      else if (what === 'forge') {
        // the window hammers away, then reveals what came out (Forge.revealHtml); Borin reacts to it after
        const f = { ...hero.forgePending };
        this.forgeReveal = { f };
        this.say(vchoose(['Stand back...', 'Let the anvil decide...', 'Heat, hammer, and a little luck...']));
        Forge.revealSounds(f);
        setTimeout(() => {
          if (this.forgeReveal?.f !== f) return;
          this.say(f.rarity === 'mythical' ? 'By my beard... it SHINES. I\'ve not seen one like that in years.'
            : f.rarity === 'legendary' ? 'Now that is fine work, if I say so myself.'
              : f.rarity === 'epic' ? 'Ha! A good one. Want it?' : 'Solid work. Yours, if you want it.');
        }, Forge.REVEAL_AT * 1000);
      } else if (what === 'forgeTake' || what === 'forgeDeny') {
        this.forgeReveal = null;
        this.say(what === 'forgeTake' ? vchoose(['There. Feel the weight of that.', 'She\'ll serve you well.', 'Fitted and ready.'])
          : vchoose(['Into the slag it goes.', 'Not to your taste? Fair enough.', 'Back in the fire with it.']));
      } else {
        this.justChose = what === 'pick' ? true : this.buying;
        Sound.play('magic');
        this.say(vchoose(['The runes accept you. It is yours.', 'Feel that? The enchantment takes hold...', 'Bound to your soul for this whole journey.']));
        // the gift is chosen: the window closes itself a moment later
        if (what === 'pick') setTimeout(() => { if (this.isOpen && this.mode === 'pick') App.closePanel(); }, 1400);
      }
    } else {
      Sound.play('denied');
      this.say(what === 'potion' ? 'Ah... someone beat you to it, dear.' : 'That deal is off the table.');
    }
    this.render();
  },
};
