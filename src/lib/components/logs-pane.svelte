<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import LogsPanel from '$lib/components/logs-panel.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from '$lib/notify'
  import CopyIcon from '@lucide/svelte/icons/copy'

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

  let logs = $state<string[]>([])

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      logs = state.logs
    })
    return unsubscribe
  })

  const logText = $derived(logs.slice(-80).join('\n') || 'Waiting for server output…')
  const lineCount = $derived(logText.split('\n').length)

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(logText)
      toast.success('Copied logs to clipboard')
    } catch {
      toast.error('Could not copy logs')
    }
  }
</script>

<PaneChrome paneKind="logs">
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{logs.length} entries</span>
        <span class="pane-toolbar__detail">{lineCount} visible lines</span>
      {/snippet}

      {#snippet actions()}
        <button type="button" class="pane-toolbar__btn" title="Copy logs" aria-label="Copy logs" onclick={copyLogs}>
          <CopyIcon class="size-3.5" />
        </button>
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <LogsPanel />
  {/snippet}
</PaneChrome>
