import { PUBLIC_SPARK_API_BASE } from '$env/static/public';

export type BuilderHubProject = {
  id: string;
  name: string;
  published_revision: number;
  updated_at: string;
  metadata: {
    summary?: string;
    tags?: string[];
    hub?: {
      category?: string;
      cardTitle?: string;
      cardSummary?: string;
    };
  };
};

type HubEnvelope = {
  ok: true;
  data: BuilderHubProject[];
};

function apiBase() {
  return (PUBLIC_SPARK_API_BASE || '/api').replace(/\/$/, '');
}

export async function fetchBuilderHubProjects(fetcher: typeof fetch): Promise<BuilderHubProject[]> {
  const response = await fetcher(`${apiBase()}/v1/published/hub/projects`, {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Builder hub catalog request failed (${response.status})`);
  }
  const body = (await response.json()) as HubEnvelope;
  return body.ok && Array.isArray(body.data) ? body.data : [];
}

export function builderProjectHref(project: BuilderHubProject) {
  return `/site/${project.id}`;
}

export function builderProjectTitle(project: BuilderHubProject) {
  return project.metadata?.hub?.cardTitle || project.name;
}

export function builderProjectSummary(project: BuilderHubProject) {
  return project.metadata?.hub?.cardSummary || project.metadata?.summary || '';
}

