<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLSpanElement> = $props()
</script>

<span data-slot="attachment-title" class={cn('block truncate text-xs font-medium', className)} {...restProps}>
  {@render children?.()}
</span>
