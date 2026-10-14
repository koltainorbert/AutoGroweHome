# FELADAT – 1.11.0: fotórealizmus és a 3D ház klónozása

Norbi szövege (2026-10-14):

> és fotorealisztikus, életszerű igazihoz megszólalásig hasonló lesz? olyan mint amit adtam
> képeket? ilyen minőpség kell a világon a legszebb legrészletesebb és iszonyuan fontos hogy
> clonozza a hazat amit 3d ben feltette

**Minden maradjon meg**: az 1.10.0 vezetőképes út, a promptépítés, a három koncepció, a galéria,
a költségkeretek, a tesztszolgáltató. Ami hozzájön: a hűség legyen **állítható és erős**, és a
kép mondja is meg a modellnek, hogy a referenciakép a ház pontos tömege.

## 1. Hol tart ma (mérve)

- A hero promptja 2915 karakter, és már ma kéri a fotórealizmust: „Professional architectural
  visualization… Ultra-realistic, physically plausible photograph of a real, buildable house…
  Shot on a 24mm tilt-shift lens… High-end real-estate photography quality”.
- Beállítások: `mystic_model=realism`, `engine=automatic`, `creative_detailing=33`,
  `preview_resolution=2k`, `final_resolution=4k`, `upscale_enabled=false`,
  `structure_guidance=true`, `structure_strength=45`.
- **A prompt egy szóval sem említi a referenciaképet**: a modell kapja a 3D képet, de nincs
  megmondva neki, hogy azt a tömeget kell követnie. Ez a legolcsóbb nyereség.
- A hűség ma egyetlen nyers szám (0–100), amit az üzemeltetőnek kell eltalálnia.

## 2. Mi legyen (mérhetően kész)

1. **Hűség-kapcsoló** (`magnific.fidelity`): Szabad (25) · Kiegyensúlyozott (45) · Hű (65) ·
   Klón (80) · Egyedi (a `structure_strength` értéke). Alapérték: **Hű**.
   Kész: a kiválasztott szint szerinti `structure_strength` megy ki a kérésben.
2. **A prompt megmondja, mi a referenciakép.** Ha vezetőkép megy a kéréssel, a prompt végére
   kerül egy mondat a hűség szerint; „Klón”-nál a legszigorúbb: a tömeg, a tetőforma és -hajlás,
   a nyílások helye és mérete pontosan a referenciaképé, csak az anyagok és a fény legyenek
   fotórealisztikusak. Vezetőkép nélkül nem kerül bele semmi (a mai viselkedés).
   Kész: a kérésben a prompt tartalmazza a mondatot, és 400 karakternél nem nő többet.
3. **Minőség**: a kiválasztott koncepció galériája maradjon 4k; a felskálázás kapcsolója kapjon
   olyan súgót, ami megmondja, mikor éri meg (külön költség).
4. **Dokumentáció**: külön szakasz arról, mit tud és mit nem tud a képgenerálás – mi az, ami
   klónozható (tömeg, tető, nyílások, anyagok), és mi az, ami változni fog (apró részletek,
   növényzet, égbolt), és milyen beállítással mit kap az üzemeltető.
5. **Teszt**: `php tests/guide-test.php` bővítése – mind az öt hűségszinten a kérésben a várt
   `structure_strength`, és „Klón”-nál a prompt tartalmazza a szigorú mondatot; vezetőkép nélkül
   a prompt változatlan.
6. Új szöveg mind a 15 nyelvre.

## 3. Amit őszintén meg kell mondani (nem mérhető ebben a környezetben)

- A tesztoldalon nincs éles Magnific-kulcs, ezért **a kép szépsége és hűsége itt nem mérhető**;
  csak az, hogy mi megy ki a szolgáltatónak. A tényleges minőséget Norbinak kell az éles kulccsal
  végigpróbálnia, a hűség-kapcsolóval.
- Diffúziós képmodell nem renderelő: 100%-os klón nincs. A tömeg, a tetőforma, a nyílásrend és az
  anyagok tarthatók; a konkrét ablakosztás, a kőminta és a kert részletei képenként változnak.
  Minél erősebb a hűség, annál pontosabb a forma és annál kevésbé „fotó” a kép – ez a kompromisszum,
  ezért kell a kapcsoló.
