<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    toolbar,
    children,
  }: {
    toolbar?: Snippet
    children?: Snippet
  } = $props()
</script>

<div class="pane-chrome">
  {@render toolbar?.()}
  <div class="pane-chrome__body">
    {@render children?.()}
  </div>
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

  .pane-chrome__body {
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }
</style>
