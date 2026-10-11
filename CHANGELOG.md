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

### Ellenőrzés
- Integrációs tesztsor 147/147, regressziós tesztek 120 + 116 + 71, licencszerver-önteszt 32/32, lint 0 hiba (részletek: `docs/TESZTJELENTES.md`).
