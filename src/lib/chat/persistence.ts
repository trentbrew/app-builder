import { browser } from '$app/environment';
import type { UIMessage } from 'ai';
import { DEFAULT_OLLAMA_MODEL } from '$lib/ai/config';

export const CHAT_STORAGE_KEY = 'app-builder:chat-transcript:v1';

export type PersistedChat = {
	model: string;
	messages: UIMessage[];
};

export function loadPersistedChat(): PersistedChat {
	if (!browser) {
		return { model: DEFAULT_OLLAMA_MODEL, messages: [] };
	}

	try {
		const raw = localStorage.getItem(CHAT_STORAGE_KEY);
		if (!raw) return { model: DEFAULT_OLLAMA_MODEL, messages: [] };

		const parsed = JSON.parse(raw) as Partial<PersistedChat>;
		return {
			model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_OLLAMA_MODEL,
			messages: Array.isArray(parsed.messages) ? (parsed.messages as UIMessage[]) : [],
		};
	} catch {
		return { model: DEFAULT_OLLAMA_MODEL, messages: [] };
	}
}

export function persistChat(model: string, messages: UIMessage[]) {
	if (!browser) return;

	try {
		const payload: PersistedChat = { model, messages };
		localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// Ignore quota errors — transcript stays in memory for the session.
	}
}

export function clearPersistedChat() {
	if (!browser) return;
	localStorage.removeItem(CHAT_STORAGE_KEY);
}
