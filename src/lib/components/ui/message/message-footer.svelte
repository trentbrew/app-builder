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
  data-slot="message-footer"
  class={cn('group-data-[align=end]/message:justify-end flex items-center gap-1 px-1', className)}
  {...restProps}
>
  {@render children?.()}
</div>
