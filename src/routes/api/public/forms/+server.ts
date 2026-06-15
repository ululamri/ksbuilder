import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { localDb } from '$lib/server/local-db';
import { getPublishedProject } from '$lib/server/local-cms';

const attempts = new Map<string, number[]>();
const FIELD_NAME = /^[a-z][a-z0-9_-]{0,39}$/i;

export const POST: RequestHandler = async (event) => {
  const length = Number(event.request.headers.get('content-length') ?? 0);
  if (length > 50_000) return new Response('Payload too large', { status: 413 });
  const ip = event.getClientAddress();
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return new Response('Too many submissions', { status: 429 });
  recent.push(now); attempts.set(ip, recent);

  const form = await event.request.formData();
  if (form.get('website')) return new Response(null, { status: 204 });
  const projectId = String(form.get('projectId') ?? '');
  const pageId = String(form.get('pageId') ?? '');
  const formId = String(form.get('formId') ?? '');
  let project;
  try { project = getPublishedProject(projectId); } catch { return new Response('Site not found', { status: 404 }); }
  const page = project.pages.find((item) => item.id === pageId && item.status === 'published');
  const block = page?.blocks.find((item) => item.id === formId && item.type === 'form');
  if (!page || !block) return new Response('Form not found', { status: 404 });
  const schema = block.data.fields.split('\n').map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts.length >= 3 && FIELD_NAME.test(parts[1])).slice(0, 20);
  const payload: Record<string, string> = {};
  for (const [label, name, type, required] of schema) {
    const value = String(form.get(name) ?? '').trim().slice(0, type === 'textarea' ? 5000 : 500);
    if (required === 'required' && !value) return new Response(`${label} is required`, { status: 422 });
    if (type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return new Response(`${label} is invalid`, { status: 422 });
    payload[name] = value;
  }
  localDb().prepare('insert into local_form_submissions (id, project_id, page_id, form_id, payload, created_at) values (?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), projectId, pageId, formId, JSON.stringify(payload), new Date().toISOString());
  redirect(303, `/site/${projectId}/${page.slug}?submitted=1`);
};
