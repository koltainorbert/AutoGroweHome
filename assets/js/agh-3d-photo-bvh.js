/*!
 * AutoGroweHome – „Élő fotó” BVH worker: builds the ray tracing acceleration structure off the main
 * thread, so the page never stalls while the scene is prepared for the path tracer.
 * Koltai Norbert – Infostudio
 */
import { BufferGeometry, BufferAttribute } from './vendor/three/three.module.min.js';
import { MeshBVH } from './vendor/three-mesh-bvh/three-mesh-bvh.min.js';

self.onmessage = function (e) {
	var d = e.data;
	try {
		var t0 = performance.now(), g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(d.position, 3, false));
		if (d.index) { g.setIndex(new BufferAttribute(d.index, 1, false)); }
		var bvh = new MeshBVH(g, d.options || {});
		var s = MeshBVH.serialize(bvh, { cloneBuffers: false });
		var tr = s.roots.slice();
		if (s.indirectBuffer) { tr.push(s.indirectBuffer.buffer); }
		self.postMessage({ id: d.id, roots: s.roots, indirectBuffer: s.indirectBuffer, ms: performance.now() - t0 }, tr);
	} catch (err) {
		self.postMessage({ id: d.id, error: String((err && err.message) || err) });
	}
};
