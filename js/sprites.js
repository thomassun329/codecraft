// 8x8 pixel-art faces for mobs and the player, plus procedural block textures.
(function () {
  'use strict';

  const MOB_ART = {
    1: { pal: { g: '#5dbb4a', d: '#3f8f33', k: '#111' }, px: ['gdggdggd', 'dgggggdg', 'gkkggkkg', 'gkkggkkg', 'gggkkggg', 'ggkkkkgd', 'dgkkkkgg', 'ggkggkgg'] },
    2: { pal: { h: '#2f6b3a', z: '#5a9c5a', k: '#111', d: '#3d7a45' }, px: ['hhhhhhhh', 'hhzzzzhh', 'zzzzzzzz', 'zkkzzkkz', 'zzzddzzz', 'zzdzzdzz', 'zzzzzzzz', 'zdzzzzdz'] },
    3: { pal: { w: '#d8d8d8', g: '#a8a8a8', k: '#222' }, px: ['wwwwwwww', 'wwgwwwww', 'wkkwwkkw', 'wkkwwkkw', 'wwwkkwww', 'wgggggwg', 'wkwkwkww', 'wwwwwwww'] },
    4: { pal: { b: '#3a302a', d: '#2a221c', r: '#e02b2b' }, px: ['bdbbbbdb', 'bbbbbbbb', 'brrbbrrb', 'bbrbbrbb', 'rrbbbbrr', 'bbbbbbbb', 'bdbbbbdb', 'bbbbbbbb'] },
    5: { pal: { k: '#161616', p: '#c35cf0', m: '#eab0ff' }, px: ['kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', 'mppkkppm', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk'] },
    6: { pal: { y: '#f7c43a', o: '#e38b16', k: '#4a2a0a' }, px: ['yyoyyoyy', 'yyyyyyyy', 'ykkyykky', 'yyyyyyyy', 'yokkkkoy', 'yyyyyyyy', 'oyyooyyo', 'yyyyyyyy'] },
    7: { pal: { w: '#f0f0f0', g: '#cfcfcf', k: '#333', r: '#c33' }, px: ['wwwwwwww', 'wgwwwwgw', 'wkkwwkkw', 'wrwwwwrw', 'wwwwwwww', 'wwkkkkww', 'wwkkkkww', 'wgwwwwgw'] },
    8: { pal: { k: '#2a2a2a', d: '#454545', b: '#0a0a0a' }, px: ['kkkkkkkk', 'kdkkkkdk', 'kbbkkbbk', 'kbbkkbbk', 'kkkbbkkk', 'kdddddkk', 'kbkbkbkk', 'kkkkkkkk'] },
    9: { pal: { s: '#7ec96b', d: '#5aa84a', k: '#1e4a16' }, px: ['ssssssss', 'sddsssss', 'skksskks', 'skksskks', 'ssssssss', 'sssskkss', 'ssssssss', 'sssssdds'] },
    10: { pal: { t: '#123a4a', c: '#1ec8d2', d: '#0b2530' }, px: ['tdttttdt', 'cttttttc', 'tttttttt', 'tcttttct', 'tttttttt', 'ttddddtt', 'tdttttdt', 'tttttttt'] },
    11: { pal: { i: '#d9d3c7', g: '#b0a998', r: '#8a2a2a', v: '#5a8f3a' }, px: ['iiiiiiii', 'igiiiigi', 'irgiigri', 'iiiggiii', 'iiiggiii', 'viiggiiv', 'iiiiiiii', 'iviiiivi'] },
    12: { pal: { w: '#e6e1dc', g: '#bcb6ad', k: '#222' }, px: ['wwwwwwww', 'wgwwwwgw', 'wkwwwwkw', 'wwwwwwww', 'wwggggww', 'wwgkkgww', 'wwggggww', 'wwwwwwww'] },
    13: { pal: { y: '#f2c12e', k: '#2a2a2a', w: '#ffffff' }, px: ['yyyyyyyy', 'yyyyyyyy', 'kkyyyykk', 'wkyyyykw', 'yyyyyyyy', 'kkkkkkkk', 'yyyyyyyy', 'kkkkkkkk'] },
    14: { pal: { p: '#f0a5a2', d: '#d67c7a', k: '#222', w: '#fff' }, px: ['pppppppp', 'pppppppp', 'wkppppkw', 'pppppppp', 'ppddddpp', 'ppdkkdpp', 'ppddddpp', 'pppppppp'] },
    15: { pal: { b: '#4a3526', w: '#e8e8e8', k: '#111' }, px: ['bbbbbbbb', 'bwbbbbbb', 'kwbbbbwk', 'bbbbbbbb', 'bbwwwwbb', 'bwkwwkwb', 'bwwwwwwb', 'bbbbbbbb'] },
    16: { pal: { w: '#f2f2f2', f: '#d9c3a6', k: '#222', d: '#c29078' }, px: ['wwwwwwww', 'wwffffww', 'wfkffkfw', 'wffffffw', 'wffddffw', 'wwffffww', 'wwwwwwww', 'wwwwwwww'] },
    17: { pal: { w: '#fafafa', y: '#f5a623', r: '#d62a2a', k: '#222' }, px: ['wwwwwwww', 'wwwwwwww', 'wkwwwwkw', 'wwyyyyww', 'wwyyyyww', 'wwwrrwww', 'wwwrrwww', 'wwwwwwww'] },
    18: { pal: { h: '#5d4430', s: '#c28a64', k: '#4a2e1c', g: '#3a8f3a', w: '#fff', d: '#a06c4c' }, px: ['hhhhhhhh', 'ssssssss', 'kkkkkkkk', 'swgssgws', 'sssddsss', 'sssddsss', 'ssddddss', 'ssssssss'] },
    19: { pal: { p: '#f4a7c7', d: '#e07aa6', k: '#222', r: '#d24a8a' }, px: ['rppppppr', 'pppppppp', 'pkppppkp', 'pppppppp', 'pppddppp', 'pppppppp', 'rppppppr', 'pppppppp'] },
    20: { pal: { o: '#e3862b', w: '#f5f0e6', k: '#222' }, px: ['oooooooo', 'owooooow', 'okwoowko', 'oooooooo', 'wwwkkwww', 'wwwwwwww', 'owwwwwwo', 'oooooooo'] },
  };

  const SKINS = {
    none: null, iron: '#d8d8d8', gold: '#f2c94c', diamond: '#4fe3e0',
  };

  function playerArt(skin) {
    const pal = { h: '#3b2a1a', s: '#c69c7b', w: '#ffffff', b: '#3f5fbf', m: '#6b3a2a', n: '#a97a5c' };
    const px = ['hhhhhhhh', 'hhhhhhhh', 'hssssssh', 'swbssbws', 'ssssssss', 'sssnnsss', 'ssmmmmss', 'ssssssss'];
    if (SKINS[skin]) {
      pal.a = SKINS[skin];
      pal.A = shade(SKINS[skin], -40);
      px[0] = 'aAaaaaAa'; px[1] = 'aaaaaaaa'; px[2] = 'assssssa';
    }
    return { pal, px };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function drawArt(ctx, art, x, y, size) {
    const p = size / 8;
    art.px.forEach((row, ry) => {
      row.split('').forEach((ch, rx) => {
        ctx.fillStyle = art.pal[ch] || '#000';
        ctx.fillRect(Math.floor(x + rx * p), Math.floor(y + ry * p), Math.ceil(p), Math.ceil(p));
      });
    });
  }

  function artCanvas(art, size, silhouette) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (silhouette) {
      const sil = { pal: {}, px: art.px };
      Object.keys(art.pal).forEach((k) => { sil.pal[k] = '#2b2b33'; });
      drawArt(ctx, sil, 0, 0, size);
    } else drawArt(ctx, art, 0, 0, size);
    return c;
  }

  // ---- block textures (16x16, seeded noise so they look the same every time)
  function noiseTex(seed, palette, extra) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d');
    const r = makeRng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      ctx.fillRect(x, y, 1, 1);
    }
    if (extra) extra(ctx, r);
    return c;
  }

  function solidEdge(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, 15, 16, 1); ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 0, 1, 16);
  }

  function planks(ctx, base, dark) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = dark;
    [3, 7, 11, 15].forEach((y) => ctx.fillRect(0, y, 16, 1));
    [[5, 0], [12, 4], [3, 8], [9, 12]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 3));
  }

  function buildTextures() {
    const T = {};
    T.air = noiseTex(1, ['#5f9e3f', '#6aab47', '#579339', '#72b24e']);
    T.wall = noiseTex(2, ['#3a3a3f', '#2c2c30', '#45454b', '#1f1f23'], solidEdge);
    T.stone = noiseTex(3, ['#8a8a8a', '#7d7d7d', '#959595', '#727272'], (ctx) => {
      ctx.fillStyle = '#636363';
      [[3, 4, 4], [9, 10, 5], [11, 3, 3]].forEach(([x, y, w]) => ctx.fillRect(x, y, w, 1));
      solidEdge(ctx);
    });
    T.diamond = noiseTex(3, ['#8a8a8a', '#7d7d7d', '#959595', '#727272'], (ctx) => {
      [[3, 3], [10, 4], [5, 10], [11, 11], [7, 6]].forEach(([x, y]) => {
        ctx.fillStyle = '#4fe3e0'; ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = '#c8fffd'; ctx.fillRect(x, y, 1, 1);
      });
      solidEdge(ctx);
    });
    T.tree = noiseTex(5, ['#2f6e22', '#3b8a2b', '#276019', '#46983a'], solidEdge);
    T.water = noiseTex(6, ['#2f62c9', '#3a70d6', '#2856b5', '#4a80e0']);
    T.chest = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const ctx = c.getContext('2d');
      ctx.drawImage(T.air, 0, 0);
      ctx.fillStyle = '#3d2410'; ctx.fillRect(1, 2, 14, 13);
      ctx.fillStyle = '#a0662a'; ctx.fillRect(2, 3, 12, 11);
      ctx.fillStyle = '#7a4a1c'; ctx.fillRect(2, 7, 12, 1);
      ctx.fillStyle = '#f2d15c'; ctx.fillRect(7, 6, 2, 3);
      ctx.fillStyle = '#3d2410'; ctx.fillRect(7, 7, 2, 1);
      return c;
    })();
    T.bridge = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      planks(c.getContext('2d'), '#b0834a', '#7d5a2c');
      return c;
    })();
    T.planks = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      planks(c.getContext('2d'), '#c89b5a', '#946c38');
      return c;
    })();
    // Lava gets two frames so it can bubble.
    T.lava = [7, 8].map((s) => noiseTex(s, ['#ff6a00', '#ff8c1a', '#e04800', '#ffb030', '#ff7a0a']));
    return T;
  }

  window.Sprites = { MOB_ART, SKINS, playerArt, drawArt, artCanvas, buildTextures };
})();
