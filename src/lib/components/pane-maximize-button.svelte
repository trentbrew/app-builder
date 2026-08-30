<script lang="ts">
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2'
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2'

  let {
    maximized = false,
    disabled = false,
    onToggle,
  }: {
    maximized?: boolean
    disabled?: boolean
    onToggle?: () => void
  } = $props()
</script>

<button
  type="button"
  class="pane-toolbar__btn"
  class:pane-toolbar__btn--active={maximized}
  title={maximized ? 'Exit fullscreen' : 'Fullscreen'}
  aria-label={maximized ? 'Exit fullscreen' : 'Fullscreen'}
  aria-pressed={maximized}
  disabled={disabled || !onToggle}
  onclick={() => onToggle?.()}
>
  {#if maximized}
    <Minimize2Icon class="size-3.5" />
  {:else}
    <Maximize2Icon class="size-3.5" />
  {/if}
</button>
