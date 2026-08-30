import { browser } from '$app/environment';

export const LAST_PROJECT_KEY = 'app-builder:last-project-id';

let activeProjectId: string | null = null;
let activeUserTemplateId: string | null = null;
let activeTemplateId: string | null = null;
let activeProjectName: string | null = null;

export function setActiveProjectScope(
	project: { id: string; templateId: string; name: string } | null
) {
	activeProjectId = project?.id ?? null;
	activeUserTemplateId = null;
	activeTemplateId = project?.templateId ?? null;
	activeProjectName = project?.name ?? null;
	if (browser && project?.id) {
		try {
			localStorage.setItem(LAST_PROJECT_KEY, project.id);
		} catch {
			// ignore
		}
	}
}

export function setActiveUserTemplateScope(
	template: { id: string; baseTemplateId: string; name: string } | null
) {
	activeUserTemplateId = template?.id ?? null;
	activeProjectId = null;
	activeTemplateId = template?.baseTemplateId ?? null;
	activeProjectName = template?.name ?? null;
}

export function getActiveProjectId(): string | null {
	return activeProjectId;
}

export function getActiveUserTemplateId(): string | null {
	return activeUserTemplateId;
}

/** Project or user-template id — used for per-editor layout and file-tree storage. */
export function getActiveEditorScopeId(): string | null {
	return activeProjectId ?? activeUserTemplateId;
}

export function getActiveTemplateId(): string | null {
	return activeTemplateId;
}

export function getActiveProjectName(): string | null {
	return activeProjectName;
}

export function layoutStorageKey(projectId: string) {
	return `app-builder:layout:v5:${projectId}`;
}

export function dockContainersStorageKey(projectId: string) {
	return `app-builder:dock-containers:v2:${projectId}`;
}

export function tabNamesStorageKey(projectId: string) {
	return `app-builder:tab-names:v2:${projectId}`;
}

export function fileTreeStorageKey(projectId: string) {
	return `app-builder:file-tree:v2:${projectId}`;
}
