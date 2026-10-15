# Valódi 3D modellek (1.13.0) – hogyan kerül be egy modell

A 3D nézet bútorai kódból épülnek (azonnal megjelennek). Ahol a katalógusban (`assets/models/manifest.json`)
van hozzá szabad licencű modell, az a háttérben betöltődik, és **ugyanabban a befoglalóban** váltja le a
bútort. Minden más változatlan: slotnév, koppintás, kézi elrendezés, mentés, 2D vázlat.

## Kapcsoló és visszaállítás

- Admin → AutoGroweHome → Arculat és elrendezés → Popup elrendezés → **Valódi 3D modellek** (alapból be). Kikapcsolva pontosan a
  korábbi (1.12.1-es) jelenet jön vissza, modellkérés nélkül, egy oldalfrissítéssel.
- Összehasonlítás egy oldalon: `?agh_models=0` / `?agh_models=1`; eszközszint kézzel: `?agh_tier=lo|hi`.
- Üres katalógusnál a modul sem töltődik be.
- Végső mentőöv: a `release-1.12.1` ág, benne a `dist/autogrowehome-1.12.1.zip`.

## Licenc

Csak **CC0**. Ajánlott forrás: [Poly Haven](https://polyhaven.com/models) (szkennelt, PBR, fotószerű).
Kenney, Quaternius, AmbientCG is CC0, de ezek stilizáltak. IKEA és más márkás modell nem kerülhet be.

## Lépések

1. **Letöltés:** Poly Havenen a modellnél „glTF”, **1K** felbontás, ZIP. A ZIP neve tartalmazza az
   azonosítót (pl. `sofa_02_1k.gltf.zip`).
2. **Katalógussor** a `manifest.json`-ba:
   ```json
   { "id": "sofa_02", "match": { "key": "sofa_type", "values": ["straight", "modular"] },
     "front": "+z", "mount": "floor", "tint": ["fabric"],
     "license": "CC0-1.0", "source": "https://polyhaven.com/a/sofa_02", "author": "…", "date": "2026-10-15" }
   ```
   - `key`: a mező vagy tárgy, amit a modell levált (a 3D-ben `userData.item`, pl. `sofa_type`,
     `armchair_type`, `coffee_table`, `floor_lamp`, `plants`, kint `garden_table`, `garden_bench`).
   - `values`: melyik opciókra illik (`"*"` = mindre). Ha a látogató olyat választ, amire nincs modell,
     a dobozbútor marad.
   - `front`: a modell eleje (`+z`, `-z`, `+x`, `-x`); `mount`: `floor` / `wall` / `ceiling`.
   - `tint`: azok az anyagnevek, amelyeket a választott szín fest (kárpit, fa).
3. **Források:** `bin/fetch-models.sh --from <letöltési mappa>` → `incoming/models/<id>/` (nem a repóba).
4. **Építés:** `bin/build-models.sh` (első futáskor a `bin/build-tools.sh` lefordítja a gltfpacket
   KTX2-támogatással): háromszögkeret 20 000, textúra 1024 px (hi) és 512 px (lo), KTX2 + Meshopt,
   tartalom-hash a fájlnévben. A végén `bin/models-tool.py check`: CC0, forrás, keretek
   (hi ≤ 200 KB, lo ≤ 100 KB, összesen ≤ 10 MB).
5. **LICENSES.md** sor, majd teszt: `node tests/e2e/models.js`.

## Illesztés

- A modell egyenletes skálával a dobozbútor alapterületébe kerül, padlóra (falra, mennyezetre).
- Ha az arányai 15 %-nál jobban eltérnek, a dobozbútor marad, és a konzol kiírja (torz bútor nincs).
- A modell a háttérben töltődik, rejtve kerül a helyére, a shaderei elkészülnek, és egy képkockán belül
  cserélődik. Generáláskor a vezetőkép legfeljebb 3 s-ig vár a modellekre.
