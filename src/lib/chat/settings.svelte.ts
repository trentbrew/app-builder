import { browser } from '$app/environment';
import { DEFAULT_OLLAMA_MODEL } from '$lib/ai/config';
import { loadPersistedChat, persistChat } from '$lib/chat/persistence.js';

const persisted = loadPersistedChat();

export const chatSettings = $state({
	model: persisted.model || DEFAULT_OLLAMA_MODEL,
});

export const chatModelCatalog = $state({
	available: [DEFAULT_OLLAMA_MODEL] as string[],
});

let modelsLoaded = $state(false);

export function setChatModel(model: string) {
	chatSettings.model = model;
}

export async function loadAvailableModels() {
	if (!browser || modelsLoaded) return;

	try {
		const response = await fetch('/api/chat/models');
		if (!response.ok) throw new Error('Could not load models');

		const data = (await response.json()) as { models?: string[] };
		const models = data.models?.filter(Boolean) ?? [];
		if (models.length > 0) {
			chatModelCatalog.available = models;
			if (!models.includes(chatSettings.model)) {
				chatSettings.model = models.includes(DEFAULT_OLLAMA_MODEL)
					? DEFAULT_OLLAMA_MODEL
					: (models[0] ?? DEFAULT_OLLAMA_MODEL);
			}
		}
	} catch {
		if (!chatModelCatalog.available.includes(chatSettings.model)) {
			chatModelCatalog.available = [chatSettings.model, ...chatModelCatalog.available];
		}
	} finally {
		modelsLoaded = true;
	}
}

export function syncChatPersistence(messages: Parameters<typeof persistChat>[1]) {
	persistChat(chatSettings.model, messages);
}
