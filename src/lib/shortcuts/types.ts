import type { ShortcutContext } from '$lib/shortcuts/shortcutContext';

/** Platform-primary modifier: ⌘ on macOS, Ctrl elsewhere. */
export type Mod =
	| 'mod'
	| 'mod+alt'
	| 'mod+shift'
	| 'mod+alt+ctrl'
	| 'mod+alt+shift'
	| 'alt'
	| 'shift'
	| 'ctrl'
	| 'ctrl+alt'
	| 'ctrl+shift'
	| 'alt+shift'
	| 'ctrl+alt+shift';

export interface ShortcutChord {
	modifier?: Mod;
	key: string;
}

export interface ShortcutRegistration {
	id: string;
	chords: ShortcutChord[];
	/** When false, suppressed inside editor/content surfaces. Default: false for shell shortcuts. */
	allowInContent?: boolean;
	when?: (context: ShortcutContext) => boolean;
	handler: (event: KeyboardEvent) => void;
	/** Higher priority wins when multiple shortcuts match. */
	priority?: number;
}

export interface ShortcutRoot {
	register: (registration: ShortcutRegistration) => void;
	unregister: (id: string) => void;
	invokeById: (id: string, source: 'menu' | 'keydown') => void;
	destroy: () => void;
}
