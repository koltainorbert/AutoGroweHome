# ALLAPOT – AutoGroweHome (frissítve: 2026-10-21)

**Verzió:** `feature/1.14.0-epites` = **1.14.3** (dist/autogrowehome-1.14.3.zip, 6 623 811 bájt, sha256 9993e489…7e2f0719) – „Építés az alapoktól”, Norbi döntéséig nem kerül a `main`-re · `main` = 1.12.1 (mentési pont: `release-1.12.1` ág) · `feature/1.13.0-modellek` = valódi modellek pilot, archívum, nem olvasztva · Licencközpont 1.0.0 · Repó: github.com/koltainorbert/AutoGroweHome. Chat elején: repó bekötése, CLAUDE.md, claude/FELADAT-*.md, tesztoldal `bin/test-wp.sh`.

**Mérve (1.14.1–1.14.3):** 1.14.2–1.14.3: téma-független elrendezés (tests/e2e/theme.js: rajz 1366-on 467 px, fül 1 px, üres sáv 0), töltésjelző 1 ms, csúszka a lépéssel 15/15, újbóli belépés 5/5, megnyitógomb ikon 48 px / logó 40 px (tests/e2e/cta.js) · `tests/e2e/build.js 100`: 1000/1000 lépés, geometriai hiba 0, rajz = modell, tető 100/100, 3D fázisváltás max 5,3 ms, felület 110 mérés 0 hiba, konzolhiba 0 · `build-test.js` 6975/6975 · `build-test.php` 2217/2217 (JS–PHP egyezés) · `build3d.js` 20 ház · kikapcsolt módban a meglévő E2E-k zöldek (search, layout, pick, cards, color, fullscreen 76/76, guide, gen, street, rooms, roomcam, wizard, responsive) · guide-test 62/62 · sketch 1247 rajz 0 hiba · autoloader 121/121 · lint 0 · 15 nyelv × 2481 szöveg, 0 hiba.

**Döntések**
- **Építési mód (1.14.x):** admin → Arculat és elrendezés → „Építés az alapoktól” (`build.enabled`, alap KI; kikapcsolva bájtra 1.12.1). Lépések 0–9 aktív, 10–15 (nyílászárók, gépészet, vakolat, esztrich, szakipar, külső) a következő funkcióverziók tartalma. Adat: `build` projektmező; mag `agh-build.js` (JS) = `includes/Build/Build.php` (PHP port). Tető csak derékszögű kontúrra (a generátor téglalapuniót tud). Leírás: docs/EPITESI-MOD.md, promptok: docs/FELADAT-1.14.0/1.14.2/1.14.3.md. Norbi témája a `section`/`aside` elemekre margót tesz: minden saját elem téma-független legyen (theme.js méri).
- Szabályok adatként: `assets/data/rules/hu.json` (12 rekord, mind `verified: false`), alapértékek `assets/data/build-defaults.json`. Nem statikai és nem engedélyezési terv – a felület kiírja; figyelmeztet, nem tilt.
- Norbi minden szövegéből először `docs/FELADAT-<verzió>.md`; semmi nem vész el. Minden ZIP új verzió.
- Képgenerálás receptje (1.12.0) és a valódi modellek döntése (csak CC0) változatlan; a 1.13.0 modellek háttérszerver nélkül nem folytatható (Norbi: nincs háttérszerver).

**Nyitott tételek**
- **Döntési kapu (Norbi):** 1.14.3 kipróbálása, a kapcsoló bekapcsolása; utána `main`-re olvasztás. A magyar szabálycsomag jóváhagyója (szakember) még nincs kijelölve.
- Következő funkciók (új minor verziókon, mert az 1.14.1–1.14.3 javításoké lett): gépészet (11. lépés), vakolat/felületek (12–14), kimenet (PDF/CSV, ütemterv). Az AO/WebGPU utánuk.
- Korlátok: helyiség a szerveren téglalap (L alakú szoba bbox), a 3D ház telekbeli helye a mai helyszínlogika szerint, ferde külső falra nincs tető. Valódi GPU-n és telefonon nem mérve; a kész ház első képkockája SwiftShaderen 5–16 s (a mai házzal azonos).
- Éles próba Norbinál: stílusonkénti mintafotó, `mystic_engine` → `magnific_sharpy`. Védett tárhely (AGH_PRIVATE_DIR / Nginx). Licencközpont telepítése, GitHub repó privátra. Fordítások lektorálása (1.9.x–1.14.3). Magnific/Anthropic éles végigteszt, fizetés → kulcskiadás, BRAMAC-katalógus, jogi szövegek, MySQL/SMTP/éles cron.
