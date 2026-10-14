# ÁTADÁS – AutoGroweHome (2026-10-14, az 1.9.1 kiadása után)

Új chat elején: 1) CLAUDE.md a repóban, 2) claude/ALLAPOT.md, 3) ez a dokumentum, 4) `docs/FELADAT-1.8.0.md` (19 pontos lista) és `docs/FELADAT-1.9.0.md` (7 pontos lista). Utána azonnal lehet dolgozni.

## Hol tartunk
- **Ügyfélplugin 1.9.1** kiadva, `main` ág. `dist/autogrowehome-1.9.1.zip` (6 044 874 bájt, sha256 a7a638e4…96e4bf21).
- **Norbi 19 pontos listája (2026-10-13) mind a 19 ponton elkészült** (1–12., 14–19. az 1.8.0-ban, a 13. az 1.8.1-ben). A munkaprompt: `docs/FELADAT-1.8.0.md`.
- **Norbi 7 pontos listája (2026-10-14) mind a 7 ponton elkészült**: 1., 4., 5., 6. az 1.9.0-ban (kártyaképek saját jelenettel, modern színválasztó, egy lefolyó sarkonként), 2., 3., 7. az 1.9.1-ben (helyiségrészletek a 3D-ben, valódi városi utcasor, tárgyak megfogása egérrel). A munkaprompt: `docs/FELADAT-1.9.0.md`.
- **Licencközpont 1.0.0** (`license-hub/`) változatlan.
- Tesztoldal: `bin/test-wp.sh` (eldobható WordPress + SQLite, 8899-es port). Új chatben új konténer jön, ezért újra kell indítani. **Új mező vagy új stílus után újra kell indítani**, mert a stíluskártyák alapértékei aktiváláskor kerülnek a katalógusba.

## Mi került az 1.8.0-ba, pontonként
1. **Kereső**: a fejléc (cím + keresőmező) egyszer épül fel, gépelés közben nem épül újra → nincs fókuszvesztés. (`agh-designer.js` renderParams/renderFields)
2. **Tetőszellőző**: a gerinc helyett a tetősíkra kerül, a lejtő harmadába, kontyolt tetőnél a szűkülő síkon belülre; a lapos elemek a tető síkjába fordulnak (`roofFrame`), a turbina és a kémény függőleges marad.
3. **Hófogó**: két rúd konzolokon, az eresztől ~3 cserépsornyira, az ereszcsatorna színében (`House.snowGuard`).
4. **Dryvit dekorsáv**: világos vakolaton nem fehér, hanem egy árnyalattal mélyebb tónus; új opciók: „Homlokzattal azonos”, „A homlokzatnál sötétebb” (`trimColor`).
5. **Belső nézet**: `Viewer.fitFrame` a szoba dobozát keretezi és középre igazítja, 20°-os rálátás, szemmagasságú célpont; a kivágott plafon nem vet árnyékot; beltérben feleakkora nap, erősebb égbolt-fény; a növények a szobához méretezve; a padlóra kerülő bútor a fal mellé húzva. Kitöltés 70% → 89%.
6. **Koppintás a modellre**: minden rész ismeri a mezőjét (`House.add` + fázisonkénti címkézés, belül `tag()`); a nézegető az összevonás előtt elteszi a dobozokat (`collectPicks`), koppintásra a legkisebb tartalmazó doboz nyer (`pickAt`), a tervező `jumpToField`-del odaugrik és felvillantja a mezőt.
7. **Kilenc új táj**: szőlőhegy, alföldi tanya, folyópart, patakvölgy, fenyves hegyvidék, puszta, városi utcasor, sivatag, havas táj (összesen 16).
8. **Hat új stílus**: magyar kockaház, klasszikus parasztház, présház/borospince, amerikai mid-century modern, amerikai modern lapostetős, sivatagi modern.
9. **Pince**: `basement_type` (részleges, teljes, külső lejáratos), pinceablakok angolaknában, süllyesztett terasz lépcsővel (`House.basementFace`), pince szint a helyiségprogramban (-1) és a szintválasztóban.
10. **Padlás**: `attic_use` mező és új `attic` helyiségtípus látszó fedélszékkel, deszkázott födémmel, feljáróval.
11. **Ajtókeret**: 7 cm tok és takaróléc minden belső ajtó körül, `door_frame` mezővel.
12. **Radiátorok**: `radiators` mező; ablak alá, különben szabad falra, szűk helyen keskenyebben; fürdőbe törölközőszárító, amely a mosdó és a WC fölé is felkerülhet.
13. **Gyerekszoba** (1.8.1): `kids_theme` mező – semleges, fiús, lányos, babaszoba, tini, vagy csak az alapbútorok; két gyerekszobánál a második automatikusan másik berendezést kap.
14. **Akvárium**: 6 forma, édesvízi/tengeri, világítás, halak, növények vagy korallok, akváriumbútor.
15. **Komód, könyvespolc** (már megvolt, ellenőrizve) **+ fali rejtett polc** (új).
16. **Lépcső**: többszintes háznál mindig látszik (`stairFit`), keskeny helyen csiga vagy váltott fokú; ha nincs előtér, a nappaliba kerül.
17. **Erkély**: alapból be, tetőtérnél az oromfalon, földszintesnél franciaerkély.
18. **Bentre állat**: a kutya és a macska mellé fekhely, tálak, macskának kaparófa.
19. **Falikép**: `art_amount` mező, a képek a szabad falszakaszokra, alacsony bútor fölé igazítva.

## Mi került az 1.9.0-ba és az 1.9.1-be, pontonként
1. **Kártyaképek**: minden mezőnek saját kártyajelenete van (pince, padlás, ajtókeret, radiátor, gyerekszoba, akvárium); ahol nincs, semleges falfelület jön és a konzol figyelmeztet – kanapé-helyettesítő nincs. (`agh-3d-int.js` itemScene)
2. **Helyiségrészletek a 3D-ben**: a helyiségenkénti burkolat, falszín, mennyezet, világítás, bútorstílus, dekor, függöny, ajtó, ablak, fűtés a belső nézetben is látszik (30 mezőből 22 változtatja a képet).
3. **Városi utcasor**: a 10 sorház a „Környező épületek” beállítástól függetlenül felépül, a szomszédgyorsítótár külön tartja a városi, külvárosi és vidéki utcát, 55 fa marad 300 helyett, a látóhatáron városi tömbök (`townBlocks`).
4. Lásd 1.
5. **Modern színválasztó**: saját panel (telítettség/világosság mező, színárnyalat-csúszka, HEX, használt színek); 0 natív színmező maradt.
6. **Ereszcsatorna**: sarkonként egy lefolyó (`self.pipes`, 1,2 m-es szűrés).
7. **Tárgyak megfogása egérrel**: `Viewer.grabAt/dragTo/turnDrag/dropDrag`; a bútorok külön objektumok maradnak (`hs.items`, slotnév „mező#index”), `fitInRoom` tartja bent a teljes testet, `snapWall` a falra akasztott tárgyakat a legközelebbi falra simítja, a mentés a `room_layout` mezőben (helyiség → slot → {x, y, rot}), Ctrl+Z visszavon, gomb visszaállít.

## Új tesztek a repóban
- `tests/e2e/search.js` – kereső fókusz (2 méret × 6 leütés).
- `tests/e2e/rooms.js` – véletlen szobák: kilógó és ajtóban álló tárgy, lépcső, kép, radiátor.
- `tests/e2e/pick.js` – koppintás a modellre kívül és belül.
- `tests/e2e/roomcam.js` – belső nézet kitöltése és képből kilógó tárgyak.
- `tests/e2e/cards.js` – kártyajelenetek (55 mező, 321 opció, 0 alapjelenet).
- `tests/e2e/color.js` – színválasztó (0 natív színmező).
- `tests/e2e/roomdetails.js` – a helyiségenkénti beállítások hatása a 3D-re (22/30).
- `tests/e2e/layout.js` – kézi elrendezés: fogás, húzás, forgatás, mentés, újratöltés, visszaállítás.
- `tests/e2e/street.js` – 16 helyszín utcája és szomszédai.
- `tests/e2e/perf.js` – betöltési idő kattintástól a kész 3D képig, lassú hálózaton is.

## Ismert korlátok
- Zsúfolt szobában egy bútor a padló közepére kerülhet (a „Megoldva” üzenet jelzi).
- A belső nézet 20°-ról néz be, ezért a függőlegesek kissé összetartanak; valódi kétpontos perspektíva (eltolt frustum) nincs.
- A pince külső lejárata a kert felőli oldalon van, az alapértelmezett kameraállásból nem mindig látszik.
- A 2D vázlat nem rajzolja a pinceablakokat, a hófogót és a faliképeket – ezek 3D- és képgeneráláskor jelennek meg.
- Valódi GPU-n és telefonon nincs mérés.
- Betöltés: a tesztszerver nem tömörít, ezért a mérés 1,9 MB-ot mutat; ugyanezek a fájlok gzipelve ~0,42 MB. Éles kiszolgálón a tömörítés kötelező. Az `agh-3d-int.js` (77 KB gzip) ma a megnyitáskor töltődik, nem a belső nézet első megnyitásakor.
- Kézi elrendezés: szűk szobában a falra akasztott tárgy a legközelebbi falra kerül, ezért ferdén húzva átugorhat a szomszédos falra.

## Nyitott tételek
- htombau: az 1.9.1 telepítése és visszajelzés képernyőképekkel.
- 3D sebesség telefonon; valódi GPU-s mérés.
- Licencközpont telepítése Norbi oldalára, utána szerver URL és nyilvános kulcs az ügyfélpluginba.
- A GitHub repó nyilvános, privátra kell állítani.
- Fordítások lektorálása (1.8.0–1.9.1: 77 új felirat 15 nyelven, nyelvenként 2095 szöveg).
- Magnific/Anthropic kulcs, éles végigteszt; fizetés → automatikus kulcskiadás; BRAMAC-katalógus, jogi szövegek; MySQL, SMTP, éles cron teszt.
- Kézi szöveg külön a külsőhöz és a belsőhöz, a promptba építve.

## Munkaszabályok (röviden, a részletek a CLAUDE.md-ben)
- Norbi szövegéből először `docs/FELADAT-<verzió>.md` prompt készül, csak utána a kód.
- Teszt → commit (magyar üzenet) → `git fetch` + rebase → `git push origin main`, force push soha.
- Kódváltozásnál `bin/bump-version.sh` és a CHANGELOG kitöltése → `bin/build-zip.sh` → a dist külön commitban.
- Új szövegnél a .pot és mind a 15 .po bővül → `python3 bin/po-tools.py check` és `compile` → `git checkout bin/__pycache__`.
- Az ALLAPOT.md legfeljebb 25 sor, a repóban és a projektben ugyanaz.
- Kulcs, jelszó, ügyféladat és Norbi saját fotója nem kerülhet a repóba.
