<script lang="ts">
  let { assets, uploading, onupload, onselect }: {
    assets: Array<{ id: string; fileName: string; contentType: string; size: number; url: string }>;
    uploading: boolean;
    onupload: (file: File) => void;
    onselect: (asset: { url: string; fileName: string; contentType: string }) => void;
  } = $props();
</script>

<label class="upload"><strong>{uploading ? 'Mengunggah...' : 'Unggah media'}</strong><small>Gambar otomatis diperkecil · GIF 10-15 MB · MP4/WebM 50 MB · Lottie JSON 2 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,application/json,.json" disabled={uploading} onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onupload(file); event.currentTarget.value = ''; }} /></label>
<div class="media-grid">{#each assets as asset}<button onclick={() => onselect(asset)}>{#if asset.contentType.startsWith('video/')}<video src={asset.url} muted preload="metadata"></video>{:else if asset.contentType === 'application/json'}<div class="file-preview">LOT</div>{:else}<img src={asset.url} alt={asset.fileName} />{/if}<span>{asset.fileName}</span><small>{asset.contentType.split('/')[1].toUpperCase()} · {Math.ceil(asset.size / 1024)} KB</small></button>{/each}</div>
{#if assets.length === 0}<p class="empty">Belum ada media. Unggah gambar pertama untuk memulai.</p>{/if}

<style>
  .upload{display:grid;gap:3px;margin:16px 0;padding:18px;border:1px dashed #8ea598;border-radius:17px;background:#f3f7f1;color:#315c42;text-align:center;cursor:pointer}.upload small{font-size:10px;opacity:.7}.upload input{display:none}.media-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.media-grid button{padding:7px;border:1px solid #e0e5e0;border-radius:14px;background:#fff;text-align:left;overflow:hidden}.media-grid img,.media-grid video,.file-preview{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;background:#17211b}.file-preview{display:grid;place-items:center;color:#d9ff62;font-weight:900}.media-grid span,.media-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.media-grid span{margin-top:6px;font-size:10px;font-weight:750}.media-grid small{margin-top:2px;color:#849087;font-size:8px}.empty{padding:20px;color:#7d8981;font-size:12px;text-align:center}
</style>
