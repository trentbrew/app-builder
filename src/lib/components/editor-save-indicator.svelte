<script lang="ts">
  import { editorSaveState, editorSaveStatusLabel } from '$lib/editorSaveState.svelte'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import CheckIcon from '@lucide/svelte/icons/check'
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert'
  import PencilIcon from '@lucide/svelte/icons/pencil'

  const saveLabel = $derived(editorSaveStatusLabel())
  const saveStatus = $derived(editorSaveState.status)
</script>

{#if saveLabel}
  <span
    class="editor-save-indicator"
    class:editor-save-indicator--pending={saveStatus === 'pending'}
    class:editor-save-indicator--active={saveStatus === 'saving'}
    class:editor-save-indicator--done={saveStatus === 'saved'}
    class:editor-save-indicator--error={saveStatus === 'error'}
    aria-live="polite"
    aria-label="Save status"
    title={saveLabel}
  >
    {#if saveStatus === 'saving'}
      <Loader2Icon class="editor-save-indicator__icon editor-save-indicator__icon--spin" />
    {:else if saveStatus === 'saved'}
      <CheckIcon class="editor-save-indicator__icon" />
    {:else if saveStatus === 'error'}
      <CircleAlertIcon class="editor-save-indicator__icon" />
    {:else}
      <PencilIcon class="editor-save-indicator__icon" />
    {/if}
    <span class="editor-save-indicator__label">{saveLabel}</span>
  </span>
{/if}

<style>
  .editor-save-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0 0.375rem;
    font-size: 0.6875rem;
    color: var(--color-muted-foreground);
    white-space: nowrap;
  }

  .editor-save-indicator--active {
    color: var(--color-foreground);
  }

  .editor-save-indicator--done {
    color: color-mix(in oklch, var(--color-foreground) 80%, #4ade80);
  }

  .editor-save-indicator--error {
    color: color-mix(in oklch, var(--color-foreground) 70%, #f87171);
  }

  .editor-save-indicator__icon {
    width: 0.75rem;
    height: 0.75rem;
    flex-shrink: 0;
  }

  :global(.editor-save-indicator__icon--spin) {
    animation: editor-save-indicator-spin 0.8s linear infinite;
  }

  @keyframes editor-save-indicator-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
