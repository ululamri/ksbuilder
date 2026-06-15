import { createBlock } from './catalog';
import type { BuilderPage, BuilderProject } from './types';

export function starterProject(): BuilderProject {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: 'Karyra Spark',
    theme: { primary: '#17211b', accent: '#d9ff62', surface: '#ffffff', text: '#17211b', font: 'modern', buttonRadius: 'pill' },
    site: { headerTitle: 'Karyra Spark', footerText: 'Belajar aman. Tumbuh bersama.', navigation: [] },
    reusableSections: [],
    pages: [
      {
        id: crypto.randomUUID(),
        title: 'Beranda',
        slug: 'beranda',
        status: 'draft',
        seo: { title: 'Karyra Spark', description: 'Belajar Web3 dengan aman dan praktis.', image: '', noIndex: false },
        updatedAt: new Date().toISOString(),
        blocks: [createBlock('hero'), createBlock('feature'), createBlock('text'), createBlock('cta')]
      }
    ]
  };
}

export function duplicatePage(page: BuilderPage): BuilderPage {
  return {
    ...structuredClone(page),
    id: crypto.randomUUID(),
    title: `${page.title} salinan`,
    slug: `${page.slug}-salinan`,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    blocks: page.blocks.map((block) => ({ ...block, id: crypto.randomUUID() }))
  };
}
