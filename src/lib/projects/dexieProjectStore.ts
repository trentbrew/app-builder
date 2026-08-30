import type { CreateProjectFromUserTemplateInput, CreateProjectInput, ProjectRecord } from '$lib/projects/types';
import type { ProjectStore } from '$lib/projects/projectStore';
import { browser } from '$app/environment';
import { seedDefaultProjectLayout } from '$lib/editorLayout';
import { getTemplate } from '$lib/projects/templates';
import {
	copyCachedSnapshot,
	copyUserTemplateSnapshotToProject,
	deleteCachedSnapshot,
	deleteProjectThumbnail,
	ensureProjectsMigrated,
	getProjectsTable
} from '$lib/webcontainerSnapshot';
import { duplicateProjectThumbnail } from '$lib/projects/projectThumbnail';
import { userTemplateStore } from '$lib/projects/userTemplateStore';

function now() {
	return Date.now();
}

function newId() {
	return crypto.randomUUID();
}

export const dexieProjectStore: ProjectStore = {
	async list() {
		await ensureProjectsMigrated();
		const rows = await getProjectsTable().orderBy('lastOpenedAt').reverse().toArray();
		return rows.sort((a, b) => {
			const aPinned = a.pinned ? 1 : 0;
			const bPinned = b.pinned ? 1 : 0;
			if (aPinned !== bPinned) return bPinned - aPinned;
			return b.lastOpenedAt - a.lastOpenedAt;
		});
	},

	async get(id) {
		await ensureProjectsMigrated();
		const row = await getProjectsTable().get(id);
		return row ?? null;
	},

	async create(input: CreateProjectInput) {
		await ensureProjectsMigrated();
		const ts = now();
		const record: ProjectRecord = {
			id: newId(),
			name: input.name.trim(),
			templateId: input.templateId,
			createdAt: ts,
			updatedAt: ts,
			lastOpenedAt: ts,
			pinned: false
		};
		await getProjectsTable().put(record);
		if (browser) {
			seedDefaultProjectLayout(record.id, getTemplate(record.templateId).entryFile);
		}
		return record;
	},

	async createFromUserTemplate(input: CreateProjectFromUserTemplateInput) {
		await ensureProjectsMigrated();
		const template = await userTemplateStore.get(input.userTemplateId);
		if (!template) throw new Error('Template not found');

		const ts = now();
		const record: ProjectRecord = {
			id: newId(),
			name: input.name.trim(),
			templateId: template.baseTemplateId,
			createdAt: ts,
			updatedAt: ts,
			lastOpenedAt: ts,
			pinned: false
		};

		await getProjectsTable().put(record);
		await copyUserTemplateSnapshotToProject(template.id, record.id);
		await duplicateProjectThumbnail(template.id, record.id);

		if (browser) {
			seedDefaultProjectLayout(record.id, getTemplate(record.templateId).entryFile);
		}

		return record;
	},

	async update(id, patch) {
		const existing = await this.get(id);
		if (!existing) return;
		const updated: ProjectRecord = {
			...existing,
			...patch,
			updatedAt: now()
		};
		await getProjectsTable().put(updated);
	},

	async delete(id) {
		await getProjectsTable().delete(id);
		await deleteCachedSnapshot(id);
		await deleteProjectThumbnail(id);
	},

	async touch(id) {
		const existing = await this.get(id);
		if (!existing) return;
		await getProjectsTable().put({ ...existing, lastOpenedAt: now(), updatedAt: now() });
	},

	async togglePin(id) {
		const existing = await this.get(id);
		if (!existing) return;
		await this.update(id, { pinned: !existing.pinned });
	},

	async duplicate(id) {
		const existing = await this.get(id);
		if (!existing) throw new Error('Project not found');
		const ts = now();
		const copy: ProjectRecord = {
			...existing,
			id: newId(),
			name: `${existing.name} (copy)`,
			createdAt: ts,
			updatedAt: ts,
			lastOpenedAt: ts,
			pinned: false
		};
		await getProjectsTable().put(copy);
		await copyCachedSnapshot(id, copy.id);
		await duplicateProjectThumbnail(id, copy.id);
		return copy;
	}
};
