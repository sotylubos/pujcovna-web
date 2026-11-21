#!/usr/bin/env python3
"""Generuje statické stránky webu Půjčovna Žďár do složky site/."""
import json, html, pathlib

OUT = pathlib.Path(__file__).parent
SUPABASE_URL = "https://bnckyiveqebzzzxuoluj.supabase.co"
SUPABASE_KEY = "sb_publishable_9-08pVFy82_mNy3rRVh-6w_gUZwOe3I"
PHONE = "+420 777 097 902"
PHONE_LINK = "+420777097902"
EMAIL = "info@pujcovna-zdar.cz"
BASE = "https://pujcovna-zdar.cz"
TODAY = "2026-11-14"
HOME_FAQ = [
    ("Co si můžu v půjčovně ve Žďáru nad Sázavou půjčit?", "Půjčujeme skákací hrad s klouzačkou, čistič koberců a čalounění Kärcher, nosič kol na tažné zařízení, střešní box, střešní příčníky a odvlhčovač."),
    ("Jak si zboží zarezervuji?", "Na webu vyberete, co si chcete půjčit, označíte v kalendáři první a poslední den a odešlete poptávku. Rezervace platí po našem potvrzení telefonem nebo e-mailem."),
    ("Platí se předem nájem?", "Předem se skládá jen vratná kauce, nájem se zaplatí až při vrácení a můžeme ho strhnout z kauce. Platit můžete hotově, QR kódem nebo převodem."),
    ("Kde a kdy si půjčené věci vyzvednu?", "Vyzvedávat můžete ve Světnově u Žďáru nad Sázavou, večer i o víkendu po domluvě."),
    ("Dovezete skákací hrad až k nám domů?", "Ano, hrad na přání přivezeme, postavíme i složíme. Doprava stojí 6 Kč za kilometr, počítá se dovoz i odvoz. Půjčujeme na Žďársku a na Vysočině, například v okolí Bohdalova, Herálce, Škrdlovic, Počítek, Obyčtova, Najdku a v Jihlavě."),
]
AREAS = "Bohdalov, Herálec, Škrdlovice, Počítky, Obyčtov, Najdek a Jihlava"

# SEO: tvar názvu ve 2. pádu pro titulky + obsah detailních stránek
SEO = {
  "hrad": dict(gen="skákacího hradu", title="Půjčovna skákacího hradu Žďár nad Sázavou – 3 000 Kč/den",
    desc="Pronájem skákacího hradu s klouzačkou ve Žďáru nad Sázavou: 3 000 Kč za den, rozměry 5 × 6,5 m. Dovoz, postavení i složení na přání. Online rezervace s kalendářem.",
    h2="Pronájem skákacího hradu ve Žďáru nad Sázavou a okolí",
    text=[
      "Skákací hrad s klouzačkou půjčujeme ze Světnova u Žďáru nad Sázavou. Hodí se na dětské narozeniny, konec školního roku, zahradní oslavu, svatbu i obecní akci. Má rozměry 5 × 6,5 m a výšku 3,8 m, takže se vejde na většinu zahrad i do kulturního domu.",
      "Pronájem stojí 3 000 Kč za den, vratná kauce je 5 000 Kč. Pokud hrad přivezeme, počítáme dopravu 6 Kč za kilometr (dovoz i odvoz) a hrad postavíme i složíme. Můžete si ho také vyzvednout sami, večer nebo o víkendu po domluvě.",
      "Hrad půjčujeme po většinu roku, v zimě třeba do sálu. Nejvíc zájmu bývá od května do října, proto termín rezervujte s předstihem. Volné dny uvidíte v kalendáři rezervace.",
    ],
    faq=[
      ("Kolik stojí pronájem skákacího hradu?", "Pronájem stojí 3 000 Kč za den. K tomu se skládá vratná kauce 5 000 Kč, kterou vrátíme při vrácení hradu. Doprava je 6 Kč za kilometr, počítá se dovoz i odvoz."),
      ("Jaké má skákací hrad rozměry?", "Hrad je 496 cm široký, 642 cm dlouhý a 380 cm vysoký, tedy zhruba 5 × 6,5 m. Je s klouzačkou."),
      ("Co potřebuji, aby hrad fungoval?", "Stačí zásuvka 230 V. Ventilátor je relativně tichý."),
      ("Postavíte hrad u nás?", "Ano. Pokud hrad přivezeme, postavíme ho i složíme, a to je v ceně dopravy. Vyzvednout si ho můžete i sami, vše vám při předání ukážeme."),
      ("Vejde se hrad do sálu nebo kulturního domu?", "Ano, vejde se i do kulturního domu, takže oslava může být i v zimě."),
      ("Jak hrad rezervuji?", "Vyberete termín v kalendáři na webu a odešlete poptávku. Rezervace platí po našem potvrzení telefonem nebo e-mailem."),
    ]),
  "cistic": dict(gen="čističe koberců", title="Půjčovna čističe koberců Žďár nad Sázavou – Kärcher od 350 Kč/den",
    desc="Půjčení profesionálního čističe koberců a čalounění Kärcher ve Žďáru nad Sázavou: 350 Kč za den. Nástavce na koberce, sedačky i autosedačky. Online rezervace.",
    h2="Půjčovna čističe koberců a čalounění ve Žďáru nad Sázavou",
    text=[
      "Profesionální čistič koberců a čalounění Kärcher půjčujeme za 350 Kč na den, vratná kauce je 5 000 Kč. Vyčistíte s ním koberce, sedačky, křesla i autosedačky. Součástí zápůjčky je velký nástavec na koberce a malý na čalounění.",
      "Čisticí prostředek v sáčcích dostanete k stroji, dávka stojí 35 Kč. Jeden sáček znamená jednu nádrž, což vystačí přibližně na 12 m² podle zašpinění. Při předání vás zaškolíme a na stránce je i videonávod.",
      "Čistič si můžete vyzvednout ve Světnově u Žďáru nad Sázavou večer i o víkendu, po domluvě. Volné dny uvidíte v kalendáři rezervace.",
    ],
    faq=[
      ("Kolik stojí půjčení čističe koberců?", "Půjčení stojí 350 Kč za den. K tomu se skládá vratná kauce 5 000 Kč. Čisticí prášek je za 35 Kč za dávku."),
      ("Na jak velkou plochu stačí jeden sáček prostředku?", "Jeden sáček znamená jednu nádrž, což vystačí přibližně na 12 m², podle zašpinění."),
      ("Čím vyčistím sedačku nebo autosedačku?", "K čističi dostanete velký nástavec na koberce a malý nástavec na sedačky, křesla i autosedačky."),
      ("Musím umět se strojem zacházet?", "Ne. Při předání vás zaškolíme a na webu je videonávod, jak koberce a sedačky čistit."),
      ("Jak čistič rezervuji?", "Vyberete termín v kalendáři na webu a odešlete poptávku. Rezervace platí po našem potvrzení telefonem nebo e-mailem."),
    ]),
  "nosic": dict(gen="nosiče kol", title="Půjčovna nosiče kol na tažné zařízení Žďár nad Sázavou – 200 Kč/den",
    desc="Půjčení sklopného nosiče na 4 kola na tažné zařízení ve Žďáru nad Sázavou: 200 Kč za den, nosnost 60 kg. Online rezervace."),
  "box": dict(gen="střešního boxu", title="Půjčovna střešního boxu Žďár nad Sázavou – Neumann Orca 330 l",
    desc="Půjčení střešního boxu Neumann Orca 330 l ve Žďáru nad Sázavou: 200 Kč za den. Na lyže, kočárek i dovolenou. Příčníky půjčíme také."),
  "pricniky": dict(gen="střešních příčníků", title="Půjčovna střešních příčníků Žďár nad Sázavou – MAX 120 od 100 Kč/den",
    desc="Půjčení uzamykatelných střešních příčníků MAX 120 ve Žďáru nad Sázavou: 100 Kč za den, nosnost 75 kg, montáž bez nářadí."),
  "odvlhcovac": dict(gen="odvlhčovače", title="Půjčovna odvlhčovače Žďár nad Sázavou – Master DHP 65 350 Kč/den",
    desc="Půjčení profesionálního odvlhčovače Master DHP 65 ve Žďáru nad Sázavou: 350 Kč za den, až 56 l vody za den. Na sklepy, novostavby i vysoušení po vytopení."),
}

ITEMS = [
  dict(id="hrad", slug="skakaci-hrad", name="Skákací hrad s klouzačkou", short_name="Skákací hrad",
       price=3000, deposit=5000, tag="Rezervujte včas", contain=False,
       imgs=["hrad-1.jpg", "hrad-2.jpg"], video="SJhKD7yizJc",
       short="Rozměry 5 × 6,5 m, vejde se do něj spousta dětí. Na oslavy, zahradní párty, obecní akce i do sálu.",
       desc="Máte děti a zahradu? Ideální kombinace na skákací hrad. Sezvěte sousedy a udělejte oslavu narozenin, konec školního roku nebo rozloučení s prázdninami. Hrad je velký, ale vejde se i do kulturního domu, takže oslava může být klidně i v zimě. Hodí se také na obecní akce, výstavy, festivaly nebo svatbu.",
       specs=[("Šířka", "496 cm"), ("Délka", "642 cm"), ("Výška", "380 cm")],
       bullets=["Pevné, kvalitní a odolné materiály", "Skákací plocha a klouzačka", "Relativně tichý ventilátor, stačí zásuvka 230 V", "Když hrad přivezeme, postavíme ho i složíme"],
       extra="Doprava 6 Kč/km. Počítá se dovoz i odvoz (tam a zpět), v ceně je postavení i složení hradu."),
  dict(id="cistic", slug="cistic-kobercu", name="Čistič koberců a čalounění", short_name="Čistič koberců",
       price=350, deposit=5000, tag="Oblíbené", contain=True,
       imgs=["cistic.jpg"], video="HeKKoeleCpo",
       short="Profesionální Kärcher. Velký nástavec na koberce, malý na sedačky, křesla i autosedačky.",
       desc="Profesionální čistič koberců a čalounění Kärcher si zamilujete. Ukáže vám, jak dřív vypadal váš koberec, křeslo nebo sedačka v autě. Půjčíme vám velký nástavec na koberce i malý na křesla, pohovky a autosedačky. Dostanete také čisticí prostředek v sáčcích. Při předání vás zaškolíme, ale není to žádná věda – podívejte se na videonávod.",
       specs=[("Nástavce", "velký + malý"), ("1 sáček", "≈ 12 m²"), ("Značka", "Kärcher")],
       bullets=["Jeden sáček prostředku = jedna nádrž = přibližně 12 m² plochy (podle zašpinění)", "Na koberce, sedačky, křesla i autosedačky", "Videonávod níže na stránce"],
       extra="Čisticí prášek 35 Kč za dávku."),
  dict(id="nosic", slug="nosic-kol", name="Nosič kol na tažné zařízení", short_name="Nosič kol",
       price=200, deposit=2000, tag="", contain=True,
       imgs=["nosic-kol.jpg"], video="Cu9wjQenfdY",
       short="Až 4 kola, nosnost 60 kg. Sklopný, do kufru se dostanete i s naloženými koly.",
       desc="Nosič je ideální na převoz až čtyř jízdních kol. I s koly je výborně vyvážený a dá se sklopit, takže se do kufru dostanete i s naloženými koly. Uchytíte ho na jakékoli tažné zařízení. Ve složeném stavu je kompaktní a dobře se skladuje.",
       specs=[("Kol", "až 4"), ("Nosnost", "60 kg"), ("Na 1 kolo", "max 15 kg")],
       bullets=["Na jakékoli tažné zařízení", "Sklopný i s naloženými koly", "Videonávod k nasazení níže na stránce"],
       extra=""),
  dict(id="box", slug="stresni-box", name="Střešní box Neumann Orca", short_name="Střešní box",
       price=200, deposit=2000, tag="", contain=False,
       imgs=["box-auto.jpg", "box.jpg"], video="",
       short="330 litrů, délka 2 m, otevírání z obou stran. Na lyže, kočárek i zavazadla na dovolenou.",
       desc="Autobox Neumann Orca od tuzemského výrobce. Pobere lyže, zavazadla, stan, spacáky nebo kočárek. Tvar je navržený s ohledem na dobrou aerodynamiku, za jízdy neruší. Otevírá se z obou stran, víko drží dvojčinné vzpěry a box zamyká centrální tříbodový zámek. Nemáte příčníky? Půjčíme vám i ty.",
       specs=[("Objem", "330 l"), ("Rozměry", "200 × 59 × 36 cm"), ("Nosnost", "50 kg"), ("Hmotnost", "14 kg"), ("Lyže / snowboardy", "4 / 3 páry")],
       bullets=["Otevírání z obou stran", "Centrální tříbodový zámek", "Potřebujete příčníky na střeše auta"],
       extra=""),
  dict(id="pricniky", slug="pricniky", name="Příčníky MAX 120", short_name="Příčníky",
       price=100, deposit=1000, tag="", contain=True,
       imgs=["pricniky.jpg"], video="",
       short="Uzamykatelné, montáž bez nářadí, nosnost 75 kg. Pro auta s podélníky do rozteče 94 cm.",
       desc="Příčný nosič MAX 120 je uzamykatelný univerzální nosič pro většinu aut s podélníky. Díky konstrukci je velmi pevný. Šířka ložné plochy je 120 cm, vnější rozteč vašich podélníků může být nejvýš 94 cm. Šířka střech i podélníků se liší, proto doporučujeme příčníky na vašem autě před zápůjčkou vyzkoušet.",
       specs=[("Šířka", "120 cm"), ("Rozteč podélníků", "max 94 cm"), ("Nosnost", "75 kg"), ("Výška patek", "70 mm")],
       bullets=["Montáž bez nářadí", "Zamykací", "Doporučujeme vyzkoušet na autě předem"],
       extra=""),
  dict(id="odvlhcovac", slug="odvlhcovac", name="Odvlhčovač Master DHP 65", short_name="Odvlhčovač",
       price=350, deposit=5000, tag="", contain=True,
       imgs=["odvlhcovac.jpg"], video="",
       short="Až 56 litrů vody za den. Vysoušení po vytopení, sklepů, novostaveb a velkých bytů.",
       desc="Profesionální odvlhčovač na vysoušení staveb po haváriích a záplavách, na zkrácení technologických přestávek nebo na vysoušení sklepů, velkých bytů a domů. Po výpadku proudu se sám znovu spustí, má velká kola pro snadnou manipulaci a může běžet nepřetržitě.",
       specs=[("Výkon", "56 l / 24 h"), ("Nádrž", "10,5 l"), ("Průtok vzduchu", "500 m³/h"), ("Rozměry", "57 × 53 × 70 cm"), ("Hmotnost", "45 kg")],
       bullets=["Automatický restart po výpadku proudu", "Velká kola", "Nepřetržitý provoz"],
       extra=""),
]

def kc(n):
    return f"{n:,}".replace(",", " ") + " Kč"

e = html.escape
LOGO_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF7A3D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>'
PLAY = '<svg width="28" height="28" viewBox="0 0 24 24" fill="#16211C" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'
PHONE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'

def ld_json(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"

BUSINESS = {
  "@context": "https://schema.org", "@type": "LocalBusiness", "@id": BASE + "/#firma",
  "name": "Půjčovna Žďár", "url": BASE + "/", "telephone": PHONE_LINK, "email": EMAIL,
  "image": BASE + "/img/hrad-1.jpg",
  "address": {"@type": "PostalAddress", "streetAddress": "Světnov 201", "addressLocality": "Žďár nad Sázavou", "postalCode": "591 02", "addressCountry": "CZ"},
  "areaServed": ["Žďár nad Sázavou", "Bohdalov", "Herálec", "Škrdlovice", "Počítky", "Obyčtov", "Najdek", "Jihlava"],
  "description": "Půjčovna skákacího hradu, čističe koberců, nosiče kol, střešního boxu, příčníků a odvlhčovače ve Světnově u Žďáru nad Sázavou.",
}

def head(title, desc, path="/", image="/img/hrad-1.jpg", ld=None):
    ld_html = "\n".join(ld_json(x) for x in (ld or []))
    return f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="google-site-verification" content="9hPKgIYhCg_evJDCSA3Z0mEANu-zkcHJdCR1flKu0mo">
<link rel="canonical" href="{BASE}{path}">
<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<meta property="og:site_name" content="Půjčovna Žďár">
<meta property="og:url" content="{BASE}{path}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{BASE}{image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F4D3A">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
{ld_html}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<header class="site-head"><div class="wrap">
<a class="logo" href="/"><span class="logo-mark">{LOGO_SVG}</span><span class="logo-text">Půjčovna Žďár</span></a>
<nav class="nav" aria-label="Hlavní menu">
<a href="/#nabidka">Nabídka</a><a href="/#jak">Jak to funguje</a><a href="/#videa">Videa</a><a href="/#cenik">Ceník a podmínky</a><a href="/#kontakt">Kontakt</a>
</nav>
<a class="btn btn-accent head-cta" href="/#rezervace">Rezervovat</a>
</div></header>
"""

FOOT = f"""
<footer class="foot" id="kontakt">
<div class="wrap">
<div class="foot-big">
<p>Nevíte si rady? Zavolejte, poradíme.</p>
<a class="tel" href="tel:{PHONE_LINK}">{PHONE}</a>
<a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
</div>
<div class="foot-col"><b>Kde nás najdete</b>Světnov 201<br>591 02 Žďár nad Sázavou<br><br>Předání večer a o víkendu, po domluvě.</div>
<div class="foot-col"><b>Provozovatel</b>Lubomír Šotek<br>IČ 71391134<br><br><a href="/podminky.html">Podmínky zapůjčení</a><br><a href="/gdpr.html">Ochrana osobních údajů</a></div>
</div>
<div class="wrap foot-bottom">© 2026 Půjčovna Žďár</div>
</footer>
"""

def config_script():
    pub = [{k: it[k] for k in ("id", "slug", "name", "short_name", "price", "deposit")} for it in ITEMS]
    return f"""<script>window.PJ={json.dumps({"url": SUPABASE_URL, "key": SUPABASE_KEY, "items": pub}, ensure_ascii=False)};</script>"""

def img_tag(it, i=0, cls=""):
    c = ' class="contain"' if it["contain"] and i == 0 else ""
    return f'<img src="/img/{it["imgs"][i]}" alt="{e(it["name"])}" loading="lazy"{c}>'

def perk(svg, t, s):
    return f'<div class="perk">{svg}<div><p><b>{t}</b></p><p>{s}</p></div></div>'

def ic(path):
    return f'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1F4D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>'

def index():
    cards = []
    for it in ITEMS:
        tag = f'<span class="tag">{e(it["tag"])}</span>' if it["tag"] else ""
        cards.append(f"""<article class="card">
<div class="card-media">{img_tag(it)}{tag}</div>
<div class="card-body">
<h3>{e(it["name"])}</h3>
<p>{e(it["short"])}</p>
<div class="price"><strong data-price="{it["id"]}">{kc(it["price"])}</strong><span>/ den · kauce <span data-deposit="{it["id"]}">{kc(it["deposit"])}</span></span></div>
<div class="card-actions"><a class="btn btn-green" href="/?polozka={it["id"]}#rezervace" data-pick="{it["id"]}">Rezervovat</a><a class="btn btn-ghost" href="/{it["slug"]}.html">Detail</a></div>
</div></article>""")
    videos = [("SJhKD7yizJc", "hrad-2.jpg", "Skákací hrad v akci"), ("HeKKoeleCpo", "cistic.jpg", "Jak čistit koberce a sedačky"), ("Cu9wjQenfdY", "nosic-kol.jpg", "Nasazení nosiče kol")]
    vids = "".join(f"""<div class="video"><div class="video-frame"><button type="button" data-yt="{v}" aria-label="Přehrát video: {e(t)}"><img src="/img/{img}" alt="" loading="lazy"><span class="play">{PLAY}</span></button></div><b>{e(t)}</b></div>""" for v, img, t in videos)
    rows = "".join(f'<tr><td><a href="/{it["slug"]}.html">{e(it["name"])}</a></td><td class="r"><b data-price="{it["id"]}">{kc(it["price"])}</b></td><td class="r muted" data-deposit="{it["id"]}">{kc(it["deposit"])}</td></tr>' for it in ITEMS)
    chips = "".join(f'<button type="button" class="chip" data-item="{it["id"]}" aria-pressed="false">{e(it["short_name"])}</button>' for it in ITEMS)
    perks = "".join([
        perk(ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), "Večer i o víkendu", "Čas předání domluvíme podle vás."),
        perk(ic('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'), "Můžeme přivézt", "Na přání vám věc přivezeme až k vám."),
        perk(ic('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 20h4v-3"/>'), "Převodem, QR nebo hotově", "Platit můžete, jak se vám to hodí."),
        perk(ic('<path d="M20 6 9 17l-5-5"/>'), "Vše vám ukážeme", "Montáž i obsluhu vysvětlíme při předání."),
    ])
    hrad = ITEMS[0]
    body = head("Půjčovna Žďár nad Sázavou – skákací hrad, čistič koberců, střešní box",
                "Půjčovna ve Světnově u Žďáru nad Sázavou: skákací hrad s klouzačkou, čistič koberců Kärcher, nosič kol, střešní box, příčníky a odvlhčovač. Online rezervace, vyzvednutí večer i o víkendu, dovoz hradu domů.",
                "/", ld=[BUSINESS, {"@context": "https://schema.org", "@type": "WebSite", "url": BASE + "/", "name": "Půjčovna Žďár", "inLanguage": "cs"},
                {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a_}} for q, a_ in HOME_FAQ]}]) + f"""
<main id="top">
<section class="wrap hero">
<div class="hero-text">
<span class="pill">Světnov u Žďáru nad Sázavou</span>
<h1>Půjčovna ve Žďáru nad Sázavou: půjčte si, co zrovna potřebujete.</h1>
<p class="lead">Skákací hrad na oslavu, čistič na koberce, střešní box na dovolenou. Zarezervujete online, vyzvednete si u nás, nebo vám to přivezeme až domů.</p>
<div class="hero-actions"><a class="btn btn-accent" href="#rezervace">Vybrat termín</a><a class="btn btn-outline" href="tel:{PHONE_LINK}">{PHONE_SVG} 777 097 902</a></div>
</div>
<div class="hero-media">
<img class="main" src="/img/hrad-1.jpg" alt="Děti skáčou na našem skákacím hradu" fetchpriority="high">
<img class="side" src="/img/box-auto.jpg" alt="Náš střešní box na autě">
<div class="price-chip"><small>Skákací hrad s klouzačkou</small><strong data-price="hrad">{kc(hrad["price"])}</strong> <span>/ den</span></div>
</div>
</section>
<section class="wrap perks" aria-label="Výhody">{perks}</section>

<section class="wrap sec" id="nabidka">
<div class="sec-head"><h2>Co u nás půjčíte</h2><p>Ceny za kalendářní den, s vratnou kaucí.</p></div>
<div class="grid-items">{"".join(cards)}</div>
</section>

<section class="how" id="jak"><div class="wrap sec" style="padding-top:72px;padding-bottom:72px">
<h2>Jak to funguje</h2>
<div class="steps">
<div class="step"><span>1</span><b>Vyberte termín</b><p>V kalendáři hned vidíte, kdy je věc volná. Vyplníte pár údajů a odešlete poptávku.</p></div>
<div class="step"><span>2</span><b>Potvrdíme vám to</b><p>Ozveme se telefonem nebo e-mailem a domluvíme čas předání, případně dovoz.</p></div>
<div class="step"><span>3</span><b>Vyzvednete a užíváte</b><p>Při převzetí vám ukážeme, jak věc funguje, a složíte vratnou kauci.</p></div>
</div></div></section>

<section class="wrap sec" id="videa">
<div class="sec-head"><h2>Podívejte se, jak to vypadá</h2><p>Krátká videa a návody k obsluze</p></div>
<div class="grid-videos">{vids}</div>
</section>

<section class="wrap sec" id="rezervace">
<div class="res-box">
<div><h2>Rezervace</h2><p class="muted" style="margin:8px 0 0">Vyberte, co si chcete půjčit, a označte v kalendáři první a poslední den.</p></div>
<fieldset class="res-items"><legend>1. Co si půjčíte</legend>{chips}</fieldset>
<div class="res-cols">
<div class="res-col">
<p class="label-step" style="margin:0">2. Termín</p>
<div class="cal">
<div class="cal-head"><button type="button" class="icon-btn" id="calPrev" aria-label="Předchozí měsíc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211C" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><b id="calTitle" aria-live="polite"></b><button type="button" class="icon-btn" id="calNext" aria-label="Další měsíc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211C" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div>
<div class="cal-dow" aria-hidden="true"><span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span></div>
<div class="cal-grid" id="calGrid"></div>
<div class="legend"><span><i style="background:#1F4D3A"></i>Váš termín</span><span><i style="background:#F1D9CC"></i>Obsazeno</span><span><i style="background:#F2F0EA"></i>Volno</span></div>
</div>
<p class="alert" id="calErr" role="alert" hidden></p>
</div>
<div class="res-col">
<p class="label-step" style="margin:0">3. Vaše údaje</p>
<div class="done" id="resDone" hidden>
<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F4D3A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6"/></svg>
<b>Děkujeme, poptávku máme.</b>
<p>Číslo poptávky: <strong id="resCode"></strong>. Termín vám potvrdíme telefonem nebo e-mailem, obvykle ještě týž den. Rezervace platí po našem potvrzení.</p>
<button type="button" class="btn btn-ghost" id="resAgain" style="align-self:flex-start">Nová rezervace</button>
</div>
<form class="form" id="resForm" novalidate>
<div class="form-row">
<label class="field">Jméno a příjmení<input name="name" type="text" autocomplete="name" required></label>
<label class="field" style="flex-basis:150px">Telefon<input name="phone" type="tel" autocomplete="tel" required></label>
</div>
<label class="field">E-mail<input name="email" type="email" autocomplete="email" required></label>
<label class="field">Adresa (ulice, číslo, obec)<input name="address" type="text" autocomplete="street-address" required></label>
<label class="hp" aria-hidden="true">Nevyplňujte<input name="web" type="text" tabindex="-1" autocomplete="off"></label>
<label class="check"><input name="delivery" type="checkbox"> Chci to dovézt (cenu dopravy upřesníme)</label>
<label class="field">Poznámka<textarea name="note" rows="3"></textarea></label>
<div class="summary">
<div><span id="sumItem">—</span><span id="sumRange">vyberte v kalendáři</span></div>
<div><span>Nájem (<span id="sumDays">0 dní</span>)</span><span id="sumRent">0 Kč</span></div>
<div><span>Vratná kauce</span><span id="sumDep">—</span></div>
<div class="total"><span>Celkem (nájem + vratná kauce)</span><span id="sumTotal">—</span></div>
</div>
<p class="alert" id="formErr" role="alert" hidden></p>
<button type="submit" class="btn btn-accent" id="resSubmit" style="min-height:54px;font-size:17px">Odeslat poptávku</button>
<p class="small">Odesláním souhlasíte se zpracováním údajů pro vyřízení rezervace (<a href="/gdpr.html">ochrana osobních údajů</a>). Raději voláte? <a href="tel:{PHONE_LINK}">777 097 902</a></p>
</form>
</div>
</div>
</div>
</section>

<section class="wrap sec two" id="cenik" style="padding-top:24px">
<div>
<h2 style="font-size:clamp(30px,3.5vw,40px);margin-bottom:20px">Ceník</h2>
<div class="table-box"><table><thead><tr><th scope="col">Položka</th><th scope="col" class="r">Cena / den</th><th scope="col" class="r">Vratná kauce</th></tr></thead><tbody>{rows}</tbody></table></div>
<ul class="notes">
<li>Čisticí prášek k čističi koberců: 35 Kč za dávku (1 dávka ≈ 12 m²).</li>
<li>Doprava skákacího hradu: 6 Kč/km, počítá se dovoz i odvoz (tam a zpět). V ceně je postavení i složení hradu.</li>
<li>Cena se počítá za každý kalendářní den. Výpůjčka od čtvrtka dopoledne do pátku dopoledne jsou 2 dny.</li>
</ul>
</div>
<div>
<h2 style="font-size:clamp(30px,3.5vw,40px);margin-bottom:20px">Podmínky v kostce</h2>
<div class="boxes">
<div class="box"><b>Doklad totožnosti</b><p>Občanský nebo řidičský průkaz, případně pas.</p></div>
<div class="box"><b>Vratná kauce</b><p>Kauci vrátíme při vrácení věci.</p></div>
<div class="box"><b>Prodloužení</b><p>Dejte vědět aspoň jeden pracovní den předem. Při vrácení dřív se nájem nevrací.</p></div>
<a href="/podminky.html" style="font-weight:600;padding:6px 0">Celé podmínky zapůjčení</a>
</div>
</div>
</section>

<section class="white"><div class="wrap sec"><div class="prose">
<h2>Půjčovna ve Žďáru nad Sázavou</h2>
<p>Půjčovna ve Světnově u Žďáru nad Sázavou nabízí věci, které se hodí jen pár dní v roce: <a href="/skakaci-hrad.html">skákací hrad s klouzačkou</a> na oslavy, profesionální <a href="/cistic-kobercu.html">čistič koberců a čalounění Kärcher</a>, <a href="/nosic-kol.html">nosič kol</a> na tažné zařízení, <a href="/stresni-box.html">střešní box</a> s <a href="/pricniky.html">příčníky</a> na dovolenou a <a href="/odvlhcovac.html">odvlhčovač</a> na sklepy a vysoušení po vytopení.</p>
<p>Půjčujeme zákazníkům ze Žďáru nad Sázavou a okolí, na Žďársku i na Vysočině (například {AREAS}). Zarezervujete online, předání je večer i o víkendu a skákací hrad vám na přání přivezeme a postavíme.</p>
</div>
<div class="prose faq" style="margin-top:28px"><h2>Časté otázky</h2>{"".join(f"<details><summary>{e(q)}</summary><p>{e(a_)}</p></details>" for q, a_ in HOME_FAQ)}</div></div></section>
</main>
{FOOT}
{config_script()}
<script src="/js/web.js" defer></script>
<script src="/js/stats.js" defer></script></body></html>
"""
    (OUT / "index.html").write_text(body, encoding="utf-8")

def detail(it):
    imgs = it["imgs"]
    thumbs = ""
    if len(imgs) > 1:
        thumbs = '<div class="thumbs">' + "".join(
            f'<button type="button" data-img="/img/{im}" aria-label="Fotka {i+1}" aria-current="{"true" if i==0 else "false"}"><img src="/img/{im}" alt=""></button>' for i, im in enumerate(imgs)) + "</div>"
    big_cls = "big contain" if it["contain"] else "big"
    specs = "".join(f'<div class="spec"><small>{e(k)}</small><b>{e(v)}</b></div>' for k, v in it["specs"])
    bullets = "".join(f"<li>{e(b)}</li>" for b in it["bullets"])
    extra = f'<p class="muted" style="margin:0;font-size:15px">{e(it["extra"])}</p>' if it["extra"] else ""
    calc = ""
    if it["id"] == "hrad":
        calc = """<div style="border-top:1px solid #EFECE4;padding-top:14px;display:flex;flex-direction:column;gap:10px">
<label for="km" style="font-weight:700;font-size:15px">Kolik km je to k vám od Světnova?</label>
<div style="display:flex;align-items:center;gap:14px"><input id="km" type="range" min="0" max="60" step="1" value="15" style="flex:1;accent-color:#1F4D3A;height:44px"><span id="kmOut" style="min-width:64px;text-align:right;font-weight:700">15 km</span></div>
<div style="display:flex;justify-content:space-between;gap:12px;font-size:15px"><span class="muted">Doprava (dovoz i odvoz, postavení i složení)</span><b id="kmPrice"></b></div>
<div style="display:flex;justify-content:space-between;gap:12px;font-size:15px"><span class="muted">Celkem za 1 den s dopravou</span><b id="kmTotal" style="font-family:var(--head);font-size:20px"></b></div>
</div>"""
    video = ""
    if it["video"]:
        video = f"""<section class="wrap sec"><div class="sec-head"><h2 style="font-size:34px">Video</h2></div>
<div style="max-width:860px"><div class="video-frame"><button type="button" data-yt="{it["video"]}" aria-label="Přehrát video"><img src="/img/{imgs[-1]}" alt="" loading="lazy"><span class="play">{PLAY}</span></button></div></div></section>"""
    tag = f'<span class="pill" style="background:#16211C;color:#fff">{e(it["tag"])}</span>' if it["tag"] else ""
    sx = SEO[it["id"]]
    url = f'{BASE}/{it["slug"]}.html'
    product = {"@context": "https://schema.org", "@type": "Product", "name": it["name"], "description": it["desc"],
               "image": [f'{BASE}/img/{im}' for im in imgs], "url": url,
               "offers": {"@type": "Offer", "url": url, "priceCurrency": "CZK", "price": it["price"], "availability": "https://schema.org/InStock",
                          "priceSpecification": {"@type": "UnitPriceSpecification", "price": it["price"], "priceCurrency": "CZK", "unitText": "DAY"},
                          "seller": {"@id": BASE + "/#firma"},
                          "hasMerchantReturnPolicy": {"@type": "MerchantReturnPolicy", "applicableCountry": "CZ",
                                                      "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted"}}}
    BRANDS = {"cistic": "Kärcher", "box": "Neumann", "odvlhcovac": "Master"}
    if it["id"] in BRANDS:
        product["brand"] = {"@type": "Brand", "name": BRANDS[it["id"]]}
    if it["id"] != "hrad":
        product["offers"]["shippingDetails"] = {"@type": "OfferShippingDetails",
            "shippingRate": {"@type": "MonetaryAmount", "value": 0, "currency": "CZK"},
            "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "CZ"},
            "deliveryTime": {"@type": "ShippingDeliveryTime",
                             "handlingTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY"},
                             "transitTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "DAY"}}}
    crumbs_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Půjčovna Žďár", "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": it["name"], "item": url}]}
    lds = [BUSINESS, product, crumbs_ld]
    seo_block = ""
    if sx.get("faq"):
        lds.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a_}} for q, a_ in sx["faq"]]})
        paras = "".join(f"<p>{e(t)}</p>" for t in sx["text"])
        faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a_)}</p></details>" for q, a_ in sx["faq"])
        others = "".join(f'<a href="/{o["slug"]}.html">{e(o["name"])}</a>' for o in ITEMS if o["id"] != it["id"])
        seo_block = f"""<section class="white"><div class="wrap sec two">
<div class="prose"><h2>{e(sx["h2"])}</h2>{paras}<p class="muted">Půjčujeme zákazníkům ze Žďáru nad Sázavou i okolí (například {AREAS}).</p></div>
<div class="faq"><h2>Časté otázky</h2>{faq}</div>
</div></section>
<section class="wrap sec" style="padding-top:32px"><h2 style="font-size:26px;margin-bottom:14px">Další z nabídky</h2><div class="more">{others}</div></section>"""
    body = head(sx["title"], sx["desc"], f'/{it["slug"]}.html', f'/img/{imgs[0]}', lds)+ f"""
<main>
<div class="wrap crumbs"><a href="/#nabidka">Nabídka</a> <span aria-hidden="true">/</span> {e(it["name"])}</div>
<section class="wrap detail">
<div class="gallery"><img id="bigImg" class="{big_cls}" src="/img/{imgs[0]}" alt="{e(it["name"])}">{thumbs}</div>
<aside class="aside">
{tag}
<h1>{e(it["name"])}</h1>
<p class="desc">{e(it["desc"])}</p>
<div class="buy">
<div><span class="big-price" data-price="{it["id"]}">{kc(it["price"])}</span> <span class="muted">/ den</span></div>
<p class="muted" style="margin:0;font-size:15px">Vratná kauce <span data-deposit="{it["id"]}">{kc(it["deposit"])}</span>.</p>
{extra}{calc}
<a class="btn btn-accent" href="/?polozka={it["id"]}#rezervace" style="min-height:54px;font-size:17px">Vybrat termín</a>
<a href="tel:{PHONE_LINK}" style="text-align:center;font-weight:600">nebo zavolejte 777 097 902</a>
</div>
</aside>
</section>
<section class="white"><div class="wrap sec two">
<div><h2 style="font-size:34px;margin-bottom:20px">Parametry</h2><div class="specs">{specs}</div></div>
<div><h2 style="font-size:34px;margin-bottom:20px">Dobré vědět</h2><ul class="notes" style="margin-top:0">{bullets}</ul></div>
</div></section>
{video}
{seo_block}
</main>
{FOOT}
{config_script()}
<script src="/js/web.js" defer></script>
<script src="/js/stats.js" defer></script></body></html>
"""
    (OUT / f'{it["slug"]}.html').write_text(body, encoding="utf-8")

def prose_page(fname, title, desc, inner):
    body = head(title, desc, "/" + fname) + f'<main class="wrap sec"><div class="prose">{inner}</div></main>{FOOT}<script src="/js/stats.js" defer></script></body></html>'
    (OUT / fname).write_text(body, encoding="utf-8")

PODMINKY = """<h1>Podmínky zapůjčení</h1>
<h2>Doklady</h2><p>Při zapůjčení předložíte doklad totožnosti: občanský průkaz, řidičský průkaz, cestovní pas nebo rodný list.</p>
<h2>Kauce</h2><p>Při převzetí složíte vratnou kauci. Kauci vrátíme při vrácení zboží. Pokud vznikla škoda nebo ztráta, vyúčtujeme z kauce náhradu.</p>
<h2>Rezervace a platba</h2><p>Rezervace platí po našem potvrzení. Platit můžete hotově, QR kódem nebo převodem. Cena se počítá za každý kalendářní den.</p>
<h2>Vrácení a prodloužení</h2><p>Zboží je nutné vrátit ve sjednaném termínu. Pokud ho nemůžete vrátit včas, oznamte prodloužení nejméně jeden pracovní den předem. Při nevrácení bez řádného a včasného oznámení se platí nájemné za každý započatý den navíc a 100% příplatek za nedodržení termínu vrácení. Při vrácení před sjednaným termínem nevzniká nárok na vrácení poměrné části nájemného.</p>
<h2>Poškození, ztráta a zničení</h2><p>Při částečném poškození nad rámec běžného opotřebení hradíte náhradu škody, kterou určí odpovědný pracovník podle hodnoty zboží. Při úplném zničení zboží nebo jeho části hradíte hodnotu odpovídající rozsahu zničení, resp. hodnotě zboží v době zničení. Při ztrátě nebo odcizení hradíte plnou cenu zboží; pokud ztrátu nebo odcizení neohlásíte bez prodlení, hradíte navíc nájemné za dobu přesahující sjednaný termín.</p>
<h2>Používání</h2><p>Při předání vás seznámíme s montáží a používáním zboží.</p>"""

GDPR = f"""<h1>Ochrana osobních údajů</h1>
<p>Správcem osobních údajů je Lubomír Šotek, IČ 71391134, Světnov 201, 591 02 Žďár nad Sázavou, e-mail <a href="mailto:{EMAIL}">{EMAIL}</a>, telefon {PHONE}.</p>
<h2>Jaké údaje zpracováváme a proč</h2><p>Při rezervaci zpracováváme jméno, telefon, e-mail, termín a případnou poznámku. Údaje potřebujeme k vyřízení rezervace a k plnění nájmu (čl. 6 odst. 1 písm. b) GDPR). Údaje o platbách a kaucích uchováváme kvůli plnění zákonných povinností (účetní a daňové předpisy, evidence tržeb).</p>
<h2>Jak dlouho údaje uchováváme</h2><p>Údaje z nevyřízených nebo odmítnutých poptávek mažeme nejpozději do 6 měsíců. Údaje k uskutečněným zápůjčkám uchováváme po dobu stanovenou daňovými a účetními předpisy.</p>
<h2>Komu údaje předáváme</h2><p>Údaje neprodáváme ani nepředáváme k marketingu. Ukládáme je u poskytovatelů, kteří pro nás zajišťují provoz webu, databáze a e-mailu, a v nezbytném rozsahu je předáváme orgánům státní správy, pokud to ukládá zákon.</p>
<h2>Vaše práva</h2><p>Máte právo na přístup ke svým údajům, jejich opravu nebo výmaz, omezení zpracování, přenositelnost a právo podat stížnost u Úřadu pro ochranu osobních údajů. Stačí nám napsat na <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<h2>Cookies</h2><p>Web nepoužívá žádné cookies. Návštěvnost počítáme anonymně a sami (bez cizích služeb): ukládá se jen navštívená stránka, doména, ze které návštěvník přišel, typ zařízení a náhodné číslo platné jen po dobu otevřeného okna prohlížeče. Neukládáme IP adresu ani nic, čím by šlo návštěvníka poznat. Videa se načítají z YouTube v režimu se zvýšenou ochranou soukromí až po kliknutí na přehrání.</p>"""

FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#1F4D3A"/><g transform="translate(8 8)" fill="none" stroke="#FF7A3D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></g></svg>'

if __name__ == "__main__":
    index()
    for it in ITEMS:
        detail(it)
    prose_page("podminky.html", "Podmínky zapůjčení – Půjčovna Žďár", "Podmínky zapůjčení v Půjčovně Žďár: doklady, kauce, vrácení, poškození.", PODMINKY)
    prose_page("gdpr.html", "Ochrana osobních údajů – Půjčovna Žďár", "Jak Půjčovna Žďár zpracovává osobní údaje z rezervací.", GDPR)
    (OUT / "favicon.svg").write_text(FAVICON, encoding="utf-8")
    pages = ["/"] + [f'/{it["slug"]}.html' for it in ITEMS] + ["/podminky.html", "/gdpr.html"]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f'<url><loc>{BASE}{pg}</loc><lastmod>{TODAY}</lastmod></url>\n' for pg in pages) + "</urlset>\n"
    (OUT / "sitemap.xml").write_text(sm, encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nDisallow: /sprava/\n\nSitemap: {BASE}/sitemap.xml\n", encoding="utf-8")
    nf = head("Stránka nenalezena – Půjčovna Žďár", "Tato stránka neexistuje.", "/404.html").replace('content="index,follow,max-image-preview:large"', 'content="noindex"') + f'<main class="wrap sec"><div class="prose"><h1>Stránka nenalezena</h1><p>Tuhle stránku jsme nenašli. Podívejte se na <a href="/">nabídku půjčovny</a> nebo zavolejte na <a href="tel:{PHONE_LINK}">{PHONE}</a>.</p></div></main>{FOOT}<script src="/js/stats.js" defer></script></body></html>'
    (OUT / "404.html").write_text(nf, encoding="utf-8")
    print("hotovo")
