import { browser } from '$app/environment';
import { applyAppSettings } from '$lib/settings/apply';
import {
	DEFAULT_SETTINGS,
	type AppSettings,
	type EditorActiveTabAccentColor,
	type EditorLayoutPresetId,
	type EditorSettings,
	type ThemeSettings,
	type TypographySettings
} from '$lib/settings/types';
import { parseTweakcnImport, type TweakcnRegistryItem } from '$lib/theme';

function clampFontSize(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
	return Math.min(24, Math.max(10, Math.round(value)));
}

const STORAGE_KEY = 'app-builder:settings:v2';

function normalizeTabAccentColor(value: unknown): EditorActiveTabAccentColor {
	if (value === 'brand-orange' || value === 'foreground') return value;
	if (value === 'primary') return 'primary';
	// Legacy default before theme-driven accents.
	if (value === 'orange') return 'primary';
	return DEFAULT_SETTINGS.editor.activeTabAccentColor;
}

function mergeTheme(raw: unknown): ThemeSettings {
	if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS.theme);
	const input = raw as Partial<ThemeSettings>;
	const presetId =
		typeof input.presetId === 'string' && input.presetId.length > 0
			? input.presetId
			: DEFAULT_SETTINGS.theme.presetId;
	const colorScheme =
		input.colorScheme === 'dark' || input.colorScheme === 'light' || input.colorScheme === 'system'
			? input.colorScheme
			: DEFAULT_SETTINGS.theme.colorScheme;

	let custom: TweakcnRegistryItem | undefined;
	if (presetId === 'custom' && input.custom && typeof input.custom === 'object') {
		try {
			custom = parseTweakcnImport(JSON.stringify(input.custom));
		} catch {
			custom = undefined;
		}
	}

	if (presetId === 'custom' && !custom) {
		return structuredClone(DEFAULT_SETTINGS.theme);
	}

	if (presetId !== 'custom') {
		return { presetId, colorScheme };
	}

	return {
		presetId,
		colorScheme,
		custom
	};
}

function normalizeLayoutPreset(value: unknown): EditorLayoutPresetId {
	return value === 'agent-focus' ? 'agent-focus' : 'classic';
}

function mergeSettings(raw: unknown): AppSettings {
	if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS);

	const input = raw as Partial<AppSettings>;
	const editor = input.editor ?? {};
	const typography = input.typography ?? {};
	const paneGap =
		typeof editor.paneGap === 'number' && !Number.isNaN(editor.paneGap)
			? Math.min(20, Math.max(2, Math.round(editor.paneGap)))
			: DEFAULT_SETTINGS.editor.paneGap;

	return {
		theme: mergeTheme(input.theme),
		editor: {
			...DEFAULT_SETTINGS.editor,
			...editor,
			paneGap,
			activeTabAccentColor: normalizeTabAccentColor(editor.activeTabAccentColor),
			stretchSingleTabs:
				typeof editor.stretchSingleTabs === 'boolean'
					? editor.stretchSingleTabs
					: DEFAULT_SETTINGS.editor.stretchSingleTabs,
			autoSaveToSandbox:
				typeof editor.autoSaveToSandbox === 'boolean'
					? editor.autoSaveToSandbox
					: DEFAULT_SETTINGS.editor.autoSaveToSandbox,
			layoutPreset: normalizeLayoutPreset(editor.layoutPreset)
		},
		typography: {
			...DEFAULT_SETTINGS.typography,
			...typography,
			editorFontSize: clampFontSize(typography.editorFontSize, DEFAULT_SETTINGS.typography.editorFontSize),
			terminalFontSize: clampFontSize(typography.terminalFontSize, DEFAULT_SETTINGS.typography.terminalFontSize),
			explorerFontSize: clampFontSize(typography.explorerFontSize, DEFAULT_SETTINGS.typography.explorerFontSize)
		}
	};
}

function loadSettings(): AppSettings {
	if (!browser) return structuredClone(DEFAULT_SETTINGS);

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as unknown;
			const merged = mergeSettings(parsed);
			const legacyAccent =
				parsed &&
				typeof parsed === 'object' &&
				(parsed as { editor?: { activeTabAccentColor?: string } }).editor?.activeTabAccentColor ===
					'orange';
			if (legacyAccent) persistSettings(merged);
			return merged;
		}

		const legacy = localStorage.getItem('app-builder:settings:v1');
		if (legacy) return mergeSettings(JSON.parse(legacy));
	} catch {
		// fall through
	}

	return structuredClone(DEFAULT_SETTINGS);
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

export function updateThemeSettings(patch: Partial<ThemeSettings>) {
	settings.theme = mergeTheme({
		...settings.theme,
		...patch
	});
	persistSettings(settings);
	applyAppSettings(settings);
}

export function importThemeFromTweakcn(raw: string): { ok: true; name: string } | { ok: false; error: string } {
	try {
		const custom = parseTweakcnImport(raw);
		const name = custom.name ?? 'Custom';
		settings.theme = {
			presetId: 'custom',
			colorScheme: settings.theme.colorScheme,
			custom
		};
		persistSettings(settings);
		applyAppSettings(settings);
		return { ok: true, name };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Invalid theme'
		};
	}
}

export function updateEditorSettings(patch: Partial<EditorSettings>) {
	settings.editor = {
		...settings.editor,
		...patch
	};
	persistSettings(settings);
	applyAppSettings(settings);
}

export function updateTypographySettings(patch: Partial<TypographySettings>) {
	settings.typography = {
		...settings.typography,
		...patch
	};
	persistSettings(settings);
	applyAppSettings(settings);
}

export function resetSettings() {
	settings.theme = structuredClone(DEFAULT_SETTINGS.theme);
	settings.editor = structuredClone(DEFAULT_SETTINGS.editor);
	settings.typography = structuredClone(DEFAULT_SETTINGS.typography);
	persistSettings(settings);
	applyAppSettings(settings);
}

export function serializeSettings(): string {
	return JSON.stringify(settings, null, 2);
}

export function replaceSettingsFromJson(raw: string): { ok: true } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(raw) as unknown;
		const merged = mergeSettings(parsed);
		settings.theme = merged.theme;
		settings.editor = merged.editor;
		settings.typography = merged.typography;
		persistSettings(settings);
		applyAppSettings(settings);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Invalid JSON'
		};
	}
}

if (browser) {
	applyAppSettings(settings);
}
