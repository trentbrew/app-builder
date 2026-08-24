<script lang="ts">
  import { statusBar } from '$lib/statusBar.svelte'
</script>

<footer class="status-bar" aria-label="Status bar">
  <div class="status-bar__cluster status-bar__cluster--left">
    {#each statusBar.left as item (item.id)}
      <span class="status-bar__item" title={item.title}>{item.label}</span>
    {/each}
  </div>
  <div class="status-bar__cluster status-bar__cluster--right">
    {#each statusBar.right as item (item.id)}
      <span class="status-bar__item" title={item.title}>{item.label}</span>
    {/each}
  </div>
</footer>

<style>
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
</style>
