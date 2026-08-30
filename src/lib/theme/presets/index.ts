import studio from '$lib/theme/presets/studio.json';
import tweakcnManifest from '$lib/theme/presets/tweakcn-manifest.json';
import { resolveRegistryItem } from '$lib/theme/parse';
import type { ResolvedTheme, ThemePresetMeta, ThemeSettings, TweakcnRegistryItem } from '$lib/theme/types';

const tweakcnModules = import.meta.glob<TweakcnRegistryItem>('./tweakcn/*.json', {
	eager: true,
	import: 'default'
});

const TWEAKCN_PRESET_ITEMS = Object.fromEntries(
	Object.entries(tweakcnModules).map(([filePath, item]) => {
		const id = filePath.replace('./tweakcn/', '').replace(/\.json$/, '');
		return [id, item];
	})
) as Record<string, TweakcnRegistryItem>;

export const THEME_PRESETS: ThemePresetMeta[] = [
	{
		id: 'darkmatter',
		name: 'Darkmatter',
		description: 'Default app-builder theme'
	},
	{
		id: 'studio',
		name: 'Trellis Studio',
		description: 'Original Trellis Studio palette'
	},
	...tweakcnManifest.filter((preset) => preset.id !== 'darkmatter')
];

const PRESET_ITEMS: Record<string, TweakcnRegistryItem> = {
	studio,
	...TWEAKCN_PRESET_ITEMS
};

export function getPresetRegistry(presetId: string): TweakcnRegistryItem | null {
	return PRESET_ITEMS[presetId] ?? null;
}

export function resolveThemeSettings(theme: ThemeSettings): ResolvedTheme {
	if (theme.presetId === 'custom' && theme.custom) {
		return resolveRegistryItem(theme.custom, theme.custom.name ?? 'Custom');
	}

	const preset = getPresetRegistry(theme.presetId) ?? getPresetRegistry('darkmatter') ?? studio;
	const meta = THEME_PRESETS.find((p) => p.id === theme.presetId);
	return resolveRegistryItem(preset, meta?.name ?? preset.name ?? 'Theme');
}

export async function fetchTweakcnPreset(slug: string): Promise<TweakcnRegistryItem> {
	const bundled = getPresetRegistry(slug);
	if (bundled) return bundled;

	const response = await fetch(`https://tweakcn.com/r/themes/${slug}.json`);
	if (!response.ok) {
		throw new Error(`Could not load theme "${slug}" from tweakcn`);
	}
	return (await response.json()) as TweakcnRegistryItem;
}
