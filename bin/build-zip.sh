#!/usr/bin/env bash
# Builds the installable plugin ZIP from the committed sources.
#
# Usage: bin/build-zip.sh   (raise the version before every release: bin/bump-version.sh)
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

# the version must be the same everywhere
H="$(sed -n -E 's/^ \* Version:[[:space:]]+([^[:space:]]+).*/\1/p' autogrowehome.php)"
R="$(sed -n 's/^Stable tag: //p' readme.txt)"
if [ "$H" != "$VERSION" ] || [ "$R" != "$VERSION" ] || ! grep -q "^## $VERSION " CHANGELOG.md; then
	echo "Version mismatch: AGH_VERSION=$VERSION header=$H readme=$R (CHANGELOG.md needs '## $VERSION')" >&2
	exit 1
fi

# every release gets a new version: a ZIP of this version that is already committed must not be rebuilt
# (bin/bump-version.sh first). AGH_REBUILD=1 overrides, e.g. to repair a broken build of the same commit.
if [ -n "$(git ls-files "dist/autogrowehome-${VERSION}.zip")" ] && [ "${AGH_REBUILD:-0}" != "1" ]; then
	echo "Version $VERSION has already been released (dist/autogrowehome-${VERSION}.zip is committed)." >&2
	echo "Raise the version first: bin/bump-version.sh [patch|minor|major]" >&2
	exit 1
fi

if [ -n "$(git status --porcelain -- . ':!dist')" ]; then
	echo "Uncommitted changes – commit before building." >&2
	exit 1
fi

mkdir -p dist
OUT="dist/autogrowehome-${VERSION}.zip"
# only the newest release stays in dist/
find dist -maxdepth 1 -name 'autogrowehome-*.zip' ! -name "autogrowehome-${VERSION}.zip" -delete
rm -f "$OUT"
git archive --format=zip --prefix=autogrowehome/ -o "$OUT" HEAD

echo "$OUT  $(wc -c < "$OUT") bytes  sha256 $(sha256sum "$OUT" | cut -d' ' -f1)"
