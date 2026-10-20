# Építési mód – „Építés az alapoktól” (1.14.0)

Új, külön belépési út a tervezőben: a ház kőműves sorrendben, lépésről lépésre épül fel – kitűzés,
földmunka, alap, alapvezetékek, aljzat, főfalak, válaszfalak, nyílások és áthidalók, koszorú és
födém, végül a **meglévő** tetőgenerátor. A kész rajzból ugyanaz a közös terv lesz, mint a gyors
varázslóból, ezért a tető, a táj, a belső tér, a kert, a vezetőkép és a képgenerálás változtatás
nélkül ráépül.

> **Nem statikai és nem engedélyezési terv.** A program a geometriát ellenőrzi, a szabályok csak
> figyelmeztetnek, és soha nem akadályozzák a mentést. Az alapozás, az áthidalók és a födém
> méretezéséhez statikus, az engedélyhez tervező kell. Az anyaglista becslés, nem árajánlat.

## Bekapcsolás (üzemeltető)

Admin → **Építés az alapoktól** kapcsoló (`build.enabled`, alap: **ki**). Kikapcsolva a tervező
pontosan az 1.12.1 szerint működik: nem töltődik be egyetlen új fájl sem, a felület, a 3D, a
szerveroldali modell és a prompt ugyanaz. Bekapcsolva:

- a varázsló első lépésén két kártya jelenik meg: **Gyors terv** (a mai út) és **Építés az alapoktól**;
- a fejlécben (telefonon a menüben) **Építés az alapoktól** gomb;
- a mentett projektek mindkét irányban működnek: a rajz a `build` projektmezőben él, a meglévő
  mezők és a `room_layout` nem változnak, adatbázis-migráció nincs.

## A lépések (1.14.0)

| # | Lépés | Mit állít a felhasználó |
|---|---|---|
| 0 | Telek, kitűzés | ország → megye → település, telekméret (a meglévő `plot_width`, `plot_length`), a ház helye, fagyhatár, talaj, az előírások kapcsolója és a HÉSZ értékei |
| 1 | Földmunka | humuszréteg, munkatér, alapozási mélység |
| 2 | Alap | beton / vasbeton sávalap, lemezalap, kő sávalap; szélesség, mélység, lábazat, válaszfalak alá |
| 3 | Alapvezetékek | csatorna, víz, alapföldelő, védőcsövek (a nyomvonal 1.14.1-ben) |
| 4 | Szigetelés, aljzat | kavics, aljzatbeton, talajnedvesség elleni lemez, lábazati XPS |
| 5 | Főfalak | rajz (téglalap, L, „a mostani házból”, szabad falhúzás), szintek és szintmagasság, anyag, vastagság, hőszigetelés |
| 6 | Válaszfalak | szintenként; a zárt terekből helyiségek lesznek, a fajtájuk állítható |
| 7 | Nyílások, áthidalók | ablak, ajtó, bejárati ajtó, teraszajtó pontos helye, mérete, parapet, áthidaló |
| 8 | Koszorú, födém | monolit vasbeton, gerendás-béléstestes, fagerendás; vastagság, koszorú, lépcsőnyílás |
| 9 | Tető | a meglévő generátor a külső fal vonalából; utána a megszokott tervező |
| 10–15 | Nyílászárók, gépészet, vakolás, esztrich, szakipar, külső | 1.14.1–1.14.3 (a lépéssorban látszanak, még nem nyithatók) |

Egy lépés akkor zárható le, ha az ellenőrzőlistája teljesül (például bejárati ajtó nélkül a
nyílások lépése nem zárható). A lezárt lépés visszanyitható; ha a tartalma később megváltozik, a
lépéssorban figyelmeztető színnel jelzi, hogy át kell nézni.

**Rajzolás:** rács 10 cm, a koordináták 1 cm-re pontosak, minden méret számmal is megadható.
Illesztés falvéghez, falra és rácsra; a falhúzás alapból derékszögű (Shift: ferde). Görgetés:
nagyítás, húzás az üres részen: mozgatás, két ujj: nagyítás telefonon. Ctrl+Z / Ctrl+Y, Delete.

**A tető feltétele:** a mai tetőgenerátor tengelyekkel párhuzamos téglalapok uniójából épít tetőt
(téglalap, L, T, U, lépcsős – szabad sokszöget nem). Ezért a tetőhöz **derékszögű külső fal** kell;
ferde külső falnál a program kiírja, miért nem készül tető. A külső kontúrt a program téglalapokra
bontja (főtömb + szárnyak); ha egy nyílás két téglalap határára esne, olyan bontást választ, amely
egyben hagyja.

## 3D építési állás

A 3D nézetben fázis-csúszka mutatja a ház állását: 0 kitűzés (telekhatár, sarokkarók, zsinór) → 1
földmunka → 2 alap és lábazat → 3 vezetékek → 4 aljzat → 5 főfalak a nyílásokkal → 6 válaszfalak →
7 áthidalók → 8 koszorú és födém → 9 a kész ház a tetővel (ugyanaz a modell, ami a tervezőben
látszik). A fázisváltás nem építi újra a jelenetet, csak láthatóságot vált.

## Anyaglista

Fázisonként, hulladékszázalékkal, tájékoztató jelleggel: humusz és földkiemelés m³, alapbeton m³,
vasalás kg, lábazati beton, csatorna- és vízcső m, alapföldelő m, védőcső db, kavics és aljzatbeton
m³, szigetelőlemez és XPS m², falazóelem db (anyag és vastagság szerint), habarcs/ragasztó kg,
favázas falnál faváz m és burkolólap m², áthidaló db hosszanként, koszorú- és födémbeton m³,
vasalás, gerenda m, homlokzati hőszigetelés m² (előzetes). A számítás a falak tengelyméretével
dolgozik (T-csatlakozásnál a fogadó fal fél vastagságával rövidebb), a nyílásokat levonja. Az
alapértékek (darab/m², kg/m³, hulladék %) az `assets/data/build-defaults.json` fájlban vannak,
gyártói adatlap szerint pontosítandók.

## Helyszín és előírások

- **Kapcsoló:** Be (a választott hely szabályai szerint), Ki (csak általános szakmai jó gyakorlat,
  jogszabály nélkül – ilyenkor 0 szabályüzenet), Egyedi (szabályonként ki-be, saját küszöbbel).
  Ha a helyhez nincs szabálycsomag, a program kiírja, és Ki módban fut.
- **Szabálycsomag:** `assets/data/rules/<ország>.json`. Minden rekord: azonosító, téma, mérőszám,
  reláció, küszöb (vagy honnan jön: HÉSZ / helyszín), súlyosság, **forrás (jogszabály + hely)**,
  hatálybalépés, csomagverzió, ellenőrzés dátuma, `source_checked`, `verified`. A kód nem tartalmaz
  beégetett szabályt; új ország = új fájl, kódváltozás nélkül.
- **HÉSZ:** a települési szabályzat értékeit (beépítés %, párkánymagasság, elő-, oldal- és
  hátsókert, tetőhajlás) a felhasználó vagy a szakember viszi be, forrás mezővel; mindig az ő
  értéke az erősebb.
- **Magyar csomag (hu-2026.10.0) – VÁZ:** minden rekord `verified: false`, a felület „nem
  ellenőrzött” jelzéssel mutatja. `source_checked: true` csak ott, ahol a hivatkozott szöveghelyet
  2026-10-20-án a Nemzeti Jogszabálytárban megnéztük (TÉKA 6. § (1), 9. § (3)); ez sem jogi
  jóváhagyás. A tartalmat a Norbi által megbízott szakembernek kell jóváhagynia, utána a rekordban
  `verified: true` és a jóváhagyó neve (`approved_by`).

## Mit jelent a „valid”

1. **Geometriai** (mérhető, cél 0 hiba): nincs átfedő fal, nincs a házból kilógó vagy lebegő fal,
   minden nyílás a falon belül, a falcsatlakozásoktól és egymástól távol, az áthidaló alatt, a
   külső fal zárt.
2. **Szabályi:** a kiválasztott hely szabályai szerint, figyelmeztetésekkel.
3. **Statikai:** **nem garantált és nem számolt.**

## Adat és kód

- Projektmező: `build` (JSON, `v: 1`) – telek/helyszín, szabálykapcsoló és HÉSZ, földmunka, alap,
  alapvezetékek, aljzat, szintek, falak (`ext` külső, `int` belső teherhordó, `part` válaszfal;
  anyag, vastagság, hőszigetelés), nyílások, koszorú, födém, helyiségfajták; előkészítve:
  `services` (1.14.1), `surfaces` (1.14.2).
- `assets/js/agh-build.js` – modell, falgráf → helyiségek és kontúr, kontúr → a közös terv
  tömegei (`BuildAdapter`), geometriai ellenőrzés, anyaglista, szabálymotor; böngészőben és Node-ban.
- `assets/js/agh-build-ui.js` – szerkesztő (lépésvezérlő, 2D falszerkesztő, anyaglista, ellenőrzés).
- `assets/js/agh-3d-build.js` – 3D építési állapotok.
- `includes/Build/Build.php` – a szerver ugyanazzal az algoritmussal ellenőriz és bont (a
  `BuildingModel` ebből adja az alaprajzot, ha az építési mód be van kapcsolva).
- Tesztek: `node tests/build-test.js`, `php tests/build-test.php`, `node tests/e2e/build.js`,
  `node tests/e2e/build3d.js`; a tesztoldal kapcsolója: `php tests/build-toggle.php on|off`.
