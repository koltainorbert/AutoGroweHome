# AutoGroweHome – Felhasználói útmutató

*Látogatóknak, akik a weboldalon házat terveznek. Verzió: AutoGroweHome 1.0.0.*

A háztervező a megadott adataidból **három különböző házkoncepciót** készít mesterséges intelligenciával készült **látványtervekkel** és méretezett **tervvázlatokkal**. A kiválasztott házhoz teljes galéria készül, a projektet elmentheted, és ha szeretnéd, ajánlatot kérhetsz egy kivitelezőtől.

> **Fontos:** a látványtervek MI-vel készült koncepcióképek, a tervvázlatok pedig koncepcionálisak – **nem engedélyezési és nem kiviteli tervek**. Építéshez szakági tervező szükséges. (A felület is ezt írja ki: „A látványtervek mesterséges intelligenciával készülnek, a tervvázlatok koncepcionálisak…”)

A gombok és feliratok neve az alábbiakban pontosan úgy szerepel, ahogy a magyar felületen megjelenik (forrás: `includes/Frontend/Strings.php`). Az üzemeltető egyes feliratokat, színeket és funkciókat átállíthat, ezért a te oldaladon kisebb eltérések lehetnek.

---

## 1. A háztervező megnyitása

- Kattints a **„Tervezd meg álmaid otthonát”** gombra (ez az alapfelirat, az üzemeltető megváltoztathatja). A gomb lehet az oldal tartalmában, vagy lebegő gombként a képernyő jobb alsó sarkában.
- Ha a webcím végén `#agh-open` szerepel, vagy az oldalon egy `#agh-open` hivatkozásra kattintasz, a tervező megnyílik (`assets/js/agh-loader.js`). Ez azokon az oldalakon működik, ahol a tervező betöltője jelen van: lebegő gomb esetén minden oldalon, egyébként a tervezőgombot tartalmazó oldalakon.
- A tervező felugró ablakban (popup) nyílik meg; az első kattintáskor töltődik be, ez néhány másodperc lehet.
- Alapbeállítás szerint a **Gyors varázsló** nyílik meg (az üzemeltető a teljes tervezőt is beállíthatja kezdőnézetnek). Hét lépés: **Alapok** (épülettípus, szintek, lakók), **Méret** (alapterület, háló- és fürdőszobák), **Stílus**, **Tető** (magastetőnél BRAMAC tetőfedés), **Homlokzat** (anyag, szín, ablakok), **Kert** (garázs, terasz, kertstílus), **Kész** (összefoglaló, ellenőrzés, generálás). Stílusválasztáskor a varázsló a stílushoz illő anyagokat és színeket is beállítja, de amit te állítottál be, azt nem írja felül.
- A varázsló ugyanazokat a beállításokat szerkeszti, mint a teljes tervező: a **Teljes tervező** gombbal (mobilon a csúszka ikonnal vagy a „⋯” menüből) bármikor átléphetsz, és semmi nem vész el; visszafelé a fejléc **Gyors varázsló** gombjával. A választásodat a böngésző megjegyzi, a következő megnyitáskor azzal a nézettel indul. Ha a hiba egy lépés mezőjében van, a **Tovább** gomb jelzi és a mezőre ugrik. Generálás után a tervező a teljes nézetben, a **Koncepciók** fülön folytatódik.
- Első megnyitáskor a teljes tervezőben egy rövid **Gyorsbemutató** indul (6 lépés). Átlépheted a **„Kihagyás”** gombbal, később a fejléc súgó ikonjával („Gyorsbemutató”) újranézheted. A varázsló nem indítja el.
- Bezárás: a fejléc **×** gombja vagy az **Esc** billentyű. Ha nem mentett módosításod van, a tervező rákérdez („Biztosan bezárod?”). A beállításaid ebben a böngészőben ekkor is megmaradnak.

## 2. A felület felépítése

| Rész | Mit látsz |
|---|---|
| **Paraméterek** (bal) | Kategóriasáv ikonokkal, keresőmező („Keresés a paraméterek között”), a kategória mezői. A hibás/figyelmeztetéses kategória ikonján jelölés látszik. |
| **Terv** (közép) | Nézetek: **Tervezés** (élő vázlat), generálás után **Koncepciók** és **Összehasonlítás**, kiválasztás után **Galéria**. |
| **Összegzés** (jobb) | **Élő összefoglaló**: a ház főbb adatai, ellenőrzési üzenetek, napi keret, generáláskor a folyamat. |
| **Műveleti sáv** | Állapotszöveg, **Mentés**, **Leállítás** (csak generálás közben), **Ajánlatkérés**, **Generálás – 3 koncepció** / **Új generálás**. |
| **Fejléc** | **Egyszerű / Részletes** mód, **Presetek**, **Projektjeim**, nyelvválasztó (ha több nyelv elérhető), sötét/világos mód, Gyorsbemutató, Bezárás. |

Az üzemeltető a panelek sorrendjét és a műveleti sáv helyét (fent/lent) megváltoztathatja.

**Mobilon** (820 px-nél keskenyebb kijelzőn, valamint fekvő telefonon) a három panel helyett alul három fül van: **Paraméterek**, **Terv**, **Összegzés**. A fejlécben ilyenkor a módváltó, a **Presetek**, a **Projektjeim**, a Gyorsbemutató és a nyelvválasztó a **„⋯” (További lehetőségek)** menübe kerül; a sötét/világos mód és a Bezárás gomb a fejlécben marad. A menü billentyűzettel is kezelhető (nyílbillentyűk, Esc).

## 3. Egyszerű és Részletes mód

- **Egyszerű** (alapértelmezés): kategóriánként csak a legfontosabb mezők látszanak. A rejtett mezők számát a lista alján a **„+ N haladó beállítás”** gomb mutatja; erre kattintva Részletes módra vált.
- **Részletes**: minden mező látszik; a haladó mezők mellett „haladó” címke áll.
- A kötelező mezőket **\*** jelöli.
- Egyes mezők csak bizonyos választásnál jelennek meg (pl. **Tetőhajlásszög** lapostetőnél nem; **Erkély** csak nem földszintes háznál).

A keresőmező minden kategóriában keres (mezőnévben és súgószövegben).

## 4. Paraméterkategóriák

A tervező 15 kategóriát használ (`includes/Params/Definitions.php`). Az üzemeltető csomagjától és beállításaitól függően egyes mezők hiányozhatnak, más nevet vagy alapértéket kaphatnak, és az üzemeltető saját mezőket is felvehet.

| Kategória | Fő beállítások (Egyszerű mód) | További (haladó) beállítások – példák |
|---|---|---|
| **Alapadatok** | Projekt neve; Ingatlan típusa\* (Családi ház, Ikerház, Sorház, Nyaraló, Villa, Kisház / tiny house); Lakók száma\*; Hálószobák száma\*; Fürdőszobák száma\*; Szintek\* (Földszintes, Földszint + tetőtér, Kétszintes, Háromszintes); Nettó hasznos alapterület\* (25–800 m²); Telek területe; Kert felőli homlokzat tájolása; Tervezési ország és régió; Tervezett költségkeret (Ft, tájékoztató adat); Akadálymentes kialakítás | Ház megnevezése, Épület funkciója, Bruttó alapterület, telek és épület méretei, Éghajlati környezet, Kívánt építési időszak |
| **Építészeti stílus** | Építészeti stílus\* (16 lehetőség, pl. Modern minimalista, Skandináv, Mediterrán, Modern parasztház, Passzívház, Egyedi stílus + leírás) | Karakteresség |
| **Épületforma** | Alaprajzi forma (téglalap, L, U, tagolt); Garázs / beálló; Fedett terasz (m²); Erkély; Bejárati előtető; Pince / alagsor; Kémény / kandalló | Gépészeti helyiség, tető alatti tároló, bővíthetőség, belmagasság stb. |
| **Tető** | Tetőforma\* (8 lehetőség); Tetőhajlásszög; Tetősíkablakok száma; Napelemek a tetőn; **Tetőfedési márka**; **Tetőcserép / termék**; Tetőfedés színe; Tetőfelület | Gerincmagasság, tetőkinyúlás, eresz, oromfal, ereszcsatorna, bádogozás stb. |
| **Homlokzat** | Fő homlokzatanyag\* (8 lehetőség); Vakolat / fő szín (színkollekciókkal); Kiegészítő anyagok (legfeljebb 3); Kültéri homlokzatvilágítás | Lábazat, faltextúra, sarokmegoldás, díszítőelemek stb. |
| **Nyílászárók** | Ablakok jellege; Ablakkeret színe és anyaga; Teraszajtó; Bejárati ajtó és színe; Árnyékolás | Osztott üvegezés, sarokablak, üvegezés jellege, szúnyoghálók |
| **Helyiségek** | Nyitott nappali–konyha–étkező; **Helyiségprogram** | – |
| **Belső tér** | Belső stílus (egész ház, 11 lehetőség); Általános falszín; Világítás jellege; Bútorozási stílus | Mennyezet, bútorszín, dekoráció, függönyök |
| **Konyha** | Konyhaelrendezés; Munkalap anyaga; Frontok és színük | Fogantyúk, beépített gépek, mosogató, hátfal, kamrakapcsolat |
| **Fürdőszoba** | Szaniterek; Burkolat; Csaptelepek | Világító tükör, rejtett tárolók, fő szín |
| **Burkolatok** | Fő padlóburkolat; Padló árnyalata | Vizes helyiségek padlója, falburkolatok, burkolatméret és -minta, fugaszín |
| **Kert és környezet** | Kert stílusa; Kerti elemek; Teraszburkolat; Kocsibeálló / bejáró; Kerítés | Kapu, környező épületek |
| **Gépészet és energia** | Gépészeti igények (pl. hőszivattyú, padlófűtés, napelem, autótöltő) – igényfelmérés, a rendszer nem állít ki energetikai besorolást | – |
| **Fény és kamera** | Napszak; Évszak; Időjárás, felhőzet | Fő kép kameraállása, objektív, esti épületvilágítás |
| **Egyedi leírás** | Saját instrukció (szabad szöveg, max. 1500 karakter) + **AI értelmezés** gomb | – |

### Tetőfedés (BRAMAC – magastetőnél kötelező)

- **Magastetőnél a tetőfedés márkája kötelezően BRAMAC** (a katalógusban kötelezőnek jelölt márka; `Validator::apply_roof_brand()`, `Catalog::required_brand()`). A **Tetőfedési márka** listájában ilyenkor csak ez szerepel. Ha más márka érkezne, a rendszer átállítja, és ezt írja: „A tetőfedés márkája kötelezően BRAMAC, ezért erre állítottuk.”
- A **Tetőcserép / termék** listában a BRAMAC termékcsaládjai és színei szerepelnek (pl. Római, Reviva, Tectura, Tegalit Star, Adria, Montero); kereshetsz is benne. Termék választásakor a **Tetőfedés színe** a termék színmintájára áll, és a képleírásba a termék neve és színe kerül.
- **Ha nem választasz terméket**, a rendszer választ helyetted: a katalógusban ajánlottnak jelölt terméket, ennek hiányában a beállított tetőszínhez legközelebbi színűt. Ezt információként jelzi, pl.: „Tetőfedés: nem választottál terméket, ezért a(z) BRAMAC kínálatából a(z) „Bramac Római – antracit” került a tervbe. A Tető lépésben másikat is választhatsz.” (Az alapértelmezett antracit tetőszínnel mért eredmény.) Ez nem hiba, a generálás indítható.
- Az így választott termék a **Tetőcserép / termék** mezőben és az Összegzésben is látszik. A saját választásodat a rendszer soha nem írja felül; amíg a terméket a rendszer választotta, a tetőszín módosításakor újra választ.
- **Lapostetőnél** nincs cserépfedés: a márka és a termék mező nem jelenik meg, és a szabály nem érvényes.
- A mező súgója: „A katalógusban rögzített termékek közül. A gyári tételek színmintái tájékoztató jellegűek, gyártói ellenőrzésre várnak.” A gyártó által még nem ellenőrzött termékeknél a listában és az Összegzésben egy apró jel látszik, rámutatva: „Gyártói ellenőrzésre vár”. Az előre feltöltött BRAMAC-lista egy viszonteladó nyilvános adataiból származik.

### Helyiségprogram

- A rendszer az alapadatokból automatikusan javasol helyiséglistát. Az **Automatikus** gomb ezt bármikor újraszámolja („A helyiségprogramot az alapadatokból újraszámoltuk.”).
- A **Helyiség** gombbal új helyiséget veszel fel (legfeljebb 40). Helyiségenként: név, terület (m²), típus (25 típus), szint, **Látványterv** kapcsoló, és a **Részletek** alatt: szélesség, hosszúság, belmagasság, belső stílus („A ház stílusa szerint” vagy egyedi), padló, fal, falszín, mennyezet, világítás, bútorok, bútorszín, dekoráció, függöny, ajtók, ablakok, elektromos kiállások, fűtés/hűtés, egyedi leírás.
- A lista tetején: „Összesen X m² / nettó Y m² · eltérés: Z%” – 10%-nál nagyobb eltérésnél kiemelve.
- **Belső látványkép** csak azokról a helyiségekről készül, amelyeknél a **Látványterv** be van kapcsolva – és legfeljebb annyiról, amennyit az üzemeltető engedélyez (alapbeállítás: 4 helyiség koncepciónként; Starter csomagban legfeljebb 2). Ha egyik sincs bekapcsolva, a galériában ez áll: „Nincs belső nézet kijelölve…”.

### Egyedi leírás és AI értelmezés

- Írd le szabadon az elképzelésed. A leírást a generálás figyelembe veszi; a konkrét beállításaid elsőbbséget élveznek. A képgenerálónak küldött szövegbe a leírásod legfeljebb 600 karaktere kerül, lehetőleg teljes mondatokra vágva (ha az üzemeltető MI-tervezőt használ, helyette annak angol összefoglalója). Ha a képleírás túl hosszú, a rendszer a leírásodat rövidíti utoljára, akkor is mondathatáron (`PromptEngine::combined()`). Ezért a legfontosabb kérést írd az első mondatba.
- Az **AI értelmezés** gomb javaslatokat tesz a paraméterekre („AI javaslatok” ablak), az indoklásokat a felület nyelvén írja. Te jelölöd ki, mit fogadsz el (**Kijelöltek alkalmazása**); a már általad beállított értékeket nem írja felül, az ütközéseket figyelmeztetésként mutatja.
- Ha az üzemeltető nem kapcsolta be: „Az AI-értelmezés nincs bekapcsolva; a szöveges leírásod a generálásnál így is figyelembe vesszük.”
- Napi korlát: IP-címenként 15 értelmezés (`includes/Rest/RestController.php`).
- **Ne írj személyes adatot** (nevet, telefonszámot) a leírásba: a szöveg a képgeneráló és szövegértelmező szolgáltatókhoz kerül.

## 5. Presetek

A fejléc (mobilon a „⋯” menü) **Presetek** pontja:

- **Beépített csomagok** – az üzemeltető által felvett kész beállítások (alapból pl. „Modern földszintes, 90 m², nyeregtető” és „Modern családi ház, 120 m², lapostető”), valamint a stíluscsomagok. Az **Alkalmaz** gombbal töltöd be.
- **Stíluscsomag-ajánlat:** ha építészeti stílust választasz, értesítés jelenhet meg: „A(z) „…” stílushoz javasolt beállításcsomag is tartozik.” – az **Alkalmaz** gombbal a stílushoz illő tető-, homlokzat- és ablakbeállítások töltődnek be.
- **Saját presetek** – a jelenlegi beállításaidat **Mentés presetként** gombbal elmentheted (legfeljebb 20). Ezek a böngésződben tárolódnak; bejelentkezve a fiókodhoz is szinkronizálódnak.

## 6. Élő vázlat és élő összefoglaló

- A **Tervezés** nézet **Élő vázlata** minden módosításra azonnal frissül. Ez **sematikus rajz, nem MI-kép** („Sematikus, nem AI-kép”). Alatta: Alapterület, Hálószoba, Fürdőszoba, Tető.
- **Tárgyak mozgatása a 3D-ben (1.18.0):** a külső nézetben minden kerti tárgy (medence, tároló, pergola, tűzrakó, kerti bútor, lámpa, fa, bokor, autó, ember, kutya, macska, kutyaház, töltő), az ablakok, a bejárati és a teraszajtó, valamint a kémény megfogható az egérrel (ujjal: rövid nyomás után) és elhúzható. Az ablak és az ajtó a saját falán, a kémény a tetőn mozog. Forgatás: **Ctrl (Mac: ⌘) + oldalra húzás**, görgő vagy **R**; **Shift: egyenesbe** (0/90/180/270°). A kijelölt tárgyat a **nyilak** mozgatják (10 cm, Shift-tel 50 cm), az **Esc** befejezi (húzás közben visszateszi). Húzás közben a keret **zöld**, ha jó a hely, **piros**, ha nem (telken kívül, a házba vagy a garázsba lóg, a teraszon van, a medence vagy a fa túl közel a házhoz, másik tárgyra került, a nyílás túl közel a sarokhoz vagy egy másik nyíláshoz, a kémény messze a gerinctől) – ez figyelmeztetés, a tárgy oda is letehető. **Ctrl+Z** visszavon, a jobb alsó gombbal a kézi elrendezés visszaállítható. A 2D vázlat és a generált kép is az új helyet mutatja. A belső nézetben a bútorok ugyanígy forgathatók (Ctrl + húzás, görgő, R; Shift: egyenesbe).
- Az **Élő összefoglaló** csoportjai: **Ház** (stílus, típus, szintek, alapterület, helyiségek, hálók, fürdők, tető, tetőfedés, homlokzat, terasz, garázs), **Ellenőrzés** (üzenetek), **Napi keret**, valamint a jogi figyelmeztetés. Az ellenőrzési üzenetre kattintva a tervező a hibás mezőre ugrik.

## 7. Ellenőrzés és üzenetek

A rendszer minden módosítás után ellenőrzi a beállítások összhangját (`includes/Params/Validator.php`). Háromféle üzenet van:

- **Hiba** (piros) – amíg van, a generálás nem indítható. A műveleti sáv ezt írja: „N beállítás javításra szorul.”
- **Figyelmeztetés** (sárga) – generálni lehet, de érdemes átnézni.
- **Információ** (kék) – tájékoztatás.

Ha minden rendben: „A beállítások összhangban vannak.”

**Generálást blokkoló hibák:**

| Üzenet (röviden) | Mikor jelenik meg |
|---|---|
| „Kötelező mező: …” | Üres kötelező mező |
| „A nettó alapterület nem lehet nagyobb a bruttónál.” | Nettó > bruttó |
| „A megadott helyiségszámhoz legalább kb. X m² hasznos alapterület szükséges.” | Nettó terület < 22 + 9 × hálószoba + 3,5 × fürdőszoba m² |
| „Az épület nem fér el a telek szélességén…” | Épületszélesség > telekszélesség − 6 m |
| „Tetőtér-beépítés lapostetővel nem valósítható meg…” | Földszint + tetőtér és lapostető |
| „Kavicsolt felület csak lapostetőn lehetséges.” | Kavicsolt tetőfelület magastetőn |
| „Akadálymentes bejárathoz nem választható külső lépcső…” | Akadálymentes + külső lépcsők |
| „„…” nem létező szintre került.” | Helyiség olyan szinten, amely nincs |

**Gyakori figyelmeztetések:** a helyiségek összterülete 10%-nál jobban eltér a nettó alapterülettől; a helyiséglistában más a hálószobák/fürdők száma, mint az alapadatoknál; beépítettség kb. 45% fölött; cserépfedés 15° alatt; tetőtér-beépítés 35° alatt; erkély földszintes háznál; többszintes háznál nincs földszinti WC/fürdő; nincs nappali a helyiséglistában.

## 8. Napi keret

- **1 generálás = 3 koncepció = 1 egység** a napi keretből.
- Alapbeállítás: **IP-címenként napi 3 generálás** (`includes/Support/Settings.php`, `limits.ip_daily`). Az üzemeltető ezt módosíthatja; a csomagja felső korlátot is szabhat.
- A keret állását az Összegzés **Napi keret** része mutatja: „Ma még X / Y generálás”. Indítás előtt a megerősítő ablak is kiírja.
- Visszaélés elleni védelem (alapbeállítás): 10 perces időablakonként legfeljebb 2 generálás, és egyszerre csak egy futó generálás IP-címenként. IPv6-címnél a /64-es hálózat számít egy címnek.
- **Nem számít bele** a keretbe:
  - ha ugyanazzal a beállítással (a projektnevet nem számítva) 72 órán belül már készült terved – ilyenkor a meglévőt nyitjuk meg: „Ezzel a beállítással már készült terv – azt nyitottuk meg (nem vont le keretet).”;
  - ha a generálás egyetlen koncepcióképet sem tudott elkészíteni, és nem keletkezett szolgáltatói költség („A keretet nem vontuk le, ha nem keletkezett költség.”);
  - ha a generálást bármely fázisban leállítod, és addig sem költség, sem kész kép nem keletkezett (az egység egyszer jár vissza, amint épp nem fut feladat; `JobQueue::cancel_project()`, `Pipeline::cost_free()`).
- Az **Újragenerálás** nem a fenti keretből fogy, hanem egy **külön napi újragenerálási keretből** (alapbeállítás: 2 / nap IP-címenként, bejelentkezve felhasználónként is; `limits.gallery_rebuilds_per_day`). A hátralévő számot az Újragenerálás gomb súgója és a megerősítő ablak mutatja („Ma még N újragenerálás érhető el.” / „A mai újragenerálási keret elfogyott.”). Elfogyása után indításkor: „A napi galéria-újragenerálási keret elfogyott.”
- A nap kezdete az üzemeltető által beállított időzóna szerint számít.

Ha elfogyott: „Elérted a napi … generálási keretet. Holnap újra próbálhatod, addig a mentett projektjeidet megtekintheted.”

## 9. Generálás és a folyamat követése

1. Nyomd meg a **Generálás – 3 koncepció** gombot (meglévő projektnél: **Új generálás**).
2. Megerősítő ablak: „A generálás három házkoncepciót készít, és egy egységet használ fel a napi keretből (még X / Y elérhető). Indíthatjuk?” → **Indítás**.
3. A tervező a **Koncepciók** nézetre vált; a műveleti sáv: „Generálás folyamatban – közben nyugodtan böngészhetsz.”

Az Összegzés **Folyamat** része a valós állapotot mutatja (a feladatok és képek tényleges állapotából számolva, `Pipeline::progress()`):

| Lépés | Jelentése |
|---|---|
| Paraméterek ellenőrzése | A beállítások szerveroldali ellenőrzése |
| Házkoncepciók előkészítése | A három koncepció megtervezése |
| Külső nézetek készítése | Fő képek, majd a galéria külső nézetei |
| Belső nézetek készítése | Belső képek (ha vannak kijelölve; különben kimarad) |
| Tervjellegű dokumentumok készítése | Tervvázlatok, helyiséglista, adatmodell |
| Képek feldolgozása | Előnézetek készítése |
| Galéria összeállítása | A kiválasztott ház galériája |
| Projekt kész | Minden elkészült |

A sáv a koncepciók előkészítése után 10%-ról indul, és az elkészült vagy véglegesen sikertelen képek arányában nő 100%-ig; alatta: „X / Y kép elkészült”. Egy lépés mellett megjelenhet: „kész, N hibával” (néhány kép nem készült el), „N hiba” (a lépés minden képe sikertelen) vagy „kihagyva”. Az újragenerálás miatt lecserélt vagy megszakított képek nem számítanak bele.

- A **Leállítás** gomb a hátralévő feladatokat leállítja („A hátralévő feladatokat leállítottuk.”). Ha még egy fő kép sem készült el, a projekt **megszakított** lesz: a Koncepciók nézet ezt írja: „A generálás megszakítva.” – „A beállításaid megmaradtak; új generálással újrakezdheted.”, mellette **Új generálás** gomb; a műveleti sáv: „A generálás megszakítva – új generálást indíthatsz.” A hátralévő lépések „kihagyva” jelölést kapnak, a frissítés leáll. Ha már volt kész fő kép, a projekt „részben kész” marad, és a kész koncepciók választhatók; a meg nem kezdett képek helyén: „Megszakítva – a kép nem készült el.”
- Az időtartam a külső szolgáltatók terhelésétől függ; pontos időt nem tudunk ígérni.
- Ha a tervezőt bezárod, a feldolgozás a szerveren folytatódik; a projektet később a **Projektjeim** alatt megnyithatod.
- Ha egy kép nem készül el: „A kép nem készült el.” Ha mindhárom koncepció sikertelen: „A generálás nem sikerült…”.

## 10. A három koncepció összehasonlítása

**Koncepciók** nézet – minden kártyán:

- a fő látványkép (készülés közben „Készül…”), a változat betűje (A, B, C) és neve, egy rövid jellemzés;
- befoglaló méret, tervezett nettó terület, gerincmagasság, színpaletta;
- ha van, „⚠ N megjegyzés” (ütközések, ellenőrzési megjegyzések – rámutatva olvasható);
- **Ezt választom** és **Nagyítás** gomb.

A három változat szándékosan különbözik: **A** – a legnyugodtabb, legracionálisabb tömeg; **B** – melegebb, természetesebb anyagok; **C** – a legkarakteresebb, prémium megoldás. A te kifejezett beállításaid mindhárom változatban kötelezőek.

**Összehasonlítás** nézet – táblázat soronként: Karakter, Befoglaló méret, Nettó alapterület, Beépített terület, Gerincmagasság, Alaprajzi forma, Helyiségek, Megjegyzések; alul választógomb.

## 11. Kiválasztás és galéria

- Az **Ezt választom** gombbal kiválasztod a kedvenced (csak elkészült fő képnél aktív). Alapbeállításban ekkor indul a kiválasztott ház **teljes galériájának** elkészítése („Elindítottuk a kiválasztott ház teljes galériájának elkészítését.”). Az üzemeltető beállíthatja, hogy mindhárom házhoz azonnal készüljön galéria.
- A **Galéria** fülei:
  - **Külső** – fő kép + külső nézetek (pl. elöl-, hátul-, oldalnézetek, madártávlat, kerti/teraszos, esti nézet – a csomagtól és a beállításoktól függően);
  - **Belső** – a kijelölt helyiségek belső képei;
  - **Tervvázlatok** – lásd 12. pont (ha az üzemeltető csomagja tartalmazza).
- A képek alatti címke a nézet nevét és a **tényleges felbontást** mutatja (pl. „2752×1536 · 2.5K”). **4K-nak csak a legalább 3840 px-es kép jelölődik**; a felskálázott kép „(felskálázott)” jelölést kap. Teszt módban: „Teszt kép”.
- Kattintásra nagyítás; a nagyított nézetben **←/→** nyilakkal lapozhatsz.
- **Letöltés:** alapbeállításban a **kiválasztott ház fő képe** tölthető le teljes méretben (**Fő látványkép letöltése**). Az üzemeltető ezt kikapcsolhatja, vagy minden képre kiterjesztheti.
- **Újragenerálás:** a kiválasztott változat a jelenlegi beállításokkal újra elkészül: új fő kép, majd friss galéria (a korábbi képek régebbi verzióként a háttérben megmaradnak, a galériában az újak látszanak). Indítás előtt megerősítő ablak: „A kiválasztott változat a jelenlegi beállításokkal újra elkészül (új fő kép és galéria). Ez a napi újragenerálási keretből használ fel egy alkalmat (a generálási keretet nem érinti), és további szolgáltatói költséggel jár.”, utána a hátralévő alkalmak száma. Az alkalom visszajár, ha az indítás hibára fut (pl. hibás beállítás), ha az új fő kép költség nélkül véglegesen sikertelen, vagy ha egy újabb újragenerálás lecseréli, mielőtt bármi elkészült volna.

## 12. Tervvázlatok

A tervvázlatok a ház adatmodelljéből **determinisztikusan** készülő, méretezett SVG-rajzok (nem MI-képek). Koncepciónként:

- szintenként: **Alaprajz**, **Bútorozott alaprajz**, **Méretezett alaprajzi koncepció**;
- **Tetőfelülnézet**, **Homlokzati nézetek**, **Metszeti koncepció**, **Helyiséglista**.

Ezek **nem engedélyezési és nem kiviteli tervek**. Hogy látod-e őket, azt az üzemeltető állítja be.

## 13. Mentés és ajánlatkérés – két külön művelet

### Mentés

- A **Mentés** gomb a generálás után aktív („A projekt a generálás után menthető.”). A **Projekt mentése** ablakban nevet adhatsz.
- **Vendégként** a mentett projekt ehhez a böngészőhöz kötődik; **bejelentkezve** a fiókodhoz, bármely eszközről elérhető.
- A mentéshez nem kell személyes adat, és nincs hozzájárulási jelölőnégyzet.

### Ajánlatkérés

- Az **Ajánlatkérés** gomb akkor aktív, ha kiválasztottál egy házváltozatot („Előbb generálj és válassz ki egy házváltozatot.”). A **Kivitelezői ajánlatkérés** ablak mezői: Teljes név\*, E-mail-cím\*, Telefonszám\*, Település\*, Tervezett építési helyszín, Tervezett kezdés, Becsült költségkeret, Megjegyzés.
- **Hozzájárulások** – külön jelölőnégyzetek, **mind üresen indulnak**:
  - ÁSZF elfogadása (csak ha az üzemeltető megadta);
  - „Megismertem az adatkezelési tájékoztatót.” – kötelező;
  - hozzájárulás a tervcsomag és az elérhetőségek kivitelezőnek továbbításához – kötelező;
  - marketing-hozzájárulás – **opcionális**, nem feltétele az ajánlatkérésnek.
- A hozzájárulásokat a dokumentum verziójával és időpontjával naplózzuk.
- **Az űrlap védelme:** megnyitáskor az űrlap a szervertől egy rövid életű űrlapkulcsot kér; amíg ez meg nem érkezik, az **Ajánlatkérés elküldése** gomb nem kattintható. Ha a kérés nem sikerül: „Az űrlap előkészítése nem sikerült.” – az **Újra** gombbal megismételhető. A beküldés a megnyitás után legalább 3 másodperccel és legfeljebb 2 órán belül fogadható el; különben: „Túl gyors beküldés. Kérjük, próbáld újra.”, illetve „Az űrlap munkamenete érvénytelen vagy lejárt. Kérjük, nyisd meg újra az ajánlatkérő űrlapot.” (`QuoteService::check_form_token()`).
- Elküldés: **Ajánlatkérés elküldése**. Ezután a kivitelező e-mailt kap egy **biztonságos, időkorlátos hivatkozással** (alapbeállítás: 168 óra), te pedig visszaigazoló e-mailt (ha az üzemeltető bekapcsolta).
- Projektenként egy ajánlatkérés küldhető a felületről; ezután a műveleti sáv: „Ajánlatkérés elküldve.” Az ajánlatkérés a projektet is mentettnek jelöli.
- A kivitelezői ZIP-csomag megvárja, amíg a kiválasztott ház galériája elkészül (legfeljebb 20 percig); ha addig sem készül el minden kép, a csomag a meglévőkből áll össze, és a mellékelt leírás felsorolja a hiányzó képeket.
- Napi korlát: IP-címenként 5 ajánlatkérés.

## 14. Projektjeim

- A fejléc (mobilon a „⋯” menü) **Projektjeim** pontja a legutóbbi 20 projektedet listázza állapottal (sorban, tervezés, képek készülnek, kész, részben kész, sikertelen, vázlat, leállítva), valamint **Mentve** és **Ajánlatkérés** jelöléssel. A **Megnyitás** visszatölti a beállításokat és a terveket.
- A listában a nem mentett generálásaid is szerepelnek.
- **Törlés:** a sor kuka ikonjával, soron belüli megerősítéssel („Biztosan törlöd ezt a projektet? A képek és a tervek véglegesen törlődnek.” → **Törlés** / **Mégse**). Siker esetén: „A projekt törölve.” Ajánlatkéréshez tartozó projekt nem törölhető („Nem törölhető: ajánlatkérés tartozik hozzá.”); ennek törlését az adatkezelőtől kérheted.
- Vendégként a projektek egy böngészősütihez kötődnek. A süti minden használatkor (a tervező megnyitása, generálás, mentés, ajánlatkérés, projektlista) megújul, és alapbeállítás szerint 180 napig érvényes (a nem mentett és a mentett projektek megőrzési ideje közül a hosszabb; `Access::guest_cookie_days()`). Más böngészőből vagy a süti törlése után vendégként nem érhetők el. Ha a weboldalon van fiókod, bejelentkezve a projektek a fiókodhoz kötődnek.
- **Megőrzés** (alapbeállítás, az üzemeltető módosíthatja): a nem mentett projektek 30, a mentettek 180 nap után (utolsó módosítástól) automatikusan törlődnek. Ajánlatkéréshez tartozó projektet az automatikus törlés nem érint.

## 15. Nyelv és megjelenés

- **Nyelv:** ha az üzemeltető csomagja tartalmazza a többnyelvű működést, és több nyelvet engedélyezett, a fejlécben (mobilon a „⋯” menüben) nyelvválasztó van. Váltáskor a felület újratöltődik, a beállításaid megmaradnak. (A fordítások gépi segítséggel készültek.) Az üzemeltető által átírt gyorsbemutató- és GYIK-szöveg egynyelvű: minden nyelven ugyanúgy jelenik meg.
- **Sötét mód:** a hold/nap ikonnal váltasz (**Sötét mód** / **Világos mód**). A választás a böngésződben megmarad; alapból a rendszered beállítását vagy az üzemeltető alapértelmezését követi.

## 16. Akadálymentesség

A kódban megtalálható megoldások (`assets/js/agh-designer.js`, `assets/css/agh-designer.css`):

- a tervező párbeszédablakként jelenik meg (`role="dialog"`, `aria-modal`); a Tab billentyű az ablakon belül marad; **Esc** a legfelső ablakot, illetve a tervezőt zárja; bezáráskor a fókusz visszakerül oda, ahonnan megnyitottad;
- a gombok állapota (`aria-pressed`, `aria-current`) és az ikonos gombok neve (`aria-label`) képernyőolvasóval olvasható; az értesítések élő régióban (`aria-live`) jelennek meg, a hibák `role="alert"`-tel;
- a folyamatsáv `role="progressbar"` értékkel rendelkezik; a billentyűzetfókusz látható kiemelést kap;
- a mobilos „⋯” menü gombja jelzi a nyitott/zárt állapotot (`aria-expanded`), a menüpontok között nyílbillentyűkkel (Home/End is) lehet lépkedni, az Esc bezárja; a projekttörlés megerősítése Esc-re csak a megerősítést zárja be;
- ha a rendszereden be van kapcsolva a „mozgás csökkentése” beállítás, az animációk gyakorlatilag kikapcsolnak; az üzemeltető az animációkat teljesen ki is kapcsolhatja.

Formális akadálymentességi (pl. WCAG) megfelelőségi vizsgálat nem készült – ez nem ellenőrzött.

## 17. Teszt mód

Ha az üzemeltető még nem kapcsolta be az éles képgenerálást, a felületen **Teszt mód** jelölés látszik: „Teszt mód: a képek helyi vázlatképek, nem AI-látványtervek…”. Ilyenkor a képek „TESZT KEP - NEM AI GENERALAS” feliratú (ékezet nélküli) tömegvázlatok, és „Teszt kép” címkét kapnak. Ha a képgenerálás egyáltalán nem működik (nincs beállított szolgáltató), a generálás gomb inaktív, a műveleti sáv pedig ezt írja: „A képgenerálás jelenleg nem érhető el. Kérjük, nézz vissza később.”

## 18. Gyakori üzenetek

| Üzenet | Teendő |
|---|---|
| „A háztervező nem tölthető be. Kérjük, próbáld újra később.” | Frissítsd az oldalt, vagy próbáld később. |
| „Hálózati hiba. Kérjük, próbáld újra.” | Ellenőrizd az internetkapcsolatot. |
| „Túl sok kérés rövid időn belül. Kérjük, várj néhány percet.” | Néhány perc múlva indítsd újra. |
| „Már fut egy generálásod. Kérjük, várd meg, amíg elkészül.” | Várd meg az előző generálás végét. |
| „A szolgáltatás költségkerete átmenetileg kimerült…” / „A szolgáltatás mai generálási kerete elfogyott…” | Az üzemeltető kerete fogyott el; próbáld később. |
| „A beállítások változtak – új generálással frissítheted a terveket.” | A meglévő tervek a korábbi beállításokkal készültek. |
| „A mai újragenerálási keret elfogyott.” / „A napi galéria-újragenerálási keret elfogyott.” | Az újragenerálás holnap ismét elérhető. |
| „A képgenerálás jelenleg nem érhető el. Kérjük, nézz vissza később.” | Az üzemeltető még nem kapcsolta be a képgenerálást. |
| „Az űrlap előkészítése nem sikerült.” (ajánlatkérés) | Kattints az **Újra** gombra. |
| „Az űrlap munkamenete érvénytelen vagy lejárt…” | Zárd be, és nyisd meg újra az ajánlatkérő űrlapot. |
| „A hivatkozás érvénytelen vagy lejárt.” (kivitelezői portál) | A kivitelező kérjen új hivatkozást az üzemeltetőtől. |

További kérdések: [GYIK.md](GYIK.md).
