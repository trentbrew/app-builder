/**
 * Selector tests for the durable session log.
 *
 * Runs on Node's built-in test runner with native type stripping — no test
 * dependency, and no Dexie: the selectors are pure folds over an event list, so
 * they are tested without touching IndexedDB.
 *
 *     node --test src/lib/agent/session/events.test.ts
 *
 * The point of these is that every view (tool log, last-write badge, usage
 * total) is derived from one log, so a drift between views is not representable.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
	policyForKind,
	selectDurable,
	selectLastWrite,
	selectSessions,
	selectToolLog,
	selectTranscript,
	selectUsageTotals,
	sourceForKind,
	summarizeSessionEvent,
	type SessionEvent,
	type SessionEventRow,
} from './events.ts';

/** A small session: two writes and one denied write, framed by a turn. */
function sampleEvents(): SessionEvent[] {
	return [
		{ seq: 1, ts: 100, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 101, kind: 'user/message', turnId: 't1', text: 'make a card' },
		{ seq: 3, ts: 110, kind: 'tool/call', turnId: 't1', callId: 'c1', name: 'writeFile', args: { path: 'components/Card.svelte' } },
		{ seq: 4, ts: 111, kind: 'tool/result', turnId: 't1', callId: 'c1', ok: true, result: {} },
		{ seq: 5, ts: 112, kind: 'fs/observed', turnId: 't1', callId: 'c1', path: 'components/Card.svelte', op: 'write', snapshotId: 'snap-a' },
		{ seq: 6, ts: 120, kind: 'tool/call', turnId: 't1', callId: 'c2', name: 'writeFile', args: { path: 'package.json' } },
		{ seq: 7, ts: 121, kind: 'tool/result', turnId: 't1', callId: 'c2', ok: false, denied: true, error: 'outside writable set' },
		{ seq: 8, ts: 130, kind: 'tool/call', turnId: 't1', callId: 'c3', name: 'writeFile', args: { path: 'App.svelte' } },
		{ seq: 9, ts: 131, kind: 'tool/result', turnId: 't1', callId: 'c3', ok: true, result: {} },
		{ seq: 10, ts: 132, kind: 'fs/observed', turnId: 't1', callId: 'c3', path: 'App.svelte', op: 'write', snapshotId: 'snap-b' },
		{ seq: 11, ts: 140, kind: 'assistant/message', turnId: 't1', text: 'done', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } },
	];
}

test('selectToolLog projects only tool-plane events, in order', () => {
	const rows = selectToolLog(sampleEvents());
	// 3 calls + 3 results + 2 fs events = 8 rows; the turn/user/assistant events drop out.
	assert.equal(rows.length, 8);
	assert.deepEqual(
		rows.map((r) => r.kind),
		['call', 'result', 'fs', 'call', 'result', 'call', 'result', 'fs'],
	);
});

test('selectToolLog summarizes a call by its path arg', () => {
	const rows = selectToolLog(sampleEvents());
	assert.equal(rows[0].summary, 'writeFile(components/Card.svelte)');
});

test('selectToolLog marks a denied result distinctly from an error', () => {
	const denied = selectToolLog(sampleEvents()).find((r) => r.kind === 'result' && r.denied);
	assert.ok(denied, 'expected a denied result row');
	assert.equal(denied?.ok, false);
	assert.match(denied?.summary ?? '', /^denied:/);
});

test('selectLastWrite returns the most recent write, not the first', () => {
	const last = selectLastWrite(sampleEvents());
	assert.deepEqual(last, { path: 'App.svelte', ts: 132 });
});

test('selectLastWrite ignores denied calls (no fs/observed was emitted)', () => {
	// package.json was denied, so it never produced an fs/observed and cannot be
	// the last write even though it was the last *attempt*.
	const last = selectLastWrite(sampleEvents());
	assert.notEqual(last?.path, 'package.json');
});

test('selectLastWrite is null when nothing was written', () => {
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 2, kind: 'user/message', turnId: 't1', text: 'hi' },
	];
	assert.equal(selectLastWrite(events), null);
});

test('selectTranscript folds user and assistant messages in order, dropping tool events', () => {
	const events: SessionEvent[] = [
		...sampleEvents(),
		{ seq: 12, ts: 150, kind: 'user/message', turnId: 't2', text: 'and a button' },
		{ seq: 13, ts: 160, kind: 'assistant/message', turnId: 't2', stepId: 's9', text: 'added' },
	];
	const transcript = selectTranscript(events);
	assert.deepEqual(
		transcript.map((t) => [t.role, t.text]),
		[
			['user', 'make a card'],
			['assistant', 'done'],
			['user', 'and a button'],
			['assistant', 'added'],
		],
	);
});

test('selectTranscript is empty when the log has no messages yet', () => {
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 2, kind: 'tool/call', turnId: 't1', callId: 'c1', name: 'listFiles', args: {} },
	];
	assert.equal(selectTranscript(events).length, 0);
});

test('selectSessions groups rows by session, most-recently-active first', () => {
	const rows: SessionEventRow[] = [
		{ sessionId: 's-old', seq: 1, ts: 100, kind: 'turn/start', turnId: 't1' },
		{ sessionId: 's-old', seq: 2, ts: 110, kind: 'user/message', turnId: 't1', text: 'hi' },
		{ sessionId: 's-new', seq: 3, ts: 200, kind: 'turn/start', turnId: 't2' },
		{ sessionId: 's-new', seq: 4, ts: 210, kind: 'tool/call', turnId: 't2', callId: 'c1', name: 'writeFile', args: { path: 'App.svelte' } },
	];
	const sessions = selectSessions(rows);
	assert.equal(sessions.length, 2);
	// s-new is more recent (lastTs 210) so it sorts first.
	assert.equal(sessions[0].sessionId, 's-new');
	assert.equal(sessions[0].events, 2);
	assert.equal(sessions[0].lastTs, 210);
	assert.equal(sessions[0].lastLabel, 'tool·call');
	assert.equal(sessions[1].sessionId, 's-old');
	assert.equal(sessions[1].events, 2);
});

test('summarizeSessionEvent gives a label+detail per kind', () => {
	assert.deepEqual(
		summarizeSessionEvent({ seq: 1, ts: 1, kind: 'user/message', turnId: 't', text: 'make a\ncard' }),
		{ label: 'user', detail: 'make a card' },
	);
	assert.deepEqual(
		summarizeSessionEvent({ seq: 2, ts: 2, kind: 'tool/call', turnId: 't', callId: 'c', name: 'writeFile', args: { path: 'App.svelte' } }),
		{ label: 'tool·call', detail: 'writeFile(App.svelte)' },
	);
	assert.equal(
		summarizeSessionEvent({ seq: 3, ts: 3, kind: 'tool/result', turnId: 't', callId: 'c', ok: false, denied: true }).detail,
		'denied',
	);
	assert.equal(
		summarizeSessionEvent({ seq: 4, ts: 4, kind: 'fs/observed', turnId: 't', callId: 'c', path: 'App.svelte', op: 'write', snapshotId: 's' }).detail,
		'write App.svelte',
	);
});

test('sourceForKind maps the conversation surface to ui, runtime output to agent', () => {
	assert.equal(sourceForKind('turn/start'), 'ui');
	assert.equal(sourceForKind('user/message'), 'ui');
	assert.equal(sourceForKind('assistant/message'), 'ui');
	assert.equal(sourceForKind('assistant/chunk'), 'agent');
	assert.equal(sourceForKind('tool/call'), 'agent');
	assert.equal(sourceForKind('tool/result'), 'agent');
	assert.equal(sourceForKind('fs/observed'), 'agent');
});

test('policyForKind: streaming deltas and turn markers are realtime, the rest durable', () => {
	assert.equal(policyForKind('assistant/chunk'), 'realtime');
	assert.equal(policyForKind('turn/start'), 'realtime');
	assert.equal(policyForKind('user/message'), 'durable');
	assert.equal(policyForKind('assistant/message'), 'durable');
	assert.equal(policyForKind('tool/call'), 'durable');
	assert.equal(policyForKind('tool/result'), 'durable');
	assert.equal(policyForKind('fs/observed'), 'durable');
});

test('selectDurable is the authoritative sync surface — the record replays from it', () => {
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 2, kind: 'user/message', turnId: 't1', text: 'hi' },
		{ seq: 3, ts: 3, kind: 'assistant/chunk', turnId: 't1', delta: 'he' },
		{ seq: 4, ts: 4, kind: 'assistant/chunk', turnId: 't1', delta: 'llo' },
		{ seq: 5, ts: 5, kind: 'assistant/message', turnId: 't1', text: 'hello' },
	];
	// Drops the turn marker and both streaming deltas; keeps prompt + completion.
	assert.deepEqual(
		selectDurable(events).map((e) => e.kind),
		['user/message', 'assistant/message'],
	);
});

test('selectDurable honours an explicit policy over the kind default', () => {
	// A row that was stamped realtime stays out even if its kind would be durable.
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1, kind: 'user/message', turnId: 't1', text: 'hi', policy: 'realtime' },
	]
	assert.equal(selectDurable(events).length, 0);
});

test('selectUsageTotals folds usage across assistant messages', () => {
	const events = [
		...sampleEvents(),
		{ seq: 12, ts: 200, kind: 'assistant/message', turnId: 't2', text: 'more', usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } } as SessionEvent,
	];
	assert.deepEqual(selectUsageTotals(events), {
		inputTokens: 150,
		outputTokens: 30,
		totalTokens: 180,
	});
});
