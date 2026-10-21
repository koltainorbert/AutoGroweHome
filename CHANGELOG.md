# Változásnapló

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
