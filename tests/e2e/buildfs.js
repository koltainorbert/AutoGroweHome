// Teljes képernyő az építési mód rajzán (1.14.4): natív és CSS-tartalék módban, asztali és telefon
// méreten: a rajzoldal kitölti a képernyőt (alaprajz és 3D), Esc / a gomb után az eredeti méret vissza;
// a „Teljes rajz” ikonja eltér. Használat: node tests/e2e/buildfs.js   (tesztoldal; a kapcsolót maga állítja)
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const path = require('path');
const { execFileSync } = require('child_process');
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const toggle = on => execFileSync('php', [path.join(__dirname, '..', 'build-toggle.php'), on ? 'on' : 'off', process.env.AGH_WP || '/home/claude/wpsite']).toString().trim();
(async () => {
  toggle(true);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const rows = [];
  try {
    for (const [w, h, touch, css] of [[1366, 768, false, false], [1366, 768, false, true], [390, 844, true, false], [390, 844, true, true]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript((css) => { try { localStorage.clear(); localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d_thumbs', 'false'); } catch (e) {} if (css) { window.AGH_NO_FULLSCREEN = true; } }, css);
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') { errs.push(m.text().slice(0, 140)); } });
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.click('[data-agh-open]');
      await p.waitForSelector('.agh-shell .agh-preview-box', { state: 'attached', timeout: 60000 });
      await p.waitForTimeout(800);
      await p.evaluate(() => { const x = document.querySelector('.agh-bld-btn'); if (x && x.offsetParent) { x.click(); } else { const m = Array.from(document.querySelectorAll('.agh-hmenu-item')).filter(q => /alapokt/i.test(q.textContent))[0]; if (m) { m.click(); } } });
      await p.waitForSelector('.agh-build .agh-bld-svg', { state: 'attached', timeout: 20000 });
      await p.evaluate(() => { window.AGH_BuildUI.load(window.AGH_Build.randomHouse(9)); window.AGH_BuildUI.goStep(5); const pb = document.querySelector('.agh-bld-panes button[data-pane="plan"]'); if (pb && pb.offsetParent) { pb.click(); } });
      await p.waitForTimeout(300);
      const size = () => p.evaluate(() => { const st = document.querySelector('.agh-bld-stage').getBoundingClientRect(), pw = document.querySelector('.agh-bld-planwrap'), v3 = document.querySelector('.agh-bld-3d'), cv = v3.querySelector('canvas'); return { stage: Math.round(st.width) + 'x' + Math.round(st.height), stageA: st.width * st.height / (innerWidth * innerHeight), plan: pw.hidden ? 0 : Math.round(pw.getBoundingClientRect().height), c3d: cv && !v3.hidden ? Math.round(cv.getBoundingClientRect().height) : 0, fs: !!document.fullscreenElement || !!document.querySelector('.agh-bld-stage.is-fs-css'), seg: !!document.querySelector('.agh-bld-stagebar .agh-bld-seg') && getComputedStyle(document.querySelector('.agh-bld-stagebar .agh-bld-seg')).display !== 'none' }; });
      const icons = await p.evaluate(() => { const f = document.querySelector('.agh-bld-fs svg'), fit = document.querySelector('.agh-bld-quick .agh-iconbtn:last-child svg'); return f && fit && f.innerHTML !== fit.innerHTML; });
      const s0 = await size();
      await p.click('.agh-bld-fs');
      await p.waitForTimeout(700);
      const s1 = await size();
      await p.evaluate(() => window.AGH_BuildUI.setView('3d'));
      await p.waitForFunction(() => { const v = window.AGH_3D && window.AGH_3D.viewer(); return v && v.house && v.house.phases; }, null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(900);
      const s2 = await size();
      await p.evaluate(() => window.AGH_BuildUI.setView('plan'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(700);
      const s3 = await size();
      // the button toggles too, and Esc outside the full screen keeps the designer open
      await p.click('.agh-bld-fs'); await p.waitForTimeout(500); const s4 = await size(); await p.click('.agh-bld-fs'); await p.waitForTimeout(500); const s5 = await size();
      await p.keyboard.press('Escape'); await p.waitForTimeout(300); const still = await p.evaluate(() => !!document.querySelector('.agh-shell.is-build'));
      const ok = icons && s1.fs && s1.stageA >= 0.95 && s1.plan >= h - 160 && s1.seg && s2.c3d >= h - 220 && !s3.fs && s3.stage === s0.stage && s4.fs && !s5.fs && s5.stage === s0.stage && still && !errs.length;
      rows.push({ size: w + 'x' + h + (css ? ' tartalék' : ' natív'), ok, before: s0.stage, plan: s0.plan + '→' + s1.plan, fill: Math.round(s1.stageA * 100), c3d: s2.c3d, back: s3.stage === s0.stage && s5.stage === s0.stage, still, icons, errs });
      await ctx.close();
    }
  } finally { await b.close(); toggle(false); }
  const bad = rows.filter(r => !r.ok);
  console.log('építési rajz teljes képernyő: ' + rows.map(r => `${r.size}: rajz ${r.plan} px, képernyő ${r.fill} %, 3D vászon ${r.c3d} px, kilépés (Esc és gomb) után ${r.back ? 'eredeti méret' : 'ELTÉR'}${r.still ? '' : ', Esc BEZÁRTA a tervezőt'}`).join(' · ') + `; ikon eltér ${rows.every(r => r.icons) ? 'igen' : 'NEM'}; konzolhiba ${rows.reduce((a, r) => a + r.errs.length, 0)}` + (bad.length ? ' – HIBA ' + JSON.stringify(bad) : ''));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message.slice(0, 300)); try { toggle(false); } catch (x) {} process.exit(1); });
