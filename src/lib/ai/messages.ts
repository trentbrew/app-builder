import { isFileUIPart, isTextUIPart, type UIMessage } from 'ai';

export type ChatMessageMetadata = {
	createdAt?: number;
};

export function getMessageTimestamp(message: UIMessage): number | null {
	const metadata = message.metadata as ChatMessageMetadata | undefined;
	return typeof metadata?.createdAt === 'number' ? metadata.createdAt : null;
}

export function formatMessageTime(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(timestamp));
}

export function createMessageMetadata(
	metadata: ChatMessageMetadata = {},
): ChatMessageMetadata {
	return {
		...metadata,
		createdAt: metadata.createdAt ?? Date.now(),
	};
}

export function backfillMessageTimestamps(messages: UIMessage[]): UIMessage[] {
	const base = Date.now() - messages.length * 60_000;
	return messages.map((message, index) => {
		const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
		if (typeof metadata.createdAt === 'number') return message;
		return {
			...message,
			metadata: { ...metadata, createdAt: base + index * 60_000 },
		};
	});
}

export function getMessageText(message: UIMessage): string {
	return message.parts
		.filter(isTextUIPart)
		.map((part) => part.text)
		.join('');
}

export function getMessageReasoning(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === 'reasoning' && 'text' in part)
		.map((part) => String((part as { text?: string }).text ?? ''))
		.join('');
}

export function formatThoughtDuration(seconds: number): string {
	const rounded = Math.max(1, Math.round(seconds));
	return rounded === 1 ? 'Thought for 1 second' : `Thought for ${rounded} seconds`;
}

export function getChatStatusLabel(
	status: 'submitted' | 'streaming' | 'ready' | 'error',
	messages: UIMessage[],
	busy: boolean,
): string | null {
	if (!busy) return null;

	const last = messages.at(-1);
	if (status === 'submitted' || last?.role === 'user') return 'Thinking…';

	if (status === 'streaming' && last?.role === 'assistant') {
		const text = getMessageText(last).trim();
		const reasoning = getMessageReasoning(last).trim();
		if (reasoning && !text) return null;
		return text ? 'Working…' : 'Thinking…';
	}

	return 'Working…';
}

export function getMessageFiles(message: UIMessage) {
	return message.parts.filter(isFileUIPart);
}

export function isMessageStreaming(
	message: UIMessage,
	status: 'submitted' | 'streaming' | 'ready' | 'error',
): boolean {
	if (status !== 'streaming' && status !== 'submitted') return false;
	if (message.role !== 'assistant') return false;
	const text = getMessageText(message);
	return text.length === 0 || status === 'streaming';
}

export function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
