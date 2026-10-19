// Mimic: a treasure chest with teeth. Hops slowly toward the hero; once they
// come close it lunges (red lane telegraph), and keeps lunging over and over
// until the hero gets out of range. Very tough and hits hard, but usually
// drops a buff orb when it dies.
//
// States: rest -> hop -> rest ... | windup -> lunge -> recover -> windup ...

class Mimic extends Enemy {
  constructor(x, y) {
    super('mimic', x, y);
    this.hitOffY = 16;
    this.barOffset = 48;
    this.hw = 14;
    this.hh = 8;
    this.state = 'rest';
    this.restTime = rand(0.2, 0.6);
    this.lungeAngle = 0;
    this.lungeLen = 0;
    this.lungeHit = new Set();
    this.gibColors = ['#744420', '#9a6030', '#e8b83a', '#e0507a'];
  }

  think(dt, world) {
    const c = this.cfg;
    const p = this.target(world);
    const d = p.dead ? Infinity : this.distanceTo(p);

    switch (this.state) {
      case 'rest':
        if (d < c.aggroRange) return this.startWindup(p);
        if (this.stateTime >= this.restTime && !p.dead) {
          this.hopAngle = angleTo(this.x, this.y, p.x, p.y);
          this.faceToward(p.x);
          this.setState('hop');
        }
        break;

      case 'hop': {
        this.moveAngle(world, this.hopAngle, c.hopDistance / c.hopTime, dt);
        if (this.stateTime >= c.hopTime) {
          world.effects.burst(this.x, this.y + 4, { count: 4, colors: ['#5a4a3a', '#3a2e24'], speed: [20, 60], life: [0.2, 0.4] });
          Sound.play('slimeLand', 0.15);
          this.restTime = c.hopRest;
          this.setState('rest');
        }
        break;
      }

      case 'windup':
        if (this.stateTime < c.windup - c.aimLockAt && !p.dead) this.aim(world, p);
        if (this.stateTime >= c.windup) {
          this.lungeHit.clear();
          this.setState('lunge');
          Sound.play('heavySwing');
        }
        break;

      case 'lunge': {
        const step = Math.min((this.lungeLen / c.lungeTime) * dt, this.lungeLen - this.lunged);
        const px = this.x;
        const py = this.y;
        world.dungeon.move(this, Math.cos(this.lungeAngle) * step, Math.sin(this.lungeAngle) * step);
        this.lunged += step;
        for (const a of world.allies) {
          if (this.lungeHit.has(a)) continue;
          if (pointSegmentDistance(a.x, a.y, px, py, this.x, this.y) > this.radius + a.radius) continue;
          if (a.hurt(c.damage, world, this.x, this.y)) this.lungeHit.add(a);
        }
        if (this.stateTime >= c.lungeTime || this.lunged >= this.lungeLen - 0.01) {
          if (this.lungeHit.size) Sound.play('slimeSplit');
          world.shake(3, 0.12);
          this.setState('recover');
        }
        break;
      }

      case 'recover':
        if (this.stateTime >= c.recovery) {
          // keeps snapping while the hero is near, otherwise goes back to hopping
          if (d < c.leashRange) this.startWindup(p);
          else {
            this.restTime = 0.2;
            this.setState('rest');
          }
        }
        break;
    }
  }

  startWindup(p) {
    this.setState('windup');
    this.aim(null, p);
    Sound.play('windup');
  }

  /** Lunge straight at the hero, a little past where they stand. */
  aim(world, p) {
    this.lungeAngle = angleTo(this.x, this.y, p.x, p.y);
    this.lungeLen = Math.min(this.cfg.lungeDistance, this.distanceTo(p) + 40);
    this.lunged = 0;
    this.faceToward(p.x);
  }

  /** Stuns cancel the lunge windup like other enemies. */
  stun(duration) {
    if (this.dead || this.state === 'lunge') return;
    this.stunTime = Math.max(this.stunTime || 0, duration * (1 - (this.cfg.stunResist || 0)));
    if (this.state === 'windup') this.setState('rest');
  }

  die(world) {
    this.dead = true;
    world.effects.burst(this.hx, this.hy, { count: 24, colors: this.gibColors, speed: [60, 200], life: [0.3, 0.8], size: [2, 5], gravity: 300, up: 60 });
    world.effects.burst(this.hx, this.hy, { count: 12, colors: ['#ffd34a', '#fff0a0'], speed: [40, 140], life: [0.4, 0.8], size: [2, 3], gravity: 260, up: 90 }); // coins
    world.shake(4, 0.2);
    Sound.play('enemyDie');
    Sound.play('pickup');
    world.maybeDropHeart(this.x - 14, this.y, this.cfg.heartChance);
    world.maybeDropMana(this.x, this.y);
    if (this.secret) {
      // a secret-room chest mimic: every buff, each lasting a full minute
      Object.keys(CONFIG.buffs).forEach((type, i, all) => {
        const a = (i / all.length) * TAU;
        world.pickups.push(new BuffPickup(this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 12, type, CONFIG.run.secret.mimicBuffTime));
      });
    } else if (Math.random() < this.cfg.buffChance) world.pickups.push(new BuffPickup(this.x + 12, this.y, choose(Object.keys(CONFIG.buffs))));
  }

  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const ex = this.x + Math.cos(this.lungeAngle) * this.lungeLen;
    const ey = this.y + Math.sin(this.lungeAngle) * this.lungeLen;
    Telegraph.line(ctx, this.x, this.y, ex, ey, this.radius * 2, this.stateTime / this.cfg.windup);
  }

  currentFrame() {
    const f = this.frames;
    switch (this.state) {
      case 'windup': return f.crouch[0];
      case 'lunge': return f.bite[0];
      case 'recover': return this.stateTime < 0.15 ? f.bite[0] : f.idle[0];
      case 'hop': return f.hop[0];
      default: return f.idle[Math.floor(this.animTime * 3) % 2];
    }
  }

  draw(ctx) {
    // hop arc, and a nervous rattle while winding up
    const c = this.cfg;
    const arc = this.state === 'hop' ? Math.sin((this.stateTime / c.hopTime) * Math.PI) * 14 : 0;
    const shake = this.state === 'windup' ? rand(-1.5, 1.5) : 0;
    ctx.save();
    ctx.translate(shake, -arc);
    this.drawFrame(ctx, this.currentFrame(), this.anchor, this.spawnAlpha);
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}
