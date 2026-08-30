import { allowsShellShortcuts, resolveShortcutContext } from '$lib/shortcuts/shortcutContext';
import { matchShortcutKey } from '$lib/shortcuts/matchKey';
import { getNormalizedModifier, hasChordPrefix } from '$lib/shortcuts/mod';
import type { ShortcutChord, ShortcutRegistration, ShortcutRoot } from '$lib/shortcuts/types';

const DEDUP_MS = 100;

function chordKey(chord: ShortcutChord): string {
	return `${chord.modifier ?? ''}|${chord.key}`;
}

function assertNoChordConflicts(registrations: ShortcutRegistration[]) {
	if (import.meta.env.PROD) return;
	const seen = new Map<string, string>();
	for (const reg of registrations) {
		for (const chord of reg.chords) {
			const key = chordKey(chord);
			const existing = seen.get(key);
			if (existing && existing !== reg.id) {
				console.warn(
					`[shortcuts] chord conflict: "${key}" registered by both "${existing}" and "${reg.id}"`
				);
			}
			seen.set(key, reg.id);
		}
	}
}

export function createShortcutRoot(): ShortcutRoot {
	const registrations: ShortcutRegistration[] = [];
	const recentHandled = new Map<string, number>();
	let destroyed = false;

	function sorted(): ShortcutRegistration[] {
		return [...registrations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}

	function isDuplicate(id: string): boolean {
		const at = recentHandled.get(id);
		return at !== undefined && Date.now() - at < DEDUP_MS;
	}

	function markHandled(id: string) {
		recentHandled.set(id, Date.now());
	}

	function onKeyDown(event: KeyboardEvent) {
		if (destroyed || event.repeat) return;
		if (!hasChordPrefix(event)) return;

		const modifier = getNormalizedModifier(event);
		const context = resolveShortcutContext(event.target);

		for (const reg of sorted()) {
			for (const chord of reg.chords) {
				if (chord.modifier !== modifier) continue;
				if (!matchShortcutKey(event, chord.key)) continue;

				if (reg.allowInContent !== true && !allowsShellShortcuts(context)) continue;
				if (reg.when && !reg.when(context)) continue;
				if (isDuplicate(reg.id)) continue;

				event.preventDefault();
				event.stopImmediatePropagation();
				reg.handler(event);
				markHandled(reg.id);
				return;
			}
		}
	}

	window.addEventListener('keydown', onKeyDown, { capture: true });

	return {
		register(registration) {
			registrations.push(registration);
			assertNoChordConflicts(registrations);
		},
		unregister(id) {
			const index = registrations.findIndex((reg) => reg.id === id);
			if (index >= 0) registrations.splice(index, 1);
		},
		invokeById(id, _source) {
			if (destroyed || isDuplicate(id)) return;
			const reg = registrations.find((entry) => entry.id === id);
			if (!reg) return;
			reg.handler(new KeyboardEvent('keydown'));
			markHandled(id);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			window.removeEventListener('keydown', onKeyDown, { capture: true });
			registrations.length = 0;
			recentHandled.clear();
		}
	};
}
