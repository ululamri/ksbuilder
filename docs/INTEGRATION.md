# Integration Guide

This document describes how `ksbuilder` integrates with:

- `spark`: public-facing site runtime or consumer application
- `spark-api`: CMS API, auth, persistence, media, and publishing control plane
- `spark-hub`: secondary consumer/runtime for selected published content

The intent is to keep `ksbuilder` deployable by itself while still allowing a clean production path into the Spark ecosystem.

## Repository Roles

```txt
ksbuilder
  - mobile-first editor
  - local CMS fallback
  - render contract
  - export adapters
  - Builder BFF

spark-api
  - authenticated CMS API
  - RBAC
  - revision storage
  - media intents
  - publish orchestration
  - audit log

spark
  - public runtime consuming published project/page data
  - optional static asset host
  - domain/frontend integration

spark-hub
  - optional second runtime for selected published content
  - catalog/discovery surface
```

## Integration Modes

### 1. Standalone

`ksbuilder` runs with:

- local SQLite
- local auth
- local media
- local publish

Use this mode for development and early staging.

```env
SPARK_BUILDER_API_MODE=local
```

### 2. Draft

Browser-local editing only, no real backend persistence.

```env
SPARK_BUILDER_API_MODE=draft
```

### 3. Spark API

Production integration path. The browser still talks only to `ksbuilder`, and `ksbuilder` forwards server-side requests to `spark-api`.

```env
SPARK_BUILDER_API_MODE=spark-api
SPARK_API_URL=https://api.example.com
SPARK_API_BOOTSTRAP_TOKEN=replace-me
```

The Builder advertises CMS contract version `2026-06-22` and keeps a compatibility path for the prior `2026-06-13` response shape. The BFF also normalizes common snake_case backend payloads before they reach the editor UI.

## High-level Request Flow

```txt
Android/Desktop Browser
        |
        v
ksbuilder
  /api/builder/*
        |
        v
spark-api
  /v1/cms/*
        |
        +--> PostgreSQL revisions
        +--> object storage
        +--> publish targets
                 |
                 +--> spark
                 +--> spark-hub
```

## Builder to spark-api Contract

`ksbuilder` expects `spark-api` to implement:

```txt
GET    /v1/cms/projects/:id
PUT    /v1/cms/projects/:id
POST   /v1/cms/projects/:id/publish
GET    /v1/cms/projects/:id/revisions
POST   /v1/cms/projects/:id/revisions/:revision/restore
POST   /v1/cms/media/upload-intents
GET    /v1/cms/projects
```

These endpoints should:

- authenticate the editor identity
- enforce CMS roles
- validate the builder schema server-side
- use optimistic locking with revision numbers
- keep immutable revisions
- write audit events for save, restore, publish, and media actions

Reference:

- [CMS_API_CONTRACT.md](./CMS_API_CONTRACT.md)
- [integration/spark-api/migrations/0080_cms_builder_foundation.sql](../integration/spark-api/migrations/0080_cms_builder_foundation.sql)

## spark-api Responsibilities

`spark-api` should own these responsibilities, not the browser:

### Identity and RBAC

- map authenticated admin users to CMS roles
- roles at minimum:
  - `cms_editor`
  - `cms_publisher`
  - `cms_admin`

### Project Persistence

- current project snapshot
- immutable revisions
- published revision pointer
- audit log

### Media

- upload intents
- object storage metadata
- content-type validation
- image/video size policy

### Publish Orchestration

When `ksbuilder` publishes:

1. `spark-api` verifies editor permission
2. `spark-api` locks against stale revision
3. `spark-api` marks the published revision
4. `spark-api` materializes the publish artifact or publish payload
5. `spark-api` forwards or exposes the published output for `spark` and optionally `spark-hub`

## Publish Targets

There are two recommended publish strategies.

### Strategy A: API-driven runtime

Use this when `spark` and `spark-hub` should read current published content dynamically.

```txt
ksbuilder -> spark-api -> PostgreSQL/object storage
spark     -> spark-api published endpoints
spark-hub -> spark-api published endpoints
```

Recommended published endpoints:

```txt
GET /v1/published/projects/:id
GET /v1/published/projects/:id/pages/:slug
GET /v1/published/projects/:id/site-contract
```

This is the best fit if:

- content changes often
- multiple runtimes consume the same project
- you want one source of truth

### Strategy B: Build artifact publishing

Use this when `spark` or `spark-hub` should consume generated artifacts.

Example artifacts:

- static HTML ZIP
- `site.contract.json`
- Next.js export bundle

This is the best fit if:

- deployments are release-based
- the consumer repos want explicit import/build steps
- you need framework-specific packaging

## spark Integration

Recommended path for `spark`:

### Short term

- consume published `site.contract.json` from `spark-api`
- render via an adapter inside `spark`
- or embed exported static/Next output into a dedicated marketing/site section

### Long term

- add a `spark` runtime adapter that reads the same render contract used by `ksbuilder`
- keep page rendering separate from learning/product logic

What `spark` should not do:

- implement editor concerns
- accept raw mutable builder JSON from the browser
- bypass `spark-api` revision and permission checks

## spark-hub Integration

Recommended path for `spark-hub`:

- consume only projects explicitly marked for hub visibility
- read a published contract, not draft content
- optionally apply its own catalog metadata on top of the published page/project

Suggested model:

```txt
spark-api publish metadata
  project_id
  published_revision
  visibility_target = spark | spark-hub | both
```

## Shared Data Boundary

The safest shared boundary across all repos is:

```txt
builder schema -> render contract -> published artifact or published API
```

Avoid sharing:

- Svelte components
- editor-only UI state
- local SQLite assumptions
- frontend-only auth assumptions

## Recommended Implementation Order

### In `spark-api`

1. Add CMS RBAC roles
2. Add project/revision tables
3. Add `/v1/cms/*` endpoints
4. Add media upload intents
5. Add published read endpoints
6. Add publish metadata for target visibility

### In `spark`

1. Decide runtime path:
   - published API
   - static artifact
   - Next.js artifact
2. Add render adapter for published contract
3. Add asset/media URL resolution
4. Add cache invalidation strategy

### In `spark-hub`

1. Decide whether it consumes all published projects or a filtered subset
2. Add published contract reader
3. Add catalog/listing metadata
4. Add cache invalidation strategy

### In `ksbuilder`

1. Keep Builder BFF stable
2. Keep render contract versioned
3. Add more target adapters only after the published contract stays stable

## Environment Checklist

### ksbuilder

```env
SPARK_BUILDER_API_MODE=spark-api
SPARK_API_URL=https://api.example.com
SPARK_API_BOOTSTRAP_TOKEN=replace-me
SPARK_BUILDER_ALLOWED_ORIGIN=https://builder.example.com
```

### spark-api

At minimum:

```env
DATABASE_URL=postgres://...
OBJECT_STORAGE_URL=https://...
OBJECT_STORAGE_BUCKET=...
CMS_SESSION_SECRET=replace-me
```

### spark / spark-hub

Depending on the selected strategy:

```env
SPARK_PUBLISHED_API_URL=https://api.example.com
```

or artifact storage/CDN equivalents.

## Versioning Rule

When the builder schema changes in a way that affects rendering:

1. bump the render contract version
2. keep old contracts readable when feasible
3. update target adapters in `ksbuilder`
4. update contract consumers in `spark` and `spark-hub`

This is the critical rule that keeps the system maintainable once multiple runtimes depend on the builder output.
