/** tweakcn / shadcn registry theme item (subset we consume). */
export interface TweakcnRegistryItem {
	name?: string;
	cssVars?: {
		theme?: Record<string, string>;
		light?: Record<string, string>;
		dark?: Record<string, string>;
	};
}

export type ShadcnModeVars = Record<string, string>;

export interface ResolvedTheme {
	name: string;
	theme: ShadcnModeVars;
	light: ShadcnModeVars;
	dark: ShadcnModeVars;
}

export type ColorScheme = 'dark' | 'light' | 'system';

export interface ThemeSettings {
	/** Built-in preset id, or `custom` when imported from tweakcn. */
	presetId: string;
	colorScheme: ColorScheme;
	/** Populated when `presetId === 'custom'`. */
	custom?: TweakcnRegistryItem;
}

export interface ThemePresetMeta {
	id: string;
	name: string;
	description?: string;
}
