import type { BuilderProject } from './types';

const STORAGE_KEY = 'spark-builder:project:v1';
const BLOCK_TYPES = new Set(['hero', 'text', 'richtext', 'feature', 'cta', 'image', 'video', 'lottie', 'gallery', 'stats', 'quote', 'form', 'divider', 'spacer']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

export function normalizeProject(parsed: BuilderProject): BuilderProject | null {
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1 || !Array.isArray(parsed.pages) || parsed.pages.length === 0 || parsed.pages.length > 100) return null;
  if (parsed.pages.some((page) => !page || typeof page !== 'object' || !Array.isArray(page.blocks) || page.blocks.length > 500)) return null;
  if (parsed.pages.some((page) => page.blocks.some((block) => !block || !BLOCK_TYPES.has(block.type) || !block.data || typeof block.data !== 'object' || Array.isArray(block.data) || !block.style || typeof block.style !== 'object'))) return null;
  parsed.theme ??= { primary: '#17211b', accent: '#d9ff62', surface: '#ffffff', text: '#17211b', font: 'modern', buttonRadius: 'pill' };
  parsed.site ??= { headerTitle: parsed.name, footerText: 'Belajar aman. Tumbuh bersama.', navigation: [] };
  parsed.reusableSections ??= [];
  parsed.theme.primary = safeColor(parsed.theme.primary, '#17211b');
  parsed.theme.accent = safeColor(parsed.theme.accent, '#d9ff62');
  parsed.theme.surface = safeColor(parsed.theme.surface, '#ffffff');
  parsed.theme.text = safeColor(parsed.theme.text, '#17211b');
  if (!['modern', 'friendly', 'editorial'].includes(parsed.theme.font)) parsed.theme.font = 'modern';
  if (!['soft', 'pill', 'square'].includes(parsed.theme.buttonRadius)) parsed.theme.buttonRadius = 'pill';
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
