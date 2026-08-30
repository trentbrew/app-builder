<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    variant = 'default',
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    variant?: 'default' | 'border' | 'separator'
  } = $props()
</script>

<div
  bind:this={ref}
  data-slot="marker"
  data-variant={variant}
  class={cn(
    'text-muted-foreground flex min-w-0 items-center gap-2 text-xs leading-snug',
    variant === 'border' && 'border-border/70 border-b pb-2',
    variant === 'separator' && 'marker--separator gap-3 py-1',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>

<style>
  :global([data-slot='marker'][data-variant='separator'])::before,
  :global([data-slot='marker'][data-variant='separator'])::after {
    content: '';
    height: 1px;
    flex: 1 1 auto;
    background: color-mix(in oklch, var(--color-border) 80%, transparent);
  }
</style>
