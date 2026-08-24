<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'
  import { basename } from '$lib/fileIcons'

  let { path }: { path: string } = $props()

  let url = $state('')
  let error = $state('')
  let loading = $state(true)
  const name = $derived(basename(path))

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
        error = caught instanceof Error ? caught.message : 'Could not load image'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="image-viewer">
  {#if loading}
    <p class="image-viewer__status">Loading image…</p>
  {:else if error}
    <p class="image-viewer__status">{error}</p>
  {:else}
    <img class="image-viewer__img" src={url} alt={name} />
  {/if}
</div>

<style>
  .image-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(45deg, var(--color-muted) 25%, transparent 25%) 0 0 / 16px 16px,
      linear-gradient(45deg, transparent 75%, var(--color-muted) 75%) 0 0 / 16px 16px,
      linear-gradient(45deg, transparent 75%, var(--color-muted) 75%) 8px 8px / 16px 16px,
      linear-gradient(45deg, var(--color-muted) 25%, transparent 25%) 8px 8px / 16px 16px,
      var(--color-background);
    padding: 1.5rem;
  }

  .image-viewer__img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
  }

  .image-viewer__status {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
