import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublishedProject } from '$lib/server/local-cms';

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!);

export const GET: RequestHandler = ({ params, url }) => {
  let project;
  try { project = getPublishedProject(params.projectId); } catch { error(404, 'Site not found'); }
  const base = `${url.origin}/site/${params.projectId}`;
  const urls = project.pages.filter((page) => page.status === 'published' && !page.seo?.noIndex).map((page, index) => `<url><loc>${escapeXml(index === 0 ? base : `${base}/${page.slug}`)}</loc><lastmod>${escapeXml(page.updatedAt)}</lastmod></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
