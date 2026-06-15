<script lang="ts">
  import type { BuilderMediaAsset } from '$lib/builder/cms-gateway';

  let { assets, uploading, onupload, onselect, onrename, onmove, ondelete, onfocus }: {
    assets: BuilderMediaAsset[];
    uploading: boolean;
    onupload: (files: File[], folder?: string) => void;
    onselect: (asset: BuilderMediaAsset) => void;
    onrename: (assetId: string, fileName: string) => void;
    onmove: (assetId: string, folder: string) => void;
    ondelete: (assetId: string) => void;
    onfocus: (assetId: string, focalX: number, focalY: number) => void;
  } = $props();

  let query = $state('');
  let activeFolder = $state('');
  let uploadFolder = $state('');
  let selectedId = $state<string | null>(null);
  let draftName = $state('');
  let draftFolder = $state('');
  let draftFocalX = $state(50);
  let draftFocalY = $state(50);

  const folders = $derived(Array.from(new Set(assets.map((asset) => asset.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id')));
  const filteredAssets = $derived(assets.filter((asset) => {
    const matchesFolder = !activeFolder || asset.folder === activeFolder;
    const text = `${asset.fileName} ${asset.folder} ${asset.contentType}`.toLowerCase();
    const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase());
    return matchesFolder && matchesQuery;
  }));
  const selected = $derived(assets.find((asset) => asset.id === selectedId) ?? filteredAssets[0] ?? null);

  $effect(() => {
    if (!selected) {
      selectedId = null;
      draftName = '';
      draftFolder = activeFolder;
      draftFocalX = 50;
      draftFocalY = 50;
      return;
    }
    if (selected.id !== selectedId) selectedId = selected.id;
    draftName = selected.fileName;
    draftFolder = selected.folder;
    draftFocalX = selected.focalX;
    draftFocalY = selected.focalY;
  });

  function triggerUpload(event: Event) {
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    if (!files.length) return;
    onupload(files, uploadFolder.trim());
    (event.currentTarget as HTMLInputElement).value = '';
  }

  function saveMeta() {
    if (!selected) return;
    if (draftName.trim() && draftName.trim() !== selected.fileName) onrename(selected.id, draftName);
    if (draftFolder.trim() !== selected.folder) onmove(selected.id, draftFolder);
    if (draftFocalX !== selected.focalX || draftFocalY !== selected.focalY) onfocus(selected.id, draftFocalX, draftFocalY);
  }

  function copyUrl() {
    if (!selected) return;
    navigator.clipboard?.writeText(selected.url);
  }
</script>

<div class="toolbar">
  <label class="upload">
    <strong>{uploading ? 'Mengunggah...' : 'Unggah file'}</strong>
    <small>Bulk upload aktif · raster dioptimalkan otomatis + varian responsif · GIF 10-15 MB · MP4/WebM 50 MB · Lottie JSON 2 MB</small>
    <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,application/json,.json" disabled={uploading} onchange={triggerUpload} />
  </label>
  <label class="upload-folder">
    <span>Folder upload</span>
    <input value={uploadFolder} placeholder="mis. landing/hero" onchange={(event) => uploadFolder = event.currentTarget.value} />
  </label>
</div>

<div class="manager-filters">
  <input class="search" value={query} placeholder="Cari nama file atau folder" onchange={(event) => query = event.currentTarget.value} />
  <div class="folders">
    <button class:active={!activeFolder} onclick={() => activeFolder = ''}>Semua</button>
    {#each folders as folder}<button class:active={activeFolder === folder} onclick={() => activeFolder = folder}>{folder}</button>{/each}
  </div>
</div>

<div class="manager-shell">
  <div class="media-grid">
    {#each filteredAssets as asset}
      <button class:selected={selected?.id === asset.id} onclick={() => selectedId = asset.id}>
        {#if asset.contentType.startsWith('video/')}
          <video src={asset.url} muted preload="metadata"></video>
        {:else if asset.contentType === 'application/json'}
          <div class="file-preview">LOT</div>
        {:else}
          <img src={asset.url} alt={asset.fileName} style={`object-position:${asset.focalX}% ${asset.focalY}%`} />
        {/if}
        <span>{asset.fileName}</span>
        <small>{asset.folder || 'root'} · {asset.contentType.split('/')[1].toUpperCase()} · {Math.ceil(asset.size / 1024)} KB{asset.variants.length ? ` · ${asset.variants.length} varian` : ''}</small>
      </button>
    {/each}
  </div>

  {#if selected}
    <aside class="detail-card">
      <div class="detail-preview">
        {#if selected.contentType.startsWith('video/')}
          <video src={selected.url} muted controls preload="metadata"></video>
        {:else if selected.contentType === 'application/json'}
          <div class="file-preview">LOT</div>
        {:else}
          <img src={selected.url} alt={selected.fileName} style={`object-position:${draftFocalX}% ${draftFocalY}%`} />
        {/if}
      </div>
      <div class="detail-meta">
        <label>Nama file<input value={draftName} onchange={(event) => draftName = event.currentTarget.value} /></label>
        <label>Folder<input value={draftFolder} placeholder="root" onchange={(event) => draftFolder = event.currentTarget.value} /></label>
        {#if selected.contentType.startsWith('image/')}
          <label>Focal X <input type="range" min="0" max="100" step="1" value={draftFocalX} oninput={(event) => draftFocalX = Number(event.currentTarget.value)} /><small>{draftFocalX}%</small></label>
          <label>Focal Y <input type="range" min="0" max="100" step="1" value={draftFocalY} oninput={(event) => draftFocalY = Number(event.currentTarget.value)} /><small>{draftFocalY}%</small></label>
        {/if}
        {#if selected.variants.length}
          <div class="variants">
            <strong>Varian responsif</strong>
            {#each selected.variants as variant}
              <div><span>{variant.width}w</span><small>{Math.ceil(variant.size / 1024)} KB · {variant.contentType.split('/')[1].toUpperCase()}</small></div>
            {/each}
          </div>
        {/if}
        <small>Dibuat {new Date(selected.createdAt).toLocaleString('id-ID')} · Diubah {new Date(selected.updatedAt).toLocaleString('id-ID')}</small>
      </div>
      <div class="detail-actions">
        <button class="primary" onclick={() => onselect(selected)}>Gunakan di blok</button>
        <button onclick={saveMeta}>Simpan metadata</button>
        <button onclick={copyUrl}>Copy URL</button>
        <button class="danger" onclick={() => ondelete(selected.id)}>Hapus file</button>
      </div>
    </aside>
  {/if}
</div>

{#if filteredAssets.length === 0}<p class="empty">Belum ada file untuk filter ini. Unggah aset pertama atau ganti folder/filter.</p>{/if}

<style>
  .toolbar{display:grid;gap:10px}.upload{display:grid;gap:3px;margin:16px 0 0;padding:18px;border:1px dashed #8ea598;border-radius:17px;background:#f3f7f1;color:#315c42;text-align:center;cursor:pointer}.upload small{font-size:10px;opacity:.7}.upload input{display:none}.upload-folder{display:grid;gap:6px;color:#526158;font-size:11px;font-weight:750}.upload-folder input,.search,.detail-meta input{width:100%;min-height:44px;padding:11px 13px;border:1px solid #dce1dc;border-radius:13px;background:#fafbf9;color:#17211b;font:inherit}.detail-meta input[type='range']{padding:0;border:0;background:transparent}.manager-filters{display:grid;gap:10px;margin:14px 0}.folders{display:flex;gap:8px;overflow:auto;padding-bottom:2px}.folders button{flex:0 0 auto;min-height:34px;padding:0 12px;border:1px solid #e0e5e0;border-radius:999px;background:#fff;color:#526158;font-size:11px;font-weight:800}.folders button.active{border-color:#5f9470;background:#eef6eb;color:#315c42}.manager-shell{display:grid;gap:12px}.media-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.media-grid button{padding:7px;border:1px solid #e0e5e0;border-radius:14px;background:#fff;text-align:left;overflow:hidden}.media-grid button.selected{border-color:#5f9470;box-shadow:0 0 0 3px rgba(95,148,112,.12)}.media-grid img,.media-grid video,.file-preview,.detail-preview img,.detail-preview video{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;background:#17211b}.file-preview{display:grid;place-items:center;color:#d9ff62;font-weight:900}.media-grid span,.media-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.media-grid span{margin-top:6px;font-size:10px;font-weight:750}.media-grid small{margin-top:2px;color:#849087;font-size:8px}.detail-card{display:grid;gap:12px;padding:14px;border:1px solid #e0e5e0;border-radius:18px;background:#fff}.detail-meta{display:grid;gap:10px}.detail-meta label{display:grid;gap:6px;color:#526158;font-size:11px;font-weight:750}.detail-meta small{color:#7b867e;font-size:10px;line-height:1.4}.variants{display:grid;gap:6px;padding:10px 12px;border:1px solid #e0e5e0;border-radius:14px;background:#f8faf7}.variants strong{font-size:11px;color:#315c42}.variants div{display:flex;justify-content:space-between;gap:10px}.variants span{font-size:11px;font-weight:800}.detail-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.detail-actions button{min-height:42px;padding:0 12px;border:0;border-radius:13px;background:#edf2e9;color:#315c42;font-size:11px;font-weight:850}.detail-actions .primary{background:#17211b;color:#fff}.detail-actions .danger{background:#fff0ed;color:#a33b2e}.empty{padding:20px;color:#7d8981;font-size:12px;text-align:center}
  @media(min-width:900px){.manager-shell{grid-template-columns:minmax(0,1fr) 320px}.media-grid{grid-template-columns:repeat(3,1fr)}}
</style>
