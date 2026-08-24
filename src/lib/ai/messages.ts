import { isFileUIPart, isTextUIPart, type UIMessage } from 'ai';

export function getMessageText(message: UIMessage): string {
	return message.parts
		.filter(isTextUIPart)
		.map((part) => part.text)
		.join('');
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
