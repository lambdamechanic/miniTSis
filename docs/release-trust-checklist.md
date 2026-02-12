# Release Trust Checklist

Use this checklist for GitHub repository settings that are managed in the UI and not versioned in this repository.

Reference baseline:
- OpenSpec capability `repository-trust-baseline`
- Requirement `Trust Checklist Target Values Are Defined`
- Related requirement in `release-artifact-visibility`: `Manual Repository Metadata Steps Are Documented`

## GitHub Repository Metadata

Repository: `lambdamechanic/miniTSis`

1. Open repository settings in GitHub UI.
2. Set repository description to the exact target value:

   `A TypeScript generative testing library with internal shrinking and persistent test-case databases.`

3. Set repository topics to the exact canonical list (in this order):

   `minithesis`, `property-based-testing`, `generative-testing`, `typescript`, `shrinking`

4. Save changes and verify:
- Description matches the exact target string.
- Topics match the exact canonical list and order.
