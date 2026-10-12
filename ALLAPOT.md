# ALLAPOT – AutoGroweHome (frissítve: 2026-10-12, este)

**Verzió:** ügyfélplugin 1.0.1 (dist/autogrowehome-1.0.1.zip: beragadó generálás javítva) · Licencközpont 1.0.0 (dist/agh-license-hub-1.0.0.zip, license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, tesztoldal `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 1595 szöveg · vázlat 1017 rajz, 0 hiba · felületi lefedettség 116 mező (2D+3D) · E2E mobil/asztal, varázsló, generálás: hiba 0 · Licencközpont 40/40 (valódi ügyfél-LicenseManagerrel) · beragadt projekt 9/9 · leállítás beragadt szervernél OK.

**Döntések**
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, a központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = központi licencszerver Norbi saját HTTPS-oldalára (admin felület: kulcs, aktiválások, hosszabbítás, visszavonás, e-mail, kiadások, napló). API: Ed25519-aláírt {data, signature}, 14 nap türelmi idő.
- Saját oldalon licenc nélkül: wp-config `define( 'AGH_OWNER_MODE', true );` – ügyféloldalra soha.
- Varázsló a kezdőnézet; előnézet 3D (agh-3d.js, three.js r170), tartalék és változásjelzés 2D (agh-sketch.js).
- Forrásnyelv magyar, 16 nyelv, bin/po-tools.py; Windows-kompatibilis útvonalak („/”).
- Sor: feladatonként set_time_limit + ignore_user_abort; poll FPM/LiteSpeed alatt a válasz után; feladat nélküli futó projekt 2 perc után lezárul; kliens-kérések 45 s időkorlát.
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező; csomagmátrix csak tulajdonosi módban.

**Nyitott tételek**
- Licencközpont telepítése Norbi HTTPS-oldalára → Szerver URL + nyilvános kulcs beépítése az ügyfélpluginba (1.0.1), hogy az ügyfél csak a kulcsot írja be; az ügyfél admin súgószövege még a régi tools/license-server-re mutat.
- htombau: 1.0.1 telepítése; a képhiba („A kép nem készült el”) okát az admin naplóból kiolvasni; 3D sebesség asztalon és telefonon.
- Magnific (és Anthropic) API-kulcs az adminban, éles végigteszt.
- GitHub: a repó NYILVÁNOS – privátra; számlázási zár (Actions).
- 3D: fák és autó finomítása; fordítások lektorálása; varázsló színminták 28 px.
- Fizetés → automatikus kulcskiadás (webhook) nincs; BRAMAC-katalógus és jogi szövegek véglegesítése; MySQL/SMTP/éles cron teszt.
