# Változásnapló

## 1.27.0 – 2026-10-23

Norbi: „fotorealisztikus és nagyon gyors 3D … esetleg dolgozz ki egy egyedi technológiát”. (`docs/FELADAT-1.25.0.md`, 7. pont)

- **Élő fotó (egyedi hibrid megjelenítés):** mozgás közben a gyors raszteres kép; amikor a nézet megáll, a háttérben progresszív sugárkövetés indul ugyanazon a jeleneten (three-gpu-pathtracer 0.0.23 + three-mesh-bvh 0.8.3, MIT), és a kép áttűnéssel valódi fénnyel, tükröződéssel és lágy árnyékkal számolt fotóvá válik; mozdulatra az első képkocka már ismét raszter. A gyorsítóstruktúra (BVH) háttérszálon épül, csak a megváltozott jelenetnél újra, és megvárja az 1.26.0 részleteit (fű, fák, égbolt); kisebb felbontáson gyűjt, zajszűréssel; az égbolt a beépített égbolt-fényképből jön. Kapcsoló a 3D eszköztárában, megjegyezve; telefonon és gyenge gépen alapból ki.
- **Fotó készítése:** nagy felbontású állókép a mostani nézetből, sugárkövetéssel, a látogató saját gépén számolva, állapotsávval, PNG letöltéssel – a tervező 3D-jében és az építési mód 3D nézetében is. Ingyenes, helyben fut, és nem talál ki semmit (a Magnific mellett).
- **Méret és sebesség:** a sugárkövető kód (minifikált, csak a használt részek) 206 KB, tömörítve 60 KB; a ZIP ~31 KB-tal nő. Lusta betöltés: az első kép előtt 0 kérés, kikapcsolt élő fotónál a könyvtár be sem töltődik.
- Ismert könyvtárhiba megkerülve: a `bounces 3` + `transmissiveBounces 4` párosítás a pixelek ~12 %-át feketén hagyta – a `transmissiveBounces` a könyvtár alapértékén marad.
- Mérve: új `e2e/photo3d.js` 13/13 (SwiftShaderen: zaj sík falon 7,75 mintánál 14,94 → 46,5 mintánál 7,47, szűrve 5,59; mozdulatra az első képkocka raszter; fotó PNG; építési mód 3D-ben is; BVH 187 484 háromszög ~3,5 s háttérszálon) · `fullscreen.js` 76/76 · `build-test` 6975/6975 · autoloader 125/125 · sketch 0 hiba · 15 nyelv × 2744 szöveg, 0 hiba · konzolhiba 0. Valódi GPU-n és telefonon nem mérve.

## 1.26.0 – 2026-10-23

Norbi: „fotorealisztikus és nagyon gyors 3D” – majd: „a nagy helyet igénylő külső technológiákat ne használjuk, csak ami biztonságos; az ég jó lenne és a háttérben a tárgyak, fák”. (`docs/FELADAT-1.25.0.md`, 2–6. pont, irányváltással)

- **Égbolt-fénykép:** 7 CC0 égbolt (Poly Haven) beépítve, erősen tömörítve (`assets/sky/`, összesen 224 KB, `manifest.json`: forrás, licenc, md5). A napszak és az időjárás választja, a tájolás forgatja, a kép napja a jelenet árnyékot adó napja felé néz; a tükröződés és a környezeti fény is ebből jön. Ha a kép nem töltődik be: a mai festett ég. Fotótextúra-csomag és letöltött modell nincs.
- **Fák és környék (számított, letöltés nélkül):** fák három részletességgel, aljnövényzet, kandeláber, pad, szemetes, villanyoszlop vezetékkel, terelőoszlop, postaláda.
- **Fű:** sok fűcsomó egy példányos hálóban, szintenként (közepes 2719, magas 5607, ultra 9812 csomó), nem nő a házra és a burkolatra, nem vet árnyékot, gyorsítótárban.
- **Felület:** a minta ismétlődése elleni sztochasztikus csempézés a meglévő számított textúrákon (magas és ultra szinten), enyhe szennyeződés a lábazaton.
- **Minőségi szintek:** alacsony / közepes / magas / ultra, automatikus váltással a képkockaidő alapján (hiszterézissel); a látogató a 3D sarkában választhat, a választás megmarad.
- **Teljesítményteszt:** admin → „3D teljesítményteszt” és `?agh_bench=1` a tervezőn: szintenként első kép ideje, képkocka/s, p50/p95, háromszög, rajzhívás, GPU neve, javasolt szint, JSON másolható – ezzel a valódi gépen és telefonon mérhető.
- **Sebesség:** az első kép a 1.24.0 anyagaival jön; a fű, a részletes fák, a felületi részlet és az égbolt-fénykép utána, időszeletekben épül fel. A vezetőkép (Magnific) megvárja a teljes jelenetet. Felváltva mérve ugyanazon a gépen (3+3 futás, medián): 1.24.0 12 752 ms → 11 805 ms (−7 %).
- Mérve: új `e2e/sky.js` 22/22 · új `e2e/scenery.js` 16/16 · új `e2e/bench.js` 17/17 · `stair3d.js` 4/4 · `life.js` 10/10 · `detail.js` 9/9 · autoloader 125/125 · sketch 0 hiba · 15 nyelv × 2734 szöveg, 0 hiba · konzolhiba 0. Valódi GPU-n és telefonon nem mérve.

## 1.25.0 – 2026-10-22

Norbi: „az elmaradt felső 2 ponttal együtt mindent csinálj meg” – a helyiségek logikus elrendezése és a lépcső a kész ház 3D-jében. (`docs/FELADAT-1.25.0.md`, 1.1 és 1.2)

- **Helyiségek logikus elrendezése (6. lépés, helyiségprogram):** az automatikus elhelyezés a „fér-e” mellett 13 elrendezési szabályt követ súlyozott pontszámmal: nappali és hálók a kert / a nap felé, konyha a nappali vagy az étkező mellett, étkező a kettő között, fürdő a hálók mellett vagy a hálókat összekötő közlekedőről, WC az előtér közelében, kamra a konyha mellett, háztartási helyiség a fürdő vagy a garázs felé, gépészet az utca felé, dolgozó csendes helyen, előtér a bejáratnál, közlekedő köti össze a hálókat, vizes helyiségek egy vezetékfal körül. Adatként: `build-defaults.json` → `programme.layout` (`verified: false`, figyelmeztet, nem tilt). A kert iránya a meglévő `orientation`-ből jön, új mező nincs. A dobozban és az ablakban szabályonként: teljesül / nem teljesül; új „Elrendezés javítása” gomb (Ctrl+Z vissza). JS = PHP (`Build::layout()`).
- **Javítva:** a programfal vége néha a szoba sarka előtt rövidült, és a szoba nem zárult.
- **Lépcső a kész ház 3D-jében (9. lépés) és a szobanézetben:** a tervezett lépcső (egyenes, L, U, csiga) fokai a padló anyagából, korlát a ház erkélykorlátjának típusa szerint (üveg, fa, fém pálcás; csigánál középoszlop), a födémáttörés ugyanaz, mint az építési állásban. Egy közös számítás (`AGH_Build.stairRects` + új `stairRails`) rajzol mindenhol. A szobanézetben az első fok szobájában a kar, az emeletin a lyuk, a lépcső teteje és a korlát; a bútorok kikerülik.
- Mérve: `e2e/prog.js` 30 ház – elrendezési szabályok átlag 97,2 % (116/120), fürdő a háló/közlekedő mellett 23/23, nappali a kerti oldalon 30/30, javítás nem ront 30/30, Ctrl+Z 30/30, lépcső 15/15, nettó m² ±0,5 134/134, átfedés 0, szerver = JS 10/10 · új `e2e/stair3d.js` 8 ház (4 típus): fokszám kész ház = építési állás 8/8, födémlyuk ±1 cm 8/8, szobanézet földszint 8/8 és emelet 8/8 · `build3d.js` 20 ház 0 hiba · `build-test` 6975/6975 · `build-test.php` 2415/2415 (új: 124 eset, szabályonként JS = PHP) · autoloader 125/125 · sketch 0 hiba · 15 nyelv × 2708 szöveg, 0 hiba · konzolhiba 0.

## 1.24.0 – 2026-10-22

Norbi: „élethű autó, ember és járműveket akarok a 3D képre”. (`docs/FELADAT-1.18.0.md`)

- **Autók (szedán, ferdehátú, SUV, pickup, kisbusz, sportautó, elektromos):** lekerekített karosszéria, befelé dőlő üvegház, kerekedő orr és far, kivágott kerékjárati ívek sötét béléssel; gumi oldalfallal, ötküllős felni féktárcsával és nyereggel; sötét, tükröző üvegezés oszlopokkal és krómcsíkkal, ülések és kormány bent; fényszóró-csoport nappali fénnyel, hátsó lámpa, hűtőrács lamellákkal, lökhárítók, küszöb, tükrök száron, kilincsek, ajtóhézagok, rendszámtábla (EU-csík). Este a lámpák világítanak.
- **Emberek:** arc (szem fehérje és írisz, szemöldök, orr, száj, fül, áll), frizura (rövid, bob, hosszú, lófarok), törzs mellkassal, derékkal, csípővel, ing gallérral és redőkkel, öv csattal, szoknya redőkkel, rövid/hosszú ujj mandzsettával, kéz ujjakkal és hüvelykujjal, cipő talppal. **Kutya:** mély mellkas, pofa orral, szem, lógó vagy álló fül, nyakörv, mancsok, ívelt farok. **Macska:** kerek fej, hegyes fül rózsaszín belsővel, zöld szem pupillával, bajusz, hosszú farok.
- **Sebesség:** minden modell egyszer épül meg kinézetenként, anyagonként egy hálóba összevonva, és másolatként kerül a jelenetbe – a részletesebb modellekkel a nézet gyorsabb, mint előtte. Mérve (SwiftShader, ugyanazon a gépen, 3 futás): a teljes nézet (építés + összevonás + első kép) 73–75 ms → 36–48 ms; háromszög: autó 8 400–10 000 (≤ 20 000), ember ~8 400, kutya ~5 900, macska ~2 000.
- Mérve: új `e2e/life.js` 10/10 (minden jármű, a család, a kutyák és a macska felépül, részletek, autó anyagonként egy hálóban, konzolhiba 0) · `move.js` 21/21 · `pick.js` 122 rész · `cards.js` 55 mező 0 hiba · `layout.js` 15/15 · `detail.js` 9/9 · `outb.js` 14/14 · `guide.js` zöld · sketch 0 hiba · autoloader 125/125.

## 1.23.0 – 2026-10-22

Norbi: „melléképületek (tároló, faház, műhely) … kintre garázs, tároló stb., méretezni és berendezni, tetőt tenni rá”. (`docs/FELADAT-1.18.0.md`)

- **Melléképületek (Kert lap, új mező `outbuildings`, legfeljebb 6):** pillére koppintva tároló, faház, műhely, nyári konyha, külön garázs, pajta vagy üvegház; mindegyiknél szélesség × mélység × falmagasság, tető (nyereg, félnyereg, lapos, zöld) és fedése (cserép, fém, zsindely, bitumenes lemez), fal (fa, vakolt, tégla, fém, kő, üveg), ajtó (egy-, kétszárnyú, toló, garázskapu), ablakok száma, és berendezés (polcok, munkapad, szerszámfal, kerti gépek, autó, kerékpár, tűzifa, asztal, konyhapult, növények).
- **Elhelyezés:** a közös terv a ház mögé, a telken belül, egymást és a kert elemeit kerülve teszi őket (a legnagyobbat először, szükség esetén elfordítva); ami nem fér el, azt a mező alatt kiírja. A 3D-ben mind megfogható, mozgatható, forgatható (`site_layout` → `out#n`), újratöltés után is ott marad.
- **3D:** falak az anyagukkal, nyitott ajtó (a berendezés látszik), ablakok, tető a fedéssel, belül a választott berendezés (az autó csak ha befér). **2D:** falak, tető, ajtó, ablakok. **Prompt:** „outbuildings on the plot: a 5 × 4 m brick workshop with a gable tiled roof and double doors, …”.
- Mérve: új `e2e/outb.js` 14/14 (szerkesztő: hozzáadás, méret, berendezés, törlés; 3 épület egy telken átfedés nélkül, telken belül, a házon kívül, 2D-ben látszik, 3D-ben mind megfogható; mozgatás mentve és újratöltés után a helyén; túl nagy épület jelez; konzolhiba 0) · `sketch-test` 40 telek, 79 melléképület, átfedés/kilógás 0, hiba 0 · `match-test` 35/35 · `move.js` 21/21 · `layout.js` 15/15 · `detail.js` 9/9 · guide 62/62 · photo 28/28 · vision 55/55 · autoloader 125/125 · 15 nyelv × 2687 szöveg, 0 hiba (javítva: öt ismétlődő fordítási kulcs).

## 1.22.0 – 2026-10-22

Norbi: „medencetípusok és méret, a garázs részletei (m², belső osztás, tető, anyag, kapu, ablak)” – és „minden el kell férjen, ki kell tudnod számolni, hogyan fér el”. (`docs/FELADAT-1.18.0.md`, `docs/FELADAT-1.21.0.md`)

- **Medence (Kert, ha van medence):** forma (téglalap, L, ovális/kör, végtelenített, merülő, jakuzzi), a víztükör hossza × szélessége (0 = automatikus), mélysége (a vízszín ettől mélyül), burkolata (kék mozaik, fehér, szürke kő, homokszín, fekete), lefedése (lamellás, teleszkópos, görgős), körülötte (szegély, kő, fa vagy WPC terasz). 2D, 3D és prompt.
- **Garázs (a mai `garage` mező marad):** beállók száma, szélesség, mélység (0 = a típus szerint), belső osztás (műhely, tároló, kazánház, kerékpártároló – alacsonyabb toldalék a garázs mögött), tető (lapos, nyereg, félnyereg, zöld), homlokzat (mint a ház, vakolt, fa, tégla, fém, kő), kapu (szekcionált, redőny, billenő, kétszárnyú, üveges) és színe, ablak, gyalogajtó; a polcok a kapun át látszanak. A garázs a 3D-ben megfogható és arrébb húzható (a ház újraépül, a 2D terv is követi).
- **Elfér?** A közös terv kiszámolja: a kért méretű medence elfér-e a telken a ház, garázs, terasz és utak mellett – ha nem, a mező alatt kiírja a legnagyobbat, ami elfér (ugyanazzal az aránnyal); a garázs és a ház szélessége a megadott telekszélességhez mérve (ha nem fér el, kiírja, mekkora fér el).
- Mérve: új `e2e/detail.js` 9/9 (12 változat mind felépül és mind más a 3D-ben, a garázs megfogva mozog, mentve, újraépítve, a 2D is ott; túl nagy medence és túl széles garázs jelez; konzolhiba 0) · `sketch-test` 1281 rajz, 34 új változat mind látszik, elfér-ellenőrzés 3/3, hiba 0 · `match-test` 33/33 (medence- és garázsrészletek a promptban) · `move.js` 21/21 · `layout.js` 15/15 · `pick.js` 122 rész · `cards.js` 55 mező 0 hiba · `guide.js` zöld · guide 62/62 · photo 28/28 · vision 55/55 · `build-test` 6975/6975 · `build-test.php` 2235/2235 · autoloader 125/125 · 15 nyelv × 2666 szöveg, 0 hiba.

## 1.21.0 – 2026-10-22

Norbi: „a rendszernek tudnia kell, hogy levonja a falvastagságokat … mindig meghatározza, hogy még pontosan hány m² osztható ki … a lépcső elhelyezése rendkívül fontos … ugyanez vonatkozik mindenre”; és a díszítőanyag helye a házon. Munkaprompt: `docs/FELADAT-1.21.0.md`.

- **Területmérleg (építési mód, 6. lépés és a Helyiségek ablak, élőben):** bruttó alapterület → − külső falak → − belső vakolat (1,5 cm) → − lépcső (alaprajzban; a felső szinten a födémáttörés) → − megmaradó belső falak → − válaszfalak a helyiségek között (elhelyezve pontosan, előtte becslés) = **kiosztható nettó**; − program = **még kiosztható**. Túllépésnél piros. Kiírja, mekkora helyiség fér még el (a saját falaival), és a legnagyobb szabad helyet méretre.
- **A geometria tartja a mérleget:** a téglalap a kész, vakolt falsíkok közti nettó méret; két helyiség között válaszfal + 2 × vakolat (13 cm) marad, a fal a hézag közepére kerül; külső/teherhordó falhoz vakolatnyira simul. Teherhordó belső falat a program nem töröl, és nem tesz rá helyiséget. Részben falra futó oldal nem lehet (a fal nem zárna).
- **Hogyan fér el:** a Helyiségek ablak soronként kiszámolja, hova és milyen méretben (ugyanaz a terület, más arány is) fér el a helyiség, és kiírja; „Kész” után a helyiségek már az alapban vannak. Helyiségtípusonként jó gyakorlati minimum (pl. háló 8 m² / 2,5 m, fürdő 3,5 m² / 1,6 m, WC 1,2 m² / 0,9 m) figyelmeztetéssel; közlekedő hiányánál javaslat (nettó 8–12 %). Adatként: `build-defaults.json` → `programme`.
- **Lépcső:** típus (egyenes, negyedfordulós L, fordulós U, csiga) és karszélesség; a szintmagasságból: fokszám, fokmagasság (≤ 19 cm, a 17,5 cm-hez legközelebb), belépő a lépcsőképletből (2m + b ≈ 63 cm), pihenő, födémáttörés a 2,1 m szabad belmagassághoz (L-nél L alakú). Automatikus elhelyezés a bejárathoz közel, külső falnak háttal, induló és érkező szabad hellyel, teherhordó falon kívül; húzható, dupla koppintással forgatható. A 3D építési állásban a fokok is megjelennek, a födémáttörés a számolt alakú. Ellenőrzés a gyakorlati listában (fokmagasság, lépcsőképlet, karszélesség). Adatként: `build-defaults.json` → `stair`.
- **Díszítőanyag helye:** a 3D-ben „Díszítőanyag helye” mód – falra koppintás → zóna (egész fal, emelet, oromzat, lábazat, bejárat) → 1. anyag, 2. anyag, nincs; új mező `accent_layout`; 2D, 3D és prompt ugyanazt mutatja; Ctrl+Z, visszaállítás.
- Javítva: a maradék-helyiség levonás (1.16.3) egy nem konvex szomszédot is „benne lévőnek” vett, ha a csúcsai átlaga belelógott – most minden csúcsnak bent kell lennie (JS = PHP). Az építési mód felületéről lekerült a „Nem statikai és nem engedélyezési terv” felirat (Norbi: a terveket a mérnök ellenjegyzi).
- Mérve: `e2e/prog.js` 30 ház (15 többszintes, mind a 4 lépcsőtípus): lépcső jó helyen 15/15, lépcsőszabály 15/15, mérleg 30/30, 135 téglalap – átfedés 0, hézag < fal + vakolat 0, lépcsőn 0, nettó m² ±0,5 133/133, típus 133/133, teherhordó fal eltűnt 0, szerkezeti hiba +0, Ctrl+Z 30/30, legnagyobb szabad hely elfér 30/30, túllépés piros 30/30, szerver = JS 10/10, konzolhiba 0 · új `e2e/paint.js` 19/19 · `match-test` 30/30 · `buildedit.js` 8 ház zöld · `build.js` zöld · `move.js` 21/21 · `build-test` 6975/6975 · `build-test.php` 2235/2235 · sketch 1247 rajz 0 hiba · guide 62/62 · photo 28/28 · vision 55/55 · storage 10/10 + 11/11 · stuck 9/9 · autoloader 125/125 · 15 nyelv × 2614 szöveg, 0 hiba.

## 1.20.0 – 2026-10-22

Norbi: „helyiségprogram felugró ablakban: pillékből választod a helyiséget, megadod a m²-t, és te teszed be az alapba.” (`docs/FELADAT-1.18.0.md`)

- **Építési mód, 6. lépés – Helyiségprogram:** a „Helyiségek…” gomb felugró ablakot nyit; a helyiségtípusok pillék (nappali, konyha, nappali + konyha + étkező, hálók, fürdő, WC, előtér, dolgozó, kamra, mosókonyha, gardrób, gépészet… és egyedi név). Koppintásra sor kerül a listába: név, m², ha kell szélesség × mélység. „Kész” után minden helyiség egy színes téglalap a ház mellett.
- A téglalapot egérrel/ujjal a ház alapjába húzod (a fal belső síkjára ugrik), dupla koppintás 90°-kal elfordítja, nyíl léptet, Del töröl; piros, ha kilóg vagy másikra került. **Automatikus elhelyezés** gombra a legnagyobbtól kezdve elhelyezi (a szomszédok élre illeszkednek); ami nem fér el, a ház mellett marad, és jelez.
- **Falak a helyiségek köré:** a téglalapok határán válaszfalak jönnek létre (közös élen egy fal, ahol már fal áll, ott nem), a régi, a helyiségeken átfutó válaszfalak eltűnnek, és a kapott helyiségek típusa a téglalapé. Ctrl+Z visszavon. A program a tervvel mentődik (`build.prog`, JS = PHP).
- Mérve: új `tests/e2e/prog.js` 20 ház, 90 téglalap valódi kattintással: m² ±0,5 90/90, a ház mellett indul 90/90, behúzás és falsíkra ugrás 20/20, dupla koppintás 90° 20/20, automatikus elhelyezés 90/90 – átfedés 0, körvonalon kívül 0; falak a téglalapok mentén, típus 90/90, szerkezeti hiba +0, Ctrl+Z 20/20; szerver = JS 10/10; konzolhiba 0 · `buildedit.js` 8 ház zöld · `build.js` zöld · `build-test` 6975/6975 · `build-test.php` 2235/2235 · 15 nyelv × 2550 szöveg, 0 hiba.
- Megjegyzés: a `build.js` felületmérése 768×1024-en ritkán 43×43 px-es gombot mér (betöltés közbeni pillanat; ismételve 0 hiba).

## 1.19.0 – 2026-10-22

Norbi: „falak, ablakok, ajtók törlése és mozgatása a rajzon és a 3D-ben.” (`docs/FELADAT-1.18.0.md`)

- **Építési mód, alaprajz:** a kijelölt fal, ablak, ajtó húzással mozgatható (a csatlakozó falak követik), nyilakkal 10 cm-enként (Shift: 50 cm); törlés Del-lel vagy a rajz fölötti sávban a **kuka** gombbal, a sáv mutatja, mi van kijelölve. Ctrl+Z bájtra visszaállít.
- **Építési mód, 3D (5–7. lépés):** a falra vagy nyílásra koppintva kijelöl, húzással a saját falán csúszik az ablak/ajtó, a fal merőlegesen tolható; keret mutatja az új helyet (piros, ha a szerkezet hibás lenne). Ablakon át nem a mögötte lévő falat fogja meg.
- Mérve: új `tests/e2e/buildedit.js`: 50 ház – ablak/ajtó húzás 50/50, fal húzás 50/50 (csatlakozó falak 50/50), nyíl 50/50, Del 50/50, kuka 50/50, Ctrl+Z 250/250, szerkezeti hiba +0; 3D 8 ház: ablak- és falhúzás 8/8, jelölés, törlés, visszavonás 8/8; szerver = JS 10/10; konzolhiba 0 · `build.js` 20 ház, 200/200 lépés, geometriai hiba 0, konzolhiba 0 · `build-test` 6975/6975 · `move.js` 21/21. Új szöveg nincs.

## 1.18.0 – 2026-10-22

Norbi: „3D tervezőben is arrébb akarom tudni tenni a kéményt, az ablakokat, ajtókat és mindent, és forgatni”, Shift-tel egyenesbe, jelölve, hova szabad tenni és hova nem. A teljes lista (törlés, helyiségprogram, díszítőanyag, medence/garázs, melléképületek, élethű modellek) ütemezve: `docs/FELADAT-1.18.0.md`.

- **Megfogás a 3D tervezőben, kívül:** medence, tároló, játszótér, pergola, tűzrakó, kerti és teraszbútor, lámpák, fák és bokrok, járművek (a beálló autója is), emberek, kutya, macska, kutyaház, töltő – egérrel azonnal, ujjal rövid nyomás után; a tárgy fölött a mutató kézzé vált. Gyökérok: kívül minden egy hálóba olvadt, ezért semmi nem volt mozdítható; most minden kerti tárgy saját, külön összevont csoport.
- **Ablak, bejárati ajtó, teraszajtó:** a saját falán csúszik (keret mutatja az új helyet), elengedéskor a fal újraépül az új nyílással; a terasz követi a teraszajtót. **Kémény:** a tetőn húzható.
- **Forgatás:** Ctrl (⌘) + oldalra húzás, görgő vagy R (15°); **Shift: egyenesbe** (0/90/180/270°). Kijelölt tárgy: nyilak 10 cm (Shift: 50 cm), R, Esc. Húzás közben Esc: visszaugrik. A belső nézetben is így: a forgatás eddig Shift volt, most Ctrl/görgő/R, a Shift egyenesbe állít.
- **Jelölés:** a tárgy alatt (az ablak körül, a kémény tetején) keret: zöld = jó hely, piros = nem, a képen alul az ok (telken kívül, a házba/garázsba lóg, a teraszon van, medence < 1 m, fa < 2 m (nagy fa < 3 m) a háztól, másik tárgyra került, nyílás < 0,6 m a saroktól vagy < 0,3 m másik nyílástól, kémény > 0,6 m a gerinctől). Figyelmeztetés, nem tiltás. Szabályok adatként: `assets/data/rules/hu.json` → `placement` (6 rekord, `verified: false`, jó gyakorlat, nem jogszabály).
- **Mentés:** új mező `site_layout` (kulcs → {x, y, rot}); Ctrl+Z visszavon, jobb alul „Kézi elrendezés visszaállítása”. A közös terv (`gardenLayout`, `frontPlan`, ablakkiosztás, kémény) olvassa, így a 2D vázlat, a 3D, a vezetőkép és a fotó ugyanazt mutatja; a prompt (régi út) egy mondattal jelzi, hogy az elrendezést az ügyfél állította be.
- Mérve: új `tests/e2e/move.js` 21/21 (9 tárgyfajta mozgatva és mentve, Ctrl-forgatás 0° → 48°, Shift → 90°, R +15°, nyíl 10 cm, Esc, a házra húzva piros „A házba lóg”, Ctrl+Z, ablak 8,06 → 8,85 m, ajtó 2,81 → 4,74 m, kémény 7,57 → 6,59 m újraépítve, újratöltés után 9/9 tárgy és 3/3 nyílás a helyén, visszaállítás, konzolhiba 0) · `layout.js` 15/15 fogható, kilóg 0 · `pick.js` 122 rész, 9/12 találat · `guide.js` 6 nézet + belső, konzolhiba 0 · `cards.js` 55 mező 0 hiba · `street.js` 16 helyszín · `responsive.js` 24 méret, túlfutás 0 · `fullscreen.js` 76/76 · `theme.js` zöld · `wizard`, `gen` zöld · sketch 1247 rajz 0 hiba · `guide-test` 62/62 · `match-test` 26/26 · `photo-test` 28/28 · `vision-test` 55/55 · `build-test` 6975/6975 · `build-test.php` 2235/2235 · storage 10/10 + 11/11 · stuck 9/9 · autoloader 125/125 · lint 0 · 15 nyelv × 2534 szöveg, 0 hiba.
- **Sebesség (mérve, SwiftShader):** rajzolási hívás alapházon 96 → 106, sok kerti elemmel 153 → 186; betöltés kattintástól a kész 3D képig 6304 → 6602 ms (+4,7 %), lassú 3 Mbit/s-on 9725 → 9745 ms.
- Korlát: a garázs és a terasz helye még nem mozdítható (a garázs az 1.22.0 része); a 2D vázlat a 90°-tól eltérő forgatást a befoglaló téglalappal rajzolja; a virágágyás virágai a ággyal maradnak.

## 1.17.0 – 2026-10-22

Norbi: „a kép generálás kezd jó lenni, ez a jó út!” – de nem stúdió minőség, és a kerti, hátsó, oldalsó nézet selejt; minden irányból a 3D képből kell. Munkaprompt: `docs/FELADAT-1.17.0.md`.

- **Fotós prompt:** a 3D kép marad a bemenet, mellé a beállított fotó leírása: díjnyertes építészfotó, full-frame, 24 mm tilt-shift, korrigált függőlegesek, bracketelt HDR, a napszak fénye (alap: oldalról jövő aranyóra), lágy hosszú árnyékok, anyagok mikrorészletei, magazinminőség; a tárgyak színe is marad. Esti nézet: kék óra, égő fények. Próba a Magnific-appban Norbi 3D képén: kidolgozott aranyórás fotó, minden tárgy a helyén.
- **Minden irányból saját 3D kép:** a kerti nézetnek nem volt 3D képe (a böngésző nem készítette), ezért kitalált házzal készült; most a terasz felőli sarokból saját képet kap, az esti nézet a fő kép 3D képét. A nézetek alapból csak a saját 3D képükből készülnek (a fő kép nézőpontja nem szivárog át); admin: „A nézetek a fő képet is megkapják”.
- Mérve: `photo-test` 28/28 · `guide-test` 62/62 · `match-test` 26/26 · `vision-test` 55/55 · `e2e/guide.js`: 6 galériairány + teljes jelenetek, konzolhiba 0 · autoloader 125/125 · 15 nyelv × 2515 szöveg, 0 hiba.
- Következik: mozgatás a 3D tervezőben (kerti tárgyak, ablak, ajtó, kémény), utána élethű járművek, emberek a 3D-ben.

## 1.16.3 – 2026-10-22

Norbi (2 jelzés, képekkel): a válaszfalak után a maradék helyiség (nappali-konyha-étkező) mindig a teljes m²-t mutatta; alaprajzról 3D-re váltva a ház „tükrözve” látszott. Munkaprompt: `docs/FELADAT-1.16.3.md`.

- **Maradék helyiség területe:** a Téglalap eszközzel rajzolt helyiség saját zárt hurok, a külső falhoz csak rásimul, ezért a körülötte lévő tér az egész alapterületet kapta. Most a benne lévő helyiségek levonódnak (egymásba ágyazva sem kétszer), a felirat a megmaradt részbe kerül; JS (`agh-build.js`) = PHP (`Build.php`). Mérve a képpel azonos rajzon: 924,2 → 289,6 m², az összeg 1548 → 913,7 m².
- **3D irány:** a 3D nézet a tervezővel közös, a korábbi forgatás megmaradt – Norbi képén keletről nézett, ezért a ház 90°-kal elforgatva, a rajzhoz képest tükrözöttnek tűnt (a geometria egyezik, felülnézetben mérve). Most alaprajz → 3D váltáskor a kamera mindig az utca felől néz, mint a rajz; a 3D-n belüli forgatás a lépések között megmarad. Mérve: keletre forgatva 90°, alaprajz → 3D után 36° (utca felől).
- Mérve: új paritás-eset („nested rooms”) · `build-test.php` 2235/2235 · `build-test.js` 6975/6975 · autoloader 125/125 · lint 0.

## 1.16.2 – 2026-10-22

Norbi: a kitűzés, a földmunka, az alap és az alapvezetékek csak akkor látszottak a 3D-ben, ha a lépések végére ment és visszalépett; a „földdarab” nem változott; a téglalap csak L ↔ téglalap váltás után ugrott méretre; más alak is kell. Munkaprompt: `docs/FELADAT-1.16.2.md`.

- **A ház körvonala a 0. lépésben (Telek, kitűzés):** Szélesség, Mélység, Téglalap, L alakú, A mostani házból – az 1–4. lépésben is, amíg nincs fal. Gyökérok: a körvonalat csak az 5. lépésben lehetett megadni, a 0–4. lépés abból rajzol, ezért üres volt. Mérve: a 0. lépésben lerakott 12 × 9 m-es ház után az 1. lépés 3D-je azonnal 14 × 11 m földmunkát és 12 × 9 m alapot mutat.
- **A földfolt:** fal nélkül eddig rögzített 4 × 4 m volt; most a beírt méret + munkatér (14 × 11,5 → 16 × 13,5 m), gépelés közben frissül. Fallal a rajzolt körvonalat követi, nem a befoglaló téglalapot (L alak: 248 m² a 280 helyett). Saját alak: a Fal eszközzel bármilyen zárt kontúr.
- **Méret-tartomány:** a 4–40 / 4–30 m-en kívüli szám eddig csendben 40-re vágódott, a mező 100-at mutatott; most a használt értéket mutatja, alatta a tartomány.
- Mérve böngészőben (tesztoldal): a körvonal a 0–4. lépésben megjelenik, fal után az 1–4. lépésből eltűnik; a földfolt és az alap mérete azonnal követi; konzolhiba 0 · sketch 0 hiba · autoloader 125/125 · 15 nyelv × 2513 szöveg, 0 hiba.

## 1.16.1 – 2026-10-22

Norbi: „a pro változat kerüljön az arculati menübe”, saját kóddal. Munkaprompt: `docs/FELADAT-1.16.1.md`.

- **Pro változat kóddal:** Arculat és elrendezés → „Pro változat” kártya. A helyes kóddal a Professional csomag minden funkciója és limitje bekapcsol az oldalon (képleíró prompt, teljes paraméterezés, részletes galéria, haladó arculat…); „Kikapcsolás” visszaállít. Professional/Agency licencet nem csökkent; saját oldalon csak tájékoztat.
- A kód nincs szövegesen a pluginban (csak a bcrypt kivonata); 5 hibás próba után 15 perc tiltás.
- Mérve: új `tests/pro-code-test.php` 13/13 (a kód környezeti változóból) · böngészőben ügyféloldal módban: hibás kód nem kapcsol, jó kód → Aktív, Kikapcsolás → vissza, konzolhiba 0 · `vision-test` 55/55 · `license-hub-test` 40/40 · `photo-test` 22/22 · autoloader 125/125 · lint 0 · 15 nyelv × 2511 szöveg, 0 hiba.
- **Figyelem:** a kód minden ügyféloldalon ugyanaz; aki ismeri, a licencközpont nélkül bekapcsolhatja a Pro-t.

## 1.16.0 – 2026-10-22

Norbi 10 pontos listája (7 képpel). Ebben a verzióban az 1., a 9. és a 10. pont; a többi (helyiségprogram, törlés/mozgatás, globális mozgatás-forgatás, anyagok helye, medence, garázs, melléképületek) ütemezve az 1.17–1.22-re. Munkaprompt: `docs/FELADAT-1.16.0.md`.

- **Fotó a 3D képből (10. pont, új alapértelmezés):** a látogató 3D képe maga megy be a képgenerálóba (Flux 2 Pro szerkesztés) és abból lesz fotó – „ugyanezt a házat alakítsd valódi fotóvá, semmit ne tegyél hozzá és ne vegyél el”. A bemenet a teljes jelenet (autó, ember, állat is), a méret a 3D kép alakja (1440 × 880), a nézetek a saját 3D képük mellé a kiválasztott fő képet is megkapják. Gyökérok: eddig a 3D kép csak structure referencia volt (a Mystic csak formát vesz át, színt nem), a színt a stílusminta adta – a „Modern minimalista” minta sötét tetős házától lett fekete a piros tető. Csak Hű/Klón/egyedi hűségnél és a látogató 3D képével; Magnific → „Képkészítés módja”: a régi forma-vezetés választható.
- Próba a Magnific-appban Norbi 3D képén: piros cseréptető, vakolat, pergola a kültéri konyhával, medence, lapos tetős dupla garázs, kerítés, esővízgyűjtő és autó a helyén (100 kredit). A Magnific kreatív felskálázó ugyanezen a képen a garázstetőt és az autót megváltoztatta – ezért nem az.
- **Kezdő méret (1. pont):** az építési mód Szélesség/Mélység mezője minden újrarajzolásnál visszaugrott 10 × 8 m-re. Most megmarad. Mérve (új `tests/e2e/buildsize.js`): 14 × 11,5 m beírva → a téglalap 14,00 × 11,50 m (előtte 10,00 × 8,00).
- **Pergola a tetőben (9. pont):** a terasz-pergola fix magassága egyszintes háznál az eresz fölé ért. Most az eresz alatt marad, ha ott kevés a belmagasság, az eresz előtt kezdődik. Mérve 600 házon: tetőbe lógó pergola 179 → 0, legkisebb belmagasság 2,10 m.
- Mérve: új `tests/photo-test.php` 22/22 · `guide-test` 62/62, `vision-test` 55/55, `match-test` 26/26 (a régi úton) · `e2e/guide.js` konzolhiba 0 · `e2e/build.js 2` 20/20 lépés, geometriai hiba 0 · stuck 9/9 · gen zöld · sketch 0 hiba · autoloader 123/123 · lint 0 · 15 nyelv × 2499 szöveg, 0 hiba.
- **Nem mérhető itt:** a pluginból éles kulccsal (a próba a Magnific-appban futott, ugyanazzal a modellel). A fotó 1440 px széles; nagyobbhoz a „Felskálázás a kiválasztott galériánál” kapcsoló.

## 1.15.3 – 2026-10-21

Norbi: „az első képet kiválasztotta, akkor megcsinál több nézetet, azok meg rosszabbak” – a madártávlaton és az elölnézeten torony, íves ablakok, más tömeg. Munkaprompt: `docs/FELADAT-1.15.3.md`.

- **Gyökérok 1:** a nézetek a Flux 2 Pro úton mentek (1440×816): a kiválasztott hero + a nézet 3D képe, de a Fluxnak nincs structure-erőssége, a szöveg dönt. Most **Hű/Klón/egyedi hűségnél, 3D vezetőképpel** a nézet a Mystic structure útján megy (a 3D a forma a hűség erősségével, a kiválasztott hero a stílusminta), a „Nézetek egysége” beállítástól függetlenül. Vezetőkép nélkül és Szabad/Kiegyensúlyozott fokozaton a mai út.
- **Gyökérok 2:** a mediterrán stílus leírása tömeget rendelt („U-shaped house around a courtyard with a small tower, … arched openings”). Kötött hűségnél csak a stílus neve megy, a leírás kimarad; Szabad fokozaton marad.
- Mérve: `tests/match-test.php` 26/26 (új: nincs „tower/U-shaped/arched”, kötött nézet → `/v1/ai/mystic` structure 75 + hero style reference, nem kötött → Flux) · `guide-test` 62/62 · `vision-test` 55/55 · stuck 9/9 · sketch 0 hiba · autoloader 123/123 · lint 0.
- **Nem mérhető itt:** a Mystic nézet díja a Flux nézethez képest (éles kulccsal mérendő); a régi, rossz színű hero mint stílusminta a nézetbe is átviszi a hibát – új generálás kell.

## 1.15.2 – 2026-10-21

Norbi (mediterrán ház, 3 generált kép + a 3D): „hogy nem jó!!! … mi a hiba???” A forma jó volt (tömeg, oromzatok, ablakok, terasz, kerítés, kapu), a színek és anyagok nem: fekete tető narancs helyett, szürke palakő bézs terméskő helyett, világos fa kerítés sötét lamella helyett. Munkaprompt: `docs/FELADAT-1.15.2.md`.

- **Gyökérok 1 – színnév:** a narancs cseréptető (`#C8582E`) a promptban „honey oak” (mézszínű tölgy) volt, mert a színnév-tábla minden narancs árnyalatra fanevet adott. Most fanév csak fa felületen (díszítőelem, zsalugáter, ajtó, bútor, padló, front, munkalap); tetőre, homlokzatra, keretre „terracotta orange”.
- **Gyökérok 2 – kő színe:** a 3D a terméskövet meleg bézsben rajzolja, a prompt viszont „natural stone, facade colour warm white”-ot mondott. Most a rögzített színű anyagok (kő, tégla, klinker, mészkő, fehér tégla, beton, fém, sötét vakolat, égetett fa) a 3D színét kapják („warm beige-yellow natural stone in irregular random-rubble masonry”), a vakolat színe a vakolt részekre megy.
- **Gyökérok 3 – kerítés:** a 3D függőleges, sötét antracit lamellát rajzol, a prompt „horizontal slatted fence”-et írt szín nélkül. Most „vertical slatted fence in dark anthracite metal” (skandinávnál szürke fa).
- **Gyökérok 4 – koncepciószövegek:** a három változat szövege más házat írt le („articulated massing with a projecting wing”, „dark metal accents”, „clearly distinct in massing and materials”). Hű/Klón fokozaton 3D vezetőképpel ezek kimaradnak; a koncepció neve és a látogató kívánsága marad. Szabad/Kiegyensúlyozott fokozaton változatlan.
- **Stílusminta:** a nyitóblokk kimondja, hogy anyag és szín csak a szövegből és a referenciából jöhet, a stílusmintából csak fény és fotóhatás.
- **Képleíró prompt:** az `{EXTRA_WISHES}` a modell pontos színeit is kapja (tető, homlokzat, keret, kerítés), mert a képernyőkép fénye elszínezi őket.
- Mérve: új `tests/match-test.php` 21/21 (Norbi házához hasonló beállítással; a kiküldött három koncepciókép mind „terracotta orange” és „warm beige-yellow natural stone”, egyikben sincs koncepciós tömeg/anyag) · `guide-test` 62/62 · `vision-test` 55/55 · stuck 9/9 · `gen` zöld · sketch 0 hiba · autoloader 123/123 · lint 0.
- **Nem mérhető itt:** hogy a Mystic a stílusmintából mennyit vesz át; ha a tető ezután is sötét, a mediterrán stílusmintát kell megnézni, vagy a stílusminta erősségét 45-ről 35-re venni.

## 1.15.1 – 2026-10-21

Norbi: „ebbe is kérem a pro verziót” → a képleíró prompt csak a Pro csomagban. Munkaprompt: `docs/FELADAT-1.15.1.md`.

- **Új licencfunkció `vision_prompt`** („Prompt a 3D képből (Claude képleírás)”): Professional és Agency csomagban, Starterben nincs. Starter csomagban 0 Claude-hívás, a megszokott prompt megy, és a böngésző nem készít `scene_` képet; az Anthropic-beállításoknál a felület kiírja, hogy a Professional csomagtól érhető el. Saját oldalon (`AGH_OWNER_MODE`) mindig él.
- Saját oldalon a csomagmátrix szerkeszthető: ha a mátrixot korábban elmentetted, a Professional és az Agency soránál az új funkciót egyszer be kell pipálni, hogy az árazóoldalon is látsszon (az ügyféloldalakon a beépített mátrix él, ott nem kell semmi).
- Mérve: `vision-test` 55/55 (új: mátrix, saját oldal, Starter = nem fut és 0 hívás, Professional és Agency = fut) · `guide-test` 62/62 · `license-hub-test` 40/40 · autoloader 123/123 · lint 0 · 15 nyelv × 2495 szöveg, 0 hiba.

## 1.15.0 – 2026-10-21

Norbi: a „photorealistic rendering prompt engineer” sablon – a Claude a 3D képernyőképből írja a Magnific-promptot, csak a kapcsos helyőrzők cserélődnek, üresen „default”. Munkaprompt: `docs/FELADAT-1.15.0.md`.

- **Prompt a 3D képből** (AI-szolgáltatók → Anthropic, alap: be): a külső képeknél (hero, front, back, left, right, aerial) a Claude megkapja a látogató 3D képernyőképét és Norbi sablonját (`assets/data/prompts/vision-exterior.txt`, szó szerint), és kényszerített tool-hívással adja vissza a leltárt (`detected_elements`, 9 mező), a promptot és a tiltólistát. Helyőrzők: napszak, évszak, időjárás a mezők angol szövegéből; kívánság = a látogató saját instrukciója + a tetőtermék sora (BRAMAC); Magnific-leírás nincs → „default”.
- **A Claude a teljes jelenetet látja:** tiszta vezetőkép mellett a böngésző ugyanabból a kameraállásból a járművekkel, emberekkel, állatokkal együtti képet is elkészíti (`scene_<nézet>`); a Magnific structure képe továbbra is a tiszta.
- **A végső prompt:** a hűség nyitóblokkja (mint eddig) + a Claude promptja + „Avoid: ” az alaplistával elöl, a Claude saját tételeivel és a konfiguráció téves alternatíváival, ismétlés nélkül. Mérve: 2100 karakter (határ 3900), a negatív lista teljes.
- **Csak „Hű”, „Klón” és egyedi hűségnél**, kulccsal és mentett 3D képpel; belső nézetnél, „Szabad”/„Kiegyensúlyozott” fokozaton és kikapcsolva a mai prompt megy, bájtra ugyanaz. Bármilyen hibánál (rossz válasz, túl rövid prompt, időtúllépés) is a mai prompt megy, a kép elkészül.
- **Gyorsítótár:** az eredmény a védett tárhelyen (`vision-<nézet>.json`); a három koncepcióképhez 1 hívás, újrapróbálásnál 0.
- **Admin:** a projekt adatlapján képenként „Mit őriz meg a kép” (leltár + kiküldött prompt); saját sablon, temperature (0,2), időkorlát (60 s). A render feladat zárolása bekapcsolva a képleírás idejével hosszabb.
- Mérve: új `tests/vision-test.php` 48/48 (az Anthropic-hívás elfogva, hálózat nélkül) · `guide-test` 62/62 · `tests/e2e/guide.js` kulcs nélkül változatlan, kulccsal hero + `scene_hero` 1152×700, utána 5 `scene_` nézet, konzolhiba 0 · `storage-test` 10/10 + 11/11 · `stuck-project` 9/9 · `gen`, `cancel`, `wizard` zöld · sketch 1247 rajz 0 hiba · autoloader 123/123 · lint 0 · 15 nyelv × 2493 szöveg, 0 hiba.
- **Nem mérhető itt:** éles Anthropic- és Magnific-kulcs nincs; a kép minősége és a Claude-hívás tényleges költsége éles kulccsal mérendő.

## 1.14.5 – 2026-10-21

- **Fejléc telefonon:** szűk helyen a fejléc ikongombjai 1 px-et zsugorodtak (43 px), mert a rugalmas sor engedte; most a gombok soha nem zsugorodnak, a márkanév rövidül. Mérve: `tests/e2e/build.js` felület 110 mérés, hibás 0 (előtte 2); `responsive` és `wizard`: a 44 px alatti érintési célok száma minden méreten és lépésen azonos az 1.12.1-gyel, túllógás 0, konzolhiba 0.
- Az 1.14.4 mérései a teljes csomagon: `fullscreen` 76/76, `build.js 5` (50/50 lépés, geometriai hiba 0, csúszka 15/15, újbóli belépés 5/5, 3D fázisváltás max 10,5 ms), `theme.js`, `cta.js`, `build-test` 6975/6975, autoloader 121/121 – zöld.

## 1.14.4 – 2026-10-21

Norbi: „Az itteni teljes képernyő nem megy az alapok tervezésénél.” Munkaprompt: `docs/FELADAT-1.14.4.md`.

- **Gyökérok:** a rajz eszközsorának utolsó gombja a „Teljes rajz” (nézet visszaállítása) volt, a teljes képernyő ikonjával; valódi teljes képernyő a rajzon nem volt. Az Esc-et építési módban a szerkesztő elnyelte, ezért a tartalék (CSS) teljes képernyőből sem lépett ki.
- **Új teljes képernyő gomb** a rajzon (a tervező saját megoldásával: natív, ahol nincs, ablakkitöltő tartalék): alaprajz, 3D építési állás és fázis-csúszka együtt; teljes képernyőn telefonon is váltható az alaprajz / 3D. Kilépés: Esc, a gomb, telefonon a Vissza; a tervezőbe visszalépéskor magától bezárul.
- **„Teljes rajz” saját ikont kapott** (célkereszt). Esc építési módban: előbb a rajzolást / kijelölést szakítja meg, aztán a teljes képernyőből lép ki; a tervezőt nem zárja be (a rajz nem vész el).
- Mérve, új `tests/e2e/buildfs.js` (natív + tartalék, 1366×768 és 390×844): a rajz 467 → 690 px, illetve 572 → 704 px, a képernyő 100 %-a; 3D vászon 581 / 633 px; Esc és a gomb után az eredeti méret; az ikonok eltérnek; konzolhiba 0.

## 1.14.3 – 2026-10-21

Norbi (4 kérés): a sima 3D tervező „mindig középen kicsiben”; az építési állás csúszkája „nem a sorral nő … az 1. pontnál már a 8-ast mutatja”; a „Vissza a tervezőbe” után újra belépve „szürke képernyő”; „a logó nagyon kicsi a háztervező gombon”. Munkaprompt: `docs/FELADAT-1.14.3.md`.

- **A tervező panelei téma-függetlenek:** a téma a `section`/`aside` elemekre ≈ 100 px belső margót tett, ezért a „Tervezés” fül és az előnézet lecsúszott és összement. Most a panelek, a fejléc, a műveleti sáv, az oldalsáv és a fülek saját margóval dolgoznak. Téma-szimulációval a fül a panel tetejétől 1 px (előtte ≈ 160 px), az előnézet a panel 72 % (1366×768) / 80 % (1920×1080); téma nélkül hajszálra azonos az 1.14.2-vel.
- **A fázis-csúszka a lépéssel halad:** megnyitáskor és minden lépésváltáskor az aktuális lépést mutatja (0–9); kézzel húzható.
- **Újbóli belépés:** a bezárás eddig kivette a DOM-ból az építési mód keretét, másodszorra a szerkesztő egy láthatatlan elembe épült (szürke képernyő). Most csak kiürül, belépéskor mindig visszakerül; a rajz megmarad.
- **Megnyitógomb:** a „⌂” betűjel helyett az Arculat ikonja / logója (48 px-es elem, 40 px-es kép), ennek hiányában éles SVG házikon; a gomb stílusa a gombbal együtt kerül az oldalra (eddig csak a tervező megnyitása után töltődött be), téma-független.
- Mérve: `tests/e2e/build.js 10`: 100/100 lépés, geometriai hiba 0, **csúszka a lépéssel 15/15, újbóli belépés 5/5, rajz megmaradt 5/5**, 3D fázisváltás max 6,2 ms, felület 110 mérés 0 hiba, konzolhiba 0 · `tests/e2e/theme.js` (új mérőpontok) zöld · új `tests/e2e/cta.js`: ikon 48×48, logóval 40 px, SVG 26 px, gombokat átformázó témával és bezárás után ugyanaz, konzolhiba 0 · `wizard` és `responsive` (túllógás 0, konzolhiba 0) · `build-test` 6975/6975 · autoloader 121/121 · lint 0.

## 1.14.2 – 2026-10-21

Norbi: „nagyon vékony sávban tudom a ház alapját csinálni, és nem nagyítódik ki; amikor töltöm be az appot, kellene töltésindikátor, mert alul-fölül is hatalmas hely”. Munkaprompt: `docs/FELADAT-1.14.2.md`.

- **Gyökérok:** a WordPress-téma minden `section`/`aside` elemre saját belső és külső margót tesz (Norbi képein ≈ 100 px fent és lent); az építési mód két saját `section`-je ezt átvette, ezért a rajzterület a maradékra zsugorodott.
- **Javítás:** az építési mód és a varázsló saját elemei téma-függetlenek (saját margó, belső margó, box-sizing; a szelektor erősebb a téma `section`-szabályainál); a rajzterület legalább 280 px, telefonon legalább a képernyő fele.
- **A ház kitölti a rajzot:** a nézet a ház köré igazodik (a telek csak a 0. lépésben), a rajzterület arányához; új **− / +** nagyítógomb (1,25×), a „Teljes rajz” visszaállít.
- **Töltésjelző:** a tervező megnyitásakor („A háztervező betöltése…”, téma-független, beágyazott stílussal), az építési mód betöltésekor és a 3D építési állás első felépítésekor.
- Mérve (`tests/e2e/theme.js`, téma-szimuláció `section, aside { padding: 100px 0; margin: 40px 0 }`, sötét téma): rajzterület 1366×768: 2 → **467 px** (rajzoldal = panel 521 px), 1920×1080: 117 → **677 px**, 390×844: 12 → **572 px**; üres sáv fent/lent 100/100 → **0/0 px**; a ház a rajz 71 % (telefon 78 %); nagyítás 1,25×; töltésjelző a kattintás után **1 ms**-mal látható, a tervező megjelenésével egy képkockában eltűnik (maradt 0); konzolhiba 0. `build-test` 6975/6975, `sketch-test` 1247 rajz 0 hiba, autoloader 121/121.
- 3 új felirat 15 nyelven, 0 hiba.

## 1.14.1 – 2026-10-20

- **Javítás – telefonon lefagyott az építési mód:** ha a rajzterület magassága 0 volt (telefonon a „Lépés” fül alatt rejtve), a rács rajzolása végtelen ciklusba futott. Most a látható terület mérete korlátozott, és rejtett rajznál a rács a nézetdoboz szerint készül.
- Mérve: `node tests/e2e/build.js 100`: 100 ház, 1000/1000 lépés lezárva, geometriai hiba 0 (kilógó fal 0, nyílás a falon kívül 0, átfedés 0, lebegő 0), rajz = modell 100/100, paraméterek 100/100, helyiségek 100/100, tető 100/100; 3D fázisváltás átlag 0,9 ms / max 5,3 ms; a tervezőben tömeg egyezik, belső terek 6/6, szerver ugyanazt menti, generálás a rajzzal; felület 110 mérés 0 hiba (320–1920 px); konzolhiba 0.
- Kikapcsolt építési móddal a meglévők zöldek: `search`, `layout` (15/15, 8/8), `pick`, `cards` (55 mező, 0 alapjelenet), `color`, `fullscreen` 76/76, `guide`, `gen`, `street`, `rooms` (30 szoba, kilóg 0), `roomcam` (átlag 89 %), `wizard` és `responsive` (túllógás 0, konzolhiba 0), `guide-test` 62/62, `sketch-test` 1247 rajz 0 hiba.

## 1.14.0 – 2026-10-20

Norbi: „Házépítés az alapoktól funkció kell … kőműves módra, nulláról felépíteni a házat”, kiegészítve: „alkalmazza vagy ne alkalmazza a magyar törvényeket az adott helyen”. Munkaprompt: `docs/FELADAT-1.14.0.md`, leírás: `docs/EPITESI-MOD.md`.

- **Új belépés: „Építés az alapoktól”** (admin kapcsoló `build.enabled`, alap: **ki**). Kikapcsolva a tervező pontosan az 1.12.1 szerint működik: nem töltődik be új fájl, a séma, az alapértékek, a szerveroldali modell és a prompt bájtra ugyanaz. Bekapcsolva a varázsló első lépésén „Gyors terv” / „Építés az alapoktól” kártya, a fejlécben (telefonon a menüben) gomb.
- **Lépésvezérlő 0–9** (telek és helyszín, földmunka, alap, alapvezetékek, aljzat, főfalak, válaszfalak, nyílások és áthidalók, koszorú és födém, tető), ellenőrzőlistával és lezárási feltételekkel; a lezárt, de később módosult lépés jelölve. A 10–15. lépés (nyílászárók, gépészet, vakolás, esztrich, szakipar, külső) látszik, 1.14.1–1.14.3-ban jön; az adatmodell előkészítve (`services`, `surfaces`).
- **2D falszerkesztő**: rács 10 cm, 1 cm pontosság, minden méret számmal; falhúzás, téglalap, L, „a mostani házból” (a kitalált értékek jelölve), illesztés falvéghez/falra/rácsra, végpont- és falhúzás, nyílások elhelyezése és csúsztatása, helyiségek területtel és fajtával, visszavonás/újra, nagyítás egérrel és két ujjal.
- **Közös terv (`BuildAdapter`)**: falgráf → helyiségek (zárt hurkok, nettó terület) és külső kontúr → a sketch tömegei; a 2D vázlat, a 3D ház, a szerveroldali `BuildingModel`, a vezetőkép és a belső terek ugyanabból a rajzból épülnek. A tető a meglévő generátorral: derékszögű kontúrra (téglalap, L, T, U…) épül, ferde külső falnál a program kiírja, miért nem.
- **3D építési állás**: fázis-csúszka 0–9 (kitűzés → földmunka → alap → vezetékek → aljzat → falak nyílásokkal → válaszfalak → áthidalók → koszorú és födém → kész ház tetővel), csak láthatóságváltás, a fázisok shaderei és textúrái előre betöltve.
- **Anyaglista** fázisonként, hulladékszázalékkal, tájékoztató jelleggel (`assets/data/build-defaults.json`, minden érték „nem ellenőrzött”).
- **Helyszín és előírások**: ország → megye → település, fagyhatár, talaj; kapcsoló Be / Ki / Egyedi; HÉSZ-értékek kézzel, forrás mezővel; magyar szabálycsomag-váz `assets/data/rules/hu.json` (12 szabály, mind `verified: false`, forrás, hatálybalépés, csomagverzió, ellenőrzési dátum; `source_checked` csak a TÉKA 6. § (1) és 9. § (3) helyen). Szakmai figyelmeztetések külön (9 szabály). Ez nem statikai és nem engedélyezési terv – a felület kiírja; a figyelmeztetések soha nem akadályozzák a mentést.
- **Szerver**: új `build` mező (`Build::sanitize`, a JS normalize pontos portja), `BuildingModel` a rajzból (bekapcsolt módnál), a prompt leírja a falazatot (pl. „load-bearing walls of 38 cm ceramic masonry blocks with 12 cm EPS insulation”).
- Mérve: `node tests/build-test.js` **6975/6975** (300 véletlen ház 0 geometriai hiba, tömeg = kontúr; 3 referenciaház anyagmennyisége 1 %-on belül a kézi számítással; minden szabály megfelel/nem felel meg esete, Ki = 0 üzenet, Egyedi küszöb, kikapcsolt mód = azonos vázlat) · `php tests/build-test.php` **2217/2217** (JS–PHP egyezés 123 házon) · `node tests/e2e/build3d.js`: 20 ház, fázisváltás max 0,1 ms; képkocka az építési fázisokban ≤ 11 ms, a kész ház első képkockája SwiftShaderen ugyanannyi, mint a mai házé (5–16 s, szoftveres rajzolás) · `node tests/e2e/build.js 3`: 30/30 lépés, geometriai hiba 0, rajz = modell, 3D fázisváltás max 5,3 ms, tervezőben tömeg egyezik, belső terek 6/6, szerver ugyanazt menti, generálás a rajzzal, felület 110 mérés 0 hiba (320–1920 px), konzolhiba 0 · `sketch-test` 1247 rajz 0 hiba · `guide-test` 62/62 · autoloader 121/121 · lint 0.
- 330 új felirat 15 nyelven (nyelvenként 2481 szöveg, 0 hiba).
- Nem mérhető itt: a kép szépsége, telefon valódi GPU-n, a jogi szabályok helyessége.

## 1.12.1 – 2026-10-15

Norbi: „Teljes kepernyos gomb kell a popupba neha jobb kitenni nagyba”. Munkaprompt: `docs/FELADAT-1.12.1.md`.

- **Felmérés – a popupok, amelyekben kép, 3D vagy 2D van:** (1) maga a tervező popup (`.agh-root`, benne minden panel, a színválasztó, a párbeszédablakok és az üzenetek – a `body`-ba ezen kívül semmi nem kerül); (2) az élő előnézet (`.agh-preview-box`: 3D vagy 2D vázlat, a tervezőben és a varázslóban is); (3) a nagyított kép (`.agh-lightbox`, koncepciók és galéria). A többi párbeszédablak (minták, projektek, mentés, ajánlatkérés) szöveges, ezekbe nem került gomb.
- **Teljes képernyő gomb mindháromban:** a fejlécben a bezárás mellett, az előnézet jobb alsó sarkában (az egyetlen szabad sarok), a nagyított kép felső sávjában. Az ikon vált (kinyit/összecsuk), `aria-label`, `title`, `aria-pressed`.
- **Működés:** Fullscreen API az elemen (szabványos és `webkit`). Kilépés a gombbal, Esc-kel és a böngésző saját kilépésével; az ikon a `fullscreenchange` eseményből frissül, és ha egy böngésző az eseményt elmulasztja, a kilépés ígérete és egy rövid ellenőrzés pótolja.
- **Tartalék elem-szintű teljes képernyő nélkül (iPhone Safari):** az elem CSS-sel tölti ki az ablakot (`position: fixed; inset: 0; 100dvh`, safe-area kitöltés), a szülők átmenetileg elengedik, ami egy fix elemet csapdába ejtene (transform, filter, backdrop-filter). A telefon Vissza gombja előbb a teljes képernyőből lép ki, csak utána zárja a tervezőt.
- **Ami kívül nyílna:** teljes képernyős előnézet alatt a párbeszédablakok és az üzenetek (pl. a koppintott tárgy neve) az előnézetbe nyílnak, a fókuszcsapda is az előnézetre szűkül. A tervező egészének teljes képernyőjén minden a popupban marad (színválasztó, lenyílók, megerősítések).
- **Méretezés újraépítés nélkül:** a 3D a meglévő `ResizeObserver`-rel méretez (`setSize` → kamera-arány, egy rajzolás), a jelenet nem épül újra. **Új: a nézőpont a célponttal együtt megmarad** (eddig átméretezéskor a kamera célpontja a ház közepére ugrott, egy eltolt nézet elveszett). **Új: képpont-keret** – 3 millió képpont felett a pixelarány csökken, így egy 4K monitoron a teljes képernyő sem rajzol 13 millió képpontot képkockánként; a normál előnézet ezt soha nem éri el, ott minden a régi. A 2D vázlat vektoros, magától élesen tölti ki a képernyőt. A nagyított kép `contain` módban tölti ki a képernyőt, és ha van nagyobb tárolt változat (a letöltési fájl), azt tölti be, közben a mostani kép látszik.
- **Működik teljes képernyőn is:** koppintás a modellre (`pickAt`; az előnézet teljes képernyőjéből a mezőhöz ugráskor kilép, hogy a mező látsszon), kézi elrendezés, Ctrl+Z, színválasztó, kereső.
- Mérve: új `tests/e2e/fullscreen.js` **76/76** (asztali 1440×900 és telefon 390×844, Fullscreen API-val és letiltva CSS-tartalékkal; előnézet, tervező popup, nagyított kép; be/ki gombbal és Esc-kel, vászon = nézetablak 1 px-en belül, kilépés után az eredeti méret, a kamera helyzete és célpontja 0,01 m-en belül, színválasztó látható `elementFromPoint`-tal, Vissza gomb a tartaléknál), konzolhiba 0. A meglévők zöldek: `search` (0 fókuszvesztés), `color`, `pick` (kívül és belül talál), `layout` (15/15 fogható, kilóg 0), `responsive` (túlcsordulás 0, 24 px alatti cél 0), `wizard` (48 lépés, 0 hiba), `gen` (202), `sketch-test` (1247 rajz, 0 hiba), autoloader 119/119, lint 0.
- **Belépéstől az új képkockáig:** telefonméretben 49 ms (CSS) és 1,8 s (API), asztaliban 5–6 s – ez SwiftShader (szoftveres GPU): itt egyetlen képkocka is 0,05 és 4,8 s között ingadozik a normál előnézetben is, ezért a ≤ 100 ms cél **ebben a környezetben nem mérhető**; valódi GPU-n kell megnézni.
- 2 új felirat 15 nyelven (nyelvenként 2151 szöveg, 0 hiba).

## 1.12.0 – 2026-10-14

Norbi kézi receptje (3D = structure 70–85, mintafotó = style 40–50, negatív prompt a téves alternatívákra) beépítve, és a kapott kép összevetése a kívánt minőséggel. A képek száma, nézetei, formája és adatai változatlanok – csak a minőség a cél.

- **Stílusonkénti mintakép style referenciaként.** AI-szolgáltatók → Magnific → „Fotószerűség”: stílusonként (22 + egyedi) egy médiatár-kép, plusz általános és belső tér minta. A fő kép és a Mystic-úton készülő nézetek `style_reference`-ként kapják, 1536 px-re kicsinyítve, JPEG-ben. Sorrend: a beállított minta → a stílus katalógusképe → az általános minta. Minta nélkül minden a mai úton megy.
- **Két külön erősség.** A hűség-kapcsoló a structure erősség (Hű **75**, Klón **85** – eddig 65/80), az új „Stílusminta erőssége” (alap 45) a mintáé; a Mystic felé `adherence = 100 − érték` (a Mystic-ben a nagyobb adherence a szöveget, a kisebb a mintát követi). Új `hdr` beállítás (alap 35, csak stílusreferencia mellett megy; kisebb = természetesebb). Az új telepítéseken a `mystic_engine` alapja `magnific_sharpy` (a doksi szerint a fotórealizmusé) – elmentett beállításnál kézzel kell átállítani.
- **Negatív prompt a konfigurációból.** `PromptEngine::config_negative()`: a választott értékek téves alternatívái (tetőforma, tetőszín-család, szintszám, homlokzatanyag és -szín, ablakkeretszín, garázs, medence, erkély, kémény, napelem, emberek, autók), kívül a pajta/második ház/plusz szárny, belül a plusz bútor és nyílás. A ház saját értéke soha nem kerül rá. A kérés `negative_prompt` mezőben is viszi; a Mysticnek nincs ilyen mezője (docs.magnific.com), ezért „Also avoid: …” mondatként a prompt végére kerül – ez kikapcsolható.
- **3D vezetés a belső nézetekhez is.** A tervező a renderelendő helyiségekről (legfeljebb 8) vezetőképet készít, a szoba nyitott sarkából, szemmagasságból, széles látószöggel – nem a kivágott „babaház” nézetből, mert azt a képmodell lemásolná. A belső kérés structure referenciát és saját nyitóblokkot kap (ugyanaz a szoba, falak, nyílások, bútorhelyek; nincs plusz bútor).
- **Tiszta vezetőkép** (a 2. kép hibáiból): a vezetőképről lekerülnek a járművek, emberek, állatok, a háttér kúpfái és a pára. Ezek a 3D-ben egyszerű tömbök, és a structure referencia a formájukat adta tovább (részlet nélküli „játékautók”, kúp alakú fák); a szövegből így valódi formában készülnek.
- **Fotós kameramagasság.** Ha a látogató 18°-nál magasabbról nézi a házat (és a fő kép kameraállása nem „Madártávlat”), a hero vezetőképe az ő irányából, de 9°-ról készül – az építészeti fotók szemmagasságból készülnek. „A látogató kameraállása” beállítással a mai pontos kamera marad.
- **A prompt hossza újraszámolva.** Nyitóblokk + prompt + negatív lista együtt fér a 3900 karakterbe, a negatív lista soha nem vágódik le; a kérés pontos szövege az asset promptjába kerül.
- Mérve: `tests/guide-test.php` **62/62** (a régi 31 + 31 új: negatív lista tartalma és fordított esete, a Magnific-kérés teste hálózat nélkül – structure 75, adherence 55, hdr 35, minta nélkül nincs style referencia, a nézetek régi adherence-e 60 –, mintakép 1536 px JPEG, általános és belső minta, belső vezetőkép és nyitóblokk, hosszhatár túl hosszú szöveggel is); `tests/e2e/guide.js` 6 nézet + 4 belső vezetőkép feltöltve, a tiszta és a szemmagasságú hero eltér az élő képtől, 0 konzolhiba; `AGH_3D=1 sketch` 144 mező, 3D 91 változás, 0 hiba; gen 202 / 0 konzolhiba; tárhely 10/10 + 11/11; beragadt projekt 9/9; autoloader 119/119; lint 0.
- **Nem mérhető itt:** a kép szépsége (a tesztoldalon nincs éles Magnific-kulcs). Az alapértékek a Magnific dokumentációjából és Norbi kézi receptjéből jönnek.
- 25 új felirat 15 nyelven (nyelvenként 2149 szöveg, 0 hiba).

## 1.11.1 – 2026-10-14

Norbi összehasonlította a 3D modelljét a kapott koncepcióképpel: a képen négy-öt épület volt egy helyett (hosszú fa pajta, plusz szárnyak), antracit tető a vörösbarna helyett, pergola és zsalugáter nélkül, madártávlatból. Négy gyökérok volt, mind a négy javítva.

- **A prompt maga rendelt plusz épületet.** A „Vidéki, rusztikus” stílus szövege szó szerint ezt tartalmazta: „long narrow farmhouse with a covered porch (tornac) **and a barn wing**…”, pedig a 3D soha nem épít pajtaszárnyat. A szöveg javítva, és a frissítés (DB v9) a már telepített oldalakon is lecseréli – de csak ott, ahol a szöveget nem írták át kézzel.
- **A tetőszín ellentmondott a modellnek.** A prompt a tetőtermék saját színszövegét írta ki (gyakran „in anthracite”), a 3D viszont a `roof_color` mezőből fest. Mostantól a termék típusa marad, de a szín a modellé: `roof_color = #8C4A35` mellett a prompt „Classic Roman-profile concrete roof tiles, **in brick red**”, és nincs benne ellentmondó szín.
- **„Hű” és „Klón” fokozaton a kötő utasítás a prompt ELEJÉRE került**, és kimondja a tiltást is: pontosan EGY épület, a referenciaképen látható tömegekkel és nyílásokkal; tilos pajta, istálló, melléképület, második ház, további szárny vagy annex; garázs, terasz, pergola, előtető, erkély, zsalugáter és kerítés csak ott, ahol a referencián van, és ami a referencián látszik, az nem maradhat le; a kameraállás és a horizont is kötött. (A képmodellek a prompt elejét súlyozzák a legjobban, és amit nem tiltunk, azt hozzátehetik.)
- **A vezetőkép képaránya nem egyezett a kész képével** (1,756 vs. 1,643), ezért a structure referencia nyújtva-vágva került a képre. Mostantól a plugin a visszakapott képből **megméri** a valódi képarányt, elteszi (`magnific.guide_aspect`, alap 1,645), és a következő vezetőképek már abban készülnek. Mérve: a kérésben a hero 1152×700 = 1,646, a kell 1,645.
- Mérve: `tests/guide-test.php` 31/31 (nyitóblokk, tiltások, kameraállás, nincs pajtaszárny, tetőszín a modellé, a prompt a nyitóblokkal együtt is belefér: 3639 < 3900 karakter), `tests/e2e/guide.js` képarány-ellenőrzéssel 0 konzolhibával, gen/sketch/search/layout/stuck mind hibátlan.

## 1.11.0 – 2026-10-14

- **Hűség a 3D modellhez – egy kapcsolóval.** Az AI-szolgáltatók oldalon új választás: Szabad (25) · Kiegyensúlyozott (45) · **Hű (65, alapértelmezés)** · Klón (80) · Egyedi (a kézzel megadott érték). Eddig egyetlen nyers 0–100-as számot kellett eltalálni; mostantól a súgó is megmondja, melyik mit ad, és hogy a nagyobb hűség pontosabb formát, de kissé „renderesebb” képet jelent.
- **A prompt megmondja a képmodellnek, mi a referenciakép.** Eddig a 3D kép ment vele, de egy szó sem szólt róla, tehát a modell nem tudta, hogy azt a tömeget kell követnie. Mostantól vezetőkép mellett a prompt végére kerül a hűség szerinti mondat; „Hű” és „Klón” fokozaton a legszigorúbb: ugyanaz a tömeg és arány, ugyanaz a tetőforma, -hajlás és ereszkiülés, minden ablak és ajtó ugyanannyi, ugyanakkora és ugyanott, ugyanaz a terasz, erkély, előtető és garázs, ugyanaz a nézőpont – csak az anyagok, a fény és az árnyékok legyenek fotórealisztikusak. Vezetőkép nélkül a prompt változatlan.
- A felskálázás súgója megmondja, mikor éri meg (nyomtatás, nagy bemutató) – képernyőn a 4k enélkül is elég.
- Új szakasz az adminkézikönyvben: mit tud és mit nem tud a képgenerálás (mi tartható: tömeg, tető, nyílások, anyagok; mi változik képenként: ablakosztás, kőminta, növényzet, égbolt), és melyik hűségszint mire való.
- Mérve: `tests/guide-test.php` 21/21 – mind az öt hűségszint a várt erősséget adja (25/45/65/80/egyedi), a klón mondat hivatkozik a referenciaképre, vezetőképpel a hero promptja tartalmazza a mondatot, vezetőkép nélkül nem. `tests/e2e/gen.js` 202, 0 konzolhiba.
- 10 új felirat 15 nyelven (nyelvenként 2124 szöveg, 0 hiba).

## 1.10.0 – 2026-10-14

- **A generált kép a 3D modellt követi.** Eddig a három koncepciókép tisztán szövegből készült: a `Pipeline::render()` csak a homlokzati nézetekhez (front/back/left/right) küldött geometriai vezetést, a `hero`-hoz nem – és az első körben kizárólag hero készül, a többi nézet csak a koncepció kiválasztása után. Így minden látott kép vezetés nélkül jött. Ráadásul ahol volt vezetés, az sem a 3D volt, hanem a `GuideRenderer` lapos tömegvázlata a szerveroldali modellből. Mostantól a böngésző a látogató saját 3D modelljéről készít képet, és azt küldi a generálással; a hero pontosan abból a kameraállásból, ahogy a látogató a házat a képernyőn látja. Mérve: 6 nézet (hero, front, back, left, right, aerial) 1152×656 pixelen, 93–130 KB, a `/generate` kérésben a hero, a galéria nézetei utána a háttérben; a szerveren a hero kérése 4 KB-nál nagyobb structure referenciát kap (korábban 0-t).
- A vezetőképek a védett tárhelyre kerülnek (`guides-<nézet>.jpg`), nyilvános URL nélkül. Csak PNG/JPEG, legfeljebb 1,5 MB és 2048 px, projektenként legfeljebb 8 – minden más csendben kimarad.
- A képkészítés soha nem lassítja a generálást: a hero képe akkor indul, amikor a megerősítő kérdés megjelenik, és ha 15 másodperc alatt nincs kész (nagyon lassú gép, nincs WebGL), a generálás kép nélkül indul, pontosan úgy, mint eddig. A galéria nézetei a generálás után, külön hívásban mennek fel.
- A geometriai vezetés erőssége új telepítésen 45 (volt 30), és a beállítás súgója megmondja, mit jelent a szám: 20–30 laza követés, 40–60 felismerhetően ugyanaz a ház, 70 felett a kép a rendert másolja.
- Teszt módban a „generált” kép maga a 3D vezetőkép (jelöléssel), így szabad szemmel is látszik, mi megy ki a képgenerálónak.
- Új szűrő bővítéshez: `agh_provider_request` (a képszolgáltatónak menő teljes kérés).
- Új tesztek: `php tests/guide-test.php` (14/14 – tárolás, ellenőrzés, a hero kap vezetőképet, vezetőkép nélkül a régi viselkedés) és `node tests/e2e/guide.js` (6 nézet, a kérés tartalma, 0 konzolhiba).
- 3 új felirat 15 nyelven (nyelvenként 2114 szöveg, 0 hiba).

## 1.9.2 – 2026-10-14

- Védett tárhely: a „A védett tárhely könyvtár HTTP-n keresztül elérhető!” figyelmeztetés mostantól elvégezhető feladat. Kiírja az érintett könyvtár valódi útvonalát, és odaadja mindkét megoldást másolható formában: a `wp-config.php`-ba való `define( 'AGH_PRIVATE_DIR', … );` sort (webgyökéren kívüli útvonallal) és az ehhez a telepítéshez tartozó Nginx `location ^~ … { deny all; return 403; }` blokkot. Azt is megmondja, mi van a könyvtárban (koncepcióképek és a kivitelezői ZIP az ügyfél adataival), tehát miért kell javítani.
- Új „Ellenőrzés újra” gomb a figyelmeztetés mellett: törli az órás gyorsítótárat (`agh_storage_health`) és azonnal újra mér, így a szerverbeállítás után rögtön látszik, sikerült-e. Eddig akár egy órát kellett várni az eredményre.
- Új „Fájlok áthozása” gomb: ha az `AGH_PRIVATE_DIR` utólag kerül be, a régi `uploads/agh-private-<utótag>/` könyvtárban maradt projektfájlokat egy kattintással áthozza az új, védett helyre (létező célfájlt soha nem ír felül, a kiürült régi könyvtárat törli). Eddig kézzel kellett másolni, különben a régi képek „File missing” hibát adtak.
- Új teszt: `tests/storage-test.php` (valódi WordPressen, két szakaszban). Mérve: alapállapotban a próbafájl HTTP-n elérhető (10/10 ellenőrzés), `AGH_PRIVATE_DIR` mellett nincs URL-je és a health nem jelez, 2 projekt 4 fájlja áthozva 0 hibával, mind a 4 olvasható az új helyen, az útvonal-ellenőrzés `..`-t és abszolút utat továbbra sem enged (11/11).
- 16 új felirat 15 nyelven (nyelvenként 2111 szöveg, 0 hiba). A telepítési útmutató 6.3 és 6.4 szakasza is frissült.

## 1.9.1 – 2026-10-14

- Tárgyak megfogása egérrel (a 7 pontos lista 7. tétele): a belső nézetben bármelyik bútor megfogható, a padlón oda húzható, ahova a látogató szeretné, és el is forgatható (egérgörgő vagy Shift + oldalra húzás, 15 fokos lépésekben). Érintőképernyőn rövid nyomva tartás fogja meg a tárgyat, így a nézet forgatása változatlanul működik. A falra akasztott dolgok (kép, fali polc) nem lebegnek be a szoba közepére: a legközelebbi falra simulnak, és azzal együtt fordulnak. Minden elhelyezés mentődik helyiségenként és tárgyanként (`room_layout`), újratöltés után is megmarad, és bekerül a koncepciókép promptjába is. Ctrl+Z visszavonja az utolsó mozgatást, a jobb felső sarokban lévő gomb visszaállítja a helyiséget automatikus berendezésre. Egy tárgy sem tud kilógni a falon: a program a teljes testét tartja a szobán belül, nem csak a középpontját. Mérve: 15 tárgyból 15 megfogható, 8 mozgatva és forgatva, 0 kilógó, újratöltés után 8/8 a helyén, visszaállítás működik, 0 konzolhiba. Új teszt: `tests/e2e/layout.js`.
- Városi utcasor (3. tétel): valóban városi. Gyökérok: a sorházak csak akkor épültek fel, ha a „Környező épületek látszódjanak” be volt kapcsolva, a szomszédgyorsítótár kulcsa nem különböztette meg a városi utcát a vidékitől, és a táj 300 fát ültetett a ház köré. Mostantól a városi utcasorhoz a 10 sorház mindig hozzáépül (a beállítástól függetlenül, mert maga az utcasor ettől utcasor), a gyorsítótár három külön utcatípust tart számon (városi, külvárosi, vidéki), a fák száma 300-ról 55-re csökkent, és a látóhatáron városi tömbök állnak erdő helyett. Mérve: 16 helyszín, a városi utcán 10 sorház és aszfaltos utca zebrával és parkoló autókkal, a 10 vidéki helyszín változatlanul földút 0 házzal, 0 konzolhiba. Új teszt: `tests/e2e/street.js`.
- Helyiségek részletei (2. tétel): a helyiségenként beállított burkolat, falszín, mennyezet, világítás, bútorstílus, dekor, függöny, ajtó, ablak és fűtés a 3D belső nézetben is látszik, nem csak a promptban. Mérve: 30 helyiségmezőből 22 változtatja a 3D képet (a többi szöveges vagy csak a koncepcióképre hat), 0 konzolhiba. Új teszt: `tests/e2e/roomdetails.js`.
- 11 új felirat 15 nyelven (összesen 2095 szöveg nyelvenként, 0 hiba).
- Új mérés a betöltési időre: `tests/e2e/perf.js` (kattintástól a kész 3D képig, tömörítés nélkül és lassú mobilhálózaton is).

## 1.9.0 – 2026-10-14

- Kártyaképek: eltűnt a kanapé-helyettesítő. A pince, a padlás, az ajtókeret, a radiátor, a gyerekszoba és az akvárium kártyái a saját tartalmukat mutatják (pincemetszet angolaknás ablakkal és süllyesztett terasszal, fedélszék deszkázott födémmel, ajtónyílás tokkal és takaróléccal, a választott radiátortípus, a téma szerinti gyerekszoba-sarok, az adott formájú akvárium). Ha egy mezőhöz nincs saját jelenet, semleges falfelület jön, nem bútor, és a konzol figyelmeztet. Mérve: 55 mező, 321 opció, 0 esik az alapjelenetre. Új teszt: `tests/e2e/cards.js`.
- Modern színválasztó: a színmezők nem az operációs rendszer régi palettáját nyitják meg, hanem a tervező saját panelját – telítettség/világosság mező, színárnyalat-csúszka, HEX-beírás, a tervben már használt színek és a katalógus palettái. Ujjal, egérrel és billentyűzettel is működik, Esc zárja. Mérve: a teljes felületen 0 natív színmező maradt, a beállítás mindkét képernyőméretben működik, 0 konzolhiba. Új teszt: `tests/e2e/color.js`.
- Ereszcsatorna: a sarkokon nem jön le két lefolyó egymás mellett, csak egy. Mérve: 100 véletlen ház, 331 lefolyó, a legközelebbi két cső 2,1 m-re van egymástól, 0 duplikátum.

## 1.8.1 – 2026-10-14

- Gyerekszoba berendezése (a 19 pontos lista 13. tétele): új mező – semleges, fiús, lányos, babaszoba, tini, vagy csak az alapbútorok. A fiús szobába íróasztal székkel, kisautó és labda kerül kék szőnyeggel; a lányosba baldachin az ágy fölé, fésülködőasztal kerek tükörrel, rózsaszín szőnyeg; a babaszobába pelenkázó és fiókos szekrény; a tinibe íróasztal, gamer szék és babzsák. Két gyerekszobánál a második automatikusan másik berendezést kap, hogy ne legyen egyforma a két szoba. Mérve: mind a hat beállítás felépül (4–13 ms, 140–164 mesh), 0 konzolhiba.
- 8 új felirat 15 nyelven.

## 1.8.0 – 2026-10-14

- Kereső: egy betű után már nem dobja ki a fókuszt. A paraméterlista fejléce (cím + keresőmező) egyszer épül fel, gépelés közben nem építi újra a lista – korábban a mező DOM-ja minden leütésnél új helyre került, és ezzel elveszett a fókusz és a kurzor. Új E2E teszt: `tests/e2e/search.js` (2 képernyőméret × 6 leütés, 0 fókuszvesztés, 0 konzolhiba).
- Lépcső: többszintes háznál mindig látszik. A lépcsőházban és az előtérben akkor is felépül, ha a helyiség keskeny (ilyenkor csigalépcső, legszűkebb helyen váltott fokú, helytakarékos lépcső); ha a tervben nincs előtér vagy lépcsőház, a nappaliba kerül, szabad helyre fordítva. Korábban csak 3,4 m-nél szélesebb előtérben jelent meg, ezért sok háznál sehol nem látszott.
- Erkély: a mező mostantól minden háznál látszik és alapból be van kapcsolva. Tetőtér-beépítéses háznál az oromfalon jelenik meg (eddig kimaradt, mert a program egy szintnek számolta), földszintes háznál franciaerkély lesz belőle.
- Falikép: nem csak a kanapé vagy az ágy fölött van kép. Új mező a mennyiségre (Nincs / Visszafogott / Normál / Sok, galériafal), a képek a látszó falak szabad szakaszaira kerülnek, alacsony bútor fölé igazítva, ablak, ajtó és magas bútor elé soha.
- Tetőszellőző: a tetősíkon belül marad és követi a dőlést. Az elemek a gerinc helyett a tetősíkra, a gerinctől a lejtő harmadába kerülnek, kontyolt tetőnél a szűkülő síkon belülre; a szellőzőcserép, a gomba és a napelemes ventilátor a tető síkjába fordul, a turbina és a kémény függőleges marad. A gerincszellőző a valódi gerinc hosszában fut.
- Hófogó: egy vékony vonal helyett valódi hófogó – két rúd konzolokon, az eresztől kb. három cserépsornyira, a tetősíkra simulva, az ereszcsatorna színében.
- Homlokzati dekorsáv (dryvit): világos vakolt homlokzaton nem fehér többé, hanem egy árnyalattal mélyebb tónus, így nem keretezi fehér gyűrű a nyílásokat. Két új választás: „Homlokzattal azonos (csak plasztika)” és „A homlokzatnál sötétebb”.
- Ajtókeret: minden belső ajtó körül 7 cm-es tok és takaróléc, választható színnel (a stílus szerint, fehér, fa, fekete, falszínű, vagy rejtett tok). Tolóajtó és pajtaajtó nem kap keretet.
- Radiátorok: új mező (a gépészet szerint, lapradiátor, bordás, konvektor, törölközőszárító, nincs). Elsőként az ablak alá kerül, különben szabad falszakaszra, szűk helyen keskenyebb kivitelben; a fürdőbe törölközőszárító, amely a mosdó és a WC fölé is felkerülhet. Padlófűtésnél alapból csak a fürdőben van.
- Új bútorok: fali rejtett polc (három lebegő polc, rejtett LED-del, könyvekkel és dísztárgyakkal) és akvárium. Az akvárium mérete és formája választható (kicsi asztali, nagy szögletes, széles panoráma, gömb, henger, falba épített), a vize édesvízi növényes vagy tengeri korallos; világítással, növényekkel vagy korallokkal, kövekkel, halakkal és akváriumbútorral.
- Háziállat a lakásban: a kutya és a macska mellé fekhely, tálak és macskának kaparófa is kerül.
- Új teszt: `tests/e2e/rooms.js` – véletlen konfigurációkkal belső tereket épít és méri, hogy minden tárgy a szobán belül van-e. Mérve: 56 szoba, 311 tárgy, 0 kilógó, 0 ajtóban álló, 0 konzolhiba, és többszintes háznál 6/6 helyiségben megvan a lépcső.
- Koppintás a modellre: a 3D előnézetben egy elemre kattintva (érintőképernyőn koppintva) a bal oldali beállítások arra a mezőre ugranak, és a mező felvillan. A ház minden része tudja, melyik beállításhoz tartozik: homlokzat, tető, ablak, bejárati ajtó, előtető, terasz, kert, fák, és belül minden bútor, tárgy, kép, radiátor, lépcső, háziállat. Ha a tárgynak nincs saját mezője, a „további bútorok”, „elektronika” vagy „háziállatok” mezőhöz ugrik. A forgatás nem változik: csak a 6 képpontnál kisebb elmozdulás számít koppintásnak. Új teszt: `tests/e2e/pick.js` (122 rész, 8 mező, kívül és belül is talál).
- Kilenc új helyszín a 7 mellé: szőlőhegy présházas domboldallal, alföldi tanya, folyópart, patakvölgy, fenyves hegyvidék, puszta, városi utcasor, sivatagos száraz táj és havas táj. Mindegyiknek saját domborzata, növényzete, talaja és vize van. A rusztikus stílus „a stílushoz illő” tája mostantól az alföldi tanya. Mérve (SwiftShader): mind a 16 táj felépül, 90–218 ms, 0 konzolhiba.
- Hat új építészeti stílus, saját tömeggel, tetővel, anyagokkal, színekkel, kerttel, tájjal és szomszédokkal: **magyar kockaház (kádeerkocka)** négy irányba lejtő sátortetővel és tetőtérrel, **klasszikus magyar parasztház** tornáccal és oromfalas nyeregtetővel, **magyar présház borospincével** a szőlőhegyen, **amerikai mid-century modern** széles ereszkiülésű lapostetővel, **amerikai modern lapostetős** kétszintes dobozokkal, és **sivatagi modern (Palm Springs)** kiálló tetőlemezzel. Mindegyik stíluskártyája a megfelelő beállításokat hozza magával.
- Pince mint valódi szint: új mező a kialakításra (részleges, teljes, vagy pinceszint külső lejárattal). Kívül pinceablakok angolaknában a kert felőli oldalon, a lejáratos változatnál a terepbe vágott süllyesztett terasz, pinceajtó, ablak és külső lépcső korláttal. A helyiségprogramba bekerül a pince szint (gépészet, tároló, mosókonyha, borospince), a helyiség szintválasztójában megjelenik a „Pince”, és a belső nézet oda is átvált. A prompt is leírja.
- Padlás: új mező (a szintek szerint, beépítetlen padlás, beépített tetőtér, nincs padlástér). A beépítetlen padlás saját helyiség: látszó fedélszék (szarufapárok, torokgerenda, szelemen, gerincgerenda), deszkázott födém, padlásfeljáró a nyílással és tárolódobozok.
- Belső nézet: a szoba kitölti a képet, és nincs rajta zavaró árnyék. A kamera mostantól magát a szobát keretezi (a doboz nyolc sarkát visszavetítve, középre igazítva), nem a jelenet gömbjét, és 42° helyett 20°-ról néz be, szemmagasságban célozva; a kamerához legközelebbi padlósarok lóghat csak ki, legfeljebb a kép tizenketted részével. A kivágott plafon nem vet árnyékot a térbe, a nap beltérben feleakkora erővel süt be, az égbolt-fény viszont erősebb: nincs kiégett folt és nincs fekete sarok. A növények a szoba méretéhez igazodnak, a padlóra kerülő bútor pedig a fal mellé húzódik, nem a szoba közepére. Mérve: 13 helyiségtípus, a szoba a kép **89%-át** tölti ki (korábban 70%), 0 képből kilógó tárgy, 0 konzolhiba. Új teszt: `tests/e2e/roomcam.js`.
- 58 új felirat 15 nyelven, az erkély súgója újrafogalmazva.

## 1.7.0 – 2026-10-13

- Tárgyak helyiségenként: a további bútorok, az elektronika és a háziállatok a belső nézetben az éppen nézett helyiségbe kerülnek (vagy onnan ki); a kártyák fölött látszik, melyik helyiségre hatnak, és mi áll máshol. Külső nézetből egy új tárgy a hozzá illő helyiségbe kerül, és a nézet oda vált. Egy tárgy több helyiségben is lehet; a prompt helyiségenként ezt írja le. Új mező: `room_items` (szerveroldali ellenőrzéssel).
- Önjavító berendezés: minden tárgy a szobán belül, az ajtó előtti sáv szabadon, a kivágott (jobb és első) falon nem áll semmi háttal; ha kell, a padlóra kerül a kamera felé fordítva, vagy a legkisebb átfedésű helyre. Ha a 3D valamit áthelyezett, egy rövid üzenet mondja meg, mit („Megoldva: …”). Mérve: 300 véletlen szoba, 628 tárgy, 0 lóg ki a szobából, 0 áll az ajtóban (a vizes helyiségek 82 szerelvényével együtt).
- Nappali: a kandalló és a TV mindig látható falra kerül (nyitott konyhánál a hátsó falra, a kanapé feléjük fordul); a TV a kéménytest előlapján, nem benne. Háló: a TV az ágy végénél alacsony konzolon; a szőnyeg az ágy előtt, nem félig alatta. Fürdő: zuhany, mosdó, WC, bidé és törölközőszárító szabad falszakaszokon, sosem az ajtó elé; szűk fürdőben kisebb zuhany, végül zuhany a kád fölött. WC-ben bidé is.
- Környezet és táj: új beállítás (Kertvárosi utca, Síkság, Dombvidék, Hegyvidék, Erdő szélén, Tópart, Tengerpart, vagy a stílushoz illő – pl. alpesi → hegyvidék, mediterrán → tengerpart, skandináv → tópart). Domborzat 2,4 km-es körzetben szántóföldekkel, sövénysorokkal, sziklával, hóval, homokos parttal, tóval vagy tengerrel; a tájhoz illő erdők (fenyő, lombos, nyír, nyár, olajfa, ciprus), a távoli fák egyszerűsítve; utca járdával, szegéllyel, útburkolati jellel, utcafákkal és lámpákkal (vidéken keskeny út); kevesebb köd. A prompt is a tájat írja.
- Szomszédok: valódi házak a stílus családjából, de mindegyik más (méret, szintszám, tető, anyag, színek), saját kerttel, sövénnyel, beállóval, fákkal – kertvárosban kétoldalt és az utca túloldalán, vidéken néhány tanya.
- Újrakezdés gomb (fejléc, mobilmenü): megerősítés után alapértékekkel indul az új tervezés. A böngésző Vissza gombja bezárja a tervezőt; a bezárás nem kérdez; egy régi, hibás piszkozat nem zárja ki a látogatót (eldobja, és alapértékekkel nyit).
- Mérve (szoftveres GPU, SwiftShader): egy szoba felépítése tárgyakkal legfeljebb 108 ms; egy táj első felépítése 120–215 ms, utána egy beállítás változása 15–57 ms; 8 szomszédház első felépítése 99 ms.
- 20 új felirat 15 nyelven.

## 1.6.0 – 2026-10-13

- Gyorsabb 3D: egyetlen WebGL-környezet az élő előnézetnek és a kártyaképeknek; a kártyaképek a böngésző tárában (IndexedDB) maradnak, a következő látogatáskor azonnal megvannak; a 3D modulok már a gomb felé mozduló egérre vagy tétlen időben letöltődnek; a belső jelenetek árnyalói előre lefordulnak; kevesebb anyagfajta, állandó lámpakészlet, 4 textúra-szál. Mérés (szoftveres GPU, SwiftShader, 1.5.0 → 1.6.0): bútorkártyák első megnyitáskor 20–24 s → 15–18 s, újbóli látogatáskor 21–23 s → 5,5–10 s; fürdőkártyák 7,6–11 s → 4,0–7,4 s; egy beállítás átrajzolása 1,1 s → 0,65 s.
- A belső nézet helyiségválasztója nem lóg ki: egy gomb a helyiség nevével (kattintásra lista), mellette előző/következő nyíl; az Esc csak a listát zárja be.
- Erkélyek: típus (üvegkorlát, fém pálcás, fa, tömör mellvéd, francia erkély), hely (főhomlokzat, hátsó, mindkettő, oldal, sarkon körbefutó), méret (1,2 / 1,5 / 1,8 m); minden emeleten, az erkély mögötti ablakokból ajtó lesz. Közös terv a 2D vázlatnak és a 3D-nek.
- Napelemek a szabad tetőrészeken, kilógás nélkül: egész modulok sorokban, a tetősíkon belül (eresz, gerinc, oromszél, élgerinc ráhagyással), a kémény, a tetőablakok, a tetőkiugrók és a csatlakozó tömegek kikerülésével. Hely: a tájolás szerint, elülső, hátsó, mindkét fő tetősík vagy minden szabad tetőfelület (a melléktömegeken és lapostetőn is); a gerinccel keresztben álló tetőkön is. Önteszt: 384 tetőváltozat, 0 kilógó modul.
- Új kategória: Autók, emberek, állatok. Járművek (szedán, ferdehátú, SUV, pickup, kisbusz, sportautó, elektromos autó töltőoszloppal, motor, kerékpár) színválasztóval, a beállóban és a kocsibeállón parkolva; emberek (pár, család gyerekekkel, vendégek) kint a teraszon, bent a kanapén és a nappaliban; kutya (nagy – kutyaházzal, kicsi), macska kint és bent.
- Kert: növényzet sűrűsége (ritkás, átlagos, dús), fafajták (lombhullató, nyír, japán juhar, gyümölcs, olaj, pálma, fenyő, ciprus, többtörzsű).
- Belső tér: további bútorok (könyvespolc, tálalószekrény, íróasztal, olvasósarok, zongora, bárkocsi, pad, virágállvány, álló tükör, komód, vitrin, puff) – a falak szabad szakaszaira kerülnek; elektronika (nagy tévé, hangprojektor, álló hangfalak, játékkonzol, projektor vászonnal, asztali gép, laptop, okos hangszóró, robotporszívó, okosotthon-panel); függöny anyaga (len, bársony, voile, sötétítő, mintás) és színe, vitrázsfüggöny, pliszé roló; szőnyeg: shaggy, geometrikus, kilim, csíkos, marhabőr, kopott vintage, és szín; lépcső: L alakú, U alakú, falból kinyúló fokok, helytakarékos (a lépcsőválasztó az alap nézetben is látszik); küszöbök (fa, kő, fém); szobanövény: kaktusz, csüngő futónövény, bonszai, és mennyiség („urban jungle”).
- Saját fotó a képkeretben: a látogató feltölthet egy képet (a böngészőben 640 px-re kicsinyítve), ami a 3D előnézet falikép-keretében vagy a képfalon jelenik meg; a generált képre nem kerül rá. A szerver csak kis JPEG/PNG/WebP képet fogad el.
- Minden új választás képes kártyán, a promptba is bekerül (az erkély részletei csak erkéllyel, a járművek színe csak járművel).
- 131 új felirat 15 nyelven.

## 1.5.0 – 2026-10-13

- Professzionális belső terek: új 3D belsőépítészeti könyvtár (külön modul, agh-3d-int.js). Minden bútor, szaniter és tárgy valódi formájú: párnás kanapék ülő- és háttámlapárnákkal, díszpárnákkal, plédekkel; ágyak matraccal, paplannal, párnákkal és éjjeliszekrénnyel; asztalok, székek, szekrények, polcok könyvekkel, vázák, gyertyák, szobanövények. Fizikai anyagok: szőtt kárpit csillogással (len, bouclé, bársony, gyapjú), bőr, furnér, márvány, travertin, mázas kerámia, króm, sárgaréz, inox, üveg, tükör.
- Valósághű fürdőszoba és WC: beépített, szabadon álló, oroszlánlábú és fa áztatókád; walk-in, kabinos, fülkés és nyitott zuhany esőztető fejjel, termosztáttal, kézi zuhannyal, polcos nischével; pultra ültetett, pultba süllyesztett, egybeöntött, fali és talpas mosdó csaptelepekkel; függesztett, fa, fém lábú és álló mosdószekrény; fali, monoblokk, falhoz álló és okos WC nyomólappal; kerek, LED-es, szekrényes, boltíves és lekerekített tükör; törölközőszárító; 10 fali burkolat (köztük metró, hatszög, kézműves, bordázott, sakktábla).
- Új beállítások 3 új kategóriában – Belsőépítészet: belső ajtók (7 fajta), kandalló (5), lépcső (5), függöny és árnyékoló (6), mennyezet (7, köztük kazettás, fa lamellás, látszóbeton); Bútorok: kanapé (6), fotel (5), dohányzóasztal (6), TV-fal (3), étkezőasztal (6), étkezőszékek (6), ágy (6), gardrób (6), szőnyeg (5), falikép és dekoráció (5), szobanövények (5); Világítás: függőlámpa (7), mennyezeti világítás (4), állólámpa (4). Konyha: felső szekrények, páraelszívó, bárszékek; a frontok, fogantyúk, munkalap, mosogató és hátfal képes választóval. Fürdő: kád, zuhany, mosdó, mosdószekrény, WC és tükör típusa, csaptelep grafit és réz színben. Falburkolat: bordázott panel, tégla, beton hatású, márványlap, díszcsempe.
- A menüben minden tárgy képpel jelenik meg: minden opciókártyán a tárgy 3D képe a látogató saját színeivel és anyagaival (a „A stílus szerint” kártya a stílus választását mutatja). A szaniterek és a falburkolatok több választós képes kártyák.
- A belső nézet a beállításokat követi: helyiségenként a stílushoz illő berendezés, a beállítás kiválasztásakor a megfelelő helyiség jelenik meg (kanapé → nappali, ágy → hálószoba, kád → fürdőszoba, lépcső → előtér). Beltéri fények és tükröződés (szobakörnyezet), éjjel világító lámpák.
- A promptba helyiségenként bekerülnek a választott bútorok, szaniterek, lámpák és belsőépítészeti elemek.
- 166 új felirat 15 nyelven.

## 1.4.0 – 2026-10-13

- Belső nézet a 3D előnézetben: „Kívül / Belül” kapcsoló, alatta a ház helyiségei (a Helyiségek listából). Egy helyiség metszetes 3D-ben látszik a beállításokkal: padló (helyiségenként: nappali, háló, konyha, előtér, vizes), falszín és falburkolat, belső stílus, bútorstílus és -szín, konyha (elrendezés, frontok, munkalap, sziget), fürdő (burkolat, berendezés), világítás, függöny, mennyezet. 25 helyiségtípus.
- A belső beállítások (belső tér, konyha, fürdő, felületek, helyiségek) kiválasztásakor és módosításakor az előnézet magától belső nézetre vált, a megfelelő helyiséggel (konyha → konyha, fürdő → fürdőszoba, hálók padlója → hálószoba, előtér padlója → előtér); a külső kategóriák (stílus, tető, homlokzat, nyílászárók, kert, energia) visszaváltanak külső nézetre.
- A Helyiségek listában szem gomb: az adott helyiség belülről; a helyiség saját szélessége, hossza, belmagassága, stílusa, falszíne és bútorszíne a belső nézetben is érvényes.
- Új beállítás: „Ablak körüli keret (szegély)” – a stílus szerint, nincs, fehér, a homlokzatnál világosabb, sötét, kőkeret. A „Nincs keret” eltünteti az ablak körüli világos keretet (2D és 3D).
- Részletes módban egy beállítás módosítása után a beállításlista nem ugrik vissza a tetejére (a görgetési helyzet és a fókusz megmarad).
- 13 új felirat 15 nyelven.

## 1.3.3 – 2026-10-13

- Közös kertterv a 2D vázlatnak és a 3D előnézetnek: fák, cserjék, sövény, virágágyás, kerti tároló, játszótér, tűzrakó, pergola, kerti bútor és lámpák csak a telken belül, a burkolatoktól (terasz, járda, beálló, garázs, medence, tornác, veranda, lépcső) és a háztól távol kerülnek elhelyezésre, egymásra sem kerülnek. Önteszt: 600 véletlen kert, ~4300 növény, 0 hibás elhelyezés.
- A pázsit a telket fedi, körülötte rét; ha van kerítés, a telek oldalain és hátul is körbefut (eddig csak elöl volt).
- Ha a terasz ajtaja nem fér a homlokzat szabad részére (pl. középrizalitnál), a terasz a legszélesebb szabad falszakasz elé kerül, nem a rizalit elé.

## 1.3.2 – 2026-10-13

- A varázsló „Teljes tervező” gombja Részletes módban nyitja a tervezőt (minden beállítással), nem Egyszerűben.
- Ha az oldal licenccsomagja csak az alapbeállításokat engedi (Starter: nincs aktív Professional licenc vagy lejárt a türelmi idő, és nincs AGH_OWNER_MODE), a tervező kiírja, hány beállítás rejtett és miért; az admin minden oldalán hibaüzenet jelzi, hogyan kapcsolható be (saját oldalon AGH_OWNER_MODE, ügyféloldalon licenc). Eddig a beállítások szó nélkül tűntek el (mérve: 123 helyett 31 látszott).
- 3 új felirat 15 nyelven.

## 1.3.1 – 2026-10-13

### Gyorsítás (3D előnézet és tervező)
- Rajzolási hívások egy házra kb. 1300–2500 helyett 70–100: az azonos anyagú statikus elemek egy hálóvá olvadnak össze.
- Az anyagtextúrák háttérszálon (Web Worker) készülnek, a felület nem akad meg; az egyszínű anyagok (vakolat, fa, tető, burkolat stb.) egyszer, semleges színben készülnek, a szín az anyagból jön – színváltáskor nincs újragenerálás. Stílusváltás hidegen kb. 9× gyorsabb (mérés: 15 stílus összesen 8,5 s → 1,0 s a tesztgépen).
- Árnyék csak akkor számolódik újra, ha a jelenet változik (forgatáskor nem); forgatás közben egyszerűsített felbontás, elengedéskor teljes minőség; a felbontás felső határa 1,5×.
- Ugyanarra a beállításra nincs második házépítés (varázslóban kattintásonként 2 helyett 1); a 2D vázlat nem rajzolódik feleslegesen a 3D mellett.
- Opciókártyák és presetek 3D képe csak a képernyőn látható kártyákra készül, az elavult kérések kimaradnak.
- Távoli fasor kevesebb háromszöggel.

## 1.3.0 – 2026-10-13

### Stílusonként saját épületforma
- Új „Épülettömeg (forma)” paraméter 15 formával (2D és 3D): hosszú pavilon kerettel, konzolos emelet, udvaros U-ház toronnyal, két összekapcsolt nyeregtetős tömeg, egymásba tolt kockák tetőterasszal, mélyereszes pavilonok verandával, szimmetrikus tömb középrizalittal, hosszú parasztház tornáccal, két csűrház üveg nyaktaggal, keresztszárnyas tornácos ház, utcára néző chalet erkélyekkel, ipari blokk fűrészfogas csarnokkal, lekerekített organikus tömegek, üvegdoboz látszó acélvázzal, kompakt tömb.
- Minden stílus saját formát, szintszámot, tetőt és anyagokat javasol (a korábbi közös családi alapok megszűntek). DB v8: csak az érintetlen stílusjavaslatok frissülnek.
- A forma a varázsló „Alapok” lépésében kártyákon választható, a promptba is bekerül.
### Javítások
- A telekhatár-vonal teljesen eltűnt a gyepről (3D és 2D); a kerítés a telek első vonalán áll, a telek legalább olyan széles, mint az épületek.
- A medence mindig a telken és a kerítésen belül, a háztól, garázstól, terasztól, járdától és fáktól távol kerül elhelyezésre (oldalt, ha nincs hely, a ház mögött).
- Presetek: lista helyett előnézeti kártyák (a preset házának 3D képe, stílusnál a stílusfotó is).
- 18 új felirat mind a 15 nyelven.

## 1.2.0 – 2026-10-13

- A medence a telken és a kerítésen belül marad (a ház mellett vagy a hátsó kertben).
- Spaletta / redőny színe külön állítható (3D és 2D).
- Tetőablakok, napelem és manzárdablak egy síkban, a tetőn, egymást nem fedve helyezkednek el.
- Új: kémény típusa (tégla, vakolt, kő, rozsdamentes, fémburkolt, széles), napelem típusa és mezőmérete (all-black, kék, tetőbe integrált, napelemes cserép, üveg-üveg), tetőszellőző típusa (6), kúpcserép / gerinc típusa (6), klíma / hőszivattyú külső egysége (4 elhelyezés).
- Több ajtó- (kétszárnyú, teljes üveg, felül üvegezett, lamellás, oldalvilágítós) és ablaktípus (íves, négyzetes, szalag, osztott).
- 49 új felirat mind a 15 nyelven.

## 1.1.2 – 2026-10-13

- A fehér telekhatár-keret eltűnt: a telek széle vékony, a pázsitnál sötétebb vonal (3D és 2D).
- A terasz a teraszajtó alá igazodik, és nem lóg túl a fő épülettömbön oldalra (3D és 2D).
- Varázsló: az élő előnézeti panel bal szélénél húzással szélesíthető (dupla kattintás: alaphelyzet; a beállítás megmarad).

## 1.1.1 – 2026-10-13

- Két stíluscsalád közös alapra került, csak kis részletekben különböznek: (1) Organikus modern + Egyedi stílus (az egyedi most az organikus alapról indul, zöldtető nélkül); (2) Modern minimalista + Kortárs luxus (azonos fehér, lapostetős, panorámaablakos alap; a luxus kő/fa kiegészítőt, kőteraszt, falazott kerítést és kültéri világítást kap).
- DB v7: a módosított stílusok javaslatai csak akkor frissülnek, ha az admin nem szerkesztette őket.

## 1.1.0 – 2026-10-12

### Stílus és varázsló
- A stílus a varázsló első lépése, és vezeti a modellt: tető, homlokzat, szín, ablak, lábazat, bejárat, terasz, kert és kerítés a stílushoz igazodik (amit a látogató maga állított be, azt nem írja felül; stílusváltáskor az előző stílus javaslatai visszaállnak). Új kezdés már az alapstílus szerint néz ki (modern minimalista = lapostető).
- Gazdagabb beépített stílusjavaslatok; a DB v6 frissítés csak az érintetlen 1.0.0-s bejegyzéseket cseréli.
- Kész lépés: nagy élő 3D előnézet az összefoglaló mellett (a kék üres doboz helyett).

### 3D előnézet
- Nincs nyúlás/összenyomódás opcióválasztáskor: a vászon minden képkocka előtt a dobozához igazodik, átméretezéskor a nézet és a nagyítás megmarad, a varázsló oldalsávja nem épül újra kattintásonként.
- Betöltéskor semleges töltőkép a 2D vázlat felvillanása helyett (előnézet és kártyák); a 3D modul a tervezővel együtt töltődik.
- Járda és beálló a kerítésvonalig ér; a kerítésen nyílás van a járdának (kiskapu) és a beállónak (oszlopok, nyitott tolókapu). 2D-ben is.

### Homlokzat és burkolatok
- 6 új homlokzatanyag: vízszintes fa, lécezett deszka, égetett fa, mészkő, festett tégla, szálcement; új procedurális textúrák; a kártyákon valódi házsarok (lábazat, eresz, ablak).
- Burkolatok helyiségenként: hálószobák, konyha, előtér/közlekedő és vizes helyiségek külön (alapból „mint a fő padló”); a fő padló 13 anyag (francia halszálka, márvány, travertin, terrazzo, fahatású járólap stb.); a prompt helyiségenként a megfelelőt írja. Kártyákon napfényes szobasarok.
- A lábazat színe sík lábazatnál rejtve.

### Generálás
- Generálás közben a Leállítás a koncepciókártyák fölött is látszik; indításkor a gomb jelzi, hogy a kérés úton van.
- Sikertelen képnél a tulajdonos a kártyán látja a hiba okát.

## 1.0.1 – 2026-10-12

### Javítva – beragadó generálás
- A feladatsor munkafolyamata feladatonként megemeli a PHP időkorlátot és nem áll le, ha a böngésző bezárul: a 30–60 s-os tárhelykorlát már nem öli meg a hosszú szolgáltatóhívást (eddig ilyenkor a zár percekig foglalt maradt, a projekt „pörgött”, majd hibára futott).
- A státuszlekérdezés PHP-FPM/LiteSpeed alatt azonnal válaszol; a sor a válasz elküldése után fut.
- Őrző: a feladat nélkül maradt „futó” projekt 2 perc után lezárul (hiba, a keret visszajár, ha nem volt költség), és nem blokkolja az új generálást.
- Felület: minden kérésnek időkorlátja van (45 s, generálás 60 s); a „Leállítás” akkor is felszabadítja a felületet, ha a szerver nem válaszol; foglalt állapotban a kattintás üzenetet ad, nem marad néma.
- Új teszt: `tests/stuck-project-test.php`, `tests/e2e/cancel.js`.

## 1.0.0 – 2026-10-11

Első kiadás.

### Funkciók
- Glassmorphism stílusú háztervező popup (`[autogrowehome]`, `[autogrowehome_button]`, `#agh-open`), egyszerű és részletes mód, élő vázlat és összegzés, presetek, Projektjeim, sötét mód, mobil „⋯” menü.
- Átfogó paraméterrendszer (128 beépített paraméter) + admin által bővíthető egyedi paraméterek; kötelező BRAMAC tetőfedés magastetőnél, katalógussal.
- Kérésenként 3 eltérő koncepció; koncepciónkénti galéria (külső/belső nézetek külön fájlban); újragenerálás külön napi kerettel.
- Determinisztikus, méretezett tervvázlatok (SVG), DXF és CAD-JSON export, `agh_cad_exporters` bővítési pont.
- Moduláris, adminban szerkeszthető promptmotor verziókezeléssel.
- Aszinkron feladatsor (WP-Cron, loopback, fojtott státusz-poll, WP-CLI `wp agh queue`), valós haladásjelzés.
- Magnific (Mystic, Flux 2 Pro referenciaképpel, felskálázás) és Anthropic (Messages API, kényszerített tool use) adapter; helyi teszt szolgáltató jelölt képekkel.
- Mentés és ajánlatkérés külön műveletként; külön, alapból üres hozzájárulások, verziózott dokumentumok, hozzájárulási napló.
- Védett kivitelezői ZIP-csomag, e-mail-értesítés, időkorlátos, címzetthez kötött, visszavonható hozzáférés (token az URL-töredékben, HttpOnly sütire cserélve).
- IP-alapú, atomikus napi keret (1 kérés = 3 koncepció = 1 egység), megbízható proxyk, hash-elt IP, IPv6 /64.
- Admin vezérlőközpont: arculat, paraméterszerkesztő, katalógus, üzleti beállítások, statisztika CSV-vel, napló, feladatsor, rendszerállapot, súgó, GYIK, gyorsbemutató.
- GDPR: exporter/eraser lapozással, adatmegőrzés, anonimizálás.
- 16 nyelv (magyar forrás + 15 fordítás, nyelvenként 1565 szöveg).
- Kereskedelmi licencmodul (Starter/Professional/Agency), Ed25519-aláírt licencválaszok, türelmi idő, aláírt frissítés SHA-256 ellenőrzéssel; referencia-licencszerver (`tools/license-server`).
- Bővítési pontok: `agh_image_providers`, `agh_cad_exporters`, `agh_payment_gateways`, `agh_prompt_variables`, `agh_magnific_status_path`, `agh_owner_mode`, `agh_concepts_finished`, `agh_quote_submitted`.

### Javítás (2026-10-11, kiadás előtt)
- Windows: az aktiválás végzetes hibával állt le („Class AutoGroweHome\Support\Logger not found”), mert az autoloader a `DIRECTORY_SEPARATOR`-ral építette az útvonalat, amit a saját ellenőrzése Windowson elutasított. Az útvonal mostantól mindig `/`-rel épül. Regressziós teszt: `php tests/autoloader-test.php`.
- Teljesítmény: a tervező erősen akadozott. Az ok az egymásba ágyazott `backdrop-filter` volt (teljes képernyős elmosás az oldal fölött + elmosás mindhárom panelen), amit a böngésző a panelek minden újrarajzolásánál újraszámolt. A paneleken az elmosás láthatatlan volt (mögöttük a tervező saját, statikus háttere van), ezért megszűnt; az oldal fölötti elmosás helyét sötétebb fátyol vette át. Az admin „elmosás" beállítása mostantól a tervező háttérképére hat.
- Mobilnézet: az Összegzés fül nem csúszik rá az alsó gombokra; fekvő telefonon is mobil elrendezés; kompakt alsó sáv; 44 px-es érintési célok; 16 px-es beviteli mezők (iOS nem nagyít rá).

### Új (2026-10-12, kiadás előtt)
- **Gyors varázsló** hét lépésben (Alapok, Méret, Stílus, Tető, Homlokzat, Kert, Kész) asztalon és mobilon. Ugyanazt a konfigurációt, ellenőrzést és generálást használja, mint a teljes tervező; bármikor át lehet váltani. Stílusválasztáskor a stílushoz illő anyagok és színek beállnak (felhasználói értéket nem ír felül).
- Új beállítás: Arculat és elrendezés → Popup elrendezés → **Kezdőnézet** (`layout.start_view`: `wizard` | `designer`, alap: `wizard`).
- 27 új szöveg mind a 15 fordításban (nyelvenként 1592); `bin/po-tools.py`: függőség nélküli .po → .mo fordító és ellenőrző.
- Javítás: az élő vázlat égbolt-átmenete egyedi azonosítót kap (két vázlat egyszerre a DOM-ban).
- **Fotórealisztikus stílusminták** mind a 16 építészeti stílushoz (Magnific / Seedream 5 Pro, WebP 1280 + 480 px, összesen ~2,8 MB): képes stíluskártyák a tervezőben és a varázslóban, az előnézet a stílus fotója az élő vázlattal; „Stílusminta” jelöléssel.

### Új (2026-10-12, kiadás előtt) – élő vázlat és ikonok
- **Új élő 3D vázlat** (`assets/js/agh-sketch.js`, önálló modul): axonometrikus, anyagmintás (tégla, klinker, kő, fa, fém, beton, panel, vakolatstruktúra, cserépprofilok BRAMAC-családonként, korcolt lemez, zöldtető), valódi tetőgeometria (nyereg, konty, csonkakonty, félnyereg, sátor, lapos, összetett) hajlásszöggel, eresszel, oromzattal; szintek, alaprajzi forma, garázs/beálló, terasz, pergola, erkély, tornác, lépcső/rámpa, kémény, napelem, tetőablak, tetőfelépítmény, kerítés kapuval, telekhatár, kert stílusonként, gépészet (hőszivattyú, klíma, töltő, akkumulátor, esővíztartály), napszak, évszak, időjárás, kamera, árnyékok. A stílusminta-fotó kis betétkép lett, a vázlat tölti ki az előnézetet.
- Minden változtatásnál felirat jelzi, mi változott; ha a paraméter a vázlaton nem látszik (konyha, fürdő, burkolatok…), ezt kiírja – a rajz összehasonlításából, nem becslésből.
- **Opciókártyák saját képpel**: a tetőforma, szintszám, alaprajz, ablak, garázs kártyáin a látogató saját háza az adott opcióval; homlokzat- és padlóanyag-minták, belsőstílus-paletták, kert- és napszak-tájképek, konyha-alaprajzok; egyedi (admin) opcióknál színes monogram.
- **Új kategóriaikonok**: 15 egyedi, kéttónusú ikon, kategóriánként saját színnel.
- Tesztek: `node tests/sketch-test.js` (1017 rajz, 180 paraméterváltozat, 0 hiba), `node tests/e2e/sketch.js` (a valódi felületen 116 mező: ahol látszania kell, mind változtatja a vázlatot).

### Új (2026-10-12, kiadás előtt) – valódi 3D előnézet
- Az élő vázlat helyén **valós idejű 3D előnézet** (WebGL, three.js r170, MIT): falak valódi nyílásokkal és káva-mélységgel, keretes ablakok tükröződő üveggel, vastag tetősíkok gerinccel, ereszcsatornával és lefolyóval, a böngészőben generált PBR-anyagok (szín-, normál- és érdességtérkép: tégla, klinker, kő, fa, korcolt lemez, beton, panel, vakolat, cserépprofilok, pala, zsindely, zöldtető, kavics, fű, térkő, burkolólap, deszka, aszfalt, hó), festett égbolt napszak és időjárás szerint, nap- és holdfény lágy árnyékkal, környezeti takarás (asztalon), lombos fák, erdősáv a háttérben, éjszaka világító ablakok és lámpák. Egérrel vagy ujjal körbe forgatható; a „Nézet visszaállítása” gomb visszaállítja.
- A 3D modul a tervező megnyitása után töltődik be; addig, illetve WebGL2 nélkül a 2D vázlat látszik.
- Az opciókártyák (tető, szint, ingatlantípus, alaprajz, ablak, garázs, homlokzatanyag, padló, kert, napszak) 3D-ben renderelt képet kapnak a látogató saját házáról.
- Teszt: `AGH_3D=1 node tests/e2e/sketch.js` – a valódi felületen minden mező után a 3D jelenet ujjlenyomatát is ellenőrzi (58/58 látható paraméter változtatja a 3D jelenetet).

### Ellenőrzés
- Integrációs tesztsor 147/147, regressziós tesztek 120 + 116 + 71, licencszerver-önteszt 32/32, lint 0 hiba (részletek: `docs/TESZTJELENTES.md`).
