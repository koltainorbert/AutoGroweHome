#!/usr/bin/env bash
# Builds the test catalogue for tests/e2e/models.js: two own (CC0) box models packed exactly like the
# real catalogue (Meshopt + KTX2, hi/lo). Output: tests/fixtures/models/ (manifest.json + .glb).
set -euo pipefail
cd "$(dirname "$0")/../.."
GP="${GLTFPACK:-$(bin/build-tools.sh)}"
OUT=tests/fixtures/models
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
python3 tests/fixtures/make-test-models.py "$TMP" >/dev/null
for id in test_sofa test_table; do
	"$GP" -i "$TMP/$id.gltf" -o "$OUT/$id-hi.glb" -c -tc -tl 1024 >/dev/null
	"$GP" -i "$TMP/$id.gltf" -o "$OUT/$id-lo.glb" -c -tc -tl 512 >/dev/null
done
ls -l "$OUT"/*.glb | awk '{print $5, $9}'
