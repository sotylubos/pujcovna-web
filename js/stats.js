/* Anonymní počítání návštěv: žádné cookies, žádná IP adresa, žádné údaje o osobě.
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
    fetch('https://bnckyiveqebzzzxuoluj.supabase.co/rest/v1/rpc/pj_track', {
      method: 'POST', keepalive: true,
      headers: { apikey: 'sb_publishable_9-08pVFy82_mNy3rRVh-6w_gUZwOe3I', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_path: path, p_ref: ref, p_sid: sid, p_dev: dev })
    }).catch(function () {});
  } catch (e) {}
})();
