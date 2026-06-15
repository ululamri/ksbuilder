import type { BuilderBlock, BuilderPage, BuilderProject } from '$lib/builder/types';
import { getPublishedProject } from './local-cms';
import { expandBlocks, resolveHomePageId } from '$lib/renderer/contract';

export function publicSite(projectId: string, path = ''): { project: BuilderProject; page: BuilderPage } {
  const project = rewriteProjectBlocks(getPublishedProject(projectId));
  const slug = path.replace(/^\/+|\/+$/g, '');
  const publishedPages = project.pages.filter((item) => item.status === 'published');
  const homePageId = resolveHomePageId(project, publishedPages);
  const page = slug ? publishedPages.find((item) => item.slug === slug) : publishedPages.find((item) => item.id === homePageId) ?? publishedPages[0];
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
  return {
    ...block,
    data: Object.fromEntries(
      Object.entries(block.data).map(([key, value]) => [key, value.replace(/\/api\/builder\/media\//g, '/site-assets/')])
    )
  };
}

function rewriteProjectBlocks(project: BuilderProject): BuilderProject {
  return {
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      blocks: expandBlocks(page.blocks, project.componentLibrary ?? []).map(rewriteMediaBlock)
    }))
  };
}
