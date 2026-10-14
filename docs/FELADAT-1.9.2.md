# FELADAT – 1.9.2: a védett tárhely figyelmeztetés legyen megoldható

Norbi szövege (2026-10-14):

> AutoGroweHome: A védett tárhely könyvtár HTTP-n keresztül elérhető! A szerver nem veszi
> figyelembe a .htaccess tiltást (pl. Nginx). Állíts be tiltást vagy használd az AGH_PRIVATE_DIR
> konstanst webgyökéren kívüli útvonallal. mit tegyek?

**Minden maradjon meg**, ami ma működik (a tárolás helye, a REST-fájlvégpont jogosultság-ellenőrzése,
az uninstall viselkedése, a meglévő projektek fájljai). A figyelmeztetés maradjon ott, ahol van, csak
legyen belőle elvégezhető feladat.

## 1. Mi a baj (gyökérok)

- A `Storage::ensure_private_dir()` `.htaccess`-t, `web.config`-ot és `index.php`-t ír a könyvtárba
  (`includes/Support/Storage.php`). Nginx nem olvas `.htaccess`-t, Apache pedig csak akkor, ha
  `AllowOverride` engedi – ilyenkor a `wp-content/uploads/agh-private-<16 jel>/` alatti fájlok
  közvetlen URL-lel letölthetők, a jogosultság-ellenőrzött REST-végpont megkerülésével.
- A könyvtárban ügyféladat is van: koncepcióképek, tervlapok, és a kivitelezői ZIP, benne az
  ügyfél leírásával, a paraméterösszesítővel és a hozzájárulási naplóval (`PackageBuilder`).
  Az URL kitalálása nehéz (véletlen könyvtárnév + projekt-UUID), de a kiszivárgott link örökre él.
- A `Storage::health()` HTTP-n lekéri a saját `agh-probe.txt`-jét, és ha 200-at kap, jelez.
  Az eredmény **egy órára transientbe kerül** (`agh_storage_health`), és **nincs újraellenőrzés**:
  a szerver javítása után a hibaüzenet akár egy óráig megmarad, ezért nem derül ki, hogy sikerült-e.
- A figyelmeztetés nem mondja meg, **mit kell pontosan beírni**, és nem mutatja, **melyik könyvtárról**
  van szó.
- Ha a `AGH_PRIVATE_DIR` konstans utólag kerül be, a régi könyvtárban maradt fájlokra a projektek
  tovább hivatkoznak, de a plugin már az új helyen keresi őket: **a régi képek eltűnnek**. Ma nincs
  áthelyező eszköz.

## 2. Mi legyen (mérhetően kész)

1. **A figyelmeztetés legyen önmagában elvégezhető**: mutassa a könyvtár valódi útvonalát, és adja
   oda mindkét megoldást másolható formában – (a) `wp-config.php`: `define( 'AGH_PRIVATE_DIR', '…' );`
   webgyökéren kívüli útvonallal, (b) Nginx `location` blokk a könyvtár tiltására.
   Kész: a dashboard hibaüzenetében ott az útvonal és mindkét kódrészlet.
2. **„Ellenőrzés újra” gomb** a figyelmeztetés mellett: törli az `agh_storage_health` transientet és
   azonnal újra méri. Kész: a gomb után a lap az aktuális állapotot mutatja, nem az órás gyorsítótárat.
3. **Áthelyező eszköz**: ha az `AGH_PRIVATE_DIR` be van állítva, de a régi
   `uploads/agh-private-<suffix>/` könyvtárban még vannak projektmappák, egy gombbal átkerülnek az új
   helyre (projektmappánként, UUID-ellenőrzéssel, a már létező célfájlt nem írja felül), és a régi
   könyvtár kiürülve törlődik. Kész: a mozgatás után a régi helyen 0 projektmappa, az új helyen
   ugyanannyi, és a `Storage::path()` minden áthelyezett fájlt megtalál.
4. **Dokumentáció**: a telepítési útmutatóban külön szakasz a védett tárhelyről, az Nginx-blokkal és
   a `wp-config.php` sorral, és azzal, hogy miért fontos (ügyféladat).
5. Új szöveg mind a 15 nyelvre, `po-tools.py check` 0 hiba.
6. **Teszt**: `tests/storage-test.php` (a tesztoldalon, WordPress-szel): alapállapot → a próbafájl
   HTTP-n elérhető (a tesztszerver is figyelmen kívül hagyja a `.htaccess`-t, tehát pont Norbi esete);
   `AGH_PRIVATE_DIR` beállítva → `health()['public']` hamis és `base_url()` üres; az áthelyező
   mozgatás után minden fájl az új helyen van és olvasható, a régi könyvtár törlődött.

## 3. Amit nem szabad elrontani

- A `Storage::path()` ne engedjen ki a bázison kívülre (`..`, abszolút út) – a mostani ellenőrzés marad.
- Az `uninstall.php` viselkedése marad: saját könyvtárat teljesen töröl, egyéni könyvtárból csak a
  plugin saját tartalmát.
- Az áthelyezés ne írjon felül létező fájlt a célban, és ne hagyjon félkész állapotot: ami nem ment át,
  arról számoljon be darabszámmal.
