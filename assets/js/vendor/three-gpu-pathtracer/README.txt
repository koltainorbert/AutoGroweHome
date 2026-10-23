three-gpu-pathtracer 0.0.23 (MIT, see LICENSE) - https://github.com/gkjohnson/three-gpu-pathtracer
build/index.module.js reduced to the used export (WebGLPathTracer) and minified with esbuild 0.28.2:
  esbuild entry.js --bundle --format=esm --minify --legal-comments=none --external:three --external:three-mesh-bvh --external:three/examples/jsm/postprocessing/Pass.js
  (entry.js: export { WebGLPathTracer } from "three-gpu-pathtracer/build/index.module.js")
then the bare imports point to ../three/three.module.min.js, ../three-mesh-bvh/three-mesh-bvh.min.js and ../three/jsm/postprocessing/Pass.js.
Used by assets/js/agh-3d-photo.js ("Elo foto"), loaded only when needed.
