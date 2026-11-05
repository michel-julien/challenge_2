# Security checker

The checker reviews the `unsecure`, `secure`, and `frontend` projects for:

- the Node.js version used in Dockerfile
- the current Node.js lifecycle status and latest release
- dependency vulnerabilities with `npm audit`
- items that require security review.

Run it from the repository root:

```bash
node security-checker/check-security.mjs
```

Run the automated checker tests:

```bash
node --test tests/security-checker.test.mjs
```

The dependency audit uses a temporary npm project generated from each
`package.json`. This keeps the repository's pnpm lockfiles unchanged.

Useful options:

```bash
node security-checker/check-security.mjs --project=secure
node security-checker/check-security.mjs --json
node security-checker/check-security.mjs --skip-audit
```
