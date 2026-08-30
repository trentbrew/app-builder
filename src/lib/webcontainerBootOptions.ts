import type { BootOptions } from '@webcontainer/api';

/** Shared WebContainer boot options — credentialless COEP improves cross-origin preview embeds. */
export const WEBCONTAINER_BOOT_OPTIONS = {
	forwardPreviewErrors: true,
	coep: 'credentialless'
} satisfies BootOptions;

export function webcontainerWorkdir(templateId: string) {
	return `project-${templateId}`;
}

export function webcontainerUserTemplateWorkdir(templateId: string) {
	return `user-template-${templateId}`;
}
