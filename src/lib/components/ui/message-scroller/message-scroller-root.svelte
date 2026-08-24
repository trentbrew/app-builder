<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import { useMessageScroller } from './message-scroller.svelte.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()

  const scroller = useMessageScroller()

  $effect(() => {
    scroller.setRoot(ref)
  })
</script>

<div
  bind:this={ref}
  data-slot="message-scroller"
  class={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}
  {...restProps}
>
  {@render children?.()}
</div>
