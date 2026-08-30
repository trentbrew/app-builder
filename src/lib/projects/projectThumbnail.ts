import { resolveTemplateId } from '$lib/projects/templates';
import type { StoredTemplateId, TemplateId } from '$lib/projects/types';
import { requestPreviewThumbnail } from '$lib/previewFrame';
import {
	copyProjectThumbnail,
	deleteProjectThumbnail,
	loadProjectThumbnail,
	saveProjectThumbnail
} from '$lib/webcontainerSnapshot';

const MAX_THUMBNAIL_BYTES = 420_000;
const captureTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();

const TEMPLATE_COLORS: Record<TemplateId, string> = {
	svelte: '#ff3e00',
	vue: '#42b883',
	react: '#61dafb',
	vanilla: '#f59e0b',
	lit: '#324fff',
	expo: '#000020'
};

export function placeholderThumbnail(templateId: StoredTemplateId): string {
	const color = TEMPLATE_COLORS[resolveTemplateId(templateId)] ?? '#71717a';
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
<stop offset="100%" stop-color="${color}" stop-opacity="0.08"/>
</linearGradient>
</defs>
<rect width="640" height="400" fill="#18181b"/>
<rect width="640" height="400" fill="url(#g)"/>
</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function getProjectThumbnail(
	projectId: string,
	templateId: StoredTemplateId
): Promise<string> {
	const stored = await loadProjectThumbnail(projectId);
	return stored ?? placeholderThumbnail(templateId);
}

export function scheduleProjectThumbnailCapture(projectId: string, delayMs = 2500) {
	const existing = captureTimers.get(projectId);
	if (existing) clearTimeout(existing);
	captureTimers.set(
		projectId,
		setTimeout(() => {
			captureTimers.delete(projectId);
			void captureAndSaveProjectThumbnail(projectId);
		}, delayMs)
	);
}

export async function captureAndSaveProjectThumbnail(projectId: string) {
	const pending = inFlight.get(projectId);
	if (pending) return pending;

	const task = (async () => {
		const dataUrl = await requestPreviewThumbnail();
		if (!dataUrl || dataUrl.length > MAX_THUMBNAIL_BYTES) return;
		await saveProjectThumbnail(projectId, dataUrl);
	})().finally(() => {
		inFlight.delete(projectId);
	});

	inFlight.set(projectId, task);
	return task;
}

export async function duplicateProjectThumbnail(fromId: string, toId: string) {
	await copyProjectThumbnail(fromId, toId);
}

export async function getUserTemplateThumbnail(
	templateId: string,
	baseTemplateId: StoredTemplateId
): Promise<string> {
	const stored = await loadProjectThumbnail(templateId);
	return stored ?? placeholderThumbnail(baseTemplateId);
}

export { deleteProjectThumbnail };
