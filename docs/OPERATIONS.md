# Operations

## Required Production Variables

```env
NODE_ENV=production
ORIGIN=https://builder.example.com
SPARK_BUILDER_API_MODE=local
SPARK_BUILDER_ALLOWED_ORIGIN=https://builder.example.com
SPARK_BUILDER_DATA_DIR=/data
SPARK_BUILDER_ADMIN_EMAIL=admin@example.com
SPARK_BUILDER_ADMIN_PASSWORD=<unique random value, at least 16 characters>
```

Terminate TLS at a trusted reverse proxy and preserve `Host`, `Origin`, and `X-Forwarded-Proto` headers.

## Backup

1. Stop writes or snapshot the persistent volume.
2. Back up `/data/spark-builder.sqlite` including WAL files and `/data/media`.
3. Encrypt the backup and test restoration regularly.

## Health

```txt
GET /health/live
GET /health/ready
```

## Media Limits

- JPEG, PNG, WebP, AVIF: 10 MB
- GIF: 15 MB
- MP4, WebM: 50 MB
- Lottie JSON: 2 MB

Video endpoints support HTTP byte ranges. Large media should still be placed behind a CDN or object store for public production traffic.

## Security Maintenance

- Rotate the admin password and active sessions after personnel changes.
- Review audit events and form submissions with least privilege.
- Run `pnpm audit --audit-level high` when registry access is available.
- Keep Node.js 24, SvelteKit, and container base images patched.
