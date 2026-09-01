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

// Variant + hash primitives are shared verbatim with pi-sprite (canonical copy
// lives there) so both harnesses normalize labels and frame manifest lines
// identically. Re-exported to keep this module the single import site.
export {
	BASELINE_VARIANT,
	hashText,
	parseJsonl,
	resolveVariant,
	sanitizeVariant,
} from './runEnvelopeShared.ts';

import { parseJsonl, toJsonl, toJsonlLine } from './runEnvelopeShared.ts';

/**
 * How a run ended.
 *
 * `continued` is not a failure: the model emitted a tool call instead of text,
 * so this step handed off to the client and the turn carries on in the next
 * run. Without it every tool-using step would score as `empty` — a multi-step
 * turn would read as a string of failures, and any success rate computed from
 * the manifest would be wrong in proportion to how much the agent used tools.
 */
export type RunOutcome = 'success' | 'continued' | 'error' | 'aborted' | 'empty';

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
	/**
	 * The turn this run belongs to.
	 *
	 * Tools execute client-side, so a tool-using turn is several HTTP requests
	 * and therefore several runs. Group by `turnId` to recover the turn; group
	 * by `runId` to inspect one model call. Absent on single-step turns from
	 * before tools existed.
	 */
	turnId?: string;
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

/** Serialize one run as a manifest line. */
export function runToJsonl(run: RunRecord): string {
	return toJsonlLine(run);
}

/** Serialize many runs as a manifest body. */
export function runsToManifestJsonl(runs: RunRecord[]): string {
	return toJsonl(runs);
}

/**
 * Parse a manifest back into records, skipping unparseable lines.
 *
 * Lines are skipped rather than thrown on because the manifest is append-only
 * and may be read mid-write; one torn tail line should not cost you the other
 * two hundred runs.
 */
export function parseManifestJsonl(body: string): RunRecord[] {
	return parseJsonl<RunRecord>(body);
}

/** Token + cost totals for one chat session, folded from its runs. */
export type SessionRunStats = {
	sessionId: string;
	/** Model calls — one per HTTP request. */
	runs: number;
	/** Distinct `turnId`s seen; a tool-using turn spans several runs. */
	turns: number;
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	totalTokens: number;
	/** Null when every run was cost-free (local models) — never a synthetic 0. */
	costUsd: number | null;
	/** Runs that ended in `error`. */
	errors: number;
	/** Most recent `endedAt`, for ordering. */
	lastEndedAt: number;
};

/**
 * Fold a manifest into per-session token/cost stats.
 *
 * Keyed by `sessionId` so the agent inspector can join these onto the durable
 * session log (which shares the id). Cost stays `null` unless at least one run
 * reported a real number — a synthetic 0 would read as "measured free" rather
 * than "not measured", the same rule the metric itself holds.
 */
export function aggregateRunsBySession(runs: RunRecord[]): SessionRunStats[] {
	const byId = new Map<string, SessionRunStats & { _turnIds: Set<string> }>();

	for (const run of runs) {
		if (!run.sessionId) continue;
		let stat = byId.get(run.sessionId);
		if (!stat) {
			stat = {
				sessionId: run.sessionId,
				runs: 0,
				turns: 0,
				inputTokens: 0,
				outputTokens: 0,
				reasoningTokens: 0,
				totalTokens: 0,
				costUsd: null,
				errors: 0,
				lastEndedAt: 0,
				_turnIds: new Set<string>(),
			};
			byId.set(run.sessionId, stat);
		}

		stat.runs += 1;
		if (run.turnId) stat._turnIds.add(run.turnId);
		stat.inputTokens += run.metrics.inputTokens ?? 0;
		stat.outputTokens += run.metrics.outputTokens ?? 0;
		stat.reasoningTokens += run.metrics.reasoningTokens ?? 0;
		stat.totalTokens += run.metrics.totalTokens ?? 0;
		if (run.metrics.costUsd !== null) stat.costUsd = (stat.costUsd ?? 0) + run.metrics.costUsd;
		if (run.outcome === 'error') stat.errors += 1;
		if (run.endedAt > stat.lastEndedAt) stat.lastEndedAt = run.endedAt;
	}

	return [...byId.values()]
		.map(({ _turnIds, ...stat }) => ({ ...stat, turns: _turnIds.size }))
		.sort((a, b) => b.lastEndedAt - a.lastEndedAt);
}
