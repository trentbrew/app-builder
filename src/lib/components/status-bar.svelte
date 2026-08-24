<script lang="ts">
  import { statusBar, visibleStatusItems, toggleStatusBarVisible } from '$lib/statusBar.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'

  const leftItems = $derived(visibleStatusItems(statusBar.left))
  const rightItems = $derived(visibleStatusItems(statusBar.right))
</script>

{#if statusBar.visible}
  <ContextMenuHost target={{ kind: 'statusBar' }} triggerClass="status-bar-trigger">
    <footer class="status-bar" aria-label="Status bar">
      <div class="status-bar__cluster status-bar__cluster--left">
        {#each leftItems as item (item.id)}
          <ContextMenuHost
            target={{ kind: 'statusBarSegment', segmentId: item.id, side: 'left' }}
            triggerClass="status-bar__item-trigger"
          >
            <span class="status-bar__item" title={item.title}>{item.label}</span>
          </ContextMenuHost>
        {/each}
      </div>
      <div class="status-bar__cluster status-bar__cluster--right">
        {#each rightItems as item (item.id)}
          <ContextMenuHost
            target={{ kind: 'statusBarSegment', segmentId: item.id, side: 'right' }}
            triggerClass="status-bar__item-trigger"
          >
            <span class="status-bar__item" title={item.title}>{item.label}</span>
          </ContextMenuHost>
        {/each}
      </div>
    </footer>
  </ContextMenuHost>
{:else}
  <button
    type="button"
    class="status-bar-restore"
    aria-label="Show status bar"
    title="Show status bar"
    onclick={() => toggleStatusBarVisible()}
  ></button>
{/if}

<style>
  :global(.status-bar-trigger) {
    display: block;
  }

  .status-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 50;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    height: var(--status-bar-height);
    background: var(--status-bar-background);
    color: var(--status-bar-foreground);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: var(--status-bar-height);
    user-select: none;
  }

  .status-bar__cluster {
    display: flex;
    align-items: stretch;
    min-width: 0;
  }

  .status-bar__cluster--right {
    flex-shrink: 0;
  }

  :global(.status-bar__item-trigger) {
    display: flex;
    height: 100%;
  }

  .status-bar__item {
    display: inline-flex;
    align-items: center;
    height: 100%;
    padding: 0 0.5rem;
    white-space: nowrap;
    cursor: default;
  }

  .status-bar__item:hover {
    background: var(--status-bar-hover);
  }

  .status-bar__cluster--left .status-bar__item:first-child {
    padding-left: 0.625rem;
  }

  .status-bar__cluster--right .status-bar__item:last-child {
    padding-right: 0.625rem;
  }

  .status-bar-restore {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 50;
    height: 4px;
    border: none;
    padding: 0;
    background: var(--status-bar-background);
    opacity: 0.45;
    cursor: pointer;
  }

  .status-bar-restore:hover {
    opacity: 0.85;
    height: 6px;
  }
</style>
