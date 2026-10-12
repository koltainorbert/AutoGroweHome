// Reszponzivitás-mérés a valódi tervezőn. Használat: node responsive.js [kimeneti_mappa]
const { chromium, devices } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const OUT = process.argv[2] || '/tmp';
const URL = process.env.AGH_URL || 'http://127.0.0.1:8899/tervezo/';
const sizes = [
  ['320x568', 320, 568, true], ['360x740', 360, 740, true], ['375x667', 375, 667, true], ['390x844', 390, 844, true],
  ['430x932', 430, 932, true], ['844x390 fekvő', 844, 390, true], ['768x1024 tablet', 768, 1024, true],
  ['1024x768', 1024, 768, false], ['1366x768', 1366, 768, false], ['1920x1080', 1920, 1080, false],
];
const SHOT = (process.env.SHOT || '').split(',').filter(Boolean);
function audit() {
  const vw = innerWidth, vh = innerHeight, root = document.querySelector('.agh-root');
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; for (let p = el; p && p !== root; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden') return false; } return true; };
  const clippedByScroller = el => { for (let p = el.parentElement; p && p !== root; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.getBoundingClientRect().right <= vw + 1 && p.getBoundingClientRect().left >= -1) return true; } return false; };
  const name = el => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase()) + (el.textContent ? ' "' + el.textContent.trim().slice(0, 18) + '"' : '');
  const all = Array.from(root.querySelectorAll('*')).filter(vis);
  const overflow = all.filter(el => { const r = el.getBoundingClientRect(); return (r.right > vw + 1 || r.left < -1) && !clippedByScroller(el); });
  const inter = all.filter(el => el.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary'));
  const small = inter.map(el => { const r = el.getBoundingClientRect(); return { el, w: r.width, h: r.height }; });
  const lt24 = small.filter(x => x.w < 24 || x.h < 24), lt44 = small.filter(x => x.w < 44 || x.h < 44);
  const zoomInputs = inter.filter(el => el.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]), select, textarea') && parseFloat(getComputedStyle(el).fontSize) < 16);
  const tiny = all.filter(el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11);
  return {
    docOverflowX: document.documentElement.scrollWidth - vw,
    rootOverflowX: root.scrollWidth - root.clientWidth,
    overflow: overflow.length, overflowEx: overflow.slice(0, 4).map(name),
    targets: inter.length, lt24: lt24.length, lt24Ex: lt24.slice(0, 4).map(x => name(x.el) + ' ' + Math.round(x.w) + 'x' + Math.round(x.h)),
    lt44: lt44.length, zoomInputs: zoomInputs.length, tinyText: tiny.length, tinyEx: tiny.slice(0, 3).map(name),
  };
}
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const [label, w, h, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem('agh_tour_done', 'true'); localStorage.setItem('agh_ui', '"designer"'); } catch (e) {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 120)));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click('[data-agh-open]');
    await page.waitForSelector('.agh-shell', { timeout: 15000 });
    await page.waitForTimeout(700);
    const tabs = await page.$$('.agh-mobile-tabs button');
    const tabVisible = tabs.length && await tabs[0].isVisible();
    const views = tabVisible ? ['params', 'stage', 'summary'] : ['all'];
    for (let i = 0; i < views.length; i++) {
      if (tabVisible) { await tabs[i].click(); await page.waitForTimeout(250); }
      const r = await page.evaluate(audit);
      rows.push({ size: label, view: views[i], ...r, console: errors.length });
      if (SHOT.includes(label.split(' ')[0])) await page.screenshot({ path: `${OUT}/${label.split(' ')[0]}-${views[i]}.png` });
    }
    if (errors.length) console.error(label, errors.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(rows));
})();
