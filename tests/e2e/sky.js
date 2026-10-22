// Égbolt-fénykép (HDRI) E2E (1.26.0), a tesztoldalon (bin/test-wp.sh):
//  (1) az assets/sky csomag: manifest (CC0, forrás, md5 egyezik a fájllal), a fájlok összmérete kiírva (cél ≤ 3 MB);
//  (2) a 3D a napszakhoz / időjáráshoz tartozó fényképet tölti be (reggel, dél, dél tiszta, aranyóra, kék óra,
//      éjszaka, borult) – időszakonként másik kép, a háttér és a környezeti fény (PMREM) is abból;
//  (3) a kép napja a jelenet napja felé fordul (a tájolással együtt), a fényerő a festett éghez igazodik;
//  (4) ha a fájl nem tölthető be (blokkolt kérés), a festett ég marad, konzolhiba nélkül;
//  (5) beltéri nézetben és az opciókártyákon (egy tárgy) a régi környezet marad; konzolhiba 0.
// Használat: node tests/e2e/sky.js   (AGH_URL=http://127.0.0.1:<port>/tervezo/)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const SKYDIR = path.join(__dirname, '..', '..', 'assets', 'sky');

(async () => {
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  // (1) the package on disk
  const man = JSON.parse(fs.readFileSync(path.join(SKYDIR, 'manifest.json'), 'utf8'));
  let bytes = 0, md5ok = 0, cc0 = 0;
  const names = Object.keys(man.skies);
  names.forEach(k => { const s = man.skies[k], f = fs.readFileSync(path.join(SKYDIR, s.file)); bytes += f.length; if (crypto.createHash('md5').update(f).digest('hex') === s.md5) { md5ok++; } if (s.license === 'CC0' && /^https:\/\/polyhaven\.com\/a\//.test(s.url) && s.md5_source) { cc0++; } });
  fs.readdirSync(SKYDIR).forEach(f => { if (!/\.webp$/.test(f)) { bytes += fs.statSync(path.join(SKYDIR, f)).size; } });
  ok(names.length >= 6 && md5ok === names.length, 'égbolt-csomag: ' + names.length + ' kép, md5 egyezik ' + md5ok + '/' + names.length);
  ok(cc0 === names.length && fs.existsSync(path.join(SKYDIR, 'LICENSE.txt')), 'CC0 forrás és licenc minden képnél (' + cc0 + '/' + names.length + ')');
  ok(bytes <= 3 * 1024 * 1024, 'assets/sky összesen ' + Math.round(bytes / 1024) + ' KB (≤ 3 MB)');

  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('agh_e2e_sky')) { localStorage.clear(); localStorage.setItem('agh_e2e_sky', '1'); } localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-preview-box.has-3d canvas', { timeout: 120000 });
  await page.waitForTimeout(2500);
  // (2)+(3) every time of day and the weather variants
  const cases = [['morning', 'few_clouds', 'morning'], ['midday', 'few_clouds', 'midday'], ['midday', 'clear', 'midday_clear'], ['golden', 'few_clouds', 'golden'], ['blue', 'few_clouds', 'blue'], ['night', 'few_clouds', 'night'], ['golden', 'overcast', 'overcast'], ['midday', 'overcast', 'overcast']];
  const seen = {};
  for (const [tod, w, want] of cases) {
    const r = await page.evaluate(async ([tod, w]) => {
      const A = window.AGH_3D;
      window.AGH_Designer.set({ time_of_day: tod, weather: w });
      const t0 = Date.now();
      while (Date.now() - t0 < 30000) {
        await new Promise(r => setTimeout(r, 300));
        const v = A.viewer(), cur = A.sky.current();
        if (v.c && v.c.time_of_day === tod && v.c.weather === w && cur.photo && cur.photo === cur.want) { break; }
      }
      const v = A.viewer(), bg = v.scene.background, sky = bg && bg.userData && bg.userData.sky;
      // the sun's column in the picture (brightest texel of the upper half) against the scene's sun azimuth
      let sunU = null;
      if (sky && bg.image && bg.image.data) {
        const d = bg.image.data, W = bg.image.width, H = bg.image.height, h2f = (h) => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * Math.pow(2, -14) * f / 1024 : (e === 31 ? 0 : s * Math.pow(2, e - 15) * (1 + f / 1024)); };
        let best = -1, bx = 0;
        for (let y = Math.floor(H * 0.5); y < H; y += 2) { for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4, L = h2f(d[i]) * 0.2126 + h2f(d[i + 1]) * 0.7152 + h2f(d[i + 2]) * 0.0722; if (L > best) { best = L; bx = x; } } }
        sunU = (bx + 0.5) / W;
      }
      const sd = v.sunDir, want = Math.atan2(sd.z, sd.x) / (2 * Math.PI) + 0.5;
      return { photo: v.env.photo, env: !!v.scene.environment, sky, sunU, want, scale: sky ? sky.scale : 0 };
    }, [tod, w]);
    seen[r.photo] = 1;
    ok(r.photo === want && r.env && r.sky && r.sky.name === want, tod + ' / ' + w + ': „' + want + '” égbolt-fénykép a háttérben és a fényben (' + (r.photo || 'festett') + ')');
    if (tod !== 'blue' && tod !== 'night' && w !== 'overcast') {
      const du = r.sunU === null ? 1 : Math.min(Math.abs(r.sunU - r.want), 1 - Math.abs(r.sunU - r.want));
      ok(du < 0.03, tod + ': a kép napja a jelenet napja felé néz (eltérés ' + Math.round(du * 360) + '°)');
    }
  }
  ok(Object.keys(seen).filter(Boolean).length >= 6, 'időszakonként másik kép (' + Object.keys(seen).filter(Boolean).length + ' különböző)');
  // orientation turns the sun (and the picture with it)
  const rot = await page.evaluate(async () => {
    const A = window.AGH_3D, roll = () => A.viewer().scene.background.userData.sky.roll;
    window.AGH_Designer.set({ time_of_day: 'golden', weather: 'few_clouds', orientation: 'south' }); await new Promise(r => setTimeout(r, 2500));
    const a = roll();
    window.AGH_Designer.set({ orientation: 'west' }); await new Promise(r => setTimeout(r, 2500));
    return [a, roll()];
  });
  ok(rot[0] !== rot[1], 'a tájolás elforgatja az égboltot (oszlop ' + rot[0] + ' → ' + rot[1] + ')');
  // (5) interior and single item: the old environment
  const inner = await page.evaluate(async () => {
    const v = window.AGH_3D.viewer(), c = Object.assign({}, v.c);
    v.update(Object.assign({}, c, { _int: { type: 'living' } }), 'interior'); const a = v.env.photo;
    v.update(c); return a;
  });
  ok(inner === '', 'beltéri nézetben a régi (szobai) környezet marad');
  // painted sky on request (paintedSky) and back
  const painted = await page.evaluate(async () => { const A = window.AGH_3D; A.paintedSky(true); const a = A.viewer().env.photo; A.paintedSky(false); await new Promise(r => setTimeout(r, 300)); return [a, A.viewer().env.photo]; });
  ok(painted[0] === '' && painted[1] !== '', 'festett ég kérésre, utána újra a fénykép');
  await ctx.close();

  // (4) blocked sky files: the painted sky, no console error
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx2.addInitScript(() => { try { localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  await ctx2.route(/\/assets\/sky\/.*\.webp/, r => r.abort());
  const p2 = await ctx2.newPage();
  const err2 = [];
  p2.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) err2.push(m.text().slice(0, 200)); });
  p2.on('pageerror', e => err2.push('pageerror: ' + e.message.slice(0, 200)));
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.click('[data-agh-open]');
  await p2.waitForSelector('.agh-preview-box.has-3d canvas', { timeout: 120000 });
  await p2.waitForTimeout(5000);
  const fb = await p2.evaluate(() => { const v = window.AGH_3D.viewer(), bg = v.scene.background; return { photo: v.env.photo, status: window.AGH_3D.sky.status(v.env.want), canvas: !!(bg && bg.isCanvasTexture), env: !!v.scene.environment }; });
  ok(fb.photo === '' && fb.status === 'failed' && fb.canvas && fb.env, 'ha a fájl nem jön meg: festett ég (' + fb.status + '), a jelenet ugyanúgy él');
  ok(!err2.length, 'blokkolt fájlnál sincs konzolhiba' + (err2.length ? ' ' + JSON.stringify(err2.slice(0, 3)) : ''));
  await ctx2.close();
  ok(!errors.length, 'konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`égbolt-fénykép: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}, assets/sky ${Math.round(bytes / 1024)} KB`);
  process.exit(good === res.length ? 0 : 1);
})();
