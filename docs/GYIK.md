# AutoGroweHome – Gyakran ismételt kérdések

*AutoGroweHome 1.0.0. Két rész: **A) látogatóknak**, **B) üzemeltetőknek (weboldal-adminoknak)**.*

Az **(app)** jelölésű kérdések az alkalmazásba épített GYIK alapértelmezett tartalmából valók (`includes/Frontend/Help.php` → `default_faq()`); a válaszokat a kód alapján pontosítottuk és kiegészítettük. Az alkalmazásbeli GYIK-et az üzemeltető az **Admin → Súgó és rendszer** oldalon szerkesztheti; a `[autogrowehome_faq]` shortcode kereshető, kategóriákra szűrhető, lenyíló listaként jeleníti meg (`templates/faq.php`).

Ami élesben nincs ellenőrizve, azt kiírjuk.

---

## A) Látogatóknak

### Általános

**Mi ez a háztervező?** (app)
Egy MI-alapú eszköz, amely a megadott paraméterekből három különböző házkoncepciót készít látványtervekkel és koncepcionális tervvázlatokkal. A kiválasztott házhoz teljes galéria készül; a projektet elmentheted, és ajánlatot kérhetsz egy kivitelezőtől. Részletes leírás: [FELHASZNALOI-UTMUTATO.md](FELHASZNALOI-UTMUTATO.md).

**Kell hozzá építészeti tudás?** (app)
Nem. Az **Egyszerű** mód csak a legfontosabb kérdéseket teszi fel; a helyiségprogramot és a többi értéket a rendszer javasolja. A **Részletes** mód minden beállítást megmutat.

**Kell fizetnem érte?**
A tervezőben nincs fizetési lépés. A használatot a napi generálási keret korlátozza.

### Tervezés

**Engedélyezési tervnek használhatom a vázlatokat?** (app)
Nem. A tervvázlatok strukturált adatokból, determinisztikusan generált koncepciótervek (SVG); a látványtervek MI-vel készült koncepcióképek. Engedélyezéshez és kivitelezéshez szakági tervező szükséges.

**Miért korlátozott a napi generálások száma?** (app)
A képgenerálás valódi költséggel jár. **1 generálás = 3 koncepció = 1 egység**. Alapbeállításban IP-címenként napi 3 egység használható (az üzemeltető módosíthatja). Ezen felül 10 perces időablakonként legfeljebb 2 indítás és egyszerre egy futó generálás engedélyezett IP-címenként; IPv6-címnél a /64-es hálózat számít egy címnek (`includes/RateLimit/RateLimiter.php`, `includes/Support/Ip.php`, `includes/Support/Settings.php`). Egy kiválasztott ház **újragenerálása** külön napi keretből fogy (alapbeállítás: 2 / nap).

**Mennyi ideig tart a generálás?** (app)
A külső szolgáltatók terhelésétől függ, pontos időt nem tudunk ígérni (élesben nem mértük). A folyamatot az Összegzés panel lépésenként mutatja. Közben bezárhatod az ablakot: a feldolgozás a szerveren folytatódik, a projektet később a **Projektjeim** alatt megnyithatod – vendégként ugyanebben a böngészőben.

**Ugyanaz a ház szerepel minden képen?** (app)
A rendszer mindent megtesz az egységességért: koncepciónként rögzített épület-adatmodell készül, a galéria külső nézeteihez a fő kép **referenciaképként** megy a képgenerálóhoz, az elöl-, hátul- és oldalnézetekhez pedig egy, a tervvázlatból renderelt tömegvázlat is (geometriai vezetés), és minden nézet leírása ugyanazt a házat írja le. Az MI-képeken ennek ellenére kisebb eltérések előfordulhatnak. A belső képek referenciakép nélkül készülnek.

**Miért nem indult új generálás, amikor újra megnyomtam a gombot?**
Ha ugyanazzal a beállítással (a projektnevet nem számítva) 72 órán belül már készült terved, a rendszer a meglévőt nyitja meg, és nem von le keretet: „Ezzel a beállítással már készült terv – azt nyitottuk meg (nem vont le keretet).” Változtass legalább egy beállításon az új generáláshoz.

**Mit jelent a felbontás-címke (pl. „2752×1536 · 2.5K”)?**
A kép tényleges pixelméretét. **4K-nak csak a legalább 3840 px-es kép jelölődik**; 2560 px-től „2.5K”, 1920 px-től „FHD”, alatta „HD”. A felskálázott kép „(felskálázott)” jelölést kap (`includes/Projects/Repository.php`, `resolution_label()`).

**Miért „Teszt kép” van a képen?**
Az üzemeltető még nem kapcsolta be az éles MI-képgenerálást. A teszt módban készült képek helyi tömegvázlatok, nem MI-látványtervek, és mindenhol jelölve vannak.

**Hogyan kapok belső képeket?**
A **Helyiségek** kategóriában a helyiségenkénti **Látványterv** kapcsolóval. Belső kép a kiválasztott házhoz készül, legfeljebb annyi helyiségről, amennyit az üzemeltető engedélyez (alapbeállítás: 4).

**Letölthetem a képeket?**
Alapbeállításban a kiválasztott ház **fő látványképét** teljes méretben (**Fő látványkép letöltése**). A többi képet előnézetben látod. Az üzemeltető ezt szűkítheti vagy kiterjesztheti.

**Piros hibaüzenet miatt nem indul a generálás. Mit tegyek?**
Kattints az Összegzés panelen az üzenetre – a tervező a hibás mezőhöz ugrik. A blokkoló hibák listája: [FELHASZNALOI-UTMUTATO.md, 7. pont](FELHASZNALOI-UTMUTATO.md#7-ellenőrzés-és-üzenetek).

**Elfogyott a napi keret, de a generálás sikertelen volt. Visszakapom?**
Igen, ha egyetlen koncepcióképet sem sikerült elkészíteni, és nem keletkezett rögzített szolgáltatói költség. A **Leállítás** gombbal megszakított generálásért bármely fázisban visszajár az egység (egyszer), ha addig sem költség, sem kész kép nem keletkezett, és épp nem fut feladat (`JobQueue::cancel_project()`, `Pipeline::cost_free()`).

**Mi történik, ha leállítom a generálást?**
A sorban álló képek nem készülnek el. Ha még egy fő kép sem készült el, a projekt „leállítva” állapotba kerül, és a tervező ezt írja: „A generálás megszakítva.” – új generálással újrakezdheted, a beállításaid megmaradnak. Ha már volt kész fő kép, a projekt „részben kész”, a kész koncepciók választhatók.

### Adatvédelem

**Milyen adatokat tárolunk?** (app)
A ház paramétereit, a szabad szöveges leírást és a generált képeket. Személyes adatot csak ajánlatkéréskor kérünk, kifejezett hozzájárulással. Az IP-címet csak kulcsolt kivonatként (hash) tároljuk, a napi keret és a visszaélés elleni védelem céljából.
Kiegészítés a kód alapján:
- vendégként egy `agh_gs` nevű, HttpOnly süti köti a projekteket a böngésződhöz; minden használatkor megújul, és alapbeállítás szerint 180 napig érvényes (a projektek megőrzési idejéhez igazodik);
- ha az üzemeltető bekapcsolja, ajánlatkéréskor a böngésződ azonosító szövege (user agent) is bekerül a hozzájárulási naplóba (alapból ki van kapcsolva; a kivitelezőhöz nem jut el);
- a böngésződ helyi tárhelyén marad a félkész beállításod, a téma (világos/sötét), a saját presetek és a gyorsbemutató állapota;
- bejelentkezve a saját presetjeid a fiókodhoz is mentődnek.

**Átadjuk-e az adataimat AI-szolgáltatónak?** (app)
A ház paraméterei és a szabad szöveges leírás a képgenerálás (Magnific) és – ha az üzemeltető beállította – az értelmezés és koncepciótervezés (Anthropic) céljából a szolgáltatókhoz kerülnek. A személyes elérhetőségeid (név, e-mail, telefon) nem. **Ezért ne írj személyes adatot a szabad szöveges leírásba.**

**Meddig őrzik meg az adataimat?**
Alapbeállítás (az üzemeltető módosíthatja, `includes/Privacy/Privacy.php`):
- nem mentett projekt: 30 nap, mentett projekt: 180 nap az utolsó módosítástól; ajánlatkéréshez tartozó projektet az automatikus törlés nem érint;
- ajánlatkérés személyes adatai: 730 nap után anonimizálódnak – ilyenkor a hozzá tartozó projekt személyes szabad szövegei, képei, fájljai és koncepciói is törlődnek, ha más aktív ajánlatkérés nem hivatkozik rá;
- kivitelezői ZIP-csomag: 180 nap után törlődik.

**Hogyan törölhetem az adataimat?**
- Saját projektet a **Projektjeim** listában a kuka ikonnal törölhetsz (megerősítés után a képek és a tervek véglegesen törlődnek).
- Ajánlatkéréshez tartozó projekt a felületen nem törölhető („Nem törölhető: ajánlatkérés tartozik hozzá.”). Ilyenkor fordulj az üzemeltetőhöz (adatkezelőhöz): ő az ajánlatkérést anonimizálhatja (ez a projekt személyes tartalmát is törli), a WordPress beépített adatexportáló/-törlő eszközével pedig az e-mail-címedhez tartozó adatokat kiadhatja vagy törölheti.
- Az e-mail-cím alapú export és törlés az ajánlatkérésekre és a fiókhoz kötött projektekre terjed ki. Ajánlatkérés nélküli vendégprojekt nem kereshető e-mail-cím alapján; azt a **Projektjeim** listában magad törölheted.

### Ajánlatkérés

**Mi történik ajánlatkérés után?** (app)
A kivitelező e-mailben értesítést kap egy biztonságos, időkorlátos hivatkozással (alapbeállítás: 168 óra) a tervcsomaghoz, és felveszi veled a kapcsolatot. Ha az üzemeltető bekapcsolta (alapból be van), visszaigazoló e-mailt kapsz. A tényleges e-mail-kézbesítés élesben nincs ellenőrizve.

**Kötelező a marketing-hozzájárulás?** (app)
Nem. Opcionális, és nem feltétele az ajánlatkérésnek. Az összes hozzájárulási jelölőnégyzet üresen indul.

**Mi a különbség a mentés és az ajánlatkérés között?**
A **Mentés** csak megőrzi a projektet (név megadásával), személyes adat és hozzájárulás nélkül. Az **Ajánlatkérés** külön művelet: személyes adatokat és külön hozzájárulásokat kér, és továbbítja a tervcsomagot a kivitelezőnek. Az ajánlatkérés a projektet is mentettnek jelöli.

**Mit kap a kivitelező?**
Egy ZIP-csomagot a kiválasztott ház fő képével, külső és belső nézeteivel, tervvázlataival, paraméter-összesítővel, helyiséglistával, épület-adatmodellel, a képek metaadataival, a leírásoddal, az elérhetőségeiddel és a hozzájárulási naplóval (`includes/Quote/PackageBuilder.php`). A „Részletes kivitelezői csomag” funkció (`package_full`, Professional csomagtól) nélkül a ZIP-be a képek közül csak a fő kép, az elöl- és a hátulnézet kerül. A csomag megvárja a kiválasztott ház galériáját (legfeljebb 20 percig, `QuoteService::PACKAGE_MAX_WAIT`); ha addig sem készül el minden kép, a meglévőkből áll össze, és a csomag leírása (`00_OLVASSEL.txt`) felsorolja a hiányzó képeket – a csomagba amúgy sem kerülő nézeteket nem.

**Miért nem tudom azonnal elküldeni az ajánlatkérő űrlapot?**
Az űrlap megnyitáskor egy védelmi kulcsot kér a szervertől; amíg ez meg nem érkezik, a küldés gomb nem kattintható. A beküldés a megnyitás után 3 másodperc és 2 óra között fogadható el. Ha a kulcs nem érkezik meg („Az űrlap előkészítése nem sikerült.”), az **Újra** gombbal kérhetsz újat; lejárt űrlapnál nyisd meg újra.

---

## B) Üzemeltetőknek

Részletes beállítási leírás: [ADMIN-KEZIKONYV.md](ADMIN-KEZIKONYV.md), telepítés: [TELEPITES.md](TELEPITES.md).

### Beállítás

**Hol adom meg az API-kulcsokat, és hogyan tárolja őket a plugin?**
**Admin → AI-szolgáltatók**. A kulcsok titkosítva kerülnek az adatbázisba (`includes/Support/Secrets.php`: sodium `secretbox`, `s1:` formátum; ennek hiányában AES-256-CBC + HMAC külön titkosító és hitelesítő kulccsal, `o2:` formátum – a régebbi `o1:` formátumú vagy régi kulccsal titkosított értékek olvasáskor, illetve a v5-ös adatbázis-frissítéskor egyszer újratitkosulnak). A titkosítókulcs – ha megadod – **kizárólag** az `AGH_SECRET_SALT` konstansból származik, különben a WordPress `auth` és `secure_auth` saltjaiból. A felület csak maszkolt értéket mutat, REST-válaszban kulcs nem jelenik meg, a naplóból a kulcsszerű értékek ki vannak takarva (`includes/Support/Logger.php`).
A kód javasolt alternatívája a `wp-config.php` konstans (ilyenkor a konstans élvez elsőbbséget):

```php
define( 'AGH_MAGNIFIC_API_KEY', '...' );
define( 'AGH_ANTHROPIC_API_KEY', '...' );
```

**Elvesznek a kulcsok, ha megváltoznak a WordPress saltok?**
- **`AGH_SECRET_SALT` megadásával nem:** a kulcs ilyenkor csak ebből a konstansból képződik (`Secrets::key()`), a WP-saltok cseréje nem érinti. Ha a konstanst utólag adod meg, a korábban tárolt értékek továbbra is olvashatók, és olvasáskor az új kulcsra titkosulnak át (amíg a WP-saltok nem változtak).
- **`AGH_SECRET_SALT` nélkül igen:** a kulcs a WP `auth`/`secure_auth` saltjaiból képződik, ezért salt-csere után a tárolt kulcsok nem fejthetők vissza, üresnek látszanak – újra meg kell adni őket.
- Maga az `AGH_SECRET_SALT` cseréje is olvashatatlanná teszi a tárolt kulcsokat.
- A `wp-config.php`-ban konstansként megadott API-kulcsokat egyik eset sem érinti.

**Hogyan ellenőrzöm a kulcsot költség nélkül?**
A **Kapcsolat teszt** gombbal. Magnific: egy nem létező feladat lekérdezése (a 200/400/404 válasz hitelesített kulcsot jelent, a 401/403 elutasítottat). Anthropic: a modellek listázása (`GET /v1/models`), ami azt is jelzi, ha a beállított modellazonosító nem elérhető (`includes/Ai/MagnificProvider.php`, `includes/Ai/AnthropicProvider.php`).

**Kötelező az Anthropic-kulcs?**
Nem. Nélküle a három koncepciót a beépített, szabályalapú tervező készíti (`Planner::plan_rules()`), és az „AI értelmezés” gomb nem érhető el. Képgeneráláshoz Magnific-kulcs (vagy teszt mód) kell.

**Mi a teszt mód, és hogyan kapcsolom be?**
Helyi, GD-vel renderelt, „TESZT KEP - NEM AI GENERALAS” feliratú tömegvázlatok API-kulcs és költség nélkül – a teljes folyamat (sor, galéria, csomag, e-mail) kipróbálásához. Bekapcsolás: **Admin → AI-szolgáltatók → Aktív szolgáltató = „Teszt mód (helyi vázlatkép, nem AI)”** (feltétel: „Teszt mód engedélyezése” be, PHP GD elérhető). A teszt képek a felületen, a ZIP-ben (`test_image=yes`) és az adminban is jelölve vannak.
Ha az aktív szolgáltató a Magnific, de nincs kulcs, és tartalék szolgáltató sincs beállítva, a generálás le van tiltva: az admin hibaüzenetet kap („Nincs működő képszolgáltató, ezért a generálás le van tiltva…”), a látogató pedig ezt látja: „A képgenerálás jelenleg nem érhető el. Kérjük, nézz vissza később.” A plugin nem vált magától teszt módra.

**Hogyan teszem ki a tervezőt az oldalra?**

| Mód | Leírás |
|---|---|
| Lebegő gomb | Alapból minden oldalon (Admin → Arculat és elrendezés, „Lebegő indítógomb minden oldalon”). Csak egy kb. 3 KB-os betöltő kerül az oldalra; a tervező első kattintásra töltődik be. |
| `[autogrowehome]` | Indítógomb a tartalomban; `label` attribútummal saját felirat. (`[autogrowehome_button]` ugyanez.) |
| `#agh-open` | A horgony a tervezőt megnyitja az oldal betöltésekor, a cím hash-változásakor és azonos oldali `#agh-open` hivatkozásra kattintva – ott, ahol a betöltő be van töltve (bekapcsolt lebegő gombnál minden oldalon, különben a shortcode-os oldalakon). |
| `window.AGH_open()` | JavaScriptből megnyitja a tervezőt. |
| `[autogrowehome_faq]` | Kereshető GYIK. |
| `[autogrowehome_pricing]` | Csomag- és árlap (lásd [LICENC-ES-ELOFIZETES.md](LICENC-ES-ELOFIZETES.md)). |
| `[autogrowehome_portal]` vagy `/?agh-portal=1` | Kivitelezői portál (a `/?agh-portal=1` téma nélküli, `noindex` oldal). |

Gutenberg-blokk nincs; a shortcode bármely oldalépítőben használható.

### Költségek

**Mennyibe kerül egy generálás?**
A szolgáltatói árakat a kód nem tartalmazza – ez innen **nem mérhető**. A plugin licence nem tartalmazza a Magnific és Anthropic díjait; ezeket a saját fiókodon fizeted. A költségbecsléshez az árakat te adod meg (**Admin → AI-szolgáltatók → Költségbecslés és költségkeret**); alapértékük 0, ezért beállításuk nélkül a statisztika 0 költséget mutat.
A képek **száma** a kód alapértékeiből levezethető (a beállításoktól függően változik):

| Lépés | Professional / Agency / tulajdonosi mód | Starter |
|---|---|---|
| Fő képek (Mystic, alapból 2K) | 3 | 3 |
| Külső nézetek a kiválasztott házhoz | legfeljebb 7 (elöl, hátul, bal, jobb, madártávlat, kerti, esti*) | legfeljebb 3 (elöl, hátul, madártávlat) |
| Belső nézetek a kiválasztott házhoz (Mystic) | legfeljebb 4 (`interiors_max`) | legfeljebb 2 |
| Koncepciótervezés (Anthropic, ha be van állítva) | 1 hívás | 1 hívás |
| Újragenerálás (kiválasztott házanként, külön napi keretből) | 1 új fő kép + friss galéria | 1 új fő kép + friss galéria |

\* Az esti nézet csak bekapcsolt „Esti épületvilágítás” mellett készül. A külső nézetek „Referenciakép” stratégiánál a Flux 2 Pro végponton készülnek (1440×816 px), költségkulcsuk a „Referenciás kép ára”. „Mindhárom házhoz azonnal” galériamódban a nézetek mindhárom koncepcióhoz elkészülnek (háromszoros galériaköltség), és a fő képek a „Végleges felbontás” (alapból 4K) szerint készülnek. A felskálázás külön költség, alapból ki van kapcsolva.

**Hogyan tartom kordában a költséget?**
- **Napi / havi költségkeret** (0 = nincs korlát): minden generálás előtt a rendszer 3 × „Mystic kép (1K/2K) ára”, újragenerálás előtt 1 × ennyi becsléssel ellenőrzi; túllépésnél a látogató ezt kapja: „A szolgáltatás költségkerete átmenetileg kimerült…”. Ez az ellenőrzés nem atomikus: párhuzamos kéréseknél a keret kissé túlléphető.
- **Limitek** (Admin → Limitek és hozzáférés): IP-, felhasználói és globális napi limit, újragenerálási keret, galéria csak a kiválasztott házhoz, nézetek listája, belső nézetek száma, max. kép/galéria, egyidejű feladatok száma.
- Kisebb felbontás, felskálázás kikapcsolva.

**Mikor kapja vissza a látogató a keretet?**
Minden visszatérítés legfeljebb egyszer történik (`JobQueue::refund_job_once()`, `refund_project_once()`).
- **Generálási egység:**
  - ha a szerveroldali ellenőrzés elbukik;
  - ha egyik fő kép sem készül el, és a projekthez nincs rögzített költség (`Pipeline::after_asset()`);
  - ha a látogató bármely fázisban leállítja a generálást, addig sem költség, sem kész kép nem keletkezett, és épp nem fut feladat (`JobQueue::cancel_project()`, `Pipeline::cost_free()`).
- **Újragenerálási alkalom** (csak ez, az eredeti generálási egység nem):
  - ha az indítás a sorba állítás előtt hibára fut (pl. hibás beállítás);
  - ha az új fő kép költség nélkül véglegesen sikertelen;
  - ha egy újabb újragenerálás vagy a leállítás lecseréli, mielőtt bármi elkészült volna.

Mivel a költség a megadott árakból számolódik, 0-s áraknál minden „nulla kép” eredményű generálás visszatérítődik.

### Limitek

**Milyen limitek vannak, és mik az alapértékek?** (`includes/Support/Settings.php`)

| Beállítás | Alapérték | Megjegyzés |
|---|---|---|
| IP-címenkénti napi limit | 3 | A csomag `max_ip_daily` értéke felső korlát (Starter 3, Professional 10, Agency 50): a kisebb érvényes. |
| Felhasználónkénti napi limit | 0 | 0 = nincs külön limit |
| Globális napi limit | 0 | 0 = nincs; az újragenerálás nem számít bele |
| Visszaélésvédelem | 2 kérés / 10 perces ablak | IP-alapú; IPv6-nál a /64-es hálózat számít |
| Egyidejű generálás / IP | 1 | Az adminra nem vonatkozik; nem atomikus ellenőrzés |
| Újragenerálás / nap | 2 | IP-nként és bejelentkezve felhasználónként (`limits.gallery_rebuilds_per_day`, 0 = korlátlan) |
| Egyszerre futó háttérfeladatok (oldalszinten) | 4 | `limits.max_parallel_jobs`, 0–50, 0 = nincs korlát |
| Duplikált kérés szűrése / gyorsítótár | 20 perc / 72 óra | Azonos beállítás = meglévő terv, keretlevonás nélkül |
| AI-értelmezés / ajánlatkérés / portál-belépés | 15 / 5 / 30 naponta, IP-nként | Kódba épített értékek |
| Napi időszak | webhely időzónája, 0 órától | Állítható |

A napi keretek egyetlen feltételes SQL-utasítással foglalnak, így párhuzamos kéréseknél sem léphetők túl (mérve SQLite-on, a 3. javítási kör előtti kóddal: 12 párhuzamos kérés, limit 3 → 3× HTTP 202, 9× HTTP 429). Az egyidejű generálás / IP és a költségkeret ellenőrzése nem atomikus.

**Proxy vagy CDN mögött minden látogató ugyanazt a keretet használja. Mit tegyek?**
Add meg a megbízható proxyk IP-címeit/CIDR-tartományait és a továbbított IP fejlécét (**Limitek és hozzáférés → Megbízható proxyk / CDN**; alapfejléc: `X-Forwarded-For`, Cloudflare-nél `CF-Connecting-IP`). A továbbított fejlécet a plugin csak ezektől fogadja el.

### Minőség és 4K

**Kapnak a látogatók 4K képeket?**
Csak akkor jelöljük 4K-nak, ha a kép hosszabbik oldala ténylegesen ≥ 3840 px. Natív 4K a Mystic fő képeknél kérhető (koncepcióképek felbontása 4K-ra állítva, vagy „Mindhárom házhoz azonnal” galériamódban a „Végleges felbontás” szerint), ha a csomag `max_resolution` értéke engedi (Starter: 2K). A referenciás külső nézetek legfeljebb 1440 px szélesek. A felskálázás (kiválasztott galéria, < 3840 px-es képek) „(felskálázott)” jelölést ad. Valódi Magnific-válasz felbontását élesben nem mértük.

### Működés és hibák

**Kell valódi cron?**
A plugin percenkénti WP-Cron eseményt használ, és alapból a látogató állapotlekérdezései közben is feldolgozza a sort („Feladatfeldolgozás állapotlekérdezéskor”) – oldalszinten egyszerre csak egy kérés; a következő ilyen feldolgozás az előző vége után 5–6 másodperccel indulhat, elakadt kérés zárolása pedig a futási keret (8 s) + 5 s után lejár (`JobQueue::poll_tick()`). Ha a látogató bezárja az ablakot, a folytatás a WP-Cronon múlik, ami csak oldallátogatáskor fut. Ezért nagyobb forgalomnál valódi cron javasolt:

```bash
* * * * * cd /útvonal/a/wordpresshez && wp agh queue run --seconds=50
```

(`wp agh queue --seconds=50` ugyanez.) További WP-CLI parancsok: `wp agh status`, `wp agh retention`. Valódi cronnal élesben nem teszteltük.

**Mi történik, ha a Magnific nem elérhető vagy hibát ad?**
- Átmeneti hiba (hálózati hiba vagy HTTP 408, 425, 429, 500, 502, 503, 504, 529 – `includes/Support/Http.php`): HTTP-szintű újrapróbálás (alapból 2), majd a feladat újrapróbálása növekvő várakozással (15 s, 30 s, … max. 300 s; alapból összesen 3 kísérlet). Utána a kép „sikertelen”.
- Végleges hiba (pl. 401/403 érvénytelen kulcs, 402 elfogyott kredit, szűrő által blokkolt kép): ha van **Tartalék szolgáltató**, arra vált; különben a kép sikertelen. A Magnific tartalomszűrője az **AI-szolgáltatók** oldalon kapcsolható („Tartalomszűrés (NSFW)”, alapból be; Mystic-kéréseknél).
- A **Webhook használata** beállítás súgója a valós, titkos tokent tartalmazó webhook-URL-t mutatja (csak `agh_manage` joggal); ezt ne tedd közzé.
- Feladatonkénti időtúllépés: 420 s (állítható).
- Az API-kulcsos kérések, a licenc- és frissítéshívások és a kész képek letöltése nem követnek átirányítást; a képeket a plugin csak HTTPS-ről, méret- és típusellenőrzéssel tölti le (`includes/Support/Http.php`). A szolgáltatói végpont-útvonalakat egyetlen szabály ellenőrzi (`Settings::is_endpoint_path()`). Célhost-engedélylista nincs, és DNS-rebinding ellen nincs teljes védelem.
- Ha mindhárom fő kép sikertelen, a projekt „sikertelen”, és – költség nélkül – a keret visszajár.
- Az adminban a statisztika mutatja a szolgáltatói hibákat és a hibaokokat.

**Mi történik, ha az Anthropic nem elérhető?**
A koncepciótervezés automatikusan a szabályalapú tervezőre vált (a hiba naplózódik), a generálás folytatódik. Az „AI értelmezés” ilyenkor hibát ad vissza. Valódi Anthropic-hívás élesben nem futott; a tesztek szimulált válaszokkal ellenőrzik a szerződést.

**Nem érkezik meg a kivitelezői e-mail. Mit nézzek meg?**
- **Kivitelező és e-mail → Teszt e-mail küldése magamnak** – a levélküldés alapellenőrzése.
- Az ajánlatkérés állapota: „notified” (elküldve) vagy „notify_failed” (az újrapróbálások után is sikertelen). Több kivitelezőnél a plugin címzettenként tartja nyilván a kézbesítést; az újrapróbálás csak a sikertelen címzetteknek küld, részleges kézbesítésnél a napló „forwarded_partial” eseményt rögzít.
- **Ajánlatkérések → Értesítés újraküldése (új link)** – az érintett címzett korábbi linkjei ilyenkor érvénytelenné válnak.
- Érvényes kivitelezői e-mail-cím nélkül az admin figyelmeztet.
A tényleges kézbesítést élesben nem ellenőriztük (a tesztek a `pre_wp_mail` szűrővel elfogják a levelet); SMTP-bővítmény és SPF/DKIM beállítása javasolt.

**Hogyan éri el a kivitelező a csomagot?**
Az e-mailben kapott, címzetthez kötött, időkorlátos hivatkozással (alapból 168 óra). A hivatkozás a lejáratig többször használható; megnyitáskor HttpOnly sütis portál-munkamenetre cserélődik (alapból 12 óra), amely csak az adott ajánlatkérést mutatja.
- Az `agh_contractor` szerepkörű felhasználó bejelentkezve csak azokat az ajánlatkéréseket látja, amelyekről az ő e-mail-címére ment értesítés.
- Projektkezelő jogú felhasználók (pl. `agh_manager`, admin) a legutóbbi 50 ajánlatkérést látják.
- **Ajánlatkérések → Hozzáférés visszavonása**: az ajánlatkérés összes kivitelezői linkje és az azokból nyitott munkamenetek érvénytelenné válnak.

A ZIP a jogosultság-ellenőrzött REST-végponton keresztül tölthető le.

### Adatvédelem

**Mit tárol a plugin, és hol?**
- Adatbázis: `{prefix}agh_` táblák (`includes/Installer.php`): `projects`, `concepts`, `assets`, `jobs`, `quotes`, `consents`, `rate`, `stats`, `logs`, `prompt_versions`, `catalog`, `access`, `ledger`.
- Fájlok: nem kitalálható nevű `agh-private-…` könyvtár az uploads alatt, `.htaccess`/`index.php` védelemmel; a fájlok csak jogosultság-ellenőrzött REST-végponton érhetők el. **Nginx** esetén a `.htaccess` nem hat – ilyenkor az admin hibát jelez; állíts be tiltást, vagy használd az `AGH_PRIVATE_DIR` konstanst webgyökéren kívüli útvonallal.
- IP-cím csak HMAC-hash-ként.
- Hozzájárulások a dokumentum verziójával, URL-jével és időpontjával naplózva; a „user agent” csak a `legal.store_user_agent` beállítással (**Jogi és GDPR** oldal, alapból ki), és nem kerül a kivitelezői csomagba vagy portálra.
- Bejelentkezett felhasználónál a kép- és ZIP-letöltési hivatkozások a WordPress REST-nonce-ot (`_wpnonce`) URL-paraméterként tartalmazzák; ezeket a hivatkozásokat ne oszd meg.
- Megőrzés: napi takarítás a **Jogi és GDPR** oldalon megadott idők szerint (alapértékek fent, az A) részben).
- Anonimizálás (admin gomb, megőrzési idő vagy WP-adattörlő): az ajánlatkérés minden személyes mezője ürül, a hozzájárulási naplóból törlődik az IP-hash és a user agent, a ZIP és a linkek megszűnnek; ha a projekthez nem tartozik más aktív ajánlatkérés, a projekt fájljai, képei és koncepciói törlődnek, a beállításaiból pedig minden szöveges mező (saját instrukció, projekt- és háznév, ország, az egyedi szöveges paraméterek, a helyiségek leírásai és egyéb szövegei) kiürül, a helyiségnevek általános típusnévre állnak; számok, választások és méretek maradnak (`QuoteService::anonymize()`, `Repository::anonymize_project()`, `scrub_config()`). Az így anonimizált („törölt”) projektek az admin projektlistájában nem jelennek meg, és nem is szűrhetők.
- A WordPress személyesadat-exportálójába és -törlőjébe be van kötve (e-mail-cím alapján, 20 tételes lapozással).

**Használhatók a beépített jogi szövegek?**
Nem ellenőrizetten. Az adatkezelési szövegjavaslat maga is jelzi: „Sablon – szakértői ellenőrzés szükséges.” Az ÁSZF- és adatkezelési URL-eket, valamint a hozzájárulási szövegeket jogásszal nézesd át.

### Licenc

**Mi történik, ha lejár a licenc?**
A projektek és a beállítások megmaradnak, a prémium funkciók kikapcsolnak, a Starter funkciók működnek tovább. Lejárat előtt 14 nappal az admin felületen figyelmeztetés jelenik meg. Részletek: [LICENC-ES-ELOFIZETES.md](LICENC-ES-ELOFIZETES.md).

**Mi van, ha a licencszerver nem érhető el?**
Ha a licenc addig aktív volt, az utolsó sikeres ellenőrzéstől számított 14 napos türelmi időig a korábbi csomag érvényes, utána Starter szintre vált. Ugyanez történik HTTP-hibánál, érvénytelen aláírásnál vagy a kéréshez nem illő válasznál is. Inaktív, lejárt vagy oldalkorlátba ütköző licenc egy hibás ellenőrzéstől nem éled újra. Beállítás és adat nem törlődik.

**Eltávolításkor törlődnek az adatok?**
Csak ha bekapcsoltad a „minden adat törlése eltávolításkor” beállítást (alapból ki; `uninstall.php`). Különben a projektek, ajánlatkérések és beállítások megmaradnak egy későbbi újratelepítéshez. Saját `AGH_PRIVATE_DIR` könyvtárnál ilyenkor csak a plugin saját tartalma törlődik (a projektmappák és a próbafájl; a védőfájlok – `.htaccess`, `web.config`, `index.php`, `index.html` – csak akkor, ha a tartalmuk pontosan a pluginé), maga a könyvtár megmarad.

### Mi nincs élesben ellenőrizve?

- Valódi Magnific- és Anthropic-hívás (a tesztek a dokumentált szerződés szerint szimulálnak).
- Tényleges e-mail-kézbesítés.
- MySQL/MariaDB (csak SQLite-on futott), éles tárhely valódi cronnal.
- Fizetési szolgáltató (csak bővítési pont létezik).
- A BRAMAC-katalógus (viszonteladói nyilvános adatokból, `verified: false` jelöléssel; a felületen „Gyártói ellenőrzésre vár” jel – gyártói ellenőrzés kell).
- A 15 fordítás anyanyelvi lektorálása (MI-vel készültek).
