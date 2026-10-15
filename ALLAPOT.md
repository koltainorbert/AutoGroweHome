# ALLAPOT – AutoGroweHome (frissítve: 2026-10-15)

**Verzió:** ügyfélplugin 1.12.1 (dist/autogrowehome-1.12.1.zip, 6 233 586 bájt, sha256 888e7e55…cfa1aa64; mentési pont: `release-1.12.1` ág – a git tag push a proxyn tiltott) · Licencközpont 1.0.0 (license-hub/) · Repó: github.com/koltainorbert/AutoGroweHome (main). Chat elején: repó bekötése, CLAUDE.md, claude/FELADAT-*.md, tesztoldal `bin/test-wp.sh`.

**Mérve (1.12.1):** teljes képernyő 76/76 (asztali+telefon, API+CSS-tartalék, előnézet/popup/nagyított kép) · search, color, pick, layout, responsive, wizard 48/0, gen 202 zöld · **(1.12.0):** vezetőkép 62/62 (hűségszintek, nyitóblokk, negatív lista, Magnific-kérés teste hálózat nélkül: structure 75 / adherence 55 / hdr 35, mintakép 1536 px, belső vezetőkép és nyitóblokk, hosszhatár) · guide.js 6 nézet + 4 belső vezetőkép, tiszta és szemmagasságú hero eltér · tárhely 10/10 + 11/11 · beragadt 9/9 · autoloader 119/119 · lint 0 · 15 nyelv × 2149 szöveg, 0 hiba · vázlat 1247 rajz, 0 hiba · 144 mező, 3D 91 változás, 0 hiba · gen 202, 0 konzolhiba · (korábbi mérések: responsive 24/0, wizard 48/0, 60 szoba 347 tárgy 0 kilógó, betöltés 2,8 s / 1,9 MB, gzip ~0,42 MB).

**Döntések**
- **Teljes képernyő (1.12.1):** gomb a tervező fejlécében, az előnézet jobb alsó sarkában, a nagyított képen; Fullscreen API, iPhone-on CSS-tartalék (Vissza előbb onnan lép ki). 3D: átméretezéskor a célpont is marad, 3 MP felett csökkenő pixelarány.
- **Valódi modellek (1.13.0, `feature/1.13.0-modellek` ág, félkész):** csak CC0 (IKEA nem); betöltő, kapcsoló (`layout.real_models`, `?agh_models`), hi/lo, illesztés 15 %-os arányhatárral, építőlánc (`bin/build-tools.sh`, `fetch-models.sh`, `build-models.sh`), `tests/e2e/models.js` 14/14; üres katalógus = 1.12.1. Leírás: docs/MODELLEK.md.
- Norbi minden szövegéből először tökéletes prompt készül fájlba (`docs/FELADAT-<verzió>.md`), csak utána kezdődik a munka; semmit nem hagy ki és semmit nem vesz el a meglévőből.
- Minden változtatás automatikusan a repóba (teszt → commit → push main); minden új ZIP új verzió (bin/bump-version.sh, központnál bin/bump-hub-version.sh).
- Két plugin: gyökér = ügyfélplugin; license-hub/ = licencszerver Norbi HTTPS-oldalára (Ed25519 {data, signature}). Saját oldalon: `AGH_OWNER_MODE`.
- Stílus = 1. lépés; Catalog::style_seed, 22 stílus. Új stílusnál: Definitions arch_style + style_seed + STYLES + STYLE_LAND (JS és PHP) + HOOD + mintakép mező (automatikus).
- Közös terv az `agh-sketch.js`-ben, a 3D ugyanebből épít. Koppintás: `userData.field` → `jumpToField`. Kézi elrendezés: `room_layout`. Belső tér: agh-3d-int.js.
- **Képgenerálás receptje (1.12.0):** forma = 3D vezetőkép (structure, Hű 75 / Klón 85), fotóhatás = stílusonkénti mintakép (style 45 → Mystic adherence 55, hdr 35), negatív prompt = `PromptEngine::config_negative()` (a választott értékek téves alternatívái; a Mysticnek nincs negatív mezője, ezért „Also avoid:” a végén, kikapcsolható). Hű/Klón: nyitóblokk a prompt elején, belső nézetnél saját belső blokk.
- Vezetőkép: tiszta (járművek, emberek, állatok, háttérfák, pára nélkül), hero 18° felett 9°-ról a látogató irányából (`hero_camera=auto`), belső nézet a szoba nyitott sarkából szemmagasságban; feltöltés `projects/{uuid}/guides`, `interior_<szoba>` legfeljebb 8. Képarány: mért `guide_aspect`. Mintakép sorrend: `magnific.style_ref_<stílus>` → a stílus katalógusképe → `style_ref_default`; belső: `style_ref_interior`. Repóba kép nem kerül.
- A képek száma, nézetei, formája és adatai maradnak (Norbi: „csak minőségben”); bemutatótábla nem kell. Pince a -1. szint; padlás `attic`. 1 kérés = 3 koncepció = 1 egység; BRAMAC magastetőnél kötelező. Licenc nélkül Starter.

**Nyitott tételek**
- **1.13.0 modellek:** a Poly Haven/Kenney stb. ebből a környezetből tiltott → Norbi tölti le (Poly Haven, glTF 1K, 30–40 db) és csatolja; utána katalógus, építés, mérés (be/ki E2E, perf), képek, döntési kapu, kiadás.
- **Éles próba Norbinál:** stílusonként mintafotó feltöltése (valódi, szemmagasságú építészeti fotó, a kívánt fénnyel), `mystic_engine` kézi átállítása `magnific_sharpy`-ra (elmentett beállításnál nem vált magától), majd próbakép; a kép szépsége itt nem mérhető. Ha a végi „Avoid” lista egy tiltott színt mégis behúz: „Negatív prompt a szöveg végén” ki.
- Védett tárhely éles oldalon: AGH_PRIVATE_DIR vagy Nginx location, utána „Ellenőrzés újra” / „Fájlok áthozása”.
- htombau: telepítés és visszajelzés; 3D sebesség telefonon valódi GPU-n nem mérve. Betöltés: éles kiszolgálón gzip kell; `agh-3d-int.js` késleltetett betöltése nincs megcsinálva.
- Licencközpont telepítése → szerver URL + nyilvános kulcs az ügyfélpluginba. GitHub repó NYILVÁNOS → privátra.
- Fordítások lektorálása (1.9.x–1.12.0: 110 új felirat). Magnific/Anthropic éles végigteszt; fizetés → kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL/SMTP/éles cron.
