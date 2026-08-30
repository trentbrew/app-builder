<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import PreviewPanel from '$lib/components/preview-panel.svelte'
  import ExpoQrPopover from '$lib/components/expo-qr-popover.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { previewMobile } from '$lib/previewMobile.svelte'
  import { toast } from '$lib/notify'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import BugIcon from '@lucide/svelte/icons/bug'
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone'
  import { editorChrome } from '$lib/editorChrome.svelte'

  let {
    canSplit = false,
    maximized = false,
    onSplit,
    onToggleMaximize,
  }: {
    canSplit?: boolean
    maximized?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
    onToggleMaximize?: () => void
  } = $props()

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let previewUrl = $state('')
  let previewPort = $state<number | null>(null)
  let bootPhase = $state('idle')
  let backend = $state<'bun' | 'webcontainer' | 'unknown'>('unknown')
  let templateId = $state<string | null>(null)
  let expoGoUrl = $state('')
  let projectId = $state<string | null>(null)

  let autoMobileProjectId = $state<string | null>(null)

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      previewUrl = state.previewUrl
      previewPort = state.previewPort
      bootPhase = state.phase
      backend = state.backend
      templateId = state.templateId
      expoGoUrl = state.expoGoUrl
      projectId = state.projectId
    })
    return unsubscribe
  })

  const isExpo = $derived(templateId === 'expo')

  $effect(() => {
    if (!isExpo) {
      previewMobile.reset()
      autoMobileProjectId = null
      return
    }
    if (!previewUrl || !projectId || autoMobileProjectId === projectId) return
    autoMobileProjectId = projectId
    previewMobile.setEnabled(true)
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

<PaneChrome paneKind="preview">
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{backend === 'bun' ? 'Bun' : 'WebContainer'}</span>
        <span class="pane-toolbar__detail" title={previewUrl || undefined}>{statusLabel}</span>
        {#if previewUrl && !booting && !loading && !error}
          <span class="pane-toolbar__detail pane-toolbar__badge">guest · read-only SDK</span>
        {/if}
      {/snippet}

      {#snippet actions()}
        {#if isExpo}
          <div class="pane-toolbar__group" role="group" aria-label="Expo preview">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={previewMobile.enabled}
              title={previewMobile.enabled ? 'Exit mobile frame' : 'Show mobile frame'}
              aria-label={previewMobile.enabled ? 'Exit mobile frame' : 'Show mobile frame'}
              aria-pressed={previewMobile.enabled}
              disabled={!previewUrl}
              onclick={() => previewMobile.toggle()}
            >
              <SmartphoneIcon class="size-3.5" />
            </button>
            <ExpoQrPopover url={expoGoUrl} disabled={!expoGoUrl || booting || loading || Boolean(error)} />
          </div>
          <span class="pane-toolbar__sep pane-toolbar__sep--actions" aria-hidden="true"></span>
        {/if}
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
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
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
