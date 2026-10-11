# AutoGroweHome 1.0.0 – Telepítési útmutató

Ez a dokumentum a plugin telepítését, az aktiváláskor létrejövő elemeket, a háttérfeldolgozás (cron) beállítását, a védett tárhely biztonságos elhelyezését, a frissítést és az eltávolítást írja le. Minden állítás a forráskódon alapul; a hivatkozott fájlok a plugin gyökeréhez képest értendők.

> **Ellenőrzöttségi állapot.** A plugin PHP 8.3.6 + WordPress 7.2-alpha + SQLite Database Integration környezetben futott tesztelve. **Nem ellenőrzött élesben:** MySQL/MariaDB, valódi rendszer-cron éles tárhelyen, tényleges e-mail-kézbesítés, valós Magnific- és Anthropic-hívás éles kulccsal. Ezeket az első éles telepítésnél külön ellenőrizd (lásd `docs/TELEPITES-UTANI-ELLENORZOLISTA.md`).

---

## 1. Követelmények

### 1.1 Alaprendszer

| Elem | Minimum / elvárás | Forrás a kódban |
|---|---|---|
| PHP | 8.0 | `autogrowehome.php` fejléc (`Requires PHP: 8.0`) + futásidejű ellenőrzés |
| PHP mbstring | kötelező | `autogrowehome.php` futásidejű ellenőrzés (1.2) |
| WordPress | 6.2 | `autogrowehome.php` fejléc (`Requires at least: 6.2`); ezt a WordPress aktiváláskor ellenőrzi |
| Adatbázis | a WordPress által támogatott | A táblák `dbDelta()`-val jönnek létre (`includes/Installer.php`). A kód MySQL-szintaxist használ (`INSERT IGNORE`, `ON DUPLICATE KEY UPDATE` – pl. `includes/RateLimit/RateLimiter.php`, `includes/Stats/Stats.php`, `includes/Generation/JobQueue.php`). **MySQL/MariaDB-n nem tesztelt.** |
| HTTPS | erősen ajánlott | A sütik `Secure` jelzője az `is_ssl()` eredményétől függ (`includes/Quote/AccessTokens.php`, `includes/Rest/Access.php`); a licencszerver URL-je csak `https://` lehet (`includes/License/LicenseManager.php`); webhook HTTPS nélkül admin figyelmeztetést ad (`includes/Admin/Admin.php`) |

Ha a PHP-verzió vagy az mbstring hiányzik, a plugin **semmilyen hookot nem regisztrál** (aktiválási rutin, admin menü, REST sem), csak egy admin hibaüzenetet jelenít meg (`autogrowehome.php`). A WordPress ettől még „bekapcsoltként” jelezheti a bővítményt.

Ha a HTTPS-t egy proxy/terheléselosztó zárja le, gondoskodj róla, hogy a WordPress `is_ssl()` igaz legyen (pl. a proxy `X-Forwarded-Proto` fejléce alapján a `wp-config.php`-ban), különben a sütik `Secure` jelző nélkül készülnek.

### 1.2 PHP-kiterjesztések

| Kiterjesztés | Szerep | Mi történik nélküle | Forrás |
|---|---|---|---|
| **mbstring** | Szövegkezelés, tervvázlat-feliratok (`mb_strtoupper`) | **A plugin nem tölt be**; admin hiba: „Az AutoGroweHome működéséhez a PHP mbstring kiterjesztése szükséges…” | `autogrowehome.php` |
| **zip** (`ZipArchive`) | Kivitelezői ZIP-csomag | A csomag nem készül el; admin **hiba**: „A PHP zip kiterjesztés hiányzik…”. A kivitelező a próbálkozások után csomag nélkül is értesítést kap. | `includes/Quote/PackageBuilder.php`, `includes/Quote/QuoteService.php`, `includes/Admin/Admin.php` |
| **gd** | Teszt mód képei, geometriai vezetés (tömegvázlat a Magnificnek) | Admin figyelmeztetés: „…a teszt mód és a geometriai vezetés nem érhető el.” | `includes/Generation/GuideRenderer.php`, `includes/Ai/TestImageProvider.php` |
| **sodium** | API-kulcsok titkosítása, licencválasz és frissítési adatok aláírás-ellenőrzése | Kulcstitkosításnál **openssl**-alapú tartalék (AES-256-CBC + külön kulcsú HMAC, `o2:` formátum). A licencellenőrzés sodium-függvény nélkül nem működik. A WordPress saját `sodium_compat` könyvtára (`wp-includes/compat.php`) a függvényeket kiterjesztés nélkül is pótolhatja. | `includes/Support/Secrets.php`, `includes/License/LicenseManager.php` |
| **json** | Minden adatcsere | PHP 8.0 óta a nyelv része. | – |
| **openssl** | Kimenő HTTPS; kulcstitkosítási tartalék | Kimenő API-hívások nem működnek. | `includes/Support/Secrets.php` |

Az admin **Súgó és rendszer** oldala „PHP-kiterjesztés: …” sorokban mutatja az mbstring, sodium, gd, zip és json állapotát (`includes/Admin/Pages.php`, `php_extensions()`).

### 1.3 Hálózat

- **Kimenő HTTPS** a beállított végpontokra: alapértelmezés szerint `https://api.magnific.com` (képek) és `https://api.anthropic.com/v1/messages` (szövegtervezés), valamint – ha használod – a licencszerver. A szolgáltatói URL-ek csak `https://` címek lehetnek, hitelesítő adat nélkül; a végpont-útvonalak csak relatívak (`includes/Support/Settings.php`).
- **API-kulcsos kérés nem követ átirányítást.** A generált képek letöltése (`includes/Support/Http.php`, `download()`): csak `https://`, legfeljebb 3 átirányítás (hopponként ellenőrizve), max. 60 MB, csak PNG/JPEG/WebP kép.
- **Loopback (a szerver önmagát éri el HTTP-n):**
  - generálási kérés és ajánlatkérés után a plugin `spawn_cron()`-nal azonnali, nem blokkoló feldolgozást indít (`includes/Generation/JobQueue.php`, `spawn()`);
  - a védett tárhely önellenőrzése HTTP-kérést küld a saját feltöltési URL-re (`includes/Support/Storage.php`, `health()`).

  A loopback működését a WordPress **Eszközök → Webhely állapota** oldala ellenőrzi. Ha nem működik, a feldolgozás a cronra és a látogatói állapotlekérdezésre marad (5. fejezet).

---

## 2. Telepítés ZIP-ből

1. **Bővítmények → Új hozzáadása → Bővítmény feltöltése**, válaszd ki az `autogrowehome.zip` fájlt, majd **Telepítés most**.
2. **Bővítmény bekapcsolása.**
3. A bal menüben megjelenik a plugin menüje (neve a `general.plugin_name` beállítás, alapértelmezés: „AutoGroweHome”; `includes/Admin/Admin.php`).

WP-CLI-vel ugyanez:

```bash
wp plugin install /útvonal/autogrowehome.zip --activate
```

A plugin mappaneve `autogrowehome`, a fordítások helye `languages/` (`Domain Path: /languages`).

---

## 3. Mit hoz létre az aktiválás?

Az aktiválást az `Installer::activate()` végzi (`includes/Installer.php`).

### 3.1 Adatbázistáblák (13 db, előtag: `{$wpdb->prefix}agh_`)

| Tábla | Tartalom |
|---|---|
| `agh_projects` | Projektek (konfiguráció, állapot, tulajdonos/vendégkulcs-hash, IP-hash, mentett jelző) |
| `agh_concepts` | A három koncepció (A/B/C) leírása és épületmodellje |
| `agh_assets` | Látványtervek, tervvázlatok, dokumentumok metaadatai (felbontás, szolgáltató, költség, teszt-jelző, hozzáférési szint) |
| `agh_jobs` | Aszinkron feladatsor (prioritás, próbálkozás, zárolás) |
| `agh_quotes` | Ajánlatkérések, állapotuk és címzettenkénti kézbesítési állapot (`recipients`) |
| `agh_consents` | Hozzájárulási és továbbítási napló (dokumentumverzióval; opcionálisan user agent) |
| `agh_rate` | Napi keret- és visszaélés-számlálók (IP csak hash-ként) |
| `agh_stats` | Napi összesített statisztika |
| `agh_logs` | Napló |
| `agh_prompt_versions` | Promptverziók |
| `agh_catalog` | Katalógus (tetőfedés, anyagok, színek, stílusok, presetek) |
| `agh_access` | Kivitelezői hozzáférési tokenek (hash-elve, címzetthez kötve) |
| `agh_ledger` | Költségnapló (becsült költség szolgáltatónként) |

Az adatbázis-verzió (`agh_db_version` opció) jelenleg **5** (`AGH_DB_VERSION`, `autogrowehome.php`; a 4-es verzió új oszlopai: `quotes.recipients`, `consents.user_agent`, `access.recipient`; az 5-ös verzió egyszer újratitkosítja a régi formátumú tárolt kulcsokat – `Installer::upgrade_data()`, `Secrets::upgrade_storage()`). Minden betöltéskor az `Installer::maybe_upgrade()` lefuttatja a migrációt, ha a tárolt verzió régebbi.

### 3.2 Szerepkörök és jogosultságok

| Szerepkör | Jogosultságok |
|---|---|
| **Adminisztrátor** (meglévő) | megkapja: `agh_manage`, `agh_view_projects`, `agh_view_stats`, `agh_view_packages` |
| **AutoGroweHome projektkezelő** (`agh_manager`, új) | `read`, `agh_view_projects`, `agh_view_stats`, `agh_view_packages` |
| **AutoGroweHome kivitelező** (`agh_contractor`, új) | `read`, `agh_view_packages` |

Részletes jogosultsági leírás: `docs/ADMIN-KEZIKONYV.md`.

### 3.3 Opciók és egyéb adatok

- `agh_settings` – az összes beállítás alapértékekkel (`includes/Support/Settings.php`).
- `agh_private_suffix` – a védett könyvtár véletlen utótagja.
- `agh_catalog_seeded` – a katalógus egyszeri feltöltésének jelzője; a feltöltés: 2 tetőfedési márka (BRAMAC – a specifikáció szerint kötelező, nem rejthető és nem törölhető –, Egyéb), **29 BRAMAC termék–szín** (ellenőrzött jelölés nélkül), 7 anyag, 6 színkollekció, 16 stíluscsomag (az „Egyedi stílus” rejtett), 2 preset (`includes/Catalog/Catalog.php`, `seed()`). Admin-szerkesztést nem ír felül.
- Promptmotor: „Gyári alapértelmezés” nevű promptverzió, aktívként (`includes/Prompt/PromptEngine.php`, `seed()`). Ha az aktív verzió egy érintetlen gyári alapértelmezés, frissítéskor a plugin automatikusan új gyári verzióra vált; szerkesztett verzióhoz nem nyúl.
- `agh_activated_at` – aktiválás időpontja.
- Futás közben a plugin segédopciókat is létrehoz (pl. `agh_poll_tick`, `agh_job_slot_<n>` – a feladatfeldolgozás zárolásához, `includes/Generation/JobQueue.php`).

### 3.4 Védett tárhely

Alapértelmezett helye: `<feltöltési könyvtár>/agh-private-<16 véletlen kisbetű/szám>/` (`includes/Support/Storage.php`). Létrehozáskor bekerül:

| Fájl | Szerep |
|---|---|
| `.htaccess` | Apache: `Require all denied` / `Deny from all`, `Options -Indexes` |
| `web.config` | IIS: minden felhasználó tiltva |
| `index.php` | 403-as választ ad |
| `index.html` | üres |
| `agh-probe.txt` | az önellenőrzés tesztfájlja |

A generált képek, tervvázlatok és ZIP-csomagok kizárólag jogosultság-ellenőrző REST-végponton keresztül kerülnek kiszolgálásra (`/wp-json/agh/v1/assets/{uuid}/file`, `/wp-json/agh/v1/contractor/package/{uuid}` – `includes/Rest/RestController.php`).

### 3.5 Ütemezett események

| Esemény | Gyakoriság | Feladat |
|---|---|---|
| `agh_cron_queue` | percenként (saját `agh_minute` ütemezés) | Feladatsor feldolgozása, max. 45 s (`includes/Plugin.php`) |
| `agh_cron_daily` | naponta | Licencellenőrzés (`includes/Plugin.php`) **és** adatmegőrzési takarítás (`includes/Privacy/Privacy.php`) |
| `agh_process_queue_now` | egyszeri, igény szerint | Azonnali feldolgozás generálás / ajánlatkérés után (`includes/Generation/JobQueue.php`) |

Ha az ütemezés elveszne (pl. költözéskor), a plugin minden betöltéskor újraütemezi (`includes/Plugin.php`).

---

## 4. A tervező elhelyezése az oldalon

A plugin **nem regisztrál Gutenberg-blokkot**; a shortcode-okat a „Shortcode” blokkal vagy bármely szerkesztőben használhatod.

| Shortcode / mód | Mit csinál | Forrás |
|---|---|---|
| `[autogrowehome]` | Indítógomb, amely a tervező popupot nyitja. Paraméter: `label="…"` (egyedi felirat). | `includes/Frontend/Frontend.php` (`sc_designer`) |
| `[autogrowehome_button]` | Az `[autogrowehome]` másik neve (azonos működés). | `sc_button` |
| `[autogrowehome_faq]` | Interaktív GYIK kereséssel és kategóriákkal (tartalma: Súgó és rendszer → GYIK). | `sc_faq`, `templates/faq.php` |
| `[autogrowehome_pricing]` | Csomag-/árazási oldal a csomagadatokból. | `sc_pricing`, `templates/pricing.php` |
| `[autogrowehome_portal]` | Kivitelezői portál egy tetszőleges oldalba ágyazva. | `sc_portal`, `templates/portal.php` |
| `/?agh-portal=1` | Önálló kivitelezői portáloldal (téma nélkül, `noindex`, `Referrer-Policy: no-referrer`). Az e-mailben küldött hivatkozás ide mutat. | `maybe_portal`, `templates/portal-page.php` |
| Lebegő gomb | `general.floating_button` = be (alapértelmezés): minden frontend-oldalon megjelenik egy lebegő indítógomb. | `footer()`, `assets/js/agh-loader.js` |

**Saját elemről indítás.** Ott, ahol a betöltő jelen van – a lebegő gomb bekapcsolásakor minden oldalon, egyébként az `[autogrowehome]` shortcode-ot tartalmazó oldalakon –:

- bármely elem `data-agh-open="1"` attribútummal kattintásra megnyitja a tervezőt;
- JavaScriptből: `window.AGH_open()`;
- az `#agh-open` horgony megnyitja a tervezőt: oldalbetöltéskor, a címsor horgonyának változásakor és az azonos oldalon lévő `<a href="#agh-open">` linkre kattintáskor is (`assets/js/agh-loader.js`).

**Teljesítmény:** a frontend-oldalakra csak a betöltő kerül; a tervező CSS/JS csomagja az első megnyitáskor töltődik be (`includes/Frontend/Frontend.php`, `assets/js/agh-loader.js`).

---

## 5. Háttérfeldolgozás (cron és feladatsor)

### 5.1 Hogyan fut a feldolgozás?

A generálás aszinkron feladatsorral működik (`includes/Generation/JobQueue.php`). Feldolgozót indít:

1. **WP-Cron** `agh_cron_queue` percenként (45 s időkerettel);
2. **loopback** azonnal generálási / ajánlatkérési kérés után (`spawn_cron()`, csak ha a WP-Cron nincs letiltva);
3. **állapotlekérdezés:** ha `general.queue_tick_on_poll` be van kapcsolva (alapértelmezés), a látogató projekt-lekérdezése legfeljebb 8 s feldolgozást futtathat. Ezt webhelyszinten egy atomikus zár szabályozza: egyszerre csak egy ilyen futás lehet, a következő az előző befejezése után kb. 5–6 másodperccel indulhat; elakadás esetén a zár az időkeret + 5 s után lejár (`JobQueue::poll_tick()`);
4. **WP-CLI:** `wp agh queue run`.

Az egyszerre feldolgozott feladatok száma webhelyszinten legfeljebb `limits.max_parallel_jobs` (alapértelmezés 4; 0 = korlátlan). Egy feladat zárja a beállított időkorlátokból számolódik (alapértékekkel 513 s, mérve), így egy elakadt feldolgozó feladatát ennyi idő után más veheti át (`JobQueue::lock_seconds()`).

A WP-Cron alapesetben csak oldalletöltéskor fut, ezért éles, forgalmas oldalon **valódi rendszer-cron** javasolt.

### 5.2 Ajánlott beállítás: rendszer-cron + `DISABLE_WP_CRON`

`wp-config.php`:

```php
define( 'DISABLE_WP_CRON', true );
```

**Fontos:** a napi licencellenőrzés és az adatmegőrzési takarítás (`agh_cron_daily`) **csak WP-Cron eseményként** fut. Ha letiltod a WP-Cront, a rendszer-cronnak a WordPress esedékes eseményeit is futtatnia kell – önmagában a `wp agh queue run` ezt nem pótolja.

Javasolt crontab (a WordPress gyökerében, a webszerver felhasználójával):

```cron
# WordPress-események (köztük agh_cron_queue és agh_cron_daily) – percenként
* * * * * cd /var/www/example.hu && wp cron event run --due-now --quiet

# Opcionális, nagy forgalomnál: külön AutoGroweHome-feldolgozó 50 s kerettel
* * * * * cd /var/www/example.hu && wp agh queue run --seconds=50 --quiet
```

WP-CLI nélkül az első sor helyettesíthető:

```cron
* * * * * curl -fsS https://example.hu/wp-cron.php?doing_wp_cron >/dev/null 2>&1
```

A párhuzamosan futó feldolgozók nem dolgozzák fel kétszer ugyanazt a feladatot (atomi zárolás: `JobQueue::claim()`), és együtt sem lépik túl a `limits.max_parallel_jobs` értéket.

`DISABLE_WP_CRON` mellett a loopback-indítás kimarad (`JobQueue::spawn()`), így a feldolgozás a rendszer-cronra és az állapotlekérdezésre támaszkodik – a rendszer-cron tehát ilyenkor **kötelező**.

### 5.3 WP-CLI parancsok (`includes/Cli/Command.php`)

| Parancs | Leírás |
|---|---|
| `wp agh queue run [--seconds=<mp>]` vagy `wp agh queue [--seconds=<mp>]` | Feladatsor feldolgozása; alapértelmezett időkeret 50 s. Kimenet: feldolgozott és függő feladatok száma. |
| `wp agh status` | Képszolgáltató (és `TEST MODE` jelzés), Anthropic állapota, függő feladatok száma. |
| `wp agh retention` | Adatmegőrzési takarítás azonnali futtatása. |

### 5.4 Ellenőrzés

```bash
wp agh status
wp cron event list | grep agh_
```

Az adminban: **Vezérlőpult** → „Feladatsor: N függő feladat” kártya és „Feladatsor futtatása most” gomb; **Súgó és rendszer** → „WP-Cron” és „Függő feladatok” sor. Ha a függő feladatok száma tartósan nem csökken, a cron nem fut.

---

## 6. Védett tárhely – webszerver-beállítás

### 6.1 Apache és IIS

Az `.htaccess` (Apache) és a `web.config` (IIS) a könyvtár létrehozásakor automatikusan elkészül (3.4). Apache-on ez csak akkor hat, ha az `AllowOverride` engedi.

### 6.2 Nginx

Az Nginx nem veszi figyelembe az `.htaccess`-t. Ha a plugin azt észleli, hogy a tesztfájl HTTP-n elérhető, **hibaüzenetet** ad: „A védett tárhely könyvtár HTTP-n keresztül elérhető!…” (`includes/Admin/Admin.php`). Tiltás a `server {}` blokkba, a többi `location` elé:

```nginx
# AutoGroweHome védett tárhely – közvetlen elérés tiltása
location ^~ /wp-content/uploads/agh-private- {
    deny all;
    return 403;
}
```

A `^~` előtag-egyezés megakadályozza, hogy egy képfájlokra vonatkozó regex-`location` előbb illeszkedjen. Ha a feltöltési könyvtár nem a `/wp-content/uploads/`, igazítsd az útvonalat. Az utótag lekérdezése:

```bash
wp option get agh_private_suffix
```

### 6.3 Ellenőrzés curl-lel

```bash
SUFFIX=$(wp option get agh_private_suffix)
curl -s -o /dev/null -w '%{http_code}\n' "https://example.hu/wp-content/uploads/agh-private-${SUFFIX}/agh-probe.txt"
```

Elvárt eredmény: **403** vagy **404**. Ha **200**, a könyvtár nyilvános – javítsd a webszerver-beállítást, vagy használd az `AGH_PRIVATE_DIR` konstanst.

Az admin önellenőrzése: **Súgó és rendszer** → „Tárhely nyilvános?” sor (minden megnyitáskor élőben fut). A vezérlőpulti figyelmeztetés eredményét a plugin 1 órára gyorsítótárazza (`agh_storage_health` tranziens).

### 6.4 Tárhely a webgyökéren kívül: `AGH_PRIVATE_DIR`

A legbiztosabb megoldás, ha a fájlok egyáltalán nincsenek a webgyökér alatt:

```php
// wp-config.php – a "That's all, stop editing!" sor ELÉ
define( 'AGH_PRIVATE_DIR', '/var/lib/autogrowehome/example.hu/' );
```

- Abszolút útvonal legyen, a PHP-folyamat számára írható; a záró `/`-t a plugin pótolja.
- Ilyenkor nincs nyilvános URL, az önellenőrzés eredménye „Custom path outside web root.” (`includes/Support/Storage.php`).
- **Meglévő telepítés átállítása:** a fájlok útvonala relatívan van tárolva, ezért a korábbi `agh-private-<utótag>/` könyvtár **tartalmát át kell másolni** az új helyre, különben a régi képek és csomagok „File missing” hibát adnak.
- Eltávolításkor egyedi könyvtárban csak a plugin saját tartalma törlődik (11. fejezet).

---

## 7. `wp-config.php` konstansok

Mindegyiket a `require_once ABSPATH . 'wp-settings.php';` sor **előtt** kell definiálni.

| Konstans | Hatás | Forrás |
|---|---|---|
| `AGH_PRIVATE_DIR` | Védett tárhely egyedi (webgyökéren kívüli) útvonala. | `includes/Support/Storage.php` |
| `AGH_SECRET_SALT` | **Ajánlott.** Ha definiálva és nem üres, a tárolt API- és licenckulcsok titkosítókulcsa kizárólag ebből képződik, így a WordPress-sók cseréje nem érinti őket. | `includes/Support/Secrets.php` |
| `AGH_OWNER_MODE` | Tulajdonosi mód: minden funkció licencellenőrzés nélkül engedélyezett, és csak ilyenkor szerkeszthető a csomagmátrix. Csak arra jogosult telepítésen használd. | `includes/License/Features.php` |
| `AGH_LICENSE_SERVER` | Licencszerver HTTPS URL-je; megadva az admin mező csak olvasható. | `includes/License/LicenseManager.php` |
| `AGH_LICENSE_PUBKEY` | Licencszerver Ed25519 nyilvános kulcsa (base64); megadva az admin mező csak olvasható. | `includes/License/LicenseManager.php` |
| `AGH_MAGNIFIC_API_KEY` | Magnific API-kulcs; elsőbbséget élvez az adminban tárolt kulccsal szemben, az admin mező ilyenkor nem szerkeszthető. Az admin felület maga is ezt javasolja. | `includes/Support/Secrets.php`, `includes/Admin/Pages.php` |
| `AGH_ANTHROPIC_API_KEY` | Anthropic API-kulcs, ugyanígy. | `includes/Support/Secrets.php` |
| `AGH_LICENSE_KEY` | Licenckulcs, ugyanígy. | `includes/Support/Secrets.php` |

> **Figyelem – sók cseréje.** Az adminban tárolt (titkosított) kulcsok titkosítókulcsa (`Secrets::key()`): ha az `AGH_SECRET_SALT` definiálva van, **csak abból** képződik; ha nincs, az `AUTH_SALT` + `SECURE_AUTH_SALT` értékekből. Következmények: `AGH_SECRET_SALT` nélkül a WordPress-sók cseréje után a tárolt kulcsok nem fejthetők vissza (üresnek látszanak, újra meg kell adni őket); `AGH_SECRET_SALT` mellett a WordPress-sók cseréje nem érinti őket, viszont magának az `AGH_SECRET_SALT`-nak a megváltoztatása után nem fejthetők vissza. Ha az `AGH_SECRET_SALT`-ot utólag adod meg, a meglévő kulcsok olvashatók maradnak, és olvasáskor az új kulccsal újratitkosulnak. A WordPress-sók cseréje ezen felül érvényteleníti a vendég-projektsütiket (`LOGGED_IN_SALT`), a kivitelezői tokeneket (`SECURE_AUTH_SALT`), a napi keret IP-hash-eit és az ajánlatkérő űrlap tokenjeit (`NONCE_SALT`), és megváltoztatja a Magnific webhook titkos URL-részét (`AUTH_SALT`; ezt a plugin minden kérésnél automatikusan az aktuális értékkel küldi). Konstansban megadott kulcsokat ez nem érinti.

---

## 8. Megbízható proxyk és a napi IP-keret

A napi generálási keret IP-címhez kötött (`includes/RateLimit/RateLimiter.php`). A látogató IP-jét az `includes/Support/Ip.php` határozza meg:

- alapból a `REMOTE_ADDR` értéket használja;
- a továbbított fejlécet (alapértelmezés: `X-Forwarded-For`) **csak akkor** veszi figyelembe, ha a `REMOTE_ADDR` szerepel a megbízható proxyk listáján; a láncot jobbról balra járja be, és az első nem megbízható címet tekinti a látogatónak;
- a keret kulcsa IPv4-nél a teljes cím, IPv6-nál a **/64 előtag** (egy előfizetői hálózat jellemzően egy teljes /64-et kap); az IPv4-be ágyazott IPv6 cím IPv4-ként számít;
- az IP-t csak kulcsolt hash-ként tárolja.

**Beállítás helye:** Admin → **Limitek és hozzáférés** → „Megbízható proxyk / CDN (IP vagy CIDR)” (`limits.trusted_proxies`; szóközzel, vesszővel vagy új sorral elválasztva) és „Továbbított IP fejléc” (`limits.proxy_header`).

| Helyzet | Teendő |
|---|---|
| Nincs proxy/CDN | Hagyd üresen. |
| Helyi fordított proxy / terheléselosztó | Add meg a proxy IP-jét/CIDR-jét; fejléc: `X-Forwarded-For`. |
| Cloudflare | Add meg a Cloudflare aktuális IP-tartományait; fejléc: `CF-Connecting-IP` (az admin súgószövege is ezt javasolja). |

Proxy mögött beállítás nélkül minden látogató a proxy IP-jét kapja, így **közös napi kereten osztoznak**. Az aktuális állapotot a Limitek oldal tetején látod: „Aktuális napi időszak … effektív IP-limit … saját IP ma: …”.

---

## 9. Multisite

A kód nem tartalmaz multisite-specifikus kezelést (hálózati aktiválás, oldalankénti táblalétrehozás). Multisite-on nem tesztelt.

---

## 10. Frissítés

- **Automatikus frissítés** csak érvényes, frissítésre jogosult licenccel és beállított HTTPS licencszerverrel érhető el; a WordPress szokásos frissítési felületén jelenik meg (`includes/License/LicenseManager.php`, `filter_updates`). A licenc- és frissítési hívások nem követnek átirányítást; a csomagletöltésnél a licenckulcs csak fejlécben (`X-AGH-License`) utazik, csak a licencszerver csomag-végpontjára. A letöltött csomagot a plugin telepítés előtt a szerver által aláírt SHA-256 értékkel veti össze; eltérésnél a frissítés hibával leáll (`LicenseManager::pre_download()`).
- **Kézi frissítés:** Bővítmények → Új hozzáadása → Bővítmény feltöltése → az új ZIP; a WordPress felajánlja a telepített verzió cseréjét a feltöltöttre.
- Az adatbázis-migráció a következő oldalbetöltéskor automatikusan lefut (`Installer::maybe_upgrade()`).
- Deaktiváláskor csak az ütemezett események törlődnek, az adatok megmaradnak (`Installer::deactivate()`).
- Frissítés előtt készíts mentést az adatbázisról **és** a védett tárhelyről.

---

## 11. Eltávolítás

| Művelet | Mi történik | Forrás |
|---|---|---|
| **Deaktiválás** | Törlődnek az ütemezett események (`agh_cron_queue`, `agh_cron_daily`, `agh_process_queue_now`). Adat nem törlődik. | `includes/Installer.php` |
| **Törlés**, ha „Minden adat törlése a plugin eltávolításakor” **ki** van kapcsolva (alapértelmezés) | Törlődnek az ütemezett események és a plugin gyorsítótár-tranziensei (`_transient_agh_*`, `_site_transient_agh_*`). Projektek, ajánlatkérések, beállítások, fájlok megmaradnak egy későbbi újratelepítéshez. | `uninstall.php` |
| **Törlés**, ha az opció **be** van kapcsolva (Admin → Jogi és GDPR → Eltávolítás) | A fentieken túl törlődik: a védett tárhely (lent), mind a 13 tábla, minden `agh_` kezdetű opció, a két plugin-szerepkör, az adminisztrátor plugin-jogosultságai és a felhasználói `agh_presets` metaadatok. | `uninstall.php`, `Installer::drop_all()` |

**Fájlok törlése:**

- Alapértelmezett tárhely (`uploads/agh-private-<utótag>/`): a teljes könyvtár törlődik.
- Egyedi `AGH_PRIVATE_DIR`: csak a plugin saját tartalma törlődik – az UUID-nevű projektmappák, az `agh-probe.txt`, valamint a védőfájlok (`.htaccess`, `web.config`, `index.php`, `index.html`), de ezek csak akkor, ha a tartalmuk pontosan a plugin által írt tartalom. A könyvtár maga és más fájljai megmaradnak.

---

## 12. Következő lépések

1. Állítsd be a kulcsokat és a működési módot: `docs/KONFIGURACIO.md`.
2. Ismerd meg az admin felületet: `docs/ADMIN-KEZIKONYV.md`.
3. Élesítés előtt menj végig: `docs/TELEPITES-UTANI-ELLENORZOLISTA.md`.
4. Kiinduló beállításcsomagok: `docs/MINTA-KONFIGURACIOK.md`.
