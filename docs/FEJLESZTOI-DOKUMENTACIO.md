# AutoGroweHome – Fejlesztői dokumentáció

Ez a dokumentum az AutoGroweHome 1.0.0 bővítéséhez és üzemeltetéséhez szükséges fejlesztői tudnivalókat gyűjti össze:

- kódszerkezet, konvenciók és autoloader;
- konstansok és bővítési pontok példakóddal;
- az `agh-building-v1` épületmodell-séma;
- a teljes REST API és a WP-CLI parancsok;
- a tesztek futtatása, a fordítási munkafolyamat és a kiadás menete.

Minden név és szignatúra a forráskódból van ellenőrizve (a 2026-10-11-i, harmadik javítási kör utáni állapot); a fájlhivatkozások a plugin gyökeréhez képest értendők.

A rendszer felépítését az [ARCHITEKTURA.md](ARCHITEKTURA.md), az adatbázist az [ADATBAZIS.md](ADATBAZIS.md), a külső szolgáltatókat az [API-INTEGRACIOK.md](API-INTEGRACIOK.md) írja le.

## Tartalom

1. [Kódszerkezet és konvenciók](#1-kódszerkezet-és-konvenciók)
2. [Autoloader és betöltés](#2-autoloader-és-betöltés)
3. [Konstansok (wp-config.php)](#3-konstansok-wp-configphp)
4. [Bővítési pontok](#4-bővítési-pontok)
5. [Épületmodell: agh-building-v1](#5-épületmodell-agh-building-v1)
6. [REST API referencia](#6-rest-api-referencia)
7. [WP-CLI parancsok](#7-wp-cli-parancsok)
8. [Tesztek futtatása](#8-tesztek-futtatása)
9. [Fordítási munkafolyamat](#9-fordítási-munkafolyamat)
10. [Build és kiadás](#10-build-és-kiadás)

---

## 1. Kódszerkezet és konvenciók

```text
autogrowehome/
├── autogrowehome.php        Plugin-fejléc, konstansok, követelmény-ellenőrzés, autoloader, aktiválási hookok
├── uninstall.php            Eltávolítás (adattörlés csak kifejezett beállításra)
├── includes/<Modul>/<Osztály>.php   PSR-4, névtér: AutoGroweHome\<Modul>
├── assets/js|css/           Kézzel írt, nem minifikált front- és adminfájlok
├── templates/               PHP-sablonok (GYIK, árazás, portál, e-mail keret)
├── languages/               .pot + 15 nyelv .po/.mo
├── tests/                   integration-test.php, regression-x.php, regression-y1.php, regression-y2.php
└── tools/license-server/    Külön telepítendő referencia-licencszerver
```

A modulok feladatát az [ARCHITEKTURA.md 3. fejezete](ARCHITEKTURA.md#3-modultérkép) foglalja össze.

| Téma | Szabály | Példa / forrás |
|---|---|---|
| Közvetlen hívás tiltása | Minden PHP-fájl elején `defined( 'ABSPATH' ) \|\| exit;` | minden `includes/` fájl |
| Osztályok | `final`, többnyire statikus metódusokkal; példányt csak a szolgáltatók, a `FloorPlanSvg` és a fizetési átjárók használnak | `includes/Generation/Pipeline.php` |
| Kódstílus | WordPress Coding Standards; a tudatos eltéréseknél `phpcs:ignore` | teljes kódbázis |
| Adatbázis | `$wpdb` + `prepare()`; táblanév mindig `Installer::table( 'kulcs' )` | `includes/Installer.php` |
| Atomikus műveletek | Feltételes `UPDATE … WHERE …` (keret, feladatfoglalás); opciósoron alapuló lízing (`INSERT IGNORE` + feltételes `UPDATE`) a poll-tickhez, a párhuzamossági helyekhez és a gyári promptfrissítéshez | `RateLimiter`, `JobQueue`, `PromptEngine` |
| JSON oszlopok | `Util::json()` / `Util::decode()` | `includes/Support/Util.php` |
| Időbélyegek | Adatbázisban UTC, `Y-m-d H:i:s`; a statisztika és a költségnapló napja a webhely időzónájában; a napi keret napja a `limits.timezone` és `limits.day_start_hour` szerint | `Util`, `Stats`, `RateLimiter` |
| Azonosítók | Belül `bigint` `id`; kifelé UUIDv4, ellenőrzés: `Util::is_uuid()` | `includes/Projects/Repository.php` |
| Beállítások | `Settings::get( 'limits.ip_daily', 3 )`, `Settings::update_group()`; a szolgáltatói URL-eket olvasáskor és mentéskor ellenőrzi (`Settings::secure()`) | `includes/Support/Settings.php` |
| Funkciókapcsolás | `Features::enabled( 'kulcs' )`, `Features::limit( 'kulcs', $alap )` | `includes/License/Features.php` |
| Naplózás | `Logger::info\|warning\|error( $csatorna, $üzenet, $kontextus, $projekt_id )`, kitakarással az üzenetben és a kontextusban | `includes/Support/Logger.php` |
| REST-hibák | `{ "code": "...", "message": "..." }` + opcionális mezők | `RestController::error()` |
| Szövegek | Magyar forrásszöveg, text domain `autogrowehome` | teljes kódbázis |

---

## 2. Autoloader és betöltés

`includes/Autoloader.php`:

- `spl_autoload_register` csak az `AutoGroweHome\` előtagú osztályokra reagál.
- `AutoGroweHome\Generation\JobQueue` → `includes/Generation/JobQueue.php`; a relatív útvonal a `^[A-Za-z0-9_/]+$` mintára illeszkedjen.
- Egy fájl = egy osztály vagy interfész. A `PaymentGatewayInterface` és az `ExternalCheckoutGateway` is saját fájlban van (`includes/License/`), így közvetlenül autoloadolható.

Indulás: `autogrowehome.php` ellenőrzi a PHP 8.0 és az `mbstring` meglétét (hiányban csak adminüzenet), majd `plugins_loaded` (prioritás 5) → `Plugin::boot()`. Részletek: [ARCHITEKTURA.md 2.](ARCHITEKTURA.md#2-betöltés-és-indulás). Kiegészítő plugint a plugin osztályaival `plugins_loaded` 6-os vagy későbbi prioritáson érdemes regisztrálni.

---

## 3. Konstansok (wp-config.php)

A kódban ténylegesen olvasott, üzemeltető által megadható konstansok (grep-pel ellenőrizve):

| Konstans | Hatás | Olvassa |
|---|---|---|
| `AGH_OWNER_MODE` | `true` esetén tulajdonosi mód: minden funkció engedélyezett, a csomaglimitek nem érvényesek, és a csomagmátrix (`agh_plans`) szerkeszthető és érvényes. Az `agh_owner_mode` szűrő kikapcsolhatja (4.8). Az integrációs teszt ezt elvárja. | `includes/License/Features.php` |
| `AGH_LICENSE_SERVER` | A licencszerver HTTPS-címe; felülírja az `agh_license_server` opciót | `includes/License/LicenseManager.php` |
| `AGH_LICENSE_PUBKEY` | A licencszerver Ed25519 nyilvános kulcsa (base64) | `includes/License/LicenseManager.php` |
| `AGH_PRIVATE_DIR` | Védett tárhely saját útvonala (ajánlott webgyökéren kívül) | `includes/Support/Storage.php` |
| `AGH_SECRET_SALT` | A tárolt API- és licenckulcsok titkosítási kulcsának forrása (ajánlott); ha meg van adva és nem üres, a kulcs csak ebből származik | `includes/Support/Secrets.php` |
| `AGH_ANTHROPIC_API_KEY` | Anthropic API-kulcs; ha nem üres, elsőbbséget élvez az adminban megadottal szemben | `includes/Support/Secrets.php` |
| `AGH_MAGNIFIC_API_KEY` | Magnific API-kulcs; mint fent | `includes/Support/Secrets.php` |
| `AGH_LICENSE_KEY` | Licenckulcs; mint fent | `includes/Support/Secrets.php` |

> **Titkosítási kulcs** (`Secrets::key()`):
>
> - Ha az `AGH_SECRET_SALT` meg van adva és nem üres: `sha256( 'agh-secrets|salt|' . AGH_SECRET_SALT )`. A WordPress-sók cseréje ekkor nem érinti a tárolt kulcsokat; az `AGH_SECRET_SALT` cseréje viszont igen.
> - Egyébként a WordPress `auth` és `secure_auth` sójából származik. Ekkor a sók cseréje után a tárolt kulcsok nem fejthetők vissza (`Secrets::get()` üreset ad), és újra meg kell adni őket.
> - Visszafejtéskor a kód a jelenlegi kulcsot, a korábbi (`AGH_SECRET_SALT` + WordPress-sók) levezetést, végül a csak WordPress-sós levezetést próbálja. A régi kulccsal vagy formátumban (`o1:`) tárolt érték olvasáskor újratitkosul; az 5-ös sémaverzióra lépéskor az `Installer::upgrade_data()` egyszer mindet újratitkosítja (`Secrets::upgrade_storage()`, idempotens).
> - A konstansként megadott kulcsokat egyik eset sem érinti.

A plugin belső konstansai (`AGH_VERSION`, `AGH_DB_VERSION`, `AGH_FILE`, `AGH_DIR`, `AGH_URL`, `AGH_BASENAME`, `AGH_REST_NS`) nem konfigurációs célúak.

---

## 4. Bővítési pontok

A kódban pontosan ezek a hookok léteznek (`apply_filters` / `do_action` grep alapján):

| Hook | Típus | Paraméterek | Hol fut |
|---|---|---|---|
| `agh_image_providers` | szűrő | `array $providers` (id ⇒ `ImageProviderInterface`) | `Providers::images()` |
| `agh_cad_exporters` | szűrő | `array $exporters` | `CadExport::exporters()`, amelyet a `CadExport::documents()` futtat |
| `agh_payment_gateways` | szűrő | `array $gateways` (id ⇒ `PaymentGatewayInterface`) | `Payments::gateways()` |
| `agh_payment_gateway_id` | szűrő | `string $id` (alap: az `agh_payment_gateway` opció) | `Payments::active()` |
| `agh_prompt_variables` | szűrő | `array $vars, array $c, array $concept, string $view, ?array $room` | `PromptEngine::variables()` |
| `agh_magnific_status_path` | szűrő | `string $path, string $endpoint, string $task_id` | `MagnificProvider::status()` |
| `agh_owner_mode` | szűrő | `bool $on` (alap `true`) | `Features::owner_mode()` |
| `plugin_locale` (domain: `autogrowehome`) | WP-szűrő | `string $locale, string $domain` | `I18n`, `Frontend`, `QuoteService` |
| `agh_concepts_finished` | akció | `int $project_id, string $status` | `Pipeline::after_asset()` |
| `agh_quote_submitted` | akció | `array $quote, array $project` | `QuoteService::submit()` |

A plugin a WordPress `upgrader_pre_download` szűrőjét is használja (`LicenseManager::pre_download`, 10. fejezet); ez nem saját bővítési pont.

### 4.1 Saját képszolgáltató – `agh_image_providers`

**Szerződés** (`includes/Ai/ImageProviderInterface.php`):

```php
namespace AutoGroweHome\Ai;

interface ImageProviderInterface {
	public function id(): string;
	public function label(): string;
	public function configured(): bool;
	/** @return array{reference:bool,structure:bool,native_4k:bool,upscale:bool,is_test:bool} */
	public function capabilities(): array;
	public function submit( array $request ): array;
	public function status( string $task ): array;
	/** @return array{ok:bool,message:string} */
	public function test(): array;
}
```

**A `submit()` által kapott kérés** (`Pipeline::render()`):

| Kulcs | Típus | Tartalom |
|---|---|---|
| `op` | string | `hero`, `view` vagy `interior` (felskálázást (`upscale`) csak a beépített Magnific kap) |
| `view` | string | pl. `hero`, `front`, `aerial`, `interior_r2` |
| `prompt` | string | Kész prompt (pozitív + negatív rész), legfeljebb `PromptEngine::MAX_PROMPT` = 3900 karakter (`PromptEngine::combined()`) |
| `aspect` | string | Mindig `16:9` |
| `resolution` | string | `1k`, `2k` vagy `4k` |
| `reference_image` | string | base64 fő kép; csak `view` műveletnél és `capabilities()['reference']` esetén |
| `structure_image` | string | base64 PNG tömegvázlat; csak `front`/`back`/`left`/`right` nézetnél, `capabilities()['structure']` és `magnific.structure_guidance` mellett |
| `building` | array | Az `agh-building-v1` modell (5. fejezet) |
| `config` | array | A tisztított konfiguráció |
| `label` | string | pl. `A – Fő látványterv` |
| `webhook_url` | string | Csak a `magnific` azonosítójú szolgáltató kapja (`…/webhook/magnific/<token>`) |

**Elvárt válasz** (`submit()` és `status()`):

| Kulcs | Típus | Jelentés |
|---|---|---|
| `ok` | bool | A hívás sikeres-e |
| `status` | string | `pending`, `completed` vagy `failed` |
| `task` | string | Átlátszatlan azonosító a `status()` számára; nem üres `task` és `pending` esetén a `Pipeline` `magnific.poll_interval` másodpercenként kérdez |
| `urls` | string[] | Eredmény-URL-ek; csak az első `https://` URL-t tölti le (PNG/JPEG/WebP, ≤60 MB, legfeljebb 3 HTTPS-átirányítás) |
| `bytes` | string | Szinkron szolgáltatónál a nyers kép; a `Pipeline` ilyenkor `image/png`-nek veszi |
| `error` | string | Hibaüzenet |
| `transient` | bool | Átmeneti-e: átmenetinél újrapróbálás, nem átmenetinél tartalékváltás (ha van) |
| `native_resolution` | string | Tájékoztató |
| `model` | string | Az eszköz `model` oszlopába kerül |
| `cost_key` | string | A `costs.<cost_key>` beállítás értéke kerül a költségnaplóba (beépített kulcsok: `mystic_2k`, `mystic_4k`, `reference_image`, `upscale`; ismeretlen kulcs = 0) |

**Viselkedés, amit a kód rögzít:**

- A `magnific` és a `test` azonosító nem írható felül.
- A lista kérésenként egyszer épül fel, ezért a szűrőt az első `Providers::images()` hívás előtt kell regisztrálni.
- A regisztrált szolgáltató megjelenik az admin „Aktív szolgáltató” és „Tartalék szolgáltató” listájában.
- `is_test` esetén az eszközök `is_test = 1` jelölést kapnak.
- A lekérdezési időtúllépés minden szolgáltatónál a `magnific.timeout` beállítás.
- Felskálázást a `Pipeline` mindig a `magnific` szolgáltatóval végez.

**Példa** (önálló kiegészítő plugin; az `api.example.com` fiktív szolgáltató):

```php
<?php
/**
 * Plugin Name: AGH – példa képszolgáltató
 */

add_action( 'plugins_loaded', static function () {
	if ( ! interface_exists( '\AutoGroweHome\Ai\ImageProviderInterface' ) ) {
		return; // Az AutoGroweHome nincs aktiválva.
	}
	require __DIR__ . '/class-pelda-provider.php';
	add_filter( 'agh_image_providers', static function ( array $providers ) {
		$providers['pelda'] = new Pelda_Provider();
		return $providers;
	} );
}, 20 );
```

```php
<?php
// class-pelda-provider.php
final class Pelda_Provider implements \AutoGroweHome\Ai\ImageProviderInterface {

	public function id(): string { return 'pelda'; }
	public function label(): string { return 'Példa szolgáltató'; }
	public function configured(): bool { return defined( 'PELDA_API_KEY' ) && '' !== PELDA_API_KEY; }

	public function capabilities(): array {
		return array( 'reference' => false, 'structure' => false, 'native_4k' => false, 'upscale' => false, 'is_test' => false );
	}

	public function submit( array $request ): array {
		$res = wp_remote_post( 'https://api.example.com/v1/images', array(
			'timeout'     => 60,
			'redirection' => 0,
			'headers'     => array( 'Authorization' => 'Bearer ' . PELDA_API_KEY, 'Content-Type' => 'application/json' ),
			'body'        => wp_json_encode( array( 'prompt' => $request['prompt'], 'aspect' => $request['aspect'] ) ),
		) );
		if ( is_wp_error( $res ) ) {
			return $this->result( 'failed', '', array(), $res->get_error_message(), true );
		}
		$json = json_decode( (string) wp_remote_retrieve_body( $res ), true );
		$id   = (string) ( $json['id'] ?? '' );
		return '' !== $id ? $this->result( 'pending', $id ) : $this->result( 'failed', '', array(), 'Unexpected response', true );
	}

	public function status( string $task ): array {
		$res  = wp_remote_get( 'https://api.example.com/v1/images/' . rawurlencode( $task ), array(
			'timeout'     => 30,
			'redirection' => 0,
			'headers'     => array( 'Authorization' => 'Bearer ' . PELDA_API_KEY ),
		) );
		$json = is_wp_error( $res ) ? array() : (array) json_decode( (string) wp_remote_retrieve_body( $res ), true );
		if ( 'done' === ( $json['state'] ?? '' ) ) {
			return $this->result( 'completed', $task, array( (string) $json['url'] ) );
		}
		if ( 'error' === ( $json['state'] ?? '' ) ) {
			return $this->result( 'failed', $task, array(), (string) ( $json['message'] ?? 'error' ), false );
		}
		return $this->result( 'pending', $task );
	}

	public function test(): array {
		return array( 'ok' => $this->configured(), 'message' => $this->configured() ? 'OK' : 'Nincs kulcs' );
	}

	private function result( string $status, string $task, array $urls = array(), string $error = '', bool $transient = false ): array {
		return array(
			'ok' => 'failed' !== $status, 'status' => $status, 'task' => $task, 'urls' => $urls, 'bytes' => '',
			'error' => $error, 'transient' => $transient, 'native_resolution' => '', 'model' => 'pelda-v1', 'cost_key' => '',
		);
	}
}
```

### 4.2 CAD-exporter – `agh_cad_exporters`

`CadExport::exporters()` (`includes/Generation/CadExport.php`) ezt a szerkezetet adja vissza a szűrőn keresztül:

| Kulcs | Típus | Jelentés |
|---|---|---|
| `label` | string | A tárolt dokumentum felirata |
| `callback` | callable | `function( array $building_model ): string` |
| `mime` | string | Opcionális, alap `application/octet-stream`; érvénytelen MIME helyett is ez |
| `ext` | string | Opcionális fájlkiterjesztés, alap: az azonosító |
| `feature` | string | Opcionális licencfunkció; alap `export_advanced`, `''` = mindig elérhető |

Beépítve: `json` (`feature` = `''`) és `dxf` (`feature` = `export_advanced`).

**`CadExport::documents( array $m )`** – a `Pipeline::documents()` ezt hívja koncepciónként (a plan feladatban és konfigurációmódosító újragenerálásnál):

- minden regisztrált exportert lefuttat;
- kihagyja azt, amelyiknek a funkciója nincs engedélyezve, amelyik nem hívható, üres sztringet ad vagy kivételt dob (utóbbit naplózza, `cad` csatorna);
- a `json` exporter a `building_json` nézetnéven, a többi a (tisztított) azonosítóján tárolódik: `docs-<V>-<id>.<ext>`, `doc` eszközként, `contractor` hozzáféréssel;
- a dokumentumok bekerülnek a kivitelezői ZIP `05_Dokumentumok/` mappájába.

```php
add_filter( 'agh_cad_exporters', static function ( array $exporters ) {
	$exporters['rooms_txt'] = array(
		'label'    => 'Helyiséglista (TXT)',
		'mime'     => 'text/plain',
		'ext'      => 'txt',
		'feature'  => '', // minden csomagban
		'callback' => static function ( array $m ): string {
			$out = '';
			foreach ( $m['rooms'] as $r ) {
				$out .= sprintf( "%d\t%s\t%.2f m2\n", $r['level'], $r['name'], $r['area'] );
			}
			return $out;
		},
	);
	return $exporters;
} );
```

Kiszolgáláskor a fájlvégpont csak a DXF-et zárja `export_advanced` mögé (`RestController::feature_allows()`); az egyéb exporterek kimenetét a generáláskori `feature` ellenőrzés szabályozza.

### 4.3 Fizetési átjáró – `agh_payment_gateways`, `agh_payment_gateway_id`

**Szerződés** (`includes/License/PaymentGatewayInterface.php`):

```php
namespace AutoGroweHome\License;

interface PaymentGatewayInterface {
	public function id(): string;
	public function label(): string;
	public function configured(): bool;
	/** Checkout URL for a plan/period or '' when not available. */
	public function checkout_url( string $plan, string $period ): string;
}
```

- `$plan`: csomag-slug (`starter`, `professional`, `agency`); `$period`: `month` vagy `year` (`templates/pricing.php`).
- **Regisztráció:** `agh_payment_gateways`. A kulcs a tömb szöveges kulcsa (`sanitize_key`), ennek hiányában az átjáró `id()`-je. Ugyanazzal a kulccsal a beépített `external_checkout` is felülírható (`Payments::gateways()`).
- **Kiválasztás** (`Payments::active()`):
  1. az `agh_payment_gateway` opcióban megadott (és az `agh_payment_gateway_id` szűrővel módosítható) átjáró, ha regisztrált és konfigurált;
  2. különben az első konfigurált, szűrővel regisztrált átjáró;
  3. különben a beépített `external_checkout`, ha van URL-je.
  
  Az `agh_payment_gateway` opciónak nincs adminfelülete; programból (`update_option`) vagy a szűrővel állítható.
- A beépített átjáró URL-jei (`agh_checkout_urls`) az admin csomagmátrixában szerkeszthetők, ami csak tulajdonosi módban (`AGH_OWNER_MODE`) elérhető.
- A plugin kártyaadatot nem kezel. Felhasználás: `[autogrowehome_pricing]` (`Frontend::sc_pricing()`).

```php
add_action( 'plugins_loaded', static function () {
	if ( ! interface_exists( '\AutoGroweHome\License\PaymentGatewayInterface' ) ) {
		return;
	}
	require __DIR__ . '/class-sajat-checkout.php'; // final class Sajat_Checkout implements \AutoGroweHome\License\PaymentGatewayInterface
	add_filter( 'agh_payment_gateways', static function ( array $g ) {
		$g['sajat'] = new Sajat_Checkout();
		return $g;
	} );
}, 20 );
```

### 4.4 Promptváltozók – `agh_prompt_variables`

```php
apply_filters( 'agh_prompt_variables', $vars, $c, $concept, $view, $room );
```

| Paraméter | Tartalom |
|---|---|
| `$vars` | `string` értékek. Beépített nevek (`PromptEngine::variable_names()`): `style`, `style_direction`, `property_type`, `levels`, `footprint_shape`, `footprint_w`, `footprint_l`, `net_area`, `storey_height`, `roof`, `roof_product`, `roof_details`, `facade`, `openings`, `garden`, `region`, `climate`, `camera`, `lens`, `time_of_day`, `season`, `weather`, `concept_name`, `concept_description`, `concept_features`, `concept_materials`, `concept_massing`, `variant_letter`, `variant_direction`, `consistency_id`, `user_text`, `room_label`, `room_area`, `room_dims`, `room_ceiling`, `interior_style`, `room_details`, **`custom_params`**; továbbá a listában nem szereplő, üres `view_rule`. |
| `$c` | Tisztított konfiguráció |
| `$concept` | Koncepció (`variant`, `brief`, `building`, `consistency_id`, …) |
| `$view` | `hero`, `front`, `back`, `left`, `right`, `aerial`, `garden`, `evening` vagy `interior` |
| `$room` | Belső nézetnél a helyiség tömbje, egyébként `null` |

**`{custom_params}`** (`PromptEngine::custom_phrases()`): az adminban felvett egyedi paraméterek „Promptba kerülő szövege” (csak a `custom_params` funkcióval; nélküle a `Registry` az egyedi paramétereket sehol nem tölti be). Csak a látható, nem rejtett, értékkel bíró mezők kerülnek bele, kategóriánként szétválogatva:

| Kategória | Melyik képhez |
|---|---|
| `rooms`, `interior`, `kitchen`, `bathroom`, `surfaces` | csak belső képhez |
| `massing`, `roof`, `facade`, `openings`, `garden`, `energy` | csak külső képhez |
| minden más | mindkettőhöz |

Szabályok:

- A helyőrző alakja `{név}`, ahol a név csak kisbetűt és aláhúzást tartalmazhat (`/\{([a-z_]+)\}/`).
- Helyettesítés csak a **promptmodulok** szövegében történik. A 19 modul: `role`, `style`, `concept`, `massing`, `dimensions`, `roof`, `facade`, `openings`, `interiors`, `materials`, `garden`, `camera`, `lighting`, `output`, `negative`, `variants`, `user`, `consistency`, `extras`. A nézetek `rule` szövegében nincs helyettesítés.
- Az `extras` modul gyári szövege: `Additional client-specified details: {custom_params}.` Minden gyári nézet tartalmazza.
- Ha egy nézet moduljai közül egyik sem tartalmazza a `{custom_params}` helyőrzőt (pl. régi promptverzió), és van egyedi paraméter, a gyári `extras` szöveg automatikusan az `output` modul elé kerül (`PromptEngine::build()`).
- **Hosszkorlát:** `PromptEngine::MAX_PROMPT = 3900` karakter (saját, óvatos határ). Túl hosszú promptnál a negatív lista egészben a végén marad. A modulok a `TRIM_ORDER` sorrendjében rövidülnek, a kevésbé fontosak előbb: `garden`, `variants`, `style`, `lighting`, `camera`, `materials`, `concept`, `roof`, `facade`, `openings`, `interiors`, `massing`, `dimensions`, `consistency`, `extras`, és **utolsóként a látogató szövege** (`user`, mondathatáron). A többi szóhatáron rövidül; a `role`, a nézetszabály és az `output` nem rövidül (`PromptEngine::combined()`). A `{user_text}` szabad szöveges tartaléka (ha nincs Anthropic-összefoglaló) eleve legfeljebb 600 karakter, mondathatáron vágva.
- **Mondatkezdet:** az összeállított promptban minden mondat nagybetűvel kezdődik (`PromptEngine::tidy()`).
- A modulszövegeket az admin „Promptmotor” oldalán lehet szerkeszteni (`prompt_editor` funkció); a mentés új promptverziót hoz létre.
- **Gyári frissítés:** ha az aktív promptverzió pontosan egy korábbi gyári kiadás (`DefaultModules::factory_history()`), az első `PromptEngine::get()` hívás új gyári verziót ment és aktivál (`maybe_upgrade_defaults()`, `DefaultModules::REVISION = 2`, `agh_prompt_defaults_rev` opció). Szerkesztett vagy saját verzióhoz nem nyúl, meglévő verziót nem ír át.

```php
add_filter( 'agh_prompt_variables', static function ( array $vars, array $c, array $concept, string $view, ?array $room ) {
	$vars['site_context'] = 'evening' === $view ? 'quiet suburban street, warm street lights' : 'quiet suburban street';
	return $vars;
}, 10, 5 );
// A "garden" modul szövegébe ezután beírható: … {site_context} …
```

### 4.5 Magnific állapot-útvonal – `agh_magnific_status_path`

A `MagnificProvider::status()` a feladathivatkozást (`<végpont>|<task-uuid>`) bontja fel. Érvényes hivatkozás: a végpont megfelel a beállításokkal közös útvonalszabálynak (`Settings::is_endpoint_path()`, minta: `Settings::ENDPOINT_PATH_PATTERN` = `#^(?:/[A-Za-z0-9_\-]+)+$#`, pont nélkül), a task-azonosító 36 karakteres UUID. Az alapértelmezett lekérdezési útvonal `<végpont>/<task-uuid>`. A szűrő ezt módosíthatja; a visszaadott érték a `magnific.base_url` után fűződik, ezért `/`-rel kezdődjön (a szűrt értéket a kód nem ellenőrzi újra).

```php
add_filter( 'agh_magnific_status_path', static function ( string $path, string $endpoint, string $task_id ): string {
	if ( '/v1/ai/image-upscaler-precision' === $endpoint ) {
		return '/v1/ai/image-upscaler-precision/' . $task_id; // ide a dokumentált útvonal kerüljön
	}
	return $path;
}, 10, 3 );
```

### 4.6 Akció: `agh_concepts_finished`

```php
do_action( 'agh_concepts_finished', int $project_id, string $status ); // ready | partial | failed
```

- Projektenként egyszer fut, amikor mindhárom fő kép végleges; a galéria ekkor még készülhet.
- Koncepció nélküli, megszakított (`cancelled`) vagy törölt projektre nem fut le.
- A feladatsor workerében fut, nem feltétlenül a látogató kérésében.

```php
add_action( 'agh_concepts_finished', static function ( int $project_id, string $status ) {
	if ( 'failed' === $status ) {
		$p = \AutoGroweHome\Projects\Repository::project_by_id( $project_id );
		wp_mail( get_option( 'admin_email' ), 'AGH: sikertelen generálás', 'Projekt: ' . ( $p['uuid'] ?? $project_id ) );
	}
}, 10, 2 );
```

### 4.7 Akció: `agh_quote_submitted`

```php
do_action( 'agh_quote_submitted', array $quote, array $project );
```

- Az ajánlatkérés és a hozzájárulások rögzítése után, a csomag elkészülte **előtt** fut, szinkron módon a `POST /projects/{id}/quote` kérésben; hosszú műveletet ne végezz benne.
- `$quote`: az `agh_quotes` sor (karakterláncok; a `recipients` ekkor még üres). Mezők: [ADATBAZIS.md](ADATBAZIS.md#25-agh_quotes).
- `$project`: a beküldés előtt betöltött projekt (dekódolt `config`).

```php
add_action( 'agh_quote_submitted', static function ( array $quote, array $project ) {
	wp_remote_post( 'https://crm.example.com/hooks/agh', array(   // fiktív CRM-végpont
		'timeout'  => 5,
		'blocking' => false,
		'headers'  => array( 'Content-Type' => 'application/json' ),
		'body'     => wp_json_encode( array(
			'quote'   => $quote['uuid'],
			'project' => $project['uuid'],
			'name'    => $quote['full_name'],
			'email'   => $quote['email'],
			'city'    => $quote['city'],
		) ),
	) );
}, 10, 2 );
```

A személyes adatok harmadik félnek való továbbítása külön jogalapot és tájékoztatást igényel; a plugin hozzájárulási szövegei ezt nem fedik le.

### 4.8 Szűrő: `agh_owner_mode`

```php
// includes/License/Features.php – Features::owner_mode()
return defined( 'AGH_OWNER_MODE' ) && AGH_OWNER_MODE && (bool) apply_filters( 'agh_owner_mode', true );
```

A szűrő csak **kikapcsolni** tudja a tulajdonosi módot; bekapcsolni a konstans nélkül nem lehet. Rendeltetése a tesztelés: a regressziós tesztek így ellenőrzik az ügyféloldali viselkedést.

A csomagmátrix (`Features::plans()`):

- **Ügyféloldalon** (tulajdonosi mód nélkül) teljesen csak olvasható: a beépített mátrix érvényes (címke és ár is), a tárolt `agh_plans` figyelmen kívül marad, a `Features::save_plans()` nem ír, és az admin szerkesztőűrlapot sem kínál.
- **Tulajdonosi módban** a tárolt mátrix érvényes, a hiányzó kulcsok a beépítettből töltődnek, a funkciólisták a funkciókatalógusra (`Features::catalog()`) szűrődnek.
- A `basic_params` és a `basic_gallery` leíró jellegű funkció: mindig elérhető, a kód nem zár le vele semmit.

```php
add_filter( 'agh_owner_mode', '__return_false' ); // ideiglenesen ügyféloldali csomagszabályok
```

### 4.9 `plugin_locale` (domain: `autogrowehome`)

A plugin maga is erre köti az admin által rögzített frontendnyelvet (`I18n::frontend_locale()`, prioritás 10; wp-adminban nem hat). Későbbi prioritású saját szűrő felülírhatja. A látogatói váltás (`?agh_lang=`, csak `multilang` funkcióval) az `I18n::$current` értéken keresztül elsőbbséget élvez.

---

## 5. Épületmodell: agh-building-v1

A `BuildingModel::build( array $c, string $variant = 'A', array $adjust = array() ): array` (`includes/Generation/BuildingModel.php`) determinisztikusan állítja elő a modellt. Az `$adjust` (helyiség-azonosító ⇒ m²) az Anthropic-tervező javaslata; csak az eredeti terület 80–120 %-a közötti értéket fogad el.

**Tárolás és kimenetek:** `agh_concepts.building` (JSON); `docs-<V>-building_json.json`; a ZIP `05_Dokumentumok/` mappája; ebből készül az SVG, a CSV, a DXF és minden regisztrált CAD-exporter kimenete.

**Koordináta-rendszer:** méter; origó a ház befoglaló téglalapjának bal felső sarka; x jobbra, y lefelé nő; az utca- és bejárati oldal felül (y = 0), a kertoldal alul.

**Elrendezési konstansok:** `T_EXT = 0.38`, `T_INT = 0.12`, `CORR = 1.25`, `MIN_COL = 1.6`. A `MIN_DIM = 1.34` a legkisebb tengelytávolság, amelyet az elrendezés kioszt (oszlopszélesség vagy egymásra rakott helyiség mélysége); a belső falvastagság levonása után így legalább 1,22 m marad, az 1,2 m-es „túl keskeny” határ felett. Többszintes háznál a lépcső minden szinten azonos helyre kerül.

**Valós példa** (alapértelmezett paraméterekkel, A változat, `wp eval` paranccsal előállítva: `BuildingModel::build( Validator::sanitize( Registry::defaults() ), 'A' )`). A `rooms`, `openings` és `walls` rövidítve szerepel; a teljes kimenetben 12 helyiség, 22 nyílászáró és 12 falkontúr van.

```json
{
  "schema": "agh-building-v1",
  "units": "m",
  "variant": "A",
  "shape": "rectangle",
  "shape_label": "simple rectangular",
  "mirror": false,
  "t_ext": 0.38,
  "t_int": 0.12,
  "parts": [
    { "id": "main", "x": 0, "y": 0, "w": 14.468, "h": 10.214, "axis": "h", "role": "all" }
  ],
  "levels": [
    { "index": 0, "name": "Földszint", "elevation": 0, "height": 3.15, "attic": false }
  ],
  "rooms": {
    "r1": { "id": "r1", "type": "hall", "name": "Előtér", "level": 0, "x": 11.093, "y": 0.44, "w": 1.595, "h": 3.948,
            "area": 6.3, "target": 7.73, "zone": "circulation", "band": "front", "part": "main", "stack": -1 },
    "r2": { "id": "r2", "type": "living_kitchen", "name": "Nappali + konyha + étkező", "level": 0, "x": 4.157, "y": 5.608,
            "w": 9.871, "h": 4.166, "area": 41.12, "target": 43, "zone": "day", "band": "garden", "part": "main", "stack": -1 },
    "r12": { "id": "r12", "type": "corridor", "name": "Közlekedő", "level": 0, "x": 0.44, "y": 4.508, "w": 13.588, "h": 0.98,
             "area": 13.32, "target": 5, "zone": "circulation", "band": "corridor", "part": "main", "stack": -1, "computed": false }
  },
  "openings": [
    { "x": 6.595, "y": 9.834, "orient": "h", "edge": "v_end", "type": "sliding", "width": 3.6, "level": 0, "room": "r2", "side": "ext" },
    { "x": 1.246, "y": 4.448, "orient": "h", "edge": "v_end", "type": "door", "width": 0.9, "level": 0, "room": "r8", "side": "int" }
  ],
  "walls": [
    { "level": 0, "x": 0.38, "y": 0.38, "w": 2.8850000000000002, "h": 4.068 }
  ],
  "width": 14.47,
  "length": 10.21,
  "terrace": { "x": 4.093, "y": 10.214, "w": 10, "h": 2, "area": 20, "covered": true },
  "garage": { "x": -3.4, "y": 0, "w": 3.4, "h": 5.6, "kind": "carport", "attached": true, "type": "carport" },
  "roof": { "type": "gable", "pitch": 35, "ridge_dir": "x", "eaves_height": 3.6, "ridge_height": 7.18, "overhang": 0.4,
            "eaves": 0.6, "plinth": 0.45, "chimney": false, "solar": false, "roof_windows": 0 },
  "checks": { "net_requested": 120, "net_planned": 119.9, "diff_pct": -0.1, "footprint": 147.8, "gross": 147.8, "warnings": [] },
  "meta": {
    "generator": "AutoGroweHome 1.0.0",
    "disclaimer": "Conceptual sketch generated from structured parameters. Not a permit or construction document; must be verified by a licensed designer."
  }
}
```

### 5.1 Gyökérmezők

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `schema` | string | – | Mindig `agh-building-v1` |
| `units` | string | – | Mindig `m` |
| `variant` | string | – | `A`, `B` vagy `C` |
| `shape` | string | – | `rectangle`, `l_shape`, `u_shape`, `staggered`. A kifejezetten választott forma kötelező; különben földszintes, `rectangle` alapnál a C változat 105 m²-től `l_shape`, a B 160 m²-től `staggered`. Többszintes háznál az `u_shape` `l_shape`-re vált. 15 m² alatti hálózónánál egy tömeg készül. |
| `shape_label` | string | – | Angol leírás a prompthoz |
| `mirror` | bool | – | A B változatnál `true` |
| `t_ext`, `t_int` | number | m | Külső és belső falvastagság |
| `parts` | array | – | Épülettömegek, 5.2 |
| `levels` | array | – | Szintek, 5.3 |
| `rooms` | **object** | – | Helyiségek azonosító szerint kulcsolt objektumként, 5.4 |
| `openings` | array | – | Nyílászárók, 5.5 |
| `walls` | array | – | Falkontúrok, 5.6 |
| `width`, `length` | number | m | A tömegek befoglaló mérete (2 tizedes) |
| `terrace` | object \| null | – | 5.7; `null`, ha `terrace_area` ≤ 0 |
| `garage` | object \| null | – | 5.7; `null`, ha `garage` = `none` vagy üres |
| `roof` | object | – | 5.8 |
| `checks` | object | – | 5.9 |
| `meta` | object | – | `generator`, `disclaimer` |

### 5.2 `parts[]` – tömegek

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `id` | string | – | `main`, `wing`, `wing2` |
| `x`, `y` | number | m | Bal felső sarok (külső méret), 3 tizedes |
| `w`, `h` | number | m | Külső szélesség és mélység |
| `axis` | string | – | `h` vagy `v`: a sávok iránya |
| `role` | string | – | `all`, `day` (főtömeg), `night` (szárny) |

A `building_width` és `building_length` paraméter (mindkettő > 4 m) egytömegű háznál felülírja a főtömeg méretét.

### 5.3 `levels[]` – szintek

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `index` | int | – | 0 = földszint |
| `name` | string | – | „Földszint”, „Tetőtér” vagy „N. emelet” (lokalizált) |
| `elevation` | number | m | `index × (ceiling_height + 0,35)` |
| `height` | number | m | `ceiling_height + 0,35` |
| `attic` | bool | – | Tetőtér-beépítésű szint |

### 5.4 `rooms{}` – helyiségek

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `id` | string | – | pl. `r1`; automatikus elemek: `auto_stairs_<szint>`, `corr_<tömeg>_<szint>`, `flex_<sáv>_<szint>` („Galéria / bővíthető tér”) |
| `type` | string | – | Helyiségtípus, lásd alább |
| `name` | string | – | Megjelenített név |
| `level` | int | – | Szintindex |
| `x`, `y`, `w`, `h` | number | m | Belső méretek (a belső fal felével beljebb), 3 tizedes |
| `area` | number | m² | `w × h`, 2 tizedes |
| `target` | number | m² | Kért terület (az MI-igazítás után; az előtérnél legalább `1,9 m × sávmélység`; számított elemnél a számított érték) |
| `zone` | string | – | `day`, `night`, `wet`, `service`, `circulation` |
| `band` | string | – | `front`, `garden`, `corridor` |
| `part` | string | – | A befogadó tömeg `id`-je |
| `stack` | int | – | −1: önálló oszlop; 0..n−1: pozíció egy egymásra rakott oszlopban |
| `computed` | bool | – | Csak közlekedőnél: a modell számolta |

**`type` értékek** (25): `living`, `dining`, `kitchen`, `living_kitchen`, `master`, `bedroom`, `guest`, `kids`, `office`, `wardrobe`, `bathroom`, `wc`, `laundry`, `pantry`, `utility`, `technical`, `hall`, `corridor`, `stairs`, `wellness`, `sauna`, `gym`, `playroom`, `wine`, `custom`.

### 5.5 `openings[]` – nyílászárók

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `type` | string | – | `entrance`, `door`, `window`, `sliding` |
| `x`, `y` | number | m | A nyílás középpontja a falvonalon |
| `width` | number | m | Nyílásszélesség |
| `orient` | string | – | `h` vagy `v` |
| `edge` | string | – | `v_start`, `v_end`, `u_start`, `u_end`; a tömegek közötti ajtónál hiányzik |
| `level` | int | – | Szintindex |
| `room` | string | – | Helyiség-azonosító; tömegek közötti ajtónál üres |
| `side` | string | – | `ext` vagy `int` |

### 5.6 `walls[]` – falkontúrok

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `level` | int | – | Szintindex |
| `x`, `y`, `w`, `h` | number | m | Helyiségenként egy téglalap a belső fal tengelyén. Nincs kerekítve, és a duplikációt a megjelenítő szűri. |

### 5.7 `terrace` és `garage`

| Objektum | Mező | Típus | Egység | Leírás |
|---|---|---|---|---|
| `terrace` | `x`, `y`, `w`, `h` | number | m | A főtömeg kertoldali éle alatt, a nappalihoz igazítva |
| | `area` | number | m² | 1 tizedes |
| | `covered` | bool | – | Mindig `true` |
| `garage` | `x`, `y`, `w`, `h` | number | m | A főtömeg bal oldalán (tükrözött változatnál jobb oldalán), ezért `x` negatív is lehet; `separate` típusnál 2,5 m hézaggal |
| | `kind` | string | – | `carport` vagy `garage` |
| | `attached` | bool | – | `false` csak `separate` típusnál |
| | `type` | string | – | `carport` (3,4 × 5,6 m), `garage_1` (3,8 × 6,2 m), `garage_2` és `separate` (6,4 × 6,2 m) |

### 5.8 `roof` – tető

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `type` | string | – | A `roof_type` paraméter |
| `pitch` | number | ° | Lapostetőnél 2, egyébként legalább 5; `ridge_height` paraméternél visszaszámolt |
| `ridge_dir` | string | – | `x` vagy `y` |
| `eaves_height` | number | m | `plinth + falmagasság` |
| `ridge_height` | number | m | `eaves_height + emelkedés` |
| `overhang`, `eaves` | number | m | `roof_overhang` (alap 0,4), `eaves_depth` (alap 0,6) |
| `plinth` | number | m | 0,45 |
| `chimney`, `solar` | bool | – | `chimney`, `roof_solar` paraméter |
| `roof_windows` | int | db | `roof_windows` paraméter |

### 5.9 `checks` – ellenőrzés

| Mező | Típus | Egység | Leírás |
|---|---|---|---|
| `net_requested` | number | m² | Kért nettó terület |
| `net_planned` | number | m² | A modell helyiségeinek összterülete |
| `diff_pct` | number | % | Eltérés |
| `footprint` | number | m² | A tömegek külső alapterülete |
| `gross` | number | m² | `footprint × szintszorzó` (tetőtérnél 1,65) |
| `warnings` | string[] | – | 10 %-nál nagyobb területeltérés; 1,2 m-nél keskenyebb helyiség. Alapparaméterekkel üres (mérve). |

---

## 6. REST API referencia

### 6.1 Általános szabályok

| Téma | Szabály |
|---|---|
| Alap-URL | `/wp-json/agh/v1/` (szép permalinkek nélkül `/?rest_route=/agh/v1/`) |
| Kérés törzse | JSON |
| `X-AGH-Nonce` | A ★-gal jelölt végpontokhoz kötelező. A `/bootstrap` `nonce` mezője adja: látogatóhoz kötött HMAC (vendégsüti vagy felhasználó + munkamenet), 12–24 óráig érvényes; bejelentkezett felhasználónál a WordPress `agh_front` nonce is elfogadott (`Access::check_front_nonce`). Hiányzó vagy érvénytelen nonce esetén a WordPress `rest_forbidden` hibát ad. |
| `X-WP-Nonce` | Bejelentkezett felhasználó azonosításához kötelező (WordPress REST cookie-azonosítás); nélküle a kérés vendégkérés. A `wpNonce` értéket a betöltő-konfiguráció és a bootstrap adja. |
| Vendégsüti | `agh_gs`: a `/bootstrap` hozza létre (vendégnél); csúszó lejárat. A kéréseket `credentials: 'same-origin'` módon kell küldeni. |
| Kivitelezői süti | `agh_cs`: a `POST /contractor/session` állítja be |
| Nyelv | `?agh_lang=<locale>` – csak a `multilang` funkcióval és engedélyezett nyelvre hat |
| Hibaformátum | `{ "code": "agh_…", "message": "…" }` + végpontfüggő mezők |
| Gyorsítótár | A `bootstrap`, `GET projects`, `GET projects/{id}`, `quote-token`, `presets`, `contractor/session` és `contractor/projects` válaszok `Cache-Control: no-store, private` fejlécet kapnak |
| `{id}` | 36 karakteres UUID |

### 6.2 Végpontlista

| Metódus | Útvonal | Jogosultság | Rövid leírás |
|---|---|---|---|
| GET | `/bootstrap` | nyilvános | A tervező induló adatai, nonce, vendégsüti |
| POST | `/validate` | ★ | Konfiguráció tisztítása és ellenőrzése |
| POST | `/rooms/auto` | ★ | Automatikus helyiségprogram |
| POST | `/interpret` | ★ | Szabad szöveg → paraméterjavaslatok (Anthropic) |
| POST | `/generate` | ★ | Generálás indítása (3 koncepció) |
| GET | `/projects` | nyilvános (saját projektek) | A látogató projektjei |
| GET | `/projects/{id}` | nyilvános + tulajdonos/munkatárs | Projekt állapota és tartalma |
| DELETE | `/projects/{id}` | ★ + tulajdonos/munkatárs | Projekt törlése (ajánlatkérés nélkül) |
| POST | `/projects/{id}/select` | ★ + tulajdonos/munkatárs | Koncepció kiválasztása |
| POST | `/projects/{id}/save` | ★ + tulajdonos/munkatárs | Projekt mentése |
| POST | `/projects/{id}/regenerate` | ★ + tulajdonos/munkatárs | Egy koncepció fő képének újragenerálása |
| POST | `/projects/{id}/cancel` | ★ + tulajdonos/munkatárs | Függő munka leállítása |
| GET | `/projects/{id}/quote-token` | ★ + tulajdonos/munkatárs | Aláírt űrlaptoken az ajánlatkéréshez |
| POST | `/projects/{id}/quote` | ★ + tulajdonos/munkatárs | Ajánlatkérés |
| GET | `/assets/{id}/file` | nyilvános + fájljogosultság | Kép, SVG vagy dokumentum |
| POST | `/events` | ★ | Statisztikai esemény |
| GET, POST | `/presets` | bejelentkezett (POST-nál ★ is) | Saját előbeállítások |
| POST | `/contractor/session` | nyilvános | Token cseréje munkamenetre |
| POST | `/contractor/logout` | nyilvános | Kijelentkezés |
| GET | `/contractor/projects` | kivitelezői hatókör | Ajánlatkérések és projektek |
| GET | `/contractor/package/{id}` | munkatárs vagy jogosult kivitelező | ZIP-csomag (`{id}` = ajánlatkérés-UUID) |
| POST | `/webhook/magnific/{token}` | titkos útvonal-token | Magnific webhook (csak sürgetés) |
| POST | `/admin/test-provider` | `agh_manage` | Szolgáltatói kapcsolatteszt |
| POST | `/admin/prompt/preview` | `agh_manage` | Prompt előnézet |
| POST | `/admin/prompt/test` | `agh_manage` | Tesztgenerálás promptverzióval |
| GET | `/admin/stats` | `agh_view_stats` | Statisztika |
| POST | `/admin/queue/run` | `agh_manage` | Feladatsor futtatása (20 s) |

A „tulajdonos/munkatárs” ellenőrzés (`RestController::load_owned`) a végponton belül történik. Ha a látogató sem tulajdonos, sem munkatárs (`agh_view_projects`), a válasz `404 agh_not_found`. A `deleted` állapotú projekt mindenkinek 404.

### 6.3 Nyilvános és tervezői végpontok

#### GET `/bootstrap`

Query: `lang` (opcionális; csak `multilang` funkcióval).

Válasz (`Frontend::bootstrap_data()` + `RestController::bootstrap()`):

- `version`, `nonce` (látogatóhoz kötött), `wpNonce` (`wp_rest`, csak bejelentkezve), `logged_in`, `locale`, `languages[] {code,label}`;
- `schema {categories[], fields[], room_types[], interior_styles[], color_collections, presets}`, `defaults`, `i18n`;
- `brand {name, author, logo, icon, background, title, header, footer, theme, animations, shadow}`. A `branding_advanced` funkció nélkül csak a név, a logó és a fő szín érvényesül; a többi alapértéken marad.
- `layout {order[], action_bar, mode, tour}`;
- `features {save, full_params, floorplans, download, quote, interpret}`, `provider {ready, test, gallery}`;
- `limits {limit, used, remaining, gallery_remaining}` (`gallery_remaining`: a mai újragenerálási keretből hátralévő; `null` = korlátlan);
- `consents {terms?, privacy, contact, marketing?}`, `tour[]`, `docs {privacy, terms}`.

Vendégnél a válasz létrehozza vagy megújítja az `agh_gs` sütit.

#### POST `/validate` ★

Törzs: `config`. Válasz: `{ config, check: { errors[], warnings[], info[], metrics { room_sum, net, gross, levels } } }`. Az elemek alakja `{ field, code, message }`. A tisztított `config` tartalmazza az `_explicit` és `_auto` listát (pl. automatikusan választott tetőfedési márka vagy termék).

#### POST `/rooms/auto` ★

Törzs: `config`. Válasz: `{ rooms: [ { id, type, name, area, level, render } ] }`.

#### POST `/interpret` ★

Törzs: `config` (`custom_text`). IP-nként napi 15 hívás. Az indoklások és az ellentmondások a kérés nyelvén készülnek (a 16 támogatott nyelv bármelyikén; `Planner::interpret( $c, $lang )`, üres `$lang` esetén a kérés aktuális nyelve).

| HTTP | Válasz |
|---|---|
| 200 | `{ ok: true, suggestions: [ { field, label, value, reason } ], conflicts: [], error: "", usage: { in, out } }` |
| 429 | `agh_limit` |
| 503 | `agh_interpret` |

#### POST `/generate` ★

Törzs: `config`; `force` (opcionális, kikapcsolja a duplikációszűrést); `admin_test` (opcionális; `agh_manage` jogú felhasználónál kihagyja a napi keretet).

| HTTP | Válasz |
|---|---|
| 202 | `{ project, reused: false, limits, test_mode }` |
| 200 | `{ project, reused: true, message }` |
| 403 | `agh_feature` |
| 422 | `agh_invalid` + `check` |
| 429 | `agh_limit` (+ `limits`), `agh_budget` |
| 503 | `agh_not_configured` |

Az ellenőrzések sorrendje: [ARCHITEKTURA.md 4.4](ARCHITEKTURA.md#44-generálási-kérés-post-generate).

#### GET `/projects`

A bejelentkezett felhasználó vagy a vendégsüti projektjei (legfeljebb 20, a `deleted` állapotúak nélkül); a vendégsütit megújítja. Válasz: `{ items: [ { id, name, status, saved, created, has_quote } ] }`.

#### GET `/projects/{id}`

Ha `general.queue_tick_on_poll` igaz és a projekt nincs lezárva, előbb `JobQueue::poll_tick(8.0)` fut (webhelyszinten egyszerre legfeljebb egy; a következő az előző befejezése után 5–6 s-mal indulhat).

```text
{
  id, name, status, stage, saved, created, config,
  progress: { stages: [ { id, label, state, errors? } ], percent, counts: {…}, pending_jobs: {…} },
  concepts: [ {
    id, variant, title, tagline, differentiation, warnings[], palette[], planner,
    status, gallery_status, selected,
    hero: <eszköz> | null,
    assets: [ <eszköz> ],
    metrics: { width, length, net_planned, footprint, ridge, shape, rooms }
  } ],
  quote: { uuid, status, created_at } | null,
  disclaimer
}
```

`<eszköz>` (`Repository::public_asset`):

- `id`, `kind`, `view`, `label`, `status`, `is_test`, `width`, `height`, `mime`, `resolution`, `upscaled`, `access`, `version`;
- kész fájlnál `preview` és jogosultság esetén `download` relatív URL;
- nem ügyfél közönségnél ezen felül `provider`, `model`, `gen_ms`, `bytes`, `error`, `created`.

A `resolution` alakja `<szélesség>×<magasság> · <címke>`. A címke a hosszabb oldal szerint `4K` (≥3840 px), `2.5K` (≥2560), `FHD` (≥1920), egyébként `HD`; felskálázott képnél `(felskálázott)` utótaggal, SVG-nél `SVG`.

Az ügyfél csak az ügyfélnek látható és a funkciózáron átengedett eszközöket kapja ([ARCHITEKTURA.md 9.3](ARCHITEKTURA.md#93-fájlhozzáférés-restcontrollerasset_permission)). A `progress` részletei: [ARCHITEKTURA.md 7.](ARCHITEKTURA.md#7-haladásszámítás)

#### DELETE `/projects/{id}` ★

`Repository::delete_project_safe()`: ajánlatkéréses projektnél 409 `agh_has_quote`; különben leállítja a feladatokat, és törli a fájlokat, eszközöket, koncepciókat, feladatokat, hozzáféréseket és a projektsort. Válasz: `{ ok: true }`; hiba: 404, 409.

#### POST `/projects/{id}/select` ★

Törzs: `concept` (UUID). Válasz: a teljes projekt. Hiba: 400 `agh_bad_concept`, 404.

#### POST `/projects/{id}/save` ★

Törzs: `name` (opcionális, ≤120). Válasz: `{ ok: true, id, name }`. Hiba: 403 `agh_feature`, 404.

#### POST `/projects/{id}/regenerate` ★

Törzs: `concept` (UUID); `config` (opcionális módosítások; ilyenkor az épületmodell és a dokumentumok is újraépülnek).

| HTTP | Válasz |
|---|---|
| 202 | A teljes projekt |
| 400 | `agh_bad_concept` |
| 403 | `agh_feature` (`designer` / `three_concepts`) |
| 404 | `agh_not_found` |
| 422 | `agh_invalid` + `check` (a lefoglalt keret visszajár) |
| 429 | `agh_budget` (becslés: `1 × costs.mystic_2k`), `agh_limit` + `limits` (újragenerálási keret: `limits.gallery_rebuilds_per_day`, IP-nként és felhasználónként) |
| 500 | `agh_error` (a render sorba állítása előtti hiba; a keret visszajár) |
| 503 | `agh_not_configured` |

A lefoglalt újragenerálási egység a render feladat payloadjában utazik (`regenerate: true`, `reserved`). Egyszer visszajár (`JobQueue::refund_job_once()`), ha az új fő kép költség nélkül véglegesen hibás lesz, vagy ha egy újabb újragenerálás vagy megszakítás felülírja, mielőtt bármi készült volna. A projekt eredeti generálási egysége ilyenkor nem jár vissza. A `limits` objektum `gallery_remaining` mezője mutatja a mai hátralévő újragenerálásokat.

#### POST `/projects/{id}/cancel` ★

A `queued`/`waiting` feladatok és a hozzájuk tartozó képek leállnak.

- Még nem tervezett projekt: `cancelled` állapot.
- Futó projekt: `partial` (ha van kész fő kép) vagy `cancelled`, `stage = done`.
- A projekt napi egysége bármely fázisban egyszer visszajár, ha a projekt költségmentes (`Pipeline::cost_free()`: nincs könyvelt költség és nem készült kép) és épp nem fut hozzá feladat.
- Egy megszakított újragenerálás saját egysége visszajár, ha a képe még semmibe nem került.

Válasz: `{ ok: true, cancelled_jobs: <szám> }`.

#### GET `/projects/{id}/quote-token` ★

Feltétel: `contractor_email` funkció. Válasz: `{ token: "<unix ts>.<hmac>" }` (projekthez kötött). Hiba: 403 `agh_feature`, 404.

#### POST `/projects/{id}/quote` ★

Feltétel: `contractor_email` funkció (különben 403 `agh_feature`).

| Törzs mező | Kötelező | Szabály |
|---|---|---|
| `form_token` | igen | A `quote-token` értéke. Elutasítva, ha hiányzik, hamis, más projekté, 3 mp-nél frissebb vagy 2 óránál régebbi (hiba: `errors.form_token`). |
| `concept` | – | Koncepció-UUID; hiányában a kiválasztott |
| `full_name` | igen | 3–120 karakter |
| `email` | igen | érvényes e-mail |
| `phone` | igen | legalább 7 számjegy |
| `city` | igen | nem üres, ≤120 |
| `site_location`, `start_period`, `budget`, `note` | – | ≤190 / ≤60 / ≤60 / ≤2000 |
| `consents` | igen | `{ terms?, privacy, contact, marketing? }` → bool; a kötelezők igazak |
| `website` | – | honeypot |

| HTTP | Válasz |
|---|---|
| 201 | `{ ok: true, quote: <uuid>, message }` |
| 422 | `agh_quote_invalid` + `errors` (mezőnként; `_form`: pl. a napi 5-ös IP-limit) |
| 403 / 404 | `agh_feature` / `agh_not_found` |

A régi `started` mezőt a kód figyelmen kívül hagyja.

#### GET `/assets/{id}/file`

Query: `size` (`preview` alapértelmezés, vagy `full`), `dl=1` (letöltés), `_wpnonce` (bejelentkezett felhasználónál; a payload URL-jei tartalmazzák). Közvetlen fájlstream. Hiba: 404 `agh_not_found`, 403 `agh_forbidden`.

#### POST `/events` ★

Törzs: `type` = `popup_open` vagy `design_start`. IP-nként és típusonként napi 50 esemény számít. Válasz mindig `{ ok: true }`.

#### GET, POST `/presets`

Bejelentkezett felhasználó; a POST-hoz `X-AGH-Nonce` is kell (különben 403 `agh_nonce`). POST-törzs: `presets: [ { name, values } ]` (≤20). Tárolás: `agh_presets` felhasználói meta. Válasz: `{ presets: [...] }`.

### 6.4 Kivitelezői végpontok

| Végpont | Törzs / paraméter | Válasz | Hibák |
|---|---|---|---|
| POST `/contractor/session` | `token` (64 hex) | `{ ok: true }` + `agh_cs` süti | 403 `agh_link`, 429 `agh_limit` (IP-nként napi 30) |
| POST `/contractor/logout` | – | `{ ok: true }` | – |
| GET `/contractor/projects` | – | `{ items: [ { quote: { id, created, status, full_name, email, phone, city, site_location, start_period, budget, note, package }, project: <projekt a kiválasztott koncepcióval, progress nélkül>, summary: { <kategória>: [ [címke, érték, szín] ] }, consents: [ { consent_type, granted, doc_version, doc_url, event, created_at } ] } ] }` (legfeljebb 50) | 401 `agh_forbidden` |
| GET `/contractor/package/{id}` | ajánlatkérés-UUID | ZIP stream; `downloads` +1 | 403 `agh_forbidden`, 404 |

**Hatókör** (`Access::contractor_quotes()`):

- munkatárs: minden ajánlatkérés;
- csak `agh_view_packages` képességű felhasználó: az e-mail-címére sikeresen kiküldött ajánlatkérések;
- linkes munkamenet: a saját ajánlatkérése.

A user agent a portálra és a csomagba nem kerül ki.

### 6.5 Webhook

**POST `/webhook/magnific/{token}`** – a `{token}` 32 hexadecimális karakter: `substr( HMAC-SHA256( 'agh-provider-webhook', wp_salt('auth') ), 0, 32 )` (`Util::webhook_token()`).

- Hibás token: 404 `{ ok: false }`. Nem 32 hex karakteres útvonalnál a WordPress `rest_no_route` hibát ad.
- A törzsből csak a `task_id` (UUID) számít: a hozzá tartozó várakozó lekérdező feladat azonnalra ütemeződik.
- IP-nként napi 2000 hívás felett 429.
- A plugin a tokenes URL-t maga küldi a Magnificnak (`magnific.use_webhook`). Az admin „Webhook használata” súgója a valós, tokenes URL-t mutatja, a közzététel elleni figyelmeztetéssel ([API-INTEGRACIOK.md 4.7](API-INTEGRACIOK.md#47-webhook)).

### 6.6 Adminvégpontok

Cookie-azonosítás `X-WP-Nonce` fejléccel.

| Végpont | Törzs / query | Válasz |
|---|---|---|
| POST `/admin/test-provider` | `provider`: `anthropic`, `magnific`, `test` vagy regisztrált azonosító | `{ ok, message }` |
| POST `/admin/prompt/preview` | `version` (0 = aktív), `view` (alap `hero`), `config` (opcionális) | `{ prompt, negative, version, length }` |
| POST `/admin/prompt/test` | `version`, `config` (opcionális) | `{ project, admin_url }`. **Valódi generálást indít keretfoglalás nélkül.** |
| GET `/admin/stats` | `from`, `to` (`ÉÉÉÉ-HH-NN`; alap: utolsó 30 nap) | `{ from, to, advanced, totals, series {generate_request, popup_open, quote_submitted, cost}, breakdown {style, roof, area_bucket, param, error, cost, provider_ok, provider_fail, limit_hit}, derived {…}, currency }`. A `stats_advanced` funkció nélkül `advanced: false`, és a `breakdown` kulcsai üresek. |
| POST `/admin/queue/run` | – | `{ processed, pending }` |

---

## 7. WP-CLI parancsok

Forrás: `includes/Cli/Command.php`.

| Parancs | Opciók | Hatás |
|---|---|---|
| `wp agh queue [run]` | `[<action>]` – egyetlen értéke `run` (alapértelmezés); `[--seconds=<seconds>]` – időkeret, alapértelmezés 50 | `JobQueue::run()`; kimenet: `Success: N job(s) processed, M pending.` |
| `wp agh status` | – | Képszolgáltató (teszt módnál `(TEST MODE)`), Anthropic állapota, függő feladatok |
| `wp agh retention` | – | `Privacy::retention()` azonnal |

Mérve (WP-CLI 2.11.0, nulla időkerettel): `wp agh queue run --seconds=0` és `wp agh queue --seconds=0` is `Success: 0 job(s) processed, 0 pending.` A szinopszis: `wp agh queue [<action>] [--seconds=<seconds>]`.

Valódi cron javasolt nagy forgalomnál vagy `DISABLE_WP_CRON` mellett. A napi licencellenőrzés és a megőrzési takarítás WP-Cron eseményként fut, ezért azt is futtatni kell:

```cron
* * * * * cd /var/www/html && wp agh queue run --seconds=50 --quiet
*/5 * * * * cd /var/www/html && wp cron event run --due-now --quiet
```

A `JobQueue::run()` a párhuzamossági korlátot (`limits.max_parallel_jobs`) a CLI-ből indított futásnál is betartja.

---

## 8. Tesztek futtatása

A tesztfájlok WordPressen belül futnak (`wp eval-file`), a plugin aktív állapotában. Mért eredmények (a 3. javítási kör utáni koordinációs jegyzet szerint; PHP 8.3.6, WordPress 7.2-alpha, SQLite Database Integration 3.1.0, `AGH_OWNER_MODE` bekapcsolva). E dokumentum írásakor a teszteket nem futtattuk.

| Fájl | Parancs | Utolsó sor | Mért |
|---|---|---|---|
| `tests/integration-test.php` | `wp eval-file wp-content/plugins/autogrowehome/tests/integration-test.php` | `ÖSSZESEN: N sikeres, M sikertelen` | 147/147 |
| `tests/regression-x.php` | `wp eval-file wp-content/plugins/autogrowehome/tests/regression-x.php` | `REGRESSZIÓ x: N sikeres, M sikertelen` | 120/120 |
| `tests/regression-y1.php` | `wp eval-file wp-content/plugins/autogrowehome/tests/regression-y1.php` | `REGRESSZIÓ y1: …` | 116/116 |
| `tests/regression-y2.php` | `wp eval-file wp-content/plugins/autogrowehome/tests/regression-y2.php` | `REGRESSZIÓ y2: …` | 71/71 |
| `tools/license-server/tests/selftest.php` | `php tools/license-server/tests/selftest.php` | – | 32/32 |

**Integrációs tesztsor – előfeltételek és mellékhatások:**

- `define( 'AGH_OWNER_MODE', true );` a teszt webhely `wp-config.php`-jában (egy eset ellenőrzi); PHP GD és Zip.
- A külső hívásokat `pre_http_request` szűrő szimulálja, az e-maileket `pre_wp_mail` kapja el; ha még nincs, `DISABLE_WP_CRON`-t definiál.

> **Figyelem – romboló teszt, csak külön tesztpéldányon futtasd.** Az `integration-test.php` törli az `agh_projects`, `agh_concepts`, `agh_assets`, `agh_jobs`, `agh_quotes`, `agh_consents`, `agh_rate`, `agh_access`, `agh_ledger` tábla összes sorát (`agh_reset_state()`). Módosítja a beállításcsoportokat, és **üresre állítja a tárolt Anthropic- és Magnific-kulcsot**.

**Regressziós tesztek:** a fájlfejlécek szerint önállóak:

- saját ideiglenes adatokat hoznak létre és a végén eltávolítják;
- a HTTP-hívásokat szimulálják;
- a beállításokat és kulcsokat csak memóriában írják felül (`pre_option_*` szűrők);
- a `regression-y1` a feladatsort csak a saját projektjeire futtatja.

Ezt a viselkedést nem ellenőriztük. A `regression-x` fejléce szerint egy még érintetlen, 1. gyári promptverzión álló webhelyen az első `PromptEngine::get()` ténylegesen elvégzi a gyári promptfrissítést.

---

## 9. Fordítási munkafolyamat

Forrásnyelv: magyar; text domain: `autogrowehome`; fájlok: `languages/`. A JavaScript-feliratok PHP-ból érkeznek (`includes/Frontend/Strings.php`), ezért `wp i18n make-json` nem kell. A `.pot` jelenleg 1565 fordítandó szöveget tartalmaz (mérve: a `msgid` sorok száma a fejléc nélkül); a koordinációs jegyzet szerint mind a 15 nyelv teljes, 0 fuzzy, MI-fordítás (lektorálás javasolt).

A plugin könyvtárából:

```bash
# 1. Sablon újragenerálása
wp i18n make-pot . languages/autogrowehome.pot --domain=autogrowehome --exclude=tests,tools,docs,languages

# 2. A meglévő .po fájlok frissítése
wp i18n update-po languages/autogrowehome.pot languages/

# 3. Fordítás (Poedit, Loco Translate), majd .mo fájlok
wp i18n make-mo languages/
```

Megjegyzések:

- Fájlnév: `languages/autogrowehome-<locale>.mo`. Új nyelvhez az `I18n::SUPPORTED` tömbbe is fel kell venni a locale-t (kódmódosítás), és a koncepciónév-utasításhoz a `Planner::language_name()` táblájába is.
- A `make-pot` alapértelmezett `Report-Msgid-Bugs-To` fejléce wordpress.org-címet ír; a `--headers` kapcsolóval felülírható.

---

## 10. Build és kiadás

**Nincs build-lépés:** nincs Composer- vagy npm-függőség. A gyorsítótár-ürítést a `Frontend::asset_ver()` végzi (`AGH_VERSION` + a fájl módosítási ideje).

**Kiadási ellenőrzőlista:**

| Lépés | Hol |
|---|---|
| Verziószám | `autogrowehome.php` fejléc `Version:` és `define( 'AGH_VERSION', … )`. Az `uninstall.php` a verziót a fejlécből olvassa. |
| Sémaváltozás | `AGH_DB_VERSION` növelése; a `CREATE TABLE` utasítások dbDelta-val frissülnek ([ADATBAZIS.md](ADATBAZIS.md#3-sémaverzió-és-migráció)) |
| Gyári promptok | Új gyári szövegnél a `DefaultModules::REVISION` növelése, és az előző kiadás pontos tartalmának felvétele a `DefaultModules::factory_history()`-ba (az érintetlen gyári verziót használó webhelyek automatikusan frissülnek) |
| Fordítások | 9. fejezet |
| Tesztek | 8. fejezet, külön tesztpéldányon |
| Licencfájl | A fejléc `License: Commercial (see LICENSE.txt)` sora hivatkozik rá: a `LICENSE.txt` legyen a csomagban |
| Csomag | A futáshoz szükséges: `autogrowehome.php`, `uninstall.php`, `includes/`, `assets/`, `templates/`, `languages/`. A futó kód nem hivatkozik a `tests/` és `tools/` mappára; a `tools/license-server` külön telepítendő. A romboló integrációs tesztfájlt javasolt kihagyni az ügyfélcsomagból. |

**Frissítések terjesztése** (`includes/License/LicenseManager.php`):

1. Kiadás felvétele a licencszerveren: `php bin/manage.php release --version=<v> --file=<zip> --tested=<wp>` (`tools/license-server/README.md`). A koordinációs jegyzet szerint a szerver hiányzó csomagfájlú kiadást nem kínál fel.
2. **Ellenőrzés** (`update_info()`):
   - Feltétel: HTTPS licencszerver, nyilvános kulcs, sodium, `update_entitled` licenc, licenckulcs.
   - A plugin `POST <szerver>/v1/update/check` kérést küld, egyszer használatos nonce-szal.
   - Az aláírt válasznak vissza kell adnia a nonce-ot, az `instance_id`-t, és ±10 percen belüli `issued_at` értéket kell tartalmaznia.
   - Az eredmény 12 órára az `agh_update_info` webhely-tranziensbe kerül.
3. **Felkínálás** (`filter_updates()`): csak ha a verzió nagyobb, a csomag-URL `<szerver>/v1/update/package/` előtagú, és van 64 hex karakteres `sha256` az aláírt adatban.
4. **Letöltés és ellenőrzés** (`pre_download()`, `upgrader_pre_download`): a plugin maga tölti le a csomagot. A licencfejléceket (`X-AGH-License`, `X-AGH-Instance`) a `package_auth()` teszi rá, `sslverify = true` és `redirection = 0` mellett. Telepítés előtt összeveti a SHA-256-ot; eltérésnél `WP_Error` (`agh_update_checksum`), hiányzó ellenőrzőösszegnél `agh_update_unverified`.
