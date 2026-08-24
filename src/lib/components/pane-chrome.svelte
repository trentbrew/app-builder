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
  }: {
    toolbar?: Snippet
    children?: Snippet
    paneKind?: PaneKind
    paneId?: string
  } = $props()

  const resolvedPaneId = $derived(paneId ?? paneKindToPanelId(paneKind))

  function paneKindToPanelId(kind: PaneKind | undefined) {
    switch (kind) {
      case 'files':
        return PANEL_IDS.files
      case 'preview':
        return PANEL_IDS.preview
      case 'chat':
        return PANEL_IDS.chat
      case 'logs':
        return PANEL_IDS.logs
      case 'console':
        return PANEL_IDS.console
      case 'settings':
        return PANEL_IDS.settings
      default:
        return 'pane:unknown'
    }
  }
</script>

<div class="pane-chrome">
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
