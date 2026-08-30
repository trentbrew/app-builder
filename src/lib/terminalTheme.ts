function readCssVariable(variable: string, property: 'backgroundColor' | 'color'): string {
	if (typeof document === 'undefined') return '';

	const probe = document.createElement('div');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
	if (property === 'backgroundColor') {
		probe.style.background = `var(${variable})`;
	} else {
		probe.style.color = `var(${variable})`;
	}
	document.body.appendChild(probe);
	const value = getComputedStyle(probe)[property];
	probe.remove();
	return value;
}

export function xtermThemeFromDocument() {
	return {
		background: readCssVariable('--color-background', 'backgroundColor'),
		foreground: readCssVariable('--color-foreground', 'color'),
		cursor: readCssVariable('--color-foreground', 'color'),
		selectionBackground: readCssVariable('--color-accent', 'backgroundColor'),
	};
}
