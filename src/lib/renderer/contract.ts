import type { BuilderBlock, BuilderComponent, BuilderPage, BuilderProject } from '$lib/builder/types';
import { safeImage, safeLink, safeMedia, safeVideoEmbed } from '$lib/builder/security';

export const RENDER_CONTRACT_VERSION = 2;

export type RenderNavigationItem = {
  id: string;
  label: string;
  pageId: string;
  slug: string;
  route: string;
  isHome: boolean;
};

export type RichTextNode =
  | { kind: 'heading-2'; text: string }
  | { kind: 'heading-3'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'paragraph'; text: string };

export type FormField = {
  label: string;
  name: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea';
  required: boolean;
};

type BaseRenderBlock = {
  id: string;
  type: BuilderBlock['type'];
  background: string;
  foreground: string;
  align: BuilderBlock['style']['align'];
  radius: BuilderBlock['style']['radius'];
  padding: NonNullable<BuilderBlock['style']['padding']>;
  shadow: boolean;
  animation: Exclude<NonNullable<BuilderBlock['style']['animation']>, 'none'> | 'none';
  animationDurationMs: number;
  animationDelayMs: number;
  animationOnce: boolean;
};

export type RenderBlock =
  | (BaseRenderBlock & { type: 'spacer'; size: number })
  | (BaseRenderBlock & { type: 'divider'; widthPercent: number })
  | (BaseRenderBlock & { type: 'hero'; eyebrow: string; title: string; body: string; button: string; href: string })
  | (BaseRenderBlock & { type: 'text'; title: string; body: string })
  | (BaseRenderBlock & { type: 'richtext'; nodes: RichTextNode[] })
  | (BaseRenderBlock & { type: 'feature'; kicker: string; title: string; body: string })
  | (BaseRenderBlock & { type: 'cta'; title: string; body: string; button: string; href: string })
  | (BaseRenderBlock & { type: 'image'; src: string; srcSet: string; sizes: string; focalX: number; focalY: number; alt: string; caption: string })
  | (BaseRenderBlock & { type: 'video'; src: string; poster: string; caption: string; title: string; embedUrl: string; autoplay: boolean; loop: boolean; muted: boolean; controls: boolean; playsinline: boolean })
  | (BaseRenderBlock & { type: 'lottie'; src: string; title: string; loop: boolean; autoplay: boolean; speed: number })
  | (BaseRenderBlock & { type: 'gallery'; images: string[]; alt: string })
  | (BaseRenderBlock & { type: 'stats'; items: Array<{ value: string; label: string }> })
  | (BaseRenderBlock & { type: 'grid'; title: string; body: string; columnsMobile: number; columnsTablet: number; columnsDesktop: number; items: Array<{ title: string; body: string; href: string; button: string }> })
  | (BaseRenderBlock & { type: 'quote'; quote: string; author: string; role: string })
  | (BaseRenderBlock & { type: 'form'; projectId: string; pageId: string; formId: string; title: string; body: string; button: string; action: string | null; fields: FormField[] });

export type RenderPageContract = {
  id: string;
  title: string;
  slug: string;
  route: string;
  isHome: boolean;
  seo: {
    title: string;
    description: string;
    image: string;
    noIndex: boolean;
  };
  updatedAt: string;
  blocks: RenderBlock[];
};

export type SiteRenderContract = {
  version: typeof RENDER_CONTRACT_VERSION;
  generatedAt: string;
  project: {
    id: string;
    name: string;
    headerTitle: string;
    footerText: string;
    theme: {
      primary: string;
      accent: string;
      surface: string;
      text: string;
      font: NonNullable<BuilderProject['theme']>['font'];
      buttonRadius: NonNullable<BuilderProject['theme']>['buttonRadius'];
      contentWidth: NonNullable<BuilderProject['theme']>['contentWidth'];
      sectionGap: NonNullable<BuilderProject['theme']>['sectionGap'];
      surfaceStyle: NonNullable<BuilderProject['theme']>['surfaceStyle'];
    };
    headerCta: { label: string; href: string } | null;
    footerLinks: Array<{ id: string; label: string; href: string }>;
    metadata: {
      kind: NonNullable<BuilderProject['metadata']>['kind'];
      audience: string;
      level: NonNullable<BuilderProject['metadata']>['level'];
      durationMinutes: number | null;
      summary: string;
      tags: string[];
      visibilityTarget: NonNullable<BuilderProject['metadata']>['visibilityTarget'];
      learn: NonNullable<BuilderProject['metadata']>['learn'];
      lab: NonNullable<BuilderProject['metadata']>['lab'];
      hub: NonNullable<BuilderProject['metadata']>['hub'];
    };
  };
  navigation: RenderNavigationItem[];
  pages: RenderPageContract[];
};

type CreateSiteRenderContractOptions = {
  generatedAt?: string;
  resolveAssetUrl?: (value: string) => string;
  resolveFormAction?: (context: { project: BuilderProject; page: BuilderPage; block: BuilderBlock }) => string | null;
};

export function createSiteRenderContract(project: BuilderProject, options: CreateSiteRenderContractOptions = {}): SiteRenderContract {
  const pages = exportedPages(project);
  const resolveAssetUrl = options.resolveAssetUrl ?? ((value: string) => value);
  const metadata = project.metadata ?? {
    kind: 'site',
    audience: 'Pembelajar Indonesia',
    level: 'mixed',
    durationMinutes: null,
    summary: '',
    tags: [],
    visibilityTarget: 'spark',
    learn: { track: '', format: 'path', outcomes: [], prerequisites: [] },
    lab: { profile: '', runtime: 'browser', difficulty: 'guided', estimatedMinutes: null },
    hub: { listed: false, category: '', cardTitle: project.name, cardSummary: '' }
  };
  const navigation = buildNavigation(project, pages);
  const homePageId = resolveHomePageId(project, pages);
  return {
    version: RENDER_CONTRACT_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      headerTitle: project.site?.headerTitle ?? project.name,
      footerText: project.site?.footerText ?? '',
      theme: {
        primary: project.theme?.primary ?? '#17211b',
        accent: project.theme?.accent ?? '#d9ff62',
        surface: project.theme?.surface ?? '#ffffff',
        text: project.theme?.text ?? '#17211b',
        font: project.theme?.font ?? 'modern',
        buttonRadius: project.theme?.buttonRadius ?? 'pill',
        contentWidth: project.theme?.contentWidth ?? 'standard',
        sectionGap: project.theme?.sectionGap ?? 'normal',
        surfaceStyle: project.theme?.surfaceStyle ?? 'flat'
      },
      headerCta: project.site?.headerCtaLabel && project.site?.headerCtaHref
        ? { label: project.site.headerCtaLabel, href: safeLink(project.site.headerCtaHref) }
        : null,
      footerLinks: (project.site?.footerLinks ?? []).map((link) => ({ id: link.id, label: link.label, href: safeLink(link.href) })),
      metadata: {
        kind: metadata.kind,
        audience: metadata.audience,
        level: metadata.level,
        durationMinutes: metadata.durationMinutes,
        summary: metadata.summary,
        tags: [...metadata.tags],
        visibilityTarget: metadata.visibilityTarget,
        learn: structuredClone(metadata.learn),
        lab: structuredClone(metadata.lab),
        hub: structuredClone(metadata.hub)
      }
    },
    navigation,
    pages: pages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      route: page.id === homePageId ? '' : page.slug,
      isHome: page.id === homePageId,
      seo: {
        title: page.seo?.title ?? page.title,
        description: page.seo?.description ?? '',
        image: resolveAssetUrl(safeImage(page.seo?.image ?? '')),
        noIndex: page.seo?.noIndex ?? false
      },
      updatedAt: page.updatedAt,
      blocks: expandBlocks(page.blocks, project.componentLibrary ?? []).map((block) => toRenderBlock(block, {
        resolveAssetUrl,
        resolveFormAction: options.resolveFormAction,
        project,
        page,
        projectId: project.id,
        pageId: page.id
      }))
    }))
  };
}

export function expandBlocks(blocks: BuilderBlock[], library: BuilderComponent[], seen = new Set<string>()): BuilderBlock[] {
  return blocks.flatMap((block) => {
    if (block.type !== 'symbol') return [block];
    const componentId = block.data.componentId ?? '';
    if (!componentId || seen.has(componentId)) return [];
    const component = library.find((entry) => entry.id === componentId);
    if (!component) return [];
    return expandBlocks(component.blocks.map((entry) => ({
      ...structuredClone(entry),
      id: crypto.randomUUID()
    })), library, new Set([...seen, componentId]));
  });
}

export function exportedPages(project: BuilderProject): BuilderPage[] {
  const published = project.pages.filter((page) => page.status === 'published');
  return published.length ? published : project.pages;
}

export function resolveHomePageId(project: BuilderProject, pages = exportedPages(project)): string {
  const preferred = project.site?.homePageId;
  if (preferred && pages.some((page) => page.id === preferred)) return preferred;
  return pages[0]?.id ?? project.pages[0]?.id ?? '';
}

export function buildNavigation(project: BuilderProject, pages = exportedPages(project)): RenderNavigationItem[] {
  const homePageId = resolveHomePageId(project, pages);
  const source = project.site?.navigation?.length
    ? project.site.navigation
      .map((item) => ({ ...item, page: pages.find((candidate) => candidate.id === item.pageId) }))
      .filter((item): item is typeof item & { page: BuilderPage } => Boolean(item.page))
      .map((item) => ({ id: item.id, label: item.label, page: item.page }))
    : pages.map((page) => ({ id: page.id, label: page.title, page }));
  return source.map((item, index) => ({
    id: item.id,
    label: item.label,
    pageId: item.page.id,
    slug: item.page.slug,
    route: item.page.id === homePageId ? '' : item.page.slug,
    isHome: item.page.id === homePageId || (!source.some((candidate) => candidate.page.id === homePageId) && index === 0)
  }));
}

export function buttonRadiusValue(buttonRadius: SiteRenderContract['project']['theme']['buttonRadius']): string {
  return buttonRadius === 'square' ? '4px' : buttonRadius === 'soft' ? '14px' : '999px';
}

function contentWidthValue(contentWidth: SiteRenderContract['project']['theme']['contentWidth']): string {
  return contentWidth === 'compact' ? '920px' : contentWidth === 'wide' ? '1280px' : '1100px';
}

function sectionGapValue(sectionGap: SiteRenderContract['project']['theme']['sectionGap']): string {
  return sectionGap === 'tight' ? '12px' : sectionGap === 'relaxed' ? '24px' : '16px';
}

function surfaceBackground(theme: SiteRenderContract['project']['theme']): string {
  if (theme.surfaceStyle === 'contrast') return `linear-gradient(180deg, ${theme.surface} 0%, color-mix(in srgb, ${theme.primary} 6%, ${theme.surface}) 100%)`;
  if (theme.surfaceStyle === 'tinted') return `linear-gradient(180deg, ${theme.surface} 0%, color-mix(in srgb, ${theme.accent} 14%, ${theme.surface}) 100%)`;
  return theme.surface;
}

export function exportedSiteCss(theme: SiteRenderContract['project']['theme']): string {
  return `:root{--theme-primary:${theme.primary};--theme-accent:${theme.accent};--theme-surface:${theme.surface};--theme-text:${theme.text};--button-radius:${buttonRadiusValue(theme.buttonRadius)};--content-width:${contentWidthValue(theme.contentWidth)};--section-gap:${sectionGapValue(theme.sectionGap)}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Inter,system-ui,sans-serif;background:${surfaceBackground(theme)};color:var(--theme-text)}a{color:inherit}header{position:sticky;z-index:20;top:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px max(18px,calc((100vw - var(--content-width))/2));border-bottom:1px solid rgba(23,33,27,.1);background:color-mix(in srgb,var(--theme-surface) 90%,transparent);backdrop-filter:blur(16px)}header .header-main{display:flex;align-items:center;justify-content:space-between;gap:20px;width:100%}header .brand{display:flex;align-items:center;gap:9px;color:inherit;text-decoration:none}header .brand span{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:var(--theme-primary);color:var(--theme-accent);font-weight:900}header .header-actions{display:flex;align-items:center;gap:14px}nav{display:flex;gap:17px}nav a{color:inherit;font-size:12px;font-weight:700;text-decoration:none}.header-cta,.grid-link{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:var(--button-radius);background:var(--theme-primary);color:#fff;font-size:12px;font-weight:800;text-decoration:none}main{display:grid;gap:var(--section-gap);width:min(var(--content-width),calc(100% - 28px));margin:0 auto;padding:24px 0 60px}.animation-shell{transition:opacity var(--animation-duration) ease var(--animation-delay),transform var(--animation-duration) cubic-bezier(.2,.7,.2,1) var(--animation-delay)}.animation-shell[data-animation='fade']:not(.is-visible){opacity:0}.animation-shell[data-animation='slide-up']:not(.is-visible){opacity:0;transform:translateY(28px)}.animation-shell[data-animation='slide-left']:not(.is-visible){opacity:0;transform:translateX(30px)}.animation-shell[data-animation='zoom']:not(.is-visible){opacity:0;transform:scale(.94)}.content-block{overflow:hidden}.with-shadow{box-shadow:0 18px 35px rgba(25,40,29,.13)}.hero{background:linear-gradient(145deg,var(--theme-primary),color-mix(in srgb,var(--theme-primary) 70%,#4c8b62))!important;color:#fff!important}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.16em;color:#b8dfbe}.content-block h1{max-width:480px;margin:10px 0 0;font-size:42px;line-height:.98;letter-spacing:-.055em}.content-block h2{margin:4px 0 0;font-size:25px;line-height:1.08;letter-spacing:-.035em}.content-block h3{margin:16px 0 8px;font-size:18px;line-height:1.15}.content-block p{margin:13px 0 0;line-height:1.58;opacity:.74}.primary-action{display:inline-flex;margin-top:22px;padding:13px 17px;border-radius:var(--button-radius);background:var(--theme-accent);color:var(--theme-primary);font-size:13px;font-weight:800;text-decoration:none}.feature{border:1px solid rgba(23,33,27,.08)}.feature-number{display:grid;width:38px;height:38px;place-items:center;border-radius:13px;background:#ecf3e8;color:#397044;font-weight:800}.cta{background:color-mix(in srgb,var(--theme-primary) 10%,white)!important}.content-block img,.content-block video{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#0b0f0c}.content-block small{display:block;margin-top:10px;opacity:.65}.video-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#000}.video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.image-placeholder,.lottie-placeholder{display:grid;min-height:120px;place-items:center;padding:20px;border:1px dashed currentColor;border-radius:18px;opacity:.6}.gallery{display:grid;grid-template-columns:1.15fr .85fr;grid-template-rows:1fr 1fr;gap:7px}.gallery img{height:100%;aspect-ratio:auto}.gallery img:first-child{grid-row:1/3;min-height:240px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stats div{display:grid;gap:4px;padding:16px 6px;border-radius:16px;background:rgba(23,33,27,.05);text-align:center}.stats strong{font-size:26px;letter-spacing:-.05em}.stats span{font-size:10px;opacity:.65}.card-grid{display:grid;grid-template-columns:repeat(var(--grid-mobile,1),minmax(0,1fr));gap:10px;margin-top:18px}.card-grid article{display:grid;gap:8px;padding:16px;border-radius:18px;background:rgba(23,33,27,.04)}.card-grid strong{font-size:15px}@media(min-width:700px){.card-grid{grid-template-columns:repeat(var(--grid-tablet,2),minmax(0,1fr))}}@media(min-width:1024px){.card-grid{grid-template-columns:repeat(var(--grid-desktop,3),minmax(0,1fr))}}blockquote{margin:0;font-size:25px;font-weight:700;line-height:1.2;letter-spacing:-.035em}.quote-author{display:grid;gap:2px;margin-top:18px;font-size:12px}.quote-author span{opacity:.6}.richtext p{white-space:pre-wrap}.bullet{display:flex;gap:9px;margin-top:8px;line-height:1.5}.bullet i{width:6px;height:6px;margin-top:8px;border-radius:50%;background:var(--theme-primary)}.site-form{display:grid;gap:12px;margin-top:20px;text-align:left}.site-form label{display:grid;gap:6px;font-size:11px;font-weight:750}.site-form input,.site-form textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid rgba(23,33,27,.18);border-radius:12px;background:#fff;font:inherit}.site-form textarea{min-height:100px;resize:vertical}.site-form button{min-height:46px;border:0;border-radius:var(--button-radius);background:var(--theme-primary);color:#fff;font-weight:800}.honeypot{position:absolute!important;left:-9999px!important}.divider{display:grid;place-items:center;padding:14px 0}.divider i{height:1px;background:#cbd2cc}.spacer{min-height:8px}footer{display:grid;gap:16px;padding:32px max(18px,calc((100vw - var(--content-width))/2));background:var(--theme-primary);color:#fff}footer .footer-main{display:flex;justify-content:space-between;gap:20px}footer .footer-links{display:flex;flex-wrap:wrap;gap:12px}footer .footer-links a{font-size:12px;font-weight:700;text-decoration:none}footer span{opacity:.7}@media(prefers-reduced-motion:reduce){.animation-shell{transition:none!important;transform:none!important;opacity:1!important}}@media(max-width:700px){header .header-main{display:grid}header .header-actions{display:grid;justify-items:start}nav{max-width:55vw;overflow:auto}nav a{white-space:nowrap}footer .footer-main{display:grid}}`;
}

function toRenderBlock(block: BuilderBlock, context: {
  resolveAssetUrl: (value: string) => string;
  resolveFormAction?: (context: { project: BuilderProject; page: BuilderPage; block: BuilderBlock }) => string | null;
  project: BuilderProject;
  page: BuilderPage;
  projectId: string;
  pageId: string;
}): RenderBlock {
  const base: BaseRenderBlock = {
    id: block.id,
    type: block.type,
    background: block.style.background,
    foreground: block.style.foreground,
    align: block.style.align,
    radius: block.style.radius,
    padding: block.style.padding ?? 'normal',
    shadow: block.style.shadow === true,
    animation: block.style.animation ?? 'none',
    animationDurationMs: block.style.animationDuration === 'fast' ? 350 : block.style.animationDuration === 'slow' ? 900 : 600,
    animationDelayMs: Math.max(0, Number(block.style.animationDelay) || 0),
    animationOnce: block.style.animationOnce !== false
  };
  const d = block.data;
  if (block.type === 'spacer') return { ...base, type: 'spacer', size: Math.max(8, Math.min(120, Number(d.size) || 32)) };
  if (block.type === 'divider') return { ...base, type: 'divider', widthPercent: Math.max(20, Math.min(100, Number(d.width) || 100)) };
  if (block.type === 'hero') return { ...base, type: 'hero', eyebrow: d.eyebrow ?? '', title: d.title ?? '', body: d.body ?? '', button: d.button ?? '', href: safeLink(d.href ?? '') };
  if (block.type === 'text') return { ...base, type: 'text', title: d.title ?? '', body: d.body ?? '' };
  if (block.type === 'richtext') return { ...base, type: 'richtext', nodes: richTextNodes(d.content ?? '') };
  if (block.type === 'feature') return { ...base, type: 'feature', kicker: d.kicker ?? '', title: d.title ?? '', body: d.body ?? '' };
  if (block.type === 'cta') return { ...base, type: 'cta', title: d.title ?? '', body: d.body ?? '', button: d.button ?? '', href: safeLink(d.href ?? '') };
  if (block.type === 'image') return {
    ...base,
    type: 'image',
    src: context.resolveAssetUrl(safeImage(d.src ?? '')),
    srcSet: normalizeImageSrcSet(d.srcset ?? '', context.resolveAssetUrl),
    sizes: normalizeImageSizes(d.sizes ?? ''),
    focalX: sanitizeFocalValue(d.focalX, 50),
    focalY: sanitizeFocalValue(d.focalY, 50),
    alt: d.alt ?? '',
    caption: d.caption ?? ''
  };
  if (block.type === 'video') return {
    ...base,
    type: 'video',
    src: context.resolveAssetUrl(safeMedia(d.src ?? '')),
    poster: context.resolveAssetUrl(safeImage(d.poster ?? '')),
    caption: d.caption ?? '',
    title: d.title ?? 'Video',
    embedUrl: safeVideoEmbed(d.src ?? ''),
    autoplay: d.autoplay === 'true',
    loop: d.loop === 'true',
    muted: d.muted !== 'false',
    controls: d.controls !== 'false',
    playsinline: d.playsinline !== 'false'
  };
  if (block.type === 'lottie') return {
    ...base,
    type: 'lottie',
    src: context.resolveAssetUrl(safeMedia(d.src ?? '')),
    title: d.title ?? '',
    loop: d.loop !== 'false',
    autoplay: d.autoplay !== 'false',
    speed: Number(d.speed) || 1
  };
  if (block.type === 'gallery') return { ...base, type: 'gallery', images: [d.image1, d.image2, d.image3].map((value) => context.resolveAssetUrl(safeImage(value ?? ''))), alt: d.alt ?? '' };
  if (block.type === 'stats') return { ...base, type: 'stats', items: [1, 2, 3].map((index) => ({ value: d[`value${index}`] ?? '', label: d[`label${index}`] ?? '' })) };
  if (block.type === 'grid') return {
    ...base,
    type: 'grid',
    title: d.title ?? '',
    body: d.body ?? '',
    columnsMobile: clampColumns(d.columnsMobile, 1, 2, 1),
    columnsTablet: clampColumns(d.columnsTablet, 1, 3, 2),
    columnsDesktop: clampColumns(d.columnsDesktop, 1, 4, 3),
    items: parseGridItems(d.items ?? '')
  };
  if (block.type === 'quote') return { ...base, type: 'quote', quote: d.quote ?? '', author: d.author ?? '', role: d.role ?? '' };
  return {
    ...base,
    type: 'form',
    projectId: context.projectId,
    pageId: context.pageId,
    formId: block.id,
    title: d.title ?? '',
    body: d.body ?? '',
    button: d.button ?? '',
    action: resolvedFormAction(context, block),
    fields: parseFormFields(d.fields ?? '')
  };
}

function parseGridItems(value: string): Array<{ title: string; body: string; href: string; button: string }> {
  return value
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length >= 2)
    .slice(0, 12)
    .map(([title, body, href, button]) => ({ title, body, href: safeLink(href ?? ''), button: button ?? 'Lihat detail' }));
}

function normalizeImageSrcSet(value: string, resolveAssetUrl: (value: string) => string): string {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [candidate, descriptor] = item.split(/\s+/);
      const safe = safeImage(candidate ?? '');
      if (!safe) return '';
      return `${resolveAssetUrl(safe)}${descriptor ? ` ${descriptor}` : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

function normalizeImageSizes(value: string): string {
  const cleaned = String(value || '').trim().replace(/[^a-z0-9(),.%\s/-]/gi, '').slice(0, 160);
  return cleaned || '100vw';
}

function sanitizeFocalValue(value: string | undefined, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function clampColumns(value: string | undefined, min: number, max: number, fallback: number) {
  return Math.max(min, Math.min(max, Number(value) || fallback));
}

function resolvedFormAction(
  context: { resolveFormAction?: (context: { project: BuilderProject; page: BuilderPage; block: BuilderBlock }) => string | null; project: BuilderProject; page: BuilderPage },
  block: BuilderBlock
): string | null {
  const delegated = context.resolveFormAction?.({ project: context.project, page: context.page, block });
  if (delegated !== undefined) return sanitizeFormAction(delegated);
  return sanitizeFormAction(context.project.site?.formAction ?? null);
}

function sanitizeFormAction(value: string | null | undefined): string | null {
  if (!value) return null;
  const action = safeLink(value);
  return action === '#' ? null : action;
}

function richTextNodes(value: string): RichTextNode[] {
  return value
    .split('\n')
    .filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1].trim()))
    .flatMap((line): RichTextNode[] => {
      if (line.startsWith('## ')) return [{ kind: 'heading-2', text: line.slice(3) }];
      if (line.startsWith('### ')) return [{ kind: 'heading-3', text: line.slice(4) }];
      if (line.startsWith('- ')) return [{ kind: 'bullet', text: line.slice(2) }];
      if (!line.trim()) return [];
      return [{ kind: 'paragraph', text: line }];
    });
}

function parseFormFields(value: string): FormField[] {
  return value
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length >= 3)
    .slice(0, 20)
    .map(([label, name, type, required]) => ({
      label,
      name,
      type: ['email', 'tel', 'number', 'textarea'].includes(type) ? type as FormField['type'] : 'text',
      required: required === 'required'
    }));
}
