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

test('allows the guest-writable set including root workspace files', () => {
	for (const path of [
		'test.txt',
		'README.md',
		'index.html',
		'main.js',
		'package.json',
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
		'test.txt',
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

test('denies protected directories', () => {
	for (const path of ['.git/config', '.sandboxes/state.json', 'node_modules/foo/index.js', 'lib/agent-sdk/index.ts']) {
		assert.equal(isGuestPathWritable(path), false, path);
	}
});

test('denies traversal that escapes the sandbox root', () => {
	for (const path of [
		'../../../etc/passwd',
		'components/../../../etc/passwd',
		'/components/../../.env',
		'components\\..\\..\\etc\\passwd',
	]) {
		assert.equal(isGuestPathWritable(path), false, path);
	}
});

test('denies traversal that lands on a denied directory inside the root', () => {
	assert.equal(normalizeGuestPath('src/../.git/config'), '.git/config');
	assert.equal(isGuestPathWritable('src/../.git/config'), false);
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
