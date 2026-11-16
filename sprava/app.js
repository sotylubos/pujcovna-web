import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

const SB_URL = 'https://bnckyiveqebzzzxuoluj.supabase.co';
const SB_KEY = 'sb_publishable_9-08pVFy82_mNy3rRVh-6w_gUZwOe3I';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, storageKey: 'pj-sprava-auth', detectSessionInUrl: true, flowType: 'pkce' } });

const FIRM = { name: 'Půjčovna Žďár', owner: 'Lubomír Šotek', ico: '71391134', addr: 'Světnov 201, 591 02 Žďár nad Sázavou', phone: '+420 777 097 902', email: 'info@pujcovna-zdar.cz' };
const app = document.getElementById('app');
const S = { tab: 'poptavky', items: [], res: [], calY: 0, calM: 0, archive: 'vse', hYear: 0, hQ: '', hist: [], eet: {}, stats: null, statDays: 30, ov: { st: 'aktivni', item: 'vse', q: '' }, push: 'unknown', user: null, settings: {} };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kc = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Kč';
const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dm = (s) => { const d = pd(s); return `${d.getDate()}. ${d.getMonth() + 1}.`; };
const dmy = (s) => { const d = pd(s); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`; };
const WD = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const wd = (s) => WD[pd(s).getDay()];
const nDays = (r) => Math.round((pd(r.end_date) - pd(r.start_date)) / 86400000) + 1;
const daysWord = (n) => (n === 1 ? '1 den' : n >= 2 && n <= 4 ? `${n} dny` : `${n} dní`);
const range = (r) => (r.start_date === r.end_date ? `${wd(r.start_date)} ${dm(r.start_date)}` : `${wd(r.start_date)} ${dm(r.start_date)} – ${wd(r.end_date)} ${dm(r.end_date)}`);
const todayIso = () => iso(new Date());
const itemName = (id) => S.items.find((i) => i.id === id)?.name || id;
const nowCz = () => new Date().toLocaleDateString('cs-CZ');
const PAID = { unpaid: 'Nezaplaceno', cash: 'Zaplaceno hotově', qr_onsite: 'Zaplaceno QR na místě', transfer: 'Zaplaceno převodem', deposit: 'Strženo z kauce' };

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------- přihlášení ---------- */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginView();
  S.user = session.user;
  const { data: ok } = await sb.rpc('pj_is_admin');
  if (!ok) {
    app.innerHTML = `<div class="login"><h2>Bez přístupu</h2><p class="muted">Účet ${esc(session.user.email)} nemá přístup ke správě půjčovny.</p><button class="btn ghost" id="out">Odhlásit</button></div>`;
    document.getElementById('out').onclick = () => sb.auth.signOut().then(boot);
    return;
  }
  try { localStorage.setItem('pj-notrack', '1'); } catch {} // vlastní návštěvy webu z tohoto zařízení se nepočítají
  const n = new Date(); S.calY = n.getFullYear(); S.calM = n.getMonth();
  await load();
  await pushInit();
  render();
  eetRetry();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load().then(render); });
}
function loginView() {
  app.innerHTML = `<div class="login">
    <svg width="64" height="64" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#1F4D3A"/><g transform="translate(8 8)" fill="none" stroke="#FF7A3D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></g></svg>
    <h2>Správa půjčovny</h2><p class="muted">Přihlaste se Google účtem.</p>
    <button class="btn primary" style="flex:none;padding:0 28px" id="g">Přihlásit přes Google</button></div>`;
  document.getElementById('g').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/sprava/' } });
}

/* ---------- upozornění (web push) ---------- */
const VAPID = 'BB7QypyVHqtz1HDNdPBlY910XJNi8hpP_3BApXhe0a1dP4Qng9iw8PzEPZi1aIO1sgIpBF0IwEz13kXOD69oJlM';
const b64 = (v) => { const p = '='.repeat((4 - (v.length % 4)) % 4); const r = atob((v + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
async function pushInit() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { S.push = 'unsupported'; return; }
  if (Notification.permission === 'denied') { S.push = 'denied'; return; }
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') {
      // pro jistotu znovu uložíme (kdyby záznam v databázi chyběl)
      const j = sub.toJSON(); await sb.from('pj_push_subs').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: S.user.id, label: navigator.userAgent.slice(0, 80) });
      S.push = 'on';
    } else S.push = 'off';
  } catch { S.push = 'off'; }
}
async function pushOn() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { S.push = perm === 'denied' ? 'denied' : 'off'; render(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }));
    const j = sub.toJSON();
    const { error } = await sb.from('pj_push_subs').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: S.user.id, label: navigator.userAgent.slice(0, 80) });
    if (error) throw error;
    S.push = 'on'; render(); toast('Upozornění zapnuta');
  } catch (e) { toast('Zapnutí se nepovedlo: ' + (e.message || e)); }
}
function pushBanner() {
  if (S.push === 'off') return `<div class="card" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 16px;margin-bottom:14px"><span><b>Upozornění na nové rezervace</b><br><span class="muted">Zapněte na tomto zařízení.</span></span><button class="btn primary" id="pushOn" style="flex:none;padding:0 20px">Zapnout</button></div>`;
  if (S.push === 'denied') return `<div class="card muted" style="padding:14px 16px;margin-bottom:14px">Upozornění jsou v prohlížeči zablokovaná. Povolte je v nastavení webu (ikona zámku vedle adresy).</div>`;
  return '';
}

/* ---------- data ---------- */
async function load() {
  const since = iso(new Date(Date.now() - 400 * 86400000));
  const [it, rs, st, hs] = await Promise.all([
    sb.from('pj_items').select('*').order('sort'),
    sb.from('pj_reservations').select('*').gte('end_date', since).order('start_date'),
    sb.from('pj_settings').select('key,value'),
    sb.from('pj_history').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
  ]);
  if (!hs.error) S.hist = hs.data;
  if (!st.error) { S.settings = {}; st.data.forEach((x) => (S.settings[x.key] = x.value)); }
  if (it.error || rs.error) { toast('Načtení se nepovedlo'); return; }
  S.items = it.data; S.res = rs.data;
  await loadEet();
}
const eetOn = () => ['playground', 'prod'].includes(S.settings.eet_mode);
async function loadEet() {
  S.eet = {};
  if (!eetOn()) return;
  const { data } = await sb.from('pj_eet').select('*').eq('env', S.settings.eet_mode).order('id', { ascending: false }).limit(1000);
  (data || []).forEach((x) => { if (x.reservation_id) (S.eet[x.reservation_id] = S.eet[x.reservation_id] || []).unshift(x); });
  S.eetAll = data || [];
}
async function eetCall(body) {
  const { data, error } = await sb.functions.invoke('pj-eet', { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); }
  return data;
}
let eetRetried = false;
async function eetRetry() {
  if (eetRetried || !eetOn() || !(S.eetAll || []).some((x) => x.status === 'pending')) return;
  eetRetried = true;
  try { await eetCall({ action: 'retry' }); await loadEet(); render(); } catch {}
}
const EET_KEYS = ['paid_status', 'status', 'deposit_status', 'deposit_retained', 'rent_amount'];
async function eetSync(r) {
  if (!eetOn()) return;
  try {
    const d = await eetCall({ action: 'sync', reservation_id: r.id });
    if (d && d.ok === false) return toast('EET: ' + d.message);
    if (d && d.rows) S.eet[r.id] = d.rows;
    for (const x of (d && d.sent) || []) {
      if (x.status === 'ok') toast(`EET zaevidováno ${kc(x.amount)}`);
      else toast(`EET: ${x.error || 'neodesláno'}`);
    }
    render();
  } catch (e) { toast('EET: ' + (e.message || e)); }
}
async function patch(r, fields, msg) {
  const { data, error } = await sb.from('pj_reservations').update(fields).eq('id', r.id).select().single();
  if (error) { toast('Uložení se nepovedlo: ' + error.message); return null; }
  Object.assign(r, data); render(); if (msg) toast(msg);
  if (Object.keys(fields).some((k) => EET_KEYS.includes(k))) eetSync(r);
  return r;
}

/* ---------- e-maily (zatím přes vlastní poštu) ---------- */
const sign = `\n\nS pozdravem\n${FIRM.owner}\n${FIRM.name}\n${FIRM.phone}\n${FIRM.email}`;
const T = {
  confirm: (r) => ({
    subject: `Potvrzení rezervace ${r.code} – ${itemName(r.item_id)}`,
    body: `Dobrý den,\n\npotvrzujeme Vaši rezervaci.\n\n${itemName(r.item_id)}\nTermín: ${dmy(r.start_date)}${r.end_date !== r.start_date ? ' – ' + dmy(r.end_date) : ''} (${daysWord(nDays(r))})\nNájem: ${kc(r.rent_amount)}\nVratná kauce: ${kc(r.deposit_amount)} (platí se při převzetí, vrátíme ji při vrácení)\n\n${r.delivery ? 'Doprava: domluvíme telefonicky.' : 'Místo převzetí: ' + FIRM.addr}\nČas předání: [doplňte]\n\nS sebou si prosím vezměte doklad totožnosti. Zaplatit můžete hotově nebo QR kódem při převzetí.` + sign,
  }),
  reject: (r) => ({
    subject: `Rezervace ${r.code} – ${itemName(r.item_id)}`,
    body: `Dobrý den,\n\nděkujeme za poptávku. ${itemName(r.item_id)} bohužel v termínu ${dmy(r.start_date)}${r.end_date !== r.start_date ? ' – ' + dmy(r.end_date) : ''} nemůžeme půjčit.\n\nMůžeme nabídnout jiný termín: [doplňte]\n\nPokud se Vám hodí, stačí odpovědět na tento e-mail nebo zavolat.` + sign,
  }),
  depositIn: (r) => ({
    subject: `Potvrzení o převzetí kauce – rezervace ${r.code}`,
    body: `Dobrý den,\n\npotvrzujeme, že jsme dne ${nowCz()} od Vás převzali vratnou kauci ve výši ${kc(r.deposit_amount)}.\n\nZapůjčeno: ${itemName(r.item_id)}\nNájemce: ${r.customer_name}${r.address ? ', ' + r.address : ''}\nTermín: ${dmy(r.start_date)}${r.end_date !== r.start_date ? ' – ' + dmy(r.end_date) : ''}\nČíslo rezervace: ${r.code}\n\nKauci Vám vrátíme při vrácení zapůjčené věci v pořádku.` + sign + `\nIČ ${FIRM.ico}, ${FIRM.addr}`,
  }),
  depositOut: (r) => {
    const rent = r.paid_status === 'deposit' ? r.rent_amount : 0, ret = r.deposit_retained || 0, back = r.deposit_amount - rent - ret;
    let t;
    if (!rent && !ret) t = `Potvrzujeme, že jsme Vám dne ${nowCz()} vrátili celou kauci ${kc(r.deposit_amount)}.`;
    else {
      t = `Vyúčtování kauce ${kc(r.deposit_amount)}:\n`;
      if (rent) t += `– nájem ${itemName(r.item_id)} (${daysWord(nDays(r))}): ${kc(rent)}\n`;
      if (ret) t += `– ponecháno z důvodu: ${r.deposit_retained_reason || '[doplňte]'}: ${kc(ret)}\n`;
      t += `\nDne ${nowCz()} jsme Vám vrátili ${kc(back)}.`;
    }
    return { subject: `Vrácení kauce – rezervace ${r.code}`, body: `Dobrý den,\n\nděkujeme za vrácení: ${itemName(r.item_id)}.\n\n` + t + `\n\nBudeme rádi, když se zase ozvete.` + sign + `\nIČ ${FIRM.ico}, ${FIRM.addr}` };
  },
};
function mailSheet(r, kind, title) {
  if (!r.email) { toast('Zákazník nemá e-mail'); return; }
  const t = T[kind](r);
  sheet(`<h3>${esc(title)}</h3>
    <p class="muted" style="margin:0">Pro: ${esc(r.email)}</p>
    <label class="f">Předmět<input id="ms" value="${esc(t.subject)}"></label>
    <label class="f">Text<textarea id="mb">${esc(t.body)}</textarea></label>
    <div class="actions"><button class="btn primary" id="send">Otevřít v e-mailu</button><button class="btn ghost" id="cp">Kopírovat</button><button class="btn ghost" data-close>Teď ne</button></div>`,
  (el) => {
    el.querySelector('#send').onclick = () => {
      location.href = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(el.querySelector('#ms').value)}&body=${encodeURIComponent(el.querySelector('#mb').value)}`;
      closeSheet();
    };
    el.querySelector('#cp').onclick = () => navigator.clipboard.writeText(el.querySelector('#mb').value).then(() => toast('Zkopírováno'));
  });
}

/* ---------- QR platba ---------- */
function toIban(acc) {
  const m = String(acc).replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return null;
  const bban = m[3] + (m[1] || '').padStart(6, '0') + m[2].padStart(10, '0');
  const check = 98n - (BigInt(bban + '123500') % 97n);
  return 'CZ' + String(check).padStart(2, '0') + bban;
}
const ascii = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*]/g, '');
function accountSheet(after) {
  sheet(`<h3>Číslo účtu pro QR platby</h3>
    <p class="muted" style="margin:0">Zadejte číslo účtu, na který mají zákazníci platit. Uloží se jen do vaší správy.</p>
    <label class="f">Číslo účtu<input id="acc" inputmode="numeric" placeholder="např. 123456789/0800" value="${esc(S.settings.account || '')}"></label>
    <div class="actions"><button class="btn primary" id="sv">Uložit</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => (el.querySelector('#sv').onclick = async () => {
    const v = el.querySelector('#acc').value.trim();
    if (!toIban(v)) return toast('Zkontrolujte formát, např. 123456789/0800');
    const { error } = await sb.from('pj_settings').upsert({ key: 'account', value: v, updated_at: new Date().toISOString() });
    if (error) return toast('Uložení se nepovedlo');
    S.settings.account = v; closeSheet(); toast('Účet uložen'); after && after();
  }));
}
function qrSheet(r, start) {
  if (!S.settings.account || !toIban(S.settings.account)) return accountSheet(() => qrSheet(r, start));
  const opts = [['dep', 'Kauce', r.deposit_amount], ['rent', 'Nájem', r.rent_amount], ['both', 'Nájem + kauce', r.rent_amount + r.deposit_amount], ['custom', 'Jiná částka', 0]];
  if (!start) start = r.deposit_status === 'none' ? 'dep' : 'rent';
  sheet(`<h3>QR platba</h3>
    <div class="seg" id="qs">${opts.map(([k, l, a]) => `<button data-q="${k}" aria-pressed="${k === start}">${k === 'custom' ? l : l + ' · ' + kc(a)}</button>`).join('')}</div>
    <label class="f" id="qcw" style="display:none">Částka (Kč)<input id="qc" type="number" inputmode="decimal" min="1" step="1" placeholder="např. 1500"></label>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <img id="qimg" alt="QR kód k zaplacení" style="width:min(78vw,340px);height:auto;image-rendering:pixelated;background:#fff">
      <b id="qamt" style="font-family:var(--head);font-size:30px"></b>
      <span class="muted" style="font-size:14px">${esc(itemName(r.item_id))} · #${esc(r.code)} · účet ${esc(S.settings.account)}</span>
    </div>
    <div class="actions"><button class="btn primary" id="qpaid">Zaplaceno</button><button class="btn ghost" id="qacc">Změnit účet</button><button class="btn ghost" data-close>Zavřít</button></div>`,
  (el) => {
    let cur = opts.find((o) => o[0] === start) || opts[0];
    const amount = () => (cur[0] === 'custom' ? Math.round((+el.querySelector('#qc').value || 0) * 100) / 100 : cur[2]);
    const draw = async () => {
      const custom = cur[0] === 'custom', am = amount();
      el.querySelector('#qcw').style.display = custom ? 'flex' : 'none';
      el.querySelector('#qpaid').style.display = custom ? 'none' : '';
      el.querySelectorAll('[data-q]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.q === cur[0]));
      if (!(am > 0)) { el.querySelector('#qimg').removeAttribute('src'); el.querySelector('#qamt').textContent = 'Zadejte částku'; return; }
      const spd = `SPD*1.0*ACC:${toIban(S.settings.account)}*AM:${am.toFixed(2)}*CC:CZK*MSG:${ascii('Pujcovna Zdar ' + r.code + ' ' + cur[1]).slice(0, 60)}`;
      el.querySelector('#qimg').src = await QRCode.toDataURL(spd, { margin: 2, width: 640, errorCorrectionLevel: 'M' });
      el.querySelector('#qamt').textContent = custom ? (Number.isInteger(am) ? kc(am) : am.toLocaleString('cs-CZ') + ' Kč') : kc(am);
    };
    el.querySelector('#qc').addEventListener('input', draw);
    el.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { cur = opts.find((o) => o[0] === b.dataset.q); draw(); if (cur[0] === 'custom') el.querySelector('#qc').focus(); }));
    el.querySelector('#qacc').onclick = () => accountSheet(() => qrSheet(r, cur[0]));
    el.querySelector('#qpaid').onclick = async () => {
      closeSheet();
      const f = {}, now = new Date().toISOString();
      if (cur[0] !== 'dep') { f.paid_status = 'qr_onsite'; f.paid_at = now; }
      if (cur[0] !== 'rent') { f.deposit_status = 'received'; f.deposit_received_at = now; }
      if (await patch(r, f, 'Zaplaceno QR') && cur[0] !== 'rent') mailSheet(r, 'depositIn', 'Poslat potvrzení o převzetí kauce');
    };
    draw();
  });
}

/* ---------- EET ---------- */
const EET_KIND = { rent: 'Nájem', retained: 'Ponecháno z kauce', manual: 'Ručně', test: 'Test' };
const eetRow = (x) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line)">
  <span><b>${kc(x.amount)}</b> · ${EET_KIND[x.kind] || x.kind}${x.note ? ' – ' + esc(x.note) : ''}<br><span class="muted" style="font-size:12px">${new Date(x.dat_trzby).toLocaleString('cs-CZ')} · č. ${esc(x.porad_cis)}${x.pok ? '<br>POK ' + esc(x.pok) : ''}${x.error ? '<br><span style="color:var(--warn)">' + esc(x.error) + '</span>' : ''}</span></span>
  <span class="tag ${x.status === 'ok' ? 'ok' : 'warn'}" style="align-self:flex-start">${x.status === 'ok' ? 'Zaevidováno' : x.status === 'error' ? 'Chyba' : 'Čeká'}</span></div>`;
function eetResSheet(r) {
  const rows = S.eet[r.id] || [];
  sheet(`<h3>EET · #${esc(r.code)}</h3>
    ${rows.length ? rows.map(eetRow).join('') : '<p class="muted" style="margin:0">K této rezervaci zatím nic zaevidováno.</p>'}
    <p class="muted" style="margin:6px 0 0;font-size:13px">Tržby se evidují samy podle platby: nájem hotově nebo QR na místě, nájem stržený z kauce a částka ponechaná z kauce. Když platbu opravíte, odešle se rozdíl.</p>
    <p style="margin:8px 0 0;font-weight:600">Zaevidovat ručně (např. platba Jinou částkou)</p>
    <label class="f">Částka (Kč, vrácení se zápornou částkou)<input id="ma" type="number" inputmode="decimal" step="0.01"></label>
    <label class="f">Poznámka<input id="mn"></label>
    <div class="actions"><button class="btn primary" id="msend">Zaevidovat</button><button class="btn ghost" id="msync">Zkontrolovat a odeslat</button><button class="btn ghost" data-close>Zavřít</button></div>`,
  (el) => {
    el.querySelector('#msync').onclick = async () => { closeSheet(); await eetSync(r); };
    el.querySelector('#msend').onclick = async () => {
      const a = +el.querySelector('#ma').value;
      if (!a) return toast('Zadejte částku');
      if (!confirm(`Zaevidovat tržbu ${a.toLocaleString('cs-CZ')} Kč?`)) return;
      closeSheet();
      try {
        const d = await eetCall({ action: 'manual', reservation_id: r.id, amount: a, note: el.querySelector('#mn').value.trim() });
        if (d.ok === false) return toast('EET: ' + d.message);
        toast(d.row?.status === 'ok' ? 'EET zaevidováno' : 'EET: ' + (d.row?.error || 'čeká'));
        await loadEet(); render();
      } catch (e) { toast('EET: ' + e.message); }
    };
  });
}
async function saveSetting(key, value) {
  const { error } = await sb.from('pj_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error; S.settings[key] = value;
}
async function eetSettings() {
  sheet('<h3>EET</h3><p class="muted">Načítám…</p>');
  let st;
  try { st = await eetCall({ action: 'status' }); } catch (e) { closeSheet(); return toast('EET: ' + e.message); }
  const mode = S.settings.eet_mode || 'off', c = st.cert?.prod;
  const modes = [['off', 'Vypnuto'], ['playground', 'Zkušebně'], ['prod', 'Ostře']].map(([k, l]) => `<button data-em="${k}" aria-pressed="${mode === k}">${l}</button>`).join('');
  const recent = (S.eetAll || []).slice(0, 15);
  sheet(`<h3>Evidence tržeb (EET)</h3>
    <div class="seg" style="margin:0">${modes}</div>
    <p class="muted" style="margin:0;font-size:13px">${mode === 'prod' ? 'Tržby se posílají finanční správě naostro.' : mode === 'playground' ? 'Zkušební režim: tržby jdou na testovací server finanční správy a nic se doopravdy neeviduje.' : 'Nic se neodesílá.'}</p>
    <label class="f">Číslo evidenční jednotky (z DIS+)<input id="ej" inputmode="numeric" value="${esc(S.settings.eet_jednotka || '')}" placeholder="např. 1"></label>
    <div class="card" style="background:var(--bg);margin:0;padding:12px 14px;gap:6px"><b>Pokladní certifikát</b>
      ${c ? `<span>${esc(c.eic)} · platí do <b>${new Date(c.valid_to).toLocaleDateString('cs-CZ')}</b></span><span class="muted" style="font-size:12px">nahrán ${new Date(c.uploaded_at).toLocaleDateString('cs-CZ')}</span>` : '<span class="muted">Zatím nenahrán. Ve zkušebním režimu se použije testovací certifikát finanční správy.</span>'}
      <label class="f">Soubor certifikátu (.p12)<input id="ef" type="file" accept=".p12,.pfx,application/x-pkcs12"></label>
      <label class="f">Heslo k certifikátu<input id="ep" type="password" autocomplete="off"></label>
      <button class="btn ghost" id="eup">Nahrát certifikát</button></div>
    <div class="actions"><button class="btn primary" id="esv">Uložit</button><button class="btn ghost" id="etest">Vyzkoušet spojení</button>${(S.eetAll || []).some((x) => x.status === 'pending') ? '<button class="btn accent" id="eretry">Odeslat čekající</button>' : ''}</div>
    ${recent.length ? '<b>Poslední tržby</b>' + recent.map(eetRow).join('') : ''}
    <button class="btn ghost" data-close>Zavřít</button>`,
  (el) => {
    let m = mode;
    el.querySelectorAll('[data-em]').forEach((b) => (b.onclick = () => { m = b.dataset.em; el.querySelectorAll('[data-em]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.em === m)); }));
    el.querySelector('#esv').onclick = async () => {
      const j = el.querySelector('#ej').value.trim();
      if (m !== 'off' && !/^[1-9][0-9]{0,8}$/.test(j)) return toast('Vyplňte číslo evidenční jednotky (jen číslice)');
      if (m === 'prod' && mode !== 'prod' && !c) return toast('Pro ostrý režim nejdřív nahrajte pokladní certifikát');
      if (m === 'prod' && mode !== 'prod' && !confirm('Zapnout ostrou evidenci tržeb? Od teď se platby hotově a QR na místě budou posílat finanční správě.')) return;
      try {
        await saveSetting('eet_jednotka', j);
        if (m !== mode) { await saveSetting('eet_since', new Date().toISOString()); await saveSetting('eet_mode', m); }
        closeSheet(); await loadEet(); render(); toast('Uloženo');
      } catch (e) { toast('Uložení se nepovedlo: ' + e.message); }
    };
    el.querySelector('#eup').onclick = async () => {
      const f = el.querySelector('#ef').files[0], pw = el.querySelector('#ep').value;
      if (!f) return toast('Vyberte soubor .p12');
      if (!pw) return toast('Zadejte heslo k certifikátu');
      const buf = new Uint8Array(await f.arrayBuffer()); let bin = ''; buf.forEach((x) => (bin += String.fromCharCode(x)));
      try {
        const d = await eetCall({ action: 'cert', env: 'prod', p12: btoa(bin), password: pw });
        if (d.ok === false) return toast('Certifikát: ' + d.message);
        toast(`Certifikát ${d.eic} nahrán`); eetSettings();
      } catch (e) { toast('Certifikát: ' + e.message); }
    };
    el.querySelector('#etest').onclick = async () => {
      const env = m === 'prod' ? 'prod' : 'playground';
      const b = el.querySelector('#etest'); b.disabled = true; b.textContent = 'Zkouším…';
      try {
        const j = el.querySelector('#ej').value.trim();
        if (j && j !== S.settings.eet_jednotka) await saveSetting('eet_jednotka', j);
        const d = await eetCall({ action: 'test', env });
        if (d.ok) toast(`Spojení funguje (${env === 'prod' ? 'ostrý server' : 'testovací server'}, ${d.eic})` + (d.warnings?.length ? ' · varování: ' + d.warnings.map((w) => w.text || w.kod).join(', ') : ''));
        else toast('Spojení nefunguje: ' + (d.message || 'kód ' + d.kod));
      } catch (e) { toast('Spojení nefunguje: ' + e.message); }
      b.disabled = false; b.textContent = 'Vyzkoušet spojení';
    };
    el.querySelector('#eretry')?.addEventListener('click', async () => {
      try { await eetCall({ action: 'retry' }); await loadEet(); closeSheet(); render(); toast('Odesláno'); } catch (e) { toast('EET: ' + e.message); }
    });
  });
}

/* ---------- sheet ---------- */
function sheet(html, init) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheet';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(bg); init && init(bg);
}
function closeSheet() { document.getElementById('sheet')?.remove(); }

/* ---------- akce ---------- */
const ACT = {
  confirm: async (r) => { if (await patch(r, { status: 'confirmed' }, 'Potvrzeno')) mailSheet(r, 'confirm', 'Poslat potvrzení zákazníkovi'); },
  reject: async (r) => {
    if (!confirm(`Odmítnout poptávku ${r.customer_name}?`)) return;
    if (await patch(r, { status: 'rejected' }, 'Odmítnuto')) mailSheet(r, 'reject', 'Napsat zákazníkovi');
  },
  paid: (r) => sheet(`<h3>Jak zaplatil nájem ${esc(kc(r.rent_amount))}?</h3>
    <div class="choices">
      <button class="btn ghost" data-p="cash">Hotově</button>
      <button class="btn ghost" data-p="qr_onsite">QR kódem na místě</button>
      <button class="btn ghost" data-p="transfer">Převodem předem</button>
      ${r.deposit_status !== 'none' ? '<button class="btn ghost" data-p="deposit">Strhnu z kauce při vrácení</button>' : ''}
      ${r.paid_status !== 'unpaid' ? '<button class="btn danger" data-p="unpaid">Zrušit zaplacení</button>' : ''}
    </div>
    <p class="muted" style="margin:0;font-size:13px">Platby hotově a QR na místě se budou posílat do EET, až bude napojené.</p>`,
  (el) => el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = async () => {
    closeSheet(); await patch(r, { paid_status: b.dataset.p, paid_at: b.dataset.p === 'unpaid' ? null : new Date().toISOString() }, 'Uloženo');
  }))),
  depIn: (r) => sheet(`<h3>Kauce ${esc(kc(r.deposit_amount))}</h3><p class="muted" style="margin:0">Jak zákazník kauci platí?</p>
    <div class="choices"><button class="btn primary" id="dcash">Hotově – převzato</button><button class="btn accent" id="dqr">Ukázat QR kód</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => {
    el.querySelector('#dcash').onclick = async () => { closeSheet(); if (await patch(r, { deposit_status: 'received', deposit_received_at: new Date().toISOString() }, 'Kauce převzata')) mailSheet(r, 'depositIn', 'Poslat potvrzení o převzetí kauce'); };
    el.querySelector('#dqr').onclick = () => qrSheet(r, 'dep');
  }),
  back: (r) => {
    const hasDep = r.deposit_status === 'received';
    const canDeduct = hasDep && !['cash', 'qr_onsite', 'transfer'].includes(r.paid_status);
    sheet(`<h3>Vráceno: ${esc(itemName(r.item_id))}</h3>
    ${hasDep ? `<p style="margin:0">Kauce u nás: <b>${esc(kc(r.deposit_amount))}</b> · nájem ${esc(kc(r.rent_amount))} ${r.paid_status === 'unpaid' || r.paid_status === 'deposit' ? '<span class="muted">(nezaplacen)</span>' : `<span class="muted">(${esc(PAID[r.paid_status].toLowerCase())})</span>`}</p>` : `<p class="muted" style="margin:0">Kauce nebyla převzata.</p>`}
    ${canDeduct ? `<label style="display:flex;gap:10px;align-items:center;min-height:44px;font-weight:600"><input id="ded" type="checkbox" style="width:22px;height:22px"${r.paid_status !== 'unpaid' || r.deposit_amount >= r.rent_amount ? ' checked' : ''}> Strhnout nájem ${esc(kc(r.rent_amount))} z kauce</label>` : ''}
    ${hasDep ? `<label class="f">Ponechat si navíc kvůli škodě (Kč)<input id="ret" type="number" inputmode="numeric" min="0" max="${r.deposit_amount}" placeholder="0"></label>
    <label class="f" id="whyw" style="display:none">Důvod<input id="why" placeholder="např. poškozená klouzačka"></label>
    <div class="card" style="background:var(--gsoft);margin:0;padding:12px 14px"><span class="muted">Vracíte zákazníkovi</span><b id="back" style="font-family:var(--head);font-size:28px"></b></div>` : ''}
    <div class="actions"><button class="btn primary" id="ok">Uložit vrácení</button><button class="btn ghost" data-close>Zrušit</button></div>`,
    (el) => {
      const g = (q) => el.querySelector(q);
      const calc = () => {
        if (!hasDep) return null;
        const ded = g('#ded')?.checked ? r.rent_amount : 0, ret = Math.round(+g('#ret').value || 0);
        g('#whyw').style.display = ret > 0 ? 'flex' : 'none';
        const back = r.deposit_amount - ded - ret;
        g('#back').textContent = kc(back); g('#back').style.color = back < 0 ? 'var(--warn)' : '';
        return { ded, ret, back };
      };
      if (hasDep) { g('#ret').addEventListener('input', calc); g('#ded')?.addEventListener('change', calc); calc(); }
      g('#ok').onclick = async () => {
        const f = { status: 'returned', deposit_returned_at: new Date().toISOString(), deposit_retained: 0, deposit_retained_reason: null };
        if (hasDep) {
          const c = calc(), why = g('#why').value.trim();
          if (c.back < 0) return toast('Stržená částka je vyšší než kauce');
          if (c.ret > 0 && !why) return toast('Napište důvod, proč si část necháváte');
          f.deposit_retained = c.ret; f.deposit_retained_reason = c.ret > 0 ? why : null;
          f.deposit_status = c.ret > 0 ? 'partial' : 'returned';
          if (c.ded) { f.paid_status = 'deposit'; f.paid_at = new Date().toISOString(); }
          else if (r.paid_status === 'deposit') { f.paid_status = 'unpaid'; f.paid_at = null; }
        }
        closeSheet();
        if (await patch(r, f, 'Uloženo') && hasDep) mailSheet(r, 'depositOut', 'Poslat vyúčtování kauce');
      };
    });
  },
  unreturn: async (r) => {
    if (!confirm('Vrátit rezervaci zpět do „Půjčeno“? Kauce se vrátí do stavu „u nás“.')) return;
    await patch(r, { status: 'confirmed', deposit_returned_at: null, deposit_retained: 0, deposit_retained_reason: null,
      deposit_status: ['returned', 'partial'].includes(r.deposit_status) ? 'received' : r.deposit_status,
      ...(r.paid_status === 'deposit' ? { paid_status: 'unpaid', paid_at: null } : {}) }, 'Vráceno zpět do půjčeno');
  },
  depFix: (r) => sheet(`<h3>Stav kauce ${esc(kc(r.deposit_amount))}</h3>
    <p class="muted" style="margin:0">Teď: ${{ none: 'kauce nepřijata', received: 'kauce u nás', returned: 'kauce vrácena', partial: 'část kauce zadržena' }[r.deposit_status] || r.deposit_status}</p>
    <div class="choices">
      <button class="btn ghost" data-d="none">Kauce nepřijata</button>
      <button class="btn ghost" data-d="received">Kauce u nás (přijata)</button>
      <button class="btn ghost" data-d="returned">Kauce vrácena celá</button>
    </div>
    <p class="muted" style="margin:6px 0 0;font-weight:600">Nebo část zadržena:</p>
    <label class="f">Kolik zadrženo (Kč)<input id="ret" type="number" inputmode="numeric" min="1" max="${r.deposit_amount}" value="${r.deposit_retained || ''}"></label>
    <label class="f">Důvod<input id="why" value="${esc(r.deposit_retained_reason || '')}"></label>
    <div class="actions"><button class="btn accent" id="part">Uložit jako zadrženou část</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => {
    const now = new Date().toISOString();
    const save = async (st, retained, reason) => {
      closeSheet();
      await patch(r, {
        deposit_status: st, deposit_retained: retained, deposit_retained_reason: reason || null,
        deposit_received_at: st === 'none' ? null : (r.deposit_received_at || now),
        deposit_returned_at: st === 'returned' || st === 'partial' ? (r.deposit_returned_at || now) : null,
      }, 'Uloženo');
    };
    el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => save(b.dataset.d, 0, '')));
    el.querySelector('#part').onclick = () => {
      const v = Math.round(+el.querySelector('#ret').value || 0), w = el.querySelector('#why').value.trim();
      if (v <= 0 || v > r.deposit_amount) return toast('Zadejte částku do výše kauce');
      if (!w) return toast('Napište důvod');
      save('partial', v, w);
    };
  }),
  eet: (r) => eetResSheet(r),
  qr: (r) => qrSheet(r),
  cancel: async (r) => { if (confirm('Zrušit tuto rezervaci?')) await patch(r, { status: 'cancelled' }, 'Zrušeno'); },
  mail: (r) => mailSheet(r, r.status === 'pending' ? 'confirm' : r.deposit_status === 'received' ? 'depositIn' : 'confirm', 'Napsat zákazníkovi'),
  edit: (r) => {
    const opts = S.items.map((i) => `<option value="${i.id}"${i.id === r.item_id ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
    sheet(`<h3>Upravit rezervaci <span class="muted" style="font-size:15px">#${esc(r.code)}</span></h3>
      <label class="f">Co<select id="ei">${opts}</select></label>
      <div style="display:flex;gap:10px"><label class="f" style="flex:1">Od<input id="ef" type="date" value="${r.start_date}"></label><label class="f" style="flex:1">Do<input id="et" type="date" value="${r.end_date}"></label></div>
      <label class="f">Jméno<input id="en" autocomplete="off" value="${esc(r.customer_name)}"></label>
      <label class="f">Telefon<input id="ep" type="tel" value="${esc(r.phone || '')}"></label>
      <label class="f">E-mail<input id="ee" type="email" value="${esc(r.email || '')}"></label>
      <label class="f">Adresa<input id="ea" autocomplete="off" value="${esc(r.address || '')}"></label>
      <label style="display:flex;gap:10px;align-items:center;min-height:44px"><input id="ed" type="checkbox" style="width:20px;height:20px"${r.delivery ? ' checked' : ''}> Dovoz</label>
      <div style="display:flex;gap:10px"><label class="f" style="flex:1">Nájem (Kč)<input id="er" type="number" inputmode="numeric" min="0" value="${r.rent_amount}"></label><label class="f" style="flex:1">Kauce (Kč)<input id="ek" type="number" inputmode="numeric" min="0" value="${r.deposit_amount}"></label></div>
      <label class="f">Poznámka zákazníka<textarea id="eno" style="min-height:80px">${esc(r.note || '')}</textarea></label>
      <p id="esum" class="muted" style="margin:0"></p>
      <div class="actions"><button class="btn primary" id="esave">Uložit změny</button><button class="btn ghost" data-close>Zrušit</button></div>`,
    (el) => {
      const g = (id) => el.querySelector(id);
      let manual = false;
      ['#er', '#ek'].forEach((q) => g(q).addEventListener('input', () => { manual = true; }));
      const check = (recalc) => {
        const it = S.items.find((i) => i.id === g('#ei').value), f = g('#ef').value, to = g('#et').value;
        if (!f || !to || to < f) { g('#esum').textContent = 'Zkontrolujte termín.'; return null; }
        const n = Math.round((pd(to) - pd(f)) / 86400000) + 1;
        if (recalc && !manual) { g('#er').value = n * it.price; g('#ek').value = it.deposit; }
        const clash = S.res.find((x) => x.id !== r.id && x.item_id === it.id && ['pending', 'confirmed'].includes(x.status) && x.start_date <= to && x.end_date >= f);
        g('#esum').innerHTML = `${daysWord(n)}` + (clash ? `<br><span style="color:#8A2E0A;font-weight:700">Pozor, kříží se s rezervací ${esc(clash.customer_name)} (${esc(range(clash))}).</span>` : '');
        return { it, f, to };
      };
      ['#ei', '#ef', '#et'].forEach((q) => g(q).addEventListener('change', () => { if (g('#et').value < g('#ef').value) g('#et').value = g('#ef').value; check(true); }));
      check(false);
      g('#esave').onclick = async () => {
        const c = check(false); if (!c) return;
        const name = g('#en').value.trim(), phone = g('#ep').value.trim();
        if (name.length < 2) return toast('Vyplňte jméno');
        if (phone.length < 6) return toast('Vyplňte telefon');
        const rent = Math.round(+g('#er').value), dep = Math.round(+g('#ek').value);
        if (!(rent >= 0) || !(dep >= 0)) return toast('Zkontrolujte částky');
        closeSheet();
        await patch(r, { item_id: c.it.id, start_date: c.f, end_date: c.to, customer_name: name, phone, email: g('#ee').value.trim() || null,
          address: g('#ea').value.trim() || null, delivery: g('#ed').checked, rent_amount: rent, deposit_amount: dep, note: g('#eno').value.trim() || null }, 'Změny uloženy');
      };
    });
  },
  note: (r) => sheet(`<h3>Poznámka pro sebe</h3><label class="f">Poznámka<textarea id="an" style="min-height:120px">${esc(r.admin_note || '')}</textarea></label>
    <div class="actions"><button class="btn primary" id="sv">Uložit</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => (el.querySelector('#sv').onclick = async () => { closeSheet(); await patch(r, { admin_note: el.querySelector('#an').value }, 'Uloženo'); })),
};

/* ---------- karta rezervace ---------- */
function card(r) {
  const n = nDays(r), t = todayIso();
  const tags = [];
  if (r.status === 'pending') tags.push('<span class="tag new">Nová poptávka</span>');
  if (r.status === 'confirmed') tags.push(r.start_date <= t && r.end_date >= t ? '<span class="tag ok">Právě půjčeno</span>' : r.end_date < t ? '<span class="tag warn">Mělo být vráceno</span>' : '<span class="tag ok">Potvrzeno</span>');
  if (r.status === 'rejected') tags.push('<span class="tag">Odmítnuto</span>');
  if (r.status === 'cancelled') tags.push('<span class="tag">Zrušeno</span>');
  if (r.status === 'returned') tags.push('<span class="tag ok">Vráceno</span>');
  if (r.source === 'phone') tags.push('<span class="tag">Telefonem</span>');
  if (r.delivery) tags.push('<span class="tag warn">Dovoz</span>');
  if (r.status === 'confirmed' || r.status === 'returned') {
    tags.push(r.paid_status === 'unpaid' ? '<span class="tag warn">Nezaplaceno</span>' : `<span class="tag ok">${PAID[r.paid_status]}</span>`);
    if (r.deposit_status === 'received') tags.push('<span class="tag ok">Kauce u nás</span>');
    if (r.deposit_status === 'returned') tags.push('<span class="tag">Kauce vrácena</span>');
    if (r.deposit_status === 'partial') tags.push(`<span class="tag warn">Zadrženo ${kc(r.deposit_retained)}</span>`);
  }
  const er = S.eet[r.id] || [];
  if (er.length) {
    const sum = er.filter((x) => x.status === 'ok').reduce((a, x) => a + Number(x.amount), 0);
    if (er.some((x) => x.status === 'error')) tags.push('<span class="tag warn">EET chyba</span>');
    else if (er.some((x) => x.status === 'pending')) tags.push('<span class="tag warn">EET čeká na odeslání</span>');
    else tags.push(`<span class="tag ok">EET ✓ ${kc(sum)}</span>`);
  }
  let acts = '';
  if (r.status === 'pending') acts = `<button class="btn primary" data-a="confirm">Potvrdit</button><button class="btn danger" data-a="reject">Odmítnout</button>`;
  else if (r.status === 'confirmed') acts =
    `${r.paid_status === 'unpaid' ? '<button class="btn accent" data-a="paid">Zaplaceno</button>' : '<button class="btn ghost" data-a="paid">Platba</button>'}` +
    `${r.deposit_status === 'none' ? '<button class="btn primary" data-a="depIn">Kauce převzata</button>' : '<button class="btn ghost" data-a="depFix">Kauce</button>'}` +
    `<button class="btn ghost" data-a="qr">QR platba</button>` +
    `<button class="btn ghost" data-a="back">Vráceno</button><button class="btn ghost" data-a="cancel">Zrušit</button>`;
  else if (r.status === 'returned') acts = `<button class="btn ghost" data-a="paid">Platba</button><button class="btn ghost" data-a="depFix">Kauce</button><button class="btn accent" data-a="unreturn">Vrátit zpět do půjčeno</button>`;
  const contact = [r.phone && `<a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a>`, r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`].filter(Boolean).join('');
  return `<article class="card" data-id="${r.id}">
    <div class="row"><div><p class="item">${esc(itemName(r.item_id))}</p><div class="dates">${esc(range(r))} <span class="muted" style="font-weight:500">· ${daysWord(n)}</span></div></div><span class="code">#${esc(r.code)}</span></div>
    <div class="who"><b>${esc(r.customer_name)}</b>${contact}</div>
    ${r.address ? `<div class="who"><a href="https://mapy.cz/?q=${encodeURIComponent(r.address)}" target="_blank" rel="noopener">${esc(r.address)}</a></div>` : ''}
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    ${r.admin_note ? `<div class="note" style="background:#FFF4E8">Moje poznámka: ${esc(r.admin_note)}</div>` : ''}
    <div class="tags">${tags.join('')}</div>
    <div class="money"><span>Nájem <b>${kc(r.rent_amount)}</b></span><span>Kauce <b>${kc(r.deposit_amount)}</b></span></div>
    <div class="actions">${acts}${['pending', 'confirmed', 'returned'].includes(r.status) ? '<button class="btn ghost" data-a="edit">Upravit</button>' : ''}<button class="btn ghost" data-a="mail" aria-label="Napsat e-mail">E-mail</button><button class="btn ghost" data-a="note" aria-label="Poznámka">Poznámka</button>${eetOn() && ['confirmed', 'returned'].includes(r.status) ? '<button class="btn ghost" data-a="eet">EET</button>' : ''}</div>
  </article>`;
}

/* ---------- pohledy ---------- */
function viewPoptavky() {
  const list = S.res.filter((r) => r.status === 'pending');
  return `<h2>Nové poptávky</h2>` + (list.length ? list.map(card).join('') : `<div class="empty">Žádná nová poptávka. Až přijde, uvidíte ji tady.</div>`);
}
function viewAktualni() {
  const t = todayIso();
  const list = S.res.filter((r) => r.status === 'confirmed');
  const now = list.filter((r) => r.start_date <= t), next = list.filter((r) => r.start_date > t);
  return `<h2>Půjčeno teď</h2>` + (now.length ? now.map(card).join('') : `<div class="empty">Nic není půjčené.</div>`) +
    `<h2 style="margin-top:28px">Nadcházející</h2>` + (next.length ? next.map(card).join('') : `<div class="empty">Žádné potvrzené rezervace.</div>`);
}
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
/* vrácené rezervace z aplikace se počítají do historie spolu s tabulkou */
function appHist() {
  return S.res.filter((r) => r.status === 'returned').map((r) => {
    const d = pd(r.start_date);
    return { id: r.id, year: d.getFullYear(), month: d.getMonth() + 1, customer_name: r.customer_name, item_id: r.item_id, amount: r.rent_amount, note: r.deposit_retained > 0 ? `Z kauce zadrženo ${kc(r.deposit_retained)}${r.deposit_retained_reason ? ' – ' + r.deposit_retained_reason : ''}` : null, kind: 'rental' };
  }).sort((a, b) => b.year - a.year || b.month - a.month);
}
function viewHistorie() {
  const years = [...new Set(S.hist.concat(appHist()).map((h) => h.year))].sort((a, b) => b - a);
  if (!S.hYear || (S.hYear !== -1 && !years.includes(S.hYear))) S.hYear = years[0] || new Date().getFullYear();
  const q = S.hQ.trim().toLowerCase();
  const all = S.hist.concat(appHist());
  const inYear = S.hYear === -1 ? all : all.filter((h) => h.year === S.hYear);
  const rows = q ? all.filter((h) => h.customer_name.toLowerCase().includes(q) || (h.note || '').toLowerCase().includes(q)) : inYear;
  const sum = (a) => a.reduce((x, h) => x + h.amount, 0);
  const chips = [...years.map((y) => [y, String(y)]), [-1, 'Vše']].map(([k, l]) => `<button data-hy="${k}" aria-pressed="${S.hYear === k}">${l}</button>`).join('');
  const byItem = S.items.map((i) => { const a = inYear.filter((h) => h.item_id === i.id); return { n: i.name, c: a.length, t: sum(a) }; }).filter((x) => x.c).sort((a, b) => b.t - a.t);
  const stats = `<div class="card" style="padding:14px 16px"><div style="display:flex;gap:28px;flex-wrap:wrap"><div><div class="muted">Obrat</div><b style="font-size:20px">${kc(sum(inYear))}</b></div><div><div class="muted">Výpůjček</div><b style="font-size:20px">${inYear.length}</b></div></div>` +
    byItem.map((x) => `<div style="display:flex;justify-content:space-between;margin-top:8px"><span>${esc(x.n)} <span class="muted">(${x.c}×)</span></span><b>${kc(x.t)}</b></div>`).join('') + `</div>`;
  let list = '', last = '';
  (q ? rows : rows).forEach((h) => {
    const key = `${h.year}-${h.month}`;
    if (key !== last) { list += `<h3 style="margin:18px 0 6px;text-transform:capitalize">${MONTHS[h.month - 1]} ${h.year}</h3>`; last = key; }
    list += `<div class="card" style="padding:10px 14px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(h.customer_name)}${h.kind === 'sale' ? ' <span class="muted">(prodej)</span>' : ''}</b><b>${kc(h.amount)}</b></div><div class="muted">${esc(itemName(h.item_id))}</div>${h.note ? `<div class="muted" style="margin-top:4px">${esc(h.note)}</div>` : ''}</div>`;
  });
  return `<div class="seg" style="margin-bottom:10px">${chips}</div><input id="hq" type="search" placeholder="Hledat jméno nebo poznámku…" value="${esc(S.hQ)}" style="width:100%;margin-bottom:12px">` +
    (q ? '' : stats) + (list || `<div class="empty">Nic nenalezeno.</div>`) +
    `<p class="muted" style="margin-top:14px">Starší údaje jsou z tabulky (jen měsíc, bez přesného dne). Vrácené rezervace z aplikace se přičítají sem automaticky.</p>`;
}
function viewArchiv() {
  const f = { vse: () => true, vraceno: (r) => r.status === 'returned', odmitnuto: (r) => r.status === 'rejected' || r.status === 'cancelled' };
  const seg = [['vse', 'Vše'], ['vraceno', 'Vráceno'], ['odmitnuto', 'Zrušeno'], ['historie', 'Historie']].map(([k, l]) => `<button data-seg="${k}" aria-pressed="${S.archive === k}">${l}</button>`).join('');
  if (S.archive === 'historie') return `<h2>Archiv</h2><div class="seg" style="margin-bottom:12px">${seg}</div>` + viewHistorie();
  const list = S.res.filter((r) => ['returned', 'rejected', 'cancelled'].includes(r.status)).filter(f[S.archive]).reverse();
  const year = new Date().getFullYear();
  const sum = S.res.filter((r) => r.status === 'returned' && r.start_date.startsWith(String(year))).reduce((a, r) => a + r.rent_amount, 0);
  return `<h2>Archiv</h2><p class="muted" style="margin:-6px 0 12px">Nájem za rok ${year}: <b style="color:var(--ink)">${kc(sum)}</b></p><div class="seg">${seg}</div>` +
    (list.length ? list.map(card).join('') : `<div class="empty">Zatím prázdné.</div>`);
}
const OV_ST = [['aktivni', 'Aktivní'], ['vse', 'Vše'], ['pending', 'Čeká'], ['confirmed', 'Potvrzeno'], ['returned', 'Vráceno'], ['zruseno', 'Zrušeno']];
function viewPrehled() {
  const o = S.ov;
  const stOk = { aktivni: (r) => ['pending', 'confirmed'].includes(r.status), vse: () => true, pending: (r) => r.status === 'pending', confirmed: (r) => r.status === 'confirmed', returned: (r) => r.status === 'returned', zruseno: (r) => ['rejected', 'cancelled'].includes(r.status) }[o.st];
  const q = o.q.trim().toLowerCase();
  let rows = S.res.filter(stOk).filter((r) => o.item === 'vse' || r.item_id === o.item)
    .filter((r) => !q || [r.customer_name, r.phone, r.email, r.address, r.code, r.note, r.admin_note].some((v) => String(v || '').toLowerCase().includes(q)));
  rows = rows.sort((a, b) => (o.st === 'aktivni' || o.st === 'pending' || o.st === 'confirmed' ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date)));
  const STL = { pending: 'Čeká', confirmed: 'Potvrzeno', returned: 'Vráceno', rejected: 'Odmítnuto', cancelled: 'Zrušeno' };
  const stChips = OV_ST.map(([k, l]) => `<button data-ovst="${k}" aria-pressed="${o.st === k}">${l}</button>`).join('');
  const itChips = [['vse', 'Vše']].concat(S.items.filter((i) => i.active).map((i) => [i.id, i.short_name || i.name])).map(([k, l]) => `<button data-ovit="${k}" aria-pressed="${o.item === k}">${esc(l)}</button>`).join('');
  const live = rows.filter((r) => !['rejected', 'cancelled'].includes(r.status));
  const sum = live.reduce((a, r) => a + r.rent_amount, 0);
  let list = '', last = '';
  rows.forEach((r) => {
    const key = r.start_date.slice(0, 7);
    if (key !== last) { const d = pd(r.start_date); list += `<h3 style="margin:16px 0 6px;text-transform:capitalize">${MONTHS[d.getMonth()]} ${d.getFullYear()}</h3>`; last = key; }
    const cls = r.status === 'pending' ? 'new' : r.status === 'confirmed' ? 'ok' : r.status === 'returned' ? '' : 'warn';
    list += `<button class="card ov" data-open="${r.id}" style="padding:10px 14px;margin-bottom:6px;text-align:left;border:0;width:100%;cursor:pointer;gap:4px">
      <div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(r.customer_name)}</b><b>${kc(r.rent_amount)}</b></div>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(itemName(r.item_id))} · ${esc(range(r))} <span class="muted">(${daysWord(nDays(r))})</span></span><span class="tag ${cls}">${STL[r.status]}</span></div>
      ${r.phone ? `<div class="muted" style="font-size:13px">${esc(r.phone)}${r.delivery ? ' · dovoz' : ''}</div>` : ''}</button>`;
  });
  return `<h2>Přehled</h2><div class="seg">${stChips}</div><div class="seg">${itChips}</div>
    <input id="ovq" type="search" placeholder="Hledat jméno, telefon, e-mail, kód…" value="${esc(o.q)}" style="width:100%;margin-bottom:12px;min-height:44px;border:1.5px solid #CFCAC0;border-radius:12px;padding:0 14px;font:inherit;background:#fff">
    <p class="muted" style="margin:0 2px 8px">Rezervací: <b style="color:var(--ink)">${rows.length}</b> · nájem celkem <b style="color:var(--ink)">${kc(sum)}</b></p>` +
    (list || `<div class="empty">Nic nenalezeno.</div>`);
}
async function loadStats() {
  const { data, error } = await sb.rpc('pj_stats', { p_days: S.statDays });
  if (error) { toast('Statistiky se nenačetly: ' + error.message); return; }
  S.stats = data; if (S.tab === 'navstevy') render();
}
const PAGE_NAMES = { '/': 'Úvod', '/skakaci-hrad': 'Skákací hrad', '/cistic-kobercu': 'Čistič koberců', '/nosic-kol': 'Nosič kol', '/stresni-box': 'Střešní box', '/pricniky': 'Příčníky', '/odvlhcovac': 'Odvlhčovač', '/podminky': 'Podmínky zapůjčení', '/gdpr': 'GDPR', '/404': 'Nenalezeno' };
const DEVS = { mobile: 'Telefon', tablet: 'Tablet', desktop: 'Počítač', '?': 'Neznámé' };
function viewNavstevy() {
  const st = S.stats;
  const chips = [7, 30, 90].map((d) => `<button data-sd="${d}" aria-pressed="${S.statDays === d}">${d} dní</button>`).join('');
  if (!st) { loadStats(); return `<h2>Návštěvnost</h2><div class="seg">${chips}</div><div class="empty">Načítám…</div>`; }
  const delta = (a, b) => (b > 0 ? `<span class="muted" style="font-size:13px">${a >= b ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / b) * 100))} % proti předchozím ${S.statDays} dnům</span>` : '<span class="muted" style="font-size:13px">&nbsp;</span>');
  const tile = (l, v, d) => `<div class="card" style="flex:1;min-width:150px;padding:14px 16px;gap:2px"><span class="muted">${l}</span><b style="font-family:var(--head);font-size:32px">${v}</b>${d}</div>`;
  const max = Math.max(1, ...st.daily.map((x) => x.views));
  const bars = st.daily.map((x) => `<div title="${dmy(x.d)}: ${x.visits} návštěv, ${x.views} zobrazení" style="flex:1;min-width:2px;height:${Math.max(2, Math.round((x.views / max) * 100))}%;background:${x.d === todayIso() ? 'var(--accent)' : 'var(--green)'};border-radius:3px 3px 0 0"></div>`).join('');
  const pageName = (pth) => { const k = pth === '/' ? '/' : pth.replace(/\.html$/, '').replace(/\/$/, ''); return PAGE_NAMES[k] || pth; };
  const list = (rows, name, key, unit) => rows.length ? rows.map((x) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line)"><span>${esc(name(x))}</span><b>${x[key]}${unit || ''}</b></div>`).join('') : '<div class="muted">Zatím nic.</div>';
  const today = st.daily[st.daily.length - 1] || { views: 0, visits: 0 };
  return `<h2>Návštěvnost</h2><div class="seg">${chips}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${tile('Návštěvy', st.visits, delta(st.visits, st.prev_visits))}${tile('Zobrazení stránek', st.views, delta(st.views, st.prev_views))}</div>
    <div class="card"><b>Zobrazení po dnech</b><div style="display:flex;align-items:flex-end;gap:2px;height:110px">${bars}</div>
      <div class="muted" style="display:flex;justify-content:space-between;font-size:12px"><span>${dm(st.daily[0].d)}</span><span>dnes: ${today.visits} návštěv</span></div></div>
    <div class="card"><b>Nejnavštěvovanější stránky</b>${list(st.pages, (x) => pageName(x.path), 'views', '×')}</div>
    <div class="card"><b>Odkud lidé přišli</b>${list(st.refs, (x) => x.ref || 'Přímo / nezjištěno', 'visits', '')}</div>
    <div class="card"><b>Zařízení</b>${list(st.devices, (x) => DEVS[x.device] || x.device, 'visits', '')}</div>
    <p class="muted" style="font-size:13px">Návštěva = jedno otevřené okno prohlížeče. Počítá se anonymně, bez cookies a IP adres. Vaše vlastní návštěvy z tohoto zařízení se nezapočítávají.</p>`;
}
function viewKalendar() {
  const MON = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const SHORT = { hrad: 'Hrad', cistic: 'Čistič', nosic: 'Nosič', box: 'Box', pricniky: 'Příčn.', odvlhcovac: 'Odvlh.' };
  const y = S.calY, m = S.calM, cnt = new Date(y, m + 1, 0).getDate(), t = todayIso();
  const items = S.items.filter((i) => i.active);
  const live = S.res.filter((x) => ['pending', 'confirmed', 'returned'].includes(x.status));
  const first = (s) => esc(String(s).trim().split(/\s+/)[0]).slice(0, 7);
  let rows = '';
  for (let d = 1; d <= cnt; d++) {
    const s = iso(new Date(y, m, d)), dow = new Date(y, m, d).getDay(), we = dow === 0 || dow === 6;
    rows += `<div class="kr${we ? ' we' : ''}${s === t ? ' today' : ''}"><div class="kd"><b>${d}.</b><span>${WD[dow]}</span></div>`;
    for (const it of items) {
      const r = live.find((x) => x.item_id === it.id && x.start_date <= s && x.end_date >= s);
      if (!r) { rows += '<div class="kc"></div>'; continue; }
      const st = r.start_date === s || d === 1, en = r.end_date === s || d === cnt;
      rows += `<button class="kc on ${r.status === 'pending' ? 'p' : r.status === 'returned' ? 'r' : ''}${st ? ' st' : ''}${en ? ' en' : ''}" data-open="${r.id}" aria-label="${esc(it.short_name)} ${d}. – ${esc(r.customer_name)}">${st ? first(r.customer_name) : ''}</button>`;
    }
    rows += '</div>';
  }
  const head = `<div class="kr kh"><div class="kd"></div>${items.map((it) => `<div class="kc">${esc(SHORT[it.id] || it.short_name)}</div>`).join('')}</div>`;
  const monthRes = live.filter((x) => x.start_date <= iso(new Date(y, m, cnt)) && x.end_date >= iso(new Date(y, m, 1)));
  return `<div class="cal-wrap">
    <div class="cal-nav"><button data-cal="-1" aria-label="Předchozí měsíc">‹</button><b>${MON[m]} ${y}</b><button data-cal="1" aria-label="Další měsíc">›</button></div>
    <div class="kgrid" style="--n:${items.length}">${head}${rows}</div>
    <p class="muted" style="font-size:12px;margin:8px 0 0;display:flex;gap:14px;flex-wrap:wrap"><span><i class="lg" style="background:#1F4D3A"></i>potvrzeno</span><span><i class="lg" style="background:#FF7A3D"></i>čeká</span><span><i class="lg" style="background:#9DB5A8"></i>vráceno</span><span>Klepnutím otevřete</span></p></div>
    <p class="muted" style="margin:10px 2px 0;font-size:13px">Tento měsíc: <b style="color:var(--ink)">${monthRes.length}</b> rezervací</p>`;
}

/* ---------- nová rezervace (telefonem) ---------- */
function newRes() {
  const opts = S.items.filter((i) => i.active).map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  const t = todayIso();
  sheet(`<h3>Nová rezervace</h3>
    <label class="f">Co<select id="ni">${opts}</select></label>
    <div style="display:flex;gap:10px"><label class="f" style="flex:1">Od<input id="nf" type="date" value="${t}"></label><label class="f" style="flex:1">Do<input id="nt" type="date" value="${t}"></label></div>
    <label class="f">Jméno<input id="nn" autocomplete="off"></label>
    <label class="f">Telefon<input id="np" type="tel"></label>
    <label class="f">E-mail (nepovinné)<input id="ne" type="email"></label>
    <label class="f">Adresa (nepovinné)<input id="na" autocomplete="off"></label>
    <label style="display:flex;gap:10px;align-items:center;min-height:44px"><input id="nd" type="checkbox" style="width:20px;height:20px"> Dovoz</label>
    <label class="f">Poznámka<textarea id="nno" style="min-height:80px"></textarea></label>
    <p id="nsum" class="muted" style="margin:0"></p>
    <div class="actions"><button class="btn primary" id="nsave">Uložit jako potvrzenou</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => {
    const g = (id) => el.querySelector(id);
    const calc = () => {
      const it = S.items.find((i) => i.id === g('#ni').value); const f = g('#nf').value, to = g('#nt').value;
      if (!f || !to || to < f) { g('#nsum').textContent = 'Zkontrolujte termín.'; return null; }
      const n = Math.round((pd(to) - pd(f)) / 86400000) + 1;
      const clash = S.res.find((x) => x.item_id === it.id && ['pending', 'confirmed'].includes(x.status) && x.start_date <= to && x.end_date >= f);
      g('#nsum').innerHTML = `${daysWord(n)} · nájem <b>${kc(n * it.price)}</b> · kauce <b>${kc(it.deposit)}</b>` + (clash ? `<br><span style="color:#8A2E0A;font-weight:700">Pozor, kříží se s rezervací ${esc(clash.customer_name)} (${esc(range(clash))}).</span>` : '');
      return { it, f, to, n };
    };
    ['#ni', '#nf', '#nt'].forEach((s) => g(s).addEventListener('change', () => { if (g('#nt').value < g('#nf').value) g('#nt').value = g('#nf').value; calc(); }));
    calc();
    g('#nsave').onclick = async () => {
      const c = calc(); if (!c) return;
      if (g('#nn').value.trim().length < 2 || g('#np').value.trim().length < 6) return toast('Vyplňte jméno a telefon');
      const { data, error } = await sb.from('pj_reservations').insert({
        item_id: c.it.id, start_date: c.f, end_date: c.to, customer_name: g('#nn').value.trim(), phone: g('#np').value.trim(),
        email: g('#ne').value.trim() || null, address: g('#na').value.trim() || null, note: g('#nno').value.trim() || null, delivery: g('#nd').checked, source: 'phone',
        status: 'confirmed', rent_amount: c.n * c.it.price, deposit_amount: c.it.deposit,
      }).select().single();
      if (error) return toast('Uložení se nepovedlo: ' + error.message);
      S.res.push(data); S.res.sort((a, b) => a.start_date.localeCompare(b.start_date));
      closeSheet(); S.tab = 'aktualni'; render(); toast('Rezervace uložena');
    };
  });
}

/* ---------- render ---------- */
const ICONS = {
  poptavky: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H5.2L4 17.5z"/><path d="M8 9h8M8 12h5"/></svg>',
  aktualni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/></svg>',
  prehled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  kalendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  navstevy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  archiv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/></svg>',
};
function render() {
  const pending = S.res.filter((r) => r.status === 'pending').length;
  const views = { poptavky: viewPoptavky, aktualni: viewAktualni, prehled: viewPrehled, navstevy: viewNavstevy, kalendar: viewKalendar, archiv: viewArchiv };
  const tabs = [['poptavky', 'Poptávky'], ['aktualni', 'Půjčeno'], ['prehled', 'Přehled'], ['kalendar', 'Kalendář'], ['archiv', 'Archiv'], ['navstevy', 'Návštěvy']]
    .map(([k, l]) => `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ICONS[k]}${l}${k === 'poptavky' && pending ? `<span class="badge">${pending}</span>` : ''}</button>`).join('');
  app.innerHTML = `<header class="top"><h1>Půjčovna Žďár</h1><button id="eetb" aria-label="Nastavení EET">EET</button><button id="rf" aria-label="Obnovit">Obnovit</button><button id="lo">Odhlásit</button></header>
    <main>${S.tab === 'poptavky' ? pushBanner() : ''}${views[S.tab]()}</main>
    <button class="fab" id="add"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Rezervace</button>
    <nav class="tabs">${tabs}</nav>`;
  document.title = (pending ? `(${pending}) ` : '') + 'Správa – Půjčovna Žďár';
  document.body.classList.toggle('cal', S.tab === 'kalendar');
}
app.addEventListener('input', (e) => {
  if (e.target.id !== 'hq' && e.target.id !== 'ovq') return;
  const id = e.target.id; if (id === 'hq') S.hQ = e.target.value; else S.ov.q = e.target.value;
  const pos = e.target.selectionStart; render();
  const el = document.getElementById(id); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
});
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button,[data-open]'); if (!b) return;
  if (b.dataset.sd) { S.statDays = +b.dataset.sd; S.stats = null; render(); return; }
  if (b.dataset.tab) { S.tab = b.dataset.tab; if (S.tab === 'navstevy') S.stats = null; render(); scrollTo(0, 0); return; }
  if (b.dataset.seg) { S.archive = b.dataset.seg; render(); return; }
  if (b.dataset.ovst) { S.ov.st = b.dataset.ovst; render(); return; }
  if (b.dataset.ovit) { S.ov.item = b.dataset.ovit; render(); return; }
  if (b.dataset.hy) { S.hYear = +b.dataset.hy; render(); return; }
  if (b.dataset.cal) { S.calM += +b.dataset.cal; if (S.calM < 0) { S.calM = 11; S.calY--; } if (S.calM > 11) { S.calM = 0; S.calY++; } render(); return; }
  if (b.dataset.open) {
    const r = S.res.find((x) => x.id === b.dataset.open);
    if (r) sheet(card(r).replace('<article class="card"', '<article class="card" style="padding:0"') + '<button class="btn ghost" data-close>Zavřít</button>',
      (el) => el.addEventListener('click', (ev) => { const a = ev.target.closest('[data-a]'); if (a) { closeSheet(); ACT[a.dataset.a](r); } }));
    return;
  }
  if (b.id === 'eetb') return eetSettings();
  if (b.id === 'pushOn') return pushOn();
  if (b.id === 'add') return newRes();
  if (b.id === 'rf') { await load(); render(); toast('Aktualizováno'); return; }
  if (b.id === 'lo') { await sb.auth.signOut(); return boot(); }
  if (b.dataset.a) { const r = S.res.find((x) => x.id === b.closest('[data-id]').dataset.id); if (r) ACT[b.dataset.a](r); }
});

boot();
