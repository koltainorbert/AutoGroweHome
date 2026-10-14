# ALLAPOT – AutoGroweHome (frissítve: 2026-10-14)

**Verzió:** ügyfélplugin 1.8.0 (dist/autogrowehome-1.8.0.zip, 5 997 961 bájt, sha256 2b7b4f4c…544af5a5) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, claude/FELADAT-*.md, tesztoldal `bin/test-wp.sh`.

**Mérve (1.8.0):** autoloader 119/119 · PHP lint 0 · 15 nyelv × 2074 szöveg, 0 hiba · vázlat 1247 rajz, 600 kert, 0 hiba · 157 mező, 2D és 3D 0 hiba, konzol 0 · responsive 24 nézet 0 túllógás · wizard 48 lépés 0 hiba · beragadt projekt 9/9 · kereső 0 fókuszvesztés · koppintás 122 rész 8 mező · 56 szoba 311 tárgy 0 kilógó 0 ajtóban · belső nézet kitöltés 89% · 16 táj 90–218 ms · 6 új stílus 0 hiba.

**Döntések**
- Norbi minden szövegéből először tökéletes prompt készül fájlba (`docs/FELADAT-<verzió>.md`), csak utána kezdődik a munka; a prompt semmit nem hagy ki és semmit nem vesz el a meglévőből.
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; stílusonként tömegforma, szintszám, tető, anyag javaslat (Catalog::style_seed, 22 stílus). Új stílusnál: Definitions arch_style + style_seed + STYLES + STYLE_LAND (JS és PHP) + HOOD.
- Közös terv az `agh-sketch.js`-ben, a 3D ugyanebből épít: volumes, _solarFaces, _balconies/_balcMark, _garden, _pool, _terrace, _plot. Erkély: tetőtérnél az oromfalon, földszintesnél franciaerkély.
- Koppintás a modellre: minden rész `userData.field`-et kap (House.add + fázisonkénti címke), a nézegető `collectPicks` dobozokat tesz el az összevonás ELŐTT, `pickAt` a legkisebb tartalmazó dobozt adja, a tervező `jumpToField`-del ugrik a mezőre.
- Belső tér: agh-3d-int.js; látszó falak hátsó + bal, jobb és első kivágva; önellenőrzés (szobán belül, ajtósáv szabad), `hs.room.fixes` → „Megoldva”; `hs.items` = a szoba bútorcsoportja (teszt). Kamera: `Viewer.fitFrame` keretezi a szoba dobozát.
- Környezet: agh-3d-land.js, 16 táj; `landscape` mező, „auto” = stílus szerint (JS STYLE_LAND = PHP `Definitions::landscape_for_style`).
- Pince a helyiségprogram -1. szintje (`RoomProgram::sanitize($rooms, $max, $basement)`); padlás külön helyiségtípus (`attic`).
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező. Licenc nélkül Starter: a beállítások egy része látszik.

**Nyitott tételek**
- htombau: az 1.8.0 telepítése és visszajelzés képernyőképekkel; 3D sebesség telefonon (valódi GPU-n nem mérve).
- Belső nézet: zsúfolt szobában egy bútor a padló közepére kerülhet (az üzenet jelzi); valódi kétpontos perspektíva (eltolt frustum) még nincs.
- Licencközpont telepítése Norbi oldalára → szerver URL + nyilvános kulcs az ügyfélpluginba.
- GitHub repó NYILVÁNOS → privátra. Fordítások lektorálása (1.8.0: 58 új felirat).
- Magnific/Anthropic kulcs, éles végigteszt; fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron teszt.
- Kézi szöveg külön a külsőhöz és a belsőhöz, beépítve a promptba.
