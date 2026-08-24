export type EditorChromeHeight = 'compact' | 'default' | 'comfortable';

export type EditorActiveTabIndicator = 'none' | 'accent' | 'tint' | 'both';

export type EditorActiveTabAccentColor = 'orange' | 'primary' | 'foreground';

export interface EditorSettings {
	/** Shared height for tab bars and pane toolbars. */
	chromeHeight: EditorChromeHeight;
	/** How the active tab is highlighted within a pane. */
	activeTabIndicator: EditorActiveTabIndicator;
	/** Accent color used for the active tab highlight. */
	activeTabAccentColor: EditorActiveTabAccentColor;
}

export interface AppSettings {
	editor: EditorSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
	editor: {
		chromeHeight: 'default',
		activeTabIndicator: 'both',
		activeTabAccentColor: 'orange'
	}
};

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
