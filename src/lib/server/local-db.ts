import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { builderConfig } from './config';

let database: DatabaseSync | null = null;

export function localDb(): DatabaseSync {
  if (database) return database;
  const config = builderConfig();
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(join(config.dataDir, 'media'), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(join(config.dataDir, 'spark-builder.sqlite'));
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(database);
  seedAdmin(database, config.adminEmail, config.adminPassword);
  return database;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    create table if not exists local_users (
      id text primary key,
      email text not null unique,
      display_name text not null,
      password_hash text not null,
      roles text not null,
      created_at text not null
    );
    create table if not exists local_sessions (
      token_hash text primary key,
      user_id text not null references local_users(id) on delete cascade,
      expires_at text not null,
      created_at text not null
    );
    create table if not exists local_projects (
      id text primary key,
      name text not null,
      current_revision integer not null default 0,
      published_revision integer,
      created_by text not null references local_users(id),
      updated_by text not null references local_users(id),
      created_at text not null,
      updated_at text not null
    );
    create table if not exists local_revisions (
      project_id text not null references local_projects(id) on delete cascade,
      revision integer not null,
      document text not null,
      content_hash text not null,
      created_by text not null references local_users(id),
      created_at text not null,
      primary key (project_id, revision)
    );
    create table if not exists local_audit_events (
      id text primary key,
      actor_id text references local_users(id),
      project_id text,
      action text not null,
      revision integer,
      request_id text not null,
      metadata text not null,
      created_at text not null
    );
    create table if not exists local_media (
      id text primary key,
      owner_id text not null references local_users(id),
      file_name text not null,
      content_type text not null,
      size integer not null,
      storage_name text not null unique,
      created_at text not null
    );
    create table if not exists local_form_submissions (
      id text primary key,
      project_id text not null,
      page_id text not null,
      form_id text not null,
      payload text not null,
      created_at text not null
    );
    create table if not exists local_ai_settings (
      id integer primary key check (id = 1),
      provider text not null,
      api_key text not null,
      model text not null,
      api_base_url text not null,
      updated_at text not null
    );
    create index if not exists local_sessions_expiry on local_sessions(expires_at);
    create index if not exists local_revisions_project on local_revisions(project_id, revision desc);
    create index if not exists local_audit_project on local_audit_events(project_id, created_at desc);
    create index if not exists local_media_owner on local_media(owner_id, created_at desc);
  `);
}

function seedAdmin(db: DatabaseSync, email: string, password: string) {
  const existing = db.prepare('select id from local_users where email = ?').get(email);
  if (existing) return;
  const now = new Date().toISOString();
  db.prepare('insert into local_users (id, email, display_name, password_hash, roles, created_at) values (?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), email, 'Spark Administrator', hashPassword(password), JSON.stringify(['cms_admin', 'cms_editor', 'cms_publisher']), now);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, saltHex, hashHex] = encoded.split(':');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function contentHash(document: string): string {
  return createHash('sha256').update(document).digest('hex');
}

export function audit(action: string, requestId: string, actorId: string | null, projectId: string | null, revision: number | null, metadata: object = {}) {
  localDb().prepare('insert into local_audit_events (id, actor_id, project_id, action, revision, request_id, metadata, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), actorId, projectId, action, revision, requestId, JSON.stringify(metadata), new Date().toISOString());
}
