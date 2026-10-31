# Dungeon Run (prototype)

Top-down pixel-art dungeon arena game in plain HTML, CSS and JavaScript.
All art is drawn procedurally into canvases and all sound is synthesized with
Web Audio, so the project has no image or audio files and no build step. The one
asset is the font, Alagard by Hewett Tsoi (free with credit), embedded in
`css/alagard.css`; the game canvas renders at 2x so it stays sharp.

## Run it

Open `index.html` in Chrome, Edge or Firefox. You can double-click it or use
VS Code Live Server.

**Dev shortcuts.** Add these to the URL:

| URL | Effect |
| --- | --- |
| `index.html?class=mage` | Skip the menus and start as the Mage |
| `index.html?class=rogue&wave=3` | Start at wave 3 |
| `index.html?class=warrior&boss` | Go straight to a random boss |
| `index.html?class=warrior&boss=phantom` | Go straight to a chosen boss (`golem` or `phantom`) |
| `index.html?class=mage&practice` | Start in the practice range |
| `index.html?touch&class=mage&practice` | Use the phone touch controls on a PC (add to any of these) |
| `index.html?lobby&class=rogue` | Start in the lobby as the Rogue |
| `index.html?run=graveyard&class=mage` | Start a Graveyard set-dungeon run (`run=random` for random mode, `&stage=2` or `3` to skip ahead) |

Class ids in the URL are `warrior` (Knight), `ranger` (Archer), `mage`, `rogue`, `priestess`, `bard`, `rocketeer` and `baker`.

## Lobby

**Start Game** takes you to the lobby, an open room you walk around in. Walk up to
a station and press E:

- **Hero statues** (left): pick your hero. Subclass slots are shown but not in yet.
- **Workshop** (right): under construction.
- **Pet room** (the old armory, top left): buy a cat, dog, bird or pig with gems (saved on your
  profile) and pick one to come along. Pets follow you and fight near you: the cat's scratches
  make enemies bleed every 3s, the dog barks every 5s to knock enemies back, the flying fish spits exploding water balls from long range, the enchanted butterfly casts slow magic waves and (always, even out of a fight) makes enemies drop more hearts, plus mana for a Mage or light orbs for a Priestess, the bird pecks fast and
  can't be hit by melee, the pig bites slowly and leaves slowing, hurting mud. Pets never die:
  at 0 HP they run back to you and rest until healed (12s), and enemy bodies can't hurt them.
  Total Loyalty and Stronger Buddies work on pets.
- **Practice range** (bottom right): opens the practice range with your hero.
- **Map legend** board (bottom left): what each minimap colour means and what each room is for.
- **Bestiary** lectern (bottom left): a book of every enemy in a theme, two per spread. Flip pages with the arrows (or A / D) and filter by stage and role.
- **Potion guide** alchemy table (beside the bestiary): every potion, what it does and its stage 1 price.
- **Enchantment tome** on its enchanting table (library, by the west shelves): every shop upgrade, general and
  each hero's own, with its icon, what it does and its cooldown; filter by general or by hero.
- **Gate** (top, at the end of the carpet): choose a game mode and start a run.

There is also a training dummy in the lobby to try abilities on. After a run,
"Return to Lobby" brings you back with the same hero.

## Dungeon runs

The gate offers:

- **Set Dungeon**: pick a theme (the **Graveyard**, the **Castle**, the **Ancient Ruins** or the **Fiery Fortress**) and clear its 3 stages.
- **Random Dungeon**: each stage rolls a theme; repeats are very rare (with one theme it is always the Graveyard).
- **Test Dungeon**: pick a boss, then play one floor with every kind of room on it (combat, defend, survival,
  puzzle, shop, all nine special rooms, the secret room and the gem vault) at the stage that boss is met. You
  start with 9999 coins and the practice cheat panel; it pays no gems and never touches your saved run.

Each stage is a generated floor of rooms joined by hallways, with a minimap in
the top-right. Combat, defend and survival rooms lock their doors until the
objective is done (defeat every wave; keep the lantern alive; survive the timer).
Combat rooms have spike traps that pop up every 4 seconds. The boss room
(the farthest dead end) holds the Phantom King, scaled up each stage, except once a run, in
stage 2 or 3, when it's the Deathbringer's instead: a darker room of dead trees hung with
soul lanterns and black, gold-plated graves. It rises through a portal with two scythes and
eight tendrils: scythe slashes throw waves of darkness across the room, tendrils burst up
around the room to slam the ground (cut them down and they go back to it), and it blinks
to a new spot every 7 seconds. At half health the room goes dark and its forked double
scythes spin on their own (shadow bombs, and a whirl when you're close); at 10% it vanishes,
sends four reapers and hunts you as a shade. In the Ancient Ruins each stage's boss is the
Clay Golem or the Guardian, in a crystal cavern: the giant rocks lying in the room rise on
the power crystals' magic and come together to form it, a floating figure of rock that slows you with
a ring of magic (its reach glows on the floor first) before charging a giant chest beam (cover
stops it until half health, when it smashes through), and slams the ground
four times (six at half health, with bigger spikes) for massive rock spikes, at you and then
ahead of you in turn. The power crystals slowly heal it while they stand, so break them; at
half health broken ones reform out of the magic, but only once. In the Fiery Fortress each
stage's boss is the Decronic Flameworm, a giant sandworm of molten rock: below ground it can't be
hurt and its mound of broken floor chases you, then the floor cracks and glows where it bursts up to
bite and spray fireballs; above ground it sprays fireballs in every direction, wave after wave, or
looses a giant flaming magic arrow that bursts near you and leaves the area in flames, then dives
again. Below half health it splits into three smaller worms, each with its own health bar (together
what it had left). Beating the boss
opens a portal to the next stage, and after stage 3 the run is won. Later stages
make enemies tougher (more hp and damage, a little faster) rather than sending
many more of them, and add stage-exclusive enemies (necromancer, reaper
and minigunner from stage 2; zombie soldier and skeleton sorcerer in stage 3).
Summoners (tombstones, necromancers, sorcerers) share a cap on how many raised
enemies can be up at once.

**The Fiery Fortress**: a fortress of black nether brick over a sea of lava (the lava flows past
the ramparts, and the hallways are brick bridges). Lava and fire are different: open flames burn
up out of vents in the fight rooms' floors (a dashed orange ring marks each) and set you on fire,
the same slow, light burn as any fire attack; lava, in pools or channels crossed by stone bridges
(and left by magma slimes, the molten elemental's waves and the baby dragon's fireballs), burns you
far faster while you stand in it and clings for a moment after. There are no frost barrels here.
Its demons, living fire and molten things are all in the bestiary; the elite demon can't be reached
by melee while it flies (shots, burns and far-off attacks still hit it).

**Coins**: enemies drop coins (tougher ones drop more; summoned ones rarely), the boss
drops a pile, and every cleared room leaves a chest worth 5 coins. Coins last for the
whole run. Spend them in the **shop**: Mira sells six different potions, 3-7 of each and always
at least one healing kind (your bag holds 5 slots,
up to 10 of a kind each) and Bram the enchanter keeps three upgrades on his table at a
time. Buy as many as you can afford: the first costs 30 coins and each one bought makes the
next cost 10 more for the rest of the run; a bought card is replaced by a new one. Rerolling
costs 10, then 5 more each time, back to 10 at the next stage's shop. Each upgrade can be
owned once. Entering each stage you also choose one free upgrade from three, and a wishing
well's wish is sometimes an upgrade instead of potions.
Tobin's trade-in stall at the back of the shop buys them back for a little: 10 coins an upgrade
(its effect comes off, and Bram's prices don't drop), 40% of a potion's base price each.

**Upgrades**: 35 shared ones (Vital Heart, Tesla Armour, Silver Shield, Backpack, Nuclear Reactor, Last Hurrah...;
every hero can be offered any of them, even the few that only help heroes with mana, rockets,
energy, followers or pets, or a melee basic attack) and 16 hero upgrades, framed in gold with the
hero's name, that only ever show up for that hero (plus 3 dark ones only the dark trader deals in). Hold Tab (the scoreboard) to see every
player's upgrades: hover one to read it; cooldowns, stacks and "active right now" glows show on
the icons, and they flash when they go off. Potion prices rise with the stage. In defend rooms,
enemies chase you once they spot you and go back for the lantern if you outrun them.

**Special rooms** (one or two a floor; their prices rise with the stage like the shop's):
- **Blacksmith** (Borin): forges an enhancement for your weapon (35 coins) for the rest of the run, in
  a random rarity: rare (blue), epic (purple), legendary (gold) or mythical (shining red: legendary's boost
  plus a perk). After the reveal, TAKE IT (it goes in the slot over your attack button; an old one drops by
  the anvil) or DENY (it's destroyed). Drag it out of the slot to drop it; at most 3 lie on the floor (the oldest goes). Knight and Rogue: Sharpening Stone
  (+2-4 damage per basic hit; mythical makes them bleed). Archer and Rocketeer: Quiver (+5-15% attack
  speed; mythical fires 2 weaker shots at a diagonal). Mage: Gemstone (missiles cost 1-3 less mana;
  every 5th mythical one bursts). Priestess and Bard: Holy Tome (every 7th / 6th / 5th attack stuns;
  mythical slows after the stun). Baker: Whisks (every 3rd attack throws one for 20-40; mythical ices them).
- **Dark trader**: 20 of your MAX health (gone for the run; never below 50) for a random gift: potions or an upgrade, sometimes one only he
  has: Dark Minions (every 5th attack raises a shadow with a dagger, up to 3), Darklash (getting hit sends
  out a wave of darkness, 10s cooldown) or Soulreap (hits drop soul fragments: 10 HP each, or 10 soul health
  past full, up to 50).
- **Friendly trader** (Wren): three stands in front of his counter, each showing an upgrade he will trade
  (every hero gets their own three). Walk up to one and choose which of your upgrades to give him for it;
  each stand trades once.
- **Mount trader** (Dusty): a horse (45 coins, 50 HP) that's faster and takes your hits; at 0 it lies down
  to rest, and every new stage gives it 30 HP back. R (RIDE on a phone) gets on and off; no ultimates in
  the saddle, and in a locked room you can get off but not back on.
- **Helper camp**: the hireling waits by the fire and you talk to them to hire them: the knight (sword and shield, blocks), the archer, or the priest (heals you
  every 10 seconds; his two frail acolytes shoot light). They follow you from stage to stage until they fall.
- The wishing well grants a wish for coins and the treasure room has three chests; the hero statue and
  the 5 star restaurant (its chef just chats for now) aren't in yet.

Puzzle rooms (Simon's rune stone) and a secret room (reached only by jumping into a glowing hole in one
combat room's floor; a rope of light takes you back up) can also be found.

**Saved runs**: a solo run saves on your profile at the start of every stage. The main menu (and the
dungeon gate) then offers **Continue Run**, picking up at the start of that stage with your upgrades,
coins, items, forge enhancement, horse and hirelings. Starting a new run instead ends the saved one and
pays its gems as if it had ended there; finishing or wiping clears it. (Multiplayer runs aren't saved.)

## Practice range

Walk onto the practice range pad in the lobby and press E. A training dummy shows your DPS
(top of the screen), and the panel on the right lets you switch hero, spawn
any graveyard or castle enemy, open a portal to any boss's room (Clay Golem, Guardian, Phantom King,
Deathbringer, Prince, Princess, Queen, King), clear the arena, fill your ultimate, and toggle
god mode, infinite mana (also light orbs) and infinite energy. Dying respawns you.
"Back to lobby" on the panel (or in the pause menu) returns to the lobby.

## Multiplayer

Pick **Multiplayer** on the main menu, enter a name, then **Host a lobby** (you get a
5-letter room code to share) or type a friend's code and **Join lobby**. Up to 8
players, with at most 2 of the same hero. Everyone shares the lobby: pick heroes at
the statues, browse the bestiary and legend. When the host uses the gate, a ready
check pops up at the side for everyone; once all are ready the host picks the
dungeon and the whole party is teleported in. Enemies get tougher and more numerous
with more players. Locked rooms pull the whole party inside, each hero has their own
coins and shop upgrades, and a reward chest holds 5 coins per hero. A fallen hero
lies where they fell: a teammate holding E (interact) by the body for 4 seconds
revives them at 35% health, and anyone still down gets back up at the next stage.

Only the host can open the practice range: when they do, the whole party goes with them.
Everyone can use the practice panel (switch hero, spawn enemies, open a boss portal, toggle the
cheats, which are shared by the party). Anyone stepping into a boss portal takes the whole party
to that boss, and its portal back brings everyone to the range. Leaving the range ("Back to
lobby", or the pause menu) is the host's call.

How it works: connections are peer to peer (WebRTC via the free PeerJS service, which
only introduces the players). Every machine runs the same simulation; the host
collects everyone's input 60 times a second and sends it out in numbered bundles,
and gameplay randomness is seeded so it comes out the same everywhere. Periodic
checksums warn the host if a machine drifts out of sync. Some strict school or office
networks block peer-to-peer connections.

## Settings

The game fills the whole window, whatever its shape (no black bars), and goes **fullscreen**
on the first click or key press; leave it (Esc / F11) and the next click brings it back.
Settings > Window mode switches to playing in the browser window instead.

**Graphics** (Settings > General) has five presets for slower or faster computers: Super quality,
Quality (the default), Balanced, Performance and Super performance. The faster ones draw at a lower
resolution (sprites look the same; text and effects get chunkier), with fewer sparks and smoke wisps,
a cheaper darkness layer, no lamp bloom or torch glows, thinner graveyard fog, and Super performance
drops the fog and vignette and caps the game at 30 FPS. Super quality draws sharper on high-resolution
screens, with more particles. It only changes how your screen looks, so teammates can each pick their own.

**Settings** (main menu or pause menu) is the same on every device, in four tabs, each
setting with a short recommended value: **General** (control style Auto / Touch / Mouse + keys,
window mode, graphics, minimap size, music and sound), **Phone** (auto fire, interface and button size,
opacity, the button editor), **PC** (mouse sensitivity, crosshair, and key bindings for movement, E, F, Q, dodge,
the five bag slots, interact, the music toggle and the mouse / crosshair toggle (LMB / RMB
stay on the mouse)) and **Multiplayer** (teammate effects, screen shake). Settings are saved in the browser. While playing, the game
locks the mouse pointer so sensitivity can apply; press Esc to get the cursor
back (this pauses), or press C to switch to the normal mouse pointer without
pausing (C again brings the crosshair back; sensitivity only applies to the
crosshair). **Crosshair lock** (under Crosshair, off by default) keeps the crosshair a set
distance from your hero: moving the mouse turns it round them, so it can't get lost.

Music: the main menu, lobby (a slower lo-fi loop), battle and boss each have
their own track.

## Controls

WASD to move, mouse to aim, left click for the primary attack (hold to repeat),
right click for the secondary ability, E and F for class abilities, Q for the
ultimate (it charges as you deal damage), Shift to dodge, 1-5 to drink the
potion in that bag slot (potions are bought at the shop; there is no free
potion), H to drink the strongest health potion in the bag, Esc to pause, M to
toggle music (a toast shows ON / OFF). The bag (bottom left) can be managed
with the mouse: drag a slot onto another to move, swap or stack potions
(this also works in the shop's bag), drag it out of the bag to drop it on the
floor (to make space, or for a teammate to pick up), and right click a slot to
drink it. Timed potions work one of a kind at a time: the same effect can't be
drunk again until it wears off, but a higher tier (shown as I / II / III next to the
effect under the passive) goes on over a weaker one, which carries on underneath.
The Mage spends mana, the Rogue spends energy and the Priestess
spends light orbs (bar under HP).

### Touch controls (phones and tablets)

Phones and tablets get on-screen controls automatically (Settings > General: Auto / Touch /
Mouse + keys). The game is landscape only; held upright it asks you to turn the phone.

- **Left thumb**: a movement joystick appears wherever you touch the left half of the screen.
  It's analog: the hero walks any direction at full speed from a small push, and the stick's
  base trails your thumb so turning round is quick. The base never leaves the left half of the screen;
  **Fixed joystick** (Settings > Phone) keeps it in one spot instead (move it with the button editor).
- **Aim stick** (bottom right): hold it still to attack the nearest enemy; drag it to aim.
  With **Auto fire** on (the default) dragging keeps attacking that way; with it off, drag to
  aim and let go to fire one shot.
- **Skill buttons** in an arc round it: secondary, E, F and the ultimate (its ring fills as it
  charges). Tap to cast at the nearest enemy, or drag to aim (the ability's outline shows) and
  let go to cast. Changed your mind? Let go on the **CANCEL** mark that appears above the
  buttons while you drag, or drag back onto the skill's own button. A skill keeps the aim you gave it while it plays
  out (the Knight's charge goes where you aimed it, not where you walk). Dodge sits at the bottom of the arc: drag it to
  dodge that way, or tap it to dodge the way you are walking.
- Abilities that wait for a click on a PC (the Mage's lightning and drain circle, the Archer's volley, the
  Rocketeer's barrage) cast where the button was dragged when you let go. Some buttons cast on a tap with
  nothing to aim: the Priestess's healing rune, the Bard's tune, Inspire and Lullaby, the Archer's rapid fire
  and camouflage. The Archer has separate FIRE and ICE buttons on one shared cooldown. The Priestess's and the
  Baker's attacks are
  aimed like a thrower's: drag the aim stick (a full drag is the full range) to see where it lands (the Baker's
  shows the arc her cake flies); with Auto fire on they keep throwing while the stick is held, with it off they
  throw once on letting go, and
  let go to throw (a quick tap throws at the nearest enemy). Her Aegis
  is dragged onto a teammate (a tap shields herself). Each ability's indicator has its own shape and colour:
  a line and a circle for something thrown, a circle for something placed, a ring round you, an arrow for a
  dash, a beam, a cone.
- **USE** is interact (hold it by a fallen teammate to revive), **HEAL** drinks the strongest
  health potion, and the bag moves to the bottom middle: tap a slot to drink, drag to move it
  or out of the bag to drop it.
- Top left: pause, and in dungeon runs the scoreboard (a toggle).
- Everything (HUD, buttons, text, menus) shows bigger than on a PC; **Interface size** in
  Settings > Phone tunes it, alongside button size and opacity.
- **Move / resize buttons** (Settings > Phone; works on a computer too) opens the layout editor: drag any control (aim stick,
  skills, USE, HEAL, the bag, CANCEL, pause, scoreboard) where you like, tap one and use - / +
  to resize it, RESET for the default layout, DONE to go back (Save keeps it).
- Skill buttons glow when ready, flash as they come off cooldown, show the seconds left big in
  the middle, a gold badge for stored charges, and what's missing when you're short of mana. Touch and PC players send the same
  input, so they play together in multiplayer like any other machines.
- **Fullscreen** starts on the first tap (Android). iPhones don't allow it in the browser: use
  Share > **Add to Home Screen**, and the game opens from there fullscreen and sideways.

## Project layout

```
index.html              screens + script load order
css/style.css           menu / UI styling
js/
  config.js             ALL balance numbers (HP, damage, cooldowns, waves, boss)
  main.js               entry point, screen flow, main loop
  core/                 utils, settings (saved), input (key bindings), touch (phone controls), audio (SFX + music), camera
  gfx/                  procedural pixel art: heroes, enemies, boss, items, tiles,
                        obstacleSprites.js (room walls and the rubble left when obstacles are blown up)
    heroes/             one file per hero + cute.js (the shared chibi style and 8-frame poses)
    enemies/            zombies, skeletons, spirits and casters in the same style (npcSprites.js too)
  world/dungeon.js      arena map, wall collision, torches
  world/floor.js        generated dungeon floors (rooms, hallways, locked doors, chunked art)
  entities/
    entity.js           shared base (position, knockback, hit flash)
    projectile.js       configurable projectile (homing, bouncing, piercing)
    effects.js          particles, damage numbers, attack telegraphs
    pickup.js           heart, mana, light and buff orb drops
    player/             Player base + Knight (warrior.js), Archer (ranger.js), Mage, Rogue, Priestess, Bard, Rocketeer, Baker
    enemies/            Enemy base + Zombie, Slime, Wraith, Skeleton, UndeadKnight,
                        Gravestone (raises zombies/skeletons), Ghost (slowing aura),
                        Mimic (tough lunging chest, drops a super regen/speed/power buff for 3 room clears),
                        graveyard.js (the Graveyard theme's new enemies)
    boss/golem.js       Clay Golem (parts, phases, attacks)
    boss/guardian.js    The Guardian (the ruins' floating rock boss: slowing ring + chest beam, spike slams, healing crystals)
    boss/phantom.js     Phantom King (dash, eye lasers, vanish + pull shockwaves)
    boss/deathbringer.js The Deathbringer (scythes, tendrils, darkness, the shade)
    boss/flameworm.js   The Decronic Flameworm (the fortress's burrowing worm: bite, fireball waves, flaming arrow, splits in three)
  game/                 Game world, wave director, lobby hub, dungeon run (rooms + objectives), HUD
  ui/menus.js           DOM menus + lobby panels (hero, workshop, dungeon, legend)
  ui/bestiary.js        bestiary book (entries, filters, page flips)
  ui/potionGuide.js     lobby potion guide (every potion by family)
  ui/dialog.js          NPC dialogue box (typewriter text, choices)
  net/net.js            peer-to-peer connections (PeerJS): host / join by room code
  net/session.js        multiplayer lockstep: input bundles, commands, scenes, desync checks
  game/upgrades.js      shop upgrades (what they do, the Upgrades hooks) + the shop window
  gfx/upgradeSprites.js the upgrade icons
  game/decor.js         dungeon set dressing; everything standing in a room is a solid obstacle (FloorDecor.solidify)
```

## Tuning

Every number you might want to tweak is in `js/config.js`, including hero
stats, enemy stats and telegraph (`windup`) times, the wave list and per-wave
scaling, boss odds, passive regen, and all Clay Golem and Phantom King timings
and damage.

## Adding a class

1. Add stats in `CONFIG.classes`, including `ult.charge` and an optional `resource`.
2. Add a `drawX(p, P)` sprite function in its own file in `js/gfx/heroes/` (using the parts in `cute.js`) and register it in `buildHeroSprites()`.
3. Create `js/entities/player/x.js` extending `Player` with `primary()`, `secondary()`,
   `abilityE()`, `abilityF()` and `ultimate()`. Override `absorb()` for blocks/shields.
4. Register it in `createHero()` (`player.js`), in `CLASS_INFO` (`menus.js`), and add the script tag in `index.html`.
   It gets a statue in the lobby automatically.
