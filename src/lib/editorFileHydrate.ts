import { isBinaryPreviewPath } from '$lib/fileTypes';
import type { SandboxFs } from '$lib/sandbox/types';

export function normalizeEditorFilePath(path: string) {
	return path.startsWith('/') ? path : `/${path}`;
}

export type EditorFileHydrateState = {
	fileContents: Record<string, string>;
	openFiles: string[];
	activeFile: string;
	entryPath: string;
};

/** Load text files that exist; drop persisted tabs that are not on disk. */
export async function hydrateEditorTextFiles(
	fs: SandboxFs,
	paths: string[],
	state: EditorFileHydrateState,
	onlyEmpty: boolean
): Promise<EditorFileHydrateState & { changed: boolean }> {
	const next = { ...state.fileContents };
	const gone: string[] = [];
	let changed = false;

	for (const path of paths) {
		if (isBinaryPreviewPath(path)) continue;
		if (onlyEmpty && (next[path] ?? '').length) continue;

		const filePath = normalizeEditorFilePath(path);
		const info = await fs.stat(filePath);
		if (!info.exists || info.isDirectory) {
			gone.push(path);
			continue;
		}

		const content = await fs.readFile(filePath, 'utf-8');
		if (next[path] !== content) {
			next[path] = content;
			changed = true;
		}
	}

	let openFiles = state.openFiles;
	let activeFile = state.activeFile;

	if (gone.length) {
		openFiles = openFiles.filter((path) => !gone.includes(path));
		for (const path of gone) delete next[path];
		if (gone.includes(activeFile)) {
			activeFile = openFiles[0] ?? state.entryPath;
		}
		changed = true;
	}

	return { fileContents: next, openFiles, activeFile, entryPath: state.entryPath, changed };
}
