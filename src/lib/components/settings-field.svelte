<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label,
    description,
    control,
  }: {
    label: string
    description?: string
    control?: Snippet
  } = $props()
</script>

<div
  class="settings-field grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-center sm:gap-6"
>
  <div class="min-w-0">
    <div class="settings-field__label text-sm font-medium">{label}</div>
    {#if description}
      <p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
    {/if}
  </div>
  <div class="min-w-0 sm:justify-self-end">
    {@render control?.()}
  </div>
</div>
