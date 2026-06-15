<script lang="ts">
  import type { AssistantReport } from '$lib/builder/design-assistant';
  import type { ModulePreset } from '$lib/builder/modules';
  import Icon from './Icon.svelte';

  let { report, brief, modules, onbriefchange, onrun, onopenblocks, onopenmodules, onopensettings, onpreview, oninsertmodule, onclose }: {
    report: AssistantReport;
    brief: string;
    modules: ModulePreset[];
    onbriefchange: (value: string) => void;
    onrun: () => void;
    onopenblocks: () => void;
    onopenmodules: () => void;
    onopensettings: () => void;
    onpreview: () => void;
    oninsertmodule: (moduleId: string) => void;
    onclose: () => void;
  } = $props();

  function lookupModule(moduleId: string) {
    return modules.find((module) => module.id === moduleId);
  }
</script>

<header>
  <div>
    <span>AI DESIGN</span>
    <h2>Karyra Spark Assistant</h2>
  </div>
  <button class="round-button" onclick={onclose} aria-label="Tutup"><Icon name="close" /></button>
</header>
<p>Asisten ini menilai halaman dari sudut UI/UX mobile, lalu memberi saran yang bisa langsung kamu eksekusi.</p>

<label class="brief">
  <span>Brief desain</span>
  <textarea rows="3" value={brief} placeholder="Contoh: buat lebih premium, ringkas, dan cepat dipakai di Android" oninput={(event) => onbriefchange((event.currentTarget as HTMLTextAreaElement).value)}></textarea>
</label>

<div class="score-card">
  <div>
    <small>Skor mobile</small>
    <strong>{report.score}/100</strong>
  </div>
  <p>{report.summary}</p>
</div>

<div class="insight-grid">
  <section>
    <span>Kuat</span>
    {#if report.strengths.length}
      {#each report.strengths as item}
        <article><strong>{item.title}</strong><small>{item.detail}</small></article>
      {/each}
    {:else}
      <article><strong>Belum ada sinyal kuat</strong><small>Tambah hero, CTA, dan media yang relevan.</small></article>
    {/if}
  </section>
  <section>
    <span>Perlu diperbaiki</span>
    {#if report.warnings.length}
      {#each report.warnings as item}
        <article><strong>{item.title}</strong><small>{item.detail}</small></article>
      {/each}
    {:else}
      <article><strong>Struktur aman</strong><small>Halaman cukup nyaman untuk layar kecil.</small></article>
    {/if}
  </section>
</div>

<div class="suggestions">
  <span>Langkah berikutnya</span>
  {#each report.suggestions as suggestion}
    <button onclick={() => {
      if (suggestion.action === 'open-blocks') onopenblocks();
      else if (suggestion.action === 'open-modules') onopenmodules();
      else if (suggestion.action === 'open-settings') onopensettings();
      else if (suggestion.action === 'preview') onpreview();
      else onopenblocks();
    }}>
      <strong>{suggestion.title}</strong>
      <small>{suggestion.detail}</small>
    </button>
  {/each}
</div>

{#if report.recommendedModules.length}
  <div class="recommended">
    <span>Modul rekomendasi</span>
    <div class="recommended-grid">
      {#each report.recommendedModules as moduleId}
        {#if lookupModule(moduleId)}
          {@const module = lookupModule(moduleId)!}
          <button onclick={() => oninsertmodule(module.id)}>
            <i>{module.icon}</i>
            <strong>{module.label}</strong>
            <small>{module.description}</small>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<div class="assistant-actions">
  <button class="ghost" onclick={onopenmodules}>Buka modul</button>
  <button class="ghost" onclick={onopenblocks}>Buka blok</button>
  <button class="ghost" onclick={onpreview}>Preview</button>
  <button class="primary" onclick={onrun}><Icon name="check" size={16} /> Analisis ulang</button>
</div>

<style>
  .brief{display:grid;gap:7px}.brief span,.score-card small,.insight-grid>section>span,.suggestions>span,.recommended>span{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#6f7e74}.brief textarea{width:100%;padding:12px 13px;border:1px solid #dce1dc;border-radius:14px;background:#fafbf9;color:#17211b;font:inherit;font-size:13px;resize:vertical}.score-card{display:grid;grid-template-columns:92px 1fr;gap:12px;align-items:center;margin-top:14px;padding:14px;border-radius:18px;background:linear-gradient(145deg,#17211b,#314d39);color:#fff}.score-card strong{display:block;font-size:30px;letter-spacing:-.04em}.score-card p{margin:0;font-size:12px;line-height:1.45;opacity:.82}.insight-grid{display:grid;gap:12px;margin-top:14px}.insight-grid section{display:grid;gap:8px}.insight-grid article{padding:12px;border:1px solid #e4e7e3;border-radius:16px;background:#fafbf9}.insight-grid strong{display:block;font-size:13px}.insight-grid small{display:block;margin-top:4px;color:#7b867e;font-size:11px;line-height:1.35}.suggestions{display:grid;gap:10px;margin-top:16px}.suggestions button{display:grid;gap:4px;padding:12px;border:1px solid #e4e7e3;border-radius:16px;background:#fff;text-align:left}.suggestions strong{font-size:13px}.suggestions small{color:#7b867e;font-size:11px;line-height:1.35}.recommended{display:grid;gap:10px;margin-top:16px}.recommended-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.recommended-grid button{display:grid;gap:5px;padding:12px;border:1px solid #dce7dd;border-radius:16px;background:#f4faf2;text-align:left}.recommended-grid i{display:grid;width:28px;height:28px;place-items:center;border-radius:10px;background:#17211b;color:#d9ff62;font-style:normal;font-size:11px;font-weight:900}.recommended-grid strong{font-size:13px}.recommended-grid small{color:#7b867e;font-size:10px;line-height:1.35}.assistant-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #ecefe9}.assistant-actions button{min-height:46px;border:0;border-radius:13px;font-size:12px;font-weight:850}.assistant-actions .ghost{background:#edf2e9;color:#315c42}.assistant-actions .primary{display:flex;align-items:center;justify-content:center;gap:6px;background:#17211b;color:#fff}
</style>
