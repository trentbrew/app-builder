<script lang="ts">
  import { observeSessionEvents } from '$lib/agent/session/log'
  import { selectToolLog, type SessionEvent, type ToolLogRow } from '$lib/agent/session/events'
  import { harnessStore } from '$lib/agentHarness/harnessStore.svelte'
  import type { ToolLogEntry } from '$lib/agentHarness/types'
  import * as Marker from '$lib/components/ui/marker/index.js'
  import CheckIcon from '@lucide/svelte/icons/check'
  import FileIcon from '@lucide/svelte/icons/file'
  import WrenchIcon from '@lucide/svelte/icons/wrench'
  import XIcon from '@lucide/svelte/icons/x'
  import UndoIcon from '@lucide/svelte/icons/undo-2'
  import { rollbackSnapshot } from '$lib/agentHarness/snapshotStore'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from '$lib/notify'

  let { sessionId }: { sessionId?: string } = $props()

  let events = $state<SessionEvent[]>([])

  $effect(() => {
    if (!sessionId) {
      events = []
      return
    }
    const sub = observeSessionEvents(sessionId).subscribe({
      next: (next) => (events = next),
      error: (err) => console.warn('Tool-log subscription error:', err),
    })
    return () => sub.unsubscribe()
  })

  const rows = $derived<ToolLogRow[]>(mergeToolLogRows(events, harnessStore.toolLog))

  function mergeToolLogRows(sessionEvents: SessionEvent[], harnessEntries: ToolLogEntry[]): ToolLogRow[] {
    const sessionRows = selectToolLog(sessionEvents)
    const harnessRows = harnessEntries.map((entry, index) => harnessEntryToRow(entry, index))
    return [...sessionRows, ...harnessRows].sort((a, b) => a.ts - b.ts)
  }

  function harnessEntryToRow(entry: ToolLogEntry, index: number): ToolLogRow {
    return {
      seq: -(index + 1),
      ts: entry.ts,
      callId: entry.id,
      kind: entry.kind === 'deny' ? 'result' : entry.kind === 'read' ? 'fs' : 'call',
      summary: entry.summary,
      path: entry.path,
      denied: entry.kind === 'deny',
      ok: entry.kind !== 'deny',
    }
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  async function handleRollback(snapshotId: string) {
    try {
      const ok = await rollbackSnapshot(snapshotId)
      if (ok) {
        sandboxStore.notifyFilesystemChange()
        toast.success('Restored previous file state')
      } else {
        toast.error('Could not restore snapshot')
      }
    } catch {
      toast.error('Rollback failed')
    }
  }
</script>

<section class="tool-log" aria-label="Agent tool log">
  <header class="tool-log__header">
    <span class="tool-log__title">Tool log</span>
  </header>
  <ol class="tool-log__list" aria-live="polite">
    {#if rows.length === 0}
      <li class="tool-log__empty">No agent events yet</li>
    {:else}
      {#each rows as row (row.seq)}
        <li class="tool-log__entry" data-kind={row.kind} data-denied={row.denied ? 'true' : undefined}>
          <Marker.Root variant="border" class="tool-log__marker w-full gap-2 py-1">
            <Marker.Icon>
              {#if row.kind === 'fs'}
                <FileIcon class="size-3.5" />
              {:else if row.kind === 'call'}
                <WrenchIcon class="size-3.5" />
              {:else if row.ok}
                <CheckIcon class="size-3.5" />
              {:else}
                <XIcon class="size-3.5" />
              {/if}
            </Marker.Icon>
            <Marker.Content class="tool-log__summary flex items-center justify-between" data-denied={row.denied ? 'true' : undefined}>
              <div class="flex items-baseline gap-2 overflow-hidden">
                <span class="tool-log__time">{formatTime(row.ts)}</span>
                <span class="tool-log__text truncate">{row.summary}</span>
              </div>
              {#if row.kind === 'fs' && row.snapshotId}
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground hover:bg-muted/80 ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] transition-colors"
                  title="Rollback to this snapshot"
                  onclick={() => void handleRollback(row.snapshotId!)}
                >
                  <UndoIcon class="size-2.5" />
                  <span>Revert</span>
                </button>
              {/if}
            </Marker.Content>
          </Marker.Root>
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
    list-style: none;
  }

  .tool-log__marker {
    border-color: color-mix(in oklch, var(--border) 70%, transparent);
  }

  .tool-log__summary {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem;
    align-items: baseline;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.6875rem;
    color: var(--muted-foreground);
  }

  .tool-log__summary[data-denied='true'] .tool-log__text {
    color: var(--destructive);
  }

  .tool-log__entry[data-kind='fs'] .tool-log__text {
    color: var(--color-primary);
  }

  .tool-log__entry[data-kind='call'] .tool-log__text {
    color: var(--foreground);
  }

  .tool-log__time {
    opacity: 0.65;
  }
</style>
