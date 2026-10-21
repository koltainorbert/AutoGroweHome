# FELADAT – 1.15.1: a képleíró prompt Professional-funkció

Norbi szövege (2026-10-21 22:03): „ebbe is kérem a pro verziót” – a kérdésre adott válasza: **csak a Pro
licenccsomagban** fusson.

**Minden maradjon meg**: az 1.15.0 képleíró prompt működése, beállításai, tartalék útja; a többi
licencfunkció és a csomagok mai tartalma.

## 1. Hol van

- Licencmátrix: `includes/License/Features.php` (`catalog()`, `default_plans()`); a kapu:
  `Features::enabled()`. Saját oldalon (`AGH_OWNER_MODE`) minden funkció él.
- A képleíró prompt kapuja: `VisionPrompt::enabled()` (`includes/Prompt/VisionPrompt.php`); ebből
  dönt a szerver (`Pipeline::render()`) és a böngésző is (boot `guide.scene` → `scene_` képek).
- Ma nincs licenckapu: Starter csomagban is fut.

## 2. Kész, ha (mérve)

1. Új funkció a katalógusban: `vision_prompt` – „Prompt a 3D képből (Claude képleírás)”, a Professional
   és az Agency csomagban; Starterben nincs. Kész: a mátrixban a három csomag rendre –, ✓, ✓.
2. `VisionPrompt::enabled()` a licencet is nézi. Starter csomagban: 0 Claude-hívás, a mai prompt, és a
   böngésző nem készít `scene_` képet (boot `guide.scene` = hamis). Professional/Agency és saját oldal: fut.
3. Admin: Starter csomagban az Anthropic-beállításoknál a „Képleíró prompt” rész kiírja, hogy a
   Professional csomagtól érhető el (a beállítás látszik, de nem hat).
4. Dokumentáció: LICENC-ES-ELOFIZETES.md táblázata új sorral; ADMIN-KEZIKONYV 5.3 egy mondattal.
5. Új szövegek 15 nyelven, `po-tools.py check` 0 hiba.
6. Teszt: `tests/vision-test.php` bővül – Starter (saját oldal mód kikapcsolva) = nem fut, 0 hívás;
   Professional = fut; saját oldal = fut.
