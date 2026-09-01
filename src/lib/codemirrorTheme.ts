import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, type Extension } from '@codemirror/view';
import { isLightColorScheme } from '$lib/theme/apply';

const editorChromeTheme = EditorView.theme({
	'&': {
		backgroundColor: 'var(--color-background)',
		color: 'var(--color-foreground)',
		fontFamily: 'var(--font-mono)'
	},
	'.cm-scroller': {
		backgroundColor: 'var(--color-background)',
		fontFamily: 'var(--font-mono)'
	},
	'.cm-content': {
		backgroundColor: 'var(--color-background)',
		color: 'var(--color-foreground)',
		caretColor: 'var(--color-foreground)',
		fontFamily: 'var(--font-mono)',
		fontSize: 'var(--editor-font-size)'
	},
	'.cm-gutters': {
		backgroundColor: 'var(--color-editor-gutter)',
		color: 'var(--color-muted-foreground)',
		borderRight: '1px solid var(--color-border)',
		fontFamily: 'var(--font-mono)',
		fontSize: 'var(--editor-font-size)'
	},
	'.cm-activeLine': { backgroundColor: 'var(--color-active-line)' },
	'.cm-activeLineGutter': { backgroundColor: 'var(--color-active-line)' },
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
		backgroundColor: 'color-mix(in oklch, var(--color-primary) 24%, transparent) !important'
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'var(--color-foreground)'
	},
	'.cm-matchingBracket, .cm-nonmatchingBracket': {
		backgroundColor: 'color-mix(in oklch, var(--color-primary) 18%, transparent)'
	}
});

export function codeMirrorThemeExtension(isLight = isLightColorScheme()): Extension[] {
	if (isLight) {
		return [syntaxHighlighting(defaultHighlightStyle, { fallback: true }), editorChromeTheme];
	}
	return [oneDark, syntaxHighlighting(defaultHighlightStyle, { fallback: true }), editorChromeTheme];
}
