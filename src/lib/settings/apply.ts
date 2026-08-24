import type { AppSettings } from '$lib/settings/types';

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
}
