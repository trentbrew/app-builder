<script lang="ts">
  import { browser } from '$app/environment'
  import { observeAllSessionEvents } from '$lib/agent/session/log'
  import { selectSessions, type SessionEvent, type SessionEventRow } from '$lib/agent/session/events'
  import TraceWaterfall from '$lib/components/trace-waterfall.svelte'
  import InferenceControls from '$lib/components/inference-controls.svelte'
  import PanelsTopLeftIcon from '@lucide/svelte/icons/panels-top-left'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import ActivityIcon from '@lucide/svelte/icons/activity'
  import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'

  // Agent workspace shell (pi-sprite-derived). Phase 0: the panel frame + a live
  // Sessions rail over the durable log. Chat / Trace / Inference panels are filled
  // in the following phases; the regions are placed so those phases fill them
  // rather than restructure. Everything here is a projection of existing stores —
  // no execution path lives in this route.
  let rows = $state<SessionEventRow[]>([])
  let selectedId = $state<string | null>(null)

  $effect(() => {
    if (!browser) return
    const sub = observeAllSessionEvents().subscribe({
      next: (next) => (rows = next),
      error: (err) => console.warn('Workspace subscription error:', err),
    })
    return () => sub.unsubscribe()
  })

  const sessions = $derived(selectSessions(rows))
  const activeId = $derived(selectedId ?? sessions[0]?.sessionId ?? null)
  const activeEvents = $derived<SessionEvent[]>(
    activeId
      ? rows.filter((r) => r.sessionId === activeId).map(({ sessionId: _s, ...e }) => e as SessionEvent)
      : [],
  )

  function shortId(id: string) {
    return id.length > 8 ? `${id.slice(0, 8)}…` : id
  }
</script>

<div class="workspace">
  <header class="workspace__bar">
    <span class="workspace__title">
      <PanelsTopLeftIcon class="size-4" />
      Workspace
    </span>
    <span class="text-muted-foreground font-mono text-xs">
      {sessions.length} session{sessions.length === 1 ? '' : 's'}
    </span>
  </header>

  <div class="workspace__grid">
    <!-- Sessions (live) -->
    <section class="panel">
      <div class="panel__head">Sessions</div>
      <ul class="panel__body p-1">
        {#if sessions.length === 0}
          <li class="text-muted-foreground p-2 text-xs">No sessions yet.</li>
        {:else}
          {#each sessions as session (session.sessionId)}
            <li>
              <button
                type="button"
                class="w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                class:bg-muted={session.sessionId === activeId}
                onclick={() => (selectedId = session.sessionId)}
              >
                <span class="block font-mono text-xs">{shortId(session.sessionId)}</span>
                <span class="text-muted-foreground block truncate text-[0.7rem]">
                  {session.events} · {session.lastLabel}
                </span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </section>

    <!-- Chat (Phase 4) -->
    <section class="panel">
      <div class="panel__head"><MessageSquareIcon class="size-3" /> Chat</div>
      <div class="panel__placeholder">
        Live chat lands here (Phase 4 — rich composer).
      </div>
    </section>

    <!-- Trace + Inference (Phases 2 & 3) -->
    <div class="workspace__right">
      <section class="panel">
        <div class="panel__head"><ActivityIcon class="size-3" /> Trace</div>
        <div class="panel__body">
          <TraceWaterfall events={activeEvents} live />
        </div>
      </section>
      <section class="panel">
        <div class="panel__head"><SlidersHorizontalIcon class="size-3" /> Inference</div>
        <div class="panel__body">
          <InferenceControls />
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .workspace {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.5rem 1.5rem;
  }

  .workspace__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .workspace__title {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .workspace__grid {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-template-columns: 220px 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 1100px) {
    .workspace__grid {
      grid-template-columns: 220px 1fr 300px;
    }
  }

  .workspace__right {
    display: none;
    min-height: 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  @media (min-width: 1100px) {
    .workspace__right {
      display: flex;
    }
  }

  .panel {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--card);
  }

  .panel__head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .panel__body {
    min-height: 0;
    flex: 1;
    overflow: auto;
    list-style: none;
    margin: 0;
  }

  .panel__placeholder {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
</style>
