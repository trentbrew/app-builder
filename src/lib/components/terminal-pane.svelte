<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import Terminal from '$lib/Terminal.svelte'

  let {
    sessionId,
    title,
    attachPreviewMessages = false,
    canSplit = false,
    maximized = false,
    onSplit,
    onToggleMaximize,
  }: {
    sessionId: string
    title: string
    attachPreviewMessages?: boolean
    canSplit?: boolean
    maximized?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
    onToggleMaximize?: () => void
  } = $props()
</script>

<PaneChrome paneKind="terminal" paneId={`terminal:${sessionId}`}>
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">Shell</span>
        <span class="pane-toolbar__detail" title={sessionId}>{sessionId.slice(0, 8)}</span>
      {/snippet}

      {#snippet actions()}
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <Terminal {sessionId} {attachPreviewMessages} />
  {/snippet}
</PaneChrome>
