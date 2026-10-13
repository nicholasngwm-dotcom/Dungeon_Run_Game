// =============================================================
//  GAME BALANCE & SETTINGS
//  Every tunable number lives here. Times are in seconds,
//  speeds in pixels/second, distances in pixels.
// =============================================================

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
    dodge: { distance: 125, duration: 0.22, invulnerability: 0.3, cooldown: 1.4 },
    // Enemies further than this can't see an invisible hero
    invisibleDetectRange: 200,
    // passive regen: after `delay` seconds without losing hp, heal `perSecond` (fraction of max hp)
    regen: { delay: 4, perSecond: 0.015 },
  },

  // ---------------------------------------------------------
  //  HERO CLASSES
  //  ult.charge = damage the hero must deal to fill the Q ultimate
  // ---------------------------------------------------------
  classes: {
    warrior: {
      // passive: after taking `hits` hits, the next one is blocked automatically
      passive: { name: 'Tanker', hits: 4 },
      name: 'Warrior',
      hp: 300,
      speed: 150,
      // LMB: slash, slash, stab
      combo:  { damage: 26, cooldown: 0.34, resetTime: 0.9, range: 82, arcDegrees: 130, knockback: 180,
                stabDamage: 50, stabCooldown: 0.6, stabRange: 125, stabWidth: 40, stabLunge: 36, stabKnockback: 340 },
      // RMB (hold): raise a directional barrier shield that soaks hits from the front.
      // Regens after `regenDelay` once lowered; if broken, it's down for `breakCooldown`.
      shield: { hp: 400, regen: 80, regenDelay: 1.2, breakCooldown: 5, arcDegrees: 130,
                radius: 30, moveMultiplier: 0.55, guardTime: 0.2 },
      // E: spin attack, moving faster while spinning
      spin:   { damage: 15, tick: 0.22, duration: 2.5, radius: 88, knockback: 90, moveMultiplier: 1.35, cooldown: 9 },
      // F: wind up, then charge through enemies, stunning them
      charge: { windup: 0.5, distance: 330, time: 0.35, width: 44, damage: 35, stun: 1.0, knockback: 260, cooldown: 10 },
      // Q: power up, then a huge downward strike along the aim line.
      // LMB releases it early; damage scales from minPower up to full.
      ult:    { charge: 1400, powerTime: 3, moveMultiplier: 0.3, damage: 300, minPower: 0.35, length: 360, width: 84 },
    },
    ranger: {
      // passive: fastest hero, and a shorter dodge cooldown
      passive: { name: 'Agility', dodgeCooldown: 0.9 },
      name: 'Ranger',
      hp: 225,
      speed: 195,   // fastest hero (Agility)
      arrow:     { damage: 34, cooldown: 0.75, speed: 660, pierce: 1 },
      // RMB marks an area, LMB rains arrows on it for `duration` seconds
      volley:    { damage: 14, cooldown: 10, maxRange: 420, radius: 100, arrows: 40,
                   delay: 0.4, duration: 3, impactRadius: 30 },
      // E: the next arrows fire faster with +25% damage and pierce
      rapidFire: { cooldown: 9, arrows: 5, fireCooldown: 0.28, damageBonus: 0.25, pierceBonus: 0.25 },
      // F: pick a special arrow, then LMB fire / RMB ice.
      // Fire: high damage, pierces everything, burns. Ice: weak, but freezes an area.
      elemental: { cooldown: 7,
                   fire: { damage: 90, speed: 780, pierce: 99, burnDps: 16, burnDuration: 4 },
                   ice:  { damage: 12, speed: 620, radius: 105, freeze: 2.2 } },
      // Q: cleanse, invisible, faster
      ult:       { charge: 1100, duration: 3, speedMultiplier: 1.5 },   // also resets every cooldown
    },
    mage: {
      // passive: picking up a mana orb (even at full mana) boosts all damage for `duration`s
      passive: { name: 'Mana Surge', damageMultiplier: 1.2, duration: 2 },
      name: 'Mage',
      hp: 250,
      speed: 155,
      resource:  { name: 'MANA', max: 200, regen: 5, color: '#4a8aff' },
      bolt:      { damage: 24, cost: 3, cooldown: 0.3, speed: 360, turnRate: 7, seekRange: 420, life: 2.2 },
      fireball:  { damage: 120, cost: 20, cooldown: 3, speed: 340, radius: 95, maxRange: 450 },
      // E: pick a target with LMB, lightning strikes after `delay` and arcs
      lightning: { damage: 240, cost: 150, cooldown: 3, delay: 1, selectRadius: 70,
                   arcRange: 160, arcDamage: 100, arcCount: 4 },
      // F: turn into a small, fast bird (tiny hitbox, can't cast). F again lands early.
      bird:      { cost: 50, cooldown: 6, duration: 4, speedMultiplier: 1.8, radius: 5 },
      // Q: place a magic circle (LMB, RMB cancels) that drains enemies in it into hp and mana.
      // While a circle is active, RMB / E / F cooldowns are capped at activeCooldown seconds.
      ult:       { charge: 900, duration: 5, radius: 130, dps: 50, tick: 0.25, lifesteal: 0.35, manaSteal: 0.35, maxRange: 300, activeCooldown: 1 },
    },
    rogue: {
      // passive: each kill in a streak adds damage (up to maxStreak); the streak ends after `duration`s without a kill
      passive: { name: 'Killing Streak', maxStreak: 10, damagePerStreak: 0.03, duration: 3 },
      name: 'Rogue',
      hp: 200,
      speed: 185,
      resource: { name: 'ENERGY', max: 200, regen: 1, perKill: 4, color: '#f0c040' },
      dagger:   { damage: 13, cost: 2, cooldown: 0.4, speed: 580, spreadDegrees: 22, count: 3 },
      // RMB: dash-slash; enemies under half hp start bleeding
      strike:   { damage: 45, cost: 30, cooldown: 1.2, distance: 190, duration: 0.18, invulnerability: 0.3,
                  bleedBelow: 0.5, bleedDps: 5, bleedDuration: 3 },
      // E: block window; a successful parry refunds energy and speeds you up
      parry:    { window: 0.5, cooldown: 4, energy: 75, speedMultiplier: 1.4, speedDuration: 4 },
      // F: the next LMB becomes a dagger storm
      storm:    { cost: 100, cooldown: 8, duration: 3, interval: 0.06, spreadDegrees: 80, damage: 11 },
      // Q: vanish, return with exploding clones that hunt enemies on their own
      ult:      { charge: 1000, vanish: 0.5, clones: 4, cloneRange: 130, cloneHp: 80, cloneDamageTaken: 1.5, cloneDamageDealt: 0.5,
                  cloneLife: 10, cloneFireInterval: 0.55, burstDaggers: 18, burstDamage: 30,
                  burstPierce: 3, burstStun: 1.5 },
    },
  },

  // ---------------------------------------------------------
  //  ENEMIES
  //  windup = telegraph time before the attack lands
  // ---------------------------------------------------------
  //  stunResist = fraction of stun duration ignored
  //  contactDamage (optional) overrides the shared enemyContactDamage
  enemyContactDamage: 10,   // touching an enemy's body hurts (hero i-frames limit the rate)
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
      hp: 620, speed: 34, radius: 20, damage: 60,
      attackRange: 72, attackReach: 98, attackArcDegrees: 140,
      windup: 0.95, recovery: 0.8, cooldown: 1.1, knockbackResist: 0.9, stunResist: 0.5,
    },
    // summoned by the Clay Golem: smashes the ground, sending out a shockwave ring
    clayMinion: {
      hp: 60, speed: 62, radius: 13, damage: 16,
      attackRange: 70, windup: 0.7, recovery: 0.6, cooldown: 1.6,
      waveRadius: 110, waveSpeed: 260, waveWidth: 14,
      heartChance: 0.25,   // overrides drops.heartChance
    },
    // stationary: raises a zombie or skeleton every spawnInterval (up to maxAlive at once),
    // and releases 1-3 ghosts when destroyed
    gravestone: {
      hp: 320, speed: 0, radius: 18, damage: 0, contactDamage: 0,
      firstSpawn: 1.5, spawnInterval: 3, maxAlive: 3, spawnTypes: ['zombie', 'skeleton'],
      ghosts: [1, 3], heartChance: 0.35,
    },
    // only comes out of broken gravestones: slow, contact damage only,
    // with a chilling aura that slows heroes inside it
    ghost: {
      hp: 60, speed: 48, radius: 13, damage: 16, contactDamage: 16,
      auraRadius: 130, slowAmount: 0.65, knockbackResist: 0.4,
      maxLead: 1.4,   // seconds ahead of the hero it aims for, to cut them off
    },
  },

  // mana orbs only drop for mana users; picking one up triggers the Mage's Mana Surge passive
  drops: { heartChance: 0.1, heartHeal: 45, manaChance: 0.3, manaRestore: 10 },

  // ---------------------------------------------------------
  //  WAVES (spawned in order, then a random boss appears)
  // ---------------------------------------------------------
  waves: [
    // gravestones keep raising enemies until broken, so waves with them have fewer of the rest
    { zombie: 6, slime: 1 },
    { zombie: 4, skeleton: 3, wraith: 2, gravestone: 1 },
    { slime: 2, wraith: 3, skeleton: 3, undeadKnight: 1, gravestone: 1 },
    { zombie: 4, skeleton: 4, wraith: 3, undeadKnight: 2, gravestone: 2 },
    { zombie: 4, slime: 2, skeleton: 5, wraith: 4, undeadKnight: 2, gravestone: 2 },
  ],
  // each wave after the first adds this much enemy hp / damage (wave 5: +60% hp, +32% damage)
  waveScaling: { hp: 0.15, damage: 0.08 },
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
    bodyHp: 2200,
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
  phantom: {
    hp: 5200,
    phase2At: 0.5,
    phase3At: 0.25,
    contactDamage: 22,
    floatSpeed: 90,
    orbitRadius: 230,

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
    dashWindup: 0.8,
    dashAimLockAt: 0.3,
    dashSpeeds: [820, 620, 440],   // 1st, 2nd, 3rd dash of a chain: fast, normal, slow (time to react)
    dashRange: 440,
    dashDamage: 38,
    dashWidth: 56,          // hit lane, same width as the red telegraph on the ground
    dashRecover: 0.5,
    dashCycle: [1, 2, 3],          // dashes per dash attack, repeating 1, 2, 3, 1, 2, 3...

    // Slow eye lasers, aimed at the hero while floating
    eyeInterval: [1.2, 1.6, 1.6],
    eyeWindup: 0.45,
    eyeLaser: { damage: 28, speed: 135, life: 9, radius: 6 },   // slow, so they hit hard
    eyeSpreadDegrees: 14,
    // phase 3: instead of charged volleys, a steady stream while floating
    eyeStreamEvery: 0.38,
    eyeStreamJitterDegrees: 6,

    // Vanish, then reappear near the hero
    vanishTime: 0.45,
    hiddenTime: 0.55,
    appearTime: 0.7,        // telegraph ring at the destination
    appearDistance: [130, 180],

    // Pull shockwaves after reappearing
    pulseCount: 4,
    pulseInterval: 0.7,
    pulseSpeed: 300,        // rings start at pulseRadius and close in on the king
    pulseRadius: 360,
    pullSpeed: 55,          // steady drag toward the king while pulsing (px/s)
    pullSurge: 240,         // extra drag added when a ring sweeps over the hero...
    pullSurgeDecay: 3.5,    // ...fading out at this rate (per second)
    pulseLaserEvery: 0.16,  // seconds between random lasers sprayed in every direction
  },
};
