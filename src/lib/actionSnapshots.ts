import {
	emptyLayoutSnapshot,
	emptySandboxSnapshot,
	type ActionContext,
	type ActionTarget,
	type LayoutSnapshot,
	type SandboxSnapshot
} from '$lib/actionContext';
import { actionRunner } from '$lib/actionRunner.svelte';
import { sandboxStore } from '$lib/sandboxStore';

export function buildLayoutSnapshot(): LayoutSnapshot {
	return {
		config: actionRunner.getLayout(),
		openFiles: actionRunner.getOpenFiles(),
		openTerminals: actionRunner.getOpenTerminals(),
		activeFile: actionRunner.getActiveFile()
	};
}

let cachedSandbox: SandboxSnapshot = emptySandboxSnapshot();

if (typeof window !== 'undefined') {
	sandboxStore.subscribe((state) => {
		cachedSandbox = {
			fsReady: state.fsReady,
			backend: state.backend,
			previewUrl: state.previewUrl
		};
	});
}

export function buildSandboxSnapshot(): SandboxSnapshot {
	return cachedSandbox;
}

export function buildActionContext(target: ActionTarget): ActionContext {
	return {
		target,
		layout: buildLayoutSnapshot(),
		sandbox: buildSandboxSnapshot()
	};
}

export function emptyActionContext(target: ActionTarget = { kind: 'global' }): ActionContext {
	return {
		target,
		layout: emptyLayoutSnapshot(),
		sandbox: emptySandboxSnapshot()
	};
}
