=== AutoGroweHome ===
Contributors: infostudio
Tags: house designer, ai, configurator, quote request, construction
Requires at least: 6.2
Tested up to: 7.2
Requires PHP: 8.0
Stable tag: 1.11.1
License: Commercial
License URI: https://infostudio.hu/autogrowehome

AI-alapú háztervező és kivitelezői ajánlatkérő: három házkoncepció, galériák, méretezett tervvázlatok, védett kivitelezői csomag.

== Description ==

A látogató egy popupban megadja az álomháza paramétereit, a rendszer kérésenként három eltérő koncepciót készít (AI-látványterv + determinisztikus, méretezett tervvázlat), a kiválasztott házhoz galériát generál, majd a látogató mentheti a projektet vagy ajánlatot kérhet. Az ajánlatkérésből védett kivitelezői csomag (ZIP) és e-mail-értesítés készül.

* Képgenerálás: Magnific (saját API-kulccsal), tervezés/értelmezés: Anthropic (opcionális, saját kulccsal), helyi teszt mód jelölt vázlatképekkel.
* A látványtervek MI-vel készült koncepciók; a tervvázlatok nem engedélyezési vagy kiviteli tervek.
* 16 nyelv, GDPR-eszközök, IP-alapú napi keret, kereskedelmi licencmodul.

Részletes dokumentáció: a csomag `docs/` mappája (magyarul).

== Installation ==

1. Bővítmények → Új hozzáadása → Bővítmény feltöltése → `autogrowehome-1.0.0.zip`, majd Bekapcsolás.
2. Követelmények: PHP 8.0+, kiterjesztések: mbstring, sodium, gd, zip, json.
3. AutoGroweHome → Beállítások: Magnific API-kulcs (vagy teszt mód), opcionálisan Anthropic-kulcs; kivitelezői e-mail-címek; jogi dokumentumok.
4. Tedd az `[autogrowehome]` shortcode-ot egy oldalra, vagy kapcsold be a lebegő indítógombot.
5. Éles üzem előtt: `docs/TELEPITES-UTANI-ELLENORZOLISTA.md`.

== Frequently Asked Questions ==

= Kell API-kulcs? =
Éles képgeneráláshoz Magnific API-kulcs kell (saját előfizetés, saját költség). Kulcs nélkül teszt módban kipróbálható: ekkor a képek helyi, jelölt vázlatok.

= 4K-s képeket ad? =
Csak akkor jelöli 4K-nak, ha a kép tényleges felbontása eléri azt; egyébként a valós felbontást írja ki.

= Mi történik, ha lejár a licenc? =
A projektek és beállítások megmaradnak; a prémium funkciók kikapcsolnak, a Starter szint működik tovább.

További kérdések: `docs/GYIK.md`.

== Harmadik féltől származó összetevők ==

* three.js r170 (MIT licenc) – a 3D élő előnézethez: `assets/js/vendor/three/` (licenc: `assets/js/vendor/three/LICENSE`).

== Changelog ==

= 1.11.1 =
* A Klón nem halucinál: egy épület, tiltott pajta és melléképület, kötött kameraállás.
* A tető színe a 3D modellt követi, nem a termék szövegét.
* A vezetőkép képaránya a kész képéhez igazodik (a plugin megméri).
* Részletek: CHANGELOG.md.

= 1.11.0 =
* Új „Hűség a 3D modellhez” kapcsoló: Szabad / Kiegyensúlyozott / Hű / Klón / Egyedi.
* A prompt megmondja a képmodellnek, hogy a referenciakép a ház pontos tömege.
* Részletek: CHANGELOG.md.

= 1.10.0 =
* A koncepcióképek a látogató 3D modelljét követik (structure reference a saját kameraállásból).
* A vezetőképek a védett tárhelyre kerülnek, a generálást nem lassítják.
* Teszt módban a generált kép maga a 3D vezetőkép.
* Részletek: CHANGELOG.md.

= 1.9.2 =
* A védett tárhely figyelmeztetése megmondja a pontos megoldást (wp-config vagy Nginx).
* Új gomb: „Ellenőrzés újra” és „Fájlok áthozása” az új, védett helyre.
* Részletek: CHANGELOG.md.

= 1.9.1 =
* Tárgyak megfogása és elforgatása egérrel a belső nézetben, helyiségenként mentve.
* Városi utcasor: sorházak, városi háttér, kevesebb fa.
* A helyiségenkénti részletek a 3D nézetben is látszanak.
* Részletek: CHANGELOG.md.

= 1.9.0 =
* Részletek: CHANGELOG.md.

= 1.8.1 =
* Részletek: CHANGELOG.md.

= 1.8.0 =
* Részletek: CHANGELOG.md.

= 1.7.0 =
* Részletek: CHANGELOG.md.

= 1.6.0 =
* Részletek: CHANGELOG.md.

= 1.5.0 =
* Részletek: CHANGELOG.md.

= 1.4.0 =
* Részletek: CHANGELOG.md.

= 1.3.3 =
* Részletek: CHANGELOG.md.

= 1.3.2 =
* Részletek: CHANGELOG.md.

= 1.3.1 =
* Részletek: CHANGELOG.md.

= 1.3.0 =
* Részletek: CHANGELOG.md.

= 1.2.0 =
* Részletek: CHANGELOG.md.

= 1.1.2 =
* Részletek: CHANGELOG.md.

= 1.1.1 =
* Részletek: CHANGELOG.md.

= 1.1.0 =
* Részletek: CHANGELOG.md.

= 1.0.1 =
* Részletek: CHANGELOG.md.

= 1.0.0 =
* Első kiadás. Részletek: CHANGELOG.md.
