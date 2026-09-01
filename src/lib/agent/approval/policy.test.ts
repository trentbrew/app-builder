/**
 * Approval policy tests — the fail-closed matrix.
 *
 *     node --test src/lib/agent/approval/policy.test.ts
 *
 * These exist because this is the security-relevant half of the approval seam:
 * the rule that anything not an explicit allow ends as a deny, and that "allow
 * all" cannot outlive the turn that granted it. The runes store around this is
 * plumbing; the decisions are here, and here is where a regression would bite.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
	decisionForResolution,
	immediateDecision,
	precheckApproval,
	summarizeWrite,
} from './policy.ts';

test('auto-allow mode never prompts', () => {
	const check = precheckApproval({
		mode: 'auto-allow',
		reqTurnId: 't1',
		allowAllTurnId: null,
		hasPending: false,
	});
	assert.equal(check, 'auto-allow');
	assert.equal(immediateDecision(check), 'allow');
});

test('a standing allow-all covers the same turn', () => {
	const check = precheckApproval({
		mode: 'prompt',
		reqTurnId: 't1',
		allowAllTurnId: 't1',
		hasPending: false,
	});
	assert.equal(check, 'auto-allow-turn');
	assert.equal(immediateDecision(check), 'allow');
});

test('allow-all from a previous turn does NOT carry over', () => {
	// The grant was for t1; the request is in t2. It must prompt, not auto-allow.
	const check = precheckApproval({
		mode: 'prompt',
		reqTurnId: 't2',
		allowAllTurnId: 't1',
		hasPending: false,
	});
	assert.equal(check, 'prompt');
	assert.equal(immediateDecision(check), null);
});

test('a request while a prompt is already pending fails closed', () => {
	const check = precheckApproval({
		mode: 'prompt',
		reqTurnId: 't1',
		allowAllTurnId: null,
		hasPending: true,
	});
	assert.equal(check, 'deny-busy');
	assert.equal(immediateDecision(check), 'deny');
});

test('the default path prompts and waits', () => {
	const check = precheckApproval({
		mode: 'prompt',
		reqTurnId: 't1',
		allowAllTurnId: null,
		hasPending: false,
	});
	assert.equal(check, 'prompt');
	assert.equal(immediateDecision(check), null);
});

test('a null allow-all never matches, even against a request with no turn framing', () => {
	// Guards the `!== null` check: two nulls must not read as "same turn".
	const check = precheckApproval({
		mode: 'prompt',
		reqTurnId: '',
		allowAllTurnId: null,
		hasPending: false,
	});
	assert.equal(check, 'prompt');
});

test('decisionForResolution: only an explicit deny denies', () => {
	assert.equal(decisionForResolution('allow'), 'allow');
	assert.equal(decisionForResolution('allow-all'), 'allow');
	assert.equal(decisionForResolution('deny'), 'deny');
});

test('summarizeWrite counts lines and pluralizes', () => {
	assert.equal(summarizeWrite(''), '+0 lines');
	assert.equal(summarizeWrite('one line'), '+1 line');
	assert.equal(summarizeWrite('a\nb\nc'), '+3 lines');
});
