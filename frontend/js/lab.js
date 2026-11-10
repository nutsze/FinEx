// Лаборатория: конструктор опционных стратегий и калькулятор облигаций. Плюс общий построитель графиков.
(function (FX) {
  'use strict';
  var f = FX.fmt;
  FX.onTheme = function () { FX.render(); };

  // Линейный график на canvas. xs, ys — массивы; o: { h, zero, xFmt, yFmt, mark:{x,y}, vlines:[x] }
  FX.plot = function (cv, xs, ys, o) {
    o = o || {};
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = o.h || 250;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var pad = { l: 6, r: 70, t: 12, b: 24 };
    var x0 = xs[0], x1 = xs[xs.length - 1], y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (o.zero) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    if (y1 - y0 < 1e-9) { y1 += 1; y0 -= 1; }
    var mg = (y1 - y0) * 0.08; y0 -= mg; y1 += mg;
    var X = function (v) { return pad.l + (v - x0) / ((x1 - x0) || 1) * (w - pad.l - pad.r); };
    var Y = function (v) { return pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b); };
    var muted = FX.css('--muted'), line = FX.css('--line'), accent = FX.css('--accent'), fg = FX.css('--fg');
    var yFmt = o.yFmt || function (v) { return f(v, 2); }, xFmt = o.xFmt || function (v) { return f(v, 0); };
    c.font = '12px Consolas, "Cascadia Mono", monospace'; c.lineWidth = 1; c.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var v = y0 + (y1 - y0) * i / 4, y = Math.round(Y(v)) + 0.5;
      c.strokeStyle = line; c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke();
      c.fillStyle = muted; c.textAlign = 'left'; c.fillText(yFmt(v), w - pad.r + 6, y);
    }
    c.textBaseline = 'alphabetic';
    for (i = 0; i <= 4; i++) {
      var xv = x0 + (x1 - x0) * i / 4;
      c.fillStyle = muted; c.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'; c.fillText(xFmt(xv), X(xv), h - 6);
    }
    if (o.zero) { c.strokeStyle = muted; c.beginPath(); c.moveTo(pad.l, Math.round(Y(0)) + 0.5); c.lineTo(w - pad.r, Math.round(Y(0)) + 0.5); c.stroke(); }
    (o.vlines || []).forEach(function (vx) {
      c.strokeStyle = muted; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(vx), pad.t); c.lineTo(X(vx), h - pad.b); c.stroke(); c.setLineDash([]);
    });
    c.strokeStyle = o.color || accent; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
    xs.forEach(function (xv, k) { if (k) c.lineTo(X(xv), Y(ys[k])); else c.moveTo(X(xv), Y(ys[k])); });
    c.stroke();
    if (o.mark) {
      c.fillStyle = o.color || accent; c.beginPath(); c.arc(X(o.mark.x), Y(o.mark.y), 4, 0, 6.3); c.fill();
      c.fillStyle = fg; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 12px Consolas, "Cascadia Mono", monospace';
      if (o.mark.label) c.fillText(o.mark.label, Math.min(X(o.mark.x) + 8, w - pad.r + 6), Y(o.mark.y) - 10);
    }
  };

  // ---------- опционы ----------
  var PRESETS = [
    ['Купленный колл', [['call', 1, 100, 6]], 'Ставка на рост. Убыток ограничен премией, прибыль не ограничена.'],
    ['Купленный пут', [['put', 1, 100, 5]], 'Ставка на падение. Убыток ограничен премией.'],
    ['Проданный колл', [['call', -1, 100, 6]], 'Доход — только премия, а убыток при росте цены не ограничен.'],
    ['Защитный пут', [['stock', 1, 100, 0], ['put', 1, 95, 3]], 'Акция плюс купленный пут: страховка от падения ниже страйка.'],
    ['Покрытый колл', [['stock', 1, 100, 0], ['call', -1, 110, 3]], 'Акция плюс проданный колл: премия в обмен на отказ от роста выше страйка.'],
    ['Стрэддл', [['call', 1, 100, 6], ['put', 1, 100, 5]], 'Колл и пут с одним страйком: прибыль при сильном движении в любую сторону.'],
    ['Бычий колл-спрэд', [['call', 1, 100, 6], ['call', -1, 115, 2]], 'Купленный и проданный коллы: ограничены и убыток, и прибыль.']
  ];
  var op = { preset: 0, legs: null };
  function setPreset(i) { op.preset = i; op.legs = PRESETS[i][1].map(function (l) { return { type: l[0], side: l[1], k: l[2], p: l[3] }; }); }
  function payoff(S) {
    return op.legs.reduce(function (sum, l) {
      var v = l.type === 'call' ? Math.max(S - l.k, 0) - l.p : l.type === 'put' ? Math.max(l.k - S, 0) - l.p : S - l.k;
      return sum + l.side * v;
    }, 0);
  }
  function optStats() {
    var pts = [0].concat(op.legs.map(function (l) { return l.k; })), vals = pts.map(payoff);
    var slope = op.legs.reduce(function (s, l) { return s + (l.type === 'put' ? 0 : l.side); }, 0);
    var be = [], prev = payoff(0);
    for (var s = 0.5; s <= 400; s += 0.5) { var cur = payoff(s); if ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0) || (prev === 0 && cur !== 0 && s === 0.5)) be.push(cur === 0 ? s : s - 0.5 + 0.5 * Math.abs(prev) / (Math.abs(prev) + Math.abs(cur))); prev = cur; }
    return { max: slope > 0 ? Infinity : Math.max.apply(null, vals), min: slope < 0 ? -Infinity : Math.min.apply(null, vals), be: be };
  }
  function optView() {
    if (!op.legs) setPreset(0);
    var st = optStats();
    var legs = op.legs.map(function (l, i) {
      return '<tr><td><select data-leg="' + i + '" data-k="type" id="lt' + i + '"><option value="call"' + (l.type === 'call' ? ' selected' : '') + '>Колл</option><option value="put"' + (l.type === 'put' ? ' selected' : '') + '>Пут</option><option value="stock"' + (l.type === 'stock' ? ' selected' : '') + '>Акция</option></select></td>' +
        '<td><select data-leg="' + i + '" data-k="side" id="ls' + i + '"><option value="1"' + (l.side > 0 ? ' selected' : '') + '>Покупка</option><option value="-1"' + (l.side < 0 ? ' selected' : '') + '>Продажа</option></select></td>' +
        '<td><input type="number" style="width:90px" data-leg="' + i + '" data-k="k" id="lk' + i + '" value="' + l.k + '" min="1" max="300"></td>' +
        '<td>' + (l.type === 'stock' ? '<span class="muted">—</span>' : '<input type="number" style="width:80px" data-leg="' + i + '" data-k="p" id="lp' + i + '" value="' + l.p + '" min="0" max="100" step="0.5">') + '</td>' +
        '<td><button class="btn sm ghost" data-act="del" data-arg="' + i + '" aria-label="Удалить">✕</button></td></tr>';
    }).join('');
    return '<div class="card"><div class="tabs">' + PRESETS.map(function (p, i) { return '<button class="' + (i === op.preset ? 'on' : '') + '" data-act="preset" data-arg="' + i + '">' + p[0] + '</button>'; }).join('') + '</div>' +
      (op.preset >= 0 ? '<p class="muted">' + PRESETS[op.preset][2] + '</p>' : '') + '</div>' +
      '<div class="split"><div class="card"><h2>Финансовый результат на дату экспирации</h2><canvas id="optCv"></canvas><p class="muted" style="font-size:13px">По горизонтали — цена базового актива, по вертикали — прибыль или убыток на одну акцию, ₽. Пунктир — страйки.</p></div>' +
      '<div class="card"><h2>Позиция</h2><div class="tw"><table class="t"><thead><tr><th>Инструмент</th><th>Сторона</th><th>Страйк / цена</th><th>Премия</th><th></th></tr></thead><tbody>' + legs + '</tbody></table></div>' +
      '<div class="row"><button class="btn sm" data-act="add">+ Добавить опцион</button></div>' +
      '<div class="kv"><span>Максимальная прибыль</span><span class="v up">' + (st.max === Infinity ? 'не ограничена' : f(st.max, 2) + ' ₽') + '</span>' +
      '<span>Максимальный убыток</span><span class="v down">' + (st.min === -Infinity ? 'не ограничен' : f(Math.min(st.min, 0), 2) + ' ₽') + '</span>' +
      '<span>Точки безубыточности</span><span class="v">' + (st.be.length ? st.be.map(function (b) { return f(b, 2); }).join('; ') + ' ₽' : '—') + '</span></div></div></div>';
  }
  function optDraw() {
    var cv = FX.$('#optCv'); if (!cv) return;
    var xs = [], ys = [];
    for (var s = 50; s <= 150; s += 0.5) { xs.push(s); ys.push(payoff(s)); }
    FX.plot(cv, xs, ys, { zero: true, h: 280, vlines: op.legs.filter(function (l) { return l.type !== 'stock'; }).map(function (l) { return l.k; }), yFmt: function (v) { return FX.sign(v, 1); } });
  }

  // ---------- облигации ----------
  var bd = { c: 12, fr: 2, n: 5, y: 15 };
  function bondCalc(y) {
    var per = bd.n * bd.fr, cp = 1000 * bd.c / 100 / bd.fr, r = y / 100 / bd.fr, price = 0, w = 0;
    for (var t = 1; t <= per; t++) { var cf = cp + (t === per ? 1000 : 0), pv = cf / Math.pow(1 + r, t); price += pv; w += pv * t / bd.fr; }
    var D = w / price;
    return { price: price, D: D, MD: D / (1 + r), cur: 1000 * bd.c / 100 / price * 100 };
  }
  function bondView() {
    var b = bondCalc(bd.y), up = bondCalc(bd.y + 1);
    var inp = function (id, label, k, min, max, step) { return '<label class="f">' + label + '<input type="number" id="' + id + '" data-b="' + k + '" value="' + bd[k] + '" min="' + min + '" max="' + max + '" step="' + step + '" style="width:120px"></label>'; };
    return '<div class="split"><div class="card"><h2>Параметры облигации</h2><div class="row">' + inp('bC', 'Купон, % годовых', 'c', 0, 40, 0.5) + inp('bN', 'Срок, лет', 'n', 1, 30, 1) +
      '<label class="f">Выплат в год<select id="bF" data-b="fr">' + [1, 2, 4, 12].map(function (v) { return '<option' + (bd.fr === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
      inp('bY', 'Доходность к погашению, %', 'y', 0.5, 40, 0.25) + '</div>' +
      '<div class="kv"><span>Цена</span><span class="v">' + f(b.price, 2) + ' ₽ (' + f(b.price / 10, 2) + '% номинала)</span><span>Текущая доходность</span><span class="v">' + f(b.cur, 2) + '%</span>' +
      '<span>Дюрация Маколея</span><span class="v">' + f(b.D, 2) + ' года</span><span>Модифицированная дюрация</span><span class="v">' + f(b.MD, 2) + '</span>' +
      '<span>Если доходность вырастет на 1 п.п.</span><span class="v down">' + FX.sign((up.price / b.price - 1) * 100, 2) + '% (оценка по дюрации: −' + f(b.MD, 2) + '%)</span></div>' +
      '<div class="note">' + (b.price < 999.5 ? 'Доходность выше купона — облигация стоит дешевле номинала.' : b.price > 1000.5 ? 'Доходность ниже купона — облигация стоит дороже номинала.' : 'Доходность равна купону — цена равна номиналу.') + ' Разница между точным изменением цены и оценкой по дюрации — эффект выпуклости.</div></div>' +
      '<div class="card"><h2>Цена и доходность</h2><canvas id="bondCv"></canvas><p class="muted" style="font-size:13px">По горизонтали — доходность к погашению, %; по вертикали — цена, ₽. Точка — текущие параметры. Номинал 1 000 ₽.</p></div></div>';
  }
  function bondDraw() {
    var cv = FX.$('#bondCv'); if (!cv) return;
    var xs = [], ys = [];
    for (var y = 2; y <= 30; y += 0.25) { xs.push(y); ys.push(bondCalc(y).price); }
    var yy = Math.max(2, Math.min(30, bd.y));
    FX.plot(cv, xs, ys, { h: 300, mark: { x: yy, y: bondCalc(yy).price, label: f(bondCalc(yy).price, 0) + ' ₽' }, xFmt: function (v) { return f(v, 0) + '%'; }, yFmt: function (v) { return f(v, 0); } });
  }

  var tab = 'opt';
  FX.views.lab = function (el) {
    el.innerHTML = '<div class="head"><h1>Лаборатория</h1><p>Меняйте параметры и смотрите, как реагирует результат. Так формулы из теории запоминаются быстрее.</p>' +
      '<div class="tabs"><button class="' + (tab === 'opt' ? 'on' : '') + '" data-act="tab" data-arg="opt">Опционные стратегии</button><button class="' + (tab === 'bond' ? 'on' : '') + '" data-act="tab" data-arg="bond">Калькулятор облигаций</button></div></div>' +
      (tab === 'opt' ? optView() : bondView());
    FX.act(el, {
      tab: function (t) { tab = t; FX.render(); },
      preset: function (i) { setPreset(+i); FX.render(); },
      add: function () { if (op.legs.length < 6) { op.legs.push({ type: 'call', side: 1, k: 100, p: 5 }); op.preset = -1; FX.render(); } },
      del: function (i) { if (op.legs.length > 1) { op.legs.splice(+i, 1); op.preset = -1; FX.render(); } }
    });
    el.onchange = function (e) {
      var t = e.target;
      if (t.hasAttribute('data-leg')) {
        var l = op.legs[+t.getAttribute('data-leg')], k = t.getAttribute('data-k');
        if (k === 'type') { l.type = t.value; if (l.type === 'stock') l.p = 0; }
        else { var v = parseFloat(t.value); if (!isNaN(v)) l[k] = k === 'side' ? v : Math.max(k === 'k' ? 1 : 0, Math.min(300, v)); }
        op.preset = -1; FX.render();
      } else if (t.hasAttribute('data-b')) {
        var kk = t.getAttribute('data-b'), vv = parseFloat(t.value);
        if (!isNaN(vv)) { bd[kk] = Math.max(+t.min || 0, Math.min(+t.max || 1e9, vv)); if (kk === 'n' || kk === 'fr') bd[kk] = Math.round(bd[kk]); }
        FX.render();
      }
    };
    if (tab === 'opt') optDraw(); else bondDraw();
    var onR = function () { if (tab === 'opt') optDraw(); else bondDraw(); };
    window.addEventListener('resize', onR);
    FX.cleanup = function () { window.removeEventListener('resize', onR); };
  };
})(window.FX);
