# ALLAPOT – AutoGroweHome (frissítve: 2026-10-13)

**Verzió:** ügyfélplugin 1.6.0 (dist/autogrowehome-1.6.0.zip: erkélyek, napelem szabad tetőrészeken, autók/emberek/állatok, bővebb belső tér, saját fotó, gyorsabb 3D; 1.5.0 profi belső terek; 1.4.0 belső nézet) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, tesztoldal `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 1996 szöveg, 0 hiba · vázlat 1247 rajz, 600 kert, 0 hiba · felületi lefedettség 153 mező (63 látszik a 2D-n), 2D és 3D 0 hiba, konzol 0 · responsive, wizard, gen E2E rendben · 342 tárgykártya, 200 véletlen szoba, 512 ház- és 600 vázlatváltozat az új beállításokkal, 0 hiba · napelem: 384 tetőváltozat, 0 kilógó modul · SwiftShaderen 1.5.0 → 1.6.0: bútorkártyák 20–24 s → 15–18 s (újbóli látogatás 5,5–10 s), fürdőkártyák 7,6–11 s → 4,0–7,4 s · Licencközpont 40/40.

**Döntések**
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; stílusonként tömegforma, szintszám, tető, anyag javaslat (Catalog::style_seed).
- Közös terv az `agh-sketch.js`-ben, a 3D ugyanebből épít: volumes, _solarFaces (napelem modulok a tetősíkon belül), _balconies/_balcMark (erkély + ajtók), _garden (növények, járművek, emberek, állatok), _pool, _terrace, _plot.
- Előnézet 3D (three.js r170), 2D csak tartalék. Sebesség: egy WebGL-környezet, kártyaképek IndexedDB-ben, modul-előtöltés, árnyaló-előfordítás, mergeStatic, textúrák 4 workerben.
- Belső tér: agh-3d-int.js (tárgyépítők, szobák, `itemScene` kártyaképek; `pick()` = „auto” a stílus szerint); további bútorok a falak szabad szakaszaira (hátsó, bal, jobb fal). Mezőn `'visual' => 'item'` = képes kártya. Új mezőtípus: `image` (saját fotó, ≤ 400 000 karakteres data URL, csak 3D-ben).
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező. Licenc nélkül Starter: a beállítások egy része látszik.

**Nyitott tételek**
- Kézi szöveg külön a külsőhöz és a belsőhöz, beépítve a promptba.
- Licencközpont telepítése Norbi oldalára → szerver URL + nyilvános kulcs az ügyfélpluginba.
- htombau: 1.6.0 telepítése; 3D sebesség telefonon (valódi GPU-n nem mérve); Magnific/Anthropic kulcs, éles végigteszt.
- GitHub repó NYILVÁNOS → privátra. Fordítások lektorálása (új: járművek, erkély, belső tárgyak).
- Fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron teszt.
