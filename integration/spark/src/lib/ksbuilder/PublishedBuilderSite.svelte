<script lang="ts">
  import type { BuilderBlock, BuilderPage, BuilderProject } from './published-builder';
  import { pageHref, publishedPages } from './published-builder';

  export let project: BuilderProject;
  export let page: BuilderPage;

  const radius = { none: '0px', medium: '18px', large: '30px' };
  const padding = { compact: '16px', normal: '24px 20px', roomy: '38px 24px' };

  function blockStyle(block: BuilderBlock) {
    return [
      `background:${block.style?.background ?? '#ffffff'}`,
      `color:${block.style?.foreground ?? '#17211b'}`,
      `text-align:${block.style?.align ?? 'left'}`,
      `border-radius:${radius[block.style?.radius ?? 'large']}`,
      `padding:${padding[block.style?.padding ?? 'normal']}`
    ].join(';');
  }

  function splitLines(value = '') {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }

  function stats(value = '') {
    return splitLines(value).map((line) => {
      const [label, number] = line.split('|').map((item) => item?.trim() ?? '');
      return { label, number };
    });
  }
</script>

<svelte:head>
  <title>{page.seo?.title || page.title}</title>
  <meta name="description" content={page.seo?.description || project.metadata?.summary || project.name} />
  {#if page.seo?.noIndex}<meta name="robots" content="noindex,nofollow" />{/if}
</svelte:head>

<div
  class="builder-site"
  style={`--ks-primary:${project.theme?.primary ?? '#17211b'};--ks-accent:${project.theme?.accent ?? '#d9ff62'};--ks-surface:${project.theme?.surface ?? '#f7f8f2'};--ks-text:${project.theme?.text ?? '#17211b'}`}
>
  <header class="builder-header">
    <a class="brand" href={`/site/${project.id}`}>{project.site?.headerTitle || project.name}</a>
    <nav>
      {#each publishedPages(project) as item}
        <a class:active={item.id === page.id} href={pageHref(project.id, item, project)}>{item.title}</a>
      {/each}
    </nav>
    {#if project.site?.headerCtaLabel && project.site?.headerCtaHref}
      <a class="header-cta" href={project.site.headerCtaHref}>{project.site.headerCtaLabel}</a>
    {/if}
  </header>

  <main>
    {#each page.blocks as block}
      <section class:shadow={block.style?.shadow} class="builder-block {block.type}" style={blockStyle(block)}>
        {#if block.type === 'hero'}
          <span>{block.data.eyebrow}</span>
          <h1>{block.data.title}</h1>
          <p>{block.data.body}</p>
          {#if block.data.button}<a class="action" href={block.data.href || '#'}>{block.data.button}</a>{/if}
        {:else if block.type === 'text' || block.type === 'feature' || block.type === 'cta'}
          {#if block.data.kicker}<span>{block.data.kicker}</span>{/if}
          <h2>{block.data.title}</h2>
          <p>{block.data.body}</p>
          {#if block.data.button}<a class="action" href={block.data.href || '#'}>{block.data.button}</a>{/if}
        {:else if block.type === 'richtext'}
          {#each splitLines(block.data.content) as line}
            {#if line.startsWith('## ')}<h2>{line.slice(3)}</h2>
            {:else if line.startsWith('### ')}<h3>{line.slice(4)}</h3>
            {:else if line.startsWith('- ')}<p class="bullet">{line.slice(2)}</p>
            {:else}<p>{line}</p>{/if}
          {/each}
        {:else if block.type === 'image'}
          {#if block.data.src}<img src={block.data.src} srcset={block.data.srcset || undefined} sizes={block.data.sizes || undefined} alt={block.data.alt || ''} />{/if}
          {#if block.data.caption}<small>{block.data.caption}</small>{/if}
        {:else if block.type === 'video'}
          {#if block.data.embedUrl}<iframe src={block.data.embedUrl} title={block.data.title || 'Video'} loading="lazy" allowfullscreen></iframe>
          {:else if block.data.src}<video src={block.data.src} poster={block.data.poster} controls playsinline></video>{/if}
        {:else if block.type === 'gallery'}
          <div class="gallery">{#each splitLines(block.data.images) as image}<img src={image} alt={block.data.alt || ''} />{/each}</div>
        {:else if block.type === 'stats'}
          <div class="stats">{#each stats(block.data.items) as item}<div><strong>{item.number}</strong><span>{item.label}</span></div>{/each}</div>
        {:else if block.type === 'quote'}
          <blockquote>{block.data.quote}</blockquote>
          <p><strong>{block.data.author}</strong> {block.data.role}</p>
        {:else if block.type === 'divider'}
          <hr />
        {:else if block.type === 'spacer'}
          <div style={`height:${block.data.size || '32px'}`}></div>
        {/if}
      </section>
    {/each}
  </main>

  <footer>{project.site?.footerText || project.name}</footer>
</div>

<style>
  .builder-site { min-height: 100svh; background: var(--ks-surface); color: var(--ks-text); }
  .builder-header { position: sticky; top: 0; z-index: 5; display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 12px 16px; background: color-mix(in srgb, var(--ks-surface) 92%, white); border-bottom: 1px solid rgba(23, 33, 27, .1); }
  .brand { color: var(--ks-text); font-weight: 900; text-decoration: none; }
  nav { display: none; gap: 8px; align-items: center; }
  nav a, .header-cta, .action { color: var(--ks-text); font-weight: 800; text-decoration: none; }
  nav a.active { text-decoration: underline; text-decoration-thickness: 3px; }
  .header-cta, .action { display: inline-flex; width: fit-content; border-radius: 999px; padding: 10px 14px; background: var(--ks-accent); }
  main { display: grid; gap: 14px; width: min(100%, 1080px); margin: 0 auto; padding: 18px 14px 48px; }
  .builder-block { overflow: hidden; }
  .builder-block.shadow { box-shadow: 0 16px 45px rgba(23, 33, 27, .11); }
  h1, h2, h3, p { margin: 0; }
  h1 { max-width: 12ch; font-size: clamp(42px, 13vw, 88px); line-height: .92; }
  h2 { font-size: clamp(28px, 7vw, 48px); line-height: 1; }
  p { max-width: 68ch; line-height: 1.65; }
  span, small { opacity: .78; font-weight: 800; }
  img, video, iframe { display: block; width: 100%; border: 0; border-radius: 18px; }
  iframe, video { aspect-ratio: 16 / 9; }
  .gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .stats strong { display: block; font-size: 32px; }
  .bullet::before { content: "• "; font-weight: 900; }
  footer { padding: 24px 16px; text-align: center; opacity: .72; }
  @media (min-width: 760px) {
    .builder-header { grid-template-columns: auto 1fr auto; padding-inline: 28px; }
    nav { display: flex; justify-content: center; }
    main { gap: 22px; padding: 32px 24px 72px; }
    .gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>

