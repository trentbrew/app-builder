<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import { useMessageScroller } from './message-scroller.svelte.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    messageId,
    scrollAnchor = false,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    messageId: string
    scrollAnchor?: boolean
  } = $props()

  const scroller = useMessageScroller()

  $effect(() => {
    const el = ref
    if (!el) return
    scroller.registerItem(messageId, el, scrollAnchor)
    return () => scroller.unregisterItem(messageId)
  })
</script>

<div
  bind:this={ref}
  data-slot="message-scroller-item"
  data-message-id={messageId}
  data-scroll-anchor={scrollAnchor ? 'true' : 'false'}
  class={cn('[content-visibility:auto] [contain-intrinsic-size:auto_5rem]', className)}
  {...restProps}
>
  {@render children?.()}
</div>
