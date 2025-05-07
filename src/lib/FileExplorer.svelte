<script lang="ts">
	import { onMount, createEventDispatcher, getContext, onDestroy } from 'svelte';
	import { webcontainerStore, getFs } from '$lib/webcontainerStore';
	import FileExplorer from './FileExplorer.svelte';

	// build a small tree with toggle state
	interface Entry {
		name: string;
		isDirectory: boolean;
		path: string;
		children?: Entry[];
		expanded?: boolean;
	}

	let entries: Entry[] = [];
	export let onSelectFile: (path: string, content: string) => void;

	// For recursive rendering
	export let entry: Entry | undefined = undefined;

	const dispatch = createEventDispatcher();
	let unsubscribe: () => void;

	onMount(() => {
		// Only load root if this is the top-level instance (no entry prop)
		if (!entry) {
			unsubscribe = webcontainerStore.subscribe((state) => {
				// Check if fs is ready on the store before loading root
				if (state.fs && entries.length === 0) {
					loadRoot();
				}
			});
		}
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	async function loadRoot() {
		const fs = getFs(); // Get fs from store helper
		if (!fs) {
			console.error('FS not available when loading root');
			return;
		}
		try {
			const dirents = await fs.readdir('/', { withFileTypes: true });
			entries = dirents
				.filter((d: any) => d.name !== '.' && d.name !== '..')
				.map((d: any) => ({
					name: d.name,
					isDirectory: d.isDirectory?.() ?? d.directory ?? false,
					path: `/${d.name}`,
					expanded: false
				}));
		} catch (e) {
			console.error('Failed to read directory:', e);
		}
	}

	// toggle folder open/closed, lazy-load children
	async function toggleDir(entry: Entry) {
		const fs = getFs(); // Get fs from store helper
		if (!fs) {
			console.error('FS not available when toggling dir');
			return;
		}
		if (entry.expanded) {
			entry.expanded = false;
		} else {
			if (!entry.children) {
				try {
					const subs = await fs.readdir(entry.path, { withFileTypes: true });
					entry.children = subs
						.filter((d: any) => d.name !== '.' && d.name !== '..')
						.map((d: any) => ({
							name: d.name,
							isDirectory: d.isDirectory?.() ?? d.directory ?? false,
							path: `${entry.path}/${d.name}`,
							expanded: false
						}));
				} catch (err) {
					console.error('Failed to read', entry.path, err);
					entry.children = [];
				}
			}
			entry.expanded = true;
		}
	}

	async function handleClick(entry: Entry) {
		const fs = getFs(); // Get fs from store helper
		if (!fs) {
			console.error('FS not available when handling click');
			return;
		}
		if (entry.isDirectory) {
			await toggleDir(entry);
		} else {
			const content = await fs.readFile(entry.path, 'utf-8');
			onSelectFile(entry.path, content);
		}
	}

	function getFileIcon(entry: Entry) {
		if (entry.isDirectory) {
			return entry.expanded ? 'i-lucide:folder-open' : 'i-lucide:folder';
		}
		// crude file type icon logic, can be improved
		if (entry.name.endsWith('.js')) return 'i-lucide:file-code';
		if (entry.name.endsWith('.ts')) return 'i-lucide:file-code-2';
		if (entry.name.endsWith('.json')) return 'i-lucide:file-json';
		if (entry.name.endsWith('.md')) return 'i-lucide:file-text';
		if (entry.name.endsWith('.svelte')) return 'i-lucide:file-terminal';
		if (entry.name.endsWith('.css')) return 'i-lucide:file-css';
		if (entry.name.endsWith('.html')) return 'i-lucide:file-html';
		return 'i-lucide:file';
	}

	function handleNodeClick(e: MouseEvent, entry: Entry) {
		e.stopPropagation();
		handleClick(entry);
	}
</script>

<!--
	Uses shadcn/ui primitives and iconify for icons.
	Assumes shadcn/ui and iconify are installed and Tailwind is configured.
-->

{#if !entry}
	<ul class="space-y-1">
		{#each entries as entryItem (entryItem.path)}
			<FileExplorer entry={entryItem} {onSelectFile} />
		{/each}
	</ul>
{:else}
	<li>
		<div
			class="hover:bg-muted/70 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1
				transition-colors
				{entry.isDirectory ? 'text-primary font-semibold' : 'text-muted-foreground'}"
			on:click={(e) => handleNodeClick(e, entry)}
		>
			<!-- Directory toggle arrow -->
			{#if entry.isDirectory}
				<span
					class="mr-1 flex h-4 w-4 items-center justify-center transition-transform
						{entry.expanded ? 'rotate-90' : ''}"
					aria-label={entry.expanded ? 'Collapse' : 'Expand'}
				>
					<!-- Chevron right icon (rotates when expanded) -->
					<span class="i-lucide:chevron-right text-muted-foreground"></span>
				</span>
			{:else}
				<span class="mr-1 h-4 w-4"></span>
			{/if}
			<!-- File/folder icon -->
			<span class="{getFileIcon(entry)} mr-1 h-4 w-4"></span>
			<span class="truncate">{entry.name}</span>
		</div>
		{#if entry.isDirectory && entry.expanded}
			<ul class="border-muted/30 ml-1 border-l pl-4">
				{#each entry.children as child (child.path)}
					<FileExplorer entry={child} {onSelectFile} />
				{/each}
			</ul>
		{/if}
	</li>
{/if}

<style>
	/* shadcn/ui and Tailwind handle most styling; add custom tweaks if needed */
	:global(.i-lucide\:chevron-right),
	:global(.i-lucide\:folder),
	:global(.i-lucide\:folder-open),
	:global(.i-lucide\:file),
	:global(.i-lucide\:file-code),
	:global(.i-lucide\:file-code-2),
	:global(.i-lucide\:file-json),
	:global(.i-lucide\:file-text),
	:global(.i-lucide\:file-terminal),
	:global(.i-lucide\:file-css),
	:global(.i-lucide\:file-html) {
		display: inline-block;
		vertical-align: middle;
	}
</style>
