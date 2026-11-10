// Лаборатория: опционные стратегии, модель Блэка — Шоулза, облигации (дюрация и выпуклость), метод Монте-Карло.
(function (FX) {
  'use strict';
  var f = FX.fmt;
  FX.onTheme = function () { FX.render(); };

  // Линейный график на canvas.
  // o: { h, zero, xFmt, yFmt, color, mark:{x,y,label}, vlines:[x], series:[{ys,color,width,dash,alpha}] }
  FX.plot = function (cv, xs, ys, o) {
    o = o || {};
    var dpr = (window.devicePixelRatio || 1) * (FX.zoom || 1), w = cv.clientWidth || 600, h = o.h || 250;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var pad = { l: 6, r: 78, t: 12, b: 24 }, extra = o.series || [];
    var x0 = xs[0], x1 = xs[xs.length - 1], y0 = Infinity, y1 = -Infinity;
    [ys].concat(extra.map(function (s) { return s.ys; })).forEach(function (a) { for (var k = 0; k < a.length; k++) { if (a[k] < y0) y0 = a[k]; if (a[k] > y1) y1 = a[k]; } });
    if (o.zero) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    if (y1 - y0 < 1e-9) { y1 += 1; y0 -= 1; }
    var mg = (y1 - y0) * 0.08; y0 -= mg; y1 += mg;
    var X = function (v) { return pad.l + (v - x0) / ((x1 - x0) || 1) * (w - pad.l - pad.r); };
    var Y = function (v) { return pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b); };
    var muted = FX.css('--muted'), line = FX.css('--line'), accent = FX.css('--accent'), fg = FX.css('--fg');
    var yFmt = o.yFmt || function (v) { return f(v, 2); }, xFmt = o.xFmt || function (v) { return f(v, 0); };
    var font = '12px Consolas, "Cascadia Mono", monospace';
    c.font = font; c.lineWidth = 1; c.textBaseline = 'middle';
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
    var path = function (arr, color, width, dash, alpha) {
      c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.globalAlpha = alpha == null ? 1 : alpha; c.setLineDash(dash || []);
      c.beginPath(); for (var k = 0; k < arr.length; k++) { if (k) c.lineTo(X(xs[k]), Y(arr[k])); else c.moveTo(X(xs[k]), Y(arr[k])); }
      c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    };
    extra.forEach(function (s) { path(s.ys, s.color || muted, s.width || 1, s.dash, s.alpha); });
    path(ys, o.color || accent, 2);
    if (o.mark) {
      c.fillStyle = o.color || accent; c.beginPath(); c.arc(X(o.mark.x), Y(o.mark.y), 4, 0, 6.3); c.fill();
      c.fillStyle = fg; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold ' + font;
      if (o.mark.label) c.fillText(o.mark.label, Math.min(X(o.mark.x) + 8, w - pad.r + 6), Y(o.mark.y) - 10);
    }
  };
  function numInput(id, label, attr, key, val, min, max, step, width) {
    return '<label class="f">' + label + '<input type="number" id="' + id + '" ' + attr + '="' + key + '" value="' + val + '" min="' + min + '" max="' + max + '" step="' + step + '" style="width:' + (width || 120) + 'px"></label>';
  }

  // ---------- опционные стратегии ----------
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
    for (var s = 0.5; s <= 400; s += 0.5) { var cur = payoff(s); if ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) be.push(cur === 0 ? s : s - 0.5 + 0.5 * Math.abs(prev) / (Math.abs(prev) + Math.abs(cur))); prev = cur; }
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
      '<div class="split"><div class="card"><h2>Финансовый результат на дату экспирации</h2><canvas id="labCv"></canvas><p class="muted" style="font-size:13px">По горизонтали — цена базового актива, по вертикали — прибыль или убыток на одну акцию, ₽. Пунктир — страйки.</p></div>' +
      '<div class="card"><h2>Позиция</h2><div class="tw"><table class="t"><thead><tr><th>Инструмент</th><th>Сторона</th><th>Страйк / цена</th><th>Премия</th><th></th></tr></thead><tbody>' + legs + '</tbody></table></div>' +
      '<div class="row"><button class="btn sm" data-act="add">+ Добавить опцион</button></div>' +
      '<div class="kv"><span>Максимальная прибыль</span><span class="v up">' + (st.max === Infinity ? 'не ограничена' : f(st.max, 2) + ' ₽') + '</span>' +
      '<span>Максимальный убыток</span><span class="v down">' + (st.min === -Infinity ? 'не ограничен' : f(Math.min(st.min, 0), 2) + ' ₽') + '</span>' +
      '<span>Точки безубыточности</span><span class="v">' + (st.be.length ? st.be.map(function (b) { return f(b, 2); }).join('; ') + ' ₽' : '—') + '</span></div></div></div>';
  }
  function optDraw(cv) {
    var xs = [], ys = [];
    for (var s = 50; s <= 150; s += 0.5) { xs.push(s); ys.push(payoff(s)); }
    FX.plot(cv, xs, ys, { zero: true, h: 280, vlines: op.legs.filter(function (l) { return l.type !== 'stock'; }).map(function (l) { return l.k; }), yFmt: function (v) { return FX.sign(v, 1); } });
  }

  // ---------- модель Блэка — Шоулза ----------
  var bs = { S: 100, K: 100, v: 30, r: 15, T: 90, type: 'call' };
  function cdf(x) { // функция стандартного нормального распределения
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  function pdf(x) { return 0.3989422804 * Math.exp(-x * x / 2); }
  function bsCalc(S, K, vol, r, T) {
    var sq = vol * Math.sqrt(T), d1 = (Math.log(S / K) + (r + vol * vol / 2) * T) / sq, d2 = d1 - sq, disc = K * Math.exp(-r * T);
    return { d1: d1, d2: d2, call: S * cdf(d1) - disc * cdf(d2), put: disc * cdf(-d2) - S * cdf(-d1),
      dc: cdf(d1), dp: cdf(d1) - 1, gamma: pdf(d1) / (S * sq), vega: S * pdf(d1) * Math.sqrt(T) / 100,
      tc: (-S * pdf(d1) * vol / (2 * Math.sqrt(T)) - r * disc * cdf(d2)) / 365, tp: (-S * pdf(d1) * vol / (2 * Math.sqrt(T)) + r * disc * cdf(-d2)) / 365 };
  }
  FX.bs = bsCalc;
  function bsView() {
    var b = bsCalc(bs.S, bs.K, bs.v / 100, bs.r / 100, bs.T / 365), call = bs.type === 'call';
    var price = call ? b.call : b.put, intr = call ? Math.max(bs.S - bs.K, 0) : Math.max(bs.K - bs.S, 0);
    return '<div class="split"><div class="card"><h2>Параметры</h2><div class="row">' +
      '<label class="f">Опцион<select id="bsType" data-bs="type"><option value="call"' + (call ? ' selected' : '') + '>Колл</option><option value="put"' + (call ? '' : ' selected') + '>Пут</option></select></label>' +
      numInput('bsS', 'Цена актива S, ₽', 'data-bs', 'S', bs.S, 1, 100000, 1, 110) + numInput('bsK', 'Страйк K, ₽', 'data-bs', 'K', bs.K, 1, 100000, 1, 110) +
      numInput('bsV', 'Волатильность σ, %', 'data-bs', 'v', bs.v, 1, 300, 1, 110) + numInput('bsR', 'Безрисковая ставка, %', 'data-bs', 'r', bs.r, 0, 100, 0.5, 110) +
      numInput('bsT', 'Дней до экспирации', 'data-bs', 'T', bs.T, 1, 1825, 1, 110) + '</div>' +
      '<div class="kv"><span>Премия колла</span><span class="v">' + f(b.call, 2) + ' ₽</span><span>Премия пута</span><span class="v">' + f(b.put, 2) + ' ₽</span>' +
      '<span>Внутренняя / временная стоимость (' + (call ? 'колл' : 'пут') + ')</span><span class="v">' + f(intr, 2) + ' / ' + f(Math.max(price - intr, 0), 2) + ' ₽</span>' +
      '<span>d₁ / d₂</span><span class="v">' + f(b.d1, 3) + ' / ' + f(b.d2, 3) + '</span>' +
      '<span>Дельта (колл / пут)</span><span class="v">' + f(b.dc, 3) + ' / ' + f(b.dp, 3) + '</span><span>Гамма</span><span class="v">' + f(b.gamma, 4) + '</span>' +
      '<span>Вега, ₽ на 1 п.п. волатильности</span><span class="v">' + f(b.vega, 3) + '</span><span>Тета, ₽ в день (колл / пут)</span><span class="v">' + f(b.tc, 3) + ' / ' + f(b.tp, 3) + '</span></div>' +
      '<div class="formula">C = S·N(d₁) − K·e^(−rT)·N(d₂)\nP = K·e^(−rT)·N(−d₂) − S·N(−d₁)\nd₁ = [ln(S/K) + (r + σ²/2)·T] / (σ·√T)\nd₂ = d₁ − σ·√T</div>' +
      '<div class="note">Паритет пут-колл: C − P = S − K·e^(−rT). Сейчас: ' + f(b.call - b.put, 2) + ' = ' + f(bs.S - bs.K * Math.exp(-bs.r / 100 * bs.T / 365), 2) + '. Увеличьте волатильность или срок — подорожают и колл, и пут.</div></div>' +
      '<div class="card"><h2>Премия ' + (call ? 'колла' : 'пута') + ' и цена актива</h2><canvas id="labCv"></canvas><p class="muted" style="font-size:13px">Сплошная линия — премия по модели, пунктир — внутренняя стоимость (выплата при немедленном исполнении). Расстояние между ними — временная стоимость. Точка — текущая цена актива.</p></div></div>';
  }
  function bsDraw(cv) {
    var xs = [], ys = [], intr = [], call = bs.type === 'call', lo = bs.K * 0.5, hi = bs.K * 1.5;
    for (var k = 0; k <= 120; k++) {
      var S = lo + (hi - lo) * k / 120, b = bsCalc(S, bs.K, bs.v / 100, bs.r / 100, bs.T / 365);
      xs.push(S); ys.push(call ? b.call : b.put); intr.push(call ? Math.max(S - bs.K, 0) : Math.max(bs.K - S, 0));
    }
    var sc = Math.max(lo, Math.min(hi, bs.S)), cur = bsCalc(sc, bs.K, bs.v / 100, bs.r / 100, bs.T / 365);
    FX.plot(cv, xs, ys, { h: 320, zero: true, vlines: [bs.K], series: [{ ys: intr, dash: [5, 4], width: 1.5 }], mark: { x: sc, y: call ? cur.call : cur.put, label: f(call ? cur.call : cur.put, 2) + ' ₽' } });
  }

  // ---------- облигации: цена, дюрация, выпуклость ----------
  var bd = { c: 12, fr: 2, n: 5, y: 15 };
  function bondCalc(y) {
    var per = bd.n * bd.fr, cp = 1000 * bd.c / 100 / bd.fr, r = y / 100 / bd.fr, price = 0, w = 0, cx = 0;
    for (var t = 1; t <= per; t++) { var cf = cp + (t === per ? 1000 : 0), pv = cf / Math.pow(1 + r, t); price += pv; w += pv * t / bd.fr; cx += pv * t * (t + 1); }
    var D = w / price;
    return { price: price, D: D, MD: D / (1 + r), C: cx / price / Math.pow(1 + r, 2) / (bd.fr * bd.fr), cur: 1000 * bd.c / 100 / price * 100 };
  }
  function bondView() {
    var b = bondCalc(bd.y), up = bondCalc(bd.y + 2), dn = bondCalc(bd.y - 2);
    var est1 = -b.MD * 2, est2 = est1 + 0.5 * b.C * 0.02 * 0.02 * 100, real = (up.price / b.price - 1) * 100, realDn = (dn.price / b.price - 1) * 100;
    return '<div class="split"><div class="card"><h2>Параметры облигации</h2><div class="row">' + numInput('bC', 'Купон, % годовых', 'data-b', 'c', bd.c, 0, 40, 0.5) + numInput('bN', 'Срок, лет', 'data-b', 'n', bd.n, 1, 30, 1) +
      '<label class="f">Выплат в год<select id="bF" data-b="fr">' + [1, 2, 4, 12].map(function (v) { return '<option' + (bd.fr === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
      numInput('bY', 'Доходность к погашению, %', 'data-b', 'y', bd.y, 2.5, 40, 0.25) + '</div>' +
      '<div class="kv"><span>Цена</span><span class="v">' + f(b.price, 2) + ' ₽ (' + f(b.price / 10, 2) + '% номинала)</span><span>Текущая доходность</span><span class="v">' + f(b.cur, 2) + '%</span>' +
      '<span>Дюрация Маколея</span><span class="v">' + f(b.D, 2) + ' года</span><span>Модифицированная дюрация</span><span class="v">' + f(b.MD, 2) + '</span>' +
      '<span>Выпуклость</span><span class="v">' + f(b.C, 2) + '</span></div>' +
      '<h3>Доходность выросла на 2 п.п.: что с ценой</h3><div class="kv">' +
      '<span>Оценка только по дюрации: −MD × Δy</span><span class="v down">' + FX.sign(est1, 2) + '%</span>' +
      '<span>С поправкой на выпуклость: + ½ × C × Δy²</span><span class="v down">' + FX.sign(est2, 2) + '%</span>' +
      '<span>Точный пересчёт цены</span><span class="v down">' + FX.sign(real, 2) + '%</span>' +
      '<span>Для сравнения: доходность упала на 2 п.п.</span><span class="v up">' + FX.sign(realDn, 2) + '%</span></div>' +
      '<div class="note">Выпуклость положительна: при росте ставок цена падает меньше, чем обещает дюрация, а при снижении — растёт больше (' + FX.sign(realDn, 2) + '% против ' + FX.sign(real, 2) + '%). Чем длиннее срок и ниже купон, тем выпуклость выше.</div></div>' +
      '<div class="card"><h2>Цена и доходность</h2><canvas id="labCv"></canvas><p class="muted" style="font-size:13px">Сплошная кривая — точная цена, пунктир — прямая, которую даёт оценка по дюрации. Кривая лежит выше прямой: это и есть выпуклость. Номинал 1 000 ₽.</p></div></div>';
  }
  function bondDraw(cv) {
    var xs = [], ys = [], lin = [], b0 = bondCalc(bd.y);
    for (var y = 2; y <= 30; y += 0.25) { xs.push(y); ys.push(bondCalc(y).price); lin.push(Math.max(b0.price * (1 - b0.MD * (y - bd.y) / 100), 0)); }
    var yy = Math.max(2, Math.min(30, bd.y));
    FX.plot(cv, xs, ys, { h: 340, series: [{ ys: lin, dash: [5, 4], width: 1.5 }], mark: { x: yy, y: bondCalc(yy).price, label: f(bondCalc(yy).price, 0) + ' ₽' }, xFmt: function (v) { return f(v, 0) + '%'; }, yFmt: function (v) { return f(v, 0); } });
  }

  // ---------- метод Монте-Карло ----------
  var mc = { v0: 1000000, mu: 15, vol: 25, days: 252, n: 1000, res: null };
  function mcRun() {
    var steps = Math.min(mc.days, 126), dt = mc.days / 252 / steps, mu = mc.mu / 100, vol = mc.vol / 100, n = mc.n;
    var drift = (mu - vol * vol / 2) * dt, sd = vol * Math.sqrt(dt), cols = [], paths = [], k, i;
    for (k = 0; k <= steps; k++) cols.push(new Float64Array(n));
    for (i = 0; i < n; i++) {
      var v = mc.v0; cols[0][i] = v;
      for (k = 1; k <= steps; k++) { v *= Math.exp(drift + sd * FX.gauss()); cols[k][i] = v; }
    }
    for (i = 0; i < Math.min(40, n); i++) { var p = []; for (k = 0; k <= steps; k++) p.push(cols[k][i]); paths.push(p); }
    var q = function (sorted, x) { return sorted[Math.min(sorted.length - 1, Math.floor(x * sorted.length))]; };
    var p5 = [], p50 = [], p95 = [], xs = [];
    for (k = 0; k <= steps; k++) { var s = Array.prototype.slice.call(cols[k]).sort(function (a, b) { return a - b; }); p5.push(q(s, 0.05)); p50.push(q(s, 0.5)); p95.push(q(s, 0.95)); xs.push(k * mc.days / steps); }
    var fin = Array.prototype.slice.call(cols[steps]).sort(function (a, b) { return a - b; }), sum = 0, loss = 0, tail = 0, nt = Math.max(1, Math.floor(n * 0.05));
    fin.forEach(function (x, j) { sum += x; if (x < mc.v0) loss++; if (j < nt) tail += x; });
    var T = mc.days / 252;
    return { xs: xs, p5: p5, p50: p50, p95: p95, paths: paths, mean: sum / n, med: q(fin, 0.5), q5: q(fin, 0.05), q95: q(fin, 0.95), min: fin[0], max: fin[n - 1], pLoss: loss / n, es: mc.v0 - tail / nt,
      param: mc.v0 * (1 - Math.exp((mu - vol * vol / 2) * T - 1.645 * vol * Math.sqrt(T))) };
  }
  function mcView() {
    if (!mc.res) mc.res = mcRun();
    var r = mc.res, varMc = mc.v0 - r.q5;
    return '<div class="split"><div class="card"><h2>Параметры модели</h2><div class="row">' +
      numInput('mcV', 'Стоимость портфеля, ₽', 'data-mc', 'v0', mc.v0, 10000, 1000000000, 10000, 150) + numInput('mcMu', 'Ожидаемая доходность, % год.', 'data-mc', 'mu', mc.mu, -50, 100, 1, 110) +
      numInput('mcVol', 'Волатильность, % год.', 'data-mc', 'vol', mc.vol, 1, 150, 1, 110) + numInput('mcD', 'Горизонт, торговых дней', 'data-mc', 'days', mc.days, 1, 2520, 1, 110) +
      '<label class="f">Сценариев<select id="mcN" data-mc="n">' + [100, 500, 1000, 5000, 20000].map(function (v) { return '<option value="' + v + '"' + (mc.n === v ? ' selected' : '') + '>' + f(v, 0) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" style="align-self:flex-end" data-act="mcRun">Новые сценарии</button></div>' +
      '<div class="kv"><span>Медианный результат</span><span class="v">' + FX.money(r.med) + '</span><span>Средний результат</span><span class="v">' + FX.money(r.mean) + '</span>' +
      '<span>5-й / 95-й перцентиль</span><span class="v">' + FX.money(r.q5) + ' / ' + FX.money(r.q95) + '</span>' +
      '<span>Худший / лучший сценарий</span><span class="v">' + FX.money(r.min) + ' / ' + FX.money(r.max) + '</span>' +
      '<span>Вероятность убытка</span><span class="v">' + FX.pct(r.pLoss, 1) + '</span>' +
      '<span>VaR 95% по сценариям</span><span class="v down">' + (varMc > 0 ? FX.money(varMc) : 'убытка нет') + '</span>' +
      '<span>VaR 95% по формуле (логнормальная модель)</span><span class="v">' + (r.param > 0 ? FX.money(r.param) : 'убытка нет') + '</span>' +
      '<span>Ожидаемые потери в худших 5% (ES)</span><span class="v down">' + (r.es > 0 ? FX.money(r.es) : 'убытка нет') + '</span></div>' +
      '<div class="note">Нажмите «Новые сценарии» несколько раз. При 100 сценариях VaR заметно «прыгает», при 20 000 почти не меняется: ошибка метода убывает как 1/√N. Результат так же сильно зависит от заложенных доходности и волатильности — модель не знает будущего.</div></div>' +
      '<div class="card"><h2>Траектории стоимости портфеля</h2><canvas id="labCv"></canvas><p class="muted" style="font-size:13px">Тонкие линии — 40 случайных сценариев. Жирная — медиана, пунктир — 5-й и 95-й перцентили: в этот коридор попадает 90% исходов. По горизонтали — торговые дни.</p></div></div>';
  }
  function mcDraw(cv) {
    var r = mc.res, muted = FX.css('--muted');
    var series = r.paths.map(function (p) { return { ys: p, color: muted, width: 1, alpha: 0.28 }; });
    series.push({ ys: r.p5, color: FX.css('--down'), width: 1.5, dash: [5, 4] }, { ys: r.p95, color: FX.css('--up'), width: 1.5, dash: [5, 4] });
    FX.plot(cv, r.xs, r.p50, { h: 380, series: series, yFmt: function (v) { return f(v / 1000, 0) + ' т.₽'; }, xFmt: function (v) { return 'д.' + Math.round(v); } });
  }

  var TABS = [['opt', 'Опционные стратегии', optView, optDraw], ['bs', 'Блэк — Шоулз', bsView, bsDraw], ['bond', 'Облигации: дюрация и выпуклость', bondView, bondDraw], ['mc', 'Монте-Карло', mcView, mcDraw]];
  var tab = 'opt';
  function clampTo(t, v) { return Math.max(t.min === '' ? -1e12 : +t.min, Math.min(t.max === '' ? 1e12 : +t.max, v)); }
  FX.views.lab = function (el) {
    var cur = TABS.filter(function (t) { return t[0] === tab; })[0];
    el.className = 'page wide';
    el.innerHTML = '<div class="head"><h1>Лаборатория</h1><p>Меняйте параметры и смотрите, как реагирует результат. Так формулы из теории запоминаются быстрее.</p>' +
      '<div class="tabs">' + TABS.map(function (t) { return '<button class="' + (t[0] === tab ? 'on' : '') + '" data-act="tab" data-arg="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' + cur[2]();
    FX.act(el, {
      tab: function (t) { tab = t; FX.render(); },
      preset: function (i) { setPreset(+i); FX.render(); },
      add: function () { if (op.legs.length < 6) { op.legs.push({ type: 'call', side: 1, k: 100, p: 5 }); op.preset = -1; FX.render(); } },
      del: function (i) { if (op.legs.length > 1) { op.legs.splice(+i, 1); op.preset = -1; FX.render(); } },
      mcRun: function () { mc.res = null; FX.render(); }
    });
    el.onchange = function (e) {
      var t = e.target, v = parseFloat(t.value);
      if (t.hasAttribute('data-leg')) {
        var l = op.legs[+t.getAttribute('data-leg')], k = t.getAttribute('data-k');
        if (k === 'type') { l.type = t.value; if (l.type === 'stock') l.p = 0; }
        else if (!isNaN(v)) l[k] = k === 'side' ? v : Math.max(k === 'k' ? 1 : 0, Math.min(300, v));
        op.preset = -1;
      } else if (t.hasAttribute('data-b')) {
        var kb = t.getAttribute('data-b');
        if (!isNaN(v)) { bd[kb] = t.tagName === 'SELECT' ? v : clampTo(t, v); if (kb === 'n' || kb === 'fr') bd[kb] = Math.round(bd[kb]); }
      } else if (t.hasAttribute('data-bs')) {
        var ks = t.getAttribute('data-bs');
        if (ks === 'type') bs.type = t.value; else if (!isNaN(v)) bs[ks] = clampTo(t, v);
      } else if (t.hasAttribute('data-mc')) {
        var km = t.getAttribute('data-mc');
        if (!isNaN(v)) { mc[km] = t.tagName === 'SELECT' ? v : clampTo(t, v); if (km === 'days') mc.days = Math.round(mc.days); mc.res = null; }
      } else return;
      FX.render();
    };
    var draw = function () { var cv = FX.$('#labCv'); if (cv) cur[3](cv); };
    draw();
    window.addEventListener('resize', draw);
    FX.cleanup = function () { window.removeEventListener('resize', draw); };
  };
})(window.FX);
