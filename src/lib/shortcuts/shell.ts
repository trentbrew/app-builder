import { resolveActiveLayoutHandle } from '$lib/layoutHandle';
import type { ShortcutRoot } from '$lib/shortcuts/types';

export interface ShellShortcutOptions {
	onToggleExplorer?: () => void;
	onToggleCommandPalette?: () => void;
	onBrowserZoom?: (delta: number) => void;
	onSaveActiveFile?: () => void;
}

export function registerShellShortcuts(root: ShortcutRoot, options: ShellShortcutOptions) {
	const { onToggleExplorer, onToggleCommandPalette, onBrowserZoom, onSaveActiveFile } = options;

	const layout = () => resolveActiveLayoutHandle();

	if (onBrowserZoom) {
		root.register({
			id: 'browser.zoomIn',
			chords: [{ modifier: 'mod', key: '=' }],
			allowInContent: true,
			handler: () => onBrowserZoom(0.1)
		});

		root.register({
			id: 'browser.zoomOut',
			chords: [{ modifier: 'mod', key: '-' }],
			allowInContent: true,
			handler: () => onBrowserZoom(-0.1)
		});
	}

	root.register({
		id: 'tab.close',
		chords: [{ modifier: 'alt', key: 'x' }],
		allowInContent: true,
		handler: () => layout()?.closeActiveTab()
	});

	root.register({
		id: 'tab.add',
		chords: [{ modifier: 'alt', key: ' ' }],
		allowInContent: false,
		handler: () => layout()?.appendActivePane()
	});

	if (onToggleExplorer) {
		root.register({
			id: 'explorer.toggle',
			chords: [{ modifier: 'mod', key: 'b' }],
			allowInContent: true,
			handler: () => onToggleExplorer()
		});
	}

	if (onToggleCommandPalette) {
		root.register({
			id: 'commandPalette.toggle',
			chords: [{ modifier: 'mod', key: 'k' }],
			allowInContent: true,
			handler: () => onToggleCommandPalette()
		});
	}

	root.register({
		id: 'layout.splitDown',
		chords: [{ modifier: 'mod+alt', key: '\\' }],
		allowInContent: true,
		handler: () => layout()?.splitActivePane('down')
	});

	root.register({
		id: 'layout.splitRight',
		chords: [{ modifier: 'mod', key: '\\' }],
		allowInContent: true,
		handler: () => layout()?.splitActivePane('right')
	});

	root.register({
		id: 'layout.splitFibonacci',
		chords: [{ modifier: 'mod+alt+ctrl', key: '\\' }],
		allowInContent: true,
		handler: () => layout()?.splitActivePaneFibonacci()
	});

	root.register({
		id: 'layout.frame',
		chords: [{ modifier: 'mod', key: 'g' }],
		allowInContent: true,
		handler: () => layout()?.frameActive()
	});

	root.register({
		id: 'tab.prev',
		chords: [{ modifier: 'mod', key: ',' }],
		allowInContent: true,
		handler: () => layout()?.selectAdjacentTab(-1)
	});

	root.register({
		id: 'tab.next',
		chords: [{ modifier: 'mod', key: '.' }],
		allowInContent: true,
		handler: () => layout()?.selectAdjacentTab(1)
	});

	if (onSaveActiveFile) {
		root.register({
			id: 'editor.save',
			chords: [{ modifier: 'mod', key: 's' }],
			allowInContent: true,
			when: (context) => context === 'code' || context === 'markdown',
			priority: 10,
			handler: () => onSaveActiveFile()
		});
	}
}
