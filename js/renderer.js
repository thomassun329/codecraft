// Draws a World on a canvas and replays recorded actions as a smooth animation.
(function () {
  'use strict';

  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const PARTICLE = { stone: '#8a8a8a', diamond: '#4fe3e0', tree: '#3b8a2b', wood: '#a0662a' };
  const MAX_ANIMATED = 150;
  let TEX = null;

  class WorldView {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!TEX) TEX = Sprites.buildTextures();
      this.particles = [];
      this.bubble = null;
      this.shake = 0;
      this.flash = null;
      this.queue = [];
      this.alive = true;
      this.t0 = performance.now();
      const tick = (now) => {
        if (!this.alive) return;
        this.step(now);
        this.draw(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    destroy() { this.alive = false; }

    setWorld(world, skin) {
      this.world = world;
      this.skin = skin;
      this.art = Sprites.playerArt(skin);
      this.pos = { x: world.x, y: world.y, fx: world.x, fy: world.y };
      this.queue = [];
      this.current = null;
      this.particles = [];
      this.bubble = null;
      this.flash = null;
      this.resize();
    }

    resize() {
      if (!this.world) return;
      const box = this.canvas.parentElement.getBoundingClientRect();
      const maxW = Math.max(200, box.width - 8);
      const maxH = Math.max(200, Math.min(window.innerHeight * 0.55, 480));
      this.tile = Math.floor(Math.min(maxW / this.world.w, maxH / this.world.h, 64));
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.world.w * this.tile * dpr;
      this.canvas.height = this.world.h * this.tile * dpr;
      this.canvas.style.width = this.world.w * this.tile + 'px';
      this.canvas.style.height = this.world.h * this.tile + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
    }

    // actions: [{a, arg, note}]; speed: 0.5..4; onAction(action) fires as each starts.
    play(actions, speed, onAction) {
      return new Promise((resolve) => {
        this.queue = actions.slice();
        this.played = 0;
        this.speed = speed;
        this.onAction = onAction;
        this.onDone = resolve;
        this.current = null;
        // Frames don't tick in a hidden tab, so don't wait on them.
        if (!actions.length || document.hidden) this.skip();
      });
    }

    skip() {
      // Finish instantly: apply everything that's left.
      if (this.current) this.finishCurrent();
      while (this.queue.length) {
        const act = this.queue.shift();
        this.apply(act);
        if (this.onAction) this.onAction(act, true);
      }
      this.pos = { x: this.world.x, y: this.world.y, fx: this.world.x, fy: this.world.y };
      if (this.onDone) { const d = this.onDone; this.onDone = null; d(); }
    }

    apply(act) {
      if (act.a === 'fatal') return;
      this.world.do(act.a, act.arg);
    }

    finishCurrent() {
      this.current = null;
      this.pos = { x: this.world.x, y: this.world.y, fx: this.world.x, fy: this.world.y };
    }

    step(now) {
      if (this.current) {
        const k = (now - this.current.start) / this.current.dur;
        if (k >= 1) this.finishCurrent();
        else if (this.current.act.a === 'move') {
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          this.pos.fx = this.current.from[0] + (this.world.x - this.current.from[0]) * e;
          this.pos.fy = this.current.from[1] + (this.world.y - this.current.from[1]) * e;
        } else if (this.current.act.a === 'fatal' && this.current.act.arg.startsWith('bump')) {
          const [dx, dy] = DIRS[this.world.dir];
          const b = Math.sin(k * Math.PI) * 0.25;
          this.pos.fx = this.world.x + dx * b;
          this.pos.fy = this.world.y + dy * b;
        }
        return;
      }
      if (!this.queue.length) {
        if (this.onDone) { const d = this.onDone; this.onDone = null; d(); }
        return;
      }
      // Very long runs (e.g. a loop that hit the step limit) jump to the end.
      if (this.played >= MAX_ANIMATED) { this.skip(); return; }
      this.played++;
      const act = this.queue.shift();
      const from = [this.world.x, this.world.y];
      const front = this.world.front();
      this.apply(act);
      const base = act.a === 'move' ? 320 : act.a === 'fatal' ? 600 : act.a.startsWith('turn') ? 160 : 260;
      this.current = { act, start: now, dur: base / (this.speed || 1), from };
      this.effects(act, front, now);
      if (this.onAction) this.onAction(act, false);
    }

    effects(act, front, now) {
      const t = this.tile;
      const cx = (front[0] + 0.5) * t, cy = (front[1] + 0.5) * t;
      if (act.note && act.note.startsWith('mined:')) {
        const col = PARTICLE[act.note.slice(6)] || '#999';
        for (let i = 0; i < 14; i++) {
          this.particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.8) * 4, life: 1, col: i % 3 ? col : '#ffffff' });
        }
      }
      if (act.a === 'place' && act.note === 'bridge') {
        for (let i = 0; i < 8; i++) this.particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 1, col: '#b0834a' });
      }
      if (act.a === 'build') {
        const bx = (this.world.x + 0.5) * t, by = (this.world.y + 0.5) * t;
        for (let i = 0; i < 8; i++) this.particles.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 1, col: '#f2d15c' });
      }
      if (act.a === 'say') this.bubble = { text: act.arg, until: now + 1800 };
      if (act.a === 'fatal') {
        this.shake = 12;
        this.flash = { col: act.arg === 'lava' ? 'rgba(255,80,0,' : 'rgba(255,40,40,', until: now + 500 };
      }
    }

    draw(now) {
      const w = this.world;
      if (!w) return;
      const ctx = this.ctx, t = this.tile;
      ctx.save();
      if (this.shake > 0) {
        ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        this.shake *= 0.85;
        if (this.shake < 0.5) this.shake = 0;
      }
      const lavaFrame = Math.floor(now / 450) % 2;
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        const c = w.grid[y][x];
        let tex = TEX[c] || TEX.air;
        if (c === 'lava') tex = TEX.lava[(lavaFrame + x + y) % 2];
        if (c === 'chest' || c === 'bridge') ctx.drawImage(c === 'bridge' ? TEX.lava[0] : TEX.air, x * t, y * t, t, t);
        ctx.drawImage(tex, x * t, y * t, t, t);
        if (w.floor[y][x] === 'planks') ctx.drawImage(TEX.planks, x * t, y * t, t, t);
        else if (w.isTarget(x, y)) {
          const a = 0.45 + 0.35 * Math.sin(now / 300 + x + y);
          ctx.strokeStyle = `rgba(255, 220, 60, ${a})`;
          ctx.lineWidth = Math.max(2, t / 12);
          ctx.setLineDash([t / 6, t / 8]);
          ctx.strokeRect(x * t + t * 0.12, y * t + t * 0.12, t * 0.76, t * 0.76);
          ctx.setLineDash([]);
        }
      }
      // chest glow
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        if (w.grid[y][x] === 'chest' && !(w.x === x && w.y === y)) {
          const a = 0.25 + 0.2 * Math.sin(now / 250);
          ctx.fillStyle = `rgba(255, 215, 80, ${a})`;
          ctx.fillRect(x * t, y * t, t, t / 10);
        }
      }
      // player
      const bob = this.current && this.current.act.a === 'move' ? Math.sin((now - this.current.start) / 40) * t * 0.03 : 0;
      const px = this.pos.fx * t + t * 0.14, py = this.pos.fy * t + t * 0.14 + bob, ps = t * 0.72;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(px + ps * 0.1, py + ps + t * 0.04, ps * 0.8, t * 0.06);
      Sprites.drawArt(ctx, this.art, px, py, ps);
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, ps, ps);
      this.drawArrow(ctx, this.pos.fx, this.pos.fy, w.dir, t);
      // particles
      this.particles = this.particles.filter((p) => p.life > 0);
      this.particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x, p.y, t / 10, t / 10);
      });
      ctx.globalAlpha = 1;
      if (this.bubble && now < this.bubble.until) this.drawBubble(ctx, this.bubble.text, this.pos.fx * t + t / 2, this.pos.fy * t, t);
      ctx.restore();
      if (this.flash && now < this.flash.until) {
        const a = (this.flash.until - now) / 500 * 0.5;
        ctx.fillStyle = this.flash.col + a + ')';
        ctx.fillRect(0, 0, w.w * t, w.h * t);
      }
    }

    drawArrow(ctx, fx, fy, dir, t) {
      const cx = (fx + 0.5) * t, cy = (fy + 0.5) * t;
      const [dx, dy] = DIRS[dir];
      const tipX = cx + dx * t * 0.5, tipY = cy + dy * t * 0.5;
      const bx = cx + dx * t * 0.36, by = cy + dy * t * 0.36;
      const s = t * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx - dy * s, by + dx * s);
      ctx.lineTo(bx + dy * s, by - dx * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    drawBubble(ctx, text, x, y, t) {
      ctx.font = `bold ${Math.max(12, t * 0.3)}px Nunito, sans-serif`;
      const w = ctx.measureText(text).width + 16, h = Math.max(22, t * 0.5);
      const bx = Math.max(2, Math.min(x - w / 2, this.world.w * t - w - 2));
      const by = Math.max(2, y - h - 6);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, w, h);
      ctx.strokeRect(bx, by, w, h);
      ctx.fillStyle = '#111';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 8, by + h / 2 + 1);
    }
  }

  // A single tile as a small canvas (for the legend under the map).
  WorldView.tile = function (kind, size, target) {
    if (!TEX) TEX = Sprites.buildTextures();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tex = kind === 'lava' ? TEX.lava[0] : TEX[kind] || TEX.air;
    if (kind === 'chest' || kind === 'bridge') ctx.drawImage(kind === 'bridge' ? TEX.lava[0] : TEX.air, 0, 0, size, size);
    ctx.drawImage(tex, 0, 0, size, size);
    if (target) {
      ctx.strokeStyle = 'rgba(255, 220, 60, .9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(3, 3, size - 6, size - 6);
    }
    return c;
  };

  window.WorldView = WorldView;
})();
