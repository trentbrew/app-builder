<script lang="ts">
  import { buildWaterfall, formatTraceDuration } from '$lib/agent/session/traceWaterfall'
  import type { SessionEvent } from '$lib/agent/session/events'

  let { events, live = false }: { events: SessionEvent[]; live?: boolean } = $props()

  const layout = $derived(buildWaterfall(events, { live }))

  function pct(n: number, total: number) {
    return total > 0 ? `${Math.min(100, (n / total) * 100)}%` : '0%'
  }
</script>

{#if layout.spans.length === 0}
  <div class="trace-wf__empty">No trace for this session yet.</div>
{:else}
  <ul class="trace-wf" aria-label="Trace waterfall">
    {#each layout.spans as span (span.id)}
      <li class="trace-wf__row" data-depth={span.depth}>
        <span class="trace-wf__label" title={span.detail ?? span.label}>
          {span.label}{#if span.detail}<span class="trace-wf__detail"> {span.detail}</span>{/if}
        </span>
        <span class="trace-wf__track">
          <span
            class="trace-wf__bar"
            class:trace-wf__bar--active={span.active}
            data-semantic={span.semantic}
            style:left={pct(span.startMs, layout.totalMs)}
            style:width={pct(span.durationMs, layout.totalMs)}
          ></span>
        </span>
        <span class="trace-wf__dur">{formatTraceDuration(span.durationMs)}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .trace-wf {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.6875rem;
  }

  .trace-wf__empty {
    padding: 1rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .trace-wf__row {
    display: grid;
    grid-template-columns: 8rem 1fr 3.25rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.1rem 0.25rem;
    border-radius: 0.25rem;
  }

  .trace-wf__row:hover {
    background: color-mix(in oklch, var(--foreground) 5%, transparent);
  }

  .trace-wf__row[data-depth='1'] .trace-wf__label {
    padding-inline-start: 0.75rem;
    opacity: 0.9;
  }

  .trace-wf__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--foreground);
  }

  .trace-wf__detail {
    color: var(--muted-foreground);
  }

  .trace-wf__track {
    position: relative;
    height: 0.75rem;
    border-radius: 0.25rem;
    background: color-mix(in oklch, var(--foreground) 4%, transparent);
  }

  .trace-wf__bar {
    position: absolute;
    top: 0;
    bottom: 0;
    min-width: 2px;
    border-radius: 0.25rem;
    background: var(--muted-foreground);
  }

  .trace-wf__bar[data-semantic='turn'] {
    background: color-mix(in oklch, var(--color-primary, oklch(0.7 0.15 250)) 55%, transparent);
  }
  .trace-wf__bar[data-semantic='tool'] {
    background: oklch(0.72 0.16 60);
  }
  .trace-wf__bar[data-semantic='tool-denied'] {
    background: var(--destructive);
  }
  .trace-wf__bar[data-semantic='fs'] {
    background: oklch(0.7 0.15 150);
  }

  .trace-wf__bar--active {
    animation: trace-wf-pulse 1.2s ease-in-out infinite;
  }

  @keyframes trace-wf-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .trace-wf__bar--active {
      animation: none;
    }
  }

  .trace-wf__dur {
    text-align: right;
    color: var(--muted-foreground);
  }
</style>
