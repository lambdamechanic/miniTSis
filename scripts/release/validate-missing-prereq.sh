#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cp "$ROOT_DIR/package.json" "$TMP_DIR/package.json"
cp "$ROOT_DIR/package-lock.json" "$TMP_DIR/package-lock.json"
cp "$ROOT_DIR/.github/scripts/check-release-prereqs.sh" "$TMP_DIR/check-release-prereqs.sh"

pushd "$TMP_DIR" >/dev/null
npm ci --omit=dev >/dev/null

if bash ./check-release-prereqs.sh; then
  echo "Expected prerequisite check to fail when dev toolchain is omitted."
  exit 1
fi

popd >/dev/null

echo "Negative-path validation passed: missing publish CLI is blocked early."
