-- Spark Builder CMS foundation.
-- Copy this migration into spark-api only when the CMS module is implemented.

create table if not exists cms_roles (
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('cms_editor', 'cms_publisher', 'cms_admin')),
  granted_by uuid references users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists cms_projects (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 160),
  current_revision bigint not null default 0 check (current_revision >= 0),
  published_revision bigint,
  created_by uuid not null references users(id) on delete restrict,
  updated_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (published_revision is null or published_revision <= current_revision)
);

create table if not exists cms_project_revisions (
  project_id uuid not null references cms_projects(id) on delete cascade,
  revision bigint not null check (revision > 0),
  schema_version integer not null check (schema_version > 0),
  document jsonb not null,
  content_hash text not null check (char_length(content_hash) = 64),
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (project_id, revision),
  check (jsonb_typeof(document) = 'object')
);

create table if not exists cms_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  project_id uuid references cms_projects(id) on delete set null,
  action text not null check (action in ('project.create', 'project.read', 'project.save', 'project.publish', 'project.restore', 'media.intent.create', 'role.grant', 'role.revoke')),
  revision bigint,
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_cms_roles_user on cms_roles(user_id);
create index if not exists idx_cms_projects_updated on cms_projects(updated_at desc);
create index if not exists idx_cms_revisions_created on cms_project_revisions(project_id, created_at desc);
create index if not exists idx_cms_audit_project_created on cms_audit_events(project_id, created_at desc);
create index if not exists idx_cms_audit_actor_created on cms_audit_events(actor_id, created_at desc);

-- Revisions are immutable. Updates and deletes must be rejected even if an
-- application bug attempts them.
create or replace function reject_cms_revision_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'cms_project_revisions are immutable';
end;
$$;

drop trigger if exists cms_revisions_immutable_update on cms_project_revisions;
create trigger cms_revisions_immutable_update
before update or delete on cms_project_revisions
for each row execute function reject_cms_revision_mutation();
