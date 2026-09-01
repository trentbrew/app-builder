/**
 * Tests for the trace waterfall layout.
 *
 *     node --test src/lib/agent/session/traceWaterfall.test.ts
 *
 * Pinned behaviours: tool spans get real durations from call→result pairing; an
 * unfinished call extends to the tail only when live; a past turn does not grow
 * to "now" just because it lacks an assistant/message.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildWaterfall, formatTraceDuration } from './traceWaterfall.ts';
import type { SessionEvent } from './events.ts';

function turnEvents(): SessionEvent[] {
	return [
		{ seq: 1, ts: 1000, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 1010, kind: 'user/message', turnId: 't1', text: 'make a card' },
		{ seq: 3, ts: 1100, kind: 'tool/call', turnId: 't1', callId: 'c1', name: 'writeFile', args: { path: 'App.svelte' } },
		{ seq: 4, ts: 1350, kind: 'tool/result', turnId: 't1', callId: 'c1', ok: true },
		{ seq: 5, ts: 1360, kind: 'fs/observed', turnId: 't1', callId: 'c1', path: 'App.svelte', op: 'write', snapshotId: 's1' },
		{ seq: 6, ts: 1500, kind: 'assistant/message', turnId: 't1', text: 'done' },
	];
}

test('a tool span gets its duration from call→result pairing', () => {
	const { spans } = buildWaterfall(turnEvents());
	const tool = spans.find((s) => s.id === 'call:c1');
	assert.ok(tool);
	assert.equal(tool?.semantic, 'tool');
	assert.equal(tool?.ok, true);
	assert.equal(tool?.durationMs, 250); // 1350 - 1100
	assert.equal(tool?.depth, 1);
	assert.equal(tool?.detail, 'App.svelte'); // fs/observed enriched the call
});

test('the turn span covers start to its last event', () => {
	const { spans } = buildWaterfall(turnEvents());
	const turn = spans.find((s) => s.id === 'turn:t1');
	assert.ok(turn);
	assert.equal(turn?.startMs, 0);
	assert.equal(turn?.durationMs, 500); // 1500 - 1000
	assert.equal(turn?.active, false);
});

test('a denied call is a distinct semantic', () => {
	const events: SessionEvent[] = [
		{ seq: 1, ts: 0, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 10, kind: 'tool/call', turnId: 't1', callId: 'c1', name: 'writeFile', args: {} },
		{ seq: 3, ts: 20, kind: 'tool/result', turnId: 't1', callId: 'c1', ok: false, denied: true },
	];
	const tool = buildWaterfall(events).spans.find((s) => s.id === 'call:c1');
	assert.equal(tool?.semantic, 'tool-denied');
	assert.equal(tool?.ok, false);
});

test('an unfinished call extends to the tail and is active only when live', () => {
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1000, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 1100, kind: 'tool/call', turnId: 't1', callId: 'c1', name: 'writeFile', args: {} },
	];
	const live = buildWaterfall(events, { live: true, now: 2000 });
	const liveTool = live.spans.find((s) => s.id === 'call:c1');
	assert.equal(liveTool?.active, true);
	assert.equal(liveTool?.durationMs, 900); // 2000 - 1100

	const still = buildWaterfall(events, { live: false });
	const stillTool = still.spans.find((s) => s.id === 'call:c1');
	assert.equal(stillTool?.active, false);
});

test('a past turn does not grow to now just because it lacks an assistant/message', () => {
	// t1 has no assistant/message but is NOT the last turn → it must not extend.
	const events: SessionEvent[] = [
		{ seq: 1, ts: 1000, kind: 'turn/start', turnId: 't1' },
		{ seq: 2, ts: 1050, kind: 'user/message', turnId: 't1', text: 'a' },
		{ seq: 3, ts: 2000, kind: 'turn/start', turnId: 't2' },
	];
	const turn1 = buildWaterfall(events, { live: true, now: 9999 }).spans.find((s) => s.id === 'turn:t1');
	assert.equal(turn1?.durationMs, 50); // 1050 - 1000, not 9999 - 1000
	assert.equal(turn1?.active, false);
});

test('empty input yields no spans', () => {
	assert.deepEqual(buildWaterfall([]), { spans: [], totalMs: 0 });
});

test('formatTraceDuration scales units', () => {
	assert.equal(formatTraceDuration(0.5), '<1ms');
	assert.equal(formatTraceDuration(250), '250ms');
	assert.equal(formatTraceDuration(1500), '1.50s');
	assert.equal(formatTraceDuration(42_000), '42.0s');
});
