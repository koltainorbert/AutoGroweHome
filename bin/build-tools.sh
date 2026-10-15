#!/usr/bin/env bash
# Builds gltfpack (meshoptimizer) with Basis Universal (KTX2) support, once, into a cache directory.
# The model build (bin/build-models.sh) uses it. Sources come from GitHub; nothing is installed system-wide.
#
# Usage: bin/build-tools.sh            -> prints the path of the gltfpack binary
set -euo pipefail
CACHE="${AGH_TOOLS:-$HOME/.cache/agh-tools}"
BIN="$CACHE/meshoptimizer/build/gltfpack"
if [ -x "$BIN" ]; then echo "$BIN"; exit 0; fi
mkdir -p "$CACHE"
cd "$CACHE"
[ -d meshoptimizer ] || git clone -q --depth 1 --branch v0.25 https://github.com/zeux/meshoptimizer meshoptimizer
[ -d basis_universal ] || git clone -q --depth 1 --branch gltfpack https://github.com/zeux/basis_universal basis_universal
cmake -S meshoptimizer -B meshoptimizer/build -DMESHOPT_BUILD_GLTFPACK=ON -DMESHOPT_GLTFPACK_BASISU_PATH="$CACHE/basis_universal" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build meshoptimizer/build --target gltfpack -j"$(nproc 2>/dev/null || echo 4)" >/dev/null
echo "$BIN"
