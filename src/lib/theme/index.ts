export { applyTheme, clearAppliedTheme } from '$lib/theme/apply';
export { parseTweakcnImport, parseTweakcnRegistry, resolveRegistryItem } from '$lib/theme/parse';
export {
	THEME_PRESETS,
	fetchTweakcnPreset,
	getPresetRegistry,
	resolveThemeSettings
} from '$lib/theme/presets/index';
export type {
	ColorScheme,
	ResolvedTheme,
	ShadcnModeVars,
	ThemePresetMeta,
	ThemeSettings,
	TweakcnRegistryItem
} from '$lib/theme/types';
