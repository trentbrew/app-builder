<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { PaneKind } from '$lib/actionContext'
  import { PANEL_IDS } from '$lib/editorLayout'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'

  let {
    toolbar,
    children,
    paneKind,
    paneId,
    id,
    surface = 'default',
  }: {
    toolbar?: Snippet
    children?: Snippet
    paneKind?: PaneKind
    paneId?: string
    id?: string
    surface?: 'default' | 'chrome'
  } = $props()

  const resolvedPaneId = $derived(paneId ?? paneKindToPanelId(paneKind))

  const shortcutContext = $derived(
    paneKind === 'preview'
      ? 'preview'
      : paneKind === 'terminal'
        ? 'terminal'
        : undefined
  )

  function paneKindToPanelId(kind: PaneKind | undefined) {
    switch (kind) {
      case 'files':
        return PANEL_IDS.files
      case 'preview':
        return PANEL_IDS.preview
      case 'chat':
        return PANEL_IDS.agent
      case 'logs':
        return PANEL_IDS.logs
      case 'console':
        return PANEL_IDS.console
      default:
        return 'pane:unknown'
    }
  }
</script>

<div class="pane-chrome" {id} data-shortcut-context={shortcutContext} data-surface={surface}>
  {@render toolbar?.()}
  {#if paneKind && resolvedPaneId}
    <ContextMenuHost
      target={{ kind: 'pane', paneId: resolvedPaneId, paneKind }}
      triggerClass="pane-chrome__body-trigger"
    >
      <div class="pane-chrome__body">
        {@render children?.()}
      </div>
    </ContextMenuHost>
  {:else}
    <div class="pane-chrome__body">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .pane-chrome {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    background: var(--color-background);
  }

  .pane-chrome[data-surface='chrome'] {
    background: var(--color-chrome-surface);
  }

  .pane-chrome[data-surface='chrome'] :global(.pane-toolbar) {
    background: var(--color-chrome-surface);
  }

  :global(.pane-chrome__body-trigger) {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .pane-chrome__body {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
</style>
