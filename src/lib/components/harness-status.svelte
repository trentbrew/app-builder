<script lang="ts">
  import { harnessStore } from '$lib/agentHarness/harnessStore.svelte'
  import { rollbackGuest } from '$lib/agentHarness/editComponent'
  import { sandboxStore } from '$lib/sandboxStore'
  import UndoIcon from '@lucide/svelte/icons/undo-2'

  let { showPhase = true }: { showPhase?: boolean } = $props()

  let bootPhase = $state('idle')

  $effect(() => {
    const unsub = sandboxStore.subscribe((s) => {
      bootPhase = s.phase
    })
    return unsub
  })

  async function handleRollback() {
    if (!harnessStore.lastSnapshotId) return
    await rollbackGuest(harnessStore.lastSnapshotId)
  }
</script>

<section class="harness-status" aria-label="Harness status">
  {#if showPhase}
    <div class="harness-status__row">
      <span class="harness-status__label">Phase</span>
      <span class="harness-status__value">{bootPhase}</span>
    </div>
  {/if}
  <div class="harness-status__row">
    <span class="harness-status__label">Last write</span>
    <span class="harness-status__value" title={harnessStore.lastWritePath || undefined}>
      {harnessStore.lastWritePath || '—'}
    </span>
  </div>
  <div class="harness-status__row">
    <span class="harness-status__label">Snapshot</span>
    <span class="harness-status__value">{harnessStore.lastSnapshotId || '—'}</span>
  </div>
  {#if harnessStore.hmrMs !== null}
    <div class="harness-status__row">
      <span class="harness-status__label">HMR</span>
      <span class="harness-status__value">{harnessStore.hmrMs}ms</span>
    </div>
  {/if}
  <button
    type="button"
    class="harness-status__rollback"
    disabled={!harnessStore.lastSnapshotId}
    onclick={handleRollback}
    aria-label="Rollback last agent write"
  >
    <UndoIcon class="size-3.5" />
    Rollback
  </button>
</section>

<style>
  .harness-status {
    padding: 0.75rem;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 0.35rem;
    font-size: 0.75rem;
  }

  .harness-status__row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .harness-status__label {
    color: var(--muted-foreground);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .harness-status__value {
    font-family: var(--font-mono, ui-monospace, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 12rem;
  }

  .harness-status__rollback {
    margin-top: 0.35rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: calc(var(--radius) * 0.75);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
  }

  .harness-status__rollback:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
