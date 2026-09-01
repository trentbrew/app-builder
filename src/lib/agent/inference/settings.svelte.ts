/**
 * Inference settings — the live, per-user sampling knobs.
 *
 * A thin runes store over `InferenceParams`, persisted to localStorage so a
 * user's temperature/thinking choice survives reload. The pure params + clamping
 * live in `./params.ts`; the server re-sanitizes on receipt regardless of what
 * this stored, because a persisted value is still client-supplied.
 */
import { browser } from '$app/environment';
import {
	DEFAULT_INFERENCE,
	sanitizeInferenceParams,
	type InferenceParams,
	type ThinkingLevel,
} from './params';

const STORAGE_KEY = 'app-builder:inference:v1';

function load(): InferenceParams {
	if (!browser) return { ...DEFAULT_INFERENCE };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_INFERENCE };
		return sanitizeInferenceParams(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_INFERENCE };
	}
}

export const inferenceSettings = $state<InferenceParams>(load());

function persist() {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inferenceSettings }));
	} catch {
		// Persistence is a convenience; the in-memory value still applies.
	}
}

export function setTemperature(value: number) {
	inferenceSettings.temperature = value;
	persist();
}

export function setTopP(value: number) {
	inferenceSettings.topP = value;
	persist();
}

export function setMaxTokens(value: number) {
	inferenceSettings.maxTokens = value;
	persist();
}

export function setThinkingLevel(level: ThinkingLevel) {
	inferenceSettings.thinkingLevel = level;
	persist();
}

export function setStopSequences(raw: string) {
	inferenceSettings.stopSequences = raw;
	persist();
}

export function resetInference() {
	Object.assign(inferenceSettings, DEFAULT_INFERENCE);
	persist();
}

/** A plain snapshot to send in the chat request body. */
export function inferenceSnapshot(): InferenceParams {
	return { ...inferenceSettings };
}
