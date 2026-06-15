import type { BuilderProject } from '$lib/builder/types';
import { attestationToJson, createPublishAttestation, defaultBlockchainTarget, type BlockchainTargetConfig, type BlockchainTargetKind, type PublishAttestation, verifyPublishAttestation } from './provenance';

export type BlockchainProofInput = {
  project: BuilderProject;
  revision: number;
  signer?: string | null;
  target?: BlockchainTargetConfig;
};

export interface BlockchainAdapter {
  kind: BlockchainTargetKind;
  label: string;
  target: BlockchainTargetConfig;
  build(input: BlockchainProofInput): Promise<PublishAttestation>;
  verify(attestation: PublishAttestation): Promise<boolean>;
  serialize(attestation: PublishAttestation): string;
}

class BaseBlockchainAdapter implements BlockchainAdapter {
  constructor(public kind: BlockchainTargetKind) {}

  get label() {
    return defaultBlockchainTarget(this.kind).label;
  }

  get target() {
    return defaultBlockchainTarget(this.kind);
  }

  async build(input: BlockchainProofInput): Promise<PublishAttestation> {
    return createPublishAttestation({
      project: input.project,
      revision: input.revision,
      signer: input.signer ?? null,
      target: input.target ?? this.target
    });
  }

  async verify(attestation: PublishAttestation): Promise<boolean> {
    return verifyPublishAttestation(attestation);
  }

  serialize(attestation: PublishAttestation): string {
    return attestationToJson(attestation);
  }
}

export function createBlockchainAdapter(kind: BlockchainTargetKind = 'local'): BlockchainAdapter {
  return new BaseBlockchainAdapter(kind);
}

export const blockchainAdapters: BlockchainAdapter[] = (['local', 'evm', 'ton', 'dash'] as BlockchainTargetKind[]).map((kind) => createBlockchainAdapter(kind));
