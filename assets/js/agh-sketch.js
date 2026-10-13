/*!
 * AutoGroweHome – élő vázlat (live sketch)
 * Koltai Norbert – Infostudio
 *
 * Pure function: house configuration → SVG markup. A small 3D scene in
 * meters (x: along the front facade, y: towards the viewer, z: up) is
 * projected with an oblique/axonometric camera. Every planar face is drawn in
 * its own local 2D coordinates inside an affine transform, so materials
 * (brick, stone, timber, standing seam, roof tiles…) follow the face.
 *
 * Used by the designer (live preview, option cards) and by the tests in Node
 * (module.exports). No DOM access, deterministic output (seeded randomness).
 */
(function (root) {
	'use strict';

	var D2R = Math.PI / 180;

	/* ------------------------------------------------------------------ helpers */
	function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
	function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
	function col(c, d) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : d; }
	function rgb(c) { c = col(c, '#888888'); return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
	function toHex(a) { return '#' + a.map(function (v) { v = clamp(Math.round(v), 0, 255); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase(); }
	function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
	function shade(c, k) { return k < 0 ? mix(c, '#000000', -k) : mix(c, '#FFFFFF', k); }
	function lum(c) { var x = rgb(c); return (0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]) / 255; }
	function f(n) { return (Math.round(n * 1000) / 1000).toString(); }
	function has(arr, v) { return Array.isArray(arr) && arr.indexOf(v) !== -1; }
	function rng(seed) {
		var s = (seed >>> 0) || 1;
		return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
	}
	function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
	function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
	function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
	function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
	function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
	function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
	function pts(list) { return list.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' '); }

	/* ------------------------------------------------------------------ scene setup */
	function camera(c) {
		var cam = c.camera || 'three_quarter';
		var a = 17, b = 38, k = 0.6, zk = 1;
		if (cam === 'frontal') { a = 5; b = 52; k = 0.34; }
		else if (cam === 'low') { a = 13; b = 30; k = 0.42; zk = 1.08; }
		else if (cam === 'elevated') { a = 24; b = 44; k = 0.86; zk = 0.88; }
		var ca = Math.cos(a * D2R), sa = Math.sin(a * D2R), cb = Math.cos(b * D2R) * k, sb = Math.sin(b * D2R) * k;
		var P = function (p) { return [p[0] * ca - p[1] * cb, p[0] * sa + p[1] * sb - p[2] * zk]; };
		// Direction towards the viewer: it projects to a single point; faces whose outward normal points along it are visible.
		var t = norm([cb / ca, 1, (cb * sa / ca + sb) / zk]);
		return { P: P, t: t };
	}

	var SKY = {
		morning: ['#86BCEB', '#FBE6CC', '#FFF1D6'],
		midday: ['#4A90DA', '#D3E9F8', '#FFFFFF'],
		golden: ['#6A8DC6', '#FFD1A0', '#FFD9A6'],
		blue: ['#1B2D55', '#7E80A8', '#A6A0B8'],
		night: ['#060A18', '#1E2848', '#2B3355']
	};
	function lightFor(c) {
		var tod = SKY[c.time_of_day] ? c.time_of_day : 'golden';
		var overcast = c.weather === 'overcast';
		// sun azimuth (deg, 0 = from the viewer's left) and elevation per time of day
		var az = { morning: 35, midday: 80, golden: 150, blue: 160, night: 160 }[tod];
		var el = { morning: 25, midday: 60, golden: 18, blue: 6, night: 30 }[tod];
		var orient = { south: 0, south_west: 25, south_east: -25, west: 50, east: -50, north: 90 }[c.orientation] || 0;
		az += orient * 0.5;
		var L = norm([Math.cos(az * D2R), Math.sin(az * D2R) * 0.6 + 0.4, Math.tan(el * D2R) + 0.2]);
		return {
			tod: tod, L: L, overcast: overcast,
			dark: tod === 'night' ? 0.62 : (tod === 'blue' ? 0.42 : 0),
			tint: { morning: '#FFE9C7', midday: '#FFFFFF', golden: '#FFB866', blue: '#3A4A7A', night: '#0B1230' }[tod],
			tintA: { morning: 0.05, midday: 0, golden: 0.08, blue: 0.22, night: 0.36 }[tod],
			shadow: overcast || tod === 'night' ? 0 : (tod === 'blue' ? 0.08 : 0.22),
			sunDir: [-Math.cos(az * D2R), -(Math.sin(az * D2R) * 0.6 + 0.4)], sunTan: 1 / Math.tan(Math.max(10, el) * D2R),
			glow: tod === 'blue' || tod === 'night'
		};
	}

	/* ------------------------------------------------------------------ materials */
	var WOOD = { wood: '#A8744A', scandi: '#B9B4AA', dark: '#3A2E26' };
	function facadeBase(c, mat) {
		switch (mat) {
			case 'brick': return '#A4553A';
			case 'clinker': return '#5A4036';
			case 'stone': return '#BDAE97';
			case 'wood': return c.arch_style === 'scandinavian' ? WOOD.scandi : (c.arch_style === 'japandi' ? WOOD.dark : WOOD.wood);
			case 'metal': return '#5E6266';
			case 'concrete': return '#B6B3AD';
			case 'panel': return shade(col(c.facade_color, '#F2EFE9'), -0.12);
			case 'render_dark': return '#4A4D50';
			case 'wood_horizontal': return c.arch_style === 'scandinavian' ? WOOD.scandi : (c.arch_style === 'japandi' ? WOOD.dark : '#B07E52');
			case 'board_batten': return col(c.facade_color, '#F4F4F2');
			case 'charred_wood': return '#2A2522';
			case 'limestone': return '#DCD2C1';
			case 'brick_white': return '#ECE8E1';
			case 'fiber_cement': return shade(col(c.facade_color, '#F2EFE9'), -0.2);
			default: return col(c.facade_color, '#F2EFE9');
		}
	}
	// Pattern markup in local face units (meters, v = up). Returns '' for plain fills.
	function patternDef(id, mat, base) {
		var d = shade(base, -0.18), l = shade(base, 0.12);
		switch (mat) {
			case 'brick':
			case 'clinker':
				var bw = mat === 'clinker' ? 0.62 : 0.46, bh = mat === 'clinker' ? 0.1 : 0.15, j = 0.035, H = (bh + j) * 2;
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + f(bw + j) + '" height="' + f(H) + '">' +
					'<rect width="' + f(bw + j) + '" height="' + f(H) + '" fill="' + (mat === 'clinker' ? '#3A2D28' : '#D9D2C7') + '"/>' +
					'<rect x="0" y="0" width="' + f(bw) + '" height="' + f(bh) + '" fill="' + base + '"/>' +
					'<rect x="' + f(-(bw + j) / 2) + '" y="' + f(bh + j) + '" width="' + f(bw) + '" height="' + f(bh) + '" fill="' + shade(base, -0.08) + '"/>' +
					'<rect x="' + f((bw + j) / 2) + '" y="' + f(bh + j) + '" width="' + f(bw) + '" height="' + f(bh) + '" fill="' + shade(base, 0.06) + '"/></pattern>';
			case 'stone':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="1.2" height="0.6"><rect width="1.2" height="0.6" fill="' + d + '"/>' +
					'<path d="M0.02 0.02h0.36l0.04 0.2-0.4 0.03z" fill="' + base + '"/><path d="M0.42 0.02h0.42l-0.02 0.24h-0.42z" fill="' + l + '"/>' +
					'<path d="M0.86 0.02h0.32v0.26h-0.34z" fill="' + shade(base, -0.06) + '"/><path d="M0.02 0.28l0.32-0.02 0.06 0.3h-0.38z" fill="' + shade(base, 0.05) + '"/>' +
					'<path d="M0.42 0.3h0.5l0.02 0.28h-0.5z" fill="' + base + '"/><path d="M0.96 0.32h0.22v0.26h-0.24z" fill="' + l + '"/></pattern>';
			case 'wood':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.22" height="2"><rect width="0.22" height="2" fill="' + base + '"/>' +
					'<rect x="0.2" width="0.02" height="2" fill="' + shade(base, -0.38) + '"/><rect x="0.06" width="0.05" height="2" fill="' + shade(base, 0.06) + '"/></pattern>';
			case 'metal':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.45" height="1"><rect width="0.45" height="1" fill="' + base + '"/>' +
					'<rect x="0.42" width="0.03" height="1" fill="' + l + '"/><rect x="0.45" width="0.01" height="1" fill="' + d + '"/></pattern>';
			case 'brick_white':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.495" height="0.37"><rect width="0.495" height="0.37" fill="' + shade(base, -0.06) + '"/>' +
					'<rect width="0.46" height="0.15" fill="' + base + '"/><rect x="-0.2475" y="0.185" width="0.46" height="0.15" fill="' + shade(base, 0.03) + '"/><rect x="0.2475" y="0.185" width="0.46" height="0.15" fill="' + shade(base, -0.02) + '"/></pattern>';
			case 'wood_horizontal':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="2.4" height="0.16"><rect width="2.4" height="0.16" fill="' + base + '"/>' +
					'<rect width="2.4" height="0.018" fill="' + shade(base, -0.38) + '"/><rect y="0.018" width="2.4" height="0.03" fill="' + shade(base, 0.08) + '"/><rect x="1.3" width="0.012" height="0.16" fill="' + shade(base, -0.25) + '"/></pattern>';
			case 'board_batten':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.4" height="2"><rect width="0.4" height="2" fill="' + base + '"/>' +
					'<rect x="0.35" width="0.05" height="2" fill="' + shade(base, -0.06) + '"/><rect x="0.345" width="0.006" height="2" fill="' + shade(base, -0.22) + '"/></pattern>';
			case 'charred_wood':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.15" height="1.2"><rect width="0.15" height="1.2" fill="' + base + '"/>' +
					'<rect x="0.14" width="0.01" height="1.2" fill="#0F0D0C"/><path d="M0.02 0.1q0.03 0.3 0 0.6M0.08 0.4q0.03 0.3 0 0.7" stroke="' + shade(base, 0.18) + '" stroke-width="0.008" fill="none"/></pattern>';
			case 'limestone':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="1.2" height="0.8"><rect width="1.2" height="0.8" fill="' + shade(base, -0.12) + '"/>' +
					'<rect x="0.01" y="0.01" width="1.18" height="0.38" fill="' + base + '"/><rect x="-0.59" y="0.41" width="1.18" height="0.38" fill="' + shade(base, 0.04) + '"/><rect x="0.61" y="0.41" width="1.18" height="0.38" fill="' + shade(base, -0.04) + '"/></pattern>';
			case 'fiber_cement':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="1.25" height="1.0"><rect width="1.25" height="1.0" fill="' + base + '"/>' +
					'<path d="M0 0h1.25M0 0v1" stroke="' + d + '" stroke-width="0.014"/><circle cx="0.08" cy="0.08" r="0.01" fill="' + d + '"/><circle cx="1.17" cy="0.08" r="0.01" fill="' + d + '"/><circle cx="0.08" cy="0.92" r="0.01" fill="' + d + '"/><circle cx="1.17" cy="0.92" r="0.01" fill="' + d + '"/></pattern>';
			case 'concrete':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="1.2" height="0.6"><rect width="1.2" height="0.6" fill="' + base + '"/>' +
					'<path d="M0 0h1.2M0 0v0.6" stroke="' + d + '" stroke-width="0.012"/><circle cx="0.3" cy="0.15" r="0.012" fill="' + d + '"/><circle cx="0.9" cy="0.15" r="0.012" fill="' + d + '"/>' +
					'<circle cx="0.3" cy="0.45" r="0.012" fill="' + d + '"/><circle cx="0.9" cy="0.45" r="0.012" fill="' + d + '"/></pattern>';
			case 'panel':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="1.5" height="0.75"><rect width="1.5" height="0.75" fill="' + base + '"/>' +
					'<path d="M0 0h1.5M0 0v0.75" stroke="' + d + '" stroke-width="0.02"/></pattern>';
			case 'tiles':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.3" height="0.34"><rect width="0.3" height="0.34" fill="' + base + '"/>' +
					'<rect y="0" width="0.3" height="0.06" fill="' + shade(base, -0.28) + '"/><rect x="0.148" y="0.06" width="0.008" height="0.28" fill="' + shade(base, -0.16) + '"/>' +
					'<rect y="0.06" width="0.3" height="0.04" fill="' + shade(base, 0.08) + '"/></pattern>';
			case 'flattile':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.42" height="0.3"><rect width="0.42" height="0.3" fill="' + base + '"/>' +
					'<rect width="0.42" height="0.025" fill="' + shade(base, -0.3) + '"/><rect x="0.205" y="0.025" width="0.01" height="0.275" fill="' + shade(base, -0.15) + '"/></pattern>';
			case 'roman':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.3" height="0.38"><rect width="0.3" height="0.38" fill="' + base + '"/>' +
					'<path d="M0 0.38V0.06Q0.075 -0.02 0.15 0.06T0.3 0.06V0.38" fill="' + shade(base, 0.08) + '"/><path d="M0.15 0.06V0.38" stroke="' + shade(base, -0.25) + '" stroke-width="0.03"/>' +
					'<rect width="0.3" height="0.035" fill="' + shade(base, -0.32) + '"/></pattern>';
			case 'shingle':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.34" height="0.28"><rect width="0.34" height="0.28" fill="' + base + '"/>' +
					'<path d="M0 0H0.34M0 0.14H0.34M0.17 0V0.14M0 0.14V0.28M0.34 0.14V0.28" stroke="' + shade(base, -0.28) + '" stroke-width="0.012"/><circle cx="0.06" cy="0.05" r="0.012" fill="' + l + '"/><circle cx="0.24" cy="0.2" r="0.012" fill="' + l + '"/><circle cx="0.12" cy="0.22" r="0.01" fill="' + d + '"/></pattern>';
			case 'renderfine':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.5" height="0.5"><rect width="0.5" height="0.5" fill="' + base + '"/>' +
					'<circle cx="0.1" cy="0.12" r="0.012" fill="' + d + '" opacity="0.35"/><circle cx="0.36" cy="0.3" r="0.012" fill="' + d + '" opacity="0.35"/><circle cx="0.22" cy="0.42" r="0.01" fill="' + l + '"/></pattern>';
			case 'rendercoarse':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.4" height="0.4"><rect width="0.4" height="0.4" fill="' + base + '"/>' +
					'<circle cx="0.06" cy="0.08" r="0.03" fill="' + d + '" opacity="0.45"/><circle cx="0.26" cy="0.18" r="0.035" fill="' + d + '" opacity="0.4"/><circle cx="0.14" cy="0.32" r="0.028" fill="' + l + '"/><circle cx="0.34" cy="0.36" r="0.025" fill="' + d + '" opacity="0.4"/></pattern>';
			case 'flattile2':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.33" height="0.36"><rect width="0.33" height="0.36" fill="' + base + '"/>' +
					'<rect width="0.33" height="0.04" fill="' + shade(base, -0.32) + '"/><rect x="0.16" y="0.04" width="0.014" height="0.32" fill="' + shade(base, -0.2) + '"/><rect y="0.04" width="0.33" height="0.05" fill="' + shade(base, 0.1) + '"/></pattern>';
			case 'slate':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.6" height="0.4"><rect width="0.6" height="0.4" fill="' + base + '"/>' +
					'<path d="M0 0H0.6M0 0.2H0.6M0.15 0V0.2M0.45 0.2V0.4" stroke="' + shade(base, -0.3) + '" stroke-width="0.016"/><rect x="0.16" y="0.02" width="0.28" height="0.16" fill="' + shade(base, 0.06) + '"/></pattern>';
			case 'seam':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.5" height="1"><rect width="0.5" height="1" fill="' + base + '"/>' +
					'<rect x="0.47" width="0.03" height="1" fill="' + shade(base, 0.22) + '"/></pattern>';
			case 'green':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.6" height="0.4"><rect width="0.6" height="0.4" fill="#6E8F45"/>' +
					'<circle cx="0.12" cy="0.1" r="0.08" fill="#86A657"/><circle cx="0.42" cy="0.28" r="0.1" fill="#5E7E3A"/><circle cx="0.5" cy="0.06" r="0.05" fill="#A3B86A"/></pattern>';
			case 'gravel':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.3" height="0.3"><rect width="0.3" height="0.3" fill="#A9A49B"/>' +
					'<circle cx="0.06" cy="0.08" r="0.025" fill="#8E897F"/><circle cx="0.2" cy="0.2" r="0.03" fill="#BDB8AE"/><circle cx="0.24" cy="0.06" r="0.02" fill="#7F7A71"/></pattern>';
			case 'deck':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="2" height="0.145"><rect width="2" height="0.145" fill="' + base + '"/>' +
					'<rect y="0.135" width="2" height="0.01" fill="' + shade(base, -0.35) + '"/></pattern>';
			case 'pavers':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.4" height="0.2"><rect width="0.4" height="0.2" fill="' + base + '"/>' +
					'<path d="M0 0h0.4M0 0.1h0.4M0 0v0.1M0.2 0.1v0.1" stroke="' + shade(base, -0.25) + '" stroke-width="0.012"/></pattern>';
			case 'slabs':
				return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="0.8" height="0.4"><rect width="0.8" height="0.4" fill="' + base + '"/>' +
					'<path d="M0 0h0.8M0 0v0.4" stroke="' + shade(base, -0.2) + '" stroke-width="0.015"/></pattern>';
			default:
				return '';
		}
	}

	/* ------------------------------------------------------------------ renderer */
	function Scene(c, opts) {
		this.c = c;
		this.o = opts || {};
		this.cam = camera(c);
		this.light = lightFor(c);
		this.id = (opts && opts.id) || 'k';
		this.defs = [];
		this.defIds = {};
		this.items = [];   // { depth, svg }
		this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity;
		this.rnd = rng(77);
	}
	Scene.prototype.track = function (p3) { var p = this.cam.P(p3); if (p[0] < this.minX) { this.minX = p[0]; } if (p[0] > this.maxX) { this.maxX = p[0]; } if (p[1] < this.minY) { this.minY = p[1]; } if (p[1] > this.maxY) { this.maxY = p[1]; } return p; };
	Scene.prototype.depth = function (p3) { return dot(p3, this.cam.t); };
	Scene.prototype.def = function (key, markup) { if (!this.defIds[key]) { this.defIds[key] = 1; this.defs.push(markup); } return this.id + key; };
	Scene.prototype.mat = function (mat, base) {
		var key = 'm' + mat + base.substr(1);
		var p = patternDef(this.id + key, mat, base);
		if (!p) { return base; }
		this.def(key, p);
		return 'url(#' + this.id + key + ')';
	};
	// Affine transform for a plane: local (u, v) → screen; o: origin, du/dv: unit directions (v = "up" on the face).
	Scene.prototype.frame = function (o, du, dv) {
		var P = this.cam.P, O = P(o), A = P(add(o, du)), B = P(add(o, dv));
		return 'matrix(' + [A[0] - O[0], A[1] - O[1], B[0] - O[0], B[1] - O[1], O[0], O[1]].map(f).join(' ') + ')';
	};
	Scene.prototype.visible = function (du, dv) { return dot(cross(dv, du), this.cam.t) > 0.01; };
	Scene.prototype.lit = function (du, dv) {
		var n = norm(cross(dv, du)), L = this.light.L;
		var k = clamp(0.5 + 0.5 * dot(n, L), 0, 1);
		if (this.light.overcast) { k = 0.62 + (k - 0.5) * 0.25; }
		return clamp((1 - k) * 0.55, 0, 0.5); // shadow overlay opacity
	};
	// A planar polygon given in local 2D coordinates on the plane (o, du, dv); inner: extra local markup (windows…).
	Scene.prototype.plane = function (o, du, dv, poly, fill, inner, opts) {
		opts = opts || {};
		if (!opts.both && !this.visible(du, dv)) { return null; }
		var self = this, pts3 = poly.map(function (q) { return add(add(o, mul(du, q[0])), mul(dv, q[1])); });
		pts3.forEach(function (p) { self.track(p); });
		var shadowA = opts.noShade ? 0 : this.lit(du, dv);
		var s = '<g transform="' + this.frame(o, du, dv) + '">' +
			'<polygon points="' + pts(poly) + '" fill="' + fill + '"/>' +
			(inner || '') +
			(shadowA > 0.005 ? '<polygon points="' + pts(poly) + '" fill="#1B2230" opacity="' + f(shadowA) + '"/>' : '') +
			(opts.after || '') +
			(opts.edge === false ? '' : '<polygon points="' + pts(poly) + '" fill="none" stroke="' + (opts.stroke || '#141A22') + '" stroke-opacity="' + (opts.stroke ? 1 : 0.28) + '" stroke-width="' + (opts.sw || 0.7) + '" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>') +
			'</g>' + (opts.screen || '');
		var cen = pts3.reduce(function (a, p) { return add(a, p); }, [0, 0, 0]);
		return { svg: s, depth: this.depth(mul(cen, 1 / pts3.length)) };
	};
	// Planar polygon given by 3D points; local frame derived from the plane (v = up the slope).
	// opts.normal: outward normal (default: the one pointing up). inner/after may be functions of the local polygon.
	Scene.prototype.poly3 = function (p3, fill, inner, opts) {
		opts = opts || {};
		var n = [0, 0, 0];
		for (var i = 1; i + 1 < p3.length && dot(n, n) < 1e-8; i++) { n = cross(sub(p3[i], p3[0]), sub(p3[i + 1], p3[0])); }
		if (dot(n, n) < 1e-8) { return null; }
		n = norm(n);
		var want = opts.normal || [0, 0, 1];
		if (dot(n, want) < 0) { n = mul(n, -1); }
		var dv = sub([0, 0, 1], mul(n, n[2]));
		if (dot(dv, dv) < 1e-6) { dv = sub([0, -1, 0], mul(n, -n[1])); }
		dv = norm(dv);
		var du = cross(n, dv), o = p3[0];
		var loc = p3.map(function (p) { var q = sub(p, o); return [dot(q, du), dot(q, dv)]; });
		var o2 = Object.assign({}, opts);
		if (typeof o2.after === 'function') { o2.after = o2.after(loc); }
		return this.plane(o, du, dv, loc, fill, typeof inner === 'function' ? inner(loc) : (inner || ''), o2);
	};
	Scene.prototype.line = function (a, b, color, width) {
		var A = this.track(a), B = this.track(b);
		return '<path d="M' + f(A[0]) + ' ' + f(A[1]) + 'L' + f(B[0]) + ' ' + f(B[1]) + '" stroke="' + color + '" stroke-width="' + f(width) + '" stroke-linecap="round"/>';
	};
	Scene.prototype.push = function (depth, svg) { if (svg) { this.items.push({ d: depth, s: svg }); } };

	/* ------------------------------------------------------------------ building geometry */
	// Signature details per architectural style (all optional): symmetric entrance, window trims,
	// lintels, arched windows, porch, timber slats, fins, entrance portal, cornice, deep eaves, metal roof.
	var STYLES = {
		contemporary_lux: { portal: '#2B2E31' },
		mediterranean: { sym: true, arches: true, trim: '#FFFFFF' },
		scandinavian: { seam: true, trim: '#FFFFFF' },
		bauhaus: { band: true },
		japandi: { slats: '#5C4632', over: 0.9 },
		classic_burgher: { sym: true, cornice: true, trim: 'light' },
		rustic: { lintel: '#5A4030', quoins: true },
		modern_farmhouse: { seam: true, porch: '#2B2E31' },
		american_farm: { sym: true, porch: '#F4F1EA', trim: '#FFFFFF' },
		alpine: { over: 1.2, woodGable: true },
		industrial: { seam: true, lintel: '#1E1F21', grid: true },
		organic_modern: { fins: '#8A6A4C' },
		high_tech: { fins: '#9DA1A4', portal: '#5E6266' },
		passive: { pv: true, reveal: true }
	};
	function styleOf(c) { return STYLES[c.arch_style] || {}; }
	// Colour of the surround around the windows (null = none): by style, or the visitor's choice.
	function trimColor(c) {
		var t = c.window_trim || 'auto', fc = col(c.facade_color, '#F2EFE9');
		if (t === 'auto') { var st = styleOf(c).trim; return st ? (st === 'light' ? shade(fc, 0.35) : st) : null; }
		return { none: null, white: '#F4F2EE', light: shade(fc, 0.35), dark: '#2E3033', stone: '#B9AE9C' }[t] || null;
	}
	// Fence runs between x0 and x1 minus the openings (gaps may overlap or stick out): [[a, b], …].
	function fenceSegs(x0, x1, gaps) {
		var g = gaps.map(function (q) { return [Math.max(x0, q[0]), Math.min(x1, q[1])]; }).filter(function (q) { return q[1] > q[0]; }).sort(function (a, b) { return a[0] - b[0]; });
		var out = [], cur = x0;
		g.forEach(function (q) { if (q[0] > cur + 0.05) { out.push([cur, q[0]]); } cur = Math.max(cur, q[1]); });
		if (x1 > cur + 0.05) { out.push([cur, x1]); }
		return out;
	}
	// Front edge of paths and driveway: the fence line when there is a fence.
	// Fence line: the front plot line when the plot is given, otherwise just inside the scene's front edge.
	function siteEdge(c, front, plot) { return c.fence && c.fence !== 'none' ? (plot ? plot.yF : front - 0.4) : front; }
	function doorPos(c, len) {
		var w = { pivot: 1.4, double: 1.7, sidelight: 1.7, glass_full: 1.2 }[c.entrance_door] || 1.05;
		return { x: styleOf(c).sym ? len / 2 - w / 2 : clamp(len * 0.26, 0.8, len - w - 0.8), w: w, h: c.entrance_door === 'pivot' ? 2.6 : 2.3 };
	}
	function plan(c) {
		var levels = c.levels || 'single';
		var floors = { single: 1, attic: 1, two: 2, three: 3 }[levels] || 1;
		var eq = { single: 1, attic: 1.55, two: 2, three: 3 }[levels] || 1;
		var area = clamp(num(c.net_area, 120), 25, 800);
		var units = { semi_detached: 2, row: 3 }[c.property_type] || 1;
		var fpArea = area * 1.18 / eq;
		var bw = num(c.building_width, 0), bl = num(c.building_length, 0);
		var W, D;
		D = clamp(Math.sqrt(fpArea / 1.65), 5.5, 14); W = clamp(fpArea / D, 6, 40);
		if (c.property_type === 'villa') { W = clamp(W * 1.25, 6, 40); D = clamp(D * 1.1, 5.5, 16); }
		if (c.property_type === 'holiday') { W = clamp(W * 0.85, 6, 40); }
		// explicit building dimensions win (each one on its own); the longer side is the street front
		if (bw > 3 && bl > 3) { W = Math.max(bw, bl); D = Math.min(bw, bl); }
		else if (bw > 3) { W = clamp(bw, 4, 60); D = clamp(fpArea / W, 4, 20); }
		else if (bl > 3) { D = clamp(bl, 4, 20); W = clamp(fpArea / D, 4, 60); }
		if (c.property_type === 'small') { W = Math.min(W, 7); D = Math.min(D, 5); }
		if (units > 1) { W = clamp(W, 5.5, 13); }
		var FH = clamp(num(c.ceiling_height, 2.8), 2.4, 4) + 0.32;
		var pitch = c.roof_type === 'flat' ? 0 : clamp(num(c.roof_pitch, 35), c.roof_type === 'shed' ? 5 : 12, c.roof_type === 'shed' ? 22 : 60);
		if (levels === 'attic' && c.roof_type !== 'flat' && c.roof_type !== 'shed') { pitch = Math.max(pitch, 38); }
		var plinth = c.basement ? 0.7 : 0.25, h0 = plinth + floors * FH + (levels === 'attic' ? 0.9 : 0), rh = num(c.ridge_height, 0);
		// an explicit ridge height sets the pitch (pitched roofs with a ridge)
		if (rh > h0 + 0.8 && ['gable', 'hip', 'half_hip', 'multi', 'complex'].indexOf(c.roof_type || 'gable') !== -1) { pitch = clamp(Math.atan((rh - h0) / (D / 2)) / D2R, 8, 65); }
		var over = Math.max(clamp(num(c.roof_overhang, 0.4), 0, 1.5), styleOf(c).over || 0);
		var ed = num(c.eaves_depth, 0);
		return { floors: floors, attic: levels === 'attic', W: W * units, unitW: W, units: units, D: D, FH: FH, pitch: pitch,
			plinth: plinth, h0: h0, over: over, eave: ed > 0 ? Math.max(clamp(ed, 0.05, 2.5), styleOf(c).over || 0) : over };
	}
	// Building volumes (axis-aligned boxes) for the massing / footprint. Flags: main (first, terrace side),
	// entrance (front door), items (carries chimney / solar / roof windows), wing, second, z0 (sits on a
	// lower volume), roofMap (roof type per chosen roof type, '*' = any), round (soft corners on flat roofs),
	// glass (glazed link), frame, veranda, balc, exo, terraceRoof, porch, accent.
	var MASSING = ['pavilion', 'cantilever', 'courtyard', 'gable_pair', 'cubes', 'engawa', 'symmetric', 'long_house', 'twin_barns', 'cross_gable', 'chalet', 'loft', 'organic', 'glass_frame', 'compact'];
	function volumes(c, pl) {
		var W = pl.W, D = pl.D, P = pl.plinth, FH = pl.FH, fl = pl.floors, h = P + fl * FH + (pl.attic ? 0.9 : 0), A = W * D, v = [];
		var m = pl.units > 1 ? 'auto' : (c.massing || 'auto');
		function V(o) { o.ridge = o.ridge || 'x'; v.push(o); return o; }
		var FLAT = { '*': 'flat' };
		switch (m) {
			case 'pavilion':
				V({ x0: 0, x1: W * 0.7, y0: 0, y1: D, h: h, main: true, frame: true, ext: 0.35 });
				V({ x0: W * 0.7, x1: W * 1.1, y0: -D * 0.35, y1: D - 1.8, h: Math.max(P + FH * 0.85, h - 0.45), wing: true });
				break;
			case 'cantilever':
				if (fl >= 2) {
					V({ x0: 0, x1: W * 0.72, y0: 0, y1: D, h: P + FH, main: true, roofMap: FLAT });
					V({ x0: W * 0.3, x1: W * 1.12, y0: -0.5, y1: D + 1.5, z0: P + FH, h: h, second: true, accent: true, items: true });
				} else {
					V({ x0: 0, x1: W * 0.62, y0: 0, y1: D, h: h, main: true });
					V({ x0: W * 0.58, x1: W * 1.12, y0: -1.4, y1: D - 1.2, h: h + 0.9, second: true, accent: true });
				}
				break;
			case 'courtyard':
				var w3 = clamp(W * 0.24, 3, 5.5), d3 = clamp(D * 0.6, 3, 6);
				V({ x0: 0, x1: W, y0: 0, y1: D, h: h, main: true });
				V({ x0: 0, x1: w3, y0: D, y1: D + d3, h: h, ridge: 'y', wing: true });
				V({ x0: W - w3, x1: W, y0: D, y1: D + d3, h: h, ridge: 'y', wing: true });
				V({ x0: 0.5, x1: 4.1, y0: -1.4, y1: 2.2, h: h + FH, tower: true, roofMap: { flat: 'flat', '*': 'pyramid' }, pitch: 28 });
				break;
			case 'gable_pair':
				V({ x0: 0, x1: W * 0.6, y0: 0, y1: D * 0.92, h: h, main: true });
				V({ x0: W * 0.6, x1: W * 1.02, y0: -0.6, y1: D * 0.92 + 1.6, h: P + FH, ridge: 'y', wing: true, accent: true });
				break;
			case 'cubes':
				if (fl >= 2) {
					V({ x0: 0, x1: W * 0.52, y0: 0, y1: D, h: h, main: true, roofMap: FLAT });
					V({ x0: W * 0.52, x1: W * 1.08, y0: -1.4, y1: D - 1.1, h: P + FH, wing: true, roofMap: FLAT, terraceRoof: true });
					V({ x0: W * 0.8, x1: W * 1.08, y0: -1.4, y1: 1.6, z0: P + FH, h: h, second: true, accent: true, roofMap: FLAT });
				} else {
					V({ x0: 0, x1: W * 0.55, y0: 0, y1: D, h: h + 0.8, main: true, roofMap: FLAT });
					V({ x0: W * 0.55, x1: W * 1.1, y0: -1.2, y1: D - 1.1, h: h, wing: true, accent: true, roofMap: FLAT, terraceRoof: true });
				}
				break;
			case 'engawa':
				V({ x0: 0, x1: W * 0.78, y0: 0, y1: D * 0.82, h: h, main: true, veranda: true });
				V({ x0: W * 0.6, x1: W * 1.12, y0: -D * 0.75, y1: 0.3, h: Math.max(P + FH * 0.8, h - 0.25), wing: true });
				break;
			case 'symmetric':
				var rw = clamp(W * 0.3, 3.2, 5.5);
				V({ x0: 0, x1: W, y0: 0, y1: D, h: h, main: true });
				V({ x0: W / 2 - rw / 2, x1: W / 2 + rw / 2, y0: D - 0.4, y1: D + 0.9, h: h, ridge: 'y', entrance: true, risalit: true, roofMap: { flat: 'flat', '*': 'gable' } });
				break;
			case 'long_house':
				var lw = W * 1.3, ld = Math.max(5.5, D * 0.72), bw2 = clamp(W * 0.3, 3.5, 5.5);
				V({ x0: 0, x1: lw, y0: 0, y1: ld, h: h, main: true, porch: '#6B4A33' });
				V({ x0: lw - bw2, x1: lw, y0: -clamp(D * 0.9, 4, 8), y1: 0.2, h: Math.max(P + FH * 0.8, h - 0.2), ridge: 'y', wing: true, accent: true });
				break;
			case 'twin_barns':
				var bw = clamp(D * 0.85, 5.5, 7.2), bl = clamp(A * 0.52 / bw, 8, 20);
				V({ x0: 0, x1: bw, y0: 0, y1: bl, h: h, ridge: 'y', main: true });
				V({ x0: bw + 2.6, x1: 2 * bw + 2.6, y0: -2.4, y1: bl - 2.4, h: h, ridge: 'y', second: true, accent: true });
				V({ x0: bw - 0.05, x1: bw + 2.65, y0: bl * 0.3, y1: bl * 0.3 + 3.2, h: P + FH, glass: true, roofMap: FLAT });
				break;
			case 'cross_gable':
				var ww = clamp(W * 0.34, 4, 6.5);
				V({ x0: ww, x1: ww + W * 0.72, y0: 0, y1: D, h: h, main: true, porch: '#F4F1EA' });
				V({ x0: 0, x1: ww, y0: D * 0.1, y1: D + 2.4, h: h, ridge: 'y', wing: true });
				break;
			case 'chalet':
				var cw = clamp(Math.sqrt(A * 0.95), 8, 14);
				V({ x0: 0, x1: cw, y0: 0, y1: Math.max(A / cw, 8), h: h, ridge: 'y', main: true, balc: true, ext: 1.25 });
				break;
			case 'loft':
				V({ x0: 0, x1: W * 0.48, y0: 0, y1: D, h: fl >= 2 ? h : h + 0.8, main: true });
				V({ x0: W * 0.48, x1: W * 1.2, y0: -1.6, y1: D - 0.8, h: P + FH + 0.5, wing: true, accent: true, roofMap: { '*': 'saw' }, pitch: 24 });
				break;
			case 'organic':
				V({ x0: 0, x1: W * 0.78, y0: 0, y1: D, h: h, main: true, round: true });
				V({ x0: W * 0.5, x1: W * 1.08, y0: -D * 0.55, y1: D * 0.45, h: h + (fl >= 2 ? 0 : 1.1), second: true, round: true, accent: true });
				break;
			case 'glass_frame':
				V({ x0: 0, x1: W, y0: 0, y1: D * 0.95, h: h, main: true, exo: true, ext: 1.1 });
				break;
			case 'compact':
				var cd2 = clamp(Math.sqrt(A / 1.2), 6, 12);
				V({ x0: 0, x1: A / cd2, y0: 0, y1: cd2, h: h, main: true });
				break;
		}
		if (!v.length) {
			var fp = pl.units > 1 ? 'rectangle' : (c.footprint || 'rectangle');
			if (c.roof_type === 'multi' || c.roof_type === 'complex') { fp = fp === 'rectangle' ? 'l_shape' : fp; }
			if (fp === 'l_shape') {
				var w2 = clamp(W * 0.38, 3.5, 7), d2 = clamp(D * 0.6, 3, 7);
				V({ x0: 0, x1: W, y0: 0, y1: D, h: h, main: true });
				V({ x0: W - w2, x1: W, y0: D, y1: D + d2, h: c.roof_type === 'complex' ? h - pl.FH * 0.35 : h, ridge: 'y', wing: true });
			} else if (fp === 'u_shape') {
				var w4 = clamp(W * 0.26, 3, 6), d4 = clamp(D * 0.55, 3, 6);
				V({ x0: 0, x1: W, y0: 0, y1: D, h: h, main: true });
				V({ x0: 0, x1: w4, y0: D, y1: D + d4, h: h, ridge: 'y', wing: true });
				V({ x0: W - w4, x1: W, y0: D, y1: D + d4, h: h, ridge: 'y', wing: true });
			} else if (fp === 'staggered') {
				var s = W * 0.55;
				V({ x0: 0, x1: s + 0.4, y0: 0, y1: D, h: h, main: true });
				V({ x0: s, x1: W + 1.2, y0: 1.6, y1: D + 1.6, h: Math.max(pl.plinth + pl.FH + 0.4, h - pl.FH), second: true });
			} else {
				V({ x0: 0, x1: W, y0: 0, y1: D, h: h, main: true });
			}
		}
		if (!v.some(function (q) { return q.entrance; })) { v[0].entrance = true; }
		if (!v.some(function (q) { return q.items; })) { v[0].items = true; }
		v.forEach(function (q) { q.z0 = q.z0 || 0; });
		return v;
	}
	// Roof type of one volume.
	function vtype(c, v) {
		var rt = c.roof_type || 'gable', type = rt;
		if (v.roofMap) { var mm = v.roofMap[rt] || v.roofMap['*']; if (mm) { return mm; } }
		if (v.wing) { type = rt === 'flat' ? 'flat' : (rt === 'complex' || rt === 'multi' ? 'gable' : rt); }
		if (v.second && rt !== 'flat') { type = rt === 'hip' || rt === 'pyramid' ? 'hip' : rt; }
		if (type === 'multi' || type === 'complex') { type = rt === 'complex' ? 'hip' : 'gable'; }
		return type;
	}
	// Plan values of one volume (own roof pitch).
	function vplan(pl, v) { return v.pitch ? Object.assign({}, pl, { pitch: v.pitch, over: Math.min(pl.over, 0.3), eave: Math.min(pl.eave, 0.3) }) : pl; }
	// Corner radius of a soft (rounded) volume; only with a flat roof.
	function roundR(c, v) { var r = v.round && vtype(c, v) === 'flat' ? clamp(Math.min(2.6, (v.y1 - v.y0) / 2 - 0.4, (v.x1 - v.x0) / 2 - 0.4), 0, 2.6) : 0; return r < 0.8 ? 0 : r; }
	// Front face of a volume: the parts covered by other volumes, the entrance door and the terrace door
	// (face-local x, measured from off = the start of the straight front wall).
	function frontPlan(c, v, vols) {
		var r = roundR(c, v), len = v.x1 - v.x0 - 2 * r, block = [];
		(vols || []).forEach(function (w) {
			if (w === v || w.z0 > v.z0 + 0.5 || v.z0 > w.z0 + 0.5) { return; }
			if (w.y0 <= v.y1 + 0.05 && w.y1 > v.y1 + 0.05 && w.x1 > v.x0 + r + 0.05 && w.x0 < v.x1 - r - 0.05) { block.push([Math.max(0, w.x0 - v.x0 - r), Math.min(len, w.x1 - v.x0 - r)]); }
		});
		var free = fenceSegs(0, len, block), out = { off: r, len: len, block: block, free: free, door: null, tdoor: null };
		if (!free.length) { return out; }
		var big = free.reduce(function (a, q) { return q[1] - q[0] > a[1] - a[0] ? q : a; }, free[0]);
		if (v.entrance) {
			var d0 = doorPos(c, len), dw = d0.w;
			var home = !block.length ? [0, len] : (styleOf(c).sym ? (free.filter(function (q) { return q[0] <= len / 2 - dw / 2 && q[1] >= len / 2 + dw / 2; })[0] || big) : big);
			var fl2 = home[1] - home[0];
			var dx = !block.length ? d0.x : (styleOf(c).sym && home !== big ? len / 2 - dw / 2 : (fl2 < dw + 1.6 ? home[0] + (fl2 - dw) / 2 : clamp(home[0] + fl2 * 0.26, home[0] + 0.8, home[1] - dw - 0.8)));
			out.door = { x: dx, w: dw, h: d0.h };
		}
		if (v.main && num(c.terrace_area, 0) > 0) {
			var tw = { folding: 3.6, french: 1.6, sliding: 2.6, lift_slide: 3.3 }[c.terrace_door] || 3.3, dr = out.door;
			var ok = function (x) { return (!dr || x >= dr.x + dr.w + 1.2 || x + tw <= dr.x - 1.2) && free.some(function (q) { return x >= q[0] + 0.6 - 1e-6 && x + tw <= q[1] - 0.6 + 1e-6; }); };
			var tx = clamp(len * 0.62, dr ? dr.x + dr.w + 1.2 : 0.6, len - tw - 0.6);
			if (len > 7 && !ok(tx)) {
				tx = null;
				free.forEach(function (q) { if (tx !== null) { return; } var x = clamp(q[0] + (q[1] - q[0]) * 0.55 - tw / 2, Math.max(q[0] + 0.6, dr && dr.x < q[1] && dr.x > q[0] ? dr.x + dr.w + 1.2 : -1e9), q[1] - tw - 0.6); if (ok(x)) { tx = x; } });
			}
			if (len > 7 && tx !== null) { out.tdoor = { x: tx, w: tw }; }
		}
		return out;
	}
	// Ground footprint of all volumes (with their outside structures: frame, exoskeleton, balconies).
	function siteBox(vols) {
		var e = function (q) { return q.ext || 0; };
		return {
			x0: Math.min.apply(null, vols.map(function (q) { return q.x0 - e(q); })), x1: Math.max.apply(null, vols.map(function (q) { return q.x1 + e(q); })),
			y0: Math.min.apply(null, vols.map(function (q) { return q.y0 - e(q); })), y1: Math.max.apply(null, vols.map(function (q) { return q.y1 + e(q); }))
		};
	}
	// The plot: centred on the house with its garage / parking (gx1 = their right edge), 5 m front setback;
	// never narrower than the buildings, its back line only when it falls inside the scene.
	function plotRect(c, vols, gx1) {
		var pw = num(c.plot_width, 0), plen = num(c.plot_length, 0), bb = siteBox(vols);
		if (!(pw > 0 && pw <= 60)) { return null; }
		var g1 = Math.max(bb.x1, gx1 || 0), w = Math.max(pw, g1 - bb.x0 + 2), cx = (bb.x0 + g1) / 2, yF = bb.y1 + 5;
		var yB = plen > 0 && plen < bb.y1 - bb.y0 + 20 ? Math.min(yF - plen, bb.y0 - 1.5) : null;
		return { x0: cx - w / 2, x1: cx + w / 2, yF: yF, yB: yB };
	}

	// Middle of the entrance door (world x) and the entrance wall (y).
	function entranceAt(c, vols) {
		var ev = vols.filter(function (q) { return q.entrance; })[0] || vols[0], fp = frontPlan(c, ev, vols);
		var d = fp.door || { x: fp.len * 0.26, w: 1 };
		return { x: ev.x0 + fp.off + d.x + d.w / 2, y: ev.y1, v: ev };
	}
	// Terrace in front of the main volume: centred on the terrace door, inside the free part of the wall.
	function terraceRect(c, mainV, vols, ta) {
		var td = clamp(ta / 6, 2.4, 5), fp = frontPlan(c, mainV, vols), off = mainV.x0 + fp.off, mlen = fp.len;
		var tdw = { folding: 3.6, french: 1.6, sliding: 2.6, lift_slide: 3.3 }[c.terrace_door] || 3.3;
		var tcx = fp.tdoor ? off + fp.tdoor.x + fp.tdoor.w / 2 : off + mlen * 0.62;
		var fi = fp.free.filter(function (q) { return off + q[0] <= tcx + 1e-6 && off + q[1] >= tcx - 1e-6; })[0];
		if (!fi) {
			// no terrace door in a free part of the wall: the terrace takes the widest free part
			fi = fp.free.reduce(function (a, q) { return !a || q[1] - q[0] > a[1] - a[0] ? q : a; }, null) || [0, mlen];
			tcx = off + (fi[0] + fi[1]) / 2;
		}
		var fx0 = off + fi[0], fx1 = off + fi[1], fln = Math.max(0.5, fx1 - fx0);
		var tw = clamp(ta / td, Math.min(tdw + 0.8, fln), fln), x0 = clamp(tcx - tw / 2, fx0, fx1 - tw);
		return { x0: x0, x1: x0 + tw, y0: mainV.y1, y1: mainV.y1 + td };
	}
	// Garden areas the pool must keep clear of: garage, driveway, terrace, path, play area, trees, seating.
	function siteAvoid(c, vols, ext, gar, ter, doorMid, entY) {
		var gf = c.garden_features || [], out = [], bb = siteBox(vols), my = vols[0].y1;
		var R = function (x0, y0, x1, y1, m) { out.push([x0 - m, y0 - m, x1 + m, y1 + m]); };
		if (gar) { R(gar.x0, gar.y0, gar.x1, ext.front, 0.5); } else { R(bb.x1 + 0.8, bb.y0 + (bb.y1 - bb.y0) * 0.45, bb.x1 + 3.8, ext.front, 0.4); }
		if (ter) { R(ter.x0, ter.y0, ter.x1, ter.y1, 0.4); }
		if (has(gf, 'paths') || !c.garden_features) { R(doorMid - 0.6, entY, doorMid + 0.6, ext.front, 0.4); }
		if (has(gf, 'shed') || has(gf, 'playground')) { R(ext.right - 3.6, ext.back + 1, ext.right - 1, ext.back + 8.6, 0.3); }
		if (has(gf, 'firepit')) { R(ext.left + 2.8, my + 2.8, ext.left + 4.2, my + 4.2, 0.3); }
		if (!ter && (has(gf, 'pergola') || has(c.shading, 'pergola') || has(gf, 'garden_furniture') || has(gf, 'outdoor_kitchen'))) { R(ext.left + 1.3, my + 2.1, ext.left + 4.4, my + 4.9, 0.3); }
		return out;
	}
	// Pool footprint: inside the plot and the fence, clear of the house and the garden areas; preferably
	// beside the house, otherwise behind it (never in front of it when there is any other room).
	function poolRect(c, vols, ext, plot, fenceY, avoid) {
		var bb = siteBox(vols);
		var L = Math.max(ext.left + 1.0, plot ? plot.x0 + 0.8 : -1e9), R = Math.min(ext.right - 1.0, plot ? plot.x1 - 0.8 : 1e9);
		var F = Math.min(fenceY, ext.front) - 1.2, B = Math.max(ext.back + 1.0, plot && plot.yB !== null ? plot.yB + 0.8 : -1e9);
		function hit(x0, y0, x1, y1) {
			if (x0 < L || x1 > R || y0 < B || y1 > F) { return true; }
			for (var i = 0; i < vols.length; i++) { var q = vols[i], m = 1.0 + (q.ext || 0); if (x0 < q.x1 + m && x1 > q.x0 - m && y0 < q.y1 + m && y1 > q.y0 - m) { return true; } }
			for (var j = 0; j < avoid.length; j++) { var a = avoid[j]; if (x0 < a[2] && x1 > a[0] && y0 < a[3] && y1 > a[1]) { return true; } }
			return false;
		}
		var tx = bb.x0 - 1.0, ty = (bb.y0 + bb.y1) / 2, sizes = [[3.4, 7], [7, 3.4], [3.2, 6], [6, 3.2], [3, 5], [5, 3], [2.6, 4.2], [2.4, 3.4]];
		for (var si = 0; si < sizes.length; si++) {
			var w = sizes[si][0], d = sizes[si][1], best = null, bd = 1e18;
			for (var x = L; x + w <= R + 1e-6; x += 0.5) {
				for (var y = B; y + d <= F + 1e-6; y += 0.5) {
					if (hit(x, y, x + w, y + d)) { continue; }
					var cx = x + w / 2, cy = y + d / 2, dist = (cx - tx) * (cx - tx) + (cy - ty) * (cy - ty) + (cy > bb.y1 ? 400 : 0);
					if (dist < bd) { bd = dist; best = { x0: x, y0: y, x1: x + w, y1: y + d }; }
				}
			}
			if (best) { return best; }
		}
		var fw = 2.4, fd = 3.4, fx = clamp(bb.x0, L, R - fw), fy = clamp(bb.y0 - 1.2 - fd, B, F - fd);
		return { x0: fx, y0: fy, x1: fx + fw, y1: fy + fd };
	}
	// Garden plan shared by the 2D sketch and the 3D preview. Everything stays inside the plot (or the
	// scene when no plot is given); plants never stand on paved or built surfaces (house, porch, terrace,
	// path, driveway, garage, pool, steps) and never on one another.
	function gardenLayout(c, vols, pl, ext, plot, gar, ter, fenceY) {
		var gf = c.garden_features || [], gs = c.garden_style || 'natural', season = c.season || 'summer', st = styleOf(c);
		var mainV = vols[0], my = mainV.y1, ent = entranceAt(c, vols), doorMid = ent.x, bb = siteBox(vols), D = pl.D;
		var A = plot ? { x0: plot.x0 + 0.25, x1: plot.x1 - 0.25, y0: (plot.yB !== null ? plot.yB : ext.back + 0.4) + 0.25, y1: plot.yF - 0.25 } : { x0: ext.left + 0.4, x1: ext.right - 0.4, y0: ext.back + 0.4, y1: ext.front - 0.4 };
		var out = { area: A, lawn: plot ? { x0: plot.x0, x1: plot.x1, y0: plot.yB !== null ? plot.yB : ext.back, y1: plot.yF } : { x0: ext.left, x1: ext.right, y0: ext.back, y1: ext.front },
			fence: null, flats: [], plants: [], lights: [], shed: null, playground: null, firepit: null, pergola: null, furniture: null, hedge: null, pool: null, path: null, drive: null, gravel: null, ent: ent };
		var pathOn = has(gf, 'paths') || !c.garden_features, edge = fenceY;
		if (pathOn) { out.path = { x0: doorMid - 0.6, y0: ent.y, x1: doorMid + 0.6, y1: edge }; }
		out.drive = gar ? { x0: gar.x0, y0: gar.y1, x1: gar.x1, y1: edge } : { x0: bb.x1 + 0.8, y0: D * 0.45, x1: bb.x1 + 3.8, y1: edge };
		// built and paved surfaces
		var hard = [];
		var H = function (r, m) { if (r) { hard.push([r.x0 - m, r.y0 - m, r.x1 + m, r.y1 + m]); } };
		vols.forEach(function (v) { var e = (v.ext || 0) + 0.35; hard.push([v.x0 - e, v.y0 - e, v.x1 + e, v.y1 + e]); if (v.porch || (v.main && st.porch)) { hard.push([v.x0, v.y1, v.x1, v.y1 + 2.6]); } if (v.veranda) { hard.push([v.x0, v.y1, v.x1, v.y1 + 1.8]); } if (v.frame) { hard.push([v.x0 - 0.5, v.y1, v.x1 + 0.5, v.y1 + 1.8]); } });
		H(gar, 0.3); H(out.drive, 0.15); H(ter, 0.25); H(out.path, 0.15);
		vols.forEach(function (v) { balconies(c, v, vplan(pl, v), vols).forEach(function (b) { if (b.type !== 'french') { H(balcRect(v, b), 0.5); } }); });
		hard.push([doorMid - 1.3, ent.y, doorMid + 1.3, ent.y + 1.6]);
		if ((c.ac_units || 'none') !== 'none' || has(c.energy, 'heat_pump')) { hard.push([mainV.x1, D * 0.35 - 0.4, mainV.x1 + 1.2, D * 0.35 + 1.5]); }
		if (has(gf, 'pool')) {
			out.pool = poolRect(c, vols, ext, plot, fenceY, siteAvoid(c, vols, ext, gar, ter, doorMid, ent.y));
			H(out.pool, 0.6);
		}
		var placed = [];
		function inA(x0, y0, x1, y1) { return x0 >= A.x0 - 1e-6 && x1 <= A.x1 + 1e-6 && y0 >= A.y0 - 1e-6 && y1 <= A.y1 + 1e-6; }
		function rectFree(x0, y0, x1, y1) {
			if (!inA(x0, y0, x1, y1)) { return false; }
			for (var i = 0; i < hard.length; i++) { var h = hard[i]; if (x0 < h[2] && x1 > h[0] && y0 < h[3] && y1 > h[1]) { return false; } }
			for (var j = 0; j < placed.length; j++) { var p = placed[j]; if (x0 < p.x + p.r && x1 > p.x - p.r && y0 < p.y + p.r && y1 > p.y - p.r) { return false; } }
			return true;
		}
		function ptFree(x, y, r) {
			if (!inA(x - r, y - r, x + r, y + r)) { return false; }
			for (var i = 0; i < hard.length; i++) { var h = hard[i]; var dx = Math.max(h[0] - x, 0, x - h[2]), dy = Math.max(h[1] - y, 0, y - h[3]); if (dx * dx + dy * dy < r * r) { return false; } }
			for (var j = 0; j < placed.length; j++) { var p = placed[j]; var d = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)); if (d < (p.r + r) * 0.85) { return false; } }
			return true;
		}
		// first free spot at (x, y) or within `reach` metres of it
		function spot(x, y, r, reach) {
			if (ptFree(x, y, r)) { return [x, y]; }
			for (var d = 0.6; d <= (reach || 0) + 1e-6; d += 0.6) {
				for (var k = 0; k < 16; k++) { var a = k * Math.PI / 8, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (ptFree(px, py, r)) { return [px, py]; } }
			}
			return null;
		}
		function rspot(x0, y0, w, d, reach) {
			if (rectFree(x0, y0, x0 + w, y0 + d)) { return { x0: x0, y0: y0, x1: x0 + w, y1: y0 + d }; }
			for (var s = 0.5; s <= (reach || 0) + 1e-6; s += 0.5) {
				var tries = [[s, 0], [-s, 0], [0, s], [0, -s], [s, s], [-s, s], [s, -s], [-s, -s]];
				for (var k = 0; k < tries.length; k++) { var a = x0 + tries[k][0], b = y0 + tries[k][1]; if (rectFree(a, b, a + w, b + d)) { return { x0: a, y0: b, x1: a + w, y1: b + d }; } }
			}
			return null;
		}
		function plantR(kind, size) {
			if (kind === 'grass' || kind === 'lavender' || kind === 'flower') { return 0.35; }
			if (kind === 'shrub' || kind === 'topiary') { return Math.max(0.4, size * 0.42); }
			if (kind === 'cypress') { return 0.55; }
			return clamp(size * 0.28, 0.6, 2.2);
		}
		function plant(kind, x, y, size, seed, reach) {
			var r = plantR(kind, size), p = spot(x, y, r, reach);
			if (!p) { return false; }
			out.plants.push({ kind: kind, x: p[0], y: p[1], size: size, seed: seed });
			placed.push({ x: p[0], y: p[1], r: r });
			return true;
		}
		function claim(rc, m) { if (rc) { hard.push([rc.x0 - (m || 0), rc.y0 - (m || 0), rc.x1 + (m || 0), rc.y1 + (m || 0)]); } return rc; }
		// structures first (they need the most room), then beds, then planting
		if (has(gf, 'hedge')) { out.hedge = { x0: A.x0, y0: A.y0, x1: A.x1, y1: A.y0 + 0.9 }; placed.push({ x: (A.x0 + A.x1) / 2, y: A.y0 + 0.45, r: 0.45 }); hard.push([A.x0, A.y0, A.x1, A.y0 + 0.9]); }
		var by = A.y0 + (out.hedge ? 1.1 : 0.3);
		if (has(gf, 'shed')) { out.shed = claim(rspot(A.x1 - 2.4, by, 2.2, 1.8, 3) || rspot(A.x0 + 0.2, by, 2.2, 1.8, 3), 0.2); }
		if (has(gf, 'playground') && season !== 'winter') { out.playground = claim(rspot(A.x1 - 2.7, by + 2.4, 2.5, 2.5, 3) || rspot(A.x0 + 0.2, by + 2.4, 2.5, 2.5, 3), 0.1); }
		if (has(gf, 'firepit')) { var fp = spot(A.x0 + 3.2, my + 3.5, 0.9, 3); if (fp) { out.firepit = { x: fp[0], y: fp[1] }; hard.push([fp[0] - 0.9, fp[1] - 0.9, fp[0] + 0.9, fp[1] + 0.9]); } }
		if (!ter && (has(gf, 'pergola') || has(c.shading, 'pergola'))) { out.pergola = claim(rspot(A.x0 + 1.1, my + 2.2, 3.0, 2.6, 3), 0.2); }
		if (!ter && (has(gf, 'garden_furniture') || has(gf, 'outdoor_kitchen'))) {
			var fx = out.pergola ? out.pergola.x0 + 0.6 : A.x0 + 1.7, fy = out.pergola ? out.pergola.y0 + 0.6 : my + 2.8;
			var fr = out.pergola ? { x0: fx, y0: fy, x1: fx + 2, y1: fy + 2 } : claim(rspot(fx, fy, 2.0, 2.0, 3), 0.1);
			if (fr) { out.furniture = { x: fr.x0, y: fr.y0, kitchen: has(gf, 'outdoor_kitchen') }; }
		}
		if (gs === 'minimal' || gs === 'mediterranean') {
			var g0 = { x0: A.x0 + 0.5, y0: my + 0.8, x1: Math.max(A.x0 + 1.5, doorMid - 1.4), y1: A.y1 - 0.5 };
			var clash = [out.pool, ter, out.pergola, out.furniture].some(function (r) { return r && g0.x0 < r.x1 && g0.x1 > r.x0 && g0.y0 < r.y1 && g0.y1 > r.y0; });
			if (!clash && g0.x1 - g0.x0 > 0.8 && g0.y1 - g0.y0 > 0.8) { out.gravel = g0; }
		}
		if (has(gf, 'flowerbeds') && season !== 'winter') {
			var bx0 = Math.max(A.x0, mainV.x0 + 0.2), bx1 = Math.min(mainV.x0 + 3, doorMid - 1.2);
			if (bx1 - bx0 >= 0.9) {
				var bed = rspot(bx0, my + 1.0, bx1 - bx0, 0.8, 4);
				if (bed) {
					out.flats.push({ kind: 'soil', x0: bed.x0, y0: bed.y0, x1: bed.x1, y1: bed.y1 });
					for (var fb = 0; bed.x0 + 0.3 + fb * 0.42 < bed.x1 - 0.15; fb++) { out.plants.push({ kind: 'flower', x: bed.x0 + 0.3 + fb * 0.42, y: (bed.y0 + bed.y1) / 2, size: 0.5, seed: fb }); }
					claim(bed, 0.1);
				}
			}
		}
		if (out.playground) { out.flats.push({ kind: 'sand', x0: out.playground.x0, y0: out.playground.y0, x1: out.playground.x1, y1: out.playground.y1 }); }
		var kinds = { natural: ['deciduous', 'deciduous', 'conifer', 'multistem', 'shrub'], formal: ['topiary', 'topiary', 'cypress', 'deciduous', 'topiary'], minimal: ['multistem', 'grass', 'grass', 'multistem', 'grass'], cottage: ['fruit', 'deciduous', 'shrub', 'fruit', 'shrub'], mediterranean: ['olive', 'cypress', 'cypress', 'olive', 'lavender'] }[gs] || ['deciduous'];
		if (gs === 'mediterranean') { [[A.x0 + 0.9, my + 0.8], [A.x0 + 2.3, my + 0.8]].forEach(function (q, i) { plant('cypress', q[0], q[1], 4.5, 7 + i, 1.8); }); }
		if (gs === 'formal') { [[A.x0 + 1.1, my + 1], [A.x1 - 1.1, my + 1]].forEach(function (q, i) { plant('cypress', q[0], q[1], 3.6, 9 + i, 1.8); }); }
		var dens = c.garden_density || 'normal', tt = (Array.isArray(c.tree_types) ? c.tree_types : []).filter(function (k) { return !!TREE_SIZE[k]; });
		if (has(gf, 'trees') || !c.garden_features) {
			var spots = [[A.x0 + 1.9, A.y0 + 2.2, 7.5], [A.x1 - 2.2, A.y0 + 2.7, 8], [A.x0 + 1.3, A.y1 - 1.9, 6], [A.x1 - 1.5, A.y1 - 1.3, 5.5], [doorMid - 2.2, my + 1.4, 1.1]];
			if (dens === 'sparse') { spots = spots.slice(0, 2).concat([spots[4]]); }
			if (dens === 'lush') {
				// more trees along the back and the sides of the plot, shrubs at the house corners
				for (var bx2 = A.x0 + 4.6; bx2 < A.x1 - 3.5; bx2 += 3.6) { spots.push([bx2, A.y0 + 1.6 + ((Math.round(bx2) % 2) ? 0.9 : 0), 6.5]); }
				for (var sy2 = A.y0 + 5.5; sy2 < A.y1 - 4; sy2 += 3.4) { spots.push([A.x0 + 1.1, sy2, 5.5], [A.x1 - 1.1, sy2 + 1.2, 6]); }
				[[mainV.x0 - 0.9, my + 0.9], [mainV.x1 + 0.9, my + 0.9], [mainV.x0 - 0.9, mainV.y0 - 0.9], [mainV.x1 + 0.9, mainV.y0 - 0.9], [doorMid + 2.4, my + 1.3]].forEach(function (q) { spots.push([q[0], q[1], 1.1]); });
			}
			var ti = 0;
			spots.forEach(function (sp, i) {
				var small = sp[2] < 2, k = small ? (i === 4 || dens !== 'lush' ? kinds[4] : (i % 2 ? 'shrub' : rowKindOf(gs))) : (tt.length ? tt[ti++ % tt.length] : kinds[i < 4 ? i : (i % 4)]);
				var sz = k === 'grass' || k === 'lavender' || k === 'shrub' || k === 'topiary' ? (small ? 1.0 : 1.6) : sp[2] * (tt.length ? TREE_SIZE[k] || 1 : 1);
				plant(k, sp[0], sp[1], sz, 11 + i * 7, small ? 1.2 : 3);
			});
		}
		var rowKind = rowKindOf(gs);
		if (gs !== 'natural' || has(gf, 'flowerbeds')) {
			var step = gs === 'formal' ? 1.3 : (gs === 'minimal' ? 1.8 : 0.95), ri = 0, rsz = gs === 'formal' ? 1.15 : (gs === 'minimal' ? 1.2 : 0.95);
			for (var py = ent.y + 1.6; py < A.y1 - 0.6; py += step) {
				[-1.15, 1.15].forEach(function (dx) { ri++; if (gs === 'natural' && (ri * 7919) % 10 < 4) { return; } plant(rowKind, doorMid + dx, py, rsz, 101 + ri, 0); });
			}
		}
		// vehicles: under the carport, then on the driveway (side by side, nose to the street);
		// motorbikes and bicycles share a parking space or stand beside the drive
		out.vehicles = [];
		var vl = vehicleList(c), cars = vl.filter(function (k) { return k !== 'motorcycle' && k !== 'bicycle'; }), two = vl.filter(function (k) { return k === 'motorcycle' || k === 'bicycle'; });
		var cells = [], dr = out.drive;
		function slot(r) {
			var w = r.x1 - r.x0, l = r.y1 - r.y0, lanes = Math.floor(w / 2.45), rows = Math.floor(l / 5.7);
			if (lanes < 1 && w >= 2.1) { lanes = 1; } if (rows < 1 && l >= 4.3) { rows = 1; }
			for (var ro = 0; ro < rows; ro++) { for (var la = lanes - 1; la >= 0; la--) { cells.push({ x: r.x0 + (la + 0.5) * w / lanes, y: r.y1 - (ro + 0.5) * l / rows, w: w / lanes, l: l / rows }); } }
		}
		if (gar && c.garage === 'carport') { slot({ x0: gar.x0 + 0.25, x1: gar.x1 - 0.25, y0: gar.y0 + 0.3, y1: gar.y1 - 0.05 }); cells.forEach(function (q) { q.port = true; }); }
		slot({ x0: dr.x0 + 0.15, x1: dr.x1 - 0.15, y0: dr.y0 + 0.35, y1: dr.y1 - 0.4 });
		cars.forEach(function (k) {
			var i = cells.findIndex(function (q) { return q.l >= VEH[k][1] + 0.1 && q.w >= VEH[k][0] + 0.2; });
			if (i < 0) { return; }
			var q = cells.splice(i, 1)[0];
			out.vehicles.push({ type: k, x: q.x, y: q.y, rot: 0, port: !!q.port });
			if (k === 'electric' && !has(c.energy, 'ev_charger')) { out.charger = { x: q.x - VEH[k][0] / 2 - 0.35, y: q.y + VEH[k][1] / 2 - 0.4 }; }
		});
		two.forEach(function (k, i) {
			var q = cells[0];
			if (q && q.l >= 2.3) { out.vehicles.push({ type: k, x: q.x + (q.used ? 0.55 : -0.55), y: q.y, rot: 0, port: !!q.port }); if (q.used) { cells.shift(); } else { q.used = true; } return; }
			var p = spot((gar ? gar.x1 : dr.x1) + 0.9 + i * 0.9, (gar ? gar.y1 : dr.y0) - 1.4, 1.1, 2.4);
			if (p) { out.vehicles.push({ type: k, x: p[0], y: p[1], rot: 0 }); placed.push({ x: p[0], y: p[1], r: 1.1 }); }
		});
		// people: on the terrace if there is one (or in front of the entrance), the children on the lawn
		out.people = []; out.pets = []; out.kennel = null;
		var who = PEOPLE[c.people] || [], meet = ter ? { x: Math.min(ter.x1 - 1, ter.x0 + 1.6), y: (ter.y0 + ter.y1) / 2 + 0.3 } : { x: doorMid + 1.9, y: ent.y + 2.6 };
		var adults = who.filter(function (w) { return w[0] !== 'child'; });
		adults.forEach(function (w, i) {
			var a = (i + 0.5) / adults.length * Math.PI * 2 + 0.6, px = meet.x + Math.cos(a) * 0.62, py = meet.y + Math.sin(a) * 0.5;
			out.people.push({ kind: w[0], pose: w[1], x: px, y: py, rot: Math.atan2(meet.x - px, meet.y - py), seed: 3 + i * 5 });
		});
		who.filter(function (w) { return w[0] === 'child'; }).forEach(function (w, i) {
			var p = spot(A.x0 + 3.5 + i * 1.4, Math.min(A.y1 - 1, my + 4.2), 0.4, 4);
			if (p) { out.people.push({ kind: 'child', pose: w[1], x: p[0], y: p[1], rot: 0.5 - i, seed: 20 + i }); placed.push({ x: p[0], y: p[1], r: 0.4 }); }
		});
		// pets on the lawn near the people; the big dog gets a kennel by the house
		(Array.isArray(c.pets) ? c.pets : []).forEach(function (k, i) {
			var p = k === 'cat' && ter ? [Math.min(ter.x1 - 0.4, meet.x + 1.4), ter.y1 - 0.5] : (spot(meet.x + 1.6 + i * 1.1, Math.min(A.y1 - 1, meet.y + 2.0), 0.5, 4) || spot(doorMid - 2.5 - i, Math.min(A.y1 - 1, my + 3), 0.5, 6) || spot((A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, 0.5, 8));
			if (!p) { return; }
			out.pets.push({ kind: k, x: p[0], y: p[1], rot: 2.2 - i * 1.3, pose: k === 'cat' ? 'sit' : (i % 2 ? 'lie' : 'stand'), seed: 7 + i, z: k === 'cat' && ter ? 0.18 : 0 });
			if (!(k === 'cat' && ter)) { placed.push({ x: p[0], y: p[1], r: 0.5 }); }
			if (k === 'dog_large' && !out.kennel) { var kp = spot(mainV.x0 - 1.4, mainV.y0 + 2.2, 0.7, 3); if (kp) { out.kennel = { x: kp[0], y: kp[1] }; placed.push({ x: kp[0], y: kp[1], r: 0.7 }); } }
		});
		if (has(gf, 'garden_lights')) {
			[[doorMid - 1.2, edge - 1.5], [doorMid + 1.2, edge - 3.5], [A.x0 + 2.7, my + 2]].forEach(function (q) { var p = spot(q[0], q[1], 0.2, 1.2); if (p) { out.lights.push(p); placed.push({ x: p[0], y: p[1], r: 0.2 }); } });
		}
		// fence: front with openings, sides and back along the plot
		if (c.fence && c.fence !== 'none') {
			var f = { y: fenceY, x0: plot ? plot.x0 : ext.left + 0.6, x1: plot ? plot.x1 : ext.right - 0.6, sides: [], back: null };
			if (plot) {
				var yb = plot.yB !== null ? plot.yB : ext.back + 0.6;
				f.sides = [[plot.x0, yb, fenceY], [plot.x1, yb, fenceY]];
				if (plot.yB !== null) { f.back = [plot.x0, plot.x1, plot.yB]; }
			}
			f.gaps = [[out.drive.x0 - 0.15, out.drive.x1 + 0.15]];
			if (pathOn || c.gate !== false) { f.gaps.push([doorMid - 0.6, doorMid + 0.6]); }
			out.fence = f;
		}
		return out;
	}
	// Massing signatures drawn around a volume: frame, veranda, balconies, exoskeleton, roof-terrace railing.
	function deco2d(sc, v, pl, type, roof) {
		var c = sc.c, out = [], fcol = col(c.facade_color, '#F2EFE9');
		var push = function (list) { list.forEach(function (r) { if (r) { out.push(r); } }); };
		if (v.frame && type === 'flat') {
			var fm = { top: shade(fcol, 0.06), front: fcol, side: shade(fcol, -0.12) }, dy = 1.5;
			push(box(sc, v.x0 - 0.35, v.y1 - 0.3, v.h + 0.05, v.x1 + 0.35, v.y1 + dy, v.h + 0.55, fm));
			push(box(sc, v.x0 - 0.35, v.y1, 0, v.x0, v.y1 + dy, v.h + 0.05, fm));
			push(box(sc, v.x1, v.y1, 0, v.x1 + 0.35, v.y1 + dy, v.h + 0.05, fm));
		}
		if (v.veranda) {
			var ez = type === 'flat' ? v.h : v.h - (pl.eave || 0) * Math.tan(pl.pitch * D2R) - 0.05;
			push(box(sc, v.x0, v.y1, 0, v.x1, v.y1 + 1.5, pl.plinth, { top: sc.mat('deck', '#A97B52'), front: '#6B5240' }));
			for (var px = v.x0 + 0.3; px < v.x1 - 0.1; px += 2.4) { push(box(sc, px, v.y1 + 1.25, pl.plinth, px + 0.14, v.y1 + 1.39, ez, { top: '#5A4636', front: '#7A5A40', side: '#5A4636' })); }
		}
		if (v.balc && (pl.floors > 1 || pl.attic)) {
			var bz = pl.plinth + pl.FH, lenF = v.x1 - v.x0 - 0.4, lenR = v.y1 - v.y0 - 0.6, sl = function (L) { var q = ''; for (var x = 0.08; x < L; x += 0.16) { q += '<rect x="' + f(x) + '" y="0" width="0.08" height="1" fill="#7A5236"/>'; } return q + '<rect x="0" y="0.92" width="' + f(L) + '" height="0.08" fill="#6B4A33"/>'; };
			push(box(sc, v.x0 + 0.2, v.y1, bz - 0.22, v.x1 - 0.2, v.y1 + 1.3, bz, { top: sc.mat('deck', '#A97B52'), front: '#7A5A40' }));
			push([sc.plane([v.x0 + 0.2, v.y1 + 1.3, bz], [1, 0, 0], [0, 0, 1], [[0, 0], [lenF, 0], [lenF, 1], [0, 1]], 'none', sl(lenF), { noShade: true, edge: false })]);
			push(box(sc, v.x1, v.y0 + 0.6, bz - 0.22, v.x1 + 1.2, v.y1, bz, { top: sc.mat('deck', '#A97B52'), front: '#7A5A40' }));
			push([sc.plane([v.x1 + 1.2, v.y1, bz], [0, -1, 0], [0, 0, 1], [[0, 0], [lenR, 0], [lenR, 1], [0, 1]], 'none', sl(lenR), { noShade: true, edge: false })]);
		}
		if (v.exo) {
			var stl = '#5E6266', sm = { top: '#7C8186', front: stl, side: shade(stl, -0.15) }, e = 0.9, zt = v.h + 0.45;
			var nx = Math.max(2, Math.round((v.x1 - v.x0 + 2 * e) / 3)), ny = Math.max(2, Math.round((v.y1 - v.y0 + 2 * e) / 3));
			for (var k = 1; k < pl.floors; k++) {
				var z = pl.plinth + k * pl.FH;
				if (z >= v.h) { break; }
				push(box(sc, v.x0 - e, v.y1, z - 0.18, v.x1 + e, v.y1 + e + 0.1, z, { top: '#8A8F94', front: stl }));
				push([sc.plane([v.x0 - e, v.y1 + e + 0.1, z], [1, 0, 0], [0, 0, 1], [[0, 0], [v.x1 - v.x0 + 2 * e, 0], [v.x1 - v.x0 + 2 * e, 1], [0, 1]], 'rgba(200,225,235,0.35)', '', { noShade: true, stroke: '#C7D4DA', sw: 0.02 })]);
			}
			push(box(sc, v.x0 - e - 0.15, v.y0 - e - 0.15, v.h + 0.35, v.x1 + e + 0.15, v.y1 + e + 0.15, v.h + 0.5, { top: '#C9CCCE', front: '#9DA1A4', side: '#8A8F94' }));
			for (var i = 0; i <= nx; i++) { var cx = v.x0 - e + (v.x1 - v.x0 + 2 * e) * i / nx; push(box(sc, cx - 0.1, v.y1 + e - 0.1, 0, cx + 0.1, v.y1 + e + 0.1, zt, sm)); }
			for (var j = 0; j < ny; j++) { var cy = v.y0 - e + (v.y1 - v.y0 + 2 * e) * j / ny; push(box(sc, v.x1 + e - 0.1, cy - 0.1, 0, v.x1 + e + 0.1, cy + 0.1, zt, sm)); }
		}
		if (v.terraceRoof && type === 'flat') {
			var zr = v.h + 0.35, gl = 'rgba(200,225,235,0.35)', o2 = { noShade: true, stroke: '#C7D4DA', sw: 0.02 };
			push([sc.plane([v.x0, v.y1 + 0.05, zr], [1, 0, 0], [0, 0, 1], [[0, 0], [v.x1 - v.x0, 0], [v.x1 - v.x0, 1], [0, 1]], gl, '', o2),
				sc.plane([v.x1 + 0.05, v.y1, zr], [0, -1, 0], [0, 0, 1], [[0, 0], [v.y1 - v.y0, 0], [v.y1 - v.y0, 1], [0, 1]], gl, '', o2)]);
		}
		void roof;
		return out;
	}

	/* ------------------------------------------------------------------ facade details (local coords) */
	function windowSpec(c) {
		switch (c.window_style) {
			case 'classic': return { w: 1.15, h: 1.45, sill: 0.95, gap: 1.3 };
			case 'panoramic': return { w: 2.4, h: 2.45, sill: 0.05, gap: 0.5 };
			case 'vertical': return { w: 0.75, h: 2.1, sill: 0.35, gap: 0.9 };
			case 'arched': return { w: 1.1, h: 1.6, sill: 0.85, gap: 1.2 };
			case 'square': return { w: 1.2, h: 1.2, sill: 1.0, gap: 1.1 };
			case 'ribbon': return { w: 3.2, h: 0.95, sill: 1.15, gap: 0.8 };
			case 'bay': return { w: 2.3, h: 1.55, sill: 0.8, gap: 0.8 };
			default: return { w: 1.9, h: 1.65, sill: 0.6, gap: 1.0 };
		}
	}
	function glass(sc) {
		var c = sc.c, L = sc.light;
		if (L.glow && c.night_lighting !== false) {
			return 'url(#' + sc.def('glow', '<linearGradient id="' + sc.id + 'glow" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE3A3"/><stop offset="1" stop-color="#F6B85C"/></linearGradient>') + ')';
		}
		var sky = SKY[L.tod];
		var tintG = c.glazing === 'tinted' ? 0.35 : 0;
		var top = mix(sky[0], '#26313D', 0.35 + tintG), bot = mix(sky[1], '#5B6B78', 0.45 + tintG);
		if (c.glazing === 'frosted') { top = '#C9D3DA'; bot = '#AEB9C1'; }
		var key = 'gl' + top.substr(1) + bot.substr(1);
		return 'url(#' + sc.def(key, '<linearGradient id="' + sc.id + key + '" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="' + top + '"/><stop offset="0.55" stop-color="' + bot + '"/><stop offset="0.56" stop-color="' + mix(bot, '#FFFFFF', 0.25) + '"/><stop offset="1" stop-color="' + top + '"/></linearGradient>') + ')';
	}
	// One window in local coordinates (x = left edge, y = sill height above the face origin).
	function windowSvg(sc, x, y, w, h, opt) {
		var c = sc.c, st = styleOf(c), fc = col(c.window_frame_color, '#2F3235');
		var mat = c.window_frame_material || 'aluminium';
		var fr = { pvc: 0.09, aluminium: 0.045, wood: 0.075, wood_alu: 0.06 }[mat] || 0.05;
		var s = '';
		var tc = trimColor(c);
		if (tc) { s += '<rect x="' + f(x - 0.11) + '" y="' + f(y - 0.11) + '" width="' + f(w + 0.22) + '" height="' + f(h + 0.22) + '" fill="' + tc + '"/>'; }
		if (st.lintel) { s += '<rect x="' + f(x - 0.16) + '" y="' + f(y + h + 0.02) + '" width="' + f(w + 0.32) + '" height="0.2" fill="' + st.lintel + '"/>'; }
		if ((st.arches || c.window_style === 'arched') && !(opt && opt.noArch)) { s += '<path d="M' + f(x) + ' ' + f(y + h - 0.01) + 'A' + f(w / 2) + ' ' + f(Math.min(w / 2, 0.55)) + ' 0 0 0 ' + f(x + w) + ' ' + f(y + h - 0.01) + 'Z" fill="' + fc + '"/><path d="M' + f(x + fr) + ' ' + f(y + h) + 'A' + f(w / 2 - fr) + ' ' + f(Math.min(w / 2, 0.55) - fr) + ' 0 0 0 ' + f(x + w - fr) + ' ' + f(y + h) + 'Z" fill="' + glass(sc) + '"/>'; }
		s += '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + fc + '"/>' +
			'<rect x="' + f(x + fr) + '" y="' + f(y + fr) + '" width="' + f(w - 2 * fr) + '" height="' + f(h - 2 * fr) + '" fill="' + glass(sc) + '"/>';
		if (mat === 'wood' || mat === 'wood_alu') { s += '<rect x="' + f(x + fr * 0.55) + '" y="' + f(y + fr * 0.55) + '" width="' + f(w - fr * 1.1) + '" height="' + f(h - fr * 1.1) + '" fill="none" stroke="#A8744A" stroke-width="' + f(fr * 0.45) + '"/>'; }
		if (st.reveal) { s += '<path d="M' + f(x + fr) + ' ' + f(y + fr) + 'V' + f(y + h - fr) + 'H' + f(x + w - fr) + '" fill="none" stroke="#1B2230" stroke-opacity="0.35" stroke-width="0.1"/>'; }
		var mull = Math.max(1, Math.round(w / (c.window_style === 'panoramic' ? 1.3 : 1.1)));
		for (var i = 1; i < mull; i++) { s += '<rect x="' + f(x + w * i / mull - 0.025) + '" y="' + f(y) + '" width="0.05" height="' + f(h) + '" fill="' + fc + '"/>'; }
		if (c.window_divided || st.grid) {
			// glazing bars: a grid of small panes
			var gx = Math.max(2, Math.round(w / 0.42)), gy = Math.max(2, Math.round(h / 0.5));
			for (var a = 1; a < gx; a++) { s += '<rect x="' + f(x + w * a / gx - 0.012) + '" y="' + f(y) + '" width="0.024" height="' + f(h) + '" fill="' + fc + '"/>'; }
			for (var b2 = 1; b2 < gy; b2++) { s += '<rect x="' + f(x) + '" y="' + f(y + h * b2 / gy - 0.012) + '" width="' + f(w) + '" height="0.024" fill="' + fc + '"/>'; }
		} else if (c.window_style === 'classic') {
			s += '<rect x="' + f(x) + '" y="' + f(y + h * 0.62) + '" width="' + f(w) + '" height="0.04" fill="' + fc + '"/>';
		}
		// sill
		s += '<rect x="' + f(x - 0.05) + '" y="' + f(y - 0.05) + '" width="' + f(w + 0.1) + '" height="0.05" fill="' + shade(fc, 0.35) + '"/>';
		var sh = c.shading || [];
		if (opt && opt.shutters) {
			var scol = opt.shutters;
			s += '<rect x="' + f(x - w * 0.5 - 0.04) + '" y="' + f(y) + '" width="' + f(w * 0.5) + '" height="' + f(h) + '" fill="' + scol + '"/>' +
				'<rect x="' + f(x + w + 0.04) + '" y="' + f(y) + '" width="' + f(w * 0.5) + '" height="' + f(h) + '" fill="' + shade(scol, -0.08) + '"/>';
			for (var k = 1; k < 6; k++) { s += '<path d="M' + f(x - w * 0.5) + ' ' + f(y + h * k / 6) + 'h' + f(w * 0.45) + 'M' + f(x + w + 0.08) + ' ' + f(y + h * k / 6) + 'h' + f(w * 0.45) + '" stroke="' + shade(scol, -0.25) + '" stroke-width="0.015"/>'; }
		}
		if (has(sh, 'blinds')) {
			s += '<rect x="' + f(x - 0.04) + '" y="' + f(y + h) + '" width="' + f(w + 0.08) + '" height="0.16" fill="' + shade(fc, 0.15) + '"/>';
			if (opt && opt.blindsDown) {
				var bd = h * 0.38;
				s += '<rect x="' + f(x + fr) + '" y="' + f(y + h - bd) + '" width="' + f(w - 2 * fr) + '" height="' + f(bd) + '" fill="' + shade(fc, 0.3) + '"/>';
				for (var b = 0.06; b < bd; b += 0.07) { s += '<rect x="' + f(x + fr) + '" y="' + f(y + h - b) + '" width="' + f(w - 2 * fr) + '" height="0.012" fill="' + shade(fc, 0.05) + '"/>'; }
			}
		}
		return s;
	}
	function doorSvg(sc, x, w, h) {
		var c = sc.c, dc = col(c.entrance_door_color, '#2B2E31'), fc = col(c.window_frame_color, '#2F3235'), t = c.entrance_door || 'solid_modern';
		var s = '<rect x="' + f(x - 0.06) + '" y="0" width="' + f(w + 0.12) + '" height="' + f(h + 0.06) + '" fill="' + fc + '"/>';
		if (t === 'wood') { s += '<rect x="' + f(x) + '" y="0" width="' + f(w) + '" height="' + f(h) + '" fill="' + sc.mat('wood', '#8A5A36') + '"/>'; }
		else { s += '<rect x="' + f(x) + '" y="0" width="' + f(w) + '" height="' + f(h) + '" fill="' + dc + '"/>'; }
		if (t === 'double') { s += '<rect x="' + f(x + w / 2 - 0.015) + '" y="0" width="0.03" height="' + f(h) + '" fill="' + fc + '"/><rect x="' + f(x + w / 2 - 0.2) + '" y="' + f(h * 0.38) + '" width="0.035" height="0.45" fill="#C9CCCF"/>'; }
		if (t === 'glass_full') { s += '<rect x="' + f(x + 0.1) + '" y="0.1" width="' + f(w - 0.2) + '" height="' + f(h - 0.2) + '" fill="' + glass(sc) + '"/>'; }
		if (t === 'half_glass') { s += '<rect x="' + f(x + 0.12) + '" y="' + f(h * 0.5) + '" width="' + f(w - 0.24) + '" height="' + f(h * 0.42) + '" fill="' + glass(sc) + '"/>'; }
		if (t === 'slat') { for (var sl = x + 0.1; sl < x + w - 0.05; sl += 0.12) { s += '<rect x="' + f(sl) + '" y="0.04" width="0.07" height="' + f(h - 0.08) + '" fill="' + sc.mat('wood', '#8A5A36') + '"/>'; } }
		if (t === 'sidelight') { s += '<rect x="' + f(x + w * 0.64) + '" y="0.1" width="' + f(w * 0.3) + '" height="' + f(h - 0.2) + '" fill="' + glass(sc) + '"/>'; }
		if (t === 'glass_strip') { s += '<rect x="' + f(x + w * 0.68) + '" y="0.15" width="' + f(w * 0.16) + '" height="' + f(h - 0.3) + '" fill="' + glass(sc) + '"/>'; }
		if (t === 'classic') {
			s += '<rect x="' + f(x + 0.12) + '" y="0.2" width="' + f(w - 0.24) + '" height="' + f(h * 0.38) + '" fill="none" stroke="' + shade(dc, 0.18) + '" stroke-width="0.03"/>' +
				'<rect x="' + f(x + 0.12) + '" y="' + f(h * 0.5) + '" width="' + f(w - 0.24) + '" height="' + f(h * 0.38) + '" fill="none" stroke="' + shade(dc, 0.18) + '" stroke-width="0.03"/>' +
				'<rect x="' + f(x) + '" y="' + f(h + 0.06) + '" width="' + f(w) + '" height="0.35" fill="' + glass(sc) + '"/>';
		}
		s += '<rect x="' + f(x + w * 0.12) + '" y="' + f(h * 0.38) + '" width="0.035" height="' + f(t === 'pivot' ? h * 0.5 : 0.45) + '" fill="#C9CCCF"/>';
		return s;
	}
	function shutterColor(c) {
		var sh = c.shading || [], own = c.shutter_color && String(c.shutter_color).toUpperCase() !== '#3E4245' ? c.shutter_color : null;
		if (!has(sh, 'spalettas') && !has(sh, 'shutters')) { return null; }
		if (own) { return own; }
		if (has(sh, 'spalettas')) { return '#8A5A36'; }
		if (c.arch_style === 'mediterranean' || c.arch_style === 'rustic') { return '#6B7A55'; }
		if (c.arch_style === 'classic_burgher' || c.arch_style === 'american_farm') { return c.arch_style === 'american_farm' ? '#24282B' : '#ECE7DC'; }
		return '#3E4245';
	}

	/* ------------------------------------------------------------------ walls */
	function wallFill(sc, v, face) {
		var c = sc.c, mat = c.facade_main || 'render';
		var acc = c.facade_accent || [];
		// Accent material on the secondary volume (wing / garage side) or on the gable.
		if (acc.length && (v.wing || v.second) && face === 'front') { mat = acc[0]; }
		if (acc.length && mat === acc[0] && mat !== c.facade_main) { return accentFill(sc, mat); }
		if (mat === 'render') { return sc.mat({ fine: 'renderfine', coarse: 'rendercoarse' }[c.facade_texture || 'fine'] || 'render', col(c.facade_color, '#F2EFE9')); }
		return sc.mat(mat, facadeBase(c, mat));
	}
	// Accent material; the accent colour tints the materials that come in a colour (wood, metal, dark render).
	function accentFill(sc, mat) {
		var c = sc.c, tint = c.facade_accent_color && (mat === 'wood' || mat === 'metal' || mat === 'render_dark');
		return sc.mat(mat, tint ? col(c.facade_accent_color, facadeBase(c, mat)) : facadeBase(c, mat));
	}
	var VISUAL_ENERGY = ['heat_pump', 'ac', 'solar', 'battery', 'ev_charger', 'mvhr', 'rainwater'];
	function plinthFill(c) {
		switch (c.plinth) {
			case 'stone': return '#8D8576';
			case 'concrete': return '#9D9A94';
			case 'flush': return null;
			default: return col(c.plinth_color, '#4A4D50');
		}
	}
	// Building services on the side wall: air-conditioning unit, home battery, ventilation grille.
	function wallTech(sc, len, pl) {
		var c = sc.c, e = c.energy || [], s = '';
		if (has(e, 'ac')) { s += '<rect x="' + f(len * 0.55) + '" y="' + f(pl.plinth + 2.1) + '" width="0.85" height="0.55" fill="#E9EBEC" stroke="#9DA1A4" stroke-width="0.03"/><circle cx="' + f(len * 0.55 + 0.42) + '" cy="' + f(pl.plinth + 2.37) + '" r="0.19" fill="#C3C7CA"/>'; }
		if (has(e, 'battery')) { s += '<rect x="' + f(len * 0.2) + '" y="' + f(pl.plinth + 0.5) + '" width="0.6" height="0.95" rx="0.06" fill="#F4F5F6" stroke="#8C9196" stroke-width="0.03"/><rect x="' + f(len * 0.2 + 0.25) + '" y="' + f(pl.plinth + 1.2) + '" width="0.1" height="0.1" fill="#4CAF7A"/>'; }
		if (has(e, 'mvhr')) { s += '<rect x="' + f(len * 0.8) + '" y="' + f(pl.plinth + 2.5) + '" width="0.45" height="0.45" fill="#B9BDC1"/><path d="M' + f(len * 0.8) + ' ' + f(pl.plinth + 2.6) + 'h0.45M' + f(len * 0.8) + ' ' + f(pl.plinth + 2.72) + 'h0.45M' + f(len * 0.8) + ' ' + f(pl.plinth + 2.84) + 'h0.45" stroke="#6E7378" stroke-width="0.03"/>'; }
		return s;
	}
	// Front (y = y1) and right (x = x1) walls with windows/doors; gable triangles when the roof needs them.
	// Outline of a rounded volume (counter-clockwise, offset e outwards).
	function roundPts(v, r, e, n) {
		var out = [], cs = [[v.x1 - r, v.y0 + r, -Math.PI / 2], [v.x1 - r, v.y1 - r, 0], [v.x0 + r, v.y1 - r, Math.PI / 2], [v.x0 + r, v.y0 + r, Math.PI]];
		cs.forEach(function (q) { for (var i = 0; i <= n; i++) { var a = q[2] + Math.PI / 2 * i / n; out.push([q[0] + (r + e) * Math.cos(a), q[1] + (r + e) * Math.sin(a)]); } });
		return out;
	}
	// Curved corners of a rounded volume as narrow wall strips (z from z0 to z1).
	function roundStrips(sc, v, r, e, z0, z1, fill) {
		var out = [], cs = [[v.x1 - r, v.y1 - r, 0], [v.x0 + r, v.y1 - r, Math.PI / 2], [v.x0 + r, v.y0 + r, Math.PI], [v.x1 - r, v.y0 + r, Math.PI * 1.5]], n = 6;
		cs.forEach(function (q) {
			for (var i = n; i > 0; i--) {
				var a = q[2] + Math.PI / 2 * i / n, b = q[2] + Math.PI / 2 * (i - 1) / n;
				var p0 = [q[0] + (r + e) * Math.cos(a), q[1] + (r + e) * Math.sin(a), 0], p1 = [q[0] + (r + e) * Math.cos(b), q[1] + (r + e) * Math.sin(b), 0];
				var d = sub(p1, p0), L = Math.sqrt(dot(d, d));
				var rr = sc.plane(p0, mul(d, 1 / L), [0, 0, 1], [[0, z0], [L, z0], [L, z1], [0, z1]], fill, '', { edge: false });
				if (rr) { out.push(rr); }
			}
		});
		return out;
	}
	function walls(sc, v, pl, roof, vols) {
		var c = sc.c, out = [], r = roundR(c, v), z0 = v.z0 || 0, fp = frontPlan(c, v, vols);
		var faces = [
			{ name: 'front', o: [v.x0 + r, v.y1, 0], du: [1, 0, 0], len: v.x1 - v.x0 - 2 * r },
			{ name: 'right', o: [v.x1, v.y1 - r, 0], du: [0, -1, 0], len: v.y1 - v.y0 - 2 * r }
		];
		if (r > 0) { roundStrips(sc, v, r, 0, z0, v.h, wallFill(sc, v, 'front')).forEach(function (q) { out.push(q); }); }
		faces.forEach(function (F) {
			var dv = [0, 0, 1];
			if (!sc.visible(F.du, dv)) { return; }
			var poly = [[0, z0], [F.len, z0]];
			var top = roof.wallTop ? roof.wallTop(F.name) : null;
			if (top) { top.forEach(function (p) { poly.push(p); }); } else { poly.push([F.len, v.h], [0, v.h]); }
			if (v.glass) {
				var mul2 = '';
				for (var mx = 1.2; mx < F.len - 0.2; mx += 1.2) { mul2 += '<rect x="' + f(mx - 0.03) + '" y="' + f(z0) + '" width="0.06" height="' + f(v.h - z0) + '" fill="' + col(c.window_frame_color, '#2F3235') + '"/>'; }
				var gw = sc.plane(F.o, F.du, dv, poly, glass(sc), mul2);
				if (gw) { out.push(gw); }
				return;
			}
			var inner = '', st = styleOf(c), acc = c.facade_accent || [], main = v.main;
			var fcol = col(c.facade_color, '#F2EFE9');
			// accent zones: 1st = entrance bay, 2nd = gable (or the front part of the side wall), 3rd = side wall ground floor
			if (F.name === 'front' && acc[0] && fp.door && (main || v.risalit)) {
				var dp = fp.door;
				inner += '<rect x="' + f(Math.max(0, dp.x - 0.75)) + '" y="0" width="' + f(Math.min(F.len, dp.w + 1.5)) + '" height="' + f(v.h) + '" fill="' + accentFill(sc, acc[0]) + '"/>';
			}
			if (main && acc[1]) {
				if (top && F.name === roof.gableFace) { inner += '<polygon points="' + pts([[0, v.h], [F.len, v.h]].concat(top)) + '" fill="' + accentFill(sc, acc[1]) + '"/>'; }
				else if (F.name === 'right' && !roof.gableFace) { inner += '<rect x="0" y="0" width="' + f(F.len * 0.42) + '" height="' + f(v.h) + '" fill="' + accentFill(sc, acc[1]) + '"/>'; }
			}
			if (main && acc[2] && F.name === 'right') { inner += '<rect x="' + f(F.len * 0.42) + '" y="0" width="' + f(F.len * 0.58) + '" height="' + f(Math.min(v.h, pl.plinth + pl.FH)) + '" fill="' + accentFill(sc, acc[2]) + '"/>'; }
			if (main && st.woodGable && top && F.name === roof.gableFace) { inner += '<polygon points="' + pts([[0, v.h], [F.len, v.h]].concat(top)) + '" fill="' + sc.mat('wood', '#9C6B44') + '"/>'; }
			if (main && c.gable_finish === 'glass' && top && F.name === roof.gableFace) { inner += '<polygon points="' + pts([[0.35, v.h + 0.1], [F.len - 0.35, v.h + 0.1]].concat(top.map(function (q) { return [clamp(q[0], 0.35, F.len - 0.35), Math.max(v.h + 0.1, q[1] - 0.3)]; }))) + '" fill="' + glass(sc) + '" stroke="' + col(c.window_frame_color, '#2F3235') + '" stroke-width="0.06"/>'; }
			if (main && st.slats && F.name === 'front') { for (var sl = 0.15; sl < F.len * 0.3; sl += 0.24) { inner += '<rect x="' + f(F.len - 0.2 - sl) + '" y="' + f(pl.plinth) + '" width="0.12" height="' + f(v.h - pl.plinth - 0.1) + '" fill="' + st.slats + '"/>'; } }
			var pf = plinthFill(c);
			if (pf && !z0) { inner += '<rect x="0" y="0" width="' + f(F.len) + '" height="' + f(pl.plinth) + '" fill="' + (c.plinth === 'stone' ? sc.mat('stone', pf) : pf) + '"/>'; }
			if (st.cornice || c.facade_ornaments) {
				// cornice and floor band
				inner += '<rect x="0" y="' + f(v.h - 0.32) + '" width="' + f(F.len) + '" height="0.32" fill="' + shade(fcol, c.facade_ornaments && st.cornice ? 0.3 : 0.16) + '"/><rect x="0" y="' + f(v.h - 0.36) + '" width="' + f(F.len) + '" height="0.05" fill="' + shade(fcol, -0.12) + '"/>';
				inner += '<rect x="0" y="' + f(pl.plinth + Math.min(pl.FH, v.h - pl.plinth) - 0.12) + '" width="' + f(F.len) + '" height="0.14" fill="' + shade(fcol, 0.16) + '"/>';
			}
			if (c.corner_detail === 'glass' && F.name === 'front' && main) { inner += '<rect x="' + f(F.len - 0.9) + '" y="' + f(pl.plinth + 0.1) + '" width="0.9" height="' + f(v.h - pl.plinth - 0.5) + '" fill="' + glass(sc) + '"/>'; }
			if (st.fins && main && F.name === 'front') { for (var fi = 0; fi < 7; fi++) { inner += '<rect x="' + f(F.len * 0.62 + fi * F.len * 0.055) + '" y="' + f(pl.plinth) + '" width="0.1" height="' + f(v.h - pl.plinth) + '" fill="' + st.fins + '"/>'; } }
			if (main && F.name === 'right') { inner += wallTech(sc, F.len, pl); }
			if (c.corner_detail === 'quoins' || st.quoins) {
				for (var q = Math.max(pl.plinth, z0); q < v.h - 0.3; q += 0.5) {
					var qw = (Math.round(q * 2) % 2) ? 0.35 : 0.5;
					inner += '<rect x="' + f(F.len - qw) + '" y="' + f(q) + '" width="' + f(qw) + '" height="0.42" fill="' + (st.quoins && c.corner_detail !== 'quoins' ? '#9C927F' : shade(fcol, -0.1)) + '"/>';
				}
			}
			inner += openings(sc, v, pl, F, F.name === 'front' ? fp : null, roof);
			var r = sc.plane(F.o, F.du, dv, poly, wallFill(sc, v, F.name), inner);
			if (r) { out.push(r); }
		});
		return out;
	}
	function openings(sc, v, pl, F, fp, roof) {
		var c = sc.c, ws = windowSpec(c), s = '', len = F.len, shut = shutterColor(c);
		var styleBand = !!styleOf(c).band;
		var reserved = [], blocked = fp ? fp.block.map(function (b) { return [b[0] - 0.3, b[1] + 0.3]; }) : [];
		var doorW = 0, doorH = 0;
		var doorX = null, tdoorX = null, tdoorW = 0, entrance = !!(fp && fp.door);
		var BL = balconies(c, v, pl, sc.vols);
		if (fp && fp.door) { doorX = fp.door.x; doorW = fp.door.w; doorH = fp.door.h; reserved.push([doorX - 0.5, doorX + doorW + 0.5]); }
		if (fp && fp.tdoor) { tdoorX = fp.tdoor.x; tdoorW = fp.tdoor.w; reserved.push([tdoorX - 0.4, tdoorX + tdoorW + 0.4]); }
		for (var fl = 0; fl < pl.floors; fl++) {
			var z0 = pl.plinth + fl * pl.FH;
			if (z0 < (v.z0 || 0) - 0.05) { continue; }
			if (z0 + 1 > v.h) { break; }
			var w = ws.w, h = Math.min(ws.h, pl.FH - 0.6), sill = ws.sill;
			if (c.window_style === 'panoramic' && fl > 0) { w = 1.9; h = 1.7; sill = 0.6; }
			if (styleBand) { w = Math.min(len - 1.2, 4.4); h = 1.0; sill = 1.0; }
			var n = Math.max(1, Math.floor((len - 0.8) / (w + ws.gap)));
			if (F.name === 'right') { n = Math.max(1, Math.min(n, Math.floor((len - 1) / (w + 1.4)))); }
			var step = len / n, row = [];
			for (var i = 0; i < n; i++) {
				var x = step * i + (step - w) / 2;
				if (fl === 0 && reserved.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
				if (blocked.some(function (r) { return x < r[1] && x + w > r[0]; })) { continue; }
				row.push({ x: x, w: w, i: i });
			}
			// behind a balcony the windows become doors
			if (fl > 0 && BL.length) { balcMark(BL, F.name, fl, row); }
			for (var ri = 0; ri < row.length; ri++) {
				var o = row[ri];
				if (o.door) {
					s += windowSvg(sc, o.x, z0 + 0.02, o.w, Math.min(2.3, pl.FH - 0.45), {});
					if (o.french) {
						var fx0 = o.x - 0.08, fx1 = o.x + o.w + 0.08, bars = '';
						for (var fb = fx0 + 0.1; fb < fx1 - 0.05; fb += 0.11) { bars += 'M' + f(fb) + ' ' + f(z0 + 0.1) + 'V' + f(z0 + 1.0); }
						s += '<path d="M' + f(fx0) + ' ' + f(z0 + 1.0) + 'H' + f(fx1) + 'M' + f(fx0) + ' ' + f(z0 + 0.1) + 'H' + f(fx1) + bars + '" stroke="#2F3235" stroke-width="0.045" fill="none"/>';
					}
					continue;
				}
				s += windowSvg(sc, o.x, z0 + sill, w, h, { shutters: shut, blindsDown: (o.i + fl) % 3 === 1 });
				if (has(c.shading, 'louvres') && fl > 0) {
					for (var lv = 0; lv <= 4; lv++) { s += '<rect x="' + f(o.x - 0.1 + lv * (w + 0.2) / 4 - 0.03) + '" y="' + f(z0 + sill - 0.2) + '" width="0.06" height="' + f(h + 0.4) + '" fill="#9DA1A4"/>'; }
				}
			}
			if (c.exterior_lighting && fl === 0 && entrance) {
				var lc = sc.light.glow ? '#FFE2A0' : '#3A3D40';
				s += '<rect x="' + f(doorX - 0.35) + '" y="2.05" width="0.12" height="0.22" fill="' + lc + '"/>';
				if (sc.light.glow) { s += '<circle cx="' + f(doorX - 0.29) + '" cy="1.9" r="0.6" fill="#FFD27A" opacity="0.25"/>'; }
			}
		}
		if (doorX !== null) {
			if (styleOf(c).portal) { s += '<path d="M' + f(doorX - 0.5) + ' 0V' + f(doorH + 0.45) + 'H' + f(doorX + doorW + 0.5) + 'V0" fill="none" stroke="' + styleOf(c).portal + '" stroke-width="0.22"/>'; }
			s += doorSvg(sc, doorX, doorW, doorH);
			if (c.house_number) { s += '<rect x="' + f(doorX + doorW + 0.2) + '" y="1.7" width="0.3" height="0.22" fill="#2B2E31"/>'; }
		}
		if (tdoorX !== null) {
			var fc = col(c.window_frame_color, '#2F3235'), panes = c.terrace_door === 'folding' ? 4 : 2;
			s += '<rect x="' + f(tdoorX) + '" y="' + f(pl.plinth) + '" width="' + f(tdoorW) + '" height="2.35" fill="' + fc + '"/>' +
				'<rect x="' + f(tdoorX + 0.06) + '" y="' + f(pl.plinth + 0.06) + '" width="' + f(tdoorW - 0.12) + '" height="2.23" fill="' + glass(sc) + '"/>';
			for (var pn = 1; pn < panes; pn++) { s += '<rect x="' + f(tdoorX + tdoorW * pn / panes - 0.03) + '" y="' + f(pl.plinth) + '" width="0.06" height="2.35" fill="' + fc + '"/>'; }
			if (c.terrace_door === 'sliding' || c.terrace_door === 'lift_slide') { s += '<rect x="' + f(tdoorX) + '" y="' + f(pl.plinth + 2.35) + '" width="' + f(tdoorW) + '" height="0.12" fill="' + shade(fc, 0.2) + '"/>'; }
			if (c.terrace_door === 'lift_slide') { s += '<rect x="' + f(tdoorX + tdoorW / 2 - 0.16) + '" y="' + f(pl.plinth + 0.9) + '" width="0.05" height="0.5" fill="#C9CCCF"/>'; }
			if (c.terrace_door === 'french') { s += '<rect x="' + f(tdoorX) + '" y="' + f(pl.plinth + 1.5) + '" width="' + f(tdoorW) + '" height="0.05" fill="' + fc + '"/>'; }
		}
		// attic: gable window
		if (roof.gableFace === F.name && (pl.attic || roof.rise > 2.2)) {
			var gw = Math.min(1.6, len * 0.22);
			s += windowSvg(sc, len / 2 - gw / 2, v.h + 0.35, gw, Math.min(1.3, roof.rise - 0.9), {});
		}
		if (c.corner_window && F.name === 'front' && entrance) {
			s += windowSvg(sc, len - 1.6, pl.plinth + 0.5, 1.6, 1.8, {});
		}
		return s;
	}

	/* ------------------------------------------------------------------ roofs */
	function roofMaterial(sc) {
		var c = sc.c, base = col(c.roof_color, '#3A3D40');
		if (c.roof_type === 'flat') { return c.roof_surface === 'green' ? sc.mat('green', '#6E8F45') : sc.mat('gravel', '#A9A49B'); }
		if (c.roof_surface === 'green') { return sc.mat('green', '#6E8F45'); }
		if (c.roof_surface === 'gravel') { return sc.mat('shingle', base); }
		var p = String(c.roof_product || '');
		if (p) {
			// BRAMAC families: Római = profiled tile, Reviva / Tectura = flat tiles of two sizes, Tegalit = slate-like
			if (p.indexOf('tectura') !== -1) { return sc.mat('flattile', base); }
			if (p.indexOf('reviva') !== -1) { return sc.mat('flattile2', base); }
			if (p.indexOf('tegalit') !== -1) { return sc.mat('slate', base); }
			return sc.mat('roman', base);
		}
		return sc.mat(styleOf(c).seam ? 'seam' : 'tiles', base);
	}
	function roofSheen(sc) {
		var s = sc.c.roof_surface;
		if (s !== 'glazed' && s !== 'satin') { return ''; }
		var key = 'sheen' + s;
		sc.def(key, '<linearGradient id="' + sc.id + key + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="' + (s === 'glazed' ? 0.28 : 0.14) + '"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>');
		return 'url(#' + sc.id + key + ')';
	}
	// Builds roof planes for a volume from 3D points. Returns { planes, wallTop(face), rise, gableFace, flatTop }.
	function roofFor(sc, v, pl, type) {
		var c = sc.c, o = pl.eave, h = v.h, P = [], out = { planes: P, rise: 0, gableFace: null, under: '' };
		var X0 = v.x0, X1 = v.x1, Y0 = v.y0, Y1 = v.y1;
		var mat = roofMaterial(sc), sheen = roofSheen(sc), snow = c.season === 'winter';
		var gutter = { anthracite: '#3A3D40', black: '#1E1F21', white: '#F1F1EE', copper: '#B87333', hidden: null }[c.gutters || 'anthracite'];
		function extra(loc) {
			var s = '';
			if (sheen) { s += '<polygon points="' + pts(loc) + '" fill="' + sheen + '"/>'; }
			if (snow) { s += '<polygon points="' + pts(loc) + '" fill="#F4F7FA" opacity="0.8"/>'; }
			return s;
		}
		function addP(p3, eave) {
			var r = sc.poly3(p3, mat, '', { after: extra, screen: eave && gutter ? sc.line(p3[0], p3[1], gutter, 0.17) : '' });
			if (r) { P.push(r); }
			return r;
		}
		if (type === 'flat') {
			var pz = h + 0.35, fasc = shade(col(c.facade_color, '#F2EFE9'), c.arch_style === 'high_tech' ? -0.05 : 0.05);
			var rr = roundR(c, v);
			if (rr > 0) {
				var topR = sc.poly3(roundPts(v, rr, 0.1, 6).map(function (q) { return [q[0], q[1], pz]; }), mat, '', { noShade: true });
				if (topR) { P.push(topR); }
				roundStrips(sc, v, rr, 0.1, h - 0.05, pz, fasc).forEach(function (q) { P.push(q); });
				out.flatTop = pz;
				return out;
			}
			var top = sc.plane([X0 - 0.1, Y1 + 0.1, pz], [1, 0, 0], [0, -1, 0], [[0, 0], [X1 - X0 + 0.2, 0], [X1 - X0 + 0.2, Y1 - Y0 + 0.2], [0, Y1 - Y0 + 0.2]], fasc,
				'<rect x="0.3" y="0.3" width="' + f(X1 - X0 - 0.4) + '" height="' + f(Y1 - Y0 - 0.4) + '" fill="' + mat + '"/>' + (snow ? '<rect width="' + f(X1 - X0 + 0.2) + '" height="' + f(Y1 - Y0 + 0.2) + '" fill="#F4F7FA" opacity="0.85"/>' : ''), { noShade: true });
			if (top) { P.push(top); }
			var fr = sc.plane([X0 - 0.1, Y1 + 0.1, h - 0.05], [1, 0, 0], [0, 0, 1], [[0, 0], [X1 - X0 + 0.2, 0], [X1 - X0 + 0.2, 0.4], [0, 0.4]], fasc);
			var rr = sc.plane([X1 + 0.1, Y1 + 0.1, h - 0.05], [0, -1, 0], [0, 0, 1], [[0, 0], [Y1 - Y0 + 0.2, 0], [Y1 - Y0 + 0.2, 0.4], [0, 0.4]], fasc);
			if (fr) { P.push(fr); } if (rr) { P.push(rr); }
			out.flatTop = pz;
			return out;
		}
		if (type === 'saw') {
			// sawtooth (north-light) roof: shed teeth rising to the street side, glazed upstands
			var nT = Math.max(2, Math.round((Y1 - Y0) / 3)), tw = (Y1 - Y0) / nT, rz = tw * Math.tan(pl.pitch * D2R), gfill = sc.mock ? 'glass' : glass(sc);
			out.rise = rz; out.gableFace = 'right';
			for (var ti = 0; ti < nT; ti++) {
				var yb0 = Y0 + ti * tw, yb1 = yb0 + tw;
				addP([[X0 - 0.15, yb0, h], [X1 + 0.15, yb0, h], [X1 + 0.15, yb1, h + rz], [X0 - 0.15, yb1, h + rz]], ti === 0);
				var gq = sc.poly3([[X0, yb1, h], [X1, yb1, h], [X1, yb1, h + rz], [X0, yb1, h + rz]], gfill, '', { normal: [0, 1, 0], glass: true });
				if (gq) { P.push(gq); }
			}
			out.wallTop = function (face) {
				if (face !== 'right') { return null; }
				var pp = [[Y1 - Y0, h]];
				for (var k = 0; k < nT; k++) { var u = Y1 - (Y0 + (k + 1) * tw); pp.push([u, h + rz], [u, h]); }
				return pp;
			};
			out.frontZ = function () { return h; };
			out.tp = Math.tan(pl.pitch * D2R);
			return out;
		}
		var alongX = v.ridge !== 'y';
		var A0 = alongX ? X0 : Y0, A1 = alongX ? X1 : Y1, B0 = alongX ? Y0 : X0, B1 = alongX ? Y1 : X1;
		var W3 = function (a, b, z) { return alongX ? [a, b, z] : [b, a, z]; };
		var S = B1 - B0, L = A1 - A0, tp = Math.tan(pl.pitch * D2R), Bc = (B0 + B1) / 2, Ac = (A0 + A1) / 2;
		var rise = (type === 'shed' ? S : S / 2) * tp, eZ = h - o * tp, zR = h + rise;
		var og = type === 'hip' || type === 'pyramid' ? o : (c.gable_finish === 'flush' ? 0.05 : pl.over);
		var a0 = A0 - og, a1 = A1 + og, b0 = B0 - o, b1 = B1 + o;
		out.rise = rise;
		out.gableFace = alongX ? 'right' : 'front';
		var barge = { wood: '#8A5A36', metal: '#3E4245' }[c.gable_finish];
		if (type === 'shed') {
			var zB = zR + o * tp;
			addP([W3(a0, b1, eZ), W3(a1, b1, eZ), W3(a1, b0, zB), W3(a0, b0, zB)], true);
			if (barge) { P.push({ depth: 1e3, svg: sc.line(W3(a1, b1, eZ), W3(a1, b0, zB), barge, 0.2) }); }
			// right face (ridge along x): u = 0 at the front (low) … u = S at the back (high); front face (ridge along y): u = 0 is the high side.
			out.wallTop = function (face) { return face !== out.gableFace ? null : (alongX ? [[S, h + rise], [0, h]] : [[S, h], [0, h + rise]]); };
		} else if (type === 'hip' || type === 'pyramid') {
			out.gableFace = null;
			if (type === 'pyramid' || L <= S) {
				var apex = W3(Ac, Bc, h + Math.min(L, S) / 2 * tp);
				out.rise = Math.min(L, S) / 2 * tp;
				addP([W3(a0, b1, eZ), W3(a1, b1, eZ), apex], true);
				addP([W3(a1, b1, eZ), W3(a1, b0, eZ), apex], true);
				addP([W3(a1, b0, eZ), W3(a0, b0, eZ), apex], true);
				addP([W3(a0, b0, eZ), W3(a0, b1, eZ), apex], true);
			} else {
				var r0 = W3(A0 + S / 2, Bc, zR), r1 = W3(A1 - S / 2, Bc, zR);
				addP([W3(a0, b1, eZ), W3(a1, b1, eZ), r1, r0], true);
				addP([W3(a1, b0, eZ), W3(a0, b0, eZ), r0, r1], true);
				addP([W3(a1, b1, eZ), W3(a1, b0, eZ), r1], true);
				addP([W3(a0, b0, eZ), W3(a0, b1, eZ), r0], true);
			}
		} else {
			// gable / half-hip (also the parts of multi / complex roofs)
			var hh = type === 'half_hip' ? 0.42 : 0, bh = hh * S / 2, zH = h + rise * (1 - hh);
			if (!hh) {
				addP([W3(a0, b1, eZ), W3(a1, b1, eZ), W3(a1, Bc, zR), W3(a0, Bc, zR)], true);
				addP([W3(a1, b0, eZ), W3(a0, b0, eZ), W3(a0, Bc, zR), W3(a1, Bc, zR)], true);
				out.wallTop = function (face) { return face !== out.gableFace ? null : [[S, h], [S / 2, h + rise], [0, h]]; };
				if (barge) { P.push({ depth: 1e3, svg: sc.line(W3(a1, b1, eZ), W3(a1, Bc, zR), barge, 0.22) + sc.line(W3(a1, Bc, zR), W3(a1, b0, eZ), barge, 0.22) }); }
			} else {
				addP([W3(a0, b1, eZ), W3(a1, b1, eZ), W3(a1, Bc + bh, zH), W3(A1 - bh, Bc, zR), W3(A0 + bh, Bc, zR), W3(a0, Bc + bh, zH)], true);
				addP([W3(a1, b0, eZ), W3(a0, b0, eZ), W3(a0, Bc - bh, zH), W3(A0 + bh, Bc, zR), W3(A1 - bh, Bc, zR), W3(a1, Bc - bh, zH)], true);
				addP([W3(a1, Bc + bh, zH), W3(a1, Bc - bh, zH), W3(A1 - bh, Bc, zR)], false);
				addP([W3(a0, Bc - bh, zH), W3(a0, Bc + bh, zH), W3(A0 + bh, Bc, zR)], false);
				out.wallTop = function (face) { return face !== out.gableFace ? null : [[S, h], [S / 2 + bh, zH], [S / 2 - bh, zH], [0, h]]; };
			}
		}
		// exposed rafter tails under the front eave, snow guards above it, ridge vents
		if (c.exposed_rafters && o > 0.15) {
			for (var ra = A0 + 0.25; ra < A1; ra += 0.6) { out.under += sc.line(W3(ra, B1, h - 0.14), W3(ra, b1 - 0.04, eZ - 0.14), '#5A4030', 0.1); }
		}
		var guards = '';
		if (c.snow_guards && type !== 'shed') { guards += sc.line(W3(a0 + 0.7, b1 - 0.55, eZ + 0.55 * tp + 0.06), W3(a1 - 0.7, b1 - 0.55, eZ + 0.55 * tp + 0.06), '#C9CDD0', 0.07); }
		if (c.roof_ventilation && type !== 'shed' && type !== 'pyramid') {
			var vt = c.roof_vent_type || 'tile_vent', vc = '#3A3D40', vk = 'vent:' + vt;
			[Ac - L / 4, Ac + L / 4].forEach(function (a) {
				if (vt === 'ridge_vent') { return; }
				if (vt === 'turbine') { guards += sc.line(W3(a, Bc, zR), W3(a, Bc, zR + 0.5), '#B9BDC1', 0.2, vk) + sc.line(W3(a - 0.2, Bc, zR + 0.6), W3(a + 0.2, Bc, zR + 0.6), '#9DA1A4', 0.3, 'x'); }
				else if (vt === 'mushroom') { guards += sc.line(W3(a, Bc, zR), W3(a, Bc, zR + 0.16), vc, 0.12, vk) + sc.line(W3(a - 0.2, Bc, zR + 0.2), W3(a + 0.2, Bc, zR + 0.2), vc, 0.12, 'x'); }
				else if (vt === 'pipe') { guards += sc.line(W3(a, Bc, zR), W3(a, Bc, zR + 0.75), '#6A6E72', 0.1, vk) + sc.line(W3(a - 0.1, Bc, zR + 0.78), W3(a + 0.1, Bc, zR + 0.78), vc, 0.1, 'x'); }
				else if (vt === 'solar_fan') { guards += sc.line(W3(a, Bc, zR), W3(a, Bc, zR + 0.12), vc, 0.5, vk) + sc.line(W3(a - 0.25, Bc, zR + 0.16), W3(a + 0.25, Bc, zR + 0.16), '#1B2636', 0.4, 'x'); }
				else { guards += sc.line(W3(a, Bc, zR), W3(a, Bc, zR + 0.4), vc, 0.22, vk) + sc.line(W3(a - 0.16, Bc, zR + 0.42), W3(a + 0.16, Bc, zR + 0.42), vc, 0.12, 'x'); }
			});
			if (vt === 'ridge_vent') { guards += sc.line(W3(A0 + 0.4, Bc, zR + 0.05), W3(A1 - 0.4, Bc, zR + 0.05), '#2E3033', 0.12, vk); }
		}
		var rsp = ridgeSpec(c);
		if (rsp.r > 0 && type !== 'shed' && type !== 'pyramid') {
			var rha = type === 'hip' && L > S ? S / 2 : 0, rcol = rsp.metal ? '#8E9296' : (rsp.mortar ? '#8A857C' : shade(col(c.roof_color, '#3A3D40'), rsp.shift));
			guards += sc.line(W3(A0 + rha, Bc, zR + 0.04), W3(A1 - rha, Bc, zR + 0.04), rcol, rsp.r * 1.7, 'x');
		}
		if (guards) { P.push({ depth: 1e3, svg: guards }); }
		out.frontZ = function (y) { return h + (Y1 - y) * tp; };
		out.tp = tp;
		return out;
	}

	// Appearance of the roof extras (shared with the 3D preview).
	function solarSpec(c) {
		var t = c.solar_type || 'black_mono';
		return ({
			black_mono: { t: t, cell: '#10141A', line: '#262C36', frame: '#14171B' },
			blue_poly: { t: t, cell: '#1B2636', line: '#566A84', frame: '#B9BDC1' },
			in_roof: { t: t, cell: '#151A21', line: '#2A3039', frame: null, flush: true },
			solar_tile: { t: t, cell: '#1A212B', line: '#39414D', frame: null, flush: true, tiles: true },
			glass: { t: t, cell: '#0C1016', line: '#222833', frame: null }
		})[t] || { t: 'black_mono', cell: '#10141A', line: '#262C36', frame: '#14171B' };
	}
	function chimneySpec(c) {
		var t = c.chimney_type || 'auto';
		if (t === 'auto') { t = c.arch_style === 'classic_burgher' || c.arch_style === 'rustic' || c.facade_main === 'brick' ? 'brick' : 'render'; }
		return ({
			brick: { t: t, w: 0.75, d: 0.75, color: '#9A4E35', mat: 'brick', cap: '#2E3033', up: 1.0 },
			render: { t: t, w: 0.75, d: 0.75, color: '#4A4D50', cap: '#2E3033', up: 1.0 },
			stone: { t: t, w: 0.85, d: 0.8, color: '#8D8579', mat: 'stone', cap: '#55524D', up: 0.9 },
			steel: { t: t, w: 0.32, d: 0.32, color: '#B9BDC1', cap: '#8E9296', up: 1.7, metal: true },
			clad: { t: t, w: 0.7, d: 0.7, color: '#2F3236', cap: '#1E2023', up: 1.0, metal: true },
			wide: { t: t, w: 1.35, d: 0.75, color: '#C9C1B4', cap: '#2E3033', up: 0.9, twin: true }
		})[t];
	}
	// Ridge / hip cap: radius, cross-section segments and colour shift.
	function ridgeSpec(c) {
		return ({ round: { r: 0.11, seg: 8, shift: -0.15 }, angular: { r: 0.12, seg: 4, shift: -0.12 }, mortar: { r: 0.13, seg: 8, shift: 0.1, mortar: true },
			dry: { r: 0.08, seg: 4, shift: -0.2, vented: true }, metal: { r: 0.05, seg: 6, shift: 0, metal: true }, none: { r: 0 } })[c.ridge_tile || 'round'] || { r: 0.11, seg: 8, shift: -0.15 };
	}
	// Layout of the front roof plane (ridge along x): dormers, the solar field and roof windows never overlap.
	// u = distance from the volume's left edge, s = distance up the slope from the eave.
	function roofLayout(c, v, pl, slopeL, hipIn, solar) {
		var W = v.x1 - v.x0, a = hipIn + 0.5, b = W - hipIn - 0.5, nd = Math.round(clamp(num(c.dormers, 0), 0, 4)), free = [[a, b]], out = { dorm: [], solar: null, wins: [], winS: 0 };
		for (var d = 0; d < nd; d++) {
			var cx = hipIn + (W - 2 * hipIn) * (d + 0.5) / nd;
			out.dorm.push(cx - 0.9);
			free = free.reduce(function (acc, fi) {
				var b0 = cx - 1.4, b1 = cx + 1.4;
				if (b1 <= fi[0] || b0 >= fi[1]) { acc.push(fi); return acc; }
				if (b0 - fi[0] > 0.3) { acc.push([fi[0], b0]); }
				if (fi[1] - b1 > 0.3) { acc.push([b1, fi[1]]); }
				return acc;
			}, []);
		}
		free = free.filter(function (fi) { return fi[1] - fi[0] >= 0.9; });
		if (solar && free.length) {
			var bi = 0; free.forEach(function (fi, i) { if (fi[1] - fi[0] > free[bi][1] - free[bi][0]) { bi = i; } });
			var big = free[bi], len = big[1] - big[0], cov = c.solar_coverage || 'medium';
			var cols = Math.min(Math.floor(len / 1.12), Math.max(2, Math.floor(len * (cov === 'small' ? 0.4 : (cov === 'full' ? 1 : 0.7)) / 1.12)));
			var rowsMax = Math.max(1, Math.min(3, Math.floor((slopeL - 0.8) / 1.8))), rows = cov === 'small' ? 1 : (cov === 'full' ? rowsMax : Math.min(2, rowsMax));
			if (cols >= 1) {
				var x0 = (big[0] + big[1]) / 2 - cols * 1.12 / 2;
				out.solar = { u0: x0, cols: cols, rows: rows, pw: cols * 1.12, s0: 0.6 };
				free.splice(bi, 1);
				if (x0 - 0.2 - big[0] >= 0.9) { free.push([big[0], x0 - 0.2]); }
				if (big[1] - (x0 + cols * 1.12 + 0.2) >= 0.9) { free.push([x0 + cols * 1.12 + 0.2, big[1]]); }
			}
		}
		var want = Math.round(clamp(num(c.roof_windows, 0) + (pl.attic && !num(c.roof_windows, 0) && !nd ? 2 : 0), 0, 6)), slots = [];
		free.sort(function (p, q) { return p[0] - q[0]; }).forEach(function (fi) {
			var n = Math.floor((fi[1] - fi[0]) / 1.3);
			for (var i = 0; i < n; i++) { slots.push(fi[0] + (fi[1] - fi[0]) * (i + 0.5) / n - 0.39); }
		});
		var take = Math.min(want, slots.length);
		for (var k = 0; k < take; k++) { out.wins.push(slots[take === 1 ? Math.floor((slots.length - 1) / 2) : Math.round(k * (slots.length - 1) / (take - 1))]); }
		out.winS = clamp(slopeL * 0.45 - 0.6, 0.8, Math.max(0.8, slopeL - 1.8));
		return out;
	}
	/* ------------------------------------------------------------------ balconies */
	// Railing style: glass / metal / wood / solid parapet, or 'french' (a railing in front of a door, no slab).
	function balconyType(c) {
		var t = c.balcony_type || 'auto';
		if (t === 'auto') { t = c.arch_style === 'alpine' || c.arch_style === 'rustic' || c.arch_style === 'american_farm' ? 'wood' : (c.arch_style === 'classic_burgher' || c.arch_style === 'mediterranean' || c.arch_style === 'industrial' ? 'metal' : 'glass'); }
		return t;
	}
	// Balconies of a volume on its upper floors, in the wall frames shared with the 3D view
	// (front: u from the left corner, right: from the front corner, back: from the right corner, left: from the back corner):
	// [{ face, u0, u1, d, z, fl, type, endA, endB }]. A french balcony spans the whole face (its windows become doors).
	function balconies(c, v, pl, vols) {
		var out = [];
		if (!v.main || !c.balcony || pl.floors < 2 || (vols || []).some(function (q) { return q.balc; }) || roundR(c, v) > 0) { return out; }
		var t = balconyType(c), size = c.balcony_size || 'medium', place = c.balcony_place || 'front';
		var d = t === 'french' ? 0.14 : ({ small: 1.2, medium: 1.5, large: 1.8 }[size] || 1.5);
		var W = v.x1 - v.x0, D = v.y1 - v.y0;
		var faces = place === 'both' ? ['front', 'back'] : (place === 'wrap' ? ['front', 'right'] : (place === 'side' ? ['right'] : [place === 'back' ? 'back' : 'front']));
		for (var fl = 1; fl < pl.floors; fl++) {
			var z = pl.plinth + fl * pl.FH;
			if (z < (v.z0 || 0) - 0.05 || z + 1.2 > v.h) { continue; }
			faces.forEach(function (F) {
				var len = F === 'front' || F === 'back' ? W : D, a;
				if (t === 'french') { a = [0, len]; }
				else if (place === 'wrap') { a = F === 'front' ? [size === 'large' ? 0.5 : (size === 'small' ? len - 2.6 : len * 0.5), len] : [-d, Math.min(len - 0.5, size === 'large' ? len : (size === 'small' ? 2.2 : 3.6))]; }
				else if (size === 'large') { a = [0.5, len - 0.5]; }
				else if (size === 'small') { a = [clamp(len * 0.7 - 1.2, 0.4, Math.max(0.4, len - 2.8)), 0]; a[1] = Math.min(len - 0.4, a[0] + 2.4); }
				else { a = [len * 0.5, Math.min(len - 0.5, len * 0.5 + 4.5)]; }
				if (a[1] - a[0] < 1) { return; }
				out.push({ face: F, u0: a[0], u1: a[1], d: d, z: z, fl: fl, type: t, endA: true, endB: !(place === 'wrap' && F === 'front' && t !== 'french') });
			});
		}
		return out;
	}
	// Windows of one floor of a face ([{ x, w }]) behind a balcony become doors: those mostly over the slab,
	// or the one that overlaps it most; with no window over it, a door is added in its middle.
	function balcMark(BL, face, fl, wins) {
		BL.forEach(function (b) {
			if (b.face !== face || b.fl !== fl) { return; }
			var a = Math.max(0, b.u0), e = b.u1, hit = 0, best = null, bo = 0;
			wins.forEach(function (o) {
				var ov = Math.min(o.x + o.w, e) - Math.max(o.x, a);
				if (b.type === 'french' || ov >= o.w * 0.6) { o.door = true; o.french = b.type === 'french'; hit++; }
				else if (ov > bo) { bo = ov; best = o; }
			});
			if (!hit && best && bo >= best.w * 0.3) { best.door = true; hit++; }
			if (!hit && b.type !== 'french') { wins.push({ x: (a + e) / 2 - 0.5, w: 1.0, door: true, add: true }); }
		});
		return wins;
	}

	// Plan rectangle of a balcony slab.
	function balcRect(v, b) {
		if (b.face === 'front') { return { x0: v.x0 + b.u0, x1: v.x0 + b.u1, y0: v.y1, y1: v.y1 + b.d }; }
		if (b.face === 'back') { return { x0: v.x1 - b.u1, x1: v.x1 - b.u0, y0: v.y0 - b.d, y1: v.y0 }; }
		if (b.face === 'right') { return { x0: v.x1, x1: v.x1 + b.d, y0: v.y1 - b.u1, y1: v.y1 - b.u0 }; }
		return { x0: v.x0 - b.d, x1: v.x0, y0: v.y0 + b.u0, y1: v.y0 + b.u1 };
	}

	/* ------------------------------------------------------------------ vehicles, people, pets */
	// Footprint (width, length) of the vehicles; cars are driven in forwards (nose towards the house).
	var VEH = { sedan: [1.85, 4.7], hatchback: [1.8, 4.1], suv: [1.95, 4.75], pickup: [1.95, 5.4], van: [2.0, 5.1], sports: [1.95, 4.6], electric: [1.9, 4.75], motorcycle: [0.8, 2.15], bicycle: [0.6, 1.75] };
	function vehicleList(c) { return (c.vehicles === undefined || c.vehicles === null ? ['sedan'] : (Array.isArray(c.vehicles) ? c.vehicles : [])).filter(function (k) { return !!VEH[k]; }); }
	var TREE_SIZE = { deciduous: 1, birch: 1.1, maple: 0.5, fruit: 0.75, olive: 0.7, palm: 0.85, conifer: 1, cypress: 0.75, multistem: 0.8 };
	function rowKindOf(gs) { return { formal: 'topiary', mediterranean: 'lavender', cottage: 'shrub', minimal: 'grass', natural: 'shrub' }[gs] || 'shrub'; }
	var PEOPLE = { couple: [['man', 'stand'], ['woman', 'stand']], family: [['man', 'stand'], ['woman', 'walk'], ['child', 'walk'], ['child', 'stand']], guests: [['man', 'stand'], ['woman', 'stand'], ['man', 'walk'], ['woman', 'stand'], ['woman', 'walk']] };

	/* ------------------------------------------------------------------ household items per room */
	// The rooms of the design (ids as in the designer); without a room programme the three rooms shown first.
	function roomsOf(c) {
		var out = [], seen = {};
		(Array.isArray(c.rooms) ? c.rooms : []).forEach(function (r) { if (r && r.type) { var id = String(r.id || r.type); if (!seen[id]) { seen[id] = 1; out.push({ id: id, type: r.type }); } } });
		if (!out.length) { ['living_kitchen', 'master', 'bathroom'].forEach(function (tp) { out.push({ id: 'virtual:' + tp, type: tp }); }); }
		return out;
	}
	function mainRoom(rooms) { return rooms.filter(function (r) { return r.type === 'living' || r.type === 'living_kitchen'; })[0] || rooms[0] || null; }
	// Where each household item goes when the visitor has not placed it: one fitting room.
	var ITEM_HOME = { bookshelf: ['living', 'living_kitchen', 'office', 'kids'], sideboard: ['dining', 'living', 'living_kitchen'], desk: ['office', 'kids', 'bedroom', 'guest', 'master'], reading: ['living', 'living_kitchen', 'master', 'bedroom'],
		piano: ['living', 'living_kitchen', 'dining'], bar_cart: ['living', 'living_kitchen', 'dining'], bench: ['hall', 'master', 'bedroom'], plant_stand: ['living', 'living_kitchen', 'dining', 'hall'], floor_mirror: ['master', 'bedroom', 'hall', 'wardrobe'],
		chest: ['master', 'bedroom', 'guest', 'kids', 'hall'], vitrine: ['dining', 'living', 'living_kitchen'], pouf: ['living', 'living_kitchen', 'master', 'bedroom'],
		tv: ['living', 'living_kitchen'], soundbar: ['living', 'living_kitchen'], speakers: ['living', 'living_kitchen'], console: ['living', 'living_kitchen'], projector: ['living', 'living_kitchen'], robot_vacuum: ['living', 'living_kitchen'], smart_speaker: ['living', 'living_kitchen', 'kitchen'],
		computer: ['office', 'kids', 'bedroom', 'guest', 'master'], laptop: ['office', 'living', 'living_kitchen', 'master'], smart_panel: ['hall', 'living', 'living_kitchen'], dog_large: ['living', 'living_kitchen'], dog_small: ['living', 'living_kitchen'], cat: ['living', 'living_kitchen'] };
	// Household items per room id: the visitor's own placement (room_items), else one fitting room per selected item.
	function roomItems(c, rooms) {
		var out = {}, done = {}, all = [].concat(c.extra_furniture || [], c.electronics || [], c.pets || []), ex = c.room_items;
		var put = function (id, k) { if ((out[id] = out[id] || []).indexOf(k) === -1) { out[id].push(k); } done[k] = 1; };
		// the visitor's own placement (an item may stand in several rooms); rooms that are gone are ignored
		if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
			Object.keys(ex).forEach(function (id) {
				if (!Array.isArray(ex[id]) || !rooms.some(function (q) { return q.id === id; })) { return; }
				ex[id].forEach(function (k) { if (all.indexOf(k) !== -1) { put(id, k); } });
			});
		}
		// whatever is not placed yet goes to one fitting room
		all.forEach(function (k) {
			if (done[k]) { return; }
			var pref = ITEM_HOME[k] || ['living', 'living_kitchen'], r = null;
			for (var i = 0; i < pref.length && !r; i++) { r = rooms.filter(function (q) { return q.type === pref[i]; })[0] || null; }
			r = r || mainRoom(rooms);
			if (r) { put(r.id, k); }
		});
		return out;
	}

	// Which roof planes carry the solar panels: 'front' / 'back' / 'both' long planes, or 'all' planes (hip ends
	// and the other roofs too). 'auto': the garden side, unless that faces north.
	function solarPlace(c) { var p = c.solar_place || 'auto'; return p === 'auto' ? (c.orientation === 'north' ? 'back' : 'front') : p; }
	// Solar modules (1.1 × 1.73 m, in rows) laid out on the roof planes of a volume. Each plane keeps
	// margins to the eave, the ridge, the verges and the hips, so no module hangs over an edge, and the
	// modules stay clear of the chimney, the dormers, the roof windows and the other volumes.
	// Pitched plane: { o, ux, uy, n, panels: [[u, s]] } – o on the wall line at eave height, u along the
	// eave, s up the slope. Flat roof: { flat: true, panels: [[x, y]] } – back left corner of a module
	// (1.7 m wide, 0.94 m deep in plan, tilted up towards the back).
	function solarFaces(c, v, pl, type, vols) {
		var out = [], place = solarPlace(c), cov = c.solar_coverage || 'medium';
		if (type === 'saw' || v.glass || v.terraceRoof || roundR(c, v) > 0) { return out; }
		if (!v.items && (place !== 'all' || v.x1 - v.x0 < 3 || v.y1 - v.y0 < 3)) { return out; }
		var W = v.x1 - v.x0, D = v.y1 - v.y0, excl = [];
		(vols || []).forEach(function (q) { if (q !== v) { excl.push([q.x0 - 0.6, q.y0 - 0.6, q.x1 + 0.6, q.y1 + 0.6]); } });
		if (v.items && c.chimney) { var cs = chimneySpec(c), chx = v.x0 + W * 0.7, chy = (v.y0 + v.y1) / 2 + 0.3; excl.push([chx - 0.3, chy - 0.3, chx + cs.w + 0.3, chy + cs.d + 0.3]); }
		function clear(xs, ys) {
			var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
			return !excl.some(function (r) { return x0 < r[2] - 1e-6 && x1 > r[0] + 1e-6 && y0 < r[3] - 1e-6 && y1 > r[1] + 1e-6; });
		}
		// the central `want` of n columns (same parity, so the field stays centred)
		function keep(n, want) { var k = Math.min(n, want); if ((n - k) % 2) { k = Math.min(n, k + 1); } return [(n - k) / 2, (n - k) / 2 + k]; }
		function cols(n) { return cov === 'full' ? n : Math.max(2, Math.ceil(n * (cov === 'small' ? 0.45 : 0.75))); }
		var pan = [], r, k;
		if (type === 'flat') {
			var nx = Math.floor((W - 1.6 + 0.1) / 1.8), ny = Math.floor((D - 1.6 - 0.94) / 2.0) + 1;
			if (nx < 1 || ny < 1) { return out; }
			var kc = keep(nx, cols(nx)), kr = cov === 'small' ? 1 : (cov === 'full' ? ny : Math.max(1, Math.ceil(ny * 0.6)));
			var bx = v.x0 + (W - (nx * 1.8 - 0.1)) / 2, by = v.y0 + (D - ((kr - 1) * 2.0 + 0.94)) / 2;
			for (r = 0; r < kr; r++) { for (k = kc[0]; k < kc[1]; k++) { var px = bx + k * 1.8, py = by + r * 2.0; if (clear([px, px + 1.7], [py, py + 0.94])) { pan.push([px, py]); } } }
			if (pan.length) { out.push({ flat: true, panels: pan }); }
			return out;
		}
		var alongX = v.ridge !== 'y';
		var A0 = alongX ? v.x0 : v.y0, A1 = alongX ? v.x1 : v.y1, B0 = alongX ? v.y0 : v.x0, B1 = alongX ? v.y1 : v.x1;
		var Lr = A1 - A0, S = B1 - B0, tp = Math.tan(pl.pitch * D2R);
		var pyr = type === 'pyramid' || (type === 'hip' && Lr <= S), hip = type === 'hip' && !pyr, shed = type === 'shed';
		var rise = shed ? S * tp : (pyr ? Math.min(Lr, S) / 2 * tp : S / 2 * tp), bh = type === 'half_hip' ? 0.21 * S : 0;
		function xy(a, b) { return alongX ? [a, b] : [b, a]; }
		// inset of a plane's sides at plan depth p from its eave (hips and the half-hip corners)
		var longIns = hip ? function (p) { return p; } : (pyr ? function (p) { return p * Lr / S; } : (bh ? function (p) { return Math.max(0, p - (S / 2 - bh)); } : function () { return 0; }));
		var endIns = pyr ? function (p) { return p * S / Lr; } : function (p) { return p; };
		var F = [{ id: 'b1', e0: [A0, B1], d: [1, 0], n: [0, -1], E: Lr, P: shed ? S : S / 2, ins: longIns }];
		if (!shed) { F.push({ id: 'b0', e0: [A1, B0], d: [-1, 0], n: [0, 1], E: Lr, P: S / 2, ins: longIns }); }
		if (hip || pyr) {
			F.push({ id: 'a1', e0: [A1, B1], d: [0, -1], n: [-1, 0], E: S, P: pyr ? Lr / 2 : S / 2, ins: endIns });
			F.push({ id: 'a0', e0: [A0, B0], d: [0, 1], n: [1, 0], E: S, P: pyr ? Lr / 2 : S / 2, ins: endIns });
		}
		// ridge along y: the long planes face right / left, a hip end faces the front
		var want = place === 'all' || !v.items ? null : (place === 'both' ? ['b1', 'b0'] : (place === 'back' && !shed ? ['b0', alongX ? '' : 'a0'] : ['b1', alongX ? '' : 'a1']));
		var lay = v.items && alongX ? roofLayout(c, v, pl, (shed ? D : D / 2) / Math.cos(pl.pitch * D2R), type === 'hip' || type === 'pyramid' ? D / 2 : 0, false) : null;
		F.forEach(function (fc) {
			if (want && want.indexOf(fc.id) === -1) { return; }
			var Lf = Math.sqrt(fc.P * fc.P + rise * rise), cosA = fc.P / Lf, sinA = rise / Lf;
			var nR = Math.floor((Lf - 0.45 - 0.35 + 0.02) / 1.75);
			if (nR < 1) { return; }
			var useR = cov === 'small' ? 1 : (cov === 'full' ? nR : Math.max(1, Math.ceil(nR * 0.6)));
			var s0 = hip || pyr || useR >= nR ? 0.45 : 0.45 + (Lf - 0.8 - useR * 1.75) / 2;
			function span(s) { var i = fc.ins(Math.min(fc.P, s * cosA)); return [i + 0.3, fc.E - i - 0.3]; }
			var r0 = span(s0 + 1.73), n0 = Math.floor((r0[1] - r0[0] + 0.02) / 1.12);
			if (n0 < 1) { return; }
			function ok(kk, s) {
				var u = fc.E / 2 + (kk - (n0 - 1) / 2) * 1.12 - 0.55, rg = span(s + 1.73);
				if (u < rg[0] - 1e-6 || u + 1.1 > rg[1] + 1e-6) { return null; }
				if (lay && fc.id === 'b1' && (lay.dorm.some(function (dx) { return u < dx + 2.3 && u + 1.1 > dx - 0.5; }) ||
					lay.wins.some(function (wx) { return u < wx + 1.03 && u + 1.1 > wx - 0.25 && s < lay.winS + 1.5 && s + 1.73 > lay.winS - 0.3; }))) { return null; }
				var xs = [], ys = [];
				[[u, s], [u + 1.1, s], [u + 1.1, s + 1.73], [u, s + 1.73]].forEach(function (q) { var p2 = xy(fc.e0[0] + fc.d[0] * q[0] + fc.n[0] * q[1] * cosA, fc.e0[1] + fc.d[1] * q[0] + fc.n[1] * q[1] * cosA); xs.push(p2[0]); ys.push(p2[1]); });
				return clear(xs, ys) ? u : null;
			}
			// columns: all of them for a full field, else the longest free run of the first row, trimmed to size
			var c0 = 0, c1 = n0;
			if (cov !== 'full') {
				var best = null, run = null;
				for (var kq = 0; kq <= n0; kq++) {
					if (kq < n0 && ok(kq, s0) !== null) { run = run || [kq, kq]; run[1] = kq + 1; continue; }
					if (run && (!best || run[1] - run[0] > best[1] - best[0] || (run[1] - run[0] === best[1] - best[0] && Math.abs(run[0] + run[1] - n0) < Math.abs(best[0] + best[1] - n0)))) { best = run; }
					run = null;
				}
				if (!best) { return; }
				var kc2 = keep(best[1] - best[0], cols(n0));
				c0 = best[0] + kc2[0]; c1 = best[0] + kc2[1];
			}
			var list = [];
			for (var rr = 0; rr < useR; rr++) {
				var s = s0 + rr * 1.75;
				for (var kk = c0; kk < c1; kk++) { var u = ok(kk, s); if (u !== null) { list.push([u, s]); } }
			}
			if (!list.length) { return; }
			var o2 = xy(fc.e0[0], fc.e0[1]), ux = xy(fc.d[0], fc.d[1]), nn = xy(fc.n[0], fc.n[1]);
			out.push({ id: fc.id, o: [o2[0], o2[1], v.h], ux: [ux[0], ux[1], 0], uy: [nn[0] * cosA, nn[1] * cosA, sinA], n: [-nn[0] * sinA, -nn[1] * sinA, cosA], panels: list, pw: 1.1, ph: 1.73 });
		});
		return out;
	}
	// One module's drawing (local: 1.1 × 1.73 m, or 1.7 × 1.1 m on a flat roof).
	function panelSvg(ss, w, h) {
		var s = '';
		if (ss.tiles) { for (var t = 0.35; t < h - 0.01; t += 0.35) { s += '<path d="M0 ' + f(t) + 'H' + f(w) + '" stroke="' + ss.line + '" stroke-width="0.02"/>'; } }
		else { s += '<path d="M0 ' + f(h / 3) + 'H' + f(w) + 'M0 ' + f(h * 2 / 3) + 'H' + f(w) + 'M' + f(w / 2) + ' 0V' + f(h) + '" stroke="' + ss.line + '" stroke-width="0.025"/>'; }
		if (ss.frame) { s += '<rect width="' + f(w) + '" height="' + f(h) + '" fill="none" stroke="' + ss.frame + '" stroke-width="0.05"/>'; }
		return s + '<polygon points="0,0 ' + f(w * 0.45) + ',0 0,' + f(h * 0.5) + '" fill="#FFFFFF" opacity="0.06"/>';
	}
	// Roof-mounted items: solar panels, roof windows, dormers (front plane of a ridge-along-x roof), chimney.
	function roofItems(sc, v, pl, roof, type) {
		var c = sc.c, items = [];
		if (type === 'saw') { return items; }
		var solar = c.roof_solar || has(c.energy, 'solar') || !!styleOf(c).pv;
		var W = v.x1 - v.x0, D = v.y1 - v.y0;
		function chimneyBox(zBase) {
			var cs = chimneySpec(c), cx = v.x0 + W * 0.7, cy = (v.y0 + v.y1) / 2 + 0.3, cw = cs.w, cd = cs.d, zt = (roof.flatTop || v.h + roof.rise) + cs.up;
			var zf = zBase(cy + cd), zr0 = zBase(cy + cd), zr1 = zBase(cy);
			var cfill = cs.mat ? sc.mat(cs.mat, cs.color) : cs.color;
			var fr = sc.plane([cx, cy + cd, 0], [1, 0, 0], [0, 0, 1], [[0, zf], [cw, zf], [cw, zt], [0, zt]], cfill, cs.twin ? '<path d="M' + f(cw / 2) + ' ' + f(zf) + 'V' + f(zt) + '" stroke="#2E3033" stroke-width="0.05"/>' : '');
			var rs = sc.plane([cx + cw, cy + cd, 0], [0, -1, 0], [0, 0, 1], [[0, zr0], [cd, zr1], [cd, zt], [0, zt]], cfill);
			var tpz = sc.plane([cx - 0.06, cy + cd + 0.06, zt], [1, 0, 0], [0, -1, 0], [[0, 0], [cw + 0.12, 0], [cw + 0.12, cd + 0.12], [0, cd + 0.12]], cs.cap, '', { noShade: true });
			[fr, rs, tpz].forEach(function (r) { if (r) { r.depth += 50; items.push(r); } });
		}
		// solar modules on every plane that faces the camera
		function solarDraw() {
			if (!solar) { return; }
			var ss = solarSpec(c);
			solarFaces(c, v, pl, type, sc.vols).forEach(function (F) {
				F.panels.forEach(function (q) {
					var r = F.flat ? sc.plane([q[0], q[1] + 0.94, roof.flatTop + (ss.flush ? 0.02 : 0.15)], [1, 0, 0], norm([0, -0.85, 0.5]), [[0, 0], [1.7, 0], [1.7, 1.1], [0, 1.1]], ss.cell, panelSvg(ss, 1.7, 1.1))
						: sc.plane(add(add(add(F.o, mul(F.ux, q[0])), mul(F.uy, q[1])), mul(F.n, ss.flush ? 0.04 : 0.1)), F.ux, F.uy, [[0, 0], [F.pw, 0], [F.pw, F.ph], [0, F.ph]], ss.cell, panelSvg(ss, F.pw, F.ph), { noShade: true, sw: 0.4 });
					if (r) { r.depth += 40; items.push(r); }
				});
			});
		}
		if (!v.items) { solarDraw(); return items; }
		if (roof.flatTop) {
			solarDraw();
			if (c.chimney) { chimneyBox(function () { return roof.flatTop; }); }
			return items;
		}
		if (v.ridge === 'y') {
			solarDraw();
			if (c.chimney) { chimneyBox(function () { return v.h; }); }
			return items;
		}
		var tp = roof.tp, cosP = Math.cos(pl.pitch * D2R), sinP = Math.sin(pl.pitch * D2R);
		var up = [0, -cosP, sinP];
		var slopeL = (type === 'shed' ? D : D / 2) / cosP;
		function onRoof(u, s, w, hh, fill, inner) {
			var o3 = add(add([v.x0 + u, v.y1, v.h], mul(up, s)), [0, 0.05 * sinP, 0.05 * cosP]);
			var r = sc.plane(o3, [1, 0, 0], up, [[0, 0], [w, 0], [w, hh], [0, hh]], fill, inner || '', { noShade: true });
			if (r) { r.depth += 40; items.push(r); }
		}
		var hipIn = type === 'hip' || type === 'pyramid' ? D / 2 : 0;
		var lay = roofLayout(c, v, pl, slopeL, hipIn, false);
		solarDraw();
		lay.wins.forEach(function (ux) { onRoof(ux, lay.winS, 0.78, 1.2, '#2A2D30', '<rect x="0.07" y="0.07" width="0.64" height="1.06" fill="' + glass(sc) + '"/>'); });
		var nd = lay.dorm.length;
		for (var dd = 0; dd < nd; dd++) {
			var dw = 1.8, dx = v.x0 + lay.dorm[dd], yd = v.y1 - 1.0, z0 = roof.frontZ(yd), hw = 1.35, yb = yd - hw / tp;
			var wall = col(c.facade_color, '#F2EFE9'), mat = roofMaterial(sc), parts = [];
			[sc.plane([dx, yd, z0], [1, 0, 0], [0, 0, 1], [[0, 0], [dw, 0], [dw, hw], [dw / 2, hw + 0.75], [0, hw]], wall, windowSvg(sc, 0.42, 0.18, 0.96, 1.0, {})),
				sc.poly3([[dx + dw, yd, z0], [dx + dw, yb, z0 + hw], [dx + dw, yd, z0 + hw]], wall, '', { normal: [1, 0, 0] }),
				sc.poly3([[dx + dw + 0.12, yd + 0.15, z0 + hw - 0.05], [dx + dw / 2, yd + 0.15, z0 + hw + 0.78], [dx + dw / 2, yb, z0 + hw + 0.78], [dx + dw + 0.12, yb, z0 + hw - 0.05]], mat),
				sc.poly3([[dx - 0.12, yd + 0.15, z0 + hw - 0.05], [dx + dw / 2, yd + 0.15, z0 + hw + 0.78], [dx + dw / 2, yb, z0 + hw + 0.78], [dx - 0.12, yb, z0 + hw - 0.05]], mat)
			].forEach(function (r) { if (r) { parts.push(r.svg); } });
			items.push({ depth: sc.depth([dx, yd, z0]) + 45 + dd * 0.01, svg: parts.join('') });
		}
		if (c.chimney) { chimneyBox(type === 'shed' || type === 'gable' || type === 'half_hip' || type === 'hip' ? function (y) { return roof.frontZ(Math.max(y, (v.y0 + v.y1) / 2)); } : function () { return v.h; }); }
		return items;
	}

	/* ------------------------------------------------------------------ boxes (garage, terrace, balcony) */
	function box(sc, x0, y0, z0, x1, y1, z1, fills, inner) {
		var out = [];
		var tp = sc.plane([x0, y1, z1], [1, 0, 0], [0, -1, 0], [[0, 0], [x1 - x0, 0], [x1 - x0, y1 - y0], [0, y1 - y0]], fills.top, (inner && inner.top) || '', { noShade: true });
		var fr = sc.plane([x0, y1, z0], [1, 0, 0], [0, 0, 1], [[0, 0], [x1 - x0, 0], [x1 - x0, z1 - z0], [0, z1 - z0]], fills.front, (inner && inner.front) || '');
		var rt = sc.plane([x1, y1, z0], [0, -1, 0], [0, 0, 1], [[0, 0], [y1 - y0, 0], [y1 - y0, z1 - z0], [0, z1 - z0]], fills.side || fills.front, (inner && inner.side) || '');
		[fr, rt, tp].forEach(function (r) { if (r) { out.push(r); } });
		return out;
	}
	function group(list, bias) {
		if (!list.length) { return null; }
		var d = list.reduce(function (a, r) { return a + r.depth; }, 0) / list.length;
		return { depth: d + (bias || 0), svg: list.map(function (r) { return r.svg; }).join('') };
	}

	/* ------------------------------------------------------------------ garden sprites (screen-space billboards) */
	function treeSvg(sc, x, y, kind, size, seed) {
		var c = sc.c, P = sc.cam.P, b = sc.track([x, y, 0]), r = rng(seed);
		var season = c.season || 'summer';
		size *= sc.o.plantScale || 1;
		var hgt = size * (0.85 + r() * 0.3);
		sc.track([x, y, hgt]);
		var greens = { spring: ['#7FB24F', '#9CCB6B', '#5E9440'], summer: ['#4F7F37', '#6C9A47', '#3B6A2C'], autumn: ['#C9762E', '#D89A3A', '#A4532A'], winter: ['#6F6A63', '#857F77', '#5A554F'] }[season];
		var trunk = '#5B4636', s = '', bx = b[0], by = b[1], k = 1;
		var top = P([x, y, hgt]);
		var H = by - top[1];
		if (kind === 'cypress') {
			s += '<path d="M' + f(bx) + ' ' + f(by) + 'c' + f(-H * 0.12) + ' ' + f(-H * 0.3) + ' ' + f(-H * 0.1) + ' ' + f(-H * 0.75) + ' 0 ' + f(-H) + 'c' + f(H * 0.1) + ' ' + f(H * 0.25) + ' ' + f(H * 0.12) + ' ' + f(H * 0.7) + ' 0 ' + f(H) + 'z" fill="' + (season === 'winter' ? '#3F5A3A' : '#2F5530') + '"/>';
			return s;
		}
		if (kind === 'conifer') {
			var cg = season === 'winter' ? '#3C5A43' : '#2E5235';
			s += '<rect x="' + f(bx - H * 0.02) + '" y="' + f(by - H * 0.15) + '" width="' + f(H * 0.04) + '" height="' + f(H * 0.15) + '" fill="' + trunk + '"/>';
			for (var t = 0; t < 3; t++) { var yy = by - H * (0.12 + t * 0.26), ww = H * (0.32 - t * 0.08); s += '<path d="M' + f(bx - ww) + ' ' + f(yy) + 'L' + f(bx) + ' ' + f(yy - H * 0.42) + 'L' + f(bx + ww) + ' ' + f(yy) + 'z" fill="' + shade(cg, t * 0.06) + '"/>'; }
			if (season === 'winter') { s += '<path d="M' + f(bx - H * 0.1) + ' ' + f(by - H * 0.72) + 'L' + f(bx) + ' ' + f(by - H) + 'L' + f(bx + H * 0.1) + ' ' + f(by - H * 0.72) + 'z" fill="#F4F7FA"/>'; }
			return s;
		}
		if (kind === 'grass') {
			for (var g = 0; g < 7; g++) { var gx = bx + (g - 3) * H * 0.07; s += '<path d="M' + f(gx) + ' ' + f(by) + 'q' + f((g - 3) * H * 0.05) + ' ' + f(-H * 0.5) + ' ' + f((g - 3) * H * 0.12) + ' ' + f(-H * (0.8 + r() * 0.2)) + '" stroke="' + (season === 'winter' ? '#B5A98F' : (season === 'autumn' ? '#C2A35E' : '#9AAE62')) + '" stroke-width="' + f(H * 0.025) + '" fill="none"/>'; }
			return s;
		}
		if (kind === 'shrub' || kind === 'topiary' || kind === 'lavender') {
			var sw = H * (kind === 'lavender' ? 0.9 : 0.75);
			var sc1 = kind === 'lavender' ? (season === 'summer' ? '#8C7BB8' : '#7E8F6A') : greens[0];
			s += '<ellipse cx="' + f(bx) + '" cy="' + f(by - H * 0.42) + '" rx="' + f(sw / 2) + '" ry="' + f(H * 0.46) + '" fill="' + sc1 + '"/>' +
				'<ellipse cx="' + f(bx - sw * 0.12) + '" cy="' + f(by - H * 0.55) + '" rx="' + f(sw * 0.28) + '" ry="' + f(H * 0.26) + '" fill="' + shade(sc1, 0.12) + '"/>';
			if (kind === 'shrub' && (c.garden_style === 'cottage') && season !== 'winter') { for (var fl = 0; fl < 5; fl++) { s += '<circle cx="' + f(bx + (r() - 0.5) * sw * 0.8) + '" cy="' + f(by - H * (0.2 + r() * 0.6)) + '" r="' + f(H * 0.05) + '" fill="' + ['#E26D8A', '#F2C14E', '#FFFFFF', '#C06FD1'][fl % 4] + '"/>'; } }
			return s;
		}
		if (kind === 'olive') {
			s += '<path d="M' + f(bx) + ' ' + f(by) + 'c' + f(H * 0.06) + ' ' + f(-H * 0.2) + ' ' + f(-H * 0.08) + ' ' + f(-H * 0.32) + ' ' + f(H * 0.02) + ' ' + f(-H * 0.5) + '" stroke="#6A5A48" stroke-width="' + f(H * 0.06) + '" fill="none"/>';
			var oc = season === 'winter' ? '#7D8A6E' : '#8A9A6B';
			[[-0.18, 0.62, 0.26], [0.14, 0.66, 0.24], [0, 0.82, 0.22], [-0.05, 0.55, 0.2]].forEach(function (q, i) { s += '<ellipse cx="' + f(bx + q[0] * H) + '" cy="' + f(by - q[1] * H) + '" rx="' + f(q[2] * H) + '" ry="' + f(q[2] * H * 0.62) + '" fill="' + shade(oc, i * 0.05) + '"/>'; });
			return s;
		}
		if (kind === 'palm') {
			var lean = (r() - 0.5) * H * 0.2, tx = bx + lean, ty = by - H * 0.8, pc = season === 'winter' ? '#6E7F55' : '#4E7A3A';
			s += '<path d="M' + f(bx) + ' ' + f(by) + 'Q' + f(bx + lean * 0.1) + ' ' + f(by - H * 0.45) + ' ' + f(tx) + ' ' + f(ty) + '" stroke="#8A7458" stroke-width="' + f(H * 0.045) + '" fill="none"/>';
			for (var pf = 0; pf < 9; pf++) {
				var a3 = -Math.PI * 0.95 + pf / 8 * Math.PI * 0.9, l3 = H * (0.3 + r() * 0.08), ex = tx + Math.cos(a3) * l3, ey = ty + Math.abs(Math.sin(a3)) * -l3 * 0.25 + l3 * 0.42 * (1 - Math.abs(Math.sin(a3)));
				s += '<path d="M' + f(tx) + ' ' + f(ty) + 'Q' + f(tx + Math.cos(a3) * l3 * 0.5) + ' ' + f(ty - l3 * 0.32) + ' ' + f(ex) + ' ' + f(ey) + '" stroke="' + shade(pc, (pf % 3 - 1) * 0.12) + '" stroke-width="' + f(H * 0.055) + '" fill="none" stroke-linecap="round"/>';
			}
			return s;
		}
		if (kind === 'birch') {
			s += '<path d="M' + f(bx) + ' ' + f(by) + 'L' + f(bx + H * 0.02) + ' ' + f(by - H * 0.7) + '" stroke="#ECE9E2" stroke-width="' + f(H * 0.035) + '"/>';
			for (var bm = 0; bm < 5; bm++) { s += '<rect x="' + f(bx - H * 0.012) + '" y="' + f(by - H * (0.1 + bm * 0.12)) + '" width="' + f(H * 0.022) + '" height="' + f(H * 0.012) + '" fill="#3A3633"/>'; }
			if (season === 'winter') { for (var bb2 = 0; bb2 < 5; bb2++) { var ab = -Math.PI / 2 + (bb2 - 2) * 0.35; s += '<path d="M' + f(bx) + ' ' + f(by - H * 0.5) + 'l' + f(Math.cos(ab) * H * 0.25) + ' ' + f(Math.sin(ab) * H * 0.45) + '" stroke="#8C8378" stroke-width="' + f(H * 0.01) + '"/>'; } return s; }
			var bg = season === 'autumn' ? ['#D9B33F', '#E5C55A', '#C49A2E'] : ['#8DB65A', '#A6C972', '#76A048'];
			[[0, 0.62, 0.17, 0.3], [-0.09, 0.5, 0.13, 0.2], [0.1, 0.48, 0.12, 0.2], [0.02, 0.8, 0.11, 0.17]].forEach(function (q, i) { s += '<ellipse cx="' + f(bx + q[0] * H) + '" cy="' + f(by - q[1] * H) + '" rx="' + f(q[2] * H) + '" ry="' + f(q[3] * H) + '" fill="' + bg[i % 3] + '" opacity="0.95"/>'; });
			return s;
		}
		if (kind === 'maple') {
			s += '<path d="M' + f(bx) + ' ' + f(by) + 'L' + f(bx - H * 0.05) + ' ' + f(by - H * 0.4) + 'M' + f(bx) + ' ' + f(by - H * 0.15) + 'L' + f(bx + H * 0.08) + ' ' + f(by - H * 0.42) + '" stroke="#4A3A2E" stroke-width="' + f(H * 0.04) + '"/>';
			if (season === 'winter') { return s; }
			var mg = season === 'spring' ? ['#B2463A', '#C85B44', '#963A31'] : (season === 'summer' ? ['#9E3A2F', '#B84A36', '#7E2E28'] : ['#D2662F', '#E08A3A', '#B4452C']);
			[[0, 0.62, 0.42, 0.24], [-0.24, 0.55, 0.26, 0.17], [0.25, 0.56, 0.27, 0.17], [0.05, 0.8, 0.26, 0.14]].forEach(function (q, i) { s += '<ellipse cx="' + f(bx + q[0] * H) + '" cy="' + f(by - q[1] * H) + '" rx="' + f(q[2] * H) + '" ry="' + f(q[3] * H) + '" fill="' + mg[i % 3] + '"/>'; });
			return s;
		}
		// deciduous / multistem / fruit
		var stems = kind === 'multistem' ? 3 : 1;
		for (var st = 0; st < stems; st++) { var off = (st - (stems - 1) / 2) * H * 0.05; s += '<path d="M' + f(bx + off) + ' ' + f(by) + 'L' + f(bx + off * 2.5) + ' ' + f(by - H * 0.5) + '" stroke="' + trunk + '" stroke-width="' + f(H * (stems > 1 ? 0.025 : 0.045)) + '"/>'; }
		if (season === 'winter') {
			for (var br = 0; br < 6; br++) { var a = -Math.PI / 2 + (br - 2.5) * 0.4; s += '<path d="M' + f(bx) + ' ' + f(by - H * 0.45) + 'l' + f(Math.cos(a) * H * 0.35) + ' ' + f(Math.sin(a) * H * 0.45) + '" stroke="' + trunk + '" stroke-width="' + f(H * 0.015) + '"/>'; }
			return s;
		}
		var R = H * (kind === 'multistem' ? 0.3 : 0.36);
		var cy = by - H + R;
		s += '<circle cx="' + f(bx) + '" cy="' + f(cy + R * 0.15) + '" r="' + f(R) + '" fill="' + greens[2] + '"/>' +
			'<circle cx="' + f(bx - R * 0.35) + '" cy="' + f(cy) + '" r="' + f(R * 0.72) + '" fill="' + greens[0] + '"/>' +
			'<circle cx="' + f(bx + R * 0.38) + '" cy="' + f(cy + R * 0.1) + '" r="' + f(R * 0.66) + '" fill="' + greens[1] + '"/>' +
			'<circle cx="' + f(bx - R * 0.1) + '" cy="' + f(cy - R * 0.38) + '" r="' + f(R * 0.5) + '" fill="' + shade(greens[1], 0.12) + '"/>';
		if (kind === 'fruit' || (season === 'spring' && r() > 0.4)) { for (var fr2 = 0; fr2 < 7; fr2++) { s += '<circle cx="' + f(bx + (r() - 0.5) * R * 1.4) + '" cy="' + f(cy + (r() - 0.5) * R * 1.2) + '" r="' + f(R * 0.07) + '" fill="' + (season === 'spring' ? '#F7D3E0' : '#D9472B') + '"/>'; } }
		void k;
		return s;
	}

	// A parked vehicle (driven in forwards: nose to -y): body and cabin boxes, dark wheels below.
	var CAB = { sedan: [0.3, 0.95, 1.45, 0.12, 0.62], hatchback: [0.3, 0.98, 1.5, 0.05, 0.62], suv: [0.42, 1.15, 1.72, 0.05, 0.68], pickup: [0.45, 1.0, 1.82, 0.42, 0.75], van: [0.38, 1.95, 1.95, 0, 0], sports: [0.25, 0.8, 1.18, 0.2, 0.55], electric: [0.3, 0.92, 1.42, 0.12, 0.66] };
	function vehicle2d(sc, type, x, y, paint) {
		var out = [], d = VEH[type] || VEH.sedan, hw = d[0] / 2, hl = d[1] / 2, P = CAB[type], glassC = '#2A3138';
		function put(list) { list.forEach(function (r) { out.push(r); }); }
		if (type === 'motorcycle' || type === 'bicycle') {
			var mb = type === 'motorcycle';
			put(box(sc, x - 0.04, y - hl + 0.1, 0, x + 0.04, y + hl - 0.1, mb ? 0.6 : 0.62, { top: '#1E1F21', front: '#1E1F21', side: '#2A2C2E' }));
			put(box(sc, x - (mb ? 0.16 : 0.03), y - hl * 0.55, mb ? 0.55 : 0.6, x + (mb ? 0.16 : 0.03), y + hl * 0.45, mb ? 0.95 : 0.95, { top: mb ? paint : '#3A3D40', front: mb ? shade(paint, -0.1) : '#3A3D40', side: mb ? paint : '#3A3D40' }));
			return out;
		}
		put(box(sc, x - hw + 0.12, y - hl + 0.45, 0, x + hw - 0.12, y + hl - 0.45, P[0], { top: '#151617', front: '#151617', side: '#1C1D1E' }));
		put(box(sc, x - hw, y - hl, P[0], x + hw, y + hl, P[1], { top: shade(paint, 0.1), front: paint, side: shade(paint, -0.12) }));
		if (P[4] > P[3]) { put(box(sc, x - hw + 0.14, y + hl - P[4] * d[1], P[1], x + hw - 0.14, y + hl - P[3] * d[1], P[2], { top: shade(paint, 0.05), front: glassC, side: glassC })); }
		else { put(box(sc, x - hw + 0.08, y + hl - 0.02, P[1] * 0.55, x + hw - 0.08, y + hl + 0.005, P[1] - 0.1, { top: glassC, front: glassC, side: glassC })); }
		return out;
	}
	// A person drawn upright at the foot point (x, y): legs, body, arms, head and hair.
	var TOPS2 = ['#2F4A5A', '#B4553F', '#EDE6DA', '#6F7D63', '#3B3331', '#C49A5A', '#7E8FA6', '#E3D3C4'], BOTS2 = ['#2B3442', '#3A3836', '#C9B9A0', '#5C6B7A', '#1E1F21'], SKIN2 = ['#E8C3A6', '#D9A88A', '#C58E6B', '#9B6A4C', '#6E4A35'], HAIR2 = ['#2A1E16', '#5B3B24', '#A9763F', '#D8B36A', '#3A3A3A'];
	function person2d(sc, p) {
		var hgt = p.kind === 'child' ? 1.2 : (p.kind === 'woman' ? 1.67 : 1.78), b = sc.track([p.x, p.y, 0]), t = sc.cam.P([p.x, p.y, hgt]);
		sc.track([p.x, p.y, hgt]);
		var H = b[1] - t[1], x = b[0], y = b[1], r = rng(p.seed || 3);
		var top = TOPS2[Math.floor(r() * TOPS2.length)], bot = BOTS2[Math.floor(r() * BOTS2.length)], skin = SKIN2[Math.floor(r() * SKIN2.length)], hair = HAIR2[Math.floor(r() * HAIR2.length)];
		var walk = p.pose === 'walk' ? H * 0.05 : 0, s = '';
		s += '<path d="M' + f(x - H * 0.045) + ' ' + f(y - H * 0.47) + 'L' + f(x - H * 0.05 - walk) + ' ' + f(y) + 'M' + f(x + H * 0.045) + ' ' + f(y - H * 0.47) + 'L' + f(x + H * 0.05 + walk) + ' ' + f(y) + '" stroke="' + bot + '" stroke-width="' + f(H * 0.07) + '" stroke-linecap="round"/>';
		s += '<path d="M' + f(x - H * 0.13) + ' ' + f(y - H * 0.8) + 'L' + f(x - H * 0.16 - walk) + ' ' + f(y - H * 0.5) + 'M' + f(x + H * 0.13) + ' ' + f(y - H * 0.8) + 'L' + f(x + H * 0.16 + walk) + ' ' + f(y - H * 0.5) + '" stroke="' + top + '" stroke-width="' + f(H * 0.055) + '" stroke-linecap="round"/>';
		s += '<rect x="' + f(x - H * 0.12) + '" y="' + f(y - H * 0.84) + '" width="' + f(H * 0.24) + '" height="' + f(H * 0.4) + '" rx="' + f(H * 0.07) + '" fill="' + top + '"/>';
		s += '<circle cx="' + f(x) + '" cy="' + f(y - H * 0.92) + '" r="' + f(H * 0.07) + '" fill="' + skin + '"/>';
		s += '<path d="M' + f(x - H * 0.072) + ' ' + f(y - H * 0.91) + 'a' + f(H * 0.072) + ' ' + f(H * 0.072) + ' 0 0 1 ' + f(H * 0.144) + ' 0' + (p.kind === 'woman' ? 'v' + f(H * 0.09) : '') + '" fill="' + hair + '"/>';
		return s;
	}
	// A dog or a cat (sitting / lying), drawn at the foot point.
	function pet2d(sc, p) {
		var b = sc.track([p.x, p.y, 0]), k = b[1] - sc.cam.P([p.x, p.y, 1])[1], x = b[0], y = b[1], r = rng(p.seed || 5);
		var col2 = p.kind === 'cat' ? ['#C97A3A', '#6E6E70', '#2A2624', '#E9E2D6'][Math.floor(r() * 4)] : ['#C9974F', '#3A2F28', '#E8DCC8', '#8A5A33'][Math.floor(r() * 4)], s = '';
		if (p.kind === 'cat') { var cs = 0.32 * k; return '<ellipse cx="' + f(x) + '" cy="' + f(y - cs * 0.45) + '" rx="' + f(cs * 0.35) + '" ry="' + f(cs * 0.5) + '" fill="' + col2 + '"/><circle cx="' + f(x) + '" cy="' + f(y - cs * 1.05) + '" r="' + f(cs * 0.25) + '" fill="' + col2 + '"/><path d="M' + f(x - cs * 0.22) + ' ' + f(y - cs * 1.15) + 'l' + f(cs * 0.04) + ' ' + f(-cs * 0.25) + 'l' + f(cs * 0.12) + ' ' + f(cs * 0.15) + 'M' + f(x + cs * 0.22) + ' ' + f(y - cs * 1.15) + 'l' + f(-cs * 0.04) + ' ' + f(-cs * 0.25) + 'l' + f(-cs * 0.12) + ' ' + f(cs * 0.15) + '" fill="' + col2 + '"/>'; }
		var z = (p.kind === 'dog_small' ? 0.55 : 1) * k, ly = p.pose === 'lie' ? 0.18 : 0.48;
		s += '<ellipse cx="' + f(x) + '" cy="' + f(y - z * ly) + '" rx="' + f(z * 0.38) + '" ry="' + f(z * 0.16) + '" fill="' + col2 + '"/>';
		if (p.pose !== 'lie') { s += '<path d="M' + f(x - z * 0.25) + ' ' + f(y - z * 0.4) + 'V' + f(y) + 'M' + f(x + z * 0.25) + ' ' + f(y - z * 0.4) + 'V' + f(y) + '" stroke="' + col2 + '" stroke-width="' + f(z * 0.08) + '"/>'; }
		s += '<circle cx="' + f(x + z * 0.36) + '" cy="' + f(y - z * (ly + 0.22)) + '" r="' + f(z * 0.13) + '" fill="' + col2 + '"/><ellipse cx="' + f(x + z * 0.5) + '" cy="' + f(y - z * (ly + 0.18)) + '" rx="' + f(z * 0.08) + '" ry="' + f(z * 0.05) + '" fill="' + shade(col2, -0.1) + '"/>';
		return s;
	}

	/* ------------------------------------------------------------------ main render */
	function render(cfg, opts) {
		opts = opts || {};
		var c = cfg || {};
		var sc = new Scene(c, opts);
		var pl = plan(c);
		var vols = volumes(c, pl);
		var L = sc.light;
		var mini = !!opts.mini;
		var mainV = vols[0];
		var W = pl.W, D = pl.D, bbx = siteBox(vols), maxY = bbx.y1;
		var maxX = bbx.x1;
		var tight = !!opts.tight, front = maxY + (mini ? 2.5 : (tight ? 5.5 : 6.5)), back = bbx.y0 - (mini ? 2 : (tight ? 2.5 : 6)), left = bbx.x0 - (mini ? 2 : (tight ? 3.5 : 6.5));
		var garage = c.garage || 'none';
		var gx0 = maxX + 0.4, gW = garage === 'garage_2' ? 6.2 : 3.4, gD = 6.2;
		if (garage === 'separate') { gx0 = maxX + 2.2; }
		var right = (garage !== 'none' ? gx0 + gW : maxX) + (mini ? 2 : (tight ? 3.5 : 6));
		// the plot: house centred on the plot width, 5 m front setback; the plot outline is drawn when it fits
		var plot = mini || tight ? null : plotRect(c, vols, garage !== 'none' ? gx0 + gW : maxX + 3.8);
		if (plot) {
			left = Math.min(left, plot.x0 - 1.2); right = Math.max(right, plot.x1 + 1.2); front = Math.max(front, plot.yF + 1.2);
			if (plot.yB !== null) { back = Math.min(back, plot.yB - 1.2); }
		}
		var season = c.season || 'summer';
		var groundC = { spring: '#8FBF5C', summer: '#7DA64C', autumn: '#A3A055', winter: '#E8EEF2' }[season];
		if (!has(c.garden_features, 'lawn') && !mini && c.garden_features) { groundC = { natural: '#9B9A6A', formal: '#8DAA5A', minimal: '#B9B2A2', cottage: '#8EA65A', mediterranean: '#C4B48E' }[c.garden_style] || '#A8A07A'; if (season === 'winter') { groundC = '#E8EEF2'; } }
		if (L.dark) { groundC = mix(groundC, '#1B2440', L.dark * 0.8); }

		/* ground */
		var g = sc.plane([left, front, 0], [1, 0, 0], [0, -1, 0], [[0, 0], [right - left, 0], [right - left, front - back], [0, front - back]], groundC, '', { noShade: true, edge: false });
		var groundSvg = g ? g.svg : '';
		// diorama slab: soil edges at the front and the right, a grass lip on top
		var slabT = mini ? 0.5 : 0.9, soil = L.dark ? mix('#6B5240', '#10162A', L.dark) : '#6B5240';
		var slab = '';
		[[[left, front, 0], [1, 0, 0], right - left], [[right, front, 0], [0, -1, 0], front - back]].forEach(function (e, i) {
			var r = sc.plane([e[0][0], e[0][1], -slabT], e[1], [0, 0, 1], [[0, 0], [e[2], 0], [e[2], slabT], [0, slabT]], shade(soil, i ? -0.18 : 0), '<rect y="' + f(slabT - 0.14) + '" width="' + f(e[2]) + '" height="0.14" fill="' + shade(groundC, -0.12) + '"/><path d="M0 ' + f(slabT * 0.45) + 'H' + f(e[2]) + '" stroke="' + shade(soil, 0.08) + '" stroke-width="0.05" stroke-dasharray="0.4 0.7"/>', { noShade: true, edge: false });
			if (r) { slab += r.svg; }
		});
		var gpoly = [[left, front], [right, front], [right, back], [left, back]].map(function (q) { return sc.cam.P([q[0], q[1], 0]); });
		var clipId = sc.def('gclip', '<clipPath id="' + sc.id + 'gclip"><polygon points="' + pts(gpoly) + '"/></clipPath>');
		var horizon = '';

		/* shadow of the building(s) on the ground (clipped to the plot) */
		var shadowSvg = '';
		if (L.shadow > 0) {
			vols.forEach(function (v) {
				var hh = v.h + (c.roof_type === 'flat' ? 0.3 : Math.min(v.y1 - v.y0, v.x1 - v.x0) * Math.tan(pl.pitch * D2R) * 0.35);
				var k = Math.min(L.sunTan, 1.8) * 0.55;
				var ox = L.sunDir[0] * hh * k, oy = L.sunDir[1] * hh * k;
				var foot = [[v.x0, v.y0], [v.x1, v.y0], [v.x1, v.y1], [v.x0, v.y1]];
				var all = foot.concat(foot.map(function (q) { return [q[0] + ox, q[1] + oy]; })).map(function (q) { return sc.cam.P([q[0], q[1], 0]); });
				shadowSvg += '<polygon points="' + pts(hull(all)) + '" fill="#1B2230" opacity="' + f(L.shadow) + '"/>';
			});
			// contact shadow (ambient occlusion) around the footprint
			vols.forEach(function (v) {
				var e = 0.6, q = [[v.x0 - e, v.y1 + e], [v.x1 + e, v.y1 + e], [v.x1 + e, v.y0 - e], [v.x0 - e, v.y0 - e]].map(function (p) { return sc.cam.P([p[0], p[1], 0]); });
				shadowSvg += '<polygon points="' + pts(q) + '" fill="#1B2230" opacity="0.12"/>';
			});
			shadowSvg = '<g clip-path="url(#' + clipId + ')">' + shadowSvg + '</g>';
		}

		/* buildings */
		var units = pl.units, balcVol = vols.some(function (q) { return q.balc; });
		sc.vols = vols;
		vols.forEach(function (v, idx) {
			var type = vtype(c, v), vp = vplan(pl, v), fpv = frontPlan(c, v, vols);
			var roof = roofFor(sc, v, vp, type);
			var ws = walls(sc, v, vp, roof, vols);
			// units (semi-detached / row): party walls and extra doors
			if (v.main && units > 1) {
				var extra = '';
				for (var u = 1; u < units; u++) {
					var ux = pl.unitW * u;
					var pw = sc.plane([v.x0 + ux - 0.15, v.y1 + 0.02, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [0.3, 0], [0.3, v.h + 0.2], [0, v.h + 0.2]], shade(col(c.facade_color, '#F2EFE9'), -0.18), '', { noShade: true });
					var dr = sc.plane([v.x0 + ux + pl.unitW * 0.26, v.y1 + 0.03, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [1.05, 0], [1.05, 2.3], [0, 2.3]], 'none', doorSvg(sc, 0, 1.05, 2.3), { noShade: true });
					if (pw) { extra += pw.svg; } if (dr) { extra += dr.svg; }
				}
				ws.push({ svg: extra, depth: 0 });
			}
			var ri = roofItems(sc, v, vp, roof, type);
			var parts = ws.concat(roof.under ? [{ svg: roof.under, depth: 0 }] : []).concat(roof.planes.sort(function (a, b) { return a.depth - b.depth; })).concat(ri);
			// canopy over the entrance
			if (fpv.door && c.entrance_canopy) {
				var dpc = fpv.door, dx = v.x0 + fpv.off + dpc.x + dpc.w / 2 - 0.95;
				box(sc, dx, v.y1, pl.plinth + 2.55, dx + 1.9, v.y1 + 1.2, pl.plinth + 2.72, { top: shade(col(c.facade_color, '#F2EFE9'), -0.08), front: shade(col(c.facade_color, '#F2EFE9'), -0.15) }).forEach(function (r) { parts.push(r); });
			}
			// entrance steps (raised plinth / basement) or an accessible ramp
			if (fpv.door && (c.exterior_steps || c.basement || c.accessible)) {
				var dpe = fpv.door, ex0 = v.x0 + fpv.off + dpe.x - 0.35, ex1 = ex0 + dpe.w + 0.7, stc = '#B9B4AA';
				if (c.accessible) {
					var rz = pl.plinth, rl2 = Math.max(1.2, rz * 12);
					var ramp = sc.poly3([[ex1, v.y1 + 1.3, 0.02], [ex1 + rl2, v.y1 + 1.3, 0.02], [ex1, v.y1 + 1.3, rz]].concat([]), stc);
					var rampTop = sc.poly3([[ex0, v.y1 + 1.3, rz], [ex1 + rl2, v.y1 + 1.3, 0.02], [ex1 + rl2, v.y1, 0.02], [ex0, v.y1, rz]], sc.mat('slabs', '#C9C2B6'));
					box(sc, ex0, v.y1, 0, ex1, v.y1 + 1.3, rz, { top: sc.mat('slabs', '#C9C2B6'), front: stc }).forEach(function (r) { parts.push(r); });
					[ramp, rampTop].forEach(function (r) { if (r) { parts.push(r); } });
					parts.push({ depth: 0, svg: sc.line([ex1, v.y1 + 1.3, rz + 0.9], [ex1 + rl2, v.y1 + 1.3, 0.9], '#5E6266', 0.06) });
				} else {
					var nst = Math.max(2, Math.round(pl.plinth / 0.17)), sh = pl.plinth / nst;
					for (var si = 0; si < nst; si++) { box(sc, ex0, v.y1, si * sh, ex1, v.y1 + 0.3 * (nst - si), (si + 1) * sh, { top: '#CFCAC0', front: stc }).forEach(function (r) { parts.push(r); }); }
				}
			}
			// porch along the front (farmhouse styles)
			if (v.porch || (v.main && styleOf(c).porch)) {
				var pcol = v.porch || styleOf(c).porch, px0 = v.x0 + 0.3, px1 = v.x1 - 0.3, pd = 2.2, pz = pl.plinth + 2.7;
				box(sc, px0, v.y1, 0, px1, v.y1 + pd, pl.plinth, { top: sc.mat('deck', '#A97B52'), front: '#6B5240' }).forEach(function (r) { parts.push(r); });
				for (var pp = 0; pp <= Math.floor((px1 - px0) / 2.6); pp++) {
					var ppx = Math.min(px1 - 0.18, px0 + pp * 2.6);
					box(sc, ppx, v.y1 + pd - 0.18, pl.plinth, ppx + 0.16, v.y1 + pd - 0.02, pz, { top: pcol, front: pcol, side: shade(pcol, -0.15) }).forEach(function (r) { parts.push(r); });
				}
				var proof = sc.poly3([[px0 - 0.2, v.y1 + pd + 0.3, pz], [px1 + 0.2, v.y1 + pd + 0.3, pz], [px1 + 0.2, v.y1, pz + 0.75], [px0 - 0.2, v.y1, pz + 0.75]], roofMaterial(sc));
				if (proof) { parts.push(proof); }
			}
			// balconies (front and right side: the faces the sketch shows)
			balconies(c, v, vp, vols).forEach(function (b) {
				if (b.type === 'french' || (b.face !== 'front' && b.face !== 'right')) { return; }
				var fr = b.face === 'front', bz = b.z, L = b.u1 - b.u0, slab = b.type === 'wood' ? sc.mat('deck', '#A97B52') : '#D8D4CC';
				var bx0 = fr ? v.x0 + b.u0 : v.x1, bx1 = fr ? v.x0 + b.u1 : v.x1 + b.d, by0 = fr ? v.y1 : v.y1 - b.u1, by1 = fr ? v.y1 + b.d : v.y1 - b.u0;
				box(sc, bx0, by0, bz - 0.22, bx1, by1, bz, { top: slab, front: '#E9E6E0', side: '#DCD8D0' }).forEach(function (r) { parts.push(r); });
				var fcol = col(c.facade_color, '#F2EFE9'), fill, inner = function (len) {
					var q = '';
					if (b.type === 'glass') { q = '<path d="M0 1H' + f(len) + '" stroke="#5A6066" stroke-width="0.05"/>'; }
					else if (b.type === 'metal') { q = '<path d="M0 1H' + f(len) + 'M0 0.1H' + f(len); for (var mb = 0.1; mb < len; mb += 0.11) { q += 'M' + f(mb) + ' 0.1V1'; } q += '" stroke="#2F3235" stroke-width="0.03" fill="none"/>'; }
					else if (b.type === 'wood') { for (var wb = 0.02; wb < len; wb += 0.16) { q += '<rect x="' + f(wb) + '" y="0" width="0.1" height="1" fill="#9C6B44"/>'; } }
					else { q = '<path d="M0 1H' + f(len) + '" stroke="' + shade(fcol, -0.2) + '" stroke-width="0.08"/>'; }
					return q;
				};
				fill = b.type === 'glass' ? 'rgba(200,225,235,0.35)' : (b.type === 'solid' ? shade(fcol, -0.04) : 'none');
				var ro = { noShade: b.type !== 'solid', stroke: b.type === 'glass' ? '#C7D4DA' : null, sw: 0.5, both: true, edge: b.type === 'solid' };
				var rails = [];
				if (fr) {
					if (b.endA) { rails.push(sc.plane([bx0, by0, bz], [0, 1, 0], [0, 0, 1], [[0, 0], [b.d, 0], [b.d, 1], [0, 1]], fill, inner(b.d), ro)); }
					rails.push(sc.plane([bx0, by1, bz], [1, 0, 0], [0, 0, 1], [[0, 0], [L, 0], [L, 1], [0, 1]], fill, inner(L), ro));
					if (b.endB) { rails.push(sc.plane([bx1, by1, bz], [0, -1, 0], [0, 0, 1], [[0, 0], [b.d, 0], [b.d, 1], [0, 1]], fill, inner(b.d), ro)); }
				} else {
					if (b.endA) { rails.push(sc.plane([bx0, by1, bz], [1, 0, 0], [0, 0, 1], [[0, 0], [b.d, 0], [b.d, 1], [0, 1]], fill, inner(b.d), ro)); }
					rails.push(sc.plane([bx1, by1, bz], [0, -1, 0], [0, 0, 1], [[0, 0], [L, 0], [L, 1], [0, 1]], fill, inner(L), ro));
					if (b.endB) { rails.push(sc.plane([bx1, by0, bz], [-1, 0, 0], [0, 0, 1], [[0, 0], [b.d, 0], [b.d, 1], [0, 1]], fill, inner(b.d), ro)); }
				}
				rails.forEach(function (r) { if (r) { parts.push(r); } });
			});
			deco2d(sc, v, vp, type, roof).forEach(function (r) { parts.push(r); });
			var gr = group(parts, 0);
			// volumes are ordered by their footprint (ground) position, not by the height of their parts
			if (gr) { sc.push(sc.depth([(v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, 0]) + idx * 0.001, gr.svg); }
		});

		/* terrace (+ pergola / covered) */
		var ta = clamp(num(c.terrace_area, 0), 0, 200);
		if (ta > 0) {
			var td = clamp(ta / 6, 2.4, 5), tr = terraceRect(c, mainV, vols, ta), tw = tr.x1 - tr.x0, tx0 = tr.x0, ty1 = tr.y1;
			var terraceBox = tr;
			var tfc = { wpc: '#7A6E64', wood: '#A97B52', stone: '#CFC6B6', ceramic: '#BEB8AE' }[c.terrace_floor || 'wpc'];
			var tfill = c.terrace_floor === 'stone' || c.terrace_floor === 'ceramic' ? sc.mat('slabs', tfc) : sc.mat('deck', tfc);
			var tparts = box(sc, tx0, mainV.y1, 0, tx0 + tw, ty1, 0.18, { top: tfill, front: shade(tfc, -0.25) });
			if (has(c.shading, 'pergola') || has(c.garden_features, 'pergola') || c.outdoor_covered) {
				var ph = pl.plinth + 2.6, pc = c.arch_style === 'high_tech' || c.arch_style === 'industrial' ? '#2E3135' : '#8A6A4C';
				[[tx0 + 0.1, ty1 - 0.2], [tx0 + tw - 0.25, ty1 - 0.2]].forEach(function (q) { box(sc, q[0], q[1] - 0.15, 0, q[0] + 0.15, q[1], ph, { top: pc, front: pc, side: shade(pc, -0.2) }).forEach(function (r) { tparts.push(r); }); });
				var roofTop = c.outdoor_covered ? shade(col(c.facade_color, '#F2EFE9'), -0.1) : 'none';
				var beams = '';
				if (!c.outdoor_covered) { for (var bb = 0; bb < tw; bb += 0.55) { beams += '<rect x="' + f(bb) + '" y="0" width="0.1" height="' + f(td) + '" fill="' + pc + '"/>'; } }
				var top = sc.plane([tx0, ty1, ph], [1, 0, 0], [0, -1, 0], [[0, 0], [tw, 0], [tw, td], [0, td]], roofTop, beams + '<rect width="' + f(tw) + '" height="0.16" fill="' + pc + '"/>', { noShade: true });
				if (top) { top.depth += 1; tparts.push(top); }
			}
			if (has(c.garden_features, 'garden_furniture') || has(c.garden_features, 'outdoor_kitchen')) {
				box(sc, tx0 + tw * 0.4, mainV.y1 + td * 0.35, 0.18, tx0 + tw * 0.4 + 1.6, mainV.y1 + td * 0.35 + 0.9, 0.92, { top: '#E7E1D6', front: '#6B5E52' }).forEach(function (r) { tparts.push(r); });
			}
			var tg = group(tparts, -0.5);
			if (tg) { sc.push(sc.depth([tx0 + tw / 2, mainV.y1 + td / 2, 0]), tg.svg); }
		}

		/* garage / carport */
		if (garage !== 'none') {
			var gy1 = garage === 'separate' ? D * 0.8 : Math.min(D, gD), gy0 = gy1 - gD;
			var gh = 2.9, gfac = (c.facade_accent || []).length ? wallFill(sc, { wing: true }, 'front') : wallFill(sc, mainV, 'front');
			var gparts = [];
			if (garage === 'carport') {
				var pc2 = '#3A3D40';
				[[gx0, gy1], [gx0 + gW - 0.15, gy1]].forEach(function (q) { box(sc, q[0], q[1] - 0.15, 0, q[0] + 0.15, q[1], gh, { top: pc2, front: pc2 }).forEach(function (r) { gparts.push(r); }); });
				box(sc, gx0 - 0.1, gy0, gh, gx0 + gW + 0.1, gy1 + 0.2, gh + 0.25, { top: c.roof_surface === 'green' ? sc.mat('green', '#6E8F45') : '#5A5E62', front: '#3A3D40' }).forEach(function (r) { gparts.push(r); });
				// parked vehicle (the first car of the list, same place as in the garden plan)
				var pcar = vehicleList(c).filter(function (k) { return k !== 'motorcycle' && k !== 'bicycle'; })[0];
				if (pcar) { vehicle2d(sc, pcar, gx0 + gW / 2, gy1 - 2.975, col(c.car_color, '#3C4148')).forEach(function (r) { gparts.push(r); }); }
			} else {
				var doors = garage === 'garage_2' ? 2 : 1, dw = garage === 'garage_2' ? 2.5 : 2.6, inner = '';
				for (var gd = 0; gd < doors; gd++) {
					var gxx = gd * (gW / doors) + (gW / doors - dw) / 2, dc = col(c.window_frame_color, '#2F3235');
					inner += '<rect x="' + f(gxx) + '" y="0" width="' + f(dw) + '" height="2.25" fill="' + shade(dc, 0.12) + '"/>';
					for (var gl = 0.45; gl < 2.25; gl += 0.45) { inner += '<rect x="' + f(gxx) + '" y="' + f(gl) + '" width="' + f(dw) + '" height="0.025" fill="' + shade(dc, -0.2) + '"/>'; }
				}
				gparts = box(sc, gx0, gy0, 0, gx0 + gW, gy1, gh, { top: c.roof_type === 'flat' || garage !== 'separate' ? (c.roof_surface === 'green' ? sc.mat('green', '#6E8F45') : sc.mat('gravel', '#A9A49B')) : sc.mat('gravel', '#A9A49B'), front: gfac, side: gfac }, { front: inner });
			}
			var gg = group(gparts, 0);
			if (gg) { sc.push(sc.depth([gx0 + gW / 2, gy1 - 1, 0]), gg.svg); }
			// driveway
			if (!mini) {
				var dc2 = { pavers: '#B4ADA2', gravel: '#B9B3A8', grass: '#90A85C', asphalt: '#4A4C4F' }[c.driveway || 'pavers'];
				var dfill = c.driveway === 'gravel' ? sc.mat('gravel', dc2) : (c.driveway === 'grass' ? sc.mat('pavers', '#8FA85E') : (c.driveway === 'asphalt' ? dc2 : sc.mat('pavers', dc2)));
				var dEdge = siteEdge(c, front, plot);
				var dvw = sc.plane([gx0, dEdge, 0.01], [1, 0, 0], [0, -1, 0], [[0, 0], [gW, 0], [gW, dEdge - gy1], [0, dEdge - gy1]], dfill, '', { noShade: true });
				if (dvw) { groundSvg += dvw.svg; }
			}
		}

		/* parking pad when there is no garage */
		if (garage === 'none' && !mini) {
			var dc3 = { pavers: '#B4ADA2', gravel: '#B9B3A8', grass: '#90A85C', asphalt: '#4A4C4F' }[c.driveway || 'pavers'];
			var pfill = c.driveway === 'gravel' ? sc.mat('gravel', dc3) : (c.driveway === 'grass' ? sc.mat('pavers', '#8FA85E') : (c.driveway === 'asphalt' ? dc3 : sc.mat('pavers', dc3)));
			var pEdge = siteEdge(c, front, plot);
			var pad = sc.plane([maxX + 0.8, pEdge, 0.01], [1, 0, 0], [0, -1, 0], [[0, 0], [3, 0], [3, pEdge - D * 0.45], [0, pEdge - D * 0.45]], pfill, '', { noShade: true });
			if (pad) { groundSvg += pad.svg; }
		}
		/* building services on the ground: heat pump, EV charger, rainwater tank */
		var en = c.energy || [];
		var acT = c.ac_units || 'none';
		if (acT !== 'none') {
			var ac0 = { top: '#D9DCDE', front: '#EDEFF0', side: '#C9CDD0' }, fan = '<circle cx="0.55" cy="0.3" r="0.22" fill="#9EA4A9"/><circle cx="0.55" cy="0.3" r="0.06" fill="#5E6266"/>';
			if (acT === 'wall') { box(sc, mainV.x1, D * 0.3, pl.plinth + 2.0, mainV.x1 + 0.32, D * 0.3 + 0.85, pl.plinth + 2.6, ac0, { side: fan }).forEach(function (r) { sc.push(r.depth + 1, r.svg); }); }
			else if (acT === 'roof' && c.roof_type === 'flat') { box(sc, mainV.x1 - 2.2, mainV.y0 + 1.0, mainV.h + 0.1, mainV.x1 - 1.1, mainV.y0 + 1.9, mainV.h + 0.9, ac0, { side: fan }).forEach(function (r) { sc.push(r.depth + 1, r.svg); }); }
			else if (acT === 'ground' || acT === 'screened' || acT === 'roof') {
				box(sc, mainV.x1 + 0.1, D * 0.35 - 0.1, 0, mainV.x1 + 0.9, D * 0.35 + 1.2, 0.05, { top: '#B9B4AA', front: '#A9A49B', side: '#99948B' }).forEach(function (r) { sc.push(r.depth - 0.1, r.svg); });
				box(sc, mainV.x1 + 0.25, D * 0.35, 0, mainV.x1 + 0.75, D * 0.35 + 1.1, 0.85, ac0, { side: '<circle cx="0.55" cy="0.45" r="0.3" fill="#9EA4A9"/><circle cx="0.55" cy="0.45" r="0.08" fill="#5E6266"/>' }).forEach(function (r) { sc.push(r.depth, r.svg); });
				if (acT === 'screened') { for (var sq = 0; sq < 9; sq++) { box(sc, mainV.x1 + 0.9, D * 0.35 - 0.15 + sq * 0.15, 0, mainV.x1 + 0.97, D * 0.35 - 0.07 + sq * 0.15, 1.3, { top: '#B58A5E', front: '#A97B52', side: '#8A6446' }).forEach(function (r) { sc.push(r.depth + 0.2, r.svg); }); } }
			}
		}
		if (has(en, 'heat_pump') && acT !== 'ground' && acT !== 'screened') {
			box(sc, mainV.x1 + 0.25, D * 0.35, 0, mainV.x1 + 0.75, D * 0.35 + 1.1, 0.85, { top: '#D9DCDE', front: '#EDEFF0', side: '#C9CDD0' }, { side: '<circle cx="0.55" cy="0.45" r="0.3" fill="#9EA4A9"/><circle cx="0.55" cy="0.45" r="0.08" fill="#5E6266"/>' }).forEach(function (r) { sc.push(r.depth, r.svg); });
		}
		if (has(en, 'ev_charger')) {
			var evx = garage === 'none' ? maxX + 0.5 : gx0 - 0.25, evy = garage === 'none' ? D + 0.4 : Math.min(D, gD) + 0.3;
			box(sc, evx, evy, 0, evx + 0.22, evy + 0.18, 1.3, { top: '#2B2E31', front: '#3A3D40', side: '#2B2E31' }, { front: '<rect x="0.04" y="0.95" width="0.14" height="0.2" fill="#4CAF7A"/>' }).forEach(function (r) { sc.push(r.depth + 0.5, r.svg); });
		}
		if (has(en, 'rainwater') || has(c.garden_features, 'rainwater')) {
			var rw = sc.track([mainV.x1 + 0.45, mainV.y1 - 0.5, 0]);
			sc.push(sc.depth([mainV.x1 + 0.45, mainV.y1 - 0.5, 0]) + 0.5, '<rect x="' + f(rw[0] - 0.32) + '" y="' + f(rw[1] - 1.15) + '" width="0.64" height="1.15" rx="0.14" fill="#5C6B5A"/><rect x="' + f(rw[0] - 0.32) + '" y="' + f(rw[1] - 0.9) + '" width="0.64" height="0.06" fill="#4A5748"/>');
		}

		/* garden: path, pool, trees, hedges, fence – the shared garden plan (inside the plot, nothing on paving) */
		if (!mini) {
			var gf = c.garden_features || [], fenceY = siteEdge(c, front, plot);
			var garR = garage !== 'none' ? { x0: gx0, x1: gx0 + gW, y0: (garage === 'separate' ? D * 0.8 : Math.min(D, gD)) - gD, y1: garage === 'separate' ? D * 0.8 : Math.min(D, gD) } : null;
			var G = gardenLayout(c, vols, pl, { left: left, right: right, front: front, back: back }, plot, garR, ta > 0 ? terraceRect(c, mainV, vols, ta) : null, fenceY);
			var doorMid = G.ent.x;
			if (G.path) {
				var pathFill = sc.mat('slabs', season === 'winter' ? '#D5DADD' : '#C9C2B6'), P0 = G.path;
				var pth = sc.plane([P0.x0, P0.y1, 0.012], [1, 0, 0], [0, -1, 0], [[0, 0], [P0.x1 - P0.x0, 0], [P0.x1 - P0.x0, P0.y1 - P0.y0], [0, P0.y1 - P0.y0]], pathFill, '', { noShade: true });
				if (pth) { groundSvg += pth.svg; }
			}
			if (G.pool) {
				var px0 = G.pool.x0, py0 = G.pool.y0, pw2 = G.pool.x1 - G.pool.x0, pd = G.pool.y1 - G.pool.y0;
				var pool = sc.plane([px0, py0 + pd, 0.02], [1, 0, 0], [0, -1, 0], [[0, 0], [pw2, 0], [pw2, pd], [0, pd]], '#E9E4DA', '<rect x="0.25" y="0.25" width="' + f(pw2 - 0.5) + '" height="' + f(pd - 0.5) + '" fill="' + (L.dark ? '#1E5C7A' : '#5FB2CF') + '"/><rect x="0.25" y="' + f(pd * 0.55) + '" width="' + f(pw2 - 0.5) + '" height="' + f(pd * 0.1) + '" fill="#9FDBEA" opacity="0.5"/>', { noShade: true });
				if (pool) { groundSvg += pool.svg; }
			}
			if (G.gravel) {
				var g1 = G.gravel, gp = sc.plane([g1.x0, g1.y1, 0.008], [1, 0, 0], [0, -1, 0], [[0, 0], [g1.x1 - g1.x0, 0], [g1.x1 - g1.x0, g1.y1 - g1.y0], [0, g1.y1 - g1.y0]], sc.mat('gravel', '#A9A49B'), '', { noShade: true, edge: false });
				if (gp) { groundSvg += gp.svg; }
			}
			G.flats.forEach(function (fl2) {
				var w2 = fl2.x1 - fl2.x0, d2 = fl2.y1 - fl2.y0, inner3 = '';
				if (fl2.kind === 'soil') { for (var fc = 0; fc * 0.7 + 0.4 < w2; fc++) { inner3 += '<circle cx="' + f(0.4 + fc * 0.7) + '" cy="' + f(d2 / 2) + '" r="0.18" fill="' + ['#E26D8A', '#F2C14E', '#C06FD1', '#FFFFFF'][fc % 4] + '"/>'; } }
				var fp2 = sc.plane([fl2.x0, fl2.y1, 0.015], [1, 0, 0], [0, -1, 0], [[0, 0], [w2, 0], [w2, d2], [0, d2]], fl2.kind === 'soil' ? '#6B4F3A' : '#D9C79E', inner3, { noShade: true });
				if (fp2) { groundSvg += fp2.svg; }
			});
			G.plants.forEach(function (p) { if (p.kind !== 'flower') { sc.push(sc.depth([p.x, p.y, 0]), treeSvg(sc, p.x, p.y, p.kind, p.size, p.seed)); } });
			if (G.hedge) { for (var hx = G.hedge.x0 + 0.5; hx < G.hedge.x1 - 0.4; hx += 1.1) { sc.push(sc.depth([hx, G.hedge.y0 + 0.45, 0]), treeSvg(sc, hx, G.hedge.y0 + 0.45, 'topiary', 1.4, 3 + Math.round(hx * 10))); } }
			if (G.shed) { box(sc, G.shed.x0 + 0.1, G.shed.y0 + 0.1, 0, G.shed.x1 - 0.1, G.shed.y1 - 0.1, 2.3, { top: '#5A4636', front: sc.mat('wood', '#9A7048') }).forEach(function (r) { sc.push(r.depth, r.svg); }); }
			if (G.firepit) {
				var fpp = sc.track([G.firepit.x, G.firepit.y, 0]);
				sc.push(sc.depth([G.firepit.x, G.firepit.y, 0]), '<ellipse cx="' + f(fpp[0]) + '" cy="' + f(fpp[1]) + '" rx="0.7" ry="0.3" fill="#5A5550"/><ellipse cx="' + f(fpp[0]) + '" cy="' + f(fpp[1] - 0.2) + '" rx="0.35" ry="0.3" fill="#F28C38" opacity="' + (L.glow ? 0.95 : 0.7) + '"/>');
			}
			if (G.pergola) {
				var pgx = G.pergola.x0, pgy = G.pergola.y0, pgc = '#8A6A4C';
				[[pgx, pgy], [pgx + 2.8, pgy], [pgx, pgy + 2.4], [pgx + 2.8, pgy + 2.4]].forEach(function (q) { box(sc, q[0], q[1], 0, q[0] + 0.14, q[1] + 0.14, 2.5, { top: pgc, front: pgc, side: shade(pgc, -0.2) }).forEach(function (r) { sc.push(r.depth, r.svg); }); });
				var pgb = ''; for (var pb = 0; pb < 3; pb += 0.45) { pgb += '<rect x="' + f(pb) + '" y="0" width="0.08" height="2.6" fill="' + pgc + '"/>'; }
				var pgt = sc.plane([pgx, pgy + 2.55, 2.5], [1, 0, 0], [0, -1, 0], [[0, 0], [2.95, 0], [2.95, 2.6], [0, 2.6]], 'none', pgb, { noShade: true, edge: false });
				if (pgt) { sc.push(sc.depth([pgx + 1.4, pgy + 1.2, 0]) + 1, pgt.svg); }
			}
			var paint2 = col(c.car_color, '#3C4148');
			G.vehicles.forEach(function (vh) { if (!(vh.port && (vh.type !== 'motorcycle' && vh.type !== 'bicycle'))) { vehicle2d(sc, vh.type, vh.x, vh.y, paint2).forEach(function (r) { sc.push(r.depth, r.svg); }); } });
			if (G.charger) { box(sc, G.charger.x - 0.11, G.charger.y - 0.09, 0, G.charger.x + 0.11, G.charger.y + 0.09, 1.3, { top: '#2B2E31', front: '#3A3D40', side: '#2B2E31' }, { front: '<rect x="0.04" y="0.95" width="0.14" height="0.2" fill="#4CAF7A"/>' }).forEach(function (r) { sc.push(r.depth + 0.5, r.svg); }); }
			if (G.kennel) { box(sc, G.kennel.x - 0.45, G.kennel.y - 0.4, 0, G.kennel.x + 0.45, G.kennel.y + 0.4, 0.75, { top: '#5A3A2A', front: sc.mat('wood', '#9C7452'), side: '#8A6446' }, { front: '<path d="M0.29 0V0.3A0.16 0.16 0 0 1 0.61 0.3V0Z" fill="#1A1614"/>' }).forEach(function (r) { sc.push(r.depth, r.svg); }); }
			G.people.forEach(function (pp) { sc.push(sc.depth([pp.x, pp.y, 0]) + 0.3, person2d(sc, pp)); });
			G.pets.forEach(function (pp) { sc.push(sc.depth([pp.x, pp.y, 0]) + 0.3, pet2d(sc, pp)); });
			if (G.furniture) {
				box(sc, G.furniture.x, G.furniture.y, 0, G.furniture.x + 1.6, G.furniture.y + 0.9, 0.75, { top: G.furniture.kitchen ? '#BFC3C6' : '#E7E1D6', front: '#6B5E52' }).forEach(function (r) { sc.push(r.depth, r.svg); });
			}
			if (L.glow) {
				G.lights.forEach(function (q) {
					var lp = sc.track([q[0], q[1], 0]);
					sc.push(sc.depth([q[0], q[1], 0]), '<circle cx="' + f(lp[0]) + '" cy="' + f(lp[1] - 0.5) + '" r="0.9" fill="#FFD27A" opacity="0.28"/><rect x="' + f(lp[0] - 0.06) + '" y="' + f(lp[1] - 0.6) + '" width="0.12" height="0.6" fill="#FFE3A3"/>');
				});
			}
			// fence: the front with openings for the path (optional gate) and the driveway, the sides and the back along the plot
			var fence = c.fence || 'none';
			if (G.fence) {
				var F = G.fence, fz = { slats: 1.6, mesh: 1.4, masonry: 1.3, gabion: 1.2 }[fence], fx0 = F.x0, fx1 = F.x1, fy2 = F.y;
				var gateX = doorMid - 0.6, gateOn = c.gate !== false;
				var dr0 = G.drive.x0, dr1 = G.drive.x1;
				var fcol = { slats: c.arch_style === 'scandinavian' ? '#9C978E' : '#3B3E42', mesh: '#5B6B5A', masonry: shade(col(c.facade_color, '#F2EFE9'), -0.06), gabion: '#8E8A84' }[fence];
				var ffill = fence === 'masonry' ? fcol : (fence === 'gabion' ? sc.mat('stone', '#9C978E') : (fence === 'mesh' ? 'rgba(91,107,90,0.25)' : 'none'));
				var fenceInner = function (lenF) {
					var q = '';
					if (fence === 'slats') { for (var sx = 0; sx < lenF - 0.1; sx += 0.16) { q += '<rect x="' + f(sx) + '" y="0" width="0.11" height="' + f(fz) + '" fill="' + fcol + '"/>'; } }
					if (fence === 'mesh') { q += '<path d="M0 ' + f(fz) + 'H' + f(lenF) + '" stroke="' + fcol + '" stroke-width="0.05"/>'; for (var mx = 0; mx < lenF; mx += 2.5) { q += '<rect x="' + f(mx) + '" y="0" width="0.06" height="' + f(fz) + '" fill="' + fcol + '"/>'; } }
					return q;
				};
				fenceSegs(fx0, fx1, F.gaps).forEach(function (sg) {
					var lenF = sg[1] - sg[0];
					var fe = sc.plane([sg[0], fy2, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [lenF, 0], [lenF, fz], [0, fz]], ffill, fenceInner(lenF), { noShade: true });
					if (fe) { sc.push(fe.depth + 50, fe.svg); }
				});
				F.sides.concat(F.back ? [[null, F.back[0], F.back[1], F.back[2]]] : []).forEach(function (sd) {
					var alongX = sd[0] === null, a0 = alongX ? sd[1] : sd[2], lenS = alongX ? sd[2] - sd[1] : sd[2] - sd[1];
					var o = alongX ? [sd[1], sd[3], 0] : [sd[0], sd[2], 0], du = alongX ? [1, 0, 0] : [0, -1, 0];
					void a0;
					var se = sc.plane(o, du, [0, 0, 1], [[0, 0], [lenS, 0], [lenS, fz], [0, fz]], ffill, fenceInner(lenS), { noShade: true, both: true });
					if (se) { sc.push(se.depth, se.svg); }
				});
				var gc = '#2E3135', posts = [];
				if (gateOn) {
					// gate leaf: a darker frame with vertical bars, slightly lower than the fence
					var gi = '<rect x="0" y="0.05" width="1.2" height="' + f(fz - 0.12) + '" fill="none" stroke="' + gc + '" stroke-width="0.06"/>';
					for (var gb = 0.15; gb < 1.15; gb += 0.15) { gi += '<rect x="' + f(gb) + '" y="0.05" width="0.03" height="' + f(fz - 0.12) + '" fill="' + gc + '"/>'; }
					var gl2 = sc.plane([gateX, fy2, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [1.2, 0], [1.2, fz], [0, fz]], 'none', gi, { noShade: true });
					if (gl2) { sc.push(gl2.depth + 50, gl2.svg); }
					posts.push(gateX - 0.12, gateX + 1.2);
				}
				posts.push(Math.max(fx0, dr0 - 0.15) - 0.12, Math.min(fx1, dr1 + 0.15));
				posts.forEach(function (px) {
					var pp = sc.plane([px, fy2, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [0.12, 0], [0.12, fz + 0.1], [0, fz + 0.1]], gc, '', { noShade: true });
					if (pp) { sc.push(pp.depth + 51, pp.svg); }
				});
			}
			// neighbours
			if (c.neighbors) {
				[[left - 9, back + 2], [right + 2, back + 3]].forEach(function (q) {
					var nv = { x0: q[0], x1: q[0] + 8, y0: q[1] - 7, y1: q[1], h: 5.6, ridge: 'x' };
					var npl = { plinth: 0.2, floors: 1, FH: 2.9, pitch: 38, over: 0.4, attic: false };
					var nsc = sc;
					var parts = [];
					var nf = nsc.plane([nv.x0, nv.y1, 0], [1, 0, 0], [0, 0, 1], [[0, 0], [8, 0], [8, 5.6], [0, 5.6]], '#D8D3CB', '');
					if (nf) { parts.push(nf); }
					var nr = nsc.plane([nv.x0 - 0.4, nv.y1 + 0.4, 5.3], [1, 0, 0], norm([0, -0.78, 0.62]), [[0, 0], [8.8, 0], [8.8, 4.9], [0, 4.9]], '#8C5A48');
					if (nr) { parts.push(nr); }
					var ng = group(parts, 0);
					if (ng) { sc.push(ng.depth - 40, '<g opacity="0.55">' + ng.svg + '</g>'); }
					void npl;
				});
			}
		}

		/* compose */
		sc.items.sort(function (a, b) { return a.d - b.d; });
		var pad = mini ? 0.6 : { '24mm': 2.6, '35mm': 1.4, '50mm': 0.5 }[c.lens || '35mm'] || 1.4;
		var vbx = sc.minX - pad, vby = sc.minY - pad * 1.6, vbw = sc.maxX - sc.minX + pad * 2, vbh = sc.maxY - sc.minY + pad * 2.6;
		if (!isFinite(vbx)) { vbx = 0; vby = 0; vbw = 10; vbh = 6; }
		// very wide, flat scenes (frontal camera, wide plot): more sky instead of a letterbox strip
		if (vbw > vbh * 4) { vby -= vbw / 4 - vbh; vbh = vbw / 4; }
		// sky
		var sky = SKY[L.tod];
		var skyTop = c.weather === 'overcast' ? mix(sky[0], '#9AA3AD', 0.65) : sky[0];
		var skyBot = c.weather === 'overcast' ? mix(sky[1], '#C9CED3', 0.6) : sky[1];
		var skyId = sc.def('sky', '<linearGradient id="' + sc.id + 'sky" gradientUnits="userSpaceOnUse" x1="0" y1="' + f(vby) + '" x2="0" y2="' + f(vby + vbh * 0.85) + '"><stop offset="0" stop-color="' + skyTop + '"/><stop offset="1" stop-color="' + skyBot + '"/></linearGradient>');
		var bg = '<rect x="' + f(vbx - vbw) + '" y="' + f(vby - vbh) + '" width="' + f(vbw * 3) + '" height="' + f(vbh * 3) + '" fill="url(#' + skyId + ')"/>';
		if (!mini) {
			if (L.tod === 'night') { var rr = rng(5); for (var st = 0; st < 40; st++) { bg += '<circle cx="' + f(vbx + rr() * vbw) + '" cy="' + f(vby + rr() * vbh * 0.35) + '" r="' + f(0.03 + rr() * 0.05) + '" fill="#FFFFFF" opacity="' + f(0.4 + rr() * 0.6) + '"/>'; } bg += '<circle cx="' + f(vbx + vbw * 0.82) + '" cy="' + f(vby + vbh * 0.14) + '" r="' + f(vbh * 0.04) + '" fill="#F4F1E3"/>'; }
			else if (c.weather !== 'overcast' && (L.tod === 'golden' || L.tod === 'morning')) {
				var sxp = L.tod === 'golden' ? vbx + vbw * 0.86 : vbx + vbw * 0.1, syp = vby + vbh * 0.3;
				var sunId = sc.def('sun', '<radialGradient id="' + sc.id + 'sun"><stop offset="0" stop-color="#FFF6E0" stop-opacity="0.95"/><stop offset="0.18" stop-color="#FFE7BD" stop-opacity="0.7"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient>');
					bg += '<circle cx="' + f(sxp) + '" cy="' + f(syp) + '" r="' + f(vbh * 0.22) + '" fill="url(#' + sunId + ')"/>';
			}
			var nc = { clear: 0, few_clouds: 3, overcast: 7 }[c.weather || 'few_clouds'];
			var cr = rng(9);
			for (var cl = 0; cl < nc; cl++) {
				var cx = vbx + cr() * vbw, cy = vby + vbh * (0.05 + cr() * 0.22), cw = vbw * (0.08 + cr() * 0.1);
				var cc = c.weather === 'overcast' ? '#C4C9CF' : (L.dark ? '#3A4466' : '#FFFFFF');
				bg += '<g opacity="' + (c.weather === 'overcast' ? 0.85 : 0.75) + '"><ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(cw) + '" ry="' + f(cw * 0.22) + '" fill="' + cc + '"/><ellipse cx="' + f(cx - cw * 0.3) + '" cy="' + f(cy - cw * 0.12) + '" rx="' + f(cw * 0.45) + '" ry="' + f(cw * 0.22) + '" fill="' + cc + '"/><ellipse cx="' + f(cx + cw * 0.25) + '" cy="' + f(cy - cw * 0.16) + '" rx="' + f(cw * 0.38) + '" ry="' + f(cw * 0.24) + '" fill="' + cc + '"/></g>';
			}
		}
		var body = slab + groundSvg + horizon + shadowSvg + sc.items.map(function (it) { return it.s; }).join('');
		var tint = L.tintA > 0 ? '<rect x="' + f(vbx - vbw) + '" y="' + f(vby - vbh) + '" width="' + f(vbw * 3) + '" height="' + f(vbh * 3) + '" fill="' + L.tint + '" opacity="' + f(L.tintA * (mini ? 0.5 : 1)) + '" style="mix-blend-mode:multiply"/>' : '';
		if (L.glow && c.night_lighting !== false) {
			// glowing windows above the night tint: re-draw only the glow halo cheaply
			tint += '';
		}
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [vbx, vby, vbw, vbh].map(f).join(' ') + '" preserveAspectRatio="' + (opts.fit || 'xMidYMid meet') + '" role="img" aria-hidden="true">' +
			'<defs>' + sc.defs.join('') + '</defs>' + bg + body + tint + '</svg>';
	}
	// Convex hull (monotone chain) of 2D points.
	function hull(p) {
		p = p.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
		if (p.length < 3) { return p; }
		var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
		var lo = [], up = [];
		p.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) { lo.pop(); } lo.push(q); });
		for (var i = p.length - 1; i >= 0; i--) { var q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) { up.pop(); } up.push(q); }
		up.pop(); lo.pop();
		return lo.concat(up);
	}

	/* ------------------------------------------------------------------ swatches for option cards */
	var INTERIOR = {
		modern_minimal: ['#F4F3F0', '#D9D6D0', '#2B2B2B', '#B9A48A'], luxury: ['#1F1D1B', '#C8A96A', '#EDE6DA', '#6B4E3D'],
		scandinavian: ['#FAFAF7', '#E3DED4', '#C9A97E', '#9DB0A8'], japandi: ['#EDE6DA', '#B8A48A', '#5C4A3A', '#2F2C29'],
		classic: ['#F3EBDD', '#C9B28A', '#7A5C3E', '#3E4A5C'], mediterranean: ['#F5EFE3', '#D9A066', '#2F6F8F', '#8A9A5B'],
		industrial: ['#3A3A3A', '#8C5A3C', '#B9B6B0', '#1E1E1E'], wood_stone: ['#D8CFC2', '#9C7B57', '#7D7A73', '#4B4036'],
		warm_neutral: ['#F2EBE1', '#D7C3A8', '#A88464', '#6E5A4A'], monochrome: ['#FFFFFF', '#BDBDBD', '#5A5A5A', '#121212'],
		custom: ['#E8D9C5', '#9FB4A8', '#C98B6B', '#4F5D75']
	};
	var FLOORS = {
		parquet: { mat: 'planks', c: '#B7865A' }, herringbone: { mat: 'herring', c: '#B07D52' }, laminate: { mat: 'planks', c: '#C9A47A' },
		vinyl: { mat: 'planks', c: '#A79B8C' }, tiles_large: { mat: 'bigtile', c: '#D7D3CC' }, stone: { mat: 'slabs', c: '#CFC3AE' },
		microcement: { mat: 'smooth', c: '#BDB7AE' }, concrete: { mat: 'smooth', c: '#9E9B96' },
		chevron: { mat: 'herring', c: '#BE8D5F' }, wood_tile: { mat: 'planks', c: '#A9825D' }, marble: { mat: 'bigtile', c: '#EEECE8', vein: true },
		travertine: { mat: 'slabs', c: '#D9C9AE' }, terrazzo: { mat: 'terrazzo', c: '#E3DED6' }, tiles: { mat: 'bigtile', c: '#CFCBC4' },
		carpet: { mat: 'smooth', c: '#BBB2A6' }, cork: { mat: 'terrazzo', c: '#B98D5E' }, cement_tiles: { mat: 'cement', c: '#E6E1D8' }
	};
	// Material swatch (facade / floor / roof) as a small square SVG.
	function swatch(kind, value, cfg) {
		var sc = new Scene(cfg || {}, { id: 's' + kind + value });
		var inner = '', w = 3, h = 2;
		if (kind === 'facade') {
			var base = facadeBase(cfg || {}, value);
			var fill = sc.mat(value === 'render' ? 'render' : value, base);
			inner = '<rect width="' + w + '" height="' + h + '" fill="' + fill + '"/>' +
				'<rect x="1.7" y="0.35" width="0.95" height="1.3" fill="#2F3235"/><rect x="1.75" y="0.4" width="0.85" height="1.2" fill="#9EB6C8"/><rect x="1.75" y="0.4" width="0.85" height="0.5" fill="#C9DAE5"/>' +
				'<rect width="' + w + '" height="' + h + '" fill="url(#' + sc.def('vig', '<linearGradient id="' + sc.id + 'vig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient>') + ')"/>';
		} else if (kind === 'floor') {
			var fl = FLOORS[value] || FLOORS.parquet, d = shade(fl.c, -0.22);
			if (fl.mat === 'planks') { for (var r = 0; r < 10; r++) { var off = (r % 3) * 0.7; for (var px = -off; px < 3; px += 1.4) { inner += '<rect x="' + f(px) + '" y="' + f(r * 0.2) + '" width="1.4" height="0.2" fill="' + shade(fl.c, (((r * 7 + Math.round(px * 10)) % 5) - 2) * 0.025) + '" stroke="' + d + '" stroke-width="0.012"/>'; } } }
			else if (fl.mat === 'herring') { for (var hi = 0; hi < 10; hi++) { for (var hy = -0.6; hy < 2.4; hy += 0.14) { var x0 = hi * 0.32, up = hi % 2 === 0; inner += '<polygon points="' + pts(up ? [[x0, hy], [x0 + 0.32, hy + 0.32], [x0 + 0.32, hy + 0.46], [x0, hy + 0.14]] : [[x0, hy + 0.32], [x0 + 0.32, hy], [x0 + 0.32, hy + 0.14], [x0, hy + 0.46]]) + '" fill="' + shade(fl.c, ((Math.round(hy * 50) + hi) % 3 - 1) * 0.035) + '" stroke="' + d + '" stroke-width="0.012"/>'; } } }
			else if (fl.mat === 'bigtile') { inner = '<rect width="3" height="2" fill="' + fl.c + '"/>' + (fl.vein ? '<path d="M0 0.4C0.8 0.6 1.2 0.2 2 0.7S2.6 1.6 3 1.4M0.3 2C0.9 1.4 1.6 1.7 2.2 1.1" stroke="#B9B6B0" stroke-width="0.025" fill="none" opacity="0.7"/>' : '') + '<path d="M0 1H3M1.5 0V2" stroke="' + d + '" stroke-width="0.02"/><rect width="3" height="2" fill="#FFFFFF" opacity="0.08"/>'; }
			else if (fl.mat === 'terrazzo') { inner = '<rect width="3" height="2" fill="' + fl.c + '"/>'; for (var ti = 0; ti < 90; ti++) { var tx = (ti * 0.373) % 3, ty = (ti * 0.619) % 2; inner += '<circle cx="' + f(tx) + '" cy="' + f(ty) + '" r="' + f(0.02 + (ti % 4) * 0.012) + '" fill="' + ['#9A8F84', '#6E7378', '#C9B79C', '#FFFFFF'][ti % 4] + '"/>'; } }
			else if (fl.mat === 'cement') { inner = '<rect width="3" height="2" fill="' + fl.c + '"/>'; for (var ci = 0; ci < 6; ci++) { for (var cj = 0; cj < 4; cj++) { var cx = ci * 0.5 + 0.25, cy = cj * 0.5 + 0.25; inner += '<path d="M' + f(cx) + ' ' + f(cy - 0.2) + 'L' + f(cx + 0.2) + ' ' + f(cy) + 'L' + f(cx) + ' ' + f(cy + 0.2) + 'L' + f(cx - 0.2) + ' ' + f(cy) + 'Z" fill="#3E5A6B"/><circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="0.07" fill="' + fl.c + '"/>'; } } inner += '<path d="M0 0.5H3M0 1H3M0 1.5H3M0.5 0V2M1 0V2M1.5 0V2M2 0V2M2.5 0V2" stroke="' + d + '" stroke-width="0.012"/>'; }
			else if (fl.mat === 'slabs') { inner = '<rect width="3" height="2" fill="' + fl.c + '"/><path d="M0 0.66H3M0 1.33H3M1 0V0.66M2.2 0.66V1.33M0.7 1.33V2M1.9 1.33V2" stroke="' + d + '" stroke-width="0.02"/>'; }
			else { inner = '<rect width="3" height="2" fill="' + fl.c + '"/><ellipse cx="1" cy="0.8" rx="1.4" ry="0.6" fill="#FFFFFF" opacity="0.08"/><ellipse cx="2.3" cy="1.5" rx="0.8" ry="0.3" fill="#000000" opacity="0.05"/>'; }
		}
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' + sc.defs.join('') + '</defs><g transform="matrix(1 0 0 -1 0 2)">' + inner + '</g></svg>';
	}
	function palette(value) {
		var p = INTERIOR[value] || INTERIOR.custom;
		var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
			'<rect width="120" height="80" fill="' + p[0] + '"/><rect y="52" width="120" height="28" fill="' + p[1] + '"/>' +
			'<rect x="16" y="34" width="54" height="16" rx="5" fill="' + p[2] + '"/><rect x="12" y="44" width="62" height="10" rx="4" fill="' + shade(p[2], -0.1) + '"/>' +
			'<rect x="84" y="18" width="2.5" height="34" fill="' + p[3] + '"/><path d="M76 18h18l-5-10h-8z" fill="' + p[3] + '"/>' +
			'<rect x="80" y="54" width="22" height="3" fill="' + p[3] + '"/><circle cx="34" cy="20" r="9" fill="none" stroke="' + p[3] + '" stroke-width="2"/>';
		p.forEach(function (cc, i) { s += '<rect x="' + (6 + i * 12) + '" y="64" width="10" height="10" rx="2" fill="' + cc + '" stroke="#FFFFFF" stroke-width="1"/>'; });
		if (value === 'custom') { s += '<text x="104" y="74" font-size="12" font-family="sans-serif" fill="' + p[3] + '">?</text>'; }
		return s + '</svg>';
	}
	// Small landscape vignette for garden styles / time of day.
	function vignette(kind, value, cfg) {
		var c = {};
		Object.keys(cfg || {}).forEach(function (k) { c[k] = cfg[k]; });
		if (kind === 'garden') { c.garden_style = value; c.garden_features = ['lawn', 'trees', 'paths', 'hedge', 'flowerbeds']; c.fence = 'none'; c.neighbors = false; c.garage = 'none'; c.terrace_area = 0; c.levels = 'single'; c.net_area = 70; c.footprint = 'rectangle'; c.camera = 'elevated'; }
		if (kind === 'time') { c.time_of_day = value; c.weather = 'few_clouds'; }
		c.lens = '24mm';
		return render(c, { id: 'v' + kind + value, mini: false, fit: 'xMidYMid slice', tight: true, plantScale: kind === 'garden' ? 1.7 : 1.2 });
	}

	var VISUAL = ['plot_width', 'plot_length', 'exterior_steps', 'accessible', 'ridge_height', 'eaves_depth', 'snow_guards', 'roof_ventilation', 'exposed_rafters', 'facade_texture', 'property_type', 'levels', 'net_area', 'building_width', 'building_length', 'orientation', 'arch_style', 'massing', 'footprint', 'garage', 'terrace_area', 'balcony', 'entrance_canopy', 'outdoor_covered', 'basement', 'chimney', 'ceiling_height',
		'roof_type', 'roof_pitch', 'roof_overhang', 'gable_finish', 'roof_windows', 'dormers', 'roof_solar', 'gutters', 'roof_product', 'roof_color', 'roof_surface',
		'facade_main', 'facade_color', 'facade_accent', 'facade_accent_color', 'plinth', 'plinth_color', 'facade_ornaments', 'corner_detail', 'exterior_lighting', 'house_number',
		'window_style', 'window_frame_color', 'window_frame_material', 'window_trim', 'window_divided', 'corner_window', 'terrace_door', 'entrance_door', 'entrance_door_color', 'glazing', 'shading',
		'garden_style', 'garden_features', 'terrace_floor', 'driveway', 'fence', 'gate', 'neighbors', 'time_of_day', 'season', 'weather', 'camera', 'lens', 'night_lighting', 'energy',
		'chimney_type', 'solar_type', 'solar_coverage', 'roof_vent_type', 'ridge_tile', 'shutter_color', 'ac_units',
		'balcony_type', 'balcony_place', 'balcony_size', 'solar_place', 'garden_density', 'tree_types', 'vehicles', 'car_color', 'people', 'pets'];

	// Whether changing a parameter shows on the sketch for this configuration (value: the multiselect item
	// that was switched). Used by the tests; the designer itself compares the drawings before and after.
	// Whether switching one item of a multiselect changes the drawing (exact: both drawings are made).
	function toggles(c, id, value) {
		var rest = (Array.isArray(c[id]) ? c[id] : (id === 'vehicles' ? vehicleList(c) : [])).filter(function (x) { return x !== value; });
		var a = Object.assign({}, c), b = Object.assign({}, c);
		a[id] = rest; b[id] = rest.concat([value]);
		return render(a, { id: 'vt_' }) !== render(b, { id: 'vt_' });
	}
	function visibleFor(id, c, value) {
		if (VISUAL.indexOf(id) === -1) { return false; }
		var pitched = c.roof_type !== 'flat', ta = num(c.terrace_area, 0) > 0, acc = c.facade_accent || [];
		switch (id) {
			case 'balcony': return c.levels === 'two' || c.levels === 'three';
			case 'window_trim': return !!trimColor(c);
			case 'massing': return c.property_type !== 'semi_detached' && c.property_type !== 'row';
			case 'footprint': return c.property_type !== 'semi_detached' && c.property_type !== 'row' && (c.massing || 'auto') === 'auto';
			case 'plot_width': return num(c.plot_width, 0) > 0 && num(c.plot_width, 0) <= 60;
			case 'plot_length':
				var pb = siteBox(volumes(c, plan(c)));
				return num(c.plot_width, 0) > 0 && num(c.plot_width, 0) <= 60 && num(c.plot_length, 0) > 0 && num(c.plot_length, 0) < pb.y1 - pb.y0 + 20;
			case 'ridge_height': return ['gable', 'hip', 'half_hip', 'multi', 'complex'].indexOf(c.roof_type || 'gable') !== -1 && num(c.ridge_height, 0) > plan(c).h0 + 0.8;
			case 'eaves_depth': case 'snow_guards': case 'exposed_rafters': return pitched && (id !== 'snow_guards' || c.roof_type !== 'shed');
			case 'roof_ventilation': return pitched && c.roof_type !== 'shed' && c.roof_type !== 'pyramid';
			case 'facade_texture': return (c.facade_main || 'render') === 'render';
			case 'roof_pitch': case 'roof_windows': case 'dormers': case 'gutters': return pitched;
			case 'roof_overhang': return pitched && (num(c.eaves_depth, 0) <= 0 || (['hip', 'pyramid'].indexOf(c.roof_type) === -1 && c.gable_finish !== 'flush'));
			case 'exterior_steps': return !c.basement && !c.accessible;
			case 'roof_color': case 'roof_product': return pitched;
			case 'gable_finish': return ['gable', 'half_hip', 'shed', 'multi', 'complex'].indexOf(c.roof_type) !== -1;
			case 'plinth_color': return !c.plinth || c.plinth === 'dark_render';
			case 'facade_accent_color': return acc.some(function (m) { return m === 'wood' || m === 'metal' || m === 'render_dark'; });
			case 'gate': return !!c.fence && c.fence !== 'none';
			case 'night_lighting': return c.time_of_day === 'night' || c.time_of_day === 'blue';
			case 'terrace_door': case 'terrace_floor': case 'outdoor_covered': return ta;
			case 'arch_style': return c.arch_style !== 'custom' && c.arch_style !== 'modern_minimal';
			case 'chimney_type': return !!c.chimney;
			case 'solar_type': case 'solar_coverage': return !!c.roof_solar && (id === 'solar_type' || (pitched && c.roof_type !== 'shed' && c.roof_type !== 'pyramid'));
			case 'roof_vent_type': return !!c.roof_ventilation && pitched && c.roof_type !== 'shed' && c.roof_type !== 'pyramid';
			case 'ridge_tile': return pitched && c.roof_type !== 'shed';
			case 'shutter_color': return (c.shading || []).some(function (m) { return m === 'shutters' || m === 'spalettas'; });
			case 'ac_units': return true;
			case 'energy': return VISUAL_ENERGY.indexOf(value) !== -1;
			case 'garden_features': return ['robot_mower', 'outdoor_shower', 'irrigation'].indexOf(value) === -1 && !(value === 'garden_lights' && !lightFor(c).glow);
			case 'shading': return value !== 'louvres' || c.levels === 'two' || c.levels === 'three';
			case 'orientation': return c.weather !== 'overcast' && c.time_of_day !== 'night';
			case 'balcony_type': case 'balcony_place': case 'balcony_size':
				var bOn = !!c.balcony && (c.levels === 'two' || c.levels === 'three') && !volumes(c, plan(c)).some(function (q) { return q.balc; });
				if (id === 'balcony_type') { return bOn && (c.balcony_type || 'auto') !== 'auto' && c.balcony_type !== balconyType(Object.assign({}, c, { balcony_type: 'auto' })); }
				if (id === 'balcony_size') { return bOn && c.balcony_place !== 'back' && balconyType(c) !== 'french'; }
				return bOn;
			case 'solar_place':
				var sOn = !!(c.roof_solar || has(c.energy, 'solar') || styleOf(c).pv), sp = c.solar_place || 'auto';
				return sOn && pitched && c.roof_type !== 'shed' && sp !== 'auto' && sp !== solarPlace(Object.assign({}, c, { solar_place: 'auto' }));
			case 'garden_density': return has(c.garden_features, 'trees') || !c.garden_features;
			case 'tree_types': case 'pets': case 'vehicles': return value === undefined || value === null ? true : toggles(c, id, value);
			case 'car_color': return vehicleList(c).length > 0;
			default: return true;
		}
	}

	var api = { render: render, swatch: swatch, palette: palette, vignette: vignette, visual: VISUAL, visibleFor: visibleFor, plan: plan,
		// shared with the 3D preview (assets/js/agh-3d.js): same plan, volumes and roof geometry
		_volumes: volumes, _style: styleOf, _door: doorPos, _win: windowSpec, _fenceSegs: fenceSegs, _facadeBase: facadeBase, _roof: roofFor,
		_shutter: shutterColor, _roofLayout: roofLayout, _solar: solarSpec, _solarFaces: solarFaces, _balconies: balconies, _balcMark: balcMark, _vehicles: vehicleList, _roomsOf: roomsOf, _roomItems: roomItems, _mainRoom: mainRoom, _balconyType: balconyType, _chimney: chimneySpec, _ridge: ridgeSpec, _pool: poolRect,
		_vtype: vtype, _vplan: vplan, _round: roundR, _front: frontPlan, _siteBox: siteBox, _entrance: entranceAt, _terrace: terraceRect, _avoid: siteAvoid, _siteEdge: siteEdge, _plot: plotRect, _garden: gardenLayout, _trim: trimColor, _interior: INTERIOR, _roundPts: roundPts, massing: MASSING };
	root.AGH_Sketch = api;
	if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
}(typeof window !== 'undefined' ? window : this));
