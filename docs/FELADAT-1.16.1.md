# FELADAT – 1.16.1: Pro változat kóddal, az Arculat menüben

Norbi szövege (2026-10-22 11:33): „kérem a pro változat kerüljön az arculati menübe és legyen
[a megadott kód] a kódja”.

**Minden maradjon meg**: a licencközpont (aktiválás, csomagok, Ed25519), a csomagmátrix, a saját
oldal mód (`AGH_OWNER_MODE`), az Arculat oldal mai beállításai.

## 1. Hol
- Csomag: `Features::plan()` ← `LicenseManager::effective_plan()` (`includes/License/`).
- Arculat oldal: `Pages::page_branding()`; műveletek: `Admin::handle_action()`.
- Ma Pro csak licenckulccsal (licencközpont) kapcsolható; kód nincs.

## 2. Kész, ha (mérve)
1. Arculat és elrendezés lap tetején „Pro változat” kártya: kódmező + „Bekapcsolás”; bekapcsolva
   „Aktív” + „Kikapcsolás”; Professional/Agency licencnél és saját oldalon csak tájékoztat.
2. A helyes kód a **Professional** csomagot kapcsolja be ezen az oldalon (minden Pro funkció és limit,
   köztük a képleíró prompt); Agency licencet nem csökkent; kikapcsolva újra Starter.
3. A kód **nem kerül szövegesen a repóba** (CLAUDE.md: nincs kulcs/jelszó a repóban): csak a bcrypt
   kivonata van a kódban; a teszt környezeti változóból kapja.
4. 5 hibás próba után 15 percig tiltás.
5. 15 nyelv, `po-tools.py check` 0 hiba.
6. Teszt: `AGH_PRO_CODE=… php tests/pro-code-test.php` 13/13; böngészőben (tesztoldal, ügyféloldal
   módban): hibás kód → nem kapcsol, jó kód → Aktív, Kikapcsolás → vissza.

## 3. Őszintén
- A kód minden ügyféloldalon ugyanaz: aki megtudja, bármelyik oldalon bekapcsolhatja a Pro-t a
  licencközpont nélkül. Ha ügyfélnek adod, utána a licencközponti kulcs a biztonságosabb út.
- A kivonatból a kód próbálgatással elvileg visszafejthető (rövid kód); hosszabb kód erősebb.
