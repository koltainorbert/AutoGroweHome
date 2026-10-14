# Változásnapló

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
