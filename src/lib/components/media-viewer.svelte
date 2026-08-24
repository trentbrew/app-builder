<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'

  let {
    path,
    kind,
  }: {
    path: string
    kind: 'video' | 'audio'
  } = $props()

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
        error = caught instanceof Error ? caught.message : 'Could not load media'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="media-viewer" class:media-viewer--audio={kind === 'audio'}>
  {#if loading}
    <p class="media-viewer__status">Loading {kind}…</p>
  {:else if error}
    <p class="media-viewer__status">{error}</p>
  {:else if kind === 'video'}
    <video class="media-viewer__video" src={url} controls playsinline>
      <track kind="captions" />
    </video>
  {:else}
    <audio class="media-viewer__audio" src={url} controls></audio>
  {/if}
</div>

<style>
  .media-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    align-items: center;
    justify-content: center;
    background: var(--color-background);
    padding: 1.5rem;
  }

  .media-viewer__video {
    max-width: 100%;
    max-height: 100%;
    border-radius: calc(var(--radius) - 2px);
    background: #000;
  }

  .media-viewer__audio {
    width: min(36rem, 100%);
  }

  .media-viewer__status {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
