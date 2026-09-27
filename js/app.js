(function () {
  'use strict';

  const t = (k, v) => I18N.t(k, v);
  const pick = (o) => I18N.pick(o);
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = Progress;
  const D = () => P.data;

  // ---------------- XP, ranks, helmets ----------------
  const RANK_XP = [0, 250, 600, 1100, 1800, 2600];
  const SKIN_RANK = { none: 0, iron: 2, gold: 3, diamond: 4 };
  const ALL_LEVELS = () => [...PY_LEVELS, ...SQL_LEVELS];

  function levelXP(e) {
    if (!e) return 0;
    const quests = (e.quests || []).filter((q) => q.done).length;
    return (e.done ? 100 : 0) + 20 * (e.stars || 0) + 20 * quests;
  }
  const totalXP = () => ALL_LEVELS().reduce((s, l) => s + levelXP(D().levels[l.id]), 0);
  const rankOf = (xp) => RANK_XP.reduce((r, v, i) => (xp >= v ? i : r), 0);

  function unlocked(track, i) {
    if (i === 0) return true;
    const prev = track[i - 1];
    return !!(D().levels[prev.id] && D().levels[prev.id].done);
  }

  // ---------------- sound ----------------
  const Sound = {
    ctx: null,
    tone(freq, dur, type, vol, to) {
      if (!D().sound) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, c.currentTime);
        if (to) o.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur);
        g.gain.setValueAtTime(vol || 0.04, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + dur);
      } catch (e) { /* audio not available */ }
    },
    play(name) {
      const s = this;
      ({
        step: () => s.tone(180, 0.06, 'square', 0.025),
        turn: () => s.tone(300, 0.04, 'triangle', 0.03),
        mine: () => { s.tone(120, 0.12, 'sawtooth', 0.05, 60); s.tone(900, 0.05, 'square', 0.015); },
        diamond: () => { s.tone(1200, 0.1, 'triangle', 0.05); setTimeout(() => s.tone(1600, 0.15, 'triangle', 0.05), 80); },
        place: () => s.tone(220, 0.1, 'triangle', 0.05, 330),
        say: () => s.tone(660, 0.08, 'triangle', 0.04),
        fail: () => s.tone(200, 0.35, 'sawtooth', 0.05, 70),
        win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => s.tone(f, 0.18, 'square', 0.04), i * 110)),
        unlock: () => [784, 1047, 1319].forEach((f, i) => setTimeout(() => s.tone(f, 0.12, 'triangle', 0.05), i * 90)),
        click: () => s.tone(440, 0.03, 'square', 0.02),
      }[name] || (() => {}))();
    },
  };

  // ---------------- Python runner (Web Worker) ----------------
  const PyRunner = {
    worker: null, ready: false, failed: false, waiters: [], pending: null, nextId: 1,
    start() {
      this.ready = false;
      this.failed = false;
      this.worker = new Worker('js/py-worker.js?v=33');
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { this.ready = true; this.flush(); }
        else if (m.type === 'loadError') { this.failed = true; this.flush(); }
        else if (m.type === 'result' && this.pending && this.pending.id === m.id) {
          clearTimeout(this.pending.timer);
          const r = this.pending.resolve;
          this.pending = null;
          r(m.results);
        }
      };
      this.worker.onerror = () => { this.failed = true; this.flush(); };
    },
    flush() { this.waiters.splice(0).forEach((f) => f()); },
    whenReady() { return this.ready || this.failed ? Promise.resolve() : new Promise((r) => this.waiters.push(r)); },
    async run(code, layouts) {
      await this.whenReady();
      if (this.failed) throw new Error('load');
      return new Promise((resolve) => {
        const id = this.nextId++;
        // Endless loops that never call a game command can't be stopped
        // from inside, so kill the worker and start a fresh one.
        const timer = setTimeout(() => {
          this.pending = null;
          this.worker.terminate();
          this.start();
          resolve(null);
        }, 6000);
        this.pending = { id, resolve, timer };
        this.worker.postMessage({ id, code, layouts });
      });
    },
  };

  // ---------------- SQL engine ----------------
  let SQLlib = null;
  const sqlReady = window.initSqlJs({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` })
    .then((lib) => { SQLlib = lib; });
  function freshDB() {
    const db = new SQLlib.Database();
    db.run(SQL_DB_SQL);
    return db;
  }

  // ---------------- header ----------------
  function renderHeader() {
    const xp = totalXP(), r = rankOf(xp), ranks = t('ranks');
    const nextXP = RANK_XP[r + 1];
    const pct = nextXP ? Math.round(((xp - RANK_XP[r]) / (nextXP - RANK_XP[r])) * 100) : 100;
    const saveLabel = Cloud.user ? '☁ ' + t('saved') : '💾 ' + t('save');
    $('#header').innerHTML = `
      <a class="logo" href="#/"><span class="logo-block"></span>CodeCraft</a>
      <button class="avatar-btn" id="avatarBtn" title="${esc(t('skin'))}">
        <span class="avatar" id="avatar"></span>
        <span class="who"><b>${esc(D().name)}</b><small>${esc(ranks[r])} · ${xp} ${t('xp')}</small></span>
        <span class="xpbar"><i style="width:${pct}%"></i></span>
      </button>
      <div class="hdr-right">
        <div class="lang" role="group">${I18N.langs.map(([k, l]) => `<button data-lang="${k}" class="${I18N.lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <button class="icon-btn" id="soundBtn" title="${esc(t('sound'))}">${D().sound ? '🔊' : '🔇'}</button>
        ${Cloud.enabled ? `<button class="btn small ${Cloud.user ? 'ghost' : ''}" id="saveBtn">${saveLabel}</button>` : ''}
        <a class="parents-link" href="#/parent">🔒 ${t('parents')}</a>
      </div>`;
    $('#avatar').appendChild(Sprites.artCanvas(Sprites.playerArt(D().skin), 32));
    $$('[data-lang]').forEach((b) => b.onclick = () => { D().lang = b.dataset.lang; I18N.set(D().lang); P.save(); render(); });
    $('#soundBtn').onclick = () => { D().sound = !D().sound; P.save(); renderHeader(); Sound.play('click'); };
    $('#avatarBtn').onclick = openSkinPicker;
    if ($('#saveBtn')) $('#saveBtn').onclick = () => openAccount();
  }

  function openSkinPicker() {
    const r = rankOf(totalXP()), ranks = t('ranks');
    const items = Object.keys(SKIN_RANK).map((s) => {
      const ok = r >= SKIN_RANK[s];
      return `<button class="skin ${D().skin === s ? 'on' : ''}" data-skin="${s}" ${ok ? '' : 'disabled'}>
        <span class="skin-art" data-art="${s}"></span>
        <b>${t('skin_' + s)}</b>
        ${ok ? '' : `<small>🔒 ${t('skin_locked', { rank: ranks[SKIN_RANK[s]] })}</small>`}
      </button>`;
    }).join('');
    const m = modal(`
      <h2>${t('skin')}</h2>
      <label class="field"><span>${t('name_label')}</span><input id="nameIn" maxlength="16" value="${esc(D().name)}"></label>
      <div class="skins">${items}</div>
      <div class="modal-actions"><button class="btn" data-close>OK</button></div>`);
    $$('[data-art]', m).forEach((el) => el.appendChild(Sprites.artCanvas(Sprites.playerArt(el.dataset.art), 56)));
    $$('[data-skin]', m).forEach((b) => b.onclick = () => {
      D().skin = b.dataset.skin; P.save();
      $$('[data-skin]', m).forEach((x) => x.classList.toggle('on', x === b));
      Sound.play('click');
    });
    m.addEventListener('close', () => {
      const n = $('#nameIn', m).value.trim();
      if (n) D().name = n;
      P.save(); render();
    });
  }

  // ---------------- modal helper ----------------
  function modal(html, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal ${opts && opts.cls ? opts.cls : ''}">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.dispatchEvent(new Event('close')); wrap.remove(); };
    wrap.close = close;
    $$('[data-close]', wrap).forEach((b) => b.onclick = close);
    if (!opts || !opts.sticky) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    return wrap;
  }

  function confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = ['#4fe3e0', '#f2c94c', '#5dbb4a', '#ff6a00', '#c35cf0', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  // ---------------- screens ----------------
  let cleanup = null;

  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    I18N.set(D().lang);
    renderHeader();
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    const main = $('#main');
    window.scrollTo(0, 0);
    if (a === 'py' && PY_LEVELS.find((l) => l.id === b)) return pyScreen(main, b);
    if (a === 'sql' && SQL_LEVELS.find((l) => l.id === b)) return sqlScreen(main, b);
    if (a === 'mobdex') return mobdexScreen(main);
    if (a === 'lab') return labScreen(main);
    if (a === 'parent') return parentScreen(main);
    homeScreen(main);
  }

  function starsHTML(n, total) {
    return Array.from({ length: total || 3 }, (_, i) => `<span class="star ${i < n ? 'on' : ''}">★</span>`).join('');
  }

  function homeScreen(main) {
    const node = (l, i, track, kind) => {
      const e = D().levels[l.id];
      const open = unlocked(track, i);
      const title = pick(l.text).title;
      const cls = ['node', open ? 'open' : 'locked', e && e.done ? 'done' : '', l.boss || l.bonus ? 'boss' : '', kind].join(' ');
      const inner = `
        <span class="node-block">${open ? (l.boss ? '👑' : l.bonus ? '⭐' : i + 1) : '🔒'}</span>
        <span class="node-title">${esc(title)}</span>
        <span class="node-stars">${e && (e.done || e.stars) ? starsHTML(e.stars) : ''}</span>`;
      return open ? `<a class="${cls}" href="#/${kind}/${l.id}">${inner}</a>` : `<span class="${cls}" title="${esc(t('locked'))}">${inner}</span>`;
    };
    const found = D().mobs.length;
    main.innerHTML = `
      <section class="hero">
        <h1>${esc(t('hi', { name: D().name }))}</h1>
        <p>${t('tagline')}</p>
      </section>
      <section class="tracks">
        <div class="track track-py">
          <div class="track-head"><span class="track-icon">⛏️</span><div><h2>${t('track_py')}</h2><p>${t('track_py_desc')}</p></div></div>
          <div class="path">${PY_LEVELS.map((l, i) => node(l, i, PY_LEVELS, 'py')).join('<span class="link"></span>')}</div>
        </div>
        <div class="track track-sql">
          <div class="track-head"><span class="track-icon">🧪</span><div><h2>${t('track_sql')}</h2><p>${t('track_sql_desc')}</p></div></div>
          <div class="path">${SQL_LEVELS.map((l, i) => node(l, i, SQL_LEVELS, 'sql')).join('<span class="link"></span>')}</div>
          <a class="mobdex-teaser lab-teaser" href="#/lab">
            <span class="lab-icon">🧪</span>
            <span><b>${t('lab_title')}</b><small>${t('lab_desc')}</small></span>
          </a>
          <a class="mobdex-teaser" href="#/mobdex">
            <span class="teaser-faces" id="teaserFaces"></span>
            <span><b>📖 ${t('mobdex')}</b><small>${t('mobs_n', { n: found, total: MOBS.length })} · ${t('loot_n', { n: (D().items || []).length, total: ITEMS.length })}</small></span>
          </a>
        </div>
      </section>`;
    const faces = $('#teaserFaces');
    MOBS.slice(0, 6).forEach((m) => faces.appendChild(Sprites.artCanvas(Sprites.MOB_ART[m.id], 28, !D().mobs.includes(m.id))));
    if (!D().welcomed) openWelcome();
  }

  function openWelcome() {
    // The home screen can be drawn several times at startup (cloud sign-in check); show one welcome only.
    if (document.getElementById('welcomeModal')) return;
    const m = modal(`
      <div class="welcome-art" id="wArt"></div>
      <h2>${esc(t('welcome', { name: D().name === 'Miner' ? '' : D().name }).replace(/,\s*!/, '!').replace(/,\s*¡/, '¡'))}</h2>
      <p>${t('welcome_sub')}</p>
      <label class="field"><span>${t('name_label')}</span><input id="wName" maxlength="16" value="${esc(D().name)}"></label>
      <p class="muted">${t('welcome_lang')}</p>
      <div class="lang big">${I18N.langs.map(([k]) => `<button data-wl="${k}" class="${I18N.lang === k ? 'on' : ''}">${{ en: '🇬🇧 English', es: '🇪🇸 Español', de: '🇩🇪 Deutsch' }[k]}</button>`).join('')}</div>
      <div class="modal-actions"><button class="btn big" data-close>${t('welcome_go')} ⛏️</button></div>`, { sticky: true, cls: 'center' });
    m.id = 'welcomeModal';
    $('#wArt', m).appendChild(Sprites.artCanvas(Sprites.playerArt('none'), 96));
    const saveName = () => { const n = $('#wName', m).value.trim(); if (n) D().name = n; };
    $$('[data-wl]', m).forEach((b) => b.onclick = () => {
      saveName(); D().lang = b.dataset.wl; P.save(); m.remove(); render();
    });
    m.addEventListener('close', () => { saveName(); D().welcomed = true; P.save(); render(); });
  }

  // ---------------- editor ----------------
  function makeEditor(el, mode, value, onRun, onChange) {
    const cm = CodeMirror.fromTextArea(el, {
      mode, value, lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true,
      theme: 'codecraft', viewportMargin: Infinity,
      extraKeys: {
        Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ')),
        'Shift-Tab': (c) => c.indentSelection('subtract'),
        'Cmd-Enter': () => onRun(), 'Ctrl-Enter': () => onRun(),
      },
    });
    cm.setValue(value);
    cm.on('change', () => onChange(cm.getValue()));
    return cm;
  }

  function insertSnippet(cm, text) {
    const cur = cm.getCursor();
    const line = cm.getLine(cur.line);
    const indent = (line.match(/^\s*/) || [''])[0];
    const inline = text === 'ahead()';
    if (!inline && line.trim() !== '') {
      cm.replaceRange('\n' + indent, { line: cur.line, ch: line.length });
      cm.setCursor({ line: cur.line + 1, ch: indent.length });
    }
    const body = text.split('\n').map((l, i) => (i ? indent + l : l)).join('\n');
    cm.replaceSelection(body);
    cm.focus();
  }

  const SNIPPETS = {
    move: 'move()', turn_left: 'turn_left()', turn_right: 'turn_right()', mine: 'mine()', place: 'place()',
    build: 'build()', ahead: 'ahead()', say: 'say("hi")',
    for: 'for i in range(3):\n    ', if: 'if ahead() == "lava":\n    ', while: 'while ahead() != "chest":\n    ',
    def: 'def my_command():\n    ', variable: 'count = 0',
  };
  const CHIP_LABEL = {
    move: 'move()', turn_left: 'turn_left()', turn_right: 'turn_right()', mine: 'mine()', place: 'place()',
    build: 'build()', ahead: 'ahead()', say: 'say(x)', for: 'for … in range():', if: 'if … :', while: 'while … :',
    def: 'def name():', variable: 'x = 0',
  };

  const codeLines = (code) => code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;

  function outLine(out, cls, html) {
    const d = document.createElement('div');
    d.className = 'out-line ' + cls;
    d.innerHTML = html;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  const PY_WORDS = ['move', 'turn_left', 'turn_right', 'mine', 'place', 'build', 'ahead', 'say', 'print', 'range'];
  const BLOCK_WORDS = ['lava', 'stone', 'diamond', 'chest', 'air', 'water', 'wall', 'bridge', 'tree', 'planks'];

  // Edit distance (with swapped letters counting as one) to suggest "did you mean".
  function editDist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  function closest(word, list, max) {
    let best = null, bd = (max || 2) + 1;
    list.forEach((w) => { const x = editDist(word.toLowerCase(), w.toLowerCase()); if (x < bd) { bd = x; best = w; } });
    return best;
  }

  function pyErrorMessage(err, code) {
    const src = err.line ? (code.split('\n')[err.line - 1] || '').trim() : '';
    const short = src.length > 40 ? src.slice(0, 40) + '…' : src;
    const pre = err.line ? (short ? t('err_line_src', { line: err.line, src: esc(short) }) : t('err_line', { line: err.line })) : '';
    const out = (key, vars) => ({
      key, vars,
      text: pre + t(key, vars) + (err.kind === 'GameStop' ? '' : ` <span class="raw">(${esc(err.kind)}: ${esc(err.msg)})</span>`),
    });
    const m = err.msg || '';
    let x;
    if (err.kind === 'GameStop') return out('fatal_' + m);
    if (err.kind === 'NameError') {
      const name = (m.match(/'([^']+)'/) || [])[1] || '?';
      const lower = name.toLowerCase();
      if (lower !== name && PY_WORDS.includes(lower)) return out('py_name_case', { name: esc(name) + '()', fix: lower + '()' });
      const near = closest(name, PY_WORDS);
      if (near && near !== name) return out('py_name_typo', { name: esc(name), fix: near + '()' });
      if (/^\w+$/.test(name) && new RegExp('^\\s*' + name + '\\s*=[^=]', 'm').test(code)) return out('py_name_before', { name: esc(name) });
      if (BLOCK_WORDS.includes(lower)) return out('py_name_quote', { name: esc(name) });
      return out('py_name_unknown', { name: esc(name) });
    }
    if (err.kind === 'IndentationError' || err.kind === 'TabError') {
      if (/expected an indented block/.test(m)) return out('py_indent_expected');
      if (/unexpected indent/.test(m)) return out('py_indent_unexpected');
      return out('py_indent_mismatch');
    }
    if (err.kind === 'SyntaxError') {
      if (/was never closed/.test(m)) return out('py_never_closed');
      if (/expected ':'/.test(m)) return out('py_expected_colon');
      if (/unterminated string/.test(m)) return out('py_unterminated');
      if ((x = m.match(/unmatched '(.)'/))) return out('py_unmatched', { x: esc(x[1]) });
      if (/meant '=='/.test(m)) return out('py_double_equals');
      if (/forgot a comma/.test(m)) return out('py_comma');
      if (/=!/.test(src)) return out('py_not_equal');
      if (/^for\s+\w+\s+range/.test(src)) return out('py_for_in');
      if ((x = src.match(/^(If|For|While|Def|Else|Elif)\b/))) return out('py_keyword_case', { kw: x[1], fix: x[1].toLowerCase() });
      return out('py_syntax_line');
    }
    if (err.kind === 'TypeError') {
      if ((x = m.match(/(\w+)\(\) takes 0 positional arguments/))) return out('py_args_none', { cmd: esc(x[1]) });
      if ((x = m.match(/(\w+)\(\) missing \d+ required/))) return out('py_args_missing', { cmd: esc(x[1]) });
      if (/cannot be interpreted as an integer/.test(m)) return out('py_range_text');
      if (/concatenate|unsupported operand/.test(m)) return out('py_add_mixed');
      if (/object is not callable/.test(m)) return out('py_not_callable');
      return out('err_TypeError');
    }
    if (err.kind === 'RecursionError') return out('py_recursion');
    if (err.kind === 'ZeroDivisionError') return out('err_ZeroDivisionError');
    return out('err_other', { kind: esc(err.kind) });
  }

  // Commands written without () don't fail in Python — they silently do nothing.
  function lint(code) {
    const cmds = ['move', 'turn_left', 'turn_right', 'mine', 'place', 'build', 'ahead', 'say'];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/#.*$/, '').replace(/"[^"]*"|'[^']*'/g, '""');
      if (/^\s*def\s/.test(line)) continue;
      const m = line.match(/\b(move|turn_left|turn_right|mine|place|build|ahead|say)\b(?!\s*\()/);
      if (m && cmds.includes(m[1])) return t('lint_parens', { line: i + 1, cmd: m[1] });
    }
    return null;
  }

  // Replay recorded actions on a fresh world to judge the result.
  function judge(level, layout, result) {
    const w = new World(layout);
    let fatal = null;
    for (const a of result.actions) {
      if (a.a === 'fatal') { fatal = a.arg; break; }
      w.do(a.a, a.arg);
    }
    if (result.error) return { ok: false, error: result.error };
    if (fatal) return { ok: false, error: { kind: 'GameStop', msg: fatal } };
    const v = level.check(w);
    if (!v.ok && v.why === 'not_at_chest') {
      w.grid.forEach((row, y) => row.forEach((c, x) => { if (c === 'chest') v.n = Math.abs(x - w.x) + Math.abs(y - w.y); }));
      if (v.n === 1) v.why = 'one_more';
    }
    return v;
  }

  // ---------------- Python level screen ----------------
  function pyScreen(main, id) {
    const idx = PY_LEVELS.findIndex((l) => l.id === id);
    if (!unlocked(PY_LEVELS, idx)) { location.hash = '#/'; return; }
    const L = PY_LEVELS[idx];
    const tx = pick(L.text);
    const E = P.level(id);
    E.lastPlayed = Date.now();
    P.save();
    let hintIdx = 0;
    let busy = false;

    const chips = L.commands.map((c) => `<button class="chip ${['for', 'if', 'while', 'def', 'variable'].includes(c) ? 'concept' : ''}" data-snip="${c}" title="${esc(t('insert'))}"><code>${esc(CHIP_LABEL[c])}</code><span>${esc(t('cmd_' + c))}</span></button>`).join('');

    main.innerHTML = `
      <div class="level">
        <div class="lv-top">
          <a class="btn ghost small" href="#/">← ${t('back')}</a>
          <h1><span class="lv-num ${L.boss ? 'boss' : ''}">${L.boss ? '👑' : idx + 1}</span>${esc(tx.title)}</h1>
          <div class="star-goals" id="starGoals"></div>
        </div>
        <div class="lv-grid">
          <section class="col col-info">
            <div class="card"><h3>📜 ${t('story')}</h3><p>${tx.story}</p></div>
            <div class="card lesson"><h3>💡 ${t('lesson')}</h3><p>${tx.lesson}</p><div class="ex-label">${t('example')}</div><pre class="example cm-s-codecraft" id="example"></pre></div>
            <div class="card goal"><h3>🎯 ${t('goal')}</h3><p>${tx.goal}</p>${L.tests > 1 ? `<p class="tested">🎲 ${t('tested', { n: L.tests })}</p>` : ''}</div>
          </section>
          <section class="col col-code">
            <div class="chips-head">${t('commands')}</div>
            <div class="chips">${chips}</div>
            <div class="editor"><textarea id="code"></textarea></div>
            <div class="lines-now" id="linesNow"></div>
            <div class="actions">
              <button class="btn run" id="runBtn">▶ ${t('run')}</button>
              <button class="btn ghost" id="resetBtn">↺ ${t('reset')}</button>
              <button class="btn ghost" id="hintBtn">💡 ${t('hint')}</button>
            </div>
            <div class="hint-box" id="hintBox" hidden></div>
          </section>
          <section class="col col-world">
            <div class="world-card">
              <div class="canvas-wrap"><canvas id="world"></canvas></div>
              <div class="legend" id="legend"></div>
              <div class="world-bar">
                <div class="inv" id="inv"></div>
                <label class="speed">${t('speed')} <input type="range" id="speed" min="0.5" max="4" step="0.5" value="1.5"></label>
                <button class="btn ghost small" id="skipBtn" hidden>⏭ ${t('skip')}</button>
              </div>
            </div>
            <div class="card output"><h3>🖥 ${t('output')}</h3><div class="out" id="out"><div class="out-line muted">${t('output_empty')}</div></div></div>
          </section>
        </div>
      </div>`;

    CodeMirror.runMode(tx.example, 'python', $('#example'));

    const cm = makeEditor($('#code'), 'python', E.code != null ? E.code : pick(L.starter), () => run(), (v) => {
      E.code = v;
      updateLines();
      clearTimeout(saveT); saveT = setTimeout(() => P.save(), 800);
    });
    let saveT;
    $$('[data-snip]').forEach((b) => b.onclick = () => { insertSnippet(cm, SNIPPETS[b.dataset.snip]); Sound.play('click'); });

    const view = new WorldView($('#world'));
    const seed = () => Math.floor(Math.random() * 1e9);
    const mkLayout = () => L.layout(makeRng(seed()));
    let shown = mkLayout();
    const showWorld = (layout) => { view.setWorld(new World(layout), D().skin); updateInv(); drawLegend(); };
    // What each block means, for the blocks in this level only.
    function drawLegend() {
      const w = view.world, kinds = new Set();
      w.grid.forEach((row) => row.forEach((c) => kinds.add(c)));
      if (w.targets.length) kinds.add('target');
      if ((w.layout.hidden || []).length) kinds.add('mystery');
      const order = ['mystery', 'air', 'stone', 'diamond', 'tree', 'lava', 'water', 'bridge', 'wall', 'target', 'chest'];
      const box = $('#legend');
      box.innerHTML = '';
      if (kinds.has('lava') || kinds.has('water')) kinds.add('bridge');
      order.filter((k) => kinds.has(k)).forEach((k) => {
        const item = document.createElement('span');
        item.className = 'legend-item';
        item.appendChild(WorldView.tile(k === 'target' ? 'air' : k, 22, k === 'target'));
        item.insertAdjacentHTML('beforeend', `<span>${t('leg_' + k)}</span>`);
        box.appendChild(item);
      });
    }
    showWorld(shown);
    const onResize = () => view.resize();
    window.addEventListener('resize', onResize);

    function updateInv() {
      const w = view.world;
      $('#inv').innerHTML = `<span title="stone">🪨 ${w.inv.stone}</span><span title="diamond">💎 ${w.inv.diamond}</span>`;
    }

    function updateLines() {
      const n = codeLines(cm.getValue());
      $('#linesNow').innerHTML = t('lines_now', { n }) + (n <= L.par ? ' <span class="ok">★</span>' : '');
      renderStarGoals();
    }

    function renderStarGoals() {
      const n = codeLines(cm.getValue());
      const goals = [
        [t('star_finish'), E.done],
        [t('star_lines', { n: L.par }), E.stars >= 2 || (n <= L.par && E.done)],
        [t('star_nohelp'), !E.solutionSeen],
      ];
      $('#starGoals').innerHTML = `<span class="sg-label">${t('stars')}:</span>` + goals.map(([label]) => `<span class="sg">★ ${esc(label)}</span>`).join('') +
        `<span class="sg-best">${starsHTML(E.stars)}</span>`;
    }
    updateLines();

    // hints: two written hints, then the solution (costs the "no peeking" star)
    $('#hintBtn').onclick = () => {
      const box = $('#hintBox');
      if (hintIdx < tx.hints.length) {
        hintIdx++;
        E.hints = Math.max(E.hints || 0, hintIdx);
        P.save();
        box.hidden = false;
        box.innerHTML = tx.hints.slice(0, hintIdx).map((h, i) => `<p><b>💡 ${i + 1}.</b> ${h}</p>`).join('') +
          (hintIdx === tx.hints.length ? `<button class="btn ghost small" id="solBtn">🔑 ${t('solution')}</button>` : '');
        const sb = $('#solBtn');
        if (sb) sb.onclick = () => {
          if (!E.solutionSeen && !confirm(t('solution_confirm'))) return;
          E.solutionSeen = true; P.save();
          sb.outerHTML = `<pre class="example cm-s-codecraft" id="solPre"></pre>`;
          CodeMirror.runMode(L.solution, 'python', $('#solPre'));
          renderStarGoals();
        };
        if (hintIdx === tx.hints.length) $('#hintBtn').disabled = true;
      }
    };

    $('#resetBtn').onclick = () => {
      if (busy) view.skip();
      shown = mkLayout();
      showWorld(shown);
      $('#out').innerHTML = `<div class="out-line muted">${t('output_empty')}</div>`;
    };
    $('#runBtn').onclick = () => run();
    $('#skipBtn').onclick = () => view.skip();

    // Whatever happens inside, the Run button must never stay stuck.
    async function run() {
      if (busy) return;
      try { await runOnce(); } catch (e) {
        console.error('run failed', e);
        outLine($('#out'), 'err', '❌ ' + esc(String(e && e.message || e)));
        busy = false;
        finish();
      }
    }

    async function runOnce() {
      if (busy) return;
      busy = true;
      const code = cm.getValue();
      const out = $('#out');
      out.innerHTML = '';
      $('#runBtn').disabled = true;
      $('#runBtn').textContent = '⏳ ' + t('running');
      E.attempts = (E.attempts || 0) + 1;
      E.lastPlayed = Date.now();
      P.save();

      const warn = lint(code);
      if (warn) outLine(out, 'warn', '⚠️ ' + esc(warn));

      if (!PyRunner.ready) outLine(out, 'muted loading', '⏳ ' + t('loading_py'));
      // World 1 is always the one on screen, so code written for what he sees is tested on it.
      const layouts = [shown, ...Array.from({ length: L.tests - 1 }, mkLayout)];
      let results;
      try {
        results = await PyRunner.run(code, layouts);
      } catch (e) {
        outLine(out, 'err', '❌ ' + t('load_failed'));
        finish();
        return;
      }
      const loadingLine = $('.loading', out);
      if (loadingLine) loadingLine.remove();

      if (results === null) {
        showWorld(layouts[0]);
        outLine(out, 'err', '⏱ ' + t('fatal_timeout'));
        E.lastError = { key: 'fatal_timeout' };
        Sound.play('fail');
        finish();
        return;
      }

      const verdicts = results.map((r, i) => judge(L, layouts[i], r));
      const failIdx = verdicts.findIndex((v) => !v.ok);
      const showIdx = failIdx === -1 ? 0 : failIdx;
      shown = layouts[showIdx];
      showWorld(shown);
      if (L.tests > 1) outLine(out, 'muted', `🎲 ${t('world_n', { n: showIdx + 1 })} / ${L.tests}`);

      $('#skipBtn').hidden = false;
      await view.play(results[showIdx].actions, parseFloat($('#speed').value), (act, silent) => {
        updateInv();
        if (silent) return;
        if (act.a === 'move') Sound.play('step');
        else if (act.a.startsWith('turn')) Sound.play('turn');
        else if (act.a === 'mine') Sound.play(act.note === 'mined:diamond' ? 'diamond' : 'mine');
        else if (act.a === 'place' || act.a === 'build') Sound.play('place');
        else if (act.a === 'say') { Sound.play('say'); outLine(out, 'say', `💬 ${esc(act.arg)}`); }
        else if (act.a === 'fatal') Sound.play('fail');
      });
      $('#skipBtn').hidden = true;

      const prints = results[showIdx].prints;
      if (prints.length) outLine(out, 'print', `<span class="muted">${t('prints')}</span><pre>${esc(prints.join('\n'))}</pre>`);

      const v = verdicts[showIdx];
      if (failIdx === -1) {
        win(code);
      } else {
        let msg;
        if (v.error) {
          msg = pyErrorMessage(v.error, code);
          E.lastError = { key: msg.key, vars: msg.vars };
        } else {
          msg = { text: t('why_' + v.why, { said: esc(v.said || ''), n: v.n }) };
          E.lastError = { key: 'why_' + v.why, vars: { n: v.n, said: v.said } };
        }
        outLine(out, 'err', '❌ ' + msg.text);
        if (failIdx > 0 && verdicts[0].ok) outLine(out, 'warn', '🎲 ' + t('test_fail', { n: failIdx + 1 }));
        else if (L.tests > 1 && !/\bif\b|\bwhile\b/.test(code)) outLine(out, 'warn', '🎲 ' + t('py_random_hint'));
        if (!v.error) Sound.play('fail');
        P.save();
      }
      finish();
    }

    function finish() {
      busy = false;
      const b = $('#runBtn');
      if (b) { b.disabled = false; b.textContent = '▶ ' + t('run'); }
    }

    function win(code) {
      const xpBefore = totalXP();
      const stars = 1 + (codeLines(code) <= L.par ? 1 : 0) + (E.solutionSeen ? 0 : 1);
      const firstTime = !E.done;
      E.done = true;
      E.stars = Math.max(E.stars || 0, stars);
      E.lastError = null;
      P.save();
      outLine($('#out'), 'ok', '✅ ' + t('win'));
      renderStarGoals();
      const next = PY_LEVELS[idx + 1];
      showWin({
        stars, xpBefore, xpAfter: totalXP(),
        title: t('win_level', { n: idx + 1, name: tx.title }),
        nextHref: next ? `#/py/${next.id}` : '#/',
        onAgain: () => {},
      });
      if (firstTime && id === 'py2') setTimeout(maybeAskAccount, 400);
    }

    // time spent (only while the tab is visible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') { E.timeSec = (E.timeSec || 0) + 5; P.save(); }
    }, 5000);

    cleanup = () => { clearInterval(timer); view.destroy(); window.removeEventListener('resize', onResize); P.save(); };
    setTimeout(() => cm.refresh(), 0);
  }

  function showWin({ stars, xpBefore, xpAfter, nextHref, starsTotal, title, nextLabel }) {
    Sound.play('win');
    confetti();
    const rb = rankOf(xpBefore), ra = rankOf(xpAfter), ranks = t('ranks');
    const newSkin = Object.keys(SKIN_RANK).find((s) => SKIN_RANK[s] > rb && SKIN_RANK[s] <= ra);
    const m = modal(`
      <div class="win-stars">${Array.from({ length: starsTotal || 3 }, (_, i) => `<span class="star big ${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
      <h2>${esc(title || t('win'))}</h2>
      <p>${esc(t('win_sub', { name: D().name }))}</p>
      <p class="xp-gain">${xpAfter > xpBefore ? t('xp_gain', { n: xpAfter - xpBefore }) : ''}</p>
      ${ra > rb ? `<p class="rank-up">🏅 ${t('rank_up', { rank: ranks[ra] })}</p>` : ''}
      ${newSkin ? `<p class="rank-up">🪖 ${t('skin_unlock', { skin: t('skin_' + newSkin) })}</p>` : ''}
      <div class="modal-actions">
        ${stars < (starsTotal || 3) ? `<button class="btn ghost" data-close>${t('again')}</button>` : ''}
        <a class="btn" href="${nextHref}" data-go>${nextHref === '#/' ? t('to_map') : nextHref === '#/mobdex' ? '📖 ' + t('mobdex') : (nextLabel || t('next')) + ' →'}</a>
      </div>`, { cls: 'center win' });
    $('[data-go]', m).addEventListener('click', () => m.remove());
    renderHeader();
  }

  function maybeAskAccount() {
    if (!Cloud.enabled || Cloud.user || D().askedAccount) return;
    D().askedAccount = true;
    P.save();
    openAccount();
  }

  function openAccount(onDone) {
    if (!Cloud.enabled) {
      modal(`<h2>💾 ${t('save')}</h2><p>${t('acct_off')}</p><div class="modal-actions"><button class="btn" data-close>OK</button></div>`);
      return;
    }
    if (Cloud.user) {
      const m = modal(`<h2>☁ ${t('saved')}</h2><p>${esc(Cloud.user.email)}</p>
        <div class="modal-actions"><button class="btn ghost" id="logout">${t('acct_logout')}</button><button class="btn" data-close>OK</button></div>`);
      $('#logout', m).onclick = async () => { await Cloud.signOut(); m.close(); render(); };
      return;
    }
    let mode = 'signup';
    const m = modal(`<div id="acct"></div>`);
    const draw = (msg, isErr) => {
      $('#acct', m).innerHTML = `
        <h2>💾 ${t('acct_title')}</h2>
        <p>${t('acct_pitch')}</p>
        <label class="field"><span>${t('acct_email')}</span><input id="em" type="email" autocomplete="email"></label>
        <label class="field"><span>${t('acct_password')}</span><input id="pw" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>
        ${msg ? `<p class="${isErr ? 'err' : 'ok'}">${esc(msg)}</p>` : ''}
        <div class="modal-actions">
          <button class="btn ghost" data-close>${t('acct_later')}</button>
          <button class="btn" id="go">${mode === 'signup' ? t('acct_create') : t('acct_login')}</button>
        </div>
        <button class="linkish" id="switch">${mode === 'signup' ? t('acct_have') : t('acct_new')}</button>`;
      $$('[data-close]', m).forEach((b) => b.onclick = m.close);
      $('#switch', m).onclick = () => { mode = mode === 'signup' ? 'login' : 'signup'; draw(); };
      $('#go', m).onclick = async () => {
        const em = $('#em', m).value.trim(), pw = $('#pw', m).value;
        try {
          if (mode === 'signup') {
            const r = await Cloud.signUp(em, pw);
            if (r.needsConfirm) { mode = 'login'; draw(t('acct_check_email')); return; }
          } else await Cloud.signIn(em, pw);
          draw(t('acct_done'));
          setTimeout(() => { m.close(); render(); if (onDone) onDone(); }, 900);
        } catch (e) { draw(e.message, true); }
      };
    };
    draw();
  }

  // ---------------- SQL chapters ----------------
  const SQL_TABLE_NAMES = Object.keys(SQL_SCHEMA);
  const SQL_ALL_COLS = [...new Set(Object.values(SQL_SCHEMA).flat().map(([c]) => c))];
  const SQL_FUNCS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'UPPER', 'LOWER', 'LENGTH', 'RANK', 'ROW_NUMBER'];
  const SQL_WORDS = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'LIMIT', 'DESC', 'ASC', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
    'LIKE', 'IS', 'NULL', 'AS', 'DISTINCT', 'GROUP', 'HAVING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'JOIN', 'LEFT',
    'INNER', 'ON', 'WITH', 'OVER', 'PARTITION', ...SQL_FUNCS];
  // Every text value in the world, to spot "you forgot the quotes".
  const SQL_VALUES = new Set([...SQL_DB_SQL.matchAll(/'([^']*)'/g)].map((m) => m[1].toLowerCase()));
  const noStrings = (q) => q.replace(/'[^']*'/g, "''");
  const has = (q, re) => re.test(noStrings(q));

  // SQLite errors, translated into what to do. `tables` = the tables in scope.
  function sqlErrorText(msg, code, tables, inLab) {
    let m;
    const bare = noStrings(code);
    const prefixes = new Set([...bare.matchAll(/\b([a-z_]+)\./gi)].map((x) => x[1].toLowerCase()));
    const aliases = new Set([
      ...[...bare.matchAll(/\bas\s+([a-z_]+)/gi)].map((x) => x[1].toLowerCase()),
      // "FROM hunts h" only counts as a short name if h. is actually used
      ...[...bare.matchAll(/\b(?:from|join)\s+[a-z_]+\s+(?:as\s+)?([a-z_]+)/gi)].map((x) => x[1].toLowerCase()).filter((a) => prefixes.has(a)),
    ]);
    if (has(code, /\bcase\b/i) && !has(code, /\bend\b/i)) return t('sqlerr_case_end');
    if (has(code, /\bcase\b/i) && (bare.match(/\bwhen\b/gi) || []).length !== (bare.match(/\bthen\b/gi) || []).length) return t('sqlerr_case_then');
    if ((m = msg.match(/no such column: (\S+)/))) {
      const full = m[1], parts = full.split('.'), col = parts.pop(), pre = parts.pop();
      if (pre && !SQL_TABLE_NAMES.includes(pre.toLowerCase()) && !aliases.has(pre.toLowerCase())) {
        const used = [...bare.matchAll(/\b(?:from|join)\s+([a-z_]+)/gi)].map((x) => x[1].toLowerCase()).filter((tb) => SQL_SCHEMA[tb]);
        const owner = used.find((tb) => SQL_SCHEMA[tb].some(([c]) => c === col.toLowerCase())) || used[0] || 'hunts';
        return t('sqlerr_alias_missing', { p: esc(pre), col: esc(col), tb: owner });
      }
      if (SQL_VALUES.has(col.toLowerCase())) return t('sqlerr_column', { x: esc(col) }) + ' ' + t('sqlerr_text_quote');
      const near = closest(col, SQL_ALL_COLS);
      if (near && near !== col) return t('sqlerr_column_typo', { x: esc(full), fix: (pre ? pre + '.' : '') + near });
      return t('sqlerr_column', { x: esc(full) });
    }
    if ((m = msg.match(/ambiguous column name: (\S+)/))) {
      const col = m[1];
      const inT = tables.filter((tb) => SQL_SCHEMA[tb].some(([c]) => c === col));
      return t('sqlerr_ambiguous', { x: esc(col), opts: inT.map((tb) => `<code>${tb}.${esc(col)}</code>`).join(' / ') });
    }
    if ((m = msg.match(/no such table: (\S+)/))) return t(inLab ? 'sqlerr_table_lab' : 'sqlerr_table', { x: esc(m[1]), list: tables.map((tb) => `<code>${tb}</code>`).join(', ') });
    if ((m = msg.match(/no such function: (\w+)/))) return t('sqlerr_function', { x: esc(m[1]), fix: closest(m[1], SQL_FUNCS, 3) || 'COUNT' });
    if (/misuse of aggregate/.test(msg)) return t('sqlerr_aggregate');
    if (/GROUP BY clause is required before HAVING|HAVING clause on a non-aggregate/i.test(msg)) return t('sqlerr_having_group');
    if (/unrecognized token: "'/.test(msg)) return t('sqlerr_unterminated');
    if (/,\s*from\b/i.test(bare)) return t('sqlerr_trailing_comma');
    if (/\border\s+(?!by\b)/i.test(bare)) return t('sqlerr_order_by');
    if (/\bgroup\s+(?!by\b)/i.test(bare)) return t('sqlerr_group_by');
    const words = bare.match(/[A-Za-z_]+/g) || [];
    for (const w of words) {
      const lw = w.toLowerCase(), up = w.toUpperCase();
      if (w.length < 3 || SQL_WORDS.includes(up) || SQL_ALL_COLS.includes(lw) || SQL_TABLE_NAMES.includes(lw) || aliases.has(lw)) continue;
      const near = closest(up, SQL_WORDS);
      if (near) return t('sqlerr_typo', { x: esc(w), fix: near });
    }
    if ((m = msg.match(/near "([^"]*)": syntax error/))) {
      if (SQL_WORDS.includes(m[1].toUpperCase())) return t('sqlerr_order_parts', { x: esc(m[1]) });
      return t('sqlerr_syntax', { x: esc(m[1]) });
    }
    if (/incomplete input/.test(msg)) return t('sqlerr_incomplete');
    return t('sqlerr_other', { x: esc(msg) });
  }

  // Sortable results table. Clicking a header only re-sorts the view;
  // quest answers are always checked on the query's own result.
  function makeResultsView(wrap, labelEl) {
    let shownRes = null, sortCol = -1, sortDir = 1;
    let shownNote = '';
    // note: optional banner, e.g. "your query works, it's just not the answer yet".
    function show(res, note) {
      if (res !== undefined) { shownRes = res; shownNote = note || ''; sortCol = -1; sortDir = 1; }
      res = shownRes;
      const banner = shownNote ? `<div class="result-note">${shownNote}</div>` : '';
      if (!res) { wrap.innerHTML = banner + `<div class="muted">${t('sql_rows', { n: 0 })}</div>`; labelEl.textContent = t('sql_rows', { n: 0 }); return; }
      let rows = res.values.slice();
      if (sortCol >= 0) {
        rows.sort((a, b) => {
          const x = a[sortCol], y = b[sortCol];
          if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sortDir;
        });
      }
      rows = rows.slice(0, 200);
      labelEl.textContent = t(res.values.length === 1 ? 'sql_row' : 'sql_rows', { n: res.values.length });
      const arrow = (i) => (i === sortCol ? (sortDir === 1 ? '▲' : '▼') : '⇅');
      wrap.innerHTML = banner + `
        <p class="sort-tip">${sortCol >= 0 ? t('sort_view_only', { col: esc(res.columns[sortCol]) }) : t('sort_tip')}</p>
        <table><thead><tr>${res.columns.map((c, i) => `<th><button class="th-sort ${i === sortCol ? 'on' : ''}" data-col="${i}" title="${esc(t('sort_tip'))}">${esc(c)} <span>${arrow(i)}</span></button></th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'num' : ''} ${i === sortCol ? 'sorted' : ''}">${v === null ? '<i>NULL</i>' : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      $$('.th-sort', wrap).forEach((b) => b.onclick = () => {
        const i = +b.dataset.col;
        if (i === sortCol) sortDir = -sortDir; else { sortCol = i; sortDir = 1; }
        Sound.play('click');
        show();
      });
    }
    return { show };
  }

  // SQLite has no DESCRIBE / SHOW TABLES (MySQL, Databricks do) — translate them.
  function translateShortcuts(code) {
    let m;
    if ((m = code.match(/^\s*(?:describe|desc)\s+(?:table\s+)?([a-z_]\w*)\s*;?\s*$/i))) {
      return `SELECT name AS col_name, type AS data_type FROM pragma_table_info('${m[1]}')`;
    }
    if (/^\s*show\s+tables\s*;?\s*$/i.test(code)) {
      return "SELECT name AS table_name FROM sqlite_master WHERE type = 'table' ORDER BY rowid";
    }
    return code;
  }

  function sqlStars(E, n) {
    const clean = E.quests.filter((x) => x.done && !x.solutionSeen).length;
    return clean === n ? 3 : clean >= Math.ceil((n * 2) / 3) ? 2 : 1;
  }

  function rewardCard(kind, id) {
    const card = document.createElement('div');
    card.className = 'mini-card pop';
    const art = kind === 'mobs' ? Sprites.MOB_ART[id] : Sprites.ITEM_ART[id];
    card.appendChild(Sprites.artCanvas(art, 48));
    const name = kind === 'mobs' ? MOBS.find((x) => x.id === id).name : ITEMS.find((x) => x.id === id).name;
    card.insertAdjacentHTML('beforeend', `<span>${esc(name)}</span>`);
    return card;
  }

  function sqlScreen(main, id) {
    const idx = SQL_LEVELS.findIndex((l) => l.id === id);
    if (!unlocked(SQL_LEVELS, idx)) { location.hash = '#/'; return; }
    const L = SQL_LEVELS[idx];
    const ch = pick(L.text);
    const E = P.level(id);
    // A DESCRIBE quest was added at the start of some chapters: keep old progress, shifted by one.
    if (E.quests && E.quests.length === L.quests.length - 1) E.quests.unshift({ done: E.quests.some((q) => q.done), attempts: 0, solutionSeen: false });
    if (!E.quests || E.quests.length !== L.quests.length) E.quests = L.quests.map(() => ({ done: false, attempts: 0, solutionSeen: false }));
    E.lastPlayed = Date.now();
    P.save();
    const open = (i) => i === 0 || E.quests[i - 1].done;
    let qi = E.quests.findIndex((q) => !q.done);
    if (qi === -1) qi = 0;
    let hintStep = 0;
    const badge = L.boss ? '👑' : L.bonus ? '⭐' : idx + 1;

    main.innerHTML = `
      <div class="level">
        <div class="lv-top">
          <a class="btn ghost small" href="#/">← ${t('back')}</a>
          <h1><span class="lv-num sql ${L.boss || L.bonus ? 'boss' : ''}">${badge}</span>${esc(ch.title)}</h1>
          <a class="btn ghost small" href="#/mobdex">📖 ${t('mobdex')}</a>
        </div>
        <div class="lv-grid">
          <section class="col col-info">
            <div class="card chapter-card"><h3>📜 ${t('story')}</h3><p>${ch.story}</p></div>
            <div class="card lesson" id="lesson"></div>
          </section>
          <section class="col col-code">
            <div class="card quest" id="quest"></div>
            <div class="editor sql"><textarea id="code"></textarea></div>
            <div class="actions">
              <button class="btn run" id="runBtn">▶ ${t('run')}</button>
              <button class="btn ghost" id="hintBtn">💡 ${t('hint')}</button>
            </div>
            <div class="hint-box" id="hintBox" hidden></div>
            <div class="feedback" id="fb"></div>
          </section>
          <section class="col col-world">
            <div class="card results"><h3>📊 <span id="rowsLabel">${t('output')}</span></h3><div class="table-wrap" id="results"><div class="muted">${t('output_empty')}</div></div></div>
            <div class="card schema"><h3>🗂 ${t('tables')}</h3>
              ${L.tables.map((tb) => `<div class="schema-table"><b><code>${tb}</code></b><div class="schema-cols">${SQL_SCHEMA[tb].map(([c, ty]) => `<span><code>${c}</code><small>${ty}</small></span>`).join('')}</div></div>`).join('')}
            </div>
          </section>
        </div>
      </div>`;

    const startCode = E.code != null ? E.code : (L.quests[0].starter || 'SELECT ');
    const cm = makeEditor($('#code'), 'text/x-sqlite', startCode, () => run(), (v) => {
      E.code = v; clearTimeout(saveT); saveT = setTimeout(() => P.save(), 800);
    });
    let saveT;

    const nextLevel = SQL_LEVELS[idx + 1];
    const onwardLink = () => (nextLevel && unlocked(SQL_LEVELS, idx + 1)
      ? `<a class="btn" href="#/sql/${nextLevel.id}">${t('next_chapter')} →</a>`
      : `<a class="btn" href="#/mobdex">📖 ${t('mobdex')}</a>`) + ` <a class="btn ghost" href="#/">${t('to_map')}</a>`;
    function onward() {
      const n = E.quests.findIndex((x) => !x.done);
      if (n !== -1 && n !== qi) return `<button class="btn" data-goq="${n}">${t('sql_next')} →</button>`;
      if (n === -1) return onwardLink();
      return '';
    }

    function goQuest(n) {
      if (!open(n)) return;
      qi = n; hintStep = 0;
      $('#hintBox').hidden = true; $('#hintBtn').disabled = false; $('#fb').innerHTML = '';
      const st = L.quests[n].starter;
      if (st && !E.quests[n].done) cm.setValue(st);
      drawQuest();
    }

    function drawQuest() {
      const quest = L.quests[qi], q = E.quests[qi], tx = pick(quest.text);
      $('#lesson').innerHTML = `<h3>💡 ${t('new_idea')}: ${esc(tx.idea)}</h3><p>${tx.lesson}</p>` +
        (quest.example ? `<div class="ex-label">${t('example')}</div><pre class="example cm-s-codecraft" id="example"></pre>` : '');
      if (quest.example) CodeMirror.runMode(quest.example, 'text/x-sqlite', $('#example'));
      $('#quest').innerHTML = `
        <div class="quest-top"><h3>🗡 ${t('quest', { i: qi + 1, n: L.quests.length })}</h3>
          <div class="quest-dots">${E.quests.map((x, i) => `<button class="qdot ${x.done ? 'done' : ''} ${i === qi ? 'on' : ''}" data-q="${i}" ${open(i) ? '' : `disabled title="${esc(t('quest_locked'))}"`}>${x.done ? '✓' : open(i) ? i + 1 : '🔒'}</button>`).join('')}</div>
        </div>
        <p>${tx.task}</p>
        ${q.done ? `<p class="ok">✅ ${t('quest_done')}</p><div class="quest-onward">${onward()}</div>` : ''}`;
      $$('[data-goq]', $('#quest')).forEach((b) => b.onclick = () => goQuest(+b.dataset.goq));
      $$('[data-q]').forEach((b) => b.onclick = () => goQuest(+b.dataset.q));
    }
    drawQuest();

    $('#runBtn').onclick = () => run();
    // First click: the quest's hint. Second: the solution (costs this quest's star).
    $('#hintBtn').onclick = () => {
      const box = $('#hintBox'), quest = L.quests[qi], tx = pick(quest.text);
      hintStep++;
      E.hints = (E.hints || 0) + 1;
      P.save();
      box.hidden = false;
      box.innerHTML = `<p><b>💡</b> ${tx.hint}</p><button class="btn ghost small" id="solBtn">🔑 ${t('solution')}</button>`;
      $('#hintBtn').disabled = true;
      $('#solBtn').onclick = () => {
        const q = E.quests[qi];
        if (!q.solutionSeen && !q.done && !confirm(t('solution_confirm'))) return;
        if (!q.done) q.solutionSeen = true;
        E.solutionSeen = true;
        P.save();
        $('#solBtn').outerHTML = `<pre class="example cm-s-codecraft" id="solPre"></pre>`;
        CodeMirror.runMode(quest.answer, 'text/x-sqlite', $('#solPre'));
      };
    };

    const results = makeResultsView($('#results'), $('#rowsLabel'));
    const drawTable = (res, note) => results.show(res, note);

    // Which columns appear in one clause (WHERE … / ORDER BY …) of a query.
    const colsIn = (q, clause) => {
      const m = noStrings(q).match(new RegExp('\\b' + clause + '\\b([\\s\\S]*?)(\\bgroup\\b|\\bhaving\\b|\\border\\b|\\blimit\\b|$)', 'i'));
      return m ? SQL_ALL_COLS.filter((c) => new RegExp('\\b' + c + '\\b', 'i').test(m[1])) : [];
    };
    const norm = (c) => c.toLowerCase().replace(/\s+/g, '').replace(/\b[a-z_]+\./g, '');
    const plain = (c) => /^[a-z_]+$/.test(norm(c));
    const label = (c) => (plain(c) ? norm(c) : /^case/i.test(c) ? 'CASE … END' : c);
    const list = (arr) => arr.map((c) => `<code>${esc(label(c))}</code>`).join(', ');
    const rowKey = (r) => JSON.stringify(r.map((v) => (v === null ? 'NULL' : String(v))).sort());

    // Compare by result, not by text, and when it's wrong, say *what kind* of wrong.
    const describes = (q) => (q.match(/^\s*(?:describe|desc)\s+(?:table\s+)?([a-z_]\w*)/i) || [])[1];
    function compare(got, exp, quest, code) {
      const want = describes(quest.answer);
      if (want) {
        const have = describes(code);
        if (!have) return { ok: false, key: 'sql_use_describe', vars: { tb: want } };
        if (have.toLowerCase() !== want) return { ok: false, key: 'sql_describe_table', vars: { got: esc(have), tb: want } };
        return { ok: true };
      }
      const g = got || { columns: exp.columns, values: [] };
      const G = g.columns.map(norm), X = exp.columns.map(norm);
      const namesMatch = G.length === X.length && X.every((c) => G.includes(c));
      if (G.length !== X.length) return columnProblem(g, exp, quest, code) || { ok: false, key: 'sql_cols', vars: { got: G.length, exp: X.length } };
      const a = g.values.map(rowKey).sort(), b = exp.values.map(rowKey).sort();
      const same = a.length === b.length && a.every((x, i) => x === b[i]);
      if (same && quest.requireNames && !namesMatch) return { ok: false, key: 'sql_alias', vars: { cols: list(exp.columns.filter((c) => !G.includes(norm(c)))) } };
      if (!same && !namesMatch && !quest.freeNames) { const cp = columnProblem(g, exp, quest, code); if (cp) return cp; }
      if (!same) return diagnose(g, a, b, quest, code);
      if (quest.orderCol !== undefined) {
        const want = X[quest.orderCol];
        const gi = G.indexOf(want);
        const col = gi === -1 ? quest.orderCol : gi;
        const seqG = g.values.map((r) => String(r[col]));
        const seqE = exp.values.map((r) => String(r[quest.orderCol]));
        if (seqG.some((x, i) => x !== seqE[i])) {
          if (!has(code, /\border\s+by\b/i)) return { ok: false, key: 'sql_order_missing' };
          const wantC = colsIn(quest.answer, 'order\\s+by'), haveC = colsIn(code, 'order\\s+by');
          const wrong = haveC.find((c) => !wantC.includes(c));
          if (wrong) return { ok: false, key: 'sql_order_col', vars: { got: wrong, exp: wantC[0] } };
          if (has(quest.answer, /\bdesc\b/i) && !has(code, /\bdesc\b/i)) return { ok: false, key: 'sql_need_desc_all' };
          return { ok: false, key: 'sql_order' };
        }
      }
      return { ok: true };
    }

    function columnProblem(g, exp, quest, code) {
      const G = g.columns.map(norm), X = exp.columns.map(norm);
      if (X.some((c) => c.startsWith('count(')) && !G.some((c) => c.startsWith('count('))) return { ok: false, key: exp.values.length > 1 ? 'sql_need_count_group' : 'sql_need_count' };
      if (has(code, /select\s+(distinct\s+)?\*/i) && !has(quest.answer, /select\s+\*/i) && G.length > X.length) return { ok: false, key: 'sql_star', vars: { n: G.length, cols: list(exp.columns) } };
      const missing = exp.columns.filter((c) => !G.includes(norm(c)));
      const extra = g.columns.filter((c) => !X.includes(norm(c)));
      if (quest.freeNames || missing.some((c) => !plain(c)) || extra.some((c) => !plain(c))) {
        return G.length !== X.length ? { ok: false, key: 'sql_cols_count', vars: { got: G.length, exp: X.length, cols: list(exp.columns) } } : null;
      }
      const clause = (noStrings(code).match(/select\s+([\s\S]*?)\s+from\b/i) || [])[1] || '';
      if (missing.length && G.length < X.length && /[a-z_]\s+[a-z_]/i.test(clause.replace(/\bdistinct\b/i, '')) && !/\bas\b/i.test(clause)) return { ok: false, key: 'sql_missing_comma' };
      if (missing.length && extra.length) return { ok: false, key: 'sql_swap_cols', vars: { need: list(missing), have: list(extra) } };
      if (missing.length) return { ok: false, key: 'sql_missing_col', vars: { cols: list(missing) } };
      if (extra.length) return { ok: false, key: 'sql_extra_col', vars: { cols: list(extra) } };
      return null;
    }

    function diagnose(g, gotKeys, expKeys, quest, code) {
      const A = quest.answer;
      const vars = { got: gotKeys.length, exp: expKeys.length };
      // 1. Joins
      if (has(A, /\bleft\s+join\b/i) && !has(code, /\bleft\s+join\b/i)) return { ok: false, key: 'sql_need_left' };
      if (has(code, /(!=|<>|=)\s*null\b/i)) return { ok: false, key: 'sql_is_null' };
      if (has(code, /\bjoin\b/i) && !has(code, /\bon\b/i)) return { ok: false, key: 'sql_join_on', vars };
      if (has(code, /\bjoin\b/i) && !gotKeys.length && expKeys.length) return { ok: false, key: 'sql_join_key' };
      // 2. Text values
      const lits = (q) => [...q.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      const gotL = lits(code), expL = lits(A), isCase = has(A, /\bcase\b/i);
      for (const w of gotL) {
        if (expL.includes(w)) continue;
        const pct = expL.find((e) => e.includes('%') && e.replace(/%/g, '').toLowerCase() === w.replace(/%/g, '').toLowerCase());
        if (pct) return { ok: false, key: 'sql_like_percent', vars: { exp: esc(pct) } };
        const cased = expL.find((e) => e.toLowerCase() === w.toLowerCase());
        if (cased) return { ok: false, key: 'sql_case', vars: { got: esc(w), exp: esc(cased) } };
        if (isCase) return { ok: false, key: 'sql_case_label', vars: { got: esc(w), labels: expL.filter((e) => !/^\s/.test(e)).map((e) => `<code>'${esc(e)}'</code>`).join(', ') } };
        const missing = expL.find((e) => !gotL.includes(e));
        if (missing) return { ok: false, key: 'sql_wrong_value', vars: { got: esc(w), exp: esc(missing) } };
      }
      if (!isCase && expL.length > 1 && gotL.length) {
        const miss = expL.find((e) => !gotL.includes(e));
        if (miss) return { ok: false, key: has(A, /\bin\s*\(/i) ? 'sql_missing_value' : 'sql_missing_rule', vars: { exp: esc(miss) } };
      }
      // 3. Groups
      if (has(A, /\bgroup\s+by\b/i) && !has(code, /\bgroup\s+by\b/i)) return { ok: false, key: 'sql_need_group', vars: { col: esc((noStrings(A).match(/group\s+by\s+([\w.]+)/i) || [])[1] || '') } };
      if (has(A, /\bhaving\b/i) && !has(code, /\bhaving\b/i) && gotKeys.length > expKeys.length) return { ok: false, key: 'sql_need_having' };
      // 4. DISTINCT / ROUND
      if (has(A, /\bdistinct\b/i) && !has(code, /\bdistinct\b/i)) return { ok: false, key: expKeys.length === 1 && g.columns.length === 1 ? 'sql_need_distinct_count' : 'sql_need_distinct' };
      if (has(A, /\bround\s*\(/i) && !has(code, /\bround\s*\(/i)) return { ok: false, key: 'sql_need_round' };
      // 5. The rule checks a different column than the quest is about
      for (const clause of ['where', 'order\\s+by']) {
        const want = colsIn(A, clause), haveC = colsIn(code, clause);
        const wrong = haveC.find((c) => !want.includes(c));
        if (want.length && wrong) return { ok: false, key: clause === 'where' ? 'sql_where_col' : 'sql_order_col', vars: { got: wrong, exp: want[0] } };
      }
      // 6. One number that came out wrong
      if (g.values.length === 1 && expKeys.length === 1 && g.columns.length === 1) {
        const needW = has(A, /\bwhere\b/i) && !has(code, /\bwhere\b/i);
        return { ok: false, key: needW ? 'sql_count_all' : 'sql_count_wrong', vars: { got: esc(g.values[0][0]) } };
      }
      // 7. Sorting before a LIMIT
      if (has(A, /\border\s+by\b/i) && !has(code, /\border\s+by\b/i) && has(code, /\blimit\b/i)) return { ok: false, key: 'sql_need_order' };
      if (has(A, /\bdesc\b/i) && !has(code, /\bdesc\b/i) && has(code, /\blimit\b/i)) return { ok: false, key: 'sql_need_desc' };
      // 8. The rows as sets: extra, missing, or different
      const count = (arr) => arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
      const Gm = count(gotKeys), Em = count(expKeys);
      const within = (P1, P2) => [...P1].every(([k, n]) => (P2.get(k) || 0) >= n);
      const hasWhere = has(code, /\bwhere\b/i), needsWhere = has(A, /\bwhere\b/i);
      if (within(Em, Gm) && gotKeys.length > expKeys.length) {
        if (needsWhere && !hasWhere) return { ok: false, key: 'sql_no_where', vars };
        if (has(A, /\blimit\b/i) && !has(code, /\blimit\b/i)) return { ok: false, key: 'sql_need_limit', vars };
        // Fewer conditions than the answer (not counting the AND inside BETWEEN).
        const rules = (q) => ((noStrings(q).match(/\bwhere\b([\s\S]*?)(\bgroup\b|\border\b|\blimit\b|\)|$)/i) || [])[1] || '').replace(/between\s+\S+\s+and/gi, '').split(/\band\b/i).length;
        if (hasWhere && rules(code) < rules(A)) return { ok: false, key: 'sql_need_more_rules', vars };
        return { ok: false, key: 'sql_too_many', vars };
      }
      if (within(Gm, Em) && gotKeys.length < expKeys.length) {
        if (!needsWhere && hasWhere) return { ok: false, key: 'sql_no_where_needed', vars };
        return { ok: false, key: 'sql_too_few', vars };
      }
      if (isCase) return { ok: false, key: 'sql_case_values' };
      if (has(A, /\bover\s*\([^)]*\bdesc\b/i) && !has(code, /\bover\s*\([^)]*\bdesc\b/i)) return { ok: false, key: 'sql_window_desc' };
      if (has(A, /\bover\s*\(/i)) return { ok: false, key: 'sql_window_values' };
      if (gotKeys.length !== expKeys.length) return { ok: false, key: 'sql_rows_n', vars };
      return { ok: false, key: 'sql_values' };
    }

    async function run() {
      const fb = $('#fb');
      const code = cm.getValue().trim().replace(/;\s*$/, '');
      if (!code) { fb.innerHTML = `<p class="warn">${t('sql_empty')}</p>`; return; }
      if (/;\s*\S/.test(noStrings(code))) { fb.innerHTML = `<p class="warn">${t('sql_multi')}</p>`; return; }
      if (!has(code, /\bfrom\b/i) && translateShortcuts(code) === code) {
        const typo = (noStrings(code).match(/[A-Za-z]+/g) || []).find((w) => w.length >= 3 && editDist(w.toUpperCase(), 'FROM') <= 2 && !SQL_ALL_COLS.includes(w.toLowerCase()) && !SQL_WORDS.includes(w.toUpperCase()));
        fb.innerHTML = `<p class="err">❌ ${typo ? t('sqlerr_typo', { x: esc(typo), fix: 'FROM' }) : t('sqlerr_no_from')}</p>`;
        return;
      }
      await sqlReady;
      const q = E.quests[qi];
      const quest = L.quests[qi];
      q.attempts = (q.attempts || 0) + 1;
      E.attempts = (E.attempts || 0) + 1;
      E.lastPlayed = Date.now();
      const db = freshDB();
      let res;
      try {
        const out = db.exec(translateShortcuts(code));
        res = out[out.length - 1];
      } catch (e) {
        db.close();
        const text = sqlErrorText(e.message, code, L.tables);
        drawTable(null, `❌ ${t('res_error')}`);
        fb.innerHTML = `<p class="err">❌ ${text}</p>`;
        E.lastError = { key: 'sqlerr_other', vars: { x: text.replace(/<[^>]+>/g, '') } };
        Sound.play('fail');
        P.save();
        return;
      }
      const exp = db.exec(translateShortcuts(quest.answer))[0];
      db.close();
      const c = compare(res, exp, quest, code);
      const n = res ? res.values.length : 0;
      drawTable(res || null, c.ok ? `✅ ${t('res_correct')}` : `✔ ${t(n === 1 ? 'res_ran_1' : 'res_ran', { n })}`);
      if (!c.ok) {
        fb.innerHTML = `<p class="err"><b>🤔 ${t('fb_works_but')}</b> ${t(c.key, c.vars)}</p>`;
        E.lastError = { key: c.key, vars: c.vars };
        Sound.play('fail');
        P.save();
        return;
      }
      const xpBefore = totalXP();
      const wasDone = q.done;
      q.done = true;
      E.lastError = null;
      const unlock = quest.unlock || {};
      const newMobs = (unlock.mobs || []).filter((m) => !D().mobs.includes(m));
      const newItems = (unlock.items || []).filter((m) => !(D().items || []).includes(m));
      D().mobs.push(...newMobs);
      D().items = [...(D().items || []), ...newItems];
      const allDone = E.quests.every((x) => x.done);
      if (allDone) E.stars = Math.max(E.stars || 0, sqlStars(E, L.quests.length));
      const firstFinish = allDone && !E.done;
      if (allDone) E.done = true;
      P.save();
      renderHeader();
      const gained = newMobs.length + newItems.length;
      Sound.play(gained ? 'unlock' : 'win');
      const nextQ = E.quests.findIndex((x) => !x.done);
      fb.innerHTML = `<div class="correct"><p class="ok">✅ ${t('sql_correct')} ${!wasDone && totalXP() > xpBefore ? `<b class="xp-gain">${t('xp_gain', { n: totalXP() - xpBefore })}</b>` : ''}</p>
        ${gained ? `<p>${t('sql_unlocked')}</p><div class="unlock-strip" id="strip"></div>` : ''}
        <div class="quest-onward">${nextQ !== -1 ? `<button class="btn" id="nextQ">${t('sql_next')} →</button>` : onwardLink()}</div></div>`;
      if (gained) {
        const strip = $('#strip');
        [...newMobs.map((m) => ['mobs', m]), ...newItems.map((m) => ['items', m])].forEach(([k, m], i) => {
          const card = rewardCard(k, m);
          card.style.animationDelay = i * 0.15 + 's';
          strip.appendChild(card);
        });
      }
      if ($('#nextQ')) $('#nextQ').onclick = () => goQuest(nextQ);
      drawQuest();
      if (firstFinish) {
        const next = SQL_LEVELS[idx + 1];
        setTimeout(() => showWin({ stars: E.stars, xpBefore, xpAfter: totalXP(), title: t('win_chapter', { n: idx + 1, name: ch.title }), nextLabel: t('next_chapter'), nextHref: next ? `#/sql/${next.id}` : '#/mobdex' }), 900);
      }
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') { E.timeSec = (E.timeSec || 0) + 5; P.save(); }
    }, 5000);
    cleanup = () => { clearInterval(timer); P.save(); };
    setTimeout(() => cm.refresh(), 0);
  }

  // ---------------- Free Lab: query anything, no grading ----------------
  const LAB_IDEAS = 6;

  function labScreen(main) {
    const E = P.level('lab');
    E.lastPlayed = Date.now();
    const hist = D().labHistory || (D().labHistory = []);
    P.save();
    let db = null;

    main.innerHTML = `
      <div class="level lab">
        <div class="lv-top">
          <a class="btn ghost small" href="#/">← ${t('back')}</a>
          <h1><span class="lv-num sql">🧪</span>${t('lab_title')}</h1>
          <button class="btn ghost small" id="resetDb">↺ ${t('lab_reset')}</button>
        </div>
        <p class="muted lab-sub">${t('lab_sub')}</p>
        <div class="lv-grid">
          <section class="col col-info">
            <div class="card"><h3>🔭 ${t('lab_ideas')}</h3><div class="ideas" id="ideas"></div></div>
            <div class="card schema"><h3>🗂 ${t('tables')}</h3><p class="muted small-note">👆 ${t('lab_peek')}<br>💡 ${t('lab_describe')}</p><div id="labTables"></div></div>
          </section>
          <section class="col col-code">
            <div class="editor sql lab-editor"><textarea id="code"></textarea></div>
            <div class="actions">
              <button class="btn run" id="runBtn">▶ ${t('run')}</button>
              <span class="muted small-note">⌘ + Enter</span>
            </div>
            <div class="feedback" id="fb"></div>
            <div class="card"><h3>🕘 ${t('lab_history')}</h3><div class="history" id="history"></div></div>
          </section>
          <section class="col col-world">
            <div class="card results"><h3>📊 <span id="rowsLabel">${t('output')}</span></h3><div class="table-wrap" id="results"><div class="muted">${t('output_empty')}</div></div></div>
          </section>
        </div>
      </div>`;

    const results = makeResultsView($('#results'), $('#rowsLabel'));
    const cm = makeEditor($('#code'), 'text/x-sqlite', E.code != null ? E.code : 'SELECT * FROM hunts LIMIT 10', () => run(), (v) => {
      E.code = v; clearTimeout(saveT); saveT = setTimeout(() => P.save(), 800);
    });
    let saveT;

    // Tables list is read from the live database, so tables he creates show up too.
    function drawTables() {
      const res = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid");
      const names = res.length ? res[0].values.map((r) => r[0]) : [];
      $('#labTables').innerHTML = names.map((tb) => {
        const cols = db.exec(`PRAGMA table_info(${tb})`)[0];
        const own = !SQL_TABLE_NAMES.includes(tb);
        return `<div class="schema-table"><button class="table-peek ${own ? 'own' : ''}" data-peek="${esc(tb)}"><code>${esc(tb)}</code>${own ? ` <small>✨ ${t('lab_yours')}</small>` : ''}</button>
          <div class="schema-cols">${cols ? cols.values.map((c) => `<span><code>${esc(c[1])}</code><small>${esc(c[2] || '')}</small></span>`).join('') : ''}</div></div>`;
      }).join('');
      $$('[data-peek]').forEach((b) => b.onclick = () => { cm.setValue(`SELECT * FROM ${b.dataset.peek} LIMIT 10`); run(); });
    }

    function drawHistory() {
      $('#history').innerHTML = hist.length
        ? hist.map((q, i) => `<button class="hist-item" data-h="${i}"><code>${esc(q.length > 90 ? q.slice(0, 90) + '…' : q)}</code></button>`).join('')
        : `<div class="muted">${t('lab_history_empty')}</div>`;
      $$('[data-h]').forEach((b) => b.onclick = () => { cm.setValue(hist[+b.dataset.h]); cm.focus(); });
    }

    $('#ideas').innerHTML = Array.from({ length: LAB_IDEAS }, (_, i) => `<button class="idea" data-idea="${i + 1}">${t('lab_idea_' + (i + 1))}</button>`).join('');
    $$('[data-idea]').forEach((b) => b.onclick = () => {
      cm.setValue(`-- ${b.textContent.replace(/<[^>]+>/g, '')}\n`);
      cm.setCursor(1, 0);
      cm.focus();
      Sound.play('click');
    });

    function reset() {
      if (db) db.close();
      db = freshDB();
      drawTables();
    }

    $('#resetDb').onclick = () => {
      reset();
      $('#fb').innerHTML = `<p class="ok">↺ ${t('lab_reset_done')}</p>`;
      Sound.play('place');
    };

    async function run() {
      const fb = $('#fb');
      const code = cm.getValue().trim();
      if (!code.replace(/--.*$/gm, '').trim()) { fb.innerHTML = `<p class="warn">${t('sql_empty')}</p>`; return; }
      await sqlReady;
      if (!db) reset();
      E.attempts = (E.attempts || 0) + 1;
      E.lastPlayed = Date.now();
      const i = hist.indexOf(code);
      if (i !== -1) hist.splice(i, 1);
      hist.unshift(code);
      hist.length = Math.min(hist.length, 20);
      P.save();
      drawHistory();
      try {
        const dm = code.match(/^\s*(?:describe|desc)\s+(?:table\s+)?([a-z_]\w*)\s*;?\s*$/i);
        if (dm && !db.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${dm[1]}'`).length) throw new Error('no such table: ' + dm[1]);
        const out = db.exec(translateShortcuts(code));
        const writes = /\b(insert|update|delete|replace)\b/i.test(noStrings(code));
        const changed = writes ? db.getRowsModified() : 0;
        if (out.length) {
          results.show(out[out.length - 1]);
          fb.innerHTML = '';
        } else {
          results.show(null);
          fb.innerHTML = `<p class="ok">✅ ${changed ? t(changed === 1 ? 'lab_changed_1' : 'lab_changed', { n: changed }) : t('lab_done')}</p>`;
        }
        if (/\b(create|drop|alter)\b/i.test(noStrings(code))) drawTables();
        Sound.play('click');
      } catch (e) {
        const live = (db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0] || { values: [] }).values.map((r) => r[0]);
        results.show(null, `❌ ${t('res_error')}`);
        fb.innerHTML = `<p class="err">❌ ${sqlErrorText(e.message, code, live, true)}</p>`;
        Sound.play('fail');
      }
    }

    $('#runBtn').onclick = () => run();
    sqlReady.then(() => { reset(); });
    drawHistory();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') { E.timeSec = (E.timeSec || 0) + 5; P.save(); }
    }, 5000);
    cleanup = () => { clearInterval(timer); if (db) db.close(); P.save(); };
    setTimeout(() => cm.refresh(), 0);
  }

  // ---------------- Mobdex ----------------
  function mobdexScreen(main) {
    const found = D().mobs;
    main.innerHTML = `
      <div class="page">
        <div class="lv-top"><a class="btn ghost small" href="#/">← ${t('back')}</a><h1>📖 ${t('mobdex')}</h1><span></span></div>
        <p class="muted center">${t('mobdex_sub', { n: found.length, total: MOBS.length })}</p>
        <div class="mob-grid" id="grid"></div>
        <h2 class="section-title">🎁 ${t('loot')}</h2>
        <p class="muted center">${t('loot_sub', { n: (D().items || []).length, total: ITEMS.length })}</p>
        <div class="mob-grid" id="lootGrid"></div>
      </div>`;
    const grid = $('#grid');
    MOBS.forEach((m) => {
      const have = found.includes(m.id);
      const card = document.createElement('div');
      card.className = 'mob-card ' + (have ? 'type-' + m.type : 'locked');
      card.appendChild(Sprites.artCanvas(Sprites.MOB_ART[m.id], 72, !have));
      card.insertAdjacentHTML('beforeend', have ? `
        <h3>${esc(m.name)}</h3>
        <span class="badge">${esc(m.type)}</span>
        <dl>
          <dt>❤ ${t('mob_health')}</dt><dd>${m.health}</dd>
          <dt>⚔ ${t('mob_damage')}</dt><dd>${m.damage}</dd>
          <dt>🏠 ${t('mob_home')}</dt><dd>${esc(m.home)}</dd>
          <dt>🎁 ${t('mob_loot')}</dt><dd>${m.loot ? esc(m.loot) : '—'}</dd>
        </dl>` : `<h3>???</h3><span class="badge">#${m.id}</span>`);
      grid.appendChild(card);
    });
    const lootGrid = $('#lootGrid'), gotItems = D().items || [];
    ITEMS.forEach((it) => {
      const have = gotItems.includes(it.id);
      const card = document.createElement('div');
      card.className = 'mob-card ' + (have ? 'rarity-' + it.rarity : 'locked');
      card.appendChild(Sprites.artCanvas(Sprites.ITEM_ART[it.id], 72, !have));
      card.insertAdjacentHTML('beforeend', have ? `
        <h3>${esc(it.name)}</h3>
        <span class="badge">${esc(it.rarity)}</span>
        <dl>
          <dt>💎 ${t('item_value')}</dt><dd>${it.value}</dd>
          <dt>🔨 ${t('item_used')}</dt><dd>${esc(it.used_for)}</dd>
        </dl>` : `<h3>???</h3><span class="badge">#${it.id}</span>`);
      lootGrid.appendChild(card);
    });
  }

  // ---------------- Parent view ----------------
  function fmtTime(sec) {
    const m = Math.round((sec || 0) / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  }

  function parentScreen(main) {
    const d = D();
    const levels = ALL_LEVELS();
    const doneN = levels.filter((l) => d.levels[l.id] && d.levels[l.id].done).length;
    const totalSec = levels.reduce((s, l) => s + ((d.levels[l.id] || {}).timeSec || 0), 0) + ((d.levels.lab || {}).timeSec || 0);
    const xp = totalXP();
    const errText = (e) => {
      if (!e) return '—';
      const s = I18N.t(e.key, e.vars || {});
      return esc(s.replace(/<[^>]+>/g, '')).slice(0, 140);
    };
    const row = (l, i, kind) => {
      const e = d.levels[l.id];
      const status = !e || !e.attempts ? 'not' : e.done ? 'done' : 'started';
      const quests = e && e.quests;
      const stuck = e && !e.done && (quests ? quests.some((q) => !q.done && (q.attempts || 0) >= 5) : e.attempts >= 5);
      const progress = quests && !e.done && e.attempts ? ` ${quests.filter((q) => q.done).length}/${quests.length}` : '';
      const title = pick(l.text).title;
      return `<tr class="${stuck ? 'stuck' : ''}">
        <td><b>${kind} ${i + 1}</b> · ${esc(title)}</td>
        <td><span class="pill ${status}">${t('p_' + status)}${progress}</span></td>
        <td>${e && e.done ? starsHTML(e.stars) : '—'}</td>
        <td class="num">${e ? e.attempts || 0 : 0}</td>
        <td class="num">${fmtTime(e && e.timeSec)}</td>
        <td class="num">${e ? e.hints || 0 : 0}</td>
        <td>${e && e.solutionSeen ? t('p_yes') : t('p_no')}</td>
        <td class="small">${e && !e.done ? errText(e.lastError) : '—'}${stuck ? `<div class="stuck-note">⚠️ ${t('p_stuck')}</div>` : ''}</td>
        <td class="small">${e && e.lastPlayed ? new Date(e.lastPlayed).toLocaleString(I18N.lang) : '—'}</td>
      </tr>`;
    };
    const labRow = () => {
      const e = d.levels.lab;
      return `<tr><td><b>🧪 ${t('lab_title')}</b></td><td>${e && e.attempts ? `<span class="pill started">${t('lab_used')}</span>` : `<span class="pill not">${t('p_not')}</span>`}</td>
        <td>—</td><td class="num">${e ? e.attempts || 0 : 0}</td><td class="num">${fmtTime(e && e.timeSec)}</td><td class="num">—</td><td>—</td>
        <td class="small">${(d.labHistory || []).slice(0, 3).map((q) => `<code>${esc(q.length > 60 ? q.slice(0, 60) + '…' : q)}</code>`).join('<br>') || '—'}</td>
        <td class="small">${e && e.lastPlayed ? new Date(e.lastPlayed).toLocaleString(I18N.lang) : '—'}</td></tr>`;
    };
    const source = Cloud.user ? t('parent_cloud', { email: esc(Cloud.user.email) }) : t('parent_local');
    main.innerHTML = `
      <div class="page parent">
        <div class="lv-top"><a class="btn ghost small" href="#/">← ${t('back')}</a><h1>🔒 ${t('parent_title')}</h1>
          ${Cloud.enabled ? `<button class="btn small ${Cloud.user ? 'ghost' : ''}" id="pAcct">${Cloud.user ? t('acct_logout') : t('acct_login')}</button>` : '<span></span>'}</div>
        <p class="muted">${esc(t('parent_sub', { name: d.name }))} ${source} ${Cloud.enabled && !Cloud.user ? t('parent_login_hint') : ''}</p>
        <div class="tiles">
          <div class="tile"><small>${t('p_done_n')}</small><b>${doneN} / ${levels.length}</b></div>
          <div class="tile"><small>${t('p_time')}</small><b>${fmtTime(totalSec)}</b></div>
          <div class="tile"><small>${t('p_days')}</small><b>${d.days.length}</b></div>
          <div class="tile"><small>${t('p_rank')}</small><b>${t('ranks')[rankOf(xp)]} · ${xp} XP</b></div>
          <div class="tile"><small>${t('p_mobs')}</small><b>${d.mobs.length} / ${MOBS.length}</b></div>
        </div>
        <div class="card"><div class="table-wrap"><table class="ptable">
          <thead><tr><th>${t('p_level')}</th><th>${t('p_status')}</th><th>${t('p_stars')}</th><th>${t('p_runs')}</th><th>${t('p_time')}</th><th>${t('p_hints')}</th><th>${t('p_peeked')}</th><th>${t('p_last_err')}</th><th>${t('p_last')}</th></tr></thead>
          <tbody>${PY_LEVELS.map((l, i) => row(l, i, 'Python')).join('')}${SQL_LEVELS.map((l, i) => row(l, i, 'SQL')).join('')}${labRow()}</tbody>
        </table></div></div>
        <button class="linkish danger" id="resetAll">${t('p_reset')}</button>
      </div>`;
    $('#resetAll').onclick = () => { if (confirm(t('p_reset_confirm'))) { P.resetAll(); render(); } };
    if ($('#pAcct')) $('#pAcct').onclick = async () => {
      if (Cloud.user) { await Cloud.signOut(); render(); } else openAccount(render);
    };
  }

  // ---------------- boot ----------------
  I18N.set(D().lang);
  window.addEventListener('hashchange', render);
  Cloud.onChange(() => {
    const h = location.hash;
    if (!h || h === '#/' || h.startsWith('#/parent')) render(); else renderHeader();
  });
  PyRunner.start();
  render();
  Cloud.init().catch((e) => console.warn('cloud init failed', e));
})();
