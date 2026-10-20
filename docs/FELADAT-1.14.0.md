# FELADAT – 1.14.0: Házépítés az alapoktól – lépésről lépésre (építési folyamat mód)

Norbi szövege (2026-10-20), összefoglalva: a mai program (kész ház, tető, AI-kép) tökéletes, de
kell egy „Házépítés az alapoktól" funkció: kőműves módra, nulláról felépíteni a házat – alap
kijelölése, válaszfalak, főfalak (méret, anyag: tégla, könnyűszerkezet stb.), alapozás (szélesség,
mélység, vasbeton/kő), nyílászárók pontos helye fő- és válaszfalon, gépészet a vakolat alatt
(fűtés, 230 V, net, gyengeáram), vakolat, falszínek. A tető a végén jön, mert az már megvan.
Sok ügyfél azt kéri, hogy az alappal kezdjük, és pontról pontra, folyamatonként rakjuk össze.
Minden méretet és anyagot állítani kell tudni, és a kész házból AI-kép készül, mint ma.

Kiegészítések (2026-10-20): a program alkalmazza és vegye figyelembe, **vagy ne vegye figyelembe
és ne alkalmazza** a magyar törvényeket az adott helyen; lehessen kiválasztani, hol építek, és
tudja, ott mi a szabályzat (→ 3/B). A tető, táj, belső tér stb. a meglévőből épüljön rá (→ 3/C).
Indítás (2026-10-20 11:12): „Kezdd el, és csak a végén állj meg, végig kell csinálnod; a CSS
makulátlan legyen, semmi ne csússzon el; teljes szabad kezet kapsz; tokennel spórolj."

**Minden maradjon meg**: a mai varázsló, minden mező, a helyiségek, a tető, a táj, a koppintás,
a kézi elrendezés, a 2D vázlat, a vezetőképek, a képgenerálás, a teljes képernyő. Az építési mód
**új, külön belépési út**; kikapcsolva (`build.enabled` = ki) a program pontosan az 1.12.1
viselkedését adja. Az 1.13.0 modellek külön ágon várnak (`feature/1.13.0-modellek`): nem olvad
össze, de nem is törik el.

## 1. Piackutatás (2026-10-20, rövid, angol nyelvű forrásokból)

- **Chief Architect** (profi): automatikus alap (teljes pince, pince, kúszótér, pillér), automatikus
  és kézi keretezés, anyaglista, építési dokumentáció. Tervező-eszköz, nem lépésenként vezeti végig
  az építést, és nem ügyfélbarát.
- **Cedreo, Planner 5D, HomeByMe**: gyors 2D→3D, bútor- és anyagkönyvtár; nincs szerkezeti
  rétegezés, nincs alap, nincs gépészet.
- **4D BIM** (Navisworks, Synchro): 3D modell + ütemterv, építési sorrend szimuláció. Pontosan
  az, amit Norbi kér, de profi, drága, nagyvállalati eszköz.
- **Rés**: nincs olyan eszköz, ami az ügyfélnek érthetően, kőműves-sorrendben, lépésenként
  felépíteti a házat, közben anyaglistát ad, és a végén AI-fotót készít a kész modellből.
- Nem néztük át: a magyar kínálatot (Archline, hazai kalkulátorok). Pótolandó.

## 2. A szakmai folyamat (a program lépéssorrendje)

| # | Fázis | Mit dönt el a felhasználó | Függ tőle |
|---|---|---|---|
| 0 | Telek, kitűzés, helyszín | telekhatár, beépítési vonal, ház sarokpontjai, ±0,00 szint, ország/régió/település | – |
| 1 | Földmunka | humuszleszedés, árok/gödör mélysége (fagyhatár alatt), talajtípus | 0 |
| 2 | Alap | típus: sáv (beton/vasbeton), pont, lemez, kő; szélesség × mélység; vasalás; válaszfal alatti megerősítés | 1 |
| 3 | Alapvezetékek | csatorna, vízbekötés, földelő, védőcsövek a lemez alatt/falon át | 2 |
| 4 | Szigetelés, aljzat | vízszigetelés, lábazati szigetelés, feltöltés, tömörítés, aljzatbeton | 3 |
| 5 | Főfalak | anyag (kerámia, gázbeton, mészhomok, zsaluzókő, könnyűszerkezet, vályog), vastagság, magasság | 4 |
| 6 | Válaszfalak | anyag (tégla, gázbeton, gipszkarton, fa váz), vastagság, helyük | 4 |
| 7 | Nyílások | ajtó/ablak: fal, pozíció, szélesség, magasság, parapet, áthidaló típusa | 5, 6 |
| 8 | Koszorú, födém | koszorú, födém típusa (vasbeton, gerendás, fa), lépcsőnyílás | 5, 7 |
| 9 | Tető | a **meglévő** tetőgenerátor, a koszorú vonalából | 8 |
| 10 | Nyílászárók | beépítés (zárt épület) | 7, 9 |
| 11 | Gépészet (durva) | villany, víz/csatorna, fűtés, szellőzés, gyengeáram | 10 |
| 12 | Vakolás, hőszigetelés | belső vakolat; kültér: szigetelés, háló, vakolat, lábazat | 11 |
| 13 | Esztrich | padlófűtés, hőszigetelés, esztrich | 11 |
| 14 | Belső szakipar | burkolat, glett, falszínek, szanitér, villany finom, ajtólapok | 12, 13 |
| 15 | Külső | bádog, lefolyó, járda, kert (meglévő) | 9 |

Szabály a válaszfalak alapozására: teherhordó fal alatt teljes alap; nehéz (tégla, gázbeton)
válaszfal alatt sáv vagy megerősített aljzat; könnyűszerkezetű válaszfal alatt elég az aljzat.
A program ezt a választott anyagból ajánlja, a felhasználó felülírhatja.

## 3. Hogyan épüljön be

1. **Új belépés a varázslóban**: „Gyors terv" (mai) és „Építés az alapoktól". A mai házból át
   lehet vinni az építési módba, és a kész építési modell visszaadható a mai tervezőnek.
2. **Lépésvezérlő** (0–15, az 1.14.0-ban 0–9 aktív), minden lépésnek ellenőrzőlistája. Egy lépés
   akkor zárható, ha a feltételei teljesülnek (pl. falazás nem zárható hiányzó áthidalóval). A zárt
   lépés visszanyitható; a későbbi lépések jelzik, ha emiatt érvénytelenné váltak.
3. **Rajzolás**: 2D rácson (rács 10 cm, pontosság 1 cm, minden számmal is megadható), falhúzás,
   sarok- és falillesztés. A 3D ugyanabból a közös tervből épül.
4. **Valódi objektumok**: Alap(útvonal, szélesség, mélység, típus, vasalás), Fal(p1, p2,
   vastagság, magasság, anyag, teherhordó, rétegek), Nyílás(fal, pozíció, szélesség, magasság,
   parapet, áthidaló), Gépészeti vezeték(típus, útvonal), Felület(réteg, szín).
5. **Rétegezett fal**: falazat + hőszigetelés + vakolat + szín külön réteg (1.14.2: metszet).
6. **3D építési állás**: csúszka a fázisokon (alap → falak → födém → tető → kész).
7. **Anyaglista fázisonként** (beton m³, vasalás kg, tégla db, ragasztó, vakolat m², szigetelés
   m²…), hulladékszázalékkal, tájékoztató jelleggel, ár nélkül.
8. **Ellenőrző szabályok** (figyelmeztetés, nem tiltás): nyílás–sarok és nyílás–nyílás távolság,
   áthidaló felfekvése, fal karcsúsága, válaszfal alatti alap, nyílásarány, fagyhatár alatti
   alapmélység. Általános szabályok, **nem statikai számítás**.
9. **Kimenet** (1.14.3): PDF, CSV, ütemterv. A kész házmodell ugyanúgy megy a képgenerálásra,
   mint ma; a prompt leírja a falazatot.
10. **Tető**: a koszorú vonalából a meglévő tetőgenerátor; a tető minden mai mezője marad.

## 3/B. Helyszín és előírások (Norbi kiegészítése, 2026-10-20)

1. **Helyszín-választó** (0. lépés): ország → régió/megye → település. Innen jön az éghajlat és a
   talaj (fagyhatár, hó-, szélzóna), a hőtechnikai követelmény és a szabályrendszer. Kézzel
   felülírható minden érték.
2. **Szabályrendszer-csomag** (`assets/data/rules/<ország>.json`): minden szabály egy rekord –
   azonosító, téma, feltétel, küszöb, súlyosság, magyarázat, **forrás (jogszabály + hely),
   hatálybalépés, csomagverzió, ellenőrzés dátuma**, `verified`. A kód nem tartalmaz beégetett
   szabályt.
3. **Kapcsoló** „Előírások alkalmazása": **Be** / **Ki** (csak általános jó gyakorlat) / **Egyedi**
   (a felhasználó állítja a küszöböket, szabályonként ki-be). Alap: Be, ha van csomag; ha nincs,
   a program kiírja, és Ki módban fut.
4. **Helyi szabályzat (HÉSZ)**: településenként más (beépítési %, építménymagasság, előkert,
   tetőhajlás, tetőforma); a felhasználó vagy a szakember viszi be forrás mezővel, és mindig az
   ő értéke az erősebb.
5. **Mit ér el**: figyelmeztet (telekhatártávolság, beépítési %, magasság, fagyhatár-mélység,
   belmagasság, lépcső/korlát, hőszigetelés), alapértékeket tölt, anyaglistát igazít. Soha nem
   tiltja a mentést.
6. **Elsőként csak Magyarország**; új ország új fájl, kódváltozás nélkül.
7. **A prompt és a kép nem változik** a szabályoktól.
8. **Mérés**: minden szabály tesztesete (megfelel / nem felel meg); Ki = 0 üzenet; Egyedi módban a
   felülírt küszöb érvényesül; hiányzó csomag = hibátlan működés Ki módban; minden rekordban van
   forrás és dátum.
9. **Őszintén**: a hatályos jogszabályi értékeket jogilag ellenőriztetni kell. Amíg Norbi által
   megbízott szakember nem hagyja jóvá, minden rekord `verified: false`, és a felület
   „nem ellenőrzött"-nek mutatja. A program tájékoztató eszköz, nem jogi tanács.

## 3/C. Együttműködés a meglévő funkciókkal

1. **`BuildAdapter`**: falgráf → helyiségek (zárt hurkok), szintek, külső körvonal (koszorú),
   nyílások → a mai közös terv. Onnantól a belső tér, lépcső, erkély, táj, szomszédok, koppintás
   a mai kód.
2. **Tető**: a koszorú körvonalából. Előzetes mérés: milyen alaprajzot tud a mai tetőgenerátor.
   Amit nem tud, azt figyelmeztetéssel kell kezelni (minden engedett alaprajzra tető, a többinél
   kiírja, miért nem).
3. **Fordított irány**: a mai házból átvihető; a hiányzó adat alapértékkel, jelezve.
4. **Kétféle modell nem lehet**: 2D, 3D, szerveroldali `BuildingModel` és vezetőkép ugyanabból.
5. **„Valid" három szint**: geometriai (mérhető, 0 hiba), szabályi (hely szerint), statikai
   (**nem garantált, nem számolt**; a felület kiírja).
6. **Mérés**: a mai E2E-k építési módban létrehozott házakon is zöldek; 100 véletlen házra a tető,
   a belső tér és a táj hibátlanul felépül.

## 4. Kiadási ütemezés

- **1.14.0 – Alap és falak**: 0–8. lépés + 9 (tető csatlakozás) + anyaglista + 3D fázis +
  helyszín-választó és szabályrendszer-váz a magyar csomaggal. Mentés, visszavonás, kapcsoló, 15 nyelv.
- **1.14.1 – Gépészet**: 11. lépés. **1.14.2 – Vakolat és felületek**: 12–14. **1.14.3 – Kimenet**.
- Az AO és a WebGPU egy verzióval hátrébb tolódik.

## 5. Adat és kód

- Új projektmező: `build` (JSON, verziózott). A mai mezők és a `room_layout` nem változnak,
  adatbázis-migráció nincs.
- Új fájlok: `assets/js/agh-build.js` (adatmodell, adapter, geometriai ellenőrzés, anyaglista,
  szabálymotor – böngészőben és Node-ban is fut), `assets/js/agh-build-ui.js` (szerkesztő),
  `assets/js/agh-3d-build.js` (építési állapotok), `includes/Build/` (szerveroldali ellenőrzés),
  `assets/data/build-defaults.json`, `assets/data/rules/hu.json`.

## 6. Mérés (kész, ha)

- `tests/e2e/build.js`: 100 véletlen ház végigmegy a lépéseken; kilógó fal, átfedő fal, nyílás a
  falon kívül, lebegő elem: **0**; konzolhiba 0.
- `tests/build-test.js` + `php tests/build-test.php`: legalább 3 referenciaház anyagmennyisége
  **1%-on belül** egyezik a független számítással.
- 2D, 3D, szerveroldali modell és vezetőkép tömege azonos.
- Fázisváltás a 3D-ben mért idővel (cél ≤ 100 ms SwiftShaderen).
- Kapcsoló ki = 1.12.1: a meglévő E2E-k eredménye azonos. Mentett projektek mindkét irányban.
- .pot + 15 .po, `po-tools.py check` 0 hiba; autoloader, lint, sketch zöld.

## 7. Biztonsági háló

Önálló ág (`feature/1.14.0-epites`), `build.enabled` kapcsoló (alap: ki, Norbi dönt), nincs
adatmigráció, az 1.12.1 ZIP a `release-1.12.1` ágon és a `main`-en marad, döntési kapu (képek).

## 8. Őszintén

- Ez **nem statikai és nem engedélyezési terv.** A felület kiírja.
- Az anyaglista becslés, nem árajánlat.
- A kép szépsége itt nem mérhető; telefonon, valódi GPU-n a 3D sebesség nem mérhető.
