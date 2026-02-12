#!/usr/bin/env bash
set -euo pipefail

required_bins=(
  "changeset"
  "turbo"
)

missing=()
for bin in "${required_bins[@]}"; do
  if ! npm exec --no -- "$bin" --version >/dev/null 2>&1; then
    missing+=("$bin")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error::Missing publish prerequisites: ${missing[*]}"
  echo "Install root devDependencies before running release publish steps."
  exit 1
fi

echo "Publish prerequisites verified: ${required_bins[*]}"
