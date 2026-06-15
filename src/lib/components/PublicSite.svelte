<script lang="ts">
  import type { BuilderPage, BuilderProject } from '$lib/builder/types';
  import BlockPreview from './BlockPreview.svelte';
  let { project, page }: { project: BuilderProject; page: BuilderPage } = $props();
  let navigation = $derived(project.site?.navigation.length ? project.site.navigation : project.pages.map((item) => ({ id: item.id, label: item.title, pageId: item.id })));
  let navigationLinks = $derived(navigation.map((item) => ({ ...item, page: project.pages.find((candidate) => candidate.id === item.pageId) })).filter((item) => item.page));
</script>

<svelte:head><title>{page.seo?.title ?? page.title}</title><meta name="description" content={page.seo?.description ?? ''} />{#if page.seo?.noIndex}<meta name="robots" content="noindex,nofollow" />{/if}</svelte:head>
<div class="public-site" style={`--theme-primary:${project.theme?.primary};--theme-accent:${project.theme?.accent};--theme-surface:${project.theme?.surface};--theme-text:${project.theme?.text};--button-radius:${project.theme?.buttonRadius === 'square' ? '4px' : project.theme?.buttonRadius === 'soft' ? '14px' : '999px'}`}>
  <header><a href={`/site/${project.id}`}><span>S</span><strong>{project.site?.headerTitle ?? project.name}</strong></a><nav>{#each navigationLinks as item}<a href={item.page?.id === (project.site?.homePageId ?? project.pages[0]?.id) ? `/site/${project.id}` : `/site/${project.id}/${item.page?.slug}`}>{item.label}</a>{/each}</nav></header>
  <main>{#each page.blocks as block}<BlockPreview {block} projectId={project.id} pageId={page.id} publicMode={true} formAction="/api/public/forms" />{/each}</main>
  <footer><strong>{project.name}</strong><span>{project.site?.footerText}</span></footer>
</div>

<style>
  :global(body){background:var(--theme-surface,#fff)}.public-site{min-height:100svh;background:var(--theme-surface,#fff);color:var(--theme-text,#17211b)}header{position:sticky;z-index:20;top:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px max(18px,calc((100vw - 1100px)/2));border-bottom:1px solid rgba(23,33,27,.1);background:color-mix(in srgb,var(--theme-surface,#fff) 90%,transparent);backdrop-filter:blur(16px)}header>a{display:flex;align-items:center;gap:9px;color:inherit;text-decoration:none}header>a span{display:grid;width:32px;height:32px;place-items:center;border-radius:10px;background:var(--theme-primary);color:var(--theme-accent);font-weight:900}nav{display:flex;gap:17px}nav a{color:inherit;font-size:12px;font-weight:700;text-decoration:none}main{display:grid;gap:16px;width:min(1100px,calc(100% - 28px));margin:0 auto;padding:24px 0 60px}footer{display:flex;justify-content:space-between;gap:20px;padding:32px max(18px,calc((100vw - 1100px)/2));background:var(--theme-primary);color:#fff}footer span{opacity:.7}@media(max-width:700px){nav{max-width:55vw;overflow:auto}nav a{white-space:nowrap}footer{display:grid}}
</style>
