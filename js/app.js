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
  const RANK_XP = [0, 150, 350, 650, 1000, 1400];
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
      this.worker = new Worker('js/py-worker.js?v=4');
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
    db.run(MOB_DB_SQL);
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
      const cls = ['node', open ? 'open' : 'locked', e && e.done ? 'done' : '', l.boss ? 'boss' : '', kind].join(' ');
      const inner = `
        <span class="node-block">${open ? (l.boss ? '👑' : i + 1) : '🔒'}</span>
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
          <a class="mobdex-teaser" href="#/mobdex">
            <span class="teaser-faces" id="teaserFaces"></span>
            <span><b>📖 ${t('mobdex')}</b><small>${found} / ${MOBS.length}</small></span>
          </a>
        </div>
      </section>`;
    const faces = $('#teaserFaces');
    MOBS.slice(0, 6).forEach((m) => faces.appendChild(Sprites.artCanvas(Sprites.MOB_ART[m.id], 28, !D().mobs.includes(m.id))));
    if (!D().welcomed) openWelcome();
  }

  function openWelcome() {
    const m = modal(`
      <div class="welcome-art" id="wArt"></div>
      <h2>${esc(t('welcome', { name: D().name === 'Miner' ? '' : D().name }).replace(/,\s*!/, '!').replace(/,\s*¡/, '¡'))}</h2>
      <p>${t('welcome_sub')}</p>
      <label class="field"><span>${t('name_label')}</span><input id="wName" maxlength="16" value="${esc(D().name)}"></label>
      <p class="muted">${t('welcome_lang')}</p>
      <div class="lang big">${I18N.langs.map(([k]) => `<button data-wl="${k}" class="${I18N.lang === k ? 'on' : ''}">${{ en: '🇬🇧 English', es: '🇪🇸 Español', de: '🇩🇪 Deutsch' }[k]}</button>`).join('')}</div>
      <div class="modal-actions"><button class="btn big" data-close>${t('welcome_go')} ⛏️</button></div>`, { sticky: true, cls: 'center' });
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

  function pyErrorMessage(err) {
    const pre = err.line ? t('err_line', { line: err.line }) : '';
    if (err.kind === 'GameStop') return { key: 'fatal_' + err.msg, text: pre + t('fatal_' + err.msg) };
    if (err.kind === 'NameError') {
      const name = (err.msg.match(/'([^']+)'/) || [])[1] || '?';
      return { key: 'err_NameError', vars: { name }, text: pre + t('err_NameError', { name }) };
    }
    const k = err.kind === 'TabError' ? 'IndentationError' : err.kind;
    const key = 'err_' + k;
    const msg = I18N.t(key) !== key ? t(key) : t('err_other', { kind: err.kind });
    return { key: I18N.t(key) !== key ? key : 'err_other', vars: { kind: err.kind }, text: pre + msg + ` <span class="raw">(${esc(err.kind)}: ${esc(err.msg)})</span>` };
  }

  function lint(code) {
    const cmds = ['move', 'turn_left', 'turn_right', 'mine', 'place', 'build'];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].trim().match(/^([a-z_]+)$/);
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
    return level.check(w);
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
    const showWorld = (layout) => { view.setWorld(new World(layout), D().skin); updateInv(); };
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

    async function run() {
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
      const layouts = L.tests > 1 ? Array.from({ length: L.tests }, mkLayout) : [mkLayout()];
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
      showWorld(layouts[showIdx]);
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
          msg = pyErrorMessage(v.error);
          E.lastError = { key: msg.key, vars: msg.vars };
        } else {
          msg = { text: t('why_' + v.why, { said: esc(v.said || ''), n: v.n }) };
          E.lastError = { key: 'why_' + v.why };
        }
        outLine(out, 'err', '❌ ' + msg.text);
        if (failIdx > 0 && verdicts[0].ok) outLine(out, 'warn', '🎲 ' + t('test_fail', { n: failIdx + 1 }));
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

  function showWin({ stars, xpBefore, xpAfter, nextHref, starsTotal }) {
    Sound.play('win');
    confetti();
    const rb = rankOf(xpBefore), ra = rankOf(xpAfter), ranks = t('ranks');
    const newSkin = Object.keys(SKIN_RANK).find((s) => SKIN_RANK[s] > rb && SKIN_RANK[s] <= ra);
    const m = modal(`
      <div class="win-stars">${Array.from({ length: starsTotal || 3 }, (_, i) => `<span class="star big ${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
      <h2>${t('win')}</h2>
      <p>${esc(t('win_sub', { name: D().name }))}</p>
      <p class="xp-gain">${xpAfter > xpBefore ? t('xp_gain', { n: xpAfter - xpBefore }) : ''}</p>
      ${ra > rb ? `<p class="rank-up">🏅 ${t('rank_up', { rank: ranks[ra] })}</p>` : ''}
      ${newSkin ? `<p class="rank-up">🪖 ${t('skin_unlock', { skin: t('skin_' + newSkin) })}</p>` : ''}
      <div class="modal-actions">
        ${stars < (starsTotal || 3) ? `<button class="btn ghost" data-close>${t('again')}</button>` : ''}
        <a class="btn" href="${nextHref}" data-go>${nextHref === '#/' ? t('to_map') : nextHref === '#/mobdex' ? '📖 ' + t('mobdex') : t('next') + ' →'}</a>
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

  // ---------------- SQL level screen ----------------
  function sqlScreen(main, id) {
    const idx = SQL_LEVELS.findIndex((l) => l.id === id);
    if (!unlocked(SQL_LEVELS, idx)) { location.hash = '#/'; return; }
    const L = SQL_LEVELS[idx];
    const tx = pick(L.text);
    const E = P.level(id);
    if (!E.quests) E.quests = L.quests.map(() => ({ done: false, attempts: 0, solutionSeen: false }));
    E.lastPlayed = Date.now();
    P.save();
    let qi = E.quests.findIndex((q) => !q.done);
    if (qi === -1) qi = 0;
    let hintIdx = 0;

    main.innerHTML = `
      <div class="level">
        <div class="lv-top">
          <a class="btn ghost small" href="#/">← ${t('back')}</a>
          <h1><span class="lv-num sql ${L.boss ? 'boss' : ''}">${L.boss ? '👑' : idx + 1}</span>${esc(tx.title)}</h1>
          <a class="btn ghost small" href="#/mobdex">📖 ${t('mobdex')} ${D().mobs.length}/${MOBS.length}</a>
        </div>
        <div class="lv-grid">
          <section class="col col-info">
            <div class="card"><h3>📜 ${t('story')}</h3><p>${tx.story}</p></div>
            <div class="card lesson"><h3>💡 ${t('lesson')}</h3><p>${tx.lesson}</p><div class="ex-label">${t('example')}</div><pre class="example cm-s-codecraft" id="example"></pre></div>
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
            <div class="card schema"><h3>🗂 ${t('schema')}</h3>
              <div class="schema-cols">${MOB_SCHEMA.map(([c, ty]) => `<span><code>${c}</code><small>${ty}</small></span>`).join('')}</div>
            </div>
          </section>
        </div>
      </div>`;

    CodeMirror.runMode(tx.example, 'text/x-sqlite', $('#example'));
    const startCode = E.code != null ? E.code : (L.quests[0].starter || 'SELECT ');
    const cm = makeEditor($('#code'), 'text/x-sqlite', startCode, () => run(), (v) => {
      E.code = v; clearTimeout(saveT); saveT = setTimeout(() => P.save(), 800);
    });
    let saveT;

    function drawQuest() {
      const q = E.quests[qi];
      $('#quest').innerHTML = `
        <div class="quest-top"><h3>🗡 ${t('quest', { i: qi + 1, n: L.quests.length })}</h3>
          <div class="quest-dots">${E.quests.map((x, i) => `<button class="qdot ${x.done ? 'done' : ''} ${i === qi ? 'on' : ''}" data-q="${i}">${x.done ? '✓' : i + 1}</button>`).join('')}</div>
        </div>
        <p>${tx.quests[qi]}</p>
        ${q.done ? `<p class="ok">✅ ${t('quest_done')}</p>` : ''}`;
      $$('[data-q]').forEach((b) => b.onclick = () => { qi = +b.dataset.q; hintIdx = 0; $('#hintBox').hidden = true; $('#hintBtn').disabled = false; $('#fb').innerHTML = ''; drawQuest(); });
    }
    drawQuest();

    $('#runBtn').onclick = () => run();
    $('#hintBtn').onclick = () => {
      const box = $('#hintBox');
      if (hintIdx >= tx.hints.length) return;
      hintIdx++;
      E.hints = Math.max(E.hints || 0, hintIdx);
      P.save();
      box.hidden = false;
      box.innerHTML = tx.hints.slice(0, hintIdx).map((h, i) => `<p><b>💡 ${i + 1}.</b> ${h}</p>`).join('') +
        (hintIdx === tx.hints.length ? `<button class="btn ghost small" id="solBtn">🔑 ${t('solution')}</button>` : '');
      const sb = $('#solBtn');
      if (sb) sb.onclick = () => {
        const q = E.quests[qi];
        if (!q.solutionSeen && !q.done && !confirm(t('solution_confirm'))) return;
        q.solutionSeen = !q.done || q.solutionSeen;
        E.solutionSeen = true;
        P.save();
        sb.outerHTML = `<pre class="example cm-s-codecraft" id="solPre"></pre>`;
        CodeMirror.runMode(L.quests[qi].answer, 'text/x-sqlite', $('#solPre'));
      };
      if (hintIdx === tx.hints.length) $('#hintBtn').disabled = true;
    };

    function sqlError(msg) {
      let m;
      const values = new Set(MOBS.flatMap((x) => [x.type, x.home, x.loot, x.name.toLowerCase()]));
      if ((m = msg.match(/no such column: (\S+)/))) {
        const tip = values.has(m[1].toLowerCase()) ? ' ' + t('sqlerr_text_quote') : '';
        return t('sqlerr_column', { x: esc(m[1]) }) + tip;
      }
      if ((m = msg.match(/no such table: (\S+)/))) return t('sqlerr_table', { x: esc(m[1]) });
      if ((m = msg.match(/near "([^"]*)": syntax error/))) return t('sqlerr_syntax', { x: esc(m[1]) });
      if (/incomplete input/.test(msg)) return t('sqlerr_incomplete');
      return t('sqlerr_other', { x: esc(msg) });
    }

    function drawTable(res) {
      if (!res) { $('#results').innerHTML = `<div class="muted">0 ${t('sql_rows', { n: '' }).trim()}</div>`; $('#rowsLabel').textContent = t('sql_rows', { n: 0 }); return; }
      const rows = res.values.slice(0, 100);
      $('#rowsLabel').textContent = t('sql_rows', { n: res.values.length });
      $('#results').innerHTML = `<table><thead><tr>${res.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td class="${typeof v === 'number' ? 'num' : ''}">${v === null ? '<i>NULL</i>' : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }

    // Compare by result, not by text: any correct query counts.
    function compare(got, exp, quest) {
      const g = got || { columns: [], values: [] };
      if (g.columns.length !== exp.columns.length) return { ok: false, key: 'sql_cols', vars: { got: g.columns.length, exp: exp.columns.length } };
      if (g.values.length !== exp.values.length) return { ok: false, key: 'sql_rows_n', vars: { got: g.values.length, exp: exp.values.length } };
      // Cells are sorted within each row so "health, name" counts the same as "name, health".
      const key = (r) => JSON.stringify(r.map((v) => (v === null ? 'NULL' : String(v))).sort());
      const a = g.values.map(key).sort(), b = exp.values.map(key).sort();
      if (a.some((x, i) => x !== b[i])) return { ok: false, key: 'sql_values' };
      if (quest.orderCol !== undefined) {
        const want = exp.columns[quest.orderCol].toLowerCase();
        const gi = g.columns.findIndex((c) => c.toLowerCase() === want);
        const col = gi === -1 ? quest.orderCol : gi;
        const seqG = g.values.map((r) => String(r[col]));
        const seqE = exp.values.map((r) => String(r[quest.orderCol]));
        if (seqG.some((x, i) => x !== seqE[i])) return { ok: false, key: 'sql_order' };
      }
      return { ok: true };
    }

    async function run() {
      const fb = $('#fb');
      const code = cm.getValue().trim().replace(/;\s*$/, '');
      if (!code) { fb.innerHTML = `<p class="warn">${t('sql_empty')}</p>`; return; }
      if (/;\s*\S/.test(code)) { fb.innerHTML = `<p class="warn">${t('sql_multi')}</p>`; return; }
      await sqlReady;
      const q = E.quests[qi];
      const quest = L.quests[qi];
      q.attempts = (q.attempts || 0) + 1;
      E.attempts = (E.attempts || 0) + 1;
      E.lastPlayed = Date.now();
      const db = freshDB();
      let res;
      try {
        const out = db.exec(code);
        res = out[out.length - 1];
      } catch (e) {
        db.close();
        fb.innerHTML = `<p class="err">❌ ${sqlError(e.message)}</p>`;
        E.lastError = { key: 'sqlerr_other', vars: { x: e.message } };
        Sound.play('fail');
        P.save();
        return;
      }
      const exp = db.exec(quest.answer)[0];
      db.close();
      drawTable(res);
      const c = compare(res, exp, quest);
      if (!c.ok) {
        fb.innerHTML = `<p class="err">🤔 ${t(c.key, c.vars)}</p>`;
        E.lastError = { key: c.key, vars: c.vars };
        Sound.play('fail');
        P.save();
        return;
      }
      const xpBefore = totalXP();
      const wasDone = q.done;
      q.done = true;
      E.lastError = null;
      const newMobs = quest.unlock.filter((mid) => !D().mobs.includes(mid));
      D().mobs.push(...newMobs);
      const allDone = E.quests.every((x) => x.done);
      const stars = E.quests.filter((x) => x.done && !x.solutionSeen).length;
      if (allDone) { E.stars = Math.max(E.stars || 0, stars); }
      const firstFinish = allDone && !E.done;
      if (allDone) E.done = true;
      P.save();
      renderHeader();
      Sound.play(newMobs.length ? 'unlock' : 'win');
      const nextQ = E.quests.findIndex((x) => !x.done);
      fb.innerHTML = `<div class="correct"><p class="ok">✅ ${t('sql_correct')} ${!wasDone && totalXP() > xpBefore ? `<b class="xp-gain">${t('xp_gain', { n: totalXP() - xpBefore })}</b>` : ''}</p>
        ${newMobs.length ? `<p>${t('sql_unlocked')}</p><div class="unlock-strip" id="strip"></div>` : ''}
        ${nextQ !== -1 ? `<button class="btn" id="nextQ">${t('sql_next')} →</button>` : ''}</div>`;
      if (newMobs.length) {
        const strip = $('#strip');
        newMobs.forEach((mid, i) => {
          const mob = MOBS.find((x) => x.id === mid);
          const card = document.createElement('div');
          card.className = 'mini-card pop';
          card.style.animationDelay = i * 0.15 + 's';
          card.appendChild(Sprites.artCanvas(Sprites.MOB_ART[mid], 48));
          card.insertAdjacentHTML('beforeend', `<span>${esc(mob.name)}</span>`);
          strip.appendChild(card);
        });
      }
      if ($('#nextQ')) $('#nextQ').onclick = () => { qi = nextQ; hintIdx = 0; $('#hintBox').hidden = true; $('#hintBtn').disabled = false; fb.innerHTML = ''; drawQuest(); };
      drawQuest();
      if (firstFinish) {
        const next = SQL_LEVELS[idx + 1];
        setTimeout(() => showWin({ stars: E.stars, xpBefore, xpAfter: totalXP(), nextHref: next ? `#/sql/${next.id}` : '#/mobdex' }), 900);
      }
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') { E.timeSec = (E.timeSec || 0) + 5; P.save(); }
    }, 5000);
    cleanup = () => { clearInterval(timer); P.save(); };
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
          <dt>🎁 ${t('mob_loot')}</dt><dd>${esc(m.loot)}</dd>
        </dl>` : `<h3>???</h3><span class="badge">#${m.id}</span>`);
      grid.appendChild(card);
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
    const totalSec = levels.reduce((s, l) => s + ((d.levels[l.id] || {}).timeSec || 0), 0);
    const xp = totalXP();
    const errText = (e) => {
      if (!e) return '—';
      const s = I18N.t(e.key, e.vars || {});
      return esc(s.replace(/<[^>]+>/g, '')).slice(0, 140);
    };
    const row = (l, i, kind) => {
      const e = d.levels[l.id];
      const status = !e || !e.attempts ? 'not' : e.done ? 'done' : 'started';
      const stuck = e && !e.done && e.attempts >= 5;
      const title = pick(l.text).title;
      return `<tr class="${stuck ? 'stuck' : ''}">
        <td><b>${kind} ${i + 1}</b> · ${esc(title)}</td>
        <td><span class="pill ${status}">${t('p_' + status)}</span></td>
        <td>${e && e.done ? starsHTML(e.stars) : '—'}</td>
        <td class="num">${e ? e.attempts || 0 : 0}</td>
        <td class="num">${fmtTime(e && e.timeSec)}</td>
        <td class="num">${e ? e.hints || 0 : 0}</td>
        <td>${e && e.solutionSeen ? t('p_yes') : t('p_no')}</td>
        <td class="small">${e && !e.done ? errText(e.lastError) : '—'}${stuck ? `<div class="stuck-note">⚠️ ${t('p_stuck')}</div>` : ''}</td>
        <td class="small">${e && e.lastPlayed ? new Date(e.lastPlayed).toLocaleString(I18N.lang) : '—'}</td>
      </tr>`;
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
          <tbody>${PY_LEVELS.map((l, i) => row(l, i, 'Python')).join('')}${SQL_LEVELS.map((l, i) => row(l, i, 'SQL')).join('')}</tbody>
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
