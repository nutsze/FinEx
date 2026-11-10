// Торговый тренажёр: вымышленные бумаги, один шаг = один торговый день.
(function (FX) {
  'use strict';
  var S = FX.state, f = FX.fmt, R = FX.round, g = FX.gauss;
  var START = 1000000, FEE = 0.0005, FUT_FEE = 2, CARRY = 0.15, LOAN = 0.20, BORROW = 0.13, HIST = 250;
  var INS = [
    { id: 'SVNF', name: 'Севернефть', type: 'stock', lot: 10, p0: 420, vol: 0.28, beta: 1.0, rate: 0.30 },
    { id: 'TXNK', name: 'ТехноКод', type: 'stock', lot: 1, p0: 3150, vol: 0.42, beta: 1.4, rate: 0.40 },
    { id: 'RBNK', name: 'Русбанк Капитал', type: 'stock', lot: 10, p0: 268, vol: 0.26, beta: 1.1, rate: 0.30 },
    { id: 'MTLK', name: 'Металлкомбинат', type: 'stock', lot: 1, p0: 1480, vol: 0.35, beta: 1.2, rate: 0.35 },
    { id: 'ENSE', name: 'ЭнергоСеть', type: 'stock', lot: 100, p0: 58.4, vol: 0.20, beta: 0.6, rate: 0.25 },
    { id: 'GOV29', name: 'Гособлигация 29', type: 'bond', lot: 1, nominal: 1000, coupon: 0.12, freq: 2, p0: 93.4, dur: 4.2, rate: 0.12, credit: 0 },
    { id: 'TXB1', name: 'ТехноКод БО-01', type: 'bond', lot: 1, nominal: 1000, coupon: 0.176, freq: 4, p0: 99.6, dur: 1.8, rate: 0.25, credit: 0.002 },
    { id: 'FNXF', name: 'Фьючерс на FNX', type: 'fut', lot: 1, base: 'FNX', k: 1, mult: 10, rate: 0.12, dec: 0 },
    { id: 'SVNFF', name: 'Фьючерс на Севернефть', type: 'fut', lot: 1, base: 'SVNF', k: 100, mult: 1, rate: 0.18, dec: 0 }
  ];
  var TYPE = { stock: 'Акция', bond: 'Облигация', fut: 'Фьючерс' };
  function ins(id) { return INS.filter(function (i) { return i.id === id; })[0]; }
  function nkd(s, i) { return i.nominal * i.coupon * s.acc[i.id] / 365; }
  function futPx(s, i) { return R(s.px[i.base] * i.k * (1 + CARRY * s.fd[i.id] / 365), 0); }
  function log(s, text, kind) { s.log.unshift({ d: s.day, t: text, k: kind || '' }); if (s.log.length > 60) s.log.pop(); }

  function newSim() {
    var s = { day: 0, cash: START, px: { FNX: 3000 }, hist: { FNX: [3000] }, pos: {}, acc: {}, fd: {}, log: [], flags: {}, calls: 0 };
    INS.forEach(function (i) {
      if (i.type === 'bond') s.acc[i.id] = FX.ri(5, 60);
      if (i.type === 'fut') s.fd[i.id] = 75;
      if (i.type !== 'fut') { s.px[i.id] = i.p0; s.hist[i.id] = [i.p0]; }
    });
    INS.forEach(function (i) { if (i.type === 'fut') { s.px[i.id] = futPx(s, i); s.hist[i.id] = [s.px[i.id]]; } });
    for (var k = 0; k < 120; k++) step(s, true);
    s.day = 1; s.log = [];
    log(s, 'Счёт открыт: ' + FX.money(START) + '. Выберите инструмент и совершите первую сделку.');
    return s;
  }

  // ---------- оценка портфеля и маржа ----------
  function calc(s) {
    var c = { equity: s.cash, stocks: 0, bonds: 0, im: 0, gross: 0, futN: {}, rows: [] };
    Object.keys(s.pos).forEach(function (id) {
      var p = s.pos[id], i = ins(id), val = 0, expo, pnl;
      if (i.type === 'stock') { val = p.q * s.px[id]; expo = val; c.stocks += val; pnl = (s.px[id] - p.avg) * p.q; }
      else if (i.type === 'bond') { val = p.q * (s.px[id] / 100 * i.nominal + nkd(s, i)); expo = val; c.bonds += val; pnl = (s.px[id] - p.avg) / 100 * i.nominal * p.q; }
      else { expo = p.q * s.px[id] * i.mult; c.futN[id] = expo; pnl = p.vm; }
      c.equity += val; c.im += Math.abs(expo) * i.rate; c.gross += Math.abs(expo);
      c.rows.push({ i: i, p: p, val: val, expo: expo, pnl: pnl });
    });
    c.mm = c.im / 2; c.npr1 = c.equity - c.im; c.npr2 = c.equity - c.mm;
    return c;
  }

  // Исполнение сделки без проверок. qty со знаком (штуки/контракты).
  function apply(s, id, qty) {
    var i = ins(id), px = s.px[id], p = s.pos[id] || { q: 0, avg: 0, vm: 0 }, sum;
    if (i.type === 'fut') { sum = 0; s.cash -= Math.abs(qty) * FUT_FEE; }
    else {
      var unit = i.type === 'bond' ? px / 100 * i.nominal + nkd(s, i) : px;
      sum = qty * unit; s.cash -= sum + Math.abs(sum) * FEE;
    }
    var nq = p.q + qty;
    if (p.q === 0 || (p.q > 0) === (qty > 0)) p.avg = (p.avg * Math.abs(p.q) + px * Math.abs(qty)) / (Math.abs(p.q) + Math.abs(qty));
    else if (nq !== 0 && (nq > 0) !== (p.q > 0)) { p.avg = px; p.vm = 0; }
    p.q = nq;
    if (nq === 0) delete s.pos[id]; else s.pos[id] = p;
    return sum;
  }
  function trade(s, id, lots, side) {
    var i = ins(id), qty = lots * i.lot * side, cur = s.pos[id] ? s.pos[id].q : 0;
    if (!(lots > 0) || lots !== Math.floor(lots)) return { ok: false, msg: 'Укажите целое число лотов.' };
    if (i.type === 'bond' && cur + qty < 0) return { ok: false, msg: 'Короткая продажа облигаций в тренажёре недоступна.' };
    var before = calc(s), test = JSON.parse(JSON.stringify({ cash: s.cash, pos: s.pos }));
    var t2 = { cash: test.cash, pos: test.pos, px: s.px, acc: s.acc, fd: s.fd };
    apply(t2, id, qty);
    var after = calc(t2);
    if (after.npr1 < 0 && after.im > before.im + 0.01) return { ok: false, msg: 'Недостаточно обеспечения: после сделки НПР1 составил бы ' + FX.money(after.npr1) + '. Уменьшите объём.' };
    var sum = apply(s, id, qty);
    var txt = (side > 0 ? 'Покупка ' : 'Продажа ') + id + ': ' + f(Math.abs(qty), 0) + ' шт. по ' + priceText(i, s.px[id]) + (i.type === 'fut' ? '' : ', сумма ' + FX.money(Math.abs(sum)));
    if (i.type === 'bond') txt += ' (в т. ч. НКД ' + FX.money(nkd(s, i) * Math.abs(qty), 2) + ')';
    log(s, txt, side > 0 ? 'buy' : 'sell');
    return { ok: true, msg: txt + '.' };
  }

  // ---------- шаг времени ----------
  function step(s, warm) {
    var m = 0.0004 + 0.011 * g(), dy = 0.0006 * g(), shock = {}, divs = null;
    if (!warm && Math.random() < 0.06) {
      var st = FX.pick(INS.filter(function (i) { return i.type === 'stock'; })), e = FX.ri(1, 6);
      if (e === 1) { dy += 0.006; m -= 0.02; log(s, 'Центральный банк неожиданно повысил ключевую ставку: облигации с фиксированным купоном и акции дешевеют.', 'ev'); }
      else if (e === 2) { dy -= 0.006; m += 0.015; log(s, 'Центральный банк снизил ключевую ставку: облигации и акции дорожают.', 'ev'); }
      else if (e === 3) { shock[st.id] = FX.ri(4, 9) / 100; log(s, st.name + ': отчётность лучше ожиданий.', 'ev'); }
      else if (e === 4) { shock[st.id] = -FX.ri(4, 9) / 100; log(s, st.name + ': отчётность хуже ожиданий.', 'ev'); }
      else if (e === 5) { divs = st; }
      else { shock.TXB1 = -0.025; shock.TXNK = -0.03; log(s, 'Рейтинговое агентство ухудшило прогноз по рейтингу ТехноКода: кредитный спред его облигаций вырос.', 'ev'); }
    }
    s.px.FNX = R(s.px.FNX * (1 + m), 2);
    INS.forEach(function (i) {
      var id = i.id, old = s.px[id];
      if (i.type === 'stock') {
        var idio = Math.sqrt(Math.max(i.vol * i.vol / 252 - i.beta * i.beta * 0.011 * 0.011, 0.00002));
        s.px[id] = R(Math.max(old * (1 + i.vol * i.vol / 504 + i.beta * m + idio * g() + (shock[id] || 0)), 0.01), 2);
      } else if (i.type === 'bond') {
        var np = old * (1 - i.dur * dy + i.credit * g() + (shock[id] || 0));
        s.px[id] = R(np + (100 - np) * 0.0008, 2);
        s.acc[id]++;
        if (s.acc[id] >= Math.round(365 / i.freq)) {
          var p = s.pos[id], cp = i.nominal * i.coupon / i.freq;
          if (p) { s.cash += p.q * cp; s.flags.coupon = 1; log(s, 'Купон по ' + id + ': ' + FX.money(cp, 2) + ' × ' + p.q + ' шт. = ' + FX.money(p.q * cp) + '.', 'buy'); }
          s.acc[id] = 0;
        }
      }
    });
    if (divs) {
      var d = R(s.px[divs.id] * FX.ri(3, 6) / 100, 2), dp = s.pos[divs.id];
      s.px[divs.id] = R(s.px[divs.id] - d, 2);
      var t = divs.name + ': дивидендная отсечка, ' + FX.money(d, 2) + ' на акцию. Цена снизилась на величину дивиденда (дивидендный гэп).';
      if (dp) { s.cash += dp.q * d; t += dp.q > 0 ? ' Вам начислено ' + FX.money(dp.q * d) + '.' : ' С короткой позиции списано ' + FX.money(-dp.q * d) + '.'; }
      log(s, t, 'ev');
    }
    INS.forEach(function (i) {
      if (i.type !== 'fut') return;
      var id = i.id, old = s.px[id], p = s.pos[id];
      s.fd[id]--;
      s.px[id] = futPx(s, i);
      if (p) { var vm = p.q * (s.px[id] - old) * i.mult; s.cash += vm; p.vm += vm; }
      if (s.fd[id] <= 0) {
        if (p) { log(s, 'Экспирация ' + id + ': позиция закрыта по расчётной цене. Накопленная вариационная маржа ' + FX.money(p.vm) + '.', 'ev'); delete s.pos[id]; }
        s.fd[id] = 90; s.px[id] = futPx(s, i);
      }
    });
    if (s.cash < 0) s.cash *= 1 + LOAN / 365;
    Object.keys(s.pos).forEach(function (id) { var p = s.pos[id], i = ins(id); if (i.type === 'stock' && p.q < 0) s.cash += p.q * s.px[id] * BORROW / 365; });
    Object.keys(s.px).forEach(function (id) { var h = s.hist[id]; h.push(s.px[id]); if (h.length > HIST) h.shift(); });
    s.day++;
    if (!warm) marginCall(s);
  }
  function marginCall(s) {
    var c = calc(s); if (c.npr2 >= 0 || !c.rows.length) return;
    var closed = [];
    for (var n = 0; n < 20 && c.npr1 < 0 && c.rows.length; n++) {
      var worst = c.rows.sort(function (a, b) { return Math.abs(b.expo) * b.i.rate - Math.abs(a.expo) * a.i.rate; })[0];
      apply(s, worst.i.id, -worst.p.q); closed.push(worst.i.id); c = calc(s);
    }
    s.calls++; s.flags.mc = 1;
    log(s, 'Маржин-колл: стоимость портфеля опустилась ниже минимальной маржи (НПР2 < 0). Брокер принудительно закрыл позиции: ' + closed.join(', ') + '.', 'bad');
  }

  // ---------- миссии ----------
  var MISSIONS = [
    { id: 'm1', t: 'Первая сделка', g: 'Купите хотя бы один лот любой акции.', why: 'Рыночная заявка исполняется сразу по текущей цене; с суммы сделки списывается комиссия.',
      ok: function (s, c) { return c.rows.some(function (r) { return r.i.type === 'stock' && r.p.q > 0; }); } },
    { id: 'm2', t: 'Облигации и НКД', g: 'Купите не менее 10 гособлигаций GOV29.', why: 'Сумма покупки = чистая цена + накопленный купонный доход. Сравните сумму в журнале с ценой в процентах.',
      ok: function (s) { return s.pos.GOV29 && s.pos.GOV29.q >= 10; } },
    { id: 'm3', t: 'Купонный доход', g: 'Удерживайте облигации до выплаты купона.', why: 'НКД, уплаченный при покупке, возвращается в составе первого купона.',
      ok: function (s) { return !!s.flags.coupon; } },
    { id: 'm4', t: 'Диверсификация', g: 'Держите не менее 5 разных инструментов так, чтобы ни один не превышал 30% стоимости портфеля.', why: 'Лимит на одну позицию — простой способ ограничить специфический риск.',
      ok: function (s, c) { return c.rows.length >= 5 && c.rows.every(function (r) { return Math.abs(r.expo) <= 0.3 * c.equity; }); } },
    { id: 'm5', t: 'Портфель 60/40', g: 'Доведите долю акций до 55–65%, а облигаций — до 35–45% стоимости портфеля.', why: 'Распределение активов определяет основную часть риска и доходности портфеля.',
      ok: function (s, c) { var a = c.stocks / c.equity, b = c.bonds / c.equity; return a >= 0.55 && a <= 0.65 && b >= 0.35 && b <= 0.45; } },
    { id: 'm6', t: 'Плечо под контролем', g: 'Купите акций больше, чем у вас денег (свободные деньги станут отрицательными), сохранив НПР1 положительным.', why: 'Заёмные средства увеличивают позицию; за заём ежедневно начисляется процент.',
      ok: function (s, c) { return s.cash < -1000 && c.npr1 > 0; } },
    { id: 'm7', t: 'Короткая позиция', g: 'Продайте акции, которых у вас нет.', why: 'Шорт зарабатывает на падении цены; за заём бумаг начисляется плата, а дивиденды списываются со счёта.',
      ok: function (s, c) { return c.rows.some(function (r) { return r.i.type === 'stock' && r.p.q < 0; }); } },
    { id: 'm8', t: 'Хедж фьючерсом', g: 'При портфеле акций от 300 000 ₽ продайте фьючерс на индекс FNX на 70–130% стоимости акций.', why: 'Короткий фьючерс компенсирует падение рынка: убыток по акциям покрывается вариационной маржой.',
      ok: function (s, c) { var n = c.futN.FNXF || 0; return c.stocks >= 300000 && n < 0 && -n >= 0.7 * c.stocks && -n <= 1.3 * c.stocks; } }
  ];
  function checkMissions(s) {
    var c = calc(s), done = [];
    MISSIONS.forEach(function (m) { if (!S.missions[m.id] && m.ok(s, c)) { S.missions[m.id] = 1; done.push(m.t); } });
    if (done.length) log(s, 'Задание выполнено: ' + done.join(', ') + '.', 'buy');
  }

  // ---------- экран ----------
  var ui = { sel: 'SVNF', lots: 1, msg: null, auto: false, ask: false };
  function priceText(i, px) { return i.type === 'bond' ? f(px, 2) + '%' : i.type === 'fut' ? f(px, 0) : f(px, 2) + ' ₽'; }
  function chg(s, id) { var h = s.hist[id]; return h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0; }
  FX.views.sim = function (el) {
    el.className = 'page wide';
    if (!S.sim) { S.sim = newSim(); FX.save(); }
    var s = S.sim, c = calc(s), si = ins(ui.sel), px = s.px[ui.sel], pos = s.pos[ui.sel];
    var rows = INS.map(function (i) {
      var ch = chg(s, i.id), p = s.pos[i.id];
      return '<tr class="pick' + (i.id === ui.sel ? ' cur' : '') + '" data-act="sel" data-arg="' + i.id + '"><td class="tk">' + i.id + '</td><td>' + i.name + '</td><td class="r">' + priceText(i, s.px[i.id]) + '</td><td class="r ' + FX.cls(ch) + '">' + FX.sign(ch * 100, 2) + '%</td><td class="r">' + (p ? f(p.q, 0) : '') + '</td></tr>';
    }).join('');
    var info;
    if (si.type === 'stock') info = '<span>Лот</span><span class="v">' + si.lot + ' шт.</span><span>Ставка риска (начальная)</span><span class="v">' + FX.pct(si.rate, 0) + '</span><span>Бета к индексу</span><span class="v">' + f(si.beta, 1) + '</span>';
    else if (si.type === 'bond') info = '<span>Купон</span><span class="v">' + FX.pct(si.coupon, 1) + ' годовых, ' + si.freq + ' раза в год</span><span>НКД</span><span class="v">' + FX.money(nkd(s, si), 2) + '</span><span>Дней до купона</span><span class="v">' + (Math.round(365 / si.freq) - s.acc[si.id]) + '</span><span>Дюрация</span><span class="v">' + f(si.dur, 1) + '</span>';
    else info = '<span>Стоимость контракта</span><span class="v">' + FX.money(px * si.mult) + '</span><span>Гарантийное обеспечение</span><span class="v">' + FX.money(px * si.mult * si.rate) + ' (' + FX.pct(si.rate, 0) + ')</span><span>Дней до экспирации</span><span class="v">' + s.fd[si.id] + '</span><span>Базовый актив</span><span class="v">' + si.base + ' · ' + f(s.px[si.base], 2) + '</span>';
    var lots = Math.max(1, Math.floor(ui.lots) || 1), qty = lots * si.lot;
    var est = si.type === 'fut' ? 'ГО ' + FX.money(qty * px * si.mult * si.rate) : FX.money(qty * (si.type === 'bond' ? px / 100 * si.nominal + nkd(s, si) : px));
    var prow = c.rows.map(function (r) {
      return '<tr class="pick" data-act="sel" data-arg="' + r.i.id + '"><td class="tk">' + r.i.id + '</td><td class="r">' + f(r.p.q, 0) + '</td><td class="r">' + priceText(r.i, r.p.avg) + '</td><td class="r">' + (r.i.type === 'fut' ? '<span class="muted">' + FX.money(r.expo) + '</span>' : FX.money(r.val)) + '</td><td class="r ' + FX.cls(r.pnl) + '">' + FX.sign(r.pnl, 0) + ' ₽</td></tr>';
    }).join('');
    var pnl = c.equity - START, ich = chg(s, 'FNX');
    var mdone = MISSIONS.filter(function (m) { return S.missions[m.id]; }).length;
    el.innerHTML =
      '<div class="head"><div class="row between"><h1>Торговый тренажёр</h1><div class="row"><span class="pill acc">День ' + s.day + '</span>' +
      '<button class="btn primary" data-act="next">Следующий день</button><button class="btn" data-act="next5">+5 дней</button><button class="btn" data-act="auto">' + (ui.auto ? '❚❚ Пауза' : '▶ Авто') + '</button>' +
      (ui.ask ? '<span class="muted">Начать заново?</span><button class="btn sm sell" data-act="resetYes">Да</button><button class="btn sm" data-act="resetNo">Нет</button>' : '<button class="btn ghost" data-act="reset">Сбросить счёт</button>') + '</div></div>' +
      '<p>Учебный счёт на ' + FX.money(START) + '. Бумаги и цены вымышленные, один шаг — один торговый день. Комиссия 0,05%, заём денег 20% годовых, заём бумаг 13% годовых.</p></div>' +
      '<div class="grid k4">' +
      '<div class="kpi"><div class="l">Стоимость портфеля</div><div class="v">' + FX.money(c.equity) + '</div><div class="s ' + FX.cls(pnl) + '">' + FX.sign(pnl, 0) + ' ₽ (' + FX.sign(pnl / START * 100, 2) + '%)</div></div>' +
      '<div class="kpi"><div class="l">Свободные деньги</div><div class="v ' + (s.cash < 0 ? 'down' : '') + '">' + FX.money(s.cash) + '</div><div class="s">' + (s.cash < 0 ? 'используется заём брокера' : 'плечо не используется') + '</div></div>' +
      '<div class="kpi"><div class="l">НПР1 · начальная маржа</div><div class="v ' + (c.npr1 < 0 ? 'down' : '') + '">' + FX.money(c.npr1) + '</div><div class="s">маржа ' + FX.money(c.im) + (c.npr1 < 0 ? ' · новые позиции запрещены' : '') + '</div></div>' +
      '<div class="kpi"><div class="l">НПР2 · минимальная маржа</div><div class="v ' + (c.npr2 < 0 ? 'down' : '') + '">' + FX.money(c.npr2) + '</div><div class="s">маржа ' + FX.money(c.mm) + ' · маржин-коллов: ' + s.calls + '</div></div>' +
      '<div class="kpi"><div class="l">Индекс FNX</div><div class="v">' + f(s.px.FNX, 2) + '</div><div class="s ' + FX.cls(ich) + '">' + FX.sign(ich * 100, 2) + '% за день</div></div></div>' +
      '<div class="split"><div class="col"><div class="card"><h2>Инструменты</h2><div class="tw"><table class="t"><thead><tr><th>Тикер</th><th>Название</th><th class="r">Цена</th><th class="r">День</th><th class="r">Позиция</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="card"><h2>Позиции</h2>' + (prow ? '<div class="tw"><table class="t"><thead><tr><th>Тикер</th><th class="r">Кол-во</th><th class="r">Средняя</th><th class="r">Стоимость</th><th class="r">Результат</th></tr></thead><tbody>' + prow + '</tbody></table></div><p class="muted" style="font-size:13px">По фьючерсам в «Стоимости» показан размер позиции, а в «Результате» — накопленная вариационная маржа.</p>' : '<p class="muted">Открытых позиций нет. Выберите инструмент в таблице и подайте заявку.</p>') + '</div></div>' +
      '<div class="col"><div class="card"><div class="row between"><div class="row"><h2>' + si.name + '</h2><span class="pill">' + TYPE[si.type] + '</span></div><span class="num" style="font-size:20px;font-weight:650">' + priceText(si, px) + '</span></div>' +
      '<canvas id="simCv"></canvas><div class="kv">' + info + (pos ? '<span>Ваша позиция</span><span class="v">' + f(pos.q, 0) + ' шт.</span>' : '') + '</div>' +
      '<div class="row" style="align-items:flex-end"><label class="f">Лотов<input id="simLots" type="number" min="1" step="1" value="' + lots + '" style="width:100px"></label>' +
      '<button class="btn buy" data-act="buy">Купить</button><button class="btn sell" data-act="sellx">Продать</button><span class="muted num" id="simEst">' + f(qty, 0) + ' шт. · ' + est + '</span></div>' +
      (ui.msg ? '<div class="msg ' + (ui.msg.ok ? 'ok' : 'bad') + '">' + ui.msg.msg + '</div>' : '') + '</div>' +
      '<div class="card"><div class="row between"><h2>Задания</h2><span class="pill ' + (mdone === MISSIONS.length ? 'ok' : '') + '">' + mdone + ' из ' + MISSIONS.length + '</span></div><div>' +
      MISSIONS.map(function (m) { var d = S.missions[m.id]; return '<div class="mission"><span class="tick' + (d ? ' on' : '') + '">' + (d ? '✓' : '') + '</span><div><div class="t">' + m.t + '</div><div class="g">' + (d ? m.why : m.g) + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Журнал</h2><div class="log">' + s.log.map(function (l) { return '<div><span class="d">д.' + l.d + '</span><span class="' + (l.k === 'bad' ? 'down' : '') + '">' + l.t + '</span></div>'; }).join('') + '</div></div></div></div>';

    var draw = function () {
      var cv = FX.$('#simCv'); if (!cv) return;
      var h = s.hist[ui.sel], xs = h.map(function (_, k) { return s.day - h.length + 1 + k; });
      FX.plot(cv, xs, h, { h: 220, color: FX.css(h[h.length - 1] >= h[0] ? '--up' : '--down'), mark: { x: xs[xs.length - 1], y: h[h.length - 1] },
        xFmt: function (v) { return 'д.' + Math.round(v); }, yFmt: function (v) { return f(v, si.type === 'fut' ? 0 : 2); } });
    };
    draw();
    function advance(n) { for (var k = 0; k < n; k++) step(s, false); checkMissions(s); ui.msg = null; FX.save(); FX.render(); }
    function order(side) {
      var v = parseInt(FX.$('#simLots').value, 10); ui.lots = v;
      ui.msg = trade(s, ui.sel, v, side); checkMissions(s); FX.save(); FX.render();
    }
    FX.act(el, {
      sel: function (id) { ui.sel = id; ui.msg = null; FX.render(); },
      next: function () { advance(1); }, next5: function () { advance(5); },
      auto: function () { ui.auto = !ui.auto; FX.render(); },
      buy: function () { order(1); }, sellx: function () { order(-1); },
      reset: function () { ui.ask = true; FX.render(); }, resetNo: function () { ui.ask = false; FX.render(); },
      resetYes: function () { ui.ask = false; ui.auto = false; ui.msg = null; S.sim = newSim(); FX.save(); FX.render(); }
    });
    el.oninput = function (e) {
      if (e.target.id !== 'simLots') return;
      var v = Math.max(1, parseInt(e.target.value, 10) || 1); ui.lots = v;
      var q = v * si.lot;
      FX.$('#simEst').textContent = f(q, 0) + ' шт. · ' + (si.type === 'fut' ? 'ГО ' + FX.money(q * px * si.mult * si.rate) : FX.money(q * (si.type === 'bond' ? px / 100 * si.nominal + nkd(s, si) : px)));
    };
    var iv = ui.auto ? setInterval(function () { if (document.activeElement && document.activeElement.id === 'simLots') return; advance(1); }, 1300) : null;
    window.addEventListener('resize', draw);
    FX.cleanup = function () { if (iv) clearInterval(iv); window.removeEventListener('resize', draw); };
  };
  FX.simApi = { newSim: newSim, step: step, trade: trade, calc: calc };
})(window.FX);
