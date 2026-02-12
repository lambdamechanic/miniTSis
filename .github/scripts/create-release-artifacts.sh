#!/usr/bin/env bash
set -euo pipefail

lockstep_packages=(
  "minitsis"
  "minitsis-datastore"
  "minitsis-node"
  "minitsis-browser"
  "minitsis-testkit"
)

die() {
  echo "::error::$*" 1>&2
  exit 1
}

note() {
  echo "$*" 1>&2
}

require_bin() {
  local bin="$1"
  command -v "$bin" >/dev/null 2>&1 || die "Missing required command: ${bin}"
}

require_bin node
require_bin git
require_bin gh

# Validate GH auth first so we don't mutate git remotes only to fail later.
if [ -z "${GH_TOKEN:-}" ]; then
  die "GH_TOKEN is required (used by gh CLI for release creation)."
fi
if ! gh api /user >/dev/null 2>&1; then
  die "GitHub auth failed (gh api /user). Ensure GH_TOKEN is valid and has repo permissions."
fi

version="$(node -p "require('./packages/minitsis/package.json').version")"
tag="v${version}"

for pkg in "${lockstep_packages[@]}"; do
  pkg_version="$(node -p "require('./packages/${pkg}/package.json').version")"
  if [ "${pkg_version}" != "${version}" ]; then
    die "Lockstep version mismatch: ${pkg}=${pkg_version}, expected ${version}."
  fi
done

# Determine the repo explicitly when possible (more robust for forks / non-origin remotes).
repo="${GITHUB_REPOSITORY:-}"
if [ -z "${repo}" ]; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi
repo_flag=()
if [ -n "${repo}" ]; then
  repo_flag+=(--repo "${repo}")
fi

# Fetch tags for accurate remote state, but do not mutate anything yet.
if git remote get-url origin >/dev/null 2>&1; then
  git fetch --tags --quiet origin || die "Failed to fetch tags from origin."
else
  die "Missing git remote 'origin' (required to push/fetch tags)."
fi

# If the GitHub release already exists, we are done (idempotent no-op).
if gh release view "${tag}" "${repo_flag[@]}" >/dev/null 2>&1; then
  note "Release ${tag} already exists; nothing to do."
  exit 0
fi

notes_file="$(mktemp)"
cleanup() { rm -f "${notes_file}"; }
trap cleanup EXIT

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
  die "No changesets-generated changelog entries found for ${version}."
fi

# Ensure a tag exists remotely and points at HEAD. This is recoverable:
# - If the tag exists (from a partial prior run), we won't fail; we will just create the missing GH release.
head_sha="$(git rev-parse HEAD)"
remote_sha="$(
  git ls-remote --tags origin "refs/tags/${tag}^{}" | awk '{print $1}' | head -n1
)"

if [ -n "${remote_sha}" ]; then
  if [ "${remote_sha}" != "${head_sha}" ]; then
    die "Remote tag ${tag} exists but points to ${remote_sha}, expected HEAD ${head_sha}."
  fi
else
  local_sha=""
  if git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
    local_sha="$(git rev-list -n1 "${tag}")"
    if [ "${local_sha}" != "${head_sha}" ]; then
      die "Local tag ${tag} exists but points to ${local_sha}, expected HEAD ${head_sha}."
    fi
  else
    git tag "${tag}"
  fi

  # Push the tag if it doesn't exist remotely yet.
  git push origin "${tag}"
fi

# Release was missing above; create it now. If another runner created it concurrently, treat as success.
if ! gh release create "${tag}" --title "${tag}" --notes-file "${notes_file}" "${repo_flag[@]}"; then
  if gh release view "${tag}" "${repo_flag[@]}" >/dev/null 2>&1; then
    note "Release ${tag} appeared concurrently; continuing."
  else
    die "Failed to create GitHub release for ${tag}."
  fi
fi
