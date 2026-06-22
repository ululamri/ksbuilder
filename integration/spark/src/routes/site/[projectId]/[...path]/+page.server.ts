import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchPublishedBuilderProject, resolvePageBySlug } from '$lib/ksbuilder/published-builder';

export const load: PageServerLoad = async ({ fetch, params }) => {
  try {
    const record = await fetchPublishedBuilderProject(fetch, params.projectId);
    const slug = params.path?.split('/').filter(Boolean).join('/') ?? '';
    const page = resolvePageBySlug(record.project, slug);
    if (!page) error(404, 'Published builder page not found');
    return { project: record.project, page, revision: record.published_revision ?? record.revision };
  } catch {
    error(404, 'Published builder project not found');
  }
};

