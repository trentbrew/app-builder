import { browser } from '$app/environment';
import { previewConsole, type PreviewConsoleLevel } from '$lib/previewConsole.svelte';

const CONSOLE_MESSAGE_TYPES = new Set<PreviewConsoleLevel>([
	'log',
	'info',
	'warn',
	'error',
	'debug'
]);

let listenersInstalled = false;

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
}

if (browser) {
	installPreviewConsoleListener();
}
