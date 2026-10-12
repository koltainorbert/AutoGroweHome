# ALLAPOT – AutoGroweHome (frissítve: 2026-10-12)

**Verzió:** 1.0.0 · DB v5 · Repó: github.com/koltainorbert/AutoGroweHome (main) · ZIP: dist/autogrowehome-1.0.0.zip (varázsló, mobil javítások, 16 stílusminta, valós idejű 3D előnézet WebGL-lel, 3D-s opciókártyák, új ikonok). A htombau oldalon még a varázsló előtti fájlok vannak.

**Chat elején:** kösd be a repót (koltainorbert/AutoGroweHome, írási joggal), kövesd a CLAUDE.md-t; tesztkörnyezet: `bin/test-wp.sh`.

**Mérve:** autoloader 119/119 · lint 0 · 15 nyelv × 1595 szöveg, 0 hiba · vázlat-önteszt 1017 rajz/180 változat, 0 hiba · felületi lefedettség 116 mező (2D és 3D), 0 hiba · E2E (Playwright): tervező 7 mobil/tablet méret × 3 fül – túllógás 0, 44 px alatti cél 0, ráközelítő mező 0, konzolhiba 0; varázsló 6 méret × 7 lépés – túllógás 0, dupla id 0, konzolhiba 0; generálás a varázslóból 202 → Koncepciók fül. Régi, nem a repóban lévő tesztsor: integráció 147/147 · regresszió 120/116/71 · licencszerver 32/32.

**Döntések**
- Minden változtatás automatikusan a repóba megy (teszt → commit → push main, ZIP újraépítés); ez a fájl a repóban és a projektben azonos.
- Gyors varázsló a kezdőnézet (layout.start_view, alap: wizard); 7 lépés, ugyanaz a konfiguráció/ellenőrzés/generálás; a látogató választását a böngésző megjegyzi; stílusválasztáskor a stíluscsomag a nem saját értékekre beáll.
- Forrásnyelv magyar; 16 nyelv; .mo fordítás: bin/po-tools.py. Teszt mód NEM automatikus tartalék.
- 1 kérés = 3 koncepció = 1 egység; újragenerálás külön napi keretből.
- BRAMAC magastetőnél kötelező, auto-választás; katalógus verified:false.
- Kivitelezői link: időkorlátos, többször használható, címzetthez kötött, visszavonható. Csomagmátrix csak AGH_OWNER_MODE-ban szerkeszthető.
- Licenc: Ed25519, 14 nap türelmi idő, frissítés nonce + SHA-256. Eltávolítás alapból megtartja az adatokat.
- Stílusminták: assets/img/options/{mező}/{érték}.webp + thumb/ – a séma automatikusan átadja; bármely opcióhoz (pl. tetőforma, homlokzat) hasonlóan bővíthető.
- Előnézet: 3D (assets/js/agh-3d.js + agh-3d-tex.js, three.js r170 a vendor/three-ban, procedurális PBR-textúrák, letöltés nélkül); tartalék és változásjelzés: 2D agh-sketch.js. Új látható paraméter: 2D VISUAL + visibleFor, és a 3D is.
- Tervező: backdrop-filter csak kis elemen; mobil elrendezés ≤820 px és fekvő telefonon; érintési célok 44 px, mezők 16 px.
- Autoloader: útvonal mindig „/”-rel (Windows).
- Minden új ZIP új verzió: bin/bump-version.sh (patch; nagy funkciónál minor); a build-zip.sh nem építi újra a kiadott verziót.
- Helyi teszt: Local (Windows) – C:\Users\Andi\Local Sites\htombau.

**Nyitott tételek**
- GitHub-fiók: számlázási zárolás (Actions nem indul); a repó NYILVÁNOS – privátra állítani.
- Valódi koncepcióképek: Magnific API-kulcs (docs.magnific.com, x-magnific-api-key) az admin AI-szolgáltatók oldalán; utána éles végigteszt.
- htombau: új ZIP telepítése, majd Firefoxban/telefonon visszaigazolni a varázslót és az akadozás megszűnését.
- Varázsló 5. lépés: a színminták 28 px-esek (WCAG AA 24 px teljesül, 44 px nem).
- Új fordítások (27 szöveg) anyanyelvi lektorálása a többivel együtt.
- Teljes forrás-ZIP (tools/license-server, régi tesztsor) nincs a repóban – ha megvan, feltölteni.
- Éles Magnific + Anthropic kulccsal végigtesztelni; MySQL/MariaDB, SMTP/SPF/DKIM, éles cron; Windows: privát tároló, fájlírás.
- BRAMAC katalógus gyártói ellenőrzése; jogi szövegek + LICENSE.txt jogászi véglegesítése.
- Fizetési kapu (csak interfész); licencszerver éles telepítése, AGH_LICENSE_PUBKEY.
- Ismert korlátok: docs/BIZTONSAGI-ELLENORZOLISTA.md C rész; docs/BOVITESI-TERV.md.
