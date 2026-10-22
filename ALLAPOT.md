# ALLAPOT – AutoGroweHome (frissítve: 2026-10-22)

**Verzió:** `feature/1.14.0-epites` = **1.24.0** (dist/autogrowehome-1.24.0.zip) · `main` = 1.12.1 (mentési pont `release-1.12.1`) · `feature/1.13.0-modellek` archívum · Licencközpont 1.0.0 · Repó: github.com/koltainorbert/AutoGroweHome (új cím: AutoGroweHome.git). Chat elején: repó, CLAUDE.md, claude/FELADAT-*.md, tesztoldal `bin/test-wp.sh`.

**Kész ebben a körben (FELADAT-1.18.0 + 1.21.0):** 1.18 mozgatás/forgatás a 3D-ben · 1.19 fal/ablak/ajtó törlése, mozgatása alaprajzon és 3D-ben · 1.20 helyiségprogram ablak · 1.21 területmérleg (falak, vakolat, lépcső levonva), lépcső méretezése/elhelyezése, „hogyan fér el”, díszítőanyag helye · 1.22 medence + garázs részletesen, mozgatható garázs, elfér-ellenőrzés · 1.23 melléképületek · 1.24 élethű járművek/emberek/állatok.

**Mérve (1.21–1.24):** `e2e/prog.js` 30 ház (lépcső 15/15, nettó m² ±0,5 133/133, átfedés 0) · `paint.js` 19/19 · `detail.js` 9/9 · `outb.js` 14/14 · `life.js` 10/10 (autó ≤ 20 000 háromszög, a nézet gyorsabb lett) · `move.js` 21/21 · sketch 1321 rajz 0 hiba · match 35/35 · guide 62/62 · build-test 6975/6975 + PHP 2235/2235 · 15 nyelv × 2687 szöveg.

**Döntések**
- Norbi (2026-10-22): a terveket a mérnök ellenjegyzi → „nem statikai / nem engedélyezési terv” felirat lekerült az építési módról; szakmai pontosság: szabályok adatként (`build-defaults.json` → `programme`, `stair`; `rules/hu.json`), mind `verified: false`, figyelmeztet, nem tilt.
- Helyiségprogram geometriája: téglalap = kész falsíkok közti nettó; hézag = válaszfal + 2 × 1,5 cm vakolat; teherhordó fal marad; részben falra futó oldal tilos. Lépcső: 2m + b ≈ 63 cm, fokmagasság ≤ 19 cm, fejmagasság 2,1 m, típusok: egyenes/L/U/csiga (`slab.stair.type/width/rot`, JS = PHP).
- „Háztervező” = az „Építés az alapoktól” mód ebben a pluginban (feltételezés – ha Norbi mást ért alatta, egyeztetni).
- Új mezők: `accent_layout`, `pool_*`, `garage_*`, `outbuildings`; `site_layout` kulcsai: `garage`, `out#n`. A modellek (jármű, ember, állat) egyszer épülnek, anyagonként összevonva, másolatként kerülnek a jelenetbe.
- Minden ZIP új verzió, minden kör végén ZIP; minden szövegből előbb `docs/FELADAT-<verzió>.md`.

**Nyitott tételek**
- Döntési kapu (Norbi): 1.17–1.24 kipróbálása éles kulccsal, utána `main`.
- A helyiségprogram típusfüggő elrendezése (pl. hálók a kert felé, fürdő a háló mellett) még nincs – most csak elfér/nem fér el és minimumok.
- A lépcső a kész ház (9. lépés) 3D-jében még nem látszik, csak az építési állásban; a felső szint helyiségei a födémáttörést kerülik.
- Melléképület: a 90°-tól eltérő forgatás a 2D-ben befoglaló téglalappal rajzolódik; a fedés színe rögzített.
- Valódi GPU-n és telefonon nem mérve. `build.js` felületmérés 768×1024-en ritkán 43 px (betöltési pillanat).
- Éles próba Norbinál: képleíró prompt, Magnific, Licencközpont telepítése, fordítások lektorálása, jogi szövegek.
