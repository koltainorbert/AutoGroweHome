three-mesh-bvh 0.8.3 (MIT, see LICENSE) - https://github.com/gkjohnson/three-mesh-bvh
build/index.module.js reduced to the exports three-gpu-pathtracer and agh-3d-photo use (MeshBVH, SAH, FloatVertexAttributeTexture, MeshBVHUniformStruct, UIntVertexAttributeTexture, BVHShaderGLSL)
and minified with esbuild 0.28.2 (--bundle --format=esm --minify --legal-comments=none --external:three); the bare "three" import points to ../three/three.module.min.js.
The BVH worker is the plugin's own assets/js/agh-3d-photo-bvh.js.
