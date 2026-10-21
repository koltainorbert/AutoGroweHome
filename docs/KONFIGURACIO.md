# AutoGroweHome 1.0.0 – Konfigurációs kézikönyv

Ez a dokumentum az összes beállítást felsorolja alapértékkel és jelentéssel, és elmagyarázza az összefüggéseket: API-kulcsok, teszt mód, napi keret, költségkeret, nyelvek, arculat, kivitelezői értesítés, hozzájárulások, adatmegőrzés és licenc. A kulcsnevek és alapértékek az `includes/Support/Settings.php` (`defaults()`), a felirat- és tartományadatok az `includes/Admin/Admin.php` (`specs()`) fájlból származnak.

> Az admin felület elemeinek részletes bemutatása: `docs/ADMIN-KEZIKONYV.md`. Telepítés, cron, tárhely: `docs/TELEPITES.md`.

---

## 1. Hol tárolódnak a beállítások?

### 1.1 A fő beállítástár

Minden általános beállítás egyetlen WordPress-opcióban, az `agh_settings`-ben van, csoportokra bontva (`includes/Support/Settings.php`). Kódból pontozott útvonallal olvasható: `Settings::get( 'limits.ip_daily' )`.

| Csoport | Admin oldal, ahol szerkeszthető |
|---|---|
| `general` | Arculat és elrendezés (termék, nyelv, indítógomb); Limitek és hozzáférés (`queue_tick_on_poll`); Jogi és GDPR (`delete_on_uninstall`) |
| `anthropic`, `images`, `magnific`, `costs` | AI-szolgáltatók |
| `limits`, `access` | Limitek és hozzáférés |
| `contractor`, `emails` | Kivitelező és e-mail |
| `legal` | Jogi és GDPR |
| `branding`, `layout` | Arculat és elrendezés |

**Mentéskori ellenőrzés** (`includes/Admin/Form.php`, `save()`): a számok a megadott min./max. tartományba szorulnak; érvénytelen listaelem helyett az első opció mentődik; érvénytelen színkód helyett az alapérték; a szövegek tisztítva (`sanitize_text_field` / `sanitize_textarea_field`).

**Szolgáltatói URL-ek** (`Settings::sanitize_https_url()`, `sanitize_endpoint_path()`): az `anthropic.endpoint` és a `magnific.base_url` csak abszolút, hitelesítő adat nélküli `https://` cím lehet; a Magnific végpont-útvonalai (`hero_endpoint`, `reference_endpoint`, `upscale_endpoint`) csak `/szegmens/szegmens` alakú relatív útvonalak lehetnek (betű, szám, `_`, `-`; pont nélkül – `Settings::ENDPOINT_PATH_PATTERN`). Érvénytelen érték helyett a gyári alapérték mentődik (és olvasáskor is az érvényes), az admin pedig figyelmeztetést kap: „A(z) „…” mezőbe írt érték (…) nem fogadható el – csak https:// cím, illetve relatív útvonal adható meg –, ezért a gyári érték került vissza…”.

A kódból hívható `Settings::update_group()` csak ezt az URL-szabályt alkalmazza; minden más értékért a hívó felel.

### 1.2 Külön opciók

| Opció | Tartalom | Szerkesztés helye |
|---|---|---|
| `agh_secrets` | Titkosított API- és licenckulcsok | AI-szolgáltatók; Licenc |
| `agh_license`, `agh_license_server` | Licencállapot; licencszerver URL és nyilvános kulcs | Licenc |
| `agh_plans`, `agh_checkout_urls` | Csomagmátrix (funkciók, limitek, árak); fizetési linkek | Licenc → Csomagok – **csak tulajdonosi módban**; ügyféloldalon figyelmen kívül marad (2.2) |
| `agh_payment_gateway` | A kiválasztott fizetési kapu azonosítója | nincs admin mező (`includes/License/Payments.php`) |
| `agh_custom_params`, `agh_param_overrides` | Egyedi paraméterek; beépített paraméterek felülírásai | Paraméterek |
| `agh_help` | Egyedi gyorsbemutató és GYIK | Súgó és rendszer |
| `agh_design_history` | Az utolsó 10 arculati állapot | Arculat és elrendezés |

### 1.3 Import / export

A pluginban **nincs** beállítás-import/-export funkció. Átvitelhez a WP-CLI szabványos parancsai használhatók (a titkosított kulcsok nem vihetők át: a forrásoldal kulcsával – `AGH_SECRET_SALT`, ennek hiányában a WordPress-sók – titkosítottak, 3.2):

```bash
wp option get agh_settings --format=json > agh_settings.json
wp option update agh_settings --format=json < agh_settings.json
```

Részletes példák: `docs/MINTA-KONFIGURACIOK.md`.

---

## 2. A licenccsomag hatása

Sok beállítás hatása a tényleges csomagtól függ (`includes/License/Features.php`). **Licenc nélkül (és tulajdonosi mód nélkül) a plugin Starter csomagként működik**; tulajdonosi módban (`AGH_OWNER_MODE`) minden funkció engedélyezett, csomaglimit nélkül.

### 2.1 Alapértelmezett csomagok

| Funkció (azonosító) | Starter | Professional | Agency | Hol érvényesül a kódban |
|---|:-:|:-:|:-:|---|
| Háztervező popup (`designer`) | ✓ | ✓ | ✓ | indítógomb, lebegő gomb, generálás, koncepció-újragenerálás |
| Alapvető házparaméterek (`basic_params`) | ✓ | ✓ | ✓ | leíró tétel, mindig elérhető (nincs külön kapu) |
| Három házkoncepció (`three_concepts`) | ✓ | ✓ | ✓ | generálás, koncepció-újragenerálás |
| Alapvető képgaléria (`basic_gallery`) | ✓ | ✓ | ✓ | leíró tétel, mindig elérhető (nincs külön kapu) |
| Kiemelt látványkép letöltése (`hero_download`) | ✓ | ✓ | ✓ | ügyféloldali teljes méretű letöltés |
| Projektmentés (`project_save`) | ✓ | ✓ | ✓ | mentési végpont |
| Kivitelezői e-mail (`contractor_email`) | ✓ | ✓ | ✓ | ajánlatkérő űrlap, valamint a `/quote` és `/quote-token` végpont |
| Teljes paraméterezés (`full_params`) | – | ✓ | ✓ | nélküle csak az alap paraméterkészlet látszik (`includes/Params/Registry.php`, `basic_ids()`) |
| Szerkeszthető promptmotor (`prompt_editor`) | – | ✓ | ✓ | Promptmotor oldal |
| Részletes galéria (`detailed_gallery`) | – | ✓ | ✓ | nélküle csak az elöl-, hátul- és madártávlati nézet készül |
| Tervvázlat-generáló (`floorplans`) | – | ✓ | ✓ | SVG-tervvázlat készítése, kiszolgálása és ZIP-be kerülése |
| Részletes statisztika (`stats_advanced`) | – | ✓ | ✓ | statisztikai bontások (a REST-válaszban és a CSV-ben is) |
| Haladó arculat (`branding_advanced`) | – | ✓ | ✓ | nélküle csak az alap arculat érvényesül (9. fejezet) |
| Többnyelvű működés (`multilang`) | – | ✓ | ✓ | látogatói nyelvválasztó és `?agh_lang=` nyelvváltás |
| Részletes kivitelezői csomag (`package_full`) | – | ✓ | ✓ | nélküle a ZIP-ben a látványtervek közül csak a fő kép, az elöl- és hátulnézet van |
| Dinamikus paraméterszerkesztő (`custom_params`) | – | ✓ | ✓ | Paraméterek oldal és `Registry::save_custom()`; nélküle a tárolt egyedi paraméterek nem töltődnek be (tervező, validáció, prompt), de az adatbázisban megmaradnak |
| White-label (`white_label`) | – | – | ✓ | a készítő neve nem jelenik meg a tervezőben |
| Több kivitelező (`multi_contractor`) | – | – | ✓ | további értesítési címek |
| Bővített export (`export_advanced`) | – | – | ✓ | DXF alaprajz (készítés, letöltés, ZIP), statisztikai CSV-export; a CAD-exportálók alapértelmezett funkciója |

| Csomaglimit | Starter | Professional | Agency | Hatás |
|---|---|---|---|---|
| `sites` | 1 | 1 | 25 | csak az árazási oldalon jelenik meg; a ténylegesen engedélyezett weboldalszámot a licencszerver adja |
| `max_ip_daily` | 3 | 10 | 50 | az IP-napi keret felső korlátja (6. fejezet) |
| `max_exterior_views` | 4 | 8 | 8 | külső nézetek száma a fő képpel együtt |
| `max_interiors` | 2 | 6 | 10 | belső nézetek felső korlátja koncepciónként |
| `max_resolution` | 2k | 4k | 4k | a kért képfelbontás felső korlátja |

### 2.2 A csomagmátrix szerkeszthetősége

- **Ügyféloldalon** (nincs `AGH_OWNER_MODE`) a csomagmátrix **teljesen csak olvasható**: mindig a beépített mátrix érvényes (`Features::default_plans()`), a név, a célközönség és az ár is; a tárolt `agh_plans` opciót a plugin figyelmen kívül hagyja, és a `Features::save_plans()` nem ír. A Licenc oldal csak olvasható táblázatot mutat.
- **Tulajdonosi módban** a Licenc → Csomagok táblázat szerkeszthető (funkciók, limitek, árak, fizetési linkek), és a tárolt mátrix érvényes (a funkciólista a létező funkciókra szűrve).
- Az `agh_owner_mode` szűrő csak kikapcsolni tudja a tulajdonosi módot (teszteléshez), bekapcsolni nem.

---

## 3. API-kulcsok

### 3.1 Megadás helye

| Kulcs | Hol | Konstans alternatíva |
|---|---|---|
| Magnific | AI-szolgáltatók → Magnific API → „API-kulcs” | `AGH_MAGNIFIC_API_KEY` |
| Anthropic | AI-szolgáltatók → Anthropic API → „API-kulcs” | `AGH_ANTHROPIC_API_KEY` |
| Licenckulcs | Licenc → kulcsmező → „Aktiválás” | `AGH_LICENSE_KEY` |

A kulcsmező viselkedése (`includes/Admin/Form.php`, `secret` típus):

- jelszómező; **üresen hagyva megtartja** a meglévő kulcsot;
- meglévő kulcsnál helyőrzőként `••••••••` + az utolsó 4 karakter látszik, a teljes kulcs soha nem kerül a böngészőbe;
- „Kulcs törlése” jelölőnégyzettel törölhető;
- ha a kulcs `wp-config.php` konstansból jön, a mező helyén „wp-config.php konstansból (itt nem módosítható).” felirat látszik.

### 3.2 Tárolás és titkosítás

`includes/Support/Secrets.php`:

- Elsőbbség: **konstans** → adatbázis (`agh_secrets` opció).
- Titkosítás: `sodium_crypto_secretbox` (`s1:` előtag); ha nem érhető el, AES-256-CBC + HMAC-SHA256, külön levezetett titkosító és hitelesítő kulccsal (`o2:` előtag). A korábbi `o1:` formátum olvasható, és olvasáskor automatikusan újratitkosul.
- A titkosítókulcs (`Secrets::key()`): ha az `AGH_SECRET_SALT` definiálva van és nem üres, **kizárólag ebből** képződik – a WordPress-sók cseréje ilyenkor nem érinti a tárolt kulcsokat. `AGH_SECRET_SALT` nélkül az `AUTH_SALT` + `SECURE_AUTH_SALT` értékekből képződik; ezek cseréje után a tárolt kulcsok üresnek látszanak, újra meg kell adni őket. Az `AGH_SECRET_SALT` saját értékének megváltoztatása szintén olvashatatlanná teszi őket (konstansban megadott kulcsokat egyik eset sem érinti).
- Visszafejtéskor a plugin a régebbi kulcslevezetéseket is kipróbálja (az `AGH_SECRET_SALT` és a WordPress-sók keverése, illetve csak a WordPress-sók), így az `AGH_SECRET_SALT` utólagos megadása után is olvashatók maradnak a kulcsok; a régi formátumú/kulcsú értékek olvasáskor, illetve az 5-ös adatbázis-verzióra frissítéskor egyszer újratitkosulnak (`Secrets::upgrade_storage()`).
- A naplóba a kulcsok nem kerülnek: a `Logger` az üzenetben és a kontextusban is kitakarja a kulcsszerű adatokat (pl. `sk-ant-…`, `Bearer …`, `AGH-…` licenckulcs, `x-api-key`/`token=` értékek; `includes/Support/Logger.php`).

### 3.3 Kapcsolatteszt

Az AI-szolgáltatók oldal tetején, „Kapcsolat teszt” (`includes/Rest/RestController.php`, `admin_test_provider`):

| Gomb | Mit vizsgál | Költség |
|---|---|---|
| **Magnific** | Véletlen feladatazonosító lekérdezése a Mystic végponton: 200/400/404 → „A kulcs hitelesítve”; 401/403 → „A kulcsot a Magnific elutasította” (`includes/Ai/MagnificProvider.php`, `test()`) | generálás nélkül |
| **Anthropic** | `GET …/v1/models`; jelzi, ha a beállított modellazonosító nincs a listában, és felsorol elérhető modelleket (`includes/Ai/AnthropicProvider.php`, `test()`) | tokenköltség nélkül |
| **Teszt mód (GD)** | A PHP GD elérhetősége | – |

> A tesztek a dokumentált API-szerződés szerint készültek; **éles kulccsal még nem futottak**. Az első éles beállításnál ellenőrizd az eredményt.

---

## 4. Teszt mód és éles mód

A képszolgáltató kiválasztása (`includes/Ai/Providers.php`):

1. Ha az **Aktív szolgáltató** (`images.active_provider`) be van állítva és működőképes, azt használja.
2. Különben a **Tartalék szolgáltatót** (`images.fallback_provider`), ha működőképes.
3. Különben nincs képszolgáltató → a generálás le van tiltva; a látogató azt látja, hogy a képgenerálás jelenleg nem érhető el (HTTP 503), az admin felületen pedig **hiba** jelenik meg: „Nincs működő képszolgáltató, ezért a generálás le van tiltva…”.

| Szolgáltató | Működőképes, ha… |
|---|---|
| `magnific` | `magnific.enabled` be van kapcsolva **és** van Magnific-kulcs |
| `test` (Teszt mód) | `images.allow_test_provider` be van kapcsolva **és** elérhető a GD |

A teszt mód **nem automatikus tartalék**: csak akkor lép életbe, ha aktív vagy tartalék szolgáltatónak választod.

**Teszt mód** (`includes/Ai/TestImageProvider.php`): API-kulcs nélkül, helyben, GD-vel rajzolt, egyértelműen „TESZT” feliratú tömegvázlat-képek. Minden ilyen kép `is_test` jelzést kap; a ZIP metaadat-CSV-jében `test_image=yes`. Költséget nem könyvel.

| Cél | Beállítás |
|---|---|
| Kipróbálás kulcs nélkül | Aktív szolgáltató = „Teszt mód…”, Teszt mód engedélyezése = be |
| Éles működés | Aktív szolgáltató = Magnific, Tartalék = „– nincs –”, Teszt mód engedélyezése = **ki** |
| Éles, tartalékkal | Aktív = Magnific, Tartalék = egy másik, `agh_image_providers` szűrővel regisztrált valódi szolgáltató |

A Teszt mód tartalékként való beállítását az admin súgószövege csak fejlesztéshez ajánlja: végleges Magnific-hiba esetén a látogató tesztképet kapna. Ha a képgenerálás teszt módban fut, az admin felületen figyelmeztetés jelenik meg.

**Anthropic (opcionális).** Kulcs nélkül vagy kikapcsolva a három koncepciót a beépített szabályalapú tervező készíti, és az „AI értelmezés” gomb nem jelenik meg (`includes/Generation/Planner.php`). Ha az Anthropic-hívás hibát ad, a rendszer automatikusan a szabályalapú tervezőre vált, és naplózza.

---

## 5. Beállítás-referencia

Jelmagyarázat: a „Tartomány” oszlop az admin űrlap min./max. értéke (mentéskor ide szorul az érték). *Dőlt* sor: a kulcs létezik az alapértékek közt, de **nincs admin mezője** (csak kódból, pl. `Settings::update_group()`-pal állítható).

### 5.1 `general` – Termék és működés

| Kulcs | Admin felirat | Alapérték | Tartomány / értékek | Jelentés |
|---|---|---|---|---|
| `plugin_name` | Plugin / termék neve | `AutoGroweHome` | szöveg | Admin menü neve, tervező fejléce, e-mailek, ZIP-leírás, tervvázlat-feliratok |
| `author_name` | Készítő neve | `Koltai Norbert – Infostudio` | szöveg | A tervező fejlécének alcíme, ha nincs „Fejléc alcím”; `white_label` funkciónál nem jelenik meg |
| `frontend_locale` | Felület alapnyelve | `hu_HU` | `auto` (= a webhely nyelve) vagy a 16 nyelv egyike | A plugin frontend-szövegeinek kényszerített nyelve (8. fejezet) |
| `enabled_locales` | Választható nyelvek | `hu_HU`, `en_US`, `de_DE` | a 16 nyelv | A látogatói nyelvválasztó listája (`multilang` funkció kell) |
| `floating_button` | Lebegő indítógomb minden oldalon | be | be/ki | Lebegő gomb minden frontend-oldalon |
| `button_label` | Indítógomb felirata | üres | szöveg | Üresen: „Tervezd meg álmaid otthonát” |
| `default_mode` | Alapértelmezett mód | `simple` | `simple` (Egyszerű) / `detailed` (Részletes) | A tervező induló módja |
| `queue_tick_on_poll` | Feladatfeldolgozás állapotlekérdezéskor | be | be/ki | A látogató állapotlekérdezése feldolgozást futtathat (webhelyszinten egyszerre egy, max. 8 s); cron nélkül is halad a generálás |
| `delete_on_uninstall` | Minden adat törlése a plugin eltávolításakor | ki | be/ki | Lásd `docs/TELEPITES.md`, 11. fejezet |

### 5.2 `anthropic` – Szövegértelmezés és koncepciótervezés

| Kulcs | Admin felirat | Alapérték | Tartomány | Jelentés |
|---|---|---|---|---|
| `enabled` | Engedélyezve | be | be/ki | Kikapcsolva szabályalapú tervező |
| *(titok)* | API-kulcs | – | – | 3. fejezet |
| `endpoint` | API-végpont | `https://api.anthropic.com/v1/messages` | csak `https://` URL | A modell-lista teszthez a `/messages` → `/models` csere készül |
| `model` | Modellazonosító | `claude-sonnet-5-5` | szöveg | A kapcsolatteszt jelzi, ha nem elérhető |
| `version` | API-verzió fejléc | `2023-06-01` | szöveg | `anthropic-version` fejléc |
| `max_tokens` | Max. kimeneti token | 8000 | 1000–64000 | |
| `temperature` | Temperature | 0.6 | 0–1 | |
| `timeout` | Időtúllépés | 90 s | 10–300 | A feladatzár hosszát is befolyásolja |
| `retries` | Újrapróbálkozások | 2 | 0–5 | Átmeneti hibánál |
| `use_for_plan` | Koncepciótervezés AI-val | be | be/ki | Kikapcsolva a szabályalapú tervező készíti a koncepciókat |
| `use_for_interpret` | „AI értelmezés” gomb a látogatóknak | be | be/ki | A szabad szöveges leírás értelmezése paraméterjavaslatokká (IP-nként napi 15, kódban rögzítve) |
| `vision_prompt` | Prompt a 3D képből | be | be/ki | 1.15.0: a külső képek promptját a Claude a látogató 3D képernyőképéből írja (`includes/Prompt/VisionPrompt.php`); csak „Hű”, „Klón” és egyedi hűségnél, kulccsal és mentett 3D képpel. Hiba esetén a konfigurációs prompt megy |
| `vision_template` | Saját sablon | üres | szöveg | Üresen a beépített `assets/data/prompts/vision-exterior.txt`. A `---` sor előtt rendszerprompt, utána feladat; helyőrzők `{MAGNIFIC_DESCRIPTION}`, `{TIME_OF_DAY}`, `{SEASON}`, `{WEATHER}`, `{EXTRA_WISHES}`, üresen „default” |
| `vision_temperature` | Temperature (képleírás) | 0.2 | 0–1 | |
| `vision_timeout` | Időtúllépés (képleírás) | 60 s | 10–180 | Bekapcsolva a render feladat zárolása ennyivel (× újrapróbálás) hosszabb |
| `vision_retries` | – | 1 | 0–5 | Csak a beállítástárban |

### 5.3 `images` – Képszolgáltató kiválasztása

| Kulcs | Admin felirat | Alapérték | Értékek | Jelentés |
|---|---|---|---|---|
| `active_provider` | Aktív szolgáltató | `magnific` | `magnific`, `test`, + szűrővel regisztráltak | 4. fejezet |
| `fallback_provider` | Tartalék szolgáltató | üres (nincs) | mint fent | Végleges (nem átmeneti) hiba esetén erre vált |
| `allow_test_provider` | Teszt mód engedélyezése | be | be/ki | Kikapcsolva a teszt szolgáltató semmilyen szerepben nem használható |

### 5.4 `magnific` – Magnific API

| Kulcs | Admin felirat | Alapérték | Tartomány / értékek | Jelentés |
|---|---|---|---|---|
| `enabled` | Engedélyezve | be | be/ki | |
| *(titok)* | API-kulcs | – | – | `x-magnific-api-key` fejlécben utazik; kulcsos kérés nem követ átirányítást |
| `base_url` | Alap URL | `https://api.magnific.com` | csak `https://` URL | |
| `hero_endpoint` | Fő kép végpont (Mystic) | `/v1/ai/mystic` | relatív útvonal | A kapcsolatteszt is ezt használja |
| `mystic_model` | Mystic modell | `realism` | realism, super_real, flexible, fluid, zen, editorial_portraits | |
| `mystic_engine` | Mystic engine | `magnific_sharpy` (1.12.0-tól; korábban `automatic`) | automatic, magnific_illusio, magnific_sharpy, magnific_sparkle | A Magnific dokumentációja szerint a Sharpy a fotórealizmusé. Már elmentett beállításnál a tárolt érték marad – kézzel kell átállítani. |
| `creative_detailing` | Creative detailing | 33 | 0–100 | |
| `preview_resolution` | Koncepcióképek felbontása | `2k` | 1k / 2k / 4k | A három fő kép és a galériaképek felbontása (költség!) |
| `final_resolution` | Végleges felbontás | `4k` | 2k / 4k | Csak „Mindhárom házhoz azonnal” galériamódban, a fő képekre |
| *`aspect_ratio`* | – | `widescreen_16_9` | – | A kód minden kérésnél 16:9-et küld; ez csak tartalékérték |
| `view_strategy` | Nézetek konzisztenciája | `reference` | `reference` (Referenciakép, ajánlott) / `style` (Stílusreferencia) | Referencia: a fő kép bemeneti képként megy a további nézetekhez (Flux 2 Pro végpont); Stílus: Mystic `style_reference` |
| `reference_endpoint` | Referenciás végpont | `/v1/ai/text-to-image/flux-2-pro` | relatív útvonal | |
| `reference_width` | Referenciás kép szélesség | 1440 px | 256–1440 | |
| `reference_height` | Referenciás kép magasság | 816 px | 256–1440 | |
| `style_adherence` | Nézetek: a fő kép mint referencia (adherence) | 60 | 0–100 | `style` stratégiánál a nézetek a fő képet kapják stílusreferenciának. Mystic-értelmezés: nagyobb = jobban követi a szöveget, kisebb = jobban a referenciát |
| `structure_guidance` | Geometriai vezetés (3D modell) | be | be/ki | A látogató 3D modelljéről készült kép structure referenceként megy a fő képhez, a nézetekhez és (1.12.0-tól) a belső nézetekhez; vezetőkép nélkül a homlokzati nézetek a szerver tömegvázlatát kapják |
| `fidelity` | Hűség a 3D modellhez | `faithful` | free 25 · balanced 45 · faithful 75 · clone 85 · custom | A structure erősség; Hű és Klón fokozaton a referenciablokk a prompt elején áll |
| `structure_strength` | Egyedi hűség értéke | 75 | 0–100 | Csak `custom` hűségnél |
| `style_strength` | Stílusminta erőssége | 45 | 0–100 | A stílusonkénti mintafotó súlya; Mystic felé `adherence = 100 − érték` |
| `hdr` | HDR / részletesség | 35 | 0–100 | Csak stílusreferencia mellett megy; kisebb = természetesebb |
| `negative_inline` | Negatív prompt a szöveg végén | be | be/ki | A konfigurációból készülő tiltólista „Also avoid: …” mondatként a prompt végén (a Mysticnek nincs negatív mezője) |
| `guide_clean` | Tiszta vezetőkép | be | be/ki | A vezetőképről lekerülnek a járművek, emberek, állatok, a háttér fái és a pára |
| `hero_camera` | Fő kép kameramagassága | `auto` | auto / visitor | auto: 18° feletti látogatói nézőpontnál a hero vezetőkép 9°-ról, a látogató irányából készül (kivéve „Madártávlat” kameránál) |
| `style_ref_default` | Általános mintakép | 0 | médiatár-kép | Ha a stílusnak nincs saját mintája |
| `style_ref_interior` | Belső tér mintakép | 0 | médiatár-kép | A belső nézetek stílusmintája |
| `style_ref_<stílus>` | Mintakép: <stílus> | 0 | médiatár-kép | Stílusonként (22 + egyedi). Sorrend: ez → a stílus katalógusképe (Katalógus → Stílusok) → általános minta. A szerver 1536 px-re kicsinyítve, JPEG-ben küldi |
| `upscale_enabled` | Felskálázás a kiválasztott galériánál | ki | be/ki | A kiválasztott koncepció kész galériájában a 3840 px alatti, nem teszt képeket felskálázza (külön költség); a felskálázott képek jelölve, fájlnevük `…-upscaled` végű |
| `upscale_endpoint` | Felskálázó végpont | `/v1/ai/image-upscaler-precision` | relatív útvonal | |
| `upscale_sharpen` | Élesítés | 40 | 0–100 | |
| `upscale_ultra_detail` | Ultra detail | 30 | 0–100 | |
| `timeout` | Feladat időtúllépés | 420 s | 60–1800 | Ennyi idő után a szolgáltatónál futó képfeladat időtúllépés-hibát kap, és átmeneti hibaként újrapróbálkozik (`limits.auto_retry_max`) |
| `poll_interval` | Állapotlekérdezés gyakorisága | 6 s | 3–60 | |
| `retries` | HTTP újrapróbálkozás | 2 | 0–5 | A feladatzár hosszát is befolyásolja |
| `use_webhook` | Webhook használata | ki | be/ki | Bekapcsolva a plugin minden Magnific-kéréshez automatikusan megadja a webhook URL-t: `/wp-json/agh/v1/webhook/magnific/<titkos token>` (a token az `AUTH_SALT`-ból képződik, `Util::webhook_token()`). A mező súgója a teljes, tokenes URL-t mutatja – ne tedd közzé. A webhook tartalmában a plugin nem bízik meg: csak felgyorsítja a lekérdezést. Csak nyilvánosan elérhető HTTPS oldalon. |
| `filter_nsfw` | Tartalomszűrés (NSFW) | be | be/ki | A Magnific tartalomszűrője a Mystic-képkéréseknél; bekapcsolva hagyása ajánlott (`includes/Ai/MagnificProvider.php`) |

A tényleges felbontást a csomag `max_resolution` limitje felülről korlátozza (`includes/Generation/Pipeline.php`, `max_res()`). 4K-nak csak a ténylegesen ≥ 3840 px-es kép címkéződik (`includes/Projects/Repository.php`, `resolution_label()`).


### 5.5 `costs` – Költségbecslés és költségkeret

| Kulcs | Admin felirat | Alapérték | Jelentés |
|---|---|---|---|
| `currency` | Pénznem | `EUR` | Csak megjelenítés |
| `mystic_2k` | Mystic kép (1K/2K) ára | 0 | Egy 1K/2K Mystic-kép becsült ára |
| `mystic_4k` | Mystic kép (4K) ára | 0 | |
| `reference_image` | Referenciás kép ára | 0 | Flux 2 Pro nézetkép |
| `upscale` | Felskálázás ára | 0 | |
| `anthropic_in_mtok` | Anthropic bemenet / 1M token | 0 | |
| `anthropic_out_mtok` | Anthropic kimenet / 1M token | 0 | |
| `daily_budget` | Napi költségkeret | 0 (nincs korlát) | 7. fejezet |
| `monthly_budget` | Havi költségkeret | 0 (nincs korlát) | 7. fejezet |

Az árakat a szolgáltató aktuális árlistája alapján te adod meg; a plugin ezekkel becsül, a valós számlázás a szolgáltatónál történik.

### 5.6 `limits` – Generálási limitek, galéria, feladatsor

| Kulcs | Admin felirat | Alapérték | Tartomány | Jelentés |
|---|---|---|---|---|
| `ip_daily` | IP-címenkénti napi limit | 3 | 0–1000 | 6. fejezet |
| `user_daily` | Felhasználónkénti napi limit | 0 (nincs) | 0–1000 | Bejelentkezett felhasználóra, az IP-kerettel együtt |
| `global_daily` | Globális napi limit | 0 (nincs) | 0–100000 | Az egész oldalra |
| `burst_window_min` | Visszaélésvédelem – időablak | 10 perc | 1–120 | |
| `burst_max` | Visszaélésvédelem – max. kérés az ablakban | 2 | 0–100 | 0 = kikapcsolva |
| `concurrent_per_ip` | Egyidejű generálás / IP | 1 | 1–10 | Az utolsó 1 órában indított, még futó projektek száma |
| `timezone` | Napi időszak időzónája | üres (a webhely időzónája) | pl. `Europe/Budapest` | |
| `day_start_hour` | Nap kezdete (óra) | 0 | 0–23 | A napi keret ekkor nullázódik |
| `trusted_proxies` | Megbízható proxyk / CDN (IP vagy CIDR) | üres | lista | `docs/TELEPITES.md`, 8. fejezet |
| `proxy_header` | Továbbított IP fejléc | `X-Forwarded-For` | fejlécnév | Cloudflare: `CF-Connecting-IP` |
| `gallery_mode` | Galéria készítése | `selected` | `selected` (Csak a kiválasztott házhoz, ajánlott) / `all` (Mindhárom házhoz azonnal) | `all` módban háromszoros képköltség |
| `exterior_views` | Külső nézetek | mind a 8 | hero, front, back, left, right, aerial, garden, evening | A galéria külső nézetei. A fő kép (`hero`) mindig elkészül, a jelölése nem számít. Az esti nézet csak akkor, ha a látogató bekapcsolta az esti világítást. |
| `interiors_max` | Belső nézetek max. száma / változat | 4 | 0–20 | A csomag `max_interiors` limitje felülről korlátozza |
| `max_images_request` | Max. kép / galéria | 40 | 1–60 | Egy galériába sorolt képek felső korlátja |
| `gallery_rebuilds_per_day` | Galéria újragenerálás / nap / IP | 2 | 0–50 | Egy koncepció újragenerálásának saját napi kerete IP-nként és bejelentkezett felhasználónként; 0 = korlátlan (6.1) |
| `auto_retry_max` | Automatikus újrapróbálás átmeneti hibánál | 2 | 0–5 | Képenként |
| `dedupe_minutes` | Duplikált kérés szűrése | 20 perc | 0–1440 | Lásd 6.3 |
| `cache_hours` | Azonos konfiguráció gyorsítótár | 72 óra | 0–720 | Lásd 6.3 |
| `max_parallel_jobs` | Egyszerre futó háttérfeladatok | 4 | 0–50 | Webhelyszinten (az összes látogatóra együtt) egyszerre feldolgozott feladatok felső korlátja; 0 = nincs korlát (`JobQueue::acquire_slot()`) |

A külső nézetek számát a csomag `max_exterior_views` limitje is korlátozza (a fő képpel együtt), `detailed_gallery` funkció nélkül pedig csak a `front`, `back`, `aerial` nézetek közül készülhet (`includes/Generation/Pipeline.php`, `enqueue_gallery()`).

### 5.7 `access` – Ügyféloldali hozzáférés

| Kulcs | Admin felirat | Alapérték | Értékek | Jelentés |
|---|---|---|---|---|
| `client_gallery_previews` | Ügyfél láthatja a galéria előnézeteit | be | be/ki | Kikapcsolva az ügyfél csak a fő képeket látja |
| `client_plan_previews` | Ügyfél láthatja a tervvázlatokat | be | be/ki | A tervvázlat létrehozásakor rögzül a hozzáférési szintje, ezért csak az új projektekre hat; tervvázlat csak `floorplans` funkcióval látszik |
| `client_download` | Ügyfél letöltése | `hero` | `hero` (csak a kiválasztott ház fő képe), `none`, `all` (minden látható kép teljes méretben) | `hero` módhoz a `hero_download` funkció kell |
| `preview_max_px` | Előnézet max. mérete | 1280 px | 480–2400 | Az előnézeti JPEG hosszabbik oldala |

A teljes galéria soha nem nyilvános: a fájlok csak jogosultság-ellenőrzés után, a REST-végponton keresztül érhetők el (`includes/Rest/RestController.php`, `asset_permission()`).

### 5.8 `contractor` – Kivitelező

| Kulcs | Admin felirat | Alapérték | Tartomány | Jelentés |
|---|---|---|---|---|
| `name` | Kivitelező neve | üres | szöveg | A kivitelezői levél megszólítása (`{contractor_name}`); ha üres, a kapcsolattartó, majd a vállalkozás neve |
| `company` | Vállalkozás megnevezése | üres | szöveg | A `{contractor_name}` utolsó tartaléka |
| `contact_name` | Kapcsolattartó neve | üres | szöveg | A `{contractor_name}` első tartaléka |
| `email` | Értesítési e-mail-cím | a WordPress admin e-mail-címe | e-mail | Fő címzett |
| `lang` | Értesítések nyelve | `hu_HU` | a 16 nyelv | A kivitelezői e-mail nyelve |
| `multi_enabled` | Több kivitelező értesítése | ki | be/ki | Csak `multi_contractor` funkcióval (Agency) hat |
| `extra_emails` | További kivitelezői címek | üres | szóközzel, vesszővel vagy pontosvesszővel elválasztva | |
| `link_hours` | Hivatkozás érvényessége | 168 óra | 1–2160 | A címzettenkénti portálhivatkozás lejárata; a lejáratig többször is megnyitható |
| `session_hours` | Portál munkamenet hossza | 12 óra | 1–168 | A hivatkozásból kapott munkamenet-süti élettartama |
| `retention_days` | Csomag megőrzési ideje | 180 nap | 1–3650 | Ennyi nap után a napi takarítás törli a ZIP-et (a rekord marad) |
| `client_confirmation` | Visszaigazoló e-mail az ügyfélnek | be | be/ki | Ajánlatkérésenként egyszer megy ki, ha minden kivitelezői levél sikeres volt |

### 5.9 `emails` – E-mail-sablonok

| Kulcs | Admin felirat | Alapérték | Jelentés |
|---|---|---|---|
| `from_name` | Feladó neve | üres | Csak érvényes `from_email` mellett hat |
| `from_email` | Feladó e-mail | üres | Üresen a WordPress alapértelmezett feladója |
| `contractor_subject` | Kivitelezői e-mail tárgya | üres → „Új ajánlatkérés – {project_id}” | |
| `contractor_body` | Kivitelezői e-mail szövege | üres → beépített szöveg („Kedves {contractor_name}! …”) | |
| `client_subject` | Ügyfél-visszaigazolás tárgya | üres → „Ajánlatkérésedet továbbítottuk – {project_id}” | |
| `client_body` | Ügyfél-visszaigazolás szövege | üres → beépített szöveg | |

Részletek: 10. fejezet.

### 5.10 `legal` – Dokumentumok, hozzájárulások, adatmegőrzés

| Kulcs | Admin felirat | Alapérték | Tartomány | Jelentés |
|---|---|---|---|---|
| `terms_required` | ÁSZF elfogadása szükséges | be | be/ki | Csak akkor jelenik meg, ha `terms_url` is ki van töltve |
| `terms_url` | ÁSZF URL | üres | URL | |
| `terms_version` | ÁSZF verzió | `1.0` | szöveg | A hozzájárulási naplóba kerül |
| `privacy_url` | Adatkezelési tájékoztató URL | a WordPress adatvédelmi oldal URL-je (ha van) | URL | Üresen admin figyelmeztetés |
| `privacy_version` | Adatkezelési tájékoztató verzió | `1.0` | szöveg | A naplóba kerül (a kapcsolatfelvételi és marketing-hozzájárulásnál is ez a verzió) |
| `contact_text` | Kapcsolatfelvételi hozzájárulás szövege | üres → beépített szöveg | szöveg | |
| `marketing_enabled` | Opcionális marketing-hozzájárulás | be | be/ki | |
| `marketing_text` | Marketing-hozzájárulás szövege | üres → beépített szöveg | szöveg | |
| `retention_drafts_days` | Nem mentett projektek | 30 nap | 1–3650 | |
| `retention_projects_days` | Mentett, ajánlatkérés nélküli projektek | 180 nap | 1–3650 | |
| `retention_quotes_days` | Ajánlatkérések (utána anonimizálás) | 730 nap | 30–3650 | |
| `retention_logs_days` | Naplók | 60 nap | 1–365 | |
| `store_user_agent` | Böngészőazonosító (User-Agent) rögzítése | ki | be/ki | Bekapcsolva a böngésző user agentje is a hozzájárulási naplóba kerül (`consents.user_agent`) bizonyítékként; személyes adatnak minősülhet. A kivitelezői csomagba és portálra nem kerül, a WordPress adatexportba igen; anonimizáláskor törlődik. |

A vendégsüti (`agh_gs`) élettartama `max( retention_drafts_days, retention_projects_days )` nap, és aktivitáskor (betöltés, generálás, mentés, ajánlatkérés, projektlista) megújul (`includes/Rest/Access.php`).

### 5.11 `branding` – Arculat

Az „Alap” oszlop: ✓ = `branding_advanced` funkció nélkül (Starter) is érvényesül; – = csak Professional csomagtól (`includes/Frontend/Frontend.php`, `css_vars()` és `bootstrap_data()`).

| Kulcs | Admin felirat | Alapérték | Alap | Jelentés |
|---|---|---|:-:|---|
| `logo_id` | Logó | 0 | ✓ | A tervező fejlécében |
| `icon_id` | Ikon | 0 | – | A tervező fejlécében a ház-jel helyén, ha nincs logó (négyzetes kép ajánlott) |
| `background_image_id` | Háttérkép (homályosítva) | 0 | – | |
| `popup_title` | Popup címe | üres | – | A tervező fejlécében a termék neve helyett |
| `header_text` | Fejléc alcím | üres | – | A tervező fejlécének alcíme (üresen a készítő neve vagy a beépített szlogen) |
| `footer_text` | Lábléc szöveg (e-mailek) | üres | ✓ | Az e-mailek lábléce (üresen a webhely neve) |
| `color_primary` | Fő márkaszín | `#B9824F` | ✓ | Az e-mailek kiemelőszíne is |
| `color_accent` | Kiemelő szín | `#E2A85A` | – | |
| `color_success` | Siker | `#5E8C61` | – | |
| `color_warning` | Figyelmeztetés | `#D69A2D` | – | |
| `color_danger` | Hiba | `#C2553F` | – | |
| `color_ink` | Szövegszín (világos mód) | `#1E2226` | – | |
| `color_bg` | Háttérszín (világos mód) | `#F6F3EE` | – | |
| `font_body` | Szövegbetűtípus (CSS font-family) | rendszer-betűkészlet | – | Az admin súgója rendszer-betűkészletet javasol (külső betűtípus-szolgáltatás GDPR-kérdés) |
| `font_heading` | Címbetűtípus (CSS font-family) | `"Avenir Next", "Segoe UI", system-ui, sans-serif` | – | |
| `radius` | Lekerekítés | 22 px (0–40) | – | |
| `blur` | Üveghatás homályosítás | 18 px (0–40) | – | |
| `glass_opacity` | Üvegfelület átlátszatlansága | 0.62 (0.2–0.95) | – | |
| `shadow` | Árnyékok | `soft` (soft / none / strong) | – | A tervező ablakának, paneljeinek és párbeszédablakainak árnyéka |
| `animations` | Animációk | be | – | |
| `default_theme` | Alapértelmezett téma | `auto` (auto / light / dark) | – | |

### 5.12 `layout` – Popup elrendezés

Az elrendezési beállítások csomagtól függetlenül érvényesülnek.

| Kulcs | Admin felirat | Alapérték | Tartomány / értékek |
|---|---|---|---|
| `panel_order` | Panelek sorrendje | `params,stage,summary` | `params,stage,summary` / `summary,stage,params` / `stage,params,summary` |
| `left_width` | Paraméterpanel szélessége | 340 px | 260–480 |
| `right_width` | Összegző panel szélessége | 320 px | 240–440 |
| `action_bar` | Műveleti sáv helye | `bottom` | bottom / top |
| `show_tour` | Gyorsbemutató első megnyitáskor | be | be/ki |

---

## 6. Napi keret és visszaélés-védelem

### 6.1 Egység

- **1 generálási kérés = 3 koncepció = 1 egység** a napi keretből. A kiválasztott koncepció galériája nem von le újabb egységet.
- **Egy koncepció újragenerálása** nem a generálási keretből fogy, hanem saját napi keretből: `limits.gallery_rebuilds_per_day` IP-nként, bejelentkezett látogatónál felhasználónként is (`RestController::regenerate()`, `RateLimiter::scopes( …, 'gallery' )`). A globális napi keretből (`global_daily`) nem fogy. A tervező a megerősítésnél és a gomb súgójában mutatja a hátralévő keretet („Ma még N újragenerálás érhető el.” / „A mai újragenerálási keret elfogyott.”). Az újragenerálási egység pontosan egyszer visszajár, ha az indítás a szolgáltatói hívás előtt meghiúsul, vagy ha a kép költség nélkül véglegesen meghiúsul, megszakítják, illetve egy újabb újragenerálás felülírja (`JobQueue::refund_job_once()`). Az eredeti generálási egység ettől függetlenül nem jár vissza, ha már készült kép.

### 6.2 Ellenőrzött keretek („mind vagy egyik sem”)

`includes/RateLimit/RateLimiter.php`, `reserve()`: minden keretet egyetlen feltételes `UPDATE … WHERE hits < limit` foglal, így párhuzamos kérések sem lépik túl. (Mérve: 12 párhuzamos kérés, limit 3 → 3 elfogadva, 9 elutasítva HTTP 429-cel.)

| Keret | Forrás | Elutasítási üzenet (látogató) |
|---|---|---|
| IP-napi | effektív IP-limit (lent) | „Elérted a napi N generálási keretet…” |
| Felhasználói napi | `user_daily` (bejelentkezve) | ugyanaz |
| Globális napi | `global_daily` | „A szolgáltatás mai generálási kerete elfogyott…” |
| Rövid idejű (burst) | `burst_max` / `burst_window_min` | „Túl sok kérés rövid időn belül…” |

A keret előtt további feltételek: **egyidejű futás** (`concurrent_per_ip`; a `agh_manage` jogosultságú felhasználókra nem vonatkozik) és **költségkeret** (7. fejezet). Ez a kettő **nem atomikus**: nagyon szoros egyidejű kéréseknél kis túllépés előfordulhat; a napi keret atomikus.

**IP-kulcs:** IPv4-nél a teljes cím, IPv6-nál a /64 előtag; csak kulcsolt hash-ként tárolva (`includes/Support/Ip.php`).

**Effektív IP-limit** (`RateLimiter::ip_limit()`):

- ha `ip_daily` > 0 és van csomaglimit → `min( ip_daily, max_ip_daily )`;
- ha `ip_daily` = 0 és van csomaglimit → a csomag `max_ip_daily` értéke;
- tulajdonosi módban nincs csomaglimit → `ip_daily` (0 = nincs IP-keret).

Az aktuális értéket a Limitek és hozzáférés oldal teteje mutatja.

**Napi időszak:** a `timezone` (üresen a webhely időzónája) és a `day_start_hour` alapján (`includes/Support/Util.php`, `local_day()`).

**Visszatérítés:** a generálási egység projektenként legfeljebb egyszer visszajár (`JobQueue::refund_project_once()`), ha a projekt költségmentes maradt – nincs könyvelt költség **és** nem készült kép (`Pipeline::cost_free()`) – és: mindhárom fő kép meghiúsult, vagy a látogató bármely fázisban megszakította, miközben épp nem fut feladata (`JobQueue::cancel_project()`). Ha már készült kép, az egység nem jár vissza.

### 6.3 Azonos konfiguráció (gyorsítótár)

Ha ugyanaz a tulajdonos (bejelentkezett felhasználó, illetve vendégnél a böngészősüti) azonos konfigurációval újra generálna, a rendszer a meglévő projektet nyitja meg keretlevonás nélkül. Az időablak: `max( dedupe_minutes, cache_hours × 60 )` perc – az alapértékekkel tehát 72 óra (`includes/Rest/RestController.php`, `generate()`). A generálási végpont `force` paramétere ezt megkerülné, de a tervező felülete mindig `force: false`-szal hív.

### 6.4 Rögzített (nem állítható) kódbeli limitek

| Művelet | Limit / IP / nap | Forrás |
|---|---|---|
| AI értelmezés | 15 | `RestController::interpret()` |
| Ajánlatkérés | 5 | `QuoteService::submit()` |
| Kivitelezői hivatkozás beváltása | 30 | `RestController::contractor_session()` |
| Statisztikai esemény (popup, tervezés indítása) | 50 típusonként | `RestController::event()` |
| Magnific webhook | 2000 | `RestController::webhook()` |

Az ajánlatkérő űrlap robotszűrése (`includes/Quote/QuoteService.php`): rejtett csapdamező, valamint szerver által aláírt űrlaptoken (`GET /agh/v1/projects/{uuid}/quote-token`), amely a projekthez kötött, és csak 3 másodperc és 2 óra közötti korban fogadható el.

---

## 7. Költségbecslés és költségkeret

- Minden sikeres szolgáltatói hívás a `costs` csoport áraival a költségnaplóba kerül (`agh_ledger`; `includes/Stats/Stats.php`, `ledger()`); az Anthropic-költség a tényleges tokenhasználatból számol.
- **Keret-ellenőrzés** új generálási kérés indításakor (`3 × mystic_2k` becsléssel) és koncepció-újragenerálás indításakor (`1 × mystic_2k`) történik (`Stats::budget_allows()`). A már elindított galériák és felskálázások nem állnak meg a keret elérésekor.
- Ha az árak 0-n maradnak, a keret soha nem telik be, és minden költségkimutatás 0.
- Elutasításkor a látogató üzenete: „A szolgáltatás költségkerete átmenetileg kimerült…”.

---

## 8. Nyelvek

16 támogatott nyelv (`includes/Frontend/I18n.php`): magyar (forrás), német, angol, orosz, spanyol, lengyel, horvát, román, szlovén, szlovák, cseh, francia, olasz, holland, szerb, ukrán. A fordítások gépi (MI) fordítások – anyanyelvi lektorálás javasolt.

| Beállítás | Hatás |
|---|---|
| `general.frontend_locale` | A plugin frontend-szövegeinek kényszerített nyelve. **Alapérték `hu_HU`**: a webhely nyelvétől függetlenül magyar. `auto`: a webhely (WordPress) nyelve. A wp-admin felületre nem hat. |
| `general.enabled_locales` | A látogató által választható nyelvek. A nyelvválasztó és a `?agh_lang=` nyelvváltás csak `multilang` funkcióval (Professional+) működik (`I18n::request_switch()`). |
| `contractor.lang` | A kivitelezői értesítő e-mail nyelve. |
| *(automatikus)* | Az ügyfél-visszaigazoló e-mail az ajánlatkéréskor használt nyelven megy ki. |

Hiányzó fordításnál magyar szöveg jelenik meg. A nyelvi fájlok állapotát a **Súgó és rendszer** oldal mutatja. Az egyedi paraméterek megjelenítési neve nyelvenként megadható (Paraméterek oldal → „Fordítások”). A gyári gyorsbemutató és GYIK fordított; a Súgó oldalon **szerkesztett** tartalom viszont egy példányban tárolódik, és minden nyelven így jelenik meg (`includes/Frontend/Help.php`; az admin oldal is jelzi).

---

## 9. Arculat

- **`branding_advanced` nélkül (Starter)** a tervezőben és a kivitelezői portálon csak az alap arculat érvényesül: logó, termék neve (`general.plugin_name`) és fő márkaszín; az elrendezési beállítások (panelszélességek, sorrend) is. A többi arculati beállítás menthető, de a gyári stílusérték marad érvényben (5.11).
- A beállítások CSS-változókként kerülnek a tervezőbe és a portálba (`Frontend::css_vars()`).
- Minden mentés előtt az előző állapot (branding + layout + general) a **Korábbi designverziók** listába kerül (utolsó 10), és onnan visszaállítható.
- Az e-mailek fejlécében a `plugin_name` és a `color_primary`, láblécében a `footer_text` jelenik meg (`templates/emails/layout.php`) – csomagtól függetlenül.
- `white_label` funkcióval (Agency) a `general.author_name` nem jelenik meg a tervezőben.

---

## 10. Kivitelező, értesítések, e-mail

### 10.1 Az ajánlatkérés útja

`includes/Quote/QuoteService.php`:

1. A látogató beküldi az űrlapot → az ajánlatkérés és **minden hozzájárulás** (megadott és meg nem adott is) naplózódik.
2. `package` feladat: ha a kiválasztott koncepció galériája még készül, legfeljebb **20 percig** vár rá; utána a meglévő képekből elkészül a ZIP-csomag, és a `00_OLVASSEL.txt` felsorolja a hiányzó (még készülő vagy sikertelen) képeket (`includes/Quote/PackageBuilder.php`).
3. `notify` feladat: minden címzett **saját, címzetthez kötött** portálhivatkozást kap (`link_hours` ideig érvényes, a lejáratig többször megnyitható). Új hivatkozás küldésekor az adott címzett korábbi hivatkozásai visszavonódnak.
4. A kézbesítés címzettenként rögzül (`quotes.recipients`). Újrapróbáláskor csak a sikertelen címzettek kapnak újra levelet. Ha minden kivitelezői levél sikeres → állapot `notified`, naplóesemény `forwarded`. Végleges hibánál (4 próbálkozás után) állapot `notify_failed`; naplóesemény `forwarded_partial`, ha legalább egy címzett megkapta, különben `forward_failed`.
5. Ha `client_confirmation` be van kapcsolva és minden kivitelezői levél sikeres, az ügyfél **egyszer** visszaigazolást kap (újraküldéskor nem ismétlődik).

**Címzettek:** `contractor.email` + – ha `multi_enabled` be van kapcsolva **és** a csomagban van `multi_contractor` – az `extra_emails` címei (kisbetűsítve, ismétlés nélkül). A kivitelezői levél `Reply-To` fejléce az ügyfél e-mail-címe.

### 10.2 Sablonok és változók

A sablonok **egyszerű szövegek**: a plugin HTML-escape-eli, a sortöréseket és a linkeket alakítja HTML-lé (`includes/Mail/Mailer.php`); HTML-kód nem használható. Üresen hagyott mezőnél a beépített (fordított) szöveg érvényes.

Változók: `{site_name}`, `{project_id}`, `{concept}`, `{client_name}`, `{client_email}`, `{client_phone}`, `{city}`, `{site_location}`, `{start_period}`, `{budget}`, `{note}`, `{link}`, `{expires}`, `{contractor_name}`.

A `{contractor_name}` értéke: `contractor.name`, ha üres, `contractor.contact_name`, végül `contractor.company` (`QuoteService::contractor_name()`). A `{link}` a portálhivatkozás; a hozzáférési token csak az URL `#` utáni részében utazik, így nem kerül a szerver- és proxynaplókba (`includes/Quote/AccessTokens.php`).

### 10.3 Kézbesíthetőség

A plugin a WordPress `wp_mail()` függvényével küld. Éles használatra SMTP-bővítmény és a feladó domainjére beállított SPF/DKIM javasolt; a `from_email` legyen ugyanazon a domainen. Próba: Kivitelező és e-mail → „Teszt e-mail küldése magamnak”. *A tényleges kézbesítés tesztkörnyezetben nem volt ellenőrizve.*

---

## 11. Hozzájárulások és jogi dokumentumok

Az ajánlatkérő űrlap hozzájárulásai (`QuoteService::consents()`):

| Típus | Kötelező | Megjelenik, ha… | Naplózott verzió |
|---|---|---|---|
| `terms` (ÁSZF) | igen | `terms_required` be **és** `terms_url` ki van töltve | `terms_version` |
| `privacy` (adatkezelési tájékoztató megismerése) | igen | mindig | `privacy_version` |
| `contact` (továbbítás a kivitelezőnek, kapcsolatfelvétel) | igen | mindig | `privacy_version` |
| `marketing` | nem | `marketing_enabled` be | `privacy_version` |

Minden beküldéskor mindegyik aktuális hozzájárulás külön sorba kerül az `agh_consents` táblába: típus, megadva/nem, dokumentumverzió, dokumentum-URL, IP-hash, időpont, és – ha `legal.store_user_agent` be van kapcsolva – user agent. A továbbítás eseménye (`forwarded` / `forwarded_partial` / `forward_failed`) is ide kerül.

**Verziózás gyakorlata:** amikor az ÁSZF vagy az adatkezelési tájékoztató szövege változik, emeld a verziószámot (pl. `1.0` → `2026-10`), így utólag igazolható, ki melyik változatot fogadta el.

> A plugin jogi szövegei és a WordPress adatvédelmi útmutatóba beküldött szövegrész **sablonok**; jogásszal ellenőriztesd őket.

---

## 12. Statisztika

Külön beállítása nincs. A statisztika napi összesített, személyazonosításra nem alkalmas adatokat gyűjt (`includes/Stats/Stats.php`); a költségmutatók a `costs` csoport áraiból számolnak. A részletes bontások `stats_advanced` funkcióval érhetők el (a REST-válaszban is). A **CSV-export** csak `export_advanced` funkcióval (Agency) érhető el; bontássorokat csak `stats_advanced` mellett tartalmaz.

---

## 13. Adatvédelem és adatmegőrzés

- **Napi takarítás** (`agh_cron_daily` → `Privacy::retention()`): törli a lejárt nem mentett és mentett, **ajánlatkérés nélküli** projekteket (fájlokkal együtt, futásonként legfeljebb 200-at), anonimizálja a megőrzési időn túli ajánlatkéréseket, törli a lejárt kivitelezői ZIP-eket, a régi naplókat, keretszámlálókat, tokeneket és befejezett feladatokat.
- **Azonnali futtatás:** Jogi és GDPR → „Adatmegőrzési takarítás futtatása most”, vagy `wp agh retention`.
- **Anonimizálás** (`QuoteService::anonymize()`): név → `[törölve]`; e-mail, telefon, település, építési helyszín, tervezett kezdés, költségkeret, megjegyzés törlése; a hozzájárulási napló IP-hash-e és user agentje törlődik; a ZIP törlődik; a kivitelezői hivatkozások és munkamenetek visszavonódnak. Ha a projekthez nem marad aktív ajánlatkérés, a projekt is anonimizálódik (`Repository::anonymize_project()`, `scrub_config()`): minden szöveges paraméter (pl. szabad leírás, projekt- és háznév, ország, egyedi stílus, az egyedi szöveges paraméterek) kiürül, a helyiségek szöveges mezői (pl. megjegyzés) törlődnek, a helyiségnevek általános típusnévre állnak; a fájlok, képek, koncepciók törlődnek, a projekt `deleted` állapotú lesz, és sehol nem jelenik meg. A számok, választások és méretek megmaradnak.
- **WordPress adatvédelmi eszközök** (Eszközök → Személyes adatok exportálása / törlése): az exportáló és a törlő lapoz (20 tétel / oldal). E-mail-cím alapján exportálja, illetve anonimizálja az ajánlatkéréseket; ha a cím WordPress-felhasználóé, a projektjeit is exportálja, illetve törli (az ajánlatkéréses projekteket anonimizálja), és törli a felhasználó presetjeit.
- **IP-cím:** csak kulcsolt hash-ként tárolódik.
- **AI-szolgáltatók felé** a ház paraméterei, a szabad szöveges leírás és a generált/referenciaképek mennek; személyes elérhetőség nem (az AI-szolgáltatók oldal „Szolgáltatói adatkezelés” szövege szerint). Ezt tüntesd fel az adatkezelési tájékoztatóban.

---

## 14. Licenc

| Elem | Leírás |
|---|---|
| Licenckulcs | Licenc oldal → „Aktiválás”. Formátum: 8–80 karakter, betű, szám, kötőjel. Titkosítva tárolódik (`license_key`). |
| Licencszerver | „Szerver URL (HTTPS)” és „Szerver nyilvános kulcsa (Ed25519, base64)”, vagy `AGH_LICENSE_SERVER` / `AGH_LICENSE_PUBKEY` konstans. Csak HTTPS szerverrel működik. Referencia-szerver: `tools/license-server/` (külön telepítendő, lásd a mappa README-jét). |
| Ellenőrzés | Naponta automatikusan (`agh_cron_daily`), vagy az „Ellenőrzés” gombbal. Minden szerverválasz Ed25519-aláírását, a kérés nonce-át, a példányazonosítót és a ±10 perces frissességet ellenőrzi. |
| Türelmi idő | Hálózati hiba, nem átmeneti HTTP-hiba, érvénytelen aláírás vagy nem a kéréshez tartozó válasz esetén – de csak ha a licenc előtte aktív volt (vagy már türelmi időben volt) – az állapot „Szerver nem elérhető (türelmi idő)”; a legutóbbi sikeres ellenőrzéstől számított **14 napig** a korábbi csomag érvényes, utána Starter. Nem aktív, lejárt, érvénytelen vagy weboldal-limites licencet szerverhiba nem kapcsol vissza. A licenchívások nem követnek átirányítást. |
| Lejárat | Lejárat előtt 14 nappal admin figyelmeztetés. Lejárat után a projektek és beállítások megmaradnak, a prémium funkciók kikapcsolnak (Starter). |
| Deaktiválás | A szerver felé felszabadítja a helyet, helyben törli a kulcsot, a csomag Starterre vált. |
| Frissítés | Lásd `docs/TELEPITES.md`, 10. fejezet (SHA-256-ellenőrzés). |

A licenc a plugin használati jogát szabályozza; a Magnific és Anthropic díjait a saját szolgáltatói fiókod fizeti. A csomagmátrix ügyféloldalon rögzített (2.2).

---

## 15. Kapcsolódó, nem a beállítástárban tárolt konfiguráció

| Terület | Hol | Részletek |
|---|---|---|
| Promptmodulok, nézetszabályok, stílusfelülírások | Promptmotor | `docs/ADMIN-KEZIKONYV.md` |
| Egyedi paraméterek, beépített paraméterek testreszabása | Paraméterek | `docs/ADMIN-KEZIKONYV.md`, formátum: `docs/MINTA-KONFIGURACIOK.md` |
| Katalógus (BRAMAC, anyagok, színek, stílusok, presetek) | Katalógus | `docs/ADMIN-KEZIKONYV.md` |
| Gyorsbemutató, GYIK | Súgó és rendszer | `docs/ADMIN-KEZIKONYV.md` |
