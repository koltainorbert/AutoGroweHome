# FELADAT – 1.21.0: a helyiségprogram területmérlege + a díszítőanyag helye

## 1. Norbi kérése (2026-10-22 16:59, a helyiségprogram ablakáról készült képpel), szó szerint

> a rendszernek tudnia kell hogy levonja a falvastagságokat is amit elvesz a térből és mindig
> meghatározza hogy még pontosan hány m² osztható ki számolja mekkora helyiség fér még el figyelembe
> véve a vakolat ajtókat és mindent ami egy épületnél architekturálisan műszakilag építéstanilag van

**Hol:** építési mód 6. lépés, „Helyiségprogram” (1.20.0, `agh-build-ui.js`: `progDialog`, `programBox`,
`progAuto`, `progWalls`, `progState`). Létező adat: `build.prog` (nem kell új mező), a fal
vastagságai a modellben (`walls[].t`, alap: külső 0,38 + szigetelés, teherhordó belső 0,30, válaszfal
0,10), a lépcső födémáttörése `slab.stair`.

**Gyökérok (1.20.0):** a téglalap a beírt nettó m², de (a) a válaszfal a téglalap élének közepére
került, így a fal fele a helyiségből ment le; (b) a párbeszéd nem mutatta, mennyi hely van még;
(c) a vakolat, a lépcső és a meglévő teherhordó falak nem voltak levonva; (d) a programfalak a
teherhordó belső falakat is törölték.

**Kell:**
- **Területmérleg** a felugró ablakban és a 6. lépés dobozában, élőben (minden sor módosításakor):
  bruttó alapterület (külső méret) → − külső falak → − belső vakolat (alap 1,5 cm a falsíkon) →
  − lépcső (többszintes háznál; ha nincs megrajzolva, becsült 1,1 × 3,2 m, „becslés” jelöléssel) →
  − meglévő belső falak, amelyek maradnak → − a programhelyiségek közti válaszfalak (elhelyezett
  téglalapnál pontosan, a külső fal felőli oldalon nincs válaszfal; elhelyezetlennél becslés) =
  **kiosztható nettó m²**; − a programban lévő m² = **még kiosztható m²**; túllépésnél piros
  figyelmeztetés.
- **Mekkora helyiség fér még el:** (a) a maradék m²-ből a következő helyiség saját válaszfalait is
  levonva („még egy helyiség legfeljebb kb. X m²”); (b) elhelyezett téglalapoknál a legnagyobb
  szabad téglalap a házban (szélesség × mélység, a falak és a vakolat már levonva).
- **A geometria tartja a mérleget:** a téglalap a kész (vakolt) falsíkok közti nettó méret; a
  szomszédos téglalapok között a válaszfal + 2 × vakolat hézag, a külső/teherhordó faltól vakolatnyi
  távolság; a fal a hézag közepére kerül; a teherhordó belső falat a program nem törli, és téglalap
  nem lóghat rá; a lépcsőre sem.
- **Építéstani jó gyakorlat (figyelmeztetés, nem tiltás):** helyiségtípusonként legkisebb terület és
  legkisebb szélesség (pl. hálószoba 8 m² / 2,5 m, fő háló 12 m² / 3,0 m, fürdő 3,5 m² / 1,6 m, WC
  1,2 m² / 0,9 m), ajtónak hely (legkisebb oldal ≥ 0,9 m + tok); ha nincs közlekedő/előtér a
  programban, javaslat: a nettó 8–12 %-a. Adatként: `assets/data/build-defaults.json` →
  `programme` (`verified: false`, hazai gyakorlat, nem jogszabály).
- Az ajtók: a nyílás a nettó alapterületet nem változtatja (az MSZ-gyakorlat szerint a nettó terület a
  kész falsíkok között mért); a mérleg alatt egy mondat ezt kimondja.

**Kész, ha (mérve, `tests/e2e/prog.js`):**
- az automatikus elhelyezés és a falak után minden helyiség nettó területe (a rajzolt falsíkok
  között, mínusz a vakolat) = a beírt m² ± 0,5 m²;
- a szomszédos téglalapok közti hézag = válaszfal + 2 × vakolat (± 1 cm), átfedés 0, körvonalon kívül
  0, teherhordó falon és lépcsőn 0;
- a mérleg belső összege stimmel (kiosztható − program = maradék, 0,01 m²-re), túllépésnél piros;
- a kiírt „legnagyobb szabad hely” méretű új helyiség az automatikus elhelyezéssel valóban elfér;
- a teherhordó belső falak száma a „Falak a helyiségek köré” után nem csökken;
- szerver = JS, konzolhiba 0, 15 nyelv.

## 2. A díszítőanyag helye (az 1.18.0 FELADAT 1.21.0 pontja szerint)

- „Díszítőanyag helye” mód a 3D-ben: falra koppintás → zóna (egész fal, emelet, oromzat, lábazat,
  bejárat) → 1. anyag, 2. anyag, nincs; `accent_layout` mező; 2D, 3D, prompt; Ctrl+Z, visszaállítás.
- Kész: `tests/e2e/paint.js` zöld, `match-test` (prompt és szerver) zöld.
