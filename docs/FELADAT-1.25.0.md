# FELADAT – 1.25.0 … 1.29.0: fotórealisztikus és gyors 3D + a két nyitott tétel

## 0. Norbi kérése (2026-10-22 20:19), szó szerint

> Tegyél meg a grafika érdemében minden javaslatot!!!!!!!
> (a javaslatlista: 1. valódi anyagtextúrák, 2. valódi égbolt-fénykép (HDRI), 3. fotó mód
> sugárkövetéssel, 4. utóeffektek, 5. növényzet és tárgyak, 6. frissítés WebGPU-ra; javasolt sorrend:
> 1. kör textúrák + égbolt, 2. kör fotó mód, 3. kör utóeffektek, 4. kör WebGPU külön ágon; előtte
> valódi videokártyán és telefonon mérni)
>
> ha lehetséges lenne fotorealisztikus és nagyon gyors 3d jó lenne
> Esetleg dolgozzz ki egy egyedi technologiat ha ez leheseéges
>
> Kérlek az elmaradt felső 2 pontal együtt mindent csinálj meg! Nem állhatsz meg mindent vigyél
> végig szabadkezet kapsz tokenre figyelj, barmennyi ügynököt használj fel és old ezeket meg kérlek

A „felső 2 pont” az ALLAPOT nyitott tételei közül:
- a helyiségek egymáshoz képesti logikus elrendezése (hálók a kert felé, fürdő a háló mellett);
- a lépcső a kész ház (9. lépés) 3D-jében.

### Irányváltás (Norbi, 2026-10-22 20:48), szó szerint

> a grafika javítása miatt a nagy helyet igénylő kulső polys technologiakat ne használjuk! cak a mi
> biztonságos az ég jó lenne és a háttérben a tárgyak fák és amit te még javasolsz

Következmény (ez felülírja a 2–4. pontot):
- **Elmarad:** fotó-PBR textúracsomag (Poly Haven / ambientCG), admin anyagcsomag-feltöltés,
  `build-matpack.sh`, glTF modellek.
- **Marad, kicsiben:** HDRI égbolt a plugin ZIP-jébe beépítve (5–6 CC0 HDRI erősen tömörítve,
  összesen legfeljebb ~3 MB, `assets/sky/manifest.json`: forrás, licenc, md5); betöltési hiba esetén
  a mai festett ég.
- **Erősödik:** háttér-tárgyak és fák procedurálisan (több faj, távoli fasor InstancedMesh/LOD-dal,
  bokor, sövény, kerítés, kandeláber, pad, szomszéd házak részletei), fű InstancedMesh-sel.
- **Javaslat, marad:** sztochasztikus csempézés a meglévő procedurális textúrákra, olcsó procedurális
  kopás/szennyeződés, minőségi szintek, beépített teljesítményteszt. A sugárkövetés (7.) és az
  utóeffektek (8.) kód, nem adat: maradnak, a hozzáadott vendor ≤ 500 KB.
- Tesztek: `tests/e2e/matpack.js` helyett `sky.js` és `scenery.js`.

## Közös szabályok (minden körre)

- Minden megmarad, ami ma működik; semmi nem vész el. Ha nincs anyagcsomag, nincs WebGL2, gyenge a
  gép vagy hiba van: a mai (1.24.0) kép és sebesség az alsó határ, csendes visszaesés, konzolhiba 0.
- **Nincs háttérszerver, CDN vagy külső letöltés futás közben** (Norbi állandó döntése): minden kép,
  HDRI és modell az ügyfél saját WordPressében van (a plugin ZIP-jében vagy a WP-be feltöltött
  anyagcsomagban). Csak CC0 forrás (Poly Haven, ambientCG), forrás és licenc fájlonként rögzítve.
- three.js r170 marad a fő ágon (1.25–1.28); a WebGPU (1.29) külön ágon, r18x-szel.
- Minden kör: `bin/bump-version.sh minor` → CHANGELOG → teszt → commit → ZIP → push a
  `feature/1.14.0-epites` ágra (a `main` Norbi döntési kapuja után). Új szöveg: `.pot` + 15 `.po` +
  `.mo` (`bin/po-tools.py check` 0 hiba).
- Ami nem mérhető itt (valódi GPU, telefon), azt a beépített teljesítményteszt (1.26.0, 6. pont) teszi
  Norbinál mérhetővé; addig „nem mérve” jelölés.

## 1.25.0 – a két nyitott tétel

### 1.1 Helyiségek logikus elrendezése (helyiségprogram, 6. lépés)

**Hol:** `assets/js/agh-build-ui.js` (`progAuto`, `progWalls`, `progState`, `programBox`), JS = PHP:
`includes/Build/Build.php` (a JS normalize portja), adat: `assets/data/build-defaults.json` →
`programme` (létező; bővül, új mező nem kell a `build.prog`-ban).

**Kell:** az automatikus elhelyezés a „fér-e” mellett elrendezési szabályokat is követ, súlyozott
pontszámmal (adatként, `programme.layout`, `verified: false`, figyelmeztet, nem tilt):
- hálók és nappali a kert / dél felé (a telek `orientation` és a ház hátsó homlokzata), konyha a
  nappali mellett vagy egy légtérben, étkező a konyha és a nappali között;
- fürdő a hálók mellett vagy közös közlekedőről; WC az előtér / bejárat közelében; kamra a konyha
  mellett; háztartási helyiség a fürdő vagy a garázs felé;
- gépészet / garázs az utca felé; dolgozó csendes oldalon, a nappalitól távolabb;
- előtér a bejáratnál; közlekedő köti össze a hálókat; vizes helyiségek egy vezetékfal körül
  (csoportosítás).
- A helyiségprogram ablaka szabályonként kiírja: teljesül / nem teljesül, és „Elrendezés javítása”
  gomb (Ctrl+Z-vel visszavonható). A mostani mérleg, minimumok, hézagok, teherhordó fal, lépcső
  szabályai változatlanul érvényesek.

**Kész, ha (`tests/e2e/prog.js` bővítve, 30 ház):** az automatikus elhelyezés után a szabályok
legalább 85 %-a teljesül átlagban, minden háznál a fürdő legalább egy hálóval vagy a hálókat összekötő
közlekedővel szomszédos (ahol mindkettő van), a nappali a kerti oldalon; a meglévő mérések
(lépcső 15/15, nettó m² ±0,5, átfedés 0) változatlanul zöldek; JS = PHP.

### 1.2 A lépcső a kész ház 3D-jében (9. lépés)

**Hol:** építési állás: `assets/js/agh-3d-build.js` (`stairRects`, a fokok rajza); kész ház:
`assets/js/agh-3d.js` / `agh-3d-int.js` (a 9. lépés nézete és a belső nézet).

**Kell:** a tervezett lépcső (`slab.stair.type/width/rot`, egyenes/L/U/csiga) a kész ház 3D-jében is
megjelenik: fokok, korlát, födémáttörés; a belső (szobanézet) 3D-ben is; az anyaga a padló
anyagához igazodik. A felső szint helyiségei továbbra is kerülik a födémáttörést.

**Kész, ha:** új `tests/e2e/stair3d.js`: mind a 4 lépcsőtípusnál a kész 3D-ben a fokok száma = az
építési állásé, a födém lyuka egyezik, konzolhiba 0; a többi e2e zöld.

## 1.26.0 – 1. kör: valódi anyagok és égbolt + mérés

### 2. Anyagcsomag (a „skinek”)
- **Külön ZIP:** `bin/build-matpack.sh` → `dist/agh-matpack-<verzió>.zip`. Tartalma CC0 fotó-PBR
  textúrák (szín, normál, érdesség; 1K, JPG/PNG, tileable) minden mai anyagfajtához (tégla, klinker,
  vakolat, kő, beton, fa burkolat, cserép több fajta, lemez, fű, kavics, térkő, aszfalt, padlók: parketta,
  csempe, járólap), `manifest.json` (anyag → fájlok, méret m-ben, forrás URL, licenc, md5).
  A plugin ZIP-je nem hízik tőle.
- **Telepítés a WordPressben:** admin → AutoGroweHome → Beállítások → „Anyagcsomag”: feltöltés,
  ellenőrzés (manifest, kiterjesztés-fehérlista, méret), kicsomagolás az `uploads/autogrowehome/matpack/`
  alá, verzió kiírva, törölhető. A 3D a csomag URL-jét a bootstrapból kapja.
- **3D:** ha van csomag, a fotótextúrák lépnek a procedurálisak helyére; a színválasztás továbbra is
  azonnali (semleges albedó × szín). A textúrák lustán töltődnek (először a látható anyagok), a
  procedurális kép addig marad. Csomag nélkül minden úgy marad, mint 1.24.0-ban.
- **Textúra-ismétlődés elleni technika** (egyedi): sztochasztikus csempézés (hash-alapú elforgatás +
  eltolás + keverés a shaderben, `onBeforeCompile`), hogy a nagy felületen ne látsszon a minta.

### 3. Égbolt-fénykép (HDRI)
- 5 CC0 HDRI (reggel, dél, aranyóra, kék óra, éjszaka; felhős változat) 1K–2K `.hdr` a csomagban.
  A `time_of_day` / `weather` választja ki, a `orientation` forgatja; a nap iránya a HDRI napjához
  igazodik (vagy a HDRI napja az árnyékot adó fényhez). Háttér: a HDRI (enyhe elmosás, ha kell),
  környezeti fény: PMREM. Csomag nélkül a mai festett ég.

### 4. Növényzet olcsón
- Pázsit: sok fűszál-csomó egyetlen `InstancedMesh`-ben, távolsággal ritkuló sűrűség, minőségi
  szinttől függő darabszám; a mai fű anyag marad a talajon.
- Fák, bokrok: a mai számított formák maradnak; ha a csomagban van glTF (CC0) növénymodell, azt
  használja (opcionális; a bútor-modellek elvetése, 1.13.0, érvényes marad: a plugin ZIP-be nem kerül
  modell).

### 5. Minőségi szintek, automatikus váltással
- `low / medium / high / ultra`: árnyéktérkép, pixelarány, GTAO, fű sűrűség, textúra felbontás,
  utóeffektek. Első induláskor rövid mérés (képkockaidő) választ, futás közben a képkockaidő alapján
  lép le/fel (hiszterézissel); a látogató felülírhatja („Minőség: automatikus / …”), megjegyezve.

### 6. Beépített teljesítményteszt (a valódi GPU / telefon méréséhez)
- Admin → „3D teljesítményteszt” (és `?agh_bench=1` a tervezőn): ugyanaz a mintaház minden
  szinten, kiírja: GPU neve (ha a böngésző megadja), képkocka/s, képkockaidő p50/p95, első kép ideje,
  háromszögszám, memória; „Másolás” gomb az eredményhez. Ezzel Norbi a saját gépén és telefonján mér.

**Kész, ha:** `tests/e2e/matpack.js`: csomag feltöltése → a 3D minden anyaga fotótextúrát kap
(számolva), HDRI háttér él, csomag törlése után a procedurális kép jön vissza, konzolhiba 0; a fű
háromszögszáma szintenként kiírva; a teljesítményteszt lefut és JSON-t ad; minden régi e2e zöld.

## 1.27.0 – 2. kör: Fotó mód sugárkövetéssel + az egyedi technika

### 7. „Élő fotó” (AGH egyedi hibrid megjelenítés)
- Mozgás közben a mai gyors raszteres kép. **Amikor a kamera megáll**, a háttérben elindul a
  progresszív sugárkövetés (three-gpu-pathtracer 0.0.23 + three-mesh-bvh 0.8.x, MIT, a
  `vendor/`-ba, r170-kompatibilis) ugyanazon a jeleneten; a minták gyűlnek, és a kép fokozatosan,
  áttűnéssel vált a sugárkövetett képre (valódi fény, tükröződés, lágy árnyék). Mozdulatra azonnal
  vissza a raszterre. Ez az „egyedi technológia”: gyors, ha mozog; fotó, ha áll.
- Gyorsítások: a BVH a jelenet változásakor egyszer épül (háttérben, darabolva), a statikus rész
  összevonva; kisebb felbontáson gyűjt, majd felskáláz; zajszűrés (a pathtracer denoiser vagy saját
  kétoldalú szűrő); a raszteres első kép a kiindulópont, nem fekete kép.
- **„Fotó készítése”** gomb: nagy felbontású állókép N mintával (állapotsáv), PNG letöltés; a
  Magnific mellett ingyenes, helyben fut, és nem talál ki semmit.
- Gyenge gépen / telefonon: az élő fotó alapból ki, a fotó gomb megmarad (lassan).

**Kész, ha:** `tests/e2e/photo3d.js` (SwiftShaderen kis felbontással): megállás után a minták száma
nő, a kép eltér a raszterestől és zajszintje csökken a mintákkal (mérve), mozdulatra 1 képkockán belül
raszter, a fotó gomb PNG-t ad, konzolhiba 0; a BVH építési ideje kiírva.

## 1.28.0 – 3. kör: utóeffektek automatikus minőségváltással

### 8. Effektlánc (`high` és `ultra` szinten)
- Tükröződés (SSR) az ablaküvegen, medencén, fényes padlón; ragyogás (bloom) lámpákra, napra;
  mélységélesség (DOF) a fotóhoz és belső nézethez (alapból ki); színkorrekció (fehéregyensúly,
  kontraszt, telítettség, vignetta, enyhe filmszemcse); élsimítás (SMAA vagy FXAA a
  többmintavételezés mellett/helyett). Mindegyik kapcsolható, az 5. pont minőségváltója kezeli.

**Kész, ha:** e2e: szintenként a lánc elemei kiírva, képkockaidő mérve SwiftShaderen (relatív),
`low` szinten nincs effekt, konzolhiba 0, a mai kép (`high` effektek nélkül) pixelre egyezik az
effektek kikapcsolásakor.

## 1.29.0 – 4. kör: WebGPU, külön ágon (`feature/1.29.0-webgpu`)

### 9. three.js r18x + WebGPURenderer
- Frissítés three.js r170 → r18x (MIT) a vendorban; a `WebGLRenderer` útvonal ugyanúgy működik
  (minden régi e2e zöld); `WebGPURenderer` választható, ha a böngésző tudja, WebGL tartalékkal; ami
  WebGPU alatt nem megy (`onBeforeCompile`), annak TSL-változata vagy kikapcsolása.

**Kész, ha:** a régi e2e-k r18x-szel zöldek; WebGPU-képes böngészőben a WebGPU-útvonal kép ad
(itt SwiftShaderen nem biztos – ha nem mérhető, „nem mérve” jelöléssel); nem kerül `main`-re Norbi
döntése nélkül.
