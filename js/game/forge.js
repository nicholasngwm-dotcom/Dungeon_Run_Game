// The blacksmith's forge: an attachment for the hero's weapon, kept for the rest of the run.
// Each hero has one kind (FORGE_ITEMS) in four rarities: rare (blue), epic (purple), legendary
// (gold) and mythical (shining red): the same boost as legendary plus a perk of its own.
// The forge window only shows what Borin can make; forging plays a hammering animation and then
// reveals the rarity (gacha style); then the hero takes it (it goes onto the weapon, and an old one
// drops on the floor by the anvil) or denies it (it's destroyed: nothing drops). It sits in a slot over
// the weapon's HUD button (HUD.drawForgeSlot / Touch), and dragging it out of the slot drops it (a
// ForgePickup, which any hero whose weapon takes that kind can pick up into an empty slot). At most
// FLOOR_MAX lie on the floor at once: a new drop deletes the oldest.
//
// Basic attacks: every hero's primary() is wrapped (createHero -> Forge.attack), so each basic
// attack is counted and carries a tag ({ owner, n, ... }) to whatever it hits: the swing itself,
// and the shots, rays and cakes it throws (Game.basicHit is set to the tag while they act). The
// enhancements and the Dark Minions upgrade work off those tags (Game.damageTarget -> onBasicHit).

const FORGE_RARITIES = {
  rare: { name: 'Rare', color: '#5aa8ff', rank: 0 },
  epic: { name: 'Epic', color: '#b45aff', rank: 1 },
  legendary: { name: 'Legendary', color: '#ffd34a', rank: 2 },
  mythical: { name: 'Mythical', color: '#ff3a4a', rank: 3 },
};
const FORGE_ORDER = ['rare', 'epic', 'legendary', 'mythical'];

// value: the boost at each rarity (rare, epic, legendary, mythical); stat(v) says what it does
const FORGE_ITEMS = {
  stone: {
    name: 'Sharpening Stone', heroes: ['warrior', 'rogue'], values: [2, 3, 4, 4],
    blurb: 'Hones your blade: every basic attack hit deals extra damage.',
    stat: (v) => `+${v} damage on every basic attack hit.`,
    perk: 'So sharp it cuts deep: basic attacks make enemies bleed.',
    bleed: { dps: 12, time: 3 },
  },
  quiver: {
    name: 'Quiver', heroes: ['ranger', 'rocketeer'], values: [0.05, 0.1, 0.15, 0.15],
    blurb: 'A better draw: your basic attacks come faster.',
    stat: (v) => `+${Math.round(v * 100)}% attack speed.`,
    perk: 'Every shot also fires 2 weaker shots at a diagonal to it.',
    spread: 0.42, weak: 0.5,
  },
  gemstone: {
    name: 'Gemstone', heroes: ['mage'], values: [1, 2, 3, 3],
    blurb: 'Set into your staff: magic missiles cost less mana.',
    stat: (v) => `Magic missiles cost ${v} less mana.`,
    perk: 'Every 5th magic missile bursts with magic, hurting everything round where it lands.',
    burst: { every: 5, radius: 64, damage: 30 },
  },
  tome: {
    name: 'Holy Tome', heroes: ['priestess', 'bard'], values: [7, 6, 5, 5],
    blurb: 'Blessed words: every few basic attacks stun what they hit.',
    stat: (v) => `Every ${v}th basic attack stuns what it hits for a moment.`,
    perk: 'Enemies it stuns are slowed for 3 seconds after the stun wears off.',
    stun: 0.6, slow: { amount: 0.4, time: 3 },
  },
  whisk: {
    name: 'Whisks', heroes: ['baker'], values: [20, 30, 40, 40],
    blurb: 'A spare whisk: every 3rd attack also throws one straight ahead.',
    stat: (v) => `Every 3rd attack also throws a whisk straight ahead for ${v} damage.`,
    perk: 'Iced whisks: enemies they hit are slowed for 3 seconds.',
    every: 3, speed: 470, slow: { amount: 0.45, time: 3 },
  },
};

const Forge = {
  /** Which enhancement the blacksmith forges for this hero. */
  itemFor(classId) { return Object.keys(FORGE_ITEMS).find((k) => FORGE_ITEMS[k].heroes.includes(classId)) || 'stone'; },

  /** An enhancement's boost ({ item, rarity }). */
  value(f) { return FORGE_ITEMS[f.item].values[FORGE_RARITIES[f.rarity].rank]; },

  /** Its full name: "Epic Quiver". */
  title(f) { return `${FORGE_RARITIES[f.rarity].name} ${FORGE_ITEMS[f.item].name}`; },

  isMythical(p) { return p.forged?.rarity === 'mythical'; },

  /** What a forge costs this hero here: dearer each stage, cheaper with Discount Cards. */
  price(run, hero) { return Math.round(CONFIG.run.blacksmith.price * run.priceScale * Upgrades.priceScale(hero)); },

  rollRarity() {
    const w = CONFIG.run.blacksmith.rarity;
    let r = Math.random() * FORGE_ORDER.reduce((s, k) => s + w[k], 0);
    return FORGE_ORDER.find((k) => (r -= w[k]) < 0) || 'rare';
  },

  /** The enhancement goes onto the weapon (only the Quiver changes a stat; the rest act on hits). */
  equip(p, f) {
    p.forged = { item: f.item, rarity: f.rarity };
    if (f.item === 'quiver') p.attackSpeed *= 1 + this.value(f);
  },

  unequip(p) {
    const f = p.forged;
    if (!f) return;
    if (f.item === 'quiver') p.attackSpeed /= 1 + this.value(f);
    p.forged = null;
  },

  /** Mana the Gemstone takes off each magic missile. */
  manaCut(p) { return p.forged?.item === 'gemstone' ? this.value(p.forged) : 0; },

  // ---------- the blacksmith's commands (every machine applies them on the same tick) ----------

  /**
   * Pays for a forge: the new attachment goes straight onto the weapon (the forge window plays its
   * hammering and reveal meanwhile); one already on it drops on the floor by the anvil.
   */
  forge(run, hero) {
    const price = this.price(run, hero);
    const smith = Specials.propHere(run, hero, 'blacksmith');
    const ok = !!smith && !hero.dead && !hero.forgePending && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      // it waits on the anvil until the hero takes it or turns it down (keep)
      hero.forgePending = { item: this.itemFor(hero.classId), rarity: this.rollRarity() };
      this.anvilFx(run, hero, hero.forgePending);
    }
    run.world.events.onPurchase?.(hero, 'forge', ok);
  },

  /**
   * The choice after a forge: 'take' attaches it (the old one drops by the anvil); 'deny' destroys it
   * (nothing drops, and the weapon keeps what it had).
   */
  keep(run, hero, take) {
    const f = hero.forgePending;
    if (!f) return;
    hero.forgePending = null;
    if (take) {
      const smith = Specials.propHere(run, hero, 'blacksmith');
      if (hero.forged) this.dropAt(run.world, hero.forged, (smith || hero).x - 30, (smith || hero).y + 34);
      this.unequip(hero);
      this.bind(run, hero, f);
    } else {
      run.world.effects.smoke(hero.x, hero.y - 20, { count: 5, radius: 10, life: 0.5, rise: 16 });
    }
    run.world.events.onPurchase?.(hero, take ? 'forgeTake' : 'forgeDeny', true);
  },

  /** The attachment dragged out of its slot: it comes off the weapon and lands on the floor at the hero's feet. */
  drop(world, hero) {
    const f = hero.forged;
    if (!f || hero.dead) return;
    this.unequip(hero);
    this.dropAt(world, f, hero.x + hero.facing * 22, hero.y + 6);
    world.effects.text(hero.hx, hero.hy - 36, `${this.title(f).toUpperCase()} DROPPED`, { color: FORGE_RARITIES[f.rarity].color, size: 7 });
    Sound.play('blockClang', 0.1);
  },

  /** An attachment lying on the floor (ForgePickup), clear of walls. */
  dropAt(world, f, x, y) {
    // at most FLOOR_MAX lying about the floor: the oldest goes to make room
    const lying = world.pickups.filter((k) => k instanceof ForgePickup && !k.dead);
    for (let i = 0; i <= lying.length - this.FLOOR_MAX; i++) {
      const old = lying[i];
      old.dead = true;
      world.effects.smoke(old.x, old.y - 10, { count: 4, radius: 8, life: 0.4, rise: 12 });
    }
    const pt = world.dungeon.freePoint(x, y, 6, 4);
    const k = new ForgePickup(pt.x, pt.y, f);
    k.cooldown = 1;   // (so walking about where it fell doesn't snatch it straight back)
    world.pickups.push(k);
    world.effects.burst(pt.x, pt.y - 8, { count: 12, colors: [FORGE_RARITIES[f.rarity].color, '#ffffff'], speed: [30, 100], life: [0.2, 0.45], up: 30 });
  },

  bind(run, hero, f) {
    this.equip(hero, f);
    run.enchantFx(hero, { color: FORGE_RARITIES[f.rarity].color, name: this.title(f) });
  },

  /** Sparks fly off the blacksmith's anvil in the new enhancement's colour. */
  anvilFx(run, hero, f) {
    const w = run.world;
    const smith = run.props.find((pr) => pr.kind === 'blacksmith' && pr.room === run.floor.roomAt(hero.x, hero.y));
    if (!smith) return;
    const c = FORGE_RARITIES[f.rarity].color;
    w.effects.burst(smith.x + 24, smith.y - 18, { count: 30, colors: [c, '#ffd34a', '#fff6c8', '#ffffff'], speed: [60, 220], life: [0.3, 0.7], up: 60 });
    w.effects.text(smith.x + 24, smith.y - 50, this.title(f).toUpperCase(), { color: c, size: 8, life: 1.6 });
    Sound.play('blockClang');
  },

  // ---------- basic attacks ----------

  /** A hero's primary() runs through here (see createHero): counts it and tags what it throws. */
  attack(p, world, fn) {
    const f = p.forged;
    const n = (p.basicAttacks || 0) + 1;
    const tag = { owner: p, n };
    if (f?.item === 'tome' && n % this.value(f) === 0) tag.stun = true;
    const cd = p.cooldowns.primary;
    const before = world.playerProjectiles.length;
    const rays = p.rays?.length || 0;
    const lobs = p.lobs?.length || 0;
    const prev = world.basicHit;
    world.basicHit = tag;
    try { fn(); } finally { world.basicHit = prev; }
    if (!(p.cooldowns.primary > cd)) return;   // nothing went out (the Rogue starting her storm)
    const shots = world.playerProjectiles.slice(before).filter((s) => s.owner === p && !s.basic);
    const newRays = p.rays ? p.rays.slice(rays) : [];
    const newLobs = p.lobs ? p.lobs.slice(lobs) : [];
    if (!shots.length && !newRays.length && !newLobs.length && p.classId !== 'warrior') return;   // refused (short of mana or energy)
    p.basicAttacks = n;
    for (const s of shots) s.basic = tag;
    for (const r of newRays) r.tag = tag;
    for (const l of newLobs) l.tag = tag;
    if (f) this.afterAttack(p, world, tag, shots);
    Upgrades.basicAttack(p, world);
  },

  /** The mythical perks that add to an attack as it goes out, and the Baker's whisks. */
  afterAttack(p, world, tag, shots) {
    const f = p.forged;
    const I = FORGE_ITEMS[f.item];
    const mythic = f.rarity === 'mythical';
    if (f.item === 'quiver' && mythic) {
      const side = { ...tag, scale: I.weak, diag: true };
      for (const s of shots) for (const a of [-I.spread, I.spread]) world.playerProjectiles.push(this.cloneShot(s, a, side));
    }
    if (f.item === 'gemstone' && mythic && tag.n % I.burst.every === 0) {
      for (const s of shots) {
        const was = s.onHit;
        s.scale = (s.scale || 1) * 1.4;
        s.glow = '200, 140, 255';
        s.onHit = (pr, w, hit) => {
          if (was) was(pr, w, hit);
          else w.effects.burst(pr.x, pr.y, { count: 5, colors: pr.trail || ['#ffffff'], speed: [30, 90], life: [0.1, 0.3] });
          this.magicBurst(p, pr.x, pr.y, hit, w);
        };
      }
    }
    if (f.item === 'whisk' && tag.n % I.every === 0) this.throwWhisk(p, world, mythic);
  },

  /** A copy of a shot, turned `angle` off its line (the mythical Quiver's diagonal shots). */
  cloneShot(s, angle, tag) {
    const speed = Math.hypot(s.vx, s.vy);
    const a = Math.atan2(s.vy, s.vx) + angle;
    return new Projectile({
      ...s, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, hitSet: null, basic: tag,
      bounces: s.bounces - Upgrades.extraBounces(s.owner),   // (the constructor adds Bouncy! again)
      scale: (s.scale || 1) * 0.8, pierce: Math.max(0, (s.pierce || 0) - 1),
    });
  },

  /** The mythical Gemstone's 5th missile bursts in a ring of violet magic where it lands. */
  magicBurst(p, x, y, hit, world) {
    const b = FORGE_ITEMS.gemstone.burst;
    for (const t of world.getTargets()) {
      if (t === hit || dist(x, y, t.hx, t.hy) > b.radius + t.radius) continue;
      world.damageTarget(t, b.damage, { source: p, angle: angleTo(x, y, t.hx, t.hy), knockback: 90, sound: null, color: '#c8a0ff' });
    }
    world.effects.add(0.4, (ctx, t) => {
      const e = 1 - (1 - t) ** 3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, b.radius * (0.5 + e * 0.5), '180, 120, 255', 0.9 * (1 - t), 2);
      PFX.ring(ctx, x, y, b.radius * e, b.radius * 0.55 * e, `rgba(224, 200, 255, ${1 - t})`, 2, { thick: t < 0.4 ? 3 : 1 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 3;
        PFX.star(ctx, x + Math.cos(a) * b.radius * e * 0.8, y + Math.sin(a) * b.radius * e * 0.44, 2, '#c8a0ff', '#ffffff', 1);
      }
      ctx.restore();
    });
    world.effects.burst(x, y, { count: 18, colors: ['#e0c8ff', '#9cf0d8', '#ffffff', '#a070e0'], speed: [60, 180], life: [0.2, 0.45] });
    Sound.play('magic', 0.08);
  },

  /** Whisks: a whisk spun straight down the aim from the Baker's free hand (iced at mythical). */
  throwWhisk(p, world, iced) {
    const I = FORGE_ITEMS.whisk;
    const a = p.aim;
    const tag = { owner: p, extra: true, iced };
    world.playerProjectiles.push(new Projectile({
      x: p.pivotX + Math.cos(a) * 12, y: p.pivotY + Math.sin(a) * 12,
      vx: Math.cos(a) * I.speed, vy: Math.sin(a) * I.speed,
      radius: 6, damage: this.value(p.forged), life: 0.9, knockback: 70, pierce: 1, spin: 16,
      sprite: Sprites.projectiles.whisk, trail: iced ? ['#ffffff', '#c8ecff'] : ['#e8e0d0', '#c8b898'],
      glow: iced ? '200, 236, 255' : null, basic: tag,
    }));
    Sound.play('cakeThrow', 0.04);
  },

  /** Extra damage a basic attack's hit gets (the Sharpening Stone). */
  bonus(src, tag) {
    if (tag.extra || src.forged?.item !== 'stone') return 0;
    return this.value(src.forged);
  },

  /** A basic attack (tag) landed on `target`: the enhancement's on-hit effect, and Dark Minions. */
  onBasicHit(src, target, tag, world) {
    if (tag.iced && !target.dead) this.slow(target, FORGE_ITEMS.whisk.slow, world, 'ICED');
    if (tag.extra) return;
    Upgrades.basicHit(src, target, world);
    const f = src.forged;
    if (!f || target.dead || target.prop) return;
    if (f.item === 'stone' && f.rarity === 'mythical') {
      const b = FORGE_ITEMS.stone.bleed;
      const d = world.dots.find((x) => x.target === target && x.kind === 'bleed' && x.source === src);
      if (d) d.t = Math.max(d.t, b.time);
      else {
        world.addDot(target, b.dps, b.time, '#ff4a5a', 'bleed');
        world.dots[world.dots.length - 1].source = src;
        world.effects.text(target.hx, target.hy - 34, 'BLEEDING', { color: '#ff4a5a', size: 7 });
      }
    }
    if (tag.stun && f.item === 'tome') {
      const I = FORGE_ITEMS.tome;
      if (target.stun && !world.isBossTarget(target)) {
        target.stun(I.stun);
        world.effects.text(target.hx, target.hy - 34, 'HOLY STUN', { color: '#fff2a0', size: 7 });
        if (f.rarity === 'mythical') this.slow(target, { amount: I.slow.amount, time: I.stun + I.slow.time });
      }
      world.effects.burst(target.hx, target.hy - 6, { count: 8, colors: ['#fff6c8', '#ffe680', '#ffffff'], speed: [30, 100], life: [0.2, 0.4], up: 30 });
    }
  },

  /** Slows an enemy (plain enemies only: bosses ignore it), the stronger slow winning while two run. */
  slow(target, s, world = null, label = null) {
    if (!target.petSlowed) return;
    target.petSlowed(s.amount, s.time);
    if (label && world) world.effects.text(target.hx, target.hy - 34, label, { color: '#c8ecff', size: 7 });
  },

  // ---------- the forge window (Shop, mode 'forge') ----------

  /** The most attachments lying on the floor at once (a new drop deletes the oldest). */
  FLOOR_MAX: 3,

  /** Seconds of hammering before the rarity is revealed, and before "TAKE IT" shows. */
  REVEAL_AT: 2.1,
  DONE_AT: 2.7,

  /**
   * Just the attachment Borin can forge for this hero and its price. With one fresh off the anvil
   * (hero.forgePending), its reveal and the choice: take it or deny it. A forge just paid for
   * (shop.forgeReveal) plays the hammering first; reopening the window with one still waiting shows it straight away.
   */
  render(shop, grid, p) {
    const extra = document.getElementById('shop-extra');
    const hint = document.getElementById('shop-hint');
    const f = p.forgePending;
    const id = f ? f.item : this.itemFor(p.classId);
    const item = FORGE_ITEMS[id];
    if (f) {
      grid.innerHTML = this.revealHtml(f, p, !shop.forgeReveal);
      extra.innerHTML = '';
      hint.textContent = 'TAKE IT puts it on your weapon (the slot over your attack button). DENY destroys it: nothing drops, and your weapon keeps what it has.';
    } else {
      const price = this.price(shop.run, p);
      const full = Math.round(CONFIG.run.blacksmith.price * shop.run.priceScale);
      grid.innerHTML = `<div class="shop-card magic forge-card forge-offer" style="--glow:#ff9a3a">
        <i class="hero-tag forge-tag">ATTACHMENT</i><div class="rune-ring"></div>
        <canvas data-forge="${id}"></canvas>
        <b style="color:#ffb84a">${item.name}</b>
        <span>${item.blurb}</span>
        <button class="buy" data-action="forge" ${p.coins < price ? 'disabled' : ''}>FORGE &nbsp;${shop.priceTag(price, full)}</button>
      </div>`;
      extra.innerHTML = '';
      hint.textContent = 'Every forge comes out a surprise: take it or turn it down. Drag an attachment out of its slot to drop it.';
    }
    for (const c of grid.querySelectorAll('canvas[data-forge]')) {
      const img = Sprites.forge[c.dataset.forge];
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
    }
  },

  /**
   * The forge playing out (CSS-timed): the attachment glowing hot on the anvil under hammer blows,
   * sparks flying, then a flash and the card flips up in its rarity's colour, rays wheeling behind it,
   * with TAKE IT and DENY. instant: skip straight to the card (reopening the window with one still waiting).
   */
  revealHtml(f, p, instant = false) {
    const R = FORGE_RARITIES[f.rarity];
    const I = FORGE_ITEMS[f.item];
    const perk = f.rarity === 'mythical' ? `<span class="forge-perk">${I.perk}</span>` : '';
    const sparks = Array.from({ length: 16 }, (_, k) => `<i class="forge-spark" style="--a:${(k * 137) % 360}deg;--d:${(k % 4) * 0.5 + 0.35}s"></i>`).join('');
    const swap = p.forged ? `Taking it drops your ${this.title(p.forged)} by the anvil.` : 'Taking it puts it on your weapon.';
    return `<div class="forge-reveal rarity-${f.rarity}${instant ? ' instant' : ''}" style="--glow:${R.color};--reveal:${instant ? 0 : this.REVEAL_AT}s;--done:${instant ? 0 : this.DONE_AT}s">
      <div class="forge-anvil">
        <canvas data-forge="${f.item}"></canvas>
        <i class="forge-hammer"></i>${sparks}
      </div>
      <div class="forge-rays"></div>
      <div class="shop-card magic forge-card forge-result rarity-${f.rarity}" style="--glow:${R.color}">
        <i class="hero-tag forge-tag">${R.name.toUpperCase()}</i>
        <canvas data-forge="${f.item}"></canvas>
        <b style="color:${R.color}">${this.title(f)}</b>
        <span>${I.stat(this.value(f))}</span>${perk}
        <em class="forge-equipped">${swap}</em>
        <div class="forge-choice">
          <button class="buy" data-action="forgeKeep:take">TAKE IT</button>
          <button class="buy deny" data-action="forgeKeep:deny">DENY</button>
        </div>
      </div>
    </div>`;
  },

  /** The forge window's sounds while it plays out: hammer blows, then a fanfare to suit the rarity. Looks only. */
  revealSounds(f) {
    const at = (s, fn) => setTimeout(fn, s * 1000);
    for (const s of [0.3, 0.75, 1.2, 1.6]) at(s, () => Sound.play('blockClang'));
    at(this.REVEAL_AT, () => {
      Sound.play(f.rarity === 'rare' ? 'pickup' : 'magic');
      if (FORGE_RARITIES[f.rarity].rank >= 2) Sound.play('victory');
    });
  },
};

/**
 * A weapon attachment lying on the floor (dropped from its slot, or knocked off by a new forge): it
 * floats in a glow of its rarity's colour, and attaches itself to a hero whose weapon takes that kind
 * and has an empty slot when they walk over it.
 */
class ForgePickup extends Pickup {
  constructor(x, y, f) {
    super(x, y);
    this.f = { item: f.item, rarity: f.rarity };
    this.magnet = 26;
    this.lifetime = 99999;
    this.sound = 'magic';
    this.cooldown = 0;
  }

  update(dt, world) {
    this.cooldown -= dt;
    super.update(dt, world);
  }

  wanted(p) { return this.cooldown <= 0 && !p.forged && Forge.itemFor(p.classId) === this.f.item; }

  collect(p, world) {
    Forge.equip(p, this.f);
    const R = FORGE_RARITIES[this.f.rarity];
    world.effects.text(p.hx, p.hy - 40, `${Forge.title(this.f).toUpperCase()} ATTACHED`, { color: R.color, size: 8 });
    world.effects.burst(p.hx, p.hy, { count: 16, colors: [R.color, '#ffffff'], speed: [30, 110], life: [0.3, 0.5], up: 40 });
  }

  draw(ctx) {
    const R = FORGE_RARITIES[this.f.rarity];
    const img = Sprites.forge[this.f.item];
    const x = Math.round(this.x);
    const cy = Math.round(this.y - 16 + Math.sin(this.age * 3) * 2);
    drawShadow(ctx, this.x, this.y + 3, 9, 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, cy, 18 + Math.sin(this.age * 5) * 2, hexToRgb(R.color).join(', '), this.f.rarity === 'mythical' ? 1 : 0.7);
    PFX.ring(ctx, x, this.y, 12, 5, R.color, 1, { dash: [3, 3], spin: this.age * 2 });
    ctx.restore();
    ctx.drawImage(img, x - img.width / 2, cy - img.height / 2);
    HUD.text(ctx, Forge.title(this.f), x, cy - 20, { size: 5, align: 'center', color: R.color });
  }
}

/** The forge's art: Sprites.forge (a 20x20 icon for each enhancement) and the Baker's whisk in flight. */
function buildForgeSprites() {
  const S = RAMP.steel;
  const G = RAMP.gold;
  const L = RAMP.leather;
  const N = 20;
  const icon = (fn) => PixelArt.bevel(PixelArt.make(N, N, fn, OUTLINE));
  const whisk = (p, x, y, s = 1) => {
    // a wooden handle, then a balloon of wire loops
    p.rect(x, y + 6 * s, 6 * s, 2 * s, L[3]);
    p.rect(x, y + 6 * s, 6 * s, 1, L[4]);
    p.rect(x + 6 * s, y + 5 * s, 2 * s, 4 * s, S[3]);
    for (const [dy, c] of [[-3, S[4]], [0, S[5]], [3, S[4]]]) {
      p.ellipse(x + 12 * s, y + 7 * s + dy * s * 0.4, 5 * s, (2 + Math.abs(dy) * 0.3) * s, c);
    }
    p.ellipse(x + 12 * s, y + 7 * s, 3 * s, 1.5 * s, '#2a2434');
  };
  Sprites.forge = {
    stone: icon((p) => {
      // a grey whetstone with a blade being honed across it, sparks flying
      p.poly([[2, 13], [12, 6], [16, 10], [6, 17]], S[2]);
      p.poly([[2, 13], [12, 6], [13, 7], [3, 14]], S[4]);
      p.line(5, 15, 14, 9, S[1]);
      p.line(4, 4, 15, 15, S[5], 2);
      p.line(4, 4, 6, 6, '#ffffff', 1);
      p.rect(2, 2, 3, 3, L[2]);
      for (const [x, y] of [[16, 4], [18, 7], [14, 2]]) p.rect(x, y, 1, 1, G[4]);
      p.rect(17, 5, 1, 1, '#ffffff');
    }),
    quiver: icon((p) => {
      // a leather quiver slung on its strap, three fletched arrows standing out of it
      for (const [x, c] of [[6, '#e84a4a'], [9, '#ffd34a'], [12, '#8cff9a']]) {
        p.rect(x, 1, 2, 8, c);
        p.rect(x + 0.5, 1, 1, 8, S[5]);
      }
      p.round(4, 7, 11, 12, L[2], 3);
      p.rect(5, 8, 3, 10, L[3]);
      p.rect(4, 10, 11, 1, G[3]);
      p.rect(4, 15, 11, 1, G[3]);
      p.line(15, 9, 18, 18, L[1], 1);
    }),
    gemstone: icon((p) => {
      // a cut gem, facets catching the light, a glint on its crown
      p.poly([[4, 7], [7, 3], [13, 3], [16, 7], [10, 18]], '#3a1a6a');
      p.poly([[5, 7], [7.5, 4], [12.5, 4], [15, 7], [10, 16]], '#a070e0');
      p.poly([[5, 7], [15, 7], [10, 16]], '#6a3aa0');
      p.poly([[7.5, 4], [10, 7], [12.5, 4]], '#e0c8ff');
      p.poly([[8, 7], [12, 7], [10, 13]], '#9cf0d8');
      p.rect(8, 5, 1, 1, '#ffffff');
      p.rect(16, 2, 1, 3, '#ffffff');
      p.rect(15, 3, 3, 1, '#ffffff');
    }),
    tome: icon((p) => {
      // a white holy book bound in gold, a cross on its cover, light rays behind it
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        p.line(10, 9, 10 + Math.cos(a) * 9, 9 + Math.sin(a) * 9, '#fff2a0', 1);
      }
      p.round(3, 5, 14, 13, G[2], 2);
      p.round(4, 5, 12, 12, '#f4ecdc', 2);
      p.rect(4, 15, 12, 2, '#d8ccb4');
      p.rect(9, 7, 2, 7, G[3]);
      p.rect(7, 9, 6, 2, G[3]);
      p.rect(4, 5, 1, 12, G[1]);
    }),
    whisk: icon((p) => whisk(p, 0, 2, 1.15)),
  };
  Sprites.projectiles.whisk = PixelArt.make(20, 14, (p) => whisk(p, 0, 0, 1), OUTLINE);
}
