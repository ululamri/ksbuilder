<script lang="ts">
import { onMount } from 'svelte';
import type { BuilderProject, BuilderPage } from '$lib/builder/types';
import { blockchainAdapters, createBlockchainAdapter } from '$lib/blockchain/adapters';
import { attestationToJson, defaultBlockchainTarget, summarizeTarget, type BlockchainTargetConfig, type PublishAttestation } from '$lib/blockchain/provenance';
  import Icon from './Icon.svelte';

  let { project, page, revision, onclose }: { project: BuilderProject; page: BuilderPage; revision: number; onclose: () => void } = $props();
  let target = $state<BlockchainTargetConfig>(defaultBlockchainTarget('local'));
  let signer = $state('');
  let generated = $state<PublishAttestation | null>(null);
  let generating = $state(false);
  let copied = $state(false);

  const storageKey = 'spark-builder:blockchain-target:v1';

  onMount(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BlockchainTargetConfig & { signer?: string };
      const knownKinds = blockchainAdapters.map((adapter) => adapter.kind);
      const kind = knownKinds.includes(parsed.kind) ? parsed.kind : 'local';
      const base = defaultBlockchainTarget(kind);
      target = {
        kind,
        label: parsed.label || base.label,
        network: parsed.network || base.network,
        explorerUrl: parsed.explorerUrl || '',
        contractAddress: parsed.contractAddress || '',
        enabled: parsed.enabled ?? kind !== 'local'
      };
      signer = parsed.signer ?? '';
    } catch {
      // ignore bad local prefs
    }
  });

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify({ ...target, signer }));
  }

  async function generate() {
    generating = true;
    copied = false;
    try {
      persist();
      generated = await createBlockchainAdapter(target.kind).build({ project, revision, signer: signer.trim() || null, target });
    } finally {
      generating = false;
    }
  }

  async function copyJson() {
    if (!generated) return;
    await navigator.clipboard.writeText(attestationToJson(generated));
    copied = true;
    setTimeout(() => { copied = false; }, 1600);
  }

  function resetTarget(kind: BlockchainTargetConfig['kind']) {
    const base = defaultBlockchainTarget(kind);
    target = {
      kind,
      label: base.label,
      network: base.network,
      explorerUrl: base.explorerUrl,
      contractAddress: base.contractAddress,
      enabled: base.enabled
    };
    generated = null;
  }
</script>

<header>
  <div>
    <span>PROVENANCE</span>
    <h2>Blockchain adapter layer</h2>
  </div>
  <button class="round-button" onclick={onclose} aria-label="Tutup"><Icon name="close" /></button>
</header>
<p>Lapisan ini tidak menyimpan konten website di chain. Ia hanya menyiapkan attestation hash dan metadata untuk proof-of-publish yang bisa ditandatangani nanti oleh adapter EVM, TON, atau Dash.</p>

<div class="target-grid">
  {#each blockchainAdapters as adapter}
    <button class:active={target.kind === adapter.kind} onclick={() => resetTarget(adapter.kind)}>
      <strong>{adapter.label}</strong>
      <small>{adapter.target.network}</small>
    </button>
  {/each}
</div>

<div class="form-grid">
  <label>Label target<input value={target.label} onchange={(event) => target.label = event.currentTarget.value} /></label>
  <label>Network<input value={target.network} onchange={(event) => target.network = event.currentTarget.value} /></label>
  <label>Explorer URL<input value={target.explorerUrl} onchange={(event) => target.explorerUrl = event.currentTarget.value} /></label>
  <label>Contract / wallet<input value={target.contractAddress} onchange={(event) => target.contractAddress = event.currentTarget.value} /></label>
  <label>Signer address<input value={signer} onchange={(event) => signer = event.currentTarget.value} /></label>
</div>

<div class="summary">
  <small>Target aktif</small>
  <strong>{summarizeTarget(target)}</strong>
  <p>{target.kind === 'local' ? 'Mode lokal hanya membuat proof hash, cocok untuk open-source dan verifikasi internal.' : 'Mode ini menyiapkan payload yang siap diteruskan ke chain adapter saat wallet signing tersedia.'}</p>
</div>

<div class="action-row">
  <button class="primary" onclick={generate} disabled={generating}>{generating ? 'Membuat proof...' : 'Generate attestation'}</button>
  <button class="ghost" onclick={copyJson} disabled={!generated}>{copied ? 'Tersalin' : 'Copy JSON'}</button>
</div>

{#if generated}
  <div class="proof-card">
    <div><span>Attestation ID</span><strong>{generated.attestationId}</strong></div>
    <div><span>Content hash</span><strong>{generated.contentHash}</strong></div>
    <div><span>Payload hash</span><strong>{generated.payloadHash}</strong></div>
    <div><span>Revision</span><strong>{generated.revision}</strong></div>
    <div><span>Page count</span><strong>{generated.pageCount}</strong></div>
    <small>{generated.notes}</small>
    <pre>{attestationToJson(generated)}</pre>
  </div>
{/if}

<style>
  .target-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}.target-grid button{padding:12px;border:1px solid #e4e7e3;border-radius:15px;background:#fafbf9;text-align:left}.target-grid button.active{border-color:#5f9470;background:#f1f7ef}.target-grid strong{display:block;font-size:13px}.target-grid small{display:block;margin-top:3px;color:#7b867e;font-size:10px}.form-grid{display:grid;gap:10px;margin-top:14px}.form-grid label{display:grid;gap:6px;color:#526158;font-size:11px;font-weight:700}.form-grid input{width:100%;padding:12px 13px;border:1px solid #dce1dc;border-radius:13px;background:#fafbf9;color:#17211b;font:inherit;font-size:13px}.summary{display:grid;gap:6px;margin-top:16px;padding:14px;border:1px solid #e4e7e3;border-radius:16px;background:#fff}.summary small,.proof-card span{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6f7e74}.summary strong{font-size:14px}.summary p{margin:0;color:#7b867e;font-size:11px;line-height:1.4}.action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.action-row button{min-height:46px;border:0;border-radius:13px;font-size:12px;font-weight:850}.action-row .primary{background:#17211b;color:#fff}.action-row .ghost{background:#edf2e9;color:#315c42}.proof-card{display:grid;gap:10px;margin-top:16px;padding:14px;border:1px solid #e4e7e3;border-radius:18px;background:#fafbf9}.proof-card div{display:grid;gap:3px}.proof-card strong{font-size:12px;word-break:break-all}.proof-card small{color:#7b867e;font-size:11px;line-height:1.4}.proof-card pre{margin:0;padding:12px;overflow:auto;border-radius:14px;background:#17211b;color:#d9ff62;font-size:10px;line-height:1.5}
</style>
