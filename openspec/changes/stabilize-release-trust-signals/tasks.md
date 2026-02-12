## 1. Release Pipeline Reliability

- [ ] 1.1 Update root publish tooling so every CLI in `publish-packages` is explicitly resolvable in CI (no implicit binary lookup). Depends on: none.
- [ ] 1.2 Add a pre-publish prerequisite check in `.github/workflows/main-release.yml` that fails fast with clear diagnostics when required publish tools are unavailable. Depends on: 1.1.
- [ ] 1.3 Preserve and validate existing release gate semantics: both adapter workflows must be `success`, and no publish work runs when no changesets exist. Depends on: none. Optional-after: 1.2.
- [ ] 1.4 Validate release command chain locally in CI-like order (`npm ci`, shared package builds/tests) without performing an actual npm publish. Depends on: 1.1, 1.2, 1.3.

## 2. Repository Trust Baseline

- [ ] 2.1 Add a top-level license file consistent with the effective license for public packages. Depends on: none.
- [ ] 2.2 Normalize metadata fields (`description`, `license`, `repository`, `homepage`, `bugs`, `keywords`) across all public package manifests. Depends on: none. Optional-after: 2.1.
- [ ] 2.3 Update `README.md` release badge/path references so they point at existing workflow filenames. Depends on: none. Optional-after: 2.2.
- [ ] 2.4 Replace or rewrite `.github/copilot-instructions.md` so it accurately describes miniTSis workflows and conventions. Depends on: none. Optional-after: 2.2.

## 3. Release Artifact Visibility

- [ ] 3.1 Extend the release workflow to create/push version tags and GitHub release entries only after successful publish. Depends on: 1.3. Optional-after: 1.1, 1.2.
- [ ] 3.2 Document and verify skip behavior for tag/release generation when publish fails or when no changesets are present. Depends on: 3.1. Optional-after: 1.4.
- [ ] 3.3 Add a maintainer checklist documenting GitHub UI-only trust settings (repository description/topics) and target values. Depends on: 2.2. Optional-after: 2.3, 2.4.

## 4. Validation And Follow-Up Tracking

- [ ] 4.1 Run `openspec validate stabilize-release-trust-signals --strict`, plus workflow/task-level verification for sections 1-3, and resolve all findings. Depends on: 1.4, 2.4, 3.2, 3.3.
- [ ] 4.2 Link out-of-scope review findings to tracked follow-up issues (test-suite deduplication and browser datastore instance isolation). Depends on: none. Optional-after: 4.1.

## 5. Capability Dependency Edges

- [ ] 5.1 Record required capability dependency in change docs: `release-artifact-visibility` depends on `release-pipeline-reliability`. Depends on: 1.3, 3.1.
- [ ] 5.2 Record required capability dependency in change docs: checklist target values in `release-artifact-visibility` depend on `repository-trust-baseline`. Depends on: 2.2, 3.3.
- [ ] 5.3 Record optional capability dependency in change docs: `repository-trust-baseline` updates can enhance release artifact docs/notes. Depends on: none. Optional-after: 2.3, 3.2.
