import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import lottiePlayerSource from 'lottie-web/build/player/lottie_light.min.js?raw';
import type { BuilderProject } from '$lib/builder/types';
import { createSiteRenderContract, exportedSiteCss, type RenderBlock, type SiteRenderContract } from '$lib/renderer/contract';
import { builderConfig } from './config';
import { localDb } from './local-db';

const escape = (value = '') => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function createStaticZip(project: BuilderProject): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const mediaMap = collectMedia(project);
  const contract = createSiteRenderContract(project, {
    resolveAssetUrl: (value) => mediaUrl(value, '', mediaMap)
  });
  files['styles.css'] = strToU8(exportedSiteCss(contract.project.theme));
  if (usesLottie(contract)) files['assets/lottie.min.js'] = strToU8(lottiePlayerSource);
  for (const [assetId, target] of mediaMap) {
    const row = localDb().prepare('select storage_name from local_media where id = ?').get(assetId) as { storage_name: string } | undefined;
    if (row) files[target] = new Uint8Array(readFileSync(join(builderConfig().dataDir, 'media', row.storage_name)));
  }
  contract.pages.forEach((page) => {
    const file = page.isHome ? 'index.html' : `${page.slug}/index.html`;
    const prefix = page.isHome ? '' : '../';
    const navigation = contract.navigation.map((item) => `<a href="${item.isHome ? `${prefix}index.html` : `${prefix}${escape(item.slug)}/index.html`}">${escape(item.label)}</a>`).join('');
    const body = page.blocks.map((block) => renderStaticBlock(block)).join('');
    const lottieScript = usesLottie(contract)
      ? `<script src="${prefix}assets/lottie.min.js"></script><script>document.querySelectorAll('[data-lottie]').forEach(function(e){lottie.loadAnimation({container:e,renderer:'svg',loop:e.dataset.loop!=='false',autoplay:e.dataset.autoplay!=='false',path:e.dataset.lottie});});</script>`
      : '';
    files[file] = strToU8(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.seo.title)}</title><meta name="description" content="${escape(page.seo.description)}">${page.seo.noIndex ? '<meta name="robots" content="noindex,nofollow">' : ''}${page.seo.image ? `<meta property="og:image" content="${escape(prefix + page.seo.image.replace(/^\//, ''))}">` : ''}<link rel="stylesheet" href="${prefix}styles.css"></head><body><header><a class="brand" href="${prefix}index.html"><span>S</span><strong>${escape(contract.project.headerTitle)}</strong></a><nav>${navigation}</nav></header><main>${body}</main><footer><strong>${escape(contract.project.name)}</strong><span>${escape(contract.project.footerText)}</span></footer>${lottieScript}</body></html>`);
  });
  files['robots.txt'] = strToU8('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n');
  files['sitemap.xml'] = strToU8(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${contract.pages.filter((page) => !page.seo.noIndex).map((page) => `<url><loc>/${page.route ? `${escape(page.route)}/` : ''}</loc><lastmod>${escape(page.updatedAt)}</lastmod></url>`).join('')}</urlset>`);
  files['site.contract.json'] = strToU8(JSON.stringify(contract, null, 2));
  files['README.txt'] = strToU8('Spark Builder static export. Upload all files while preserving directory structure. Forms require the Spark Builder server endpoint configured in their action URL.');
  return zipSync(files, { level: 6 });
}

export function collectMedia(project: BuilderProject): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /^\/api\/builder\/media\/([a-f0-9-]+)$/i;
  for (const page of project.pages) for (const block of page.blocks) for (const value of Object.values(block.data)) {
    const match = value.match(regex);
    if (!match) continue;
    const row = localDb().prepare('select storage_name from local_media where id = ?').get(match[1]) as { storage_name: string } | undefined;
    if (row) map.set(match[1], `assets/${match[1]}${extname(row.storage_name)}`);
  }
  return map;
}

export function mediaUrl(value: string, prefix: string, media: Map<string, string>): string {
  const match = value.match(/^\/api\/builder\/media\/([a-f0-9-]+)$/i);
  if (match && media.has(match[1])) return `${prefix}${media.get(match[1])}`;
  if (value.startsWith('/assets/')) return `${prefix}${value.slice(1)}`;
  return value;
}

function usesLottie(contract: SiteRenderContract): boolean {
  return contract.pages.some((page) => page.blocks.some((block) => block.type === 'lottie'));
}

function renderStaticBlock(block: RenderBlock): string {
  const classes = ['animation-shell', 'is-visible'];
  if (block.animation !== 'none') classes.push(block.animation);
  if (block.type === 'spacer') return `<div class="${classes.join(' ')}" data-animation="${escape(block.animation)}" style="--animation-duration:${block.animationDurationMs}ms;--animation-delay:${block.animationDelayMs}ms"><div class="spacer" style="height:${block.size}px"></div></div>`;
  if (block.type === 'divider') return `<div class="${classes.join(' ')}" data-animation="${escape(block.animation)}" style="--animation-duration:${block.animationDurationMs}ms;--animation-delay:${block.animationDelayMs}ms"><div class="divider"><i style="width:${block.widthPercent}%"></i></div></div>`;
  const radius = block.radius === 'none' ? '0' : block.radius === 'medium' ? '18px' : '30px';
  const padding = block.padding === 'compact' ? '16px' : block.padding === 'roomy' ? '38px 24px' : '24px 20px';
  const sectionClasses = ['content-block'];
  if (block.type === 'hero') sectionClasses.push('hero');
  if (block.type === 'feature') sectionClasses.push('feature');
  if (block.type === 'cta') sectionClasses.push('cta');
  if (block.shadow) sectionClasses.push('with-shadow');
  const sectionOpen = `<section class="${sectionClasses.join(' ')}" style="background:${escape(block.background)};color:${escape(block.foreground)};text-align:${escape(block.align)};border-radius:${radius};padding:${padding}">`;
  const wrap = (content: string) => `<div class="${classes.join(' ')}" data-animation="${escape(block.animation)}" style="--animation-duration:${block.animationDurationMs}ms;--animation-delay:${block.animationDelayMs}ms">${sectionOpen}${content}</section></div>`;
  if (block.type === 'hero') return wrap(`<span class="eyebrow">${escape(block.eyebrow)}</span><h1>${escape(block.title)}</h1><p>${escape(block.body)}</p><a class="primary-action" href="${escape(block.href)}">${escape(block.button)}</a>`);
  if (block.type === 'text') return wrap(`<h2>${escape(block.title)}</h2><p>${escape(block.body)}</p>`);
  if (block.type === 'richtext') return wrap(`<div class="richtext">${block.nodes.map((node) => {
    if (node.kind === 'heading-2') return `<h2>${escape(node.text)}</h2>`;
    if (node.kind === 'heading-3') return `<h3>${escape(node.text)}</h3>`;
    if (node.kind === 'bullet') return `<div class="bullet"><i></i><span>${escape(node.text)}</span></div>`;
    return `<p>${escape(node.text)}</p>`;
  }).join('')}</div>`);
  if (block.type === 'feature') return wrap(`<span class="feature-number">${escape(block.kicker)}</span><h2>${escape(block.title)}</h2><p>${escape(block.body)}</p>`);
  if (block.type === 'cta') return wrap(`<h2>${escape(block.title)}</h2><p>${escape(block.body)}</p><a class="primary-action" href="${escape(block.href)}">${escape(block.button)}</a>`);
  if (block.type === 'image') return wrap(`${block.src ? `<img src="${escape(block.src)}" alt="${escape(block.alt)}">` : '<div class="image-placeholder">URL gambar harus menggunakan HTTPS</div>'}<small>${escape(block.caption)}</small>`);
  if (block.type === 'video') return wrap(`${block.embedUrl ? `<div class="video-frame"><iframe src="${escape(block.embedUrl)}" title="${escape(block.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : block.src ? `<video src="${escape(block.src)}" poster="${escape(block.poster)}" ${block.autoplay ? 'autoplay' : ''} ${block.loop ? 'loop' : ''} ${block.muted ? 'muted' : ''} ${block.controls ? 'controls' : ''} ${block.playsinline ? 'playsinline' : ''} preload="metadata"></video>` : '<div class="image-placeholder">Pilih MP4/WebM atau URL YouTube/Vimeo HTTPS</div>'}<small>${escape(block.caption)}</small>`);
  if (block.type === 'lottie') return wrap(`${block.src ? `<div data-lottie="${escape(block.src)}" data-loop="${String(block.loop)}" data-autoplay="${String(block.autoplay)}" role="img" aria-label="${escape(block.title)}" style="min-height:180px;aspect-ratio:16/10"></div>` : '<div class="lottie-placeholder">Pilih file Lottie JSON yang valid</div>'}`);
  if (block.type === 'gallery') return wrap(`<div class="gallery">${block.images.map((src) => src ? `<img src="${escape(src)}" alt="${escape(block.alt)}">` : '<div class="image-placeholder">HTTPS</div>').join('')}</div>`);
  if (block.type === 'stats') return wrap(`<div class="stats">${block.items.map((item) => `<div><strong>${escape(item.value)}</strong><span>${escape(item.label)}</span></div>`).join('')}</div>`);
  if (block.type === 'quote') return wrap(`<blockquote>&ldquo;${escape(block.quote)}&rdquo;</blockquote><div class="quote-author"><strong>${escape(block.author)}</strong><span>${escape(block.role)}</span></div>`);
  return wrap(`<h2>${escape(block.title)}</h2><p>${escape(block.body)}</p><form class="site-form" method="POST" action="${escape(block.action)}"><input type="hidden" name="projectId" value="${escape(block.projectId)}"><input type="hidden" name="pageId" value="${escape(block.pageId)}"><input type="hidden" name="formId" value="${escape(block.formId)}"><input class="honeypot" name="website" tabindex="-1" autocomplete="off">${block.fields.map((field) => `<label><span>${escape(field.label)}</span>${field.type === 'textarea' ? `<textarea name="${escape(field.name)}" ${field.required ? 'required' : ''}></textarea>` : `<input type="${escape(field.type)}" name="${escape(field.name)}" ${field.required ? 'required' : ''}>`}</label>`).join('')}<button type="submit">${escape(block.button)}</button></form>`);
}
