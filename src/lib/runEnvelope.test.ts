/**
 * Tests for the run-manifest aggregator that feeds the agent inspector.
 *
 *     node --test src/lib/runEnvelope.test.ts
 *
 * The one rule worth pinning: cost stays `null` until a run actually reports a
 * number, so a session of local (free) runs reads as "not measured", not
 * "measured $0". Averaging a synthetic zero is exactly the bias the metric's
 * own comment warns about.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { aggregateRunsBySession, type RunRecord } from './runEnvelope.ts';

function run(partial: {
	sessionId: string;
	turnId?: string;
	outcome?: RunRecord['outcome'];
	endedAt?: number;
	input?: number | null;
	output?: number | null;
	reasoning?: number | null;
	total?: number | null;
	cost?: number | null;
}): RunRecord {
	return {
		runId: crypto.randomUUID(),
		sessionId: partial.sessionId,
		variant: 'baseline',
		turnId: partial.turnId,
		buildId: 'test',
		startedAt: 0,
		endedAt: partial.endedAt ?? 0,
		promptChars: 0,
		config: {
			model: 'm',
			provider: 'ollama',
			thinking: false,
			systemPromptChars: 0,
			systemPromptHash: '0',
			messageCount: 0,
		},
		outcome: partial.outcome ?? 'success',
		finishReason: null,
		metrics: {
			durationMs: 0,
			ttftMs: null,
			steps: 0,
			toolCalls: 0,
			inputTokens: partial.input ?? null,
			outputTokens: partial.output ?? null,
			reasoningTokens: partial.reasoning ?? null,
			totalTokens: partial.total ?? null,
			costUsd: partial.cost ?? null,
		},
	};
}

test('aggregates tokens and counts distinct turns per session', () => {
	const stats = aggregateRunsBySession([
		run({ sessionId: 's1', turnId: 't1', input: 100, output: 20, total: 120, endedAt: 1 }),
		run({ sessionId: 's1', turnId: 't1', input: 50, output: 10, total: 60, endedAt: 2 }),
		run({ sessionId: 's1', turnId: 't2', input: 30, output: 5, total: 35, endedAt: 3 }),
	]);
	assert.equal(stats.length, 1);
	assert.equal(stats[0].runs, 3);
	assert.equal(stats[0].turns, 2); // t1 and t2
	assert.equal(stats[0].inputTokens, 180);
	assert.equal(stats[0].totalTokens, 215);
});

test('cost stays null when no run reported a number', () => {
	const stats = aggregateRunsBySession([
		run({ sessionId: 's1', total: 10 }),
		run({ sessionId: 's1', total: 20 }),
	]);
	assert.equal(stats[0].costUsd, null);
});

test('cost sums only the runs that reported one', () => {
	const stats = aggregateRunsBySession([
		run({ sessionId: 's1', cost: null }),
		run({ sessionId: 's1', cost: 0.002 }),
		run({ sessionId: 's1', cost: 0.003 }),
	]);
	assert.ok(stats[0].costUsd !== null);
	assert.ok(Math.abs((stats[0].costUsd ?? 0) - 0.005) < 1e-9);
});

test('counts error outcomes and orders sessions by most recent run', () => {
	const stats = aggregateRunsBySession([
		run({ sessionId: 'older', endedAt: 100 }),
		run({ sessionId: 'newer', endedAt: 200, outcome: 'error' }),
	]);
	assert.equal(stats[0].sessionId, 'newer');
	assert.equal(stats[0].errors, 1);
	assert.equal(stats[1].sessionId, 'older');
});

test('runs with no sessionId are ignored', () => {
	const stats = aggregateRunsBySession([run({ sessionId: '', total: 100 })]);
	assert.equal(stats.length, 0);
});
