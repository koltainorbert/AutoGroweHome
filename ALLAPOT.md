# ALLAPOT – AutoGroweHome (frissítve: 2026-10-13)

**Verzió:** ügyfélplugin 1.4.0 (dist/autogrowehome-1.4.0.zip: belső nézet Kívül/Belül kapcsolóval, ablakkeret kapcsolható, lista nem ugrik vissza; 1.3.3 kert a telken belül; 1.3.1 gyorsítás; 1.3.0 épületformák) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, tesztoldal `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 1699 szöveg, 0 hiba · vázlat 1247 rajz, 218 változat, 600 kert (0 hibás elhelyezés), 0 hiba · belső nézet 25 helyiségtípus × 3 beállítás, 0 hiba · felületi lefedettség 58 látható mező (2D+3D), 0 hiba, konzol 0 · 3D: 87–101 rajzolási hívás/ház (régen 1300–1900), hideg stílusváltás 15 stílusra 1,0 s (régen 8,5 s, tesztgép) · Licencközpont 40/40. A wizard.js és responsive.js E2E a kiinduló állapoton is időtúllépéssel áll le (elavult szelektor) – javítandó.

**Döntések**
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; minden stílus saját tömegformát (massing), szintszámot, tetőt, anyagot javasol (Catalog::style_seed); DB v8 csak érintetlen (v1/v7) javaslatot frissít.
- Tömegformák a közös `agh-sketch.js` volumes()-ban (z0 konzol, roofMap, round, glass, frame, veranda, balc, exo, terraceRoof); a 3D ugyanebből épít. Medence/terasz/bejárat/telek/kert közös függvények (_pool, _terrace, _entrance, _plot, _garden).
- Előnézet 3D (three.js r170); 2D csak tartalék. Teljesítmény: mergeStatic (anyagonként 1 háló), textúrák workerben (agh-3d-gen.js + agh-3d-texw.js), egyszínű anyag semleges textúra × anyagszín, shadowMap.autoUpdate=false, kártyaképek csak láthatóra. Forrásnyelv magyar, 15 fordítás (bin/po-tools.py); útvonalak „/”-rel.
- 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező.
- Belső nézet: `interiorScene(c, room)` (agh-3d.js), a Viewer `c._int`-ből vált; a tervező a kategória/mező szerint vált külső↔belső nézetre és helyiségre (autoView).
- Licenc nélkül (nincs AGH_OWNER_MODE, nincs aktív Professional) Starter: 31 beállítás látszik a 123-ból – a tervező és az admin ezt kiírja.

**Nyitott tételek**
- Kézi szöveg külön a külsőhöz és a belsőhöz, beépítve a promptba.
- Licencközpont telepítése Norbi oldalára → szerver URL + nyilvános kulcs az ügyfélpluginba.
- htombau: 1.3.0 telepítése; 3D sebesség telefonon; Magnific/Anthropic kulcs, éles végigteszt.
- GitHub repó NYILVÁNOS → privátra. Fordítások lektorálása (tömegformák, tetőelemek).
- Fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron teszt.
