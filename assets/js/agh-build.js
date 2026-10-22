/*! AutoGroweHome – „Építés az alapoktól” (build mode) core: data model, wall graph → rooms and outline,
 * outline → volumes for the shared plan (agh-sketch.js), geometric checks, bill of materials and the
 * data-driven rule engine. No DOM access: runs in the browser (window.AGH_Build) and in Node (tests).
 *
 * Coordinates: metres, the same axes as the sketch – x along the street front, y towards the viewer
 * (the street side is max y). Internally the geometry works in whole millimetres (half wall thicknesses stay exact), so the JS and the PHP
 * port (includes/Build/Geometry.php) give identical results.
 *
 * Nothing here is a structural or permit calculation: the checks warn, they never block saving.
 */
(function (root, factory) {
	var api = factory();
	root.AGH_Build = api;
	if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
}(typeof window !== 'undefined' ? window : this, function () {
	'use strict';

	var DATA = { defaults: null, packs: {} };
	var STEPS = ['site', 'earth', 'found', 'ducts', 'ground', 'walls', 'parts', 'openings', 'slab', 'roof', 'install', 'services', 'plaster', 'screed', 'finish', 'outside'];
	var ACTIVE_STEPS = 10; // 0–9 in 1.14.0; 10–15 come in 1.14.1–1.14.3
	var OPENING_TYPES = ['window', 'door', 'entrance', 'terrace'];
	var LINTELS = ['auto', 'precast', 'rc', 'steel', 'none'];
	var KINDS = ['ext', 'int', 'part'];

	function setData(d) {
		if (d && d.defaults) { DATA.defaults = d.defaults; }
		if (d && d.rules) { Object.keys(d.rules).forEach(function (k) { if (d.rules[k] && d.rules[k].rules) { DATA.packs[k] = d.rules[k]; } }); }
		return api;
	}
	function DF() { return DATA.defaults || { model: {}, walls: {}, insulations: {}, foundations: {}, slabs: {}, waste: {}, practice: [], lintel: { lengths: [] }, limits: {} }; }
	function MD() { return DF().model || {}; }
	function pack(country) { return DATA.packs[country] || null; }

	/* ------------------------------------------------------------------ small helpers */
	function num(v, d) { var n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v; return typeof n === 'number' && isFinite(n) ? n : d; }
	function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
	function r2(v) { return Math.round(v * 100) / 100; }
	function r3(v) { return Math.round(v * 1000) / 1000; }
	function C(v) { return Math.round(v * 1000); }         // metres → whole millimetres (inputs are snapped to 1 cm)
	function M(c) { return c / 1000; }                     // millimetres → metres
	function oneOf(v, list, d) { return list.indexOf(v) !== -1 ? v : d; }
	var STAIR_TYPES = ['straight', 'l', 'u', 'spiral'];
	function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
	function text(v, max) { return typeof v === 'string' ? v.replace(/[<>\u0000-\u001f]/g, '').slice(0, max) : ''; }
	function nOrNull(v, a, b) { var n = num(v, NaN); return isFinite(n) ? r2(clamp(n, a, b)) : null; }
	function deep(o) { return JSON.parse(JSON.stringify(o)); }
	function get(o, path) { return path.split('.').reduce(function (a, k) { return a && a[k] !== undefined ? a[k] : undefined; }, o); }

	/* ------------------------------------------------------------------ data model */
	// A fresh, valid build (nothing drawn yet). Every value can be overridden by the user.
	function create() {
		var m = MD();
		return normalize({ v: 1, step: 0, levels: [{ h: m.level_h || 3 }] });
	}

	// Sanitises anything (user input, a saved project, an older version) into a valid build object.
	function normalize(raw) {
		var m = MD(), L = DF().limits || {}, b = isObj(raw) ? raw : {}, wd = m.wall || {};
		var site = isObj(b.site) ? b.site : {}, rules = isObj(b.rules) ? b.rules : {}, hz = isObj(rules.hesz) ? rules.hesz : {};
		var me = m.earth || {}, mf = m.found || {}, mdu = m.ducts || {}, mg = m.ground || {}, mr = m.ring || {}, ms = m.slab || {};
		var e = isObj(b.earth) ? b.earth : {}, fd = isObj(b.found) ? b.found : {}, du = isObj(b.ducts) ? b.ducts : {};
		var gr = isObj(b.ground) ? b.ground : {}, rg = isObj(b.ring) ? b.ring : {}, sl = isObj(b.slab) ? b.slab : {};
		var mats = DF().walls || {}, ins = DF().insulations || {}, fnd = Object.keys(DF().foundations || {}), sls = Object.keys(DF().slabs || {});
		var lvMax = L.levels_max || 3;
		var o = {
			v: 1,
			step: clamp(Math.round(num(b.step, 0)), 0, STEPS.length - 1),
			done: {},
			site: {
				country: /^[a-z]{2}$/.test(site.country || '') ? site.country : 'hu',
				region: /^[a-z0-9_]{1,32}$/.test(site.region || '') ? site.region : '',
				town: text(site.town, 60),
				frost: nOrNull(site.frost, 0.3, 2.5),
				soil: oneOf(site.soil, DF().soils || ['clay'], me.soil || 'clay'),
				house: { x: r2(clamp(num(get(site, 'house.x'), get(m, 'house.x') || 4), 0, 500)), y: r2(clamp(num(get(site, 'house.y'), get(m, 'house.y') || 12), 0, 1000)) }
			},
			rules: {
				mode: oneOf(rules.mode, ['on', 'off', 'custom'], 'on'),
				custom: {},
				hesz: {
					coverage: nOrNull(hz.coverage, 0, 100), height: nOrNull(hz.height, 0, 40), front: nOrNull(hz.front, 0, 100),
					side: nOrNull(hz.side, 0, 100), back: nOrNull(hz.back, 0, 200), pitch_min: nOrNull(hz.pitch_min, 0, 75), pitch_max: nOrNull(hz.pitch_max, 0, 75),
					source: text(hz.source, 160)
				}
			},
			earth: { topsoil: r2(clamp(num(e.topsoil, me.topsoil || 0.3), 0, 1)), margin: r2(clamp(num(e.margin, me.margin || 1), 0, 5)) },
			found: {
				type: oneOf(fd.type, fnd.length ? fnd : ['strip_rc'], mf.type || 'strip_rc'),
				w: r2(clamp(num(fd.w, mf.w || 0.5), 0.2, 2)), d: r2(clamp(num(fd.d, mf.d || 0.9), 0.3, 3)),
				top: r2(clamp(num(fd.top, mf.top || 0.3), 0, 1.5)), partitions: oneOf(fd.partitions, ['auto', 'strip', 'none'], mf.partitions || 'auto')
			},
			ducts: { sewer: du.sewer !== undefined ? !!du.sewer : mdu.sewer !== false, water: du.water !== undefined ? !!du.water : mdu.water !== false, earth: du.earth !== undefined ? !!du.earth : mdu.earth !== false, conduits: clamp(Math.round(num(du.conduits, mdu.conduits || 0)), 0, 30) },
			ground: { fill: r2(clamp(num(gr.fill, mg.fill || 0.2), 0, 1)), concrete: r2(clamp(num(gr.concrete, mg.concrete || 0.1), 0, 0.4)), membrane: oneOf(gr.membrane, ['bitumen', 'pvc', 'none'], mg.membrane || 'bitumen'), xps: r2(clamp(num(gr.xps, mg.xps || 0.1), 0, 0.3)) },
			levels: [],
			attic: !!b.attic,
			ring: { h: r2(clamp(num(rg.h, mr.h || 0.25), 0.15, 0.6)), insul: r2(clamp(num(rg.insul, mr.insul || 0.05), 0, 0.15)) },
			slab: { type: oneOf(sl.type, sls.length ? sls : ['rc'], ms.type || 'rc'), t: r2(clamp(num(sl.t, ms.t || 0.2), 0.1, 0.4)), stair: null },
			walls: [],
			openings: [],
			rooms: {},
			services: [],
			surfaces: [],
			guessed: [],
			prog: []
		};
		if (o.ring.h < o.slab.t) { o.ring.h = o.slab.t; }
		(Array.isArray(b.levels) ? b.levels : []).slice(0, lvMax).forEach(function (lv) {
			o.levels.push({ h: r2(clamp(num(isObj(lv) ? lv.h : lv, m.level_h || 3), L.level_h_min || 2.4, L.level_h_max || 4.5)) });
		});
		if (!o.levels.length) { o.levels.push({ h: m.level_h || 3 }); }
		if (isObj(sl.stair)) {
			var st = sl.stair;
			o.slab.stair = { x: r2(num(st.x, 0)), y: r2(num(st.y, 0)), w: r2(clamp(num(st.w, 1), 0.6, 6)), d: r2(clamp(num(st.d, 3), 0.6, 8)) };
			// 1.21.0: a designed stair – type, flight width, quarter turns; w × d is then its computed footprint
			if (STAIR_TYPES.indexOf(st.type) !== -1) {
				o.slab.stair.type = st.type;
				o.slab.stair.width = r2(clamp(num(st.width, 1), 0.6, 2));
				o.slab.stair.rot = [0, 90, 180, 270].indexOf(Math.round(num(st.rot, 0))) !== -1 ? Math.round(num(st.rot, 0)) : 0;
			}
		}
		if (isObj(b.done)) { Object.keys(b.done).forEach(function (k) { if (/^\d{1,2}$/.test(k) && +k < STEPS.length && typeof b.done[k] === 'string') { o.done[k] = b.done[k].slice(0, 40); } }); }
		if (isObj(rules.custom)) {
			Object.keys(rules.custom).slice(0, 80).forEach(function (k) {
				var cv = rules.custom[k];
				if (!/^[a-z0-9_]{1,48}$/.test(k) || !isObj(cv)) { return; }
				o.rules.custom[k] = { on: cv.on !== false, value: nOrNull(cv.value, -1000, 100000) };
			});
		}
		var ids = {}, seq = 0;
		function uid(p, v) { var id = typeof v === 'string' && /^[a-z]\d{1,5}$/.test(v) && !ids[v] ? v : ''; while (!id || ids[id]) { id = p + (++seq); } ids[id] = 1; return id; }
		(Array.isArray(b.walls) ? b.walls : []).slice(0, L.walls_max || 240).forEach(function (w) {
			if (!isObj(w) || !Array.isArray(w.a) || !Array.isArray(w.b)) { return; }
			var a = [r2(clamp(num(w.a[0], 0), -50, 550)), r2(clamp(num(w.a[1], 0), -50, 1050))], bb = [r2(clamp(num(w.b[0], 0), -50, 550)), r2(clamp(num(w.b[1], 0), -50, 1050))];
			if (C(a[0]) === C(bb[0]) && C(a[1]) === C(bb[1])) { return; }
			var kind = oneOf(w.kind, KINDS, 'ext'), dk = wd[kind] || {};
			var mat = mats[w.mat] && (mats[w.mat].kinds || []).indexOf(kind) !== -1 ? w.mat : (dk.mat || Object.keys(mats)[0] || 'ceramic');
			var wall = { id: uid('w', w.id), lv: kind === 'ext' ? 0 : clamp(Math.round(num(w.lv, 0)), 0, lvMax - 1), a: a, b: bb, t: r2(clamp(num(w.t, dk.t || 0.3), L.wall_t_min || 0.05, L.wall_t_max || 0.8)), kind: kind, mat: mat };
			if (kind === 'ext') {
				wall.insul = ins[w.insul] ? w.insul : (dk.insul || 'none');
				wall.insul_t = wall.insul === 'none' ? 0 : r2(clamp(num(w.insul_t, dk.insul_t || 0.1), 0, 0.4));
			}
			o.walls.push(wall);
		});
		var wallIds = {};
		o.walls.forEach(function (w) { wallIds[w.id] = w; });
		(Array.isArray(b.openings) ? b.openings : []).slice(0, L.openings_max || 240).forEach(function (op) {
			if (!isObj(op) || !wallIds[op.wall]) { return; }
			var w = wallIds[op.wall], type = oneOf(op.type, OPENING_TYPES, 'window'), dop = (m.opening || {})[type] || {};
			var lv = w.kind === 'ext' ? clamp(Math.round(num(op.lv, 0)), 0, o.levels.length - 1) : w.lv;
			o.openings.push({
				id: uid('o', op.id), wall: w.id, lv: lv, type: type,
				at: r2(clamp(num(op.at, 0), -5, 200)), w: r2(clamp(num(op.w, dop.w || 1), 0.3, 8)), h: r2(clamp(num(op.h, dop.h || 1.5), 0.3, 4)),
				sill: type === 'window' ? r2(clamp(num(op.sill, dop.sill || 0.9), 0, 3)) : 0,
				lintel: oneOf(op.lintel, LINTELS, 'auto')
			});
		});
		if (isObj(b.rooms)) { Object.keys(b.rooms).slice(0, 120).forEach(function (k) { if (/^\d:-?\d{1,6},-?\d{1,6}$/.test(k) && /^[a-z_]{1,32}$/.test(b.rooms[k] || '')) { o.rooms[k] = b.rooms[k]; } }); }
		if (Array.isArray(b.guessed)) { o.guessed = b.guessed.filter(function (g) { return typeof g === 'string' && /^[a-z_.]{1,32}$/.test(g); }).slice(0, 20); }
		// prepared for 1.14.1 (services) and 1.14.2 (surfaces): kept as given, size-limited
		if (Array.isArray(b.services)) { o.services = b.services.filter(isObj).slice(0, 200); }
		if (Array.isArray(b.surfaces)) { o.surfaces = b.surfaces.filter(isObj).slice(0, 200); }
		// 1.20.0: the room programme – rectangles of the chosen rooms (plan metres) the visitor places in the base
		if (Array.isArray(b.prog)) {
			b.prog.slice(0, 60).forEach(function (r) {
				if (!isObj(r)) { return; }
				var w = r2(clamp(num(r.w, 3), 0.8, 30)), d = r2(clamp(num(r.d, 3), 0.8, 30));
				o.prog.push({
					id: uid('r', r.id), type: typeof r.type === 'string' && /^[a-z_]{1,32}$/.test(r.type) ? r.type : 'other', name: text(r.name, 40),
					area: r2(clamp(num(r.area, w * d), 1, 500)), w: w, d: d,
					x: r2(clamp(num(r.x, 0), -50, 550)), y: r2(clamp(num(r.y, 0), -50, 1050)),
					lv: clamp(Math.round(num(r.lv, 0)), 0, o.levels.length - 1), placed: r.placed === true
				});
			});
		}
		return o;
	}

	/* ------------------------------------------------------------------ geometry (integer millimetres) */
	function seg(w) { return { w: w, ax: C(w.a[0]), ay: C(w.a[1]), bx: C(w.b[0]), by: C(w.b[1]), t: C(w.t) }; }
	function lenC(s) { return Math.sqrt((s.bx - s.ax) * (s.bx - s.ax) + (s.by - s.ay) * (s.by - s.ay)); }
	// parameter u of point p on segment s (0..1), or -1 when p is not on the segment line
	function onSeg(s, px, py) {
		var dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
		if (!L2 || (px - s.ax) * dy - (py - s.ay) * dx !== 0) { return -1; }
		var u = ((px - s.ax) * dx + (py - s.ay) * dy) / L2;
		return u >= 0 && u <= 1 ? u : -1;
	}
	// proper crossing of two non-parallel segments (inside both, not at an end): [u on s, x, y]
	function crossing(s, o) {
		var d1x = s.bx - s.ax, d1y = s.by - s.ay, d2x = o.bx - o.ax, d2y = o.by - o.ay, den = d1x * d2y - d1y * d2x;
		if (!den) { return null; }
		var u = ((o.ax - s.ax) * d2y - (o.ay - s.ay) * d2x) / den, v = ((o.ax - s.ax) * d1y - (o.ay - s.ay) * d1x) / den;
		if (u <= 1e-9 || u >= 1 - 1e-9 || v <= 1e-9 || v >= 1 - 1e-9) { return null; }
		return [u, Math.round(s.ax + d1x * u), Math.round(s.ay + d1y * u)];
	}
	// Splits the walls at every junction (T, X) into graph edges; duplicate edges collapse (thicker wins).
	function edgesOf(walls) {
		var segs = walls.map(seg).filter(function (s) { return s.ax !== s.bx || s.ay !== s.by; }), out = [], seen = {};
		segs.forEach(function (s, i) {
			var pts = [[0, s.ax, s.ay], [1, s.bx, s.by]];
			segs.forEach(function (o, j) {
				if (i === j) { return; }
				[[o.ax, o.ay], [o.bx, o.by]].forEach(function (p) { var u = onSeg(s, p[0], p[1]); if (u > 0 && u < 1) { pts.push([u, p[0], p[1]]); } });
				var x = crossing(s, o);
				if (x) { pts.push(x); }
			});
			pts.sort(function (a, b) { return a[0] - b[0]; });
			for (var k = 1; k < pts.length; k++) {
				var p0 = pts[k - 1], p1 = pts[k];
				if (p0[1] === p1[1] && p0[2] === p1[2]) { continue; }
				var key = p0[1] < p1[1] || (p0[1] === p1[1] && p0[2] < p1[2]) ? p0[1] + ',' + p0[2] + ',' + p1[1] + ',' + p1[2] : p1[1] + ',' + p1[2] + ',' + p0[1] + ',' + p0[2];
				if (seen[key] !== undefined) { var e0 = out[seen[key]]; if (s.t > e0.t) { e0.t = s.t; e0.w = s.w; } continue; }
				seen[key] = out.length;
				out.push({ w: s.w, t: s.t, x0: p0[1], y0: p0[2], x1: p1[1], y1: p1[2] });
			}
		});
		return out;
	}
	function area2(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a; }
	// Faces of the planar wall graph. Interior faces come out with a positive (doubled) area.
	function faces(edges) {
		var adj = {}, xy = {};
		function add(k0, k1, x, y, x1, y1, e) { (adj[k0] = adj[k0] || []).push({ to: k1, a: Math.atan2(y1 - y, x1 - x), e: e }); xy[k0] = [x, y]; }
		edges.forEach(function (e) {
			var k0 = e.x0 + ',' + e.y0, k1 = e.x1 + ',' + e.y1;
			add(k0, k1, e.x0, e.y0, e.x1, e.y1, e); add(k1, k0, e.x1, e.y1, e.x0, e.y0, e);
		});
		Object.keys(adj).forEach(function (k) { adj[k].sort(function (p, q) { return p.a - q.a; }); });
		var seen = {}, res = [];
		Object.keys(adj).sort().forEach(function (k0) {
			adj[k0].forEach(function (h0) {
				if (seen[k0 + '>' + h0.to]) { return; }
				var poly = [], es = [], u = k0, h = h0, guard = 0;
				do {
					seen[u + '>' + h.to] = 1; poly.push(xy[u]); es.push(h.e);
					var v = h.to, lst = adj[v], idx = 0;
					for (var i = 0; i < lst.length; i++) { if (lst[i].to === u) { idx = i; break; } }
					u = v; h = lst[(idx - 1 + lst.length) % lst.length];
				} while (!(u === k0 && h === h0) && ++guard < 20000);
				res.push({ poly: poly, es: es, a2: area2(poly) });
			});
		});
		return res;
	}
	// removes spikes (A,B,A) and repeated points; returns [points, edges]
	function clean(poly, es) {
		var p = poly.slice(), e = es.slice(), changed = true;
		while (changed && p.length > 2) {
			changed = false;
			for (var i = 0; i < p.length; i++) {
				var n = p.length, a = p[(i - 1 + n) % n], c = p[(i + 1) % n];
				if (a[0] === c[0] && a[1] === c[1]) { // spike at i: drop i and the next point
					var j = (i + 1) % n;
					var rm = [i, j].sort(function (x, y) { return y - x; });
					rm.forEach(function (r) { p.splice(r, 1); e.splice(r, 1); });
					changed = true; break;
				}
			}
		}
		return [p, e];
	}
	// merges collinear neighbours; edge thickness = the larger one
	function merge(p, ts) {
		var pts = p.slice(), t = ts.slice(), changed = true;
		while (changed && pts.length > 3) {
			changed = false;
			for (var i = 0; i < pts.length; i++) {
				var n = pts.length, a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
				if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0) {
					var ip = (i - 1 + n) % n;
					t[ip] = Math.max(t[ip], t[i]);
					pts.splice(i, 1); t.splice(i, 1); changed = true; break;
				}
			}
		}
		return [pts, t];
	}
	// Offsets every edge of a positive polygon by d[i] mm towards the inside (negative = outwards).
	function offset(p, d) {
		var n = p.length, lines = [], out = [];
		for (var i = 0; i < n; i++) {
			var a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
			var nx = -dy / L, ny = dx / L; // left normal = inside for a positive polygon
			lines.push({ x: a[0] + nx * d[i], y: a[1] + ny * d[i], dx: dx, dy: dy });
		}
		for (var k = 0; k < n; k++) {
			var l0 = lines[(k - 1 + n) % n], l1 = lines[k], den = l0.dx * l1.dy - l0.dy * l1.dx;
			if (Math.abs(den) < 1e-9) { out.push([Math.round(l1.x), Math.round(l1.y)]); continue; }
			var s = ((l1.x - l0.x) * l1.dy - (l1.y - l0.y) * l1.dx) / den;
			out.push([Math.round(l0.x + l0.dx * s), Math.round(l0.y + l0.dy * s)]);
		}
		return out;
	}
	function inPoly(p, x, y) {
		var c = false;
		for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
			if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) { c = !c; }
		}
		return c;
	}
	function onBoundary(p, x, y) {
		for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; if (onSeg({ ax: p[i][0], ay: p[i][1], bx: q[0], by: q[1] }, x, y) >= 0) { return true; } }
		return false;
	}
	function inOrOn(p, x, y) { return onBoundary(p, x, y) || inPoly(p, x, y); }
	function orthogonal(p) { for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; if (p[i][0] !== q[0] && p[i][1] !== q[1]) { return false; } } return true; }
	// Splits an orthogonal polygon into rectangles: repeatedly the largest free rectangle of the vertex
	// grid (ties: the first in x, then y order). Deterministic, mirrored in PHP.
	function decompose(p) {
		var xs = [], ys = [];
		p.forEach(function (q) { if (xs.indexOf(q[0]) === -1) { xs.push(q[0]); } if (ys.indexOf(q[1]) === -1) { ys.push(q[1]); } });
		xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
		var nx = xs.length - 1, ny = ys.length - 1, free = [], i, j, out = [];
		for (i = 0; i < nx; i++) { free.push([]); for (j = 0; j < ny; j++) { free[i].push(inPoly(p, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2) ? 1 : 0); } }
		for (var guard = 0; guard < 64; guard++) {
			var S = [];
			for (i = 0; i <= nx; i++) { S.push([]); for (j = 0; j <= ny; j++) { S[i].push(i && j ? free[i - 1][j - 1] + S[i - 1][j] + S[i][j - 1] - S[i - 1][j - 1] : 0); } }
			var best = null, bestA = 0;
			for (var i0 = 0; i0 < nx; i0++) {
				for (var j0 = 0; j0 < ny; j0++) {
					if (!free[i0][j0]) { continue; }
					for (var i1 = i0; i1 < nx; i1++) {
						if (!free[i1][j0]) { break; }
						for (var j1 = j0; j1 < ny; j1++) {
							var cnt = S[i1 + 1][j1 + 1] - S[i0][j1 + 1] - S[i1 + 1][j0] + S[i0][j0];
							if (cnt !== (i1 - i0 + 1) * (j1 - j0 + 1)) { break; }
							var A = (xs[i1 + 1] - xs[i0]) * (ys[j1 + 1] - ys[j0]);
							if (A > bestA) { bestA = A; best = [i0, j0, i1, j1]; }
						}
					}
				}
			}
			if (!best) { break; }
			out.push({ x0: xs[best[0]], y0: ys[best[1]], x1: xs[best[2] + 1], y1: ys[best[3] + 1] });
			for (i = best[0]; i <= best[2]; i++) { for (j = best[1]; j <= best[3]; j++) { free[i][j] = 0; } }
		}
		return out;
	}

	// Strip split of an orthogonal polygon: columns between the vertex x values (dir 'x') or rows between
	// the y values (dir 'y'); neighbouring strips with the same runs merge. Largest first.
	function strips(p, dir) {
		var T = dir === 'y', q = T ? p.map(function (v) { return [v[1], v[0]]; }) : p, xs = [], ys = [], cols = [], out = [];
		q.forEach(function (v) { if (xs.indexOf(v[0]) === -1) { xs.push(v[0]); } if (ys.indexOf(v[1]) === -1) { ys.push(v[1]); } });
		xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
		for (var i = 0; i < xs.length - 1; i++) {
			var runs = [], j0 = -1;
			for (var j = 0; j <= ys.length - 1; j++) {
				var inside = j < ys.length - 1 && inPoly(q, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
				if (inside && j0 < 0) { j0 = j; }
				if (!inside && j0 >= 0) { runs.push([ys[j0], ys[j]]); j0 = -1; }
			}
			var key = JSON.stringify(runs), last = cols[cols.length - 1];
			if (last && last.key === key && last.x1 === xs[i]) { last.x1 = xs[i + 1]; } else { cols.push({ key: key, runs: runs, x0: xs[i], x1: xs[i + 1] }); }
		}
		cols.forEach(function (c) { c.runs.forEach(function (r) { out.push(T ? { x0: r[0], x1: r[1], y0: c.x0, y1: c.x1 } : { x0: c.x0, x1: c.x1, y0: r[0], y1: r[1] }); }); });
		out.sort(function (a, b) { return (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0) || a.x0 - b.x0 || a.y0 - b.y0; });
		return out;
	}

	/* ------------------------------------------------------------------ analysis */
	function wallsOfLevel(b, lv) { return b.walls.filter(function (w) { return w.kind === 'ext' || w.lv === lv; }); }
	function levelBase(b, lv) { var z = b.found.top; for (var i = 0; i < lv; i++) { z += b.levels[i].h; } return z; }
	function masonryH(b, lv) { return Math.max(0.5, b.levels[lv].h - b.ring.h); }
	function clearH(b, lv) { return b.levels[lv].h - b.slab.t - (MD().floor_build || 0.12); }

	// Outline of the house (outer face of the external walls) and its centre line.
	function outlineOf(b) {
		var ext = b.walls.filter(function (w) { return w.kind === 'ext'; });
		var fs = faces(edgesOf(ext)).filter(function (f) { return f.a2 > 0; });
		if (!fs.length) { return { closed: false, loops: 0 }; }
		fs.sort(function (p, q) { return q.a2 - p.a2; });
		var f = fs[0], cl = clean(f.poly, f.es), mg = merge(cl[0], cl[1].map(function (e) { return e.t; }));
		var center = mg[0], outer = offset(center, mg[1].map(function (t) { return -t / 2; }));
		var inner = offset(center, mg[1].map(function (t) { return t / 2; }));
		return { closed: true, loops: fs.length, center: center, outer: outer, inner: inner, ts: mg[1], ortho: orthogonal(outer) && orthogonal(center), area: area2(outer) / 2, innerArea: area2(inner) / 2 };
	}
	function bboxOf(p) {
		var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
		p.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
		return { x0: x0, y0: y0, x1: x1, y1: y1 };
	}
	// Rooms of one level: interior faces of the wall graph, net area after half the wall thicknesses.
	function roomsOf(b, lv, ol) {
		ol = ol || outlineOf(b);
		var fs = faces(edgesOf(wallsOfLevel(b, lv))).filter(function (f) { return f.a2 > 0; }), out = [];
		fs.forEach(function (f) {
			var cl = clean(f.poly, f.es);
			if (cl[0].length < 3) { return; }
			var mg = merge(cl[0], cl[1].map(function (e) { return e.t; })), net = offset(mg[0], mg[1].map(function (t) { return t / 2; }));
			var a = area2(mg[0]) / 2;
			if (a < 500000) { return; } // < 0.5 m²: a slot between walls, not a room
			var cx = 0, cy = 0;
			net.forEach(function (q) { cx += q[0]; cy += q[1]; });
			cx /= net.length; cy /= net.length;
			if (ol.closed && !inPoly(ol.center, cx, cy)) { return; } // outside the house (yard enclosed by walls)
			var key = lv + ':' + Math.round(cx / 100) + ',' + Math.round(cy / 100), bb = bboxOf(net);
			out.push({ lv: lv, key: key, poly: mg[0], net: net, area: Math.max(0, area2(net) / 2), gross: a, bbox: bb, cx: cx, cy: cy, type: b.rooms[key] || '' });
		});
		// A room drawn as a closed rectangle against other walls is its own loop, not joined to them: the
		// face around it still spans the whole floor. That face loses the rooms that lie inside it (direct
		// children only), so the rest of the floor shrinks as rooms are added (1.16.3: the kitchen-living
		// room kept the full floor area, 487 m² instead of the ~286 left over).
		// 1.21.0: really inside – every corner of the smaller room in (or on the edge of) the bigger one; a
		// non-convex neighbour whose corner average happens to fall in the bigger room is not inside it
		var inside = function (o, r) { return o.key !== r.key && o.gross < r.gross && inPoly(r.poly, o.cx, o.cy) && o.poly.every(function (q) { return inPoly(r.poly, q[0], q[1]) || onBoundary(r.poly, q[0], q[1]); }); };
		var kidsOf = out.map(function (r) { return out.filter(function (o) { return inside(o, r) && !out.some(function (m) { return m !== o && inside(o, m) && inside(m, r); }); }); });
		out.forEach(function (r, ri) {
			var kids = kidsOf[ri];
			if (!kids.length) { return; }
			var minus = kids.reduce(function (sum, o) { return sum + o.gross; }, 0);
			r.area = Math.max(0, r.area - minus);
			r.gross = Math.max(0, r.gross - minus);
			r.holes = kids.map(function (o) { return o.key; });
			// the label goes into the part that is left, nearest to the middle
			var bb = r.bbox, best = null;
			for (var gx = 1; gx < 20; gx++) {
				for (var gy = 1; gy < 20; gy++) {
					var x = bb.x0 + (bb.x1 - bb.x0) * gx / 20, y = bb.y0 + (bb.y1 - bb.y0) * gy / 20;
					if (!inPoly(r.net, x, y) || kids.some(function (o) { return inPoly(o.poly, x, y); })) { continue; }
					var d = (x - r.cx) * (x - r.cx) + (y - r.cy) * (y - r.cy);
					if (!best || d < best[2]) { best = [x, y, d]; }
				}
			}
			if (best) { r.lx = best[0]; r.ly = best[1]; }
		});
		out = out.filter(function (r) { return r.area >= 500000; });
		out.sort(function (p, q) { return q.area - p.area || p.cx - q.cx || p.cy - q.cy; });
		return out;
	}
	// Net centre-line length of a wall: a wall ending on the side of another wall (T junction) stops at its face.
	function netLen(b, w, list, half) {
		var s = seg(w), L = lenC(s);
		[[s.ax, s.ay], [s.bx, s.by]].forEach(function (p) {
			var host = null;
			list.forEach(function (o) { if (o === w) { return; } var u = onSeg(seg(o), p[0], p[1]); if (u > 0 && u < 1 && (!host || half(o) > half(host))) { host = o; } });
			if (host) { L -= half(host); }
		});
		return Math.max(0, L);
	}
	function wallLenM(b, w) { var list = w.kind === 'ext' ? b.walls.filter(function (o) { return o.kind === 'ext'; }) : wallsOfLevel(b, w.lv); return M(netLen(b, w, list, function (o) { return C(o.t) / 2; })); }
	// Clear stretch of a wall between the faces of the walls joined at its ends (millimetres along a→b).
	function clearSpan(b, w, lv) {
		var s = seg(w), L = lenC(s), s0 = 0, s1 = L, list = wallsOfLevel(b, lv === undefined ? w.lv : lv);
		list.forEach(function (o) {
			if (o === w) { return; }
			var so = seg(o);
			[[so.ax, so.ay], [so.bx, so.by]].forEach(function (p) {
				if (p[0] === s.ax && p[1] === s.ay) { s0 = Math.max(s0, so.t / 2); }
				if (p[0] === s.bx && p[1] === s.by) { s1 = Math.min(s1, L - so.t / 2); }
			});
			// the wall runs through one of our ends (we end on its side)
			if (onSeg(so, s.ax, s.ay) > 0 && onSeg(so, s.ax, s.ay) < 1) { s0 = Math.max(s0, so.t / 2); }
			if (onSeg(so, s.bx, s.by) > 0 && onSeg(so, s.bx, s.by) < 1) { s1 = Math.min(s1, L - so.t / 2); }
		});
		// walls joined in the middle (T on our side): blocked zones
		var mid = [];
		list.forEach(function (o) {
			if (o === w) { return; }
			var so = seg(o);
			[[so.ax, so.ay], [so.bx, so.by]].forEach(function (p) { var u = onSeg(s, p[0], p[1]); if (u > 0 && u < 1) { mid.push([u * L - so.t / 2, u * L + so.t / 2]); } });
			var x = crossing(s, so);
			if (x) { mid.push([x[0] * L - so.t / 2, x[0] * L + so.t / 2]); }
		});
		return { L: L, s0: s0, s1: s1, mid: mid };
	}
	function wallById(b) { var m = {}; b.walls.forEach(function (w) { m[w.id] = w; }); return m; }
	function lintelOf(b, w, op) {
		var mat = (DF().walls || {})[w.mat] || {}, ln = DF().lintel || {}, bear = ln.bearing || 0.125;
		if (op.lintel === 'none') { return null; }
		var need = op.w + 2 * bear, len = (ln.lengths || []).filter(function (l) { return l >= need - 1e-6; })[0] || r2(need);
		var pcs = mat.heavy === false ? 0 : Math.max(1, Math.ceil((w.t - 1e-6) / (ln.unit_w || 0.12)));
		return { len: len, pcs: pcs, over: (len - op.w) / 2 };
	}

	// Geometric validity (measurable; target: 0 errors) and the roof notice. Codes are translated by the UI.
	function check(b) {
		var errs = [], warns = [], ol = outlineOf(b), W = wallById(b), L = DF().limits || {};
		function E(code, ref, extra) { errs.push({ code: code, ref: ref || '', v: extra === undefined ? null : extra }); }
		if (!b.walls.some(function (w) { return w.kind === 'ext'; })) { E('no_ext'); }
		else if (!ol.closed) { E('ext_open'); }
		else {
			if (ol.loops > 1) { warns.push({ code: 'ext_multi' }); }
			if (!ol.ortho) { warns.push({ code: 'roof_ortho' }); }
		}
		b.walls.forEach(function (w) { if (lenC(seg(w)) < C(L.wall_min || 0.2)) { E('wall_short', w.id); } });
		// overlapping (collinear) walls of the same level
		for (var i = 0; i < b.walls.length; i++) {
			for (var j = i + 1; j < b.walls.length; j++) {
				var p = b.walls[i], q = b.walls[j];
				if (!(p.kind === 'ext' || q.kind === 'ext' || p.lv === q.lv)) { continue; }
				var s = seg(p), o = seg(q), dx = s.bx - s.ax, dy = s.by - s.ay;
				if ((o.ax - s.ax) * dy - (o.ay - s.ay) * dx !== 0 || (o.bx - s.ax) * dy - (o.by - s.ay) * dx !== 0) { continue; }
				var L2 = dx * dx + dy * dy, u0 = ((o.ax - s.ax) * dx + (o.ay - s.ay) * dy) / L2, u1 = ((o.bx - s.ax) * dx + (o.by - s.ay) * dy) / L2;
				var lo = Math.max(0, Math.min(u0, u1)), hi = Math.min(1, Math.max(u0, u1));
				if ((hi - lo) * Math.sqrt(L2) > 10) { E('wall_overlap', p.id + ',' + q.id); }
			}
		}
		// walls outside the house or on a level that does not exist (floating)
		b.walls.forEach(function (w) {
			if (w.kind === 'ext') { return; }
			if (w.lv >= b.levels.length) { E('wall_float', w.id); return; }
			if (!ol.closed) { return; }
			var s = seg(w), pts = [[s.ax, s.ay], [s.bx, s.by], [(s.ax + s.bx) / 2, (s.ay + s.by) / 2], [(3 * s.ax + s.bx) / 4, (3 * s.ay + s.by) / 4], [(s.ax + 3 * s.bx) / 4, (s.ay + 3 * s.by) / 4]];
			if (pts.some(function (pt) { return !inOrOn(ol.center, pt[0], pt[1]); })) { E(w.lv > 0 ? 'wall_float' : 'wall_out', w.id); }
		});
		// openings: on the wall, clear of the joined walls and of each other, under the lintel
		var byWall = {};
		b.openings.forEach(function (op) {
			var w = W[op.wall];
			if (!w) { E('op_nowall', op.id); return; }
			if (op.lv >= b.levels.length) { E('op_float', op.id); return; }
			var cs = clearSpan(b, w, op.lv), x0 = C(op.at), x1 = C(op.at + op.w);
			if (x0 < cs.s0 - 5 || x1 > cs.s1 + 5) { E('op_outside', op.id); }
			else if (cs.mid.some(function (m) { return x0 < m[1] - 5 && x1 > m[0] + 5; })) { E('op_junction', op.id); }
			var top = op.sill + op.h, room = masonryH(b, op.lv) - (op.lintel === 'none' ? 0 : ((DF().lintel || {}).h || 0.25)) + 1e-6;
			if (top > room) { E('op_high', op.id, r2(top - room)); }
			(byWall[op.wall + '@' + op.lv] = byWall[op.wall + '@' + op.lv] || []).push(op);
		});
		Object.keys(byWall).forEach(function (k) {
			var l = byWall[k].slice().sort(function (p, q) { return p.at - q.at; });
			for (var i2 = 1; i2 < l.length; i2++) { if (C(l[i2].at) < C(l[i2 - 1].at + l[i2 - 1].w)) { E('op_overlap', l[i2 - 1].id + ',' + l[i2].id); } }
		});
		if (b.walls.length && !b.openings.some(function (op) { return op.type === 'entrance'; })) { warns.push({ code: 'no_entrance' }); }
		return { ok: !errs.length, errors: errs, warnings: warns, outline: ol };
	}

	/* ------------------------------------------------------------------ adapter → shared plan */
	// The build as the shared plan understands it: footprint boxes, heights, openings per face.
	var CACHE = [];
	function adapt(b0) {
		var key = JSON.stringify(b0);
		for (var ci = 0; ci < CACHE.length; ci++) { if (CACHE[ci].k === key) { return CACHE[ci].r; } }
		var b = normalize(b0), chk = check(b), ol = chk.outline, r = { ok: false, check: chk };
		if (ol.closed && ol.ortho) {
			var bb = bboxOf(ol.outer), n = b.levels.length, W = wallById(b), ops = [];
			var hTot = b.found.top, k;
			for (k = 0; k < n; k++) { hTot += b.levels[k].h; }
			var h = hTot + (b.attic ? 0.9 : 0), avgH = (hTot - b.found.top) / n;
			// openings of the external walls, projected onto the outer face of their wall
			b.openings.forEach(function (op) {
				var w = W[op.wall];
				if (!w || w.kind !== 'ext') { return; }
				var s = seg(w), L = lenC(s), ux = (s.bx - s.ax) / L, uy = (s.by - s.ay) / L, nx = -uy, ny = ux;
				var mx = s.ax + ux * C(op.at + op.w / 2), my = s.ay + uy * C(op.at + op.w / 2);
				// the outside is where a point just beyond half the thickness lies outside the centre line loop
				var side = inPoly(ol.center, mx + nx * (s.t / 2 + 20), my + ny * (s.t / 2 + 20)) ? -1 : 1;
				var ox = Math.round(mx + side * nx * s.t / 2), oy = Math.round(my + side * ny * s.t / 2), half = C(op.w) / 2;
				var o = { op: op, kind: op.type === 'entrance' ? 'door' : (op.type === 'terrace' ? 'tdoor' : (op.type === 'door' ? 'door' : 'win')), y: levelBase(b, op.lv) + (op.type === 'window' ? op.sill : 0.02) };
				if (Math.abs(uy) < 1e-9) { o.ax = 'x'; o.c = oy; o.a0 = ox - half; o.a1 = ox + half; o.out = side * ny > 0 ? 1 : -1; }
				else if (Math.abs(ux) < 1e-9) { o.ax = 'y'; o.c = ox; o.a0 = oy - half; o.a1 = oy + half; o.out = side * nx > 0 ? 1 : -1; }
				else { return; }
				ops.push(o);
			});
			function faceOf(q, o) {
				if (o.ax === 'x') { if (o.out > 0 && Math.abs(o.c - q.y1) <= 10) { return { f: 'front', lo: q.x0, hi: q.x1 }; } if (o.out < 0 && Math.abs(o.c - q.y0) <= 10) { return { f: 'back', lo: q.x0, hi: q.x1 }; } }
				else { if (o.out > 0 && Math.abs(o.c - q.x1) <= 10) { return { f: 'right', lo: q.y0, hi: q.y1 }; } if (o.out < 0 && Math.abs(o.c - q.x0) <= 10) { return { f: 'left', lo: q.y0, hi: q.y1 }; } }
				return null;
			}
			function whole(q, o) { var F = faceOf(q, o); return F && o.a0 >= F.lo - 10 && o.a1 <= F.hi + 10 ? F : null; }
			// footprint boxes: the largest-rectangle split gives main block + wings (best roofs); when an
			// opening would sit across the seam of two boxes, a strip split that keeps it whole is used
			var cands = [decompose(ol.outer), strips(ol.outer, 'x'), strips(ol.outer, 'y')], boxes = cands[0], split = true;
			for (var cc = 0; cc < cands.length; cc++) {
				if (ops.every(function (o) { return cands[cc].some(function (q) { return whole(q, o); }); })) { boxes = cands[cc]; split = false; break; }
			}
			var vols = boxes.map(function (q, idx) {
				var w = q.x1 - q.x0, d = q.y1 - q.y0;
				return { x0: M(q.x0 - bb.x0), x1: M(q.x1 - bb.x0), y0: M(q.y0 - bb.y0), y1: M(q.y1 - bb.y0), h: r3(h), z0: 0, ridge: w >= d ? 'x' : 'y', main: idx === 0, wing: idx > 0, bOps: { front: [], right: [], back: [], left: [] }, _c: q };
			});
			function piece(v, F, o, lo, hi, part) {
				var q = v._c, u0 = F.f === 'front' ? lo - q.x0 : (F.f === 'back' ? q.x1 - hi : (F.f === 'right' ? q.y1 - hi : lo - q.y0));
				v.bOps[F.f].push({ kind: o.kind, x: r3(M(Math.max(0, u0))), y: r3(o.y), w: r3(M(hi - lo)), h: o.op.h, fl: o.op.lv, e: o.op.type === 'entrance', id: o.op.id, part: !!part });
				if (o.op.type === 'entrance') { v.entrance = true; }
			}
			var seams = 0;
			ops.forEach(function (o) {
				for (var vi = 0; vi < vols.length; vi++) { var F = whole(vols[vi]._c, o); if (F) { piece(vols[vi], F, o, o.a0, o.a1, false); return; } }
				seams++; // last resort: the parts on each box face line up into one opening
				vols.forEach(function (v) { var F2 = faceOf(v._c, o); if (!F2) { return; } var lo = Math.max(o.a0, F2.lo), hi = Math.min(o.a1, F2.hi); if (hi - lo > 50) { piece(v, F2, o, lo, hi, true); } });
			});
			var hasEnt = vols.some(function (q) { return q.entrance; });
			if (!hasEnt) { vols[0].noDoor = true; }
			vols[0].items = true;
			vols.forEach(function (q) { delete q._c; Object.keys(q.bOps).forEach(function (f) { q.bOps[f].sort(function (p, s2) { return p.x - s2.x || p.y - s2.y; }); }); });
			r = {
				ok: true, check: chk, vols: vols, floors: n, attic: b.attic, W: M(bb.x1 - bb.x0), D: M(bb.y1 - bb.y0), FH: r3(avgH), plinth: b.found.top, h0: r3(h),
				origin: [M(bb.x0), M(bb.y0)], area: M(M(ol.area)), boxes: boxes.length, seams: seams
			};
		}
		CACHE.unshift({ k: key, r: r });
		if (CACHE.length > 6) { CACHE.pop(); }
		return r;
	}

	// Values of the existing parameters that follow from the build (so prompt, rooms, interior views and
	// the server model agree with the drawing). Only geometry: style, colours, roof stay the user's.
	function params(b0, cfg) {
		var b = normalize(b0), a = adapt(b0), out = {};
		if (!a.ok) { return out; }
		var n = b.levels.length;
		out.levels = n === 1 ? (b.attic ? 'attic' : 'single') : (n === 2 ? 'two' : 'three');
		out.building_width = r2(Math.max(a.W, a.D)); out.building_length = r2(Math.min(a.W, a.D));
		out.ceiling_height = r2(clamp(clearH(b, 0), 2.4, 4));
		out.massing = 'auto';
		out.footprint = a.boxes === 1 ? 'rectangle' : (a.boxes === 2 ? 'l_shape' : 'u_shape');
		out.basement = false;
		var rooms = [], net = 0, ol = a.check.outline, seq = 0;
		for (var lv = 0; lv < n; lv++) {
			roomsOf(b, lv, ol).forEach(function (rm) {
				net += rm.area;
				rooms.push({ id: 'b' + (++seq), key: rm.key, type: rm.type, area: r2(M(M(rm.area))), level: lv, width: r2(M(rm.bbox.x1 - rm.bbox.x0)), length: r2(M(rm.bbox.y1 - rm.bbox.y0)) });
			});
		}
		out.net_area = Math.round(M(M(net)));
		out._rooms = rooms;
		if (cfg && num(cfg.plot_width, 0) > 0 && num(cfg.plot_length, 0) > 0) { out.plot_area = Math.round(num(cfg.plot_width, 0) * num(cfg.plot_length, 0)); }
		return out;
	}

	/* ------------------------------------------------------------------ materials (informational) */
	function wallU(b, w) {
		var mat = (DF().walls || {})[w.mat] || {}, ins = (DF().insulations || {})[w.insul || 'none'] || {}, sr = DF().surface_r || {};
		var R = (sr.rsi || 0.13) + (sr.rse || 0.04) + (sr.plaster_r || 0) + (mat.lambda ? w.t / mat.lambda : 0) + (ins.lambda && w.insul_t ? w.insul_t / ins.lambda : 0);
		return R > 0 ? 1 / R : 0;
	}
	function materials(b0, cfg) {
		var b = normalize(b0), d = DF(), mats = d.walls || {}, wst = d.waste || {}, ol = outlineOf(b), items = [], n = b.levels.length;
		function add(phase, id, qty, unit, waste, note) {
			if (!(qty > 0)) { return; }
			var wp = wst[waste] || 0;
			var it = null;
			items.forEach(function (x) { if (x.phase === phase && x.id === id && x.unit === unit) { it = x; } });
			if (it) { it.qty += qty; } else { items.push({ phase: phase, id: id, qty: qty, unit: unit, waste: wp, note: note || '' }); }
		}
		if (!ol.closed) { return { items: [], ok: false }; }
		var outerA = M(M(ol.area)), bb = bboxOf(ol.outer), Wm = M(bb.x1 - bb.x0), Dm = M(bb.y1 - bb.y0);
		var perim = 0;
		ol.outer.forEach(function (q, i) { var p2 = ol.outer[(i + 1) % ol.outer.length]; perim += Math.sqrt((p2[0] - q[0]) * (p2[0] - q[0]) + (p2[1] - q[1]) * (p2[1] - q[1])); });
		perim = M(perim);
		var ext = b.walls.filter(function (w) { return w.kind === 'ext'; }), extArea = 0;
		ext.forEach(function (w) { extArea += wallLenM(b, w) * w.t; });
		var innerA = Math.max(0, outerA - extArea), f = b.found, fd = (d.foundations || {})[f.type] || {};
		// 1 – earthworks
		add(1, 'topsoil', (Wm + 2 * b.earth.margin) * (Dm + 2 * b.earth.margin) * b.earth.topsoil, 'm3', 'earth');
		// foundation lines: external and bearing walls, heavy partitions when asked
		var heavyPart = function (w) { return w.kind === 'part' && (mats[w.mat] || {}).heavy !== false; };
		var under = b.walls.filter(function (w) { return w.lv === 0 && (w.kind !== 'part' || f.partitions === 'strip' || (f.partitions === 'auto' && heavyPart(w))); });
		var fLen = 0;
		under.forEach(function (w) { fLen += M(netLen(b, w, under, function () { return C(f.w) / 2; })); });
		if (f.type === 'slab') {
			var st = fd.t || 0.3;
			add(1, 'excavation', outerA * (st + b.ground.fill), 'm3', 'earth');
			add(2, 'concrete_found', outerA * st, 'm3', 'concrete', fd.concrete || '');
			add(2, 'rebar_found', outerA * st * (fd.rebar_kg_m3 || 0), 'kg', 'rebar');
		} else {
			add(1, 'excavation', fLen * f.w * f.d, 'm3', 'earth');
			var V = fLen * f.w * f.d;
			if (f.type === 'stone') {
				add(2, 'stone_found', V * (fd.stone_m3_per_m3 || 0.7), 'm3', 'stone');
				add(2, 'mortar_found', V * (fd.mortar_m3_per_m3 || 0.3), 'm3', 'concrete');
			} else {
				add(2, 'concrete_found', V, 'm3', 'concrete', fd.concrete || '');
				add(2, 'rebar_found', V * (fd.rebar_kg_m3 || 0), 'kg', 'rebar');
			}
			// plinth (lábazat) up to the ground floor: concrete in the thickness of the wall above
			var plV = 0;
			under.forEach(function (w) { plV += M(netLen(b, w, under, function (o) { return C(o.t) / 2; })) * w.t * f.top; });
			add(2, 'concrete_plinth', plV, 'm3', 'concrete');
		}
		// 3 – service lines (orientation values: from the street side to the house plus inside)
		var front = Math.max(0, num(cfg && cfg.plot_length, 40) - M(bb.y1)); // from the house front to the street
		if (b.ducts.sewer) { add(3, 'sewer', front + 4, 'm', 'earth'); }
		if (b.ducts.water) { add(3, 'water', front + 2, 'm', 'earth'); }
		if (b.ducts.earth && f.type !== 'stone') { add(3, 'earthing', perim, 'm', 'earth'); }
		add(3, 'conduit', b.ducts.conduits, 'db', 'earth');
		// 4 – insulation, ground slab
		if (f.type !== 'slab') {
			add(4, 'gravel', innerA * b.ground.fill, 'm3', 'gravel');
			add(4, 'concrete_ground', innerA * b.ground.concrete, 'm3', 'concrete');
		}
		if (b.ground.membrane !== 'none') { add(4, 'membrane', outerA * ((d.ground || {}).membrane_overlap || 1.15), 'm2', 'membrane'); }
		if (b.ground.xps > 0) { add(4, 'xps', perim * ((d.ground || {}).xps_h || 0.6), 'm2', 'insul'); }
		// 5–7 – walls, partitions, lintels
		var opArea = {};
		b.openings.forEach(function (op) { var k = op.wall + '@' + op.lv; opArea[k] = (opArea[k] || 0) + op.w * op.h; });
		function wallItems(w, lv, phase) {
			var mat = mats[w.mat] || {}, len = wallLenM(b, w), hm = masonryH(b, lv), A = Math.max(0, len * hm - (opArea[w.id + '@' + lv] || 0));
			if (w.kind === 'ext' && b.attic && lv === n - 1) { A += len * 0.9; }
			if (mat.pcs_m2) { add(phase, 'blocks_' + w.mat + '_' + Math.round(w.t * 100), A * mat.pcs_m2, 'db', 'blocks'); }
			if (mat.glue_kg_m2_per_m) { add(phase, 'glue_' + (mat.heavy === false ? 'dry' : 'masonry'), A * w.t * mat.glue_kg_m2_per_m, 'kg', 'glue'); }
			if (mat.fill_m3_m2_per_m) { add(phase, 'concrete_fill', A * w.t * mat.fill_m3_m2_per_m, 'm3', 'concrete'); }
			if (mat.stud_m_m2) { add(phase, 'studs', A * mat.stud_m_m2, 'm', 'timber'); }
			if (mat.profile_m_m2) { add(phase, 'profiles', A * mat.profile_m_m2, 'm', 'timber'); }
			if (mat.board_m2_m2) { add(phase, 'boards', A * mat.board_m2_m2, 'm2', 'board'); }
			return A;
		}
		var facade = 0;
		for (var lv = 0; lv < n; lv++) {
			b.walls.forEach(function (w) {
				if (w.kind === 'ext') { var A = wallItems(w, lv, 5); facade += w.insul !== 'none' ? A : 0; }
				else if (w.lv === lv) { wallItems(w, lv, w.kind === 'part' ? 6 : 5); }
			});
		}
		var W = wallById(b), lint = {};
		b.openings.forEach(function (op) {
			var w = W[op.wall], li = w ? lintelOf(b, w, op) : null;
			if (!li || !li.pcs) { return; }
			lint[li.len] = (lint[li.len] || 0) + li.pcs;
		});
		Object.keys(lint).sort(function (p, q) { return +p - +q; }).forEach(function (l) { add(7, 'lintel_' + Math.round(+l * 100), lint[l], 'db', 'lintel'); });
		// 8 – ring beams and slabs (one per level, the top one carries the roof or the attic)
		var ringV = 0;
		for (var lv2 = 0; lv2 < n; lv2++) {
			b.walls.forEach(function (w) {
				if (w.kind === 'part' || (w.kind === 'int' && w.lv !== lv2)) { return; }
				ringV += wallLenM(b, w) * Math.max(0.05, w.t - (w.kind === 'ext' ? b.ring.insul : 0)) * b.ring.h;
			});
		}
		add(8, 'concrete_ring', ringV, 'm3', 'concrete');
		add(8, 'rebar_ring', ringV * ((d.ring || {}).rebar_kg_m3 || 0), 'kg', 'rebar');
		var slabA = 0, sd = (d.slabs || {})[b.slab.type] || {};
		for (var lv3 = 0; lv3 < n; lv3++) {
			var A3 = M(M(ol.innerArea)) + extArea / 2; // the slab sits on half the external wall
			if (b.slab.stair && lv3 < n - 1) { var sr3 = stairRects(b); A3 -= sr3 ? sr3.holeArea : b.slab.stair.w * b.slab.stair.d; }
			slabA += Math.max(0, A3);
		}
		if (b.slab.type === 'rc') { add(8, 'concrete_slab', slabA * b.slab.t, 'm3', 'concrete'); add(8, 'rebar_slab', slabA * b.slab.t * (sd.rebar_kg_m3 || 0), 'kg', 'rebar'); }
		else if (b.slab.type === 'beam') { add(8, 'slab_beams', slabA / (sd.beam_spacing || 0.6), 'm', 'lintel'); add(8, 'concrete_topping', slabA * (sd.topping_m3_m2 || 0.06), 'm3', 'concrete'); add(8, 'rebar_mesh', slabA * (sd.rebar_kg_m2 || 0), 'kg', 'rebar'); }
		else { add(8, 'timber_beams', slabA / (sd.beam_spacing || 0.6), 'm', 'timber'); add(8, 'boards', slabA * (sd.board_m2_m2 || 1), 'm2', 'board'); }
		// 12 – facade insulation (preliminary; the surfaces step comes in 1.14.2)
		add(12, 'facade_insul', facade, 'm2', 'insul');
		items.forEach(function (it) { it.qty = r3(it.qty); it.total = r3(it.qty * (1 + it.waste / 100)); });
		items.sort(function (p, q) { return p.phase - q.phase; });
		return { items: items, ok: true, perimeter: r3(perim), area: r3(outerA), foundLen: r3(fLen) };
	}

	/* ------------------------------------------------------------------ metrics, practice checks, rules */
	function roofRise(cfg, a) {
		if (!cfg || !a || !a.ok) { return 0; }
		var rt = cfg.roof_type || 'gable', pitch = rt === 'flat' ? 0 : clamp(num(cfg.roof_pitch, 35), 5, 60), v = a.vols[0], S = Math.min(v.x1 - v.x0, v.y1 - v.y0);
		if (rt === 'flat') { return 0; }
		return (rt === 'shed' ? S : S / 2) * Math.tan(pitch * Math.PI / 180);
	}
	function metrics(b0, cfg) {
		var b = normalize(b0), a = adapt(b0), ol = a.check.outline, W = wallById(b), m = {}, mats = DF().walls || {}, n = b.levels.length;
		var pw = num(cfg && cfg.plot_width, get(MD(), 'plot.w') || 20), pd = num(cfg && cfg.plot_length, get(MD(), 'plot.d') || 40);
		if (ol.closed) {
			var bb = bboxOf(ol.outer), Wm = M(bb.x1 - bb.x0), Dm = M(bb.y1 - bb.y0);
			m.coverage_pct = pw * pd > 0 ? r2(M(M(ol.area)) / (pw * pd) * 100) : null;
			// the plot is the rectangle (0,0)–(plot width, plot length); the street is at max y
			m.setback_side = r2(Math.min(M(bb.x0), pw - M(bb.x1)));
			m.setback_back = r2(M(bb.y0));
			m.setback_front = r2(pd - M(bb.y1));
		}
		var eave = b.found.top;
		b.levels.forEach(function (l) { eave += l.h; });
		m.eave_height = r2(eave + (b.attic ? 0.9 : 0));
		m.ridge_over_eave = r2(roofRise(cfg, a));
		m.roof_pitch = cfg && cfg.roof_type !== 'flat' ? num(cfg.roof_pitch, 35) : 0;
		m.found_depth = b.found.d;
		m.clear_height_min = r2(Math.min.apply(null, b.levels.map(function (l, i) { return clearH(b, i); })));
		var ext = b.walls.filter(function (w) { return w.kind === 'ext'; });
		m.wall_u = ext.length ? r3(Math.max.apply(null, ext.map(function (w) { return wallU(b, w); }))) : null;
		// practice metrics
		var edge = Infinity, pier = Infinity, bear = Infinity, ratio = 0, slender = 0;
		var groups = {};
		b.openings.forEach(function (op) {
			var w = W[op.wall];
			if (!w) { return; }
			var cs = clearSpan(b, w, op.lv), x0 = C(op.at), x1 = C(op.at + op.w), li = lintelOf(b, w, op);
			if (w.kind !== 'part') {
				var g = Math.min(x0 - cs.s0, cs.s1 - x1);
				cs.mid.forEach(function (mm) { if (mm[1] <= x0) { g = Math.min(g, x0 - mm[1]); } if (mm[0] >= x1) { g = Math.min(g, mm[0] - x1); } });
				edge = Math.min(edge, M(g));
				if (li) { bear = Math.min(bear, Math.min(li.over, M(Math.max(0, g)) + 0)); }
			}
			(groups[op.wall + '@' + op.lv] = groups[op.wall + '@' + op.lv] || []).push(op);
		});
		Object.keys(groups).forEach(function (k) {
			var l = groups[k].slice().sort(function (p, q) { return p.at - q.at; }), w = W[l[0].wall];
			if (w.kind !== 'part') { for (var i = 1; i < l.length; i++) { pier = Math.min(pier, l[i].at - (l[i - 1].at + l[i - 1].w)); } }
			if (w.kind === 'ext') {
				var A = wallLenM(b, w) * masonryH(b, l[0].lv), oa = 0;
				l.forEach(function (op) { oa += op.w * op.h; });
				if (A > 0) { ratio = Math.max(ratio, oa / A); }
			}
		});
		b.walls.forEach(function (w) { if (w.kind !== 'part') { slender = Math.max(slender, masonryH(b, Math.min(w.lv, n - 1)) / w.t); } });
		m.opening_edge_gap = isFinite(edge) ? r2(edge) : null;
		m.opening_pier = isFinite(pier) ? r2(pier) : null;
		m.lintel_bearing = isFinite(bear) ? r3(bear) : null;
		m.opening_ratio = r2(ratio);
		m.wall_slenderness = r2(slender);
		m.heavy_partition_unsupported = b.found.type !== 'slab' && b.found.partitions === 'none' ? b.walls.filter(function (w) { return w.lv === 0 && w.kind === 'part' && (mats[w.mat] || {}).heavy !== false; }).length : 0;
		var fo = Infinity;
		if (b.found.type !== 'slab') { b.walls.forEach(function (w) { if (w.lv === 0 && w.kind !== 'part') { fo = Math.min(fo, b.found.w - w.t); } }); }
		m.found_over_wall = isFinite(fo) ? r2(fo) : null;
		// bearing walls upstairs must stand on a wall below (≥ 80 % of their length)
		var uns = 0;
		b.walls.forEach(function (w) {
			if (w.kind !== 'int' || w.lv === 0) { return; }
			var s = seg(w), L = lenC(s), cover = 0;
			b.walls.filter(function (o) { return o.kind === 'ext' || (o.kind === 'int' && o.lv === w.lv - 1); }).forEach(function (o) {
				var so = seg(o), dx = s.bx - s.ax, dy = s.by - s.ay;
				if ((so.ax - s.ax) * dy - (so.ay - s.ay) * dx !== 0 || (so.bx - s.ax) * dy - (so.by - s.ay) * dx !== 0) { return; }
				var L2 = dx * dx + dy * dy, u0 = ((so.ax - s.ax) * dx + (so.ay - s.ay) * dy) / L2, u1 = ((so.bx - s.ax) * dx + (so.by - s.ay) * dy) / L2;
				cover += Math.max(0, Math.min(1, Math.max(u0, u1)) - Math.max(0, Math.min(u0, u1))) * L;
			});
			if (cover < 0.8 * L) { uns++; }
		});
		m.bearing_unsupported = uns;
		m.stair_missing = n > 1 && !b.slab.stair ? 1 : 0;
		// 1.21.0: the designed stair against the step rules
		var sc = n > 1 && b.slab.stair && b.slab.stair.type ? stairCalc(b, b.slab.stair.type, b.slab.stair.width) : null;
		m.stair_rise = sc ? sc.rise : null;
		m.stair_step = sc ? sc.blondel : null;
		m.stair_going = sc ? sc.going : null;
		m.stair_width = sc ? sc.width : null;
		return m;
	}
	function cmp(v, op, lim) { return op === '>=' ? v >= lim - 1e-9 : (op === '<=' ? v <= lim + 1e-9 : true); }
	// General good practice (always on; these are not legal rules).
	/* ------------------------------------------------------------------ the stair (1.21.0)
	 * Sized from the storey height (floor to floor): risers n (rise ≤ rise_max, nearest the preferred),
	 * going from the step rule 2·rise + going ≈ 0.63 m, flights and landing by type, the slab opening that
	 * keeps the headroom, and the free landing in front of the first and above the last step. Local frame
	 * of the footprint: x across (w), y along (d); the bottom step at the front (y = d), climbing to y = 0.
	 * rot (0/90/180/270, clockwise on the plan) turns the footprint; stairRects() gives plan rectangles. */
	function stairRules() {
		var s = DF().stair || {};
		return { riseMax: num(s.rise_max, 0.19), risePref: num(s.rise_pref, 0.175), gMin: num(s.going_min, 0.26), gMax: num(s.going_max, 0.32), step: num(s.step_rule, 0.63),
			bl: Array.isArray(s.blondel) ? s.blondel : [0.6, 0.65], wMin: num(s.width_min, 0.9), head: num(s.headroom, 2.1), spMin: num(s.spiral_d_min, 1.6), well: num(s.well, 0.1), walk: num(s.spiral_walk_going_min, 0.2) };
	}
	function stairCalc(b0, type, width) {
		var b = b0 && b0.levels ? b0 : normalize(b0), R = stairRules();
		if (b.levels.length < 2) { return null; }
		type = oneOf(type, STAIR_TYPES, 'straight');
		width = r2(clamp(num(width, 1), 0.6, 2));
		var H = b.levels[0].h, ts = b.slab.t, n = Math.max(2, Math.round(H / R.risePref));
		while (H / n > R.riseMax + 1e-9) { n++; }
		var h = H / n, g = r2(clamp(R.step - 2 * h, R.gMin, R.gMax)), tr = n - 1;
		// steps under the slab opening, counted from the top: below them the stair is far enough under the slab
		var kHole = Math.min(tr, Math.ceil((R.head + ts) / h - 1e-9) - 1);
		var o = { type: type, width: width, H: r3(H), n: n, rise: r3(h), going: g, treads: tr, blondel: r3(2 * h + g), headroom: R.head, flights: [tr] };
		if (type === 'straight') {
			o.w = width; o.d = r2(tr * g);
			o.hole = { x: 0, y: 0, w: width, d: r2(Math.min(o.d, Math.max(0, kHole) * g)) };
			o.bottom = { x: 0, y: o.d, w: width, d: width }; o.top = { x: 0, y: -width, w: width, d: width };
		} else if (type === 'l') {
			// lower flight along y (front to back) on the left, a square landing at the back left, the upper flight along x
			// the landing takes one tread position: lower flight + landing + upper flight = n − 1 treads
			var a = Math.ceil((tr - 1) / 2), c = tr - 1 - a;
			o.flights = [a, c]; o.w = r2(width + c * g); o.d = r2(a * g + width);
			var under = Math.max(0, kHole - c - 1), hd = r2(Math.min(o.d, width + under * g));
			o.hole = { x: 0, y: 0, w: o.w, d: hd };
			// the opening itself is L-shaped: over the landing and the upper flight, and down the lower flight
			o.holePoly = hd > width + 1e-6 ? [[0, 0], [o.w, 0], [o.w, width], [width, width], [width, hd], [0, hd]] : [[0, 0], [o.w, 0], [o.w, width], [0, width]];
			o.bottom = { x: 0, y: o.d, w: width, d: width }; o.top = { x: o.w, y: 0, w: width, d: width };
		} else if (type === 'u') {
			var a2 = Math.ceil((tr - 1) / 2), c2 = tr - 1 - a2;
			o.flights = [a2, c2]; o.w = r2(2 * width + R.well); o.d = r2(Math.max(a2, c2) * g + width);
			o.hole = { x: 0, y: 0, w: o.w, d: o.d };
			o.bottom = { x: 0, y: o.d, w: width, d: width }; o.top = { x: r2(width + R.well), y: r2(width + c2 * g), w: width, d: width };
		} else {
			// spiral: diameter from the flight width round a 0.2 m newel; going checked on the walking line
			var D = r2(Math.max(R.spMin, 2 * width + 0.2)), rw = 0.1 + width / 2, gw = r2(clamp(R.step - 2 * h, R.walk, R.gMax));
			o.w = D; o.d = D; o.going = gw; o.blondel = r3(2 * h + gw); o.turn = Math.round(tr * gw / rw * 180 / Math.PI);
			o.hole = { x: 0, y: 0, w: D, d: D };
			o.bottom = { x: 0, y: D, w: width, d: width }; o.top = { x: D - width, y: D, w: width, d: width };
		}
		o.checks = {
			rise: h <= R.riseMax + 1e-9,
			step: o.blondel >= R.bl[0] - 1e-9 && o.blondel <= R.bl[1] + 1e-9,
			going: type === 'spiral' ? o.going >= R.walk - 1e-9 : g >= R.gMin - 1e-9,
			width: width >= R.wMin - 1e-9,
			fits: o.w <= 6 && o.d <= 8
		};
		o.ok = Object.keys(o.checks).every(function (k) { return o.checks[k]; });
		return o;
	}
	// The treads of a designed stair as plan polygons (local footprint frame) with their top height above the
	// lower floor: [{ pts: [[u, v], ...], z }], bottom step first. Used by the 3D view and the drawings.
	function stairSteps(cal) {
		if (!cal) { return []; }
		var out = [], h = cal.rise, g = cal.going, W = cal.width, i, k = 0;
		function rect(x0, y0, x1, y1) { k++; out.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z: r3(k * h) }); }
		if (cal.type === 'straight') { for (i = 1; i <= cal.treads; i++) { rect(0, r3(cal.d - i * g), W, r3(cal.d - (i - 1) * g)); } }
		else if (cal.type === 'l') {
			var a = cal.flights[0], c = cal.flights[1];
			for (i = 1; i <= a; i++) { rect(0, r3(cal.d - i * g), W, r3(cal.d - (i - 1) * g)); }
			rect(0, 0, W, W);
			for (i = 1; i <= c; i++) { rect(r3(W + (i - 1) * g), 0, r3(W + i * g), W); }
		} else if (cal.type === 'u') {
			var a2 = cal.flights[0], c2 = cal.flights[1], xr = r3(cal.w - W);
			for (i = 1; i <= a2; i++) { rect(0, r3(cal.d - i * g), W, r3(cal.d - (i - 1) * g)); }
			rect(0, 0, cal.w, W);
			for (i = 1; i <= c2; i++) { rect(xr, r3(W + (i - 1) * g), cal.w, r3(W + i * g)); }
		} else {
			var R = cal.w / 2, n = cal.treads, da = (cal.turn || 360) / n * Math.PI / 180;
			for (i = 0; i < n; i++) {
				var a0 = Math.PI / 2 + i * da, a1 = a0 + da, pts = [[R, R]];
				for (var s2 = 0; s2 <= 4; s2++) { var an = a0 + (a1 - a0) * s2 / 4; pts.push([r3(R + Math.cos(an) * R), r3(R + Math.sin(an) * R)]); }
				k++; out.push({ pts: pts, z: r3(k * h) });
			}
		}
		return out;
	}
	// The plan rectangles of a placed stair: footprint, slab opening, free landings (bottom / top), turned by rot.
	function stairRects(b0, st) {
		var b = b0 && b0.levels ? b0 : normalize(b0);
		st = st || b.slab.stair;
		if (!st) { return null; }
		var cal = st.type ? stairCalc(b, st.type, st.width) : null, rot = st.rot || 0;
		var lw = cal ? cal.w : (rot % 180 ? st.d : st.w), ld = cal ? cal.d : (rot % 180 ? st.w : st.d);
		var W = rot % 180 ? ld : lw, Dd = rot % 180 ? lw : ld;
		function tp(q) {
			var u = q[0], v = q[1];
			if (rot === 90) { return [ld - v, u]; }
			if (rot === 180) { return [lw - u, ld - v]; }
			if (rot === 270) { return [v, lw - u]; }
			return [u, v];
		}
		function turn(r) {
			if (!r) { return null; }
			var pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].map(tp);
			var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
			return { x: r2(st.x + Math.min.apply(null, xs)), y: r2(st.y + Math.min.apply(null, ys)), w: r2(Math.max.apply(null, xs) - Math.min.apply(null, xs)), d: r2(Math.max.apply(null, ys) - Math.min.apply(null, ys)) };
		}
		var hole = cal ? turn(cal.hole) : { x: st.x, y: st.y, w: st.w, d: st.d };
		var poly = cal && cal.holePoly ? cal.holePoly.map(function (q) { var p = tp(q); return [r2(st.x + p[0]), r2(st.y + p[1])]; }) : [[hole.x, hole.y], [hole.x + hole.w, hole.y], [hole.x + hole.w, hole.y + hole.d], [hole.x, hole.y + hole.d]];
		// the opening's area (shoelace)
		var ar = 0; poly.forEach(function (p, i) { var q = poly[(i + 1) % poly.length]; ar += p[0] * q[1] - q[0] * p[1]; });
		var steps = stairSteps(cal).map(function (q) { return { z: q.z, pts: q.pts.map(function (p0) { var p = tp(p0); return [r3(st.x + p[0]), r3(st.y + p[1])]; }) }; });
		return { calc: cal, steps: steps, foot: { x: st.x, y: st.y, w: r2(W), d: r2(Dd) }, hole: hole, holePoly: poly, holeArea: r2(Math.abs(ar) / 2), bottom: cal ? turn(cal.bottom) : null, top: cal ? turn(cal.top) : null };
	}
	function practice(b0, cfg, m) {
		m = m || metrics(b0, cfg);
		return (DF().practice || []).map(function (p) {
			var v = m[p.metric];
			if (v === null || v === undefined) { return { id: p.id, status: 'na', msg: p.msg, op: p.op, limit: p.value, unit: p.unit }; }
			return { id: p.id, status: cmp(v, p.op, p.value) ? 'ok' : 'fail', value: v, limit: p.value, op: p.op, unit: p.unit, msg: p.msg, severity: p.severity, source: p.source || DF().source };
		});
	}
	// Legal / local rules from the selected place's package. Mode: on | off | custom.
	function rules(b0, cfg, m) {
		var b = normalize(b0), pk = pack(b.site.country), mode = b.rules.mode, out = { mode: mode, pack: pk ? pk.pkg : '', checked: pk ? pk.checked : '', verified: pk ? !!pk.verified : false, missing: !pk, list: [] };
		if (!pk || mode === 'off') { out.effective = 'off'; return out; }
		out.effective = mode;
		m = m || metrics(b0, cfg);
		var frost = b.site.frost !== null ? b.site.frost : get(pk, 'climate.frost.value');
		var ctx = { site: { frost: frost }, hesz: b.rules.hesz };
		pk.rules.forEach(function (r) {
			var cu = b.rules.custom[r.id];
			if (mode === 'custom' && cu && cu.on === false) { out.list.push(row(r, 'off', null, null)); return; }
			if (r.applies === 'no_hesz_height' && b.rules.hesz.height !== null) { out.list.push(row(r, 'na', null, null)); return; }
			var lim = r.from ? get(ctx, r.from) : r.value;
			if (mode === 'custom' && cu && cu.value !== null) { lim = cu.value; }
			var v = m[r.metric];
			if (lim === null || lim === undefined || v === null || v === undefined) { out.list.push(row(r, 'na', v, lim)); return; }
			out.list.push(row(r, cmp(v, r.op, lim) ? 'ok' : 'fail', v, lim));
		});
		function row(r, status, v, lim) { return { id: r.id, topic: r.topic, status: status, value: v === undefined ? null : v, limit: lim === undefined ? null : lim, op: r.op, unit: r.unit, severity: r.severity, msg: r.msg, source: r.source, effective: r.effective, pkg: r.pkg, checked: r.checked, verified: !!r.verified, source_checked: !!r.source_checked }; }
		return out;
	}

	/* ------------------------------------------------------------------ steps */
	// What a step depends on (closing it stores this signature; a later change marks it stale).
	function stepSig(b, i) {
		var pick = [
			function () { return [b.site.country, b.site.region, b.site.house]; },
			function () { return [b.earth, b.found.d]; },
			function () { return [b.found]; },
			function () { return [b.ducts]; },
			function () { return [b.ground]; },
			function () { return [b.walls.filter(function (w) { return w.kind !== 'part'; }), b.levels, b.attic]; },
			function () { return [b.walls.filter(function (w) { return w.kind === 'part'; })]; },
			function () { return [b.openings]; },
			function () { return [b.slab, b.ring]; },
			function () { return [1]; }
		][i];
		var s = JSON.stringify(pick ? pick() : [i]), h = 5381;
		for (var k = 0; k < s.length; k++) { h = ((h << 5) + h + s.charCodeAt(k)) | 0; }
		return 'h' + (h >>> 0).toString(36);
	}
	// Checklist of one step: items {code, ok}; closable when every required item holds.
	function stepState(b0, i, cfg) {
		var b = normalize(b0), chk = check(b), items = [], err = function (codes) { return !chk.errors.some(function (e) { return codes.indexOf(e.code) !== -1; }); };
		var ol = chk.outline, pw = num(cfg && cfg.plot_width, 0), pd = num(cfg && cfg.plot_length, 0);
		switch (i) {
			case 0:
				items.push({ code: 'plot_size', ok: pw > 0 && pd > 0 });
				items.push({ code: 'country', ok: !!b.site.country });
				items.push({ code: 'rules_mode', ok: true, opt: true });
				break;
			case 1:
				items.push({ code: 'topsoil', ok: b.earth.topsoil >= 0 });
				items.push({ code: 'found_depth', ok: b.found.d >= 0.3 });
				break;
			case 2:
				items.push({ code: 'found_type', ok: !!b.found.type });
				items.push({ code: 'found_width', ok: b.found.type === 'slab' || b.walls.filter(function (w) { return w.lv === 0 && w.kind !== 'part'; }).every(function (w) { return b.found.w >= w.t; }) });
				break;
			case 3:
				items.push({ code: 'ducts_ok', ok: true, opt: true });
				break;
			case 4:
				items.push({ code: 'ground_ok', ok: b.ground.concrete >= 0 && b.ground.fill >= 0 });
				break;
			case 5:
				items.push({ code: 'ext_closed', ok: ol.closed });
				items.push({ code: 'ext_errors', ok: err(['wall_short', 'wall_overlap', 'no_ext', 'ext_open']) });
				items.push({ code: 'roof_ortho', ok: !ol.closed || ol.ortho, opt: true });
				break;
			case 6:
				items.push({ code: 'parts_inside', ok: err(['wall_out', 'wall_float', 'wall_overlap']) });
				break;
			case 7:
				items.push({ code: 'openings_ok', ok: err(['op_outside', 'op_junction', 'op_overlap', 'op_high', 'op_float', 'op_nowall']) });
				items.push({ code: 'lintels', ok: !b.openings.some(function (op) { var w = wallById(b)[op.wall]; return w && w.kind !== 'part' && op.lintel === 'none'; }) });
				items.push({ code: 'entrance', ok: b.openings.some(function (op) { return op.type === 'entrance'; }) });
				break;
			case 8:
				items.push({ code: 'slab_type', ok: !!b.slab.type });
				items.push({ code: 'stair_hole', ok: b.levels.length < 2 || !!b.slab.stair, opt: true });
				break;
			case 9:
				items.push({ code: 'roof_base', ok: ol.closed && ol.ortho });
				break;
			default:
				items.push({ code: 'later', ok: false });
		}
		var closable = i < ACTIVE_STEPS && items.every(function (x) { return x.ok || x.opt; });
		var done = b.done[i] !== undefined, stale = done && b.done[i] !== stepSig(b, i);
		return { i: i, id: STEPS[i], items: items, closable: closable, done: done, stale: stale, active: i < ACTIVE_STEPS };
	}

	/* ------------------------------------------------------------------ editing helpers (pure) */
	function snap(v, g) { g = g || DF().grid || 0.1; return r2(Math.round(v / g) * g); }
	function nextId(list, p) { var n = 0; list.forEach(function (x) { var m = /^[a-z](\d+)$/.exec(x.id || ''); if (m) { n = Math.max(n, +m[1]); } }); return p + (n + 1); }
	// A rectangle of external walls (centre lines) – a quick start and the base of the tests.
	function rectWalls(x, y, w, d, t, mat) {
		var md = (MD().wall || {}).ext || {}, p = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]], out = [];
		for (var i = 0; i < 4; i++) { out.push({ id: 'w' + (i + 1), kind: 'ext', lv: 0, a: p[i].slice(), b: p[(i + 1) % 4].slice(), t: t || md.t || 0.38, mat: mat || md.mat || 'ceramic', insul: md.insul || 'eps', insul_t: md.insul_t || 0.12 }); }
		return out;
	}
	// External walls along an orthogonal outline polygon given as centre-line points (metres).
	function polyWalls(pts, t, startId) {
		var md = (MD().wall || {}).ext || {}, out = [], n = pts.length, id = startId || 1;
		for (var i = 0; i < n; i++) { out.push({ id: 'w' + (id++), kind: 'ext', lv: 0, a: pts[i].slice(), b: pts[(i + 1) % n].slice(), t: t || md.t || 0.38, mat: md.mat || 'ceramic', insul: md.insul || 'eps', insul_t: md.insul_t || 0.12 }); }
		return out;
	}

	/* ------------------------------------------------------------------ the other direction: today's house → build */
	// Union outline of axis-aligned boxes (metres) → centre-line loop, as integer cm.
	function unionLoop(rects) {
		var xs = [], ys = [];
		rects.forEach(function (q) { [q.x0, q.x1].forEach(function (x) { if (xs.indexOf(x) === -1) { xs.push(x); } }); [q.y0, q.y1].forEach(function (y) { if (ys.indexOf(y) === -1) { ys.push(y); } }); });
		xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
		var inside = function (i, j) { if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) { return false; } var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2; return rects.some(function (q) { return cx > q.x0 && cx < q.x1 && cy > q.y0 && cy < q.y1; }); };
		var next = {};
		for (var i = 0; i < xs.length - 1; i++) {
			for (var j = 0; j < ys.length - 1; j++) {
				if (!inside(i, j)) { continue; }
				// directed boundary edges with the inside on the left (positive orientation in these axes)
				if (!inside(i, j - 1)) { next[xs[i + 1] + ',' + ys[j]] = [xs[i], ys[j]]; }
				if (!inside(i, j + 1)) { next[xs[i] + ',' + ys[j + 1]] = [xs[i + 1], ys[j + 1]]; }
				if (!inside(i - 1, j)) { next[xs[i] + ',' + ys[j]] = [xs[i], ys[j + 1]]; }
				if (!inside(i + 1, j)) { next[xs[i + 1] + ',' + ys[j + 1]] = [xs[i + 1], ys[j]]; }
			}
		}
		var loops = [], used = {};
		Object.keys(next).forEach(function (k) {
			if (used[k]) { return; }
			var loop = [], cur = k, g = 0;
			while (!used[cur] && next[cur] && g++ < 5000) { used[cur] = 1; var p = cur.split(',').map(Number); loop.push(p); var q = next[cur]; cur = q[0] + ',' + q[1]; }
			if (loop.length > 2) { loops.push(loop); }
		});
		loops.forEach(function (l) { if (area2(l) < 0) { l.reverse(); } });
		loops.sort(function (p, q) { return Math.abs(area2(q)) - Math.abs(area2(p)); });
		if (!loops.length) { return null; }
		var t = loops[0].map(function () { return 0; }), mg = merge(loops[0], t);
		return mg[0];
	}
	function fromHouse(cfg, K) {
		var c = {};
		Object.keys(cfg || {}).forEach(function (k) { if (k !== 'build') { c[k] = cfg[k]; } });
		var pl = K.plan(c), vols = K._volumes(c, pl).filter(function (v) { return !(v.z0 > 0.05) && !v.tower && !v.glass; });
		var md = MD(), et = ((md.wall || {}).ext || {}).t || 0.38;
		var rects = vols.map(function (v) { return { x0: C(v.x0), x1: C(v.x1), y0: C(v.y0), y1: C(v.y1) }; });
		var loop = unionLoop(rects) || unionLoop([rects[0]]);
		var center = offset(loop, loop.map(function () { return C(et) / 2; }));
		var bb = bboxOf(center), pts = center.map(function (p) { return [r2(M(p[0] - bb.x0) + 1), r2(M(p[1] - bb.y0) + 1)]; });
		var b = { v: 1, step: 0, levels: [], attic: !!pl.attic, walls: polyWalls(pts, et), openings: [], guessed: ['found', 'earth', 'ground', 'parts', 'openings', 'materials'] };
		for (var i = 0; i < pl.floors; i++) { b.levels.push({ h: r2(clamp(pl.FH, 2.4, 4.5)) }); }
		// windows evenly along each wall and level, like the 3D preview does; the entrance on the front
		var ws = K._win(c), ow = clamp(ws.w || 1.2, 0.6, 3), oh = clamp(Math.min(ws.h || 1.5, pl.FH - 0.9), 0.6, 2.4), sill = clamp(ws.sill || 0.9, 0, 1.6), seq = 0;
		var frontWall = null;
		b.walls.forEach(function (w) {
			var ay = w.a[1], by = w.b[1];
			if (Math.abs(ay - by) < 0.005 && (!frontWall || ay > frontWall.a[1] || (ay === frontWall.a[1] && Math.abs(w.b[0] - w.a[0]) > Math.abs(frontWall.b[0] - frontWall.a[0])))) { frontWall = w; }
		});
		var nb = normalize(b);
		nb.walls.forEach(function (w) {
			var cs = clearSpan(nb, w), Lc = M(cs.s1 - cs.s0);
			for (var lv = 0; lv < pl.floors; lv++) {
				var reserve = w.id === frontWall.id && lv === 0 ? 1.1 + 1.2 : 0, avail = Lc - reserve;
				var nW = Math.max(0, Math.floor((avail - 0.8) / (ow + (ws.gap || 1.2))));
				if (avail < ow + 0.8) { nW = 0; }
				var step = nW ? avail / nW : 0;
				for (var k = 0; k < nW; k++) {
					var at = M(cs.s0) + reserve + step * k + (step - ow) / 2;
					b.openings.push({ id: 'o' + (++seq), wall: w.id, lv: lv, type: 'window', at: r2(at), w: r2(ow), h: r2(oh), sill: r2(sill), lintel: 'auto' });
				}
				if (reserve) { b.openings.push({ id: 'o' + (++seq), wall: w.id, lv: 0, type: 'entrance', at: r2(M(cs.s0) + 0.6), w: 1.1, h: r2(Math.min(2.3, masonryH(nb, 0) - 0.3)), sill: 0, lintel: 'auto' }); }
			}
		});
		return normalize(b);
	}

	/* ------------------------------------------------------------------ random houses (tests, demo) */
	function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
	function randomHouse(seed) {
		var R = rng(seed), pick = function (a) { return a[Math.floor(R() * a.length)]; }, md = MD();
		var W = snap(8 + R() * 8, 0.1), D = snap(7 + R() * 5, 0.1), x = 1, y = 1, shape = pick(['rect', 'L', 'U', 'T']), pts;
		var w2 = snap(Math.max(3, W * (0.3 + R() * 0.2)), 0.1), d2 = snap(3 + R() * 3, 0.1);
		if (shape === 'L') { pts = [[x, y], [x + W, y], [x + W, y + D + d2], [x + W - w2, y + D + d2], [x + W - w2, y + D], [x, y + D]]; }
		else if (shape === 'U') { var w3 = snap(Math.max(2.8, W * 0.28), 0.1); pts = [[x, y], [x + W, y], [x + W, y + D + d2], [x + W - w3, y + D + d2], [x + W - w3, y + D], [x + w3, y + D], [x + w3, y + D + d2], [x, y + D + d2]]; }
		else if (shape === 'T') { var tx = snap(x + (W - w2) / 2, 0.1); pts = [[x, y], [x + W, y], [x + W, y + D], [tx + w2, y + D], [tx + w2, y + D + d2], [tx, y + D + d2], [tx, y + D], [x, y + D]]; }
		else { pts = [[x, y], [x + W, y], [x + W, y + D], [x, y + D]]; }
		var mats = ['ceramic', 'aac', 'sand_lime', 'formwork_block', 'timber_frame'], mat = pick(mats), t = pick(((DF().walls || {})[mat] || {}).t || [0.38]);
		var b = { v: 1, levels: [], walls: polyWalls(pts, t), openings: [], attic: R() < 0.3 };
		b.walls.forEach(function (w) { w.mat = mat; });
		var nl = R() < 0.45 ? 2 : 1;
		for (var i = 0; i < nl; i++) { b.levels.push({ h: snap(2.8 + R() * 0.5, 0.05) }); }
		if (nl > 1) { b.attic = false; }
		// partitions: one wall across the main block per level, sometimes a second one
		for (var lv = 0; lv < nl; lv++) {
			var px = snap(x + W * (0.35 + R() * 0.3), 0.1);
			b.walls.push({ id: 'p' + lv + 'a', kind: 'part', lv: lv, a: [px, y], b: [px, y + D], t: 0.1, mat: 'partition_brick' });
			if (R() < 0.6) { var py = snap(y + D * (0.4 + R() * 0.2), 0.1); b.walls.push({ id: 'p' + lv + 'b', kind: 'part', lv: lv, a: [x, py], b: [px, py], t: 0.1, mat: pick(['partition_brick', 'drywall', 'partition_aac']) }); }
			if (lv > 0 || nl === 1) { /* bearing wall below the partition upstairs is not required */ }
		}
		var nb = normalize(b);
		b.found = { type: pick(['strip', 'strip_rc', 'slab', 'stone']), w: snap(Math.max(t + 0.12, 0.4 + R() * 0.3), 0.05), d: snap(0.8 + R() * 0.4, 0.05), top: 0.3, partitions: pick(['auto', 'strip', 'none']) };
		b.slab = { type: pick(['rc', 'beam', 'timber']), t: 0.2 };
		if (nl > 1) { b.slab.stair = { x: x + 1, y: y + 1, w: 1.0, d: 3.0 }; }
		// openings: windows on every external wall long enough, the entrance on the front, doors in partitions
		var seq = 0;
		nb.walls.forEach(function (w) {
			if (w.kind !== 'ext') { return; }
			for (var lv2 = 0; lv2 < nl; lv2++) {
				var cs = clearSpan(nb, w, lv2), Lc = M(cs.s1 - cs.s0);
				var ow = pick([0.9, 1.2, 1.5]), nW = Math.max(0, Math.min(3, Math.floor((Lc - 0.8) / (ow + 1.0))));
				var stp = nW ? Lc / nW : 0;
				for (var k = 0; k < nW; k++) {
					var at = M(cs.s0) + stp * k + (stp - ow) / 2;
					var mh = masonryH(normalize({ levels: b.levels, walls: [] }), lv2);
					// keep clear of the partitions joined to this wall (on this level)
					if (cs.mid.some(function (mz) { return C(at) < mz[1] + 150 && C(at + ow) > mz[0] - 150; })) { continue; }
					b.openings.push({ id: 'o' + (++seq), wall: w.id, lv: lv2, type: 'window', at: r2(at), w: ow, h: r2(Math.min(1.5, mh - 0.25 - 0.9 - 0.05)), sill: 0.9 });
				}
			}
		});
		// the entrance replaces the first window of the longest front wall
		var front = nb.walls.filter(function (w) { return w.kind === 'ext' && w.a[1] === w.b[1]; }).sort(function (p, q) { return q.a[1] - p.a[1] || Math.abs(q.b[0] - q.a[0]) - Math.abs(p.b[0] - p.a[0]); })[0];
		if (front) {
			var fo = b.openings.filter(function (op) { return op.wall === front.id && op.lv === 0; })[0];
			if (fo) { fo.type = 'entrance'; fo.w = Math.min(fo.w, 1.1); fo.h = 2.2; fo.sill = 0; }
			else { // no window there (short wall or partitions joined): a door in the first free stretch
				var fcs = clearSpan(nb, front, 0), pos = null;
				for (var at2 = M(fcs.s0) + 0.3; at2 + 1.0 <= M(fcs.s1) - 0.3 && pos === null; at2 += 0.1) {
					var a0 = C(at2), a1 = C(at2 + 1.0);
					if (!fcs.mid.some(function (mz) { return a0 < mz[1] + 150 && a1 > mz[0] - 150; }) && !b.openings.some(function (op) { return op.wall === front.id && op.lv === 0 && C(op.at) < a1 + 300 && C(op.at + op.w) > a0 - 300; })) { pos = r2(at2); }
				}
				if (pos !== null) { b.openings.push({ id: 'o' + (++seq), wall: front.id, lv: 0, type: 'entrance', at: pos, w: 1.0, h: 2.2, sill: 0 }); }
			}
		}
		b.walls.filter(function (w) { return w.kind === 'part'; }).forEach(function (w) {
			var s = seg(normalize({ walls: [w] }).walls[0] || w), Lc = M(lenC(s));
			if (Lc > 2.4) { b.openings.push({ id: 'o' + (++seq), wall: w.id, lv: w.lv, type: 'door', at: r2(Lc / 2 - 0.45), w: 0.9, h: 2.1, sill: 0 }); }
		});
		return normalize(b);
	}

	var api = {
		version: '1.0.0', active: false, STEPS: STEPS, ACTIVE_STEPS: ACTIVE_STEPS, OPENING_TYPES: OPENING_TYPES, LINTELS: LINTELS, KINDS: KINDS,
		setData: setData, data: function () { return DATA; }, pack: pack, defaults: DF,
		create: create, normalize: normalize, check: check, adapt: adapt, params: params,
		outline: outlineOf, rooms: roomsOf, materials: materials, metrics: metrics, practice: practice, rules: rules,
		stepState: stepState, stepSig: stepSig, wallLen: wallLenM, clearSpan: clearSpan, lintel: lintelOf, wallU: wallU,
		masonryH: masonryH, clearH: clearH, levelBase: levelBase, snap: snap, nextId: nextId, rectWalls: rectWalls, polyWalls: polyWalls,
		fromHouse: fromHouse, randomHouse: randomHouse,
		// geometry internals (tests and the PHP parity check)
		_edges: edgesOf, _faces: faces, _decompose: decompose, _strips: strips, _offset: offset, _union: unionLoop, _area2: area2, _inPoly: inPoly, stairCalc: stairCalc, stairRects: stairRects, stairTypes: STAIR_TYPES
	};
	return api;
}));
