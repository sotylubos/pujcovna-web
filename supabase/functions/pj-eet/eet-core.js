// EET 2.0 – sestavení a podpis datové zprávy (SOAP 1.1, WS-Security, exc-c14n, RSA-SHA256).
// Výstup musí přesně odpovídat kanonizaci, kterou ověřuje server finanční správy.

export const NS = {
  soapenv: 'http://schemas.xmlsoap.org/soap/envelope/',
  v4: 'http://fs.gov.cz/eet/schema/v4',
  wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  ec: 'http://www.w3.org/2001/10/xml-exc-c14n#',
};
const X509 = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3';
const B64 = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary';

export const URLS = {
  playground: 'https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4',
  prod: 'https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4',
};
export const SOAP_ACTION = 'http://fs.gov.cz/eet/OdeslaniTrzby';

// escapování hodnot atributů podle C14N
const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
// nekvalifikované atributy seřazené podle názvu (C14N), prázdné hodnoty se vynechají
const attrs = (o) => Object.keys(o).filter((k) => o[k] !== undefined && o[k] !== null && o[k] !== '').sort().map((k) => ` ${k}="${attr(o[k])}"`).join('');

/** Kanonická podoba soapenv:Body (exc-c14n, InclusiveNamespaces PrefixList="v4"). */
export function bodyCanon(bodyId, hlavicka, data) {
  return `<soapenv:Body xmlns:soapenv="${NS.soapenv}" xmlns:v4="${NS.v4}" xmlns:wsu="${NS.wsu}" wsu:Id="${attr(bodyId)}">` +
    `<v4:Trzba><v4:Hlavicka${attrs(hlavicka)}></v4:Hlavicka><v4:Data${attrs(data)}></v4:Data></v4:Trzba></soapenv:Body>`;
}

/** Kanonická podoba ds:SignedInfo (exc-c14n, InclusiveNamespaces PrefixList="soapenv v4"). */
export function signedInfoCanon(bodyId, digestB64) {
  return `<ds:SignedInfo xmlns:ds="${NS.ds}" xmlns:soapenv="${NS.soapenv}" xmlns:v4="${NS.v4}">` +
    `<ds:CanonicalizationMethod Algorithm="${NS.ec}"><ec:InclusiveNamespaces xmlns:ec="${NS.ec}" PrefixList="soapenv v4"></ec:InclusiveNamespaces></ds:CanonicalizationMethod>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></ds:SignatureMethod>` +
    `<ds:Reference URI="#${attr(bodyId)}"><ds:Transforms><ds:Transform Algorithm="${NS.ec}"><ec:InclusiveNamespaces xmlns:ec="${NS.ec}" PrefixList="v4"></ec:InclusiveNamespaces></ds:Transform></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></ds:DigestMethod><ds:DigestValue>${digestB64}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
}

/**
 * Sestaví podepsanou zprávu.
 * sha256b64(str) -> base64 digest UTF-8 řetězce; signB64(str) -> base64 RSA-SHA256 podpis; certB64 = DER certifikátu v base64.
 * Elementy mimo Body/SignedInfo se nepodepisují; podepsané části vkládáme přímo v kanonickém tvaru,
 * takže jejich kanonizace na straně serveru dá stejný výsledek.
 */
export async function buildEnvelope({ hlavicka, data, certB64, sha256b64, signB64, idSuffix }) {
  const sfx = idSuffix || cryptoRandomHex(16);
  const bodyId = `id-${sfx}`, tokId = `X509-${sfx}`;
  const body = bodyCanon(bodyId, hlavicka, data);
  const digest = await sha256b64(body);
  const si = signedInfoCanon(bodyId, digest);
  const sig = await signB64(si);
  return `<soapenv:Envelope xmlns:soapenv="${NS.soapenv}" xmlns:v4="${NS.v4}"><soapenv:Header>` +
    `<wsse:Security xmlns:wsse="${NS.wsse}" xmlns:wsu="${NS.wsu}">` +
    `<wsse:BinarySecurityToken EncodingType="${B64}" ValueType="${X509}" wsu:Id="${tokId}">${certB64}</wsse:BinarySecurityToken>` +
    `<ds:Signature xmlns:ds="${NS.ds}" Id="SIG-${sfx}">${si}<ds:SignatureValue>${sig}</ds:SignatureValue>` +
    `<ds:KeyInfo Id="KI-${sfx}"><wsse:SecurityTokenReference wsu:Id="STR-${sfx}"><wsse:Reference URI="#${tokId}" ValueType="${X509}"></wsse:Reference></wsse:SecurityTokenReference></ds:KeyInfo>` +
    `</ds:Signature></wsse:Security></soapenv:Header>${body}</soapenv:Envelope>`;
}

function cryptoRandomHex(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const uuid4 = () => crypto.randomUUID();
export const money = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
/** ISO 8601 s časovou zónou, bez milisekund (UTC „Z“ jako ve vzorové zprávě). */
export const isoTz = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Rozbor odpovědi serveru (bez XML parseru – struktura je pevná). */
export function parseResponse(xml) {
  const get = (re) => { const m = xml.match(re); return m ? m[1] : null; };
  const pok = get(/<[\w:]*Potvrzeni[^>]*\spok="([^"]+)"/);
  const kod = get(/<[\w:]*Chyba[^>]*\skod="(-?\d+)"/);
  const chybaText = get(/<[\w:]*Chyba[^>]*>([^<]*)</);
  const test = /\stest="true"/.test(xml);
  const warnings = [...xml.matchAll(/<[\w:]*Varovani[^>]*kod_varov="(\d+)"[^>]*>([^<]*)</g)].map((m) => ({ kod: +m[1], text: m[2] }));
  const fault = get(/<faultstring[^>]*>([^<]*)</);
  return { pok, kod: kod === null ? null : +kod, chyba: chybaText, test, warnings, fault };
}
