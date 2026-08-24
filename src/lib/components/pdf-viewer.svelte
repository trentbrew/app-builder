<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'

  let { path }: { path: string } = $props()

  let url = $state('')
  let error = $state('')
  let loading = $state(true)

  $effect(() => {
    const filePath = path
    let revoked = false
    let revoke = () => {}
    loading = true
    error = ''
    url = ''

    void createSandboxObjectUrl(filePath)
      .then((media) => {
        if (revoked) {
          media.revoke()
          return
        }
        revoke = media.revoke
        url = media.url
        loading = false
      })
      .catch((caught) => {
        error = caught instanceof Error ? caught.message : 'Could not load PDF'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="pdf-viewer">
  {#if loading}
    <p class="pdf-viewer__status">Loading PDF…</p>
  {:else if error}
    <p class="pdf-viewer__status">{error}</p>
  {:else}
    <iframe class="pdf-viewer__frame" title="PDF preview" src={url}></iframe>
  {/if}
</div>

<style>
  .pdf-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    background: var(--color-muted);
  }

  .pdf-viewer__frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: white;
  }

  .pdf-viewer__status {
    margin: auto;
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
