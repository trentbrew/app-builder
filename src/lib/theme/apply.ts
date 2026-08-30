import { SHADCN_COLOR_KEYS, SHADCN_THEME_KEYS, toColorVar, toThemeVar } from '$lib/theme/tokens';
import type { ColorScheme, ResolvedTheme, ShadcnModeVars } from '$lib/theme/types';

const STYLE_ID = 'app-theme-runtime';
export const THEME_CHANGE_EVENT = 'app-builder:theme-change';
let systemMedia: MediaQueryList | null = null;
let systemListener: ((event: MediaQueryListEvent) => void) | null = null;

const SOFT_BORDER_KEYS = new Set(['border', 'sidebar-border']);
const BORDER_SOFTEN = 0.8;

function formatColorValue(key: string, value: string): string {
	if (SOFT_BORDER_KEYS.has(key)) {
		return `color-mix(in oklch, ${value} ${BORDER_SOFTEN * 100}%, transparent)`;
	}
	return value;
}

function declarations(vars: ShadcnModeVars, prefix: 'color' | 'theme'): string {
	const lines: string[] = [];
	if (prefix === 'color') {
		for (const key of SHADCN_COLOR_KEYS) {
			const value = vars[key];
			if (value) lines.push(`  ${toColorVar(key)}: ${formatColorValue(key, value)};`);
		}
	} else {
		for (const key of SHADCN_THEME_KEYS) {
			const value = vars[key];
			if (value) lines.push(`  ${toThemeVar(key)}: ${value};`);
		}
	}
	return lines.join('\n');
}

function deriveChromeVars(mode: 'dark' | 'light'): string {
	const accentChrome = [
		'  --status-bar-background: var(--color-primary);',
		'  --status-bar-foreground: var(--color-primary-foreground);',
		'  --editor-tab-active-accent: var(--color-primary);'
	];

	if (mode === 'dark') {
		return [
			...accentChrome,
			'  --status-bar-hover: color-mix(in oklch, var(--color-primary) 82%, black);',
			'  --color-chrome-surface: color-mix(in oklch, var(--color-background) 86%, black);',
			'  --color-agent-chat-surface: var(--color-card);',
			'  --color-agent-composer-surface: color-mix(in oklch, var(--color-foreground) 10%, var(--color-background));',
			'  --editor-pane-canvas: color-mix(in oklch, var(--color-background) 70%, black);',
			'  --scrollbar-thumb: oklch(1 0 0 / 10%);',
			'  --scrollbar-thumb-hover: oklch(1 0 0 / 20%);'
		].join('\n');
	}
	return [
		...accentChrome,
		'  --status-bar-hover: color-mix(in oklch, var(--color-primary) 85%, white);',
		'  --color-chrome-surface: var(--color-background);',
		'  --color-agent-chat-surface: var(--color-card);',
		'  --color-agent-composer-surface: color-mix(in oklch, var(--color-foreground) 10%, var(--color-background));',
		'  --editor-pane-canvas: color-mix(in oklch, var(--color-background) 84%, black);',
		'  --scrollbar-thumb: oklch(0 0 0 / 10%);',
		'  --scrollbar-thumb-hover: oklch(0 0 0 / 20%);'
	].join('\n');
}

function buildThemeCss(resolved: ResolvedTheme): string {
	const sharedTheme = declarations(resolved.theme, 'theme');
	const darkColors = declarations(resolved.dark, 'color');
	const lightColors = declarations(resolved.light, 'color');

	return `:root {
${sharedTheme}
${darkColors}
${deriveChromeVars('dark')}
  color-scheme: dark;
}
.light {
${sharedTheme}
${lightColors}
${deriveChromeVars('light')}
  color-scheme: light;
}`;
}

function resolveEffectiveScheme(colorScheme: ColorScheme): 'dark' | 'light' {
	if (colorScheme === 'system' && typeof window !== 'undefined') {
		return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	}
	return colorScheme === 'light' ? 'light' : 'dark';
}

function applyDocumentScheme(colorScheme: ColorScheme) {
	const root = document.documentElement;
	const effective = resolveEffectiveScheme(colorScheme);
	root.classList.toggle('light', effective === 'light');
	root.dataset.colorScheme = colorScheme;
}

function detachSystemListener() {
	if (systemMedia && systemListener) {
		systemMedia.removeEventListener('change', systemListener);
	}
	systemMedia = null;
	systemListener = null;
}

function attachSystemListener(onChange: () => void) {
	if (typeof window === 'undefined') return;
	detachSystemListener();
	systemMedia = window.matchMedia('(prefers-color-scheme: light)');
	systemListener = () => onChange();
	systemMedia.addEventListener('change', systemListener);
}

export function applyTheme(resolved: ResolvedTheme, colorScheme: ColorScheme) {
	if (typeof document === 'undefined') return;

	let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement('style');
		style.id = STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = buildThemeCss(resolved);

	const syncScheme = () => applyDocumentScheme(colorScheme);
	if (colorScheme === 'system') {
		attachSystemListener(syncScheme);
	} else {
		detachSystemListener();
	}
	syncScheme();
	if (typeof document !== 'undefined') {
		document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
	}
}

export function clearAppliedTheme() {
	document.getElementById(STYLE_ID)?.remove();
	detachSystemListener();
}
