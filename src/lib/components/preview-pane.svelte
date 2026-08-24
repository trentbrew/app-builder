<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import PreviewPanel from '$lib/components/preview-panel.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from 'svelte-sonner'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import BugIcon from '@lucide/svelte/icons/bug'
  import { editorChrome } from '$lib/editorChrome.svelte'

  let {
    canSplit = false,
    onSplit,
  }: {
    canSplit?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
  } = $props()

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let previewUrl = $state('')
  let previewPort = $state<number | null>(null)
  let bootPhase = $state('idle')
  let backend = $state<'bun' | 'webcontainer' | 'unknown'>('unknown')

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      previewUrl = state.previewUrl
      previewPort = state.previewPort
      bootPhase = state.phase
      backend = state.backend
    })
    return unsubscribe
  })

  const statusLabel = $derived.by(() => {
    if (error) return 'Error'
    if (booting || loading) return bootPhase || 'Starting…'
    if (previewUrl) {
      if (previewPort) return `localhost:${previewPort}`
      try {
        const url = new URL(previewUrl)
        return url.host || 'Running'
      } catch {
        return 'Running'
      }
    }
    return 'Idle'
  })

  async function copyUrl() {
    if (!previewUrl) return
    try {
      await navigator.clipboard.writeText(previewUrl)
      toast.success('Copied preview URL')
    } catch {
      toast.error('Could not copy URL')
    }
  }

  function openExternal() {
    if (!previewUrl) return
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  function refreshPreview() {
    void sandboxStore.boot()
  }
</script>

<PaneChrome>
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{backend === 'bun' ? 'Bun' : 'WebContainer'}</span>
        <span class="pane-toolbar__detail" title={previewUrl || undefined}>{statusLabel}</span>
      {/snippet}

      {#snippet actions()}
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Refresh preview"
          aria-label="Refresh preview"
          onclick={refreshPreview}
        >
          <RefreshCwIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Copy preview URL"
          aria-label="Copy preview URL"
          disabled={!previewUrl}
          onclick={copyUrl}
        >
          <CopyIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Open preview in new tab"
          aria-label="Open preview in new tab"
          disabled={!previewUrl}
          onclick={openExternal}
        >
          <ExternalLinkIcon class="size-3.5" />
        </button>
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}

      {#snippet viewToggle()}
        <div class="pane-toolbar__group" role="group" aria-label="Console pane">
          <button
            type="button"
            class="pane-toolbar__btn"
            class:pane-toolbar__btn--active={editorChrome.consoleVisible}
            title={editorChrome.consoleVisible ? 'Hide console' : 'Show console'}
            aria-label={editorChrome.consoleVisible ? 'Hide console' : 'Show console'}
            aria-pressed={editorChrome.consoleVisible}
            onclick={() => editorChrome.toggleConsole()}
          >
            <BugIcon class="size-3.5" />
          </button>
        </div>
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <PreviewPanel />
  {/snippet}
</PaneChrome>
