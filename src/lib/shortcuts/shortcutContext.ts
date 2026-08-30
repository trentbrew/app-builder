export type ShortcutContext =
	| 'code'
	| 'markdown'
	| 'terminal'
	| 'preview'
	| 'browser'
	| 'chrome'
	| 'pane-toolbar'
	| 'global';

const CONTENT_CONTEXTS: ReadonlySet<ShortcutContext> = new Set([
	'code',
	'markdown',
	'terminal',
	'preview',
	'browser'
]);

export function resolveShortcutContext(target: EventTarget | null): ShortcutContext {
	const el = target instanceof HTMLElement ? target : null;
	if (!el) return 'global';

	const marked = el.closest('[data-shortcut-context]');
	if (marked instanceof HTMLElement && marked.dataset.shortcutContext) {
		return marked.dataset.shortcutContext as ShortcutContext;
	}

	if (el.closest('.xterm')) return 'terminal';
	if (el.closest('.cm-editor')) return 'code';
	if (el.closest('.ProseMirror')) return 'markdown';
	if (el.closest('iframe')) return 'preview';

	return 'global';
}

/** True when layout/shell shortcuts may run (not inside editor surfaces). */
export function allowsShellShortcuts(context: ShortcutContext): boolean {
	return !CONTENT_CONTEXTS.has(context);
}
