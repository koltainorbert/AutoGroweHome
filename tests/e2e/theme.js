// Reproduces a theme that pads section/aside elements; measures the build layout.
// Téma-ellenállóság és töltésjelző (1.14.2): olyan témát szimulál, amely minden section/aside elemre
// saját margót ad, és sötét témában méri az építési mód elrendezését 3 képernyőméreten, valamint a
// megnyitáskori töltésjelzőt. Használat: node tests/e2e/theme.js   (tesztoldal + bekapcsolt építési mód)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const THEME = 'section, aside { padding: 100px 0; margin: 40px 0; } p { margin: 0 0 1.5em; }';
(async () => {
  toggle(true);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const out = [];
  for (const [w, h, touch] of [[1366, 768, false], [1920, 1080, false], [390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); localStorage.setItem('agh_theme', 'dark'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: THEME });
    const t0 = Date.now();
    await p.click('[data-agh-open]');
    let spin = -1; try { await p.waitForSelector('.agh-boot', { timeout: 300, state: 'attached' }); spin = Date.now() - t0; } catch (e) {}
    await p.waitForSelector('.agh-shell .agh-preview-box', { state: 'attached', timeout: 60000 });
    await p.waitForTimeout(1500);
    const bootLeft = await p.$$eval('.agh-boot', n => n.length);
    // the designer itself (1.14.3): the stage tabs at the top of the middle panel, the preview fills it
    const dz = await p.evaluate(() => { const pn = document.querySelector('.agh-panel-stage'), tb = document.querySelector('.agh-stage-tabs'), pv = document.querySelector('.agh-preview-box'); if (!pn || !pn.offsetParent || !tb || !pv) { return null; } const P = pn.getBoundingClientRect(); return { tabTop: Math.round(tb.getBoundingClientRect().top - P.top), pvShare: Math.round(pv.getBoundingClientRect().height / P.height * 100) }; });
    await p.evaluate(() => { const x = document.querySelector('.agh-bld-btn'); if (x && x.offsetParent) { x.click(); } else { const m = Array.from(document.querySelectorAll('.agh-hmenu-item')).filter(q => /alapokt/i.test(q.textContent))[0]; if (m) { m.click(); } } });
    await p.waitForSelector('.agh-build .agh-bld-svg', { state: 'attached', timeout: 20000 });
    await p.evaluate(() => { window.AGH_BuildUI.load(window.AGH_Build.randomHouse(5)); window.AGH_BuildUI.goStep(5); const pb = document.querySelector('.agh-bld-panes button[data-pane="plan"]'); if (pb && pb.offsetParent) { pb.click(); } });
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) { return null; } const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), h: Math.round(q.height) }; };
      const build = r('.agh-build'), top = r('.agh-bld-top'), nav = r('.agh-bld-nav'), plan = r('.agh-bld-planwrap'), panel = r('.agh-bld-panel');
      // the house fills the plan: share of the wall bbox in the visible plan box
      const sv = document.querySelector('.agh-bld-svg'), walls = Array.from(sv.querySelectorAll('.agh-bld-wall')).map(x => x.getBoundingClientRect());
      const pr = sv.getBoundingClientRect(), x0 = Math.min.apply(null, walls.map(q => q.left)), x1 = Math.max.apply(null, walls.map(q => q.right)), y0 = Math.min.apply(null, walls.map(q => q.top)), y1 = Math.max.apply(null, walls.map(q => q.bottom));
      return { gapTop: top && build ? top.t - build.t : null, gapBottom: nav && build ? build.b - nav.b : null, plan: plan && plan.h, panel: panel && panel.h, fill: Math.round(Math.max((x1 - x0) / pr.width, (y1 - y0) / pr.height) * 100) };
    });
    m.stage = await p.evaluate(() => { const e = document.querySelector('.agh-bld-stage'); return e && e.offsetParent ? Math.round(e.getBoundingClientRect().height) : 0; });
    // in-page timing of the loading indicator is measured on a fresh page below (desktop only)
    // zoom button
    const z = await p.evaluate(() => { const s = document.querySelector('.agh-bld-svg'); const v0 = s.viewBox.baseVal.width; const btn = document.querySelector('.agh-bld-zoomin'); if (!btn) { return null; } btn.click(); return Math.round(v0 / document.querySelector('.agh-bld-svg').viewBox.baseVal.width * 100) / 100; });
    out.push(Object.assign({ size: w + 'x' + h, spinMs: spin, bootLeft, zoom: z, errors: errs.length, tabTop: dz ? dz.tabTop : null, pvShare: dz ? dz.pvShare : null }, m));
    await ctx.close();
  }
  // loading indicator: visible right after the click, gone in the frame the designer appears
  const ctx2 = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx2.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); } catch (e) {} });
  const p2 = await ctx2.newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.evaluate(() => { window.__m = {}; document.addEventListener('click', () => { window.__m.click = performance.now(); }, true); new MutationObserver(() => { if (!window.__m.boot && document.querySelector('.agh-boot')) { window.__m.boot = performance.now(); } if (!window.__m.root && document.querySelector('.agh-root')) { window.__m.root = performance.now(); window.__m.left = document.querySelectorAll('.agh-boot').length; } }).observe(document.body, { childList: true, subtree: true }); });
  await p2.click('[data-agh-open]');
  await p2.waitForSelector('.agh-root', { state: 'attached' });
  const bm = await p2.evaluate(() => ({ show: Math.round(window.__m.boot - window.__m.click), left: window.__m.left }));
  await b.close();
  toggle(false);
  const bad = out.filter(r => r.errors || r.gapTop > 24 || r.gapBottom > 24 || r.plan < (r.size === '390x844' ? 0.5 * 844 : 280) || (r.panel && r.stage < 0.9 * r.panel) || r.zoom !== 1.25 || (r.tabTop !== null && (r.tabTop > 24 || r.pvShare < 55)));
  const ok = !bad.length && bm.show >= 0 && bm.show <= 100 && bm.left === 0;
  console.log('téma-ellenállóság: ' + out.map(r => `${r.size} rajz ${r.plan} px (panel ${r.panel}, rajzoldal ${r.stage}), üres sáv ${r.gapTop}/${r.gapBottom} px, kitöltés ${r.fill} %, nagyítás ${r.zoom}×` + (r.tabTop !== null ? `, tervező: fül ${r.tabTop} px a panel tetejétől, előnézet a panel ${r.pvShare} %-a` : '')).join(' · ') + `; töltésjelző ${bm.show} ms után látható, a tervezővel együtt eltűnik (maradt ${bm.left}); konzolhiba ${out.reduce((a, r) => a + r.errors, 0)}` + (ok ? '' : ' – HIBA ' + JSON.stringify(bad)));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL', e.message.slice(0, 300)); try { toggle(false); } catch (x) {} process.exit(1); });
