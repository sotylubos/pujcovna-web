// Půjčovna Žďár – evidence tržeb (EET 2.0).
// Akce: status, cert (nahrání pokladního certifikátu), test (ověřovací mód), sync (dorovnání tržeb rezervace), retry, manual.
import forge from 'npm:node-forge@1.3.1';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { buildEnvelope, URLS, SOAP_ACTION, parseResponse, uuid4, money, isoTz } from './eet-core.js';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const db = createClient(SB_URL, SRK, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const PG_ZIP = 'https://eet.gov.cz/assets/cs/cmsmedia/pro-vyvojare/CAEET_Playground_2026_v1.zip';
const ID_POKL = 'SPRAVA1';

/* ---------- šifrování certifikátu v databázi (klíč odvozen z tajného klíče projektu) ---------- */
const b64e = (u: Uint8Array) => { let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let aes: CryptoKey | null = null;
async function key() {
  if (!aes) {
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pj-eet-cert:' + SRK));
    aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  return aes;
}
async function enc(o: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(o))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64e(out);
}
async function dec(s: string) {
  const u = b64d(s);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await key(), u.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---------- pokladní certifikát (.p12) ---------- */
type Cert = { key: forge.pki.rsa.PrivateKey; certB64: string; eic: string; subject: string; validTo: Date };
function parseP12(p12b64: string, pass: string): Cert {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(p12b64)), pass);
  const keys = [...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []), ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])];
  const certs = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const k = keys[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!k) throw new Error('V souboru chybí soukromý klíč');
  const c = certs.map((b) => b.cert!).find((x) => (x.publicKey as forge.pki.rsa.PublicKey).n.equals(k.n));
  if (!c) throw new Error('V souboru chybí certifikát k soukromému klíči');
  const cn = String(c.subject.getField('CN')?.value || '');
  if (!/^CZ[0-9]{8,10}$/.test(cn)) throw new Error('Certifikát nevypadá jako pokladní certifikát EET (CN = ' + cn + ')');
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes();
  return { key: k, certB64: forge.util.encode64(der), eic: cn, subject: c.subject.attributes.map((a) => `${a.shortName || a.name}=${a.value}`).join(', '), validTo: c.validity.notAfter };
}
const cache: Record<string, Cert> = {};
async function playgroundTestCert(): Promise<Cert> {
  const r = await fetch(PG_ZIP); if (!r.ok) throw new Error('Testovací certifikát se nepodařilo stáhnout');
  const files = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const name = Object.keys(files).find((n) => /CZ8551015704\.p12$/.test(n))!;
  const pass = strFromU8(files[Object.keys(files).find((n) => /password.*\.txt$/.test(n))!]).trim();
  return parseP12(b64e(files[name]), pass);
}
async function getCert(env: string): Promise<Cert> {
  if (cache[env]) return cache[env];
  const { data } = await db.from('pj_eet_cert').select('enc').eq('env', env).maybeSingle();
  if (data) { const o = await dec(data.enc); return (cache[env] = parseP12(o.p12, o.pass)); }
  if (env === 'playground') return (cache[env] = await playgroundTestCert());
  throw new Error('Chybí pokladní certifikát. Nahrajte ho v nastavení EET.');
}

/* ---------- nastavení ---------- */
async function settings() {
  const { data } = await db.from('pj_settings').select('key,value').in('key', ['eet_mode', 'eet_jednotka', 'eet_since']);
  const s: Record<string, string> = {}; (data || []).forEach((x) => (s[x.key] = x.value));
  return { mode: s.eet_mode || 'off', jednotka: s.eet_jednotka || '', since: s.eet_since || new Date().toISOString() };
}

/* ---------- odeslání jedné zprávy ---------- */
async function post(env: string, cert: Cert, hlavicka: Record<string, string | undefined>, data: Record<string, string | undefined>) {
  const xml = await buildEnvelope({
    hlavicka, data, certB64: cert.certB64,
    sha256b64: async (s: string) => b64e(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))),
    signB64: async (s: string) => { const md = forge.md.sha256.create(); md.update(s, 'utf8'); return forge.util.encode64(cert.key.sign(md)); },
  });
  const r = await fetch(URLS[env as 'playground' | 'prod'], { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${SOAP_ACTION}"` }, body: xml, signal: AbortSignal.timeout(12000) });
  const text = await r.text();
  return { http: r.status, ...parseResponse(text), raw: text.slice(0, 1500) };
}
type Row = { id: number; amount: number; porad_cis: string; dat_trzby: string; attempts: number; env: string };
async function sendRow(row: Row, jednotka: string) {
  const cert = await getCert(row.env);
  const uuid = uuid4();
  let upd: Record<string, unknown> = { attempts: row.attempts + 1, last_uuid: uuid };
  try {
    const res = await post(row.env, cert, { uuid_zpravy: uuid, dat_odesl: isoTz(new Date()), prvni_zaslani: row.attempts === 0 ? 'true' : 'false' },
      { eic_popl: cert.eic, id_jednotky: jednotka, id_pokl: ID_POKL, porad_cis: row.porad_cis, dat_trzby: isoTz(row.dat_trzby), celk_trzba: money(row.amount) });
    if (res.pok) upd = { ...upd, status: 'ok', pok: res.pok, error: null, warnings: res.warnings.length ? res.warnings : null, sent_at: new Date().toISOString() };
    else if (res.kod !== null && res.kod > 0) upd = { ...upd, status: 'error', error: `Chyba ${res.kod}: ${res.chyba || ''}`.trim() };
    else upd = { ...upd, status: 'pending', error: res.kod === -1 ? 'Dočasná chyba serveru, zkusí se znovu' : `Neočekávaná odpověď (HTTP ${res.http}) ${res.fault || ''}`.trim() };
  } catch (e) {
    upd = { ...upd, status: 'pending', error: 'Nepodařilo se spojit: ' + ((e as Error).message || e) };
  }
  const { data } = await db.from('pj_eet').update(upd).eq('id', row.id).select().single();
  return data;
}

/* ---------- akce ---------- */
async function isAdmin(req: Request) {
  const auth = req.headers.get('Authorization'); if (!auth) return false;
  const u = createClient(SB_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await u.rpc('pj_is_admin'); return data === true;
}
const certInfo = async (env: string) => {
  const { data } = await db.from('pj_eet_cert').select('eic,subject,valid_to,uploaded_at').eq('env', env).maybeSingle();
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!(await isAdmin(req))) return json({ error: 'Bez oprávnění' }, 403);
    const b = await req.json().catch(() => ({}));
    const s = await settings();

    if (b.action === 'status') return json({ settings: s, cert: { prod: await certInfo('prod'), playground: await certInfo('playground') } });

    if (b.action === 'cert') {
      const env = b.env === 'playground' ? 'playground' : 'prod';
      const c = parseP12(String(b.p12 || ''), String(b.password || ''));
      await db.from('pj_eet_cert').upsert({ env, enc: await enc({ p12: b.p12, pass: b.password }), eic: c.eic, subject: c.subject, valid_to: c.validTo.toISOString(), uploaded_at: new Date().toISOString() });
      delete cache[env];
      return json({ ok: true, eic: c.eic, valid_to: c.validTo });
    }

    if (b.action === 'test') {
      const env = b.env === 'playground' ? 'playground' : 'prod';
      if (!s.jednotka) return json({ ok: false, message: 'Nejdřív vyplňte číslo evidenční jednotky.' });
      const cert = await getCert(env);
      const res = await post(env, cert, { uuid_zpravy: uuid4(), dat_odesl: isoTz(new Date()), prvni_zaslani: 'true', overeni: 'true' },
        { eic_popl: cert.eic, id_jednotky: s.jednotka, id_pokl: ID_POKL, porad_cis: 'TEST' + Date.now(), dat_trzby: isoTz(new Date()), celk_trzba: '1.00' });
      return json({ ok: res.kod === 0, kod: res.kod, message: res.chyba || res.fault || null, warnings: res.warnings, eic: cert.eic, http: res.http, raw: res.kod === 0 ? undefined : res.raw });
    }

    if (s.mode === 'off') return json({ ok: true, off: true, rows: [] });
    if (!s.jednotka) return json({ ok: false, message: 'Chybí číslo evidenční jednotky v nastavení EET.' });

    if (b.action === 'sync') {
      const { data: plan, error } = await db.rpc('pj_eet_plan', { p_res: b.reservation_id, p_env: s.mode, p_since: s.since });
      if (error) throw error;
      const out = []; for (const r of plan || []) out.push(await sendRow(r, s.jednotka));
      const { data: rows } = await db.from('pj_eet').select('*').eq('reservation_id', b.reservation_id).eq('env', s.mode).order('id');
      return json({ ok: true, sent: out, rows });
    }

    if (b.action === 'manual') {
      const amount = Math.round(Number(b.amount) * 100) / 100;
      if (!amount) return json({ ok: false, message: 'Zadejte částku' });
      const { data: r, error } = await db.from('pj_eet').insert({ reservation_id: b.reservation_id || null, kind: 'manual', env: s.mode, amount, note: b.note || null }).select().single();
      if (error) throw error;
      return json({ ok: true, row: await sendRow(r, s.jednotka) });
    }

    if (b.action === 'retry') {
      const { data: rows } = await db.from('pj_eet').select('*').eq('env', s.mode).eq('status', 'pending').lt('attempts', 100).order('id').limit(30);
      const out = []; for (const r of rows || []) out.push(await sendRow(r, s.jednotka));
      return json({ ok: true, sent: out });
    }

    return json({ error: 'Neznámá akce' }, 400);
  } catch (e) {
    return json({ ok: false, message: (e as Error).message || String(e) }, 200);
  }
});
