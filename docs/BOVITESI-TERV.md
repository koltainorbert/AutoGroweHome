# AutoGroweHome – Bővítési terv

*Kiinduló állapot: AutoGroweHome 1.0.0 (a 2026-10-11-i, 3. javítási kör utáni kód). Minden ráfordítás **becslés** fejlesztői napban (1 nap ≈ 8 óra); nem mérés. A külső idők (jogász, gyártó, lektor, szolgáltatói jóváhagyás) nincsenek benne.*

A terv előtt ellenőriztük, mi van már a kódban, hogy meglévő funkció ne szerepeljen jövőbeli feladatként (1. pont). A nyitott tételek kódelemzésen és a fejlesztői jegyzeten (`changes-round3.md`, „Továbbra is nyitott”) alapulnak; futás közben nem reprodukáltuk őket.

---

## 1. Ami már létezik (nem kell újra megírni)

| Terület | Meglévő megoldás | Hely |
|---|---|---|
| Beágyazás | `[autogrowehome]`, `[autogrowehome_button]`, `[autogrowehome_faq]`, `[autogrowehome_pricing]`, `[autogrowehome_portal]`, lebegő gomb, `#agh-open`, `window.AGH_open()` | `includes/Frontend/Frontend.php`, `assets/js/agh-loader.js` |
| Látogatói felület | Mobilon „⋯” (További lehetőségek) menü a Presetekkel, Projektjeimmel, nyelv- és módváltóval; projekttörlés a Projektjeimben; megszakított generálás megjelenítése; a hátralévő újragenerálások száma; a választott BRAMAC-termék az Összegzésben, „Gyártói ellenőrzésre vár” jellel | `assets/js/agh-designer.js`, `assets/css/agh-designer.css` |
| Szolgáltatók | Magnific (Mystic, Flux 2 Pro referencia, felskálázás, webhook: `/agh/v1/webhook/magnific/{token}`, NSFW-szűrő kapcsolója), Anthropic (tervezés, értelmezés a látogató nyelvén), teszt mód, tartalék szolgáltató, költségmentes kapcsolatteszt | `includes/Ai/` |
| Promptmotor | Verziózott modulok, nézetszabályok, stílusonkénti felülírás, `extras` modul (`{custom_params}`), hosszkorlát a negatív rész és az ügyfélszöveg megtartásával (az ügyfélszöveg rövidül utoljára), nagybetűs mondatkezdés, gyári verzió automatikus frissítése (`factory_history()`), előnézet, tesztgenerálás | `includes/Prompt/`, Admin → Promptmotor |
| Paraméterek | Dinamikus paraméterek (`custom_params` funkcióval; fordítható névvel, promptszöveggel), felülírások, katalógusszerkesztő; BRAMAC magastetőnél kötelező, nem törölhető | `includes/Params/`, `includes/Catalog/Catalog.php`, Admin → Paraméterek / Katalógus |
| Exportok | SVG-tervvázlatok, helyiséglista CSV, épület-JSON (`agh-building-v1`), DXF R12, kiegészítő CAD-exportálók (`agh_cad_exporters`), kivitelezői ZIP (a galéria végét legfeljebb 20 percig várja), statisztika CSV, projekt JSON | `includes/Generation/`, `includes/Quote/PackageBuilder.php` |
| Kivitelező | Időkorlátos, címzetthez kötött link, portál, több kivitelező, címzettenkénti kézbesítés és újraküldés, hozzáférés visszavonása, anonimizálás | `includes/Quote/` |
| Keretek | Napi generálási keret, külön újragenerálási keret, egyszeri visszatérítés költségmentes hiba, leállítás és lecserélt újragenerálás esetén, oldalszintű párhuzamossági korlát | `includes/RateLimit/`, `includes/Generation/JobQueue.php`, `Pipeline.php` |
| Licenc | Ed25519-aláírt licencprotokoll, türelmi idő (csak aktív vagy türelmi állapotból), licenc- és frissítéshívás átirányítás nélkül, frissítéskézbesítés nonce-szal és sha256-ellenőrzéssel, csomagmátrix csak tulajdonosi módban, referencia-licencszerver CLI-vel | `includes/License/`, `tools/license-server/` |
| Fizetés | Hosztolt fizetési link csomagonként/időszakonként; `PaymentGatewayInterface` saját fájlban; kapuválasztás: `agh_payment_gateway` opció → első beállított külső kapu → `external_checkout` | `includes/License/Payments.php`, `PaymentGatewayInterface.php`, `ExternalCheckoutGateway.php` |
| Adatvédelem | WP adatexportáló/-törlő (lapozva), projekt-anonimizálás (szöveges mezők törlése, `scrub_config()`), megőrzési takarítás, hozzájárulási napló (böngészőazonosító opcionálisan), titkosított kulcstárolás `AGH_SECRET_SALT`-tal salt-csere ellen | `includes/Privacy/Privacy.php`, `includes/Projects/Repository.php`, `includes/Support/Secrets.php` |
| Nyelvek | 16 nyelv (magyar forrás + 15 .po/.mo, nyelvenként 1565 szöveg, mérve), látogatói nyelvválasztó (`multilang`), az MI-tervező mind a 16 nyelvet megnevezi | `languages/`, `includes/Frontend/I18n.php`, `includes/Generation/Planner.php` |
| WP-CLI | `wp agh queue [run] [--seconds=N]`, `wp agh status`, `wp agh retention` | `includes/Cli/Command.php` |

### Meglévő bővítési pontok

| Hook | Típus | Paraméterek / elvárás |
|---|---|---|
| `agh_image_providers` | szűrő | `array id => ImageProviderInterface` (a beépített azonosítók nem írhatók felül) |
| `agh_cad_exporters` | szűrő | `array kulcs => ['label', 'callback' => callable(array $model): string, 'mime', 'ext', 'feature']`; a `feature` alapértéke `export_advanced`, a beépített `json` és `dxf` is itt van (`CadExport::exporters()`) |
| `agh_payment_gateways` | szűrő | `array id => PaymentGatewayInterface` |
| `agh_payment_gateway_id` | szűrő | az aktív fizetési kapu azonosítója (alap: az `agh_payment_gateway` opció) |
| `agh_owner_mode` | szűrő | `bool`; csak kikapcsolni tudja az `AGH_OWNER_MODE`-ot |
| `agh_prompt_variables` | szűrő | `$vars, $config, $concept, $view, $room` |
| `agh_magnific_status_path` | szűrő | `$path, $endpoint, $task_id` |
| `plugin_locale` | szűrő | az `autogrowehome` domainre |
| `agh_concepts_finished` | akció | `$project_id, $status` (`ready` / `partial` / `failed`) |
| `agh_quote_submitted` | akció | `$quote, $project` |

---

## 2. Első prioritás – élesítés előtt

### 2.1 Javítások

**1.0.0-ban megoldva** (a korábbi tervváltozatok tételei, röviden):
- újragenerálás: friss galéria, külön napi keret, a hátralévő szám a felületen, pontos és egyszeri visszatérítés;
- a leállításért bármely fázisban visszajár az egység, ha költségmentes volt;
- hosszkorlát: a negatív rész sosem vágódik, az ügyfélszöveg rövidül utoljára, mondathatáron;
- nagybetűs mondatkezdés a promptokban;
- a ZIP legfeljebb 20 percig várja a galériát, a csomagba nem kerülő nézetek nem szerepelnek hiányzóként;
- a „Belső nézetek” lépés hibával vagy kihagyással is lezárul;
- az `agh_cad_exporters` be van kötve;
- a `PaymentGatewayInterface` külön fájlban van;
- élnek a korábban holt beállítások (`gallery_rebuilds_per_day`, `store_user_agent`, `filter_nsfw`, `max_parallel_jobs` – admin mezővel); az `inline` attribútum és a `roof_color_manual` megszűnt;
- szerveroldali funkciókapuk (`contractor_email`, `floorplans`, `stats_advanced`, `export_advanced`, `branding_advanced`, `multilang`, `designer`, `custom_params`); a `basic_params` és `basic_gallery` leíró tétel, a `roles_advanced` kikerült;
- az egyedi paraméterek promptszövege bekerül a képpromptba;
- az MI-tervező és az AI-értelmezés 16 nyelve;
- javított promptszövegek, gyári verzió-frissítés csak érintetlen gyári verzión;
- kötelező BRAMAC magastetőnél, a választott termék az Összegzésben, „Gyártói ellenőrzésre vár” jel, javított termék-súgó;
- csúszó, 180 napos vendégsüti;
- `AGH_SECRET_SALT` önálló kulcsforrás, régi értékek egyszeri újratitkosítása (DB v5);
- licenc: türelmi idő csak aktív vagy türelmi állapotból, átirányítás nélküli hívások;
- teljes anonimizálás (szöveges mezők), biztonságos eltávolítás saját `AGH_PRIVATE_DIR` mellett;
- a 2. prioritásból: mobilmenü, projekttörlés, csomagmátrix-integritás, frissítési nonce.

**Nyitott tételek:**

| # | Probléma | Hely | Ráfordítás (becslés) |
|---|---|---|---|
| 1 | **Nem atomikus ellenőrzések**: az IP-nkénti egyidejűségi limit és a napi/havi költségkeret ellenőrzése nem atomikus; párhuzamos kéréseknél túlléphető. Az újragenerálás nem fogy a `limits.global_daily` keretből. | `RateLimiter`, `RestController::generate()` / `regenerate()` | 0,5–1 nap |
| 2 | **`_wpnonce` a letöltési URL-ekben**: bejelentkezett felhasználónál a kép- és ZIP-hivatkozások a WP REST-nonce-ot URL-paraméterként viszik (naplókba, előzményekbe kerülhet). Javaslat: rövid életű, célhoz kötött letöltési token. | `RestController`, `Admin/Pages.php` | 0,5–1 nap |
| 3 | **SSRF-védelem**: a kimenő kérésekhez nincs célhost-engedélylista, DNS-rebinding ellen nincs teljes védelem. | `includes/Support/Http.php` | 0,5–1 nap |
| 4 | **Vendégprojektek GDPR-exportja**: ajánlatkérés nélküli vendégprojekt e-mail-cím alapján nem kereshető (nincs hozzá e-mail). Döntés kell: dokumentált korlát, vagy azonosító-alapú (pl. a vendégsütiből kért) export. | `includes/Privacy/Privacy.php` | 0,25–0,5 nap |
| 5 | **Egyedi GYIK és gyorsbemutató egynyelvű**: az adminban szerkesztett tartalom nem fordítható nyelvenként. | `includes/Frontend/Help.php` | 1–2 nap |
| 6 | **Épületmodell maradékai**: U-alak keskeny főépületnél; területeltérés-figyelmeztetés többszintes háznál. | `includes/Generation/BuildingModel.php` | 1–2 nap |
| 7 | **„Törölt” projektek az adminban**: az anonimizált (`deleted`) projektek a listából ki vannak zárva, és nem is szűrhetők. | Admin → Projektek | 0,25 nap |
| 8 | **Hiányzó `LICENSE.txt`**: a plugin fejléce („License: Commercial (see LICENSE.txt)”) nem létező fájlra hivatkozik. | `autogrowehome.php` | 0,1 nap + jogász |

**Tudatos döntések és alapvető korlátok** (nem hiba, de dokumentálni kell):
- **Licenc megkerülhetősége:** a licenc PHP-kódban érvényesül, az állapotot az `agh_license` opció aláírás nélkül tárolja. Teljesen nem zárható ki; a küszöb emelhető, ha a plugin az aláírt szerverválaszt tárolja, és minden olvasáskor újraellenőrzi (0,5–1 nap, becslés).
- **Kivitelezői link:** a lejáratig többször beváltható – szándékosan, címzetthez kötve, visszavonhatóan. Egyszer használatos mód igény esetén: 0,5 nap (becslés).

### 2.2 Éles validáció

| Feladat | Mit kell mérni | Ráfordítás (becslés) |
|---|---|---|
| Éles kulcsos végponttól végpontig próba (Magnific + Anthropic) | generálási idő, valós felbontások, költség/kérés, NSFW-szűrő, webhook, felskálázás, hibaágak (402, 429), a 3900 karakteres prompthatár valós szolgáltatói korlátja | 1–2 nap + szolgáltatói költség |
| MySQL/MariaDB telepítés, teljes tesztsor | táblák létrehozása, `INSERT IGNORE`/feltételes `UPDATE` atomikussága, párhuzamos limitteszt újramérése (a 12 párhuzamos kéréses mérés a javítások előtt készült) | 1–2 nap |
| Éles tárhely valódi cronnal | `wp agh queue run` percenként, Nginx-védelem / `AGH_PRIVATE_DIR` | 0,5–1 nap |
| E-mail-kézbesítés | SMTP, SPF/DKIM, kivitelezői és ügyféllevél több nyelven | 0,5 nap |

### 2.3 Tartalmi és jogi ellenőrzés (külső)

- Jogi szövegek (ÁSZF, adatkezelési tájékoztató, hozzájárulási szövegek) jogászi átnézése – a beépített szöveg sablon.
- BRAMAC-katalógus gyártói ellenőrzése, a termékek „ellenőrzött” jelölése (addig a felület „Gyártói ellenőrzésre vár” jelet mutat, az admin figyelmeztet).
- Fejlesztői oldali támogatás: 0,5–1 nap (becslés).

---

## 3. Második prioritás – üzleti funkciók

| Tétel | Leírás | Ráfordítás (becslés) |
|---|---|---|
| **Fizetési adapterek** (Stripe, Barion, SimplePay) | Fizetési szolgáltató nincs beépítve. Plugin-oldalon `PaymentGatewayInterface`-implementáció az `agh_payment_gateways` szűrőn. A kapuválasztásnak nincs admin felülete (az `agh_payment_gateway` opció vagy az `agh_payment_gateway_id` szűrő dönt) – ha kell, egy választómező. Licencszerver-oldalon aláírt webhook-végpont, amely a meglévő `create()` / `extend()` / `set_status()` műveletet hívja – ilyen végpont a referencia-szerverben még nincs. Kártyaadat továbbra sem érintheti a rendszert. | szolgáltatónként 2–4 nap + sandbox-teszt; választómező 0,25 nap |
| **CRM-webhook** az `agh_quote_submitted` akcióra | Beállítható URL, HMAC-aláírás, újrapróbálás a meglévő feladatsorban; csak a hozzájárulás által lefedett adatok. | 1–2 nap |
| **Anyanyelvi fordítás-lektorálás** | 15 nyelv × 1565 szöveg (mérve; MI-vel készültek). | külső; integráció 0,5 nap |

---

## 4. Harmadik prioritás – bővítések

| Tétel | Leírás | Ráfordítás (becslés) |
|---|---|---|
| **További képszolgáltatók** | Az `ImageProviderInterface` (`id`, `label`, `configured`, `capabilities`, `submit`, `status`, `test`) megvalósítása és regisztrálása az `agh_image_providers` szűrőn. | szolgáltatónként 2–3 nap |
| **IFC-exportáló** | Az `agh_cad_exporters` szűrőn (`ext: ifc`, saját `feature`). Alap IFC4: falak, födémek, nyílások, terek az `agh-building-v1` modellből. | 5–10 nap |
| **BRAMAC-katalógus szinkron** | Jelenleg egyszeri, viszonteladói adatokból töltött katalógus. Szinkron gyártói adatforrásból – nem ismert, hogy a gyártó ad-e ehhez API-t; alternatíva a CSV-import. | 2–4 nap (forrástól függ) |
| **További hookok** | Pl. a kész prompt szűrője, generálás előtti/utáni akció, kép tárolása utáni akció, csomagtartalom-szűrő, e-mail-címzettek szűrője, licencállapot-változás akció. | 1–2 nap |
| **Gutenberg-blokk** | Jelenleg csak shortcode van. Blokkok: indítógomb, GYIK, árlap, portál. | 1–2 nap |
| **Oldalépítő-elemek** | Pl. Bricks vagy Elementor elem az indítógombhoz (a shortcode ezekben már most is működik). | elemenként 1–2 nap |
| **Belső nézetek konzisztenciája** | Referencia- vagy stílusképpel, mint a külső nézeteknél (most referenciakép nélkül készülnek). | 1 nap + képminőségi teszt |
| **Finomhangolt jogosultságok** | Új funkcióként (a megvalósítás nélküli `roles_advanced` kulcs kikerült a katalógusból). | 1–2 nap |
| **Licencszerver MySQL-port** | A README szerinti átírás + tesztek. | 1–2 nap |

---

## 5. Javasolt sorrend

1. 2.1 nyitott tételei (kb. 4–8 nap, becslés) → 2.2 éles validáció (kb. 3–5,5 nap + szolgáltatói költség, becslés) → 2.3 párhuzamosan, külső szereplőkkel.
2. Fizetési adapter az elsődleges piaci szolgáltatóhoz.
3. A többi tétel üzleti igény szerint.
