# AutoGroweHome – munkarend a repóban

Ez a repó az egyetlen forrás. A repó gyökere maga a WordPress plugin.

## Állandó szabály: minden szövegből előbb tökéletes prompt készül

- Amikor Norbi listát, kívánságot vagy hibabejelentést ír, **az első lépés mindig egy
  tökéletes prompt megírása ugyanabból a szövegből** – nem a kódolás.
- A prompt fájlba megy (`docs/FELADAT-<verzió>.md`), és pontonként tartalmazza: mi a
  kérés, hol van a kódban, mi a gyökérok (ha hiba), és **mikor kész, mérhetően**.
- A prompt semmit nem hagy ki a kapott szövegből, és semmit nem vesz el a meglévő
  működésből: „minden maradjon meg, de ezek maradéktalanul kellenek”.
- Ami már létező mező, azt a prompt megjelöli, hogy ne keletkezzen duplikált paraméter.
- A kész prompt egyszerre kerül a repóba és a Claude-projektbe, és ez alapján folyik a munka.

## Minden változtatás a repóba kerül, kérdés nélkül

- Minden elkészült módosítás után: teszt → commit → `git push origin main`. Nem kell rá engedélyt kérni, és nem marad munka csak a chatben vagy csak a helyi gépen.
- Közvetlenül a `main` ágra megy (egyszemélyes projekt). Külön ág csak akkor, ha Norbi kéri, vagy a változtatás kísérleti és félkész.
- Push előtt `git fetch origin main` és szükség esetén rebase; force push soha.
- Ha a kód változott, a telepíthető ZIP is újraépül és felmegy: commit után `bin/build-zip.sh`, majd a `dist/` külön commitban.
- **Minden új ZIP új verziószámot kap** (Norbi kérése): a kódváltozás commitja előtt `bin/bump-version.sh` (alap: patch, pl. 1.0.0 → 1.0.1; nagyobb új funkciónál `minor`), és a CHANGELOG.md új szakaszát ki kell tölteni. A `bin/build-zip.sh` megtagadja a már kiadott verzió újraépítését; a `dist/`-ben csak a legújabb ZIP marad.
- Az ALLAPOT.md a repóban és a Claude-projektben (claude/ALLAPOT.md) ugyanaz; ha az egyik változik, a másik is frissül.
- A commitüzenet magyar, az első sor azt mondja meg, mi változott és miért.

## Ami nem kerülhet a repóba

- API-kulcs, licenckulcs, privát kulcs (Ed25519), jelszó, `.env`, `wp-config.php`.
- Ügyféladat, adatbázis-dump, napló, generált kép a privát tárolóból.

## Ellenőrzés commit előtt

- `php tests/autoloader-test.php` (WordPress nélkül fut)
- `node tests/sketch-test.js` (élő vázlat, WordPress nélkül fut)
- Sor/generálás változott: `php tests/stuck-project-test.php` (tesztoldalon; beragadt projekt őrző) és `node tests/e2e/cancel.js` (leállítás beragadt szervernél).
- Licencközpont változott: `php tests/license-hub-test.php` (a tesztoldalon, a valódi ügyfél-LicenseManagerrel; 40/40).
- `find . -name "*.php" -not -path "./.git/*" -print0 | xargs -0 -n1 php -l`
- Fordítás változott: `python3 bin/po-tools.py check` (0 hiba), majd `python3 bin/po-tools.py compile` (.mo újragenerálása).
- Felület változott: `bin/test-wp.sh` (eldobható WordPress + SQLite a 8899-es porton, teszt képszolgáltatóval), majd `node tests/e2e/responsive.js /tmp`, `node tests/e2e/wizard.js /tmp`, `node tests/e2e/gen.js`, `node tests/e2e/sketch.js` és `AGH_3D=1 node tests/e2e/sketch.js` (3D, SwiftShaderrel lassú, ~5 perc) (mobil+asztali mérés, varázsló végigléptetése, generálás indítása, minden mező hatása az élő vázlatra; konzolhiba 0). Táblázat: `python3 tests/e2e/table.py <kimenet.json>`.

## Két plugin egy repóban

- A repó gyökere az **ügyfélplugin** (AutoGroweHome) – ez kerül a vásárlók oldalára.
- A `license-hub/` a **központi licencszerver** (AGH Licencközpont), csak Norbi saját HTTPS-oldalára. Külön ZIP: `bin/build-hub-zip.sh` → `dist/agh-license-hub-<verzió>.zip`; saját verzió: `bin/bump-hub-version.sh` (ugyanaz a szabály: minden új ZIP új verzió). Az ügyfél-ZIP-ből kimarad (`.gitattributes`).
- Az API-szerződés az ügyfél `includes/License/LicenseManager.php`-ja: `{szerver}/v1/license/{activate|check|deactivate}`, `/v1/update/check`, `/v1/update/package/{v}.zip`; válasz `{data, signature}`, Ed25519 a kanonikus JSON-on. A kettőt együtt kell változtatni.

## Fordítások

- A forrásnyelv magyar; új szövegnél a `.pot` és mind a 15 `.po` bővül (nyelvenként ugyanannyi szöveg), utána `.mo` fordítás a `bin/po-tools.py`-jal. A JS-szövegek a `includes/Frontend/Strings.php`-ból jönnek.

## Tudnivalók

- A célkörnyezetek között Windows is van (Local): útvonalat mindig `/`-rel építs, `DIRECTORY_SEPARATOR` csak `realpath()` eredményével összevetve használható.
- A 3D előnézet: `assets/js/agh-3d.js` (jelenet) + `agh-3d-tex.js` (procedurális PBR-textúrák) + `assets/js/vendor/three/` (three.js r170, MIT; a `jsm` kiegészítők importja relatív útra írva). Új látható paraméternél a 2D (`agh-sketch.js`) és a 3D is bővül.
- A `bin/`, `tests/`, `dist/`, `CLAUDE.md`, `ALLAPOT.md` nem része a telepíthető ZIP-nek (`.gitattributes` → `export-ignore`).
- A verzió három helyen áll: `autogrowehome.php` (fejléc + `AGH_VERSION`), `readme.txt` (Stable tag + changelog), `CHANGELOG.md` – mindet a `bin/bump-version.sh` emeli, kézzel nem kell.
