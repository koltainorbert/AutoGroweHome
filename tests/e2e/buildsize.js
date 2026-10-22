// 1.16.0 – az építési mód „Kezdés” mezői megtartják a beírt méretet (eddig minden újrarajzolásnál
// visszaugrottak 10 × 8 m-re), és a „Téglalap” a beírt méretű házat rajzolja.
// Használat: node tests/e2e/buildsize.js   (tesztoldal: bin/test-wp.sh)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
(async () => {
  toggle(true);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 160)); } });
  page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('[data-agh-open]');
  await page.waitForSelector('.agh-shell .agh-preview-box', { timeout: 60000, state: 'attached' });
  for (let k = 0; k < 4 && !(await page.$('.agh-build .agh-bld-svg')); k++) {
    await page.waitForTimeout(k ? 2500 : 300);
    if (await page.$('.agh-bld-btn:visible')) { await page.click('.agh-bld-btn'); }
    try { await page.waitForSelector('.agh-build .agh-bld-svg', { timeout: 8000, state: 'attached' }); } catch (e) { /* again */ }
  }
  const out = await page.evaluate(async () => {
    const U = window.AGH_BuildUI, B = window.AGH_Build;
    U.load(B.empty ? B.empty() : { walls: [], openings: [] });
    U.goStep(5);
    const w = document.querySelector('[data-k="tpl.w"]'), d = document.querySelector('[data-k="tpl.d"]');
    if (!w || !d) { return { found: false }; }
    w.value = '14'; w.dispatchEvent(new Event('input', { bubbles: true }));
    d.value = '11.5'; d.dispatchEvent(new Event('input', { bubbles: true }));
    U.goStep(4); U.goStep(5);   // the panel is rebuilt
    // 1.16.2: with no walls the 3D ground patch is the typed size + the working margin
    U.setView('3d');
    let patch = null;
    for (let k = 0; k < 40 && !patch; k++) {
      await new Promise(r => setTimeout(r, 500));
      const v = window.AGH_3D && window.AGH_3D.viewer && window.AGH_3D.viewer();
      const ph = v && v.house && v.house.phases && v.house.phases[1];
      if (ph && ph.children.length) {
        const THREE = window.AGH_3D.helpers ? window.AGH_3D.helpers().THREE : null;
        const box = THREE ? new THREE.Box3().setFromObject(ph) : null;
        if (box) { const sz = box.getSize(new THREE.Vector3()); patch = [Math.round(sz.x * 100) / 100, Math.round(sz.z * 100) / 100]; }
      }
    }
    const margin = Number((U.state().b.earth || {}).margin);
    U.setView('plan');
    const kept = [document.querySelector('[data-k="tpl.w"]').value, document.querySelector('[data-k="tpl.d"]').value];
    const btn = Array.from(document.querySelectorAll('.agh-bld-tpl button'))[0];
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const go = document.querySelector('.agh-dialog-foot .agh-btn-primary'); if (go) { go.click(); await new Promise(r => setTimeout(r, 300)); }
    const walls = (U.state().b || {}).walls || [];
    const xs = [], ys = [];
    walls.forEach(function (wl) { xs.push(wl.a[0], wl.b[0]); ys.push(wl.a[1], wl.b[1]); });
    const t = walls.length ? (walls[0].t || 0.38) : 0;
    return { found: true, kept, patch, margin, walls: walls.length, w: xs.length ? Math.max.apply(null, xs) - Math.min.apply(null, xs) + t : 0, d: ys.length ? Math.max.apply(null, ys) - Math.min.apply(null, ys) + t : 0 };
  });
  await browser.close();
  toggle(false);
  const pOk = out.patch && Math.abs(out.patch[0] - (14 + 2 * out.margin)) < 0.05 && Math.abs(out.patch[1] - (11.5 + 2 * out.margin)) < 0.05;
  const ok = pOk && out.found && out.kept[0] === '14' && out.kept[1] === '11.5' && Math.abs(out.w - 14) < 0.05 && Math.abs(out.d - 11.5) < 0.05 && !errors.length;
  console.log(`kezdő méret: mezők újrarajzolás után ${out.kept ? out.kept.join(' × ') : '–'} m, a téglalap ${out.w ? out.w.toFixed(2) : '–'} × ${out.d ? out.d.toFixed(2) : '–'} m (${out.walls || 0} fal), 3D földfolt fal nélkül ${out.patch ? out.patch.join(' × ') : '–'} m (munkatér ${out.margin} m), konzolhiba ${errors.length}${errors.length ? ' ' + errors[0] : ''}`);
  process.exit(ok ? 0 : 1);
})();
