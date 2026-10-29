// On-screen controls for phones and tablets, laid out like a mobile arena game:
//   left thumb   a movement joystick that appears wherever the thumb lands (left half of the screen)
//   right thumb  the aim stick in the corner, with the skill buttons in an arc round it
//
// The aim stick attacks: held still it auto-targets the nearest enemy; dragged it aims, and with
// Auto fire on (Settings) it keeps attacking that way, with it off it fires one shot on letting go.
// Skill buttons (secondary, E, F, ultimate) cast at the auto target on a tap; dragged, they aim
// (showing the ability's outline, as holding its key does) and cast on letting go. To cancel, let
// go on the CANCEL mark that shows above the buttons while one is dragged, or drag it back onto
// its own button. A skill with an outline is held from the touch (as its key would be) and dropped
// with the cancelAim action; one without would cast on the press, so its press waits for letting go.
//
// Touch only fills in what the keyboard and mouse would: Input.touchHeld / touchPressed and the
// mouse (an aim point on screen and its buttons). So the game, and multiplayer, can't tell a phone
// from a PC: both send the same input, and a phone plays with a PC like any other machine.

// the arc round the aim stick, from the bottom left up to the top (degrees; 0 = right, 90 = down)
const TOUCH_SKILLS = [
  { id: 'dodge', angle: 165 },
  { id: 'secondary', angle: 200 },
  { id: 'e', angle: 235 },
  { id: 'f', angle: 270 },
  { id: 'ult', angle: 308, big: true },
];
const TOUCH_AIMED = ['dodge', 'secondary', 'e', 'f', 'ult'];   // buttons that aim while dragged (dodge too: it dashes that way)
const TOUCH_AIM_LOCK = 0.3;      // s a let-go skill's aim holds (and on until the hero's ability is done), so walking can't swing it
const TOUCH_DEAD = 10;            // px a thumb moves before it counts as a drag
const TOUCH_MOVE_DEAD = 5;        // px the movement stick moves before the hero walks
const TOUCH_TARGET_RANGE = 340;   // auto-target reach (world px)

const Touch = {
  app: null,
  canvas: null,
  coarse: !!window.matchMedia?.('(pointer: coarse)').matches,   // this device's main pointer is a finger
  pointers: new Map(),     // pointerId -> { role, slot, x, y, sx, sy, moved, frames, home, away, deferred }
  moveDir: null,           // the movement stick's direction, while pushed
  aimDir: { x: 1, y: 0 },  // where the hero aims when no thumb is aiming (kept between frames)
  aimDist: 60,
  shot: null,              // Auto fire off: the shot let go of the aim stick { dir, dist, t }
  released: null,          // a skill just let go: where it casts this frame ({ x, y, dist }, or 'auto' = the auto target)
  locked: null,            // that skill's aim, held while it plays out (a charge's windup, a dash): { x, y, dist, t }
  cancelArmed: false,      // the dragged skill is on a cancel spot (its outline is hidden)
  click: null,             // a tap on the lobby's teleport button / map, passed on as a click { x, y }
  scoreboard: false,       // the scoreboard button is a toggle (Tab is held)
  wasEnabled: null,        // Touch.enabled last frame (a change re-lays the screen out)
  picking: false,         // the hero is choosing a spot (lightning, volley, aegis...): the aim stick picks on letting go

  /** Touch controls are on: chosen in Settings, or (auto) on a device whose main pointer is a finger. (Also
   * while the button editor is open, so on a computer it previews the phone layout.) */
  get enabled() {
    if (this.editing) return true;
    const mode = Settings.data.controls;
    return mode === 'touch' || (mode !== 'mouse' && this.coarse);
  },

  init(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    document.body.classList.toggle('touch', this.enabled);   // from the first paint, so a phone never flashes the PC menus
    canvas.addEventListener('pointerdown', (e) => {
      if (this.editing) {
        e.preventDefault();
        this.editorDown(e.pointerId, this.toGame(e));
        return;
      }
      if (e.pointerType === 'mouse' || !this.enabled) return;
      e.preventDefault();   // no made-up mouse events, no zoom or scroll
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      this.down(e.pointerId, this.toGame(e));
    });
    window.addEventListener('pointermove', (e) => {
      if (this.editDrag?.pointerId === e.pointerId) this.editorMove(this.toGame(e));
      const t = this.pointers.get(e.pointerId);
      if (!t) return;
      Object.assign(t, this.toGame(e));
      if (Math.hypot(t.x - t.sx, t.y - t.sy) > TOUCH_DEAD) t.moved = true;
      // a skill dragged clear of its button: coming back onto it now cancels
      if (t.home && Math.hypot(t.x - t.home.x, t.y - t.home.y) > t.home.r * 1.4) t.away = true;
    });
    const up = (e) => {
      if (this.editDrag?.pointerId === e.pointerId) this.editDrag = null;
      const t = this.pointers.get(e.pointerId);
      if (!t) return;
      this.pointers.delete(e.pointerId);
      this.up(t);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  },

  /** A pointer event's position in game pixels (CONFIG.screen). */
  toGame(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CONFIG.screen.width,
      y: ((e.clientY - rect.top) / rect.height) * CONFIG.screen.height,
    };
  },

  // ---------- layout (game pixels, anchored to the screen's corners) ----------

  /**
   * Where everything goes: the default spots (in from the corner, where a thumb rests comfortably:
   * phone edges curve and are hard to reach), each moved and resized by the layout editor
   * (Settings touchLayout: offsets from the default spot, so a layout fits any screen size).
   */
  layout() {
    const k = Settings.data.touchSize || 1;
    const { width: W, height: H } = CONFIG.screen;
    const custom = Settings.data.touchLayout || {};
    const place = (id, x, y, r) => {
      const o = custom[id] || {};
      const rr = r * (o.s || 1);
      return { id, x: clamp(x + (o.x || 0), rr, W - rr), y: clamp(y + (o.y || 0), rr, H - rr), r: rr };
    };
    const ax = W - 128 * k;
    const ay = H - 100 * k;
    const buttons = TOUCH_SKILLS.map((s) => {
      const R = (s.big ? 110 : 102) * k;
      const a = (s.angle * Math.PI) / 180;
      return place(s.id, ax + Math.cos(a) * R, ay + Math.sin(a) * R, (s.big ? 31 : 24) * k);
    });
    buttons.push(place('interact', ax - 190 * k, ay - 118 * k, 21 * k));
    buttons.push(place('heal', 294, H - 32, 17));
    const square = (id, x, y) => {
      const c = place(id, x + 13, y + 13, 13);
      return { id, x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    };
    return {
      aim: place('aim', ax, ay, 48 * k),
      cancel: place('cancel', ax - 150 * k, ay - 200 * k, 26 * k),   // shown while a skill is dragged
      moveR: 40 * k,
      buttons,
      // past the coin / gem counter beside the health bar
      pause: square('pause', 314, 12),
      score: square('score', 346, 12),
    };
  },

  /** Screen rect of bag slot i with the touch controls (the bag moves to the bottom middle). */
  bagSlotRect(i) {
    const o = Settings.data.touchLayout?.bag || {};
    const s = Math.round(40 * (o.s || 1));
    return { x: 320 + (o.x || 0) + i * (s + 4), y: CONFIG.screen.height - 12 - s + (o.y || 0), s };
  },

  // ---------- touches ----------

  down(id, pos) {
    const app = this.app;
    const game = app.game;
    if (app.state !== 'playing' || !game?.localPlayer) return;
    const L = this.layout();
    const inRect = (r) => pos.x >= r.x && pos.x < r.x + r.w && pos.y >= r.y && pos.y < r.y + r.h;
    const m = Input._mouse;
    const t = { role: null, ...pos, sx: pos.x, sy: pos.y, moved: false, frames: 0 };
    if (inRect(L.pause)) { app.pause(); return; }
    if (game.run && inRect(L.score)) { this.scoreboard = !this.scoreboard; return; }
    if (HUD.teleportOpen || (game.lobby && inRect(HUD.teleportButtonRect(game)))) { this.click = pos; return; }
    const b = L.buttons.find((o) => Math.hypot(pos.x - o.x, pos.y - o.y) <= o.r * 1.2);
    const slot = b ? -1 : HUD.bagSlotAt(pos.x, pos.y);
    const taken = (role) => [...this.pointers.values()].some((o) => o.role === role);
    if (b) {
      t.role = b.id;
      if (b.id === 'dodge') t.deferred = true;   // dodges on letting go: dragged, that way; tapped, the way the hero walks
      if (b.id === 'heal') { Input.touchPressed.add('quickHeal'); return; }
      const p = game.localPlayer;
      if (b.id === 'interact') Input.touchPressed.add('interact');   // (held while the thumb stays down)
      else if (b.id === 'dodge') { /* (above) */ } else if (b.id === 'secondary') {
        // a held secondary (shield, jump) is down with the thumb; the others cast on letting go
        t.deferred = !p.holdsSecondary;
        if (!t.deferred) { m.right = true; m.rightPressed = true; }
      } else {
        t.deferred = !p.abilityPreview(b.id === 'ult' ? 'q' : b.id);
        if (!t.deferred) Input.touchPressed.add(b.id);
      }
      if (TOUCH_AIMED.includes(b.id)) t.home = b;
    } else if (slot >= 0) {
      t.role = 'bag';
      t.slot = slot;
    } else if (Math.hypot(pos.x - L.aim.x, pos.y - L.aim.y) <= L.aim.r * 1.6) {
      if (taken('aim')) return;
      t.role = 'aim';
      if (!this.picking) m.leftPressed = true;
    } else if (pos.x < CONFIG.screen.width / 2 && pos.y > 100) {
      if (taken('move')) return;
      t.role = 'move';
    } else return;
    this.pointers.set(id, t);
  },

  up(t) {
    const m = Input._mouse;
    if (TOUCH_AIMED.includes(t.role)) {
      if (t.role === 'secondary' && !t.deferred) m.right = false;   // a held shield / jump just ends
      else if (this.cancelling(t)) {
        if (!t.deferred) Input.touchPressed.add('cancelAim');
        Sound.play('uiClick');
      } else if (t.role === 'dodge') {
        // dragged: a dodge that way (the aim, held until it's done); tapped: the way the hero walks
        const d = this.drag(t, t.home, this.skillReach());
        if (d) {
          Input.touchPressed.add('dodgeAim');
          this.released = { x: d.x, y: d.y, dist: 60 };
        } else Input.touchPressed.add('dodge');
      } else {
        if (t.deferred && t.role === 'secondary') m.rightPressed = true;
        else if (t.deferred) Input.touchPressed.add(t.role);
        // it casts where it was dragged, or at the auto target if it was only tapped
        const d = this.drag(t, t.home, this.skillReach());
        this.released = d ? { x: d.x, y: d.y, dist: this.skillRange(d.k) } : 'auto';
      }
    }
    if (t.role === 'aim') {
      const d = this.drag(t, this.layout().aim);
      // picking a spot (a mage's lightning, a volley...): letting go picks it
      if (this.picking) {
        this.shot = { dir: d, dist: d ? this.aimRange(d.k) : null, t: 0.1 };
        m.leftPressed = true;
      } else if (!Settings.data.autoFire && d) this.shot = { dir: d, dist: this.aimRange(d.k), t: 0.12 };
    }
    if (t.role === 'bag') {
      const p = this.app.game?.localPlayer;
      if (!p?.inventory[t.slot]) return;
      const to = HUD.bagSlotAt(t.x, t.y);
      if (!t.moved) Input.touchPressed.add(`item${t.slot + 1}`);
      else if (to >= 0 && to !== t.slot) App.command({ type: 'moveItem', from: t.slot, to });
      else if (!HUD.inBag(t.x, t.y)) App.command({ type: 'dropItem', slot: t.slot });
    }
  },

  /** A thumb's drag from a base point: { x, y (unit), k (0-1 of reach r) }, or null if it hasn't moved off it. */
  drag(t, base, r = base.r) {
    const dx = t.x - base.x;
    const dy = t.y - base.y;
    const len = Math.hypot(dx, dy);
    if (len < TOUCH_DEAD) return null;
    return { x: dx / len, y: dy / len, k: Math.min(1, len / r) };
  },

  aimRange(k) { return 50 + k * 190; },

  /** How far a skill button drags for full range, and the aim distance for a drag of k (0-1). */
  skillReach() { return 70 * (Settings.data.touchSize || 1); },
  skillRange(k) { return 30 + k * 230; },

  /** A dragged skill is on a cancel spot: the CANCEL mark, or back on its own button after leaving it. */
  cancelling(t) {
    const c = this.layout().cancel;
    if (Math.hypot(t.x - c.x, t.y - c.y) <= c.r * 1.25) return true;
    return !!t.away && Math.hypot(t.x - t.home.x, t.y - t.home.y) <= t.home.r;
  },

  /** The nearest enemy (or boss part, or training dummy) in reach of the hero, as a world point. */
  autoTarget(game, me) {
    const list = game.enemies.filter((e) => !e.dead && e.age > 0.15);
    if (game.boss) list.push(...game.boss.getTargets());
    list.push(...game.dummies);
    let best = null;
    let bd = TOUCH_TARGET_RANGE;
    for (const e of list) {
      const d = Math.hypot(e.x - me.pivotX, e.y - 10 - me.pivotY);
      if (d < bd) { bd = d; best = e; }
    }
    return best && { x: best.x, y: best.y - 10 };
  },

  // ---------- every frame (before the hero reads its input) ----------

  update(app, dt) {
    const m = Input._mouse;
    Input.touchHeld.clear();
    Input.touchMove = null;
    document.body.classList.toggle('touch', this.enabled);
    // switched on or off (Settings, or ?touch): the screen space changes with it
    if (this.enabled !== this.wasEnabled) {
      this.wasEnabled = this.enabled;
      Display.layout();
    }
    if (!this.enabled) return;
    const game = app.game;
    const me = app.state === 'playing' && game?.localPlayer;
    if (!me) {
      // a menu took over: every thumb is let go
      this.pointers.clear();
      this.shot = this.released = this.click = this.locked = null;
      this.cancelArmed = false;
      this.scoreboard = false;
      m.left = m.right = false;
      return;
    }
    this.picking = !!(me.targeting || me.placing || me.choosingAegis || me.choosingArrow);
    const L = this.layout();
    let move = null;
    let aim = null;
    let skill = null;
    for (const t of this.pointers.values()) {
      t.frames++;
      if (t.role === 'move') move = t;
      else if (t.role === 'aim') aim = t;
      else if (TOUCH_AIMED.includes(t.role)) skill = t;
      if (['interact', 'e', 'f', 'ult'].includes(t.role) && !t.deferred) Input.touchHeld.add(t.role);
    }
    this.cancelArmed = !!skill && this.cancelling(skill);
    if (this.scoreboard && game.run) Input.touchHeld.add('scoreboard');

    // movement: analog, any direction at full speed past a small dead zone (Input.touchMove); the
    // stick's base trails a thumb pushed past it, so turning round never means a long drag back
    this.moveDir = null;
    Input.touchMove = null;
    if (move) {
      const dx = move.x - move.sx;
      const dy = move.y - move.sy;
      const len = Math.hypot(dx, dy);
      if (len > L.moveR) {
        move.sx = move.x - (dx / len) * L.moveR;
        move.sy = move.y - (dy / len) * L.moveR;
      }
      if (len > TOUCH_MOVE_DEAD) {
        const nx = dx / len;
        const ny = dy / len;
        // (the keys' directions too, for anything that reads them: menus, the bestiary)
        if (ny < -0.38) Input.touchHeld.add('up');
        if (ny > 0.38) Input.touchHeld.add('down');
        if (nx < -0.38) Input.touchHeld.add('left');
        if (nx > 0.38) Input.touchHeld.add('right');
        Input.touchMove = (Math.round((Math.atan2(ny, nx) / (Math.PI * 2)) * 256) + 256) % 256;
        this.moveDir = { x: nx, y: ny };
      }
    }

    // aim: a dragged skill (held still while on a cancel spot), else the aim stick, else a skill or
    // shot just let go, else the way the hero walks; nothing at all keeps the last aim
    const toward = () => {
      const tg = this.autoTarget(game, me);
      if (!tg) return null;
      const dx = tg.x - me.pivotX;
      const dy = tg.y - me.pivotY;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, dist: d };
    };
    let aimDrag = null;
    let want = null;
    if (skill) {
      const d = this.drag(skill, skill.home, this.skillReach());
      if (!this.cancelArmed) want = d ? { x: d.x, y: d.y, dist: this.skillRange(d.k) } : toward();
    } else if (aim) {
      aimDrag = this.drag(aim, L.aim);
      want = aimDrag ? { x: aimDrag.x, y: aimDrag.y, dist: this.aimRange(aimDrag.k) } : toward();
    } else if (this.released) {
      want = this.released === 'auto' ? toward() : this.released;
      // the skill's aim holds while it plays out (a charge's windup, a dash), whichever way the hero walks
      if (want) this.locked = { ...want, t: TOUCH_AIM_LOCK };
    } else if (this.shot?.dir) {
      want = { x: this.shot.dir.x, y: this.shot.dir.y, dist: this.shot.dist };
    } else if (this.shot) {
      want = toward();
    } else if (this.locked) {
      want = this.locked;
    } else if (this.moveDir) {
      want = { x: this.moveDir.x, y: this.moveDir.y, dist: 60 };
    }
    this.released = null;
    if (this.locked) {
      this.locked.t -= dt;
      // (a new skill or the aim stick takes over; otherwise it lets go once the ability is done)
      if (skill || aim || (this.locked.t <= 0 && !(me.busy > 0 || me.channeling))) this.locked = null;
    }
    if (want) {
      this.aimDir = { x: want.x, y: want.y };
      this.aimDist = want.dist;
    }
    // (aim distances are in world px: the screen point is at the world's zoom)
    const h = game.camera.worldToScreen(me.pivotX, me.pivotY);
    m.x = h.x + this.aimDir.x * this.aimDist * Display.zoom;
    m.y = h.y + this.aimDir.y * this.aimDist * Display.zoom;

    // the attack: held while the aim stick is held (still: at the auto target; dragged: only with Auto
    // fire), or for a moment after a shot is let go
    const was = m.left;
    let fire = !!aim && !this.picking && (!aimDrag || Settings.data.autoFire);
    if (this.shot) {
      fire = true;
      this.shot.t -= dt;
      if (this.shot.t <= 0) this.shot = null;
    }
    m.left = fire;
    if (was && !fire) m.leftReleased = true;

    // a tap on the teleport button / map: a click there for the lobby's HUD to take
    if (this.click) {
      m.x = this.click.x;
      m.y = this.click.y;
      m.left = m.leftPressed = true;
      this.click = null;
    }
  },

  // ---------- drawing (screen space, after the HUD) ----------

  circle(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * A round button in the keep's style: an outline, a bevelled gold rim lit from the top left,
   * and a dark walnut face shaded toward its edge. lit: brighter, for a pressed or held button.
   */
  disc(ctx, x, y, r, lit = false) {
    this.circle(ctx, x, y, r + 3, OUTLINE);
    const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    rim.addColorStop(0, lit ? '#fff2a0' : '#e0bc5c');
    rim.addColorStop(0.5, lit ? '#ffd34a' : '#a8822e');
    rim.addColorStop(1, lit ? '#b8801c' : '#5a3e16');
    this.circle(ctx, x, y, r + 2, rim);
    this.circle(ctx, x, y, r - 1, OUTLINE);
    const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    face.addColorStop(0, lit ? '#6e4c32' : '#4e3524');
    face.addColorStop(1, lit ? '#2e1f17' : '#160e0a');
    this.circle(ctx, x, y, r - 2, face);
  },

  /** A soft ring of light round a ready button (stronger for the ultimate). */
  glow(ctx, x, y, r, strength = 1) {
    const a = (0.35 + Math.sin(performance.now() / 260) * 0.15) * strength;
    ctx.strokeStyle = `rgba(255, 214, 110, ${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  },

  /** The moment a button comes off cooldown, a bright ring bursts out of it. */
  readyFlash(ctx, id, ready, x, y, r) {
    const now = performance.now();
    const fl = (this.flashes ||= {});
    if (ready && fl[id] === false) fl[id] = now;   // just became ready
    if (!ready) fl[id] = false;
    else if (fl[id] === undefined) fl[id] = 0;     // ready from the start: no flash
    const t = (now - (fl[id] || 0)) / 350;
    if (!fl[id] || t >= 1) return;
    ctx.strokeStyle = `rgba(255, 245, 190, ${1 - t})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 2 + t * 14, 0, Math.PI * 2);
    ctx.stroke();
  },

  icon(ctx, img, x, y, size, alpha = 1) {
    if (!img) return;
    const s = size / Math.max(img.width, img.height);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, x - (img.width * s) / 2, y - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.globalAlpha /= alpha;
  },

  /** A dark sweep over a button for what's left of its cooldown, with the seconds big in the middle. */
  cooldown(ctx, x, y, r, cd, max) {
    if (cd <= 0) return;
    const k = clamp(cd / (max || 1), 0, 1);
    ctx.fillStyle = 'rgba(10, 6, 18, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (max < 1) return;
    const label = cd >= 10 ? `${Math.ceil(cd)}` : (Math.ceil(cd * 10) / 10).toFixed(1);
    HUD.text(ctx, label, x, y, { size: r >= 22 ? 10 : 8, align: 'center', baseline: 'middle', color: '#ffffff' });
  },

  draw(ctx, game) {
    const p = game.localPlayer;
    if (!p || game.cutscene) return;
    const L = this.layout();
    const held = (role) => [...this.pointers.values()].find((t) => t.role === role);
    const icons = Sprites.icons[p.classId];
    ctx.save();
    ctx.globalAlpha = Settings.data.touchOpacity ?? 0.85;
    // the scoreboard is open: only pause and its own button show over it
    if (game.run && this.scoreboard) { this.drawCorner(ctx, L, game); ctx.restore(); return; }

    // the aim line from the hero while a thumb aims
    const aiming = held('aim') || TOUCH_AIMED.some((r) => held(r));
    if (aiming && !this.cancelArmed) {
      const h = game.camera.worldToScreen(p.pivotX, p.pivotY);
      ctx.strokeStyle = 'rgba(255, 236, 170, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(h.x + this.aimDir.x * 14, h.y + this.aimDir.y * 14);
      ctx.lineTo(Input._mouse.x, Input._mouse.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // movement stick: where the thumb is, or a faint hint where it usually goes
    const mv = held('move');
    const base = mv ? { x: mv.sx, y: mv.sy } : { x: 120, y: CONFIG.screen.height - 130 };
    ctx.globalAlpha *= mv ? 1 : 0.45;
    this.ring(ctx, base.x, base.y, L.moveR);
    const knob = mv ? this.clampTo(mv, base, L.moveR) : base;
    this.disc(ctx, knob.x, knob.y, 18 * (Settings.data.touchSize || 1), !!mv);
    ctx.globalAlpha /= mv ? 1 : 0.45;

    // aim stick, with the primary attack's icon on its knob
    const am = held('aim');
    this.ring(ctx, L.aim.x, L.aim.y, L.aim.r);
    const ak = am ? this.clampTo(am, L.aim, L.aim.r) : L.aim;
    const kr = L.aim.r * 0.66;
    this.disc(ctx, ak.x, ak.y, kr, !!am);
    this.icon(ctx, icons.primary, ak.x, ak.y, kr * 1.45);
    this.cooldown(ctx, ak.x, ak.y, kr, p.cooldowns.primary, p.maxCooldowns.primary);
    if (!Settings.data.autoFire) HUD.text(ctx, 'AIM', L.aim.x, L.aim.y + L.aim.r + 2, { size: 5, align: 'center', color: '#d8c8a0' });

    for (const b of L.buttons) this.drawButton(ctx, b, p, icons, held(b.id));

    // while a skill is dragged: the CANCEL mark to let go on (lit red when the thumb is on a cancel spot)
    const sk = TOUCH_AIMED.map((r) => held(r)).find((t) => t && (t.moved || t.away));
    if (sk) {
      const c = L.cancel;
      const on = this.cancelArmed;
      this.disc(ctx, c.x, c.y, c.r, false);
      if (on) {
        ctx.fillStyle = 'rgba(200, 30, 40, 0.75)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const s = c.r * 0.4;
      ctx.strokeStyle = on ? '#ffffff' : '#ff6a6a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x - s, c.y - s); ctx.lineTo(c.x + s, c.y + s);
      ctx.moveTo(c.x + s, c.y - s); ctx.lineTo(c.x - s, c.y + s);
      ctx.stroke();
      HUD.text(ctx, 'CANCEL', c.x, c.y + c.r + 4, { size: 6, align: 'center', color: on ? '#ff6a6a' : '#d8c8a0' });
    }

    this.drawCorner(ctx, L, game);
    ctx.restore();

    // a potion being dragged out of the bag follows the thumb
    const bd = held('bag');
    if (bd?.moved && p.inventory[bd.slot]) {
      const img = Sprites.potions[p.inventory[bd.slot].id];
      ctx.drawImage(img, bd.x - img.width / 2, bd.y - img.height / 2);
      if (!HUD.inBag(bd.x, bd.y)) HUD.text(ctx, 'DROP', bd.x, bd.y + 16, { size: 6, align: 'center', color: '#ffe680' });
    }
  },

  /** A thumb is on this touch button right now (and not letting go on a cancel spot). */
  holding(role) {
    if (!this.enabled || this.cancelArmed) return false;
    for (const t of this.pointers.values()) if (t.role === role) return true;
    return false;
  },

  /** Pause, and the scoreboard toggle (dungeon runs). */
  drawCorner(ctx, L, game) {
    this.squareButton(ctx, L.pause, false, (x, y) => {
      ctx.fillStyle = '#f4ead7';
      ctx.fillRect(x - 5, y - 6, 3, 12);
      ctx.fillRect(x + 2, y - 6, 3, 12);
    });
    if (game.run) {
      this.squareButton(ctx, L.score, this.scoreboard, (x, y) => {
        ctx.fillStyle = '#f4ead7';
        for (let i = 0; i < 3; i++) ctx.fillRect(x - 6, y - 5 + i * 4, 12, 2);
      });
    }
  },

  // ---------- layout editor (Settings > Move / resize buttons) ----------
  //
  // The controls over a dimmed screen: drag any of them to move it, tap one and use - / + to
  // resize it. It edits Settings touchLayout like any other setting (Save in Settings keeps it).

  editing: false,
  editSel: null,     // the selected item's id
  editDrag: null,    // the item being dragged: { id, pointerId, lx, ly }

  /** Everything the editor can move: circles { id, x, y, r }, and the bag as a rect. */
  editorItems() {
    const L = this.layout();
    const items = [L.aim, ...L.buttons, L.cancel];
    for (const sq of [L.pause, L.score]) items.push({ id: sq.id, x: sq.x + sq.w / 2, y: sq.y + sq.h / 2, r: sq.w / 2, square: sq });
    const a = this.bagSlotRect(0);
    const b = this.bagSlotRect(4);
    items.push({ id: 'bag', rect: { x: a.x, y: a.y, w: b.x + b.s - a.x, h: a.s } });
    return items;
  },

  /** The toolbar across the top (under the pause and scoreboard buttons, so they can be moved too): [-] [+] [RESET] [DONE]. */
  editorTools() {
    const widths = [['smaller', 40], ['bigger', 40], ['reset', 76], ['done', 76]];
    let x = CONFIG.screen.width / 2 - (widths.reduce((s, [, w]) => s + w, 0) + 8 * 3) / 2;
    return widths.map(([id, w]) => {
      const r = { id, x, y: 58, w, h: 26 };
      x += w + 8;
      return r;
    });
  },

  openEditor() {
    this.editing = true;
    this.editSel = null;
    this.editDrag = null;
    Menus.show(null);
  },

  closeEditor() {
    this.editing = false;
    this.editDrag = null;
    Menus.show('settings');
    Menus.updateSaveState();
  },

  editorDown(pointerId, pos) {
    const custom = (Settings.data.touchLayout ||= {});
    const tool = this.editorTools().find((r) => pos.x >= r.x && pos.x < r.x + r.w && pos.y >= r.y && pos.y < r.y + r.h);
    if (tool) {
      Sound.play('uiClick');
      if (tool.id === 'done') return this.closeEditor();
      if (tool.id === 'reset') { Settings.data.touchLayout = {}; this.editSel = null; return; }
      if (!this.editSel) return;
      const o = (custom[this.editSel] ||= {});
      o.s = Math.round(clamp((o.s || 1) + (tool.id === 'bigger' ? 0.1 : -0.1), 0.6, 1.8) * 10) / 10;
      return;
    }
    const hit = this.editorItems().reverse().find((it) => (it.rect
      ? pos.x >= it.rect.x && pos.x < it.rect.x + it.rect.w && pos.y >= it.rect.y && pos.y < it.rect.y + it.rect.h
      : Math.hypot(pos.x - it.x, pos.y - it.y) <= it.r * 1.2));
    this.editSel = hit ? hit.id : null;
    this.editDrag = hit ? { id: hit.id, pointerId, lx: pos.x, ly: pos.y } : null;
  },

  editorMove(pos) {
    const d = this.editDrag;
    const o = ((Settings.data.touchLayout ||= {})[d.id] ||= {});
    o.x = Math.round((o.x || 0) + pos.x - d.lx);
    o.y = Math.round((o.y || 0) + pos.y - d.ly);
    d.lx = pos.x;
    d.ly = pos.y;
  },

  drawEditor(ctx) {
    const { width: W, height: H } = CONFIG.screen;
    ctx.fillStyle = 'rgba(8, 5, 14, 0.72)';
    ctx.fillRect(0, 0, W, H);
    const icons = Sprites.icons[App.game?.localPlayer?.classId || App.classId];
    const glyphs = { aim: icons.primary, dodge: Sprites.icons.dodge, secondary: icons.secondary, e: icons.e, f: icons.f, ult: icons.q };
    const names = { aim: 'ATTACK', dodge: 'DODGE', secondary: 'SECONDARY', e: 'E', f: 'F', ult: 'ULTIMATE', interact: 'USE', heal: 'HEAL', cancel: 'CANCEL', pause: 'PAUSE', score: 'SCORES', bag: 'BAG' };
    for (const it of this.editorItems()) {
      const sel = it.id === this.editSel;
      if (it.rect) {
        for (let i = 0; i < 5; i++) {
          const s = this.bagSlotRect(i);
          HUD.panel(ctx, s.x, s.y, s.s, s.s);
        }
        HUD.text(ctx, names.bag, it.rect.x + it.rect.w / 2, it.rect.y - 12, { size: 6, align: 'center', color: sel ? '#ffe680' : '#d8c8a0' });
        if (sel) this.selection(ctx, it.rect.x - 4, it.rect.y - 4, it.rect.w + 8, it.rect.h + 8);
        continue;
      }
      if (it.square) {
        this.squareButton(ctx, it.square, sel, () => {});
      } else {
        this.disc(ctx, it.x, it.y, it.r, sel);
        if (glyphs[it.id]) this.icon(ctx, glyphs[it.id], it.x, it.y, it.r * 1.5);
        else if (it.id === 'cancel') HUD.text(ctx, 'X', it.x, it.y, { size: 10, align: 'center', baseline: 'middle', color: '#ff6a6a' });
      }
      HUD.text(ctx, names[it.id], it.x, it.y + it.r + 5, { size: 5, align: 'center', color: sel ? '#ffe680' : '#d8c8a0' });
      if (sel) {
        ctx.strokeStyle = '#ffe680';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // the toolbar, and what to do
    const labels = { smaller: '-', bigger: '+', reset: 'RESET', done: 'DONE' };
    for (const r of this.editorTools()) {
      const off = (r.id === 'smaller' || r.id === 'bigger') && !this.editSel;
      HUD.panel(ctx, r.x, r.y, r.w, r.h);
      HUD.text(ctx, labels[r.id], r.x + r.w / 2, r.y + r.h / 2, { size: r.w < 50 ? 12 : 8, align: 'center', baseline: 'middle', color: off ? '#6a5a4a' : r.id === 'done' ? '#8cff9a' : '#ffe680' });
    }
    const s = this.editSel && (Settings.data.touchLayout?.[this.editSel]?.s || 1);
    const hint = this.editSel ? `${names[this.editSel]}: SIZE ${Math.round(s * 100)}%   (DRAG TO MOVE, - / + TO RESIZE)` : 'DRAG A BUTTON TO MOVE IT - TAP ONE, THEN - / + TO RESIZE IT';
    HUD.text(ctx, hint, W / 2, 92, { size: 6, align: 'center', color: '#d8c8a0' });
  },

  /** The editor's dashed outline round a selected rect. */
  selection(ctx, x, y, w, h) {
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  },

  /** A point pulled back to within r of a base. */
  clampTo(t, base, r) {
    const dx = t.x - base.x;
    const dy = t.y - base.y;
    const len = Math.hypot(dx, dy);
    return len <= r ? { x: t.x, y: t.y } : { x: base.x + (dx / len) * r, y: base.y + (dy / len) * r };
  },

  /** A stick's base: a dark well with a gold rim. */
  ring(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(14, 8, 22, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#8a6a26';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  squareButton(ctx, r, lit, glyph) {
    HUD.panel(ctx, r.x, r.y, r.w, r.h);
    if (lit) {
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    glyph(r.x + r.w / 2, r.y + r.h / 2);
  },

  drawButton(ctx, b, p, icons, thumb) {
    const { x, y, r } = b;
    // a dragged skill button's knob follows the thumb a little, so it's clear it's aiming
    const at = thumb && TOUCH_AIMED.includes(b.id) ? this.clampTo(thumb, b, r * 0.8) : b;
    if (at !== b) this.ring(ctx, x, y, r);
    const lit = !!thumb || (b.id !== 'dodge' && b.id !== 'heal' && b.id !== 'interact' && p.slotHeld(b.id));
    this.disc(ctx, at.x, at.y, r, lit);
    if (thumb && this.cancelArmed && TOUCH_AIMED.includes(b.id)) {
      ctx.fillStyle = 'rgba(200, 30, 40, 0.6)';
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (b.id === 'ult') {
      // the charge fills a gold ring round it; full, it glows and its icon lights up
      const fill = clamp(p.ult / p.ultMax, 0, 1);
      const ready = p.ultReady;
      if (ready) this.glow(ctx, at.x, at.y, r, 1.8);
      ctx.strokeStyle = 'rgba(14, 8, 22, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ready ? '#ffe680' : '#f2a541';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r + 5, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      ctx.stroke();
      this.icon(ctx, icons.q, at.x, at.y, r * 1.5, ready ? 1 : 0.4);
      if (!ready) HUD.text(ctx, `${Math.floor(fill * 100)}%`, at.x, at.y, { size: 9, align: 'center', baseline: 'middle', color: '#f4ead7' });
      this.readyFlash(ctx, 'ult', ready, at.x, at.y, r);
      return;
    }
    if (b.id === 'interact') {
      HUD.text(ctx, 'USE', at.x, at.y, { size: 8, align: 'center', baseline: 'middle', color: '#ffe680' });
      return;
    }
    if (b.id === 'heal') {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(at.x - 4, at.y - 9, 9, 15);
      ctx.fillRect(at.x - 8, at.y - 5, 17, 7);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(at.x - 2, at.y - 7, 5, 11);
      ctx.fillRect(at.x - 6, at.y - 3, 13, 3);
      HUD.text(ctx, 'HEAL', at.x, at.y + r + 4, { size: 5, align: 'center', color: '#d8c8a0' });
      return;
    }
    const cd = p.cooldowns[b.id];
    const short = b.id !== 'dodge' && !p.canAfford(b.id);
    const ready = cd <= 0 && !short;
    if (ready && !thumb) this.glow(ctx, at.x, at.y, r);
    const icon = b.id === 'dodge' ? Sprites.icons.dodge : icons[b.id];
    this.icon(ctx, icon, at.x, at.y, r * 1.5, cd > 0 ? 0.45 : 1);
    this.cooldown(ctx, at.x, at.y, r, cd, p.maxCooldowns[b.id]);
    if (short) {
      // not enough mana / energy / light: a red wash, and what's missing underneath
      this.circle(ctx, at.x, at.y, r - 2, 'rgba(120, 10, 16, 0.55)');
      HUD.text(ctx, `NO ${p.resource.name}`, at.x, at.y + r + 4, { size: 5, align: 'center', color: '#ff6a6a' });
    }
    this.readyFlash(ctx, b.id, ready, at.x, at.y, r);
    // stored uses: a little gold badge on the rim
    const charges = b.id === 'dodge' ? Upgrades.dodgeCharges(p) : p.slotCharges?.[b.id];
    if (charges) {
      const bx = at.x + r * 0.72;
      const by = at.y - r * 0.72;
      this.circle(ctx, bx, by, 8, OUTLINE);
      this.circle(ctx, bx, by, 7, charges.count ? '#d4ac4c' : '#5a4a3a');
      HUD.text(ctx, `${charges.count}`, bx, by + 1, { size: 7, align: 'center', baseline: 'middle', color: charges.count ? '#2e1f17' : '#a99a88', shadow: false });
    }
  },
};
