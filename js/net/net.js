// Peer-to-peer connections (WebRTC through PeerJS). The free PeerJS cloud
// server only introduces the players to each other; game traffic then goes
// directly between browsers. The host's PeerJS id is the room code plus a
// prefix, so friends join by typing the code.
//
// Players on mobile data and many ISPs can't connect directly (carrier NAT), so
// the connection falls back to a TURN relay from CONFIG.multiplayer.turnCredentialsUrl.
//
// Net.host / Net.join return a transport for Session: { send, broadcast, close }.

const Net = {
  peer: null,
  conns: new Map(),    // peer id -> DataConnection (host: every client; client: just the host)
  extraIce: null,      // ICE servers fetched from turnCredentialsUrl (once per page)

  get available() { return typeof Peer !== 'undefined'; },

  /**
   * Errors that only mean the matchmaking server dropped out. Once players are connected
   * their game traffic goes straight between them, so these mustn't end the game: the
   * peer just reconnects to the server in the background.
   */
  signalingError(e) {
    return ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e && e.type);
  },

  /** PeerJS options with our ICE servers (STUN + TURN relays). */
  async peerOptions() {
    const mp = CONFIG.multiplayer;
    if (mp.turnCredentialsUrl && !(this.extraIce && this.extraIce.length)) {
      try {
        const res = await fetch(mp.turnCredentialsUrl, { signal: AbortSignal.timeout(mp.turnFetchTimeout * 1000) });
        const list = await res.json();
        this.extraIce = Array.isArray(list) ? list : [];
      } catch (e) { this.extraIce = []; /* relay service down or slow: try with the rest (and again next time) */ }
    }
    return { config: { iceServers: [...mp.iceServers, ...(this.extraIce || [])] } };
  },

  /** True once a TURN relay is available, so players behind carrier NAT can still connect. */
  get hasRelay() {
    return [...CONFIG.multiplayer.iceServers, ...(this.extraIce || [])]
      .some(s => [].concat(s.urls).some(u => /^turns?:/.test(u)));
  },

  /** Calls onFail if a data connection's network route fails (e.g. no relay got through). */
  watchIce(conn, onFail) {
    const pc = conn.peerConnection;
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed') onFail();
    });
  },

  /** A random room code from letters that are hard to mix up. */
  makeCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < CONFIG.multiplayer.codeLength; i++) s += letters[Math.floor(nativeRandom() * letters.length)];
    return s;
  },

  transport() {
    return {
      send: (to, msg) => {
        const c = to === 'host' ? this.conns.values().next().value : this.conns.get(to);
        if (c && c.open) c.send(msg);
      },
      broadcast: (msg) => { for (const c of this.conns.values()) if (c.open) c.send(msg); },
      close: () => this.close(),
    };
  },

  /**
   * Opens a room. h: { onOpen(code), onData(peer, msg), onJoin(peer), onLeave(peer), onError(text) }.
   * A taken code (very unlikely) just retries with a new one.
   */
  async host(h, tries = 0) {
    if (!this.available) return h.onError('Could not load the multiplayer library. Check your internet connection.');
    if (!tries) this.close();   // never two rooms (or a room and a half-made join) at once
    const code = this.makeCode();
    const peer = new Peer(CONFIG.multiplayer.peerPrefix + code, await this.peerOptions());
    this.peer = peer;
    let opened = false;
    peer.on('open', () => {
      if (opened) return;   // (reconnecting to the matchmaking server opens it again)
      opened = true;
      h.onOpen(code);
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        h.onJoin?.(conn.peer);
      });
      conn.on('data', (msg) => h.onData(conn.peer, msg));
      conn.on('close', () => {
        this.conns.delete(conn.peer);
        h.onLeave(conn.peer);
      });
      conn.on('error', () => {});
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 5) {
        peer.destroy();
        return this.host(h, tries + 1);
      }
      if (opened && Net.signalingError(e)) return;   // the room stays up; players stay connected
      h.onError(Net.describe(e));
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  },

  /** Joins a room by code. h: { onOpen(), onData(peer, msg), onClose(), onError(text) }. */
  async join(code, h) {
    if (!this.available) return h.onError('Could not load the multiplayer library. Check your internet connection.');
    this.close();   // a new attempt replaces any earlier one (clicking Join again never makes a second player)
    const peer = new Peer(await this.peerOptions());
    this.peer = peer;
    let opened = false, failed = false;
    // the room exists (no peer-unavailable error) but no network route got through
    const noRoute = () => {
      if (opened || failed) return;
      failed = true;
      h.onError(Net.hasRelay
        ? `Found room ${code.toUpperCase()} but couldn't connect to it, even through the relay server. Try again in a moment, or try another network.`
        : `Found room ${code.toUpperCase()} but couldn't connect to it. Your network or the host's blocks direct connections (common on mobile data and some ISPs) and no relay server is set up.`);
    };
    peer.on('open', () => {
      const conn = peer.connect(CONFIG.multiplayer.peerPrefix + code.toUpperCase(), { reliable: true, serialization: 'json' });
      this.watchIce(conn, noRoute);
      conn.on('open', () => {
        opened = true;
        this.conns.set('host', conn);
        h.onOpen();
      });
      conn.on('data', (msg) => h.onData('host', msg));
      conn.on('close', () => { this.conns.delete('host'); if (opened) h.onClose(); });
      setTimeout(() => {
        if (opened || failed) return;
        const ice = conn.peerConnection && conn.peerConnection.iceConnectionState;
        if (ice && ice !== 'new') noRoute();   // the host answered, the connection didn't
        else h.onError(`Couldn't reach room ${code.toUpperCase()}. Check the code and try again.`);
      }, CONFIG.multiplayer.joinTimeout * 1000);
    });
    peer.on('error', (e) => {
      if (opened && (Net.signalingError(e) || e.type === 'peer-unavailable')) return;   // already connected to the host: carry on
      h.onError(e.type === 'peer-unavailable' ? `No room called ${code.toUpperCase()}.` : Net.describe(e));
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  },

  close() {
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* already gone */ } }
    this.conns.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* already gone */ } }
    this.peer = null;
  },

  describe(e) {
    switch (e.type) {
      case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
        return 'Could not reach the matchmaking server. Check your internet connection.';
      case 'browser-incompatible': return 'This browser does not support multiplayer.';
      default: return `Connection problem (${e.type || e.message || 'unknown'}).`;
    }
  },
};
