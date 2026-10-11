# AutoGroweHome 1.0.0 – Minta-konfigurációk

Három kiinduló beállításcsomag tipikus felhasználási helyzetekre, **valódi beállításkulcsokkal**. Mindegyiknél egy táblázat mutatja az alapértéktől eltérő kulcsokat, és egy WP-CLI-vel futtatható PHP-fájl ugyanezt be is állítja.

| # | Helyzet | Csomag |
|---|---|---|
| A | Kis kivitelező, egy weboldal, magyar piac | Starter |
| B | Könnyűszerkezetes házgyártó, több nyelv, egyedi paraméterek | Professional |
| C | Ügynökség, több ügyfél-weboldal egységes alapbeállítással | Agency |

> **A számok példaértékek**, nem ajánlott vagy mért értékek. Az árakat (`costs.*`) a szolgáltató aktuális árlistájából kell kitölteni – ezek nélkül a költségkeret soha nem telik be. A kulcsok jelentése és tartománya: `docs/KONFIGURACIO.md`.

---

## 0. Hogyan alkalmazd?

### 0.1 Import/export funkció nincs

A pluginban nincs beállítás-import/-export (ellenőrizve). A beállítások az `agh_settings` opcióban vannak; kódból a `Settings::update_group( string $group, array $values )` metódussal írhatók (`includes/Support/Settings.php`). Ez **csoportonként összefésül**: a megadott kulcsok felülíródnak, a többi marad; a listák (pl. `enabled_locales`, `exterior_views`) teljes egészében cserélődnek.

> **Figyelem:** az `update_group()` csak a szolgáltatói URL-eket ellenőrzi (`https://` cím, relatív végpont-útvonal; érvénytelen helyett gyári érték), minden más értéket ellenőrzés nélkül ment – az admin űrlappal ellentétben. Csak a `docs/KONFIGURACIO.md` táblázataiban szereplő értékeket és tartományokat használd. Először tesztoldalon futtasd, és készíts adatbázis-mentést.

### 0.2 Futtatás

```bash
cd /var/www/example.hu
wp eval-file agh-minta-a.php
wp agh status
```

Futtatás után az admin oldalakon ellenőrizd az értékeket; egy admin oldal mentése az ottani értékeket a szokásos ellenőrzéssel újra elmenti.

### 0.3 API-kulcsok

A kulcsokat **ne** tedd ezekbe a fájlokba. Add meg őket a `wp-config.php`-ban (`AGH_MAGNIFIC_API_KEY`, `AGH_ANTHROPIC_API_KEY`, `AGH_LICENSE_KEY` – `includes/Support/Secrets.php`), vagy az admin felületen.

---

## A) Kis kivitelező – Starter

**Helyzet:** egy weboldal, csak magyar látogatók, Magnific-kulcs van, Anthropic nincs. Szűk költségkeret, egyetlen kivitelezői cím.

**Amit a Starter csomag eleve korlátoz** (`includes/License/Features.php`): IP-napi keret legfeljebb 3; a galériában csak elöl-, hátul- és madártávlati nézet (a fő képpel együtt max. 4 kép); belső nézet legfeljebb 2; felbontás legfeljebb 2K; nincs tervvázlat, nyelvválasztó, promptszerkesztő és egyedi paraméter; az arculatból csak a logó, a név és a fő szín érvényesül.

| Kulcs | Érték | Indoklás |
|---|---|---|
| `general.plugin_name` | `Minta Építő háztervező` | Megjelenik a menüben, a tervezőben, az e-mailekben |
| `general.button_label` | `Tervezd meg a házad` | |
| `general.floating_button` | `true` | Lebegő gomb minden oldalon |
| `general.frontend_locale` | `hu_HU` | Mindig magyar |
| `general.enabled_locales` | `['hu_HU']` | |
| `anthropic.enabled` | `false` | Nincs kulcs → szabályalapú tervező |
| `images.active_provider` | `magnific` | |
| `images.fallback_provider` | `''` | Nincs tartalék |
| `images.allow_test_provider` | `false` | Élesben ne legyen teszt mód |
| `magnific.preview_resolution` | `2k` | Starter felső korlát |
| `magnific.final_resolution` | `2k` | |
| `magnific.upscale_enabled` | `false` | Nincs extra költség |
| `costs.daily_budget` | `5.0` | Példaérték, csak kitöltött árakkal hat |
| `limits.ip_daily` | `3` | |
| `limits.global_daily` | `15` | Az egész oldal napi felső korlátja |
| `limits.gallery_rebuilds_per_day` | `1` | Koncepció-újragenerálás naponta IP-nként / felhasználónként |
| `limits.timezone` | `Europe/Budapest` | |
| `limits.gallery_mode` | `selected` | Galéria csak a kiválasztott házhoz |
| `limits.exterior_views` | `['front','back','aerial']` | Starterben csak ezek készülhetnek |
| `limits.interiors_max` | `2` | |
| `limits.max_images_request` | `10` | |
| `access.client_download` | `hero` | Az ügyfél a kiválasztott ház fő képét töltheti le |
| `contractor.name` | `Minta Béla` | A kivitelezői levél megszólítása (`{contractor_name}`) |
| `contractor.company` | `Minta Építő Kft.` | |
| `contractor.email` | `ajanlat@example.hu` | |
| `emails.from_name` | `Minta Építő` | |
| `emails.from_email` | `noreply@example.hu` | Ugyanaz a domain, mint az SPF/DKIM |
| `legal.terms_url` | `https://example.hu/aszf/` | |
| `legal.terms_version` | `2026-10` | |
| `legal.privacy_url` | `https://example.hu/adatkezeles/` | |
| `legal.privacy_version` | `2026-10` | |
| `legal.marketing_enabled` | `false` | Nincs hírlevél |
| `branding.color_primary` | `#2E6B4F` | Starterben a fő szín érvényesül |

`agh-minta-a.php`:

```php
<?php
// AutoGroweHome – A) Kis kivitelező (Starter). Futtatás: wp eval-file agh-minta-a.php
use AutoGroweHome\Support\Settings;

Settings::update_group( 'general', array(
	'plugin_name'     => 'Minta Építő háztervező',
	'button_label'    => 'Tervezd meg a házad',
	'floating_button' => true,
	'frontend_locale' => 'hu_HU',
	'enabled_locales' => array( 'hu_HU' ),
) );
Settings::update_group( 'anthropic', array( 'enabled' => false ) );
Settings::update_group( 'images', array(
	'active_provider'     => 'magnific',
	'fallback_provider'   => '',
	'allow_test_provider' => false,
) );
Settings::update_group( 'magnific', array(
	'preview_resolution' => '2k',
	'final_resolution'   => '2k',
	'upscale_enabled'    => false,
) );
Settings::update_group( 'costs', array(
	// 'mystic_2k' => 0.0, // a szolgáltató aktuális ára alapján töltsd ki!
	'daily_budget' => 5.0,
) );
Settings::update_group( 'limits', array(
	'ip_daily'                 => 3,
	'global_daily'             => 15,
	'gallery_rebuilds_per_day' => 1,
	'timezone'                 => 'Europe/Budapest',
	'gallery_mode'             => 'selected',
	'exterior_views'           => array( 'front', 'back', 'aerial' ),
	'interiors_max'            => 2,
	'max_images_request'       => 10,
) );
Settings::update_group( 'access', array( 'client_download' => 'hero' ) );
Settings::update_group( 'contractor', array(
	'name'    => 'Minta Béla',
	'company' => 'Minta Építő Kft.',
	'email'   => 'ajanlat@example.hu',
) );
Settings::update_group( 'emails', array(
	'from_name'  => 'Minta Építő',
	'from_email' => 'noreply@example.hu',
) );
Settings::update_group( 'legal', array(
	'terms_url'         => 'https://example.hu/aszf/',
	'terms_version'     => '2026-10',
	'privacy_url'       => 'https://example.hu/adatkezeles/',
	'privacy_version'   => '2026-10',
	'marketing_enabled' => false,
) );
Settings::update_group( 'branding', array( 'color_primary' => '#2E6B4F' ) );

WP_CLI::success( 'A) minta beállítva.' );
```

**Utána:** Katalógus → Tetőfedési termék → a BRAMAC-tételek ellenőrzése és „Ellenőrzött” jelölése (`docs/ADMIN-KEZIKONYV.md`, 3.8). Magastetőnél a BRAMAC kötelező márka; a márka nem rejthető el és nem törölhető. A csomagmátrix és az árak ügyféloldalon nem írhatók – ezért a minták nem is nyúlnak hozzájuk.

---

## B) Könnyűszerkezetes házgyártó – Professional

**Helyzet:** házgyártó cég magyar, német és angol érdeklődőkkel; Magnific és Anthropic is van. A tervező egy külön „Tervezés” oldalon fut shortcode-dal, lebegő gomb nélkül. Saját paraméterekkel gyűjti a szerkezeti és készültségi igényt.

**Professional korlátok:** IP-napi keret max. 10; külső nézet a fő képpel együtt max. 8; belső nézet max. 6; felbontás max. 4K. Teljes arculat, nyelvválasztó, promptszerkesztő és egyedi paraméterek elérhetők.

| Kulcs | Érték | Indoklás |
|---|---|---|
| `general.plugin_name` | `Könnyűház-tervező` | |
| `general.floating_button` | `false` | A „Tervezés” oldalon `[autogrowehome label="Indítsd el a tervezést"]` |
| `general.default_mode` | `simple` | |
| `general.frontend_locale` | `auto` | A webhely (pl. többnyelvű bővítmény szerinti) nyelve |
| `general.enabled_locales` | `['hu_HU','de_DE','en_US']` | Látogatói nyelvválasztó |
| `anthropic.enabled` | `true` | |
| `anthropic.use_for_plan` | `true` | AI-alapú koncepciótervezés |
| `anthropic.use_for_interpret` | `true` | „AI értelmezés” gomb |
| `images.allow_test_provider` | `false` | |
| `magnific.preview_resolution` | `2k` | |
| `magnific.view_strategy` | `reference` | A fő kép a referencia a további nézetekhez |
| `magnific.structure_guidance` | `true` | Tömegvázlat-alapú geometriai vezetés |
| `magnific.upscale_enabled` | `true` | A kiválasztott galéria 3840 px alatti képei felskálázva (külön költség) |
| `costs.monthly_budget` | `300.0` | Példaérték |
| `limits.ip_daily` | `5` | |
| `limits.user_daily` | `5` | Bejelentkezett felhasználóra is |
| `limits.global_daily` | `80` | |
| `limits.gallery_rebuilds_per_day` | `3` | Koncepció-újragenerálás naponta |
| `limits.timezone` | `Europe/Budapest` | |
| `limits.gallery_mode` | `selected` | Így a `final_resolution` nem használt |
| `limits.exterior_views` | `['front','back','left','right','aerial','garden','evening']` | 7 nézet + fő kép = 8 |
| `limits.interiors_max` | `4` | |
| `limits.max_images_request` | `20` | |
| `contractor.name` | `Értékesítési csapat` | A levél megszólítása |
| `contractor.company` | `Minta Könnyűház Kft.` | |
| `contractor.email` | `ertekesites@example.hu` | |
| `contractor.link_hours` | `336` | 2 hétig érvényes hivatkozás |
| `contractor.session_hours` | `24` | |
| `contractor.retention_days` | `365` | A ZIP egy évig marad |
| `emails.contractor_subject` | `Új házkonfiguráció – {project_id} ({city})` | Valódi változókkal |
| `legal.marketing_enabled` | `true` | |
| `legal.marketing_text` | saját, jogász által jóváhagyott szöveg | |
| `branding.color_primary` / `color_accent` | `#1F4E5F` / `#E0A458` | |
| `branding.default_theme` | `light` | |
| `branding.shadow` | `strong` | |

`agh-minta-b.php` – beállítások, **egyedi paraméterek** és **beépített paraméterek testreszabása**:

```php
<?php
// AutoGroweHome – B) Könnyűszerkezetes házgyártó (Professional). Futtatás: wp eval-file agh-minta-b.php
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Params\Registry;

Settings::update_group( 'general', array(
	'plugin_name'     => 'Könnyűház-tervező',
	'floating_button' => false,
	'default_mode'    => 'simple',
	'frontend_locale' => 'auto',
	'enabled_locales' => array( 'hu_HU', 'de_DE', 'en_US' ),
) );
Settings::update_group( 'anthropic', array(
	'enabled'           => true,
	'use_for_plan'      => true,
	'use_for_interpret' => true,
) );
Settings::update_group( 'images', array( 'active_provider' => 'magnific', 'fallback_provider' => '', 'allow_test_provider' => false ) );
Settings::update_group( 'magnific', array(
	'preview_resolution' => '2k',
	'view_strategy'      => 'reference',
	'structure_guidance' => true,
	'upscale_enabled'    => true,
) );
Settings::update_group( 'costs', array( 'monthly_budget' => 300.0 ) ); // + árak kitöltése!
Settings::update_group( 'limits', array(
	'ip_daily'                 => 5,
	'user_daily'               => 5,
	'global_daily'             => 80,
	'gallery_rebuilds_per_day' => 3,
	'timezone'                 => 'Europe/Budapest',
	'gallery_mode'             => 'selected',
	'exterior_views'           => array( 'front', 'back', 'left', 'right', 'aerial', 'garden', 'evening' ),
	'interiors_max'            => 4,
	'max_images_request'       => 20,
) );
Settings::update_group( 'contractor', array(
	'name'           => 'Értékesítési csapat',
	'company'        => 'Minta Könnyűház Kft.',
	'email'          => 'ertekesites@example.hu',
	'link_hours'     => 336,
	'session_hours'  => 24,
	'retention_days' => 365,
) );
Settings::update_group( 'emails', array( 'contractor_subject' => 'Új házkonfiguráció – {project_id} ({city})' ) );
Settings::update_group( 'legal', array( 'marketing_enabled' => true ) );
Settings::update_group( 'branding', array(
	'color_primary' => '#1F4E5F',
	'color_accent'  => '#E0A458',
	'default_theme' => 'light',
	'shadow'        => 'strong',
) );

// --- Egyedi paraméterek (ugyanaz a formátum, mint a Paraméterek oldal űrlapja) ---
// A mentéshez a "custom_params" funkció kell (Professional+); enélkül WP_Error jön vissza,
// és a már tárolt egyedi paraméterek sem töltődnek be (az adatbázisban megmaradnak).
$params = array(
	array(
		'id'       => 'falszerkezet',              // x_falszerkezet néven tárolódik
		'label'    => 'Falszerkezet',
		'category' => 'massing',                   // külső kategória → külső képek promptjába kerül
		'type'     => 'select',
		'options'  => "favaz|Fa vázszerkezet|timber frame construction\n"
		            . "acelvaz|Könnyűacél vázszerkezet|light gauge steel frame construction\n"
		            . "sip|SIP panel|structural insulated panel construction",
		'default'  => 'favaz',
		'prompt'   => 'wall construction: {value}',
		'help'     => 'A gyártott szerkezeti rendszer.',
		'translations' => array( 'de_DE' => 'Wandkonstruktion', 'en_US' => 'Wall construction' ),
	),
	array(
		'id'       => 'szigeteles',
		'label'    => 'Falszigetelés vastagsága',
		'category' => 'energy',
		'type'     => 'integer',
		'unit'     => 'mm',
		'min'      => 150,
		'max'      => 400,
		'step'     => 10,
		'default'  => 250,
		'show_if_field' => 'x_falszerkezet',       // csak fa- és SIP-szerkezetnél látszik
		'show_if_op'    => 'in',
		'show_if_value' => 'favaz, sip',
		'translations'  => array( 'de_DE' => 'Dämmstärke', 'en_US' => 'Insulation thickness' ),
	),
	array(
		'id'       => 'keszultseg',
		'label'    => 'Kért készültségi szint',
		'category' => 'basics',
		'type'     => 'select',
		// Üres harmadik oszlop: az opció nem kerül a képpromptba (csak az ajánlathoz kell).
		'options'  => "szerkezetkesz|Szerkezetkész|\nfeluletkesz|Felületkész|\nkulcsrakesz|Kulcsrakész|",
		'default'  => 'kulcsrakesz',
		'help'     => 'Az árajánlathoz szükséges.',
		'translations' => array( 'de_DE' => 'Ausbaustufe', 'en_US' => 'Completion level' ),
	),
	array(
		'id'       => 'bemutatohaz',
		'label'    => 'Szeretnék bemutatóházat megnézni',
		'category' => 'custom',
		'type'     => 'toggle',
		'default'  => false,
	),
);
foreach ( $params as $p ) {
	$r = Registry::save_custom( $p );
	if ( is_wp_error( $r ) ) {
		WP_CLI::warning( $p['id'] . ': ' . $r->get_error_message() );
	}
}

// --- Beépített paraméterek testreszabása (meglévő felülírásokkal összefésülve) ---
$ov = (array) get_option( Registry::OVERRIDE_OPTION, array() );
$ov['basement']       = array_merge( (array) ( $ov['basement'] ?? array() ), array( 'hidden' => true ) );   // nincs pince
$ov['ceiling_height'] = array_merge( (array) ( $ov['ceiling_height'] ?? array() ), array( 'default' => 2.7 ) ); // 2,4–5 m között
update_option( Registry::OVERRIDE_OPTION, $ov, false );
Registry::reset();

WP_CLI::success( 'B) minta beállítva.' );
```

**Az egyedi paraméterek formátuma** (`includes/Params/Registry.php`, `save_custom()`):

| Mező | Kötelező | Megjegyzés |
|---|---|---|
| `id` | igen | `a-z0-9_`; automatikusan `x_` előtagot kap; beépített azonosító nem lehet |
| `label` | igen | Megjelenítési név (magyar) |
| `category` | – | `basics`, `style`, `massing`, `roof`, `facade`, `openings`, `rooms`, `interior`, `kitchen`, `bathroom`, `surfaces`, `garden`, `energy`, `scene`, `custom` (alapértelmezés: `custom`) |
| `type` | – | `text`, `textarea`, `integer`, `number`, `range`, `select`, `multiselect`, `toggle`, `color`, `cards` (alapértelmezés: `text`) |
| `options` | választós típusnál igen | Soronként `érték|felirat|angol prompt`; hiányzó harmadik rész → a felirat a promptszöveg; üres harmadik rész → nincs promptszöveg |
| `default` | – | A típus szerint ellenőrizve (`Validator::sanitize_value()`); `multiselect`-nél „a, b” szöveg vagy lista |
| `min`, `max`, `step`, `unit` | – | Számtípusoknál; alapértelmezés 0 / 100 / 1 |
| `pattern` | – | Reguláris kifejezés, csak `text` típusnál |
| `show_if_field`, `show_if_op`, `show_if_value` | – | Megjelenítési feltétel: `=`, `!=`, `>`, `<`, `in` (`in`-nél „a, b” lista); a mezőre teljes azonosítóval (pl. `x_falszerkezet`) hivatkozz |
| `prompt` | – | Angol szöveg, `{value}` / `{label}` / `{color}` helyőrzővel; üresen választós típusnál az opció promptszövege kerül be |
| `required`, `advanced` | – | logikai |
| `sort` | – | alapértelmezés 1000 |
| `translations` | – | `nyelvkód => megjelenítési név` |

**Hová kerülnek az egyedi paraméterek?** A tervezőbe, a paraméter-összesítőbe, a kivitelezői csomagba, az Anthropic-tervező adatcsomagjába és a **képpromptokba** a `{custom_params}` változón (az `extras` modulon) keresztül. A belső kategóriák (`rooms`, `interior`, `kitchen`, `bathroom`, `surfaces`) csak belső, a külső kategóriák (`massing`, `roof`, `facade`, `openings`, `garden`, `energy`) csak külső képekhez, a többi mindkettőhöz (`PromptEngine::custom_phrases()`). A fenti példában így csak az `x_falszerkezet` ad promptszöveget (külső képekhez); ellenőrzés: Promptmotor → Előnézet.

**A beépített paraméterek felülírásának formátuma** (`agh_param_overrides` opció, paraméterazonosító szerint): `hidden` (kötelező mezőnél hatástalan), `advanced`, `label`, `help`, `default` (a mező típusának megfelelő érték), `sort`. Csak a ténylegesen módosítani kívánt kulcsokat add meg. A Paraméterek oldal „Mentés” gombja a teljes táblázatot menti, ez felülírja a kódból beállított értékeket a táblázat tartalmával.

---

## C) Ügynökség több ügyféllel – Agency

**Helyzet:** az ügynökség több ügyfél-weboldalt üzemeltet (az Agency csomag alapértelmezett leírásában 25 weboldal szerepel; a ténylegesen engedélyezett számot a licencszerver adja). Minden ügyfélnél ugyanaz az alapbeállítás, saját márkával, saját kivitelezői címekkel. A partnerkivitelezők e-mailt kapnak, az ügyfél irodája projektkezelőként lát rá a projektekre.

**Agency többlet:** white-label (a készítő neve nem jelenik meg a tervezőben), több kivitelező értesítése, DXF-export a dokumentumok közt, statisztikai CSV-export; IP-napi keret max. 50.

### C.1 Közös alap (minden ügyfél-weboldalon)

| Kulcs | Érték | Indoklás |
|---|---|---|
| `general.frontend_locale` | `auto` | |
| `general.enabled_locales` | `['hu_HU','de_DE','en_US','sk_SK','ro_RO']` | Régiós célpiac |
| `anthropic.enabled` | `true` | |
| `images.allow_test_provider` | `false` | |
| `magnific.preview_resolution` | `2k` | |
| `magnific.upscale_enabled` | `false` | Ügyfélenként dönthető |
| `limits.ip_daily` | `5` | |
| `limits.global_daily` | `200` | |
| `limits.timezone` | `Europe/Budapest` | |
| `limits.gallery_mode` | `selected` | |
| `contractor.multi_enabled` | `true` | Agency funkció |
| `contractor.link_hours` | `168` | |
| `legal.retention_quotes_days` | `730` | |
| `branding.logo_id`, `branding.icon_id`, `branding.background_image_id` | `0` | A médiatár-azonosító weboldalanként más – helyben kell beállítani |

### C.2 Ügyfélenként eltérő

| Kulcs | Példa |
|---|---|
| `general.plugin_name` | `Ügyfél Kft. háztervező` |
| `general.author_name` | `''` (white-label mellett nem jelenik meg) |
| `contractor.name`, `contractor.company` | az ügyfél adatai |
| `contractor.email` | `iroda@ugyfel.example.hu` |
| `contractor.extra_emails` | `partner1@example.hu, partner2@example.hu` |
| `emails.from_name`, `emails.from_email` | az ügyfél domainjéről |
| `legal.terms_url`, `legal.privacy_url`, `legal.*_version` | az ügyfél dokumentumai |
| `costs.monthly_budget` | ügyfélszerződés szerint |
| `branding.color_primary`, `color_accent` | az ügyfél színei |

### C.3 Alapbeállítás átvitele és ügyfélszintű módosítás

A mintaoldalon exportálod, az ügyféloldalon importálod (szabványos WP-CLI), majd lefuttatod az ügyfélre szabott fájlt:

```bash
# Mintaoldal
wp option get agh_settings        --format=json > agh_settings.json
wp option get agh_custom_params   --format=json > agh_custom_params.json
wp option get agh_param_overrides --format=json > agh_param_overrides.json
wp option get agh_help            --format=json > agh_help.json   # csak ha szerkesztetted

# Ügyféloldal
wp option update agh_settings        --format=json < agh_settings.json
wp option update agh_custom_params   --format=json < agh_custom_params.json
wp option update agh_param_overrides --format=json < agh_param_overrides.json
wp option update agh_help            --format=json < agh_help.json
wp eval-file agh-minta-c-ugyfel.php
```

Amit **nem** vihetsz át így:

- az API- és licenckulcsokat (az `agh_secrets` a forrásoldal kulcsával – `AGH_SECRET_SALT`, ennek hiányában a WordPress-sók – titkosított) – ezeket ügyféloldalanként `wp-config.php` konstansként vagy az adminban add meg; a licenckulcsot minden weboldalon külön aktiválni kell;
- a médiatár-azonosítókat (`logo_id`, `icon_id`, `background_image_id`) – helyben állítsd be;
- a csomagmátrixot és az árakat (`agh_plans`, `agh_checkout_urls`) – ügyféloldalon teljesen csak olvasható a beépített mátrix (név, célközönség, ár is), a tárolt opciót a plugin figyelmen kívül hagyja; ne másold és ne írd;
- a BRAMAC márkát – az ügyféloldalon is a kötelező, mindig publikált, nem rejthető és nem törölhető tetőfedési márka; a katalógusmunka a termékek ellenőrzése.

`agh-minta-c-ugyfel.php`:

```php
<?php
// AutoGroweHome – C) Ügynökség, ügyfélre szabás (Agency). Futtatás: wp eval-file agh-minta-c-ugyfel.php
use AutoGroweHome\Support\Settings;
use AutoGroweHome\Catalog\Catalog;

$ugyfel = array(
	'nev'      => 'Ügyfél Kft.',
	'domain'   => 'ugyfel.example.hu',
	'kapcsolat'=> 'Ügyfél Iroda',
	'partnerek'=> 'partner1@example.hu, partner2@example.hu',
	'szin'     => '#8A3B2E',
	'akcent'   => '#D9A441',
);

Settings::update_group( 'general', array(
	'plugin_name'     => $ugyfel['nev'] . ' háztervező',
	'author_name'     => '',
	'frontend_locale' => 'auto',
	'enabled_locales' => array( 'hu_HU', 'de_DE', 'en_US', 'sk_SK', 'ro_RO' ),
) );
Settings::update_group( 'contractor', array(
	'name'          => $ugyfel['kapcsolat'],
	'company'       => $ugyfel['nev'],
	'email'         => 'iroda@' . $ugyfel['domain'],
	'multi_enabled' => true,
	'extra_emails'  => $ugyfel['partnerek'],
) );
Settings::update_group( 'emails', array(
	'from_name'  => $ugyfel['nev'],
	'from_email' => 'noreply@' . $ugyfel['domain'],
) );
Settings::update_group( 'legal', array(
	'terms_url'       => 'https://' . $ugyfel['domain'] . '/aszf/',
	'terms_version'   => '2026-10',
	'privacy_url'     => 'https://' . $ugyfel['domain'] . '/adatkezeles/',
	'privacy_version' => '2026-10',
) );
Settings::update_group( 'costs', array( 'monthly_budget' => 200.0 ) ); // példaérték
Settings::update_group( 'branding', array(
	'color_primary'       => $ugyfel['szin'],
	'color_accent'        => $ugyfel['akcent'],
	'logo_id'             => 0,
	'icon_id'             => 0,
	'background_image_id' => 0,
) );

// Csak olvasás: a még nem ellenőrzött BRAMAC-tételek listája az ügyféllel közös átnézéshez
// (az "Ellenőrzött" jelölést a Katalógusban, a gyártói adatokkal való egyeztetés után állítsd be).
foreach ( Catalog::all( 'roof_product', false ) as $item ) {
	if ( empty( $item['data']['verified'] ) && 'published' === $item['status'] ) {
		WP_CLI::line( 'Ellenőrizendő: ' . $item['slug'] . ' – ' . $item['name'] );
	}
}

WP_CLI::success( 'C) ügyfélbeállítás kész: ' . $ugyfel['nev'] );
```

### C.4 Felhasználók ügyféloldalanként

```bash
# Az ügyfél irodája: projektek, ajánlatkérések, statisztika – beállítások nélkül
wp user create iroda iroda@ugyfel.example.hu --role=agh_manager

# Partnerkivitelező bejelentkezéssel (portál: /?agh-portal=1)
wp user create partner1 partner1@example.hu --role=agh_contractor
```

> A bejelentkezett kivitelező (`agh_contractor`) a portálon csak azokat az ajánlatkéréseket látja, amelyek értesítése **a fiókja e-mail-címére** kiment (`includes/Rest/Access.php`, `contractor_quotes()`) – ezért a fiók címe egyezzen a `contractor.extra_emails` (vagy `contractor.email`) megfelelő címével. A projektkezelő (`agh_manager`) minden ajánlatkérést lát. Fiók nélkül az e-mailben kapott, ajánlatkéréshez és címzetthez kötött hivatkozás is elegendő.

---

## Összehasonlító áttekintés

| Kulcs | A) Starter | B) Professional | C) Agency |
|---|---|---|---|
| `general.frontend_locale` | `hu_HU` | `auto` | `auto` |
| `general.enabled_locales` | hu | hu, de, en | hu, de, en, sk, ro |
| `general.floating_button` | be | ki (shortcode) | alapérték (be) |
| `anthropic.enabled` | ki | be | be |
| `magnific.preview_resolution` | 2k | 2k | 2k |
| `magnific.upscale_enabled` | ki | be | ki |
| `limits.ip_daily` | 3 | 5 | 5 |
| `limits.global_daily` | 15 | 80 | 200 |
| `limits.gallery_rebuilds_per_day` | 1 | 3 | alapérték (2) |
| `limits.exterior_views` | front, back, aerial | 7 nézet | alapérték |
| `limits.interiors_max` | 2 | 4 | alapérték (4) |
| `contractor.multi_enabled` | ki | ki | be |
| `contractor.link_hours` | 168 | 336 | 168 |
| Egyedi paraméterek | – (Starterben nem elérhető) | 4 db | a mintaoldalról átvéve |
| Arculat | logó, név, fő szín | teljes | teljes |
