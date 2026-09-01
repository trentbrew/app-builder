<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    approvalState,
    cancelPendingApproval,
    resolveApproval,
  } from '$lib/agent/approval/approvalStore.svelte'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import XIcon from '@lucide/svelte/icons/x'

  const pending = $derived(approvalState.pending)

  // Fail closed: if this surface unmounts with a prompt open, deny it so the
  // agent loop never hangs waiting on a prompt that is no longer on screen.
  onDestroy(() => cancelPendingApproval())
</script>

{#if pending}
  <div class="approval" role="alertdialog" aria-label="Approve agent write">
    <div class="approval__head">
      <ShieldCheckIcon class="size-3.5 shrink-0" />
      <span class="approval__title">Allow agent to write</span>
    </div>
    <div class="approval__target">
      <span class="approval__path" title={pending.path}>{pending.path}</span>
      <span class="approval__summary">{pending.summary}</span>
    </div>
    <div class="approval__actions">
      <button
        type="button"
        class="approval__btn approval__btn--allow"
        onclick={() => resolveApproval(pending.id, 'allow')}
      >
        <CheckIcon class="size-3" />
        Allow
      </button>
      <button
        type="button"
        class="approval__btn"
        onclick={() => resolveApproval(pending.id, 'allow-all')}
      >
        Allow all this turn
      </button>
      <button
        type="button"
        class="approval__btn approval__btn--deny"
        onclick={() => resolveApproval(pending.id, 'deny')}
      >
        <XIcon class="size-3" />
        Deny
      </button>
    </div>
  </div>
{/if}

<style>
  .approval {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0.5rem 0.5rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-agent-glow, var(--border));
    border-radius: 0.5rem;
    background: var(--card);
  }

  .approval__head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--muted-foreground);
  }

  .approval__title {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .approval__target {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .approval__path {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .approval__summary {
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--muted-foreground);
  }

  .approval__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .approval__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: transparent;
    font-size: 0.75rem;
    color: var(--foreground);
    cursor: pointer;
  }

  .approval__btn:hover {
    background: var(--accent, var(--muted));
  }

  .approval__btn--allow {
    border-color: transparent;
    background: var(--color-primary, var(--primary));
    color: var(--color-primary-foreground, var(--primary-foreground));
  }

  .approval__btn--deny:hover {
    color: var(--destructive);
    border-color: var(--destructive);
  }
</style>
