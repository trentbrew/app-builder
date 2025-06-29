<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
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
	import FileExplorer from '$lib/FileExplorer.svelte';

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	let loading = true;
	let error = '';
	let previewUrl = '';
	let logs: string[] = [];
	let logsContainer: HTMLDivElement;
	let userScrolledUp = false;
	let listenerAttached = false;

	// Subscribe to the store for loading, error, previewUrl, and logs
	const unsubscribe = webcontainerStore.subscribe((state) => {
		loading = state.loading;
		error = state.error;
		previewUrl = state.previewUrl;
		logs = state.logs;
	});

	// Helper to check if user is at the bottom
	function isAtBottom(container: HTMLDivElement) {
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
	afterUpdate(() => {
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
	function handleFileSelect(path: string, content: string) {
		if (editorView) {
			const transaction = editorView.state.update({
				changes: { from: 0, to: editorView.state.doc.length, insert: content }
			});
			editorView.dispatch(transaction);
			// Optionally, update the file being edited in webcontainerStore if needed
			// webcontainerStore.write(path, content); // Be careful about triggering loops
			console.log(`Loaded ${path} into editor.`);
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

<div class="grid-layout">
	<!-- Code Editor Panel -->
	<div class="panel editor-panel-container">
		<div class="file-explorer-wrapper">
			<FileExplorer onSelectFile={handleFileSelect} />
		</div>
		<div class="editor-main">
			<div class="editor-controls">
				<button class="run-btn" on:click={handleRun}>Run</button>
			</div>
			<div class="editor-wrapper" bind:this={editorContainer}></div>
		</div>
	</div>

	<!-- Preview Panel -->
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

	<!-- Terminal Panel -->
	<div class="panel terminal-panel">
		<Terminal />
	</div>

	<!-- Console Panel -->
	<div class="panel console-panel" bind:this={logsContainer}>
		<pre>{logs.join('\n')}</pre>
	</div>
</div>

<style>
	/* Main 2x2 grid layout */
	.grid-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		height: 100vh;
		gap: 8px;
		padding: 8px;
	}
	.panel {
		position: relative;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.editor-panel-container {
		display: flex;
		background: #282c34;
	}

	.file-explorer-wrapper {
		width: 200px;
		flex-shrink: 0;
		background: #3d434d;
		overflow-y: auto;
		color: #eee;
		padding: 5px;
		border-right: 1px solid rgba(255, 255, 255, 0.2);
	}

	.editor-main {
		position: relative;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.editor-controls {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 2;
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

	/* Removed .preview-controls and moved .run-btn to .editor-controls */

	.run-btn {
		background: #4caf50;
		color: #fff;
		border: none;
		padding: 4px 8px;
		cursor: pointer;
		border-radius: 4px;
	}
	.run-btn:hover {
		background: #45a049;
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
	.terminal-panel .terminal-container {
		width: 100%;
		height: 100%;
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
</style>
