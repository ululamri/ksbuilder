import { describe, expect, it } from 'vitest';
import { analyzeDesign, suggestModulesFromBrief } from '../src/lib/builder/design-assistant';
import { createBlock } from '../src/lib/builder/catalog';
import type { BuilderProject } from '../src/lib/builder/types';

function makeProject(blocks = [createBlock('hero'), createBlock('text')]): { project: BuilderProject; page: BuilderProject['pages'][0] } {
  const page = {
    id: 'page-1',
    title: 'Landing',
    slug: 'landing',
    status: 'draft' as const,
    seo: { title: 'Landing page', description: 'Pendek dan jelas', image: '', noIndex: false },
    blocks,
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const project: BuilderProject = {
    schemaVersion: 1,
    id: 'project-1',
    name: 'Spark',
    theme: { primary: '#17211b', accent: '#d9ff62', surface: '#f9faf7', text: '#17211b', font: 'modern', buttonRadius: 'pill' },
    pages: [page]
  };
  return { project, page };
}

describe('design assistant', () => {
  it('recommends conversion modules when CTA is missing', () => {
    const { project, page } = makeProject([createBlock('hero'), createBlock('text')]);
    const report = analyzeDesign({ project, page, device: 'mobile', brief: 'buat lebih premium dan mobile' });
    expect(report.score).toBeLessThan(90);
    expect(report.recommendedModules).toContain('lead-capture');
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it('maps brief keywords to relevant modules', () => {
    expect(suggestModulesFromBrief('fokus belajar core dan lab')).toEqual(expect.arrayContaining(['learn-path', 'lab-launch']));
    expect(suggestModulesFromBrief('buat visual lebih premium')).toEqual(expect.arrayContaining(['media-story']));
  });
});
