import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import type { BuilderProject } from '$lib/builder/types';
import { createSiteRenderContract, exportedSiteCss } from '$lib/renderer/contract';
import { builderConfig } from './config';
import { collectMedia } from './static-export';
import { localDb } from './local-db';

export function createNextJsZip(project: BuilderProject): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const mediaMap = collectMedia(project);
  const contract = createSiteRenderContract(project, {
    resolveAssetUrl: (value) => replaceWithExportAsset(value, mediaMap)
  });

  files['package.json'] = strToU8(JSON.stringify({
    name: `${project.id}-site`,
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'lottie-web': '^5.13.0'
    },
    devDependencies: {
      '@types/node': '^22.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.0.0'
    }
  }, null, 2));
  files['tsconfig.json'] = strToU8(JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      lib: ['dom', 'dom.iterable', 'es2022'],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }]
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules']
  }, null, 2));
  files['next-env.d.ts'] = strToU8('/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
  files['next.config.mjs'] = strToU8('/** @type {import("next").NextConfig} */\nconst nextConfig = { images: { remotePatterns: [{ protocol: "https", hostname: "**" }] } };\nexport default nextConfig;\n');
  files['app/globals.css'] = strToU8(exportedSiteCss(contract.project.theme));
  files['data/site.contract.json'] = strToU8(JSON.stringify(contract, null, 2));
  files['data/hub.manifest.json'] = strToU8(JSON.stringify(createHubManifest(contract), null, 2));
  files['app/layout.tsx'] = strToU8(`import './globals.css';\nimport type { ReactNode } from 'react';\nimport type { Metadata } from 'next';\nimport contract from '../data/site.contract.json';\n\nexport const metadata: Metadata = {\n  title: contract.project.name,\n  description: contract.pages[0]?.seo.description || contract.project.name\n};\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return <html lang="id"><body>{children}</body></html>;\n}\n`);
  files['app/page.tsx'] = strToU8(`import { notFound } from 'next/navigation';\nimport { renderPageByRoute } from '../lib/site';\n\nexport default function HomePage() {\n  const page = renderPageByRoute('');\n  if (!page) notFound();\n  return page;\n}\n`);
  files['app/[...slug]/page.tsx'] = strToU8(`import { notFound } from 'next/navigation';\nimport { allRoutes, renderPageByRoute } from '../../lib/site';\n\nexport function generateStaticParams() {\n  return allRoutes().filter((route) => route).map((route) => ({ slug: route.split('/') }));\n}\n\nexport default function DynamicPage({ params }: { params: { slug?: string[] } }) {\n  const route = (params.slug ?? []).join('/');\n  const page = renderPageByRoute(route);\n  if (!page) notFound();\n  return page;\n}\n`);
  files['components/LottieBlock.tsx'] = strToU8(`'use client';\n\nimport { useEffect, useRef } from 'react';\nimport lottie from 'lottie-web';\n\nexport function LottieBlock({ src, title, loop, autoplay }: { src: string; title: string; loop: boolean; autoplay: boolean }) {\n  const ref = useRef<HTMLDivElement | null>(null);\n  useEffect(() => {\n    if (!ref.current || !src) return;\n    const animation = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop, autoplay, path: src, rendererSettings: { progressiveLoad: true, preserveAspectRatio: 'xMidYMid meet' } });\n    return () => animation.destroy();\n  }, [autoplay, loop, src]);\n  if (!src) return <div className=\"lottie-placeholder\">Pilih file Lottie JSON yang valid</div>;\n  return <div ref={ref} role=\"img\" aria-label={title} style={{ minHeight: 180, aspectRatio: '16 / 10' }} />;\n}\n`);
  files['lib/site.tsx'] = strToU8(nextSiteRuntime());
  files['README.md'] = strToU8(`# Spark Builder Next.js export\n\n1. Install dependencies with \`pnpm install\` or \`npm install\`.\n2. Run \`pnpm dev\` for local preview.\n3. Build with \`pnpm build\`.\n\nThis app is generated from the Builder render contract. Edit content in the Builder, then export again to refresh the contract.\n\nForms stay disabled until you configure a public form action in Builder settings or wire your own route handler.\n`);

  for (const [assetId, target] of mediaMap) {
    const row = localDb().prepare('select storage_name from local_media where id = ?').get(assetId) as { storage_name: string } | undefined;
    if (!row) continue;
    files[`public/${target}`] = new Uint8Array(readFileSync(join(builderConfig().dataDir, 'media', row.storage_name)));
  }

  return zipSync(files, { level: 6 });
}

function replaceWithExportAsset(value: string, media: Map<string, string>): string {
  const match = value.match(/^\/api\/builder\/media\/([a-f0-9-]+)$/i);
  if (!match || !media.has(match[1])) return value;
  return `/${media.get(match[1])}`;
}

function nextSiteRuntime(): string {
  return `import type { CSSProperties, ReactNode } from 'react';\nimport Link from 'next/link';\nimport contract from '../data/site.contract.json';\nimport { LottieBlock } from '../components/LottieBlock';\n\ntype Page = (typeof contract.pages)[number];\ntype Block = Page['blocks'][number];\n\nexport function allRoutes(): string[] {\n  return contract.pages.map((page) => page.route);\n}\n\nexport function renderPageByRoute(route: string) {\n  const page = contract.pages.find((item) => item.route === route);\n  if (!page) return null;\n  return <SitePage page={page} />;\n}\n\nfunction SitePage({ page }: { page: Page }) {\n  return <div><header><Link className=\"brand\" href=\"/\"><span>S</span><strong>{contract.project.headerTitle}</strong></Link><nav>{contract.navigation.map((item) => <Link key={item.id} href={item.route ? \`/\${item.route}\` : '/'}>{item.label}</Link>)}</nav></header><main>{page.blocks.map((block) => <RenderBlock key={block.id} block={block} />)}</main><footer><strong>{contract.project.name}</strong><span>{contract.project.footerText}</span></footer></div>;\n}\n\nfunction RenderBlock({ block }: { block: Block }) {\n  const shellClass = ['animation-shell', 'is-visible'].join(' ');\n  const radius = block.radius === 'none' ? '0' : block.radius === 'medium' ? '18px' : '30px';\n  const padding = block.padding === 'compact' ? '16px' : block.padding === 'roomy' ? '38px 24px' : '24px 20px';\n  const shellStyle = { ['--animation-duration' as const]: \`\${block.animationDurationMs}ms\`, ['--animation-delay' as const]: \`\${block.animationDelayMs}ms\` } as CSSProperties;\n  if (block.type === 'spacer') return <div className={shellClass} data-animation={block.animation} style={shellStyle}><div className=\"spacer\" style={{ height: block.size }} /></div>;\n  if (block.type === 'divider') return <div className={shellClass} data-animation={block.animation} style={shellStyle}><div className=\"divider\"><i style={{ width: \`\${block.widthPercent}%\` }} /></div></div>;\n  const sectionClass = ['content-block'];\n  if (block.type === 'hero') sectionClass.push('hero');\n  if (block.type === 'feature') sectionClass.push('feature');\n  if (block.type === 'cta') sectionClass.push('cta');\n  if (block.shadow) sectionClass.push('with-shadow');\n  const sectionStyle = { background: block.background, color: block.foreground, textAlign: block.align, borderRadius: radius, padding } as CSSProperties;\n  return <div className={shellClass} data-animation={block.animation} style={shellStyle}><section className={sectionClass.join(' ')} style={sectionStyle}>{renderBlockBody(block)}</section></div>;\n}\n\nfunction renderBlockBody(block: Block) {\n  if (block.type === 'hero') return <><span className=\"eyebrow\">{block.eyebrow}</span><h1>{block.title}</h1><p>{block.body}</p><ActionLink href={block.href}>{block.button}</ActionLink></>;\n  if (block.type === 'text') return <><h2>{block.title}</h2><p>{block.body}</p></>;\n  if (block.type === 'richtext') return <div className=\"richtext\">{block.nodes.map((node, index) => { if (node.kind === 'heading-2') return <h2 key={index}>{node.text}</h2>; if (node.kind === 'heading-3') return <h3 key={index}>{node.text}</h3>; if (node.kind === 'bullet') return <div key={index} className=\"bullet\"><i></i><span>{node.text}</span></div>; return <p key={index}>{node.text}</p>; })}</div>;\n  if (block.type === 'feature') return <><span className=\"feature-number\">{block.kicker}</span><h2>{block.title}</h2><p>{block.body}</p></>;\n  if (block.type === 'cta') return <><h2>{block.title}</h2><p>{block.body}</p><ActionLink href={block.href}>{block.button}</ActionLink></>;\n  if (block.type === 'image') return <>{block.src ? <img src={block.src} alt={block.alt} /> : <div className=\"image-placeholder\">URL gambar harus menggunakan HTTPS</div>}<small>{block.caption}</small></>;\n  if (block.type === 'video') return <>{block.embedUrl ? <div className=\"video-frame\"><iframe src={block.embedUrl} title={block.title} loading=\"lazy\" allow=\"accelerometer; autoplay; encrypted-media; picture-in-picture\" allowFullScreen /></div> : block.src ? <video src={block.src} poster={block.poster} autoPlay={block.autoplay} loop={block.loop} muted={block.muted} controls={block.controls} playsInline={block.playsinline} preload=\"metadata\" /> : <div className=\"image-placeholder\">Pilih MP4/WebM atau URL YouTube/Vimeo HTTPS</div>}<small>{block.caption}</small></>;\n  if (block.type === 'lottie') return <LottieBlock src={block.src} title={block.title} loop={block.loop} autoplay={block.autoplay} />;\n  if (block.type === 'gallery') return <div className=\"gallery\">{block.images.map((src, index) => src ? <img key={index} src={src} alt={block.alt} /> : <div key={index} className=\"image-placeholder\">HTTPS</div>)}</div>;\n  if (block.type === 'stats') return <div className=\"stats\">{block.items.map((item, index) => <div key={index}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;\n  if (block.type === 'quote') return <><blockquote>&ldquo;{block.quote}&rdquo;</blockquote><div className=\"quote-author\"><strong>{block.author}</strong><span>{block.role}</span></div></>;\n  return <><h2>{block.title}</h2><p>{block.body}</p>{block.action ? <form className=\"site-form\" method=\"POST\" action={block.action}><input type=\"hidden\" name=\"projectId\" value={block.projectId} /><input type=\"hidden\" name=\"pageId\" value={block.pageId} /><input type=\"hidden\" name=\"formId\" value={block.formId} /><input className=\"honeypot\" name=\"website\" tabIndex={-1} autoComplete=\"off\" />{block.fields.map((field, index) => <label key={index}><span>{field.label}</span>{field.type === 'textarea' ? <textarea name={field.name} required={field.required} /> : <input type={field.type} name={field.name} required={field.required} />}</label>)}<button type=\"submit\">{block.button}</button></form> : <div className=\"image-placeholder\">Configure a public form action to enable this form.</div>}</>;\n}\n\nfunction ActionLink({ href, children }: { href: string; children: ReactNode }) {\n  return href.startsWith('/') ? <Link className=\"primary-action\" href={href}>{children}</Link> : <a className=\"primary-action\" href={href}>{children}</a>;\n}\n`;
}

function createHubManifest(contract: ReturnType<typeof createSiteRenderContract>) {
  return {
    version: contract.version,
    projectId: contract.project.id,
    name: contract.project.name,
    visibilityTarget: contract.project.metadata.visibilityTarget,
    listed: contract.project.metadata.hub.listed,
    category: contract.project.metadata.hub.category,
    title: contract.project.metadata.hub.cardTitle,
    summary: contract.project.metadata.hub.cardSummary || contract.project.metadata.summary,
    tags: contract.project.metadata.tags,
    level: contract.project.metadata.level,
    durationMinutes: contract.project.metadata.durationMinutes,
    routes: contract.pages.map((page) => ({ id: page.id, route: page.route, title: page.title, isHome: page.isHome }))
  };
}
