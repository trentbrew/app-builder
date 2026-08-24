<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import { useMessageScroller } from './message-scroller.svelte.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    preserveScrollOnPrepend = true,
    role = 'region',
    'aria-label': ariaLabel = 'Messages',
    tabIndex = 0,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    preserveScrollOnPrepend?: boolean
  } = $props()

  const scroller = useMessageScroller()

  $effect(() => {
    scroller.setViewport(ref)
  })

  export function beginPrepend() {
    if (preserveScrollOnPrepend) scroller.beginPrepend()
  }

  export function endPrepend() {
    if (preserveScrollOnPrepend) scroller.endPrepend()
  }
</script>

<div
  bind:this={ref}
  data-slot="message-scroller-viewport"
  role="region"
  aria-label={ariaLabel}
  tabindex={tabIndex}
  class={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none', className)}
  {...restProps}
>
  {@render children?.()}
</div>
