# AutoGroweHome 1.0.0 – Tesztjelentés

> **Dátum:** 2026-10-11 (a 3. javítási kör utáni kódállapot) · **Plugin:** AutoGroweHome 1.0.0 (`AGH_VERSION`), `AGH_DB_VERSION = 5`, forrás: `/home/claude/autogrowehome`
> Az alábbi számok vagy ezen a napon, ebben a futásban mért értékek, vagy **„korábbi mérés, ugyanebben a munkamenetben”** jelöléssel szerepelnek. Ami nem mérhető vagy nem ellenőrzött, azt külön jelezzük (11. fejezet).

---

## 1. Környezet

| Elem | Érték | Forrás |
|---|---|---|
| PHP | 8.3.6 (cli, NTS) | mérve (`php -v`) |
| WordPress | 7.2-alpha-64298 (trunk) | mérve (`$wp_version`, WP-CLI) |
| Adatbázis | SQLite Database Integration 3.1.0 drop-in (`DB_ENGINE = sqlite`) – **nem MySQL/MariaDB** | mérve (WP-CLI) |
| libsodium | elérhető | mérve |
| Node.js | v22.22.0 (csak JS-szintaxisellenőrzéshez) | mérve |
| Plugin telepítése | `/home/claude/wpsite/wp-content/plugins/autogrowehome` → symlink a forrásra, aktív | eligazítás + WP-CLI |
| Funkciószint | integrációs tesztsor: `AGH_OWNER_MODE` (minden funkció); a regressziós tesztek egy része ügyféloldali (nem tulajdonosi) módot is szimulál (`agh_owner_mode` szűrő) | tesztkimenet, `tests/regression-y1.php` |
| Külső szolgáltatások | Magnific, Anthropic és licencszerver-HTTP **szimulálva** (`pre_http_request`); e-mail **elfogva** (`pre_wp_mail`) | a tesztfájlok szűrői |
| Böngésző (E2E) | Chromium (Playwright) | korábbi mérés, ugyanebben a munkamenetben |

---

## 2. Összefoglaló

| Tesztsor | Sikeres | Sikertelen | Futásidő* | Megjegyzés |
|---|---:|---:|---|---|
| Integrációs tesztsor (`tests/integration-test.php`) | **147** | **0** | 5,2 s | 23 szakasz; a C.15-javítás utáni külön futás (új szakasz: „Keret-visszatérítés: nulla egységár mellett sem ingyenes a fizetős hívás”, 2 ellenőrzés); a többi ellenőrzésnév változatlan. |
| Regresszió X – motor (`tests/regression-x.php`) | **120** | **0** | 0,7 s | 31 szakasz (X1–X19 és a 3. kör X3-1–X3-13 szakaszai). |
| Regresszió Y1 – backend (`tests/regression-y1.php`) | **116** | **0** | 3,5 s | 22 szakasz; a kimenet csak az összegző sort írja ki. |
| Regresszió Y2 – felület (`tests/regression-y2.php`) | **71** | **0** | 0,4 s | 15 szakasz; a kimenet csak az összegző sort írja ki. |
| Licencszerver-önteszt (`tools/license-server/tests/selftest.php`) | **32** | **0** | 0,15 s | a 10 folyamatú (`pcntl_fork`) párhuzamos aktiválási teszt is lefutott. |
| **Összesen (automatikus ellenőrzés)** | **486** | **0** | – | |
| PHP-szintaxis (`php -l`) | 71 fájl | 0 | – | |
| JS-szintaxis (`node --check`) | 5 fájl | 0 | – | |
| Fordítási fájlok (`languages/*.po`) | 15 nyelv | 0 | – | nyelvenként 1565 bejegyzés, 0 fordítatlan, 0 fuzzy (mérve, 9.4). |

\* Falióra-idő a WP-CLI indulásával együtt (`date` a parancs előtt és után); minden tesztsor **egyszer** futott, kilépési kód mindegyiknél 0. A `Pipeline::cost_free()` javítása után a koordinátor az összes tesztsort újrafuttatta (végleges állapot, 2026-10-11): integráció 147/147, regression-x 120/120, regression-y1 116/116, regression-y2 71/71, licencszerver 32/32, `php -l` 0 hiba.

**A tesztsorok pontos összegző sorai (2026-10-11, a 3. javítási kör után):**

```text
ÖSSZESEN: 147 sikeres, 0 sikertelen
REGRESSZIÓ x: 120 sikeres, 0 sikertelen
REGRESSZIÓ y1: 116 sikeres, 0 sikertelen
REGRESSZIÓ y2: 71 sikeres, 0 sikertelen
Licencszerver önteszt: 32 sikeres, 0 sikertelen
```

### Futtatott parancsok

```bash
# WordPress-en belüli tesztsorok (egyszer futtatva)
cd /home/claude/wpsite && for f in integration-test regression-x regression-y1 regression-y2; do
  timeout 400 php /tmp/wp-cli.phar --allow-root eval-file wp-content/plugins/autogrowehome/tests/$f.php
done

# Licencszerver-önteszt
php /home/claude/autogrowehome/tools/license-server/tests/selftest.php

# PHP-szintaxis: a nem „No syntax errors” sorok száma → 0
find /home/claude/autogrowehome -name '*.php' -print0 | xargs -0 -n1 php -l | grep -vc 'No syntax errors'

# JS-szintaxis: kimenet nélkül fut le, ha nincs hiba
for f in /home/claude/autogrowehome/assets/js/*.js; do node --check "$f"; done
```

A regressziós tesztek önállóak: saját ideiglenes adatokkal dolgoznak, a beállításokat memóriában írják felül, a végén takarítanak (a fájlok fejléce szerint; a takarítást a „takarítás: rendben”, „Takarítás: ideiglenes projektek törölve”, „Takarítás: projekt és ajánlatkérés törölve” ellenőrzések igazolják).

---

## 3. Integrációs tesztsor – szakaszok és ellenőrzések

A lista a 2026-10-11-i, 3. javítási kör utáni futás kimenetéből szó szerint átvett ellenőrzésneveket tartalmazza (✓ = sikeres). A tesztsor a WordPress-példányon belül fut (`wp eval-file`), a REST-végpontokat belső `WP_REST_Request` kérésekkel hívja.


### 3.1. Telepítés, migráció, alapadatok (10/10)

- ✓ 13 tábla létezik és lekérdezhető
- ✓ DB-verzió rögzítve
- ✓ Kivitelező szerepkör létrejött
- ✓ Védett tárhely .htaccess + index.php
- ✓ Tárhely: path traversal elutasítva
- ✓ Csomagok: Starter < Professional < Agency funkciók (adatvezérelt)
- ✓ Teszt környezet: AGH_OWNER_MODE (minden funkció)
- ✓ Paraméterséma: 129 mező, 15 kategória
- ✓ BRAMAC márka + termékek a katalógusban
- ✓ Gyári promptverzió aktív

### 3.2. Paraméter-validáció és ellentmondások (9/9)

- ✓ Tetőtér + lapostető → hiba
- ✓ Túl kicsi alapterület a helyiségszámhoz → hiba
- ✓ Ismeretlen mező eldobva
- ✓ Szám a maximumra vágva
- ✓ Érvénytelen szín → alapérték
- ✓ Multiselect: csak engedett értékek
- ✓ Szabad szöveg tisztítva
- ✓ Alapkonfiguráció hibamentes
- ✓ Automatikus helyiségprogram (12 helyiség)

### 3.3. Tervrajz-modul (strukturált geometria → SVG) (10/10)

- ✓ Nettó terület eltérés -0.1% (<10%)
- ✓ Helyiségek nem fedik egymást
- ✓ Minden helyiség az épület kontúrján belül
- ✓ Pontosan egy bejárati ajtó
- ✓ A/B/C változat geometriája eltér
- ✓ Lépcső pozíciója szintek között egyezik
- ✓ SVG tervlapok (10 db, kétszintes) érvényes XML
- ✓ SVG: felhasználói szöveg escape-elve
- ✓ CSV formula-injekció elleni védelem
- ✓ DXF export (CAD-interfész)

### 3.4. Promptmotor (7/7)

- ✓ Hero prompt tartalmazza a stílust és tetőt
- ✓ Negatív instrukciók külön modulban
- ✓ Nincs feloldatlan változó
- ✓ Belső prompt tartalmazza a helyiség méretét
- ✓ Felhasználói szöveg „csak leíró” keretben
- ✓ Új promptverzió mentése és aktiválása
- ✓ Korábbi verzió visszaállítása

### 3.5. API-kulcs nélküli állapot és REST-védelem (6/6)

- ✓ Kulcs nélkül a generálás 503 + egyértelmű üzenet
- ✓ Nonce nélküli POST elutasítva (401)
- ✓ Admin végpont vendégnek tiltott
- ✓ Bootstrap nem tartalmaz kulcsot
- ✓ API-kulcs titkosítva tárolva, visszafejthető
- ✓ Kulcs maszkolt megjelenítése

### 3.6. Magnific adapter – dokumentált szerződés (szimulált HTTP) (10/10)

- ✓ POST /v1/ai/mystic + x-magnific-api-key fejléc
- ✓ Mystic törzs: aspect_ratio, resolution, model
- ✓ CREATED → pending, task referencia
- ✓ GET /v1/ai/mystic/{task-id} → IN_PROGRESS
- ✓ COMPLETED → generated URL
- ✓ Referenciás nézet: flux-2-pro input_image + width ≤ 1440
- ✓ 401 → nem átmeneti, érthető hiba
- ✓ Kapcsolat teszt jelzi az elutasított kulcsot
- ✓ Kapcsolat teszt (költségmentes) rendben
- ✓ Felskálázó végpont szerződés

### 3.7. Anthropic adapter – Messages API + kényszerített tool use (szimulált) (7/7)

- ✓ x-api-key + anthropic-version fejléc
- ✓ Kényszerített tool use sémával
- ✓ Ügyfélszöveg elhatárolva, < > semlegesítve
- ✓ Érvényes AI-válasz → 3 koncepció
- ✓ Ismeretlen helyiség-azonosító kiszűrve
- ✓ Sémahibás AI-válasz → szabályalapú tartalék + naplózás
- ✓ Anthropic kapcsolat teszt a /v1/models végponttal

### 3.8. Teljes folyamat: generálás → 3 koncepció → kiválasztás → galéria (Magnific szimuláció) (17/17)

- ✓ Generálás elfogadva (202)
- ✓ Vendég munkamenet-süti létrejött
- ✓ Projekt állapota: ready
- ✓ 3 különálló koncepció
- ✓ Koncepciók külön azonosítóval
- ✓ Mindhárom fő kép elkészült, különálló fájl, valós méret
- ✓ Felbontás-címke a tényleges pixelméretből (nem 4K)
- ✓ Tervvázlatok a koncepcióhoz (7 lap)
- ✓ Valós haladás: 100%, 8 szakasz
- ✓ Kiválasztás előtt nincs letöltési link
- ✓ Koncepció kiválasztva
- ✓ Galéria: 7 külső nézet kész
- ✓ Galéria: 2 belső nézet (limit: 2)
- ✓ Kiválasztott ház fő képe letölthető
- ✓ Nem kiválasztott ház: nincs galéria, nincs letöltés
- ✓ Nézetek a fő képpel mint referenciával készültek (8)
- ✓ Költségnapló bejegyzések (12)

### 3.9. Képek hozzáférés-védelme (4/4)

- ✓ Idegen látogató nem éri el a képet
- ✓ Idegen látogató nem látja a projektet (404)
- ✓ Tulajdonos: kiválasztott fő kép előnézet + letöltés
- ✓ Tulajdonos: galéria csak előnézet, teljes méret nem

### 3.10. Projekt mentése és visszatöltése (4/4)

- ✓ Mentés névvel (HTML eltávolítva)
- ✓ Saját projektek listája
- ✓ Konfiguráció visszatöltve
- ✓ Duplikált kérés kiszűrve (meglévő projekt, keret nélkül)

### 3.11. Ajánlatkérés, hozzájárulások, kivitelezői csomag, e-mail (12/12)

- ✓ Hiányzó kötelező hozzájárulás → nem továbbítható
- ✓ Honeypot spamvédelem
- ✓ Ajánlatkérés rögzítve (marketing nélkül is)
- ✓ Csomag elkészült, kivitelező értesítve
- ✓ Hozzájárulási + továbbítási napló (verzióval)
- ✓ Marketing-hozzájárulás külön, nem megadottként naplózva
- ✓ ZIP: rendezett mappaszerkezet (27 fájl)
- ✓ ZIP: nincs ../ vagy abszolút útvonal
- ✓ Képmetaadatok CSV (felbontás, szolgáltató)
- ✓ E-mail: kivitelező + ügyfél-visszaigazolás
- ✓ Hozzáférési token csak az URL # részében
- ✓ Nincs nagy csatolmány az e-mailben

### 3.12. Kivitelezői hozzáférés (időkorlátos, jogosultságvédett) (6/6)

- ✓ Munkamenet nélkül nincs hozzáférés
- ✓ Érvénytelen token elutasítva
- ✓ Érvényes link → HttpOnly munkamenet-süti
- ✓ Kivitelező látja a csomagot és az elérhetőségeket
- ✓ Kivitelező eléri a teljes méretű képeket
- ✓ Lejárt munkamenet → nincs hozzáférés

### 3.13. IP-alapú napi limit (egy kérés = 3 koncepció = 1 egység) (8/8)

- ✓ Napi 3 kérés engedélyezett, a 4. elutasítva (202,202,202,429)
- ✓ Egy kérés egy egység (nem 3)
- ✓ Limit nem számolja a koncepciókat külön
- ✓ Nem megbízható proxy: X-Forwarded-For figyelmen kívül
- ✓ Megbízható proxy (CIDR): valós kliens IP
- ✓ XFF lánc: jobbról az első nem megbízható cím
- ✓ IP-cím csak hash-elve tárolódik
- ✓ Keret-visszatérítés (refund) működik

### 3.14. Hibás API-válasz, időtúllépés, tartalék, megszakítás (5/5)

- ✓ Szolgáltatói FAILED → projekt failed, újrapróbálás után
- ✓ Hibaok rögzítve az elemnél
- ✓ Elsődleges szolgáltató hibája → tartalék szolgáltató, képek jelölve
- ✓ Időtúllépés kezelése
- ✓ Feladat megszakítható

### 3.15. Párhuzamos zárolás (atomikus job-claim) (1/1)

- ✓ Ugyanazt a feladatot két worker nem kapja meg

### 3.16. Adminisztrációs paraméterbővítés (5/5)

- ✓ Új paraméter mentése programozás nélkül
- ✓ Megjelenik a frontend sémában
- ✓ Validálás és promptba kerülés
- ✓ Hibás definíció elutasítva
- ✓ Prompt-sablon: kód és ismeretlen változó eltávolítva

### 3.17. Licenc – aláírt szerverválasz (3/3)

- ✓ Érvényes Ed25519 aláírás elfogadva
- ✓ Manipulált válasz elutasítva
- ✓ Licenc nélkül Starter (adatvesztés nélkül)

### 3.18. Licenc – plugin ↔ referencia-licencszerver (végponttól végpontig) (11/11)

- ✓ Aktiválás a szerveren → Professional, aláírás ellenőrizve
- ✓ Időszakos ellenőrzés sikeres
- ✓ Manipulált szerverválasz elutasítva, állapot változatlan
- ✓ Második weboldal: weboldal-limit, Starter szint
- ✓ Szerver elérhetetlen → türelmi idő, funkciók megmaradnak
- ✓ Türelmi idő (14 nap) után Starter – beállítások megmaradnak
- ✓ Frissítés felkínálva, a csomag-URL nem tartalmaz kulcsot
- ✓ Csomagletöltés: kulcs fejlécben, 200
- ✓ Idegen URL-re nem kerül licenckulcs
- ✓ Deaktiválás: hely felszabadul, Starter
- ✓ Szerveroldalon 0 aktív oldal

### 3.19. GDPR – export, törlés, adatmegőrzés (3/3)

- ✓ Személyes adatok exportálhatók e-mail alapján
- ✓ Törlés: ajánlatkérés anonimizálva
- ✓ Projekt törlése a fájlokkal együtt

### 3.20. Teszt mód (helyi szolgáltató) – jelölt képek (2/2)

- ✓ Frontend jelzi a teszt módot
- ✓ Teszt képek elkészülnek, is_test jelöléssel

### 3.21. Többnyelvűség (3/3)

- ✓ .pot sablon létezik
- ✓ Lefordított nyelvi fájlok: 15
- ✓ Nyelvváltás németre: „Grunddaten”

### 3.22. Keret-visszatérítés: nulla egységár mellett sem ingyenes a fizetős hívás (2/2)

- ✓ Fizetős hívás nélkül a projekt költségmentes
- ✓ 0-s egységárú, elfogadott szolgáltatói hívás után nem jár vissza a keret

### 3.23. Bővítési pontok (akciók) (2/2)

- ✓ agh_concepts_finished lefutott (5×)
- ✓ agh_quote_submitted lefutott ajánlat- és projektazonosítóval

---

## 4. Regressziós tesztsor X – motor (`tests/regression-x.php`)

A javítási körök motor-oldali változásait ellenőrzi (haladáskijelzés, megszakítás, újragenerálás, promptmotor, egyedi paraméterek, tervezőnyelvek, CAD-exportálók, feladatzár, párhuzamossági korlát, HTTP-átirányítás és letöltés, https-only URL-ek, naplóredakció, titkosítás, épületmodell, BRAMAC, paraméterszerkesztő, fájlnevek; a 3. körből: poll-bérlet, közös végpontszabály, katalógusvédelem, kerettérítés, promptvágás, `custom_params` kapu, `Http::request()` opciók, `AGH_SECRET_SALT` mint egyedüli kulcsforrás). A szakaszok sorrendje a futás sorrendje. A szakasz- és ellenőrzésnevek a futás kimenetéből szó szerint valók (angolul íródtak); ✓ = sikeres.

#### X.1. X6 – prompt factory defaults and upgrade (7/7)

- ✓ Revision-1 factory payload is recognised as untouched
- ✓ An admin-edited version is NOT treated as factory default
- ✓ Defaults revision recorded (2)
- ✓ Non-factory (or already upgraded) active version left untouched
- ✓ massing and roof modules end with a full stop
- ✓ Island kitchen phrase: "large island kitchen"
- ✓ Rule-based descriptions: "… modern minimalist house", no "architecture house"

#### X.2. X5 – admin-defined parameters reach the image prompts (7/7)

- ✓ Two custom parameters saved
- ✓ Exterior prompt: garden custom param in, kitchen custom param out
- ✓ Interior prompt: kitchen custom param in (select phrase w/o template), garden one out
- ✓ {custom_params} variable exists and is listed for the admin
- ✓ Older prompt version v1: custom phrase auto-inserted (before output)
- ✓ Without custom values the extras module is skipped
- ✓ agh_prompt_variables filter still applies (also to custom_params)

#### X.3. X4 – combined() keeps the negative part, shortens the middle (6/6)

- ✓ Test prompt is over the limit (5098 > 3900)
- ✓ Combined prompt within the limit (3861)
- ✓ Negative list kept whole at the end
- ✓ Rule, role and output/quality modules intact
- ✓ Without parts: body shortened, negative kept
- ✓ Provider guard clip() caps at MAX_PROMPT

#### X.4. X1 – honest progress (archived/cancelled excluded, failed final) (4/4)

- ✓ Totals exclude archived/cancelled (ext 2, int 2)
- ✓ Percent reaches 100 after regenerate/cancel (100)
- ✓ Interior stage done with 1 error (not active forever)
- ✓ All interior images failed → stage "error"

#### X.5. X2 – cancel during planning (6/6)

- ✓ Queued project → status "cancelled" (not ready)
- ✓ agh_concepts_finished not fired for a cancelled project without concepts
- ✓ Reserved daily unit refunded (nothing spent)
- ✓ Zero concepts: never finalised as ready
- ✓ Cancelled mid-planning: no concepts, status stays "cancelled"
- ✓ Plan job completed, unit refunded

#### X.6. X3 – regenerated concept gets a fresh gallery (3/3)

- ✓ Archived/cancelled views are re-queued (2 images)
- ✓ New gallery asset gets the next version (v2) – old file kept
- ✓ Live (queued) images are not duplicated

#### X.7. X7 – planner languages (4/4)

- ✓ All 16 supported locales mapped (no Hungarian fallback for non-hu)
- ✓ sr_RS / uk / en_AU names
- ✓ Rule-based names follow the project locale (de: "Klare Form")
- ✓ uk: "Чиста форма"

#### X.8. X8 – agh_cad_exporters is used (2/2)

- ✓ Default exporters: building_json + dxf
- ✓ Registered exporter stored as a document; failing exporter skipped

#### X.9. X9 – lock duration and lock-token ownership (7/7)

- ✓ Lock (513 s) > worst-case Anthropic call (273 s)
- ✓ Claimed lock lasts ~lock_seconds() (513 s)
- ✓ Expired lock re-claimed by a second worker
- ✓ Stale worker complete() rejected – job untouched
- ✓ Stale worker fail() rejected (returns "not mine")
- ✓ Stale worker wait() rejected
- ✓ Owner complete() succeeds

#### X.10. X10 – limits.max_parallel_jobs (4/4)

- ✓ Slots limited to max_parallel_jobs (1)
- ✓ run() does not start a job while all slots are busy
- ✓ After release the job runs
- ✓ max_parallel_jobs = 0 → unlimited

#### X.11. X11 / X12 – Magnific filter_nsfw, redirects, downloads (10/10)

- ✓ filter_nsfw default true
- ✓ filter_nsfw follows the setting (false)
- ✓ Request with x-magnific-api-key: redirection = 0
- ✓ x-api-key → no redirects; keyless request keeps 2
- ✓ Redirect followed hop by hop with wp_safe_remote_get (reject_unsafe_urls)
- ✓ Redirect to http:// rejected (no downgrade)
- ✓ Initial http:// URL rejected
- ✓ Redirect loop stops (max 3)
- ✓ Non-image content type rejected
- ✓ Oversized body rejected

#### X.12. X13 – https-only provider URLs (4/4)

- ✓ sanitize_https_url: http and credentials rejected, https kept
- ✓ Endpoint paths: relative path only
- ✓ Insecure stored URLs fall back to the https defaults on read
- ✓ update_group() never stores an http:// base URL

#### X.13. X14 – log redaction (4/4)

- ✓ Header value, Bearer token, sk-ant key and licence key masked
- ✓ Task UUIDs stay readable
- ✓ Context values redacted (pattern + key name)
- ✓ Stored log message is redacted

#### X.14. X15 – secrets: separate keys, legacy compatibility (4/4)

- ✓ Legacy o1 value still decrypts
- ✓ Legacy value re-encrypted with the current scheme
- ✓ o2 value (separate enc/MAC keys) decrypts
- ✓ o2 with MAC made by the encryption key is rejected

#### X.15. X16 – building model: default rooms and stairs (4/4)

- ✓ "Too narrow" warnings in 21 default layouts: 0 (before the fix: 67)
- ✓ Stairs aligned on every floor (misaligned: 0, before: 3)
- ✓ No overlapping rooms (overlaps: 0, before: 8)
- ✓ Upper floor with only auto-added stairs: same position (9.48,0.44 / 9.48,0.44)

#### X.16. X17 – mandatory BRAMAC roof (8/8)

- ✓ Required brand from catalogue flag: 'bramac'
- ✓ Pitched roof without product → BRAMAC product auto-selected (bramac-romai-antracit)
- ✓ Reported as information, not as an error
- ✓ Auto product matches the chosen roof colour (bramac-romai-teglavoros)
- ✓ Visitor choice kept, no note
- ✓ Other brand → BRAMAC with an information note
- ✓ Flat roof: not applicable, nothing forced
- ✓ Brand select offers only the mandatory brand

#### X.17. X18 – custom parameter editor data (4/4)

- ✓ Multiselect default "a, b" → [a, b]
- ✓ "in" condition stored as a list and matches
- ✓ Old text-stored "in" lists are normalised on load
- ✓ Without the custom_params feature save_custom() refuses

#### X.18. X19 – upscaled file names (2/2)

- ✓ Stored as "renders-A-hero-v2-upscaled.png"
- ✓ No double "-upscaled" either

#### X.19. X3-2 – poll_tick throttle: lease released at the end, then 5 s pause (2/2)

- ✓ Lease released with the finishing time (1791736680), not held for the budget
- ✓ A second tick within 5 s is refused

#### X.20. X3-3 – endpoint path rule shared by settings and task references (2/2)

- ✓ Sanitizer and validator agree; dots rejected in both
- ✓ Status check rejects the same paths

#### X.21. X3-5 – Magnific docblock lists only sent fields (1/1)

- ✓ No hdr / smart_grain / input_image_4 in the contract header

#### X.22. X3-6 – catalogue edits keep flags; BRAMAC stays mandatory (4/4)

- ✓ Admin-style edit (no "required", status hidden) keeps BRAMAC required and published
- ✓ BRAMAC cannot be deleted
- ✓ Product "recommended" (and other unposted keys) preserved, posted keys updated
- ✓ Flag lost by an earlier edit: BRAMAC still counts as required

#### X.23. X3-7 – rebuild refund: the rebuild unit, never the original one (3/3)

- ✓ New main image failed (no provider)
- ✓ Rebuild unit given back, original unit NOT
- ✓ Rebuild refund happens only once

#### X.24. X3-8 – cancel during rendering refunds once when nothing was spent (3/3)

- ✓ Cancelled while rendering, no cost → unit back
- ✓ Second cancel: no second refund
- ✓ An image was already produced → no refund

#### X.25. X3-9 – client text is shortened last, at a sentence boundary (3/3)

- ✓ Over-long prompt fitted (3900)
- ✓ Client wishes kept in full while other modules were shortened
- ✓ Free text over 600 chars cut after a whole sentence

#### X.26. X3-10 – custom parameters require the custom_params feature (2/2)

- ✓ Without the feature stored custom parameters are inactive
- ✓ With the feature they are active again

#### X.27. X3-11 – sentences start with a capital letter (2/2)

- ✓ No lower-case sentence start in hero + interior prompts
- ✓ DefaultModules header names revision 2; earlier revisions listed for the migration

#### X.28. X3-12 – Http::request( …, array $opts ) (1/1)

- ✓ opts redirection 0 honoured, cannot raise it for keyed requests, default unchanged

#### X.29. X3-13 – product help text matches the data (1/1)

- ✓ Help no longer claims "verified"; options carry the verified flag

#### X.30. X3-4 – interpret answers in the request language (1/1)

- ✓ Reasons requested in Polish / German (visitor locale)

#### X.31. X3-1 – AGH_SECRET_SALT is the sole key source (in-memory store) (5/5)

- ✓ Value written before AGH_SECRET_SALT still readable
- ✓ … and re-encrypted with the salt-only key
- ✓ WordPress salt rotation does not affect it any more
- ✓ Secrets::upgrade_storage() migrated 2 legacy values (readable after salt rotation)
- ✓ upgrade_storage() is idempotent

A futás végén: „takarítás: rendben”, majd `REGRESSZIÓ x: 120 sikeres, 0 sikertelen`.

---

## 5. Regressziós tesztsor Y1 – backend (`tests/regression-y1.php`)

A futás **csak az összegző sort** írja ki (`REGRESSZIÓ y1: 116 sikeres, 0 sikertelen`); sikertelen ellenőrzésnél „HIBA: …” sort írna, ilyen nem volt. Ezért az alábbi szakasz- és ellenőrzésneveket a tesztfájl `$t( … )` hívásaiból és szakaszmegjegyzéseiből gyűjtöttük ki: 112 egyedi hívás + egy 4 elemű ciklus („Y1-3-5 {$prev} licencből szerverhiba nem indít türelmi időt”, `expired`, `site_limit`, `invalid`, `inactive`) = 116. Egy `false` feltételű hibaág („Y1-22 megszakítási projekt létrejött”) csak akkor fut, ha a tesztprojekt nem jön létre – nem futott, nem számít bele. Mind a 116 sikeres volt.

#### Y1.1. Y1-1 CLI (2)

- Y1-1 `wp agh queue run` működik
- Y1-1 `wp agh queue --seconds` továbbra is működik

#### Y1.2. Y1-10 IPv6 /64 (5)

- Y1-10 IPv6: azonos /64 → azonos hash
- Y1-10 IPv6: másik /64 → eltérő hash
- Y1-10 IPv4 teljes címmel
- Y1-10 IPv4-mapped IPv6 = IPv4
- Y1-10 megbízható proxy mögött is /64

#### Y1.3. Y1-16 guest nonce + Y1-11 cookie (9)

- Y1-16 első bootstrap: vendégsüti + nonce
- Y1-16 a saját sütihez kötött nonce érvényes
- Y1-11 bootstrap megújítja, de nem cseréli a vendégazonosítót
- Y1-16 másik vendég nonce-a nem használható
- Y1-16 süti nélkül nincs érvényes nonce
- Y1-16 a régi közös vendég-nonce (wp_create_nonce) elutasítva
- Y1-16 egyedi fejléc továbbra is kötelező
- Y1-11 vendégsüti élettartama = max(vázlat, mentett projekt megőrzés)
- Y1-11 élettartam követi a megőrzési beállítást

#### Y1.4. Y1-2 logged-in identity (8)

- Y1-2 X-WP-Nonce nélkül a WP REST vendégként kezeli
- Y1-2 érvényes X-WP-Nonce → bejelentkezett felhasználó
- Y1-2/16 vendégként kapott nonce bejelentkezett hívásnál is érvényes
- Y1-2/16 bejelentkezve (süti nélkül) felhasználóhoz kötött nonce
- Y1-2 generálás a felhasználó nevére
- Y1-2 Projektjeim a felhasználó projektjeit adja
- Y1-2 felhasználónkénti napi limit érvényesül
- Y1-2 felhasználói presetek mentése

#### Y1.5. guest project for the rest (2)

- Vendég generálás (teszt képszolgáltató)
- Projekt elkészült (3 koncepció)

#### Y1.6. Y1-3 regenerate allowance (5)

- Y1-3 hibás módosítás: 422 és a keret visszajár
- Y1-3 költségkeret-ellenőrzés újragenerálásnál is
- Y1-3 újragenerálás elindul (202)
- Y1-3 nem fogyaszt teljes generálási egységet
- Y1-3 limits.gallery_rebuilds_per_day érvényesül (429)

#### Y1.7. Y1-22 cancel (1)

- Y1-22 megszakítás koncepció nélkül → status cancelled

#### Y1.8. Y1-13/21 delete (1)

- Y1-13 törlés: sor és fájlok eltávolítva

#### Y1.9. Y1-12 quote token + Y1-17 UA (9)

- Y1-12 quote-token végpont: \<ts\>.\<hmac\>
- Y1-12 token nélkül elutasítva ("started" figyelmen kívül)
- Y1-12 hamis token elutasítva
- Y1-12 3 mp-nél frissebb token elutasítva
- Y1-12 2 óránál régebbi token elutasítva
- Y1-12 más projekthez kiadott token elutasítva
- Y1-12 érvényes tokennel rögzítve (201)
- Y1-17 user agent a hozzájárulási naplóban (bekapcsolva)
- Y1-17 user agent nem kerül a kivitelezői naplóba

#### Y1.10. Y1-18 package waits (4)

- Y1-18 csomag vár, amíg a galéria renderel
- Y1-18 max. várakozás után elkészül, a hiányzó elemeket jelzi
- Y1-3-2 package_full nélkül a csomagból amúgy is kimaradó render nem „hiányzó”
- Y1-3-2 package_full-lal a sikertelen nézet is a hiányzók közt

#### Y1.11. Y1-5 / Y1-4 notification per recipient (9)

- Y1-5 1. kör: k1 megkapta, k2 hibázott
- Y1-17 kivitelezői megszólítás contractor.name-mel
- Y1-5 újrapróbálás csak a hibás címzettnek
- Y1-5 ügyfél-visszaigazolás egyszer
- Y1-5 címzettenkénti állapot a quote-ban
- Y1-4 a sikertelen küldés linkje visszavonva (2 élő link)
- Y1-4 újraküldés: mindkét kivitelező új levelet kap, ügyfél nem
- Y1-4 újraküldéskor a címzett korábbi linkje visszavonva
- Y1-4 a link többször használható (időkorláton belül)

#### Y1.12. Y1-15 contractor scope (6)

- Y1-4 munkamenet a link címzettjéhez kötve
- Linkes munkamenet: csak a saját ajánlatkérés
- Y1-15 kivitelező szerepkör: látja a neki küldött ajánlatkérést
- Y1-15 kivitelező szerepkör: más ajánlatkérését nem látja
- Y1-15 idegen kivitelező a ZIP-et sem töltheti le
- Y1-4 revoke_quote(): linkek és munkamenetek visszavonva

#### Y1.13. Y1-13 delete refused with quote (2)

- Y1-13 ajánlatkéréses projekt nem törölhető (409, üzenettel)
- Y1-21 delete_project_safe() WP_Error-t ad

#### Y1.14. Y1-7 / Y1-8 feature gates (customer mode) (13)

- Y1-8 tulajdonosi módban a tárolt csomagmátrix érvényes
- Y1-3-6 roles_advanced nincs a katalógusban és a csomagokban
- Y1-3-6 tárolt agh_plans-ból a megszűnt funkció kiszűrve
- Y1-8 ügyféloldalon a beépített mátrix (funkciók/limitek)
- Y1-3-7 ügyféloldalon a mátrix teljesen csak olvasható (címke/ár is beépített)
- Y1-8 ügyféloldalon nem kapcsolható be funkció a tárolt mátrixszal
- Y1-3-7 save_plans() ügyféloldalon nem ír semmit
- Y1-7 /admin/stats: részletes bontás csak stats_advanced-del
- Y1-7 statisztika CSV csak export_advanced-del
- Y1-7 tervvázlatok csak "floorplans" funkcióval (kliens)
- Y1-7 tervvázlat-fájl: kivitelezőnek sem "floorplans" nélkül
- Y1-7 tulajdonosi módban a tervvázlatok láthatók
- Y1-7 tulajdonosi módban részletes statisztika

#### Y1.15. Y1-6 payments (3)

- Y1-6 PaymentGatewayInterface önállóan betölthető
- Y1-6 regisztrált külső fizetési kapu használatban (a beépített URL-ek mellett is)
- Y1-6 explicit beállítás felülírja

#### Y1.16. Y1-9 licence (19)

- Licenc aktiválás (referencia-szerver)
- Y1-9a érvénytelen aláírás → türelmi idő (unreachable), last_ok nem frissül
- Y1-9a nem átmeneti szerverhiba → türelmi idő
- Y1-9a hibás szerver a türelmi időn túl nem tartja a prémiumot
- Sikeres ellenőrzés után újra aktív
- Y1-3-5 expired licencből szerverhiba nem indít türelmi időt
- Y1-3-5 site_limit licencből szerverhiba nem indít türelmi időt
- Y1-3-5 invalid licencből szerverhiba nem indít türelmi időt
- Y1-3-5 inactive licencből szerverhiba nem indít türelmi időt
- Y1-3-5 licenchívások átirányítás nélkül (redirection = 0)
- Y1-9b frissítés: rossz nonce-ú (de aláírt) válasz elutasítva
- Y1-9b frissítés: elavult (issued_at) válasz elutasítva
- Y1-9b frissítés: nonce-szal kérve, ellenőrzött válasz felkínálva
- Y1-3-5 frissítés-ellenőrzés átirányítás nélkül
- Y1-9c aláírt adatban a csomag SHA-256-ja
- Y1-9c egyező ellenőrzőösszeg → telepíthető fájl (licenc fejlécben)
- Y1-9c eltérő ellenőrzőösszeg → WP_Error, nincs telepítés
- Y1-9c idegen csomagot nem érint
- Y1-9d nem HTTPS licencszerverrel nincs frissítés-ellenőrzés

#### Y1.17. Y1-3-1 scrub_config (3)

- Y1-3-1 szabad szövegek törölve (custom_text, projekt/ország, x_* szöveg)
- Y1-3-1 helyiség: név általános, megjegyzés és szöveges mezők törölve
- Y1-3-1 technikai paraméterek maradnak

#### Y1.18. Y1-14 GDPR (7)

- Y1-14 anonimizálás: minden személyes/szabad szöveges mező
- Y1-14 hozzájárulási napló: IP-hash és user agent törölve
- Y1-14 kapcsolt projekt: szabad szöveg, fájlok és képek törölve
- Y1-14 a statisztikához szükséges paraméterek megmaradnak
- Y1-14 exportáló lapoz (20 + 5, done a végén)
- Y1-14 törlő lapoz (done=false, majd true), mind anonimizálva
- Y1-14 törlő: ajánlatkéréses projekt anonimizálva, a többi törölve

#### Y1.19. Y1-3-4 secrets upgrade on DB upgrade (3)

- Y1-3-4 v5-ről nincs újratitkosítás (verzióhoz kötve)
- Y1-3-4 v4 → v5: régi formátumú titok újratitkosítva, olvasható, idempotens
- Y1-3-4 maybe_upgrade() és activate() hívja

#### Y1.20. Y1-3-3 uninstall with custom AGH_PRIVATE_DIR (sandbox, no WordPress) (2)

- Y1-3-3 egyedi mappa: a plugin védőfájljai, projektmappái törölve, a felhasználó fájlja és a mappa marad
- Y1-3-3 a felhasználó által módosított .htaccess megmarad

#### Y1.21. static checks (2)

- Y1-20 mbstring követelmény-ellenőrzés a főfájlban
- Y1-19 uninstall: tranziensek, saját mappák, verzió a fejlécből

#### Y1.22. cleanup (1)

- Takarítás: ideiglenes projektek törölve

---

## 6. Regressziós tesztsor Y2 – felület (`tests/regression-y2.php`)

A futás **csak az összegző sort** írja ki (`REGRESSZIÓ y2: 71 sikeres, 0 sikertelen`); hibánál „HIBA: …” sort írna, ilyen nem volt. A nevek a tesztfájl `$agh_t( … )` hívásaiból valók (71 hívás = 71 ellenőrzés, mind lefutott és sikeres). A „JS / CSS contract checks (static)” szakasz a JavaScript/CSS forrásszöveget vizsgálja, a böngészőbeli működést nem.

#### Y2.1. Y2-6 Form::save: single unslash (4)

- Form::save megtartja a backslash-t (text)
- Form::save megtartja a backslash-t (textarea)
- Form::save JSON backslash
- Teszt-beállításcsoport eltávolítva

#### Y2.2. Y2-7 REST link building (4)

- ZIP-link egyszerű permalinkkel: egy "?"
- ZIP-link egyszerű permalinkkel: rest_route + &_wpnonce
- ZIP-link szép permalinkkel: ?_wpnonce
- ZIP-link nonce érvényes

#### Y2.3. Y2-11 I18n gating (3)

- agh_lang multilang nélkül nem vált
- agh_lang multilang mellett vált
- agh_lang ismeretlen nyelvre nem vált

#### Y2.4. Y2-1 wpNonce in the frontend config (6)

- Vendég: wpNonce üres (loader)
- Vendég: wpNonce üres (bootstrap)
- Bejelentkezve: wpNonce érvényes wp_rest nonce (loader)
- Bejelentkezve: wpNonce (bootstrap)
- Bootstrap: régi rest_nonce mező megszűnt
- Loader: errBoot fordítható szöveg

#### Y2.5. Y2-9 / Y2-10 branding (3)

- Brand: icon mező és érvényes shadow
- Alap arculat: csak fő szín (+ elrendezés)
- Haladó arculat: minden token

#### Y2.6. Y2-5 shortcodes (3)

- inline attribútum nincs hatással (eltávolítva)
- [autogrowehome_button] alias létezik
- Vezérlőpult listázza az aliast és pontos #agh-open leírást

#### Y2.7. Y2-10 plan matrix (contract 4) (3)

- Csomagmátrix nem tulajdonosi módban csak olvasható
- Csomagmátrix tulajdonosi módban szerkeszthető
- plans_editable() = owner mode

#### Y2.8. Y2-12 status page extensions (3)

- Kiterjesztéslista: mbstring, sodium, gd, zip, json
- Rendszerállapot mutatja az mbstring-et
- Súgó: egynyelvű egyedi szöveg jelzése

#### Y2.9. Y2-8 / Y2-15 project with quote, access revoke (9)

- Ideiglenes projekt létrejött
- Ajánlatkérés nélkül nincs kapcsolódó quote
- Ajánlatkérés felismerve
- Admin-törlés (safe) elutasítja az ajánlatkéréses projektet
- Projektadatlap: törlés gomb letiltva + magyarázat
- Kivitelezői link érvényes visszavonás előtt
- Hozzáférés visszavonása után a link érvénytelen
- Ajánlatkérés adatlap: „Hozzáférés visszavonása” gomb noncé-val
- Takarítás: projekt és ajánlatkérés törölve

#### Y2.10. Utókör 1: has_quote a Projektjeim listában (1)

- my_projects: has_quote (bool) mindkét projekten

#### Y2.11. Utókör 2: megszakított projekt (koncepciók nélkül) (3)

- progress: megszakítva → skipped szakaszok
- Új felületi szövegek léteznek
- Takarítás: has_quote tesztprojektek törölve

#### Y2.12. Utókör 3: paraméterszerkesztő (2)

- Feltételérték lista → "a, b"
- Paraméterszerkesztő: "in" operátor és prompt-súgó

#### Y2.13. Utókör 4: http:// szolgáltatói URL → gyári érték figyelmeztetés (5)

- http:// végpont → figyelmeztetés
- Mentés: a sanitizer gyári https értékre cserél + figyelmeztetés
- Elfogadott https érték nem ad figyelmeztetést
- Csak normalizált útvonal (/ nélkül) nem ad figyelmeztetést
- Figyelmeztetés megjelenik az admin oldalon, majd törlődik

#### Y2.14. 3. kör (12)

- Y2-3-1 Webhook súgó a valós, tokenes URL-t mutatja
- Y2-3-2 Új admin mezők (store_user_agent, max_parallel_jobs, filter_nsfw)
- Y2-3-2 aspect_ratio mező nincs (a Pipeline mindig 16:9-et kér, hatástalan lenne)
- Y2-3-3 Projektszűrő: cancelled állapot
- Y2-3-4 Újragenerálás szövege az újragenerálási keretről szól
- Y2-3-4 Bootstrap: gallery_remaining a limitekben
- Y2-3-5 /validate config: a szerver választ tetőterméket (erre épít a felület)
- Y2-3-5 Új szöveg: gyártói ellenőrzésre vár
- Y2-3-6 not_configured szöveg törölve
- Y2-3-7 BRAMAC márka zárolt
- Y2-3-7 Katalógus: BRAMAC-nál nincs törlés link, az állapot nem állítható
- Y2-3-7 catalog_delete hibát ad, ha a törlés elutasítva

#### Y2.15. JS / CSS contract checks (static) (10)

- JS: X-WP-Nonce a wpNonce-ból
- JS: form_token küldése, started nélkül
- JS: projekt törlés REST DELETE, confirm()/alert() nélkül
- JS: overflow menü aria-expanded
- JS: has_quote → tiltott törlés gomb
- JS: megszakított projekt nem pollozik, hibaszám és kihagyott szakasz
- JS: automatikus tetőtermék átvétele, roof_color_manual nélkül
- JS: nem ellenőrzött termék jelölése, újragenerálási keret, not_configured nélkül
- Loader: hashchange figyelés
- CSS: árnyék-preset és mobilmenü

---

## 7. Licencszerver-önteszt – ellenőrzések

A futás csak az összegző sort írja ki (`Licencszerver önteszt: 32 sikeres, 0 sikertelen`; hibát `✗` jellel írna). A nevek a `tools/license-server/tests/selftest.php` `ok()` hívásaiból valók; mind a 32 sikeres volt. A teszt webszerver nélkül, ideiglenes SQLite-adatbázissal és frissen generált Ed25519-kulcspárral fut.

| # | Ellenőrzés |
|---:|---|
| 1 | Kulcsformátum (plugin regex-szel kompatibilis) |
| 2 | Aktiválás: aláírt, aktív, professional, 1/1 oldal |
| 3 | issued_at friss, expires_at ISO 8601 |
| 4 | Módosított válasz aláírása érvénytelen |
| 5 | Idegen nyilvános kulccsal nem ellenőrizhető |
| 6 | Második oldal: site_limit |
| 7 | Ugyanazon példány újraaktiválása nem foglal új helyet |
| 8 | Nem aktivált példány ellenőrzése: inactive |
| 9 | Deaktiválás felszabadítja a helyet |
| 10 | Felszabadított helyre aktiválható másik oldal |
| 11 | Ismeretlen kulcs: invalid (aláírt) |
| 12 | Visszavont licenc: invalid |
| 13 | Lejárt licenc: expired, nincs frissítési jog |
| 14 | Lejárt licenc új oldalt nem foglal |
| 15 | Megújítás (extend) után újra aktív |
| 16 | Frissítés-ellenőrzés kiadás nélkül: üres verzió |
| 17 | Frissítés-ellenőrzés: nonce visszaküldve, issued_at friss |
| 18 | Nonce nélküli frissítés-kérés: üres nonce (a plugin elutasítja) |
| 19 | Legújabb kiadás és csomag-URL (titok nélkül) |
| 20 | Aláírt frissítési adat: a csomag SHA-256 ellenőrzőösszege |
| 21 | Hiányzó csomagfájlú kiadást nem kínál fel |
| 22 | Nem aktivált példány nem kap frissítést |
| 23 | Csomagletöltés fejléces hitelesítéssel |
| 24 | URL-paraméteres kulcs nem elég (403) |
| 25 | Útvonal-bejárás elutasítva |
| 26 | Hibás JSON: 400 |
| 27 | A config.sample.php minta-pepperét (CHANGE-ME) elutasítja |
| 28 | Ismeretlen útvonal/metódus: 404 |
| 29 | Kulcs és IP nincs nyílt szövegként az adatbázisban |
| 30 | IP-alapú korlát: 5 kérés/perc, utána 429 |
| 31 | X-Forwarded-For csak megbízható proxytól |
| 32 | 10 párhuzamos aktiválás, 3 hely → 3 aktiválás |

---

## 8. Statikus ellenőrzés

| Ellenőrzés | Fájlok | Eredmény |
|---|---:|---|
| `php -l` (PHP 8.3.6) | 71 | 0 szintaxishiba |
| `node --check` (Node.js v22.22.0) | 5 (`agh-admin.js`, `agh-designer.js`, `agh-loader.js`, `agh-pages.js`, `agh-portal.js`) | 0 szintaxishiba |

Kódstílus-ellenőrzés (PHPCS/WPCS), statikus analízis (PHPStan/Psalm) és JS-lint **nem futott**.

---

## 9. Kiegészítő mérések

### 9.1 Épületmodell (`includes/Generation/BuildingModel.php`)

| Mérés | Javítás előtt | Javítás után | Forrás |
|---|---:|---:|---|
| 21 alapkonfiguráció – „túl keskeny” figyelmeztetés | 67 | **0** | ebben a futásban mérve (X: „"Too narrow" warnings in 21 default layouts: 0 (before the fix: 67)”) |
| 21 alapkonfiguráció – elcsúszott lépcső | 3 | **0** | ebben a futásban mérve (X: „Stairs aligned on every floor (misaligned: 0, before: 3)”) |
| 21 alapkonfiguráció – átfedő helyiségek | 8 | **0** | ebben a futásban mérve (X: „No overlapping rooms (overlaps: 0, before: 8)”) |
| 444 véletlen modell – átfedés | 176 | 16 | korábbi mérés, ugyanebben a munkamenetben |
| 444 véletlen modell – elcsúszott lépcső | 117 | 0 | korábbi mérés, ugyanebben a munkamenetben |
| 444 véletlen modell – „túl keskeny” | 1328 | 60 | korábbi mérés, ugyanebben a munkamenetben |

Ismert maradék (korábbi mérés alapján): U-alakú alaprajz keskeny főépülettel; többszintes házaknál területeltérés-figyelmeztetés. A véletlenmodelles mérést ebben a futásban nem ismételtük meg (nem része a tesztsoroknak).

### 9.2 Valós HTTP párhuzamossági teszt – *korábbi mérés, ugyanebben a munkamenetben, a javítások előtt*

| Bemenet | Eredmény |
|---|---|
| 12 párhuzamos generálási kérés valódi HTTP-n, napi limit 3 | 3× HTTP 202, 9× HTTP 429, a napi számláló értéke = 3 |

A napi keret kódja (`RateLimiter::reserve()`, `INSERT IGNORE` + feltételes `UPDATE`) a javítási körben az újragenerálási hatókörrel bővült; a valós HTTP-mérést a javítások után **nem ismételtük meg**. Csak SQLite-on mérve.

### 9.3 Böngészős ellenőrzés (Chromium, Playwright) – *korábbi mérés, ugyanebben a munkamenetben*

| Nézet | Lefedett folyamat | Eredmény |
|---|---|---|
| Asztali, 1440×900 | generálás → 3 koncepció → kiválasztás → galéria → tervvázlatok → összehasonlítás (sötét mód) → ajánlatkérő űrlap | 0 konzolhiba |
| Mobil, 390 px | ugyanez | 0 konzolhiba, 0 túllógó elem |
| Mobil, 360 és 390 px (javítás után) | 820 px alatti „⋯” (További lehetőségek) menü | nincs vízszintes túllógás, 0 konzolhiba |

A képek szimulált/teszt módú szolgáltatótól érkeztek.

**Végleges végigkattintás (az összes javítás után, 2026-10-11, teszt mód):** asztali 1440×900 – kezdés → generálás → 3 kész koncepció → „B” kiválasztása → galéria kész → Tervvázlatok fül (42 SVG elem a DOM-ban) → ajánlatkérő űrlap (quote-token, 3 mp várakozás) → sikeres beküldés; konzolhiba 0. Mobil 390×844 – `scrollWidth` 390 = `innerWidth` 390, a „⋯” menü kinyílik (`aria-expanded=true`), konzolhiba 0. Az összegző panel a szerver által választott „Bramac Római – antracit” tetőfedést mutatja „Gyártói ellenőrzésre vár” jelöléssel.

**Tiszta telepítés a kiadási ZIP-ből (2026-10-11):** friss WordPress-példány (SQLite, `AGH_OWNER_MODE` nélkül) → `wp plugin install autogrowehome-1.0.0.zip --activate`: 13 `agh_` tábla, `agh_db_version` = 5, csomag: Starter (a `floorplans` funkció ki, a `designer` be), `GET /agh/v1/bootstrap` → 200, a privát mappa (`uploads/agh-private-<véletlen>/`) `.htaccess`-szel jön létre. Eltávolítás alapbeállítással: a táblák és beállítások megmaradnak (szándékos). Eltávolítás `general.delete_on_uninstall` = igaz mellett: 0 tábla, 0 `agh` opció, 0 privát mappa, 0 `agh` szerepkör marad.

### 9.4 Nyelvek – *ebben a futásban mérve*

| Mutató | Érték |
|---|---|
| Nyelvek száma | 16 (magyar forrás + 15 fordítás) |
| Fordítások | `cs_CZ`, `de_DE`, `en_US`, `es_ES`, `fr_FR`, `hr`, `it_IT`, `nl_NL`, `pl_PL`, `ro_RO`, `ru_RU`, `sk_SK`, `sl_SI`, `sr_RS`, `uk` (`.po` + `.mo`, 15–15 fájl) |
| Bejegyzés nyelvenként | 1565 (a `.pot` is 1565 bejegyzést tartalmaz) |
| Fordítatlan / fuzzy | 0 / 0 minden nyelven (többes számú alakoknál sincs üres `msgstr[n]`) |
| Futás közbeni nyelvváltás | „Nyelvváltás németre: „Grunddaten””; Y2: „agh_lang multilang nélkül nem vált”, „agh_lang multilang mellett vált” |

Mérési mód: saját `.po`-elemző (Python) + `grep` a többes számú alakokra; `msgfmt` nem volt elérhető. A fordítások MI-vel készültek → **anyanyelvi lektorálás javasolt**; a szövegek nyelvi helyességét és a felület tördelését a 15 fordításon nem ellenőriztük. Az admin által megadott egyedi gyorsbemutató/GYIK szöveg egynyelvű.

---

## 10. A tesztek lefedettségének korlátai

| Terület | Mit igazol a teszt | Mit nem |
|---|---|---|
| Kulcs a böngészőben | „Bootstrap nem tartalmaz kulcsot”; Y2: „Bootstrap: régi rest_nonce mező megszűnt” | A bootstrap-teszt a kulcs beállítása *előtt* fut és csak az `api_key` szót keresi; a kulcsmentességet kódolvasás igazolja. |
| Sütik | `agh_gs` és `agh_cs` létrejön, megújul, lejárt munkamenet elutasítva | A `HttpOnly`/`SameSite`/`Secure` flageket CLI-ből nem lehet ellenőrizni – csak kódolvasás. |
| Fájlkiszolgálás | Jogosultsági és funkciókapu-döntés | A `stream()` válaszfejlécei (CSP, `nosniff`, `Content-Disposition`) nem mértek. |
| Job-zárolás | Egymás utáni claim-ek, lejárt zár újrafelvétele, elavult worker írásának elutasítása (X9), párhuzamossági helyek (X10) | Valódi többfolyamatos verseny MySQL-en nem tesztelt. |
| Licenc E2E | A plugin és a referencia-szerver folyamatban (`pre_http_request` → `LicenseServer`) | Külön telepített szerver valódi HTTPS-sel nem tesztelt. |
| Felület (Y2) | Konfiguráció, admin-HTML, valamint JS/CSS **forrásszöveg** (statikus mintakeresés) | A JS böngészőbeli működését az Y2 nem futtatja (erre csak a 9.3 korábbi mérése vonatkozik). |
| Nincs dedikált teszt | – | A webhook-token ellenőrzése (`RestController::webhook()`), megőrzési takarítás (`Privacy::retention()`) ütemezett futása, a legtöbb admin-űrlap nonce-ellenőrzése, kimeneti escape az admin felületen. |

---

## 11. Nem tesztelt / éles kulcsot igényel

| Terület | Állapot | Teendő élesítés előtt |
|---|---|---|
| Valós Magnific-hívás (Mystic, referenciás nézetek, felskálázás, `filter_nsfw`) | **Nem futott éles kulccsal.** A tesztek a dokumentált szerződés szerint szimulálnak (`pre_http_request`). A `PromptEngine::MAX_PROMPT = 3900` saját, óvatos határ – a Magnific dokumentációjában hosszkorlátot nem találtunk. | Staging-próba éles kulccsal: kapcsolatteszt, teljes generálás, felskálázás, időzítés és költség rögzítése. |
| Valós Anthropic-hívás (tervező, AI-értelmezés, 16 nyelvű koncepciónevek) | **Nem futott éles kulccsal.** | Staging-próba; a prompt-injekció elleni keretezés és a nyelvenkénti nevek ellenőrzése valós modellel. |
| E-mail-kézbesítés | Tesztben `pre_wp_mail`-lel elkapva, **kézbesítés nem történt**. | Éles küldés SPF/DKIM/DMARC mellett (kivitelezői levél címzettenként, ügyfél-visszaigazolás). |
| MySQL/MariaDB | **Csak SQLite-on futott.** | Mind a négy WordPress-tesztsor futtatása MySQL/MariaDB-s staging-példányon (napi keret, job-claim, slot- és poll-bérlet atomikussága). |
| Éles tárhely, valódi cron | Nem tesztelt (`agh_cron_queue` percenként, `agh_cron_daily` naponta). A CLI-parancsokat az Y1 ellenőrzi („Y1-1 `wp agh queue run` működik”). | Rendszer-cron beállítása, a sor és a megőrzési takarítás futásának ellenőrzése. |
| Webszerver-tiltás (Nginx/Apache/IIS), HTTPS, proxy | Nem tesztelt. | Lásd [BIZTONSAGI-ELLENORZOLISTA.md](BIZTONSAGI-ELLENORZOLISTA.md), B rész. |
| Fizetési szolgáltató | **Nincs beépítve.** Van `PaymentGatewayInterface` és külső checkout-link kapu (`ExternalCheckoutGateway`), valamint az `agh_payment_gateways` szűrő; valódi fizetési folyamat nincs. | Saját integráció és annak tesztje. |
| BRAMAC-katalógus | A feketeteto.hu nyilvános adataiból, `verified:false` jelöléssel. Magastetőnél a BRAMAC kötelező; termék nélkül az ajánlott (ennek hiányában a tetőszínhez legközelebbi) kerül kiválasztásra (X17). | Gyártói ellenőrzés. |
| Jogi szövegek (ÁSZF, adatkezelési tájékoztató) | Sablonok. | Jogászi átnézés. |
| 4K-címke | 4K csak akkor, ha a kép hosszabbik oldala ≥ 3840 px (`Repository::resolution_label()`); a teszt csak a „nem 4K” ágat igazolja. Valódi 4K kimenet nem keletkezett. | Éles felskálázás után a címke ellenőrzése. |
| Admin projektlista | A `deleted` (anonimizált/törölt) állapotú projekteket a lista kizárja, szűrővel sem jeleníthetők meg. | Tájékoztató; nincs teendő, ha ez a szándékolt viselkedés. |
| Kerettérítés valós árakkal | A megszakításkori kerettérítés a beállított `costs.*` egységárakon múlik (alapérték 0); valós árakkal és éles szolgáltatóval nem futott. | Az egységárak kitöltése, majd próba (lásd [BIZTONSAGI-ELLENORZOLISTA.md](BIZTONSAGI-ELLENORZOLISTA.md), C.15). |
| Épületmodell maradékai | U-alakú alaprajz keskeny főépületnél; többszintes házak területeltérés-figyelmeztetése (9.1). | Szakági (építész) átnézés; a tervvázlat nem engedélyezési/kiviteli terv. |
| Terhelés, teljesítmény | A 12 párhuzamos kérésen túl **nem mérve** (a javítások után egyáltalán nem). | Terheléses teszt a várható csúcsforgalomra. |
| Biztonsági audit / penetrációs teszt | **Nem készült.** | Független átvilágítás; a kódolvasás során talált maradék gyengeségek: [BIZTONSAGI-ELLENORZOLISTA.md](BIZTONSAGI-ELLENORZOLISTA.md), C rész. |
