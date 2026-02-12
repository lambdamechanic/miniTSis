## Why

The current release pipeline is blocked by a reproducible toolchain failure (`turbo: not found`) in the publish path, preventing package delivery despite green adapter CI. At the same time, repository trust signals are weak (missing top-level license detection, broken release badge path, no tag/release artifacts, and sparse metadata), which limits adoption confidence relative to real download usage.

## What Changes

- Stabilize publish execution so the release workflow does not depend on implicit CLI resolution.
- Define and implement a repository trust baseline (license visibility, package metadata minimums, accurate release/docs links).
- Add release artifact visibility requirements so each publish produces discoverable version history (tags/releases) and a repeatable operator checklist for GitHub UI-only settings.
- Capture broad-review follow-up findings (test duplication and browser datastore isolation) as linked tracked work, without expanding this change scope.

## Capabilities

### New Capabilities

- `release-pipeline-reliability`: Ensure release publish steps are deterministic and executable in CI from a clean checkout.
- `repository-trust-baseline`: Ensure repository and package metadata meets a minimum trust/discoverability baseline.
- `release-artifact-visibility`: Ensure publishes produce visible version artifacts and operator guidance for non-code repository settings.
  Depends on `release-pipeline-reliability` for publish success gating and on `repository-trust-baseline` for checklist target values.

### Modified Capabilities

- None.

## Impact

- Affected workflows: `.github/workflows/main-release.yml`.
- Affected packaging metadata: `package.json`, `packages/*/package.json`.
- Affected repository docs/trust signals: `README.md`, top-level `LICENSE`, `.github/copilot-instructions.md` (repo-specific alignment).
- Affected release operations: tag/release creation process and maintainer checklist for GitHub description/topics.
