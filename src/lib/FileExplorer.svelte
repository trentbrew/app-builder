<script lang="ts">
	import { onMount } from 'svelte';
	import { webcontainerStore } from '$lib/webcontainerStore';

	export let onSelectFile: ((path: string, content: string) => void) | undefined = undefined;

	let files: { name: string; path: string; isDirectory: boolean }[] = [];
	let expandedDirs = new Set<string>();

	// Subscribe to WebContainer store
	const unsubscribe = webcontainerStore.subscribe((state) => {
		if (state.container) {
			loadFiles().catch(console.error);
		}
	});

	async function loadFiles(dir = '/') {
		const container = webcontainerStore.getContainer();
		if (!container) return;

		try {
			const entries = await container.fs.readdir(dir, { withFileTypes: true });
			const newFiles = entries.map((entry) => ({
				name: entry.name,
				path: dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`,
				isDirectory: entry.isDirectory()
			}));

			if (dir === '/') {
				files = newFiles;
			} else {
				// Add to existing files list for subdirectories
				files = [...files, ...newFiles];
			}
		} catch (error) {
			console.error('Error reading directory:', error);
		}
	}

	async function handleFileClick(file: { name: string; path: string; isDirectory: boolean }) {
		if (file.isDirectory) {
			if (expandedDirs.has(file.path)) {
				expandedDirs.delete(file.path);
				// Remove subdirectory files from the list
				files = files.filter((f) => !f.path.startsWith(file.path + '/'));
			} else {
				expandedDirs.add(file.path);
				await loadFiles(file.path);
			}
			expandedDirs = new Set(expandedDirs); // Trigger reactivity
		} else {
			// Load file content
			const container = webcontainerStore.getContainer();
			if (container && onSelectFile) {
				try {
					const content = await container.fs.readFile(file.path, 'utf-8');
					onSelectFile(file.path, content);
				} catch (error) {
					console.error('Error reading file:', error);
				}
			}
		}
	}

	onMount(() => {
		return unsubscribe;
	});
</script>

<div class="p-2">
	<h3 class="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">Files</h3>
	<div class="space-y-1">
		{#each files.filter((f) => f.path.split('/').length <= 2) as file}
			<button
				class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs transition-colors"
				on:click={() => handleFileClick(file)}
			>
				{#if file.isDirectory}
					<span class="text-muted-foreground">
						{expandedDirs.has(file.path) ? '📂' : '📁'}
					</span>
				{:else}
					<span class="text-muted-foreground">📄</span>
				{/if}
				<span class="truncate">{file.name}</span>
			</button>

			{#if file.isDirectory && expandedDirs.has(file.path)}
				{#each files.filter((f) => f.path.startsWith(file.path + '/') && f.path.split('/').length === file.path.split('/').length + 1) as subFile}
					<button
						class="hover:bg-accent hover:text-accent-foreground ml-4 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs transition-colors"
						on:click={() => handleFileClick(subFile)}
					>
						{#if subFile.isDirectory}
							<span class="text-muted-foreground">📁</span>
						{:else}
							<span class="text-muted-foreground">📄</span>
						{/if}
						<span class="truncate">{subFile.name}</span>
					</button>
				{/each}
			{/if}
		{/each}
	</div>
</div>
