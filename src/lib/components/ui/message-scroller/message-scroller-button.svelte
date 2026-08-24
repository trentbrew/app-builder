<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import { useMessageScroller } from './message-scroller.svelte.js'
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    direction = 'end',
    behavior = 'smooth',
    children,
    ...restProps
  }: WithElementRef<HTMLButtonAttributes> & {
    direction?: 'start' | 'end'
    behavior?: ScrollBehavior
  } = $props()

  const scroller = useMessageScroller()

  const active = $derived(direction === 'end' ? scroller.scrollableEnd : scroller.scrollableStart)

  function handleClick() {
    if (direction === 'end') scroller.scrollToEnd({ behavior })
    else scroller.scrollToStart({ behavior })
  }
</script>

<button
  bind:this={ref}
  type="button"
  data-slot="message-scroller-button"
  data-direction={direction}
  data-active={active ? 'true' : 'false'}
  inert={!active}
  tabindex={active ? 0 : -1}
  class={cn(
    'bg-background text-foreground border-border absolute start-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-opacity',
    direction === 'end' ? 'bottom-3' : 'top-3',
    !active && 'pointer-events-none opacity-0',
    className,
  )}
  onclick={handleClick}
  {...restProps}
>
  {#if children}
    {@render children()}
  {:else if direction === 'end'}
    <ArrowDownIcon class="size-3.5" />
    Jump to latest
  {:else}
    <ArrowUpIcon class="size-3.5" />
    Jump to start
  {/if}
</button>
