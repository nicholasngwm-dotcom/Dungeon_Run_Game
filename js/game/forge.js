// The blacksmith's forge: an enhancement for the hero's weapon, kept for the rest of the run.
// Each hero has one kind (FORGE_ITEMS) in four rarities: rare (blue), epic (purple), legendary
// (gold) and mythical (shining red): the same boost as legendary plus a perk of its own.
// A weapon holds one enhancement at a time; forging another lets the hero keep either.
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
    stat: (v) => `+${v} damage on every basic attack hit.`,
    perk: 'So sharp it cuts deep: basic attacks make enemies bleed.',
    bleed: { dps: 12, time: 3 },
  },
  quiver: {
    name: 'Quiver', heroes: ['ranger', 'rocketeer'], values: [0.05, 0.1, 0.15, 0.15],
    stat: (v) => `+${Math.round(v * 100)}% attack speed.`,
    perk: 'Every shot also fires 2 weaker shots at a diagonal to it.',
    spread: 0.42, weak: 0.5,
  },
  gemstone: {
    name: 'Gemstone', heroes: ['mage'], values: [1, 2, 3, 3],
    stat: (v) => `Magic missiles cost ${v} less mana.`,
    perk: 'Every 5th magic missile bursts with magic, hurting everything round where it lands.',
    burst: { every: 5, radius: 64, damage: 30 },
  },
  tome: {
    name: 'Holy Tome', heroes: ['priestess', 'bard'], values: [7, 6, 5, 5],
    stat: (v) => `Every ${v}th basic attack stuns what it hits for a moment.`,
    perk: 'Enemies it stuns are slowed for 3 seconds after the stun wears off.',
    stun: 0.6, slow: { amount: 0.4, time: 3 },
  },
  whisk: {
    name: 'Whisks', heroes: ['baker'], values: [20, 30, 40, 40],
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

  /** Pays for a forge: the first enhancement goes straight on; with one on already, the hero chooses which to keep. */
  forge(run, hero) {
    const price = this.price(run, hero);
    const ok = !hero.forgePending && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      const f = { item: this.itemFor(hero.classId), rarity: this.rollRarity() };
      if (hero.forged) hero.forgePending = f;
      else this.bind(run, hero, f);
      this.anvilFx(run, hero, f);
    }
    run.world.events.onPurchase?.(hero, 'forge', ok);
  },

  /** The choice after a forge: keep the new enhancement ('new') or the one already on the weapon. */
  keep(run, hero, which) {
    const f = hero.forgePending;
    if (!f) return;
    hero.forgePending = null;
    if (which === 'new') {
      this.unequip(hero);
      this.bind(run, hero, f);
    }
    run.world.events.onPurchase?.(hero, 'forgeKeep', true);
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

  /** One enhancement's card: its icon in a ring of its rarity's colour, the boost, and the mythical perk. */
  card(f, i, label, button, cls = '') {
    const R = FORGE_RARITIES[f.rarity];
    const I = FORGE_ITEMS[f.item];
    const perk = f.rarity === 'mythical' ? `<span class="forge-perk">${I.perk}</span>` : '';
    return `<div class="shop-card magic forge-card rarity-${f.rarity}${cls}" style="--glow:${R.color};--delay:${i * 0.4}s">
      <i class="hero-tag forge-tag">${label}</i><div class="rune-ring"></div>
      <canvas data-forge="${f.item}"></canvas>
      <b style="color:${R.color}">${this.title(f)}</b>
      <span>${I.stat(this.value(f))}</span>${perk}
      ${button}
    </div>`;
  },

  render(shop, grid, p) {
    const run = shop.run;
    const extra = document.getElementById('shop-extra');
    const item = FORGE_ITEMS[this.itemFor(p.classId)];
    const pending = p.forgePending;
    if (pending) {
      const cards = [];
      if (p.forged) cards.push(this.card(p.forged, 0, 'ON YOUR WEAPON', '<button class="buy" data-action="forgeKeep:old">KEEP THIS</button>'));
      cards.push(this.card(pending, 1, 'FRESH FROM THE FORGE', '<button class="buy" data-action="forgeKeep:new">KEEP THIS</button>', ' enchant'));
      grid.innerHTML = cards.join('');
      extra.innerHTML = '<p class="shop-note">Your weapon can only hold one. Choose which to keep - the other is melted down.</p>';
    } else {
      const price = this.price(run, p);
      const full = Math.round(CONFIG.run.blacksmith.price * run.priceScale);
      const now = p.forged
        ? this.card(p.forged, 0, 'ON YOUR WEAPON', '<button class="buy" disabled>EQUIPPED</button>')
        : `<div class="shop-card magic faded forge-card"><span class="shop-empty">Your ${CONFIG.classes[p.classId].name}'s weapon has no enhancement yet.</span></div>`;
      const w = CONFIG.run.blacksmith.rarity;
      const total = FORGE_ORDER.reduce((s, k) => s + w[k], 0);
      const odds = FORGE_ORDER.map((k) => `<em style="color:${FORGE_RARITIES[k].color}">${FORGE_RARITIES[k].name} ${Math.round((w[k] / total) * 100)}%</em>`).join('');
      const forge = `<div class="shop-card magic forge-card forge-new" style="--glow:#ff9a3a;--delay:0.4s">
        <i class="hero-tag forge-tag">FORGE</i><div class="rune-ring"></div>
        <canvas data-forge="${this.itemFor(p.classId)}"></canvas>
        <b style="color:#ffb84a">${item.name}</b>
        <span>${item.stat(item.values[0])} Better at higher rarities.</span>
        <span class="forge-odds">${odds}</span>
        <span class="forge-perk">Mythical: ${item.perk}</span>
        <button class="buy" data-action="forge" ${p.coins < price ? 'disabled' : ''}>${shop.priceTag(price, full)}</button>
      </div>`;
      grid.innerHTML = now + forge;
      extra.innerHTML = '';
    }
    for (const c of grid.querySelectorAll('canvas[data-forge]')) {
      const img = Sprites.forge[c.dataset.forge];
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
    }
    document.getElementById('shop-hint').textContent = 'An enhancement stays on your weapon for the rest of the run. Forging again lets you choose between the old one and the new. Mythical ones shine red and carry a perk of their own.';
  },
};

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
