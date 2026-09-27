// Progress lives in localStorage first (play instantly, no login).
// If Supabase is configured and a parent signs in, it syncs to the cloud.
(function () {
  'use strict';

  const KEY = 'codecraft.v1';
  const today = () => new Date().toISOString().slice(0, 10);

  function fresh() {
    return {
      v: 1, name: 'Miner', lang: 'en', skin: 'none', sound: true,
      welcomed: false, askedAccount: false,
      levels: {}, mobs: [], days: [], updatedAt: Date.now(),
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return fresh();
  }

  // Combine two progress snapshots without losing anything either side earned.
  function merge(a, b) {
    const out = Object.assign(fresh(), a.updatedAt >= b.updatedAt ? a : b);
    out.levels = {};
    const ids = new Set([...Object.keys(a.levels || {}), ...Object.keys(b.levels || {})]);
    ids.forEach((id) => {
      const x = (a.levels || {})[id], y = (b.levels || {})[id];
      if (!x || !y) { out.levels[id] = x || y; return; }
      const newer = (x.lastPlayed || 0) >= (y.lastPlayed || 0) ? x : y;
      const m = Object.assign({}, newer);
      m.done = x.done || y.done;
      m.stars = Math.max(x.stars || 0, y.stars || 0);
      ['attempts', 'hints', 'timeSec'].forEach((k) => { m[k] = Math.max(x[k] || 0, y[k] || 0); });
      m.solutionSeen = x.solutionSeen || y.solutionSeen;
      if (x.quests || y.quests) {
        const qa = x.quests || [], qb = y.quests || [];
        m.quests = Array.from({ length: Math.max(qa.length, qb.length) }, (_, i) => {
          const p = qa[i] || {}, q = qb[i] || {};
          return { done: p.done || q.done, attempts: Math.max(p.attempts || 0, q.attempts || 0), solutionSeen: p.solutionSeen || q.solutionSeen };
        });
      }
      out.levels[id] = m;
    });
    out.mobs = [...new Set([...(a.mobs || []), ...(b.mobs || [])])];
    out.days = [...new Set([...(a.days || []), ...(b.days || [])])].sort();
    out.welcomed = a.welcomed || b.welcomed;
    return out;
  }

  // ---------- cloud (Supabase) ----------
  const cfg = window.CODECRAFT_CONFIG || {};
  const Cloud = {
    enabled: !!(cfg.supabaseUrl && cfg.supabaseAnonKey),
    client: null,
    user: null,
    listeners: [],
    onChange(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach((fn) => fn(this.user)); },

    async init() {
      if (!this.enabled) return;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data } = await this.client.auth.getSession();
      this.user = data.session ? data.session.user : null;
      if (this.user) await Progress.pullAndMerge();
      this.client.auth.onAuthStateChange((_ev, session) => {
        const was = this.user && this.user.id;
        this.user = session ? session.user : null;
        if (this.user && this.user.id !== was) Progress.pullAndMerge().then(() => this.emit());
        else this.emit();
      });
      this.emit();
    },

    async signUp(email, password) {
      const { data, error } = await this.client.auth.signUp({ email, password });
      if (error) throw error;
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) {
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { await this.client.auth.signOut(); },

    async pull() {
      const { data, error } = await this.client.from('progress').select('data').eq('user_id', this.user.id).maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    },
    async push(snapshot) {
      const { error } = await this.client.from('progress').upsert({ user_id: this.user.id, data: snapshot, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };

  let pushTimer = null;

  const Progress = {
    data: read(),

    save() {
      const d = this.data;
      d.updatedAt = Date.now();
      if (!d.days.includes(today())) d.days.push(today());
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
      if (Cloud.user) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => Cloud.push(this.data).catch((e) => console.warn('cloud save failed', e)), 1500);
      }
    },

    level(id) {
      if (!this.data.levels[id]) {
        this.data.levels[id] = { done: false, stars: 0, attempts: 0, hints: 0, solutionSeen: false, timeSec: 0, lastError: null, code: null, lastPlayed: 0 };
      }
      return this.data.levels[id];
    },

    async pullAndMerge() {
      try {
        const remote = await Cloud.pull();
        if (remote) this.data = merge(this.data, remote);
        this.save();
        await Cloud.push(this.data);
      } catch (e) { console.warn('cloud sync failed', e); }
    },

    resetAll() {
      const keep = { name: this.data.name, lang: this.data.lang, welcomed: true };
      this.data = Object.assign(fresh(), keep);
      this.save();
    },
  };

  window.Progress = Progress;
  window.Cloud = Cloud;
})();
