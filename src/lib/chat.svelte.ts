import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
	backfillMessageTimestamps,
	createMessageMetadata,
	type ChatMessageMetadata,
} from '$lib/ai/messages.js';
import { toast } from '$lib/notify';
import { loadPersistedChat, clearPersistedChat } from '$lib/chat/persistence.js';
import { chatSettings } from '$lib/chat/settings.svelte.js';

const persisted = loadPersistedChat();

export const chat = new Chat({
	messages: backfillMessageTimestamps(persisted.messages),
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
	onFinish: ({ message }) => {
		stampAssistantMessage(message);
	},
});

type SendMessageInput = Parameters<typeof chat.sendMessage>[0];
type SendMessageOptions = Parameters<typeof chat.sendMessage>[1];

export function stampAssistantMessage(message: UIMessage) {
	const metadata = message.metadata as ChatMessageMetadata | undefined;
	if (typeof metadata?.createdAt === 'number') return;

	const index = chat.messages.findIndex((entry) => entry.id === message.id);
	if (index < 0) return;

	const existing = chat.messages[index];
	chat.messages[index] = {
		...existing,
		metadata: createMessageMetadata((existing.metadata ?? {}) as ChatMessageMetadata),
	};
}

function withMessageTimestamp(message: SendMessageInput): SendMessageInput {
	if (!message) return message;

	if ('text' in message || 'files' in message) {
		const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
		return {
			...message,
			metadata: createMessageMetadata(metadata),
		};
	}

	if ('metadata' in message) {
		const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
		return {
			...message,
			metadata: createMessageMetadata(metadata),
		};
	}

	return message;
}

export async function sendChatMessage(
	message?: SendMessageInput,
	options?: SendMessageOptions,
) {
	await chat.sendMessage(withMessageTimestamp(message), options);
}

export function resetChat() {
	chat.messages = [];
	chat.clearError();
	clearPersistedChat();
}

export function isChatBusy() {
	return chat.status === 'submitted' || chat.status === 'streaming';
}
