/**
 * Approval store — the live plane for the approval seam.
 *
 * State here is ephemeral by design: a single outstanding prompt and a
 * per-turn "allow all" flag, neither of which survives reload. The durable
 * record of an approval outcome is the `tool/result` the pipeline logs — this
 * store only mediates the human decision.
 *
 * The security matrix lives in `./policy.ts` (pure, tested). This file is the
 * runes + promise plumbing around it.
 */
import { browser } from '$app/environment';
import {
	decisionForResolution,
	immediateDecision,
	precheckApproval,
	type ApprovalDecision,
	type ApprovalMode,
	type ApprovalResolution,
} from './policy';

export interface ApprovalRequest {
	id: string;
	turnId: string;
	tool: string;
	path: string;
	/** Short human summary of the effect, e.g. "+34 lines". */
	summary: string;
}

const MODE_KEY = 'app-builder:approval-mode:v1';

function loadMode(): ApprovalMode {
	if (!browser) return 'prompt';
	try {
		return localStorage.getItem(MODE_KEY) === 'auto-allow' ? 'auto-allow' : 'prompt';
	} catch {
		return 'prompt';
	}
}

/** Live plane: the prompt the UI renders, and the current approval mode. */
export const approvalState = $state({
	pending: null as ApprovalRequest | null,
	mode: loadMode(),
});

// Not reactive UI state — internal coordination for the outstanding promise and
// the standing per-turn grant.
let allowAllTurnId: string | null = null;
let resolveCurrent: ((decision: ApprovalDecision) => void) | null = null;

export function setApprovalMode(mode: ApprovalMode) {
	approvalState.mode = mode;
	if (!browser) return;
	try {
		localStorage.setItem(MODE_KEY, mode);
	} catch {
		// Persistence is a convenience; the in-memory mode still holds.
	}
}

/**
 * Ask the user to approve a mutating tool call.
 *
 * Fails closed: every branch that is not an explicit allow resolves `deny`. A
 * pending prompt left unanswered when the surface unmounts is denied by
 * `cancelPendingApproval`, so the loop can never hang on a vanished prompt.
 */
export function requestApproval(req: Omit<ApprovalRequest, 'id'>): Promise<ApprovalDecision> {
	const check = precheckApproval({
		mode: approvalState.mode,
		reqTurnId: req.turnId,
		allowAllTurnId,
		hasPending: approvalState.pending !== null,
	});

	const immediate = immediateDecision(check);
	if (immediate !== null) return Promise.resolve(immediate);

	const id = crypto.randomUUID();
	return new Promise<ApprovalDecision>((resolve) => {
		resolveCurrent = resolve;
		approvalState.pending = { id, ...req };
	});
}

/** Resolve the outstanding prompt. Ignored if `id` does not match (stale click). */
export function resolveApproval(id: string, resolution: ApprovalResolution) {
	const pending = approvalState.pending;
	if (!pending || pending.id !== id) return;

	if (resolution === 'allow-all') allowAllTurnId = pending.turnId;

	const decision = decisionForResolution(resolution);
	approvalState.pending = null;
	const resolve = resolveCurrent;
	resolveCurrent = null;
	resolve?.(decision);
}

/** Deny and clear any outstanding prompt — called when the surface unmounts. */
export function cancelPendingApproval() {
	const pending = approvalState.pending;
	if (pending) resolveApproval(pending.id, 'deny');
}

/**
 * Clear the standing "allow all" grant. Called when a new turn begins so a grant
 * never leaks past the turn it was made for — belt-and-suspenders with the
 * turn-id scoping in `precheckApproval`.
 */
export function resetApprovalTurn() {
	allowAllTurnId = null;
}
