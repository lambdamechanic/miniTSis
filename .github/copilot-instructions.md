# GitHub Copilot Instructions for miniTSis

## Project Context

miniTSis is a TypeScript monorepo for generative/property-based testing with internal shrinking and persistent test-case databases.

Packages in this workspace:
- `minitsis` (core generators/runtime)
- `minitsis-datastore` (shared persistence wrapper)
- `minitsis-node` (Node adapter)
- `minitsis-browser` (browser adapter)
- `minitsis-testkit` (shared test helpers; private)

## Workflow Expectations

- Keep package versions in lockstep across `minitsis`, `minitsis-datastore`, `minitsis-node`, `minitsis-browser`, and `minitsis-testkit`.
- Use the release workflow file name as it exists in-repo: `.github/workflows/main-release.yml`.
- Prefer targeted, minimal diffs that preserve current behavior unless a task explicitly requires change.

## Build, Test, and Validation

Run from repo root unless a task says otherwise:

```bash
npm ci
npm exec --no -- turbo run build lint test
npm run release:check-prereqs
npm run release:validate-missing-prereq
npm run release:validate-artifact-coupling
```

For OpenSpec changes, run strict validation:

```bash
openspec validate <change-id> --strict
```

## Issue Tracking

This repository tracks work in `.beads/`. Use `br` commands with JSON output for automation:

```bash
br ready --json
br show <id> --json
br update <id> --status in_progress --json
br close <id> --reason "Done" --json
```

Do not create markdown TODO trackers.

## Editing Guidelines

- Keep changes scoped to task acceptance criteria.
- Update tests/docs when behavior or developer workflow changes.
- Avoid destructive git commands unless explicitly requested.
