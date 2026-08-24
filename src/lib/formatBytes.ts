export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function countLines(text: string): number {
	if (!text.length) return 0;
	return text.split('\n').length;
}
