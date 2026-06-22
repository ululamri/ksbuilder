use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::session::require_current_user, state::AppState};

const CONTRACT_VERSION: &str = "2026-06-22";
const MAX_BUILDER_MEDIA_BYTES: i64 = 50 * 1024 * 1024;

#[derive(Debug)]
enum CmsError {
    Unauthorized,
    Forbidden,
    NotFound,
    RevisionConflict(&'static str),
    Validation(&'static str),
    Database(sqlx::Error),
}

impl From<sqlx::Error> for CmsError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(error, sqlx::Error::RowNotFound) {
            Self::NotFound
        } else {
            Self::Database(error)
        }
    }
}

#[derive(Serialize)]
struct CmsEnvelope<T> {
    ok: bool,
    data: T,
    meta: CmsMeta,
}

#[derive(Serialize)]
struct CmsErrorEnvelope {
    ok: bool,
    error: CmsErrorBody,
    meta: CmsMeta,
}

#[derive(Serialize)]
struct CmsErrorBody {
    code: &'static str,
    message: String,
}

#[derive(Serialize)]
struct CmsMeta {
    contract_version: &'static str,
    request_id: String,
}

impl IntoResponse for CmsError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized", "Authentication is required.".to_string()),
            Self::Forbidden => (StatusCode::FORBIDDEN, "forbidden", "CMS permission is required.".to_string()),
            Self::NotFound => (StatusCode::NOT_FOUND, "not_found", "Resource was not found.".to_string()),
            Self::RevisionConflict(message) => (StatusCode::CONFLICT, "revision_conflict", message.to_string()),
            Self::Validation(message) => (StatusCode::UNPROCESSABLE_ENTITY, "validation_failed", message.to_string()),
            Self::Database(error) => {
                tracing::error!(?error, "cms builder database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "CMS request failed.".to_string())
            }
        };

        (
            status,
            Json(CmsErrorEnvelope {
                ok: false,
                error: CmsErrorBody { code, message },
                meta: CmsMeta { contract_version: CONTRACT_VERSION, request_id: "unavailable".to_string() },
            }),
        )
            .into_response()
    }
}

fn ok<T: Serialize>(data: T, request_id: String) -> Json<CmsEnvelope<T>> {
    Json(CmsEnvelope {
        ok: true,
        data,
        meta: CmsMeta { contract_version: CONTRACT_VERSION, request_id },
    })
}

fn request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("spark-api")
        .to_string()
}

fn expected_revision(headers: &HeaderMap) -> Result<i64, CmsError> {
    headers
        .get("if-match")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|value| *value >= 0)
        .ok_or(CmsError::Validation("If-Match revision header is required."))
}

async fn require_role(state: &AppState, headers: &HeaderMap, roles: &[&str]) -> Result<Uuid, CmsError> {
    let user = require_current_user(state, headers).await.map_err(|_| CmsError::Unauthorized)?;
    let allowed_roles = roles.iter().map(|role| role.to_string()).collect::<Vec<_>>();
    let allowed = sqlx::query_scalar::<_, bool>(
        r#"
        select exists (
          select 1 from cms_roles
          where user_id = $1 and role = any($2)
        )
        "#,
    )
    .bind(user.id)
    .bind(allowed_roles)
    .fetch_one(&state.db)
    .await?;

    if allowed {
        Ok(user.id)
    } else {
        Err(CmsError::Forbidden)
    }
}

fn content_hash(document: &Value) -> String {
    let encoded = serde_json::to_vec(document).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(encoded);
    format!("{:x}", hasher.finalize())
}

fn validate_project_document(project_id: Uuid, project: &Value) -> Result<(), CmsError> {
    if !project.is_object() {
        return Err(CmsError::Validation("Project document must be an object."));
    }
    if project.get("id").and_then(Value::as_str) != Some(&project_id.to_string()) {
        return Err(CmsError::Validation("Project id does not match the route."));
    }
    if project.get("schemaVersion").and_then(Value::as_i64).unwrap_or(0) < 1 {
        return Err(CmsError::Validation("Project schemaVersion is invalid."));
    }
    if project.get("pages").and_then(Value::as_array).map_or(true, Vec::is_empty) {
        return Err(CmsError::Validation("Project must contain at least one page."));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
struct SaveProjectRequest {
    project: Value,
}

#[derive(Debug, Serialize, FromRow)]
struct ProjectRevisionRow {
    project: Value,
    revision: i64,
    published_revision: Option<i64>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct ProjectRecord {
    project: Value,
    revision: i64,
    published_revision: Option<i64>,
    updated_at: DateTime<Utc>,
}

impl From<ProjectRevisionRow> for ProjectRecord {
    fn from(row: ProjectRevisionRow) -> Self {
        Self {
            project: row.project,
            revision: row.revision,
            published_revision: row.published_revision,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Serialize, FromRow)]
struct ProjectListItem {
    id: Uuid,
    name: String,
    revision: i64,
    published_revision: Option<i64>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct RevisionItem {
    revision: i64,
    created_at: DateTime<Utc>,
    content_hash: String,
    created_by: Uuid,
}

#[derive(Debug, Serialize)]
struct PublishResult {
    revision: i64,
    published_at: DateTime<Utc>,
    public_url: String,
}

async fn list_projects(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, CmsError> {
    require_role(&state, &headers, &["cms_editor", "cms_publisher", "cms_admin"]).await?;
    let rows = sqlx::query_as::<_, ProjectListItem>(
        r#"
        select id, name, current_revision as revision, published_revision, updated_at
        from cms_projects
        order by updated_at desc
        limit 100
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(ok(rows, request_id(&headers)))
}

async fn get_project(State(state): State<AppState>, headers: HeaderMap, Path(project_id): Path<Uuid>) -> Result<impl IntoResponse, CmsError> {
    require_role(&state, &headers, &["cms_editor", "cms_publisher", "cms_admin"]).await?;
    let row = fetch_project_record(&state, project_id, false).await?;
    Ok(ok(ProjectRecord::from(row), request_id(&headers)))
}

async fn save_project(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<SaveProjectRequest>,
) -> Result<impl IntoResponse, CmsError> {
    let actor_id = require_role(&state, &headers, &["cms_editor", "cms_admin"]).await?;
    let expected = expected_revision(&headers)?;
    validate_project_document(project_id, &payload.project)?;

    let name = payload.project.get("name").and_then(Value::as_str).unwrap_or("Spark Builder Site").trim();
    if name.is_empty() || name.len() > 160 {
        return Err(CmsError::Validation("Project name must be 1-160 characters."));
    }

    let mut tx = state.db.begin().await?;
    let current = sqlx::query_as::<_, (i64, Option<i64>)>(
        "select current_revision, published_revision from cms_projects where id = $1 for update",
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;

    let current_revision = current.map(|row| row.0).unwrap_or(0);
    if current_revision != expected {
        return Err(CmsError::RevisionConflict("A newer project revision is available."));
    }

    let next_revision = current_revision + 1;
    let hash = content_hash(&payload.project);

    if current_revision == 0 {
        sqlx::query(
            r#"
            insert into cms_projects (id, name, current_revision, created_by, updated_by)
            values ($1, $2, $3, $4, $4)
            "#,
        )
        .bind(project_id)
        .bind(name)
        .bind(next_revision)
        .bind(actor_id)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            r#"
            update cms_projects
            set name = $2, current_revision = $3, updated_by = $4, updated_at = now()
            where id = $1
            "#,
        )
        .bind(project_id)
        .bind(name)
        .bind(next_revision)
        .bind(actor_id)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        r#"
        insert into cms_project_revisions (project_id, revision, schema_version, document, content_hash, created_by)
        values ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(project_id)
    .bind(next_revision)
    .bind(payload.project.get("schemaVersion").and_then(Value::as_i64).unwrap_or(1) as i32)
    .bind(&payload.project)
    .bind(hash)
    .bind(actor_id)
    .execute(&mut *tx)
    .await?;

    audit(&mut tx, actor_id, project_id, "project.save", next_revision, &request_id(&headers), json!({})).await?;
    tx.commit().await?;

    let row = fetch_project_record(&state, project_id, false).await?;
    Ok(ok(ProjectRecord::from(row), request_id(&headers)))
}

async fn publish_project(State(state): State<AppState>, headers: HeaderMap, Path(project_id): Path<Uuid>) -> Result<impl IntoResponse, CmsError> {
    let actor_id = require_role(&state, &headers, &["cms_publisher", "cms_admin"]).await?;
    let expected = expected_revision(&headers)?;

    let changed = sqlx::query(
        r#"
        update cms_projects
        set published_revision = current_revision,
            updated_by = $2,
            updated_at = now()
        where id = $1 and current_revision = $3
        "#,
    )
    .bind(project_id)
    .bind(actor_id)
    .bind(expected)
    .execute(&state.db)
    .await?
    .rows_affected();

    if changed == 0 {
        return Err(CmsError::RevisionConflict("Publish revision is stale."));
    }

    audit_pool(&state, actor_id, Some(project_id), "project.publish", expected, &request_id(&headers), json!({})).await?;
    Ok(ok(
        PublishResult {
            revision: expected,
            published_at: Utc::now(),
            public_url: format!("/site/{project_id}"),
        },
        request_id(&headers),
    ))
}

async fn list_revisions(State(state): State<AppState>, headers: HeaderMap, Path(project_id): Path<Uuid>) -> Result<impl IntoResponse, CmsError> {
    require_role(&state, &headers, &["cms_editor", "cms_publisher", "cms_admin"]).await?;
    let rows = sqlx::query_as::<_, RevisionItem>(
        r#"
        select revision, created_at, content_hash, created_by
        from cms_project_revisions
        where project_id = $1
        order by revision desc
        limit 100
        "#,
    )
    .bind(project_id)
    .fetch_all(&state.db)
    .await?;
    Ok(ok(rows, request_id(&headers)))
}

async fn restore_revision(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((project_id, revision)): Path<(Uuid, i64)>,
) -> Result<impl IntoResponse, CmsError> {
    let actor_id = require_role(&state, &headers, &["cms_editor", "cms_admin"]).await?;
    let expected = expected_revision(&headers)?;
    let source = sqlx::query_as::<_, (Value,)>(
        "select document from cms_project_revisions where project_id = $1 and revision = $2",
    )
    .bind(project_id)
    .bind(revision)
    .fetch_one(&state.db)
    .await?
    .0;

    validate_project_document(project_id, &source)?;
    let mut tx = state.db.begin().await?;
    let current = sqlx::query_as::<_, (i64,)>("select current_revision from cms_projects where id = $1 for update")
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
        .0;

    if current != expected {
        return Err(CmsError::RevisionConflict("A newer project revision is available."));
    }

    let next_revision = current + 1;
    let hash = content_hash(&source);
    sqlx::query("update cms_projects set current_revision = $2, updated_by = $3, updated_at = now() where id = $1")
        .bind(project_id)
        .bind(next_revision)
        .bind(actor_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        r#"
        insert into cms_project_revisions (project_id, revision, schema_version, document, content_hash, created_by)
        values ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(project_id)
    .bind(next_revision)
    .bind(source.get("schemaVersion").and_then(Value::as_i64).unwrap_or(1) as i32)
    .bind(&source)
    .bind(hash)
    .bind(actor_id)
    .execute(&mut *tx)
    .await?;
    audit(&mut tx, actor_id, project_id, "project.restore", next_revision, &request_id(&headers), json!({ "sourceRevision": revision })).await?;
    tx.commit().await?;

    let row = fetch_project_record(&state, project_id, false).await?;
    Ok(ok(ProjectRecord::from(row), request_id(&headers)))
}

#[derive(Debug, Deserialize)]
struct UploadIntentRequest {
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "contentType")]
    content_type: String,
    size: i64,
}

#[derive(Debug, Serialize)]
struct UploadIntentResponse {
    #[serde(rename = "assetId")]
    asset_id: Uuid,
    #[serde(rename = "uploadUrl")]
    upload_url: String,
    method: &'static str,
    headers: serde_json::Map<String, Value>,
    #[serde(rename = "expiresAt")]
    expires_at: DateTime<Utc>,
}

async fn create_upload_intent(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UploadIntentRequest>,
) -> Result<impl IntoResponse, CmsError> {
    let actor_id = require_role(&state, &headers, &["cms_editor", "cms_admin"]).await?;
    if payload.file_name.trim().is_empty() || payload.file_name.len() > 180 {
        return Err(CmsError::Validation("Media fileName is invalid."));
    }
    if !is_builder_media_type(&payload.content_type) || payload.size < 1 || payload.size > MAX_BUILDER_MEDIA_BYTES {
        return Err(CmsError::Validation("Media contentType or size is invalid."));
    }

    let asset_id = Uuid::new_v4();
    let file_name = safe_segment(&payload.file_name);
    let bucket = state.config.s3_bucket_public.clone();
    let object_key = format!("builder/{actor_id}/{asset_id}/{file_name}");
    let upload_url = format!("{}/{}/{}", state.config.s3_endpoint.trim_end_matches('/'), bucket, object_key);
    let expires_at = Utc::now() + Duration::minutes(15);

    sqlx::query(
        r#"
        insert into media_assets (
          id, owner_user_id, bucket, object_key, original_file_name, mime_type, size_bytes,
          visibility, status, storage_provider, upload_method, upload_expires_at, public_url, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'public', 'pending', 's3-compatible', 'PUT', $8, $9, $10)
        "#,
    )
    .bind(asset_id)
    .bind(actor_id)
    .bind(bucket)
    .bind(object_key)
    .bind(&payload.file_name)
    .bind(&payload.content_type)
    .bind(payload.size)
    .bind(expires_at)
    .bind(&upload_url)
    .bind(json!({ "source": "ksbuilder", "requestId": request_id(&headers) }))
    .execute(&state.db)
    .await?;

    audit_pool(&state, actor_id, None, "media.intent.create", 0, &request_id(&headers), json!({ "assetId": asset_id, "fileName": payload.file_name })).await.ok();

    Ok((
        StatusCode::CREATED,
        ok(
            UploadIntentResponse {
                asset_id,
                upload_url,
                method: "PUT",
                headers: serde_json::Map::new(),
                expires_at,
            },
            request_id(&headers),
        ),
    ))
}

async fn get_published_project(State(state): State<AppState>, headers: HeaderMap, Path(project_id): Path<Uuid>) -> Result<impl IntoResponse, CmsError> {
    let row = fetch_project_record(&state, project_id, true).await?;
    Ok(ok(ProjectRecord::from(row), request_id(&headers)))
}

#[derive(Debug, Serialize, FromRow)]
struct HubProjectItem {
    id: Uuid,
    name: String,
    published_revision: i64,
    updated_at: DateTime<Utc>,
    metadata: Value,
}

async fn list_hub_projects(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse, CmsError> {
    let rows = sqlx::query_as::<_, HubProjectItem>(
        r#"
        select id,
               name,
               published_revision,
               updated_at,
               coalesce(document -> 'metadata', '{}'::jsonb) as metadata
        from cms_published_projects
        where coalesce(document #>> '{metadata,hub,listed}', 'false') = 'true'
          and coalesce(document #>> '{metadata,visibilityTarget}', 'spark') in ('spark-hub', 'both')
        order by updated_at desc
        limit 100
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(ok(rows, request_id(&headers)))
}

async fn fetch_project_record(state: &AppState, project_id: Uuid, published_only: bool) -> Result<ProjectRevisionRow, CmsError> {
    let sql = if published_only {
        r#"
        select r.document as project,
               r.revision,
               p.published_revision,
               p.updated_at
        from cms_projects p
        join cms_project_revisions r on r.project_id = p.id and r.revision = p.published_revision
        where p.id = $1 and p.published_revision is not null
        "#
    } else {
        r#"
        select r.document as project,
               r.revision,
               p.published_revision,
               p.updated_at
        from cms_projects p
        join cms_project_revisions r on r.project_id = p.id and r.revision = p.current_revision
        where p.id = $1
        "#
    };

    Ok(sqlx::query_as::<_, ProjectRevisionRow>(sql).bind(project_id).fetch_one(&state.db).await?)
}

async fn audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    actor_id: Uuid,
    project_id: Uuid,
    action: &str,
    revision: i64,
    request_id: &str,
    metadata: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        insert into cms_audit_events (actor_id, project_id, action, revision, request_id, metadata)
        values ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(actor_id)
    .bind(project_id)
    .bind(action)
    .bind(revision)
    .bind(request_id)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn audit_pool(state: &AppState, actor_id: Uuid, project_id: Option<Uuid>, action: &str, revision: i64, request_id: &str, metadata: Value) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        insert into cms_audit_events (actor_id, project_id, action, revision, request_id, metadata)
        values ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(actor_id)
    .bind(project_id)
    .bind(action)
    .bind(revision)
    .bind(request_id)
    .bind(metadata)
    .execute(&state.db)
    .await?;
    Ok(())
}

fn is_builder_media_type(content_type: &str) -> bool {
    matches!(
        content_type,
        "image/jpeg"
            | "image/png"
            | "image/webp"
            | "image/avif"
            | "image/gif"
            | "video/mp4"
            | "video/webm"
            | "application/json"
    )
}

fn safe_segment(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') { ch } else { '-' })
        .collect();
    cleaned.trim_matches('-').chars().take(120).collect::<String>()
}

pub fn cms_router() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list_projects))
        .route("/projects/:project_id", get(get_project).put(save_project))
        .route("/projects/:project_id/publish", post(publish_project))
        .route("/projects/:project_id/revisions", get(list_revisions))
        .route("/projects/:project_id/revisions/:revision/restore", post(restore_revision))
        .route("/media/upload-intents", post(create_upload_intent))
}

pub fn published_router() -> Router<AppState> {
    Router::new()
        .route("/projects/:project_id", get(get_published_project))
        .route("/projects/:project_id/site-contract", get(get_published_project))
        .route("/hub/projects", get(list_hub_projects))
}
