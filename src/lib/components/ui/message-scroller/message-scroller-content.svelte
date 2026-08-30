<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import { useMessageScroller } from './message-scroller.svelte.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    spacerClass: spacerClassName,
    role = 'log',
    'aria-relevant': ariaRelevant = 'additions',
    'aria-busy': ariaBusy,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    spacerClass?: string
  } = $props()

  const scroller = useMessageScroller()
  let spacerEl = $state<HTMLDivElement | null>(null)

  $effect(() => {
    scroller.setContent(ref)
  })

  $effect(() => {
    scroller.setSpacer(spacerEl)
  })
</script>

<div
  bind:this={ref}
  data-slot="message-scroller-content"
  {role}
  aria-relevant={ariaRelevant}
  aria-busy={ariaBusy}
  class={cn('flex min-h-full flex-col gap-0 p-0', className)}
  {...restProps}
>
  {@render children?.()}
  <div
    bind:this={spacerEl}
    data-slot="message-scroller-spacer"
    class={cn('pointer-events-none shrink-0', spacerClassName)}
    aria-hidden="true"
  ></div>
</div>
