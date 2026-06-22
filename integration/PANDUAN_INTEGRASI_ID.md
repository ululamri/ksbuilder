# Panduan Integrasi ksbuilder ke Spark Ecosystem

Dokumen ini adalah urutan kerja praktis untuk tiga repo:

- `spark-api`: backend utama untuk CMS builder.
- `spark`: runtime publik untuk menampilkan hasil publish.
- `hub`: katalog untuk project builder yang ingin tampil di Hub.

## Prinsip Utama

Jangan menggabungkan source code editor `ksbuilder` ke `spark`, `spark-api`, atau `hub`.

Integrasinya lewat HTTP:

```txt
ksbuilder -> spark-api -> spark
                    \-> hub
```

`spark-api` menyimpan draft, revision, publish pointer, audit log, dan media intent. `spark` dan `hub` hanya membaca data yang sudah published.

## 1. Yang Dikerjakan Di spark-api

Prioritas pertama adalah `spark-api`, karena tanpa backend CMS, `ksbuilder` hanya bisa berjalan standalone/local.

File yang perlu dipindahkan:

```txt
integration/spark-api/src/cms_builder.rs
integration/spark-api/migrations/0080_cms_builder_foundation.sql
integration/spark-api/migrations/0081_cms_builder_publish_targets.sql
```

Langkah:

1. Copy migration ke `spark-api/migrations`.
2. Copy `cms_builder.rs` ke `spark-api/src/cms_builder.rs`.
3. Tambahkan `mod cms_builder;` di `spark-api/src/main.rs`.
4. Mount route ini di `spark-api/src/http/mod.rs`:

```rust
.nest("/v1/cms", crate::cms_builder::cms_router())
.nest("/v1/published", crate::cms_builder::published_router())
```

5. Tambahkan `PUT` dan header ini di CORS:

```rust
header::IF_MATCH,
header::HeaderName::from_static("x-cms-contract-version"),
header::HeaderName::from_static("x-cms-contract-compatibility"),
header::HeaderName::from_static("x-request-id"),
```

6. Jalankan migration.
7. Beri role CMS ke user admin:

```sql
insert into cms_roles (user_id, role, granted_by)
values ('USER_UUID', 'cms_admin', 'USER_UUID')
on conflict do nothing;
```

Endpoint yang harus aktif setelah ini:

```txt
GET    /v1/cms/projects
GET    /v1/cms/projects/:id
PUT    /v1/cms/projects/:id
POST   /v1/cms/projects/:id/publish
GET    /v1/cms/projects/:id/revisions
POST   /v1/cms/projects/:id/revisions/:revision/restore
POST   /v1/cms/media/upload-intents
GET    /v1/published/projects/:id
GET    /v1/published/projects/:id/site-contract
GET    /v1/published/hub/projects
```

## 2. Yang Dikerjakan Di ksbuilder

Set mode integrasi:

```env
SPARK_BUILDER_API_MODE=spark-api
SPARK_API_URL=http://127.0.0.1:8787
SPARK_API_FORWARD_COOKIES=spark_session,__Host-spark_session
SPARK_BUILDER_ALLOWED_ORIGIN=http://127.0.0.1:5175
```

Lalu test alur:

1. Login ke akun Spark admin.
2. Buka `ksbuilder`.
3. Buat project.
4. Save.
5. Publish.
6. Buka endpoint published di `spark-api`.

## 3. Yang Dikerjakan Di spark

Setelah publish dari `ksbuilder` berhasil, barulah `spark` membaca outputnya.

File yang perlu dipindahkan:

```txt
integration/spark/src/lib/ksbuilder/published-builder.ts
integration/spark/src/lib/ksbuilder/PublishedBuilderSite.svelte
integration/spark/src/routes/site/[projectId]/+page.server.ts
integration/spark/src/routes/site/[projectId]/+page.svelte
integration/spark/src/routes/site/[projectId]/[...path]/+page.server.ts
integration/spark/src/routes/site/[projectId]/[...path]/+page.svelte
```

Tambahkan env:

```env
PUBLIC_SPARK_API_BASE=http://127.0.0.1:8787
```

Setelah itu, project yang sudah dipublish bisa dibuka di:

```txt
/site/PROJECT_UUID
/site/PROJECT_UUID/slug-halaman
```

Catatan penting:

- `spark` tidak boleh membaca draft.
- `spark` tidak perlu tahu editor state.
- `spark` cukup render hasil publish dari `spark-api`.

## 4. Yang Dikerjakan Di hub

`hub` sifatnya tahap kedua. Kerjakan setelah `spark-api` dan `spark` stabil.

File yang perlu dipindahkan:

```txt
integration/hub/src/lib/ksbuilder/hub-catalog.ts
integration/hub/src/routes/builder/+page.server.ts
integration/hub/src/routes/builder/+page.svelte
```

Tambahkan env:

```env
PUBLIC_SPARK_API_BASE=http://127.0.0.1:8787
```

Project akan tampil di Hub kalau metadata di `ksbuilder` diset seperti ini:

```txt
visibilityTarget = spark-hub atau both
hub.listed = true
```

## Urutan Aman

1. Integrasikan `spark-api`.
2. Jalankan migration.
3. Grant `cms_admin`.
4. Jalankan `ksbuilder` mode `spark-api`.
5. Test save dan publish.
6. Integrasikan route `/site/[projectId]` di `spark`.
7. Baru integrasikan catalog `/builder` di `hub`.

## Smoke Test Minimal

```bash
curl -i http://127.0.0.1:8787/v1/auth/me --cookie "spark_session=..."
curl -i http://127.0.0.1:8787/v1/cms/projects --cookie "spark_session=..."
curl -i http://127.0.0.1:8787/v1/published/projects/PROJECT_UUID/site-contract
curl -i http://127.0.0.1:8787/v1/published/hub/projects
```

