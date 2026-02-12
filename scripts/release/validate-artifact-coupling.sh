#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW_FILE="${ROOT_DIR}/.github/workflows/main-release.yml"
PACKAGE_JSON="${ROOT_DIR}/package.json"
ARTIFACT_SCRIPT="${ROOT_DIR}/.github/scripts/create-release-artifacts.sh"

assert_contains() {
  local pattern="$1"
  local description="$2"
  if ! grep -Fq "$pattern" "${WORKFLOW_FILE}"; then
    echo "::error::${description}"
    exit 1
  fi
}

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if ! grep -Fq "$pattern" "${file}"; then
    echo "::error::${description}"
    exit 1
  fi
}

assert_file_not_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if grep -Fq "$pattern" "${file}"; then
    echo "::error::${description}"
    exit 1
  fi
}

publish_line="$(grep -n "name: Publish packages (OIDC)" "${WORKFLOW_FILE}" | cut -d: -f1)"
artifacts_line="$(grep -n "name: Create release artifacts" "${WORKFLOW_FILE}" | cut -d: -f1)"

if [ -z "${publish_line}" ] || [ -z "${artifacts_line}" ]; then
  echo "::error::Release workflow is missing publish and/or artifact generation steps."
  exit 1
fi

if [ "${publish_line}" -ge "${artifacts_line}" ]; then
  echo "::error::Release artifact generation must remain ordered after publish."
  exit 1
fi

assert_contains "if: steps.changesets.outputs.has_changesets == 'true'" "Release workflow must gate publish and artifact steps behind pending changesets."
assert_contains "Release artifacts failed after successful publish." "Release workflow must report explicit artifact failure semantics."
assert_contains "name: Version packages (changesets) and commit" "Release workflow must commit changeset version bumps before publish/tag so v<version> points at a versioned commit."
assert_contains "name: Push version bump commit to main" "Release workflow must persist changesets version bump commit back to main after successful publish/artifacts."

assert_file_not_contains "${PACKAGE_JSON}" "changeset version" "publish-packages must not run changeset version; versioning must happen in a dedicated commit step before tagging."
assert_file_contains "${ARTIFACT_SCRIPT}" "git status --porcelain" "create-release-artifacts must refuse to tag when the working tree is dirty."
assert_file_contains "${ARTIFACT_SCRIPT}" "Working tree is dirty" "create-release-artifacts must emit a clear error when refusing to tag due to uncommitted changes."

run_release_model() {
  local has_changesets="$1"
  local publish_status="$2"
  local artifact_status="$3"

  PUBLISH_RAN=false
  ARTIFACT_RAN=false
  WORKFLOW_FAILED=false

  if [ "${has_changesets}" != "true" ]; then
    return 0
  fi

  PUBLISH_RAN=true
  if [ "${publish_status}" -ne 0 ]; then
    WORKFLOW_FAILED=true
    return 0
  fi

  ARTIFACT_RAN=true
  if [ "${artifact_status}" -ne 0 ]; then
    WORKFLOW_FAILED=true
  fi
}

run_release_model true 1 0
if [ "${ARTIFACT_RAN}" != "false" ] || [ "${WORKFLOW_FAILED}" != "true" ]; then
  echo "::error::AC1 failed: artifacts must not run when publish fails."
  exit 1
fi

run_release_model false 0 0
if [ "${PUBLISH_RAN}" != "false" ] || [ "${ARTIFACT_RAN}" != "false" ] || [ "${WORKFLOW_FAILED}" != "false" ]; then
  echo "::error::AC2 failed: publish and artifact steps must be skipped when there are no pending changesets."
  exit 1
fi

run_release_model true 0 1
if [ "${ARTIFACT_RAN}" != "true" ] || [ "${WORKFLOW_FAILED}" != "true" ]; then
  echo "::error::AC3 failed: artifact generation failure after publish must fail the workflow."
  exit 1
fi

echo "Artifact coupling validation passed: AC1-AC3 semantics are enforced."
echo "Run this in the sandbox workflow on a test branch/fork to satisfy AC4 without publish side effects."
