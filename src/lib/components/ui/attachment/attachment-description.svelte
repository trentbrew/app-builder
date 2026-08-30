<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { HTMLAttributes } from 'svelte/elements'

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLSpanElement> = $props()
</script>

<span
  data-slot="attachment-description"
  class={cn('text-muted-foreground block truncate text-[0.6875rem]', className)}
  {...restProps}
>
  {@render children?.()}
</span>
