# Spark CMS API Contract

Contract version: `2026-06-13`

The browser calls only Spark Builder routes under `/api/builder`. Spark Builder forwards authenticated requests to `spark-api` routes under `/v1/cms`.

## Deployment topology

Use one public origin and reverse proxy both services:

```txt
https://admin.example.com/             -> spark-builder
https://admin.example.com/api/builder  -> spark-builder BFF
https://admin.example.com/api/spark    -> spark-api (optional, not used by editor directly)
```

The `spark_session` cookie must be visible to the Builder BFF. Prefer a shared parent cookie domain or proxy login through the same origin. Keep it `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter.

## Required spark-api routes

```txt
GET  /v1/cms/projects/:project_id
PUT  /v1/cms/projects/:project_id
POST /v1/cms/projects/:project_id/publish
GET  /v1/cms/projects/:project_id/revisions
POST /v1/cms/projects/:project_id/revisions/:revision/restore
POST /v1/cms/media/upload-intents
```

Every route requires an authenticated identity with an explicit CMS role. Suggested permissions:

```txt
cms.project.read
cms.project.edit
cms.project.publish
cms.project.restore
cms.media.create
```

## Concurrency

`PUT` and publish requests include `If-Match: <revision>`. Return `409` when it differs from the current revision:

```json
{
  "ok": false,
  "error": {
    "code": "revision_conflict",
    "message": "A newer project revision is available."
  }
}
```

Successful saves increment the revision in one database transaction. Publish points to an immutable revision instead of copying mutable JSON.

## Storage tables

Recommended PostgreSQL ownership:

```txt
cms_projects
  id uuid primary key
  name text
  current_revision bigint
  published_revision bigint null
  created_by uuid
  updated_by uuid
  created_at timestamptz
  updated_at timestamptz

cms_project_revisions
  project_id uuid
  revision bigint
  schema_version integer
  document jsonb
  content_hash text
  created_by uuid
  created_at timestamptz
  primary key (project_id, revision)

cms_audit_events
  id uuid primary key
  actor_id uuid
  project_id uuid
  action text
  revision bigint null
  request_id text
  metadata jsonb
  created_at timestamptz
```

Validate the complete builder schema in Rust before storing it. Do not treat JSONB as an unvalidated document bucket.

A starter migration is available at `integration/spark-api/migrations/0080_cms_builder_foundation.sql`. It is an integration artifact, not a runtime dependency of Spark Builder.
