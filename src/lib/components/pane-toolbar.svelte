<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    meta,
    actions,
    viewToggle,
  }: {
    meta?: Snippet
    actions?: Snippet
    viewToggle?: Snippet
  } = $props()
</script>

<div class="pane-toolbar">
  <div class="pane-toolbar__meta">
    {@render meta?.()}
  </div>
  <div class="pane-toolbar__actions">
    {#if viewToggle}
      <div class="pane-toolbar__view-toggle">
        {@render viewToggle()}
      </div>
    {/if}
    {@render actions?.()}
  </div>
</div>

<style>
  .pane-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
    height: var(--editor-chrome-height, 2rem);
    min-height: var(--editor-chrome-height, 2rem);
    padding: 0 0.5rem;
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-background) 92%, var(--color-muted));
    box-sizing: border-box;
    font-family: var(--font-mono);
  }

  .pane-toolbar__meta,
  .pane-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
  }

  .pane-toolbar__meta {
    flex: 1 1 auto;
    overflow: hidden;
  }

  .pane-toolbar__actions {
    flex: 0 0 auto;
    margin-left: auto;
    gap: 0.25rem;
  }

  .pane-toolbar__view-toggle {
    display: inline-flex;
    align-items: center;
    margin-right: 0.125rem;
  }

  :global(.pane-toolbar__sep--actions) {
    margin: 0 0.125rem;
  }

  :global(.pane-toolbar__label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-foreground);
  }

  :global(.pane-toolbar__detail) {
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--color-muted-foreground);
  }

  :global(.pane-toolbar__sep) {
    flex-shrink: 0;
    width: 1px;
    height: 0.875rem;
    background: var(--color-border);
    margin: 0.875rem;
  }

  :global(.pane-toolbar__group) {
    display: inline-flex;
    align-items: center;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
  }

  :global(.pane-toolbar__btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem;
    height: 1.625rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    padding: 0;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  :global(.pane-toolbar__btn:hover:not(:disabled)) {
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-muted) 70%, transparent);
  }

  :global(.pane-toolbar__btn:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.pane-toolbar__btn--active) {
    color: var(--color-foreground);
    box-shadow: inset 0 -1px 0 0 var(--color-foreground);
  }

  :global(.pane-toolbar__group .pane-toolbar__btn) {
    border-radius: 0;
  }

  :global(.pane-toolbar__group .pane-toolbar__btn + .pane-toolbar__btn) {
    border-left: 1px solid var(--color-border);
  }
</style>
