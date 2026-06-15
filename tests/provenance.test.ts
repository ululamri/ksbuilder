import { describe, expect, it } from 'vitest';
import { createBlock } from '../src/lib/builder/catalog';
import { createPublishAttestation, defaultBlockchainTarget, verifyPublishAttestation } from '../src/lib/blockchain/provenance';
import type { BuilderProject } from '../src/lib/builder/types';

function makeProject(): BuilderProject {
  return {
    schemaVersion: 1,
    id: 'project-1',
    name: 'Spark',
    theme: { primary: '#17211b', accent: '#d9ff62', surface: '#f9faf7', text: '#17211b', font: 'modern', buttonRadius: 'pill' },
    pages: [{
      id: 'page-1',
      title: 'Beranda',
      slug: 'beranda',
      status: 'published',
      seo: { title: 'Spark', description: 'Builder', image: '', noIndex: false },
      updatedAt: '2026-06-15T00:00:00.000Z',
      blocks: [createBlock('hero'), createBlock('cta')]
    }]
  };
}

describe('blockchain provenance', () => {
  it('creates a stable attestation for a project revision', async () => {
    const attestation = await createPublishAttestation({
      project: makeProject(),
      revision: 7,
      signer: '0x1234',
      target: defaultBlockchainTarget('evm')
    });
    expect(attestation.attestationId).toMatch(/^att-/);
    expect(attestation.target.kind).toBe('evm');
    expect(await verifyPublishAttestation(attestation)).toBe(true);
  });

  it('keeps local provenance as the default target', () => {
    expect(defaultBlockchainTarget().kind).toBe('local');
    expect(defaultBlockchainTarget().enabled).toBe(false);
  });
});

