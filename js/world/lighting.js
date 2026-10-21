// Darkness with pools of light, shared by the lobby's night and the graveyard's
// eerie gloom. A tinted dark layer covers the screen; each light cuts a soft hole
// in it, then its own colour blooms on top (stronger the darker it is). Visual only.

const Lighting = {
  canvas: null,

  /**
   * lights: [{ x, y, r (reach), s (how much darkness it cuts, 0-1), rgb (its glow, optional) }]
   * opts.dark: how dark it gets (0-1); opts.color: the darkness's rgb tint;
   * opts.bloom: how strongly lights glow; opts.cut(lc, ox, oy): extra cut-outs (e.g. moonlit yards);
   * opts.tint: a colour washed over everything (dusk, dawn).
   */
  draw(ctx, cam, lights, { dark, color = '12, 14, 40', bloom = 0.22, cut = null, tint = null } = {}) {
    if (dark <= 0.01 && !tint) return;
    const W = cam.width;
    const H = cam.height;
    if (!this.canvas || this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const lc = this.canvas.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = `rgba(${color}, ${dark})`;
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const ox = Math.round(cam.x + cam.offsetX);   // follow the screen shake too
    const oy = Math.round(cam.y + cam.offsetY);
    if (cut) cut(lc, ox, oy);
    const onScreen = (l) => l.x - ox > -l.r && l.y - oy > -l.r && l.x - ox < W + l.r && l.y - oy < H + l.r;
    for (const l of lights) {
      if (!onScreen(l)) continue;
      const x = l.x - ox;
      const y = l.y - oy;
      const g = lc.createRadialGradient(x, y, 0, x, y, l.r);
      g.addColorStop(0, `rgba(0, 0, 0, ${l.s})`);
      g.addColorStop(0.55, `rgba(0, 0, 0, ${l.s * 0.6})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lc.fillStyle = g;
      lc.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(this.canvas, ox, oy);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.rgb || !onScreen(l)) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.7);
      g.addColorStop(0, `rgba(${l.rgb}, ${bloom * dark})`);
      g.addColorStop(1, `rgba(${l.rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.restore();
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(ox, oy, W, H);
    }
  },
};
