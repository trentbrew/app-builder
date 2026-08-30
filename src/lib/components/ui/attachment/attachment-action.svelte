<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import { cn, type WithElementRef } from '$lib/utils.js'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  let {
    ref = $bindable(null),
    class: className,
    size = 'icon-xs',
    children,
    ...restProps
  }: WithElementRef<HTMLButtonAttributes> = $props()
</script>

<Button bind:ref variant="ghost" {size} class={cn('size-6', className)} {...restProps}>
  {@render children?.()}
</Button>
