<script lang="ts">
  import { statusBar, visibleStatusItems, toggleStatusBarVisible } from '$lib/statusBar.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import StatusBarNotifications from '$lib/components/status-bar-notifications.svelte'
  import type { StatusBarItem } from '$lib/statusBar.svelte'

  const leftItems = $derived(visibleStatusItems(statusBar.left))
  const rightItems = $derived(visibleStatusItems(statusBar.right))

  function handleItemClick(item: StatusBarItem, event: MouseEvent) {
    if (item.kind !== 'button' || item.disabled || !item.onclick) return
    event.stopPropagation()
    item.onclick()
  }
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
            {#if item.kind === 'button'}
              <button
                type="button"
                class="status-bar__item status-bar__item--button"
                class:status-bar__item--disabled={item.disabled}
                title={item.title ?? item.label}
                disabled={item.disabled}
                onclick={(event) => handleItemClick(item, event)}
              >
                {#if item.icon}
                  <item.icon class="size-3" />
                {/if}
                <span>{item.label}</span>
              </button>
            {:else}
              <span class="status-bar__item" title={item.title}>{item.label}</span>
            {/if}
          </ContextMenuHost>
        {/each}
      </div>
      <div class="status-bar__cluster status-bar__cluster--right">
        {#each rightItems as item (item.id)}
          <ContextMenuHost
            target={{ kind: 'statusBarSegment', segmentId: item.id, side: 'right' }}
            triggerClass="status-bar__item-trigger"
          >
            {#if item.kind === 'button'}
              <button
                type="button"
                class="status-bar__item status-bar__item--button"
                class:status-bar__item--disabled={item.disabled}
                title={item.title ?? item.label}
                disabled={item.disabled}
                onclick={(event) => handleItemClick(item, event)}
              >
                {#if item.icon}
                  <item.icon class="size-3" />
                {/if}
                <span>{item.label}</span>
              </button>
            {:else}
              <span class="status-bar__item" title={item.title}>{item.label}</span>
            {/if}
          </ContextMenuHost>
        {/each}
        <StatusBarNotifications />
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
    gap: 0.375rem;
    height: 100%;
    padding: 0 0.5rem;
    white-space: nowrap;
    cursor: default;
  }

  .status-bar__item--button {
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .status-bar__item--button:hover:not(.status-bar__item--disabled) {
    background: var(--status-bar-hover);
  }

  .status-bar__item--disabled {
    opacity: 0.65;
    cursor: default;
  }

  .status-bar__item:hover:not(.status-bar__item--button) {
    background: var(--status-bar-hover);
  }

  .status-bar__cluster--left .status-bar__item:first-child {
    padding-left: 0.625rem;
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

  .status-bar__item--save {
    gap: 0.3rem;
    opacity: 0.92;
  }

  .status-bar__item--save-pending {
    opacity: 0.78;
  }

  .status-bar__item--save-active {
    opacity: 1;
  }

  .status-bar__item--save-done {
    opacity: 0.95;
  }

  .status-bar__item--save-error {
    opacity: 1;
    color: color-mix(in oklch, var(--status-bar-foreground) 70%, #f87171);
  }

  :global(.status-bar__save-icon) {
    width: 0.75rem;
    height: 0.75rem;
    flex-shrink: 0;
    opacity: 0.9;
  }

  :global(.status-bar__save-icon--spin) {
    animation: status-bar-save-spin 0.8s linear infinite;
  }

  @keyframes status-bar-save-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
