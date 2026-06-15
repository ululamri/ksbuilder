import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => new Response(`User-agent: *\nAllow: /site/${params.projectId}/\nSitemap: ${url.origin}/site/${params.projectId}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
