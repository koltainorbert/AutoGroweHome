/*! AutoGroweHome loader – loads the designer bundle on demand. */
(function () {
	'use strict';
	var cfgEl = document.getElementById('agh-loader-cfg');
	if (!cfgEl) { return; }
	var cfg;
	try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
	window.AGH_LOADER = cfg;
	var loading = null;

	function load() {
		if (window.AGH_Designer) { return Promise.resolve(window.AGH_Designer); }
		if (loading) { return loading; }
		loading = new Promise(function (resolve, reject) {
			var css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = cfg.css;
			document.head.appendChild(css);
			var st = document.createElement('style');
			st.textContent = cfg.vars;
			document.head.appendChild(st);
			// Start fetching the 3D modules together with the designer, so the 3D view is ready sooner.
			preload3D();
			function script(src, done) {
				var s = document.createElement('script');
				s.src = src;
				s.async = true;
				s.onload = done;
				s.onerror = reject;
				document.head.appendChild(s);
			}
			// The live sketch renderer first, then the designer that uses it.
			function designer() { script(cfg.js, function () { window.AGH_Designer ? resolve(window.AGH_Designer) : reject(new Error('AGH')); }); }
			function sketch() { if (cfg.sketch && !window.AGH_Sketch) { script(cfg.sketch, designer); } else { designer(); } }
			// build mode (only when it is switched on): its model goes first, the sketch uses it
			if (cfg.build && !window.AGH_Build) { script(cfg.build, sketch); } else { sketch(); }
		});
		return loading;
	}

	// All 3D modules at once (in parallel, not one import level after the other).
	function preload3D() {
		if (!cfg.three || document.querySelector('link[data-agh-3d]')) { return; }
		[cfg.three].concat(cfg.threeDeps || []).forEach(function (u) {
			var mp = document.createElement('link');
			mp.rel = 'modulepreload';
			mp.href = u;
			mp.setAttribute('data-agh-3d', '1');
			document.head.appendChild(mp);
		});
	}
	// Ahead of the click: when the pointer heads for the button, or once the page is idle.
	function warm() { load().catch(function () {}); }
	function early() {
		var nodes = document.querySelectorAll('[data-agh-open]');
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].__aghWarm) { continue; }
			nodes[i].__aghWarm = 1;
			['pointerenter', 'focus', 'touchstart'].forEach(function (ev) { nodes[i].addEventListener(ev, warm, { once: true, passive: true }); });
		}
		var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
		setTimeout(function () { idle(warm, { timeout: 4000 }); }, 2500);
	}

	// Loading indicator from the click until the designer is on screen. Inline styles: the stylesheet
	// itself is still loading, and the page's theme must not be able to hide or shift it.
	var boot = null, bootTimer = 0;
	function bootShow() {
		if (boot || document.querySelector('.agh-root')) { return; }
		boot = document.createElement('div');
		boot.className = 'agh-boot agh-boot-in';
		boot.setAttribute('role', 'status');
		boot.setAttribute('aria-live', 'polite');
		boot.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;margin:0;padding:0;background:rgba(28,25,22,.58);font:500 15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1E2226;';
		var card = document.createElement('div');
		card.style.cssText = 'display:flex;align-items:center;gap:12px;margin:0;padding:16px 22px;border-radius:999px;background:#F6F3EE;box-shadow:0 12px 40px rgba(0,0,0,.25);max-width:calc(100vw - 32px);box-sizing:border-box;';
		var sp = document.createElement('span');
		sp.setAttribute('aria-hidden', 'true');
		sp.style.cssText = 'flex:none;width:20px;height:20px;margin:0;padding:0;border-radius:50%;border:3px solid #B9824F;border-right-color:transparent;box-sizing:border-box;';
		if (sp.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { sp.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 800, iterations: Infinity }); }
		var tx = document.createElement('span');
		tx.textContent = cfg.loading || 'Betöltés…';
		tx.style.cssText = 'margin:0;padding:0;';
		card.appendChild(sp); card.appendChild(tx); boot.appendChild(card);
		document.body.appendChild(boot);
		// gone as soon as the designer is there (it builds after its own bootstrap request)
		bootTimer = setInterval(function () { if (document.querySelector('.agh-root')) { bootHide(); } }, 60);
	}
	function bootHide() {
		if (bootTimer) { clearInterval(bootTimer); bootTimer = 0; }
		if (boot && boot.parentNode) { boot.parentNode.removeChild(boot); }
		boot = null;
	}
	function open(e) {
		if (e) { e.preventDefault(); }
		var btn = e && e.currentTarget;
		if (btn) { btn.setAttribute('aria-busy', 'true'); }
		bootShow();
		setTimeout(function () { if (boot) { bootHide(); } }, 45000); // never stays forever
		load().then(function (d) { d.open(); }).catch(function () {
			bootHide();
			window.alert(cfg.errBoot || 'AutoGroweHome: betöltési hiba / loading error');
		}).then(function () { if (btn) { btn.removeAttribute('aria-busy'); } });
	}

	function bind() {
		var nodes = document.querySelectorAll('[data-agh-open]');
		for (var i = 0; i < nodes.length; i++) {
			if (!nodes[i].__agh) { nodes[i].__agh = 1; nodes[i].addEventListener('click', open); }
		}
		if (cfg.floating && !document.querySelector('.agh-fab')) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'agh-fab';
			b.setAttribute('data-agh-open', '1');
			b.innerHTML = '<span class="agh-cta-ico" aria-hidden="true">&#8962;</span><span></span>';
			b.lastChild.textContent = cfg.label;
			var st2 = document.createElement('style');
			st2.textContent = '.agh-fab{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.7);background:linear-gradient(135deg,rgba(255,255,255,.8),rgba(255,255,255,.5));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 12px 34px rgba(30,34,38,.2);color:#1E2226;cursor:pointer;font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;position:fixed;right:22px;bottom:22px;z-index:99990}.agh-fab .agh-cta-ico{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#B9824F;color:#fff}@media(max-width:600px){.agh-fab{right:12px;bottom:12px;padding:11px 16px;font-size:14px}}';
			document.head.appendChild(st2);
			b.addEventListener('click', open);
			b.__agh = 1;
			document.body.appendChild(b);
		}
		fromHash();
		early();
	}

	// "#agh-open" in the address bar opens the designer: on page load and on later hash changes.
	var HASH_RE = /[#&]agh-open\b/;
	function fromHash() {
		if (!HASH_RE.test(location.hash)) { return; }
		// Remove the trigger from the URL so the same link works again after closing.
		var rest = location.hash.replace(/&?agh-open\b/, '').replace(/^#&/, '#');
		if (window.history && history.replaceState) { history.replaceState(null, '', location.pathname + location.search + (rest === '#' ? '' : rest)); }
		open();
	}
	// Links to "#agh-open" on the current page (no hashchange fires if the hash is already set).
	function onDocClick(e) {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
		var a = e.target && e.target.closest ? e.target.closest('a[href*="agh-open"]') : null;
		if (!a || !HASH_RE.test(a.hash) || a.hasAttribute('data-agh-open')) { return; }
		if (a.host !== location.host || a.pathname !== location.pathname || a.search !== location.search) { return; }
		e.preventDefault();
		open();
	}

	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); } else { bind(); }
	window.addEventListener('hashchange', fromHash);
	document.addEventListener('click', onDocClick);
	window.AGH_open = function () { open(); };
})();
