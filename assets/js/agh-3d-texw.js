/*!
 * AutoGroweHome – texture worker: bakes procedural material pixels off the main thread.
 * Koltai Norbert – Infostudio
 */
import { bake } from './agh-3d-gen.js';

self.onmessage = function (e) {
	var d = e.data, r = bake(d.kind, d.opts, d.scale);
	self.postMessage({ id: d.id, col: r.col, nrm: r.nrm, rgh: r.rgh }, [r.col.buffer, r.nrm.buffer, r.rgh.buffer]);
};
