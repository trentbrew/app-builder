const NAMED_KEY_CODES: Record<string, string> = {
	' ': 'Space',
	',': 'Comma',
	'.': 'Period',
	'\\': 'Backslash',
	'=': 'Equal',
	'+': 'Equal',
	'-': 'Minus'
};

/** Match a shortcut key against a keyboard event using physical key codes when needed. */
export function matchShortcutKey(event: KeyboardEvent, key: string): boolean {
	if (key.length === 1 && /[a-zA-Z]/.test(key)) {
		return event.code === `Key${key.toUpperCase()}`;
	}
	const code = NAMED_KEY_CODES[key];
	if (code) {
		if (event.code === code) return true;
		if (key === '.' && event.code === 'NumpadDecimal') return true;
		if (key === ',' && event.code === 'NumpadComma') return true;
		if ((key === '=' || key === '+') && event.code === 'NumpadAdd') return true;
		if (key === '-' && event.code === 'NumpadSubtract') return true;
		return event.key === key;
	}
	return event.key === key;
}
