<script lang="ts">
  import type { ModulePreset } from '$lib/builder/modules';
  import Icon from './Icon.svelte';

  let { modules, insertAtLabel = 'akhir halaman', oninsert, onclose }: { modules: ModulePreset[]; insertAtLabel?: string; oninsert: (moduleId: string) => void; onclose: () => void } = $props();
</script>

<header>
  <div>
    <span>EDITOR</span>
    <h2>Modul</h2>
  </div>
  <button class="round-button" onclick={onclose} aria-label="Tutup"><Icon name="close" /></button>
</header>
<p>Modul menggabungkan beberapa blok sekaligus. Cocok untuk menyusun halaman dari Android dengan lebih cepat.</p>
<div class="module-grid">
  {#each modules as module}
    <button onclick={() => oninsert(module.id)}>
      <span>{module.icon}</span>
      <div>
        <small>{module.category}</small>
        <strong>{module.label}</strong>
        <p>{module.description}</p>
      </div>
      <Icon name="plus" size={17} />
    </button>
  {/each}
</div>
<small class="module-hint">Modul akan disisipkan di {insertAtLabel}.</small>

<style>
  .module-grid{display:grid;gap:10px}.module-grid button{display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center;width:100%;padding:12px;border:1px solid #e4e7e3;border-radius:18px;background:#fafbf9;text-align:left}.module-grid button>span{display:grid;width:46px;height:46px;place-items:center;border-radius:14px;background:#17211b;color:#d9ff62;font-size:11px;font-weight:900}.module-grid small{display:block;color:#7b867e;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.module-grid strong{display:block;margin-top:2px;font-size:14px}.module-grid p{margin:4px 0 0;color:#7b867e;font-size:11px;line-height:1.35}.module-hint{display:block;margin-top:12px;color:#7b867e;font-size:11px}
</style>
