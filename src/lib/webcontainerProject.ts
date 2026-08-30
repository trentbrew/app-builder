import { createSvelteMount, defaultAppContents } from '$lib/projects/templates/svelte';

/** @deprecated Use templates/svelte createMount */
export function createWebContainerMount(appContents: string) {
	return createSvelteMount(appContents);
}

export { defaultAppContents };
