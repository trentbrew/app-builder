import { SHADCN_COLOR_KEYS, SHADCN_THEME_KEYS } from '$lib/theme/tokens';
import type { ResolvedTheme, ShadcnModeVars, TweakcnRegistryItem } from '$lib/theme/types';

const COLOR_KEY_SET = new Set<string>(SHADCN_COLOR_KEYS);

export function parseTweakcnRegistry(raw: unknown): TweakcnRegistryItem {
	if (!raw || typeof raw !== 'object') {
		throw new Error('Theme JSON must be an object');
	}

	const item = raw as TweakcnRegistryItem;
	if (!item.cssVars || typeof item.cssVars !== 'object') {
		throw new Error('Missing cssVars — paste a tweakcn registry export');
	}

	if (!item.cssVars.light && !item.cssVars.dark) {
		throw new Error('cssVars must include light and/or dark mode tokens');
	}

	return item;
}

export function parseTweakcnImport(raw: string): TweakcnRegistryItem {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('Invalid JSON');
	}
	return parseTweakcnRegistry(parsed);
}

function pickModeVars(source: Record<string, string> | undefined): ShadcnModeVars {
	if (!source) return {};
	const out: ShadcnModeVars = {};
	for (const key of SHADCN_COLOR_KEYS) {
		const value = source[key];
		if (typeof value === 'string' && value.length > 0) out[key] = value;
	}
	return out;
}

function pickThemeVars(
	theme: Record<string, string> | undefined,
	light: ShadcnModeVars,
	dark: ShadcnModeVars
): ShadcnModeVars {
	const out: ShadcnModeVars = {};
	const merged = { ...theme, ...light, ...dark };
	for (const key of SHADCN_THEME_KEYS) {
		const value = merged[key];
		if (typeof value === 'string' && value.length > 0) out[key] = value;
	}
	return out;
}

export function resolveRegistryItem(item: TweakcnRegistryItem, name = item.name ?? 'Custom'): ResolvedTheme {
	const light = pickModeVars(item.cssVars?.light);
	const dark = pickModeVars(item.cssVars?.dark);
	const theme = pickThemeVars(item.cssVars?.theme, light, dark);

	// tweakcn uses :root=light, .dark=dark — we default dark on :root, so swap polarity if one side is missing.
	if (Object.keys(dark).length === 0 && Object.keys(light).length > 0) {
		return { name, theme, light, dark: light };
	}
	if (Object.keys(light).length === 0 && Object.keys(dark).length > 0) {
		return { name, theme, light: dark, dark };
	}

	return { name, theme, light, dark };
}

export function isTweakcnRegistry(raw: unknown): raw is TweakcnRegistryItem {
	return Boolean(
		raw &&
			typeof raw === 'object' &&
			'cssVars' in raw &&
			(raw as TweakcnRegistryItem).cssVars &&
			typeof (raw as TweakcnRegistryItem).cssVars === 'object'
	);
}
