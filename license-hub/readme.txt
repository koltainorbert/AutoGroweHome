=== AGH Licencközpont ===
Contributors: infostudio
Requires at least: 6.2
Requires PHP: 8.0
Stable tag: 1.0.0
License: Commercial

Az AutoGroweHome központi licencszervere. Csak a forgalmazó (Infostudio) saját, HTTPS-es WordPress-oldalára telepítendő – az ügyfelek oldalára nem.

== Mit tud? ==

* Licenckulcs kiadása egy kattintással (AGH-XXXXX-XXXXX-XXXXX-XXXXX): ügyfél, e-mail, csomag (Starter / Professional / Agency), havi / éves / örökös, lejárat, weboldal-limit, frissítési jogosultság.
* Kulcs megjelenítése, másolása, e-mailben küldése az aktiválási lépésekkel.
* Aktivált weboldalak listája (cím, pluginverzió, utolsó ellenőrzés), hely felszabadítása.
* Hosszabbítás egy kattintással, visszavonás, újraengedélyezés, törlés.
* Kiadások: AutoGroweHome-ZIP feltöltése – a jogosult oldalak a WordPress-frissítések között kapják meg (SHA-256-tal ellenőrizve).
* Napló az utolsó kérésekről (IP-cím csak kivonatként).

== Kapcsolódás ==

Beállítás menü: Szerver URL (pl. https://infostudio.hu/wp-json/aghls) és nyilvános kulcs. Ezt a kettőt kell az AutoGroweHome pluginnak megadni (Licenc → Licencszerver), vagy a wp-config.php-ba:

  define( 'AGH_LICENSE_SERVER', 'https://…/wp-json/aghls' );
  define( 'AGH_LICENSE_PUBKEY', '…' );

== Biztonság ==

* Minden válasz Ed25519-cel aláírt; a plugin csak az aláírt, saját kérésére (nonce, példányazonosító, ±10 perc) adott választ fogadja el.
* A licenckulcsokat HMAC-kivonattal keresi, és titkosítva tárolja; az aláíró titkos kulcs is titkosítva van (vagy wp-config: AGHLS_SECRET_KEY, AGHLS_PEPPER).
* A feltöltött kiadások csak az API-n keresztül, érvényes licenccel tölthetők le (a fájlnév véletlenszerű, a mappa tiltott).
* Az adatbázis mentése fontos: a titkos kulcs elvesztése után minden ügyféloldalra új nyilvános kulcs kell.

== Changelog ==

= 1.0.0 =
* Első kiadás: licenckulcsok, aktiválások, weboldal-limit, hosszabbítás, visszavonás, e-mail, kiadások (frissítések), napló, Ed25519-aláírt API.
