import { sandboxStore } from '$lib/sandboxStore';
import type { SnapshotRecord } from '$lib/agentHarness/types';
import { isGuestPathWritable, normalizeGuestPath } from '$lib/agentHarness/pathAllowlist';

const MAX_SNAPSHOTS = 32;

const GUEST_SCAN_PATHS = ['App.svelte', 'agent.manifest.json'];

let snapshots: SnapshotRecord[] = [];
let activeProjectId: string | null = null;

export function setActiveProjectId(projectId: string) {
	if (activeProjectId !== projectId) {
		snapshots = [];
	}
	activeProjectId = projectId;
}

function nextId() {
	return `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function listComponentPaths(): Promise<string[]> {
	const fs = sandboxStore.getFs();
	if (!fs) return [];

	try {
		const entries = await fs.readdir('components', { withFileTypes: true });
		const paths: string[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) {
				paths.push(`components/${entry.name}`);
			}
		}
		return paths;
	} catch {
		return [];
	}
}

async function readGuestFile(path: string): Promise<string | null> {
	const fs = sandboxStore.getFs();
	if (!fs) return null;
	const normalized = normalizeGuestPath(path);
	if (!isGuestPathWritable(normalized)) return null;
	try {
		return await fs.readFile(normalized, 'utf-8');
	} catch {
		return null;
	}
}

/** Capture all guest-writable files currently in the sandbox FS. */
export async function captureGuestSnapshot(): Promise<SnapshotRecord> {
	const paths = [...GUEST_SCAN_PATHS, ...(await listComponentPaths())];
	const files: Record<string, string> = {};

	for (const path of paths) {
		const content = await readGuestFile(path);
		if (content !== null) files[path] = content;
	}

	const record: SnapshotRecord = { id: nextId(), ts: Date.now(), files };
	snapshots = [...snapshots, record].slice(-MAX_SNAPSHOTS);
	return record;
}

export function getSnapshots(): SnapshotRecord[] {
	return snapshots;
}

export function getLatestSnapshot(): SnapshotRecord | undefined {
	return snapshots.at(-1);
}

export function getSnapshot(id: string): SnapshotRecord | undefined {
	return snapshots.find((s) => s.id === id);
}

/** Restore guest files from a snapshot via sandbox writes. */
export async function rollbackSnapshot(id: string): Promise<boolean> {
	const snap = getSnapshot(id);
	if (!snap) return false;

	for (const [path, content] of Object.entries(snap.files)) {
		await sandboxStore.write(path, content);
	}
	return true;
}
