/** Semantic color keys in tweakcn `cssVars.light` / `cssVars.dark`. */
export const SHADCN_COLOR_KEYS = [
	'background',
	'foreground',
	'card',
	'card-foreground',
	'popover',
	'popover-foreground',
	'primary',
	'primary-foreground',
	'secondary',
	'secondary-foreground',
	'muted',
	'muted-foreground',
	'accent',
	'accent-foreground',
	'destructive',
	'destructive-foreground',
	'border',
	'input',
	'ring',
	'chart-1',
	'chart-2',
	'chart-3',
	'chart-4',
	'chart-5',
	'sidebar',
	'sidebar-foreground',
	'sidebar-primary',
	'sidebar-primary-foreground',
	'sidebar-accent',
	'sidebar-accent-foreground',
	'sidebar-border',
	'sidebar-ring'
] as const;

export const SHADCN_THEME_KEYS = ['radius', 'font-sans', 'font-mono', 'font-serif'] as const;

export type ShadcnColorKey = (typeof SHADCN_COLOR_KEYS)[number];
export type ShadcnThemeKey = (typeof SHADCN_THEME_KEYS)[number];

export function toColorVar(key: string): string {
	return `--color-${key}`;
}

export function toThemeVar(key: string): string {
	return key === 'radius' ? '--radius' : `--${key}`;
}
