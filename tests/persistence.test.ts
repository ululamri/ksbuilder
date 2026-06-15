import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../src/lib/builder/persistence';

const valid = {
  schemaVersion: 1 as const,
  id: 'project',
  name: 'Project',
  reusableSections: [{ id: 'section-1', name: 'Reusable lama', blocks: [{ id: 'block-r', type: 'text' as const, data: { title: 'Reusable', body: 'Lama' }, style: { background: '#ffffff', foreground: '#17211b', align: 'left' as const, radius: 'large' as const } }] }],
  pages: [{ id: 'page', title: 'Page', slug: 'page', status: 'draft' as const, updatedAt: new Date(0).toISOString(), blocks: [{ id: 'block', type: 'text' as const, data: { title: 'Hello', body: 'World' }, style: { background: '#ffffff', foreground: '#17211b', align: 'left' as const, radius: 'large' as const } }] }]
};

describe('project normalization', () => {
  it('migrates old drafts with defaults', () => {
    const result = normalizeProject(structuredClone(valid));
    expect(result?.theme?.primary).toBe('#17211b');
    expect(result?.pages[0].seo?.title).toBe('Page');
    expect(result?.pages[0].blocks[0].style.padding).toBe('normal');
    expect(result?.site?.homePageId).toBe('page');
    expect(result?.metadata?.kind).toBe('site');
    expect(result?.metadata?.hub.cardTitle).toBe('Project');
    expect(result?.componentLibrary?.[0].name).toBe('Reusable lama');
  });

  it('replaces CSS injection colors', () => {
    const draft = structuredClone(valid);
    draft.pages[0].blocks[0].style.background = 'red;position:fixed';
    expect(normalizeProject(draft)?.pages[0].blocks[0].style.background).toBe('#ffffff');
  });

  it('rejects unknown blocks and malformed structures', () => {
    const draft = structuredClone(valid) as any;
    draft.pages[0].blocks[0].type = 'script';
    expect(normalizeProject(draft)).toBeNull();
    expect(normalizeProject({ schemaVersion: 1, pages: [null] } as any)).toBeNull();
  });
});
