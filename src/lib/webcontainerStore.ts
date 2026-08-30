import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { dexieProjectStore } from '$lib/projects/dexieProjectStore';
import { getTemplate } from '$lib/projects/templates';
import { getActiveProjectId, getActiveUserTemplateId, setActiveProjectScope, setActiveUserTemplateScope } from '$lib/projects/projectScope';
import { clearPreviewFrame } from '$lib/previewFrame';
import {
	hideProjectSwitch,
	setProjectSwitchDetail,
	showProjectSwitch
} from '$lib/projects/projectSwitch.svelte';
import { setActiveProjectId as resetAgentSnapshots } from '$lib/agentHarness/snapshotStore';
import { ensureWebContainerShellConfig } from '$lib/webcontainerShell';
import { ensureThumbnailCaptureScript } from '$lib/projects/ensureThumbnailCapture';
import expoWcPreload from '$lib/projects/templates/expoWcPreload.cjs?raw';
import expoDevScript from '$lib/projects/templates/expoDev.cjs?raw';
import { EXPO_COMPAT_VERSION, EXPO_DEV_SCRIPT } from '$lib/projects/templates/expoConstants';
import { WEBCONTAINER_BOOT_OPTIONS, webcontainerUserTemplateWorkdir, webcontainerWorkdir } from '$lib/webcontainerBootOptions';
import {
	captureAndSaveProjectThumbnail,
	scheduleProjectThumbnailCapture
} from '$lib/projects/projectThumbnail';
import {
	clearCachedSnapshot,
	isMountedProjectValid,
	loadCachedSnapshot,
	loadUserTemplateSnapshot,
	saveCachedSnapshot,
	saveUserTemplateSnapshotFromContainer,
	type CachedSnapshot
} from '$lib/webcontainerSnapshot';
import { normalizeSandboxPath } from '$lib/sandbox/paths';
import {
	markEditorSaveFailed,
	markEditorSaveFinished,
	markEditorSaveStarted
} from '$lib/editorSaveState.svelte';
import type { IFSWatcher, WebContainer } from '@webcontainer/api';
import type { ProjectRecord, UserTemplateRecord } from '$lib/projects/types';
import type { ProjectTemplate } from '$lib/projects/types';
import { userTemplateStore } from '$lib/projects/userTemplateStore';

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
	projectId: string | null;
	projectName: string | null;
	templateId: string | null;
	expoGoUrl: string;
}

const BOOT_TIMEOUT_MS = 120_000;
const MAX_LOGS = 200;
const STORE_KEY = '__appBuilderWcStore__';
const SNAPSHOT_SAVE_DEBOUNCE_MS = 1_000;

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
		restoredFromSnapshot: false,
		projectId: null,
		projectName: null,
		templateId: null,
		expoGoUrl: ''
	});

	let pendingLines: string[] = [];
	let flushScheduled = false;
	let snapshotSaveTimer: ReturnType<typeof setTimeout> | undefined;
	let fsWatcher: IFSWatcher | null = null;
	let treeBumpTimer: ReturnType<typeof setTimeout> | undefined;
	let currentProjectId: string | null = null;
	let currentUserTemplateId: string | null = null;
	let currentUserTemplate: UserTemplateRecord | null = null;
	let currentTemplate: ProjectTemplate | null = null;
	let saveGeneration = 0;

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
		maybeParseExpoGoUrl(line);
		if (!flushScheduled) {
			flushScheduled = true;
			requestAnimationFrame(flushLogs);
		}
	}

	function maybeParseExpoGoUrl(line: string) {
		if (currentTemplate?.id !== 'expo') return;
		const clean = line.replace(/\u001b\[[0-9;?]*m/g, '');
		const match = clean.match(/exp:\/\/[^\s[\]]+/);
		if (!match) return;
		const url = match[0];
		update((s) => (s.expoGoUrl === url ? s : { ...s, expoGoUrl: url }));
	}

	function setPhase(phase: string) {
		update((s) => ({ ...s, phase }));
		pushLog(phase);
		setProjectSwitchDetail(phase);
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

	function scheduleSnapshotSave(container: WebContainer) {
		if (!currentTemplate) return;
		const scopeId = currentUserTemplateId ?? currentProjectId;
		if (!scopeId) return;
		if (snapshotSaveTimer) clearTimeout(snapshotSaveTimer);
		const gen = ++saveGeneration;
		snapshotSaveTimer = setTimeout(() => {
			snapshotSaveTimer = undefined;
			void persistSandboxSnapshot(container).then(() => {
				if (gen !== saveGeneration) return;
			});
		}, SNAPSHOT_SAVE_DEBOUNCE_MS);
	}

	async function persistSandboxSnapshot(container: WebContainer): Promise<boolean> {
		if (!currentTemplate) return false;
		if (currentUserTemplateId && currentUserTemplate) {
			const ok = await saveUserTemplateSnapshotFromContainer(
				container,
				currentUserTemplateId,
				currentUserTemplate.snapshotVersion,
				currentUserTemplate.baseTemplateId
			);
			if (ok) await userTemplateStore.touch(currentUserTemplateId);
			return ok;
		}
		if (currentProjectId) {
			return saveCachedSnapshot(
				container,
				currentProjectId,
				currentTemplate.snapshotVersion,
				currentTemplate.id
			);
		}
		return false;
	}

	async function flushPendingSnapshot() {
		if (snapshotSaveTimer) {
			clearTimeout(snapshotSaveTimer);
			snapshotSaveTimer = undefined;
		}
		if ((!currentProjectId && !currentUserTemplateId) || !currentTemplate) return;
		let snapshot: PreviewState | undefined;
		subscribe((s) => (snapshot = s))();
		if (!snapshot?.container) return;
		saveGeneration++;
		const ok = await persistSandboxSnapshot(snapshot.container);
		if (!ok) throw new Error('Failed to flush sandbox snapshot');
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

	function exposeFilesystem(container: WebContainer) {
		update((s) => ({ ...s, fs: container.fs }));
		startFilesystemWatch(container);
		bumpTreeGeneration();
	}

	async function installDependencies(container: WebContainer): Promise<void> {
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
	}

	async function nodeModulesPresent(container: WebContainer): Promise<boolean> {
		try {
			const entries = await container.fs.readdir('node_modules');
			return Array.isArray(entries) && entries.length > 0;
		} catch {
			return false;
		}
	}

	/** Expo in WebContainer: patch legacy snapshots (port 8081, preload, peer deps). */
	const EXPO_PEER_DEPS: Record<string, string> = {
		'expo-constants': '~17.1.3',
		'expo-linking': '~7.1.3'
	};

	function logsSuggestExpoStackCrash() {
		let logs: string[] = [];
		subscribe((s) => (logs = s.logs))();
		const joined = logs.join('\n');
		return /getFileName|callerCallsite/i.test(joined);
	}

	async function rebuildExpoAfterCrash(
		container: WebContainer,
		project: ProjectRecord,
		template: ProjectTemplate,
		timeout: ReturnType<typeof setTimeout>
	): Promise<WebContainer> {
		pushLog('Expo dev server stack crash — clearing snapshot and rebuilding.');
		await clearCachedSnapshot(project.id);
		update((s) => ({ ...s, error: '', loading: true, booting: true }));
		return replaceContainer(webcontainerWorkdir(project.templateId));
	}

	async function patchExpoProject(container: WebContainer): Promise<{ patched: boolean; needsInstall: boolean }> {
		let patched = false;
		let needsInstall = false;
		try {
			const raw = await container.fs.readFile('package.json', 'utf-8');
			const pkg = JSON.parse(raw) as {
				scripts?: Record<string, string>;
				dependencies?: Record<string, string>;
				appBuilderExpoCompat?: string;
			};
			const dev = pkg.scripts?.dev ?? '';
			const legacyDev =
				dev.includes('NODE_OPTIONS') ||
				dev.includes('wc-preload.js') ||
				dev.includes('--require=./wc-preload.cjs') ||
				dev.includes('expo start --web') ||
				dev.includes('--port 3000');

			if (dev !== EXPO_DEV_SCRIPT || legacyDev || pkg.appBuilderExpoCompat !== EXPO_COMPAT_VERSION) {
				if (!pkg.scripts) pkg.scripts = {};
				pkg.scripts.dev = EXPO_DEV_SCRIPT;
				pkg.appBuilderExpoCompat = EXPO_COMPAT_VERSION;
				patched = true;
			}

			if (!pkg.dependencies) pkg.dependencies = {};
			for (const [name, version] of Object.entries(EXPO_PEER_DEPS)) {
				if (!pkg.dependencies[name]) {
					pkg.dependencies[name] = version;
					patched = true;
					needsInstall = true;
				}
			}

			if (patched) {
				await container.fs.writeFile('package.json', JSON.stringify(pkg, null, 2));
			}

			await container.fs.writeFile('expo-dev.cjs', expoDevScript);
			await container.fs.writeFile('wc-preload.cjs', expoWcPreload);
			await container.fs.writeFile('wc-preload.js', expoWcPreload);
			patched = true;

			try {
				const rm = await container.spawn('rm', ['-f', 'wc-preload.mjs']);
				await rm.exit;
			} catch {
				// ignore legacy cleanup failures
			}
		} catch {
			return { patched: false, needsInstall: false };
		}
		return { patched, needsInstall };
	}

	async function startDevServerForTemplate(
		container: WebContainer,
		timeout: ReturnType<typeof setTimeout>,
		template: ProjectTemplate
	): Promise<boolean> {
		if (template.id === 'expo') {
			const { patched, needsInstall } = await patchExpoProject(container);
			if (needsInstall) {
				pushLog('Installing missing Expo peer dependencies…');
				showProjectSwitch('installing', 'Updating Expo dependencies…');
				await installDependencies(container);
			} else if (patched) {
				pushLog('Updated Expo project for WebContainer compatibility.');
			}
		}
		return startDevServer(container, timeout);
	}

	async function mountCachedSnapshot(container: WebContainer, cachedSnapshot: CachedSnapshot) {
		if (cachedSnapshot.format === 'json') {
			await container.mount(cachedSnapshot.tree);
			return;
		}
		await container.mount(cachedSnapshot.data);
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
				hideProjectSwitch();
				if (currentProjectId) {
					scheduleProjectThumbnailCapture(currentProjectId);
				} else if (currentUserTemplateId) {
					scheduleProjectThumbnailCapture(currentUserTemplateId);
				}
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
					hideProjectSwitch();
					finish(false);
				}
			});
		});
	}

	async function freshInstallUserTemplate(
		container: WebContainer,
		userTemplate: UserTemplateRecord,
		frameworkTemplate: ProjectTemplate,
		timeout: ReturnType<typeof setTimeout>
	) {
		showProjectSwitch('installing', `Installing ${userTemplate.name}…`);
		setPhase('Mounting template files…');
		const cachedSnapshot = await loadUserTemplateSnapshot(
			userTemplate.id,
			userTemplate.snapshotVersion
		);
		if (cachedSnapshot) {
			await mountCachedSnapshot(container, cachedSnapshot);
		} else {
			await container.mount(frameworkTemplate.createMount(frameworkTemplate.defaultAppContents));
		}
		await ensureWebContainerShellConfig(container);
		await ensureThumbnailCaptureScript(container);
		exposeFilesystem(container);
		bumpTreeGeneration();

		await installDependencies(container);

		setPhase('Saving template snapshot…');
		await persistSandboxSnapshot(container);
		pushLog('Cached template snapshot for faster reloads.');

		update((s) => ({ ...s, restoredFromSnapshot: false }));
		return startDevServerForTemplate(container, timeout, frameworkTemplate);
	}

	async function freshInstall(
		container: WebContainer,
		project: ProjectRecord,
		template: ProjectTemplate,
		timeout: ReturnType<typeof setTimeout>
	) {
		showProjectSwitch('installing', `Installing ${project.name}…`);
		setPhase('Mounting project files…');
		await container.mount(template.createMount(template.defaultAppContents));
		await ensureWebContainerShellConfig(container);
		await ensureThumbnailCaptureScript(container);
		exposeFilesystem(container);
		bumpTreeGeneration();

		await installDependencies(container);

		setPhase('Saving project snapshot…');
		await saveCachedSnapshot(container, project.id, template.snapshotVersion, template.id);
		pushLog('Cached project snapshot for faster reloads.');

		update((s) => ({ ...s, restoredFromSnapshot: false }));
		return startDevServerForTemplate(container, timeout, template);
	}

	async function replaceContainer(workdirName: string): Promise<WebContainer> {
		let current: PreviewState | undefined;
		subscribe((s) => (current = s))();
		stopFilesystemWatch();
		current?.container?.teardown();

		const { WebContainer } = await import('@webcontainer/api');
		const container = await WebContainer.boot({
			...WEBCONTAINER_BOOT_OPTIONS,
			workdirName
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

	async function teardownActive() {
		stopFilesystemWatch();
		if (snapshotSaveTimer) {
			clearTimeout(snapshotSaveTimer);
			snapshotSaveTimer = undefined;
		}
		saveGeneration++;
		let snapshot: PreviewState | undefined;
		subscribe((s) => (snapshot = s))();
		snapshot?.container?.teardown();
		if (browser) window.__appBuilderWcInit = undefined;
		update((s) => ({
			...s,
			container: undefined,
			fs: undefined,
			previewUrl: '',
			previewPort: null,
			booting: false,
			loading: false
		}));
	}

	async function releaseActiveProject() {
		await teardownActive();
		currentProjectId = null;
		currentUserTemplateId = null;
		currentUserTemplate = null;
		currentTemplate = null;
		setActiveProjectScope(null);
		setActiveUserTemplateScope(null);
		clearPreviewFrame();
		hideProjectSwitch();
		update((s) => ({
			...s,
			templateId: null,
			expoGoUrl: '',
			projectId: null,
			projectName: null
		}));
	}

	async function doInit(projectId: string) {
		if (!browser) return;

		const project = await dexieProjectStore.get(projectId);
		if (!project) {
			throw new Error(`Project not found: ${projectId}`);
		}

		const template = getTemplate(project.templateId);
		currentProjectId = projectId;
		currentUserTemplateId = null;
		currentUserTemplate = null;
		currentTemplate = template;
		setActiveProjectScope(project);
		resetAgentSnapshots(projectId);
		await dexieProjectStore.touch(projectId);

		update((s) => ({
			...s,
			booting: true,
			loading: true,
			error: '',
			previewUrl: '',
			previewPort: null,
			phase: 'starting',
			projectId: project.id,
			projectName: project.name,
			templateId: project.templateId,
			expoGoUrl: '',
			logs: capLogs(s.logs, `Starting WebContainer for ${project.name}…`)
		}));

		showProjectSwitch('installing', `Opening ${project.name}…`);

		const timeout = setTimeout(() => {
			update((s) => ({
				...s,
				booting: false,
				loading: false,
				error:
					s.error ||
					'Boot timed out. Close other tabs on this site, hard-refresh, and try again.'
			}));
			hideProjectSwitch();
		}, BOOT_TIMEOUT_MS);

		try {
			const { WebContainer } = await import('@webcontainer/api');

			setPhase('Booting WebContainer…');
			let container = await WebContainer.boot({
				...WEBCONTAINER_BOOT_OPTIONS,
				workdirName: webcontainerWorkdir(project.templateId)
			});
			update((s) => ({ ...s, container }));
			pushLog('WebContainer booted.');

			const cachedSnapshot = await loadCachedSnapshot(project.id, template.snapshotVersion);

			if (cachedSnapshot) {
				showProjectSwitch('restoring', `Restoring ${project.name}…`);
				setPhase('Restoring cached project…');
				try {
					await mountCachedSnapshot(container, cachedSnapshot);
				} catch (mountError) {
					pushLog(
						`Snapshot mount failed: ${mountError instanceof Error ? mountError.message : 'unknown error'}`
					);
					await clearCachedSnapshot(project.id);
					container = await replaceContainer(webcontainerWorkdir(project.templateId));
					const started = await freshInstall(container, project, template, timeout);
					if (!started) return;
					return;
				}

				if (await isMountedProjectValid(container)) {
					if (cachedSnapshot.format === 'json' && !(await nodeModulesPresent(container))) {
						showProjectSwitch('installing', `Installing ${project.name}…`);
						await installDependencies(container);
					}

					update((s) => ({ ...s, restoredFromSnapshot: true }));
					await ensureWebContainerShellConfig(container);
					await ensureThumbnailCaptureScript(container);
					exposeFilesystem(container);
					pushLog('Restored project from local snapshot.');
					bumpTreeGeneration();

					update((s) => ({ ...s, error: '' }));
					const started = await startDevServerForTemplate(container, timeout, template);
					if (started) return;

					pushLog('Dev server failed after snapshot restore — rebuilding project.');
					await clearCachedSnapshot(project.id);
					container = await replaceContainer(webcontainerWorkdir(project.templateId));
					const rebuilt = await freshInstall(container, project, template, timeout);
					if (!rebuilt) return;
					return;
				}

				try {
					const entries = await container.fs.readdir('/');
					const names = entries.map((entry) => String(entry));
					pushLog(`Snapshot restore root entries: ${names.join(', ') || '(empty)'}`);
				} catch (error) {
					pushLog(
						`Snapshot restore could not list root: ${error instanceof Error ? error.message : 'unknown error'}`
					);
				}

				pushLog('Cached snapshot is incomplete — rebuilding project.');
				await clearCachedSnapshot(project.id);
				update((s) => ({
					...s,
					error: '',
					loading: true,
					booting: true,
					restoredFromSnapshot: false
				}));
				container = await replaceContainer(webcontainerWorkdir(project.templateId));
			}

			let started = await freshInstall(container, project, template, timeout);
			if (!started && template.id === 'expo' && logsSuggestExpoStackCrash()) {
				container = await rebuildExpoAfterCrash(container, project, template, timeout);
				started = await freshInstall(container, project, template, timeout);
			}
			if (!started) return;
		} catch (e: unknown) {
			clearTimeout(timeout);
			if (browser) window.__appBuilderWcInit = undefined;
			console.error('Error initializing WebContainer:', e);
			const errorMsg = e instanceof Error ? e.message : 'Boot error';
			hideProjectSwitch();
			set({
				loading: false,
				booting: false,
				error: errorMsg,
				previewUrl: '',
				previewPort: null,
				phase: 'error',
				logs: capLogs([], errorMsg),
				treeGeneration: 0,
				restoredFromSnapshot: false,
				projectId: project.id,
				projectName: project.name,
				templateId: project.templateId,
				expoGoUrl: ''
			});
		}
	}

	async function doInitUserTemplate(templateId: string) {
		if (!browser) return;

		const userTemplate = await userTemplateStore.get(templateId);
		if (!userTemplate) {
			throw new Error(`Template not found: ${templateId}`);
		}

		const frameworkTemplate = getTemplate(userTemplate.baseTemplateId);
		currentProjectId = null;
		currentUserTemplateId = templateId;
		currentUserTemplate = userTemplate;
		currentTemplate = frameworkTemplate;
		setActiveUserTemplateScope(userTemplate);
		resetAgentSnapshots(templateId);
		await userTemplateStore.touch(templateId);

		update((s) => ({
			...s,
			booting: true,
			loading: true,
			error: '',
			previewUrl: '',
			previewPort: null,
			phase: 'starting',
			projectId: userTemplate.id,
			projectName: userTemplate.name,
			templateId: userTemplate.baseTemplateId,
			expoGoUrl: '',
			logs: capLogs(s.logs, `Starting WebContainer for template ${userTemplate.name}…`)
		}));

		showProjectSwitch('installing', `Opening ${userTemplate.name}…`);

		const timeout = setTimeout(() => {
			update((s) => ({
				...s,
				booting: false,
				loading: false,
				error:
					s.error ||
					'Boot timed out. Close other tabs on this site, hard-refresh, and try again.'
			}));
			hideProjectSwitch();
		}, BOOT_TIMEOUT_MS);

		try {
			const { WebContainer } = await import('@webcontainer/api');

			setPhase('Booting WebContainer…');
			let container = await WebContainer.boot({
				...WEBCONTAINER_BOOT_OPTIONS,
				workdirName: webcontainerUserTemplateWorkdir(userTemplate.id)
			});
			update((s) => ({ ...s, container }));
			pushLog('WebContainer booted.');

			const cachedSnapshot = await loadUserTemplateSnapshot(
				userTemplate.id,
				userTemplate.snapshotVersion
			);

			if (cachedSnapshot) {
				showProjectSwitch('restoring', `Restoring ${userTemplate.name}…`);
				setPhase('Restoring cached template…');
				try {
					await mountCachedSnapshot(container, cachedSnapshot);
				} catch (mountError) {
					pushLog(
						`Template snapshot mount failed: ${mountError instanceof Error ? mountError.message : 'unknown error'}`
					);
					container = await replaceContainer(webcontainerUserTemplateWorkdir(userTemplate.id));
					const started = await freshInstallUserTemplate(
						container,
						userTemplate,
						frameworkTemplate,
						timeout
					);
					if (!started) return;
					return;
				}

				if (await isMountedProjectValid(container)) {
					if (cachedSnapshot.format === 'json' && !(await nodeModulesPresent(container))) {
						showProjectSwitch('installing', `Installing ${userTemplate.name}…`);
						await installDependencies(container);
					}

					update((s) => ({ ...s, restoredFromSnapshot: true }));
					await ensureWebContainerShellConfig(container);
					await ensureThumbnailCaptureScript(container);
					exposeFilesystem(container);
					pushLog('Restored template from local snapshot.');
					bumpTreeGeneration();

					update((s) => ({ ...s, error: '' }));
					const started = await startDevServerForTemplate(container, timeout, frameworkTemplate);
					if (started) return;

					pushLog('Dev server failed after template restore — rebuilding template.');
					container = await replaceContainer(webcontainerUserTemplateWorkdir(userTemplate.id));
					const rebuilt = await freshInstallUserTemplate(
						container,
						userTemplate,
						frameworkTemplate,
						timeout
					);
					if (!rebuilt) return;
					return;
				}

				pushLog('Cached template snapshot is incomplete — rebuilding template.');
				container = await replaceContainer(webcontainerUserTemplateWorkdir(userTemplate.id));
			}

			const started = await freshInstallUserTemplate(
				container,
				userTemplate,
				frameworkTemplate,
				timeout
			);
			if (!started) return;
		} catch (e: unknown) {
			clearTimeout(timeout);
			if (browser) window.__appBuilderWcInit = undefined;
			console.error('Error initializing user template WebContainer:', e);
			const errorMsg = e instanceof Error ? e.message : 'Boot error';
			hideProjectSwitch();
			set({
				loading: false,
				booting: false,
				error: errorMsg,
				previewUrl: '',
				previewPort: null,
				phase: 'error',
				logs: capLogs([], errorMsg),
				treeGeneration: 0,
				restoredFromSnapshot: false,
				projectId: userTemplate.id,
				projectName: userTemplate.name,
				templateId: userTemplate.baseTemplateId,
				expoGoUrl: ''
			});
		}
	}

	async function saveActiveProject(options?: {
		overlay?: boolean;
		thumbnail?: boolean;
		snapshot?: boolean;
	}) {
		const scopeId = currentUserTemplateId ?? currentProjectId;
		if (!scopeId || !currentTemplate) return;
		let snapshot: PreviewState | undefined;
		subscribe((s) => (snapshot = s))();
		if (!snapshot?.container) return;
		saveGeneration++;
		if (snapshotSaveTimer) {
			clearTimeout(snapshotSaveTimer);
			snapshotSaveTimer = undefined;
		}
		const useOverlay = options?.overlay ?? false;
		const captureThumbnail = options?.thumbnail ?? true;
		const captureSnapshot = options?.snapshot ?? true;
		if (useOverlay) {
			showProjectSwitch('saving', `Saving ${snapshot.projectName ?? 'workspace'}…`);
		}
		try {
			if (captureThumbnail) {
				await captureAndSaveProjectThumbnail(scopeId);
			}
			if (captureSnapshot) {
				await persistSandboxSnapshot(snapshot.container);
			}
		} finally {
			hideProjectSwitch();
		}
	}

	async function boot(projectId?: string) {
		const targetId = projectId ?? getActiveProjectId();
		if (!targetId) return Promise.resolve();
		if (!browser) return Promise.resolve();

		const switchingScope =
			(currentUserTemplateId && currentUserTemplateId !== targetId) ||
			(currentProjectId && currentProjectId !== targetId) ||
			Boolean(currentUserTemplateId);

		if (switchingScope) {
			await saveActiveProject({ overlay: true });
			await teardownActive();
		}

		if (currentProjectId === targetId && window.__appBuilderWcInit) {
			return window.__appBuilderWcInit;
		}

		currentUserTemplateId = null;
		currentUserTemplate = null;
		window.__appBuilderWcInit = doInit(targetId);
		return window.__appBuilderWcInit;
	}

	async function bootUserTemplate(templateId?: string) {
		const targetId = templateId ?? getActiveUserTemplateId();
		if (!targetId) return Promise.resolve();
		if (!browser) return Promise.resolve();

		const switchingScope =
			(currentProjectId && currentProjectId !== targetId) ||
			(currentUserTemplateId && currentUserTemplateId !== targetId) ||
			Boolean(currentProjectId);

		if (switchingScope) {
			await saveActiveProject({ overlay: true });
			await teardownActive();
		}

		if (currentUserTemplateId === targetId && window.__appBuilderWcInit) {
			return window.__appBuilderWcInit;
		}

		currentProjectId = null;
		window.__appBuilderWcInit = doInitUserTemplate(targetId);
		return window.__appBuilderWcInit;
	}

	async function switchProject(fromId: string | null, toId: string) {
		if (fromId && fromId !== toId) {
			await saveActiveProject({ overlay: true });
			await teardownActive();
		}
		return boot(toId);
	}

	return {
		subscribe,
		appendLog: (line: string) => {
			pushLog(line);
			flushLogs();
		},
		boot,
		bootUserTemplate,
		saveActiveProject,
		flushPendingSnapshot,
		releaseActiveProject,
		switchProject,
		write: async (path: string, content: string) => {
			const tid = currentUserTemplateId ?? getActiveUserTemplateId();
			const pid = currentProjectId ?? getActiveProjectId();
			if (!tid && !pid) throw new Error('No active editor workspace');
			markEditorSaveStarted();
			try {
				if (tid) await bootUserTemplate(tid);
				else await boot(pid!);
				let snapshot: PreviewState | undefined;
				subscribe((s) => (snapshot = s))();
				const fs = snapshot?.fs ?? snapshot?.container?.fs;
				const container = snapshot?.container;
				if (!fs || !container) {
					throw new Error('Sandbox filesystem not ready');
				}
				const filePath = normalizeSandboxPath(path);
				await fs.writeFile(filePath, content);
				scheduleTreeBump();
				await flushPendingSnapshot();
				markEditorSaveFinished();
			} catch (error) {
				markEditorSaveFailed();
				throw error;
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
		clearSnapshot: async (projectId?: string) => {
			await clearCachedSnapshot(projectId ?? currentProjectId ?? undefined);
		},
		reboot: async (options?: { clearSnapshot?: boolean }) => {
			if (options?.clearSnapshot && currentProjectId) {
				await clearCachedSnapshot(currentProjectId);
			}
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
