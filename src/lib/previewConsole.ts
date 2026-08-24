import { browser } from '$app/environment';
import { previewConsole, type PreviewConsoleLevel } from '$lib/previewConsole.svelte';
import { sandboxStore } from '$lib/sandboxStore';

const CONSOLE_MESSAGE_TYPES = new Set<PreviewConsoleLevel>([
	'log',
	'info',
	'warn',
	'error',
	'debug'
]);

let listenersInstalled = false;
let booting = false;

function handlePreviewMessage(event: MessageEvent) {
	const type = event.data?.type;
	if (!CONSOLE_MESSAGE_TYPES.has(type)) return;

	const args = Array.isArray(event.data.args) ? event.data.args : [event.data.args ?? event.data.message];
	previewConsole.append(type, args);
}

export function installPreviewConsoleListener() {
	if (!browser || listenersInstalled) return;
	listenersInstalled = true;

	window.addEventListener('message', handlePreviewMessage);

	sandboxStore.subscribe((state) => {
		if (state.booting && !booting) {
			previewConsole.clear();
		}
		booting = state.booting;
	});
}

if (browser) {
	installPreviewConsoleListener();
}
