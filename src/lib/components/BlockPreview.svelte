<script lang="ts">
  import type { BuilderBlock } from '$lib/builder/types';
  import { onMount } from 'svelte';
  import { safeImage, safeLink, safeMedia, safeVideoEmbed } from '$lib/builder/security';
  import LottiePlayer from './LottiePlayer.svelte';

  let { block, projectId = '', pageId = '', publicMode = false }: { block: BuilderBlock; projectId?: string; pageId?: string; publicMode?: boolean } = $props();
  let radius = $derived(block.style.radius === 'none' ? '0' : block.style.radius === 'medium' ? '18px' : '30px');
  let padding = $derived(block.style.padding === 'compact' ? '16px' : block.style.padding === 'roomy' ? '38px 24px' : '24px 20px');
  let richLines = $derived((block.data.content ?? '').split('\n').filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1].trim())));
  let formFields = $derived((block.data.fields ?? '').split('\n').map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts.length >= 3).slice(0, 20));
  let container = $state<HTMLElement>();
  let visible = $state(true);
  let duration = $derived(block.style.animationDuration === 'fast' ? 350 : block.style.animationDuration === 'slow' ? 900 : 600);

  onMount(() => {
    if (!container || block.style.animation === 'none' || matchMedia('(prefers-reduced-motion: reduce)').matches) { visible = true; return; }
    visible = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (entry.isIntersecting && block.style.animationOnce !== false) observer.disconnect();
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<div bind:this={container} class="animation-shell" class:is-visible={visible} data-animation={block.style.animation ?? 'none'} style={`--animation-duration:${duration}ms;--animation-delay:${block.style.animationDelay ?? 0}ms`}>
{#if block.type === 'spacer'}
  <div class="spacer" style:height={`${Math.max(8, Math.min(120, Number(block.data.size) || 32))}px`}></div>
{:else if block.type === 'divider'}
  <div class="divider"><i style:width={`${Math.max(20, Math.min(100, Number(block.data.width) || 100))}%`}></i></div>
{:else}
  <section class:hero={block.type === 'hero'} class:feature={block.type === 'feature'} class:cta={block.type === 'cta'} class:with-shadow={block.style.shadow} class="content-block" style:background={block.style.background} style:color={block.style.foreground} style:text-align={block.style.align} style:border-radius={radius} style:padding>
    {#if block.type === 'hero'}
      <span class="eyebrow">{block.data.eyebrow}</span>
      <h1>{block.data.title}</h1>
      <p>{block.data.body}</p>
      <a class="primary-action" href={safeLink(block.data.href)}>{block.data.button}</a>
    {:else if block.type === 'text'}
      <h2>{block.data.title}</h2><p>{block.data.body}</p>
    {:else if block.type === 'richtext'}
      <div class="richtext">{#each richLines as line}{#if line.startsWith('## ')}<h2>{line.slice(3)}</h2>{:else if line.startsWith('### ')}<h3>{line.slice(4)}</h3>{:else if line.startsWith('- ')}<div class="bullet"><i></i><span>{line.slice(2)}</span></div>{:else if line.trim()}<p>{line}</p>{/if}{/each}</div>
    {:else if block.type === 'feature'}
      <span class="feature-number">{block.data.kicker}</span><h2>{block.data.title}</h2><p>{block.data.body}</p>
    {:else if block.type === 'cta'}
      <h2>{block.data.title}</h2><p>{block.data.body}</p><a class="primary-action" href={safeLink(block.data.href)}>{block.data.button}</a>
    {:else if block.type === 'image'}
      {#if safeImage(block.data.src)}<img src={safeImage(block.data.src)} alt={block.data.alt} />{:else}<div class="image-placeholder">URL gambar harus menggunakan HTTPS</div>{/if}
      <small>{block.data.caption}</small>
    {:else if block.type === 'video'}
      {#if safeVideoEmbed(block.data.src)}<div class="video-frame"><iframe src={safeVideoEmbed(block.data.src)} title={block.data.title || 'Video'} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      {:else if safeMedia(block.data.src)}<video src={safeMedia(block.data.src)} poster={safeImage(block.data.poster)} autoplay={block.data.autoplay === 'true'} loop={block.data.loop === 'true'} muted={block.data.muted !== 'false'} controls={block.data.controls !== 'false'} playsinline={block.data.playsinline !== 'false'} preload="metadata"></video>
      {:else}<div class="image-placeholder">Pilih MP4/WebM atau URL YouTube/Vimeo HTTPS</div>{/if}<small>{block.data.caption}</small>
    {:else if block.type === 'lottie'}
      <LottiePlayer src={block.data.src} title={block.data.title} loop={block.data.loop !== 'false'} autoplay={block.data.autoplay !== 'false'} speed={Number(block.data.speed) || 1} />
    {:else if block.type === 'gallery'}
      <div class="gallery">{#each [block.data.image1, block.data.image2, block.data.image3] as src}{#if safeImage(src)}<img src={safeImage(src)} alt={block.data.alt} />{:else}<div class="image-placeholder">HTTPS</div>{/if}{/each}</div>
    {:else if block.type === 'stats'}
      <div class="stats">{#each [1, 2, 3] as item}<div><strong>{block.data[`value${item}`]}</strong><span>{block.data[`label${item}`]}</span></div>{/each}</div>
    {:else if block.type === 'quote'}
      <blockquote>“{block.data.quote}”</blockquote><div class="quote-author"><strong>{block.data.author}</strong><span>{block.data.role}</span></div>
    {:else if block.type === 'form'}
      <h2>{block.data.title}</h2><p>{block.data.body}</p><form class="site-form" method="POST" action="/api/public/forms"><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="pageId" value={pageId} /><input type="hidden" name="formId" value={block.id} /><input class="honeypot" name="website" tabindex="-1" autocomplete="off" />{#each formFields as field}<label><span>{field[0]}</span>{#if field[2] === 'textarea'}<textarea name={field[1]} required={field[3] === 'required'} disabled={!publicMode}></textarea>{:else}<input type={['text','email','tel','number'].includes(field[2]) ? field[2] : 'text'} name={field[1]} required={field[3] === 'required'} disabled={!publicMode} />{/if}</label>{/each}<button type="submit" disabled={!publicMode}>{block.data.button}</button></form>
    {/if}
  </section>
{/if}
</div>

<style>
  .animation-shell{transition:opacity var(--animation-duration) ease var(--animation-delay),transform var(--animation-duration) cubic-bezier(.2,.7,.2,1) var(--animation-delay)}.animation-shell[data-animation='fade']:not(.is-visible){opacity:0}.animation-shell[data-animation='slide-up']:not(.is-visible){opacity:0;transform:translateY(28px)}.animation-shell[data-animation='slide-left']:not(.is-visible){opacity:0;transform:translateX(30px)}.animation-shell[data-animation='zoom']:not(.is-visible){opacity:0;transform:scale(.94)}.content-block{overflow:hidden}.with-shadow{box-shadow:0 18px 35px rgba(25,40,29,.13)}.hero{background:linear-gradient(145deg,var(--theme-primary,#17211b),color-mix(in srgb,var(--theme-primary,#17211b) 70%,#4c8b62))!important;color:#fff!important}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.16em;color:#b8dfbe}.content-block h1{max-width:480px;margin:10px 0 0;font-size:42px;line-height:.98;letter-spacing:-.055em}.content-block h2{margin:4px 0 0;font-size:25px;line-height:1.08;letter-spacing:-.035em}.content-block p{margin:13px 0 0;line-height:1.58;opacity:.74}.primary-action{display:inline-flex;margin-top:22px;padding:13px 17px;border-radius:var(--button-radius,999px);background:var(--theme-accent,#d9ff62);color:var(--theme-primary,#17211b);font-size:13px;font-weight:800;text-decoration:none}.feature{border:1px solid rgba(23,33,27,.08)}.feature-number{display:grid;width:38px;height:38px;place-items:center;border-radius:13px;background:#ecf3e8;color:#397044;font-weight:800}.cta{background:color-mix(in srgb,var(--theme-primary,#17211b) 10%,white)!important}.content-block img,.content-block video{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#0b0f0c}.content-block small{display:block;margin-top:10px;opacity:.65}.video-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#000}.video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.image-placeholder{display:grid;min-height:120px;place-items:center;padding:20px;border:1px dashed currentColor;border-radius:18px;opacity:.6}.gallery{display:grid;grid-template-columns:1.15fr .85fr;grid-template-rows:1fr 1fr;gap:7px}.gallery img{height:100%;aspect-ratio:auto}.gallery img:first-child{grid-row:1/3;min-height:240px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stats div{display:grid;gap:4px;padding:16px 6px;border-radius:16px;background:rgba(23,33,27,.05);text-align:center}.stats strong{font-size:26px;letter-spacing:-.05em}.stats span{font-size:10px;opacity:.65}blockquote{margin:0;font-size:25px;font-weight:700;line-height:1.2;letter-spacing:-.035em}.quote-author{display:grid;gap:2px;margin-top:18px;font-size:12px}.quote-author span{opacity:.6}.richtext h2,.richtext h3{margin:20px 0 8px}.richtext p{white-space:pre-wrap}.bullet{display:flex;gap:9px;margin-top:8px;line-height:1.5}.bullet i{width:6px;height:6px;margin-top:8px;border-radius:50%;background:var(--theme-primary,#17211b)}.site-form{display:grid;gap:12px;margin-top:20px;text-align:left}.site-form label{display:grid;gap:6px;font-size:11px;font-weight:750}.site-form input,.site-form textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid rgba(23,33,27,.18);border-radius:12px;background:#fff;font:inherit}.site-form textarea{min-height:100px;resize:vertical}.site-form button{min-height:46px;border:0;border-radius:var(--button-radius,999px);background:var(--theme-primary,#17211b);color:#fff;font-weight:800}.honeypot{position:absolute!important;left:-9999px!important}.divider{display:grid;place-items:center;padding:14px 0}.divider i{height:1px;background:#cbd2cc}.spacer{min-height:8px}@media(prefers-reduced-motion:reduce){.animation-shell{transition:none!important;transform:none!important;opacity:1!important}}
</style>
