## ADDED Requirements

### Requirement: Repository License Is Discoverable
The repository MUST include a top-level license file that matches the effective license used by published public packages.

#### Scenario: License scanner checks repository root
- **WHEN** GitHub or another scanner evaluates repository licensing
- **THEN** it finds a top-level license file with a valid SPDX-recognizable license text

### Requirement: Public Package Metadata Meets Baseline
Each public package (`minitsis`, `minitsis-node`, `minitsis-browser`, `minitsis-datastore`) MUST define non-empty `description`, `license`, `repository`, `homepage`, `bugs`, and `keywords` metadata fields. Repository URL values MUST consistently target `https://github.com/lambdamechanic/miniTSis`.

#### Scenario: Consumer inspects package manifest metadata
- **WHEN** a user or scanner reads each public package manifest
- **THEN** the baseline metadata fields are present and non-empty

#### Scenario: Consumer inspects package repository links
- **WHEN** a user follows `repository`, `homepage`, or `bugs` URLs from any public package manifest
- **THEN** links resolve to miniTSis GitHub repository pages

### Requirement: Release Documentation Links Are Valid
Repository documentation MUST reference existing workflow file names for release status and instructions.

#### Scenario: User follows release documentation links
- **WHEN** a user opens release badge links or referenced workflow paths from README
- **THEN** the linked workflow file exists and resolves correctly

### Requirement: Repository Automation Guidance Matches Project
Contributor automation instructions in `.github/copilot-instructions.md` MUST describe this repository’s workflows and commands rather than unrelated projects.

#### Scenario: Contributor reads copilot instructions
- **WHEN** an AI-assisted contributor uses `.github/copilot-instructions.md`
- **THEN** the instructions reference miniTSis packages, workflows, and issue-tracking conventions accurately

### Requirement: Trust Checklist Target Values Are Defined
Repository documentation MUST define explicit target values for GitHub UI-only trust settings in `docs/release-trust-checklist.md`, including repository description and topic list.

#### Scenario: Maintainer executes trust checklist
- **WHEN** a maintainer opens `docs/release-trust-checklist.md`
- **THEN** repository description and topics have explicit expected values that can be verified after manual update
