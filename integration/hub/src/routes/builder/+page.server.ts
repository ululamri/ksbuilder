import type { PageServerLoad } from './$types';
import { fetchBuilderHubProjects } from '$lib/ksbuilder/hub-catalog';

export const load: PageServerLoad = async ({ fetch }) => {
  const projects = await fetchBuilderHubProjects(fetch);
  return { projects };
};

