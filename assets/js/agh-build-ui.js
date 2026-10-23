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
		st = { b: b, step: b.step || 0, tool: 'select', kind: 'ext', otype: 'window', sel: null, lv: 0, view: 'plan', pane: 'panel', phase: Math.min(9, b.step || 0), undo: [], redo: [], vb: null, draw: null, drag: null, msPhase: null, showAll: false };
		if (st.step === 6) { st.kind = 'part'; }
		if (st.step === 7) { st.tool = 'opening'; }
		build();
		fitView();
		renderAll(true);
	}
	// closing empties the host (it belongs to the designer and is reused on the next visit)
	function close() { hook3D(false); if (D.ro) { D.ro.disconnect(); } if (D.root) { D.root.innerHTML = ''; D.root.removeAttribute('data-pane'); } window.removeEventListener('resize', onResize); D = {}; st = null; }
	function snapshot() { return JSON.stringify(st.b); }
	function change(fn, opts) {
		opts = opts || {};
		if (!opts.noUndo) { st.undo.push(snapshot()); if (st.undo.length > 80) { st.undo.shift(); } st.redo = []; }
		fn(st.b);
		commit(opts);
	}
	function commit(opts) {
		opts = opts || {};
		syncStair(st.b);
		(st.b.prog || []).forEach(function (r) { r.placed = progState(st.b, r) === 'ok'; });
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
	function find(sel) { if (!sel) { return null; } if (sel.k === 'stair') { return st.b.slab.stair || null; } var list = sel.k === 'op' ? st.b.openings : (sel.k === 'room' ? (st.b.prog || []) : st.b.walls); for (var i = 0; i < list.length; i++) { if (list[i].id === sel.id) { return list[i]; } } return null; }
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
		renderSelBar();
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
		st.phase = Math.max(0, Math.min(PHASE3D, i)); // the 3D construction stage follows the step
		if (!st.userView || (i === 0) !== (st.lastStep === 0)) { st.userView = false; fitView(); }
		st.lastStep = i;
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
		renderSelBar();
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
			// 1.16.2: the house outline is marked out here (kitűzés) – the stakes, the strings, the earthworks,
			// the foundation and the services of steps 1–4 are drawn from it right away, not only after the
			// walls of step 5 were drawn and the visitor came back
			box.insertBefore(templatesBox(), box.children[1] || null);
		},
		function earth(box) {
			if (!st.b.walls.length) { box.appendChild(templatesBox()); }   // nothing to build on yet: mark out the house first (1.16.2)
			box.appendChild(group(null, [el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_topsoil'), numIn('earth.topsoil', { min: 0, max: 1, step: 0.05 }), 'm'),
				field(t('b_margin'), numIn('earth.margin', { min: 0, max: 5, step: 0.1 }), 'm', t('b_margin_help')),
				field(t('b_found_d'), numIn('found.d', { min: 0.3, max: 3, step: 0.05 }), 'm', t('b_found_d_help')),
				field(t('b_soil'), selIn('site.soil', (B.defaults().soils || []).map(function (s) { return [s, t('b_soil_' + s)]; })))
			])]));
		},
		function found(box) {
			if (!st.b.walls.length) { box.appendChild(templatesBox()); }   // nothing to build on yet: mark out the house first (1.16.2)
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
			if (!st.b.walls.length) { box.appendChild(templatesBox()); }   // nothing to build on yet: mark out the house first (1.16.2)
			box.appendChild(group(null, [togIn('ducts.sewer', t('b_duct_sewer')), togIn('ducts.water', t('b_duct_water')), togIn('ducts.earth', t('b_duct_earth')),
				field(t('b_duct_conduits'), numIn('ducts.conduits', { min: 0, max: 30, step: 1 }), t('b_u_db'))]));
			box.appendChild(el('p', { class: 'agh-bld-note', text: t('b_ducts_note') }));
		},
		function ground(box) {
			if (!st.b.walls.length) { box.appendChild(templatesBox()); }   // nothing to build on yet: mark out the house first (1.16.2)
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
			var sb = stairBox(); if (sb) { box.appendChild(sb); }
			box.appendChild(programBox());
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
		// 1.16.0: the typed size is kept – the panel is rebuilt on every change, and the fields came
		// back as 10 × 8 each time, so a bigger house could not be started
		st.tpl = st.tpl || { w: 10, d: 8 };
		var W = el('input', { type: 'number', class: 'agh-input agh-bld-num', 'data-k': 'tpl.w', value: String(st.tpl.w), min: '4', max: '40', step: '0.1', inputmode: 'decimal', 'aria-label': t('b_w') });
		var Dd = el('input', { type: 'number', class: 'agh-input agh-bld-num', 'data-k': 'tpl.d', value: String(st.tpl.d), min: '4', max: '30', step: '0.1', inputmode: 'decimal', 'aria-label': t('b_d') });
		W.addEventListener('input', function () { var n = parseFloat(String(W.value).replace(',', '.')); if (isFinite(n)) { st.tpl.w = Math.max(4, Math.min(40, n)); schedule3D(); } });
		Dd.addEventListener('input', function () { var n = parseFloat(String(Dd.value).replace(',', '.')); if (isFinite(n)) { st.tpl.d = Math.max(4, Math.min(30, n)); schedule3D(); } });
		// out of range: the field shows the value that is really used (100 → 40), not one that is silently ignored
		W.addEventListener('change', function () { W.value = String(st.tpl.w); });
		Dd.addEventListener('change', function () { Dd.value = String(st.tpl.d); });
		var row = el('div', { class: 'agh-bld-tpl' }, [
			field(t('b_w'), W, 'm', t('b_w_range')), field(t('b_d'), Dd, 'm', t('b_d_range')),
			el('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { var w = Math.max(4, Math.min(40, num(W.value, st.tpl.w))), d = Math.max(4, Math.min(30, num(Dd.value, st.tpl.d))), o = place(w, d); apply(function () { return { walls: B.rectWalls(o[0] + et / 2, o[1] + et / 2, w - et, d - et, et) }; }); } }, [A.icon('plus', 'agh-ico-s'), t('b_tpl_rect')]),
			el('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { var w = Math.max(4, Math.min(40, num(W.value, st.tpl.w))), d = Math.max(4, Math.min(30, num(Dd.value, st.tpl.d))), o = place(w, d + 3), x = o[0] + et / 2, y = o[1] + et / 2, ww = w - et, dd = d - et, w2 = Math.max(3, Math.round(ww * 0.4 * 10) / 10); apply(function () { return { walls: B.polyWalls([[x, y], [x + ww, y], [x + ww, y + dd + 3], [x + ww - w2, y + dd + 3], [x + ww - w2, y + dd], [x, y + dd]], et) }; }); } }, [A.icon('plus', 'agh-ico-s'), t('b_tpl_l')])
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
		if (st.sel.k === 'stair') {
			var sc6 = o.type ? B.stairCalc(st.b, o.type, o.width) : null, sst = stairState(st.b);
			kids.push(el('p', { class: 'agh-bld-sel-h' }, [el('b', { text: t('b_stair') + (o.type ? ' · ' + t('b_stair_' + o.type) : '') }), ' · ' + fmt(o.w, 2) + ' × ' + fmt(o.d, 2) + ' m']));
			if (sc6) { kids.push(el('p', { class: 'agh-bld-note', text: tf('b_stair_spec', sc6.n, fmt(sc6.rise * 100, 1), fmt(sc6.going * 100, 0), fmt(sc6.blondel * 100, 1)) })); }
			kids.push(el('div', { class: 'agh-bld-row' }, [el('button', { type: 'button', class: 'agh-btn agh-btn-s', onclick: function () { stairTurn(); } }, [A.icon('refresh', 'agh-ico-s'), t('b_stair_rot')])]));
			if (sst !== 'ok' && sst !== 'rules') { kids.push(el('p', { class: 'agh-bld-note is-warn', text: t('b_stair_state_' + sst) })); }
			return group(t('b_selection'), kids);
		}
		if (st.sel.k === 'room') {
			var rp = function (k) { return 'prog.' + st.b.prog.indexOf(o) + '.' + k; }, ps = progState(st.b, o);
			kids.push(el('p', { class: 'agh-bld-sel-h' }, [el('b', { text: o.name || progName(o.type) }), ' · ' + fmt(o.w * o.d, 1) + ' m²']));
			kids.push(el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_prog_name'), (function () { var i = el('input', { type: 'text', class: 'agh-input', 'data-k': rp('name'), value: o.name || '', maxlength: '40', 'aria-label': t('b_prog_name') }); i.addEventListener('change', function () { change(function (b) { var q = b.prog.filter(function (x) { return x.id === o.id; })[0]; q.name = i.value; }); }); return i; })()),
				field(t('b_room_type'), selIn(rp('type'), A.roomTypes())),
				field(t('b_w'), numIn(rp('w'), { min: 0.8, max: 30, step: 0.1 }), 'm'),
				field(t('b_d'), numIn(rp('d'), { min: 0.8, max: 30, step: 0.1 }), 'm')
			]));
			if (ps !== 'ok') { kids.push(el('p', { class: 'agh-bld-note is-warn', text: t('b_prog_state_' + ps) })); }
			var mn6 = progMin(o.type);
			if (mn6 && (o.w * o.d < mn6.area - 0.01 || Math.min(o.w, o.d) < mn6.side - 0.01)) { kids.push(el('p', { class: 'agh-bld-note is-warn', text: tf('b_prog_min', progName(o.type), fmt(mn6.area, 1), fmt(mn6.side, 2)) })); }
		} else if (st.sel.k === 'wall') {
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
			else if (sel.k === 'room') { b.prog = (b.prog || []).filter(function (r) { return r.id !== sel.id; }); }
			else if (sel.k === 'stair') { b.slab.stair = null; }
			else { b.openings = b.openings.filter(function (o) { return o.id !== sel.id; }); }
		});
		st.sel = null; renderPanel(); renderSelBar();
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
			el('button', { type: 'button', class: 'agh-iconbtn', title: t('b_fit'), 'aria-label': t('b_fit'), onclick: function () { st.userView = false; fitView(); renderPlan(); } }, A.icon('fit'))
		]);
		// full screen of the drawing side (plan, 3D and the stage slider), the designer's own mechanism
		D.fsBtn = A.fsButton ? A.fsButton(function () { return D.stage; }, 'agh-iconbtn agh-bld-fs') : null;
		D.selBar = el('div', { class: 'agh-bld-selbar', role: 'group', 'aria-label': t('b_selection'), hidden: true });
		// „Élő fotó” and „Fotó készítése” (1.27.0): only with the 3D view
		D.photo = el('span', { class: 'agh-bld-photo', hidden: true });
		D.tabs.appendChild(D.viewSeg); D.tabs.appendChild(D.selBar); D.tabs.appendChild(el('div', { class: 'agh-bld-right' }, [D.tools, D.photo, D.fsBtn]));
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
		if (D.photo) { D.photo.hidden = v !== '3d'; if (v === '3d' && !D.photo.firstChild && A.photoSlot) { D.photo.appendChild(A.photoSlot()); } }
		if (st.pane === 'plan' || st.pane === '3d') { st.pane = v; D.root.setAttribute('data-pane', v); Array.prototype.forEach.call(D.panes.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-pane') === v ? 'true' : 'false'); }); }
		if (v === '3d') { renderPhaseBar(); show3D(true); } else { renderPlan(); mark3D(); }
	}
	var t3 = 0;
	function schedule3D() { clearTimeout(t3); t3 = setTimeout(function () { if (st && st.view === '3d') { show3D(); } }, 250); }
	function show3D(reset) {
		// 1.16.2: no walls yet → the ground patch shows the size typed under "Kezdés" (it was a fixed 4 × 4 m
		// piece of soil that nothing could change)
		var c3 = cfg();
		if (!st.b.walls.length) { st.tpl = st.tpl || { w: 10, d: 8 }; c3 = Object.assign({}, c3, { _bld_preview: { w: st.tpl.w, d: st.tpl.d, m: num((st.b.earth || {}).margin, 1) } }); }
		var ok = A.preview3D(D.view3, c3, st.phase, !!reset);
		if (ok) { hook3D(true); setTimeout(mark3D, 0); }
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
			// while planning with the programme, a placed rectangle carries the name and m² of its room
			var lpx = (r.lx !== undefined ? r.lx : r.cx) / 1000, lpy = (r.ly !== undefined ? r.ly : r.cy) / 1000;
			if (st.step === 6 && (b.prog || []).some(function (q) { return q.lv === lv && lpx > q.x && lpx < q.x + q.w && lpy > q.y && lpy < q.y + q.d; })) { return; }
			var fs = Math.max(12, Math.min(15, Math.sqrt(r.area / 1e6) * 3));
			var lb = label((r.lx !== undefined ? r.lx : r.cx) / 1000, (r.ly !== undefined ? r.ly : r.cy) / 1000, lw, { class: 'agh-bld-rlabel', 'font-size': fs, 'text-anchor': 'middle' });
			var nm = names[r.type || defs[i]] || '', roomPx = (r.bbox.x1 - r.bbox.x0) / 1000 * k - 8;
			if (nm.length * fs * 0.58 > roomPx) { nm = nm.length * fs * 0.58 * 0.6 > roomPx ? '' : nm.split(/\s*\+\s*|\s+/)[0]; }
			var t1 = sv('tspan', { x: 0, dy: -0.2 * fs }); t1.textContent = nm;
			var t2 = sv('tspan', { x: 0, dy: 1.2 * fs, class: 'agh-bld-rarea' }); t2.textContent = fmt(r.area / 1e6, 1) + ' m²';
			lb.t.appendChild(t1); lb.t.appendChild(t2); gr.appendChild(lb.g);
		});
		s.appendChild(gr);
		// the room programme (1.20.0): rectangles to place in the base; red when out of the house or on another
		if (st.step === 6 && (b.prog || []).length) {
			var gp = sv('g', { class: 'agh-bld-prog' });
			b.prog.forEach(function (r, i) {
				if (r.lv !== lv) { return; }
				var ps = progState(b, r), on = st.sel && st.sel.k === 'room' && st.sel.id === r.id;
				gp.appendChild(sv('rect', { x: r.x, y: r.y, width: r.w, height: r.d, class: 'agh-bld-progr r' + (i % 6) + (ps === 'ok' ? '' : ' is-bad') + (on ? ' is-sel' : ''), 'data-room': r.id, 'stroke-width': (on ? 3 : 1.5) * lw }));
				var fs = 12, lb = label(r.x + r.w / 2, r.y + r.d / 2, lw, { class: 'agh-bld-rlabel', 'font-size': fs, 'text-anchor': 'middle' });
				var t1 = sv('tspan', { x: 0, dy: -0.2 * fs }); t1.textContent = r.w * k > 60 ? (r.name || progName(r.type)) : '';
				var t2 = sv('tspan', { x: 0, dy: 1.2 * fs, class: 'agh-bld-rarea' }); t2.textContent = fmt(r.w * r.d, 1) + ' m²';
				lb.t.appendChild(t1); lb.t.appendChild(t2); gp.appendChild(lb.g);
			});
			s.appendChild(gp);
		}
		// the stair while planning the rooms (1.21.0): footprint and treads below the top level, the opening on it
		if (st.step === 6 && b.slab.stair && b.levels.length > 1) {
			var so6 = stairOn(b, lv), ss6 = stairState(b), son = st.sel && st.sel.k === 'stair', gs = sv('g', { class: 'agh-bld-stairg' + (ss6 === 'ok' ? '' : ' is-bad') + (son ? ' is-sel' : '') });
			so6.rects.forEach(function (q) { gs.appendChild(sv('rect', { x: q.x, y: q.y, width: q.w, height: q.d, class: 'agh-bld-stair6', 'stroke-width': (son ? 3 : 1.5) * lw })); });
			if (!so6.top && so6.s.steps && so6.s.steps.length) {
				so6.s.steps.forEach(function (q) { gs.appendChild(sv('polygon', { points: q.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), class: 'agh-bld-tread', 'stroke-width': lw })); });
				var f0 = so6.s.steps[0], fl = so6.s.steps[so6.s.steps.length - 1], cen = function (q) { var x = 0, y = 0; q.pts.forEach(function (p) { x += p[0] / q.pts.length; y += p[1] / q.pts.length; }); return [x, y]; };
				var a0 = cen(f0), a1 = cen(fl); gs.appendChild(sv('path', { d: 'M' + a0[0] + ' ' + a0[1] + 'L' + a1[0] + ' ' + a1[1], class: 'agh-bld-stairarrow', 'stroke-width': 1.5 * lw }));
				gs.appendChild(sv('circle', { cx: a0[0], cy: a0[1], r: 0.09, class: 'agh-bld-stairdot' }));
			}
			var lb6 = label(so6.s.foot.x + so6.s.foot.w / 2, so6.s.foot.y + so6.s.foot.d / 2, lw, { class: 'agh-bld-rlabel', 'font-size': 11, 'text-anchor': 'middle' });
			var tl = sv('tspan', { x: 0, dy: 0 }); tl.textContent = so6.top ? t('b_stair_hole6') : t('b_stair'); lb6.t.appendChild(tl); gs.appendChild(lb6.g);
			s.appendChild(gs);
		}
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
				var hit = hitTest(p, 8 / k), now = Date.now(), lt = st.lastTap;
				// a second tap on the same programme rectangle turns it by 90° (the plan is redrawn between the
				// taps, so the browser's own dblclick does not reach it)
				if (hit && (hit.k === 'room' || hit.k === 'stair') && lt && lt.id === hit.id && now - lt.t < 450 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 10) {
					st.lastTap = null; st.sel = hit; if (hit.k === 'stair') { stairTurn(); } else { progTurn(hit.id); } renderPanel(); renderPlan(); return;
				}
				st.lastTap = hit && (hit.k === 'room' || hit.k === 'stair') ? { id: hit.id, t: now, x: e.clientX, y: e.clientY } : null;
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
			if (st.drag && st.drag.move) { if (moveSel(p)) { renderPlan(); } return; }
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
		s.addEventListener('dblclick', function () {
			if (st.draw) { st.draw = null; renderPlan(); return; }
		});
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
	/* ------------------------------------------------------------------ room programme (1.20.0)
	 * A dialog lists the room types as pills: a tap adds the room, its area (and if wanted width × depth)
	 * is typed in. Each room becomes a rectangle beside the house; the visitor drags it into the base
	 * (grid 10 cm, it snaps to the inner faces of the walls), or lets them be placed automatically. When
	 * they are in place, the partitions are drawn along their edges (not where a wall already stands) and
	 * the rooms that come out get the chosen types. The automatic room split of the designer stays on its
	 * own button, as before. */
	function progTurn(id) { change(function (b) { var q = (b.prog || []).filter(function (x) { return x.id === id; })[0]; if (q) { var cx = q.x + q.w / 2, cy = q.y + q.d / 2, w0 = q.w; q.w = q.d; q.d = w0; q.x = r2(cx - q.w / 2); q.y = r2(cy - q.d / 2); } }); }
	function progName(type) { var n = ''; A.roomTypes().forEach(function (o) { if (o[0] === type) { n = o[1]; } }); return n || t('b_prog_custom'); }
	function progDims(area, w, d) {
		if (w > 0.7 && d > 0.7) { return [w, d]; }
		var a = Math.max(1, area || 12), ww = Math.round(Math.sqrt(a * 1.25) * 10) / 10;
		return [ww, r2(a / ww)];
	}
	// the outline of the outer walls, memoised (the programme asks for it thousands of times while placing)
	// cheap checksums of the walls and of the stair: the memos below are keyed by them
	function wallSig(b, extOnly) {
		var h = b.walls.length * 7919;
		b.walls.forEach(function (w, i) { if (extOnly && w.kind !== 'ext') { return; } h += (w.a[0] * 7 + w.a[1] * 13 + w.b[0] * 17 + w.b[1] * 19 + w.t * 23 + (w.kind === 'ext' ? 1 : w.kind === 'int' ? 2 : 3) * 29 + w.lv * 31) * (i + 1); });
		return h;
	}
	function stairSig(b) { var s = b.slab && b.slab.stair; return s ? [s.x, s.y, s.w, s.d, s.type, s.width, s.rot, b.levels.length, b.levels[0].h, b.slab.t].join('|') : 'none|' + b.levels.length; }
	var MEMO = {};
	function memo(name, key, fn) { var m = MEMO[name]; if (!m || m.k !== key) { m = MEMO[name] = { k: key, v: fn() }; } return m.v; }
	function olOf(b) { return memo('ol', wallSig(b, true), function () { return B.outline(b); }); }
	/* ------------------------------------------------------------------ the programme's geometry (1.21.0)
	 * A programme rectangle is the room's net size between finished (plastered) faces. Between two rooms
	 * there is a partition plus plaster on both sides (gap), against a kept wall only the plaster. Bearing
	 * inner walls stay; the stair (footprint below, opening above) and its free landings are kept clear. */
	function progCfg() {
		var d = B.defaults().programme || {}, md = (B.defaults().model || {}).wall || {}, pt = num((md.part || {}).t, 0.1), p = num(d.plaster, 0.015);
		return { p: p, pt: pt, gap: Math.round((pt + 2 * p) * 1000) / 1000, half: pt / 2 + p, stair: d.stair || { w: 1.1, d: 3.2 }, mins: d.rooms_min || {}, circ: d.circulation_pct || [8, 12], door: num(d.door_side_min, 1.1) };
	}
	var CIRC = { hall: 1, corridor: 1, stairs: 1, living: 1, living_kitchen: 1, dining: 1 };
	function rr(x, y, w, d) { return { x: x, y: y, w: w, d: d }; }
	function hitRect(a, b, m) { m = m || 0; return a.x < b.x + b.w + m - 0.004 && a.x + a.w > b.x - m + 0.004 && a.y < b.y + b.d + m - 0.004 && a.y + a.d > b.y - m + 0.004; }
	// the stair's rectangles on a level: its footprint below the top level, its opening on the top level
	function stairOn(b, lv) { return memo('so' + lv, stairSig(b), function () { return stairOn0(b, lv); }); }
	function stairOn0(b, lv) {
		var s = B.stairRects(b);
		if (!s || b.levels.length < 2) { return null; }
		var top = lv >= b.levels.length - 1, hole = s.hole, list = [];
		if (top) {
			// an L-shaped opening as two rectangles
			if (s.holePoly && s.holePoly.length === 6) { var xs = s.holePoly.map(function (q) { return q[0]; }), ys = s.holePoly.map(function (q) { return q[1]; }); list = progPolyRects(s.holePoly, xs, ys); } else { list = [hole]; }
		} else { list = [s.foot]; }
		return { s: s, top: top, rects: list, zone: top ? s.top : s.bottom, zone2: top ? null : null };
	}
	function progPolyRects(poly) {
		// an axis-aligned L hexagon → two rectangles (cut at the inner corner, horizontally)
		var ys = poly.map(function (q) { return q[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, c) { return a - c; }), out = [];
		for (var i = 0; i + 1 < ys.length; i++) {
			var ym = (ys[i] + ys[i + 1]) / 2, xs = [];
			poly.forEach(function (p, k) { var q = poly[(k + 1) % poly.length]; if (p[0] === q[0] && (p[1] - ym) * (q[1] - ym) < 0) { xs.push(p[0]); } });
			xs.sort(function (a, c) { return a - c; });
			for (var j = 0; j + 1 < xs.length; j += 2) { out.push(rr(xs[j], ys[i], r2(xs[j + 1] - xs[j]), r2(ys[i + 1] - ys[i]))); }
		}
		return out;
	}
	// bearing inner walls and kept partitions of the level as rectangles (centre line ± t/2)
	function wallRects(b, lv, kinds) { return memo('wr' + lv + kinds.join(), wallSig(b), function () { return wallRects0(b, lv, kinds); }); }
	function wallRects0(b, lv, kinds) {
		var out = [];
		b.walls.forEach(function (w) {
			if (kinds.indexOf(w.kind) === -1 || (w.kind !== 'ext' && w.lv !== lv)) { return; }
			if (w.a[0] !== w.b[0] && w.a[1] !== w.b[1]) { return; }
			var x0 = Math.min(w.a[0], w.b[0]) - w.t / 2, x1 = Math.max(w.a[0], w.b[0]) + w.t / 2, y0 = Math.min(w.a[1], w.b[1]) - w.t / 2, y1 = Math.max(w.a[1], w.b[1]) + w.t / 2;
			out.push({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, id: w.id, kind: w.kind });
		});
		return out;
	}
	// 'ok', 'out' (not inside the house), 'overlap' (on another room or too close), 'wall' (on a bearing
	// wall), 'stair' (on the stair or its opening), 'landing' (blocks the free landing of the stair)
	function progState(b, r) {
		var C = progCfg(), ol = olOf(b);
		if (!ol.closed) { return 'out'; }
		var p = C.p, e = 0.004, x0 = r.x - p + e, x1 = r.x + r.w + p - e, y0 = r.y - p + e, y1 = r.y + r.d + p - e;
		var pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2], [(x0 + x1) / 2, (y0 + y1) / 2]];
		if (pts.some(function (q) { return !B._inPoly(ol.inner, Math.round(q[0] * 1000), Math.round(q[1] * 1000)); })) { return 'out'; }
		if ((b.prog || []).some(function (q) { return q !== r && q.id !== r.id && q.lv === r.lv && hitRect(r, q, C.gap); })) { return 'overlap'; }
		if (wallRects(b, r.lv, ['int']).some(function (w) { return hitRect(r, w, p); })) { return 'wall'; }
		if (partialSide(b, r, C)) { return 'partial'; }
		var so = stairOn(b, r.lv);
		if (so) {
			if (so.rects.some(function (q) { return hitRect(r, q, so.top ? p : C.gap); })) { return 'stair'; }
			if (so.zone && !CIRC[r.type] && hitRect(r, so.zone, 0)) { return 'landing'; }
		}
		return 'ok';
	}
	// A side lying partly against a kept wall (outer or bearing) and partly open: the partition along the open
	// part would end in the wall's body without meeting its centre line, so the room would not close.
	function partialSide(b, r, C) {
		var ws = wallRects(b, r.lv, ['ext', 'int']);
		var sides = [['v', r.x, -1, r.y, r.y + r.d], ['v', r.x + r.w, 1, r.y, r.y + r.d], ['h', r.y, -1, r.x, r.x + r.w], ['h', r.y + r.d, 1, r.x, r.x + r.w]];
		return sides.some(function (sd) {
			var cov = [], bad = false, line = sd[1] + sd[2] * C.half;
			ws.forEach(function (w) {
				var vert = w.d > w.w;
				if ((sd[0] === 'v') !== vert) { return; }
				var t = vert ? w.w : w.d, c = vert ? w.x + w.w / 2 : w.y + w.d / 2;
				// the partition of this side would be cut by this wall (same reach as the drawing of the walls)
				if (Math.abs(line - c) > t / 2 + C.pt + 0.02) { return; }
				var a0 = vert ? w.y : w.x, a1 = vert ? w.y + w.d : w.x + w.w, o0 = Math.max(a0, sd[3]), o1 = Math.min(a1, sd[4]);
				// the wall reaches only the partition's end beyond the corner: the partition would be cut short there
				// and end in the air, so the room could not close
				if (o1 <= o0) { if (Math.min(a1, sd[4] + C.half) > Math.max(a0, sd[3] - C.half) + 0.001) { bad = true; } return; }
				cov.push([o0, o1]);
				// then the side must lie on the wall's face (plus plaster), not a few cm off it
				var face = c - sd[2] * t / 2, want = sd[1] + sd[2] * C.p;
				if (Math.abs(face - want) > 0.02) { bad = true; }
			});
			if (bad) { return true; }
			if (!cov.length) { return false; }
			cov.sort(function (p2, q) { return p2[0] - q[0]; });
			var tot = 0, end = -1e9;
			cov.forEach(function (q) { var a2 = Math.max(q[0], end); if (q[1] > a2) { tot += q[1] - a2; } end = Math.max(end, q[1]); });
			return tot < (sd[4] - sd[3]) - 0.005;
		});
	}
	// is the stair itself in a good place: inside the house (footprint and opening on every level), off the
	// bearing walls, its free landings inside the house too
	function stairState(b) {
		var s = B.stairRects(b);
		if (!s || b.levels.length < 2) { return 'ok'; }
		var ol = olOf(b), C = progCfg();
		if (!ol.closed) { return 'out'; }
		function inside(q, m) { var x0 = q.x - m, x1 = q.x + q.w + m, y0 = q.y - m, y1 = q.y + q.d + m; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(function (k) { return B._inPoly(ol.inner, Math.round(k[0] * 1000), Math.round(k[1] * 1000)); }); }
		if (!inside(rr(s.foot.x + 0.004, s.foot.y + 0.004, s.foot.w - 0.008, s.foot.d - 0.008), C.p)) { return 'out'; }
		if (s.bottom && !inside(rr(s.bottom.x + 0.004, s.bottom.y + 0.004, s.bottom.w - 0.008, s.bottom.d - 0.008), 0)) { return 'landing'; }
		if (s.top && s.calc && s.calc.type !== 'spiral' && !inside(rr(s.top.x + 0.004, s.top.y + 0.004, s.top.w - 0.008, s.top.d - 0.008), 0)) { return 'landing'; }
		for (var lv = 0; lv < b.levels.length; lv++) {
			var walls = wallRects(b, lv, ['int']), so = stairOn(b, lv);
			if (so.rects.some(function (q) { return walls.some(function (w) { return hitRect(q, w, C.p); }); })) { return 'wall'; }
		}
		return s.calc && !s.calc.ok ? 'rules' : 'ok';
	}
	// the inner faces of the walls (+ plaster), the neighbours' edges (+ gap) and the stair: snapping lines
	function faceLines(lv, skipId) {
		var C = progCfg(), xs = [], ys = [];
		st.b.walls.forEach(function (w) {
			if (!(w.kind === 'ext' || w.lv === lv)) { return; }
			var m = w.t / 2 + C.p;
			if (w.a[0] === w.b[0]) { xs.push(w.a[0] - m, w.a[0] + m); } else if (w.a[1] === w.b[1]) { ys.push(w.a[1] - m, w.a[1] + m); }
		});
		(st.b.prog || []).forEach(function (q) { if (q.lv === lv && q.id !== skipId) { xs.push(q.x - C.gap, q.x + q.w + C.gap); ys.push(q.y - C.gap, q.y + q.d + C.gap); } });
		var so = skipId === 'stair' ? null : stairOn(st.b, lv);
		if (so) { so.rects.forEach(function (q) { xs.push(q.x - C.gap, q.x + q.w + C.gap); ys.push(q.y - C.gap, q.y + q.d + C.gap); }); }
		return { xs: xs, ys: ys };
	}
	function progSnap(x, y, w, d, skipId) {
		var L = faceLines(st.lv, skipId), tol = 0.25;
		function near(v, list) { var best = null, bd = tol; list.forEach(function (c) { var dd = Math.abs(c - v); if (dd < bd) { bd = dd; best = c; } }); return best; }
		var a = near(x, L.xs), b2 = near(x + w, L.xs), c = near(y, L.ys), e = near(y + d, L.ys);
		if (a !== null && (b2 === null || Math.abs(a - x) <= Math.abs(b2 - x - w))) { x = a; } else if (b2 !== null) { x = b2 - w; }
		if (c !== null && (e === null || Math.abs(c - y) <= Math.abs(e - y - d))) { y = c; } else if (e !== null) { y = e - d; }
		return [r2(x), r2(y)];
	}
	// new rectangles wait in a column to the right of the house
	function progPark(b) {
		var xs = b.walls.map(function (w) { return Math.max(w.a[0], w.b[0]) + w.t / 2; }), ys = b.walls.map(function (w) { return Math.min(w.a[1], w.b[1]) - w.t / 2; });
		var x0 = xs.length ? Math.max.apply(null, xs) + 1.5 : 2, y = ys.length ? Math.min.apply(null, ys) : 2;
		(b.prog || []).forEach(function (r) { if (!r.placed && r.x >= x0 - 0.01) { y = Math.max(y, r.y + r.d + 0.5); } });
		return [r2(x0), r2(y)];
	}
	// sizes a room of `area` can take: the asked one first, then the same area with other proportions,
	// never narrower than the good-practice minimum of its type
	function progShapes(r) {
		var C = progCfg(), mn = C.mins[r.type] || [0, 0], side = Math.max(num(mn[1], 0), 0.9), A = r.w * r.d, out = [[r.w, r.d]];
		if (!r.keepWD) {
			for (var w = Math.max(side, 0.9); w * w <= A * 3 + 1e-6; w = r2(w + 0.1)) {
				var d = r2(A / w);
				if (d < side - 1e-6) { continue; }
				out.push([r2(w), d], [d, r2(w)]);
			}
			// closest to the asked proportion first
			var q0 = r.w / r.d;
			out = [out[0]].concat(out.slice(1).sort(function (p, q) { return Math.abs(Math.log(p[0] / p[1] / q0)) - Math.abs(Math.log(q[0] / q[1] / q0)); }));
		} else { out.push([r.d, r.w]); }
		return out;
	}
	// The house's free space as a grid (5 cm): a cell is free where a room's net face may lie. A cell is
	// blocked when any part of it touches a forbidden place (outside the house with the plaster, a bearing
	// wall, the stair, another room with its gap), so a rectangle whose inner cells are all free may fit
	// (the exact test decides) and one with a blocked inner cell never does.
	function progGridBase(b, lv) {
		return memo('gb' + lv, wallSig(b) + '|' + stairSig(b), function () {
			var C = progCfg(), ol = olOf(b);
			if (!ol.closed) { return null; }
			var xs = ol.inner.map(function (q) { return q[0] / 1000; }), ys = ol.inner.map(function (q) { return q[1] / 1000; });
			var cs = 0.05, X0 = Math.min.apply(null, xs), Y0 = Math.min.apply(null, ys), nx = Math.max(1, Math.ceil((Math.max.apply(null, xs) - X0) / cs - 1e-6)), ny = Math.max(1, Math.ceil((Math.max.apply(null, ys) - Y0) / cs - 1e-6));
			var free = new Uint8Array(nx * ny), h = C.p;
			for (var j = 0; j < ny; j++) {
				for (var i = 0; i < nx; i++) {
					var x0 = X0 + i * cs - h, y0 = Y0 + j * cs - h, x1 = X0 + (i + 1) * cs + h, y1 = Y0 + (j + 1) * cs + h;
					free[j * nx + i] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(function (k) { return B._inPoly(ol.inner, Math.round(k[0] * 1000), Math.round(k[1] * 1000)); }) ? 1 : 0;
				}
			}
			var G = { X0: X0, Y0: Y0, cs: cs, nx: nx, ny: ny, free: free };
			wallRects(b, lv, ['int']).forEach(function (w) { gridBlock(G, w, C.p); });
			var so = stairOn(b, lv);
			if (so) { so.rects.forEach(function (q) { gridBlock(G, q, so.top ? C.p : C.gap); }); }
			return G;
		});
	}
	function gridCopy(G) { return G ? { X0: G.X0, Y0: G.Y0, cs: G.cs, nx: G.nx, ny: G.ny, free: new Uint8Array(G.free) } : null; }
	function gridBlock(G, q, m) {
		var i0 = Math.max(0, Math.floor((q.x - m - G.X0) / G.cs + 1e-9)), i1 = Math.min(G.nx, Math.ceil((q.x + q.w + m - G.X0) / G.cs - 1e-9));
		var j0 = Math.max(0, Math.floor((q.y - m - G.Y0) / G.cs + 1e-9)), j1 = Math.min(G.ny, Math.ceil((q.y + q.d + m - G.Y0) / G.cs - 1e-9));
		for (var j = j0; j < j1; j++) { for (var i = i0; i < i1; i++) { G.free[j * G.nx + i] = 0; } }
		G.S = null;
	}
	function gridSums(G) {
		var W = G.nx + 1, S = new Int32Array(W * (G.ny + 1));
		for (var j = 0; j < G.ny; j++) { for (var i = 0; i < G.nx; i++) { S[(j + 1) * W + i + 1] = (G.free[j * G.nx + i] ? 0 : 1) + S[j * W + i + 1] + S[(j + 1) * W + i] - S[j * W + i]; } }
		G.S = S; G.W = W;
	}
	// may a rectangle lie here (its inner cells all free)?
	function gridMay(G, x, y, w, d) {
		if (x < G.X0 - 0.03 || y < G.Y0 - 0.03 || x + w > G.X0 + G.nx * G.cs + 0.03 || y + d > G.Y0 + G.ny * G.cs + 0.03) { return false; }
		if (!G.S) { gridSums(G); }
		var i0 = Math.max(0, Math.ceil((x - G.X0) / G.cs - 1e-6)), i1 = Math.min(G.nx, Math.floor((x + w - G.X0) / G.cs + 1e-6));
		var j0 = Math.max(0, Math.ceil((y - G.Y0) / G.cs - 1e-6)), j1 = Math.min(G.ny, Math.floor((y + d - G.Y0) / G.cs + 1e-6));
		if (i1 <= i0 || j1 <= j0) { return true; }
		var S = G.S, W = G.W;
		return S[j1 * W + i1] - S[j0 * W + i1] - S[j1 * W + i0] + S[j0 * W + i0] === 0;
	}
	function progGrid(b, lv, skipId, anyType) {
		var G = gridCopy(progGridBase(b, lv)), C = progCfg();
		if (!G) { return null; }
		// for a room of any type the stair's free landing stays clear too
		if (anyType) { var so = stairOn(b, lv); if (so && so.zone) { gridBlock(G, so.zone, 0); } }
		(b.prog || []).forEach(function (q) { if (q.lv === lv && q.id !== skipId && q.x > -900 && progState(b, q) === 'ok') { gridBlock(G, q, C.gap); } });
		return G;
	}
	// the largest free rectangle (histogram method); dims in metres, rounded down to the grid
	function progLargest(G) {
		if (!G) { return null; }
		var hgt = new Int32Array(G.nx), best = { a: 0 };
		for (var j = 0; j < G.ny; j++) {
			for (var i = 0; i < G.nx; i++) { hgt[i] = G.free[j * G.nx + i] ? hgt[i] + 1 : 0; }
			var stack = [];
			for (var i2 = 0; i2 <= G.nx; i2++) {
				var hh = i2 < G.nx ? hgt[i2] : 0, start = i2;
				while (stack.length && stack[stack.length - 1][1] >= hh) {
					var top = stack.pop(), a = top[1] * (i2 - top[0]);
					if (a > best.a) { best = { a: a, i0: top[0], i1: i2, j1: j + 1, j0: j + 1 - top[1] }; }
					start = top[0];
				}
				stack.push([start, hh]);
			}
		}
		if (!best.a) { return null; }
		return { x: G.X0 + best.i0 * G.cs, y: G.Y0 + best.j0 * G.cs, w: (best.i1 - best.i0) * G.cs, d: (best.j1 - best.j0) * G.cs };
	}
	// The largest room that really fits: the free cells' rectangle, its sides moved onto the nearby wall
	// faces (+ plaster) and neighbour gaps – a room never leaves a few-cm slot to a wall – and checked exactly.
	function progLargestFit(b, lv) {
		var G = progGrid(b, lv, null, true), R = progLargest(G);
		if (!R) { return null; }
		var L = linesOf(b, lv, null), xs = L.xs.map(r2), ys = L.ys.map(r2);
		function lo(v, list) { var best = null; list.forEach(function (c) { if (c <= v + 0.001 && v - c <= 0.4 && (best === null || c > best)) { best = c; } }); return best; }
		function hi(v, list) { var best = null; list.forEach(function (c) { if (c >= v - 0.001 && c - v <= 0.4 && (best === null || c < best)) { best = c; } }); return best; }
		var x0 = lo(R.x, xs), x1 = hi(R.x + R.w, xs), y0 = lo(R.y, ys), y1 = hi(R.y + R.d, ys);
		// every side either on its line or just inside the free cells (rounded inwards), then 10 cm steps in
		var ax = [x0, Math.ceil(R.x * 100 - 1e-6) / 100], bx = [x1, Math.floor((R.x + R.w) * 100 + 1e-6) / 100], ay = [y0, Math.ceil(R.y * 100 - 1e-6) / 100], by = [y1, Math.floor((R.y + R.d) * 100 + 1e-6) / 100], tries = [];
		for (var k = 0; k <= 3; k++) {
			ax.forEach(function (q0) { bx.forEach(function (q1) { ay.forEach(function (q2) { by.forEach(function (q3) {
				if (q0 === null || q1 === null || q2 === null || q3 === null) { return; }
				tries.push([r2(q0 + 0.1 * k * (q0 === ax[1] ? 1 : 0)), r2(q1 - 0.1 * k * (q1 === bx[1] ? 1 : 0)), r2(q2 + 0.1 * k * (q2 === ay[1] ? 1 : 0)), r2(q3 - 0.1 * k * (q3 === by[1] ? 1 : 0))]);
			}); }); }); });
		}
		tries.sort(function (p2, q) { return (q[1] - q[0]) * (q[3] - q[2]) - (p2[1] - p2[0]) * (p2[3] - p2[2]); });
		for (var i = 0; i < tries.length; i++) {
			var t2 = tries[i], r = { id: '__free', type: 'office', lv: lv, x: t2[0], y: t2[2], w: r2(t2[1] - t2[0]), d: r2(t2[3] - t2[2]) };
			if (r.w >= 0.8 && r.d >= 0.8 && progState(b, r) === 'ok') { return r; }
			if (window.__pgdbg) { window.__pgdbg.push([r.x, r.y, r.w, r.d, progState(b, r)]); }
		}
		return null;
	}
	// Places the rectangles of a level: the stair first (when it has no good place yet), then the rooms,
	// biggest first, each in the first free place (rows from the back), trying its other proportions.
	// Returns the number that did not fit (they wait beside the house).
	function progPlace(b, lv, ids) {
		var C = progCfg(), ol = olOf(b);
		if (!ol.closed) { return (b.prog || []).length; }
		if (b.levels.length > 1 && b.slab.stair && b.slab.stair.type && stairState(b) !== 'ok') { stairPlace(b); }
		var list = (b.prog || []).filter(function (r) { return r.lv === lv && (!ids || ids.indexOf(r.id) !== -1); }).sort(function (p, q) { return q.w * q.d - p.w * p.d; }), miss = 0;
		list.forEach(function (r) { r.x = -999; r.y = -999; });
		var G = progGrid(b, lv, null);
		list.forEach(function (r) {
			var shapes = progShapes(r), done = false, w0 = r.w, d0 = r.d;
			for (var si = 0; si < shapes.length && !done; si++) {
				r.w = shapes[si][0]; r.d = shapes[si][1];
				var L = linesOf(b, lv, r.id), cx = cands(L.xs, r.w, L.x0, L.x1), cy = cands(L.ys, r.d, L.y0, L.y1);
				for (var iy = 0; iy < cy.length && !done; iy++) {
					for (var ix = 0; ix < cx.length && !done; ix++) {
						if (!gridMay(G, cx[ix], cy[iy], r.w, r.d)) { continue; }
						r.x = cx[ix]; r.y = cy[iy];
						if (progState(b, r) === 'ok') { done = true; }
					}
				}
			}
			if (!done) { r.w = w0; r.d = d0; r.x = -999; r.y = -999; miss++; } else { gridBlock(G, r, C.gap); }
			r.placed = done;
		});
		// the ones that did not fit wait beside the house
		list.forEach(function (r) { if (!r.placed) { var pk = progPark(b); r.x = pk[0]; r.y = pk[1]; } });
		return miss;
	}
	// candidate edges on one axis: the snapping lines (as a start, and as an end) and a 10 cm grid
	function linesOf(b, lv, skipId) {
		var C = progCfg(), ol = olOf(b), xs0 = ol.inner.map(function (q) { return q[0] / 1000; }), ys0 = ol.inner.map(function (q) { return q[1] / 1000; });
		var xs = [], ys = [];
		b.walls.forEach(function (w) {
			if (!(w.kind === 'ext' || (w.lv === lv && w.kind === 'int'))) { return; }
			var m = w.t / 2 + C.p;
			if (w.a[0] === w.b[0]) { xs.push(w.a[0] - m, w.a[0] + m); } else if (w.a[1] === w.b[1]) { ys.push(w.a[1] - m, w.a[1] + m); }
		});
		(b.prog || []).forEach(function (q) { if (q.lv === lv && q.id !== skipId && q.x > -900) { xs.push(q.x - C.gap, q.x + q.w + C.gap); ys.push(q.y - C.gap, q.y + q.d + C.gap); } });
		var so = stairOn(b, lv);
		if (so) { so.rects.forEach(function (q) { var m2 = so.top ? C.p : C.gap; xs.push(q.x - m2, q.x + q.w + m2); ys.push(q.y - m2, q.y + q.d + m2); }); }
		return { xs: xs, ys: ys, x0: Math.min.apply(null, xs0) + C.p, x1: Math.max.apply(null, xs0) - C.p, y0: Math.min.apply(null, ys0) + C.p, y1: Math.max.apply(null, ys0) - C.p };
	}
	function cands(lines, size, lo, hi) {
		var out = [], v;
		lines.forEach(function (e) { [e, e - size].forEach(function (q) { q = r2(q); if (q >= lo - 0.006 && q + size <= hi + 0.006) { out.push(q); } }); });
		for (v = lo; v + size <= hi + 1e-6; v = r2(v + 0.1)) { out.push(r2(v)); }
		return out.sort(function (a, c) { return a - c; }).filter(function (q, i, a) { return !i || q - a[i - 1] > 0.004; });
	}
	// The stair's place: along an outer wall, near the entrance, footprint, opening and landings inside the
	// house and off the bearing walls; every quarter turn is tried.
	function stairPlace(b) {
		var s0 = b.slab.stair;
		if (!s0 || !s0.type) { return false; }
		var ol = olOf(b), C = progCfg();
		if (!ol.closed) { return false; }
		var xs0 = ol.inner.map(function (q) { return q[0] / 1000; }), ys0 = ol.inner.map(function (q) { return q[1] / 1000; });
		var X0 = Math.min.apply(null, xs0) + C.p, X1 = Math.max.apply(null, xs0) - C.p, Y0 = Math.min.apply(null, ys0) + C.p, Y1 = Math.max.apply(null, ys0) - C.p;
		var ent = b.openings.filter(function (o) { return o.type === 'entrance' && o.lv === 0; })[0], ew = ent ? b.walls.filter(function (w) { return w.id === ent.wall; })[0] : null, ex = (X0 + X1) / 2, ey = Y1;
		if (ent && ew) { var L = Math.hypot(ew.b[0] - ew.a[0], ew.b[1] - ew.a[1]) || 1, u = ent.at + ent.w / 2; ex = ew.a[0] + (ew.b[0] - ew.a[0]) / L * u; ey = ew.a[1] + (ew.b[1] - ew.a[1]) / L * u; }
		var keep = JSON.stringify(s0), list = [], best = null;
		// every place and quarter turn, scored (near the entrance, its back to an outer wall), checked best first
		[0, 90, 180, 270].forEach(function (rot) {
			s0.rot = rot; syncStair(b);
			var w = s0.w, d = s0.d;
			for (var y = Y0; y + d <= Y1 + 1e-6; y = r2(y + 0.1)) {
				for (var x = X0; x + w <= X1 + 1e-6; x = r2(x + 0.1)) {
					var touch = Math.abs(x - X0) < 0.02 || Math.abs(x + w - X1) < 0.02 || Math.abs(y - Y0) < 0.02 || Math.abs(y + d - Y1) < 0.02;
					list.push([Math.hypot(x + w / 2 - ex, y + d / 2 - ey) + (touch ? 0 : 3), r2(x), r2(y), rot]);
				}
			}
		});
		list.sort(function (p, q) { return p[0] - q[0]; });
		for (var i = 0; i < list.length && i < 6000; i++) {
			s0.rot = list[i][3]; syncStair(b); s0.x = list[i][1]; s0.y = list[i][2];
			var ss = stairState(b);
			if (ss === 'ok' || ss === 'rules') { best = { x: s0.x, y: s0.y, rot: s0.rot }; break; }
		}
		if (best) { s0.x = best.x; s0.y = best.y; s0.rot = best.rot; syncStair(b); return true; }
		var k = JSON.parse(keep); s0.x = k.x; s0.y = k.y; s0.rot = k.rot; syncStair(b);
		return false;
	}
	// a designed stair keeps its footprint (w × d) in step with its calculation and quarter turn
	function syncStair(b) {
		var s = b.slab && b.slab.stair;
		if (!s || !s.type || b.levels.length < 2) { return; }
		var c = B.stairCalc(b, s.type, s.width);
		if (!c) { return; }
		var rot = s.rot || 0;
		s.w = r2(rot % 180 ? c.d : c.w); s.d = r2(rot % 180 ? c.w : c.d);
	}
	// The area balance of a level (m²): from the gross footprint to what is left for the next room.
	function progBudget(b, lv, rows) {
		var C = progCfg(), ol = olOf(b);
		if (!ol.closed) { return null; }
		var Ain = Math.abs(B._area2(ol.inner)) / 2e6, Aout = Math.abs(B._area2(ol.outer)) / 2e6, per = 0;
		ol.inner.forEach(function (p, i) { var q = ol.inner[(i + 1) % ol.inner.length]; per += Math.hypot(q[0] - p[0], q[1] - p[1]) / 1000; });
		var out = { gross: Aout, ext: Aout - Ain, inner: Ain, plaster: per * C.p, stair: 0, stairEst: false, kept: 0, parts: 0, partsEst: false, net: 0, rows: [] };
		// the stair: footprint below the top level, the opening on the top level
		if (b.levels.length > 1) {
			var so = stairOn(b, lv);
			if (so) { out.stair = so.top ? so.s.holeArea : so.s.foot.w * so.s.foot.d; } else { out.stair = num(C.stair.w, 1.1) * num(C.stair.d, 3.2); out.stairEst = true; }
		}
		// placed rooms: which of their sides face a kept (outer / bearing) wall – there only plaster
		var list = rows || (b.prog || []).filter(function (r) { return r.lv === lv; });
		var touching = function (w) { return list.some(function (r) { return r.placed !== false && r.x > -900 && hitRect(rr(Math.min(w.a[0], w.b[0]), Math.min(w.a[1], w.b[1]), Math.abs(w.b[0] - w.a[0]), Math.abs(w.b[1] - w.a[1])), r, w.t / 2 + C.pt + 0.05); }); };
		b.walls.forEach(function (w) {
			if (w.kind === 'ext' || w.lv !== lv) { return; }
			if (w.kind === 'part' && touching(w)) { return; }
			out.kept += Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) * (w.t + 2 * C.p);
		});
		list.forEach(function (r) {
			var A = r.w * r.d, sides = [[r.x, r.y, r.w, 0], [r.x, r.y + r.d, r.w, 0], [r.x, r.y, 0, r.d], [r.x + r.w, r.y, 0, r.d]], share = 0, est = !(r.placed && r.x > -900);
			sides.forEach(function (sd) {
				var len = sd[2] || sd[3];
				if (!est) {
					// a side against an outer or bearing wall (within plaster + 2 cm) needs no partition
					var m = C.p + 0.02, line = rr(sd[0] - (sd[2] ? 0 : m), sd[1] - (sd[3] ? 0 : m), sd[2] || 2 * m, sd[3] || 2 * m);
					if (wallRects(b, lv, ['ext', 'int']).some(function (w) { return hitRect(line, w, 0); })) { return; }
				}
				share += len * C.half;
			});
			if (est) { out.partsEst = true; }
			out.parts += share; out.net += A;
			out.rows.push({ id: r.id, area: A, share: share });
		});
		out.avail = out.inner - out.plaster - out.stair - out.kept - out.parts;
		out.rest = out.avail - out.net;
		// the next room: its own partitions come off too (a square room of area a takes 4·√a·half)
		var m2 = C.half, q = Math.max(0, out.rest);
		out.next = q > 0 ? Math.pow((-4 * m2 + Math.sqrt(16 * m2 * m2 + 4 * q)) / 2, 2) : 0;
		Object.keys(out).forEach(function (k) { if (typeof out[k] === 'number') { out[k] = Math.round(out[k] * 100) / 100; } });
		return out;
	}
	// good practice per room type: { area, side } minimums, or null
	function progMin(type) { var mn = progCfg().mins[type]; return mn ? { area: num(mn[0], 0), side: num(mn[1], 0) } : null; }
	function progAuto() {
		var miss = 0;
		change(function (b) { miss = progPlace(b, st.lv); });
		if (miss && A.toast) { A.toast(tf('b_prog_nofit', miss), 'warn'); }
	}
	// Partitions round the placed rooms: each wall in the middle of the gap between two rooms (partition +
	// plaster on both sides), collinear pieces joined, none where a kept wall already stands, the ends
	// reaching the wall they meet. Earlier partitions (not bearing walls) through or along a room go.
	function progWalls() {
		var made = 0, C = progCfg();
		change(function (b) {
			var lv = st.lv, md = (B.defaults().model || {}).wall || {}, pt = C.pt, pm = (md.part || {}).mat, m = C.half;
			var rs = (b.prog || []).filter(function (r) { return r.lv === lv && progState(b, r) === 'ok'; });
			if (!rs.length) { return; }
			var gone = b.walls.filter(function (w) {
				if (w.kind !== 'part' || w.lv !== lv) { return false; }
				var mm = w.t / 2 + pt + 0.05, ax = Math.min(w.a[0], w.b[0]), bx2 = Math.max(w.a[0], w.b[0]), ay = Math.min(w.a[1], w.b[1]), by = Math.max(w.a[1], w.b[1]);
				return rs.some(function (r) { return bx2 > r.x - mm && ax < r.x + r.w + mm && by > r.y - mm && ay < r.y + r.d + mm; });
			}).map(function (w) { return w.id; });
			if (gone.length) { b.walls = b.walls.filter(function (w) { return gone.indexOf(w.id) === -1; }); b.openings = b.openings.filter(function (o) { return gone.indexOf(o.wall) === -1; }); }
			var lines = {};
			var mmR = function (v) { return Math.round(v * 1000) / 1000; };
			function addSeg(dir, c, s0, s1) { c = r2(mmR(c)); var k = dir + ':' + c.toFixed(2); (lines[k] = lines[k] || { dir: dir, c: c, iv: [] }).iv.push([mmR(s0), mmR(s1)]); }
			rs.forEach(function (r) {
				addSeg('h', r.y - m, r.x - m, r.x + r.w + m); addSeg('h', r.y + r.d + m, r.x - m, r.x + r.w + m);
				addSeg('v', r.x - m, r.y - m, r.y + r.d + m); addSeg('v', r.x + r.w + m, r.y - m, r.y + r.d + m);
			});
			var walls = b.walls.filter(function (w) { return w.kind === 'ext' || w.lv === lv; });
			function union(iv) { iv.sort(function (p, q) { return p[0] - q[0]; }); var out = []; iv.forEach(function (q) { var l = out[out.length - 1]; if (l && q[0] <= l[1] + 0.02) { l[1] = Math.max(l[1], q[1]); } else { out.push(q.slice()); } }); return out; }
			function minus(iv, cut) { var out = []; iv.forEach(function (q) { var parts = [q.slice()]; cut.forEach(function (c) { parts = parts.reduce(function (acc, p) { if (c[1] <= p[0] || c[0] >= p[1]) { acc.push(p); return acc; } if (c[0] > p[0]) { acc.push([p[0], c[0]]); } if (c[1] < p[1]) { acc.push([c[1], p[1]]); } return acc; }, []); }); out = out.concat(parts); }); return out; }
			var newW = [];
			Object.keys(lines).forEach(function (k) {
				var L = lines[k], cut = [];
				walls.forEach(function (w) {
					var hz = w.a[1] === w.b[1], vt = w.a[0] === w.b[0];
					if (L.dir === 'h' && hz && Math.abs(w.a[1] - L.c) <= w.t / 2 + pt + 0.02) { cut.push([Math.min(w.a[0], w.b[0]) - w.t / 2, Math.max(w.a[0], w.b[0]) + w.t / 2]); }
					if (L.dir === 'v' && vt && Math.abs(w.a[0] - L.c) <= w.t / 2 + pt + 0.02) { cut.push([Math.min(w.a[1], w.b[1]) - w.t / 2, Math.max(w.a[1], w.b[1]) + w.t / 2]); }
				});
				minus(union(L.iv), cut).forEach(function (q) {
					if (q[1] - q[0] < 0.3) { return; }
					[0, 1].forEach(function (e) {
						var v = q[e];
						walls.concat(newW).forEach(function (w) {
							var hz = w.a[1] === w.b[1], reach = w.t / 2 + pt + 0.03;
							if (L.dir === 'h' && !hz && w.a[0] === w.b[0] && Math.abs(w.a[0] - v) <= reach && L.c >= Math.min(w.a[1], w.b[1]) - 0.01 && L.c <= Math.max(w.a[1], w.b[1]) + 0.01) { q[e] = w.a[0]; }
							if (L.dir === 'v' && hz && Math.abs(w.a[1] - v) <= reach && L.c >= Math.min(w.a[0], w.b[0]) - 0.01 && L.c <= Math.max(w.a[0], w.b[0]) + 0.01) { q[e] = w.a[1]; }
						});
					});
					var a = L.dir === 'h' ? [q[0], L.c] : [L.c, q[0]], c2 = L.dir === 'h' ? [q[1], L.c] : [L.c, q[1]];
					var nw = { id: B.nextId(b.walls.concat(newW), 'w'), kind: 'part', lv: lv, a: [r2(a[0]), r2(a[1])], b: [r2(c2[0]), r2(c2[1])], t: pt };
					if (pm) { nw.mat = pm; }
					newW.push(nw);
				});
			});
			b.walls = b.walls.concat(newW);
			made = newW.length;
			// each rectangle names the room that holds its middle (the room's own polygon decides)
			var rooms = B.rooms(B.normalize(b), lv);
			rs.forEach(function (r) {
				var mx = Math.round((r.x + r.w / 2) * 1000), my = Math.round((r.y + r.d / 2) * 1000);
				var rm = rooms.filter(function (q) { return B._inPoly(q.net, mx, my); }).sort(function (p, q) { return p.area - q.area; })[0];
				if (rm) { b.rooms[rm.key] = r.type === 'other' ? 'living' : r.type; }
			});
		});
		if (A.toast) { A.toast(tf('b_prog_walls_done', made), 'ok'); }
	}
	// The balance as a small table: from the gross footprint to what is left (the dialog and step 6)
	function budgetBox(bud, free) {
		if (!bud) { return el('p', { class: 'agh-bld-note is-warn', text: t('b_prog_no_outline') }); }
		var row = function (label, v, cls) { return el('div', { class: 'agh-bld-budrow' + (cls ? ' ' + cls : '') }, [el('span', { text: label }), el('b', { text: v })]); };
		var minus = function (v) { return '− ' + fmt(v, 2) + ' m²'; };
		var kids = [
			row(t('b_prog_gross'), fmt(bud.gross, 2) + ' m²'),
			row(t('b_prog_extwalls'), minus(bud.ext)),
			row(tf('b_prog_plaster', fmt(progCfg().p * 100, 1)), minus(bud.plaster))
		];
		if (bud.stair) { kids.push(row(t(bud.stairEst ? 'b_prog_stair_est' : 'b_prog_stair'), minus(bud.stair), bud.stairEst ? 'is-est' : '')); }
		if (bud.kept) { kids.push(row(t('b_prog_walls_kept'), minus(bud.kept))); }
		kids.push(row(t(bud.partsEst ? 'b_prog_parts_est' : 'b_prog_parts'), minus(bud.parts), bud.partsEst ? 'is-est' : ''));
		kids.push(row(t('b_prog_avail'), fmt(bud.avail, 2) + ' m²', 'is-sum'));
		kids.push(row(t('b_prog_sum'), minus(bud.net)));
		kids.push(row(t('b_prog_rest'), fmt(bud.rest, 2) + ' m²', 'is-sum' + (bud.rest < -0.005 ? ' is-bad' : ' is-ok')));
		if (bud.rest < -0.005) { kids.push(el('p', { class: 'agh-bld-note is-warn', text: tf('b_prog_over', fmt(-bud.rest, 2)) })); }
		else { kids.push(el('p', { class: 'agh-bld-note', text: tf('b_prog_next', fmt(bud.next, 1)) })); }
		if (free) { kids.push(el('p', { class: 'agh-bld-note agh-bld-progfree', 'data-w': String(free.w), 'data-d': String(free.d), text: tf('b_prog_free', fmt(free.w, 2), fmt(free.d, 2)) })); }
		kids.push(el('p', { class: 'agh-bld-note is-small', text: t('b_prog_net_note') }));
		return el('div', { class: 'agh-bld-budget', 'data-avail': String(bud.avail), 'data-net': String(bud.net), 'data-rest': String(bud.rest) }, kids);
	}
	// The stair (multi-level houses): type, flight width, the sizes worked out from the storey height, its state
	function stairBox() {
		var b = st.b;
		if (b.levels.length < 2) { return null; }
		var s = b.slab.stair, type = s && s.type ? s.type : null, kids = [];
		var pills = el('div', { class: 'agh-bld-pills' }, B.stairTypes.map(function (ty) {
			return el('button', { type: 'button', class: 'agh-pill agh-bld-pill agh-bld-stairtype' + (ty === type ? ' is-on' : ''), 'data-type': ty, 'aria-pressed': ty === type ? 'true' : 'false', onclick: function () {
				change(function (b2) {
					var cur = b2.slab.stair, olx = olOf(b2), bb = olx.closed ? bbox(olx.inner) : { x0: 0, y0: 0 };
					b2.slab.stair = { x: cur ? cur.x : r2(bb.x0 / 1000 + 0.3), y: cur ? cur.y : r2(bb.y0 / 1000 + 0.3), w: 1, d: 3, type: ty, width: cur && cur.width ? cur.width : 1.0, rot: cur && cur.rot ? cur.rot : 0 };
					syncStair(b2);
					if (stairState(b2) !== 'ok' && stairState(b2) !== 'rules') { stairPlace(b2); }
				});
			} }, t('b_stair_' + ty));
		}));
		kids.push(pills);
		if (type) {
			var c = B.stairCalc(b, type, s.width), ss = stairState(b);
			kids.push(el('div', { class: 'agh-bld-grid2' }, [
				field(t('b_stair_width'), numIn('slab.stair.width', { min: 0.6, max: 2, step: 0.05, set: function (v) { change(function (b2) { b2.slab.stair.width = r2(Math.max(0.6, Math.min(2, v))); syncStair(b2); }); } }), 'm'),
				field(t('b_stair_rot'), el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-bld-stairrot', onclick: function () { stairTurn(); } }, [A.icon('refresh', 'agh-ico-s'), (s.rot || 0) + '°']))
			]));
			kids.push(el('p', { class: 'agh-bld-note agh-bld-stairspec', text: tf('b_stair_spec', c.n, fmt(c.rise * 100, 1), fmt(c.going * 100, 0), fmt(c.blondel * 100, 1)) }));
			var sr = B.stairRects(b);
			kids.push(el('p', { class: 'agh-bld-note is-small', text: tf('b_stair_size', fmt(sr.foot.w, 2), fmt(sr.foot.d, 2), fmt(sr.holeArea, 2), fmt(c.headroom, 2)) }));
			Object.keys(c.checks).forEach(function (k) { if (!c.checks[k]) { kids.push(el('p', { class: 'agh-bld-note is-warn', text: t('b_stair_bad_' + k) })); } });
			if (ss !== 'ok' && ss !== 'rules') { kids.push(el('p', { class: 'agh-bld-note is-warn agh-bld-stairstate', text: t('b_stair_state_' + ss) })); }
			kids.push(el('div', { class: 'agh-bld-row' }, [el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-bld-stairauto', onclick: function () { var okp = false; change(function (b2) { okp = stairPlace(b2); }); if (!okp && A.toast) { A.toast(t('b_stair_nofit'), 'warn'); } } }, [A.icon('fit', 'agh-ico-s'), t('b_stair_place')])]));
		} else { kids.push(el('p', { class: 'agh-bld-note', text: t('b_stair_pick') })); }
		return group(t('b_stair'), kids, 'agh-bld-stairbox');
	}
	function stairTurn() { change(function (b) { var s = b.slab.stair; if (!s || !s.type) { return; } var c = B.stairRects(b), cx = c.foot.x + c.foot.w / 2, cy = c.foot.y + c.foot.d / 2; s.rot = ((s.rot || 0) + 90) % 360; syncStair(b); s.x = r2(cx - s.w / 2); s.y = r2(cy - s.d / 2); }); }
	function programBox() {
		var list = (st.b.prog || []).filter(function (r) { return r.lv === st.lv; }), ok = list.filter(function (r) { return progState(st.b, r) === 'ok'; }).length;
		var kids = [el('div', { class: 'agh-bld-row' }, [el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-primary agh-bld-progbtn', onclick: progDialog }, [A.icon('plus', 'agh-ico-s'), t('b_prog_open')])])];
		if (list.length) {
			kids.push(el('p', { class: 'agh-bld-note', text: tf('b_prog_status', ok, list.length) }));
			kids.push(el('div', { class: 'agh-bld-row' }, [
				el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost agh-bld-progauto', onclick: progAuto }, [A.icon('fit', 'agh-ico-s'), t('b_prog_auto')]),
				el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-bld-progwalls', disabled: ok ? null : 'disabled', onclick: progWalls }, [A.icon('home', 'agh-ico-s'), t('b_prog_walls')]),
				el('button', { type: 'button', class: 'agh-btn agh-btn-s agh-btn-ghost', onclick: function () { change(function (b) { b.prog = (b.prog || []).filter(function (r) { return r.lv !== st.lv; }); }); st.sel = null; } }, [A.icon('trash', 'agh-ico-s'), t('b_prog_clear')])
			]));
			kids.push(el('p', { class: 'agh-bld-note is-small', text: t('b_prog_hint') }));
		}
		var placed = list.length && ok === list.length;
		kids.push(budgetBox(progBudget(st.b, st.lv), placed || !list.length ? progLargestFit(st.b, st.lv) : null));
		return group(t('b_prog'), kids);
	}
	// The dialog: room pills to add, then one row per room (name, area, optional width × depth), the area
	// balance live above the list, and per room where and how it fits (worked out on a copy of the plan).
	function progDialog() {
		var old = D.root.querySelector('.agh-bld-modal');
		if (old) { old.remove(); }
		var rows = (st.b.prog || []).filter(function (r) { return r.lv === st.lv; }).map(function (r) { return { id: r.id, type: r.type, name: r.name, area: r.area, w: r.w, d: r.d, x: r.x, y: r.y, keepWD: true, placed: r.placed }; });
		var list = el('div', { class: 'agh-bld-proglist' }), budget = el('div', { class: 'agh-bld-progbudget' }), fitAt = {};
		// a trial run on a copy: the rows as rectangles, placed like the automatic placement does
		function trial() {
			var b = JSON.parse(JSON.stringify(st.b)), lv = st.lv, ids = [];
			b.prog = (b.prog || []).filter(function (r) { return r.lv !== lv; });
			rows.forEach(function (r, i) {
				var dims = r.keepWD ? [r.w, r.d] : progDims(r.area), id = r.id || ('t' + i);
				b.prog.push({ id: id, type: r.type, name: r.name, area: r2(dims[0] * dims[1]), w: dims[0], d: dims[1], x: r.x || 0, y: r.y || 0, lv: lv, keepWD: !!r.keepWD, placed: false });
				ids.push(id);
			});
			// rows already placed keep their place when still good; the others are placed now
			var keep = b.prog.filter(function (r) { return r.lv === lv && rows.some(function (q) { return q.id === r.id && q.placed && q.keepWD; }) && progState(b, r) === 'ok'; }).map(function (r) { return r.id; });
			progPlace(b, lv, ids.filter(function (id) { return keep.indexOf(id) === -1; }));
			keep.forEach(function (id) { b.prog.forEach(function (r) { if (r.id === id) { r.placed = true; } }); });
			fitAt = {};
			b.prog.forEach(function (r, i) { if (r.lv === lv) { fitAt[r.id] = r; } });
			return { b: b, ids: ids };
		}
		function draw() {
			var T = trial();
			budget.innerHTML = '';
			var bud = progBudget(T.b, st.lv), all = T.ids.every(function (id) { return fitAt[id] && fitAt[id].placed; });
			budget.appendChild(budgetBox(bud, all ? progLargestFit(T.b, st.lv) : null));
			list.innerHTML = '';
			if (!rows.length) { list.appendChild(el('p', { class: 'agh-bld-note', text: t('b_prog_empty') })); return; }
			if (rows.length >= 3 && !rows.some(function (r) { return r.type === 'hall' || r.type === 'corridor'; }) && bud) {
				var C = progCfg();
				list.appendChild(el('p', { class: 'agh-bld-note is-small', text: tf('b_prog_circ', C.circ[0] + '–' + C.circ[1], fmt(bud.avail * C.circ[0] / 100, 1)) }));
			}
			rows.forEach(function (r, i) {
				var id = T.ids[i], f = fitAt[id], mn = progMin(r.type), ra = r.keepWD ? r.w * r.d : r.area;
				var nm = el('input', { type: 'text', class: 'agh-input', value: r.name || progName(r.type), maxlength: '40', 'aria-label': t('b_prog_name') });
				nm.addEventListener('input', function () { r.name = nm.value; });
				var ar = el('input', { type: 'number', class: 'agh-input agh-bld-num', value: String(r.area), min: '1', max: '500', step: '0.5', inputmode: 'decimal', 'aria-label': t('b_prog_area') });
				var ww = el('input', { type: 'number', class: 'agh-input agh-bld-num', value: r.keepWD ? String(r.w) : '', min: '0.8', max: '30', step: '0.1', inputmode: 'decimal', placeholder: '–', 'aria-label': t('b_w') });
				var dd = el('input', { type: 'number', class: 'agh-input agh-bld-num', value: r.keepWD ? String(r.d) : '', min: '0.8', max: '30', step: '0.1', inputmode: 'decimal', placeholder: '–', 'aria-label': t('b_d') });
				ar.addEventListener('change', function () { r.area = num(ar.value, r.area); r.keepWD = false; r.placed = false; draw(); });
				var wd = function () { var w = num(ww.value, 0), d = num(dd.value, 0); if (w > 0.7 && d > 0.7) { r.w = w; r.d = d; r.area = r2(w * d); r.keepWD = true; r.placed = false; draw(); } };
				ww.addEventListener('change', wd); dd.addEventListener('change', wd);
				var fit = f && f.placed ? el('span', { class: 'agh-bld-progfit is-ok', text: tf('b_prog_fits', fmt(f.w, 2), fmt(f.d, 2)) }) : el('span', { class: 'agh-bld-progfit is-bad', text: t('b_prog_nofit_row') });
				var warn = mn && (ra < mn.area - 0.01 || Math.min(f ? f.w : 99, f ? f.d : 99) < mn.side - 0.01) ? el('span', { class: 'agh-bld-progfit is-warn', text: tf('b_prog_min', progName(r.type), fmt(mn.area, 1), fmt(mn.side, 2)) }) : null;
				list.appendChild(el('div', { class: 'agh-bld-progrow' + (f && f.placed ? '' : ' is-bad'), 'data-type': r.type, 'data-fit': f && f.placed ? '1' : '0' }, [
					el('div', { class: 'agh-bld-progname' }, [nm]),
					el('label', { class: 'agh-bld-progarea' }, [ar, el('span', { text: 'm²' })]),
					el('div', { class: 'agh-bld-progwd', title: t('b_prog_wd') }, [ww, el('span', { text: '×' }), dd, el('span', { text: 'm' })]),
					el('button', { type: 'button', class: 'agh-iconbtn', title: t('b_prog_remove'), 'aria-label': t('b_prog_remove'), onclick: function () { rows.splice(i, 1); draw(); } }, A.icon('trash')),
					el('div', { class: 'agh-bld-progfits' }, [fit, warn])
				]));
			});
		}
		var defaults = { living_kitchen: 40, living: 28, kitchen: 12, dining: 14, master: 16, bedroom: 12, kids: 11, guest: 11, bathroom: 7, wc: 2, hall: 8, office: 10, laundry: 5, wardrobe: 5, pantry: 3, corridor: 6, technical: 5, utility: 5 };
		var pills = el('div', { class: 'agh-bld-pills' }, A.roomTypes().map(function (o) {
			return el('button', { type: 'button', class: 'agh-pill agh-bld-pill', 'data-type': o[0], onclick: function () { rows.push({ type: o[0], name: o[1], area: defaults[o[0]] || 12 }); draw(); list.lastChild && list.lastChild.scrollIntoView && list.lastChild.scrollIntoView({ block: 'nearest' }); } }, o[1]);
		}).concat([el('button', { type: 'button', class: 'agh-pill agh-bld-pill is-custom', 'data-type': 'other', onclick: function () { rows.push({ type: 'other', name: t('b_prog_custom'), area: 10 }); draw(); } }, [A.icon('plus', 'agh-ico-s'), t('b_prog_custom')])]));
		var close = function () { modal.remove(); };
		// Done: the rows become rectangles placed in the base where they fit (the trial's places and sizes),
		// the others wait beside the house
		var done = function () {
			var T = trial(), miss = 0;
			change(function (b) {
				var lv = st.lv;
				b.prog = (b.prog || []).filter(function (r) { return r.lv !== lv; });
				rows.forEach(function (r, i) {
					var f = fitAt[T.ids[i]], id = r.id || B.nextId(b.prog, 'r');
					if (f && f.placed) { b.prog.push({ id: id, type: r.type, name: r.name, area: r2(f.w * f.d), w: f.w, d: f.d, x: f.x, y: f.y, lv: lv, placed: true }); return; }
					var dims = r.keepWD ? [r.w, r.d] : progDims(r.area), pk = progPark(b);
					b.prog.push({ id: id, type: r.type, name: r.name, area: r2(dims[0] * dims[1]), w: dims[0], d: dims[1], x: pk[0], y: pk[1], lv: lv, placed: false });
					miss++;
				});
				if (T.b.slab.stair && b.slab.stair) { b.slab.stair = T.b.slab.stair; }
			});
			close(); fitView(); renderPlan();
			if (miss && A.toast) { A.toast(tf('b_prog_nofit', miss), 'warn'); }
		};
		var modal = el('div', { class: 'agh-bld-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('b_prog') }, [
			el('div', { class: 'agh-bld-modal-box' }, [
				el('div', { class: 'agh-bld-modal-head' }, [el('h3', { class: 'agh-bld-h', text: t('b_prog_title') }), el('button', { type: 'button', class: 'agh-iconbtn', 'aria-label': t('b_prog_done'), title: t('b_prog_done'), onclick: close }, A.icon('close'))]),
				el('p', { class: 'agh-bld-note', text: t('b_prog_lead') }),
				budget,
				el('p', { class: 'agh-bld-note is-small', text: t('b_prog_add_hint') }),
				pills, list,
				el('div', { class: 'agh-bld-modal-foot' }, [el('button', { type: 'button', class: 'agh-btn agh-btn-primary agh-bld-progdone', onclick: done }, t('b_prog_done'))])
			])
		]);
		modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
		modal.addEventListener('click', function (e) { if (e.target === modal) { close(); } });
		draw();
		D.root.appendChild(modal);
		var first = modal.querySelector('.agh-bld-pill'); if (first) { first.focus(); }
	}
	// A held wall slides square to itself (grid steps), the joined walls follow; an opening slides along its
	// wall (5 cm steps). Shared by the plan and the 3D construction view (1.19.0).
	function moveSel(p) {
		var o = find(st.drag.move), dx = p[0] - st.drag.p0[0], dy = p[1] - st.drag.p0[1], g = B.defaults().grid || 0.1;
		if (!o) { return false; }
		if (st.drag.move.k === 'stair') {
			var sx = Math.round((st.drag.orig.x + dx) / g) * g, sy = Math.round((st.drag.orig.y + dy) / g) * g, sn2 = progSnap(sx, sy, o.w, o.d, 'stair');
			o.x = r2(sn2[0]); o.y = r2(sn2[1]);
			st.drag.moved = true;
			return true;
		}
		if (st.drag.move.k === 'room') {
			var rx = Math.round((st.drag.orig.x + dx) / g) * g, ry = Math.round((st.drag.orig.y + dy) / g) * g, sn = progSnap(rx, ry, o.w, o.d, o.id);
			o.x = r2(sn[0]); o.y = r2(sn[1]);
			st.drag.moved = true;
			return true;
		}
		if (st.drag.move.k === 'wall') {
			var od = st.drag.orig, ddx = Math.round(dx / g) * g, ddy = Math.round(dy / g) * g;
			if (od.a[1] === od.b[1]) { ddx = 0; } else if (od.a[0] === od.b[0]) { ddy = 0; }
			var na = [r2(od.a[0] + ddx), r2(od.a[1] + ddy)], nb = [r2(od.b[0] + ddx), r2(od.b[1] + ddy)];
			moveJoined(st.b, o.a, na, o.id); moveJoined(st.b, o.b, nb, o.id); o.a = na; o.b = nb;
		} else {
			var w1 = st.b.walls.filter(function (x) { return x.id === o.wall; })[0];
			if (w1) { var L = Math.hypot(w1.b[0] - w1.a[0], w1.b[1] - w1.a[1]) || 1, du = (dx * (w1.b[0] - w1.a[0]) + dy * (w1.b[1] - w1.a[1])) / L; o.at = r2(Math.round((st.drag.orig.at + du) / 0.05) * 0.05); }
		}
		st.drag.moved = true;
		return true;
	}
	// Arrows move the selection: a wall square to itself (10 cm, Shift 50 cm), an opening along its wall.
	function nudgeSel(key, big) {
		var o = find(st.sel);
		if (!o) { return false; }
		var d = big ? 0.5 : 0.1, dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
		if (!dir) { return false; }
		change(function (b) {
			if (st.sel.k === 'room') { var rr = (b.prog || []).filter(function (q) { return q.id === o.id; })[0]; if (rr) { rr.x = r2(rr.x + dir[0] * d); rr.y = r2(rr.y + dir[1] * d); } return; }
			if (st.sel.k === 'stair') { if (b.slab.stair) { b.slab.stair.x = r2(b.slab.stair.x + dir[0] * d); b.slab.stair.y = r2(b.slab.stair.y + dir[1] * d); } return; }
			if (st.sel.k === 'wall') {
				var w = b.walls.filter(function (q) { return q.id === o.id; })[0], dx = dir[0] * d, dy = dir[1] * d;
				if (w.a[1] === w.b[1]) { dx = 0; } else if (w.a[0] === w.b[0]) { dy = 0; }
				if (!dx && !dy) { return; }
				var na = [r2(w.a[0] + dx), r2(w.a[1] + dy)], nb = [r2(w.b[0] + dx), r2(w.b[1] + dy)];
				moveJoined(b, w.a, na, w.id); moveJoined(b, w.b, nb, w.id); w.a = na; w.b = nb;
			} else {
				var op = b.openings.filter(function (q) { return q.id === o.id; })[0], wl = b.walls.filter(function (q) { return q.id === op.wall; })[0];
				if (!wl) { return; }
				var L = Math.hypot(wl.b[0] - wl.a[0], wl.b[1] - wl.a[1]) || 1, s = (dir[0] * (wl.b[0] - wl.a[0]) + dir[1] * (wl.b[1] - wl.a[1])) / L;
				if (Math.abs(s) < 0.2) { return; }
				op.at = r2(Math.max(0, op.at + (s > 0 ? d : -d)));
			}
		});
		return true;
	}
	/* ------------------------------------------------------------------ 3D construction view (1.19.0)
	 * The same selection, delete and moves as on the plan, in the 3D view of steps 5–7: the viewer hands
	 * over the point under the pointer in plan metres; a box shows what is selected. */
	function can3D() { return !!st && st.view === '3d' && st.step >= 5 && st.step <= 7; }
	function hook3D(on) {
		var v = A && A.viewer ? A.viewer() : null;
		if (!v) { return; }
		v.onBuildGrab = on ? grab3D : null; v.onBuildDrag = on ? drag3D : null; v.onBuildDrop = on ? drop3D : null;
		if (!on && v.markBox) { v.markBox(null); }
	}
	function lvAt(y) {
		var b = st.b, z = b.found.top, lv = 0;
		for (var i = 0; i < b.levels.length; i++) { if (y >= z - 0.05) { lv = i; } z += b.levels[i].h; }
		return lv;
	}
	// The wall or opening the ray meets first (its box in plan metres; an opening wins inside its wall).
	function rayPick(R) {
		var b = st.b, best = null, top = B.levelBase(b, b.levels.length - 1) + b.levels[b.levels.length - 1].h;
		function box(w, u0, u1, n, y0, y1) {
			var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
			var ox = R.o[0] - w.a[0], oy = R.o[1] - w.a[1], o = [ox * ux + oy * uy, -ox * uy + oy * ux, R.o[2]], d = [R.d[0] * ux + R.d[1] * uy, -R.d[0] * uy + R.d[1] * ux, R.d[2]];
			var lo = [u0, -n, y0], hi = [u1, n, y1], t0 = 0, t1 = 1e9;
			for (var k = 0; k < 3; k++) {
				if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) { return null; } continue; }
				var a = (lo[k] - o[k]) / d[k], c = (hi[k] - o[k]) / d[k];
				if (a > c) { var q = a; a = c; c = q; }
				t0 = Math.max(t0, a); t1 = Math.min(t1, c);
				if (t0 > t1) { return null; }
			}
			return t0;
		}
		b.openings.forEach(function (op) {
			var w = b.walls.filter(function (q) { return q.id === op.wall; })[0];
			if (!w) { return; }
			var z0 = B.levelBase(b, op.lv) + op.sill, tt = box(w, op.at, op.at + op.w, w.t / 2 + 0.06, z0, z0 + op.h);
			if (tt !== null && (!best || tt < best.t + 0.4)) { if (!best || best.k !== 'op' || tt < best.t) { best = { k: 'op', id: op.id, t: tt, lv: op.lv }; } }
		});
		b.walls.forEach(function (w) {
			var z0 = w.kind === 'ext' ? B.levelBase(b, 0) : B.levelBase(b, w.lv), z1 = w.kind === 'ext' ? top : z0 + b.levels[w.lv].h, tt = box(w, 0, Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), w.t / 2, z0, z1);
			if (tt === null) { return; }
			if (!best || (best.k === 'wall' && tt < best.t) || (best.k === 'op' && tt < best.t - 0.4)) { best = { k: 'wall', id: w.id, t: tt, lv: w.kind === 'ext' ? null : w.lv }; }
		});
		return best;
	}
	function grab3D(p, o) {
		if (!can3D()) { return false; }
		var rp = o && o.ray ? rayPick(o.ray) : null, hit = null, y = o && o.y;
		if (rp) {
			hit = { k: rp.k, id: rp.id };
			if (rp.lv !== null && rp.lv !== undefined) { st.lv = rp.lv; }
			// the point where the ray meets the piece (not what lies behind a window hole)
			p = [o.ray.o[0] + o.ray.d[0] * rp.t, o.ray.o[1] + o.ray.d[1] * rp.t]; y = o.ray.o[2] + o.ray.d[2] * rp.t;
		}
		else {
			var lv = lvAt(o && o.y !== undefined ? o.y : 0);
			if (lv !== st.lv && st.b.levels.length > 1) { st.lv = lv; }
			hit = hitTest(p, 0.3);
		}
		st.sel = hit; renderPanel(); renderSelBar(); mark3D();
		if (!hit) { return false; }
		st.drag = { move: hit, p0: p, orig: JSON.parse(JSON.stringify(find(hit))), snap: snapshot(), d3: true };
		// the plane the viewer drags on: the wall's own (an opening slides in it), or across the wall
		var ob = find(hit), ww = hit.k === 'wall' ? ob : st.b.walls.filter(function (q) { return q.id === ob.wall; })[0], n = null;
		if (ww) { var L = Math.hypot(ww.b[0] - ww.a[0], ww.b[1] - ww.a[1]) || 1, ux = (ww.b[0] - ww.a[0]) / L, uy = (ww.b[1] - ww.a[1]) / L; n = hit.k === 'wall' ? [ux, uy] : [-uy, ux]; }
		return { y: y, pt: p, n: n };
	}
	function drag3D(p) { if (st && st.drag && st.drag.d3 && moveSel(p)) { mark3D(); } }
	function drop3D(cancel, moved) {
		if (!st || !st.drag) { return; }
		var d = st.drag;
		st.drag = null;
		if (cancel && d.moved) { st.b = JSON.parse(d.snap); renderPanel(); mark3D(); return; }
		if (d.moved && moved) { st.undo.push(d.snap); st.redo = []; commit(); }
	}
	// the box around the selected wall or opening, in the scene's metres
	function mark3D() {
		var v = A && A.viewer ? A.viewer() : null, o = st && st.sel ? find(st.sel) : null, org = v && v.house && v.house.origin;
		if (!v || !v.markBox) { return; }
		if (!o || !org || st.view !== '3d') { v.markBox(null); return; }
		var b = st.b, errs = B.check(b).errors || [], bad = errs.some(function (e) { return String(e.ref || '').split(',').indexOf(o.id) !== -1; });
		var w = st.sel.k === 'wall' ? o : b.walls.filter(function (q) { return q.id === o.wall; })[0];
		if (!w) { v.markBox(null); return; }
		var L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
		var lv = st.sel.k === 'wall' ? (w.kind === 'ext' ? 0 : w.lv) : o.lv, z0 = B.levelBase(b, lv), rot = -Math.atan2(uy, ux);
		if (st.sel.k === 'wall') {
			var top = w.kind === 'ext' ? B.levelBase(b, b.levels.length - 1) + b.levels[b.levels.length - 1].h : z0 + b.levels[lv].h;
			v.markBox({ x: (w.a[0] + w.b[0]) / 2 - org[0], z: (w.a[1] + w.b[1]) / 2 - org[1], y0: z0, y1: top, len: L + 0.04, t: w.t + 0.06, rot: rot, bad: bad });
		} else {
			var u = o.at + o.w / 2;
			v.markBox({ x: w.a[0] + ux * u - org[0], z: w.a[1] + uy * u - org[1], y0: z0 + o.sill, y1: z0 + o.sill + o.h, len: o.w + 0.06, t: w.t + 0.12, rot: rot, bad: bad });
		}
	}
	// Above the drawing: what is selected, and a delete button (in the plan and in the 3D view).
	function renderSelBar() {
		if (!D.selBar || !st) { return; }
		D.selBar.innerHTML = '';
		var o = find(st.sel);
		D.selBar.hidden = !o;
		if (!o) { return; }
		var name = st.sel.k === 'stair' ? t('b_stair') + (o.type ? ' · ' + t('b_stair_' + o.type) : '') + ' · ' + fmt(o.w, 2) + ' × ' + fmt(o.d, 2) + ' m' : (st.sel.k === 'wall' ? t('b_kind_' + o.kind) : (st.sel.k === 'room' ? (o.name || progName(o.type)) + ' · ' + fmt(o.w * o.d, 1) + ' m²' : t('b_op_' + o.type)));
		D.selBar.appendChild(el('span', { class: 'agh-bld-selname', text: st.sel.k === 'room' || st.sel.k === 'stair' ? name : name + ' · ' + o.id }));
		D.selBar.appendChild(el('button', { type: 'button', class: 'agh-iconbtn agh-bld-seldel', title: t('b_delete') + ' (Del)', 'aria-label': t('b_delete') }, A.icon('trash')));
		D.selBar.lastChild.addEventListener('click', function () { delSel(); });
		mark3D();
	}
	function hitTest(p, tol) {
		var lv = st.lv, best = null;
		(st.step === 6 ? st.b.prog || [] : []).forEach(function (r) { if (r.lv === lv && p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.d) { best = { k: 'room', id: r.id }; } });
		if (best) { return best; }
		if (st.step === 6 && st.b.slab.stair && st.b.levels.length > 1) { var so = stairOn(st.b, lv); if (so && so.rects.some(function (q) { return p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.d; })) { return { k: 'stair', id: 'stair' }; } }
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
			var md = D.root && D.root.querySelector('.agh-bld-modal');
			if (md) { md.remove(); e.preventDefault(); return true; }
			if (st.draw) { st.draw = null; renderPlan(); e.preventDefault(); return true; }
			if (st.sel) { st.sel = null; renderPanel(); renderPlan(); renderSelBar(); e.preventDefault(); return true; }
			return false; // the designer leaves the full screen (and never closes itself in build mode)
		}
		if (typing) { return false; }
		if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) { redo(); } else { undo(); } return true; }
		if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return true; }
		if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) { e.preventDefault(); delSel(); return true; }
		if (st.sel && /^Arrow/.test(e.key) && nudgeSel(e.key, e.shiftKey)) { e.preventDefault(); return true; }
		return false;
	}

	// load a whole drawing (a saved one, a template or a test house) as one undoable change
	function load(b) { change(function () { st.b = B.normalize(b); }); st.sel = null; fitView(); renderAll(); }
	root.AGH_BuildUI = { version: '1.0.0', open: open, close: close, onKey: onKey, load: load, state: function () { return st; }, pick3D: function (ray) { return st ? rayPick(ray) : null; }, _prog: { budget: function (lv) { return progBudget(st.b, lv === undefined ? st.lv : lv); }, state: function (r) { return progState(st.b, r); }, stairState: function () { return stairState(st.b); }, largest: function (lv) { return progLargestFit(st.b, lv === undefined ? st.lv : lv); }, cfg: progCfg, raw: function (lv) { return progLargest(progGrid(st.b, lv || 0, null, true)); } }, goStep: function (i) { goStep(i); }, closeStep: function () { closeStep(); }, setView: function (v) { setView(v); }, setPhase: function (p) { setPhase(p); } };
}(window));
