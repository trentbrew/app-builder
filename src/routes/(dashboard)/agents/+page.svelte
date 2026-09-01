<script lang="ts">
  import { browser } from '$app/environment'
  import { observeAllSessionEvents } from '$lib/agent/session/log'
  import {
    selectSessions,
    summarizeSessionEvent,
    type SessionEvent,
    type SessionEventRow,
  } from '$lib/agent/session/events'
  import { approvalState, setApprovalMode } from '$lib/agent/approval/approvalStore.svelte'
  import {
    chatModelCatalog,
    chatSettings,
    loadAvailableModels,
    setChatModel,
  } from '$lib/chat/settings.svelte.js'
  import type { SessionRunStats } from '$lib/runEnvelope'
  import ActivityIcon from '@lucide/svelte/icons/activity'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import CoinsIcon from '@lucide/svelte/icons/coins'

  // The inspector is a projection: it reads the same durable log the chat pane
  // writes, plus the same config stores. No execution path, no forked state.
  let rows = $state<SessionEventRow[]>([])
  let selectedId = $state<string | null>(null)

  $effect(() => {
    if (!browser) return
    void loadAvailableModels()
    const sub = observeAllSessionEvents().subscribe({
      next: (next) => (rows = next),
      error: (err) => console.warn('Inspector subscription error:', err),
    })
    return () => sub.unsubscribe()
  })

  // Run stats come from the server manifest (tokens/cost live there, not in the
  // browser). Refetched when the log grows — a new event usually means a new run.
  let runStats = $state<SessionRunStats[]>([])

  async function refreshStats() {
    if (!browser) return
    try {
      const res = await fetch('/api/agent/runs')
      if (!res.ok) return
      const data = (await res.json()) as { sessions?: SessionRunStats[] }
      runStats = data.sessions ?? []
    } catch (err) {
      console.warn('Failed to load run stats:', err)
    }
  }

  $effect(() => {
    // Re-run when the event count changes (reading rows.length registers the dep).
    void rows.length
    void refreshStats()
  })

  const statsById = $derived(new Map(runStats.map((s) => [s.sessionId, s])))
  const totals = $derived(
    runStats.reduce(
      (acc, s) => ({
        totalTokens: acc.totalTokens + s.totalTokens,
        costUsd: s.costUsd === null ? acc.costUsd : (acc.costUsd ?? 0) + s.costUsd,
      }),
      { totalTokens: 0, costUsd: null as number | null },
    ),
  )

  const sessions = $derived(selectSessions(rows))
  // Auto-select the most recently active session until the user picks one.
  const activeId = $derived(selectedId ?? sessions[0]?.sessionId ?? null)
  const activeStats = $derived(activeId ? (statsById.get(activeId) ?? null) : null)

  function formatTokens(n: number): string {
    if (n < 1000) return String(n)
    if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
    return `${(n / 1_000_000).toFixed(1)}M`
  }

  function formatCost(cost: number | null): string {
    if (cost === null) return '—'
    if (cost === 0) return '$0'
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
  }

  const trace = $derived.by(() => {
    if (!activeId) return [] as { seq: number; ts: number; label: string; detail: string }[]
    return rows
      .filter((r) => r.sessionId === activeId)
      .map((r) => {
        const { sessionId: _s, ...event } = r
        const { label, detail } = summarizeSessionEvent(event as SessionEvent)
        return { seq: r.seq, ts: r.ts, label, detail }
      })
  })

  function shortId(id: string) {
    return id.length > 8 ? `${id.slice(0, 8)}…` : id
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function labelKind(label: string) {
    if (label.startsWith('tool')) return 'tool'
    if (label === 'fs') return 'fs'
    if (label === 'user' || label === 'assistant') return 'msg'
    return 'meta'
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 p-6">
  <header class="flex items-baseline justify-between gap-4">
    <div>
      <h1 class="text-lg font-semibold">Agents</h1>
      <p class="text-muted-foreground text-sm">
        Live inspector over the durable session log. Read-only projection — the chat pane drives.
      </p>
    </div>
    <span class="text-muted-foreground font-mono text-xs">
      {sessions.length} session{sessions.length === 1 ? '' : 's'} · {rows.length} events
      {#if totals.totalTokens > 0}
        · {formatTokens(totals.totalTokens)} tok · {formatCost(totals.costUsd)}
      {/if}
    </span>
  </header>

  {#if sessions.length === 0}
    <div
      class="text-muted-foreground flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm"
    >
      No agent activity yet. Start a chat in a project and its trace appears here.
    </div>
  {:else}
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_260px]">
      <!-- Sessions -->
      <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border">
        <div class="text-muted-foreground border-b px-3 py-2 font-mono text-[0.65rem] uppercase tracking-wide">
          Sessions
        </div>
        <ul class="min-h-0 flex-1 overflow-auto p-1">
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
                  {session.events} evt · {formatTime(session.lastTs)} · {session.lastLabel}
                  {#if statsById.get(session.sessionId)}
                    · {formatTokens(statsById.get(session.sessionId)!.totalTokens)} tok
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <!-- Trace -->
      <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border">
        <div class="text-muted-foreground flex items-center gap-1.5 border-b px-3 py-2 font-mono text-[0.65rem] uppercase tracking-wide">
          <ActivityIcon class="size-3" /> Trace
        </div>
        <ol class="min-h-0 flex-1 overflow-auto p-2 font-mono text-[0.7rem]">
          {#each trace as entry (entry.seq)}
            <li class="grid grid-cols-[auto_auto_1fr] items-baseline gap-2 rounded px-1.5 py-0.5">
              <span class="text-muted-foreground opacity-70">{formatTime(entry.ts)}</span>
              <span class="trace__label" data-kind={labelKind(entry.label)}>{entry.label}</span>
              <span class="truncate">{entry.detail}</span>
            </li>
          {/each}
        </ol>
      </section>

      <!-- Config -->
      <section class="flex min-h-0 flex-col gap-3 overflow-auto rounded-lg border p-3">
        <div class="text-muted-foreground flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wide">
          <CoinsIcon class="size-3" /> Session stats
        </div>
        {#if activeStats}
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[0.7rem]">
            <dt class="text-muted-foreground">in</dt>
            <dd class="text-right">{formatTokens(activeStats.inputTokens)}</dd>
            <dt class="text-muted-foreground">out</dt>
            <dd class="text-right">{formatTokens(activeStats.outputTokens)}</dd>
            {#if activeStats.reasoningTokens > 0}
              <dt class="text-muted-foreground">reasoning</dt>
              <dd class="text-right">{formatTokens(activeStats.reasoningTokens)}</dd>
            {/if}
            <dt class="text-muted-foreground">total</dt>
            <dd class="text-right">{formatTokens(activeStats.totalTokens)}</dd>
            <dt class="text-muted-foreground">cost</dt>
            <dd class="text-right">{formatCost(activeStats.costUsd)}</dd>
            <dt class="text-muted-foreground">runs · turns</dt>
            <dd class="text-right">{activeStats.runs} · {activeStats.turns}</dd>
            {#if activeStats.errors > 0}
              <dt class="text-destructive">errors</dt>
              <dd class="text-destructive text-right">{activeStats.errors}</dd>
            {/if}
          </dl>
        {:else}
          <span class="text-muted-foreground text-[0.7rem]">No recorded runs for this session.</span>
        {/if}

        <div class="text-muted-foreground mt-1 flex items-center gap-1.5 border-t pt-3 font-mono text-[0.65rem] uppercase tracking-wide">
          <ShieldCheckIcon class="size-3" /> Config
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-muted-foreground text-xs">Approval</span>
          <div class="inline-flex overflow-hidden rounded-md border text-xs">
            <button
              type="button"
              class="px-2 py-1"
              class:bg-primary={approvalState.mode === 'prompt'}
              class:text-primary-foreground={approvalState.mode === 'prompt'}
              onclick={() => setApprovalMode('prompt')}
            >
              Prompt
            </button>
            <button
              type="button"
              class="border-l px-2 py-1"
              class:bg-primary={approvalState.mode === 'auto-allow'}
              class:text-primary-foreground={approvalState.mode === 'auto-allow'}
              onclick={() => setApprovalMode('auto-allow')}
            >
              Auto-allow
            </button>
          </div>
          <span class="text-muted-foreground text-[0.7rem]">
            {approvalState.mode === 'prompt'
              ? 'Writes ask before landing (fail-closed).'
              : 'Writes land without asking.'}
          </span>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-muted-foreground text-xs">Model</span>
          <select
            class="bg-background rounded border px-2 py-1 font-mono text-xs"
            value={chatSettings.model}
            onchange={(e) => setChatModel(e.currentTarget.value)}
          >
            {#each chatModelCatalog.available as model (model)}
              <option value={model}>{model}</option>
            {/each}
          </select>
          <span class="text-muted-foreground text-[0.7rem]">Shared with the chat pane via chatSettings.</span>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-muted-foreground text-xs">Writable paths</span>
          <span class="font-mono text-[0.7rem]">App.svelte · agent.manifest.json · components/**</span>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .trace__label {
    color: var(--muted-foreground);
  }
  .trace__label[data-kind='tool'] {
    color: var(--color-primary, var(--primary));
  }
  .trace__label[data-kind='fs'] {
    color: var(--color-primary, var(--primary));
    opacity: 0.85;
  }
  .trace__label[data-kind='msg'] {
    color: var(--foreground);
  }
</style>
