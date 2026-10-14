# FELADAT – 1.10.0: a generált kép a 3D házat kövesse

Norbi szövege (2026-10-14):

> a generált képek házak köszönő visuzonyba sincsenek a rajzomhoz! Mi az ok ?
> nem veszed alapul a 3d házat?

**Minden maradjon meg**: a mostani promptépítés, a három koncepció, a galéria nézetei, a
tesztszolgáltató, a költségkeretek és a meglévő `GuideRenderer` tömegvázlat. Ami hozzájön: a
látogató által látott 3D modell valódi vezetésként kerüljön a képgenerálóhoz.

## 1. Gyökérok (mérve a kódban)

1. **A három koncepciókép (hero) soha nem kap geometriai vezetést.** `Pipeline::render()`:
   ```php
   $guide_view = 'interior' === $op ? '' : ( 'hero' === $asset['view'] ? 'hero' : $asset['view'] );
   if ( '' !== $guide_view && … && in_array( $guide_view, array( 'front', 'back', 'left', 'right' ), true ) )
   ```
   A `hero` nincs a listában, tehát a `structure_image` üresen megy ki. Az első körben
   (`Pipeline::plan()` → `enqueue_hero`) **csak hero készül**; a homlokzati nézetek csak a koncepció
   kiválasztása után (`enqueue_gallery`). Vagyis minden kép, amit Norbi eddig látott, tisztán
   szövegből készült.
2. **Ahol van vezetés, az sem a 3D.** `GuideRenderer::render()` GD-vel rajzol egy lapos
   tömegvázlatot a **szerveroldali** `BuildingModel`-ből (`includes/Generation/GuideRenderer.php`),
   nem abból a three.js modellből, amit a látogató lát és forgat. A kettő két külön geometria.
3. A `magnific.structure_strength` alapértéke **30** (0–100), ami gyenge vezetés akkor is, amikor
   van kép.

## 2. Mi legyen (mérhetően kész)

1. **A 3D nézet képe megy vezetésként.** Generáláskor a böngésző a jelenlegi (vagy a nézethez
   tartozó) kameraállásból elkészíti a modell képét, és elküldi a `/generate` és
   `/projects/{uuid}/regenerate` hívással. Nézetek: `hero` (pontosan az a kameraállás, amit a
   látogató beállított), `front`, `back`, `left`, `right`, `aerial`.
   Kész: a kérésben mind a hat kép ott van, mindegyik nem üres PNG/JPEG, legfeljebb 1,5 MB.
2. **A szerver eltárolja és használja.** A képek a védett tárhelyre kerülnek
   (`guides/<nézet>.jpg`), és a `Pipeline::render()` elsősorban ezeket küldi `structure_image`-ként,
   **a heróhoz is**. Ha nincs mentett kép a nézethez, marad a mai `GuideRenderer` (front/back/left/
   right), vagyis semmi nem lesz rosszabb a mainál.
   Kész: `hero` kérésnél a `structure_image` nem üres, és a tárolt fájlból való.
3. **Erősség**: a geometriai vezetés erőssége állítható maradjon, de az alapérték legyen a 3D-s
   vezetéshez igazítva (új telepítésnél 45), és a súgószöveg mondja meg, mit jelent kicsi/nagy érték.
4. **Korlátok**: a feltöltött vezetőkép csak PNG/JPEG lehet, legfeljebb 1,5 MB és 2048 px;
   projektenként legfeljebb 8 kép; a könyvtár a védett tárhelyen van (nem nyilvános URL-en).
5. **Ha nincs WebGL** (a látogató gépe nem tud 3D-t): a kérés kép nélkül megy, minden a mai módon
   működik tovább.
6. **Teszt**: `node tests/e2e/guide.js` – a tervezőben generálást indít, és méri, hány vezetőkép
   készült, mekkorák, és hogy a `/generate` kérés testében tényleg ott vannak; `php
   tests/guide-store-test.php` – a mentett kép a védett tárhelyre kerül, és a `Pipeline` a heróhoz
   azt adja vissza `structure_image`-ként (a tesztszolgáltatóval, valódi hálózat nélkül).

## 3. Amit nem szabad elrontani

- A vezetőkép nem lehet nyilvános URL-en (ügyféladat-szabály), és nem kerülhet a repóba.
- A meglévő projektek és a mai `GuideRenderer` működése maradjon.
- A képgenerálás költsége ne nőjön: a vezetőkép nem külön hívás, ugyanannak a kérésnek a része.
- A 3D-s vezetés kikapcsolható maradjon (`magnific.structure_guidance`).
