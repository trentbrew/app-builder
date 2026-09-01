/**
 * Tests for inference-param sanitizing.
 *
 *     node --test src/lib/agent/inference/params.test.ts
 *
 * These matter because the params arrive in a request body: the rule is that no
 * client-supplied number reaches the model unbounded, and a malformed field
 * falls back rather than throwing.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
	DEFAULT_INFERENCE,
	parseStopSequences,
	sanitizeInferenceParams,
	thinkingToOllama,
} from './params.ts';

test('valid params pass through unchanged', () => {
	const input = { temperature: 0.4, topP: 0.8, maxTokens: 2048, stopSequences: '###', thinkingLevel: 'high' };
	assert.deepEqual(sanitizeInferenceParams(input), input);
});

test('out-of-range numbers clamp, not throw', () => {
	const p = sanitizeInferenceParams({ temperature: 9, topP: -1, maxTokens: 10_000_000 });
	assert.equal(p.temperature, 2);
	assert.equal(p.topP, 0);
	assert.equal(p.maxTokens, 32_768);
});

test('malformed fields fall back to defaults', () => {
	const p = sanitizeInferenceParams({ temperature: 'hot', topP: null, maxTokens: NaN, thinkingLevel: 'ludicrous' });
	assert.equal(p.temperature, DEFAULT_INFERENCE.temperature);
	assert.equal(p.topP, DEFAULT_INFERENCE.topP);
	assert.equal(p.maxTokens, DEFAULT_INFERENCE.maxTokens);
	assert.equal(p.thinkingLevel, DEFAULT_INFERENCE.thinkingLevel);
});

test('maxTokens is truncated to an integer', () => {
	assert.equal(sanitizeInferenceParams({ maxTokens: 100.9 }).maxTokens, 100);
});

test('empty / missing input yields the full default set', () => {
	assert.deepEqual(sanitizeInferenceParams(undefined), DEFAULT_INFERENCE);
	assert.deepEqual(sanitizeInferenceParams({}), DEFAULT_INFERENCE);
});

test('parseStopSequences splits on comma and newline, trims, drops empties', () => {
	assert.deepEqual(parseStopSequences('a, b\n c ,,'), ['a', 'b', 'c']);
	assert.deepEqual(parseStopSequences(''), []);
});

test('thinkingToOllama maps levels to the adapter contract', () => {
	assert.equal(thinkingToOllama('off'), false);
	assert.equal(thinkingToOllama('minimal'), 'low');
	assert.equal(thinkingToOllama('low'), 'low');
	assert.equal(thinkingToOllama('medium'), 'medium');
	assert.equal(thinkingToOllama('high'), 'high');
});
