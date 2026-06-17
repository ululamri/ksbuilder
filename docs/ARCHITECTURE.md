# Architecture

Spark Builder is a fourth, independently deployed service. It can run completely standalone today and switch to Spark API later without changing editor components.

```txt
Android/Desktop Browser
        |
        v
Spark Builder (SvelteKit)
  - editor UI
  - block schema
  - render contract v2
  - export target adapters
  - revision history
  - server-side publish adapter
  - local SQLite CMS and auth
  - public site runtime and static export
        |
        v
Spark API CMS endpoints (future)
        |
        +--> Spark frontend content
        +--> Spark Hub content
        +--> object storage
```

## Modules

- `src/lib/builder/types.ts`: versioned content contract
- `src/lib/renderer/contract.ts`: framework-agnostic render contract
- `catalog.ts`: extensible block registry
- `image-optimizer.ts`: client-side image optimization and responsive variants
- `security.ts`: URL and slug policy
- `persistence.ts`: local draft persistence
- `publish-adapter.ts`: replaceable deployment boundary
- `src/lib/server/project-export.ts`: export target dispatcher
- `src/lib/server/static-export.ts`: static HTML adapter
- `src/lib/server/nextjs-export.ts`: Next.js adapter
- `cms-gateway.ts`: typed browser SDK for the Builder BFF
- `src/lib/server/cms-client.ts`: authenticated server-side Spark API client
- `src/routes/api/builder`: stable same-origin gateway routes
- `src/lib/components`: touch-first presentation components
- `src/lib/server/local-media.ts`: file manager, media metadata, variant grouping, focal point storage

The builder does not import code from the three Spark repositories. Local mode owns SQLite persistence. Integrated mode uses versioned JSON contracts and authenticated HTTP APIs.

## Multi-target Render Flow

The editor still runs on SvelteKit, but publishing/export is no longer tied to one runtime:

```txt
Builder project schema
        |
        v
render contract v2
        |
        +--> static HTML adapter
        +--> Next.js adapter
        +--> future React adapter
```

The critical boundary is the render contract, not the UI framework. That lets the builder keep one block schema while exporting multiple runtimes without duplicating block semantics by hand in every target.

## Builder Domain Features

- Global component library with symbol references
- Theme presets and design tokens for content width, section rhythm, button radius, typography, and surface style
- Dedicated grid layout block for mobile/tablet/desktop columns
- Header CTA, navigation editor, and footer link builder
- Local file manager with folders, rename/move/delete, and protected deletion for referenced assets
- Client-side responsive image generation with stored focal point metadata
- Public/runtime/export support for `srcset`, `sizes`, and image focal positioning

## Local Data

`SPARK_BUILDER_DATA_DIR` contains:

```txt
spark-builder.sqlite
media/
```

The database stores users, hashed sessions, projects, immutable revisions, audit events, media metadata, and form submissions. Back up the entire directory atomically.

`local_media` now stores grouping and presentation metadata in addition to the file record:

```txt
asset_group_id
variant_role
width
focal_x
focal_y
```

## Required CMS API

Before production publishing, add these routes to `spark-api` behind identity-based RBAC:

```txt
GET    /v1/cms/projects/:id
PUT    /v1/cms/projects/:id
POST   /v1/cms/projects/:id/publish
GET    /v1/cms/projects/:id/revisions
POST   /v1/cms/projects/:id/revisions/:revision/restore
POST   /v1/cms/media/upload-intents
```

Use optimistic revision numbers to prevent one editor overwriting another.

The detailed request, permission, cookie, and PostgreSQL contract is documented in [CMS_API_CONTRACT.md](CMS_API_CONTRACT.md).
