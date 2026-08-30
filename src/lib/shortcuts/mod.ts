import type { Mod } from './types';

export function isMacPlatform(): boolean {
	return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

/** Map keyboard state to a normalized modifier token (`mod` = ⌘ on Mac, Ctrl elsewhere). */
export function getNormalizedModifier(event: KeyboardEvent): Mod | null {
	const mac = isMacPlatform();
	const { metaKey, ctrlKey, altKey, shiftKey } = event;
	const mod = mac ? metaKey : ctrlKey;

	if (mod && altKey && ctrlKey && !shiftKey) return 'mod+alt+ctrl';
	if (mod && altKey && shiftKey) return 'mod+alt+shift';
	if (mod && altKey) return 'mod+alt';
	if (mod && shiftKey) return 'mod+shift';
	if (ctrlKey && altKey && shiftKey && !mod) return 'ctrl+alt+shift';
	if (altKey && shiftKey && !mod && !ctrlKey) return 'alt+shift';
	if (ctrlKey && shiftKey && !mod) return 'ctrl+shift';
	if (ctrlKey && altKey && !mod) return 'ctrl+alt';
	if (shiftKey && !mod && !altKey && !ctrlKey) return 'shift';
	if (altKey && !mod && !shiftKey) return 'alt';
	if (mod) return 'mod';
	if (ctrlKey) return 'ctrl';
	return null;
}

/** True when the event includes a modifier or named chord prefix worth matching. */
export function hasChordPrefix(event: KeyboardEvent): boolean {
	return getNormalizedModifier(event) !== null;
}
