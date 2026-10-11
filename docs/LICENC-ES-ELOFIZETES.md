# AutoGroweHome – Licenc és előfizetés

*AutoGroweHome 1.0.0 – kereskedelmi licenc. Szerző: Koltai Norbert – Infostudio.*

Ez a dokumentum a csomagokat, a licencaktiválás protokollját, a frissítések kézbesítését és a fizetési bővítési pontot írja le. A `includes/License/LicenseManager.php` fejléce erre a dokumentumra hivatkozik mint a licencszerver-szerződés leírására.

> **A licenc nem tartalmazza a külső MI-szolgáltatók díjait.** A Magnific- és Anthropic-díjakat az üzemeltető a saját API-kulcsával, közvetlenül a szolgáltatónak fizeti. A licenc nem jelent korlátlan képgenerálást (`templates/pricing.php`, „Fontos tudnivalók”).

| Modul | Fájl |
|---|---|
| Csomagok, funkciók, limitek | `includes/License/Features.php` |
| Aktiválás, ellenőrzés, frissítés | `includes/License/LicenseManager.php` |
| Fizetési bővítési pont | `includes/License/Payments.php`, `PaymentGatewayInterface.php`, `ExternalCheckoutGateway.php` |
| Nyilvános árlap | `templates/pricing.php` (`[autogrowehome_pricing]`) |
| Admin felület | **Admin → Licenc** (`includes/Admin/Pages.php`, `page_license()`) |
| Referencia-licencszerver | `tools/license-server/` ([README](../tools/license-server/README.md)) |

---

## 1. Csomagok és funkciómátrix

A csomagok adatvezéreltek: a beépített mátrix a `Features::default_plans()`-ban van. **A csomagmátrix (funkciók és limitek) csak tulajdonosi módban (`AGH_OWNER_MODE`) szerkeszthető és érvényes** – ez a forgalmazó saját példánya, amelynek árlapja a csomagokat mutatja; itt a mentett változat az `agh_plans` opcióba kerül (**Admin → Licenc → Csomagok**); a tárolt funkciólistákból a plugin kiszűri azokat a kulcsokat, amelyek már nem szerepelnek a funkciókatalógusban. **Vásárlói oldalon mindig a beépített mátrix érvényes, teljes egészében** – a név, a célközönség és az ár is a beépített (`Features::plans()`); a tárolt `agh_plans` opciót a plugin figyelmen kívül hagyja. Az admin csak olvasható táblázatot lát („A csomagok funkciói és limitjei rögzítettek; a csomagmátrix csak a plugin tulajdonosi példányán (AGH_OWNER_MODE) szerkeszthető.”).

### Funkciók (alapértelmezés)

| Funkció (kulcs) | Felirat | Starter | Professional | Agency | Hol érvényesül a kódban |
|---|---|:-:|:-:|:-:|---|
| `designer` | Háztervező popup | ✓ | ✓ | ✓ | shortcode, lebegő gomb, generálás és újragenerálás (`Frontend.php`, `RestController::generate()` / `regenerate()`) |
| `basic_params` | Alapvető házparaméterek | ✓ | ✓ | ✓ | leíró tétel az összehasonlításhoz: minden csomagban elérhető, külön kapu nincs |
| `three_concepts` | Három házkoncepció generálása | ✓ | ✓ | ✓ | `RestController::generate()` / `regenerate()` |
| `basic_gallery` | Alapvető képgaléria | ✓ | ✓ | ✓ | leíró tétel az összehasonlításhoz: minden csomagban elérhető, külön kapu nincs |
| `hero_download` | Kiemelt látványkép letöltése | ✓ | ✓ | ✓ | fő kép letöltése (`RestController`) |
| `project_save` | Projektmentés | ✓ | ✓ | ✓ | Mentés gomb és végpont |
| `contractor_email` | Kivitelezői e-mail-értesítés | ✓ | ✓ | ✓ | Ajánlatkérés gomb, valamint szerveroldalon a `/quote` és `/quote-token` végpont |
| `full_params` | Teljes paraméterezési rendszer | – | ✓ | ✓ | nélküle csak az alap mezők látszanak (`Registry::basic_ids()`) |
| `prompt_editor` | Szerkeszthető promptmotor | – | ✓ | ✓ | Admin → Promptmotor |
| `detailed_gallery` | Részletes galéria (minden nézet) | – | ✓ | ✓ | nélküle csak elöl-, hátulnézet, madártávlat (`Pipeline::enqueue_gallery()`) |
| `floorplans` | Tervvázlat-generáló modul | – | ✓ | ✓ | SVG-tervvázlatok, Tervvázlatok fül; a meglévő tervvázlat-fájlok kiszolgálása és ZIP-be kerülése is (`RestController::feature_allows()`, `PackageBuilder`) |
| `stats_advanced` | Részletes statisztikák | – | ✓ | ✓ | a statisztika bontásai szerveroldalon (`/admin/stats`) és a CSV bontássorai |
| `branding_advanced` | Haladó arculati beállítások | – | ✓ | ✓ | nélküle csak a logó, a név és a fő szín érvényesül (`Frontend::css_vars()`, `bootstrap_data()`) |
| `multilang` | Többnyelvű működés | – | ✓ | ✓ | látogatói nyelvválasztó; a `?agh_lang=` nyelvváltás is csak ezzel működik |
| `package_full` | Részletes kivitelezői csomag (ZIP) | – | ✓ | ✓ | nélküle a ZIP-ben csak fő kép, elöl- és hátulnézet + tervek, dokumentumok |
| `custom_params` | Dinamikus paraméterszerkesztő | – | ✓ | ✓ | Admin → Paraméterek, új paraméter mentése (`Registry::save_custom()`); a funkció nélkül a felvett paraméterek az adatbázisban maradnak, de sehol nem aktívak (tervező, ellenőrzés, tervezés, prompt; `Registry::fields()`) |
| `white_label` | White-label | – | – | ✓ | a készítő neve rejtve a tervezőben |
| `multi_contractor` | Több kivitelező kezelése | – | – | ✓ | további kivitelezői e-mail-címek |
| `export_advanced` | Bővített exportálás (CSV, CAD-JSON, DXF) | – | – | ✓ | DXF és a bővítményként regisztrált CAD-exportálók (alapból), a DXF kiszolgálása és ZIP-be kerülése, a statisztika CSV-exportja; a helyiséglista-CSV és az épület-JSON minden csomagban készül |

A korábbi `roles_advanced` („Haladó jogosultságkezelés”) funkció kikerült a katalógusból, mert nem volt megvalósítva. A plugin szerepkörei (pl. `agh_manager`, `agh_contractor`) minden csomagban létrejönnek.

### Limitek (alapértelmezés)

| Limit (kulcs) | Starter | Professional | Agency | Hatás |
|---|:-:|:-:|:-:|---|
| Weboldalak száma (`sites`) | 1 | 1 | 25 | Az árlapon jelenik meg; ténylegesen a licencszerver érvényesíti (lásd 3. pont) |
| Max. napi IP-limit (`max_ip_daily`) | 3 | 10 | 50 | Felső korlát: az admin IP-limitje és ez közül a kisebb érvényes (`RateLimiter::ip_limit()`) |
| Max. külső nézet (`max_exterior_views`, a fő képpel együtt) | 4 | 8 | 8 | `Pipeline::enqueue_gallery()` |
| Max. belső nézet (`max_interiors`) | 2 | 6 | 10 | Az admin `interiors_max` értékével (alap: 4) együtt a kisebb érvényes |
| Max. felbontás (`max_resolution`) | 2k | 4k | 4k | A kért felbontás felső korlátja (`Pipeline::max_res()`) |

Tulajdonosi módban mentéskor a plugin korlátozza az értékeket (`Features::save_plans()`): weboldal ≥ 1, IP-limit ≥ 0, külső nézet 1–8, belső nézet 0–20, felbontás `1k`/`2k`/`4k`. Az `owner` csomagazonosító foglalt, a `starter` csomag mindig létezik. Vásárlói oldalon a `save_plans()` semmit nem ír (az űrlap ott meg sem jelenik).

> **Korlát:** a licenc PHP-kódban érvényesül, ezért aki a plugin kódját módosítja, megkerülheti – ez minden telepített PHP-pluginnál így van. A licencállapotot az `agh_license` opció aláírás nélkül tárolja, így adatbázis- vagy PHP-hozzáféréssel átírható. A csomagmátrix admin felületről történő átírása vásárlói oldalon nem lehetséges.

### Árak

A `price_month` és `price_year` mező **alapból üres**, szabad szöveg (pl. „39 € / hó”), és csak tulajdonosi módban tölthető ki. Üres árnál – így vásárlói oldalon mindig – az árlap ezt írja: „Ár egyeztetés alapján”.

## 2. Havi és éves számlázás

- **Pluginoldalon** – tulajdonosi módban – csomagonként két ár és két fizetési link adható meg (havi / éves), **Admin → Licenc → Csomagok** („Havi ár / fizetési link”, „Éves ár / fizetési link”). A link csak `https://` kezdetű lehet; a linkeket az `agh_checkout_urls` opció tárolja. Vásárlói oldalon ez a táblázat csak olvasható.
- **Licencszerver-oldalon** a számlázási ciklus: `monthly`, `yearly` vagy `lifetime` (lejárat nélküli). Létrehozás és megújítás a szerver `create()` / `extend()` műveletével (CLI vagy a fizetési szolgáltató webhookja).

## 3. Weboldal-limit (több webhely)

- A licencszerver az aktiválást írási tranzakcióban számolja és rögzíti, így párhuzamos kérésekkel sem lépi túl a weboldal-limitet (mérve: 10 párhuzamos aktiválás 3 helyre → pontosan 3).
- Ha a limit betelt, a válasz állapota `site_limit` („Elérte a weboldal-limitet”), és a plugin Starter szinten működik.
- Egy telepítést a **példányazonosító** (`instance_id`) azonosít: első használatkor generált UUIDv4, az `agh_license` opcióban tárolva (`LicenseManager::instance_id()`), és az admin Licenc oldalán látható.
- Hely felszabadítása: a pluginban **Deaktiválás**, vagy a szerveren `free-site` (pl. ha a régi tárhely már nem elérhető).
- A plugin `sites` limitje csak megjelenítési adat; a vásárlóhoz tartozó tényleges limit a szerveren a licenc létrehozásakor (`--sites`) dől el.

## 4. Aktiválás, ellenőrzés, deaktiválás

### Beállítás

1. Licencszerver megadása – vagy a `wp-config.php`-ban (ajánlott):
   ```php
   define( 'AGH_LICENSE_SERVER', 'https://license.example.com' );
   define( 'AGH_LICENSE_PUBKEY', '...base64 Ed25519 nyilvános kulcs...' );
   ```
   vagy az **Admin → Licenc → Licencszerver** űrlapon (az `agh_license_server` opcióba). Konstans esetén az űrlapmező csak olvasható.
2. A licenckulcs megadása az **Aktiválás** mezőben. Formátum: 8–80 karakter, betű/szám/kötőjel. A kulcs titkosítva tárolódik (`Secrets`), vagy konstansként adható meg: `define( 'AGH_LICENSE_KEY', '...' );` (`includes/Support/Secrets.php`).

Gombok: **Aktiválás**, **Ellenőrzés**, **Deaktiválás**. Automatikus ellenőrzés naponta egyszer (`agh_cron_daily` → `LicenseManager::check()`, `includes/Plugin.php`).

### Kérés

`POST {szerver}/v1/license/{activate|check|deactivate}`, JSON-törzs:

| Mező | Tartalom |
|---|---|
| `action` | `activate` / `check` / `deactivate` |
| `license_key` | licenckulcs |
| `site_url` | `home_url('/')` |
| `instance_id` | példányazonosító (UUIDv4) |
| `plugin_version` | `AGH_VERSION` |
| `nonce` | kérésenként új, 12 véletlen bájt hexában |

Csak `https://` szerver-URL fogadható el; HTTP-időtúllépés 20 s, 1 újrapróbálás, átirányítást a plugin nem követ (a kulcs a kérés törzsében van).

### Válasz és ellenőrzés

A válasz formája: `{"data": {...}, "signature": "<base64>"}`. A plugin akkor fogadja el, ha **mind** teljesül:

1. a `signature` érvényes **Ed25519** aláírás (sodium, `sodium_crypto_sign_verify_detached`) a `data` kanonikus JSON-alakján – felső szintű kulcsok ábécérendben, `JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE` (`LicenseManager::canonical()`) – a beállított nyilvános kulccsal;
2. `data.instance_id` megegyezik a saját példányazonosítóval;
3. `data.nonce` megegyezik az elküldött nonce-szal;
4. `data.issued_at` legfeljebb **600 másodperccel (10 perc)** tér el a szerveridőtől.

Hiányzó nyilvános kulcs vagy sodium-kiterjesztés esetén a hívás meg sem történik. Érvénytelen aláírásnál: „A licencszerver válaszának aláírása érvénytelen.” Nonce-, példány- vagy időeltérésnél: „A licencválasz nem ehhez a kéréshez tartozik.” Mindkét esetben a türelmi idő szabályai érvényesek (lásd lent).

A `data` mezői (a referencia-szerver szerint): `status`, `plan`, `billing_cycle`, `expires_at`, `sites_allowed`, `sites_used`, `update_entitled`, `instance_id`, `nonce`, `issued_at`. A plugin csak a saját csomaglistájában szereplő `plan` értéket fogadja el.

### Állapotok

| `status` | Felirat az adminban | Hatás |
|---|---|---|
| `active` | Aktív | a licencelt csomag érvényes (ha `expires_at` nem múlt el) |
| `expired` | Lejárt | Starter |
| `invalid` | Érvénytelen | Starter (pl. ismeretlen vagy visszavont kulcs) |
| `inactive` | Nincs aktiválva | Starter |
| `site_limit` | Elérte a weboldal-limitet | Starter |
| `unreachable` | Szerver nem elérhető (türelmi idő) | a korábbi csomag a türelmi idő végéig |

Az **effektív csomag** (`LicenseManager::effective_plan()`, az admin „Effektív csomag” sora): a mentett csomag, ha az állapot `active` és a lejárat nem múlt el; `unreachable` állapotban a türelmi időn belül szintén; minden más esetben `starter`. A lejárati dátumot a plugin helyben is figyeli, így lejáratkor napi ellenőrzés nélkül is Starterre vált.

### Türelmi idő (14 nap)

Ha az ellenőrzés bármilyen okból nem ad hiteles választ – hálózati hiba, **bármilyen** HTTP-hiba, érvénytelen aláírás, vagy nem a kéréshez tartozó válasz (példány, nonce, idő) –, van mentett csomag, **és az előző állapot `active` vagy `unreachable` volt**, az állapot `unreachable` lesz (`LicenseManager::start_grace()`). A korábbi csomag az utolsó sikeres (`active`) ellenőrzéstől számított **14 napig** (`GRACE_DAYS`) érvényes, utána Starter; egy hibás vagy hamisított szerver így sem tarthatja bekapcsolva a prémium funkciókat a türelmi időn túl. Ha az előző állapot `inactive`, `expired`, `invalid` vagy `site_limit` volt, egy hibás ellenőrzés ezt nem változtatja meg (csak a hibaüzenet mentődik), így a csomag nem éled újra. Átmeneti hibánál az üzenet: „A licencszerver átmenetileg nem érhető el; a korábbi állapot érvényes a türelmi idő végéig.”

### Lejárati figyelmeztetés

Aktív licencnél a lejárat előtti **14 napban** minden admin oldalon figyelmeztetés jelenik meg (`LicenseManager::expiry_notice()`): „Az AutoGroweHome licenc N napon belül lejár. A projektek és beállítások lejárat után is megmaradnak, de a prémium funkciók kikapcsolnak.”

### Mi történik lejáratkor?

- **Adat nem vész el:** projektek, ajánlatkérések, beállítások, promptverziók, katalógus megmaradnak.
- A **prémium funkciók kikapcsolnak**, a Starter funkciók működnek tovább (tervező, 3 koncepció, galéria, fő kép letöltése, mentés, ajánlatkérés).
- A nem Starter-mezők (pl. tető részletei, konyha, fürdő) a tervezőben rejtetté válnak, a látogató nem állíthatja őket (`Registry::fields()`; a meglévő projektek tárolt beállításai nem változnak).
- A Starter limitek érvényesülnek (pl. napi IP-limit legfeljebb 3, 2K felbontás, legfeljebb 3 külső nézet + fő kép, 2 belső nézet).
- Frissítést a szerver nem kínál (`update_entitled = false`).

### Deaktiválás

A **Deaktiválás** felszabadítja a helyet a szerveren, törli a tárolt kulcsot, és a helyi állapotot `inactive`-ra, a csomagot üresre állítja – **a szerver válaszától függetlenül**. Ha a szerver ekkor nem érhető el, a hely a szerveren foglalt marad (`free-site` paranccsal szabadítható fel). Ha a kulcs `AGH_LICENSE_KEY` konstansban van, a konstans továbbra is érvényes.

## 5. Frissítések kézbesítése

Frissítés csak HTTPS-licencszerverrel, beállított nyilvános kulccsal és sodium-kiterjesztéssel érhető el (`LicenseManager::update_server()`).

1. A WordPress frissítéskeresésekor (`pre_set_site_transient_update_plugins` → `LicenseManager::filter_updates()`) a plugin – csak `update_entitled` állapotban és tárolt kulccsal – lekérdezi: `POST {szerver}/v1/update/check` (`license_key`, `instance_id`, `version`, `site_url`, `nonce`; átirányítás követése nélkül).
2. A választ (`version`, `package`, `sha256`, `requires_php`, `tested`, `instance_id`, `nonce`, `issued_at`) ugyanúgy ellenőrzi, mint a licenchívásokat: Ed25519-aláírás, saját példányazonosító, visszaküldött nonce, legfeljebb ±10 perces `issued_at` (`LicenseManager::update_info()`). Az eredményt – érvénytelen válasz esetén üresen – 12 órára gyorsítótárazza (`agh_update_info` site transient).
3. Csak akkor kínál frissítést, ha a verzió újabb, a csomag-URL a beállított szerver `/v1/update/package/` útvonalával kezdődik, és az aláírt adatban van érvényes **SHA-256** ellenőrzőösszeg.
4. **A csomag-URL nem tartalmaz titkot.** A letöltéskor (`http_request_args` → `LicenseManager::package_auth()`) a plugin a kulcsot az **`X-AGH-License`**, a példányazonosítót az **`X-AGH-Instance`** fejlécben küldi – kizárólag a beállított HTTPS-szerver csomagvégpontjára, kötelező TLS-ellenőrzéssel és átirányítás nélkül.
5. A ZIP-et a plugin maga tölti le (`upgrader_pre_download` → `LicenseManager::pre_download()`), és csak egyező SHA-256 esetén adja át a WordPress-telepítőnek. Eltérésnél vagy hiányzó ellenőrzőösszegnél a telepítés megszakad: „A letöltött frissítőcsomag ellenőrzőösszege nem egyezik; a telepítés megszakítva.”, illetve „A frissítőcsomag nem ellenőrizhető (hiányzó vagy érvénytelen aláírt ellenőrzőösszeg).”

## 6. Konstansok

| Konstans | Hatás | Forrás |
|---|---|---|
| `AGH_OWNER_MODE` | `true` esetén minden funkció engedélyezett licencellenőrzés nélkül; a csomaglimitek nem korlátoznak (az admin limitjei igen), és a csomagmátrix szerkeszthető. Az adminban: „Tulajdonosi mód (AGH_OWNER_MODE)”. Az `agh_owner_mode` szűrő csak kikapcsolni tudja (pl. a vásárlói viselkedés teszteléséhez), bekapcsolni nem. | `Features::owner_mode()` |
| `AGH_LICENSE_SERVER` | Licencszerver HTTPS-címe (felülírja az admin beállítást) | `LicenseManager::config()` |
| `AGH_LICENSE_PUBKEY` | A szerver Ed25519 nyilvános kulcsa, base64 (felülírja az admin beállítást) | `LicenseManager::config()` |
| `AGH_LICENSE_KEY` | Licenckulcs konstansként (elsőbbséget élvez a tárolt kulccsal szemben) | `Secrets` |

Az `AGH_OWNER_MODE` a szerző saját telepítéseire való. A kód nem ellenőrzi, ki állítja be; használatát a licencszerződésnek kell szabályoznia.

## 7. Fizetési modul

A plugin **nem kezel és nem tárol kártyaadatot** (`includes/License/Payments.php`). A beépített „Külső (hosztolt) fizetési oldal” átjáró (`external_checkout`) csak a csomagonként és időszakonként megadott, hosztolt fizetési oldalra mutató **Megrendelés** gombot jeleníti meg (pl. Stripe Payment Link, Paddle, Lemon Squeezy, WooCommerce Subscriptions termék). A licenckulcs kiadása a licencszerveren történik, a fizetési szolgáltató webhookja alapján.

### Saját fizetési átjáró

Az átjárónak a `AutoGroweHome\License\PaymentGatewayInterface` interfészt kell megvalósítania (saját fájl: `includes/License/PaymentGatewayInterface.php`, a PSR-4 autoloader betölti), és az `agh_payment_gateways` szűrőn regisztrálható:

```php
interface PaymentGatewayInterface {
	public function id(): string;
	public function label(): string;
	public function configured(): bool;
	/** Checkout URL for a plan/period or '' when not available. */
	public function checkout_url( string $plan, string $period ): string; // $period: 'month' | 'year'
}
```

```php
// Példa – a PaymentGatewayInterface.php fejlécében szereplő minta szerint.
add_filter( 'agh_payment_gateways', function ( $list ) {
	$list['sajat'] = new Sajat_Gateway(); // implements \AutoGroweHome\License\PaymentGatewayInterface
	return $list;
} );
```

**Melyik átjáró aktív?** (`Payments::active()`)

1. Az `agh_payment_gateway` opcióban kifejezetten kiválasztott átjáró (az `agh_payment_gateway_id` szűrővel felülírható), ha regisztrálva van és be van állítva (`configured()`). Ehhez az opcióhoz nincs admin felület.
2. Ennek hiányában az első beállított, a szűrőn regisztrált (nem beépített) átjáró – aki saját átjárót ad hozzá, azt szeretné használni.
3. Végül a beépített `external_checkout`, ha van kitöltött fizetési link.

A szűrőn kapott elemek közül csak az interfészt megvalósítók kerülnek a listába (`Payments::gateways()`).

Fizetési szolgáltató (Stripe, Barion, SimplePay stb.) nincs beépítve és nincs tesztelve; ütemterv: [BOVITESI-TERV.md](BOVITESI-TERV.md).

## 8. Nyilvános árlap (`[autogrowehome_pricing]`)

A shortcode a `templates/pricing.php` sablont jeleníti meg (`Frontend::sc_pricing()`); minden adat a csomagbeállításokból jön, nincs benne beégetett ár.

- **Fejléc:** a termék neve (`general.plugin_name`), „AI-alapú háztervező a weboldaladra”, a folyamat lépései (Paraméterek → 3 koncepció → Galéria és tervvázlatok → Ajánlatkérés) és **Havi / Éves** váltó (`assets/js/agh-pages.js`).
- **Csomagkártyák** a `Features::plans()` sorrendjében (a Professional kiemelve): név, célközönség, a kiválasztott időszak ára (üresen „Ár egyeztetés alapján”), a teljes funkciólista bekapcsolt/kikapcsolt jelöléssel, „N weboldal”.
- **Megrendelés** gomb, ha az aktív fizetési átjáró ad URL-t az adott csomaghoz (ha csak az egyik időszakhoz van link, mindkét nézetben azt használja); különben: „Online megrendelés hamarosan – érdeklődj elérhetőségeinken.”
- **Fontos tudnivalók:** az MI-díjak nincsenek benne; nincs korlátlan generálás; lejáratkor az adatok megmaradnak; a tervvázlatok nem engedélyezési/kiviteli dokumentációk.

Használat (a forgalmazó tulajdonosi módú oldalán): hozz létre egy oldalt (pl. „Árak”), tedd bele a `[autogrowehome_pricing]` shortcode-ot, majd töltsd ki az árakat és a fizetési linkeket az **Admin → Licenc → Csomagok** táblázatban. A sablon a weboldal saját, érvényes csomagbeállításait mutatja (vásárlói oldalon a beépített mátrixot, ár nélkül), ezért a forgalmazó saját értékesítési oldalára való, nem a vásárlók oldalaira.

## 9. Referencia-licencszerver

Részletes telepítési és üzemeltetési leírás: **[tools/license-server/README.md](../tools/license-server/README.md)**. Röviden:

- Keretrendszer nélküli PHP 8.0+ alkalmazás (PDO + sodium), amelyet a forgalmazó a saját HTTPS-domainjén futtat – **nem a pluginba telepítendő**. Csak a `public/` mappa legyen webről elérhető.
- Végpontok: `POST /v1/license/activate`, `/check`, `/deactivate`, `POST /v1/update/check` (az aláírt válaszban a nonce és a csomag `sha256`-ja), `GET /v1/update/package/{verzió}.zip` (kulcs csak fejlécben). Olyan kiadást, amelynek fájlja hiányzik, nem kínál fel.
- Beállítás: a mintában szereplő `CHANGE-ME…` „pepper” értékkel a szerver nem indul el – saját, legalább 32 karakteres véletlen értéket kell megadni.
- Kulcspár: `php bin/manage.php keygen`; a titkos kulcs a `storage/` alá kerül – erről rendszeres mentés kell, mert elvesztése után minden telepítésben cserélni kell a nyilvános kulcsot.
- A licenckulcsokat és IP-címeket HMAC-SHA256 hash-ként tárolja (szerveroldali „pepper”); a kulcs csak létrehozáskor látható. IP-alapú percenkénti korlát.
- Napi műveletek CLI-ből: `create`, `list`, `activations`, `extend`, `plan`, `free-site`, `revoke`, `release`.
- Fizetési integráció mintája: a szolgáltató aláírt webhookja → `create()` / `extend()` / `set_status()`. Webhook-végpontot a referencia-szerver nem tartalmaz.
- Adatbázis: SQLite-ra készült; MySQL-hez a README szerinti átírás kell (nem tesztelt).

**Ellenőrzöttség** (a fejlesztői jegyzet szerinti mérés a 3. javítási kör után; a dokumentáció készítésekor nem futtattuk újra): licencszerver-önteszt 32/32 (köztük a párhuzamos aktiválás); a plugin integrációs tesztsora (147/147) végponttól végpontig lefuttatja az aktiválást, a manipulált választ, a weboldal-limitet, az elérhetetlen szervert türelmi idővel, a frissítés felkínálását, a fejléces csomagletöltést és a deaktiválást; a `tests/regression-y1.php` (116/116) a frissítés nonce-/frissesség-ellenőrzését és a csomag SHA-256-ellenőrzését is. **Nem ellenőrzött:** éles licencszerver-telepítés, valódi fizetési szolgáltató, MySQL.
