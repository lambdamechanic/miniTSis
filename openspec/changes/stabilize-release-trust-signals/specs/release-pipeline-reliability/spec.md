## ADDED Requirements

### Requirement: Publish Toolchain Is Explicit And CI-Resolvable
The release publish path MUST only invoke CLIs through explicit resolution (`npm exec` or equivalent) and MUST NOT depend on implicit binary discovery behavior. Required release CLIs (`@changesets/cli`, `turbo`) MUST be declared at the root workspace toolchain boundary.

#### Scenario: Publish command runs with declared tools
- **WHEN** the release job runs with pending `.changeset/*.md` files
- **THEN** every CLI used by `publish-packages` resolves without `command not found` errors

#### Scenario: Missing publish prerequisite blocks release early
- **WHEN** a required publish CLI is unavailable
- **THEN** the release job fails before versioning or publish side effects and surfaces a clear prerequisite error

### Requirement: Release Remains Gated By Adapter CI Results
Package publishing MUST remain blocked unless both Node Adapter CI and Browser Adapter CI complete successfully for the same `main` commit.

#### Scenario: Both adapter CI workflows succeed
- **WHEN** Node and Browser workflow results are both `success`
- **THEN** the release workflow continues to publish checks and publish steps

#### Scenario: One adapter CI workflow is skipped or fails
- **WHEN** either adapter workflow result is `skipped` or not `success`
- **THEN** the release workflow exits with a blocking error and does not publish packages

### Requirement: No-Changeset Path Is Safe
The release workflow MUST be a no-op for publishing when no `.changeset/*.md` files are present.

#### Scenario: No pending changesets
- **WHEN** the release workflow runs and no changeset markdown files exist
- **THEN** install/publish steps are skipped and no publish/tag/release action is attempted
