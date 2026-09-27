// The game world: a grid the miner walks around in.
// Used by both the Python worker (to run code) and the page (to animate it),
// so it must stay free of DOM code.
(function (root) {
  'use strict';

  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const CHAR = { '.': 'air', 'o': 'air', 'P': 'air', 'B': 'wall', '#': 'stone', 'D': 'diamond', 'L': 'lava', 'W': 'water', 'C': 'chest', 'T': 'tree' };
  const WALKABLE = { air: 1, bridge: 1, chest: 1 };
  const MINEABLE = { stone: 'stone', diamond: 'diamond', tree: 'wood' };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class World {
    constructor(layout) {
      this.layout = layout;
      this.h = layout.rows.length;
      this.w = layout.rows[0].length;
      this.grid = [];
      this.floor = [];
      this.targets = [];
      layout.rows.forEach((row, y) => {
        this.grid.push([]);
        this.floor.push([]);
        row.split('').forEach((ch, x) => {
          this.grid[y].push(CHAR[ch] || 'air');
          this.floor[y].push('');
          if (ch === 'P') { this.x = x; this.y = y; }
          if (ch === 'o' || (ch === 'P' && layout.startOnTarget)) this.targets.push([x, y]);
        });
      });
      this.dir = 'NESW'.indexOf(layout.dir || 'E');
      this.inv = { stone: 0, diamond: 0, wood: 0 };
      this.said = [];
    }

    cell(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 'wall';
      return this.grid[y][x];
    }

    front() {
      const [dx, dy] = DIRS[this.dir];
      return [this.x + dx, this.y + dy];
    }

    ahead() {
      const [x, y] = this.front();
      return this.cell(x, y);
    }

    here() { return this.cell(this.x, this.y); }

    isTarget(x, y) { return this.targets.some(([tx, ty]) => tx === x && ty === y); }

    missingTargets() {
      return this.targets.filter(([x, y]) => this.floor[y][x] !== 'planks').length;
    }

    // Returns {fatal} to stop the program, {value} for sensors, {note} for harmless events.
    do(name, arg) {
      const [fx, fy] = this.front();
      const c = this.ahead();
      switch (name) {
        case 'move':
          if (WALKABLE[c]) { this.x = fx; this.y = fy; return {}; }
          if (c === 'lava') return { fatal: 'lava' };
          if (c === 'water') return { fatal: 'water' };
          return { fatal: 'bump:' + c };
        case 'turn_left': this.dir = (this.dir + 3) % 4; return {};
        case 'turn_right': this.dir = (this.dir + 1) % 4; return {};
        case 'mine':
          if (MINEABLE[c]) {
            this.grid[fy][fx] = 'air';
            this.inv[MINEABLE[c]]++;
            return { value: c, note: 'mined:' + c };
          }
          if (c === 'wall') return { value: 'nothing', note: 'too_hard' };
          return { value: 'nothing', note: 'swing' };
        case 'place':
          if (c === 'lava' || c === 'water') { this.grid[fy][fx] = 'bridge'; return { note: 'bridge' }; }
          return { note: 'nothing_to_bridge' };
        case 'build':
          this.floor[this.y][this.x] = 'planks';
          return { note: 'build' };
        case 'say':
          this.said.push(String(arg));
          return { note: 'say' };
        case 'ahead':
          return { value: c };
      }
      return {};
    }
  }

  root.World = World;
  root.makeRng = rng;
})(typeof self !== 'undefined' ? self : this);
