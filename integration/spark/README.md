# spark Integration

`spark` should render only published builder content from `spark-api`. It should not import editor code from `ksbuilder` and should not read drafts.

## Files

- `src/lib/ksbuilder/published-builder.ts`: typed fetch/normalization helpers.
- `src/lib/ksbuilder/PublishedBuilderSite.svelte`: mobile-first public renderer.
- `src/routes/site/[projectId]/+page.server.ts`: project home route.
- `src/routes/site/[projectId]/+page.svelte`: page shell.
- `src/routes/site/[projectId]/[...path]/+page.server.ts`: nested builder page route.
- `src/routes/site/[projectId]/[...path]/+page.svelte`: reused page shell.

## What To Do In spark

1. Copy the files into the same paths in `spark`.
2. Add this env var:

```env
PUBLIC_SPARK_API_BASE=http://127.0.0.1:8787
```

3. Publish a project from `ksbuilder`.
4. Open:

```txt
/site/PROJECT_UUID
/site/PROJECT_UUID/page-slug
```

## Boundary Rule

Keep `core`, `learn`, and `lab` CMS editing in the existing Spark admin dashboard. Use `ksbuilder` only for public/presentation pages and campaign-style surfaces.

