import type { FileSystemTree } from '@webcontainer/api';

export type TemplateId = 'svelte' | 'vue' | 'react' | 'vanilla' | 'lit' | 'expo';

/** Persisted on older projects before the nextjs → react rename. */
export type StoredTemplateId = TemplateId | 'nextjs';

export type ProjectRecord = {
	id: string;
	name: string;
	templateId: StoredTemplateId;
	createdAt: number;
	updatedAt: number;
	lastOpenedAt: number;
	pinned?: boolean;
	trellisRepoId?: string;
	trellisEntityId?: string;
};

export type CreateProjectInput = {
	name: string;
	templateId: TemplateId;
};

export type ProjectTemplate = {
	id: TemplateId;
	label: string;
	entryFile: string;
	snapshotVersion: string;
	defaultAppContents: string;
	createMount(appContents: string): FileSystemTree;
};

export type UserTemplateRecord = {
	id: string;
	name: string;
	description?: string;
	baseTemplateId: TemplateId;
	snapshotVersion: string;
	sourceProjectId?: string;
	createdAt: number;
	updatedAt: number;
};

export type CreateUserTemplateFromFrameworkInput = {
	name: string;
	baseTemplateId: TemplateId;
	description?: string;
};

export type CreateUserTemplateFromProjectInput = {
	name: string;
	projectId: string;
	description?: string;
};

export type CreateProjectFromUserTemplateInput = {
	name: string;
	userTemplateId: string;
};
