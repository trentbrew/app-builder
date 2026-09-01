/**
 * Inference parameters — the sampling knobs a user can move per session.
 *
 * Adapted from pi-sprite's `inference.ts`, kept pure (no runes, no server) so it
 * is a shared-core candidate and its clamping runs under `node --test`. The
 * runes store lives in `./settings.svelte.ts`; the server sanitizes the request
 * body through `sanitizeInferenceParams` before touching `streamText`.
 *
 * `sanitizeInferenceParams` is the security-relevant piece: the params arrive in
 * a request body, so every field is clamped to a sane range rather than trusted.
 */

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

export const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high'];

export type InferenceParams = {
	temperature: number;
	topP: number;
	maxTokens: number;
	/** Freeform: newline/comma-separated stop strings, parsed on use. */
	stopSequences: string;
	thinkingLevel: ThinkingLevel;
};

export const DEFAULT_INFERENCE: InferenceParams = {
	temperature: 0.7,
	topP: 0.9,
	maxTokens: 4096,
	stopSequences: '',
	thinkingLevel: 'low',
};

const TEMP_RANGE = { min: 0, max: 2 } as const;
const TOP_P_RANGE = { min: 0, max: 1 } as const;
const MAX_TOKENS_RANGE = { min: 1, max: 32_768 } as const;

export function parseStopSequences(raw: string): string[] {
	return raw
		.split(/[\n,]/)
		.map((part) => part.trim())
		.filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function num(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Coerce arbitrary input (a request body) into valid params. Out-of-range and
 * malformed values fall back to the default or clamp — never throw, never let a
 * client-supplied number reach the model unbounded.
 */
export function sanitizeInferenceParams(raw: unknown): InferenceParams {
	const input = (raw ?? {}) as Record<string, unknown>;
	const level = THINKING_LEVELS.includes(input.thinkingLevel as ThinkingLevel)
		? (input.thinkingLevel as ThinkingLevel)
		: DEFAULT_INFERENCE.thinkingLevel;

	return {
		temperature: clamp(num(input.temperature, DEFAULT_INFERENCE.temperature), TEMP_RANGE.min, TEMP_RANGE.max),
		topP: clamp(num(input.topP, DEFAULT_INFERENCE.topP), TOP_P_RANGE.min, TOP_P_RANGE.max),
		maxTokens: Math.trunc(
			clamp(num(input.maxTokens, DEFAULT_INFERENCE.maxTokens), MAX_TOKENS_RANGE.min, MAX_TOKENS_RANGE.max),
		),
		stopSequences: typeof input.stopSequences === 'string' ? input.stopSequences : '',
		thinkingLevel: level,
	};
}

/**
 * Map a thinking level to what the Ollama adapter's `think` accepts
 * (`boolean | 'low' | 'medium' | 'high'`). `off` disables it; `minimal` is the
 * lowest real level the backend has.
 */
export function thinkingToOllama(level: ThinkingLevel): boolean | 'low' | 'medium' | 'high' {
	switch (level) {
		case 'off':
			return false;
		case 'minimal':
		case 'low':
			return 'low';
		case 'medium':
			return 'medium';
		case 'high':
			return 'high';
	}
}
