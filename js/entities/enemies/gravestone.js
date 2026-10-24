// Gravestone: a stationary, solid headstone. Every few seconds it raises a
// zombie or skeleton beside it (up to a cap of living ones). When it breaks,
// 1-3 ghosts rise out of it.

class Gravestone extends Enemy {
  constructor(x, y) {
    super('gravestone', x, y);
    this.anchor = GRAVE_SPRITE;
    this.hitOffY = 22;
    this.barOffset = 52;
    this.hw = 16;
    this.hh = 8;
    this.immovable = true;
    this.spawnTimer = this.cfg.firstSpawn;
    this.pending = 0;      // summons still in their summoning circle
    this.shakeTime = 0;
    this.gibColors = ['#545266', '#383646', '#747288', '#4a3426'];
  }

  knockback() {} // it's a slab of stone

  think(dt, world) {
    const c = this.cfg;
    this.shakeTime -= dt;

    // solid: push heroes and clones out of the stone
    for (const a of world.allies) {
      if (a.prop) continue;   // (a barrel stays where it stands)
      const d = dist(a.x, a.y, this.x, this.y);
      const min = this.radius + a.hw;
      if (d >= min || d === 0) continue;
      const ang = angleTo(this.x, this.y, a.x, a.y);
      world.dungeon.move(a, Math.cos(ang) * (min - d), Math.sin(ang) * (min - d));
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = c.spawnInterval;
    const alive = world.enemies.filter((e) => e.owner === this && !e.dead).length + this.pending;
    if (alive < c.maxAlive && world.summonRoom(this) > 0) this.summon(world);
  }

  summon(world) {
    const a = choose([0.2, Math.PI - 0.2, Math.PI / 2]) + rand(-0.4, 0.4);
    const x = this.x + Math.cos(a) * 46;
    const y = this.y + 6 + Math.sin(a) * 30;
    this.pending++;
    this.shakeTime = 0.45;
    // in a dungeon run, tombstones raise whatever undead the theme lists
    world.summon(this, choose(world.run ? world.run.summonPool : this.cfg.spawnTypes), x, y, () => { this.pending--; });
    world.effects.burst(this.x, this.y, { count: 8, colors: ['#4a3426', '#6a4c36', '#3a8a5a'], speed: [30, 90], life: [0.3, 0.5], up: 40, gravity: 200 });
    Sound.play('graveRumble', 0.2);
  }

  die(world) {
    this.dead = true;
    world.effects.burst(this.hx, this.hy, { count: 26, colors: this.gibColors, speed: [60, 200], life: [0.3, 0.8], size: [2, 6], gravity: 300, up: 60 });
    world.effects.burst(this.hx, this.hy, { count: 14, colors: ['#8affb0', '#daf2ff'], speed: [20, 80], life: [0.5, 0.9], up: 50 });
    world.shake(4, 0.25);
    Sound.play('impact');
    Sound.play('ghostWail', 0.2);
    world.maybeDropHeart(this.x, this.y, this.cfg.heartChance);
    world.maybeDropMana(this.x, this.y);
    const [min, max] = this.cfg.ghosts;
    const n = randInt(min, max);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.4, 0.4);
      const pt = world.dungeon.freePoint(this.x + Math.cos(a) * 22, this.y + Math.sin(a) * 14, 10, 7);
      world.addEnemy(createEnemy('ghost', pt.x, pt.y));
    }
  }

  currentFrame() {
    return this.frames.idle[this.hp < this.maxHp * 0.5 ? 1 : 0];
  }

  drawGround(ctx) {
    drawShadow(ctx, this.x, this.y - 1, 22, 6, 0.35);
    // eerie glow on the mound just before something climbs out
    if (this.spawnTimer < 0.6 || this.shakeTime > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 40);
      g.addColorStop(0, 'rgba(120, 255, 160, 0.3)');
      g.addColorStop(1, 'rgba(120, 255, 160, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x - 40, this.y - 40, 80, 80);
      ctx.restore();
    }
  }

  draw(ctx) {
    const shake = this.shakeTime > 0 ? rand(-1.5, 1.5) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    this.drawFrame(ctx, this.currentFrame(), { x: GRAVE_SPRITE.ax, y: GRAVE_SPRITE.ay }, this.spawnAlpha, false);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
