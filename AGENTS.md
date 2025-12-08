## Versioning policy for minitsis packages

- The workspace is versioned in lockstep across `@minitsis/core`, `minitsis-datastore`, `minitsis-node`, `minitsis-browser`, and `@minitsis/testkit`.
- When you bump one of these packages, bump all of them to the same version and update their dependency ranges accordingly (e.g. `^6.0.x` across the set).
- Keep shared dependency ranges aligned to avoid partial installs pulling mismatched builds.
- CI expects these versions to stay in sync; out-of-sync bumps can break adapter builds or tests.
