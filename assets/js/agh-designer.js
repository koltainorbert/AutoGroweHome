/*!
 * AutoGroweHome – háztervező (designer) app
 * Koltai Norbert – Infostudio
 * Vanilla JS, no external dependencies.
 */
(function () {
	'use strict';

	var LOADER = window.AGH_LOADER || {};
	var REST = LOADER.rest || (window.wpApiSettings ? window.wpApiSettings.root + 'agh/v1/' : '/wp-json/agh/v1/');
	var LS_KEY = 'agh_draft_v1';
	var LS_THEME = 'agh_theme';
	var LS_PRESETS = 'agh_presets';
	var LS_UI = 'agh_ui'; // 'wizard' | 'designer': the view the visitor last chose
	// WordPress REST nonce of a logged-in visitor (empty for guests): sent as X-WP-Nonce so the REST layer sees the user.
	var WP_NONCE = LOADER.wpNonce || '';

	/* ------------------------------------------------------------------ utils */
	function h(tag, attrs) {
		var el = document.createElement(tag);
		if (attrs) {
			for (var k in attrs) {
				if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
				var v = attrs[k];
				if (v === null || v === undefined || v === false) { continue; }
				if (k === 'class') { el.className = v; }
				else if (k === 'text') { el.textContent = v; }
				else if (k === 'html') { el.innerHTML = v; }
				else if (k.indexOf('on') === 0 && typeof v === 'function') { el.addEventListener(k.slice(2), v); }
				else if (k === 'style' && typeof v === 'object') { for (var s in v) { el.style.setProperty(s, v[s]); } }
				else { el.setAttribute(k, v === true ? '' : v); }
			}
		}
		for (var i = 2; i < arguments.length; i++) { append(el, arguments[i]); }
		return el;
	}
	function append(el, c) {
		if (c === null || c === undefined || c === false) { return; }
		if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
		el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	function clear(el) { while (el && el.firstChild) { el.removeChild(el.firstChild); } return el; }
	function clone(o) { return JSON.parse(JSON.stringify(o)); }
	function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
	function lsGet(k, d) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
	function lsSet(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

	// Wizard: the live preview column can be widened by dragging its left edge (double click = reset).
	function wizSideResizer(main) {
		var grip = h('div', { class: 'agh-wiz-grip', role: 'separator', 'aria-orientation': 'vertical' });
		var saved = parseInt(lsGet('agh_wiz_side_w', 0), 10);
		function apply(px) { if (px > 0) { main.style.setProperty('--agh-wiz-side-w', px + 'px'); } else { main.style.removeProperty('--agh-wiz-side-w'); } }
		apply(saved);
		grip.addEventListener('dblclick', function () { lsSet('agh_wiz_side_w', 0); apply(0); });
		grip.addEventListener('pointerdown', function (e) {
			e.preventDefault();
			var rect = main.getBoundingClientRect(), pad = parseFloat(window.getComputedStyle(main).paddingRight) || 0, max = Math.max(300, Math.min(900, rect.width * 0.7)), cur = 0;
			try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
			main.classList.add('is-resizing');
			function move(ev) { cur = Math.round(Math.max(280, Math.min(max, rect.right - pad - ev.clientX - 7))); apply(cur); }
			function up() { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); main.classList.remove('is-resizing'); if (cur) { lsSet('agh_wiz_side_w', cur); } window.dispatchEvent(new Event('resize')); }
			grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
		});
		main.appendChild(grip);
	}
	function fmt(n, d) { var x = Number(n); if (!isFinite(x)) { return '–'; } return x.toLocaleString(S.locale.replace('_', '-'), { maximumFractionDigits: d === undefined ? 1 : d }); }

	var ICONS = {
		home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
		fit: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/>',
		sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
		cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
		roof: '<path d="M2 12l10-8 10 8"/><path d="M6 10v10h12V10"/><path d="M16 6V3h2v4.5"/>',
		wall: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v5M15 9v5M9 14v6"/>',
		window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
		plan: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 12h7v9M10 3v5M14 12h7M14 12V3"/>',
		eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
		sofa: '<path d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3"/><path d="M2 12a2 2 0 014 0v3h12v-3a2 2 0 014 0v6H2z"/><path d="M5 18v2M19 18v2"/>',
		kitchen: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18"/><circle cx="8" cy="6" r=".8"/><circle cx="12" cy="6" r=".8"/><path d="M8 13h8M8 17h5"/>',
		bath: '<path d="M4 12h16v3a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M6 12V5a2 2 0 014 0"/><path d="M7 20l-1 2M17 20l1 2"/>',
		tiles: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
		tree: '<path d="M12 22v-6"/><path d="M12 16c-4 0-7-2.5-7-6 0-3 2-5 4-5.5C9.5 2.8 10.7 2 12 2s2.5.8 3 2.5c2 .5 4 2.5 4 5.5 0 3.5-3 6-7 6z"/>',
		bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
		camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/><circle cx="12" cy="13" r="4"/>',
		pen: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
		moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
		close: '<path d="M6 6l12 12M18 6L6 18"/>',
		help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 4"/><circle cx="12" cy="17" r=".6"/>',
		folder: '<path d="M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>',
		save: '<path d="M5 3h11l3 3v14a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
		send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
		mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
		download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
		check: '<path d="M5 12l5 5L20 7"/>',
		alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
		info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
		error: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
		brush: '<path d="M14.5 4.5l5 5-7.5 7.5h-5v-5z"/><path d="M4 20c1.5 0 3-1 3-3"/>',
		chev: '<path d="M9 6l6 6-6 6"/>',
		left: '<path d="M15 6l-6 6 6 6"/>',
		grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
		sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
		layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
		refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
		globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
		ai: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 15l2-6 2 6M9.7 13h2.6M16 9v6"/>',
		expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
		shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
		area: '<path d="M4 4h16v16H4z"/><path d="M4 9h5V4"/>',
		bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 00-3-3h-7v1"/><circle cx="7" cy="10" r="1.6"/>',
		stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
		star: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8z"/>',
		more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
	};
	// Category rail: duotone icons, one distinct drawing and colour per category (".d" = tinted fill layer).
	var CAT_ICONS = {
		home: ['#4F7CAC', '<path class="d" d="M5 10.5L12 5l7 5.5V20H5z"/><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/><rect x="10" y="14" width="4" height="6" rx=".6"/><path d="M15.5 8.2V5h2v4.8"/>'],
		sparkle: ['#A26BB0', '<path class="d" d="M5 7h10v2H5z"/><path d="M4 7l6-3 6 3"/><path d="M5 9h10M6.5 9v9M10 9v9M13.5 9v9M4 20h12M5 18h10"/><path d="M19.5 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'],
		cube: ['#5B8C85', '<path class="d" d="M3 9l6-3 6 3v6l-6 3-6-3z"/><path d="M3 9l6-3 6 3-6 3zM3 9v6l6 3M15 9v6l-6 3M9 12v6"/><path d="M15 12l4-2 3 1.5V17l-7 3.5"/><path d="M19 10v7.5"/>'],
		roof: ['#B5523B', '<path class="d" d="M2.5 12L12 4.5l9.5 7.5z"/><path d="M1.5 12.5L12 4l10.5 8.5"/><path d="M6 9.4l12 0M8.5 7.3h7"/><path d="M5 12v8h14v-8"/><path d="M16 6.5V3.5h2.2v4.8"/>'],
		wall: ['#C08A4A', '<path class="d" d="M3 4h18v16H3z"/><path d="M3 4h18v16H3zM3 8h7M3 12h7M3 16h7M6.5 4v4M6.5 12v4M3 20h18"/><rect x="12" y="7" width="6.5" height="8" rx=".6"/><path d="M15.25 7v8M12 11h6.5"/>'],
		window: ['#3E8EB8', '<path class="d" d="M5 4h14v15H5z"/><rect x="4" y="3" width="16" height="17" rx="1.2"/><path d="M12 3v17M4 11h16M2.5 20h19"/><path d="M7 6l2.5-1.5M14.5 6L17 4.5" opacity=".6"/>'],
		plan: ['#6E7FA8', '<path class="d" d="M3 3h10v9H3z"/><rect x="3" y="3" width="18" height="18" rx="1.2"/><path d="M13 3v6M13 12v9M3 12h6M16 12h5"/><path d="M9 12a4 4 0 014-4" stroke-dasharray="1.6 1.4"/>'],
		sofa: ['#B07A5C', '<path class="d" d="M5 12h14v4H5z"/><path d="M5 12V9a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M3 12.5a1.8 1.8 0 013.5 0V15h11v-2.5a1.8 1.8 0 013.5 0V18H3z"/><path d="M5 18v2M19 18v2"/><path d="M12 7V4M10 4h4" opacity=".7"/>'],
		kitchen: ['#C46D52', '<path class="d" d="M3 13h18v8H3z"/><path d="M7 3h10l2 5H5z"/><path d="M12 8v2"/><rect x="3" y="13" width="18" height="8" rx="1"/><path d="M3 16h18"/><circle cx="8" cy="14.5" r=".2"/><path d="M6.5 11.2a1.5 1.5 0 013 0M14.5 11.2a1.5 1.5 0 013 0"/>'],
		bath: ['#3AA0A8', '<path class="d" d="M3.5 12h17l-1 4.5a4 4 0 01-4 3h-7a4 4 0 01-4-3z"/><path d="M2.5 12h19"/><path d="M3.5 12l1 4.5a4 4 0 004 3h7a4 4 0 004-3l1-4.5"/><path d="M6 12V5.5a2 2 0 013.8-.8"/><path d="M9 7.5l1.5-1.5"/><path d="M15 6.5v.01M17 8.5v.01M13.5 9v.01"/><path d="M7 19.5l-1 2M17 19.5l1 2"/>'],
		tiles: ['#8C7B62', '<path class="d" d="M3 3h9v9H3zM12 12h9v9h-9z"/><rect x="3" y="3" width="18" height="18" rx="1.2"/><path d="M3 12h18M12 3v18"/><path d="M3 7.5l4.5-4.5M3 12l9-9M7.5 12L12 7.5M12 16.5l4.5-4.5M12 21l9-9M16.5 21l4.5-4.5"/>'],
		tree: ['#5E9A4B', '<path class="d" d="M9 4a5 5 0 015 5 4 4 0 01-1 7H6a4 4 0 01-1-7.8A5 5 0 019 4z"/><path d="M9 4a5 5 0 015 5 4 4 0 01-1 7H6a4 4 0 01-1-7.8A5 5 0 019 4z"/><path d="M9 21v-9M9 15l-2-2M9 13l2-2"/><path d="M18 21v-5M18 16l-2.5-1M18 7l3.5 9h-7z"/><path d="M2 21h20"/>'],
		bolt: ['#D3A12C', '<path class="d" d="M3 13l4-6h14l-4 6z"/><path d="M3 13l4-6h14l-4 6zM8.4 13l2.6-6M13.6 13L16.4 7M5 10h14"/><path d="M10 13v4M8 21l2-4 2 4"/><path d="M19 15.5l-2.2 3h2.2l-2.2 3"/>'],
		car: ['#4F86C6', '<path class="d" d="M3.5 12.5l2-4.2A2 2 0 017.3 7h9.4a2 2 0 011.8 1.3l2 4.2V17H3.5z"/><path d="M3.5 12.5l2-4.2A2 2 0 017.3 7h9.4a2 2 0 011.8 1.3l2 4.2M3 12.5h18v4.5H3z"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M6.5 12.5l1.3-3h8.4l1.3 3"/>'],
		camera: ['#7A6BC4', '<path class="d" d="M3 8h18v12H3z"/><path d="M3 8h4l1.6-2.5h6.8L17 8h4v12H3z"/><circle cx="12" cy="14" r="3.6"/><path d="M12 10.4V8.8M15.6 14h1.6"/><circle cx="18.5" cy="10.5" r=".2"/>'],
		door: ['#7C8D6A', '<path class="d" d="M6 3h11v18H6z"/><path d="M4 21h16"/><rect x="6" y="3" width="11" height="18" rx="0.8"/><path d="M9 7h5v4H9zM9 14h5v4H9"/><circle cx="14.6" cy="12.2" r="0.9"/>'],
		armchair: ['#9C6B8E', '<path class="d" d="M6 11h12v5H6z"/><path d="M6 11V7.5A2.5 2.5 0 018.5 5h7A2.5 2.5 0 0118 7.5V11"/><path d="M4 11.5a2 2 0 014 0V15h8v-3.5a2 2 0 014 0V18H4z"/><path d="M6 18v2M18 18v2"/>'],
		lamp: ['#D49A3A', '<path class="d" d="M8 3h8l3 7H5z"/><path d="M8 3h8l3 7H5z"/><path d="M12 10v9M8 21h8"/><path d="M10 13.5h4"/>'],
		pen: ['#8A8F96', '<path class="d" d="M4 20l1-4L16.5 4.5l3 3L8 19z"/><path d="M4 20l1-4L16.5 4.5l3 3L8 19z"/><path d="M14.5 6.5l3 3M5 16l3 3"/><path d="M12 20h8" stroke-dasharray="1.6 1.6"/>']
	};
	function catIcon(name) {
		var d = CAT_ICONS[name];
		if (!d) { return icon(name); }
		var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('class', 'agh-ico agh-cat-ico');
		s.setAttribute('aria-hidden', 'true');
		s.innerHTML = d[1];
		return s;
	}
	function catColor(name) { return CAT_ICONS[name] ? CAT_ICONS[name][0] : ''; }
	function icon(name, cls) {
		var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('class', 'agh-ico' + (cls ? ' ' + cls : ''));
		s.setAttribute('aria-hidden', 'true');
		s.innerHTML = ICONS[name] || ICONS.info;
		return s;
	}

	/* ------------------------------------------------------------------ state */
	var S = {
		boot: null,
		locale: 'hu_HU',
		config: null,
		explicit: {},
		mode: 'simple',
		view: 'ext',
		roomId: null,
		cat: 'basics',
		search: '',
		theme: 'light',
		view: 'design',
		project: null,
		projectId: null,
		selected: null,
		galleryTab: 'exterior',
		galleryIndex: 0,
		check: { errors: [], warnings: [], info: [], metrics: {} },
		dirty: false,
		busy: false,
		poll: null,
		pollDelay: 3000,
		tab: 'params',
		lang: '',
		openRooms: {},
		// Roof product chosen by the server (/validate) while the visitor has not picked one.
		autoRoof: ''
	};
	var root, shell, els = {};

	function t(key) {
		var i = S.boot && S.boot.i18n;
		return (i && i[key]) || key;
	}
	function tf(key) {
		var s = t(key);
		for (var i = 1; i < arguments.length; i++) { s = s.replace('%' + i + '$s', arguments[i]).replace('%s', arguments[i]).replace('%d', arguments[i]); }
		return s;
	}

	/* ------------------------------------------------------------------ api */
	// Every request has a time limit: a hanging server call (slow provider, PHP worker
	// stuck) must never freeze the interface – the caller gets an error and can retry.
	var API_TIMEOUT = 45000;
	function api(method, path, body, timeoutMs) {
		var headers = { 'Accept': 'application/json' };
		if (S.boot) { headers['X-AGH-Nonce'] = S.boot.nonce; }
		if (WP_NONCE) { headers['X-WP-Nonce'] = WP_NONCE; }
		var opt = { method: method, credentials: 'same-origin', headers: headers };
		if (body !== undefined) { headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
		var url = REST + path;
		if (S.lang) { url += (url.indexOf('?') === -1 ? '?' : '&') + 'agh_lang=' + encodeURIComponent(S.lang); }
		var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
		var timer = null;
		if (ctrl) { opt.signal = ctrl.signal; timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || API_TIMEOUT); }
		return fetch(url, opt).then(function (r) {
			return r.text().then(function (txt) {
				var data = {};
				try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { message: t('err_network') }; }
				if (!r.ok) { var err = new Error(data.message || ('HTTP ' + r.status)); err.status = r.status; err.data = data; throw err; }
				return data;
			});
		}).then(function (d) { clearTimeout(timer); return d; }, function (e) {
			clearTimeout(timer);
			if (e && typeof e.status === 'number') { throw e; }
			// Network failure or time limit (also while reading the body): friendly message, status 0.
			var err = new Error(t('err_network')); err.status = 0; err.data = {}; err.timeout = !!(e && e.name === 'AbortError'); throw err;
		});
	}
	function event(type) { api('POST', 'events', { type: type }).catch(function () {}); }

	/* ------------------------------------------------------------------ boot */
	function loadBoot(lang) {
		var u = REST + 'bootstrap';
		if (lang) { u += (u.indexOf('?') === -1 ? '?' : '&') + 'lang=' + encodeURIComponent(lang) + '&agh_lang=' + encodeURIComponent(lang); }
		function get(withNonce) {
			var headers = { 'Accept': 'application/json' };
			if (withNonce) { headers['X-WP-Nonce'] = WP_NONCE; }
			return fetch(u, { credentials: 'same-origin', headers: headers });
		}
		return get(!!WP_NONCE)
			.then(function (r) {
				// A stale REST nonce (e.g. logged out in another tab) is rejected by WordPress: continue as a guest.
				if (r.status === 403 && WP_NONCE) { WP_NONCE = ''; return get(false); }
				return r;
			})
			.then(function (r) { if (!r.ok) { throw new Error('bootstrap'); } return r.json(); })
			.then(function (b) {
				S.boot = b;
				if (b.wpNonce) { WP_NONCE = b.wpNonce; }
				S.locale = b.locale || 'hu_HU';
				S.fields = {};
				b.schema.fields.forEach(function (f) { S.fields[f.id] = f; });
				buildSetup();
				return b;
			});
	}

	function initConfig() {
		var draft = lsGet(LS_KEY, null);
		S.config = clone(S.boot.defaults);
		if (draft && draft.config && draft.v === S.boot.version) {
			Object.keys(draft.config).forEach(function (k) { if (k in S.config || k === 'rooms') { S.config[k] = draft.config[k]; } });
			S.explicit = draft.explicit || {};
			S.projectId = draft.project || null;
			S.mode = draft.mode || S.boot.layout.mode;
			S.autoRoof = draft.autoRoof || '';
			S.styleApplied = draft.styleApplied || null;
		} else {
			S.mode = S.boot.layout.mode;
			// A fresh start already looks like the default style (e.g. modern minimalist = flat roof).
			applyStyle(S.config.arch_style, true);
		}
	}
	var persist = debounce(function () {
		lsSet(LS_KEY, { v: S.boot.version, config: S.config, explicit: S.explicit, project: S.projectId, mode: S.mode, autoRoof: S.autoRoof, styleApplied: S.styleApplied || null });
	}, 300);

	/* ------------------------------------------------------------------ open/close */
	function open() {
		if (root && document.body.contains(root)) { return; }
		// The 3D module loads in parallel with the bootstrap request.
		load3D();
		var p = S.boot ? Promise.resolve(S.boot) : loadBoot();
		p.then(function () {
			if (!S.config) { initConfig(); }
			// a draft kept in this browser that no longer builds (e.g. from an older version) never locks the
			// visitor out: it is dropped and the designer starts from the defaults
			try { build(); } catch (e) {
				try { window.localStorage.removeItem(LS_KEY); } catch (e2) { /* storage unavailable */ }
				if (root) { root.remove(); } root = null;
				S.config = null; S.explicit = {}; S.projectId = null; S.styleApplied = null; S.autoRoof = '';
				initConfig(); build();
			}
			// the browser's Back button closes the designer instead of leaving the page
			try { if (window.history && history.pushState) { history.pushState({ aghOpen: 1 }, ''); S.histPushed = true; window.addEventListener('popstate', onPop); } } catch (e) { S.histPushed = false; }
			event('popup_open');
			if (S.projectId) { loadProject(S.projectId, true); }
			if (!S.wiz && S.boot.layout.tour && !lsGet('agh_tour_done', false)) { setTimeout(showTour, 400); }
		}).catch(function () {
			Array.prototype.forEach.call(document.querySelectorAll('.agh-boot'), function (n) { n.remove(); });
			window.alert(S.boot ? t('err_boot') : (LOADER.errBoot || t('err_boot')));
		});
	}

	// The 3D preview (WebGL) is an ES module loaded after the designer opened; until it is ready – or
	// where WebGL2 is missing – the 2D sketch is shown.
	// While the module loads (A3wait), previews and option cards show a neutral placeholder instead of
	// the 2D sketch, so the visitor never sees the schematic flash up before the real 3D view. The 2D
	// sketch is the fallback only where 3D is unavailable (no WebGL2, load error, 15 s time limit).
	var A3 = null, A3wait = false;
	function webgl2() {
		try { var cv = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && cv.getContext('webgl2')); } catch (e) { return false; }
	}
	function load3D() {
		if (load3D.p || !LOADER.three || lsGet('agh_3d', true) === false || !webgl2()) { return load3D.p; }
		A3wait = true;
		var giveUp = setTimeout(function () { if (A3wait) { A3wait = false; fallback2D(); } }, 15000);
		load3D.p = import(LOADER.three).then(function (m) {
			var api = (m && m.default) || window.AGH_3D;
			clearTimeout(giveUp);
			A3wait = false;
			if (!api || !api.supported()) { fallback2D(); return; }
			A3 = api;
			renderPreviewOnly();
			if (S.wiz) { updateWizardSide(); }
			refreshCardThumbs();
			// rooms and furniture cards are prepared in the background while the house is on screen
			if (api.warmup) { setTimeout(function () { (window.requestIdleCallback || setTimeout)(function () { api.warmup(S.config); }); }, 1800); }
		}).catch(function () { clearTimeout(giveUp); A3 = null; A3wait = false; fallback2D(); });
		return load3D.p;
	}
	// „Élő fotó” switch and „Fotó készítése” button (agh-3d-photo.js, 1.27.0), filled once the module is there.
	function photoSlot() {
		var slot = h('span', { class: 'agh-3d-photo', hidden: true }), tries = 0;
		// the build mode's 3D viewer may still be on its way: a few more looks
		(function fill() {
			var v = A3 && A3.viewer();
			if (v && v.photoUi) { slot.hidden = false; v.photoUi(slot, photoHp()); }
			else if (++tries < 40 && root) { setTimeout(fill, 250); }
		})();
		return slot;
	}
	function photoHp() { return { t: t, tf: tf, icon: icon, toast: toast }; }
	// 3D did not arrive: replace the placeholders with the 2D sketch.
	function fallback2D() {
		if (!root) { return; }
		renderPreviewOnly();
		if (S.wiz) { updateWizardSide(); }
		Array.prototype.forEach.call(root.querySelectorAll('.agh-card-vis.is-wait'), function (el) { el.classList.remove('is-wait'); el.innerHTML = el._mk ? el._mk() : (el._svg || ''); });
	}
	function waitBox() {
		return h('div', { class: 'agh-3d-wait', role: 'status' }, h('span', null, h('i', { class: 'agh-spinner' }), t('loading_3d')));
	}

	// Closing never blocks: the settings stay in this browser (Új tervezés starts afresh).
	function close() {
		if (FS.el) { fsExit(); fsDone(); }
		stopPoll();
		window.removeEventListener('popstate', onPop);
		if (S.histPushed) { S.histPushed = false; try { history.back(); } catch (e) { /* no history */ } }
		closeMenu(false);
		document.removeEventListener('keydown', onKey);
		if (root) { root.remove(); }
		root = null;
		document.documentElement.style.overflow = '';
		if (S.lastFocus && S.lastFocus.focus) { S.lastFocus.focus(); }
	}

	// The phone's Back button: first it leaves the window-filling full screen, then it closes the designer.
	function onPop() {
		if (FS.ignorePop) { FS.ignorePop = false; return; }
		if (FS.el && FS.hist) { FS.hist = false; fsDone(); return; }
		if (root) { S.histPushed = false; close(); }
	}
	// Új tervezés: forget the settings kept in this browser and start from the defaults (saved projects stay).
	function restart() {
		confirmDialog(t('restart_title'), t('restart_text'), t('restart_go'), function () {
			try { window.localStorage.removeItem(LS_KEY); } catch (e) { /* storage unavailable */ }
			stopPoll(); closeMenu(false);
			S.config = null; S.explicit = {}; S.projectId = null; S.project = null; S.autoRoof = ''; S.styleApplied = null;
			S.roomId = null; S.view = 'design'; S.dirty = false; S.lastChange = null; S.cat = 'basics'; S.search = ''; S.tab = 'params'; S.fixKey = null;
			document.removeEventListener('keydown', onKey);
			if (FS.el) { fsExit(); fsDone(); }
			if (root) { root.remove(); }
			root = null;
			initConfig();
			build();
			event('restart');
			toast(t('restart_done'), 'ok');
		});
	}
	function onKey(e) {
		if (S.bld && window.AGH_BuildUI && window.AGH_BuildUI.onKey(e)) { return; }
		if (e.key === 'Escape') {
			if (menuOpen()) { closeMenu(true); return; }
			// Esc leaves the full screen first (the browser may already have done that for its own mode)
			if (FS.el) { e.preventDefault(); fsExit(); return; }
			if (Date.now() - FS.exitedAt < 400) { return; }
			var top = root.querySelector('.agh-lightbox, .agh-dialog-wrap');
			if (top) { if (S.lb && top === S.lb.el) { closeLightbox(); } else { top.remove(); } return; }
			if (S.bld) { return; } // in build mode Esc never throws the drawing away
			close();
		}
		if (e.key === 'Tab') { trapFocus(e); }
		if (S.view === 'gallery' && root.querySelector('.agh-lightbox')) {
			if (e.key === 'ArrowRight') { stepLightbox(1); }
			if (e.key === 'ArrowLeft') { stepLightbox(-1); }
		}
		// Ctrl+Z: take back the last hand move in the room (never while text is being typed)
		if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && S.view === 'int' && layoutUndo.length
			&& !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); undoLayout(); }
		// … and outside: the last moved garden piece, window, door or chimney (1.18.0)
		else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && S.view !== 'int' && siteUndo.length && !S.bld && !S.wiz
			&& !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); undoSite(); }
	}
	function trapFocus(e) {
		var scope = root.querySelector('.agh-dialog-wrap, .agh-lightbox') || (FS.el && FS.el !== root && FS.el.isConnected ? FS.el : shell);
		// Only rendered controls count (elements hidden on small screens must not become the trap's ends).
		var f = Array.prototype.filter.call(scope.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'), function (el) { return el.getClientRects().length > 0; });
		if (!f.length) { return; }
		var first = f[0], last = f[f.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	}

	/* ------------------------------------------------------------------ theme */
	function initialTheme() {
		var saved = lsGet(LS_THEME, null);
		if (saved) { return saved; }
		var def = S.boot.brand.theme;
		if (def === 'dark' || def === 'light') { return def; }
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	function setTheme(th) {
		S.theme = th;
		root.setAttribute('data-theme', th);
		lsSet(LS_THEME, th);
		if (els.themeBtn) { clear(els.themeBtn); els.themeBtn.appendChild(icon(th === 'dark' ? 'sun' : 'moon')); els.themeBtn.setAttribute('aria-label', th === 'dark' ? t('theme_light') : t('theme_dark')); }
	}

	/* ------------------------------------------------------------------ build shell */
	function build() {
		S.lastFocus = document.activeElement;
		S.bld = false; els.build = null;
		root = h('div', { class: 'agh-root agh-overlay' + (S.boot.brand.animations ? '' : ' agh-noanim'), role: 'dialog', 'aria-modal': 'true', 'aria-label': S.boot.brand.name, 'data-shadow': S.boot.brand.shadow || 'soft' });
		S.theme = initialTheme();
		root.setAttribute('data-theme', S.theme);
		root.addEventListener('mousedown', function (e) { if (e.target === root) { close(); } });

		shell = h('div', { class: 'agh-shell is-tab-' + S.tab, 'data-actionbar': S.boot.layout.action_bar });
		if (S.boot.brand.background) { shell.setAttribute('data-bg', '1'); shell.style.setProperty('--agh-bg-img', 'url("' + S.boot.brand.background.replace(/"/g, '') + '")'); }

		shell.appendChild(buildHeader());
		var body = h('div', { class: 'agh-body' });
		var panels = {
			params: els.paramsPanel = h('section', { class: 'agh-panel agh-glass agh-panel-params', 'aria-label': t('panel_params') }),
			stage: els.stagePanel = h('section', { class: 'agh-panel agh-glass agh-panel-stage agh-stage', 'aria-label': t('panel_stage') }),
			summary: els.summaryPanel = h('aside', { class: 'agh-panel agh-glass agh-panel-summary', 'aria-label': t('panel_summary') })
		};
		var order = S.boot.layout.order.length === 3 ? S.boot.layout.order : ['params', 'stage', 'summary'];
		order.forEach(function (k) { body.appendChild(panels[k]); });
		if (order[0] !== 'params') {
			var widths = order.map(function (k) { return k === 'params' ? 'var(--agh-left-w)' : (k === 'summary' ? 'var(--agh-right-w)' : 'minmax(0,1fr)'); });
			body.style.gridTemplateColumns = widths.join(' ');
		}
		shell.appendChild(body);
		shell.appendChild(els.actionbar = h('footer', { class: 'agh-actionbar' }));
		shell.appendChild(buildMobileTabs());
		shell.appendChild(els.toasts = h('div', { class: 'agh-toasts', 'aria-live': 'polite' }));
		root.appendChild(shell);
		document.body.appendChild(root);
		// the loader's indicator goes in the same frame the designer appears
		Array.prototype.forEach.call(document.querySelectorAll('.agh-boot'), function (n) { n.remove(); });
		document.documentElement.style.overflow = 'hidden';
		document.addEventListener('keydown', onKey);

		renderParams();
		renderStage();
		renderSummary();
		renderActionbar();
		validate();
		if (startInWizard()) { enterWizard(0); }
		setTimeout(function () { if (S.wiz) { return; } var f = shell.querySelector('.agh-rail button'); if (f) { f.focus(); } }, 50);
	}

	function buildHeader() {
		var b = S.boot.brand;
		var mark = b.logo ? h('img', { src: b.logo, alt: b.name })
			: (b.icon ? h('img', { class: 'agh-brand-icon', src: b.icon, alt: b.name }) : h('div', { class: 'agh-brand-mark' }, icon('home')));
		var brand = h('div', { class: 'agh-brand' },
			mark,
			h('div', { style: { 'min-width': '0' } },
				h('div', { class: 'agh-brand-name', text: b.title || b.name }),
				h('div', { class: 'agh-brand-sub', text: b.header || (b.author ? b.author : t('tagline')) })
			)
		);
		var mode = h('div', { class: 'agh-seg agh-hide-m', role: 'group', 'aria-label': t('mode') },
			h('button', { type: 'button', 'aria-pressed': S.mode === 'simple' ? 'true' : 'false', onclick: function () { setMode('simple'); }, text: t('mode_simple') }),
			h('button', { type: 'button', 'aria-pressed': S.mode === 'detailed' ? 'true' : 'false', onclick: function () { setMode('detailed'); }, text: t('mode_detailed') })
		);
		els.modeSeg = mode;
		var tools = h('div', { class: 'agh-header-tools' });
		// Quick wizard <-> full designer (label set by updateWizardToggles()).
		els.wizBtn = h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-accent agh-hide-m agh-wiz-toggle', onclick: toggleWizard });
		tools.appendChild(els.wizBtn);
		// „Építés az alapoktól”: only when the build mode is switched on (otherwise the header is unchanged)
		if (buildOn()) { els.bldBtn = h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-hide-m agh-bld-btn', onclick: toggleBuild }); tools.appendChild(els.bldBtn); updateBuildToggles(); }
		tools.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-hide-m', onclick: showPresets }, icon('layers', 'agh-ico-s'), t('presets')));
		tools.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-hide-m', onclick: showProjects }, icon('folder', 'agh-ico-s'), t('my_projects')));
		tools.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-hide-m', 'data-agh-restart': '1', onclick: restart }, icon('restart', 'agh-ico-s'), t('restart')));
		if (S.boot.languages && S.boot.languages.length > 1) {
			var sel = h('select', { class: 'agh-select agh-hide-m', 'aria-label': t('language'), style: { width: 'auto', 'min-height': '36px', 'border-radius': '999px' }, onchange: function (e) { switchLang(e.target.value); } });
			S.boot.languages.forEach(function (l) { sel.appendChild(h('option', { value: l.code, selected: l.code === S.locale ? 'selected' : null, text: l.label })); });
			tools.appendChild(sel);
		}
		// Small screens: the controls hidden above are reachable from this overflow menu.
		els.menuBtn = h('button', { type: 'button', class: 'agh-iconbtn agh-show-m', 'aria-label': t('more'), title: t('more'), 'aria-expanded': 'false', 'aria-controls': 'agh-hmenu', onclick: function () { if (menuOpen()) { closeMenu(true); } else { openMenu(); } } }, icon('more'));
		tools.appendChild(els.menuBtn);
		els.themeBtn = h('button', { type: 'button', class: 'agh-iconbtn', onclick: function () { setTheme(S.theme === 'dark' ? 'light' : 'dark'); } });
		tools.appendChild(els.themeBtn);
		tools.appendChild(h('button', { type: 'button', class: 'agh-iconbtn agh-hide-m', 'aria-label': t('help'), title: t('help'), onclick: showTour }, icon('help')));
		tools.appendChild(fsButton(function () { return root; }, 'agh-iconbtn agh-fsbtn-shell'));
		tools.appendChild(h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('close'), title: t('close'), onclick: function () { close(); } }, icon('close')));
		var header = h('header', { class: 'agh-header' }, brand, h('div', { class: 'agh-header-spacer' }), mode, tools, buildMenu());
		updateWizardToggles();
		setTimeout(function () { setTheme(S.theme); }, 0);
		return header;
	}

	/* ------------------------------------------------------------------ header overflow menu (small screens) */
	function buildMenu() {
		var m = h('div', { class: 'agh-hmenu', id: 'agh-hmenu', role: 'group', 'aria-label': t('more'), hidden: true });
		m.appendChild(h('div', { class: 'agh-hmenu-label', id: 'agh-hmenu-mode', text: t('mode') }));
		els.menuModeSeg = h('div', { class: 'agh-seg', role: 'group', 'aria-labelledby': 'agh-hmenu-mode' },
			h('button', { type: 'button', 'aria-pressed': S.mode === 'simple' ? 'true' : 'false', onclick: function () { setMode('simple'); }, text: t('mode_simple') }),
			h('button', { type: 'button', 'aria-pressed': S.mode === 'detailed' ? 'true' : 'false', onclick: function () { setMode('detailed'); }, text: t('mode_detailed') })
		);
		m.appendChild(els.menuModeSeg);
		m.appendChild(h('div', { class: 'agh-hmenu-sep', role: 'presentation' }));
		function item(ico, label, fn) {
			return h('button', { type: 'button', class: 'agh-hmenu-item', onclick: function () { closeMenu(false); fn(); } }, icon(ico, 'agh-ico-s'), label);
		}
		els.wizItem = h('button', { type: 'button', class: 'agh-hmenu-item', onclick: function () { closeMenu(false); toggleWizard(); } });
		m.appendChild(els.wizItem);
		if (buildOn()) { m.appendChild(item('wall', t('b_open'), toggleBuild)); }
		m.appendChild(item('layers', t('presets'), showPresets));
		m.appendChild(item('folder', t('my_projects'), showProjects));
		m.appendChild(item('restart', t('restart'), restart));
		m.appendChild(item('help', t('help'), showTour));
		if (S.boot.languages && S.boot.languages.length > 1) {
			var sel = h('select', { class: 'agh-select', id: 'agh-hmenu-lang', onchange: function (e) { closeMenu(false); switchLang(e.target.value); } });
			S.boot.languages.forEach(function (l) { sel.appendChild(h('option', { value: l.code, selected: l.code === S.locale ? 'selected' : null, text: l.label })); });
			m.appendChild(h('div', { class: 'agh-hmenu-sep', role: 'presentation' }));
			m.appendChild(h('label', { class: 'agh-hmenu-lang', for: 'agh-hmenu-lang' }, h('span', { class: 'agh-hmenu-label' }, icon('globe', 'agh-ico-s'), t('language')), sel));
		}
		m.addEventListener('keydown', onMenuKey);
		m.addEventListener('focusout', function (e) {
			// Tabbing out of the menu closes it (focus stays where the user moved it).
			if (e.relatedTarget && !m.contains(e.relatedTarget) && e.relatedTarget !== els.menuBtn) { closeMenu(false); }
		});
		els.menu = m;
		return m;
	}
	function menuItems() {
		return Array.prototype.filter.call(els.menu.querySelectorAll('button, select'), function (el) { return !el.disabled; });
	}
	function menuOpen() { return !!(els.menu && !els.menu.hidden && root && root.contains(els.menu)); }
	function openMenu() {
		els.menu.hidden = false;
		els.menuBtn.setAttribute('aria-expanded', 'true');
		document.addEventListener('pointerdown', onMenuOutside, true);
		var first = menuItems()[0];
		if (first) { first.focus(); }
	}
	function closeMenu(restoreFocus) {
		document.removeEventListener('pointerdown', onMenuOutside, true);
		if (!els.menu || els.menu.hidden) { return; }
		els.menu.hidden = true;
		els.menuBtn.setAttribute('aria-expanded', 'false');
		if (restoreFocus) { els.menuBtn.focus(); }
	}
	function onMenuOutside(e) {
		if (els.menu && !els.menu.contains(e.target) && !els.menuBtn.contains(e.target)) { closeMenu(false); }
	}
	function onMenuKey(e) {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') { return; }
		if (e.target.tagName === 'SELECT') { return; }
		var list = menuItems(), i = list.indexOf(document.activeElement);
		if (!list.length) { return; }
		e.preventDefault();
		var n = e.key === 'Home' ? 0 : (e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
		list[n].focus();
	}

	function buildMobileTabs() {
		var tabs = h('nav', { class: 'agh-mobile-tabs', 'aria-label': t('panels') });
		[['params', 'sliders', t('tab_params')], ['stage', 'home', t('tab_stage')], ['summary', 'info', t('tab_summary')]].forEach(function (x) {
			tabs.appendChild(h('button', { type: 'button', 'aria-current': S.tab === x[0] ? 'true' : 'false', onclick: function () { setTab(x[0]); } }, icon(x[1]), x[2]));
		});
		els.mtabs = tabs;
		return tabs;
	}
	function setTab(tab) {
		S.tab = tab;
		shell.className = shell.className.replace(/is-tab-\w+/, 'is-tab-' + tab);
		Array.prototype.forEach.call(els.mtabs.children, function (b, i) { b.setAttribute('aria-current', ['params', 'stage', 'summary'][i] === tab ? 'true' : 'false'); });
	}

	function setMode(m) {
		S.mode = m;
		syncModeSeg();
		persist();
		renderFields();
	}
	function syncModeSeg() {
		[els.modeSeg, els.menuModeSeg].forEach(function (seg) {
			if (!seg) { return; }
			Array.prototype.forEach.call(seg.children, function (b, i) { b.setAttribute('aria-pressed', (i === 0 ? 'simple' : 'detailed') === S.mode ? 'true' : 'false'); });
		});
	}

	function switchLang(code) {
		lsSet(LS_KEY, { v: S.boot.version, config: S.config, explicit: S.explicit, project: S.projectId, mode: S.mode, autoRoof: S.autoRoof, styleApplied: S.styleApplied || null });
		S.lang = code;
		loadBoot(code).then(function () {
			var cfg = S.config;
			stopPoll();
			document.removeEventListener('keydown', onKey);
			root.remove();
			root = null;
			S.config = cfg;
			build();
			if (S.project) { renderStage(); renderSummary(); schedulePoll(); }
		});
	}

	/* ------------------------------------------------------------------ params panel */
	function catFields(cat) {
		var q = S.search.trim().toLowerCase();
		return S.boot.schema.fields.filter(function (f) {
			if (f.type === 'roomitems' || f.type === 'layout' || f.type === 'build') { return false; }
			if (q) { return (f.label + ' ' + (f.help || '')).toLowerCase().indexOf(q) !== -1; }
			if (f.category !== cat) { return false; }
			if (S.mode === 'simple' && f.advanced) { return false; }
			return visible(f);
		});
	}
	function visible(f) {
		var s = f.show_if;
		if (!s) { return true; }
		var cur = S.config[s.field];
		switch (s.op) {
			case '!=': return String(cur) !== String(s.value);
			case '>': return Number(cur) > Number(s.value);
			case '<': return Number(cur) < Number(s.value);
			// "in": the value is one of these – on a multiselect: the list contains one of them
			case 'in': return Array.isArray(cur) ? cur.some(function (v) { return (s.value || []).map(String).indexOf(String(v)) !== -1; }) : (s.value || []).map(String).indexOf(String(cur)) !== -1;
			default: return String(cur) === String(s.value);
		}
	}

	function renderParams() {
		var p = clear(els.paramsPanel);
		var rail = h('nav', { class: 'agh-rail', 'aria-label': t('categories') });
		S.boot.schema.categories.forEach(function (c) {
			var hasFields = S.boot.schema.fields.some(function (f) { return f.category === c.id; });
			if (!hasFields) { return; }
			var btn = h('button', { type: 'button', title: c.label, 'aria-label': c.label, 'aria-current': S.cat === c.id && !S.search ? 'true' : 'false', 'data-cat': c.id, style: catColor(c.icon) ? '--agh-cat:' + catColor(c.icon) : null, onclick: function () { S.cat = c.id; S.search = ''; if (els.searchInput) { els.searchInput.value = ''; } updateRail(); renderFields(); var was = S.view + '|' + S.roomId; autoView(null, c.id); if (was !== S.view + '|' + S.roomId) { renderPreviewOnly(); } } }, catIcon(c.icon));
			rail.appendChild(btn);
		});
		els.rail = rail;
		var fieldsWrap = h('div', { class: 'agh-fields' });
		els.fieldsHead = h('div', { class: 'agh-fields-head' });
		els.searchInput = h('input', { type: 'search', placeholder: t('search_params'), 'aria-label': t('search_params'), oninput: debounce(function (e) { S.search = e.target.value; updateRail(); renderFields(); }, 150) });
		// The head is built once and never re-created: re-parenting the input would drop focus on the first keystroke.
		els.fieldsTitle = h('h3', { class: 'agh-h' });
		els.fieldsHead.appendChild(els.fieldsTitle);
		els.fieldsHead.appendChild(h('div', { class: 'agh-search' }, icon('search'), els.searchInput));
		els.fieldsList = h('div', { class: 'agh-fields-list' });
		fieldsWrap.appendChild(els.fieldsHead);
		fieldsWrap.appendChild(h('div', { class: 'agh-scroll' }, els.fieldsList));
		p.appendChild(h('div', { class: 'agh-params' }, rail, fieldsWrap));
		renderFields();
	}
	function updateRail() {
		var flags = {};
		S.check.errors.forEach(function (m) { var f = S.fields[m.field]; if (f) { flags[f.category] = 'err'; } });
		S.check.warnings.forEach(function (m) { var f = S.fields[m.field]; if (f && !flags[f.category]) { flags[f.category] = 'warn'; } });
		Array.prototype.forEach.call(els.rail.children, function (b) {
			var c = b.getAttribute('data-cat');
			b.setAttribute('aria-current', !S.search && c === S.cat ? 'true' : 'false');
			var old = b.querySelector('.agh-rail-flag');
			if (old) { old.remove(); }
			if (flags[c]) { b.appendChild(h('span', { class: 'agh-rail-flag' + (flags[c] === 'warn' ? ' is-warn' : '') })); }
		});
	}

	function renderFields() {
		if (S.wiz) { renderWizardStep(false); return; }
		var cat = S.boot.schema.categories.filter(function (c) { return c.id === S.cat; })[0] || S.boot.schema.categories[0];
		// A value change re-renders the list: keep the scroll offset and the keyboard position in the same category.
		var scroller = els.fieldsList && els.fieldsList.parentNode, sameView = els.listKey === S.cat + '|' + S.search + '|' + S.mode;
		var keepTop = scroller && sameView ? scroller.scrollTop : 0, act = document.activeElement, keepFocus = null;
		if (sameView && act && els.fieldsList.contains(act) && act.closest('[data-field]')) {
			var fw = act.closest('[data-field]');
			keepFocus = { field: fw.getAttribute('data-field'), idx: Array.prototype.indexOf.call(fw.querySelectorAll('button, input, select, textarea'), act) };
		}
		els.listKey = S.cat + '|' + S.search + '|' + S.mode;
		if (els.fieldsTitle) { els.fieldsTitle.textContent = S.search ? t('search_results') : cat.label; }
		var list = clear(els.fieldsList);
		var fields = catFields(S.cat);
		if (!fields.length) { list.appendChild(h('p', { class: 'agh-muted', text: t('no_fields') })); }
		fields.forEach(function (f) { list.appendChild(renderField(f)); });
		if (!S.search && S.mode === 'simple') {
			var hidden = S.boot.schema.fields.filter(function (f) { return f.category === S.cat && f.advanced && f.type !== 'roomitems' && visible(f); }).length;
			if (hidden) { list.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', onclick: function () { setMode('detailed'); } }, icon('sliders', 'agh-ico-s'), tf('show_advanced', hidden))); }
		}
		if (S.cat === 'custom' && !S.search) { list.appendChild(renderInterpret()); }
		if (scroller) { scroller.scrollTop = keepTop; }
		if (keepFocus) {
			var fw2 = list.querySelector('[data-field="' + keepFocus.field + '"]'), ctl = fw2 ? fw2.querySelectorAll('button, input, select, textarea')[keepFocus.idx] : null;
			if (ctl && ctl.tagName !== 'INPUT') { try { ctl.focus({ preventScroll: true }); } catch (e) { ctl.focus(); } }
		}
		// Licence plan without the full parameter set: say so instead of silently showing less.
		var locked = S.boot.features && !S.boot.features.full_params ? Number(S.boot.features.params_locked || 0) : 0;
		if (locked > 0) {
			list.appendChild(h('div', { class: 'agh-plan-note', role: 'note' }, icon('lock', 'agh-ico-s'),
				h('div', null, h('span', { text: tf('plan_limited', locked) }), S.boot.features.manage ? h('span', { class: 'agh-small', text: t('plan_limited_admin') }) : null)));
		}
		updateRail();
	}

	// Remembers which parameter changed and how the sketch looked before, so the preview can tell
	// whether the change is visible on the sketch (compared drawing, not a fixed list).
	function markChange(id) {
		var box = (S.wiz && els.wizPv) || els.previewBox;
		var prev = S.lastChange && S.lastChange.id === id && Date.now() - S.lastChange.at < 1500 ? S.lastChange.before : null;
		S.lastChange = { id: id, at: Date.now(), before: prev || (box && box._aghSk) || null };
	}
	function setValue(id, value, rerender) {
		if (id === 'roof_product') { S.autoRoof = ''; }
		markChange(id);
		S.config[id] = value;
		S.explicit[id] = true;
		S.dirty = true;
		autoView(id);
		persist();
		validate();
		var dependents = S.boot.schema.fields.some(function (f) { return f.show_if && f.show_if.field === id; }) || S.boot.schema.fields.some(function (f) { return f.filter_by === id; });
		if (id === 'arch_style') { applyStyle(S.config.arch_style); }
		renderPreviewOnly();
		renderSummary();
		// One rebuild of the 3D house per change: a re-rendered wizard step refreshes its side itself.
		if (rerender || dependents) { renderFields(); }
		if (!(S.wiz && (rerender || dependents))) { updateWizardSide(); }
	}

	/* The chosen style drives the house: its suggested roof, facade, windows, colours and garden are
	 * applied to every parameter the visitor has not set personally; the previous style's suggestions
	 * are taken back first, so switching styles never leaves a mix of two styles behind. */
	function stylePack(v) {
		return (S.boot.schema.presets || []).filter(function (p) { return p.slug === 'style-' + v; })[0] || null;
	}
	function applyStyle(v, quiet) {
		var next = stylePack(v), prev = S.styleApplied ? stylePack(S.styleApplied) : null, n = 0;
		if (prev && S.styleApplied !== v) {
			Object.keys(prev.values).forEach(function (k) { if (k !== 'arch_style' && !S.explicit[k] && k in S.boot.defaults) { S.config[k] = clone(S.boot.defaults[k]); } });
		}
		if (next) {
			Object.keys(next.values).forEach(function (k) {
				if (k === 'arch_style' || S.explicit[k] || !S.fields[k]) { return; }
				if (JSON.stringify(S.config[k]) !== JSON.stringify(next.values[k])) { n++; }
				S.config[k] = clone(next.values[k]);
			});
		}
		S.styleApplied = v;
		if (n) { persist(); }
		if (n && !quiet && next) { toast(tf('wiz_style_applied', next.name), 'ok', 3500); }
		return n;
	}

	function fieldMessages(id) {
		var out = [];
		['errors', 'warnings', 'info'].forEach(function (k) {
			(S.check[k] || []).forEach(function (m) { if (m.field === id) { out.push({ type: k === 'errors' ? 'error' : (k === 'warnings' ? 'warning' : 'info'), text: m.message }); } });
		});
		// 1.22.0: what does not fit on the plot (pool, garage), worked out by the shared plan
		siteFits().forEach(function (m) { if (m.field === id) { out.push({ type: 'warning', text: tf.apply(null, [m.key].concat(m.args.map(function (v) { return fmt(v); }))) }); } });
		return out;
	}
	var FIT = { k: null, v: [] };
	function siteFits() {
		var K = window.AGH_Sketch;
		if (!K || !K._siteFit) { return []; }
		var k = JSON.stringify(S.config);
		if (FIT.k !== k) { FIT.k = k; FIT.v = K._siteFit(S.config); }
		return FIT.v;
	}

	function renderField(f) {
		var wrap = h('div', { class: 'agh-field', 'data-field': f.id });
		var top = h('div', { class: 'agh-field-top' }, h('label', { class: 'agh-label', for: 'agh-f-' + f.id, text: f.label }), f.required ? h('span', { class: 'agh-req', text: '*', title: t('required') }) : null, f.advanced ? h('span', { class: 'agh-adv-tag', text: t('advanced') }) : null);
		wrap.appendChild(top);
		if (f.help) { wrap.appendChild(h('p', { class: 'agh-help', text: f.help })); }
		var v = S.config[f.id];
		var ctl;
		switch (f.type) {
			case 'toggle':
				ctl = h('label', { class: 'agh-switch' }, h('input', { type: 'checkbox', id: 'agh-f-' + f.id, checked: v ? 'checked' : null, onchange: function (e) { setValue(f.id, e.target.checked); } }), h('span', { class: 'agh-switch-track' }), h('span', { class: 'agh-small agh-muted', text: v ? t('yes') : t('no') }));
				ctl.querySelector('input').addEventListener('change', function (e) { ctl.lastChild.textContent = e.target.checked ? t('yes') : t('no'); });
				break;
			case 'integer':
			case 'number':
			case 'range':
				ctl = renderNumber(f, v);
				break;
			case 'color':
				ctl = renderColor(f, v);
				break;
			case 'image':
				ctl = renderImage(f, v);
				break;
			case 'cards':
				ctl = h('div', { class: 'agh-cards', role: 'radiogroup', 'aria-label': f.label });
				(f.options || []).forEach(function (o) {
					ctl.appendChild(h('button', { type: 'button', class: 'agh-card-opt', role: 'radio', 'aria-pressed': String(v) === o.value ? 'true' : 'false', 'aria-checked': String(v) === o.value ? 'true' : 'false', onclick: function () { setValue(f.id, o.value, true); } }, o.thumb ? h('img', { src: o.thumb, alt: '', loading: 'lazy', decoding: 'async' }) : cardVisual(f.id, o.value), h('span', { class: 'agh-card-label', text: o.label })));
					ctl.lastChild.classList.add('agh-card-photo'); ctl.classList.add('has-photos');
				});
				break;
			case 'multiselect':
				if (ROOM_ITEMS.indexOf(f.id) !== -1) { wrap.appendChild(roomItemsHint(f)); }
				if (f.visual === 'item' && (A3 || A3wait)) { ctl = multiCards(f, v); break; }
				ctl = h('div', { class: 'agh-quick', role: 'group', 'aria-label': f.label });
				var arr = Array.isArray(v) ? v.slice() : [];
				(f.options || []).forEach(function (o) {
					var on = ROOM_ITEMS.indexOf(f.id) !== -1 ? itemOn(f.id, o.value) : arr.indexOf(o.value) !== -1;
					ctl.appendChild(h('button', { type: 'button', class: 'agh-chip', 'aria-pressed': on ? 'true' : 'false', onclick: function (e) {
						if (ROOM_ITEMS.indexOf(f.id) !== -1) { toggleRoomItem(f, o.value); return; }
						var cur = Array.isArray(S.config[f.id]) ? S.config[f.id].slice() : [];
						var i = cur.indexOf(o.value);
						if (i === -1) {
							if (f.max_items && cur.length >= f.max_items) { toast(tf('max_items', f.max_items), 'warn'); return; }
							cur.push(o.value);
						} else { cur.splice(i, 1); }
						e.currentTarget.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
						setValue(f.id, cur);
					} }, on ? icon('check', 'agh-ico-s') : null, o.label));
				});
				break;
			case 'select':
				ctl = renderSelect(f, v);
				break;
			case 'textarea':
				ctl = h('textarea', { class: 'agh-textarea', id: 'agh-f-' + f.id, maxlength: f.max || 1500, oninput: debounce(function (e) { setValue(f.id, e.target.value); }, 400) });
				ctl.value = v || '';
				break;
			case 'rooms':
				ctl = renderRooms();
				break;
			case 'outbuildings':
				ctl = renderOutbuildings(f);
				break;
			default:
				ctl = h('input', { class: 'agh-input', id: 'agh-f-' + f.id, type: 'text', maxlength: f.max || 200, value: v || '', oninput: debounce(function (e) { setValue(f.id, e.target.value); }, 400) });
		}
		wrap.appendChild(ctl);
		fieldMessages(f.id).forEach(function (m) { wrap.appendChild(h('div', { class: 'agh-field-msg is-' + m.type, text: m.text })); });
		return wrap;
	}

	// Several choices as picture cards (each card switches its item on or off).
	// A picture of the visitor's own (for a frame in the 3D preview): read in the browser and scaled down
	// to at most 640 px as a JPEG, so it stays small in the saved design.
	function renderImage(f, v) {
		var box = h('div', { class: 'agh-image' }), inp = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'agh-f-' + f.id, class: 'agh-image-input' });
		if (v) { box.appendChild(h('img', { src: v, alt: '', class: 'agh-image-prev' })); }
		box.appendChild(h('label', { class: 'agh-btn agh-image-pick', for: 'agh-f-' + f.id }, icon('plus', 'agh-ico-s'), h('span', { text: t(v ? 'image_change' : 'image_pick') })));
		box.appendChild(inp);
		if (v) { box.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-ghost', onclick: function () { setValue(f.id, '', true); } }, h('span', { text: t('image_remove') }))); }
		inp.addEventListener('change', function () {
			var file = inp.files && inp.files[0];
			if (!file || !/^image\//.test(file.type)) { return; }
			var rd = new FileReader();
			rd.onload = function () {
				var img = new Image();
				img.onload = function () {
					var k = Math.min(1, 640 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
					cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
					cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
					var url = cv.toDataURL('image/jpeg', 0.82);
					if (url.length > 390000) { url = cv.toDataURL('image/jpeg', 0.55); }
					setValue(f.id, url.length > 390000 ? '' : url, true);
				};
				img.onerror = function () { toast(t('image_error'), 'warn'); };
				img.src = rd.result;
			};
			rd.readAsDataURL(file);
		});
		return box;
	}
	/* Household items (extra furniture, electronics, pets) stand in rooms. In the interior view a card puts
	 * its item into the room on screen or takes it out of there; elsewhere a new item goes to a fitting
	 * room (shown right away) and switching one off takes it out of every room. The fields themselves keep
	 * every item that stands somewhere; room_items keeps where. */
	var ROOM_ITEMS = ['extra_furniture', 'electronics', 'pets'];
	function sketchRooms() { var K = window.AGH_Sketch; return K && K._roomsOf ? K._roomsOf(S.config) : []; }
	function itemMap(c) { var K = window.AGH_Sketch; return K && K._roomItems ? K._roomItems(c || S.config, sketchRooms()) : {}; }
	function perRoom() { return S.view === 'int' && !!(A3 || A3wait); }
	function itemOn(fid, val) {
		var map = itemMap();
		if (perRoom()) { return (map[curRoom().id] || []).indexOf(val) !== -1; }
		return Object.keys(map).some(function (id) { return map[id].indexOf(val) !== -1; });
	}
	function roomName(id) { var r = roomList().filter(function (q) { return q.id === id; })[0]; if (r) { return r.name; } var tp = String(id).indexOf('virtual:') === 0 ? String(id).slice(8) : id; return roomType(tp).label || tp; }
	function toggleRoomItem(f, val) {
		var map = itemMap(), next = {}, room = perRoom() ? curRoom().id : null;
		Object.keys(map).forEach(function (id) { next[id] = map[id].slice(); });
		var inAny = Object.keys(next).some(function (id) { return next[id].indexOf(val) !== -1; });
		if (!room && inAny) { Object.keys(next).forEach(function (id) { next[id] = next[id].filter(function (k) { return k !== val; }); }); }
		else {
			if (!room) {
				// the fitting room for a new item, and the interior view shows it there (pets stay in the garden view)
				var tmp = {}; Object.keys(S.config).forEach(function (k) { tmp[k] = S.config[k]; }); tmp[f.id] = (S.config[f.id] || []).concat([val]); tmp.room_items = next;
				var m2 = itemMap(tmp); room = Object.keys(m2).filter(function (id) { return m2[id].indexOf(val) !== -1; })[0] || (curRoom() || {}).id;
				if (f.id !== 'pets' && A3) { S.view = 'int'; S.roomId = room; }
			}
			var here = next[room] = next[room] || [], i = here.indexOf(val);
			if (i === -1) {
				if (f.max_items && here.length >= f.max_items) { toast(tf('max_items', f.max_items), 'warn'); return; }
				here.push(val);
			} else { here.splice(i, 1); }
		}
		var all = {}; Object.keys(next).forEach(function (id) { next[id].forEach(function (k) { all[k] = 1; }); if (!next[id].length) { delete next[id]; } });
		ROOM_ITEMS.forEach(function (id2) {
			var arr = ((S.fields[id2] || {}).options || []).map(function (o) { return o.value; }).filter(function (x) { return all[x]; });
			if (JSON.stringify(arr) !== JSON.stringify(S.config[id2] || [])) { S.config[id2] = arr; S.explicit[id2] = true; }
		});
		setValue('room_items', next, true);
	}
	// One line above the item cards: which room the cards act on, and what of this kind stands elsewhere.
	function roomItemsHint(f) {
		var map = itemMap(), opts = {}, here = perRoom() ? curRoom().id : null, other = [];
		(f.options || []).forEach(function (o) { opts[o.value] = o.label; });
		Object.keys(map).forEach(function (id) { if (id === here) { return; } map[id].forEach(function (k) { if (opts[k]) { other.push(opts[k] + ' – ' + roomName(id)); } }); });
		var box = h('div', { class: 'agh-help agh-items-hint' });
		box.appendChild(h('span', { text: here ? tf('items_here', roomName(here)) : t('items_auto') }));
		if (!here && A3 && f.id !== 'pets') { box.appendChild(h('button', { type: 'button', class: 'agh-linkbtn', onclick: function () { setView('int'); } }, t('items_pick_room'))); }
		if (other.length) { box.appendChild(h('span', { class: 'agh-items-other', text: tf('items_elsewhere', other.join(', ')) })); }
		return box;
	}
	// The 3D room finds every item a place; when it had to move or shrink something, one short note says what.
	/* ---------------------------------------------------------------- hand-made arrangement (1.9.0)
	 * A piece dragged or turned in the room is kept per room and per piece in `room_layout`, so it stays
	 * where the visitor put it. Ctrl+Z takes back the last move, and a room can be reset to the automatic
	 * arrangement. */
	var layoutUndo = [];
	// The empty value comes from PHP as an empty list; as a list it would lose its room keys on the next
	// JSON round trip, so it is read as a plain object everywhere.
	function layoutAll() {
		var v = S.config.room_layout;
		return v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : {};
	}
	function curRoomId() {
		var r = curRoom();
		return r ? (r.id || ('virtual:' + r.type)) : '';
	}
	function grabNote(key) {
		var name = itemLabel(key) || (S.fields[key] ? S.fields[key].label : '');
		if (name) { toast(tf('layout_moving', name), 'ok', 1400); }
	}
	function saveLayout(slot, pos) {
		var id = curRoomId();
		if (!id || !slot) { return; }
		var all = layoutAll();
		layoutUndo.push(layoutAll());
		if (layoutUndo.length > 20) { layoutUndo.shift(); }
		all[id] = all[id] || {};
		all[id][slot] = pos;
		S.config.room_layout = all;
		S.explicit.room_layout = true;
		S.dirty = true;
		persist();
		renderSummary();
		refreshLayoutTools();
		toast(t('layout_saved'), 'ok', 1200);
	}
	// The drag itself already moved the piece in the 3D room, so only the small control bar is redrawn.
	function refreshLayoutTools() {
		if (!els.previewBox) { return; }
		var old = els.previewBox.querySelector('.agh-3d-lay');
		if (old && old.parentNode) { old.parentNode.replaceChild(layoutTools(), old); }
	}
	function undoLayout() {
		if (!layoutUndo.length) { return; }
		S.config.room_layout = layoutUndo.pop();
		S.dirty = true;
		persist();
		renderPreviewOnly();
		toast(t('layout_undone'), 'ok', 1400);
	}
	function resetLayout() {
		var id = curRoomId(), all = layoutAll();
		if (!id || !all[id]) { toast(t('layout_none'), 'warn', 1600); return; }
		layoutUndo.push(clone(all));
		delete all[id];
		S.config.room_layout = all;
		S.dirty = true;
		persist();
		renderPreviewOnly();
		toast(t('layout_reset'), 'ok', 1600);
	}
	/* ---------------------------------------------------------------- hand-made site layout (1.18.0)
	 * Outside, every garden piece, window, door and the chimney can be picked up in the 3D view; the new
	 * place goes to `site_layout` (shared with the 2D sketch and the image). Ctrl+Z takes back the last
	 * move, and the outside can be reset to the automatic arrangement. */
	var siteUndo = [];
	function siteAll() {
		var v = S.config.site_layout;
		return v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : {};
	}
	function setSite(all) {
		S.config.site_layout = all;
		S.explicit.site_layout = true;
		S.dirty = true;
		persist();
		renderSummary();
	}
	function saveSite(key, pos, rebuild) {
		if (!key || !pos) { return; }
		var all = siteAll();
		siteUndo.push(siteAll());
		if (siteUndo.length > 30) { siteUndo.shift(); }
		all[key] = pos;
		setSite(all);
		// a window, a door or the chimney: the wall (or roof) is rebuilt around the new place
		if (rebuild) { renderPreviewOnly(); } else { refreshSiteTools(); }
	}
	function refreshSiteTools() {
		if (!els.previewBox || S.view === 'int') { return; }
		var old = els.previewBox.querySelector('.agh-3d-lay');
		if (old && old.parentNode) { old.parentNode.replaceChild(siteTools(), old); }
	}
	function undoSite() {
		if (!siteUndo.length) { return; }
		var last = siteUndo.pop();
		if (last && last.__acc) { setAccent(last.v); } else { setSite(last); }
		renderPreviewOnly();
		toast(t('layout_undone'), 'ok', 1400);
	}
	function resetSite() {
		var all = siteAll();
		if (!Object.keys(all).length) { toast(t('layout_none'), 'warn', 1600); return; }
		siteUndo.push(all);
		setSite({});
		renderPreviewOnly();
		toast(t('site_reset_done'), 'ok', 1600);
	}
	/* ---------------------------------------------------------------- where the accent material goes (1.21.0)
	 * „Díszítőanyag helye” switches the outside view to a paint mode: a tap on a wall puts the first accent
	 * material on that zone (whole wall, upper floors, gable, plinth, entrance bay), the next tap the next
	 * material, then none. Kept in `accent_layout`; Ctrl+Z takes back the last tap. */
	S.paint = false;
	function accAll() { var v = S.config.accent_layout; return v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : {}; }
	function setAccent(all) { S.config.accent_layout = all; S.explicit.accent_layout = true; S.dirty = true; persist(); renderSummary(); }
	function zoneName(hit) { return t('face_' + hit.face) + (hit.vi > 0 ? ' (' + t('face_wing') + ')' : '') + ' · ' + t('zone_' + hit.zone); }
	function paintAt(hit) {
		var acc = S.config.facade_accent || [];
		if (!acc.length) { toast(t('paint_no_accent'), 'warn', 2600); return; }
		var all = accAll(), cur = all[hit.key], n = acc.length, nx;
		if (cur === undefined || cur === null) { nx = 0; } else if (cur >= 0 && cur < n - 1) { nx = cur + 1; } else if (cur === n - 1) { nx = -1; } else { nx = 0; }
		siteUndo.push({ __acc: true, v: accAll() });
		if (siteUndo.length > 30) { siteUndo.shift(); }
		all[hit.key] = nx;
		setAccent(all);
		renderPreviewOnly();
		toast(nx >= 0 ? tf('paint_set', zoneName(hit), optLabel(S.fields.facade_accent || {}, acc[nx])) : tf('paint_cleared', zoneName(hit)), 'ok', 1600);
	}
	function paintTools() {
		var on = !!S.paint, has = Object.keys(accAll()).length > 0;
		return h('div', { class: 'agh-3d-paint' + (on ? ' is-on' : ''), role: 'group', 'aria-label': t('paint_mode') },
			h('button', { type: 'button', class: 'agh-3d-paintbtn', 'aria-pressed': on ? 'true' : 'false', title: t('paint_mode'), onclick: function () { S.paint = !S.paint; var v = A3 && A3.viewer(); if (v) { v.paint = S.paint; if (!S.paint) { v.paintMark(null); } } renderPreviewOnly(); } }, icon('brush', 'agh-ico-s'), h('span', { text: t('paint_mode') })),
			on && has ? h('button', { type: 'button', class: 'agh-3d-laybtn agh-3d-paintreset', title: t('paint_reset'), 'aria-label': t('paint_reset'), onclick: function () { siteUndo.push({ __acc: true, v: accAll() }); setAccent({}); renderPreviewOnly(); } }, icon('refresh', 'agh-ico-s')) : null,
			on ? h('span', { class: 'agh-3d-painthint', text: t('paint_hint') }) : null);
	}
	// While a piece is held or selected: a short line in the view says whether the place is good.
	function moveState(st, slot, dragging) {
		var box = els.previewBox;
		if (!box) { return; }
		var el = box.querySelector('.agh-3d-place');
		if (!st) { if (el) { el.remove(); } return; }
		if (!el) { el = h('div', { class: 'agh-3d-place', role: 'status', 'aria-live': 'polite' }); box.appendChild(el); }
		var msg = st.ok ? t(dragging ? 'place_ok' : 'place_selected') : tf(st.code, st.v !== undefined ? fmt(st.v, 1) : '');
		el.className = 'agh-3d-place ' + (st.ok ? 'is-ok' : 'is-bad');
		el.setAttribute('data-slot', slot || '');
		el.textContent = '';
		el.appendChild(icon(st.ok ? 'check' : 'alert', 'agh-ico-s'));
		el.appendChild(h('span', { text: msg }));
		if (!dragging) { el.appendChild(h('small', { text: t('place_keys') })); }
	}
	// Undo / reset for the outside, beside the view switch; the hint says what can be moved and how.
	function siteTools() {
		var has = Object.keys(siteAll()).length > 0;
		// outside, the top right corner belongs to the style sample: the two buttons sit at the bottom right
		return h('div', { class: 'agh-3d-lay is-site', role: 'group', 'aria-label': t('site_reset') },
			has ? h('button', { type: 'button', class: 'agh-3d-laybtn', title: t('layout_undo'), 'aria-label': t('layout_undo'), disabled: !siteUndo.length, onclick: undoSite }, icon('restart', 'agh-ico-s')) : null,
			has ? h('button', { type: 'button', class: 'agh-3d-laybtn agh-3d-sitereset', title: t('site_reset'), 'aria-label': t('site_reset'), onclick: resetSite }, icon('refresh', 'agh-ico-s')) : null);
	}
	// A tap on a part of the model: the settings jump to the field that part belongs to, and it lights up.
	// A piece with no setting of its own (a household item placed by its own card) only says its name.
	function jumpToField(hit) {
		if (!hit || !hit.field) { return; }
		var f = S.fields[hit.field];
		if (!f) {
			// household items live on the "tárgyak" cards: open that field and name the piece
			var host = S.fields[hit.item] ? hit.item : '';
			ROOM_ITEMS.forEach(function (id) { if (!host) { ((S.fields[id] || {}).options || []).forEach(function (o) { if (o.value === hit.item && !host) { host = id; } }); } });
			if (!host) { if (hit.item) { toast(itemLabel(hit.item) || hit.item, 'ok', 2000); } return; }
			f = S.fields[host];
		}
		if (!f) { return; }
		if (S.wiz) { return; }
		if (FS.el && FS.el !== root && FS.el.classList.contains('agh-preview-box')) { fsExit(); }
		if (S.search) { S.search = ''; if (els.searchInput) { els.searchInput.value = ''; } }
		if (f.advanced && S.mode === 'simple') { setMode('detailed'); }
		if (S.cat !== f.category) { S.cat = f.category; updateRail(); }
		renderFields();
		var el = els.fieldsList && els.fieldsList.querySelector('[data-field="' + f.id + '"]');
		if (!el) { return; }
		try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
		el.classList.remove('is-picked');
		void el.offsetWidth;
		el.classList.add('is-picked');
		setTimeout(function () { el.classList.remove('is-picked'); }, 1600);
	}
	function fixNote() {
		var v = A3 && A3.viewer(), rm = v && v.house && v.house.room;
		if (!rm || S.view !== 'int' || !rm.fixes || !rm.fixes.length) { return; }
		var key = (curRoom() || {}).id + '|' + rm.fixes.join(',');
		if (S.fixKey === key) { return; }
		S.fixKey = key;
		var names = rm.fixes.map(itemLabel).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
		if (names.length) { toast(tf('fixed_items', names.join(', ')), 'ok', 4000); }
	}
	function itemLabel(k) {
		if (S.fields[k]) { return S.fields[k].label; }
		var hit = ''; ROOM_ITEMS.forEach(function (id) { ((S.fields[id] || {}).options || []).forEach(function (o) { if (o.value === k && !hit) { hit = o.label; } }); });
		return hit;
	}
	function multiCards(f, v) {
		var box = h('div', { class: 'agh-cards', role: 'group', 'aria-label': f.label }), arr = Array.isArray(v) ? v : [];
		(f.options || []).forEach(function (o) {
			var on = ROOM_ITEMS.indexOf(f.id) !== -1 ? itemOn(f.id, o.value) : arr.indexOf(o.value) !== -1;
			box.appendChild(h('button', { type: 'button', class: 'agh-card-opt', 'aria-pressed': on ? 'true' : 'false', onclick: function () {
				if (ROOM_ITEMS.indexOf(f.id) !== -1) { toggleRoomItem(f, o.value); return; }
				var cur = Array.isArray(S.config[f.id]) ? S.config[f.id].slice() : [], i = cur.indexOf(o.value);
				if (i === -1) { if (f.max_items && cur.length >= f.max_items) { toast(tf('max_items', f.max_items), 'warn'); return; } cur.push(o.value); } else { cur.splice(i, 1); }
				setValue(f.id, cur, true);
			} }, cardVisual(f.id, o.value), h('span', { class: 'agh-card-label', text: o.label })));
		});
		return box;
	}
	function renderNumber(f, v) {
		var box = h('div', { style: { display: 'flex', 'flex-direction': 'column', gap: '8px' } });
		var min = f.min !== undefined ? f.min : 0, max = f.max !== undefined ? f.max : 100000, step = f.step || 1;
		var num = h('input', { class: 'agh-input', type: 'number', id: 'agh-f-' + f.id, min: min, max: max, step: step, value: v, inputmode: 'decimal' });
		var range = null;
		function fill(val) { if (range) { range.style.setProperty('--agh-fill', ((val - min) / (max - min) * 100) + '%'); } }
		if (f.type === 'range' || (max - min <= 1000 && f.type !== 'integer')) {
			range = h('input', { class: 'agh-range', type: 'range', min: min, max: max, step: step, value: v, 'aria-label': f.label });
			range.addEventListener('input', function (e) { num.value = e.target.value; fill(e.target.value); setValueQuiet(f.id, Number(e.target.value)); });
			range.addEventListener('change', function (e) { setValue(f.id, Number(e.target.value)); });
			fill(v);
		}
		num.addEventListener('change', function (e) {
			var x = Math.min(max, Math.max(min, Number(e.target.value)));
			if (!isFinite(x)) { x = min; }
			if (f.type === 'integer') { x = Math.round(x); }
			e.target.value = x;
			if (range) { range.value = x; fill(x); }
			setValue(f.id, x);
		});
		var row = h('div', { class: 'agh-numrow' });
		if (f.type === 'integer') {
			row.appendChild(h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': '−', onclick: function () { num.value = Math.max(min, Number(num.value) - 1); num.dispatchEvent(new Event('change')); }, text: '−' }));
		}
		row.appendChild(num);
		if (f.type === 'integer') {
			row.appendChild(h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': '+', onclick: function () { num.value = Math.min(max, Number(num.value) + 1); num.dispatchEvent(new Event('change')); }, text: '+' }));
		}
		if (f.unit) { row.appendChild(h('span', { class: 'agh-unit', text: f.unit })); }
		if (range) { box.appendChild(range); }
		box.appendChild(row);
		if (f.quick && f.quick.length) {
			var q = h('div', { class: 'agh-quick' });
			f.quick.forEach(function (x) {
				q.appendChild(h('button', { type: 'button', class: 'agh-chip', 'aria-pressed': Number(v) === Number(x) ? 'true' : 'false', onclick: function () { num.value = x; num.dispatchEvent(new Event('change')); setTimeout(renderFields, 0); }, text: fmt(x, 0) + (f.unit ? ' ' + f.unit : '') }));
			});
			box.appendChild(q);
		}
		return box;
	}
	var setValueQuiet = debounce(function (id, v) { markChange(id); autoView(id); S.config[id] = v; S.explicit[id] = true; S.dirty = true; renderPreviewOnly(); renderSummary(); updateWizardSide(); }, 60);

	/* ---------------------------------------------------------------- colour picker (1.9.0)
	 * The browser's own colour dialog is the operating system's old palette window, so the designer
	 * brings its own: a saturation/brightness field with a hue slider, a HEX box, the colours already
	 * used in this design and the palettes of the catalogue. It works with a finger and with the
	 * keyboard, and Escape closes it. `onPick` gets every live change, `onDone` the committed one.
	 */
	function hsvToHex(hh, ss, vv) {
		var i = Math.floor(hh * 6), fr = hh * 6 - i, p = vv * (1 - ss), q = vv * (1 - fr * ss), u = vv * (1 - (1 - fr) * ss), r, g2, b2;
		switch (i % 6) {
			case 0: r = vv; g2 = u; b2 = p; break;
			case 1: r = q; g2 = vv; b2 = p; break;
			case 2: r = p; g2 = vv; b2 = u; break;
			case 3: r = p; g2 = q; b2 = vv; break;
			case 4: r = u; g2 = p; b2 = vv; break;
			default: r = vv; g2 = p; b2 = q;
		}
		return '#' + [r, g2, b2].map(function (x) { var n = Math.round(x * 255).toString(16); return n.length < 2 ? '0' + n : n; }).join('').toUpperCase();
	}
	function hexToHsv(hex) {
		var x = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
		if (!x) { return { h: 0, s: 0, v: 1 }; }
		var n = parseInt(x[1], 16), r = ((n >> 16) & 255) / 255, g2 = ((n >> 8) & 255) / 255, b2 = (n & 255) / 255;
		var mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2), d = mx - mn, hh = 0;
		if (d) {
			if (mx === r) { hh = ((g2 - b2) / d + (g2 < b2 ? 6 : 0)) / 6; }
			else if (mx === g2) { hh = ((b2 - r) / d + 2) / 6; }
			else { hh = ((r - g2) / d + 4) / 6; }
		}
		return { h: hh, s: mx ? d / mx : 0, v: mx };
	}
	// every colour the design already uses, newest first (so a shade can be reused with one tap)
	function usedColors() {
		var out = [];
		Object.keys(S.fields).forEach(function (id) {
			if (S.fields[id].type !== 'color') { return; }
			var val = S.config[id];
			if (/^#[0-9a-fA-F]{6}$/.test(String(val)) && out.indexOf(val.toUpperCase()) === -1) { out.push(val.toUpperCase()); }
		});
		(S.config.rooms || []).forEach(function (r) {
			['wall_color', 'furniture_color'].forEach(function (k) {
				var val = r[k];
				if (/^#[0-9a-fA-F]{6}$/.test(String(val)) && out.indexOf(val.toUpperCase()) === -1) { out.push(val.toUpperCase()); }
			});
		});
		return out.slice(0, 12);
	}
	function colorPopover(start, label, onPick, onDone) {
		var hsv = hexToHsv(start), cur = (start || '#FFFFFF').toUpperCase();
		var pop = h('div', { class: 'agh-cp', role: 'dialog', 'aria-label': label || t('color') });
		var area = h('div', { class: 'agh-cp-area', tabindex: '0', role: 'slider', 'aria-label': t('color') });
		var dot = h('span', { class: 'agh-cp-dot' });
		area.appendChild(dot);
		var hue = h('input', { class: 'agh-cp-hue', type: 'range', min: 0, max: 360, step: 1, value: Math.round(hsv.h * 360), 'aria-label': 'HUE' });
		var prev = h('span', { class: 'agh-cp-prev' });
		var hexIn = h('input', { class: 'agh-input agh-cp-hex', type: 'text', maxlength: 7, value: cur, 'aria-label': 'HEX', spellcheck: 'false' });
		function paint(live) {
			cur = hsvToHex(hsv.h, hsv.s, hsv.v);
			area.style.background = 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ' + hsvToHex(hsv.h, 1, 1) + ')';
			dot.style.left = (hsv.s * 100) + '%';
			dot.style.top = ((1 - hsv.v) * 100) + '%';
			dot.style.background = cur;
			prev.style.background = cur;
			if (document.activeElement !== hexIn) { hexIn.value = cur; }
			area.setAttribute('aria-valuetext', cur);
			if (onPick && live !== false) { onPick(cur); }
		}
		function fromPoint(e) {
			var r = area.getBoundingClientRect(), p = e.touches && e.touches[0] ? e.touches[0] : e;
			hsv.s = Math.min(1, Math.max(0, (p.clientX - r.left) / Math.max(1, r.width)));
			hsv.v = 1 - Math.min(1, Math.max(0, (p.clientY - r.top) / Math.max(1, r.height)));
			paint();
		}
		var dragging = false;
		area.addEventListener('pointerdown', function (e) { dragging = true; area.setPointerCapture && area.setPointerCapture(e.pointerId); fromPoint(e); e.preventDefault(); });
		area.addEventListener('pointermove', function (e) { if (dragging) { fromPoint(e); } });
		area.addEventListener('pointerup', function () { if (dragging) { dragging = false; if (onDone) { onDone(cur); } } });
		area.addEventListener('pointercancel', function () { dragging = false; });
		area.addEventListener('keydown', function (e) {
			var step = e.shiftKey ? 0.1 : 0.02, k = e.key;
			if (k === 'ArrowLeft') { hsv.s = Math.max(0, hsv.s - step); }
			else if (k === 'ArrowRight') { hsv.s = Math.min(1, hsv.s + step); }
			else if (k === 'ArrowUp') { hsv.v = Math.min(1, hsv.v + step); }
			else if (k === 'ArrowDown') { hsv.v = Math.max(0, hsv.v - step); }
			else { return; }
			e.preventDefault(); paint(); if (onDone) { onDone(cur); }
		});
		hue.addEventListener('input', function (e) { hsv.h = Number(e.target.value) / 360; paint(); });
		hue.addEventListener('change', function () { if (onDone) { onDone(cur); } });
		hexIn.addEventListener('change', function (e) {
			var x = e.target.value.trim();
			if (x.charAt(0) !== '#') { x = '#' + x; }
			if (/^#[0-9a-fA-F]{6}$/.test(x)) { hsv = hexToHsv(x); hue.value = Math.round(hsv.h * 360); paint(); if (onDone) { onDone(cur); } }
			else { e.target.value = cur; toast(t('invalid_hex'), 'warn'); }
		});
		pop.appendChild(area);
		pop.appendChild(h('div', { class: 'agh-cp-row' }, prev, hue));
		pop.appendChild(h('div', { class: 'agh-cp-row' }, hexIn));
		function swatchRow(title, list) {
			if (!list || !list.length) { return; }
			var row = h('div', { class: 'agh-cp-sw' });
			list.forEach(function (col) {
				row.appendChild(h('button', { type: 'button', class: 'agh-swatch', style: { background: col }, title: col, 'aria-label': col, onclick: function () { hsv = hexToHsv(col); hue.value = Math.round(hsv.h * 360); paint(); if (onDone) { onDone(cur); } } }));
			});
			pop.appendChild(h('div', { class: 'agh-cp-grp' }, h('span', { class: 'agh-cp-ttl', text: title }), row));
		}
		swatchRow(t('color_used'), usedColors());
		(S.boot.schema.color_collections || []).slice(0, 4).forEach(function (c2) { swatchRow(c2.name, c2.colors); });
		paint(false);
		return pop;
	}
	// A colour button that opens the picker in a popover; `get`/`set` tie it to the value it edits.
	function colorButton(label, get, set, commit) {
		var btn = h('button', { type: 'button', class: 'agh-colorbtn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: label });
		var chip = h('span', { class: 'agh-colorbtn-chip' });
		var txt2 = h('span', { class: 'agh-colorbtn-hex' });
		btn.appendChild(chip); btn.appendChild(txt2);
		function sync() { var v2 = (get() || '#FFFFFF').toUpperCase(); chip.style.background = v2; txt2.textContent = v2; }
		sync();
		var open2 = null;
		function close2() {
			if (!open2) { return; }
			open2.remove(); open2 = null; btn.setAttribute('aria-expanded', 'false');
			document.removeEventListener('pointerdown', away, true);
			document.removeEventListener('keydown', esc, true);
		}
		function away(e) { if (open2 && !open2.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { close2(); } }
		function esc(e) { if (e.key === 'Escape') { close2(); btn.focus(); } }
		btn.addEventListener('click', function () {
			if (open2) { close2(); return; }
			open2 = colorPopover(get(), label, function (c3) { set(c3); sync(); }, function (c3) { set(c3); if (commit) { commit(c3); } sync(); });
			btn.parentNode.appendChild(open2);
			btn.setAttribute('aria-expanded', 'true');
			// keep it inside the panel on a narrow screen
			var r = open2.getBoundingClientRect();
			if (r.right > window.innerWidth - 8) { open2.style.left = 'auto'; open2.style.right = '0'; }
			setTimeout(function () { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc, true); }, 0);
			var fa = open2.querySelector('.agh-cp-area'); if (fa) { fa.focus(); }
		});
		btn.aghSync = sync;
		return btn;
	}

	function renderColor(f, v) {
		var box = h('div', { class: 'agh-color' });
		var picker = colorButton(f.label, function () { return S.config[f.id] || v || '#FFFFFF'; }, function (c2) { hex.value = c2; }, function (c2) { setValue(f.id, c2); });
		var hex = h('input', { class: 'agh-input', type: 'text', value: v || '', maxlength: 7, 'aria-label': f.label + ' HEX', id: 'agh-f-' + f.id });
		hex.addEventListener('change', function (e) {
			var x = e.target.value.trim();
			if (x.charAt(0) !== '#') { x = '#' + x; }
			if (/^#[0-9a-fA-F]{6}$/.test(x)) { e.target.value = x.toUpperCase(); setValue(f.id, x.toUpperCase()); if (picker.aghSync) { picker.aghSync(); } }
			else { e.target.value = S.config[f.id]; toast(t('invalid_hex'), 'warn'); }
		});
		box.appendChild(picker);
		box.appendChild(hex);
		box.appendChild(h('span', { class: 'agh-swatch', style: { background: v }, title: v }));
		if (f.collections || f.category === 'facade' || f.category === 'roof') {
			var sw = h('div', { class: 'agh-swatches' });
			(S.boot.schema.color_collections || []).forEach(function (c) {
				var g = h('div', { class: 'agh-swatch-group' }, h('span', { text: c.name }));
				c.colors.forEach(function (col) { g.appendChild(h('button', { type: 'button', class: 'agh-swatch', style: { background: col }, title: c.name + ' ' + col, 'aria-label': col, onclick: function () { hex.value = col; setValue(f.id, col, true); if (picker.aghSync) { picker.aghSync(); } } })); });
				sw.appendChild(g);
			});
			box.appendChild(sw);
		}
		return box;
	}

	function renderSelect(f, v) {
		var opts = f.options || [];
		if (f.filter_by) {
			var parent = S.config[f.filter_by];
			opts = opts.filter(function (o) { return !o.parent || o.parent === parent; });
		}
		if (opts.length <= 8) {
			var sel = h('select', { class: 'agh-select', id: 'agh-f-' + f.id, onchange: function (e) { setValue(f.id, e.target.value); onCatalogPick(f, e.target.value); } });
			if (!f.required) { sel.appendChild(h('option', { value: '', text: '—' })); }
			opts.forEach(function (o) { sel.appendChild(h('option', { value: o.value, selected: String(v) === o.value ? 'selected' : null, title: o.verified === false ? t('unverified_product') : null, text: o.label })); });
			return sel;
		}
		// Searchable combobox.
		var wrap = h('div', { class: 'agh-combo' });
		var cur = opts.filter(function (o) { return o.value === String(v); })[0];
		var input = h('input', { class: 'agh-input', id: 'agh-f-' + f.id, type: 'text', role: 'combobox', 'aria-expanded': 'false', autocomplete: 'off', placeholder: t('search_or_pick'), value: cur ? cur.label : '' });
		var list = h('div', { class: 'agh-combo-list', role: 'listbox', hidden: true });
		function fill(q) {
			clear(list);
			var ql = (q || '').toLowerCase();
			var shown = opts.filter(function (o) { return !ql || o.label.toLowerCase().indexOf(ql) !== -1; }).slice(0, 80);
			if (!f.required) { shown.unshift({ value: '', label: '—' }); }
			shown.forEach(function (o) {
				list.appendChild(h('button', { type: 'button', role: 'option', title: o.verified === false ? t('unverified_product') : null, 'aria-selected': o.value === String(S.config[f.id]) ? 'true' : 'false', onmousedown: function (e) { e.preventDefault(); input.value = o.value ? o.label : ''; list.hidden = true; input.setAttribute('aria-expanded', 'false'); setValue(f.id, o.value); onCatalogPick(f, o.value); } }, o.color ? h('span', { class: 'agh-swatch', style: { background: o.color } }) : null, o.label, o.verified === false ? unverifiedMark() : null));
			});
			if (!shown.length) { list.appendChild(h('div', { class: 'agh-muted agh-small', style: { padding: '8px' }, text: t('no_results') })); }
		}
		input.addEventListener('focus', function () { fill(''); list.hidden = false; input.setAttribute('aria-expanded', 'true'); input.select(); });
		input.addEventListener('input', function () { fill(input.value); list.hidden = false; });
		input.addEventListener('blur', function () { setTimeout(function () { list.hidden = true; input.setAttribute('aria-expanded', 'false'); var c2 = opts.filter(function (o) { return o.value === String(S.config[f.id]); })[0]; input.value = c2 ? c2.label : ''; }, 120); });
		wrap.appendChild(input);
		wrap.appendChild(list);
		return wrap;
	}

	function onCatalogPick(f, value) {
		if (f.id === 'roof_product' && value) {
			var o = (f.options || []).filter(function (x) { return x.value === value; })[0];
			// The product's colour is authoritative (see the field help "Termék választásakor a termék színe az irányadó").
			if (o && o.color) { S.config.roof_color = o.color; persist(); renderPreviewOnly(); }
		}
	}

	// Visual for an option card: a mini render of the visitor's own house with that option, a material
	// swatch, an interior palette, a landscape vignette or a kitchen plan – every option looks different.
	var visSeq = 0;
	function cardVisual(field, value) {
		var el = h('span', { class: 'agh-card-vis', 'aria-hidden': 'true', 'data-field': field, 'data-value': value });
		el._mk = function () { if (el._svg === undefined) { el._svg = cardSvg(field, value); } return el._svg; };
		var thumbs = thumbMode(field) && lsGet('agh_3d_thumbs', true) !== false;
		if (thumbs && A3wait) { el.classList.add('is-wait'); }
		else if (!(thumbs && A3)) { el.innerHTML = el._mk(); }
		cardThumb(el, field, value);
		return el;
	}
	function cardSvg(field, value) {
		var K = window.AGH_Sketch, svg = '', id = 'cv' + (++visSeq) + '_';
		if (K) {
			var cfg = {};
			Object.keys(S.config).forEach(function (k) { cfg[k] = S.config[k]; });
			if (['roof_type', 'levels', 'property_type', 'garage', 'massing', 'footprint', 'window_style'].indexOf(field) !== -1) {
				cfg[field] = value;
				cfg.time_of_day = 'midday'; cfg.weather = 'clear'; cfg.season = 'summer';
				if (field === 'footprint') { cfg.camera = 'elevated'; cfg.property_type = 'detached'; }
				if (field === 'window_style') { cfg.camera = 'frontal'; }
				if (field === 'roof_type' && value === 'flat') { cfg.roof_surface = cfg.roof_surface === 'green' ? 'green' : 'gravel'; }
				svg = K.render(cfg, { mini: true, id: id, fit: 'xMidYMid meet' });
			} else if (field === 'facade_main') { svg = K.swatch('facade', value, cfg); }
			else if (/^floor_(main|bedrooms|kitchen|entry|wet)$/.test(field)) { svg = K.swatch('floor', value === 'same' ? cfg.floor_main : value, cfg); }
			else if (field === 'interior_style') { svg = K.palette(value); }
			else if (field === 'garden_style') { svg = K.vignette('garden', value, { levels: cfg.levels, roof_type: cfg.roof_type, facade_main: cfg.facade_main, facade_color: cfg.facade_color, roof_color: cfg.roof_color, net_area: cfg.net_area, time_of_day: 'midday', weather: 'clear', season: 'summer' }); }
			else if (field === 'time_of_day') { svg = K.vignette('time', value, cfg); }
		}
		if (!svg && field === 'kitchen_layout') { svg = kitchenPlan(value); }
		if (!svg) { svg = monogram(field, value); }
		return svg;
	}
	// Rendered 3D picture for a card (when the 3D preview is available); cached per configuration.
	var THUMBS = {};
	var THUMB_FIELDS = { roof_type: 'mini', levels: 'mini', property_type: 'mini', garage: 'mini', massing: 'mini', footprint: 'mini', window_style: 'mini', facade_main: 'facade', floor_main: 'floor', floor_bedrooms: 'floor', floor_kitchen: 'floor', floor_entry: 'floor', floor_wet: 'floor', garden_style: 'full', time_of_day: 'full', landscape: 'full' };
	// Settings a single-item picture depends on (the rest of the configuration does not change it).
	var ITEM_KEYS = ['interior_style', 'furniture_style', 'furniture_color', 'wall_color', 'floor_main', 'floor_color', 'floor_bedrooms', 'floor_kitchen', 'floor_wet', 'grout_color', 'bath_tiles', 'taps', 'bath_color', 'bath_fixtures', 'fronts', 'fronts_color', 'handles', 'worktop', 'worktop_color', 'sink', 'backsplash', 'appliances', 'vanity_type', 'basin_type', 'toilet_type', 'ceiling', 'ceiling_lights', 'window_frame_color', 'window_frame_material', 'glazing', 'skirting', 'wall_finish', 'curtains', 'car_color', 'curtain_fabric', 'curtain_tone', 'rug_tone', 'window_treatment'];
	function thumbMode(field) { return THUMB_FIELDS[field] || ((S.fields[field] || {}).visual === 'item' ? 'item' : null); }
	function cardThumb(el, field, value) {
		var mode = thumbMode(field);
		if (!A3 || !mode || lsGet('agh_3d_thumbs', true) === false) { return; }
		var cfg = clone(S.config);
		cfg[field] = value;
		if (mode === 'item') { cfg = {}; ITEM_KEYS.forEach(function (k) { if (S.config[k] !== undefined) { cfg[k] = S.config[k]; } }); cfg._item = { field: field, value: value }; if (field === 'art_style' && S.config.art_photo) { cfg.art_photo = S.config.art_photo; } }
		// per-room floors show their material in the same room scene ("same" = the main floor)
		if (mode === 'floor' && field !== 'floor_main') { cfg.floor_main = value === 'same' ? S.config.floor_main : value; }
		if (mode === 'mini') { cfg.time_of_day = 'midday'; cfg.weather = 'clear'; cfg.season = 'summer'; if (field === 'footprint') { cfg.camera = 'elevated'; cfg.property_type = 'detached'; } if (field === 'window_style') { cfg.camera = 'frontal'; } }
		if (mode === 'facade') { cfg.time_of_day = 'golden'; cfg.weather = 'clear'; cfg.camera = 'three_quarter'; }
		if (mode === 'floor') { cfg.time_of_day = 'midday'; cfg.camera = 'elevated'; }
		if (field === 'garden_style') { cfg.garden_features = ['lawn', 'trees', 'paths', 'hedge', 'flowerbeds']; cfg.time_of_day = 'midday'; cfg.weather = 'clear'; cfg.season = 'summer'; cfg.camera = 'elevated'; }
		if (field === 'landscape') { cfg.time_of_day = 'midday'; cfg.weather = 'clear'; }
		var key = mode + '|' + JSON.stringify(cfg, function (k, x) { return k === 'art_photo' && x ? 'img' + x.length + ':' + x.slice(-40) : x; });
		el._key = key;
		var put = function (url) {
			if (el._key !== key) { return; }
			el.classList.remove('is-wait');
			if (url) { el.innerHTML = ''; el.appendChild(h('img', { src: url, alt: '', decoding: 'async' })); }
			else if (!el.firstChild) { el.innerHTML = el._mk ? el._mk() : ''; }
		};
		if (THUMBS[key]) { put(THUMBS[key]); return; }
		// Placeholder until the rendered picture is ready (no 2D flash before it).
		if (!el.querySelector('img')) { el.innerHTML = ''; el.classList.add('is-wait'); }
		var alive = function () { return el._key === key && document.body.contains(el); };
		whenVisible(el, function () {
			if (!alive()) { return; }
			A3.thumb(cfg, 300, 200, mode === 'full' ? 'full' : (mode === 'item' ? 'mini' : mode), alive).then(function (url) { if (url) { THUMBS[key] = url; } if (alive()) { put(url); } });
		});
	}
	// Runs fn once the element is (nearly) on screen – pictures of cards nobody looks at are never made.
	var visIO = null;
	function whenVisible(el, fn) {
		if (!window.IntersectionObserver) { fn(); return; }
		if (!visIO) {
			visIO = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { visIO.unobserve(e.target); var f = e.target._onVis; e.target._onVis = null; if (f) { f(); } } });
			}, { rootMargin: '150px' });
		}
		el._onVis = fn;
		visIO.observe(el);
	}
	function refreshCardThumbs() {
		Array.prototype.forEach.call(document.querySelectorAll('.agh-card-vis[data-field]'), function (el) { cardThumb(el, el.getAttribute('data-field'), el.getAttribute('data-value')); });
	}
	function kitchenPlan(v) {
		var wood = '#C9A27A', top = '#F1EEE8', fl = '#E7E1D8', wall = '#4A4D50';
		var runs = {
			straight: [[14, 14, 92, 14]], l: [[14, 14, 92, 14], [14, 28, 14, 46]], u: [[14, 14, 92, 14], [14, 28, 14, 46], [92, 28, 14, 46]],
			island: [[14, 14, 92, 14], [34, 44, 52, 16]], galley: [[14, 14, 92, 14], [14, 52, 92, 14]]
		}[v] || [[14, 14, 92, 14]];
		var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice"><rect width="120" height="80" fill="' + fl + '"/>';
		for (var x = 0; x < 120; x += 12) { s += '<path d="M' + x + ' 0V80" stroke="#D9D2C6" stroke-width=".6"/>'; }
		s += '<rect x="6" y="6" width="108" height="68" fill="none" stroke="' + wall + '" stroke-width="4"/>';
		runs.forEach(function (r) { s += '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="2" fill="' + wood + '"/><rect x="' + (r[0] + 2) + '" y="' + (r[1] + 2) + '" width="' + (r[2] - 4) + '" height="' + (r[3] - 4) + '" rx="1.5" fill="' + top + '"/>'; });
		s += '<circle cx="34" cy="21" r="3.2" fill="none" stroke="#7C8186" stroke-width="1.2"/><circle cx="42" cy="21" r="3.2" fill="none" stroke="#7C8186" stroke-width="1.2"/><rect x="62" y="17" width="12" height="8" rx="2" fill="#B9C3CA"/>';
		if (v === 'island') { [40, 56, 72].forEach(function (cx) { s += '<circle cx="' + cx + '" cy="66" r="3.4" fill="#5A4636"/>'; }); }
		return s + '</svg>';
	}
	// Fallback for admin-defined card options: a coloured tile with the option's initial.
	function monogram(field, value) {
		var hsh = 0, k = field + ':' + value;
		for (var i = 0; i < k.length; i++) { hsh = (hsh * 31 + k.charCodeAt(i)) >>> 0; }
		var hue = hsh % 360, ch = String(value || '?').charAt(0).toUpperCase().replace(/[^A-Z0-9]/, '•');
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="mg' + hsh + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',45%,62%)"/><stop offset="1" stop-color="hsl(' + ((hue + 40) % 360) + ',45%,42%)"/></linearGradient></defs><rect width="120" height="80" fill="url(#mg' + hsh + ')"/><text x="60" y="52" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#fff" fill-opacity=".9">' + ch + '</text></svg>';
	}

	/* ------------------------------------------------------------------ rooms editor */
	function roomType(v) { return S.boot.schema.room_types.filter(function (r) { return r.value === v; })[0] || { label: v, area: 10 }; }
	function levelCount() { return { single: 1, attic: 2, two: 2, three: 3 }[S.config.levels] || 1; }
	function levelName(i) { return i < 0 ? t('level_basement') : (i === 0 ? t('level_ground') : (S.config.levels === 'attic' && i === 1 ? t('level_attic') : tf('level_n', i))); }

	function renderRooms() {
		var box = h('div', { style: { display: 'flex', 'flex-direction': 'column', gap: '8px' } });
		var rooms = S.config.rooms || [];
		var sum = rooms.reduce(function (a, r) { return a + Number(r.area || 0); }, 0);
		var net = Number(S.config.net_area || 0);
		var diff = net ? Math.round((sum - net) / net * 100) : 0;
		box.appendChild(h('div', { class: 'agh-rooms-head' },
			h('span', { class: 'agh-rooms-sum' + (Math.abs(diff) > 10 ? ' agh-badge-warn' : ''), text: tf('rooms_sum', fmt(sum), fmt(net), (diff > 0 ? '+' : '') + diff + '%') }),
			h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: autoRooms }, icon('refresh', 'agh-ico-s'), t('rooms_auto')),
			h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { addRoom('bedroom'); } }, icon('plus', 'agh-ico-s'), t('rooms_add'))
		));
		rooms.forEach(function (r, idx) { box.appendChild(renderRoom(r, idx)); });
		return box;
	}
	function updateRoom(idx, key, val, rerender) {
		var rooms = (S.config.rooms || []).slice();
		rooms[idx] = Object.assign({}, rooms[idx]);
		S.roomId = String(rooms[idx].id || rooms[idx].type);
		if (val === '' || val === null) { delete rooms[idx][key]; } else { rooms[idx][key] = val; }
		setValue('rooms', rooms, rerender);
	}
	function renderRoom(r, idx) {
		var types = S.boot.schema.room_types;
		var card = h('div', { class: 'agh-room' });
		var name = h('input', { class: 'agh-input agh-room-name', value: r.name, maxlength: 60, 'aria-label': t('room_name'), onchange: function (e) { updateRoom(idx, 'name', e.target.value); } });
		var area = h('input', { class: 'agh-input', type: 'number', min: 1, max: 250, step: 0.5, value: r.area, 'aria-label': t('room_area'), onchange: function (e) { updateRoom(idx, 'area', Math.max(1, Number(e.target.value) || 1), true); } });
		card.appendChild(h('div', { class: 'agh-room-row' }, name, h('div', { class: 'agh-numrow' }, area, h('span', { class: 'agh-unit', text: 'm²' })),
			h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('delete'), title: t('delete'), style: { width: '30px', height: '30px' }, onclick: function () { var rooms = S.config.rooms.slice(); rooms.splice(idx, 1); setValue('rooms', rooms, true); } }, icon('trash', 'agh-ico-s'))));
		var typeSel = h('select', { class: 'agh-select', 'aria-label': t('room_type'), onchange: function (e) { updateRoom(idx, 'type', e.target.value, true); } });
		types.forEach(function (rt) { typeSel.appendChild(h('option', { value: rt.value, selected: rt.value === r.type ? 'selected' : null, text: rt.label })); });
		var lvl = h('select', { class: 'agh-select', 'aria-label': t('room_level'), onchange: function (e) { updateRoom(idx, 'level', Number(e.target.value)); } });
		for (var i = S.config.basement ? -1 : 0; i < levelCount(); i++) { lvl.appendChild(h('option', { value: i, selected: Number(r.level) === i ? 'selected' : null, text: levelName(i) })); }
		var render = h('label', { class: 'agh-switch', title: t('room_render_help') }, h('input', { type: 'checkbox', checked: r.render ? 'checked' : null, onchange: function (e) { updateRoom(idx, 'render', e.target.checked); } }), h('span', { class: 'agh-switch-track' }), h('span', { class: 'agh-small', text: t('room_render') }));
		var see = A3 ? h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-room-see', title: t('view_room'), 'aria-label': t('view_room') + ': ' + r.name, onclick: function () { setView('int', String(r.id || r.type)); } }, icon('eye', 'agh-ico-s')) : null;
		var more = h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', 'aria-expanded': S.openRooms[r.id] ? 'true' : 'false', onclick: function () { S.openRooms[r.id] = !S.openRooms[r.id]; renderFields(); } }, t('room_details'));
		card.appendChild(h('div', { class: 'agh-room-meta' }, typeSel, lvl, render, see, more));
		if (S.openRooms[r.id]) {
			var d = h('div', { class: 'agh-room-details' });
			function txt(key, label, full) {
				var inp = h('input', { class: 'agh-input', value: r[key] || '', maxlength: key === 'notes' ? 400 : 120, onchange: function (e) { updateRoom(idx, key, e.target.value); } });
				d.appendChild(h('label', { class: full ? 'agh-full' : null }, label, inp));
			}
			// A részlet, aminek a házban is van beállítása: legördülő a ház mezőjének opcióiból, így a
			// választás a 3D belső nézetben is látszik – nem lehet beleírni olyat, amit a program nem ért.
			function pickOpt(key, label, fieldId, extra) {
				var f2 = S.fields[fieldId];
				if (!f2 || !f2.options) { txt(key, label); return; }
				var sel2 = h('select', { class: 'agh-select', onchange: function (e) { updateRoom(idx, key, e.target.value); } });
				sel2.appendChild(h('option', { value: '', text: t('room_same_as_house') }));
				(extra || []).forEach(function (o) { sel2.appendChild(h('option', { value: o[0], selected: r[key] === o[0] ? 'selected' : null, text: o[1] })); });
				f2.options.forEach(function (o) {
					if (o.value === 'auto') { return; }
					sel2.appendChild(h('option', { value: o.value, selected: r[key] === o.value ? 'selected' : null, text: o.label }));
				});
				// korábbi szabad szöveg: megmarad választható értékként, hogy ne vesszen el
				if (r[key] && !f2.options.some(function (o) { return o.value === r[key]; }) && !(extra || []).some(function (o) { return o[0] === r[key]; })) {
					sel2.appendChild(h('option', { value: r[key], selected: 'selected', text: r[key] }));
				}
				d.appendChild(h('label', null, label, sel2));
			}
			function num(key, label, min, max, step) {
				d.appendChild(h('label', null, label, h('input', { class: 'agh-input', type: 'number', min: min, max: max, step: step, value: r[key] || '', onchange: function (e) { updateRoom(idx, key, e.target.value === '' ? '' : Number(e.target.value)); } })));
			}
			function col(key, label) {
				var hold = { v: r[key] || '#F4F1EC' };
				var btn2 = colorButton(label, function () { return hold.v; }, function (c2) { hold.v = c2; }, function (c2) { hold.v = c2; updateRoom(idx, key, c2.toUpperCase()); });
				d.appendChild(h('label', { class: 'agh-cp-field' }, label, btn2));
			}
			num('width', t('room_width'), 0.8, 30, 0.1);
			num('length', t('room_length'), 0.8, 30, 0.1);
			num('ceiling_height', t('room_ceiling_h'), 2.2, 8, 0.05);
			var st = h('select', { class: 'agh-select', onchange: function (e) { updateRoom(idx, 'interior_style', e.target.value); } }, h('option', { value: '', text: t('room_style_inherit') }));
			S.boot.schema.interior_styles.forEach(function (s) { st.appendChild(h('option', { value: s.value, selected: r.interior_style === s.value ? 'selected' : null, text: s.label })); });
			d.appendChild(h('label', null, t('room_style'), st));
			pickOpt('floor', t('room_floor'), 'floor_main');
			pickOpt('wall', t('room_wall'), /^(bathroom|wc|wellness|sauna)$/.test(r.type) ? 'bath_tiles' : 'wall_finish');
			col('wall_color', t('room_wall_color'));
			pickOpt('ceiling', t('room_ceiling'), 'ceiling');
			pickOpt('lighting', t('room_lighting'), 'ceiling_lights');
			pickOpt('furniture', t('room_furniture'), 'furniture_style');
			col('furniture_color', t('room_furniture_color'));
			pickOpt('decor', t('room_decor'), 'art_amount');
			pickOpt('curtains', t('room_curtains'), 'window_treatment');
			pickOpt('doors', t('room_doors'), 'door_style');
			pickOpt('windows', t('room_windows'), 'window_style');
			txt('electrical', t('room_electrical'));
			pickOpt('heating', t('room_heating'), 'radiators');
			txt('notes', t('room_notes'), true);
			card.appendChild(d);
		}
		return card;
	}
	/* ------------------------------------------------------------------ outbuildings editor (1.23.0) */
	var OB_LIST = ['shed', 'cabin', 'workshop', 'summer_kitchen', 'garage', 'barn', 'greenhouse'];
	var OB_DEFS = { shed: [3, 2.5, 2.3, []], cabin: [4, 3.5, 2.5, ['table']], workshop: [5, 4, 2.8, ['workbench', 'tool_wall', 'shelves']], summer_kitchen: [4, 3.5, 2.6, ['kitchen', 'table']], garage: [3.4, 6, 2.6, ['car', 'shelves']], barn: [6, 5, 3.2, ['machines', 'firewood']], greenhouse: [3, 2.5, 2.2, ['plants']] };
	function renderOutbuildings(f) {
		var list = Array.isArray(S.config.outbuildings) ? S.config.outbuildings : [], box = h('div', { class: 'agh-obs' });
		// the list is drawn again after the change: later, so the field that fired the change (often on blur) is not
		// removed while its event is still running
		var set = function (nl) { setTimeout(function () { setValue('outbuildings', nl, true); }, 0); };
		box.appendChild(h('div', { class: 'agh-obs-add' }, OB_LIST.map(function (ty) {
			return h('button', { type: 'button', class: 'agh-pill agh-ob-addbtn', 'data-type': ty, disabled: list.length >= 6 ? 'disabled' : null, onclick: function () { var d = OB_DEFS[ty]; set(list.concat([{ type: ty, w: d[0], d: d[1], h: d[2], roof: 'gable', roof_mat: 'metal', wall: ty === 'greenhouse' ? 'glass' : 'wood', door: ty === 'garage' ? 'garage' : 'single', windows: 1, items: d[3].slice() }])); } }, icon('plus', 'agh-ico-s'), t('ob_' + ty));
		})));
		list.forEach(function (o, i) {
			var upd = function (k, v) { var nl = list.map(function (q) { return Object.assign({}, q); }); nl[i][k] = v; set(nl); };
			var sel = function (k, opts) { var s2 = h('select', { class: 'agh-select', 'data-k': k, onchange: function (e) { upd(k, e.target.value); } }); opts.forEach(function (op) { s2.appendChild(h('option', { value: op, selected: o[k] === op ? 'selected' : null, text: t('ob_' + k + '_' + op) })); }); return h('label', null, t('ob_' + k), s2); };
			var numIn2 = function (k, min, max, step) { return h('label', null, t('ob_' + k), h('input', { class: 'agh-input', type: 'number', 'data-k': k, min: min, max: max, step: step, value: o[k], onchange: function (e) { var v = Number(e.target.value); if (isFinite(v)) { upd(k, Math.min(max, Math.max(min, v))); } } })); };
			var items = h('div', { class: 'agh-ob-items' }, ['shelves', 'workbench', 'tool_wall', 'machines', 'car', 'bike', 'firewood', 'table', 'kitchen', 'plants'].map(function (it) {
				var on = (o.items || []).indexOf(it) !== -1;
				return h('button', { type: 'button', class: 'agh-pill agh-ob-item' + (on ? ' is-on' : ''), 'data-item': it, 'aria-pressed': on ? 'true' : 'false', onclick: function () { var cur = (o.items || []).slice(), k2 = cur.indexOf(it); if (k2 === -1) { cur.push(it); } else { cur.splice(k2, 1); } upd('items', cur); } }, t('ob_item_' + it));
			}));
			box.appendChild(h('div', { class: 'agh-room agh-ob', 'data-i': String(i) },
				h('div', { class: 'agh-room-row' }, h('b', { text: (i + 1) + '. ' + t('ob_' + o.type) + ' · ' + fmt(Number(o.w) * Number(o.d), 1) + ' m²' }),
					h('button', { type: 'button', class: 'agh-iconbtn agh-ob-del', 'aria-label': t('delete'), title: t('delete'), onclick: function () { var nl = list.slice(); nl.splice(i, 1); set(nl); } }, icon('trash', 'agh-ico-s'))),
				h('div', { class: 'agh-room-details agh-ob-grid' }, sel('type', OB_LIST), numIn2('w', 1.5, 12, 0.1), numIn2('d', 1.5, 12, 0.1), numIn2('h', 2, 4, 0.05), sel('roof', ['gable', 'shed', 'flat', 'green']), sel('roof_mat', ['tile', 'metal', 'shingle', 'bitumen']), sel('wall', ['wood', 'render', 'brick', 'metal', 'stone', 'glass']), sel('door', ['single', 'double', 'sliding', 'garage']), numIn2('windows', 0, 4, 1)),
				items));
		});
		return box;
	}
	function addRoom(type) {
		var rt = roomType(type);
		var rooms = (S.config.rooms || []).slice();
		rooms.push({ id: 'r' + Date.now().toString(36), type: type, name: rt.label, area: rt.area, level: 0, render: !!rt.render });
		setValue('rooms', rooms, true);
	}
	function autoRooms() {
		api('POST', 'rooms/auto', { config: payloadConfig() }).then(function (r) { S.config.rooms = r.rooms; S.dirty = true; persist(); validate(); renderFields(); renderSummary(); toast(t('rooms_auto_done'), 'ok'); }).catch(errToast);
	}

	/* ------------------------------------------------------------------ AI interpret */
	function renderInterpret() {
		var box = h('div', { class: 'agh-field' });
		if (!S.boot.features.interpret) {
			box.appendChild(h('p', { class: 'agh-help', text: t('interpret_off') }));
			return box;
		}
		var btn = h('button', { type: 'button', class: 'agh-btn agh-btn-accent', onclick: function () {
			if (!(S.config.custom_text || '').trim()) { toast(t('interpret_empty'), 'warn'); return; }
			btn.disabled = true; btn.insertBefore(h('span', { class: 'agh-spinner' }), btn.firstChild);
			api('POST', 'interpret', { config: payloadConfig() }).then(function (res) { showSuggestions(res); }).catch(errToast).then(function () { btn.disabled = false; var sp = btn.querySelector('.agh-spinner'); if (sp) { sp.remove(); } });
		} }, icon('ai', 'agh-ico-s'), t('interpret'));
		box.appendChild(btn);
		box.appendChild(h('p', { class: 'agh-help', text: t('interpret_help') }));
		return box;
	}
	function showSuggestions(res) {
		var body = h('div', null);
		var chosen = {};
		if (!res.suggestions.length) { body.appendChild(h('p', { text: t('interpret_none') })); }
		res.suggestions.forEach(function (s) {
			chosen[s.field] = true;
			var f = S.fields[s.field] || { label: s.label };
			var val = Array.isArray(s.value) ? s.value.map(function (x) { return optLabel(f, x); }).join(', ') : (typeof s.value === 'boolean' ? (s.value ? t('yes') : t('no')) : optLabel(f, s.value));
			body.appendChild(h('label', { class: 'agh-check' }, h('input', { type: 'checkbox', checked: 'checked', onchange: function (e) { chosen[s.field] = e.target.checked; } }), h('span', null, h('b', { text: s.label + ': ' }), val, s.reason ? h('div', { class: 'agh-small agh-muted', text: s.reason }) : null)));
		});
		(res.conflicts || []).forEach(function (c) { body.appendChild(h('div', { class: 'agh-field-msg is-warning', text: c })); });
		dialog(t('interpret_title'), body, [
			{ label: t('cancel') },
			{ label: t('apply_selected'), cls: 'agh-btn-primary', onclick: function () {
				var vals = {};
				res.suggestions.forEach(function (s) { if (chosen[s.field]) { vals[s.field] = s.value; } });
				applyValues(vals, true);
			} }
		]);
	}
	function optLabel(f, v) { var o = (f.options || []).filter(function (x) { return x.value === String(v); })[0]; return o ? o.label : String(v) + (f.unit ? ' ' + f.unit : ''); }
	function applyValues(vals, markExplicit) {
		Object.keys(vals).forEach(function (k) { if (k in S.config || S.fields[k]) { S.config[k] = vals[k]; if (markExplicit) { S.explicit[k] = true; } } });
		// A preset carries its own look; it is not a style suggestion to take back on the next style change.
		if (vals.arch_style) { S.styleApplied = null; }
		S.dirty = true; persist(); validate(); renderFields(); renderPreviewOnly(); renderSummary();
		toast(t('applied'), 'ok');
	}

	/* ------------------------------------------------------------------ validation */
	function payloadConfig() {
		var c = clone(S.config);
		if (S.autoRoof && c.roof_product === S.autoRoof) { c.roof_product = ''; }
		c._explicit = Object.keys(S.explicit);
		return c;
	}
	var validate = debounce(function () {
		api('POST', 'validate', { config: payloadConfig() }).then(function (r) {
			S.check = r.check;
			// Keep server-sanitized rooms ids, but do not overwrite what the user is typing.
			if (r.config && r.config.rooms && (!S.config.rooms || !S.config.rooms.length)) { S.config.rooms = r.config.rooms; }
			adoptAutoRoof(r.config);
			updateRail();
			renderSummary();
			refreshFieldMessages();
			renderActionbar();
			updateWizardSide();
		}).catch(function () {});
	}, 450);
	/**
	 * The server picks a roof product (mandatory brand) when the visitor has
	 * none: show it in the state/summary, never replacing a visitor's own pick.
	 */
	function adoptAutoRoof(cfg) {
		if (!cfg || typeof cfg.roof_product !== 'string') { return; }
		var cur = String(S.config.roof_product || '');
		if ((cur !== '' && cur !== S.autoRoof) || cfg.roof_product === cur) { return; }
		S.config.roof_product = cfg.roof_product;
		S.autoRoof = cfg.roof_product;
		if (cfg.roof_brand && cfg.roof_brand !== S.config.roof_brand) { S.config.roof_brand = cfg.roof_brand; }
		persist();
		var el = els.fieldsList && els.fieldsList.querySelector('#agh-f-roof_product');
		if (el && el !== document.activeElement) {
			if (el.tagName === 'SELECT') { el.value = cfg.roof_product; }
			else { var o = optByValue(S.fields.roof_product, cfg.roof_product); el.value = o ? o.label : ''; }
		}
	}
	function optByValue(f, v) { return ((f && f.options) || []).filter(function (o) { return o.value === String(v); })[0]; }
	// Subtle marker for catalogue items whose data awaits manufacturer verification (verified === false).
	function unverifiedMark() {
		return h('span', { class: 'agh-unv', title: t('unverified_product') }, h('span', { class: 'agh-sr', text: ' (' + t('unverified_product') + ')' }));
	}
	function refreshFieldMessages() {
		var scope = S.wiz ? els.wizBody : els.fieldsList;
		if (!scope) { return; }
		Array.prototype.forEach.call(scope.querySelectorAll('.agh-field[data-field]'), function (w) {
			Array.prototype.forEach.call(w.querySelectorAll(':scope > .agh-field-msg'), function (m) { m.remove(); });
			fieldMessages(w.getAttribute('data-field')).forEach(function (m) { w.appendChild(h('div', { class: 'agh-field-msg is-' + m.type, text: m.text })); });
		});
	}
	function focusField(id) {
		if (S.wiz) { wizardFocusField(id); return; }
		var f = S.fields[id];
		if (!f) { return; }
		S.search = '';
		S.cat = f.category;
		if (f.advanced && S.mode === 'simple') { setMode('detailed'); }
		renderFields();
		setTab('params');
		setTimeout(function () { var el = els.fieldsList.querySelector('[data-field="' + id + '"]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); var i = el.querySelector('input,select,textarea,button'); if (i) { i.focus({ preventScroll: true }); } } }, 60);
	}

	/* ------------------------------------------------------------------ stage */
	function renderStage() {
		if (FS.el && FS.el !== root && els.stagePanel.contains(FS.el)) { fsExit(); fsDone(); }
		var st = clear(els.stagePanel);
		var tabs = h('div', { class: 'agh-stage-tabs' });
		var seg = h('div', { class: 'agh-seg', role: 'tablist' });
		var views = [['design', t('view_design')]];
		if (S.project) { views.push(['concepts', t('view_concepts')]); }
		if (S.project && concepts().length) { views.push(['compare', t('view_compare')]); }
		if (S.project && S.selected) { views.push(['gallery', t('view_gallery')]); }
		views.forEach(function (v) { seg.appendChild(h('button', { type: 'button', role: 'tab', 'aria-pressed': S.view === v[0] ? 'true' : 'false', onclick: function () { S.view = v[0]; renderStage(); }, text: v[1] })); });
		tabs.appendChild(seg);
		tabs.appendChild(h('div', { style: { flex: '1' } }));
		if (S.boot.provider.test) { tabs.appendChild(h('span', { class: 'agh-badge agh-badge-test', title: t('test_mode_help'), text: t('test_mode') })); }
		if (S.project) { tabs.appendChild(h('span', { class: 'agh-badge', text: '#' + S.project.id.slice(0, 8) })); }
		st.appendChild(tabs);
		var body = h('div', { class: 'agh-stage-body' });
		st.appendChild(body);
		els.stageBody = body;
		if (S.view === 'concepts' && S.project) { renderConcepts(body); }
		else if (S.view === 'compare' && S.project) { renderCompare(body); }
		else if (S.view === 'gallery' && S.project && S.selected) { renderGallery(body); }
		else { S.view = 'design'; renderDesign(body); }
	}

	function renderDesign(body) {
		var box = h('div', { class: 'agh-hero-empty' });
		els.previewBox = h('div', { class: 'agh-preview-box' });
		box.appendChild(els.previewBox);
		box.appendChild(els.kpis = h('div', { class: 'agh-kpis' }));
		body.appendChild(box);
		renderPreviewOnly();
	}

	function renderPreviewOnly() {
		// In the wizard the designer's (hidden) preview must not take the single live 3D canvas away.
		if (S.wiz || S.bld || !els.previewBox || !document.body.contains(els.previewBox)) { return; }
		var c = S.config;
		fillKpis(els.kpis, c);
		fillPreview(els.previewBox, c);
	}
	// Photo of the chosen architectural style (bundled sample image), if there is one.
	function stylePhoto(c) {
		var o = S.fields.arch_style ? optByValue(S.fields.arch_style, c.arch_style) : null;
		return o && o.image ? o : null;
	}
	// The preview: the live, parameter-driven 3D sketch fills the box; the photorealistic sample of the
	// chosen style (if any) is a small inset. Every change of a visible parameter redraws the sketch;
	// a short note names the change and says when it only shows up in the concept images.
	function fillPreview(box, c) {
		if (S.bld) { return box; } // the build editor owns the single live 3D canvas
		var o = S.view === 'int' && A3 ? null : stylePhoto(c), fresh = S.lastChange && Date.now() - S.lastChange.at < 1500;
		var oldFig = box.querySelector('.agh-preview-style');
		var keep = o && oldFig && oldFig.getAttribute('data-src') === (o.thumb || o.image) ? oldFig : null;
		if (keep) { keep.parentNode.removeChild(keep); }
		var svg = A3 || A3wait ? '' : previewSvg(c);
		box._aghSk = svg ? svg.replace(/agh\d+_/g, '') : null;
		box.classList.remove('has-photo');
		box.classList.add('has-sketch');
		if (A3) {
			// keep the live 3D canvas, replace everything else
			Array.prototype.slice.call(box.children).forEach(function (ch) { if (!ch.classList.contains('agh-3d')) { box.removeChild(ch); } });
			try { A3.attach(box, viewCfg(c)); box.classList.add('has-3d'); box._aghSk = A3.viewer().signature(); var vw = A3.viewer(); vw.onPick = jumpToField; vw.onLayout = saveLayout; vw.onGrab = grabNote; vw.onSite = saveSite; vw.onMoveState = moveState; vw.place = S.boot.place || null; vw.onPaint = paintAt; vw.paint = S.view !== 'int' && !!S.paint; fixNote(); } catch (e) { A3 = null; box.classList.remove('has-3d'); clear(box); svg = previewSvg(c); box._aghSk = svg.replace(/agh\d+_/g, ''); box.innerHTML = svg; }
			if (A3 && S.view === 'int') { box.appendChild(roomChips()); box.appendChild(layoutTools()); }
			else if (A3) { box.appendChild(siteTools()); if ((S.config.facade_accent || []).length || S.paint) { box.appendChild(paintTools()); } }
			if (A3) { box.appendChild(h('div', { class: 'agh-3d-tools' }, viewSwitch(), S.view === 'int' ? h('span', { class: 'agh-3d-hint', text: t('sketch_orbit_hint') }) : h('span', { class: 'agh-3d-hint', title: t('site_hint'), text: t('site_hint_short') }), h('button', { type: 'button', class: 'agh-3d-reset', title: t('sketch_reset_view'), 'aria-label': t('sketch_reset_view'), onclick: function () { var v = A3.viewer(); if (v) { v.fitCamera(true); v.requestRender(); } } }, icon('home')), photoSlot())); }
		} else if (A3wait) {
			clear(box);
			box.appendChild(waitBox());
		} else {
			clear(box);
			box.innerHTML = svg;
		}
		box.appendChild(previewCaption(c));
		if (!box.querySelector(':scope > .agh-fsbtn-pv')) { box.appendChild(fsButton(function () { return box; }, 'agh-fsbtn-pv')); }
		if (o) {
			box.appendChild(keep || h('figure', { class: 'agh-preview-style', 'data-src': o.thumb || o.image, title: t('style_sample_note') },
				h('img', { src: o.thumb || o.image, alt: '', decoding: 'async' }),
				h('figcaption', { text: t('style_sample') })));
		}
		var ch = S.lastChange;
		if (ch && fresh && S.fields[ch.id]) {
			var f = S.fields[ch.id], vis = ch.before ? ch.before !== box._aghSk : isVisual(ch.id);
			var val = changeValueText(f);
			box.appendChild(h('div', { class: 'agh-preview-chg' + (vis ? '' : ' is-hidden-param'), role: 'status' },
				h('b', { text: f.label + (val ? ': ' + val : '') }),
				vis ? null : h('span', { text: t('sketch_not_visual') })));
		}
		return box;
	}
	// Mit írjon ki a módosítás jelzése: a nem skalár értékek (pl. a helyiségprogram tömbje) sosem
	// „[object Object]”-ként, hanem emberi szövegként.
	function changeValueText(f) {
		var v = S.config[f.id];
		if (f.type === 'toggle') { return v ? t('yes') : t('no'); }
		if (f.type === 'color' || f.type === 'image') { return ''; }
		if (f.type === 'rooms' || (Array.isArray(v) && v.length && typeof v[0] === 'object')) {
			var list = Array.isArray(v) ? v : [];
			var names = list.map(function (r) { return r && r.name ? String(r.name) : ''; }).filter(Boolean);
			return list.length + (names.length ? ' – ' + names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') : '');
		}
		if (Array.isArray(v)) { return v.map(function (x) { return f.options ? optLabel(f, x) : String(x); }).filter(Boolean).join(', '); }
		if (v && typeof v === 'object') { return ''; }
		if (f.options) { return optLabel(f, v); }
		return String(v == null ? '' : v) + (f.unit ? ' ' + f.unit : '');
	}
	function isVisual(id) {
		var K = window.AGH_Sketch;
		return !!(K && K.visual.indexOf(id) !== -1);
	}
	function fillKpis(box, c) {
		clear(box);
		[['area', fmt(c.net_area, 0) + ' m²', t('kpi_area')], ['bed', c.bedrooms, t('kpi_bedrooms')], ['bath', c.bathrooms, t('kpi_bathrooms')], ['roof', optLabel(S.fields.roof_type || {}, c.roof_type), t('kpi_roof')]].forEach(function (k) {
			box.appendChild(h('div', { class: 'agh-kpi' }, icon(k[0]), h('div', null, h('b', { text: String(k[1]) }), h('span', { text: k[2] }))));
		});
		return box;
	}
	/* Interior view: the preview shows one room of the house (cut-away), chosen by the visitor or by the
	 * setting being changed (kitchen settings → kitchen, bathroom → bathroom, bedroom floor → bedroom …). */
	var INT_CATS = ['interior', 'architecture', 'furniture', 'lighting', 'kitchen', 'bathroom', 'surfaces', 'rooms'], EXT_CATS = ['style', 'massing', 'roof', 'facade', 'openings', 'garden', 'energy'];
	var ROOM_ORDER = ['living_kitchen', 'living', 'kitchen', 'dining', 'master', 'bedroom', 'kids', 'guest', 'bathroom', 'office', 'hall', 'wc', 'laundry', 'wardrobe'];
	function roomList() {
		var out = [], seen = {};
		(S.config.rooms || []).forEach(function (r) { if (r && r.type && !seen[r.id || r.type]) { seen[r.id || r.type] = 1; out.push({ id: String(r.id || r.type), type: r.type, name: r.name || (roomType(r.type).label || r.type), area: Number(r.area) || 0 }); } });
		if (!out.length) { ['living_kitchen', 'master', 'bathroom'].forEach(function (tp) { out.push({ id: 'virtual:' + tp, type: tp, name: roomType(tp).label, area: roomType(tp).area || 0 }); }); }
		out.sort(function (a, b) { var ia = ROOM_ORDER.indexOf(a.type), ib = ROOM_ORDER.indexOf(b.type); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); });
		return out;
	}
	function curRoom() {
		var list = roomList(), sel = S.roomId && list.filter(function (r) { return r.id === S.roomId; })[0];
		if (!sel && S.roomId && S.roomId.indexOf('virtual:') === 0) { var tp = S.roomId.slice(8); sel = { id: S.roomId, type: tp, name: roomType(tp).label, area: roomType(tp).area || 0 }; }
		return sel || list[0];
	}
	function viewCfg(c) {
		if (S.view !== 'int') { return c; }
		var r = curRoom(), o = {}, src = (S.config.rooms || []).filter(function (q) { return String(q.id || q.type) === r.id; })[0] || {};
		Object.keys(c).forEach(function (k) { o[k] = c[k]; });
		o._int = { id: r.id, type: r.type, area: r.area };
		['width', 'length', 'ceiling_height', 'interior_style', 'wall_color', 'furniture_color'].forEach(function (k) { if (src[k] !== undefined && src[k] !== '') { o._int[k] = src[k]; } });
		return o;
	}
	// Which room shows a setting best (null: the current one).
	function roomTypesFor(id) {
		var f = S.fields[id] || {};
		var LIV = ['living', 'living_kitchen'], BED = ['master', 'bedroom', 'guest', 'kids'];
		var MAP = { sofa_type: LIV, armchair_type: LIV, coffee_table: LIV, media_wall: LIV, fireplace: LIV, floor_lamp: LIV, dining_table: ['dining', 'living_kitchen', 'kitchen'], dining_chairs: ['dining', 'living_kitchen', 'kitchen'], pendant_style: ['dining', 'living_kitchen', 'kitchen', 'living'], bed_type: BED, wardrobe_type: BED.concat(['wardrobe']), floor_bedrooms: BED, toilet_type: ['bathroom', 'wc'], stair_type: ['stairs', 'hall', 'corridor'], floor_entry: ['hall', 'corridor'], floor_kitchen: ['kitchen', 'living_kitchen'], floor_wet: ['bathroom', 'wc', 'wellness'], art_photo: LIV.concat(BED) };
		if (MAP[id]) { return MAP[id]; }
		if (f.category === 'kitchen') { return ['kitchen', 'living_kitchen']; }
		if (f.category === 'bathroom') { return ['bathroom', 'wellness', 'wc']; }
		return null;
	}
	function autoView(id, cat) {
		if (!A3 || id === 'room_items') { return; }
		var ct = cat || (S.fields[id] || {}).category;
		if (id === 'vehicles' || id === 'car_color' || id === 'landscape') { S.view = 'ext'; return; }
		if (INT_CATS.indexOf(ct) !== -1) {
			S.view = 'int';
			var types = id ? roomTypesFor(id) : ({ kitchen: ['kitchen', 'living_kitchen'], bathroom: ['bathroom', 'wc'], furniture: ['living', 'living_kitchen', 'dining', 'master', 'bedroom', 'guest', 'kids'] }[ct] || null);
			var cur = curRoom();
			if (types && types.indexOf(cur.type) === -1) {
				var r = roomList().filter(function (q) { return types.indexOf(q.type) !== -1; })[0];
				S.roomId = r ? r.id : 'virtual:' + types[0];
			}
		} else if (EXT_CATS.indexOf(ct) !== -1) { S.view = 'ext'; }
	}
	function setView(v, roomId) {
		S.view = v;
		if (roomId) { S.roomId = roomId; }
		renderPreviewOnly();
		updateWizardSide();
		if (els.fieldsList && els.fieldsList.querySelector('[data-field="extra_furniture"], [data-field="electronics"], [data-field="pets"]')) { renderFields(); }
	}
	function viewSwitch() {
		return h('div', { class: 'agh-3d-view', role: 'group', 'aria-label': t('view_switch') },
			h('button', { type: 'button', 'aria-pressed': S.view !== 'int' ? 'true' : 'false', onclick: function () { setView('ext'); } }, icon('home', 'agh-ico-s'), h('span', { text: t('view_exterior') })),
			h('button', { type: 'button', 'aria-pressed': S.view === 'int' ? 'true' : 'false', onclick: function () { setView('int'); } }, icon('sofa', 'agh-ico-s'), h('span', { text: t('view_interior') })));
	}
	// Room picker of the interior view: one button with the current room (a list opens above it) and
	// arrows to step through the rooms – it never runs out of the preview, however many rooms there are.
	function roomChips() {
		var cur = curRoom(), list = roomList();
		if (cur && list.every(function (r) { return r.id !== cur.id; })) { list.unshift(cur); }
		var idx = 0; list.forEach(function (r, i) { if (cur && r.id === cur.id) { idx = i; } });
		var step = function (d) { var n = list[(idx + d + list.length) % list.length]; if (n) { setView('int', n.id); } };
		var menu = h('div', { class: 'agh-3d-roommenu', role: 'listbox', 'aria-label': t('view_rooms'), hidden: true }, list.map(function (r) {
			return h('button', { type: 'button', role: 'option', title: r.name, 'aria-selected': cur && r.id === cur.id ? 'true' : 'false', onclick: function () { setView('int', r.id); }, text: r.name });
		}));
		var btn = h('button', { type: 'button', class: 'agh-3d-roombtn', title: cur ? cur.name : '', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', onclick: function (e) { menu.hidden = !menu.hidden; e.currentTarget.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true'); } },
			h('span', { class: 'agh-3d-roomname', text: cur ? cur.name : '' }), icon('chev', 'agh-ico-s'));
		// Escape closes the open list only (not the designer)
		var onKey = function (e) { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); e.stopPropagation(); menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } };
		return h('div', { class: 'agh-3d-rooms', role: 'group', 'aria-label': t('view_rooms'), onkeydown: onKey },
			list.length > 1 ? h('button', { type: 'button', class: 'agh-3d-step is-prev', title: t('view_prev_room'), 'aria-label': t('view_prev_room'), onclick: function () { step(-1); } }, icon('chev', 'agh-ico-s')) : null,
			btn,
			list.length > 1 ? h('button', { type: 'button', class: 'agh-3d-step is-next', title: t('view_next_room'), 'aria-label': t('view_next_room'), onclick: function () { step(1); } }, icon('chev', 'agh-ico-s')) : null,
			menu);
	}
	// Hand-made arrangement controls, next to the room selector: take back the last move, or let the
	// room arrange itself again. Both only show up once something in this room was moved by hand.
	function layoutTools() {
		var id = curRoomId(), all = layoutAll(), has = !!(id && all[id] && Object.keys(all[id]).length);
		return h('div', { class: 'agh-3d-lay', role: 'group', 'aria-label': t('layout_reset_room') },
			has ? h('button', { type: 'button', class: 'agh-3d-laybtn', title: t('layout_undo'), 'aria-label': t('layout_undo'), disabled: !layoutUndo.length, onclick: undoLayout }, icon('restart', 'agh-ico-s')) : null,
			has ? h('button', { type: 'button', class: 'agh-3d-laybtn', title: t('layout_reset_room'), 'aria-label': t('layout_reset_room'), onclick: resetLayout }, icon('refresh', 'agh-ico-s')) : null,
			h('span', { class: 'agh-3d-layhint', text: t('layout_hint') }));
	}
	function previewCaption(c) {
		if (S.view === 'int' && A3) {
			var r = curRoom();
			return h('div', { class: 'agh-preview-cap' },
				h('div', null, h('div', { class: 'agh-eyebrow', text: t('view_interior_cap') }), h('div', { class: 'agh-h', text: r ? r.name : '' })),
				h('span', { class: 'agh-badge', text: t('schematic') }));
		}
		return h('div', { class: 'agh-preview-cap' },
			h('div', null, h('div', { class: 'agh-eyebrow', text: t('live_preview') }), h('div', { class: 'agh-h', text: (c.house_name || optLabel(S.fields.arch_style || {}, c.arch_style)) })),
			h('span', { class: 'agh-badge', text: t('schematic') }));
	}

	var svgSeq = 0;
	function previewSvg(c) {
		// Unique id prefix: several sketches can be in the DOM at once (designer, wizard, cards).
		return window.AGH_Sketch ? window.AGH_Sketch.render(c, { id: 'agh' + (++svgSeq) + '_' }) : '';
	}

	function concepts() { return (S.project && S.project.concepts) || []; }
	function isRunning(p) { return !!p && ['queued', 'planning', 'rendering'].indexOf(p.status) !== -1; }
	// Final states without further work: no polling, the visitor can start a new generation.
	function isStopped(p) { return !!p && ['cancelled', 'failed', 'deleted'].indexOf(p.status) !== -1; }
	function conceptById(id) { return concepts().filter(function (c) { return c.id === id; })[0]; }

	function renderConcepts(body) {
		var grid = h('div', { class: 'agh-concepts' });
		var list = concepts();
		if (isRunning(S.project)) {
			// While the concepts are being made, the stop button sits right above them (not only in the bar).
			body.appendChild(h('div', { class: 'agh-run-bar', role: 'status' },
				h('span', { class: 'agh-spinner' }), h('span', { class: 'agh-run-text', text: t('status_generating') }),
				h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: cancelGeneration }, icon('stop', 'agh-ico-s'), t('cancel_generation'))));
		}
		if (!list.length) {
			if (isStopped(S.project)) {
				// Cancelled (possibly before any concept) or failed: explain and offer a new generation.
				var cancelled = S.project.status === 'cancelled';
				body.appendChild(h('div', { class: 'agh-empty agh-stopped', role: 'status' }, h('div', null,
					icon(cancelled ? 'stop' : 'alert'),
					h('p', { class: 'agh-stopped-title', text: cancelled ? t('project_cancelled') : t('failed_toast') }),
					h('p', { class: 'agh-small', text: t('project_cancelled_help') }),
					h('button', { type: 'button', class: 'agh-btn agh-btn-primary', disabled: !S.boot.provider.ready ? 'disabled' : null, onclick: generate }, icon('sparkle', 'agh-ico-s'), t('generate_new')))));
				return;
			}
			body.appendChild(h('div', { class: 'agh-empty' }, h('div', null, h('span', { class: 'agh-spinner' }), h('p', { text: t('preparing_concepts') }))));
			return;
		}
		list.forEach(function (c) {
			var img = h('div', { class: 'agh-concept-img' + (c.hero && c.hero.preview ? ' is-ready' : '') });
			if (c.hero && c.hero.preview) { img.appendChild(h('img', { src: c.hero.preview, alt: c.title, loading: 'lazy' })); }
			else if (c.hero && c.hero.status === 'failed' || c.status === 'failed') { img.appendChild(h('div', { class: 'agh-state' }, icon('alert'), t('render_failed'), c.hero && c.hero.error ? h('small', { class: 'agh-state-err', title: c.hero.error, text: c.hero.error }) : null)); }
			else if (!isRunning(S.project) && (isStopped(S.project) || !c.hero || c.hero.status === 'cancelled')) { img.appendChild(h('div', { class: 'agh-state' }, icon('stop'), t('render_cancelled'))); }
			else { img.appendChild(h('div', { class: 'agh-state' }, h('span', { class: 'agh-spinner' }), t('rendering'))); }
			img.appendChild(h('span', { class: 'agh-concept-letter', text: c.variant }));
			var flags = h('div', { class: 'agh-concept-flags' });
			if (c.selected) { flags.appendChild(h('span', { class: 'agh-badge agh-badge-ok', text: t('selected') })); }
			if (c.hero && c.hero.is_test) { flags.appendChild(h('span', { class: 'agh-badge agh-badge-test', text: t('test_image') })); }
			img.appendChild(flags);
			var pal = h('div', { class: 'agh-palette' });
			(c.palette || []).forEach(function (col) { pal.appendChild(h('i', { style: { background: col } })); });
			var m = c.metrics || {};
			var actions = h('div', { class: 'agh-concept-actions' });
			actions.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s ' + (c.selected ? 'agh-btn-accent' : 'agh-btn-primary'), disabled: !(c.hero && c.hero.preview) ? 'disabled' : null, onclick: function (e) { e.stopPropagation(); selectConcept(c.id); } }, icon('check', 'agh-ico-s'), c.selected ? t('open_gallery') : t('choose')));
			if (c.hero && c.hero.preview) { actions.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function (e) { e.stopPropagation(); lightbox([c.hero], 0, c); } }, icon('expand', 'agh-ico-s'), t('enlarge'))); }
			var card = h('article', { class: 'agh-concept' + (c.selected ? ' is-selected' : ''), tabindex: '0', onclick: function () { if (c.hero && c.hero.preview) { lightbox([c.hero], 0, c); } } },
				img,
				h('div', { class: 'agh-concept-body' },
					h('h4', { text: c.title }),
					h('p', { text: c.tagline }),
					h('div', { class: 'agh-concept-metrics' }, h('span', { text: fmt(m.width, 1) + ' × ' + fmt(m.length, 1) + ' m' }), h('span', { text: fmt(m.net_planned, 0) + ' m²' }), h('span', { text: '▲ ' + fmt(m.ridge, 1) + ' m' }), pal),
					(c.warnings || []).length ? h('div', { class: 'agh-small', style: { color: 'var(--agh-warning)' }, title: c.warnings.join('\n'), text: '⚠ ' + tf('n_notes', c.warnings.length) }) : null,
					actions));
			grid.appendChild(card);
		});
		body.appendChild(grid);
		body.appendChild(h('p', { class: 'agh-disclaimer', style: { 'margin-top': '10px' }, text: S.project.disclaimer }));
	}

	function renderCompare(body) {
		var list = concepts();
		var grid = h('div', { class: 'agh-compare' });
		grid.appendChild(h('div', { class: 'agh-compare-h' }));
		list.forEach(function (c) { grid.appendChild(h('div', null, c.hero && c.hero.preview ? h('img', { src: c.hero.preview, alt: c.title, style: { 'border-radius': '12px', 'aspect-ratio': '16/10', 'object-fit': 'cover', width: '100%' } }) : h('div', { class: 'agh-muted', text: t('rendering') }), h('b', { text: c.variant + ' – ' + c.title }))); });
		var rows = [
			[t('cmp_character'), function (c) { return c.tagline; }],
			[t('cmp_dims'), function (c) { return fmt(c.metrics.width, 1) + ' × ' + fmt(c.metrics.length, 1) + ' m'; }],
			[t('cmp_net'), function (c) { return fmt(c.metrics.net_planned, 1) + ' m²'; }],
			[t('cmp_footprint'), function (c) { return fmt(c.metrics.footprint, 1) + ' m²'; }],
			[t('cmp_ridge'), function (c) { return fmt(c.metrics.ridge, 2) + ' m'; }],
			[t('cmp_shape'), function (c) { return t('shape_' + (c.metrics.shape || 'rectangle')); }],
			[t('cmp_rooms'), function (c) { return String(c.metrics.rooms); }],
			[t('cmp_notes'), function (c) { return (c.warnings || []).length ? c.warnings.join(' · ') : '–'; }]
		];
		rows.forEach(function (r) {
			grid.appendChild(h('div', { class: 'agh-compare-h', text: r[0] }));
			list.forEach(function (c) { grid.appendChild(h('div', { text: r[1](c) })); });
		});
		grid.appendChild(h('div', { class: 'agh-compare-h' }));
		list.forEach(function (c) { grid.appendChild(h('div', null, h('button', { type: 'button', class: 'agh-btn agh-btn-s ' + (c.selected ? 'agh-btn-accent' : 'agh-btn-primary'), disabled: !(c.hero && c.hero.preview) ? 'disabled' : null, onclick: function () { selectConcept(c.id); } }, c.selected ? t('selected') : t('choose')))); });
		body.appendChild(h('div', { class: 'agh-scroll' }, grid));
	}

	function galleryItems(c) {
		var out = [];
		if (S.galleryTab === 'exterior' && c.hero) { out.push(c.hero); }
		(c.assets || []).forEach(function (a) {
			var interior = a.view.indexOf('interior_') === 0;
			if (S.galleryTab === 'exterior' && a.kind === 'render' && !interior) { out.push(a); }
			if (S.galleryTab === 'interior' && a.kind === 'render' && interior) { out.push(a); }
			if (S.galleryTab === 'plans' && a.kind === 'plan') { out.push(a); }
		});
		return out.filter(function (a) { return a.status !== 'archived' && a.status !== 'cancelled'; });
	}

	function renderGallery(body) {
		var c = conceptById(S.selected);
		if (!c) { S.view = 'concepts'; renderStage(); return; }
		var head = h('div', { style: { display: 'flex', gap: '8px', 'align-items': 'center', 'flex-wrap': 'wrap', 'margin-bottom': '10px' } });
		var seg = h('div', { class: 'agh-seg' });
		[['exterior', t('tab_exterior')], ['interior', t('tab_interior')], ['plans', t('tab_plans')]].forEach(function (x) {
			if (x[0] === 'plans' && !S.boot.features.floorplans) { return; }
			seg.appendChild(h('button', { type: 'button', 'aria-pressed': S.galleryTab === x[0] ? 'true' : 'false', onclick: function () { S.galleryTab = x[0]; S.galleryIndex = 0; renderStage(); }, text: x[1] }));
		});
		head.appendChild(h('b', { text: c.variant + ' – ' + c.title, style: { 'letter-spacing': '.1em', 'text-transform': 'uppercase', 'font-size': '13px' } }));
		head.appendChild(seg);
		head.appendChild(h('div', { style: { flex: '1' } }));
		if (c.gallery_status === 'rendering' || c.gallery_status === 'pending') { head.appendChild(h('span', { class: 'agh-badge' }, h('span', { class: 'agh-spinner', style: { width: '11px', height: '11px' } }), t('gallery_rendering'))); }
		if (c.hero && c.hero.download) { head.appendChild(h('a', { class: 'agh-btn agh-btn-s agh-btn-accent', href: c.hero.download, download: '' }, icon('download', 'agh-ico-s'), t('download_hero'))); }
		head.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s', title: rebuildsLeft() === null ? null : tf('regenerate_left', rebuildsLeft()), onclick: function () { regenerate(c); } }, icon('refresh', 'agh-ico-s'), t('regenerate')));
		body.appendChild(head);
		var items = galleryItems(c);
		if (!items.length) {
			body.appendChild(h('div', { class: 'agh-empty' }, h('div', null, c.gallery_status === 'rendering' || c.gallery_status === 'pending' ? h('span', { class: 'agh-spinner' }) : icon('info'), h('p', { text: S.galleryTab === 'interior' ? t('no_interiors') : t('gallery_empty') }))));
			return;
		}
		if (S.galleryIndex >= items.length) { S.galleryIndex = 0; }
		var cur = items[S.galleryIndex];
		var main = h('div', { class: 'agh-gallery-main' + (cur.kind === 'plan' ? ' is-plan' : '') });
		if (cur.preview) { main.appendChild(h('img', { src: cur.preview, alt: cur.label, onclick: function () { lightbox(items, S.galleryIndex, c); }, style: { cursor: 'zoom-in' } })); }
		else { main.appendChild(h('div', { class: 'agh-empty', style: { color: '#ccc' } }, cur.status === 'failed' ? t('render_failed') : h('span', null, h('span', { class: 'agh-spinner' }), ' ', t('rendering')))); }
		main.appendChild(h('div', { class: 'agh-gallery-cap' },
			h('span', { class: 'agh-badge', style: { background: 'rgba(255,255,255,.85)', color: '#1E2226' } }, cur.label, cur.resolution ? ' · ' + cur.resolution : '', cur.is_test ? ' · ' + t('test_image') : ''),
			h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('enlarge'), onclick: function () { lightbox(items, S.galleryIndex, c); } }, icon('expand'))));
		var strip = h('div', { class: 'agh-strip' });
		items.forEach(function (a, i) {
			strip.appendChild(h('button', { type: 'button', class: 'agh-thumb', 'aria-current': i === S.galleryIndex ? 'true' : 'false', 'aria-label': a.label, onclick: function () { S.galleryIndex = i; renderStage(); } },
				a.preview ? h('img', { src: a.preview, alt: '', loading: 'lazy' }) : h('span', { class: 'agh-state' }, a.status === 'failed' ? '⚠' : h('span', { class: 'agh-spinner', style: { width: '12px', height: '12px' } })),
				h('span', { class: 'agh-thumb-label', text: a.label })));
		});
		body.appendChild(h('div', { class: 'agh-gallery' }, main, strip));
	}

	function lightbox(items, index, concept) {
		var lb = h('div', { class: 'agh-lightbox', role: 'dialog', 'aria-label': t('enlarge') });
		S.lb = { items: items.filter(function (a) { return a.preview; }), index: 0, el: lb, concept: concept };
		S.lb.index = Math.max(0, S.lb.items.indexOf(items[index]));
		drawLightbox();
		shell.appendChild(lb);
	}
	function closeLightbox() {
		if (!S.lb) { return; }
		if (FS.el === S.lb.el) { fsExit(); fsDone(); }
		S.lb.el.remove(); S.lb = null;
	}
	// Full screen: the largest stored version is loaded; the current picture stays until it arrives.
	function lbFull(img, a) {
		var big = a.download || a.full || '';
		if (!big || big === a.preview || /\.(zip|pdf)(\?|$)/i.test(big) || img._big === big) { return; }
		img._big = big;
		var pre = new Image();
		pre.onload = function () { if (S.lb && S.lb.items[S.lb.index] === a && img.isConnected) { img.src = big; } };
		pre.src = big;
	}
	function stepLightbox(d) { if (!S.lb) { return; } S.lb.index = (S.lb.index + d + S.lb.items.length) % S.lb.items.length; drawLightbox(); }
	function drawLightbox() {
		var lb = clear(S.lb.el), a = S.lb.items[S.lb.index];
		if (!a) { lb.remove(); return; }
		lb.appendChild(h('div', { class: 'agh-lightbox-top' }, h('b', { text: (S.lb.concept ? S.lb.concept.variant + ' – ' : '') + a.label }), h('span', { class: 'agh-small', style: { opacity: '.7' }, text: a.resolution || '' }), h('div', { style: { flex: '1' } }),
			a.download ? h('a', { class: 'agh-btn agh-btn-s agh-btn-accent', href: a.download, download: '' }, icon('download', 'agh-ico-s'), t('download')) : null,
			fsButton(function () { return lb; }, 'agh-iconbtn'),
			h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('close'), onclick: function () { closeLightbox(); } }, icon('close'))));
		var img = h('img', { src: a.preview, alt: a.label });
		lb.appendChild(h('div', { class: 'agh-lightbox-img' }, img));
		if (FS.el === lb) { lbFull(img, a); }
		lb.appendChild(h('div', { class: 'agh-lightbox-bottom' }, S.lb.items.length > 1 ? h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('prev'), onclick: function () { stepLightbox(-1); } }, icon('left')) : null, h('div', { style: { flex: '1', 'text-align': 'center' }, class: 'agh-small', text: (S.lb.index + 1) + ' / ' + S.lb.items.length }), S.lb.items.length > 1 ? h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('next'), onclick: function () { stepLightbox(1); } }, icon('chev')) : null));
	}

	/* ------------------------------------------------------------------ summary */
	function renderSummary() {
		if (!els.summaryPanel) { return; }
		var p = clear(els.summaryPanel);
		p.appendChild(h('div', { class: 'agh-panel-head' }, h('span', { class: 'agh-panel-title', text: t('summary') })));
		var box = h('div', { class: 'agh-summary' });
		var c = S.config;
		if (isRunning(S.project) || (S.project && S.project.status === 'cancelled') || (S.project && S.project.stage !== 'done' && ['ready', 'partial'].indexOf(S.project.status) !== -1)) {
			box.appendChild(renderProgress());
		}
		box.appendChild(h('div', { class: 'agh-sum-group' }, h('h5', { text: t('sum_house') }), houseList(c)));

		box.appendChild(h('div', { class: 'agh-sum-group' }, h('h5', { text: t('sum_checks') }), checkList()));

		var lim = S.boot.limits || {};
		if (lim.limit) {
			var dots = h('div', { class: 'agh-limit-dots' });
			for (var i = 0; i < Math.min(lim.limit, 12); i++) { dots.appendChild(h('i', { class: i < lim.used ? 'is-used' : '' })); }
			box.appendChild(h('div', { class: 'agh-sum-group' }, h('h5', { text: t('sum_limit') }), h('div', { class: 'agh-limit' }, dots, h('span', { text: tf('limit_text', lim.remaining, lim.limit) }))));
		}
		if (S.boot.provider.test) { box.appendChild(h('div', { class: 'agh-disclaimer', text: t('test_mode_help') })); }
		box.appendChild(h('div', { class: 'agh-disclaimer', text: t('disclaimer') }));
		p.appendChild(h('div', { class: 'agh-scroll' }, box));
	}

	// The house summary (definition list) – used by the summary panel and the wizard's last step.
	function houseList(c) {
		var dl = h('dl', { class: 'agh-sum-list' });
		function row(k, v) { dl.appendChild(h('dt', { text: k })); dl.appendChild(h('dd', { text: v })); }
		row(t('kpi_style'), optLabel(S.fields.arch_style || {}, c.arch_style));
		row(t('kpi_type'), optLabel(S.fields.property_type || {}, c.property_type));
		row(t('kpi_levels'), optLabel(S.fields.levels || {}, c.levels));
		row(t('kpi_area'), fmt(c.net_area, 0) + ' m²');
		row(t('kpi_rooms_total'), String((c.rooms || []).length));
		row(t('kpi_bedrooms'), String(c.bedrooms));
		row(t('kpi_bathrooms'), String(c.bathrooms));
		row(t('kpi_roof'), optLabel(S.fields.roof_type || {}, c.roof_type) + (c.roof_type !== 'flat' && c.roof_pitch ? ' · ' + c.roof_pitch + '°' : ''));
		if (S.fields.roof_product && c.roof_product) {
			var rp = optByValue(S.fields.roof_product, c.roof_product);
			dl.appendChild(h('dt', { text: t('kpi_roof_product') }));
			dl.appendChild(h('dd', null, optLabel(S.fields.roof_product, c.roof_product), rp && rp.verified === false ? unverifiedMark() : null));
		}
		row(t('kpi_facade'), optLabel(S.fields.facade_main || {}, c.facade_main));
		if (Number(c.terrace_area) > 0) { row(t('kpi_terrace'), fmt(c.terrace_area, 0) + ' m²'); }
		row(t('kpi_garage'), optLabel(S.fields.garage || {}, c.garage));
		return dl;
	}
	// Validation messages; a click jumps to the field.
	function checkList() {
		var msgs = h('div', { class: 'agh-msgs' });
		var any = false;
		[['errors', 'error', 'error'], ['warnings', 'warning', 'alert'], ['info', 'info', 'info']].forEach(function (k) {
			(S.check[k[0]] || []).forEach(function (m) { any = true; msgs.appendChild(h('div', { class: 'agh-msg is-' + k[1], role: 'button', tabindex: '0', onclick: function () { focusField(m.field); } }, icon(k[2]), h('span', { text: m.message }))); });
		});
		if (!any) { msgs.appendChild(h('div', { class: 'agh-msg is-info' }, icon('check'), h('span', { text: t('all_consistent') }))); }
		return msgs;
	}

	function renderProgress() {
		var pr = S.project.progress || {};
		var g = h('div', { class: 'agh-sum-group' }, h('h5', { text: t('progress') }));
		if (pr.percent !== null && pr.percent !== undefined) {
			g.appendChild(h('div', { class: 'agh-bar', role: 'progressbar', 'aria-valuenow': pr.percent, 'aria-valuemin': 0, 'aria-valuemax': 100, style: { 'margin-bottom': '10px' } }, h('i', { style: { width: pr.percent + '%' } })));
		}
		var steps = h('div', { class: 'agh-steps' });
		var ico = { done: 'check', active: 'refresh', error: 'error', pending: 'info', skipped: 'stop' };
		(pr.stages || []).forEach(function (s) {
			var n = Number(s.errors) || 0;
			var note = '';
			if (s.state === 'done' && n > 0) { note = tf('stage_done_errors', n); }
			else if (s.state === 'error' && n > 0) { note = tf('stage_errors', n); }
			else if (s.state === 'skipped') { note = t('stage_skipped'); }
			steps.appendChild(h('div', { class: 'agh-step is-' + s.state + (s.state === 'done' && n > 0 ? ' has-errors' : '') },
				h('span', { class: 'agh-step-ico' }, icon(s.state === 'done' && n > 0 ? 'alert' : (ico[s.state] || 'info'), 'agh-ico-s')),
				h('span', { class: 'agh-step-label' }, s.label, note ? h('small', { class: 'agh-step-note', text: note }) : null)));
		});
		g.appendChild(steps);
		if (pr.counts) { g.appendChild(h('p', { class: 'agh-small agh-muted', text: tf('images_done', pr.counts.ext_done + pr.counts.int_done, pr.counts.ext_total + pr.counts.int_total) })); }
		if (S.project.status === 'cancelled') { g.appendChild(h('p', { class: 'agh-field-msg is-warning', text: t('project_cancelled') })); }
		return g;
	}

	/* ------------------------------------------------------------------ action bar */
	function renderActionbar() {
		var a = clear(els.actionbar);
		var running = S.project && ['queued', 'planning', 'rendering'].indexOf(S.project.status) !== -1;
		var status = h('div', { class: 'agh-actionbar-status' });
		if (running) { status.appendChild(h('span', { class: 'agh-spinner' })); status.appendChild(h('span', { text: t('status_generating') })); }
		else if (S.check.errors && S.check.errors.length) { status.appendChild(icon('error')); status.appendChild(h('span', { text: tf('status_errors', S.check.errors.length) })); }
		else if (S.project && S.project.quote) { status.appendChild(icon('check')); status.appendChild(h('span', { text: t('status_quoted') })); }
		else if (S.project && !S.dirty && ['ready', 'partial'].indexOf(S.project.status) !== -1) { status.appendChild(icon('check')); status.appendChild(h('span', { text: S.selected ? t('status_ready_selected') : t('done_toast') })); }
		else if (!S.boot.provider.ready) { status.appendChild(icon('alert')); status.appendChild(h('span', { text: t('not_configured_visitor') })); }
		else if (S.project && S.project.status === 'cancelled') { status.appendChild(icon('stop')); status.appendChild(h('span', { text: t('status_cancelled') })); }
		else { status.appendChild(icon('info')); status.appendChild(h('span', { text: S.dirty && S.project ? t('status_changed') : t('status_ready') })); }
		a.appendChild(status);
		if (S.boot.features.save) {
			a.appendChild(h('button', { type: 'button', class: 'agh-btn', disabled: !S.project ? 'disabled' : null, title: !S.project ? t('save_after_generate') : '', onclick: saveProject }, icon('save', 'agh-ico-s'), h('span', { class: 'agh-btn-label', text: t('save') })));
		}
		if (running) {
			a.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-ghost', onclick: cancelGeneration }, icon('stop', 'agh-ico-s'), h('span', { class: 'agh-btn-label', text: t('cancel_generation') })));
		}
		var canQuote = S.project && S.selected && S.boot.features.quote && !(S.project.quote);
		a.appendChild(h('button', { type: 'button', class: 'agh-btn', disabled: canQuote ? null : 'disabled', title: canQuote ? '' : t('quote_hint'), onclick: showQuote }, icon('send', 'agh-ico-s'), h('span', { class: 'agh-btn-label', text: t('quote') })));
		var gen = h('button', { type: 'button', class: 'agh-btn agh-btn-primary agh-btn-lg', disabled: running || (S.check.errors && S.check.errors.length) || !S.boot.provider.ready ? 'disabled' : null, title: !S.boot.provider.ready ? t('not_configured_visitor') : '', onclick: generate }, icon('sparkle', 'agh-ico-s'), S.project ? t('generate_new') : t('generate'));
		a.appendChild(gen);
	}

	/* ------------------------------------------------------------------ quick wizard */
	// A short, step-by-step path through the most important parameters. It edits the same
	// S.config as the full designer (same validation, same generation), so the visitor can
	// switch to the full designer at any point without losing anything.
	var WIZ = [
		{ key: 'style', fields: ['arch_style'] },
		{ key: 'home', fields: ['property_type', 'levels', 'massing', 'occupants'] },
		{ key: 'size', fields: ['net_area', 'bedrooms', 'bathrooms'] },
		{ key: 'roof', fields: ['roof_type', 'roof_pitch', 'roof_product'] },
		{ key: 'look', fields: ['facade_main', 'facade_color', 'window_style'] },
		{ key: 'outdoor', fields: ['garage', 'terrace_area', 'garden_style'] },
		{ key: 'done', fields: [] }
	];
	function wizFields(st) {
		return st.fields.map(function (id) { return S.fields[id]; }).filter(function (f) { return f && visible(f); });
	}
	// Short selects become big tappable cards in the wizard (same field id, same values).
	function wizView(f) {
		if (f.type === 'select' && !f.filter_by && (f.options || []).length && f.options.length <= 6) {
			var c = {};
			Object.keys(f).forEach(function (k) { c[k] = f[k]; });
			c.type = 'cards';
			return c;
		}
		return f;
	}
	function startInWizard() {
		if (S.projectId) { return false; }
		var ui = lsGet(LS_UI, null);
		if (ui === 'wizard' || ui === 'designer') { return ui === 'wizard'; }
		return S.boot.layout.start !== 'designer';
	}
	function toggleWizard() {
		if (S.wiz) { exitWizard(false); } else { enterWizard(0); }
	}
	function updateWizardToggles() {
		var on = !!S.wiz;
		[els.wizBtn, els.wizItem].forEach(function (b) {
			if (!b) { return; }
			clear(b);
			b.appendChild(icon(on ? 'sliders' : 'sparkle', 'agh-ico-s'));
			b.appendChild(document.createTextNode(on ? t('wiz_full') : t('wiz_open')));
		});
	}
	/* ------------------------------------------------------------------ build mode („Építés az alapoktól”)
	 * Switched on in the admin (build.enabled): agh-build.js is loaded with the sketch, the editor
	 * (agh-build-ui.js) and the 3D construction stages (agh-3d-build.js) on demand. Switched off, none of
	 * this runs and the designer is exactly as before. */
	function buildOn() { return !!(S.boot && S.boot.build && S.boot.build.enabled && window.AGH_Build); }
	function buildSetup() {
		if (!buildOn() || window.AGH_Build.active) { return; }
		window.AGH_Build.setData({ defaults: S.boot.build.defaults, rules: S.boot.build.rules || {} });
		window.AGH_Build.active = true;
	}
	var bldUiLoading = null, bldScene = null;
	function loadBuildUi() {
		if (window.AGH_BuildUI) { return Promise.resolve(); }
		if (!bldUiLoading) {
			bldUiLoading = new Promise(function (res, rej) {
				var sc = document.createElement('script');
				sc.src = S.boot.build.ui; sc.async = true;
				sc.onload = function () { res(); };
				sc.onerror = function () { bldUiLoading = null; rej(new Error('build ui')); };
				document.head.appendChild(sc);
			});
		}
		return bldUiLoading;
	}
	function loadBuildScene() {
		if (!bldScene) { bldScene = import(S.boot.build.scene).then(function (m) { if (A3 && m && m.install) { m.install(A3); } return m; }, function () { bldScene = null; return null; }); }
		return bldScene;
	}
	function toggleBuild() { if (S.bld) { exitBuild(false); } else { enterBuild(); } }
	function updateBuildToggles() {
		if (els.bldBtn) { clear(els.bldBtn); els.bldBtn.appendChild(icon(S.bld ? 'left' : 'wall', 'agh-ico-s')); els.bldBtn.appendChild(document.createTextNode(t(S.bld ? 'b_to_designer' : 'b_open'))); els.bldBtn.setAttribute('aria-pressed', S.bld ? 'true' : 'false'); }
	}
	function enterBuild() {
		if (!buildOn()) { return; }
		buildSetup();
		closeMenu(false);
		// the editor shows at once with a loading indicator; its script follows
		if (S.wiz) { exitWizard(true); }
		S.bld = true;
		shell.classList.add('is-build');
		if (!els.build) { els.build = h('section', { class: 'agh-build', 'aria-label': t('b_title') }); }
		if (els.build.parentNode !== shell) { shell.insertBefore(els.build, els.actionbar); }
		els.build.hidden = false;
		if (!window.AGH_BuildUI) { clear(els.build); els.build.appendChild(h('div', { class: 'agh-bld-loading', role: 'status' }, h('i', { class: 'agh-spinner' }), h('span', { text: t('b_loading') }))); }
		updateBuildToggles();
		loadBuildUi().then(function () {
			if (!root || !S.bld) { return; }
			window.AGH_BuildUI.open(buildApi());
			event('build_open');
		}, function () { exitBuild(false); toast(t('b_load_error'), 'error'); });
	}
	function exitBuild(done) {
		if (!S.bld) { return; }
		if (FS.el && els.build && els.build.contains(FS.el)) { fsExit(); fsDone(); }
		if (window.AGH_BuildUI) { window.AGH_BuildUI.close(); }
		S.bld = false;
		shell.classList.remove('is-build');
		if (els.build) { els.build.hidden = true; clear(els.build); }
		updateBuildToggles();
		S.view = 'design';
		renderParams(); renderStage(); renderSummary(); renderActionbar(); validate();
		if (done) { toast(t('b_done_toast'), 'ok'); }
	}
	function buildApi() {
		return {
			host: els.build, t: t, tf: tf, icon: icon, locale: S.locale,
			config: function () { return S.config; },
			field: function (id) { return S.fields[id] || null; },
			apply: applyBuild,
			setParam: function (id, v) { S.config[id] = v; S.explicit[id] = true; S.dirty = true; persist(); validate(); renderSummary(); },
			preview3D: buildPreview3D,
			setPhase: function (p) { var v = A3 && A3.viewer(); if (v && v.setPhase) { v.setPhase(p); } },
			viewer: function () { return A3 ? A3.viewer() : null; },
			toast: function (msg, kind, ms) { toast(msg, kind, ms); },
			sketch: function (c) { return previewSvg(c); },
			fsButton: function (getEl, cls) { return fsButton(getEl, cls); },
			photoSlot: photoSlot,
			roomTypes: buildRoomTypes,
			defaultRoomTypes: defaultRoomTypes,
			confirm: function (title, text, go, fn) { confirmDialog(title, text, go, fn); },
			close: exitBuild
		};
	}
	// The drawing and the parameters that follow from it (levels, size, rooms…) go into the config.
	function applyBuild(b, d) {
		S.config.build = b; S.explicit.build = true;
		Object.keys(d || {}).forEach(function (k) { if (k.charAt(0) === '_') { return; } if (S.fields[k] || Object.prototype.hasOwnProperty.call(S.config, k)) { S.config[k] = d[k]; S.explicit[k] = true; } });
		var rs = (d && d._rooms) || [];
		if (rs.length >= 2) {
			var names = {}, defs = defaultRoomTypes(rs.map(function (r) { return { area: r.area * 1e6, lv: r.level, type: r.type }; })), old = {};
			buildRoomTypes().forEach(function (o) { names[o[0]] = o[1]; });
			(S.config.rooms || []).forEach(function (r) { old[r.id] = r; });
			S.config.rooms = rs.map(function (r, i) {
				var ty = r.type || defs[i], o = old[r.id] && old[r.id].type === ty ? old[r.id] : {};
				return Object.assign({}, o, { id: r.id, type: ty, name: o.name || names[ty] || ty, area: r.area, level: r.level, render: o.render !== undefined ? o.render : true, width: r.width, length: r.length });
			});
			S.explicit.rooms = true;
		}
		S.dirty = true;
		persist(); validate(); renderSummary();
	}
	function buildPreview3D(el, c, phase, reset) {
		if (!A3) { return false; }
		if (!el.querySelector('.agh-bld-3dwait')) { var wt = waitBox(); wt.classList.add('agh-bld-3dwait'); el.appendChild(wt); }
		loadBuildScene().then(function (m) {
			var wn = el.querySelector('.agh-bld-3dwait');
			if (!m || !S.bld || !el.isConnected) { if (wn) { wn.remove(); } return; }
			var v = A3.viewer();
			if (!v) { A3.attach(el, c); v = A3.viewer(); }
			if (v.wrap.parentNode !== el) { el.insertBefore(v.wrap, el.firstChild); }
			v.onPick = null; v.onLayout = null; v.onGrab = null;
			v.syncSize();
			v.update(c, 'build');
			// 1.16.3: coming from the plan the 3D looks from the street side, as the plan is drawn (street
			// at the bottom) – an orbit left over from earlier showed the house turned, as if mirrored
			if (reset && v.fitCamera) { v.fitCamera(true); v.requestRender(); }
			if (v.setPhase) { v.setPhase(phase); }
			// the first frame of a new scene takes a moment on slow devices: the indicator stays until then
			requestAnimationFrame(function () { requestAnimationFrame(function () { var w2 = el.querySelector('.agh-bld-3dwait'); if (w2) { w2.remove(); } }); });
		});
		return true;
	}
	function buildRoomTypes() {
		var src = (S.boot.build && S.boot.build.room_types) || {}, out = [];
		if (Array.isArray(src)) { src.forEach(function (o) { if (Array.isArray(o)) { out.push([o[0], o[1]]); } else if (o && (o.id || o.value)) { out.push([o.value || o.id, o.label || o.name || o.value || o.id]); } }); }
		else { Object.keys(src).forEach(function (k) { var v = src[k]; out.push([k, typeof v === 'string' ? v : (v && (v.label || v[0])) || k]); }); }
		return out;
	}
	// A sensible first guess of the room types (largest room per level, small ones as bath/WC); the
	// visitor changes them in the partitions step.
	function defaultRoomTypes(list) {
		var ok = {}, rank = {}, byLv = {};
		buildRoomTypes().forEach(function (o) { ok[o[0]] = 1; });
		var fb = Object.keys(ok)[0] || 'living';
		var pick = function (a) { for (var i = 0; i < a.length; i++) { if (ok[a[i]]) { return a[i]; } } return fb; };
		list.forEach(function (r, i) { var lv = r.lv || 0; (byLv[lv] = byLv[lv] || []).push(i); });
		Object.keys(byLv).forEach(function (lv) { byLv[lv].sort(function (a, b) { return list[b].area - list[a].area; }).forEach(function (idx, k) { rank[idx] = k; }); });
		return list.map(function (r, i) {
			var a = r.area / 1e6, lv = r.lv || 0;
			if (rank[i] === 0) { return pick(lv === 0 ? ['living_kitchen', 'living'] : ['master', 'bedroom']); }
			if (a < 4.5) { return pick(['wc', 'bathroom', 'storage']); }
			if (a < 8.5) { return pick(['bathroom', 'hall']); }
			return pick(['bedroom']);
		});
	}
	function entryChoice() {
		return h('div', { class: 'agh-entry', role: 'group', 'aria-label': t('b_entry') },
			h('button', { type: 'button', class: 'agh-entry-card', 'aria-pressed': 'true', onclick: function () { var f = els.wizBody && els.wizBody.querySelector('.agh-wiz-fields'); if (f && f.scrollIntoView) { f.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } },
				icon('sparkle'), h('b', { text: t('b_entry_quick') }), h('span', { text: t('b_entry_quick_text') })),
			h('button', { type: 'button', class: 'agh-entry-card is-build', 'aria-pressed': 'false', onclick: enterBuild },
				icon('wall'), h('b', { text: t('b_entry_build') }), h('span', { text: t('b_entry_build_text') })));
	}

	function enterWizard(step) {
		S.wiz = { step: Math.max(0, Math.min(WIZ.length - 1, step || 0)) };
		lsSet(LS_UI, 'wizard');
		closeMenu(false);
		// The wizard renders the same fields: the hidden parameter panel must not keep duplicate element ids.
		clear(els.paramsPanel);
		shell.classList.add('is-wizard');
		if (!els.wizard) {
			els.wizard = h('section', { class: 'agh-wizard', 'aria-label': t('wiz_open') });
			shell.insertBefore(els.wizard, els.actionbar);
		}
		els.wizard.hidden = false;
		updateWizardToggles();
		renderWizardStep(true);
	}
	function exitWizard(silent) {
		if (!S.wiz) { return; }
		S.wiz = null;
		lsSet(LS_UI, 'designer');
		shell.classList.remove('is-wizard');
		if (els.wizard) { els.wizard.hidden = true; clear(els.wizard); }
		els.wizBody = els.wizSide = els.wizScroll = els.wizGen = els.wizDone = els.wizPv = els.wizKpis = null;
		updateWizardToggles();
		// "Full designer" from the wizard opens with every setting (detailed mode)
		if (!silent && S.mode !== 'detailed') { S.mode = 'detailed'; persist(); syncModeSeg(); }
		renderParams();
		renderStage();
		renderSummary();
		renderActionbar();
		if (!silent) {
			setTimeout(function () { var f = shell.querySelector('.agh-rail button'); if (f) { f.focus(); } }, 30);
			if (S.boot.layout.tour && !lsGet('agh_tour_done', false)) { setTimeout(showTour, 300); }
		}
	}
	function wizardGo(k) {
		if (!S.wiz) { return; }
		S.wiz.step = Math.max(0, Math.min(WIZ.length - 1, k));
		renderWizardStep(true);
	}
	function wizardNext() {
		var ids = wizFields(WIZ[S.wiz.step]).map(function (f) { return f.id; });
		var errs = (S.check.errors || []).filter(function (m) { return ids.indexOf(m.field) !== -1; });
		if (errs.length) {
			toast(t('wiz_fix_errors'), 'warn');
			var fw = els.wizBody && els.wizBody.querySelector('[data-field="' + errs[0].field + '"]');
			var c = fw && fw.querySelector('input, select, textarea, button');
			if (c) { c.focus(); }
			return;
		}
		wizardGo(S.wiz.step + 1);
	}
	function wizardFocusField(id) {
		var k = -1;
		WIZ.forEach(function (st, i) { if (k === -1 && st.fields.indexOf(id) !== -1) { k = i; } });
		if (k === -1) { exitWizard(true); focusField(id); return; }
		wizardGo(k);
		setTimeout(function () {
			var fw = els.wizBody && els.wizBody.querySelector('[data-field="' + id + '"]');
			if (!fw) { return; }
			fw.scrollIntoView({ block: 'center' });
			var c = fw.querySelector('input, select, textarea, button');
			if (c) { c.focus({ preventScroll: true }); }
		}, 30);
	}

	function renderWizardStep(focusTitle) {
		var w = els.wizard;
		if (!w || !S.wiz) { return; }
		// A value change re-renders the step: keep the keyboard position and the scroll offset.
		var act = document.activeElement, keep = null;
		if (!focusTitle && act && w.contains(act) && act.closest('[data-field]')) {
			var fw = act.closest('[data-field]');
			keep = { field: fw.getAttribute('data-field'), idx: Array.prototype.indexOf.call(fw.querySelectorAll('button, input, select, textarea'), act) };
		}
		var scrollTop = els.wizScroll ? els.wizScroll.scrollTop : 0;
		var i = S.wiz.step, st = WIZ[i], last = i === WIZ.length - 1;
		// The side column (live 3D preview) survives re-renders: rebuilding it on every click moved the
		// canvas into a fresh, not yet sized box and the house flickered (stretched, then restored).
		var keepSide = els.wizSide && els.wizSide.parentNode ? els.wizSide : null;
		if (keepSide) { keepSide.parentNode.removeChild(keepSide); }
		clear(w);
		w.classList.toggle('is-last', last);

		var steps = h('ol', { class: 'agh-wiz-steps' });
		WIZ.forEach(function (s, k) {
			steps.appendChild(h('li', null, h('button', {
				type: 'button',
				class: 'agh-wiz-step' + (k === i ? ' is-current' : '') + (k < i ? ' is-done' : ''),
				'aria-current': k === i ? 'step' : null,
				onclick: function () { wizardGo(k); }
			}, h('span', { class: 'agh-wiz-num', 'aria-hidden': 'true' }, k < i ? icon('check', 'agh-ico-s') : String(k + 1)), h('span', { class: 'agh-wiz-steplabel', text: t('wiz_' + s.key) }))));
		});
		var pct = Math.round((i + 1) / WIZ.length * 100);
		w.appendChild(h('div', { class: 'agh-wiz-top' },
			h('nav', { 'aria-label': t('wiz_progress') }, steps),
			h('div', { class: 'agh-wiz-bar', 'aria-hidden': 'true' }, h('i', { style: { width: pct + '%' } }))));

		var content = h('div', { class: 'agh-wiz-content' });
		var title = h('h2', { class: 'agh-wiz-title', tabindex: '-1', text: t('wiz_' + st.key + '_title') });
		content.appendChild(h('div', { class: 'agh-eyebrow', text: tf('wiz_step_of', i + 1, WIZ.length) }));
		content.appendChild(title);
		content.appendChild(h('p', { class: 'agh-wiz-lead', text: t('wiz_' + st.key + '_lead') }));
		if (i === 0 && buildOn()) { content.appendChild(entryChoice()); }
		els.wizDone = null;
		if (last) {
			els.wizDone = h('div', { class: 'agh-wiz-done' });
			content.appendChild(els.wizDone);
		} else {
			var list = h('div', { class: 'agh-wiz-fields' });
			wizFields(st).forEach(function (f) { list.appendChild(renderField(wizView(f))); });
			content.appendChild(list);
		}
		els.wizBody = content;
		els.wizScroll = h('div', { class: 'agh-wiz-scroll' }, content);
		els.wizSide = keepSide || h('aside', { class: 'agh-wiz-side', 'aria-label': t('live_preview') });
		var wmain = h('div', { class: 'agh-wiz-main' }, els.wizScroll, els.wizSide);
		wizSideResizer(wmain);
		w.appendChild(wmain);

		var nav = h('div', { class: 'agh-wiz-nav' });
		nav.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-ghost agh-wiz-back', disabled: i === 0 ? 'disabled' : null, title: t('back'), onclick: function () { wizardGo(i - 1); } }, icon('left', 'agh-ico-s'), h('span', { class: 'agh-btn-label', text: t('back') })));
		nav.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-ghost agh-wiz-full', title: t('wiz_full'), onclick: function () { exitWizard(false); } }, icon('sliders', 'agh-ico-s'), h('span', { class: 'agh-btn-label', text: t('wiz_full') })));
		nav.appendChild(h('div', { class: 'agh-wiz-spacer' }));
		if (last) {
			els.wizGen = h('button', { type: 'button', class: 'agh-btn agh-btn-primary agh-btn-lg agh-wiz-next', onclick: generate }, icon('sparkle', 'agh-ico-s'), S.project ? t('generate_new') : t('generate'));
			nav.appendChild(els.wizGen);
		} else {
			els.wizGen = null;
			nav.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-primary agh-btn-lg agh-wiz-next', onclick: wizardNext }, t('wiz_next'), icon('chev', 'agh-ico-s')));
		}
		w.appendChild(nav);
		updateWizardSide();

		if (focusTitle) {
			els.wizScroll.scrollTop = 0;
			title.focus({ preventScroll: true });
		} else {
			els.wizScroll.scrollTop = scrollTop;
			if (keep) {
				var fw2 = els.wizBody.querySelector('[data-field="' + keep.field + '"]');
				var c2 = fw2 && fw2.querySelectorAll('button, input, select, textarea')[keep.idx];
				if (c2) { c2.focus({ preventScroll: true }); }
			}
		}
	}

	// Live preview + key figures beside the steps (on phones: only on the last step) and the last step's summary.
	function updateWizardSide() {
		if (!S.wiz || !els.wizSide) { return; }
		var c = S.config, side = els.wizSide;
		if (!els.wizPv || !side.contains(els.wizPv)) {
			clear(side);
			els.wizPv = h('div', { class: 'agh-preview-box agh-wiz-preview' });
			els.wizKpis = h('div', { class: 'agh-kpis agh-wiz-kpis' });
			side.appendChild(els.wizPv);
			side.appendChild(els.wizKpis);
		}
		// Key figures first: the preview box takes the remaining height, so it must be measured last.
		fillKpis(els.wizKpis, c);
		// Last step: the large inline preview below takes the live canvas, the side column is hidden.
		if (!els.wizDone) { fillPreview(els.wizPv, c); }
		if (els.wizDone) { renderWizardDone(); }
		if (els.wizGen) {
			var running = S.project && ['queued', 'planning', 'rendering'].indexOf(S.project.status) !== -1;
			var blocked = running || (S.check.errors && S.check.errors.length) || !S.boot.provider.ready;
			els.wizGen.disabled = !!blocked;
			els.wizGen.title = !S.boot.provider.ready ? t('not_configured_visitor') : '';
		}
	}
	function renderWizardDone() {
		// Phones: the side preview is hidden, so the last step shows the preview inline (element reused).
		var dpv = els.wizDone.querySelector('.agh-wiz-done-pv') || h('div', { class: 'agh-preview-box agh-wiz-done-pv' });
		if (dpv.parentNode) { dpv.parentNode.removeChild(dpv); }
		var d = clear(els.wizDone);
		// Large live preview beside (desktop) or above (phone) the summary.
		d.appendChild(fillPreview(dpv, S.config));
		var info = h('div', { class: 'agh-wiz-done-info' });
		d.appendChild(info);
		if (!S.boot.provider.ready) {
			info.appendChild(h('div', { class: 'agh-msg is-warning' }, icon('alert'), h('span', { text: t('not_configured_visitor') })));
		}
		info.appendChild(h('div', { class: 'agh-sum-group' }, h('h5', { text: t('sum_house') }), houseList(S.config)));
		info.appendChild(h('div', { class: 'agh-sum-group' }, h('h5', { text: t('sum_checks') }), checkList()));
		d = info;
		var inWizard = {};
		WIZ.forEach(function (st) { st.fields.forEach(function (id) { inWizard[id] = true; }); });
		var more = S.boot.schema.fields.filter(function (f) { return !inWizard[f.id] && f.type !== 'roomitems' && f.type !== 'layout' && f.type !== 'build' && visible(f); }).length;
		d.appendChild(h('div', { class: 'agh-wiz-more' },
			h('p', { text: tf('wiz_more', more) }),
			h('button', { type: 'button', class: 'agh-btn', onclick: function () { exitWizard(false); } }, icon('sliders', 'agh-ico-s'), t('wiz_to_designer'))));
	}

	/* ------------------------------------------------------------------ generation */
	/* The picture of the 3D model goes with the request, so the image generator follows this very
	 * house. Only the hero (the visitor's own camera) is waited for, and the taking of it starts when
	 * the confirmation dialog opens – by the time the visitor clicks, it is usually ready. The other
	 * views are sent afterwards, in the background, for the gallery. Nothing here can hold up a
	 * generation: without WebGL, on an error or after 15 seconds the request simply goes without them. */
	var guideJob = null;
	// The guide picture is taken in the shape of the finished image (the server measures that from
	// the pictures that come back), so the structure reference is never stretched or cropped.
	function guideSize() {
		var a = Number(S.boot && S.boot.guide && S.boot.guide.aspect) || 1.645;
		a = Math.max(0.5, Math.min(3, a));
		var w = 1152;
		return [w, Math.round(w / a)];
	}
	// How the guide pictures are taken (Settings → Magnific): a clean scene without the simple
	// stand-in shapes, the hero from photographer height, and which rooms get an interior guide –
	// the same rooms, in the same order, that the server renders interiors for.
	function guideRooms() {
		var max = Math.max(0, Math.min(8, Number(S.boot && S.boot.guide && S.boot.guide.rooms) || 4)), out = {}, n = 0;
		(S.config.rooms || []).forEach(function (r) {
			if (!r || !r.render || !r.id || n >= max) { return; }
			var id = String(r.id).toLowerCase().replace(/[^a-z0-9_]/g, '');
			if (!id || out[id]) { return; }
			var o = { id: String(r.id), type: r.type, area: Number(r.area) || 0 };
			['width', 'length', 'ceiling_height', 'interior_style', 'wall_color', 'furniture_color'].forEach(function (k) { if (r[k] !== undefined && r[k] !== '') { o[k] = r[k]; } });
			out[id] = o; n++;
		});
		return out;
	}
	function guideOpts() {
		var g = (S.boot && S.boot.guide) || {};
		return { clean: g.clean !== false, camera: g.camera || 'auto', rooms: guideRooms(), scene: !!g.scene };
	}
	// Beside a clean guide the same views are taken with everything in them ("scene_<view>"): the
	// prompt is written from that picture (1.15.0), so the cars, people and pets the visitor put there
	// are described and painted for real. Taken after the clean ones, never at the same time – both
	// use the same off-screen viewer.
	function sceneShots(views, sz, opts, out) {
		out = out || {};
		if (!opts.scene || !opts.clean || !A3 || !A3.guides) { return Promise.resolve(out); }
		var s = {};
		return A3.guides(views, sz[0], sz[1], s, { clean: false, camera: opts.camera, rooms: {} }).then(function () {
			Object.keys(s).forEach(function (k) { if (k.indexOf('interior_') !== 0) { out['scene_' + k] = s[k]; } });
			return out;
		}).catch(function () { return out; });
	}
	function startGuides() {
		if (!A3 || !A3.guides) { guideJob = null; return; }
		var out = {}, sz = guideSize(), opts = guideOpts();
		try {
			guideJob = { out: out, p: A3.guides(['hero'], sz[0], sz[1], out, opts).catch(function () { return out; }).then(function () { return sceneShots(['hero'], sz, opts, out); }) };
		} catch (e) { guideJob = null; }
	}
	function guideShots() {
		if (!guideJob) { startGuides(); }
		if (!guideJob) { return Promise.resolve(null); }
		var j = guideJob, done = false;
		guideJob = null;
		return new Promise(function (res) {
			var finish = function () { if (!done) { done = true; res(Object.keys(j.out).length ? j.out : null); } };
			setTimeout(finish, 15000);
			j.p.then(finish, finish);
		});
	}
	// The remaining views (front, back, sides, aerial) and the rooms for the gallery: they are taken
	// after the generation has started and uploaded on their own, so they never delay anything.
	function sendRestGuides(uuid) {
		if (!A3 || !A3.guides || !uuid) { return; }
		setTimeout(function () {
			try {
				var sz = guideSize(), opts = guideOpts();
				// every gallery direction gets its own 3D picture (1.17.0: the garden view had none and was invented)
				var views = ['front', 'back', 'left', 'right', 'aerial', 'garden'].concat(Object.keys(opts.rooms).map(function (id) { return 'interior_' + id; }));
				A3.guides(views, sz[0], sz[1], null, opts).then(function (g) {
					return sceneShots(['front', 'back', 'left', 'right', 'aerial', 'garden'], sz, opts, g || {});
				}).then(function (g) {
					if (g && Object.keys(g).length) { api('POST', 'projects/' + uuid + '/guides', { guides: g }, 60000).catch(function () { /* the server draws its own guide */ }); }
				}).catch(function () { /* no guide for the gallery this time */ });
			} catch (e) { /* no WebGL */ }
		}, 1200);
	}
	function generate() {
		// A request is already on its way: say so instead of ignoring the click.
		if (S.busy) { toast(t('status_generating'), 'warn'); return; }
		var lim = S.boot.limits || {};
		var go = function (force) {
			S.busy = true;
			genBusy(true);
			event('design_start');
			// The pictures of the model the visitor built go with the request: the image generator
			// follows this geometry (the hero from the very camera angle on screen).
			guideShots().then(function (guides) {
			api('POST', 'generate', { config: payloadConfig(), force: !!force, guides: guides }, 60000).then(function (r) {
				S.busy = false;
				genBusy(false);
				if (r.limits) { S.boot.limits = r.limits; }
				if (r.reused) { toast(r.message, 'ok', 6000); }
				// Leave the wizard first: its exit re-renders the stage, which would reset the view.
				if (S.wiz) { exitWizard(true); }
				S.projectId = r.project;
				sendRestGuides(r.project);
				S.selected = null;
				S.view = 'concepts';
				S.dirty = false;
				persist();
				setTab('stage');
				loadProject(r.project);
			}).catch(function (err) {
				S.busy = false;
				genBusy(false);
				if (err.status === 503 && err.data && err.data.code === 'agh_not_configured') {
					// No image provider: friendly, translated notice instead of a technical error.
					S.boot.provider.ready = false;
					renderActionbar();
					toast(t('not_configured_visitor'), 'warn', 8000);
					return;
				}
				if (err.data && err.data.check) { S.check = err.data.check; renderSummary(); updateRail(); }
				if (err.data && err.data.limits) { S.boot.limits = err.data.limits; renderSummary(); }
				errToast(err);
			});
			});
		};
		var msg = lim.limit ? tf('confirm_generate', lim.remaining, lim.limit) : t('confirm_generate_nolimit');
		startGuides();   // a látogató olvassa a kérdést, közben elkészül a kép
		confirmDialog(t('generate'), msg, t('generate_go'), function () { go(false); });
	}

	// The generate buttons show that the request is on its way (wizard and action bar).
	function genBusy(on) {
		Array.prototype.forEach.call(root ? root.querySelectorAll('.agh-wiz-next, .agh-actionbar .agh-btn-primary') : [], function (b) {
			if (!b.querySelector('.agh-ico')) { return; }
			b.classList.toggle('is-busy', on);
			if (on) { b.setAttribute('aria-busy', 'true'); } else { b.removeAttribute('aria-busy'); }
		});
	}

	function loadProject(id, quiet) {
		return api('GET', 'projects/' + id).then(function (p) {
			S.project = p;
			S.projectId = p.id;
			var sel = (p.concepts || []).filter(function (c) { return c.selected; })[0];
			S.selected = sel ? sel.id : null;
			if (quiet && S.view === 'design' && p.concepts && p.concepts.length) { S.view = 'concepts'; }
			persist();
			renderStage(); renderSummary(); renderActionbar();
			schedulePoll();
		}).catch(function (err) {
			if (err.status === 404) { S.projectId = null; S.project = null; persist(); }
			if (!quiet) { errToast(err); }
		});
	}
	function needsPoll() {
		var p = S.project;
		if (!p || isStopped(p)) { return false; }
		if (isRunning(p)) { return true; }
		return (p.concepts || []).some(function (c) { return c.gallery_status === 'rendering' || c.gallery_status === 'pending'; });
	}
	function schedulePoll() {
		stopPoll();
		if (!needsPoll() || !root) { S.pollDelay = 3000; return; }
		S.poll = setTimeout(function () {
			var before = JSON.stringify(S.project.progress);
			var prevStatus = S.project.status;
			api('GET', 'projects/' + S.project.id).then(function (p) {
				var hadImages = countImages(S.project);
				S.project = p;
				if (JSON.stringify(p.progress) === before) { S.pollDelay = Math.min(10000, S.pollDelay + 1000); } else { S.pollDelay = 3000; }
				if (countImages(p) !== hadImages || !needsPoll()) { renderStage(); }
				renderSummary(); renderActionbar();
				if (!needsPoll() && ['ready', 'partial'].indexOf(p.status) !== -1) { toast(t('done_toast'), 'ok'); }
				if (p.status === 'failed') { toast(t('failed_toast'), 'error', 8000); }
				if (p.status === 'cancelled' && prevStatus !== 'cancelled') { renderStage(); toast(t('cancelled'), 'warn'); }
				schedulePoll();
			}).catch(function () { S.pollDelay = Math.min(15000, S.pollDelay * 2); schedulePoll(); });
		}, S.pollDelay);
	}
	function countImages(p) { var n = 0; (p.concepts || []).forEach(function (c) { if (c.hero && c.hero.preview) { n++; } (c.assets || []).forEach(function (a) { if (a.preview) { n++; } }); }); return n; }
	function stopPoll() { if (S.poll) { clearTimeout(S.poll); S.poll = null; } }

	function selectConcept(id) {
		api('POST', 'projects/' + S.project.id + '/select', { concept: id }).then(function (p) {
			S.project = p; S.selected = id; S.view = 'gallery'; S.galleryTab = 'exterior'; S.galleryIndex = 0;
			renderStage(); renderSummary(); renderActionbar(); schedulePoll();
			if (S.boot.provider.gallery === 'selected') { toast(t('gallery_started'), 'ok'); }
		}).catch(errToast);
	}

	function rebuildsLeft() {
		var l = S.boot.limits || {};
		return typeof l.gallery_remaining === 'number' ? l.gallery_remaining : null;
	}
	function regenerate(c) {
		var left = rebuildsLeft();
		var msg = t('regenerate_confirm') + (left === null ? '' : ' ' + (left > 0 ? tf('regenerate_left', left) : t('regenerate_none')));
		startGuides();
		confirmDialog(t('regenerate'), msg, t('regenerate_go'), function () {
			guideShots().then(function (guides) {
			api('POST', 'projects/' + S.project.id + '/regenerate', { concept: c.id, config: payloadConfig(), guides: guides }).then(function (p) {
				// One rebuild unit was reserved by the server.
				if (rebuildsLeft() !== null) { S.boot.limits.gallery_remaining = Math.max(0, rebuildsLeft() - 1); }
				S.project = p; renderStage(); renderSummary(); renderActionbar(); schedulePoll(); toast(t('regenerate_started'), 'ok');
			}).catch(function (err) {
				if (err.data && err.data.limits) { S.boot.limits = err.data.limits; }
				errToast(err);
			});
			});
		});
	}

	function cancelGeneration() {
		if (!S.project) { return; }
		var id = S.project.id;
		stopPoll();
		api('POST', 'projects/' + id + '/cancel', {}, 20000).then(function () { return loadProject(id); }).then(function () { toast(t('cancelled'), 'warn'); }).catch(function (err) {
			// The server did not answer (busy or unreachable): stop locally anyway, so the
			// visitor is never locked out – a new generation can start right away.
			if (S.project && S.project.id === id && isRunning(S.project)) { S.project.status = 'cancelled'; }
			S.busy = false;
			renderStage(); renderSummary(); renderActionbar();
			errToast(err);
		});
	}

	function saveProject() {
		if (!S.project) { return; }
		var name = h('input', { class: 'agh-input', value: S.config.project_name || S.project.name || '', maxlength: 120 });
		dialog(t('save_title'), h('div', null, h('p', { class: 'agh-help', text: S.boot.logged_in ? t('save_help_user') : t('save_help_guest') }), h('label', { class: 'agh-label', text: t('project_name') }), name), [
			{ label: t('cancel') },
			{ label: t('save'), cls: 'agh-btn-primary', onclick: function () {
				api('POST', 'projects/' + S.project.id + '/save', { name: name.value }).then(function () { S.dirty = false; S.config.project_name = name.value; persist(); renderActionbar(); toast(t('saved'), 'ok'); }).catch(errToast);
			} }
		]);
	}

	/* ------------------------------------------------------------------ quote */
	function showQuote() {
		var c = conceptById(S.selected);
		if (!c) { toast(t('quote_hint'), 'warn'); return; }
		var projectId = S.project.id;
		// Server-issued form token (anti-bot timing); requested when the form opens, sent back as form_token.
		var tok = { value: '', at: 0 };
		var tokMsg = h('div', { class: 'agh-field-msg is-error agh-form-alert', role: 'alert', hidden: true });
		var submitBtn = null;
		function fetchToken() {
			tok.value = '';
			tokMsg.hidden = true;
			if (submitBtn) { submitBtn.disabled = true; }
			return api('GET', 'projects/' + projectId + '/quote-token').then(function (r) {
				if (!r || !r.token) { throw new Error(t('q_token_error')); }
				tok.value = r.token;
				tok.at = Date.now();
				if (submitBtn) { submitBtn.disabled = false; }
			}).catch(function (err) {
				clear(tokMsg).appendChild(h('span', { text: t('q_token_error') + (err && err.message && err.message !== t('q_token_error') ? ' (' + err.message + ')' : '') + ' ' }));
				tokMsg.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { fetchToken(); } }, icon('refresh', 'agh-ico-s'), t('retry')));
				tokMsg.hidden = false;
			});
		}
		var f = {};
		function inp(key, label, type, req, full) {
			f[key] = h(type === 'textarea' ? 'textarea' : 'input', { class: type === 'textarea' ? 'agh-textarea' : 'agh-input', type: type === 'textarea' ? null : type, name: key, required: req ? 'required' : null, autocomplete: { full_name: 'name', email: 'email', phone: 'tel', city: 'address-level2' }[key] || 'off', maxlength: type === 'textarea' ? 2000 : 190 });
			return h('label', { class: full ? 'agh-full' : null }, h('span', null, label, req ? h('span', { class: 'agh-req', text: ' *' }) : null), f[key], h('span', { class: 'agh-field-msg is-error', hidden: true, 'data-err': key }));
		}
		var grid = h('div', { class: 'agh-form-grid' },
			inp('full_name', t('q_name'), 'text', true),
			inp('email', t('q_email'), 'email', true),
			inp('phone', t('q_phone'), 'tel', true),
			inp('city', t('q_city'), 'text', true),
			inp('site_location', t('q_site'), 'text', false, true),
			inp('start_period', t('q_start'), 'text', false),
			inp('budget', t('q_budget'), 'text', false),
			inp('note', t('q_note'), 'textarea', false, true));
		if (S.config.budget) { f.budget.value = fmt(S.config.budget, 0) + ' Ft'; }
		if (S.config.build_period) { f.start_period.value = S.config.build_period; }
		var hp = h('input', { class: 'agh-hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
		var consents = h('div', { style: { display: 'flex', 'flex-direction': 'column', gap: '8px', 'margin-top': '14px' } });
		var cboxes = {};
		Object.keys(S.boot.consents).forEach(function (k) {
			var d = S.boot.consents[k];
			cboxes[k] = h('input', { type: 'checkbox' });
			consents.appendChild(h('label', { class: 'agh-check', 'data-consent': k }, cboxes[k], h('span', null, d.label, d.required ? h('span', { class: 'agh-req', text: ' *' }) : h('span', { class: 'agh-muted', text: ' (' + t('optional') + ')' }), d.url ? h('span', null, ' ', h('a', { href: d.url, target: '_blank', rel: 'noopener', text: t('read_doc') })) : null)));
		});
		var body = h('div', null,
			h('div', { class: 'agh-list-item', style: { 'margin-bottom': '14px' } }, c.hero && c.hero.preview ? h('img', { src: c.hero.preview, alt: '', style: { width: '96px', 'border-radius': '10px', 'aspect-ratio': '16/10', 'object-fit': 'cover' } }) : null, h('div', { class: 'agh-grow' }, h('b', { text: c.variant + ' – ' + c.title }), h('span', { class: 'agh-small agh-muted', text: t('q_project') + ': ' + S.project.id }))),
			h('p', { class: 'agh-help', text: t('q_intro') }), tokMsg, grid, hp, consents,
			h('p', { class: 'agh-small agh-muted', style: { 'margin-top': '10px' }, text: t('q_data_note') }));
		var dlg = dialog(t('quote_title'), body, [
			{ label: t('cancel') },
			{ label: t('q_submit'), cls: 'agh-btn-primary', keep: true, onclick: function (btn) {
				if (!tok.value) { fetchToken(); return; }
				Array.prototype.forEach.call(body.querySelectorAll('[data-err]'), function (e) { e.hidden = true; });
				Array.prototype.forEach.call(body.querySelectorAll('.agh-check'), function (e) { e.classList.remove('is-error'); });
				btn.disabled = true;
				btn.setAttribute('aria-busy', 'true');
				// The server rejects tokens younger than 3 s or older than 2 h: wait / renew as needed.
				var age = Date.now() - tok.at;
				var ready = age > 110 * 60 * 1000 ? fetchToken().then(function () { return wait(3200); }) : wait(Math.max(0, 3200 - age));
				ready.then(function () {
					if (!document.body.contains(btn)) { return; } // Dialog closed meanwhile: do not submit.
					if (!tok.value) { btn.disabled = true; btn.removeAttribute('aria-busy'); return; }
					send(btn);
				});
			} }
		], true);
		submitBtn = dlg.foot.querySelector('.agh-btn-primary');
		fetchToken();
		function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
		function send(btn) {
			var data = { concept: c.id, website: hp.value, form_token: tok.value, consents: {} };
			Object.keys(f).forEach(function (k) { data[k] = f[k].value.trim(); });
			Object.keys(cboxes).forEach(function (k) { data.consents[k] = cboxes[k].checked; });
			api('POST', 'projects/' + projectId + '/quote', data).then(function (r) {
				var box = clear(dlg.body);
				box.appendChild(h('div', { class: 'agh-success-box' }, h('div', { class: 'agh-success-ico' }, icon('check')), h('h3', { class: 'agh-h', text: t('q_thanks') }), h('p', { text: r.message })));
				clear(dlg.foot).appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-primary', onclick: function () { dlg.close(); } }, t('close')));
				loadProject(projectId);
			}).catch(function (err) {
				btn.disabled = false;
				btn.removeAttribute('aria-busy');
				var errs = (err.data && err.data.errors) || {};
				if (errs.form_token || errs._form) {
					// Form-level rejection (e.g. expired/invalid token): get a fresh token; the next submit waits for its minimum age.
					fetchToken().then(function () {
						if (tok.value && errs.form_token) { clear(tokMsg).appendChild(h('span', { text: errs.form_token })); tokMsg.hidden = false; }
					});
				}
				Object.keys(errs).forEach(function (k) {
					if (k.indexOf('consent_') === 0) { var cb = body.querySelector('[data-consent="' + k.slice(8) + '"]'); if (cb) { cb.classList.add('is-error'); } }
					var el = body.querySelector('[data-err="' + k + '"]');
					if (el) { el.textContent = errs[k]; el.hidden = false; }
				});
				toast(errs._form || errs.form_token || err.message, 'error');
			});
		}
	}

	/* ------------------------------------------------------------------ presets & projects */
	// Preview of a whole preset: the house it gives (3D picture when available, otherwise the sketch).
	function presetVisual(values, photo) {
		var cfg = Object.assign(clone(S.boot.defaults), clone(values || {}));
		cfg.time_of_day = 'golden'; cfg.weather = 'clear'; cfg.season = 'summer'; cfg.camera = 'three_quarter';
		var el = h('span', { class: 'agh-card-vis agh-preset-vis', 'aria-hidden': 'true' });
		var svg = function () { return window.AGH_Sketch ? window.AGH_Sketch.render(cfg, { mini: true, id: 'pv' + (++visSeq) + '_', fit: 'xMidYMid meet' }) : ''; };
		var key = 'preset|' + JSON.stringify(cfg);
		var put = function (url) { el.classList.remove('is-wait'); el.innerHTML = ''; if (url) { el.appendChild(h('img', { src: url, alt: '', decoding: 'async' })); } else { el.innerHTML = svg(); } addPhoto(); };
		function addPhoto() { if (photo) { el.appendChild(h('img', { class: 'agh-preset-photo', src: photo, alt: '', decoding: 'async' })); } }
		if (A3 && lsGet('agh_3d_thumbs', true) !== false) {
			if (THUMBS[key]) { put(THUMBS[key]); }
			else {
				el.classList.add('is-wait');
				var alive = function () { return document.body.contains(el); };
				whenVisible(el, function () { A3.thumb(cfg, 300, 200, 'mini', alive).then(function (url) { if (url) { THUMBS[key] = url; } if (alive()) { put(url); } }); });
			}
		} else { el.innerHTML = svg(); addPhoto(); }
		return el;
	}
	function presetCard(p, onApply, extra) {
		var card = h('div', { class: 'agh-preset' },
			h('button', { type: 'button', class: 'agh-preset-btn', 'aria-label': t('apply') + ': ' + p.name, onclick: onApply },
				presetVisual(p.values, p.image),
				h('span', { class: 'agh-preset-txt' }, h('b', { text: p.name }), p.desc ? h('span', { class: 'agh-small agh-muted', text: p.desc }) : null)));
		if (extra) { card.appendChild(extra); }
		return card;
	}
	function showPresets() {
		var body = h('div', { class: 'agh-preset-grid' });
		(S.boot.schema.presets || []).forEach(function (p) {
			body.appendChild(presetCard(p, function () { applyValues(p.values, true); closeDialogs(); }));
		});
		var mine = lsGet(LS_PRESETS, []);
		var mineGrid = h('div', { class: 'agh-preset-grid' });
		var mineBox = h('div', { style: { 'margin-top': '16px' } }, h('div', { class: 'agh-eyebrow', text: t('my_presets') }), mineGrid);
		function drawMine() {
			clear(mineGrid);
			mine.forEach(function (p, i) {
				mineGrid.appendChild(presetCard(p, function () { S.config = Object.assign(clone(S.boot.defaults), p.values); S.styleApplied = null; applyValues({}, false); closeDialogs(); },
					h('button', { type: 'button', class: 'agh-iconbtn agh-preset-del', 'aria-label': t('delete'), title: t('delete'), onclick: function () { mine.splice(i, 1); lsSet(LS_PRESETS, mine); syncPresets(mine); drawMine(); } }, icon('trash', 'agh-ico-s'))));
			});
			mineBox.style.display = mine.length ? '' : 'none';
		}
		drawMine();
		var nm = h('input', { class: 'agh-input', placeholder: t('preset_name'), maxlength: 80 });
		var add = h('div', { class: 'agh-numrow', style: { 'margin-top': '12px' } }, nm, h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { if (!nm.value.trim()) { return; } mine.unshift({ name: nm.value.trim(), values: clone(S.config) }); mine = mine.slice(0, 20); lsSet(LS_PRESETS, mine); syncPresets(mine); nm.value = ''; drawMine(); toast(t('preset_saved'), 'ok'); } }, icon('plus', 'agh-ico-s'), t('save_as_preset')));
		dialog(t('presets'), h('div', null, body, mineBox, add), [{ label: t('close') }], true);
		if (S.boot.logged_in) {
			api('GET', 'presets').then(function (r) { if (r.presets && r.presets.length && !mine.length) { mine = r.presets; lsSet(LS_PRESETS, mine); drawMine(); } }).catch(function () {});
		}
	}
	function syncPresets(list) { if (S.boot.logged_in) { api('POST', 'presets', { presets: list }).catch(function () {}); } }

	function showProjects() {
		var body = h('div', { class: 'agh-list' });
		var dlg = dialog(t('my_projects'), body, [{ label: t('close') }]);
		function load(focusAfter) {
			clear(body).appendChild(h('div', { class: 'agh-empty' }, h('span', { class: 'agh-spinner' })));
			api('GET', 'projects').then(function (r) {
				clear(body);
				if (!r.items.length) { body.appendChild(h('p', { class: 'agh-muted', text: S.boot.logged_in ? t('no_projects') : t('no_projects_guest') })); }
				r.items.forEach(function (p) { body.appendChild(projectRow(p, load)); });
				if (focusAfter) {
					var f = body.querySelector('button') || dlg.foot.querySelector('button');
					if (f) { f.focus(); }
				}
			}).catch(function (err) {
				clear(body).appendChild(h('p', { class: 'agh-field-msg is-error', role: 'alert', text: (err && err.message) || t('err_network') }));
			});
		}
		load(false);
	}

	/**
	 * One row of "Projektjeim": open + delete with an inline confirmation step.
	 */
	function projectRow(p, reload) {
		var name = p.name || ('#' + p.id.slice(0, 8));
		var actions = h('div', { class: 'agh-list-actions' });
		var msg = h('div', { class: 'agh-field-msg is-error agh-list-msg', role: 'alert', hidden: true });
		var row = h('div', { class: 'agh-list-item agh-project-row' },
			icon('folder'),
			h('div', { class: 'agh-grow' }, h('b', { text: name }), h('span', { class: 'agh-small agh-muted', text: p.created + ' · ' + t('pstatus_' + p.status) })),
			p.has_quote ? h('span', { class: 'agh-badge', text: t('quoted_badge') }) : null,
			p.saved ? h('span', { class: 'agh-badge agh-badge-ok', text: t('saved_badge') }) : null,
			actions, msg);
		var delBtn;
		function drawActions() {
			clear(actions);
			actions.appendChild(h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () {
				closeDialogs();
				api('GET', 'projects/' + p.id).then(function (pr) { S.config = Object.assign(clone(S.boot.defaults), pr.config); S.explicit = {}; S.styleApplied = null; (pr.config._explicit || []).forEach(function (k) { S.explicit[k] = true; }); delete S.config._explicit; S.dirty = false; return loadProject(p.id); }).then(function () { S.view = 'concepts'; renderParams(); renderStage(); validate(); }).catch(errToast);
			} }, t('open')));
			if (p.has_quote) {
				// Server refuses it anyway (409); the wrapper carries the tooltip because disabled buttons get no hover events in every browser.
				actions.appendChild(h('span', { class: 'agh-del-blocked', title: t('delete_blocked_quote') },
					h('button', { type: 'button', class: 'agh-iconbtn agh-iconbtn-s', disabled: 'disabled', 'aria-label': t('delete_project') + ': ' + name + ' – ' + t('delete_blocked_quote') }, icon('trash', 'agh-ico-s'))));
				return;
			}
			delBtn = h('button', { type: 'button', class: 'agh-iconbtn agh-iconbtn-s', 'aria-label': t('delete_project') + ': ' + name, title: t('delete_project'), onclick: askDelete }, icon('trash', 'agh-ico-s'));
			actions.appendChild(delBtn);
		}
		function askDelete() {
			msg.hidden = true;
			actions.hidden = true;
			var no = h('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: cancel }, t('cancel'));
			var yes = h('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-danger-solid', onclick: doDelete }, icon('trash', 'agh-ico-s'), t('delete'));
			var box = h('div', { class: 'agh-inline-confirm', role: 'group', 'aria-label': t('delete_project') + ': ' + name },
				h('p', { text: t('delete_project_confirm') }), no, yes);
			// Escape cancels only this confirmation, not the dialog.
			box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } });
			row.insertBefore(box, msg);
			no.focus();
			function cancel() {
				box.remove();
				actions.hidden = false;
				if (delBtn) { delBtn.focus(); }
			}
			function doDelete() {
				yes.disabled = true; no.disabled = true;
				yes.insertBefore(h('span', { class: 'agh-spinner', style: { width: '12px', height: '12px' } }), yes.firstChild);
				api('DELETE', 'projects/' + p.id).then(function () {
					if (S.projectId === p.id) {
						stopPoll();
						S.project = null; S.projectId = null; S.selected = null; S.view = 'design';
						persist();
						renderStage(); renderSummary(); renderActionbar();
					}
					toast(t('project_deleted'), 'ok');
					reload(true);
				}).catch(function (err) {
					box.remove();
					actions.hidden = false;
					msg.textContent = (err && err.message) || t('err_network');
					msg.hidden = false;
					if (delBtn) { delBtn.focus(); }
				});
			}
		}
		drawActions();
		return row;
	}

	/* ------------------------------------------------------------------ tour */
	function showTour() {
		var steps = S.boot.tour || [];
		if (!steps.length) { return; }
		var i = 0;
		var wrap = h('div', { class: 'agh-dialog-wrap' });
		var card = h('div', { class: 'agh-dialog agh-tour', role: 'dialog', 'aria-modal': 'true' });
		function draw() {
			var s = steps[i];
			clear(card);
			var dots = h('div', { class: 'agh-tour-dots' });
			steps.forEach(function (x, j) { dots.appendChild(h('i', { class: j === i ? 'is-on' : '' })); });
			card.appendChild(h('div', { class: 'agh-dialog-body', style: { padding: '26px 26px 10px' } }, h('div', { class: 'agh-tour-ico' }, icon(s.icon || 'sparkle')), h('h3', { class: 'agh-h', style: { 'font-size': '17px', 'margin-bottom': '8px' }, text: s.title }), h('div', { class: 'agh-muted', html: s.text }), dots));
			card.appendChild(h('div', { class: 'agh-dialog-foot', style: { 'justify-content': 'space-between' } },
				h('button', { type: 'button', class: 'agh-btn agh-btn-ghost', onclick: done, text: t('skip') }),
				h('div', { style: { display: 'flex', gap: '8px' } },
					i > 0 ? h('button', { type: 'button', class: 'agh-btn', onclick: function () { i--; draw(); }, text: t('back') }) : null,
					h('button', { type: 'button', class: 'agh-btn agh-btn-primary', onclick: function () { if (i < steps.length - 1) { i++; draw(); } else { done(); } }, text: i < steps.length - 1 ? t('next') : t('start') }))));
			var b = card.querySelector('.agh-btn-primary'); if (b) { b.focus(); }
		}
		function done() { lsSet('agh_tour_done', true); wrap.remove(); }
		wrap.appendChild(card);
		shell.appendChild(wrap);
		draw();
	}

	/* ------------------------------------------------------------------ full screen */
	// One element at a time can fill the screen: the whole designer, the live preview (3D or 2D) or the
	// enlarged image. The browser's Fullscreen API is used where it works on an element; elsewhere
	// (iPhone Safari) the element covers the window with CSS. Leaving restores the same size and view.
	var FS = { el: null, css: false, hist: false, ignorePop: false, exitedAt: 0, t0: 0, toastsHome: null };
	function fsNativeEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
	function fsNativeOk(el) {
		return !window.AGH_NO_FULLSCREEN && !!(el.requestFullscreen || el.webkitRequestFullscreen)
			&& !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
	}
	function fsButton(getEl, cls) {
		var b = h('button', { type: 'button', class: 'agh-fsbtn ' + (cls || ''), onclick: function (e) { e.stopPropagation(); fsToggle(getEl()); } });
		b._fsGet = getEl;
		fsPaint(b, FS.el && FS.el === getEl());
		return b;
	}
	function fsPaint(b, on) {
		clear(b);
		b.appendChild(icon(on ? 'shrink' : 'expand'));
		b.setAttribute('aria-label', on ? t('fs_exit') : t('fs_enter'));
		b.setAttribute('title', on ? t('fs_exit') : t('fs_enter'));
		b.setAttribute('aria-pressed', on ? 'true' : 'false');
	}
	function fsSyncButtons() {
		if (!root) { return; }
		Array.prototype.forEach.call(root.querySelectorAll('.agh-fsbtn'), function (b) {
			var on = !!(FS.el && b._fsGet && b._fsGet() === FS.el);
			if ((b.getAttribute('aria-pressed') === 'true') !== on) { fsPaint(b, on); }
		});
	}
	// Dialogs and messages open inside the element on screen, otherwise they would stay hidden behind it.
	function fsHost() { return FS.el && FS.el !== root && FS.el.isConnected ? FS.el : shell; }
	function fsToggle(el) {
		if (!el) { return; }
		if (FS.el) { var same = FS.el === el; fsExit(); if (same) { return; } }
		fsEnter(el);
	}
	function fsEnter(el) {
		FS.el = el; FS.t0 = performance.now();
		el.classList.add('is-fs');
		root.classList.add('has-fs');
		if (el !== root && els.toasts && els.toasts.parentNode !== el) { FS.toastsHome = els.toasts.parentNode; el.appendChild(els.toasts); }
		if (fsNativeOk(el)) {
			FS.css = false;
			var p = null;
			try { p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen(); } catch (e) { fsCss(el); }
			if (p && p.catch) { p.catch(function () { if (FS.el === el && !fsNativeEl()) { fsCss(el); } }); }
		} else { fsCss(el); }
		if (S.lb && el === S.lb.el) { var im = el.querySelector('.agh-lightbox-img img'); if (im) { lbFull(im, S.lb.items[S.lb.index]); } }
		fsSyncButtons();
	}
	// Window-filling fallback: the ancestors drop what would trap a fixed element (transform, filter),
	// and a history entry makes the phone's Back button leave the full screen first, not the page.
	function fsCss(el) {
		FS.css = true;
		el.classList.add('is-fs-css');
		root.classList.add('has-fs-css');
		for (var a = el.parentNode; a && a !== document.body; a = a.parentNode) { if (a.classList) { a.classList.add('agh-fs-anc'); } }
		try { if (window.history && history.pushState) { history.pushState({ aghFs: 1 }, ''); FS.hist = true; } } catch (e) { FS.hist = false; }
		fsSyncButtons();
	}
	function fsExit() {
		if (!FS.el) { return; }
		if (!FS.css && fsNativeEl()) {
			// the change event is the usual signal; the promise and a short check cover browsers that miss it
			var chk = function () { if (FS.el && !FS.css && !fsNativeEl()) { fsDone(); } }, pr = null;
			try { pr = (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { fsDone(); return; }
			if (pr && pr.then) { pr.then(chk, chk); }
			setTimeout(chk, 700);
		} else { fsDone(); }
	}
	// The element really left the full screen (button, Esc, the browser's own exit, or it was removed).
	function fsDone() {
		var el = FS.el;
		if (!el) { return; }
		el.classList.remove('is-fs', 'is-fs-css');
		if (root) {
			root.classList.remove('has-fs', 'has-fs-css');
			Array.prototype.forEach.call(document.querySelectorAll('.agh-fs-anc'), function (a) { a.classList.remove('agh-fs-anc'); });
		}
		if (FS.toastsHome && els.toasts) { if (FS.toastsHome.isConnected) { FS.toastsHome.appendChild(els.toasts); } FS.toastsHome = null; }
		FS.el = null; FS.css = false; FS.exitedAt = Date.now();
		if (FS.hist) { FS.hist = false; FS.ignorePop = true; try { history.back(); } catch (e) { FS.ignorePop = false; } }
		fsSyncButtons();
	}
	function onFsChange() {
		if (FS.el && !FS.css && fsNativeEl() !== FS.el) { fsDone(); return; }
		fsSyncButtons();
	}
	document.addEventListener('fullscreenchange', onFsChange);
	document.addEventListener('webkitfullscreenchange', onFsChange);
	window.addEventListener('resize', function () { if (FS.el && !FS.css && !fsNativeEl() && performance.now() - FS.t0 > 500) { fsDone(); } });

	/* ------------------------------------------------------------------ dialogs & toasts */
	function closeDialogs() { Array.prototype.forEach.call(shell.querySelectorAll('.agh-dialog-wrap'), function (d) { d.remove(); }); }
	function dialog(title, content, buttons, wide) {
		var wrap = h('div', { class: 'agh-dialog-wrap', onmousedown: function (e) { if (e.target === wrap) { wrap.remove(); } } });
		var body = h('div', { class: 'agh-dialog-body' }, content);
		var foot = h('div', { class: 'agh-dialog-foot' });
		var api2 = { body: body, foot: foot, close: function () { wrap.remove(); } };
		(buttons || []).forEach(function (b) {
			var btn = h('button', { type: 'button', class: 'agh-btn ' + (b.cls || ''), text: b.label });
			btn.addEventListener('click', function () { if (b.onclick) { b.onclick(btn); } if (!b.keep) { wrap.remove(); } });
			foot.appendChild(btn);
		});
		var d = h('div', { class: 'agh-dialog' + (wide ? ' agh-dialog-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
			h('div', { class: 'agh-dialog-head' }, h('h3', { class: 'agh-h', text: title }), h('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('close'), onclick: function () { wrap.remove(); } }, icon('close'))),
			body, foot);
		wrap.appendChild(d);
		fsHost().appendChild(wrap);
		setTimeout(function () { var f = d.querySelector('input, textarea, .agh-dialog-foot .agh-btn-primary'); if (f) { f.focus(); } }, 30);
		return api2;
	}
	function confirmDialog(title, text, okLabel, onOk) {
		dialog(title, h('p', { text: text }), [{ label: t('cancel') }, { label: okLabel, cls: 'agh-btn-primary', onclick: onOk }]);
	}
	function toast(msg, type, ms) {
		if (!els.toasts) { return; }
		var el = h('div', { class: 'agh-toast is-' + (type || 'ok'), role: type === 'error' ? 'alert' : 'status' }, icon(type === 'error' ? 'error' : (type === 'warn' ? 'alert' : 'check')), h('div', null, msg));
		els.toasts.appendChild(el);
		setTimeout(function () { el.remove(); }, ms || 4500);
	}
	function errToast(err) { toast((err && err.message) || t('err_network'), 'error', 7000); }

	window.AGH_Designer = { open: open, close: close, version: '1.1.0', config: function () { return clone(S.config); }, set: function (patch) { var ks = Object.keys(patch || {}); ks.forEach(function (k, i) { setValue(k, patch[k], i === ks.length - 1); }); }, schema: function () { return S.boot && S.boot.schema ? clone(S.boot.schema) : null; } };
})();
