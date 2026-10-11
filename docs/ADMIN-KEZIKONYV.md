# AutoGroweHome 1.0.0 – Adminisztrátori kézikönyv

Ez a kézikönyv a WordPress-admin AutoGroweHome menüjének minden oldalát bemutatja abban a sorrendben, ahogy a menüben megjelennek: mit mutat az oldal, milyen gombok vannak rajta, és ki használhatja. A menü- és jogosultság-definíció: `includes/Admin/Admin.php` (`pages()`), az oldalak megjelenítése: `includes/Admin/Pages.php`.

> A beállítási kulcsok teljes listája alapértékekkel: `docs/KONFIGURACIO.md`. Telepítés és cron: `docs/TELEPITES.md`.

---

## 1. Szerepkörök és jogosultságok

### 1.1 Szerepkörök (`includes/Installer.php`)

| Szerepkör | Jogosultságok | Mire való |
|---|---|---|
| Adminisztrátor | `agh_manage`, `agh_view_projects`, `agh_view_stats`, `agh_view_packages` | Minden |
| AutoGroweHome projektkezelő (`agh_manager`) | `agh_view_projects`, `agh_view_stats`, `agh_view_packages` | Projektek, ajánlatkérések, statisztika megtekintése; beállítások nélkül |
| AutoGroweHome kivitelező (`agh_contractor`) | `agh_view_packages` | Kivitelezői portál bejelentkezve; admin menüt nem lát |

### 1.2 Menüpontok és szükséges jogosultság

A főmenü neve a `general.plugin_name` beállítás (alapértelmezés: „AutoGroweHome”), pozíciója 58. A főmenü megjelenéséhez `agh_view_projects` kell.

| # | Menüpont | Jogosultság |
|---|---|---|
| 1 | Vezérlőpult | `agh_view_projects` |
| 2 | Projektek | `agh_view_projects` |
| 3 | Ajánlatkérések | `agh_view_projects` |
| 4 | Statisztika | `agh_view_stats` |
| 5 | AI-szolgáltatók | `agh_manage` |
| 6 | Promptmotor | `agh_manage` |
| 7 | Paraméterek | `agh_manage` |
| 8 | Katalógus | `agh_manage` |
| 9 | Arculat és elrendezés | `agh_manage` |
| 10 | Limitek és hozzáférés | `agh_manage` |
| 11 | Kivitelező és e-mail | `agh_manage` |
| 12 | Jogi és GDPR | `agh_manage` |
| 13 | Licenc | `agh_manage` |
| 14 | Súgó és rendszer | `agh_manage` |

### 1.3 Műveletek jogosultsága (`Admin::handle_action()`)

| Művelet | Jogosultság |
|---|---|
| Statisztika CSV-export (és `export_advanced` funkció) | `agh_view_stats` |
| Projekt JSON-export; értesítés újraküldése; kivitelezői hozzáférés visszavonása | `agh_view_projects` |
| Minden más művelet (projekt törlése, anonimizálás, feladatsor futtatása, mentések, licenc stb.) | `agh_manage` |

A projektkezelő a Vezérlőpulton és az ajánlatkérés-részleteken látja a csak adminisztrátornak engedett gombokat is (pl. „Személyes adatok anonimizálása”, „Feladatsor futtatása most”), de megnyomásukra „Nincs jogosultságod.” üzenetet kap.

### 1.4 Kivitelezői hozzáférés (`includes/Rest/Access.php`, `contractor_quotes()`)

| Ki | Mit lát a portálon (`/?agh-portal=1`) |
|---|---|
| **E-mailes hivatkozással** (bejelentkezés nélkül) | Csak annak az egy ajánlatkérésnek a projektjét, amelyhez a hivatkozás szól. |
| **Bejelentkezve, `agh_contractor` szerepkörrel** | Csak azokat az ajánlatkéréseket, amelyek értesítése **a felhasználó e-mail-címére** sikeresen kiment. (Az 1.0.0 DB v4 előtti, címzettadat nélküli ajánlatkéréseknél: ha a felhasználó címe jelenleg címzett, az értesített ajánlatkérések.) |
| **Bejelentkezve, `agh_view_projects` jogosultsággal** (projektkezelő, admin) | Minden ajánlatkérést (a legutóbbi 50 listázódik). |

A kivitelezői WordPress-fiók e-mail-címe tehát egyezzen azzal a címmel, amelyre az értesítés megy (`contractor.email` vagy `contractor.extra_emails`).

---

## 2. Konfigurációs figyelmeztetések

Az `Admin::warnings()` (`includes/Admin/Admin.php`) ellenőrzései a Vezérlőpult „Konfigurációs állapot” kártyáján és értesítésként jelennek meg (csak `agh_manage` jogosultsággal). Figyelmeztetés csak a plugin oldalain, **hiba** minden admin oldalon látszik.

| Szint | Feltétel |
|---|---|
| figyelmeztetés | Nincs Magnific API-kulcs |
| figyelmeztetés | Nincs Anthropic API-kulcs (szabályalapú tervező, nincs „AI értelmezés”) |
| figyelmeztetés | A képgenerálás TESZT módban fut |
| **hiba** | Nincs működő képszolgáltató, ezért a generálás le van tiltva (a látogatók azt látják, hogy a képgenerálás nem érhető el); teendő: Magnific-kulcs, vagy próbához a teszt mód engedélyezése és aktív szolgáltatónak választása |
| figyelmeztetés | Nincs érvényes kivitelezői e-mail-cím |
| figyelmeztetés | Nincs adatkezelési tájékoztató URL |
| **hiba** | A védett tárhely nem írható |
| **hiba** | A védett tárhely HTTP-n elérhető (1 órára gyorsítótárazott ellenőrzés) |
| **hiba** | Hiányzik a PHP zip kiterjesztés |
| figyelmeztetés | Hiányzik a PHP GD kiterjesztés |
| figyelmeztetés | Webhook bekapcsolva HTTPS nélkül |
| figyelmeztetés | N publikált tetőfedési termék nincs „ellenőrzött”-nek jelölve (BRAMAC-lista) |

Ezen felül:

- a licenc lejárata előtt 14 nappal figyelmeztetés jelenik meg;
- az AI-szolgáltatók oldal mentése után figyelmeztetés jelenik meg minden olyan mezőnél, amelynek értékét a rendszer nem fogadta el, és gyári értékre állította vissza (nem `https://` szolgáltatói URL, nem relatív végpont-útvonal; `Admin::reset_warnings()`).

Ha a PHP-verzió vagy az mbstring kiterjesztés hiányzik, a plugin nem töltődik be, és csak egy hibaüzenet jelenik meg (`autogrowehome.php`).

---

## 3. Az oldalak

### 3.1 Vezérlőpult

**Állapotkártyák:** Képszolgáltató (név, teszt módban sárga), Anthropic („kapcsolódva” / „szabályalapú tervező”), Mai generálások, Feladatsor (függő feladatok száma), 30 napos kérések, 30 napos ajánlatkérések, Becsült költség (aktuális hónap, a `costs.currency` pénznemben), Licenc (állapot és csomag, vagy „Tulajdonosi mód”).

**Konfigurációs állapot:** a 2. fejezet ellenőrzéseinek listája, vagy „Minden alapbeállítás rendben.”

**Beépítés a weboldalba:** `[autogrowehome]`, `[autogrowehome label="…"]`, `[autogrowehome_button]`, `[autogrowehome_faq]`, `[autogrowehome_pricing]`, `[autogrowehome_portal]` és a `#agh-open` horgony rövid leírása. Részletek: `docs/TELEPITES.md`, 4. fejezet.

**Gyors műveletek:**

| Gomb | Hatás |
|---|---|
| Feladatsor futtatása most | Legfeljebb 20 másodpercig feldolgozza a függő feladatokat, majd kiírja a feldolgozott darabszámot. |
| Szolgáltatók tesztelése | Az AI-szolgáltatók oldalra visz. |
| Tervező megnyitása | Új lapon megnyitja a kezdőlapot `#agh-open` horgonnyal (akkor működik, ha a kezdőlapon jelen van a betöltő). |

**Legutóbbi projektek:** az utolsó 6 projekt névvel, állapottal és dátummal.

### 3.2 Projektek

**Lista:** keresés név vagy azonosító (UUID) részletre; szűrés állapotra (`queued`, `planning`, `rendering`, `ready`, `partial`, `failed`, `cancelled`); oldalanként 25. Oszlopok: Projekt (név, UUID), Állapot (állapot / szakasz), Mentve, Tulajdonos (felhasználó vagy „vendég”), Létrehozva. Az anonimizált (`deleted`) projektek nem jelennek meg.

| Állapot | Jelentés |
|---|---|
| `queued` / `planning` / `rendering` | Sorban áll / koncepciótervezés / képgenerálás |
| `ready` | Mindhárom fő kép elkészült |
| `partial` | Legalább egy fő kép elkészült, de nem mind (vagy a látogató megszakította, miután már volt kész fő kép) |
| `failed` | Egyik fő kép sem készült el, vagy a konfiguráció érvénytelen |
| `cancelled` | A látogató megszakította, mielőtt bármely fő kép elkészült |

**Projekt részletei:**

- Fejléc: név, állapot, UUID, a használt **promptverzió**, a projekt becsült **költsége**.
- **Export (JSON):** letölti a projekt és koncepcióinak adatait (a vendégkulcs-hash és az IP-hash nélkül).
- **Projekt végleges törlése** (`agh_manage`, megerősítést kér): leállítja a függő feladatokat, visszavonja a kivitelezői hozzáféréseket, törli a fájlokat és a projekt adatsorait. **Ajánlatkéréses projektnél a gomb tiltott**, mellette magyarázat és link az ajánlatkérésre: a személyes adatok az ajánlatkérés anonimizálásával vagy GDPR-adattörléssel távolíthatók el (`Repository::delete_project_safe()`).
- **Koncepciókártyák (A, B, C):** cím, „kiválasztva” jelölés, koncepció- és galériaállapot, rövid jellemzés, a tervező forrása (`rules` = szabályalapú, `anthropic:<modell>` = AI), ellentmondás-figyelmeztetések, bélyegképek. Képaláírás: felirat, felbontás (pl. `3840×2160 · 4K`, felskálázottnál jelölve), `TEST` jelzés, szolgáltató, hibaüzenet. A dokumentumok (CSV, JSON, DXF) típuscímkével jelennek meg.
- **Paraméterek:** kategóriánként csoportosított összesítő (az egyedi paraméterekkel együtt), színmintákkal; az ügyfél szöveges instrukciója.
- **Projektnapló:** a projekthez tartozó utolsó 50 naplóbejegyzés.

### 3.3 Ajánlatkérések

**Lista:** oldalanként 25. Oszlopok: Ügyfél (név, e-mail), Település, Állapot (`pending` – feldolgozás alatt, `notified` – minden kivitelező értesítve, `notify_failed` – értesítés végleg nem ment ki mindenkinek), Letöltések (a ZIP letöltéseinek száma), Beérkezett.

**Részletek:**

- Adatok: e-mail, telefon, település, építési helyszín, tervezett kezdés, költségkeret, megjegyzés, beérkezés, értesítés időpontja, letöltésszám.
- **ZIP letöltése** – ha a csomag elkészült (egyszerű permalinkkel is működik).
- **Értesítés újraküldése (új link)** (`agh_view_projects`): ha van csomag, új értesítési kört indít minden címzettnek új hivatkozással (az adott címzett korábbi hivatkozásai visszavonódnak), különben előbb a csomagot építi újra; azonnal legfeljebb 15 s feldolgozást is futtat. Az ügyfél-visszaigazolás nem ismétlődik.
- **Hozzáférés visszavonása** (`agh_view_projects`, megerősítést kér): az ajánlatkérés összes kivitelezői hivatkozását és az azokból nyitott portál-munkameneteket visszavonja; kiírja, hány hivatkozás/munkamenet érintett. Új hivatkozás az „Értesítés újraküldése” gombbal küldhető.
- **Személyes adatok anonimizálása** (`agh_manage`, megerősítést kér): lásd `docs/KONFIGURACIO.md`, 13. fejezet (a projekt is anonimizálódik, ha nem marad hozzá aktív ajánlatkérés).
- **Hozzájárulási és továbbítási napló:** időpont, típus (`terms`, `privacy`, `contact`, `marketing`, `forwarding`), esemény (`given`, `forwarded`, `forwarded_partial`, `forward_failed`), megadva-e, dokumentumverzió és -link.
- Hivatkozás a projektre és a kiválasztott koncepcióra.

**A kivitelezői csomag (ZIP)** (`includes/Quote/PackageBuilder.php`): a csomag-feladat legfeljebb 20 percig vár a kiválasztott koncepció még készülő képeire, utána a meglévőkből épül.

```
AutoGroweHome_<projekt 8 karakter>_<változat>/
├── 00_OLVASSEL.txt           (a csomagoláskor hiányzó képek listájával, ha volt ilyen)
├── 01_Fokep/
├── 02_Kulso_nezetek/
├── 03_Belso_nezetek/
├── 04_Tervvazlatok/          (SVG – csak „floorplans” funkcióval)
└── 05_Dokumentumok/
    ├── parameter-osszesito.html
    ├── parameterek.json
    ├── kepek-metaadatai.csv  (felbontás, szolgáltató, modell, felskálázott, test_image…)
    ├── ugyfel-leirasa.txt
    ├── ugyfel-elerhetosegek.txt
    ├── hozzajarulasi-naplo.json
    └── helyiséglista (CSV), épület-adatmodell (JSON), DXF alaprajz (csak „export_advanced” funkcióval),
        valamint az „agh_cad_exporters” szűrővel regisztrált további exportok
```

`package_full` funkció nélkül a látványtervek közül csak a fő kép, az elöl- és a hátulnézet kerül a csomagba (a többi nézet ilyenkor a hiányzó képek listáján sem szerepel). A csomag személyes adatokat tartalmaz; a `contractor.retention_days` után a napi takarítás törli.

### 3.4 Statisztika

- **Időszak:** „Tól” / „Ig” dátum (alapértelmezés: az utolsó 30 nap), **Frissítés**.
- **CSV export:** csak `export_advanced` funkcióval (Agency) aktív; enélkül a gomb tiltott, „A CSV-export a bővített exportálás funkcióval (Agency csomag) érhető el.” jelzéssel. A fájl: UTF-8 BOM, pontosvessző elválasztó, oszlopok `day;metric;dimension;value`; bontássorok csak `stats_advanced` mellett. A képletinjekció ellen a veszélyes kezdőkarakterű cellák aposztrófot kapnak.
- **Kártyák:** popupmegnyitás, tervezés indítása, generálási kérés, elkészült koncepció, koncepció kiválasztva, mentett projekt, ajánlatkérés, ajánlatkérési konverzió (%), sikeres / sikertelen kép, képsikeresség (%), átlagos generálási idő, csomagletöltés, becsült költség, költség / koncepció, költség / ajánlatkérés, limit miatt elutasítva.
- **Napi trend:** generálás, popup, ajánlatkérés vonaldiagram.
- **Részletes bontások** (`stats_advanced`, Professional+; a szerver is csak ekkor adja ki): házstílusok, tetőtípusok, alapterület-sávok, legnépszerűbb paraméterek, hibaokok, költség szolgáltatónként, szolgáltatói sikeres/hibás hívás, limit okok. Nélküle tájékoztató szöveg jelenik meg.

Minden adat összesített, személyazonosításra nem alkalmas.

### 3.5 AI-szolgáltatók

- **Kapcsolat teszt:** Magnific, Anthropic, Teszt mód (GD) gombok; az eredmény a gombok alatt jelenik meg. Részletek: `docs/KONFIGURACIO.md`, 3.3.
- **Beállítási űrlap** négy szakasszal: Anthropic API, Képgenerálás, Magnific API, Költségbecslés és költségkeret. A szolgáltatói URL-ek csak `https://` címek, a végpontok csak relatív útvonalak lehetnek; érvénytelen értéknél mentés után figyelmeztetés jelenik meg, és a gyári érték marad. A „Webhook használata” súgója a teljes, titkos tokent tartalmazó webhook URL-t mutatja (csak `agh_manage` jogosultsággal látható oldalon) – ne tedd közzé; a plugin automatikusan átadja a Magnificnak. A Magnific-szakaszban kapcsolható a „Tartalomszűrés (NSFW)” is (`docs/KONFIGURACIO.md`, 5.4).
- **Szolgáltatói adatkezelés:** tájékoztatás arról, milyen adat megy az AI-szolgáltatókhoz, és javaslat a kulcsok `wp-config.php`-ban való megadására (`AGH_MAGNIFIC_API_KEY`, `AGH_ANTHROPIC_API_KEY`).

### 3.6 Promptmotor

Csak `prompt_editor` funkcióval (Professional+) szerkeszthető; enélkül a gyári promptok aktívak, és az oldal ezt jelzi.

**Szerkesztő (bal oldal)** – a fejléc mutatja, melyik verzióból indulsz („Szerkesztés – vN „…” alapján”):

| Szakasz | Tartalom |
|---|---|
| **Modulok** | 19 szöveges modul: `role`, `style`, `concept`, `massing`, `dimensions`, `roof`, `facade`, `openings`, `interiors`, `materials`, `garden`, `camera`, `lighting`, `output`, `negative`, `variants`, `user`, `consistency`, `extras` (az egyedi paraméterek helye: `{custom_params}`) |
| **Nézetenkénti szabályok** | 9 nézet (`hero`, `front`, `back`, `left`, `right`, `aerial`, `garden`, `evening`, `interior`): Név, Szabály (a prompt eleje), Modulok sorrendje (vesszővel; csak létező modulnév marad meg) |
| **Stílusonkénti felülírások** | Az „Építészeti stílus” paraméter minden értékéhez lenyitható blokk; a `style`, `concept`, `facade`, `roof`, `garden`, `interiors`, `negative` modul szövege stílusonként felülírható (üresen az alap modul érvényes) |

- **Verzió megnevezése** (üresen a dátum), **Aktiválás mentés után** (alapból bejelölve), **Mentés új verzióként**. A mentés mindig új verziót hoz létre.
- Csak egyszerű szöveg és `{változó}` használható; HTML-t a rendszer eltávolít, modulonként legfeljebb 4000 karakter (`includes/Prompt/PromptEngine.php`).
- **Prompthossz:** a kész prompt legfeljebb 3900 karakter (`PromptEngine::MAX_PROMPT`, a plugin saját óvatos határa). Túl hosszú promptnál előbb a kevésbé fontos modulok rövidülnek (kert, változatleírás, stílus, fény, kamera stb.), az ügyfél szabad szövege (`user` modul) utoljára, mondathatáron; a negatív lista mindig egészben a végén marad. A 600 karakternél hosszabb szabad szöveg is mondathatáron vágódik.
- **Egyedi paraméterek:** ha egy nézet moduljai között nincs `{custom_params}`-t tartalmazó modul (pl. az `extras` előtti régi promptverzióknál), a gyári `extras` szöveg automatikusan az `output` modul elé kerül.
- **Gyári frissítés:** ha az aktív verzió egy érintetlen gyári alapértelmezés, a plugin frissítéskor automatikusan új gyári verzióra vált; szerkesztett verzióhoz nem nyúl.

**Előnézet (jobb oldal):**

- Nézet és verzió kiválasztása (★ = aktív), **Előnézet**: összeállítja a promptot az alapértelmezett paraméterekkel és a szabályalapú „A” koncepcióval; kiírja a karakterszámot és a negatív részt. Költség nélkül.
- **Tesztgenerálás** (megerősítést kér): **valódi** generálást indít a kiválasztott verzióval (szolgáltatói költség!), „Prompt test vN” nevű projektként; az eredmény a Projektek közt jelenik meg. Indításkor nem vizsgálja a napi keretet és a költségkeretet, a költsége viszont a költségnaplóba kerül (`includes/Rest/RestController.php`, `admin_prompt_test()`).
- **Változók:** a modulokban használható 38 változó listája (pl. `{style}`, `{net_area}`, `{roof_product}`, `{concept_description}`, `{room_details}`, `{custom_params}`). Fejlesztők az `agh_prompt_variables` szűrővel bővíthetik.

**Verziók:** verziószám, aktív jelölés, megnevezés, dátum, hány projekt használta. Műveletek: **Betöltés** (szerkesztőbe), **Aktiválás**, **Összehasonlítás** (az adott verzió `hero`, `front` és `interior` promptjának előnézete az oldal alján). **Gyári promptok visszaállítása (új verzióként)** – a gyári modulokat új, aktív verzióként menti.

Minden projekt rögzíti, melyik promptverzióval készült; az újragenerálás is ezt használja.

### 3.7 Paraméterek

**Új / egyedi paraméter** (`custom_params` funkció, Professional+; a mentés kódból is csak ezzel a funkcióval lehetséges):

| Mező | Megjegyzés |
|---|---|
| Belső azonosító | `a-z`, `0-9`, `_`; `x_` előtaggal tárolódik; beépített azonosító nem használható |
| Megjelenítési név, Kategória, Adattípus | Típusok: `text`, `textarea`, `integer`, `number`, `range`, `select`, `multiselect`, `toggle`, `color`, `cards` |
| Alapérték, Egység, Minimum, Maximum, Lépésköz, Rendezés | Többválasztósnál az alapérték „a, b” formában; a min./max./lépésköz számtípusoknál érvényes (alapértelmezés 0 / 100 / 1); rendezés alapértéke 1000 |
| Validációs minta | Reguláris kifejezés, csak `text` típusnál; max. 200 karakter |
| Megjelenítési feltétel | mező + művelet (`=`, `!=`, `>`, `<`, `in`) + érték; `in` esetén lista „a, b” formában |
| Súgó | |
| Választható értékek | Soronként `érték|felirat|angol prompt` (`select`, `multiselect`, `cards` típusnál kötelező, legalább egy). Ha a harmadik rész hiányzik, a felirat a promptszöveg; ha üres (`érték|felirat|`), az opció nem kerül a promptba. |
| Promptba kerülő szöveg | Angolul; csak a `{value}`, `{label}`, `{color}` helyőrző marad meg; max. 300 karakter. Üresen: választós típusnál a kiválasztott opció(k) promptszövege kerül be; más típusnál a paraméter nem kerül a promptba. |
| Kötelező, Haladó | Jelölőnégyzetek |
| Fordítások | A megjelenítési név nyelvenként (a választható értékek feliratai nem fordíthatók) |

Az egyedi paraméter megjelenik a tervezőben, validálódik, bekerül a projekt paraméter-összesítőjébe, a kivitelezői csomagba, az Anthropic-tervezőnek átadott adatcsomagba és a **képpromptokba** a `{custom_params}` változón keresztül (`PromptEngine::custom_phrases()`): a belső kategóriák (Helyiségek, Belső tér, Konyha, Fürdőszoba, Burkolatok) csak belső képekhez, a külső kategóriák (Épületforma, Tető, Homlokzat, Nyílászárók, Kert és környezet, Gépészet és energia) csak külső képekhez, a többi mindkettőhöz kerül. Csak a látható, nem rejtett mezők számítanak. `custom_params` funkció nélkül (pl. csomagváltás után) a tárolt egyedi paraméterek nem töltődnek be sehova (tervező, validáció, tervezés, prompt), de az adatbázisban megmaradnak.

Alatta az **Egyedi paraméterek** listája: Szerkesztés, Törlés (megerősítéssel).

**Beépített paraméterek testreszabása** (minden csomagban): kereshető táblázat a 128 beépített paraméterrel. Oszlopok: Paraméter (kategória, felirat, azonosító; „Pro” jelölés, ha a jelenlegi csomagban zárolt), **Rejtett** (kötelező mezőnél tiltva), **Haladó**, **Felirat**, **Súgó**, **Alapérték** (többválasztósnál vesszővel; a helyiséglistánál nem állítható), **Sorrend**. A „Mentés” az egész táblázatot menti (`agh_param_overrides`). A „Pro” jelölésű (zárolt) paraméterek `full_params` funkció nélkül mindenképp rejtettek.

### 3.8 Katalógus

Fülek: **Tetőfedési márka**, **Tetőfedési termék**, **Anyag**, **Színkollekció**, **Építészeti stíluscsomag**, **Belsőépítészeti kollekció**, **Előre beállított csomag** (`includes/Catalog/Catalog.php`, `TYPES`).

**Lista:** név (színmintával), azonosító (slug), állapot, Szerkesztés / Törlés. Tetőfedési terméknél „ellenőrzött” (zöld) vagy „ellenőrizendő” (sárga) jelölés; a BRAMAC márkánál „kötelező” jelölés és „nem törölhető” felirat.

**Űrlap (Új elem / Elem szerkesztése):** Név, Azonosító (üresen a névből képződik; szerkesztéskor nem módosítható), típusfüggő mezők, Előnézeti / referenciakép (médiatár), Állapot (Publikált / Rejtett), Sorrend. Mentéskor az űrlapon nem szereplő adatkulcsok (pl. `required`, `recommended`, `note`) megmaradnak (`Catalog::save()`).

| Típus | Típusfüggő mezők |
|---|---|
| Tetőfedési márka | Prompt leírás (angol), URL |
| Tetőfedési termék | Márka azonosító, Termékcsalád, Szín (katalógus szerint), Szín angolul (promptba), Színminta HEX (közelítés), Prompt leírás (angol), Forrás URL, **Ellenőrzött** |
| Anyag | Csoport (facade/floor/…), HEX, Prompt leírás (angol) |
| Színkollekció | Színek (vesszővel, `#RRGGBB`) |
| Építészeti stíluscsomag | Vizuális irány (angol, promptba), Leírás, Paraméterkészlet (JSON) |
| Belsőépítészeti kollekció | Leírás, Prompt leírás (angol), Paraméterértékek (JSON) |
| Előre beállított csomag | Leírás, Paraméterértékek (JSON) |

A JSON-mezőkben érvénytelen JSON **üres** értékként mentődik – mentés után ellenőrizd.

**BRAMAC – kötelező márka.** A specifikáció szerint a BRAMAC (`Catalog::SPEC_ROOF_BRAND`) mindig kötelező és publikált: mentéskor a `required` jelölés és a publikált állapot visszaáll, az állapotválasztó tiltott („A specifikáció szerint kötelező márka mindig publikált, nem rejthető el és nem törölhető.”), törlése pedig hibaüzenettel elutasul (`Catalog::delete()`, `Catalog::required_brand()`). A tervező magastetőnél csak ezt a márkát kínálja, és ha a látogató nem választ terméket (vagy más márkájút), a rendszer automatikusan kiválaszt egyet: a katalógusban `recommended` (vagy `default`) jelölésű terméket, ennek hiányában a tetőszínhez legközelebbi színmintájút, és ezt információként jelzi (`includes/Params/Validator.php`). Lapostetőnél nem érvényes. Az automatikusan választott termék a látogató összegzésében és a mezőben is látszik; a látogató saját választását nem írja felül. A `recommended` jelölésnek nincs admin mezője.


**BRAMAC-lista:** az előre feltöltött 29 BRAMAC termék–szín egy magyar viszonteladó nyilvános listájából származik (forrás a tételnél: `https://feketeteto.hu/bramac/`), `verified` jelölés nélkül; a HEX színminták csak megjelenítési közelítések. Az oldal is figyelmeztet: vesd össze a hivatalos BRAMAC-katalógussal, javítsd, majd jelöld „Ellenőrzött”-nek. Amíg publikált, nem ellenőrzött termék van, a Vezérlőpult figyelmeztet; a tervezőben az ilyen terméknél „Gyártói ellenőrzésre vár” jelzés látszik.

### 3.9 Arculat és elrendezés

- `branding_advanced` funkció nélkül tájékoztató: „Starter csomagban a logó, a név és a fő szín módosítható; a haladó arculati beállítások a Professional csomagtól érvényesülnek.” Ez a kódban is így működik: enélkül a tervezőben csak a logó, a név, a fő szín és az elrendezés érvényesül (`docs/KONFIGURACIO.md`, 5.11).
- **Űrlap:** Termék és megjelenés (név, készítő, indítógomb, lebegő gomb, alapértelmezett mód, alapnyelv, választható nyelvek), Arculat (logó, ikon, háttérkép, szövegek, 7 szín, betűtípusok, lekerekítés, üveghatás, árnyék, animáció, téma), Popup elrendezés (panelsorrend, szélességek, műveleti sáv, gyorsbemutató).
- **Élő előnézet:** mintakártya gombokkal és állapotszínekkel.
- **Korábbi designverziók:** minden mentés előtt az előző állapot ide kerül (utolsó 10); **Visszaállítás** (megerősítéssel) – a visszaállítás előtti állapot is mentődik.

### 3.10 Limitek és hozzáférés

- Fejléc: „Aktuális napi időszak: … · effektív IP-limit (csomaggal együtt): N · saját IP ma: M”.
- **Űrlap:** Generálási limitek, Galéria és képszám (benne a koncepció-újragenerálás napi kerete és az „Egyszerre futó háttérfeladatok” – `max_parallel_jobs`), Ügyféloldali hozzáférés, Feladatsor (`queue_tick_on_poll`). Kulcsok és logika: `docs/KONFIGURACIO.md`, 5.6, 5.7 és 6. fejezet.

### 3.11 Kivitelező és e-mail

- **Teszt e-mail küldése magamnak:** a bejelentkezett felhasználó címére; hibánál „A wp_mail() hibát jelzett. Ellenőrizd az SMTP beállításokat.”
- A kivitelezői portál címe (`/?agh-portal=1`) és tájékoztatás: a token csak az URL `#` részében utazik; „AutoGroweHome kivitelező” szerepkörrel bejelentkezve is elérhető (1.4).
- **Űrlap:** Kivitelező, E-mail-sablonok (a fejléc felsorolja a használható változókat). A „Kivitelező neve” a levél megszólítása (`{contractor_name}`).

### 3.12 Jogi és GDPR

- **GDPR eszközök:** **Adatexport** és **Adattörlés** (a WordPress adatvédelmi eszközeire visz), **Adatmegőrzési takarítás futtatása most**.
- Javasolt adatkezelési szövegrész: a WordPress adatvédelmi útmutatójában (sablon, szakértői ellenőrzés szükséges).
- **Űrlap:** Dokumentumok és hozzájárulások, Adatmegőrzés, Eltávolítás („Minden adat törlése a plugin eltávolításakor”). Itt kapcsolható a „Böngészőazonosító (User-Agent) rögzítése” (`legal.store_user_agent`, alapból ki).

### 3.13 Licenc

**Licencközpont:**

- Tulajdonosi módban zöld „Tulajdonosi mód (AGH_OWNER_MODE)” jelölés.
- Táblázat: Állapot (Aktív, Lejárt, Érvénytelen, Nincs aktiválva, Elérte a weboldal-limitet, Szerver nem elérhető (türelmi idő)), Csomag, Effektív csomag, Lejárat, Weboldalak (használt / engedélyezett), Frissítési jogosultság, Utolsó ellenőrzés, Utolsó hiba, Példányazonosító, API-konfiguráció (Magnific ✓/–, Anthropic ✓/–).
- Licenckulcs mező + **Aktiválás**, **Ellenőrzés**, **Deaktiválás** (megerősítéssel).

**Licencszerver:** Szerver URL (HTTPS), Szerver nyilvános kulcsa (Ed25519, base64); konstanssal megadva csak olvasható. Referencia-szerver: `tools/license-server/`.

**Csomagok (Starter / Professional / Agency):**

- **Ügyféloldalon** teljesen csak olvasható táblázat a beépített csomagokról (név, célközönség és ár is a beépített): a 19 funkció (✓/–), a limitek (weboldalak, max. napi IP-limit, max. külső/belső nézet, max. felbontás) és az árak; az aktív csomag „aktív” jelölést kap. Megjegyzés: „A csomagok funkciói és limitjei rögzítettek; a csomagmátrix csak a plugin tulajdonosi példányán (AGH_OWNER_MODE) szerkeszthető.”
- **Tulajdonosi módban** szerkeszthető táblázat: csomagnév, célközönség, funkciók, limitek (max. külső nézet 1–8, max. belső nézet 0–20), max. felbontás, havi és éves ár (szöveg) és fizetési link (csak `https://`); **Csomagok mentése**. Ebből épül az `[autogrowehome_pricing]` oldal; a „Megrendelés” gomb csak kitöltött linknél jelenik meg. A plugin kártyaadatot nem kezel.

### 3.14 Súgó és rendszer

**Rendszerállapot:** PHP, WordPress, „PHP-kiterjesztés: mbstring / sodium / gd / zip / json” (✓ rendben / ✗ hiányzik), WP-Cron („kikapcsolva (valódi cron szükséges)”, ha `DISABLE_WP_CRON`), Tárhely írható, Tárhely nyilvános? (élő ellenőrzés), Adatbázis-verzió (jelenleg 5), Függő feladatok.

**Nyelvi fájlok:** a 16 nyelv jelvénye (✓ = van `.mo` fájl).

**Napló:** az utolsó 100 bejegyzés (idő, szint, csatorna, üzenet); **Napló törlése** (megerősítéssel, a teljes naplótáblát üríti).

**Gyorsbemutató lépései és GYIK:** a szerkesztő fölötti tájékoztatás szerint a gyári szöveg a látogató nyelvén jelenik meg (fordítható), a mentett egyedi szöveg egynyelvű – minden nyelven pontosan így látszik.

- Gyorsbemutató: ikon, cím, szöveg soronként; **+ Lépés**, × törlés.
- GYIK: kategória, kérdés, válasz soronként; **+ Kérdés**, × törlés.
- **Alapértelmezés visszaállítása** (a fordított gyári szövegekre), **Súgótartalom mentése**. A GYIK az `[autogrowehome_faq]` shortcode-dal jeleníthető meg.

---

## 4. Feladatsor kezelése

Külön feladatsor-oldal nincs. Eszközök:

| Hol | Mit látsz / mit tehetsz |
|---|---|
| Vezérlőpult | „Feladatsor: N függő feladat”; „Feladatsor futtatása most” (20 s) |
| Súgó és rendszer | „Függő feladatok”, „WP-Cron” sor |
| Projekt részletei | Képek állapota és hibaüzenete; projektnapló |
| WP-CLI | `wp agh queue run [--seconds=50]` (vagy `wp agh queue`), `wp agh status` |

Feladattípusok: `plan` (koncepciótervezés), `render` (kép), `upscale` (felskálázás), `package` (ZIP), `notify` (e-mail). Átmeneti hibánál a feladat exponenciálisan növekvő várakozással (max. 5 perc) újrapróbálkozik; a végleg sikertelen feladat a naplóba kerül (`includes/Generation/JobQueue.php`). Végleges (nem átmeneti) képhiba esetén, ha be van állítva tartalék szolgáltató, a rendszer arra vált.

Webhelyszinten egyszerre legfeljebb `limits.max_parallel_jobs` feladat fut (alapérték 4; Limitek és hozzáférés → „Egyszerre futó háttérfeladatok”, 0–50, 0 = nincs korlát). Egy feladat zárja alapértékekkel 513 s (mérve; a beállított időkorlátokból számolódik), a zárat csak a birtokosa írhatja felül.

---

## 5. Naplók

- Csatornák: `admin` (beállítás mentése, projekttörlés, hozzáférés-visszavonás), `queue`, `render`, `package`, `mail`, `planner`, `portal`, `license`, `gdpr`, `cad`, `rest`.
- A napló nem tartalmaz API-kulcsot, jelszót, tokent vagy képadatot: a `Logger` az üzenetben és a kontextusban is kitakarja ezeket (`includes/Support/Logger.php`).
- Megőrzés: `legal.retention_logs_days` (alapértelmezés 60 nap).

---

## 6. Gyakori feladatok röviden

| Feladat | Lépések |
|---|---|
| Kivitelező nem kapott e-mailt | Ajánlatkérések → az ajánlatkérés → állapot (`notify_failed`?), napló (`forwarded_partial`?) → Súgó és rendszer → Napló (`mail` csatorna) → Kivitelező és e-mail → Teszt e-mail → „Értesítés újraküldése (új link)”. |
| Lejárt a kivitelezői hivatkozás | „Értesítés újraküldése (új link)”. |
| Kivitelező hozzáférését azonnal meg kell vonni | Ajánlatkérés → „Hozzáférés visszavonása”. |
| Ügyfél kéri az adatai törlését | Ajánlatkérés → „Személyes adatok anonimizálása”, vagy Eszközök → Személyes adatok törlése (e-mail-cím alapján). |
| Ajánlatkéréses projektet törölnék | Nem lehetséges; anonimizáld az ajánlatkérést (a projekt is anonimizálódik). |
| Prompt módosítása biztonságosan | Promptmotor → szerkesztés → mentés **aktiválás nélkül** → Előnézet / Összehasonlítás → Tesztgenerálás → Aktiválás. |
| Tetőtermék javítása | Katalógus → Tetőfedési termék → Szerkesztés → adatok → „Ellenőrzött” → Mentés. |
| Arculati hiba visszavonása | Arculat és elrendezés → Korábbi designverziók → Visszaállítás. |
