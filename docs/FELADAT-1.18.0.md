# FELADAT – 1.18.0–1.24.0: Norbi listája, „ezek még nincsenek meg, de azonnal kellenek”

Norbi szövege (2026-10-22 12:58), szó szerint pontonként:

> * 1.17: helyiségprogram felugró ablakban: pillékből választod a helyiséget, megadod a m²-t, és te
>   teszed be az alapba.
> * 1.18: falak, ablakok, ajtók törlése és mozgatása a rajzon és a 3D-ben.
> * 1.19: bármelyik tárgy mozgatása és forgatása (Shift-tel visszaáll egyenesbe), jelölve, hova szabad
>   tenni és hova nem. 3d tervezőben is arrébb akarom shifttel vagy ctrl-el tudni tenni a kéményt az
>   ablakokat ajtókat és mindent és forgatni
> * 1.20: a díszítőanyag helyét te jelölöd ki a házon.
> * 1.21: medencetípusok és méret, a garázs részletei (m², belső osztás, tető, anyag, kapu, ablak).
> * 1.22: melléképületek (tároló, faház, műhely). nem tudok létrehozni mellékhelyiségeket kintre garázs
>   tároló stb méretezni és berendezni tetőt tenni rá garázs tároló stb
> * Élethű autó ember és járműveket akarok a 3D képre

**Verziószámok:** az 1.17.0 már kiadva (fotós prompt), ezért a lista új számokat kap. A sorrend az
1.17.0-ban rögzített döntés (először a mozgatás), utána Norbi listájának sorrendje:

| Verzió | Tartalom | Norbi pontja |
|---|---|---|
| **1.18.0** | Mozgatás és forgatás a 3D tervezőben: kerti tárgyak, járművek, emberek, állatok, fák, ablakok, ajtók, kémény | „1.19” + 3D tervező |
| 1.19.0 | Építési mód: fal, ablak, ajtó törlése és mozgatása a rajzon és a 3D építési állásban | „1.18” |
| 1.20.0 | Helyiségprogram felugró ablakban (pillék + m², a felhasználó teszi az alapba) | „1.17” |
| 1.21.0 | A díszítőanyag helye kijelölhető a házon | „1.20” |
| 1.22.0 | Medencetípusok és méret, garázs részletei | „1.21” |
| 1.23.0 | Melléképületek: létrehozás, méretezés, berendezés, tető | „1.22” |
| 1.24.0 | Élethű járművek, emberek, állatok a 3D-ben | utolsó pont |

**Minden maradjon meg**: a tervező, a varázsló, az építési mód 0–9. lépése, a belső nézet kézi
elrendezése (`room_layout`), a koppintás → mező ugrás (`pickAt`), a teljes képernyő, a fotó a 3D
képből út, a képleíró prompt, a 2D vázlat, a 15 nyelv. Kikapcsolt építési mód = változatlan működés.
Mentett projektek mindkét irányban működnek (új mező hiánya = a mai automatikus elrendezés).

---

## 1.18.0 – Mozgatás és forgatás a 3D tervezőben

### Hol van ma
- Belső nézet: `assets/js/agh-3d.js` `Viewer.itemAt/grabAt/dragTo/turnDrag/dropDrag`, `fitInRoom`,
  `snapWall`; a bútorok külön objektumok (`hs.items`), mentés `room_layout` (`agh-designer.js`
  `saveLayout`), Ctrl+Z, visszaállítás gomb. **Forgatás ma: Shift + vízszintes húzás vagy görgő.**
- Kívül **semmi nem fogható meg**: a kerti elemek terve közös a 2D-vel (`agh-sketch.js`
  `gardenLayout` → `G.pool/shed/playground/firepit/pergola/furniture/plants/vehicles/people/pets/
  kennel/charger/lights`), a 3D (`House.site`) ezt rajzolja, és minden egy nagy hálóba olvad
  (`mergeStatic`) – ezért nem mozdítható.
- Ablak, ajtó: `faceOpenings` (3D) és `openings` (2D) számolja egyenletes osztással; a bejárati és a
  teraszajtó helye `frontPlan` (közös). A kémény helye `House.roofItems` → `chimney()` (3D) és
  `roofItems` → `chimneyBox` (2D), rögzített helyen.

### Mi legyen (mérhetően kész)
1. **Új mező `site_layout`** (típus `sitelayout`, rejtett, mint a `room_layout`): kulcs → `{x, y, rot}`
   (tervkoordináta méterben, fok). Kulcsok: `pool`, `shed`, `playground`, `pergola`, `firepit`,
   `furniture`, `kennel`, `charger`, `plant#i`, `vehicle#i`, `person#i`, `pet#i`, `light#i` (kert);
   `door@<vi>`, `tdoor@<vi>`, `win@<vi>:<oldal>:<szint>:<i>` (nyílás: `x` = falmenti eltolás);
   `chimney` (`x` = gerinc menti, `y` = lejtő menti helyzet). Validátor: legfeljebb 200 kulcs, a
   kulcs mintára illik, `x, y` −200…200, `rot` 0–359.
2. **A közös terv követi**: a `gardenLayout` a végén alkalmazza a `site_layout` kerti kulcsait (a
   2D és a 3D ugyanazt kapja); a `frontPlan` a bejárati és a teraszajtót, a `faceOpenings`/`openings`
   az ablakokat, a kémény a saját helyét. Kész: egy elmozdított medence, fa, autó, ablak a 2D
   vázlaton és a 3D-ben ugyanott van (a vázlat a teszten ugyanazt a koordinátát kapja).
3. **Megfogás a 3D tervezőben** (külső nézet), egérrel azonnal, ujjal rövid nyomás után:
   - kerti tárgy, jármű, ember, állat, fa, bokor, pergola, medence, tároló, tűzrakó, kerti bútor,
     lámpa, kutyaház, töltő: húzás a talajon;
   - ablak, bejárati ajtó, teraszajtó: húzás **a saját falán** (a fal mentén), a többi nyílásba és a
     fal végébe nem csúszik;
   - kémény: húzás **a tetősíkon**;
   - forgatás: **Ctrl (Mac: ⌘) + vízszintes húzás**, vagy húzás közben görgő / R gomb (15°-os
     lépés); **Shift: visszaáll egyenesbe** (0/90/180/270°-ra pattan). Ugyanez a belső nézetben is
     (ott a Shift eddig forgatott; a forgatás megmarad a Ctrl-lal, a görgővel és az R-rel).
   - húzás közben nyilak: 10 cm, Shift + nyíl 50 cm; Esc: a húzás elvetése, a tárgy visszaugrik.
4. **Jelölés: hova szabad és hova nem**: húzás közben a tárgy alatt/körül keret, **zöld** ha szabad,
   **piros** ha nem, és egy rövid felirat az okkal. Szabályok (figyelmeztet, nem tilt – a piros
   helyre is letehető, a felület kiírja):
   - kert: telken belül; nem a ház, a terasz, a garázs alapterületén; medence a háztól ≥ 1 m;
     fa a háztól ≥ 2 m (nagy fa ≥ 3 m); tárgyak nem fednek egymásra;
   - nyílás: saroktól ≥ 60 cm, másik nyílástól ≥ 30 cm, nem lóg ki a falból;
   - kémény: a tetősíkon belül, a gerinctől ≤ 60 cm javasolt (forrás: `assets/data/rules/hu.json`,
     új rekordok `verified: false`).
   Kész: a szabályok rekordként a `hu.json`-ban, és egy teszt mindegyikre megfelel / nem felel meg.
5. **Mentés, visszavonás**: elengedéskor a hely a `site_layout`-ba kerül és a projekttel mentődik;
   Ctrl+Z visszavon (közös verem a belső nézettel), a külső nézetben „Kézi elrendezés
   visszaállítása” gomb (csak ha van kézi elrendezés). Kész: E2E: fogás → húzás → elengedés →
   újratöltés után ugyanott; Ctrl+Z után az előző helyén; visszaállítás után az automatikus helyén.
6. **A kép követi**: a fotó a 3D képből készül, így a mozgatott hely automatikusan átmegy; a prompt
   (a régi út) egy mondatot kap: „a kert és a nyílások elrendezését az ügyfél kézzel állította be”.
7. **Sebesség**: a megfogható tárgyak külön, egyenként összevont csoportok (mint a bútorok). A
   rajzolási hívások száma egy alapházon kiírva előtte–utána; a nézet felépítése (`perf.js`)
   legfeljebb 10%-kal lassabb. A nyílás és a kémény elengedése újraépíti a házat (a falban lyuk van).
8. **Teszt**: új `tests/e2e/move.js`: minden tárgytípus (kert, jármű, ember, állat, fa, ablak,
   ajtó, kémény) megfogható, húzható, forgatható; Shift = egyenes; tiltott hely piros; mentés,
   újratöltés, Ctrl+Z; 0 konzolhiba. `layout.js`, `pick.js`, `sketch-test.js`, `guide-test` zöld.

### Őszintén
- A piros jelölés figyelmeztetés, nem statikai és nem engedélyezési ellenőrzés.
- Telefonon, valódi GPU-n nem mérve.

---

## 1.19.0 – Építési mód: fal, ablak, ajtó törlése és mozgatása (rajz + 3D)

- Hol: `assets/js/agh-build-ui.js` (eszközök, kijelölés), `assets/js/agh-build.js` (adat, `normalize`),
  `includes/Build/Build.php` (PHP port), `assets/js/agh-3d-build.js` (3D építési állás).
- Kell: kijelölés kattintással (rajzon és a 3D építési állásban), Delete / kuka gomb törli; ablak/ajtó
  húzása a saját falán; fal végpontjának húzása (a csatlakozó falak követik); fal egészének húzása;
  Ctrl+Z visszavon. A 3D építési állásban ugyanez (fal, nyílás kijelölése sugárral).
- Kész: E2E 50 véletlen házon törlés + mozgatás, geometriai hiba 0, visszavonás után a rajz bájtra
  az előző; JS = PHP (`build-test.php` paritás).

## 1.20.0 – Helyiségprogram felugró ablakban

- Hol: építési mód 6. lépés (`agh-build-ui.js`), helyiségtípusok `RoomProgram`.
- Kell: „Helyiségek” gomb → felugró ablak: pillék (Nappali, Étkező, Konyha, Nappali + konyha +
  étkező, Fő hálószoba, Hálószoba, Gyerekszoba, Fürdőszoba, WC, Előtér, Dolgozó, Kamra, Mosókonyha,
  Gardrób, Gépészet, egyedi név), helyiségenként m² (és ha akarja, szélesség × mélység). A lista
  téglalapokat ad a rajz mellé, a felhasználó húzza őket az alapba; a falak a téglalapok határán
  jönnek létre. A mai automatikus kiosztás csak gombra fut.
- Kész: a beírt m² ±0,5 m²-en belül; átfedés 0; a ház körvonalán kívül 0.

## 1.21.0 – A díszítőanyag helye a házon

- Hol: `facade_accent` (létező mező, ne legyen duplikált), 3D `wallDetails` (`accentMat`), 2D `walls`.
- Kell: a kiegészítő anyag (fa, kő, tégla, fém…) helye kijelölhető: falfelületre kattintva (melyik
  homlokzat, melyik szárny, lábazat, sarok, sáv, bejárat körüli rész). Új mező `accent_layout`.
  2D, 3D és a prompt is követi.
- Kész: E2E: kattintás egy falra → az anyag ott jelenik meg a 2D-ben és a 3D-ben, a prompt megnevezi.

## 1.22.0 – Medence és garázs részletesen

- Hol: `garden_features` → `pool` (létező); `garage` (létező: none/carport/garage_1/garage_2/separate).
- Medence: típus (téglalap, L, kör/ovális, infinity, merülő, jakuzzi), méret (h × sz × mélység),
  burkolat, lefedés, terasz körülötte – új mezők `pool_*`.
- Garázs: m² / méret, beállók száma, belső osztás (műhely, tároló, kazán), tető (lapos, nyereg,
  félnyereg, zöld) és anyaga, homlokzat anyaga, kapu típusa és színe, ablak, gyalogajtó – új mezők
  `garage_*`; a mai `garage` mező értékei maradnak.
- Kész: minden új mező a 2D-ben, a 3D-ben és a promptban; `sketch-test` 0 hiba.

## 1.23.0 – Melléképületek

- Kell: tetszőleges számú melléképület (tároló, faház, műhely, nyári konyha, külön garázs, pajta):
  típus, szélesség × mélység × magasság, tető (lapos, nyereg, félnyereg, zöld) és anyaga, falanyag,
  ajtó, ablak, belső berendezés (polc, munkapad, szerszámfal, kerti gépek, autó). Mozgatható és
  forgatható az 1.18.0 szerint. Új mező `outbuildings` (lista).
- Kész: 2D, 3D, prompt; 3 melléképület egy telken átfedés nélkül; E2E létrehozás, méretezés,
  mozgatás, mentés.

## 1.24.0 – Élethű járművek, emberek, állatok a 3D-ben

- Hol: `agh-3d-int.js` `vehicle/motorcycle/bicycle/person/dog/cat`.
- Kell: a mai egyszerű formák helyett részletes modellek (kerekek gumival és felnivel, üvegezés,
  lámpák, tükrök, karosszéria ívek; emberen arc, haj, ruha redői, kéz; állaton fej, fül, farok), a
  pluginba csomagolva, háttérszerver nélkül.
- Kész: járművenként ≤ 20 000 háromszög; a nézet felépítése legfeljebb 10%-kal lassabb; képek.
- Őszintén: a valódi szkennelt modellekhez (CC0 GLB, 1.13.0) letöltés és tárhely kell; a pluginba
  kódból épített, részletesebb modell kerül.

---

## Kötelező zárás (minden verziónál)

`bin/bump-version.sh minor` · CHANGELOG mért értékekkel · új feliratok .pot + 15 .po, `po-tools.py
check` 0 hiba és `compile` · autoloader, lint, `sketch-test` · az érintett E2E-k · `bin/build-zip.sh`
· a dist külön commitban · push a `feature/1.14.0-epites` ágra · a ZIP átadása.
