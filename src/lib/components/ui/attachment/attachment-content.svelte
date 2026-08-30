<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props()
</script>

<div data-slot="attachment-content" class={cn('min-w-0 flex-1', className)} {...restProps}>
  {@render children?.()}
</div>
