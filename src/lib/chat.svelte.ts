import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import { toast } from 'svelte-sonner';
import { loadPersistedChat, clearPersistedChat } from '$lib/chat/persistence.js';
import { chatSettings } from '$lib/chat/settings.svelte.js';

const persisted = loadPersistedChat();

export const chat = new Chat({
	messages: persisted.messages,
	transport: new DefaultChatTransport({
		api: '/api/chat',
		prepareSendMessagesRequest: ({ messages, id, ...rest }) => ({
			...rest,
			id,
			body: {
				messages,
				model: chatSettings.model,
			},
		}),
	}),
	onError: (error) => {
		toast.error(error.message || 'Chat request failed');
	},
});

export function resetChat() {
	chat.messages = [];
	chat.clearError();
	clearPersistedChat();
}

export function isChatBusy() {
	return chat.status === 'submitted' || chat.status === 'streaming';
}
