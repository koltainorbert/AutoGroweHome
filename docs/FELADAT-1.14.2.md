# FELADAT – 1.14.2: Építési mód – a rajzterület vékony sáv, és nincs töltésjelző

Norbi szövege (2026-10-21, 4 képernyőkép, sötét téma, saját WordPress-oldal):
„A hiba az, hogy nagyon vékony sávban tudom a ház alapját csinálni, és nem nagyítódik ki; illetve
amikor töltöm be az appot, kellene töltésindikátor, mert alul-fölül is hatalmas hely.”

**Minden maradjon meg** (1.14.1): a mai tervező, a varázsló, a kapcsoló (`build.enabled`), minden
lépés, mérés és teszt. Kikapcsolt építési mód = változatlan működés.

## 1. A rajzterület vékony sáv (≈ 115 px magas)

- **Hol:** `assets/css/agh-designer.css` („build mode” szakasz) és `assets/js/agh-build-ui.js`
  (`build()`, `buildStage()`): a keret `section.agh-build`, a rajz oldala `section.agh-bld-stage`,
  a lépéspanel `aside.agh-bld-panel`.
- **Gyökérok (a képek alapján, reprodukálandó):** a téma CSS-e a `section`/`aside` elemre saját
  belső és külső margót ad (a képeken ≈ 100 px üres sáv a lépéssor fölött és a gombsor alatt, és a
  rajz oldalán is), mert az építési mód két saját `section`-jének nincs saját `padding`/`margin`
  értéke. Emiatt a rajzterület magassága a maradék, néhány tíz pixel.
- **Kell:** az építési mód minden saját eleme téma-független legyen (saját `margin`, `padding`,
  `box-sizing`, magasság), a rajzterület töltse ki a rendelkezésre álló helyet, legyen legalább
  280 px (asztali gépen) magas; a ház induláskor a teret kitöltve látsszon („Teljes rajz”
  gomb ugyanígy). Nagyítás gombbal is (+ / −), nem csak görgetéssel.
- **Kész, ha (mérve):** egy téma-szimulációval (`section, aside { padding: 100px 0; margin: 40px 0 }`
  + sötét téma) 1366×768-on a rajz oldala (eszközsor + rajzterület) ≥ a lépéspanel magasságának
  90 %-a, a rajzterület ≥ 280 px; a lépéssor fölött és a gombsor alatt nincs 24 px-nél nagyobb üres sáv; telefonon
  (390×844) a rajz fülén a rajzterület ≥ 50 % képernyőmagasság. A +/− gomb a méretarányt
  1,25×-ösével változtatja.

## 2. Töltésjelző

- **Hol:** `assets/js/agh-loader.js` (`open()`): a tervező megnyitásakor a CSS, a vázlat, a
  tervező és a bootstrap betöltése alatt nincs semmi jelzés. `agh-designer.js` `enterBuild()`:
  az építési szerkesztő betöltése alatt sincs. A 3D építési állás első felépítése alatt sincs.
- **Kell:** a megnyitás pillanatától látható, téma-független töltésjelző (forgó ikon + „Betöltés…”),
  amely eltűnik, amint a tervező megjelent (vagy hiba esetén). Az építési mód betöltése alatt és a
  3D építési állás első felépítése alatt ugyanígy jelzés.
- **Kész, ha (mérve):** a megnyitásra kattintás után ≤ 100 ms-on belül látható a jelző; a tervező
  megjelenése után 0 db jelző marad a DOM-ban; konzolhiba 0.

## 3. Zárás

`bin/bump-version.sh` (patch → 1.14.2), CHANGELOG mért értékekkel, a meglévő E2E-k (`build.js`,
`wizard`, `responsive`) zöldek, új felirat 15 nyelven, ZIP, dist külön commit, push a feature ágra.
