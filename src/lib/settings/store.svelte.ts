import { browser } from '$app/environment';
import { applyUiSettings } from '$lib/settings/apply';
import {
	DEFAULT_SETTINGS,
	type AppSettings,
	type EditorSettings
} from '$lib/settings/types';

const STORAGE_KEY = 'app-builder:settings:v1';

function mergeSettings(raw: unknown): AppSettings {
	if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);

	const input = raw as Partial<AppSettings>;
	return {
		editor: {
			...DEFAULT_SETTINGS.editor,
			...(input.editor ?? {})
		}
	};
}

function loadSettings(): AppSettings {
	if (!browser) return structuredClone(DEFAULT_SETTINGS);

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return structuredClone(DEFAULT_SETTINGS);
		return mergeSettings(JSON.parse(raw));
	} catch {
		return structuredClone(DEFAULT_SETTINGS);
	}
}

function persistSettings(next: AppSettings) {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Ignore quota / private-mode failures.
	}
}

export const settings = $state<AppSettings>(loadSettings());

export function updateEditorSettings(patch: Partial<EditorSettings>) {
	settings.editor = {
		...settings.editor,
		...patch
	};
	persistSettings(settings);
	applyUiSettings(settings);
}

export function resetSettings() {
	settings.editor = structuredClone(DEFAULT_SETTINGS.editor);
	persistSettings(settings);
	applyUiSettings(settings);
}

if (browser) {
	applyUiSettings(settings);
}
