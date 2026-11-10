#!/usr/bin/env bash
# Copies the Supertext TypeScript SDK (built JavaScript and types) into vendor/supertext-sdk.
# Source: https://github.com/Supertext/Supertext-API-SDK-Guide (sdk/typescript).
#
#   scripts/vendor-sdk.sh [commit-or-branch]        (default: main)
#   SDK_DIR=/path/to/clone scripts/vendor-sdk.sh    (use a local clone as it is)
#
# It is a dependency of the app ("supertext-sdk": "file:vendor/supertext-sdk"); the Docker
# image copies vendor/ before npm ci. Same script as the other Supertext plugins (e.g. Directus).
set -euo pipefail
cd "$(dirname "$0")/.."
ref="${1:-main}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [ -n "${SDK_DIR:-}" ]; then
  src="$(cd "$SDK_DIR" && pwd)"
else
  git clone -q https://github.com/Supertext/Supertext-API-SDK-Guide "$work/sdk"
  git -C "$work/sdk" checkout -q "$ref"
  src="$work/sdk"
fi
commit="$(git -C "$src" rev-parse HEAD)"
version="$(node -p "require('$src/sdk/typescript/package.json').version")"
cp -R "$src/sdk/typescript" "$work/ts"
rm -rf "$work/ts/node_modules" "$work/ts/dist"
(cd "$work/ts" && npm ci --no-audit --no-fund --silent && npm run --silent build)
rm -rf vendor/supertext-sdk
mkdir -p vendor/supertext-sdk
# dist/ has the version-neutral index and one folder per API version (v1/): copy the tree.
(cd "$work/ts/dist" && find . \( -name '*.js' -o -name '*.d.ts' \) | while read -r f; do mkdir -p "$OLDPWD/vendor/supertext-sdk/$(dirname "$f")"; cp "$f" "$OLDPWD/vendor/supertext-sdk/$f"; done)
cp "$src/sdk/typescript/LICENSE" vendor/supertext-sdk/LICENSE
printf '{\n  "name": "supertext-sdk",\n  "version": "%s",\n  "private": true,\n  "type": "module",\n  "main": "./index.js",\n  "types": "./index.d.ts",\n  "exports": {\n    ".": { "types": "./index.d.ts", "import": "./index.js" },\n    "./v1": { "types": "./v1/index.d.ts", "import": "./v1/index.js" }\n  },\n  "license": "MIT"\n}\n' "$version" > vendor/supertext-sdk/package.json
printf '%s\n' "$commit" > vendor/supertext-sdk/COMMIT
printf '%s\n' "$version" > vendor/supertext-sdk/VERSION
printf '# Supertext SDK (bundled copy)\n\nBuilt JavaScript of the TypeScript part of the [Supertext SDK](https://github.com/Supertext/Supertext-API-SDK-Guide),\nversion %s, commit `%s`.\n\nDon'"'"'t edit these files: fix the SDK in its own repository, then run `scripts/vendor-sdk.sh`.\n' "$version" "$commit" > vendor/supertext-sdk/README.md
# package-lock.json records the linked package's version: update it when that changed.
if [ "$(node -p "require('./package-lock.json').packages['vendor/supertext-sdk']?.version ?? ''")" != "$version" ]; then
  npm install --package-lock-only --no-audit --no-fund --silent
fi
echo "vendor/supertext-sdk: Supertext SDK (TypeScript) $version from commit $commit"
