/*!
 * AutoGroweHome – procedural texture generators (pure JavaScript, no DOM, no three.js).
 * Koltai Norbert – Infostudio
 *
 * Shared by the main thread and the texture worker (agh-3d-texw.js). bake() returns the colour,
 * normal and roughness pixels of one material as RGBA byte arrays, rows from v = 0 (bottom) up,
 * ready for a THREE.DataTexture.
 */
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
		var base = hex(o.color || '#A4553A'), mortar = hex(o.mortar || '#CFC8BC'), long = o.kind === 'clinker', lime = o.kind === 'lime';
		var cols = long ? 2 : 4, rows = long ? 20 : 14, bw = 1 / cols, rh = 1 / rows, jw = long ? 0.012 : 0.009, jh = long ? 0.015 : 0.0095;
		return { tw: long ? 1.04 : 1.04, th: long ? 1.0 : 1.05, w: 512, h: 512, fn: function (u, v) {
			var row = Math.floor(v / rh), off = (row % 2) * bw * 0.5, x = (u + off) % 1, col = Math.floor(x / bw);
			var lx = x - col * bw, ly = v - row * rh, r = hash2(col, row, 5), r2 = hash2(col, row, 6);
			var edge = Math.min(lx, bw - lx, ly * (bw / rh) * 0.25 + 1, (rh - ly) * (bw / rh) * 0.25 + 1);
			var inM = lx < jw || ly < jh;
			var n = fbm(u, v, 64, 3, 2);
			if (inM) { var mm = 0.9 + n * 0.2; return [mortar[0] * mm, mortar[1] * mm, mortar[2] * mm, 0.05 + n * 0.1, 0.95]; }
			var c = hueJit(jit(base, lime ? 0.08 : (long ? 0.35 : 0.42), r), r2, lime ? 0.03 : 0.18);
			var burn = lime ? 0 : smooth(0.5, 0.95, fbm(u * 3, v, 8, 2, 33 + col)) * 0.25;
			if (lime) { var show = smooth(0.62, 0.9, fbm(u * 2, v * 2, 6, 3, 51)) * 0.35; c = mixc(c, [0.62, 0.36, 0.28], show); }
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
	// horizontal lap siding: overlapping boards with a shadow line under each board
	woodh: function (o) {
		var base = hex(o.color || '#B07E52'), rows = 12;
		return { tw: 3.0, th: 1.8, w: 1024, h: 512, fn: function (u, v) {
			var row = Math.floor(v * rows), ly = v * rows - row, seg = Math.floor((u + hash2(row, 2, 4) * 0.7) * 2.2), r = hash2(seg, row, 5);
			var grain = fbm(u * 3 + r, v * 0.2 + row * 0.13, 64, 4, 11 + seg);
			var c = hueJit(jit(base, 0.26, r), hash2(seg, row, 6), 0.1);
			var k = 0.84 + (Math.sin((grain * 14 + r * 5) * Math.PI) * 0.5 + 0.5) * 0.12 + (grain - 0.5) * 0.12;
			var lap = smooth(0, 0.16, ly), shadow = 1 - (1 - smooth(0, 0.07, ly)) * 0.55;
			var butt = Math.abs(((u + hash2(row, 2, 4) * 0.7) * 2.2) % 1) < 0.006 ? 0.45 : 1;
			k *= shadow * butt;
			return [c[0] * k, c[1] * k, c[2] * k, 0.35 + lap * 0.5 + ly * 0.15, 0.6 + grain * 0.25];
		} };
	},
	// painted board-and-batten: wide boards, narrow raised battens over the joints
	batten: function (o) {
		var base = hex(o.color || '#F4F4F2');
		return { tw: 1.2, th: 2.4, w: 512, h: 1024, fn: function (u, v) {
			var lx = (u * 3) % 1, n = fbm(u, v, 24, 3, 7), g = fbm(u * 0.3, v * 3, 32, 3, 9);
			var bat = smooth(0.84, 0.86, lx) * (1 - smooth(0.98, 1, lx)), edge = Math.exp(-Math.pow((lx - 0.85) / 0.008, 2)) + Math.exp(-Math.pow((lx - 0.99) / 0.008, 2));
			var k = 0.95 + n * 0.05 + (g - 0.5) * 0.04 - edge * 0.18 + bat * 0.03;
			return [base[0] * k, base[1] * k, base[2] * k, 0.4 + bat * 0.5 + g * 0.05, 0.72 + n * 0.1];
		} };
	},
	// charred timber (shou sugi ban): near-black boards with a cracked "alligator" surface and silver sheen
	charred: function (o) {
		var base = hex(o.color || '#2A2522'), boards = 7;
		return { tw: 1.05, th: 2.4, w: 512, h: 1024, fn: function (u, v) {
			var b = Math.floor(u * boards), lx = u * boards - b, r = hash2(b, 0, 13);
			var w = worley((u * boards % 1) * 0.5 + b * 0.5 % 1, v, 10, 17 + b, 0.95), crack = smooth(0.0, 0.06, w[1] - w[0]);
			var grain = fbm(u * 0.2 + b * 0.3, v, 40, 4, 5 + b), sheen = smooth(0.55, 0.9, grain) * 0.35;
			var k = (0.75 + r * 0.25) * (0.55 + crack * 0.45) + sheen;
			if (lx < 0.03) { return [base[0] * 0.3, base[1] * 0.3, base[2] * 0.3, 0, 0.95]; }
			return [base[0] * k, base[1] * k, base[2] * k * 1.04, 0.3 + crack * 0.6 + grain * 0.1, 0.55 + (1 - crack) * 0.35];
		} };
	},
	// sawn limestone slabs in running bond, fine fossil speckles and soft veining
	limestone: function (o) {
		var base = hex(o.color || '#DCD2C1'), joint = hex('#B9AE9C');
		return { tw: 2.4, th: 1.6, w: 768, h: 512, fn: function (u, v) {
			var rows = 4, row = Math.floor(v * rows), ly = v * rows - row, x = (u * 2 + (row % 2) * 0.5) % 1, col = Math.floor(u * 2 + (row % 2) * 0.5);
			var r = hash2(col, row, 21), n = fbm(u, v, 24, 5, 3), sp = vnoise(u * 420, v * 280, 420, 7) > 0.9 ? 1 : 0;
			if (x < 0.004 || ly < 0.012) { return [joint[0], joint[1], joint[2], 0.1, 0.95]; }
			var vein = smooth(0.48, 0.52, fbm(u * 0.8 + r, v * 0.5, 6, 4, 31 + col)) * 0.06;
			var c = hueJit(jit(base, 0.12, r), hash2(col, row, 22), 0.06);
			var k = 0.95 + (n - 0.5) * 0.12 - sp * 0.08 - vein;
			return [c[0] * k, c[1] * k, c[2] * k, 0.7 + n * 0.12 - sp * 0.1, 0.78 + n * 0.12];
		} };
	},
	// large fibre-cement panels with open joints and visible fixings
	fibercement: function (o) {
		var base = hex(o.color || '#A7ABAD');
		return { tw: 2.5, th: 2.0, w: 640, h: 512, fn: function (u, v) {
			var lx = (u * 2) % 1, ly = (v * 2) % 1, n = fbm(u, v, 32, 4, 41), fib = fbm(u * 4, v * 4, 64, 2, 43);
			if (lx < 0.006 || ly < 0.008) { return [base[0] * 0.25, base[1] * 0.25, base[2] * 0.25, 0, 0.95]; }
			var rv = 0; [0.06, 0.94].forEach(function (cx) { [0.07, 0.93].forEach(function (cy) { var dx = (lx - cx) * 1.25, dy = ly - cy; if (dx * dx + dy * dy < 0.00012) { rv = 1; } }); });
			var k = 0.93 + (n - 0.5) * 0.1 + (fib - 0.5) * 0.04 - rv * 0.3;
			return [base[0] * k, base[1] * k, base[2] * k, 0.75 + n * 0.05 - rv * 0.2, 0.82 + fib * 0.1];
		} };
	},
	// interior floors (2.4 m tile): planks, herringbone, chevron, tiles (marble veins, travertine pores),
	// terrazzo, encaustic cement tiles, carpet and cork – all tileable
	floor: function (o) {
		var base = hex(o.color || '#B7865A'), pat = o.pattern || 'planks', grout = hex(o.grout || '#B8B1A7'), S = 2.4;
		var woodPx = function (r, ly, lx, gseed) {
			var c = hueJit(jit(base, 0.24, r), hash2(Math.floor(r * 999), 3, 3), 0.1);
			var warp = fbm((lx + r * 3) % 1, (ly * 0.25 + r) % 1, 8, 3, gseed), fine = fbm((lx * 4 + r) % 1, ly % 1, 32, 2, gseed + 3);
			var g2 = ly * 4 + warp * 1.4 + r * 11, f2 = g2 - Math.floor(g2), late = Math.pow(smooth(0.6, 1, f2), 2);
			var k = 0.95 - late * 0.12 + (warp - 0.5) * 0.1 + (fine - 0.5) * 0.08;
			return [c[0] * k, c[1] * k, c[2] * k, 0.75 + late * 0.04, 0.5 + warp * 0.25];
		};
		return { tw: S, th: S, w: 768, h: 768, fn: function (u, v) {
			var x = u * S, y = v * S, r, n;
			if (pat === 'planks') {
				var bw = o.bw || 0.2, rl = o.rl || 1.2, row = Math.floor(y / bw), ly = y / bw - row, xx = (x + hash2(row % Math.round(S / bw), 1, 3) * rl) % S, b = Math.floor(xx / rl), lx = xx / rl - b;
				r = hash2(b, row % Math.round(S / bw), 7);
				var jw = o.grout ? 0.03 : 0.012;
				if (ly < jw || lx < jw * bw / rl) { return o.grout ? [grout[0], grout[1], grout[2], 0.1, 0.9] : [base[0] * 0.45, base[1] * 0.4, base[2] * 0.36, 0.1, 0.8]; }
				return woodPx(r, ly, lx, 5);
			}
			if (pat === 'herring' || pat === 'chevron') {
				var cw = 0.4, col = Math.floor(x / cw), cx = x / cw - col, d = col % 2 ? 1 : -1, pw = 0.1;
				var sft = y + d * cx * cw + (pat === 'herring' && col % 2 ? pw * 0.5 : 0), k = Math.floor(sft / pw), ls = sft / pw - k;
				r = hash2(k % Math.round(S / pw), col, 9);
				var endJ = pat === 'chevron' ? cx < 0.012 : (cx < 0.012 && k % 2 === 0) || (cx > 0.988 && k % 2 === 1);
				if (ls < 0.06 || endJ) { return [base[0] * 0.45, base[1] * 0.4, base[2] * 0.36, 0.1, 0.8]; }
				return woodPx(r, ls, cx, 7);
			}
			if (pat === 'tile') {
				var ts = o.size || 0.6, gw = 0.003 / ts, tx = x / ts, ty = y / ts, ix = Math.floor(tx), iy = Math.floor(ty), fx = tx - ix, fy = ty - iy;
				if (fx < gw || fy < gw) { return [grout[0], grout[1], grout[2], 0.05, 0.9]; }
				r = hash2(ix, iy, 13); n = fbm(u, v, 24, 3, 3);
				var c = jit(base, 0.06, r), k2 = 0.96 + (n - 0.5) * 0.08, rough = 0.45;
				if (o.vein) {
					var vn = fbm(u, v, 3, 4, 61), vline = Math.exp(-Math.pow((vn - 0.5) / 0.012, 2)), vfine = Math.exp(-Math.pow((fbm(u, v, 6, 3, 63) - 0.5) / 0.006, 2));
					c = mixc(c, [0.62, 0.6, 0.58], vline * 0.55 + vfine * 0.25); rough = 0.12;
				}
				if (o.pores) {
					var pore = vnoise(u * 300, v * 300, 300, 17) > (o.pores > 1 ? 0.86 : 0.93) ? 1 : 0, band = (Math.sin((y * 9 + fbm(u, v, 6, 3, 19) * 5) * Math.PI) * 0.5 + 0.5) * 0.06;
					k2 *= 1 - pore * 0.18 - band; rough = 0.7;
				}
				return [c[0] * k2, c[1] * k2, c[2] * k2, 0.8 - (o.pores ? 0 : 0), rough];
			}
			if (pat === 'terrazzo') {
				var w1 = worley(u, v, 140, 23, 0.95), chip = w1[0] < 0.22 + hash2(w1[2], 4, 5) * 0.18;
				n = fbm(u, v, 32, 3, 29);
				if (chip) { var pal = [[0.55, 0.5, 0.46], [0.35, 0.37, 0.4], [0.78, 0.7, 0.6], [0.95, 0.94, 0.92], [0.62, 0.42, 0.36]][Math.floor(hash2(w1[2], 6, 7) * 5)]; return [pal[0], pal[1], pal[2], 0.82, 0.25]; }
				return [base[0] * (0.97 + n * 0.05), base[1] * (0.97 + n * 0.05), base[2] * (0.97 + n * 0.05), 0.8, 0.3];
			}
			if (pat === 'cement') {
				var cs = 0.2, qx = (x / cs) % 1, qy = (y / cs) % 1, dx = Math.abs(qx - 0.5), dy = Math.abs(qy - 0.5);
				if (qx < 0.02 || qy < 0.02) { return [grout[0], grout[1], grout[2], 0.1, 0.9]; }
				var motif = dx + dy < 0.32 && dx + dy > 0.14 ? 1 : (Math.max(dx, dy) > 0.44 ? 2 : 0);
				n = fbm(u, v, 48, 3, 31);
				var cc = motif === 1 ? [0.24, 0.35, 0.42] : (motif === 2 ? [0.7, 0.62, 0.52] : base);
				return [cc[0] * (0.95 + n * 0.08), cc[1] * (0.95 + n * 0.08), cc[2] * (0.95 + n * 0.08), 0.8, 0.75];
			}
			if (pat === 'carpet') {
				n = fbm(u, v, 256, 2, 37); var m2 = fbm(u, v, 12, 3, 39);
				var kc = 0.9 + n * 0.16 + (m2 - 0.5) * 0.06;
				return [base[0] * kc, base[1] * kc, base[2] * kc, n, 0.98];
			}
			if (pat === 'cork') {
				var w2 = worley(u, v, 360, 41, 1), g2 = hash2(w2[2], 8, 9);
				var kk = 0.75 + g2 * 0.4 - smooth(0, 0.15, 0.15 - (w2[1] - w2[0])) * 0.2;
				return [base[0] * kk, base[1] * kk, base[2] * kk, 0.6 + g2 * 0.2, 0.85];
			}
			n = fbm(u, v, 16, 5, 43);
			var ks = 0.93 + n * 0.12;
			return [base[0] * ks, base[1] * ks, base[2] * ks, 0.8 + n * 0.05, 0.55];
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
	solar: function (o) {
		var t = o.type || 'blue_poly';
		if (t === 'solar_tile') {
			return { tw: 0.84, th: 0.7, w: 256, h: 256, fn: function (u, v) {
				var cx = (u * 2) % 1, cy = (v * 2) % 1, gap = cx < 0.03 || cy < 0.04, row = Math.floor(v * 2) % 2 ? 0.02 : 0, k = gap ? 0.5 : 1 + (hash2(Math.floor(u * 2), Math.floor(v * 2), 3) - 0.5) * 0.08;
				return [0.07 * k + row, 0.09 * k + row, 0.13 * k + row, gap ? 0.3 : 0.55, 0.3];
			} };
		}
		var blue = t === 'blue_poly', nc = 6, nr = 10;
		return { tw: 1.12, th: 1.75, w: 256, h: 512, fn: function (u, v) {
			var cx = (u * nc) % 1, cy = (v * nr) % 1, line = cx < 0.04 || cy < 0.025 ? 1 : 0, bus = Math.abs(cx - 0.5) < 0.012 ? 1 : 0;
			var frame = u < 0.02 || u > 0.98 || v < 0.012 || v > 0.988;
			if (frame) { return blue ? [0.75, 0.77, 0.8, 1, 0.3] : (t === 'glass' ? [0.02, 0.025, 0.035, 0.6, 0.12] : [0.04, 0.045, 0.05, 0.9, 0.35]); }
			if (blue) { var k = line ? 0.55 : 1; return bus ? [0.5, 0.52, 0.56, 0.6, 0.3] : [0.05 * k + 0.02, 0.08 * k + 0.02, 0.16 * k + 0.03, 0.5, 0.18]; }
			var kk = line ? 0.6 : 1;
			return bus ? [0.16, 0.17, 0.19, 0.5, 0.3] : [0.02 * kk + 0.012, 0.025 * kk + 0.014, 0.04 * kk + 0.02, 0.5, t === 'glass' ? 0.1 : 0.2];
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
	},

	/* ---------------------------------------------------------------- interiors */
	// furniture veneer: continuous grain, no joints (single tone, tinted)
	veneer: function (o) {
		var base = hex(o.color || '#BFBFBF'), q = o.cut === 'quarter';
		return { tw: 0.9, th: 1.8, w: 512, h: 1024, fn: function (u, v) {
			var warp = fbm(u, v, 4, 3, 41), cath = q ? 0 : Math.pow(Math.abs(Math.sin((u - 0.5) * Math.PI)), 1.5) * 0 + Math.cos((u - 0.5) * Math.PI * 2) * (0.5 + 0.5 * Math.sin(v * Math.PI * 2)) * 1.6;
			var g = u * (q ? 36 : 22) + (warp - 0.5) * (q ? 0.8 : 1.6) + cath;
			var f = g - Math.floor(g), late = Math.pow(smooth(0.55, 1, f), 3) + Math.pow(1 - smooth(0, 0.08, f), 2) * 0.6;
			var streak = fbm(u * 8, v, 4, 3, 45), pore = vnoise(u * 256, v * 32, 32, 47) > 0.78 ? 1 : 0, fleck = q && vnoise(u * 64, v * 16, 16, 49) > 0.86 ? 1 : 0;
			var k = 0.98 - late * 0.2 + (streak - 0.5) * 0.18 - pore * 0.06 + fleck * 0.08;
			return [base[0] * k, base[1] * k * 0.99, base[2] * k * 0.97, 0.6 - late * 0.08 - pore * 0.25, 0.48 + streak * 0.2 + late * 0.08];
		} };
	},
	// upholstery fabrics (tinted): linen weave, boucle loops, velvet, knitted wool
	fabric: function (o) {
		var base = hex(o.color || '#BFBFBF'), k = o.kind || 'linen';
		return { tw: k === 'pattern' ? 0.45 : 0.12, th: k === 'pattern' ? 0.45 : 0.12, w: 512, h: 512, fn: function (u, v) {
			var n = fbm(u, v, 6, 3, 51), r, hgt, rough = 0.95;
			if (k === 'pattern') {
				// woven ikat-like motif: soft diamonds in stripes on a fine weave
				var wx = u * 160, wy = v * 160, ov = (Math.floor(wx) + Math.floor(wy)) % 2, t = ov ? Math.sin((wy % 1) * Math.PI) : Math.sin((wx % 1) * Math.PI);
				var dx = Math.abs(((u * 4) % 1) - 0.5), dy = Math.abs(((v * 4 + 0.25) % 1) - 0.5), dia = dx + dy * 0.8 + (fbm(u, v, 30, 2, 65) - 0.5) * 0.08, band = Math.floor(v * 8) % 2;
				var mot = dia < 0.22 ? 0.62 : (dia < 0.3 ? 0.85 : 1);
				hgt = t * 0.5 + 0.2; r = (band ? mot : (dia < 0.12 ? 0.72 : 1)) * (0.93 + t * 0.07);
			} else if (k === 'boucle') {
				var w = worley(u, v, 36, 53, 1), w2 = worley(u, v, 72, 54, 1);
				hgt = (1 - smooth(0, 0.62, w[0])) * 0.7 + (1 - smooth(0, 0.5, w2[0])) * 0.3;
				r = 0.9 + hgt * 0.1 + (hash2(w[2], 1, 55) - 0.5) * 0.04;
			} else if (k === 'velvet') {
				hgt = fbm(u, v, 48, 2, 57) * 0.25; r = 0.9 + (n - 0.5) * 0.26 + hgt * 0.1; rough = 0.75;
			} else if (k === 'wool') {
				var a = Math.abs(Math.sin((u * 40 + Math.sin(v * 80 * Math.PI) * 0.18) * Math.PI));
				hgt = a * 0.6 + fbm(u, v, 64, 2, 59) * 0.4; r = 0.84 + hgt * 0.16 + (n - 0.5) * 0.12;
			} else {
				var x = u * 48, y = v * 48, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, over = (ix + iy) % 2 === 0;
				var t = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI), slub = fbm(u, v, 24, 2, 61);
				hgt = t * 0.6 + slub * 0.4; r = 0.9 + t * 0.06 + (slub - 0.5) * 0.12 + (hash2(over ? ix : iy, 3, 63) - 0.5) * 0.04;
			}
			return [base[0] * r, base[1] * r, base[2] * r, hgt, rough];
		} };
	},
	// pebble-grain leather (tinted)
	leather: function (o) {
		var base = hex(o.color || '#BFBFBF');
		return { tw: 0.3, th: 0.3, w: 512, h: 512, fn: function (u, v) {
			var w = worley(u, v, 110, 71, 1), crease = smooth(0, 0.18, w[1] - w[0]), n = fbm(u, v, 5, 3, 73);
			var r = 0.9 + (n - 0.5) * 0.16 + crease * 0.04;
			return [base[0] * r, base[1] * r, base[2] * r, crease * 0.6 + n * 0.2, 0.5 + (1 - crease) * 0.18 + n * 0.1];
		} };
	},
	// rattan cane webbing with open holes (tinted)
	rattan: function (o) {
		var base = hex(o.color || '#BFBFBF'), N = 12;
		return { tw: 0.12, th: 0.12, w: 256, h: 256, alpha: true, fn: function (u, v) {
			var x = u * N, y = v * N, fx = x - Math.floor(x), fy = y - Math.floor(y);
			var o1 = Math.min(Math.abs(fx - 0.5), Math.abs(fy - 0.5)), o2 = Math.min(Math.abs(fx - fy), Math.abs(fx + fy - 1));
			var s = o1 < 0.085 ? 1 - o1 / 0.085 : (o2 < 0.06 ? 0.85 - o2 / 0.06 * 0.6 : 0);
			if (s <= 0) { return [0, 0, 0, 0, 1, 0]; }
			var g = fbm(u, v, 32, 2, 77), k = 0.78 + s * 0.2 + (g - 0.5) * 0.15;
			return [base[0] * k, base[1] * k, base[2] * k, s, 0.6, 1];
		} };
	},
	// polished marble slab: clouds and veins, no joints
	marble: function (o) {
		var base = hex(o.color || '#EEECE8'), vein = hex(o.vein || '#8E8A86');
		return { tw: 1.6, th: 1.6, w: 1024, h: 1024, fn: function (u, v) {
			var t1 = fbm(u, v, 3, 5, 81), t2 = fbm(u, v, 6, 4, 83), cloud = fbm(u, v, 4, 4, 85);
			var a1 = Math.sin((u + v * 2 + t1 * 2.6) * Math.PI * 2), a2 = Math.sin((u * 3 - v + t2 * 3.2) * Math.PI * 2), a3 = Math.sin((u * 2 + v * 3 + t1 * 4 + t2 * 2) * Math.PI * 2);
			var l1 = Math.exp(-Math.pow(a1 / 0.035, 2)), l2 = Math.exp(-Math.pow(a2 / 0.02, 2)) * smooth(0.45, 0.7, t2), l3 = Math.exp(-Math.pow(a3 / 0.06, 2)) * 0.25;
			var c = mixc(base, mixc(base, vein, 0.3), smooth(0.4, 0.8, cloud) * 0.6);
			c = mixc(c, vein, Math.min(1, l1 * 0.75 + l2 * 0.6 + l3));
			return [c[0], c[1], c[2], 0.8 - l1 * 0.04, 0.1 + cloud * 0.08];
		} };
	},
	// wall tiles: subway, square, hexagon, handmade zellige, fluted ribs, checkerboard
	wtile: function (o) {
		var base = hex(o.color || '#E8E5DF'), b2 = hex(o.color2 || '#2B2B2B'), grout = hex(o.grout || '#CFCAC2'), p = o.pattern || 'square', gl = o.glaze !== false;
		var R = 0.06, HW = Math.sqrt(3) * R, TW = p === 'hex' ? HW * 10 : 1.2, TH = p === 'hex' ? R * 1.5 * 12 : 1.2;
		return { tw: TW, th: TH, w: 768, h: 768, fn: function (u, v) {
			var x = u * TW, y = v * TH, n = fbm(u, v, 24, 3, 3), ix, iy, e, r, c, rough = gl ? 0.16 : 0.55, hgt;
			if (p === 'fluted') {
				var s = o.size || 0.03, f = (x / s) % 1, prof = Math.sqrt(Math.max(0, 1 - Math.pow(f * 2 - 1, 2)));
				return [base[0] * (0.9 + prof * 0.1), base[1] * (0.9 + prof * 0.1), base[2] * (0.9 + prof * 0.1), prof, 0.5];
			}
			if (p === 'hex') {
				var row = Math.floor(y / (R * 1.5)), best = 9, bx = 0, by = 0, id = 0;
				for (var dr = -1; dr <= 1; dr++) {
					var rr = row + dr, off = (((rr % 2) + 2) % 2) * HW * 0.5, col = Math.round((x - off) / HW);
					for (var dc = -1; dc <= 1; dc++) {
						var cx = (col + dc) * HW + off, cy = rr * R * 1.5, dd = Math.hypot(x - cx, y - cy);
						if (dd < best) { best = dd; bx = x - cx; by = y - cy; id = ((col + dc) % 10 + 10) % 10 + ((rr % 12) + 12) % 12 * 10; }
					}
				}
				var ax = Math.abs(bx), ay = Math.abs(by); e = R * 0.866 - Math.max(ax, ax * 0.5 + ay * 0.866);
				if (e < 0.0025) { return [grout[0], grout[1], grout[2], 0.1, 0.9]; }
				r = hash2(id, 7, 11); c = jit(base, 0.08, r);
				hgt = 0.8 + smooth(0, 0.004, e - 0.0025) * 0.15;
				return [c[0] * (0.96 + n * 0.08), c[1] * (0.96 + n * 0.08), c[2] * (0.96 + n * 0.08), hgt, rough];
			}
			var tw = p === 'subway' ? 0.3 : (p === 'checker' ? 0.3 : (o.size || (p === 'zellige' ? 0.1 : 0.2))), th = p === 'subway' ? 0.075 : tw;
			iy = Math.floor(y / th); var xo = p === 'subway' && iy % 2 ? tw / 2 : 0; ix = Math.floor((x + xo) / tw);
			var fx = (x + xo) / tw - ix, fy = y / th - iy, gw = 0.0025;
			e = Math.min(fx * tw, (1 - fx) * tw, fy * th, (1 - fy) * th);
			if (e < gw) { return [grout[0], grout[1], grout[2], 0.1, 0.9]; }
			r = hash2(ix, iy, 13);
			c = p === 'checker' ? ((ix + iy) % 2 ? b2 : base) : jit(base, p === 'zellige' ? 0.28 : 0.05, r);
			if (p === 'zellige') { c = hueJit(c, hash2(ix, iy, 17), 0.12); var pool = fbm(u, v, 40, 3, 19); c = mixc(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], smooth(0.55, 0.8, pool) * 0.5); hgt = 0.7 + pool * 0.25 + smooth(0, 0.01, e - gw) * 0.1; }
			else { hgt = 0.8 + smooth(0, p === 'subway' ? 0.008 : 0.003, e - gw) * 0.18; }
			return [c[0] * (0.97 + n * 0.06), c[1] * (0.97 + n * 0.06), c[2] * (0.97 + n * 0.06), hgt, rough];
		} };
	},
	// a painting or print (one picture, not tiled): abstract shapes, a line drawing, a landscape, geometry
	art: function (o) {
		var P = (o.p || ['#ECE5D8', '#C46A4A', '#2F4A5A', '#D9A75B']).map(hex), k = o.kind || 'abstract', sd = o.seed || 1;
		return { tw: 1, th: 1, w: 512, h: 512, noTile: true, fn: function (u, v) {
			var n = fbm(u, v, 5, 3, 91 + sd), canvas = fbm(u, v, 128, 2, 93), c = P[0];
			if (k === 'abstract') {
				var s1 = Math.hypot(u - 0.36 - (sd % 3) * 0.05, v - 0.58) < 0.25 + (n - 0.5) * 0.12;
				var s2 = Math.hypot((u - 0.66) * 0.8, v - 0.32 - (sd % 2) * 0.06) < 0.2 + (n - 0.5) * 0.1;
				var band = Math.abs(v - 0.18 - (n - 0.5) * 0.1) < 0.05;
				if (s1) { c = P[1]; } if (s2) { c = s1 ? mixc(P[1], P[2], 0.6) : P[2]; } if (band) { c = P[3]; }
				var brush = fbm(u * 4, v, 16, 3, 95 + sd); c = mixc(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85], brush * 0.5);
			} else if (k === 'line') {
				var cx = u - 0.5, cy = v - 0.5, a = Math.atan2(cy, cx), rr = Math.hypot(cx, cy);
				var line = Math.abs(rr - 0.22 - Math.sin(a * 3 + sd) * 0.06 - Math.sin(a * 7) * 0.02) < 0.004 || Math.abs(cx * 0.6 + Math.sin(cy * 9 + sd) * 0.05) < 0.0035 && Math.abs(cy) < 0.3;
				c = line ? P[2] : [0.95, 0.93, 0.89];
				if (!line && Math.hypot(u - 0.62, v - 0.62) < 0.07) { c = mixc(c, P[1], 0.7); }
			} else if (k === 'landscape') {
				var sky = mixc(P[0], [0.85, 0.88, 0.9], v), h1 = 0.42 + Math.sin(u * 5 + sd) * 0.06 + (n - 0.5) * 0.06, h2 = 0.3 + Math.sin(u * 3 + 2 + sd) * 0.05, h3 = 0.16 + Math.sin(u * 7) * 0.03;
				c = sky;
				if (Math.hypot(u - 0.7, v - 0.72) < 0.07) { c = mixc(P[3], [1, 1, 1], 0.3); }
				if (v < h1) { c = mixc(P[2], [0.8, 0.82, 0.84], 0.45); } if (v < h2) { c = mixc(P[2], P[0], 0.2); } if (v < h3) { c = mixc(P[1], [0.3, 0.25, 0.2], 0.4); }
			} else {
				var arch = (Math.abs(u - 0.38) < 0.16 && v < 0.55) || Math.hypot(u - 0.38, v - 0.55) < 0.16;
				var sq = u > 0.55 && u < 0.85 && v > 0.2 && v < 0.5, dot = Math.hypot(u - 0.7, v - 0.72) < 0.09;
				c = arch ? P[1] : (sq ? P[2] : (dot ? P[3] : P[0]));
			}
			var kk = 0.94 + canvas * 0.1;
			return [c[0] * kk, c[1] * kk, c[2] * kk, canvas * 0.5, 0.85];
		} };
	},
	// rug (one piece, not tiled): plain wool, berber diamonds, oriental medallion, stripes, jute weave
	rug: function (o) {
		var base = hex(o.color || '#D8CFC2'), acc = hex(o.accent || '#3A3633'), k = o.kind || 'plain';
		return { tw: 1, th: 1, w: 512, h: 512, noTile: true, fn: function (u, v) {
			var pile = fbm(u, v, 160, 2, 101), n = fbm(u, v, 6, 3, 103), c = base, t;
			if (k === 'berber') {
				var x = u * 8, y = v * 12, d1 = Math.abs(((x + y) % 2) - 1), d2 = Math.abs(((x - y + 120) % 2) - 1);
				if (Math.min(d1, d2) < 0.05 + n * 0.03) { c = acc; }
			} else if (k === 'oriental') {
				var e = Math.min(u, 1 - u, v, 1 - v), dm = Math.abs(u - 0.5) + Math.abs(v - 0.5) * 0.8;
				c = base;
				if (e < 0.09) { c = acc; if (e > 0.03 && e < 0.07 && Math.sin((u + v) * 90) > 0.3) { c = mixc(acc, [0.85, 0.75, 0.55], 0.6); } }
				else if (dm < 0.2) { c = mixc(acc, [0.85, 0.75, 0.55], dm < 0.1 ? 0.7 : 0.15); }
				else if (Math.sin(u * 60) * Math.sin(v * 40) > 0.85) { c = mixc(base, acc, 0.5); }
				t = 0.7 + n * 0.5; c = [c[0] * t, c[1] * t, c[2] * t];
			} else if (k === 'stripe') {
				if (Math.floor(v * 16) % 4 === 0) { c = acc; }
			} else if (k === 'geometric') {
				var gx = u * 6, gy = v * 9, fx = gx % 1, fy = gy % 1, tri = (Math.floor(gx) + Math.floor(gy)) % 2 ? fx > fy : fx < 1 - fy;
				if (tri && Math.min(fx, fy, 1 - fx, 1 - fy) > 0.06) { c = mixc(acc, base, 0.25); }
				if (Math.min(u, 1 - u, v, 1 - v) < 0.04) { c = acc; }
			} else if (k === 'kilim') {
				var bi = Math.floor(v * 10), bv = (v * 10) % 1, cx2 = Math.abs(((u * 5) % 1) - 0.5) * 2, step = Math.floor(cx2 * 4) / 4;
				c = bi % 2 ? base : mixc(base, [0.9, 0.82, 0.68], 0.55);
				if (bi % 2 && Math.abs(bv - 0.5) * 2 < 1 - step) { c = acc; }
				if (bi % 3 === 2 && Math.abs(bv - 0.5) < 0.12) { c = [0.85, 0.72, 0.45]; }
			} else if (k === 'cowhide') {
				var ph = fbm(u * 1.4, v * 1.1, 3, 4, 107);
				c = ph > 0.56 ? acc : (ph > 0.52 ? mixc(acc, base, 0.5) : base);
				var hair = fbm(u, v, 220, 2, 109); c = [c[0] * (0.92 + hair * 0.1), c[1] * (0.92 + hair * 0.1), c[2] * (0.92 + hair * 0.1)];
				return [c[0], c[1], c[2], hair * 0.4, 0.75];
			} else if (k === 'vintage') {
				var e2 = Math.min(u, 1 - u, v, 1 - v), dm2 = Math.abs(u - 0.5) + Math.abs(v - 0.5) * 0.8, wear = smooth(0.45, 0.75, fbm(u, v, 4, 4, 111));
				c = base;
				if (e2 < 0.08) { c = acc; } else if (dm2 < 0.22) { c = mixc(acc, [0.86, 0.78, 0.6], dm2 < 0.1 ? 0.6 : 0.1); } else if (Math.sin(u * 50) * Math.sin(v * 34) > 0.8) { c = mixc(base, acc, 0.45); }
				c = mixc(c, [0.86, 0.8, 0.72], wear * 0.55);
			} else if (k === 'shag') {
				var sp2 = fbm(u, v, 320, 2, 113), cl = worley(u, v, 90, 115, 1);
				t = 0.78 + sp2 * 0.3 - smooth(0, 0.5, cl[0]) * 0.12; c = [base[0] * t, base[1] * t, base[2] * t];
				return [c[0], c[1], c[2], sp2 * 0.7 + (1 - cl[0]) * 0.3, 1];
			} else if (k === 'jute') {
				var wx = u * 120, wy = v * 120, ox = Math.floor(wx), oy = Math.floor(wy), ov = (ox + Math.floor(oy / 2)) % 2;
				t = 0.8 + (ov ? Math.sin((wx - ox) * Math.PI) : Math.sin((wy - oy) * Math.PI)) * 0.25; c = [base[0] * t, base[1] * t, base[2] * t];
				return [c[0], c[1], c[2], t, 0.95];
			}
			var kk = 0.9 + pile * 0.16 + (n - 0.5) * 0.08;
			return [c[0] * kk, c[1] * kk, c[2] * kk, pile, 0.98];
		} };
	}
};



// Materials whose colour map is "base colour × pattern": generated once in neutral grey and tinted by
// the material colour, so a colour change never regenerates a texture.
export var NEUTRAL = '#BFBFBF';
export var TINT = { veneer: 1, fabric: 1, leather: 1, rattan: 1, render: 1, wood: 1, woodh: 1, batten: 1, charred: 1, fibercement: 1, seam: 1, concrete: 1, panel: 1, tiles: 1, flattile: 1, slate: 1, shingle: 1, gravel: 1, pavers: 1, slabs: 1, deck: 1, louvre: 1, garagedoor: 1 };

// Size and tiling of a material (cheap: no pixels).
export function info(kind, opts, scale) {
	var g = GEN[kind](opts || {}), k = kind === 'leaves' ? 1 : (scale || 1);
	return { w: Math.max(16, Math.round(g.w * k)), h: Math.max(16, Math.round(g.h * k)), tw: g.tw, th: g.th, alpha: !!g.alpha, noTile: !!g.noTile };
}
// Pixels of a material: { col, nrm, rgh } (Uint8ClampedArray RGBA each) plus the info() fields.
export function bake(kind, opts, scale) {
	opts = opts || {};
	var g = GEN[kind](opts), I = info(kind, opts, scale), w = I.w, h = I.h, N = w * h;
	var hgt = new Float32Array(N), col = new Uint8ClampedArray(N * 4), rgh = new Uint8ClampedArray(N * 4), nrm = new Uint8ClampedArray(N * 4);
	for (var y = 0; y < h; y++) {
		var v = (y + 0.5) / h;
		for (var x = 0; x < w; x++) {
			var u = (x + 0.5) / w, o = g.fn(u, v), i = y * w + x, p = i * 4;
			col[p] = clamp(o[0], 0, 1) * 255; col[p + 1] = clamp(o[1], 0, 1) * 255; col[p + 2] = clamp(o[2], 0, 1) * 255;
			col[p + 3] = g.alpha ? clamp(o[5] === undefined ? 1 : o[5], 0, 1) * 255 : 255;
			hgt[i] = o[3];
			var r = clamp(o[4], 0, 1) * 255;
			rgh[p] = r; rgh[p + 1] = r; rgh[p + 2] = r; rgh[p + 3] = 255;
		}
	}
	// normal map from the height field (wraps around for tileable textures)
	var s = (opts.normalStrength || 3) * (w / (g.w || w));
	for (var yy = 0; yy < h; yy++) {
		for (var xx = 0; xx < w; xx++) {
			var xl = (xx - 1 + w) % w, xr = (xx + 1) % w, ya = (yy + 1) % h, yb = (yy - 1 + h) % h;
			var dx = (hgt[yy * w + xr] - hgt[yy * w + xl]) * s, dy = (hgt[yb * w + xx] - hgt[ya * w + xx]) * s;
			var nx = -dx, ny = dy, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz), q = (yy * w + xx) * 4;
			nrm[q] = (nx / l * 0.5 + 0.5) * 255; nrm[q + 1] = (ny / l * 0.5 + 0.5) * 255; nrm[q + 2] = (nz / l * 0.5 + 0.5) * 255; nrm[q + 3] = 255;
		}
	}
	return { col: col, nrm: nrm, rgh: rgh, w: w, h: h, tw: I.tw, th: I.th, alpha: I.alpha, noTile: I.noTile };
}
export { GEN as _gen, hex as _hex };
