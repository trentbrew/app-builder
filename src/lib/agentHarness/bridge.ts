import { browser } from '$app/environment';
import { sandboxStore } from '$lib/sandboxStore';
import { webcontainerStore } from '$lib/webcontainerStore';
import { normalizeSandboxPath } from '$lib/sandbox/paths';
import { getActiveProjectId } from '$lib/projects/projectScope';
import { dexieProjectStore } from '$lib/projects/dexieProjectStore';
import { getTemplate } from '$lib/projects/templates';
import { loadCachedSnapshot, cachedSnapshotSize, getSnapshotMetadata } from '$lib/webcontainerSnapshot';
import { appendToolLog } from '$lib/agentHarness/harnessStore.svelte';
import { isGuestPathWritable, normalizeGuestPath } from '$lib/agentHarness/pathAllowlist';
import type { HarnessEnvelope } from '$lib/agentHarness/types';

let installed = false;

const E2E_FS_TIMEOUT_MS = 120_000;

function readWebcontainerSnapshot() {
	let snapshot:
		| {
				error: string;
				phase: string;
				previewUrl: string;
				templateId: string | null;
				logs: string[];
		  }
		| undefined;
	webcontainerStore.subscribe((state) => {
		snapshot = {
			error: state.error,
			phase: state.phase,
			previewUrl: state.previewUrl,
			templateId: state.templateId,
			logs: state.logs
		};
	})();
	return snapshot;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until WebContainer boot exposes a readable project filesystem (e2e / post-reload). */
async function waitForSandboxFilesystem(timeoutMs = E2E_FS_TIMEOUT_MS) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const pid = getActiveProjectId();
		if (pid) await sandboxStore.boot(pid);

		const container = sandboxStore.getContainer();
		if (container) {
			try {
				await container.fs.readFile(normalizeSandboxPath('package.json'), 'utf-8');
				return { container };
			} catch {
				// boot / restore still in progress
			}
		}

		const fs = sandboxStore.getFs();
		if (fs) {
			try {
				await fs.readFile('package.json', 'utf-8');
				return { fs };
			} catch {
				// not ready yet
			}
		}

		await sleep(100);
	}
	throw new Error('filesystem not ready');
}

function isHarnessEnvelope(data: unknown): data is HarnessEnvelope {
	if (!data || typeof data !== 'object') return false;
	const d = data as Record<string, unknown>;
	return d.v === 1 && typeof d.dir === 'string' && typeof d.type === 'string';
}

function replyToGuest(source: MessageEventSource | null, envelope: HarnessEnvelope) {
	if (!source || typeof (source as Window).postMessage !== 'function') return;
	(source as Window).postMessage(envelope, '*');
}

async function handleGuestCall(
	event: MessageEvent,
	envelope: Extract<HarnessEnvelope, { type: 'call' }>
) {
	const { id, method, args } = envelope;

	if (method === 'write') {
		replyToGuest(event.source, {
			v: 1,
			dir: 'host→guest',
			type: 'call-result',
			id,
			ok: false,
			error: 'write denied in v1 — use host edit_component'
		});
		appendToolLog({
			kind: 'deny',
			summary: `[deny] callTool write ${args.path}`,
			path: args.path
		});
		return;
	}

	const path = normalizeGuestPath(args.path);
	if (!isGuestPathWritable(path)) {
		replyToGuest(event.source, {
			v: 1,
			dir: 'host→guest',
			type: 'call-result',
			id,
			ok: false,
			error: 'path not readable'
		});
		return;
	}

	const fs = sandboxStore.getFs();
	if (!fs) {
		replyToGuest(event.source, {
			v: 1,
			dir: 'host→guest',
			type: 'call-result',
			id,
			ok: false,
			error: 'filesystem not ready'
		});
		return;
	}

	try {
		const content = await fs.readFile(path, 'utf-8');
		replyToGuest(event.source, {
			v: 1,
			dir: 'host→guest',
			type: 'call-result',
			id,
			ok: true,
			result: content
		});
		appendToolLog({
			kind: 'read',
			summary: `read ${path}`,
			path
		});
	} catch (err) {
		replyToGuest(event.source, {
			v: 1,
			dir: 'host→guest',
			type: 'call-result',
			id,
			ok: false,
			error: err instanceof Error ? err.message : 'read failed'
		});
	}
}

function handleGuestEmit(envelope: Extract<HarnessEnvelope, { type: 'emit' }>) {
	const { name, data } = envelope.payload;
	sandboxStore.appendLog(`[iframe-ui] ${name}${data !== undefined ? ` ${JSON.stringify(data)}` : ''}`);
	appendToolLog({
		kind: 'emit',
		summary: `emit ${name}`,
		payload: data
	});
}

async function onMessage(event: MessageEvent) {
	if (!isHarnessEnvelope(event.data)) return;
	const envelope = event.data;
	if (envelope.dir !== 'guest→host') return;

	if (envelope.type === 'emit') {
		handleGuestEmit(envelope);
		return;
	}

	if (envelope.type === 'call') {
		await handleGuestCall(event, envelope);
	}
}

/** Install host-side postMessage bridge (idempotent). */
export function initAgentHarnessBridge() {
	if (!browser || installed) return;
	installed = true;
	window.addEventListener('message', onMessage);
}

/** Dev/test hook — expose harness edit path on window. */
export function exposeHarnessDevHooks(editComponent: typeof import('./editComponent').editComponent) {
	if (!browser) return;
	(window as Window & { __harnessEditComponent?: typeof editComponent }).__harnessEditComponent =
		editComponent;

	(
		window as Window & {
			__e2eWriteSandboxFile?: (
				path: string,
				content: string,
				encoding?: 'utf-8' | 'base64'
			) => Promise<void>;
		}
	).__e2eWriteSandboxFile = async (path, content, encoding = 'utf-8') => {
		await waitForSandboxFilesystem();
		if (encoding === 'base64') {
			const fs = sandboxStore.getFs();
			if (!fs?.writeBinary) {
				throw new Error('binary writes are not available');
			}
			const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
			await fs.writeBinary(path, bytes);
		} else {
			await sandboxStore.write(path, content);
		}
		sandboxStore.notifyFilesystemChange();
	};

	(window as Window & { __e2eReadSandboxFile?: (path: string) => Promise<string> }).__e2eReadSandboxFile =
		async (path) => {
			const { container, fs } = await waitForSandboxFilesystem();
			if (container) {
				return container.fs.readFile(normalizeSandboxPath(path), 'utf-8');
			}
			if (!fs) throw new Error('filesystem not ready');
			return fs.readFile(path, 'utf-8');
		};

	(
		window as Window & {
			__e2eCachedSnapshotBytes?: () => Promise<number>;
		}
	).__e2eCachedSnapshotBytes = async () => {
		const pid = getActiveProjectId();
		if (!pid) return 0;
		const project = await dexieProjectStore.get(pid);
		if (!project) return 0;
		const snap = await loadCachedSnapshot(pid, getTemplate(project.templateId).snapshotVersion);
		return snap ? cachedSnapshotSize(snap) : 0;
	};

	(
		window as Window & {
			__e2eSnapshotMetadata?: () => Promise<Awaited<ReturnType<typeof getSnapshotMetadata>>>;
		}
	).__e2eSnapshotMetadata = async () => {
		const pid = getActiveProjectId();
		if (!pid) return null;
		return getSnapshotMetadata(pid);
	};

	(window as Window & { __e2eSandboxLogs?: () => string[] }).__e2eSandboxLogs = () => {
		return readWebcontainerSnapshot()?.logs ?? [];
	};

	(
		window as Window & {
			__e2eSandboxState?: () => {
				error: string;
				phase: string;
				previewUrl: string;
				templateId: string | null;
			};
		}
	).__e2eSandboxState = () => {
		const snapshot = readWebcontainerSnapshot();
		return {
			error: snapshot?.error ?? '',
			phase: snapshot?.phase ?? 'idle',
			previewUrl: snapshot?.previewUrl ?? '',
			templateId: snapshot?.templateId ?? null
		};
	};
}
