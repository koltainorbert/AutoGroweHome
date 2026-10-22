# FELADAT – 1.17.0: stúdió-minőségű fotó, minden irányból saját 3D kép

Norbi szövege (2026-10-22 12:50):
1. „a kép generálás kezd jó lenni!! ez a jó út! az első képeken a szemben a házzal jó, de a járműveket
   már a 3D tervezőben igazi élethűre kell cserélni!! és a tárgyakat, embereket!”
2. „A kép, amit ad, nem stúdió minőség – olyan képek kellenek, mint amikor egy fényképész egy beállított
   képet csinálna a házról: tökéletes fények, fotóminőség, hiperrealisztikus! De az odaadom a képet
   technológia bevált!!!! maradjon, csak menjen neki prompt is.”
3. „A házról ne csak 1 képet adj! mert a kertnézet és a hátsó oldalsó viszont selejt! Minden irányból
   készíts képet a 3D házról és azt add oda.”
4. „a kültéri eszközöket a 3D tervezőben nem tudom mozgatni, se az ablakokat, ajtókat, kéményt, semmit”

**Minden maradjon meg**: a „Fotó a 3D képből” út (a 3D kép a bemenet) – Norbi: „bevált, maradjon”.

## Ebben a verzióban
- **2. Fotós prompt** (`PromptEngine::photo_prompt()`): „díjnyertes építészfotó, mintha egy profi
  ingatlanfotós állította volna be”: full-frame, 24 mm tilt-shift, korrigált függőlegesek, f/8,
  bracketelt HDR, a beállított napszak fénye (alap: oldalról jövő aranyóra), lágy hosszú árnyékok,
  derítés, anyagok mikrorészletei, magazinminőség. A tárgyak színe is marad („in its colour”). Esti
  nézet: kék óra, égő belső és kerti fények. Próba a Magnific-appban Norbi 3D képén (100 kredit):
  aranyórás, kidolgozott fotó, minden tárgy a helyén (az autó színe az első próbán megváltozott → a
  promptba bekerült a szín megtartása).
- **3. Minden irányból saját 3D kép**: gyökérok – a kerti nézetnek nem volt 3D képe (a böngésző csak
  elöl/hátul/bal/jobb/madártávlat képet küldött), ezért a régi úton, kitalált házzal készült; az esti
  nézetnek sem volt. Most: a kerti nézet saját 3D képet kap (a terasz felőli másik sarokból), az esti
  nézet a fő kép 3D képét. Fotó módban a nézetek alapból csak a saját 3D képükből készülnek (a fő kép
  nézőpontja nem szivárog a hátsó/oldalsó nézetbe); az admin visszakapcsolhatja („A nézetek a fő képet
  is megkapják”).
- Kész: `tests/photo-test.php` 28/28 (fotós prompt, esti nézet a fő kép 3D képéből, kerti nézet a
  saját 3D képéből, nincs második kép); `e2e/guide.js`: a galéria 6 iránya + teljes jelenetek, konzolhiba 0.

## Következik (ütemterv, Norbi sorrendje szerint)
- **1.18.0 – Mozgatás a 3D tervezőben (4. pont)**: kerti tárgyak (pergola, medence, bútor, grill,
  tűzrakó, tároló, játszótér, fák), ablakok, ajtók, kémény megfogása és húzása a tervező 3D-jén és az
  alaprajzon, forgatás, Shift = egyenesbe; mentés a projektbe; a fotó a mozgatott helyet kapja.
- **1.19.0 – Élethű járművek, emberek, tárgyak a 3D-ben (1. pont)**: a mai egyszerű formák helyett
  részletes modellek. Őszintén: a valódi 3D modellekhez (1.13.0, CC0 GLB) letöltés és tárhely kell –
  háttérszerver nélkül a pluginba csomagolva, kis számú, optimalizált modellel. Addig a fotó mód a
  helyükön valódi autót, embert, állatot fest (a próbán így volt).
- Utána: helyiségprogram m² szerint, díszítőanyag helye, medence- és garázsrészletek, melléképületek.
