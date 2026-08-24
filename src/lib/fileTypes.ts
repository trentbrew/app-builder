export type MarkdownEditorMode = 'rich' | 'raw';

const RUNNABLE_EXTENSIONS = new Set(['svelte', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx']);

export function isMarkdownPath(path: string): boolean {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return ext === 'md' || ext === 'markdown';
}

/** Files whose contents can be synced/run in the sandbox preview pipeline. */
export function isRunnablePath(path: string): boolean {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return RUNNABLE_EXTENSIONS.has(ext);
}
