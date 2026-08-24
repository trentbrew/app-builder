import Dexie, { type Table } from 'dexie';
import type { WebContainer } from '@webcontainer/api';

/** Bump when the boot template changes so stale snapshots are ignored. */
export const SNAPSHOT_VERSION = 'svelte-repl-v2';

const SNAPSHOT_ID = 'default';

interface SnapshotRecord {
	id: string;
	version: string;
	data: ArrayBuffer;
	updatedAt: number;
}

class SnapshotDatabase extends Dexie {
	snapshots!: Table<SnapshotRecord, string>;

	constructor() {
		super('app-builder-webcontainer');
		this.version(1).stores({
			snapshots: 'id, version, updatedAt'
		});
	}
}

const db = new SnapshotDatabase();

export async function loadCachedSnapshot(version = SNAPSHOT_VERSION): Promise<Uint8Array | null> {
	try {
		const record = await db.snapshots.get(SNAPSHOT_ID);
		if (!record || record.version !== version) return null;
		// Copy so we always hand mount() an independent buffer.
		return new Uint8Array(record.data);
	} catch (error) {
		console.warn('Failed to load WebContainer snapshot:', error);
		return null;
	}
}

export async function saveCachedSnapshot(
	container: WebContainer,
	version = SNAPSHOT_VERSION
): Promise<void> {
	try {
		const exported = await container.export('/', {
			format: 'binary',
			excludes: ['.git/**']
		});
		// Own the bytes — views into export buffers can be invalid after IDB round-trips.
		const data = new Uint8Array(exported);

		await db.snapshots.put({
			id: SNAPSHOT_ID,
			version,
			data: data.buffer,
			updatedAt: Date.now()
		});
	} catch (error) {
		console.warn('Failed to save WebContainer snapshot:', error);
	}
}

/** Returns true when the mounted project looks usable (package.json present). */
export async function isMountedProjectValid(container: WebContainer): Promise<boolean> {
	try {
		await container.fs.readFile('package.json', 'utf-8');
		return true;
	} catch {
		return false;
	}
}

export async function clearCachedSnapshot(): Promise<void> {
	try {
		await db.snapshots.delete(SNAPSHOT_ID);
	} catch (error) {
		console.warn('Failed to clear WebContainer snapshot:', error);
	}
}
