<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'back'}<path d="m15 18-6-6 6-6" />
  {:else if name === 'undo'}<path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v2" />
  {:else if name === 'redo'}<path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0-6 6v2" />
  {:else if name === 'eye'}<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12" /><circle cx="12" cy="12" r="2.5" />
  {:else if name === 'more'}<circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
  {:else if name === 'pages'}<path d="M6 3h9l3 3v15H6z" /><path d="M9 11h6M9 15h6" />
  {:else if name === 'layers'}<path d="m12 2 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  {:else if name === 'palette'}<circle cx="12" cy="12" r="9" /><circle cx="8" cy="9" r="1" /><circle cx="12" cy="7" r="1" /><circle cx="16" cy="9" r="1" /><path d="M15 16c-1 2-4 2-5 0" />
  {:else if name === 'settings'}<circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6a8 8 0 0 0-1.6 1L6.5 6 4.4 9.5l2 1.5a7 7 0 0 0 0 2l-2 1.5L6.5 18l2.3-1a8 8 0 0 0 1.6 1l.3 2.6h4L15 18a8 8 0 0 0 1.6-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 0-1z" />
  {:else if name === 'up'}<path d="m18 15-6-6-6 6" />
  {:else if name === 'down'}<path d="m6 9 6 6 6-6" />
  {:else if name === 'trash'}<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
  {:else if name === 'close'}<path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'check'}<path d="m5 12 4 4L19 6" />
  {:else}<circle cx="12" cy="12" r="9" />{/if}
</svg>
