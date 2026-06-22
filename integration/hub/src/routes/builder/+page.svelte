<script lang="ts">
  import { builderProjectHref, builderProjectSummary, builderProjectTitle } from '$lib/ksbuilder/hub-catalog';
  export let data;
</script>

<svelte:head>
  <title>Builder Projects</title>
  <meta name="description" content="Published Spark Builder projects available in Hub." />
</svelte:head>

<main class="builder-hub">
  <header>
    <p>Builder</p>
    <h1>Published projects</h1>
  </header>

  <section class="grid">
    {#each data.projects as project}
      <a class="card" href={builderProjectHref(project)}>
        <span>{project.metadata?.hub?.category || 'Spark'}</span>
        <h2>{builderProjectTitle(project)}</h2>
        <p>{builderProjectSummary(project)}</p>
        <small>Revision {project.published_revision}</small>
      </a>
    {:else}
      <p class="empty">No published builder projects are listed for Hub yet.</p>
    {/each}
  </section>
</main>

<style>
  .builder-hub { min-height: 100svh; padding: 28px 16px 56px; background: #f7f8f2; color: #17211b; }
  header { width: min(100%, 1080px); margin: 0 auto 20px; }
  header p { margin: 0 0 8px; font-weight: 900; color: #4b6254; }
  h1 { margin: 0; font-size: clamp(36px, 10vw, 72px); line-height: .95; }
  .grid { width: min(100%, 1080px); margin: 0 auto; display: grid; gap: 12px; }
  .card { display: grid; gap: 10px; min-height: 180px; padding: 18px; border: 1px solid rgba(23, 33, 27, .12); border-radius: 8px; background: #ffffff; color: inherit; text-decoration: none; }
  .card span, .card small { color: #5a6b60; font-weight: 800; }
  .card h2, .card p { margin: 0; }
  .card h2 { font-size: 24px; }
  .card p { line-height: 1.55; }
  .empty { margin: 0; padding: 20px; border: 1px dashed rgba(23, 33, 27, .24); border-radius: 8px; }
  @media (min-width: 760px) {
    .builder-hub { padding-inline: 28px; }
    .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
</style>

