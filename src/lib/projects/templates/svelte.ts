import type { FileSystemTree } from '@webcontainer/api';
import {
	AGENT_MANIFEST_JSON,
	COMPONENTS_GITKEEP,
	GUEST_SDK_INDEX,
	GUEST_SDK_TYPES
} from '$lib/agentHarness/guestMount';
import {
	REPL_INDEX_HTML,
	REPL_MAIN_JS,
	REPL_PACKAGE_JSON,
	REPL_SVELTE_CONFIG,
	replViteConfig
} from '$lib/replProject';
import type { ProjectTemplate } from '$lib/projects/types';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

export const defaultAppContents = `<script>
	let count = $state(0);
</script>

<div class="guest-app">
	{#if true}
		<main class="slot slot-main">
			<h1>{count}</h1>
			<div class="row">
				<button onclick={() => count--}>−</button>
				<button onclick={() => count++}>+</button>
			</div>
			<button class="reset" onclick={() => (count = 0)}>reset</button>
		</main>
	{/if}
	<aside class="slot slot-sidebar" aria-label="Sidebar slot"></aside>
	<footer class="slot slot-status" aria-label="Status slot"></footer>
</div>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		font-family: system-ui, sans-serif;
		background: #0f0f12;
		color: #f4f4f5;
	}

	.guest-app {
		min-height: 100vh;
		display: grid;
		grid-template-rows: 1fr auto;
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'main sidebar'
			'status status';
	}

	.slot-main {
		grid-area: main;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
	}

	.slot-sidebar {
		grid-area: sidebar;
		width: 12rem;
		border-left: 1px solid #27272a;
	}

	.slot-status {
		grid-area: status;
		border-top: 1px solid #27272a;
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: #a1a1aa;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	button {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		border: 1px solid #3f3f46;
		background: #18181b;
		color: inherit;
		cursor: pointer;
	}

	button:hover {
		background: #27272a;
	}

	.reset {
		font-size: 0.875rem;
		opacity: 0.8;
	}
</style>
`;

export function createSvelteMount(appContents: string): FileSystemTree {
	return {
		'package.json': {
			file: { contents: JSON.stringify(REPL_PACKAGE_JSON, null, 2) }
		},
		'.npmrc': {
			file: { contents: npmrc }
		},
		'vite.config.js': {
			file: { contents: replViteConfig(3000) }
		},
		'svelte.config.js': {
			file: { contents: REPL_SVELTE_CONFIG }
		},
		'index.html': {
			file: { contents: REPL_INDEX_HTML }
		},
		'main.js': {
			file: { contents: REPL_MAIN_JS }
		},
		'App.svelte': {
			file: { contents: appContents }
		},
		'agent.manifest.json': {
			file: { contents: AGENT_MANIFEST_JSON }
		},
		lib: {
			directory: {
				'agent-sdk': {
					directory: {
						'types.ts': { file: { contents: GUEST_SDK_TYPES } },
						'index.ts': { file: { contents: GUEST_SDK_INDEX } }
					}
				}
			}
		},
		components: {
			directory: {
				'.gitkeep': { file: { contents: COMPONENTS_GITKEEP } }
			}
		},
		'README.md': {
			file: {
				contents: `---
title: Svelte Counter
description: Agent guest app — modular Svelte components in WebContainer
tags:
  - demo
  - agent
draft: false
---

# Agent guest app

Welcome to the app builder agent harness guest zone.
`
			}
		}
	};
}

export const svelteTemplate: ProjectTemplate = {
	id: 'svelte',
	label: 'Svelte',
	entryFile: 'App.svelte',
	snapshotVersion: 'svelte-repl-v2',
	defaultAppContents,
	createMount: createSvelteMount
};
