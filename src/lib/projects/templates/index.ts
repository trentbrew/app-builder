import { expoTemplate } from '$lib/projects/templates/expo';
import { litTemplate } from '$lib/projects/templates/lit';
import { reactTemplate } from '$lib/projects/templates/react';
import { svelteTemplate } from '$lib/projects/templates/svelte';
import { vanillaTemplate } from '$lib/projects/templates/vanilla';
import { vueTemplate } from '$lib/projects/templates/vue';
import type { ProjectTemplate, TemplateId } from '$lib/projects/types';

const TEMPLATES: Record<TemplateId, ProjectTemplate> = {
	svelte: svelteTemplate,
	vue: vueTemplate,
	react: reactTemplate,
	vanilla: vanillaTemplate,
	lit: litTemplate,
	expo: expoTemplate
};

const LEGACY_ALIASES: Record<string, TemplateId> = {
	nextjs: 'react'
};

/** Display order in the new-project dialog. */
export const TEMPLATE_LIST: ProjectTemplate[] = [
	svelteTemplate,
	vueTemplate,
	reactTemplate,
	vanillaTemplate,
	litTemplate,
	expoTemplate
];

export function resolveTemplateId(id: string): TemplateId {
	if (id in TEMPLATES) return id as TemplateId;
	return LEGACY_ALIASES[id] ?? 'svelte';
}

export function getTemplate(id: string): ProjectTemplate {
	return TEMPLATES[resolveTemplateId(id)];
}

export { TEMPLATES };
