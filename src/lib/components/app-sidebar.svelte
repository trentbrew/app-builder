<script module>
	// This will be replaced with dynamic data from webcontainer
	const data = {
		changes: [],
		tree: []
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { webcontainerStore } from '$lib/webcontainerStore';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileIcon from '@lucide/svelte/icons/file';
	import FolderIcon from '@lucide/svelte/icons/folder';

	let { ref = $bindable(null), onFileSelect = () => {}, currentFile = '', ...restProps } = $props();

	// Dynamic file system data
	let fileSystemData = $state({
		changes: [],
		tree: []
	});

	// Function to handle file selection
	async function handleFileSelect(fileName: string, fullPath: string = '') {
		console.log('🔍 Sidebar handleFileSelect called:', { fileName, fullPath });
		try {
			// Get the webcontainer file system
			let fs: any;
			webcontainerStore.subscribe((state) => {
				fs = state.fs;
			})();

			console.log('📁 File system available:', !!fs);
			console.log('📁 Full path provided:', fullPath);

			if (fs && fullPath) {
				// Read the actual file content
				console.log('📖 Reading file:', fullPath);
				const content = await fs.readFile(fullPath, 'utf-8');
				console.log('📄 File content length:', content.length);
				console.log('📄 First 100 chars:', content.substring(0, 100));
				onFileSelect(fileName, content, fullPath);
			} else {
				console.log('❌ No file system or path, calling onFileSelect with empty content');
				onFileSelect(fileName, '', fullPath);
			}
		} catch (error) {
			console.error('💥 Error reading file:', error);
			onFileSelect(fileName, '', fullPath);
		}
	}

	// Function to build tree structure from file system
	async function buildFileTree(fs: any, path: string = '/'): Promise<any[]> {
		if (!fs) return [];

		try {
			const entries = await fs.readdir(path, { withFileTypes: true });
			const tree: any[] = [];

			for (const entry of entries) {
				const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;

				if (entry.isDirectory()) {
					// Skip node_modules and other common directories we don't want to show
					if (['node_modules', '.git', '.vite', 'dist', 'build'].includes(entry.name)) {
						continue;
					}

					const children = await buildFileTree(fs, fullPath);
					if (children.length > 0) {
						tree.push([entry.name, ...children]);
					} else {
						tree.push([entry.name]);
					}
				} else {
					// Skip common files we don't want to show
					if (['.DS_Store', 'Thumbs.db'].includes(entry.name)) {
						continue;
					}
					tree.push(entry.name);
				}
			}

			return tree.sort((a, b) => {
				// Sort directories first, then files
				const aIsDir = Array.isArray(a);
				const bIsDir = Array.isArray(b);
				if (aIsDir && !bIsDir) return -1;
				if (!aIsDir && bIsDir) return 1;
				return a[0]?.localeCompare(b[0] || a) || a.localeCompare(b);
			});
		} catch (error) {
			console.error('Error reading directory:', error);
			return [];
		}
	}

	// Load file system when webcontainer is ready
	onMount(() => {
		const unsubscribe = webcontainerStore.subscribe(async (state) => {
			console.log('🔄 Webcontainer state changed:', { hasFs: !!state.fs, loading: state.loading });
			if (state.fs && !state.loading) {
				try {
					console.log('🌳 Building file tree...');
					const tree = await buildFileTree(state.fs);
					console.log('🌳 File tree built:', tree);
					fileSystemData = {
						changes: [], // TODO: Implement git status detection
						tree: tree
					};
					console.log('📊 File system data updated:', fileSystemData);
				} catch (error) {
					console.error('💥 Error loading file system:', error);
				}
			}
		});

		return unsubscribe;
	});
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Content>
		<!-- <Sidebar.Group>
			<Sidebar.GroupLabel>Changes</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each fileSystemData.changes as item, index (index)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								<FileIcon />
								{item.file}
							</Sidebar.MenuButton>
							<Sidebar.MenuBadge>{item.state}</Sidebar.MenuBadge>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group> -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Files</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each fileSystemData.tree as item, index (index)}
						{@render Tree({ item })}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
{#snippet Tree({ item, currentPath = '' })}
	{@const [name, ...items] = Array.isArray(item) ? item : [item]}
	{@const fullPath = currentPath ? `${currentPath}/${name}` : `/${name}`}
	{#if !items.length}
		<Sidebar.MenuButton
			isActive={name === currentFile}
			class="data-[active=true]:bg-transparent"
			on:click={() => handleFileSelect(name, fullPath)}
		>
			<FileIcon />
			{name}
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				open={name === 'lib' || name === 'components'}
			>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props}>
							<ChevronRightIcon className="transition-transform" />
							<FolderIcon />
							{name}
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Sidebar.MenuSub>
						{#each items as subItem, index (index)}
							{@render Tree({ item: subItem, currentPath: fullPath })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
