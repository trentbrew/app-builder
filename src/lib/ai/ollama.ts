import { createOllama } from 'ai-sdk-ollama';
import { env } from '$env/dynamic/private';
import { DEFAULT_OLLAMA_BASE_URL } from '$lib/ai/config';

export const ollama = createOllama({
	baseURL: env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
});

export function getOllamaBaseUrl() {
	return env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
}
