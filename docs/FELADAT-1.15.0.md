# FELADAT – 1.15.0: képleíró prompt – a Claude a 3D képernyőképből írja a Magnific-promptot

Norbi szövege (2026-10-21 21:22): egy teljes, angol nyelvű rendszerprompt („You are the photorealistic
rendering prompt engineer inside a house design application…”), amely a 3D külső nézet képernyőképét
elemzi, és JSON-t ad vissza: `detected_elements` (9 tétel), `prompt` (150–250 szó), `negative_prompt`
(kötelező alaplistával kezdődik). A végén a feladatrész négy helyőrzővel: `{MAGNIFIC_DESCRIPTION}`,
`{TIME_OF_DAY}`, `{SEASON}`, `{WEATHER}`, `{EXTRA_WISHES}`. Utasítása:

> Az appban csak a kapcsos zárójeles helyőrzőket kell kicserélni minden háznál. Ha egy paraméter üres,
> írd bele, hogy „default”, és az AI az alapértelmezést használja (aranyóra, tiszta égbolt).

A sablon szó szerint, változtatás nélkül: `assets/data/prompts/vision-exterior.txt`.

**Minden maradjon meg**: a `PromptEngine` promptja (tartalékként és a belső nézeteknél), a hűség-kapcsoló
és a referenciablokk, a konfigurációs negatív lista, a mért `guide_aspect`, a tiszta vezetőkép, a
stílusminta, a tetőtermék neve (BRAMAC), a költségkeretek, a tesztszolgáltató. A képek száma, nézetei,
formája változatlan.

## 1. Hol tart ma (a kódban)

- A külső képek promptja a `PromptEngine::build()`-ből jön, **a konfigurációból**, nem a képből
  (`Pipeline::render()`); a 3D kép csak `structure_image`-ként megy a Magnificnek.
- `AnthropicProvider::call_tool()` csak szöveget küld, képet nem tud (`includes/Ai/AnthropicProvider.php`).
- A vezetőképek a védett tárhelyen: `guides-<nézet>.jpg` (`Storage::put_guides/guide_path`).
- `magnific.guide_clean` (alap be): a vezetőképről lekerülnek a járművek, emberek, állatok, háttérfák és
  a pára. A sablon 3. szabálya viszont épp ezeket akarja megtartani („Keep every object…”), tehát a
  Claude-nak a **teljes** jelenetet kell látnia – különben az autó, az ember, a kutya eltűnik a képről.
- Létező mezők, nem kell új: `time_of_day`, `season`, `weather` (prompt_map angol szöveggel), `custom_text`
  (a látogató saját instrukciója). Magnific-féle képleírás (image-to-prompt) ma nincs a pluginban.

## 2. Mi legyen (mérhetően kész)

1. **Kapcsoló** `anthropic.vision_prompt` (alap: be). Csak akkor fut, ha az Anthropic be van állítva, a
   kép külső nézet (hero, front, back, left, right, aerial…), és van mentett 3D képernyőkép a nézethez.
   Csak „Hű”, „Klón” és egyedi hűségnél: „Szabad” és „Kiegyensúlyozott” fokozaton a három koncepció
   tömegben és anyagban eltérhet, ezt a konfigurációs prompt adja – egy képernyőképből mindhárom
   ugyanolyan lenne. Minden más esetben (kikapcsolva, nincs kulcs, nincs kép, belső nézet, a GD tömegvázlat) **a mai prompt**
   megy, bájtra ugyanaz. Kész: kikapcsolva a `guide-test.php` 62/62 változatlanul.
2. **Sablon**: a beépített szöveg Norbi sablonja; az admin felülírhatja (`anthropic.vision_template`,
   üresen a beépített). A `---` sor előtti rész a rendszerprompt, utána a feladatrész; csak a kapcsos
   helyőrzők cserélődnek. Kész: a kérésben a `system` a sablon első fele, a felhasználói üzenet a
   kitöltött második fele + a kép.
3. **Helyőrzők**: `{TIME_OF_DAY}`, `{SEASON}`, `{WEATHER}` a mezők angol szövegéből (pl. „warm golden-hour
   light”, „early summer”, „a few soft clouds”); `{EXTRA_WISHES}` = a látogató `custom_text`-je és a
   tetőtermék sora (márka + termék + a modell színe, BRAMAC-követelmény); `{MAGNIFIC_DESCRIPTION}` = nincs
   ilyen leírás → „default”. Üres érték mindenhol → „default”. Kész: a teszt mind az ötöt ellenőrzi.
4. **A kép**: a Claude a teljes jelenetet kapja (`scene_<nézet>`: járművel, emberrel, állattal, fákkal);
   ha a tiszta vezetőkép ki van kapcsolva, ez ugyanaz a kép, ami a Magnificnek megy (pontosan Norbi
   leírása). A böngésző tiszta vezetőkép mellett a teljes jelenetet is elkészíti, ugyanabból a
   kameraállásból. Kész: `guide.js`-ben a hero és az 5 nézet `scene_` párja elkészül, és ugyanaz a méret.
5. **Kimenet**: kényszerített tool-hívás a sablon JSON-sémájával (`detected_elements` 9 mező, `prompt`,
   `negative_prompt`). Ha a negatív lista nem az alaplistával kezdődik, a plugin elé teszi. A végső prompt:
   referenciablokk (Hű/Klón, mint ma) + a Claude promptja + „Avoid: ” a Claude negatív listája és a
   konfiguráció téves alternatívái, ismétlés nélkül; együtt 3900 karakter alatt, a negatív lista nem vágódik.
   Negatív mezős szolgáltatónál a lista a `negative_prompt` mezőben megy.
6. **Tartalék**: bármilyen hiba (időtúllépés, rossz JSON, túl rövid prompt < 200 karakter) → a mai prompt
   megy, a kép elkészül, a napló egy sorban jelzi. A képleírás soha nem hiúsítja meg a képet.
7. **Gyorsítótár**: az eredmény a védett tárhelyre kerül (`vision-<nézet>.json`), kulcsa a kép, a
   kitöltött sablon és a modell kivonata. Újrapróbálás és ugyanaz a ház újra: 0 újabb Claude-hívás.
8. **Admin**: a projekt adatlapján képenként lenyitható „Mit őriz meg a kép” (a `detected_elements`).
   Beállítások: kapcsoló, sablon, hőmérséklet (alap 0,2), időkorlát (alap 60 s).
9. **Zárolás**: a render feladat zárolási ideje bekapcsolt képleírásnál az Anthropic és a Magnific hívás
   összege (+60 s), hogy a hívás közben ne vegye át másik feldolgozó.
10. **Fordítás** 15 nyelvre, `po-tools.py check` 0 hiba; doksi: KONFIGURACIO.md, ADMIN-KEZIKONYV.md.
11. **Teszt** új `tests/vision-test.php` (a tesztoldalon, az Anthropic hívás `pre_http_request`-tel
   elfogva, hálózat nélkül): a kérésben ott a kép és a kitöltött helyőrzők; a Magnific-kérés promptja a
   Claude promptja; alaplista elöl; hosszhatár; hibás válasznál a mai prompt; második futásnál 0 hívás;
   belső nézet és kikapcsolt állapot = mai prompt.

## 3. Amit nem szabad elrontani

- Kikapcsolva és kulcs nélkül: a mai viselkedés, bájtra.
- A kép nem kerül nyilvános URL-re és repóba; az Anthropic-nak base64-ben megy, mint ma a Magnificnek.
- A Magnific költsége nem nő (képenként egy hívás marad). **Új költség:** képenként egy Claude-hívás
  (kép + ~2,5 ezer token sablon + ~1 ezer token válasz) – becslés, éles kulccsal mérendő.
- A belső nézetek a mai úton (a sablon külső nézetre szól).

## 4. Őszintén (nem mérhető ebben a környezetben)

- Éles Anthropic- és Magnific-kulcs nincs a tesztoldalon: hogy a kép szebb és hűbb-e, itt nem mérhető,
  csak az, hogy mi megy ki. Norbinak éles kulccsal, ugyanazon a házon be/ki kell összevetnie.
- A Claude a képről olvas: amit a 3D kép nem mutat (pl. hátsó homlokzat a hero képen), arról nem ír.
