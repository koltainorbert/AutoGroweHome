# FELADAT – 1.13.0: valódi 3D modellek (GLB) a dobozbútorok helyett – pilot, 40 modell

Norbi szövege (2026-10-15):

> az ikea modellek adatbazisat vagy mas hasonlot is be lehetne tolteni? Kintre bente is lehetne
> hasznalni az elemeket!
>
> Csucstechnologia kell. Nem alkuszunk meg! A vilag legjobb progjamjat epitjuk! […] Amint akadozik
> vagy lassul plaggol nem eladhato! Keresd meg a vilag legjobb leggyorsabb legszebb brutalisan
> realisztikus utjat photorealisztikara torekedj
>
> Mehet ird meg nezzuk meg de ha balul sul el vissz kell tennem az elozot es ujratervezes

**Döntés:** IKEA-modellek nem kerülnek be, mert nincs nyílt, szabadon használható adatbázisuk, és
egy eladott pluginban szerzői jogi és márkajogi kockázatot jelentenének. Helyettük csak **CC0**
(közkincs) modellek jönnek: Poly Haven (szkennelt, PBR), Kenney, Quaternius, AmbientCG.

**Minden maradjon meg**: a mai, kódból épített bútorok tartaléknak megmaradnak. Minden mező,
helyiség, slot, a koppintás, a kézi elrendezés, az önjavító elhelyezés, a kártyaképek, a 2D vázlat,
a vezetőkép és a képgenerálás pontosan úgy működik, mint az 1.12.1-ben.

## 0. Biztonsági háló – a munka ELŐTT kell elkészülnie

1. **Címke**: `v1.12.1` git tag a kiadott állapoton, push. Az 1.12.1 ZIP a `dist/`-ben marad.
2. **Kapcsoló**: admin → „Valódi 3D modellek” (`models.enabled`), alapérték: be. Kikapcsolva
   **pontosan az 1.12.1 viselkedése** jön vissza (dobozbútor, 0 GLB-kérés), újratelepítés nélkül,
   egy oldalfrissítéssel. Összehasonlításhoz `?agh_models=0` / `?agh_models=1` URL-paraméter.
3. **Az adatformátum nem változik**: `room_layout`, slotnevek („mező#index”), projektmezők
   ugyanazok, nincs adatbázis-migráció. Így az 1.12.1-re visszalépve minden mentett projekt
   működik, és a 1.13.0-ban kézzel elrendezett bútorok is a helyükön maradnak.
4. **Döntési kapu**: a végén Norbi képeket kap (be/ki, 4 szoba és a kert). Ha nem tetszik:
   kapcsoló ki, vagy az 1.12.1 ZIP vissza, és a tanulságokkal új FELADAT készül.

Kész: kikapcsolt állapotban az összes meglévő E2E eredménye megegyezik az 1.12.1-ével.

## 1. Mi legyen (mérhetően kész)

1. **Betöltő** – új `assets/js/agh-3d-models.js`: `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader`,
   a repóban lévő three.js verzióhoz illő példányból. **Helyben**, a pluginnal szállítva (a Basis
   átkódoló wasm is), nem CDN-ről, mert ügyféloldalon fut és adatvédelmi okból nem hívhat külső
   szervert.
2. **Modellkatalógus** – `assets/models/manifest.json`, modellenként: azonosító, fájl (hi/lo),
   melyik mező/érték/slot-típust váltja le, valós méret (szél × mély × mag), eleje iránya,
   rögzítés (padló / fal / mennyezet / felület), színezhető anyagok neve (`tint`), háromszögszám,
   bájtméret, licenc, forrás URL, szerző, letöltés dátuma.
3. **Építőlánc** – a forrásmodellek nagyok (több tíz MB), ezért **nem kerülnek a repóba**:
   - `bin/fetch-models.sh` letölti őket a manifestben lévő URL-ről, sha256 ellenőrzéssel;
   - `bin/build-models.sh` (glTF-Transform): ellenőrzés → takarítás, összevonás → egyszerűsítés a
     háromszögkeretre → textúra 1024 px (hi) és 512 px (lo) → KTX2 (szín: ETC1S, normál: UASTC) →
     Meshopt → glTF Validator 0 hiba;
   - a repóba csak a kész, tömörített fájlok kerülnek. Ha a `toktx` nem telepíthető, WebP a
     tartalék, és ezt a CHANGELOG kiírja.
4. **Eszközszint** – a böngésző a GPU, a memória és a képernyő alapján választ: telefonon és gyenge
   gépen `lo`, egyébként `hi`. A választás felülírható (`?agh_tier=lo|hi`).
5. **Illesztés a meglévő rendszerbe** – ahol a manifestben van modell a slothoz, az váltja le a
   dobozbútort:
   - a modell a slot befoglalójába skálázódik, egyenletesen. Ha az arányeltérés 15%-nál nagyobb,
     a dobozbútor marad, és a konzol jelez (torz bútor nincs);
   - `userData.field/value/room`, a slotnév, `pickAt`, `grabAt`, `fitInRoom`, `snapWall`,
     `room_layout` változatlanul működik;
   - a színmezők (bútorszín, kárpit, fa) a manifest `tint` anyagain hatnak. Ha a mező olyat kér,
     amit a modell nem tud, a dobozbútor marad; a teszt ezt megszámolja.
6. **Nincs várakozás, nincs ugrás** – a dobozbútor azonnal látszik. A modell betöltés után
   ugyanabban a befoglalóban cserélődik, egy képkockán belül. Ismétlődő modell közös geometriát
   és anyagot kap, 4 példány fölött `InstancedMesh`-t. A fájlnév verziózott (hosszú böngésző-
   gyorsítótár), munkameneten belül memória-gyorsítótár van. Csak a látható szint és a kert
   modelljei töltődnek.
7. **Anyag és fény** – PBR anyag a meglévő környezeti fénnyel. A modell ne legyen kirívóan
   sötétebb vagy világosabb a jelenet többi részénél.
8. **Ugyanaz mindenhol** – a kártyajelenetek (`itemScene`), a külső és a belső vezetőképek és a
   koncepciókép-vezetés is a modellt használja. Generáláskor a vezetőkép megvárja a látható
   modelleket (legfeljebb 3 s, utána doboz), hogy ne félig betöltött jelenet menjen ki.
   A tiszta vezetőkép szabályai (jármű, ember, állat, háttérfa, pára nélkül) maradnak.
9. **2D vázlat** változatlan: az alaprajzi befoglaló ugyanaz.
10. **Licenc** – a pilotban csak CC0. `assets/models/LICENSES.md` modellenként forrás, szerző,
    licenc, dátum. CC-BY, CC-BY-SA, márkás termék és ismeretlen licenc tilos.
11. **Pilot: 40 modell** – kb. 28 belső (nappali, háló, étkező, dolgozó, fürdő, lámpák,
    cserepes növények) és kb. 12 külső (kerti asztal, szék, pad, nyugágy, napernyő, grill,
    virágláda, kaspó). A pontos lista a manifestben, a kiválasztás szempontja: a leggyakoribb
    slotok és a koncepcióképen legjobban látszó tárgyak.

## 2. Mérés (kész, ha)

**Költségkeret** (cél; a mért értékek a CHANGELOG-ba):
- modellenként ≤ 200 KB (hi) és ≤ 100 KB (lo); ≤ 20 000 háromszög;
- szobánként ≤ 200 000 háromszög;
- az összes modellfájl együtt ≤ 10 MB; a ZIP mérete kiírva (WordPress feltöltési határ miatt).

**Sebesség**:
- kattintástól a kész 3D képig (`perf.js`) legfeljebb 10%-kal lassabb, mint az 1.12.1;
- szoba tárgyakkal SwiftShaderen ≤ 150 ms (a mai határ) marad;
- rajzolási hívások szobánként előtte és utána kiírva.

**Működés**:
- új `tests/e2e/models.js`: betöltés; a modell befoglalója 2%-on belül egyezik a dobozéval;
  kapcsoló ki = 0 GLB-kérés; telefon-emulációban `lo`, asztalin `hi`; lefedettség (X/Y slot kap
  modellt); validator 0 hiba; manifestben minden elem CC0 és van forrás URL;
- `rooms`, `roomcam`, `pick`, `layout`, `cards`, `guide`, `perf` zöld bekapcsolt **és** kikapcsolt
  állapotban; kilógó tárgy 0; konzolhiba 0;
- a teljes zárás (autoloader, lint, sketch, po-tools, responsive, wizard, gen) zöld.

**Képek a végén**: nappali, háló, fürdő, étkező és kert, modellekkel és nélkülük, funkciónként
egy képernyőkép.

## 3. Őszintén (nem mérhető ebben a környezetben)

- **Hogy szép-e**, azt csak képen lehet eldönteni – Norbi dönt.
- Valódi telefon GPU-n nincs mérés; a tesztkörnyezet SwiftShader (szoftveres). Az első valódi
  telefonos próbát Norbinak kell elvégeznie a saját Androidján.
- A CC0 kínálat véges: lesz slot, amihez nincs jó modell, ott a dobozbútor marad.
  A teljes lefedettség (és a stílusonkénti változatok) a pilot után jön, ha a kapu átment.

## 4. Amit nem szabad elrontani

- Kikapcsolt állapot = 1.12.1, bájtra ugyanaz a jelenet.
- Mentett projektek mindkét irányban működnek (1.12.1 ↔ 1.13.0).
- Repóba nem kerül forrásmodell, csak a tömörített kész fájl; kép és ügyféladat továbbra sem.
- A képgenerálás költsége nem nő: a vezetőkép ugyanannak a kérésnek a része.

## 5. Utána (nem ennek a verziónak a része)

- 1.14.0: környezeti takarás (AO), jobb árnyék, envMap-tükröződés, eszközszint szerinti effektek.
- 1.15.0: WebGPU + TSL, automatikus WebGL 2 tartalékkal.

## 6. Kötelező zárás

`bin/bump-version.sh minor` (1.13.0) · CHANGELOG (mért keretekkel, lefedettséggel) · új feliratok
.pot + 15 .po, `po-tools.py check` 0 hiba és `compile` · autoloader, lint, sketch · E2E be/ki
állapotban · `bin/build-zip.sh` · a dist külön commitban · push `main`.
