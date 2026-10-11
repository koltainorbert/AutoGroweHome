# AutoGroweHome – munkarend a repóban

Ez a repó az egyetlen forrás. A repó gyökere maga a WordPress plugin.

## Minden változtatás a repóba kerül, kérdés nélkül

- Minden elkészült módosítás után: teszt → commit → `git push origin main`. Nem kell rá engedélyt kérni, és nem marad munka csak a chatben vagy csak a helyi gépen.
- Közvetlenül a `main` ágra megy (egyszemélyes projekt). Külön ág csak akkor, ha Norbi kéri, vagy a változtatás kísérleti és félkész.
- Push előtt `git fetch origin main` és szükség esetén rebase; force push soha.
- Ha a kód változott, a telepíthető ZIP is újraépül és felmegy: commit után `bin/build-zip.sh`, majd a `dist/` külön commitban.
- Az ALLAPOT.md a repóban és a Claude-projektben (claude/ALLAPOT.md) ugyanaz; ha az egyik változik, a másik is frissül.
- A commitüzenet magyar, az első sor azt mondja meg, mi változott és miért.

## Ami nem kerülhet a repóba

- API-kulcs, licenckulcs, privát kulcs (Ed25519), jelszó, `.env`, `wp-config.php`.
- Ügyféladat, adatbázis-dump, napló, generált kép a privát tárolóból.

## Ellenőrzés commit előtt

- `php tests/autoloader-test.php` (WordPress nélkül fut)
- `find . -name "*.php" -not -path "./.git/*" -print0 | xargs -0 -n1 php -l`

## Tudnivalók

- A célkörnyezetek között Windows is van (Local): útvonalat mindig `/`-rel építs, `DIRECTORY_SEPARATOR` csak `realpath()` eredményével összevetve használható.
- A `bin/`, `tests/`, `dist/`, `CLAUDE.md`, `ALLAPOT.md` nem része a telepíthető ZIP-nek (`.gitattributes` → `export-ignore`).
- Verziót emelni három helyen kell: `autogrowehome.php` (fejléc + `AGH_VERSION`), `readme.txt` (Stable tag), `CHANGELOG.md`.
