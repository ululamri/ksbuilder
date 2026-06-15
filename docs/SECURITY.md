# Security Baseline

## Implemented in this repository

- No arbitrary HTML, JavaScript, iframe, or inline script blocks
- External images require HTTPS
- Links allow same-site paths or HTTPS only
- Content is rendered through Svelte text interpolation
- Versioned data schema and bounded spacer values
- Browser credentials are sent only through `credentials: include`
- Secrets are not stored in `PUBLIC_` environment variables
- Passwords use salted scrypt hashes
- Session tokens are random and stored only as SHA-256 hashes
- Mutation requests require strict same-origin CSRF validation
- Login and public form submissions are rate limited
- Production rejects the default or short admin password
- Media type/size policies and random storage names
- Media signatures are verified instead of trusting file extensions
- Autoplay video defaults to muted and inline playback
- Entrance animation honors `prefers-reduced-motion`
- Immutable project revisions and audit events
- Imported JSON is bounded and schema-normalized

## Required before production

- When integrated with Spark API, replace its bootstrap admin token with identity-based RBAC and short-lived sessions
- Enforce CSRF tokens plus strict Origin/Host validation on every mutation
- Add per-user and per-IP rate limits
- Validate the complete block schema server-side and reject unknown fields
- Add immutable audit events for edit, publish, restore, media, and permission actions
- Scan uploaded media, validate MIME signatures, strip metadata, and cap dimensions/file sizes
- Apply CSP, HSTS, `frame-ancestors`, `nosniff`, Referrer-Policy, and Permissions-Policy headers
- Encrypt backups, rotate keys, test restore procedures, and redact secrets from logs
- Add revision conflict handling, publish approval rules, and optional WebAuthn MFA for administrators
- Run dependency, SAST, secret, container, and DAST scans in CI
