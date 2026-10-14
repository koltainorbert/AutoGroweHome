# ALLAPOT – AutoGroweHome (frissítve: 2026-10-14)

**Verzió:** ügyfélplugin 1.9.1 (dist/autogrowehome-1.9.1.zip, 6 044 874 bájt, sha256 a7a638e4…96e4bf21) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, claude/FELADAT-*.md, tesztoldal `bin/test-wp.sh`.

**Mérve (1.9.1):** autoloader 119/119 · PHP lint 0 · 15 nyelv × 2095 szöveg, 0 hiba · vázlat 1247 rajz, 0 hiba · 144 mező, 2D 57 / 3D 91 változás, 0 hiba · responsive 24 nézet 0 túllógás · wizard 48 lépés 0 hiba · kereső 0 fókuszvesztés · koppintás 122 rész 8 mező · 60 szoba 347 tárgy 0 kilógó 0 ajtóban · belső nézet kitöltés 89% · kártyaképek 55 mező 321 opció 0 alapjelenet · 0 natív színmező · helyiségrészletek 22/30 · kézi elrendezés 15/15 fogható, 8/8 marad újratöltés után · utcasor 16 helyszín, városin 10 sorház · betöltés helyben 2,8 s / 1,9 MB (tömörítés nélküli tesztszerver, gzipelve ~0,42 MB).

**Döntések**
- Norbi minden szövegéből először tökéletes prompt készül fájlba (`docs/FELADAT-<verzió>.md`), csak utána kezdődik a munka; a prompt semmit nem hagy ki és semmit nem vesz el a meglévőből.
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; stílusonként tömegforma, szintszám, tető, anyag javaslat (Catalog::style_seed, 22 stílus). Új stílusnál: Definitions arch_style + style_seed + STYLES + STYLE_LAND (JS és PHP) + HOOD.
- Közös terv az `agh-sketch.js`-ben, a 3D ugyanebből épít: volumes, _solarFaces, _balconies/_balcMark, _garden, _pool, _terrace, _plot.
- Koppintás a modellre: minden rész `userData.field`-et kap, `collectPicks` az összevonás ELŐTT, `pickAt` a legkisebb dobozt adja, a tervező `jumpToField`-del ugrik a mezőre.
- Kézi elrendezés: a bútorok külön objektumok maradnak (`hs.items`, slotnév „mező#index”), a nagy összevonásból kimaradnak; `Viewer.grabAt/dragTo/turnDrag/dropDrag` mozgat, `fitInRoom` tartja bent a teljes testet, falra akasztott tárgyat `snapWall` simít a legközelebbi falra; a mentés a `room_layout` mezőben van (helyiség → slot → {x, y, rot}).
- Belső tér: agh-3d-int.js; látszó falak hátsó + bal, jobb és első kivágva; `hs.room.fixes` → „Megoldva”. Kamera: `Viewer.fitFrame`.
- Környezet: agh-3d-land.js, 16 táj; a városi utcasorhoz a sorházak a beállítástól függetlenül felépülnek, a szomszédgyorsítótár kulcsa három utcatípust különít el (városi/külvárosi/vidéki).
- Pince a helyiségprogram -1. szintje; padlás külön helyiségtípus (`attic`).
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező. Licenc nélkül Starter.

**Nyitott tételek**
- htombau: telepítés és visszajelzés képernyőképekkel; 3D sebesség telefonon valódi GPU-n nem mérve.
- Betöltés: a tesztszerver nem tömörít; éles kiszolgálón gzip kell (1,9 MB → ~0,42 MB). További csökkentés: az `agh-3d-int.js` (77 KB gzip) csak a belső nézet első megnyitásakor töltődjön – nagyobb átalakítás, nincs megcsinálva.
- Belső nézet: zsúfolt szobában egy bútor a padló közepére kerülhet (az üzenet jelzi); valódi kétpontos perspektíva még nincs.
- Licencközpont telepítése Norbi oldalára → szerver URL + nyilvános kulcs az ügyfélpluginba.
- GitHub repó NYILVÁNOS → privátra. Fordítások lektorálása (1.9.x: 69 új felirat).
- Magnific/Anthropic kulcs, éles végigteszt; fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron teszt.
