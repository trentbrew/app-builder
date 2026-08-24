<script lang="ts">
  import { setMessageScroller, type MessageScrollerOptions, type ScrollPosition } from './message-scroller.svelte.js'
  import type { Snippet } from 'svelte'

  let {
    autoScroll = false,
    defaultScrollPosition = 'end' satisfies ScrollPosition,
    scrollEdgeThreshold = 8,
    scrollMargin = 0,
    scrollPreviousItemPeek = 64,
    children,
  }: MessageScrollerOptions & {
    children?: Snippet
  } = $props()

  const scroller = setMessageScroller()

  $effect(() => {
    scroller.autoScroll = autoScroll
    scroller.defaultScrollPosition = defaultScrollPosition
    scroller.scrollEdgeThreshold = scrollEdgeThreshold
    scroller.scrollMargin = scrollMargin
    scroller.scrollPreviousItemPeek = scrollPreviousItemPeek
  })

  $effect(() => {
    return () => scroller.destroy()
  })
</script>

{@render children?.()}
