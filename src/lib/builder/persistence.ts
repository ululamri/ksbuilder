import type { BuilderProject } from './types';

const STORAGE_KEY = 'spark-builder:project:v1';
const BLOCK_TYPES = new Set(['hero', 'text', 'richtext', 'feature', 'cta', 'image', 'video', 'lottie', 'gallery', 'stats', 'quote', 'form', 'divider', 'spacer', 'symbol', 'grid']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

function safeString(value: unknown, fallback = '', limit = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : fallback;
}

function safeStringList(value: unknown, limit = 20, itemLimit = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeString(item, '', itemLimit))
    .filter(Boolean)
    .slice(0, limit);
}

export function normalizeProject(parsed: BuilderProject): BuilderProject | null {
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1 || !Array.isArray(parsed.pages) || parsed.pages.length === 0 || parsed.pages.length > 100) return null;
  if (parsed.pages.some((page) => !page || typeof page !== 'object' || !Array.isArray(page.blocks) || page.blocks.length > 500)) return null;
  if (parsed.pages.some((page) => page.blocks.some((block) => !block || !BLOCK_TYPES.has(block.type) || !block.data || typeof block.data !== 'object' || Array.isArray(block.data) || !block.style || typeof block.style !== 'object'))) return null;
  parsed.theme ??= {
    primary: '#17211b',
    accent: '#d9ff62',
    surface: '#ffffff',
    text: '#17211b',
    font: 'modern',
    buttonRadius: 'pill',
    contentWidth: 'standard',
    sectionGap: 'normal',
    surfaceStyle: 'flat'
  };
  parsed.site ??= { headerTitle: parsed.name, footerText: 'Belajar aman. Tumbuh bersama.', navigation: [], headerCtaLabel: 'Mulai', headerCtaHref: '/core', footerLinks: [], formAction: '' };
  parsed.metadata ??= {
    kind: 'site',
    audience: 'Pembelajar Indonesia',
    level: 'mixed',
    durationMinutes: null,
    summary: '',
    tags: [],
    visibilityTarget: 'spark',
    learn: { track: '', format: 'path', outcomes: [], prerequisites: [] },
    lab: { profile: '', runtime: 'browser', difficulty: 'guided', estimatedMinutes: null },
    hub: { listed: false, category: '', cardTitle: parsed.name, cardSummary: '' }
  };
  parsed.componentLibrary ??= [];
  parsed.reusableSections ??= [];
  parsed.theme.primary = safeColor(parsed.theme.primary, '#17211b');
  parsed.theme.accent = safeColor(parsed.theme.accent, '#d9ff62');
  parsed.theme.surface = safeColor(parsed.theme.surface, '#ffffff');
  parsed.theme.text = safeColor(parsed.theme.text, '#17211b');
  if (!['modern', 'friendly', 'editorial'].includes(parsed.theme.font)) parsed.theme.font = 'modern';
  if (!['soft', 'pill', 'square'].includes(parsed.theme.buttonRadius)) parsed.theme.buttonRadius = 'pill';
  if (!['compact', 'standard', 'wide'].includes(parsed.theme.contentWidth ?? '')) parsed.theme.contentWidth = 'standard';
  if (!['tight', 'normal', 'relaxed'].includes(parsed.theme.sectionGap ?? '')) parsed.theme.sectionGap = 'normal';
  if (!['flat', 'tinted', 'contrast'].includes(parsed.theme.surfaceStyle ?? '')) parsed.theme.surfaceStyle = 'flat';
  parsed.site.headerTitle = safeString(parsed.site.headerTitle, parsed.name, 80) || parsed.name;
  parsed.site.footerText = safeString(parsed.site.footerText, 'Belajar aman. Tumbuh bersama.', 140);
  parsed.site.headerCtaLabel = safeString(parsed.site.headerCtaLabel, 'Mulai', 40);
  parsed.site.headerCtaHref = typeof parsed.site.headerCtaHref === 'string' ? parsed.site.headerCtaHref.trim().slice(0, 240) : '/core';
  parsed.site.footerLinks = Array.isArray(parsed.site.footerLinks)
    ? parsed.site.footerLinks
      .filter((item) => item && typeof item === 'object')
      .slice(0, 12)
      .map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        label: safeString(item.label, 'Link', 50) || 'Link',
        href: typeof item.href === 'string' ? item.href.trim().slice(0, 240) : '/'
      }))
    : [];
  parsed.site.formAction = typeof parsed.site.formAction === 'string' ? parsed.site.formAction.trim().slice(0, 240) : '';
  parsed.site.homePageId = typeof parsed.site.homePageId === 'string' ? parsed.site.homePageId : undefined;
  parsed.metadata.kind = ['site', 'core', 'learn', 'lab', 'hub'].includes(parsed.metadata.kind) ? parsed.metadata.kind : 'site';
  parsed.metadata.audience = safeString(parsed.metadata.audience, 'Pembelajar Indonesia', 120);
  parsed.metadata.level = ['mixed', 'beginner', 'intermediate', 'advanced'].includes(parsed.metadata.level) ? parsed.metadata.level : 'mixed';
  parsed.metadata.durationMinutes = parsed.metadata.durationMinutes === null ? null : Math.max(0, Math.min(24 * 60, Number(parsed.metadata.durationMinutes) || 0));
  parsed.metadata.summary = safeString(parsed.metadata.summary, '', 400);
  parsed.metadata.tags = safeStringList(parsed.metadata.tags);
  parsed.metadata.visibilityTarget = ['spark', 'spark-hub', 'both'].includes(parsed.metadata.visibilityTarget) ? parsed.metadata.visibilityTarget : 'spark';
  parsed.metadata.learn ??= { track: '', format: 'path', outcomes: [], prerequisites: [] };
  parsed.metadata.learn.track = safeString(parsed.metadata.learn.track, '', 80);
  parsed.metadata.learn.format = ['lesson', 'path', 'cohort'].includes(parsed.metadata.learn.format) ? parsed.metadata.learn.format : 'path';
  parsed.metadata.learn.outcomes = safeStringList(parsed.metadata.learn.outcomes, 20, 140);
  parsed.metadata.learn.prerequisites = safeStringList(parsed.metadata.learn.prerequisites, 20, 140);
  parsed.metadata.lab ??= { profile: '', runtime: 'browser', difficulty: 'guided', estimatedMinutes: null };
  parsed.metadata.lab.profile = safeString(parsed.metadata.lab.profile, '', 80);
  parsed.metadata.lab.runtime = ['browser', 'container', 'external'].includes(parsed.metadata.lab.runtime) ? parsed.metadata.lab.runtime : 'browser';
  parsed.metadata.lab.difficulty = ['guided', 'standard', 'challenge'].includes(parsed.metadata.lab.difficulty) ? parsed.metadata.lab.difficulty : 'guided';
  parsed.metadata.lab.estimatedMinutes = parsed.metadata.lab.estimatedMinutes === null ? null : Math.max(0, Math.min(24 * 60, Number(parsed.metadata.lab.estimatedMinutes) || 0));
  parsed.metadata.hub ??= { listed: false, category: '', cardTitle: parsed.name, cardSummary: '' };
  parsed.metadata.hub.listed = parsed.metadata.hub.listed === true;
  parsed.metadata.hub.category = safeString(parsed.metadata.hub.category, '', 80);
  parsed.metadata.hub.cardTitle = safeString(parsed.metadata.hub.cardTitle, parsed.name, 80) || parsed.name;
  parsed.metadata.hub.cardSummary = safeString(parsed.metadata.hub.cardSummary, '', 220);
  parsed.pages = parsed.pages.map((page) => ({
    ...page,
    seo: page.seo ?? { title: page.title, description: '', image: '', noIndex: false },
    blocks: page.blocks.map((block) => ({
      ...block,
      data: Object.fromEntries(Object.entries(block.data).map(([key, value]) => [key.slice(0, 40), String(value).slice(0, 10_000)])),
      style: {
        ...block.style,
        background: safeColor(block.style.background, '#ffffff'),
        foreground: safeColor(block.style.foreground, '#17211b'),
        align: block.style.align === 'center' ? 'center' : 'left',
        radius: ['none', 'medium', 'large'].includes(block.style.radius) ? block.style.radius : 'large',
        padding: (['compact', 'normal', 'roomy'].includes(block.style.padding ?? '') ? block.style.padding : 'normal') as 'compact' | 'normal' | 'roomy',
        shadow: block.style.shadow === true,
        hiddenOn: (block.style.hiddenOn ?? []).filter((item) => ['mobile', 'tablet', 'desktop'].includes(item)),
        animation: ['none', 'fade', 'slide-up', 'slide-left', 'zoom'].includes(block.style.animation ?? '') ? block.style.animation : 'none',
        animationDuration: ['fast', 'normal', 'slow'].includes(block.style.animationDuration ?? '') ? block.style.animationDuration : 'normal',
        animationDelay: Math.max(0, Math.min(2000, Number(block.style.animationDelay) || 0)),
        animationOnce: block.style.animationOnce !== false
      }
    }))
  }));
  const migratedReusable = parsed.reusableSections.map((section) => ({
    id: section.id,
    name: safeString(section.name, 'Reusable section', 80) || 'Reusable section',
    category: 'Section' as const,
    description: '',
    updatedAt: new Date().toISOString(),
    blocks: section.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
      data: Object.fromEntries(Object.entries(block.data).map(([key, value]) => [key.slice(0, 40), String(value).slice(0, 10_000)]))
    }))
  }));
  if (!parsed.componentLibrary.length && migratedReusable.length) parsed.componentLibrary = migratedReusable;
  parsed.componentLibrary = parsed.componentLibrary
    .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.blocks))
    .slice(0, 150)
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
      name: safeString(entry.name, 'Component', 80) || 'Component',
      category: ['Section', 'Hero', 'Content', 'Conversion', 'Media', 'Custom'].includes(entry.category) ? entry.category : 'Custom',
      description: safeString(entry.description, '', 180),
      updatedAt: typeof entry.updatedAt === 'string' && entry.updatedAt ? entry.updatedAt : new Date().toISOString(),
      blocks: entry.blocks
        .filter((block) => block && BLOCK_TYPES.has(block.type))
        .slice(0, 50)
        .map((block) => ({
          ...block,
          id: typeof block.id === 'string' ? block.id : crypto.randomUUID(),
          data: Object.fromEntries(Object.entries(block.data ?? {}).map(([key, value]) => [key.slice(0, 40), String(value).slice(0, 10_000)])),
          style: {
            ...block.style,
            background: safeColor(block.style?.background, '#ffffff'),
            foreground: safeColor(block.style?.foreground, '#17211b'),
            align: block.style?.align === 'center' ? 'center' : 'left',
            radius: ['none', 'medium', 'large'].includes(block.style?.radius) ? block.style.radius : 'large',
            padding: (['compact', 'normal', 'roomy'].includes(block.style?.padding ?? '') ? block.style.padding : 'normal') as 'compact' | 'normal' | 'roomy',
            shadow: block.style?.shadow === true,
            hiddenOn: (block.style?.hiddenOn ?? []).filter((item) => ['mobile', 'tablet', 'desktop'].includes(item)),
            animation: ['none', 'fade', 'slide-up', 'slide-left', 'zoom'].includes(block.style?.animation ?? '') ? block.style.animation : 'none',
            animationDuration: ['fast', 'normal', 'slow'].includes(block.style?.animationDuration ?? '') ? block.style.animationDuration : 'normal',
            animationDelay: Math.max(0, Math.min(2000, Number(block.style?.animationDelay) || 0)),
            animationOnce: block.style?.animationOnce !== false
          }
        }))
    }));
  if (!parsed.pages.some((page) => page.id === parsed.site?.homePageId)) parsed.site.homePageId = parsed.pages[0]?.id;
  return parsed;
}

export function loadProject(): BuilderProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BuilderProject;
    return normalizeProject(parsed);
  } catch {
    return null;
  }
}

export function saveProject(project: BuilderProject): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}
