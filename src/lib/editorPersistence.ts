const SAVE_DEBOUNCE_MS = 800;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleEditorSave(
	path: string,
	content: string,
	save: (path: string, content: string) => Promise<void>
) {
	const existing = saveTimers.get(path);
	if (existing) clearTimeout(existing);

	saveTimers.set(
		path,
		setTimeout(() => {
			saveTimers.delete(path);
			void save(path, content).catch((error) => {
				console.warn(`Failed to auto-save ${path}:`, error);
			});
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
	return save(path, content);
}
