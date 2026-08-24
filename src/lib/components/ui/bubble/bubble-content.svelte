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
  data-slot="bubble-content"
  class={cn('rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap', className)}
  {...restProps}
>
  {@render children?.()}
</div>
