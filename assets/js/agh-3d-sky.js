/*!
 * AutoGroweHome – photographed skies for the 3D preview (1.26.0)
 * Koltai Norbert – Infostudio
 *
 * Seven CC0 sky HDRIs (Poly Haven, see assets/sky/manifest.json and LICENSE.txt) ship inside the plugin
 * as small "log-WebP" pictures: every colour channel holds log2 of the linear radiance, mapped from
 * [lo, hi] to 0–255. Here they are turned back into linear half-float equirectangular textures with a
 * 256-entry lookup table – a single pass, no shader work – and handed to the viewer's Env, which uses the
 * picture as the background and, through PMREM, as the image-based light.
 *
 * The sun of the picture is turned to where the scene's own sun (the shadow-casting light) stands: the
 * columns are rotated while decoding. The brightness is matched to the painted sky of the same time of
 * day, so the exposure, the lamps and the shadows stay as balanced as before.
 * Nothing is downloaded from elsewhere: the files are in the plugin. If one cannot be loaded (blocked,
 * missing, a decoding error), the painted sky stays – silently.
 */
import * as THREE from './vendor/three/three.module.min.js';

var BASE = null, VER = '', MAN = null, MANP = null, DATA = {}, LOADS = {}, FAILED = {};
export function setup(ver) {
	VER = ver || '';
	try { BASE = new URL('../sky/', import.meta.url); } catch (e) { BASE = null; }
}
function url(f) { return new URL(f + VER, BASE).href; }

// Which sky a configuration shows ('' = none: the painted sky).
export function pick(c) {
	var tod = c.time_of_day || 'golden', w = c.weather || 'few_clouds';
	if (tod === 'night') { return 'night'; }
	if (w === 'overcast') { return 'overcast'; }
	if (tod === 'midday') { return w === 'clear' ? 'midday_clear' : 'midday'; }
	return { morning: 'morning', golden: 'golden', blue: 'blue' }[tod] || 'golden';
}
// 'ready' | 'loading' | 'failed' | 'none'
export function status(name) {
	if (!name || !BASE) { return 'none'; }
	if (DATA[name]) { return 'ready'; }
	if (FAILED[name] || FAILED['*']) { return 'failed'; }
	return LOADS[name] ? 'loading' : 'none';
}
export function info(name) { return MAN && MAN.skies && MAN.skies[name] ? MAN.skies[name] : null; }
export function manifest() {
	if (!MANP) {
		MANP = !BASE || typeof fetch === 'undefined' ? Promise.resolve(null) : fetch(url('manifest.json')).then(function (r) { if (!r.ok) { throw new Error('sky manifest ' + r.status); } return r.json(); }).then(function (m) {
			if (!m || m.format !== 'log2-rgb-webp' || !m.skies) { throw new Error('sky manifest'); }
			MAN = m; return m;
		}).catch(function () { FAILED['*'] = true; return null; });
	}
	return MANP;
}
// Loads the picture of a sky (its log-encoded bytes); resolves with true when ready, false on failure.
export function load(name) {
	if (!name || !BASE) { return Promise.resolve(false); }
	if (DATA[name]) { return Promise.resolve(true); }
	if (LOADS[name]) { return LOADS[name]; }
	LOADS[name] = manifest().then(function (m) {
		var s = m && m.skies[name];
		if (!s || !/^[a-z0-9_-]+\.webp$/.test(s.file)) { throw new Error('sky ' + name); }
		return new Promise(function (res, rej) {
			var img = new Image();
			img.decoding = 'async';
			img.onload = function () {
				try {
					var w = img.naturalWidth, h = img.naturalHeight;
					if (w !== s.w || h !== s.h || w !== h * 2) { throw new Error('sky size'); }
					var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
					var x = cv.getContext('2d', { willReadFrequently: true });
					x.drawImage(img, 0, 0);
					DATA[name] = { s: s, w: w, h: h, px: x.getImageData(0, 0, w, h).data };
					keepFew(name);
					res(true);
				} catch (e) { rej(e); }
			};
			img.onerror = function () { rej(new Error('sky load')); };
			img.src = url(s.file);
		});
	}).catch(function () { FAILED[name] = true; delete LOADS[name]; return false; });
	return LOADS[name];
}
// at most three decoded skies are kept in memory (8 MB each at 2048 × 1024)
var ORDER = [];
function keepFew(name) {
	ORDER = ORDER.filter(function (n) { return n !== name; }); ORDER.push(name);
	while (ORDER.length > 3) { var old = ORDER.shift(); delete DATA[old]; delete LOADS[old]; }
}

/* ------------------------------------------------------------------ decoding */
var HALF = THREE.DataUtils.toHalfFloat;
// The equirectangular texture of a loaded sky.
//  res: output width (2048 = full, 1024 = half, 512 …), uTarget: where the sun goes (0–1 across, the same
//  convention as three.js' equirectUv), scale: brightness factor applied to the linear values.
export function texture(name, res, uTarget, scale) {
	var d = DATA[name];
	if (!d) { return null; }
	var s = d.s, W = d.w, H = d.h, step = Math.max(1, Math.round(W / Math.max(64, res || W))), w = Math.floor(W / step), h = Math.floor(H / step);
	// lookup: byte → half float of the linear value (geometric mean of the 2 × 2 block when downscaling)
	var lut = new Uint16Array(256 * 4), span = s.hi - s.lo, k = scale > 0 ? scale : 1;
	for (var b = 0; b < 256 * 4; b++) { lut[b] = HALF(Math.min(65000, Math.pow(2, s.lo + (b / 4) / 255 * span) * k)); }
	var roll = Math.round(((uTarget - s.sun.u) % 1 + 1) % 1 * w), out = new Uint16Array(w * h * 4), px = d.px, one = HALF(1);
	for (var y = 0; y < h; y++) {
		// the picture's top row is the zenith; three.js samples v = 1 there (no flipY on data textures)
		var oy = (h - 1 - y) * w, sy = y * step;
		for (var x = 0; x < w; x++) {
			var ox = (x + roll) % w, o = (oy + ox) * 4, sx = x * step, i = (sy * W + sx) * 4;
			if (step === 1) {
				out[o] = lut[px[i] * 4]; out[o + 1] = lut[px[i + 1] * 4]; out[o + 2] = lut[px[i + 2] * 4];
			} else {
				var j = i + (step - 1) * 4, i2 = i + (step - 1) * W * 4, j2 = i2 + (step - 1) * 4;
				out[o] = lut[px[i] + px[j] + px[i2] + px[j2]];
				out[o + 1] = lut[px[i + 1] + px[j + 1] + px[i2 + 1] + px[j2 + 1]];
				out[o + 2] = lut[px[i + 2] + px[j + 2] + px[i2 + 2] + px[j2 + 2]];
			}
			out[o + 3] = one;
		}
	}
	var t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
	t.mapping = THREE.EquirectangularReflectionMapping;
	t.colorSpace = THREE.LinearSRGBColorSpace;
	t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
	t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
	t.needsUpdate = true;
	t.userData.sky = { name: name, w: w, h: h, roll: roll, scale: k };
	return t;
}
// Colour of the sky just above the horizon (linear RGB), scaled like the texture: the haze over the distant
// land takes it, so the land melts into the photographed horizon as it did into the painted one.
export function horizon(name, scale) {
	var d = DATA[name];
	if (!d) { return null; }
	var s = d.s, W = d.w, H = d.h, r = 0, g = 0, b = 0, n = 0, span = s.hi - s.lo;
	var dec = function (q) { return Math.pow(2, s.lo + q / 255 * span); };
	for (var y = Math.floor(H * 0.47); y < Math.floor(H * 0.495); y++) {
		for (var x = 0; x < W; x += 8) { var i = (y * W + x) * 4; r += dec(d.px[i]); g += dec(d.px[i + 1]); b += dec(d.px[i + 2]); n++; }
	}
	var k = (scale > 0 ? scale : 1) / Math.max(1, n);
	return [r * k, g * k, b * k];   // linear; the viewer applies its exposure and the tone curve
}
// Mean linear luminance of the upper half of an equirectangular canvas (cos-weighted): the painted sky's
// brightness, to which a photographed sky is matched.
export function canvasMean(cv) {
	var w = 64, h = 32, c = document.createElement('canvas'); c.width = w; c.height = h;
	var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0, w, h);
	var p = x.getImageData(0, 0, w, h / 2).data, sum = 0, wsum = 0;
	var lin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
	for (var y = 0; y < h / 2; y++) {
		var wt = Math.cos((90 - (y + 0.5) / h * 180) * Math.PI / 180);
		for (var xx = 0; xx < w; xx++) { var i = (y * w + xx) * 4; sum += wt * (0.2126 * lin(p[i]) + 0.7152 * lin(p[i + 1]) + 0.0722 * lin(p[i + 2])); wsum += wt; }
	}
	return sum / wsum;
}
