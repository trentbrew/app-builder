<script lang="ts">
  import { harnessStore } from '$lib/agentHarness/harnessStore.svelte'

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
</script>

<section class="tool-log" aria-label="Agent tool log">
  <header class="tool-log__header">
    <span class="tool-log__title">Tool log</span>
  </header>
  <ol class="tool-log__list" aria-live="polite">
    {#if harnessStore.toolLog.length === 0}
      <li class="tool-log__empty">No agent events yet</li>
    {:else}
      {#each harnessStore.toolLog as entry (entry.id)}
        <li class="tool-log__entry" data-kind={entry.kind}>
          <span class="tool-log__time">{formatTime(entry.ts)}</span>
          <span class="tool-log__summary">{entry.summary}</span>
        </li>
      {/each}
    {/if}
  </ol>
</section>

<style>
  .tool-log {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid var(--border);
  }

  .tool-log__header {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .tool-log__title {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .tool-log__list {
    list-style: none;
    margin: 0;
    padding: 0.5rem;
    overflow: auto;
    flex: 1;
    min-height: 4rem;
    max-height: 10rem;
  }

  .tool-log__empty {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    padding: 0.25rem 0.5rem;
  }

  .tool-log__entry {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    padding: 0.2rem 0.35rem;
    border-radius: 0.25rem;
  }

  .tool-log__entry[data-kind='deny'] .tool-log__summary {
    color: var(--destructive);
  }

  .tool-log__entry[data-kind='emit'] .tool-log__summary {
    color: var(--color-primary);
  }

  .tool-log__time {
    opacity: 0.65;
  }
</style>
