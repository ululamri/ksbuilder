# hub Integration

`hub` should consume only published builder projects that explicitly opt into Hub visibility.

## Files

- `src/lib/ksbuilder/hub-catalog.ts`: typed client for `/v1/published/hub/projects`.
- `src/routes/builder/+page.server.ts`: server load for catalog data.
- `src/routes/builder/+page.svelte`: simple catalog page.

## What To Do In hub

1. Copy the files into the same paths in `hub`.
2. Add this env var:

```env
PUBLIC_SPARK_API_BASE=http://127.0.0.1:8787
```

3. In `ksbuilder`, set project metadata:

```txt
visibilityTarget = spark-hub or both
hub.listed = true
```

4. Publish the project.
5. Open:

```txt
/builder
```

## Boundary Rule

Hub should list and route to published builder projects. It should not edit content, restore revisions, or read draft CMS records.

