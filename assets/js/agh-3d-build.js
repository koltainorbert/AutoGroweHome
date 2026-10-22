/*!
 * AutoGroweHome – „Építés az alapoktól” (build mode): the construction phases of a drawn house in 3D.
 * Koltai Norbert – Infostudio
 *
 * Registers a scene builder for the 'build' mode of the 3D preview (agh-3d.js). The scene has one group
 * per construction step (0 site … 9 roof, see AGH_Build.STEPS); setPhase(p) only switches visibility,
 * nothing is rebuilt. Geometry comes from window.AGH_Build (agh-build.js) and is shifted exactly like
 * AGH_Build.adapt() shifts its volumes, so phase 9 (the finished House) lines up with the construction.
 *
 * Coordinates: sketch metres – x along the street front, y towards the viewer (street side = max y),
 * z up; H.X(x, y, z) maps them to three.js.
 */

// Builds the scene for the configuration c (c.build = the drawing). H = AGH_3D.helpers().
export function buildScene(c, H) {
	var THREE = H.THREE, X = H.X, A = window.AGH_Build;
	var root = new THREE.Group(), fit = new THREE.Group(), phases = [], i;
	root.add(fit);
	for (i = 0; i < 10; i++) {
		var g = new THREE.Group();
		g.name = 'phase' + i;
		phases.push(g);
		// the plot lines, the service runs to the street and the finished house with its garden stay out of
		// the framing (Box3 counts hidden objects too): the camera frames the house under construction
		(i === 0 || i === 3 || i === 9 ? root : fit).add(g);
	}
	var res = { root: root, fit: fit, phases: phases, phase: 8, setPhase: null };
	res.setPhase = function (p) {
		p = Math.max(0, Math.min(9, Math.round(Number(p) || 0)));
		var fin = p >= 9 && phases[9].children.length > 0;
		for (var k = 0; k < 9; k++) { phases[k].visible = !fin && k <= p; }
		phases[9].visible = fin;
		res.phase = p;
		return res;
	};
	var start = typeof c._phase === 'number' ? c._phase : 8;
	if (!A || !A.normalize) { return res.setPhase(start); }
	try { draw(c, H, A, phases); } catch (e) { res.error = String(e && e.message); if (window.console) { console.warn('AGH build 3D:', res.error); } }
	// an empty drawing still gets a patch of ground, so the camera has something to frame
	if (!phases.some(function (q, k) { return k > 0 && k < 9 && q.children.length; })) {
		// the size typed under "Kezdés" plus the working margin (1.16.2), else a 4 × 4 m patch
		var pv = c._bld_preview, pw0 = pv && pv.w > 0 ? pv.w : 4, pd0 = pv && pv.d > 0 ? pv.d : 4, pm0 = pv && pv.m >= 0 ? pv.m : 0;
		var ox0 = pv ? 0 : -2, oy0 = pv ? 0 : -2;
		phases[1].add(H.box(ox0 - pm0, oy0 - pm0, 0, ox0 + pw0 + pm0, oy0 + pd0 + pm0, 0.012, H.pbr('soil', {}, { normal: 1 }), { noCast: true }));
	}
	return res.setPhase(start);
}

function draw(c, H, A, P) {
	var THREE = H.THREE, X = H.X, b = A.normalize(c.build), D = A.defaults() || {}, MATS = D.walls || {};
	var ol = A.outline(b), ad = A.adapt(c.build), n = b.levels.length, f = b.found;
	var ox = 0, oy = 0;
	if (ad && ad.ok) { ox = ad.origin[0]; oy = ad.origin[1]; }
	else if (ol.closed) { var ob = bbox(ol.outer); ox = ob.x0 / 1000; oy = ob.y0 / 1000; }
	else if (b.walls.length) {
		ox = Math.min.apply(null, b.walls.map(function (w) { return Math.min(w.a[0], w.b[0]) - w.t / 2; }));
		oy = Math.min.apply(null, b.walls.map(function (w) { return Math.min(w.a[1], w.b[1]) - w.t / 2; }));
	}
	// polygons of the outline (whole millimetres) → shifted metres
	function poly(p) { return (p || []).map(function (q) { return [q[0] / 1000 - ox, q[1] / 1000 - oy]; }); }
	var outer = ol.closed ? poly(ol.outer) : null, center = ol.closed ? poly(ol.center) : null, inner = ol.closed ? poly(ol.inner) : null;
	var bb = outer ? bbox(outer) : null;

	/* materials */
	var M = {
		concrete: H.pbr('concrete', { color: '#B9B6AF' }, { normal: 1 }),
		beam: H.pbr('concrete', { color: '#A9A6A0' }, { normal: 1 }),
		stone: H.pbr('stone', { color: '#9C927F' }, { normal: 2 }),
		soil: H.pbr('soil', {}, { normal: 1 }),
		trench: H.solid('#3A2E24', 1),
		gravel: H.pbr('gravel', { color: '#B9B3A8' }, { normal: 2 }),
		membrane: H.solid('#1C1C1E', 0.55),
		wood: H.pbr('wood', { color: '#B08A5A' }, { normal: 1 }),
		string: H.solid('#2B2B2B', 0.8),
		plot: H.solid('#EDE9DF', 0.9),
		sewer: H.solid('#D9692A', 0.5),
		water: H.solid('#2F6FD6', 0.45),
		steel: H.solid('#8E9196', 0.4, 0.8),
		conduit: H.solid('#9EA1A4', 0.6)
	};
	function wallMat(mat) {
		switch (mat) {
			case 'ceramic': case 'partition_brick': return H.pbr('brick', { color: '#B8673F', mortar: '#D9CFC2' }, { normal: 1.4 });
			case 'aac': case 'partition_aac': return H.pbr('concrete', { color: '#E9E6E0' }, { normal: 0.5 });
			case 'sand_lime': return H.pbr('concrete', { color: '#DCD8D0' }, { normal: 0.6 });
			case 'formwork_block': return H.pbr('concrete', { color: '#A9A6A0' }, { normal: 1 });
			case 'timber_frame': return H.pbr('wood', { color: '#C49A6C' }, { normal: 1.2 });
			case 'adobe': return H.pbr('render', { color: '#B59A72', texture: 'coarse' }, { normal: 1.2 });
			case 'drywall': return H.solid('#E4E2DE', 0.9);
			default: return H.pbr('concrete', { color: '#C9C5BD' }, { normal: 0.8 });
		}
	}
	function heavy(w) { return (MATS[w.mat] || {}).heavy !== false; }

	/* geometry helpers (sketch metres, already shifted) */
	function mesh(geo, mat, noCast) { var m = new THREE.Mesh(geo, mat); m.castShadow = !noCast; m.receiveShadow = true; return m; }
	// horizontal polygon (with optional rectangular holes) from z0 to z1
	function slab(pts, z0, z1, mat, holes, noCast) {
		if (!pts || pts.length < 3 || !(z1 - z0 > 1e-4)) { return null; }
		var sh = new THREE.Shape();
		pts.forEach(function (p, k) { if (k) { sh.lineTo(p[0], -p[1]); } else { sh.moveTo(p[0], -p[1]); } });
		(holes || []).forEach(function (hp) { var pa = new THREE.Path(); hp.forEach(function (p, k) { if (k) { pa.lineTo(p[0], -p[1]); } else { pa.moveTo(p[0], -p[1]); } }); sh.holes.push(pa); });
		var geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false });
		geo.rotateX(-Math.PI / 2); geo.translate(0, z0, 0);
		return mesh(geo, mat, noCast);
	}
	// box along the segment p → q (width w across, z0..z1)
	function bar(p, q, w, z0, z1, mat, noCast) {
		var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy);
		if (L < 1e-3) { return null; }
		var m = mesh(H.boxGeo(L, z1 - z0, w), mat, noCast);
		m.position.copy(X((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (z0 + z1) / 2));
		m.rotation.y = -Math.atan2(dy, dx);
		return m;
	}
	// cylinder between two sketch points [x, y, z]
	function tube(a, q, r, mat) {
		var A3 = X(a[0], a[1], a[2]), B3 = X(q[0], q[1], q[2]), d = B3.clone().sub(A3), L = d.length();
		if (L < 1e-3) { return null; }
		var m = mesh(new THREE.CylinderGeometry(r, r, L, 12, 1), mat);
		m.position.copy(A3).addScaledVector(d, 0.5);
		m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
		return m;
	}
	// a wall-like body along the centre line of w: u from wall.a, v up from base; e = [extension at a,
	// extension at b] (negative trims); ops = openings {u0, u1, v0, v1} cut out (v0 ≈ 0 → notch at the bottom)
	function body(w, base, h, e, ops, mat, t) {
		t = t || w.t;
		var ax = w.a[0] - ox, ay = w.a[1] - oy, dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.sqrt(dx * dx + dy * dy);
		if (L < 0.01 || !(h > 0.001)) { return null; }
		var u0 = -e[0], u1 = L + e[1], sh = new THREE.Shape(), last = u0 + 0.01;
		var list = (ops || []).map(function (o) { return { u0: Math.max(o.u0, u0 + 0.02), u1: Math.min(o.u1, u1 - 0.02), v0: Math.max(0, o.v0), v1: Math.min(o.v1, h - 0.02) }; })
			.filter(function (o) { return o.u1 - o.u0 > 0.05 && o.v1 - o.v0 > 0.05; }).sort(function (p, q) { return p.u0 - q.u0; });
		var kept = list.filter(function (o) { if (o.u0 < last + 0.01) { return false; } last = o.u1; return true; });
		sh.moveTo(u0, 0);
		kept.forEach(function (o) { if (o.v0 < 0.01) { sh.lineTo(o.u0, 0); sh.lineTo(o.u0, o.v1); sh.lineTo(o.u1, o.v1); sh.lineTo(o.u1, 0); } });
		sh.lineTo(u1, 0); sh.lineTo(u1, h); sh.lineTo(u0, h); sh.lineTo(u0, 0);
		kept.forEach(function (o) {
			if (o.v0 < 0.01) { return; }
			var pa = new THREE.Path(); pa.moveTo(o.u0, o.v0); pa.lineTo(o.u1, o.v0); pa.lineTo(o.u1, o.v1); pa.lineTo(o.u0, o.v1); pa.lineTo(o.u0, o.v0); sh.holes.push(pa);
		});
		var geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
		var U = X(dx / L, dy / L, 0), V = new THREE.Vector3(0, 1, 0), W = new THREE.Vector3().crossVectors(U, V);
		var m4 = new THREE.Matrix4().makeBasis(U, V, W).setPosition(X(ax, ay, base).addScaledVector(W, -t / 2));
		geo.applyMatrix4(m4);
		return mesh(geo, mat);
	}
	// end treatment of a set of walls: an L corner of two wall ends closes by extending the first wall by
	// half the other's thickness and trimming the second one by the same (no coplanar faces at the corner)
	// A wall ending on the side of another one (T junction) stops at that wall's face.
	function ends(list, tf) {
		var out = list.map(function () { return [0, 0]; }), at = {};
		tf = tf || function (w) { return w.t; };
		list.forEach(function (w, k) {
			[w.a, w.b].forEach(function (p, s) {
				var key = Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000);
				(at[key] = at[key] || []).push({ i: k, s: s });
				list.forEach(function (o) { if (o !== w && onSide(o, p)) { out[k][s] = Math.min(out[k][s], -tf(o) / 2); } });
			});
		});
		Object.keys(at).forEach(function (key) {
			var J = at[key];
			if (J.length !== 2 || J[0].i === J[1].i) { return; }
			var p = list[J[0].i], q = list[J[1].i];
			var d1 = [p.b[0] - p.a[0], p.b[1] - p.a[1]], d2 = [q.b[0] - q.a[0], q.b[1] - q.a[1]];
			var l1 = Math.hypot(d1[0], d1[1]) || 1, l2 = Math.hypot(d2[0], d2[1]) || 1;
			if (Math.abs((d1[0] * d2[1] - d1[1] * d2[0]) / (l1 * l2)) < 1e-3) { return; } // collinear: nothing to close
			var F = J[0].i < J[1].i ? J[0] : J[1], S = F === J[0] ? J[1] : J[0];
			out[F.i][F.s] = tf(list[S.i]) / 2;
			out[S.i][S.s] = -tf(list[F.i]) / 2;
		});
		return out;
	}
	function add(k, m) { if (m) { P[k].add(m); } }
	var bbW = bb ? bb.x1 - bb.x0 : 0, bbD = bb ? bb.y1 - bb.y0 : 0;

	/* 0 – site: plot lines, corner stakes, batter boards with string lines */
	var md = D.model || {}, pw = Number(c.plot_width) > 0 ? Number(c.plot_width) : ((md.plot || {}).w || 20), pd = Number(c.plot_length) > 0 ? Number(c.plot_length) : ((md.plot || {}).d || 40);
	var px0 = -b.site.house.x, py0 = -b.site.house.y, px1 = px0 + pw, py1 = py0 + pd, pT = 0.08;
	[[[px0, py0], [px1, py0]], [[px1, py0], [px1, py1]], [[px1, py1], [px0, py1]], [[px0, py1], [px0, py0]]].forEach(function (s) { add(0, bar(s[0], s[1], pT, 0.004, 0.024, M.plot, true)); });
	if (outer) {
		outer.forEach(function (p, k) {
			add(0, H.box(p[0] - 0.025, p[1] - 0.025, 0, p[0] + 0.025, p[1] + 0.025, 0.5, M.wood));
			var q = outer[(k + 1) % outer.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
			if (L < 0.05) { return; }
			var ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, e0 = [p[0] - ux * 1.6, p[1] - uy * 1.6], e1 = [q[0] + ux * 1.6, q[1] + uy * 1.6];
			add(0, bar(e0, e1, 0.008, 0.596, 0.604, M.string, true));
			[e0, e1].forEach(function (E) {
				var a = [E[0] - uy * 0.4, E[1] + ux * 0.4], z = [E[0] + uy * 0.4, E[1] - ux * 0.4];
				add(0, bar(a, z, 0.03, 0.52, 0.62, M.wood));
				[a, z].forEach(function (pp) { add(0, H.box(pp[0] - 0.03, pp[1] - 0.03, 0, pp[0] + 0.03, pp[1] + 0.03, 0.7, M.wood)); });
			});
		});
	}

	/* 1 – earthworks: stripped topsoil, trenches (or the pit of a slab foundation) */
	var under = b.walls.filter(function (w) { return w.lv === 0 && (w.kind !== 'part' || f.partitions === 'strip' || (f.partitions === 'auto' && heavy(w))); });
	if (bb) {
		var mg = b.earth.margin;
		// the stripped ground follows the drawn outline (L, T, any closed shape) plus the working margin
		// (1.16.2: it was the bounding rectangle, so an L-shaped house sat on a rectangular patch)
		var dug = null;
		try { dug = slab(poly(A._offset(ol.outer, ol.outer.map(function () { return -Math.round(mg * 1000); }))), 0, 0.012, M.soil, null, true); } catch (e) { dug = null; }
		add(1, dug || H.box(bb.x0 - mg, bb.y0 - mg, 0, bb.x1 + mg, bb.y1 + mg, 0.012, M.soil, { noCast: true }));
		if (f.type === 'slab') { add(1, slab(poly(A._offset(ol.outer, ol.outer.map(function () { return -300; }))), 0.012, 0.018, M.trench, null, true)); }
	}
	if (f.type !== 'slab') {
		var eu = ends(under, function () { return f.w + 0.1; });
		under.forEach(function (w, k) { add(1, body(w, 0.012, 0.006, eu[k], null, M.trench, f.w + 0.1)); });
	}

	/* 2 – foundation: strips + plinth, or one slab */
	if (f.type === 'slab') { if (outer) { add(2, slab(outer, -0.3, f.top, M.concrete)); } }
	else {
		var fm = f.type === 'stone' ? M.stone : M.concrete, ef = ends(under, function () { return f.w; }), ep = ends(under);
		under.forEach(function (w, k) {
			add(2, body(w, -f.d, f.d + 0.02, ef[k], null, fm, f.w));
			add(2, body(w, 0.02, f.top - 0.02, ep[k], null, fm));
		});
	}

	/* 3 – service lines: sewer and water to the plot front, earthing tape, conduits through the slab */
	if (inner && bb) {
		var ib = bbox(inner), sx = ib.x0 + (ib.x1 - ib.x0) * 0.35, sy = ib.y1 - 0.6, yF = Math.max(py1, bbD + 3), top = f.top + 0.15;
		if (!A._inPoly(inner, sx, sy)) { sx = (inner[0][0] + inner[1][0]) / 2; sy = (inner[0][1] + inner[1][1]) / 2 + 0.6; }
		if (b.ducts.sewer) { add(3, tube([sx, sy, 0.065], [sx, sy, top], 0.055, M.sewer)); add(3, tube([sx, sy, 0.065], [sx, yF, 0.065], 0.055, M.sewer)); }
		if (b.ducts.water) { var wx = sx + 0.8; add(3, tube([wx, sy, 0.03], [wx, sy, top], 0.016, M.water)); add(3, tube([wx, sy, 0.03], [wx, yF, 0.03], 0.016, M.water)); }
		if (b.ducts.earth && f.type !== 'stone') {
			var et = poly(A._offset(ol.outer, ol.outer.map(function () { return -60; })));
			et.forEach(function (p, k) { add(3, bar(p, et[(k + 1) % et.length], 0.04, 0.02, 0.032, M.steel, true)); });
		}
		var nc = b.ducts.conduits, ci = poly(A._offset(ol.inner, ol.inner.map(function () { return 200; }))), per = 0, segs = [];
		ci.forEach(function (p, k) { var q = ci[(k + 1) % ci.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); segs.push([p, q, per, L]); per += L; });
		for (var cn = 0; cn < nc && per > 0; cn++) {
			var s = (cn + 0.5) / nc * per, sg = segs.filter(function (q) { return s >= q[2] && s <= q[2] + q[3]; })[0] || segs[0], tt = sg[3] ? (s - sg[2]) / sg[3] : 0;
			var cx = sg[0][0] + (sg[1][0] - sg[0][0]) * tt, cy = sg[0][1] + (sg[1][1] - sg[0][1]) * tt;
			add(3, tube([cx, cy, 0.02], [cx, cy, f.top + 0.3], 0.025, M.conduit));
		}
	}

	/* 4 – ground: gravel fill, membrane edge, ground concrete */
	if (inner && center) {
		var gc = b.ground.concrete;
		if (f.type !== 'slab') {
			add(4, slab(inner, 0.02, Math.max(0.03, f.top - gc), M.gravel));
			add(4, slab(inner, Math.max(0.03, f.top - gc), f.top, M.concrete));
		}
		if (b.ground.membrane !== 'none') { add(4, slab(center, f.top, f.top + 0.006, M.membrane, [inner.slice().reverse()], true)); }
	}

	/* 5–8 – per level: walls with their openings, partitions, lintels, ring beams and slabs */
	var byWall = {};
	b.openings.forEach(function (op) { (byWall[op.wall + '@' + op.lv] = byWall[op.wall + '@' + op.lv] || []).push(op); });
	function opsOf(w, lv) { return (byWall[w.id + '@' + lv] || []).map(function (op) { return { u0: op.at, u1: op.at + op.w, v0: op.sill, v1: op.sill + op.h, op: op }; }); }
	for (var lv = 0; lv < n; lv++) {
		var base = A.levelBase(b, lv), mh = A.masonryH(b, lv), lh = b.levels[lv].h;
		var bear = b.walls.filter(function (w) { return w.kind === 'ext' || (w.kind === 'int' && w.lv === lv); });
		var all = b.walls.filter(function (w) { return w.kind === 'ext' || w.lv === lv; });
		var eb = ends(bear), ea = ends(all);
		bear.forEach(function (w, k) {
			add(5, body(w, base, mh, eb[k], opsOf(w, lv), wallMat(w.mat)));
			add(8, body(w, base + mh, lh - mh, eb[k], null, M.beam));
		});
		all.forEach(function (w, k) { if (w.kind === 'part') { add(6, body(w, base, mh, ea[k], opsOf(w, lv), wallMat(w.mat))); } });
		// 7 – lintels over the openings of heavy walls (a little proud of the wall so they read)
		all.forEach(function (w) {
			opsOf(w, lv).forEach(function (o) {
				var li = A.lintel(b, w, o.op);
				if (!li || !li.pcs) { return; }
				var mid = (o.u0 + o.u1) / 2, v0 = Math.min(o.v1, mh - 0.05), v1 = Math.min(o.v1 + 0.25, mh);
				add(7, lintel(w, mid - li.len / 2, mid + li.len / 2, base + v0, base + v1));
			});
		});
		// slab over the centre outline, the stair hole on every level but the top one
		if (center) {
			var holes = null, st = b.slab.stair;
			if (st && lv < n - 1) {
				var hp = [[st.x - ox, st.y - oy], [st.x - ox + st.w, st.y - oy], [st.x - ox + st.w, st.y - oy + st.d], [st.x - ox, st.y - oy + st.d]];
				if (hp.every(function (p) { return A._inPoly(inner || center, p[0], p[1]); })) { holes = [hp.slice().reverse()]; }
			}
			add(8, slab(center, base + lh - b.slab.t, base + lh - 0.004, M.concrete, holes));
		}
	}
	// a lintel: a box along the wall from u0 to u1 (wall-local), z0..z1, a little wider than the wall
	function lintel(w, u0, u1, z0, z1) {
		var dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy);
		if (L < 0.01) { return null; }
		var ux = dx / L, uy = dy / L, ax = w.a[0] - ox, ay = w.a[1] - oy;
		return bar([ax + ux * u0, ay + uy * u0], [ax + ux * u1, ay + uy * u1], w.t + 0.02, z0, z1, M.beam);
	}

	/* 9 – the finished house (the shared plan follows the drawing when AGH_Build.active) */
	if (ad && ad.ok) {
		var hs = new H.House(c, {}).build();
		P[9].add(hs.root);
	}
}

// point p strictly inside the segment of wall o (not at its ends), 1 mm tolerance
function onSide(o, p) {
	var dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], L2 = dx * dx + dy * dy;
	if (!L2) { return false; }
	var u = ((p[0] - o.a[0]) * dx + (p[1] - o.a[1]) * dy) / L2, d = Math.abs((p[0] - o.a[0]) * dy - (p[1] - o.a[1]) * dx) / Math.sqrt(L2);
	return d < 0.001 && u > 1e-6 && u < 1 - 1e-6;
}
function bbox(p) {
	var o = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
	p.forEach(function (q) { o.x0 = Math.min(o.x0, q[0]); o.y0 = Math.min(o.y0, q[1]); o.x1 = Math.max(o.x1, q[0]); o.y1 = Math.max(o.y1, q[1]); });
	return o;
}

// Registers the builder with the 3D preview (window.AGH_3D or the module's default export).
export function install(api3d) {
	if (api3d && api3d.registerBuild) { api3d.registerBuild(buildScene); }
	return api3d;
}
if (typeof window !== 'undefined' && window.AGH_3D && window.AGH_3D.registerBuild) { install(window.AGH_3D); }
