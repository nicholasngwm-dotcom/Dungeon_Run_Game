// =============================================================
//  GAME BALANCE & SETTINGS
//  Every tunable number lives here. Times are in seconds,
//  speeds in pixels/second, distances in pixels.
// =============================================================

// This build's stamp: the ?v= that index.html puts on this script. Multiplayer only
// lets players on the same build play together (different code = instant desync).
const BUILD = (document.currentScript && new URL(document.currentScript.src, location.href).searchParams.get('v')) || 'dev';

const CONFIG = {
  screen: { width: 960, height: 540 },
  tileSize: 32,

  // Shared player rules
  player: {
    hurtInvulnerability: 0.7, // i-frames after taking a hit
    guardTime: 0.5,           // grace period after a block/shield absorbs a hit
    critChance: 0.1,
    critMultiplier: 1.6,
    // Shift: dodge in the moving direction (aim direction if standing still)
    dodge: { distance: 125, duration: 0.22, invulnerability: 0.3, cooldown: 1.7 },
    // Enemies further than this can't see an invisible hero
    invisibleDetectRange: 200,
    // passive regen: after `delay` seconds without losing hp, heal `hpPerSecond` (1 hp every 5s)
    regen: { delay: 4, hpPerSecond: 0.2 },
  },

  // Every enemy and boss hits this much harder (all their damage numbers), to make up for the
  // heroes' enhancements. Stacks with the stage's own damage scaling.
  enemyDamage: 1.3,

  // ---------------------------------------------------------
  //  GEMS & HERO ENHANCEMENTS (saved on the player's profile)
  // ---------------------------------------------------------
  gems: {
    win: 400,          // the gem vault's chest after the last boss of a run
    // a run that ends in a wipe pays for how far it got: deathShare of `win`, times the share of
    // the run done (each stage a third; within a stage its rooms are roomShare, its boss the rest)
    deathShare: 0.75,
    roomShare: 0.75,
  },
  // bought in order, each hero on their own track, with gems from beating dungeons
  enhancements: [
    { id: 'hp', name: 'Vitality', desc: '+50 max health', cost: 100, hp: 50 },
    { id: 'speed', name: 'Swiftness', desc: '+20 movement speed', cost: 500, speed: 20 },
    { id: 'crit', name: 'Keen Eye', desc: '+5% critical hit chance', cost: 1000, crit: 0.05 },
    { id: 'dodge', name: 'Light Step', desc: 'Dodge recharges 0.2 seconds faster', cost: 2000, dodge: 0.2 },
    { id: 'cooldowns', name: 'Mastery', desc: 'Ability cooldowns 25% shorter', cost: 3500, cooldowns: 0.25 },
    { id: 'tree', name: 'Ability Tree', desc: 'Shape how this hero\'s abilities work', cost: 5000, locked: true },
  ],

  // ---------------------------------------------------------
  //  PETS (bought with gems in the keep's pet room, saved on the profile; one comes along at a time)
  //  They follow their hero and fight whatever is near them. They never die: at 0 hp a pet runs back
  //  to its hero and won't fight until it has healed to full (recoverTime s). Out of a fight it heals
  //  regen of its max hp per second once it hasn't been hit for regenDelay s. Enemy bodies never hurt
  //  pets. damage: each attack; every: seconds between attacks; their damage grows by stageDamage
  //  per stage after the first. Total Loyalty / Stronger Buddies (the follower upgrades) apply to them.
  // ---------------------------------------------------------
  petRules: { recoverTime: 12, regen: 0.04, regenDelay: 4, leash: 300, stageDamage: 0.35, hurtGrace: 0.35 },
  pets: {
    // bleed: every `every` s a scratch makes the target bleed (dps for time s)
    cat:  { name: 'Cat', cost: 250, hp: 150, speed: 240, damage: 9, every: 0.55, reach: 10, color: '#e08a44',
            bleed: { every: 3, dps: 10, time: 3 },
            desc: 'Scratches enemies, and every 3 seconds a scratch makes them bleed.' },
    // bark: every `every` s, enemies within radius are knocked away from the dog (knockback force)
    dog:  { name: 'Dog', cost: 300, hp: 175, speed: 230, damage: 13, every: 0.8, reach: 10, color: '#c89a5a',
            bark: { every: 5, radius: 190, knockback: 300 },
            desc: 'Bites enemies, and barks every 5 seconds, knocking back every enemy nearby.' },
    // flies, and only projectiles can hit it (no melee swings, slams or bites)
    bird: { name: 'Bird', cost: 250, hp: 75, speed: 280, damage: 4, every: 0.2, reach: 8, color: '#6ab8ff', flying: true,
            desc: 'Rapidly pecks at enemies. It flies, so melee attacks can\'t touch it.' },
    // flies, and spits water balls from up to `reach` px away: each flies at shot.speed and bursts
    // on landing, hurting every enemy within shot.splash px
    fish: { name: 'Flying Fish', cost: 300, hp: 125, speed: 250, damage: 12, every: 1.1, reach: 220, color: '#4ad0e8', flying: true,
            shot: { speed: 300, splash: 36 },
            desc: 'Glides on its fins and spits little exploding water balls at enemies from long range.' },
    // flies, and casts a slow magic wave (wave.speed px/s, out to wave.range px, wave.width wide) that drifts
    // through enemies, hurting each once. Passive, always on while it's with its hero (fighting or not):
    // every enemy that falls has luck.heart more chance of dropping a heart, luck.mana more of a mana orb
    // if its hero is a Mage, and luck.light chance of a light orb if its hero is a Priestess
    butterfly: { name: 'Enchanted Butterfly', cost: 350, hp: 50, speed: 240, damage: 16, every: 1.8, reach: 150, color: '#e08aff', flying: true,
                 wave: { speed: 110, range: 260, width: 22 }, luck: { heart: 0.06, mana: 0.2, light: 0.25 },
                 desc: 'Casts a slow magic wave that drifts through enemies. While it\'s with you, enemies drop more hearts (and more mana for a Mage, light orbs for a Priestess).' },
    // mud: each bite leaves a patch (radius, lasting time s): enemies in it move `slow` slower and take dps
    pig:  { name: 'Pig', cost: 350, hp: 250, speed: 200, damage: 20, every: 1.4, reach: 12, color: '#ff9ab0',
            mud: { radius: 40, time: 5, slow: 0.35, dps: 8 },
            desc: 'Toughest of the lot. Bites slowly, leaving mud that slows enemies and hurts them while they stand in it.' },
  },

  // ---------------------------------------------------------
  //  HERO CLASSES
  //  ult.charge = damage the hero must deal to fill the Q ultimate
  // ---------------------------------------------------------
  classes: {
    warrior: {
      // passive: after taking `hits` hits, the next one is blocked automatically
      // passive: every `hits` hits the next one is blocked, and enemy bodies do `contactReduction` less damage
      passive: { name: 'Tanker', hits: 4, contactReduction: 0.5 },
      name: 'Knight',
      hp: 400,
      speed: 200,
      crit: { chance: 0.1, multiplier: 1.5 },   // crit rate and crit damage (heroes without one use CONFIG.player's)
      // LMB: sword swings, sweeping left to right then back
      combo:  { damage: 42, cooldown: 0.27, range: 82, arcDegrees: 130, knockback: 180 },
      // RMB (hold): raise the barrier shield the knight carries, `distance` px ahead and facing the aim.
      // It's its own wall, so it soaks enemy projectiles (arrows, fireballs, lasers) crossing it, and ground
      // shockwaves rolling at it from the front (within shockwaveArc degrees of the aim); melee goes through.
      // Regens after `regenDelay` once lowered; if broken, it's down for `breakCooldown`.
      barrier: { hp: 150, regen: 80, regenDelay: 1.2, breakCooldown: 5, distance: 34, width: 96, thickness: 14,
                 moveMultiplier: 0.8, shockwaveArc: 150 },
      // LMB while the shield is up: shield bash. Lunges `distance` px over `time`s, hitting enemies in front
      // of the shield (within `reach`, inside `arcDegrees`) once each: damage, knockback and a stun.
      bash:    { damage: 45, stun: 1.2, knockback: 520, cooldown: 4, distance: 70, time: 0.15, reach: 56, arcDegrees: 120 },
      // E: spin attack, moving faster while spinning
      spin:   { damage: 22, tick: 0.22, duration: 5.5, radius: 88, knockback: 90, moveMultiplier: 1.35, cooldown: 12 },   // cooldown starts once the spin ends (or E cancels it)
      // F: wind up, then charge through enemies, stunning them. Holds `charges` uses; each refills over `cooldown`s
      charge: { windup: 0.25, distance: 330, time: 0.35, width: 44, damage: 35, stun: 1.0, knockback: 260, cooldown: 10, charges: 2 },
      // Q: power up, then a huge downward strike along the aim line.
      // LMB releases it early; damage scales from minPower up to full.
      ult:    { charge: 2100, powerTime: 3, moveMultiplier: 0.3, damage: 300, minPower: 0.35, length: 360, width: 84 },
    },
    ranger: {
      // passive: fastest hero, and a shorter dodge cooldown
      passive: { name: 'Agility', dodgeCooldown: 1.4 },
      name: 'Archer',
      hp: 225,
      speed: 250,   // fastest hero (Agility)
      crit: { chance: 0.15, multiplier: 2 },
      arrow:     { damage: 34, cooldown: 0.75, speed: 660, pierce: 1 },
      // F: camo. Cleanse, invisible and faster; enemies only spot you within detectRange.
      // Any attack (arrow, fire/ice arrow, volley) drops the camo straight away.
      camo:      { cooldown: 12, duration: 4, speedMultiplier: 1.4, detectRange: 120 },
      // E: the next arrows fire faster with +25% damage and pierce
      rapidFire: { cooldown: 9, arrows: 5, fireCooldown: 0.28, damageBonus: 0.25, pierceBonus: 0.25 },
      // RMB: pick a special arrow, then LMB fire / RMB ice.
      // Fire: high damage, pierces everything, burns. Ice: weak, but freezes an area.
      elemental: { cooldown: 7,
                   fire: { damage: 90, speed: 780, pierce: 99, burnDps: 16, burnDuration: 4 },
                   ice:  { damage: 12, speed: 620, radius: 105, freeze: 2.2 } },
      // Q: mark an area (Q again / RMB cancels), then LMB rains arrows on it for `duration` seconds
      ult:       { charge: 1700, damage: 20, maxRange: 420, radius: 110, arrows: 90,
                   delay: 0.4, duration: 5, impactRadius: 30 },
    },
    mage: {
      // passive: picking up a mana orb (even at full mana) boosts all damage for `duration`s
      passive: { name: 'Mana Surge', damageMultiplier: 1.2, duration: 2 },
      name: 'Mage',
      hp: 250,
      speed: 180,
      crit: { chance: 0.1, multiplier: 1.5 },
      resource:  { name: 'MANA', max: 200, regen: 5, color: '#3fc2a8' },
      bolt:      { damage: 24, cost: 3, cooldown: 0.3, speed: 360, turnRate: 7, seekRange: 420, life: 2.2 },
      // RMB: the frostfire ball; everything in its blast is ignited with frostfire for burnTime s: burning
      // (burnDps) and slowed by `slow` at once. Another hit refreshes it rather than stacking
      fireball:  { damage: 65, cost: 30, cooldown: 2, speed: 340, radius: 70, maxRange: 450, burnDps: 12, burnTime: 3, slow: 0.35 },
      // E: pick a target with LMB, lightning strikes after `delay` and arcs
      lightning: { damage: 240, cost: 120, cooldown: 3, delay: 1, selectRadius: 70,
                   arcRange: 240, arcDamage: 140, arcCount: 4 },
      // F: turn into a small, fast bird (tiny hitbox, can't cast). F again lands early.
      // F: bird form: flies over obstacles (cover, pillars, furniture, hedges) and spike traps; walls and doors still stop it
      bird:      { cost: 30, cooldown: 6, duration: 4, speedMultiplier: 1.8, radius: 5 },
      // Q: place a magic circle (LMB, RMB cancels) that drains enemies in it into mana (manaSteal of the damage).
      // The fewer enemies inside, the harder it drains each: dps x focus / sqrt(enemies inside), never below dps
      // (so 1 enemy takes 2x, 2 take 1.4x, 4 or more take dps each).
      // While a circle is active, RMB / E / F cooldowns are capped at activeCooldown seconds.
      ult:       { charge: 1400, duration: 5, radius: 130, dps: 50, focus: 2, tick: 0.25, manaSteal: 0.45, maxRange: 300, activeCooldown: 1 },
    },
    rogue: {
      // passive: each kill in a streak adds damage (up to maxStreak); the streak ends after `duration`s without a kill
      passive: { name: 'Killing Streak', maxStreak: 10, damagePerStreak: 0.03, duration: 4 },
      name: 'Rogue',
      hp: 200,
      speed: 220,
      crit: { chance: 0.15, multiplier: 1.5 },
      resource: { name: 'ENERGY', max: 200, regen: 1, perKill: 9, color: '#f0c040' },
      dagger:   { damage: 15, cost: 2, cooldown: 0.4, speed: 580, spreadDegrees: 22, count: 3 },
      // RMB: dash-slash; enemies under half hp start bleeding. Every enemy hit is marked for
      // markDuration; if a marked enemy dies, the strike's cooldown resets.
      strike:   { damage: 45, cost: 30, cooldown: 1.2, distance: 190, duration: 0.18, invulnerability: 0.3,
                  bleedBelow: 0.5, bleedDps: 5, bleedDuration: 3, markDuration: 4 },
      // E: block window; a successful parry refunds energy and speeds you up
      parry:    { window: 0.5, cooldown: 4, energy: 75, speedMultiplier: 1.4, speedDuration: 4 },
      // F: the next LMB becomes a dagger storm
      storm:    { cost: 100, cooldown: 8, duration: 3, interval: 0.06, spreadDegrees: 64, damage: 13 },
      // Q: vanish, return with exploding clones that hunt enemies on their own
      ult:      { charge: 1500, vanish: 0.5, clones: 3, cloneRange: 130, cloneHp: 140, cloneDamageTaken: 1.5, cloneDamageDealt: 0.85,
                  cloneLife: 10, cloneFireInterval: 0.55, burstDaggers: 18, burstDamage: 42,
                  burstPierce: 3, burstStun: 1.5 },
    },
    priestess: {
      // passive: hitting an enemy marked by the light missiles may drop a light orb (orbChance), and killing one always does
      passive: { name: 'Divine Mark', orbChance: 0.18 },
      name: 'Priestess',
      hp: 225,
      speed: 180,
      crit: { chance: 0.05, multiplier: 2 },
      // light orbs: no regen; refilled only by orbs dropped from marked enemies (can't pick one up when full)
      resource:  { name: 'LIGHT', max: 4, regen: 0, color: '#ffe680' },
      // LMB: a beam of light falls on the cursor after `delay`
      ray:       { damage: 46, cooldown: 0.6, delay: 0.3, radius: 56, maxRange: 380 },
      // RMB: missiles that each seek a different enemy and mark it for markDuration
      missiles:  { count: 5, damage: 22, cooldown: 6, speed: 330, turnRate: 6, life: 2.6, markDuration: 10 },
      // E: a healing rune appears at her feet straight away (heal is hp per second)
      rune:      { cost: 2, cooldown: 8, heal: 50, duration: 4, radius: 85 },
      // F: then LMB shields the ally nearest the cursor (allyHp), RMB shields yourself (selfHp)
      aegis:     { cost: 2, cooldown: 10, allyHp: 150, selfHp: 50, duration: 8, selectRadius: 80 },
      // Q: charge for up to powerTime (LMB releases early), then throw a stunning light bomb at the cursor.
      // Damage, radius and stun scale from their minimums up to full. Takes `cost` light orbs as well as the full charge.
      ult:       { charge: 1600, cost: 4, powerTime: 4, moveMultiplier: 0.4, maxRange: 380, flightTime: 0.35,
                   damage: 480, minPower: 0.25, radius: 170, minRadius: 80, stun: 2.5, minStun: 0.8 },
    },
    bard: {
      // passive: her tune plays for every hero within `radius` of her (herself included)
      passive: { name: 'Ensemble', radius: 190 },
      name: 'Bard',
      hp: 225,
      speed: 180,
      crit: { chance: 0.05, multiplier: 1.5 },
      // LMB: strum `count` magic notes in a small fan; they bob side to side as they fly
      strum:   { damage: 17, cooldown: 0.35, count: 3, spreadDegrees: 16, speed: 430, life: 0.95, wobble: 0.45 },
      // RMB: swap tunes. Energetic: +speed (move speed). Calming: heal hp per second.
      // the tune also shapes her own notes (allies don't get these): energetic ones fly faster (noteSpeed) and she
      // strums faster (attackSpeed); calming ones fly slower (same reach) and hit softer (noteDamage)
      tunes:   { cooldown: 1, energetic: { speed: 0.2, noteSpeed: 1.35, attackSpeed: 0.3 },
                 calming: { heal: 3, noteSpeed: 0.65, noteDamage: 0.75 } },
      // E: inspire every hero in the ensemble (passive radius): faster attacks and more damage for `duration`s,
      // and her song swells meanwhile: Energetic gives boostSpeed, Calming heals boostHeal per second
      morale:  { cooldown: 12, duration: 5, attackSpeed: 0.15, damage: 0.15, boostSpeed: 0.3, boostHeal: 10 },
      // F: play a lullaby for `duration`s, free to move. Enemies within `radius` fill a sleep meter while they
      // hear it (it drains again at meterDecay/s out of range); after `exposure`s they fall asleep for `sleep`s
      // (bosses for bossSleep). A hit wakes a sleeper: it takes `wake`s to come round.
      lullaby: { cooldown: 18, duration: 6, radius: 180, exposure: 2.5, sleep: 6, bossSleep: 4, wake: 1, meterDecay: 1 },
      // Q: a wave of piercing notes; each enemy is hit once, knocked back and weakened for `weaken`s
      // (deals weakenDamage less damage and takes weakenTaken more)
      ult:     { charge: 1500, notes: 11, spreadDegrees: 70, damage: 85, speed: 470, life: 0.9, knockback: 320,
                 weaken: 4, weakenDamage: 0.45, weakenTaken: 0.45 },
    },
    rocketeer: {
      // passive: his own rockets never hurt him (he rides the blasts), his blasts throw enemies further, and when
      // he goes down the three rockets on his back go off: a blast (damage in radius) that leaves the ground burning
      passive: { name: 'Blast Rider', knockback: 1.3,
                 lastStand: { damage: 140, radius: 120, fireRadius: 110, fireTime: 4, fireDps: 22, burnDps: 10, burnTime: 3 } },
      name: 'Rocketeer',
      hp: 250,
      speed: 180,
      crit: { chance: 0.1, multiplier: 1.5 },
      // ammo: rockets in the launcher. They reload one at a time, every `reload`s, starting `reloadDelay`s after a shot
      resource: { name: 'AMMO', max: 5, regen: 0, color: '#ff9a3a', reload: 0.75, reloadDelay: 0.45 },
      // LMB: an old rocket launcher. A direct hit takes `damage` + `splash` as one hit; everyone else in the burst
      // round it (`radius`) takes `splash`. (A crit multiplies each of those, so a direct crit hits hardest.)
      rocket:   { damage: 18, splash: 46, radius: 64, cost: 1, cooldown: 0.36, speed: 440, life: 1.4, knockback: 170 },
      // RMB (hold): charge a rocket jump. He fires a rocket at his feet (splash damage round where he stood) and is
      // flung toward the cursor, up to lerp(minDistance, maxDistance, charge) away, flying over obstacles. The
      // charge also sets his air time (lerp of flightTime) and how high he goes (height); he can't be hurt in the air
      jump:     { cooldown: 7, chargeTime: 0.9, minDistance: 110, maxDistance: 330, flightTime: [0.4, 1.2], height: [55, 140],
                  damage: 48, radius: 82, knockback: 260 },
      // E: pick an area (E, then LMB fires; E again or RMB cancels; works mid rocket jump too): one rocket per rocket
      // in the launcher (it empties it), spread evenly over the area (a sunflower spiral), `interval`s apart
      barrage:  { cooldown: 9, radius: 130, maxRange: 380, interval: 0.11, flightTime: 0.6, damage: 44, blastRadius: 56 },
      // F: drops an ammo pack at his feet that refills the launcher on the spot. Holds `charges` packs; each restocks over `cooldown`s
      ammoPack: { cooldown: 14, charges: 2 },
      // Q: the IBFR. A huge unstable rocket weaving (amplitude, waves per second) toward the cursor; it goes off on
      // whatever it hits, or after `life`s: a massive blast that knocks down every obstacle within `destroyRadius`
      // and leaves the ground burning (fireRadius) for fireTime, setting enemies alight (burnDps for burnTime)
      ult:      { charge: 1900, speed: 250, life: 2.4, amplitude: 22, waves: 2.2, damage: 360, radius: 190,
                  destroyRadius: 170, knockback: 420, fireRadius: 120, fireTime: 6, fireDps: 26, burnDps: 12, burnTime: 3 },
    },
    baker: {
      // passive: every cake splat leaves sticky icing on the floor for `time`s; enemies in it move `slow` slower
      passive: { name: 'Sticky Icing', time: 4, radius: 42, slow: 0.4 },
      name: 'Baker',
      hp: 225,
      speed: 200,
      crit: { chance: 0.05, multiplier: 1.5 },
      // LMB: lob a cake in an arc to the cursor (up to `range`): enemies right where it lands (`hitRadius`) take `damage`,
      // the rest of the splat (`radius`) `splash`. Flight time is flightTime + distance / speed; drawn `scale` x bigger
      cake:     { damage: 40, splash: 20, hitRadius: 16, radius: 46, cooldown: 0.75, range: 330, flightTime: 0.2, speed: 800, scale: 2 },
      // RMB: a sack of flour thrown at the cursor (up to maxRange); it bursts into a cloud (`radius`) that hangs
      // for `cloudTime`s, confusing every enemy in it for `confuse`s: they stagger about aimlessly and can't attack
      flour:    { cooldown: 8, damage: 10, radius: 85, cloudTime: 2.5, confuse: 3, speed: 380, maxRange: 400 },
      // E: her next LMB throws `count` pastries round the cursor instead; they land as treats anyone can pick up:
      // each heals `heal` hp and gives a sugar rush (CONFIG.buffs.sugar). Uneaten ones go stale after `life`s
      pastries: { cooldown: 12, count: 4, heal: 25, spread: 130, flightTime: 0.55, life: 18 },
      // F: an oven set down in front of her: it stops enemy shots, and enemies within `taunt` px go after it instead
      // of her team. When its hp runs out, or after `life`s, it blows: a blast (`damage` in `radius`), fire everywhere
      // (fireRadius, for fireTime, burning enemies) and `food` pastries flung out
      oven:     { cooldown: 16, hp: 320, life: 5, taunt: 170, distance: 46, radius: 24, damage: 60, blastRadius: 120,
                  fireRadius: 130, fireTime: 5, fireDps: 24, burnDps: 10, burnTime: 3, food: 3 },
      // Q: a massive cake dropped from the sky on the cursor (up to maxRange): its shadow grows for `fall`s, then it
      // squashes everything under it (`radius`): damage and a stun. It stands for `stay`s, then melts into icing.
      ult:      { charge: 1700, maxRange: 420, fall: 1.1, radius: 140, damage: 300, stun: 2, stay: 2.5 },
    },
  },

  // ---------------------------------------------------------
  //  ENEMIES
  //  windup = telegraph time before the attack lands
  // ---------------------------------------------------------
  //  stunResist = fraction of stun duration ignored
  //  contactDamage (optional) overrides the shared enemyContactDamage
  enemyContactDamage: 10,   // touching an enemy's body hurts (hero i-frames limit the rate)
  // every enemy's body (contactDamage) hurts this much more, to make up for knockback pushing them about harder
  contactScale: 1.2,
  // knockback on enemies: every push is `scale` x stronger and eases off at `decay` per second (lower slides
  // further). An enemy knocked into a wall or obstacle at slamSpeed px/s or more is slammed: it takes
  // slamDamage (more the faster it hit, up to slamMax) from whoever knocked it, and is dazed for slamStun s
  knockback: { scale: 1.6, decay: 7, slamSpeed: 230, slamDamage: 18, slamMax: 60, slamStun: 0.35 },
  // a knob for how big enemies draw (around their feet). Their sprites are drawn in the
  // heroes' chibi proportions, so 1; hit boxes, reaches and telegraphs never scale
  enemyDrawScale: 1,
  // all summoners together (gravestones, necromancers, sorcerer skulls) keep at most this many
  // summoned enemies up at once (x the party's enemy count scaling), on top of their own limits
  // summoners: at most summonCap summons alive at once across the fight; each summoner also has a
  // lifetime limit (summonTotal in its own config) after which it stops raising anything
  summonCap: 8,
  enemies: {
    zombie: {
      hp: 125, speed: 48, radius: 14, damage: 22,
      attackRange: 46, attackReach: 62, attackArcDegrees: 100,
      windup: 0.55, recovery: 0.5, cooldown: 0.9,
    },
    slime: {
      hp: 220, speed: 58, radius: 20, damage: 26,
      leapTrigger: 140, leapMaxDistance: 150, landRadius: 48,
      windup: 0.65, leapTime: 0.5, recovery: 0.7, cooldown: 1.5,
      splitCount: 3,
    },
    slimeSmall: {
      hp: 55, speed: 80, radius: 11, damage: 13,
      leapTrigger: 100, leapMaxDistance: 110, landRadius: 26,
      windup: 0.5, leapTime: 0.4, recovery: 0.5, cooldown: 1.2,
      splitCount: 0,
    },
    wraith: {
      hp: 75, speed: 125, radius: 13, damage: 26,
      dashTrigger: 180, dashDistance: 250, dashTime: 0.22, dashWidth: 26,
      windup: 0.5, recovery: 0.6, cooldown: 1.3,
    },
    skeleton: {
      hp: 85, speed: 72, radius: 13, damage: 18,
      preferredMin: 170, preferredMax: 300,
      windup: 0.7, aimLockAt: 0.3, cooldown: 1.9, arrowSpeed: 360,
    },
    undeadKnight: {
      hp: 620, speed: 46, radius: 20, damage: 60,
      attackRange: 72, attackReach: 98, attackArcDegrees: 140,
      windup: 0.85, recovery: 0.7, cooldown: 0.95, knockbackResist: 0.9, stunResist: 0.5,
    },
    // summoned by the Clay Golem: smashes the ground, sending out a shockwave ring
    clayMinion: {
      hp: 60, speed: 62, radius: 13, damage: 16,
      attackRange: 70, windup: 0.7, recovery: 0.6, cooldown: 1.6,
      waveRadius: 110, waveSpeed: 260, waveWidth: 14,
      heartChance: 0.12,   // overrides drops.heartChance
    },
    // stationary: raises a zombie or skeleton every spawnInterval (up to maxAlive at once),
    // and releases 1-3 ghosts when destroyed
    gravestone: {
      hp: 220, speed: 0, radius: 18, damage: 0, contactDamage: 0,
      firstSpawn: 1.5, spawnInterval: 2, maxAlive: 3, summonTotal: 8, spawnTypes: ['zombie', 'skeleton'],
      ghosts: [1, 3], heartChance: 0.18,
    },
    // only comes out of broken gravestones: slow, contact damage only,
    // with a chilling aura that slows heroes inside it
    ghost: {
      hp: 60, speed: 48, radius: 13, damage: 16, contactDamage: 16,
      auraRadius: 130, slowAmount: 0.90, knockbackResist: 0.4,
      maxLead: 1.4,   // seconds ahead of the hero it aims for, to cut them off
    },
    // a treasure chest with teeth: hops slowly toward the hero, then lunges again and again
    // while the hero stays within leashRange. Very tough, hits hard, always drops one super buff orb
    // (Mimic Sense: senseChance of dropping all three)
    mimic: {
      hp: 700, speed: 0, radius: 18, damage: 42, contactDamage: 14,
      hopDistance: 46, hopTime: 0.32, hopRest: 0.55,
      aggroRange: 160, leashRange: 230,
      windup: 0.42, aimLockAt: 0.15, lungeDistance: 150, lungeTime: 0.2, recovery: 0.45,
      knockbackResist: 0.85, stunResist: 0.5, senseChance: 0.35, heartChance: 0.15,
    },
  },

  // ---------------------------------------------------------
  //  GRAVEYARD ENEMIES (dungeon runs). Zombie, skeleton archer, wraith (Phantom),
  //  undead knight (Zombie Knight), gravestone (Tombstone) and ghost reuse the entries above.
  // ---------------------------------------------------------
  graveyardEnemies: {
    // Bletching zombie: crawls, spits slow globs of poison
    bletcher: {
      hp: 170, speed: 24, radius: 16, damage: 12,
      preferredMin: 150, preferredMax: 280, windup: 0.8, cooldown: 2.4, spitSpeed: 150,
      poisonDps: 5, poisonTime: 3,
    },
    // Skeleton warrior: its shield blocks the first hit, then it fights with a sword
    skeletonWarrior: {
      hp: 150, speed: 62, radius: 13, damage: 24,
      attackRange: 46, attackReach: 64, attackArcDegrees: 110,
      windup: 0.5, recovery: 0.45, cooldown: 0.9,
    },
    // Skeleton bomber: runs at you, lights the fuse when close; also goes off when killed
    bomber: {
      hp: 70, speed: 88, radius: 13, damage: 55,
      enemyDamage: 60,   // its blast hurts the other enemies around it too
      triggerRange: 60, fuse: 0.8, blastRadius: 80, deathFuse: 0.35,
    },
    // Candlehead: skeleton that fires souls; a soul knocks you back hard
    candlehead: {
      hp: 95, speed: 58, radius: 13, damage: 14,
      preferredMin: 170, preferredMax: 300, windup: 0.6, cooldown: 1.5, soulSpeed: 230, knockback: 400,
    },
    // Shadowalker: poison dagger; every blinkInterval it teleports behind you and stabs
    shadowalker: {
      hp: 130, speed: 96, radius: 13, damage: 20,
      attackRange: 44, attackReach: 58, attackArcDegrees: 100,
      windup: 0.4, recovery: 0.4, cooldown: 0.8,
      blinkInterval: 5, blinkWindup: 0.3, poisonDps: 5, poisonTime: 3,
    },
    // stage 2+: Necromancer keeps away, raises undead in groups and fires souls
    necromancer: {
      hp: 280, speed: 46, radius: 14, damage: 16,
      preferredMin: 200, preferredMax: 330, soulEvery: 2.2, soulSpeed: 220, knockback: 200,
      summonEvery: 7, summonCount: 3, summonMax: 6, summonTotal: 12, summonTypes: ['zombie', 'skeleton', 'skeletonWarrior','bomber','candlehead'],
    },
    // stage 2+: Reaper swings a scythe, sends waves of darkness and teleports in close
    reaper: {
      hp: 420, speed: 70, radius: 16, damage: 38,
      attackRange: 70, attackReach: 92, attackArcDegrees: 150, windup: 0.7, recovery: 0.6, cooldown: 1.2,
      waveEvery: 4.5, waveWindup: 0.6, waveSpeed: 260, waveDamage: 26,
      blinkEvery: 6, blinkRange: 260,
      knockbackResist: 0.6, stunResist: 0.4,
      // on death darkness gathers for deathDelay seconds, then explodes: deathDamage to heroes
      // within deathRadius and deathWaves waves of darkness flying outward
      deathDelay: 0.7, deathRadius: 110, deathDamage: 30, deathWaves: 10, deathWaveSpeed: 170, deathWaveDamage: 18,
    },
    // stage 2+: big skeleton with a minigun: spins up, then sprays slow bullets
    minigunner: {
      hp: 460, speed: 34, radius: 20, damage: 14,
      preferredMin: 180, preferredMax: 320, spinUp: 1.0, fireTime: 2.0, fireEvery: 0.08, bulletSpeed: 210,
      spreadDegrees: 14, cooldown: 2.6, knockbackResist: 0.8, stunResist: 0.5,
    },
    // stage 3: Zombie soldier: armoured (takes `armor` less damage), fires fast bullet bursts
    zombieSoldier: {
      hp: 220, speed: 50, radius: 14, damage: 28, armor: 0.15,   // fragile now, but every bullet of its 3-round burst hits hard
      preferredMin: 160, preferredMax: 300, windup: 0.55, burst: 3, burstEvery: 0.12, bulletSpeed: 540, cooldown: 1.9,
      knockbackResist: 0.5,
    },
    // stage 3: Skeleton sorcerer: lines of bone hands burst from the ground (stun), and summons exploding skulls
    skeletonSorcerer: {
      hp: 240, speed: 44, radius: 14, damage: 18,
      preferredMin: 190, preferredMax: 320,
      handsEvery: 3.5, handsCount: 7, handsSpacing: 40, handsDelay: 0.55, handsStep: 0.08, handsRadius: 27, stun: 1.0,
      skullsEvery: 8, skullCount: 3, skullMax: 3, summonTotal: 9,
    },
    // summoned by the sorcerer: flies straight at you and explodes on contact
    flyingSkull: { hp: 20, speed: 150, radius: 9, damage: 35, blastRadius: 50, contactDamage: 0, coins: 0 },
  },

  // ---------------------------------------------------------
  //  CASTLE ENEMIES (dungeon runs): the corrupted court of a fallen empire.
  // ---------------------------------------------------------
  castleEnemies: {
    // Squire: a young soldier with a sword; quick, simple slashes
    squire: {
      hp: 110, speed: 78, radius: 13, damage: 20,
      attackRange: 50, attackReach: 66, attackArcDegrees: 120, windup: 0.45, recovery: 0.45, cooldown: 0.9,
    },
    // Castle archer: keeps away and looses arrows (red aim line first)
    castleArcher: {
      hp: 80, speed: 70, radius: 13, damage: 18,
      preferredMin: 180, preferredMax: 310, windup: 0.75, aimLockAt: 0.3, cooldown: 1.8, arrowSpeed: 380,
    },
    // Minstrel: plays a war song; every other enemy within auraRadius recovers attackSpeed faster
    // between attacks. Plinks the odd note at you too
    minstrel: {
      hp: 90, speed: 62, radius: 13, damage: 10,
      preferredMin: 200, preferredMax: 320, auraRadius: 200, attackSpeed: 0.4, noteEvery: 2.4, noteSpeed: 190,
    },
    // Squire with a gun: aims (a long red line), fires one heavy ball, then takes its time reloading
    gunner: {
      hp: 95, speed: 60, radius: 13, damage: 34,
      preferredMin: 190, preferredMax: 340, windup: 0.85, aimLockAt: 0.25, bulletSpeed: 640, reload: 2.6,
    },
    // Catapult: trundles about very slowly on its wheels, keeping keepAway from you (all the catapults do);
    // stops to hurl boulders that land where the red circle shows
    catapult: {
      hp: 300, speed: 22, radius: 20, damage: 40, contactDamage: 0, keepAway: 260,
      range: 560, windup: 1.0, flight: 1.1, cooldown: 3.0, blastRadius: 62,
      knockbackResist: 1, stunResist: 0.5, heartChance: 0.15,
    },
    // stage 2+: Flaming catapult: tougher; its burning boulders hit harder and leave fire that burns (burnDps for burnTime)
    flamingCatapult: {
      hp: 480, speed: 20, radius: 20, damage: 52, contactDamage: 0, keepAway: 260,
      range: 580, windup: 1.0, flight: 1.1, cooldown: 3.2, blastRadius: 66,
      fireRadius: 64, fireTime: 4, burnDps: 9, burnTime: 3,
      knockbackResist: 1, stunResist: 0.5, heartChance: 0.18,
    },
    // stage 3: Cluster catapult: a plain catapult's hp, but it hurls a whole volley: boulders[0]-boulders[1]
    // burning boulders raining down spaced out round you, up to `spread` px away, `stagger` s apart, each like the flaming catapult's
    clusterCatapult: {
      hp: 300, speed: 20, radius: 20, damage: 52, contactDamage: 0, keepAway: 260,
      range: 600, windup: 1.3, flight: 1.1, cooldown: 4.5, blastRadius: 66,
      boulders: [5, 6], spread: 180, stagger: 0.12,
      fireRadius: 64, fireTime: 4, burnDps: 9, burnTime: 3,
      knockbackResist: 1, stunResist: 0.5, heartChance: 0.18,
    },
    // stage 3: Army general: once, he raises the empire's banner and calls the charge: every enemy within
    // rallyRadius moves rallySpeed faster for rallyTime s and gets a rallyShield hp shield. Then he runs you
    // down like the cavalry, spear couched (chargeTime s, stabbing as he passes), and stops tiredTime s to
    // catch his breath before the next charge
    general: {
      hp: 560, speed: 72, radius: 16, damage: 34,
      rallyRadius: 280, rallyTime: 8, rallySpeed: 1.35, rallyShield: 20, rallyWindup: 1.0,
      chargeWindup: 0.45, chargeTime: 3, chargeSpeed: 170, turnRate: 2.4, stabRange: 56, stabEvery: 0.6, tiredTime: 1,
      knockbackResist: 0.6, stunResist: 0.4,
    },
    // the Prince's bodyguard (from his trumpet): a massive shield and a flail he whirls round himself (orbit
    // damage every orbitTick s to whoever it touches); a hero far off gets the flail cast at them down a line;
    // shots coming at him make him raise the shield (blocking everything for blockTime s)
    princeGuard: {
      hp: 640, speed: 50, radius: 24, damage: 16, coins: 0,
      orbitRadius: 74, orbitSpeed: 11, orbitTick: 0.45, ballRadius: 15,
      castRange: [200, 400], castWindup: 0.6, castReach: 340, castSpeed: 760, castWidth: 34, castDamage: 30, castCooldown: 3.5,
      blockTime: 1.4, blockCooldown: 4, blockSense: 170,
      knockbackResist: 0.85, stunResist: 0.5,
    },
    // Mace spinner: up close it whirls both maces round, hurting anyone inside spinRadius every tickEvery
    // seconds while it lurches after you, then staggers dizzily
    maceSpinner: {
      hp: 210, speed: 70, radius: 15, damage: 9,
      spinRange: 95, spinWindup: 0.5, spinRadius: 58, spinTime: 2.6, tickEvery: 0.22, spinSpeed: 62, dizzy: 1.1, cooldown: 1.6,
      knockbackResist: 0.4,
    },
    // Bishop: never attacks (not even by touch). Keeps back from you, hurries toward the wounded, and every
    // healEvery seconds blesses the ground around it, healing every enemy (and boss) inside healRadius by healAmount of their max hp
    bishop: {
      hp: 150, speed: 58, radius: 13, damage: 0, contactDamage: 0,
      preferredMin: 200, preferredMax: 320,
      healEvery: 3.2, healWindup: 0.9, healRadius: 160, healAmount: 0.3, bossHeal: 0.012,
    },
    // Knight: sword and kite shield; when hit it may raise the shield (blockChance), blocking hits from the front
    castleKnight: {
      hp: 260, speed: 54, radius: 15, damage: 30,
      attackRange: 58, attackReach: 78, attackArcDegrees: 120, windup: 0.6, recovery: 0.5, cooldown: 1.1,
      blockChance: 0.35, blockTime: 1.4, blockCooldown: 2.5, knockbackResist: 0.5, stunResist: 0.3,
    },
    // Cavalry: two spear lunges along red lanes, then rides you down for rideTime (stabbing as it passes), then lunges again
    cavalry: {
      hp: 340, speed: 110, radius: 18, damage: 30, contactDamage: 12,
      lungeWindup: 0.5, lungeDistance: 190, lungeTime: 0.24, lungeWidth: 34, lunges: 2, lungeGap: 0.35,
      rideTime: 3.4, rideSpeed: 175, turnRate: 2.2, stabRange: 58, stabEvery: 0.55, rest: 0.8,
      knockbackResist: 0.8, stunResist: 0.4,
    },
    // Castle sorcerer: conjures magic bolts in patterns (a ring, a spiral, or a circle closing in on you);
    // the first time its hp drops below blinkBelow it teleports away
    castleSorcerer: {
      hp: 200, speed: 50, radius: 13, damage: 16,
      preferredMin: 210, preferredMax: 330, castEvery: 3.2, castWindup: 0.7, boltSpeed: 170,
      ringCount: 12, spiralArms: 3, spiralTime: 1.4, spiralEvery: 0.1, closeCount: 7, closeRadius: 150, closeDelay: 0.7,
      blinkBelow: 0.35,
    },
    // stage 2+: Executioner: a huge overhead axe chop. A hero below executeBelow of their hp is executed outright
    // if it lands (a red skull marks who is in danger)
    executioner: {
      hp: 520, speed: 46, radius: 17, damage: 48,
      attackRange: 76, attackReach: 104, attackWidth: 56, windup: 1.0, recovery: 0.8, cooldown: 1.2,
      executeBelow: 0.25, knockbackResist: 0.7, stunResist: 0.5,
    },
    // stage 2+: Jester: dodges dodgeChance of your hits with a short backflip, or (sideChance of them) a quick
    // sidestep; slashes and stabs with two daggers that make you bleed
    jester: {
      hp: 170, speed: 112, radius: 13, damage: 14,
      attackRange: 46, attackReach: 62, attackArcDegrees: 110, windup: 0.3, recovery: 0.3, cooldown: 0.75, combo: 3,
      dodgeChance: 0.5, dodgeDistance: 34, dodgeTime: 0.3, sideChance: 0.5, sideDistance: 30, sideTime: 0.2, bleedDps: 6, bleedTime: 3,
    },
    // stage 2+: Royal guard: a stronger knight that also charges at you (chargeDamage) along a red lane
    royalGuard: {
      hp: 420, speed: 58, radius: 16, damage: 36,
      attackRange: 62, attackReach: 84, attackArcDegrees: 130, windup: 0.65, recovery: 0.5, cooldown: 1.1,
      blockChance: 0.4, blockTime: 1.4, blockCooldown: 2.5,
      chargeEvery: 5.5, chargeRange: [140, 380], chargeWindup: 0.6, chargeSpeed: 430, chargeDistance: 280, chargeWidth: 40, chargeDamage: 40,
      knockbackResist: 0.7, stunResist: 0.4,
    },
    // stage 3: The Prince: dashes in slashing and stabbing; at half hp he sounds his trumpet for summonCount royal guards
    prince: {
      hp: 700, speed: 96, radius: 15, damage: 30,
      attackRange: 190, dashWindup: 0.45, dashDistance: 150, dashTime: 0.18, dashWidth: 36,
      comboReach: 70, comboArcDegrees: 130, comboGap: 0.28, recovery: 0.7, cooldown: 1.3,
      summonAt: 0.5, summonCount: 2, knockbackResist: 0.6, stunResist: 0.4,
    },
    // stage 3: The Princess: a crossbow volley of `volley` bolts (the last a magic bolt that chases you for homingTime);
    // throws ice potions that leave a slowing patch of ice; slowly heals herself (regen of max hp per second)
    princess: {
      hp: 520, speed: 70, radius: 13, damage: 16,
      preferredMin: 210, preferredMax: 340, volleyWindup: 0.6, volley: 6, volleyEvery: 0.13, boltSpeed: 470,
      magicSpeed: 230, homingTime: 3, magicDamage: 24, volleyCooldown: 2.6,
      potionEvery: 5.5, potionFlight: 0.9, iceRadius: 70, iceTime: 4, iceSlow: 0.5, regen: 0.015,
      knockbackResist: 0.4, stunResist: 0.3,
    },
    // the Queen's gardeners (her second phase): water droplets from a magic watering can
    gardener: {
      hp: 90, speed: 64, radius: 13, damage: 14,
      preferredMin: 150, preferredMax: 280, windup: 0.6, cooldown: 3.4, dropSpeed: 250, drops: 3, spreadDegrees: 22, bounces: 1, coins: 0,
    },

    // ---------- the Ancient Ruins: rock and clay guardians, stirred by the magic lingering in the air ----------
    // Rockmite: a little rock golem; keeps back and throws small rocks
    rockmite: {
      hp: 70, speed: 66, radius: 11, damage: 14,
      preferredMin: 150, preferredMax: 280, windup: 0.5, cooldown: 1.5, rockSpeed: 320,
    },
    // Rock disc: a floating stone ring with magic at its core; aims (a line that locks), then fires a laser
    rockDisc: {
      hp: 90, speed: 58, radius: 13, damage: 22,
      preferredMin: 200, preferredMax: 340, windup: 1.0, aimLockAt: 0.35, beamTime: 0.25, beamWidth: 12, cooldown: 2.4,
    },
    // Clay guard: its clay shield soaks the first hit it takes, then crumbles; thrusts its spear down a lane
    clayGuard: {
      hp: 140, speed: 64, radius: 14, damage: 24,
      attackRange: 80, thrustReach: 104, thrustWidth: 26, windup: 0.55, recovery: 0.5, cooldown: 1.1, knockbackResist: 0.3,
    },
    // Clay slime: comes in threes (companions); hops, leaps onto you, and splits into splitCount little ones
    claySlime: {
      hp: 60, speed: 62, radius: 12, damage: 14,
      leapTrigger: 120, leapMaxDistance: 130, landRadius: 36,
      windup: 0.55, leapTime: 0.45, recovery: 0.6, cooldown: 1.4,
      splitCount: 3, companions: [['claySlime', 2]],
    },
    claySlimeTiny: {
      hp: 18, speed: 84, radius: 7, damage: 7,
      leapTrigger: 90, leapMaxDistance: 100, landRadius: 22,
      windup: 0.45, leapTime: 0.35, recovery: 0.45, cooldown: 1.1,
      splitCount: 0,
    },
    // Clay bud golem: a small clay golem that walks up and slams the ground all round it
    clayBud: {
      hp: 120, speed: 58, radius: 13, damage: 26,
      slamRange: 64, slamRadius: 74, windup: 0.75, recovery: 0.6, cooldown: 1.6, knockbackResist: 0.4,
    },
    // Rock shell: a crab in a spiked rock shell (armour); rock spikes burst up in a line right across the room
    rockShell: {
      hp: 220, speed: 40, radius: 16, damage: 24, armor: 0.5,
      preferredMin: 160, preferredMax: 300, spikeEvery: 4.2, castTime: 0.6,
      spikeSpacing: 38, spikeDelay: 0.6, spikeStep: 0.045, spikeRadius: 22, spikeMax: 30,
      knockbackResist: 0.6, stunResist: 0.3,
    },
    // Rock bowler: carries a giant boulder about, rolls it down a lane (it bounces off the walls `bounces` times), then spends
    // raiseTime s empty-handed, raising a new one out of the ground
    rockBowler: {
      hp: 160, speed: 50, radius: 15, damage: 32,
      preferredMin: 180, preferredMax: 320, windup: 1.0, aimLockAt: 0.3, boulderSpeed: 330, boulderRadius: 17, bounces: 4, raiseTime: 1.2,
      cooldown: 3.0, knockbackResist: 0.5,
    },
    // Rock wizard: draws the lingering magic into a cloud and launches it; the cloud lingers cloudLife s,
    // hurting anyone inside every 0.25s (damage is per tick)
    rockWizard: {
      hp: 110, speed: 52, radius: 12, damage: 5,
      preferredMin: 200, preferredMax: 330, gather: 1.2, cloudSpeed: 170, cloudRadius: 56, cloudLife: 3, cloudHit: 18, cooldown: 3.4,
    },
    // Ruined turret: never moves; fires four lasers at once in a cross. While it aims (windup, with the four lines
    // showing) it turns to a + or an X, whichever lines up with you, locking aimLockAt s before it fires;
    // each laser runs to the wall (up to range) and lasts beamTime; then it waits cooldown
    ruinedTurret: {
      hp: 200, speed: 0, radius: 16, damage: 26, contactDamage: 0,
      range: 900, windup: 1.1, aimLockAt: 0.35, beamTime: 0.35, beamWidth: 14, cooldown: 2.0, turnRate: 3,
      knockbackResist: 1, stunResist: 0.5, heartChance: 0.15,
    },
    // Stone pillar: hops after you quickly and slams the ground round it, then stands still for invulnTime,
    // hardened (can't be hurt) - the only time it's immune
    stonePillar: {
      hp: 180, speed: 0, radius: 15, damage: 28,
      hopEvery: 0.55, hopDistance: 96, hopTime: 0.32, slamRange: 70, slamRadius: 60, windup: 0.4, invulnTime: 0.6,
      knockbackResist: 1, stunResist: 0.5,
    },
    // stage 2+: Rock golem: extremely tanky; winds up (windup, the red fan showing) and slams the ground: a shockwave of
    // rock rips outward in a fan (waveArcDegrees wide, out to waveReach) that stuns whoever it catches
    rockGolem: {
      hp: 560, speed: 52, radius: 19, damage: 30,
      slamRange: 240, windup: 1.0, aimLockAt: 0.3, waveSpeed: 330, waveWidth: 30, waveReach: 400, waveArcDegrees: 70, stun: 1.0, recovery: 0.9, cooldown: 2.8,
      knockbackResist: 0.9, stunResist: 0.6, heartChance: 0.2,
    },
    // stage 2+: Ancient portal: never moves; every summonEvery s its pool swirls open for openTime s and calls
    // through either one rock golem (golemChance of the time) or three rock discs. It keeps at most summonMax of its
    // own alive and raises summonTotal in all (and shares the summon cap with every other summoner)
    ancientPortal: {
      hp: 320, speed: 0, radius: 20, damage: 0, contactDamage: 0,
      summonEvery: 7, openTime: 1.4, golemChance: 0.35, summonMax: 4, summonTotal: 9,
      knockbackResist: 1, stunResist: 1, heartChance: 0.2,
    },
    // stage 2+: Magic pillar: every enemy within wardRadius takes only wardCap damage from any hit until it's destroyed
    magicPillar: {
      hp: 260, speed: 0, radius: 15, damage: 0, contactDamage: 0,
      wardRadius: 180, wardCap: 1, knockbackResist: 1, stunResist: 1, heartChance: 0.15,
    },
    // stage 3: Ancient light: can't be hurt while its totem stands (it falls with it); charges a beam for chargeTime,
    // then blasts it for beamTime (damage per tick), turning slowly after you; then rests
    ancientLight: {
      hp: 300, speed: 46, radius: 14, damage: 8,
      preferredMin: 200, preferredMax: 340, chargeTime: 3, beamTime: 3, beamWidth: 20, beamTick: 0.15, beamTurn: 0.8, rest: 1.6,
      companions: [['lightTotem', 1]], knockbackResist: 0.6, stunResist: 0.5,
    },
    lightTotem: {
      hp: 240, speed: 0, radius: 14, damage: 0, contactDamage: 0, knockbackResist: 1, stunResist: 1, heartChance: 0.2,
    },
    // stage 3: Ancient rotator: two stone rings round it block blockChance of hits; it sends out one of its three
    // floating guns at a time: a laser from afar, or a rush in close for a shotgun blast of pellets
    ancientRotator: {
      hp: 440, speed: 46, radius: 17, damage: 14,
      preferredMin: 180, preferredMax: 320, blockChance: 0.2, gunEvery: 1.7,
      laserWindup: 0.9, laserDamage: 24, laserWidth: 10, rushSpeed: 330, pellets: 7, spreadDegrees: 50, pelletSpeed: 240,
      knockbackResist: 0.7, stunResist: 0.4, heartChance: 0.2,
    },
  },

  // ---------------------------------------------------------
  //  DUNGEON THEMES (dungeon runs)
  //  enemies: [type, weight] per stage; stage 2/3 lists include their exclusives.
  //  Every theme's boss appears in all three stages, scaled by CONFIG.run.stages.
  // ---------------------------------------------------------
  themes: {
    graveyard: {
      name: 'Graveyard',
      blurb: 'Restless dead, poison and bone. Ruled by the Phantom King, and something darker beneath.',
      // the floor is gloomy: night darkness (rgb tint, 0-1) that torches, lamps and candles cut through, and drifting fog
      night: { dark: 0.34, color: '6, 12, 22' },
      // the pieces its fight rooms' obstacle patterns are built from (Sprites.cover kinds; see ROOM_LAYOUTS)
      layout: { small: 'headstone', pillar: 'headstone', long: 'tomb', wallH: 'graveWallH', wallV: 'graveWallV', block: 'graveBlock' },
      boss: 'phantom',
      // a deeper boss met once a run, in stage 2 or 3 (lateChance of the time at stage 2, otherwise stage 3)
      lateBoss: { type: 'deathbringer', stages: [2, 3], lateChance: 0.5 },
      enemies: {
        1: [['zombie', 5], ['bletcher', 2], ['skeleton', 3], ['skeletonWarrior', 3], ['bomber', 2], ['wraith', 2],
            ['undeadKnight', 1], ['gravestone', 1], ['candlehead', 2], ['shadowalker', 1]],
        2: [['zombie', 4], ['bletcher', 2], ['skeleton', 3], ['skeletonWarrior', 3], ['bomber', 2], ['wraith', 2],
            ['undeadKnight', 1], ['gravestone', 1], ['candlehead', 2], ['shadowalker', 2],
            ['necromancer', 1], ['reaper', 1], ['minigunner', 1]],
        3: [['zombie', 3], ['bletcher', 2], ['skeleton', 3], ['skeletonWarrior', 3], ['bomber', 2], ['wraith', 2],
            ['undeadKnight', 1], ['gravestone', 1], ['candlehead', 2], ['shadowalker', 2],
            ['necromancer', 1], ['reaper', 1], ['minigunner', 1], ['zombieSoldier', 2], ['skeletonSorcerer', 1]],
      },
      // what tombstones raise in this theme
      summons: ['zombie', 'skeleton', 'skeletonWarrior', 'bletcher', 'bomber', 'candlehead'],
      // big, slow or summoning enemies: at most this many per wave
      heavy: { undeadKnight: 1, gravestone: 1, necromancer: 1, reaper: 1, minigunner: 1, skeletonSorcerer: 1 },
      // the banner as each stage begins
      stageLines: ['Clear the rooms and find the boss', 'The dead grow stronger', 'The dead grow stronger'],
    },
    castle: {
      name: 'Castle',
      blurb: 'A corrupted empire\'s fallen keep. Ruled by its royal family.',
      // a darker, colder gloom with a violet cast, and no fog or mist
      night: { dark: 0.24, color: '12, 6, 22' },
      fog: false,
      layout: { small: 'crates', pillar: 'pillar', long: 'statue', wallH: 'keepWallH', wallV: 'keepWallV', block: 'keepBlock' },
      // the boss of each stage: the Prince or the Princess, then the Queen, then the King
      stageBosses: { 1: ['prince', 'princess'], 2: ['queen'], 3: ['king'] },
      enemies: {
        1: [['squire', 5], ['castleArcher', 3], ['minstrel', 1], ['gunner', 2], ['catapult', 1], ['maceSpinner', 2],
            ['bishop', 1], ['castleKnight', 2], ['cavalry', 1], ['castleSorcerer', 1]],
        2: [['squire', 4], ['castleArcher', 3], ['minstrel', 1], ['gunner', 2], ['catapult', 1], ['maceSpinner', 2],
            ['bishop', 1], ['castleKnight', 2], ['cavalry', 1], ['castleSorcerer', 2],
            ['executioner', 1], ['jester', 2], ['flamingCatapult', 1], ['royalGuard', 1]],
        3: [['squire', 3], ['castleArcher', 3], ['minstrel', 1], ['gunner', 2], ['catapult', 1], ['maceSpinner', 2],
            ['bishop', 1], ['castleKnight', 2], ['cavalry', 1], ['castleSorcerer', 2],
            ['executioner', 1], ['jester', 2], ['flamingCatapult', 1], ['royalGuard', 2], ['general', 1], ['clusterCatapult', 1]],
      },
      summons: ['squire', 'castleArcher', 'castleKnight'],
      heavy: { catapult: 1, flamingCatapult: 1, clusterCatapult: 1, cavalry: 1, executioner: 1, bishop: 1, minstrel: 1, castleSorcerer: 1, general: 1, royalGuard: 2 },
      stageLines: ['Clear the rooms and find the throne', 'The fallen court stirs', 'The crown awaits'],
    },
    ruins: {
      name: 'Ancient Ruins',
      blurb: 'An overgrown temple of rock and clay. The magic lingering in the air wakes its stones to guard something.',
      // a soft green dusk with a teal cast; the lingering magic drifts in clouds (RuinsDecor), not fog
      night: { dark: 0.2, color: '6, 22, 20' },
      fog: false,
      layout: { small: 'ruinRocks', pillar: 'ruinPillar', long: 'ruinStatue', wallH: 'ruinWallH', wallV: 'ruinWallV', block: 'ruinBlock' },
      // each stage's boss: the Clay Golem or the Guardian (not the same one twice in a row)
      bosses: ['golem', 'guardian'],
      enemies: {
        1: [['rockmite', 4], ['rockDisc', 2], ['clayGuard', 3], ['claySlime', 2], ['clayBud', 3], ['rockShell', 1],
            ['rockBowler', 2], ['rockWizard', 2], ['ruinedTurret', 1], ['stonePillar', 1]],
        2: [['rockmite', 3], ['rockDisc', 2], ['clayGuard', 3], ['claySlime', 2], ['clayBud', 2], ['rockShell', 1],
            ['rockBowler', 2], ['rockWizard', 2], ['ruinedTurret', 1], ['stonePillar', 1],
            ['rockGolem', 1], ['ancientPortal', 1], ['magicPillar', 1]],
        3: [['rockmite', 3], ['rockDisc', 2], ['clayGuard', 3], ['claySlime', 2], ['clayBud', 2], ['rockShell', 1],
            ['rockBowler', 2], ['rockWizard', 2], ['ruinedTurret', 1], ['stonePillar', 2],
            ['rockGolem', 1], ['ancientPortal', 1], ['magicPillar', 1], ['ancientLight', 1], ['ancientRotator', 1]],
      },
      summons: ['rockmite', 'clayBud', 'clayGuard'],
      heavy: { rockShell: 1, ruinedTurret: 1, stonePillar: 2, rockGolem: 1, ancientPortal: 1, magicPillar: 1, ancientLight: 1, ancientRotator: 1 },
      stageLines: ['Clear the rooms and wake the guardian', 'The old stones stir', 'The magic grows restless'],
    },
  },

  // ---------------------------------------------------------
  //  DUNGEON RUNS: 3 stages, each a generated floor of rooms and hallways.
  // ---------------------------------------------------------
  run: {
    // enemy + boss scaling per stage. Later stages get deadlier enemies (more damage than hp, so fights
    // stay quick but dangerous, plus a little speed) rather than many more of them; the counts below only
    // creep up. Bosses get bossHp / bossDamage on top (by the later stages the heroes' upgrades make the fights easier)
    stages: [
      { hp: 1, damage: 1, speed: 1 },
      { hp: 1.35, damage: 1.45, speed: 1.06, bossHp: 1.15, bossDamage: 1.1 },
      { hp: 1.8, damage: 1.85, speed: 1.12, bossHp: 1.3, bossDamage: 1.2 },
    ],
    // random mode: chance weight of rolling a theme already used this run (vs 1 for a new one)
    repeatThemeWeight: 0.05,
    // floor layout: rooms sit in a grid of cells; hallways join neighbouring cells
    grid: { cols: 5, rows: 5, cellW: 38, cellH: 28, hall: 5 },   // hall: hallway width in tiles (odd)
    roomCount: [11, 12, 13],                      // per stage, including start and boss
    // room objectives
    combat: { waves: [2, 3, 3], perWave: [4, 5, 5], perWaveRandom: 1 },
    // anyone (hero, body, clone or enemy) outside a locked room is warped back in after this many seconds
    strayReturn: 2,
    defend: { duration: [30, 36, 42], totemHp: [650, 850, 1100], waveEvery: 8, perWave: [3, 4, 4] },
    // a defend-room kill frees a soul that flies into the lantern, mending soulHeal of its max hp
    // scaled by how tough the enemy was (base hp / soulRefHp, clamped to soulScale); summoned
    // enemies give summonedSoul of that. soulSpeed: how fast souls home in (px/s)
    defendSouls: { soulHeal: 0.025, soulRefHp: 150, soulScale: [0.5, 2.5], summonedSoul: 0.35, soulSpeed: 260 },
    // defend-room enemies chase the hero once within spotRange, and give up (back to the lantern) past loseRange
    defendAI: { spotRange: 230, loseRange: 380 },
    // coins: roughly one per hpPerCoin of an enemy's base hp (at least 1); summoned enemies drop 1 coin
    // summonedChance of the time; the boss drops boss[0]-boss[1]; every cleared room's chest holds roomChest
    coins: { hpPerCoin: 60, summonedChance: 0.3, boss: [25, 35], roomChest: 5 },
    bossHearts: 5,                                // hearts a stage boss drops when beaten
    // secret room: 3 chests, the party opens up to `picks` (then the rest seal shut); one is a mimic
    // that drops a super buff like any other; the others hold coins or potions (any kind)
    secret: { chests: 3, picks: 2, coins: [20, 35], potions: [2, 4] },
    // treasure room (a special room): each of its 3 chests holds coins (coins[0]-coins[1]) or, potionChance of the
    // time, potions[0]-potions[1] healing potions, mostly the small ones (healTierWeights: tier 1, 2, 3)
    treasure: { coins: [5, 35], potions: [2, 5], potionChance: 0.5, healTierWeights: [6, 3, 1] },
    // wishing well: each coin tossed in has `chance` to grant a wish (guaranteed on the pity-th coin);
    // a wish is one random kind of potion, potions[0]-potions[1] of it, weighted by tier (tierWeights: tier 1, 2, 3)
    // (or, upgradeChance of the time, a random upgrade). One wish per hero per well
    well: { chance: 0.15, pity: 12, potions: [2, 6], tierWeights: [6, 3, 1], upgradeChance: 0.1 },
    // puzzle room (Simon's stone): it lights a pattern of its four colours, `show`s each with a `gap` between,
    // and the heroes step on the matching floor plates in order. lengths: the pattern's length for each round;
    // `wins` right answers give every hero a free random upgrade. `strikes` mistakes and the stone blinks red
    // for `fuse` seconds, then blows up the whole room for blastDamage, leaving it burning (fire: each patch's
    // radius, how long it burns, and the burn it sets on whoever stands in it)
    puzzle: { lengths: [4, 5, 6], wins: 3, strikes: 3, show: 0.5, gap: 0.2, fuse: 3, blastDamage: 180,
              fire: { radius: 52, life: 12, burnDps: 30, burnTime: 2 } },
    // shop: potion prices are multiplied by stagePrice[stage - 1], so shops further in cost more.
    // Upgrades: three on offer at a time, buy as many as you can; the first costs upgrade.base and each
    // one bought adds upgrade.step for the rest of the run. Rerolling the three costs reroll.base, + reroll.step
    // more each time, back to reroll.base at the next stage's shop. (Stage 1 also starts with a free pick of three.)
    // Sell stall (Tobin): an upgrade sells back for sell.upgrade coins (it doesn't lower the next upgrade's price),
    // a potion for sell.potion of its base price (at least 1).
    shop: { stagePrice: [1, 1.4, 1.8], upgrade: { base: 30, step: 10 }, reroll: { base: 10, step: 5 }, sell: { upgrade: 10, potion: 0.4 } },
    survival: { duration: [30, 40, 50], spawnEvery: [1.3, 1.2, 1.1], perSpawn: 2, maxAlive: [12, 13, 14] },
    // the rooms whose obstacles are laid out in a pattern (DungeonRun.addLayout); they block heroes, enemies and shots alike
    cover: { rooms: ['combat', 'survival'] },
    // spike traps (combat rooms only): pop up every `period` seconds for `up` seconds
    // they come in square pads (2x2, or 4x4 bigChance of the time), pads[0]-pads[1] per combat room;
    // a pad's spikes peek out (warn) then shoot up together
    spikes: { period: 4, up: 0.8, warn: 0.6, damage: 16, pads: [2, 4], bigChance: 0.3 },
    // barrels (every dungeon theme): perRoom[0]-perRoom[1] of them stand about each of the `rooms`, each one of `kinds`
    // at random. Heroes' attacks burst them (hp), and a burst sets off any other barrel within its radius.
    //   explosive: a blast (damage to heroes, enemyDamage to enemies and bosses) that sets everyone in it on fire
    //   poison: a cloud that hangs for cloudTime; heroes in it are poisoned for dps per second over `time` seconds,
    //           enemies take enemyDps over the same time
    //   frost: freezes everyone in it for `freeze` seconds and leaves an ice patch (iceRadius, lasting iceTime)
    //          that freezes again for `refreeze` seconds whoever steps onto it
    barrels: {
      rooms: ['combat', 'survival', 'defend'], perRoom: [2, 4], hp: 20, kinds: ['explosive', 'poison', 'frost'],
      explosive: { radius: 85, damage: 40, enemyDamage: 90, burnDps: 12, burnTime: 4 },
      poison: { radius: 80, cloudTime: 4, dps: 5, time: 8, enemyDps: 15 },
      frost: { radius: 75, damage: 10, enemyDamage: 25, freeze: 1.5, iceRadius: 70, iceTime: 8, refreeze: 1.2 },
    },
    // special rooms (one or two per floor); the hero statue and the restaurant aren't in yet
    specials: ['blacksmith', 'wishingWell', 'heroStatue', 'restaurant5', 'mountTrader', 'darkTrader',
               'friendlyTrader', 'treasure', 'helper'],
    // Every special room price below is in coins, x the stage's shop price (shop.stagePrice) and Discount Cards.
    // dark trader: give up `hp` health (never your last of it) for a gift: an upgrade upgradeChance of the time
    // (a dark one, only he has, darkChance of those while any are left), otherwise potions[0]-potions[1] of one kind
    darkTrader: { hp: 25, upgradeChance: 0.6, darkChance: 0.45, potions: [1, 3], tierWeights: [5, 3, 2] },
    // friendly trader: once per hero per room, `count` random upgrades the hero owns for `count` others
    friendlyTrader: { count: 2 },
    // blacksmith: each forge costs `price`; the rarity is rolled from `rarity` weights (see FORGE_RARITIES)
    blacksmith: { price: 35, rarity: { rare: 50, epic: 30, legendary: 15, mythical: 5 } },
    // mount trader's horse: moves the rider speed x faster, takes the rider's hits on its own hp, rests at 0
    // and gets `stageHeal` back at every new stage. No ultimates while riding; in a locked room you can get
    // off but not back on.
    mount: { price: 45, hp: 50, speed: 1.4, stageHeal: 30 },
    // helper room: one hireling (a random kind) that follows its hero until it falls (see js/entities/allies.js).
    // Like pets, enemy bodies don't hurt them (only enemy attacks do).
    helpers: {
      knight: { name: 'Hired Knight', price: 30, hp: 260, speed: 175, damage: 26, every: 0.85, reach: 40, arc: 110,
                block: 0.7, blockEvery: 3.5, blockTime: 1.4, color: '#8ab8ff' },
      archer: { name: 'Hired Archer', price: 30, hp: 150, speed: 185, damage: 22, every: 1.1, range: 300, arrowSpeed: 560, color: '#8cff9a' },
      // the priest heals every hero within healRange for `heal` every healEvery s; his two acolytes shoot light beams
      priest: { name: 'Hired Priest', price: 45, hp: 220, speed: 165, heal: 40, healEvery: 10, healRange: 260, color: '#fff2a0',
                acolyte: { hp: 60, speed: 190, damage: 16, every: 1.1, range: 260 } },
      leash: 320,         // how far from their hero they go after enemies
      regen: 0.03,        // share of max hp healed per second after regenDelay s without a hit
      regenDelay: 5,
      stageDamage: 0.3,   // their hits grow by this much per stage after the first
    },
  },

  // ---------------------------------------------------------
  //  MULTIPLAYER (host + up to 7 friends, peer to peer)
  // ---------------------------------------------------------
  multiplayer: {
    maxPlayers: 8,
    maxDuplicates: 2,          // at most this many of the same hero in one lobby
    // enemies scale with the party: each extra hero adds this much enemy hp / damage / this many more enemies
    hpPerExtraPlayer: 0.55,   // tougher enemies rather than many more: 8 heroes = x4.85 hp, x1.42 damage, only x1.84 enemies
    damagePerExtraPlayer: 0.06,
    countPerExtraPlayer: 0.12,
    // a downed hero is picked up by a teammate holding interact by their body for `time` seconds
    revive: { time: 4, range: 40, hp: 0.35, decay: 2 },   // hp: share of max hp back; decay: progress lost per second once let go
    tickRate: 60,              // simulation steps per second (everyone steps in lockstep)
    codeLength: 5,             // room code letters
    peerPrefix: 'dungeonrun-v1-',   // room code -> PeerJS id (bump to keep old versions out)
    checksumEvery: 120,        // ticks between desync checks
    joinTimeout: 25,           // seconds before giving up on reaching a room (relayed connections are slower)
    // How browsers find a route to each other. STUN works on most home wifi; mobile data and
    // many ISPs (carrier NAT - common in Indonesia, the Philippines, India...) block direct
    // connections, so traffic has to go through a TURN relay. There are no free public TURN
    // relays left (PeerJS's and Metered's Open Relay both shut down), so set turnCredentialsUrl.
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    // A URL that returns TURN relay servers as JSON (an array of { urls, username, credential }),
    // e.g. a free Metered account's credentials URL (metered.ca -> TURN Server -> your app):
    //   https://<your-app>.metered.live/api/v1/turn/credentials?apiKey=<key>
    // Fetched before connecting. Without it, players behind carrier NAT can't connect.
    turnCredentialsUrl: 'https://dungeonrun.metered.live/api/v1/turn/credentials?apiKey=8910fa17010905c429c36ee1e467fcd9a2e5',
    turnFetchTimeout: 5,       // seconds to wait for turnCredentialsUrl before connecting without it
  },

  // mana orbs only drop for mana users; picking one up triggers the Mage's Mana Surge passive
  drops: { heartChance: 0.05, heartHeal: 45, manaChance: 0.45, manaRestore: 15, coinMagnet: 220 },   // coinMagnet: how far coins fly to you from (px)

  // super buff orbs dropped by mimics (one random type each). They're counted in rooms, not seconds: each
  // starts at `stacks` and loses one every time a room is cleared; picking one up again refills it
  buffs: {
    regen:  { name: 'SUPER REGEN', stacks: 3, perSecond: 0.02, color: '#6cff7a' },  // 2% max hp/s, even while hit
    speed:  { name: 'SUPER SPEED', stacks: 3, multiplier: 1.35, color: '#ffd34a' }, // +35% move speed
    damage: { name: 'SUPER POWER', stacks: 3, multiplier: 1.35, color: '#ff5a4a' }, // +35% damage, stacks with passives
    sugar:  { name: 'SUGAR', duration: 5, speed: 1.25, attackSpeed: 1.3, color: '#ff8ad0' },  // the Baker's pastries: faster feet and hands
  },

  // ---------------------------------------------------------
  //  WAVES (spawned in order, then a random boss appears)
  // ---------------------------------------------------------
  waves: [
    // gravestones keep raising enemies until broken and mimics are tough, so waves with them have fewer of the rest
    { zombie: 6, slime: 1 },
    { zombie: 4, skeleton: 3, wraith: 2, gravestone: 1 },
    { slime: 2, wraith: 3, skeleton: 2, undeadKnight: 1, gravestone: 1, mimic: 1 },
    { zombie: 3, skeleton: 4, wraith: 3, undeadKnight: 2, gravestone: 2, mimic: 1 },
    { zombie: 3, slime: 2, skeleton: 4, wraith: 4, undeadKnight: 2, gravestone: 2, mimic: 2 },
  ],
  // each wave after the first adds this much enemy hp / damage (wave 5: +60% hp, +32% damage)
  waveScaling: { hp: 0.15, damage: 0.08 },
  // debuffs on bosses (they ignore plain stuns): a freeze locks a boss in ice for freezeTime x the freeze's
  // length (it can't move or attack), after which it can't be frozen again for freezeImmune seconds
  // zapImmune: after a Zap (Tesla Armour) wears off, a boss can't be zapped again for this many seconds
  bossDebuffs: { freezeTime: 1, freezeImmune: 4, zapImmune: 3 },
  // a boss's entrance cutscene: the camera pans over (pan s), its entrance plays, then its title card (card s)
  bossIntro: { pan: 0.9, card: 2.8 },
  // chance of each boss appearing after the last wave
  bosses: { golem: 0.5, phantom: 0.5 },
  waveBreak: 3,           // pause between waves
  spawnInterval: 0.35,    // stagger between spawns in a wave
  spawnTelegraph: 0.9,    // summoning circle time before an enemy appears
  bossHealPercent: 0.4,   // heal before the boss fight

  // ---------------------------------------------------------
  //  BOSS: CLAY GOLEM
  // ---------------------------------------------------------
  golem: {
    headHp: 1500,
    fistHp: 750,
    bodyHp: 3600,          // the rolling phase (below rollBelow) gets 900 of this
    bodyContactDamage: 30,

    // Clay minions summoned around the golem
    minionInterval: 12,
    minionCount: 2,
    minionMax: 6,

    // Phase 1 head: bouncing fireballs
    headFireInterval: 3.0,
    headFireWindup: 0.75,
    headFireballs: 3,
    headFireSpreadDegrees: 28,

    fireball: { damage: 28, speed: 240, bounces: 3, life: 7, radius: 9 },

    // Fists (Terraria-style rocket punches)
    fistInterval: 2.0,
    fistWindup: 0.7,
    fistAimLockAt: 0.3,    // seconds before launch the aim stops tracking
    fistSpeed: 760,
    fistRetractSpeed: 380,
    fistRange: 430,
    fistDamage: 40,

    // Phase 2 head: lasers + fireball bursts.
    // The laser tracks the hero, then locks and charges for laserAimLockAt seconds before firing.
    laserInterval: 1.6,
    laserWindup: 1.0,
    laserAimLockAt: 0.5,
    laserDuration: 0.18,
    laserDamage: 22,
    laserWidth: 14,
    burstInterval: 9,
    burstWindup: 1.3,
    burstCount: 16,
    burstFireball: { damage: 24, speed: 210, bounces: 2, life: 6, radius: 9 },

    // Fists destroyed: walking + stomping
    walkSpeed: 45,
    stompInterval: 1.8,
    stompWindup: 0.45,
    shockwaveRadius: 280,
    shockwaveSpeed: 330,
    slowAmount: 0.5,       // movement multiplier while slowed
    slowDuration: 2.0,
    rollBelow: 0.25,       // rolls once the body drops below this fraction of its hp (never before)

    // Rolling
    rollWindup: 1.0,
    rollAimLockAt: 0.3,
    rollSpeed: 470,
    rollMaxTime: 2.6,
    rollDamage: 50,
    rollsBeforeRest: 3,
    rollRest: 2.4,
    rollStun: 0.6,
  },

  // ---------------------------------------------------------
  //  BOSS: PHANTOM KING
  //  Phase 1: floats, dashes, fires slow eye lasers.
  //  Phase 2 (below phase2At hp): vanishes, reappears near the hero
  //    and pulses shockwaves that pull the hero in, spraying lasers.
  //  Phase 3 (below phase3At hp): both move sets, faster.
  //  Per-phase values are [phase 1, phase 2, phase 3].
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  //  THE GUARDIAN (the Ancient Ruins' other boss, any stage): a floating figure of rock bound by
  //  magic crystals. It drifts round the room, over every obstacle, and takes turns between its
  //  chest beam and a chain of ground slams. Below phase2At it slams more, with bigger spikes, its beam
  //  smashes through obstacles instead of being stopped by them, and its broken crystals reform.
  // ---------------------------------------------------------
  guardian: {
    hp: 6400,
    phase2At: 0.5,
    contactDamage: 18,
    contactRadius: 26,     // touching its shadow hurts within this distance
    floatSpeed: 110,       // how fast it drifts after its spot near the hero
    orbitRadius: 240,      // how far from the hero it hangs
    hover: 34,             // how high it floats over the ground
    // seconds spent floating between attacks [phase 1, phase 2]; the attacks take turns: beam, slams, beam...
    attackInterval: [2.4, 1.8],

    // The beam: first a ring of magic bursts out of it - its area glows on the floor for `windup` s first -
    // and sweeps out to `radius` at `speed` px/s: no damage, but every hero it passes is slowed for `slow` s.
    // Then the chest charges for `charge` s (aiming, locking on lockAt s before it fires), then blasts the
    // beam for `time` s, turning after the hero at most turn rad/s [phase 1, phase 2], `width` px wide
    // [phase 1, phase 2]. Heroes in it take `damage` every `tick` s (`damage2` in phase 2: kept as its own number,
    // not a pair, so the stage scaling reaches it). In phase 1 any obstacle stops it;
    // in phase 2 it smashes through them (only the walls stop it).
    shockwave: { windup: 0.9, radius: 340, speed: 280, band: 26, slow: 2.5 },
    beam: { charge: 3, lockAt: 0.5, time: 3.2, turn: [0.45, 0.45], width: [34, 50], damage: 32, damage2: 58, tick: 0.3, length: 1100 },

    // Ground slams: `count` in a row [phase 1, phase 2], `every` s apart, each raising its arms for `windup` s.
    // Odd slams (1st, 3rd...) aim at where the hero is; every 2nd at where they're going (`lead` px ahead of
    // them). The ground glows for spikeDelay s, then massive rock spikes blast up over spikeRadius and stand
    // for spikeTime s (they hurt once, as they erupt). In phase 2 the spikes (and their area) are phase2Size x bigger
    slams: { count: [4, 6], every: 0.95, windup: 0.45, lead: 120, spikeDelay: 0.8, spikeRadius: 76, spikeTime: 1.1, damage: 34, phase2Size: 1.35 },

    // The power crystals round its room feed it: each one still standing heals it `heal` hp a second
    // (both phases). Heroes can break them (`hp` each). In phase 2 a broken one reforms out of the magic, once
    // only, over `reform` s (healing it again once whole); broken a second time, it's gone for good
    crystals: { hp: 500, heal: 14, reform: 9 },
  },

  phantom: {
    hp: 7000,              // phase 3 (below phase3At) gets 1800 of this
    phase2At: 0.6,
    phase3At: 0.3,
    contactDamage: 22,
    floatSpeed: 170,       // how fast he chases his spot near the hero
    orbitRadius: 180,      // how close he circles the hero

    // time spent floating between big attacks. Attacks take turns:
    //   phase 1: dash, barrage   phase 2: vanish, barrage   phase 3: dash, vanish, barrage
    attackInterval: [2.0, 1.8, 1.4],

    // Laser barrage: stops, charges, then fires fans of slow lasers at the hero
    // (every other fan is offset so the gaps move)
    barrageWindup: 0.6,
    barrageTime: [3.2, 2.6, 2.6],
    barrageEvery: [0.45, 0.45, 0.38],
    barrageFan: [5, 5, 7],
    barrageSpreadDegrees: 60,

    // Dash
    dashWindup: 0.7,
    dashAimLockAt: 0.3,
    dashSpeeds: [780, 980, 1280],  // 1st, 2nd, 3rd dash of a chain: each one faster than the last
    dashRange: 560,
    dashOvershoot: 160,     // the dash carries on this far past the hero
    dashDamage: 40,
    dashWidth: 84,          // hit lane, same width as the red telegraph on the ground
    contactRadius: 28,      // touching his shadow hurts within this distance (dashes use the lane above)
    dashRecover: 0.5,
    dashCycle: [1, 2, 3],          // dashes per dash attack, repeating 1, 2, 3, 1, 2, 3...

    // Slow eye lasers, aimed at the hero while floating
    eyeInterval: [1.2, 1.6, 1.6],
    eyeWindup: 0.45,
    eyeLaser: { damage: 19, speed: 200, life: 7, radius: 6 },   // damage scaled down with the extra speed
    eyeSpreadDegrees: 14,
    // phase 3: instead of charged volleys, a steady stream while floating
    eyeStreamEvery: 0.38,
    eyeStreamJitterDegrees: 6,

    // Vanish, then reappear near the hero
    vanishTime: 0.45,
    hiddenTime: 0.55,
    appearTime: 0.7,        // telegraph ring at the destination
    appearNova: { count: 16, delay: 0.6 },   // on reappearing: a ring of count eye lasers (4 more in phase 3), then delay s before the pull
    appearDistance: [130, 180],

    // Pull shockwaves after reappearing
    pulseCount: 4,
    pulseInterval: 0.7,
    pulseSpeed: 300,        // rings start at pulseRadius and close in on the king
    pulseRadius: 420,
    pullSpeed: 100,         // steady drag toward the king while pulsing (px/s)
    pullSurge: 420,         // extra drag added when a ring sweeps over the hero...
    pullSurgeDecay: 3,      // ...fading out at this rate (per second)
    pulseLaserEvery: 0.08,  // seconds between random lasers sprayed in every direction
  },

  // ---------------------------------------------------------
  //  BOSS: THE PRINCE (castle stage 1, the training grounds)
  //  He rides in on his horse and leaps down to fight. Every attack is the same pattern:
  //  he runs you down, dashes in (a medium-range dash down a red lane), then lays into
  //  you with a flurry of cuts and long-reaching stabs, stepping in with each blow (every
  //  stab is called out by a red lane first). At
  //  phase2At he sounds his trumpet: two royal guards and his own bodyguard
  //  march in, and he sets his blade alight: every cut and stab flings embers (flame) that
  //  set you burning. He keeps the same pace in both phases. While his bodyguard stands, a
  //  ribbon of light joins them and the Prince can't be hurt: kill the guard first.
  // ---------------------------------------------------------
  princeBoss: {
    hp: 4600,
    phase2At: 0.45,
    contactDamage: 14,
    speed: 195,
    dashRange: 270,              // he dashes when you're within this
    dash: { windup: 0.36, distance: 205, time: 0.18, width: 52, damage: 24 },
    // the flurry straight after every dash: wide cuts and stabs in `pattern` order, `gap` s apart. Each blow
    // steps him `step` px toward you. A stab is a long thrust (`stabRange` px, `stabWidth` wide) shown by a red
    // lane for `stabWindup` s before it lands
    combo: { reach: 90, arcDegrees: 145, gap: 0.2, damage: 24, step: 14,
      stabRange: 188, stabWidth: 34, stabWindup: 0.38, stabStep: 34, stabDamage: 30,
      pattern: ['cut', 'cut', 'cut', 'stab', 'cut'] },
    recovery: 1.8,               // after every dash and flurry he stops to catch his breath (open to hits)
    cooldown: 1.6,               // then this long on his feet before he can dash again
    trumpet: { time: 1.4, guards: 2 },
    // phase 2, the burning blade: each cut flings slashEmbers embers across its arc, the stab stabEmbers down its
    // line; each ember does `damage` and sets whoever it hits burning (burnDps for burnTime s)
    flame: { slashEmbers: 5, stabEmbers: 3, speed: 240, life: 0.7, damage: 6, burnDps: 6, burnTime: 2.5 },
  },

  // ---------------------------------------------------------
  //  BOSS: THE PRINCESS (castle stage 1, her magic study)
  //  Disturbed at her books she flies into a rage, opening with a potion. She keeps her
  //  distance and takes turns: a rapid burst of crossbow bolts, three great golden arrows
  //  that follow you for a few seconds, an ice potion (it chips, freezes for a moment and
  //  leaves slowing ice) and a fire potion (it bursts into bouncing fireballs and leaves
  //  burning ground). When someone gets close she blinks away, still nearby (once every
  //  blink.cooldown s).
  //  Phase 2 (phase2At): she flings her crossbow away and conjures a magic bow, and the
  //  study comes alive with magic: furniture floats, and things fly slowly across the room
  //  (they hurt to touch). Her attacks: a volley of heat-seeking golden arrows that spit
  //  little bolts out to either side as they fly, a giant golden arrow shot into the sky
  //  that falls on you, and potions three at a time (less often).
  // ---------------------------------------------------------
  princessBoss: {
    hp: 4100,
    phase2At: 0.5,
    contactDamage: 12,
    speed: 96,
    keepAway: [190, 320],
    attackInterval: [1.0, 1.4],  // rest between attacks [phase 1, phase 2]
    burst: { windup: 0.5, count: 20, every: 0.07, speed: 480, damage: 14 },
    icePotion: { windup: 0.4, flight: 0.85, radius: 76, damage: 12, freeze: 0.7, slow: 0.5, zoneTime: 4 },
    firePotion: { windup: 0.4, flight: 0.85, radius: 70, damage: 22, fireballs: 8, fireballSpeed: 200, bounces: 2, fireballDamage: 14,
      fireRadius: 70, fireTime: 4, burnDps: 8, burnTime: 2 },
    blink: { cooldown: 15, trigger: 80, distance: [170, 230] },
    transform: 1.6,              // phase 2 begins: throwing the crossbow away and calling the magic bow (she can't be hurt)
    // phase 2: `count` golden arrows fanned out, each weaving side to side (waveAmp px either way, waveFreq waves a
    // second) as it flies straight on, firing a little bolt out of each side every sideEvery s
    volley: { windup: 0.8, count: 5, spreadDegrees: 80, speed: 200, waveAmp: 12, waveFreq: 0.9, life: 3.5, damage: 22,
      sideEvery: 0.4, sideSpeed: 150, sideDamage: 18 },
    // phase 2: an arrow loosed straight up; a mark follows you for `track` s, then locks, and `fall` s later the giant
    // arrow lands there (everyone within `radius` takes `damage`)
    sky: { windup: 0.6, track: 1.1, fall: 0.8, radius: 135, damage: 70 },
    // phase 2: potions thrown `count` at a time, a mix of ice and fire, landing up to `spread` px round you
    potions: { count: 3, spread: 90, gap: 0.15 },
    // phase 2: things flying slowly across the study: one every `every` s (at most `max` at once), `damage` to touch
    flyers: { every: 2.2, max: 4, speed: [70, 100], damage: 16, radius: 18 },
  },

  // ---------------------------------------------------------
  //  BOSS: THE DEATHBRINGER (graveyard, stage 2 or 3)
  //  A faceless reaper of pure darkness with two scythes and eight tendrils on its back.
  //  It rises through a dark portal in the middle of its room, and teleports to a random
  //  spot in the room every `teleportEvery`s.
  //  Phase 1: scythe slashes (each throws waves of darkness across the whole room) and
  //    tendrils: two sink into the ground and two rise somewhere in the room; each slams
  //    the ground now and then, throwing out small waves of darkness. Killing a tendril
  //    sends it back to him; he can have all 8 out at once.
  //  Phase 2 (phase2At): darkness covers the room (only a little light round each hero),
  //    and his scythes become double-ended, forked at both ends, spinning in the air by
  //    themselves. He hurls shadow bombs that explode over an area, and when a hero comes
  //    close he whirls the scythes round himself.
  //  He chases the heroes between attacks (glideSpeed, faster in phase 2), and a severed
  //    tendril stops him sending more out for tendrils.respawnDelay seconds.
  //  Phase 3 (phase3At): he vanishes and comes back as a shade, his scythes whirling round
  //    him extremely fast (orbit.shadeSpin), and hunts the heroes down faster still.
  // ---------------------------------------------------------
  deathbringer: {
    hp: 6800,
    phase2At: 0.5,
    phase3At: 0.1,
    glideSpeed: [115, 145],  // chasing the hero between attacks, phase 1 / 2 (keeps about keepAway px off)
    keepAway: 150,
    contactDamage: 24,
    contactRadius: 40,
    attackInterval: [2.2, 1.9],
    teleportEvery: 7,        // he blinks somewhere else in the room this often
    teleportFade: 0.35,      // seconds fading out, and again fading back in
    // scythe slashes: `count` alternating swings; each cuts in front of him (reach, arc) and
    // throws a fan of `waves` big waves of darkness that fly the length of the room
    slash: { windup: 0.55, count: 1, every: 0.42, reach: 150, arcDegrees: 150, damage: 34, knockback: 220,
             waves: 3, waveSpreadDegrees: 34, waveSpeed: 250, waveDamage: 24, waveScale: 2.2, waveLife: 6 },
    // tendrils: `perCast` sink in and rise round the room (up to `max` out); each has `hp` and
    // slams every `slamEvery`s (windup first): a shockwave and `waves` small waves of darkness.
    // Killing one stops it sending any more out for `respawnDelay`s (it slashes / bombs instead)
    tendrils: { perCast: 2, max: 8, hp: 140, respawnDelay: 15, sinkTime: 0.6, riseTime: 0.7, slamEvery: [3.6, 4.4], slamWindup: 0.7,
                slamDamage: 28, slamRadius: 60, waves: 10, waveSpeed: 190, waveDamage: 16, waveLife: 2.6,
                shockwave: { radius: 140, speed: 220, width: 12, damage: 18 } },
    // phase 2: darkness gathers in his hands and he hurls `count` shadow bombs near the heroes;
    // each lands after `flight`s, swells for `fuse`s (its blast area marked), then explodes: damage in `radius`
    bombs: { windup: 0.7, count: 5, spread: 300, flight: 0.6, fuse: 1.0, radius: 90, damage: 42 },
    // phase 2: the double scythes circle him all the time (radius px out, spinning as they go), turning
    // `spin` rad/s, or `fastSpin` while a hero is within `trigger` px (closer than he likes to keep, see
    // keepAway); touching one hurts
    // phase 3 (shadeSpin): they whirl round him extremely fast all the time
    orbit: { trigger: 150, radius: 100, spin: 1.4, fastSpin: 4.2, shadeSpin: 13, hitRadius: 28, damage: 26 },
    // phase 2: every `every`s one of the scythes (taking turns) glows for `charge`s and looses a big wave of darkness at the hero
    scytheWave: { every: 5, charge: 0.6, speed: 230, damage: 30, scale: 3.2, radius: 36, life: 6 },
    darkness: 0.94,          // phase 2 on: how dark the room gets
    // phase 3: he vanishes and comes back as a shade, his scythes whirling round him, and chases the heroes down
    shade: { vanish: 0.8, speed: 235, contactDamage: 34 },
  },

  // ---------------------------------------------------------
  //  BOSS: THE QUEEN (the castle's garden)
  //  She floats down under her magic umbrella, which is always open, twirling with a
  //  magic aura. Phase 1 (the hedges stand in a fixed pattern): she walks toward you
  //  and takes turns between throwing her umbrella (it flies at you, stops and spins
  //  spraying magic, clockwise one time and anticlockwise the next, is steered after
  //  you, and at last flies home) and fans of homing bolts. The umbrella can't pass
  //  through hedges: it bounces off them. At phase2At she rings the garden bell: from
  //  then on she runs after you, the hedges change pattern now and then, and her one
  //  attack is the blink: she throws her umbrella, it flies after you shooting bolts
  //  out of its sides, then she blinks to it, a shockwave bursts where she lands and
  //  a ring of bolts follows. Hit her while it's in hand and she holds it out in
  //  front of her: every hit on it heals her instead. Each time the bell tolls her
  //  gardeners come through the rose gates.
  //  Per-phase values are [phase 1, phase 2].
  // ---------------------------------------------------------
  queen: {
    hp: 6200,
    phase2At: 0.5,
    contactDamage: 18,
    speed: [72, 150],
    keepAway: [150, 40],         // she closes in to about this far from her target
    attackInterval: [1.3, 1.2],  // rest between attacks
    // phase 1: homing bolts, `waves` fans of perWave bolts that chase the nearest hero for `chase` seconds
    homing: { windup: 0.55, waves: 3, perWave: 5, waveEvery: 0.6, spreadDegrees: 70, speed: 220, turn: 2.4, chase: 2.5, life: 5, damage: 22 },
    // the thrown umbrella: each leg it flies `leg` s at `speed`, steering after the hero (`steer` rad/s), then
    // stops and spins for `spin` s, firing `shots` rings of `arms` bolts that turn `turn` rad per shot.
    // After `stops` stops it flies home. It hurts to touch while it flies.
    umbrella: { windup: 0.5, speed: 300, steer: 3, leg: 0.85, stops: 3, spin: 1.2, shots: 5, arms: 5, turn: 0.3,
      boltSpeed: 170, boltDamage: 18, radius: 20, damage: 20, back: 520 },
    // phase 2: the umbrella flies after the hero for `leg` s, firing a bolt out of each side every sideEvery s;
    // then the blink is telegraphed for `warn` s; where she lands a shockwave bursts and `rings` rings of
    // `count` bolts follow, `ringGap` s apart
    blink: { leg: 1.6, speed: 230, steer: 1.1, sideEvery: 0.16, sideSpeed: 170, sideDamage: 16,
      warn: 0.85, radius: 280, speed2: 360, width: 18, damage: 28,
      rings: 1, count: 14, ringGap: 0.3, ringSpeed: 190, ringDamage: 18 },
    // phase 2: hit while her umbrella is in hand, she holds it out in front (windup s) and for `time` s every
    // hit on it heals her by healRatio of the damage instead of hurting her
    parasol: { windup: 0.3, time: 1.8, healRatio: 1, cooldown: 8 },
    bell: { rings: 3, ringEvery: 0.55 },
    // hedges: fixed layouts that take `sprout` s to grow; in phase 2 a new layout grows every `shuffle` s
    hedges: { sprout: 0.9, shuffle: 10 },
    // phase 2: the bell tolls by itself every `every` s (first after `first`), and perWave gardeners come in
    gardeners: { every: 16, first: 7, perWave: 2, max: 3 },
  },

  // ---------------------------------------------------------
  //  BOSS: THE KING (the castle's throne room)
  //  Phase 1: sits on his throne and slams his scepter down, each slam a fan-shaped
  //  shockwave that rolls across the whole room, and shouts for a royal guard through
  //  one of the two doors (one per call, up to guards.max at once); every few attacks
  //  he throws his scepter into the path you'd run from the guards, where it spins for
  //  a while before it flies back (no slams while it's gone). What he shouts is shown
  //  in a speech bubble, pinned to the screen's edge when he's out of view.
  //  Phase 2 (phase2At): slams the scepter (a shockwave round the whole room), calls
  //  four bishops who heal him, and takes up his greatsword: from then on he waddles
  //  after you with scepter slams, huge greatsword sweeps and waves of light that stun.
  // ---------------------------------------------------------
  king: {
    hp: 8200,
    phase2At: 0.5,
    contactDamage: 20,
    shout: { every: 2.3, windup: 0.6, arcDegrees: 70, speed: 380, width: 26, damage: 24, knockback: 260 },
    guards: { max: 6, respawnDelay: 5 },   // each call brings one guard, up to max at once; none for respawnDelay s after one dies
    throwEvery: 3,               // every throwEvery-th attack is a scepter throw
    // the throw lands `lead` px ahead of the hero, on the side away from the nearest guard
    scepter: { windup: 0.6, speed: 470, spin: 4, radius: 50, tick: 0.35, damage: 16, rest: 0.8, back: 520, lead: 120 },
    // every one of his shockwaves rolls on until it has crossed the whole room
    slamWave: { speed: 430, width: 22, damage: 30 },
    bishops: 4,
    walkSpeed: 40,
    attackInterval: 1.1,
    slam: { windup: 0.75, speed: 360, width: 18, damage: 30 },
    sword: { windup: 1.1, arcDegrees: 150, reach: 270, damage: 55 },
    light: { windup: 0.9, rings: 2, count: 18, ringGap: 0.35, speed: 210, damage: 12, stun: 3 },
  },
};

// graveyard and castle enemies are ordinary enemies too (CONFIG.enemies[type] is what they read)
Object.assign(CONFIG.enemies, CONFIG.graveyardEnemies);
Object.assign(CONFIG.enemies, CONFIG.castleEnemies);
