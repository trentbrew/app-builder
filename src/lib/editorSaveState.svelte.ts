export type EditorSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const SAVED_VISIBLE_MS = 2_000;
const ERROR_VISIBLE_MS = 4_000;

let inFlight = 0;
let savedTimer: ReturnType<typeof setTimeout> | undefined;

export const editorSaveState = $state({
	status: 'idle' as EditorSaveStatus,
	detail: undefined as string | undefined
});

export function editorSaveStatusLabel(): string | null {
	switch (editorSaveState.status) {
		case 'pending':
			return 'Unsaved changes';
		case 'saving':
			return editorSaveState.detail ?? 'Saving…';
		case 'saved':
			return 'Saved';
		case 'error':
			return 'Save failed';
		default:
			return null;
	}
}

export function markEditorSavePending() {
	if (savedTimer) clearTimeout(savedTimer);
	if (editorSaveState.status === 'saving') return;
	editorSaveState.status = 'pending';
	editorSaveState.detail = undefined;
}

export function markEditorSaveStarted(detail = 'Saving…') {
	if (savedTimer) clearTimeout(savedTimer);
	inFlight++;
	editorSaveState.status = 'saving';
	editorSaveState.detail = detail;
}

export function markEditorSaveFinished() {
	inFlight = Math.max(0, inFlight - 1);
	if (inFlight > 0) return;
	editorSaveState.status = 'saved';
	editorSaveState.detail = undefined;
	savedTimer = setTimeout(() => {
		if (editorSaveState.status === 'saved') editorSaveState.status = 'idle';
		savedTimer = undefined;
	}, SAVED_VISIBLE_MS);
}

export function markEditorSaveFailed() {
	inFlight = 0;
	editorSaveState.status = 'error';
	editorSaveState.detail = undefined;
	savedTimer = setTimeout(() => {
		if (editorSaveState.status === 'error') editorSaveState.status = 'idle';
		savedTimer = undefined;
	}, ERROR_VISIBLE_MS);
}

export function resetEditorSaveState() {
	inFlight = 0;
	if (savedTimer) clearTimeout(savedTimer);
	savedTimer = undefined;
	editorSaveState.status = 'idle';
	editorSaveState.detail = undefined;
}
