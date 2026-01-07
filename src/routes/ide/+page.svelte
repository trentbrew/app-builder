<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { webcontainerStore } from '$lib/webcontainerStore';
	import { EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput,
		language
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { html } from '@codemirror/lang-html';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { initialCode } from '$lib/initialCode';
	import { browser } from '$app/environment';
	import Terminal from '$lib/Terminal.svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Eye, EyeOff } from '@lucide/svelte/icons';

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	let loading = true;
	let error = '';
	let previewUrl = '';
	let logs: string[] = [];
	let logsContainer: HTMLDivElement;
	let userScrolledUp = false;
	let listenerAttached = false;
	let showPreview = false;

	// Track currently selected file
	let currentFile = $state({
		name: 'App.svelte',
		path: '/App.svelte',
		content: initialCode
	});

	// Function to generate breadcrumb path from file path
	function getBreadcrumbPath(filePath: string) {
		const parts = filePath.split('/').filter((part) => part !== '');
		return parts;
	}

	// Subscribe to the store for loading, error, previewUrl, and logs
	const unsubscribe = webcontainerStore.subscribe(async (state) => {
		loading = state.loading;
		error = state.error;
		previewUrl = state.previewUrl;
		logs = state.logs;

		// Load initial App.svelte content when webcontainer is ready
		if (
			state.fs &&
			!state.loading &&
			currentFile.name === 'App.svelte' &&
			currentFile.content === initialCode
		) {
			try {
				const content = await state.fs.readFile('/App.svelte', 'utf-8');
				currentFile = {
					name: 'App.svelte',
					path: '/App.svelte',
					content: content
				};

				// Update editor if it exists
				if (editorView) {
					const transaction = editorView.state.update({
						changes: { from: 0, to: editorView.state.doc.length, insert: content }
					});
					editorView.dispatch(transaction);
				}
			} catch (error) {
				console.error('Error loading initial App.svelte:', error);
			}
		}
	});

	// Helper to check if user is at the bottom
	function isAtBottom(container: HTMLDivElement) {
		if (!container) return false;
		return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
	}

	// Attach scroll listener to logs container
	function setupLogsScrollListener() {
		if (!logsContainer) return;
		logsContainer.addEventListener('scroll', () => {
			userScrolledUp = !isAtBottom(logsContainer);
		});
	}

	// Listener for messages from the iframe
	function handleIframeMessage(event: MessageEvent) {
		// Optional: Check event.origin for security if needed
		if (event.data && event.data.type && ['log', 'error', 'warn'].includes(event.data.type)) {
			const prefix = `[iframe-${event.data.type}]`;
			const message = event.data.args
				.map((arg: any) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				.join(' ');
			// Update logs directly here, or could dispatch to the store
			logs = [...logs, `${prefix} ${message}`];

			// After logs update, scroll to bottom if user is not scrolled up
			setTimeout(() => {
				if (logsContainer && !userScrolledUp) {
					logsContainer.scrollTop = logsContainer.scrollHeight;
				}
			}, 0);
		}
	}

	// Auto-scroll console panel after logs update
	$effect(() => {
		// Attach scroll listener once
		if (logsContainer && !listenerAttached) {
			setupLogsScrollListener();
			listenerAttached = true;
		}
		// Auto-scroll if user hasn't scrolled up
		if (logsContainer && !userScrolledUp) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	// Function to handle file selection from FileExplorer
	function handleFileSelect(fileName: string, content: string, fullPath?: string) {
		console.log('🎯 IDE handleFileSelect called:', {
			fileName,
			contentLength: content.length,
			fullPath
		});

		// Update current file state
		currentFile = {
			name: fileName,
			path: fullPath || `/${fileName}`,
			content: content
		};

		console.log('📝 Current file updated:', currentFile);

		if (editorView) {
			console.log('✏️ Editor view exists, updating content...');
			const transaction = editorView.state.update({
				changes: { from: 0, to: editorView.state.doc.length, insert: content }
			});
			editorView.dispatch(transaction);
			console.log(`✅ Loaded ${fileName} into editor.`);
		} else {
			console.log('❌ Editor view is null!');
		}
	}

	// Run on demand instead of hot‑reload on every keystroke
	async function handleRun() {
		if (editorView) {
			const code = editorView.state.doc.toString();
			await webcontainerStore.write('/App.svelte', code);
		}
	}

	onMount(() => {
		if (browser) window.addEventListener('message', handleIframeMessage);

		console.log('Editor container DOM element:', editorContainer);
		const state = EditorState.create({
			doc: initialCode,
			extensions: [
				oneDark,
				autocompletion(),
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				foldGutter(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				indentOnInput(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				highlightSelectionMatches(),
				keymap.of([
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					indentWithTab
				]),
				html()
				// Removed EditorView.updateListener for auto-write
			]
		});

		editorView = new EditorView({ state, parent: editorContainer });
	});

	onDestroy(() => {
		unsubscribe();
		if (browser) window.removeEventListener('message', handleIframeMessage);
	});
</script>

<Sidebar.Provider class="" style="">
	<AppSidebar onFileSelect={handleFileSelect} currentFile={currentFile.name} />
	<Sidebar.Inset class="" style="">
		<header class="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
			<div class="flex items-center gap-2">
				<Sidebar.Trigger class="-ml-1" onclick={() => {}} />
				<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb.Root class="" style="">
					<Breadcrumb.List class="" style="">
						{#each getBreadcrumbPath(currentFile.path) as part, index}
							{#if index > 0}
								<Breadcrumb.Separator class="hidden md:block" />
							{/if}
							<Breadcrumb.Item
								class={index === getBreadcrumbPath(currentFile.path).length - 1
									? ''
									: 'hidden md:block'}
							>
								{#if index === getBreadcrumbPath(currentFile.path).length - 1}
									<Breadcrumb.Page>{part}</Breadcrumb.Page>
								{:else}
									<Breadcrumb.Link href="#" class="" child={() => {}}>{part}</Breadcrumb.Link>
								{/if}
							</Breadcrumb.Item>
						{/each}
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
			<div class="flex items-center gap-2">
				<Button size="sm" variant="outline" class="" disabled={false} on:click={handleRun}
					>Run</Button
				>
				<Button
					size="sm"
					variant="outline"
					class=""
					disabled={false}
					on:click={() => {
						console.log('🧪 Testing file system...');
						let fs: any;
						webcontainerStore.subscribe((state) => {
							fs = state.fs;
						})();
						console.log('🧪 File system available:', !!fs);
						if (fs) {
							fs.readFile('/package.json', 'utf-8')
								.then((content: string) => {
									console.log('🧪 package.json content:', content.substring(0, 200));
									handleFileSelect('package.json', content, '/package.json');
								})
								.catch((error: any) => {
									console.error('🧪 Error reading package.json:', error);
								});
						}
					}}
				>
					Test FS
				</Button>
				<Button
					size="sm"
					variant="outline"
					class=""
					disabled={false}
					on:click={() => (showPreview = !showPreview)}
				>
					{#if showPreview}
						<EyeOff class="h-4 w-4" />
					{:else}
						<Eye class="h-4 w-4" />
					{/if}
					Preview
				</Button>
			</div>
		</header>
		<main class="flex-1 overflow-hidden">
			<div class="grid-layout">
				<!-- Code Editor Panel -->
				<div class="panel editor-panel">
					<div class="editor-wrapper" bind:this={editorContainer}></div>
				</div>

				<!-- Preview Panel (toggleable) -->
				{#if showPreview}
					<div class="panel preview-panel">
						{#if loading}
							<div class="preview-loading">
								<p>Loading preview...</p>
								<p class="hint">This can take 15-30 seconds while dependencies are installed.</p>
							</div>
						{:else if error}
							<div class="preview-error">
								<h3>Error</h3>
								<p>{error}</p>
							</div>
						{:else}
							<iframe src={previewUrl} title="Svelte REPL Preview"></iframe>
						{/if}
					</div>
				{/if}

				<!-- Terminal Panel -->
				<div class="panel terminal-panel">
					<Terminal />
				</div>

				<!-- Console Panel -->
				<!-- <div class="panel console-panel" bind:this={logsContainer}>
					<pre>{logs.join('\n')}</pre>
				</div> -->
			</div>
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

<style>
	/* Main grid layout - responsive based on preview visibility */
	.grid-layout {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
		height: 100%;
		gap: 8px;
		padding: 8px;
	}

	.panel {
		position: relative;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.editor-panel {
		background: #282c34;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.editor-wrapper {
		flex-grow: 1;
		overflow: hidden;
		height: 100%;
	}

	.preview-panel {
		position: relative;
		background: #f9f9f9;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.preview-panel iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	.console-panel {
		background: #3d434d;
		color: #eee;
		padding: 10px;
		font-family: monospace;
		font-size: 13px;
		overflow-y: auto;
	}

	.terminal-panel {
		background: #1e1e1e;
	}

	.preview-loading,
	.preview-error {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #f9f9f9;
		color: #333;
	}

	.preview-error {
		background: #fff0f0;
		color: #d00;
	}

	.hint {
		font-size: 0.8em;
		color: #777;
	}

	/* Dynamic grid layout based on preview visibility */
	.grid-layout {
		grid-template-columns: 1fr;
	}

	:global(.grid-layout:has(.preview-panel)) {
		grid-template-columns: 1fr 1fr;
	}
</style>
