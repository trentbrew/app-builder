<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()
</script>

<div
  bind:this={ref}
  data-slot="message-avatar"
  class={cn('flex shrink-0 self-end has-[+[data-slot=message-content]_[data-slot=message-footer]]:mb-6', className)}
  {...restProps}
>
  {@render children?.()}
</div>
