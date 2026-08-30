import { refreshPreviewPosition } from '$lib/previewFrame';
import { TERMINAL_FONT_FAMILY } from '$lib/settings/fonts';
import {
	EDITOR_PANE_GAP_DEFAULT,
	EDITOR_PANE_GAP_MAX,
	EDITOR_PANE_GAP_MIN,
	FONT_SIZE_MAX,
	FONT_SIZE_MIN,
	type AppSettings
} from '$lib/settings/types';
import { applyTheme, resolveThemeSettings } from '$lib/theme';

const CHROME_HEIGHTS = {
	compact: '1.75rem',
	default: '2rem',
	comfortable: '2.25rem'
} as const;

const ACCENT_COLORS = {
	'brand-orange': 'oklch(0.58 0.17 48)',
	foreground: 'var(--color-foreground)'
} as const;

export function applyAppSettings(settings: AppSettings) {
	applyTheme(resolveThemeSettings(settings.theme), settings.theme.colorScheme);
	applyUiSettings(settings);
}

export function applyUiSettings(settings: AppSettings) {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;
	const { editor, typography } = settings;

	root.style.setProperty('--editor-font-size', `${clampFontSize(typography.editorFontSize)}px`);
	root.style.setProperty('--terminal-font-size', `${clampFontSize(typography.terminalFontSize)}px`);
	root.style.setProperty('--explorer-font-size', `${clampFontSize(typography.explorerFontSize)}px`);
	root.style.setProperty('--font-terminal', TERMINAL_FONT_FAMILY);

	root.style.setProperty('--editor-chrome-height', CHROME_HEIGHTS[editor.chromeHeight]);
	if (editor.activeTabAccentColor === 'primary') {
		root.style.removeProperty('--editor-tab-active-accent');
	} else {
		root.style.setProperty(
			'--editor-tab-active-accent',
			ACCENT_COLORS[editor.activeTabAccentColor]
		);
	}

	const showAccent =
		editor.activeTabIndicator === 'accent' || editor.activeTabIndicator === 'both';
	const showTint = editor.activeTabIndicator === 'tint' || editor.activeTabIndicator === 'both';

	root.style.setProperty('--editor-tab-active-accent-width', showAccent ? '2px' : '0px');
	root.style.setProperty('--editor-tab-active-tint-strength', showTint ? '10%' : '0%');

	const paneGap = clampPaneGap(editor.paneGap);
	root.style.setProperty('--editor-pane-gap', `${paneGap}px`);
	root.style.setProperty('--editor-pane-gap-half', `${paneGap / 2}px`);

	root.dataset.editorPaneStyle = editor.paneStyle;
	root.dataset.editorStretchSingleTabs = editor.stretchSingleTabs ? 'true' : 'false';
	refreshPreviewPosition();
}

function clampPaneGap(value: number | undefined): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return EDITOR_PANE_GAP_DEFAULT;
	return Math.min(EDITOR_PANE_GAP_MAX, Math.max(EDITOR_PANE_GAP_MIN, Math.round(value)));
}

function clampFontSize(value: number | undefined): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return FONT_SIZE_MIN;
	return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}
