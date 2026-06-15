import type { BuilderBlock, BuilderPage, BuilderProject } from '$lib/builder/types';
import { getPublishedProject } from './local-cms';

export function publicSite(projectId: string, path = ''): { project: BuilderProject; page: BuilderPage } {
  const project = getPublishedProject(projectId);
  const slug = path.replace(/^\/+|\/+$/g, '');
  const page = slug ? project.pages.find((item) => item.slug === slug) : project.pages[0];
  if (!page || page.status !== 'published') throw new Error('not_found');
  return { project: rewriteMedia(project), page: rewriteMediaPage(page) };
}

function rewriteMedia(project: BuilderProject): BuilderProject {
  return { ...project, pages: project.pages.map(rewriteMediaPage) };
}

function rewriteMediaPage(page: BuilderPage): BuilderPage {
  return { ...page, blocks: page.blocks.map(rewriteMediaBlock) };
}

function rewriteMediaBlock(block: BuilderBlock): BuilderBlock {
  return { ...block, data: Object.fromEntries(Object.entries(block.data).map(([key, value]) => [key, value.replace(/^\/api\/builder\/media\//, '/site-assets/')])) };
}
