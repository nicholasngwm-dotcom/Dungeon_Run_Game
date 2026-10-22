// What each hero is and does, for the lobby's hero panel. Numbers are read
// from CONFIG, so the descriptions stay right when the balance changes.
//
// heroGuide(id) -> { role, difficulty (1-3), blurb, abilities: [{ key, icon, name, tags, desc }] }
// icon is the HUD icon slot (Sprites.icons[id][icon]) or null for the passive.

const sec = (s) => `${Math.round(s * 10) / 10}s`;
const pct = (f) => `${Math.round(f * 100)}%`;

const HERO_GUIDE = {
  warrior: (c) => ({
    role: 'Tank - Melee',
    difficulty: 1,
    blurb: 'A sturdy front-liner who soaks hits, blocks shots with a shield and stuns crowds.',
    abilities: [
      { key: 'PASSIVE', name: c.passive.name, tags: [],
        desc: `After you take ${c.passive.hits} hits, the next hit is blocked completely. The bar under your health shows the count. Touching enemies also does ${pct(c.passive.contactReduction)} less damage.` },
      { key: 'LMB', icon: 'primary', name: 'Sword Combo', tags: [`${c.combo.damage} / ${c.combo.damage} / ${c.combo.stabDamage} dmg`],
        desc: `Hold to attack: two wide slashes, then a long lunging stab that hits a line and knocks enemies far back. Stop for ${sec(c.combo.resetTime)} and the combo starts over.` },
      { key: 'RMB', icon: 'secondary', name: 'Barrier Shield', tags: [`${c.barrier.hp} shield hp`],
        desc: `Hold to raise a shield that stops enemy arrows, fireballs and lasers (not melee). You move at ${pct(c.barrier.moveMultiplier)} speed. It refills when lowered, but if it breaks it is gone for ${sec(c.barrier.breakCooldown)}.` },
      { key: 'RMB+LMB', icon: 'bash', name: 'Shield Bash', tags: [`${c.bash.damage} dmg`, `${sec(c.bash.stun)} stun`, `${sec(c.bash.cooldown)} cd`],
        desc: 'While holding up the shield, press LMB to lunge forward with it, hitting and stunning every enemy in front of you and knocking them back. Its slot glows when it is ready to use.' },
      { key: 'E', icon: 'e', name: 'Whirlwind', tags: [`${sec(c.spin.cooldown)} cd`, `${c.spin.damage} dmg per hit`],
        desc: `Spin for ${sec(c.spin.duration)}, hitting everything around you about ${Math.round(1 / c.spin.tick)} times a second, while moving ${pct(c.spin.moveMultiplier - 1)} faster. You can still steer. Press E again to stop early; the cooldown only starts once the spin is over.` },
      { key: 'F', icon: 'f', name: 'Charge', tags: [`${c.charge.charges} charges`, `${sec(c.charge.cooldown)} each`],
        desc: `After a short wind-up, rush forward through enemies, dealing ${c.charge.damage} damage and stunning them for ${sec(c.charge.stun)}. You hold ${c.charge.charges} charges; each one refills on its own.` },
      { key: 'Q', icon: 'q', name: 'World Cutter', tags: [`charge: deal ${c.ult.charge} dmg`, `up to ${c.ult.damage} dmg`],
        desc: `Power up for up to ${sec(c.ult.powerTime)} (you move slowly), then bring down a huge strike along your aim. Press LMB to release early for less damage. Fills as you deal damage.` },
    ],
  }),

  ranger: (c) => ({
    role: 'Damage - Ranged',
    difficulty: 2,
    blurb: 'The fastest hero. Kites enemies with piercing arrows and slips away unseen.',
    abilities: [
      { key: 'PASSIVE', name: c.passive.name, tags: [],
        desc: `The fastest hero (speed ${c.speed}), and your dodge recharges in ${sec(c.passive.dodgeCooldown)} instead of ${sec(CONFIG.player.dodge.cooldown)}.` },
      { key: 'LMB', icon: 'primary', name: 'Arrow', tags: [`${c.arrow.damage} dmg`, `every ${sec(c.arrow.cooldown)}`],
        desc: `Fire an arrow at the cursor. It pierces through ${c.arrow.pierce} enemy and keeps flying.` },
      { key: 'RMB', icon: 'secondary', name: 'Swift Camo', tags: [`${sec(c.camo.cooldown)} cd`, `${sec(c.camo.duration)}`],
        desc: `Turn invisible and clear harmful effects, moving ${pct(c.camo.speedMultiplier - 1)} faster. Enemies can only spot you from very close. Attacking with anything drops the camo straight away.` },
      { key: 'E', icon: 'e', name: 'Rapid Fire', tags: [`${sec(c.rapidFire.cooldown)} cd`],
        desc: `Your next ${c.rapidFire.arrows} arrows fire much faster, deal ${pct(c.rapidFire.damageBonus)} more damage and pierce further.` },
      { key: 'F', icon: 'f', name: 'Fire / Ice Arrow', tags: [`${sec(c.elemental.cooldown)} cd`],
        desc: `Press F, then choose: LMB fires a fire arrow (${c.elemental.fire.damage} damage, pierces everything, burns for ${sec(c.elemental.fire.burnDuration)}); RMB fires an ice arrow that freezes every enemy near where it lands for ${sec(c.elemental.ice.freeze)}.` },
      { key: 'Q', icon: 'q', name: 'Volley', tags: [`charge: deal ${c.ult.charge} dmg`, `${c.ult.arrows} arrows`],
        desc: `Press Q to show the target circle, LMB to place it (Q again or RMB cancels). Arrows rain down on the area for ${sec(c.ult.duration)}, ${c.ult.damage} damage each.` },
    ],
  }),

  mage: (c) => ({
    role: 'Damage - Caster',
    difficulty: 3,
    blurb: 'Huge burst damage from range, paid for with mana. Fragile, so keep your distance.',
    abilities: [
      { key: 'PASSIVE', name: c.passive.name, tags: [],
        desc: `Picking up a blue mana orb (dropped by enemies) gives +${pct(c.passive.damageMultiplier - 1)} damage for ${sec(c.passive.duration)}, even when your mana is full.` },
      { key: 'LMB', icon: 'primary', name: 'Magic Missile', tags: [`${c.bolt.damage} dmg`, `${c.bolt.cost} mana`],
        desc: 'Hold to fire homing orbs that curve toward the nearest enemy. Cheap, so it is your main way to deal steady damage.' },
      { key: 'RMB', icon: 'secondary', name: 'Frostfire Ball', tags: [`${c.fireball.damage} dmg`, `${c.fireball.cost} mana`, `${sec(c.fireball.cooldown)} cd`],
        desc: 'Throw a slow ball that explodes where it lands, hitting every enemy in a wide area.' },
      { key: 'E', icon: 'e', name: 'Lightning', tags: [`${c.lightning.damage} dmg`, `${c.lightning.cost} mana`],
        desc: `Press E, then click an enemy. After ${sec(c.lightning.delay)} lightning strikes it, then jumps to up to ${c.lightning.arcCount} nearby enemies for ${c.lightning.arcDamage} each.` },
      { key: 'F', icon: 'f', name: 'Bird Form', tags: [`${c.bird.cost} mana`, `${sec(c.bird.cooldown)} cd`],
        desc: `Turn into a tiny, very fast bird for ${sec(c.bird.duration)} to escape or reposition. It flies over obstacles (crates, pillars, tombs, furniture, hedges) and spike traps; walls and doors still stop it. You can't attack as a bird. Press F again to land early.` },
      { key: 'Q', icon: 'q', name: 'Mana Drain', tags: [`charge: deal ${c.ult.charge} dmg`, `${c.ult.dps} dmg/s`],
        desc: `Press Q, then LMB to place a magic circle (RMB cancels). For ${sec(c.ult.duration)} it damages every enemy inside and turns part of it into mana, and your RMB, E and F recharge in at most ${sec(c.ult.activeCooldown)}.` },
    ],
  }),

  rogue: (c) => ({
    role: 'Damage - Assassin',
    difficulty: 3,
    blurb: 'Fast and fragile. Chains kills to grow stronger and dashes in and out of danger.',
    abilities: [
      { key: 'PASSIVE', name: c.passive.name, tags: [],
        desc: `Each kill adds +${pct(c.passive.damagePerStreak)} damage, up to ${c.passive.maxStreak} kills (+${pct(c.passive.damagePerStreak * c.passive.maxStreak)}). The streak ends after ${sec(c.passive.duration)} without a kill. Kills also give energy.` },
      { key: 'LMB', icon: 'primary', name: 'Dagger Fan', tags: [`${c.dagger.count} x ${c.dagger.damage} dmg`, `${c.dagger.cost} energy`],
        desc: `Throw ${c.dagger.count} daggers in a small spread. Up close every dagger can hit the same enemy.` },
      { key: 'RMB', icon: 'secondary', name: 'Swift Strike', tags: [`${c.strike.damage} dmg`, `${c.strike.cost} energy`],
        desc: `Dash toward the cursor, slashing everything you pass and taking no damage during the dash. Enemies hit are marked for ${sec(c.strike.markDuration)}: if one dies, Swift Strike is ready again at once. Enemies under half health start to bleed.` },
      { key: 'E', icon: 'e', name: 'Parry', tags: [`${sec(c.parry.cooldown)} cd`],
        desc: `Raise your guard for ${sec(c.parry.window)}. If an attack hits you then, it is blocked and you gain ${c.parry.energy} energy and move ${pct(c.parry.speedMultiplier - 1)} faster for ${sec(c.parry.speedDuration)}.` },
      { key: 'F', icon: 'f', name: 'Dagger Storm', tags: [`${c.storm.cost} energy`, `${sec(c.storm.cooldown)} cd`],
        desc: `Press F to ready it: your next LMB unleashes a ${sec(c.storm.duration)} storm of daggers in a wide cone (${c.storm.damage} damage each).` },
      { key: 'Q', icon: 'q', name: 'Clone Surprise', tags: [`charge: deal ${c.ult.charge} dmg`, `${c.ult.clones} clones`],
        desc: `Vanish for a moment, then ${c.ult.clones} shadow clones appear and hunt enemies on their own for ${sec(c.ult.cloneLife)}. When a clone dies or its time runs out it bursts into ${c.ult.burstDaggers} daggers that stun.` },
    ],
  }),

  priestess: (c) => ({
    role: 'Support - Healer',
    difficulty: 2,
    blurb: 'Heals and shields the team, marks enemies with light, and stuns with a holy bomb.',
    abilities: [
      { key: 'PASSIVE', name: c.passive.name, tags: [],
        desc: `Hitting an enemy marked by your Light Missiles has a ${pct(c.passive.orbChance)} chance to drop a light orb. Light orbs (max ${c.resource.max}) never refill on their own; this is how you get them back.` },
      { key: 'LMB', icon: 'primary', name: 'Ray of Light', tags: [`${c.ray.damage} dmg`, `every ${sec(c.ray.cooldown)}`],
        desc: `A beam of light falls on the cursor after ${sec(c.ray.delay)}, hitting every enemy in a small circle. Aim where enemies will be.` },
      { key: 'RMB', icon: 'secondary', name: 'Light Missiles', tags: [`${c.missiles.count} x ${c.missiles.damage} dmg`, `${sec(c.missiles.cooldown)} cd`],
        desc: `Fire ${c.missiles.count} homing missiles that each seek a different enemy and mark it for ${sec(c.missiles.markDuration)}. Marked enemies can drop light orbs (see passive).` },
      { key: 'E', icon: 'e', name: 'Healing Rune', tags: [`${c.rune.cost} light`, `${sec(c.rune.cooldown)} cd`],
        desc: `Press E, then LMB to place a rune (RMB or E cancels). Allies standing in it heal ${c.rune.heal} hp per second for ${sec(c.rune.duration)}.` },
      { key: 'F', icon: 'f', name: 'Guardian Aegis', tags: [`${c.aegis.cost} light`, `${sec(c.aegis.cooldown)} cd`],
        desc: `Press F, then LMB to shield the ally nearest the cursor or RMB to shield yourself. The shield absorbs ${c.aegis.hp} damage for ${sec(c.aegis.duration)}.` },
      { key: 'Q', icon: 'q', name: 'Light Bomb', tags: [`charge: deal ${c.ult.charge} dmg`, `up to ${c.ult.damage} dmg`],
        desc: `Charge for up to ${sec(c.ult.powerTime)} (LMB throws early), then hurl a bomb at the cursor. The longer you charge, the bigger the blast, the damage and the stun (up to ${sec(c.ult.stun)}).` },
    ],
  }),
};

HERO_GUIDE.bard = (c) => ({
  role: 'Support - Buffer',
  difficulty: 2,
  blurb: 'Plays tunes that speed up or heal the team, inspires everyone around her, lulls enemies to sleep and weakens them with a screech.',
  abilities: [
    { key: 'PASSIVE', name: c.passive.name, tags: [],
      desc: `Your tune plays for every hero within ${c.passive.radius} px of you, yourself included. Stay close to your team. It shapes your own notes too: Energetic notes fly fast and you strum ${pct(c.tunes.energetic.attackSpeed)} faster; Calming notes drift slowly and deal ${pct(1 - c.tunes.calming.noteDamage)} less damage.` },
    { key: 'LMB', icon: 'primary', name: 'Magical Strumming', tags: [`${c.strum.count} x ${c.strum.damage} dmg`, `every ${sec(c.strum.cooldown)}`],
      desc: `Strum ${c.strum.count} magic notes in a small fan. They bob side to side as they fly, in the colour of your current tune.` },
    { key: 'RMB', icon: 'secondary', name: 'Switch Tunes', tags: [`${sec(c.tunes.cooldown)} cd`],
      desc: `Swap between two tunes. Energetic: everyone in your ensemble moves ${pct(c.tunes.energetic.speed)} faster, and your notes fly ${pct(c.tunes.energetic.noteSpeed - 1)} faster and you strum ${pct(c.tunes.energetic.attackSpeed)} faster (just you). Calming: everyone in it heals ${c.tunes.calming.heal} hp per second, but your notes fly ${pct(1 - c.tunes.calming.noteSpeed)} slower and deal ${pct(1 - c.tunes.calming.noteDamage)} less damage.` },
    { key: 'E', icon: 'e', name: 'Inspire', tags: [`${sec(c.morale.duration)}`, `${sec(c.morale.cooldown)} cd`],
      desc: `Inspire every hero in your ensemble: ${pct(c.morale.attackSpeed)} faster attacks and ${pct(c.morale.damage)} more damage for ${sec(c.morale.duration)}. Your tune swells too: Energetic gives ${pct(c.morale.boostSpeed)} speed, Calming heals ${c.morale.boostHeal} hp per second.` },
    { key: 'F', icon: 'f', name: 'Lullaby', tags: [`${sec(c.lullaby.duration)} song`, `${sec(c.lullaby.cooldown)} cd`],
      desc: `Play a lullaby for ${sec(c.lullaby.duration)} - you can walk around while you play. Enemies within ${c.lullaby.radius} px fill a sleep meter while they hear it; after ${sec(c.lullaby.exposure)} they fall asleep for ${sec(c.lullaby.sleep)} (bosses ${sec(c.lullaby.bossSleep)}). A hit wakes a sleeper, but it takes ${sec(c.lullaby.wake)} to come round.` },
    { key: 'Q', icon: 'q', name: 'Screeching Tuning', tags: [`charge: deal ${c.ult.charge} dmg`, `${c.ult.damage} dmg`],
      desc: `Launch a wave of ${c.ult.notes} piercing notes that hit each enemy once, knock it back and weaken it for ${sec(c.ult.weaken)}: it deals ${pct(c.ult.weakenDamage)} less damage and takes ${pct(c.ult.weakenTaken)} more.` },
  ],
});

/** The guide for a hero class. */
function heroGuide(id) {
  return HERO_GUIDE[id](CONFIG.classes[id]);
}

/** Stats shown in the hero panel: label, value text, and a 0-1 bar (null = no bar). */
function heroStats(id) {
  const c = CONFIG.classes[id];
  const all = Object.values(CONFIG.classes);
  const maxHp = Math.max(...all.map((k) => k.hp));
  const maxSpeed = Math.max(...all.map((k) => k.speed));
  const dodge = c.passive.dodgeCooldown || CONFIG.player.dodge.cooldown;
  const stats = [
    { label: 'HEALTH', value: `${c.hp}`, bar: c.hp / maxHp, color: '#e84a4a' },
    { label: 'SPEED', value: `${c.speed}`, bar: c.speed / maxSpeed, color: '#6cff7a' },
    { label: 'CRIT RATE', value: pct(CONFIG.player.critChance), bar: CONFIG.player.critChance / 0.3, color: '#ffd34a' },
    { label: 'CRIT DAMAGE', value: `x${CONFIG.player.critMultiplier}`, bar: (CONFIG.player.critMultiplier - 1) / 1.5, color: '#ff9a2a' },
    { label: 'DODGE', value: `${sec(dodge)} cd`, bar: CONFIG.player.dodge.cooldown / dodge / 1.6, color: '#8ad8ff' },
  ];
  if (c.resource) {
    const regen = c.resource.regen ? `+${c.resource.regen}/s` : 'no regen';
    stats.push({ label: c.resource.name, value: `${c.resource.max} (${regen})`, bar: null, color: c.resource.color });
  }
  stats.push({ label: 'ULTIMATE', value: `deal ${c.ult.charge} dmg`, bar: null, color: '#c08aff' });
  return stats;
}
