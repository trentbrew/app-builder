import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { initialCode } from '$lib/initialCode';
import { createWebContainerMount } from '$lib/webcontainerProject';
import type { WebContainer } from '@webcontainer/api';

interface PreviewState {
	loading: boolean;
	booting: boolean;
	error: string;
	previewUrl: string;
	phase: string;
	fs?: WebContainer['fs'];
	container?: WebContainer;
	logs: string[];
}

const BOOT_TIMEOUT_MS = 120_000;
const MAX_LOGS = 200;
const STORE_KEY = '__appBuilderWcStore__';

type WebContainerStore = ReturnType<typeof createWebContainerStore>;

declare global {
	interface Window {
		__appBuilderWcInit?: Promise<void>;
		[STORE_KEY]?: WebContainerStore;
	}
}

function capLogs(logs: string[], line: string) {
	const next = line.replace(/\r?\n$/, '');
	if (!next) return logs;
	const merged = [...logs, next];
	return merged.length > MAX_LOGS ? merged.slice(-MAX_LOGS) : merged;
}

function createWebContainerStore() {
	const { subscribe, set, update } = writable<PreviewState>({
		loading: false,
		booting: false,
		error: '',
		previewUrl: '',
		phase: 'idle',
		logs: []
	});

	let pendingLines: string[] = [];
	let flushScheduled = false;

	function flushLogs() {
		flushScheduled = false;
		if (!pendingLines.length) return;
		const batch = pendingLines;
		pendingLines = [];
		update((s) => {
			let logs = s.logs;
			for (const line of batch) logs = capLogs(logs, line);
			return { ...s, logs };
		});
	}

	function pushLog(line: string) {
		pendingLines.push(line);
		if (!flushScheduled) {
			flushScheduled = true;
			requestAnimationFrame(flushLogs);
		}
	}

	function setPhase(phase: string) {
		update((s) => ({ ...s, phase }));
		pushLog(phase);
	}

	async function pipeOutput(process: { output: ReadableStream<string> }, prefix: string) {
		const reader = process.output.getReader();
		let buffer = '';

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += value;
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (line.trim()) pushLog(`[${prefix}] ${line}`);
			}
		}

		if (buffer.trim()) pushLog(`[${prefix}] ${buffer}`);
		flushLogs();
	}

	async function doInit() {
		if (!browser) return;

		update((s) => ({
			...s,
			booting: true,
			loading: true,
			error: '',
			previewUrl: '',
			phase: 'starting',
			logs: capLogs(s.logs, 'Starting WebContainer…')
		}));

		const timeout = setTimeout(() => {
			update((s) => ({
				...s,
				booting: false,
				loading: false,
				error:
					s.error ||
					'Boot timed out. Close other tabs on this site, hard-refresh, and try again.'
			}));
		}, BOOT_TIMEOUT_MS);

		try {
			const { WebContainer } = await import('@webcontainer/api');

			setPhase('Booting WebContainer…');
			const container = await WebContainer.boot({
				forwardPreviewErrors: true,
				workdirName: 'svelte-repl'
			});
			update((s) => ({ ...s, container }));
			pushLog('WebContainer booted.');

			setPhase('Mounting project files…');
			await container.mount(createWebContainerMount(initialCode));

			setPhase('Installing dependencies…');
			const install = await container.spawn('npm', [
				'install',
				'--no-audit',
				'--no-fund',
				'--legacy-peer-deps'
			]);
			const [exitCode] = await Promise.all([install.exit, pipeOutput(install, 'install')]);

			if (exitCode !== 0) {
				throw new Error(
					`npm install failed (exit ${exitCode}). Check Server logs for details — often a dependency version mismatch.`
				);
			}

			pushLog('Dependencies installed.');

			setPhase('Starting dev server…');
			const dev = await container.spawn('npm', ['run', 'dev']);
			void pipeOutput(dev, 'dev');

			container.on('server-ready', (_port, url) => {
				clearTimeout(timeout);
				update((s) => ({
					...s,
					phase: 'Ready',
					previewUrl: url,
					loading: false,
					booting: false,
					fs: container.fs
				}));
				pushLog(`Server ready at ${url}`);
				flushLogs();
			});

			dev.exit.then((code) => {
				if (code !== 0) {
					update((s) => ({
						...s,
						booting: false,
						loading: false,
						error: s.error || `Dev server exited with code ${code}`
					}));
				}
			});
		} catch (e: unknown) {
			clearTimeout(timeout);
			console.error('Error initializing WebContainer:', e);
			const errorMsg = e instanceof Error ? e.message : 'Boot error';
			set({
				loading: false,
				booting: false,
				error: errorMsg,
				previewUrl: '',
				phase: 'error',
				logs: capLogs([], errorMsg)
			});
		}
	}

	function boot() {
		if (!browser) return Promise.resolve();
		if (window.__appBuilderWcInit) return window.__appBuilderWcInit;

		let snapshot: PreviewState | undefined;
		subscribe((s) => (snapshot = s))();
		if (snapshot?.booting || snapshot?.previewUrl) return window.__appBuilderWcInit ?? Promise.resolve();

		window.__appBuilderWcInit = doInit();
		return window.__appBuilderWcInit;
	}

	return {
		subscribe,
		boot,
		write: async (path: string, content: string) => {
			await boot();
			let snapshot: PreviewState | undefined;
			subscribe((s) => (snapshot = s))();
			if (snapshot?.fs) {
				const filePath = path.startsWith('/') ? path.slice(1) : path;
				await snapshot.fs.writeFile(filePath, content);
			}
		},
		getContainer: () => {
			let snapshot: PreviewState | undefined;
			subscribe((s) => (snapshot = s))();
			return snapshot?.container;
		},
		reboot: () => {
			if (browser) location.reload();
		}
	};
}

function getStore() {
	if (browser && window[STORE_KEY]) return window[STORE_KEY]!;
	const store = createWebContainerStore();
	if (browser) window[STORE_KEY] = store;
	return store;
}

export const webcontainerStore = getStore();

export function getFs() {
	let fs: WebContainer['fs'] | undefined;
	webcontainerStore.subscribe((state) => {
		fs = state.fs;
	})();
	return fs;
}
