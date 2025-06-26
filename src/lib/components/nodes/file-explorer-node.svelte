<script lang="ts">
	import BaseNode from './BaseNode.svelte';
	import { onMount } from 'svelte';

	// Props
	let {
		onResize = null,
		onMaximize = null
	}: {
		onResize?: ((size: { width: number; height: number }) => void) | null;
		onMaximize?: ((isMaximized: boolean) => void) | null;
	} = $props();

	// State
	let isMinimized = $state(false);
	let isMaximized = $state(false);
	let currentPath = $state('/');
	let selectedItems = $state<Set<string>>(new Set());
	let viewMode = $state<'icons' | 'list' | 'columns'>('icons');
	let sortBy = $state<'name' | 'modified' | 'size' | 'kind'>('name');
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let searchQuery = $state('');

	// Mock file system data
	let fileSystem = $state({
		'/': {
			type: 'folder',
			name: 'Root',
			children: ['Documents', 'Downloads', 'Desktop', 'Applications', 'Pictures'],
			modified: new Date('2024-01-15'),
			size: null
		},
		'/Documents': {
			type: 'folder',
			name: 'Documents',
			children: ['project.txt', 'notes.md', 'Work'],
			modified: new Date('2024-01-20'),
			size: null
		},
		'/Documents/project.txt': {
			type: 'file',
			name: 'project.txt',
			extension: 'txt',
			modified: new Date('2024-01-18'),
			size: 2048
		},
		'/Documents/notes.md': {
			type: 'file',
			name: 'notes.md',
			extension: 'md',
			modified: new Date('2024-01-19'),
			size: 1024
		},
		'/Documents/Work': {
			type: 'folder',
			name: 'Work',
			children: ['presentation.pptx', 'spreadsheet.xlsx', 'script.js', 'styles.css', 'index.html'],
			modified: new Date('2024-01-17'),
			size: null
		},
		'/Documents/Work/presentation.pptx': {
			type: 'file',
			name: 'presentation.pptx',
			extension: 'pptx',
			modified: new Date('2024-01-16'),
			size: 5120
		},
		'/Documents/Work/spreadsheet.xlsx': {
			type: 'file',
			name: 'spreadsheet.xlsx',
			extension: 'xlsx',
			modified: new Date('2024-01-15'),
			size: 3072
		},
		'/Documents/Work/script.js': {
			type: 'file',
			name: 'script.js',
			extension: 'js',
			modified: new Date('2024-01-22'),
			size: 1536
		},
		'/Documents/Work/styles.css': {
			type: 'file',
			name: 'styles.css',
			extension: 'css',
			modified: new Date('2024-01-21'),
			size: 2048
		},
		'/Documents/Work/index.html': {
			type: 'file',
			name: 'index.html',
			extension: 'html',
			modified: new Date('2024-01-23'),
			size: 4096
		},
		'/Downloads': {
			type: 'folder',
			name: 'Downloads',
			children: ['image.png', 'video.mp4', 'archive.zip'],
			modified: new Date('2024-01-21'),
			size: null
		},
		'/Downloads/image.png': {
			type: 'file',
			name: 'image.png',
			extension: 'png',
			modified: new Date('2024-01-21'),
			size: 8192
		},
		'/Downloads/video.mp4': {
			type: 'file',
			name: 'video.mp4',
			extension: 'mp4',
			modified: new Date('2024-01-20'),
			size: 104857600
		},
		'/Downloads/archive.zip': {
			type: 'file',
			name: 'archive.zip',
			extension: 'zip',
			modified: new Date('2024-01-19'),
			size: 2097152
		},
		'/Desktop': {
			type: 'folder',
			name: 'Desktop',
			children: ['README.txt'],
			modified: new Date('2024-01-10'),
			size: null
		},
		'/Desktop/README.txt': {
			type: 'file',
			name: 'README.txt',
			extension: 'txt',
			modified: new Date('2024-01-10'),
			size: 512
		},
		'/Applications': {
			type: 'folder',
			name: 'Applications',
			children: ['Calculator.app', 'TextEdit.app'],
			modified: new Date('2024-01-01'),
			size: null
		},
		'/Applications/Calculator.app': {
			type: 'file',
			name: 'Calculator.app',
			extension: 'app',
			modified: new Date('2024-01-01'),
			size: 10485760
		},
		'/Applications/TextEdit.app': {
			type: 'file',
			name: 'TextEdit.app',
			extension: 'app',
			modified: new Date('2024-01-01'),
			size: 5242880
		},
		'/Pictures': {
			type: 'folder',
			name: 'Pictures',
			children: ['vacation.jpg', 'family.png'],
			modified: new Date('2024-01-12'),
			size: null
		},
		'/Pictures/vacation.jpg': {
			type: 'file',
			name: 'vacation.jpg',
			extension: 'jpg',
			modified: new Date('2024-01-12'),
			size: 4194304
		},
		'/Pictures/family.png': {
			type: 'file',
			name: 'family.png',
			extension: 'png',
			modified: new Date('2024-01-11'),
			size: 6291456
		}
	});

	// Sidebar items
	let sidebarItems = [
		{ name: 'Favorites', type: 'section' },
		{ name: 'Desktop', path: '/Desktop', icon: 'desktop' },
		{ name: 'Documents', path: '/Documents', icon: 'folder' },
		{ name: 'Downloads', path: '/Downloads', icon: 'download' },
		{ name: 'Applications', path: '/Applications', icon: 'app' },
		{ name: 'Pictures', path: '/Pictures', icon: 'image' },
		{ name: 'Locations', type: 'section' },
		{ name: 'Computer', path: '/', icon: 'computer' }
	];

	// Get current directory contents
	function getCurrentContents() {
		const current = fileSystem[currentPath];
		if (!current || current.type !== 'folder') return [];

		let items = current.children.map((name) => {
			const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
			return {
				...fileSystem[fullPath],
				path: fullPath,
				displayName: name
			};
		});

		// Filter by search query
		if (searchQuery.trim()) {
			items = items.filter((item) =>
				item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Sort items
		items.sort((a, b) => {
			let aValue, bValue;

			switch (sortBy) {
				case 'name':
					aValue = a.displayName.toLowerCase();
					bValue = b.displayName.toLowerCase();
					break;
				case 'modified':
					aValue = a.modified.getTime();
					bValue = b.modified.getTime();
					break;
				case 'size':
					aValue = a.size || 0;
					bValue = b.size || 0;
					break;
				case 'kind':
					aValue = a.type === 'folder' ? 'folder' : a.extension || '';
					bValue = b.type === 'folder' ? 'folder' : b.extension || '';
					break;
				default:
					return 0;
			}

			if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
			return 0;
		});

		// Folders first
		return items.sort((a, b) => {
			if (a.type === 'folder' && b.type !== 'folder') return -1;
			if (a.type !== 'folder' && b.type === 'folder') return 1;
			return 0;
		});
	}

	// Navigate to path
	function navigateTo(path: string) {
		if (fileSystem[path]) {
			currentPath = path;
			selectedItems.clear();
		}
	}

	// Handle item double click
	function handleItemDoubleClick(item: any) {
		if (item.type === 'folder') {
			navigateTo(item.path);
		} else {
			// Generate sample content for different file types
			let content = '';
			switch (item.extension) {
				case 'txt':
					content = `This is a text file: ${item.displayName}\n\nSample content for demonstration purposes.`;
					break;
				case 'md':
					content = `# ${item.displayName}\n\nThis is a markdown file.\n\n## Features\n- Markdown support\n- Live preview\n- Syntax highlighting`;
					break;
				case 'js':
					content = `// ${item.displayName}\nconsole.log('Hello from ${item.displayName}');\n\nfunction main() {\n    // Your code here\n}`;
					break;
				case 'html':
					content = `<!DOCTYPE html>\n<html>\n<head>\n    <title>${item.displayName}</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>`;
					break;
				case 'css':
					content = `/* ${item.displayName} */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}`;
					break;
				default:
					content = `File: ${item.displayName}\nType: ${item.extension || 'Unknown'}\n\nThis is sample content for demonstration.`;
			}

			// Dispatch file open event
			window.dispatchEvent(
				new CustomEvent('fileExplorer:openFile', {
					detail: {
						path: item.path,
						name: item.displayName,
						content: content,
						extension: item.extension
					}
				})
			);

			console.log('Opening file:', item.displayName);
		}
	}

	// Handle item selection
	function handleItemClick(item: any, event?: MouseEvent | KeyboardEvent) {
		const isMultiSelect = event && ('metaKey' in event ? event.metaKey || event.ctrlKey : false);

		if (isMultiSelect) {
			// Multi-select
			if (selectedItems.has(item.path)) {
				selectedItems.delete(item.path);
			} else {
				selectedItems.add(item.path);
			}
		} else {
			// Single select
			selectedItems.clear();
			selectedItems.add(item.path);
		}
		selectedItems = new Set(selectedItems);
	}

	// Get file icon
	function getFileIcon(item: any) {
		if (item.type === 'folder') return '📁';

		switch (item.extension) {
			case 'txt':
			case 'md':
			case 'readme':
				return '📄';
			case 'js':
			case 'ts':
			case 'jsx':
			case 'tsx':
				return '📜';
			case 'html':
			case 'htm':
				return '🌐';
			case 'css':
			case 'scss':
			case 'sass':
			case 'less':
				return '🎨';
			case 'json':
			case 'xml':
			case 'yaml':
			case 'yml':
				return '⚙️';
			case 'jpg':
			case 'jpeg':
			case 'png':
			case 'gif':
			case 'svg':
			case 'webp':
				return '🖼️';
			case 'mp4':
			case 'mov':
			case 'avi':
			case 'mkv':
			case 'webm':
				return '🎬';
			case 'mp3':
			case 'wav':
			case 'aac':
			case 'flac':
			case 'ogg':
				return '🎵';
			case 'pdf':
				return '📕';
			case 'zip':
			case 'rar':
			case '7z':
			case 'tar':
			case 'gz':
				return '🗜️';
			case 'pptx':
			case 'ppt':
				return '📊';
			case 'xlsx':
			case 'xls':
			case 'csv':
				return '📈';
			case 'docx':
			case 'doc':
				return '📝';
			case 'app':
			case 'exe':
			case 'deb':
			case 'dmg':
				return '⚙️';
			case 'py':
			case 'rb':
			case 'php':
			case 'java':
			case 'cpp':
			case 'c':
				return '💻';
			default:
				return '📄';
		}
	}

	// Format file size
	function formatFileSize(bytes: number | null) {
		if (!bytes) return '--';
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	}

	// Format date
	function formatDate(date: Date) {
		return (
			date.toLocaleDateString() +
			' ' +
			date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		);
	}

	// Go back
	function goBack() {
		if (currentPath === '/') return;
		const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
		navigateTo(parentPath);
	}

	// Go forward (placeholder)
	function goForward() {
		// Implement navigation history
	}

	// Helper functions for navigation
	function navigateBack() {
		goBack();
	}

	function navigateForward() {
		goForward();
	}

	function canGoBack() {
		return currentPath !== '/';
	}

	function canGoForward() {
		return false; // TODO: Implement navigation history
	}

	// Get icon for sidebar items
	function getIcon(iconType: string) {
		switch (iconType) {
			case 'desktop':
				return '🖥️';
			case 'folder':
				return '📁';
			case 'download':
				return '⬇️';
			case 'app':
				return '⚙️';
			case 'image':
				return '🖼️';
			case 'computer':
				return '💻';
			default:
				return '📁';
		}
	}

	// Get file kind for list view
	function getFileKind(item: any) {
		if (item.type === 'folder') return 'Folder';
		return item.extension?.toUpperCase() || 'File';
	}

	// Set sort by with toggle
	function setSortBy(newSortBy: string) {
		if (sortBy === newSortBy) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = newSortBy as any;
			sortOrder = 'asc';
		}
	}

	// Handle resize
	function handleResize(event: CustomEvent) {
		if (onResize) {
			onResize(event.detail);
		}
	}

	// Handle maximize
	function handleMaximize(event: CustomEvent) {
		isMaximized = event.detail.isMaximized;
		if (onMaximize) {
			onMaximize(isMaximized);
		}
	}

	onMount(() => {
		// Initialize component
	});
</script>

<BaseNode
	title="File Explorer"
	canResize={true}
	canMinimize={true}
	canMaximize={true}
	canClose={true}
	bind:isMinimized
	bind:isMaximized
	{onMaximize}
	on:resize={handleResize}
	on:maximize={handleMaximize}
>
	<div class="file-explorer">
		<!-- Toolbar -->
		<div class="toolbar">
			<div class="nav-controls">
				<button
					class="nav-btn"
					onclick={() => goBack()}
					disabled={currentPath === '/'}
					aria-label="Go back"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z" />
					</svg>
				</button>
				<button class="nav-btn" onclick={() => goForward()} disabled={true} aria-label="Go forward">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
					</svg>
				</button>
			</div>

			<div class="path-bar">{currentPath}</div>

			<div class="view-controls">
				<button
					class="view-btn {viewMode === 'icons' ? 'active' : ''}"
					onclick={() => (viewMode = 'icons')}
					aria-label="Icon view"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M4 6h4v4H4V6zm0 5h4v4H4v-4zm5 0h4v4H9v-4zm5 0h4v4h-4v-4zm0-5h4v4h-4V6zM9 6h4v4H9V6z"
						/>
					</svg>
				</button>
				<button
					class="view-btn {viewMode === 'list' ? 'active' : ''}"
					onclick={() => (viewMode = 'list')}
					aria-label="List view"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
						/>
					</svg>
				</button>
			</div>

			<div class="search-box">
				<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
					/>
				</svg>
				<input
					type="text"
					class="search-input"
					placeholder="Search"
					bind:value={searchQuery}
					aria-label="Search files and folders"
				/>
			</div>
		</div>

		<div class="explorer-content">
			<!-- Sidebar -->
			<div class="sidebar">
				{#each sidebarItems as item}
					{#if item.type === 'section'}
						<div class="sidebar-section">{item.name}</div>
					{:else}
						<button
							class="sidebar-item {currentPath === item.path ? 'active' : ''}"
							onclick={() => navigateTo(item.path)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									navigateTo(item.path);
								}
							}}
							role="button"
							tabindex="0"
							aria-label={`Navigate to ${item.name}`}
						>
							<span class="sidebar-icon">{getIcon(item.icon)}</span>
							<span class="sidebar-text">{item.name}</span>
						</button>
					{/if}
				{/each}
			</div>

			<!-- Main content -->
			<div class="main-content">
				{#if viewMode === 'icons'}
					<div class="icon-grid">
						{#each getCurrentContents() as item}
							<div
								class="file-item icon-item"
								class:selected={selectedItems.has(item.path)}
								onclick={(e) => handleItemClick(item, e)}
								ondblclick={() => handleItemDoubleClick(item)}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										handleItemDoubleClick(item);
									} else if (e.key === ' ') {
										e.preventDefault();
										handleItemClick(item);
									}
								}}
								role="button"
								tabindex="0"
								aria-label={`${item.type === 'folder' ? 'Folder' : 'File'}: ${item.name}`}
							>
								<div class="file-icon">{getFileIcon(item)}</div>
								<div class="file-name">{item.displayName}</div>
							</div>
						{/each}
					</div>
				{:else if viewMode === 'list'}
					<div class="list-view">
						<div class="list-header">
							<button
								class="header-btn"
								onclick={() => {
									sortBy = 'name';
									sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
								}}
								aria-label="Sort by name"
							>
								Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
							</button>
							<button
								class="header-btn"
								onclick={() => {
									sortBy = 'modified';
									sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
								}}
								aria-label="Sort by date modified"
							>
								Date Modified {sortBy === 'modified' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
							</button>
							<button
								class="header-btn"
								onclick={() => {
									sortBy = 'size';
									sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
								}}
								aria-label="Sort by size"
							>
								Size {sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
							</button>
							<button
								class="header-btn"
								onclick={() => {
									sortBy = 'kind';
									sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
								}}
								aria-label="Sort by kind"
							>
								Kind {sortBy === 'kind' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
							</button>
						</div>
						<div class="list-items">
							{#each getCurrentContents() as item}
								<div
									class="file-item list-item"
									class:selected={selectedItems.has(item.path)}
									onclick={(e) => handleItemClick(item, e)}
									ondblclick={() => handleItemDoubleClick(item)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleItemDoubleClick(item);
										} else if (e.key === ' ') {
											e.preventDefault();
											handleItemClick(item);
										}
									}}
									role="button"
									tabindex="0"
									aria-label={`${item.type === 'folder' ? 'Folder' : 'File'}: ${item.name}, modified ${item.modified.toLocaleDateString()}, ${item.size ? formatFileSize(item.size) : 'folder'}`}
								>
									<div class="list-cell name-cell">
										<span class="file-icon-small">{getFileIcon(item)}</span>
										<span class="file-name-text">{item.displayName}</span>
									</div>
									<div class="list-cell modified-cell">{item.modified.toLocaleDateString()}</div>
									<div class="list-cell size-cell">
										{item.size ? formatFileSize(item.size) : '--'}
									</div>
									<div class="list-cell kind-cell">{getFileKind(item)}</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if getCurrentContents().length === 0}
					<div class="empty-state">
						<div class="empty-icon">📁</div>
						<div class="empty-text">
							{searchQuery ? `No items found for "${searchQuery}"` : 'This folder is empty'}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</BaseNode>

<style>
	.file-explorer {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-background);
		color: var(--color-foreground);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		/* Enhance text readability */
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		/* Ensure proper contrast */
		text-shadow: 0 0 1px rgba(0, 0, 0, 0.1);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: var(--color-card);
		border-bottom: 1px solid var(--color-border);
		min-height: 44px;
	}

	.nav-controls {
		display: flex;
		gap: 4px;
	}

	.nav-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		color: var(--color-muted-foreground);
	}

	.path-bar {
		flex: 1;
		background: var(--color-muted);
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 13px;
		color: var(--color-foreground);
		font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
		font-weight: 500;
	}

	.view-controls {
		display: flex;
		gap: 2px;
		background: var(--color-muted);
		border-radius: 6px;
		padding: 2px;
	}

	.view-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.view-btn:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.view-btn.active {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-weight: 600;
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 8px;
		color: var(--color-muted-foreground);
		pointer-events: none;
		z-index: 1;
	}

	.search-input {
		width: 200px;
		height: 32px;
		padding: 0 12px 0 32px;
		border: 1px solid var(--color-border);
		border-radius: 16px;
		background: var(--color-background);
		color: var(--color-foreground);
		font-size: 13px;
		outline: none;
		transition: all 0.15s ease;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary) / 20%;
	}

	.search-input::placeholder {
		color: var(--color-muted-foreground);
	}

	.explorer-content {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.sidebar {
		width: 200px;
		background: var(--color-card);
		border-right: 1px solid var(--color-border);
		padding: 12px 8px;
		overflow-y: auto;
	}

	.sidebar-section {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 16px 8px 8px 8px;
	}

	.sidebar-section:first-child {
		margin-top: 0;
	}

	.sidebar-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-foreground);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.sidebar-item:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.sidebar-item.active {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-weight: 600;
	}

	.sidebar-icon {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}

	.sidebar-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.main-content {
		flex: 1;
		overflow: auto;
		background: var(--color-background);
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 16px;
		padding: 16px;
	}

	.icon-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
		outline: none;
	}

	.icon-item:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.icon-item:focus {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.icon-item.selected {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.file-icon {
		font-size: 32px;
		line-height: 1;
	}

	.file-icon-small {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}

	.file-name {
		font-size: 12px;
		font-weight: 500;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
		color: inherit;
	}

	.file-name-text {
		font-weight: 500;
		color: inherit;
	}

	.list-view {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.list-header {
		display: grid;
		grid-template-columns: 2fr 1.5fr 100px 100px;
		gap: 12px;
		padding: 8px 16px;
		background: var(--color-card);
		border-bottom: 1px solid var(--color-border);
		font-size: 12px;
		font-weight: 600;
	}

	.header-btn {
		border: none;
		background: transparent;
		color: var(--color-foreground);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		padding: 4px 0;
		border-radius: 4px;
		transition: all 0.15s ease;
		outline: none;
	}

	.header-btn:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.header-btn:focus {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.list-items {
		flex: 1;
		overflow-y: auto;
	}

	.list-item {
		display: grid;
		grid-template-columns: 2fr 1.5fr 100px 100px;
		gap: 12px;
		padding: 6px 16px;
		border-bottom: 1px solid var(--color-border);
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
		outline: none;
	}

	.list-item:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.list-item:focus {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
		box-shadow: inset 0 0 0 2px var(--color-primary);
	}

	.list-item.selected {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.list-cell {
		display: flex;
		align-items: center;
		font-size: 13px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: inherit;
	}

	.name-cell {
		gap: 8px;
	}

	.modified-cell,
	.size-cell,
	.kind-cell {
		color: var(--color-muted-foreground);
		font-size: 12px;
		font-weight: 400;
	}

	.list-item.selected .modified-cell,
	.list-item.selected .size-cell,
	.list-item.selected .kind-cell {
		color: var(--color-primary-foreground);
		opacity: 0.8;
	}

	.list-item:hover .modified-cell,
	.list-item:hover .size-cell,
	.list-item:hover .kind-cell {
		color: var(--color-accent-foreground);
		opacity: 0.8;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--color-muted-foreground);
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 12px;
		opacity: 0.6;
	}

	.empty-text {
		font-size: 14px;
		font-weight: 500;
		text-align: center;
		color: var(--color-muted-foreground);
		/* Enhance readability of muted text */
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	/* Global text enhancement for better readability */
	.file-explorer * {
		/* Ensure all text inherits proper color contrast */
		text-rendering: inherit;
	}

	/* Specific enhancements for small text */
	.sidebar-section,
	.modified-cell,
	.size-cell,
	.kind-cell,
	.file-name {
		/* Enhance readability of smaller text */
		letter-spacing: 0.01em;
	}

	/* Focus styles for better accessibility */
	.sidebar-item:focus,
	.icon-item:focus,
	.list-item:focus,
	.header-btn:focus,
	.nav-btn:focus,
	.view-btn:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
