# FELADAT – AutoGroweHome 1.8.0 (Norbi 2026-10-13-i listája)

Ez a dokumentum a munkaprompt. Új chatben ezt a fájlt kell megnyitni a CLAUDE.md, a
claude/ALLAPOT.md és a claude/ATADAS.md után, és pontonként végigvinni.

## Keret (minden pontra érvényes)

- **Semmi nem vész el.** Az 1.7.0 minden funkciója, mezője és viselkedése megmarad.
  Ami ma működik (tárgyak helyiségenként, önjavító berendezés, táj, szomszédok,
  Újrakezdés, erkély, napelem, kert), az a 19 pont után is ugyanúgy működik.
  Mező törlése, átnevezése, alapérték-csere csak akkor, ha a pont kifejezetten ezt kéri.
- **Mind a 19 pont kell, maradéktalanul.** Részmegoldás nem kész. Ha egy pont nagy,
  akkor is teljes értékűen kell elkészülnie, nem „alapszinten”.
- **Először ellenőrizd, létezik-e már a mező.** Több tétel (pince, padlás, lépcső,
  erkély, hófogó, tetőszellőző, könyvespolc) **már létező paraméter**: ezeknél a hiba a
  3D megjelenítésben van, nem a paraméterlistában. Új, duplikált mezőt tilos felvenni.
- **Minden látható paraméter három helyen él együtt:** `includes/Params/Definitions.php`
  (mező + prompt szöveg), `assets/js/agh-sketch.js` (közös terv, 2D), `assets/js/agh-3d*.js`
  (megjelenítés). Új mezőnél mindhárom bővül, plusz `Validator`, `PromptEngine`, és a
  fordítás (`.pot` + mind a 15 `.po`).
- **Munkarend:** teszt → commit (magyar üzenet) → `git fetch origin main` → rebase →
  `git push origin main`. Force push soha. Kódváltozás előtt `bin/bump-version.sh minor`
  (ez 1.8.0), CHANGELOG kitöltése, végül `bin/build-zip.sh`, a `dist/` külön commitban.
- **Ellenőrzés sorrendje:** számszerű teszt (autoloader, lint, sketch, po-tools, E2E)
  először; képernyőkép funkciónként legfeljebb egyszer, a végén.
- **Ami nem mérhető, azt írd ki mérés nélkülinek** (pl. „szép-e”), és mutasd meg képen.

## Prioritási sorrend

1. Hibák, amik ma zavarják a használatot: **1, 16, 17, 19, 2, 3, 4**
2. A legnagyobb munka: **5** (belső nézet) és **6** (modellre kattintás → mező)
3. Új tartalom: **8, 9, 10, 7**
4. Berendezés és részletek: **11, 12, 13, 14, 15, 18**

---

## 1. Kereső: egy betű után kidob

**Hiba:** a paraméterkeresőbe egy betűt írva a mező elveszti a fókuszt, újra bele kell
kattintani.

**Gyökérok (megtalálva, `assets/js/agh-designer.js` ~658–666):** a `renderFields()` a
fókuszt csak az `els.fieldsList`-en belül állítja vissza (`keepFocus`), a keresőmező
viszont a `fieldsHead`-ben van, amit minden rendernél `clear()` ürít, majd az input DOM
csomópontját újra beszúrja. Az áthelyezés (re-parent) elveszi a fókuszt és a kurzort.

**Kész, ha:**
- A fejléc nem épül újra gépelésre: a keresőmező egyszer jön létre, és a helyén marad
  (a `clear(els.fieldsHead)` nem érinti, csak a `h3` címke szövege frissül).
- 20 karakter folyamatos gépelése közben a fókusz végig a mezőn marad, a kurzor a szöveg
  végén, a kijelölés nem ugrik.
- A `debounce(150)` megmarad, a találatlista frissül gépelés közben.
- Törlés (X), Esc és kategóriaváltás továbbra is üríti a keresőt.
- **E2E teszt:** `tests/e2e/search.js` – betűnként beír egy szót, minden leütés után
  ellenőrzi `document.activeElement`-et és a `selectionStart`-ot. 0 fókuszvesztés.

## 2. Tetőszellőző kilóg a tetőből

**Hiba:** a `roof_ventilation` / `roof_vent_type` elemei a tetősíkon kívülre kerülnek.

**Kész, ha:**
- Minden szellőzőelem a tetősík poligonján **belül** van, a saját típusának megfelelő
  helyen: szellőzőcserép a tetősíkon, gerincszellőző a gerincvonalon végig,
  turbina és gomba a gerinc alatt, a tetősík normálisa szerint döntve.
- Az elem a tetősík dőlésszögét követi (nem függőleges egy ferde tetőn).
- Lapostetőnél csak a lapostetőhöz illő típus jelenik meg.
- **Mérés:** 200 véletlen tetőváltozat (minden tetőforma × minden szellőzőtípus),
  minden elem befoglalója a tetőpoligonon belül, tűrés 0; kilógó elem 0.

## 3. Hófogó csúnya

**Hiba:** a `snow_guards` megjelenítése durva.

**Kész, ha:**
- A hófogó valódi rácsos/csöves hófogó: két tartókonzol között vízszintes elem, az
  eresszel párhuzamosan, az eresztől 2–4 cserépsornyi távolságra, a tetősíkra simulva.
- Osztása a tetőhossz szerint ismétlődik, nem egy hosszú doboz.
- Színe a bádogozáshoz (`flashing`) vagy a tetőhöz igazodik.
- Instanced geometria, hogy ne lassítson (a tetőelemek összes rajzolási hívása ne nőjön
  5 fölé tetősíkonként).
- Cserépfedésnél és korcolt lemeznél más a forma (rács vs. csőbak).

## 4. Dryvit faldekor körbe fehér

**Hiba:** a dryvit (vakolt hőszigetelés) dekor keret/sáv körben fehér, csúnya.

**Kész, ha:**
- A dekorsáv (ablakkeretezés, lábazati és koronázó párkány) **a homlokzat színéhez
  igazodó**, a felhasználó által választott vagy abból származtatott árnyalat, nem
  automatikus fehér.
- A sáv a nyílásokat valóban körbeveszi, egyenletes szélességgel, a sarkoknál illesztve;
  nem lóg át a sarkon és nem fed ablakot.
- Legyen választható: nincs dekor / homlokzattal azonos / világosabb árnyalat /
  sötétebb árnyalat / kő hatású. Alapérték nem a fehér.
- A lábazat és a dekorsáv anyaga/textúrája eltér a sima vakolatétól (mélység, árnyék).

## 5. Belső tér nézet – ez a legfontosabb pont

**Hiba (Norbi szava szerint):** „túl kicsi, a plafon árnyéka zavaró, ez a belső nézet
sehol sem jó, kicsi a falak szűkek”. **Kérés: a világon a legjobbra megoldani.**

**Kész, ha (mind kell):**
- **Kameraállás:** a szoba a vászon legalább 85%-át kitölti. A kamera a szoba
  átlójában, szemmagasságban (1,55–1,65 m), a látószög a szoba méretéből számolva
  (nem fix FOV): kis szobánál tágabb, nagy térnél szűkebb, de perspektivikus torzítás
  nélkül (függőleges élek függőlegesek maradnak – kétpontos perspektíva).
- **Plafon:** a nézetből kivágott plafon nem vet zavaró árnyékot a térbe. A plafonsík
  árnyékvetése kikapcsolva, helyette lágy, egyenletes mennyezeti fény.
- **Fények:** egy lágy fő fény (ablak felől, nappali színhőmérséklet), kitöltő fény
  szemből, és a lámpatestekből meleg pontfények. Nincs kiégett fehér folt és nincs
  fekete sarok: a hisztogram 2% alatt és 98% fölött ne legyen levágás.
- **Falak:** a látszó falak (hátsó + bal) teljes magasságban látszanak, a jobb és első
  fal kivágott marad. A szoba nem tűnik szűknek: a bútor–fal távolságok,
  a közlekedősáv (min. 80 cm) és a bútorméretek valós arányban vannak.
- **Méretarány:** a belmagasság a `ceiling_height` szerint látszik; egy 2,7 m-es
  belmagasság és egy 180 cm-es ajtó aránya képen is helyes.
- **Anyagok:** padló, fal, textil külön textúrával és érdességgel; tükröződés a
  csempén és az üvegen.
- **Mérés:** 50 véletlen szoba renderelve; a szoba befoglalója a képnek legalább 85%-át
  fedi, 0 levágott (képből kilógó) bútor, és minden képen a konzol 0 hibát ír.
- **Sebesség:** a mai szint ne romoljon (SwiftShaderen szoba tárgyakkal ≤ 150 ms).
- Végül **egy képernyőkép** nappaliról, hálóról, fürdőről és konyháról, előtte-utána.

## 6. Modellre kattintás → ugorjon a mezőhöz

**Kérés:** ha a 3D modellben rákattintok egy tárgyra (pl. egy székre), a bal oldali
beállítások ugorjanak oda, ahol az adott tárgy van. Ne kelljen a nevét keresőbe írni.

**Kész, ha:**
- A 3D-ben minden felhelyezett tárgy ismeri a hozzá tartozó mezőt és opciót
  (`userData.field`, `userData.value`, `userData.room`).
- Kattintásra (raycast): a bal oldal átvált a mező kategóriájára, a listát odagörgeti,
  a mező kiemelve villan egyet, és a kijelölt opciókártya kap egy keretet.
- Ugyanez működik a 3D-ben a házon kívül is (tető, homlokzat, nyílászáró, kert).
- Ha a tárgyhoz nem tartozik szerkeszthető mező, a kattintás ne csináljon semmit
  (ne ugorjon rossz helyre), de a tárgy neve jelenjen meg egy rövid buborékban.
- Érintésen is működik (telefon), és nem akadályozza a forgatást: csak kattintásnak
  számít, ha a mozgás 6 px alatt maradt.

## 7. Több külső helyszín

**Kérés:** több táj a mai 8 helyett (`landscape`, `assets/js/agh-3d-land.js`).

**Kész, ha** az új helyszínek a meglévők mellé kerülnek, mindegyik saját domborzattal,
növényzettel, talajjal, utcaképpel és éggel:
- szőlőhegy / présházas domboldal, alföldi tanya, folyópart, patakvölgy,
  fenyves hegyvidék, puszta, városi utcasor (zártsorú), ipari/külvárosi telek,
  sivatagos/mediterrán, havas táj.
- A „stílushoz illő” (`auto`) leképezés minden új stílusra is megvan
  (JS `STYLE_LAND` = PHP `Definitions::landscape_for_style`, a két oldal egyezését
  teszt ellenőrzi).
- Minden tájhoz kártyakép készül, a kép a 3D-ből, „full” módban.
- **Mérés:** minden táj felépül, első felépítés ≤ 250 ms, váltás ≤ 80 ms
  (SwiftShader), konzolhiba 0.

## 8. Új házformák

**Kérés:** magyar kádeerkocka (kockaház), 2–3 amerikai lapostetős, klasszikus magyar
parasztház, klasszikus magyar kicsi pince.

**Kész, ha** mind az öt stílus a stílusválasztóban (1. lépés) szerepel, saját
tömegformával, szintszámmal, tetővel és anyagjavaslattal (`Catalog::style_seed`),
és mindegyikhez van kártyakép:
- **Kádeerkocka (magyar kockaház):** ~10×10 m négyzetes alaprajz, földszint + tetőtér,
  négy irányba lejtő sátortető 35–45°, cserép, vakolt homlokzat, középen bejárat,
  jellemző előtető és lábazat, kis padlásablak az oromzaton.
- **Amerikai lapostetős, 3 változat:** (a) mid-century modern, széles ereszkiülés,
  nagy üvegfal, egy szint; (b) modern dobozos, két tömeg, részben emeletes, fa
  burkolat + vakolat; (c) sivatagi/Palm Springs, alacsony tömeg, kiálló
  tetőlemez, karakteres bejárati fal.
- **Klasszikus magyar parasztház:** hosszú, keskeny tömeg (oldalhatáron álló),
  oromfalas nyeregtető 45°, tornác faoszlopokkal végig, kis osztott ablakok,
  meszelt fal, kémény, hátul istálló/kamra toldás.
- **Klasszikus magyar kicsi pince (présház / borospince):** egy kis tömeg,
  dongaboltozatos pinceág a domboldalba, boltíves bejárat, kis oromfal, nyeregtető,
  előtte terasz, kő lábazat.
- Minden új stílushoz: tájpárosítás (7. pont), szomszédpaletta (`HOOD`), belső tér
  stílusjavaslat, prompt szöveg, és a 15 nyelvű fordítás.
- **Mérés:** stílusonként 32 véletlen házváltozat generálva, 0 hiba, a 2D vázlat és a
  3D ugyanazt a tömeget adja.

## 9. Ház alatti szint (pince)

**Mai állapot:** a `basement` mező **létezik** (`massing`, toggle), de a 3D-ben nem látszik.

**Kész, ha:**
- A pince valódi szintként épül: padlósík a terep alatt, falak, pincelépcső, amely a
  földszinti lépcsőhöz csatlakozik.
- Kívül: terepbe vágás, pinceablakok (angolakna), külső pincelejárat, ha van.
- Belül: a helyiségválasztóban megjelenik a pince szint (gépészet, tároló, borospince,
  mosókonyha), és a belső nézet oda is átvált.
- A tárgyak helyiségenkénti rendszere (`room_items`) a pincét is kezeli.
- A prompt leírja a pincét (`PromptEngine`).
- Részleges és teljes alápincézés megkülönböztetve.

## 10. Padlás

**Mai állapot:** az `attic` mező **létezik**, 3D-ben nincs tartalma.

**Kész, ha:**
- Beépítetlen padlás: fedélszék (szarufa, szelemen, torokgerenda) látszik, padlásfeljáró
  (létra vagy lépcső), padlásablak/tetőablak, deszkázott födém.
- Beépített tetőtér: ferde síkok, térdfal, tetőablakok, az itt lévő helyiségek a
  helyiségválasztóban is megjelennek.
- A padlásfeljáró a lépcsőrendszer része (16. pont).
- Kívül: tetőablak vagy padlásablak a megfelelő tetősíkon, a 2. ponttal összhangban.

## 11. Ajtókeretek

**Kész, ha:**
- Minden belső ajtónyílás kap tokot és takarólécet: 5–8 cm széles keret a nyílás körül,
  küszöb vagy padlóváltás a nyílásban.
- Az ajtólap stílushoz illő (sima, kazettás, üveges), nyitásirány és pántok látszanak.
- A keret anyaga/színe a belső stílushoz igazodik, és külön választható
  (fehér, fa, fekete, falszínű).
- A bejárati ajtó kávája kívülről is kerettel, kőpárkánnyal.
- Az ajtósáv szabadon tartása (önjavító berendezés) a kerettel együtt számol.

## 12. Radiátorok

**Kész, ha:**
- Minden fűtött helyiségbe radiátor kerül, alapból az ablak alá, ha ott nincs hely,
  szabad falszakaszra; a fürdőbe törölközőszárítós radiátor.
- Típus választható: lapradiátor, bordás (tagos), törölközőszárító, konvektor,
  nincs (padlófűtés esetén rejtve).
- Padlófűtésnél radiátor nincs, de a fürdőben a szárító maradhat.
- A radiátor nem takar ajtót, nem lóg bútorba (az önellenőrzés rá is vonatkozik),
  padlótól 10–12 cm-re lebeg, csövekkel.

## 13. Gyerekszoba – fiús és lányos berendezés

**Kész, ha:**
- A gyerekszobához külön mező van: semleges / fiús / lányos / baba / tini
  (és „a stílushoz illő”).
- Mindegyikhez saját teljes berendezés: ágy (emeletes, házikó, autó, baldachinos),
  íróasztal, szekrény, polc, játéktároló, szőnyeg, falszín, textil, lámpa, dekoráció.
- Két gyerekszobánál a két szoba eltérő berendezést kap.
- A prompt helyiségenként írja le (a mai `room_items` rendszerrel).
- Minden tárgy a szobán belül, az ajtósáv szabad (az önjavítás rájuk is fut).

## 14. Akváriumok

**Kész, ha:**
- Méret: kicsi (asztali ~60 cm), közepes, nagy (160–200 cm), széles panoráma.
- Forma: szögletes, kerek/gömb, henger, sarok, falba épített.
- Típus: édesvízi (növényes, akvascape, homok, kavics, uszadékfa) és tengeri
  (élőkő, korallok, fehér homok, kék fény).
- Látvány: üveg áttetsző, víz enyhén tónusos, belső világítás, halak,
  növények, buborékok; alatta akváriumbútor, mögötte háttér.
- Elhelyezés: nappali, dolgozó, előtér; falba épített változat válaszfalban.
- Teljesítmény: az átlátszó anyag ne essen szét sorrendi hibába (helyes rendezés),
  a szoba rajzolási ideje ne nőjön 20%-nál többet.

## 15. Komód, könyvespolc, fali rejtett polc

**Mai állapot:** `extra_furniture`-ben van `bookshelf`; a többi hiányzik, és a
megjelenítést ellenőrizni kell.

**Kész, ha:**
- **Komód:** fiókos, 80–140 cm, hálóba, előtérbe, nappaliba; tetején dekoráció.
- **Könyvespolc:** nyitott polcos, könyvekkel (eltérő magasság és szín), lehet
  mennyezetig érő és alacsony is.
- **Fali rejtett polc:** látható tartó nélküli lebegő polc, 1–3 db egymás fölött,
  rejtett LED-világítással választhatóan.
- Mindhárom a `room_items` rendszerben helyiséghez rendelhető, kártyaképpel.

## 16. Lépcsők eltűntek

**Mai állapot:** a `stair_type` mező **létezik** 10 opcióval, de a 3D-ben nem látszik.

**Kész, ha:**
- Többszintes háznál a lépcső mindig látszik, a `stair_type` szerinti formában
  (lebegő, zárt, csiga, acél gerinces, beton, L, U, falból kinyúló, helytakarékos).
- A lépcső valódi helyen van: a földszinti és az emeleti nyílás egybeesik, a födémen
  van lépcsőnyílás, a lépcső nem megy falba és nem lóg a levegőben.
- Fokméret szabályos (fellépés 17–19 cm, járófelület 26–30 cm), korlát és kapaszkodó
  van, a fordulónál pihenő.
- A pincelépcső (9.) és a padlásfeljáró (10.) ugyanebbe a rendszerbe illeszkedik.
- Belső nézetben a lépcsős helyiség (előtér, nappali) is mutatja.
- **Mérés:** 100 véletlen többszintes ház: minden esetben pontosan egy főlépcső,
  0 átfedés fallal vagy bútorral, 0 lebegő lépcső.

## 17. Erkélyek

**Mai állapot:** `balcony`, `balcony_type`, `balcony_place`, `balcony_size` **létezik**
(1.6.0), a `_balconies`/`_balcMark` a közös tervben van. Norbi mégsem látja.

**Kész, ha:**
- Először **megtaláljuk, miért nem látszik** (nincs bekapcsolva alapból? csak bizonyos
  stílusnál? a szintszám miatt rejtve? a kártya nem jön elő?), és a választ a
  CHANGELOG is tartalmazza.
- Erkély minden olyan házon megjelenhet, ahol van emelet; a franciaerkély egyszintesen is.
- Típusok: konzolos, beépített (loggia), franciaerkély, körbefutó terasz.
- Korlát: üveg, fém, kovácsolt, falazott, fa – a stílushoz illő alapértékkel.
- Padlóburkolat, erkélyajtó, lefolyó, és a bútorzat (asztal, szék, növény) megvan.
- Az erkély a belső nézetből is látszik az ajtón át.

## 18. Macska és kutya a lakásban

**Kész, ha:**
- A háziállat a **belső** térben is megjelenik, nem csak a kertben: kutya a kanapé
  mellett vagy fekhelyen, macska a kanapén, ablakpárkányon, polcon, kaparófán.
- A kiegészítők is megvannak: fekhely, tál, kaparófa, macskaalom, játék.
- A `room_items` rendszer szerint helyiséghez rendelhető (a mai 1.7.0-s logika szerint).
- Testtartás és méret hiteles (kutyafajta-méret: kicsi/közepes/nagy), a bútorba nem lóg bele.

## 19. Képek a falon

**Hiba:** „képek nincsenek”.

**Kész, ha:**
- Minden lakótér falára kerül fali kép: keretes kép, vászonkép, poszter,
  képgaléria (több kis kép egy falon), tükör.
- Elhelyezés: szemmagasságban (középpont ~150 cm), bútor fölött középre igazítva,
  kanapé fölött a kanapé szélességének 2/3-ában, ágy fölött középen.
- Nem kerül ajtó, ablak fölé rossz helyre, nem lóg át sarkon, nem takarja a TV-t.
- Stílusonként más tartalom (absztrakt, tájkép, fekete-fehér fotó, botanikus,
  gyerekrajz a gyerekszobába), és a keret színe a belső stílushoz igazodik.
- Választható mennyiség: nincs / visszafogott / sok (galéria fal).
- A konyhában és a fürdőben ennek megfelelő dekoráció (tükör, kis kép).

---

## Átvételi lista (a végén mindnek teljesülnie kell)

- [ ] 1 kereső fókusz · [ ] 2 tetőszellőző · [ ] 3 hófogó · [ ] 4 dryvit dekor
- [ ] 5 belső nézet · [ ] 6 kattintás → mező · [ ] 7 helyszínek · [ ] 8 öt új stílus
- [ ] 9 pince · [ ] 10 padlás · [ ] 11 ajtókeret · [ ] 12 radiátor
- [ ] 13 gyerekszoba · [ ] 14 akvárium · [ ] 15 komód/polc · [ ] 16 lépcső
- [ ] 17 erkély · [ ] 18 bentre állat · [ ] 19 képek

**Kötelező zárás:** `php tests/autoloader-test.php` · PHP lint 0 ·
`node tests/sketch-test.js` · `python3 bin/po-tools.py check` 0 hiba és `compile` ·
`bin/test-wp.sh` + `responsive`, `wizard`, `gen`, `sketch`, `AGH_3D=1 sketch` E2E ·
új: `tests/e2e/search.js` · verzió 1.8.0 · CHANGELOG · ZIP · push `main`.
