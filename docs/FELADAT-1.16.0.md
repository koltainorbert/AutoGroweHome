# FELADAT – 1.16.0 (és ütemterv 1.17–1.22): Norbi 10 pontos listája, 7 képpel

Norbi szövege (2026-10-22 10:50), szó szerint pontonként feldolgozva. Képek: (1) építési mód 5. lépés,
Kezdés 10 × 8 m; (2) 6. lépés, helyiség-legördülő; (3) 6. lépés, három helyiség; (4) Kerti elemek
pillék; (5) 3D, pergola a tetőben; (6) A/B/C koncepciókép fekete tetővel; (7) a 3D, piros tetővel.

**Minden maradjon meg**: a mostani építési mód (0–9. lépés, rajz, 3D építési állás), a tervező, a
képleíró prompt, a forma-vezetés (mint választható régi út), a 3D, a 2D vázlat, a fordítások.

## A. Ebben a verzióban (1.16.0) – kész, mérve

### 1. „Mindig ekkora marad, nem tudom nagyobbat” (1. kép)
- Hol: `assets/js/agh-build-ui.js` `templatesBox()`: a Szélesség/Mélység mező `value: '10'` / `'8'`
  volt, és a panel minden változásnál újraépül → a beírt szám visszaugrott 10 × 8-ra.
- Javítás: a beírt méret állapotban marad (`st.tpl`), 4–40 × 4–30 m.
- Kész: új `tests/e2e/buildsize.js`: 14 × 11,5 beírva, újrarajzolás után is az, a téglalap
  14,00 × 11,50 m (előtte mérve: 10 × 8 / 10,00 × 8,00).

### 9. Egyszintes háznál a pergola a tetőbe lóg (5. kép)
- Hol: `assets/js/agh-3d.js` terasz-pergola: fix `plinth + 2,6 m` magasság, a gerendák a falig érnek,
  az eresz alja egyszintes háznál ennél lejjebb van.
- Javítás: a pergola az eresz alja alatt marad (40 cm); ha így 2,25 m-nél kevesebb a belmagasság,
  az eresz előtt kezdődik.
- Kész: 600 ház (szint, tetőforma, hajlás, túlnyúlás változatai): a tetőbe lógó pergola 179 → 0,
  legkisebb belmagasság a teraszon 2,10 m.

### 10. „A generált 3D képet add át fizikailag a Magnificnek” (6–7. kép)
- Gyökérok: a 3D kép eddig is ment, de csak **structure** referenciaként: a Mystic abból csak a formát
  veszi át, a színt nem; a színt a szöveg és a **stílusminta** adta (a „Modern minimalista” minta fehér,
  sötét tetős ház → fekete tető, napelem).
- Javítás: új mód, **„Fotó a 3D képből” (alapértelmezett)**: a látogató 3D képe maga a bemenő kép
  (Flux 2 Pro szerkesztés), utasítás: „ugyanezt a házat alakítsd valódi fotóvá, semmit ne tegyél hozzá
  és ne vegyél el”. A kép a teljes jelenet (autó, ember, állat is). A nézetek a saját 3D képüket és a
  kiválasztott fő képet kapják. Mérete a 3D kép alakja (1440 × 880). Csak Hű/Klón/egyedi hűségnél és
  a látogató 3D képével; különben a régi út. Admin: Magnific → „Képkészítés módja”.
- Próba a Magnific-appban Norbi 7. képén (100 kredit): piros cseréptető, bézs vakolat, pergola a
  kültéri konyhával, medence, lapos tetős dupla garázs két szürke kapuval, sötét lamellás kerítés,
  esővízgyűjtő, autó – mind a helyén. Összevetésül a Magnific kreatív felskálázó (90 kredit) a garázs
  tetejét és az autót megváltoztatta → nem ezt használjuk.
- Kész: új `tests/photo-test.php` 22/22; `guide-test` 62/62, `vision-test` 55/55, `match-test`
  26/26 (a régi úton); `e2e/guide.js` hero + teljes jelenet, konzolhiba 0.
- Őszintén: a kép 1440 px széles (a Flux útvonal határa a Magnific API-n); nagyobbhoz a meglévő
  „Felskálázás a kiválasztott galériánál” kapcsoló. Éles kulccsal a pluginból nem mérve.

## B. Ütemterv – egyenként, mérhetően (mind nagy funkció)

### 1.17.0 – Helyiségprogram (2. pont, első fele; 2–3. kép)
- „Helyiségek” felugró ablak: pillékből választott helyiség (a mai lista: Nappali, Étkező, Konyha,
  Nappali + konyha + étkező, Fő hálószoba, Hálószoba, …, Előtér) vagy egyedi név, helyiségenként m²
  (és opcionálisan szélesség × mélység). A program alapján a rajz téglalapokat ad, a felhasználó húzza
  őket az alapba; a falak a téglalapok határán jönnek létre. A mai automatikus kiosztás csak gombra.
- Kész: a beírt m² ±0,5 m²-en belül; átfedés 0; a falon kívül 0.

### 1.18.0 – Törlés és áthelyezés a rajzon és a 3D-n (2. pont többi része, 4. pont)
- Fal, ablak, ajtó törlése (Del / kuka) az alaprajzon és a 3D építési állásban; ablak/ajtó húzása a
  falon (rajzon és 3D-n), fal végpontjának húzása. Ugyanez a teljes tervező 3D-jén az ablakokra, ajtókra.
- Kész: E2E: 50 véletlen házon törlés + mozgatás, geometriai hiba 0, visszavonás működik.

### 1.19.0 – Globális mozgatás/forgatás minden tárgyra (5. pont, 4. kép)
- Bármely tárgy (ablak, ajtó, fa, bokor, ember, állat, autó, kerti bútor, pergola, medence, tároló,
  grill, tűzrakó …) megfogható: húzás egérrel/ujjal, nyilak (Shift: nagyobb lépés), forgatás (Ctrl+húzás
  vagy R), Shift = visszaáll egyenesbe (0/90/180/270°-ra pattan). Alaprajzon és 3D-n, az építési módban
  és a teljes tervezőben. Mentés a projektbe (mint ma a bútorok `room_layout`-ja).
- Építészeti/statikai jelölés: hova szabad (zöld) és hova nem (piros): nyílás nem kerülhet sarokhoz
  60 cm-en belül, áthidaló felfekvés, teherhordó fal közepén max. nyílásszélesség, telekhatár/építési
  vonal, medence/fa távolsága a háztól. A szabályok a meglévő `assets/data/rules/hu.json`-ba (ellenőrizetlen,
  „nem statikai terv” figyelmeztetéssel).
- Kész: E2E: minden tárgytípus mozgatható/forgatható mindkét nézetben; a tiltott helyre tett tárgy jelölve.

### 1.20.0 – Kiegészítő anyagok helye (3. pont)
- A homlokzati díszítőanyag (fa, kő, tégla, fém…) helye kijelölhető: falfelületre kattintva (melyik
  homlokzat, melyik szárny, lábazat, sarok, sáv). 2D, 3D és a prompt is követi.

### 1.21.0 – Medence és garázs részletesen (6–7. pont)
- Medence: típus (téglalap, L, kör/ovális, infinity, merülő, jakuzzi), méret (h × sz × mélység),
  burkolat, lefedés, terasz körülötte.
- Garázs: m² / méret, beállók, belső osztás (műhely, tároló, kazán), tető (lapos, nyereg, félnyereg, zöld)
  és anyaga, homlokzat anyaga, kapu típusa és színe, ablak, gyalogajtó.

### 1.22.0 – Melléképületek (8. pont)
- Kerti tároló, faház, műhely, nyári konyha: méret, ajtó, ablak, belső kivitel, anyag, tető; mozgatható
  (1.19.0 szerint), 2D/3D/prompt.

Minden tétel saját FELADAT-fájlt kap, amikor sorra kerül, és a mérés a „Kész” sor szerint.
