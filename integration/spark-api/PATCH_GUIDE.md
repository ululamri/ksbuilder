# Patch Guide For spark-api

Use this sequence after copying files from this integration pack.

## 1. main.rs

Add the module:

```rust
mod cms_builder;
```

## 2. http/mod.rs

Mount the routers near the other `/v1` modules:

```rust
.nest("/v1/cms", crate::cms_builder::cms_router())
.nest("/v1/published", crate::cms_builder::published_router())
```

Add CORS headers:

```rust
header::IF_MATCH,
header::HeaderName::from_static("x-cms-contract-version"),
header::HeaderName::from_static("x-cms-contract-compatibility"),
header::HeaderName::from_static("x-request-id"),
```

Allow `PUT` if it is not already allowed:

```rust
.allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
```

## 3. Migration

Run your existing migration script after copying:

```bash
./scripts/karyra-db-migrate.sh
```

## 4. Smoke Test

With a logged-in admin cookie:

```bash
curl -i http://127.0.0.1:8787/v1/auth/me --cookie "spark_session=..."
curl -i http://127.0.0.1:8787/v1/cms/projects --cookie "spark_session=..."
```

After publishing from `ksbuilder`:

```bash
curl -i http://127.0.0.1:8787/v1/published/projects/PROJECT_ID/site-contract
curl -i http://127.0.0.1:8787/v1/published/hub/projects
```

