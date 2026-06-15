# Spark Builder

Standalone, mobile-first website builder for the Karyra Spark ecosystem. It does not import source code from `spark`, `spark-api`, or `spark-hub`.

## Capabilities

- Touch-first Android/PWA and desktop editor
- Blocks for hero, text, structured rich text, feature, CTA, image, gallery, statistics, quote, forms, divider, and spacing
- Insert, edit, duplicate, delete, drag reorder, touch reorder, undo, and redo
- Pages, reusable sections, templates, layer navigator, and project dashboard
- Global theme, header/footer, automatic navigation, SEO, responsive visibility, and device previews
- Local media library for JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, and validated Lottie JSON
- Native video, privacy-enhanced YouTube/Vimeo embeds, Lottie, and reduced-motion-aware entrance animations
- Framework-agnostic render contract with export adapters for static HTML and Next.js
- Local admin authentication, CSRF, strict origin validation, session hashing, login throttling, and password rotation endpoint
- SQLite persistence with immutable revisions, optimistic locking, restore, publishing, and audit events
- Backend autosave, conflict reporting, JSON backup, static ZIP export, and Next.js ZIP export
- Public site runtime, forms inbox, sitemap, robots, health endpoints, and PWA shell
- Same-origin BFF contract for future Spark API integration

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5175`. The development server listens on all interfaces for testing from an Android device on the same network.

Create `.env` from `.env.example` and replace the admin password. The local backend is the default mode.

## Verification

```bash
pnpm test
pnpm check
pnpm build
```

## Docker

```bash
export SPARK_BUILDER_ADMIN_PASSWORD='use-a-long-random-password'
docker compose up --build
```

SQLite, media, revisions, audit records, and form submissions are persisted in the `spark-builder-data` volume.

## Integration Boundary

The current Spark API admin endpoint is read-only and uses a bootstrap header token. The builder must **not** expose that token in browser code. Production publishing requires dedicated server-side CMS endpoints with authenticated admin identities, RBAC, CSRF/origin checks, rate limiting, audit logs, revision locking, and content schema validation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/INTEGRATION.md](docs/INTEGRATION.md), and [docs/SECURITY.md](docs/SECURITY.md).

## Backend Modes

- `SPARK_BUILDER_API_MODE=local`: standalone SQLite CMS, authentication, media, publishing, and forms.
- `SPARK_BUILDER_API_MODE=draft`: browser-local editing and simulated preview publishing.
- `SPARK_BUILDER_API_MODE=spark-api`: project save, publishing, session, and media requests use the same-origin Builder BFF and are forwarded to Spark API.

For Android LAN testing, set `SPARK_BUILDER_ALLOWED_ORIGIN` to the exact builder URL, for example `http://192.168.1.20:5175`.
