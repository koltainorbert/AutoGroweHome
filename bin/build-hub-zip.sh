#!/usr/bin/env bash
# Builds the installable ZIP of the AGH Licencközpont (license-hub/) from the committed sources.
#
# Usage:  bin/build-hub-zip.sh        (raise the version first: bin/bump-hub-version.sh)
# Output: dist/agh-license-hub-<version>.zip (top-level folder: agh-license-hub/)
set -euo pipefail
cd "$(dirname "$0")/.."

F=license-hub/agh-license-hub.php
VERSION="$(sed -n "s/^define( 'AGHLS_VERSION', '\([^']*\)' );.*/\1/p" "$F")"
H="$(sed -n -E 's/^ \* Version:[[:space:]]+([^[:space:]]+).*/\1/p' "$F")"
R="$(sed -n 's/^Stable tag: //p' license-hub/readme.txt)"
if [ -z "$VERSION" ] || [ "$H" != "$VERSION" ] || [ "$R" != "$VERSION" ] || ! grep -q "^= $VERSION =\$" license-hub/readme.txt; then
	echo "Version mismatch: AGHLS_VERSION=$VERSION header=$H readme=$R (readme changelog needs '= $VERSION =')" >&2
	exit 1
fi
if [ -n "$(git ls-files "dist/agh-license-hub-${VERSION}.zip")" ] && [ "${AGH_REBUILD:-0}" != "1" ]; then
	echo "Licencközpont $VERSION has already been released – raise the version: bin/bump-hub-version.sh" >&2
	exit 1
fi
if [ -n "$(git status --porcelain -- license-hub)" ]; then
	echo "Uncommitted changes in license-hub/ – commit before building." >&2
	exit 1
fi
for f in license-hub/*.php license-hub/includes/*.php; do php -l "$f" > /dev/null; done

mkdir -p dist
OUT="dist/agh-license-hub-${VERSION}.zip"
find dist -maxdepth 1 -name 'agh-license-hub-*.zip' ! -name "agh-license-hub-${VERSION}.zip" -delete
rm -f "$OUT"
git archive --format=zip --prefix=agh-license-hub/ -o "$OUT" HEAD:license-hub
echo "$OUT  $(wc -c < "$OUT") bytes  sha256 $(sha256sum "$OUT" | cut -d' ' -f1)"
