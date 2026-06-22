-- Spark Builder published read helpers.
-- Apply after 0080_cms_builder_foundation.sql.

create index if not exists idx_cms_projects_published
  on cms_projects(id, published_revision)
  where published_revision is not null;

create index if not exists idx_cms_project_revisions_document_kind
  on cms_project_revisions using gin ((document -> 'metadata'));

create or replace view cms_published_projects as
select
  p.id,
  p.name,
  p.published_revision,
  p.updated_at,
  r.document,
  r.created_at as published_revision_created_at
from cms_projects p
join cms_project_revisions r
  on r.project_id = p.id
 and r.revision = p.published_revision
where p.published_revision is not null;

