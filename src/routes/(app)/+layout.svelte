<script lang="ts">
  import IconRail from '$lib/components/icon-rail.svelte'
  import { initSandboxBackend } from '$lib/sandboxStore'
  import type { Snippet } from 'svelte'

  let { data, children }: { data: { sandboxBackend: 'bun' | 'webcontainer' }; children: Snippet } = $props()

  initSandboxBackend(data.sandboxBackend)
</script>

<div class="app-shell relative flex w-full flex-col">
  <IconRail />
  <div class="flex min-h-0 min-w-0 flex-1 flex-col pl-12">
    {@render children()}
  </div>
</div>

<style>
  .app-shell {
    --rail-width: 3rem;
  }

  .app-shell :global([data-side='left'] > [data-slot='sidebar-container']) {
    left: var(--rail-width) !important;
    inset-inline-start: var(--rail-width) !important;
  }

  .app-shell :global([data-side='left'][data-collapsible='offcanvas'] > [data-slot='sidebar-container']) {
    left: calc(var(--rail-width) - var(--sidebar-width)) !important;
    inset-inline-start: calc(var(--rail-width) - var(--sidebar-width)) !important;
  }
</style>
