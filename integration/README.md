# Spark Builder Integration Pack

This folder contains copy-in starter files for integrating `ksbuilder` with:

- `spark-api`: owns authenticated CMS storage, revision locking, publishing, and public read endpoints.
- `spark`: renders published builder sites from `spark-api`.
- `hub`: lists published builder projects that opted into hub visibility.

The files are intentionally kept outside the three target repositories so the Builder can remain independently maintained.

## Recommended Order

1. Apply `integration/spark-api` first.
2. Run the new `spark-api` migration.
3. Confirm `/v1/cms/*` works through the existing auth cookie.
4. Configure `ksbuilder` with `SPARK_BUILDER_API_MODE=spark-api`.
5. Apply `integration/spark` to render published projects.
6. Apply `integration/hub` only after published project metadata is stable.

## Runtime Topology

```txt
Android/Desktop browser
  -> ksbuilder /api/builder/*
  -> spark-api /v1/cms/*
  -> PostgreSQL revisions + published pointer

spark
  -> spark-api /v1/published/projects/:id/site-contract

hub
  -> spark-api /v1/published/hub/projects
```

Use one admin origin in production so cookies can be forwarded safely:

```txt
https://admin.example.com/            -> ksbuilder
https://admin.example.com/api/builder -> ksbuilder
https://api.example.com/              -> spark-api
```

## Contract Version

Current contract: `2026-06-22`.

`ksbuilder` also tolerates the previous `2026-06-13` snake_case payload shape, but new `spark-api` code should emit camelCase fields in the response body.

