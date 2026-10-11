# ALLAPOT – AutoGroweHome (frissítve: 2026-10-11)

**Verzió:** 1.0.0 · DB v5 · Repó: github.com/koltainorbert/AutoGroweHome (main) · ZIP: dist/autogrowehome-1.0.0.zip (autoloader-javítással). A Letöltések mappában lévő régi ZIP hibás.

**Chat elején:** kösd be a repót (koltainorbert/AutoGroweHome, írási joggal), és kövesd a benne lévő CLAUDE.md-t.

**Mérve:** autoloader-teszt 119/119 (55 osztály) · lint 0 · ZIP 121 fájl. Korábbi, csak Linuxon mért számok (a tesztsor nincs a repóban): integráció 147/147 · regresszió 120/116/71 · licencszerver 32/32 · 15 nyelv × 1565 szöveg · E2E 0 konzolhiba.

**Döntések**
- Minden változtatás automatikusan a repóba megy: teszt → commit → push a main-re, kérdés nélkül; kódváltozásnál a ZIP is újraépül. Ez a fájl a repóban (ALLAPOT.md) és a projektben azonos.
- Forrásnyelv magyar; 16 nyelv. Teszt mód NEM automatikus tartalék (kulcs nélkül „nem érhető el”).
- 1 kérés = 3 koncepció = 1 egység; újragenerálás külön napi keretből (gallery_rebuilds_per_day).
- BRAMAC magastetőnél kötelező, auto-választás; katalógus verified:false.
- Kivitelezői link: időkorlátos, többször használható, címzetthez kötött, visszavonható.
- Csomagmátrix csak AGH_OWNER_MODE-ban szerkeszthető; ügyféloldalon fix.
- Licenc: Ed25519, 14 nap türelmi idő, frissítés nonce + SHA-256; referencia-szerver: tools/license-server.
- Eltávolítás alapból megtartja az adatokat (delete_on_uninstall kapcsoló).
- Autoloader: útvonal mindig „/”-rel, DIRECTORY_SEPARATOR tilos (Windowson aktiváláskor fatal volt).
- Repó gyökere = a plugin; ZIP: bin/build-zip.sh. Verzió maradt 1.0.0 (kiadás előtti javítás).
- Helyi teszt: Local (Windows, nginx, MySQL) – C:\Users\Andi\Local Sites\htombau.

**Nyitott tételek**
- htombau: aktiválás visszaigazolása a javítással, utána Windowson végignézni (privát tároló, fájlírás, cron).
- A teljes forrás-ZIP (tools/license-server, integrációs és regressziós tesztek) nincs a repóban – ha megvan, feltölteni.
- Éles Magnific + Anthropic kulccsal végigtesztelni (eddig szimulált szerződés).
- MySQL/MariaDB teljes kör, valódi e-mail (SMTP/SPF/DKIM), éles cron.
- BRAMAC katalógus gyártói ellenőrzése.
- Jogi szövegek + LICENSE.txt jogászi véglegesítése; fordítások anyanyelvi lektorálása.
- Fizetési kapu (Stripe/Barion/SimplePay) – csak interfész van.
- Licencszerver éles telepítése, kulcspár, AGH_LICENSE_PUBKEY.
- Ismert korlátok: docs/BIZTONSAGI-ELLENORZOLISTA.md C rész; docs/BOVITESI-TERV.md.
