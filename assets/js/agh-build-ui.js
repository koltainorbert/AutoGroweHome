/*! AutoGroweHome – „Építés az alapoktól” editor (step guide, 2D wall editor, 3D construction stages,
 * bill of materials, checks and rules). Loaded on demand by agh-designer.js; the model lives in
 * agh-build.js (window.AGH_Build). window.AGH_BuildUI = { open(api), close(), onKey(e) }.
 */
(function (root) {
	'use strict';
	var A = null, B = null, st = null, D = {}, NS = 'http://www.w3.org/2000/svg';
	var PHASE3D = 9; // the last construction stage the 3D slider shows (9 = with the roof)
	var STEP_ICON = ['area', 'grid', 'layers', 'bolt', 'tiles', 'wall', 'plan', 'window', 'layers', 'roof', 'window', 'bolt', 'pen', 'tiles', 'sofa', 'tree'];

	function t(k) { return A.t(k); }
	function tf() { return A.tf.apply(null, arguments); }
	function el(tag, a, kids) {
		var e = document.createElement(tag);
		Object.keys(a || {}).forEach(function (k) {
			var v = a[k];
			if (v === null || v === undefined || v === false) { return; }
			if (k === 'text') { e.textContent = v; } else if (k === 'class') { e.className = v; } else if (k.indexOf('on') === 0 && typeof v === 'function') { e.addEventListener(k.slice(2), v); } else { e.setAttribute(k, v === true ? '' : v); }
		});
		(Array.isArray(kids) ? kids : (kids === undefined ? [] : [kids])).forEach(function (c) { if (c === null || c === undefined || c === false) { return; } e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
		return e;
	}
	function sv(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { if (a[k] !== null && a[k] !== undefined) { e.setAttribute(k, a[k]); } }); return e; }
	var NF = {};
	function fmt(v, d) {
		if (v === null || v === undefined || !isFinite(v)) { return '–'; }
		d = d === undefined ? 2 : d;
		var key = d, lang = String((A && A.locale) || document.documentElement.lang || 'hu').replace('_', '-');
		try { NF[key] = NF[key] || new Intl.NumberFormat(lang, { maximumFractionDigits: d, minimumFractionDigits: 0 }); return NF[key].format(v); } catch (e) { return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)); }
	}
	function getP(o, p) { return p.split('.').reduce(function (a, k) { return a === null || a === undefined ? undefined : a[k]; }, o); }
	function setP(o, p, v) { var ks = p.split('.'), last = ks.pop(), cur = o; ks.forEach(function (k) { if (cur[k] === null || typeof cur[k] !== 'object') { cur[k] = {}; } cur = cur[k]; }); cur[last] = v; }
	function cfg() { return A.config(); }
	function num(v, d) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : d; }

	/* ------------------------------------------------------------------ state */
	function open(api) {
		A = api; B = root.AGH_Build;
		var saved = api.config().build;
		var b = saved && saved.walls ? B.normalize(saved) : B.create();
		st = { b: b, step: b.step || 0, tool: 'select', kind: 'ext', otype: 'window', sel: null, lv: 0, view: 'plan', pane: 'panel', phase: 8, undo: [], redo: [], vb: null, draw: null, drag: null, msPhase: null, showAll: false };
		if (st.step === 6) { st.kind = 'part'; }
		if (st.step === 7) { st.tool = 'opening'; }
		build();
		fitView();
		renderAll(true);
	}
	function close() { if (D.ro) { D.ro.disconnect(); } if (D.root && D.root.parentNode) { D.root.parentNode.removeChild(D.root); } window.removeEventListener('resize', onResize); D = {}; st = null; }
	function snapshot() { return JSON.stringify(st.b); }
	function change(fn, opts) {
		opts = opts || {};
		if (!opts.noUndo) { st.undo.push(snapshot()); if (st.undo.length > 80) { st.undo.shift(); } st.redo = []; }
		fn(st.b);
		commit(opts);
	}
	function commit(opts) {
		opts = opts || {};
		st.b = B.normalize(st.b);
		st.b.step = st.step;
		var ol = B.outline(st.b);
		if (ol.closed) { var bb = bbox(ol.outer); st.b.site.house = { x: Math.round(bb.x0) / 1000, y: Math.round(bb.y0) / 1000 }; }
		if (st.sel && !find(st.sel)) { st.sel = null; }
		A.apply(st.b, B.params(st.b, cfg()));
		renderAll(false, opts.keepPanel);
	}
	function undo() { if (!st.undo.length) { return; } st.redo.push(snapshot()); st.b = JSON.parse(st.undo.pop()); commit({ noUndo: true }); }
	function redo() { if (!st.redo.length) { return; } st.undo.push(snapshot()); st.b = JSON.parse(st.redo.pop()); commit({ noUndo: true }); }
	function find(sel) { if (!sel) { return null; } var list = sel.k === 'op' ? st.b.openings : st.b.walls; for (var i = 0; i < list.length; i++) { if (list[i].id === sel.id) { return list[i]; } } return null; }
	function bbox(p) { var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; p.forEach(function (q) { b.x0 = Math.min(b.x0, q[0]); b.y0 = Math.min(b.y0, q[1]); b.x1 = Math.max(b.x1, q[0]); b.y1 = Math.max(b.y1, q[1]); }); return b; }
	function plot() { var c = cfg(); return { w: num(c.plot_width, 20) || 20, d: num(c.plot_length, 40) || 40 }; }

	/* ------------------------------------------------------------------ layout */
	function build() {
		D.root = A.host;
		D.root.innerHTML = '';
		D.top = el('div', { class: 'agh-bld-top' });
		D.steps = el('ol', { class: 'agh-bld-steps', 'aria-label': t('b_steps') });
		D.bar = el('div', { class: 'agh-wiz-bar', 'aria-hidden': 'true' }, el('i'));
		D.top.appendChild(D.steps); D.top.appendChild(D.bar);
		D.panes = el('div', { class: 'agh-seg agh-bld-panes', role: 'tablist', 'aria-label': t('b_view') });
		[['panel', 'b_pane_step'], ['plan', 'b_pane_plan'], ['3d', 'b_pane_3d']].forEach(function (p) {
			D.panes.appendChild(el('button', { type: 'button', role: 'tab', 'data-pane': p[0], onclick: function () { setPane(p[0]); }, text: t(p[1]) }));
		});
		D.main = el('div', { class: 'agh-bld-main' });
		D.panel = el('aside', { class: 'agh-bld-panel', 'aria-label': t('b_panel') });
		D.stage = el('section', { class: 'agh-bld-stage', 'aria-label': t('b_stage') });
		D.main.appendChild(D.panel); D.main.appendChild(D.stage);
		D.nav = el('div', { class: 'agh-wiz-nav agh-bld-nav' });
		D.root.appendChild(D.top); D.root.appendChild(D.panes); D.root.appendChild(D.main); D.root.appendChild(D.nav);
		buildStage();
		window.addEventListener('resize', onResize);
	}
	function onResize() { if (st && st.view === '3d') { show3D(); } }
	function setPane(p) {
		st.pane = p;
		D.root.setAttribute('data-pane', p); // first: the plan must be laid out before it is drawn
		if (p === 'plan' || p === '3d') { setView(p === '3d' ? '3d' : 'plan'); }
		Array.prototype.forEach.call(D.panes.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-pane') === p ? 'true' : 'false'); });
	}
	function renderAll(first, keepPanel) {
		renderSteps();
		if (!keepPanel) { renderPanel(); } else { renderPanelInfo(); }
		renderPlan();
		renderNav();
		if (st.view === '3d') { schedule3D(); }
		if (first) { setPane(st.pane); setView(st.view); }
	}

	/* ------------------------------------------------------------------ step bar */
	function renderSteps() {
		D.steps.innerHTML = '';
		var c = cfg(), doneN = 0;
		B.STEPS.forEach(function (id, i) {
			var s = B.stepState(st.b, i, c), cls = 'agh-bld-step' + (i === st.step ? ' is-current' : '') + (s.done && !s.stale ? ' is-done' : '') + (s.stale ? ' is-stale' : '') + (!s.active ? ' is-later' : '');
			if (s.done && !s.stale) { doneN++; }
			var label = t('b_step_' + id);
			D.steps.appendChild(el('li', null, el('button', {
				type: 'button', class: cls, 'aria-current': i === st.step ? 'step' : null, disabled: s.active ? null : true,
				title: s.active ? label + (s.stale ? ' – ' + t('b_stale') : '') : label + ' – ' + t('b_later'),
				onclick: function () { goStep(i); }
			}, [el('span', { class: 'agh-wiz-num', text: s.done && !s.stale ? '✓' : String(i) }), el('span', { class: 'agh-wiz-steplabel', text: label })])));
		});
		D.bar.firstChild.style.width = Math.round(doneN / B.ACTIVE_STEPS * 100) + '%';
		var cur = D.steps.querySelector('.is-current');
		if (cur && cur.scrollIntoView && D.steps.scrollWidth > D.steps.clientWidth) { var p = cur.parentNode; D.steps.scrollLeft = Math.max(0, p.offsetLeft - D.steps.clientWidth / 2 + p.offsetWidth / 2); }
	}
	function goStep(i) {
		if (i >= B.ACTIVE_STEPS) { return; }
		st.step = i; st.b.step = i; st.sel = null; st.draw = null;
		st.tool = i === 7 ? 'opening' : (i === 5 || i === 6 ? 'wall' : 'select');
		st.kind = i === 6 ? 'part' : 'ext';
		if (st.lv >= st.b.levels.length) { st.lv = 0; }
		if (i <= 8) { st.phase = Math.max(0, i); }
		if (!st.userView || (i === 0) !== (st.lastStep === 0)) { st.userView = false; fitView(); }
		st.lastStep = i;
		if (i === 9) { st.phase = PHASE3D; }
		A.apply(st.b, B.params(st.b, cfg()));
		renderAll();
		if (st.view === '3d') { setPhase(st.phase); }
		var tt = D.panel.querySelector('.agh-bld-title');
		if (tt) { tt.focus({ preventScroll: true }); }
		D.panel.scrollTop = 0;
	}
	function closeStep() {
		var s = B.stepState(st.b, st.step, cfg());
		if (!s.closable) { return; }
		change(function (b) { b.done[st.step] = B.stepSig(b, st.step); }, { noUndo: true });
		if (st.step < B.ACTIVE_STEPS - 1) { goStep(st.step + 1); } else { finish(); }
	}
	function finish() { A.apply(st.b, B.params(st.b, cfg())); A.close(true); }

	/* ------------------------------------------------------------------ the step panel */
	function field(label, input, unit, help) {
		return el('label', { class: 'agh-bld-f' }, [el('span', { class: 'agh-bld-fl', text: label }), el('span', { class: 'agh-bld-fi' }, [input, unit ? el('span', { class: 'agh-bld-unit', text: unit }) : null]), help ? el('span', { class: 'agh-bld-help', text: help }) : null]);
	}
	function numIn(path, opt) {
		opt = opt || {};
		var v = opt.get ? opt.get() : getP(st.b, path);
		var i = el('input', { type: 'number', class: 'agh-input agh-bld-num', 'data-k': path, inputmode: 'decimal', step: opt.step || 0.01, min: opt.min, max: opt.max, value: v === null || v === undefined ? '' : v, placeholder: opt.ph !== undefined ? String(opt.ph) : null, 'aria-label': opt.label || null });
		i.addEventListener('change', function () {
			var raw = i.value.trim(), n = raw === '' ? null : num(raw, null);
			if (n !== null && opt.min !== undefined) { n = Math.max(opt.min, n); }
			if (n !== null && opt.max !== undefined) { n = Math.min(opt.max, n); }
			if (opt.set) { opt.set(n); return; }
			change(function (b) { setP(b, path, n === null && !opt.nullable ? getP(b, path) : n); }, { keepPanel: opt.keep });
		});
		return i;
	}
	function selIn(path, options, opt) {
		opt = opt || {};
		var v = opt.get ? opt.get() : getP(st.b, path);
		var s = el('select', { class: 'agh-select agh-bld-sel', 'data-k': path, 'aria-label': opt.label || null });
		options.forEach(function (o) { s.appendChild(el('option', { value: o[0], selected: String(o[0]) === String(v) ? 'selected' : null, text: o[1] })); });
		s.addEventListener('change', function () { var val = s.value; if (opt.set) { opt.set(val); return; } change(function (b) { setP(b, path, val); }); });
		return s;
	}
	function togIn(path, label) {
		var v = !!getP(st.b, path), id = 'agh-bt-' + path.replace(/\W/g, '-');
		var i = el('input', { type: 'checkbox', id: id, 'data-k': path, checked: v ? 'checked' : null });
		i.addEventListener('change', function () { change(function (b) { setP(b, path, i.checked); }); });
		return el('label', { class: 'agh-switch agh-bld-tog', for: id }, [i, el('span', { class: 'agh-switch-track', 'aria-hidden': 'true' }), el('span', { text: label })]);
	}
	function seg(options, cur, onPick, label) {
		var g = el('div', { class: 'agh-seg agh-bld-seg', role: 'group', 'aria-label': label || null });
		options.forEach(function (o) { g.appendChild(el('button', { type: 'button', 'aria-pressed': o[0] === cur ? 'true' : 'false', 'data-v': o[0], onclick: function () { onPick(o[0]); }, text: o[1] })); });
		return g;
	}
	function group(title, kids, cls) { return el('section', { class: 'agh-bld-group' + (cls ? ' ' + cls : '') }, [title ? el('h3', { class: 'agh-bld-h', text: title }) : null].concat(kids)); }
	function matOpts(kind) { var w = B.defaults().walls || {}; return Object.keys(w).filter(function (k) { return (w[k].kinds || []).indexOf(kind) !== -1; }).map(function (k) { return [k, t('b_mat_' + k)]; }); }
	function tOpts(mat) { var w = (B.defaults().walls || {})[mat] || {}; return (w.t || [0.3]).map(function (x) { return [x, fmt(x * 100, 1) + ' cm']; }); }

	function renderPanel() {
		var ae = document.activeElement, keepK = ae && D.panel.contains(ae) ? ae.getAttribute('data-k') : null;
		var scroll = D.panel.scrollTop;
		D.panel.innerHTML = '';
		var i = st.step, id = B.STEPS[i];
		D.panel.appendChild(el('div', { class: 'agh-eyebrow', text: tf('b_step_n', i, B.ACTIVE_STEPS - 1) }));
		D.panel.appendChild(el('h2', { class: 'agh-bld-title', tabindex: '-1', text: t('b_step_' + id) }));
		D.panel.appendChild(el('p', { class: 'agh-bld-lead', text: t('b_lead_' + id) }));
		var body = el('div', { class: 'agh-bld-body' });
		(STEPUI[i] || function () {})(body);
		D.panel.appendChild(body);
		D.info = el('div', { class: 'agh-bld-info' });
		D.panel.appendChild(D.info);
		renderPanelInfo();
		D.panel.scrollTop = scroll;
		if (keepK) { var n = D.panel.querySelector('[data-k="' + keepK + '"]'); if (n && n.focus) { n.focus({ preventScroll: true }); } }
	}
	// checklist, checks, rules and materials of the step (re-rendered without touching the inputs)
	function renderPanelInfo() {
		if (!D.info) { return; }
		D.info.innerHTML = '';
		var c = cfg(), s = B.stepState(st.b, st.step, c), chk = B.check(st.b);
		var ul = el('ul', { class: 'agh-bld-check', 'aria-label': t('b_checklist') });
		s.items.forEach(function (it) { ul.appendChild(el('li', { class: it.ok ? 'is-ok' : (it.opt ? 'is-opt' : 'is-no') }, [A.icon(it.ok ? 'check' : (it.opt ? 'info' : 'alert'), 'agh-ico-s'), el('span', { text: t('b_ck_' + it.code) })])); });
		D.info.appendChild(group(t('b_checklist'), [ul, s.stale ? el('p', { class: 'agh-bld-note is-warn', text: t('b_stale_note') }) : null]));
		D.info.appendChild(checksBox(chk, c));
		var mats = B.materials(st.b, c), mine = mats.items.filter(function (x) { return st.showAll || x.phase === st.step || (st.step === 5 && x.phase === 6) || (st.step === 9 && x.phase >= 0); });
		if (st.step === 9) { mine = mats.items; }
		D.info.appendChild(materialsBox(mine, mats.ok));
	}
	function checksBox(chk, c) {
		var kids = [], m = B.metrics(st.b, c);
		var ge = chk.errors.length;
		kids.push(el('p', { class: 'agh-bld-stat ' + (ge ? 'is-bad' : 'is-good') }, [A.icon(ge ? 'error' : 'check', 'agh-ico-s'), el('span', { text: ge ? tf('b_geo_errors', ge) : t('b_geo_ok') })]));
		if (ge) { var el2 = el('ul', { class: 'agh-bld-msgs' }); chk.errors.slice(0, 8).forEach(function (e) { el2.appendChild(el('li', { class: 'is-bad', text: t('b_err_' + e.code) + (e.ref ? ' (' + e.ref + ')' : '') })); }); kids.push(el2); }
		chk.warnings.forEach(function (w) { kids.push(el('p', { class: 'agh-bld-note is-warn', text: t('b_warn_' + w.code) })); });
		var pr = B.practice(st.b, c, m).filter(function (p) { return p.status === 'fail'; });
		if (pr.length) { var ul = el('ul', { class: 'agh-bld-msgs' }); pr.forEach(function (p) { ul.appendChild(el('li', { class: 'is-warn', text: t(p.msg) + ' – ' + fmt(p.value) + (p.unit ? ' ' + p.unit : '') + ' (' + p.op + ' ' + fmt(p.limit) + ')' })); }); kids.push(el('h4', { class: 'agh-bld-h4', text: t('b_practice') })); kids.push(ul); }
		var rl = B.rules(st.b, c, m);
		kids.push(el('h4', { class: 'agh-bld-h4', text: t('b_rules') }));
		if (rl.missing) { kids.push(el('p', { class: 'agh-bld-note', text: t('b_rules_missing') })); }
		else if (rl.effective === 'off') { kids.push(el('p', { class: 'agh-bld-note', text: t('b_rules_off') })); }
		else {
			var fails = rl.list.filter(function (r) { return r.status === 'fail'; }), oks = rl.list.filter(function (r) { return r.status === 'ok'; }).length, na = rl.list.filter(function (r) { return r.status === 'na'; }).length;
			kids.push(el('p', { class: 'agh-bld-stat ' + (fails.length ? 'is-warn' : 'is-good') }, [A.icon(fails.length ? 'alert' : 'check', 'agh-ico-s'), el('span', { text: tf('b_rules_sum', fails.length, oks, na) })]));
			var ul2 = el('ul', { class: 'agh-bld-rules' });
			fails.forEach(function (r) { ul2.appendChild(ruleRow(r)); });
			if (fails.length) { kids.push(ul2); }
			kids.push(el('p', { class: 'agh-bld-note is-small', text: tf('b_pack_info', rl.pack, rl.checked) }));
		}
		kids.push(el('p', { class: 'agh-bld-note is-legal' }, [A.icon('info', 'agh-ico-s'), el('span', { text: t('b_not_static') })]));
		return group(t('b_checks'), kids, 'agh-bld-checks');
	}
	function ruleRow(r) {
		var src = r.source || {}, srcText = [src.law, src.ref].filter(Boolean).join(', ');
		return el('li', { class: 'agh-bld-rule is-' + r.status }, [
			el('div', { class: 'agh-bld-rule-top' }, [el('b', { text: t(r.msg) }), r.verified ? null : el('span', { class: 'agh-badge agh-bld-unv', text: t('b_unverified') })]),
			el('div', { class: 'agh-bld-rule-v', text: (r.value === null ? '–' : fmt(r.value)) + ' ' + (r.unit || '') + '  ' + r.op + ' ' + (r.limit === null ? '–' : fmt(r.limit)) + ' ' + (r.unit || '') }),
			srcText ? el('div', { class: 'agh-bld-rule-src', text: t('b_source') + ': ' + srcText + (r.checked ? ' · ' + t('b_checked') + ': ' + r.checked : '') }) : null
		]);
	}
	function itemLabel(it) {
		var m = /^blocks_([a-z_]+)_(\d+)$/.exec(it.id);
		if (m) { return t('b_q_blocks') + ' – ' + t('b_mat_' + m[1]) + ' ' + m[2] + ' cm'; }
		m = /^lintel_(\d+)$/.exec(it.id);
		if (m) { return t('b_q_lintel') + ' ' + fmt(+m[1] / 100) + ' m'; }
		return t('b_q_' + it.id) + (it.note ? ' (' + it.note + ')' : '');
	}
	function materialsBox(items, ok) {
		var kids = [];
		if (!ok) { kids.push(el('p', { class: 'agh-bld-note', text: t('b_mat_need_outline') })); }
		else if (!items.length) { kids.push(el('p', { class: 'agh-bld-note', text: t('b_mat_none') })); }
		else {
			var tb = el('table', { class: 'agh-bld-table' });
			tb.appendChild(el('thead', null, el('tr', null, [el('th', { scope: 'col', text: t('b_mat_item') }), el('th', { scope: 'col', class: 'is-num', text: t('b_mat_qty') }), el('th', { scope: 'col', class: 'is-num', text: t('b_mat_total') })])));
			var body = el('tbody'), last = -1;
			items.forEach(function (it) {
				if (it.phase !== last && (st.showAll || st.step === 9)) { body.appendChild(el('tr', { class: 'agh-bld-tsec' }, el('th', { colspan: '3', scope: 'colgroup', text: it.phase + '. ' + t('b_step_' + B.STEPS[it.phase]) }))); last = it.phase; }
				var unit = t('b_u_' + it.unit);
				body.appendChild(el('tr', null, [el('td', { text: itemLabel(it) }), el('td', { class: 'is-num', text: fmt(it.qty, it.unit === 'db' ? 0 : 2) + ' ' + unit }), el('td', { class: 'is-num', title: tf('b_mat_waste', it.waste), text: fmt(it.total, it.unit === 'db' ? 0 : 2) + ' ' + unit })]));
			});
			tb.appendChild(body);
			kids.push(el('div', { class: 'agh-bld-tablewrap' }, tb));
		}
		var tg = el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', onclick: function () { st.showAll = !st.showAll; renderPanelInfo(); }, text: st.showAll ? t('b_mat_step_only') : t('b_mat_all') });
		kids.push(el('div', { class: 'agh-bld-row' }, [st.step === 9 ? null : tg, el('span', { class: 'agh-bld-note is-small', text: t('b_mat_note') })]));
		return group(t('b_materials'), kids, 'agh-bld-mats');
	}

	// Controls of each step.
	var STEPUI = [
		function site(box) {
			var b = st.b, pk = B.pack(b.site.country), regions = pk ? pk.regions : [];
			var countries = [['hu', t('b_country_hu')], ['xx', t('b_country_other')]];
			var reg = regions.map(function (r) { return [r.id, t('b_reg_' + r.id)]; });
			reg.unshift(['', t('b_choose')]);
			var towns = (regions.filter(function (r) { return r.id === b.site.region; })[0] || {}).towns || [];
			var dl = el('datalist', { id: 'agh-bld-towns' }); towns.forEach(function (tw) { dl.appendChild(el('option', { value: tw })); });
			var town = el('input', { type: 'text', class: 'agh-input', 'data-k': 'site.town', list: 'agh-bld-towns', maxlength: '60', value: b.site.town, autocomplete: 'off' });
			town.addEventListener('change', function () { change(function (bb) { bb.site.town = town.value; }); });
			box.appendChild(group(t('b_g_place'), [
				field(t('b_country'), selIn('site.country', countries)),
				pk ? field(t('b_region'), selIn('site.region', reg)) : el('p', { class: 'agh-bld-note', text: t('b_rules_missing') }),
				field(t('b_town'), town), dl
			]));
			var c = cfg();
			box.appendChild(group(t('b_g_plot'), [
				el('div', { class: 'agh-bld-grid2' }, [
					field(t('b_plot_w'), numIn('plot_width', { get: function () { return num(c.plot_width, 20); }, set: function (v) { if (v > 0) { A.setParam('plot_width', v); renderAll(false, true); } }, min: 5, max: 500, step: 0.5 }), 'm'),
					field(t('b_plot_d'), numIn('plot_length', { get: function () { return num(c.plot_length, 40); }, set: function (v) { if (v > 0) { A.setParam('plot_length', v); renderAll(false, true); } }, min: 5, max: 1000, step: 0.5 }), 'm')
				]),
				placeBox()
			]));
			var frost = pk ? getP(pk, 'climate.frost.value') : null;
			box.appendChild(group(t('b_g_ground'), [el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_frost'), numIn('site.frost', { nullable: true, min: 0.3, max: 2.5, step: 0.05, ph: frost !== null ? fmt(frost) : '' }), 'm', t('b_frost_help')),
				field(t('b_soil'), selIn('site.soil', (B.defaults().soils || []).map(function (s) { return [s, t('b_soil_' + s)]; })))
			])]));
			box.appendChild(rulesBox());
		},
		function earth(box) {
			box.appendChild(group(null, [el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_topsoil'), numIn('earth.topsoil', { min: 0, max: 1, step: 0.05 }), 'm'),
				field(t('b_margin'), numIn('earth.margin', { min: 0, max: 5, step: 0.1 }), 'm', t('b_margin_help')),
				field(t('b_found_d'), numIn('found.d', { min: 0.3, max: 3, step: 0.05 }), 'm', t('b_found_d_help')),
				field(t('b_soil'), selIn('site.soil', (B.defaults().soils || []).map(function (s) { return [s, t('b_soil_' + s)]; })))
			])]));
		},
		function found(box) {
			var types = Object.keys(B.defaults().foundations || {});
			box.appendChild(group(t('b_found_type'), [cards(types.map(function (k) { return [k, t('b_found_' + k)]; }), st.b.found.type, function (v) { change(function (b) { b.found.type = v; }); })]));
			var slab = st.b.found.type === 'slab';
			box.appendChild(group(null, [el('div', { class: 'agh-bld-grid2' }, [
				slab ? null : field(t('b_found_w'), numIn('found.w', { min: 0.2, max: 2, step: 0.05 }), 'm'),
				field(t('b_found_d'), numIn('found.d', { min: 0.3, max: 3, step: 0.05 }), 'm'),
				field(t('b_found_top'), numIn('found.top', { min: 0, max: 1.5, step: 0.05 }), 'm', t('b_found_top_help')),
				slab ? null : field(t('b_found_parts'), selIn('found.partitions', [['auto', t('b_fp_auto')], ['strip', t('b_fp_strip')], ['none', t('b_fp_none')]]))
			])]));
		},
		function ducts(box) {
			box.appendChild(group(null, [togIn('ducts.sewer', t('b_duct_sewer')), togIn('ducts.water', t('b_duct_water')), togIn('ducts.earth', t('b_duct_earth')),
				field(t('b_duct_conduits'), numIn('ducts.conduits', { min: 0, max: 30, step: 1 }), t('b_u_db'))]));
			box.appendChild(el('p', { class: 'agh-bld-note', text: t('b_ducts_note') }));
		},
		function ground(box) {
			box.appendChild(group(null, [el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_fill'), numIn('ground.fill', { min: 0, max: 1, step: 0.05 }), 'm'),
				field(t('b_gconcrete'), numIn('ground.concrete', { min: 0, max: 0.4, step: 0.01 }), 'm'),
				field(t('b_membrane'), selIn('ground.membrane', [['bitumen', t('b_mem_bitumen')], ['pvc', t('b_mem_pvc')], ['none', t('b_mem_none')]])),
				field(t('b_xps'), numIn('ground.xps', { min: 0, max: 0.3, step: 0.01 }), 'm')
			])]));
		},
		function walls(box) {
			box.appendChild(templatesBox());
			box.appendChild(levelsBox());
			box.appendChild(toolsBox(['select', 'wall', 'rect'], true));
			box.appendChild(selectionBox());
		},
		function parts(box) {
			box.appendChild(levelSwitch());
			box.appendChild(toolsBox(['select', 'wall', 'rect'], false));
			box.appendChild(selectionBox());
			box.appendChild(roomsBox());
		},
		function openings(box) {
			box.appendChild(levelSwitch());
			var tb = toolsBox(['select', 'opening'], false);
			box.appendChild(tb);
			box.appendChild(group(t('b_otype'), [seg(B.OPENING_TYPES.map(function (k) { return [k, t('b_op_' + k)]; }), st.otype, function (v) { st.otype = v; st.tool = 'opening'; renderPanel(); renderPlan(); }, t('b_otype'))]));
			box.appendChild(selectionBox());
			box.appendChild(el('p', { class: 'agh-bld-note', text: t('b_op_hint') }));
		},
		function slab(box) {
			var types = Object.keys(B.defaults().slabs || {});
			box.appendChild(group(t('b_slab_type'), [cards(types.map(function (k) { return [k, t('b_slab_' + k)]; }), st.b.slab.type, function (v) { change(function (b) { b.slab.type = v; var tt = ((B.defaults().slabs || {})[v] || {}).t; if (tt && tt.indexOf(b.slab.t) === -1) { b.slab.t = tt[Math.floor(tt.length / 2)]; } }); })]));
			box.appendChild(group(null, [el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_slab_t'), numIn('slab.t', { min: 0.1, max: 0.4, step: 0.01 }), 'm'),
				field(t('b_ring_h'), numIn('ring.h', { min: 0.15, max: 0.6, step: 0.01 }), 'm'),
				field(t('b_ring_insul'), numIn('ring.insul', { min: 0, max: 0.15, step: 0.01 }), 'm')
			])]));
			if (st.b.levels.length > 1) {
				var on = !!st.b.slab.stair, kids = [el('label', { class: 'agh-switch agh-bld-tog' }, [el('input', { type: 'checkbox', 'data-k': 'slab.stair', checked: on ? 'checked' : null, onchange: function (e) { var ck = e.target.checked; change(function (b) { if (ck) { var ol = B.outline(b), bb = ol.closed ? bbox(ol.inner) : { x0: 0, y0: 0 }; b.slab.stair = { x: Math.round(bb.x0 / 100) / 10 + 0.3, y: Math.round(bb.y0 / 100) / 10 + 0.3, w: 1.1, d: 3.2 }; } else { b.slab.stair = null; } }); } }), el('span', { class: 'agh-switch-track', 'aria-hidden': 'true' }), el('span', { text: t('b_stair_hole') })])];
				if (on) { kids.push(el('div', { class: 'agh-bld-grid2' }, [field('X', numIn('slab.stair.x', { step: 0.05 }), 'm'), field('Y', numIn('slab.stair.y', { step: 0.05 }), 'm'), field(t('b_w'), numIn('slab.stair.w', { min: 0.6, max: 6, step: 0.05 }), 'm'), field(t('b_d'), numIn('slab.stair.d', { min: 0.6, max: 8, step: 0.05 }), 'm')])); }
				box.appendChild(group(t('b_stair_hole'), kids));
			}
		},
		function roof(box) {
			var ol = B.outline(st.b), okRoof = ol.closed && ol.ortho;
			box.appendChild(el('p', { class: 'agh-bld-stat ' + (okRoof ? 'is-good' : 'is-bad') }, [A.icon(okRoof ? 'check' : 'alert', 'agh-ico-s'), el('span', { text: okRoof ? t('b_roof_ok') : (ol.closed ? t('b_warn_roof_ortho') : t('b_err_ext_open')) })]));
			var rt = A.field('roof_type'), c = cfg();
			if (rt && rt.options) { box.appendChild(group(rt.label, [cards(rt.options.map(function (o) { return [o.value, o.label]; }), c.roof_type, function (v) { A.setParam('roof_type', v); renderAll(); })])); }
			var rp = A.field('roof_pitch');
			if (rp && c.roof_type !== 'flat') { box.appendChild(group(null, [field(rp.label, numIn('roof_pitch', { get: function () { return num(c.roof_pitch, 35); }, set: function (v) { if (v !== null) { A.setParam('roof_pitch', v); renderAll(false, true); } }, min: rp.min || 5, max: rp.max || 60, step: 1 }), '°')])); }
			box.appendChild(el('p', { class: 'agh-bld-note', text: t('b_roof_note') }));
			box.appendChild(el('div', { class: 'agh-bld-row' }, el('button', { type: 'button', class: 'agh-btn agh-btn-primary', onclick: finish }, [A.icon('check', 'agh-ico-s'), t('b_finish')])));
		}
	];
	function cards(opts, cur, onPick) {
		var g = el('div', { class: 'agh-bld-cards', role: 'group' });
		opts.forEach(function (o) { g.appendChild(el('button', { type: 'button', class: 'agh-bld-card', 'aria-pressed': String(o[0]) === String(cur) ? 'true' : 'false', 'data-v': o[0], onclick: function () { onPick(o[0]); }, text: o[1] })); });
		return g;
	}
	function placeBox() {
		var ol = B.outline(st.b), p = plot();
		if (!ol.closed) { return el('p', { class: 'agh-bld-note', text: t('b_place_later') }); }
		var bb = bbox(ol.outer), x0 = bb.x0 / 1000, y0 = bb.y0 / 1000, x1 = bb.x1 / 1000, y1 = bb.y1 / 1000;
		function move(dx, dy) { change(function (b) { b.walls.forEach(function (w) { w.a = [w.a[0] + dx, w.a[1] + dy]; w.b = [w.b[0] + dx, w.b[1] + dy]; }); if (b.slab.stair) { b.slab.stair.x += dx; b.slab.stair.y += dy; } }); }
		return el('div', { class: 'agh-bld-grid2' }, [
			field(t('b_set_side'), numIn('place.x', { get: function () { return Math.round(x0 * 100) / 100; }, set: function (v) { if (v !== null) { move(v - x0, 0); } }, step: 0.1 }), 'm'),
			field(t('b_set_back'), numIn('place.y', { get: function () { return Math.round(y0 * 100) / 100; }, set: function (v) { if (v !== null) { move(0, v - y0); } }, step: 0.1 }), 'm'),
			el('p', { class: 'agh-bld-note is-small', text: tf('b_set_front', fmt(p.d - y1), fmt(p.w - x1)) })
		]);
	}
	function rulesBox() {
		var b = st.b, pk = B.pack(b.site.country), kids = [];
		kids.push(seg([['on', t('b_rules_on')], ['off', t('b_rules_off_s')], ['custom', t('b_rules_custom')]], b.rules.mode, function (v) { change(function (bb) { bb.rules.mode = v; }); }, t('b_rules_apply')));
		kids.push(el('p', { class: 'agh-bld-note is-small', text: pk ? tf('b_pack_info', pk.pkg, pk.checked) : t('b_rules_missing') }));
		var hz = [['coverage', '%'], ['height', 'm'], ['front', 'm'], ['side', 'm'], ['back', 'm'], ['pitch_min', '°'], ['pitch_max', '°']];
		var grid = el('div', { class: 'agh-bld-grid2' });
		hz.forEach(function (h) { grid.appendChild(field(t('b_hesz_' + h[0]), numIn('rules.hesz.' + h[0], { nullable: true, min: 0, step: h[1] === '%' ? 1 : 0.1 }), h[1])); });
		var src = el('input', { type: 'text', class: 'agh-input', 'data-k': 'rules.hesz.source', maxlength: '160', value: b.rules.hesz.source, placeholder: t('b_hesz_source_ph') });
		src.addEventListener('change', function () { change(function (bb) { bb.rules.hesz.source = src.value; }); });
		kids.push(el('details', { class: 'agh-bld-details', open: b.rules.mode !== 'off' && Object.keys(b.rules.hesz).some(function (k) { return k !== 'source' && b.rules.hesz[k] !== null; }) ? 'open' : null }, [el('summary', { text: t('b_hesz') }), el('p', { class: 'agh-bld-note is-small', text: t('b_hesz_help') }), grid, field(t('b_hesz_source'), src)]));
		if (pk && b.rules.mode === 'custom') {
			var list = el('ul', { class: 'agh-bld-custom' });
			pk.rules.forEach(function (r) {
				var cu = b.rules.custom[r.id] || { on: true, value: null };
				var ck = el('input', { type: 'checkbox', 'data-k': 'rc.' + r.id, checked: cu.on !== false ? 'checked' : null, 'aria-label': t(r.msg) });
				ck.addEventListener('change', function () { change(function (bb) { var o = bb.rules.custom[r.id] || { on: true, value: null }; o.on = ck.checked; bb.rules.custom[r.id] = o; }); });
				var v = numIn('rules.custom.' + r.id + '.value', { nullable: true, step: 0.01, label: t(r.msg), ph: r.value !== null ? fmt(r.value) : '', get: function () { return cu.value; }, set: function (n) { change(function (bb) { var o = bb.rules.custom[r.id] || { on: true, value: null }; o.value = n; bb.rules.custom[r.id] = o; }); } });
				list.appendChild(el('li', null, [el('label', { class: 'agh-bld-cu' }, [ck, el('span', { text: t(r.msg) })]), el('span', { class: 'agh-bld-fi' }, [v, el('span', { class: 'agh-bld-unit', text: r.unit })])]));
			});
			kids.push(list);
		}
		kids.push(el('p', { class: 'agh-bld-note is-legal' }, [A.icon('info', 'agh-ico-s'), el('span', { text: t('b_rules_legal') })]));
		return group(t('b_rules_apply'), kids);
	}
	function templatesBox() {
		var p = plot();
		function place(w, d) { return [Math.max(0.5, Math.round((p.w - w) / 2 * 10) / 10), Math.max(0.5, Math.round((p.d - d - 6) * 10) / 10)]; }
		function apply(make) {
			var go = function () {
				change(function (b) { var r = make(); b.walls = r.walls; b.openings = r.openings || []; b.guessed = r.guessed || []; if (r.levels) { b.levels = r.levels; b.attic = !!r.attic; } b.done = {}; });
				st.sel = null; fitView(); renderPlan();
			};
			if (st.b.walls.length) { A.confirm(t('b_tpl_replace_title'), t('b_tpl_replace'), t('b_tpl_replace_go'), go); } else { go(); }
		}
		var ext = (B.defaults().model || {}).wall || {}, et = (ext.ext || {}).t || 0.38;
		var W = el('input', { type: 'number', class: 'agh-input agh-bld-num', 'data-k': 'tpl.w', value: '10', min: '4', max: '40', step: '0.1', inputmode: 'decimal', 'aria-label': t('b_w') });
		var Dd = el('input', { type: 'number', class: 'agh-input agh-bld-num', 'data-k': 'tpl.d', value: '8', min: '4', max: '30', step: '0.1', inputmode: 'decimal', 'aria-label': t('b_d') });
		var row = el('div', { class: 'agh-bld-tpl' }, [
			field(t('b_w'), W, 'm'), field(t('b_d'), Dd, 'm'),
			el('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { var w = num(W.value, 10), d = num(Dd.value, 8), o = place(w, d); apply(function () { return { walls: B.rectWalls(o[0] + et / 2, o[1] + et / 2, w - et, d - et, et) }; }); } }, [A.icon('plus', 'agh-ico-s'), t('b_tpl_rect')]),
			el('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { var w = num(W.value, 10), d = num(Dd.value, 8), o = place(w, d + 3), x = o[0] + et / 2, y = o[1] + et / 2, ww = w - et, dd = d - et, w2 = Math.max(3, Math.round(ww * 0.4 * 10) / 10); apply(function () { return { walls: B.polyWalls([[x, y], [x + ww, y], [x + ww, y + dd + 3], [x + ww - w2, y + dd + 3], [x + ww - w2, y + dd], [x, y + dd]], et) }; }); } }, [A.icon('plus', 'agh-ico-s'), t('b_tpl_l')])
		]);
		var kids = [row, el('div', { class: 'agh-bld-row' }, [
			el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', onclick: function () { apply(function () { var r = B.fromHouse(cfg(), root.AGH_Sketch), p2 = plot(), bb = bbox([].concat.apply([], r.walls.map(function (w) { return [w.a, w.b]; }))), dx = Math.round(((p2.w - (bb.x1 - bb.x0)) / 2 - bb.x0) * 10) / 10, dy = Math.round((p2.d - (bb.y1 - bb.y0) - 6 - bb.y0) * 10) / 10; r.walls.forEach(function (w) { w.a = [w.a[0] + dx, w.a[1] + dy]; w.b = [w.b[0] + dx, w.b[1] + dy]; }); return { walls: r.walls, openings: r.openings, guessed: r.guessed, levels: r.levels, attic: r.attic }; }); } }, [A.icon('home', 'agh-ico-s'), t('b_from_house')]),
			st.b.walls.length ? el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', onclick: function () { A.confirm(t('b_clear'), t('b_clear_confirm'), t('b_clear'), function () { change(function (b) { b.walls = []; b.openings = []; b.done = {}; }); st.sel = null; }); } }, [A.icon('trash', 'agh-ico-s'), t('b_clear')]) : null
		])];
		if (st.b.guessed.length) { kids.push(el('p', { class: 'agh-bld-note is-warn', text: t('b_guessed') + ': ' + st.b.guessed.map(function (g) { return t('b_gs_' + g); }).join(', ') })); }
		return group(t('b_start'), kids);
	}
	function levelsBox() {
		var b = st.b, kids = [];
		kids.push(field(t('b_levels'), selIn('levels.n', [[1, '1'], [2, '2'], [3, '3']], { get: function () { return b.levels.length; }, set: function (v) { change(function (bb) { var n = +v; while (bb.levels.length < n) { bb.levels.push({ h: bb.levels[bb.levels.length - 1].h }); } bb.levels = bb.levels.slice(0, n); if (n > 1) { bb.attic = false; } }); } })));
		var g = el('div', { class: 'agh-bld-grid2' });
		b.levels.forEach(function (l, i) { g.appendChild(field(tf('b_level_h', i === 0 ? t('b_lv0') : tf('b_lvn', i)), numIn('levels.' + i + '.h', { min: 2.4, max: 4.5, step: 0.05 }), 'm', i === 0 ? t('b_level_h_help') : null)); });
		kids.push(g);
		if (b.levels.length === 1) { kids.push(togIn('attic', t('b_attic'))); }
		return group(t('b_g_levels'), kids);
	}
	function levelSwitch() {
		if (st.b.levels.length < 2) { return el('span'); }
		return group(null, [seg(st.b.levels.map(function (l, i) { return [i, i === 0 ? t('b_lv0') : tf('b_lvn', i)]; }), st.lv, function (v) { st.lv = v; st.sel = null; renderPanel(); renderPlan(); }, t('b_level'))]);
	}
	function toolsBox(tools, kinds) {
		var kids = [seg(tools.map(function (k) { return [k, t('b_tool_' + k)]; }), st.tool, function (v) { st.tool = v; st.draw = null; renderPanel(); renderPlan(); }, t('b_tool'))];
		if (kinds) { kids.push(seg([['ext', t('b_kind_ext')], ['int', t('b_kind_int')]], st.kind, function (v) { st.kind = v; st.tool = st.tool === 'select' ? 'wall' : st.tool; renderPanel(); renderPlan(); }, t('b_kind'))); }
		if (kinds && st.kind === 'int' && st.b.levels.length > 1) { kids.push(levelSwitch()); }
		kids.push(el('p', { class: 'agh-bld-note is-small', text: t('b_hint_' + st.tool) }));
		return group(t('b_tool'), kids);
	}
	function selectionBox() {
		var o = find(st.sel);
		if (!o) { return group(t('b_selection'), [el('p', { class: 'agh-bld-note', text: t('b_sel_none') })]); }
		var kids = [];
		if (st.sel.k === 'wall') {
			var w = o, len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), path = function (k) { return 'walls.' + st.b.walls.indexOf(w) + '.' + k; };
			kids.push(el('p', { class: 'agh-bld-sel-h' }, [el('b', { text: t('b_kind_' + w.kind) }), ' · ' + w.id]));
			kids.push(el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_len'), numIn('sel.len', { get: function () { return Math.round(len * 100) / 100; }, set: function (v) { if (!(v > 0.2)) { return; } change(function (b) { var ww = b.walls.filter(function (q) { return q.id === w.id; })[0], ux = (ww.b[0] - ww.a[0]) / len, uy = (ww.b[1] - ww.a[1]) / len, old = ww.b.slice(); ww.b = [Math.round((ww.a[0] + ux * v) * 100) / 100, Math.round((ww.a[1] + uy * v) * 100) / 100]; moveJoined(b, old, ww.b, ww.id); }); }, min: 0.2, step: 0.01 }), 'm'),
				field(t('b_thick'), selIn(path('t'), tOpts(w.mat))),
				field(t('b_mat'), selIn(path('mat'), matOpts(w.kind), { set: function (v) { change(function (b) { var ww = b.walls.filter(function (q) { return q.id === w.id; })[0], ts = ((B.defaults().walls || {})[v] || {}).t || [ww.t]; ww.mat = v; if (ts.indexOf(ww.t) === -1) { ww.t = ts[Math.min(ts.length - 1, 1)]; } }); } })),
				w.kind !== 'part' ? field(t('b_kind'), selIn(path('kind'), [['ext', t('b_kind_ext')], ['int', t('b_kind_int')]])) : null
			]));
			if (w.kind === 'ext') {
				var ins = Object.keys(B.defaults().insulations || {}).map(function (k) { return [k, t('b_ins_' + k)]; });
				kids.push(el('div', { class: 'agh-bld-grid2' }, [field(t('b_insul'), selIn(path('insul'), ins)), w.insul !== 'none' ? field(t('b_insul_t'), numIn(path('insul_t'), { min: 0, max: 0.4, step: 0.01 }), 'm') : null]));
				kids.push(el('p', { class: 'agh-bld-note is-small', text: tf('b_u_value', fmt(B.wallU(st.b, w), 3)) }));
			}
			kids.push(el('p', { class: 'agh-bld-note is-small', text: tf('b_coords', fmt(w.a[0]), fmt(w.a[1]), fmt(w.b[0]), fmt(w.b[1])) }));
		} else {
			var op = o, wall = st.b.walls.filter(function (q) { return q.id === op.wall; })[0], ip = function (k) { return 'openings.' + st.b.openings.indexOf(op) + '.' + k; };
			var li = wall ? B.lintel(st.b, wall, op) : null;
			kids.push(el('p', { class: 'agh-bld-sel-h' }, [el('b', { text: t('b_op_' + op.type) }), ' · ' + op.id + (wall ? ' · ' + wall.id : '')]));
			kids.push(el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_op_type'), selIn(ip('type'), B.OPENING_TYPES.map(function (k) { return [k, t('b_op_' + k)]; }))),
				field(t('b_op_at'), numIn(ip('at'), { step: 0.01 }), 'm', t('b_op_at_help')),
				field(t('b_w'), numIn(ip('w'), { min: 0.3, max: 8, step: 0.01 }), 'm'),
				field(t('b_h'), numIn(ip('h'), { min: 0.3, max: 4, step: 0.01 }), 'm'),
				op.type === 'window' ? field(t('b_sill'), numIn(ip('sill'), { min: 0, max: 3, step: 0.01 }), 'm') : null,
				field(t('b_lintel'), selIn(ip('lintel'), B.LINTELS.map(function (k) { return [k, t('b_li_' + k)]; })))
			]));
			if (li) { kids.push(el('p', { class: 'agh-bld-note is-small', text: li.pcs ? tf('b_lintel_info', li.pcs, fmt(li.len)) : t('b_lintel_frame') })); }
		}
		kids.push(el('div', { class: 'agh-bld-row' }, el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-bld-del', onclick: delSel }, [A.icon('trash', 'agh-ico-s'), t('b_delete')])));
		return group(t('b_selection'), kids);
	}
	function roomsBox() {
		var rs = B.rooms(st.b, st.lv), types = A.roomTypes();
		if (!rs.length) { return group(t('b_rooms'), [el('p', { class: 'agh-bld-note', text: t('b_rooms_none') })]); }
		var ul = el('ul', { class: 'agh-bld-roomlist' });
		var defs = A.defaultRoomTypes(rs);
		rs.forEach(function (r, i) {
			var s = el('select', { class: 'agh-select agh-bld-sel', 'data-k': 'room.' + r.key, 'aria-label': t('b_room_type') });
			var cur = r.type || defs[i];
			types.forEach(function (o) { s.appendChild(el('option', { value: o[0], selected: o[0] === cur ? 'selected' : null, text: o[1] })); });
			s.addEventListener('change', function () { change(function (b) { b.rooms[r.key] = s.value; }); });
			ul.appendChild(el('li', null, [el('span', { class: 'agh-bld-room-a', text: fmt(r.area / 1e6, 1) + ' m²' }), s]));
		});
		return group(t('b_rooms'), [ul]);
	}
	function delSel() {
		var sel = st.sel;
		if (!sel) { return; }
		change(function (b) {
			if (sel.k === 'wall') { b.walls = b.walls.filter(function (w) { return w.id !== sel.id; }); b.openings = b.openings.filter(function (o) { return o.wall !== sel.id; }); }
			else { b.openings = b.openings.filter(function (o) { return o.id !== sel.id; }); }
		});
		st.sel = null; renderPanel();
	}
	// moves the ends of the other walls that were joined at `from` along with it
	function moveJoined(b, from, to, skip) {
		b.walls.forEach(function (w) {
			if (w.id === skip) { return; }
			['a', 'b'].forEach(function (k) { if (Math.abs(w[k][0] - from[0]) < 0.005 && Math.abs(w[k][1] - from[1]) < 0.005) { w[k] = to.slice(); } });
		});
	}

	/* ------------------------------------------------------------------ bottom bar */
	function renderNav() {
		D.nav.innerHTML = '';
		var s = B.stepState(st.b, st.step, cfg());
		D.nav.appendChild(el('button', { type: 'button', class: 'agh-btn agh-btn-ghost agh-bld-exit', title: t('b_to_designer'), onclick: function () { A.close(false); } }, [A.icon('home', 'agh-ico-s'), el('span', { class: 'agh-btn-label', text: t('b_to_designer') })]));
		D.nav.appendChild(el('p', { class: 'agh-bld-legal', text: t('b_not_static_short') }));
		D.nav.appendChild(el('span', { class: 'agh-wiz-spacer' }));
		D.nav.appendChild(el('button', { type: 'button', class: 'agh-btn agh-btn-ghost agh-bld-back', title: t('back'), disabled: st.step === 0 ? true : null, onclick: function () { goStep(st.step - 1); } }, [A.icon('left', 'agh-ico-s'), el('span', { class: 'agh-btn-label', text: t('back') })]));
		var last = st.step === B.ACTIVE_STEPS - 1;
		D.nav.appendChild(el('button', { type: 'button', class: 'agh-btn agh-btn-primary agh-bld-next', disabled: s.closable ? null : true, title: s.closable ? null : t('b_cannot_close'), onclick: closeStep }, [el('span', { text: last ? t('b_finish') : t('b_close_step') }), A.icon(last ? 'check' : 'chev', 'agh-ico-s')]));
	}

	/* ------------------------------------------------------------------ stage: plan editor + 3D */
	function buildStage() {
		D.stage.innerHTML = '';
		D.tabs = el('div', { class: 'agh-bld-stagebar' });
		D.viewSeg = seg([['plan', t('b_view_plan')], ['3d', t('b_view_3d')]], st.view, function (v) { setView(v); }, t('b_view'));
		D.tools = el('div', { class: 'agh-bld-quick' }, [
			el('button', { type: 'button', class: 'agh-iconbtn', title: t('b_undo'), 'aria-label': t('b_undo'), onclick: undo }, A.icon('restart')),
			el('button', { type: 'button', class: 'agh-iconbtn agh-bld-redo', title: t('b_redo'), 'aria-label': t('b_redo'), onclick: redo }, A.icon('restart')),
			el('button', { type: 'button', class: 'agh-iconbtn agh-bld-zoomout', title: t('b_zoom_out'), 'aria-label': t('b_zoom_out'), onclick: function () { zoomBy(1.25); } }, el('span', { class: 'agh-bld-zoomtxt', 'aria-hidden': 'true', text: '−' })),
			el('button', { type: 'button', class: 'agh-iconbtn agh-bld-zoomin', title: t('b_zoom_in'), 'aria-label': t('b_zoom_in'), onclick: function () { zoomBy(1 / 1.25); } }, el('span', { class: 'agh-bld-zoomtxt', 'aria-hidden': 'true', text: '+' })),
			el('button', { type: 'button', class: 'agh-iconbtn', title: t('b_fit'), 'aria-label': t('b_fit'), onclick: function () { st.userView = false; fitView(); renderPlan(); } }, A.icon('expand'))
		]);
		D.tabs.appendChild(D.viewSeg); D.tabs.appendChild(D.tools);
		D.planWrap = el('div', { class: 'agh-bld-planwrap' });
		D.svg = sv('svg', { class: 'agh-bld-svg', role: 'application', 'aria-label': t('b_plan_aria'), tabindex: '0', preserveAspectRatio: 'xMidYMid meet' });
		D.planWrap.appendChild(D.svg);
		D.status = el('div', { class: 'agh-bld-status', 'aria-live': 'polite' });
		D.planWrap.appendChild(D.status);
		D.view3 = el('div', { class: 'agh-bld-3d agh-preview-box', hidden: true });
		D.phaseBar = el('div', { class: 'agh-bld-phase', hidden: true });
		D.stage.appendChild(D.tabs); D.stage.appendChild(D.planWrap); D.stage.appendChild(D.view3); D.stage.appendChild(D.phaseBar);
		bindPlan();
		// redraw when the plan gets its size (pane switch on phones, window resize): labels stay pixel-sized
		if (window.ResizeObserver) { D.ro = new ResizeObserver(function () { var r = D.svg.getBoundingClientRect(); if (st && st.view === 'plan' && r.width > 1 && r.height > 1) { if (!st.userView) { fitView(); } renderPlan(); } }); D.ro.observe(D.planWrap); }
	}
	function setView(v) {
		st.view = v;
		Array.prototype.forEach.call(D.viewSeg.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false'); });
		D.planWrap.hidden = v !== 'plan'; D.view3.hidden = v !== '3d'; D.phaseBar.hidden = v !== '3d';
		D.tools.hidden = v !== 'plan';
		if (st.pane === 'plan' || st.pane === '3d') { st.pane = v; D.root.setAttribute('data-pane', v); Array.prototype.forEach.call(D.panes.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-pane') === v ? 'true' : 'false'); }); }
		if (v === '3d') { renderPhaseBar(); show3D(); } else { renderPlan(); }
	}
	var t3 = 0;
	function schedule3D() { clearTimeout(t3); t3 = setTimeout(function () { if (st && st.view === '3d') { show3D(); } }, 250); }
	function show3D() {
		var ok = A.preview3D(D.view3, cfg(), st.phase);
		D.view3.classList.toggle('is-2d', !ok);
		if (!ok) { D.view3.innerHTML = A.sketch(cfg()); D.view3.appendChild(el('p', { class: 'agh-bld-note agh-bld-no3d', text: t('b_no3d') })); }
	}
	function setPhase(p) {
		st.phase = p;
		var t0 = (window.performance || Date).now();
		A.setPhase(p);
		st.msPhase = Math.round(((window.performance || Date).now() - t0) * 10) / 10;
		D.view3.setAttribute('data-phase', p); D.view3.setAttribute('data-phase-ms', st.msPhase);
		renderPhaseBar();
	}
	function renderPhaseBar() {
		D.phaseBar.innerHTML = '';
		var id = 'agh-bld-ph', r = el('input', { type: 'range', id: id, class: 'agh-range agh-bld-range', min: '0', max: String(PHASE3D), step: '1', value: String(st.phase), 'aria-valuetext': t('b_step_' + B.STEPS[st.phase]) });
		r.style.setProperty('--agh-fill', (st.phase / PHASE3D * 100) + '%');
		r.addEventListener('input', function () { r.style.setProperty('--agh-fill', (+r.value / PHASE3D * 100) + '%'); setPhase(+r.value); });
		var ticks = el('div', { class: 'agh-bld-ticks', 'aria-hidden': 'true' });
		for (var i = 0; i <= PHASE3D; i++) { ticks.appendChild(el('span', { class: i === st.phase ? 'is-on' : null, text: String(i) })); }
		D.phaseBar.appendChild(el('label', { class: 'agh-bld-phase-l', for: id }, [el('span', { text: t('b_phase') }), el('b', { text: st.phase + '. ' + t('b_step_' + B.STEPS[st.phase]) })]));
		D.phaseBar.appendChild(r); D.phaseBar.appendChild(ticks);
	}

	// view box in metres (x right, y down = towards the street)
	// What the drawing shows first: the house with a margin (the plot on the site step or while there is
	// nothing drawn yet). The box takes the shape of the drawing area, so the house fills it.
	function fitView() {
		var p = plot(), x0 = 0, y0 = 0, x1 = p.w, y1 = p.d, pts = [], m = 1.2;
		st.b.walls.forEach(function (w) { pts.push(w.a, w.b); });
		if (pts.length && st.step !== 0) { var bb = bbox(pts); x0 = bb.x0; y0 = bb.y0; x1 = bb.x1; y1 = bb.y1; m = Math.max(1.2, Math.max(x1 - x0, y1 - y0) * 0.12); }
		else if (pts.length) { var b2 = bbox(pts); x0 = Math.min(b2.x0, 0); y0 = Math.min(b2.y0, 0); x1 = Math.max(b2.x1, p.w); y1 = Math.max(b2.y1, p.d); }
		var w = x1 - x0 + 2 * m, h = y1 - y0 + 2 * m + 0.8, r = D.svg ? D.svg.getBoundingClientRect() : null;
		if (r && r.width > 40 && r.height > 40) { var ar = r.width / r.height; if (w / h < ar) { var nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { var nh = w / ar; y0 -= (nh - h) / 2; h = nh; } }
		st.vb = { x: x0 - m, y: y0 - m, w: w, h: h };
	}
	// zoom around the middle of what is on screen (f < 1: closer)
	function zoomBy(f) {
		var vb = st.vb, w = Math.max(3, Math.min(400, vb.w * f)), h2 = vb.h * w / vb.w, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
		st.vb = { x: cx - w / 2, y: cy - h2 / 2, w: w, h: h2 }; st.userView = true;
		renderPlan();
	}
	function pxPerM() { var r = D.svg.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? Math.min(r.width / st.vb.w, r.height / st.vb.h) : 30; }
	function renderPlan() {
		if (!D.svg || !st) { return; }
		var s = D.svg, vb = st.vb, k = pxPerM(), b = st.b, p = plot(), lv = st.lv;
		while (s.firstChild) { s.removeChild(s.firstChild); }
		s.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].map(function (v) { return Math.round(v * 1000) / 1000; }).join(' '));
		s.setAttribute('data-tool', st.tool);
		var lw = 1 / k; // one screen pixel in metres
		// grid
		// the grid covers what is actually on screen (the view box is letterboxed into the panel)
		var rc = s.getBoundingClientRect(), ok = rc.width > 1 && rc.height > 1 && k > 0, ex = ok ? Math.min(60, Math.max(0, (rc.width / k - vb.w) / 2)) : 0, ey = ok ? Math.min(60, Math.max(0, (rc.height / k - vb.h) / 2)) : 0;
		var g = sv('g', { class: 'agh-bld-grid' });
		var gx0 = Math.floor(vb.x - ex), gx1 = Math.ceil(vb.x + vb.w + ex), gy0 = Math.floor(vb.y - ey), gy1 = Math.ceil(vb.y + vb.h + ey), d1 = '', d2 = '';
		if (k * 0.1 >= 6) { for (var x = gx0; x <= gx1; x += 0.1) { d1 += 'M' + r3(x) + ' ' + gy0 + 'V' + gy1; } for (var y = gy0; y <= gy1; y += 0.1) { d1 += 'M' + gx0 + ' ' + r3(y) + 'H' + gx1; } }
		for (var x2 = gx0; x2 <= gx1; x2++) { d2 += 'M' + x2 + ' ' + gy0 + 'V' + gy1; }
		for (var y2 = gy0; y2 <= gy1; y2++) { d2 += 'M' + gx0 + ' ' + y2 + 'H' + gx1; }
		if (d1) { g.appendChild(sv('path', { d: d1, class: 'agh-bld-g1', 'stroke-width': lw })); }
		g.appendChild(sv('path', { d: d2, class: 'agh-bld-g2', 'stroke-width': lw }));
		s.appendChild(g);
		// plot and street
		s.appendChild(sv('rect', { x: 0, y: 0, width: p.w, height: p.d, class: 'agh-bld-plot', 'stroke-width': 2 * lw, 'stroke-dasharray': (8 * lw) + ' ' + (5 * lw) }));
		var street = label(p.w / 2, p.d + 0.7, lw, { class: 'agh-bld-street', 'font-size': 12, 'text-anchor': 'middle' }); street.t.textContent = t('b_street'); s.appendChild(street.g);
		// rooms of the level
		var rs = B.rooms(b, lv), defs = A.defaultRoomTypes(rs), names = {};
		A.roomTypes().forEach(function (o) { names[o[0]] = o[1]; });
		var gr = sv('g', { class: 'agh-bld-rooms' });
		rs.forEach(function (r, i) {
			gr.appendChild(sv('polygon', { points: r.net.map(function (q) { return r3(q[0] / 1000) + ',' + r3(q[1] / 1000); }).join(' '), class: 'agh-bld-room r' + (i % 6) }));
			var fs = Math.max(12, Math.min(15, Math.sqrt(r.area / 1e6) * 3));
			var lb = label(r.cx / 1000, r.cy / 1000, lw, { class: 'agh-bld-rlabel', 'font-size': fs, 'text-anchor': 'middle' });
			var nm = names[r.type || defs[i]] || '', roomPx = (r.bbox.x1 - r.bbox.x0) / 1000 * k - 8;
			if (nm.length * fs * 0.58 > roomPx) { nm = nm.length * fs * 0.58 * 0.6 > roomPx ? '' : nm.split(/\s*\+\s*|\s+/)[0]; }
			var t1 = sv('tspan', { x: 0, dy: -0.2 * fs }); t1.textContent = nm;
			var t2 = sv('tspan', { x: 0, dy: 1.2 * fs, class: 'agh-bld-rarea' }); t2.textContent = fmt(r.area / 1e6, 1) + ' m²';
			lb.t.appendChild(t1); lb.t.appendChild(t2); gr.appendChild(lb.g);
		});
		s.appendChild(gr);
		// stair hole
		if (b.slab.stair && b.levels.length > 1 && st.step >= 8) { var sh = b.slab.stair; s.appendChild(sv('rect', { x: sh.x, y: sh.y, width: sh.w, height: sh.d, class: 'agh-bld-stair', 'stroke-width': lw })); }
		// walls (other levels faint)
		var gw = sv('g', { class: 'agh-bld-walls' }), chk = B.check(b), bad = {};
		chk.errors.forEach(function (e) { String(e.ref || '').split(',').forEach(function (id) { if (id) { bad[id] = 1; } }); });
		var ends = {};
		b.walls.forEach(function (w) { [w.a, w.b].forEach(function (q) { var key = q[0].toFixed(2) + ',' + q[1].toFixed(2); ends[key] = (ends[key] || 0) + 1; }); });
		b.walls.forEach(function (w) {
			var on = w.kind === 'ext' || w.lv === lv;
			var poly = wallPoly(w, ends);
			var cls = 'agh-bld-wall k-' + w.kind + (on ? '' : ' is-other') + (st.sel && st.sel.k === 'wall' && st.sel.id === w.id ? ' is-sel' : '') + (bad[w.id] ? ' is-bad' : '');
			gw.appendChild(sv('polygon', { points: poly, class: cls, 'data-wall': w.id, 'stroke-width': lw }));
		});
		s.appendChild(gw);
		// openings of the level
		var go = sv('g', { class: 'agh-bld-ops' });
		b.openings.forEach(function (o) {
			if (o.lv !== lv) { return; }
			var w = b.walls.filter(function (q) { return q.id === o.wall; })[0];
			if (!w) { return; }
			go.appendChild(opShape(w, o, lw, bad[o.id], st.sel && st.sel.k === 'op' && st.sel.id === o.id));
		});
		s.appendChild(go);
		// length labels of the walls on this level
		if (k > 8) {
			var gl = sv('g', { class: 'agh-bld-dims' }), cxs = 0, cys = 0, nW = 0;
			b.walls.forEach(function (w) { if (w.kind === 'ext') { cxs += w.a[0] + w.b[0]; cys += w.a[1] + w.b[1]; nW += 2; } });
			cxs = nW ? cxs / nW : 0; cys = nW ? cys / nW : 0;
			b.walls.forEach(function (w) {
				if (!(w.kind === 'ext' || w.lv === lv)) { return; }
				var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
				if (L * k < 46) { return; }
				var ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, nx = -uy, ny = ux, off = w.t / 2 + 10 * lw;
				// external walls: the length outside the house; inner walls: on their left side
				if (w.kind === 'ext' && nW && nx * ((w.a[0] + w.b[0]) / 2 - cxs) + ny * ((w.a[1] + w.b[1]) / 2 - cys) < 0) { nx = -nx; ny = -ny; }
				var mx = (w.a[0] + w.b[0]) / 2 + nx * off, my = (w.a[1] + w.b[1]) / 2 + ny * off, ang = Math.atan2(uy, ux) * 180 / Math.PI;
				if (ang > 90 || ang < -90) { ang += 180; }
				var tt = label(mx, my, lw, { class: 'agh-bld-dim', 'font-size': 11.5, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, ang);
				tt.t.textContent = fmt(L, 2);
				gl.appendChild(tt.g);
			});
			s.appendChild(gl);
		}
		// handles of the selected wall
		var sw = st.sel && st.sel.k === 'wall' ? find(st.sel) : null;
		if (sw && (sw.kind === 'ext' || sw.lv === lv)) { [['a', sw.a], ['b', sw.b]].forEach(function (hq) { s.appendChild(sv('circle', { cx: hq[1][0], cy: hq[1][1], r: 7 * lw, class: 'agh-bld-handle', 'data-end': hq[0], 'stroke-width': 2 * lw })); }); }
		// drawing in progress
		if (st.draw && st.draw.p0 && st.draw.p1) {
			var d0 = st.draw.p0, dp = st.draw.p1;
			if (st.tool === 'rect') { s.appendChild(sv('rect', { x: Math.min(d0[0], dp[0]), y: Math.min(d0[1], dp[1]), width: Math.abs(dp[0] - d0[0]), height: Math.abs(dp[1] - d0[1]), class: 'agh-bld-ghost', 'stroke-width': 2 * lw })); }
			else { s.appendChild(sv('line', { x1: d0[0], y1: d0[1], x2: dp[0], y2: dp[1], class: 'agh-bld-ghost', 'stroke-width': 2 * lw })); }
			var gl2 = Math.hypot(dp[0] - d0[0], dp[1] - d0[1]);
			var lab = label(dp[0] + 10 * lw, dp[1] - 10 * lw, lw, { class: 'agh-bld-ghostlabel', 'font-size': 12 }); lab.t.textContent = st.tool === 'rect' ? fmt(Math.abs(dp[0] - d0[0])) + ' × ' + fmt(Math.abs(dp[1] - d0[1])) + ' m' : fmt(gl2) + ' m'; s.appendChild(lab.g);
		}
		if (st.cursor) { s.appendChild(sv('circle', { cx: st.cursor[0], cy: st.cursor[1], r: 4 * lw, class: 'agh-bld-cursor' })); }
		D.status.textContent = st.cursor ? 'X ' + fmt(st.cursor[0]) + ' m · Y ' + fmt(st.cursor[1]) + ' m' + (st.snapTo ? ' · ' + t('b_snap_' + st.snapTo) : '') : t('b_hint_' + st.tool);
	}
	function r3(v) { return Math.round(v * 1000) / 1000; }
	// Text in screen pixels at a plan point: the label lives in a group scaled by one pixel in metres,
	// so the browser lays out a normal 12 px font (tiny fractional font sizes in metres get garbled).
	function label(x, y, lw, attrs, rot) {
		var g = sv('g', { transform: 'translate(' + r3(x) + ' ' + r3(y) + ') scale(' + lw + ')' + (rot ? ' rotate(' + r3(rot) + ')' : '') });
		var tx = sv('text', Object.assign({ x: 0, y: 0 }, attrs));
		g.appendChild(tx);
		return { g: g, t: tx };
	}
	function wallPoly(w, ends) {
		var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, nx = -uy * w.t / 2, ny = ux * w.t / 2;
		var ea = ends[w.a[0].toFixed(2) + ',' + w.a[1].toFixed(2)] > 1 ? w.t / 2 : 0, eb = ends[w.b[0].toFixed(2) + ',' + w.b[1].toFixed(2)] > 1 ? w.t / 2 : 0;
		var a = [w.a[0] - ux * ea, w.a[1] - uy * ea], b = [w.b[0] + ux * eb, w.b[1] + uy * eb];
		return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]].map(function (q) { return r3(q[0]) + ',' + r3(q[1]); }).join(' ');
	}
	function opShape(w, o, lw, bad, sel) {
		var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, nx = -uy, ny = ux, h = w.t / 2;
		var p0 = [w.a[0] + ux * o.at, w.a[1] + uy * o.at], p1 = [p0[0] + ux * o.w, p0[1] + uy * o.w];
		var g = sv('g', { class: 'agh-bld-op t-' + o.type + (sel ? ' is-sel' : '') + (bad ? ' is-bad' : ''), 'data-op': o.id });
		var pt = function (q, s) { return r3(q[0] + nx * s) + ',' + r3(q[1] + ny * s); };
		g.appendChild(sv('polygon', { points: [pt(p0, h + 0.005), pt(p1, h + 0.005), pt(p1, -h - 0.005), pt(p0, -h - 0.005)].join(' '), class: 'agh-bld-opgap', 'stroke-width': lw }));
		if (o.type === 'window' || o.type === 'terrace') {
			var d = 'M' + pt(p0, h * 0.35) + 'L' + pt(p1, h * 0.35) + 'M' + pt(p0, -h * 0.35) + 'L' + pt(p1, -h * 0.35);
			if (o.type === 'terrace') { var mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; d += 'M' + pt(mid, h * 0.35) + 'L' + pt(mid, -h * 0.35); }
			g.appendChild(sv('path', { d: d, class: 'agh-bld-opline', 'stroke-width': 1.4 * lw }));
		} else {
			// door leaf and swing towards the inside (the side away from the street for external walls)
			var sgn = 1, leaf = Math.min(o.w, 1.2);
			var tip = [p0[0] + nx * sgn * (h + leaf), p0[1] + ny * sgn * (h + leaf)], base = [p0[0] + nx * sgn * h, p0[1] + ny * sgn * h];
			var end = [p0[0] + ux * leaf + nx * sgn * h, p0[1] + uy * leaf + ny * sgn * h];
			g.appendChild(sv('path', { d: 'M' + r3(base[0]) + ',' + r3(base[1]) + 'L' + r3(tip[0]) + ',' + r3(tip[1]) + 'A' + r3(leaf) + ' ' + r3(leaf) + ' 0 0 ' + (sgn > 0 ? 1 : 0) + ' ' + r3(end[0]) + ',' + r3(end[1]), class: 'agh-bld-opline' + (o.type === 'entrance' ? ' is-main' : ''), 'stroke-width': (o.type === 'entrance' ? 2 : 1.3) * lw, fill: 'none' }));
		}
		return g;
	}

	/* ------------------------------------------------------------------ pointer input */
	function toWorld(e) {
		var m = D.svg.getScreenCTM();
		if (!m) { return [0, 0]; }
		var p = D.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
		var q = p.matrixTransform(m.inverse());
		return [q.x, q.y];
	}
	function nearestEnd(p, tol, skip) {
		var best = null, bd = tol;
		st.b.walls.forEach(function (w) {
			if (!(w.kind === 'ext' || w.lv === st.lv) || w.id === skip) { return; }
			[w.a, w.b].forEach(function (q) { var d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q.slice(); } });
		});
		return best;
	}
	function nearestWall(p, tol, onlyLevel) {
		var best = null, bd = Infinity;
		st.b.walls.forEach(function (w) {
			if (onlyLevel && !(w.kind === 'ext' || w.lv === st.lv)) { return; }
			var L2 = (w.b[0] - w.a[0]) * (w.b[0] - w.a[0]) + (w.b[1] - w.a[1]) * (w.b[1] - w.a[1]);
			if (!L2) { return; }
			var u = ((p[0] - w.a[0]) * (w.b[0] - w.a[0]) + (p[1] - w.a[1]) * (w.b[1] - w.a[1])) / L2;
			u = Math.max(0, Math.min(1, u));
			var qx = w.a[0] + (w.b[0] - w.a[0]) * u, qy = w.a[1] + (w.b[1] - w.a[1]) * u, d = Math.hypot(p[0] - qx, p[1] - qy) - w.t / 2;
			if (d < tol && d < bd) { bd = d; best = { w: w, u: u, q: [qx, qy], L: Math.sqrt(L2) }; }
		});
		return best;
	}
	function snapPt(p, from, free) {
		var k = pxPerM(), tol = 12 / k, g = B.defaults().grid || 0.1;
		st.snapTo = null;
		var e = nearestEnd(p, tol);
		if (e) { st.snapTo = 'end'; return e; }
		if (from && !free) { if (Math.abs(p[0] - from[0]) > Math.abs(p[1] - from[1])) { p = [p[0], from[1]]; } else { p = [from[0], p[1]]; } }
		var nw = nearestWall(p, tol, true);
		if (nw && !(from && nw.u > 0 && nw.u < 1 && false)) {
			var w = nw.w, dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
			if (dx === 0 || dy === 0 || !from) {
				var q = dy === 0 ? [Math.round(p[0] / g) * g, w.a[1]] : (dx === 0 ? [w.a[0], Math.round(p[1] / g) * g] : nw.q);
				if (from && !free && (q[0] !== from[0] && q[1] !== from[1])) { /* keep the right angle */ } else { st.snapTo = 'wall'; return [r2(q[0]), r2(q[1])]; }
			}
		}
		st.snapTo = 'grid';
		var out = [r2(Math.round(p[0] / g) * g), r2(Math.round(p[1] / g) * g)];
		if (from && !free) { if (out[1] !== from[1] && Math.abs(p[1] - from[1]) < 1e-9) { out[1] = from[1]; } if (out[0] !== from[0] && Math.abs(p[0] - from[0]) < 1e-9) { out[0] = from[0]; } }
		return out;
	}
	function r2(v) { return Math.round(v * 100) / 100; }
	function newWall(a, b2) {
		var kind = st.step === 6 ? 'part' : st.kind, md = ((B.defaults().model || {}).wall || {})[kind] || {};
		var w = { id: B.nextId(st.b.walls, 'w'), kind: kind, lv: kind === 'ext' ? 0 : st.lv, a: a, b: b2, t: md.t || 0.3, mat: md.mat || 'ceramic' };
		if (kind === 'ext') { w.insul = md.insul || 'eps'; w.insul_t = md.insul_t || 0.12; }
		return w;
	}
	function bindPlan() {
		var s = D.svg, pts = {}, pinch = null;
		s.addEventListener('pointerdown', function (e) {
			s.focus({ preventScroll: true });
			pts[e.pointerId] = [e.clientX, e.clientY];
			if (Object.keys(pts).length === 2) { var ks = Object.keys(pts), a = pts[ks[0]], c = pts[ks[1]]; pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]), vb: Object.assign({}, st.vb), mid: toWorld({ clientX: (a[0] + c[0]) / 2, clientY: (a[1] + c[1]) / 2 }) }; st.drag = null; return; }
			try { s.setPointerCapture(e.pointerId); } catch (er) { /* old browsers */ }
			var p = toWorld(e), k = pxPerM();
			if (e.button === 1 || e.button === 2 || (e.button === 0 && (e.altKey || st.space))) { st.drag = { pan: true, x: e.clientX, y: e.clientY, vb: Object.assign({}, st.vb) }; e.preventDefault(); return; }
			var target = e.target, endEl = target && target.getAttribute && target.getAttribute('data-end');
			if (st.tool === 'select') {
				if (endEl) { var w0 = find(st.sel); st.drag = { end: endEl, wall: w0.id, from: w0[endEl].slice(), snap: snapshot() }; return; }
				var hit = hitTest(p, 8 / k);
				st.sel = hit; renderPanel(); renderPlan();
				if (hit) { var o = find(hit); st.drag = { move: hit, p0: p, orig: JSON.parse(JSON.stringify(o)), snap: snapshot() }; }
				else { st.drag = { pan: true, x: e.clientX, y: e.clientY, vb: Object.assign({}, st.vb) }; }
				return;
			}
			if (st.tool === 'opening') {
				var nw = nearestWall(p, 10 / k, true);
				if (!nw) { var hit2 = hitTest(p, 8 / k); st.sel = hit2; renderPanel(); renderPlan(); return; }
				var dop = ((B.defaults().model || {}).opening || {})[st.otype] || { w: 1, h: 1.5, sill: 0.9 }, at = r2(Math.max(0, nw.u * nw.L - dop.w / 2));
				var op = { id: B.nextId(st.b.openings, 'o'), wall: nw.w.id, lv: nw.w.kind === 'ext' ? st.lv : nw.w.lv, type: st.otype, at: r2(Math.round(at * 10) / 10), w: dop.w, h: dop.h, sill: dop.sill || 0, lintel: 'auto' };
				change(function (b) { b.openings.push(op); });
				st.sel = { k: 'op', id: op.id }; renderPanel(); renderPlan();
				return;
			}
			// wall / rect
			var q = snapPt(p, st.tool === 'wall' && st.draw ? st.draw.p0 : null, e.shiftKey);
			if (st.tool === 'rect') { st.draw = { p0: q, p1: q, rect: true }; return; }
			if (!st.draw) { st.draw = { p0: q, p1: q, start: q }; renderPlan(); return; }
			if (q[0] === st.draw.p0[0] && q[1] === st.draw.p0[1]) { st.draw = null; renderPlan(); return; }
			var w = newWall(st.draw.p0, q), closing = st.draw.start && q[0] === st.draw.start[0] && q[1] === st.draw.start[1];
			change(function (b) { b.walls.push(w); }, { keepPanel: true });
			st.draw = closing ? null : { p0: q, p1: q, start: st.draw.start };
			renderPlan();
		});
		s.addEventListener('pointermove', function (e) {
			if (pts[e.pointerId]) { pts[e.pointerId] = [e.clientX, e.clientY]; }
			if (pinch && Object.keys(pts).length === 2) {
				var ks = Object.keys(pts), a = pts[ks[0]], c = pts[ks[1]], d = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1, f = pinch.d / d;
				var w = Math.max(3, Math.min(400, pinch.vb.w * f)), hh = pinch.vb.h * w / pinch.vb.w;
				st.userView = true; st.vb = { x: pinch.mid[0] - (pinch.mid[0] - pinch.vb.x) * w / pinch.vb.w, y: pinch.mid[1] - (pinch.mid[1] - pinch.vb.y) * hh / pinch.vb.h, w: w, h: hh };
				renderPlan(); return;
			}
			var p = toWorld(e);
			if (st.drag && st.drag.pan) {
				var k = pxPerM();
				st.userView = true; st.vb = Object.assign({}, st.drag.vb, { x: st.drag.vb.x - (e.clientX - st.drag.x) / k, y: st.drag.vb.y - (e.clientY - st.drag.y) / k });
				renderPlan(); return;
			}
			if (st.drag && st.drag.end) {
				var q = snapPt(p, null, true), w0 = st.b.walls.filter(function (x) { return x.id === st.drag.wall; })[0];
				if (w0) { var other = st.drag.end === 'a' ? w0.b : w0.a; if (!e.shiftKey) { q = Math.abs(q[0] - other[0]) > Math.abs(q[1] - other[1]) ? [q[0], other[1]] : [other[0], q[1]]; } var from = w0[st.drag.end].slice(); w0[st.drag.end] = q; moveJoined(st.b, from, q, w0.id); }
				st.drag.moved = true; renderPlan(); return;
			}
			if (st.drag && st.drag.move) {
				var o = find(st.drag.move), dx = p[0] - st.drag.p0[0], dy = p[1] - st.drag.p0[1], g = B.defaults().grid || 0.1;
				if (!o) { return; }
				if (st.drag.move.k === 'wall') {
					var od = st.drag.orig, ddx = Math.round(dx / g) * g, ddy = Math.round(dy / g) * g;
					if (od.a[1] === od.b[1]) { ddx = 0; } else if (od.a[0] === od.b[0]) { ddy = 0; }
					var na = [r2(od.a[0] + ddx), r2(od.a[1] + ddy)], nb = [r2(od.b[0] + ddx), r2(od.b[1] + ddy)];
					moveJoined(st.b, o.a, na, o.id); moveJoined(st.b, o.b, nb, o.id); o.a = na; o.b = nb;
				} else {
					var w1 = st.b.walls.filter(function (x) { return x.id === o.wall; })[0];
					if (w1) { var L = Math.hypot(w1.b[0] - w1.a[0], w1.b[1] - w1.a[1]) || 1, du = (dx * (w1.b[0] - w1.a[0]) + dy * (w1.b[1] - w1.a[1])) / L; o.at = r2(Math.round((st.drag.orig.at + du) / 0.05) * 0.05); }
				}
				st.drag.moved = true; renderPlan(); return;
			}
			if (st.tool === 'wall' || st.tool === 'rect') {
				st.cursor = snapPt(p, st.tool === 'wall' && st.draw ? st.draw.p0 : null, e.shiftKey);
				if (st.draw) { st.draw.p1 = st.cursor; }
				renderPlan();
			}
		});
		function up(e) {
			delete pts[e.pointerId];
			if (pinch) { if (Object.keys(pts).length < 2) { pinch = null; } return; }
			try { s.releasePointerCapture(e.pointerId); } catch (er) { /* fine */ }
			if (st.drag && (st.drag.end || st.drag.move) && st.drag.moved) { st.undo.push(st.drag.snap); st.redo = []; commit(); }
			if (st.tool === 'rect' && st.draw && st.draw.rect) {
				var a = st.draw.p0, c = st.draw.p1;
				if (Math.abs(c[0] - a[0]) >= 0.5 && Math.abs(c[1] - a[1]) >= 0.5) {
					var x0 = Math.min(a[0], c[0]), y0 = Math.min(a[1], c[1]), x1 = Math.max(a[0], c[0]), y1 = Math.max(a[1], c[1]), q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
					change(function (b) { for (var i = 0; i < 4; i++) { var w = newWall(q[i], q[(i + 1) % 4]); w.id = B.nextId(b.walls, 'w'); b.walls.push(w); } }, { keepPanel: true });
				}
				st.draw = null; renderPlan();
			}
			st.drag = null;
		}
		s.addEventListener('pointerup', up);
		s.addEventListener('pointercancel', up);
		s.addEventListener('pointerleave', function () { if (!st.draw) { st.cursor = null; renderPlan(); } });
		s.addEventListener('dblclick', function () { if (st.draw) { st.draw = null; renderPlan(); } });
		s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
		s.addEventListener('wheel', function (e) {
			e.preventDefault();
			var p = toWorld(e), f = Math.exp((e.deltaY || 0) * 0.0015), w = Math.max(3, Math.min(400, st.vb.w * f)), hh = st.vb.h * w / st.vb.w;
			st.userView = true; st.vb = { x: p[0] - (p[0] - st.vb.x) * w / st.vb.w, y: p[1] - (p[1] - st.vb.y) * hh / st.vb.h, w: w, h: hh };
			renderPlan();
		}, { passive: false });
		s.addEventListener('keydown', function (e) { if (e.key === ' ') { st.space = true; } });
		s.addEventListener('keyup', function (e) { if (e.key === ' ') { st.space = false; } });
	}
	function hitTest(p, tol) {
		var lv = st.lv, best = null;
		st.b.openings.forEach(function (o) {
			if (o.lv !== lv || best) { return; }
			var w = st.b.walls.filter(function (q) { return q.id === o.wall; })[0];
			if (!w) { return; }
			var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
			var u = (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy, v = Math.abs(-(p[0] - w.a[0]) * uy + (p[1] - w.a[1]) * ux);
			if (u >= o.at - tol && u <= o.at + o.w + tol && v <= w.t / 2 + tol) { best = { k: 'op', id: o.id }; }
		});
		if (best) { return best; }
		var nw = nearestWall(p, tol, true);
		return nw ? { k: 'wall', id: nw.w.id } : null;
	}
	function onKey(e) {
		if (!st) { return false; }
		var tag = (e.target && e.target.tagName) || '', typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
		if (e.key === 'Escape') {
			if (document.querySelector('.agh-dialog-wrap')) { return false; }
			if (st.draw) { st.draw = null; renderPlan(); e.preventDefault(); return true; }
			if (st.sel) { st.sel = null; renderPanel(); renderPlan(); e.preventDefault(); return true; }
			return true; // never close the designer from here
		}
		if (typing) { return false; }
		if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) { redo(); } else { undo(); } return true; }
		if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return true; }
		if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) { e.preventDefault(); delSel(); return true; }
		return false;
	}

	// load a whole drawing (a saved one, a template or a test house) as one undoable change
	function load(b) { change(function () { st.b = B.normalize(b); }); st.sel = null; fitView(); renderAll(); }
	root.AGH_BuildUI = { version: '1.0.0', open: open, close: close, onKey: onKey, load: load, state: function () { return st; }, goStep: function (i) { goStep(i); }, closeStep: function () { closeStep(); }, setView: function (v) { setView(v); }, setPhase: function (p) { setPhase(p); } };
}(window));
