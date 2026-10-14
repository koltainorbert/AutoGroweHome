# FELADAT – AutoGroweHome 1.9.0 (Norbi 2026-10-14-i listája)

Ez a munkaprompt. Sorrend: 1 és 4 együtt (kártyaképek), 5 (színválasztó), 6 (ereszcsatorna),
2 (helyiségek részletei), 3 (városi utcasor), 7 (tárgyak mozgatása egérrel).

## Keret (minden pontra érvényes)

- **Semmi nem vész el.** Az 1.8.1 minden funkciója, mezője és viselkedése megmarad.
- **Mind a 7 pont kell, maradéktalanul.** Részmegoldás nem kész.
- Minden látható paraméter három helyen él együtt: `includes/Params/Definitions.php`,
  `assets/js/agh-sketch.js` (2D), `assets/js/agh-3d*.js` (3D) + `Validator`, `PromptEngine`,
  `.pot` és mind a 15 `.po`.
- **Munkarend:** teszt → commit (magyar) → `git fetch` + rebase → `git push origin main`.
  Kódváltozás előtt `bin/bump-version.sh minor` (1.9.0), CHANGELOG, végül `bin/build-zip.sh`,
  a `dist/` külön commitban.
- Számot csak mérésből. Ami nem mérhető (szép-e), arról képernyőkép készül.
- **A tesztoldalt új mező és új stílus után újra kell indítani** (a katalógus aktiváláskor töltődik).

---

## 1 + 4. Kártyaképek: sehol ne legyen kanapé-helyettesítő

**Hiba:** az új mezők kártyáin kanapé látszik (pince, padlás, ajtókeret, radiátor, gyerekszoba,
akvárium). A padlás és a pince kártyáján kanapé értelmetlen.

**Gyökérok (megtalálva):** a kártyakép az `itemScene()` (agh-3d-int.js) `switch (f)` ágaiból épül,
és az ismeretlen mezőre a `default:` ág kanapét rajzol. A 55 `visual: 'item'` mezőből hatnak nincs
saját ága: `basement_type`, `attic_use`, `door_frame`, `radiators`, `kids_theme`, `aquarium_shape`.

**Kész, ha:**
- Mind a hat mező minden opciójához **saját, a tartalmat mutató 3D kártyakép** készül:
  - `basement_type`: a ház alsó szintjének metszete – részleges, teljes, külső lejáratos
    (süllyesztett terasz lépcsővel), pinceablakkal.
  - `attic_use`: fedélszék deszkázott födémmel, beépített tetőtérnél ferde síkkal és tetőablakkal,
    „nincs padlástér” esetén a tető alatti üres tér.
  - `door_frame`: egy ajtónyílás tokkal és takaróléccel, a választott színben.
  - `radiators`: a választott radiátortípus (lapradiátor, bordás, konvektor, törölközőszárító).
  - `kids_theme`: a téma jellemző darabjai (fiús íróasztal + kisautó, lányos baldachin, babaszoba
    pelenkázó, tini gamer szék).
  - `aquarium_shape`: az adott formájú akvárium bútorral.
- **A `default:` ág nem kanapé többé**: ha egy mezőhöz nincs ága, a kártya a mező címkéjét mutató
  semleges jelenet legyen (nem bútor), és a hiány a konzolban figyelmeztetést írjon ki.
- **Mérés:** egy teszt végigmegy minden `visual: 'item'` mező minden opcióján, és ellenőrzi, hogy
  a jelenet **nem azonos** a kanapé-alapjelenettel (mesh-szám + befoglaló doboz ujjlenyomat);
  0 kanapé-helyettesítő, 0 konzolhiba. A teszt a repóba kerül (`tests/e2e/cards.js`).

## 2. Helyiségek részletei nem működnek

**Hiba:** a helyiség „részletek” panelben beírt értékek nem látszanak semmin, és a módosítás
jelzése `Helyiségprogram: [object Object],[object Object]…` szöveget ír ki.

**Gyökérok (megtalálva):**
- `agh-designer.js` (előnézet változásjelzése): a `rooms` mező értéke tömb, de a szöveg
  `String(S.config[ch.id])`-del készül → `[object Object]`.
- A részletmezők (`floor`, `wall`, `ceiling`, `lighting`, `furniture`, `decor`, `curtains`,
  `doors`, `windows`, `electrical`, `heating`) **szabad szövegek**, és a belső nézet csak négyet
  vesz figyelembe (`interior_style`, `wall_color`, `furniture_color`, `ceiling_height`), ezért a
  többi beírt érték sehol nem jelenik meg.

**Kész, ha:**
- A `rooms` típusú mező változásjelzése a helyiségek **számát és nevét** írja ki, sosem
  `[object Object]`-et. Minden nem skalár mezőérték biztonságosan formázódik.
- A részletmezők közül amelyiknek választéka van, **legördülő lesz** (padlóburkolat, falburkolat,
  mennyezet, világítás, bútorok, függöny, ajtók, ablakok, fűtés/hűtés), a ház alapértékével mint
  „a házzal megegyező”. Szabad szöveg csak az „Egyedi leírás” marad.
- A választott érték **látszik a 3D belső nézetben**: padló, falburkolat, falszín, mennyezet,
  világítás, függöny, ajtó, radiátor helyiségenként felülírja a ház beállítását.
- A szám jellegű mezők (szélesség, hossz, belmagasság) hibás értéknél sem rontják el a nézetet.
- A részletek bekerülnek a promptba helyiségenként.
- **Mérés:** 20 véletlen helyiség, minden részletmező átállítva: a 3D jelenet ujjlenyomata
  mezőnként megváltozik; 0 konzolhiba; a változásjelzésben 0 `[object Object]`.

## 3. A városi utcasor nem városi

**Hiba:** a `town` táj ugyanúgy néz ki, mint a kertváros.

**Kész, ha:**
- Zártsorú utcakép: a szomszédok **összeérnek**, 2–4 szintesek, tűzfalasak, az utca két oldalán
  végig épületsor, a telek keskeny, előkert alig.
- Burkolt utca járdával, szegéllyel, zebrával, utcai lámpákkal, parkoló autókkal.
- Kevesebb fa, fasor a járdán, a háttérben magasabb házak sziluettje.
- A ház előtt kerítés helyett kapu/tűzfal, hátul belső udvar.
- **Mérés:** a `town` táj felépül ≤ 250 ms-ban, a szomszédok száma és magassága eltér a
  `suburb`-tól (teszt a két táj ujjlenyomatát hasonlítja), 0 konzolhiba, és egy képernyőkép.

## 5. Modern színválasztó mindenhol

**Hiba:** a színmezők az operációs rendszer régi színpalettáját nyitják meg.

**Gyökérok (megtalálva):** `<input type="color">` két helyen (`agh-designer.js`: a paraméterlista
színmezője és a helyiség-részletek színmezője) – ez a böngésző/OS natív párbeszédét hozza.

**Kész, ha:**
- Saját, modern színválasztó: színkör vagy telítettség-mező + világosság- és telítettségcsúszka,
  HEX-beírás, pipetta a már használt színekből, és **ajánlott paletta** (a stílushoz illő
  homlokzat-, tető-, nyílászáró- és falszínek névvel).
- A tervező saját felületén nyílik (popover), sötét és világos témában is jó, mobilon
  ujjal is használható (min. 44 px célpontok), billentyűzettel is bejárható, Esc zárja.
- **Szisztematikusan minden színmező** erre vált: paraméterlista, helyiség-részletek, varázsló,
  bárhol máshol is, ahol ma `type="color"` van. A repóban ne maradjon `type="color"`.
- **Mérés:** egy teszt megszámolja a `type="color"` elemeket a teljes felületen (0 kell legyen),
  és végigpróbálja a színválasztót asztali és mobil méretben: a kiválasztott szín megjelenik a
  mezőben, a konfigurációban és a 3D-ben; 0 konzolhiba.

## 6. Ereszcsatorna: a sarkokon dupla lefolyó

**Hiba:** a sarkoknál két lefolyócső fut le egymás mellett.

**Gyökérok:** a tető minden ereszvonala külön lefolyót kap a nagyobb koordinátájú végén; a saroknál
két vonal vége ugyanoda esik, így két cső kerül oda.

**Kész, ha:**
- Egy sarokra **egy** lefolyó jut; a lefolyók legalább 1,5 m-re vannak egymástól.
- A lefolyó a sarokhoz simul, a fal síkjában, az eresztől a lábazatig egyben.
- Hosszú ereszen (≥ 12 m) két lefolyó lehet, de akkor is a két végén, nem egymás mellett.
- **Mérés:** 100 véletlen ház, a lefolyók páronkénti távolsága mindenhol ≥ 1,2 m, duplikátum 0.

## 7. Tárgyak megfogása, forgatása, áthelyezése

**Kérés:** a belső nézetben egérrel meg akarom fogni a tárgyat, elforgatni, és oda tenni a
helyiségbe, ahova akarom.

**Kész, ha:**
- **Megfogás:** a 3D-ben egy tárgyra lenyomva és húzva a tárgy követi az egeret a padlósíkon
  (érintésen hosszú nyomás után, hogy a forgatás ne romoljon el). A tárgy kiemelve látszik, amíg
  fogva van, és a kurzor „mozgatás” alakú.
- **Forgatás:** a kijelölt tárgyhoz forgatófogantyú tartozik (vagy jobb gomb / két ujj);
  15°-onként tapad, Shift nélkül szabad.
- **Határok:** a tárgy nem mehet a szobán kívülre, az ajtósávba és másik tárgyba; ütközésnél a
  legközelebbi szabad helyre pattan, és a már meglévő önellenőrzés nem rakja vissza.
- **Mentés:** az elhelyezés helyiségenként és tárgyanként elmentődik (új mező, pl. `room_layout`:
  `{ helyiségId: { tárgykulcs: {x, y, rot} } }`), túléli az újratöltést, szerveroldali
  ellenőrzéssel (koordináta a szoba méretén belül, szög 0–359, legfeljebb 64 tárgy/helyiség).
- **Visszavonás:** „Alaphelyzet” gomb a helyiségre (visszaáll az automatikus elrendezés), és a
  mozgatás visszavonható (Ctrl+Z vagy egy visszavonás gomb).
- **A prompt** a kézzel elhelyezett tárgyakat a tényleges helyükkel írja le.
- **Mérés:** E2E teszt: 10 tárgyat elmozgat és elforgat, mind a 10 a szobán belül marad, 0 az
  ajtóban, az elrendezés újratöltés után is ugyanaz; 0 konzolhiba.

---

## Átvételi lista

- [ ] 1+4 kártyaképek (0 kanapé-helyettesítő) · [ ] 2 helyiségrészletek · [ ] 3 városi utcasor
- [ ] 5 modern színválasztó (0 `type="color"`) · [ ] 6 egy lefolyó sarkonként · [ ] 7 tárgymozgatás

**Kötelező zárás:** `php tests/autoloader-test.php` · PHP lint 0 · `node tests/sketch-test.js` ·
`python3 bin/po-tools.py check` és `compile` · `bin/test-wp.sh` + `responsive`, `wizard`, `gen`,
`sketch`, `AGH_3D=1 sketch`, `search`, `rooms`, `pick`, `roomcam` E2E · új: `cards.js`, `layout.js` ·
verzió 1.9.0 · CHANGELOG · ZIP · push `main`.
