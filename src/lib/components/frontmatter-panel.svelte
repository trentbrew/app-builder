<script lang="ts">
  import { buildFrontmatterControls } from '$lib/frontmatterEditor'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'

  let {
    meta,
    onChange,
    defaultOpen = true,
  }: {
    meta: Record<string, unknown>
    onChange: (meta: Record<string, unknown>) => void
    defaultOpen?: boolean
  } = $props()

  let open = $state(defaultOpen)
  let host = $state<HTMLDivElement | undefined>()

  $effect(() => {
    const element = host
    const nextMeta = meta
    if (!element || !open) return
    element.innerHTML = ''
    element.appendChild(buildFrontmatterControls(nextMeta, onChange))
  })

  const count = $derived(Object.keys(meta).length)
</script>

<aside
  data-component="frontmatter-panel"
  data-variant="rail"
  class="frontmatter-panel flex flex-col border-l border-border bg-transparent transition-[width] duration-150 ease-out"
  class:w-72={open}
  class:w-9={!open}
>
  <div class="flex items-center justify-between border-b border-border px-2 py-1.5">
    <button
      type="button"
      class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      title={open ? 'Collapse properties' : 'Expand properties'}
      onclick={() => (open = !open)}
    >
      {#if open}
        <ChevronRightIcon class="size-3.5" />
      {:else}
        <ChevronLeftIcon class="size-3.5" />
      {/if}
      {#if open}
        <span>Properties</span>
        <span class="text-muted-foreground/70">{count}</span>
      {/if}
    </button>
  </div>

  {#if open}
    <div bind:this={host} class="min-h-0 flex-1 overflow-auto p-2"></div>
  {/if}
</aside>
