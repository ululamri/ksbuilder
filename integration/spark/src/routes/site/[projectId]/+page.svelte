<script lang="ts">
  import PublishedBuilderSite from '$lib/ksbuilder/PublishedBuilderSite.svelte';
  export let data;
</script>

<PublishedBuilderSite project={data.project} page={data.page} />

