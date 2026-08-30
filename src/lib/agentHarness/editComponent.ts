import { getActiveTemplateId } from '$lib/projects/projectContext.svelte';
import { sandboxStore } from '$lib/sandboxStore';
import {
	appendToolLog,
	noteHmrComplete,
	noteWriteComplete,
	noteWriteStart
} from '$lib/agentHarness/harnessStore.svelte';
import { isGuestPathWritable, normalizeGuestPath } from '$lib/agentHarness/pathAllowlist';
import { captureGuestSnapshot, rollbackSnapshot } from '$lib/agentHarness/snapshotStore';
import type { EditComponentResult } from '$lib/agentHarness/types';
import { triggerAgentGlow } from '$lib/previewFrame';
import { toast } from '$lib/notify';

function currentTreeGeneration(): number {
	let gen = 0;
	const unsub = sandboxStore.subscribe((s) => {
		gen = s.treeGeneration;
	});
	unsub();
	return gen;
}

/** Agent tool: write a guest component/file with snapshot + allowlist. */
export async function editComponent(path: string, content: string): Promise<EditComponentResult> {
	const normalized = normalizeGuestPath(path);

	if (getActiveTemplateId() !== 'svelte') {
		toast.error('Agent edits are only available for Svelte projects');
		appendToolLog({
			kind: 'deny',
			summary: '[deny] template',
			path: normalized
		});
		return { ok: false, denied: true };
	}

	if (!isGuestPathWritable(normalized)) {
		toast.error(`Write denied: ${normalized}`);
		appendToolLog({
			kind: 'deny',
			summary: `[deny] ${normalized}`,
			path: normalized
		});
		return { ok: false, denied: true };
	}

	const treeGen = currentTreeGeneration();
	noteWriteStart(treeGen);

	const snapshot = await captureGuestSnapshot();
	await sandboxStore.write(normalized, content);
	noteWriteComplete(normalized, snapshot.id);
	triggerAgentGlow();

	return { ok: true, snapshotId: snapshot.id };
}

/** Roll back guest files to a prior snapshot. */
export async function rollbackGuest(snapshotId: string): Promise<EditComponentResult> {
	const ok = await rollbackSnapshot(snapshotId);
	if (!ok) {
		toast.error('Snapshot not found');
		return { ok: false, error: 'snapshot not found' };
	}
	appendToolLog({
		kind: 'rollback',
		summary: `[rollback] ${snapshotId}`,
		path: snapshotId
	});
	toast.success('Guest preview rolled back');
	triggerAgentGlow();
	return { ok: true, snapshotId };
}

/** Subscribe HMR timing — call once from layout. */
export function watchHarnessHmr() {
	return sandboxStore.subscribe((state) => {
		noteHmrComplete(state.treeGeneration);
	});
}
