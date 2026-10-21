# FELADAT – 1.14.3: a 3D előnézet kicsi középen, az építési állás csúszkája, újbóli belépés

Norbi szövege (2026-10-21 16:15, 3 kép, htombau.local, sötét téma):
1. „A sima 3D tervező része mindig középen kicsiben.”
2. „Amikor az alapoktól építek, a lenti 8 pontos sárga indikátorvonal nem a sorral nő, ahogy haladok,
   hanem nem csinál semmit, és az 1. pontnál már a 8-ast mutatja.”
3. „Amikor átlépek az alapoktól tervezőből a »Vissza a tervezőbe« gombbal, majd újra az alapokba
   akarok menni, szürke képernyő, nem tölt be, és újra kell kezdeni a tervezést.”

**Minden maradjon meg** (1.14.2): a mai tervező, a varázsló, az építési mód minden lépése, mentés,
mérés. Kikapcsolt építési mód = változatlan működés (az 1. pont minden témára javít).

## 1. Az előnézet kicsi, fölötte és alatta üres hely

- **Hol:** `assets/css/agh-designer.css` – a tervező három panelje `section.agh-panel-params`,
  `section.agh-panel-stage`, `aside.agh-panel-summary`; a `.agh-panel` szabálynak nincs saját
  belső margója.
- **Gyökérok:** ugyanaz, mint 1.14.2-ben: a téma a `section`/`aside` elemekre ≈ 100 px belső és
  40 px külső margót tesz (a képen a „Tervezés” fül 160 px-rel a panel teteje alatt, a paraméterlista
  is lejjebb csúszik). Az 1.14.2 csak a margót nullázta a paneleken, a belső margót nem.
- **Kell:** a panelek, a fejléc, a műveleti sáv, az oldalsáv és a fülek téma-függetlenek (belső és
  külső margó a sajátjuk).
- **Kész, ha:** téma-szimulációval 1366×768-on a „Tervezés” fül a középső panel tetejétől ≤ 24 px-re,
  az előnézet magassága ≥ a középső panel 55 %-a (1.12.1 téma nélkül: mérendő, azonos ±2 px).

## 2. A fázis-csúszka nem a lépéssel halad

- **Hol:** `assets/js/agh-build-ui.js` `open()`: `st.phase = 8` állandó; csak a lépésváltás
  (`goStep`) igazítja.
- **Kell:** a 3D építési állás mindig az aktuális lépésig mutatja a házat (0. lépés → 0, … 8 → 8,
  9 → 9), megnyitáskor is; kézzel visszább/előrébb húzható, a következő lépésváltás újra a lépéshez
  igazítja.
- **Kész, ha:** megnyitás a 0. lépésen → csúszka 0; minden lépés lezárásakor a csúszka = a lépés
  száma (0–9), E2E-ben mérve.

## 3. Újbóli belépés: szürke képernyő

- **Hol:** `agh-build-ui.js` `close()` – a szerkesztő **eltávolítja a gazdaelemet** (`els.build`)
  a DOM-ból; `agh-designer.js` `enterBuild()` csak akkor hozza létre és szúrja be újra, ha
  `els.build` üres, ezért másodszorra a szerkesztő egy DOM-on kívüli elembe épül.
- **Kell:** a bezárás csak kiüríti a gazdaelemet; a belépés mindig ellenőrzi, hogy a gazdaelem a
  héjban van. A rajz megmarad (a `build` mező), a tervezés folytatható.
- **Kész, ha:** E2E: belépés → rajz → vissza a tervezőbe → újra belépés, ötször egymás után: a
  szerkesztő minden alkalommal látható, a rajz (falak, nyílások száma) azonos, konzolhiba 0.

## 4. A megnyitógomb logója nagyon kicsi (Norbi, 16:20: „a logó nagyon kicsi a háztervező gombon”)

- **Hol:** `includes/Frontend/Frontend.php` `shortcode()` (gomb `.agh-cta`) és `assets/js/agh-loader.js`
  (lebegő gomb `.agh-fab`): az ikon egy „⌂” betűjel 16 px-es betűvel, 30 px-es körben.
- **Gyökérok:** (a) a betűjel a legtöbb betűtípusban apró és elmosódott; (b) a `.agh-cta` stílusa
  az `agh-designer.css`-ben van, ami csak a tervező megnyitásakor töltődik be – addig a gomb a téma
  gombstílusával és a betűjellel látszik.
- **Kell:** éles SVG házikon, vagy ha van, az Arculatban feltöltött ikon (`icon_id`, haladó arculat),
  különben a logó (`logo_id`); 44 px-es elem, a kép ≥ 32 px; a gomb stílusa a gombbal együtt kerül
  az oldalra (nem a tervező CSS-ével), téma-független. A gomb felirata, színe, viselkedése marad.
- **Kész, ha:** a megnyitás előtt mérve az ikon ≥ 40×40 px, kép esetén a kép ≥ 32 px; a gomb
  ugyanígy néz ki a tervező bezárása után; konzolhiba 0.

## Zárás

patch → 1.14.3, CHANGELOG mért értékekkel, `build.js`, `theme.js`, `wizard`, `responsive` zöld, ZIP.
