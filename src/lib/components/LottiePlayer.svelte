<script lang="ts">
  import { onMount } from 'svelte';
  import { safeMedia } from '$lib/builder/security';

  let { src, loop = true, autoplay = true, speed = 1, title = 'Animasi' }: { src: string; loop?: boolean; autoplay?: boolean; speed?: number; title?: string } = $props();
  let container = $state<HTMLDivElement>();
  let failed = $state(false);

  onMount(() => {
    const url = safeMedia(src);
    if (!url || !container) { failed = true; return; }
    const target = container;
    let destroyed = false;
    let animation: { destroy(): void; setSpeed(value: number): void } | undefined;
    void import('lottie-web/build/player/lottie_light.js').then(({ default: lottie }) => {
      if (destroyed) return;
      animation = lottie.loadAnimation({ container: target, renderer: 'svg', loop, autoplay, path: url, rendererSettings: { progressiveLoad: true, preserveAspectRatio: 'xMidYMid meet' } });
      animation.setSpeed(Math.max(0.25, Math.min(3, speed)));
    }).catch(() => { failed = true; });
    return () => { destroyed = true; animation?.destroy(); };
  });
</script>

{#if failed}<div class="lottie-error">Animasi tidak dapat dimuat.</div>{:else}<div bind:this={container} class="lottie" role="img" aria-label={title}></div>{/if}

<style>.lottie{width:100%;min-height:180px;aspect-ratio:16/10}.lottie-error{display:grid;min-height:180px;place-items:center;border:1px dashed currentColor;border-radius:16px;opacity:.6}</style>
