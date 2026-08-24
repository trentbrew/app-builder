export type EditorChromeHeight = 'compact' | 'default' | 'comfortable';

export type EditorActiveTabIndicator = 'none' | 'accent' | 'tint' | 'both';

export type EditorActiveTabAccentColor = 'orange' | 'primary' | 'foreground';

export type EditorPaneStyle = 'flush' | 'cards';

export interface EditorSettings {
	/** Shared height for tab bars and pane toolbars. */
	chromeHeight: EditorChromeHeight;
	/** How the active tab is highlighted within a pane. */
	activeTabIndicator: EditorActiveTabIndicator;
	/** Accent color used for the active tab highlight. */
	activeTabAccentColor: EditorActiveTabAccentColor;
	/** Pane chrome: edge-to-edge splits or rounded cards with gaps. */
	paneStyle: EditorPaneStyle;
	/** Gap between card panes in pixels (cards mode only). */
	paneGap: number;
	/** Keep an empty pane (labelled 'Blank') when its last tab closes, instead of removing it. */
	keepEmptyPanes: boolean;
}

export interface AppSettings {
	editor: EditorSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
	editor: {
		chromeHeight: 'default',
		activeTabIndicator: 'both',
		activeTabAccentColor: 'orange',
		paneStyle: 'flush',
		paneGap: 6,
		keepEmptyPanes: false
	}
};

export const EDITOR_PANE_GAP_MIN = 2;
export const EDITOR_PANE_GAP_MAX = 20;
export const EDITOR_PANE_GAP_DEFAULT = 6;

export const EDITOR_PANE_STYLE_OPTIONS: {
	value: EditorPaneStyle;
	label: string;
	description: string;
}[] = [
	{ value: 'flush', label: 'Flush', description: 'Edge-to-edge panes with shared borders' },
	{
		value: 'cards',
		label: 'Rounded cards',
		description: 'Separate panes with small gaps and rounded corners'
	}
];

export const EDITOR_CHROME_HEIGHT_OPTIONS: {
	value: EditorChromeHeight;
	label: string;
	description: string;
}[] = [
	{ value: 'compact', label: 'Compact', description: '1.75rem — tighter chrome rows' },
	{ value: 'default', label: 'Default', description: '2rem — balanced tab + toolbar height' },
	{ value: 'comfortable', label: 'Comfortable', description: '2.25rem — roomier controls' }
];

export const EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS: {
	value: EditorActiveTabIndicator;
	label: string;
	description: string;
}[] = [
	{ value: 'none', label: 'None', description: 'Active tab uses default styling only' },
	{ value: 'accent', label: 'Top accent', description: 'Colored line above the active tab' },
	{ value: 'tint', label: 'Background tint', description: 'Subtle fill on the active tab' },
	{ value: 'both', label: 'Accent + tint', description: 'Top accent line and background tint' }
];

export const EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS: {
	value: EditorActiveTabAccentColor;
	label: string;
}[] = [
	{ value: 'orange', label: 'Status orange' },
	{ value: 'primary', label: 'Primary' },
	{ value: 'foreground', label: 'Foreground' }
];
