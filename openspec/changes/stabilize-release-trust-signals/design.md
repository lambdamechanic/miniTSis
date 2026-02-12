## Context

miniTSis publishes from `main` using a changeset-driven workflow, but the current publish command chain can fail in CI due to implicit CLI lookup (`turbo` not declared at the root toolchain boundary). Trust/discoverability is also inconsistent: repository-level license detection is missing, release docs point to a non-existent workflow filename, package metadata is sparse, and there are no version tags/releases for users to audit.

The broad review also surfaced additional quality risks:
- Duplicated core behavioral tests exist in both `packages/minitsis/src/index.test.ts` and `packages/minitsis-testkit/src/index.ts`.
- Browser datastore instances use global `localForage.config`, creating potential cross-instance bleed.

Those follow-ups are tracked but intentionally kept out of this change to keep release/trust remediation focused.

## Goals / Non-Goals

**Goals:**
- Make release publishing deterministic in CI with explicit toolchain resolution.
- Establish a minimum trust baseline for repository/package metadata and docs.
- Ensure each release is externally discoverable through tags/releases.
- Document manual GitHub settings that cannot be represented in code (description/topics).

**Non-Goals:**
- Refactoring core shrinker/test engine behavior.
- Consolidating duplicated test suites.
- Redesigning browser datastore internals.
- Backfilling historical tags/releases for already-published historical versions.

## Decisions

### 1. Enforce explicit publish toolchain resolution

Decision:
- The publish path SHALL invoke release CLIs through explicit resolution (`npm exec`).
- Required release CLIs SHALL be declared at the root workspace toolchain boundary (including `@changesets/cli` and `turbo` in root `devDependencies`).
- Missing tool prerequisites SHALL fail before versioning/publish side effects.

Rationale:
- Prevents command-not-found failures that are environment-dependent.
- Makes workflow behavior reproducible from clean checkouts.

Alternatives considered:
- Replace Turbo usage with explicit `npm run ... --workspace` chains.
  - Rejected for this change because it alters orchestration shape and increases command maintenance overhead.

### 2. Define a repository trust baseline in code-managed assets

Decision:
- Add a top-level license file and normalize minimum metadata for all public packages.
- Correct README workflow links/badges to existing files.
- Align/copilot guidance with this repository context.
- Standardize package metadata URLs across public packages:
  - `repository.url`: `git+https://github.com/lambdamechanic/miniTSis.git`
  - `homepage`: `https://github.com/lambdamechanic/miniTSis#readme`
  - `bugs.url`: `https://github.com/lambdamechanic/miniTSis/issues`

Rationale:
- Trust scanners and users primarily consume visible repository/package metadata.
- Broken links and missing license detection reduce installation confidence.

Alternatives considered:
- Only update README.
  - Rejected because metadata/license gaps remain unresolved for package registries and GitHub signals.

### 3. Require publish artifact visibility (tags/releases)

Decision:
- Successful publish runs SHALL create one lockstep version tag and one matching GitHub release entry per published version.
- Default tag format SHALL be `v<lockstep-version>`.
- Tag/release generation failures SHALL fail the workflow (hard-fail) after publish.
- This change SHALL guarantee artifact generation for future releases only (no historical backfill).
- Add a maintainer checklist for GitHub UI-managed metadata (description/topics).

Rationale:
- Enables users to audit release chronology and provenance.
- Handles non-code settings without pretending they are auto-managed in-repo.

Alternatives considered:
- Keep npm-only publishing without tags/releases.
  - Rejected because it perpetuates current discoverability/trust gap.

## Capability Dependency Map

Required dependencies:
- `release-artifact-visibility` -> `release-pipeline-reliability`
- `release-artifact-visibility` (manual checklist target values) -> `repository-trust-baseline`

Optional dependencies:
- `repository-trust-baseline` -> `release-artifact-visibility` (release notes/checklist can link to updated trust docs)
- `release-pipeline-reliability` local validation outputs -> `release-artifact-visibility` verification (shared evidence reuse)

## Risks / Trade-offs

- [Tag/release automation complexity] -> Mitigate by using existing GitHub workflow permissions and narrow post-publish steps.
- [Metadata drift across packages] -> Mitigate with a documented metadata baseline and PR review checks.
- [Potential behavior change in release flow timing] -> Mitigate by preserving existing CI gate semantics and no-changeset fast path.
- [Manual GitHub settings can still be skipped] -> Mitigate with explicit checklist and owner accountability in tasks.

## Migration Plan

1. Update publish command/tool declarations and validate in CI-like local execution.
2. Add/normalize repository and package metadata assets.
3. Add post-publish tag/release automation and validate on a staged release candidate.
4. Execute manual GitHub repository metadata updates (description/topics) per checklist.
5. Monitor next release run for successful publish + artifact generation.

Rollback:
- Revert workflow/script and metadata commits together.
- Disable tag/release step while retaining CI gating if emergency rollback is required.

## Open Questions

- None for proposal stage. Defaults are locked to `v<lockstep-version>` tags and future-only artifact guarantees (no historical backfill).
