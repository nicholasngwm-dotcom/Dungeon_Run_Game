// =============================================================
//  THE KING (the castle's throne room)
//
//  Phase 1: he sits on his throne and shouts. Every shout sends a fan-shaped
//    shockwave out at his target and calls a royal guard through one of the two
//    side doors (up to guards.max at once). Every few shouts he throws his
//    scepter instead: it flies to where you stood, spins there for a while,
//    drops, then flies back to his hand.
//  At half health he rises and slams his scepter (a shockwave round the whole
//    room), calls four bishops who heal him, and a guard brings him his
//    greatsword. He can't be hurt until he has it.
//  Phase 2: he waddles after you, taking turns between a scepter slam (a ring
//    shockwave), a huge greatsword sweep, and his crown blazing out rings of
//    light that stun whoever they hit.
//  (x, y) is his feet; seated, he sits on the throne at the top of the room.
// =============================================================

const KING_INTRO = 1.8;   // asleep on the throne -> jolted awake

class King {
  constructor(x, y) {
    const c = CONFIG.king;
    this.cfg = c;
    this.x = x;
    this.y = y;
    this.maxHp = c.hp;
    this.hp = c.hp;
    this.radius = 34;
    this.hw = 20;
    this.hh = 9;
    this.time = 0;
    this.phase = 1;
    this.intro = KING_INTRO;
    this.onReveal = null;
    this.dying = 0;
    this.dead = false;
    this.flashTime = 0;
    this.facing = 1;
    this.moving = false;
    this.seated = true;
    this.state = 'idle';
    this.t = 0;
    this.attackTimer = 1.2;
    this.attacks = 0;
    this.aim = Math.PI / 2;
    this.waves = [];          // fan shockwaves from his shouts
    this.scepter = null;      // the thrown scepter: { state: 'fly' | 'spin' | 'rest' | 'back', x, y, ... }
    this.hasSword = false;
    this.weapon = 'scepter';
    this.courier = null;      // the guard bringing the greatsword
    this.doorTurn = 0;
    this.step = 0;
  }

  get name() { return 'THE KING'; }
  get title() { return 'Glutton on the Corrupted Throne'; }
  get defeatText() { return 'The King is dead. Long live nobody.'; }

  get hx() { return this.x; }
  get hy() { return this.y - 52; }
  get headY() { return this.y - 88; }

  get targetable() { return this.intro <= 0 && this.dying <= 0 && !this.dead && !this.transitioning; }
  get transitioning() { return ['rise', 'raise', 'slamDown', 'bishops', 'sword'].includes(this.state); }
  getTargets() { return this.targetable ? [this] : []; }

  get bars() {
    if (this.dying > 0 || this.dead) return [];
    return [{ part: this, x: this.x, y: this.y - 124, w: 110, color: '#e8b040', marker: [this.cfg.phase2At] }];
  }

  knockback() {}
  stun() {}

  /** His bishops mend him. */
  heal(amount, world) {
    const before = this.hp;
    this.hp = Math.min(this.phase === 1 ? this.maxHp : this.maxHp * this.cfg.phase2At, this.hp + amount);
    if (this.hp > before) world.effects.text(this.hx, this.hy - 50, `+${Math.round(this.hp - before)}`, { color: '#8cf08a', size: 9 });
  }

  takeDamage(amount, world) {
    if (!this.targetable) return false;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(world);
      return true;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * this.cfg.phase2At) this.startRise(world);
    return true;
  }

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  /** The throne room's two side doors (placed by CastleDecor). */
  doors(world) {
    if (!this.doorList) this.doorList = world.run ? world.run.decor.items.filter((d) => d.kind === 'throneDoor').sort((a, b) => a.x - b.x) : [];
    return this.doorList;
  }

  // ---------------------------------------------------------
  //  UPDATE
  // ---------------------------------------------------------

  update(dt, world) {
    this.time += dt;
    this.flashTime -= dt;
    this.updateWaves(dt, world);
    this.updateScepter(dt, world);
    this.updateCourier(dt, world);
    if (this.intro > 0) return this.updateIntro(dt, world);
    if (this.dying > 0) return this.updateDeath(dt, world);
    this.t += dt;
    this.moving = false;
    const p = world.player;
    if (this.state !== 'swordWindup' || this.t < this.cfg.sword.windup * 0.55) this.facing = p.x >= this.x ? 1 : -1;
    if (this.transitioning) this.updateTransition(dt, world);
    else if (this.phase === 1) this.updateSeated(dt, world);
    else this.updateStanding(dt, world);
    this.contactDamage(world);
  }

  // ---------- phase 1: on the throne ----------

  updateSeated(dt, world) {
    const c = this.cfg;
    const p = world.player;
    switch (this.state) {
      case 'idle':
        this.attackTimer -= dt;
        if (this.attackTimer > 0 || p.dead) return;
        this.attacks++;
        if (this.attacks % c.throwEvery === 0 && !this.scepter) { this.setState('throwWindup'); Sound.play('fistCharge'); }
        else { this.setState('shoutWindup'); this.aim = angleTo(this.x, this.y - 20, p.x, p.y); Sound.play('windup'); }
        break;
      case 'shoutWindup':
        if (this.t < c.shout.windup * 0.6 && !p.dead) this.aim = angleTo(this.x, this.y - 20, p.x, p.y);
        if (this.t >= c.shout.windup) this.shout(world);
        break;
      case 'shout':
        if (this.t >= 0.6) { this.setState('idle'); this.attackTimer = c.shout.every - c.shout.windup - 0.6; }
        break;
      case 'throwWindup':
        if (this.t >= c.scepter.windup) this.throwScepter(world, p);
        break;
      case 'throw':
        if (this.t >= 0.4) { this.setState('idle'); this.attackTimer = 0.8; }
        break;
    }
  }

  /** A shout: a fan-shaped shockwave at his target, and a royal guard through one of the doors. */
  shout(world) {
    const c = this.cfg.shout;
    this.waves.push({ x: this.x, y: this.y - 20, angle: this.aim, arc: c.arcDegrees * DEG, r: 30, max: c.range, speed: c.speed, width: c.width, hit: new Set() });
    world.shake(6, 0.3);
    Sound.play('kingShout');
    world.effects.burst(this.x + this.facing * 10, this.headY + 20, { count: 12, colors: ['#ffe680', '#ffffff'], speed: [80, 200], life: [0.2, 0.4], angle: this.aim, spread: 1.2 });
    this.callGuard(world);
    this.setState('shout');
  }

  /** A royal guard marches in through the next door (while he has fewer than guards.max). */
  callGuard(world) {
    const alive = world.enemies.filter((e) => e.owner === this && e.type === 'royalGuard' && !e.dead).length;
    const doors = this.doors(world);
    if (alive >= this.cfg.guards.max || !doors.length) return;
    const door = doors[this.doorTurn++ % doors.length];
    this.openDoor(door, 1.6);
    world.after(0.5, () => {
      if (this.dead || this.dying > 0) return;
      const pt = world.dungeon.freePoint(door.x, door.y + 30, 12, 8);
      const g = createEnemy('royalGuard', pt.x, pt.y);
      g.owner = this;
      world.addEnemy(g);
      world.effects.burst(pt.x, pt.y - 20, { count: 10, colors: ['#3e3a48', '#c8a456'], speed: [30, 90], life: [0.2, 0.5] });
    });
  }

  openDoor(door, time) {
    door.openUntil = this.time + time;
    Sound.play('gateCreak', 0.2);
  }

  /** The fan shockwaves roll outward; each hero in the fan is hit once as the front passes. */
  updateWaves(dt, world) {
    const c = this.cfg.shout;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      if (w.r >= w.max) { w.dead = true; continue; }
      for (const a of world.allies) {
        if (w.hit.has(a)) continue;
        const d = dist(w.x, w.y, a.x, a.y);
        if (Math.abs(d - w.r) > w.width / 2 + (a.radius || 10) * 0.5) continue;
        if (Math.abs(angleDiff(w.angle, angleTo(w.x, w.y, a.x, a.y))) > w.arc / 2) continue;
        w.hit.add(a);
        if (a.hurt(c.damage, world, w.x, w.y)) a.knockback?.(angleTo(w.x, w.y, a.x, a.y), c.knockback);
      }
    }
    removeDead(this.waves);
  }

  // ---------- the scepter ----------

  /** Where his weapon hand is in the world right now. */
  handPos() {
    const pose = this.poseName();
    const h = KING_HANDS[pose] || KING_HANDS.sit;
    const S = KING_SPRITE;
    return { x: this.x + (h.x - S.ax) * this.facing, y: this.y + (h.y - S.ay) };
  }

  throwScepter(world, p) {
    const c = this.cfg.scepter;
    const h = this.handPos();
    const tx = p.dead ? this.x : p.x;
    const ty = p.dead ? this.y + 150 : p.y;
    this.scepter = { state: 'fly', x: h.x, y: h.y, tx, ty, t: 0, tick: 0, spin: 0 };
    Sound.play('fistLaunch');
    this.setState('throw');
  }

  updateScepter(dt, world) {
    const S = this.scepter;
    if (!S) return;
    const c = this.cfg.scepter;
    S.t += dt;
    S.spin += dt * (S.state === 'spin' ? 22 : S.state === 'rest' ? 0 : 14);
    const go = (tx, ty, speed) => {
      const d = dist(S.x, S.y, tx, ty);
      const s = Math.min(d, speed * dt);
      if (d > 0.5) { S.x += ((tx - S.x) / d) * s; S.y += ((ty - S.y) / d) * s; }
      return d - s < 1;
    };
    switch (S.state) {
      case 'fly':
        if (go(S.tx, S.ty, c.speed)) { S.state = 'spin'; S.t = 0; world.shake(3, 0.15); Sound.play('impact'); }
        break;
      case 'spin':
        S.tick -= dt;
        if (S.tick <= 0) {
          S.tick = c.tick;
          for (const a of world.allies) {
            if (dist(a.x, a.y, S.x, S.y) < c.radius + a.radius) a.hurt(c.damage, world, S.x, S.y);
          }
          Sound.play('slash', 0.12);
        }
        if (vrand(0, 1) < 0.5) world.effects.burst(S.x + vrand(-c.radius, c.radius) * 0.7, S.y - 6, { count: 1, colors: ['#ffe680', '#ecd690', '#ffffff'], speed: [20, 70], life: [0.2, 0.4] });
        if (S.t >= c.spin) { S.state = 'rest'; S.t = 0; Sound.play('gateClang'); world.effects.burst(S.x, S.y, { count: 10, colors: ['#ecd690', '#ffffff'], speed: [30, 100], life: [0.2, 0.4] }); }
        break;
      case 'rest':
        if (S.t >= c.rest) { S.state = 'back'; S.t = 0; Sound.play('phantomAppear', 0.2); }
        break;
      case 'back': {
        const h = this.handPos();
        if (go(h.x, h.y, c.back)) this.scepter = null;
        break;
      }
    }
  }

  // ---------- the turn: rising, the slam, the bishops, the greatsword ----------

  startRise(world) {
    this.phase = 2;
    this.setState('rise');
    this.waves = [];
    world.banner('THE KING RISES', 'His court answers his call', 2.4);
    Sound.play('bossRoar');
  }

  updateTransition(dt, world) {
    const c = this.cfg;
    switch (this.state) {
      case 'rise':
        // he heaves himself up off the throne and waddles forward a little
        if (this.t > 0.4) { this.seated = false; this.y += 40 * dt; }
        if (this.scepter) this.scepter.state = 'back';
        if (this.t >= 1.2 && !this.scepter) { this.setState('raise'); Sound.play('fistCharge'); }
        break;
      case 'raise':
        if (this.t >= 0.7) {
          // the scepter cracks the floor: a shockwave round the whole room
          const s = c.slamWave;
          world.addShockwave(this.x, this.y, { radius: s.radius, speed: s.speed, width: s.width, damage: s.damage, color: '255, 220, 120' });
          this.slamFx(world, 1.4);
          this.setState('slamDown');
        }
        break;
      case 'slamDown':
        if (this.t >= 0.8) {
          // four bishops file in through the doors
          const doors = this.doors(world);
          for (let i = 0; i < c.bishops && doors.length; i++) {
            const door = doors[i % doors.length];
            this.openDoor(door, 2.2);
            world.after(0.4 + Math.floor(i / doors.length) * 0.7, () => {
              if (this.dead || this.dying > 0) return;
              const pt = world.dungeon.freePoint(door.x + (i < 2 ? 0 : 20), door.y + 30, 10, 8);
              const b = createEnemy('bishop', pt.x, pt.y);
              b.owner = this;
              world.addEnemy(b);
              world.effects.burst(pt.x, pt.y - 20, { count: 10, colors: ['#46286a', '#c8a456', '#fff6d0'], speed: [30, 90], life: [0.2, 0.5] });
            });
          }
          world.effects.text(this.hx, this.headY - 20, 'BISHOPS! MY SWORD!', { color: '#ecd690', size: 10, life: 1.8 });
          this.setState('bishops');
        }
        break;
      case 'bishops':
        if (this.t >= 1.4 && !this.courier) {
          const door = this.doors(world)[0];
          if (!door) { this.takeSword(world); break; }
          this.openDoor(door, 99);
          this.courier = { x: door.x, y: door.y + 24, state: 'in', t: 0, door, face: 1, step: 0 };
          this.setState('sword');
        }
        break;
      case 'sword':
        // waiting for the guard to arrive with the greatsword (updateCourier)
        break;
    }
  }

  /** The guard bringing his greatsword: marches out, kneels to present it, marches back and is gone. */
  updateCourier(dt, world) {
    const C = this.courier;
    if (!C) return;
    C.t += dt;
    const walk = (tx, ty) => {
      const d = dist(C.x, C.y, tx, ty);
      const s = Math.min(d, 120 * dt);
      if (d > 0.5) { C.x += ((tx - C.x) / d) * s; C.y += ((ty - C.y) / d) * s; C.face = tx >= C.x ? 1 : -1; }
      C.step += dt;
      return d - s < 1;
    };
    if (C.state === 'in') {
      if (walk(this.x - this.facing * 0 - 46, this.y + 10)) { C.state = 'kneel'; C.t = 0; C.face = 1; }
    } else if (C.state === 'kneel') {
      if (C.t >= 0.7 && !this.hasSword) this.takeSword(world);
      if (C.t >= 1.1) { C.state = 'out'; C.t = 0; }
    } else if (C.state === 'out') {
      if (walk(C.door.x, C.door.y + 20)) {
        world.effects.burst(C.x, C.y - 20, { count: 8, colors: ['#3e3a48', '#c8a456'], speed: [20, 60], life: [0.2, 0.4] });
        C.door.openUntil = this.time + 0.3;
        this.courier = null;
      }
    }
  }

  takeSword(world) {
    this.hasSword = true;
    this.weapon = 'sword';
    Sound.play('swordDraw');
    world.effects.burst(this.x + this.facing * 30, this.hy, { count: 24, colors: ['#ffffff', '#ff3b30', '#c4c0d0'], speed: [60, 200], life: [0.3, 0.6] });
    world.banner('THE KING TAKES UP HIS GREATSWORD', '', 1.8);
    world.shake(4, 0.2);
    this.setState('walk');
    this.attackTimer = 1;
  }

  slamFx(world, size = 1) {
    world.shake(9 * size, 0.5);
    Sound.play('stomp');
    Sound.play('impact');
    const x = this.x + this.facing * 26;
    const y = this.y + 4;
    world.effects.add(1.8, (ctx, t) => {
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.strokeStyle = '#120e16';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.3;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 30 * size, y + Math.sin(a) * 16 * size);
        ctx.lineTo(x + Math.cos(a + 0.2) * 52 * size, y + Math.sin(a + 0.2) * 28 * size);
        ctx.stroke();
      }
      ctx.restore();
    }, true);
    world.effects.burst(x, y - 6, { count: 34, colors: ['#524c60', '#6e687e', '#ecd690', '#3a2a20'], speed: [80, 260], life: [0.3, 0.8], gravity: 300, up: 120, size: [2, 5] });
    world.effects.smoke(x, y - 8, { count: 10, radius: 30 * size, life: 1, rise: 20, colors: ['#3e3a48', '#5e5a6c', '#8e8a9e'] });
  }

  // ---------- phase 2: on his feet ----------

  updateStanding(dt, world) {
    const c = this.cfg;
    const p = world.player;
    switch (this.state) {
      case 'walk': {
        if (!p.dead && dist(this.x, this.y, p.x, p.y) > 90) {
          const a = angleTo(this.x, this.y, p.x, p.y);
          const x0 = this.x;
          const y0 = this.y;
          world.dungeon.move(this, Math.cos(a) * c.walkSpeed * dt, Math.sin(a) * c.walkSpeed * dt);
          this.moving = dist(x0, y0, this.x, this.y) > 0.05;
          if (this.moving && Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) { world.shake(1, 0.08); }
        }
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && !p.dead) {
          const kind = ['slam', 'sword', 'crown'][this.step++ % 3];
          this.aim = angleTo(this.x, this.y - 20, p.x, p.y);
          if (kind === 'slam') { this.weapon = 'scepter'; this.setState('slamWindup'); Sound.play('fistCharge'); }
          else if (kind === 'sword') { this.weapon = 'sword'; this.setState('swordWindup'); Sound.play('windup'); }
          else { this.setState('crownWindup'); Sound.play('laserCharge', 0.2); }
        }
        break;
      }
      case 'slamWindup':
        if (this.t >= c.slam.windup) {
          world.addShockwave(this.x, this.y, { radius: c.slam.radius, speed: c.slam.speed, width: c.slam.width, damage: c.slam.damage, color: '255, 220, 120' });
          this.slamFx(world, 1);
          this.setState('slam');
        }
        break;
      case 'slam':
        if (this.t >= 0.5) this.toWalk();
        break;
      case 'swordWindup':
        if (this.t < c.sword.windup * 0.55 && !p.dead) this.aim = angleTo(this.x, this.y - 20, p.x, p.y);
        if (this.t >= c.sword.windup) this.sweep(world);
        break;
      case 'swing':
        if (this.t >= 0.6) this.toWalk();
        break;
      case 'crownWindup':
        if (this.t >= c.light.windup) { this.setState('crown'); this.rings = 0; }
        break;
      case 'crown': {
        const L = c.light;
        if (this.t >= this.rings * L.ringGap && this.rings < L.rings) this.lightRing(world, this.rings++);
        if (this.rings >= L.rings && this.t >= L.rings * L.ringGap + 0.3) { this.weapon = 'sword'; this.toWalk(); }
        break;
      }
    }
  }

  toWalk() {
    this.setState('walk');
    this.attackTimer = this.cfg.attackInterval;
  }

  /** The greatsword sweeps a huge arc in front of him. */
  sweep(world) {
    const c = this.cfg.sword;
    const arc = c.arcDegrees * DEG;
    for (const a of world.allies) {
      const d = dist(this.x, this.y - 20, a.x, a.y);
      if (d > c.reach + a.radius) continue;
      if (Math.abs(angleDiff(this.aim, angleTo(this.x, this.y - 20, a.x, a.y))) > arc / 2 && d > 50) continue;
      if (a.hurt(c.damage, world, this.x, this.y)) a.knockback?.(angleTo(this.x, this.y, a.x, a.y), 300);
    }
    Enemy.prototype.swipeFx.call({ x: this.x, y: this.y - 10, attackAngle: this.aim, cfg: { attackArcDegrees: c.arcDegrees, attackReach: c.reach } }, world, '255, 90, 80');
    world.shake(7, 0.3);
    Sound.play('heavySwing');
    this.setState('swing');
  }

  /** His crown blazes: a ring of light orbs bursts out (a second ring follows, offset). Each one stuns. */
  lightRing(world, i) {
    const L = this.cfg.light;
    const off = (i % 2 ? Math.PI / L.count : 0) + this.time * 0.3;
    const x = this.x;
    const y = this.headY + 4;
    for (let k = 0; k < L.count; k++) {
      const a = off + (k / L.count) * TAU;
      world.enemyProjectiles.push(new Projectile({
        x, y, vx: Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed, radius: 7, damage: L.damage, life: 4, friendly: false,
        sprite: Sprites.projectiles.lightOrb, spin: 3, glow: '255, 230, 140', trail: ['#ffe680', '#fffbe8'],
        onHit: (pr, w, t) => {
          if (t && t.stun) t.stun(L.stun, w);
          w.effects.burst(pr.x, pr.y, { count: 10, colors: ['#ffe680', '#fffbe8', '#ffffff'], speed: [40, 140], life: [0.2, 0.4] });
        },
      }));
    }
    world.effects.add(0.4, (ctx, t) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, y, 30 + t * 80, '255, 230, 140', 1.2 * (1 - t));
      ctx.restore();
    });
    Sound.play('laser');
    world.shake(3, 0.15);
  }

  // ---------- contact, death, entrance ----------

  contactDamage(world) {
    if (!this.targetable) return;
    for (const p of world.heroes) {
      if (dist(this.x, this.y, p.x, p.y) < 26 + p.hw) p.hurt(this.cfg.contactDamage, world, this.x, this.y, { contact: true });
    }
  }

  die(world) {
    this.dying = 2.6;
    this.state = 'dying';
    this.waves = [];
    this.scepter = null;
    this.courier = null;
    Sound.play('bossRoar');
    world.banner('THE KING IS DEAD!', '');
    for (const e of world.enemies) {
      if (e.owner !== this || e.dead) continue;
      e.dead = true;
      world.effects.burst(e.hx, e.hy, { count: 14, colors: ['#3e3a48', '#c8a456', '#8a2438'], speed: [40, 140], life: [0.3, 0.6] });
    }
    // his crown tumbles off and rolls away
    const x0 = this.x;
    const y0 = this.headY;
    const dir = this.facing;
    world.effects.add(2.4, (ctx, t) => {
      const k = Math.min(1, t * 2.2);
      const x = x0 + dir * k * 70;
      const y = y0 + (this.y - y0) * k - Math.sin(k * Math.PI) * 30;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(dir * k * 4);
      ctx.fillStyle = OUTLINE; ctx.fillRect(-11, -6, 22, 10);
      ctx.fillStyle = '#c8a456'; ctx.fillRect(-10, -3, 20, 6);
      for (const sx of [-9, -3, 3, 9]) { ctx.fillRect(sx - 1, -7, 3, 4); }
      ctx.fillStyle = '#6a449a'; ctx.fillRect(-1, -2, 3, 3);
      ctx.restore();
    });
  }

  updateDeath(dt, world) {
    this.dying -= dt;
    this.burstTimer = (this.burstTimer || 0) - dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = 0.2;
      this.flashTime = 0.08;
      world.effects.burst(this.x + rand(-34, 34), this.y - rand(10, 90), { count: 12, colors: ['#8a2438', '#c8a456', '#ffffff', '#6a449a'], speed: [60, 200], life: [0.3, 0.7], size: [2, 5] });
      world.shake(4, 0.2);
      Sound.play('hit', 0.1);
    }
    if (this.dying <= 0) {
      this.dead = true;
      world.effects.burst(this.x, this.y - 50, { count: 90, colors: ['#8a2438', '#c8a456', '#ecd690', '#6a449a', '#ffffff'], speed: [80, 320], life: [0.6, 1.4], size: [2, 6] });
      world.shake(12, 0.7);
      Sound.play('partBreak');
      world.onBossDefeated();
    }
  }

  /** Asleep on the throne when the doors shut... until the noise wakes him. */
  updateIntro(dt, world) {
    const before = KING_INTRO - this.intro;
    this.intro -= dt;
    const e = KING_INTRO - this.intro;
    if (before < 1.1 && e >= 1.1) {
      world.effects.text(this.hx, this.headY - 24, 'WHO DARES?!', { color: '#ff6a5a', size: 12, life: 1.4 });
      world.shake(6, 0.4);
    }
    if (this.intro <= 0) {
      this.intro = 0;
      if (this.onReveal) this.onReveal();
      else Sound.play('bossRoar');
    }
  }

  // ---------------------------------------------------------
  //  DRAWING
  // ---------------------------------------------------------

  poseName() {
    if (this.dying > 0) return this.seated ? 'sit' : 'stand';
    if (this.intro > 0) return KING_INTRO - this.intro > 1.1 ? 'shout' : 'sit';
    switch (this.state) {
      case 'shoutWindup': return 'sit';
      case 'shout': return 'shout';
      case 'throwWindup': return 'throw';
      case 'throw': return 'sit';
      case 'rise': return this.seated ? 'shout' : 'stand';
      case 'raise': case 'slamWindup': case 'swordWindup': return 'raise';
      case 'slamDown': case 'slam': return 'slam';
      case 'swing': return 'swing';
      case 'crownWindup': case 'crown': return 'crown';
    }
    if (this.seated) return 'sit';
    return this.moving ? 'walk' : 'stand';
  }

  currentFrame() {
    const K = Sprites.king;
    const pose = this.poseName();
    const list = K[pose] || K.sit;
    const fps = pose === 'walk' ? 6 : pose === 'sit' || pose === 'stand' ? 3 : 8;
    return list[Math.floor(this.time * fps) % list.length];
  }

  drawGround(ctx) {
    if (this.dead) return;
    drawShadow(ctx, this.x, this.y + 2, 36, 10, 0.4);
    const c = this.cfg;
    if (this.state === 'shoutWindup') Telegraph.cone(ctx, this.x, this.y - 20, this.aim, c.shout.arcDegrees * DEG, 260, this.t / c.shout.windup);
    if (this.state === 'swordWindup') Telegraph.cone(ctx, this.x, this.y - 20, this.aim, c.sword.arcDegrees * DEG, c.sword.reach, this.t / c.sword.windup);
    if (this.state === 'slamWindup' || this.state === 'raise') {
      const r = this.state === 'raise' ? 180 : c.slam.radius * 0.5;
      Telegraph.circle(ctx, this.x, this.y, r, this.t / (this.state === 'raise' ? 0.7 : c.slam.windup), '255, 200, 90');
    }
    // the shout's fan shockwaves: bands of sound rolling out across the marble
    for (const w of this.waves) {
      const fade = 1 - w.r / w.max;
      ctx.save();
      for (const [dr, width, alpha] of [[0, w.width, 0.35], [-6, 4, 0.9], [8, 2, 0.6]]) {
        ctx.strokeStyle = `rgba(255, 236, 170, ${alpha * fade})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, Math.max(1, w.r + dr), Math.max(1, (w.r + dr) * 0.75), 0, w.angle - w.arc / 2, w.angle + w.arc / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the scepter spinning where it landed: a whirl of gold on the floor
    const S = this.scepter;
    if (S && S.state === 'spin') {
      Telegraph.circle(ctx, S.x, S.y, c.scepter.radius, S.t / c.scepter.spin, '255, 200, 90');
    }
  }

  getDrawables() {
    const out = [];
    if (this.dead) return out;
    out.push({ y: this.y, draw: (ctx) => this.drawKing(ctx) });
    const S = this.scepter;
    if (S) out.push({ y: S.y + (S.state === 'fly' || S.state === 'back' ? 200 : 0), draw: (ctx) => this.drawThrownScepter(ctx) });
    const C = this.courier;
    if (C) out.push({ y: C.y, draw: (ctx) => this.drawCourier(ctx) });
    return out;
  }

  /** A weapon in his hand, drawn bigger than the heroes' (he's a big man). */
  drawWeapon(ctx, w, x, y, angle, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
    ctx.scale(scale, scale);
    ctx.drawImage(w.img, -w.pivotX, -w.pivotY);
    ctx.restore();
  }

  drawKing(ctx) {
    const frame = this.currentFrame();
    const K = KING_SPRITE;
    const flip = this.facing < 0;
    const alpha = this.dying > 0 ? clamp(this.dying / 2.6, 0, 1) : 1;
    const pose = this.poseName();
    const shake = this.state === 'shoutWindup' || this.state === 'raise' || this.state === 'crownWindup' ? vrand(-1, 1) : 0;
    const x = this.x + shake;
    // a heavy golden-violet aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    PFX.glow(ctx, x, this.y - 54, 64, '200, 150, 90', 0.25 * alpha, 2, 70);
    ctx.restore();
    // the weapon: the scepter when it's home (phase 1, or a slam), the greatsword otherwise
    const h = this.handPos();
    const hx = h.x + shake;
    const hy = h.y;
    const f = this.facing;
    const weaponAngle = () => {
      switch (pose) {
        case 'throw': case 'raise': return -Math.PI / 2 - f * 0.35;
        case 'slam': return f > 0 ? 0.9 : Math.PI - 0.9;
        case 'swing': return this.aim;
        default: return f > 0 ? -0.9 : Math.PI + 0.9;
      }
    };
    const drawHeld = () => {
      if (this.dying > 0) return;
      ctx.globalAlpha = alpha;
      if (this.weapon === 'sword' && this.hasSword) this.drawWeapon(ctx, Sprites.weapons.greatsword, hx, hy, weaponAngle(), 1.5);
      else if (!this.scepter) this.drawWeapon(ctx, Sprites.weapons.scepter, hx, hy, weaponAngle(), 1.6);
      ctx.globalAlpha = 1;
    };
    const raisedHigh = pose === 'raise' || pose === 'throw';
    if (raisedHigh) drawHeld();
    drawSprite(ctx, frame.img, x, this.y, K.ax, K.ay, flip, alpha);
    if (this.flashTime > 0) drawSprite(ctx, frame.flash, x, this.y, K.ax, K.ay, flip, alpha * 0.8);
    if (!raisedHigh) drawHeld();
    // the crown blazing as it builds to a ring of light
    if (this.state === 'crownWindup' || this.state === 'crown') {
      const k = this.state === 'crown' ? 1 : this.t / this.cfg.light.windup;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      PFX.glow(ctx, x, this.headY - 2, 14 + k * 30, '255, 230, 140', 0.6 + k * 0.8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + this.time * 2;
        ctx.strokeStyle = `rgba(255, 240, 190, ${0.5 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 12, this.headY - 2 + Math.sin(a) * 12);
        ctx.lineTo(x + Math.cos(a) * (20 + k * 30), this.headY - 2 + Math.sin(a) * (20 + k * 30));
        ctx.stroke();
      }
      ctx.restore();
    }
    // asleep: z's drifting up off him
    if (this.intro > 0 && KING_INTRO - this.intro < 1.1) {
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 0.6 + i / 3) % 1;
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) * 5;
        HUD.text(ctx, i === 2 ? 'Z' : 'z', Math.round(this.x + 20 + k * 16), Math.round(this.headY - 20 - k * 26), { size: i === 2 ? 10 : 7, color: '#c8b8ff' });
      }
      ctx.globalAlpha = 1;
    }
  }

  drawThrownScepter(ctx) {
    const S = this.scepter;
    const w = Sprites.weapons.scepter;
    const lift = S.state === 'spin' ? 16 : S.state === 'rest' ? 2 : 0;
    if (S.state === 'spin') {
      ctx.save();
      ctx.globalAlpha = 0.45;
      PFX.ring(ctx, S.x, S.y - lift, this.cfg.scepter.radius * 0.8, this.cfg.scepter.radius * 0.35, '#ffe680', 2, { from: S.spin, to: S.spin + 2 });
      PFX.ring(ctx, S.x, S.y - lift, this.cfg.scepter.radius * 0.8, this.cfg.scepter.radius * 0.35, '#ffe680', 2, { from: S.spin + Math.PI, to: S.spin + Math.PI + 2 });
      ctx.restore();
    }
    drawShadow(ctx, S.x, S.y + 2, 16, 5, 0.3);
    const a = S.state === 'rest' ? 0.2 : S.spin;
    ctx.save();
    ctx.translate(Math.round(S.x), Math.round(S.y - lift - (S.state === 'fly' || S.state === 'back' ? 30 : 0)));
    ctx.rotate(a);
    ctx.scale(1.6, 1.6);
    ctx.drawImage(w.img, -w.img.width / 2, -w.img.height / 2);
    ctx.restore();
  }

  /** The guard carrying the greatsword in both hands before him. */
  drawCourier(ctx) {
    const C = this.courier;
    const frames = Sprites.enemies.royalGuard;
    const moving = C.state !== 'kneel';
    const frame = heroFrame(frames, moving, C.step);
    ctx.save();
    ctx.translate(C.x, C.y);
    ctx.scale(1.15, C.state === 'kneel' ? 1.15 * 0.86 : 1.15);
    ctx.translate(-C.x, -C.y);
    drawSprite(ctx, frame.img, C.x, C.y, ENEMY_ANCHOR.x, ENEMY_ANCHOR.y, C.face < 0, 1);
    ctx.restore();
    if (!this.hasSword) {
      const w = Sprites.weapons.greatsword;
      this.drawWeapon(ctx, w, C.x + C.face * (C.state === 'kneel' ? 4 : -14), C.y - 26, C.state === 'kneel' ? (C.face > 0 ? -0.15 : Math.PI + 0.15) : 0, 1.2);
    }
  }

  drawOverlay() {}
}
