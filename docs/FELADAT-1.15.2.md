# FELADAT – 1.15.2: a kép színei és anyagai a 3D-t kövessék (mediterrán ház, 3 rossz kép)

Norbi szövege (2026-10-21 22:28), 4 képpel (1–3: a generált három koncepció, 4: a 3D élő vázlat,
„Mediterrán” stílus): „hogy nem jó!!! első 3 kép 3 verzió a generáltból mi a hiba??? 4 kép a 3d”

**Minden maradjon meg**: a forma hűsége (ez jó: tömeg, két oromzatos szárny, ablakok, terasz,
kerítés, kapu, fa a helyén), a hűség-kapcsoló, a képleíró prompt, a stílusminta, a tiltólista, a
BRAMAC-terméknév, a képek száma és nézetei.

## 1. A képek összevetése

| # | 3D (4. kép) | Generált (1–3.) | Minősítés |
|---|---|---|---|
| 1 | **narancs-terrakotta cseréptető** | mindhárom **fekete/antracit** | szín elveszett |
| 2 | **meleg bézs-sárga, szabálytalan terméskő** a két szárnyon | sötétszürke palakő (1–2.), fehér vakolat (3.) | anyag/szín elveszett |
| 3 | **sötét, függőleges lamellás** (antracit fém) kerítés | világos natúr fa | szín elveszett |
| 4 | levendula a kapunál | nincs | hiányzik |
| 5 | – | napelem (2.), üveg előtető (1.), narancs „fal” a háttérben (2–3.) | hozzáadott / elcsúszott szín |
| 6 | tömeg, oromzatok, ablakok, terasz, kapu, fa | egyezik | **jó** |

## 2. Gyökérokok (a kódban mérve, ugyanilyen beállítással a tesztoldalon)

1. **A tető színe rossz szóval megy ki.** `Color::describe('#C8582E')` → **„honey oak”** (mézszínű
   tölgy). A színnév-tábla a narancs árnyalatokra faanyag-neveket ad („honey oak”, „natural oak”),
   tetőre, falra, keretre is. A prompt tehát: „roof tiles, in honey oak”.
2. **A kő színe nem megy ki, helyette a vakolat színe.** A 3D a terméskövet mindig `#BDAE97`
   (meleg bézs) színnel rajzolja (`agh-sketch.js` `facadeBase`), a `facade_color` csak a vakolatot
   színezi. A prompt mégis: „main facade in natural stone, facade colour warm white” → a modell
   szürke vagy fehérített követ fest.
3. **A kerítés iránya és színe ellentmond.** A 3D függőleges, sötét antracit lamellát rajzol
   (`agh-3d.js` 1199. sor), a prompt „horizontal slatted fence”, szín nélkül.
4. **A koncepciószövegek másik házat írnak le.** A három változat szövege (`Planner`): „articulated
   massing with a projecting wing”, „contrasting dark metal accents”, „warm oak timber cladding and
   natural stone accents”, „elongated volume”, plusz „Make this variant clearly distinct in massing
   and materials”. Hű/Klón fokozaton, 3D vezetőképpel ez a referencia ellen dolgozik (innen a sötét
   anyagok és az eltérő homlokzat a 3. képen).
5. **A stílusminta anyagot is átvihet.** A mintakép a fényt és a fotóhatást adja, de a Mystic a
   színeit/anyagait is átveheti; a prompt ezt nem tiltja.

## 3. Mi legyen (mérhetően kész)

1. **Színnevek kontextussal**: faanyag-mezőknél (díszítőelem, zsalugáter, bútor, padló, front,
   munkalap, bejárati ajtó) maradnak a fanevek; tetőnél, homlokzatnál, lábazatnál, ablakkeretnél,
   falnál, fürdőnél, fugánál, autónál nem. Kész: `#C8582E` tetőre → „terracotta orange”, nincs „oak”.
2. **Rögzített színű homlokzati anyagok** (kő, tégla, klinker, mészkő, fehér tégla, beton, fém,
   sötét vakolat, égetett fa) a 3D színét kapják a promptban; a `facade_color` ilyenkor csak a
   vakolt részekre vonatkozik („rendered parts in …”). Kész: terméskőnél a prompt „warm beige-yellow
   natural stone” és nincs benne „facade colour warm white”.
3. **Kerítés**: „vertical slatted fence in dark anthracite metal” (skandinávnál „weathered grey
   timber”), ahogy a 3D rajzolja. Kész: nincs „horizontal slatted”.
4. **Kötött hűségnél (Hű, Klón, egyedi) 3D vezetőképpel a koncepció- és változatszöveg kimarad**
   (koncepcióleírás, jellegzetességek, anyagpaletta, koncepció-tömeg, „clearly distinct” mondat);
   Szabad/Kiegyensúlyozott fokozaton és vezetőkép nélkül marad a mai. Kész: Hű + vezetőkép mellett a
   heróban nincs „articulated massing”, „dark metal accents”, „clearly distinct”.
5. **Pontos színek a képleíró promptnak is**: az `{EXTRA_WISHES}` kapja a modell tényleges színeit
   (tető, homlokzat anyaga és színe, ablakkeret, kerítés), hogy a Claude ne a fénytől elszínezett
   képről becsülje őket. Kész: a feladatszövegben ott a „terracotta orange”.
6. **A nyitóblokk kimondja**: anyag és szín csak a szövegből és a referenciából jöhet, a stílusmintából
   csak a fény és a fotóhatás. Kész: a mondat a nyitóblokkban, a prompt 3900 alatt.
7. **Teszt**: új `tests/match-test.php` (a tesztoldalon) Norbi házához hasonló beállítással; a
   `guide-test` 62/62 és a `vision-test` 55/55 változatlanul.

## 4. Őszintén

- A stílusminta hatását a Mystic dönti el; a prompt csak kérheti, hogy ne vegye át az anyagot. Ha a
  tető ezután is sötét, a mediterrán stílusmintát kell ellenőrizni (AI-szolgáltatók → Magnific →
  Fotószerűség), vagy a stílusminta erősségét csökkenteni (45 → 35).
- A 3D a tetőn egy korlátot is rajzol a két szárny között (földszintes ház erkélye); ez külön feladat.
