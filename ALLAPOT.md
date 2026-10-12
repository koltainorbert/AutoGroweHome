# ALLAPOT – AutoGroweHome (frissítve: 2026-10-12, éjjel)

**Verzió:** ügyfélplugin 1.1.0 (dist/autogrowehome-1.1.0.zip: stílusvezérelt modell, új homlokzatok, helyiségenkénti burkolat) · Licencközpont 1.0.0 (dist/agh-license-hub-1.0.0.zip, license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, tesztoldal `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 1616 szöveg, 0 hiba · vázlat 1017 rajz, 0 hiba · felületi lefedettség 115 mező (2D+3D), 0 hiba · E2E mobil/asztal, varázsló (6 méret), generálás: hiba 0 · beragadt projekt 9/9 · leállítás (kártyák fölött is) OK · vászon = doboz minden képkockán · Licencközpont 40/40.

**Döntések**
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, a központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = központi licencszerver Norbi saját HTTPS-oldalára. API: Ed25519-aláírt {data, signature}, 14 nap türelmi idő.
- Saját oldalon licenc nélkül: wp-config `define( 'AGH_OWNER_MODE', true );` – ügyféloldalra soha.
- Varázsló: 1. lépés a stílus; a stílus javaslatai (Catalog::style_seed) minden nem saját paraméterre vonatkoznak; DB v6 csak érintetlen stílust frissít.
- Előnézet 3D (agh-3d.js, three.js r170); töltés közben semleges töltőkép, 2D csak tartalék (nincs WebGL2 / hiba / 15 s).
- Burkolat: fő padló + hálók/konyha/előtér/vizes külön („mint a fő padló”); a prompt helyiségtípus szerint választ (PromptEngine::room_floor).
- Forrásnyelv magyar, 16 nyelv, bin/po-tools.py; Windows-kompatibilis útvonalak („/”).
- Sor: feladatonként set_time_limit + ignore_user_abort; feladat nélküli futó projekt 2 perc után lezárul; kliens-kérések 45 s időkorlát.
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező; csomagmátrix csak tulajdonosi módban.

**Nyitott tételek**
- Licencközpont telepítése Norbi HTTPS-oldalára → Szerver URL + nyilvános kulcs beépítése az ügyfélpluginba, hogy az ügyfél csak a kulcsot írja be; az ügyfél admin súgószövege még a régi tools/license-server-re mutat.
- htombau: 1.1.0 telepítése; „A kép nem készült el” oka most a kártyán látszik (tulajdonosnak) → javítani; 3D sebesség telefonon.
- Magnific (és Anthropic) API-kulcs az adminban, éles végigteszt.
- GitHub: a repó NYILVÁNOS – privátra; számlázási zár (Actions).
- 3D: fák és autó finomítása; belső burkolat csak kártyán és promptban (a házmodellben nincs belső tér); fordítások lektorálása.
- Fizetés → automatikus kulcskiadás (webhook) nincs; BRAMAC-katalógus és jogi szövegek véglegesítése; MySQL/SMTP/éles cron teszt.
