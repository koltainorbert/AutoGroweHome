# FELADAT – 1.14.4: teljes képernyő az „Építés az alapoktól” rajzán

Norbi szövege (2026-10-21 18:16, kép a rajz eszközsoráról): „Az itteni teljes képernyő nem megy az
alapok tervezésénél.”

**Minden maradjon meg** (1.14.3): a tervező teljes képernyő gombjai (fejléc, előnézet, galéria), az
építési mód minden lépése, a „Teljes rajz” (nézet visszaállítása) funkció.

## 1. Mi a hiba

- **Hol:** `assets/js/agh-build-ui.js` `buildStage()`: az eszközsor utolsó gombja a „Teljes rajz”
  (`fitView()`), és ugyanazt az ikont kapta (`expand`), mint a tervező teljes képernyő gombja.
  A rajz (alaprajz / 3D építési állás) mellett **nincs** valódi teljes képernyő gomb.
- **Gyökérok:** ikonütközés – a felhasználó joggal hiszi teljes képernyőnek; és a funkció hiányzik.

## 2. Kell

1. Valódi teljes képernyő gomb a rajz eszközsorán, a tervező meglévő megoldásával (`fsButton`,
   natív Fullscreen API, ahol nincs: CSS-tartalék; Esc / újra a gomb / telefonon a Vissza kilép).
   A teljes képernyőn az alaprajz, a 3D építési állás és a fázis-csúszka is ott van; a rajz kitölti
   a képernyőt, a nézetváltó (Alaprajz / 3D) és a nagyítás is működik.
2. A „Teljes rajz” gomb saját, eltérő ikont kap (célkereszt), felirata marad.
3. A tervezőbe visszalépéskor a teljes képernyő bezárul.

## 3. Kész, ha (mérve, `tests/e2e/buildfs.js`)

- asztali (1366×768) és telefon (390×844) méreten, natív és CSS-tartalék módban: a gomb után a rajz
  oldala a képernyő ≥ 95 %-át kitölti, a rajzterület magassága ≥ képernyő − 160 px; a 3D nézetre
  váltva a vászon is kitölti; Esc / a gomb újbóli megnyomása után az eredeti méret (±2 px) vissza;
- a „Teljes rajz” és a teljes képernyő ikonja különbözik;
- konzolhiba 0; `build.js`, `theme.js`, `fullscreen.js` zöld.
