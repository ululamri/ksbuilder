<script lang="ts">import PublicSite from '$lib/components/PublicSite.svelte'; let { data } = $props();</script>
<PublicSite project={data.project} page={data.page} />
