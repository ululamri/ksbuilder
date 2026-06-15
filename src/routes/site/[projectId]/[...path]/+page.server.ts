import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicSite } from '$lib/server/public-site';

export const load: PageServerLoad = ({ params }) => {
  try { return publicSite(params.projectId, params.path); }
  catch { error(404, 'Published page not found'); }
};
