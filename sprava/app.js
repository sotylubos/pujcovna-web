import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

const SB_URL = 'https://bnckyiveqebzzzxuoluj.supabase.co';
const SB_KEY = 'sb_publishable_9-08pVFy82_mNy3rRVh-6w_gUZwOe3I';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, storageKey: 'pj-sprava-auth', detectSessionInUrl: true, flowType: 'pkce' } });

const FIRM = { name: 'Půjčovna Žďár', owner: 'Lubomír Šotek', ico: '71391134', addr: 'Světnov 201, 591 02 Žďár nad Sázavou', phone: '+420 777 097 902', email: 'info@pujcovna-zdar.cz' };
const app = document.getElementById('app');
const S = { tab: 'poptavky', items: [], res: [], calY: 0, calM: 0, archive: 'vse', user: null, settings: {} };

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
const PAID = { unpaid: 'Nezaplaceno', cash: 'Zaplaceno hotově', qr_onsite: 'Zaplaceno QR na místě', transfer: 'Zaplaceno převodem' };

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
  const n = new Date(); S.calY = n.getFullYear(); S.calM = n.getMonth();
  await load();
  render();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load().then(render); });
}
function loginView() {
  app.innerHTML = `<div class="login">
    <svg width="64" height="64" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#1F4D3A"/><g transform="translate(8 8)" fill="none" stroke="#FF7A3D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></g></svg>
    <h2>Správa půjčovny</h2><p class="muted">Přihlaste se Google účtem.</p>
    <button class="btn primary" style="flex:none;padding:0 28px" id="g">Přihlásit přes Google</button></div>`;
  document.getElementById('g').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/sprava/' } });
}

/* ---------- data ---------- */
async function load() {
  const since = iso(new Date(Date.now() - 400 * 86400000));
  const [it, rs, st] = await Promise.all([
    sb.from('pj_items').select('*').order('sort'),
    sb.from('pj_reservations').select('*').gte('end_date', since).order('start_date'),
    sb.from('pj_settings').select('key,value'),
  ]);
  if (!st.error) { S.settings = {}; st.data.forEach((x) => (S.settings[x.key] = x.value)); }
  if (it.error || rs.error) { toast('Načtení se nepovedlo'); return; }
  S.items = it.data; S.res = rs.data;
}
async function patch(r, fields, msg) {
  const { data, error } = await sb.from('pj_reservations').update(fields).eq('id', r.id).select().single();
  if (error) { toast('Uložení se nepovedlo: ' + error.message); return null; }
  Object.assign(r, data); render(); if (msg) toast(msg); return r;
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
    body: `Dobrý den,\n\npotvrzujeme, že jsme dne ${nowCz()} od Vás převzali vratnou kauci ve výši ${kc(r.deposit_amount)}.\n\nZapůjčeno: ${itemName(r.item_id)}\nTermín: ${dmy(r.start_date)}${r.end_date !== r.start_date ? ' – ' + dmy(r.end_date) : ''}\nČíslo rezervace: ${r.code}\n\nKauci Vám vrátíme při vrácení zapůjčené věci v pořádku.` + sign + `\nIČ ${FIRM.ico}, ${FIRM.addr}`,
  }),
  depositOut: (r) => ({
    subject: `Vrácení kauce – rezervace ${r.code}`,
    body: `Dobrý den,\n\nděkujeme za vrácení: ${itemName(r.item_id)}.\n\n` + (r.deposit_retained > 0
      ? `Z kauce ${kc(r.deposit_amount)} jsme Vám dne ${nowCz()} vrátili ${kc(r.deposit_amount - r.deposit_retained)}. Částku ${kc(r.deposit_retained)} jsme si ponechali z důvodu: ${r.deposit_retained_reason || '[doplňte]'}.`
      : `Potvrzujeme, že jsme Vám dne ${nowCz()} vrátili celou kauci ${kc(r.deposit_amount)}.`) + `\n\nBudeme rádi, když se zase ozvete.` + sign + `\nIČ ${FIRM.ico}, ${FIRM.addr}`,
  }),
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
  const opts = [['dep', 'Kauce', r.deposit_amount], ['rent', 'Nájem', r.rent_amount], ['both', 'Nájem + kauce', r.rent_amount + r.deposit_amount]];
  if (!start) start = r.deposit_status === 'none' ? 'dep' : 'rent';
  sheet(`<h3>QR platba</h3>
    <div class="seg" id="qs">${opts.map(([k, l, a]) => `<button data-q="${k}" aria-pressed="${k === start}">${l} · ${kc(a)}</button>`).join('')}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <img id="qimg" alt="QR kód k zaplacení" style="width:min(78vw,340px);height:auto;image-rendering:pixelated;background:#fff">
      <b id="qamt" style="font-family:var(--head);font-size:30px"></b>
      <span class="muted" style="font-size:14px">${esc(itemName(r.item_id))} · #${esc(r.code)} · účet ${esc(S.settings.account)}</span>
    </div>
    <div class="actions"><button class="btn primary" id="qpaid">Zaplaceno</button><button class="btn ghost" id="qacc">Změnit účet</button><button class="btn ghost" data-close>Zavřít</button></div>`,
  (el) => {
    let cur = opts.find((o) => o[0] === start) || opts[0];
    const draw = async () => {
      const spd = `SPD*1.0*ACC:${toIban(S.settings.account)}*AM:${cur[2].toFixed(2)}*CC:CZK*MSG:${ascii('Pujcovna Zdar ' + r.code + ' ' + cur[1]).slice(0, 60)}`;
      el.querySelector('#qimg').src = await QRCode.toDataURL(spd, { margin: 2, width: 640, errorCorrectionLevel: 'M' });
      el.querySelector('#qamt').textContent = kc(cur[2]);
      el.querySelectorAll('[data-q]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.q === cur[0]));
    };
    el.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { cur = opts.find((o) => o[0] === b.dataset.q); draw(); }));
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
  back: (r) => sheet(`<h3>Vráceno: ${esc(itemName(r.item_id))}</h3>
    <p style="margin:0">Kauce ${esc(kc(r.deposit_amount))}</p>
    <div class="choices"><button class="btn primary" id="full">Vrátit celou kauci</button></div>
    <p class="muted" style="margin:6px 0 0;font-weight:600">Nebo si část nechat:</p>
    <label class="f">Kolik si necháte (Kč)<input id="ret" type="number" inputmode="numeric" min="0" max="${r.deposit_amount}"></label>
    <label class="f">Důvod<input id="why" placeholder="např. poškozená klouzačka"></label>
    <div class="actions"><button class="btn accent" id="part">Uložit a vrátit zbytek</button><button class="btn ghost" data-close>Zrušit</button></div>`,
  (el) => {
    const done = async (retained, reason) => {
      closeSheet();
      const f = { status: 'returned', deposit_returned_at: new Date().toISOString(), deposit_retained: retained, deposit_retained_reason: reason || null,
        deposit_status: r.deposit_status === 'none' ? 'none' : retained > 0 ? 'partial' : 'returned' };
      if (await patch(r, f, 'Uloženo') && r.deposit_status !== 'none') mailSheet(r, 'depositOut', 'Poslat potvrzení o vrácení kauce');
    };
    el.querySelector('#full').onclick = () => done(0, '');
    el.querySelector('#part').onclick = () => {
      const v = Math.round(+el.querySelector('#ret').value || 0), w = el.querySelector('#why').value.trim();
      if (v <= 0 || v > r.deposit_amount) return toast('Zadejte částku do výše kauce');
      if (!w) return toast('Napište důvod');
      done(v, w);
    };
  }),
  qr: (r) => qrSheet(r),
  cancel: async (r) => { if (confirm('Zrušit tuto rezervaci?')) await patch(r, { status: 'cancelled' }, 'Zrušeno'); },
  mail: (r) => mailSheet(r, r.status === 'pending' ? 'confirm' : r.deposit_status === 'received' ? 'depositIn' : 'confirm', 'Napsat zákazníkovi'),
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
  let acts = '';
  if (r.status === 'pending') acts = `<button class="btn primary" data-a="confirm">Potvrdit</button><button class="btn danger" data-a="reject">Odmítnout</button>`;
  else if (r.status === 'confirmed') acts =
    `${r.paid_status === 'unpaid' ? '<button class="btn accent" data-a="paid">Zaplaceno</button>' : '<button class="btn ghost" data-a="paid">Platba</button>'}` +
    `${r.deposit_status === 'none' ? '<button class="btn primary" data-a="depIn">Kauce převzata</button>' : ''}` +
    `<button class="btn ghost" data-a="qr">QR platba</button>` +
    `<button class="btn ghost" data-a="back">Vráceno</button><button class="btn ghost" data-a="cancel">Zrušit</button>`;
  const contact = [r.phone && `<a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a>`, r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`].filter(Boolean).join('');
  return `<article class="card" data-id="${r.id}">
    <div class="row"><div><p class="item">${esc(itemName(r.item_id))}</p><div class="dates">${esc(range(r))} <span class="muted" style="font-weight:500">· ${daysWord(n)}</span></div></div><span class="code">#${esc(r.code)}</span></div>
    <div class="who"><b>${esc(r.customer_name)}</b>${contact}</div>
    ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    ${r.admin_note ? `<div class="note" style="background:#FFF4E8">Moje poznámka: ${esc(r.admin_note)}</div>` : ''}
    <div class="tags">${tags.join('')}</div>
    <div class="money"><span>Nájem <b>${kc(r.rent_amount)}</b></span><span>Kauce <b>${kc(r.deposit_amount)}</b></span></div>
    <div class="actions">${acts}<button class="btn ghost" data-a="mail" aria-label="Napsat e-mail">E-mail</button><button class="btn ghost" data-a="note" aria-label="Poznámka">Poznámka</button></div>
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
function viewArchiv() {
  const f = { vse: () => true, vraceno: (r) => r.status === 'returned', odmitnuto: (r) => r.status === 'rejected' || r.status === 'cancelled' };
  const list = S.res.filter((r) => ['returned', 'rejected', 'cancelled'].includes(r.status)).filter(f[S.archive]).reverse();
  const seg = [['vse', 'Vše'], ['vraceno', 'Vráceno'], ['odmitnuto', 'Odmítnuto a zrušeno']].map(([k, l]) => `<button data-seg="${k}" aria-pressed="${S.archive === k}">${l}</button>`).join('');
  const year = new Date().getFullYear();
  const sum = S.res.filter((r) => r.status === 'returned' && r.start_date.startsWith(String(year))).reduce((a, r) => a + r.rent_amount, 0);
  return `<h2>Archiv</h2><p class="muted" style="margin:-6px 0 12px">Nájem za rok ${year}: <b style="color:var(--ink)">${kc(sum)}</b></p><div class="seg">${seg}</div>` +
    (list.length ? list.map(card).join('') : `<div class="empty">Zatím prázdné.</div>`);
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
  return `<h2>Kalendář</h2><div class="cal-wrap">
    <div class="cal-nav"><button data-cal="-1" aria-label="Předchozí měsíc">‹</button><b>${MON[m]} ${y}</b><button data-cal="1" aria-label="Další měsíc">›</button></div>
    <div class="kgrid" style="--n:${items.length}">${head}${rows}</div>
    <p class="muted" style="font-size:13px;margin:12px 0 0;display:flex;gap:14px;flex-wrap:wrap"><span><i class="lg" style="background:#1F4D3A"></i>potvrzeno</span><span><i class="lg" style="background:#FF7A3D"></i>čeká</span><span><i class="lg" style="background:#9DB5A8"></i>vráceno</span><span>Klepnutím otevřete</span></p></div>
    <p class="muted" style="margin:14px 2px 0">Tento měsíc: <b style="color:var(--ink)">${monthRes.length}</b> rezervací</p>`;
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
        email: g('#ne').value.trim() || null, note: g('#nno').value.trim() || null, delivery: g('#nd').checked, source: 'phone',
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
  kalendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  archiv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/></svg>',
};
function render() {
  const pending = S.res.filter((r) => r.status === 'pending').length;
  const views = { poptavky: viewPoptavky, aktualni: viewAktualni, kalendar: viewKalendar, archiv: viewArchiv };
  const tabs = [['poptavky', 'Poptávky'], ['aktualni', 'Půjčeno'], ['kalendar', 'Kalendář'], ['archiv', 'Archiv']]
    .map(([k, l]) => `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ICONS[k]}${l}${k === 'poptavky' && pending ? `<span class="badge">${pending}</span>` : ''}</button>`).join('');
  app.innerHTML = `<header class="top"><h1>Půjčovna Žďár</h1><button id="rf" aria-label="Obnovit">Obnovit</button><button id="lo">Odhlásit</button></header>
    <main>${views[S.tab]()}</main>
    <button class="fab" id="add"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Rezervace</button>
    <nav class="tabs">${tabs}</nav>`;
  document.title = (pending ? `(${pending}) ` : '') + 'Správa – Půjčovna Žďár';
}
app.addEventListener('click', async (e) => {
  const b = e.target.closest('button,[data-open]'); if (!b) return;
  if (b.dataset.tab) { S.tab = b.dataset.tab; render(); scrollTo(0, 0); return; }
  if (b.dataset.seg) { S.archive = b.dataset.seg; render(); return; }
  if (b.dataset.cal) { S.calM += +b.dataset.cal; if (S.calM < 0) { S.calM = 11; S.calY--; } if (S.calM > 11) { S.calM = 0; S.calY++; } render(); return; }
  if (b.dataset.open) {
    const r = S.res.find((x) => x.id === b.dataset.open);
    if (r) sheet(card(r).replace('<article class="card"', '<article class="card" style="padding:0"') + '<button class="btn ghost" data-close>Zavřít</button>',
      (el) => el.addEventListener('click', (ev) => { const a = ev.target.closest('[data-a]'); if (a) { closeSheet(); ACT[a.dataset.a](r); } }));
    return;
  }
  if (b.id === 'add') return newRes();
  if (b.id === 'rf') { await load(); render(); toast('Aktualizováno'); return; }
  if (b.id === 'lo') { await sb.auth.signOut(); return boot(); }
  if (b.dataset.a) { const r = S.res.find((x) => x.id === b.closest('[data-id]').dataset.id); if (r) ACT[b.dataset.a](r); }
});

boot();
