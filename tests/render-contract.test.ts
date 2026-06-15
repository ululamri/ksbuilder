import { describe, expect, it } from 'vitest';
import { createBlock } from '../src/lib/builder/catalog';
import { createSiteRenderContract, exportedSiteCss, RENDER_CONTRACT_VERSION } from '../src/lib/renderer/contract';
import type { BuilderProject } from '../src/lib/builder/types';

function makeProject(): BuilderProject {
  const hero = createBlock('hero');
  hero.data.href = '/learn';
  const richtext = createBlock('richtext');
  richtext.data.content = '## Judul\nParagraf pertama\n- Poin penting';
  const form = createBlock('form');
  form.data.fields = 'Email|email|email|required\nPesan|message|textarea|required';
    return {
      schemaVersion: 1,
      id: 'project-1',
      name: 'Spark',
      theme: { primary: '#17211b', accent: '#d9ff62', surface: '#f9faf7', text: '#17211b', font: 'modern', buttonRadius: 'pill' },
      site: { headerTitle: 'Spark Academy', footerText: 'Footer', navigation: [], formAction: 'https://forms.example.com/submit' },
      metadata: {
        kind: 'learn',
        audience: 'Developer pemula',
        level: 'beginner',
        durationMinutes: 45,
        summary: 'Intro path',
        tags: ['learn', 'core'],
        visibilityTarget: 'both',
        learn: { track: 'Core', format: 'path', outcomes: ['Memahami dasar'], prerequisites: ['Akun aktif'] },
        lab: { profile: 'Sandbox', runtime: 'browser', difficulty: 'guided', estimatedMinutes: 20 },
        hub: { listed: true, category: 'Web3 Basics', cardTitle: 'Spark Core', cardSummary: 'Mulai dari dasar.' }
      },
      pages: [{
        id: 'page-1',
        title: 'Beranda',
        slug: 'beranda',
        status: 'published',
        seo: { title: 'Spark', description: 'Builder', image: '', noIndex: false },
        updatedAt: '2026-06-15T00:00:00.000Z',
        blocks: [hero, richtext, form]
      }]
    };
  }

describe('render contract', () => {
  it('normalizes builder content into a stable render contract', () => {
    const contract = createSiteRenderContract(makeProject());
    expect(contract.version).toBe(RENDER_CONTRACT_VERSION);
    expect(contract.project.headerTitle).toBe('Spark Academy');
    expect(contract.project.metadata.kind).toBe('learn');
    expect(contract.project.metadata.visibilityTarget).toBe('both');
    expect(contract.pages).toHaveLength(1);
    expect(contract.pages[0].route).toBe('');
    expect(contract.pages[0].blocks[0].type).toBe('hero');
    expect(contract.pages[0].blocks[1].type).toBe('richtext');
    if (contract.pages[0].blocks[1].type !== 'richtext') throw new Error('expected richtext block');
    expect(contract.pages[0].blocks[1].nodes.map((node) => node.kind)).toEqual(['heading-2', 'paragraph', 'bullet']);
    if (contract.pages[0].blocks[2].type !== 'form') throw new Error('expected form block');
    expect(contract.pages[0].blocks[2].fields[1]).toMatchObject({ type: 'textarea', required: true });
    expect(contract.pages[0].blocks[2].action).toBe('https://forms.example.com/submit');
  });

  it('produces theme css from the same contract tokens', () => {
    const contract = createSiteRenderContract(makeProject());
    const css = exportedSiteCss(contract.project.theme);
    expect(css).toContain('--theme-primary:#17211b');
    expect(css).toContain('.content-block');
  });
});
