# FELADAT – 1.12.1: teljes képernyő gomb a popupokban

Norbi szövege (2026-10-15):

> Teljes kepernyos gomb kell a popupba neha jobb kitenni nagyba

**Feltételezés** (Norbi nem pontosította): minden popupba kell, amelyben kép, 3D vagy 2D nézet van.
Ez a 3D nézet, a 2D vázlat és a képgaléria (nagyított kép). Első lépés: a kódban felmérni, milyen
popupok vannak (`assets/js/agh-designer.js` és társai), és a listát beírni a CHANGELOG-ba.

**Minden maradjon meg**: a popupok mai mérete, megnyitása, bezárása, tartalma és viselkedése. A
teljes képernyő csak egy plusz állapot, amiből vissza lehet lépni ugyanoda.

## 1. Mi legyen (mérhetően kész)

1. **Gomb** a popup fejlécében, jobb felül, a bezárás mellett. Az ikon vált (kinyit / összecsuk),
   van `aria-label` és `title`. A felirat mind a 15 nyelven megvan.
2. **Működés**: Fullscreen API a popup elemén (szabványos és `webkit` előtagos hívás). Kilépni a
   gombbal, Esc-kel és a böngésző saját kilépésével is lehet. A `fullscreenchange` eseményre az ikon
   és a belső állapot mindig egyezik.
3. **Tartalék, ahol nincs elem-szintű teljes képernyő** (iPhone Safari): CSS-es teljes ablak
   (`position: fixed; inset: 0; height: 100dvh`, safe-area kitöltés, a lap görgetése zárolva).
   Telefonon a vissza gomb előbb a teljes képernyőből lép ki, nem a lapról.
4. **Ami a popupon kívül nyílik, az is látsszon.** Teljes képernyőn csak a teljes képernyős elem
   belseje látszik. A színválasztó panelt, a buborékokat, a lenyílókat és a megerősítő ablakokat,
   ha ma a `body`-ba kerülnek, teljes képernyő alatt a popupba kell tenni.
   Kész: teljes képernyőn mindegyik megnyílik és használható.
5. **Méretezés újraépítés nélkül**:
   - 3D: `ResizeObserver` → `renderer.setSize`, `camera.aspect`, `updateProjectionMatrix`, egy
     újrarajzolás. A jelenet nem épül újra. A pixelarány felső korlátja a mai érték marad, így 4K
     monitoron sem nő a GPU-terhelés.
   - 2D vázlat: vektorosan újrarajzol, nem nyújtott bitkép.
   - Galéria: a kép `contain` módban tölti ki a képernyőt. A legnagyobb meglévő változat töltődik,
     közben a mostani kép látszik.
6. **Az állapot megmarad**: kamera, kijelölés, nézet, szint, és a kézi elrendezés húzás közben is.
   Kilépéskor az eredeti méret és ugyanaz a kameraállás jön vissza.
7. **Ami teljes képernyőn is működik**: koppintás a modellre (`pickAt`, 6 px szabály), tárgy
   megfogása (`grabAt/dragTo/turnDrag/dropDrag`), Ctrl+Z, színválasztó, kereső fókusza.

## 2. Mérés

- **Új teszt** `tests/e2e/fullscreen.js`, két méretben (asztali és telefon), minden popupon:
  - belépés és kilépés gombbal és Esc-kel;
  - a vászon mérete a nézetablakkal 1 px-en belül egyezik, kilépés után az eredetivel;
  - a kamera helyzete és iránya a ki-be lépés után változatlan;
  - a Fullscreen API letiltásával a CSS-tartalék is átmegy;
  - teljes képernyőn a színválasztó panel látható (`elementFromPoint`);
  - 0 konzolhiba.
- Belépéstől az első új képkockáig mért idő kiírva (cél: ≤ 100 ms SwiftShaderen).
- A meglévő E2E-k (`pick`, `layout`, `color`, `search`, `responsive`) zöldek.
- Képernyőkép a végén: popup normál és teljes képernyős méretben.

## 3. Visszaállítás

Kicsi, önálló változás, adatot nem érint. Ha baj van, a `dist/autogrowehome-1.12.0.zip`
visszatelepítése pontosan a mai állapotot adja.

## 4. Kötelező zárás

`bin/bump-version.sh patch` (1.12.1) · CHANGELOG (a popuplistával) · .pot + 15 .po, `po-tools.py
check` 0 hiba és `compile` · autoloader, lint · E2E · `bin/build-zip.sh` · a dist külön commitban ·
push `main`.
