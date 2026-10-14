# FELADAT – 1.12.0: életszerű fotóminőség – stílusminta, negatív prompt, két külön erősség, belső vezetés

Norbi szövege (2026-10-14), két képpel (1. a kívánt minőség, 2. amit a kézi recepttel kapott):

> Következő feladat: a képgenerálás négy hiányzó darabja — stílusonkénti mintakép style-referenciaként,
> a konfigurációból generált negatív prompt, külön állítható structure- és style-erősség, és 3D vezetés
> a belső nézetekhez is. A recept bevált kézzel: 3D = structure (70–85), mintafotó = style (40–50),
> negatív prompt a téves alternatívákra.
>
> Meg oar keres! Szoval elvileg megvan amit akarunk hogy csodat kapjunk! De azert amit kaptam a kezi
> promtnal meg messze nem az a minoseg amit akarok! Nem elethu elegge! […] Az elso kep amit akarok a
> masodik amit kaptam a kezzel keszitettel.
>
> Hozza kell tennem!!!! Csak minosegben akarom ezt maga a kepek meg mennyiseg forma ahogy az szuper volt
> eddig is onallo kepek es adatok

**Az 1. kép CSAK minőségi mérce.** A bemutatótábla-elrendezés (alaprajz, ikonok, szöveg egy lapon) nem
kell: a képek száma, formája, az önálló képek és az adatok pontosan úgy maradnak, ahogy ma vannak.

**Minden maradjon meg**: a három koncepció, a galéria nézetei, a belső nézetek száma, a hűség-kapcsoló
öt fokozata, a referenciablokk a prompt elején, a tetőszín a modellé, a mért `guide_aspect`, a
tesztszolgáltató, a költségkeretek, a `GuideRenderer`, a nézetek Flux-referenciás útja.

## 1. A két kép összevetése (leolvasva)

| # | 2. kép (kapott) | 1. kép (kívánt) | Ok |
|---|---|---|---|
| 1 | Magas, madártávlati nézőpont | Szemmagasság, enyhe háromnegyed | a hero a látogató kamerájából megy, ami gyakran magasan áll |
| 2 | Autók, motorok, emberek, kutya „játék” formájú, részlet nélkül | Nincs ilyen tárgy, vagy valódi | a 3D vezetőképen ezek low-poly tömbök, és a structure referencia ezeket a formákat másolja |
| 3 | Kúp alakú fák a háttérben, köd | Valódi fák, tiszta levegő | ugyanaz: a 3D táj kúpfái és ködje a vezetőképen |
| 4 | Telített, „AI-fényes” színek, túl tiszta kő | Természetes színek, matt anyagok | Mystic `engine=automatic`, `hdr` nincs megadva, nincs fotóminta (style reference) |
| 5 | A kép „szép render”, nem fotó | Fotó: arany óra, belső meleg fények | a hero csak szöveget és structure képet kap, fotó-mintát nem |

## 2. Gyökérokok (a kódban és a Magnific dokumentációjában mérve)

1. **Nincs stílusminta a fő képhez.** `MagnificProvider::submit()` a `style_reference`-t csak a nézetekhez
   (hero mint referencia) küldi; a hero kizárólag szövegből + structure képből készül.
2. **A Mystic API-ban nincs negatív prompt mező** (docs.magnific.com, `POST /v1/ai/mystic`, 2026-10).
   A mai „Avoid: …” lista a pozitív prompt végére kerül (`PromptEngine::combined()`), és nem a
   konfigurációból jön: a téves alternatívákat (rossz tetőforma, rossz tetőszín, plusz szint) nem nevezi meg.
3. **Egyetlen erősség van.** A hűség (`magnific.fidelity`) csak a structure erősséget adja; a style
   erősség (`style_adherence`) csak a nézetekre hat, és a Mystic-ben az `adherence` fordított értelmű:
   nagyobb érték = jobban követi a promptot, kisebb = jobban a stílusmintát.
4. **A belső nézetek semmilyen vezetést nem kapnak.** `Pipeline::render()`: `'interior' === $op ? ''`.
5. **A vezetőkép „piszkos”.** A hero az élő nézetből készül, rajta autók, emberek, állatok low-poly
   tömbként, kúpfák és köd → a structure referencia ezeket a formákat adja tovább (2. és 3. sor).
6. **Mystic beállítások:** `engine=automatic`; a doksi szerint a `magnific_sharpy` a fotórealizmusé; a
   `hdr` (csak style reference mellett hat) alacsonyabb értéken természetesebb.
7. **A referenciablokk a prompt elejére kerül, de a hossz nincs újraszámolva**: blokk + prompt a
   3900 karakteres határ fölé mehet, és a `clip()` a végét (a negatív listát) vágja le.

## 3. Mi legyen (mérhetően kész)

1. **Stílusonkénti mintakép (style reference).** Admin → Magnific: stílusonként (22 + egyedi) egy
   médiatár-kép, plusz egy általános tartalék és egy belső tér minta. A hero és a homlokzati nézetek
   Mystic-útján ez megy `style_reference`-ként (a nézetek Flux-útja és a hero-referencia marad).
   A kép a szerveren legfeljebb 1536 px-re kicsinyítve, JPEG-ben megy. Repóba kép nem kerül.
   Kész: beállított minta mellett a hero kérésében ott a `style_reference`, nélküle nincs (mai viselkedés).
2. **Negatív prompt a konfigurációból** (`PromptEngine::config_negative()`): a választott értékek téves
   alternatívái – tetőforma, tetőszín-család, szintszám, homlokzatanyag, homlokzatszín, ablakkeretszín,
   garázs, medence, erkély, kémény, napelem – plusz a plusz épületek tiltása kívül, és a plusz
   bútor/nyílás tiltása belül. A kérés külön `negative_prompt` mezőben viszi; olyan szolgáltatónál, ahol
   nincs ilyen mező (Mystic, Flux), a prompt végére, az „Avoid” mondatba kerül. Kész: `roof_color=#8C4A35`,
   nyeregtető, kétszintes ház mellett a negatív prompt tartalmazza az „anthracite roof”, „flat roof”,
   „single-storey” elemeket, és nem tartalmazza a ház saját értékeit.
3. **Két külön erősség**: `structure_strength` (a hűség-kapcsoló adja; Hű = 75, Klón = 85, Egyedi = a szám)
   és új `style_strength` (alap 45, 0–100) → Mystic `adherence = 100 − style_strength`. Új `hdr` beállítás
   (alap 35), `mystic_engine` alapja `magnific_sharpy`. Kész: a kérésben `structure_strength = 75`,
   `adherence = 55`, `hdr = 35` alapbeállításon.
4. **3D vezetés a belső nézetekhez**: a böngésző a renderelendő helyiségekről (`render` jelölésű szobák,
   legfeljebb 8) a belső nézet kameraállásából vezetőképet készít (`interior_<szobaazonosító>`), a szerver
   eltárolja, és a belső kép kérése structure referenciaként viszi, külön belső referenciablokkal
   (ugyanaz a szoba, falak, nyílások, bútorhelyek; nincs plusz bútor). Kész: a belső kérésben a
   `structure_image` nem üres, a prompt a belső blokkal kezdődik.
5. **Tiszta vezetőkép** (`magnific.guide_clean`, alap be): a vezetőképről lekerülnek a járművek, az
   emberek, a háziállatok, a háttér kúpfái és a köd. A prompt továbbra is leírja őket, így a képmodell
   valódi formában festi meg. Kész: a tiszta hero vezetőkép más, mint az élő nézet, és mind a 6 + belső
   nézet elkészül.
6. **Fotós kameramagasság a herónál** (`magnific.hero_camera`: `auto` alap / `visitor`): `auto` esetén a
   látogató iránya marad, de ha a kamera 18°-nál magasabbról néz (és a „Fő kép kameraállása” nem
   madártávlat), a vezetőkép szemmagasság-közeli állásból készül. `visitor` = a mai pontos kameraállás.
7. **A prompt hossza újraszámolva**: referenciablokk + prompt + negatív együtt fér a határba; a negatív
   lista soha nem vágódik le. Kész: 3900 karakter alatt, a végén a negatív lista teljes.
8. **Dokumentáció, fordítás**: KONFIGURACIO.md és ADMIN-KEZIKONYV.md – a recept (structure 70–85,
   style 40–50, negatív), hogyan készüljön jó mintakép; minden új felirat mind a 15 nyelven.
9. **Teszt**: `tests/guide-test.php` bővül (style reference megy/nem megy, adherence/hdr értékek, negatív
   prompt tartalma, belső vezetőkép és belső blokk, hosszhatár, a nézetek mai útja változatlan);
   `tests/e2e/guide.js`: a 6 külső + belső vezetőkép elkészül, a tiszta hero eltér az élő képtől.

## 4. Amit nem szabad elrontani

- Képek száma, nézetei, formája, adatai: változatlan (Norbi kifejezett kérése).
- Vezetőkép és mintakép nem lehet nyilvános URL-en a projekthez kötve; a mintakép a médiatárban van
  (nem ügyféladat), a vezetőkép a védett tárhelyen.
- A tetőtermék neve és típusa a promptban marad (BRAMAC).
- Szabad és Kiegyensúlyozott fokozaton a prompt sorrendje a mai.
- A költség nem nő: minden kép egy hívás marad.

## 5. Őszintén (nem mérhető ebben a környezetben)

- A tesztoldalon nincs éles Magnific-kulcs: a kép **szépsége itt nem mérhető**, csak az, hogy mi megy ki.
  Az alapértékek (Sharpy, hdr 35, structure 75, style 45) a Magnific dokumentációjából és Norbi kézi
  receptjéből jönnek, nem saját mérésből.
- A Mystic-nek nincs valódi negatív mezője: a prompt végi „Avoid” gyengébb, mint egy igazi negatív prompt.
- A „csodát” a jó mintakép adja: a stílusmintának valódi, szemmagasságból készült építészeti fotónak kell
  lennie, a kívánt fénnyel – ezt Norbinak kell feltöltenie stílusonként.
