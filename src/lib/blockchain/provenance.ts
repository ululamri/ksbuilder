import type { BuilderProject } from '$lib/builder/types';

export type BlockchainTargetKind = 'local' | 'evm' | 'ton' | 'dash';

export type BlockchainTargetConfig = {
  kind: BlockchainTargetKind;
  label: string;
  network: string;
  explorerUrl: string;
  contractAddress: string;
  enabled: boolean;
};

export type PublishAttestation = {
  schemaVersion: 1;
  attestationId: string;
  projectId: string;
  projectName: string;
  revision: number;
  publishedAt: string;
  contentHash: string;
  payloadHash: string;
  signer: string | null;
  target: BlockchainTargetConfig;
  pageCount: number;
  notes: string;
};

const TARGETS: Record<BlockchainTargetKind, Pick<BlockchainTargetConfig, 'label' | 'network' | 'explorerUrl' | 'contractAddress'>> = {
  local: { label: 'Local proof', network: 'Off-chain', explorerUrl: '', contractAddress: '' },
  evm: { label: 'Ethereum-like', network: 'EVM', explorerUrl: 'https://etherscan.io', contractAddress: '' },
  ton: { label: 'TON', network: 'TON', explorerUrl: 'https://tonviewer.com', contractAddress: '' },
  dash: { label: 'Dash', network: 'Dash', explorerUrl: 'https://explorer.dash.org', contractAddress: '' }
};

export function defaultBlockchainTarget(kind: BlockchainTargetKind = 'local'): BlockchainTargetConfig {
  const base = TARGETS[kind];
  return {
    kind,
    label: base.label,
    network: base.network,
    explorerUrl: base.explorerUrl,
    contractAddress: base.contractAddress,
    enabled: kind !== 'local'
  };
}

export function blockchainTargetKinds(): BlockchainTargetKind[] {
  return ['local', 'evm', 'ton', 'dash'];
}

export async function createPublishAttestation(input: {
  project: BuilderProject;
  revision: number;
  publishedAt?: string;
  signer?: string | null;
  target: BlockchainTargetConfig;
}): Promise<PublishAttestation> {
  const publishedAt = input.publishedAt ?? new Date().toISOString();
  const contentHash = await sha256Hex(stableStringify(input.project));
  const payload = {
    schemaVersion: 1,
    projectId: input.project.id,
    projectName: input.project.name,
    revision: input.revision,
    publishedAt,
    contentHash,
    signer: input.signer ?? null,
    target: input.target,
    pageCount: input.project.pages.length
  };
  const payloadHash = await sha256Hex(stableStringify(payload));
  return {
    schemaVersion: 1,
    attestationId: `att-${payloadHash.slice(0, 20)}`,
    projectId: input.project.id,
    projectName: input.project.name,
    revision: input.revision,
    publishedAt,
    contentHash,
    payloadHash,
    signer: input.signer ?? null,
    target: input.target,
    pageCount: input.project.pages.length,
    notes: input.target.kind === 'local'
      ? 'Local proof only. Suitable for open-source provenance and future chain signing.'
      : 'Prepared for chain signing. Wallet signature can be added by a target adapter.'
  };
}

export async function verifyPublishAttestation(attestation: PublishAttestation): Promise<boolean> {
  const payload = {
    schemaVersion: 1,
    projectId: attestation.projectId,
    projectName: attestation.projectName,
    revision: attestation.revision,
    publishedAt: attestation.publishedAt,
    contentHash: attestation.contentHash,
    signer: attestation.signer,
    target: attestation.target,
    pageCount: attestation.pageCount
  };
  const expected = await sha256Hex(stableStringify(payload));
  return expected === attestation.payloadHash;
}

export function summarizeTarget(target: BlockchainTargetConfig): string {
  const base = `${target.label} · ${target.network}`;
  return target.contractAddress ? `${base} · ${target.contractAddress}` : base;
}

export function attestationToJson(attestation: PublishAttestation): string {
  return JSON.stringify(attestation, null, 2);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, current]) => [key, sortValue(current)]));
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

