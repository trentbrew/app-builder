import { createOllama } from 'ai-sdk-ollama';
import { env } from '$env/dynamic/private';
import { DEFAULT_OLLAMA_BASE_URL } from '$lib/ai/config';

export const ollama = createOllama({
	baseURL: env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
});

/**
 * Build the chat model.
 *
 * `thinking` defaults to `true` to preserve the behaviour every existing caller
 * relies on; the chat route overrides it per experiment arm. Ollama accepts
 * `boolean | 'high' | 'medium' | 'low'` — only the boolean is exercised today.
 */
export function createOllamaChatModel(modelId: string, options?: { thinking?: boolean }) {
	return ollama(modelId, { think: options?.thinking ?? true });
}

export function getOllamaBaseUrl() {
	return env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
}
