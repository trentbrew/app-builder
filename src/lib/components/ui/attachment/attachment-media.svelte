<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    class: className,
    variant = 'icon',
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    variant?: 'icon' | 'image'
    children?: Snippet
  } = $props()
</script>

<div
  data-slot="attachment-media"
  data-variant={variant}
  class={cn(
    'bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border',
    variant === 'image' && 'size-12 rounded-md p-0',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
