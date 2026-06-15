import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createBlock } from '../src/lib/builder/catalog';
import { createProjectExport } from '../src/lib/server/project-export';
import type { BuilderProject } from '../src/lib/builder/types';

function makeProject(): BuilderProject {
  const hero = createBlock('hero');
  hero.data.title = 'Halo Spark';
  const lottie = createBlock('lottie');
  lottie.data.src = 'https://cdn.example.com/lottie.json';
  return {
    schemaVersion: 1,
    id: 'project-1',
    name: 'Spark',
    theme: { primary: '#17211b', accent: '#d9ff62', surface: '#f9faf7', text: '#17211b', font: 'modern', buttonRadius: 'pill' },
    metadata: {
      kind: 'hub',
      audience: 'Developer',
      level: 'intermediate',
      durationMinutes: 60,
      summary: 'Hub ready artifact',
      tags: ['hub', 'web3'],
      visibilityTarget: 'spark-hub',
      learn: { track: '', format: 'path', outcomes: [], prerequisites: [] },
      lab: { profile: '', runtime: 'browser', difficulty: 'guided', estimatedMinutes: null },
      hub: { listed: true, category: 'Showcase', cardTitle: 'Spark Hub Card', cardSummary: 'Ringkasan katalog.' }
    },
    pages: [{
      id: 'page-1',
      title: 'Beranda',
      slug: 'beranda',
      status: 'published',
      seo: { title: 'Spark', description: 'Builder', image: '', noIndex: false },
      updatedAt: '2026-06-15T00:00:00.000Z',
      blocks: [hero, lottie]
    }]
  };
}

describe('project export', () => {
  it('exports static html from the shared render contract', () => {
    const artifact = createProjectExport(makeProject(), 'static-html');
    const files = unzipSync(artifact.body);
    expect(artifact.filename).toBe('project-1.zip');
    expect(Object.keys(files)).toContain('site.contract.json');
    expect(Object.keys(files)).toContain('hub.manifest.json');
    expect(strFromU8(files['index.html'])).toContain('Halo Spark');
    expect(strFromU8(files['styles.css'])).toContain('.content-block');
    expect(strFromU8(files['hub.manifest.json'])).toContain('"visibilityTarget": "spark-hub"');
  });

  it('exports a Next.js app bundle with the same contract data', () => {
    const artifact = createProjectExport(makeProject(), 'nextjs');
    const files = unzipSync(artifact.body);
    expect(artifact.filename).toBe('project-1-nextjs.zip');
    expect(strFromU8(files['package.json'])).toContain('"next"');
    expect(strFromU8(files['lib/site.tsx'])).toContain('renderPageByRoute');
    expect(strFromU8(files['data/site.contract.json'])).toContain('"version": 2');
    expect(strFromU8(files['data/hub.manifest.json'])).toContain('"listed": true');
  });
});
