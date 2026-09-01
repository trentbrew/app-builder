/**
 * Approval policy — the pure decision matrix, kept Dexie- and rune-free so the
 * security-relevant logic runs under `node --test`.
 *
 * The seam it serves: an agent editing the *user's* files asks before a write
 * lands. Everything here answers one question — given the current mode and the
 * standing "allow all this turn", does a request resolve immediately, or does it
 * have to prompt? The rule is **fail closed**: anything that is not an explicit
 * allow ends as a deny, never an accidental allow.
 */

export type ApprovalMode = 'prompt' | 'auto-allow';

/** What the UI can return for a pending prompt. */
export type ApprovalResolution = 'allow' | 'allow-all' | 'deny';

/** The binary outcome a tool call actually acts on. */
export type ApprovalDecision = 'allow' | 'deny';

/**
 * The result of pre-checking a request before any prompt is shown.
 *
 * - `auto-allow` — mode is `auto-allow`; no prompt.
 * - `auto-allow-turn` — a standing "allow all" covers this turn; no prompt.
 * - `deny-busy` — a prompt is already outstanding; fail closed rather than race.
 * - `prompt` — show the prompt and wait for the user.
 */
export type PreCheck = 'auto-allow' | 'auto-allow-turn' | 'deny-busy' | 'prompt';

export function precheckApproval(args: {
	mode: ApprovalMode;
	reqTurnId: string;
	allowAllTurnId: string | null;
	hasPending: boolean;
}): PreCheck {
	if (args.mode === 'auto-allow') return 'auto-allow';
	// "Allow all" is scoped to one turn: it holds only while the turn that granted
	// it is still the turn asking. A new turn mints a new id and cannot match.
	if (args.allowAllTurnId !== null && args.allowAllTurnId === args.reqTurnId) {
		return 'auto-allow-turn';
	}
	// One outstanding prompt at a time. A second concurrent request denies rather
	// than stacking prompts the user can't disambiguate; the model retries.
	if (args.hasPending) return 'deny-busy';
	return 'prompt';
}

/** Whether a pre-check resolves without user interaction, and to what. */
export function immediateDecision(check: PreCheck): ApprovalDecision | null {
	switch (check) {
		case 'auto-allow':
		case 'auto-allow-turn':
			return 'allow';
		case 'deny-busy':
			return 'deny';
		case 'prompt':
			return null;
	}
}

/** Map a user's prompt resolution to the binary decision the caller acts on. */
export function decisionForResolution(resolution: ApprovalResolution): ApprovalDecision {
	return resolution === 'deny' ? 'deny' : 'allow';
}

/** A short human summary of a write, for the prompt ("+34 lines"). */
export function summarizeWrite(content: string): string {
	const lines = content.length === 0 ? 0 : content.split('\n').length;
	return `+${lines} line${lines === 1 ? '' : 's'}`;
}
