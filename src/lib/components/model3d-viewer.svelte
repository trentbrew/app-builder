<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'
  import { ensureModelViewer } from '$lib/modelViewer'
  import { isGltfPath } from '$lib/fileTypes'
  import { onMount } from 'svelte'

  let {
    path,
    content = '',
  }: {
    path: string
    content?: string
  } = $props()

  let url = $state('')
  let error = $state('')
  let loading = $state(true)
  let viewerReady = $state(false)

  onMount(() => {
    void ensureModelViewer()
      .then(() => {
        viewerReady = true
      })
      .catch((caught) => {
        error = caught instanceof Error ? caught.message : 'Could not load 3D viewer'
        loading = false
      })
  })

  $effect(() => {
    const filePath = path
    const text = content
    let revoked = false
    let revoke = () => {}

    loading = true
    error = ''
    url = ''

    if (isGltfPath(filePath)) {
      const blob = new Blob([text], { type: 'model/gltf+json' })
      const blobUrl = URL.createObjectURL(blob)
      url = blobUrl
      loading = false
      revoke = () => URL.revokeObjectURL(blobUrl)
      return () => {
        revoked = true
        revoke()
      }
    }

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
        error = caught instanceof Error ? caught.message : 'Could not load 3D model'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="model3d-viewer">
  {#if loading}
    <p class="model3d-viewer__status">Loading 3D model…</p>
  {:else if error}
    <p class="model3d-viewer__status">{error}</p>
  {:else if viewerReady && url}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <model-viewer
      class="model3d-viewer__canvas"
      src={url}
      camera-controls
      auto-rotate
      shadow-intensity="1"
      exposure="1"
      interaction-prompt="none"
    ></model-viewer>
  {/if}
</div>

<style>
  .model3d-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    background: radial-gradient(circle at center, color-mix(in oklch, var(--color-muted) 35%, transparent), var(--color-background));
  }

  .model3d-viewer__canvas {
    width: 100%;
    height: 100%;
    min-height: 0;
    background: transparent;
  }

  .model3d-viewer__status {
    margin: auto;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
