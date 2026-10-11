# AutoGroweHome 1.0.0 – Élesítési ellenőrzőlista

Gyakorlati lista az éles indítás előtt. Minden pontnál ott a mód, ahogy ellenőrizheted. A WP-CLI parancsokat a WordPress gyökérkönyvtárában futtasd. Részletes háttér: `docs/TELEPITES.md`, `docs/KONFIGURACIO.md`, `docs/ADMIN-KEZIKONYV.md`.

> **Miért fontos ez a lista?** A plugin tesztkörnyezetben (SQLite, szimulált API-hívások, elkapott e-mailek) futott. **Élesben még nem ellenőrzött:** valós Magnific- és Anthropic-hívás, e-mail-kézbesítés, MySQL/MariaDB, valódi rendszer-cron. Ezeket az alábbi 12–13. szakasz végponttól végpontig tartó próbája fedi le.

---

## 1. Szerver és WordPress

- [ ] A webhely HTTPS-en fut, érvényes tanúsítvánnyal: `wp option get home` és `wp option get siteurl` is `https://`-sel kezdődik.
- [ ] Proxy/terheléselosztó mögött a WordPress felismeri a HTTPS-t (`is_ssl()`), különben a plugin sütijei `Secure` jelző nélkül készülnek.
- [ ] PHP ≥ 8.0, és megvannak a kiterjesztések: `php -m | grep -Ei '^(mbstring|zip|gd|sodium|openssl)$'`. Az **mbstring** nélkül a plugin nem tölt be (csak hibaüzenetet mutat).
- [ ] Admin → **Súgó és rendszer** → Rendszerállapot: „PHP-kiterjesztés: mbstring / sodium / gd / zip / json” mind ✓ rendben, Tárhely írható ✓, Adatbázis-verzió = 5.
- [ ] **Eszközök → Webhely állapota**: nincs loopback-hiba.
- [ ] A szerverről elérhető kimenő HTTPS-en a Magnific és (ha használod) az Anthropic API – a 2. szakasz kapcsolattesztje ezt igazolja.
- [ ] Az adatbázis MySQL/MariaDB → a 12. szakasz teljes próbája kötelező (ezen a motoron a plugin nem volt tesztelve).

## 2. API-kulcsok

- [ ] Az `AGH_SECRET_SALT` konstans be van állítva (ajánlott): így a WordPress-sók későbbi cseréje nem teszi olvashatatlanná a tárolt kulcsokat. Utólagos megadása a meglévő kulcsokat nem érvényteleníti, de **saját értékét később ne változtasd** – az olvashatatlanná tenné őket.
- [ ] Magnific-kulcs megadva – lehetőleg `wp-config.php`-ban (`AGH_MAGNIFIC_API_KEY`); az AI-szolgáltatók oldalon „wp-config.php konstansból” felirat látszik.
- [ ] AI-szolgáltatók → Kapcsolat teszt → **Magnific**: „Kapcsolat rendben … A kulcs hitelesítve.”
- [ ] (Opcionális) Anthropic-kulcs megadva, Kapcsolat teszt → **Anthropic**: „Kapcsolat rendben”, és **nincs** „a(z) … modell nem szerepel a listában” figyelmeztetés.
- [ ] Ha nem használsz Anthropicot: tudomásul vetted, hogy a koncepciókat a szabályalapú tervező készíti, és nincs „AI értelmezés” gomb.
- [ ] Az AI-szolgáltatók oldal mentése után **nem** jelent meg „…nem fogadható el – csak https:// cím…” figyelmeztetés (szolgáltatói URL-ek rendben).

## 3. Teszt mód kikapcsolva

- [ ] AI-szolgáltatók → Képgenerálás: **Aktív szolgáltató = Magnific**, **Tartalék szolgáltató = – nincs –** (vagy egy valódi szolgáltató), **Teszt mód engedélyezése = ki**.
- [ ] `wp agh status` kimenete: `Image provider: Magnific`, **nincs** `(TEST MODE)`.
- [ ] A Vezérlőpulton nincs „A képgenerálás TESZT módban fut” figyelmeztetés, és nincs „Nincs működő képszolgáltató” hiba.
- [ ] AI-szolgáltatók → Magnific API → **Tartalomszűrés (NSFW)** = be (alapértelmezés, ajánlott).
- [ ] Ha a webhookot használod: a „Webhook használata” súgójában látható tokenes URL-t sehol nem tetted közzé.

## 4. Cron és feladatsor

- [ ] Rendszer-cron beállítva, és `wp-config.php`-ban `define( 'DISABLE_WP_CRON', true );` (vagy tudatosan maradsz a WP-Cronnál).
- [ ] A rendszer-cron a WordPress-eseményeket is futtatja (`wp cron event run --due-now`), nem csak a `wp agh queue run`-t – különben elmarad a napi licencellenőrzés és adatmegőrzési takarítás.
- [ ] `wp agh queue run --seconds=20` lefut, és „… job(s) processed, … pending.” sort ír ki.
- [ ] `wp cron event list | grep agh_` mutatja az `agh_cron_queue` (percenkénti) és az `agh_cron_daily` (napi) eseményt, és a következő futási idő a közeljövőben van.
- [ ] Egy generálás után a függő feladatok száma visszaáll 0-ra: `wp agh status` → `Pending jobs: 0`, illetve Vezérlőpult → „Feladatsor: 0 függő feladat”.
- [ ] Másnap: az `agh_cron_daily` következő futási ideje előrébb lépett (`wp cron event list`).

## 5. Védett tárhely

- [ ] A tesztfájl nem érhető el weben:
  ```bash
  SUFFIX=$(wp option get agh_private_suffix)
  curl -s -o /dev/null -w '%{http_code}\n' "https://example.hu/wp-content/uploads/agh-private-${SUFFIX}/agh-probe.txt"
  ```
  Elvárt: `403` vagy `404`. (Ha `AGH_PRIVATE_DIR`-t használsz, ez a lépés nem értelmezett.)
- [ ] Nginx esetén a tiltó `location ^~ /wp-content/uploads/agh-private-` blokk be van állítva (`docs/TELEPITES.md`, 6.2).
- [ ] Súgó és rendszer → „Tárhely nyilvános?” = „nem (rendben)”.
- [ ] Nincs „A védett tárhely könyvtár HTTP-n keresztül elérhető!” hiba az adminban.

## 6. E-mail-kézbesítés

- [ ] SMTP-bővítmény (vagy tranzakciós e-mail-szolgáltatás) beállítva; a `wp_mail()` nem a szerver alapértelmezett `mail()`-jén megy.
- [ ] A feladó domainjére SPF és DKIM (és lehetőleg DMARC) rekord van beállítva.
- [ ] Kivitelező és e-mail → **Feladó e-mail** ugyanazon a domainen van, amelyre az SPF/DKIM szól; **Feladó neve** kitöltve.
- [ ] **Teszt e-mail küldése magamnak** → megérkezett, és nem a spam mappába.
- [ ] **Értesítési e-mail-cím** a valódi kivitelezői cím (alapból a WordPress admin címe!).
- [ ] **Kivitelező neve** (a levél megszólítása) kitöltve, vagy tudatosan a kapcsolattartó / vállalkozás neve szerepel.
- [ ] Agency csomagban több kivitelezőnél: „Több kivitelező értesítése” be, „További kivitelezői címek” kitöltve.
- [ ] Ha kivitelezőnek WordPress-fiókot adsz („AutoGroweHome kivitelező” szerepkör): a fiók e-mail-címe **egyezik** azzal a címmel, amelyre az értesítés megy – a portál csak az erre a címre kiküldött ajánlatkéréseket mutatja.
- [ ] Az e-mail-sablonokat átnézted (egyszerű szöveg, HTML nem használható; változók: `{client_name}`, `{link}`, `{expires}` stb.).
- [ ] **Értesítések nyelve** megfelel a kivitelezőnek.

## 7. Jogi dokumentumok és hozzájárulások

- [ ] Az ÁSZF és az adatkezelési tájékoztató **jogász által átnézett** végleges szöveg (a plugin szövegei és a WordPress adatvédelmi útmutatóba kerülő részlet csak sablon).
- [ ] Jogi és GDPR → **Adatkezelési tájékoztató URL** kitöltve (nincs rá vonatkozó figyelmeztetés a Vezérlőpulton).
- [ ] Ha ÁSZF-elfogadás kell: **ÁSZF URL** kitöltve és **ÁSZF elfogadása szükséges** be (URL nélkül a jelölőnégyzet nem jelenik meg).
- [ ] **ÁSZF verzió** és **Adatkezelési tájékoztató verzió** a ténylegesen közzétett dokumentumok verziójára állítva (ez kerül a hozzájárulási naplóba).
- [ ] A kapcsolatfelvételi és a marketing-hozzájárulás szövegét a jogász jóváhagyta; eldöntötted, kell-e marketing-hozzájárulás.
- [ ] Eldöntötted (jogi tanács alapján), kell-e a user agent naplózása a hozzájárulásokhoz (Jogi és GDPR → „Böngészőazonosító (User-Agent) rögzítése”, alapból ki – `docs/KONFIGURACIO.md`, 5.10).
- [ ] Az adatkezelési tájékoztató említi: AI-szolgáltatók (Magnific, Anthropic) adatfeldolgozása, IP-cím hash-elt kezelése, a megőrzési idők, a kivitelezőnek való továbbítás.
- [ ] Az adatmegőrzési idők (nem mentett / mentett projekt, ajánlatkérés, napló, kivitelezői csomag) a jogi tanács szerint vannak beállítva.

## 8. Katalógus (BRAMAC)

- [ ] Katalógus → Tetőfedési termék: mind a 29 előre feltöltött BRAMAC termék–szín össze van vetve a hivatalos BRAMAC-katalógussal; a hibás tételek javítva vagy rejtve.
- [ ] Az ellenőrzött tételeknél az **Ellenőrzött** jelölés be van kapcsolva.
- [ ] A Vezérlőpulton eltűnt a „N tetőfedési termék nincs ellenőrzöttként jelölve” figyelmeztetés.
- [ ] Tudod, hogy magastetőnél a BRAMAC kötelező márka, és termék nélküli választásnál a rendszer automatikusan választ (ajánlott termék, ennek hiányában a tetőszínhez legközelebbi).
- [ ] Katalógus → Tetőfedési márka: a BRAMAC sorában „kötelező” jelölés és „nem törölhető” felirat látszik (a márka nem rejthető el és nem törölhető – `docs/ADMIN-KEZIKONYV.md`, 3.8). Próba: a tervezőben magastetőnél a márkaválasztó csak BRAMAC-ot kínál.
- [ ] A színminták (HEX) csak közelítések – ha a látogató ezek alapján választ, ezt a kommunikációban kezeled.

## 9. Napi keret, proxyk, költség

- [ ] Limitek és hozzáférés → az oldal tetején az **effektív IP-limit** a kívánt érték (a csomag `max_ip_daily` értéke felülről korlátozza).
- [ ] Proxy/CDN (pl. Cloudflare) mögött: **Megbízható proxyk / CDN** és **Továbbított IP fejléc** beállítva.
- [ ] Próba: egy saját generálás után a „saját IP ma” értéke pontosan 1-gyel nő, és egy másik hálózatról indított generálás nem a te számlálódat növeli. (IPv6-nál a /64 előtag számít.)
- [ ] **Globális napi limit** és **visszaélésvédelem** (időablak / max. kérés) a várható forgalomhoz igazítva.
- [ ] **Galéria újragenerálás / nap / IP** (a koncepció-újragenerálás saját napi kerete; a globális napi keretből nem fogy) a kívánt érték.
- [ ] **Egyszerre futó háttérfeladatok** (`max_parallel_jobs`, alapból 4) a szerver kapacitásához igazítva.
- [ ] AI-szolgáltatók → Költségbecslés: az árak a szolgáltató **aktuális** árlistájából kitöltve (0-val a költségkeret soha nem telik be).
- [ ] **Napi / havi költségkeret** beállítva (ha kell). Tudod, hogy a keretet új generálás és koncepció-újragenerálás indításakor vizsgálja a rendszer, és ez az ellenőrzés nem atomikus.
- [ ] **Galéria készítése** = „Csak a kiválasztott házhoz” (hacsak nem szándékosan vállalod a háromszoros képköltséget).

## 10. Nyelvek

- [ ] **Felület alapnyelve**: `hu_HU` (mindig magyar) vagy „A webhely nyelve” – tudatos döntés.
- [ ] **Választható nyelvek** listája a célpiacnak megfelelő (a nyelvválasztó Professional csomagtól látszik).
- [ ] A használt nyelvek fordítását anyanyelvi lektor átnézte (a fordítások gépi fordítások).
- [ ] Egyedi paramétereknél a „Fordítások” kitöltve.
- [ ] Tudod, hogy a szerkesztett gyorsbemutató és GYIK minden nyelven ugyanazzal a szöveggel jelenik meg (a gyári szöveg fordított).

## 11. Arculat és elhelyezés

- [ ] Arculat és elrendezés: termék neve, logó, fő márkaszín, indítógomb felirata beállítva (Starterben csak ezek érvényesülnek a tervezőben).
- [ ] Döntöttél a **lebegő indítógombról**; ha ki van kapcsolva, az `[autogrowehome]` shortcode a megfelelő oldalakon szerepel.
- [ ] Ha saját linkkel indítod: egy `#agh-open`-re mutató link (vagy `data-agh-open="1"` elem) a betöltőt tartalmazó oldalon megnyitja a tervezőt.
- [ ] A tervező mobilon (kb. 390 px szélesség) és asztali gépen is megnyílik, a gombok nem lógnak ki.
- [ ] A kivitelezői portál (`/?agh-portal=1`) a márka nevét mutatja.

## 12. Teljes generálás végponttól végpontig (éles kulccsal)

- [ ] Privát böngészőablakban, látogatóként: tervező megnyitása → paraméterek → **Generálás** → megjelenik a három koncepció.
- [ ] Egy koncepció kiválasztása → elkészül a galéria (és Professional+ csomagban a tervvázlatok).
- [ ] A fő kép letölthető (ha a hozzáférési beállítás engedi).
- [ ] Admin → Projektek → a projekt: a képek állapota kész, szolgáltató `magnific`, **nincs** `TEST` jelölés, a felbontásfelirat a vártnak megfelelő (4K-felirat csak ≥ 3840 px-es képen).
- [ ] A projekt költsége megjelenik (ha kitöltötted az árakat), és összevetve a Magnific-fiók tényleges terhelésével reális.
- [ ] Ha van Anthropic-kulcs: a koncepciókártyán a tervező forrása `anthropic:<modell>`, nem `rules`; a naplóban nincs „Anthropic planner failed” bejegyzés.
- [ ] Ha egyedi paramétereket használsz: a Promptmotor „Előnézet” gombjával ellenőrizted, hogy a promptszövegük megjelenik (`{custom_params}`).
- [ ] Statisztika: a generálási kérések száma nőtt.
- [ ] Súgó és rendszer → Napló: nincs `error` szintű bejegyzés a próbából.

## 13. Ajánlatkérés → kivitelezői e-mail → védett hozzáférés

- [ ] Az ajánlatkérő űrlap megnyílik, a beküldés gomb a betöltés után aktív; a beküldés minden kötelező hozzájárulással sikeres.
- [ ] Ajánlatkérések → az új tétel állapota `pending` → `notified` (a galéria elkészülte után, legfeljebb kb. 20 perc várakozással + a cron gyakorisága).
- [ ] A hozzájárulási naplóban minden hozzájárulás szerepel a helyes dokumentumverzióval, plusz egy `forwarding` / `forwarded` sor.
- [ ] A kivitelezői e-mail megérkezett, a megszólítás helyes; a benne lévő hivatkozás `/?agh-portal=1#t=…` formájú.
- [ ] A hivatkozást **másik böngészőben, bejelentkezés nélkül** megnyitva a portál csak ezt az egy projektet mutatja, és a token eltűnik a címsorból.
- [ ] A ZIP-csomag letölthető; tartalma: `00_OLVASSEL.txt`, `01_Fokep` … `05_Dokumentumok`; a `kepek-metaadatai.csv`-ben `test_image` = `no`; a `00_OLVASSEL.txt` nem sorol fel hiányzó képet.
- [ ] A letöltésszám az admin ajánlatkérés-részleteken nőtt.
- [ ] Ha a hivatkozás `#t=` utáni részében egy karaktert másik hexadecimális karakterre (0–9, a–f) cserélsz, a portál „A hivatkozás érvénytelen vagy lejárt…” üzenetet ad.
- [ ] Az ügyfél megkapta a visszaigazoló e-mailt (ha be van kapcsolva) – pontosan egyszer.
- [ ] „Értesítés újraküldése (új link)”: új levél érkezik, és a **régi** hivatkozás ezután már érvénytelen.
- [ ] „Hozzáférés visszavonása”: a portál a megnyitott munkamenetben is elveszíti a hozzáférést.
- [ ] Egy **teszt** ajánlatkérésen kipróbáltad a „Személyes adatok anonimizálása” gombot (a csomag törlődik, a név `[törölve]`, a projekt eltűnik a Projektek listából).

## 14. Mentés és visszaállítás

- [ ] Az adatbázis-mentés tartalmazza a `{prefix}agh_*` táblákat és az `agh_*` opciókat.
- [ ] A fájlmentés tartalmazza a védett tárhelyet (`uploads/agh-private-<utótag>/` vagy az `AGH_PRIVATE_DIR` útvonal – utóbbi a webgyökéren kívül van, külön fel kell venni!).
- [ ] Az `AGH_SECRET_SALT` (ennek hiányában a `wp-config.php` `AUTH_SALT` és `SECURE_AUTH_SALT` értéke) biztonságosan meg van őrizve – nélküle a tárolt kulcsok visszaállítás után nem fejthetők vissza.
- [ ] Egy visszaállítási próbát elvégeztél tesztkörnyezetben.

## 15. Licenc

- [ ] Licencszerver URL (HTTPS) és nyilvános kulcs beállítva (adminban vagy `AGH_LICENSE_SERVER` / `AGH_LICENSE_PUBKEY` konstanssal).
- [ ] Licenckulcs aktiválva: Licenc oldal → Állapot = **Aktív**, Csomag és **Effektív csomag** a megvásárolt csomag; a csomagtáblázatban ennél az „aktív” jelölés látszik.
- [ ] **Ellenőrzés** gomb sikeres, „Utolsó hiba” = –.
- [ ] Frissítési jogosultság ✓ (ha része a licencnek).
- [ ] Az `AGH_OWNER_MODE` konstans **nincs** megadva olyan telepítésen, amely nem jogosult rá.

## 16. Zárás

- [ ] Vezérlőpult → Konfigurációs állapot: „Minden alapbeállítás rendben.” (vagy minden megmaradt figyelmeztetés tudatos döntés).
- [ ] A beállítás közben létrehozott próbaprojekteket törölted, a próba-ajánlatkéréseket anonimizáltad (ajánlatkéréses projekt nem törölhető).
- [ ] Jogi és GDPR → „Minden adat törlése a plugin eltávolításakor” = **ki** (ajánlott, hogy egy véletlen eltávolítás ne töröljön adatot).
- [ ] A kivitelező tudja, hogyan használja a portált, és hogy a hivatkozás `Hivatkozás érvényessége` (alapból 168 óra) után lejár; a lejáratig többször is megnyitható.

---

### Hasznos parancsok egy helyen

```bash
wp agh status                                   # szolgáltató, teszt mód, függő feladatok
wp agh queue run --seconds=50                   # feladatsor feldolgozása kézzel (vagy: wp agh queue)
wp agh retention                                # adatmegőrzési takarítás most
wp cron event list | grep agh_                  # ütemezett események
wp option get agh_private_suffix                # védett könyvtár utótagja
wp option get agh_db_version                    # adatbázis-verzió (elvárt: 5)
```
