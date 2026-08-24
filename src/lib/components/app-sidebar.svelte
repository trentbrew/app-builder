<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FileIcon from '@lucide/svelte/icons/file';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import { webcontainerStore } from '$lib/webcontainerStore';
	import type { ComponentProps } from 'svelte';

	type TreeItem = string | TreeItem[];

	interface Props extends ComponentProps<typeof Sidebar.Root> {
		activeFile?: string;
		onSelectFile?: (path: string, content: string) => void;
	}

	let {
		ref = $bindable(null),
		activeFile = '/App.svelte',
		onSelectFile,
		...restProps
	}: Props = $props();

	const sourceFiles = ['App.svelte'];
	let tree = $state<TreeItem[]>([]);
	let containerReady = $state(false);
	let treeLoaded = $state(false);

	$effect(() => {
		const unsubscribe = webcontainerStore.subscribe((state) => {
			if (state.container) containerReady = true;
			if (state.fs && !treeLoaded) {
				treeLoaded = true;
				loadTree().catch(console.error);
			}
		});
		return unsubscribe;
	});

	async function loadTree() {
		const container = webcontainerStore.getContainer();
		if (!container) return;

		try {
			const entries = await container.fs.readdir('/', { withFileTypes: true });
			const visible = entries
				.filter(
					(entry) =>
						!entry.name.startsWith('.') &&
						entry.name !== 'node_modules' &&
						entry.name !== 'pnpm-lock.yaml'
				)
				.sort((a, b) => {
					if (a.isDirectory() !== b.isDirectory()) {
						return a.isDirectory() ? -1 : 1;
					}
					return a.name.localeCompare(b.name);
				});

			tree = await Promise.all(
				visible.map(async (entry) => {
					if (!entry.isDirectory()) return entry.name;
					const subEntries = await container.fs.readdir(`/${entry.name}`, {
						withFileTypes: true
					});
					const children = subEntries
						.filter((sub) => !sub.name.startsWith('.'))
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((sub) => sub.name);
					return [entry.name, ...children] as TreeItem;
				})
			);
		} catch (error) {
			console.error('Error loading project tree:', error);
		}
	}

	async function openFile(name: string, parent?: string) {
		const path = parent ? `/${parent}/${name}` : `/${name}`;
		const container = webcontainerStore.getContainer();
		if (!container || !onSelectFile) return;

		try {
			const content = await container.fs.readFile(path, 'utf-8');
			onSelectFile(path, content);
		} catch (error) {
			console.error('Error reading file:', error);
		}
	}

	function normalizePath(path: string) {
		return path.startsWith('/') ? path : `/${path}`;
	}

	function isActive(name: string, parent?: string) {
		const path = normalizePath(parent ? `${parent}/${name}` : name);
		return normalizePath(activeFile) === path;
	}
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Source</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each sourceFiles as file (file)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={isActive(file)} onclick={() => openFile(file)}>
								<FileIcon />
								{file}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Files</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				{#if !containerReady}
					<p class="text-muted-foreground px-2 py-1 text-xs">Booting project…</p>
				{:else}
					<Sidebar.Menu>
						{#each tree as item, index (index)}
							{@render Tree({ item })}
						{/each}
					</Sidebar.Menu>
				{/if}
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

{#snippet Tree({ item, parent }: { item: TreeItem; parent?: string })}
	{@const [name, ...items] = Array.isArray(item) ? item : [item]}
	{#if !items.length}
		<Sidebar.MenuItem>
			<Sidebar.MenuButton
				isActive={isActive(String(name), parent)}
				onclick={() => openFile(String(name), parent)}
			>
				<FileIcon />
				{name}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				open={name === 'lib' || name === 'components' || !parent}
			>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props}>
							<ChevronRightIcon class="transition-transform" />
							<FolderIcon />
							{name}
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Sidebar.MenuSub>
						{#each items as subItem, index (index)}
							{@render Tree({ item: subItem, parent: String(name) })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
