import Dexie, { type Table } from 'dexie';
import type { FileSystemTree, WebContainer } from '@webcontainer/api';
import type { ProjectRecord, UserTemplateRecord } from '$lib/projects/types';
import type { SessionEventRow } from '$lib/agent/session/events';

export type CachedSnapshot =
	| { format: 'json'; tree: FileSystemTree }
	| { format: 'binary'; data: Uint8Array };

const SNAPSHOT_EXPORT_EXCLUDES = ['.git/**', 'node_modules/**'];

/** @deprecated Use template.snapshotVersion — kept for legacy imports */
export const SNAPSHOT_VERSION = 'svelte-repl-v2';

const LEGACY_SNAPSHOT_ID = 'default';

export interface SnapshotRecord {
	id: string;
	version: string;
	templateId?: string;
	/** @deprecated Legacy binary snapshot payload */
	data?: ArrayBuffer | Uint8Array;
	tree?: FileSystemTree;
	format?: 'json' | 'binary';
	updatedAt: number;
}

export interface ThumbnailRecord {
	id: string;
	dataUrl: string;
	updatedAt: number;
}

export interface UserTemplateSnapshotRecord {
	id: string;
	version: string;
	baseTemplateId: string;
	tree?: FileSystemTree;
	/** @deprecated Legacy binary snapshot payload */
	data?: ArrayBuffer | Uint8Array;
	format?: 'json' | 'binary';
	updatedAt: number;
}

class AppBuilderDatabase extends Dexie {
	projects!: Table<ProjectRecord, string>;
	snapshots!: Table<SnapshotRecord, string>;
	thumbnails!: Table<ThumbnailRecord, string>;
	userTemplates!: Table<UserTemplateRecord, string>;
	userTemplateSnapshots!: Table<UserTemplateSnapshotRecord, string>;
	sessionEvents!: Table<SessionEventRow, number>;

	constructor() {
		super('app-builder-webcontainer');
		this.version(1).stores({
			snapshots: 'id, version, updatedAt'
		});
		this.version(2).stores({
			projects: 'id, templateId, lastOpenedAt, updatedAt',
			snapshots: 'id, version, updatedAt, templateId'
		});
		this.version(3).stores({
			projects: 'id, templateId, lastOpenedAt, updatedAt',
			snapshots: 'id, version, updatedAt, templateId',
			thumbnails: 'id, updatedAt'
		});
		this.version(4).stores({
			projects: 'id, templateId, lastOpenedAt, updatedAt',
			snapshots: 'id, version, updatedAt, templateId',
			thumbnails: 'id, updatedAt',
			userTemplates: 'id, baseTemplateId, updatedAt',
			userTemplateSnapshots: 'id, version, updatedAt'
		});
		// v5 adds the durable agent session-event log. Additive: unlisted tables
		// carry their v4 schema forward. `++seq` is a monotonic global insert key;
		// per-session order is ascending `seq` within a `sessionId`.
		this.version(5).stores({
			sessionEvents: '++seq, sessionId, turnId, ts, kind'
		});
	}
}

const db = new AppBuilderDatabase();

let migrationPromise: Promise<void> | null = null;

export function getProjectsTable() {
	return db.projects;
}

export function getUserTemplatesTable() {
	return db.userTemplates;
}

export function getSessionEventsTable() {
	return db.sessionEvents;
}

export async function getProjectSnapshotRecord(projectId: string): Promise<SnapshotRecord | null> {
	try {
		return (await db.snapshots.get(projectId)) ?? null;
	} catch (error) {
		console.warn('Failed to load project snapshot record:', error);
		return null;
	}
}

export async function ensureProjectsMigrated(): Promise<void> {
	if (!migrationPromise) migrationPromise = runMigration();
	return migrationPromise;
}

async function runMigration(): Promise<void> {
	const count = await db.projects.count();
	if (count > 0) return;

	const legacy = await db.snapshots.get(LEGACY_SNAPSHOT_ID);
	if (!legacy) return;

	const ts = Date.now();
	const project: ProjectRecord = {
		id: crypto.randomUUID(),
		name: 'My Svelte App',
		templateId: 'svelte',
		createdAt: ts,
		updatedAt: ts,
		lastOpenedAt: ts
	};

	await db.transaction('rw', db.projects, db.snapshots, async () => {
		await db.projects.put(project);
		await db.snapshots.put({
			id: project.id,
			version: legacy.version,
			templateId: 'svelte',
			data: legacy.data,
			updatedAt: legacy.updatedAt
		});
		await db.snapshots.delete(LEGACY_SNAPSHOT_ID);
	});
}

export function cachedSnapshotSize(snapshot: CachedSnapshot): number {
	if (snapshot.format === 'json') return JSON.stringify(snapshot.tree).length;
	return snapshot.data.byteLength;
}

export async function loadCachedSnapshot(
	projectId: string,
	version: string
): Promise<CachedSnapshot | null> {
	try {
		const record = await db.snapshots.get(projectId);
		if (!record || record.version !== version) return null;

		if (record.tree) {
			return { format: 'json', tree: record.tree };
		}

		if (record.data) {
			const raw = record.data;
			const data =
				raw instanceof Uint8Array ? Uint8Array.from(raw) : new Uint8Array(raw as ArrayBuffer);
			return { format: 'binary', data };
		}

		return null;
	} catch (error) {
		console.warn('Failed to load WebContainer snapshot:', error);
		return null;
	}
}

export async function saveCachedSnapshot(
	container: WebContainer,
	projectId: string,
	version: string,
	templateId?: string
): Promise<boolean> {
	try {
		const tree = await container.export('.', {
			format: 'json',
			excludes: SNAPSHOT_EXPORT_EXCLUDES
		});

		await db.snapshots.put({
			id: projectId,
			version,
			templateId,
			tree,
			format: 'json',
			updatedAt: Date.now()
		});
		return true;
	} catch (error) {
		console.warn('Failed to save WebContainer snapshot:', error);
		return false;
	}
}

export function readTreeFile(tree: FileSystemTree, name: string): string | null {
	const node = tree[name];
	if (!node || !('file' in node)) return null;
	const file = node.file;
	if (!('contents' in file)) return null;
	return typeof file.contents === 'string' ? file.contents : null;
}

export async function getSnapshotMetadata(projectId: string) {
	const record = await db.snapshots.get(projectId);
	if (!record) return null;
	const format =
		record.format ?? (record.tree ? 'json' : record.data ? 'binary' : ('unknown' as const));
	return {
		version: record.version,
		format,
		hasTree: Boolean(record.tree),
		hasData: Boolean(record.data),
		treeKeys: record.tree ? Object.keys(record.tree) : [],
		appSvelte: record.tree ? readTreeFile(record.tree, 'App.svelte') : null,
		updatedAt: record.updatedAt
	};
}

export async function copyCachedSnapshot(fromId: string, toId: string): Promise<void> {
	const record = await db.snapshots.get(fromId);
	if (!record) return;
	await db.snapshots.put({
		...record,
		id: toId,
		updatedAt: Date.now()
	});
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

export async function clearCachedSnapshot(projectId?: string): Promise<void> {
	try {
		if (projectId) {
			await db.snapshots.delete(projectId);
		} else {
			await db.snapshots.clear();
		}
	} catch (error) {
		console.warn('Failed to clear WebContainer snapshot:', error);
	}
}

export async function deleteCachedSnapshot(projectId: string): Promise<void> {
	await clearCachedSnapshot(projectId);
}

export async function saveProjectThumbnail(projectId: string, dataUrl: string): Promise<void> {
	try {
		await db.thumbnails.put({
			id: projectId,
			dataUrl,
			updatedAt: Date.now()
		});
	} catch (error) {
		console.warn('Failed to save project thumbnail:', error);
	}
}

export async function loadProjectThumbnail(projectId: string): Promise<string | null> {
	try {
		const record = await db.thumbnails.get(projectId);
		return record?.dataUrl ?? null;
	} catch (error) {
		console.warn('Failed to load project thumbnail:', error);
		return null;
	}
}

export async function copyProjectThumbnail(fromId: string, toId: string): Promise<void> {
	const record = await db.thumbnails.get(fromId);
	if (!record) return;
	await db.thumbnails.put({
		...record,
		id: toId,
		updatedAt: Date.now()
	});
}

export async function deleteProjectThumbnail(projectId: string): Promise<void> {
	try {
		await db.thumbnails.delete(projectId);
	} catch (error) {
		console.warn('Failed to delete project thumbnail:', error);
	}
}

export async function saveUserTemplateSnapshotFromContainer(
	container: WebContainer,
	templateId: string,
	version: string,
	baseTemplateId: string
): Promise<boolean> {
	try {
		const tree = await container.export('.', {
			format: 'json',
			excludes: SNAPSHOT_EXPORT_EXCLUDES
		});
		await saveUserTemplateSnapshot(templateId, version, baseTemplateId, tree);
		return true;
	} catch (error) {
		console.warn('Failed to save user template snapshot:', error);
		return false;
	}
}

export async function saveUserTemplateSnapshot(
	templateId: string,
	version: string,
	baseTemplateId: string,
	tree: FileSystemTree
): Promise<void> {
	await db.userTemplateSnapshots.put({
		id: templateId,
		version,
		baseTemplateId,
		tree,
		format: 'json',
		updatedAt: Date.now()
	});
}

export async function loadUserTemplateSnapshot(
	templateId: string,
	version: string
): Promise<CachedSnapshot | null> {
	try {
		const record = await db.userTemplateSnapshots.get(templateId);
		if (!record || record.version !== version) return null;

		if (record.tree) {
			return { format: 'json', tree: record.tree };
		}

		if (record.data) {
			const raw = record.data;
			const data =
				raw instanceof Uint8Array ? Uint8Array.from(raw) : new Uint8Array(raw as ArrayBuffer);
			return { format: 'binary', data };
		}

		return null;
	} catch (error) {
		console.warn('Failed to load user template snapshot:', error);
		return null;
	}
}

export async function getUserTemplateSnapshotRecord(
	templateId: string
): Promise<UserTemplateSnapshotRecord | null> {
	try {
		return (await db.userTemplateSnapshots.get(templateId)) ?? null;
	} catch (error) {
		console.warn('Failed to load user template snapshot record:', error);
		return null;
	}
}

export async function copyUserTemplateSnapshotToProject(
	templateId: string,
	projectId: string
): Promise<void> {
	const record = await db.userTemplateSnapshots.get(templateId);
	if (!record) return;
	await db.snapshots.put({
		id: projectId,
		version: record.version,
		templateId: record.baseTemplateId,
		tree: record.tree,
		data: record.data,
		format: record.format,
		updatedAt: Date.now()
	});
}

export async function copyUserTemplateSnapshot(fromId: string, toId: string): Promise<void> {
	const record = await db.userTemplateSnapshots.get(fromId);
	if (!record) return;
	await db.userTemplateSnapshots.put({
		...record,
		id: toId,
		updatedAt: Date.now()
	});
}

export async function deleteUserTemplateSnapshot(templateId: string): Promise<void> {
	try {
		await db.userTemplateSnapshots.delete(templateId);
	} catch (error) {
		console.warn('Failed to delete user template snapshot:', error);
	}
}
