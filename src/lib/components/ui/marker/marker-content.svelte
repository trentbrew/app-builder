<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLSpanElement> = $props()
</script>

<span bind:this={ref} data-slot="marker-content" class={cn('min-w-0 font-mono', className)} {...restProps}>
  {@render children?.()}
</span>
