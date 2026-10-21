// Megnyitógomb (1.14.3): az ikon mérete a megnyitás előtt és a tervező bezárása után, egy olyan
// témával is, amely minden gombra saját stílust tesz. Használat: node tests/e2e/cta.js [kép.png]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const THEME = 'button { padding: 2px 6px; font-size: 12px; background: #333; color: #fff; border-radius: 0; line-height: 1; } span { font-size: 11px; } img { max-width: 100%; height: auto; }';
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const [theme, w, h] of [[false, 1366, 768], [true, 1366, 768], [true, 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); localStorage.setItem('agh_3d', 'false'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); } });
    await p.goto(URL, { waitUntil: 'networkidle' });
    if (theme) { await p.addStyleTag({ content: THEME }); }
    const m = () => p.evaluate(() => Array.from(document.querySelectorAll('.agh-cta, .agh-fab')).map(x => { const i = x.querySelector('.agh-cta-ico'), im = i && i.querySelector('img, svg'), r = i ? i.getBoundingClientRect() : { width: 0, height: 0 }, q = im ? im.getBoundingClientRect() : { width: 0 }; return { cls: x.className, ico: Math.round(r.width) + 'x' + Math.round(r.height), img: Math.round(q.width), btnH: Math.round(x.getBoundingClientRect().height) }; }));
    const before = await m();
    if (process.argv[2] && !theme) { await p.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: w, height: 260 } }); }
    await p.click('[data-agh-open]');
    await p.waitForSelector('.agh-root', { state: 'attached' });
    await p.waitForTimeout(800);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const after = await m();
    rows.push({ theme, size: w + 'x' + h, before, after, errs: errs.length });
    await ctx.close();
  }
  await b.close();
  const bad = rows.filter(r => r.errs || !r.before.length || r.before.some(x => parseInt(x.ico) < 40 || x.img < (x.img > 26 ? 32 : 22)) || JSON.stringify(r.before) !== JSON.stringify(r.after));
  console.log('megnyitógomb: ' + rows.map(r => `${r.size}${r.theme ? ' témával' : ''}: ` + r.before.map(x => `${x.cls} ikon ${x.ico}, kép ${x.img} px, gomb ${x.btnH} px`).join(', ') + (JSON.stringify(r.before) === JSON.stringify(r.after) ? ' (bezárás után ugyanaz)' : ' (bezárás után ELTÉR)')).join(' · ') + `; konzolhiba ${rows.reduce((a, r) => a + r.errs, 0)}` + (bad.length ? ' – HIBA' : ''));
  process.exit(bad.length ? 1 : 0);
})();
