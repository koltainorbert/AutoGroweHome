# ALLAPOT – AutoGroweHome (frissítve: 2026-10-13)

**Verzió:** ügyfélplugin 1.7.0 (dist/autogrowehome-1.7.0.zip: tárgyak helyiségenként, önjavító berendezés, táj/domborzat a stílushoz, valódi szomszédházak, utca, Újrakezdés gomb; 1.6.0 erkély, napelem, autók/emberek/állatok; 1.5.0 profi belső terek) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, tesztoldal `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 2016 szöveg, 0 hiba · vázlat 1247 rajz, 600 kert, 0 hiba · felületi lefedettség 154 mező, 2D és 3D 0 hiba, konzol 0 · responsive, wizard, gen E2E rendben · 342 tárgykártya, 512 házváltozat, 0 hiba · 300 véletlen szoba / 628 tárgy: 0 kilógó, 0 ajtóban · táj első felépítése 120–215 ms, változás 15–57 ms (SwiftShader) · Licencközpont 40/40.

**Döntések**
- Norbi minden szövegéből először tökéletes prompt készül fájlba (`docs/FELADAT-<verzió>.md`), csak utána kezdődik a munka; a prompt semmit nem hagy ki és semmit nem vesz el a meglévőből.
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; stílusonként tömegforma, szintszám, tető, anyag javaslat (Catalog::style_seed).
- Közös terv az `agh-sketch.js`-ben, a 3D ugyanebből épít: volumes, _solarFaces (napelem modulok a tetősíkon belül), _balconies/_balcMark (erkély + ajtók), _garden (növények, járművek, emberek, állatok), _pool, _terrace, _plot.
- Előnézet 3D (three.js r170), 2D csak tartalék. Sebesség: egy WebGL-környezet, kártyaképek IndexedDB-ben, modul-előtöltés, árnyaló-előfordítás, mergeStatic, textúrák 4 workerben.
- Belső tér: agh-3d-int.js (tárgyépítők, szobák, `itemScene` kártyaképek; `pick()` = „auto” a stílus szerint). Látszó falak: hátsó + bal; jobb és első fal kivágott → oda nem kerül háttal semmi; önellenőrzés (szobán belül, ajtósáv szabad), `hs.room.fixes` → „Megoldva” üzenet. Tárgyak helyiségenként: `room_items` (mezőtípus `roomitems`), JS `_roomItems` = PHP `RoomProgram::item_rooms`.
- Környezet: agh-3d-land.js (domborzat, erdők, víz, utca, szomszédok); `landscape` mező, „auto” = stílus szerint (JS STYLE_LAND = PHP `Definitions::landscape_for_style`).
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező. Licenc nélkül Starter: a beállítások egy része látszik.

**Nyitott tételek**
- 1.8.0 munkaprompt kész: `docs/FELADAT-1.8.0.md` (19 pont: kereső fókusz, tetőszellőző, hófogó, dryvit dekor, belső nézet újratervezés, kattintás→mező, több táj, 5 új stílus, pince, padlás, ajtókeret, radiátor, gyerekszoba, akvárium, komód/polc, lépcső, erkély, bentre állat, falikép). Implementálás még nem kezdődött.
- Kézi szöveg külön a külsőhöz és a belsőhöz, beépítve a promptba.
- Licencközpont telepítése Norbi oldalára → szerver URL + nyilvános kulcs az ügyfélpluginba.
- htombau: 1.7.0 telepítése; 3D sebesség telefonon (valódi GPU-n nem mérve); Magnific/Anthropic kulcs, éles végigteszt.
- GitHub repó NYILVÁNOS → privátra. Fordítások lektorálása (új: táj, újrakezdés, tárgyak helyiségenként).
- Fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron teszt.
