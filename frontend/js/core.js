// FinEx core: состояние, хранение прогресса, утилиты, маршрутизация.
window.FX = { views: {}, topics: [], Q: [], tasks: [] };
(function (FX) {
  'use strict';
  var KEY = 'finex.v1';
  function def() { return { lessons: {}, q: {}, exams: [], tasks: {}, missions: {}, sim: null, theme: 'auto' }; }
  var state = def();
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (var k in raw) state[k] = raw[k];
  } catch (e) { /* хранилище недоступно — работаем без сохранения */ }
  FX.state = state;
  FX.save = function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  FX.resetProgress = function () {
    var theme = state.theme; var d = def();
    for (var k in d) state[k] = d[k];
    state.theme = theme; FX.save();
  };

  // ---------- утилиты ----------
  FX.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  FX.fmt = function (n, d) {
    if (!isFinite(n)) return '—';
    d = d == null ? 2 : d;
    var s = Math.abs(n).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : '') + s.join(',');
  };
  FX.money = function (n, d) { return FX.fmt(n, d == null ? 0 : d) + ' ₽'; };
  FX.pct = function (x, d) { return FX.fmt(x * 100, d == null ? 1 : d) + '%'; };
  FX.sign = function (n, d) { return (n > 0 ? '+' : '') + FX.fmt(n, d); };
  FX.cls = function (n) { return n > 0 ? 'up' : n < 0 ? 'down' : ''; };
  FX.ri = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  FX.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  FX.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  FX.sample = function (arr, n) { return FX.shuffle(arr).slice(0, n); };
  FX.gauss = function () { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  FX.round = function (x, d) { var m = Math.pow(10, d || 0); return Math.round(x * m) / m; };
  FX.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  FX.$ = function (sel, root) { return (root || document).querySelector(sel); };
  FX.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------- банк вопросов ----------
  var counters = {};
  // Правильные варианты помечаются ведущим «+».
  FX.addQ = function (topic, text, opts, expl) {
    counters[topic] = (counters[topic] || 0) + 1;
    var a = [], o = [];
    opts.forEach(function (s, i) { if (s.charAt(0) === '+') { a.push(i); o.push(s.slice(1).trim()); } else o.push(s); });
    FX.Q.push({ id: topic + '-' + counters[topic], t: topic, q: text, o: o, a: a, e: expl || '' });
  };
  FX.topic = function (id) { return FX.topics.filter(function (t) { return t.id === id; })[0]; };
  FX.qByTopic = function (id) { return FX.Q.filter(function (q) { return q.t === id; }); };

  // Превращает расчётную задачу в тестовый вопрос с четырьмя вариантами.
  FX.taskToQ = function (task) {
    var g = task.gen();
    var f = function (v) { return FX.fmt(v, g.d) + (g.unit ? ' ' + g.unit : ''); };
    var seen = {}, opts = [];
    seen[f(g.answer)] = 1;
    var cand = (g.wrong || []).concat([g.answer * 1.1, g.answer * 0.9, g.answer * 1.25, g.answer * 0.75, g.answer + 1, g.answer - 1, g.answer * 2, g.answer / 2]);
    cand.forEach(function (v) { var s = f(v); if (opts.length < 3 && isFinite(v) && !seen[s]) { seen[s] = 1; opts.push(s); } });
    var o = [f(g.answer)].concat(opts);
    return { id: 'g:' + task.id, t: task.t, q: g.text, o: o, a: [0], e: g.sol, gen: true };
  };

  FX.recordAnswer = function (q, ok) {
    var s = state.q[q.id] || [0, 0, 0];
    if (ok) { s[0]++; s[2] = 0; } else { s[1]++; s[2] = 1; }
    state.q[q.id] = s; FX.save();
  };
  // Статистика по теме: сколько вопросов решено верно хотя бы раз, точность.
  FX.topicStats = function (id) {
    var qs = FX.qByTopic(id), seen = 0, right = 0, c = 0, w = 0;
    qs.forEach(function (q) { var s = state.q[q.id]; if (s) { seen++; if (s[0] > 0 && !s[2]) right++; c += s[0]; w += s[1]; } });
    var t = FX.topic(id), done = 0;
    t.lessons.forEach(function (l) { if (state.lessons[l.id]) done++; });
    return { total: qs.length, seen: seen, right: right, acc: c + w ? c / (c + w) : null, lessons: t.lessons.length, lessonsDone: done };
  };
  FX.mistakes = function () {
    return FX.Q.filter(function (q) { var s = state.q[q.id]; return s && s[2]; });
  };

  // ---------- тема оформления ----------
  var themeNames = { auto: 'авто', light: 'светлая', dark: 'тёмная' };
  function applyTheme() {
    var r = document.documentElement;
    if (state.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', state.theme);
    var b = document.getElementById('themeBtn'); if (b) b.textContent = 'Тема: ' + themeNames[state.theme];
    if (FX.onTheme) FX.onTheme();
  }

  // ---------- маршрутизация ----------
  FX.go = function (hash) { if (location.hash === '#' + hash) FX.render(); else location.hash = hash; };
  var lastHash = null;
  FX.render = function () {
    var h = (location.hash || '#home').slice(1);
    var parts = h.split('-'), name = parts[0], arg = parts.slice(1).join('-');
    var view = FX.views[name] || FX.views.home;
    if (FX.cleanup) { FX.cleanup(); FX.cleanup = null; }
    var el = document.getElementById('view');
    el.className = 'page';
    var navName = name === 'topic' || name === 'lesson' ? 'topics' : name;
    FX.$$('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-r') === navName); });
    view(el, arg);
    if (h !== lastHash) FX.$('.main').scrollTop = 0;
    lastHash = h;
  };
  FX.start = function () {
    applyTheme();
    document.getElementById('themeBtn').addEventListener('click', function () {
      state.theme = state.theme === 'auto' ? 'light' : state.theme === 'light' ? 'dark' : 'auto';
      FX.save(); applyTheme();
    });
    window.addEventListener('hashchange', FX.render);
    FX.render();
  };
})(window.FX);
