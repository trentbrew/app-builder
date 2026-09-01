<script lang="ts">
  import TextShine from '$lib/components/text-shine.svelte'
  import * as Marker from '$lib/components/ui/marker/index.js'
  import { Spinner } from '$lib/components/ui/spinner/index.js'
  import { cn } from '$lib/utils.js'

  let {
    label,
    streaming = true,
    class: className,
  }: {
    label: string
    streaming?: boolean
    class?: string
  } = $props()
</script>

<Marker.Root role="status" aria-live="polite" class={cn('px-1 py-0.5', className)}>
  {#if streaming}
    <Marker.Icon>
      <Spinner class="size-3" role="none" aria-hidden="true" />
    </Marker.Icon>
  {/if}
  <Marker.Content class="text-sm font-medium">
    {#if streaming}
      <TextShine>{label}</TextShine>
    {:else}
      {label}
    {/if}
  </Marker.Content>
</Marker.Root>
