<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props()
</script>

<div
  data-slot="attachment-group"
  class={cn(
    'flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
