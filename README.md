# Dungeon Run (prototype)

Top-down pixel-art dungeon arena game in plain HTML, CSS and JavaScript.
All art is drawn procedurally into canvases and all sound is synthesized with
Web Audio, so the project has no image or audio files and no build step.

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
| `index.html?lobby&class=rogue` | Start in the lobby as the Rogue |
| `index.html?run=graveyard&class=mage` | Start a Graveyard set-dungeon run (`run=random` for random mode, `&stage=2` or `3` to skip ahead) |

Class ids in the URL are `warrior` (Knight), `ranger` (Archer), `mage`, `rogue` and `priestess`.

## Lobby

**Start Game** takes you to the lobby, an open room you walk around in. Walk up to
a station and press E:

- **Hero statues** (left): pick your hero. Subclass slots are shown but not in yet.
- **Workshop** (right): under construction.
- **Practice range** (bottom right): opens the practice range with your hero.
- **Map legend** board (bottom left): what each minimap colour means and what each room is for.
- **Bestiary** lectern (bottom left): a book of every enemy in a theme, two per spread. Flip pages with the arrows (or A / D) and filter by stage and role.
- **Gate** (top, at the end of the carpet): choose a game mode and start a run.

There is also a training dummy in the lobby to try abilities on. After a run,
"Return to Lobby" brings you back with the same hero.

## Dungeon runs

The gate offers:

- **Set Dungeon**: pick a theme (only the **Graveyard** so far) and clear its 3 stages.
- **Random Dungeon**: each stage rolls a theme; repeats are very rare (with one theme it is always the Graveyard).
- **Test Dungeon**: the original 5-wave arena and random boss.

Each stage is a generated floor of rooms joined by hallways, with a minimap in
the top-right. Combat, defend and survival rooms lock their doors until the
objective is done (defeat every wave; keep the lantern alive; survive the timer).
Combat rooms have spike traps that pop up every 4 seconds. The boss room
(the farthest dead end) holds the Phantom King, scaled up each stage; beating it
opens a portal to the next stage, and after stage 3 the run is won. Later stages
scale enemy hp and damage and add stage-exclusive enemies (necromancer, reaper
and minigunner from stage 2; zombie soldier and skeleton sorcerer in stage 3).

**Coins**: enemies drop coins (tougher ones drop more; summoned ones rarely), the boss
drops a pile, and every cleared room leaves a chest worth 5 coins. Coins last for the
whole run. Spend them in the **shop**: talk to Mira the shopkeeper and she opens her
wares, six stat upgrades (max HP, regen, attack speed, damage, move speed, plus one
for your hero: mana regen, energy regen, an extra light orb, or faster abilities).
Each can be bought 3 times per run and gets pricier each time. In defend rooms,
enemies chase you once they spot you and go back for the lantern if you outrun them.

The restaurant (its chef just chats for now), special rooms (blacksmith, wishing well, hero statue,
5 star restaurant, mount / dark / friendly traders, treasure, helper), puzzle rooms
and a secret room (reached only by jumping into a glowing hole in one combat room's floor; a rope of light takes you back up) can be found
but do nothing yet: items, food, free upgrades and gems are not in.

## Practice range

Walk onto the practice range pad in the lobby and press E. A training dummy shows your DPS
(top of the screen), and the panel on the right lets you switch hero, spawn
any enemy or either boss, clear the arena, fill your ultimate, and toggle
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
coins and shop upgrades, a reward chest holds 5 coins per hero, and fallen heroes
spectate and get back up at the next stage. The practice range is single player only.

How it works: connections are peer to peer (WebRTC via the free PeerJS service, which
only introduces the players). Every machine runs the same simulation; the host
collects everyone's input 60 times a second and sends it out in numbered bundles,
and gameplay randomness is seeded so it comes out the same everywhere. Periodic
checksums warn the host if a machine drifts out of sync. Some strict school or office
networks block peer-to-peer connections.

## Settings

**Settings** (main menu or pause menu) has mouse sensitivity, music on/off,
music and sound effect volume, and key bindings for movement, E, F, Q, dodge,
potion, interact and the music toggle (LMB / RMB stay on the mouse). Settings
are saved in the browser. While playing, the game locks the mouse pointer so
sensitivity can apply; press Esc to get the cursor back (this pauses).

Music: the main menu, lobby (a slower lo-fi loop), battle and boss each have
their own track.

## Controls

WASD to move, mouse to aim, left click for the primary attack (hold to repeat),
right click for the secondary ability, E and F for class abilities, Q for the
ultimate (it charges as you deal damage), Shift to dodge, H to drink a health
potion (+40 hp, starts regen, 40s cooldown), Esc to pause, M to
toggle music (a toast shows ON / OFF). The Mage spends mana, the Rogue spends energy and the Priestess
spends light orbs (bar under HP).

## Project layout

```
index.html              screens + script load order
css/style.css           menu / UI styling
js/
  config.js             ALL balance numbers (HP, damage, cooldowns, waves, boss)
  main.js               entry point, screen flow, main loop
  core/                 utils, settings (saved), input (key bindings), audio (SFX + music), camera
  gfx/                  procedural pixel art: heroes, enemies, boss, items, tiles
  world/dungeon.js      arena map, wall collision, torches
  world/floor.js        generated dungeon floors (rooms, hallways, locked doors, chunked art)
  entities/
    entity.js           shared base (position, knockback, hit flash)
    projectile.js       configurable projectile (homing, bouncing, piercing)
    effects.js          particles, damage numbers, attack telegraphs
    pickup.js           heart, mana, light and buff orb drops
    player/             Player base + Knight (warrior.js), Archer (ranger.js), Mage, Rogue, Priestess
    enemies/            Enemy base + Zombie, Slime, Wraith, Skeleton, UndeadKnight,
                        Gravestone (raises zombies/skeletons), Ghost (slowing aura),
                        Mimic (tough lunging chest, drops regen/speed/power buffs),
                        graveyard.js (the Graveyard theme's new enemies)
    boss/golem.js       Clay Golem (parts, phases, attacks)
    boss/phantom.js     Phantom King (dash, eye lasers, vanish + pull shockwaves)
  game/                 Game world, wave director, lobby hub, dungeon run (rooms + objectives), HUD
  ui/menus.js           DOM menus + lobby panels (hero, workshop, dungeon, legend)
  ui/bestiary.js        bestiary book (entries, filters, page flips)
  ui/dialog.js          NPC dialogue box (typewriter text, choices)
  net/net.js            peer-to-peer connections (PeerJS): host / join by room code
  net/session.js        multiplayer lockstep: input bundles, commands, scenes, desync checks
  game/upgrades.js      shop upgrades + the shop window
  game/decor.js         dungeon set dressing (trees, lamps, crows, campfire, shop furniture)
```

## Tuning

Every number you might want to tweak is in `js/config.js`, including hero
stats, enemy stats and telegraph (`windup`) times, the wave list and per-wave
scaling, boss odds, passive regen, and all Clay Golem and Phantom King timings
and damage.

## Adding a class

1. Add stats in `CONFIG.classes`, including `ult.charge` and an optional `resource`.
2. Add a `drawX(p, pose)` sprite function in `js/gfx/heroSprites.js` and register it in `buildHeroSprites()`.
3. Create `js/entities/player/x.js` extending `Player` with `primary()`, `secondary()`,
   `abilityE()`, `abilityF()` and `ultimate()`. Override `absorb()` for blocks/shields.
4. Register it in `createHero()` (`player.js`), in `CLASS_INFO` (`menus.js`), and add the script tag in `index.html`.
   It gets a statue in the lobby automatically.
