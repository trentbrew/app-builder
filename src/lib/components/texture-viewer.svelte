<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'
  import { decodeDdsBuffer } from '$lib/texture/dds'
  import { basename } from '$lib/fileIcons'

  let { path }: { path: string } = $props()

  let error = $state('')
  let loading = $state(true)
  let width = $state(0)
  let height = $state(0)
  let format = $state('')
  let imageUrl = $state('')

  const name = $derived(basename(path))

  $effect(() => {
    const filePath = path
    let revoked = false
    let revoke = () => {}

    loading = true
    error = ''
    width = 0
    height = 0
    format = ''
    imageUrl = ''

    void createSandboxObjectUrl(filePath)
      .then(async (media) => {
        if (revoked) {
          media.revoke()
          return
        }
        revoke = media.revoke

        const response = await fetch(media.url)
        const buffer = await response.arrayBuffer()
        const decoded = decodeDdsBuffer(buffer)

        width = decoded.width
        height = decoded.height
        format = decoded.format
        imageUrl = decoded.canvas.toDataURL('image/png')
        loading = false
      })
      .catch((caught) => {
        error = caught instanceof Error ? caught.message : 'Could not decode texture'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="texture-viewer">
  {#if loading}
    <p class="texture-viewer__status">Decoding texture…</p>
  {:else if error}
    <p class="texture-viewer__status">{error}</p>
  {:else}
    <div class="texture-viewer__panel">
      <header class="texture-viewer__meta">
        <span class="texture-viewer__name">{name}</span>
        <span class="texture-viewer__detail">{width} × {height}</span>
        <span class="texture-viewer__detail">{format}</span>
      </header>
      <div class="texture-viewer__canvas-wrap">
        <img class="texture-viewer__image" src={imageUrl} alt={name} />
      </div>
    </div>
  {/if}
</div>

<style>
  .texture-viewer {
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

  .texture-viewer__panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 100%;
    max-height: 100%;
  }

  .texture-viewer__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }

  .texture-viewer__name {
    color: var(--color-foreground);
  }

  .texture-viewer__canvas-wrap {
    overflow: auto;
    max-width: 100%;
    max-height: calc(100% - 2rem);
  }

  .texture-viewer__image {
    display: block;
    max-width: 100%;
    height: auto;
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
  }

  .texture-viewer__status {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
