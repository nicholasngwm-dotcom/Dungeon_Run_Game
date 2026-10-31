// What the special rooms' keepers trade (the blacksmith's forge is in forge.js). Each is a command
// (App.command -> Game.applyCommand), so in multiplayer every machine applies it on the same tick;
// it acts on the keeper in the room the hero stands in. World events tell the hero's screen how it
// went (onSpecial: the keeper reacts; the dialogue closes before it's sent).
//   dark trader:     25 hp for a random gift: an upgrade (maybe one of his own dark ones) or potions
//   friendly trader: two random upgrades the hero owns for two others (once per hero per room)
//   mount trader:    a horse, for coins (one per hero)
//   helper room:     hire the camp's hireling (one per hero per room)

const Specials = {
  /** The keeper of this kind in the room the hero is in (null if they've wandered out). */
  propHere(run, hero, kind) {
    const r = run.floor.roomAt(hero.x, hero.y);
    return run.props.find((pr) => pr.kind === kind && pr.room === r) || null;
  },

  /** A keeper's price for this hero: x the stage's shop prices, and Discount Cards. */
  price(run, hero, base) { return Math.round(base * run.priceScale * Upgrades.priceScale(hero)); },

  /** Upgrades this hero is owed but hasn't picked up yet (gift pickups still lying about). */
  pendingGifts(world, hero) {
    return new Set(world.pickups.filter((k) => k instanceof UpgradePickup && k.owner === hero && !k.dead).map((k) => k.id));
  },

  // ---------- the dark trader ----------

  darkTrade(run, hero) {
    const c = CONFIG.run.darkTrader;
    const w = run.world;
    const pr = this.propHere(run, hero, 'darkTrader');
    const ok = !!pr && !hero.dead && hero.hp > c.hp;
    if (!ok) { w.events.onSpecial?.(hero, 'dark', false); return; }
    hero.hp -= c.hp;
    hero.sinceHurt = 0;
    hero.flashTime = 0.15;
    Game.statsOf(hero).taken += c.hp;
    w.effects.text(hero.hx, hero.hy - 30, `-${c.hp} HP`, { color: '#c04aff', size: 10 });
    this.drainFx(w, hero, pr);
    // the gift: an upgrade (dark ones only he sells) or a bottle or few of something
    const pending = this.pendingGifts(w, hero);
    const dark = darkStock(hero).filter((u) => !pending.has(u.id));
    const plain = shopStock(hero).filter((u) => !hero.upgradeLevels[u.id] && !pending.has(u.id));
    if ((dark.length || plain.length) && Math.random() < c.upgradeChance) {
      const pool = dark.length && (!plain.length || Math.random() < c.darkChance) ? dark : plain;
      const u = choose(pool);
      w.after(0.5, () => {
        w.pickups.push(new UpgradePickup(pr.x, pr.y + 34, u.id, hero));
        w.effects.burst(pr.x, pr.y + 10, { count: 40, colors: [u.color, '#1e1430', '#e0c0ff'], speed: [60, 200], life: [0.4, 0.8], up: 70 });
        w.effects.text(pr.x, pr.y - 52, `${u.dark ? 'A DARK GIFT' : 'A GIFT'}: ${u.name.toUpperCase()}`, { color: u.color, size: 8, life: 2 });
        Sound.play('magic');
      });
    } else {
      const all = Object.values(POTIONS);
      let r = Math.random() * all.reduce((s, p) => s + (c.tierWeights[p.tier - 1] || 0), 0);
      const id = (all.find((p) => (r -= c.tierWeights[p.tier - 1] || 0) < 0) || all[0]).id;
      const n = randInt(c.potions[0], c.potions[1]);
      w.after(0.5, () => {
        run.spawnPotions(pr.x, pr.y + 34, n, () => id);
        w.effects.burst(pr.x, pr.y + 10, { count: 30, colors: ['#b45aff', '#1e1430', '#e0c0ff'], speed: [60, 180], life: [0.4, 0.8], up: 70 });
        w.effects.text(pr.x, pr.y - 52, `${n} ${POTIONS[id].name.toUpperCase()}`, { color: '#c48aff', size: 8, life: 1.8 });
        Sound.play('chestOpen');
      });
    }
    w.events.onSpecial?.(hero, 'dark', true);
  },

  /** Red mist pulled out of the hero and into the dark trader's lantern. */
  drainFx(w, hero, pr) {
    const x0 = hero.hx;
    const y0 = hero.hy;
    const x1 = pr.x + 12;
    const y1 = pr.y - 18;
    for (let i = 0; i < 10; i++) {
      const delay = i * 0.04;
      const bend = vrand(-30, 30);
      w.effects.add(0.6 + delay, (ctx, t) => {
        const k = clamp((t * (0.6 + delay) - delay) / 0.6, 0, 1);
        if (k <= 0) return;
        const x = lerp(x0, x1, k) + Math.sin(k * Math.PI) * bend;
        const y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 24;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        PFX.glow(ctx, x, y, 6, k < 0.5 ? '255, 60, 80' : '180, 90, 255', 0.9);
        ctx.restore();
      });
    }
    w.effects.burst(hero.hx, hero.hy, { count: 14, colors: ['#ff4a5a', '#b81e2e', '#b45aff'], speed: [40, 120], life: [0.2, 0.45] });
    Sound.play('phantomVanish', 0.1);
  },

  // ---------- the friendly trader ----------

  /** Upgrades this hero could hand over (not one that can't come off right now, like a full Backpack). */
  tradeable(hero) {
    return Object.keys(hero.upgradeLevels).map((id) => UPGRADE_BY_ID[id]).filter((u) => u && (!u.canSell || u.canSell(hero)));
  },

  friendlyTrade(run, hero) {
    const c = CONFIG.run.friendlyTrader;
    const w = run.world;
    const pr = this.propHere(run, hero, 'friendlyTrader');
    const key = hero.netId || 'solo';
    const give = this.tradeable(hero);
    const ok = !!pr && !hero.dead && !pr.traded?.[key] && give.length >= c.count;
    if (!ok) { w.events.onSpecial?.(hero, 'friendly', false); return; }
    (pr.traded || (pr.traded = {}))[key] = true;
    const out = [];
    for (let i = 0; i < c.count; i++) out.push(give.splice(randInt(0, give.length - 1), 1)[0]);
    for (const u of out) {
      delete hero.upgradeLevels[u.id];
      u.remove?.(hero);
    }
    const offers = shopStock(hero).filter((u) => !hero.upgradeLevels[u.id] && !out.includes(u));
    const got = [];
    for (let i = 0; i < c.count && offers.length; i++) got.push(offers.splice(randInt(0, offers.length - 1), 1)[0]);
    got.forEach((u, i) => w.after(0.3 + i * 0.6, () => run.grantUpgrade(hero, u)));
    w.effects.text(pr.x, pr.y - 52, `TRADED: ${out.map((u) => u.name.toUpperCase()).join(' + ')}`, { color: '#6cff7a', size: 7, life: 2.2 });
    w.effects.burst(pr.x + 40, pr.y - 10, { count: 26, colors: ['#6cff7a', '#ffd34a', '#ffffff'], speed: [50, 160], life: [0.4, 0.8], up: 60 });
    Sound.play('chestOpen');
    w.events.onSpecial?.(hero, 'friendly', true, { out, got });
  },

  // ---------- the mount trader ----------

  buyHorse(run, hero) {
    const c = CONFIG.run.mount;
    const w = run.world;
    const pr = this.propHere(run, hero, 'mountTrader');
    const price = this.price(run, hero, c.price);
    const ok = !!pr && !hero.dead && !hero.horse && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      const h = new Horse(hero);
      const pt = w.dungeon.freePoint(pr.x + 52, pr.y + 30, h.hw, h.hh);
      h.x = pt.x;
      h.y = pt.y;
      hero.horse = h;
      w.horses.push(h);
      w.effects.smoke(h.x, h.y - 6, { count: 8, radius: 16, life: 0.6, rise: 16 });
      w.effects.burst(h.x, h.y - 20, { count: 30, colors: ['#e0b080', '#ffd34a', '#ffffff'], speed: [50, 160], life: [0.4, 0.8], up: 60 });
      w.effects.text(h.x, h.y - 50, 'A HORSE OF YOUR OWN!', { color: '#e0b080', size: 8, life: 2 });
      Sound.play('buy');
    }
    w.events.onSpecial?.(hero, 'horse', ok);
  },

  // ---------- the helper room ----------

  hire(run, hero) {
    const w = run.world;
    const pr = this.propHere(run, hero, 'helper');
    const key = hero.netId || 'solo';
    const c = pr && CONFIG.run.helpers[pr.hire];
    const price = c ? this.price(run, hero, c.price) : Infinity;
    const ok = !!c && !hero.dead && !pr.hired?.[key] && hero.coins >= price;
    if (ok) {
      hero.coins -= price;
      (pr.hired || (pr.hired = {}))[key] = true;
      const [lead] = hireHelper(w, pr.hire, hero, pr.x + 44, pr.y + 18);
      w.effects.text(lead.hx, lead.hy - 40, `${c.name.toUpperCase()} JOINS YOU!`, { color: c.color, size: 8, life: 2 });
      w.effects.burst(lead.hx, lead.hy, { count: 26, colors: [c.color, '#ffffff', '#ffd34a'], speed: [50, 160], life: [0.4, 0.8], up: 60 });
      Sound.play('buy');
    }
    w.events.onSpecial?.(hero, 'hire', ok);
  },
};
