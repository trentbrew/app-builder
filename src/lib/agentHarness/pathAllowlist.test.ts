/**
 * Regression tests for the guest write guard.
 *
 * Runs on Node's built-in test runner with native type stripping — no test
 * dependency required:
 *
 *     node --test src/lib/agentHarness/pathAllowlist.test.ts
 *
 * The traversal cases exist because they were a live hole: `^components/`
 * matched `components/../../../etc/passwd` before `..` was resolved. That was
 * harmless while paths came from `editComponent.ts` (human-chosen and fixed),
 * and became exploitable the moment the agent tool pipeline let a model choose
 * the path. Do not relax `normalizeGuestPath` without re-reading these.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isGuestPathReadable, isGuestPathWritable, normalizeGuestPath } from './pathAllowlist.ts';

test('allows the guest-writable set', () => {
	for (const path of [
		'App.svelte',
		'agent.manifest.json',
		'components/Card.svelte',
		'src/counter-app.ts',
		'app/page.tsx',
		'lib/utils.ts',
		'styles/global.css',
	]) {
		assert.equal(isGuestPathWritable(path), true, path);
	}
});

test('allows reading any sandbox workspace file', () => {
	for (const path of [
		'package.json',
		'index.html',
		'vite.config.js',
		'src/counter-app.ts',
		'App.svelte',
		'lib/agent-sdk/index.ts',
	]) {
		assert.equal(isGuestPathReadable(path), true, path);
	}
});

test('denies reading outside sandbox or hidden system files', () => {
	for (const path of ['../../../etc/passwd', '.git/config', '.sandboxes/secret', '']) {
		assert.equal(isGuestPathReadable(path), false, path);
	}
});

test('denies project configuration files', () => {
	for (const path of ['package.json', 'vite.config.js', 'svelte.config.js', 'index.html', 'main.js']) {
		assert.equal(isGuestPathWritable(path), false, path);
	}
});

test('denies traversal that escapes the sandbox root', () => {
	for (const path of [
		'../../../etc/passwd',
		'components/../../../etc/passwd',
		'components/../../vite.config.js',
		'/components/../../.env',
		'components\\..\\..\\vite.config.js', // backslash separators
	]) {
		assert.equal(isGuestPathWritable(path), false, path);
	}
});

test('denies traversal that lands on a denied file inside the root', () => {
	// Resolves to `package.json`, which the deny list rejects on its own.
	assert.equal(normalizeGuestPath('components/../package.json'), 'package.json');
	assert.equal(isGuestPathWritable('components/../package.json'), false);
});

test('normalizes redundant segments without rejecting them', () => {
	assert.equal(normalizeGuestPath('./components/Card.svelte'), 'components/Card.svelte');
	assert.equal(normalizeGuestPath('components//Nested/../Card.svelte'), 'components/Card.svelte');
	assert.equal(isGuestPathWritable('./components/Card.svelte'), true);
});

test('rejects the empty path', () => {
	assert.equal(isGuestPathWritable(''), false);
	assert.equal(isGuestPathWritable('/'), false);
});
