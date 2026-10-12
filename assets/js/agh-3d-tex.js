/*!
 * AutoGroweHome – procedural PBR textures for the 3D preview.
 * Koltai Norbert – Infostudio
 *
 * Every material is generated in the browser (no downloads): a tileable height field and albedo per
 * material type, from which a colour map, a normal map and a roughness map are built. Results are
 * cached by key. Sizes are in metres: the generator returns the tile size so the scene can map
 * texture coordinates in metres.
 */
import * as THREE from './vendor/three/three.module.min.js';

/* ------------------------------------------------------------------ noise */
function hash2(x, y, s) {
	var h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
	h = (h ^ (h >>> 13)) * 1274126177 | 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// Tileable value noise with period p (cells), smooth interpolation.
function vnoise(x, y, p, s) {
	var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
	var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
	var x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
	var a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fbm over a unit tile (u, v in 0..1), base period p cells, oct octaves.
function fbm(u, v, p, oct, s) {
	var t = 0, amp = 0.5, n = 0, f = p;
	for (var i = 0; i < oct; i++) { t += vnoise(u * f, v * f, f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
	return t / n;
}
// Tileable Worley (cellular): returns [F1, F2, cellId] for points scattered on a p×p grid.
function worley(u, v, p, s, jitter) {
	var x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), f1 = 9, f2 = 9, id = 0;
	jitter = jitter === undefined ? 0.85 : jitter;
	for (var j = -1; j <= 1; j++) {
		for (var i = -1; i <= 1; i++) {
			var cx = xi + i, cy = yi + j, wx = ((cx % p) + p) % p, wy = ((cy % p) + p) % p;
			var px = cx + 0.5 + (hash2(wx, wy, s) - 0.5) * jitter, py = cy + 0.5 + (hash2(wx, wy, s + 7) - 0.5) * jitter;
			var d = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
			if (d < f1) { f2 = f1; f1 = d; id = wx + wy * p; } else if (d < f2) { f2 = d; }
		}
	}
	return [f1, f2, id];
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function hex(c) { c = /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#888888'; return [parseInt(c.substr(1, 2), 16) / 255, parseInt(c.substr(3, 2), 16) / 255, parseInt(c.substr(5, 2), 16) / 255]; }
function jit(rgb, k, r) { var m = 1 + (r - 0.5) * k; return [rgb[0] * m, rgb[1] * m, rgb[2] * m]; }
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function hueJit(rgb, r, k) { var d = (r - 0.5) * k; return [rgb[0] * (1 + d), rgb[1], rgb[2] * (1 - d)]; }

/* ------------------------------------------------------------------ generators
 * Each returns { tw, th (metres), w, h (px), fn(u, v) → [r, g, b, height, rough, alpha?] }.
 * u, v are 0..1 across the tile, v = 0 at the bottom.
 */
var GEN = {
	render: function (o) {
		var base = hex(o.color), coarse = o.texture === 'coarse' ? 1 : (o.texture === 'smooth' ? 0.15 : 0.5);
		return { tw: 1.5, th: 1.5, w: 512, h: 512, fn: function (u, v) {
			var n = fbm(u, v, 24, 4, 3), g = fbm(u, v, 96, 2, 9), blot = fbm(u, v, 3, 3, 21);
			var k = 1 + (blot - 0.5) * 0.06 + (n - 0.5) * 0.05 * coarse;
			return [base[0] * k, base[1] * k, base[2] * k, n * 0.4 * coarse + g * 0.6 * coarse, 0.86 + g * 0.1];
		} };
	},
	brick: function (o) {
		var base = hex(o.color || '#A4553A'), mortar = hex(o.mortar || '#CFC8BC'), long = o.kind === 'clinker';
		var cols = long ? 2 : 4, rows = long ? 20 : 14, bw = 1 / cols, rh = 1 / rows, jw = long ? 0.012 : 0.009, jh = long ? 0.015 : 0.0095;
		return { tw: long ? 1.04 : 1.04, th: long ? 1.0 : 1.05, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v / rh), off = (row % 2) * bw * 0.5, x = (u + off) % 1, col = Math.floor(x / bw);
			var lx = x - col * bw, ly = v - row * rh, r = hash2(col, row, 5), r2 = hash2(col, row, 6);
			var edge = Math.min(lx, bw - lx, ly * (bw / rh) * 0.25 + 1, (rh - ly) * (bw / rh) * 0.25 + 1);
			var inM = lx < jw || ly < jh;
			var n = fbm(u, v, 64, 3, 2);
			if (inM) { var mm = 0.9 + n * 0.2; return [mortar[0] * mm, mortar[1] * mm, mortar[2] * mm, 0.05 + n * 0.1, 0.95]; }
			var c = hueJit(jit(base, long ? 0.35 : 0.42, r), r2, 0.18);
			var burn = smooth(0.5, 0.95, fbm(u * 3, v, 8, 2, 33 + col)) * 0.25;
			c = mixc(c, [c[0] * 0.55, c[1] * 0.5, c[2] * 0.5], burn);
			var hgt = 0.75 + smooth(0, 0.012, Math.min(lx - jw, ly - jh)) * 0.2 + n * 0.08;
			return [c[0] * (0.92 + n * 0.16), c[1] * (0.92 + n * 0.16), c[2] * (0.92 + n * 0.16), hgt, 0.78 + n * 0.15];
		} };
	},
	stone: function (o) {
		var base = hex(o.color || '#BDAE97'), mortar = hex('#8F877A');
		return { tw: 2.4, th: 2.4, w: 512, h: 512, fn: function (u, v) {
			var w = worley(u * 1.6 % 1, v, 6, 11, 0.9), wx = worley(u, v * 1.6 % 1, 6, 12, 0.9);
			void wx;
			var d = w[1] - w[0], r = hash2(w[2], 1, 3), n = fbm(u, v, 32, 4, 7);
			if (d < 0.07) { return [mortar[0] * (0.9 + n * 0.2), mortar[1] * (0.9 + n * 0.2), mortar[2] * (0.9 + n * 0.2), d * 2, 0.95]; }
			var c = hueJit(jit(base, 0.38, r), hash2(w[2], 2, 4), 0.2);
			var k = 0.88 + n * 0.25;
			return [c[0] * k, c[1] * k, c[2] * k, 0.45 + smooth(0.07, 0.25, d) * 0.4 + n * 0.25, 0.7 + n * 0.2];
		} };
	},
	wood: function (o) {
		var base = hex(o.color || '#A8744A'), boards = 6;
		return { tw: 0.9, th: 2.4, w: 512, h: 1024, fn: function (u, v) {
			var b = Math.floor(u * boards), lx = u * boards - b, r = hash2(b, 0, 8);
			var grain = fbm(u * 0.15 + b * 0.37, v, 48, 4, 3 + b) ;
			var ring = Math.sin((grain * 9 + lx * 3 + r * 6) * Math.PI) * 0.5 + 0.5;
			var c = hueJit(jit(base, 0.3, r), hash2(b, 1, 8), 0.12);
			var k = 0.82 + ring * 0.2 + (grain - 0.5) * 0.15;
			var gap = lx < 0.035 ? 1 : 0;
			if (gap) { return [c[0] * 0.25, c[1] * 0.22, c[2] * 0.2, 0, 0.9]; }
			return [c[0] * k, c[1] * k, c[2] * k, 0.75 + ring * 0.1 - smooth(0.9, 1, lx) * 0.2, 0.62 + grain * 0.25];
		} };
	},
	seam: function (o) {
		var base = hex(o.color || '#5E6266');
		return { tw: 1.0, th: 1.0, w: 512, h: 256, fn: function (u, v) {
			var lx = (u * 2) % 1, rib = Math.exp(-Math.pow((lx - 0.96) / 0.018, 2)), n = fbm(u, v, 16, 3, 4);
			var k = 0.95 + n * 0.08 + rib * 0.15;
			return [base[0] * k, base[1] * k, base[2] * k, rib + n * 0.03, 0.42 + n * 0.12];
		} };
	},
	concrete: function (o) {
		var base = hex(o.color || '#B6B3AD');
		return { tw: 2.4, th: 1.2, w: 512, h: 256, fn: function (u, v) {
			var lx = (u * 2) % 1, joint = lx < 0.006 || v < 0.012 ? 1 : 0;
			var n = fbm(u, v, 12, 5, 4), pores = vnoise(u * 300, v * 150, 300, 9) > 0.93 ? 1 : 0;
			var tie = 0; [0.25, 0.75].forEach(function (cx) { [0.25, 0.75].forEach(function (cy) { var dx = (lx - cx) * 2.4 * 2, dy = (v - cy) * 1.2; if (dx * dx + dy * dy < 0.0007) { tie = 1; } }); });
			var k = 0.86 + n * 0.22 - pores * 0.12 - tie * 0.35;
			return [base[0] * k, base[1] * k, base[2] * k, joint || tie ? 0.1 : 0.7 + n * 0.1 - pores * 0.2, 0.86];
		} };
	},
	panel: function (o) {
		var base = hex(o.color || '#D9D5CE');
		return { tw: 3.0, th: 1.5, w: 512, h: 256, fn: function (u, v) {
			var lx = (u * 2) % 1, joint = lx < 0.008 || v < 0.016 ? 1 : 0, n = fbm(u, v, 24, 3, 5);
			var k = 0.95 + n * 0.08;
			return joint ? [base[0] * 0.4, base[1] * 0.4, base[2] * 0.4, 0, 0.9] : [base[0] * k, base[1] * k, base[2] * k, 0.8, 0.7];
		} };
	},
	tiles: function (o) { // roof: profiled (Roman) tile
		var base = hex(o.color || '#3A3D40'), cols = 4, rows = 3;
		return { tw: 1.2, th: 1.14, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v * rows), ly = v * rows - row, x = (u * cols) % 1, col = Math.floor(u * cols), r = hash2(col, row, 3);
			var wave = Math.sin(x * Math.PI * 2) * 0.5 + 0.5;
			var lap = smooth(0.0, 0.12, ly);
			var hgt = wave * 0.55 + lap * 0.35 + (1 - ly) * 0.1;
			var n = fbm(u, v, 32, 3, 8);
			var c = jit(base, 0.22, r), k = (0.7 + wave * 0.35) * (0.6 + lap * 0.4) * (0.94 + n * 0.12);
			return [c[0] * k, c[1] * k, c[2] * k, hgt, 0.55 + n * 0.25 - wave * 0.1];
		} };
	},
	flattile: function (o) {
		var base = hex(o.color || '#3A3D40'), big = o.kind !== 'flattile2';
		var cols = big ? 3 : 4, rows = big ? 3 : 4;
		return { tw: big ? 1.0 : 1.0, th: big ? 1.0 : 1.0, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v * rows), ly = v * rows - row, off = (row % 2) * 0.5 / cols, x = (u + off) % 1, col = Math.floor(x * cols), lx = x * cols - col;
			var r = hash2(col, row, 4), n = fbm(u, v, 32, 3, 9);
			var lap = smooth(0, 0.08, ly), joint = lx < 0.02 ? 1 : 0;
			var c = jit(base, 0.16, r), k = (0.65 + lap * 0.38) * (0.95 + n * 0.1) * (joint ? 0.6 : 1);
			return [c[0] * k, c[1] * k, c[2] * k, lap * 0.8 + (joint ? 0 : 0.15), 0.5 + n * 0.25];
		} };
	},
	slate: function (o) {
		var base = hex(o.color || '#4A4D50'), cols = 3, rows = 5;
		return { tw: 1.2, th: 1.0, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v * rows), ly = v * rows - row, off = (row % 2) * 0.5 / cols, x = (u + off) % 1, col = Math.floor(x * cols), lx = x * cols - col;
			var r = hash2(col, row, 6), n = fbm(u, v, 48, 4, 3);
			var lap = smooth(0, 0.1, ly), joint = lx < 0.015 ? 1 : 0;
			var c = jit(base, 0.2, r), k = (0.7 + lap * 0.32) * (0.9 + n * 0.2) * (joint ? 0.55 : 1);
			return [c[0] * k, c[1] * k, c[2] * k, lap * 0.7 + n * 0.1, 0.62 + n * 0.2];
		} };
	},
	shingle: function (o) {
		var base = hex(o.color || '#3A3D40'), cols = 3, rows = 7;
		return { tw: 1.0, th: 1.0, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v * rows), ly = v * rows - row, off = (row % 2) * 0.5 / cols, x = (u + off) % 1, col = Math.floor(x * cols), lx = x * cols - col;
			var g = vnoise(u * 220, v * 220, 220, 4), r = hash2(col, row, 7);
			var c = jit(base, 0.18, r), k = (0.7 + smooth(0, 0.15, ly) * 0.3) * (0.8 + g * 0.4) * (lx < 0.01 ? 0.5 : 1);
			return [c[0] * k, c[1] * k, c[2] * k, smooth(0, 0.15, ly) * 0.6 + g * 0.3, 0.9];
		} };
	},
	green: function () { // sedum roof / meadow patch
		return { tw: 2, th: 2, w: 512, h: 512, fn: function (u, v) {
			var w = worley(u, v, 40, 3, 1), n = fbm(u, v, 16, 4, 5), r = hash2(w[2], 0, 9);
			var cols = [[0.36, 0.48, 0.2], [0.5, 0.58, 0.25], [0.62, 0.5, 0.28], [0.3, 0.42, 0.22], [0.66, 0.42, 0.36]];
			var c = cols[Math.floor(r * cols.length)], k = (0.75 + (1 - w[0]) * 0.35) * (0.85 + n * 0.3);
			return [c[0] * k, c[1] * k, c[2] * k, 1 - w[0] + n * 0.3, 0.95];
		} };
	},
	gravel: function (o) {
		var base = hex(o.color || '#A9A49B');
		return { tw: 1, th: 1, w: 512, h: 512, fn: function (u, v) {
			var w = worley(u, v, 34, 5, 1), r = hash2(w[2], 3, 1), n = fbm(u, v, 64, 2, 2);
			var pebble = smooth(0.0, 0.5, 0.55 - w[0]);
			var c = jit(base, 0.5, r), k = (0.55 + pebble * 0.6) * (0.9 + n * 0.2);
			return [c[0] * k, c[1] * k, c[2] * k, pebble, 0.8 - pebble * 0.2];
		} };
	},
	grass: function (o) {
		var s = o.season || 'summer';
		var pal = { spring: [[0.34, 0.46, 0.2], [0.47, 0.56, 0.27]], summer: [[0.26, 0.35, 0.16], [0.41, 0.47, 0.24]], autumn: [[0.38, 0.4, 0.2], [0.52, 0.49, 0.28]], winter: [[0.88, 0.9, 0.93], [0.97, 0.98, 1.0]] }[s] || [[0.26, 0.35, 0.16], [0.41, 0.47, 0.24]];
		var dry = o.dry ? 0.35 : 0;
		return { tw: 4, th: 4, w: 1024, h: 1024, fn: function (u, v) {
			var blades = vnoise(u * 600, v * 140, 600, 3) * 0.6 + vnoise(u * 300, v * 900, 300, 6) * 0.4;
			var patch = fbm(u, v, 6, 4, 11), fine = fbm(u, v, 128, 2, 4);
			var c = mixc(pal[0], pal[1], clamp(blades * 0.8 + patch * 0.5 - 0.2, 0, 1));
			if (dry) { c = mixc(c, [0.62, 0.55, 0.32], dry * smooth(0.45, 0.8, patch)); }
			if (s !== 'winter' && fine > 0.78) { c = mixc(c, [0.18, 0.28, 0.1], 0.5); }
			var k = 0.8 + blades * 0.35;
			return [c[0] * k, c[1] * k, c[2] * k, blades * 0.8 + patch * 0.2, s === 'winter' ? 0.55 : 0.92];
		} };
	},
	snow: function () {
		return { tw: 4, th: 4, w: 512, h: 512, fn: function (u, v) {
			var n = fbm(u, v, 8, 5, 3), sp = vnoise(u * 400, v * 400, 400, 2) > 0.97 ? 1 : 0;
			var k = 0.9 + n * 0.1;
			return [0.93 * k, 0.95 * k, 0.99 * k, n, sp ? 0.15 : 0.6];
		} };
	},
	soil: function () {
		return { tw: 2, th: 2, w: 256, h: 256, fn: function (u, v) {
			var n = fbm(u, v, 16, 5, 4), st = worley(u, v, 20, 2, 1)[0] < 0.12 ? 1 : 0;
			var c = st ? [0.5, 0.47, 0.42] : [0.32, 0.24, 0.17];
			var k = 0.8 + n * 0.4;
			return [c[0] * k, c[1] * k, c[2] * k, n + st * 0.5, 0.95];
		} };
	},
	pavers: function (o) {
		var base = hex(o.color || '#B4ADA2');
		return { tw: 1.2, th: 1.2, w: 512, h: 512, fn: function (u, v) {
			// herringbone-like running bond of 0.2 × 0.1 m pavers
			var rows = 12, row = Math.floor(v * rows), ly = v * rows - row, off = (row % 2) * 0.5 / 6, x = (u + off) % 1, col = Math.floor(x * 6), lx = x * 6 - col;
			var r = hash2(col, row, 2), n = fbm(u, v, 64, 3, 3), joint = lx < 0.03 || ly < 0.06;
			var c = jit(base, 0.22, r), k = joint ? 0.55 : (0.9 + n * 0.15);
			return [c[0] * k, c[1] * k, c[2] * k, joint ? 0 : 0.7 + n * 0.2 - smooth(0.85, 1, Math.max(lx, ly)) * 0.2, joint ? 0.95 : 0.8];
		} };
	},
	slabs: function (o) {
		var base = hex(o.color || '#C9C2B6');
		return { tw: 1.8, th: 1.8, w: 512, h: 512, fn: function (u, v) {
			var rows = 3, row = Math.floor(v * rows), ly = v * rows - row, off = (row % 2) * 0.25, x = (u + off) % 1, col = Math.floor(x * 2), lx = x * 2 - col;
			var r = hash2(col, row, 3), n = fbm(u, v, 24, 4, 6), joint = lx < 0.008 || ly < 0.012;
			var c = jit(base, 0.12, r), k = joint ? 0.55 : (0.9 + n * 0.16);
			return [c[0] * k, c[1] * k, c[2] * k, joint ? 0 : 0.8 + n * 0.15, 0.82];
		} };
	},
	deck: function (o) {
		var base = hex(o.color || '#A97B52'), boards = 7;
		return { tw: 1.0, th: 2.4, w: 256, h: 512, fn: function (u, v) {
			var b = Math.floor(u * boards), lx = u * boards - b, r = hash2(b, 3, 3), seg = Math.floor(v * 2 + r), grain = fbm(u * 0.2 + b, v, 32, 3, b);
			var c = jit(base, 0.25, hash2(b, seg, 5)), k = lx < 0.06 ? 0.25 : (0.85 + grain * 0.25);
			return [c[0] * k, c[1] * k, c[2] * k, lx < 0.06 ? 0 : 0.8 + grain * 0.1, 0.7];
		} };
	},
	asphalt: function () {
		return { tw: 2, th: 2, w: 512, h: 512, fn: function (u, v) {
			var n = fbm(u, v, 128, 2, 4), w = worley(u, v, 90, 1, 1)[0];
			var k = 0.24 + n * 0.08 + (w < 0.15 ? 0.06 : 0);
			return [k, k, k * 1.03, n, 0.88];
		} };
	},
	sand: function () {
		return { tw: 2, th: 2, w: 256, h: 256, fn: function (u, v) { var n = fbm(u, v, 64, 3, 5); var k = 0.85 + n * 0.2; return [0.82 * k, 0.74 * k, 0.56 * k, n, 0.95]; } };
	},
	bark: function () {
		return { tw: 0.6, th: 1.2, w: 256, h: 512, fn: function (u, v) {
			var n = fbm(u * 1, v * 0.3, 16, 4, 3), ridge = Math.abs(Math.sin((u * 10 + n * 3) * Math.PI));
			var k = 0.5 + ridge * 0.35 + n * 0.2;
			return [0.36 * k, 0.29 * k, 0.23 * k, ridge, 0.95];
		} };
	},
	hedge: function (o) {
		var s = o.season || 'summer', c0 = s === 'autumn' ? [0.36, 0.38, 0.14] : (s === 'winter' ? [0.24, 0.3, 0.2] : [0.17, 0.3, 0.1]);
		return { tw: 1, th: 1, w: 512, h: 512, fn: function (u, v) {
			var w = worley(u, v, 30, 4, 1), r = hash2(w[2], 1, 4), leaf = smooth(0.55, 0.05, w[0]);
			var c = jit(c0, 0.5, r), k = 0.35 + leaf * 0.9;
			return [c[0] * k, c[1] * k, c[2] * k, leaf, 0.8];
		} };
	},
	solar: function () {
		return { tw: 1.12, th: 1.75, w: 256, h: 512, fn: function (u, v) {
			var cx = (u * 6) % 1, cy = (v * 10) % 1, line = cx < 0.04 || cy < 0.025 ? 1 : 0, bus = Math.abs(cx - 0.5) < 0.012 ? 1 : 0;
			var frame = u < 0.02 || u > 0.98 || v < 0.012 || v > 0.988;
			if (frame) { return [0.75, 0.77, 0.8, 1, 0.3]; }
			var k = line ? 0.55 : 1;
			return bus ? [0.5, 0.52, 0.56, 0.6, 0.3] : [0.05 * k + 0.02, 0.08 * k + 0.02, 0.16 * k + 0.03, 0.5, 0.18];
		} };
	},
	louvre: function (o) {
		var base = hex(o.color || '#3E4245');
		return { tw: 0.6, th: 0.6, w: 128, h: 128, fn: function (u, v) { var ly = (v * 10) % 1, k = 0.65 + ly * 0.45; return [base[0] * k, base[1] * k, base[2] * k, ly, 0.6]; } };
	},
	garagedoor: function (o) {
		var base = hex(o.color || '#3A3D40');
		return { tw: 2.5, th: 2.25, w: 256, h: 256, fn: function (u, v) { var ly = (v * 5) % 1, g = ly < 0.04 ? 0.6 : 1, n = fbm(u, v, 16, 2, 3); var k = g * (0.95 + n * 0.08); return [base[0] * k, base[1] * k, base[2] * k, ly < 0.04 ? 0 : 0.8, 0.45]; } };
	},
	water: function () {
		return { tw: 3, th: 3, w: 256, h: 256, fn: function (u, v) { var n = fbm(u, v, 8, 4, 2); return [0.12, 0.45 + n * 0.08, 0.6 + n * 0.1, n, 0.04]; } };
	},
	cloud: function () {
		return { tw: 1, th: 1, w: 256, h: 128, fn: function (u, v) {
			var dx = (u - 0.5) * 2, dy = (v - 0.4) * 3.2, r = Math.sqrt(dx * dx + dy * dy);
			var n = fbm(u, v, 6, 5, 4), a = clamp((1 - r) * 1.6 + (n - 0.5) * 1.2, 0, 1) * smooth(0.0, 0.25, v);
			var k = 0.92 + v * 0.08;
			return [k, k, k * 1.01, 0, 1, a];
		}, alpha: true, noTile: true };
	},
	// Foliage card: a cluster of leaves on transparent background.
	leaves: function (o) {
		var s = o.season || 'summer', kind = o.kind || 'broad';
		var pal = {
			spring: [[0.48, 0.66, 0.3], [0.62, 0.76, 0.38]], summer: [[0.3, 0.45, 0.17], [0.47, 0.6, 0.26]],
			autumn: [[0.75, 0.38, 0.1], [0.86, 0.6, 0.18]], winter: [[0.42, 0.38, 0.34], [0.55, 0.5, 0.45]]
		}[s];
		if (kind === 'conifer') { pal = [[0.16, 0.28, 0.15], [0.26, 0.4, 0.22]]; }
		if (kind === 'olive') { pal = [[0.4, 0.45, 0.33], [0.55, 0.6, 0.45]]; }
		if (kind === 'lavender') { pal = s === 'summer' ? [[0.45, 0.38, 0.65], [0.55, 0.48, 0.75]] : [[0.4, 0.46, 0.34], [0.5, 0.56, 0.42]]; }
		var blossom = o.blossom ? (s === 'spring' ? [0.97, 0.82, 0.88] : [0.85, 0.2, 0.12]) : null;
		var n = kind === 'conifer' ? 70 : 46, leaves = [];
		for (var i = 0; i < n; i++) {
			var a = hash2(i, 1, 9) * Math.PI * 2, rr = Math.sqrt(hash2(i, 2, 9)) * 0.42;
			leaves.push({ x: 0.5 + Math.cos(a) * rr, y: 0.5 + Math.sin(a) * rr, ang: hash2(i, 3, 9) * Math.PI, sz: kind === 'conifer' ? 0.05 : (0.06 + hash2(i, 4, 9) * 0.05), c: mixc(pal[0], pal[1], hash2(i, 5, 9)), bl: blossom && hash2(i, 6, 9) > 0.86 });
		}
		return { tw: 1, th: 1, w: 256, h: 256, alpha: true, noTile: true, fn: function (u, v) {
			for (var i = leaves.length - 1; i >= 0; i--) {
				var L = leaves[i], dx = u - L.x, dy = v - L.y, ca = Math.cos(L.ang), sa = Math.sin(L.ang);
				var lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
				var e = kind === 'conifer' ? (lx * lx) / (L.sz * L.sz) + (ly * ly) / (0.006 * 0.006) : (lx * lx) / (L.sz * L.sz) + (ly * ly) / (L.sz * L.sz * 0.22);
				if (e < 1) {
					var c = L.bl ? blossom : L.c, k = 0.75 + (1 - e) * 0.3 + (lx / L.sz) * 0.1;
					if (Math.abs(ly) < L.sz * 0.03 && kind !== 'conifer') { k *= 0.8; }
					return [c[0] * k, c[1] * k, c[2] * k, 1 - e, 0.7, 1];
				}
			}
			return [0, 0, 0, 0, 1, 0];
		} };
	}
};

/* ------------------------------------------------------------------ build textures */
var CACHE = {};
var maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n || 8; }

function toTexture(canvas, srgb) {
	var t = new THREE.CanvasTexture(canvas);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = maxAniso;
	if (srgb) { t.colorSpace = THREE.SRGBColorSpace; }
	t.needsUpdate = true;
	return t;
}
function canvasOf(w, h) {
	if (typeof OffscreenCanvas !== 'undefined' && false) { return new OffscreenCanvas(w, h); }
	var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
// Returns { map, normalMap, roughnessMap, tw, th, alpha } for a material spec.
export function texture(kind, opts) {
	opts = opts || {};
	var key = kind + '|' + JSON.stringify(opts);
	if (CACHE[key]) { return CACHE[key]; }
	var g = GEN[kind](opts), w = g.w, h = g.h, N = w * h;
	var hgt = new Float32Array(N), col = document.createElement ? canvasOf(w, h) : null;
	var ctx = col.getContext('2d'), img = ctx.createImageData(w, h), rc = canvasOf(w, h), rctx = rc.getContext('2d'), rimg = rctx.createImageData(w, h);
	for (var y = 0; y < h; y++) {
		var v = 1 - (y + 0.5) / h;
		for (var x = 0; x < w; x++) {
			var u = (x + 0.5) / w, o = g.fn(u, v), i = y * w + x, p = i * 4;
			img.data[p] = clamp(o[0], 0, 1) * 255; img.data[p + 1] = clamp(o[1], 0, 1) * 255; img.data[p + 2] = clamp(o[2], 0, 1) * 255;
			img.data[p + 3] = g.alpha ? clamp(o[5] === undefined ? 1 : o[5], 0, 1) * 255 : 255;
			hgt[i] = o[3];
			var r = clamp(o[4], 0, 1) * 255;
			rimg.data[p] = r; rimg.data[p + 1] = r; rimg.data[p + 2] = r; rimg.data[p + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	rctx.putImageData(rimg, 0, 0);
	// normal map from the height field (wraps around for tileable textures)
	var nc = canvasOf(w, h), nctx = nc.getContext('2d'), nimg = nctx.createImageData(w, h), s = opts.normalStrength || 3;
	for (var yy = 0; yy < h; yy++) {
		for (var xx = 0; xx < w; xx++) {
			var xl = (xx - 1 + w) % w, xr = (xx + 1) % w, yu = (yy - 1 + h) % h, yd = (yy + 1) % h;
			var dx = (hgt[yy * w + xr] - hgt[yy * w + xl]) * s, dy = (hgt[yd * w + xx] - hgt[yu * w + xx]) * s;
			var nx = -dx, ny = dy, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz), q = (yy * w + xx) * 4;
			nimg.data[q] = (nx / l * 0.5 + 0.5) * 255; nimg.data[q + 1] = (ny / l * 0.5 + 0.5) * 255; nimg.data[q + 2] = (nz / l * 0.5 + 0.5) * 255; nimg.data[q + 3] = 255;
		}
	}
	nctx.putImageData(nimg, 0, 0);
	var res = { map: toTexture(col, true), normalMap: toTexture(nc, false), roughnessMap: toTexture(rc, false), tw: g.tw, th: g.th, alpha: !!g.alpha, noTile: !!g.noTile };
	if (g.noTile) { [res.map, res.normalMap, res.roughnessMap].forEach(function (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }); }
	[res.map, res.normalMap, res.roughnessMap].forEach(function (t) { t.repeat.set(1 / g.tw, 1 / g.th); });
	CACHE[key] = res;
	return res;
}
export function textureCacheSize() { return Object.keys(CACHE).length; }
