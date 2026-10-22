/*!
 * AutoGroweHome – quality levels of the 3D preview (1.26.0)
 * Koltai Norbert – Infostudio
 *
 * Four levels – low, medium, high, ultra – each a "quality profile": one plain object that says how the
 * preview is drawn (pixel ratio, shadow map, ambient occlusion, grass, sky resolution, texture tiling,
 * how far the detailed trees reach). Any module can read the current profile (window.AGH_3D.quality
 * .profile()) and follow changes (onChange); the `post` part is reserved for later post effects
 * (reflections, bloom …): they read their switches from there and nothing else has to change.
 *
 * "high" is the picture of 1.24.0 on a desktop, "medium" the one on a touch screen (plus the new grass
 * and sky). The choice: the visitor's own (kept in this browser), or automatic – a short measurement
 * of the frame time on the first start (kept per graphics card), then, while the view is turned, a
 * step down when the frames get slow and a careful step up when they are fast again (with hysteresis:
 * a level just left because it was too slow is not tried again for a while).
 */
export var LEVELS = ['low', 'medium', 'high', 'ultra'];
export var PROFILES = {
	low: { level: 'low', dpr: 1, shadow: 1024, shadowRadius: 2, gtao: false, gtaoSamples: 0, msaa: 2, grass: 0, grassDensity: 0, sky: 1024, stochastic: false, treeNear: 100, post: {} },
	medium: { level: 'medium', dpr: 1.25, shadow: 2048, shadowRadius: 3, gtao: false, gtaoSamples: 0, msaa: 4, grass: 3000, grassDensity: 4, sky: 1024, stochastic: false, treeNear: 130, post: {} },
	high: { level: 'high', dpr: 1.5, shadow: 4096, shadowRadius: 3, gtao: true, gtaoSamples: 16, msaa: 4, grass: 9000, grassDensity: 8, sky: 2048, stochastic: true, treeNear: 150, post: {} },
	ultra: { level: 'ultra', dpr: 2, shadow: 4096, shadowRadius: 4, gtao: true, gtaoSamples: 24, msaa: 4, grass: 22000, grassDensity: 14, sky: 2048, stochastic: true, treeNear: 220, post: {} }
};
var KEY_CHOICE = 'agh_3d_quality', KEY_AUTO = 'agh_3d_qauto';
// frame-time thresholds (ms): slower than DOWN → one level down; faster than UP for two windows → one up
export var DOWN_MS = 50, UP_MS = 18, PROBE_SLOW = 45, PROBE_FAST = 9;

function lsGet(k) { try { var v = window.localStorage.getItem(k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
function idx(l) { var i = LEVELS.indexOf(l); return i < 0 ? 2 : i; }

// The graphics card's name, when the browser tells it (WEBGL_debug_renderer_info).
export function gpuInfo(gl) {
	var out = { vendor: '', renderer: '' };
	try {
		out.vendor = String(gl.getParameter(gl.VENDOR) || ''); out.renderer = String(gl.getParameter(gl.RENDERER) || '');
		var ext = gl.getExtension('WEBGL_debug_renderer_info');
		if (ext) { out.vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || out.vendor); out.renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || out.renderer); }
	} catch (e) { /* not available */ }
	return out;
}

/* The state: one per page (the live preview). */
var Q = {
	choice: 'auto',        // 'auto' or a level
	level: 'high',
	ceiling: 'ultra',      // auto never goes above (lowered for a while after a step down)
	ceilUntil: 0,
	cool: 0,
	gpu: '',
	probed: false,
	listeners: [],
	frames: [],
	fastWins: 0,
	log: []
};
export function state() { return Q; }
// Start: the stored choice, else (setGpu) the stored automatic result for this card, else the old default.
var started = false;
export function initial(coarse) {
	if (started) { return Q.level; }
	started = true;
	var ch = lsGet(KEY_CHOICE);
	Q.choice = ch && (ch === 'auto' || LEVELS.indexOf(ch) !== -1) ? ch : 'auto';
	if (Q.choice !== 'auto') { Q.level = Q.choice; Q.probed = true; return Q.level; }
	var a = lsGet(KEY_AUTO);
	Q.level = a && LEVELS.indexOf(a.level) !== -1 ? a.level : (coarse ? 'medium' : 'high');
	return Q.level;
}
// The graphics card is known once the canvas exists: a stored automatic result counts only for the same card.
export function setGpu(name) {
	Q.gpu = String(name || '');
	if (Q.choice !== 'auto') { return; }
	var a = lsGet(KEY_AUTO);
	if (a && a.gpu === Q.gpu && LEVELS.indexOf(a.level) !== -1) { Q.level = a.level; Q.probed = true; }
}
// Automatic switching is off in automated browsers (navigator.webdriver: the regression tests draw with a
// software renderer, where every level would be "too slow" and the scene would change under the test),
// unless the test asks for it (localStorage agh_3d_qtest = "1").
export function autoAllowed() {
	try { if (typeof navigator !== 'undefined' && navigator.webdriver && window.localStorage.getItem('agh_3d_qtest') !== '1') { return false; } } catch (e) { return false; }
	return Q.choice === 'auto';
}
export function profile(l) { return PROFILES[l || Q.level] || PROFILES.high; }
export function onChange(fn) { Q.listeners.push(fn); }
function emit(why) {
	Q.log.push({ t: Math.round(typeof performance !== 'undefined' ? performance.now() : 0), level: Q.level, why: why });
	if (Q.log.length > 40) { Q.log.shift(); }
	Q.listeners.forEach(function (fn) { try { fn(Q.level, why); } catch (e) { /* a listener failed */ } });
}
function setLevel(l, why) {
	if (LEVELS.indexOf(l) === -1 || l === Q.level) { return false; }
	Q.level = l; Q.frames = []; Q.fastWins = 0;
	Q.cool = (typeof performance !== 'undefined' ? performance.now() : 0) + 3000;
	emit(why);
	return true;
}
// The visitor's choice ('auto' or a level), kept in this browser.
export function choose(ch) {
	if (ch !== 'auto' && LEVELS.indexOf(ch) === -1) { return; }
	Q.choice = ch; lsSet(KEY_CHOICE, ch);
	if (ch === 'auto') {
		var a = lsGet(KEY_AUTO);
		Q.ceiling = 'ultra'; Q.ceilUntil = 0;
		if (!setLevel(a && a.gpu === Q.gpu && a.level ? a.level : Q.level, 'auto')) { emit('auto'); }
	} else if (!setLevel(ch, 'visitor')) { emit('visitor'); }
}
// Result of the first-start measurement: median frame time (ms) at the current level.
// Returns the next level to measure, or '' when done.
export function needsProbe() { return autoAllowed() && !Q.probed; }
export function probeResult(ms) {
	if (!autoAllowed()) { Q.probed = true; return ''; }
	var i = idx(Q.level), next = '';
	Q.probes = (Q.probes || 0) + 1;
	if (ms > PROBE_SLOW * 2.5 && i > 0) { next = 'low'; }
	else if (ms > PROBE_SLOW && i > 0) { next = LEVELS[i - 1]; }
	else if (ms < PROBE_FAST && Q.level === 'high' && !Q.triedUp) { next = 'ultra'; Q.triedUp = true; }
	else if (ms > PROBE_SLOW * 0.8 && Q.level === 'ultra') { next = 'high'; }
	// at most three measurements; a step down is final, a step up is measured once more
	if (next && next !== Q.level && Q.probes < 3) { var up = idx(next) > i; setLevel(next, 'probe ' + Math.round(ms) + ' ms'); return up ? next : done(); }
	return done();
	function done() { Q.probed = true; lsSet(KEY_AUTO, { gpu: Q.gpu, level: Q.level, ms: Math.round(ms * 10) / 10 }); return ''; }
}
// One frame of continuous drawing (while the view turns): dt = time since the previous frame (ms).
// Returns true when the level changed.
export function frame(dt) {
	if (!autoAllowed() || !(dt > 0) || dt > 1000) { return false; }
	var now = typeof performance !== 'undefined' ? performance.now() : 0;
	if (now < Q.cool) { return false; }
	Q.frames.push(dt);
	if (Q.frames.length < 30) { return false; }
	var s = Q.frames.slice().sort(function (a, b) { return a - b; }), p75 = s[Math.floor(s.length * 0.75)];
	Q.frames = [];
	var i = idx(Q.level);
	if (now > Q.ceilUntil) { Q.ceiling = 'ultra'; }
	if (p75 > DOWN_MS && i > 0) {
		// the level just left is not tried again for half a minute
		Q.ceiling = Q.level; Q.ceilUntil = now + 30000;
		return setLevel(LEVELS[i - 1], 'slow ' + Math.round(p75) + ' ms');
	}
	if (p75 < UP_MS && i < idx(Q.ceiling) - (Q.ceilUntil > now ? 1 : 0) && i < 3) {
		if (++Q.fastWins >= 2) { return setLevel(LEVELS[i + 1], 'fast ' + Math.round(p75) + ' ms'); }
		return false;
	}
	Q.fastWins = 0;
	return false;
}
// Benchmark: pin a level without touching the visitor's choice (restore with pin(null)).
var pinned = null;
export function pin(l) {
	if (l) { if (!pinned) { pinned = { choice: Q.choice, level: Q.level }; } Q.choice = 'bench'; setLevel(l, 'bench'); return; }
	if (pinned) { var p = pinned; pinned = null; Q.choice = p.choice; if (!setLevel(p.level, 'bench end')) { emit('bench end'); } }
}
// The public face (window.AGH_3D.quality). profile() is the quality profile other modules read.
export var api = {
	levels: LEVELS.slice(),
	get: function () { return { choice: Q.choice, level: Q.level, auto: Q.choice === 'auto', probed: Q.probed, gpu: Q.gpu, log: Q.log.slice() }; },
	profile: function () { return profile(); },
	profiles: PROFILES,
	set: function (ch) { choose(ch); },
	onChange: onChange,
	// tests: feed frame times as if the view were being turned (automatic switching)
	_frame: frame, _probe: probeResult, _skipProbe: function () { Q.probed = true; }
};
