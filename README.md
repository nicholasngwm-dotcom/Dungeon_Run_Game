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

## Practice range

Pick **Practice Range** on the main menu. A training dummy shows your DPS
(top of the screen), and the panel on the right lets you switch hero, spawn
any enemy or either boss, clear the arena, fill your ultimate, and toggle
god mode, infinite mana and infinite energy. Dying respawns you.

## Controls

WASD to move, mouse to aim, left click for the primary attack (hold to repeat),
right click for the secondary ability, E and F for class abilities, Q for the
ultimate (it charges as you deal damage), Shift to dodge, Esc to pause, M to
toggle music. The Mage spends mana and the Rogue spends energy (bar under HP).

## Project layout

```
index.html              screens + script load order
css/style.css           menu / UI styling
js/
  config.js             ALL balance numbers (HP, damage, cooldowns, waves, boss)
  main.js               entry point, screen flow, main loop
  core/                 utils, input, audio (SFX + music), camera
  gfx/                  procedural pixel art: heroes, enemies, boss, items, tiles
  world/dungeon.js      arena map, wall collision, torches
  entities/
    entity.js           shared base (position, knockback, hit flash)
    projectile.js       configurable projectile (homing, bouncing, piercing)
    effects.js          particles, damage numbers, attack telegraphs
    pickup.js           heart drops
    player/             Player base + Warrior, Ranger, Mage, Rogue
    enemies/            Enemy base + Zombie, Slime, Wraith, Skeleton, UndeadKnight,
                        Gravestone (raises zombies/skeletons), Ghost (slowing aura)
    boss/golem.js       Clay Golem (parts, phases, attacks)
    boss/phantom.js     Phantom King (dash, eye lasers, vanish + pull shockwaves)
  game/                 Game world, wave director, HUD
  ui/menus.js           DOM menus + class select cards
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
