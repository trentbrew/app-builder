const SAVE_DEBOUNCE_MS = 400;

import { markEditorSavePending } from '$lib/editorSaveState.svelte';

type PendingSave = {
	content: string;
	save: (path: string, content: string) => Promise<void>;
};

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSaves = new Map<string, PendingSave>();

async function runSave(
	path: string,
	content: string,
	save: (path: string, content: string) => Promise<void>
) {
	try {
		await save(path, content);
	} catch (error) {
		console.warn(`Failed to auto-save ${path}:`, error);
		throw error;
	}
}

export function scheduleEditorSave(
	path: string,
	content: string,
	save: (path: string, content: string) => Promise<void>
) {
	pendingSaves.set(path, { content, save });
	markEditorSavePending();
	const existing = saveTimers.get(path);
	if (existing) clearTimeout(existing);

	saveTimers.set(
		path,
		setTimeout(() => {
			saveTimers.delete(path);
			const pending = pendingSaves.get(path);
			pendingSaves.delete(path);
			if (!pending) return;
			void runSave(path, pending.content, pending.save);
		}, SAVE_DEBOUNCE_MS)
	);
}

export function flushEditorSave(
	path: string,
	content: string,
	save: (path: string, content: string) => Promise<void>
) {
	const existing = saveTimers.get(path);
	if (existing) clearTimeout(existing);
	saveTimers.delete(path);
	pendingSaves.delete(path);
	return runSave(path, content, save);
}

/** Flush all debounced editor writes (e.g. before unload or project leave). */
export async function flushAllEditorSaves() {
	for (const timer of saveTimers.values()) clearTimeout(timer);
	saveTimers.clear();

	const saves = [...pendingSaves.entries()];
	pendingSaves.clear();

	await Promise.all(
		saves.map(([path, pending]) =>
			runSave(path, pending.content, pending.save).catch((error) => {
				console.warn(`Failed to flush save ${path}:`, error);
				throw error;
			})
		)
	);
}
