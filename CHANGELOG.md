# Változásnapló

## 1.0.0 – 2026-10-11

Első kiadás.

### Funkciók
- Glassmorphism stílusú háztervező popup (`[autogrowehome]`, `[autogrowehome_button]`, `#agh-open`), egyszerű és részletes mód, élő vázlat és összegzés, presetek, Projektjeim, sötét mód, mobil „⋯” menü.
- Átfogó paraméterrendszer (128 beépített paraméter) + admin által bővíthető egyedi paraméterek; kötelező BRAMAC tetőfedés magastetőnél, katalógussal.
- Kérésenként 3 eltérő koncepció; koncepciónkénti galéria (külső/belső nézetek külön fájlban); újragenerálás külön napi kerettel.
- Determinisztikus, méretezett tervvázlatok (SVG), DXF és CAD-JSON export, `agh_cad_exporters` bővítési pont.
- Moduláris, adminban szerkeszthető promptmotor verziókezeléssel.
- Aszinkron feladatsor (WP-Cron, loopback, fojtott státusz-poll, WP-CLI `wp agh queue`), valós haladásjelzés.
- Magnific (Mystic, Flux 2 Pro referenciaképpel, felskálázás) és Anthropic (Messages API, kényszerített tool use) adapter; helyi teszt szolgáltató jelölt képekkel.
- Mentés és ajánlatkérés külön műveletként; külön, alapból üres hozzájárulások, verziózott dokumentumok, hozzájárulási napló.
- Védett kivitelezői ZIP-csomag, e-mail-értesítés, időkorlátos, címzetthez kötött, visszavonható hozzáférés (token az URL-töredékben, HttpOnly sütire cserélve).
- IP-alapú, atomikus napi keret (1 kérés = 3 koncepció = 1 egység), megbízható proxyk, hash-elt IP, IPv6 /64.
- Admin vezérlőközpont: arculat, paraméterszerkesztő, katalógus, üzleti beállítások, statisztika CSV-vel, napló, feladatsor, rendszerállapot, súgó, GYIK, gyorsbemutató.
- GDPR: exporter/eraser lapozással, adatmegőrzés, anonimizálás.
- 16 nyelv (magyar forrás + 15 fordítás, nyelvenként 1565 szöveg).
- Kereskedelmi licencmodul (Starter/Professional/Agency), Ed25519-aláírt licencválaszok, türelmi idő, aláírt frissítés SHA-256 ellenőrzéssel; referencia-licencszerver (`tools/license-server`).
- Bővítési pontok: `agh_image_providers`, `agh_cad_exporters`, `agh_payment_gateways`, `agh_prompt_variables`, `agh_magnific_status_path`, `agh_owner_mode`, `agh_concepts_finished`, `agh_quote_submitted`.

### Javítás (2026-10-11, kiadás előtt)
- Windows: az aktiválás végzetes hibával állt le („Class AutoGroweHome\Support\Logger not found”), mert az autoloader a `DIRECTORY_SEPARATOR`-ral építette az útvonalat, amit a saját ellenőrzése Windowson elutasított. Az útvonal mostantól mindig `/`-rel épül. Regressziós teszt: `php tests/autoloader-test.php`.
- Teljesítmény: a tervező erősen akadozott. Az ok az egymásba ágyazott `backdrop-filter` volt (teljes képernyős elmosás az oldal fölött + elmosás mindhárom panelen), amit a böngésző a panelek minden újrarajzolásánál újraszámolt. A paneleken az elmosás láthatatlan volt (mögöttük a tervező saját, statikus háttere van), ezért megszűnt; az oldal fölötti elmosás helyét sötétebb fátyol vette át. Az admin „elmosás" beállítása mostantól a tervező háttérképére hat.
- Mobilnézet: az Összegzés fül nem csúszik rá az alsó gombokra; fekvő telefonon is mobil elrendezés; kompakt alsó sáv; 44 px-es érintési célok; 16 px-es beviteli mezők (iOS nem nagyít rá).

### Új (2026-10-12, kiadás előtt)
- **Gyors varázsló** hét lépésben (Alapok, Méret, Stílus, Tető, Homlokzat, Kert, Kész) asztalon és mobilon. Ugyanazt a konfigurációt, ellenőrzést és generálást használja, mint a teljes tervező; bármikor át lehet váltani. Stílusválasztáskor a stílushoz illő anyagok és színek beállnak (felhasználói értéket nem ír felül).
- Új beállítás: Arculat és elrendezés → Popup elrendezés → **Kezdőnézet** (`layout.start_view`: `wizard` | `designer`, alap: `wizard`).
- 27 új szöveg mind a 15 fordításban (nyelvenként 1592); `bin/po-tools.py`: függőség nélküli .po → .mo fordító és ellenőrző.
- Javítás: az élő vázlat égbolt-átmenete egyedi azonosítót kap (két vázlat egyszerre a DOM-ban).
- **Fotórealisztikus stílusminták** mind a 16 építészeti stílushoz (Magnific / Seedream 5 Pro, WebP 1280 + 480 px, összesen ~2,8 MB): képes stíluskártyák a tervezőben és a varázslóban, az előnézet a stílus fotója az élő vázlattal; „Stílusminta” jelöléssel.

### Új (2026-10-12, kiadás előtt) – élő vázlat és ikonok
- **Új élő 3D vázlat** (`assets/js/agh-sketch.js`, önálló modul): axonometrikus, anyagmintás (tégla, klinker, kő, fa, fém, beton, panel, vakolatstruktúra, cserépprofilok BRAMAC-családonként, korcolt lemez, zöldtető), valódi tetőgeometria (nyereg, konty, csonkakonty, félnyereg, sátor, lapos, összetett) hajlásszöggel, eresszel, oromzattal; szintek, alaprajzi forma, garázs/beálló, terasz, pergola, erkély, tornác, lépcső/rámpa, kémény, napelem, tetőablak, tetőfelépítmény, kerítés kapuval, telekhatár, kert stílusonként, gépészet (hőszivattyú, klíma, töltő, akkumulátor, esővíztartály), napszak, évszak, időjárás, kamera, árnyékok. A stílusminta-fotó kis betétkép lett, a vázlat tölti ki az előnézetet.
- Minden változtatásnál felirat jelzi, mi változott; ha a paraméter a vázlaton nem látszik (konyha, fürdő, burkolatok…), ezt kiírja – a rajz összehasonlításából, nem becslésből.
- **Opciókártyák saját képpel**: a tetőforma, szintszám, alaprajz, ablak, garázs kártyáin a látogató saját háza az adott opcióval; homlokzat- és padlóanyag-minták, belsőstílus-paletták, kert- és napszak-tájképek, konyha-alaprajzok; egyedi (admin) opcióknál színes monogram.
- **Új kategóriaikonok**: 15 egyedi, kéttónusú ikon, kategóriánként saját színnel.
- Tesztek: `node tests/sketch-test.js` (1017 rajz, 180 paraméterváltozat, 0 hiba), `node tests/e2e/sketch.js` (a valódi felületen 116 mező: ahol látszania kell, mind változtatja a vázlatot).

### Ellenőrzés
- Integrációs tesztsor 147/147, regressziós tesztek 120 + 116 + 71, licencszerver-önteszt 32/32, lint 0 hiba (részletek: `docs/TESZTJELENTES.md`).
