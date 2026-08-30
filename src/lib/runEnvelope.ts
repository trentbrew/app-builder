/**
 * Run envelope — the record that turns an agent turn into an experiment datum.
 *
 * Ported from pi-sprite's `src/lib/runEnvelope.ts`. The field names are kept
 * deliberately identical so the two harnesses stay comparable in *shape*. Their
 * numbers are not comparable: pi-sprite runs a client-side loop against a hosted
 * model, this runs a server-side loop against local Ollama. Only within-project
 * variant deltas are valid.
 *
 * Captured now rather than later on purpose: `runId`, `variant`, `buildId`, the
 * config snapshot, and token usage cannot be reconstructed from a transcript
 * after the fact. Everything else can be recomputed from the record.
 *
 * Isomorphic — no filesystem, no Svelte runes. The writer lives in
 * `$lib/server/runLog.ts`; the client only needs `resolveVariant`.
 */

export const BASELINE_VARIANT = 'baseline';

/** Longest variant label we accept: descriptive enough to read, short enough to tabulate. */
const MAX_VARIANT_LENGTH = 64;

export type RunOutcome = 'success' | 'error' | 'aborted' | 'empty';

/**
 * The knobs that define an arm. Built field by field, never by spreading the
 * request body — a field added upstream must not silently land in the log.
 *
 * The system prompt is reduced to length + hash rather than stored verbatim: the
 * envelope's job is to discriminate between variants, not to keep a second copy
 * of the prompt. A changed hash tells you the arm changed; that is all it needs.
 */
export type RunConfigSnapshot = {
	model: string;
	provider: string;
	thinking: boolean;
	systemPromptChars: number;
	systemPromptHash: string;
	/** Turn depth: how much conversation preceded this run. */
	messageCount: number;
};

export type RunMetrics = {
	durationMs: number;
	/** Time to first streamed chunk. Null if the run produced nothing. */
	ttftMs: number | null;
	steps: number;
	toolCalls: number;
	inputTokens: number | null;
	outputTokens: number | null;
	/**
	 * Output tokens spent on reasoning. Meaningful because the Ollama adapter is
	 * built with `think: true` — today that cost is entirely invisible.
	 */
	reasoningTokens: number | null;
	totalTokens: number | null;
	/**
	 * Null for locally hosted models. Deliberately not 0: a synthetic zero gets
	 * averaged as though it were a measurement.
	 */
	costUsd: number | null;
};

/**
 * One complete run.
 *
 * Unlike pi-sprite's two-event envelope (`run_start` / `run_end`), a run here is
 * written once, at the end. The server holds the whole turn in one closure and
 * closes it on every exit path — success, error, and abort. The tradeoff is that
 * a hard process crash mid-turn loses the run entirely, where pi-sprite would
 * still hold the opening event and fold it to `incomplete`.
 */
export type RunRecord = {
	runId: string;
	sessionId: string;
	variant: string;
	/**
	 * Corpus task this run answered, when driven by an experiment.
	 * Absent for ordinary interactive turns — those are runs, not trials.
	 */
	taskId?: string;
	buildId: string;
	startedAt: number;
	endedAt: number;
	promptChars: number;
	config: RunConfigSnapshot;
	outcome: RunOutcome;
	/** The provider's own stop reason, when it reported one. */
	finishReason: string | null;
	metrics: RunMetrics;
	error?: string;
};

/**
 * FNV-1a, 32 bits. Not a security primitive — it identifies which prompt text an
 * arm ran, and `crypto.subtle` is async everywhere this is called.
 */
export function hashText(text: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/**
 * Reduce an arbitrary label to a safe variant id.
 *
 * Applied on both sides: the client reads it from the URL, and the server
 * re-applies it because by then the value has travelled in a request body.
 */
export function sanitizeVariant(raw: unknown): string {
	if (typeof raw !== 'string') return BASELINE_VARIANT;
	const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '').slice(0, MAX_VARIANT_LENGTH);
	return cleaned || BASELINE_VARIANT;
}

/**
 * Read the experiment arm from a query string (`?variant=v-plan`).
 *
 * A URL parameter rather than a setting on purpose: it lets a Playwright driver
 * run the same corpus against two arms without a human touching the UI.
 */
export function resolveVariant(search: string): string {
	try {
		return sanitizeVariant(new URLSearchParams(search).get('variant'));
	} catch {
		return BASELINE_VARIANT;
	}
}

/** Serialize one run as a manifest line. */
export function runToJsonl(run: RunRecord): string {
	return `${JSON.stringify(run)}\n`;
}

/** Serialize many runs as a manifest body. */
export function runsToManifestJsonl(runs: RunRecord[]): string {
	return runs.map(runToJsonl).join('');
}

/**
 * Parse a manifest back into records, skipping unparseable lines.
 *
 * Lines are skipped rather than thrown on because the manifest is append-only
 * and may be read mid-write; one torn tail line should not cost you the other
 * two hundred runs.
 */
export function parseManifestJsonl(body: string): RunRecord[] {
	const runs: RunRecord[] = [];
	for (const line of body.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			runs.push(JSON.parse(trimmed) as RunRecord);
		} catch {
			// torn or hand-edited line — keep going
		}
	}
	return runs;
}
