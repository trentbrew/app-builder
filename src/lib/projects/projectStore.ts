import type { CreateProjectFromUserTemplateInput, CreateProjectInput, ProjectRecord } from '$lib/projects/types';

export interface ProjectStore {
	list(): Promise<ProjectRecord[]>;
	get(id: string): Promise<ProjectRecord | null>;
	create(input: CreateProjectInput): Promise<ProjectRecord>;
	createFromUserTemplate(input: CreateProjectFromUserTemplateInput): Promise<ProjectRecord>;
	update(id: string, patch: Partial<Pick<ProjectRecord, 'name' | 'pinned'>>): Promise<void>;
	delete(id: string): Promise<void>;
	touch(id: string): Promise<void>;
	togglePin(id: string): Promise<void>;
	duplicate(id: string): Promise<ProjectRecord>;
}
