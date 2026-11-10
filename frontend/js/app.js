// Экраны: обзор, темы, уроки, практика, расчётные задачи, демоэкзамен.
(function (FX) {
  'use strict';
  var S = FX.state, esc = FX.esc, f = FX.fmt;
  var SHORT = { inst: 'Инструменты', risk: 'Риски', law: 'Право', market: 'Рынок', report: 'Отчётность', math: 'Математика' };
  FX.SHORT = SHORT;
  var EXAM = { total: 50, minutes: 60, pass: 35, mix: { inst: 9, risk: 8, law: 8, market: 8, report: 8, math: 9 } };

  // ---------- общий компонент вопроса ----------
  function makeItem(q) { return { q: q, order: FX.shuffle(q.o.map(function (_, i) { return i; })), sel: [], done: false, ok: null, flag: false }; }
  function isRight(it) {
    var a = it.q.a.slice().sort(), s = it.sel.slice().sort();
    return a.length === s.length && a.every(function (v, i) { return v === s[i]; });
  }
  function toggle(it, oi) {
    if (it.q.a.length > 1) { var p = it.sel.indexOf(oi); if (p >= 0) it.sel.splice(p, 1); else it.sel.push(oi); }
    else it.sel = [oi];
  }
  function qHtml(it, reveal) {
    var q = it.q, multi = q.a.length > 1;
    var h = '<div class="q"><div class="row"><span class="pill acc">' + SHORT[q.t] + '</span>' +
      (multi ? '<span class="pill">несколько верных ответов</span>' : '') + (q.gen ? '<span class="pill">расчёт</span>' : '') + '</div>' +
      '<div class="qt">' + esc(q.q) + '</div><div class="opts">';
    it.order.forEach(function (oi) {
      var sel = it.sel.indexOf(oi) >= 0, c = 'opt' + (multi ? ' multi' : '') + (sel ? ' sel' : '');
      if (reveal) { if (q.a.indexOf(oi) >= 0) c += ' ok'; else if (sel) c += ' bad'; }
      h += '<button type="button" class="' + c + '" data-o="' + oi + '"' + (reveal ? ' disabled' : '') + '><span class="mk">' + (sel ? '✓' : '') + '</span><span>' + esc(q.o[oi]) + '</span></button>';
    });
    h += '</div>';
    if (reveal) {
      var ok = isRight(it);
      h += '<div class="expl"><b class="' + (ok ? 'up' : 'down') + '">' + (ok ? 'Верно.' : (it.sel.length ? 'Неверно.' : 'Нет ответа.')) + '</b> ' + (q.gen ? q.e : esc(q.e)) + '</div>';
    }
    return h + '</div>';
  }
  function bar(x) { return '<div class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, x)) * 100) + '%"></i></div>'; }
  function act(el, handlers) {
    el.onclick = function (e) {
      var o = e.target.closest('[data-o]'), b = e.target.closest('[data-act]');
      if (o && handlers.opt) return handlers.opt(+o.getAttribute('data-o'));
      if (b && handlers[b.getAttribute('data-act')]) handlers[b.getAttribute('data-act')](b.getAttribute('data-arg'), b);
    };
    el.onsubmit = null; el.oninput = null; el.onchange = null;
  }
  FX.act = act;

  // ---------- обзор ----------
  var askReset = false;
  FX.views.home = function (el) {
    var lessons = 0, lessonsDone = 0, right = 0, total = 0, seen = 0;
    var rows = FX.topics.map(function (t) {
      var s = FX.topicStats(t.id);
      lessons += s.lessons; lessonsDone += s.lessonsDone; right += s.right; total += s.total; seen += s.seen;
      return '<tr class="pick" data-act="go" data-arg="topic-' + t.id + '"><td class="tk">' + t.n + '</td><td style="white-space:normal">' + t.title + '</td>' +
        '<td class="r">' + s.lessonsDone + '/' + s.lessons + '</td><td class="r">' + s.right + '/' + s.total + '</td>' +
        '<td class="r">' + (s.acc == null ? '—' : FX.pct(s.acc, 0)) + '</td><td style="min-width:110px">' + bar(s.right / s.total) + '</td></tr>';
    }).join('');
    var best = S.exams.reduce(function (m, e) { return Math.max(m, e.score); }, 0);
    var ready = total ? right / total : 0;
    var mist = FX.mistakes().length;
    var next = lessonsDone < lessons ? [lessonsDone ? 'Продолжить теорию' : 'Начать с теории', 'topics'] : (ready < 0.7 ? ['Решать вопросы', 'practice'] : ['Пройти демоэкзамен', 'exam']);
    el.innerHTML =
      '<div class="head"><h1>Подготовка к экзамену на статус квалифицированного инвестора</h1>' +
      '<p>Теория по шести блокам программы, практика с разбором ответов, расчётные задачи, торговый тренажёр и демоэкзамен в формате «Финуслуг».</p></div>' +
      '<div class="grid k4">' +
      '<div class="kpi"><div class="l">Готовность</div><div class="v">' + FX.pct(ready, 0) + '</div><div class="s">вопросов банка решено верно</div></div>' +
      '<div class="kpi"><div class="l">Теория</div><div class="v">' + lessonsDone + ' / ' + lessons + '</div><div class="s">уроков изучено</div></div>' +
      '<div class="kpi"><div class="l">Практика</div><div class="v">' + seen + ' / ' + total + '</div><div class="s">вопросов пройдено' + (mist ? ', ошибок к повтору: ' + mist : '') + '</div></div>' +
      '<div class="kpi"><div class="l">Лучший экзамен</div><div class="v">' + (S.exams.length ? best + ' / ' + EXAM.total : '—') + '</div><div class="s">' + (S.exams.length ? (best >= EXAM.pass ? 'порог пройден' : 'до порога ' + (EXAM.pass - best)) : 'попыток ещё не было') + '</div></div>' +
      '</div>' +
      '<div class="row"><a class="btn primary" href="#' + next[1] + '">' + next[0] + '</a>' + (mist ? '<button class="btn" data-act="mist">Работа над ошибками (' + mist + ')</button>' : '') + '</div>' +
      '<div class="card"><h2>Прогресс по темам</h2><div class="tw"><table class="t"><thead><tr><th>№</th><th>Тема</th><th class="r">Уроки</th><th class="r">Вопросы</th><th class="r">Точность</th><th>Освоено</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="split"><div class="card"><h2>Формат экзамена</h2><div class="kv">' +
      '<span>Вопросов</span><span class="v">50</span><span>Время</span><span class="v">60 минут</span>' +
      '<span>Проходной балл</span><span class="v">35 из 50 (70%)</span><span>Типы вопросов</span><span class="v">один / несколько ответов, кейсы</span>' +
      '<span>Пересдача</span><span class="v">не ранее следующего дня</span></div>' +
      '<p class="muted" style="font-size:13.5px">Экзамен проводится на платформе «Финуслуги» Московской биржи; вопросы выбираются случайно из общей базы. Условия и стоимость уточняйте на официальной странице.</p></div>' +
      '<div class="card"><h2>О материалах</h2><p style="font-size:14.5px">Теория и вопросы FinEx составлены самостоятельно по открытой программе экзамена и не совпадают с официальной базой. Приложение — учебный тренажёр, а не инвестиционная рекомендация. Цены и бумаги в торговом тренажёре вымышленные.</p>' +
      '<div class="row">' + (askReset ? '<span class="muted">Удалить весь прогресс?</span><button class="btn sm sell" data-act="resetYes">Да, сбросить</button><button class="btn sm" data-act="resetNo">Отмена</button>' : '<button class="btn sm ghost" data-act="reset">Сбросить прогресс</button>') + '</div></div></div>';
    act(el, {
      go: function (a) { FX.go(a); },
      mist: function () { startPractice({ mistakes: true }); },
      reset: function () { askReset = true; FX.render(); },
      resetNo: function () { askReset = false; FX.render(); },
      resetYes: function () { askReset = false; FX.resetProgress(); FX.session = null; FX.exam = null; FX.render(); }
    });
  };

  // ---------- темы ----------
  FX.views.topics = function (el) {
    el.innerHTML = '<div class="head"><h1>Темы и теория</h1><p>Шесть блоков программы экзамена. В каждом — уроки с формулами и практика по теме.</p></div><div class="grid">' +
      FX.topics.map(function (t) {
        var s = FX.topicStats(t.id);
        return '<a class="card" href="#topic-' + t.id + '"><span class="n">БЛОК ' + t.n + '</span><h2>' + t.title + '</h2><p class="muted" style="font-size:14px">' + t.desc + '</p>' +
          '<div class="row between" style="margin-top:auto;font-size:13px"><span>Уроки ' + s.lessonsDone + '/' + s.lessons + '</span><span>Вопросы ' + s.right + '/' + s.total + '</span></div>' + bar((s.lessonsDone / s.lessons + s.right / s.total) / 2) + '</a>';
      }).join('') + '</div>';
    act(el, {});
  };
  FX.views.topic = function (el, id) {
    var t = FX.topic(id); if (!t) return FX.go('topics');
    var s = FX.topicStats(id);
    var nTasks = FX.tasks.filter(function (x) { return x.t === id; }).length;
    el.innerHTML = '<div class="head"><div class="crumb"><a href="#topics">Темы</a> / Блок ' + t.n + '</div><h1>' + t.title + '</h1><p>' + t.desc + '</p></div>' +
      '<div class="split"><div class="card"><h2>Уроки</h2><div class="lessons">' +
      t.lessons.map(function (l, i) {
        var d = S.lessons[l.id];
        return '<a href="#lesson-' + l.id + '"><span class="tick' + (d ? ' on' : '') + '">' + (d ? '✓' : '') + '</span><span class="t">' + (i + 1) + '. ' + l.title + '</span></a>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2>Практика по теме</h2><div class="kv"><span>Вопросов в банке</span><span class="v">' + s.total + '</span><span>Решено верно</span><span class="v">' + s.right + '</span>' +
      '<span>Точность ответов</span><span class="v">' + (s.acc == null ? '—' : FX.pct(s.acc, 0)) + '</span><span>Расчётных задач</span><span class="v">' + nTasks + '</span></div>' + bar(s.right / s.total) +
      '<div class="row"><button class="btn primary" data-act="p10">10 вопросов</button><button class="btn" data-act="pall">Все вопросы темы</button></div></div></div>';
    act(el, {
      p10: function () { startPractice({ topic: id, n: 10 }); },
      pall: function () { startPractice({ topic: id, n: 999 }); }
    });
  };
  FX.views.lesson = function (el, id) {
    var t, l, idx;
    FX.topics.forEach(function (tt) { tt.lessons.forEach(function (ll, i) { if (ll.id === id) { t = tt; l = ll; idx = i; } }); });
    if (!l) return FX.go('topics');
    var prev = t.lessons[idx - 1], next = t.lessons[idx + 1], done = S.lessons[id];
    el.innerHTML = '<div class="head"><div class="crumb"><a href="#topics">Темы</a> / <a href="#topic-' + t.id + '">' + t.title + '</a></div><h1>' + l.title + '</h1></div>' +
      '<div class="card"><div class="prose">' + l.html + '</div></div>' +
      '<div class="row between"><div class="row">' + (prev ? '<a class="btn" href="#lesson-' + prev.id + '">← Назад</a>' : '') +
      '<button class="btn' + (done ? '' : ' primary') + '" data-act="done">' + (done ? 'Изучено ✓' : 'Отметить изученным') + '</button>' +
      (next ? '<a class="btn" href="#lesson-' + next.id + '">Следующий урок →</a>' : '') + '</div>' +
      '<button class="btn" data-act="quiz">Проверить себя: 5 вопросов</button></div>';
    act(el, {
      done: function () { if (S.lessons[id]) delete S.lessons[id]; else S.lessons[id] = 1; FX.save(); FX.render(); },
      quiz: function () { S.lessons[id] = 1; FX.save(); startPractice({ topic: t.id, n: 5 }); }
    });
  };

  // ---------- практика ----------
  function startPractice(o) {
    var pool, title;
    if (o.mistakes) { pool = FX.mistakes(); title = 'Работа над ошибками'; }
    else if (o.topic) { pool = FX.qByTopic(o.topic); title = FX.topic(o.topic).title; }
    else { pool = FX.Q; title = 'Все темы'; }
    if (!o.mistakes) {
      // сначала те, что ещё не решены верно
      var fresh = pool.filter(function (q) { var s = S.q[q.id]; return !s || s[2] || !s[0]; });
      var rest = pool.filter(function (q) { return fresh.indexOf(q) < 0; });
      pool = FX.shuffle(fresh).concat(FX.shuffle(rest));
    } else pool = FX.shuffle(pool);
    FX.session = { title: title, opts: o, items: pool.slice(0, o.n || 10).map(makeItem), i: 0 };
    FX.go('practice');
  }
  FX.startPractice = startPractice;
  var pSetup = { topic: '', n: 10 };
  FX.views.practice = function (el) {
    var ss = FX.session;
    if (!ss || !ss.items.length) {
      var mist = FX.mistakes().length;
      el.innerHTML = '<div class="head"><h1>Практика</h1><p>Ответ проверяется сразу, к каждому вопросу есть разбор. Сначала выдаются вопросы, которые вы ещё не решали или решили неверно.</p></div>' +
        '<div class="card"><div class="row"><label class="f">Тема<select id="pTopic"><option value="">Все темы</option>' +
        FX.topics.map(function (t) { return '<option value="' + t.id + '"' + (pSetup.topic === t.id ? ' selected' : '') + '>' + t.n + '. ' + t.title + '</option>'; }).join('') + '</select></label>' +
        '<label class="f">Количество<select id="pN">' + [5, 10, 20, 30].map(function (n) { return '<option' + (pSetup.n === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="row"><button class="btn primary" data-act="start">Начать</button>' +
        (mist ? '<button class="btn" data-act="mist">Работа над ошибками (' + mist + ')</button>' : '') + '</div></div>' +
        '<div class="card"><h2>В банке ' + FX.Q.length + ' вопросов</h2><div class="kv">' + FX.topics.map(function (t) { var s = FX.topicStats(t.id); return '<span>' + t.title + '</span><span class="v">' + s.right + ' / ' + s.total + '</span>'; }).join('') + '</div></div>';
      act(el, {
        start: function () { pSetup.topic = FX.$('#pTopic').value; pSetup.n = +FX.$('#pN').value; startPractice({ topic: pSetup.topic, n: pSetup.n }); },
        mist: function () { startPractice({ mistakes: true, n: 20 }); }
      });
      return;
    }
    if (ss.i >= ss.items.length) return practiceSummary(el, ss);
    var it = ss.items[ss.i], last = ss.i === ss.items.length - 1;
    el.innerHTML = '<div class="head"><div class="crumb">Практика / ' + esc(ss.title) + '</div><div class="row between"><h2>Вопрос ' + (ss.i + 1) + ' из ' + ss.items.length + '</h2><button class="btn sm ghost" data-act="quit">Завершить</button></div>' + bar(ss.i / ss.items.length) + '</div>' +
      '<div class="card">' + qHtml(it, it.done) + '<div class="row">' +
      (it.done ? '<button class="btn primary" data-act="next">' + (last ? 'К результатам' : 'Дальше →') + '</button>' : '<button class="btn primary" data-act="check"' + (it.sel.length ? '' : ' disabled') + '>Ответить</button>') + '</div></div>';
    act(el, {
      opt: function (oi) { if (!it.done) { toggle(it, oi); FX.render(); } },
      check: function () { it.done = true; it.ok = isRight(it); FX.recordAnswer(it.q, it.ok); FX.render(); },
      next: function () { ss.i++; FX.render(); },
      quit: function () { ss.items = ss.items.filter(function (x) { return x.done; }); ss.i = ss.items.length; if (!ss.items.length) FX.session = null; FX.render(); }
    });
  };
  function practiceSummary(el, ss) {
    var ok = ss.items.filter(function (x) { return x.ok; }).length;
    el.innerHTML = '<div class="head"><div class="crumb">Практика / ' + esc(ss.title) + '</div><h1>Результат: ' + ok + ' из ' + ss.items.length + '</h1></div>' +
      '<div class="card"><div class="lessons">' + ss.items.map(function (it, i) {
        return '<a href="#practice" data-act="show" data-arg="' + i + '"><span class="pill ' + (it.ok ? 'ok' : 'bad') + '">' + (it.ok ? 'верно' : 'ошибка') + '</span><span class="t" style="font-weight:400">' + esc(it.q.q) + '</span></a>';
      }).join('') + '</div></div><div id="pShow"></div>' +
      '<div class="row"><button class="btn primary" data-act="again">Ещё подборка</button><button class="btn" data-act="close">К выбору темы</button></div>';
    act(el, {
      show: function (i) { FX.$('#pShow').innerHTML = '<div class="card">' + qHtml(ss.items[+i], true) + '</div>'; },
      again: function () { startPractice(ss.opts); },
      close: function () { FX.session = null; FX.render(); }
    });
  }

  // ---------- расчётные задачи ----------
  var tk = { id: null, g: null, res: null, val: '' };
  function parseNum(s) { return parseFloat(String(s).replace(/[\s ₽%]/g, '').replace(',', '.').replace(/[−–—]/g, '-')); }
  FX.views.tasks = function (el) {
    if (!tk.id) { tk.id = FX.tasks[0].id; }
    var task = FX.tasks.filter(function (t) { return t.id === tk.id; })[0];
    if (!tk.g) { tk.g = task.gen(); tk.res = null; tk.val = ''; }
    var g = tk.g;
    var list = FX.topics.map(function (t) {
      var ts = FX.tasks.filter(function (x) { return x.t === t.id; });
      if (!ts.length) return '';
      return '<div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-top:8px">' + SHORT[t.id] + '</div>' + ts.map(function (x) {
        var st = S.tasks[x.id];
        return '<button class="btn sm' + (x.id === tk.id ? ' primary' : ' ghost') + '" style="justify-content:space-between;width:100%" data-act="pick" data-arg="' + x.id + '"><span>' + x.title + '</span>' + (st && st[0] ? '<span class="num">✓ ' + st[0] + '</span>' : '') + '</button>';
      }).join('');
    }).join('');
    el.innerHTML = '<div class="head"><h1>Расчётные задачи</h1><p>Числа в условии каждый раз новые. Введите ответ — приложение проверит его и покажет решение по шагам.</p></div>' +
      '<div class="split" style="grid-template-columns:minmax(0,250px) minmax(0,1fr)"><div class="card" style="gap:4px">' + list + '</div>' +
      '<div class="card"><div class="row"><span class="pill acc">' + SHORT[task.t] + '</span><h2>' + task.title + '</h2></div><div class="qt" style="font-size:17px;line-height:1.5;max-width:70ch">' + esc(g.text) + '</div>' +
      '<form id="tForm" class="row"><label class="f">Ваш ответ' + (g.unit ? ', ' + g.unit : '') + '<input id="tAns" inputmode="decimal" autocomplete="off" value="' + esc(tk.val) + '"' + (tk.res ? ' disabled' : '') + '></label>' +
      '<div class="row" style="align-self:flex-end">' + (tk.res ? '' : '<button class="btn primary" type="submit">Проверить</button><button class="btn ghost" type="button" data-act="giveup">Показать решение</button>') +
      '<button class="btn" type="button" data-act="new">Новые числа</button></div></form>' +
      (tk.res ? '<div class="msg ' + (tk.res === 'ok' ? 'ok' : 'bad') + '">' + (tk.res === 'ok' ? 'Верно.' : tk.res === 'bad' ? 'Неверно. Правильный ответ: ' + f(g.answer, g.d) + (g.unit ? ' ' + g.unit : '') + '.' : 'Правильный ответ: ' + f(g.answer, g.d) + (g.unit ? ' ' + g.unit : '') + '.') + '</div><div class="expl"><b>Решение.</b> ' + g.sol + '</div>' : '') +
      '</div></div>';
    act(el, {
      pick: function (id) { tk.id = id; tk.g = null; FX.render(); },
      'new': function () { tk.g = null; FX.render(); },
      giveup: function () { tk.res = 'shown'; FX.render(); }
    });
    el.onsubmit = function (e) {
      e.preventDefault();
      var v = parseNum(FX.$('#tAns').value); tk.val = FX.$('#tAns').value;
      if (isNaN(v)) return;
      var tol = Math.max(0.6 * Math.pow(10, -g.d), Math.abs(g.answer) * 0.005);
      var ok = Math.abs(v - g.answer) <= tol;
      tk.res = ok ? 'ok' : 'bad';
      var st = S.tasks[task.id] || [0, 0]; st[ok ? 0 : 1]++; S.tasks[task.id] = st; FX.save();
      FX.render();
    };
    var inp = FX.$('#tAns'); if (inp && !tk.res) inp.focus();
  };

  // ---------- демоэкзамен ----------
  function buildExam() {
    var items = [];
    Object.keys(EXAM.mix).forEach(function (t) {
      var pool = FX.qByTopic(t).concat(FX.tasks.filter(function (x) { return x.t === t; }).map(FX.taskToQ));
      items = items.concat(FX.sample(pool, EXAM.mix[t]));
    });
    var now = Date.now();
    FX.exam = { items: FX.shuffle(items).map(makeItem), i: 0, start: now, end: now + EXAM.minutes * 60000, done: false, ask: false };
  }
  function finishExam() {
    var ex = FX.exam; if (!ex || ex.done) return;
    var by = {}, score = 0;
    ex.items.forEach(function (it) {
      it.done = true; it.ok = isRight(it);
      by[it.q.t] = by[it.q.t] || [0, 0]; by[it.q.t][1]++;
      if (it.ok) { score++; by[it.q.t][0]++; }
      if (it.sel.length && !it.q.gen) FX.recordAnswer(it.q, it.ok);
    });
    ex.done = true; ex.score = score; ex.by = by; ex.dur = Math.min(Date.now(), ex.end) - ex.start; ex.i = 0;
    S.exams.push({ d: Date.now(), score: score, total: ex.items.length, dur: ex.dur, by: by });
    if (S.exams.length > 50) S.exams.shift();
    FX.save();
  }
  function clock(ms) { ms = Math.max(0, ms); var s = Math.floor(ms / 1000); return (s / 60 < 10 ? '0' : '') + Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }
  function grid(ex) {
    return '<div class="qgrid">' + ex.items.map(function (it, i) {
      var c = ex.done ? (it.ok ? 'ok' : 'bad') : ((it.sel.length ? 'ans' : '') + (it.flag ? ' flag' : ''));
      return '<button type="button" class="' + c + (i === ex.i ? ' cur' : '') + '" data-act="jump" data-arg="' + i + '">' + (i + 1) + '</button>';
    }).join('') + '</div>';
  }
  FX.views.exam = function (el) {
    var ex = FX.exam;
    if (ex && !ex.done && Date.now() >= ex.end) finishExam();
    if (!ex) return examIntro(el);
    if (ex.done) return examResult(el, ex);
    var it = ex.items[ex.i], answered = ex.items.filter(function (x) { return x.sel.length; }).length;
    el.innerHTML = '<div class="sticky"><div class="row between"><div class="row"><span class="timer" id="exTimer">' + clock(ex.end - Date.now()) + '</span><span class="muted">Отвечено ' + answered + ' из ' + ex.items.length + '</span></div>' +
      (ex.ask ? '<div class="row"><span>' + (answered < ex.items.length ? 'Без ответа: ' + (ex.items.length - answered) + '. ' : '') + 'Завершить экзамен?</span><button class="btn sm primary" data-act="finYes">Завершить</button><button class="btn sm" data-act="finNo">Вернуться</button></div>'
        : '<button class="btn" data-act="fin">Завершить экзамен</button>') + '</div></div>' +
      '<div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,300px)"><div class="card"><h3 class="muted">Вопрос ' + (ex.i + 1) + ' из ' + ex.items.length + '</h3>' + qHtml(it, false) +
      '<div class="row between"><div class="row"><button class="btn" data-act="prev"' + (ex.i ? '' : ' disabled') + '>← Назад</button><button class="btn primary" data-act="next"' + (ex.i < ex.items.length - 1 ? '' : ' disabled') + '>Далее →</button></div>' +
      '<button class="btn ghost" data-act="flag">' + (it.flag ? 'Снять отметку' : 'Вернуться позже') + '</button></div></div>' +
      '<div class="card"><h3>Навигация</h3>' + grid(ex) + '<p class="muted" style="font-size:13px">Закрашены вопросы с ответом, подчёркнуты отмеченные.</p></div></div>';
    act(el, {
      opt: function (oi) { toggle(it, oi); FX.render(); },
      prev: function () { ex.i--; FX.render(); }, next: function () { ex.i++; FX.render(); },
      jump: function (i) { ex.i = +i; FX.render(); },
      flag: function () { it.flag = !it.flag; FX.render(); },
      fin: function () { ex.ask = true; FX.render(); }, finNo: function () { ex.ask = false; FX.render(); },
      finYes: function () { finishExam(); FX.render(); }
    });
    var iv = setInterval(function () {
      var left = ex.end - Date.now(), t = document.getElementById('exTimer');
      if (left <= 0) { clearInterval(iv); finishExam(); FX.render(); return; }
      if (t) { t.textContent = clock(left); t.classList.toggle('low', left < 5 * 60000); }
    }, 500);
    FX.cleanup = function () { clearInterval(iv); };
  };
  function examIntro(el) {
    var hist = S.exams.slice().reverse().slice(0, 10).map(function (e) {
      return '<tr><td>' + new Date(e.d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</td><td class="r">' + e.score + ' / ' + e.total + '</td><td class="r">' + clock(e.dur) + '</td><td><span class="pill ' + (e.score >= EXAM.pass ? 'ok">сдан' : 'bad">не сдан') + '</span></td></tr>';
    }).join('');
    el.innerHTML = '<div class="head"><h1>Демоэкзамен</h1><p>Пробная попытка в формате настоящего экзамена: те же количество вопросов, лимит времени и проходной балл.</p></div>' +
      '<div class="split"><div class="card"><h2>Правила</h2><div class="prose" style="font-size:15px"><ul>' +
      '<li>' + EXAM.total + ' вопросов из шести блоков программы, включая расчётные кейсы.</li><li>На всё — ' + EXAM.minutes + ' минут. По истечении времени попытка завершается автоматически.</li>' +
      '<li>Для сдачи нужно не менее ' + EXAM.pass + ' правильных ответов (70%).</li><li>В вопросах с несколькими верными ответами засчитывается только полностью правильный набор.</li>' +
      '<li>Правильные ответы и разбор показываются после завершения.</li></ul></div><div class="row"><button class="btn primary" data-act="start">Начать экзамен</button></div></div>' +
      '<div class="card"><h2>История попыток</h2>' + (hist ? '<div class="tw"><table class="t"><thead><tr><th>Дата</th><th class="r">Балл</th><th class="r">Время</th><th>Итог</th></tr></thead><tbody>' + hist + '</tbody></table></div>' : '<p class="muted">Здесь появятся ваши результаты: балл, время и итог каждой попытки.</p>') + '</div></div>';
    act(el, { start: function () { buildExam(); FX.render(); } });
  }
  function examResult(el, ex) {
    var pass = ex.score >= EXAM.pass, it = ex.items[ex.i];
    el.innerHTML = '<div class="head"><div class="crumb">Демоэкзамен / результат</div><div class="row"><h1>' + ex.score + ' из ' + ex.items.length + '</h1><span class="pill ' + (pass ? 'ok">Экзамен сдан' : 'bad">Экзамен не сдан') + '</span></div>' +
      '<p>' + (pass ? 'Порог в ' + EXAM.pass + ' баллов пройден.' : 'До проходного балла не хватило ' + (EXAM.pass - ex.score) + '.') + ' Затрачено времени: ' + clock(ex.dur) + '.</p></div>' +
      '<div class="split"><div class="card"><h2>По темам</h2><div class="tw"><table class="t"><thead><tr><th>Тема</th><th class="r">Верно</th><th class="r">Доля</th><th></th></tr></thead><tbody>' +
      FX.topics.map(function (t) { var b = ex.by[t.id] || [0, 0]; return '<tr><td style="white-space:normal">' + t.title + '</td><td class="r">' + b[0] + ' / ' + b[1] + '</td><td class="r">' + (b[1] ? FX.pct(b[0] / b[1], 0) : '—') + '</td><td style="min-width:90px">' + bar(b[1] ? b[0] / b[1] : 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="row"><button class="btn primary" data-act="again">Новая попытка</button><button class="btn" data-act="close">Закрыть</button></div></div>' +
      '<div class="card"><h2>Разбор ответов</h2>' + grid(ex) + '<p class="muted" style="font-size:13px">Нажмите на номер, чтобы посмотреть вопрос и объяснение.</p></div></div>' +
      '<div class="card"><h3 class="muted">Вопрос ' + (ex.i + 1) + '</h3>' + qHtml(it, true) + '</div>';
    act(el, {
      jump: function (i) { ex.i = +i; var top = FX.$('.main').scrollTop; FX.render(); FX.$('.main').scrollTop = top; },
      again: function () { buildExam(); FX.render(); },
      close: function () { FX.exam = null; FX.render(); }
    });
  }
})(window.FX);
