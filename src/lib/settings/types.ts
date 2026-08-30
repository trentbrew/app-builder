import type { ColorScheme, ThemeSettings } from '$lib/theme/types';

export type { ColorScheme, ThemeSettings };

export type EditorChromeHeight = 'compact' | 'default' | 'comfortable';

export type EditorActiveTabIndicator = 'none' | 'accent' | 'tint' | 'both';

export type EditorActiveTabAccentColor = 'primary' | 'brand-orange' | 'foreground';

export type EditorPaneStyle = 'flush' | 'cards';

export type EditorLayoutPresetId = 'classic' | 'agent-focus';

export type EditorMarkdownPropertiesLayout = 'sidebar' | 'inline';

export interface EditorSettings {
	/** Shared height for tab bars and pane toolbars. */
	chromeHeight: EditorChromeHeight;
	/** How the active tab is highlighted within a pane. */
	activeTabIndicator: EditorActiveTabIndicator;
	/** Accent color used for the active tab highlight. */
	activeTabAccentColor: EditorActiveTabAccentColor;
	/** Pane chrome: edge-to-edge splits or rounded cards with gaps. */
	paneStyle: EditorPaneStyle;
	/** Default dock arrangement for new projects and layout preset apply. */
	layoutPreset: EditorLayoutPresetId;
	/** Gap between card panes in pixels (cards mode only). */
	paneGap: number;
	/** Keep an empty pane (labelled 'Blank') when its last tab closes, instead of removing it. */
	keepEmptyPanes: boolean;
	/** YAML frontmatter panel: sidebar rail or Linear-style inline header above the editor. */
	markdownPropertiesLayout: EditorMarkdownPropertiesLayout;
	/** Stretch a lone tab to fill the tab bar width (dock panes and agent rail). */
	stretchSingleTabs: boolean;
	/** Write editor changes to the sandbox automatically (Cmd+S still saves when off). */
	autoSaveToSandbox: boolean;
}

export interface TypographySettings {
	/** Code editor font size in pixels. */
	editorFontSize: number;
	/** Terminal, server logs, and preview console font size in pixels. */
	terminalFontSize: number;
	/** File explorer tree font size in pixels. */
	explorerFontSize: number;
}

export interface AppSettings {
	theme: ThemeSettings;
	editor: EditorSettings;
	typography: TypographySettings;
}

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const DEFAULT_EDITOR_FONT_SIZE = 13;
export const DEFAULT_TERMINAL_FONT_SIZE = DEFAULT_EDITOR_FONT_SIZE;
export const DEFAULT_EXPLORER_FONT_SIZE = 13;

export const DEFAULT_SETTINGS: AppSettings = {
	theme: {
		presetId: 'studio',
		colorScheme: 'dark'
	},
	editor: {
		chromeHeight: 'default',
		activeTabIndicator: 'both',
		activeTabAccentColor: 'primary',
		paneStyle: 'flush',
		layoutPreset: 'classic',
		paneGap: 6,
		keepEmptyPanes: false,
		markdownPropertiesLayout: 'sidebar',
		stretchSingleTabs: true,
		autoSaveToSandbox: false
	},
	typography: {
		editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
		terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
		explorerFontSize: DEFAULT_EXPLORER_FONT_SIZE
	}
};

export const EDITOR_PANE_GAP_MIN = 2;
export const EDITOR_PANE_GAP_MAX = 20;
export const EDITOR_PANE_GAP_DEFAULT = 6;

export const EDITOR_LAYOUT_PRESET_OPTIONS: {
	value: EditorLayoutPresetId;
	label: string;
	description: string;
}[] = [
	{
		value: 'classic',
		label: 'Classic',
		description: 'Files · editor · preview on top; terminal · logs · console below'
	},
	{
		value: 'agent-focus',
		label: 'Agent focus',
		description: 'Agent left · editor + output center · files right'
	}
];

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
	{ value: 'primary', label: 'Theme primary' },
	{ value: 'brand-orange', label: 'Brand orange' },
	{ value: 'foreground', label: 'Foreground' }
];

export const EDITOR_MARKDOWN_PROPERTIES_LAYOUT_OPTIONS: {
	value: EditorMarkdownPropertiesLayout;
	label: string;
	description: string;
}[] = [
	{
		value: 'sidebar',
		label: 'Sidebar',
		description: 'Properties rail on the right — more room for many fields'
	},
	{
		value: 'inline',
		label: 'Inline',
		description: 'Title, description, and properties above the editor — like Linear'
	}
];

export const COLOR_SCHEME_OPTIONS: {
	value: ColorScheme;
	label: string;
	description: string;
}[] = [
	{ value: 'dark', label: 'Dark', description: 'Always use the dark palette' },
	{ value: 'light', label: 'Light', description: 'Always use the light palette' },
	{ value: 'system', label: 'System', description: 'Follow the OS appearance preference' }
];
