/**
 * Session-event log — the durable-plane I/O.
 *
 * Append-only: `appendSessionEvent` inserts, nothing ever updates a row. `seq`
 * and `ts` are assigned here, not by the caller, so ordering cannot be forged
 * by a replay. Reads come back sorted by `seq`, which is the canonical order.
 *
 * Best-effort, never fatal: a Dexie failure here must not crash the agent loop.
 * The live plane (`harnessStore.toolLog`) already shows the user what happened;
 * a dropped *durable* write is logged and swallowed so the turn still closes.
 * The trade is deliberate — completeness is the goal, but not at the cost of
 * taking the running turn down with it.
 *
 * Pure domain types and selectors live in `./events.ts` (Dexie-free, so they
 * run under `node --test`). This file is the only thing that touches the DB.
 */
import { browser } from '$app/environment';
import { liveQuery, type Observable } from 'dexie';
import { getSessionEventsTable } from '$lib/webcontainerSnapshot';
import {
	policyForKind,
	sourceForKind,
	type SessionEvent,
	type SessionEventInput,
	type SessionEventRow,
} from './events';

/**
 * Append one event to a session's durable log.
 *
 * Returns the stored row (with its assigned `seq`) or `null` if the write could
 * not be persisted — the caller treats `null` as "not durably recorded" and
 * carries on; it never throws into the loop.
 */
export async function appendSessionEvent(
	sessionId: string,
	input: SessionEventInput,
): Promise<SessionEventRow | null> {
	if (!browser) return null;

	// `seq` is filled by Dexie's `++seq` on insert; we pass the row without it.
	// `source` and `policy` are stamped from `kind` here (never from the caller),
	// so the durability tier and producer are authoritative and consistent.
	const row = {
		...input,
		ts: Date.now(),
		sessionId,
		source: sourceForKind(input.kind),
		policy: policyForKind(input.kind),
	} as Omit<SessionEventRow, 'seq'>;

	try {
		const seq = (await getSessionEventsTable().add(row as SessionEventRow)) as number;
		return { ...(row as SessionEventRow), seq };
	} catch (error) {
		console.warn('Failed to append session event:', error);
		return null;
	}
}

/** Read a session's events in canonical (`seq`-ascending) order. */
export async function readSessionEvents(sessionId: string): Promise<SessionEvent[]> {
	if (!browser) return [];

	try {
		const rows = await getSessionEventsTable().where('sessionId').equals(sessionId).sortBy('seq');
		return rows.map(stripSessionId);
	} catch (error) {
		console.warn('Failed to read session events:', error);
		return [];
	}
}

/**
 * A live view of a session's events that re-emits whenever the log changes.
 *
 * Dexie's `liveQuery` re-runs the read on any write to the table and pushes the
 * new result to subscribers — so a tool-log view built on this is *always* the
 * complete durable record, never the truncated live buffer. Browser-only;
 * `liveQuery` needs IndexedDB.
 */
export function observeSessionEvents(sessionId: string): Observable<SessionEvent[]> {
	return liveQuery(async () => {
		const rows = await getSessionEventsTable().where('sessionId').equals(sessionId).sortBy('seq');
		return rows.map(stripSessionId);
	});
}

/**
 * A live view of *every* session's rows, ordered by `seq`, for the cross-session
 * agent inspector. Keeps `sessionId` on the row so the inspector can group by it
 * (via `selectSessions`); per-session views strip it.
 */
export function observeAllSessionEvents(): Observable<SessionEventRow[]> {
	return liveQuery(() => getSessionEventsTable().orderBy('seq').toArray());
}

/**
 * Drop the storage-only `sessionId` and backfill the envelope: rows written
 * before `source`/`policy` existed get both derived from `kind` on read, so
 * every event a reader sees carries a producer and a durability tier.
 */
function stripSessionId({ sessionId: _sessionId, ...event }: SessionEventRow): SessionEvent {
	return {
		...event,
		source: event.source ?? sourceForKind(event.kind),
		policy: event.policy ?? policyForKind(event.kind),
	} as SessionEvent;
}

/** Remove every event for a session. Used when a session is deleted or reset. */
export async function clearSessionEvents(sessionId: string): Promise<void> {
	if (!browser) return;

	try {
		await getSessionEventsTable().where('sessionId').equals(sessionId).delete();
	} catch (error) {
		console.warn('Failed to clear session events:', error);
	}
}
