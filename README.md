# ksbuilder

`ksbuilder` is a standalone, mobile-first website builder for the Karyra Spark ecosystem. It does not import source code from `spark`, `spark-api`, or `spark-hub`.

It is designed to work in two modes:

- standalone, with local SQLite/auth/media/publish
- integrated, through a Builder BFF and `spark-api`

## Capabilities

- Touch-first Android/PWA and desktop editor
- Blocks for hero, text, structured rich text, feature, CTA, image, gallery, statistics, quote, forms, divider, spacing, global symbols, and responsive grids
- Insert, edit, duplicate, delete, drag reorder, touch reorder, undo, and redo
- Pages, templates, layer navigator, project dashboard, and global component library
- Global theme, header/footer builder, automatic navigation, SEO, responsive visibility, and device previews
- Local media library and file manager for JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, and validated Lottie JSON
- Bulk media upload, responsive image variants, focal-point control, and folder-based asset management
- Native video, privacy-enhanced YouTube/Vimeo embeds, Lottie, and reduced-motion-aware entrance animations
- Folder-based asset organization, rename/move/delete actions, and copyable asset URLs inside the builder
- Framework-agnostic render contract with export adapters for static HTML and Next.js
- First-class metadata for `core`, `learn`, `lab`, and `hub`, including exportable hub manifest data
- Local admin authentication, CSRF, strict origin validation, session hashing, login throttling, and password rotation endpoint
- SQLite persistence with immutable revisions, optimistic locking, restore, publishing, and audit events
- Backend autosave, conflict reporting, JSON backup, static ZIP export, and Next.js ZIP export
- Public site runtime, forms inbox, sitemap, robots, health endpoints, and PWA shell
- Same-origin BFF contract for future Spark API integration

## Architecture

The editor runtime stays in SvelteKit, but the publish/export boundary is framework-agnostic:

```txt
builder schema
    |
    v
render contract
    |
    +--> static HTML export
    +--> Next.js export
    +--> future runtime adapters
```

That split keeps the editor independent from downstream runtimes and makes integration with `spark`, `spark-api`, and `spark-hub` maintainable.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5175`. The development server listens on all interfaces for testing from an Android device on the same network.

Create `.env` from `.env.example` and replace the admin password. The local backend is the default mode.

Important local settings:

```env
SPARK_BUILDER_API_MODE=local
SPARK_API_FORWARD_COOKIES=spark_api_session,__Host-spark_api_session
SPARK_BUILDER_ALLOWED_ORIGIN=http://127.0.0.1:5175
SPARK_BUILDER_ADMIN_PASSWORD=replace-with-at-least-16-random-characters
```

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

## Export Targets

Current export targets:

- Static HTML ZIP
- Next.js App Router ZIP

Both are generated from the same render contract. The editor does not hand-maintain separate block semantics per target.

Each export now includes:

- `site.contract.json`
- `hub.manifest.json`

`hub.manifest.json` is a consumer-friendly summary for `spark-hub` style catalog/listing runtimes.

The render contract also carries:

- expanded symbol blocks
- header/footer navigation structure
- responsive grid block data
- responsive image data (`src`, `srcSet`, `sizes`, focal point)

## Integration Boundary

The current Spark API admin endpoint is read-only and uses a bootstrap header token. The builder must **not** expose that token in browser code. Production publishing requires dedicated server-side CMS endpoints with authenticated admin identities, RBAC, CSRF/origin checks, rate limiting, audit logs, revision locking, and content schema validation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/INTEGRATION.md](docs/INTEGRATION.md), and [docs/SECURITY.md](docs/SECURITY.md).

## Backend Modes

- `SPARK_BUILDER_API_MODE=local`: standalone SQLite CMS, authentication, media, publishing, and forms.
- `SPARK_BUILDER_API_MODE=draft`: browser-local editing and simulated preview publishing.
- `SPARK_BUILDER_API_MODE=spark-api`: project save, publishing, session, and media requests use the same-origin Builder BFF and are forwarded to Spark API.

In `spark-api` mode, the Builder forwards only cookies explicitly listed in `SPARK_API_FORWARD_COOKIES`. This avoids leaking builder-local cookies upstream.

For Android LAN testing, set `SPARK_BUILDER_ALLOWED_ORIGIN` to the exact builder URL, for example `http://192.168.1.20:5175`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
