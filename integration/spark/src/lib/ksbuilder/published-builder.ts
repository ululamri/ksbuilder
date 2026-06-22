import { PUBLIC_SPARK_API_BASE } from '$env/static/public';

export type BuilderBlock = {
  id: string;
  type: string;
  data: Record<string, string>;
  style: {
    background?: string;
    foreground?: string;
    align?: 'left' | 'center';
    radius?: 'none' | 'medium' | 'large';
    padding?: 'compact' | 'normal' | 'roomy';
    shadow?: boolean;
  };
};

export type BuilderPage = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  seo?: { title?: string; description?: string; image?: string; noIndex?: boolean };
  blocks: BuilderBlock[];
  updatedAt: string;
};

export type BuilderProject = {
  schemaVersion: 1;
  id: string;
  name: string;
  theme?: {
    primary?: string;
    accent?: string;
    surface?: string;
    text?: string;
    buttonRadius?: 'soft' | 'pill' | 'square';
  };
  site?: {
    headerTitle?: string;
    footerText?: string;
    navigation?: Array<{ id: string; label: string; pageId: string }>;
    homePageId?: string;
    headerCtaLabel?: string;
    headerCtaHref?: string;
    footerLinks?: Array<{ id: string; label: string; href: string }>;
  };
  metadata?: {
    summary?: string;
    visibilityTarget?: 'spark' | 'spark-hub' | 'both';
    hub?: { listed?: boolean; category?: string; cardTitle?: string; cardSummary?: string };
  };
  pages: BuilderPage[];
};

type PublishedEnvelope = {
  ok: true;
  data: {
    project: BuilderProject;
    revision: number;
    published_revision: number | null;
    updated_at: string;
  };
};

export type PublishedBuilderProject = PublishedEnvelope['data'];

function apiBase() {
  return (PUBLIC_SPARK_API_BASE || '/api').replace(/\/$/, '');
}

export async function fetchPublishedBuilderProject(fetcher: typeof fetch, projectId: string): Promise<PublishedBuilderProject> {
  const response = await fetcher(`${apiBase()}/v1/published/projects/${encodeURIComponent(projectId)}/site-contract`, {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Published builder project not found (${response.status})`);
  }
  const body = (await response.json()) as PublishedEnvelope;
  if (!body.ok || !body.data?.project?.pages?.length) {
    throw new Error('Published builder project payload is invalid.');
  }
  return body.data;
}

export function publishedPages(project: BuilderProject) {
  const pages = project.pages.filter((page) => page.status === 'published');
  return pages.length ? pages : project.pages;
}

export function resolveHomePage(project: BuilderProject) {
  const pages = publishedPages(project);
  const preferred = project.site?.homePageId;
  return pages.find((page) => page.id === preferred) ?? pages[0];
}

export function resolvePageBySlug(project: BuilderProject, slug = '') {
  if (!slug) return resolveHomePage(project);
  return publishedPages(project).find((page) => page.slug === slug);
}

export function pageHref(projectId: string, page: BuilderPage, project: BuilderProject) {
  const home = resolveHomePage(project);
  return page.id === home?.id ? `/site/${projectId}` : `/site/${projectId}/${page.slug}`;
}

