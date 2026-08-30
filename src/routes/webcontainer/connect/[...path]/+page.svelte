<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'

  onMount(async () => {
    const { setupConnect } = await import('@webcontainer/api/connect')
    const editorOrigin = page.url.searchParams.get('editorOrigin') ?? window.location.origin
    setupConnect({ editorOrigin })
  })
</script>

<p class="sr-only">Connecting preview…</p>
