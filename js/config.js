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
    dodge: { distance: 125, duration: 0.22, invulnerability: 0.3, cooldown: 2.0 },
    // Enemies further than this can't see an invisible hero
    invisibleDetectRange: 200,
    // passive regen: after `delay` seconds without losing hp, heal `hpPerSecond` (1 hp every 5s)
    regen: { delay: 4, hpPerSecond: 0.2 },
  },

  // ---------------------------------------------------------
  //  HERO CLASSES
  //  ult.charge = damage the hero must deal to fill the Q ultimate
  // ---------------------------------------------------------
  classes: {
    warrior: {
      // passive: after taking `hits` hits, the next one is blocked automatically
      passive: { name: 'Tanker', hits: 4 },
      name: 'Knight',
      hp: 350,
      speed: 180,
      // LMB: slash, slash, stab
      combo:  { damage: 34, cooldown: 0.34, resetTime: 0.9, range: 82, arcDegrees: 130, knockback: 180,
                stabDamage: 95, stabCooldown: 0.6, stabRange: 170, stabWidth: 40, stabLunge: 36, stabKnockback: 340 },
      // RMB (hold): raise the barrier shield the knight carries, `distance` px ahead and facing the aim.
      // It's its own wall, so it soaks enemy projectiles (arrows, fireballs, lasers) crossing it; melee goes through.
      // Regens after `regenDelay` once lowered; if broken, it's down for `breakCooldown`.
      barrier: { hp: 400, regen: 80, regenDelay: 1.2, breakCooldown: 5, distance: 34, width: 96, thickness: 14,
                 moveMultiplier: 0.8 },
      // LMB while the shield is up: shield bash. Lunges `distance` px over `time`s, hitting enemies in front
      // of the shield (within `reach`, inside `arcDegrees`) once each: damage, knockback and a stun.
      bash:    { damage: 45, stun: 1.2, knockback: 320, cooldown: 4, distance: 70, time: 0.15, reach: 56, arcDegrees: 120 },
      // E: spin attack, moving faster while spinning
      spin:   { damage: 22, tick: 0.22, duration: 5.5, radius: 88, knockback: 90, moveMultiplier: 1.35, cooldown: 12 },   // cooldown starts once the spin ends (or E cancels it)
      // F: wind up, then charge through enemies, stunning them. Holds `charges` uses; each refills over `cooldown`s
      charge: { windup: 0.5, distance: 330, time: 0.35, width: 44, damage: 35, stun: 1.0, knockback: 260, cooldown: 10, charges: 2 },
      // Q: power up, then a huge downward strike along the aim line.
      // LMB releases it early; damage scales from minPower up to full.
      ult:    { charge: 2100, powerTime: 3, moveMultiplier: 0.3, damage: 300, minPower: 0.35, length: 360, width: 84 },
    },
    ranger: {
      // passive: fastest hero, and a shorter dodge cooldown
      passive: { name: 'Agility', dodgeCooldown: 1.3 },
      name: 'Archer',
      hp: 225,
      speed: 230,   // fastest hero (Agility)
      arrow:     { damage: 34, cooldown: 0.75, speed: 660, pierce: 1 },
      // RMB: camo. Cleanse, invisible and faster; enemies only spot you within detectRange.
      // Any attack (arrow, fire/ice arrow, volley) drops the camo straight away.
      camo:      { cooldown: 12, duration: 4, speedMultiplier: 1.4, detectRange: 120 },
      // E: the next arrows fire faster with +25% damage and pierce
      rapidFire: { cooldown: 9, arrows: 5, fireCooldown: 0.28, damageBonus: 0.25, pierceBonus: 0.25 },
      // F: pick a special arrow, then LMB fire / RMB ice.
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
      speed: 186,
      resource:  { name: 'MANA', max: 200, regen: 5, color: '#4a8aff' },
      bolt:      { damage: 24, cost: 3, cooldown: 0.3, speed: 360, turnRate: 7, seekRange: 420, life: 2.2 },
      fireball:  { damage: 90, cost: 20, cooldown: 3, speed: 340, radius: 95, maxRange: 450 },
      // E: pick a target with LMB, lightning strikes after `delay` and arcs
      lightning: { damage: 240, cost: 120, cooldown: 3, delay: 1, selectRadius: 70,
                   arcRange: 240, arcDamage: 140, arcCount: 4 },
      // F: turn into a small, fast bird (tiny hitbox, can't cast). F again lands early.
      bird:      { cost: 50, cooldown: 6, duration: 4, speedMultiplier: 1.8, radius: 5 },
      // Q: place a magic circle (LMB, RMB cancels) that drains enemies in it into mana.
      // While a circle is active, RMB / E / F cooldowns are capped at activeCooldown seconds.
      ult:       { charge: 1400, duration: 5, radius: 130, dps: 50, tick: 0.25, manaSteal: 0.35, maxRange: 300, activeCooldown: 1 },
    },
    rogue: {
      // passive: each kill in a streak adds damage (up to maxStreak); the streak ends after `duration`s without a kill
      passive: { name: 'Killing Streak', maxStreak: 10, damagePerStreak: 0.03, duration: 3 },
      name: 'Rogue',
      hp: 200,
      speed: 218,
      resource: { name: 'ENERGY', max: 200, regen: 1, perKill: 4, color: '#f0c040' },
      dagger:   { damage: 13, cost: 2, cooldown: 0.4, speed: 580, spreadDegrees: 22, count: 3 },
      // RMB: dash-slash; enemies under half hp start bleeding. Every enemy hit is marked for
      // markDuration; if a marked enemy dies, the strike's cooldown resets.
      strike:   { damage: 45, cost: 30, cooldown: 1.2, distance: 190, duration: 0.18, invulnerability: 0.3,
                  bleedBelow: 0.5, bleedDps: 5, bleedDuration: 3, markDuration: 4 },
      // E: block window; a successful parry refunds energy and speeds you up
      parry:    { window: 0.5, cooldown: 4, energy: 75, speedMultiplier: 1.4, speedDuration: 4 },
      // F: the next LMB becomes a dagger storm
      storm:    { cost: 100, cooldown: 8, duration: 3, interval: 0.06, spreadDegrees: 64, damage: 11 },
      // Q: vanish, return with exploding clones that hunt enemies on their own
      ult:      { charge: 1500, vanish: 0.5, clones: 3, cloneRange: 130, cloneHp: 140, cloneDamageTaken: 1.5, cloneDamageDealt: 0.85,
                  cloneLife: 10, cloneFireInterval: 0.55, burstDaggers: 18, burstDamage: 42,
                  burstPierce: 3, burstStun: 1.5 },
    },
    priestess: {
      // passive: hitting an enemy marked by the light missiles may drop a light orb
      passive: { name: 'Divine Mark', orbChance: 0.3 },
      name: 'Priestess',
      hp: 225,
      speed: 192,
      // light orbs: no regen; refilled only by orbs dropped from marked enemies (can't pick one up when full)
      resource:  { name: 'LIGHT', max: 4, regen: 0, color: '#ffe680' },
      // LMB: a beam of light falls on the cursor after `delay`
      ray:       { damage: 46, cooldown: 0.6, delay: 0.3, radius: 42, maxRange: 380 },
      // RMB: missiles that each seek a different enemy and mark it for markDuration
      missiles:  { count: 5, damage: 22, cooldown: 6, speed: 330, turnRate: 6, life: 2.6, markDuration: 10 },
      // E: aim a healing rune (LMB places it, RMB / E cancels; heal is hp per second)
      rune:      { cost: 2, cooldown: 8, heal: 50, duration: 4, radius: 85, maxRange: 300 },
      // F: then LMB shields the ally nearest the cursor, RMB shields yourself
      aegis:     { cost: 2, cooldown: 10, hp: 150, duration: 8, selectRadius: 80 },
      // Q: charge for up to powerTime (LMB releases early), then throw a stunning light bomb at the cursor.
      // Damage, radius and stun scale from their minimums up to full.
      ult:       { charge: 1600, powerTime: 4, moveMultiplier: 0.4, maxRange: 380, flightTime: 0.35,
                   damage: 480, minPower: 0.25, radius: 170, minRadius: 80, stun: 2.5, minStun: 0.8 },
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
    // a treasure chest with teeth: hops slowly toward the hero, then lunges again and again
    // while the hero stays within leashRange. Very tough, hits hard, usually drops a buff orb
    mimic: {
      hp: 760, speed: 0, radius: 18, damage: 42, contactDamage: 14,
      hopDistance: 46, hopTime: 0.32, hopRest: 0.55,
      aggroRange: 160, leashRange: 230,
      windup: 0.42, aimLockAt: 0.15, lungeDistance: 150, lungeTime: 0.2, recovery: 0.45,
      knockbackResist: 0.85, stunResist: 0.5, buffChance: 0.8, heartChance: 0.3,
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
      poisonDps: 6, poisonTime: 3,
    },
    // Skeleton warrior: its shield blocks the first hit, then it fights with a sword
    skeletonWarrior: {
      hp: 150, speed: 62, radius: 13, damage: 24,
      attackRange: 46, attackReach: 64, attackArcDegrees: 110,
      windup: 0.5, recovery: 0.45, cooldown: 0.9,
    },
    // Skeleton bomber: runs at you, lights the fuse when close; also goes off when killed
    bomber: {
      hp: 70, speed: 88, radius: 13, damage: 38,
      triggerRange: 60, fuse: 0.8, blastRadius: 80, deathFuse: 0.35,
    },
    // Candlehead: skeleton that fires souls; a soul knocks you back hard
    candlehead: {
      hp: 95, speed: 58, radius: 13, damage: 14,
      preferredMin: 170, preferredMax: 300, windup: 0.6, cooldown: 1.8, soulSpeed: 230, knockback: 320,
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
      summonEvery: 7, summonCount: 3, summonMax: 6, summonTypes: ['zombie', 'skeleton', 'skeletonWarrior'],
    },
    // stage 2+: Reaper swings a scythe, sends waves of darkness and teleports in close
    reaper: {
      hp: 420, speed: 70, radius: 16, damage: 38,
      attackRange: 70, attackReach: 92, attackArcDegrees: 150, windup: 0.7, recovery: 0.6, cooldown: 1.2,
      waveEvery: 4.5, waveWindup: 0.6, waveSpeed: 260, waveDamage: 26,
      blinkEvery: 6, blinkRange: 260,
      knockbackResist: 0.6, stunResist: 0.4,
    },
    // stage 2+: big skeleton with a minigun: spins up, then sprays slow bullets
    minigunner: {
      hp: 460, speed: 34, radius: 20, damage: 9,
      preferredMin: 180, preferredMax: 320, spinUp: 1.0, fireTime: 2.0, fireEvery: 0.08, bulletSpeed: 210,
      spreadDegrees: 14, cooldown: 2.6, knockbackResist: 0.8, stunResist: 0.5,
    },
    // stage 3: Zombie soldier: armoured (takes `armor` less damage), fires fast bullet bursts
    zombieSoldier: {
      hp: 320, speed: 50, radius: 14, damage: 16, armor: 0.4,
      preferredMin: 160, preferredMax: 300, windup: 0.55, burst: 3, burstEvery: 0.12, bulletSpeed: 540, cooldown: 1.9,
      knockbackResist: 0.5,
    },
    // stage 3: Skeleton sorcerer: lines of bone hands burst from the ground (stun), and summons exploding skulls
    skeletonSorcerer: {
      hp: 240, speed: 44, radius: 14, damage: 18,
      preferredMin: 190, preferredMax: 320,
      handsEvery: 3.5, handsCount: 7, handsSpacing: 40, handsDelay: 0.55, handsStep: 0.08, handsRadius: 22, stun: 1.0,
      skullsEvery: 8, skullCount: 3,
    },
    // summoned by the sorcerer: flies straight at you and explodes on contact
    flyingSkull: { hp: 22, speed: 150, radius: 9, damage: 22, blastRadius: 50, contactDamage: 0, coins: 0 },
  },

  // ---------------------------------------------------------
  //  DUNGEON THEMES (dungeon runs)
  //  enemies: [type, weight] per stage; stage 2/3 lists include their exclusives.
  //  Every theme's boss appears in all three stages, scaled by CONFIG.run.stages.
  // ---------------------------------------------------------
  themes: {
    graveyard: {
      name: 'Graveyard',
      blurb: 'Restless dead, poison and bone. Ruled by the Phantom King.',
      boss: 'phantom',
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
    },
  },

  // ---------------------------------------------------------
  //  DUNGEON RUNS: 3 stages, each a generated floor of rooms and hallways.
  // ---------------------------------------------------------
  run: {
    stages: [                                     // enemy + boss scaling per stage
      { hp: 1, damage: 1 },
      { hp: 1.55, damage: 1.25 },
      { hp: 2.2, damage: 1.5 },
    ],
    // random mode: chance weight of rolling a theme already used this run (vs 1 for a new one)
    repeatThemeWeight: 0.05,
    // floor layout: rooms sit in a grid of cells; hallways join neighbouring cells
    grid: { cols: 5, rows: 5, cellW: 28, cellH: 22 },
    roomCount: [11, 12, 13],                      // per stage, including start and boss
    // room objectives
    combat: { waves: [2, 3, 3], perWave: [4, 6, 7], perWaveRandom: 2 },
    defend: { duration: [30, 36, 42], totemHp: [1000, 1300, 1650], waveEvery: 6, perWave: [3, 4, 5] },
    // defend-room enemies chase the hero once within spotRange, and give up (back to the lantern) past loseRange
    defendAI: { spotRange: 230, loseRange: 380 },
    // coins: roughly one per hpPerCoin of an enemy's base hp (at least 1); summoned enemies drop 1 coin
    // summonedChance of the time; the boss drops boss[0]-boss[1]; every cleared room's chest holds roomChest
    coins: { hpPerCoin: 60, summonedChance: 0.3, boss: [25, 35], roomChest: 5 },
    // shop upgrades: one pick of three per shop; each can be owned maxLevel times per run (price x priceGrowth
    // per level owned); rerolling the three costs reroll.base, + reroll.step more each time at the same shop
    shop: { maxLevel: 3, priceGrowth: 1.5, reroll: { base: 6, step: 4 } },
    survival: { duration: [30, 40, 50], spawnEvery: [1.3, 1.05, 0.85], perSpawn: 2, maxAlive: [12, 15, 18] },
    // spike traps (combat rooms only): pop up every `period` seconds for `up` seconds
    spikes: { period: 4, up: 0.8, warn: 0.4, damage: 16, perRoom: [6, 10] },
    // special rooms (one or two per floor); not functional yet
    specials: ['blacksmith', 'wishingWell', 'heroStatue', 'restaurant5', 'mountTrader', 'darkTrader',
               'friendlyTrader', 'treasure', 'helper'],
  },

  // ---------------------------------------------------------
  //  MULTIPLAYER (host + up to 7 friends, peer to peer)
  // ---------------------------------------------------------
  multiplayer: {
    maxPlayers: 8,
    maxDuplicates: 2,          // at most this many of the same hero in one lobby
    // enemies scale with the party: each extra hero adds this much enemy hp / this many more enemies
    hpPerExtraPlayer: 0.5,
    countPerExtraPlayer: 0.3,
    tickRate: 60,              // simulation steps per second (everyone steps in lockstep)
    codeLength: 5,             // room code letters
    peerPrefix: 'dungeonrun-v1-',   // room code -> PeerJS id (bump to keep old versions out)
    checksumEvery: 120,        // ticks between desync checks
    joinTimeout: 25,           // seconds before giving up on reaching a room (relayed connections are slower)
    // How browsers find a route to each other. STUN works on most home wifi; mobile data
    // (carrier NAT) usually blocks direct connections, so traffic has to go through a TURN
    // relay. The PeerJS relay below is free but often busy or down.
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      {
        urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478',
          'turn:eu-0.turn.peerjs.com:3478?transport=tcp', 'turn:us-0.turn.peerjs.com:3478?transport=tcp'],
        username: 'peerjs', credential: 'peerjsp',
      },
    ],
    // Optional: a URL that returns extra ICE servers as JSON (an array of
    // { urls, username, credential }), e.g. a Metered TURN credentials URL:
    //   https://<your-app>.metered.live/api/v1/turn/credentials?apiKey=<key>
    // Fetched before connecting; leave '' to use only iceServers above.
    turnCredentialsUrl: '',
  },

  // mana orbs only drop for mana users; picking one up triggers the Mage's Mana Surge passive
  drops: { heartChance: 0.1, heartHeal: 45, manaChance: 0.3, manaRestore: 15 },

  // buff orbs dropped by mimics (one random type each); picking one up again refreshes it
  buffs: {
    regen:  { name: 'REGEN', duration: 8, perSecond: 0.03, color: '#6cff7a' },  // 3% max hp/s even while hit (24% total)
    speed:  { name: 'SPEED', duration: 8, multiplier: 1.3, color: '#ffd34a' },  // +30% move speed
    damage: { name: 'POWER', duration: 8, multiplier: 1.25, color: '#ff5a4a' }, // +25% damage, stacks with passives
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
  phantom: {
    hp: 7200,              // phase 3 (below phase3At) gets 1800 of this
    phase2At: 0.5,
    phase3At: 0.25,
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
    dashWindup: 0.8,
    dashAimLockAt: 0.3,
    dashSpeeds: [760, 960, 1180],  // 1st, 2nd, 3rd dash of a chain: each one faster than the last
    dashRange: 440,
    dashDamage: 38,
    dashWidth: 56,          // hit lane, same width as the red telegraph on the ground
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
    appearDistance: [130, 180],

    // Pull shockwaves after reappearing
    pulseCount: 4,
    pulseInterval: 0.7,
    pulseSpeed: 300,        // rings start at pulseRadius and close in on the king
    pulseRadius: 360,
    pullSpeed: 55,          // steady drag toward the king while pulsing (px/s)
    pullSurge: 240,         // extra drag added when a ring sweeps over the hero...
    pullSurgeDecay: 3.5,    // ...fading out at this rate (per second)
    pulseLaserEvery: 0.08,  // seconds between random lasers sprayed in every direction
  },
};

// graveyard enemies are ordinary enemies too (CONFIG.enemies[type] is what they read)
Object.assign(CONFIG.enemies, CONFIG.graveyardEnemies);
