## ADDED Requirements

### Requirement: Successful Publish Produces Version Artifacts
A successful lockstep package publish run MUST produce discoverable version artifacts in GitHub: exactly one git tag named `v<lockstep-version>` and exactly one GitHub release entry bound to that tag for the published version set.

#### Scenario: Publish with new version succeeds
- **WHEN** packages are published from `main`
- **THEN** one `v<lockstep-version>` tag is created and pushed and one matching GitHub release entry is created

### Requirement: Artifact Generation Is Coupled To Successful Publish
Tag/release generation MUST only occur after publish succeeds; it MUST NOT run on failed or skipped publish attempts. Tag/release generation failures MUST fail the workflow.

#### Scenario: Publish step fails
- **WHEN** package publish does not complete successfully
- **THEN** no new version tag or GitHub release artifact is created

#### Scenario: No pending changesets
- **WHEN** release workflow detects no pending changesets
- **THEN** tag/release generation is skipped

#### Scenario: Artifact generation fails after publish
- **WHEN** package publish succeeds but tag or GitHub release creation fails
- **THEN** the release workflow exits in failure and reports the artifact error explicitly

### Requirement: Manual Repository Metadata Steps Are Documented
The release/trust documentation MUST include a maintainer checklist at `docs/release-trust-checklist.md` for GitHub UI-only settings that cannot be represented in repository files (at minimum: repository description and topics). This checklist MUST reference metadata baselines defined by `repository-trust-baseline`.

#### Scenario: Maintainer prepares repository trust settings
- **WHEN** a maintainer follows the release/trust checklist
- **THEN** it explicitly identifies required GitHub UI updates and expected target values

### Requirement: Historical Backfill Is Out Of Scope By Default
This change MUST guarantee tag/release artifact generation for releases published after adoption and MUST NOT require automatic backfill of historical published versions.

#### Scenario: Existing historical versions are present before rollout
- **WHEN** the updated release workflow is deployed
- **THEN** future successful releases generate required artifacts without requiring historical artifact reconstruction
