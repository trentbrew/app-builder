/**
 * Session events — the durable, append-only record of one agent session.
 *
 * This is the *durable plane*. `harnessStore.toolLog` is the *live plane*: a
 * `slice(-200)` ring buffer for status UI that silently drops entries on a long
 * tool-heavy turn. That was fine while it was a status readout, and wrong the
 * moment it became the only record of what the agent did. A session event is
 * written once and never mutated; it survives reload; nothing truncates it.
 *
 * Every downstream view is a *fold* of this log, not a parallel store:
 *
 *   transcript      user/message + assistant/message
 *   tool log        tool/call + tool/result + fs/observed
 *   preview glow    last fs/observed.path
 *   undo chain      fs/observed.snapshotId
 *   telemetry       assistant/message.usage
 *
 * Keeping one source of truth is the whole point: three parallel stores drift;
 * one log with derived views cannot.
 *
 * This module is deliberately Dexie-free so its selectors run under
 * `node --test` with no IndexedDB shim. All I/O lives in `./log.ts`.
 */

export interface Usage {
	inputTokens?: number | null;
	outputTokens?: number | null;
	totalTokens?: number | null;
}

/**
 * One durable fact about a session.
 *
 * `seq` is a monotonic per-database key assigned by Dexie's `++seq` on insert;
 * within one session, ascending `seq` is the canonical order. `stepId` is
 * optional because the host-loop step driver that mints it is Phase 2 — a
 * client-executed tool today knows its turn and its call id but not yet which
 * model step emitted it, and a fabricated value would lie rather than admit the
 * gap.
 */
type SessionEventBase =
	| { seq: number; ts: number; kind: 'turn/start'; turnId: string }
	| { seq: number; ts: number; kind: 'user/message'; turnId: string; text: string }
	| {
			seq: number;
			ts: number;
			kind: 'assistant/chunk';
			turnId: string;
			stepId?: string;
			delta: string;
	  }
	| {
			seq: number;
			ts: number;
			kind: 'assistant/message';
			turnId: string;
			stepId?: string;
			text: string;
			usage?: Usage;
	  }
	| {
			seq: number;
			ts: number;
			kind: 'tool/call';
			turnId: string;
			stepId?: string;
			callId: string;
			name: string;
			args: unknown;
	  }
	| {
			seq: number;
			ts: number;
			kind: 'tool/result';
			turnId: string;
			stepId?: string;
			callId: string;
			ok: boolean;
			denied?: boolean;
			result?: unknown;
			error?: string;
	  }
	| {
			seq: number;
			ts: number;
			kind: 'fs/observed';
			turnId: string;
			callId: string;
			path: string;
			op: 'write' | 'delete';
			snapshotId: string | null;
	  };

export type SessionEventKind = SessionEventBase['kind'];

/**
 * Which producer emitted an event. A coarser axis than `kind`, adopted from
 * pi-sprite (`ui` / `rpc` / `bridge` / `run`) — `rpc` is renamed `agent` here
 * because app-builder's runtime is the ai-sdk loop, not a Pi RPC server. Lets
 * the trace view filter/colour by producer, and keeps the shared-core aligned
 * for the multiplex port.
 *
 * - `ui`     — the conversation surface: prompts, completed assistant turns.
 * - `agent`  — the runtime's raw telemetry: tool calls/results, token deltas.
 * - `bridge` — LLM transport traces (inference params, relay errors). Reserved.
 * - `run`    — run-envelope boundaries. Reserved (runs live server-side today).
 */
export type SessionEventSource = 'ui' | 'agent' | 'bridge' | 'run';

export const SESSION_EVENT_SOURCES: SessionEventSource[] = ['ui', 'agent', 'bridge', 'run'];

/**
 * Durability tier, adopted from pi-sprite's `syncPolicy`. Splits state by how
 * long it must live, not by what produced it:
 *
 * - `durable`  — authoritative inputs; replaying them reconstructs the session.
 *                The ONLY tier a sync backend (Trellis) ever needs, and the tier
 *                a retention bound must keep.
 * - `realtime` — in-flight progress (token deltas, turn markers). Local-only,
 *                safe to prune, never synced.
 * - `derived`  — recomputable from the durable tier (transcript, tool log, stats).
 *                Never stored — the selectors in this file *are* this tier.
 */
export type SyncPolicy = 'durable' | 'realtime' | 'derived';

/**
 * A session event as stored/read: the typed body plus the log-stamped envelope.
 * `source` and `policy` are optional on the type because rows written before
 * this field existed lack them — the log backfills both from `kind` on read, so
 * at runtime they are always present.
 */
export type SessionEvent = SessionEventBase & {
	source?: SessionEventSource;
	policy?: SyncPolicy;
};

/**
 * What a caller supplies to append. `seq`/`ts` are assigned by the log and
 * `source`/`policy` are stamped from `kind` — the caller supplies neither, so a
 * replayed or duplicated append cannot forge ordering or durability.
 */
export type SessionEventInput = DistributiveOmit<SessionEventBase, 'seq' | 'ts'>;

/** As stored: a session event plus the session it belongs to. */
export type SessionEventRow = SessionEvent & { sessionId: string };

/** `Omit` that distributes over a union, so each member keeps its own shape. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * The producer of an event, by kind. `ui` is the rendered conversation
 * (prompts + completed turns + the turn marker); `agent` is the runtime's raw
 * output (tool activity, streaming deltas, and the filesystem effects it causes).
 */
export function sourceForKind(kind: SessionEventKind): SessionEventSource {
	switch (kind) {
		case 'turn/start':
		case 'user/message':
		case 'assistant/message':
			return 'ui';
		case 'assistant/chunk':
		case 'tool/call':
		case 'tool/result':
		case 'fs/observed':
			return 'agent';
	}
}

/**
 * The durability tier of an event, by kind. Streaming deltas and turn markers
 * are `realtime` (in-flight, recomputable, prunable); everything else is
 * `durable` (the authoritative record that reconstructs and syncs the session).
 * No kind is `derived` — derived state is produced by the selectors, never stored.
 */
export function policyForKind(kind: SessionEventKind): SyncPolicy {
	switch (kind) {
		case 'assistant/chunk':
		case 'turn/start':
			return 'realtime';
		default:
			return 'durable';
	}
}

/**
 * The sync surface: the authoritative subset a peer or backend (Trellis) needs.
 * Everything else is in-flight progress or recomputable downstream.
 */
export function selectDurable(events: SessionEvent[]): SessionEvent[] {
	return events.filter((event) => (event.policy ?? policyForKind(event.kind)) === 'durable');
}

// ---- selectors: pure folds over an ordered event list ----------------------

/** A projected tool-activity row, shaped for the tool-log view. */
export interface ToolLogRow {
	seq: number;
	ts: number;
	callId: string;
	name?: string;
	kind: 'call' | 'result' | 'fs';
	summary: string;
	path?: string;
	ok?: boolean;
	denied?: boolean;
	snapshotId?: string | null;
}

/**
 * Project the tool plane out of a session's events, in order.
 *
 * Reads `tool/call`, `tool/result`, and `fs/observed` and leaves the rest
 * alone. This is what the tool-log view should render instead of the lossy live
 * buffer: it is complete by construction.
 */
export function selectToolLog(events: SessionEvent[]): ToolLogRow[] {
	const rows: ToolLogRow[] = [];
	for (const e of events) {
		if (e.kind === 'tool/call') {
			rows.push({
				seq: e.seq,
				ts: e.ts,
				callId: e.callId,
				name: e.name,
				kind: 'call',
				summary: `${e.name}(${summarizeArgs(e.args)})`,
			});
		} else if (e.kind === 'tool/result') {
			rows.push({
				seq: e.seq,
				ts: e.ts,
				callId: e.callId,
				kind: 'result',
				ok: e.ok,
				denied: e.denied,
				summary: e.ok ? 'ok' : e.denied ? `denied: ${e.error ?? ''}` : `error: ${e.error ?? ''}`,
			});
		} else if (e.kind === 'fs/observed') {
			rows.push({
				seq: e.seq,
				ts: e.ts,
				callId: e.callId,
				kind: 'fs',
				path: e.path,
				snapshotId: e.snapshotId,
				summary: `${e.op} ${e.path}`,
			});
		}
	}
	return rows;
}

/** One turn-ordered line of the conversation, folded from the log. */
export interface TranscriptEntry {
	seq: number;
	ts: number;
	turnId: string;
	role: 'user' | 'assistant';
	text: string;
}

/**
 * Fold the user/assistant messages into an ordered transcript.
 *
 * This is what makes the log a *complete* record: with the assistant plane
 * captured (Phase 2), the whole conversation reconstructs from one list — the
 * basis for resume and fork, and for reading a session back without ai-sdk's
 * in-memory `Chat.messages`. Streaming deltas stay in the live plane; this folds
 * the coalesced messages the turn actually produced.
 */
export function selectTranscript(events: SessionEvent[]): TranscriptEntry[] {
	const out: TranscriptEntry[] = [];
	for (const e of events) {
		if (e.kind === 'user/message') {
			out.push({ seq: e.seq, ts: e.ts, turnId: e.turnId, role: 'user', text: e.text });
		} else if (e.kind === 'assistant/message') {
			out.push({ seq: e.seq, ts: e.ts, turnId: e.turnId, role: 'assistant', text: e.text });
		}
	}
	return out;
}

/** The most recent file the agent wrote, for the preview-glow / last-write badge. */
export function selectLastWrite(events: SessionEvent[]): { path: string; ts: number } | null {
	for (let i = events.length - 1; i >= 0; i -= 1) {
		const e = events[i];
		if (e.kind === 'fs/observed' && e.op === 'write') return { path: e.path, ts: e.ts };
	}
	return null;
}

/** Fold token usage across every completed assistant message in the session. */
export function selectUsageTotals(events: SessionEvent[]): Required<Usage> {
	const totals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
	for (const e of events) {
		if (e.kind !== 'assistant/message' || !e.usage) continue;
		totals.inputTokens += e.usage.inputTokens ?? 0;
		totals.outputTokens += e.usage.outputTokens ?? 0;
		totals.totalTokens += e.usage.totalTokens ?? 0;
	}
	return totals;
}

function summarizeArgs(args: unknown): string {
	if (args && typeof args === 'object' && 'path' in args) {
		return String((args as { path: unknown }).path ?? '');
	}
	return '';
}

// ---- inspector selectors: cross-session views over stored rows -------------

/** One row of the sessions list in the agent inspector. */
export interface SessionSummary {
	sessionId: string;
	events: number;
	firstTs: number;
	lastTs: number;
	/** Compact label of the most recent event, for the list preview. */
	lastLabel: string;
}

/**
 * Group stored rows into per-session summaries, most-recently-active first.
 *
 * Operates on `SessionEventRow[]` (the stored shape, which carries `sessionId`)
 * because grouping is the one place the partition key matters — everywhere else
 * works on the pure `SessionEvent`.
 */
export function selectSessions(rows: SessionEventRow[]): SessionSummary[] {
	const byId = new Map<string, SessionSummary>();
	for (const row of rows) {
		const existing = byId.get(row.sessionId);
		const label = summarizeSessionEvent(row).label;
		if (!existing) {
			byId.set(row.sessionId, {
				sessionId: row.sessionId,
				events: 1,
				firstTs: row.ts,
				lastTs: row.ts,
				lastLabel: label,
			});
			continue;
		}
		existing.events += 1;
		// Rows arrive in `seq` order, so the last one seen is the most recent.
		existing.lastTs = row.ts;
		existing.lastLabel = label;
	}
	return [...byId.values()].sort((a, b) => b.lastTs - a.lastTs);
}

/** A compact label + detail for one event, for the inspector trace list. */
export function summarizeSessionEvent(event: SessionEvent): { label: string; detail: string } {
	switch (event.kind) {
		case 'turn/start':
			return { label: 'turn', detail: shortId(event.turnId) };
		case 'user/message':
			return { label: 'user', detail: truncate(event.text) };
		case 'assistant/chunk':
			return { label: 'chunk', detail: truncate(event.delta) };
		case 'assistant/message':
			return { label: 'assistant', detail: truncate(event.text) };
		case 'tool/call':
			return { label: 'tool·call', detail: `${event.name}(${summarizeArgs(event.args)})` };
		case 'tool/result':
			return {
				label: 'tool·result',
				detail: event.ok ? 'ok' : event.denied ? 'denied' : `error: ${event.error ?? ''}`,
			};
		case 'fs/observed':
			return { label: 'fs', detail: `${event.op} ${event.path}` };
	}
}

function truncate(text: string, max = 80): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function shortId(id: string): string {
	return id.length > 8 ? id.slice(0, 8) : id;
}
