#!/usr/bin/env bash
# Builds the installable plugin ZIP from the committed sources.
#
# Usage: bin/build-zip.sh
# Output: dist/autogrowehome-<version>.zip (top-level folder: autogrowehome/)
#
# Only files tracked by git are packaged; development files are left out via
# the "export-ignore" rules in .gitattributes. Uncommitted changes are NOT
# included – commit first.
set -euo pipefail

cd "$(dirname "$0")/.."

php tests/autoloader-test.php

VERSION="$(sed -n "s/^define( 'AGH_VERSION', '\([^']*\)' );.*/\1/p" autogrowehome.php)"
if [ -z "$VERSION" ]; then
	echo "AGH_VERSION not found in autogrowehome.php" >&2
	exit 1
fi

if [ -n "$(git status --porcelain -- . ':!dist')" ]; then
	echo "Uncommitted changes – commit before building." >&2
	exit 1
fi

mkdir -p dist
OUT="dist/autogrowehome-${VERSION}.zip"
rm -f "$OUT"
git archive --format=zip --prefix=autogrowehome/ -o "$OUT" HEAD

echo "$OUT  $(wc -c < "$OUT") bytes  sha256 $(sha256sum "$OUT" | cut -d' ' -f1)"
