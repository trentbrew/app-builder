import { refreshPreviewPosition } from '$lib/previewFrame';
import {
	EDITOR_PANE_GAP_DEFAULT,
	EDITOR_PANE_GAP_MAX,
	EDITOR_PANE_GAP_MIN,
	type AppSettings
} from '$lib/settings/types';

const CHROME_HEIGHTS = {
	compact: '1.75rem',
	default: '2rem',
	comfortable: '2.25rem'
} as const;

const ACCENT_COLORS = {
	orange: 'oklch(0.58 0.17 48)',
	primary: 'var(--color-primary)',
	foreground: 'var(--color-foreground)'
} as const;

export function applyUiSettings(settings: AppSettings) {
	if (typeof document === 'undefined') return;

	const root = document.documentElement;
	const { editor } = settings;

	root.style.setProperty('--editor-chrome-height', CHROME_HEIGHTS[editor.chromeHeight]);
	root.style.setProperty('--editor-tab-active-accent', ACCENT_COLORS[editor.activeTabAccentColor]);

	const showAccent =
		editor.activeTabIndicator === 'accent' || editor.activeTabIndicator === 'both';
	const showTint = editor.activeTabIndicator === 'tint' || editor.activeTabIndicator === 'both';

	root.style.setProperty('--editor-tab-active-accent-width', showAccent ? '2px' : '0px');
	root.style.setProperty('--editor-tab-active-tint-strength', showTint ? '10%' : '0%');

	const paneGap = clampPaneGap(editor.paneGap);
	root.style.setProperty('--editor-pane-gap', `${paneGap}px`);
	root.style.setProperty('--editor-pane-gap-half', `${paneGap / 2}px`);

	root.dataset.editorPaneStyle = editor.paneStyle;
	refreshPreviewPosition();
}

function clampPaneGap(value: number | undefined): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return EDITOR_PANE_GAP_DEFAULT;
	return Math.min(EDITOR_PANE_GAP_MAX, Math.max(EDITOR_PANE_GAP_MIN, Math.round(value)));
}
