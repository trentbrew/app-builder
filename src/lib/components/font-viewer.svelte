<script lang="ts">
  import { createSandboxObjectUrl } from '$lib/sandboxMedia'
  import { extensionOf } from '$lib/fileTypes'
  import { basename } from '$lib/fileIcons'

  let { path }: { path: string } = $props()

  let fontFamily = $state('')
  let error = $state('')
  let loading = $state(true)
  let sampleSize = $state(32)

  const name = $derived(basename(path))
  const pangram = 'The quick brown fox jumps over the lazy dog.'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~'

  function formatForExt(ext: string) {
    switch (ext) {
      case 'woff':
        return 'woff'
      case 'woff2':
        return 'woff2'
      case 'otf':
        return 'opentype'
      case 'eot':
        return 'embedded-opentype'
      default:
        return 'truetype'
    }
  }

  $effect(() => {
    const filePath = path
    let revoked = false
    let revoke = () => {}
    let styleEl: HTMLStyleElement | null = null

    loading = true
    error = ''
    fontFamily = ''

    void createSandboxObjectUrl(filePath)
      .then((media) => {
        if (revoked) {
          media.revoke()
          return
        }

        const family = `font-preview-${Math.random().toString(36).slice(2, 11)}`
        const ext = extensionOf(filePath)
        styleEl = document.createElement('style')
        styleEl.textContent = `@font-face {
  font-family: '${family}';
  src: url('${media.url}') format('${formatForExt(ext)}');
  font-display: block;
}`
        document.head.appendChild(styleEl)

        revoke = () => {
          media.revoke()
          styleEl?.remove()
        }
        fontFamily = family
        loading = false
      })
      .catch((caught) => {
        error = caught instanceof Error ? caught.message : 'Could not load font'
        loading = false
      })

    return () => {
      revoked = true
      revoke()
    }
  })
</script>

<div class="font-viewer">
  {#if loading}
    <p class="font-viewer__status">Loading font…</p>
  {:else if error}
    <p class="font-viewer__status">{error}</p>
  {:else}
    <div class="font-viewer__panel">
      <header class="font-viewer__header">
        <div>
          <p class="font-viewer__name">{name}</p>
          <p class="font-viewer__hint">Font preview</p>
        </div>
        <label class="font-viewer__size">
          <span>Size</span>
          <input type="range" min="12" max="96" bind:value={sampleSize} />
          <span class="font-viewer__size-value">{sampleSize}px</span>
        </label>
      </header>

      <div class="font-viewer__samples" style:font-family={fontFamily}>
        <p class="font-viewer__sample font-viewer__sample--hero" style:font-size="{sampleSize}px">
          {pangram}
        </p>
        <p class="font-viewer__sample" style:font-size="{Math.max(14, sampleSize * 0.55)}px">{uppercase}</p>
        <p class="font-viewer__sample" style:font-size="{Math.max(14, sampleSize * 0.55)}px">{lowercase}</p>
        <p class="font-viewer__sample" style:font-size="{Math.max(14, sampleSize * 0.55)}px">{numbers}</p>
        <p class="font-viewer__sample" style:font-size="{Math.max(14, sampleSize * 0.55)}px">{symbols}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .font-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 1.5rem;
    background: var(--color-background);
  }

  .font-viewer__panel {
    width: min(48rem, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .font-viewer__header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  .font-viewer__name {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-foreground);
  }

  .font-viewer__hint {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }

  .font-viewer__size {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }

  .font-viewer__size input {
    width: 8rem;
  }

  .font-viewer__size-value {
    min-width: 3rem;
    font-family: var(--font-mono);
    color: var(--color-foreground);
  }

  .font-viewer__samples {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .font-viewer__sample {
    margin: 0;
    line-height: 1.35;
    color: var(--color-foreground);
    word-break: break-word;
  }

  .font-viewer__sample--hero {
    line-height: 1.2;
  }

  .font-viewer__status {
    margin: auto;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
  }
</style>
