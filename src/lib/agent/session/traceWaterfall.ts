/**
 * Waterfall layout for a session's trace — a pure fold from `SessionEvent[]` to
 * positioned spans, framework- and style-agnostic (a shared-core candidate).
 *
 * Adapted from pi-sprite's `traceWaterfall`, but simpler and more robust because
 * app-builder's log pairs cleanly: `tool/call` → `tool/result` by `callId` is an
 * exact tool span, and `turnId` groups a turn span — no stack discipline over a
 * flat RPC stream. Unlike pi-sprite, this returns a `semantic` per span and
 * leaves colour to the view, so the logic carries no Tailwind.
 */
import type { SessionEvent } from './events';

export type TraceSemantic = 'turn' | 'tool' | 'tool-denied' | 'fs' | 'meta';

export interface WaterfallSpan {
	id: string;
	label: string;
	semantic: TraceSemantic;
	/** Offset from the trace origin, in ms. */
	startMs: number;
	durationMs: number;
	/** 0 = turn, 1 = tool/fs within a turn. */
	depth: number;
	detail?: string;
	/** Still open (no end observed) at layout time. */
	active: boolean;
	/** For tool spans: did the call succeed. */
	ok?: boolean;
}

export function formatTraceDuration(ms: number): string {
	if (ms < 1) return '<1ms';
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 10_000) return `${(ms / 1000).toFixed(2)}s`;
	return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Build the waterfall.
 *
 * A turn span runs from its `turn/start` (or first event) to its last event; the
 * *currently running* turn extends to the tail when `live`. A tool span runs
 * `tool/call` → `tool/result`; a call with no result yet extends to the tail and
 * is marked `active`. `fs/observed` is a point marker inside its call's depth.
 *
 * `now` is injectable so the layout is deterministic under test.
 */
export function buildWaterfall(
	events: SessionEvent[],
	opts: { live?: boolean; now?: number } = {},
): { spans: WaterfallSpan[]; totalMs: number } {
	if (events.length === 0) return { spans: [], totalMs: 0 };

	const origin = events[0].ts;
	const lastTs = events[events.length - 1].ts;
	const lastTurnId = events[events.length - 1].turnId;
	const now = opts.now ?? Date.now();
	const tail = opts.live ? Math.max(now, lastTs) : lastTs;

	type Turn = { start: number; last: number; closed: boolean };
	type Call = { start: number; name: string; end?: number; ok?: boolean; denied?: boolean; path?: string };

	const turns = new Map<string, Turn>();
	const calls = new Map<string, Call>();
	const fsMarkers: { seq: number; ts: number; path: string }[] = [];

	for (const e of events) {
		const turn = turns.get(e.turnId) ?? { start: e.ts, last: e.ts, closed: false };
		if (e.kind === 'turn/start') turn.start = e.ts;
		turn.last = Math.max(turn.last, e.ts);
		if (e.kind === 'assistant/message') turn.closed = true;
		turns.set(e.turnId, turn);

		if (e.kind === 'tool/call') {
			calls.set(e.callId, { start: e.ts, name: e.name });
		} else if (e.kind === 'tool/result') {
			const call = calls.get(e.callId);
			if (call) {
				call.end = e.ts;
				call.ok = e.ok;
				call.denied = e.denied;
			}
		} else if (e.kind === 'fs/observed') {
			const call = calls.get(e.callId);
			if (call) call.path = e.path;
			fsMarkers.push({ seq: e.seq, ts: e.ts, path: e.path });
		}
	}

	const spans: WaterfallSpan[] = [];

	for (const [turnId, turn] of turns) {
		// Only the most recent turn can still be running; a past turn without an
		// assistant/message just ended at its last event, not at "now".
		const open = !turn.closed && Boolean(opts.live) && turnId === lastTurnId;
		const end = open ? tail : turn.last;
		spans.push({
			id: `turn:${turnId}`,
			label: 'turn',
			semantic: 'turn',
			startMs: turn.start - origin,
			durationMs: Math.max(end - turn.start, 3),
			depth: 0,
			active: open,
		});
	}

	for (const [callId, call] of calls) {
		const open = call.end === undefined;
		const end = call.end ?? tail;
		spans.push({
			id: `call:${callId}`,
			label: call.name,
			semantic: call.denied ? 'tool-denied' : 'tool',
			startMs: call.start - origin,
			durationMs: Math.max(end - call.start, 3),
			depth: 1,
			active: open && Boolean(opts.live),
			ok: call.ok,
			detail: call.path,
		});
	}

	for (const marker of fsMarkers) {
		spans.push({
			id: `fs:${marker.seq}`,
			label: 'write',
			semantic: 'fs',
			startMs: marker.ts - origin,
			durationMs: 3,
			depth: 1,
			active: false,
			detail: marker.path,
		});
	}

	const totalMs = Math.max(120, tail - origin, ...spans.map((s) => s.startMs + s.durationMs));
	return {
		spans: spans.sort((a, b) => a.startMs - b.startMs || a.depth - b.depth),
		totalMs,
	};
}
