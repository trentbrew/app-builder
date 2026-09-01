<script lang="ts">
  import LockIcon from '@lucide/svelte/icons/lock'
  import LockOpenIcon from '@lucide/svelte/icons/lock-open'

  let {
    locked = false,
    disabled = false,
    onToggle,
  }: {
    locked?: boolean
    disabled?: boolean
    onToggle?: () => void
  } = $props()
</script>

<button
  type="button"
  class="pane-toolbar__btn"
  class:pane-toolbar__btn--active={locked}
  title={locked ? 'Unlock pane' : 'Lock pane'}
  aria-label={locked ? 'Unlock pane' : 'Lock pane'}
  aria-pressed={locked}
  disabled={disabled || !onToggle}
  onclick={() => onToggle?.()}
>
  {#if locked}
    <LockIcon class="size-3.5" />
  {:else}
    <LockOpenIcon class="size-3.5" />
  {/if}
</button>
