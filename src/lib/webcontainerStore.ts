import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { initialCode } from '$lib/initialCode';
import { createWebContainerMount } from '$lib/webcontainerProject';
import {
	clearCachedSnapshot,
	isMountedProjectValid,
	loadCachedSnapshot,
	saveCachedSnapshot,
	SNAPSHOT_VERSION
} from '$lib/webcontainerSnapshot';
import type { IFSWatcher, WebContainer } from '@webcontainer/api';

interface PreviewState {
	loading: boolean;
	booting: boolean;
	error: string;
	previewUrl: string;
	previewPort: number | null;
	phase: string;
	fs?: WebContainer['fs'];
	container?: WebContainer;
	logs: string[];
	treeGeneration: number;
	restoredFromSnapshot: boolean;
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
		previewPort: null,
		phase: 'idle',
		logs: [],
		treeGeneration: 0,
		restoredFromSnapshot: false
	});

	let pendingLines: string[] = [];
	let flushScheduled = false;
	let snapshotSaveTimer: ReturnType<typeof setTimeout> | undefined;
	let fsWatcher: IFSWatcher | null = null;
	let treeBumpTimer: ReturnType<typeof setTimeout> | undefined;

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

	function bumpTreeGeneration() {
		update((s) => ({ ...s, treeGeneration: s.treeGeneration + 1 }));
	}

	function scheduleTreeBump() {
		if (treeBumpTimer) clearTimeout(treeBumpTimer);
		treeBumpTimer = setTimeout(() => {
			treeBumpTimer = undefined;
			bumpTreeGeneration();
		}, 150);
	}

	function stopFilesystemWatch() {
		fsWatcher?.close();
		fsWatcher = null;
		if (treeBumpTimer) {
			clearTimeout(treeBumpTimer);
			treeBumpTimer = undefined;
		}
	}

	function startFilesystemWatch(container: WebContainer) {
		stopFilesystemWatch();
		try {
			fsWatcher = container.fs.watch('/', { recursive: true }, () => {
				scheduleTreeBump();
				scheduleSnapshotSave(container);
			});
		} catch (error) {
			console.warn('Filesystem watch unavailable:', error);
		}
	}

	function scheduleSnapshotSave(container: WebContainer) {
		if (snapshotSaveTimer) clearTimeout(snapshotSaveTimer);
		snapshotSaveTimer = setTimeout(() => {
			void saveCachedSnapshot(container).catch(console.warn);
		}, 3000);
	}

	function exposeFilesystem(container: WebContainer) {
		update((s) => ({ ...s, fs: container.fs }));
		startFilesystemWatch(container);
		bumpTreeGeneration();
	}

	async function startDevServer(
		container: WebContainer,
		timeout: ReturnType<typeof setTimeout>
	): Promise<boolean> {
		setPhase('Starting dev server…');
		const dev = await container.spawn('npm', ['run', 'dev']);
		void pipeOutput(dev, 'dev');

		return new Promise((resolve) => {
			let settled = false;
			const finish = (ok: boolean) => {
				if (settled) return;
				settled = true;
				resolve(ok);
			};

			container.on('server-ready', (port, url) => {
				clearTimeout(timeout);
				update((s) => ({
					...s,
					phase: 'Ready',
					previewUrl: url,
					previewPort: port,
					loading: false,
					booting: false,
					fs: container.fs
				}));
				bumpTreeGeneration();
				pushLog(`Server ready at ${url}`);
				flushLogs();
				finish(true);
			});

			dev.exit.then((code) => {
				if (code !== 0) {
					update((s) => ({
						...s,
						booting: false,
						loading: false,
						error: s.error || `Dev server exited with code ${code}`
					}));
					finish(false);
				}
			});
		});
	}

	async function freshInstall(container: WebContainer, timeout: ReturnType<typeof setTimeout>) {
		setPhase('Mounting project files…');
		await container.mount(createWebContainerMount(initialCode));
		exposeFilesystem(container);
		bumpTreeGeneration();

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
		bumpTreeGeneration();

		setPhase('Saving project snapshot…');
		await saveCachedSnapshot(container);
		pushLog('Cached project snapshot for faster reloads.');

		update((s) => ({ ...s, restoredFromSnapshot: false }));
		return startDevServer(container, timeout);
	}

	async function replaceContainer(): Promise<WebContainer> {
		let current: PreviewState | undefined;
		subscribe((s) => (current = s))();
		stopFilesystemWatch();
		current?.container?.teardown();

		const { WebContainer } = await import('@webcontainer/api');
		const container = await WebContainer.boot({
			forwardPreviewErrors: true,
			workdirName: 'svelte-repl'
		});
		update((s) => ({
			...s,
			container,
			fs: undefined,
			previewUrl: '',
			previewPort: null,
			error: '',
			restoredFromSnapshot: false
		}));
		pushLog('Reset sandbox filesystem.');
		return container;
	}

	async function doInit() {
		if (!browser) return;

		update((s) => ({
			...s,
			booting: true,
			loading: true,
			error: '',
			previewUrl: '',
			previewPort: null,
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
			let container = await WebContainer.boot({
				forwardPreviewErrors: true,
				workdirName: 'svelte-repl'
			});
			update((s) => ({ ...s, container }));
			pushLog('WebContainer booted.');

			const cachedSnapshot = await loadCachedSnapshot(SNAPSHOT_VERSION);

			if (cachedSnapshot) {
				setPhase('Restoring cached project…');
				await container.mount(cachedSnapshot);

				if (await isMountedProjectValid(container)) {
					update((s) => ({ ...s, restoredFromSnapshot: true }));
					exposeFilesystem(container);
					pushLog('Restored project from local snapshot.');
					bumpTreeGeneration();

					update((s) => ({ ...s, error: '' }));
					const started = await startDevServer(container, timeout);
					if (started) return;

					pushLog('Cached snapshot failed to start dev server — rebuilding project.');
				} else {
					pushLog('Cached snapshot is incomplete — rebuilding project.');
				}

				await clearCachedSnapshot();
				update((s) => ({
					...s,
					error: '',
					loading: true,
					booting: true,
					restoredFromSnapshot: false
				}));
				container = await replaceContainer();
			}

			const started = await freshInstall(container, timeout);
			if (!started) return;
		} catch (e: unknown) {
			clearTimeout(timeout);
			if (browser) window.__appBuilderWcInit = undefined;
			console.error('Error initializing WebContainer:', e);
			const errorMsg = e instanceof Error ? e.message : 'Boot error';
			set({
				loading: false,
				booting: false,
				error: errorMsg,
				previewUrl: '',
				previewPort: null,
				phase: 'error',
				logs: capLogs([], errorMsg),
				treeGeneration: 0,
				restoredFromSnapshot: false
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
		appendLog: (line: string) => {
			pushLog(line);
			flushLogs();
		},
		boot,
		write: async (path: string, content: string) => {
			await boot();
			let snapshot: PreviewState | undefined;
			subscribe((s) => (snapshot = s))();
			if (snapshot?.fs && snapshot.container) {
				const filePath = path.startsWith('/') ? path.slice(1) : path;
				await snapshot.fs.writeFile(filePath, content);
				scheduleSnapshotSave(snapshot.container);
				scheduleTreeBump();
			}
		},
		notifyFilesystemChange: () => {
			scheduleTreeBump();
		},
		getContainer: () => {
			let snapshot: PreviewState | undefined;
			subscribe((s) => (snapshot = s))();
			return snapshot?.container;
		},
		clearSnapshot: async () => {
			await clearCachedSnapshot();
		},
		reboot: async (options?: { clearSnapshot?: boolean }) => {
			await clearCachedSnapshot();
			if (browser) {
				window.__appBuilderWcInit = undefined;
				location.reload();
			}
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
