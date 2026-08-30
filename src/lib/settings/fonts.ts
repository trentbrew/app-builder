/** Patched Nerd Font face used for terminal icon / Powerline glyphs. */
export const TERMINAL_NERD_FONT = 'JetBrainsMono Nerd Font Mono';

/** Mono Nerd Font for terminal output (includes Powerline / Nerd Font glyphs). */
export const TERMINAL_FONT_FAMILY =
	`'${TERMINAL_NERD_FONT}', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

export const TERMINAL_FONT_URL = '/fonts/JetBrainsMonoNLNerdFontMono-Regular.woff2';

/** Ensure the Nerd Font is loaded before xterm measures glyphs. */
export async function loadTerminalFont(fontSize = 13): Promise<void> {
	if (typeof document === 'undefined') return;

	try {
		await document.fonts.load(`400 ${fontSize}px "${TERMINAL_NERD_FONT}"`);
		await document.fonts.ready;
	} catch {
		// Fall back to the rest of TERMINAL_FONT_FAMILY if load fails.
	}
}
