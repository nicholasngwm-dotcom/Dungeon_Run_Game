// Multiplayer chat: Enter opens a box to type in, Enter sends (Esc cancels). Messages go through
// the host (Session.sendChat / relayChat), outside the simulation, so they can't upset the sync.
//
//   hello everyone               to everyone
//   /whisper <name> <message>    only that player sees it (also /w, /msg, /tell; names ignore case)
//   /help                        the commands
//
// Recent lines sit above the bag and fade after a while; while the box is open the whole recent
// history shows. Only in multiplayer: in single player, Enter just says so (a toast).

const CHAT_FADE = 10;      // seconds a line stays up when the box is closed
const CHAT_LINES = 50;     // lines kept

const Chat = {
  isOpen: false,

  init(app) {
    this.app = app;
    this.el = document.getElementById('chat');
    this.logEl = document.getElementById('chat-log');
    this.input = document.getElementById('chat-input');
    // caught first (capture): Enter opens it while playing online; while it's open Esc closes it
    // (never reaching the game, where Esc would open the menu)
    window.addEventListener('keydown', (e) => {
      if (this.isOpen) {
        if (e.code !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (this.app.state !== 'playing' || Cheats.isOpen) return;
      e.preventDefault();
      // single player: say so, rather than Enter quietly doing nothing
      if (!this.app.mp) { if (!e.repeat) Menus.toast('CHAT IS ONLY IN MULTIPLAYER', '#a99bbd'); return; }
      this.open();
    }, true);
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();   // typing never moves the hero
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
      e.preventDefault();
      const text = this.input.value.trim();
      this.input.value = '';
      if (text) this.say(text);
      this.close();
    });
  },

  open() {
    this.isOpen = true;
    Input.reset();   // let go of whatever was held, so the hero stops
    this.el.classList.add('open');
    this.el.classList.remove('hidden');
    this.logEl.scrollTop = this.logEl.scrollHeight;
    setTimeout(() => this.input.focus(), 0);
  },

  close() {
    this.isOpen = false;
    this.input.value = '';
    this.input.blur();
    this.el.classList.remove('open');
    Input.reset();
  },

  /** Leaving multiplayer: the box closes and the log is cleared. */
  reset() {
    if (this.isOpen) this.close();
    this.logEl.textContent = '';
    this.el.classList.add('hidden');
    this.hinted = false;
  },

  /** Joining a game: how to use it, once. */
  hint() {
    if (this.hinted) return;
    this.hinted = true;
    this.system('Press Enter to chat. /whisper <name> <message> to talk to one player.');
  },

  /** A typed line: a command, or a message to everyone. */
  say(text) {
    const s = this.app.mp;
    if (!s) return;
    if (!text.startsWith('/')) return s.sendChat(text);
    const [cmd] = text.slice(1).split(/\s+/, 1);
    const rest = text.slice(1 + cmd.length).trim();
    switch (cmd.toLowerCase()) {
      case 'w':
      case 'whisper':
      case 'msg':
      case 'tell': {
        // the longest player name the rest starts with (names can have spaces in them)
        const lower = rest.toLowerCase();
        const to = s.roster
          .filter((r) => !r.bot && r.id !== s.id && (lower === r.name.toLowerCase() || lower.startsWith(`${r.name.toLowerCase()} `)))
          .sort((a, b) => b.name.length - a.name.length)[0];
        if (!to) {
          const name = rest.split(/\s+/)[0];
          return this.system(name ? `No player called "${name}". Players: ${this.others(s)}` : 'Usage: /whisper <name> <message>');
        }
        const msg = rest.slice(to.name.length).trim();
        if (!msg) return this.system(`Usage: /whisper ${to.name} <message>`);
        return s.sendChat(msg, to.id);
      }
      case 'help':
      case '?':
        this.system('Enter: chat to everyone.  /whisper <name> <message> (or /w): only they see it.');
        return this.system(`Players: ${this.others(s)}`);
      default:
        return this.system(`Unknown command /${cmd}. Type /help.`);
    }
  },

  /** The other players' names, for the help and "no such player" lines. */
  others(s) {
    const names = s.roster.filter((r) => !r.bot && r.id !== s.id).map((r) => r.name);
    return names.length ? names.join(', ') : '(nobody else here yet)';
  },

  /** A message from the host: { from, fromId, text, whisper?, toName?, toId? }. */
  receive(m) {
    const me = this.app.mp?.id;
    const line = document.createElement('div');
    const who = document.createElement('b');
    if (m.whisper) {
      line.className = 'whisper';
      who.textContent = m.fromId === me ? `To ${m.toName}: ` : `${m.from} whispers: `;
    } else {
      if (m.fromId === me) line.className = 'mine';
      who.textContent = `${m.from}: `;
    }
    line.append(who, document.createTextNode(m.text));
    this.addLine(line);
    if (!this.isOpen && m.fromId !== me) Sound.play('talk');
  },

  /** A note just for this player (help, mistakes). */
  system(text) {
    const line = document.createElement('div');
    line.className = 'system';
    line.textContent = text;
    this.addLine(line);
  },

  addLine(line) {
    this.el.classList.remove('hidden');
    this.logEl.appendChild(line);
    while (this.logEl.childElementCount > CHAT_LINES) this.logEl.firstChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
    // it fades out after a while (it's shown again whenever the box is open)
    setTimeout(() => line.classList.add('old'), CHAT_FADE * 1000);
  },
};
