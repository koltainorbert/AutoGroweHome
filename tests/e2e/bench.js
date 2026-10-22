// Beépített 3D teljesítményteszt E2E (1.26.0), a tesztoldalon (bin/test-wp.sh):
//  (1) a tervező oldalán ?agh_bench=1: a panel megjelenik, a teszt mind a 4 szinten lefut, JSON-t ad (GPU neve,
//      szintenként első kép, fps, p50/p95, háromszög, rajzhívás), a „Másolás” gomb él;
//  (2) az admin oldal (AutoGroweHome → 3D teljesítményteszt) ugyanígy lefut, bejelentkezve; konzolhiba 0.
// SwiftShaderen (szoftveres rajzolás) a számok csak egymáshoz képest értelmesek, valódi GPU-n Norbi méri.
// Használat: node tests/e2e/bench.js   (AGH_URL=http://127.0.0.1:<port>/tervezo/)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const ORIGIN = URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');

async function run(page, url, label, ok) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#agh-bench .agh-bench-start', { timeout: 60000 });
  ok(true, label + ': a tesztpanel megjelent');
  await page.click('#agh-bench .agh-bench-start');
  await page.waitForFunction(() => window.AGH_BENCH_RESULT, null, { timeout: 900000 });
  const r = await page.evaluate(() => window.AGH_BENCH_RESULT);
  ok(!r.error, label + ': lefutott' + (r.error ? ' – ' + r.error : ''));
  if (r.error) { return r; }
  const lv = Object.keys(r.levels || {});
  ok(lv.join() === 'low,medium,high,ultra', label + ': mind a 4 szint mérve (' + lv.join(', ') + ')');
  ok(lv.every(l => { const x = r.levels[l]; return x.fps > 0 && x.p50_ms > 0 && x.p95_ms >= x.p50_ms && x.triangles > 0 && x.draw_calls > 0 && x.first_ms > 0; }), label + ': szintenként első kép, fps, p50/p95, háromszög, rajzhívás');
  ok(r.gpu && typeof r.gpu.renderer === 'string' && r.gpu.renderer.length > 0, label + ': GPU neve: ' + (r.gpu && r.gpu.renderer));
  ok(r.auto && lv.indexOf(r.auto.recommended) !== -1, label + ': javasolt szint ' + (r.auto && r.auto.recommended));
  const json = await page.$eval('#agh-bench .agh-bench-json', el => el.value);
  let parsed = null; try { parsed = JSON.parse(json); } catch (e) { parsed = null; }
  const copyOn = await page.$eval('#agh-bench .agh-bench-copy', el => !el.disabled);
  ok(parsed && parsed.levels && copyOn, label + ': JSON kiírva, „Másolás” gomb aktív');
  ok(!errors.length, label + ': konzolhiba 0' + (errors.length ? ' ' + JSON.stringify(errors.slice(0, 3)) : ''));
  lv.forEach(l => { const x = r.levels[l]; console.log(`  ${label} ${l}: első kép ${x.first_ms} ms (építés ${x.build_ms}, fordítás ${x.compile_ms}) · ${x.fps} fps · p50 ${x.p50_ms} ms · p95 ${x.p95_ms} ms · ${x.triangles} háromszög · ${x.draw_calls} rajzhívás · fű ${x.grass_triangles} · árnyék ${x.shadow_map} · AO ${x.ao ? 'be' : 'ki'} · ég ${x.sky}`); });
  return r;
}

(async () => {
  const res = [];
  const ok = (cond, name) => { res.push([!!cond, name]); if (!cond || process.env.AGH_V) { console.log((cond ? '  ok: ' : '  HIBA: ') + name); } };
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  // (1) designer page, no login
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  await run(page, URL + (URL.indexOf('?') === -1 ? '?' : '&') + 'agh_bench=1&agh_bench_frames=4', '?agh_bench=1', ok);
  await ctx.close();
  // (2) admin page (admin / admin123 on the test site)
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(ORIGIN + '/wp-login.php', { waitUntil: 'networkidle' });
  await p2.fill('#user_login', 'admin'); await p2.fill('#user_pass', 'admin123');
  await Promise.all([p2.waitForNavigation({ waitUntil: 'networkidle' }), p2.click('#wp-submit')]);
  const menu = await p2.goto(ORIGIN + '/wp-admin/admin.php?page=agh-dashboard', { waitUntil: 'networkidle' }).then(() => p2.$('a[href*="page=agh-bench"]'));
  ok(!!menu, 'admin menü: „3D teljesítményteszt”');
  await run(p2, ORIGIN + '/wp-admin/admin.php?page=agh-bench&agh_bench_frames=4', 'admin', ok);
  await ctx2.close();
  await browser.close();
  const good = res.filter(r => r[0]).length;
  console.log(`teljesítményteszt: ${good}/${res.length} ellenőrzés ${good === res.length ? 'zöld' : 'HIBA'}`);
  process.exit(good === res.length ? 0 : 1);
})();
