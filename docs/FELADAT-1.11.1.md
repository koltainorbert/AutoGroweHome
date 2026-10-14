# FELADAT – 1.11.1: a Klón ne halucináljon

Norbi szövege (2026-10-14), a saját oldaláról küldött két képpel (bal: élő 3D vázlat,
jobb: `7c82796d-hero.jpg`):

> hasonlisd össze mi a baj a két kép között Similar kell!! Clone egyszerűen nem halucinalhat

## 1. A két kép különbségei (a képekről leolvasva)

| # | 3D modell (amit a látogató felépített) | A generált kép | Minősítés |
|---|---|---|---|
| 1 | **Egy** épület + különálló garázs | **Négy-öt** épület: hosszú fa pajta, további nyeregtetős szárnyak, toronyszerű rész | halucináció |
| 2 | **Vörösbarna** cserépfedés | **Antracit/pala** tető | ellentmondó prompt |
| 3 | Pergola a terasz felett, oszlopokkal | Pergola sehol, helyette fa paravánfalak | hiányzó elem |
| 4 | Különálló, lapostetős garázs jobbra | Nincs garázs; helyén újabb lakóépület | halucináció |
| 5 | Barna zsalugáterek az ablakokon | Nincs zsalugáter | hiányzó elem |
| 6 | Szemmagasság körüli háromnegyedes nézet | Magas, madártávlati nézet | nézőpont elcsúszott |
| 7 | Két szint, meredek nyeregtető | Vegyesen egy- és kétszintes tömegek | forma elcsúszott |

## 2. Gyökérokok (a kódban mérve)

1. **A prompt maga rendel plusz épületet.** A „Vidéki, rusztikus” stílus szövege
   (`Catalog::styles()`): *„long narrow farmhouse with a covered porch (tornac) **and a barn
   wing**…”*. A 3D soha nem épít pajtaszárnyat, a képmodell viszont megépíti. A tájleírás
   („on a lowland farmstead with vast fields”) ezt még erősíti.
2. **A tetőszín ellentmond a modellnek.** `Catalog::roof_prompt()` a kiválasztott (vagy
   automatikusan választott) tetőtermék `color_en` mezőjét írja a promptba, a 3D viszont a
   `roof_color` mezőből fest. Ha a kettő eltér, a prompt mást mond, mint amit a látogató lát –
   mérve: `roof_color = #8C4A35` (vörösbarna) mellett a prompt „Classic Roman-profile concrete
   roof tiles **in anthracite**”, és utána „**anthracite** gutters and downpipes”.
3. **A vezetőkép és a kész kép képaránya nem egyezik.** A vezetőkép 1152×656 (1,756), a
   szolgáltatótól visszajött kép 1280×779 (1,643). A structure referencia így nyújtva/vágva
   kerül a képre, a geometria elcsúszik.
4. **A hűség mondata a prompt végén van, és nem tiltja a plusz épületet.** A képmodellek az
   eleji szöveget súlyozzák jobban, és ami nincs megtiltva, azt megteheti.

## 3. Mi legyen (mérhetően kész)

1. **„Hű” és „Klón” fokozaton a referencia-utasítás a prompt ELEJÉRE kerül**, és kimondja:
   pontosan egy épület, a referenciaképen látható módon; tilos pajtát, melléképületet, további
   szárnyat vagy második házat hozzátenni; a garázs, terasz, pergola, erkély, zsalugáter csak
   ott és úgy, ahogy a referencián van. Kész: a kérés promptja ezzel a blokkal kezdődik, és
   tartalmazza a tiltást.
2. **A stílusszövegből kikerül a pajtaszárny** (a 3D nem építi). Minden más stílusszöveg marad.
3. **A tető színe a modellt követi**: ha a `roof_color` eltér a termék színszövegétől, a prompt a
   modell színét mondja (a termék típusa marad). Kész: `roof_color = #8C4A35` mellett a promptban
   nincs „anthracite” a tetőnél.
4. **A vezetőkép képaránya a kész képéhez igazodik**, és **magát mérjük**: az első kész képből a
   plugin kiolvassa a tényleges képarányt, elteszi (`magnific.guide_aspect`), és a következő
   vezetőképek már abban készülnek. Alapérték a mért 1,645. Kész: a vezetőkép képaránya 2%-on
   belül egyezik a kész képével.
5. **Teszt**: `php tests/guide-test.php` bővítése – klón módban a prompt a referenciablokkal
   kezdődik, tartalmazza az „exactly one building” tiltást, nincs benne „barn wing”, és a
   tetőszín a modellé; a `guide_aspect` mérése kerek képekre is helyes.

## 4. Amit nem szabad elrontani

- Szabad és Kiegyensúlyozott fokozaton a prompt sorrendje és szövege maradjon a mai.
- A tetőtermék neve és típusa maradjon a promptban (BRAMAC-követelmény).
- A vezetőkép mérete ne nőjön 1,5 MB fölé, a kérés ne lassuljon.
- **Őszintén:** a képmodell továbbra sem renderelő. A tiltás és az erősebb vezetés a plusz
  épületeket és a durva elcsúszást szünteti meg; az apró részletek (ablakosztás, kőminta,
  növényzet) képenként továbbra is változnak.
