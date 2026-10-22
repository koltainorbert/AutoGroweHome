/*!
 * AutoGroweHome – built-in 3D benchmark (1.26.0)
 * Koltai Norbert – Infostudio
 *
 * Runs on the admin page "3D teljesítményteszt" and on the designer page with ?agh_bench=1 (a panel over
 * the page). The sample house is the plugin's default configuration (from /bootstrap); every quality level
 * is measured with it (AGH_3D.bench in agh-3d.js). The result is JSON – shown, copyable and kept in
 * window.AGH_BENCH_RESULT (the tests read it there).
 * Configuration: <script id="agh-bench-cfg" type="application/json"> (Frontend::bench_config()).
 */
(function () {
	'use strict';
	var el = document.getElementById('agh-bench-cfg');
	if (!el) { return; }
	var cfg;
	try { cfg = JSON.parse(el.textContent); } catch (e) { return; }
	var T = cfg.i18n || {};
	function tf(s) { var a = Array.prototype.slice.call(arguments, 1), i = 0; return String(s || '').replace(/%(\d)\$s|%s/g, function (m, n) { return n ? a[n - 1] : a[i++]; }); }
	function h(tag, attrs, kids) {
		var n = document.createElement(tag);
		Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') { n.textContent = attrs[k]; } else if (k === 'style') { n.style.cssText = attrs[k]; } else { n.setAttribute(k, attrs[k]); } });
		(kids || []).forEach(function (c) { if (c) { n.appendChild(c); } });
		return n;
	}
	function script(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

	// where it lives: the admin page has its own box; on the designer page a panel over everything
	var host = document.getElementById('agh-bench');
	var panel = !host;
	if (panel) {
		host = h('div', { id: 'agh-bench', style: 'position:fixed;inset:16px;z-index:2147483002;overflow:auto;padding:16px;border-radius:16px;background:#F6F3EE;color:#1E2226;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35);' });
		host.appendChild(h('h2', { text: T.title || '3D', style: 'margin:0 0 6px;font-size:20px;' }));
		host.appendChild(h('p', { text: T.lead || '', style: 'margin:0 0 12px;max-width:760px;' }));
		document.body.appendChild(host);
	}
	var stage = h('div', { class: 'agh-bench-stage', style: 'position:relative;width:100%;max-width:960px;aspect-ratio:16/9;min-height:220px;border-radius:12px;overflow:hidden;background:#D9D4CB;' });
	var btn = h('button', { type: 'button', class: 'button button-primary agh-bench-start', text: T.start || 'Start', style: panel ? 'margin:12px 8px 12px 0;height:36px;padding:0 16px;border:0;border-radius:999px;background:#1E2226;color:#fff;font:inherit;cursor:pointer;' : 'margin:12px 8px 12px 0;' });
	var copy = h('button', { type: 'button', class: 'button agh-bench-copy', text: T.copy || 'Copy', disabled: 'disabled', style: panel ? 'height:36px;padding:0 16px;border:1px solid #1E2226;border-radius:999px;background:transparent;font:inherit;cursor:pointer;' : '' });
	var status = h('p', { class: 'agh-bench-status', role: 'status', 'aria-live': 'polite', style: 'margin:4px 0 10px;font-weight:600;' });
	var gpuLine = h('p', { class: 'agh-bench-gpu', style: 'margin:0 0 10px;' });
	var table = h('div', { class: 'agh-bench-table', style: 'overflow-x:auto;' });
	var pre = h('textarea', { class: 'agh-bench-json', readonly: 'readonly', rows: '10', style: 'width:100%;max-width:960px;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;display:none;' });
	[stage, h('div', {}, [btn, copy]), status, gpuLine, table, pre].forEach(function (n) { host.appendChild(n); });

	var A3 = null, house = null;
	function webgl2() { try { var c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }
	function prepare() {
		if (A3) { return Promise.resolve(A3); }
		if (!webgl2()) { return Promise.reject(new Error(T.no_webgl || 'WebGL2')); }
		window.AGH_LOADER = window.AGH_LOADER || {};
		if (!window.AGH_LOADER.q3d) { window.AGH_LOADER.q3d = cfg.q3d; }
		var headers = cfg.wpNonce ? { 'X-WP-Nonce': cfg.wpNonce } : {};
		var boot = fetch(cfg.rest.replace(/\/$/, '') + '/bootstrap', { headers: headers, credentials: 'same-origin' }).then(function (r) { return r.json(); });
		var mods = (cfg.build && !window.AGH_Build ? script(cfg.build) : Promise.resolve()).then(function () { return window.AGH_Sketch ? null : script(cfg.sketch); }).then(function () { return import(cfg.three); });
		return Promise.all([boot, mods]).then(function (r) {
			house = Object.assign({}, r[0].defaults || {});
			A3 = (r[1] && r[1].default) || window.AGH_3D;
			if (!A3 || !A3.bench) { throw new Error('3D'); }
			return A3;
		});
	}
	function row(cells, head) { return h('tr', {}, cells.map(function (c) { return h(head ? 'th' : 'td', { text: String(c), style: 'padding:4px 10px;text-align:' + (head ? 'left' : 'right') + ';white-space:nowrap;border-bottom:1px solid rgba(0,0,0,.1);' }); })); }
	function show(res) {
		var Q = cfg.q3d || {};
		gpuLine.textContent = (T.gpu || 'GPU') + ': ' + ((res.gpu && res.gpu.renderer) || T.unknown || '?') + (res.gpu && res.gpu.vendor ? ' (' + res.gpu.vendor + ')' : '');
		var tb = h('table', { class: 'widefat striped', style: 'border-collapse:collapse;' });
		tb.appendChild(row([T.level, T.first, T.fps, T.p50, T.p95, T.tris, T.calls, T.memory], true));
		Object.keys(res.levels).forEach(function (l) {
			var r = res.levels[l];
			tb.appendChild(row([Q[l] || l, r.first_ms + ' ms', r.fps, r.p50_ms + ' ms', r.p95_ms + ' ms', r.triangles.toLocaleString(), r.draw_calls, r.js_heap_mb === null ? '–' : r.js_heap_mb + ' MB']));
		});
		table.innerHTML = ''; table.appendChild(tb);
		pre.value = JSON.stringify(res, null, 1); pre.style.display = 'block';
		copy.removeAttribute('disabled');
	}
	btn.addEventListener('click', function () {
		btn.setAttribute('disabled', 'disabled');
		status.textContent = '…';
		prepare().then(function (api) {
			// the stage must have its size before the canvas is put in
			stage.innerHTML = '';
			var Q = cfg.q3d || {};
			var fm = /[?&]agh_bench_frames=(\d+)/.exec(location.search);
			return api.bench(stage, house, { frames: fm ? Math.min(240, Math.max(4, +fm[1])) : 60, onProgress:function (l, i, n) { status.textContent = tf(T.running, Q[l] || l, i + 1, n); } });
		}).then(function (res) {
			window.AGH_BENCH_RESULT = res;
			status.textContent = tf(T.done, (cfg.q3d || {})[res.auto.recommended] || res.auto.recommended);
			show(res);
		}).catch(function (e) {
			window.AGH_BENCH_RESULT = { error: String(e && e.message || e) };
			status.textContent = (T.error || 'Error') + ' ' + (e && e.message || e);
		}).then(function () { btn.removeAttribute('disabled'); });
	});
	copy.addEventListener('click', function () {
		var txt = pre.value, ok = function () { status.textContent = T.copied || 'OK'; };
		if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(ok, function () { pre.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* select by hand */ } }); }
		else { pre.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* select by hand */ } }
	});
	if (/[?&]agh_bench_auto=1/.test(location.search)) { btn.click(); }
})();
