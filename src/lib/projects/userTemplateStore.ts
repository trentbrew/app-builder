import { browser } from '$app/environment';
import { seedDefaultProjectLayout } from '$lib/editorLayout';
import { getTemplate } from '$lib/projects/templates';
import type {
	CreateUserTemplateFromFrameworkInput,
	CreateUserTemplateFromProjectInput,
	TemplateId,
	UserTemplateRecord
} from '$lib/projects/types';
import { deleteProjectThumbnail, duplicateProjectThumbnail } from '$lib/projects/projectThumbnail';
import {
	copyUserTemplateSnapshot,
	deleteUserTemplateSnapshot,
	ensureProjectsMigrated,
	getProjectSnapshotRecord,
	getUserTemplatesTable,
	saveUserTemplateSnapshot
} from '$lib/webcontainerSnapshot';

function now() {
	return Date.now();
}

function newId() {
	return crypto.randomUUID();
}

export const userTemplateStore = {
	async list(): Promise<UserTemplateRecord[]> {
		await ensureProjectsMigrated();
		return getUserTemplatesTable().orderBy('updatedAt').reverse().toArray();
	},

	async get(id: string): Promise<UserTemplateRecord | null> {
		await ensureProjectsMigrated();
		return (await getUserTemplatesTable().get(id)) ?? null;
	},

	async createFromFramework(input: CreateUserTemplateFromFrameworkInput): Promise<UserTemplateRecord> {
		await ensureProjectsMigrated();
		const baseTemplate = getTemplate(input.baseTemplateId);
		const id = newId();
		const ts = now();
		const record: UserTemplateRecord = {
			id,
			name: input.name.trim(),
			description: input.description?.trim() || undefined,
			baseTemplateId: input.baseTemplateId,
			snapshotVersion: baseTemplate.snapshotVersion,
			createdAt: ts,
			updatedAt: ts
		};

		if (browser) {
			const tree = baseTemplate.createMount(baseTemplate.defaultAppContents);
			await saveUserTemplateSnapshot(
				id,
				baseTemplate.snapshotVersion,
				input.baseTemplateId,
				tree
			);
		}

		await getUserTemplatesTable().put(record);
		if (browser) {
			seedDefaultProjectLayout(record.id, baseTemplate.entryFile);
		}
		return record;
	},

	async touch(id: string): Promise<void> {
		const existing = await this.get(id);
		if (!existing) return;
		await getUserTemplatesTable().put({ ...existing, updatedAt: now() });
	},

	async createFromProject(input: CreateUserTemplateFromProjectInput): Promise<UserTemplateRecord> {
		await ensureProjectsMigrated();
		const snapshot = await getProjectSnapshotRecord(input.projectId);
		if (!snapshot?.tree && !snapshot?.data) {
			throw new Error('Project has no saved snapshot. Open the project first to capture files.');
		}

		const { dexieProjectStore } = await import('$lib/projects/dexieProjectStore');
		const project = await dexieProjectStore.get(input.projectId);
		if (!project) throw new Error('Project not found');

		const baseTemplateId = getTemplate(project.templateId).id as TemplateId;
		const id = newId();
		const ts = now();
		const record: UserTemplateRecord = {
			id,
			name: input.name.trim(),
			description: input.description?.trim() || undefined,
			baseTemplateId,
			snapshotVersion: snapshot.version,
			sourceProjectId: input.projectId,
			createdAt: ts,
			updatedAt: ts
		};

		await getUserTemplatesTable().put(record);

		if (snapshot.tree) {
			await saveUserTemplateSnapshot(id, snapshot.version, baseTemplateId, snapshot.tree);
		}

		await duplicateProjectThumbnail(input.projectId, id);

		if (browser) {
			seedDefaultProjectLayout(record.id, getTemplate(baseTemplateId).entryFile);
		}

		return record;
	},

	async update(
		id: string,
		patch: Partial<Pick<UserTemplateRecord, 'name' | 'description'>>
	): Promise<void> {
		const existing = await this.get(id);
		if (!existing) return;
		await getUserTemplatesTable().put({
			...existing,
			...patch,
			name: patch.name?.trim() ?? existing.name,
			description: patch.description?.trim() || existing.description,
			updatedAt: now()
		});
	},

	async delete(id: string): Promise<void> {
		await getUserTemplatesTable().delete(id);
		await deleteUserTemplateSnapshot(id);
		await deleteProjectThumbnail(id);
	},

	async duplicate(id: string): Promise<UserTemplateRecord> {
		const existing = await this.get(id);
		if (!existing) throw new Error('Template not found');
		const copyId = newId();
		const ts = now();
		const copy: UserTemplateRecord = {
			...existing,
			id: copyId,
			name: `${existing.name} (copy)`,
			sourceProjectId: undefined,
			createdAt: ts,
			updatedAt: ts
		};
		await getUserTemplatesTable().put(copy);
		await copyUserTemplateSnapshot(id, copyId);
		await duplicateProjectThumbnail(id, copyId);
		return copy;
	}
};
