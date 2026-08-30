import { browser } from '$app/environment';
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
	backfillMessageTimestamps,
	createMessageMetadata,
	type ChatMessageMetadata,
} from '$lib/ai/messages.js';
import { toast } from '$lib/notify';
import { loadPersistedChat } from '$lib/chat/persistence.js';
import { chatSettings } from '$lib/chat/settings.svelte.js';
import { BASELINE_VARIANT, resolveVariant } from '$lib/runEnvelope';

const sessions = new Map<string, Chat>();
let primarySessionId: string | null = null;

/**
 * Experiment arm for this page load, from `?variant=` (default `baseline`).
 *
 * Resolved once so every run in a session carries the same label, and sent to
 * `/api/chat` because the run log is written server-side — that is where token
 * usage and finish reason live.
 */
const RUN_VARIANT = browser ? resolveVariant(window.location.search) : BASELINE_VARIANT;

export function registerPrimaryAgentSession(sessionId: string) {
	if (!primarySessionId) primarySessionId = sessionId;
}

function stampAssistantMessage(chat: Chat, message: UIMessage) {
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

function withMessageTimestamp<T extends { metadata?: unknown }>(message: T): T {
	const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
	return {
		...message,
		metadata: createMessageMetadata(metadata),
	};
}

function createChat(sessionId: string): Chat {
	const persisted = sessionId === primarySessionId ? loadPersistedChat() : null;

	const chat = new Chat({
		messages: backfillMessageTimestamps(persisted?.messages ?? []),
		transport: new DefaultChatTransport({
			api: '/api/chat',
			prepareSendMessagesRequest: ({ messages, id, ...rest }) => ({
				...rest,
				id,
				body: {
					messages,
					model: chatSettings.model,
					sessionId,
					variant: RUN_VARIANT,
				},
			}),
		}),
		onError: (error) => {
			toast.error(error.message || 'Chat request failed');
		},
		onFinish: ({ message }) => {
			stampAssistantMessage(chat, message);
		},
	});

	return chat;
}

export function getAgentChat(sessionId: string): Chat {
	let chat = sessions.get(sessionId);
	if (!chat) {
		chat = createChat(sessionId);
		sessions.set(sessionId, chat);
	}
	return chat;
}

export function disposeAgentChatSession(sessionId: string) {
	sessions.delete(sessionId);
	if (primarySessionId === sessionId) primarySessionId = null;
}

type SendMessageInput = Parameters<Chat['sendMessage']>[0];
type SendMessageOptions = Parameters<Chat['sendMessage']>[1];

export async function sendAgentChatMessage(
	sessionId: string,
	message?: SendMessageInput,
	options?: SendMessageOptions,
) {
	const chat = getAgentChat(sessionId);
	if (!message) {
		await chat.sendMessage(message, options);
		return;
	}

	if ('text' in message || 'files' in message || 'metadata' in message) {
		await chat.sendMessage(withMessageTimestamp(message), options);
		return;
	}

	await chat.sendMessage(message, options);
}

export function isAgentChatBusy(sessionId: string) {
	const chat = sessions.get(sessionId);
	if (!chat) return false;
	return chat.status === 'submitted' || chat.status === 'streaming';
}

export function stopAgentChat(sessionId: string) {
	const chat = sessions.get(sessionId);
	if (!chat) return;
	void chat.stop();
}
