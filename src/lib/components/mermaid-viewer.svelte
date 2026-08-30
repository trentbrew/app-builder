<script lang="ts">
  import { renderMermaidDiagram } from '$lib/mermaid/render'
  import { browser } from '$app/environment'

  let { source }: { source: string } = $props()

  let diagram = $state<HTMLDivElement | undefined>()

  $effect(() => {
    const el = diagram
    const text = source
    if (!browser || !el) return
    void renderMermaidDiagram(text, el)
  })
</script>

<div data-component="file-mermaid" class="mermaid-viewer">
  <div bind:this={diagram} class="mermaid-viewer__diagram"></div>
</div>

<style>
  .mermaid-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: auto;
    padding: 1rem;
  }

  .mermaid-viewer__diagram {
    margin: auto;
    width: 100%;
    max-width: 100%;
  }

  :global(.mermaid-viewer__diagram svg) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
  }

  :global(.mermaid-viewer .mermaid-source-fallback) {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    white-space: pre-wrap;
    color: var(--color-muted-foreground);
  }
</style>
