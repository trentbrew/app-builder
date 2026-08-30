import { goto } from '$app/navigation';
import { flushAllEditorSaves } from '$lib/editorPersistence';
import {
	markEditorSaveFailed,
	markEditorSaveFinished,
	markEditorSaveStarted,
	resetEditorSaveState
} from '$lib/editorSaveState.svelte';
import { sandboxStore } from '$lib/sandboxStore';

let leavePromise: Promise<void> | null = null;

/** Flush open editor buffers and persist the WebContainer snapshot to Dexie. */
export async function persistEditorSession() {
	markEditorSaveStarted('Saving project…');
	try {
		await flushAllEditorSaves();
		await sandboxStore.flushPendingSnapshot?.();
		markEditorSaveFinished();
	} catch (error) {
		markEditorSaveFailed();
		throw error;
	}
}

/** Save, release sandbox, and navigate away from the editor. */
export async function leaveEditor(href: string) {
	if (leavePromise) return leavePromise;

	leavePromise = (async () => {
		const toDashboard = href === '/dashboard' || href.startsWith('/dashboard?');
		const toTemplates = href === '/templates' || href.startsWith('/templates?');

		try {
			await persistEditorSession();
			if (toDashboard || toTemplates) {
				await sandboxStore.releaseActiveProject?.();
			}
			await goto(href);
		} finally {
			leavePromise = null;
			resetEditorSaveState();
		}
	})();

	return leavePromise;
}

export function leaveEditorForDashboard() {
	return leaveEditor('/dashboard');
}

/** True while an async leave is in flight (navigation already cancelled). */
export function isLeavingEditor() {
	return leavePromise !== null;
}
