# FELADAT – 1.15.3: a galéria nézetei se találjanak ki másik házat

Norbi szövege (2026-10-21 22:41), 3 képpel (madártávlat, elölnézet, egy harmadik nézet, mind
1440×816): „és az első képet kiválasztotta, akkor megcsinál több nézetet, azok meg rosszabbak”

**Minden maradjon meg**: a nézetek száma és fajtája, a hero mint egységesség-referencia, az
1.15.2 színjavítás, a „Nézetek egysége” beállítás (Flux-referencia / stílusreferencia), a
Szabad/Kiegyensúlyozott fokozat mai útja.

## 1. Mi rossz a képeken

| # | 3D | Nézetek | Minősítés |
|---|---|---|---|
| 1 | nincs torony | madártávlaton és elölnézeten **torony** | halucináció |
| 2 | téglalap ablakok | elölnézeten **íves ablakok**, más tömeg | halucináció |
| 3 | két oromzatos szárny + középrész | elölnézeten egyetlen hosszú tömeg | forma elveszett |
| 4 | narancs tető | a 3. nézeten fekete tető (a kiválasztott hero örökölt színe) | szín |

## 2. Gyökérokok (a kódban)

1. **A nézetek a Flux 2 Pro úton mennek** (`view_strategy = reference`, 1440×816;
   `MagnificProvider::submit()`): `input_image` = a kiválasztott hero, `input_image_2` = a nézet 3D
   képe. A Fluxnak **nincs structure-erőssége**, és a prompt nem mondja meg, melyik kép mi – a
   szöveg dönt, a 3D csak javaslat.
2. **A stílus leírása tömeget rendel:** a mediterrán stílus szövege (`Catalog::style_direction`):
   „U-shaped house around a courtyard **with a small tower**, … **arched** or deep-set openings”.
   Ebből lesz a torony és az íves ablak.
3. A koncepciószövegek (1.15.2-ben a herónál már kötve kimaradnak) a nézeteknél is ugyanígy
   viselkednek – rendben.

## 3. Mi legyen (mérhetően kész)

1. **Kötött hűségnél (Hű, Klón, egyedi) 3D vezetőképpel a nézet a Mystic structure útján megy**
   (structure = a nézet 3D képe a hűség erősségével, style reference = a kiválasztott hero), a
   „Flux-referencia” beállítástól függetlenül. Kész: ilyenkor a kérés végpontja `/v1/ai/mystic`,
   benne `structure_reference`, `structure_strength` és a hero `style_reference`-ként.
   Vezetőkép nélkül vagy Szabad/Kiegyensúlyozott fokozaton a mai út marad.
2. **Kötött hűségnél a stílus leírása (tömeg, torony, ívek) kimarad**, csak a stílus neve megy
   („Architectural style: Mediterranean architecture.”). Kész: nincs „tower”, „U-shaped”,
   „arched” a promptban; Szabad fokozaton megmarad.
3. Teszt: `tests/match-test.php` bővül; `guide-test` 62/62, `vision-test` 55/55 változatlan.

## 4. Őszintén

- A nézet a kiválasztott herót viszi stílusmintának: ha a hero színe rossz volt (1.15.2 előtti
  kép), a nézet is örökli. Az 1.15.2 után új generálás kell.
- A Mystic nézet a Flux nézetnél drágább lehet (mystic_2k vs reference_image díj); pontos összeg
  éles kulccsal mérendő.
