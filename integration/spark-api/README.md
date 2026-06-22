# spark-api Integration

`spark-api` must become the source of truth for builder projects. `ksbuilder` should not write directly to `spark` or `hub`.

## Files

- `migrations/0080_cms_builder_foundation.sql`: base CMS tables already provided by `ksbuilder`.
- `migrations/0081_cms_builder_publish_targets.sql`: public indexes/views for Spark and Hub reads.
- `src/cms_builder.rs`: starter Axum module for `/v1/cms/*` and `/v1/published/*`.
- `PATCH_GUIDE.md`: exact edits to wire the module into the existing Rust app.

## What To Do In spark-api

1. Copy both migration files into `spark-api/migrations`.
2. Copy `src/cms_builder.rs` into `spark-api/src/cms_builder.rs`.
3. Add `mod cms_builder;` in `spark-api/src/main.rs`.
4. In `spark-api/src/http/mod.rs`, mount:

```rust
.nest("/v1/cms", crate::cms_builder::cms_router())
.nest("/v1/published", crate::cms_builder::published_router())
```

5. Allow these request headers in CORS:

```rust
header::IF_MATCH,
header::HeaderName::from_static("x-cms-contract-version"),
header::HeaderName::from_static("x-cms-contract-compatibility"),
header::HeaderName::from_static("x-request-id"),
```

6. Grant a user a CMS role:

```sql
insert into cms_roles (user_id, role, granted_by)
values ('USER_UUID', 'cms_admin', 'USER_UUID')
on conflict do nothing;
```

## Required Behavior

- `PUT /v1/cms/projects/:id` must require `If-Match`.
- `POST /v1/cms/projects/:id/publish` must require `If-Match`.
- Revision rows are immutable.
- Published endpoints must read `published_revision`, not draft content.
- Hub listing must only return projects where metadata allows `spark-hub` or `both`.

