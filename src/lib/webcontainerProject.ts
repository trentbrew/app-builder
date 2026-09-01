import { createSvelteMount, defaultAppContents } from '$lib/projects/templates/svelte';

/**
 * @deprecated Use templates/svelte createMount
 * Guest harness SDK (`lib/agent-sdk/index.ts`, `lib/agent-sdk/types.ts`) is injected by
 * `replProject.ts` via `guestMount.ts` — not in this shim.
 */
export function createWebContainerMount(appContents: string) {
	return createSvelteMount(appContents);
}

export { defaultAppContents };
