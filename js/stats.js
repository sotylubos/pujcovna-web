/* Anonymní počítání návštěv a zájmu o položky: žádné cookies, žádná IP adresa, žádné údaje o osobě.
   Posílá se jen cesta stránky, odkud návštěvník přišel (doména), typ zařízení a náhodné číslo platné jen po dobu otevřeného okna. */
(function () {
  'use strict';
  try {
    if (localStorage.getItem('pj-notrack')) return;
    var ua = navigator.userAgent || '';
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(ua)) return;
    var sid;
    try { sid = sessionStorage.getItem('pj-sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('pj-sid', sid); } } catch (e) { sid = ''; }
    var ref = '';
    try { var u = new URL(document.referrer); if (u.hostname && u.hostname.replace(/^www\./, '') !== location.hostname.replace(/^www\./, '')) ref = u.hostname.replace(/^www\./, ''); } catch (e) {}
    var w = Math.min(screen.width || 1024, window.innerWidth || 1024);
    var dev = w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
    var path = location.pathname.replace(/\/index\.html$/, '/');
    var KEY = 'sb_publishable_9-08pVFy82_mNy3rRVh-6w_gUZwOe3I', BASE = 'https://bnckyiveqebzzzxuoluj.supabase.co/rest/v1/rpc/';
    var PAGE_ITEM = { '/skakaci-hrad': 'hrad', '/cistic-kobercu': 'cistic', '/nosic-kol': 'nosic', '/stresni-box': 'box', '/pricniky': 'pricniky', '/odvlhcovac': 'odvlhcovac' };
    var pageItem = PAGE_ITEM[path.replace(/\.html$/, '')] || null;
    /* Zájem o položky: window.pjEvent('pick'|'date', id) – kolikrát si někdo vybral položku nebo termín v kalendáři */
    var sent = {};
    window.pjEvent = function (ev, item) {
      try {
        var k = ev + '|' + (item || ''); if (sent[k]) return; sent[k] = 1; // každou událost jednou za otevřené okno
        fetch(BASE + 'pj_event', { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_ev: ev, p_item: item || null, p_sid: sid }) }).catch(function () {});
      } catch (e) {}
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="tel:"],a[href^="mailto:"]'); if (!a) return;
      window.pjEvent(a.getAttribute('href').indexOf('tel:') === 0 ? 'call' : 'mail', pageItem);
    });
    fetch(BASE + 'pj_track', {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_path: path, p_ref: ref, p_sid: sid, p_dev: dev })
    }).catch(function () {});
  } catch (e) {}
})();
