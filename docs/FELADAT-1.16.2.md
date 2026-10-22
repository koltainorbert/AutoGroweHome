# FELADAT – 1.16.2: az építési mód 3D-je munka közben mutassa a kitűzést, a földmunkát, az alapot

Norbi szövegei (2026-10-22 11:58–12:03), egy képpel (5. lépés, 100 × 30 m beírva, a 3D-ben egy kis
földfolt a telek közepén):
- „amikor kijelöli a területet, fehérrel rátesz egy föld darabot, azt miért nem tudom változtatni?”
- „főfalaknál és amikor ráteszem a kész téglalapot a földre és alapot, csak akkor ugrik méretre, ha
  átváltok L alak és a téglalap között; ezt kell tudnom kijelölni, mert van, hogy más alak kell”
- „a jelöléseket csak úgy rakja rá, ha elmegyek a pontok végére, mindent felpakolok és visszamegyek –
  csak akkor látom a kitűzést, az alapot, a földmunkát, az alapvezetékeket. Nem látom, amikor csinálom.”

**Minden maradjon meg**: a lépések (0–9), a rajz, a Téglalap / L alakú / A mostani házból indítás, a
Fal eszköz, a 3D építési állás és a csúszka, a lezárt lépések.

## Gyökérokok (`assets/js/agh-build-ui.js`, `assets/js/agh-3d-build.js`)
1. Fal nélkül a 3D egy **rögzített 4 × 4 m-es földfoltot** rajzolt („hogy legyen mit mutatni”) – semmi
   nem változtatta.
2. A ház körvonalát (Kezdés: Szélesség, Mélység, Téglalap, L alakú) **csak az 5. lépésben** lehetett
   megadni; a 0–4. lépés (kitűzés, földmunka, alap, alapvezetékek, aljzat) ebből rajzol, ezért ott
   üres volt, és csak az 5. lépés után visszalépve látszott.
3. A földfolt a körvonal **befoglaló téglalapja** volt: L alakú háznál is téglalap.
4. A 4–40 / 4–30 m-en kívüli szám (pl. 100) csendben 40-re vágódott, a mező mégis 100-at mutatott.

## Kész, ha (mérve, tesztoldalon, böngészőben)
1. A körvonal (Kezdés) a **0. lépésben** (Telek, kitűzés) is ott van, az 1–4. lépésben pedig addig,
   amíg nincs fal. A 0. lépésben lerakott 12 × 9 m-es ház után az 1. lépés 3D-je azonnal 14 × 11 m-es
   földmunkát (+1 m munkatér) és 12 × 9 m-es alapot mutat, visszalépés nélkül.
2. Fal nélkül a földfolt a beírt méret + munkatér (14 × 11,5 → 16 × 13,5 m), gépelés közben frissül.
3. A földfolt a rajzolt körvonalat követi (L alak: 248 m², a befoglaló téglalap 280 m² lett volna; a
   bemélyedés közepe nincs a foltban). Saját alak: a Fal eszközzel bármilyen zárt kontúr rajzolható
   (Shift: ferde fal), a földmunka és az alap azt követi.
4. Tartományon kívüli méretnél a mező a ténylegesen használt értéket mutatja (100 → 40), a mező alatt
   „4–40 m” / „4–30 m”.
