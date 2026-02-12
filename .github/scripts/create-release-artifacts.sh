#!/usr/bin/env bash
set -euo pipefail

lockstep_packages=(
  "minitsis"
  "minitsis-datastore"
  "minitsis-node"
  "minitsis-browser"
  "minitsis-testkit"
)

version="$(node -p "require('./packages/minitsis/package.json').version")"
tag="v${version}"

for pkg in "${lockstep_packages[@]}"; do
  pkg_version="$(node -p "require('./packages/${pkg}/package.json').version")"
  if [ "${pkg_version}" != "${version}" ]; then
    echo "::error::Lockstep version mismatch: ${pkg}=${pkg_version}, expected ${version}."
    exit 1
  fi
done

if git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
  echo "::error::Tag ${tag} already exists; refusing to recreate release artifacts."
  exit 1
fi

notes_file="$(mktemp)"
{
  echo "# ${tag}"
  echo
  echo "Release notes generated from changesets changelog entries."
  echo
} > "${notes_file}"

added_note="false"
for pkg in "${lockstep_packages[@]}"; do
  changelog="packages/${pkg}/CHANGELOG.md"
  if [ ! -f "${changelog}" ]; then
    continue
  fi

  section="$(
    awk -v ver="${version}" '
      $0 ~ "^## " ver "($|[[:space:]])" {in_section=1; next}
      in_section && $0 ~ "^## " {exit}
      in_section {print}
    ' "${changelog}"
  )"

  if [ -n "${section}" ]; then
    {
      echo "## ${pkg}"
      echo
      echo "${section}"
      echo
    } >> "${notes_file}"
    added_note="true"
  fi
done

if [ "${added_note}" != "true" ]; then
  echo "::error::No changesets-generated changelog entries found for ${version}."
  exit 1
fi

git tag "${tag}"
git push origin "${tag}"
gh release create "${tag}" --title "${tag}" --notes-file "${notes_file}"
