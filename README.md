# AutoGroweHome 1.0.0

AI-alapú, interaktív háztervező és kivitelezői ajánlatkérő WordPress-bővítmény.
Szerző: Koltai Norbert – Infostudio · Licenc: kereskedelmi (`LICENSE.txt`).

## Mit csinál
1. A látogató egy popupban (shortcode `[autogrowehome]`, lebegő gomb vagy `#agh-open` link) beállítja a házat: alapadatok, forma, tető (magastetőnél kötelező BRAMAC), homlokzat, helyiségprogram, belső stílus stb.
2. Egy kérés = 3 eltérő koncepció = 1 egység a napi keretből (IP-alapú, atomikus).
3. Minden koncepcióhoz fő látványterv (Magnific) és determinisztikus, méretezett tervvázlat (SVG/DXF/CAD-JSON) készül; a kiválasztott házhoz külső és belső galéria.
4. A látogató **menthet** vagy **ajánlatot kérhet** (külön művelet, külön, alapból üres hozzájárulásokkal).
5. Ajánlatkéréskor védett kivitelezői ZIP-csomag és e-mail-értesítés készül, időkorlátos, címzetthez kötött hozzáféréssel.

## A csomag tartalma
| Útvonal | Tartalom |
|---|---|
| `autogrowehome.php`, `includes/`, `assets/`, `templates/`, `languages/`, `uninstall.php` | A bővítmény (16 nyelv: magyar forrás + 15 fordítás) |
| `docs/` | Teljes magyar dokumentáció (lásd lent) |
| `tests/` | Integrációs és regressziós tesztek (`wp eval-file`) |
| `tools/license-server/` | Referencia-licencszerver (külön, a forgalmazó szerverére) |
| `readme.txt`, `CHANGELOG.md`, `LICENSE.txt` | WordPress-leírás, változásnapló, licenc |

## Gyors indulás
1. Telepítés ZIP-ből, bekapcsolás (PHP 8.0+, mbstring, sodium, gd, zip, json).
2. AutoGroweHome → Beállítások: Magnific API-kulcs **vagy** teszt mód; opcionálisan Anthropic-kulcs.
3. Kivitelezői e-mail-címek, jogi dokumentumok (ÁSZF, adatkezelés) – jogásszal ellenőrizve.
4. `[autogrowehome]` egy oldalra. Valódi cron ajánlott (`wp agh queue run`).
5. Go-live előtt: `docs/TELEPITES-UTANI-ELLENORZOLISTA.md`.

## Dokumentáció
| Fájl | Kinek |
|---|---|
| `docs/TELEPITES.md` | Telepítés, követelmények, cron, privát tárhely |
| `docs/KONFIGURACIO.md` | Minden beállítás, API-kulcsok |
| `docs/ADMIN-KEZIKONYV.md` | Admin felület lépésről lépésre |
| `docs/FELHASZNALOI-UTMUTATO.md` | Látogatói útmutató |
| `docs/GYIK.md` | Gyakori kérdések |
| `docs/API-INTEGRACIOK.md` | Magnific és Anthropic integráció, szükséges előfizetések |
| `docs/ARCHITEKTURA.md` | Felépítés, adatfolyam |
| `docs/FEJLESZTOI-DOKUMENTACIO.md` | REST API, hookok, bővítés, sémák, WP-CLI |
| `docs/ADATBAZIS.md` | Táblák, migrációk, opciók |
| `docs/BIZTONSAGI-ELLENORZOLISTA.md` | Védelmek, üzemeltetői lista, ismert korlátok |
| `docs/TESZTJELENTES.md` | Mi lett tesztelve, mivel, eredmények |
| `docs/MINTAPROMPTOK.md` | Promptmotor modulok, valós renderelt példák |
| `docs/MINTA-KONFIGURACIOK.md` | Három minta-beállítás |
| `docs/LICENC-ES-ELOFIZETES.md` | Csomagok, licencelés, frissítés |
| `docs/TELEPITES-UTANI-ELLENORZOLISTA.md` | Éles indulás előtti lista |
| `docs/BOVITESI-TERV.md` | Továbbfejlesztési terv |
| `tools/license-server/README.md` | Licencszerver telepítése és kezelése |

## Ellenőrzöttség (mérve, 2026-10-11)
- Integrációs tesztsor 147/147, regressziós tesztek 120/120, 116/116, 71/71, licencszerver-önteszt 32/32; `php -l` és `node --check` 0 hiba.
- Böngészős E2E (Chromium): asztali és mobil (360/390 px) nézet, teljes folyamat teszt módban, 0 konzolhiba.
- Környezet: PHP 8.3.6, WordPress 7.2-alpha + SQLite.

## Amit élesben még ellenőrizni kell
- Valós Magnific- és Anthropic-hívás saját kulccsal (a tesztek a dokumentált szerződés szerint szimulálnak).
- MySQL/MariaDB, valódi e-mail-kézbesítés (SMTP, SPF/DKIM), éles cron.
- BRAMAC katalógusadatok gyártói ellenőrzése (jelenleg „gyártói ellenőrzésre vár”).
- Jogi szövegek és `LICENSE.txt` jogászi véglegesítése; a fordítások anyanyelvi lektorálása.
- Fizetési szolgáltató nincs beépítve (bővítési pont: `agh_payment_gateways`).
