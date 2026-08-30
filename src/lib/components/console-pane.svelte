<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import ConsolePanel from '$lib/components/console-panel.svelte'
  import { previewConsole } from '$lib/previewConsole.svelte'
  import { toast } from '$lib/notify'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'

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

  const entries = $derived(previewConsole.entries)
  const logText = $derived(
    entries.map((entry) => `[${entry.level}] ${entry.text}`).join('\n') || 'Preview console is empty.',
  )

  async function copyConsole() {
    try {
      await navigator.clipboard.writeText(logText)
      toast.success('Copied console output')
    } catch {
      toast.error('Could not copy console output')
    }
  }

  function clearConsole() {
    previewConsole.clear()
  }
</script>

<PaneChrome paneKind="console">
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{entries.length} entries</span>
      {/snippet}

      {#snippet actions()}
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Clear console"
          aria-label="Clear console"
          disabled={entries.length === 0}
          onclick={clearConsole}
        >
          <Trash2Icon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Copy console output"
          aria-label="Copy console output"
          disabled={entries.length === 0}
          onclick={copyConsole}
        >
          <CopyIcon class="size-3.5" />
        </button>
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <ConsolePanel />
  {/snippet}
</PaneChrome>
