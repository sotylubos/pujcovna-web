(function () {
  'use strict';
  var PJ = window.PJ;
  var items = {};
  PJ.items.forEach(function (it) { items[it.id] = it; });
  var kc = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Kč'; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function api(path, body) {
    var opts = { headers: { apikey: PJ.key, Authorization: 'Bearer ' + PJ.key, 'Content-Type': 'application/json' } };
    if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    return fetch(PJ.url + '/rest/v1/' + path, opts).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'Chyba serveru'); return j; });
    });
  }

  /* Aktuální ceny z databáze */
  function paintPrices() {
    $$('[data-price]').forEach(function (el) { var it = items[el.dataset.price]; if (it) el.textContent = kc(it.price); });
    $$('[data-deposit]').forEach(function (el) { var it = items[el.dataset.deposit]; if (it) el.textContent = kc(it.deposit); });
    if (window.__pjUpdate) window.__pjUpdate();
    if (window.__pjKm) window.__pjKm();
  }
  api('pj_items?select=id,price,deposit,active').then(function (rows) {
    rows.forEach(function (r) { if (items[r.id]) { items[r.id].price = r.price; items[r.id].deposit = r.deposit; } });
    paintPrices();
  }).catch(function () {});

  /* Videa – načtou se z YouTube až po kliknutí */
  $$('[data-yt]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true; f.title = b.getAttribute('aria-label') || 'Video';
      b.replaceWith(f);
    });
  });

  /* Galerie na detailu */
  var big = $('#bigImg');
  $$('.thumbs button').forEach(function (b) {
    b.addEventListener('click', function () {
      big.src = b.dataset.img;
      big.classList.toggle('contain', !/hrad|box-auto/.test(b.dataset.img));
      $$('.thumbs button').forEach(function (x) { x.setAttribute('aria-current', x === b ? 'true' : 'false'); });
    });
  });

  /* Kalkulačka dopravy hradu */
  var km = $('#km');
  if (km) {
    window.__pjKm = function () {
      var k = +km.value, t = k * 6 * 4;
      $('#kmOut').textContent = k + ' km';
      $('#kmPrice').textContent = kc(t);
      $('#kmTotal').textContent = kc(items.hrad.price + t);
    };
    km.addEventListener('input', window.__pjKm); window.__pjKm();
  }

  /* Rezervace */
  var form = $('#resForm');
  if (!form) return;
  var MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var st = { item: null, y: today.getFullYear(), m: today.getMonth(), start: null, end: null, busy: {}, loading: false };
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var parse = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var fmt = function (s) { var d = parse(s); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; };
  var calErr = $('#calErr'), formErr = $('#formErr');
  function showErr(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

  function pick(id) {
    if (!items[id]) return;
    st.item = id; st.start = st.end = null; showErr(calErr, '');
    $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.item === id ? 'true' : 'false'); });
    loadBusy();
  }
  var track = function (ev, id) { if (window.pjEvent) window.pjEvent(ev, id); };
  $$('.chip').forEach(function (c) { c.addEventListener('click', function () { track('pick', c.dataset.item); pick(c.dataset.item); }); });
  $$('[data-pick]').forEach(function (a) { a.addEventListener('click', function () { track('pick', a.dataset.pick); pick(a.dataset.pick); }); });

  function loadBusy() {
    if (!st.item) { render(); return; }
    var from = new Date(st.y, st.m, 1), to = new Date(st.y, st.m + 2, 0);
    st.loading = true; render();
    api('rpc/pj_busy_days', { p_item: st.item, p_from: iso(from), p_to: iso(to) }).then(function (rows) {
      st.busy = {}; rows.forEach(function (r) { st.busy[typeof r === 'string' ? r : r.pj_busy_days] = true; });
    }).catch(function () { showErr(calErr, 'Obsazenost se nepodařilo načíst. Zkuste to znovu, nebo zavolejte.'); })
      .then(function () { st.loading = false; render(); });
  }

  function rangeHasBusy(a, b) {
    for (var d = parse(a); d <= parse(b); d.setDate(d.getDate() + 1)) if (st.busy[iso(d)]) return true;
    return false;
  }

  function clickDay(s) {
    showErr(calErr, '');
    if (!st.item) { showErr(calErr, 'Nejdřív vyberte, co si chcete půjčit.'); return; }
    if (!st.start || st.end) { st.start = s; st.end = null; }
    else if (s < st.start) { st.start = s; }
    else if (rangeHasBusy(st.start, s)) { showErr(calErr, 'V tomto rozmezí je už obsazený den. Zkuste jiný termín.'); return; }
    else { st.end = s; }
    track('date', st.item);
    render();
  }

  function render() {
    $('#calTitle').textContent = MONTHS[st.m] + ' ' + st.y;
    $('#calPrev').disabled = (st.y * 12 + st.m) <= (today.getFullYear() * 12 + today.getMonth());
    var grid = $('#calGrid'); grid.innerHTML = '';
    var first = new Date(st.y, st.m, 1), off = (first.getDay() + 6) % 7, count = new Date(st.y, st.m + 1, 0).getDate();
    for (var i = 0; i < off; i++) { var e = document.createElement('span'); e.className = 'day empty'; grid.appendChild(e); }
    for (var d = 1; d <= count; d++) {
      var date = new Date(st.y, st.m, d), s = iso(date), b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.textContent = d;
      var past = date < today, busy = !!st.busy[s];
      var sel = st.start && (st.end ? (s >= st.start && s <= st.end) : s === st.start);
      if (past) { b.classList.add('past'); b.disabled = true; }
      else if (busy) { b.classList.add('taken'); b.disabled = true; b.setAttribute('aria-label', d + '. obsazeno'); }
      if (sel) b.classList.add('sel');
      if (+date === +today) b.classList.add('today');
      if (!past && !busy) b.addEventListener('click', clickDay.bind(null, s));
      grid.appendChild(b);
    }
    grid.style.opacity = st.loading ? .5 : 1;
    update();
  }

  function days() {
    if (!st.start) return 0;
    var b = st.end || st.start;
    return Math.round((parse(b) - parse(st.start)) / 86400000) + 1;
  }
  function update() {
    var it = items[st.item], n = days();
    $('#sumItem').textContent = it ? it.name : 'Vyberte položku';
    $('#sumRange').textContent = st.start ? (st.end && st.end !== st.start ? fmt(st.start) + ' – ' + fmt(st.end) : fmt(st.start)) : 'vyberte v kalendáři';
    $('#sumDays').textContent = n === 1 ? '1 den' : (n >= 2 && n <= 4 ? n + ' dny' : n + ' dní');
    $('#sumRent').textContent = it ? kc(n * it.price) : '0 Kč';
    $('#sumDep').textContent = it ? kc(it.deposit) : '—';
    $('#sumTotal').textContent = it && n ? kc(n * it.price + it.deposit) : '—';
  }
  window.__pjUpdate = update;

  $('#calPrev').addEventListener('click', function () { st.m--; if (st.m < 0) { st.m = 11; st.y--; } loadBusy(); });
  $('#calNext').addEventListener('click', function () { st.m++; if (st.m > 11) { st.m = 0; st.y++; } loadBusy(); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); showErr(formErr, '');
    var f = form.elements;
    if (f.web.value) return;
    if (!st.item) return showErr(formErr, 'Vyberte, co si chcete půjčit.');
    if (!st.start) return showErr(formErr, 'Vyberte v kalendáři termín.');
    if (f.name.value.trim().length < 2) return showErr(formErr, 'Vyplňte jméno a příjmení.');
    if (f.phone.value.replace(/\D/g, '').length < 9) return showErr(formErr, 'Vyplňte telefon, ať vám můžeme zavolat.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return showErr(formErr, 'Zkontrolujte e-mail, pošleme na něj potvrzení.');
    if (f.address.value.trim().length < 5) return showErr(formErr, 'Vyplňte adresu (ulice, číslo, obec).');
    var btn = $('#resSubmit'); btn.disabled = true; btn.textContent = 'Odesílám…';
    api('rpc/pj_create_reservation', {
      p_item: st.item, p_start: st.start, p_end: st.end || st.start, p_name: f.name.value, p_email: f.email.value,
      p_phone: f.phone.value, p_note: f.note.value, p_delivery: f.delivery.checked, p_address: f.address.value
    }).then(function (code) {
      $('#resCode').textContent = code;
      form.hidden = true; $('#resDone').hidden = false;
      $('#resDone').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (e) {
      showErr(formErr, (e.message || 'Odeslání se nepovedlo.') + ' Zkuste to prosím znovu, nebo zavolejte na 777 097 902.');
      loadBusy();
    }).then(function () { btn.disabled = false; btn.textContent = 'Odeslat poptávku'; });
  });
  $('#resAgain').addEventListener('click', function () {
    form.reset(); form.hidden = false; $('#resDone').hidden = true; st.start = st.end = null; loadBusy();
  });

  var q = new URLSearchParams(location.search).get('polozka');
  pick(items[q] ? q : 'hrad');
})();
