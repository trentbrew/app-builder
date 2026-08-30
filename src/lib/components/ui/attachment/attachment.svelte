<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    class: className,
    state = 'done',
    size = 'sm',
    orientation = 'horizontal',
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    state?: 'idle' | 'uploading' | 'processing' | 'error' | 'done'
    size?: 'default' | 'sm' | 'xs'
    orientation?: 'horizontal' | 'vertical'
    children?: Snippet
  } = $props()
</script>

<div
  data-slot="attachment"
  data-state={state}
  data-size={size}
  data-orientation={orientation}
  class={cn(
    'bg-muted/35 border-border/80 relative flex min-w-0 items-center gap-2 rounded-lg border p-2',
    orientation === 'vertical' && 'max-w-28 flex-col p-1.5',
    size === 'xs' && 'gap-1.5 p-1.5 text-xs',
    state === 'error' && 'border-destructive/40 bg-destructive/5',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
